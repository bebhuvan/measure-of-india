# households: status

Session atlas-households, branch `lb/households`, port 4426. Brief: `docs/briefs/households.md`
(wave 2). Guides: `consumption` (hces), `aishe`, `mnre`, `deposits` (bsr2).

## Done

- **Data, all four families** (commit b4bcf86). Every cut each source publishes is baked.
  - mnre: wind, small and large hydro, and bio power (four kinds) by state; solar's four
    categories by state; bio-power kinds nationally. 5 bundles added.
  - aishe: 7 bundles added, each by state (All India included) x the indicator's own cuts.
  - hces: 12 bundles added (states with imputation, fractiles, rupees and shares by
    category, quantities, cereal values, household type, social group, Gini, by state).
  - deposits: 48 BSR-2 table bundles, the old sector classification in full, the
    2010-18 district table summed to states. District tables staged for the archive.
- **validate.mjs**: one households block; every new bundle checked; family identities.

## Next

Ledgers, registry, every-cut, guide plates for all four, prose for consumption, gates.

## Decisions

- **Deposits: what the Measure columns mean.** DBIE exports BSR-2 tables as "Measure 1..15"
  with no titles. Each table's columns are named from RBI's table layout and proved by
  identities that must hold in every row or the bake fails (`bsr2-tables.mjs` header):
  current + savings + term = total; individuals + others = total; the six owning sectors =
  all; the bank groups = all banks; officers + clerks + subordinates = all employees.
- **Why tables 2.4-2.6 "do not partition".** They print individuals, *of which women*, and
  others. Women sit inside individuals. Individuals + others = total in every row.
- **The signed values** in the 1.x and 3.x tables are per cent shares of each column,
  printed with a minus sign on rows with no label (checked: -2.1779 = 1.597/73.327).
  Derived, so skipped.
- **Tables 1.x include interbank deposits, 2.x and 3.x do not.** 2026: 266.55 (1.x) less
  5.78 (banks) = 260.76 (2.x).
- **Quarterly BSR-2 is a different instrument**: it leaves out regional rural banks (RBI's
  release, 29 May 2026). Own bundles `deposits-q-*`, never joined to the annual ones.
- **Quarterly tables 2.1-2.3** carry no total-amount column in the export (8 measures,
  not 9): baked as published, the total-accounts identity checked.
- **Age table, 2023**: groups coded 441-448 (individuals) and 451-458 (women), and account
  counts stored x1000 (each a whole multiple of 1,000; divided back they run on into the
  next quarter's uncoded counts). Undone and asserted.
- **Amounts in the new deposit bundles are ₹ crore** (2 dp): district and sub-sector values
  are too small for ₹ lakh crore at 3 dp. The guide's original bundles keep ₹ lakh crore.
- **Deep archive (staged, not uploaded):** `data/archive/staging/deposits/`: table 2.12
  by type of account (district x gender), quarterly district tables 2.7 and 2.12, the
  2010-18 district x population group x bank group table, and the raw reports over 5,000
  rows (indexed with sha256 in `data/raw/bsr2-tables-index.json`).
- **Vintage**: hces and aishe bundles carry the raw dump's data vintage, never the run date.

## Source quirks (for HISTORY)

- **AISHE, 2026-08-09 dump**: unstable paging (then 500-row pages) duplicated some rows and
  dropped others. The "2021-22 All Teacher defect" (12,904) was this artifact, not the
  source: a clean refetch gives 15,97,688, and All Teacher = the five regular posts +
  visiting teachers in 546 of 549 cells (All India 2020-21 is 34 apart). Nagaland's 2021-22
  enrolment, missing before, is back (51,223). The teacher reconstruction is retired.
- **HCES indicator 3, 2022-23 rural, without imputation**: the rupee rows printed under Goa,
  Gujarat, Haryana, Himachal Pradesh, Jharkhand and Karnataka are those of Andhra Pradesh,
  Arunachal Pradesh, Assam, Bihar, Chhattisgarh and Delhi (alphabetical shift; each adds to
  the other state's MPCE to the rupee). Shares and every other indicator are consistent.
  Left out by a rule (rupees miss the state's own MPCE by over 1%), named in the note.
- **BSR-2 table 1.1, March 2019** was migrated at crore precision: parts miss totals by up
  to 1.5 crore. Identities allow ₹3 crore.
- **BSR-2 district tables** print every cell twice (identical): collapsed.
- **BSR-2 sector labels drift** ("1 General Government Sector" in 2019): keyed by code.
- **Table 2.11 (age)** individuals run about 1% below table 2.6 every year (accounts with
  no age recorded, presumably).
- **MNRE** keeps pre-merger UT names on old rows and an "Others" state row; baked as served.

## Hand checks

- deposits: RBI press release 29 May 2026 (BSR-2, March 2026): households 59.3%, savings
  28.7%, term 61.6%, senior citizens 20.0%, 1-3 year original maturity 69.8%: all match
  (asserted in validate.mjs).
