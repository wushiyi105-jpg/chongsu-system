import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import {
  Sparkles,
  FileText,
  Link2,
  Mic,
  Target,
  Calendar,
  TrendingUp,
  HardDrive,
} from 'lucide-react';
import { graphApi } from '@client/src/api';
import { useAuth } from '@client/src/contexts/AuthContext';
import { Skeleton } from '@client/src/components/ui/skeleton';
import type {
  DashboardData,
  Fragment,
  PillarKey,
} from '@shared/api.interface';

const TOTAL_PILLARS = 5;

const formatStorageSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const PILLAR_COLOR_HEX: Record<PillarKey, string> = {
  cognition: '#2f66c9',
  meaning: '#e8a23a',
  energy: '#34a853',
  relation: '#1f8a4c',
  value: '#0a0a0a',
};

const FRAGMENT_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  text: FileText,
  link: Link2,
  voice: Mic,
};

const FRAGMENT_TYPE_LABELS: Record<string, string> = {
  text: '记录',
  link: '链接',
  voice: '语音',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '凌晨好';
  if (hour < 12) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function getTodayDate(): string {
  const date = new Date();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 · ${weekDays[date.getDay()]}`;
}

const PillarCard = ({
  pillar,
  index,
}: {
  pillar: DashboardData['pillars'][number];
  index: number;
}) => {
  const color = PILLAR_COLOR_HEX[pillar.key];
  return (
    <Link
      to="/tags"
      className="group flex-shrink-0 w-[140px] bg-surface rounded-2xl p-4 border border-border hover:bg-surface-muted transition-colors duration-200 shadow-xs"
      style={{
        animationDelay: `${index * 40}ms`,
        animation: 'fadeInUp 0.4s ease-out both',
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <p className="text-[13px] font-normal text-primary leading-tight truncate" style={{ fontFamily: 'var(--font-display)' }}>
          {pillar.name}
        </p>
      </div>
      <div className="flex items-end gap-5">
        <div>
          <p className="text-[9.5px] text-text-tertiary font-light tracking-wide">
            目标
          </p>
          <p className="text-[18px] font-normal text-primary leading-none mt-1 tracking-tight num-tnum">
            {pillar.goalCount}
          </p>
        </div>
        <div>
          <p className="text-[9.5px] text-text-tertiary font-light tracking-wide">
            碎片
          </p>
          <p className="text-[18px] font-normal text-primary leading-none mt-1 tracking-tight num-tnum">
            {pillar.fragmentCount}
          </p>
        </div>
      </div>
    </Link>
  );
};

const FragmentItem = ({
  fragment,
  index,
}: {
  fragment: Fragment;
  index: number;
}) => {
  const TypeIcon = FRAGMENT_TYPE_ICONS[fragment.type] ?? FileText;
  const displayText = fragment.title || fragment.summary || fragment.content;
  const trimmed =
    displayText.length > 40 ? displayText.slice(0, 40) + '...' : displayText;

  return (
    <Link
      to={`/fragments/${fragment.id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-surface-muted transition-colors border-b border-border last:border-b-0 first:border-t-0"
      style={{
        animationDelay: `${index * 50}ms`,
        animation: 'slideUp 0.3s ease-out both',
      }}
    >
      <div className="w-7 h-7 rounded-lg bg-surface-muted flex items-center justify-center flex-shrink-0 mt-0.5 border border-border">
        <TypeIcon size={14} className="text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-primary line-clamp-2 leading-snug">
          {trimmed}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[12px] text-text-tertiary num-tnum">
            {formatDate(fragment.createdAt)}
          </span>
          <span className="text-[10px] text-border">·</span>
          <span className="text-[12px] text-text-secondary">
            {FRAGMENT_TYPE_LABELS[fragment.type]}
          </span>
          {fragment.tags && fragment.tags.length > 0 && (
            <>
              <span className="text-[10px] text-border">·</span>
              <span className="text-[12px] text-text-secondary truncate max-w-[100px]">
                {fragment.tags[0].name}
                {fragment.tags.length > 1
                  ? ` +${fragment.tags.length - 1}`
                  : ''}
              </span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
};

const HomePage = () => {
  const { user, loading: userLoading } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const data = await graphApi.getDashboard();
        setDashboard(data);
      } catch (err) {
        logger.warn('获取首页数据失败', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const nickname = user?.nickname || user?.phone || '朋友';

  return (
    <div className="space-y-6 pb-4">
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .horizontal-scroll {
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* 页面标题区 */}
      <div
        className="pt-2 pb-5"
        style={{ animation: 'fadeInUp 0.4s ease-out both' }}
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-text-tertiary mb-3 font-medium">
          Knowledge Dashboard
        </p>
        <h1 className="text-[26px] font-medium text-primary leading-[1.25] tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
          {getGreeting()}，{userLoading ? '...' : nickname}
        </h1>
        <div className="flex items-center gap-1.5 mt-2 text-[12px] text-text-tertiary">
          <Calendar size={13} />
          <span>{getTodayDate()}</span>
        </div>
      </div>

      {/* 人生愿景卡 */}
      <div
        className="bg-surface rounded-2xl p-5 border border-border shadow-sm"
        style={{ animation: 'fadeInUp 0.4s ease-out 80ms both' }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-6 h-6 rounded-full bg-active-bg flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-active-fg" />
          </div>
          <span className="text-[11px] text-text-tertiary uppercase tracking-[0.18em] font-medium">
            Life Vision · 人生大目标
          </span>
        </div>
        <p className="text-[20px] text-primary leading-[1.5] tracking-tight" style={{ fontFamily: 'var(--font-display)', fontWeight: 500 }}>
          成为一个持续成长、有温度的创造者
        </p>
        <p className="text-[12px] text-text-tertiary mt-2.5 leading-relaxed">
          在五大支柱中生长你的知识树
        </p>
      </div>

      {/* KPI 概览 */}
      <div style={{ animation: 'fadeInUp 0.4s ease-out 150ms both' }}>
        <div className="flex items-baseline gap-2.5 mb-4">
          <span className="text-[10px] text-text-tertiary uppercase tracking-[0.22em] font-medium">
            Overview
          </span>
          <span className="text-[12px] text-text-tertiary">核心指标</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loading
            ? [...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-[104px] rounded-2xl" />
              ))
            : error || !dashboard
              ? (
                <div className="col-span-full rounded-2xl bg-surface p-5 text-center text-[13px] text-text-secondary border border-border">
                  {error || '暂无数据'}
                </div>
                )
              : (
                <>
                  <div className="bg-surface rounded-2xl p-4 border border-border hover:bg-surface-muted transition-colors duration-200 shadow-xs">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary font-medium mb-2">
                      总目标
                    </p>
                    <p className="text-[32px] font-semibold text-primary leading-none tracking-tight num-tnum">
                      {dashboard.totalGoals}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-[11px] font-medium text-active-fg">
                      <TrendingUp size={12} strokeWidth={2.5} />
                      <span>健康</span>
                    </div>
                  </div>
                  <div className="bg-surface rounded-2xl p-4 border border-border hover:bg-surface-muted transition-colors duration-200 shadow-xs">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary font-medium mb-2">
                      碎片总数
                    </p>
                    <p className="text-[32px] font-semibold text-primary leading-none tracking-tight num-tnum">
                      {dashboard.totalFragments}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-[11px] font-medium text-amber">
                      <TrendingUp size={12} strokeWidth={2.5} />
                      <span>活跃</span>
                    </div>
                  </div>
                  <div className="bg-surface rounded-2xl p-4 border border-border hover:bg-surface-muted transition-colors duration-200 shadow-xs">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary font-medium mb-2">
                      五支柱
                    </p>
                    <p className="text-[32px] font-semibold text-primary leading-none tracking-tight num-tnum">
                      {TOTAL_PILLARS}
                    </p>
                    <div className="flex items-center gap-1 mt-3 text-[11px] font-medium text-text-secondary">
                      <span>知识维度</span>
                    </div>
                  </div>
                  <div className="bg-surface rounded-2xl p-4 border border-border hover:bg-surface-muted transition-colors duration-200 shadow-xs">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-text-tertiary font-medium mb-2">
                      图片存储
                    </p>
                    <p className="text-[20px] font-semibold text-primary leading-none tracking-tight num-tnum">
                      {formatStorageSize(dashboard.storageUsedBytes)}
                    </p>
                    <div className={`flex items-center gap-1 mt-3 text-[11px] font-medium ${
                      dashboard.storageUsedBytes / dashboard.storageQuotaBytes > 0.9
                        ? 'text-danger-fg'
                        : dashboard.storageUsedBytes / dashboard.storageQuotaBytes > 0.7
                          ? 'text-pending-fg'
                          : 'text-text-secondary'
                    }`}>
                      <HardDrive size={12} strokeWidth={2.5} />
                      <span>共 {formatStorageSize(dashboard.storageQuotaBytes)}</span>
                    </div>
                  </div>
                </>
                )}
        </div>
      </div>

      {/* 五支柱总览 */}
      <div style={{ animation: 'fadeInUp 0.4s ease-out 220ms both' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[10px] text-text-tertiary uppercase tracking-[0.22em] font-medium">
              Pillars
            </span>
            <span className="text-[12px] text-text-tertiary">五大支柱</span>
          </div>
          <Link
            to="/tags"
            className="text-[12px] text-text-secondary hover:text-primary transition-colors"
          >
            查看全部 →
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 horizontal-scroll hide-scrollbar">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="flex-shrink-0 w-[140px] h-24 rounded-xl" />
            ))}
          </div>
        ) : error || !dashboard ? (
          <div className="rounded-2xl bg-surface p-5 text-center text-[13px] text-text-secondary border border-border">
            {error || '暂无数据'}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 horizontal-scroll hide-scrollbar">
            {dashboard.pillars.map((pillar, i) => (
              <PillarCard key={pillar.key} pillar={pillar} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* 最近碎片 */}
      <div style={{ animation: 'fadeInUp 0.4s ease-out 300ms both' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[10px] text-text-tertiary uppercase tracking-[0.22em] font-medium">
              Recent
            </span>
            <span className="text-[12px] text-text-tertiary">最近记录</span>
          </div>
          <Link
            to="/fragments"
            className="text-[12px] text-text-secondary hover:text-primary transition-colors"
          >
            全部 →
          </Link>
        </div>
        <div className="bg-surface rounded-2xl overflow-hidden border border-border shadow-sm">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : error || !dashboard ? (
            <div className="p-8 text-center text-[13px] text-text-secondary">
              {error || '暂无记录'}
            </div>
          ) : dashboard.recentFragments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[13px] text-text-secondary">还没有碎片记录</p>
              <p className="text-[12px] text-text-tertiary mt-1.5">去录入你的第一个想法吧</p>
            </div>
          ) : (
            <div>
              {dashboard.recentFragments.slice(0, 5).map((fragment, i) => (
                <FragmentItem key={fragment.id} fragment={fragment} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
