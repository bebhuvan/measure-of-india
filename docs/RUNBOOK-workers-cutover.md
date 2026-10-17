# Workers hosting: first deploy and rollback

The site is served as Cloudflare Workers static assets. The owner chose Workers over Pages on
2026-10-16; the account is on Workers Paid. Pages allows 20,000 files a deployment on its Free
plan, and the site had 15,897 files at that date, so one more data wave would have broken deploys.
Workers Paid allows 100,000 files a version. The deploy gate (`perf/budgets.json` `deploy.maxFiles`)
is 90,000, leaving room for a wave.

The old Pages project `india-atlas` (india-atlas.pages.dev) keeps serving its last deployment until
it is redirected or retired. Both are owner steps, below.

## What is set up

`wrangler.jsonc` is an assets-only Worker named `india-atlas`. It has no script, no bindings and no
Worker-first routes, so a request costs no Worker invocation.

- **Host:** the custom domain `measure.thisindianlife.today`, the canonical host in `astro.config.mjs`.
  `thisindianlife.today` is a Cloudflare zone (its nameservers are Cloudflare's), so the first
  deploy creates the DNS record and certificate. The zone must be in the same account as the deploy
  token.
- **workers.dev:** `india-atlas.<account>.workers.dev` stays on for the first deploys as a check
  host. Turn `workers_dev` off once the custom domain has passed the checks below.
- **Preview URLs:** off.
- **HTML handling:** `force-trailing-slash` (`/guides/cpi` answers 307 to `/guides/cpi/`).
- **Not found:** `404-page`, so a missing page, JSON or CSV file returns status 404 with `404.html`.
- **`public/_headers`:** security headers everywhere. A year of immutable caching applies only to
  content-hashed paths: `/_astro/`, `/fonts/`, `/ec/`, `/explore-data/c/` and the hashed search
  shards. Everything else gets Workers' default `public, max-age=0, must-revalidate`.
- **`public/_redirects`:** keeps the old `/dossiers/` URLs, with their query strings.
- **Compatibility date:** 2026-10-01. Keep it at or below the newest date the pinned Wrangler's
  runtime supports, or the local server refuses to start. Wrangler 4.147.0 supports up to
  2026-10-08.

`.github/workflows/deploy.yml` runs on a push to `main`, which happens only through a human merge.
It runs the unit tests, the build from committed data, qc, as-of and `perf:static` (including the
file cap). Then it runs `wrangler deploy` with Wrangler 4.147.0. It needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: a token with Workers Scripts edit rights on the account, and Workers
  Routes and DNS edit rights on the `thisindianlife.today` zone.
- `CLOUDFLARE_ACCOUNT_ID`.

## Checked locally (2026-10-16, Wrangler 4.147.0)

These ran against a sample dist, using `wrangler dev --local` and `wrangler deploy --dry-run`.

| Request | Result |
|---|---|
| `/` and a guide page | 200, HTML, revalidated |
| `/guides/cpi` | 307 to `/guides/cpi/` |
| `/dossiers/cpi/?x=1` | 301 to `/guides/cpi/?x=1` |
| A missing page and a missing `.json` | 404 with `404.html` |
| `.csv` | `text/csv` |
| `/_astro/` and `/search/t/` | immutable, gzip-encoded on the wire |
| An Every Cut pack `/ec/.../0.<hash>.gz` | `application/gzip` with no Content-Encoding. The bytes served are identical to the file, which is what the client's `DecompressionStream` expects. |

The client also accepts a pack that a host has already unpacked: it checks the first byte for
gzip's 0x1f (`test/everycut-stream.test.mjs`). A different host or a proxy cannot break the
tables that way.

The dry run packages the assets with no bindings. A dry run proves nothing about account rights,
the plan or the custom domain; the first real deploy does.

## First deploy (owner)

1. Create the GitHub repository and add the two secrets. Merge the release PR; `deploy.yml` runs.
2. On `https://measure.thisindianlife.today/`, check:
   - TLS and status codes;
   - the home page, a guide, a profile, the explorer, search (a cold query and a deep link to a
     row) and an Every Cut page (scroll to the end; Ctrl+F finds a row from the last pack);
   - `/dossiers/<slug>` redirects, the sitemap, RSS and OG images;
   - JSON and CSV downloads, and a 404;
   - the cache headers above.
3. Run the phone gate against the live host if wanted (`scripts/perf-browser.mjs` reads a dist; a
   live check is a manual Lighthouse run at 390 px).
4. Once the custom domain passes, set `"workers_dev": false` and deploy again.

## The old Pages host (owner decisions)

Redirecting `india-atlas.pages.dev` to the custom host and deleting the Pages project are two
separate decisions:

- **Redirect:** Cloudflare's guide uses a Bulk Redirect from the `pages.dev` host that preserves
  path and query. It keeps old links working.
- **Delete:** deleting the project cannot keep old links. Keep the project until the Workers
  host has run clean through at least one weekly update; it is the rollback.

## Rollback

`wrangler rollback` (or the dashboard's Deployments tab) restores the previous Worker version.
Each version holds the whole asset set, so a rollback is atomic. If the custom domain itself fails,
remove the route from `wrangler.jsonc`. The Pages deployment still serves the last Pages build at
`india-atlas.pages.dev`. Never change data vintages or remove coverage to hide a hosting failure.

Official references, checked 13 and 16 October 2026:

- [Static assets limits and billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Migrating from Pages](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
- [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Redirecting a pages.dev host](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/)
