import { authRequest } from './index';
import type {
  Fragment,
  FragmentListParams,
  FragmentListResponse,
  CreateFragmentRequest,
  UpdateFragmentRequest,
  ParseLinkRequest,
  ParseLinkResponse,
  BindTagsRequest,
  VoiceTranscribeRequest,
  VoiceTranscribeResponse,
} from '@shared/api.interface';

export function getFragments(params: FragmentListParams): Promise<FragmentListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.type) query.set('type', params.type);
  if (params.pillar) query.set('pillar', params.pillar);
  if (params.goalId) query.set('goalId', params.goalId);
  const qs = query.toString();
  return authRequest<FragmentListResponse>(
    `/api/fragments${qs ? `?${qs}` : ''}`,
    'GET',
  );
}

export function getFragment(id: string): Promise<Fragment> {
  return authRequest<Fragment>(`/api/fragments/${id}`, 'GET');
}

export function createFragment(data: CreateFragmentRequest): Promise<Fragment> {
  return authRequest<Fragment>('/api/fragments', 'POST', data);
}

export function updateFragment(id: string, data: UpdateFragmentRequest): Promise<Fragment> {
  return authRequest<Fragment>(`/api/fragments/${id}`, 'PATCH', data);
}

export function deleteFragment(id: string): Promise<void> {
  return authRequest<void>(`/api/fragments/${id}`, 'DELETE');
}

export function bindTags(fragmentId: string, tagIds: string[]): Promise<Fragment> {
  return authRequest<Fragment>(
    `/api/fragments/${fragmentId}/tags`,
    'POST',
    { tagIds } as BindTagsRequest,
  );
}

export function unbindTag(fragmentId: string, goalId: string): Promise<void> {
  return authRequest<void>(
    `/api/fragments/${fragmentId}/tags/${goalId}`,
    'DELETE',
  );
}

export function parseLink(url: string): Promise<ParseLinkResponse> {
  return authRequest<ParseLinkResponse>(
    '/api/fragments/parse-link',
    'POST',
    { url } as ParseLinkRequest,
  );
}

export function transcribeVoice(
  audioUrl: string,
  language = 'zh',
): Promise<VoiceTranscribeResponse> {
  return authRequest<VoiceTranscribeResponse>(
    '/api/fragments/transcribe-voice',
    'POST',
    { audioUrl, language } as VoiceTranscribeRequest,
  );
}
