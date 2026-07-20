import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import AccountManagePanel from "../components/AccountManagePanel";
import { usePageMeta } from "../hooks/usePageMeta";
import { formatDate } from "../lib/format";
import { tokenRole } from "../lib/jwt";

const ROLE_CHIPS: Record<Role, { label: string; cls: string }> = {
  reader: { label: "Reader", cls: "is-locked" },
  writer: { label: "Writer", cls: "is-success" },
  translator: { label: "Translator", cls: "is-pending" },
  admin: { label: "Admin", cls: "is-admin" },
};

export default function AccountPage() {
  usePageMeta({ title: "Account" });
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // Re-read /api/auth/me on every visit — the role there is live, while the
  // one in the stored JWT is frozen at login. Divergence → prompt re-login.
  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  if (!user) return null; // RequireAuth guarantees this; satisfies narrowing

  const jwtRole = tokenRole(getToken());
  const staleRole = jwtRole !== null && jwtRole !== user.role ? jwtRole : null;
  const role = ROLE_CHIPS[user.role];

  return (
    <div className="container account-page">
      <h2>Account</h2>

      {staleRole && (
        <div className="warn-banner account-stale-role">
          <span>
            Your role is now <strong>{ROLE_CHIPS[user.role].label}</strong>,
            but this session was started as{" "}
            <strong>{ROLE_CHIPS[staleRole].label}</strong>. Roles are baked
            into your login token, so the new one only works after you sign in
            again.
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out &amp; back in
          </button>
        </div>
      )}

      <div className="card account-card">
        <div className="account-head">
          <span className="account-avatar" aria-hidden>
            {user.displayName.trim().charAt(0).toUpperCase() || "✦"}
          </span>
          <div>
            <h3>{user.displayName}</h3>
            <span className={`status-chip ${role.cls}`}>{role.label}</span>
          </div>
        </div>

        <dl className="account-rows">
          <div>
            <dt>Username</dt>
            <dd>{user.username}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(user.registered)}</dd>
          </div>
        </dl>

        <button
          className="btn btn-secondary btn-md"
          onClick={() => {
            logout();
            navigate("/");
          }}
        >
          Log out
        </button>
      </div>

      <AccountManagePanel user={user} />
    </div>
  );
}
