import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAccount as apiDeleteAccount } from "../api/endpoints";
import type { PublicUser } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./Toasts";

// Mirrors the server's email rule (register uses the same, FRONTEND.md §7).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Section = "profile" | "password" | "delete";

/**
 * The "Manage account" card: edit profile, change password, delete account.
 * Each row expands into an inline form (only one open at a time). Wrong-password
 * errors come back as 403 (not 401) so they surface here instead of logging the
 * user out — see account_api_handoff.md §1.1.
 */
export default function AccountManagePanel({ user }: { user: PublicUser }) {
  const { updateProfile, changePassword, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState<Section | null>(null);

  // ── Profile ────────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [profilePassword, setProfilePassword] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // ── Password ───────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // ── Delete ─────────────────────────────────────────────────────────────
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggling a section (re)seeds its fields from the live user and clears errors.
  function toggle(section: Section) {
    setProfileError(null);
    setPasswordError(null);
    setDeleteError(null);
    if (section === "profile") {
      setDisplayName(user.displayName);
      setEmail(user.email);
      setProfilePassword("");
    } else if (section === "password") {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setDeletePassword("");
      setDeleteConfirm("");
    }
    setOpen((cur) => (cur === section ? null : section));
  }

  // Email is a login credential — the API requires the current password to
  // change it, so we reveal the password field the moment the email diverges.
  const emailChanging = email.trim().toLowerCase() !== user.email.toLowerCase();

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileError(null);
    const nextName = displayName.trim();
    const nextEmail = email.trim().toLowerCase();
    const nameChanged = nextName !== user.displayName;
    const emailChanged = nextEmail !== user.email.toLowerCase();

    if (!nameChanged && !emailChanged) {
      setProfileError("Nothing changed.");
      return;
    }
    if (nameChanged && (nextName.length < 1 || nextName.length > 250)) {
      setProfileError("Display name must be 1–250 characters.");
      return;
    }
    if (emailChanged && (!EMAIL_RE.test(nextEmail) || nextEmail.length > 100)) {
      setProfileError("Enter a valid email (max 100 characters).");
      return;
    }
    if (emailChanged && !profilePassword) {
      setProfileError("Enter your current password to change your email.");
      return;
    }

    const patch: { displayName?: string; email?: string; currentPassword?: string } = {};
    if (nameChanged) patch.displayName = nextName;
    if (emailChanged) {
      patch.email = nextEmail;
      patch.currentPassword = profilePassword;
    }

    setProfileBusy(true);
    try {
      await updateProfile(patch);
      toast("Profile updated.", "success");
      setProfilePassword("");
      setOpen(null);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Couldn't update your profile.",
      );
    } finally {
      setProfileBusy(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8 || newPassword.length > 200) {
      setPasswordError("New password must be 8–200 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("New password must be different from your current one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords don't match.");
      return;
    }

    setPasswordBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast("Password changed.", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setOpen(null);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Couldn't change your password.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  const canDelete =
    deletePassword.length > 0 && deleteConfirm.trim() === user.username;

  async function onDeleteAccount(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);
    if (!canDelete) return;
    if (
      !window.confirm(
        "This permanently deletes your account and everything in your library. It cannot be undone. Continue?",
      )
    ) {
      return;
    }

    setDeleteBusy(true);
    try {
      await apiDeleteAccount(deletePassword);
      // Order matters: leave /account first, THEN drop the session. Otherwise
      // <RequireAuth> re-renders with a null user and bounces us to /login
      // instead of home.
      navigate("/", { replace: true });
      logout();
      toast("Your account has been deleted.", "info");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Couldn't delete your account.",
      );
      setDeleteBusy(false); // on success we've navigated away — nothing to reset
    }
  }

  return (
    <div className="card account-card">
      <h3>Manage account</h3>
      <ul className="account-actions">
        <li>
          <div className="account-action-row">
            <div className="account-action-info">
              <h4>Display name &amp; email</h4>
              <p>Shown on your profile and used to log in.</p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => toggle("profile")}
              aria-expanded={open === "profile"}
            >
              {open === "profile" ? "Cancel" : "Edit"}
            </button>
          </div>
          {open === "profile" && (
            <form className="account-form" onSubmit={onSaveProfile} noValidate>
              {profileError && <div className="form-error">{profileError}</div>}
              <div className="field">
                <label className="field-label" htmlFor="acc-displayName">
                  Display name
                </label>
                <input
                  id="acc-displayName"
                  className="input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="acc-email">
                  Email
                </label>
                <input
                  id="acc-email"
                  className="input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              {emailChanging && (
                <div className="field">
                  <label className="field-label" htmlFor="acc-profilePw">
                    Current password
                  </label>
                  <input
                    id="acc-profilePw"
                    className="input"
                    type="password"
                    value={profilePassword}
                    onChange={(e) => setProfilePassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <div className="field-help">Required to change your email.</div>
                </div>
              )}
              <div className="account-form-actions">
                <button className="btn btn-primary btn-sm" disabled={profileBusy}>
                  {profileBusy ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
          )}
        </li>

        <li>
          <div className="account-action-row">
            <div className="account-action-info">
              <h4>Password</h4>
              <p>Change the password you use to log in.</p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => toggle("password")}
              aria-expanded={open === "password"}
            >
              {open === "password" ? "Cancel" : "Change"}
            </button>
          </div>
          {open === "password" && (
            <form className="account-form" onSubmit={onChangePassword} noValidate>
              {passwordError && <div className="form-error">{passwordError}</div>}
              <div className="field">
                <label className="field-label" htmlFor="acc-curPw">
                  Current password
                </label>
                <input
                  id="acc-curPw"
                  className="input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="acc-newPw">
                  New password
                </label>
                <input
                  id="acc-newPw"
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <div className="field-help">At least 8 characters.</div>
              </div>
              <div className="field">
                <label className="field-label" htmlFor="acc-confirmPw">
                  Confirm new password
                </label>
                <input
                  id="acc-confirmPw"
                  className="input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="account-form-actions">
                <button className="btn btn-primary btn-sm" disabled={passwordBusy}>
                  {passwordBusy ? "Changing…" : "Change password"}
                </button>
              </div>
            </form>
          )}
        </li>

        <li>
          <div className="account-action-row">
            <div className="account-action-info">
              <h4>Delete account</h4>
              <p>Permanently remove your account and library.</p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-destructive"
              onClick={() => toggle("delete")}
              aria-expanded={open === "delete"}
            >
              {open === "delete" ? "Cancel" : "Delete"}
            </button>
          </div>
          {open === "delete" && (
            <form className="account-form" onSubmit={onDeleteAccount} noValidate>
              <div className="warn-banner">
                This can&apos;t be undone. Your account, saved lists, and reading
                history are permanently removed.
              </div>
              {deleteError && <div className="form-error">{deleteError}</div>}
              <div className="field">
                <label className="field-label" htmlFor="acc-delPw">
                  Current password
                </label>
                <input
                  id="acc-delPw"
                  className="input"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="acc-delConfirm">
                  Type your username <strong>{user.username}</strong> to confirm
                </label>
                <input
                  id="acc-delConfirm"
                  className="input"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="account-form-actions">
                <button
                  className="btn btn-destructive btn-sm"
                  disabled={deleteBusy || !canDelete}
                >
                  {deleteBusy ? "Deleting…" : "Delete my account"}
                </button>
              </div>
            </form>
          )}
        </li>
      </ul>
    </div>
  );
}
