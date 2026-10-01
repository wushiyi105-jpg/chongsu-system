import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi, authApi, UnauthorizedError, clearLegacyToken } from '@client/src/api';
import type { UserInfo } from '@shared/api.interface';
import { logger } from '@lark-apaas/client-toolkit/logger';

interface AuthContextValue {
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userApi.getMe();
      setUser(data);
      setError(null);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        setUser(null);
        setError(null);
      } else {
        logger.warn('获取用户信息失败', err);
        setError('获取用户信息失败');
        setUser(null);
      }
      clearLegacyToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      logger.warn('登出接口失败', err);
    } finally {
      clearLegacyToken();
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  return (
    <AuthContext.Provider value={{ user, loading, error, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
