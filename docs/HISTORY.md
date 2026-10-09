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

**2026-08-30 — Launch-readiness executed; first adversarial audit.** The
launch-readiness plan (P1 coverage contract, P2 operational hardening, P3
authoring framework) shipped in full and the plan document was retired —
its durable content lives in the contracts, the skills, and the machinery
itself (see "Retired documents"). A from-scratch adversarial audit then
attacked the gates directly (untraceable figures, coverage omissions, false
records, keyword stuffing, stale as-of manifests, hand-edited prose, stale
stamps, silent series). What the audit changed:

- **As-of governance is a CI gate.** `pipeline/asof.mjs` ran only in local
  `npm run gates`; no workflow invoked it, so a release could have shipped
  stale hand-written "As of" paragraphs with every check green. It now runs
  hard in `ci.yml` and `deploy.yml`, and flags (non-blocking) in
  `update.yml` so the release PR is still opened for the human re-read.
- **Staleness floors cover every dossier.** Dossier-level `stale_after`
  now exists in `data/sources.yml` for all 14 dossiers that had unfloored
  live rows — the floor is a regression floor (minimum coverage; bump it on
  each release per the checklist). Retired rulers keep their frozen floors.
- **Hand-typed display dates purged.** The gdp titleblock carried a
  hand-typed "Vintage 28 Nov 2025" contradicting its current bundle
  (vintage 2026-08-07), and the register carried the same class of fact.
  The label is now derived; live register tables derive via `vintOf()`;
  a registry unit test ("hand-typed display dates never contradict the
  current bundle") fails the build if the pattern returns.
- **Facts-sheet noise is no longer citable.** `verify.mjs` walked the whole
  facts sheet into the allowed-number set, so "inflation climbed 358%"
  (the item ledger's seriesCount) traced cleanly. Structural counts and
  coverage notes are excluded; the economic facts (extremes, spreads,
  medians, contradictions) stay citable.
- **2026-10-09 — design v2 and "guides".** The warm monograph system was
  replaced after five rounds of mocks (`design-mocks/fresh/`): white ground,
  one ultramarine accent with marigold for comparisons, Source Serif 4 and
  Golos Text, sentence case. "Dossiers" became "guides" (`/guides/<slug>/`,
  old URLs redirect). New home page (search over every series via a
  build-time `/search-index.json`, latest figures from
  `src/dossiers/headline.js`) and a guides index. Palette and chart rules were
  migrated mechanically (`scripts/migrations/`); per-guide chart tuning
  continues. Backup: `design-backups/2026-10-09-pre-redesign/`, branch
  `design-v1-backup`.
- **2026-10-09 (later) — guide v2 anatomy across all 13 guides.** Share menus,
  rewritten download cards, "On this page", softer dated notes, *Data and downloads*
  end matter with per-bundle CSV/JSON endpoints, sources as labelled rows, OG cards
  re-rendered on the current rulers (CPI and GDP cards had led with retired bases),
  copy migrated off em dashes and middle dots, prose lint rule 5.
- **2026-10-09 — guide 14, "Where Indians keep their money".** First guide built from the
  owner's local Data Bank (family `databank`, `scripts/lib/databank.mjs`, read-only) on RBI
  DBIE BSR-2 tables 737, 847, 864, 865, 866. Two disclosed breaks: sector classification
  (old to March 2018, new from March 2019) and deposit-size bands (finer from March 2026).
  Verified against RBI's March 2025 release (households 60.2%, women 20.7%). The 3.x tables'
  "broad ownership category" is individuals incl. HUF, not the household sector.
- **2026-10-09 — data refresh, WPI on its new base, the seam registry.** Inventory of every
  remaining data path in `docs/INVENTORY-data-paths.md`. MoSPI now answers HTTP 400 to
  `limit` above 100 on every endpoint: the cap lives once in `scripts/lib/mospi.mjs`, with
  `mospiAll` (pages to `totalPages`, fails unless rows equal `totalRecords`) for the callers
  that read one page. `writeSeries` now keeps a bundle's vintage when its values are
  unchanged (hard rule 5 had been broken by every re-run of a retired base). WPI base
  2022-23 baked (`wpi-2022*`, 953 items, published headline: no weights served); the 2011-12
  base ends Apr 2026 and is frozen. `seams:` in `sources.yml` registers every base of CPI,
  WPI, IIP, GDP, CPI-AL/RL, ASI and ISP; `validate.mjs` enforces it. Found on refresh:
  MoSPI loaded the missing IIP 2011-12 Mar 2025; PLFS indicator 4 dropped the
  `employee_contract` field; the linked CPI bundle carried the back series' period.
  Prose for CPI, IIP, Jobs and WPI regenerated on DeepSeek (`deepseek-flash`). The
  verifier bound every claim in a sentence to the FIRST series named, so true sentences
  naming several series were rejected ("nine divisions sit below the headline; health has
  fallen seven straight months"): claims now bind to any named series and fail only when
  false for all of them; ordinal ranks ("third-highest") no longer read as top-of-sheet
  claims. Known gap, not yet fixed: the verifier does not catch a sentence that
  contradicts the paragraph's own figures ("none moved against the headline" beside a
  falling component); four such claims were removed by hand after reading every draft.
  The prompt called a deep cut's biggest MOVER its "hottest", and the writer turned it into
  the top of the range (IIP: beverages, the biggest riser, named over electrical equipment,
  the highest); the prompt now gives range and movers separately. Hand-written pages named
  periods by hand ("June 2026", "six prints", "release of 12 Jul 2026") and fixed some axis
  ranges, so every release broke them: `src/dossiers/periods.js` now supplies periods at
  build time and the affected axes take their range from the data. All 24 stale "As of"
  notes (CPI, IIP, Jobs, Renewable energy) re-read against the new prints; about fifteen
  claims had become false or were never true (for example "one urban man in two is at
  work" against 70.7%, "the village line runs above the town line in every print", the
  MNRE state note printing a combined share as "each") and were rewritten from the data.
- **2026-10-09 (later) — GDP in full on the 2022-23 base, and the back series to 1950-51.**
  `scripts/lib/products/nas.mjs` now builds every base with one `buildBase()`: the 2011-12 set is
  unchanged in method (values moved only by MoSPI's own revisions: published growth now has
  one decimal, a few levels by ₹1 crore) and the 2022-23 base gains expenditure, industries,
  nominal and annual accounts (`gdp-2022-*`), now to Q1 FY27. `gdp-back.json` bakes the NSO's
  back series (series=Back, 1950-51 to 2011-12 at 2011-12 prices), registered as an agency
  bridge with its own window in `seams`; validate checks it meets the current series in
  2011-12 (₹3 crore apart). New plates: eight engines on the new base, seventy-five years of
  growth on three rulers, saving and investment since 1951-52. Fixed on the way: annual
  rows now require a financial-year label ("2011-12" or "1999-2000"); the GDP prose had been
  fed 2011-12-base siblings beside a 2022-23 print (facts.mjs now refuses a prose input on
  another base of the same product); writeSeries counts published cross-checks as data; on
  phones every small-multiple grid on the site was clipped to its first half by the
  700px plate minimum (exempted in atlas.css).
- **2026-10-09 (evening) — The launch build is planned.** The owner set the launch bar: every
  major family (jobs, national accounts and states, prices, industry, services, trade, the
  external account with portfolio flows and reserves, money and credit, rates) in a guide, and
  comprehensiveness across every indicator and granularity the source publishes. The three
  earlier sessions stood down, the day's work was committed as one checkpoint (`77384bd`, on
  the new branch `launch-build`, gates green), and `docs/PLAN-launch.md` was written with
  `docs/STATUS-launch.md`. Three decisions from that plan: (1) the census proves a guide saw
  everything we baked but nothing proved we baked everything the source publishes, so a
  generated coverage ledger per family becomes a gate; (2) commodity and partner trade comes
  from the Ministry of Commerce's TradeStat, not UN Comtrade (Comtrade lags by months;
  TradeStat is current to the latest release and a plain form POST returns a month at HS
  8-digit in under two seconds: `docs/reference/tradestat.md`); (3) India Data Hub, a paid
  service, is used only as a cross-check read from the Data Bank, and its values never enter
  this repo or the site.

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
- `docs/PLAN-launch-readiness.md` (retired 2026-08-30) → the launch-readiness
  plan: its P1 coverage contract, P2 operational hardening and P3 authoring
  framework all shipped, so the plan had become a historical log. The
  mechanics it introduced are documented where they live now: the census
  and coverage ledger in `skills/analyze-series.md`, the slot floors in
  `pipeline/slots.yml` + `docs/CONTRACT-dossier-structure.md` §4, the as-of
  governance in `pipeline/asof.mjs` + `docs/RELEASE-CHECKLIST.md` §1b, the
  display-stamp derivation in `src/dossiers/display.js`, and the
  disclosure-shape rules in `docs/CONTRACT-series.md`. What remains
  deliberately undone is listed under "Open debt" above.

## Open debt (known, deliberate, not scheduled)

- **2026-10-09: pipeline/verify.mjs traced only figures followed by %, per cent, pt or
  points.** Amounts (₹, US$ with lakh/crore/billion), °C, mm, index levels and ratios in prose
  were never checked against the facts sheet, so hard rule 3 held only for percentages.
  Found by atlas-external during the launch build; the fix is scheduled (atlas-framework,
  round 2), after which every prose file is re-verified. **Closed 2026-10-09** (round 2,
  `pipeline/lib/figures.mjs`): every figure is extracted with its scale word and traced
  unit-aware; 435 figures across 34 prose files trace, one real miss found (a ratio the
  writer computed itself, consumption).
- **What tracing cannot prove: that a figure is attached to the right period or series.**
  A coordinator mutation test swapped this quarter's remittances (US$41 bn) for last
  quarter's (US$41.6 bn): it traces, because the figure is in the sheet. Number tracing
  proves existence, not binding; the hand read against the data stays in the definition
  of done for that reason.

- The verify.mjs negative guard judges multi-series sentences
  conservatively: a record claim is rejected only when false for EVERY
  series named, so a co-occurring generic word ("inflation" resolves to the
  headline) can silence it. Tightening needs referent resolution, not just
  keyword sets.
- Client modules still carry some inline number formatting; new code must
  use `fmt.*` from `src/charts/format.js`. Full migration is mechanical,
  low-value churn.
- The staleness floors are regression floors, not calendar checks: a site
  frozen forever at its last print passes. The checklist's floor-bump habit
  is what makes them bite; a release-calendar check (registry cadence vs
  axis end) would make it mechanical.
- The four hand-revised print-slot prose files (cpi/wpi/jobs) should be
  regenerated with `npm run prose` once the LLM account has balance.

## Invariants that have survived every phase

1. Data integrity over prettiness (no smoothing, domains admit negatives).
2. Every number traceable to a source, every prose number traceable to a
   facts sheet.
3. One accent colour; derived series dashed; charts on paper, not in boxes.
4. Conflicting estimates shown as separate series, never reconciled.
5. The system may say "we do not know."
