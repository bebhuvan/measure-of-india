# households: status

Session atlas-households, branch `lb/households`, port 4426. Brief: `docs/briefs/households.md`
(wave 2). Guides: `consumption` (hces), `aishe`, `mnre`, `deposits` (bsr2).

## State: done (2026-10-10)

Build, `npm run gates` (validate, coverage, as-of, qc, chart lint: clean on 453 SVGs),
`npm test` (34), `prose:dry` green. No pending item in any of my four ledgers.

| Family | Items | Shown | Baked | Excluded | Blocked |
|---|---|---|---|---|---|
| hces | 803 | 277 | 526 | 0 | 0 |
| aishe | 372 | 257 | 115 | 0 | 0 |
| mnre | 212 | 212 | 0 | 0 | 0 |
| deposits | 791 | 226 | 512 | 5 (3 archive) | 48 |

## Done

- **Data** (commit b4bcf86). Every cut each source publishes, baked.
  - mnre: wind, small and large hydro, bio (four kinds), solar (four categories) by state;
    bio-power kinds nationally. One no-state fetch per type.
  - aishe: universities, colleges, enrolment by level, social group, minority, GER and GPI,
    PTR by institution type and mode, teachers by post, all by state x gender.
  - hces: every indicator by state, both imputation bases (12 bundles added).
  - deposits: 48 BSR-2 table bundles (annual and quarterly), the old sector classification
    in full, the 2010-18 district table summed to states; district tables staged for the
    deep archive.
- **Guides** (commit aefa673). New plates, each titled with its finding:
  - consumption v1.2: what a person spends on food, fuel, schooling, medicines, hospital,
    travel, rent and durables in every state, rural and urban; what free items add, by
    state; spending Gini by state. Prose regenerated (DeepSeek), strict verify passes
    (21 and 13 figures), read by hand against the data.
  - aishe v1.2: PTR by state; women's share of teachers against students by state;
    colleges by state. Teacher correction disclosed in the provenance.
  - mnre v1.1: each source's map (wind, large hydro, small hydro, bio); rooftop solar by
    state; bio power by kind. Links to the climate guide for the energy mix.
  - deposits v1.1: owners one by one; age of savers; women's share by state; states;
    districts; bank groups; bank staff by gender; original maturity; the quarterly return.
- Looked at 1440 and 390; every new chart read; share image downloaded (deposits, age:
  PNG 3888 x 2136, title, key, chart, source, brand all present). Every-cut tables and the
  two deposits families' long-tail pages build and pass qc's row counts.

## Decisions

- **Deposits: what the Measure columns mean.** DBIE exports BSR-2 as "Measure 1..15" with
  no titles. Each table's columns are named from RBI's layout and proved by identities that
  must hold in every row or the bake fails (`bsr2-tables.mjs` header); validate re-checks
  them on the baked values.
- **Why tables 2.4-2.6 "do not partition"**: they print individuals, *of which women*, and
  others. Women sit inside individuals; individuals + others = total in every row.
- **The signed values** in tables 1.x and 3.x are each cell's per cent share of its column,
  printed with a minus sign on rows with no label (-2.1779 = 1.597 / 73.327). Skipped as
  derived; shares are recomputed where drawn.
- **Tables 1.x include interbank deposits; 2.x and 3.x do not** (266.55 less 5.78 = 260.76).
- **Quarterly BSR-2 is its own instrument** (excludes regional rural banks; RBI release,
  29 May 2026): `deposits-q-*`, never joined to the annual bundles.
- **Bank-group shares use table 1.5**, because tables 2.x print no totals for 2021-2023.
- **District totals** on the deposits plate are sums of a district's population-group rows
  (the table prints none), labelled so.
- **Amounts in the new deposit bundles are ₹ crore** (district and sub-sector values are too
  small for ₹ lakh crore at 3 dp); the original bundles keep ₹ lakh crore.
- **National with-imputation rows** of hces indicators 6-8 live as the All India rows of the
  `-states` bundles, so the national bundles never mix conventions in a ranking.
- **Vintage**: hces and aishe bundles carry the raw dump's data vintage, never the run date.
- **Deep archive (staged in `data/archive/staging/deposits/`, not uploaded)**: table 2.12 by
  type of account (district x gender), quarterly tables 2.7 and 2.12, the 2010-18 district x
  population group x bank group table, and raw reports over 5,000 rows (indexed with sha256
  in `data/raw/bsr2-tables-index.json`). Ledger rules: 1199, 1313, 1556 `archive: true`.

## Source quirks (for HISTORY)

- **AISHE, 2026-08-09 dump**: unstable paging (500-row pages then) duplicated some rows and
  dropped others. The "2021-22 All Teacher defect" (12,904) was this artifact, not the
  source: a clean refetch gives 15,97,688, and All Teacher = five regular posts + visiting
  teachers in 546 of 549 cells (All India 2020-21 is 34 apart). Nagaland's 2021-22
  enrolment returned (51,223). Reconstruction retired; correction disclosed on the page.
  Every paged MoSPI fetch (aishe, hces, mnre) now fails on a duplicate row.
- **HCES indicator 3, 2022-23 rural, without imputation**: the rupee rows under Goa, Gujarat,
  Haryana, Himachal Pradesh, Jharkhand and Karnataka are those of Andhra Pradesh, Arunachal
  Pradesh, Assam, Bihar, Chhattisgarh and Delhi (alphabetical shift; live API and archive
  alike). Shares and every other indicator are consistent. Left out by rule (rupees miss the
  state's own MPCE by over 1%), named in the bundle note and the page provenance.
- **BSR-2 age table (2.11), 2023**: groups coded 441-448 (individuals) and 451-458 (women);
  account counts stored x1000 (whole multiples of 1,000; run on into the next quarter's
  uncoded counts). Undone and asserted. The table runs about 1% below table 2.6 every year.
- **BSR-2 table 1.1, March 2019**: migrated at crore precision (parts miss totals by up to
  1.5 crore). Sector labels drift ("General Government Sector" in 2019): keyed by code.
- **BSR-2 district tables** print every cell twice (identical): collapsed.
- **Quarterly tables 2.1-2.3** carry no total-amount column; tables 2.x print no totals
  for 2021-2023. Baked as published, gaps declared.
- **MNRE** keeps pre-merger UT names on old rows and an "Others" state row; baked as served.

## Hand checks

- deposits, RBI release of 29 May 2026 (March 2026): households 59.3%, savings 28.7%, term
  61.6%, senior citizens 20.0%, 1-3 year original maturity 69.8%: all match, asserted in
  validate.mjs.
- deposits: table 1.1 (report 1200) equals report 737's new scheme in all 1,024 cells.
- hces: food + non-food rupees = each state's MPCE within 1% (bar the six misprints).
- mnre: the four bio kinds and four solar categories add to their totals in every state
  and month (validate).

## Shared files touched (one block each, marked households, unless noted)

- `scripts/validate.mjs`: households block; also edited my own family's aishe lines (teacher
  range and the retired reconstruction check) and the hces food-share range.
- `scripts/qc.mjs`: checks added inside my four PAGES entries; `ex-fac-lecn` now divides by
  all teachers.
- `src/dossiers/registry.js`: my four entries (bundles, versions, consumption proseInputs,
  deposits `everyCutFamilies`).
- `src/dossiers/everycut.js`: one UNITS entry (`pupils_per_teacher`), one CUT_BY_BUNDLE block.
- `pipeline/asof-manifest.json`: 19 entries appended. `pipeline/slots.yml`: consumption block.
- `scripts/og.mjs`: my mnre card (domain in MW against GW data: empty chart; hard-typed
  "Jun 2026") and aishe card (prep series never scaled: empty chart) fixed.
- **`pipeline/contract.mjs` (for the coordinator)**: an annual fiscal period "FY24" may also be
  named "2023-24". Survey rounds and annual returns are written that way; without it the
  writer had to call the 2023-24 HCES round "FY24", which is wrong (it ran Aug 2023 to
  Jul 2024). Also worth a look: `pipeline/lib/periods.mjs` labels survey rounds FYxx.

## For the coordinator

- **Data Bank**: quarterly BSR-2 table 1.2 (DBIE report 1303) has no rows in the mirror
  (blocked, 2026-10-10). The BSR publication volumes (1262-1291, 1329-1345) and notes
  (1261, 1327) are not mirrored either; the volumes are blocked, the notes excluded as text.
- **Archive builder**: `data/archive/staging/deposits/` holds 4 long-format csv.gz tables and
  5 raw json.gz dumps (index in `data/raw/bsr2-tables-index.json`).
- **Possible bug elsewhere**: the stacked-bar label pattern `Plot.text(rows.filter(...),
  Plot.stackY(...))` misplaces labels (it stacks only the filtered rows). Fixed in
  deposits; other guides may copy the pattern.
- IDH: no twin for any of my bundles. Searched `india_data_hub_series` (2026-10-10) for
  deposit, renewable, enrolment and consumption expenditure: 8 hits, none BSR-2, MNRE,
  AISHE or HCES (the fortnightly SCB deposits series belongs to the credit guide).
