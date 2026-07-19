import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  fetchChapter,
  fetchNovelCached,
  saveProgress,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { usePageMeta } from "../hooks/usePageMeta";
import SafeHtml from "../components/SafeHtml";
import { SkeletonLines } from "../components/Skeletons";
import { formatChapterHtml, novelPath, readerPath } from "../lib/format";
import { useToast } from "../components/Toasts";
import { novelPath, readerPath } from "../lib/format";

const FONT_KEY = "novvels_reader_font";
const FONT_SIZES = [16, 18, 20, 22, 24];
const scrollKey = (chapterId: number) => `novvels_scroll_${chapterId}`;

export default function ReaderPage() {
  const { novelId: novelIdParam, chapterId: chapterIdParam } = useParams();
  const novelId = Number(novelIdParam);
  const chapterId = Number(chapterIdParam);
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const valid = Number.isFinite(novelId) && Number.isFinite(chapterId);

  // The chapter payload has no novelId and no prev/next — navigation comes
  // from the novel's chapter array, cached across chapter hops.
  const novel = useAsync(() => fetchNovelCached(novelId), [novelId], valid);
  const chapter = useAsync(() => fetchChapter(chapterId), [chapterId], valid);

  usePageMeta({
    title:
      novel.data && chapter.data
        ? `${chapter.data.name} · ${novel.data.title}`
        : novel.data?.title,
  });

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
    saveProgress(novelId, chapterId).catch(() => {
      toast(
        "Couldn't save your reading progress — Continue reading may lag behind.",
      );
    });
  }, [valid, user, novelId, chapterId, toast]);

  // Scroll memory: each chapter remembers its position for the session, so
  // detouring to the chapter list (or another tab) and back lands you where
  // you were. `restored` gates the writer so the reset-to-top on navigation
  // doesn't clobber the stored spot before it's been re-applied.
  const restored = useRef(false);
  // Layout effect for the same reason as the listener below: the gate must
  // close before the browser can emit a clamped scroll for the new chapter.
  useLayoutEffect(() => {
    restored.current = false;
    window.scrollTo({ top: 0 });
  }, [chapterId]);

  // Restore only once *this* chapter's text is in the DOM — until then the
  // page is a skeleton (or the previous chapter) and the target offset
  // doesn't exist yet.
  const contentReady = chapter.data?.id === chapterId || !!chapter.error;
  useEffect(() => {
    if (!contentReady || restored.current) return;
    const stored = Number(sessionStorage.getItem(scrollKey(chapterId)));
    if (stored > 0) window.scrollTo({ top: stored });
    restored.current = true;
  }, [chapterId, contentReady]);

  // Layout effect: its cleanup runs synchronously while this page's DOM is
  // being swapped out. With a plain useEffect the browser clamps scrollY to
  // the next page's (shorter) height and fires a scroll event before the
  // deferred cleanup detaches the listener — clobbering the saved position.
  useLayoutEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (!restored.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        sessionStorage.setItem(
          scrollKey(chapterId),
          String(Math.round(window.scrollY)),
        );
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, [chapterId]);

  const sorted = useMemo(
    () => (novel.data ? [...novel.data.chapters].sort((a, b) => a.index - b.index) : []),
    [novel.data],
  );
  const position = sorted.findIndex((c) => c.id === chapterId);
  const prev = position > 0 ? sorted[position - 1] : undefined;
  const next =
    position >= 0 && position < sorted.length - 1 ? sorted[position + 1] : undefined;

  // Arrow keys page between chapters (keyboard reading, a11y).
  const prevId = prev?.id;
  const nextId = next?.id;
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (event.key === "ArrowLeft" && prevId !== undefined) {
        navigate(readerPath(novelId, prevId));
      } else if (event.key === "ArrowRight" && nextId !== undefined) {
        navigate(readerPath(novelId, nextId));
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevId, nextId, novelId, navigate]);

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

      {/* Touch-edge page turns; mirrors of Prev/Next, so hidden from AT and
          the tab order. Desktop hides them entirely (see app.css). */}
      <div className="reader-tapzones" aria-hidden="true">
        <button
          type="button"
          className="reader-tapzone reader-tapzone-prev"
          tabIndex={-1}
          disabled={!prev}
          onClick={() => prev && navigate(readerPath(novelId, prev.id))}
        />
        <button
          type="button"
          className="reader-tapzone reader-tapzone-next"
          tabIndex={-1}
          disabled={!next}
          onClick={() => next && navigate(readerPath(novelId, next.id))}
        />
      </div>
    </>
  );
}
