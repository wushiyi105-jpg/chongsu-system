import { authRequest } from './index';
import type { ExportRequest, ExportResponse } from '@shared/api.interface';

export function exportData(req: ExportRequest): Promise<ExportResponse> {
  return authRequest<ExportResponse>('/api/export', 'POST', req);
}
