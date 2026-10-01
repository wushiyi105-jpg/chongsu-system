import type { PillarInfo } from '@shared/api.interface';

export const PILLARS: PillarInfo[] = [
  { key: 'cognition', name: '认知', color: '#2f66c9', meaning: '求知' },
  { key: 'meaning', name: '意义', color: '#e8a23a', meaning: '价值' },
  { key: 'energy', name: '能量', color: '#34a853', meaning: '活力' },
  { key: 'relation', name: '关系', color: '#1f8a4c', meaning: '联结' },
  { key: 'value', name: '价值', color: '#0a0a0a', meaning: '创造' },
];

export const PILLAR_COLOR_MAP: Record<string, string> = PILLARS.reduce(
  (acc: Record<string, string>, p: PillarInfo) => {
    acc[p.key] = p.color;
    return acc;
  },
  {},
);
