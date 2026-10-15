# Launch performance and Workers readiness: implementation brief

Owner request, 13 October 2026: rigorously assess and optimize current search quality/speed and whole-site performance to launch standard. Determine what is actually good or bad through measurements; do not assume the existing optimization choices are correct. Implement justified improvements cleanly. Coordinate a sibling building the indicator explorer.

## Preserve the current work

Read AGENTS.md, GOAL/VISION, DESIGN, CONTRACT-render, CONTRACT-series and the actual search/render/deploy implementation. Main launch-build at 3fa544aa31051bc0e803ea82afdc390fd385252c contains extensive intentional uncommitted changes; do not reset/stash/commit/push/deploy. Other projects and Data Bank are read-only. Baseline verification: docs/status/expansion-verification/completion-2026-10-13.json, with fresh build/gates and280 actual Chrome viewport checks passed. This proves correctness/geometry, not latency or search relevance. Use existing dist initially; do not rebuild just to obtain the baseline. Production preview4332 serves that artifact.

Current measured build:2,047 pages,10,614 files, about 3.3 GB dist,632.53 s total build; search1,661,635 entries,1,076 plates,2,578 files, core 1210 KB uncompressed,99 token shards+3033 row chunks totaling422.9 MB, largest495 KB. Published core/shard limits are checked, but compressed budget compliance alone does not prove good experience. Core loads at search focus; shards load by query. Verify these implementation details instead of relying on this brief as a timeless spec.

## Baseline first, then optimize

Capture source/artifact hashes and repeatable raw measurements before editing existing behavior. Send a 'baseline captured; dist may be replaced under coordination' message to the explorer sibling and original coordinator. Record environment, browser, CPU/network throttling, warm/cold cache, compression differences between local/deployed hosting, repetitions and variation. Use real Chrome and appropriate browser tracing/Lighthouse tools; bundle and generated-data analysis supplement browser evidence. Lab LCP/CLS/long tasks/search latency are not field p75 Core Web Vitals; state that boundary. If no trustworthy live Pages URL is discoverable in public configuration, request it rather than guess which site is ours. Do not change the live site.

Cover home, guides/index, largest chart-heavy guides (Households/Farm/Energy/Markets), a representative ordinary guide, state profiles, largest EveryCut views, exports and the new explorer. Measure initial transfer/requests/JS parse+execute/heap, first useful chart, main-thread long tasks, layout shifts, input responsiveness, search first meaningful and complete results, cancellation/stale-query races, repeated-query cache reuse, and download integrity. Mobile/low-end device behavior matters; a desktop-only score is insufficient. Identify real bottlenecks in chart mounting, embedded data, fonts/images, HTML/table DOM size, eager modules and search manifests/postings/chunk requests. Preserve the full data history and charts; reducing coverage is not an optimization.

## Search quality as well as speed

Build an evidence-backed labelled query set from actual indicators and reader phrasing: headline names, abbreviations, spelling variants/typos, states/districts, units and disambiguating cuts, multiword and very common terms, dates, precise long-tail names, impossible matches and ambiguous queries. Examples include urban female unemployment, Karnataka electricity capacity, food inflation, rural wages, conditional household debt and listed-company sales. Define expected destinations and relevance judgement; inspect top results manually. Test exact lookup/recall across every registered family, rank appropriate guide/indicator/chart results, expose active scope/filter choices, and avoid confusing duplicate aliases. Report relevance/recall and latency distributions separately. Preserve the existing find-its-own-label and deep-link gates. No tiny curated test set presented as proof of full-catalogue search quality.

Improve cancellation/debounce, bounded candidates, shard packing/request amplification, manifest loading, cache bounds, rendering and ranking only where justified. Don't add a backend/paid search provider/huge dependency without a measured reason. Maintain a versioned search/explorer identity interface with the sibling so record IDs and links survive build reordering. Retain full catalogue discovery; no dropping common postings or long-tail records to gain a benchmark. Add robust loading/empty/error/offline-ish behavior and keyboard accessibility. Have budget/regression checks that actually fail on meaningful slowdowns, without flaky timing assertions mistaken for correctness tests.

## Workers and domain readiness

The user intends to move from a live development pages.dev address to a custom subdomain on Cloudflare Workers and later retire provider URLs. Current CI deploys Cloudflare Pages project india-atlas; astro.config.mjs uses https://atlas.thisindianlife.today, while the user's message said theindianlife.today. Domain/name choice is pending with the coordinator: don't rename the site, canonicals or DNS speculatively.

Own the clean, locally verified Workers Static Assets configuration/deploy preparation and a cutover/rollback runbook, coordinating the explorer's architecture. Browse current official Cloudflare docs and verify actual plan/file/runtime constraints and existing account setup only through authorized read-only mechanisms. Preserve gates/human release requirements. Asset-first routing, existing redirects/headers/404/trailing slashes, archive downloads, MIME/cache/security headers, immutable hashed asset caching and revalidated HTML/manifests need concrete checks. Confirm crawler URLs/sitemap/RSS/OG/canonical consistency once the final hostname is chosen. Compare static serving with any narrowly necessary Worker route and avoid charging Worker invocations for all static files unnecessarily. Measure generated file count/size with explorer assets and enforce appropriate deployment caps. Don't 'optimize' through stale mixed-release caches.

Cloudflare docs checked by coordinator on 13 October:
- https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/pages/how-to/redirect-to-custom-domain/

Prepare a concrete reviewable migration; do not deploy, change DNS, delete Pages, disable a currently used endpoint or delete a working rollback. Final custom-domain validation must precede endpoint retirement. workers.dev can be disabled in configuration, but preview URLs have a separate setting: cover both. Retain a working redirect for old pages.dev links if feasible, preserving paths/query strings; deletion and redirects are distinct decisions. Any account/domain ownership or plan constraints need an explicit limitation, never invented success.

## Ownership and resource coordination

Work in the shared local main checkout so you see integrated uncommitted source, not a new stale-HEAD checkout. Own existing search-core.js, search-index.mjs, home search wiring, performance tooling (scripts/performance-*, test/performance-*), Workers-specific configuration/deployment preparation and docs/status/launch-performance.md. Explorer owns its new routes/components/data packaging. You may message the sibling/original coordinator; the human explicitly authorized coordinated instances. Before editing shared chart/layout/contract/package/build files agree exact file ownership; no simultaneous writes. Capture baseline before replacing dist, and coordinate each frozen-source combined build/check with the sibling. Both agents see the same source and generated outputs; separate npm processes are not isolation.

Use ATLAS_BUILD_SLOTS=1 sh scripts/build-slot.sh for every full build/check. Only about 3.4 GB free with a 3.3 GB dist: avoid duplicate builds/copies, keep evidence small and durable, remove only your superseded reproducible output with path guards after preserving baseline hashes/results. Never clean other projects or shared caches. Prefer bounded tests and fixtures before expensive full builds; complete actual required checks after final source is frozen. Respect another process's preview/build. Model API calls are unnecessary for this work.

## Definition of done

An implemented, measured improvement set and a candid readiness verdict, not an audit that only recommends follow-up. Raw repeatable baseline/after evidence for representative pages and search query set, numerical source/chart/export parity and accessibility checks. Explicit achieved budgets for low-end cold/warm behavior, search quality, catalogue scale, build/disk/asset counts and caching correctness. Fresh integrated build, npm run gates and relevant tests; actual mobile/desktop browser inspection of changes, prose:dry if data/prose changes. Coordinate explorer integration and record unfinished blockers separately from passed areas. Include a locally tested Workers migration configuration and rollback/cutover checklist, with deployment left pending. No commit, push, DNS change or live deletion. Report to the original coordinator with evidence paths and actual measured outcomes.

## Confirmed parent domain

The owner confirmed on 13 October 2026 that the parent domain is thisindianlife.today. The coordinator recommends Indian Economic Atlas at atlas.thisindianlife.today; the product name is a recommendation, not a completed rename or cutover. Keep the current canonical host pending final migration approval.
