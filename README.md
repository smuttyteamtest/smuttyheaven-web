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

## Phase 2 — writer studio (issue #1)

| Route | Page |
|---|---|
| `/studio` | Studio — role-gated (`writer`/`translator`/`admin`); create novel (publish/draft), track existing novels, device-local "my novels" list |
| `/studio/novel/:id` | Novel editor — edit title/synopsis/status (trash = soft delete, restorable), add chapters, edit chapter name/index, edit chapter text with HTML preview; translators get text-only editing |

Phase 2 notes:

- **No `GET /api/me/novels` endpoint exists** (handoff §8.3) and drafts 404 on
  the public detail route, so the studio keeps a per-user **localStorage
  workspace** (`novvels_workspace_<userId>`) of created/tracked novels and the
  chapters created on this device. It's a stopgap — ask the backend for a
  my-novels endpoint and delete `src/lib/workspace.ts` when it ships.
- **Chapter uploads are size-checked** client-side (~100 KB JSON body cap —
  the API 500s above it).
- **Per-novel contributor 403s** ("You are not a contributor…") and stale-JWT
  role 403s are surfaced with a "log out and back in" hint — roles are baked
  into the login token.

## Phase 2 — admin dashboard (issue #2)

| Route | Page |
|---|---|
| `/admin` | Admin — role-gated (`admin` only); tabs for Overview / Users / Novels / Contributors |

- **Overview**: site stats from `GET /api/admin/stats` (accounts by role,
  novels, chapters, recent signups).
- **Users**: requires a search term before listing (~18k accounts); change
  role (with the "must re-login for it to take effect" caveat surfaced) and
  suspend/activate. Your own row's controls are disabled.
- **Novels**: feature/unfeature (blind toggles — the API has no read of the
  flag yet, issue #4), trash with a two-step confirm, restore
  session-trashed rows inline, plus a restore-by-id card (trashed novels
  vanish from search).
- **Contributors**: grant writer/translator on a specific novel via
  search-assisted user/novel pickers; 409 duplicates surface verbatim, and
  a mismatched app role triggers a "fix it in the Users tab" hint. Grants
  are write-only in the API (no list/revoke yet).

Not yet built (tracked as GitHub issues): features blocked on API gaps
(covers in the catalog, featured rail, account settings — see handoff §8).

## Project layout

```
src/
  api/          types, fetch client (auth header + 401 handling), endpoints
  auth/         AuthContext — login/register/logout + session restore
  components/   NavBar, Cover (placeholder fallback), NovelCard, Rail,
                ChapterList, ListButtons, GenreChips, Pager, SafeHtml,
                skeletons, RequireAuth/RequireRole, StatusChip,
                ChapterEditorPanel, Admin{Users,Novels,Contributors}Panel
  hooks/        useAsync, useDebounce
  lib/          sanitize (DOMPurify), formatting/paths, roles,
                workspace (localStorage my-novels stopgap), payload size guard
  pages/        Home, Browse, Novel, Reader, Library, Login, Register,
                Studio, NovelEditor, Admin, 404
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
