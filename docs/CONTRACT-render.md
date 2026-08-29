# CONTRACT — rendering (pages, charts, client JS)

The site is build-time rendered: data is baked into JS modules at build,
charts are drawn once on load, nothing re-renders. This document is the
budget of what a page may do. `scripts/qc.mjs` enforces the mechanical
parts by executing every page's JS in jsdom.

## Number formatting

Every display format is defined once, in `src/charts/format.js` (re-exported
from `plumbing.js` as `fmt`). Clients render through it; `scripts/qc.mjs`
renders its expected strings through the same module — a formatter change
updates both sides, and hand-typed rendering in qc (the old shape) can no
longer false-fail or drift. Titleblock stamps and vintage labels are derived
the same way, from bundle meta, by `src/dossiers/display.js`; qc compares
every rendered page against the derivation, so a hand-typed stamp fails the
build.

## Pages and plates

0. **Dossier metadata lives in `src/dossiers/registry.js`** — title, kicker,
   crumb, blurb, vintage labels, bundles, current bundle, spark spec. Pages,
   homepage, register, RSS, 404, OG cards and both gates derive from it;
   never hardcode a dossier fact in a page.
1. **One dossier page = one client module** (`src/dossiers/<slug>.client.js`),
   imported by its `.astro` page. No globals, no cross-module state.
2. **Every numeric slot is an element with an id** that the module fills.
   Unfilled placeholders (`–`) fail QC.
3. **Every plate that shows data offers SVG / PNG / CSV download** via
   `wireTools()`. A download is a published artifact: title, source, brand
   are composed in by `composeCardSVG()` — never ship a bare plot.
4. **Charts are Observable Plot, drawn once at module load.** No re-render
   loops, no resize listeners, no IntersectionObserver (yet) — render cost is
   bounded by plate count per page.

## Robustness floor (plumbing.js is normative)

- **Nulls render as gaps/`—`, never as 0 and never as NaN.** The default
  crosshair formatter, `peakOf`/`troughOf`/`dodgeEndLabels`/`spark` all skip
  unpublished points. Do not re-introduce index-based assumptions.
- **CSV downloads join by date key** (union of dates, sorted). Series with
  different start dates on one plate must never be index-joined.
- **No hardcoded series lengths, no magic indices** (`data[13]`) without a
  neighbouring assertion that fails loudly when the shape changes.
- **A missing element id or series key must not blank the page.** Guard with
  `?.`/filter, or let QC catch it — a plate that cannot render should say so,
  not eat the plates below it.
- **Ticks are strings.** `tickFormat` must return formatted strings (en-IN
  grouping, `%`, `₹`); QC greps for violations.
- **No smoothing.** No `curve*`, catmull, monotone, basis. Lines are straight
  between published points. QC greps for this.

## Accessibility floor

- Every plate gets `role="img"` + `aria-label` + `<title>` via `a11y()`.
- Sparklines and decorative marks are `aria-hidden`.
- Downloads and legend chips are real `<button>`s.
- Colour is never the only channel: label the line, not just the key.

## Budgets

- **Page JS (gzipped): ≤ 150 KB** above the shared Plot/plumbing chunk.
  Below-the-fold ledgers that blow the budget move to lazily fetched JSON —
  not more inlining.
- **No runtime data fetching of published series.** Data rides in the bundle
  the page was built from; the deployed site performs zero data requests
  beyond static assets.
- Charts render at their intrinsic width; containers may scale via CSS
  (`width:100%` on the svg) but plot geometry is computed once.

## When you touch plumbing

`src/charts/plumbing.js` changes affect every page. After any change:
`npx astro build && npm run qc` — both must pass before the change is real.
