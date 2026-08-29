# DESIGN — the India Atlas design system

The normative reference for every visual decision on the site. Consolidated
from the design-phase build spec (`site/BUILD.md`, retired) and updated to the
Astro reality. The machine-checkable parts are enforced by `scripts/qc.mjs`
and `scripts/lint-charts.mjs`; the rest is review discipline.

The temperament: highest-tier data journalism (FT, NYT Upshot, Reuters
Graphics) crossed with a printed monograph. White backgrounds, hairline rules,
abundant air, charts as protagonists. **Elevate, never redesign** — the gap we
are always closing is between a good draft and a typographer's monograph:
same structure, transformed execution.

## 1. Tokens

Single source: `src/styles/atlas.css` `:root`. Never restyle per page.

```css
--bg:#FFFFFF;   --ink:#1B1A17;  --ink-soft:#4A463F;
--muted:#8A857A; --faint:#B4AFA2; --rule:#E6E2D6;
--accent:#BE3E26;                        /* vermilion: THE accent */
--grey1:#5B564B; --grey2:#A8A293; --grey3:#C6C0B0; --grey4:#8A857A;
--band:#F8F6F1;                          /* reference-band fill */
```

Rules:

- **One accent.** Vermilion is reserved for the primary series, key numbers,
  kickers, and hover states. Never a second hue on a page.
- Supporting series use the grey ramp dark→light in order of importance. A
  **derived** series is always the lightest grey **and dashed**.
- No gradients, no shadows, no rounded cards, no colour blocks (the corner-tick
  `.frame` and the band fill are the only permitted fills).
- Rules are 1px `--ink` (strong) or `--rule` (quiet). Double rules only in the
  provenance colophon.
- Vertical rhythm: sections `padding:112px 0 0`; prose measure `max-width:64ch`.

## 2. Typography

Three self-hosted variable faces (`/fonts/*.woff2`, `font-display:swap`,
display + text faces preloaded in `Base.astro`):

| Face | Role |
|---|---|
| **Archivo** (variable width/weight) | display headlines (720, −0.034em), section heads (660–680), brand |
| **Newsreader** (variable optical size) | body prose (460, 1.18rem/1.82); **all large data numerals** at weight 300, `opsz 72`, tabular-nums |
| **IBM Plex Mono** | axis labels, kickers, metadata, table figures, chart text |

Mono metadata has a legibility floor: nothing below .66rem (10.5px); most
metadata sits at .7–.72rem. Quiet is a virtue, illegible is not — the floor
was set after the register's .55–.62rem labels failed the eye test.

Never use a hairline-contrast display face (e.g. Bodoni) for data numerals —
thin strokes vanish on non-retina screens. (Tried, rejected, do not retry.)

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
- Chart text 13–14.5px Plex Mono `#5C574C`; every SVG text carries a white
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

## 8. Exploration archive

`design-mocks/` holds the eight explored directions (A–H; the site is "H —
The Monograph, elevated"), the earlier `early-explorations/` (monograph,
gazette, abstract, atlas-plate) and `matrix-explorations/` (schedule, plate,
shirorekha, baseline, matrix, plates). Mine them for isolated ideas; do not
import their aesthetics wholesale. `site/` holds the design-phase reference
implementation in plain HTML — the visual specification the Astro pages were
matched against.
