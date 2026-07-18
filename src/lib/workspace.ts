import type { NovelStatus } from "../api/types";

/**
 * Local "my novels" workspace — the stopgap for the missing GET /api/me/novels
 * endpoint (handoff §8.3): the API can't list a user's novels, and drafts 404
 * on the public detail route. So the studio remembers, per user, per device:
 *
 * - which novels the user created or chose to track, and
 * - the chapters created here (the only chapter list we have for drafts).
 *
 * Once the backend ships a my-novels endpoint this file can be deleted.
 */

export interface WorkspaceChapter {
  id: number;
  name: string;
  slug: string;
  index: number;
}

export interface WorkspaceNovel {
  id: number;
  title: string;
  slug: string;
  status: NovelStatus;
  /** last description we sent or loaded — prefills the draft editor */
  description: string;
  /** chapters created on this device; authoritative only while unpublished */
  chapters: WorkspaceChapter[];
  addedAt: string;
  updatedAt: string;
}

const keyFor = (userId: number) => `novvels_workspace_${userId}`;

export function loadWorkspace(userId: number): WorkspaceNovel[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as WorkspaceNovel[]) : [];
  } catch {
    return [];
  }
}

function save(userId: number, novels: WorkspaceNovel[]): WorkspaceNovel[] {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(novels));
  } catch {
    // quota/private-mode failures just lose the stopgap, not the app
  }
  return novels;
}

/** Insert or merge a novel record; returns the new list, newest-edit first. */
export function upsertWorkspaceNovel(
  userId: number,
  novel: Partial<WorkspaceNovel> & { id: number },
): WorkspaceNovel[] {
  const now = new Date().toISOString();
  const list = loadWorkspace(userId);
  const existing = list.find((n) => n.id === novel.id);
  const merged: WorkspaceNovel = {
    title: "Untitled",
    slug: "",
    status: "publish",
    description: "",
    chapters: [],
    addedAt: now,
    ...existing,
    ...novel,
    updatedAt: now,
  };
  const next = [merged, ...list.filter((n) => n.id !== novel.id)];
  return save(userId, next);
}

export function removeWorkspaceNovel(
  userId: number,
  novelId: number,
): WorkspaceNovel[] {
  return save(
    userId,
    loadWorkspace(userId).filter((n) => n.id !== novelId),
  );
}

/** Record a chapter created/renamed on this device under its novel. */
export function upsertWorkspaceChapter(
  userId: number,
  novelId: number,
  chapter: WorkspaceChapter,
): WorkspaceNovel[] {
  const list = loadWorkspace(userId);
  const novel = list.find((n) => n.id === novelId);
  if (!novel) return list;
  const chapters = [
    ...novel.chapters.filter((c) => c.id !== chapter.id),
    chapter,
  ].sort((a, b) => a.index - b.index);
  return upsertWorkspaceNovel(userId, { id: novelId, chapters });
}
