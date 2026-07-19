# Novvels — Frontend Guide

> The big-picture document for the frontend team. Read this first: it explains
> **what kind of website we're building**, who uses it, what data exists, and
> every API endpoint you'll consume. For running the API locally, see
> [README.md](./README.md).

---

## 1. What is Novvels?

**Novvels is a web-novel reading platform** — think of sites like Webnovel,
Royal Road, or the original WordPress "Madara"-theme novel sites. Users come to:

1. **Discover** novels — browse, search, filter by genre, see what's popular
   or featured, and get personalized recommendations.
2. **Read** them — a distraction-free chapter reader that remembers where you
   left off.
3. **Collect** them — a private library of saved / favourite / archived novels
   and a "recently read" history.

On top of the reader experience there is an **authoring side** (writers post
novels and chapters, translators edit chapter text) and an **admin side**
(user management, moderation, site stats).

The site was originally a WordPress site. Its database (novels, chapters,
users) was migrated as-is; this API is a clean, modern layer over that data.
**The frontend never sees anything WordPress-y** — all JSON uses clean keys
(`title`, `slug`, `cover`, …). But two legacy facts matter to you:

- **There is real content from day one**: ~**462 novels**, ~**321,000
  chapters**, ~**18,000 existing user accounts**. Design for a full catalog,
  not an empty state. Existing users can log in with their old passwords.
- **Novel descriptions and chapter text are HTML** (they contain `<p>` tags
  etc.). You must **sanitize before rendering** (e.g. DOMPurify) — see §6.

## 2. Architecture at a glance

```
┌──────────────────┐   HTTPS/JSON    ┌──────────────────┐        ┌──────────┐
│  React frontend  │ ──────────────► │   novvels-api    │ ─────► │  MySQL   │
│   (this team)    │ ◄────────────── │ (Node/Express)   │        │ (Azure)  │
└──────────────────┘                 └──────────────────┘        └──────────┘
```

- The frontend is a **separate repo** and talks to the API **over HTTP only**.
- Auth is **JWT Bearer tokens** — login/register returns a token, you send it
  as `Authorization: Bearer <token>` on protected routes.
- CORS is open, all responses are JSON.
- Base URL in development: `http://localhost:3000` (all routes under `/api`).
- Health check: `GET /api/health` → `{ "status": "ok", "db": "connected" }`.

## 3. Who uses the site — roles

Every account has one **role**. The JWT carries it, and `user.role` comes back
from login/register/`/api/auth/me`, so the frontend can show/hide UI by role.

| Role         | Who they are             | What they can do                                                       |
|--------------|--------------------------|------------------------------------------------------------------------|
| `reader`     | Default for everyone     | Browse, read, manage their own library/progress, get recommendations. |
| `writer`     | Authors                  | Everything a reader can, **plus** create novels, edit *their own* novels, add/edit chapters. |
| `translator` | Translators              | Everything a reader can, **plus** edit chapter *text* on novels they're assigned to. |
| `admin`      | Site staff               | Everything, everywhere: user management, moderation, featuring, stats. |

Two important nuances:

- **Contributors:** a writer/translator can only act on novels they are a
  *contributor* of. Creating a novel automatically makes you its writer;
  admins can grant contributor roles to others. Expect `403` when a
  writer touches a novel that isn't theirs — the API enforces all of this, the
  frontend only needs to react to the status codes.
- **Suspension:** admins can suspend accounts. Suspended users get
  `403 { "error": "Account suspended" }` at login.

## 4. The content model (what the data looks like)

```
Novel  (id, title, slug, description*, cover†, date, genres)
  └── Chapters  (id, name, slug, index ← reading order, date)
        └── Chapter text  (HTML — fetched one chapter at a time)
```

\* `description` is HTML, only returned on the novel detail endpoint.
† `cover` is a full image URL, **or `null`** — always design a placeholder.

- **Genres** are site-wide tags (41 of them: fantasy, romance, action, …).
  Each comes with a live count of published novels, so you can build a genre
  browse page directly from `GET /api/genres`.
- **Chapter order** is the `index` field — always sort/navigate by it, not by
  id or date. Prev/next chapter = neighbors by `index` in the novel's chapter
  list.
- **Popularity** = chapter count (an established long-running series ranks
  higher). That's what `?sort=popular` and cold-start recommendations use.

Per-user data (all private, all keyed off the token — never send a user id):

- **Library lists** — exactly three list types per user: `saved`,
  `favourite`, `archived`. A novel can be in several at once. Add/remove is
  idempotent.
- **Reading progress** — the API stores the *latest chapter read* per novel
  per user. Save it whenever the user opens/finishes a chapter; read it back
  to power a "Continue reading" button.
- **History** — derived from progress: the user's recently-read novels,
  newest first.
- **Recommendations** — up to 20 novels the user hasn't read/collected,
  ranked by genre affinity from their library + history. Each item includes a
  human-readable `reason` ("Because you read Fantasy" / "Popular right now")
  — display it, it makes the feature feel intelligent.

## 5. The pages this implies

The API was designed with these screens in mind (naming is up to you):

| Page                     | Powered by                                                                  |
|--------------------------|------------------------------------------------------------------------------|
| **Home / discover**      | `GET /api/novels?featured=true` (hero rail), `GET /api/novels?sort=popular` or `?sort=latest`, `GET /api/me/recommendations` (if logged in) |
| **Browse / search**      | `GET /api/novels?search=&genre=&sort=&page=` + `GET /api/genres` for the filter UI |
| **Genre page**           | `GET /api/novels?genre=<slug>`                                              |
| **Novel detail**         | `GET /api/novels/:id` (title, HTML description, full chapter list), `GET /api/novels/:id/related` ("You may also like"), `GET /api/me/lists/:type/:novelId` (is it in my lists?), `GET /api/me/progress/:novelId` ("Continue from Chapter 42") |
| **Chapter reader**       | `GET /api/chapters/:id` (HTML text), `PUT /api/me/progress/:novelId` (save position), prev/next from the novel's chapter list |
| **Login / register**     | `POST /api/auth/login`, `POST /api/auth/register`                            |
| **My library**           | `GET /api/me/lists/saved` / `favourite` / `archived` (tabbed?)               |
| **Reading history**      | `GET /api/me/history`                                                        |
| **For you**              | `GET /api/me/recommendations`                                                |
| **Writer dashboard**     | `POST /api/novels`, `PATCH /api/novels/:id`, `POST /api/novels/:id/chapters`, `PATCH /api/chapters/:id`, `PATCH /api/chapters/:id/content` |
| **Admin dashboard**      | `GET /api/admin/stats`, `GET /api/admin/users` (+ role/status PATCHes), `DELETE /api/admin/novels/:id`, `PATCH /api/admin/novels/:id/feature`, `POST /api/admin/contributors` |

## 6. Rules of the road (frontend must-knows)

1. **Sanitize HTML.** `novel.description` and `chapter.content` are raw HTML
   from a migrated database (may contain `<p>`, `<iframe>`, …). Run them
   through DOMPurify (or equivalent) before `dangerouslySetInnerHTML`.
2. **`cover` can be `null`.** Not every novel has a cover image. Ship a
   placeholder.
3. **`chapter.content` can be `null`** for a handful of broken legacy
   chapters — show a friendly "chapter unavailable" state, don't crash.
4. **Auth is stateless JWT.** Store the token, send
   `Authorization: Bearer <token>`. There is no refresh endpoint or logout
   endpoint — logout = drop the token client-side. A `401` on any request
   means the token is missing/expired/invalid → route to login.
5. **Never send user ids for "my" data.** Everything under `/api/me/*` derives
   the user from the token. There is no way (and no need) to pass a user id.
6. **Errors are uniform:** every failure is `{ "error": "message" }` with a
   proper status code — `400` bad input, `401` no/bad token, `403` not
   allowed (role, ownership, suspended), `404` not found, `409` conflict
   (duplicate registration, duplicate contributor), `503` DB down. One error
   handler in your API client can cover the whole app.
7. **Pagination is uniform:** list endpoints take `?page` (1-based) &
   `?limit` (default 20, max 100 — higher values are clamped) and return
   `{ page, limit, total, <items> }`. Compute page count as
   `Math.ceil(total / limit)`.
8. **Dates** are MySQL datetimes serialized as ISO strings — parse with
   `new Date(value)`.
9. **Slugs are provided** (`novel.slug`, `chapter.slug`) so you can build
   pretty URLs like `/novel/solo-leveling`, but **lookups are by numeric id**
   — keep the id in your route state (e.g. `/novel/1859/solo-leveling`).

## 7. API reference

🔓 = public. 🔒 = requires `Authorization: Bearer <token>`. Roles in
parentheses where restricted.

### Health

| Method | Path          | Notes                          |
|--------|---------------|--------------------------------|
| GET 🔓 | `/api/health` | `{ status: "ok", db: "connected" }` |

### Auth

| Method  | Path                 | Notes |
|---------|----------------------|-------|
| POST 🔓 | `/api/auth/register` | `{ username, email, password, displayName? }` → `201 { token, user }`. New accounts are `reader`s. `409` if username/email taken. |
| POST 🔓 | `/api/auth/login`    | `{ login, password }` — `login` accepts **email or username**. → `{ token, user }`. `401` bad credentials, `403` suspended. |
| GET 🔒  | `/api/auth/me`       | → `{ user }` — refetch on app load to restore the session and get the current role. |

`user` shape:

```json
{
  "id": 42, "username": "reader1", "email": "r@example.com",
  "displayName": "Reader One", "role": "reader",
  "registered": "2026-07-06T12:00:00.000Z"
}
```

Client-side form rules (mirror of the server's validation):

- `username`: 3–60 chars, letters/digits/space/`_ . - @`
- `email`: valid email, max 100 chars (lowercased server-side)
- `password`: 8–200 chars
- `displayName`: optional, 1–250 chars, defaults to username

### Catalog (public — no token needed)

| Method | Path                      | Notes |
|--------|---------------------------|-------|
| GET 🔓 | `/api/novels`             | Query: `?page`, `?limit`, `?search` (title substring), `?sort=latest\|title\|popular`, `?genre=<slug>`, `?featured=true` (admin-curated only). → `{ page, limit, total, novels: [{ id, title, slug, cover, date }] }`. |
| GET 🔓 | `/api/novels/:id`         | One novel **+ full chapter list** (sorted by `index`). → `{ id, title, slug, cover, date, description, chapters: [{ id, name, slug, index, date }] }`. |
| GET 🔓 | `/api/novels/:id/related` | Up to 10 novels sharing the most genres. → `{ novels }`. |
| GET 🔓 | `/api/chapters/:id`       | The reader payload. → `{ id, name, content }` — `content` is HTML (sanitize!). |
| GET 🔓 | `/api/genres`             | All genres with live published-novel counts, most-used first. → `{ genres: [{ id, name, slug, count }] }`. |

### My library (🔒 reader features)

`:type` ∈ `saved` | `favourite` | `archived` (anything else → `400`).

| Method    | Path                           | Notes |
|-----------|--------------------------------|-------|
| POST 🔒   | `/api/me/lists/:type/:novelId` | Add (idempotent). → `{ inList: true }` (`201` new / `200` already there). |
| DELETE 🔒 | `/api/me/lists/:type/:novelId` | Remove (idempotent). → `{ inList: false }`. |
| GET 🔒    | `/api/me/lists/:type/:novelId` | Membership check. → `{ inList: boolean }`. |
| GET 🔒    | `/api/me/lists/:type`          | Paginated. → `{ page, limit, total, novels: [{ id, title, slug, cover, addedAt }] }`. |

### Reading progress & history (🔒)

| Method | Path                        | Notes |
|--------|-----------------------------|-------|
| PUT 🔒 | `/api/me/progress/:novelId` | Body `{ chapterId }` — upsert of "latest chapter read". `400` if the chapter doesn't belong to the novel. → `{ saved: true, novelId, chapterId }`. |
| GET 🔒 | `/api/me/progress/:novelId` | → `{ novelId, chapterId, chapterName, chapterIndex, updatedAt }` **or `null`** if never read. |
| GET 🔒 | `/api/me/history`           | Recently read, newest first, paginated. → `{ page, limit, total, history: [{ novelId, title, slug, cover, chapterId, chapterName, chapterIndex, updatedAt }] }`. |

### Recommendations (🔒)

| Method | Path                      | Notes |
|--------|---------------------------|-------|
| GET 🔒 | `/api/me/recommendations` | Up to 20 novels, excluding anything already in the user's lists/history. → `{ recommendations: [{ id, title, slug, cover, reason }] }`. Show the `reason`. |

### Authoring (🔒 writer/translator/admin)

| Method   | Path                       | Who | Notes |
|----------|----------------------------|-----|-------|
| POST 🔒  | `/api/novels`              | writer, admin | `{ title, description?, status? }` (`status` ∈ `publish\|draft\|trash`, default `publish`). Creator becomes the novel's writer-contributor. → `201 { id, title, slug, status }`. |
| PATCH 🔒 | `/api/novels/:id`          | writer\* , admin | Any of `{ title, description, status }`. Setting `status: "trash"` is the soft-delete. → updated novel. |
| POST 🔒  | `/api/novels/:id/chapters` | writer\*, admin | `{ name, content, index? }` — omit `index` to append at the end. → `201 { id, novelId, name, slug, index }`. |
| PATCH 🔒 | `/api/chapters/:id`        | writer\*, admin | Any of `{ name, index }` (metadata only). → `{ id, novelId, name, index }`. |
| PATCH 🔒 | `/api/chapters/:id/content`| writer\*, translator\*, admin | `{ content }` — replaces the chapter text. → `{ id, novelId, updated: true }`. |

\* Must be a contributor on that novel — otherwise `403`.

### Admin (🔒 admin only — everything else gets `403`)

| Method    | Path                              | Notes |
|-----------|-----------------------------------|-------|
| GET 🔒    | `/api/admin/stats`                | Dashboard totals: `{ users: { total, byRole }, novels: { total, published }, chapters: { total }, recentSignups: { last7Days, last30Days } }`. |
| GET 🔒    | `/api/admin/users`                | Paginated; `?search` matches username or email. → `{ page, limit, total, users }` — each user includes `role` and `status`. |
| PATCH 🔒  | `/api/admin/users/:id/role`       | `{ role: "reader"\|"writer"\|"translator"\|"admin" }`. |
| PATCH 🔒  | `/api/admin/users/:id/status`     | `{ status: "active"\|"suspended" }`. |
| DELETE 🔒 | `/api/admin/novels/:id`           | **Soft**-delete (unpublish). Nothing is destroyed. → `{ id, status: "trash" }`. |
| PATCH 🔒  | `/api/admin/novels/:id/feature`   | `{ featured: boolean }` — set/clear the featured flag for homepage curation. |
| POST 🔒   | `/api/admin/contributors`         | `{ userId, novelId, role: "writer"\|"translator" }` — assign someone to a novel. `409` if already assigned. |

## 8. A typical user journey (end to end)

```
1. Land on home        → GET /api/novels?sort=popular          (public)
2. Search "hero"       → GET /api/novels?search=hero
3. Open a novel        → GET /api/novels/1859                  (detail + chapters)
                       → GET /api/novels/1859/related          (suggestions)
4. Sign up             → POST /api/auth/register               (get token)
5. Favourite it        → POST /api/me/lists/favourite/1859
6. Read chapter 1      → GET /api/chapters/1687                (sanitize + render HTML)
                       → PUT /api/me/progress/1859 {chapterId:1687}
7. Come back tomorrow  → GET /api/auth/me                      (restore session)
                       → GET /api/me/history                   ("continue reading" rail)
                       → GET /api/me/progress/1859             (jump to chapter)
                       → GET /api/me/recommendations           ("for you" rail)
```

---

*Questions about a response shape? The source of truth is
[src/types.ts](./src/types.ts) in the API repo — every JSON shape is defined
and commented there.*
