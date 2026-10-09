# credit: money, credit and banks

Branch `lb/credit`, port 4403. Updated 2026-10-09.

## Done

- Adapter `scripts/lib/products/credit.mjs` (product `credit`), registered in
  `data/sources.yml` and `scripts/fetch.mjs`. Reads the Data Bank only. Part 8 calls
  `scripts/lib/products/credit-deep.mjs`, which bakes every other RBI money, credit and
  banking table as published, one bundle per table; its raw archive
  (`data/raw/credit-deep.json`) is provenance only (report, provider, rows read, the sha256 of
  the Data Bank's stored copy).
- Bundles: 63 for the guide (`credit-*`), 228 deep tables (`credit-deep-*`), all in the
  registry entry's `bundles`, with a unit on every series and a cut for every bundle in
  `src/dossiers/everycut.js`.
- Catalogue `data/coverage/credit.catalogue.json` (`node scripts/lib/products/credit.mjs
  --catalogue`): 406 DBIE reports from the money, banking, BSR-1, spatial, NBFC, Statistical
  Tables and Trend and Progress menus, the Handbook's and Bulletin's money and banking tables
  and the WSS money tables; plus every series of the parsed sectoral-credit, CAS money and NBFC
  datasets. 864 items.
- Ledger `data/coverage/credit.yml`: 290 shown, 480 baked, 36 excluded, 58 blocked, nothing
  pending (`node scripts/coverage.mjs --strict` passes for credit).
- Seams registered: sectoral credit 2007 vs 2019 format; spatial statements with and
  without RRBs (now including the state x bank group x population group bundles).
- `validate.mjs` block: ranges, cadence, identities (listed in the block's header), RBI's
  printed growth, hand-checked values, and cross-checks tying the deep tables to the guide's
  bundles (money stock M3 = CAS M3 on 84 dates; spatial statement 1's credit growth = statement
  3A's levels; BSR-1 table 1.14 men + women = all; accounts less those above ₹2 lakh = the two
  smallest size bands, 262,430,617 both ways).
- Guide page, client, registry (No. 24 after the launch-build merge), headline, periods, OG
  card, qc PAGES, asof manifest (22 paragraphs), slots, corpus; EveryCut with four bundle
  families for the deep tables (BSR-1, spatial, Trend and Progress, other RBI tables): the page
  is 0.70 MB with 542 rows inline and 16 long-tail views, and qc counts all 159,786 series once;
  seamMarks on the merger, classification and M3 charts.
- Checked by eye at 1440 and 390 px; share images downloaded (credit-deposit ratio by state,
  loan sizes). The download showed two value labels touching their circles (Telangana,
  Haryana); hbars' label-width estimate was widened, fixed.
- Prose regenerated for credit only (2026-10-09) and read by hand; verify (new figures
  verifier), lint and contract pass for both slots.
- IDH cross-check block in `data/crosscheck/idh.yml` (sectoral and industry credit levels).

## Decisions

- Headline is bank credit growth on a year earlier (monthly, all SCBs), computed with RBI's
  own printed year-ago figure, so it equals the press release to the decimal.
- HDFC merger (July 2023): raw and "excluding the merger" series kept side by side, never
  joined. RBI's adjusted Section 42 figures run 14 Jul 2023 to 22 Aug 2025.
- December 2025 reporting calendar (15th and month-end, Banking Laws (Amendment) Act 2025):
  one series; growth compares with the nearest old-calendar Friday, as RBI does.
- Product tags in `meta.dossier` (credit-s42, credit-sibc, credit-money, credit-health,
  credit-place, credit-bsr1, credit-nbfc, credit-deep) so census and seams work per product.
- Andhra Pradesh and Jammu and Kashmir are split into two series where Telangana and Ladakh
  were carved out inside a bundle's span. Population groups split at the 2001 to 2011
  census switch (2015-16).
- Measure columns the mirror names only "Measure 1..9" (spatial statements, BSR-1 annual
  tables) were named only where an identity fixes the meaning; each identity is written in
  `credit-deep.mjs` beside the configs. Two columns no identity could name (statement 4A's
  fourth amount, table 2.14's fourth) are left out and the notes say so.
- Deep-archive tier (coordinator's rule, 2026-10-09): 22 reports are `excluded` with
  `archive: true` and `rolls_up_to`: the centre-wise statements (1420, 1431, 1469, 1487), the
  district statements 4A and 4B in all four vintages (1418, 1419, 1429, 1430, 1467, 1468, 1485,
  1486), district x detailed occupation (1462), district x bank group x population x occupation
  (1220; 1222 is its duplicate), state x occupation x bank group or population (1150, 1151),
  district x occupation (1153), BSR-1 table 3.8 (966, 977), offices by state x bank (616), and
  bank-by-bank balance sheets and maturity profiles (1111, 1116). Any bundle over about 5 MB
  went to the tier.
- Duplicates: a report is baked through its twin when 100% of a hash sample of its
  (date, value) pairs, at any unit scale, is found in a baked report; 65 reports are decided
  this way. 703 and 1223 duplicate the deposits guide's 737 and 1199 and are left to that
  ledger.

## Source quirks (for HISTORY)

- CAS money tables print 0 for discontinued ex-merger series after June 2025, and the monthly
  M3 then equals M1. Dropped and disclosed.
- Report 330: the pre-2011 "Private Sector Banks" ratio row is old + new ratios added up.
  Dropped. From March 2014 "New Private Sector Banks" means all private banks. Relabelled.
- Report 689: mid-2021 Final rows don't add up; the Provisional set does. Used, disclosed.
- Sectoral export: 13 dates carry a different fortnight's Section 42 totals. Replaced from
  689/1130, disclosed.
- Report 1555 prints an all-India row beside its districts. Read on its own.
- Reports 1114 and 336: unit column is junk (SECONDS, LAKH TONNES); values are rupees.
- BSR-1 quarterly tables skip June and September 2014.
- WebI fan-outs: several exports print the same cell more than once with different values and
  no column to tell them apart (BSR-1 964, 965, 952's all-India row; report 976 entirely). The
  baker now leaves such cells out and counts them in the bundle's note; 976 is blocked.
- Scaled storage: some counts and ratios are stored multiplied (self-help groups x 100,000;
  sick units x 10 million; NBFC ratios x 10 million; SCARDB branches x 100,000). Divided back
  where a published figure confirms the factor (NABARD's 26.98 lakh SHGs in 2018-19; RBI's
  85,187 sick small units in March 2008); the notes say so.
- Single values printed in rupees where the rest of a series is in crore (report 25, 25 July
  2025) are left out by a general guard (a value 100,000 times its series' median, or a
  hundred times both neighbours).
- Titles in the mirror can be wrong: 1214 and 1215 hold the same co-operative balance sheets
  under unrelated titles; 1078's bank-group column mislabels banks in 983 (the table's own
  Op Level4 column is used).

## Shared files touched

- `scripts/lib/databank.mjs`: appended `dbieProvider()` (reports with several data providers).
- `scripts/fetch.mjs`: one import and one registry key.
- `data/sources.yml`, `scripts/validate.mjs`, `src/dossiers/{registry,headline,everycut,
  register.client}.js`, `scripts/og.mjs`, `scripts/qc.mjs`, `pipeline/slots.yml`,
  `pipeline/lib/series-kws.mjs`, `pipeline/asof-manifest.json`, `data/crosscheck/idh.yml`:
  one block each, marked credit.

## Deposits ledger (scheduled to "money and credit")

Not taken in this session: the 690 pending BSR-2 items in `data/coverage/deposits.yml`. The
BSR-2 tables are Measure-N exports like the spatial statements; table 2.3's measures were
checked (offices, then accounts and amounts for current, savings, term and total, and the
types add to the totals in every row), so they can be baked the same way, but that is a
session of its own and the rules belong in the deposits ledger.

## For the coordinator (framework, not patched here)

- `src/dossiers/guide.client.js` opens every scrolling plot zone at its right end, which suits
  time charts but hides the category names on horizontal bar charts at 390 px (11 plates on
  credit, 4 on states). Bar plates need to open at the left.
- "Data and downloads" (GuideData) lists every file, so with 291 files the section is about
  60,000 px tall on credit (little HTML); families could be summarised there as in EveryCut.

## Blocked

Nothing for the guide. 58 catalogue items are blocked because the mirror has no rows for them
(the BSR volumes the RBI publishes as PDFs, and 617, 1221, 1456) or, for 976, because every
cell is ambiguous.
