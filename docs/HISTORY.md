# HISTORY — how the Atlas got here

For posterity: the lineage of the project, so future contributors know what
was tried, what was rejected, and why things look the way they do.

## Timeline

**2026-08-02 — The brief.** The founding document (now `docs/VISION.md`):
a public interpretation layer for Indian public data; the dossier as the
product object; non-specialist reader as the north star.

**2026-08-02/03 — First design exploration** (`design-mocks/matrix-explorations/`,
formerly `Claude/mocks/`). Seven static-HTML directions: survey-schedule
vernacular, cartographic plate, dark-indigo shirorekha, one-size baseline
grid, the 12×12 month matrix. The matrix direction ("choose chart forms that
fit the data") was the keeper; the plates elaboration of it was rejected.
This phase produced the rejected-directions list now in `docs/DESIGN.md` §7 —
the most valuable artifact of the exploration.

**2026-08-03 — Second exploration** (`design-mocks/early-explorations/` and
the A–H set). Four temperaments, then eight. Direction A ("The Monograph":
scholarly paper, warm serif, one vermilion accent, numbered plates) won;
"E — The Synthesis" and "F — The Register" were explored and folded back;
"**H — The Monograph, elevated**" became the design source of the site.

**2026-08-03/04 — The reference implementation** (`site/`). Plain HTML, no
build step, Observable Plot from CDN, seeded mock data. `site/dossiers/cpi.html`
became THE reference: the design system locked (three fonts, one accent, grey
ramp, corner-tick frames, plate anatomy, download cards). Everything the
production site does visually was proven here first.

**2026-08 — Re-platform to Astro.** The reference was ported to Astro 5 with
a real data pipeline: `sources.yml` + adapters → raw dumps → canonical
bundles → validation → build-time render. The LLM prose pipeline (facts
sheet → generate → verify → lint → contract → critic → human PR) was built
in the same wave. Launch baseline: 8 dossiers, 1,336 series.

**2026-08 mid — Coverage waves.** Wave 1: RBI complete, NAS deep, PLFS deep,
ASI/ASUSE deep. Wave 2: CPI to the item, WPI to the item, IIP back to 1994.
Then HCES full coverage, AISHE, gender, MNRE, NFHS — 15 source products,
~3,800 series, 12 dossiers.

**2026-08 late — The expansion audit and rebuild.** A full architectural
audit found the contracts sound and the implementation single-host by
construction (one hardcoded API client, dossier metadata duplicated across
~8 files, Indian fiscal-calendar assumptions baked into the prose machinery).
The rebuild introduces the multi-source model (`docs/ARCHITECTURE.md` §3):
source families, explicit geography, per-dossier calendars, and a single
dossier registry — preparing the site for World Bank (WDI, Data360) and
Our World in Data dossier families.

## Retired mechanisms

- **`--mock` fetch mode (retired 2026-08, plan P2.8).** `scripts/lib/mock.mjs`
  plus the hand-assembled mock branch in `scripts/fetch.mjs` could bake 8 of
  16 products with hand-typed metadata (fixed release dates, `source:
  "MOCK generator"`) that had already diverged from the real bundles — and
  `npm run data:mock` happily overwrote the canonical `data/series/` with it.
  Nothing (CI, tests, build) consumed mock bakes; the live path is the only
  path, and validate has no mock exemptions anymore. Decision: dropped, not
  regenerated from adapters — offline work builds from the committed
  `data/series/` (the bake is git-tracked), so mocks solved a problem the
  repo's own design had already retired.

- **Bundle-level `meta.gaps` (retired 2026-08, plan P2.5).** A union of
  missing dates across all of a bundle's series could not say which series
  actually missed which date — `wpi-items.json` carried 119 of 124 axis dates
  as "gaps" while most items were complete. Disclosure now lives per series
  (`series.gaps`, `series.gapsNote`), where it means something; `writeSeries`
  migrates the legacy shape at the write boundary so every producer complies
  by construction, and validate fails any bundle that bypasses the writer.

## Retired documents

- `Idea.md` → `docs/VISION.md`
- `esankhyiki-api.md` → `docs/reference/esankhyiki-api.md`
- `site/BUILD.md` → absorbed into `docs/DESIGN.md` (its stack sections —
  "plain HTML, no build step" — describe the design phase, not the site)
- `site/HANDOFF.md`, `site/HANDOFF-BUILD.md`, `Claude/HANDOFF.md`,
  `Claude/Idea (Copy).md` → session handoff prompts, superseded; their
  durable content lives in `docs/DESIGN.md` (locked decisions, rejected
  directions) and this file.

## Invariants that have survived every phase

1. Data integrity over prettiness (no smoothing, domains admit negatives).
2. Every number traceable to a source, every prose number traceable to a
   facts sheet.
3. One accent colour; derived series dashed; charts on paper, not in boxes.
4. Conflicting estimates shown as separate series, never reconciled.
5. The system may say "we do not know."
