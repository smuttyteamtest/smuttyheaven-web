import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { createNovel, fetchNovels } from "../api/endpoints";
import type { Novel, NovelStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import StatusChip from "../components/StatusChip";
import { formatDate, novelPath } from "../lib/format";
import { canWrite, explain403 } from "../lib/roles";
import {
  loadWorkspace,
  removeWorkspaceNovel,
  upsertWorkspaceNovel,
  type WorkspaceNovel,
} from "../lib/workspace";

/**
 * The writer/translator dashboard. The API has no "my novels" endpoint yet
 * (handoff §8.3), so the list is a per-user localStorage workspace: novels
 * created here plus published novels the user chose to track.
 */
export default function StudioPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.id;
  const writer = user ? canWrite(user.role) : false;

  const [novels, setNovels] = useState<WorkspaceNovel[]>(() =>
    uid ? loadWorkspace(uid) : [],
  );

  // ── Create novel (writers/admins) ──────────────────────────────────────
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<NovelStatus>("draft");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setCreateError("Give your novel a title.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await createNovel({
        title: trimmed,
        description: description.trim() || undefined,
        status,
      });
      upsertWorkspaceNovel(uid, { ...res, description: description.trim() });
      navigate(`/studio/novel/${res.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setCreateError(
        err instanceof ApiError && err.status === 403
          ? explain403(message)
          : message,
      );
    } finally {
      setCreating(false);
    }
  }

  // ── Track an existing (published) novel ────────────────────────────────
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query);
  const results = useAsync(
    () => fetchNovels({ search: debounced.trim(), limit: 8 }),
    [debounced],
    debounced.trim().length > 0,
  );

  function track(novel: Novel) {
    if (!uid) return;
    setNovels(
      upsertWorkspaceNovel(uid, {
        id: novel.id,
        title: novel.title,
        slug: novel.slug,
        status: "publish",
      }),
    );
  }

  function untrack(novelId: number) {
    if (!uid) return;
    setNovels(removeWorkspaceNovel(uid, novelId));
  }

  if (!user || !uid) return null; // RequireRole guarantees a user

  const tracked = new Set(novels.map((n) => n.id));

  return (
    <div className="container">
      <h2 style={{ margin: "var(--sp-5) 0 var(--sp-2)" }}>Studio</h2>
      <p className="text-secondary">
        {writer
          ? "Write novels, publish chapters, and manage your drafts."
          : "Track the novels you've been assigned to and edit their chapter text."}
      </p>
      <div className="note-banner">
        The API can't list your novels yet, so this workspace lives in this
        browser only — novels you create or track here are remembered on this
        device. (A <code>GET /api/me/novels</code> endpoint has been requested
        from the backend.)
      </div>

      <div className="studio-layout">
        <section>
          <h3 style={{ marginBottom: "var(--sp-3)" }}>Your novels</h3>
          {novels.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden>
                🪐
              </span>
              <p>
                {writer
                  ? "Nothing here yet — create a novel, or track an existing one you contribute to."
                  : "Nothing here yet — search for a novel you've been assigned to and track it."}
              </p>
            </div>
          ) : (
            <div className="studio-list">
              {novels.map((novel) => (
                <div className="card studio-item" key={novel.id}>
                  <div className="studio-item-info">
                    <Link
                      to={`/studio/novel/${novel.id}`}
                      className="studio-item-title"
                    >
                      {novel.title}
                    </Link>
                    <div className="studio-item-meta">
                      <StatusChip status={novel.status} />
                      <span className="text-tiny text-tertiary">
                        Updated {formatDate(novel.updatedAt)}
                        {novel.chapters.length > 0 &&
                          ` · ${novel.chapters.length} chapter${
                            novel.chapters.length === 1 ? "" : "s"
                          } added here`}
                      </span>
                    </div>
                  </div>
                  <div className="studio-item-actions">
                    <Link
                      to={`/studio/novel/${novel.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Open editor
                    </Link>
                    {novel.status === "publish" && (
                      <Link
                        to={novelPath(novel.id, novel.slug)}
                        className="btn btn-ghost btn-sm"
                      >
                        View page
                      </Link>
                    )}
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => untrack(novel.id)}
                      title="Remove from this device's workspace (the novel itself is untouched)"
                    >
                      Untrack
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="studio-side">
          {writer && (
            <form className="card" onSubmit={onCreate}>
              <h3 style={{ marginBottom: "var(--sp-3)" }}>Create a novel</h3>
              {createError && <div className="form-error">{createError}</div>}
              <div className="field">
                <label className="field-label" htmlFor="new-title">
                  Title
                </label>
                <input
                  id="new-title"
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                  placeholder="My New Novel"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-desc">
                  Synopsis (HTML allowed)
                </label>
                <textarea
                  id="new-desc"
                  className="input textarea"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="<p>Starting over once more…</p>"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="new-status">
                  Status
                </label>
                <select
                  id="new-status"
                  className="input"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as NovelStatus)}
                >
                  <option value="draft">Draft — hidden until you publish</option>
                  <option value="publish">Published — visible right away</option>
                </select>
              </div>
              <button
                className="btn btn-primary btn-md"
                style={{ width: "100%" }}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create novel ✦"}
              </button>
            </form>
          )}

          <div className="card" style={{ marginTop: "var(--sp-3)" }}>
            <h3 style={{ marginBottom: "var(--sp-2)" }}>
              Track an existing novel
            </h3>
            <p className="text-small text-secondary">
              {writer
                ? "Contributor on a novel you didn't create here? Find it and add it to your workspace."
                : "Find a novel an admin assigned you to and add it to your workspace."}
            </p>
            <input
              className="input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search titles…"
              aria-label="Search novels to track"
            />
            {results.loading && (
              <p className="text-small text-tertiary" style={{ marginTop: "var(--sp-2)" }}>
                Searching…
              </p>
            )}
            {results.error && (
              <p className="text-small" style={{ marginTop: "var(--sp-2)", color: "var(--error)" }}>
                {results.error}
              </p>
            )}
            {results.data && (
              <ul className="track-results">
                {results.data.novels.length === 0 && (
                  <li className="text-small text-tertiary">No titles match.</li>
                )}
                {results.data.novels.map((novel) => (
                  <li key={novel.id}>
                    <span className="track-result-title">{novel.title}</span>
                    {tracked.has(novel.id) ? (
                      <span className="text-tiny text-tertiary">Tracked ✓</span>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => track(novel)}
                      >
                        Track
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
