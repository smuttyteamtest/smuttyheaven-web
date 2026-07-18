import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  fetchNovels,
  setNovelFeatured,
  trashNovel,
  updateNovel,
} from "../api/endpoints";
import type { Novel } from "../api/types";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import { formatDate, formatNumber, novelPath } from "../lib/format";
import Pager from "./Pager";
import { SkeletonLines } from "./Skeletons";

const PAGE_SIZE = 20;

export default function AdminNovelsPanel() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(query.trim());

  // The public catalog is the only novel listing the API has; 462 novels, so
  // an unfiltered latest-first list is fine for moderation browsing.
  const novels = useAsync(
    () => fetchNovels({ search, page, limit: PAGE_SIZE, sort: "latest" }),
    [search, page],
  );

  // Trashed novels 404 out of the catalog immediately — overlay the rows we
  // trashed this session so they stay visible with a Restore button.
  const [trashed, setTrashed] = useState<Record<number, boolean>>({});
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function begin(key: string) {
    setBusyKey(key);
    setNotice(null);
    setError(null);
  }

  async function feature(novel: Novel, featured: boolean) {
    begin(`feature:${novel.id}`);
    try {
      await setNovelFeatured(novel.id, featured);
      setNotice(
        featured
          ? `“${novel.title}” is featured. (Nothing public reads the flag yet — the featured rail is blocked on the API, issue #4.)`
          : `“${novel.title}” is no longer featured.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feature toggle failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function trash(novel: Novel) {
    begin(`trash:${novel.id}`);
    setConfirmId(null);
    try {
      await trashNovel(novel.id);
      setTrashed((t) => ({ ...t, [novel.id]: true }));
      setNotice(
        `“${novel.title}” moved to trash — hidden from readers immediately. ` +
          `Nothing is erased; restore it any time.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trash failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function restore(id: number, title?: string) {
    begin(`restore:${id}`);
    try {
      const res = await updateNovel(id, { status: "publish" });
      setTrashed((t) => ({ ...t, [id]: false }));
      setNotice(`“${title ?? res.title}” is published again.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setBusyKey(null);
    }
  }

  // Trashed novels can't be found via search — offer restore by id.
  const [restoreIdInput, setRestoreIdInput] = useState("");

  function onRestoreById(e: FormEvent) {
    e.preventDefault();
    const id = Number(restoreIdInput);
    if (!Number.isInteger(id) || id <= 0) {
      setError("Enter a numeric novel id.");
      return;
    }
    setRestoreIdInput("");
    void restore(id);
  }

  return (
    <section>
      <div className="note-banner">
        The API can't report which novels are already featured (no public read
        of the flag yet), so Feature/Unfeature are blind toggles — both are
        idempotent and safe to press twice.
      </div>

      <div className="admin-toolbar">
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search titles…"
          aria-label="Search novels"
        />
        {novels.data && (
          <span className="text-small text-tertiary">
            {formatNumber(novels.data.total)} novel
            {novels.data.total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {notice && <div className="form-success">{notice}</div>}
      {error && <div className="form-error">{error}</div>}

      {novels.error ? (
        <div className="error-state">
          <p>{novels.error}</p>
        </div>
      ) : novels.loading ? (
        <SkeletonLines count={8} />
      ) : (novels.data?.novels.length ?? 0) === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden>
            🌑
          </span>
          <p>No published titles match{search ? ` “${search}”` : ""}.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Novel</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {novels.data!.novels.map((novel) => {
                const isTrashed = trashed[novel.id] === true;
                const busy = busyKey?.endsWith(`:${novel.id}`) ?? false;
                return (
                  <tr key={novel.id}>
                    <td>
                      <Link
                        to={novelPath(novel.id, novel.slug)}
                        className="admin-user-name"
                      >
                        {novel.title}
                      </Link>
                      <span className="admin-user-sub">
                        #{novel.id}
                        {isTrashed && " · trashed"}
                      </span>
                    </td>
                    <td className="text-tertiary">{formatDate(novel.date)}</td>
                    <td>
                      <div className="admin-actions">
                        {isTrashed ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => restore(novel.id, novel.title)}
                          >
                            {busy ? "Restoring…" : "Restore"}
                          </button>
                        ) : (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              disabled={busy}
                              onClick={() => feature(novel, true)}
                            >
                              ✦ Feature
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              disabled={busy}
                              onClick={() => feature(novel, false)}
                            >
                              Unfeature
                            </button>
                            {confirmId === novel.id ? (
                              <button
                                className="btn btn-destructive btn-sm"
                                disabled={busy}
                                onClick={() => trash(novel)}
                              >
                                {busy ? "Trashing…" : "Confirm trash?"}
                              </button>
                            ) : (
                              <button
                                className="btn btn-ghost btn-sm"
                                disabled={busy}
                                onClick={() => setConfirmId(novel.id)}
                              >
                                Trash
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager
        page={page}
        total={novels.data?.total ?? 0}
        limit={PAGE_SIZE}
        onPage={(p) => {
          setPage(p);
          setConfirmId(null);
        }}
      />

      <form
        className="card admin-restore-card"
        onSubmit={onRestoreById}
      >
        <h4 style={{ marginBottom: "var(--sp-2)" }}>Restore by id</h4>
        <p className="text-small text-secondary">
          Trashed novels disappear from the search above. If you know the id
          (it's in the trash confirmation, or ask whoever trashed it), restore
          it here.
        </p>
        <div className="admin-restore-row">
          <input
            className="input"
            inputMode="numeric"
            value={restoreIdInput}
            onChange={(e) => setRestoreIdInput(e.target.value)}
            placeholder="Novel id, e.g. 8757"
            aria-label="Novel id to restore"
          />
          <button
            className="btn btn-secondary btn-md"
            disabled={busyKey?.startsWith("restore:") ?? false}
          >
            Restore
          </button>
        </div>
      </form>
    </section>
  );
}
