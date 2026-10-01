import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, inArray, sql } from 'drizzle-orm';
import { goals, fragments, fragmentTagLinks } from '@server/database/schema';
import type { FragmentType } from '@shared/api.interface';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphNodeFragment,
  DashboardData,
  PillarKey,
  Fragment,
  Goal,
} from '@shared/api.interface';

const PILLAR_COLORS: Record<PillarKey, string> = {
  cognition: '#2f66c9',
  meaning: '#e8a23a',
  energy: '#34a853',
  relation: '#1f8a4c',
  value: '#0a0a0a',
};

const PILLAR_NAMES: Record<PillarKey, string> = {
  cognition: '认知',
  meaning: '意义',
  energy: '能量',
  relation: '关系',
  value: '价值',
};

const PILLAR_KEYS: PillarKey[] = ['cognition', 'meaning', 'energy', 'relation', 'value'];

function goalToNode(
  goal: typeof goals.$inferSelect,
  fragmentCount: number,
  fragmentIds: string[],
  fragments: GraphNodeFragment[],
): GraphNode {
  const pillar = goal.pillar as PillarKey | null;
  const color = goal.color || (pillar ? PILLAR_COLORS[pillar] : '#34a853');
  const size = Math.min(20 + fragmentCount * 3, 60);
  return {
    id: goal.id,
    name: goal.name,
    pillar,
    color,
    size,
    fragmentCount,
    fragmentIds,
    fragments,
  };
}

function mapFragment(row: typeof fragments.$inferSelect): Fragment {
   const rawType = row.type as string;
   const type: FragmentType = rawType === 'image' ? 'text' : (rawType as FragmentType);
   let images: Array<{ url: string; width?: number; height?: number; size?: number }> = [];
   try {
     if (row.images && Array.isArray(row.images)) {
       images = row.images as Array<{ url: string; width?: number; height?: number; size?: number }>;
     }
   } catch {
     images = [];
   }
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
     images,
     createdAt: row.createdAt.toISOString(),
     updatedAt: row.updatedAt.toISOString(),
   };
 }

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

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  async getGraphData(userId: string): Promise<GraphData> {
    // 1. 查询用户所有未归档目标
    const userGoals: (typeof goals.$inferSelect)[] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.archived, false)));

    if (userGoals.length === 0) {
      return { nodes: [], edges: [] };
    }

    const goalIds: string[] = userGoals.map((g: typeof goals.$inferSelect) => g.id);

    // 2. 查询每个目标的碎片数（通过 fragmentTagLinks）
    const fragmentRows = await this.db
      .select({
        goalId: fragmentTagLinks.goalId,
        fragmentId: fragmentTagLinks.fragmentId,
      })
      .from(fragmentTagLinks)
      .innerJoin(fragments, eq(fragmentTagLinks.fragmentId, fragments.id))
      .where(and(eq(fragments.userId, userId), inArray(fragmentTagLinks.goalId, goalIds)));

    const countMap = new Map<string, number>();
    const fragmentsByGoal = new Map<string, string[]>();
    for (const row of fragmentRows) {
      countMap.set(row.goalId, (countMap.get(row.goalId) ?? 0) + 1);
      const arr = fragmentsByGoal.get(row.goalId) ?? [];
      arr.push(row.fragmentId);
      fragmentsByGoal.set(row.goalId, arr);
    }

    // 2.5 查询每个目标关联的碎片详情（用于节点详情面板）
    const allFragmentIds = new Set(fragmentRows.map((r) => r.fragmentId));
    const fragmentDetailMap = new Map<string, GraphNodeFragment>();
    if (allFragmentIds.size > 0) {
      const detailRows = await this.db
        .select({
          id: fragments.id,
          title: fragments.title,
          content: fragments.content,
          type: fragments.type,
          createdAt: fragments.createdAt,
        })
        .from(fragments)
        .where(inArray(fragments.id, [...allFragmentIds]));
      for (const row of detailRows) {
        fragmentDetailMap.set(row.id, {
          id: row.id,
          title: row.title,
          content: row.content ?? '',
          type: row.type as FragmentType,
          createdAt: row.createdAt.toISOString(),
        });
      }
    }

    // 3. 构建节点
    const nodes: GraphNode[] = userGoals.map((g: typeof goals.$inferSelect) => {
      const ids = fragmentsByGoal.get(g.id) ?? [];
      const frags = ids
        .map((id) => fragmentDetailMap.get(id))
        .filter((f): f is GraphNodeFragment => f !== undefined);
      return goalToNode(g, countMap.get(g.id) || 0, ids, frags);
    });

    // 4. 构建边：找出所有关联 >=2 个标签的碎片，做两两组合
    // 先查所有用户碎片的标签关联
    const allLinks = await this.db
      .select({
        fragmentId: fragmentTagLinks.fragmentId,
        goalId: fragmentTagLinks.goalId,
      })
      .from(fragmentTagLinks)
      .innerJoin(fragments, eq(fragmentTagLinks.fragmentId, fragments.id))
      .where(eq(fragments.userId, userId));

    // 按 fragmentId 分组
    const tagsByFragment = new Map<string, string[]>();
    for (const link of allLinks) {
      const arr = tagsByFragment.get(link.fragmentId) ?? [];
      arr.push(link.goalId);
      tagsByFragment.set(link.fragmentId, arr);
    }

    // 只保留标签在用户目标集合中的（且 >=2 个）
    const edgeWeightMap = new Map<string, number>();
    const edgeFragmentMap = new Map<string, string>();

    for (const [fragmentId, tagIds] of tagsByFragment) {
      const validTagIds = tagIds.filter((id: string) => goalIds.includes(id));
      if (validTagIds.length < 2) continue;

      const sorted = [...validTagIds].sort();
      for (let i = 0; i < sorted.length; i += 1) {
        for (let j = i + 1; j < sorted.length; j += 1) {
          const key = `${sorted[i]}_${sorted[j]}`;
          edgeWeightMap.set(key, (edgeWeightMap.get(key) ?? 0) + 1);
          if (!edgeFragmentMap.has(key)) {
            edgeFragmentMap.set(key, fragmentId);
          }
        }
      }
    }

    const edges: GraphEdge[] = [];
    for (const [key, weight] of edgeWeightMap) {
      const [source, target] = key.split('_');
      edges.push({
        source,
        target,
        fragmentId: edgeFragmentMap.get(key) ?? '',
        weight,
      });
    }

    return { nodes, edges };
  }

  async getDashboard(userId: string): Promise<DashboardData> {
     const logger = new Logger('GraphService');

     let pillars: DashboardData['pillars'] = PILLAR_KEYS.map((key: PillarKey) => ({
       key,
       name: PILLAR_NAMES[key],
       color: PILLAR_COLORS[key],
       goalCount: 0,
       fragmentCount: 0,
     }));
     let totalGoals = 0;
     let totalFragments = 0;
     let recentFragments: Fragment[] = [];
     const STORAGE_QUOTA_BYTES = 1024 * 1024 * 1024;
     let storageUsedBytes = 0;

     // 1. 目标 & 支柱汇总
     try {
       const allGoalRows = await this.db
         .select()
         .from(goals)
         .where(and(eq(goals.userId, userId), eq(goals.archived, false)));

       const goalCountMap = new Map<string | null, number>();
       for (const g of allGoalRows) {
         const key = g.pillar ?? null;
         goalCountMap.set(key, (goalCountMap.get(key) ?? 0) + 1);
       }

       const allGoalIds = allGoalRows.map((g: typeof goals.$inferSelect) => g.id);
       const fragmentCountMap = new Map<string | null, number>();

       if (allGoalIds.length > 0) {
         const pillarFragRows = await this.db
           .select({
             pillar: goals.pillar,
             fragmentCount: sql<number>`count(distinct ${fragmentTagLinks.fragmentId})`,
           })
           .from(goals)
           .innerJoin(fragmentTagLinks, eq(fragmentTagLinks.goalId, goals.id))
           .where(inArray(goals.id, allGoalIds))
           .groupBy(goals.pillar);

         for (const row of pillarFragRows) {
           const key = row.pillar ?? null;
           fragmentCountMap.set(key, Number(row.fragmentCount) || 0);
         }
       }

       pillars = PILLAR_KEYS.map((key: PillarKey) => ({
         key,
         name: PILLAR_NAMES[key],
         color: PILLAR_COLORS[key],
         goalCount: goalCountMap.get(key) ?? 0,
         fragmentCount: fragmentCountMap.get(key) ?? 0,
       }));

       totalGoals = allGoalRows.length;
     } catch (err) {
       logger.error('dashboard pillars failed', err);
     }

     // 2. 总碎片数
     try {
       const totalFragmentsRow = await this.db
         .select({ count: sql<number>`count(*)` })
         .from(fragments)
         .where(eq(fragments.userId, userId));
       totalFragments = Number(totalFragmentsRow[0]?.count) || 0;
     } catch (err) {
       logger.error('dashboard totalFragments failed', err);
     }

     // 3. 图片存储用量
     try {
       const storageResult = await this.db.execute(sql<{ total_size: string }>`
         SELECT COALESCE(SUM((img->>'size')::bigint), 0) AS total_size
         FROM ${fragments},
         LATERAL jsonb_array_elements(${fragments.images}) AS img
         WHERE (${fragments.userId}).user_id = ${userId}
       `);
       if (storageResult.length > 0) {
         storageUsedBytes = Number(storageResult[0].total_size) || 0;
       }
     } catch (err) {
       logger.error('dashboard storage failed', err);
     }

     // 4. 最近 5 条碎片（含 tags）
     try {
       const recentFragmentRows = await this.db
         .select()
         .from(fragments)
         .where(eq(fragments.userId, userId))
         .orderBy(desc(fragments.createdAt))
         .limit(5);

       recentFragments = recentFragmentRows.map((r: typeof fragments.$inferSelect) =>
         mapFragment(r),
       );

       if (recentFragments.length > 0) {
         const recentIds = recentFragments.map((f: Fragment) => f.id);
         const tagLinks = await this.db
           .select({
             fragmentId: fragmentTagLinks.fragmentId,
             goalId: fragmentTagLinks.goalId,
           })
           .from(fragmentTagLinks)
           .where(inArray(fragmentTagLinks.fragmentId, recentIds));

         const tagIdMap = new Map<string, string[]>();
         for (const link of tagLinks) {
           const arr = tagIdMap.get(link.fragmentId) ?? [];
           arr.push(link.goalId);
           tagIdMap.set(link.fragmentId, arr);
         }

         const allTagIds: string[] = tagLinks.map((l: { goalId: string }) => l.goalId);
         const tagGoalMap = new Map<string, Goal>();
         if (allTagIds.length > 0) {
           const tagGoals = await this.db
             .select()
             .from(goals)
             .where(inArray(goals.id, allTagIds));
           for (const g of tagGoals) {
             tagGoalMap.set(g.id, mapGoal(g));
           }
         }

         for (const frag of recentFragments) {
           const ids = tagIdMap.get(frag.id) ?? [];
           frag.tagIds = ids;
           frag.tags = ids
             .map((id: string) => tagGoalMap.get(id))
             .filter((g): g is Goal => g !== undefined);
         }
       }
     } catch (err) {
       logger.error('dashboard recentFragments failed', err);
     }

     return {
       pillars,
       totalGoals,
       totalFragments,
       recentFragments,
       storageUsedBytes,
       storageQuotaBytes: STORAGE_QUOTA_BYTES,
     };
   }
}
