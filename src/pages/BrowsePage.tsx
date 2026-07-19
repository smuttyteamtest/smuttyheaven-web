import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchNovels } from "../api/endpoints";
import type { NovelSort } from "../api/types";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import { usePageMeta } from "../hooks/usePageMeta";
import GenreChips from "../components/GenreChips";
import NovelCard from "../components/NovelCard";
import Pager from "../components/Pager";
import { SkeletonGrid } from "../components/Skeletons";
import { novelPath } from "../lib/format";

const PAGE_SIZE = 24;
const SORTS: { value: NovelSort; label: string }[] = [
  { value: "latest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "title", label: "A–Z" },
];

export default function BrowsePage() {
  const [params, setParams] = useSearchParams();
  const genre = params.get("genre") ?? undefined;
  const sort = (params.get("sort") as NovelSort | null) ?? "latest";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const urlSearch = params.get("search") ?? "";

  // "Fantasy novels" / "Search “sword”" / "Browse novels", by specificity.
  const genreLabel = genre
    ? genre.charAt(0).toUpperCase() + genre.slice(1).replace(/-/g, " ")
    : undefined;
  usePageMeta({
    title: urlSearch
      ? `Search “${urlSearch}”`
      : genreLabel
        ? `${genreLabel} novels`
        : "Browse novels",
  });

  // Local input state, debounced into the URL (search hits the live DB —
  // no rate limiting server-side, so don't fire per keystroke).
  const [input, setInput] = useState(urlSearch);
  const debounced = useDebounce(input, 400);

  useEffect(() => {
    if (debounced === urlSearch) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debounced) next.set("search", debounced);
        else next.delete("search");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [debounced, urlSearch, setParams]);

  function patchParams(patch: Record<string, string | undefined>) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) next.delete(key);
        else next.set(key, value);
      }
      return next;
    });
  }

  const { data, loading, error } = useAsync(
    () =>
      fetchNovels({
        page,
        limit: PAGE_SIZE,
        search: urlSearch || undefined,
        sort,
        genre,
      }),
    [page, urlSearch, sort, genre],
  );

  return (
    <div className="container">
      <h2 style={{ margin: "var(--sp-5) 0 var(--sp-3)" }}>Browse novels</h2>

      <div className="chapter-toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search titles…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Search novels by title"
        />
        <select
          className="input"
          style={{ maxWidth: 160 }}
          value={sort}
          onChange={(e) => patchParams({ sort: e.target.value, page: undefined })}
          aria-label="Sort order"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <GenreChips
        active={genre}
        onSelect={(slug) => patchParams({ genre: slug, page: undefined })}
      />

      {error ? (
        <div className="error-state">
          <p>{error}</p>
        </div>
      ) : loading ? (
        <SkeletonGrid count={PAGE_SIZE} />
      ) : data && data.novels.length > 0 ? (
        <>
          <p className="text-small text-tertiary">
            {data.total} novel{data.total === 1 ? "" : "s"}
          </p>
          <div className="novel-grid">
            {data.novels.map((novel) => (
              <NovelCard
                key={novel.id}
                item={{
                  id: novel.id,
                  title: novel.title,
                  cover: novel.cover,
                  href: novelPath(novel.id, novel.slug),
                }}
              />
            ))}
          </div>
          <Pager
            page={page}
            total={data.total}
            limit={PAGE_SIZE}
            onPage={(p) => {
              patchParams({ page: p > 1 ? String(p) : undefined });
              window.scrollTo({ top: 0 });
            }}
          />
        </>
      ) : (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden>
            🔭
          </span>
          <p>No novels found{urlSearch ? ` for “${urlSearch}”` : ""}.</p>
        </div>
      )}
    </div>
  );
}
