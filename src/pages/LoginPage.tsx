import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { usePageMeta } from "../hooks/usePageMeta";

export default function LoginPage() {
  usePageMeta({ title: "Log in" });
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!loginId.trim() || !password) {
      setError("Enter your username/email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(loginId.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h2>Welcome back</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="field-label" htmlFor="login">
              Username or email
            </label>
            <input
              id="login"
              className="input"
              autoComplete="username"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: "100%" }} disabled={busy}>
            {busy ? "Logging in…" : "Log in"}
          </button>
        </form>
        <p className="auth-switch">
          New to SmuttyHeaven? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
