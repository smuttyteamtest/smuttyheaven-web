import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchHistory, fetchList } from "../api/endpoints";
import type { ListType } from "../api/types";
import { useAsync } from "../hooks/useAsync";
import { usePageMeta } from "../hooks/usePageMeta";
import NovelCard from "../components/NovelCard";
import Pager from "../components/Pager";
import { SkeletonGrid } from "../components/Skeletons";
import { formatDate, novelPath, readerPath } from "../lib/format";

const PAGE_SIZE = 24;

type Tab = ListType | "history";
const TABS: { key: Tab; label: string }[] = [
  { key: "saved", label: "Saved" },
  { key: "favourite", label: "Favourites" },
  { key: "archived", label: "Archived" },
  { key: "history", label: "History" },
];

export default function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = TABS.some((t) => t.key === tabParam) ? tabParam! : "saved";
  const [page, setPage] = useState(1);
  usePageMeta({ title: "My Library" });

  function switchTab(next: Tab) {
    setParams(next === "saved" ? {} : { tab: next }, { replace: true });
    setPage(1);
  }

  const list = useAsync(
    () => fetchList(tab as ListType, page, PAGE_SIZE),
    [tab, page],
    tab !== "history",
  );
  const history = useAsync(
    () => fetchHistory(page, PAGE_SIZE),
    [page],
    tab === "history",
  );

  const active = tab === "history" ? history : list;
  const total =
    tab === "history" ? history.data?.total ?? 0 : list.data?.total ?? 0;

  return (
    <div className="container">
      <h2 style={{ margin: "var(--sp-5) 0 0" }}>My Library</h2>

      <div className="tabs" role="tablist">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={`tab${tab === key ? " is-active" : ""}`}
            onClick={() => switchTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {active.error ? (
        <div className="error-state">
          <p>{active.error}</p>
        </div>
      ) : active.loading ? (
        <SkeletonGrid count={12} />
      ) : tab === "history" ? (
        history.data && history.data.history.length > 0 ? (
          <div className="novel-grid">
            {history.data.history.map((entry) => (
              <NovelCard
                key={entry.novelId}
                item={{
                  id: entry.novelId,
                  title: entry.title,
                  cover: entry.cover,
                  subtitle: entry.chapterName ?? formatDate(entry.updatedAt),
                  href: readerPath(entry.novelId, entry.chapterId),
                }}
              />
            ))}
          </div>
        ) : (
          <EmptyTab message="Nothing read yet — open a chapter and it lands here." />
        )
      ) : list.data && list.data.novels.length > 0 ? (
        <div className="novel-grid">
          {list.data.novels.map((novel) => (
            <NovelCard
              key={novel.id}
              item={{
                id: novel.id,
                title: novel.title,
                cover: novel.cover,
                subtitle: `Added ${formatDate(novel.addedAt)}`,
                href: novelPath(novel.id, novel.slug),
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyTab message="This shelf is empty. Find something on the Browse page." />
      )}

      <Pager page={page} total={total} limit={PAGE_SIZE} onPage={setPage} />
    </div>
  );
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden>
        🌌
      </span>
      <p>{message}</p>
    </div>
  );
}
