import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { STUDIO_ROLES } from "../lib/roles";

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
          {user && STUDIO_ROLES.includes(user.role) && (
            <NavLink to="/studio" className={linkClass}>
              Studio
            </NavLink>
          )}
          {user?.role === "admin" && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="navbar-auth">
          {user ? (
            <>
              <Link className="navbar-user" to="/account" title={user.username}>
                {user.displayName}
              </Link>
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
