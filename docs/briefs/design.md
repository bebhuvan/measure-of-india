# Brief: the design pass (`design`, port 4460)

The data build is finished and merged: 30 guides, 36 state profiles, about 1,150 pages, every
gate green. Now the owner wants the design taken as far as it can go. In the owner's words:

> An absolutely beautiful, elegant, minimalistic, opinionated, creative design, with all the
> focus on the charts and clean typography, refined spacing, refined layouts, just pure beauty
> and elegance. No gimmicks, no clichés whatsoever. Improve the hell out of this design and
> make it pure beauty and pure brilliance across the board.

What bothers the owner most, in their order:
1. **The landing page.** It has to be better: the first page of the canonical place Indians go
   to understand their economy. It should make someone want to stay and read.
2. **The charts.** More refinement and more presence: the whole chart layout, the text around
   and inside a chart (titles, subtitles, labels, annotations, sources, legends), the way text
   is set on and beside the plot.
3. **The share option on charts** is clumsy and unrefined. And there are "a lot of such places
   everywhere": every control, menu, table, tab, filter, footer, download row and note on the
   site should feel as considered as the charts.

This is a design pass across the whole site, not a reskin of one page.

## Read first

1. `docs/briefs/README.md` (the session contract: worktrees, build slots, disk, commits).
2. `docs/DESIGN.md` in full: the tokens, type, chart rules v3, guide anatomy, and above all
   **§7, the rejected directions**. They were built and thrown away; never retry them. The owner
   rejected, in October 2026: template-y data-journalism layouts (white page, a row of four big
   numbers, sparklines, stock line/bar/lollipop charts, Tailwind-ish palettes); big serif
   sentences ("way too clumsy"); hypsometric terrain tints and filled areas ("cartoonish");
   beige; dark mode. The lead that survived is `design-mocks/fresh/e-ledger.html` and the
   built `design-mocks/fresh/site/` (white ground, ultramarine #2E4BD8 for the series that
   matters, marigold #C47A16 as the only second colour, cool greys; Source Serif 4 + Golos
   Text; every chart a self-contained card: the finding as title, a subtitle, a source; export
   to PNG/SVG, CSV, link, embed). DESIGN.md says "elevate, never redesign". The owner has now
   asked for elevation without timidity: you may change anything visual, including tokens,
   type scale, spacing, layout and chart furniture, as long as it builds on that lineage
   rather than swapping it for a new template.
3. The owner's taste, from their global notes: editorial, refined, typography-first, at the level
   of the FT, the NYT, Bloomberg Businessweek and The Pudding. Warm restraint. No generic AI
   aesthetics, no gratuitous micro-animations, no cartoonish heavy marks. Every chart labelled,
   nothing overlapping.
4. Load the `frontend-design` and `dataviz` skills before you design anything.
5. Read `src/charts/plumbing.js` (its header first), `src/styles/atlas.css` and `pages.css`,
   `src/dossiers/guide.client.js` (Share menus, "On this page"), `src/pages/index.astro`,
   `src/charts/static.js` (the landing briefing), `src/components/EveryCut*.astro`,
   `src/components/GuideData.astro`, `src/pages/states/`, `scripts/og.mjs`.

## How to work

1. **Look before you touch.** Build once (in a slot), then screenshot at 1440 and 390 px: the
   home page, the guides index, three guides of different kinds (cpi, external, states), one
   state profile, a share menu open, a download card, an every-cut table, Data and downloads,
   search with results, a learn page, the 404. Write a short, honest critique in
   `docs/design/critique.md`: what is weak, why, and what you will do. Be specific.
2. **Decide the system, then apply it.** Write the refinements into `docs/DESIGN.md` (it stays
   the normative record) before rolling them out: type scale and rhythm, spacing scale, the
   chart card (title, subtitle, plot, annotation, source, actions), the share and export
   control, tables, controls, the landing page's structure. One coherent system, applied
   everywhere, beats forty local fixes.
3. **The landing page:** design it from what the site is: 30 guides and 36 states, the latest
   official prints, search, and a reason to read on. Show the owner before you finish it:
   send two or three screenshots of your direction (1440 and 390) to the owner with
   SendUserFile and a two-line note, then carry on while waiting; adjust if they reply.
4. **Charts:** refine through `src/charts/plumbing.js` and the shared chart helpers first, so
   every guide improves at once; then pass over each guide's client file for chart-specific
   text, label placement and annotation. Keep Observable Plot.
5. **Commit in stages** on `lb/design` (tokens and type; chart card; share and controls;
   landing; tables and end matter; profiles; OG cards), each with the site building and the
   gates green, so any stage can be reverted alone.

## Guardrails (do not trade these for looks)

- **Truth and data are untouched.** No change to bundles, adapters, facts, prose or numbers. If
  a design wants a number the page doesn't have, tell the coordinator.
- **The gates stay green**: `npx astro build`, `npm run gates` (validate, coverage, asof, qc
  with its rendered-figure checks, chart lint for collisions, overlaps, bleeds and clips), `npm
  test`, `prose:dry`. qc and chart lint depend on ids and classes (`.plotzone`, `.frame`,
  `.sh-date`, figure ids, `data-x` on plot zones): keep them, or change the checks with them
  in the same commit and say so.
- Static site: no framework runtime, no client-side data fetching beyond the existing search
  shards, no new heavy dependencies, the HTML budgets in `docs/CONTRACT-render.md`. Fonts stay
  self-hosted.
- Accessible: text contrast at least WCAG AA, visible focus, every control keyboard-reachable,
  `prefers-reduced-motion` respected, charts with text alternatives (titles and the data
  downloads).
- Phone first-class: 390 px is not a squeezed desktop.
- Writing on the page stays plain Indian English; no em dashes or middot strings in reader
  text (DESIGN §2); no AI tells.

## Finishing

Before and after screenshots of the pages in step 1, in `docs/design/` (small PNGs, or link
them from the status file). Build and gates in a slot, delete ./dist after. `docs/status/design.md`
with every decision and why. Message the coordinator `design: done`, or `design: stage <n>
ready` at each stage if you want a merge along the way.
