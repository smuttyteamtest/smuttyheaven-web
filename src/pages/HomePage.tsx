import { Link, useNavigate } from "react-router-dom";
import {
  fetchHistory,
  fetchNovels,
  fetchRecommendations,
} from "../api/endpoints";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import GenreChips from "../components/GenreChips";
import Rail from "../components/Rail";
import type { NovelCardData } from "../components/NovelCard";
import { novelPath, readerPath } from "../lib/format";

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const popular = useAsync(() => fetchNovels({ sort: "popular", limit: 12 }), []);
  const latest = useAsync(() => fetchNovels({ sort: "latest", limit: 12 }), []);
  const history = useAsync(() => fetchHistory(1, 12), [user?.id], !!user);
  // Recommendations are one of the slower endpoints (~1–2s) — the rail shows
  // skeletons while it loads.
  const recs = useAsync(() => fetchRecommendations(), [user?.id], !!user);

  const historyCards: NovelCardData[] | undefined = history.data?.history.map(
    (h) => ({
      id: h.novelId,
      title: h.title,
      cover: h.cover,
      subtitle: h.chapterName ?? "Continue reading",
      href: readerPath(h.novelId, h.chapterId),
    }),
  );

  const recCards: NovelCardData[] | undefined = recs.data?.recommendations.map(
    (r) => ({
      id: r.id,
      title: r.title,
      cover: r.cover,
      subtitle: r.reason,
      href: novelPath(r.id, r.slug),
    }),
  );

  const popularCards: NovelCardData[] | undefined = popular.data?.novels.map(
    (n) => ({ id: n.id, title: n.title, cover: n.cover, href: novelPath(n.id, n.slug) }),
  );

  const latestCards: NovelCardData[] | undefined = latest.data?.novels.map(
    (n) => ({ id: n.id, title: n.title, cover: n.cover, href: novelPath(n.id, n.slug) }),
  );

  return (
    <>
      <div className="hero">
        <div className="container">
          <h1>
            Explore worlds, <span className="hero-star">one chapter</span> at a
            time
          </h1>
          <p className="hero-tagline">
            Hundreds of novels, hundreds of thousands of chapters. Pick up
            right where you left off.
          </p>
          {!user && (
            <Link to="/register" className="btn btn-primary btn-lg">
              Start reading free
            </Link>
          )}
        </div>
      </div>

      <div className="container">
        <GenreChips
          max={12}
          onSelect={(slug) =>
            navigate(slug ? `/browse?genre=${slug}` : "/browse")
          }
        />

        {user && (
          <Rail
            title="Continue reading"
            items={historyCards}
            loading={history.loading}
            error={history.error}
            seeAllHref="/library?tab=history"
          />
        )}

        {user && (
          <Rail
            title="For you"
            items={recCards}
            loading={recs.loading}
            error={recs.error}
          />
        )}

        <Rail
          title="Popular"
          items={popularCards}
          loading={popular.loading}
          error={popular.error}
          seeAllHref="/browse?sort=popular"
          hideWhenEmpty={false}
        />

        <Rail
          title="New arrivals"
          items={latestCards}
          loading={latest.loading}
          error={latest.error}
          seeAllHref="/browse?sort=latest"
          hideWhenEmpty={false}
        />
      </div>
    </>
  );
}
