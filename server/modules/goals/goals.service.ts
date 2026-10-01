import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, and, desc, isNull, inArray, sql } from 'drizzle-orm';
import { goals, fragmentTagLinks } from '@server/database/schema';
import type { Goal, PillarKey } from '@shared/api.interface';
import { PILLARS, PILLAR_COLOR_MAP } from './pillars.constants';
import type { CreateGoalDto } from './dto/create-goal.dto';
import type { UpdateGoalDto } from './dto/update-goal.dto';

type GoalRow = typeof goals.$inferSelect;

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase) {}

  getPillars() {
    return PILLARS;
  }

  private mapToGoal(row: GoalRow): Goal {
    return {
      id: row.id,
      userId: row.userId,
      parentId: row.parentId ?? null,
      pillar: (row.pillar as PillarKey) ?? null,
      name: row.name,
      description: row.description ?? null,
      color: row.color ?? null,
      archived: row.archived,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private buildTree(flatGoals: Goal[]): Goal[] {
    const byParent = new Map<string | null, Goal[]>();
    for (const g of flatGoals) {
      const key: string | null = g.parentId ?? null;
      byParent.set(key, [...(byParent.get(key) ?? []), g]);
    }

    const fillChildren = (nodes: Goal[]): Goal[] => {
      return nodes.map((node: Goal) => {
        const children = byParent.get(node.id) ?? [];
        return { ...node, children: fillChildren(children) };
      });
    };

    return fillChildren(byParent.get(null) ?? []);
  }

  async list(userId: string): Promise<Goal[]> {
    const rows: GoalRow[] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.archived, false)))
      .orderBy(
        sql`CASE ${goals.pillar}
          WHEN 'cognition' THEN 1
          WHEN 'meaning' THEN 2
          WHEN 'energy' THEN 3
          WHEN 'relation' THEN 4
          WHEN 'value' THEN 5
          ELSE 6
        END`,
        desc(goals.createdAt),
      );

    const flatGoals: Goal[] = rows.map((row: GoalRow) => this.mapToGoal(row));

    // Attach fragment counts
    const goalIds: string[] = flatGoals.map((g: Goal) => g.id);
    if (goalIds.length > 0) {
      const counts = await this.db
        .select({
          goalId: fragmentTagLinks.goalId,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(fragmentTagLinks)
        .where(inArray(fragmentTagLinks.goalId, goalIds))
        .groupBy(fragmentTagLinks.goalId);

      const countMap = new Map<string, number>();
      for (const c of counts) {
        countMap.set(c.goalId, Number(c.count));
      }
      for (const g of flatGoals) {
        g.fragmentCount = countMap.get(g.id) ?? 0;
      }
    }

    return this.buildTree(flatGoals);
  }

  async getById(userId: string, id: string): Promise<Goal> {
    const rows: GoalRow[] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));

    if (rows.length === 0) {
      throw new NotFoundException('目标不存在');
    }

    return this.mapToGoal(rows[0]);
  }

  async create(userId: string, dto: CreateGoalDto): Promise<Goal> {
    // Validate parent if provided
    if (dto.parentId) {
      const parentRows: GoalRow[] = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, dto.parentId), eq(goals.userId, userId)));
      if (parentRows.length === 0) {
        throw new BadRequestException('父目标不存在');
      }
    }

    const color = dto.color ?? (dto.pillar ? PILLAR_COLOR_MAP[dto.pillar] : null);

    const inserted: GoalRow[] = await this.db
      .insert(goals)
      .values({
        userId,
        parentId: dto.parentId ?? null,
        pillar: dto.pillar ?? null,
        name: dto.name,
        description: dto.description ?? null,
        color,
        archived: false,
      })
      .returning();

    return this.mapToGoal(inserted[0]);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto): Promise<Goal> {
    // Verify ownership
    const existing: GoalRow[] = await this.db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));
    if (existing.length === 0) {
      throw new NotFoundException('目标不存在');
    }

    // Validate parent if changing
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new BadRequestException('父目标不能是自身');
      }
      const parentRows: GoalRow[] = await this.db
        .select()
        .from(goals)
        .where(and(eq(goals.id, dto.parentId), eq(goals.userId, userId)));
      if (parentRows.length === 0) {
        throw new BadRequestException('父目标不存在');
      }
    }

    const patch: Partial<typeof goals.$inferInsert> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.color !== undefined) patch.color = dto.color;
    if (dto.parentId !== undefined) patch.parentId = dto.parentId ?? null;
    if (dto.pillar !== undefined) patch.pillar = dto.pillar ?? null;
    if (dto.archived !== undefined) patch.archived = dto.archived;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('未提供可更新字段');
    }

    const updated: GoalRow[] = await this.db
      .update(goals)
      .set(patch)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning();

    return this.mapToGoal(updated[0]);
  }

  async remove(userId: string, id: string): Promise<void> {
    const deleted: { id: string }[] = await this.db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning({ id: goals.id });

    if (deleted.length === 0) {
      throw new NotFoundException('目标不存在');
    }
  }

  async merge(userId: string, sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) {
      throw new BadRequestException('源标签与目标标签不能相同');
    }

    // Verify both belong to user
    const both: GoalRow[] = await this.db
      .select()
      .from(goals)
      .where(
        and(
          inArray(goals.id, [sourceId, targetId]),
          eq(goals.userId, userId),
        ),
      );

    if (both.length < 2) {
      throw new NotFoundException('标签不存在');
    }

    // Move fragment-tag links from source to target
    // Use raw upsert-like approach: insert links for target where not exists, then delete source
    // First, get existing source links
    const sourceLinks = await this.db
      .select({ fragmentId: fragmentTagLinks.fragmentId })
      .from(fragmentTagLinks)
      .where(eq(fragmentTagLinks.goalId, sourceId));

    if (sourceLinks.length > 0) {
      const fragmentIds: string[] = sourceLinks.map((l: { fragmentId: string }) => l.fragmentId);

      // Check which target links already exist to avoid PK violation
      const existingTargetLinks = await this.db
        .select({ fragmentId: fragmentTagLinks.fragmentId })
        .from(fragmentTagLinks)
        .where(
          and(
            eq(fragmentTagLinks.goalId, targetId),
            inArray(fragmentTagLinks.fragmentId, fragmentIds),
          ),
        );

      const existingSet = new Set(
        existingTargetLinks.map((l: { fragmentId: string }) => l.fragmentId),
      );

      const newLinks = fragmentIds
        .filter((fid: string) => !existingSet.has(fid))
        .map((fid: string) => ({
          fragmentId: fid,
          goalId: targetId,
        }));

      if (newLinks.length > 0) {
        await this.db.insert(fragmentTagLinks).values(newLinks);
      }

      // Delete source links
      await this.db
        .delete(fragmentTagLinks)
        .where(eq(fragmentTagLinks.goalId, sourceId));
    }

    // Archive source
    await this.db
      .update(goals)
      .set({ archived: true })
      .where(and(eq(goals.id, sourceId), eq(goals.userId, userId)));
  }
}
