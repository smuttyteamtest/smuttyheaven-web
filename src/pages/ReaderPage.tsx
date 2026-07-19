import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchChapter,
  fetchNovelCached,
  saveProgress,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import SafeHtml from "../components/SafeHtml";
import { SkeletonLines } from "../components/Skeletons";
import { formatChapterHtml, novelPath, readerPath } from "../lib/format";

const FONT_KEY = "novvels_reader_font";
const FONT_SIZES = [16, 18, 20, 22, 24];

export default function ReaderPage() {
  const { novelId: novelIdParam, chapterId: chapterIdParam } = useParams();
  const novelId = Number(novelIdParam);
  const chapterId = Number(chapterIdParam);
  const { user } = useAuth();
  const navigate = useNavigate();

  const valid = Number.isFinite(novelId) && Number.isFinite(chapterId);

  // The chapter payload has no novelId and no prev/next — navigation comes
  // from the novel's chapter array, cached across chapter hops.
  const novel = useAsync(() => fetchNovelCached(novelId), [novelId], valid);
  const chapter = useAsync(() => fetchChapter(chapterId), [chapterId], valid);

  const [fontIdx, setFontIdx] = useState(() => {
    const stored = Number(localStorage.getItem(FONT_KEY));
    return FONT_SIZES.includes(stored) ? FONT_SIZES.indexOf(stored) : 1;
  });

  useEffect(() => {
    localStorage.setItem(FONT_KEY, String(FONT_SIZES[fontIdx]));
  }, [fontIdx]);

  // Save progress as soon as the chapter opens (recommended API behavior);
  // PUT is an idempotent upsert, so double-fires are harmless.
  useEffect(() => {
    if (!valid || !user) return;
    saveProgress(novelId, chapterId).catch(() => {});
  }, [valid, user, novelId, chapterId]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [chapterId]);

  const sorted = useMemo(
    () => (novel.data ? [...novel.data.chapters].sort((a, b) => a.index - b.index) : []),
    [novel.data],
  );
  const position = sorted.findIndex((c) => c.id === chapterId);
  const prev = position > 0 ? sorted[position - 1] : undefined;
  const next =
    position >= 0 && position < sorted.length - 1 ? sorted[position + 1] : undefined;

  if (!valid) {
    return (
      <div className="container error-state">
        <p>That chapter link doesn't look right.</p>
        <Link to="/browse" className="btn btn-secondary btn-md">
          Browse novels
        </Link>
      </div>
    );
  }

  const chapterName =
    chapter.data?.name ?? sorted[position]?.name ?? "Loading…";

  const navButtons = (
    <>
      <button
        className="btn btn-secondary btn-md"
        disabled={!prev}
        onClick={() => prev && navigate(readerPath(novelId, prev.id))}
      >
        ← Prev
      </button>
      <span className="reader-progress">
        {position >= 0 ? `${position + 1} / ${sorted.length}` : "…"}
      </span>
      <button
        className="btn btn-secondary btn-md"
        disabled={!next}
        onClick={() => next && navigate(readerPath(novelId, next.id))}
      >
        Next →
      </button>
    </>
  );

  return (
    <>
      <div className="reader-bar">
        <div className="container reader-bar-inner">
          <Link
            to={novel.data ? novelPath(novelId, novel.data.slug) : `/novel/${novelId}`}
            className="btn btn-ghost btn-sm"
            aria-label="Back to novel"
          >
            ←
          </Link>
          <div className="reader-bar-titles">
            <span className="reader-bar-novel">{novel.data?.title ?? ""}</span>
            <span className="reader-bar-chapter">{chapterName}</span>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-1)" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFontIdx((i) => Math.max(0, i - 1))}
              disabled={fontIdx === 0}
              aria-label="Smaller text"
            >
              A−
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}
              disabled={fontIdx === FONT_SIZES.length - 1}
              aria-label="Larger text"
            >
              A+
            </button>
          </div>
        </div>
      </div>

      <article
        className="reader-content"
        style={{ fontSize: FONT_SIZES[fontIdx] }}
      >
        {chapter.error ? (
          <div className="error-state">
            <p>{chapter.error}</p>
          </div>
        ) : chapter.loading ? (
          <SkeletonLines count={14} />
        ) : chapter.data?.content ? (
          <SafeHtml html={formatChapterHtml(chapter.data.content)} />
        ) : (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden>
              🛰️
            </span>
            <p>
              This chapter's text is unavailable — a casualty of the site
              migration. Try the next one.
            </p>
          </div>
        )}
      </article>

      <div className="reader-nav">{navButtons}</div>
    </>
  );
}
