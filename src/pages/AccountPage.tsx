import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken } from "../api/client";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { formatDate } from "../lib/format";
import { tokenRole } from "../lib/jwt";

const ROLE_CHIPS: Record<Role, { label: string; cls: string }> = {
  reader: { label: "Reader", cls: "is-locked" },
  writer: { label: "Writer", cls: "is-success" },
  translator: { label: "Translator", cls: "is-pending" },
  admin: { label: "Admin", cls: "is-admin" },
};

// No account self-service in the API yet (handoff §8.5) — these render
// disabled until the backend ships the endpoints.
const BLOCKED_ACTIONS = [
  {
    title: "Display name & email",
    detail: "Shown on your profile and used to log in.",
    button: "Edit",
    destructive: false,
  },
  {
    title: "Password",
    detail: "There is no password change or reset yet.",
    button: "Change",
    destructive: false,
  },
  {
    title: "Delete account",
    detail: "Permanently remove your account and library.",
    button: "Delete",
    destructive: true,
  },
];

export default function AccountPage() {
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

      <div className="card account-card">
        <h3>Manage account</h3>
        <ul className="account-actions">
          {BLOCKED_ACTIONS.map((action) => (
            <li key={action.title}>
              <div className="account-action-info">
                <h4>{action.title}</h4>
                <p>{action.detail}</p>
              </div>
              <button
                className={`btn btn-sm ${action.destructive ? "btn-destructive" : "btn-secondary"}`}
                disabled
                title="Not available yet"
              >
                {action.button}
              </button>
            </li>
          ))}
        </ul>
        <div className="note-banner">
          These aren&apos;t available yet — the Novvels API doesn&apos;t support
          editing your profile, changing passwords, or deleting accounts. They
          will light up here once the backend ships those endpoints.
        </div>
      </div>
    </div>
  );
}
