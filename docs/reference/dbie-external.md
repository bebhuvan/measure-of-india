# DBIE external-sector tables: what we learned (lb/external, 2026-10)

Read through the owner's Data Bank mirror (`rbi_dbie_webi_rows`), never RBI live. Reader:
`scripts/lib/products/external-dbie.mjs` (every data provider of a report, latest fetch each).

## Shape of the webi exports

- Every value is repeated once per display unit (ACTUALS, THOUSANDS, LAKHS, MILLIONS, CRORES,
  BILLIONS; some reports also NUMBER, SECONDS, YEARS, PERCENTAGE ...). The amount is the same in
  every copy, always in actual units. Keep ACTUALS.
- Cells can hold `;` inside quotes (report 1076, item 3.4.2.1): parse as CSV, never split.
- Some rows are misaligned by the export (a unit name in the credit/debit column, a fiscal year
  in the date column). Drop rows whose date or key does not parse.
- A report can have several data providers: "Old"/"New" layouts (BoP 141), "dollar"/"inr"
  (reserves, IIP), a metadata provider naming the lines (IIP 982 "Query 1"). Read all of them;
  `databank.mjs dbieReport()` returns only the largest.
- Recent periods carry two versions at once: Provisional or Preliminary Estimates (first), then
  Partially Revised; old periods only Revised or Final. Rank: Forecast < Provisional <
  Preliminary Estimates < Partially Revised < Revised < Final.

## Report by report

| Report | Table | Quirk |
|---|---|---|
| 56 / 57 | Overall BoP, quarterly, US$ / ₹ | 57 runs back to 1949-50 by quarter; line labels repeat ("Equity" twice), key by Item Code. |
| 58 / 59 / 1502 | BPM6 standard presentation | 59 labels two different Jan-Mar 2026 values both "(P)" (one is "Jan-Mar2026 (P)"): use 1502. |
| 1076 | Invisibles by category | Detail (receipts, payments) ends a year before the headline; its BPM6 rows repeat 58. Outline labels need their parents ("i) Surplus remitted" appears under sea and air). |
| 982 | IIP | BPM5 (2006-2021) and BPM6 (2017 on) items in one table; BPM6's liabilities section is "B" with no dot. BPM5 Dec 2014: net ≠ assets − liabilities by US$ 8.2 bn (source). |
| 533 / 1503 | IIP summary | About one cell in ten differs from 982 (revision state). |
| 574 | Reserves, weekly | Extra end-March and holiday-shifted dates besides Fridays. The "Volume" providers of 574/53/687/95 run two numbers together; use "Gold Vol". |
| 184 / 415 | Reserves monthly / end-March | Monthly only from March 1990; before that end-March only. 415's "Volume" provider: two unlabelled gold amounts a year. |
| 660 / 603 | External debt, quarterly | The US$ provider has no amount column in the mirror. Ratio lines in the ₹ provider are scaled by a crore and, for some 2017-19 quarters, are amounts. |
| 563 / 570 | External debt, end-March | Ratio lines appear twice for the latest year, once multiplied by the table's unit (a million, or a crore). Column is `ext_debt_code` in 563, `Ext Debt Code` in 570. |
| 584 | REER/NEER monthly | Both providers carry every series. Many short rolling 6-currency bases. Two stray Feb 2026 rows with 6-currency codes under the broad label. "Forecast" is a version label on old months. |
| 380 / 381 | REER annual | Display orders 5 and 6 are mis-filed 6-currency values; use 1402/1403. |
| 698 | Daily forward premia | "Reference Rate" mixes the dollar and the euro on one day, no currency column. |
| 768 | Month high/low | The "Max" provider holds both highs and lows; the "Min" provider is the daily reference rate. |
| 720 | 155 currencies | One code, two names (SKK "Slovak koruna" and "koruna", different rates). |
| 719 / 1374 | Monthly rates | 719 quotes the yen per single yen; 1374 per 100. LERMS (Mar 1992 to Feb 1993): 719 official rate, 1374 market rate. |
| 730 / 14 / 92 | RBI dollar sales and purchases | Net, ₹ equivalent and cumulative lines carry no item description: key on the outline (Item Hierarchy Level1). The "Sale_inr" provider is a cell-for-cell copy of "Sale_dollar", not rupee values. March 2014: the sale cell repeats the purchase (9,462); the published net is 7,782. |
| 290 | FDI annual | The "USD NEW" provider labels its rows "INDIAN RUPEES"; the amounts are US$ (₹ provider / US$ provider ≈ 87.6 for 2025-26). |
| 691 | Interbank daily | Zeros for days without a quote; one misprint (3,355.73). |
| 1347 / 694 | FX turnover | Sep 2018 grand total ≠ merchant + inter-bank (source). Daily sums do not equal the monthly table. |
| 55 | ECB | Lines carry the classification's effective dates: the 2019 classification runs to Feb 2026 beside the Jan 2025 one. |
| 1550 / 1551 | Rupee invoicing | Fiscal year to date; months missing. |
| 1384-1394 | International banking statistics | Measures named only "Measure 1..9": not baked. |
| 696 | MF foreign assets by country | Tables named only by number: not baked. |

Copies of the same table under other menus (Handbook, Bulletin, WSS) are checked cell by cell
by the catalogue generator; every claimed copy matched (1505 at 99.85%, its one extra month).
