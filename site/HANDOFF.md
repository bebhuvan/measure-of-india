# Handoff — India Atlas design elevation

Paste everything below the rule into the new chat.

---

## Context

You are taking over design work on **India Atlas**, a static site that publishes long-form "dossiers" on Indian economic statistics — one page per concept (CPI, GDP…) combining charts, evergreen explanation, dated commentary on the latest print, and "how to misread this" guidance. Audience: curious non-specialists. The design bar is the highest tier of data journalism (FT, NYT Upshot, Reuters Graphics) crossed with a printed monograph: pure minimal elegance, white backgrounds, abundant white space, hairline rules, charts as protagonists.

The codebase is at the project root. **The current design system is the one to evolve — do not replace it.** The user has chosen its aesthetic explicitly.

## What exists

```
site/
  BUILD.md               ← the full build spec. READ THIS FIRST. It is normative.
  index.html             ← homepage: hero, latest-prints strip, dossier directory
  register.html          ← cross-dossier series ledger with sparklines
  method.html            ← standing rules, sources, corrections policy
  about.html             ← mission/audience/colophon
  dossiers/
    cpi.html             ← Dossier 01, the REFERENCE IMPLEMENTATION. Most polished page.
    gdp.html             ← Dossier 02, quarterly national accounts. Proves the template generalizes.
  components/index.html  ← living component gallery / styleguide
design-mocks/
  h-monograph.html       ← the design source that was elevated into site/dossiers/cpi.html
  h-monograph.backup.html← untouched original, for reference only
mocks/                   ← four earlier exploratory directions (monograph/gazette/abstract/atlas-plate)
```

## The design system (as built — evolve it, don't discard it)

- **Fonts:** Archivo (display/section heads/brand, weight ~660–720, tight −0.02/−0.03em tracking), Newsreader (body prose at weight 460, 1.18rem/1.82; and ALL large data numerals at weight 300, `opsz 72`, tabular-nums), IBM Plex Mono (axis labels, kickers, metadata, table figures, chart text). Bodoni Moda was tried for numerals and removed — hairline strokes illegible on non-retina screens.
- **Color:** pure white bg; ink #1B1A17; one accent, vermilion #BE3E26 (primary series, key numbers, kickers, hovers); series greys #5B564B / #A8A293 / #C6C0B0 (dark→light by importance; derived series = lightest grey + dashed); reference-band fill #F8F6F1; hairline rules #E6E2D6. No gradients, shadows, cards, or second hues.
- **Layout:** 880px prose column; `.break` breakouts at min(1280px, 100vw−48px) for charts/register/hero; charts in corner-tick `.frame`s; sections at 112px vertical rhythm.
- **Charts (Observable Plot 0.6, ESM CDN):** linear curves ONLY (smoothing curves banned — they falsify data); round linejoins/caps for visual softness; hairline gridlines via explicit `Plot.gridY` (#EAE5D7); RBI tolerance band + dashed target rule on CPI; strong zero rule + 6% trend rule on GDP; annotated peaks with white-halo text; algorithmically dodged direct end-labels; last-13-months (or 5 quarters) emphasis stroke; crosshair tooltip; legend hover-isolation; working SVG/PNG/CSV downloads below each chart; real aria-labels stating ending values.
- **Data:** seeded deterministic generators, anchors shaped like real Indian history; headline CPI computed from components via real weights; EVERY displayed number is JS-driven from the same dataset as the charts.
- All sections of the dossier anatomy (current reading box, register, basket bar, plates, explain pairs, misread list, provenance) are specified in `site/BUILD.md` §7 — read it before touching anything.

## Your task

**Take the existing design and push it on every front until it is truly beautiful — the kind of page a design jury photographs.** The user feels things are still "underpowered and underpresent." The bones are right; your job is to elevate every surface until the page feels inevitable. Do not redesign — deepen. The goal is not a different site; it is this site, perfected. Think of the gap between a good draft and a published FT graphic page, or between a decent book and a typographer's monograph: same structure, transformed execution.

Push on ALL of these fronts, and anything else your eye catches:

1. **Charts first — they are the protagonists.** Annotation placement and leader lines; label density vs. air; the exact hierarchy of band / target / zero / trend furniture; tick selection and rhythm; the stroke-weight ratio between headline (2.75px) and supporting lines (1.5px); end-label dodge offsets; dot sizes and halos; crosshair and tooltip polish; fluid widths via container measurement + ResizeObserver (keep the crosshair `geo` contract in sync — BUILD.md §8.1). A chart should be legible at a glance and rewarding at a stare. If a peak label collides with anything, fix it. If a gridline can be quieter without disappearing, quiet it.
2. **Typography — make it sing.** The h1/lede/meta rhythm; section-head presence; kicker tracking; the reading measure; hanging punctuation; numeral treatment at every size; the exact interplay of Archivo display, Newsreader text, Plex Mono data. The three-font system stays, but its calibration is yours to perfect. Judge at real sizes on a real screen, not in principle.
3. **Harmony, proportion, placement.** The 880px prose column against 1280px breakouts; the air above and below plates; whether the current-reading box feels native to the monograph voice; register density; the quietness of the provenance footer; the vertical rhythm section to section. Every gap should feel measured, not defaulted.
4. **Every page, not just the dossiers.** The homepage's first screen, the register's ledger, the method and about pages — bring them all to the same finish as the best plate.
5. **Micro-interactions, restrained.** Hover states, legend feedback, tooltip behavior — refinement, never decoration. A little bit of life, never noise.

Work iteratively: change, look, judge harshly, change again. Kill anything that reads as a typical landing page, a dashboard, or a template. When a choice is taste, choose the quieter option — then make sure the result is anything but timid.

## Hard constraints (violating these is failing the task)

- Static-first: plain HTML, inline styles, ESM CDN Plot. No frameworks, no build step.
- Data integrity: no curve smoothing; domains must admit all real values incl. negatives; every displayed number JS-driven from the dataset; mock data disclosed in footers.
- One accent color; grey ramp dark→light; derived series dashed and labelled everywhere.
- White backgrounds, hairline rules, no gradients/shadows/cards/gimmicks.
- `tickFormat` must return strings (years print as "2016", never "2,016").
- Plots must fit inside their frame's content box (SVG width ≤ container minus padding).
- After every edit: syntax-check the module script and scan for missing element IDs (pattern in BUILD.md §12).

## How to work

- Read `site/BUILD.md` fully first, then study `site/dossiers/cpi.html` as the reference, then `site/dossiers/gdp.html`.
- `design-mocks/h-monograph.backup.html` is the pre-elevation original — useful to see what was already fixed (do not regress these: Bodoni numerals, catmull-rom, clamped domains, top-mounted downloads, overflowing SVGs).
- `mocks/` contains four alternative temperaments from an earlier exploration — mine them for isolated ideas (e.g. the abstract's document-control rigor, the atlas-plate's marginalia) but do not import their aesthetics wholesale.
- Work directly on the `site/` files. Keep each page self-contained. Bump version lines when you change a page.
- Show, don't just tell: make the changes, then summarize what changed and why in a few lines per page.
