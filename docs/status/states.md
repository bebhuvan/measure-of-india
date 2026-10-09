# states: state economies

Session `atlas-states`, branch `lb/states`, port 4405. Brief: `docs/briefs/states.md`.
Status: **done**, 2026-10-09 (second pass after the coordinator's review). All gates green.

## What shipped
- **Guide** `/guides/states/` ("One country, many economies"): title block, current reading
  (generated prose), 8 plates, a sortable every-state table, the same state in other guides,
  method, 5 misreadings, all 182 Handbook tables listed by section, data, provenance.
- Plates: income per person by state; is the gap closing (richest ÷ poorest, fixed panel);
  size (GSDP); average real growth 2011-12 to 2024-25; convergence scatter (correlation
  −0.31); farm / industry / services shares; 11-industry heat table; state debt and deficit.
- **Headline:** the richest state's income per person is 9.3 times the poorest's in 2024-25
  (Sikkim ₹6,46,183, Bihar ₹69,211), down from 11.9 in 2011-12; in rupees the distance grew.
- **Adapter** `scripts/lib/products/states.mjs` (MoSPI NAS regional 23 to 34 + every RBI
  Handbook table from the Data Bank), catalogue generator, raw dumps
  `data/raw/states-nas.json`, `data/raw/states-hbs.json`.
- **Bundles:** 21 MoSPI and derived (`states-*`), 208 Handbook (`states-hbs-t*`).
- **Coverage** `data/coverage/states.yml`: 4,214 items, 971 shown, 3,034 baked, 110 excluded,
  99 blocked.
- validate block, seams (2004-05 / 2011-12), registry, headline, register rows, OG card,
  qc PAGES, 8 as-of entries, prose slots + corpus + series keywords.
- `docs/reference/nas-regional.md`: every source quirk below, in detail.

## Checks
- `npx astro build`, `npm run gates`, `npm test` (18/18), `npm run prose:dry`: green.
- Hand checks: RBI Handbook Table 19 (rbi.org.in) Bihar 2024-25 ₹69,321 = our t019; MoSPI
  GSDP AP 2025-26 ₹17,62,357 crore = our bundle. Handbook = MoSPI to 2020-21 (validate).
- Prose generated (DeepSeek), read against the data line by line; three rounds to remove a
  meta sentence, "earned", a median mix-up, a cross-unit "weakest reading" and a
  non-sequitur about the FY14 low. Final text checks out.
- Looked at 1440 and 390 px; read every chart; downloaded the gap PNG and the income CSV.

## Decisions (for HISTORY)
- **J&K is two series**, split at 2019-20 (RBI footnote: to 2018-19 it includes Ladakh).
- **Undivided Andhra Pradesh** in older Handbook tables is its own series.
- **GSDP for Assam, Haryana, Nagaland, Ladakh** (absent from MoSPI's GSDP indicator) is built
  from MoSPI's own GSVA + taxes − subsidies, flagged `derived`; the identity holds for all
  30 published states to under ₹1 crore.
- **Cross-state plates compare one year**, the latest year three-quarters of states report
  (2024-25); 2025-26 (15 states) is in the table, never ranked against 2024-25.
- **The gap uses a fixed panel** (31 states with every year), so it moves only when incomes
  move. Unweighted.
- **Prose has no proseInputs**: state bundles are ragged and the facts sheet's deep cuts
  would set 2025-26 beside 2024-25. `mustName: extremes` dropped for this slot: the sheet
  mixes units, so "movers" compared unlike things.
- **State finances** = Handbook actuals over MoSPI GSDP (computed, labelled); budget and
  revised estimates left out.
- GuideData lists the guide's 25 bundles; all 208 Handbook bundles are in §12, by section
  (the full list made the page 53,000 px tall).

## Second pass (coordinator review, 2026-10-09)
- Merged launch-build (every-cut table, seam helpers, tests).
- **Units:** every series carries a real unit. The Handbook's 182 tables are mapped one by
  one in `HBS_UNITS` (states.mjs) from each table's unit column, its Report Info divisor and
  unit providers, and the value magnitudes; an undeclared table fails the build. New unit
  codes in `src/dossiers/everycut.js` (states block). Corrections to DBIE's own unit column:
  Table 5 maternal mortality is per 1,00,000 live births, Table 11 natural growth per 1,000,
  Table 75 thousand tonnes, Table 95 projects stored ×10^7; Table 181 exports are US$ (All
  India $437 bn, 2024-25), Table 139/141 crore kWh, Table 100 thousand hectares.
- **Labels:** unnamed columns in Tables 105, 166, 171, 175 are named actual / revised /
  budget estimate only after a check that they follow Table 164's pattern (one year each,
  after the last actual); Table 89's second column is the zone total; Table 97's columns are
  capacity, capacity in use, utilisation. Every series label now names its measure.
- **Every-cut table** on the guide: the guide's own 25 bundles (5,576 series; the six over
  150 series on their own pages). Handbook series carry `group` = Handbook section, MoSPI
  industry series `group` = state. The 208 Handbook bundles stay in §12 by section rather
  than in the registry: inline they would add about 9,000 rows to the guide page.
- Sweep: no series in any states bundle has an empty or placeholder unit or a column-index
  label (16,877 series checked).

## Source quirks and defects
- MoSPI indicator 32 is served but unlisted; 35+ answer HTTP 500.
- **Karnataka**: NSVA (30) is a copy of its GSVA; 32 is a copy of per-capita GSDP. Both
  excluded with disclosure; 25 used for Karnataka.
- RBI Table 176, end-March 2015: Delhi, Puducherry, Tripura, Uttarakhand liabilities 5 to 10×
  their neighbours; left out of the debt ratios, kept as published in t176.
- Handbook: 182 distinct tables (not 159); report 1651's largest provider is a display list.
- MoSPI carries no revision labels; which years are advance estimates, we do not know.
- No IDH series match these bundles.

## For the coordinator
- Shared files touched, each one contiguous block: `data/sources.yml` (dossier + seams),
  `scripts/fetch.mjs` (import + registry key), `scripts/validate.mjs`, `scripts/qc.mjs`,
  `scripts/og.mjs`, `src/dossiers/registry.js` (no: "15"; renumber if it clashes),
  `src/dossiers/headline.js`, `src/dossiers/register.client.js`,
  `pipeline/asof-manifest.json`, `pipeline/slots.yml`, `pipeline/lib/series-kws.mjs`.
- `pipeline/out/prose-manifest.json` regenerated here; expect a conflict.
- Others' bundles: none charted. The "same state in other guides" block links to cpi, jobs,
  consumption, factories, mnre, nfhs, gender, aishe, deposits by slug.
- Not done, worth doing: a weighted (population) spread needs a population series we do not
  bake; a Handbook-vs-MoSPI revisions plate.
