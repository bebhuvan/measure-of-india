# Plan: search, citation, feeds and an installable app (lb/seo-pwa, from 2026-10-17)

Brief from Bhuvan (the owner), handed over by the design-fix session on lb/chartkit. This branch
starts from the lb/chartkit commit that holds the chart-kit phone work, the front page uplift and the
About page. Work only in this worktree (`atlas-worktrees/seo-pwa`, branch `lb/seo-pwa`). The design
session keeps working on lb/chartkit in `atlas-worktrees/chartkit`; do not edit that worktree. When
Bhuvan approves, this branch is merged into lb/chartkit in one step, so keep commits on this branch
self-contained and say which files you touched.

## Before you start

Read `AGENTS.md`, `docs/DESIGN.md` (normative: improve within it, never redesign), `docs/GOAL.md`,
`docs/ARCHITECTURE.md` and `docs/RUNBOOK-workers-cutover.md` (hosting: Cloudflare Workers static
assets, `wrangler.jsonc`). The site is live at https://measure.thisindianlife.today/. The site name,
host and parent project live only in `src/site.js`; the mark is `src/brand/mark.js`
(`scripts/brand.mjs` makes the icons). The masthead and every page's head are in
`src/layouts/Base.astro`. The current feed is `src/pages/rss.xml.js` (guide revisions only).

## The work (do all of it, to an industrial standard; ask Bhuvan only what is genuinely his call)

1. **SEO, wholesale.** Audit and fix every page kind (front page, guides, every-cut pages, state
   profiles, learn notes, explore/indicators, method, about, 404): unique titles and descriptions
   built from data, never typed periods (`src/dossiers/periods.js`); canonicals; Open Graph and
   Twitter cards (the OG images exist: `scripts/og.mjs`); `robots.txt`; the sitemap
   (`@astrojs/sitemap` is installed) complete, with `lastmod` from each page's data vintage, not the
   build date (AGENTS rule 5); breadcrumbs; internal links between guides, states and notes;
   `lang="en-IN"` where right. Structured data (JSON-LD): `WebSite` with a `SearchAction` for the
   site search, the publisher (`Person`: confirm the name to use with Bhuvan; contact on /about/), `BreadcrumbList`, and
   **`Dataset` for every guide and every downloadable bundle** (name, description, creator = the
   statistical agency, temporal and spatial coverage, `distribution` for the CSV and JSON
   downloads, license CC BY 4.0 for our work while each source keeps its terms, `dateModified` =
   vintage). Validate the JSON-LD against schema.org and Google's Dataset rules.
2. **GEO (generative-engine optimisation).** Make the site easy for AI assistants to read, quote and
   cite correctly: `/llms.txt` (what the site is, how it is organised, the guides with their
   latest figure and period, where the data downloads are) and `/llms-full.txt` (built from the
   facts sheets and headline data at build time, never hand-typed numbers; every number must trace
   to a bundle like the prose does, AGENTS rule 3); stable, citable anchors for every plate and
   figure; plain-text summaries a crawler can read without running script; `robots.txt` that allows
   the major AI crawlers. No invented prose: if you add explanatory text, it follows `pipeline/`
   rules and passes `pipeline/verify.mjs` and `lint.mjs`.
3. **Feeds.** Keep `/rss.xml` working (old subscribers). Add a feed of releases (each new print:
   the guide, the figure, the period, the release date, a link), per-guide feeds if they earn their
   keep, a JSON Feed, autodiscovery links on every page, and a human-readable feed page (XSLT
   styled in the house style) so a feed URL opened in a browser is not raw XML.
4. **Other search work.** Whatever else a serious reference site does: Search Console and Bing
   verification hooks (ask Bhuvan for the tokens; put them in an env-driven place, never in code),
   IndexNow on deploy if it fits the release workflow, correct status codes and redirects (old
   `/dossiers/` URLs already redirect), no duplicate-content traps (every-cut pagination,
   trailing slashes), image alt text and accessible names that also serve search.
5. **A PWA that feels as native as the web allows.** Web app manifest from `src/site.js` (name,
   short name, start URL, scope, `display: standalone`, theme and background colours from the
   `:root` tokens in `src/styles/atlas.css`, shortcuts to Guides, States and Search), icons from the
   mark including maskable 192 and 512 and an Apple touch icon (the brand script makes them);
   a service worker that precaches the app shell and fonts, serves visited pages and their
   `kit.json` offline with a stale-while-revalidate policy, never serves stale data as fresh
   (versioned by build, old caches cleared), and an offline page in the house style; iOS meta
   (status bar, standalone title), safe-area insets for notched phones, `overscroll-behavior`,
   no sticky hover on touch (the front-page ledger was fixed on lb/chartkit; check everywhere),
   tap highlight, fast taps, an install prompt that is quiet and dismissible, and page-to-page
   transitions only if they are restrained (DESIGN: no gratuitous micro-animations). The
   service worker must not be cached by Cloudflare: set its headers in the Workers config.
   Test installation and offline in Chrome (desktop and phone emulation).

## Rules (from AGENTS.md and Bhuvan)

- Do not commit to main, push or deploy without Bhuvan's explicit go. Commit on lb/seo-pwa only
  when a piece is done and gated, and only if Bhuvan says to commit.
- Never edit `data/raw/`. Kill processes by pid, never `pkill -f`. The machine is short of memory:
  build (`npx astro build`) only when needed, never two builds at once (another session builds in
  the chartkit worktree; check `pgrep -af "astro build"` first).
- Never use `<em>`, `<i>` or italic for UI that is not italic (the perf font budget counts italics).
- Performance budgets (`perf/budgets.json`) only move down; a raise needs an entry in `raised` saying
  why. The service worker and manifest must not push any page over its budget.
- Check in a real browser: Playwright from `node_modules/playwright/index.mjs` with
  `channel: "chrome"` and `--no-sandbox`, at 1280 and 390 px; send Bhuvan screenshots.
- Before calling a piece done: `ATLAS_CHROME_CHANNEL=chrome npm run gates` (Playwright's bundled
  browser is not installed; the env var makes the gate scripts use the system Chrome). After a
  masthead change, `node scripts/masthead-fit.mjs`.
- Keep `AGENTS.md`, `docs/DESIGN.md`, `docs/ARCHITECTURE.md` and this file's status section current.
- Writing for readers: plain, flowing English with Indian context, no AI patterns.

## Status

(Update as you go: what is done, what is gated, what needs Bhuvan.)

### The plan (written 2026-10-17, before any code)

Audit of the live build (lb/chartkit dist, 852 pages) found: `lang="en"`; no JSON-LD anywhere; no
manifest or service worker; one RSS feed; a static `robots.txt` with no AI-crawler policy; a
sitemap that lists all 815 indexable pages but carries no `lastmod`;
7 ILO every-cut pages with no canonical; 38 duplicate titles and descriptions (numbered every-cut
pages repeat page one's; the explore pages share one description); `og:type` is `article`
everywhere, including the front page.

Work goes in seven self-contained pieces, each gated before the next. Shared code lives in a new
`src/seo/` (one module per concern), so pages pass facts and the layout writes the tags.

1. **Head and metadata.** `Base.astro`: `lang="en-IN"`, a canonical on every page (from the page's
   own path when it passes none), `og:type` by page kind, `og:locale`, image alt, `theme-color`,
   `robots` (noindex on 404 and the offline page), feed autodiscovery, verification meta from env.
   Unique titles and descriptions for every kind, built from the registry, `headline.js` and
   `periods.js` (every-cut pages say "page n of N"; explore pages describe their series).
2. **Structured data.** `src/seo/jsonld.js`: `WebSite` + `SearchAction` (the front page learns
   `?q=`), the publisher `Person`, `BreadcrumbList` from each page's crumb, `Dataset` for every
   guide (creator = the agency, temporal and spatial coverage from the bundles, `distribution`
   CSV and JSON, `license`, `dateModified` = vintage, `isAccessibleForFree`) and for every
   downloadable bundle (on the every-cut page that carries it, or a per-guide data catalogue if
   the guide page would exceed its byte budget), `Place` for state profiles, `Article`/
   `LearningResource` for learn notes. A gate parses every block and checks Google's Dataset
   required and recommended fields.
3. **Sitemap and robots.** `lastmod` from each page's data vintage (none where a page has no data
   vintage; never the build date); redirects, 404 and offline out. `robots.txt` generated from
   `SITE`, allowing search and AI crawlers by name.
4. **GEO.** `/llms.txt` and `/llms-full.txt` built from the registry, `headline.js`, `periods.js`
   and the facts sheets, every number traced to a bundle by the same check the prose gate uses;
   stable anchors on every plate and figure (checked unique and permanent across builds); a
   crawler-readable plain-text summary per guide where the page leans on script.
5. **Feeds.** `/rss.xml` kept as is. New: a releases feed (one item per print, guid = guide +
   period, so a new print is a new item), per-guide feeds, a JSON Feed, Atom for the releases feed,
   XSLT so a feed opened in a browser reads as a house-style page, a `/feeds/` page listing them,
   autodiscovery on every page.
6. **Search housekeeping.** Verification meta from build env (`GOOGLE_SITE_VERIFICATION`,
   `BING_SITE_VERIFICATION`) or DNS, whichever Bhuvan picks; IndexNow ping as a step after
   `wrangler deploy` in `deploy.yml` (key from a repository secret, key file written into dist at
   deploy time); status codes and trailing-slash checks; alt text and accessible-name audit.
7. **PWA.** Manifest generated from `SITE` and the `:root` tokens, with shortcuts; maskable and any
   192/512 icons from `scripts/brand.mjs`; a service worker generated at `astro:build:done`
   (precache the shell and fonts, versioned by the release hash; stale-while-revalidate for visited
   pages and their `kit.json`, with the page told when it is showing a stored copy; old caches
   cleared on activate); an offline page; iOS meta; safe-area insets, `overscroll-behavior`, tap
   highlight, hover only on hovering pointers; a quiet, dismissible install prompt. `_headers`
   keeps `sw.js` and the manifest uncached. Tested in Chrome desktop and phone emulation.

A new gate, `scripts/seo-check.mjs`, joins `npm run gates`: unique titles and descriptions,
canonicals, JSON-LD validity, sitemap coverage and `lastmod`, feeds well-formed, `llms*.txt`
numbers traced, manifest and service-worker sanity. Budgets: nothing may push a page over its
ceiling.

Needs Bhuvan: the publisher name for structured data; how to verify Search Console and Bing
(DNS records need nothing in code); an IndexNow repository secret when he wants pings on deploy.


### Decisions (17 October 2026)

- **Bhuvan:** publisher name "Bhuvan" (schema.org `Person`, `src/site.js`); Search Console and Bing
  verified by DNS in Cloudflare, so no token in code (the env meta hook stays as a fallback); X
  cards name @bebhuvan.
- **Feeds styled with CSS, not XSLT.** Chrome removes XSLT on 17 November 2026 (Chrome 158;
  developer.chrome.com/docs/web-platform/deprecating-xslt), Firefox and Safari plan to follow.
  `/feeds/feed.css` styles the feed's own elements; `/feeds/` is the page for people.
- **A release log** (`data/releases.json`, `scripts/releases.mjs`) so feeds can carry each print as
  first published; today's bundles cannot tell what an old print said before revisions. Seeded with
  the 36 current prints, dated by release date, else vintage. Items with neither carry no date.
- **One page per data file** (`/data/<file>/`, 2,643 pages) to carry each bundle's Dataset, the
  dataset-search practice of a landing page per dataset; linked from each guide's data table and
  every-cut file list, catalogued at `/data/`.
- **Network first for pages**, not stale-while-revalidate: SWR would show last release's figures
  first after every new print. A saved copy is shown only offline or after four seconds, and says
  so with its date. Saved pages and hashed files outlive a release (so a saved page keeps its
  assets); the shell is per release and old shells are deleted.
- **No `viewport-fit=cover`.** On a white ground the system's own safe-area letterbox is invisible,
  so notches are respected by construction; covering would need inset padding on every bespoke
  full-bleed layout.
- **Pull-to-refresh kept** (`overscroll-behavior-x` only): the installed app has no reload button.
- **No page transitions** (DESIGN: restraint).
- **Structured data has its own budget metric** (`ld`, `perf/budgets.json`, CONTRACT-render), apart
  from inline `json` payloads; its bytes still count in each page's html ceiling. Guide Datasets
  do not list their files (each file's Dataset points to its guide), to keep guide pages in budget.
- **Build memory.** Code outside the Astro bundle (the config's sitemap hook) must not load bundles
  or plans: it gets a second copy of every module. Pages record their `lastmod` as they render.

### Progress (17 October 2026, end of day)

All seven pieces are built, and the whole gate set is green on a full build (3,462 pages):
`npm run gates` with `ATLAS_CHROME_CHANNEL=chrome` (validate, coverage, as-of, qc, chart lint at
1280 and 390, masthead fit, explorer verify, seo-check, budgets, search, phone main thread),
`npm test` (324 pass, 9 of them new in `test/seo.test.mjs`) and `npm run prose:dry`.

- seo-check: 3,460 indexable pages, each with a unique title and description, a self canonical,
  cards and an image; 3,454 JSON-LD blocks, 2,679 Datasets meeting Google's fields; the sitemap
  lists exactly the indexable pages; 38 feeds well-formed; 1,933 anchors recorded in
  `src/seo/anchors.json`; manifest, icons and `sw.js` shell complete.
- Every JSON-LD node (33,259) also checked against the schema.org vocabulary (types exist,
  properties exist and apply to their type): no problems. That check reads schema.org's vocabulary
  file, so it was run by hand rather than added to the gate.
- Chrome: installable with no errors; offline behaviour as designed; `/?q=` runs the search.
- Build memory: the full build runs on Node's default heap, peaking at 5.15 GB resident, level with
  the baseline before this work (5.04 GB on the build without every-cut pages).
- Budgets: two raises, recorded in `perf/budgets.json` `raised` with reasons (three explore pages
  4 to 5 KB, the ILO guide 51.5 to 54 KB); everything else within its ceiling.
- Final check, 18 October 2026: a fresh build from source (3,462 pages in 705 s; dist 18,767 files,
  3.6 GB, inside the 90,000-file deploy gate) passed `ATLAS_CHROME_CHANNEL=chrome npm run gates`
  in full, and `npm test` passed 324 of 324. Committed on lb/seo-pwa and merged into lb/chartkit;
  not deployed.

### Needs Bhuvan

- Add the DNS TXT records for Search Console (Domain property) and Bing (or import from Search
  Console). Then submit `https://measure.thisindianlife.today/sitemap-index.xml` in both.
- For IndexNow: add a repository secret `INDEXNOW_KEY` (any 32 hex characters, e.g. from
  `openssl rand -hex 16`); deploys then ping Bing and others with the changed pages.
- Optional: a shorter home-screen name. `short_name` is "Measure of India" (16 characters); Android
  may cut it to "Measure of In…" under the icon.
