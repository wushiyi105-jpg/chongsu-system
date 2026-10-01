import { authRequest } from './index';
import type {
  PillarInfo,
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest,
  MergeGoalsRequest,
} from '@shared/api.interface';

export function getPillars(): Promise<PillarInfo[]> {
  return authRequest<PillarInfo[]>('/api/pillars', 'GET');
}

export function getGoals(): Promise<Goal[]> {
  return authRequest<Goal[]>('/api/goals', 'GET');
}

export function getGoal(id: string): Promise<Goal> {
  return authRequest<Goal>(`/api/goals/${id}`, 'GET');
}

export function createGoal(data: CreateGoalRequest): Promise<Goal> {
  return authRequest<Goal>('/api/goals', 'POST', data);
}

export function updateGoal(id: string, data: UpdateGoalRequest): Promise<Goal> {
  return authRequest<Goal>(`/api/goals/${id}`, 'PATCH', data);
}

export function deleteGoal(id: string): Promise<void> {
  return authRequest<void>(`/api/goals/${id}`, 'DELETE');
}

export function mergeGoals(sourceId: string, targetId: string): Promise<void> {
  return authRequest<void>('/api/goals/merge', 'POST', { sourceId, targetId } as MergeGoalsRequest);
}
