import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

interface TikHubVideoData {
  title: string | null;
  summary: string | null;
  cover: string | null;
  author: string | null;
}

interface CacheEntry {
  data: TikHubVideoData;
  expireAt: number;
}

const TIKHUB_BASE = 'https://api.tikhub.io';
const TIKHUB_API_KEY = process.env.TIKHUB_API_KEY || '';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TikHubService {
  private readonly logger = new Logger(TikHubService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private callCount = 0;

  constructor(private readonly httpService: HttpService) {}

  isDouyinUrl(url: string): boolean {
    return /(^|\.)(douyin\.com|iesdouyin\.com)\/?/i.test(url);
  }

  async fetchDouyinVideo(shareUrl: string): Promise<TikHubVideoData | null> {
    const cacheKey = this.normalizeUrl(shareUrl);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expireAt) {
      this.logger.log(`TikHub cache hit: ${cacheKey.slice(0, 60)}`);
      return cached.data;
    }

    try {
      this.callCount += 1;
      this.logger.log(
        `TikHub API call #${this.callCount}: ${shareUrl.slice(0, 80)}`,
      );

      const url = `${TIKHUB_BASE}/api/v1/douyin/app/v3/fetch_one_video_by_share_url`;
      const response = await firstValueFrom(
        this.httpService.get(url, {
          params: { share_url: shareUrl },
          headers: {
            Authorization: `Bearer ${TIKHUB_API_KEY}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        }),
      );

      const payload = response.data as {
        code?: number;
        data?: {
          aweme_detail?: {
            aweme_id?: string;
            group_id?: string;
            desc?: string;
            author?: { nickname?: string; avatar_large?: unknown };
            video?: {
              cover?: { url_list?: string[] };
              origin_cover?: { url_list?: string[] };
              dynamic_cover?: { url_list?: string[] };
            };
          };
        };
        message?: string;
      };

      if (payload.code !== 200) {
        this.logger.warn(
          `TikHub 返回错误 code=${payload.code} msg=${payload.message ?? ''}`,
        );
        return null;
      }

      const detail = payload.data?.aweme_detail;
      if (!detail) {
        this.logger.warn('TikHub 返回数据为空');
        return null;
      }

      const desc = detail.desc?.trim() ?? '';
      const video = detail.video ?? {};
      const coverList =
        video.cover?.url_list ?? video.origin_cover?.url_list ?? [];
      const cover = coverList[0] ?? null;
      const author = detail.author?.nickname ?? null;

      const title = desc.length > 40 ? desc.slice(0, 40) + '...' : desc;
      const result: TikHubVideoData = {
        title: title || null,
        summary: desc || null,
        cover,
        author,
      };

      this.cache.set(cacheKey, {
        data: result,
        expireAt: Date.now() + CACHE_TTL_MS,
      });

      const awemeId = detail.aweme_id || detail.group_id;
      if (awemeId) {
        this.cache.set(`aweme:${awemeId}`, {
          data: result,
          expireAt: Date.now() + CACHE_TTL_MS,
        });
      }

      return result;
    } catch (error) {
      const err = error as { message?: string; code?: string; response?: { status?: number } };
      const status = err.response?.status;
      const errMsg = status
        ? `HTTP ${status}`
        : err.code ?? err.message ?? 'unknown error';
      this.logger.warn(`TikHub 抓取失败: ${errMsg}`);
      return null;
    }
  }

  getCallCount(): number {
    return this.callCount;
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      const path = u.pathname.replace(/\/+$/, '');
      return `${u.hostname}${path}`;
    } catch {
      return url;
    }
  }
}
