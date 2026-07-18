import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `navbar-link${isActive ? " is-active" : ""}`;

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          <span className="logo-star" aria-hidden>
            ✦
          </span>
          Novvels
        </Link>
        <nav className="navbar-links" aria-label="Main">
          <NavLink to="/browse" className={linkClass}>
            Browse
          </NavLink>
          {user && (
            <NavLink to="/library" className={linkClass}>
              My Library
            </NavLink>
          )}
        </nav>
        <div className="navbar-auth">
          {user ? (
            <>
              <span className="navbar-user" title={user.username}>
                {user.displayName}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
