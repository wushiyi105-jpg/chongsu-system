import { useCallback, useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { useAuth } from '@client/src/contexts/AuthContext';
import { userApi, graphApi, exportApi } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { APP_VERSION } from '@client/src/utils/app-version';
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@client/src/components/ui/sheet';
import {
  ChevronRight,
  Download,
  Info,
  Trash2,
  LogOut,
  Pencil,
  X,
  FileText,
  Target,
  Sparkles,
} from 'lucide-react';
import type { DashboardData, ExportScope, ExportFormat, PillarKey } from '@shared/api.interface';
import { Image } from '@client/src/components/ui/image';

const PILLAR_NAMES: Record<string, string> = {
  cognition: '认知',
  meaning: '意义',
  energy: '能量',
  relation: '关系',
  value: '价值',
};

const ProfilePage = () => {
  const { user, loading: authLoading, logout, refreshUser } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [nicknameValue, setNicknameValue] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('all');
  const [exportTagId, setExportTagId] = useState<string>('');
  const [exportPillar, setExportPillar] = useState<string>('');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown');
  const [exportLoading, setExportLoading] = useState(false);

  const [aboutSheetOpen, setAboutSheetOpen] = useState(false);

  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);

  const initial = user?.nickname?.[0] || user?.phone?.slice(-1) || 'U';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDashboardLoading(true);
      try {
        const data = await graphApi.getDashboard();
        if (!cancelled) setDashboard(data);
      } catch (err) {
        logger.error('加载首页数据失败', err);
      } finally {
        if (!cancelled) setDashboardLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpenEdit = () => {
    setNicknameValue(user?.nickname || '');
    setEditDialogOpen(true);
  };

  const handleSaveNickname = async () => {
    setEditLoading(true);
    try {
      await userApi.updateMe({ nickname: nicknameValue.trim() });
      await refreshUser();
      setEditDialogOpen(false);
    } catch (err) {
      logger.error('修改昵称失败', err);
    } finally {
      setEditLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const maskPhone = (phone: string): string => {
    if (phone.length < 7) return phone;
    return phone.slice(0, 3) + '****' + phone.slice(-4);
  };

  const getDays = (): number => {
    if (!user?.createdAt) return 0;
    const start = new Date(user.createdAt).getTime();
    const now = Date.now();
    return Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
  };

  const handleExport = async () => {
    if (exportScope === 'tag' && !exportTagId) return;
    if (exportScope === 'pillar' && !exportPillar) return;

    setExportLoading(true);
    try {
      const data = await exportApi.exportData({
        scope: exportScope,
        format: exportFormat,
        tagId: exportScope === 'tag' ? exportTagId : undefined,
        pillar: exportScope === 'pillar' ? (exportPillar as PillarKey) : undefined,
      });

      const ext = exportFormat === 'markdown' ? 'md' : exportFormat === 'json' ? 'json' : 'txt';
      const blob = new Blob([data.content], {
        type: exportFormat === 'json' ? 'application/json' : 'text/plain',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reshape-export-${Date.now()}.${ext}`;
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

  const handleClearCache = () => {
    localStorage.clear();
    setClearCacheDialogOpen(false);
    window.location.reload();
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* 页面标题 */}
      <div className="mb-5">
        <p className="text-[11px] uppercase tracking-widest text-text-tertiary mb-1 font-medium">
          PROFILE
        </p>
        <h1 className="text-[22px] font-semibold tracking-tight text-text-primary">
          我的
        </h1>
      </div>

      {/* 用户卡片 */}
      <div className="flex items-center gap-4 bg-surface rounded-2xl p-4 shadow-sm border border-border mb-5">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-[16px] font-semibold flex-shrink-0 bg-text-primary">
          {user?.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt="avatar"
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            initial
          )}
        </div>

        <div className="flex-1 min-w-0">
          <button
            className="flex items-center gap-1.5 group"
            onClick={handleOpenEdit}
            disabled={authLoading}
          >
            <h2 className="text-[16px] font-semibold text-text-primary truncate">
              {authLoading ? '加载中...' : user?.nickname || '未设置昵称'}
            </h2>
            <Pencil className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
          <p className="text-[13px] text-text-secondary mt-0.5">
            {user ? maskPhone(user.phone) : ''}
          </p>
        </div>
      </div>

      {/* KPI 统计 */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-surface-muted rounded-xl p-3 text-center border border-border">
          <div className="text-[22px] font-semibold num-tnum text-accent-text leading-tight">
            {dashboardLoading ? '--' : dashboard?.totalGoals || 0}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">总目标</div>
        </div>
        <div className="bg-surface-muted rounded-xl p-3 text-center border border-border">
          <div className="text-[22px] font-semibold num-tnum text-accent-text leading-tight">
            {dashboardLoading ? '--' : dashboard?.totalFragments || 0}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">总碎片</div>
        </div>
        <div className="bg-surface-muted rounded-xl p-3 text-center border border-border">
          <div className="text-[22px] font-semibold num-tnum text-accent-text leading-tight">
            {authLoading ? '--' : getDays()}
          </div>
          <div className="text-[11px] text-text-secondary mt-1">已坚持</div>
        </div>
      </div>

      {/* 菜单列表 */}
      <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden mb-5">
        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-muted transition-colors border-b border-border"
          onClick={() => setExportSheetOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-surface-muted flex items-center justify-center">
              <Download className="w-4 h-4 text-text-secondary" />
            </div>
            <span className="text-[13px] text-text-primary">导出数据</span>
          </div>
          <ChevronRight className="w-4 h-4 text-text-tertiary" />
        </button>

        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-muted transition-colors border-b border-border"
          onClick={() => setAboutSheetOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-surface-muted flex items-center justify-center">
              <Info className="w-4 h-4 text-text-secondary" />
            </div>
            <span className="text-[13px] text-text-primary">关于重塑系统</span>
          </div>
          <ChevronRight className="w-4 h-4 text-text-tertiary" />
        </button>

        <button
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-muted transition-colors"
          onClick={() => setClearCacheDialogOpen(true)}
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-danger-bg flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-danger-fg" />
            </div>
            <div className="text-left">
              <span className="text-[13px] text-text-primary block">清除缓存</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-text-tertiary" />
        </button>
      </div>

      {/* 五大支柱 */}
      {dashboard && !dashboardLoading && dashboard.pillars.length > 0 && (
        <div className="mb-5">
          <h3 className="text-[13px] font-semibold text-text-primary mb-2.5 px-1">五大支柱</h3>
          <div className="bg-surface rounded-2xl shadow-sm border border-border p-4 space-y-3">
            {dashboard.pillars.map((p) => (
              <div key={p.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-[13px] text-text-primary">{p.name}</span>
                </div>
                <div className="text-[12px] text-text-secondary num-tnum">
                  <span className="font-semibold text-text-primary">{p.goalCount}</span> 目标 ·{' '}
                  <span className="font-semibold text-text-primary">{p.fragmentCount}</span> 碎片
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 退出按钮 */}
      <div className="mt-auto pt-4">
        <Button
          variant="outline"
          className="w-full rounded-lg h-9 text-[13px] border-danger-fg/30 text-danger-fg hover:bg-danger-bg hover:text-danger-fg hover:border-danger-fg/50"
          onClick={() => setLogoutDialogOpen(true)}
        >
          <LogOut className="w-4 h-4 mr-1.5" />
          退出登录
        </Button>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改昵称</DialogTitle>
            <DialogDescription>设置你的个性化昵称</DialogDescription>
          </DialogHeader>
          <Input
            value={nicknameValue}
            onChange={(e) => setNicknameValue(e.target.value)}
            placeholder="请输入昵称"
            maxLength={20}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSaveNickname} disabled={editLoading || !nicknameValue.trim()}>
              {editLoading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认退出登录？</DialogTitle>
            <DialogDescription>退出后需要重新登录才能继续使用</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              退出登录
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearCacheDialogOpen} onOpenChange={setClearCacheDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>清除缓存</DialogTitle>
            <DialogDescription>将清除本地所有缓存数据并刷新页面，当前登录态不会丢失</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearCacheDialogOpen(false)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleClearCache}>
              清除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={exportSheetOpen} onOpenChange={setExportSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-surface border-t border-border max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-[16px] font-semibold text-text-primary">导出数据</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-4">
            <div>
              <label className="text-[13px] font-semibold text-text-primary mb-2 block">导出范围</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'all'}
                    onChange={() => setExportScope('all')}
                  />
                  <span className="text-[13px]">全量导出（所有目标与碎片）</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'pillar'}
                    onChange={() => setExportScope('pillar')}
                  />
                  <span className="text-[13px]">按支柱导出</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface">
                  <input
                    type="radio"
                    name="exportScope"
                    checked={exportScope === 'tag'}
                    onChange={() => setExportScope('tag')}
                  />
                  <span className="text-[13px]">按标签导出</span>
                </label>
              </div>
            </div>

            {exportScope === 'pillar' && (
              <div>
                <label className="text-[13px] font-semibold text-text-primary mb-2 block">选择支柱</label>
                <div className="space-y-2">
                  {dashboard?.pillars.map((p) => (
                    <label
                      key={p.key}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface"
                    >
                      <input
                        type="radio"
                        name="exportPillar"
                        checked={exportPillar === p.key}
                        onChange={() => setExportPillar(p.key)}
                      />
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-[13px]">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-[13px] font-semibold text-text-primary mb-2 block">导出格式</label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'markdown'}
                    onChange={() => setExportFormat('markdown')}
                  />
                  <FileText className="w-4 h-4 text-text-secondary" />
                  <span className="text-[13px]">Markdown</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'json'}
                    onChange={() => setExportFormat('json')}
                  />
                  <FileText className="w-4 h-4 text-text-secondary" />
                  <span className="text-[13px]">JSON</span>
                </label>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-surface-muted transition-colors bg-surface">
                  <input
                    type="radio"
                    name="exportFormat"
                    checked={exportFormat === 'text'}
                    onChange={() => setExportFormat('text')}
                  />
                  <FileText className="w-4 h-4 text-text-secondary" />
                  <span className="text-[13px]">纯文本</span>
                </label>
              </div>
            </div>

            <Button
              onClick={handleExport}
              disabled={
                exportLoading ||
                (exportScope === 'tag' && !exportTagId) ||
                (exportScope === 'pillar' && !exportPillar)
              }
              className="w-full h-9 text-[13px] font-semibold bg-accent-bg text-foreground hover:bg-accent-bg/90 rounded-lg shadow-sm"
            >
              {exportLoading ? '导出中...' : '确认导出'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={aboutSheetOpen} onOpenChange={setAboutSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl bg-surface border-t border-border">
          <SheetHeader>
            <SheetTitle className="text-[16px] font-semibold text-text-primary flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-text-secondary" />
              关于重塑系统
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 text-[13px] text-text-secondary leading-relaxed pb-4">
            <p>
              <strong className="text-text-primary">重塑系统</strong> 是一款人生管理工具，
              帮助你将日常碎片（文字/链接/语音）沉淀到「五大支柱」目标体系中，
              形成可视化的知识脉络。
            </p>
            <div>
              <p className="font-semibold text-text-primary mb-2">五大支柱</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>认知 — 求知与成长</li>
                <li>意义 — 价值与方向</li>
                <li>能量 — 活力与健康</li>
                <li>关系 — 联结与情感</li>
                <li>价值 — 创造与贡献</li>
              </ul>
            </div>
            <p className="text-[12px] text-text-tertiary pt-2">
              版本 {APP_VERSION}
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProfilePage;
