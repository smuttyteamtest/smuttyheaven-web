import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ChapterSummary } from "../api/types";
import { formatDate, readerPath } from "../lib/format";

const PER_PAGE = 100;

interface ChapterListProps {
  novelId: number;
  /** full chapter array from GET /api/novels/:id */
  chapters: ChapterSummary[];
  /** chapter id of the user's saved progress, to highlight */
  currentChapterId?: number;
}

/**
 * Novels here average ~700 chapters (some 2,000+), so the list is windowed
 * client-side: sorted by `index`, filtered, and paged 100 at a time.
 */
export default function ChapterList({
  novelId,
  chapters,
  currentChapterId,
}: ChapterListProps) {
  const [descending, setDescending] = useState(false);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);

  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.index - b.index),
    [chapters],
  );

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const base = needle
      ? sorted.filter((c) => c.name.toLowerCase().includes(needle))
      : sorted;
    return descending ? [...base].reverse() : base;
  }, [sorted, filter, descending]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  return (
    <section>
      <div className="rail-header" style={{ marginTop: "var(--sp-5)" }}>
        <h3>
          Chapters{" "}
          <span className="text-small text-tertiary">({chapters.length})</span>
        </h3>
      </div>

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
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => {
            setDescending((d) => !d);
            setPage(1);
          }}
        >
          {descending ? "Newest first ↓" : "Oldest first ↑"}
        </button>
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
              const last = Math.min((i + 1) * PER_PAGE, filtered.length);
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
              className={chapter.id === currentChapterId ? "is-current" : undefined}
            >
              <Link to={readerPath(novelId, chapter.id)}>
                <span className="chapter-num">#{chapter.index + 1}</span>
                <span className="chapter-name">{chapter.name}</span>
                {chapter.id === currentChapterId && (
                  <span className="status-chip is-pending">Reading</span>
                )}
                <span className="chapter-date">{formatDate(chapter.date)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
