import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";

// Mirrors the server's validation rules (FRONTEND.md §7).
const USERNAME_RE = /^[A-Za-z0-9 _.\-@]{3,60}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  usePageMeta({ title: "Sign up" });
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!USERNAME_RE.test(username))
      errors.username =
        "3–60 characters; letters, digits, spaces and _ . - @ only.";
    if (!EMAIL_RE.test(email) || email.length > 100)
      errors.email = "Enter a valid email (max 100 characters).";
    if (password.length < 8 || password.length > 200)
      errors.password = "Password must be 8–200 characters.";
    if (displayName && displayName.length > 250)
      errors.displayName = "Display name is too long (max 250).";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setBusy(true);
    setError(null);
    try {
      await register({
        username: username.trim(),
        email: email.trim(),
        password,
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
      });
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Join SmuttyHeaven</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className={`input${fieldErrors.username ? " is-error" : ""}`}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
            {fieldErrors.username && (
              <div className="field-help is-error">{fieldErrors.username}</div>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={`input${fieldErrors.email ? " is-error" : ""}`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email && (
              <div className="field-help is-error">{fieldErrors.email}</div>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={`input${fieldErrors.password ? " is-error" : ""}`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErrors.password ? (
              <div className="field-help is-error">{fieldErrors.password}</div>
            ) : (
              <div className="field-help">At least 8 characters.</div>
            )}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="displayName">
              Display name <span className="text-tertiary">(optional)</span>
            </label>
            <input
              id="displayName"
              className={`input${fieldErrors.displayName ? " is-error" : ""}`}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            {fieldErrors.displayName && (
              <div className="field-help is-error">{fieldErrors.displayName}</div>
            )}
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
