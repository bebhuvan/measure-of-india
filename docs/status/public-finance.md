# public-finance: what India's governments earn, spend, borrow and owe

Branch `lb/public-finance`. Guide `/guides/public-finance/` (port 4431). Updated 2026-10-10.

## Done

- Adapter `scripts/lib/products/public-finance.mjs` (product `public-finance`, family
  `databank`), read-only from the Data Bank. 59 bundles `public-finance-*`; raw rows archived
  under `data/raw/public-finance-*` (ACTUALS only, packed; under 1 MB in all).
- Catalogue (`--catalogue`): 1,215 items from 113 DBIE reports chosen by rule (the four
  government-finance menus, same-named copies elsewhere, the Bulletin and debt tables) plus CAS.
  Ledger: 393 shown, 613 baked, 209 excluded, 0 blocked, 0 pending.
- Validate: seams (5 GDP rulers), freshness floors, ranges by unit, and the tables' own
  arithmetic (totals = parts, primary deficit = GFD - interest, revenue deficit = revenue
  spending - revenue receipts, monthly deficit = spending - receipts, ownership shares = 100,
  small savings total = its parts).

- Guide `/guides/public-finance/`: 20 plates in 11 sections (current reading, lived reality,
  how to read, the deficit, receipts, spending, debt and who holds it, the states, which GDP,
  what these measure, misreadings), every-cut table, data downloads; registry (`no: "26"`,
  renumber on merge), headline, spark, register rows, OG card, qc PAGES (22 checks), 20 as-of
  entries, prose slots, corpus, series keywords.
- Prose generated (DeepSeek) and read against the facts sheet: every figure checked by hand;
  two phrases of pipeline jargon ("the sheet's weakest mover") removed by hand, then verify,
  lint and contract re-run clean.

- Gates (locked build, 2026-10-10): `npx astro build`, `npm run gates` (validate, as-of, qc,
  chart lint clean), `npm test` (52/52), `npm run prose:dry`, coverage `--strict` all green.
  Looked at 1440 and 390 (every plate read); a share PNG of the deficit plate downloaded and
  checked. Fixed on the way: unreadable white labels on the spend bars (now pale tints with ink
  text), a truncated state name, ten label placements flagged by chart lint, and two notes
  checked against the data (the 2000-01 jump in the Centre's net income tax is the change to
  sharing all central taxes; the earlier GDP rebasings moved the deficit ratio little).

- Derived labels (coordinator's review, 2026-10-10): every computed series carries
  `derived: true` and a `derivedNote` (the two GDP-ruler bundles, shares of the budget, running
  totals, sums and counts); the ratio bundles' meta.source names RBI and MoSPI and says the ratio
  is India Atlas's. The which-GDP plate draws our two rulers dashed beside the RBI's solid one;
  the pre-2011-12 back-cast on the deficit and debt plates stays a pale tint (seamMarks agency,
  DESIGN) with the computation named in subtitle and source. Gates re-run green.

## Next

Nothing outstanding. Possible follow-ups: an every-state fiscal table (the States guide holds
the state-wise Handbook tables); the combined Bulletin's budget-to-accounts path as a plate.

## Decisions (for HISTORY)

- **Stages are separate series.** DBIE's Version labels are unreliable (one figure tagged both
  "Budget" and "Revised"). The stage of each year comes from the printed table's own note
  ("Data for 2025-26 are Revised Estimates and data for 2026-27 are Budget Estimates"), read
  from the RBI Innovation Hub's export of the Handbook tables (the Data Bank does not keep
  notes). Accounts, the revised estimate and the budget estimate are three series (`__re`,
  `__be`). Where DBIE holds different figures under different labels, Final > Actual > Revised
  > Budget; this reproduces the printed Handbook.
- **The budget-to-accounts path** (BE, RE, provisional accounts) comes from Bulletin table 49:
  BE = the figure most of the year's months carry (the full budget's, in election years), RE =
  the figure printed in March (else February, January). Checked: equals the Handbook's latest
  BE and RE for six items.
- **GDP base is a seam.** The RBI's per-cent-of-GDP tables use the 1999-2000 base to 2003-04,
  2004-05 to 2010-11 and 2011-12 from 2011-12 (Handbook note; implied denominators of the
  Centre's and states' tables agree). Each base is its own bundle (`-b1999`, `-b2004`,
  `-b2011`). Two rulers computed here: the rupee figures over MoSPI's 2011-12 back-cast
  (bridge, `ratios-backcast`, 1970-71 to 2010-11) and over the 2022-23 series (`ratios-2022`).
  Our division reproduces the RBI's GFD ratio on the 2011-12 series (worst 0.007 pt).
- Seams also split: small-savings receipts (gross to March 2017, net after); 'others' in debt
  ownership (pension funds apart from March 2022); the ownership table's two layouts; Bulletin
  49's old layout, which counts borrowing inside receipts in most months.

## Source quirks found (for the Data Bank owner)

- DBIE Version labels: report 655 tags 2024-25 accounts as both BE and RE; 355 holds three
  figures for 2022-23. 349's "Budget Estimates" label is on monthly actuals.
- Bulletin table 49 (Union accounts): repeats the previous year's figures in May 2009 and July
  2021 to February 2022; March 2008, 2009 and 2014 repeat an earlier month; February 2011 does
  not add up; the old layout puts borrowing inside receipts. All left empty or split, disclosed.
- Report 655's query returns 1970-74 values of other tables' items (excluded; read from their
  own tables). Report 709 provider DP2 has amounts with no item labels.
- Small savings (581): the grand total leaves out Sukanya Samriddhi and PM CARES in seven months
  of 2022; parts and total differ by up to 0.2% in 2011-13.
- WSS T-bills: the 14-day intermediate row prints a negative "others" holding on 18 and 25
  September 2026 (left empty).
- Monthly GFD (349) does not add up to the audited annual figure in 2012-13, 2013-14, 2017-18.

## Cross-checks

- Every annual table cross-checked against the printed Handbook table (Innovation Hub export):
  about 10,000 figures, all but 4 match (report 655).
- CAS FICG_GDP_RN, FISG_GDP_RN, CG_DEFM_RN equal the webi reports value for value (2,127).
- Reports 2 and 29 (T-bills outstanding) agree on all 12,125 holdings both print.
- Hand checks: GFD 2024-25 ₹15,74,431 crore; 2026-27 BE ₹16,95,768 crore (Union Budget
  2026-27); net tax revenue 2024-25 ₹25,00,039 crore; GFD 2022-23 6.46% of GDP (Handbook).

## Read-only use of other families' bundles

- `rates-borrowing` (market borrowing, in a plate note); `states-finances` (state cut,
  charted); `population-wpp-projection` (per-person spending; a UN projection, labelled).

## For the coordinator

- Shared files touched (one marked block each): `data/sources.yml` (dossier + seams),
  `scripts/fetch.mjs`, `scripts/validate.mjs`, `scripts/qc.mjs`, `scripts/og.mjs`,
  `src/dossiers/registry.js`, `headline.js` (HEADLINE + SPARK), `register.client.js`,
  `everycut.js` (cuts), `pipeline/slots.yml`, `pipeline/lib/series-kws.mjs`,
  `pipeline/asof-manifest.json`. `og.mjs` re-renders every card: only my PNG is committed.
- All-states aggregate bundles are named `public-finance-allstates-*`: the state-key test
  reads any `-states-` bundle as state-wise.
- State cut for atlas-profiles: no new state-wise fiscal bundle here beyond the States guide's;
  `public-finance-states-wma` (days and amounts on SDF, WMA and overdraft, per state, monthly
  since Sep 2017) and `public-finance-states-investments` (each state's CSF, GRF, BSF, T-bills)
  are state-wise and could join the profiles.
- IDH: no India Data Hub series in the Data Bank match these bundles (only T-bill yields and
  G-sec yields, which belong to rates).
