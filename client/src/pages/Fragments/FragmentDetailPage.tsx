import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { fragmentsApi, goalsApi } from '@client/src/api';
import { Button } from '@client/src/components/ui/button';
import { Badge } from '@client/src/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@client/src/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@client/src/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@client/src/components/ui/dropdown-menu';
import { Markdown } from '@client/src/components/ui/markdown';
import { Image } from '@client/src/components/ui/image';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import GoalTagTreeSelect from '@client/src/components/GoalTagTreeSelect';
import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Trash2,
  Clock,
  ExternalLink,
  Network,
  FileText,
  Link2,
  Mic,
  Image as ImageIcon,
  Loader2,
  X,
  Check,
  Tag,
  ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Fragment, FragmentType, PillarKey, Goal } from '@shared/api.interface';
import { openExternalLink, isExternalUrl } from '@client/src/utils/open-external-link';

const PILLAR_INFO: Record<string, { name: string; color: string }> = {
  cognition: { name: '认知', color: '#2f66c9' },
  meaning: { name: '意义', color: '#9a7b12' },
  energy: { name: '能量', color: '#1f8a4c' },
  relation: { name: '关系', color: '#d94a3d' },
  value: { name: '价值', color: '#1f3a8a' },
};

const TYPE_LABELS: Record<FragmentType, string> = {
  text: '记录',
  link: '链接',
  voice: '语音',
};

const TYPE_EN: Record<FragmentType, string> = {
  text: 'NOTE',
  link: 'LINK',
  voice: 'VOICE',
};

function TypeIcon({ type, size = 14, className }: { type: FragmentType; size?: number; className?: string }) {
  if (type === 'text') return <FileText size={size} className={className} />;
  if (type === 'link') return <Link2 size={size} className={className} />;
  if (type === 'voice') return <Mic size={size} className={className} />;
  return <FileText size={size} className={className} />;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return '';
  }
}

const FragmentDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fragment, setFragment] = useState<Fragment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editRawUrl, setEditRawUrl] = useState('');
  const [editImages, setEditImages] = useState<Array<{ url: string; width?: number; height?: number; size?: number }>>([]);
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [tagDrawerOpen, setTagDrawerOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fragmentsApi.getFragment(id);
        if (!cancelled) setFragment(data);
      } catch (err) {
        logger.error('加载碎片详情失败', err);
        if (!cancelled) setError('加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

   const startEdit = () => {
     if (!fragment) return;
     setEditContent(fragment.content || '');
     setEditTitle(fragment.title || '');
     setEditSummary(fragment.summary || '');
     setEditRawUrl(fragment.rawUrl || '');
     setEditImages(fragment.images ? [...fragment.images] : []);
     setEditTagIds(fragment.tags?.map((t) => t.id) || []);
     setEditing(true);
   };

  const cancelEdit = () => {
    setEditing(false);
  };

  const saveEdit = async () => {
    if (!fragment || !id) return;
    setSaving(true);
    try {
       const patch: Record<string, unknown> = {};
       if (fragment.type === 'text' || fragment.type === 'voice') {
         patch.content = editContent.trim() || null;
       }
       if (fragment.type === 'link') {
         patch.title = editTitle.trim() || null;
         patch.summary = editSummary.trim() || null;
         patch.rawUrl = editRawUrl.trim() || null;
         patch.content = editContent.trim();
       }
       if (fragment.type === 'text') {
         patch.images = editImages;
       }

      const updated = await fragmentsApi.updateFragment(id, patch);

      const currentTagIds = fragment.tags?.map((t) => t.id) || [];
      const tagChanged =
        currentTagIds.length !== editTagIds.length ||
        !currentTagIds.every((t) => editTagIds.includes(t));
      if (tagChanged) {
        const withTags = await fragmentsApi.bindTags(id, editTagIds);
        setFragment(withTags);
      } else {
        setFragment(updated);
      }

      toast.success('已保存');
      setEditing(false);
    } catch (err) {
      logger.error('保存编辑失败', err);
      toast.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await fragmentsApi.deleteFragment(id);
      toast.success('已删除');
      setDeleteDialogOpen(false);
      navigate('/fragments');
    } catch (err) {
      logger.error('删除碎片失败', err);
      toast.error('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  const selectedTagsPreview = useMemo(() => {
    if (!fragment?.tags) return [];
    return fragment.tags;
  }, [fragment]);

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  if (error || !fragment) {
    return (
      <div className="py-16 text-center">
        <p className="text-text-secondary text-sm">{error || '碎片不存在'}</p>
        <Button variant="outline" className="mt-6 rounded-full px-5" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} className="mr-2" />
          返回
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-full pb-28">
        <div className="flex items-center justify-between mb-5">
          <Button
            variant="ghost"
            size="icon"
            onClick={cancelEdit}
            aria-label="取消编辑"
            className="rounded-full w-10 h-10 hover:bg-surface-muted"
          >
            <X size={18} />
          </Button>
          <span className="text-xs uppercase tracking-[0.25em] text-text-secondary font-medium">
            EDIT
          </span>
          <Button
            variant="default"
            size="sm"
            onClick={() => void saveEdit()}
            disabled={saving}
            className="rounded-full h-9 px-5 bg-accent-bg text-text-primary hover:bg-accent-bg/90 border-0 font-medium"
          >
            {saving ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                保存中
              </>
            ) : (
              <>
                <Check size={14} className="mr-1.5" />
                保存
              </>
            )}
          </Button>
        </div>

        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1.5 px-3 py-1 text-xs font-medium rounded-full border-border text-text-secondary"
            >
              <TypeIcon type={fragment.type} size={12} />
              {TYPE_LABELS[fragment.type]}
            </Badge>
          </div>

          {fragment.type === 'link' && (
            <>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold">
                  标题
                </label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="输入标题"
                  className="h-10 rounded-xl text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold">
                  链接地址
                </label>
                <Input
                  value={editRawUrl}
                  onChange={(e) => setEditRawUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-10 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold">
                  摘要
                </label>
                <Textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="链接摘要"
                  rows={3}
                  className="rounded-xl text-sm resize-none"
                />
              </div>
            </>
          )}

          {editImages.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold">
                  图片 ({editImages.length})
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {editImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden bg-surface-muted border border-border/50 group"
                  >
                    <Image
                      src={img.url}
                      alt={`图片 ${idx + 1}`}
                      className="w-full h-full object-cover"
                      width={120}
                      height={120}
                    />
                    <button
                      type="button"
                      onClick={() => setEditImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="删除图片"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold">
              {fragment.type === 'voice' ? '转写文本' : '内容'}
            </label>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              placeholder="输入内容"
              rows={fragment.type === 'link' ? 6 : 16}
              className="rounded-xl text-sm resize-none leading-relaxed"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold">
                关联标签
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTagDrawerOpen(true)}
                className="h-7 px-3 rounded-full text-xs text-text-secondary hover:text-text-primary"
              >
                <Tag size={13} className="mr-1.5" />
                管理标签
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {editTagIds.length === 0 ? (
                <span className="text-sm text-text-tertiary">未关联标签，点击上方管理</span>
              ) : (
                selectedTagsPreview
                  .filter((t) => editTagIds.includes(t.id))
                  .map((tag) => {
                    const tagColor =
                      tag.color ||
                      (tag.pillar && PILLAR_INFO[tag.pillar]?.color) ||
                      '#9a9a95';
                    return (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="gap-1.5 px-3 py-1 text-xs font-medium rounded-full border-border text-text-secondary"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: tagColor }}
                        />
                        {tag.name}
                      </Badge>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        <Drawer open={tagDrawerOpen} onOpenChange={setTagDrawerOpen}>
          <DrawerContent className="h-[85vh] rounded-t-3xl">
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-base font-semibold">管理标签</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 flex-1 overflow-y-auto">
              <GoalTagTreeSelect selectedIds={editTagIds} onChange={setEditTagIds} />
            </div>
            <DrawerFooter className="pt-2 pb-6">
              <DrawerClose asChild>
                <Button
                  variant="default"
                  className="w-full h-11 rounded-2xl bg-accent-bg text-text-primary hover:bg-accent-bg/90 border-0 font-medium"
                >
                  完成
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  const firstTag = fragment.tags && fragment.tags.length > 0 ? fragment.tags[0] : null;

  return (
    <div className="pb-28 min-h-full">
      <div className="flex items-center justify-between mb-5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          aria-label="返回"
          className="rounded-full w-10 h-10 hover:bg-surface-muted"
        >
          <ArrowLeft size={18} />
        </Button>
        <span className="text-xs uppercase tracking-[0.25em] text-text-tertiary font-medium">
          {TYPE_EN[fragment.type]}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="更多操作"
              className="rounded-full w-10 h-10 hover:bg-surface-muted"
            >
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-36 rounded-xl p-1">
            <DropdownMenuItem onClick={startEdit} className="gap-2 rounded-lg px-3 py-2 text-sm">
              <Pencil size={15} />
              编辑
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onClick={() => setDeleteDialogOpen(true)}
              className="text-danger gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <Trash2 size={15} />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3 mb-5">
        <Badge
          variant="outline"
          className="gap-1.5 px-3 py-1 text-xs font-medium rounded-full border-border text-text-secondary"
        >
          <TypeIcon type={fragment.type} size={12} />
          {TYPE_LABELS[fragment.type]}
        </Badge>
        <span className="text-xs text-text-tertiary flex items-center gap-1 font-mono tabular-nums">
          <Clock size={12} />
          {formatDateTime(fragment.createdAt)}
        </span>
      </div>

      {fragment.type === 'link' && fragment.cover && (
        <div className="rounded-2xl overflow-hidden aspect-[16/9] bg-surface-muted mb-5 border border-border/50">
          <Image src={fragment.cover} alt="封面" className="w-full h-full object-cover" />
        </div>
      )}

      {fragment.title && (
        <h1 className="text-xl font-semibold text-text-primary leading-snug mb-3">
          {fragment.title}
        </h1>
      )}

      {fragment.type === 'link' && fragment.rawUrl && isExternalUrl(fragment.rawUrl) && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void openExternalLink(fragment.rawUrl);
          }}
          className="inline-flex items-center gap-1.5 text-sm text-feature hover:underline mb-5 truncate max-w-full text-left"
        >
          <ExternalLink size={13} />
          <span className="truncate">{fragment.rawUrl}</span>
        </button>
      )}

      {fragment.type === 'voice' && fragment.audioUrl && (
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold mb-2">
            原始录音
          </div>
          <div className="rounded-xl bg-white p-4 border border-border/50">
            <audio controls src={fragment.audioUrl} className="w-full h-8" />
          </div>
        </div>
      )}

       {fragment.images && fragment.images.length > 0 && (
         <div className="mb-5">
           <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold mb-3">
             图片 ({fragment.images.length})
           </div>
          <div className="grid grid-cols-3 gap-2">
            {fragment.images.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setPreviewImageUrl(img.url)}
                className="aspect-square rounded-xl overflow-hidden bg-surface-muted border border-border/50 hover:border-border-strong transition-colors group relative"
              >
                <Image
                  src={img.url}
                  alt={`图片 ${idx + 1}`}
                  className="w-full h-full object-cover"
                  width={200}
                  height={200}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {fragment.content && (
        <div className="rounded-2xl bg-white p-5 border border-border/50 mb-5">
          <Markdown className="prose prose-sm max-w-none text-text-primary leading-relaxed">
            {fragment.content}
          </Markdown>
        </div>
      )}

      {fragment.tags && fragment.tags.length > 0 && (
        <div className="mb-5">
          <div className="text-xs uppercase tracking-[0.2em] text-text-tertiary font-semibold mb-3">
            关联标签
          </div>
          <div className="flex flex-wrap gap-2">
            {fragment.tags.map((tag) => {
              const tagColor =
                tag.color || (tag.pillar && PILLAR_INFO[tag.pillar]?.color) || '#9a9a95';
              return (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="gap-1.5 px-3 py-1 text-xs font-medium rounded-full border-border text-text-secondary"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: tagColor }}
                  />
                  {tag.name}
                </Badge>
              );
            })}
          </div>
        </div>
      )}

      <div className="text-xs text-text-tertiary space-y-1 font-mono tabular-nums mb-6">
        <div>创建于 {formatDateTime(fragment.createdAt)}</div>
        {fragment.updatedAt && fragment.updatedAt !== fragment.createdAt && (
          <div>更新于 {formatDateTime(fragment.updatedAt)}</div>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full gap-2 h-11 rounded-2xl text-sm font-medium border-border hover:bg-surface-muted"
        onClick={() => navigate('/graph')}
      >
        <Network size={16} />
        在图谱中查看
      </Button>

      <Dialog open={!!previewImageUrl} onOpenChange={(open) => !open && setPreviewImageUrl(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] rounded-2xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          {previewImageUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={previewImageUrl}
                alt="预览"
                className="max-w-full max-h-[85vh] object-contain rounded-xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-text-primary text-lg font-semibold">删除碎片</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-text-secondary">
              确定要删除这条碎片吗？此操作不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="rounded-full px-5 h-9"
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-full px-5 h-9"
            >
              {deleting && <Loader2 size={14} className="mr-2 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FragmentDetailPage;
