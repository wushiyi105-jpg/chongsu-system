import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { goals, fragments, fragmentTagLinks } from '@server/database/schema';
import type {
  ExportRequest,
  ExportResponse,
  ExportScope,
  ExportFormat,
  PillarKey,
  Goal,
  Fragment,
} from '@shared/api.interface';

const PILLAR_NAMES: Record<PillarKey, string> = {
  cognition: '认知',
  meaning: '意义',
  energy: '能量',
  relation: '关系',
  value: '价值',
};

function mapGoal(row: typeof goals.$inferSelect): Goal {
  return {
    id: row.id,
    userId: row.userId,
    parentId: row.parentId ?? null,
    pillar: row.pillar as PillarKey | null,
    name: row.name,
    description: row.description ?? null,
    color: row.color ?? null,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapFragment(row: typeof fragments.$inferSelect): Fragment {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as Fragment['type'],
    content: row.content ?? '',
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

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

interface ExportData {
  goals: Goal[];
  fragments: Fragment[];
  tagMap: Map<string, Goal>;
  fragmentsByGoal: Map<string, Fragment[]>;
}

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async exportData(userId: string, req: ExportRequest): Promise<ExportResponse> {
    const { scope, format } = req;

    // 校验参数
    if (scope === 'tag' && !req.tagId) {
      throw new BadRequestException('tag 范围导出必须提供 tagId');
    }
    if (scope === 'pillar' && !req.pillar) {
      throw new BadRequestException('pillar 范围导出必须提供 pillar');
    }

    const data = await this.fetchExportData(userId, scope, req);

    let content: string;
    let contentType: string;
    let ext: string;

    switch (format) {
      case 'markdown':
        content = this.generateMarkdown(data, scope, req);
        contentType = 'text/markdown; charset=utf-8';
        ext = 'md';
        break;
      case 'json':
        content = this.generateJson(data);
        contentType = 'application/json; charset=utf-8';
        ext = 'json';
        break;
      case 'text':
        content = this.generateText(data, scope, req);
        contentType = 'text/plain; charset=utf-8';
        ext = 'txt';
        break;
      default:
        throw new BadRequestException('不支持的导出格式');
    }

    const dateStr = formatDate(new Date());
    const filename = `chongsu-export-${scope}-${dateStr}.${ext}`;

    return { filename, content, contentType };
  }

  private async fetchExportData(
    userId: string,
    scope: ExportScope,
    req: ExportRequest,
  ): Promise<ExportData> {
    let targetGoalIds: string[] = [];
    let allGoals: Goal[] = [];

    if (scope === 'tag') {
      // 校验 tag 所属
      const tagRows = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, req.tagId!), eq(goals.userId, userId)));
      if (tagRows.length === 0) {
        throw new NotFoundException('标签不存在');
      }
      // 递归找子目标
      const childIds = await this.getAllDescendantIds(userId, req.tagId!);
      targetGoalIds = [req.tagId!, ...childIds];

      const allGoalRows = await this.db
        .select()
        .from(goals)
        .where(inArray(goals.id, targetGoalIds));
      allGoals = allGoalRows.map(mapGoal);
    } else if (scope === 'pillar') {
      const pillarGoalRows = await this.db
        .select()
        .from(goals)
        .where(
          and(eq(goals.userId, userId), eq(goals.pillar, req.pillar!), eq(goals.archived, false)),
        );
      allGoals = pillarGoalRows.map(mapGoal);
      targetGoalIds = allGoals.map((g: Goal) => g.id);
    } else {
      // all
      const allGoalRows = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.userId, userId), eq(goals.archived, false)));
      allGoals = allGoalRows.map(mapGoal);
      targetGoalIds = allGoals.map((g: Goal) => g.id);
    }

    // 查询关联碎片（通过 tag links）
    let fragmentRows: (typeof fragments.$inferSelect)[] = [];
    if (targetGoalIds.length > 0) {
      const linkRows = await this.db
        .select({ fragmentId: fragmentTagLinks.fragmentId })
        .from(fragmentTagLinks)
        .where(inArray(fragmentTagLinks.goalId, targetGoalIds));
      const fragmentIds = [...new Set(linkRows.map((l: { fragmentId: string }) => l.fragmentId))];

      if (fragmentIds.length > 0) {
        fragmentRows = await this.db
          .select()
          .from(fragments)
          .where(and(eq(fragments.userId, userId), inArray(fragments.id, fragmentIds)))
          .orderBy(desc(fragments.createdAt));
      }
    }

    const allFragments: Fragment[] = fragmentRows.map(mapFragment);

    // 构建 tagMap
    const tagMap = new Map<string, Goal>();
    for (const g of allGoals) {
      tagMap.set(g.id, g);
    }

    // 构建碎片按目标分组
    const fragmentsByGoal = new Map<string, Fragment[]>();
    if (allFragments.length > 0) {
      const allFragIds = allFragments.map((f: Fragment) => f.id);
      const allLinks = await this.db
        .select({
          fragmentId: fragmentTagLinks.fragmentId,
          goalId: fragmentTagLinks.goalId,
        })
        .from(fragmentTagLinks)
        .where(inArray(fragmentTagLinks.fragmentId, allFragIds));

      // 同时为碎片填充 tagIds
      const fragTagMap = new Map<string, string[]>();
      for (const link of allLinks) {
        const arr = fragTagMap.get(link.fragmentId) ?? [];
        arr.push(link.goalId);
        fragTagMap.set(link.fragmentId, arr);

        if (targetGoalIds.includes(link.goalId)) {
          const farr = fragmentsByGoal.get(link.goalId) ?? [];
          farr.push(allFragments.find((f: Fragment) => f.id === link.fragmentId)!);
          fragmentsByGoal.set(link.goalId, farr);
        }
      }

      for (const frag of allFragments) {
        frag.tagIds = fragTagMap.get(frag.id) ?? [];
      }
    }

    return { goals: allGoals, fragments: allFragments, tagMap, fragmentsByGoal };
  }

  private async getAllDescendantIds(userId: string, parentId: string): Promise<string[]> {
    const result: string[] = [];
    let currentLevel: string[] = [parentId];

    while (currentLevel.length > 0) {
      const childRows = await this.db
        .select({ id: goals.id })
        .from(goals)
        .where(and(eq(goals.userId, userId), inArray(goals.parentId, currentLevel)));

      const childIds = childRows.map((r: { id: string }) => r.id);
      if (childIds.length === 0) break;
      result.push(...childIds);
      currentLevel = childIds;
    }

    return result;
  }

  private generateMarkdown(data: ExportData, scope: ExportScope, req: ExportRequest): string {
    const lines: string[] = [];
    const now = new Date().toISOString().slice(0, 10);

    let title = '重塑系统 · 知识导出';
    if (scope === 'tag' && data.goals.length > 0) {
      const rootGoal = data.goals.find((g: Goal) => g.id === req.tagId);
      if (rootGoal) title = `重塑系统 · 标签导出 - ${rootGoal.name}`;
    } else if (scope === 'pillar') {
      title = `重塑系统 · 支柱导出 - ${PILLAR_NAMES[req.pillar!]}`;
    }
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`> 导出时间：${now}`);
    lines.push(`> 目标数：${data.goals.length}`);
    lines.push(`> 碎片数：${data.fragments.length}`);
    lines.push('');

    // 按支柱 / 目标分组
    const pillars: PillarKey[] = ['cognition', 'meaning', 'energy', 'relation', 'value'];

    if (scope === 'pillar') {
      // 单支柱
      const pillar = req.pillar!;
      lines.push(`## ${PILLAR_NAMES[pillar]} 支柱`);
      lines.push('');

      const pillarGoals = data.goals.filter(
        (g: Goal) => g.pillar === pillar && !g.parentId,
      );
      for (const goal of pillarGoals) {
        this.appendGoalMarkdown(lines, goal, data, '###');
      }
    } else if (scope === 'tag') {
      const rootGoal = data.goals.find((g: Goal) => g.id === req.tagId);
      if (rootGoal) {
        lines.push(`## ${rootGoal.name}`);
        lines.push('');
        if (rootGoal.description) {
          lines.push(`> ${rootGoal.description}`);
          lines.push('');
        }
        const goalFragments = data.fragmentsByGoal.get(rootGoal.id) ?? [];
        this.appendFragmentsMarkdown(lines, goalFragments, data);

        // 子目标
        const children = data.goals.filter((g: Goal) => g.parentId === rootGoal.id);
        for (const child of children) {
          this.appendGoalMarkdown(lines, child, data, '###');
        }
      }
    } else {
      // all
      for (const pillar of pillars) {
        const pillarGoals = data.goals.filter(
          (g: Goal) => g.pillar === pillar && !g.parentId,
        );
        if (pillarGoals.length === 0) continue;

        lines.push(`## ${PILLAR_NAMES[pillar]} 支柱`);
        lines.push('');

        for (const goal of pillarGoals) {
          this.appendGoalMarkdown(lines, goal, data, '###');
        }
      }

      // 无支柱的目标
      const noPillarGoals = data.goals.filter((g: Goal) => !g.pillar && !g.parentId);
      if (noPillarGoals.length > 0) {
        lines.push('## 其他');
        lines.push('');
        for (const goal of noPillarGoals) {
          this.appendGoalMarkdown(lines, goal, data, '###');
        }
      }
    }

    return lines.join('\n');
  }

  private appendGoalMarkdown(
    lines: string[],
    goal: Goal,
    data: ExportData,
    level: string,
  ): void {
    lines.push(`${level} ${goal.name}`);
    lines.push('');
    if (goal.description) {
      lines.push(`> ${goal.description}`);
      lines.push('');
    }

    const goalFragments = data.fragmentsByGoal.get(goal.id) ?? [];
    // 按时间倒序
    goalFragments.sort(
      (a: Fragment, b: Fragment) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    this.appendFragmentsMarkdown(lines, goalFragments, data);

    // 子目标
    const children = data.goals.filter((g: Goal) => g.parentId === goal.id);
    const subLevel = level + '#';
    for (const child of children) {
      this.appendGoalMarkdown(lines, child, data, subLevel);
    }
  }

  private appendFragmentsMarkdown(
    lines: string[],
    frags: Fragment[],
    _data: ExportData,
  ): void {
    if (frags.length === 0) {
      lines.push('_暂无碎片_');
      lines.push('');
      return;
    }

    for (const frag of frags) {
      const dateStr = frag.createdAt.slice(0, 10);
      const titleText = frag.title || frag.content.slice(0, 30) || '无标题';
      lines.push(`- **${titleText}** · ${dateStr}`);
      if (frag.content) {
        lines.push(`  ${frag.content.replace(/\n/g, '\n  ')}`);
      }
      if (frag.rawUrl) {
        lines.push(`  🔗 ${frag.rawUrl}`);
      }
    }
    lines.push('');
  }

  private generateJson(data: ExportData): string {
    const payload = {
      goals: data.goals,
      fragments: data.fragments.map((f: Fragment) => ({
        ...f,
        tagIds: f.tagIds ?? [],
      })),
    };
    return JSON.stringify(payload, null, 2);
  }

  private generateText(data: ExportData, scope: ExportScope, req: ExportRequest): string {
    const lines: string[] = [];
    const now = new Date().toISOString().slice(0, 10);

    let title = '重塑系统 · 知识导出';
    if (scope === 'tag' && data.goals.length > 0) {
      const rootGoal = data.goals.find((g: Goal) => g.id === req.tagId);
      if (rootGoal) title = `重塑系统 · 标签导出 - ${rootGoal.name}`;
    } else if (scope === 'pillar') {
      title = `重塑系统 · 支柱导出 - ${PILLAR_NAMES[req.pillar!]}`;
    }
    lines.push(title);
    lines.push('='.repeat(title.length));
    lines.push('');
    lines.push(`导出时间：${now}`);
    lines.push(`目标数：${data.goals.length}`);
    lines.push(`碎片数：${data.fragments.length}`);
    lines.push('');
    lines.push('─'.repeat(40));
    lines.push('');

    // 按目标分组列出碎片内容
    for (const goal of data.goals) {
      const goalFragments = data.fragmentsByGoal.get(goal.id) ?? [];

      lines.push(`【${goal.name}】`);
      if (goal.description) {
        lines.push(goal.description);
      }
      lines.push('');

      goalFragments.sort(
        (a: Fragment, b: Fragment) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      for (const frag of goalFragments) {
        const dateStr = frag.createdAt.slice(0, 10);
        lines.push(`── ${dateStr} ──`);
        if (frag.title) lines.push(frag.title);
        if (frag.content) lines.push(frag.content);
        if (frag.rawUrl) lines.push(`链接: ${frag.rawUrl}`);
        lines.push('');
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
