# novvels-api — Frontend Integration Handoff

> **Audience:** the frontend team and/or an AI coding agent building the web UI.

> This document is self-contained: everything needed to integrate a frontend

> against this backend is here — how to run it, every endpoint with request and

> response shapes, auth, error handling, TypeScript types, suggested

> screen-to-endpoint mapping, gotchas, and known gaps. Copy this file into the

> frontend repo if that's easier.

**Backend stack:** Node 18+ / Express / TypeScript, MySQL 8 (Azure), migrated

from a WordPress/Madara web-novel site. \*\*462 novels, ~321,000 chapters,

~18,000 users.\*\* The frontend talks to it over plain HTTP/JSON — no GraphQL,

no cookies, no server-rendered pages.

---

## Table of contents

1. [Running the backend](#1-running-the-backend)

2. [Global conventions](#2-global-conventions)

3. [Authentication & session lifecycle](#3-authentication--session-lifecycle)

4. [Endpoint reference](#4-endpoint-reference)

- [Health](#41-health)

- [Auth](#42-auth)

- [Novels (public reads)](#43-novels-public-reads)

- [Genres](#44-genres)

- [Chapters (public read)](#45-chapters-public-read)

- [My library — lists](#46-my-library--lists)

- [Reading progress & history](#47-reading-progress--history)

- [Recommendations](#48-recommendations)

- [Authoring (writer / translator)](#49-authoring-writer--translator)

- [Admin](#410-admin)

5. [TypeScript types (copy into the frontend)](#5-typescript-types)

6. [Suggested screen → endpoint mapping](#6-suggested-screen--endpoint-mapping)

7. [Gotchas & integration notes](#7-gotchas--integration-notes)

8. [Known gaps (what the API does NOT provide yet)](#8-known-gaps)

9. [End-to-end smoke test](#9-end-to-end-smoke-test)

---

## 1. Running the backend

```bash

cd novvels-api

npm install

npm run dev # tsx watch, http://localhost:3000

```

Requirements:

- **Node 18+**.

- A `.env` in the repo root (already present in the backend repo) providing

`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL=true`,

`PORT` (default 3000), and `JWT_SECRET`. The server **refuses to start**

without `JWT_SECRET`.

- The database is a **remote Azure MySQL instance with real data** — there is

no local seed/fixture step. Data is live immediately.

Verify it's up before doing anything else:

```

GET http://localhost:3000/api/health

→ 200 { "status": "ok", "db": "connected" }

```

If `db` is `"disconnected"` you get `503` — fix connectivity before debugging

the frontend.

**Base URL:** `http://localhost:3000` in development. Make it a frontend env

var (e.g. `VITE_API_URL` / `NEXT_PUBLIC_API_URL`); there is no `/v1` prefix —

all paths start with `/api/`.

**CORS is fully open** (`Access-Control-Allow-Origin: *`), so the dev frontend

can call the API from any port without a proxy.

---

## 2. Global conventions

These hold for **every** endpoint:

| Convention | Detail |

|---|---|

| Format | JSON in, JSON out. Send `Content-Type: application/json` on every request with a body. |

| Errors | Always `{ "error": "<human-readable message>" }` with a correct HTTP status. Never HTML, never a stack trace. Unknown paths/methods return `404 { "error": "Not found" }` (also JSON). |

| Validation errors | `400` with the first failing rule as the message, e.g. `{ "error": "chapterId must be a positive integer" }`. Messages are safe to show users. |

| Auth | `Authorization: Bearer <jwt>` header. Missing/malformed header → `401 { "error": "Missing or malformed Authorization header" }`; bad/expired token → `401 { "error": "Invalid or expired token" }`. |

| IDs | Always numbers (WordPress post/user IDs). |

| Dates | ISO-8601 UTC strings, e.g. `"2026-07-08T19:14:39.000Z"`. |

| Pagination | List endpoints take `?page` (1-based, default 1) and `?limit` (default 20, **hard-capped at 100** — larger values are silently clamped). Response echoes `{ page, limit, total, <items> }`. Bad values fall back to defaults rather than erroring. A page past the end returns an empty items array. |

| HTML content | `description` (novel) and `content` (chapter) are **raw HTML** from WordPress (`<p>`, occasional `<iframe>`). **Sanitize before rendering** (DOMPurify or equivalent). Never inject unsanitized. |

| Covers | `cover` is a full image URL or `null`. Always render a placeholder for `null`. |

| Clean keys | WordPress column names never leak: it's `title`/`slug`/`id`, not `post_title`/`post_name`/`ID`. |

| Statuses used | `200` OK, `201` created, `400` bad input, `401` unauthenticated, `403` authenticated but not allowed, `404` not found, `409` conflict/duplicate, `500` unexpected, `503` health check with DB down. |

**Roles** (app-level, carried in the JWT): `reader` (default), `writer`,

`translator`, `admin`. Additionally, writers/translators only operate on

novels where they hold a **per-novel contributor role** (`writer` or

`translator`); admins bypass all contributor checks. UI should hide

writer/translator/admin features from users whose role doesn't allow them —

but the API enforces everything server-side regardless.

---

## 3. Authentication & session lifecycle

1. **Register** (`POST /api/auth/register`) or **login**

(`POST /api/auth/login`). Both return `{ token, user }`.

2. Store the token (localStorage is fine for this app) and attach

`Authorization: Bearer <token>` to every `/api/me/*`, authoring, and admin

request.

3. Tokens are JWTs valid for **7 days**. There is \*\*no refresh endpoint and no

logout endpoint\*\* — logout is client-side: discard the token. On any `401`,

treat the session as dead: clear the token and route to the login screen.

4. On app boot with a stored token, call `GET /api/auth/me` to restore the

session (and get the user's **current** role — see below).

Things the frontend must know:

- **The role inside the JWT is frozen at login.** If an admin promotes a user

to `writer`, that user's existing token still says `reader`, and

writer-gated endpoints will return `403` until they log in again.

`GET /api/auth/me` reads the role fresh from the DB — if `me.user.role`

differs from the role you decoded from the JWT (or you get surprise 403s),

prompt the user to re-login.

- **Suspended accounts** can't log in (`403 { "error": "Account suspended" }`)

but their existing tokens keep working until expiry.

- `login` accepts **username or email** in the single `login` field.

- Existing WordPress users (~18k) can log in with their original passwords.

For development, just register a fresh account.

- There is no password reset, no email verification, and no profile-editing

endpoint yet (see [Known gaps](#8-known-gaps)).

---

## 4. Endpoint reference

Legend: 🔓 public · 🔑 any logged-in user · ✍️ writer/admin (+ contributor

check where noted) · 🌐 translator/writer/admin (+ contributor check) ·

👑 admin only.

Summary of all 30 endpoints:

| # | Method | Path | Auth |

|---|--------|------|------|

| 1 | GET | `/api/health` | 🔓 |

| 2 | POST | `/api/auth/register` | 🔓 |

| 3 | POST | `/api/auth/login` | 🔓 |

| 4 | GET | `/api/auth/me` | 🔑 |

| 5 | GET | `/api/novels` | 🔓 |

| 6 | GET | `/api/novels/:id` | 🔓 |

| 7 | GET | `/api/novels/:id/related` | 🔓 |

| 8 | POST | `/api/novels` | ✍️ |

| 9 | PATCH | `/api/novels/:id` | ✍️ + contributor |

| 10 | POST | `/api/novels/:id/chapters` | ✍️ + contributor |

| 11 | GET | `/api/genres` | 🔓 |

| 12 | GET | `/api/chapters/:id` | 🔓 |

| 13 | PATCH | `/api/chapters/:id` | ✍️ + contributor |

| 14 | PATCH | `/api/chapters/:id/content` | 🌐 + contributor |

| 15 | POST | `/api/me/lists/:type/:novelId` | 🔑 |

| 16 | DELETE | `/api/me/lists/:type/:novelId` | 🔑 |

| 17 | GET | `/api/me/lists/:type/:novelId` | 🔑 |

| 18 | GET | `/api/me/lists/:type` | 🔑 |

| 19 | PUT | `/api/me/progress/:novelId` | 🔑 |

| 20 | GET | `/api/me/progress/:novelId` | 🔑 |

| 21 | GET | `/api/me/history` | 🔑 |

| 22 | GET | `/api/me/recommendations` | 🔑 |

| 23 | GET | `/api/admin/users` | 👑 |

| 24 | PATCH | `/api/admin/users/:id/role` | 👑 |

| 25 | PATCH | `/api/admin/users/:id/status` | 👑 |

| 26 | DELETE | `/api/admin/novels/:id` | 👑 |

| 27 | PATCH | `/api/admin/novels/:id/feature` | 👑 |

| 28 | POST | `/api/admin/contributors` | 👑 |

| 29 | GET | `/api/admin/stats` | 👑 |

| 30 | _(anything else)_ | | `404 { "error": "Not found" }` |

### 4.1 Health

#### `GET /api/health` 🔓

`200 { "status": "ok", "db": "connected" }` or

`503 { "status": "error", "db": "disconnected", "error": "Database connection failed" }`.

### 4.2 Auth

#### `POST /api/auth/register` 🔓

Body:

```json
{
  "username": "charli_reader", // 3–60 chars; letters, digits, space, _ . - @

  "email": "charli@example.com", // valid email, ≤100 chars (lowercased)

  "password": "at-least-8-chars", // 8–200 chars

  "displayName": "Charli" // optional, defaults to username
}
```

`201`:

```json
{
  "token": "eyJhbGciOi…",

  "user": {
    "id": 225197,

    "username": "charli_reader",

    "email": "charli@example.com",

    "displayName": "Charli",

    "role": "reader",

    "registered": "2026-07-12T04:20:00.000Z"
  }
}
```

Errors: `400` validation (message names the rule), `409

{ "error": "Username or email already taken" }`. New accounts are always

`reader`.

#### `POST /api/auth/login` 🔓

Body: `{ "login": "charli_reader", "password": "…" }` — `login` matches

username **or** email.

`200` — same `{ token, user }` shape as register.

Errors: `400` missing fields, `401 { "error": "Invalid credentials" }`

(never says which part was wrong), `403 { "error": "Account suspended" }`.

#### `GET /api/auth/me` 🔑

`200 { "user": { …PublicUser } }` — note it is **wrapped in `user`**, unlike

the token endpoints. Role is read fresh from the DB. Errors: `401`, `404` if

the account no longer exists.

### 4.3 Novels (public reads)

#### `GET /api/novels` 🔓

Query params (all optional, all lenient — invalid values fall back to

defaults):

| Param | Default | Meaning |

|---|---|---|

| `page` | 1 | 1-based page |

| `limit` | 20 | page size, clamped to 100 |

| `search` | — | case-insensitive substring match on **title only** |

| `sort` | `latest` | `latest` (newest first) · `title` (A–Z) · `popular` (most chapters first) |

| `genre` | — | genre **slug** from `GET /api/genres`, e.g. `fantasy` |

`200`:

```json
{
  "page": 1,

  "limit": 20,

  "total": 462,

  "novels": [
    {
      "id": 8757,
      "title": "Reincarnation Of The Strongest Sword God",

      "slug": "reincarnation-of-the-strongest-sword-god",

      "cover": "https://…/wp-content/uploads/2020/07/example.jpg",

      "date": "2020-07-15T05:28:04.000Z"
    }
  ]
}
```

`cover` is the featured-image URL or `null` (added 2026-07-19; formerly
known-gap #1). No description in this response — that's detail-only.

#### `GET /api/novels/:id` 🔓

`200` — the novel plus its **complete** chapter list, ordered by reading order

(`index` ascending):

```json
{
  "id": 8757,

  "title": "Reincarnation Of The Strongest Sword God",

  "slug": "reincarnation-of-the-strongest-sword-god",

  "description": "<p>Starting over once more…</p>",

  "cover": "https://…/wp-content/uploads/2020/07/example.jpg",

  "date": "2020-07-15T05:28:04.000Z",

  "chapters": [
    {
      "id": 334646,
      "name": "Chapter 2250 - A Person You Shouldn't Provoke",

      "slug": "chapter-2250-a-person-you-shouldnt-provoke",

      "index": 0,
      "date": "2021-01-20T11:52:22.000Z"
    }
  ]
}
```

- `description` is HTML — sanitize.

- `chapters` can contain **thousands of entries** (novels here average ~700

chapters). Virtualize/paginate the chapter list client-side.

- `chapters[i].index` is the authoritative reading order. Don't parse chapter

numbers out of `name` (migrated data has quirks — the chapter at `index: 0`

is not always named "Chapter 1").

- Chapter navigation (prev/next in the reader) is client-side: from this

array, prev/next of chapter `c` are the neighbors by `index`.

Errors: `400` bad id, `404` unknown/unpublished novel.

#### `GET /api/novels/:id/related` 🔓

`200 { "novels": [ …up to 10 Novel list items… ] }` — ranked by number of

shared genres, no pagination, same shape as the `/api/novels` items

(including `cover`). `404` if the base novel doesn't exist.

### 4.4 Genres

#### `GET /api/genres` 🔓

`200`:

```json
{
  "genres": [
    { "id": 12, "name": "Fantasy", "slug": "fantasy", "count": 214 },

    { "id": 15, "name": "Romance", "slug": "romance", "count": 178 }
  ]
}
```

~41 genres, ordered by `count` (published novels carrying the genre) DESC.

Counts are computed live. Use `slug` for the `?genre=` filter on

`/api/novels`. Cache this response client-side — it changes rarely.

### 4.5 Chapters (public read)

#### `GET /api/chapters/:id` 🔓

The reader endpoint. `200`:

```json
{
  "id": 334646,
  "name": "Chapter 2250 - A Person You Shouldn't Provoke",

  "content": "<p>…full chapter text as HTML…</p>"
}
```

- `content` is HTML — **sanitize before rendering** (it can contain

`<iframe>`s in old data; strip them).

- `content` can be `null` (chapter metadata exists but text row is missing) —

render a "chapter unavailable" state.

- Some very old chapters contain Lorem-Ipsum placeholder text (migration

leftovers). Nothing to do about it client-side; don't be surprised in QA.

- The response has **no `novelId` and no prev/next links** — the reader screen

needs the novel's chapter array (from `GET /api/novels/:id`) in state to

navigate.

Errors: `400` bad id, `404` unknown chapter.

### 4.6 My library — lists

Three lists per user: `saved`, `favourite`, `archived`. `:type` must be one of

those or you get `400 { "error": "type must be one of: saved, favourite, archived" }`.

All four endpoints: `401` without a token.

#### `POST /api/me/lists/:type/:novelId` 🔑

Add to a list. `201 { "inList": true }` when newly added,

`200 { "inList": true }` when it was already there (idempotent — safe to

spam). `404` if the novel doesn't exist/isn't published.

#### `DELETE /api/me/lists/:type/:novelId` 🔑

Remove. Always `200 { "inList": false }`, even if it wasn't there (idempotent).

#### `GET /api/me/lists/:type/:novelId` 🔑

Membership check for rendering toggle buttons: `200 { "inList": true|false }`.

#### `GET /api/me/lists/:type` 🔑

Paginated (`?page`, `?limit`), newest-added first. `200`:

```json
{
  "page": 1,
  "limit": 20,
  "total": 3,
  "novels": [
    {
      "id": 8757,
      "title": "…",
      "slug": "…",

      "cover": "https://…/SoloLeveling.jpg", // or null

      "addedAt": "2026-07-12T04:22:10.000Z"
    }
  ]
}
```

This response **does** include `cover`.

### 4.7 Reading progress & history

One saved position per (user, novel). All endpoints `401` without a token.

#### `PUT /api/me/progress/:novelId` 🔑

Call whenever the user opens/finishes a chapter. Body:

`{ "chapterId": 334646 }`.

`200 { "saved": true, "novelId": 8757, "chapterId": 334646 }`. Upsert —

re-reading just updates the row. Errors: `400` bad ids, and

`400 { "error": "Chapter does not belong to that novel" }` if the pair

mismatches.

#### `GET /api/me/progress/:novelId` 🔑

For the "Resume reading" button on a novel page. `200` with either a Progress

object **or the literal JSON body `null`** if the user hasn't read this novel:

```json
{
  "novelId": 8757,
  "chapterId": 334646,

  "chapterName": "Chapter 2250 - A Person You Shouldn't Provoke",

  "chapterIndex": 0,
  "updatedAt": "2026-07-12T04:25:00.000Z"
}
```

`chapterName`/`chapterIndex` can be `null` if the chapter was since deleted.

#### `GET /api/me/history` 🔑

"Continue reading" rail / history page. Paginated, most recently read first.

`200`:

```json
{
  "page": 1,
  "limit": 20,
  "total": 1,
  "history": [
    {
      "novelId": 8757,
      "title": "…",
      "slug": "…",
      "cover": "https://…",

      "chapterId": 334646,
      "chapterName": "…",
      "chapterIndex": 0,

      "updatedAt": "2026-07-12T04:25:00.000Z"
    }
  ]
}
```

### 4.8 Recommendations

#### `GET /api/me/recommendations` 🔑

Personalized "For you" feed. `200`:

```json
{
  "recommendations": [
    {
      "id": 236921,
      "title": "Godly Empress Doctor",
      "slug": "godly-empress-doctor",

      "cover": "https://…/Godly-Empress-Doctor.jpg",

      "reason": "Because you read Action"
    }
  ]
}
```

- Up to **20** novels; no pagination.

- **Never contains** anything already in the user's lists (any type) or

reading history — so it changes after list/progress writes; refetch when

the user returns to the feed.

- `reason` is display-ready: `"Because you read <Genre>"` for personalized

results, `"Popular right now"` for new users with no history (cold start).

Ranking is genre-affinity from the user's favourites + saved + read novels,

popularity as tiebreaker; archived novels are excluded from results but

don't feed the taste profile.

- Expect it to be one of the slower endpoints (~1–2s) — show a skeleton.

### 4.9 Authoring (writer / translator)

Two permission layers, both enforced server-side:

1. App role: endpoint returns `403 { "error": "Insufficient permissions" }`

unless the JWT role is in the allowed set (admin always allowed).

2. Per-novel contributor role: `403

{ "error": "You are not a contributor on this novel" }` unless the user has

the required contributor role **on that specific novel** (admin bypasses).

Creating a novel automatically grants the creator the `writer` contributor

role on it. Additional contributors are granted by an admin

(`POST /api/admin/contributors`).

#### `POST /api/novels` ✍️ (any writer/admin — no contributor check; creates ownership)

Body:

```json
{
  "title": "My New Novel", // required, ≤255 chars

  "description": "<p>Optional HTML synopsis</p>",

  "status": "draft"
} // optional: publish | draft | trash; default publish
```

`201 { "id": 250001, "title": "My New Novel", "slug": "my-new-novel", "status": "draft" }`

(slug is auto-generated; deduped with an id suffix if taken).

#### `PATCH /api/novels/:id` ✍️ + `writer` contributor

Body: at least one of `{ "title", "description", "status" }` (else

`400 provide at least one of: title, description, status`). Setting

`"status": "trash"` is the soft-delete; `"publish"` restores/publishes a

draft.

`200 { "id", "title", "slug", "description", "status" }`.

Errors: `401`, `403` (role or contributor), `404` unknown novel. Works on

drafts and trashed novels (writers can restore).

#### `POST /api/novels/:id/chapters` ✍️ + `writer` contributor

Body:

```json
{
  "name": "Chapter 1 — The Beginning", // required, ≤255

  "content": "<p>Chapter text (HTML)</p>", // required, non-empty

  "index": 1
} // optional reading order; appended after current max if omitted
```

`201 { "id": 400001, "novelId": 250001, "name": "Chapter 1 — The Beginning", "slug": "chapter-1-the-beginning", "index": 1 }`.

⚠️ Request bodies over ~100 KB are rejected by the JSON body parser (surfaces

as a 500 currently) — keep chapter uploads under that or split them.

#### `PATCH /api/chapters/:id` ✍️ + `writer` contributor (on the chapter's novel)

Rename / reorder a chapter. Body: at least one of `{ "name", "index" }`.

`200 { "id", "novelId", "name", "index" }`. Slug is intentionally left

unchanged so links keep working.

#### `PATCH /api/chapters/:id/content` 🌐 + `writer` **or** `translator` contributor

Replace the chapter text. Body: `{ "content": "<p>new text</p>" }`.

`200 { "id", "novelId", "updated": true }`.

`404 { "error": "Chapter text not found" }` if the chapter has no linked text

row. This is the **only** authoring endpoint translators can use.

### 4.10 Admin

Everything under `/api/admin/*` requires an `admin` token: `401`

unauthenticated, `403` for any other role.

#### `GET /api/admin/users` 👑

`?page`, `?limit` (≤100), `?search` (substring on username OR email).

`200 { page, limit, total, users: [ { …PublicUser, "status": "active"|"suspended" } ] }`,

newest registrations first. \*\*Note: `total` is ~18k users — always paginate,

require a search term for a good UX.\*\*

#### `PATCH /api/admin/users/:id/role` 👑

Body `{ "role": "reader"|"writer"|"translator"|"admin" }` →

`200 { "user": { …AdminUser } }`. Remember: the target user must re-login

before their token carries the new role.

#### `PATCH /api/admin/users/:id/status` 👑

Body `{ "status": "active"|"suspended" }` → `200 { "user": { …AdminUser } }`.

Suspension blocks future logins only; live tokens last until expiry (≤7 days).

#### `DELETE /api/admin/novels/:id` 👑

Soft-delete (sets status `trash`; nothing is erased; restore via

`PATCH /api/novels/:id` with `"status": "publish"`).

`200 { "id": 8757, "status": "trash" }`. Trashed novels vanish from all

public/reader endpoints immediately.

#### `PATCH /api/admin/novels/:id/feature` 👑

Body `{ "featured": true|false }` → `200 { "id": 8757, "featured": true }`.

Idempotent both ways. ⚠️ There is \*\*no public endpoint that returns featured

novels yet\*\* — see [Known gaps](#8-known-gaps).

#### `POST /api/admin/contributors` 👑

Body `{ "userId": 225197, "novelId": 250001, "role": "writer"|"translator" }`

→ `201 { "novelId", "userId", "role" }`.

`404` unknown user or novel; `409

{ "error": "User already holds that role on this novel" }`.

#### `GET /api/admin/stats` 👑

Dashboard numbers. `200`:

```json
{
  "users": {
    "total": 18234,
    "byRole": { "reader": 18200, "writer": 20, "translator": 10, "admin": 4 }
  },

  "novels": { "total": 465, "published": 462 },

  "chapters": { "total": 321115 },

  "recentSignups": { "last7Days": 12, "last30Days": 40 }
}
```

---

## 5. TypeScript types

Copy these into the frontend as-is (they mirror `src/types.ts` +

`src/validation.ts` in the backend):

```ts
// ── Enums ────────────────────────────────────────────────────────────────

export type Role = "reader" | "writer" | "translator" | "admin";

export type UserStatus = "active" | "suspended";

export type ContributorRole = "writer" | "translator";

export type ListType = "saved" | "favourite" | "archived";

export type NovelSort = "latest" | "title" | "popular";

export type NovelStatus = "publish" | "draft" | "trash";

// ── Shared ───────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
}

export interface Paginated {
  // extend per endpoint; items live under

  page: number;
  limit: number;
  total: number; // a per-endpoint key:
} // novels / history / users

// ── Auth ─────────────────────────────────────────────────────────────────

export interface PublicUser {
  id: number;
  username: string;
  email: string;

  displayName: string;
  role: Role;
  registered: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
} // login/register

export interface MeResponse {
  user: PublicUser;
} // GET /api/auth/me

// ── Catalog ──────────────────────────────────────────────────────────────

export interface Novel {
  // list item; detail adds description+chapters

  id: number;
  title: string;
  slug: string;

  cover: string | null; // featured-image URL; always render a fallback

  date: string;

  description?: string; // HTML — sanitize

  chapters?: ChapterSummary[]; // only on GET /api/novels/:id, full list
}

export interface ChapterSummary {
  id: number;
  name: string;
  slug: string;

  index: number; // authoritative reading order

  date: string;
}

export interface Chapter {
  // GET /api/chapters/:id

  id: number;
  name: string;

  content: string | null; // HTML — sanitize; null = text missing
}

export interface Genre {
  id: number;
  name: string;
  slug: string;
  count: number;
}

// ── Reader library ───────────────────────────────────────────────────────

export interface ListNovel {
  id: number;
  title: string;
  slug: string;

  cover: string | null;
  addedAt: string;
}

export interface Progress {
  // GET /api/me/progress/:novelId → Progress | null

  novelId: number;
  chapterId: number;

  chapterName: string | null;
  chapterIndex: number | null;

  updatedAt: string;
}

export interface HistoryEntry {
  novelId: number;
  title: string;
  slug: string;
  cover: string | null;

  chapterId: number;
  chapterName: string | null;
  chapterIndex: number | null;

  updatedAt: string;
}

export interface Recommendation {
  id: number;
  title: string;
  slug: string;

  cover: string | null;

  reason: string; // display-ready, e.g. "Because you read Fantasy"
}

// ── Admin ────────────────────────────────────────────────────────────────

export interface AdminUser extends PublicUser {
  status: UserStatus;
}

export interface AdminStats {
  users: { total: number; byRole: Record<Role, number> };

  novels: { total: number; published: number };

  chapters: { total: number };

  recentSignups: { last7Days: number; last30Days: number };
}
```

Minimal fetch wrapper the UI can build on:

```ts
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");

  const res = await fetch(`${API}${path}`, {
    ...init,

    headers: {
      "Content-Type": "application/json",

      ...(token ? { Authorization: `Bearer ${token}` } : {}),

      ...init.headers,
    },
  });

  if (res.status === 401) {
    localStorage.removeItem("token"); /* → login route */
  }

  const body = await res.json(); // every response, success or error, is JSON

  if (!res.ok) throw new Error((body as ApiError).error);

  return body as T;
}
```

---

## 6. Suggested screen → endpoint mapping

| Screen | Endpoints |

|---|---|

| **Home** | `GET /api/novels?sort=popular` (popular rail) · `GET /api/novels?sort=latest` (new rail) · `GET /api/me/recommendations` ("For you", logged-in only) · `GET /api/me/history` ("Continue reading" rail) · `GET /api/genres` (genre chips) |

| **Browse / search** | `GET /api/novels?search=&sort=&genre=&page=` — all params compose |

| **Genre page** | `GET /api/novels?genre=<slug>` |

| **Novel detail** | `GET /api/novels/:id` (info + chapter list) · `GET /api/novels/:id/related` · `GET /api/me/progress/:novelId` (Resume button) · `GET /api/me/lists/:type/:novelId` ×3 (button states) · `POST/DELETE /api/me/lists/:type/:novelId` (toggles) |

| **Reader** | `GET /api/chapters/:id` (text) · `PUT /api/me/progress/:novelId` (fire on chapter open) · prev/next from the novel's `chapters[]` held in state |

| **My library** | `GET /api/me/lists/saved` / `favourite` / `archived` (tabs) · `GET /api/me/history` |

| **Login / register** | `POST /api/auth/login` · `POST /api/auth/register` · `GET /api/auth/me` (session restore) |

| **Writer dashboard** | `POST /api/novels` · `PATCH /api/novels/:id` · `POST /api/novels/:id/chapters` · `PATCH /api/chapters/:id` · `PATCH /api/chapters/:id/content` (gate UI on `role ∈ {writer, admin}`; expect per-novel 403s — see gaps) |

| **Translator view** | `PATCH /api/chapters/:id/content` only |

| **Admin dashboard** | `GET /api/admin/stats` · `GET /api/admin/users?search=` · `PATCH /api/admin/users/:id/role` / `status` · `DELETE /api/admin/novels/:id` · `PATCH /api/admin/novels/:id/feature` · `POST /api/admin/contributors` |

Recommended reader behavior: on opening a chapter, `PUT` progress immediately

(don't wait for scroll-to-bottom) — history and "Resume" then always point at

the latest opened chapter, which matches how the API models progress (one

chapter pointer per novel, no percentage).

---

## 7. Gotchas & integration notes

- **Latency:** the DB is remote Azure MySQL; typical responses take

**0.5–2 s**. Design with skeletons/spinners everywhere, cache

`GET /api/genres`, and don't waterfall requests that can run in parallel.

- **Sanitize all HTML** (`description`, chapter `content`). Old rows contain

`<iframe>` embeds; strip script/iframe at minimum.

- **Chapter lists are huge.** `GET /api/novels/:id` returns _every_ chapter

(some novels: 2,000+). Virtualize the list; don't render 2,000 DOM nodes.

- **`index`, not name, is the reading order.** Migrated data has chapters

whose display name ("Chapter 2250") disagrees with their `index`. Sort and

navigate by `index`; only display `name`.

- **Cover URLs are hot-linked** to the old site's domain

(`lightnovelheaven.com/wp-content/uploads/…`). They may load slowly or

break; always have an `onerror` fallback/placeholder.

- **`GET /api/me/progress/:novelId` returns the literal body `null`** (not

404, not `{}`) when there is no progress. `await res.json()` gives you

`null`; handle it.

- **Idempotency you can lean on:** list add/remove are safe to retry; the

add returns `201` first time and `200` after, both `{ inList: true }` —

treat them identically.

- **Pagination is lenient, bodies are strict.** Garbage `?page`/`?sort`

silently falls back to defaults; garbage in URL params like `:id` or JSON

bodies is a hard `400` with a message you can show inline.

- **`limit` is clamped to 100** server-side — you cannot fetch all 462 novels

in one call; page through (total tells you when to stop).

- **Trashed/draft novels 404 everywhere public**, immediately — including

novels the user has in lists/history (those rows are simply omitted from

list/history responses; `total` reflects the filtered count).

- **Chapter reads are not blocked by novel status** — `GET /api/chapters/:id`

still returns text for chapters of a trashed novel if you know the id.

Don't build UI that depends on that; it may be tightened later.

- **Recommendations mutate with the library** — after any list/progress

write, a previously recommended novel may drop out. Refetch on feed

visit, not on every write.

- **Search is title-substring only** — no author, no description, no fuzzy.

Set placeholder text accordingly ("Search titles…").

- **Role changes need re-login** to take effect on gated endpoints (role is

baked into the JWT; see §3).

- **No rate limiting** exists — a runaway `useEffect` will happily hammer the

real database. Debounce search inputs.

- **Authoring payload cap:** JSON bodies over ~100 KB fail (currently as a

  500). Keep chapter content under that.

- **Timezones:** all timestamps are UTC; render in the user's local zone.

## 8. Known gaps

Things the UI might naturally want that the API **does not offer yet** — plan

around them (placeholder, hide the feature, or request a backend change):

1. ~~**No cover images on the public catalog**~~ — **Resolved 2026-07-19:**

`GET /api/novels`, `GET /api/novels/:id`, and `/related` now return

`cover` (featured-image URL or `null`), same as lists / history /

recommendations. URLs are still hot-linked to the old WordPress domain —

keep the placeholder + `onerror` fallback.

2. **Featured novels can be set but not read** — admins can flag novels

(`PATCH /api/admin/novels/:id/feature`) but there's no public

`GET` that returns featured novels, so a "Featured" hero section can't be

built yet.

3. **No "my novels" for writers** — a writer has no endpoint listing the

novels they contribute to, and no way to read their own **drafts**

(public detail 404s on non-published). A writer dashboard can only track

ids it created during the session. Also, contributors of a novel can't be

listed (admin grants are write-only).

4. **Created novels have no genres** — there's no endpoint to assign genres,

so writer-created novels won't appear in genre filters, `related`, or

genre-based recommendations.

5. **No account self-service** — no password change/reset, no profile edit,

no email verification, no account deletion.

6. **No logout/refresh token endpoints** — logout is client-side discard;

sessions silently expire after 7 days.

7. **No aggregate counts on novel cards** — chapter count / view count /

rating are not exposed (popularity exists only as a sort order).

8. **No upload endpoint** — covers/images can't be uploaded; everything

references the migrated WordPress media URLs.

## 9. End-to-end smoke test

Run this sequence (curl or the frontend) to confirm the integration works.

It's the same flow the backend's automated `api-tester` agent uses:

```bash

BASE=http://localhost:3000



# 1. Health

curl $BASE/api/health # → ok/connected



# 2. Register a throwaway user; keep the token

curl -X POST $BASE/api/auth/register -H 'Content-Type: application/json' \

-d '{"username":"fe_smoke_1","email":"fe_smoke_1@example.com","password":"smoke-pass-1!"}'

TOKEN=… # from the response



# 3. Public catalog

curl "$BASE/api/novels?sort=popular&limit=5" # 5 novels, total=462

curl "$BASE/api/genres" # ~41 genres

curl "$BASE/api/novels?genre=fantasy&limit=3" # filtered

curl "$BASE/api/novels/8757" # detail + chapters[]

curl "$BASE/api/chapters/334646" # HTML content



# 4. Auth'd flows

curl -H "Authorization: Bearer $TOKEN" $BASE/api/me/recommendations # 20 × "Popular right now" (cold start)

curl -X POST -H "Authorization: Bearer $TOKEN" $BASE/api/me/lists/favourite/8757 # 201 {inList:true}

curl -X PUT -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \

-d '{"chapterId":334646}' $BASE/api/me/progress/8757 # {saved:true}

curl -H "Authorization: Bearer $TOKEN" $BASE/api/me/history # 1 entry

curl -H "Authorization: Bearer $TOKEN" $BASE/api/me/recommendations # now "Because you read …", excludes 8757



# 5. Error shapes

curl $BASE/api/me/history # 401 {error}

curl $BASE/api/novels/banana # 400 {error}

curl $BASE/api/nope # 404 {"error":"Not found"}

```

Expected: every response is JSON matching §4; after step 4 the

recommendations reasons flip from "Popular right now" to

"Because you read <Genre>" and novel 8757 no longer appears.

> Note: registered smoke users write real rows to the shared database, and

> there is no delete-account endpoint — use an obvious `fe_smoke_*` naming

> convention so they can be cleaned up server-side later.

---

\*Generated 2026-07-12 against commit `b542dc5` (Phase 8). If backend and doc

disagree, the backend code is the truth — check `src/routes/*.ts`.\*
