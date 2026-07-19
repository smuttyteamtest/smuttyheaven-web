import { useSearchParams } from "react-router-dom";
import { fetchAdminStats } from "../api/endpoints";
import AdminContributorsPanel from "../components/AdminContributorsPanel";
import AdminNovelsPanel from "../components/AdminNovelsPanel";
import AdminUsersPanel from "../components/AdminUsersPanel";
import { SkeletonLines } from "../components/Skeletons";
import { useAsync } from "../hooks/useAsync";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatNumber } from "../lib/format";

type Tab = "overview" | "users" | "novels" | "contributors";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "users", label: "Users" },
  { key: "novels", label: "Novels" },
  { key: "contributors", label: "Contributors" },
];

export default function AdminPage() {
  usePageMeta({ title: "Admin" });
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") as Tab | null;
  const tab: Tab = TABS.some((t) => t.key === tabParam)
    ? tabParam!
    : "overview";

  function switchTab(next: Tab) {
    setParams(next === "overview" ? {} : { tab: next }, { replace: true });
  }

  return (
    <div className="container">
      <h2 style={{ margin: "var(--sp-5) 0 0" }}>Admin</h2>

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

      {tab === "overview" && <OverviewTab />}
      {tab === "users" && <AdminUsersPanel />}
      {tab === "novels" && <AdminNovelsPanel />}
      {tab === "contributors" && <AdminContributorsPanel />}
    </div>
  );
}

function OverviewTab() {
  const stats = useAsync(fetchAdminStats, []);

  if (stats.error) {
    return (
      <div className="error-state">
        <p>{stats.error}</p>
        <button className="btn btn-secondary btn-md" onClick={stats.reload}>
          Try again
        </button>
      </div>
    );
  }
  if (stats.loading || !stats.data) return <SkeletonLines count={6} />;

  const s = stats.data;
  const unpublished = s.novels.total - s.novels.published;

  return (
    <div className="stat-grid">
      <div className="card stat-card">
        <span className="stat-value">{formatNumber(s.users.total)}</span>
        <span className="stat-label">Accounts</span>
        <div className="stat-breakdown">
          {(Object.entries(s.users.byRole) as [string, number][]).map(
            ([role, count]) => (
              <span className="status-chip is-locked" key={role}>
                {formatNumber(count)} {role}
                {count === 1 ? "" : "s"}
              </span>
            ),
          )}
        </div>
      </div>

      <div className="card stat-card">
        <span className="stat-value">{formatNumber(s.novels.published)}</span>
        <span className="stat-label">Published novels</span>
        <div className="stat-breakdown">
          <span className="status-chip is-pending">
            {formatNumber(unpublished)} draft/trashed
          </span>
        </div>
      </div>

      <div className="card stat-card">
        <span className="stat-value">{formatNumber(s.chapters.total)}</span>
        <span className="stat-label">Chapters</span>
      </div>

      <div className="card stat-card">
        <span className="stat-value">
          {formatNumber(s.recentSignups.last7Days)}
        </span>
        <span className="stat-label">Signups, last 7 days</span>
        <div className="stat-breakdown">
          <span className="status-chip is-success">
            {formatNumber(s.recentSignups.last30Days)} in 30 days
          </span>
        </div>
      </div>
    </div>
  );
}
