import { Link, Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import type { Role } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { SkeletonGrid } from "./Skeletons";

/** Like RequireAuth, but additionally gates on the user's app role. */
export default function RequireRole({
  roles,
  who = "writers and translators",
  children,
}: {
  roles: Role[];
  who?: string;
  children: ReactNode;
}) {
  const { user, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <div className="container">
        <SkeletonGrid count={6} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!roles.includes(user.role)) {
    return (
      <div className="container error-state">
        <p>
          This area is for {who}. Your account is a{" "}
          <strong>{user.role}</strong>.
        </p>
        <p className="text-small text-tertiary">
          Recently promoted? Log out and back in — roles are baked into your
          login token.
        </p>
        <Link to="/" className="btn btn-secondary btn-md">
          Back home
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
