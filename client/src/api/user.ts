import { authRequest } from './index';
import type { UserInfo, UpdateMeRequest } from '@shared/api.interface';

export function getMe(): Promise<UserInfo> {
  return authRequest<UserInfo>('/api/me', 'GET');
}

export function updateMe(data: UpdateMeRequest): Promise<UserInfo> {
  return authRequest<UserInfo>('/api/me', 'PATCH', data);
}
