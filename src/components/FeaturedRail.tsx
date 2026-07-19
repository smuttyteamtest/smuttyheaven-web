import { Link } from "react-router-dom";
import Cover from "./Cover";
import type { Novel } from "../api/types";
import { novelPath } from "../lib/format";

interface FeaturedRailProps {
  novels: Novel[] | undefined;
  loading: boolean;
}

// Admin-curated hero rail at the top of the home page. Featured is pure
// curation — when nothing is featured (or the fetch fails) the section
// doesn't render at all, so there is no empty/error state here.
export default function FeaturedRail({ novels, loading }: FeaturedRailProps) {
  if (!loading && (novels?.length ?? 0) === 0) return null;

  return (
    <section className="featured-rail" aria-label="Featured novels">
      <div className="rail-header">
        <h3>
          <span className="featured-star" aria-hidden="true">
            ★
          </span>{" "}
          Featured
        </h3>
      </div>
      <div className="featured-track">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="card featured-card">
                <div className="skeleton featured-card-cover" />
                <div className="featured-card-body">
                  <div className="skeleton skeleton-line" style={{ width: "40%" }} />
                  <div className="skeleton skeleton-line" style={{ width: "85%" }} />
                  <div className="skeleton skeleton-line" style={{ width: "60%" }} />
                </div>
              </div>
            ))
          : novels!.map((novel) => (
              <Link
                key={novel.id}
                to={novelPath(novel.id, novel.slug)}
                className="card card-elevated featured-card"
              >
                <div className="featured-card-cover">
                  <Cover src={novel.cover} title={novel.title} seed={novel.id} />
                </div>
                <div className="featured-card-body">
                  <span className="chip-featured">★ Featured</span>
                  <div className="featured-card-title">{novel.title}</div>
                  <span className="featured-card-cta">Start reading</span>
                </div>
              </Link>
            ))}
      </div>
    </section>
  );
}
