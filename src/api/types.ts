// API types — mirror of novvels-api (see frontend_handoff.md §5)

// ── Enums ────────────────────────────────────────────────────────────────
export type Role = "reader" | "writer" | "translator" | "admin";
export type UserStatus = "active" | "suspended";
export type ContributorRole = "writer" | "translator";
export type ListType = "saved" | "favourite" | "archived";
export type NovelSort = "latest" | "title" | "popular";
export type NovelStatus = "publish" | "draft" | "trash";

// ── Shared ───────────────────────────────────────────────────────────────
export interface ApiErrorBody {
  error: string;
}

export interface Paginated {
  page: number;
  limit: number;
  total: number;
}

// ── Auth ─────────────────────────────────────────────────────────────────
export interface PublicUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  registered: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}

// ── Catalog ──────────────────────────────────────────────────────────────
export interface Novel {
  id: number;
  title: string;
  slug: string;
  date: string;
}

export interface NovelDetail extends Novel {
  description: string; // HTML — sanitize
  chapters: ChapterSummary[];
}

export interface ChapterSummary {
  id: number;
  name: string;
  slug: string;
  index: number; // authoritative reading order
  date: string;
}

export interface Chapter {
  id: number;
  name: string;
  content: string | null; // HTML — sanitize; null = text missing
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// ── Reader library ───────────────────────────────────────────────────────
export interface ListNovel {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  addedAt: string;
}

export interface Progress {
  novelId: number;
  chapterId: number;
  chapterName: string | null;
  chapterIndex: number | null;
  updatedAt: string;
}

export interface HistoryEntry {
  novelId: number;
  title: string;
  slug: string;
  cover: string | null;
  chapterId: number;
  chapterName: string | null;
  chapterIndex: number | null;
  updatedAt: string;
}

export interface Recommendation {
  id: number;
  title: string;
  slug: string;
  cover: string | null;
  reason: string; // display-ready, e.g. "Because you read Fantasy"
}

// ── Authoring (writer / translator) ──────────────────────────────────────
export interface CreatedNovel {
  id: number;
  title: string;
  slug: string;
  status: NovelStatus;
}

export interface UpdatedNovel extends CreatedNovel {
  description: string;
}

export interface CreatedChapter {
  id: number;
  novelId: number;
  name: string;
  slug: string;
  index: number;
}

export interface UpdatedChapterMeta {
  id: number;
  novelId: number;
  name: string;
  index: number;
}

export interface UpdatedChapterContent {
  id: number;
  novelId: number;
  updated: boolean;
}

// ── Admin ────────────────────────────────────────────────────────────────
export interface AdminUser extends PublicUser {
  status: UserStatus;
}

export interface AdminStats {
  users: { total: number; byRole: Record<Role, number> };
  novels: { total: number; published: number };
  chapters: { total: number };
  recentSignups: { last7Days: number; last30Days: number };
}

export interface FeaturedFlag {
  id: number;
  featured: boolean;
}

export interface TrashedNovel {
  id: number;
  status: NovelStatus;
}

export interface ContributorGrant {
  novelId: number;
  userId: number;
  role: ContributorRole;
}

// ── Response envelopes ───────────────────────────────────────────────────
export interface NovelsResponse extends Paginated {
  novels: Novel[];
}

export interface RelatedResponse {
  novels: Novel[];
}

export interface GenresResponse {
  genres: Genre[];
}

export interface ListResponse extends Paginated {
  novels: ListNovel[];
}

export interface HistoryResponse extends Paginated {
  history: HistoryEntry[];
}

export interface RecommendationsResponse {
  recommendations: Recommendation[];
}

export interface InListResponse {
  inList: boolean;
}

export interface AdminUsersResponse extends Paginated {
  users: AdminUser[];
}

export interface AdminUserResponse {
  user: AdminUser;
}
