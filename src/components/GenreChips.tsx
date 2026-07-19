import { fetchGenres } from "../api/endpoints";
import type { CompletionStatus, NovelOrigin } from "../api/types";
import { useAsync } from "../hooks/useAsync";

interface GenreChipsProps {
  active?: string;
  onSelect: (slug: string | undefined) => void;
  /** show only the top N genres (they arrive sorted by count) */
  max?: number;
  /**
   * Scope the per-genre counts to the listing's pinned filters. /api/genres
   * composes both, so the numbers match the page (e.g. completed romance = 92,
   * not the whole-catalog 292). Omit for the unfiltered catalog.
   */
  status?: NonNullable<CompletionStatus>;
  origin?: NonNullable<NovelOrigin>;
}

export default function GenreChips({
  active,
  onSelect,
  max,
  status,
  origin,
}: GenreChipsProps) {
  const { data: genres, loading } = useAsync(
    () => fetchGenres(status, origin),
    [status, origin],
  );

  if (loading || !genres) {
    return (
      <div className="chip-row-scroll">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="skeleton" style={{ width: 80, height: 28 }} />
        ))}
      </div>
    );
  }

  const shown = max ? genres.slice(0, max) : genres;

  return (
    <div className="chip-row-scroll" role="listbox" aria-label="Genres">
      <button
        className={`chip${!active ? " is-active" : ""}`}
        onClick={() => onSelect(undefined)}
      >
        All
      </button>
      {shown.map((genre) => (
        <button
          key={genre.id}
          className={`chip${active === genre.slug ? " is-active" : ""}`}
          onClick={() => onSelect(genre.slug)}
        >
          {genre.name}
          <span className="text-tiny text-tertiary">{genre.count}</span>
        </button>
      ))}
    </div>
  );
}
