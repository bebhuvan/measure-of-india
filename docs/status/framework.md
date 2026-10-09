# framework: status

Session: atlas-framework, branch `lb/framework`, port 4411. Brief: `docs/briefs/framework.md`.

## Done

- **F6 every-cut table** (2026-10-09). On all 14 guides, just before "Data and downloads".
  Lists every series of every bundle in the guide's registry entry: label, cut, latest
  with period, change on a year earlier, sparkline, CSV link. Sort by series, cut, latest,
  change; filter by cut, by data file, and by free text. Shows 25 rows, then "Show all".
  Bundles over 150 series get their own page (`/guides/<slug>/every-cut/<bundle>/`), split
  at 1,000 rows with groups kept whole. qc checks the row counts equal the bundles'
  series counts (CPI 629, WPI 1,994, factories 892 ...). Looked at 1440 and 390.

- **F4 seams on charts** (2026-10-09). `seamMarks(treatment, rulers, marker)` and
  `seamOverlap(a, b)` in `src/charts/plumbing.js`: "side", "overlap", "agency", nothing
  else; it throws on one ruler, on an agency link whose label names no agency, or on a
  back-cast stretch outside an agency seam. Moved onto it: CPI §02 (agency: NSO back-cast,
  now a solid pale tint instead of 55% opacity, per DESIGN), CPI-AL (side), WPI §02
  (overlap), IIP two bases (side), GDP §11 three rulers (side, no marker: they never
  meet; legend now says "NSO back series"). Facts sheets carry `ruler` on every series,
  every proseInputs summary and the CPI legacy block (bundle, base, product, seam window,
  agency link) from `sources.yml seams:`. verify.mjs skips `ruler` keys and no longer
  lets the digits of a base string ("2022-23=100") trace a figure; every existing prose
  file still verifies.

- **F5 IDH cross-check** (2026-10-09). `npm run crosscheck:idh` (`scripts/crosscheck-idh.mjs`,
  manifest `data/crosscheck/idh.yml`). Reads IDH from the Data Bank's `india_data_hub_series`
  via `databankQuery`, latest vintage per observation, month-end dates onto our month-start
  axis, transforms `level`, `yoy_from_index`, `monthly_mean`, then compares on shared dates.
  Report to `pipeline/out/crosscheck-idh.json` (git-ignored, checked). Never a gate.
  First run, 10 pairs, 7 match on every shared date:
  - cpi.headline (our computed 2012-base y/y) vs IDH CPI index y/y: 120/120 within 0.15 pt,
    worst 0.14 pt (Jun 2020).
  - rbi-intervention purchases, sales, net, forward book: exact on all 122 to 328 months.
  - rbi-forward-premia 3m, 6m: all within 0.5; 1m: 164/166 (weekly mean vs RBI monthly mean).
  - USD/INR (rbi-exchange-rates, rbi-forex): 377/400. The 12 months Mar 1992 to Feb 1993 are
    the dual exchange rate (LERMS): ours is the official rate (25.89), IDH the market rate
    (29.46 and up). The other 11 misses are 2 to 3 paise. **For atlas-external:** say which
    rate the bundle carries for 1992-93.
  - Staleness the check shows: IDH runs to Jul to Sep 2026 on every external-account pair;
    our MoSPI-mirror bundles stop at Jun to Aug 2025 (atlas-external is replacing them).
  - Not paired, with reasons, in the manifest header: IDH's spliced CPI (a splice), NEER/REER,
    FDI/FPI, policy and money-market rates, bank credit (no Atlas bundle yet).

## Request for the Data Bank: IDH macro series the Atlas wants

The Data Bank mirrors no IDH series for these families, and holds no IDH catalogue for them,
so the ids below must be looked up in IDH's own catalogue (`/em/filter`) by whoever runs the
Data Bank's IDH config. Wanted, all-India unless said, full history, every vintage kept:

- **GDP (NAS)**: quarterly and annual real and nominal GDP, GVA, and GVA by the 8 (2011-12)
  and 15 (2022-23) industries; PFCE, GFCE, GFCF, exports, imports; GDP deflator; both bases
  as separate series (never IDH's spliced versions).
- **CPI**: all-India combined, rural, urban general index on 2012 and 2024 bases; the 2012
  groups (food, fuel, housing...) and the 2024 divisions; CPI-AL and CPI-RL (1986-87 and 2019
  bases); CPI-IW (2016 base).
- **WPI**: headline and the three major groups (primary, fuel and power, manufactured) on
  2011-12 and 2022-23 bases; WPI food index.
- **IIP**: general, sectors (mining, manufacturing, electricity), use-based groups, on 2011-12
  and 2022-23 bases; the eight core industries.
- **PLFS**: monthly CWS unemployment rate, LFPR, WPR (15+, rural, urban, by gender);
  quarterly urban; annual usual-status rates.
- **Trade**: monthly merchandise exports, imports, balance (US$ and ₹), oil and non-oil;
  services exports and imports.

- **Ledgers for the 13 existing guides** (2026-10-09). A `--catalogue` mode in every adapter
  (`node scripts/lib/products/<adapter>.mjs --catalogue`) built on `scripts/lib/catalogue.mjs`,
  16 catalogues and 16 ledgers in `data/coverage/`. `coverage --strict` now lists only
  `external` without a ledger (skipped per the brief: atlas-external is rebuilding it).
  The gate FAILS on purpose: the omissions below are undecided, for you to schedule.
  `node scripts/coverage.mjs --list` prints them as globs. Everything else is green
  (build, validate, asof, qc, chart lint, 27 tests, prose:dry).

  | Family (guide) | Items | Shown | Baked | Excluded |
  |---|---|---|---|---|
  | cpi (cpi) | 83,690 | 591 | 72 | 3,024 |
  | cpialrl (cpi) | 980 | 30 | 34 | 0 |
  | gdp (gdp) | 621 | 34 | 32 | 118 |
  | wpi (wpi) | 3,344 | 870 | 1,124 | 0 |
  | iip (iip) | 266 | 69 | 64 | 0 |
  | isp (iip) | 38 | 19 | 0 | 0 |
  | plfs (jobs) | 1,719 | 127 | 0 | 0 |
  | hces (consumption) | 803 | 169 | 0 | 0 |
  | asi (factories) | 43,794 | 488 | 0 | 57 |
  | asuse (factories) | 2,275 | 329 | 0 | 0 |
  | aishe | 372 | 145 | 0 | 2 |
  | gender | 4,828 | 86 | 0 | 0 |
  | mnre | 212 | 91 | 0 | 0 |
  | nfhs | 11,152 | 356 | 0 | 0 |
  | manufacturing (WDI) | 21 | 11 | 0 | 0 |
  | deposits (BSR-2) | 791 | 101 | 0 | 0 |

  What an item is: an indicator crossed with one cut (contract wording). Catalogues come
  from the source's listing calls, not from probing every slice: MoSPI is shared with the
  states and services sessions, so about 450 metadata calls in all, one at a time. Where a
  listing offers a cross (CPI state x sector x node), a probe checked the shape (Andhra
  Pradesh rural, Aug 2026: 649 of 669 nodes served), so a few listed items may be empty.

## Omissions for the coordinator to schedule (the undecided items)

- **cpi** (prices deeper): base-2024 classes and sub-classes (raw only); base-2024 rural and
  urban below the General index; base-2024 state x division, group, class, item (about 73,000
  items); base-2024 back series for rural and urban; base-2012 groups other than general,
  food, fuel (housing, pan, clothing, misc: raw only, used to compute the headline); rural
  and urban sub-groups; state groups and sub-groups; the 299 base-2012 items; the 2011-13
  base-2012 back series.
- **cpialrl**: RL groups, RL states, 1986-87 groups, state x group, states missing from the
  1986-87 bundle.
- **gdp** (national accounts remainder): annual GVA, PFCE, GFCF, GFCE, trade, income
  aggregates; quarterly net taxes, change in stock, valuables; 15 industries and 18
  sub-industries annually; institutional sectors; revision stages; approach split; the back
  series beyond GDP, GVA by industry, engines and saving.
- **wpi**: sub-sub-groups (raw only); the 2004-05 and 1993-94 bases (the API serves both).
- **iip, isp**: the annual (financial-year) series.
- **plfs** (jobs deeper): calendar-year estimates; LFPR and WPR by state; religion, social
  group, age; gender x sector of the annual and quarterly series; quarterly states; NIC, NCO,
  enterprise cuts; indicator 5; earnings by state.
- **hces**: "with imputation" below All India; MPCE in rupees by category; fractiles,
  quantities, household type, social group and Gini by state; categories by state beyond
  the food share.
- **asi** (industry deeper): non-core indicators by industry and state; 3- and 4-digit NIC;
  older blocks beyond the comparable core.
- **asuse**: the 2025 round; 49 detailed activities; state twins of the distribution
  tables; workers by gender and type; portrait tables by activity.
- **aishe**: universities, colleges, teachers, social-group and minority enrolment and PTR by
  state; PTR by institution type and mode.
- **gender**: 144 of 154 compendium indicators; sector cuts; earlier years of state tables.
- **nfhs**: tables 2, 6, 7, 11, 17, 18; the rest of tables 5 and 10; rural and urban; states
  beyond four indicators; NFHS-4 states.
- **mnre**: wind, hydro and bio by state; bio-power categories.
- **manufacturing**: value added in current US$ and rupees; industry beyond share of GDP;
  value added per worker; manufactures' share of imports.
- **deposits**: other owning sectors one by one; finer household split; "others" category
  and accounts by band; state, district, bank group, metro, age and gender tables; the whole
  quarterly BSR-2.

## Next

Send the done message to the coordinator.

## Note for family sessions: adding the every-cut table

1. In your guide page: `import EveryCut from "../../components/EveryCut.astro";` and put
   `<EveryCut slug="<slug>" />` on the line before `<GuideData slug="<slug>" />`.
2. It reads your registry entry's `currentBundle` and `bundles`: every bundle the guide
   uses must be listed there, or its series will not appear.
3. Units: each series needs a unit the table knows (`UNITS` in `src/dossiers/everycut.js`).
   It reads `series.unit`, then the series name (`..._yoy_pct`, `..._pct`, `..._inr`,
   `..._usd_millions`, `..._index...`), then `meta.unit`. An unknown unit fails the build
   with the series named. Prefer setting `series.unit` in your adapter; if you need a new
   unit, add it to `UNITS` in one block marked with your slug.
4. Cuts: the cut column comes from `CUT_BY_BUNDLE`, then the bundle slug (`-states`,
   `-items`, `-partners`, `-hs2` ...). Add your bundles to `CUT_BY_BUNDLE` in one block
   marked with your slug, or pass `cuts={{ "<bundle>": "Partner" }}` to the component.
   A series' `group` (or `division`, `lineage`) becomes the group filter on long-tail pages:
   set it for long tails (HS chapter for HS lines, division for items).
5. Survey rounds dated by one year: add a `PERIOD_LABELS` entry.
6. Run `npx astro build && npm run qc`: qc fails if the table misses a series or a
   long-tail page exceeds 1.2 MB.

## Proposed doc edits (for the coordinator)

- `docs/CONTRACT-dossier-structure.md`: new "End matter" section naming the every-cut table
  (edited on this branch).
- `docs/CONTRACT-render.md`: HTML budget line for guide and long-tail pages (edited).

## Decisions

- Change on a year earlier: points for rates and shares, per cent for levels, plain
  difference for ratios and coefficients; a dash when there is no same-period value a year
  earlier, when the frequency is not monthly, quarterly or annual (survey rounds, decades),
  or when a level's previous value is zero or negative (a per cent change of a flow that
  changes sign means nothing).
- Sparklines follow DESIGN §5: y-domain from min(0, min) to max; gaps break the line.
- The guide's "On this page" list now includes "Every series, every cut"
  (`src/dossiers/guide.client.js`, one selector added).

- Ledger exclusions, each about the data: CPI base 2010 (a 2011-14 fragment superseded by
  2012); NAS growth-rate indicators (the API's rounded rates; growth is computed from
  levels); ASI NIC 98 (listed, no rows: households are outside the factory frame); AISHE
  2021-22 "All Teacher" and "Visiting Teacher" rows (the source defect the bundle notes).
- Two partial cuts are marked shown with a comment, since an item cannot say "partly":
  HCES categories by state (food share only) and gender state tables (latest year only).
- `cpialrl-states-2019` was baked but missing from the cpi registry `bundles`; added (one
  line in `src/dossiers/registry.js`), so it now appears in downloads and every-cut.

## Data quirks found (other owners)

- **The manufacturing guide has no `data/sources.yml` entry** (git history: it never had
  one), so `npm run data` never refreshes the WDI bundles. Needs a dossier entry with
  product `worldbank-wdi`; atlas-worldbank may be the natural owner.
- MoSPI CPI base 2012 lists a "Back" series: real, but only 2011 to 2013.
- MoSPI NAS: the filter call needs base, series, frequency and account together (HTTP 400
  otherwise). PLFS, ASUSE and MNRE list time (quarter, month) as a dimension.

- `nfhs-child` (nfhs): mortality rates labelled "(per 1000 live births)" carry
  `unit: percent`. The table trusts the label; the bundle should say `per_1000`.
- `cpialrl-states-2019` is baked but not in the cpi registry `bundles`, so no page shows it.
- Several state labels are lower case from the source (`plfs-states`, `cpi-states`:
  "andaman nicobar islands", "West bengal").
