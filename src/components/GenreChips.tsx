import { fetchGenres } from "../api/endpoints";
import { useAsync } from "../hooks/useAsync";

interface GenreChipsProps {
  active?: string;
  onSelect: (slug: string | undefined) => void;
  /** show only the top N genres (they arrive sorted by count) */
  max?: number;
}

export default function GenreChips({ active, onSelect, max }: GenreChipsProps) {
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
          <span className="text-tiny text-tertiary">{genre.count}</span>
        </button>
      ))}
    </div>
  );
}
