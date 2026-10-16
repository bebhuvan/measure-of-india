# DESIGN — the India Atlas design system (v5, 2026-10)

**v5 (16 October 2026), approved by the owner with the chart kit.** It keeps v3's sheet and
raises its proportion and type. Where v5 and anything below disagree, v5 wins.

- **Type.** Newsreader (variable, optical sizes 6 to 72) for reading and headings; Libre Franklin
  for everything measured or navigational, and for every chart (`src/kit/metrics.js` holds its
  advance widths). Guide titles are a phrase at 68 px, weight 400, their second half in light
  italic. Kickers and part labels are 12 px Libre Franklin capitals, tracked .08em.
- **Sheet.** Margin 268 px, gap 64 px, field 852 px; plates still span the whole 1184 px sheet.
  Each part of a page opens with an ink rule across the sheet, its numeral hanging light in the
  margin (40 px, `--faint`).
- **Colour.** Ink #15171A, lead indigo #2E4BC4 (kit `lead`), sindoor #D04A2E for the one
  comparison (kit `comp`); greys as in `src/styles/atlas.css` `:root`.
- **Masthead.** Name and line, sections, search; then the dateline, an ink rule over where you are
  and how fresh the page is (`.sh-date`, which qc reads).
- **Charts.** Every chart is drawn at build time by the chart kit (`src/kit/`, plan
  `docs/PLAN-chartkit-port.md`); §0.4 and §5's Plot-era recipes are history.
- **Front page.** The newest print as a finding with its figure in the margin and its chart; search;
  the ledger of the measures that move every month or quarter; states as equal tiles; the guides
  on dotted leaders (`src/dossiers/home.charts.js`). Reference mocks: `design-mocks/pages/`.


v3 (10 October 2026) is the whole-site design pass on the v2 lineage: one left axis, one type
scale, AA greys, the chart card with a fixed anatomy, an action row in place of the Share
menu, set tables, and a new front page. Its rules are in **§0**; where §0 and an older line
below disagree, §0 wins. The critique that led to it is `docs/design/critique.md`.

## 0. The v3 system (normative)

### 0.1 The ledger margin

The one structural idea of v3, and the thing the site is recognised by. Every page is a sheet
of two columns on one left axis:

```
 axis
 |<-- margin 220 -->|<- 56 ->|<------------------ main field ------------------>|
 |  02              |        |  The new base: a continuous headline            |  section
 |  y/y %, base 2024|        |  prose, at its measure (64ch)                   |
 |                  |        |                                                 |
 |  4.8%            |        |  One continuous headline on the new ruler       |  plate
 |  Aug 2026, y/y   |        |  subtitle; key                                  |
 |  [ the plot runs across the whole sheet, 1184 px ...........................] |
 |  Download Image  |        |  Source: ...                                    |
 |  SVG Data ...    |        |  How to read this      |  As of September 2026  |
```

- The **margin** (220 px, `--rail`) carries the figures and the furniture: section numerals
  (light serif, the size of the heading), each chart's readout, the key figures of a guide's
  title block, the date on the front page, kickers, margin notes, the numerals of
  misreadings and standing rules, a chart's actions, the labels of the end-matter rows.
  Read down the margin and you have the numbers.
- The **main field** (starts at `--main`, 276 px from the axis) carries the account:
  titles, headings, findings, subtitles, keys, prose, notes, sources.
- **Charts, tables and ledgers span both.** A plot is drawn 1184 px wide and starts on the
  axis; its title starts on the main line above it.
- Built in CSS on the existing markup (`atlas.css`, "THE LEDGER MARGIN"): `.page > section`
  is the two-column grid, `.sec-head` and `.plate-head` are `display:contents` so their
  parts land in the margin or the main field. No guide page needed new markup.
- Below 860 px the margin folds: everything stacks in one column in reading order, the
  numerals and readouts set inline above what they belong to.
- `--wrap` is 1184 px of content with 32 px gutters (20 px on a phone). The masthead, crumb
  and footer share the axis. Vertical rhythm: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128 px;
  sections 112 px apart (72 on a phone); a plate in a run 96 px from the one before, with a
  hairline.

### 0.2 Type scale

| Role | Face, weight | Size / leading (desktop; phone) |
|---|---|---|
| Guide title (h1) | Serif 500, opsz 60, -0.022em | 4rem / 1.02; 2.5rem |
| Page title (h1) | Serif 500 | 3.25rem / 1.05; 2.375rem |
| Section head (h2) | Serif 500, opsz 48 | 2.125rem / 1.12; 1.75rem |
| Chart title, the finding (h3) | Serif 500, opsz 32 | 1.625rem / 1.22; 1.375rem |
| Lede | Serif 400, ink-soft | 1.375rem / 1.45; 1.1875rem |
| Body | Serif 400 | 1.1875rem / 1.62; 1.0625rem / 1.6 |
| Notes under a chart | Serif 400 | 1.0625rem / 1.6 |
| Big figure | Serif 300, lining | 2.75rem (titleblock), 2.25rem (chart readout), 6rem (the reading) |
| UI and labels | Golos 400/500 | .9375rem (subtitles, nav), .875rem (labels, meta), .8125rem (source lines, captions; the floor) |
| Chart text | Golos 400 | 12px; axis and notes in `--axis`, labels in ink |

Nothing a reader is meant to read is smaller than .8125rem (13px) on the page or 12px in a
chart. Weight carries emphasis (500 in sans, 600 in serif), never colour.

### 0.3 Colour (AA)

- `--muted` is #6B7180 (4.9:1 on white): every caption, label, axis and source line.
  `--faint` (#B5BAC4) and `--grey2/3` are for rules and marks only, never for text.
- Chart text in a light grey (#878D99, #A3A9B4, #B5BAC4, set by client code) is lifted to
  `--axis` (#6B7180) by `atlas.css`, and the export inlines it, so downloads match the page.

### 0.4 The chart card

Every plate has the same anatomy (on the ledger margin, §0.1):

1. **Readout** in the margin, level with the finding: the one figure the finding is about,
   light serif 2.75rem, a one-line caption under it. A long figure ("₹158.1 lakh crore") is
   set at 2rem and a name ("Personal care, incl. gold") as a 1.375rem serif line;
   `guide.client.js` decides by length once the client has filled it.
2. **Finding** (h3) in the main field: the claim the chart proves, in a sentence.
3. **Subtitle**: what is measured, the unit, the period. Golos, ink-soft, at most 72ch.
4. **Key** (`.legend`), on the main line: short lines for line series, squares for areas and
   bars; only when there are two or more series.
5. **Plot** across the sheet; gridlines `#E8EBEF`, zero rule `#C9CED6`, axis text `--axis`.
   No filled areas under lines (DESIGN §7.12): a line is a line.
6. **Footer** under a hairline: the actions in the margin, the source in the main field.
7. **Notes** in the main field: *How to read this* (evergreen) and the dated *As of* note
   on a square, barely-there wash (#F7F8FA) with its label in ink.

The downloaded image (`composeCardSVG`) is the same card for a feed: the finding with the
readout on the right, the subtitle, the key drawn as short lines, the chart with the page's
lifted colours and halos inlined, a hairline, the source, and the site's name.

### 0.4a Categorical plates on a phone

Below 700 px of viewport, a plate whose y axis is names (bars, dot strips, dumbbells) is drawn
again at the width it has, the pattern the state profiles introduced: each name on its own line
above its row, the marks across the full width beneath it, values labelled at the mark, the
x-axis label on its own line under the ticks. No sideways scroll, no "more to the right" cue.
Faceted plates follow: panels side by side are stacked one above the other with the panel's name
above it; groups down the page get their name on a line above the group. A few named columns
(months, fractile classes) are redrawn to fit. Done once, in `src/charts/plot.js`, which every
`import * as Plot from "@observablehq/plot"` resolves to (alias in `astro.config.mjs`), so no
client file needs to implement this shared layout. Continuous-x lines, scatters and time
plots are also redrawn at phone width, retaining their observations and full domains with
fewer axis ticks. Year columns and year facets, unsupported state × measure matrices,
and hand-assembled multi-panel SVGs retain their authored layouts. Charts already authored
below 600 px and charts with `narrow: false` bypass the wrapper.

Complete category names wrap onto additional visible lines; they must not be shortened
or depend on hover text. Once drawn narrow, labels are measured with the lint's geometry,
margins are widened for bleeds and collisions are settled within a bounded distance.
Long annotation text wraps at its authored font size. Labels near either edge use an
anchor that keeps their words inside the SVG. Rendered review must verify that each
value remains clearly associated with its mark.
Chart lint runs at desktop width and again at 390 (`--width 390`); actual browser checks
at 320, 390 and 545 px remain necessary. The revised wrapper's focused tests preserve
full names, signed domains and all time-series observations. Combined rendered QA is
pending at this checkpoint.

Canvas fitting and subsequent annotation placement must both reserve the full font line box at the chart boundary. Ink-only bounds remain appropriate for annotation/stroke collisions, but must not permit the font ascent or descent to leave the canvas.

### 0.5 Actions, not a menu

The v2 Share menu is retired: it hid four actions behind one word and opened over the chart
it shared. Each chart's footer carries its actions in the open, in the margin, as quiet text
buttons (`.acts`), built by `guide.client.js` from the plate's own download buttons (so
plumbing's handlers stand): `Download` (a label, muted) then *Image*, *SVG*, *Data*; then
*Copy link*, *Source* (and *Whole file* where a plate links its bundle). Buttons are
ink-soft, underline on hover, a 2px ultramarine focus ring. A status ("Link copied") is
announced in a polite live region and fades, never replacing a label or moving the row.

### 0.6 Tables

- Header: Golos .8125rem muted, bottom rule `--rule-2`; rows: a hairline `--rule`, 12 px
  vertical padding (10 on dense tables). Numbers right-aligned, tabular figures, the column
  header right-aligned over them. Names serif when they are the subject of the row.
- No "№" anywhere: a rank reads "349 of 358".
- Row hover is a wash (#F8F9FB), never a colour. A table wider than the phone scrolls inside
  its own box with the first column readable.

### 0.7 Controls

Buttons on the site are text with a hairline underline, or, where a control needs a box
(search, filters in the every-cut table), a 1px `--rule-2` box, square corners, 40 px tall,
Golos .9375rem. Focus is always the ultramarine ring. Selected tabs and filters are ink with a
2px ink underline; others ink-soft. No pills, no rounded chips, no icons without words.

### 0.8 The front page

On the ledger margin, in order:

1. **The promise**: the date in the margin; in the main field the h1 ("The Indian economy,
   from its official figures"), one sentence that counts the guides, the states and union
   territories and the series, and the search box.
2. **The latest figures**: four plates, the figure in the margin at display size, the
   sentence computed from the bundles in the main field with its chart. Prices lead, across
   the full main field (the five-year window, the RBI band and target); growth, factories and
   jobs follow, sentence left and chart right. Each window is the last five years, or the
   whole current base where it is younger (never a spliced older base).
3. **Every guide**: a ledger, the subject in the margin (italic serif), the guides in two
   columns: title, what the figure is and its period, the figure.
4. **States and union territories**: a set list in four columns.
5. **The ideas behind the numbers**: Learn notes, the family in the margin.
6. The footer.

Charts on the front page are drawn at the width they are shown (`briefSVG`), with a desktop
and a phone drawing, so their 12px text is 12px.

## 1. Tokens

Single source: `src/styles/atlas.css` `:root`. Never restyle per page.

```css
--bg:#FFFFFF;   --ink:#161A22;   --ink-soft:#4A5160;
--muted:#6B7180; --faint:#B5BAC4; --rule:#ECEEF2; --rule-2:#DFE2E8;   /* v3: muted lifted to AA */
--axis:#6B7180;  --wash:#F7F8FA;
--accent:#2E4BD8;  /* ultramarine: the series a chart is about */
--accent-soft:#B9C3F3;
--gold:#C47A16;    /* marigold: a comparison series, never decoration */
--grey1:#5F6675; --grey2:#A3A9B4; --grey3:#C9CED6; --band:#F4F6FD;
```

Rules:

- **One colour across the whole site.** No per-topic colours. Ultramarine marks
  what the chart is about; marigold appears only when a second series is
  compared with it; everything else is grey.
- **Text never wears a series colour.** Labels, values and legends are ink or
  grey; emphasis in text is weight (600), not colour. Colour lives in marks.
- **Strong colour on thin marks only.** Areas (tiles, heat cells, bands) use
  pale tints with dark text on top.
- No gradients, no rounded cards, no shadows except the single soft shadow on
  floating menus and tooltips.
- The old palette maps one-to-one onto the new one:
  `scripts/migrations/2026-10-palette.mjs` holds the table (also used to
  rewrite the `color` presentation field of bundles and the adapters).

## 2. Typography

Two self-hosted variable faces (`/fonts/*.woff2`, latin and latin-ext subsets,
the rupee sign is in latin-ext):

| Face | Role |
|---|---|
| **Source Serif 4** (optical sizes 8 to 60) | headlines (500), reading text (400), large numerals (300, lining), quoted misreadings (italic) |
| **Golos Text** | everything measured or navigational: chart text, labels, metadata, tables, nav, buttons |

- **Sentence case everywhere.** No tracked capitals, no monospace labels, no
  numbered "№" kickers, no middle-dot strings in new copy.
- Chart text 11.5 to 12.5px Golos, axis grey `#878D99`; nothing in body copy
  below .75rem.
- Large numerals are light serif (`font-weight:300`, lining figures); values in
  tables and charts are Golos with tabular figures.

### Chart rules (v3)

- One emphasised value per chart: the one the title is about (bold ink).
- Lead lines 2px, supporting lines 1.25 to 1.75px, grid hairlines `#F0F2F5`,
  zero line `#D3D7DE`. End dots 3 to 3.5px radius.
- Reconstructed history (back-casts) is a solid pale tint of the series
  colour, never transparency.
- Label inside the chart (bands, targets, series ends) rather than in the
  subtitle; place labels where no line crosses them.
- Years read 2014, ’16, ’18 … 2026, with small ticks.
- `scripts/migrations/2026-10-chart-v3.py` applied these rules mechanically to
  every Plot chart (text fills to ink, line widths, dot sizes, chart text
  sizes). Per-chart tuning (which row to highlight, which value to label)
  remains editorial work, guide by guide.

### Guide anatomy additions (v2)

- **On this page**: a contents list under the title block, built at runtime from the guide's
  own section headings (`src/dossiers/guide.client.js`).
- **Plates in a run of deep cuts** are separated by air and a hairline; each plate keeps its
  finding as the title, a plain subtitle, the chart, a one-line source and one quiet
  **Share** menu (download image, SVG, data; copy a link to that chart). The menu is built
  from the existing download buttons, so plumbing's handlers are untouched.
- **Notes under a plate**: "How to read this" (evergreen) plain on the left; the dated
  "As of" note in a soft panel on the right. The asof gate still reads its label.
- **Downloaded images** (`composeCardSVG`): wrapped title and subtitle, the chart, a
  hairline, the source, and "India Atlas" with the address. PNG at 3x.
- **End matter**, in order: *Data and downloads* (`src/components/GuideData.astro`: every
  bundle the guide uses, with coverage, base, series count, vintage and CSV/JSON links
  served from `/data/<bundle>.json|.csv`), *Cite this guide*, then *Sources, method and
  revisions* as labelled rows.
- **Display punctuation**: much guide text is assembled from data labels at runtime, so
  `guide.client.js` turns " · " into commas and " — " into colons in rendered text only.
  Hand-written copy was migrated once (`scripts/migrations/2026-10-copy.py`); generated
  prose is held to the same rule by `pipeline/lint.mjs` rule 5.

## 3. Layout skeleton

- `.page` — 880px centred column; all prose lives here.
- `.break` — `width:min(1280px, calc(100vw − 48px))`; charts, ledgers, the
  titleblock break out to this width. **Plots must fit inside their
  container's content box** (1280 break − 48px frame padding → plot ≤ 1184).
  A wider SVG silently overflows — this was a real bug.
- `.sitehead` (66px, 1px ink rule) → optional `.crumb` mono strip → body →
  `.provenance` footer (three columns + double-rule colophon).
- Mobile (≤680px): nav never hides — it wraps and scrolls horizontally; grids
  stack; full plates scroll horizontally rather than shrink past legibility. A scrolling
  plate opens at its latest end with a quiet "← Earlier years" cue (`guide.client.js`);
  any other scrolling plate (dot strips, bars) keeps its left edge with a "More of the chart
  to the right →" cue, since its names fill the first screen.
  Category comparisons marked `data-compact` use a phone layout with wrapped labels above each
  measurement and a separate value column; these plates fit without horizontal scrolling.

## 4. Dossier anatomy

A dossier page contains, in order (the full section contract lives in the
reference implementation `site/dossiers/cpi.html` and the built pages):

1. **Titleblock** (`.break`): kicker `Dossier № NN — Domain · Title`; h1 with
   one italic accent word; italic lede ≤ 2 sentences; `.meta` strip (source,
   frequency, base, coverage, latest print, release date); `.numbers` row of
   4 key figures with delta lines and sparklines.
2. **The current reading** — big-number box + band-position scale; two prose
   columns: *What the print says* / *What it does not say*. Dated.
   Composition rules (learned the hard way): the caption's measure is
   protected (`.rt-cap` max 46ch, never squeezed); a second statistic is a
   **reference stat** (`.rt-side`: right-aligned, kicker above, value at the
   plate-val size 2.9rem) — never a second hero numeral, never an inline
   font-size. One box, one hero.
3. **The register of series** — `.break` ledger: swatch, name, weight track,
   latest, deltas, sparkline. Derived series flagged.
4. **Composition** — `.basket` segmented bar where weights exist; prose
   equivalent elsewhere. The slot is required, its form flexible.
5. **Plates** — headline and component charts, each in a `.frame` with
   `.plate-head` (title + latest value), legend, `.plotzone`, `.plotfoot`
   (source line + SVG/PNG/CSV downloads), and an `.explain` pair
   (evergreen *How to read this* / dated *As of …*).
6. **What this measures** — evergreen prose with margin notes in the rail.
7. **How to misread this** — numbered failure modes; the misreading quoted,
   then corrected without scolding.
8. **Provenance** — source of record, revisions policy, vintage, colophon.

## 5. Chart engineering

All charts are Observable Plot (vendored, pinned), drawn once at module load.
The shared kit is `src/charts/plumbing.js` — **normative, do not restyle**.
Its header carries the two hard-won Plot rules (function-valued `dx/dy`/
`textAnchor` are ignored — split one text mark per side; labels are never
struck by rules — `stripLabelSide`, dumbbells labelled outside the dots).

### Mark recipe (headline plate, z-order)

hairline grid (`#EAE5D7`) → reference band (`--band`) → zero rule → target
rule (dashed, labelled) → event rules (dashed, lighter) → supporting lines
(1.5px, round joins/caps) → derived line (lightest grey, dashed) → headline
(2.75px accent) → last-13-period emphasis (4px) → event dots (accent, white
halo) → placed event labels → end dot → dodged end labels.

### Axes and integrity

- Y label top-anchored (`"↑ year-on-year, per cent"`), `labelArrow:false`,
  `tickSize:0`. X ticks one per year on long plates.
- **`tickFormat` returns strings** — `d=>String(d.getUTCFullYear())`, never a
  number (`2,016` was a real bug).
- Domains admit the data's true range **including negatives**. Clamping at
  zero to look tidy is a data-integrity violation.
- Aspect: headline ≈ 2.1:1 (1184×560); components ≈ 2.5:1 (1184×470).
- Chart text 11.5–12.5px Golos Text `#878D99`; every SVG text carries a white
  halo (`.plotzone svg text{paint-order:stroke}`) — a safety net, not a
  licence: no stroke may pass through a label's glyph box.
- **No smoothing curves, ever** (`curve*`, catmull-rom, basis, monotone are
  banned; QC greps). Lines are straight segments between published points;
  softness comes from round joins/caps.
- Sparklines: 170×38, axes off, y-domain `[min(0, min), max]`, zero rule,
  1.25px line, 2px end dot, `aria-hidden`.

### Seams (two rulers on one chart)

A base change is two rulers, never one line (AGENTS.md rule 1). Every plate that draws more
than one ruler uses `seamMarks(treatment, rulers, marker)` in `plumbing.js`, with one of three
treatments: **side** (rulers side by side, a changeover hairline where the new one starts),
**overlap** (growth inside each base, both drawn through the shared months, the hairline
where the old one ends; `seamOverlap()` gives the shared months and widest gap), **agency**
(a linked line only where the agency publishes the link: its back-cast a solid pale tint,
the live stretch solid, the hairline at the handoff and its label naming the agency). The
facts sheet names the ruler of every number (`ruler` in `pipeline/facts.mjs`).

### Furniture and interaction

- Every plate: `a11y()` (role, aria-label stating ending values, `<title>`),
  crosshair tooltip (nulls render "—"), legend hover-isolation, and
  SVG/PNG/CSV downloads in the plotfoot. Downloads are published artifacts —
  `composeCardSVG()` adds title, source, brand, and embeds the fonts; never
  ship a bare plot. PNG renders at 3× on white.
- Annotation placement is algorithmic (`makePlacer`/`annotationSpot` with
  ordered candidate spots and a guaranteed-safe fallback), verified by the
  chart lint gate. Never hand-tune `dx/dy`.

## 6. Voice (pages; the LLM variant lives in pipeline/)

- Headline h1s may be poetic; everything else is plain. "The cost of an
  ordinary shopping basket, measured monthly" — good. "Unlock insights" —
  banned.
- Numbers: the print at two decimals ("3.51%"), everything else at one;
  deltas in points.
- Dated commentary names its date; evergreen text never says "this month".
- "We do not know" said plainly when true.

## 7. Rejected directions (built and thrown away — do not retry)

1. **Grey slabs with hard frames** — containers read louder than the data.
   Charts sit on paper.
2. **Floating white cards on beige, rounded corners, drop shadows** — the
   default of every SaaS dashboard; an identity replaced by a convention.
3. **Thin wispy lines** — no presence.
4. **Heavy black outlines around flat pastel fills** — clip-art; turns
   month-to-month noise into nervous spikes.
5. **Dark muddy series colours** (navy, mustard, brick, forest at OKLCH
   lightness ~0.5) — ugly. Bright-but-soft means up in lightness, chroma held.
6. **Cramming 100+ monthly points into a wide short strip** — the proportion
   is the problem, not the styling.
7. **Adding devices to fix a chart** — rails, tails, gutters, ribbons, leader
   lines, legends and tags all at once. Every device earns its place.
8. **Bodoni Moda for data numerals** — illegible on non-retina screens.
9. **Smoothing curves** — they falsify data. (Also a hard integrity rule.)
10. **Top-mounted downloads** — they belong in the plotfoot.
11. **The v1 monograph** (vermilion accent, tracked mono capitals, corner-tick
    frames, one italic accent word per headline) — read as generic.
12. **Terrain tints** (one hypsometric key for every percentage change) —
    lemon-green and cartoonish; filled areas made charts loud.
13. **Colour per topic** — turns a reference work into a dashboard.
14. **The Share menu** (v2) — four actions hidden behind one word, opening over the chart
    it shared. Replaced by the action row (§0.5).
15. **Sparklines in the title block** — 100 px lines that said nothing a figure and its
    change did not; hidden in v3.

## 8. Exploration archive

`design-mocks/fresh/` holds the 2026-10 explorations (a to e) and the v2 site
mock with its chart kit (`site/`). `design-mocks/` also holds the eight earlier directions (A–H; the site is "H —
The Monograph, elevated"), the earlier `early-explorations/` (monograph,
gazette, abstract, atlas-plate) and `matrix-explorations/` (schedule, plate,
shirorekha, baseline, matrix, plates). Mine them for isolated ideas; do not
import their aesthetics wholesale. `site/` holds the design-phase reference
implementation in plain HTML — the visual specification the Astro pages were
matched against.

Long numeric headlines may opt into `.numbers[data-long-values]`; below 860px,
auto-fit columns retain a 200px minimum where space permits and stack on phones.
This preserves full rupee values without overflowing the page.

### Small-multiple panel sizing (12 October 2026)

Small multiples draw at the available CSS grid track width when it is smaller
than their authored width; they retain the authored width when layout is not
available. The shared `panelPlotWidth` helper handles this without dropping
observations or shrinking text. Compact category panels can explicitly opt
into the shared phone layout with `narrow:true`; family-authored compact
geometry keeps its default exemption. Small time plots reserve space on both
sides for full year labels. Payments and trade apply these rules.

A controlled browser fixture passes at 320, 390, 545 and 1440 pixels, retaining
every observation in each 76-point history with no text below ten pixels or
clipped axis labels. Final actual-guide and combined static verification remain
required. Evidence: `docs/status/expansion-verification/panel-fixture-browser.json`.

Phone chart fitting must measure CSS font sizes as well as SVG presentation attributes, and multiline labels as rendered lines. A compact layout that still has text/stroke or text/text collisions is rejected; the original readable canvas remains horizontally scrollable, with a `data-layout-diagnostic` explaining the fallback. Source observations, scale domains and complete text are retained. Category rows reserve space for both names and annotations. Facet remapping clones marks so rejecting a phone layout cannot mutate the authored options. Export cards below 640px intrinsic width stack their readout beneath title/subtitle and their brand beneath the full source note.
