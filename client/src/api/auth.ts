import { authRequest, clearLegacyToken, setLegacyToken } from './index';
import type {
  SendCodeRequest,
  SendCodeResponse,
  LoginRequest,
  LoginResponse,
} from '@shared/api.interface';

export function sendCode(phone: string): Promise<SendCodeResponse> {
  return authRequest<SendCodeResponse>(
    '/api/auth/send-code',
    'POST',
    { phone } as SendCodeRequest,
    { requireAuth: false },
  );
}

export async function login(
  phone: string,
  code: string,
): Promise<LoginResponse> {
  const res = await authRequest<LoginResponse>(
    '/api/auth/login',
    'POST',
    { phone, code } as LoginRequest,
    { requireAuth: false },
  );
  if (res.token) {
    setLegacyToken(res.token);
  }
  return res;
}

export async function logout(): Promise<{ ok: true }> {
  try {
    const res = await authRequest<{ ok: true }>('/api/auth/logout', 'POST');
    return res;
  } finally {
    clearLegacyToken();
  }
}

export { clearLegacyToken };
