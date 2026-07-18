import { Link } from "react-router-dom";
import NovelCard, { type NovelCardData } from "./NovelCard";
import { SkeletonCard } from "./Skeletons";

interface RailProps {
  title: string;
  items: NovelCardData[] | undefined;
  loading: boolean;
  error?: string;
  seeAllHref?: string;
  /** hide the whole rail when loaded but empty */
  hideWhenEmpty?: boolean;
}

export default function Rail({
  title,
  items,
  loading,
  error,
  seeAllHref,
  hideWhenEmpty = true,
}: RailProps) {
  if (!loading && !error && (items?.length ?? 0) === 0 && hideWhenEmpty) {
    return null;
  }

  return (
    <section className="rail">
      <div className="rail-header">
        <h3>{title}</h3>
        {seeAllHref && (
          <Link to={seeAllHref} className="text-small">
            See all
          </Link>
        )}
      </div>
      {error ? (
        <p className="text-secondary text-small">{error}</p>
      ) : (
        <div className="rail-track">
          {loading
            ? Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)
            : items!.map((item) => <NovelCard key={item.id} item={item} />)}
        </div>
      )}
    </section>
  );
}
