import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  eq,
  and,
  count,
  countDistinct,
  desc,
  inArray,
} from 'drizzle-orm';
import {
  fragments,
  goals,
  fragmentTagLinks,
} from '@server/database/schema';
import type {
  Fragment,
  Goal,
  FragmentListParams,
  FragmentListResponse,
  CreateFragmentRequest,
  UpdateFragmentRequest,
  ParseLinkResponse,
  FragmentType,
} from '@shared/api.interface';
import { TikHubService } from './tikhub.service';

type FragmentRow = typeof fragments.$inferSelect;
type GoalRow = typeof goals.$inferSelect;

@Injectable()
export class FragmentsService {
  private readonly logger = new Logger(FragmentsService.name);

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
    private readonly httpService: HttpService,
    private readonly tikHubService: TikHubService,
  ) {}

  async list(
    userId: string,
    params: FragmentListParams,
  ): Promise<FragmentListResponse> {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 20, 50);
    const offset = (page - 1) * pageSize;

    const conditions = [eq(fragments.userId, userId)];
    if (params.type) {
      conditions.push(eq(fragments.type, params.type));
    }

    // pillar / goalId 需要 join fragment_tag_links + goals
    const hasJoinFilter = !!params.goalId || !!params.pillar;
    const where = and(...conditions);

    let total: number;
    let fragmentRows: FragmentRow[];

    if (hasJoinFilter) {
      if (params.goalId) {
        conditions.push(eq(goals.id, params.goalId));
      }
      if (params.pillar) {
        conditions.push(eq(goals.pillar, params.pillar));
      }
      const joinWhere = and(...conditions);

      const [countResult, joinedRows] = await Promise.all([
        this.db
          .select({ count: countDistinct(fragments.id) })
          .from(fragments)
          .innerJoin(
            fragmentTagLinks,
            eq(fragmentTagLinks.fragmentId, fragments.id),
          )
          .innerJoin(goals, eq(goals.id, fragmentTagLinks.goalId))
          .where(joinWhere),
        this.db
          .select()
          .from(fragments)
          .innerJoin(
            fragmentTagLinks,
            eq(fragmentTagLinks.fragmentId, fragments.id),
          )
          .innerJoin(goals, eq(goals.id, fragmentTagLinks.goalId))
          .where(joinWhere)
          .orderBy(desc(fragments.createdAt))
          .limit(pageSize)
          .offset(offset),
      ]);

      total = Number(countResult[0]?.count ?? 0);
      const allRows = joinedRows.map(
        (row: Record<string, unknown>) => row.fragments as FragmentRow,
      );

      // Deduplicate (join may produce duplicate fragments when multiple tags match)
      const seen = new Set<string>();
      fragmentRows = [];
      for (const fr of allRows) {
        if (!seen.has(fr.id)) {
          seen.add(fr.id);
          fragmentRows.push(fr);
        }
      }
    } else {
      const [countResult, rows] = await Promise.all([
        this.db.select({ count: count() }).from(fragments).where(where),
        this.db
          .select()
          .from(fragments)
          .where(where)
          .orderBy(desc(fragments.createdAt))
          .limit(pageSize)
          .offset(offset),
      ]);

      total = Number(countResult[0]?.count ?? 0);
      fragmentRows = rows as unknown as FragmentRow[];
    }

    const items = await this.attachTags(userId, fragmentRows);

    return { items, total, page, pageSize };
  }

  async getById(userId: string, id: string): Promise<Fragment> {
    const rows = await this.db
      .select()
      .from(fragments)
      .where(and(eq(fragments.id, id), eq(fragments.userId, userId)));

    if (rows.length === 0) {
      throw new NotFoundException('碎片不存在');
    }

    const items = await this.attachTags(userId, [rows[0]]);
    return items[0];
  }

  async create(
    userId: string,
    dto: CreateFragmentRequest,
  ): Promise<Fragment> {
    const tagIds = dto.tagIds ?? [];

    // Validate tag ownership if provided
    if (tagIds.length > 0) {
      await this.validateGoalsOwnership(userId, tagIds);
    }

    const created = await this.db.transaction(async (tx) => {
      const [fragment] = await tx
        .insert(fragments)
        .values({
          userId,
           type: dto.type ?? 'text',
           content: dto.content ?? null,
          rawUrl: dto.rawUrl ?? null,
          title: dto.title ?? null,
          summary: dto.summary ?? null,
          cover: dto.cover ?? null,
           audioUrl: dto.audioUrl ?? null,
           images: JSON.stringify(dto.images ?? []),
         })
        .returning();

      if (tagIds.length > 0) {
        await tx
          .insert(fragmentTagLinks)
          .values(
            tagIds.map((goalId: string) => ({
              fragmentId: fragment.id,
              goalId,
            })),
          )
          .onConflictDoNothing();
      }

      return fragment;
    });

    return this.getById(userId, created.id);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFragmentRequest,
  ): Promise<Fragment> {
    // Verify ownership first
    const existing = await this.db
      .select()
      .from(fragments)
      .where(and(eq(fragments.id, id), eq(fragments.userId, userId)));

    if (existing.length === 0) {
      throw new NotFoundException('碎片不存在');
    }

    const patch: Partial<typeof fragments.$inferInsert> = {};
    if (dto.content !== undefined) patch.content = dto.content;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.summary !== undefined) patch.summary = dto.summary;
    if (dto.cover !== undefined) patch.cover = dto.cover;
    if (dto.rawUrl !== undefined) patch.rawUrl = dto.rawUrl;
    if (dto.audioUrl !== undefined) patch.audioUrl = dto.audioUrl;
    if (dto.images !== undefined) patch.images = JSON.stringify(dto.images);

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    patch.updatedAt = new Date();

    await this.db
      .update(fragments)
      .set(patch)
      .where(and(eq(fragments.id, id), eq(fragments.userId, userId)));

    return this.getById(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted = await this.db
      .delete(fragments)
      .where(and(eq(fragments.id, id), eq(fragments.userId, userId)))
      .returning({ id: fragments.id });

    if (deleted.length === 0) {
      throw new NotFoundException('碎片不存在');
    }
  }

  async bindTags(
    userId: string,
    fragmentId: string,
    tagIds: string[],
  ): Promise<Fragment> {
    // Verify fragment ownership
    const fragRows = await this.db
      .select()
      .from(fragments)
      .where(
        and(eq(fragments.id, fragmentId), eq(fragments.userId, userId)),
      );

    if (fragRows.length === 0) {
      throw new NotFoundException('碎片不存在');
    }

    if (tagIds.length === 0) {
      return this.getById(userId, fragmentId);
    }

    // Validate goal ownership
    await this.validateGoalsOwnership(userId, tagIds);

    await this.db
      .insert(fragmentTagLinks)
      .values(
        tagIds.map((goalId: string) => ({
          fragmentId,
          goalId,
        })),
      )
      .onConflictDoNothing();

    return this.getById(userId, fragmentId);
  }

  async unbindTag(
    userId: string,
    fragmentId: string,
    goalId: string,
  ): Promise<void> {
    // Verify fragment ownership
    const fragRows = await this.db
      .select()
      .from(fragments)
      .where(
        and(eq(fragments.id, fragmentId), eq(fragments.userId, userId)),
      );

    if (fragRows.length === 0) {
      throw new NotFoundException('碎片不存在');
    }

    await this.db
      .delete(fragmentTagLinks)
      .where(
        and(
          eq(fragmentTagLinks.fragmentId, fragmentId),
          eq(fragmentTagLinks.goalId, goalId),
        ),
      );
  }

  async parseLink(rawInput: string): Promise<ParseLinkResponse> {
    const extracted = this.extractUrlFromText(rawInput);
    if (!extracted.url) {
      this.logger.warn(`链接解析失败：未找到有效 URL - ${rawInput.slice(0, 100)}`);
      return {
        title: null,
        summary: null,
        cover: null,
        author: null,
        source: null,
        dataSource: null,
        error: '未识别到有效链接，请粘贴完整链接',
      };
    }

    const url = extracted.url;
    const textFallback = this.extractDouyinFallback(rawInput);
    const isDouyin = /douyin\.com|iesdouyin\.com/i.test(url);

    if (isDouyin) {
      const tikhubResult = await this.tikHubService.fetchDouyinVideo(url);
      if (tikhubResult) {
        return {
          title: tikhubResult.title || textFallback.title || null,
          summary: tikhubResult.summary || textFallback.summary || null,
          cover: tikhubResult.cover || null,
          author: tikhubResult.author || null,
          source: 'tikhub',
          dataSource: 'TikHub 真实数据',
          error: null,
        };
      }
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get<string>(url, {
          responseType: 'text',
          timeout: 8000,
          maxRedirects: 5,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9',
          },
        }),
      );

      const html = response.data;
      const finalUrl = response.headers.location
        ? response.headers.location
        : url;

      const result = this.parsePageContent(html, finalUrl);
      const isDouyin = /douyin\.com|iesdouyin\.com/i.test(finalUrl) || /douyin\.com|iesdouyin\.com/i.test(url);

      if (isDouyin) {
        const isGenericTitle =
          !result.title ||
          /^(在抖音|抖音|抖音精选|记录美好生活)/.test(result.title) ||
          result.title.length < 6;
        const isGenericSummary =
          !result.summary ||
          /(记录美好生活|发布在抖音|收获了.{0,5}喜欢)/.test(result.summary);
        const finalTitle = isGenericTitle && textFallback.title
          ? textFallback.title
          : result.title || textFallback.title || null;
        const finalSummary = textFallback.summary || result.summary || null;
        return {
          title: finalTitle,
          summary: finalSummary,
          cover: result.cover || null,
          author: null,
          source: textFallback.summary || (isGenericTitle && textFallback.title)
            ? 'text-fallback'
            : result.source || 'og:meta',
          dataSource: '分享文本提取（降级）',
          error:
            '抖音真实信息抓取失败，已降级为分享文本提取。' +
            (isGenericTitle && isGenericSummary && !result.cover
              ? '信息可能不完整，建议手动补充。'
              : ''),
        };
      }

      if (result.title || result.cover) {
        return {
          title: result.title || textFallback.title || null,
          summary: result.summary || textFallback.summary || null,
          cover: result.cover || null,
          author: null,
          source: result.source || 'og:meta',
          dataSource: '页面元数据',
          error: null,
        };
      }

      if (textFallback.title || textFallback.summary) {
        return {
          title: textFallback.title || null,
          summary: textFallback.summary || null,
          cover: null,
          author: null,
          source: 'text-fallback',
          dataSource: '分享文本提取',
          error: '页面内容未能抓取，已从分享文本中提取部分信息',
        };
      }

      return {
        title: null,
        summary: null,
        cover: null,
        author: null,
        source: null,
        dataSource: null,
        error: '未能获取页面信息，请手动填写',
      };
    } catch (error) {
      const errMsg = (error as { message?: string; code?: string })?.message ?? '';
      const errCode = (error as { code?: string })?.code ?? '';
      let reason = '未能获取页面信息，请手动填写';
      if (errCode === 'ECONNABORTED' || errMsg.includes('timeout')) {
        reason = '请求超时，页面响应较慢';
      } else if (errCode === 'ENOTFOUND' || errMsg.includes('ENOTFOUND')) {
        reason = '域名解析失败，无法访问该链接';
      } else if (errMsg.includes('403') || errMsg.includes('429')) {
        reason = '目标站点拒绝访问（可能被反爬）';
      } else if (errMsg.includes('404')) {
        reason = '链接已失效（404）';
      }
      this.logger.warn(`链接解析失败: ${url}`, errMsg);

      if (textFallback.title || textFallback.summary) {
        return {
          title: textFallback.title || null,
          summary: textFallback.summary || null,
          cover: null,
          author: null,
          source: 'text-fallback',
          dataSource: isDouyin ? '分享文本提取（TikHub 抓取失败降级）' : '分享文本提取',
          error:
            reason +
            (isDouyin ? '，TikHub 真实数据抓取失败，已降级为分享文本提取' : '，已从分享文本中提取部分信息'),
        };
      }
      return {
        title: null,
        summary: null,
        cover: null,
        author: null,
        source: null,
        dataSource: null,
        error: reason,
      };
    }
  }

  private extractUrlFromText(text: string): { url: string | null } {
    const match = text.match(/https?:\/\/[^\s一-龥，。；,;！!？?"'`）)（【】《》]+/i);
    if (match) {
      return { url: match[0].replace(/[.,;:!?，。；：！？、)]+$/i, '') };
    }
    return { url: null };
  }

  private extractDouyinFallback(text: string): { title: string | null; summary: string | null } {
    let title: string | null = null;
    let summary: string | null = null;

    const bracketMatches = text.match(/【([^】]+)】/g);
    if (bracketMatches && bracketMatches.length > 0) {
      const last = bracketMatches[bracketMatches.length - 1];
      const inner = last.slice(1, -1).trim();
      if (inner && inner.length <= 30 && !/(的作品|的抖音|点赞|评论|关注)$/.test(inner)) {
        title = inner;
      } else if (inner.includes('的作品')) {
        title = inner.replace(/的作品$/, '').trim();
      } else if (bracketMatches.length >= 2) {
        const second = bracketMatches[bracketMatches.length - 2];
        title = second.slice(1, -1).trim();
      }
    }

    const urlMatch = text.match(/https?:\/\/\S+/);
    if (urlMatch && urlMatch.index !== undefined) {
      const beforeUrl = text.slice(0, urlMatch.index).trim();
      const afterUrl = text.slice(urlMatch.index + urlMatch[0].length).trim();

      let mainText = beforeUrl;
      if (afterUrl.length > 0 && afterUrl.length < beforeUrl.length * 3) {
        mainText = beforeUrl + ' ' + afterUrl;
      }

      let clean = mainText
        .replace(/【[^】]+】/g, '')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        .replace(/\b[a-zA-Z]{2,4}[:/][a-zA-Z0-9._~:/?#@!$&'()*+,;=%-]+/g, '')
        .replace(/\b[a-zA-Z]+\.[a-zA-Z]+\b/g, '')
        .replace(/\b[a-zA-Z0-9]{6,15}\b/g, '')
        .replace(/\b\d{1,2}\/\d{2}\b/g, '')
        .replace(/\b\d+:\d{2}(\s*[ap]m)?\b/gi, '')
        .replace(/(^|[\s，。；：！？、])[a-zA-Z]([^a-zA-Z\s]|$)/g, '$1')
        .replace(/(^|[\s，。；：！？、])[A-Z@]+(\s|$)/g, '$1')
        .replace(/@[\w.]+/g, '')
        .replace(/[\s.。，,;；:：!！?？、~～()（）\-_]+/g, ' ')
        .replace(/^[\s\W_\d.]+|[\s\W_]+$/g, '')
        .trim();
      if (clean.length > 5) {
        summary = clean.length > 200 ? clean.slice(0, 200) + '...' : clean;
      }
    }

    return { title, summary };
  }

  private parsePageContent(
    html: string,
    finalUrl: string,
  ): { title: string | null; summary: string | null; cover: string | null; source: string | null } {
    const ogTitle = this.extractMeta(html, 'og:title');
    const ogDesc = this.extractMeta(html, 'og:description');
    const ogImage = this.extractMeta(html, 'og:image');
    const pageTitle = this.extractTitle(html);
    const metaDesc = this.extractMeta(html, 'description');

    const title = ogTitle || pageTitle || null;
    const summary = ogDesc || metaDesc || null;
    const cover = ogImage || null;

    if (title && (summary || cover)) {
      return { title, summary, cover, source: 'og:meta' };
    }

    const douyinData = this.extractDouyinJsonData(html);
    if (douyinData.title || douyinData.cover) {
      return {
        title: douyinData.title || title || null,
        summary: douyinData.desc || summary || null,
        cover: douyinData.cover || cover || null,
        source: douyinData.source || 'page-json',
      };
    }

    return { title, summary, cover, source: title ? 'og:meta' : null };
  }

  private extractDouyinJsonData(html: string): {
    title: string | null;
    desc: string | null;
    cover: string | null;
    source: string | null;
  } {
    const patterns = [
      /window\._ROUTER_DATA\s*=\s*(\{.*?\})\s*;?\s*<\/script>/s,
      /window\.__INIT_PROPS__\s*=\s*(\{.*?\})\s*;?\s*<\/script>/s,
      /<script[^>]*id="RENDER_DATA"[^>]*>(.*?)<\/script>/s,
      /render_data\s*=\s*\[(.*?)\]\s*;?\s*<\/script>/s,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (!match) continue;
      try {
        const raw = match[1];
        const decoded = this.decodeHtmlEntities(raw);
        const data = JSON.parse(decoded);
        const found = this.walkJsonForVideo(data);
        if (found.title || found.cover) {
          return { ...found, source: 'page-json' };
        }
      } catch {
        continue;
      }
    }
    return { title: null, desc: null, cover: null, source: null };
  }

  private walkJsonForVideo(obj: unknown, depth = 0): {
    title: string | null;
    desc: string | null;
    cover: string | null;
  } {
    if (depth > 8 || !obj || typeof obj !== 'object') {
      return { title: null, desc: null, cover: null };
    }
    const o = obj as Record<string, unknown>;

    if ('title' in o && typeof o.title === 'string' && o.title.length > 0) {
      const cover = this.findCoverInObj(o);
      const desc =
        'desc' in o && typeof o.desc === 'string'
          ? o.desc
          : 'description' in o && typeof o.description === 'string'
            ? o.description
            : null;
      if (cover || desc) {
        return { title: o.title, desc: desc || null, cover };
      }
    }

    for (const key of Object.keys(o)) {
      const val = o[key];
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          for (const item of val) {
            const found = this.walkJsonForVideo(item, depth + 1);
            if (found.title || found.cover) return found;
          }
        } else {
          const found = this.walkJsonForVideo(val, depth + 1);
          if (found.title || found.cover) return found;
        }
      }
    }
    return { title: null, desc: null, cover: null };
  }

  private findCoverInObj(obj: Record<string, unknown>): string | null {
    const candidates = ['cover', 'coverUrl', 'cover_url', 'dynamicCover', 'poster', 'thumbnail', 'thumbnailUrl'];
    for (const key of candidates) {
      const val = obj[key];
      if (typeof val === 'string' && val.startsWith('http') && val.length > 10) {
        return val;
      }
      if (val && typeof val === 'object') {
        const urlList = (val as Record<string, unknown>).urlList;
        if (Array.isArray(urlList) && urlList.length > 0) {
          const first = urlList[0];
          if (typeof first === 'string') return first;
        }
        const url = (val as Record<string, unknown>).url;
        if (typeof url === 'string') return url;
      }
    }
    return null;
  }

  // --- helpers ---

  private async validateGoalsOwnership(
    userId: string,
    goalIds: string[],
  ): Promise<void> {
    const userGoals = await this.db
      .select({ id: goals.id })
      .from(goals)
      .where(and(eq(goals.userId, userId), inArray(goals.id, goalIds)));

    if (userGoals.length !== goalIds.length) {
      const validIds = new Set(userGoals.map((g) => g.id));
      const invalidIds = goalIds.filter((id) => !validIds.has(id));
      throw new BadRequestException(
        `标签不存在或无权限: ${invalidIds.join(', ')}`,
      );
    }
  }

  private async attachTags(
    userId: string,
    fragmentRows: FragmentRow[],
  ): Promise<Fragment[]> {
    if (fragmentRows.length === 0) return [];

    const fragmentIds = fragmentRows.map((f) => f.id);

    const links = await this.db
      .select()
      .from(fragmentTagLinks)
      .where(inArray(fragmentTagLinks.fragmentId, fragmentIds));

    const goalIds = [...new Set(links.map((l) => l.goalId))];
    const goalMap = new Map<string, Goal>();

    if (goalIds.length > 0) {
      const goalRows = await this.db
        .select()
        .from(goals)
        .where(
          and(eq(goals.userId, userId), inArray(goals.id, goalIds)),
        );

      for (const g of goalRows) {
        goalMap.set(g.id, this.mapGoal(g));
      }
    }

    // Group links by fragmentId
    const tagsByFragment = new Map<string, Goal[]>();
    for (const link of links) {
      const goal = goalMap.get(link.goalId);
      if (goal) {
        const arr = tagsByFragment.get(link.fragmentId) ?? [];
        arr.push(goal);
        tagsByFragment.set(link.fragmentId, arr);
      }
    }

    return fragmentRows.map((row) => ({
      ...this.mapFragment(row),
      tags: tagsByFragment.get(row.id) ?? [],
    }));
  }

  private mapFragment(row: FragmentRow): Fragment {
    const rawType = row.type as string;
    const type: FragmentType = rawType === 'image' ? 'text' : (rawType as FragmentType);
    return {
      id: row.id,
      userId: row.userId,
      type,
      content: row.content ?? null,
      rawUrl: row.rawUrl ?? null,
      title: row.title ?? null,
      summary: row.summary ?? null,
      cover: row.cover ?? null,
      audioUrl: row.audioUrl ?? null,
      images: (row.images as any) ?? [],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private mapGoal(row: GoalRow): Goal {
    return {
      id: row.id,
      userId: row.userId,
      parentId: row.parentId ?? null,
      pillar: (row.pillar as Goal['pillar']) ?? null,
      name: row.name,
      description: row.description ?? null,
      color: row.color ?? null,
      archived: row.archived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private extractMeta(html: string, name: string): string | null {
    // Match both property="og:xxx" and name="xxx" meta tags
    const patterns = [
      new RegExp(
        `<meta[^>]+(?:property|name)=["']${this.escapeRegex(
          name,
        )}["'][^>]*content=["']([^"']*)["']`,
        'i',
      ),
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${this.escapeRegex(
          name,
        )}["']`,
        'i',
      ),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return this.decodeHtmlEntities(match[1].trim());
      }
    }
    return null;
  }

  private extractTitle(html: string): string | null {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (match && match[1]) {
      return this.decodeHtmlEntities(match[1].trim());
    }
    return null;
  }

  private decodeHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
