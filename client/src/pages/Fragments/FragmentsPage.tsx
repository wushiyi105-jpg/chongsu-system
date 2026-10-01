import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { fragmentsApi, goalsApi } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
} from '@client/src/components/ui/collapsible';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@client/src/components/ui/empty';
import {
  Filter,
  FileText,
  Link2,
  ExternalLink,
  Mic,
  Image as ImageIcon,
  Search,
  Loader2,
} from 'lucide-react';
import type {
  Fragment,
  FragmentType,
  PillarKey,
  Goal,
} from '@shared/api.interface';

import { isExternalUrl, openExternalLink } from '@client/src/utils/open-external-link';
import { Image } from '@client/src/components/ui/image';

const PILLAR_INFO: Record<PillarKey, { name: string; color: string }> = {
  cognition: { name: '认知', color: '#2f66c9' },
  meaning: { name: '意义', color: '#e8a23a' },
  energy: { name: '能量', color: '#34a853' },
  relation: { name: '关系', color: '#1f8a4c' },
  value: { name: '价值', color: '#0a0a0a' },
};

const TYPE_LABELS: Record<FragmentType, string> = {
  text: '记录',
  link: '链接',
  voice: '语音',
};

function TypeIcon({ type, size = 14, className }: { type: FragmentType; size?: number; className?: string }) {
  if (type === 'text') return <FileText size={size} className={className} />;
  if (type === 'link') return <Link2 size={size} className={className} />;
  if (type === 'voice') return <Mic size={size} className={className} />;
  return <FileText size={size} className={className} />;
}

function formatDate(iso: string): { date: string; time: string } {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}` };
  } catch {
    return { date: '', time: '' };
  }
}

function getFragmentSummary(frag: Fragment): string {
  const content = (frag.content || '').trim();
  if (!content) return '无内容';
  return content.length > 60 ? content.slice(0, 60) + '…' : content;
}

function getFragmentTitle(frag: Fragment): string {
  if (frag.title && frag.title.trim()) return frag.title.trim();
  const content = (frag.content || '').trim();
  if (!content) return '无标题';
  return content.length > 40 ? content.slice(0, 40) + '…' : content;
}

const FragmentsPage = () => {
  const navigate = useNavigate();
  const [fragments, setFragments] = useState<Fragment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [total, setTotal] = useState(0);

  const [typeFilter, setTypeFilter] = useState<'all' | FragmentType>('all');
  const [pillarFilter, setPillarFilter] = useState<'all' | PillarKey>('all');
  const [tagSearch, setTagSearch] = useState('');
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  const hasActiveFilters = useMemo(
    () => typeFilter !== 'all' || pillarFilter !== 'all' || selectedGoalIds.length > 0,
    [typeFilter, pillarFilter, selectedGoalIds],
  );

  useEffect(() => {
    setFragments([]);
    setPage(1);
    setHasMore(true);
    loadingRef.current = false;
  }, [typeFilter, pillarFilter, selectedGoalIds]);

  const loadFragments = useCallback(async () => {
    if (loadingRef.current) return;
    if (!hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res = await fragmentsApi.getFragments({
        page,
        pageSize: PAGE_SIZE,
        type: typeFilter === 'all' ? undefined : typeFilter,
        pillar: pillarFilter === 'all' ? undefined : pillarFilter,
        goalId: selectedGoalIds.length > 0 ? selectedGoalIds[0] : undefined,
      });
      if (page === 1) {
        setFragments(res.items);
      } else {
        setFragments((prev) => [...prev, ...res.items]);
      }
      setTotal(res.total);
      setHasMore(res.items.length === PAGE_SIZE && page * PAGE_SIZE < res.total);
    } catch (err) {
      logger.error('加载碎片失败', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [page, hasMore, typeFilter, pillarFilter, selectedGoalIds]);

  useEffect(() => {
    if (fragments.length === 0 && hasMore && !loadingRef.current) {
      void loadFragments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, pillarFilter, selectedGoalIds]);

  const handleLoadMore = () => {
    if (!loadingRef.current && hasMore) {
      setPage((p) => p + 1);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          handleLoadMore();
        }
      },
      { threshold: 0.1 },
    );
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    return () => observer.disconnect();
  }, [hasMore, loading]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setGoalsLoading(true);
      try {
        const data = await goalsApi.getGoals();
        if (!cancelled) setGoals(data);
      } catch (err) {
        logger.error('加载目标失败', err);
      } finally {
        if (!cancelled) setGoalsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const flatGoals = useMemo(() => {
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
  }, [goals]);

  const filteredGoals = useMemo(() => {
    if (!tagSearch.trim()) return flatGoals;
    const q = tagSearch.toLowerCase();
    return flatGoals.filter((g) => g.name.toLowerCase().includes(q));
  }, [flatGoals, tagSearch]);

  const toggleGoal = (id: string) => {
    setSelectedGoalIds((prev) =>
      prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id],
    );
  };

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; items: Fragment[] }> = [];
    const dateMap = new Map<string, Fragment[]>();
    for (const frag of fragments) {
      const { date } = formatDate(frag.createdAt);
      if (!dateMap.has(date)) {
        dateMap.set(date, []);
      }
      dateMap.get(date)!.push(frag);
    }
    for (const [date, items] of dateMap) {
      groups.push({ date, items });
    }
    return groups;
  }, [fragments]);

  const filterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (pillarFilter !== 'all' ? 1 : 0) +
    selectedGoalIds.length;

  return (
    <div className="space-y-8 pb-28 min-h-full pt-4">
      {/* 页面标题区 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-medium mb-2">
            Fragments
          </p>
          <h1
            className="text-2xl font-medium text-text-primary leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            碎片记录
          </h1>
          <p className="text-xs text-text-secondary mt-1.5">
            共 <span className="num-tnum font-medium text-text-primary">{total}</span> 条碎片
          </p>
        </div>
        <Button
          variant={hasActiveFilters ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterOpen(!filterOpen)}
          className="gap-1.5 rounded-lg px-3 h-9 text-xs"
        >
          <Filter size={14} />
          筛选
          {hasActiveFilters && (
            <span className="num-tnum text-xs font-medium ml-0.5">
              {filterCount}
            </span>
          )}
        </Button>
      </div>

      {/* 筛选区 */}
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <CollapsibleContent>
          <div className="bg-surface rounded-2xl p-5 shadow-xs border border-border space-y-6">
            {/* 类型 */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-medium">
                Type · 类型
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'text', 'link', 'voice'] as const).map((t) => {
                  const active = typeFilter === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTypeFilter(t)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 border ${
                        active
                          ? 'text-text-primary border-border-strong bg-surface-muted'
                          : 'text-text-secondary border-border hover:text-text-primary hover:border-border-strong'
                      }`}
                    >
                      {t !== 'all' && <TypeIcon type={t} size={12} />}
                      {t === 'all' ? '全部' : TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 支柱 */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-medium">
                Pillar · 支柱
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPillarFilter('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors border ${
                    pillarFilter === 'all'
                      ? 'text-text-primary border-border-strong bg-surface-muted'
                      : 'text-text-secondary border-border hover:text-text-primary hover:border-border-strong'
                  }`}
                >
                  全部
                </button>
                {(Object.keys(PILLAR_INFO) as PillarKey[]).map((key) => {
                  const info = PILLAR_INFO[key];
                  const active = pillarFilter === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setPillarFilter(key)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1.5 border ${
                        active
                          ? 'text-text-primary border-border-strong bg-surface-muted'
                          : 'text-text-secondary border-border hover:text-text-primary hover:border-border-strong'
                      }`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: info.color }}
                      />
                      {info.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 标签 */}
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary font-medium">
                Tags · 标签
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <Input
                  placeholder="搜索标签..."
                  value={tagSearch}
                  onChange={(e) => setTagSearch(e.target.value)}
                  className="pl-8 rounded-lg bg-surface h-9 px-3 text-xs"
                />
              </div>
              <div className="max-h-56 overflow-y-auto space-y-0.5 pt-1">
                {goalsLoading ? (
                  <div className="text-xs text-text-secondary text-center py-6">加载中...</div>
                ) : filteredGoals.length === 0 ? (
                  <div className="text-xs text-text-secondary text-center py-6">暂无标签</div>
                ) : (
                  filteredGoals.map((goal) => {
                    const checked = selectedGoalIds.includes(goal.id);
                    const dotColor = goal.pillar
                      ? PILLAR_INFO[goal.pillar as PillarKey]?.color
                      : '#9a9a95';
                    return (
                      <div
                        key={goal.id}
                        className={`flex items-center gap-2.5 py-2 px-3 rounded-lg cursor-pointer transition-colors ${
                          checked ? 'bg-surface-muted' : 'hover:bg-surface-muted'
                        }`}
                        onClick={() => toggleGoal(goal.id)}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGoal(goal.id)}
                          className="rounded border-border w-3.5 h-3.5 flex-shrink-0 accent-primary"
                        />
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="text-xs text-text-primary flex-1 truncate">
                          {goal.name}
                        </span>
                        <span className="num-tnum text-[11px] text-text-tertiary">
                          {goal.fragmentCount ?? 0}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
              {selectedGoalIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedGoalIds([])}
                  className="text-xs h-auto py-1.5 text-text-secondary hover:text-text-primary rounded-lg"
                >
                  清除已选（<span className="num-tnum">{selectedGoalIds.length}</span>）
                </Button>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* 加载中 */}
      {loading && fragments.length === 0 && (
        <div className="py-20 flex justify-center">
          <Loader2 size={28} className="animate-spin text-text-secondary" />
        </div>
      )}

      {/* 空态 */}
      {!loading && fragments.length === 0 && (
        <Empty className="mt-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText className="size-8 text-text-secondary" />
            </EmptyMedia>
            <EmptyTitle>还没有碎片</EmptyTitle>
            <EmptyDescription>
              {hasActiveFilters ? '当前筛选条件下没有碎片' : '先去记录你的第一条碎片吧'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* 日期分组时间线 */}
      {fragments.length > 0 && (
        <div className="relative">
          <div className="space-y-8">
            {groupedByDate.map((group) => (
              <div key={group.date} className="relative">
                {/* 日期组头 */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs text-text-secondary">
                    {group.date}
                  </span>
                  <span className="flex-1 h-px bg-border" />
                  <span className="text-[11px] text-text-tertiary num-tnum">
                    {group.items.length} 条
                  </span>
                </div>
                {/* 卡片列表 */}
                <div className="space-y-3">
                  {group.items.map((frag) => {
                    const { time } = formatDate(frag.createdAt);
                    const firstTag = frag.tags && frag.tags.length > 0 ? frag.tags[0] : null;
                    const dotColor = firstTag?.pillar
                      ? PILLAR_INFO[firstTag.pillar as PillarKey]?.color
                      : '#9a9a95';
                    const displayText = frag.type === 'link' && frag.title?.trim()
                      ? frag.title.trim()
                      : getFragmentSummary(frag);
                    return (
                      <div
                        key={frag.id}
                        className="bg-surface rounded-2xl p-4 shadow-xs border border-border hover:border-border-strong transition-colors cursor-pointer"
                        onClick={() => navigate(`/fragments/${frag.id}`)}
                      >
                        {/* 卡片顶部：类型 + 时间 */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon type={frag.type} size={14} className="text-text-tertiary" />
                            <span className="text-[11px] text-text-tertiary">
                              {TYPE_LABELS[frag.type]}
                            </span>
                            {frag.type === 'link' && frag.rawUrl && isExternalUrl(frag.rawUrl) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void openExternalLink(frag.rawUrl);
                                }}
                                className="flex items-center gap-0.5 text-[11px] text-feature hover:underline ml-1"
                                title="在浏览器中打开链接"
                              >
                                <ExternalLink size={10} />
                                打开
                              </button>
                            )}
                          </div>
                          <span className="text-[11px] text-text-tertiary num-tnum">
                            {time}
                          </span>
                        </div>

                        {/* 图片缩略图 */}
                        {frag.images && frag.images.length > 0 && (
                          <div className="mb-3 rounded-xl overflow-hidden aspect-square w-16 bg-surface-muted border border-border/50 flex-shrink-0">
                            <Image
                              src={frag.images[0].url}
                              alt=""
                              className="w-full h-full object-cover"
                              width={64}
                              height={64}
                            />
                            {frag.images.length > 1 && (
                              <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-md num-tnum">
                                {frag.images.length}P
                              </div>
                            )}
                          </div>
                        )}

                        {/* 中部：内容摘要 */}
                        <p className="text-sm text-text-primary leading-relaxed line-clamp-2">
                          {displayText}
                        </p>

                        {/* 底部：标签 */}
                        {frag.tags && frag.tags.length > 0 && (
                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            {frag.tags.slice(0, 2).map((g) => {
                              const gColor = g.pillar
                                ? PILLAR_INFO[g.pillar as PillarKey]?.color
                                : '#9a9a95';
                              return (
                                <span
                                  key={g.id}
                                  className="flex items-center gap-1.5 text-xs text-text-secondary"
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: gColor }}
                                  />
                                  {g.name}
                                </span>
                              );
                            })}
                            {frag.tags.length > 2 && (
                              <span className="text-xs text-text-tertiary num-tnum">
                                +{frag.tags.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 加载更多 */}
          <div ref={loadMoreRef} className="py-10 text-center">
            {loading && fragments.length > 0 && (
              <Loader2 size={20} className="animate-spin text-text-tertiary mx-auto" />
            )}
            {!hasMore && fragments.length > 0 && (
              <p className="text-xs text-text-tertiary">— 没有更多了 —</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FragmentsPage;
