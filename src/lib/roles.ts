import type { Role } from "../api/types";

/** Roles that see the Studio at all. */
export const STUDIO_ROLES: Role[] = ["writer", "translator", "admin"];

/** Create novels, edit novel details, add chapters, edit chapter metadata. */
export function canWrite(role: Role): boolean {
  return role === "writer" || role === "admin";
}

/** Edit chapter text — the one authoring action translators share. */
export function canEditText(role: Role): boolean {
  return canWrite(role) || role === "translator";
}

/**
 * Per-novel contributor 403s ("You are not a contributor on this novel") and
 * stale-JWT 403s look identical to the user — append the fix for both.
 * Roles are baked into the login token, so promotions need a re-login.
 */
export function explain403(message: string): string {
  return `${message} — if an admin just added you as a contributor or changed your role, log out and back in (roles are baked into your login token).`;
}
