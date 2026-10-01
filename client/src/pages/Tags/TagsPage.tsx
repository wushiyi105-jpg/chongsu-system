import { useCallback, useEffect, useMemo, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { goalsApi, exportApi } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@client/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@client/src/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@client/src/components/ui/empty';
import {
  MoreHorizontal,
  Download,
  Search,
  Tag,
  Pencil,
  Merge,
  Archive,
  Trash2,
  FileText,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { Goal, PillarKey, ExportScope, ExportFormat } from '@shared/api.interface';

const PILLARS: Array<{ key: PillarKey | 'all'; name: string; color: string }> = [
  { key: 'all', name: '全部', color: '#0a0a0a' },
  { key: 'cognition', name: '认知', color: '#2f66c9' },
  { key: 'meaning', name: '意义', color: '#e8a23a' },
  { key: 'energy', name: '能量', color: '#34a853' },
  { key: 'relation', name: '关系', color: '#d94a3d' },
  { key: 'value', name: '价值', color: '#1f3a8a' },
];

const PILLAR_COLORS: Record<string, string> = {
  cognition: '#2f66c9',
  meaning: '#e8a23a',
  energy: '#34a853',
  relation: '#d94a3d',
  value: '#1f3a8a',
};

const PILLAR_NAMES: Record<string, string> = {
  cognition: '认知',
  meaning: '意义',
  energy: '能量',
  relation: '关系',
  value: '价值',
};

// 扁平化 goals 树
function flattenGoals(goals: Goal[]): Goal[] {
  const result: Goal[] = [];
  const walk = (items: Goal[]) => {
    items.forEach((g) => {
      result.push(g);
      if (g.children && g.children.length > 0) {
        walk(g.children);
      }
    });
  };
  walk(goals);
  return result;
}

// 按支柱分组顶层目标
function groupByPillar(goals: Goal[]): Record<string, Goal[]> {
  const groups: Record<string, Goal[]> = {};
  goals.forEach((g) => {
    const key = g.pillar || 'uncategorized';
    if (!groups[key]) groups[key] = [];
    groups[key].push(g);
  });
  return groups;
}

interface TagRowProps {
  goal: Goal;
  color: string;
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onRename: (goal: Goal) => void;
  onMerge: (goal: Goal) => void;
  onConfirm: (goal: Goal, action: string) => void;
}

function TagRow({
  goal,
  color,
  depth,
  expandedIds,
  onToggleExpand,
  onRename,
  onMerge,
  onConfirm,
}: TagRowProps) {
  const hasChildren = goal.children && goal.children.length > 0;
  const isExpanded = expandedIds.has(goal.id);
  const isTop = depth === 0;

  return (
    <div>
      <div
        className={`flex items-center justify-between transition-colors duration-150 ${
          isTop
            ? 'px-4 py-3 rounded-xl bg-surface border border-border hover:bg-surface-muted/50 shadow-sm mb-2'
            : 'px-3 py-2.5 rounded-lg hover:bg-surface-muted'
        }`}
        style={{ opacity: goal.archived ? 0.5 : 1 }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {hasChildren ? (
            <button
              onClick={() => onToggleExpand(goal.id)}
              className="w-6 h-6 flex items-center justify-center flex-shrink-0 text-text-tertiary hover:text-text-secondary transition-transform"
              style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-label={isExpanded ? '折叠' : '展开'}
            >
              <ChevronRight size={14} />
            </button>
          ) : (
            <div className="w-6 h-6 flex-shrink-0" />
          )}
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: goal.color || color }}
          />
          <div className="min-w-0 flex-1">
            <p
              className={`text-text-primary truncate ${
                isTop ? 'text-[13px] font-semibold' : 'text-[13px]'
              }`}
            >
              {goal.name}
              {goal.archived && (
                <span className="text-[12px] text-text-tertiary ml-2">(已归档)</span>
              )}
            </p>
            <p className="text-[12px] text-text-secondary">
              <span className="num-tnum font-medium">{goal.fragmentCount || 0}</span> 个碎片
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-surface hover:text-primary"
            >
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl p-1 w-36">
            <DropdownMenuItem onClick={() => onRename(goal)} className="rounded-lg text-[13px]">
              <Pencil size={14} />
              <span>重命名</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMerge(goal)} className="rounded-lg text-[13px]">
              <Merge size={14} />
              <span>合并</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onConfirm(goal, goal.archived ? 'unarchive' : 'archive')} className="rounded-lg text-[13px]">
              <Archive size={14} />
              <span>{goal.archived ? '取消归档' : '归档'}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onConfirm(goal, 'delete')}
              className="rounded-lg text-[13px]"
            >
              <Trash2 size={14} />
              <span>删除</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {hasChildren && isExpanded && (
        <div className="ml-5 pl-3 space-y-1 border-l border-border">
          {goal.children!.map((child) => (
            <TagRow
              key={child.id}
              goal={child}
              color={color}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onRename={onRename}
              onMerge={onMerge}
              onConfirm={onConfirm}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const TagsPage = () => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [expandedTagIds, setExpandedTagIds] = useState<Set<string>>(new Set());
  const [activePillar, setActivePillar] = useState<PillarKey | 'all'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  // 重命名对话框
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameGoal, setRenameGoal] = useState<Goal | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // 合并对话框
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSource, setMergeSource] = useState<Goal | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [mergeLoading, setMergeLoading] = useState(false);

  // 导出底表
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportTagId, setExportTagId] = useState('');
  const [exportPillar, setExportPillar] = useState<PillarKey | ''>('');
  const [exportLoading, setExportLoading] = useState(false);

  // 确认对话框（删除/归档）
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    goal: Goal | null;
    action: 'delete' | 'archive' | 'unarchive';
  }>({ open: false, goal: null, action: 'delete' });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // 加载标签
  const loadGoals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await goalsApi.getGoals();
      setGoals(data);
    } catch (err) {
      logger.error('加载标签失败', err);
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGoals();
  }, [loadGoals]);

  // 扁平化列表（用于合并选择等）
  const flatGoals = useMemo(() => flattenGoals(goals), [goals]);

  // 筛选后的标签
  const filteredGoals = useMemo(() => {
    let list = goals;

    // 支柱筛选
    if (activePillar !== 'all') {
      list = list.filter((g) => g.pillar === activePillar);
    }

    // 搜索筛选（包括子标签）
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.name.toLowerCase().includes(keyword) ||
          (g.children && g.children.some((c) => c.name.toLowerCase().includes(keyword))),
      );
    }

    // 归档筛选
    if (!includeArchived) {
      list = list.filter((g) => !g.archived);
    }

    return list;
  }, [goals, activePillar, search, includeArchived]);

  const grouped = useMemo(() => {
    if (activePillar !== 'all') {
      return { [activePillar]: filteredGoals };
    }
    return groupByPillar(filteredGoals);
  }, [filteredGoals, activePillar]);

  const toggleTagExpand = (id: string) => {
    setExpandedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirmDialog = (goal: Goal, action: string) => {
    setConfirmDialog({ open: true, goal, action: action as 'archive' | 'unarchive' | 'delete' });
  };

  // 重命名
  const handleOpenRename = (goal: Goal) => {
    setRenameGoal(goal);
    setRenameValue(goal.name);
    setRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!renameGoal || !renameValue.trim()) return;
    setRenameLoading(true);
    try {
      await goalsApi.updateGoal(renameGoal.id, { name: renameValue.trim() });
      setRenameDialogOpen(false);
      await loadGoals();
    } catch (err) {
      logger.error('重命名失败', err);
    } finally {
      setRenameLoading(false);
    }
  };

  // 合并
  const handleOpenMerge = (goal: Goal) => {
    setMergeSource(goal);
    setMergeTargetId('');
    setMergeDialogOpen(true);
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    setMergeLoading(true);
    try {
      await goalsApi.mergeGoals(mergeSource.id, mergeTargetId);
      setMergeDialogOpen(false);
      await loadGoals();
    } catch (err) {
      logger.error('合并失败', err);
    } finally {
      setMergeLoading(false);
    }
  };

  // 归档 / 取消归档 / 删除
  const handleConfirmAction = async () => {
    const { goal, action } = confirmDialog;
    if (!goal) return;
    setConfirmLoading(true);
    try {
      if (action === 'delete') {
        await goalsApi.deleteGoal(goal.id);
      } else if (action === 'archive') {
        await goalsApi.updateGoal(goal.id, { archived: true });
      } else if (action === 'unarchive') {
        await goalsApi.updateGoal(goal.id, { archived: false });
      }
      setConfirmDialog({ open: false, goal: null, action: 'delete' });
      await loadGoals();
    } catch (err) {
      logger.error(`操作失败: ${action}`, err);
    } finally {
      setConfirmLoading(false);
    }
  };

  // 导出
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const req: Parameters<typeof exportApi.exportData>[0] = {
        scope: exportScope,
        format: exportFormat,
      };
      if (exportScope === 'tag' && exportTagId) {
        req.tagId = exportTagId;
      }
      if (exportScope === 'pillar' && exportPillar) {
        req.pillar = exportPillar;
      }
      const res = await exportApi.exportData(req);

      // 触发浏览器下载
      const blob = new Blob([res.content], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSheetOpen(false);
    } catch (err) {
      logger.error('导出失败', err);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
       {/* 顶部 */}
       <div className="pb-4">
         <div className="flex items-center justify-between mb-4">
           <div>
             <p className="text-[11px] uppercase tracking-widest text-text-tertiary mb-1.5 font-medium">
               TAG SYSTEM
             </p>
             <h1 className="text-[22px] font-semibold tracking-tight text-text-primary leading-tight">标签管理</h1>
             <p className="text-[12px] text-text-secondary mt-1">整理你的知识碎片标签体系</p>
           </div>
          <Button
            variant="outline"
            size="sm"
             className="rounded-lg px-3 h-9 text-[13px] font-medium"
            onClick={() => setExportSheetOpen(true)}
          >
            <Download size={14} className="mr-1.5" />
            导出
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-4">
           <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input
            placeholder="搜索标签"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-[13px] rounded-lg bg-surface border border-border focus-visible:border-primary shadow-sm"
          />
        </div>

        {/* 支柱 Tab */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {PILLARS.map((p) => {
            const isActive = activePillar === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setActivePillar(p.key)}
                className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors duration-150 border ${
                  isActive
                    ? 'bg-accent-bg text-foreground border-accent-bg shadow-sm'
                    : 'bg-surface text-text-secondary border-border hover:text-text-primary hover:border-border-strong'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isActive ? 'currentColor' : p.color }}
                />
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

       {/* 标签列表 */}
       <div className="flex-1 overflow-y-auto pb-4">
          {loading && <div className="text-center py-12 text-[13px] text-text-secondary">加载中...</div>}

        {error && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                 <Tag size={32} className="text-text-tertiary" />
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-semibold">加载失败</EmptyTitle>
              <EmptyDescription className="text-[13px]">{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!loading && !error && filteredGoals.length === 0 && (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                 <Tag size={32} className="text-text-tertiary" />
              </EmptyMedia>
              <EmptyTitle className="text-[15px] font-semibold">暂无标签</EmptyTitle>
              <EmptyDescription className="text-[13px]">还没有标签，去创建一些吧</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {!loading &&
          !error &&
          Object.entries(grouped).map(([pillarKey, pillarGoals]) => {
             const color = PILLAR_COLORS[pillarKey] || '#6b6b6b';
            const name = PILLAR_NAMES[pillarKey] || '未分类';
            return (
              <div key={pillarKey} className="mt-5">
                 <div className="flex items-center gap-2 mb-2.5 px-1">
                   <span
                     className="w-2.5 h-2.5 rounded-full"
                     style={{ backgroundColor: color }}
                   />
                   <span className="text-[13px] font-semibold text-text-primary">{name}</span>
                   <span className="text-[12px] text-text-tertiary">(<span className="num-tnum">{pillarGoals.length}</span>)</span>
                </div>
                <div className="bg-surface rounded-2xl border border-border shadow-sm p-3 space-y-1">
                  {pillarGoals.map((goal) => (
                    <TagRow
                      key={goal.id}
                      goal={goal}
                      color={color}
                      depth={0}
                      expandedIds={expandedTagIds}
                      onToggleExpand={toggleTagExpand}
                      onRename={handleOpenRename}
                      onMerge={handleOpenMerge}
                      onConfirm={handleConfirmDialog}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* 重命名对话框 */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名标签</DialogTitle>
            <DialogDescription>输入新的标签名称</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="标签名称"
            autoFocus
            className="rounded-lg h-9 text-[13px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleRename} disabled={renameLoading || !renameValue.trim()}>
              {renameLoading ? '保存中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 合并对话框 */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>合并标签</DialogTitle>
            <DialogDescription>
              将「{mergeSource?.name}」的所有碎片移动到目标标签，然后删除当前标签
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
             <label className="text-[13px] font-semibold text-text-primary">选择目标标签</label>
            <select
              className="w-full h-9 px-3 rounded-lg border border-input bg-surface text-[13px] text-text-primary focus:ring-2 focus:ring-ring focus:outline-none appearance-none cursor-pointer"
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            >
              <option value="">请选择目标标签</option>
              {flatGoals
                .filter((g) => g.id !== mergeSource?.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleMerge} disabled={mergeLoading || !mergeTargetId}>
              {mergeLoading ? '合并中...' : '确定合并'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      <Dialog open={confirmDialog.open} onOpenChange={(v) => setConfirmDialog((prev) => ({ ...prev, open: v }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.action === 'delete'
                ? '删除标签'
                : confirmDialog.action === 'archive'
                  ? '归档标签'
                  : '取消归档'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.action === 'delete'
                ? `确定要删除「${confirmDialog.goal?.name}」吗？此操作不可撤销。`
                : confirmDialog.action === 'archive'
                  ? `确定要归档「${confirmDialog.goal?.name}」吗？`
                  : `确定要取消归档「${confirmDialog.goal?.name}」吗？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDialog({ open: false, goal: null, action: 'delete' })}
            >
              取消
            </Button>
            <Button
              variant={confirmDialog.action === 'delete' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={confirmLoading}
            >
              {confirmLoading ? '处理中...' : '确定'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 导出底表 */}
      <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-surface border-t border-border max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[16px] font-semibold text-text-primary">导出数据</SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-5 px-1 pb-2">
            {/* 导出范围 */}
            <div>
              <label className="text-[13px] font-semibold mb-2 block text-text-primary">导出范围</label>
              <div className="grid grid-cols-3 gap-2">
                {(['tag', 'pillar', 'all'] as ExportScope[]).map((scope) => (
                  <Button
                    key={scope}
                    variant={exportScope === scope ? 'default' : 'outline'}
                    className="w-full rounded-lg h-9 text-[13px]"
                    onClick={() => setExportScope(scope)}
                  >
                    {scope === 'tag' ? '按标签' : scope === 'pillar' ? '按支柱' : '全量'}
                  </Button>
                ))}
              </div>
            </div>

            {/* 选择具体标签 */}
            {exportScope === 'tag' && (
              <div>
                <label className="text-[13px] font-semibold mb-2 block text-text-primary">选择标签</label>
                <select
                  className="w-full h-9 px-3 rounded-lg border border-input bg-surface text-[13px] text-text-primary focus:ring-2 focus:ring-ring focus:outline-none appearance-none cursor-pointer"
                  value={exportTagId}
                  onChange={(e) => setExportTagId(e.target.value)}
                >
                  <option value="">请选择标签</option>
                  {flatGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 选择支柱 */}
            {exportScope === 'pillar' && (
              <div>
                <label className="text-[13px] font-semibold mb-2 block text-text-primary">选择支柱</label>
                <div className="flex flex-wrap gap-2">
                  {(['cognition', 'meaning', 'energy', 'relation', 'value'] as PillarKey[]).map(
                    (key) => (
                      <Button
                        key={key}
                        variant={exportPillar === key ? 'default' : 'outline'}
                        className="flex-1 min-w-[70px] rounded-lg h-9 text-[12px]"
                        onClick={() => setExportPillar(key)}
                      >
                        {PILLAR_NAMES[key]}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* 格式 */}
            <div>
              <label className="text-[13px] font-semibold mb-2 block text-text-primary">导出格式</label>
              <div className="grid grid-cols-3 gap-2">
                {(['markdown', 'json', 'text'] as ExportFormat[]).map((fmt) => (
                  <Button
                    key={fmt}
                    variant={exportFormat === fmt ? 'default' : 'outline'}
                    className="w-full rounded-lg h-9 text-[13px]"
                    onClick={() => setExportFormat(fmt)}
                  >
                    <FileText size={14} className="mr-1" />
                    {fmt === 'markdown' ? 'MD' : fmt === 'json' ? 'JSON' : 'TXT'}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              className="w-full rounded-lg h-9 text-[13px] font-semibold mt-2"
              onClick={handleExport}
              disabled={
                exportLoading ||
                (exportScope === 'tag' && !exportTagId) ||
                (exportScope === 'pillar' && !exportPillar)
              }
            >
              <Download size={14} className="mr-1.5" />
              {exportLoading ? '导出中...' : '导出并下载'}
            </Button>
          </div>

          <div className="mt-5">
            <Button variant="outline" className="w-full rounded-lg h-9 text-[13px]" onClick={() => setExportSheetOpen(false)}>
              <X size={14} className="mr-1.5" />
              关闭
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default TagsPage;
