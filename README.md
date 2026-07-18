# Novvels — Web Frontend

The reader-facing web UI for **Novvels**, a web-novel platform (~462 novels,
~321k chapters). React + TypeScript + Vite, styled with the **StarChart**
design system (see [DESIGN.md](./DESIGN.md)).

The backend is a separate repo (`novvels-api`, Node/Express). Everything the
frontend needs to know about it is in
[frontend_handoff.md](./frontend_handoff.md) and [FRONTEND.md](./FRONTEND.md).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

The app expects the API at `http://localhost:3000` by default. To point
elsewhere, copy `.env.example` to `.env` and set `VITE_API_URL`.

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production build locally
```

## What's implemented (Phase 1 — reader experience)

| Route | Page |
|---|---|
| `/` | Home — hero, genre chips, Continue-reading / For-you / Popular / New rails |
| `/browse` | Browse & search — debounced title search, sort, genre filter, pagination |
| `/novel/:id/:slug?` | Novel detail — description, Start/Continue button, saved/favourite/archived toggles, windowed chapter list (100/page, filter, sort direction), related novels |
| `/novel/:novelId/read/:chapterId` | Reader — sanitized chapter HTML, prev/next by `index`, font-size control, saves progress on open |
| `/login`, `/register` | Auth — JWT stored in localStorage, session restored via `GET /api/auth/me`, any 401 logs out globally |
| `/library` | My Library — Saved / Favourites / Archived / History tabs |

Not yet built (tracked as GitHub issues): writer dashboard, admin dashboard,
and features blocked on API gaps (covers in the catalog, featured rail,
account settings — see handoff §8).

## Project layout

```
src/
  api/          types, fetch client (auth header + 401 handling), endpoints
  auth/         AuthContext — login/register/logout + session restore
  components/   NavBar, Cover (placeholder fallback), NovelCard, Rail,
                ChapterList, ListButtons, GenreChips, Pager, SafeHtml, skeletons
  hooks/        useAsync, useDebounce
  lib/          sanitize (DOMPurify), formatting/paths
  pages/        Home, Browse, Novel, Reader, Library, Login, Register, 404
  styles/       tokens.css (StarChart tokens), app.css
```

## Conventions

- **All migrated HTML is sanitized** (DOMPurify, iframes stripped) before
  rendering — never `dangerouslySetInnerHTML` raw API content.
- **Chapter order is `index`**, never parsed from names.
- **Covers**: the public catalog has none; `Cover` renders a deterministic
  gradient placeholder and falls back on broken image URLs.
- **Search is debounced** (400 ms) — the API has no rate limiting and talks to
  a live remote DB.
- The API is slow-ish (0.5–2 s, remote Azure MySQL) — every fetch has a
  skeleton state.
