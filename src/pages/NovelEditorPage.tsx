import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { fetchNovel, updateNovel } from "../api/endpoints";
import type { ChapterSummary, NovelDetail, NovelStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { usePageMeta } from "../hooks/usePageMeta";
import ChapterEditorPanel, {
  type SavedChapter,
} from "../components/ChapterEditorPanel";
import { SkeletonLines } from "../components/Skeletons";
import StatusChip from "../components/StatusChip";
import { formatDate, novelPath } from "../lib/format";
import { canWrite, explain403 } from "../lib/roles";
import {
  loadWorkspace,
  upsertWorkspaceChapter,
  upsertWorkspaceNovel,
  type WorkspaceNovel,
} from "../lib/workspace";

const PER_PAGE = 100;

interface DetailsForm {
  title: string;
  description: string;
  status: NovelStatus;
}

export default function NovelEditorPage() {
  const { id } = useParams();
  const novelId = Number(id);
  const { user } = useAuth();
  const uid = user?.id;
  const manage = user ? canWrite(user.role) : false;

  const [local, setLocal] = useState<WorkspaceNovel | null>(() =>
    uid ? loadWorkspace(uid).find((n) => n.id === novelId) ?? null : null,
  );
  const [nonce, setNonce] = useState(0);

  // Drafts and trashed novels 404 on the public detail route (handoff §8.3),
  // so a 404 falls back to the device-local workspace record.
  const detail = useAsync<{ novel: NovelDetail | null }>(
    async () => {
      try {
        return { novel: await fetchNovel(novelId) };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404)
          return { novel: null };
        throw err;
      }
    },
    [novelId, nonce],
    Number.isFinite(novelId),
  );
  const server = detail.data?.novel ?? null;
  const settled = detail.data !== undefined;
  const localMode = settled && !server;

  const editingTitle = server?.title ?? local?.title;
  usePageMeta({
    title: editingTitle ? `${editingTitle} · Studio` : "Studio",
  });

  // ── Novel details form (writers/admins) ────────────────────────────────
  const [form, setForm] = useState<DetailsForm | null>(null);
  const [baseline, setBaseline] = useState<DetailsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // ── Chapters ───────────────────────────────────────────────────────────
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [editing, setEditing] = useState<ChapterSummary | "new" | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  // Seed form + chapter list once per (re)load. A published novel is the
  // source of truth; otherwise the local workspace record is all we have.
  useEffect(() => {
    if (!settled) return;
    const seed: DetailsForm | null = server
      ? {
          title: server.title,
          description: server.description ?? "",
          status: "publish",
        }
      : local
        ? {
            title: local.title,
            description: local.description,
            status: local.status,
          }
        : null;
    setForm(seed);
    setBaseline(seed);
    setChapters(
      server
        ? [...server.chapters].sort((a, b) => a.index - b.index)
        : (local?.chapters ?? []).map((c) => ({ ...c, date: "" })),
    );
    setEditing(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data]);

  /** Make sure this novel is in the device workspace before recording edits. */
  function ensureTracked(): void {
    if (!uid || local || !server) return;
    const list = upsertWorkspaceNovel(uid, {
      id: novelId,
      title: server.title,
      slug: server.slug,
      status: "publish",
      description: server.description ?? "",
    });
    setLocal(list.find((n) => n.id === novelId) ?? null);
  }

  async function onSaveDetails(e: FormEvent) {
    e.preventDefault();
    if (!form || !uid) return;
    setSaveError(null);
    setSaveNotice(null);

    const title = form.title.trim();
    if (!title) {
      setSaveError("Title can't be empty.");
      return;
    }
    const patch: Partial<DetailsForm> = {};
    if (!baseline || title !== baseline.title) patch.title = title;
    if (!baseline || form.description !== baseline.description)
      patch.description = form.description;
    if (!baseline || form.status !== baseline.status)
      patch.status = form.status;
    if (Object.keys(patch).length === 0) {
      setSaveNotice("Nothing changed.");
      return;
    }
    if (
      patch.status === "trash" &&
      !window.confirm(
        "Trash this novel? It disappears for readers immediately — you can restore it from here later.",
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      const res = await updateNovel(novelId, patch);
      ensureTracked();
      const list = upsertWorkspaceNovel(uid, {
        id: novelId,
        title: res.title,
        slug: res.slug,
        status: res.status,
        description: res.description ?? "",
      });
      setLocal(list.find((n) => n.id === novelId) ?? null);
      const saved: DetailsForm = {
        title: res.title,
        description: res.description ?? "",
        status: res.status,
      };
      setForm(saved);
      setBaseline(saved);
      setSaveNotice("Saved ✦");
      // Visibility flipped (published ↔ hidden) — reload from the server.
      if (patch.status !== undefined) setNonce((n) => n + 1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setSaveError(
        err instanceof ApiError && err.status === 403
          ? explain403(message)
          : message,
      );
    } finally {
      setSaving(false);
    }
  }

  function onChapterSaved(chapter: SavedChapter) {
    ensureTracked();
    if (uid) {
      const list = upsertWorkspaceChapter(uid, novelId, chapter);
      setLocal(list.find((n) => n.id === novelId) ?? null);
    }
    setChapters((prev) => {
      const date =
        prev.find((c) => c.id === chapter.id)?.date ??
        new Date().toISOString();
      return [...prev.filter((c) => c.id !== chapter.id), { ...chapter, date }]
        .sort((a, b) => a.index - b.index);
    });
    setEditing((cur) =>
      cur !== null && cur !== "new" && cur.id === chapter.id
        ? { ...cur, name: chapter.name, index: chapter.index }
        : cur,
    );
  }

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle
      ? chapters.filter((c) => c.name.toLowerCase().includes(needle))
      : chapters;
  }, [chapters, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  // ── Guard states ───────────────────────────────────────────────────────
  if (!Number.isFinite(novelId)) {
    return (
      <div className="container error-state">
        <p>That novel link doesn't look right.</p>
        <Link to="/studio" className="btn btn-secondary btn-md">
          Back to Studio
        </Link>
      </div>
    );
  }
  if (detail.error) {
    return (
      <div className="container error-state">
        <p>{detail.error}</p>
        <button className="btn btn-secondary btn-md" onClick={detail.reload}>
          Retry
        </button>
      </div>
    );
  }
  if (!settled) {
    return (
      <div className="container">
        <SkeletonLines count={8} />
      </div>
    );
  }
  if (localMode && !local) {
    return (
      <div className="container error-state">
        <p>
          This novel isn't publicly visible (draft or trashed), and it wasn't
          created on this device — the API has no endpoint to load it yet.
        </p>
        <Link to="/studio" className="btn btn-secondary btn-md">
          Back to Studio
        </Link>
      </div>
    );
  }

  const displayTitle = form?.title ?? server?.title ?? local?.title ?? "";
  const status: NovelStatus = server ? "publish" : local?.status ?? "publish";
  const slug = server?.slug ?? local?.slug;

  return (
    <div className="container">
      <div className="editor-head">
        <Link to="/studio" className="text-small">
          ← Studio
        </Link>
        <div className="editor-head-title">
          <h2>{displayTitle}</h2>
          <StatusChip status={baseline?.status ?? status} />
        </div>
        {!localMode && (
          <Link
            to={novelPath(novelId, slug)}
            className="btn btn-ghost btn-sm"
          >
            View public page
          </Link>
        )}
      </div>

      {localMode && (
        <div className="warn-banner">
          {status === "trash"
            ? "This novel is trashed — hidden from readers everywhere. Set the status to Published to restore it."
            : "This novel isn't publicly visible, and the API can't list an unpublished novel's chapters — showing only chapters created on this device."}
        </div>
      )}

      <div className="editor-layout">
        <aside className="editor-side">
          {manage && form ? (
            <form className="card" onSubmit={onSaveDetails}>
              <h3 style={{ marginBottom: "var(--sp-3)" }}>Novel details</h3>
              {saveError && <div className="form-error">{saveError}</div>}
              {saveNotice && <div className="form-success">{saveNotice}</div>}
              <div className="field">
                <label className="field-label" htmlFor="novel-title">
                  Title
                </label>
                <input
                  id="novel-title"
                  className="input"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  maxLength={255}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="novel-desc">
                  Synopsis (HTML allowed)
                </label>
                <textarea
                  id="novel-desc"
                  className="input textarea"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <div className="field-help">
                  Sanitized before it's shown to readers.
                </div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="novel-status">
                  Status
                </label>
                <select
                  id="novel-status"
                  className="input"
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as NovelStatus })
                  }
                >
                  <option value="publish">Published</option>
                  <option value="draft">Draft (hidden)</option>
                  <option value="trash">Trashed (soft delete)</option>
                </select>
                <div className="field-help">
                  Trash hides the novel from readers; nothing is erased and you
                  can restore it here anytime.
                </div>
              </div>
              <button
                className="btn btn-primary btn-md"
                style={{ width: "100%" }}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save details"}
              </button>
            </form>
          ) : (
            <div className="card">
              <h3 style={{ marginBottom: "var(--sp-2)" }}>Novel details</h3>
              <p className="text-small text-secondary">
                Translators can edit chapter text only — pick a chapter on the
                right. Ask a writer or admin to change the title, synopsis, or
                status.
              </p>
              {server && (
                <p className="text-tiny text-tertiary">
                  {chapters.length} chapters · added {formatDate(server.date)}
                </p>
              )}
            </div>
          )}
        </aside>

        <section>
          <div className="rail-header">
            <h3>
              Chapters{" "}
              <span className="text-small text-tertiary">
                ({chapters.length})
              </span>
            </h3>
            {manage && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => setEditing("new")}
              >
                + New chapter
              </button>
            )}
          </div>

          {editing !== null && (
            <ChapterEditorPanel
              key={editing === "new" ? "new" : editing.id}
              novelId={novelId}
              chapter={editing === "new" ? null : editing}
              role={user!.role}
              onSaved={onChapterSaved}
              onClose={() => setEditing(null)}
            />
          )}

          {chapters.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden>
                📜
              </span>
              <p>
                {manage
                  ? "No chapters yet — add the first one."
                  : "No chapters to edit here yet."}
              </p>
            </div>
          ) : (
            <>
              <div className="chapter-toolbar">
                <input
                  className="input"
                  type="search"
                  placeholder="Filter chapters…"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter chapters by name"
                />
                {pageCount > 1 && (
                  <select
                    className="input"
                    style={{ maxWidth: 180 }}
                    value={safePage}
                    onChange={(e) => setPage(Number(e.target.value))}
                    aria-label="Chapter page"
                  >
                    {Array.from({ length: pageCount }, (_, i) => {
                      const first = i * PER_PAGE + 1;
                      const last = Math.min(
                        (i + 1) * PER_PAGE,
                        filtered.length,
                      );
                      return (
                        <option key={i} value={i + 1}>
                          {first}–{last}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {visible.length === 0 ? (
                <p className="text-secondary">No chapters match.</p>
              ) : (
                <ol className="chapter-list">
                  {visible.map((chapter) => (
                    <li
                      key={chapter.id}
                      className={
                        editing !== null &&
                        editing !== "new" &&
                        editing.id === chapter.id
                          ? "is-current"
                          : undefined
                      }
                    >
                      <button
                        type="button"
                        className="chapter-row"
                        onClick={() => setEditing(chapter)}
                      >
                        <span className="chapter-num">
                          #{chapter.index}
                        </span>
                        <span className="chapter-name">{chapter.name}</span>
                        <span className="chapter-edit-hint">
                          {manage ? "Edit ✎" : "Edit text ✎"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
