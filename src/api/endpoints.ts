import { api, qs } from "./client";
import type {
  AccountDeletedResponse,
  AdminStats,
  AdminUserResponse,
  AdminUsersResponse,
  AuthResponse,
  Chapter,
  CompletionStatus,
  ContributorGrant,
  ContributorRole,
  CreatedChapter,
  CreatedNovel,
  FeaturedFlag,
  Genre,
  GenresResponse,
  HistoryResponse,
  InListResponse,
  ListResponse,
  ListType,
  MeResponse,
  NovelOrigin,
  NovelDetail,
  NovelSort,
  NovelStatus,
  NovelsResponse,
  PasswordChangeResponse,
  Progress,
  RecommendationsResponse,
  RelatedResponse,
  Role,
  TrashedNovel,
  UpdatedChapterContent,
  UpdatedChapterMeta,
  UpdatedNovel,
  UserStatus,
} from "./types";

// ── Auth ─────────────────────────────────────────────────────────────────
export function login(loginId: string, password: string): Promise<AuthResponse> {
  return api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginId, password }),
  });
}

export function register(data: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> {
  return api("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
}

export function fetchMe(): Promise<MeResponse> {
  return api("/api/auth/me");
}

// ── Account self-service ───────────────────────────────────────────────────
// All three act on the caller's own account (id comes from the token, never a
// path). Wrong-password re-auth returns 403, NOT 401, so it never trips the
// global 401 → logout handler in the client. See account_api_handoff.md §1.1.

// Edit displayName and/or email. `currentPassword` is required by the API only
// when `email` changes. Returns the fresh { user } (same shape as fetchMe).
export function updateProfile(data: {
  displayName?: string;
  email?: string;
  currentPassword?: string;
}): Promise<MeResponse> {
  return api("/api/auth/me", { method: "PATCH", body: JSON.stringify(data) });
}

export function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<PasswordChangeResponse> {
  return api("/api/auth/me/password", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// Re-auths with the current password. Irreversible — cascades the user's lists,
// progress, and history server-side.
export function deleteAccount(password: string): Promise<AccountDeletedResponse> {
  return api("/api/auth/me", {
    method: "DELETE",
    body: JSON.stringify({ password }),
  });
}

// ── Catalog ──────────────────────────────────────────────────────────────
export interface NovelsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: NovelSort;
  genre?: string;
  /** true → only admin-curated featured novels (homepage hero) */
  featured?: boolean;
  /** filter by completion state, e.g. "completed" (omit for all published) */
  status?: NonNullable<CompletionStatus>;
  /** filter by source language, e.g. "korean" (omit for all origins) */
  origin?: NonNullable<NovelOrigin>;
}

export function fetchNovels(query: NovelsQuery = {}): Promise<NovelsResponse> {
  return api(`/api/novels${qs({ ...query })}`);
}

export function fetchNovel(id: number): Promise<NovelDetail> {
  return api(`/api/novels/${id}`);
}

export function fetchRelated(id: number): Promise<RelatedResponse> {
  return api(`/api/novels/${id}/related`);
}

export function fetchChapter(id: number): Promise<Chapter> {
  return api(`/api/chapters/${id}`);
}

// Genres change rarely — cache each (status, origin) scoping for the session.
// Counts are per-filter (see /api/genres), so the cache key must include them.
const genresCache = new Map<string, Promise<Genre[]>>();
export function fetchGenres(
  status?: NonNullable<CompletionStatus>,
  origin?: NonNullable<NovelOrigin>,
): Promise<Genre[]> {
  const key = `${status ?? ""}|${origin ?? ""}`;
  let cached = genresCache.get(key);
  if (!cached) {
    cached = api<GenresResponse>(`/api/genres${qs({ status, origin })}`).then(
      (b) => b.genres,
    );
    cached.catch(() => genresCache.delete(key)); // let a failed fetch retry
    genresCache.set(key, cached);
  }
  return cached;
}

// Novel detail cache — the reader re-needs the chapter array on every
// prev/next navigation; don't refetch a ~700-chapter payload each time.
const novelCache = new Map<number, Promise<NovelDetail>>();
export function fetchNovelCached(id: number): Promise<NovelDetail> {
  let cached = novelCache.get(id);
  if (!cached) {
    cached = fetchNovel(id);
    cached.catch(() => novelCache.delete(id));
    novelCache.set(id, cached);
  }
  return cached;
}

// ── My library ───────────────────────────────────────────────────────────
export function addToList(type: ListType, novelId: number): Promise<InListResponse> {
  return api(`/api/me/lists/${type}/${novelId}`, { method: "POST" });
}

export function removeFromList(
  type: ListType,
  novelId: number,
): Promise<InListResponse> {
  return api(`/api/me/lists/${type}/${novelId}`, { method: "DELETE" });
}

export function checkList(type: ListType, novelId: number): Promise<InListResponse> {
  return api(`/api/me/lists/${type}/${novelId}`);
}

export function fetchList(
  type: ListType,
  page = 1,
  limit = 20,
): Promise<ListResponse> {
  return api(`/api/me/lists/${type}${qs({ page, limit })}`);
}

// ── Progress & history ───────────────────────────────────────────────────
export function saveProgress(
  novelId: number,
  chapterId: number,
): Promise<{ saved: boolean; novelId: number; chapterId: number }> {
  return api(`/api/me/progress/${novelId}`, {
    method: "PUT",
    body: JSON.stringify({ chapterId }),
  });
}

export function fetchProgress(novelId: number): Promise<Progress | null> {
  return api(`/api/me/progress/${novelId}`);
}

export function fetchHistory(page = 1, limit = 20): Promise<HistoryResponse> {
  return api(`/api/me/history${qs({ page, limit })}`);
}

// ── Recommendations ──────────────────────────────────────────────────────
export function fetchRecommendations(): Promise<RecommendationsResponse> {
  return api("/api/me/recommendations");
}

// ── Authoring (writer / translator) ──────────────────────────────────────
// Every write drops the reader-side novel cache so the detail page and the
// prev/next navigation see fresh titles/chapters after an edit.

export function createNovel(data: {
  title: string;
  description?: string;
  status?: NovelStatus;
}): Promise<CreatedNovel> {
  return api("/api/novels", { method: "POST", body: JSON.stringify(data) });
}

export function updateNovel(
  id: number,
  data: Partial<{ title: string; description: string; status: NovelStatus }>,
): Promise<UpdatedNovel> {
  return api<UpdatedNovel>(`/api/novels/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then((res) => {
    novelCache.delete(id);
    return res;
  });
}

export function createChapter(
  novelId: number,
  data: { name: string; content: string; index?: number },
): Promise<CreatedChapter> {
  return api<CreatedChapter>(`/api/novels/${novelId}/chapters`, {
    method: "POST",
    body: JSON.stringify(data),
  }).then((res) => {
    novelCache.delete(novelId);
    return res;
  });
}

export function updateChapterMeta(
  chapterId: number,
  data: Partial<{ name: string; index: number }>,
): Promise<UpdatedChapterMeta> {
  return api<UpdatedChapterMeta>(`/api/chapters/${chapterId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }).then((res) => {
    novelCache.delete(res.novelId);
    return res;
  });
}

export function updateChapterContent(
  chapterId: number,
  content: string,
): Promise<UpdatedChapterContent> {
  return api<UpdatedChapterContent>(`/api/chapters/${chapterId}/content`, {
    method: "PATCH",
    body: JSON.stringify({ content }),
  }).then((res) => {
    novelCache.delete(res.novelId);
    return res;
  });
}

// ── Admin ────────────────────────────────────────────────────────────────
export function fetchAdminStats(): Promise<AdminStats> {
  return api("/api/admin/stats");
}

export function fetchAdminUsers(
  query: { page?: number; limit?: number; search?: string } = {},
): Promise<AdminUsersResponse> {
  return api(`/api/admin/users${qs({ ...query })}`);
}

export function updateUserRole(
  userId: number,
  role: Role,
): Promise<AdminUserResponse> {
  return api(`/api/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export function updateUserStatus(
  userId: number,
  status: UserStatus,
): Promise<AdminUserResponse> {
  return api(`/api/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Soft delete — restore is updateNovel(id, { status: "publish" }), which
// admins can call on any novel (they bypass contributor checks).
export function trashNovel(id: number): Promise<TrashedNovel> {
  return api<TrashedNovel>(`/api/admin/novels/${id}`, {
    method: "DELETE",
  }).then((res) => {
    novelCache.delete(id);
    return res;
  });
}

export function setNovelFeatured(
  id: number,
  featured: boolean,
): Promise<FeaturedFlag> {
  return api(`/api/admin/novels/${id}/feature`, {
    method: "PATCH",
    body: JSON.stringify({ featured }),
  });
}

export function addContributor(data: {
  userId: number;
  novelId: number;
  role: ContributorRole;
}): Promise<ContributorGrant> {
  return api("/api/admin/contributors", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
