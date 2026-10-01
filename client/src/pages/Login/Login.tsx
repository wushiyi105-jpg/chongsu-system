import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { authApi } from '@client/src/api';
import { Input } from '@client/src/components/ui/input';
import { Button } from '@client/src/components/ui/button';

const Login = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const validatePhone = (value: string): boolean => {
    if (!value) {
      setPhoneError('请输入手机号');
      return false;
    }
    if (!/^1[3-9]\d{9}$/.test(value)) {
      setPhoneError('请输入正确的手机号格式');
      return false;
    }
    setPhoneError('');
    return true;
  };

  const handleSendCode = async () => {
    if (!validatePhone(phone)) return;
    setErrorMsg('');
    try {
      await authApi.sendCode(phone);
      setCountdown(60);
      logger.info('验证码发送成功');
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
        (error as { message?: string })?.message ??
        '验证码发送失败，请稍后重试';
      setErrorMsg(msg);
      logger.error('验证码发送失败', error);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    if (value.length > 1) {
      handlePasteCode(value, index);
      return;
    }
    const digit = value.slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus();
    }
  };

  const handlePasteCode = (pasted: string, startIndex: number) => {
    const digits = pasted.replace(/\D/g, '').slice(0, 6 - startIndex);
    if (digits.length === 0) return;
    const newCode = [...code];
    for (let i = 0; i < digits.length; i += 1) {
      newCode[startIndex + i] = digits[i];
    }
    setCode(newCode);
    const nextIndex = Math.min(startIndex + digits.length, 5);
    if (digits.length < 6 - startIndex) {
      codeRefs.current[nextIndex]?.focus();
    }
  };

  const handleCodePaste = (index: number, e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (pasted) {
      e.preventDefault();
      handlePasteCode(pasted, index);
    }
  };

  const handleCodeKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  const handleLogin = async () => {
    const codeStr = code.join('');
    if (!validatePhone(phone)) return;
    if (codeStr.length !== 6) {
      setErrorMsg('请输入完整的 6 位验证码');
      codeRefs.current[0]?.focus();
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await authApi.login(phone, codeStr);
      logger.info('登录成功', res.isNewUser ? '新用户' : '老用户');
      navigate('/home', { replace: true });
    } catch (error: unknown) {
      const msg =
        (error as { response?: { data?: { error?: { message?: string } } } })
          ?.response?.data?.error?.message ??
        (error as { message?: string })?.message ??
        '登录失败，请稍后重试';
      setErrorMsg(msg);
      logger.error('登录失败', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* 顶部品牌区域 */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        {/* Logo / 标题 */}
        <div className="text-center mb-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-text-tertiary mb-2">
            RESHAPE SYSTEM
          </p>
          <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
            重塑系统
          </h1>
          <p className="text-text-secondary text-[13px] mt-1.5">
            人生目标与知识图谱
          </p>
        </div>

        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-accent-bg flex items-center justify-center shadow-sm">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeDasharray="3 3" className="text-foreground" />
              <circle cx="16" cy="16" r="4" fill="currentColor" className="text-foreground" />
            </svg>
          </div>
        </div>

        {/* 登录卡片 */}
        <div className="w-full max-w-[360px] bg-surface rounded-2xl p-6 shadow-sm border border-border">
          <div className="space-y-5">
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">手机号</label>
              <Input
                type="tel"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (phoneError) setPhoneError('');
                }}
                maxLength={11}
                className="h-9 text-[13px] rounded-lg bg-white border-border focus-visible:border-primary"
              />
              {phoneError && (
                <p className="text-[11px] text-destructive mt-1.5">{phoneError}</p>
              )}
            </div>

            {/* 验证码行 */}
            <div>
              <label className="text-[12px] font-medium text-text-secondary mb-1.5 block">验证码</label>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 flex-1">
                  {code.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) => {
                        codeRefs.current[index] = el;
                      }}
                      type="tel"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleCodeKeyDown(index, e)}
                      onPaste={(e) => handleCodePaste(index, e)}
                      className="h-9 text-center text-[15px] font-semibold p-0 rounded-lg bg-white border-border focus-visible:border-primary"
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                  className="h-9 px-3 whitespace-nowrap text-[12px] rounded-lg border-border"
                >
                  {countdown > 0 ? `${countdown}s` : '发送验证码'}
                </Button>
              </div>
            </div>

            {/* 错误提示 */}
            {errorMsg && (
              <div className="bg-danger-bg border border-danger-bg rounded-lg px-3 py-2">
                <p className="text-[12px] text-danger-fg leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {/* 登录按钮 */}
            <Button
              className="w-full h-9 text-[13px] font-semibold bg-accent-bg hover:bg-accent-bg/90 text-foreground rounded-full transition-colors shadow-sm"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? '登录中...' : '登录 / 注册'}
            </Button>
          </div>
        </div>
      </div>

      {/* 底部装饰线 */}
      <div className="pb-8 flex justify-center">
        <div className="w-32 h-px bg-border" />
      </div>

    </div>
  );
};

export default Login;
