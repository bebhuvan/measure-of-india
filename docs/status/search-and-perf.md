# Search and performance (2026-10-18 to 2026-10-19)

Branch `lb/search` (worktree `../atlas-worktrees/search`), made from `lb/chartkit` at `5d3e5100`, the
commit live at measure.thisindianlife.today. Not pushed, merged or deployed.

"Before" is a build of `5d3e5100`; "after" is this branch. Both built from the same committed data
with `npx astro build`, measured with the repository's own tools (`scripts/perf-budget.mjs`,
`scripts/perf-search.mjs`, `/usr/bin/time -v`) plus a heap sampler that logged the build
process's `heapUsed` every 2 s.

Gates on the final build: `npm test` 326 of 326; `npm run gates` passes validate, kit lint,
coverage, as-of, qc, both chart lints, masthead fit, explorer verify and seo, then stops at
perf-budget on the two explore pages in section 5; perf-search (42 of 45, the 3 recorded misses)
and perf-browser (all 75 pages within budget) pass when run on their own.

## 1. Search (reader feedback, 18 October 2026)

What readers said: results changed out of sight, below a gap under the box; and charts should come
up like articles ("rural" should offer the rural charts, not "Goa, rural" CPI rows).

What changed:

- **One search box, everywhere.** `src/search/ui.js` is the box's results for both the home page
  and a new real input in the masthead of every page (`src/search/header.client.js`), with the
  `/` shortcut. Reached for, the masthead box opens as a panel with an ink edge (desktop) or a
  full-screen sheet with a text Close (phone); the results sit directly under the input and are
  redrawn on each keystroke. Escape, Close or leaving the box closes it.
- **Tabs with counts:** All, Charts, Guides, Data series, Files. Arrow keys move through results,
  Enter opens one, Tab reaches the tabs, left and right move between them.
- **Charts and guides before series on All** (`layout()` in `src/dossiers/search-core.js`). They
  answer from the core at the first keystroke, so the list never reorders when the series arrive
  below them. A chart whose title or finding only begins with the word ("petroleum" for
  "petrol") comes after the series.
- **Charts as articles:** thumbnail, title, finding in two lines, guide. The thumbnail is the chart
  kit's own phone drawing with its text and hover targets removed and coordinates rounded
  (`scripts/lib/search-thumbs.mjs`): 585 of 617 charts have one, about 0.5 KB gzip at the median,
  fetched only when the result is on screen. A table or map chart shows no frame.
- **Broad one-word queries group charts by guide** ("rural": Consumer prices, Jobs, ...).
- **Labelled queries** added to `perf/search-queries.json`: "rural" (a chart or guide first),
  "tap water" (schools with a tap, UDISE+) and "rural sanitation" (NFHS household rows). The site
  has no household water or sanitation chart yet: that is the WASH coverage gap
  (`docs/PLAN-coverage-expansion.md` §5), recorded in each query's `why`, not papered over.
  Two earlier known misses ("fiscal deficit", "school enrolment") now pass and lost their mark.
- **Faster candidate scan:** postings are walked with cursors over sorted lists instead of sets,
  and a broad word's ids are merged with a typed-array sort.

perf-search: 42 of 45 labelled queries pass; the 3 failures are the recorded known misses (onion
prices, forex reserves, electricity generation), unchanged.

Checked in Chrome at 1280 and 390 px: typing "rural", "tap water" and "fiscal deficit" in the home
box and the masthead box, the Charts tab, arrow keys, Tab to the tabs (visible focus ring), Escape.
Fixed on the way: the folded masthead icon on phones was 19 px tall (now a 40 px target); Escape
did nothing once focus was on Close or a tab; a chart without a thumbnail showed an empty frame.

## 2. What search costs every page

The first cut linked the results' stylesheet from every page (the home page imported the module
statically, and the build hoisted its CSS), contrary to what the docs said, and put 4,231 pages
over their CSS or JS ceilings. Now:

- `search.css` comes inside `ui.js` as text and is added as a `<style>` when the module loads.
- The home page loads `ui.js` when it goes idle or at the first keystroke, as it already did the
  core; the module is no longer part of its own script.
- The masthead script imports `ui.js` without Vite's preload helper (the import's argument is
  parenthesised; Vite wraps only an import whose argument starts with a quote), carries only what
  opens the box (ui.js wires Close, Escape and leaving it, and makes the Close button and hint),
  and folds in `src/pwa/app.js`, so every page loads one script instead of two.

Per page, before (5d3e5100) and after, gzip bytes:

| Page | HTML | JS | CSS |
|---|---|---|---|
| `/` (home) | 13,398 → 13,445 | **15,768 → 4,829** | 13,252 → 13,305 |
| `/guides/cpi/` | 133,447 → 133,597 | 8,575 → 8,866 | 11,680 → 12,020 |
| `/states/kerala/` | 35,874 → 36,043 | 6,433 → 6,724 | 10,090 → 10,430 |
| `/guides/cpi/every-cut/cpi-2012-early-by-state/` | 15,803 → 15,951 | 5,510 → 5,801 | 11,093 → 11,433 |
| `/data/cpi-2024/` | 3,930 → 4,083 | 639 → 930 | 13,252 → 13,305 |
| `/explore/` | 4,071 → 4,161 | 40,509 → 41,423 | 10,526 → 10,866 |
| mean over all 3,463 pages | +153 | +288 | +120 |

Fonts are unchanged. The home page sheds 10.9 KB of script because the search module now loads
after the page; everywhere else the masthead box costs about 0.3 KB of script, 0.15 KB of HTML
and 0.05 to 0.35 KB of CSS. The first cut had cost 1.3 KB of script and 1.4 KB of CSS a page.

perf-budget: two pages over, both explore pages' HTML (`/explore/` 4,161 B against a recorded
4,096; `/explore/retail-inflation-2012/` 5,160 against the explore default of 5,120). Their
ceilings had 25 and 56 B of headroom before the search box; no ceiling was raised (section 5).

**A regression caught on the phone, and fixed.** To save a few bytes the first version held the
page under the phone sheet with `html:has(.sx.open)`. A `:has()` on the root makes Chrome recheck
style on every DOM insertion, and guide pages insert thousands while charts draw and every-cut
tables stream. perf-browser (390 px, CPU 4x slower, 5 runs each, base and branch back to back):

| Page | TBT base | TBT with `:has()` | TBT, rule removed | Settled base / with `:has()` |
|---|---|---|---|---|
| `/guides/cpi/` | 129 ms | 373 ms | 145 ms | 3.4 s / 6.2 s |
| `/guides/climate/` | 78 ms | 281 ms | 92 ms | 2.6 s / 4.9 s |
| `/states/kerala/` | 165 ms | 292 ms | 166 ms | 1.5 s / 1.8 s |

The script now sets a class on `<html>` instead (`html.sx-on`), with a comment in atlas.css saying
why. Avoid `:has()` on `html` or `body`.

Full phone gate after the fix (75 pages, 3 runs each, one worker), medians against 5d3e5100:
guides' TBT 64.5 → 58 ms, longest task 90 → 85.5 ms, LCP 554 → 518 ms; state profiles' TBT
183 → 158.5 ms, LCP 544 → 532 ms. That is parity within noise; all 75 pages are within budget.

## 3. Build memory

What drives it: module-level caches that live for the whole build. The largest was
`loadBundle` in `src/dossiers/everycut.js`, which kept every parsed bundle (2,643 files, 1.1 GB
of JSON, 1.43 GB of heap measured on its own); the every-cut rows of all guides add about 1.3 GB
(`everyCutPlan` over every guide: 2.76 GB retained with both).

Fix: parsed bundles now sit in a most-recently-used cache of 192 MB of source text, and each
bundle's meta (what the every-cut pages, titles and bases read) is kept separately. Output is
byte-identical: `diff -r` of the dist trees differs only in two timing fields of
`explore-data/coverage.json`.

| Build | Heap limit | Heap peak | Peak RSS | Wall | CPU (user) |
|---|---|---|---|---|---|
| before (5d3e5100) | default, 4.1 GB | 3.89 GB (94% of the limit) | 5.3 GB | 13 min 24 s | 1,138 s |
| before (this branch, old cache) | 8,000 MB | 5.29 GB | 8.1 GB | 11 min 4 s | 798 s |
| after | default, 4.1 GB | 3.30 GB | 5.3 GB | 12 min 11 s | 909 s |
| final branch, as CI runs it | 6,144 MB | about 4 GB (the collector waits longer when allowed) | 6.4 GB | 11 min 0 s | 814 s |

On this machine the old code passed on the default heap, but only just: at 94% of the limit the
garbage collector ran hard (1,138 s of CPU against 909 s after). Any growth in the data took it
over, which is the failure the deploy and update workflows saw. Peak RSS is set by the search
index step, a child process with its own 8 GB limit.

CI: the deploy, update and CI workflows now build with `NODE_OPTIONS=--max-old-space-size=6144`
(GitHub's runners have 16 GB), so the build is not back at the edge when the data grows.

Machine note (19 October): two concurrent full builds on this 30 GB, swapless machine tripped
systemd-oomd and killed the desktop session. Heavy commands now take `flock /tmp/atlas-build.lock`.

## 4. Fonts and other measurements

- **Fonts** are the largest download (227.5 KB on every guide and the home page, 115 to 119 KB
  elsewhere) and were left alone. The guide pages' weight is Newsreader roman (95 KB) plus italic
  (106 KB): the italic is in every guide's headline and the dek. Both are already subset to the
  characters the site uses, split so rare characters load only when shown, and self-checked
  outline for outline (`scripts/fonts-build.mjs`). What is left would change how the pages look:
  pinning the optical-size axis or setting the dek and headline emphasis without the italic would
  each save about 100 KB a guide page. That is a design decision, not a performance fix.
- **Minifier.** Re-minifying the built chunks with terser (5.36, two compress passes) saves 3% of
  JS gzip: 1.5 KB across the main chunks, about 160 B on a guide page, 650 B on the indicator
  explorer. It needs `terser` as a devDependency and `vite.build.minify: "terser"`; not done,
  because `node_modules` is shared with the chartkit worktree.
- **Search engine time** (perf-search, in-process, per query): median 58 to 115 ms across runs on
  a machine running other builds, so not a clean comparison; the broadest query, "rural"
  (8,62,780 rows), takes about 390 ms.

## 5. Left undone, and owner decisions

- **The two explore pages' HTML ceilings** (above). The masthead box is about 90 B of gzip HTML
  there and their ceilings had 25 and 56 B to spare. Per the brief no ceiling was raised, so
  `npm run gates` stops at perf-budget on these two pages. Options: record a `raised` entry for
  `/explore/` (4,096 → 4,198 B) and the explore default (5,120 → 5,222 B) giving the masthead
  search as the reason, or drop something from those pages' head.
- **Household water and sanitation charts** do not exist yet (the WASH guide). Until they do, a
  reader typing "rural sanitation" gets NFHS series rows, not a chart.
- **Terser** (section 4), if the 3% is worth a devDependency.
- Thumbnails crop a tall drawing to its top; a few dot-plot thumbnails show only legend dots.
- The masthead box's results open about as fast as the module loads (13 KB of script and the 110 KB
  core on first use); on a slow connection the first query shows "Loading search…" until they do.
