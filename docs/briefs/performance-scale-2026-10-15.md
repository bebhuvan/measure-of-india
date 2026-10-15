# Brief: performance and scale (2026-10-15)

You own speed and scale for the India Atlas: page weight, main-thread time on phones, search,
the explorer, the build, and how all of it holds up as the data keeps growing (the owner's rule is
"more data, more cuts"). Industrial grade, measured, gated.

## Where you work

- Phase 1, now: read-only. Study the main tree and measure; write the scale plan (deliverable 1)
  into `/home/bhuvanesh.r/Documents/Bhuvan projects/atlas-worktrees/perf-notes/` (outside the repo).
  Do not edit, build or run writing scripts in the main tree: the launch-cleanup session owns it.
  Search, fonts and Every Cut can all be analysed from source and the 2026-10-15 numbers below.
- Phase 2: start only after the launch-cleanup session writes `CHECKPOINT READY <sha>` in
  `docs/status/launch-cleanup.md` (main tree; check it every 20 minutes or so). Then:
  `git worktree add "/home/bhuvanesh.r/Documents/Bhuvan projects/atlas-worktrees/perf" -b lb/perf <sha>`
  and work there. Symlink or install `node_modules`.
- Disk is tight (a build is about 4.5 GB). Check `df -h /` before every build; never keep more than
  one `dist/`; coordinate with the cleanup session through `docs/status/` notes rather than building
  at the same moment.
- Local commits on `lb/perf` are authorised. Never push, deploy or touch `main`.
- Ownership: search (`scripts/search-index.mjs`, `src/dossiers/search-core.js`), the explorer
  (`src/explore/`, `scripts/explore-*`), Every Cut pages, `src/pages/data/`, font loading and CSS
  delivery, `public/_headers`, `astro.config.mjs`, workflows and build time.
- Not yours: chart drawing. A new build-time SVG chart kit (`design-mocks/chartkit/kit.js`) will
  replace Observable Plot in `src/charts/` and `src/dossiers/*.client.js`. Measure the current chart
  cost as a baseline and set budgets, but do not rewrite chart code.

## Measured on 2026-10-15 (dist built 13:57 that day)

- 15,761 files, 4.78 GB. Cloudflare Pages allows 20,000 files per deployment, so about 4,200 left;
  one more data wave breaks deploys. Largest file `states/madhya-pradesh.csv` 17.5 MB (limit 25 MiB).
- Every Cut: 2,008 pages, median 728 KB raw HTML (one huge `<table>`), 1.36 GB; farm-households
  alone 463 MB. `dist/search` 428 MB, `dist/explore-data` 1.1 GB, `dist/data` 1.3 GB.
- Guide HTML 45 KB to 1.06 MB; CPI 566 KB of which 469 KB is inline tables; energy inlines a 481 KB
  JSON payload.
- Fonts are 157-402 KB per page, often more than half the transfer.
- Phone (390 px, 4x CPU): `/guides/cpi/` has one 8.7-9.2 s main-thread task, DCL about 11 s
  (23.9 s with 1.6 Mbps). Pensions keeps the main thread busy about 40 s (270+ long tasks).
  Desktop LCP 0.16-0.47 s everywhere. Only the 7 new guides use the cooperative `queueCharts`.
- Build 716 s locally; `npm test` 9 min on 14 cores; QC needs a 6 GB heap; CI timeouts are 30 min.

## What to deliver

1. A scale plan with numbers: what file count, bytes and build time look like at 2x and 5x today's
   data, and the architecture that keeps every page fast at that size. Evaluate honestly: Every Cut as
   compact data plus a client table versus static HTML; Cloudflare Workers static assets or R2 for bulk
   downloads (verify current platform limits from official docs, cite them); sharded search.
2. Search that stays fast and correct at scale on a mid-range phone: index size per query, cold and
   warm latency, ranking checks on real queries ("inflation in Kerala", "rupee", "wheat").
3. Fonts subset and trimmed to the weights in use; no layout shift.
4. Build and CI that finish inside their timeouts, with caching where it is safe.
5. Performance budgets as gates in `npm run gates` that exit non-zero: files per deploy, bytes per
   page by type, long-task time on a throttled phone for every guide and profile. Portable: Playwright
   as a declared devDependency, no paths into any agent's private runtime.
6. Before/after numbers for every change in `docs/status/performance-scale.md`, and `AGENTS.md` /
   `docs/ARCHITECTURE.md` updated for anything structural.

Read first: `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/briefs/launch-performance-2026-10-13.md` and
`docs/status/launch-performance.md` (Codex's earlier pass: keep what is measured and real, drop what
is ceremony).
