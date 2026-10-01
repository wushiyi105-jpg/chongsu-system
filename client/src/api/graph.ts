import { authRequest } from './index';
import type { GraphData, DashboardData } from '@shared/api.interface';

export function getGraph(): Promise<GraphData> {
  return authRequest<GraphData>('/api/graph', 'GET');
}

export function getDashboard(): Promise<DashboardData> {
  return authRequest<DashboardData>('/api/dashboard', 'GET');
}
