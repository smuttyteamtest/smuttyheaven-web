import { fetchGenres } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";

interface GenreChipsProps {
  active?: string;
  onSelect: (slug: string | undefined) => void;
  /** show only the top N genres (they arrive sorted by count) */
  max?: number;
  /**
   * Show the per-genre count. Off for filtered listings (e.g. Completed),
   * where /api/genres still reports whole-catalog counts — a wrong number is
   * worse than none. Filtering by genre still composes with the filter.
   */
  showCounts?: boolean;
}

export default function GenreChips({
  active,
  onSelect,
  max,
  showCounts = true,
}: GenreChipsProps) {
  const { data: genres, loading } = useAsync(() => fetchGenres(), []);

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
          {showCounts && (
            <span className="text-tiny text-tertiary">{genre.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
