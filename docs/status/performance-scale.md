# Performance and scale (brief: docs/briefs/performance-scale-2026-10-15.md)

Owner: Claude Code session on `lb/perf`, worktree `../atlas-worktrees/perf`, branched from `417a96f`.
The plan, with the 2x/5x projections, is in `../atlas-worktrees/perf-notes/scale-plan.md`.
Short dated entries, newest last. Every change has a before/after row.

## How it is measured

**Static** (`npm run perf:static`):
- `scripts/perf-budget.mjs` reads `dist/` and reports gzip bytes per page: HTML, JS module graph,
  CSS, inline JSON and fonts. Fonts are counted by preloads plus `unicode-range` against the
  page's text, which is an upper bound.
- It also checks file count and the largest file.
- `scripts/perf-search.mjs` runs the labelled reader queries in `perf/search-queries.json`
  through the home page's engine. For each cold query it counts the files and gzip bytes
  fetched, and checks where the reader lands.

**Phone** (`node scripts/perf-browser.mjs`):
- Playwright on every guide and state profile, at 390 px with the CPU slowed 4x.
- The network is not throttled; bytes are gated byte-exactly by the static check.
- Each page is loaded cold 3 times and the median is taken.
- It records the longest task, total blocking time, CLS, LCP and when the page settled: all
  queued chart jobs done, then 1.5 s with no long task.
- These are lab numbers, not field p75.

**Budgets** (`perf/budgets.json`):
- Each page has a ceiling recorded from the baseline. `--record` only ever lowers it.
- A page with no record gets its type's default.
- The phone default (longest task ≤ 200 ms, TBT ≤ 600 ms, CLS ≤ 0.05) is the target for a page drawn
  with the build-time chart kit.
- All of this runs in `npm run gates` via `npm run perf`.

## 2026-10-15: baseline at 417a96f

Build (`npx astro build`, 14 cores, into /dev/shm because the disk had 5 GB free):

| | Baseline |
|---|---|
| Wall time | 13 min 18 s |
| Peak RSS | 4.7 GB |
| Pages | 2,113 |
| Page rendering | 488 s |
| Search index + explorer pack | ~290 s |
| Files | 15,763 |
| Bytes | 4.78 GB |
| Search core | 2,357 KB raw, 390 KB gzip |
| Search shards | 101 token shards, 3,143 row chunks |

Static, gzip, median / max by page type (`performance-scale/baseline-budget.json.gz`):

| Type | Pages | HTML | JS | Fonts (upper bound) |
|---|---:|---|---|---|
| guide | 36 | 65 / 145 KB | 146 / 482 KB | 509 / 509 KB |
| state | 36 | 26 / 31 KB | 112 / 112 KB | 274 / 274 KB |
| Every Cut | 2,008 | 43 / 157 KB | 4 KB | 157 / 274 KB |
| other | 28 | 5 / 15 KB | 107 / 469 KB | 284 / 509 KB |

Phone, 390 px, 4x CPU, median of 3 cold loads (`performance-scale/baseline-browser.json`):

| Page | Longest task | TBT | Settled |
|---|---:|---:|---:|
| CPI | 8,196 ms | 9,075 ms | 11.4 s |
| Factories | 6,670 ms | 6,823 ms | 8.7 s |
| Markets | 5,231 ms | 5,402 ms | 7.7 s |
| IIP | 4,969 ms | 5,041 ms | 7.1 s |
| Schools | 3,999 ms | 4,836 ms | 5.9 s |
| Farm households (queued) | 786 ms | 34,875 ms | 47.9 s |
| Digital access (queued) | 757 ms | 31,865 ms | 42.9 s |
| Pensions (queued) | 662 ms | 27,003 ms | 42.2 s |
| Energy (queued) | 549 ms | 15,622 ms | 25.7 s |
| Households (queued) | 550 ms | 7,214 ms | 14.1 s |
| State profiles (36) | 606-1,025 ms | 587-1,070 ms | 1.6-2.4 s |

- No page meets the 200 ms target. CLS is ≤ 0.011 everywhere and LCP is 0.5-0.86 s.
- Queued guides never block for long at once, but they keep a phone busy for 25-48 s.
- Chart drawing belongs to the chart-kit session. These ceilings make sure the kit's gains are kept.

Search (`performance-scale/baseline-search.json`), 40 labelled queries:
- 31 pass. 9 are known ranking issues, listed in `perf/search-queries.json` with what goes wrong.
- A cold query fetches a median of 169 KB gzip in 5 files, and at most 411 KB in 11 files. That
  comes on top of the 390 KB core.

## 2026-10-15: every-cut row derivation, 2.8x faster, identical output

Deriving every Every Cut row (1,640,096 rows, 36 guides) happens in the build, the search index,
the explorer pack, qc, explore-verify and the slowest tests.

- **Before:** 182 s.
- **After:** 64 s.
- **Proof of identical output:** the same SHA-256 over every row of every page
  (`4025f1505c64f137…`), old module against new, same machine.

What changed in `src/dossiers/everycut.js`:
- `grp` reuses one `Intl.NumberFormat` per precision. `toLocaleString` with options built a new
  formatter per call, which was 52% of the time.
- `periodLabel` is memoized per bundle and date. The `PERIOD_LABELS` prefix scan was 24%.
- `rowAnchor` hashes with one-shot `crypto.hash` where Node has it: same bytes, 2x faster.

## 2026-10-15: fonts split into primary and on-demand files, outlines proven identical

`scripts/fonts-build.mjs` (subset-font 2.9.0, harfbuzz wasm, no Python) cuts the six self-hosted
originals (now `fonts/source/`) into four files per face:
- **primary:** the characters the site uses, listed in `fonts/primary.txt` with page counts;
- **extra:** the latin-ext characters the site uses (₹, †);
- **two rest files:** every other glyph the originals cover, so coverage is unchanged.

How it is checked:
- **Self-check:** every glyph's outline and advance, at four weights × four optical sizes, equals
  the original's. That is 25,952 comparisons, all identical.
- **Weight axis left alone:** cutting `wght` to 300-700 moved some outlines by one font unit at
  700, so it is not done.
- **Real coverage:** `unicode-range` is each file's actual coverage. The old Golos latin-ext rule
  claimed ₹, which Golos does not have, so every rupee page fetched 19 KB for nothing.
- **Caching:** names are content-hashed and `/fonts/*` is immutable.
- **Cleanup:** six unused files (Archivo, Newsreader, Plex Mono; about 500 KB) left the deploy.

| Page | Fonts before | Fonts after (expected) |
|---|---:|---:|
| Guide or state page | 281-523 KB | ~128 KB (serif 97 + sans 27 + extras 4) |
| Page with italic headings | | +106 KB for the italic primary |

The after column is confirmed by the build-2 measurements below.

## 2026-10-15: search ranking, judged on labelled reader queries

`perf/search-queries.json` holds 42 queries with written expectations. `perf/search-heldout.json`
holds 20 more, with expectations written before running either engine; it is never used for
tuning. `layout()` in search-core is the one result order: the home page renders it and
`perf-search` judges it.

| Engine | Labelled | Held-out |
|---|---:|---:|
| 417a96f | 21/40 | 12/20 |
| Now | 38/42 | 18/20 |

Fixed by general rules, none of them per query:
- a guide answers to its slug, formal name and initials (CPI, IIP);
- a guide needs a title-level match to appear (a blurb mentioning ₹ no longer surfaces five
  guides for "rupee");
- a guide or chart every word names leads, unless a series label is the query itself;
- a chart in a guide about the words outranks a passing mention;
- the typed word outranks its synonyms;
- India and total rows break ties when no place is named;
- synonyms take plurals while typing ("inflation" → "prices");
- deficit and surplus find the published "balance".

Known misses, recorded in the query file:
- onion prices
- forex reserves
- fiscal deficit
- school enrolment

FDI (held-out) passes only loosely.

## 2026-10-15: search index v2, a fixed-size core

Same catalogue (1,708,268 series). Node, gzip -6 (`perf/runs/v2-search.json`).

| | v1 (417a96f) | v2 |
|---|---:|---:|
| core.json | 2,357 KB raw / 390 KB gzip | 550 KB raw / 110 KB gzip |
| core parse + engine setup | 176 ms | 22 ms |
| cold query, median gzip fetched | 169 KB in 5 files | 74 KB in 11 files |
| cold query, max | 411 KB | 210 KB |
| index files | 3,245 | 3,925 |
| ranking (labelled / held-out) | | unchanged: 38/42, 18/20 |
| sampled rows found by their own label | | 1,411 of 1,411 |

- **What moved out of the core:** bundle records, bundle-context postings, quantity groups and the
  vocabulary, all fetched by need.
- **Shards and chunks:** token shards are 32 KB; row chunks are a fixed 512 rows, so no bounds list
  ships.
- **Naming:** one release hash names every file.
- **Warm on idle:** the home page fetches the core when idle after load, except on Save-Data or 2G.
- **Budgets:** core 500 KB → 150 KB gzip, and 300 KB gzip per cold query.

## 2026-10-16: every-cut pages stream their rows; build 3, all gates

- **Page size:** each every-cut page holds up to 5,000 rows (was 1,000).
- **What the HTML carries:** the first 100 rows.
- **The pack:** the rest are a gzip pack (`/ec/<guide>/<view>/<page>.<hash>.gz`) of the same row
  markup. `src/dossiers/everycut-html.js` is the one row template, shared by the page and the
  pack.
- **Streaming:** after first paint the pack is fetched, decompressed as it arrives
  (DecompressionStream) and appended in batches of about 8 ms. Then sort, filter and the browser's
  find-in-page cover every row of the page.
- **Guide pages:** the inline every-cut tables stream the same way.

| | Baseline (417a96f) | Build 3 |
|---|---:|---:|
| every-cut pages | 2,008 (1,319 MB) | 718 pages (64 MB) + 741 packs (75 MB) |
| dist | 15,763 files, 4.78 GB | 15,897 files, 3.56 GB |
| pages built | 2,113 | 823 |
| build, wall | 798 s | 580 s (build 2, machine quiet); 572 s (build 3, tests alongside) |
| page rendering | 488 s | 380 s |
| `npm test` | 944 s (cleanup session, same commit) | 255 s, 326/326 pass (a build alongside) |
| every-cut HTML, gzip median / max | 43 / 157 KB | 8.6 / 22 KB |
| guide HTML, gzip median | 65 KB | 34 KB |
| fonts per guide / state / every-cut page (perf-budget upper bound) | 509 / 274 / 157 KB | 231 / 125 / 121 KB |

Phone, 390 px, 4x CPU, median of 3 (`perf/runs/build2-browser.json`; chart code unchanged):

| | Baseline | Build 2 |
|---|---:|---:|
| Median longest task, 72 pages | 958 ms | 877 ms |
| Median TBT, 72 pages | 1,050 ms | 962 ms |
| Median LCP, 72 pages | 610 ms | 568 ms |
| Farm households TBT | 34.9 s | 26.6 s |
| Pensions TBT | 27.0 s | 17.4 s |
| Digital access TBT | 31.9 s | 27.0 s |
| Three largest every-cut pages (5,000 rows each, streaming) | | longest task ≤ 87 ms, TBT ≤ 61 ms, CLS 0 |

- The three-worker run flagged 5 pages 15-25% over their records. Rerun alone (5 runs, 1 worker),
  all 5 were under baseline. It was CPU contention from a browser check running alongside, so
  perf-browser now says to run on a quiet machine.
- Real Chrome check on `/guides/farm-households/every-cut/nss77/` with a link to its last row:
  - all 5,000 rows arrived;
  - the linked row was marked and scrolled into view;
  - `window.find` found its label;
  - sorting covered streamed rows;
  - no console errors.

  On the CPI guide, the 557-row inline table streamed in with 25 rows shown, as before.

Gates on build 3, all passing:
- qc: 516 s, 6.3 GB RSS; every guide's rows counted once across page and pack.
- lint-charts: 1,892 SVGs × 2 widths, clean.
- explore-verify: 1,708,268 records exact.
- perf-budget and perf-search pass.

On the way, qc caught a bare `addEventListener` the gates' jsdom did not have (fixed: `window.`).

Raised one ceiling, with the reason recorded in `perf/budgets.json` `raised`: every-cut JS 4 → 6 KB
gzip (streaming code, 3.6 → 4.7 KB).

## 2026-10-16: search latency on a throttled phone (build 3)

`npm run perf:search-browser` serves the real home page at 390 px, 4x CPU, 1.6 Mbps / 750 kbps /
150 ms. It types each labelled query and times the first result row and the series rows. Medians
over 14 queries (`performance-scale/build3-search-browser.json`):

| | First result | Series results | Series, p90 |
|---|---:|---:|---:|
| cold: typed as soon as the page loads (core not yet fetched) | 0.99 s | 1.93 s | 2.57 s |
| after 3 s idle (core warmed on idle) | 0.31 s | 1.18 s | 1.84 s |
| warm: a second query in the same tab | 0.15 s | 0.49 s | 0.69 s |

The earlier pass measured complete cold results at 4.6-5.8 s under the same throttling. Its
harness differed (`launch-performance.md`), so the comparison is indicative. Lab numbers, not
field p75. The slowest query is "urban female unemployment": four large postings, 2.7 s cold.
