# Workers migration and rollback

Prepared locally; production remains Cloudflare Pages. No account plan, zone ownership,
or actual live Pages URL has been verified. The parent domain is thisindianlife.today;
current canonical host atlas.thisindianlife.today is retained pending naming/cutover approval.

## Reviewable serving configuration

`wrangler.jsonc` prepares an assets-only Worker named india-atlas, explicit trailing-slash
HTML and custom 404 handling. No `main`, binding, runtime dependency, or Worker-first route:
static asset requests incur no Worker script invocation. Both workers.dev and preview URLs
are disabled in the proposed configuration, independently. This does not disable existing
provider endpoints until the owner authorizes and applies migration.

`public/_headers` adds security headers globally. Mutable URLs use Workers' default
`public, max-age=0, must-revalidate`; no overlapping blanket Cache-Control rule is added.
Immutable caching applies only to content-hashed `/_astro/`, `/search/t/`, `/search/r/`
and `/explore-data/c/` assets after their filename/content hashes pass verification.
Search core and explorer manifests remain revalidated. Never cache index-addressed
unhashed shards immutably: row offsets can change between builds.
`public/_redirects` preserves /dossiers aliases; test paths and query strings locally and
on final domain. Browser fragments stay browser-side. Custom 404 must return status 404,
including missing JSON/CSV, rather than an HTML SPA success response.

## Local review

1. Freeze source with explorer/coordinator. Preserve baseline evidence before replacing dist.
2. Use one machine-wide slot: `ATLAS_BUILD_SLOTS=1 sh scripts/build-slot.sh sh -c 'npx astro build && npm run gates'`.
3. Run relevant unit tests and `node scripts/performance-assets.mjs`. Default file limit
   is conservative Free 20,000; use ATLAS_WORKERS_PLAN=paid only after verifying that plan.
   Paid is 100,000 files. Official per-file limit is 25MiB; our gate retains 20MiB margin.
   Use Wrangler >=4.34.0 and Node >=22 (cached local Wrangler currently 4.149.0).
4. `wrangler dev --local --config wrangler.jsonc --ip 127.0.0.1 --port 4334` serves exact
   finished dist. Check home, guides, explorer, state, old aliases, slash redirects, RSS,
   sitemap, 404, JSON/CSV/archive MIME and cache/security headers. Compare response bytes
   and hashes against disk. Validate compressed/browser timings separately from preview.
5. `wrangler deploy --dry-run` validates packaging without deploying; do not mistake
   a successful dry run for account permissions or custom-domain availability.

## Owner-approved cutover (future execution)

1. Obtain actual Pages production URL and read-only account/zone/plan evidence. Verify
   deploy token rights without logging tokens. Retain working Pages release and rollback.
2. Human reviews and merges release PR after full gates. Before migration replace the
   Pages deploy step with Workers deployment only under approval; keep the build from
   committed data and require full `npm run gates`, not only QC/asof.
3. Add approved custom-domain route to Wrangler and deploy verified artifact; confirm TLS,
   HTTP status, canonicals, sitemap/RSS/OG, compression, headers, redirects, search/explorer
   exact links and export integrity on atlas.thisindianlife.today. Run mobile/desktop lab
   measurements again. Confirm atomic release behavior and revalidation, including an
   already-open tab querying after a new deployment.
4. After custom-domain validation, configure a separate Pages-host redirect to the approved
   custom host preserving path/query. Test old bookmarked guide/row/explorer URLs. Avoid
   redirect rules on the destination causing loops. Keep Pages for rollback until owner
   chooses retirement. Deleting Pages and redirecting its host are distinct decisions;
   deletion cannot preserve old links. Disable workers.dev/preview URLs only after final
   hostname works, with both settings checked. Never delete a working rollback casually.

## Rollback

Keep previous verified Worker version and Pages deployment identifiers, release hashes,
and DNS/custom-domain settings in the human release packet. If any final-domain check fails,
stop endpoint retirement. Restore previous Worker deployment using its verified version;
if Workers cutover fails, restore prior routing to retained Pages and verify exact data,
search/deep links and TLS. Purge only demonstrably stale mutable cache entries if needed;
do not change data vintages or remove coverage to conceal a hosting failure.

Official references, checked 13 October 2026:

- [Pages migration](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Static billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Provider endpoints](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)
- [Old Pages host redirects](https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/)
