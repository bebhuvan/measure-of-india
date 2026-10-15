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
