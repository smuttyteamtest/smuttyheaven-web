import { api, qs } from "./client";
import type {
  AuthResponse,
  Chapter,
  CreatedChapter,
  CreatedNovel,
  Genre,
  GenresResponse,
  HistoryResponse,
  InListResponse,
  ListResponse,
  ListType,
  MeResponse,
  NovelDetail,
  NovelSort,
  NovelStatus,
  NovelsResponse,
  Progress,
  RecommendationsResponse,
  RelatedResponse,
  UpdatedChapterContent,
  UpdatedChapterMeta,
  UpdatedNovel,
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

// ── Catalog ──────────────────────────────────────────────────────────────
export interface NovelsQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?: NovelSort;
  genre?: string;
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

// Genres change rarely — cache the promise for the session.
let genresCache: Promise<Genre[]> | null = null;
export function fetchGenres(): Promise<Genre[]> {
  genresCache ??= api<GenresResponse>("/api/genres").then((b) => b.genres);
  genresCache.catch(() => {
    genresCache = null; // let a failed fetch retry next time
  });
  return genresCache;
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
