# Status: design pass (`lb/design`)

Brief: `docs/briefs/design.md`. Critique: `docs/design/critique.md`. System: `docs/DESIGN.md` §0.
Screenshots: `docs/design/before/` and `docs/design/after/` (same pages, 1440 and 390).

## Done

1. **Looked first.** Built the site as it stood, 49 screenshots, wrote the critique: three left
   edges, sub-AA greys, no type scale, v1 leftovers (№, §, tracked capitals), a narrow memo of a
   front page, a title block with holes in it, a chart card with no structure, a Share menu that
   opened over its own chart.
2. **Tokens and type.** `--muted` lifted to #6B7180 (AA); chart text and hairline grids lifted by
   CSS (client code untouched) and inlined into downloads; one type scale and one spacing scale
   (DESIGN §0.2, §0.1).
3. **The ledger margin** (the owner asked mid-pass for a leap, not a rearrangement). Every page is
   a sheet: a 220 px margin that carries the figures and furniture (section numerals, chart
   readouts, the guide's key figures, actions, margin notes, numbered misreadings) and a main
   field for the account; charts and tables span both. Done entirely in CSS on the existing
   markup (`display:contents` on `.sec-head` and `.plate-head`), so no guide page changed and the
   gates' ids and classes stand. Phone: the margin folds into one column.
4. **Chart card.** Readout in the margin (sized by length: figure, long figure, words), finding,
   subtitle, key on the main line, plot across the sheet, footer (actions in the margin, source in
   the main field), notes. Square "As of" panel. Faint filled areas under lines removed (cpi, gdp,
   wpi, manufacturing).
5. **Share → actions.** The menu is gone: Download image, SVG, data; Copy link; Source; Whole file
   where a plate links its bundle. Live-region status that never moves the row.
6. **Download card.** Readout on the right, key drawn as lines for line series, the page's
   colours and label halos inlined, footer as one row.
7. **Front page.** Promise and search; the latest figures as four plates with the figure in the
   margin and real charts drawn at the width they are shown (desktop and phone drawings); every
   guide as a ledger; states and union territories as a set list; Learn notes.
8. **Other pages.** Guides index, profiles, register, method, about, Learn index and explainers,
   every-cut long-tail pages and the 404 all on the margin. 404 rebuilt.
9. **Controls and tables.** Every-cut find and filters boxed (DESIGN §0.7); "№" removed from
   ranked tables and the Learn index; rank tables tighter; search results without capitals or
   coloured text.
10. **OG cards.** On the margin: brand and the headline figure in the margin, kicker, title and
    chart in the main field. They now render in Source Serif: the old cards were silently falling
    back to another serif because sharp's bundled fontconfig never saw the installed faces. Fixed
    with a private fontconfig and three static instances of Source Serif 4 (`scripts/og-fonts/`,
    cut with fontTools from the self-hosted face; 52 KB each). Also fixed: the external card's
    footnote said "$1 bn" for reserves of $748 bn (double scaling).
11. **AA sweep in guide code.** Inline 8 to 9 px labels in gdp, iip, factories and aishe panels
    raised to 12 px; light-grey inline text to `--muted`; one figure drawn in ultramarine text
    (gdp) set in ink.

12. **Categorical plates on a phone** (coordinator's request): names above each row, marks
    across the full width, no sideways scroll, for every categorical plate at once
    (`src/charts/plot.js`, DESIGN §0.4a). At 390 px: 177 plates redrawn, 263 time-series zones
    still scroll from the latest end. Still scrolling, by design: 7 continuous-x
    lines/scatters (fractile ladder, yield curve, scatters), 5 state × measure matrices
    (consumption spend-rural/urban, factories statemix, farms states, states industries) and 3
    hand-assembled multi-panel SVGs (climate proj-heat, farms crops, farms statelong). Labels on the narrow drawings are then
    settled (margins widened for bleeds, clashing labels moved to the nearest clear spot); the
    first 390 lint run found 204 issues on the narrow drawings, the settled build has none.
    Before and after: `docs/design/phone-categorical/`. Chart lint now also runs at 390 in `gates`, `qc`
    and `lint:charts`.

## Checks

- Gates green at `f658efc` (the margin) and again on the final commit: validate, coverage,
  asof and QC all passed; chart lint clean across 856 SVGs on 87 pages.
- `npm test` 70/70; `npm run prose:dry` clean.

## Decisions

- Prices lead the front page always: only the CPI bundle carries a release date, so "newest
  release leads" could not be computed honestly.
- The front page's vintage labels stay in the DOM for qc but are not shown: twenty "Vintage
  9 Oct 2026" lines were noise; each guide carries its own.
- Title-block sparklines hidden (a 100 px line said nothing a figure and its change did not).
- No embed option: it would need an embed page per chart; out of scope for a design pass.
- Data and prose untouched. Copy changed only where it was display furniture ("№ 12 of 358" to
  "12 of 358"; "−1.4–−0.6" to "−1.4 to −0.6" in the CPI grid).

## For the coordinator

- `scripts/og.mjs` now needs `scripts/og-fonts/*.ttf` (committed) and writes a private
  fontconfig under the OS temp dir; CI needs nothing new.
- All `public/og/*.png` and `public/og/states/*.png` regenerated (owned by this pass).
- Shared files touched beyond CSS: `src/dossiers/guide.client.js` (actions, readout fit,
  contents), `src/charts/plumbing.js` (export only: `serializeSVG` inlines paint,
  `composeCardSVG` v3), `src/charts/static.js` (`briefSVG` rewritten; only the front page uses
  it), `src/pages/index.astro`, `src/pages/guides/index.astro`, `src/pages/404.astro`.
