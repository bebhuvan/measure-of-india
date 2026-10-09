# DESIGN — the India Atlas design system (v2, 2026-10)

The normative reference for every visual decision on the site. v2 replaced the
warm "monograph" system (vermilion, Archivo/Newsreader/Plex Mono, tracked
capitals) in October 2026; v1 is archived in
`design-backups/2026-10-09-pre-redesign/` and on the git branch
`design-v1-backup`. The chart language was developed in `design-mocks/fresh/site/`
(kit v1 to v3; `compare.html` shows the first and current kits side by side).
Machine-checkable parts are enforced by `scripts/qc.mjs` and
`scripts/lint-charts.mjs`; the rest is review discipline.

The temperament: NYT, Reuters and Bloomberg graphics, set as a reference work.
White ground, one accent, quiet greys, sentence case, numbers that carry the
weight. **Refine, don't decorate**: every change removes noise or adds meaning.

## 1. Tokens

Single source: `src/styles/atlas.css` `:root`. Never restyle per page.

```css
--bg:#FFFFFF;   --ink:#161A22;   --ink-soft:#4A5160;
--muted:#878D99; --faint:#B5BAC4; --rule:#ECEEF2; --rule-2:#DFE2E8;
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
  stack; full plates scroll horizontally rather than shrink past legibility.

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

## 8. Exploration archive

`design-mocks/fresh/` holds the 2026-10 explorations (a to e) and the v2 site
mock with its chart kit (`site/`). `design-mocks/` also holds the eight earlier directions (A–H; the site is "H —
The Monograph, elevated"), the earlier `early-explorations/` (monograph,
gazette, abstract, atlas-plate) and `matrix-explorations/` (schedule, plate,
shirorekha, baseline, matrix, plates). Mine them for isolated ideas; do not
import their aesthetics wholesale. `site/` holds the design-phase reference
implementation in plain HTML — the visual specification the Astro pages were
matched against.
