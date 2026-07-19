import type { Role } from "../api/types";
import { ALL_ROLES } from "./roles";

/**
 * The role baked into the JWT at login — display-only, never trusted for
 * access decisions (the server enforces everything). Used to detect a stale
 * session: if an admin changed the user's role, /api/auth/me reports the new
 * role but the stored token still carries the old one until re-login.
 */
export function tokenRole(token: string | null): Role | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const claims = JSON.parse(atob(padded)) as { role?: unknown };
    return ALL_ROLES.includes(claims.role as Role) ? (claims.role as Role) : null;
  } catch {
    return null;
  }
}
