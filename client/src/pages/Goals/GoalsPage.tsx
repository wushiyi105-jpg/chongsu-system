import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  BookOpen,
  Compass,
  Zap,
  HeartHandshake,
  Sparkles,
  Plus,
  MoreHorizontal,
  ChevronRight,
  Pencil,
  Trash2,
  PlusCircle,
} from 'lucide-react';
import { goalsApi } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@client/src/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@client/src/components/ui/dropdown-menu';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type { Goal, PillarKey, CreateGoalRequest, UpdateGoalRequest } from '@shared/api.interface';

const PILLARS: Array<{ key: 'all' | PillarKey; name: string; color: string }> = [
  { key: 'all', name: '全部', color: '#0a0a0a' },
  { key: 'cognition', name: '认知', color: '#2f66c9' },
  { key: 'meaning', name: '意义', color: '#e8a23a' },
  { key: 'energy', name: '能量', color: '#34a853' },
  { key: 'relation', name: '关系', color: '#d94a3d' },
  { key: 'value', name: '价值', color: '#1f3a8a' },
];

const PILLAR_ICONS: Record<PillarKey, React.ComponentType<{ size?: number; color?: string }>> = {
  cognition: BookOpen,
  meaning: Compass,
  energy: Zap,
  relation: HeartHandshake,
  value: Sparkles,
};

type PillarFilter = 'all' | PillarKey;

interface GoalFormData {
  name: string;
  description: string;
  color: string;
}

function filterGoalsByPillar(goals: Goal[], pillar: PillarFilter): Goal[] {
  if (pillar === 'all') return goals;
  return goals.filter((g) => g.pillar === pillar);
}

function collectAllDescendants(goal: Goal): Goal[] {
  const result: Goal[] = [];
  const stack = goal.children ? [...goal.children] : [];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    if (current.children) {
      stack.push(...current.children);
    }
  }
  return result;
}

const TreeNode = ({
  goal,
  depth,
  expandedIds,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  pillarColor,
  index,
}: {
  goal: Goal;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onEdit: (goal: Goal) => void;
  onDelete: (goal: Goal) => void;
  onAddChild: (parent: Goal) => void;
  pillarColor: string;
  index: number;
}) => {
  const hasChildren = goal.children && goal.children.length > 0;
  const isExpanded = expandedIds.has(goal.id);
  const displayColor = goal.color || pillarColor;
  const isTopLevel = depth === 0;

  return (
    <div>
      <div
        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl group transition-colors duration-150 ${
          isTopLevel
            ? 'bg-surface-muted hover:bg-surface/60 mb-1.5 border border-border'
            : 'hover:bg-surface-muted'
        }`}
        style={{
          paddingLeft: `${depth * 20 + 12}px`,
          animationDelay: `${index * 40 + depth * 60}ms`,
          animation: 'fadeInUp 0.3s ease-out both',
        }}
      >
        {/* 层级展开箭头 */}
        <div className="flex items-center flex-shrink-0">
          {hasChildren ? (
            <button
              onClick={() => onToggle(goal.id)}
              className="w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-text-secondary transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-label={isExpanded ? '折叠' : '展开'}
            >
              <ChevronRight size={14} />
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center">
              {depth > 0 && (
                <div
                  className="w-3 h-px bg-border"
                  style={{ marginLeft: '-3px' }}
                />
              )}
            </div>
          )}
        </div>

        {/* 颜色圆点 */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: displayColor }}
        />

        {/* 名称 */}
        <span
          className={`flex-1 text-primary truncate cursor-pointer ${
            isTopLevel ? 'text-[13px] font-semibold' : 'text-[13px]'
          }`}
          onClick={() => hasChildren && onToggle(goal.id)}
        >
          {goal.name}
        </span>

        {/* 碎片数 */}
        <span className="text-[12px] text-text-secondary flex-shrink-0 num-tnum">
          {goal.fragmentCount ?? 0}
        </span>

        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-lg hover:bg-surface hover:text-primary"
            onClick={() => onAddChild(goal)}
            aria-label="添加子目标"
          >
            <Plus size={14} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-surface hover:text-primary"
                aria-label="更多操作"
              >
                <MoreHorizontal size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="rounded-xl p-1 w-40">
              <DropdownMenuItem onClick={() => onEdit(goal)} className="rounded-lg text-[13px]">
                <Pencil size={14} />
                <span>编辑</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAddChild(goal)} className="rounded-lg text-[13px]">
                <PlusCircle size={14} />
                <span>添加子目标</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(goal)}
                className="rounded-lg text-[13px]"
              >
                <Trash2 size={14} />
                <span>删除</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 子目标 */}
      {hasChildren && isExpanded && (
        <div className="relative ml-4">
          {goal.children!.map((child: Goal, idx: number) => (
            <TreeNode
              key={child.id}
              goal={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              pillarColor={displayColor}
              index={idx}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const GoalsPage = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activePillar, setActivePillar] = useState<PillarFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 新建/编辑弹窗
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [parentGoal, setParentGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState<GoalFormData>({
    name: '',
    description: '',
    color: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGoals = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await goalsApi.getGoals();
      setGoals(data);
      // 默认展开第一层
      const firstLevelIds = new Set<string>(data.map((g: Goal) => g.id));
      setExpandedIds(firstLevelIds);
    } catch (err) {
      logger.warn('获取目标列表失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchGoals();
  }, [fetchGoals]);

  const filteredGoals = useMemo(
    () => filterGoalsByPillar(goals, activePillar),
    [goals, activePillar],
  );

  const currentPillarColor = useMemo(() => {
    if (activePillar === 'all') return '#0a0a0a';
    return PILLARS.find((p) => p.key === activePillar)?.color || '#0a0a0a';
  }, [activePillar]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // 打开新建弹窗
  const handleCreate = useCallback(() => {
    setEditingGoal(null);
    setParentGoal(null);
    const defaultColor = activePillar === 'all' ? '#0a0a0a' : currentPillarColor;
    setFormData({ name: '', description: '', color: defaultColor });
    setDialogOpen(true);
  }, [activePillar, currentPillarColor]);

  // 打开编辑弹窗
  const handleEdit = useCallback((goal: Goal) => {
    setEditingGoal(goal);
    setParentGoal(null);
    setFormData({
      name: goal.name,
      description: goal.description || '',
      color: goal.color || '',
    });
    setDialogOpen(true);
  }, []);

  // 在某目标下添加子目标
  const handleAddChild = useCallback((parent: Goal) => {
    setEditingGoal(null);
    setParentGoal(parent);
    const defaultColor = parent.color || currentPillarColor;
    setFormData({ name: '', description: '', color: defaultColor });
    setDialogOpen(true);
  }, [currentPillarColor]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.name.trim()) return;
    try {
      setSubmitting(true);
      if (editingGoal) {
        const updateData: UpdateGoalRequest = {
          name: formData.name.trim(),
          description: formData.description || null,
          color: formData.color || null,
        };
        await goalsApi.updateGoal(editingGoal.id, updateData);
      } else {
        const createData: CreateGoalRequest = {
          name: formData.name.trim(),
          description: formData.description || null,
          color: formData.color || null,
          parentId: parentGoal?.id || null,
          pillar: parentGoal
            ? parentGoal.pillar
            : activePillar === 'all'
              ? 'cognition'
              : activePillar,
        };
        await goalsApi.createGoal(createData);
      }
      setDialogOpen(false);
      void fetchGoals();
    } catch (err) {
      logger.error('保存目标失败', err);
    } finally {
      setSubmitting(false);
    }
  }, [formData, editingGoal, parentGoal, activePillar, fetchGoals]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await goalsApi.deleteGoal(deleteTarget.id);
      setDeleteTarget(null);
      void fetchGoals();
    } catch (err) {
      logger.error('删除目标失败', err);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchGoals]);

  const descendantCount = deleteTarget
    ? collectAllDescendants(deleteTarget).length
    : 0;

  return (
    <div className="space-y-5 pb-20 min-h-full">
      <style>{`
        @keyframes growIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* 顶部标题 + 新建按钮 */}
      <div
        className="flex items-start justify-between gap-4"
        style={{ animation: 'fadeInUp 0.4s ease-out both' }}
      >
        <div>
          <p className="text-[11px] uppercase tracking-widest text-text-tertiary mb-1.5 font-medium">
            GOAL SYSTEM
          </p>
          <h2 className="text-[22px] font-semibold tracking-tight text-primary leading-tight">目标体系</h2>
          <p className="text-[12px] text-text-secondary mt-1">构建你的人生五支柱目标框架</p>
        </div>
        <Button
          onClick={handleCreate}
           className="bg-accent-bg text-foreground hover:bg-accent-bg/90 rounded-full px-4 h-9 text-[13px] font-semibold shadow-sm flex-shrink-0"
        >
          <Plus size={14} />
          新建目标
        </Button>
      </div>

      {/* 五支柱 Tab */}
      <div style={{ animation: 'fadeInUp 0.4s ease-out 50ms both' }}>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PILLARS.map((pillar) => {
            const isActive = activePillar === pillar.key;
            const Icon = pillar.key === 'all' ? null : PILLAR_ICONS[pillar.key as PillarKey];
            return (
              <button
                key={pillar.key}
                onClick={() => setActivePillar(pillar.key)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 border ${
                  isActive
                    ? 'bg-accent-bg text-foreground border-accent-bg shadow-sm'
                    : 'bg-surface text-text-secondary border-border hover:text-primary hover:border-border-strong'
                }`}
              >
                {Icon && <Icon size={12} color="currentColor" />}
                {pillar.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 树状列表 */}
      <div
        className="bg-surface rounded-2xl border border-border shadow-sm p-4"
        style={{ animation: 'fadeInUp 0.4s ease-out 100ms both' }}
      >
        {loading ? (
          <div className="py-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3">
                <Skeleton className="w-2.5 h-2.5 rounded-full" />
                <Skeleton className="h-4 flex-1 rounded-md" />
                <Skeleton className="h-4 w-10 rounded-md" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-12 text-center text-[13px] text-text-secondary">{error}</div>
        ) : filteredGoals.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-surface-muted flex items-center justify-center border border-border">
              <PlusCircle size={20} className="text-text-secondary" />
            </div>
            <p className="text-[15px] font-semibold text-primary mb-1.5">还没有目标</p>
            <p className="text-[12px] text-text-secondary mb-5">
              创建你的第一个目标，开启人生重塑之旅
            </p>
             <Button
               onClick={handleCreate}
               className="bg-accent-bg text-foreground hover:bg-accent-bg/90 rounded-full px-4 h-9 text-[13px] font-semibold"
             >
              <Plus size={14} />
              新建目标
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredGoals.map((goal, i) => (
              <TreeNode
                key={goal.id}
                goal={goal}
                depth={0}
                expandedIds={expandedIds}
                onToggle={toggleExpand}
                onEdit={handleEdit}
                onDelete={(g) => setDeleteTarget(g)}
                onAddChild={handleAddChild}
                pillarColor={goal.color || currentPillarColor}
                index={i}
              />
            ))}
          </div>
        )}
      </div>

      {/* 新建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingGoal ? '编辑目标' : parentGoal ? '添加子目标' : '新建目标'}
            </DialogTitle>
            <DialogDescription>
              {parentGoal ? (
                <span className="text-xs">
                  父目标：<span className="text-text-primary">{parentGoal.name}</span>
                </span>
              ) : (
                ''
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={(e) => void handleSubmit(e)}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[13px] font-semibold text-primary">名称</label>
               <Input
                 value={formData.name}
                 onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                 placeholder="请输入目标名称"
                 autoFocus
                 enterKeyHint="next"
                 autoComplete="off"
                 className="rounded-lg px-3 h-11 text-[13px]"
               />
             </div>
            <div className="space-y-1.5">
               <label className="text-[13px] font-semibold text-primary">描述（可选）</label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="描述这个目标的意义..."
                rows={3}
                className="rounded-lg px-3 py-2 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
               <label className="text-[13px] font-semibold text-primary">颜色</label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                    {['#2f66c9', '#e8a23a', '#34a853', '#d94a3d', '#1f3a8a', '#0a0a0a', '#6b6b6b'].map(
                      (color) => (
                        <button
                          key={color}
                          onClick={() => setFormData((p) => ({ ...p, color }))}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${
                            formData.color === color
                              ? 'border-primary'
                              : 'border-transparent hover:border-border-strong'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`选择颜色 ${color}`}
                        />
                      ),
                    )}
                </div>
                 <span className="text-[12px] text-text-secondary ml-1">
                    {formData.color || '默认'}
                  </span>
              </div>
            </div>
            </div>

          <DialogFooter className="mt-6">
             <Button
               type="button"
               variant="outline"
               onClick={() => setDialogOpen(false)}
               disabled={submitting}
             >
               取消
             </Button>
             <Button
               type="submit"
               disabled={submitting || !formData.name.trim()}
             >
               {submitting ? '保存中...' : '确定'}
             </Button>
           </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
               确定要删除目标「<span className="font-medium text-text-primary">{deleteTarget?.name}</span>」吗？
               {descendantCount > 0 && (
                 <span className="block mt-1">
                   同时会删除其下 <span className="font-medium text-text-primary num-tnum">{descendantCount}</span> 个子目标。
                </span>
              )}
              <span className="block mt-1 text-destructive">此操作不可撤销。</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteConfirm()}
              disabled={deleting}
            >
              {deleting ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GoalsPage;
