import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ORIGIN_LABELS, type NovelOrigin } from "../api/types";

const ORIGINS = Object.keys(ORIGIN_LABELS) as NonNullable<NovelOrigin>[];

/**
 * Navbar "Origin" dropdown → the /origin/:origin listings. Closes on outside
 * click, Escape, and route change (i.e. after picking an item).
 */
export default function NavOriginMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const onOriginPage = pathname.startsWith("/origin/");

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="navbar-dropdown" ref={ref}>
      <button
        type="button"
        className={`navbar-link navbar-dropdown-trigger${onOriginPage ? " is-active" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Origin
        <span className="navbar-dropdown-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="navbar-dropdown-menu" role="menu">
          {ORIGINS.map((o) => (
            <NavLink
              key={o}
              to={`/origin/${o}`}
              role="menuitem"
              className={({ isActive }) =>
                `navbar-dropdown-item${isActive ? " is-active" : ""}`
              }
            >
              {ORIGIN_LABELS[o]}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
