export type PillarKey = 'cognition' | 'meaning' | 'energy' | 'relation' | 'value';

export interface PillarInfo {
  key: PillarKey;
  name: string;
  color: string;
  meaning: string;
}

export interface UserInfo {
  id: string;
  phone: string;
  nickname: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  parentId: string | null;
  pillar: PillarKey | null;
  name: string;
  description: string | null;
  color: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  children?: Goal[];
  fragmentCount?: number;
}

export type FragmentType = 'text' | 'link' | 'voice';

export interface ImageItem {
  url: string;
  width?: number;
  height?: number;
  size?: number;
}

export interface Fragment {
  id: string;
  userId: string;
  type: FragmentType;
  content: string | null;
  rawUrl: string | null;
  title: string | null;
  summary: string | null;
  cover: string | null;
  audioUrl: string | null;
  images: ImageItem[];
  createdAt: string;
  updatedAt: string;
  tags?: Goal[];
  tagIds?: string[];
}

export interface GraphNodeFragment {
  id: string;
  title: string | null;
  content: string | null;
  type: FragmentType;
  createdAt: string;
}

export interface GraphNode {
  id: string;
  name: string;
  pillar: PillarKey | null;
  color: string;
  size: number;
  fragmentCount: number;
  fragmentIds: string[];
  fragments: GraphNodeFragment[];
}

export interface GraphEdge {
  source: string;
  target: string;
  fragmentId: string;
  weight: number;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DashboardData {
  pillars: Array<{
    key: PillarKey;
    name: string;
    color: string;
    goalCount: number;
    fragmentCount: number;
  }>;
  totalGoals: number;
  totalFragments: number;
  recentFragments: Fragment[];
  storageUsedBytes: number;
  storageQuotaBytes: number;
}

// --- Auth ---

export interface SendCodeRequest {
  phone: string;
}

export interface SendCodeResponse {
  expiresIn: number;
  devCode?: string;
}

export interface LoginRequest {
  phone: string;
  code: string;
}

export interface LoginResponse {
  token: string;
  user: UserInfo;
  isNewUser: boolean;
}

// --- Goals ---

export interface CreateGoalRequest {
  parentId?: string | null;
  pillar?: PillarKey | null;
  name: string;
  description?: string | null;
  color?: string | null;
}

export interface UpdateGoalRequest {
  name?: string;
  description?: string | null;
  color?: string | null;
  parentId?: string | null;
  pillar?: PillarKey | null;
  archived?: boolean;
}

export interface MergeGoalsRequest {
  sourceId: string;
  targetId: string;
}

export interface GoalsListResponse {
  items: Goal[];
}

// --- Fragments ---

export interface CreateFragmentRequest {
  type?: FragmentType;
  content?: string | null;
  rawUrl?: string | null;
  title?: string | null;
  summary?: string | null;
  cover?: string | null;
  audioUrl?: string | null;
  images?: ImageItem[];
  tagIds?: string[];
}

export interface UpdateFragmentRequest {
  content?: string | null;
  title?: string | null;
  summary?: string | null;
  cover?: string | null;
  rawUrl?: string | null;
  audioUrl?: string | null;
  images?: ImageItem[];
}

export interface FragmentListParams {
  page?: number;
  pageSize?: number;
  type?: FragmentType;
  pillar?: PillarKey;
  goalId?: string;
}

export interface FragmentListResponse {
  items: Fragment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ParseLinkRequest {
  url: string;
}

export interface ParseLinkResponse {
  title: string | null;
  summary: string | null;
  cover: string | null;
  author?: string | null;
  source?: string | null;
  dataSource?: string | null;
  error?: string | null;
}

export interface VoiceTranscribeRequest {
  audioUrl: string;
  language?: string;
}

export interface VoiceTranscribeResponse {
  text: string;
}

export interface BindTagsRequest {
  tagIds: string[];
}

// --- Export ---

export type ExportScope = 'tag' | 'pillar' | 'all';
export type ExportFormat = 'markdown' | 'json' | 'text';

export interface ExportRequest {
  scope: ExportScope;
  format: ExportFormat;
  tagId?: string;
  pillar?: PillarKey;
}

export interface ExportResponse {
  filename: string;
  content: string;
  contentType: string;
}

// --- Me ---

export interface UpdateMeRequest {
  nickname?: string;
  avatarUrl?: string;
}
