import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { logger } from '@lark-apaas/client-toolkit/logger';

export const AUTH_COOKIE_NAME = 'chongsu_auth_token';
export const LEGACY_TOKEN_KEY = 'chongsu_token';

export function getLegacyToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LEGACY_TOKEN_KEY);
}

export function setLegacyToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LEGACY_TOKEN_KEY, token);
}

export function clearLegacyToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LEGACY_TOKEN_KEY);
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message = '未登录') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ApiError extends Error {
  statusCode: number;
  constructor(statusCode: number, message = '请求失败') {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

function extractStatusCode(err: unknown): number {
  const responseStatus =
    (err as { response?: { status?: number } })?.response?.status ??
    (err as { status?: number })?.status;
  return typeof responseStatus === 'number' ? responseStatus : 0;
}

let authInterceptorInstalled = false;

function installAuthInterceptor(): void {
  if (authInterceptorInstalled) return;
  authInterceptorInstalled = true;

  axiosForBackend.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
      const status =
        (error as { response?: { status?: number } })?.response?.status ??
        (error as { status?: number })?.status;

      if (status === 401) {
        const config = (error as { config?: { _silent?: boolean } })?.config;
        if (config?._silent) {
          return Promise.reject(new UnauthorizedError());
        }
        clearLegacyToken();
        logger.warn('请求未授权', {
          url: (error as { config?: { url?: string } })?.config?.url,
        });
        return Promise.reject(new UnauthorizedError());
      }

      return Promise.reject(error);
    },
  );
}

export async function authRequest<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
  options?: { requireAuth?: boolean },
): Promise<T> {
  installAuthInterceptor();

  try {
    const token = getLegacyToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await axiosForBackend({
      url,
      method,
      data,
      headers,
      withCredentials: true,
      validateStatus: (status: number) =>
        (status >= 200 && status < 300) || status === 401,
    });

    if (response.status === 401) {
      clearLegacyToken();
      throw new UnauthorizedError();
    }

    return response.data as T;
  } catch (err: unknown) {
    if (err instanceof UnauthorizedError) throw err;

    const status = extractStatusCode(err);

    if (status === 401) {
      clearLegacyToken();
      throw new UnauthorizedError();
    }

    throw new ApiError(status, `请求失败(${status})`);
  }
}

export * as authApi from './auth';
export * as userApi from './user';
export * as goalsApi from './goals';
export * as fragmentsApi from './fragments';
export * as graphApi from './graph';
export * as exportApi from './export';
