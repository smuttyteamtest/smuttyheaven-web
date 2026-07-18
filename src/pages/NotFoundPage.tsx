import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="container empty-state" style={{ paddingTop: "var(--sp-8)" }}>
      <span className="empty-icon" aria-hidden>
        🌠
      </span>
      <h2>Lost in space</h2>
      <p>This page doesn't exist — maybe the novel moved or the link is old.</p>
      <Link to="/" className="btn btn-primary btn-md">
        Back to home
      </Link>
    </div>
  );
}
