import { useState } from "react";
import { fetchAdminUsers, updateUserRole, updateUserStatus } from "../api/endpoints";
import type { AdminUser, Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { useDebounce } from "../hooks/useDebounce";
import { formatDate, formatNumber } from "../lib/format";
import { ALL_ROLES } from "../lib/roles";
import Pager from "./Pager";
import { SkeletonLines } from "./Skeletons";

const PAGE_SIZE = 20;

export default function AdminUsersPanel() {
  const { user: me } = useAuth();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounce(query.trim());
  // ~18k accounts — require a search term before listing anyone.
  const enabled = search.length > 0;

  const users = useAsync(
    () => fetchAdminUsers({ search, page, limit: PAGE_SIZE }),
    [search, page],
    enabled,
  );

  // PATCHed rows overlay the fetched page so edits show without a refetch.
  const [edits, setEdits] = useState<Record<number, AdminUser>>({});
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeRole(user: AdminUser, role: Role) {
    setBusyId(user.id);
    setNotice(null);
    setError(null);
    try {
      const res = await updateUserRole(user.id, role);
      setEdits((e) => ({ ...e, [user.id]: res.user }));
      setNotice(
        `${res.user.username} is now a ${role}. Roles are baked into the ` +
          `login token — they must log out and back in before it takes effect.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Role change failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(user: AdminUser) {
    const next = user.status === "active" ? "suspended" : "active";
    setBusyId(user.id);
    setNotice(null);
    setError(null);
    try {
      const res = await updateUserStatus(user.id, next);
      setEdits((e) => ({ ...e, [user.id]: res.user }));
      setNotice(
        next === "suspended"
          ? `${res.user.username} is suspended — they can't log in again, but ` +
              `an existing session keeps working until its token expires (≤7 days).`
          : `${res.user.username} is active again.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    } finally {
      setBusyId(null);
    }
  }

  const rows = (users.data?.users ?? []).map((u) => edits[u.id] ?? u);

  return (
    <section>
      <div className="admin-toolbar">
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search username or email…"
          aria-label="Search users"
        />
        {users.data && (
          <span className="text-small text-tertiary">
            {formatNumber(users.data.total)} match
            {users.data.total === 1 ? "" : "es"}
          </span>
        )}
      </div>

      {notice && <div className="form-success">{notice}</div>}
      {error && <div className="form-error">{error}</div>}

      {!enabled ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden>
            🔭
          </span>
          <p>
            There are ~18,000 accounts — search by username or email to find
            one.
          </p>
        </div>
      ) : users.error ? (
        <div className="error-state">
          <p>{users.error}</p>
        </div>
      ) : users.loading ? (
        <SkeletonLines count={8} />
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden>
            🌑
          </span>
          <p>No accounts match “{search}”.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((user) => {
                const isMe = me?.id === user.id;
                const busy = busyId === user.id;
                return (
                  <tr key={user.id}>
                    <td>
                      <span className="admin-user-name">
                        {user.displayName}
                      </span>
                      <span className="admin-user-sub">
                        @{user.username} · #{user.id}
                        {isMe && " · you"}
                      </span>
                    </td>
                    <td className="admin-email">{user.email}</td>
                    <td>
                      <select
                        className="input role-select"
                        value={user.role}
                        disabled={busy || isMe}
                        title={
                          isMe ? "You can't change your own role" : undefined
                        }
                        aria-label={`Role for ${user.username}`}
                        onChange={(e) =>
                          changeRole(user, e.target.value as Role)
                        }
                      >
                        {ALL_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`status-chip ${
                          user.status === "active" ? "is-success" : "is-missed"
                        }`}
                      >
                        {user.status === "active" ? "Active" : "Suspended"}
                      </span>
                    </td>
                    <td className="text-tertiary">
                      {formatDate(user.registered)}
                    </td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className={`btn btn-sm ${
                            user.status === "active"
                              ? "btn-ghost"
                              : "btn-secondary"
                          }`}
                          disabled={busy || isMe}
                          title={
                            isMe
                              ? "You can't suspend yourself"
                              : undefined
                          }
                          onClick={() => toggleStatus(user)}
                        >
                          {busy
                            ? "Saving…"
                            : user.status === "active"
                              ? "Suspend"
                              : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {enabled && (
        <Pager
          page={page}
          total={users.data?.total ?? 0}
          limit={PAGE_SIZE}
          onPage={setPage}
        />
      )}
    </section>
  );
}
