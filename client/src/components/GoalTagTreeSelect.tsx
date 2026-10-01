import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Goal, PillarKey } from '@shared/api.interface';
import { goalsApi } from '@/api';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { UnauthorizedError } from '@client/src/api';
import { toast } from 'sonner';
import CreateTagModal from './CreateTagModal';

const PILLAR_INFO: Record<string, { name: string; color: string }> = {
  cognition: { name: '认知', color: '#2f66c9' },
  meaning: { name: '意义', color: '#9a7b12' },
  energy: { name: '能量', color: '#1f8a4c' },
  relation: { name: '关系', color: '#d94a3d' },
  value: { name: '价值', color: '#1f3a8a' },
};

function collectAllIds(goal: Goal): string[] {
  const ids: string[] = [goal.id];
  if (goal.children && goal.children.length > 0) {
    for (const child of goal.children) {
      ids.push(...collectAllIds(child));
    }
  }
  return ids;
}

export function collectAllIdsFlat(goalList: Goal[]): string[] {
  const ids: string[] = [];
  const walk = (list: Goal[]) => {
    for (const g of list) {
      ids.push(g.id);
      if (g.children && g.children.length > 0) walk(g.children);
    }
  };
  walk(goalList);
  return ids;
}

export function insertGoalIntoTree(
  tree: Goal[],
  parentId: string | null,
  newGoal: Goal,
): Goal[] {
  if (!parentId) {
    const pillar = newGoal.pillar;
    if (!pillar) return [...tree, newGoal];
    const otherGoals = tree.filter((g) => g.pillar !== pillar);
    const pillarGoals = tree.filter((g) => g.pillar === pillar);
    return [...otherGoals, ...pillarGoals, newGoal];
  }
  const insert = (list: Goal[]): Goal[] => {
    return list.map((g) => {
      if (g.id === parentId) {
        return { ...g, children: [...(g.children || []), newGoal] };
      }
      if (g.children && g.children.length > 0) {
        return { ...g, children: insert(g.children) };
      }
      return g;
    });
  };
  return insert(tree);
}

function formatError(err: unknown): string {
  if (err instanceof UnauthorizedError) {
    return '创建失败(401)：请重新登录';
  }
  const code = (err as { statusCode?: number })?.statusCode || 0;
  return code ? `创建失败(${code})，请重试` : '创建失败，请重试';
}

interface GoalTreeNodeProps {
  goal: Goal;
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSubTagCreated: (parentId: string, goal: Goal) => void;
  pillar: PillarKey;
  level?: number;
}

export function GoalTreeNode({
  goal,
  selectedIds,
  onToggle,
  onSubTagCreated,
  pillar,
  level = 0,
}: GoalTreeNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChildren = goal.children && goal.children.length > 0;
  const allChildIds = collectAllIds(goal);
  const allSelected =
    allChildIds.length > 0 &&
    allChildIds.every((id) => selectedIds.includes(id));
  const partialSelected =
    allChildIds.length > 0 &&
    !allSelected &&
    allChildIds.some((id) => selectedIds.includes(id));

  const handleCheck = () => {
    const ids = allChildIds;
    const allChecked = ids.every((id) => selectedIds.includes(id));
    if (allChecked) {
      ids.forEach((id) => onToggle(id));
    } else {
      ids.forEach((id) => {
        if (!selectedIds.includes(id)) onToggle(id);
      });
    }
  };

  const handleCreate = async (name: string) => {
    setError(null);
    setCreating(true);
    try {
      const newGoal = await goalsApi.createGoal({
        name,
        pillar,
        parentId: goal.id,
      });
      onSubTagCreated(goal.id, newGoal);
      setExpanded(true);
      toast.success('标签已创建');
    } catch (err) {
      logger.warn('创建子标签失败', err);
      const msg = formatError(err);
      setError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  const pillarColor = PILLAR_INFO[pillar]?.color || '#9a9a95';

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 touch-manipulation"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-text-secondary touch-manipulation"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <div className="w-5" />
        )}
        <Checkbox
          checked={allSelected}
          className={`data-[state=indeterminate]:bg-primary`}
          onCheckedChange={handleCheck}
        />
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            backgroundColor:
              partialSelected || allSelected ? pillarColor : '#d4d4d0',
          }}
        />
        <button
          type="button"
          className="flex-1 text-left text-sm text-text-primary truncate hover:text-text-secondary touch-manipulation"
          onClick={handleCheck}
        >
          {goal.name}
        </button>
        <button
          type="button"
          className="w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-text-secondary touch-manipulation"
          onClick={() => setModalOpen(true)}
          aria-label="添加子标签"
        >
          <Plus size={14} />
        </button>
      </div>
      {hasChildren && expanded && (
        <div>
          {goal.children?.map((child: Goal) => (
            <GoalTreeNode
              key={child.id}
              goal={child}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onSubTagCreated={onSubTagCreated}
              pillar={pillar}
              level={level + 1}
            />
          ))}
        </div>
      )}
      <CreateTagModal
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setError(null);
        }}
        title="新建子标签"
        placeholder="请输入子标签名称"
        loading={creating}
        error={error}
        onCreate={handleCreate}
      />
    </div>
  );
}

export interface GoalTagTreeSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function GoalTagTreeSelect({
  selectedIds,
  onChange,
}: GoalTagTreeSelectProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPillars, setExpandedPillars] = useState<Set<string>>(
    new Set(['cognition', 'meaning', 'energy', 'relation', 'value']),
  );
  const [modalPillar, setModalPillar] = useState<PillarKey | null>(null);
  const [creatingTag, setCreatingTag] = useState(false);
  const [pillarTagError, setPillarTagError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await goalsApi.getGoals();
        if (!cancelled) setGoals(data);
      } catch (err) {
        logger.warn('加载目标列表失败', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const goalsByPillar = useMemo(() => {
    return goals.reduce<Record<string, Goal[]>>((acc, goal) => {
      if (!goal.pillar) return acc;
      if (!acc[goal.pillar]) acc[goal.pillar] = [];
      acc[goal.pillar].push(goal);
      return acc;
    }, {});
  }, [goals]);

  const toggleTag = (goalId: string) => {
    if (selectedIds.includes(goalId)) {
      onChange(selectedIds.filter((id) => id !== goalId));
    } else {
      onChange([...selectedIds, goalId]);
    }
  };

  const togglePillarExpand = (pillar: string) => {
    setExpandedPillars((prev) => {
      const next = new Set(prev);
      if (next.has(pillar)) next.delete(pillar);
      else next.add(pillar);
      return next;
    });
  };

  const isPillarAllSelected = (pillarKey: PillarKey): boolean => {
    const pillarGoals = goalsByPillar[pillarKey] || [];
    const ids = collectAllIdsFlat(pillarGoals);
    if (ids.length === 0) return false;
    return ids.every((id) => selectedIds.includes(id));
  };

  const togglePillarAll = (pillarKey: PillarKey, checked: boolean) => {
    const pillarGoals = goalsByPillar[pillarKey] || [];
    const ids = collectAllIdsFlat(pillarGoals);
    const set = new Set(selectedIds);
    if (checked) {
      ids.forEach((id) => set.add(id));
    } else {
      ids.forEach((id) => set.delete(id));
    }
    onChange(Array.from(set));
  };

  const handleCreatePillarTag = async (name: string) => {
    if (!modalPillar) return;
    setPillarTagError(null);
    setCreatingTag(true);
    try {
      const newGoal = await goalsApi.createGoal({ name, pillar: modalPillar });
      setGoals((prev) => {
        const pillarGoals = prev.filter((g) => g.pillar === modalPillar);
        const otherGoals = prev.filter((g) => g.pillar !== modalPillar);
        return [...otherGoals, ...pillarGoals, newGoal];
      });
      onChange([...selectedIds, newGoal.id]);
      toast.success('标签已创建');
    } catch (err) {
      logger.warn('创建标签失败', err);
      const msg = formatError(err);
      setPillarTagError(msg);
      toast.error(msg);
      throw err;
    } finally {
      setCreatingTag(false);
    }
  };

  const handleSubTagCreated = (parentId: string, newGoal: Goal) => {
    setGoals((prev) => insertGoalIntoTree(prev, parentId, newGoal));
    onChange([...selectedIds, newGoal.id]);
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 size={20} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  const pillarName = modalPillar ? PILLAR_INFO[modalPillar]?.name : '';

  return (
    <div className="space-y-2">
      {(['cognition', 'meaning', 'energy', 'relation', 'value'] as PillarKey[]).map(
        (pillarKey) => {
          const pillarInfo = PILLAR_INFO[pillarKey];
          const pillarGoals = goalsByPillar[pillarKey] || [];
          const isExpanded = expandedPillars.has(pillarKey);
          const allSelected = isPillarAllSelected(pillarKey);

          return (
            <Collapsible
              key={pillarKey}
              open={isExpanded}
              onOpenChange={() => togglePillarExpand(pillarKey)}
            >
              <div className="flex items-center gap-2 py-2 touch-manipulation">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="w-5 h-5 flex items-center justify-center text-text-tertiary touch-manipulation"
                    aria-label="展开/收起"
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>
                </CollapsibleTrigger>
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(checked) =>
                    togglePillarAll(pillarKey, !!checked)
                  }
                />
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: pillarInfo?.color || '#9a9a95' }}
                />
                <span className="text-sm font-medium text-text-primary flex-1">
                  {pillarInfo?.name || pillarKey}
                </span>
                <span className="text-xs text-text-tertiary font-mono tabular-nums">
                  {pillarGoals.length}
                </span>
                <button
                  type="button"
                  className="w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-text-secondary rounded-md hover:bg-surface-muted touch-manipulation"
                  onClick={() => setModalPillar(pillarKey)}
                  aria-label="添加标签"
                >
                  <Plus size={14} />
                </button>
              </div>
              <CollapsibleContent>
                <div className="pl-7">
                  {pillarGoals.length === 0 && (
                    <div className="py-3 text-xs text-text-tertiary">
                      暂无标签
                    </div>
                  )}
                  {pillarGoals.map((goal) => (
                    <GoalTreeNode
                      key={goal.id}
                      goal={goal}
                      selectedIds={selectedIds}
                      onToggle={toggleTag}
                      onSubTagCreated={handleSubTagCreated}
                      pillar={pillarKey}
                    />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        },
      )}
      <CreateTagModal
        open={modalPillar !== null}
        onOpenChange={(open) => {
          if (!open) {
            setModalPillar(null);
            setPillarTagError(null);
          }
        }}
        title={`新建${pillarName || ''}标签`}
        placeholder="请输入标签名称"
        loading={creatingTag}
        error={pillarTagError}
        onCreate={handleCreatePillarTag}
      />
    </div>
  );
}
