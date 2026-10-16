# Plan: port every chart to the chart kit (lb/chartkit, from 2026-10-16)

The owner approved the v5 chart kit (`design-mocks/chartkit/`, specimen published as a private
page) on 2026-10-16. This branch replaces Observable Plot, drawn in the reader's browser, with
the kit, drawn at build time. Two reasons, one change:

- **Design.** The kit is the house grammar (DESIGN.md will be updated to it): finding-led titles,
  hairline grid, labels on the gridlines, direct labels, Indian number formats, one lead colour,
  labels placed where nothing is drawn, every chart redrawn for a phone rather than shrunk.
- **Speed.** A guide today ships its bundles as JSON plus Plot to every reader (CPI: 2.2 MB of
  HTML and a 9 s main-thread task on a phone). A kit chart arrives as finished SVG; the only chart
  script is `src/kit/enhance.js` (hover and downloads, ~3 KB).

## The pieces

| File | Role |
|---|---|
| `src/kit/kit.js` | the forms: `line`, `columns`, `bars`, `dumbbell`, `arrows`, `multiples`, `rangeTable`, `tileMap`, `share`, `stack`, `waterfall`, `pyramid`, `scatter`, `heatmap`, `slope`, `strip`, `stackBars`, `spark`; `num()` and `inGroup()` for Indian formats. Each form's spec is documented above it. Every form's output passes `finish()` (labels pulled inside the edge, thin rules broken around labels). |
| `src/kit/metrics.js` | advance widths of Libre Franklin, so labels are placed exactly at build time. Regenerate with `python3 scripts/kit-metrics.py` only if the font files change. |
| `src/kit/figure.js` | `figure({ draw, bare, label, file, data })`: three drawings (1184, 720, 360 px) and the CSV data, one `<figure>`. `bare: true` for a guide plate, which keeps its own title, source line and buttons. |
| `src/kit/kit.css`, `src/kit/enhance.js` | loaded by `src/layouts/Base.astro` on every page. Container queries pick the drawing; enhance wires hover and the plate's SVG/PNG/CSV buttons. |
| `src/kit/data.js` | `pairs(bundle, key, {from, to})` → `[[date, value]]`, rates rounded to the published precision; `last`, `first`, `monthLong`, `monthShort`. |
| `src/dossiers/<slug>.charts.js` | one per guide: a function per plate returning `figure({ bare: true, ... })`. Runs at build time only. |
| `scripts/lint-kit.mjs` | geometry lint for kit SVGs: text overlap, a stroke through a label, a label over a dot, text past the edge. `node scripts/lint-kit.mjs <url or file or dist>`. Also runs inside `lint-charts.mjs`, so `npm run gates` covers it. |
| `scripts/kit-specimen-lint.mjs` | the kit's regression test: every specimen form at the three widths. Run after any change to `kit.js`. |

Reference port: CPI §02 (`nb()` in `src/dossiers/cpi.charts.js`, `#plot-nb` in `src/pages/guides/cpi.astro`).

## How to port a plate

1. In the guide's `.astro`, replace the plate's `<div class="legend">…</div>` (direct labels
   replace legend chips) and `<div class="plotzone" id="plot-x"><div class="cb-tip"></div></div>`
   with `<div class="plotzone" id="plot-x" set:html={CH.x()} />`. Keep the plate's `figure id`,
   `.plate-head`, `.plotfoot` (source line and download buttons) and the explain/now prose.
2. Write `x()` in `src/dossiers/<slug>.charts.js`, reading the same bundles the client read.
   Pick the form by the plate's question (below), not by what Plot drew.
3. Move the plate's number wiring (`setTxt`, `setHTML` on `pv-*`, `n-*`, `ex-*` ids) into the
   page's frontmatter so the numbers are in the HTML. Keep every id and the exact text it showed
   (qc.mjs checks many of them). When a guide's client file has nothing left, delete it and its
   `<script>` import: the page then ships no bundle JSON. A real interactive control (a picker
   that redraws) may keep a small client script, fed precomputed compact data, never a bundle.
4. Delete the plate's Plot code. `src/charts/plumbing.js` is retired once nothing imports it.

## Choosing the form

| The plate's question | Form |
|---|---|
| How has one measure moved over time? | `line` (one lead series; context series `ctx`/`ctx2`; `band`, `refs`, `seam`, `events`, `notes`, `recon` for back-cast stretches, `step` for policy rates) |
| Discrete periods, growth rates, a quarter at a time | `columns` (latest picked out; `events` notes) |
| Rank units on one number (states, items) | `bars` (with `ref` for the all-India figure) |
| Two numbers per unit (rural/urban, men/women, two years) | `dumbbell`, or `slope` for two dates with many units |
| Where each unit moved between two dates | `arrows` |
| The same measure for many units over time | `multiples` (shared scale), or `heatmap` (units × periods) |
| Where today sits in each row's history | `rangeTable` (replaces sparkline tables) |
| States on a map | `tileMap`, usually beside `bars` |
| Parts of a whole over time | `share` (story layers from zero, the rest quiet), `stack` only when every layer matters |
| Parts of a whole across units | `stackBars` |
| A total built from parts | `waterfall` |
| Two measures across units | `scatter` |
| Every item at once | `strip` |
| Age and sex | `pyramid` |

## Rules (AGENTS.md hard rules apply; these are the chart ones)

- Never splice across a base change: a different base is another series, drawn with a `seam`.
- Missing is `null` and shows as a gap; never draw a zero for a blank.
- No dual axes. Units with different scales go to separate charts or `multiples`.
- Colour by role: `lead` for the series the plate is about, `comp` (sindoor) for the one
  comparison, `ctx`/`ctx2` greys for context; `cat` hues in fixed order only for genuinely
  categorical sets of up to five. Text never takes a series colour.
- Labels: direct, never a legend when an end label can reach. Every chart passes `lint-kit`.
- Numbers on the chart equal the numbers in the prose: both come from `pairs()` (rounded once).
- Titles stay in the plate head. The `label` given to `figure()` is the accessible description:
  say what the chart shows, in a sentence.

## Kit changes

`kit.js` is shared by everyone porting. Change it only by small, additive edits (a new optional
spec field, a fix that keeps other forms' output unchanged), never a rewrite or reformat. After
any change run `node scripts/kit-specimen-lint.mjs` (must report 0 finds). Note the change in the
log below.

## Checking a port (no full build needed)

- Dev server: `npx astro dev --port 4480 --host 127.0.0.1` in this worktree (one is usually
  running; check `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4480/`).
- `node scripts/lint-kit.mjs http://127.0.0.1:4480/guides/<slug>/` → 0 finds.
- Screenshots of each ported plate at 1300, 800 and 390 px wide, looked at: no clipped or
  colliding labels, the right drawing shown, the plate reads on a phone.
- No `–` placeholders left in the page's number ids; no console errors.
- Before merge (one session at a time, disk!): `npx astro build`, `npm run gates`.

## Status

| Guide | Owner | Plates ported | Client JS removed | Notes |
|---|---|---|---|---|
| cpi | cpi port | 27 of 27 kit figures (every Plot plate, both grids) | yes | numbers, ledgers, tables in cpi.charts.js `NUM` at build time; table plates link the whole bundle CSV |
| housing | people port | 8 of 8 | yes | `numbers()` in housing.charts.js |
| poverty | people port | 7 of 7 | yes | spells drawn as separate dotted series, never joined |
| population | people port | 12 of 12 | yes | estimates and projections separate series with a seam; pyramid in millions |
| consumption | people port | 14 of 14 | yes | register and baskets built at build time |
| jobs | people port | 21 of 21 | yes | deep-bundle slices moved to `jobsData()` in jobs.data.js; register sparklines at build time |
| ilo | people port | 17 of 17 | yes | |
| households | survey port | 15 of 15 | yes | rural/urban pairs as dumbbells (values on the name line on a phone), different classes per sector as bar panels, states ranked against the all-India figure; numbers in `householdNumbers()` |
| schools | survey port | 19 of 19 | yes | enrolment drawn as two rulers with a seam (school totals, pupil records); single-teacher panels beside the national totals; Bihar's published 0% dropout drawn and labelled "published as zero" |
| digital-access | survey port | 18 of 18 | yes | state plates now ranked (the explain line says so); payload module and its tests retired |
| energy | survey port | 19 of 19 | yes | flow bridge a waterfall on desktop, ranked steps below 1,000 px; payload module and its test retired |
| farm-households | survey port | 21 of 21 | yes | |
| pensions | survey port | 16 of 16 | yes | the governed CSV guard still runs per plate at build; the plate download is date, period and value (the full governed CSV stays in Data and downloads); expected schedule dashed, hollow dots |

## Log

- 2026-10-16 kit in `src/kit/`; build-time metrics; three-width figures; hover data on the
  figure; `finish()` pass; segment-aware label placement with a key fallback; lint-kit;
  specimen lint 0 finds; qc counts a kit figure once; lint-charts runs lint-kit.
- 2026-10-16 (cpi port) bars and dumbbell `band`; multiples `band`, `boldHighlight`; line `inside:false`;
  line's phone inside end label tested against line segments, not only points; strip label rows tested
  at the height they are drawn. Specimen lint 0 finds.
- 2026-10-16 (people port: housing, poverty, population, consumption, jobs, ilo) bars `sign`, `row.note`,
  `refFill:false`, label stepped clear of a mark ring; line `series.dots` (true/'open'), `series.line:false`,
  `series.endLabel`, notes keep clear of every label already drawn (seam, event, shade); dumbbell `refs`
  (several rules, sided labels), `r.a0/r.b0` (earlier-round pale dots, labels step past them), `r.bColor`,
  `from`, `endCol`; pyramid `counts` (values as given, `unit`, `tipUnit`); heatmap `fillAt(v, j)` (a scale
  per column); multiples `seamAt`, `panel.domain`. Specimen lint 0 finds.
- 2026-10-16 (industry port: factories, iip, manufacturing) kit additions: multiples `domain:{lo,hi,ticks}`
  (a fixed shared scale, values clipped on both sides and said so); scatter `medians:false`,
  `diag:{label}` (the y = x line), `point.color`. Specimen lint 0 finds.
- 2026-10-16 (panels port) `panels()` titles may be `[name, sub]` (sub muted, on its own line when the two do not fit);
  `panelFit(width, n, {gap, min: 340})` decides side by side or stacked; dumbbell a-dot tip had a stray quote (fixed).
  Multi-panel plates now one kit figure each: debt credit gap, banks shares and UCBs, payments shares/cash/clearing,
  factories long century/counts/money/sectors, mnre states and source maps, aishe composition and states, farms state
  shares and state yields. Page-only `.pm-*` and `.fx-*` styles removed. Specimen lint 0 finds.
- 2026-10-16 (survey port: households, schools, digital-access, energy, farm-households, pensions) dumbbell
  `nameMax` (a wider name column, default 190). Shared shaping helpers in `src/dossiers/survey-plates.js`.
  Specimen lint 0 finds.
- 2026-10-16 (page design v5, from the approved mocks) Newsreader and Libre Franklin site-wide; masthead with
  a dateline; margin 268, gap 64; guide title block, contents, part heads and plates restyled in atlas.css (markup
  unchanged); front page rebuilt on the kit (`home.charts.js`: cover line, ledger sparks, CPI state tiles); the guides
  index's featured chart and sparklines moved to the kit. `src/charts/static.js` is no longer imported by any page.
  Fonts sit in public/fonts for now; after lb/perf merges they go through its fonts/source + fonts-build split.
