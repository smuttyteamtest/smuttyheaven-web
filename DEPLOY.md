# Deploying novvels-web

The app builds to a fully static bundle (`npm run build` → `dist/`) — any
static host works. Config for Netlify (`netlify.toml` + `public/_redirects`)
and Vercel (`vercel.json`) is committed; both auto-deploy on push once the
repo is connected.

## The three things every host needs

1. **Build**: `npm run build`, publish directory `dist/`, Node 20.
2. **SPA fallback**: every path must serve `index.html` with a `200` (routes
   like `/novel/8757/read/334646` exist only client-side). Netlify gets this
   from `public/_redirects`, Vercel from the `rewrites` in `vercel.json`.
   Without it, deep links and page reloads 404.
3. **`VITE_API_URL`**: the API base URL, **baked in at build time** (it is not
   read at runtime). Set it in the host's environment settings per deploy
   context, no trailing slash:

   | Context            | Value                                  |
   |--------------------|----------------------------------------|
   | Local dev          | unset (defaults to `http://localhost:3000`) |
   | Preview/staging    | the staging API URL, if one exists     |
   | Production         | `https://<production-api-host>`        |

   Changing it requires a rebuild, not just a redeploy of old artifacts.

## The API side (must be confirmed before production)

- **HTTPS is mandatory.** The deployed site is served over HTTPS, and
  browsers block mixed content — an `https://` page cannot fetch an
  `http://` API. The Express backend needs to sit behind TLS (a reverse
  proxy / Azure App Service / etc.) before the frontend can point at it.
- **CORS**: the API currently sends `Access-Control-Allow-Origin: *`
  (handoff §1), so any frontend origin works. If the backend team ever
  tightens it, the deployed origins (production + previews) must be added
  to the allowlist.
- **Cover images** are hot-linked from the old WordPress domain over
  whatever scheme those URLs carry; `http://` covers will be blocked as
  mixed content on an HTTPS site. The existing `Cover` fallback handles the
  failure, but a media migration is the real fix (handoff §8.8).

## GitHub Pages (not recommended)

Pages can't rewrite arbitrary paths to `index.html` — the workaround is a
duplicated `404.html`, which still responds with a 404 status and hurts SEO.
It also serves from a `/<repo>/` subpath unless a custom domain is attached
(requiring a `base` change in `vite.config.ts`). Use Netlify or Vercel unless
there's a strong reason not to.

## SEO / SSR decision (issue #7)

The app sets `document.title`, meta description, and `og:*` tags per page
client-side (`src/hooks/usePageMeta.ts`). That covers browser tabs, history,
and Google (which executes JS). What it does **not** cover: social link
unfurlers (Discord, Slack, X) — they read the static `index.html` defaults
and will show the generic site card for novel links.

**Decision: no SSR/prerender for now.** The catalog is 462 novels of
syndicated content with hot-linked covers; per-novel unfurl cards are a
nice-to-have, not a launch requirement. If that changes, the cheapest path is
prerendering just `/novel/:id` pages (e.g. `vite-plugin-ssr`/prerender or an
edge function that injects `og:*` tags for crawler user-agents) — full SSR
(Next-style rewrite) is not warranted for this app.

## Smoke test after a deploy

1. Open the site root — catalog rails load (API reachable, CORS OK).
2. Hard-refresh a deep link like `/browse?genre=fantasy` — no 404 (SPA
   fallback works).
3. Log in and open a chapter — progress toast should **not** appear (auth +
   writes work; the toast only shows when the save fails).
4. Check the tab title on a novel page — it should show the novel's name
   (bundle built with meta support).
