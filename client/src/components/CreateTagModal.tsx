import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';
import { Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface CreateTagModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void> | void;
}

const CreateTagModal = ({
  open,
  title,
  placeholder = '请输入标签名称',
  loading,
  error,
  onOpenChange,
  onCreate,
}: CreateTagModalProps) => {
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setName('');
      setLocalError('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const getTrimmedValue = (): string => {
    return inputRef.current?.value?.trim() ?? '';
  };

  const handleCreate = async () => {
    if (loading) return;
    const trimmed = getTrimmedValue();
    if (!trimmed) {
      setLocalError('请输入标签名称');
      return;
    }
    setLocalError('');
    try {
      await onCreate(trimmed);
      onOpenChange(false);
    } catch (err) {
      logger.warn('创建标签失败', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleCreate();
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
  };

  const handleCompositionEnd = () => {
    composingRef.current = false;
    const val = inputRef.current?.value ?? '';
    setName(val);
  };

  const displayError = error || localError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[360px] w-[90vw] rounded-2xl p-0 gap-0">
        <form onSubmit={handleSubmit} className="touch-manipulation">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-[15px] font-semibold text-text-primary">
              {title}
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 pb-4">
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!composingRef.current && localError) {
                  setLocalError('');
                }
              }}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder={placeholder}
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-12 text-[14px] touch-manipulation"
              disabled={loading}
            />
            {displayError && (
              <div className="mt-2 text-[12px] text-danger leading-tight">
                {displayError}
              </div>
            )}
          </div>
          <div className="flex gap-2 px-5 pb-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 h-11 text-[13px] touch-manipulation"
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 text-[13px] bg-accent-bg text-foreground hover:bg-accent-bg/90 touch-manipulation"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                '创建'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateTagModal;
