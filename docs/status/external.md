# external: status

Family session for the External account guide, rebuilt on DBIE (the owner's Data Bank mirror,
read only). Branch `lb/external`, preview port 4401. Updated 2026-10-09.

## State

Done. The guide is at `/guides/external/`: 12 sections and 19 plates, with prose, the every-cut
table and GuideData. It draws on 93 `external-*` bundles from three adapters. Build, `npm run
gates`, `npm test` (27/27) and `prose:dry` are green. The IDH cross-check matches on 14 of the 19
external pairs; the five flags are explained below.

launch-build has moved past my last merge (428204b). I have not merged again because nobody
asked me to. Merge when told.

## What was built

- **Adapters** (all read the Data Bank, never RBI live):
  - `scripts/lib/products/external-bop.mjs`: BoP, invisibles and IIP.
  - `scripts/lib/products/external-flows.mjs`: reserves, the RBI's dollar desk, the FX market,
    rupee rates, FDI and FPI, ECBs, LRS, NRI deposits, invoicing, external debt, assistance and
    mutual funds.
  - `scripts/lib/products/external-reer.mjs`: REER and NEER, one bundle per base and basket.
  - Shared reader: `external-dbie.mjs`. It reads every provider of a report, keeps the ACTUALS
    unit copy, ranks versions and keeps earlier versions as vintages.
- **Raw archive**: `data/raw/external-dbie/*.json`, compact, with duplicate columns stored as
  pointers.
- **Catalogue**: `node --max-old-space-size=20000 scripts/lib/products/external-dbie.mjs --catalogue`
  takes about ten minutes. It covers every external-sector report in the DBIE inventory (123
  reports, about 8,300 items). Copies of a table under another menu (Handbook, Bulletin, WSS)
  are checked cell by cell against the baked report.
- **Revisions**:
  - `external-bop-vintages`: first against latest estimate of the headline lines, report 56.
  - `external-bop6-vintages`: the earliest estimate of every BPM6 line. Report 58 keeps only
    the latest versions; report 1076's BPM6 rows still carry the earlier ones. Every cell the
    two share agrees.
  - Plate §12 "How the balance of payments revises".
- **Seams**:
  - BPM5 and BPM6 are separate bundles, never spliced. IIP BPM5 runs 2006 to 2021, BPM6 from
    2017.
  - Seven REER bases are registered in `sources.yml` seams, each in its own bundle.
  - No chart on the page crosses a seam (each plate draws one ruler), so no `seamMarks` are
    needed.
  - The reserves plates say plainly that reserves move with valuation, not only with RBI
    trading (§07 "Reserves do not move only when the RBI buys or sells").
- **LERMS**: the rupee plate's source note says report 719 carries the official rate for March
  1992 to February 1993 (₹25.89 to ₹26.20). The market rate (₹29.46 to ₹32.65) is in report
  1374, `external-rupee-sdr`.
- **Retired**: rbi-forex, rbi-bop, rbi-bop-ratios, rbi-debt, rbi-debt-quarterly, rbi-nri,
  rbi-invisibles, rbi-exchange-rates, rbi-forward-premia, rbi-intervention and rbi-fx-turnover.
  The bundles are deleted and their raw dumps kept. `rbi.mjs` no longer writes them.

## Decisions

- Merchandise trade detail is the trade session's, and services by category the services
  session's. `rbi-trade*` and `rbi-commodities*` stay baked for the trade session's
  cross-check; this guide does not draw them.
- **BPM6 rupee lines** are baked from report 1502, not 59: 59 labels both January to March 2026
  values "provisional".
- **Quarterly US$ external debt** comes from DBIE Data Query element EXT_DBT_RT_RN, because the
  report 660 US$ provider has no amount column in the mirror. End-March debt comes from report
  563, and the two agree within 0.5% (validate).
- **Report 730 (RBI dollar sales and purchases)**:
  - The net is now the published line. It was previously derived.
  - Its "Sale_inr" provider is a cell-for-cell copy of the dollar provider (2,618 of 2,618
    cells). The old `external-intervention-inr` had read it as rupees, which was wrong. That
    bundle now carries the table's real rupee lines: the ₹ equivalent of the net, and the
    cumulative figure.
  - One rupee misprint, the September 2015 cumulative of 4,489,551, is left empty and disclosed.
- **Annual REER tables (380/381)** are not averages of the monthly figures, so they are baked
  as published. Their display-order 5 and 6 rows are mis-filed 6-currency values and are
  excluded. The 6-currency annual index comes from 1402/1403.

## Blocked (recorded in the ledger)

- `dbie:660:usd:*`: the US$ provider has no amount column in the Data Bank mirror (seen
  2026-10-08). A Data Bank parse issue for the owner. The data is covered from EXT_DBT_RT_RN
  and 563.
- **Currency composition of external debt**: not in any in-scope DBIE report. We do not show it.

## Hand checks

- Every bundle had one latest value traced to its raw DBIE row (scripted trace, the five
  misses checked by hand). Examples:
  - goods exports, Q1 FY27, 131,957.569: report 56, Credit, Provisional;
  - current account FY 2025-26, −25,364.726: report 875, Revised;
  - net FDI FY 2025-26, 6,947.431: report 290;
  - merchant forward cancellations, July 2026, 7,668.653: report 1347.
- Against the RBI's own publications:
  - Q1 FY27 current account −4,241.2 (report 56); the BPM6 table gives −4,219.2 by design.
  - FY 2024-25 CAD/GDP −0.58%, against "0.6 per cent" in the RBI press release of 27 June 2025.
  - Reserves on 11 September 2026: WSS 780,782, bundle 780,781.84.
  - Every Handbook, Bulletin and WSS copy matched cell by cell (1505 at 99.85%, one extra
    month).
- IDH (`data/crosscheck/idh.yml`, block marked external; ids only, no values):

  | Bundle | IDH series | Result |
  |---|---|---|
  | external-rupee usd | FMFXUSDINA11M | flag, expected: LERMS months; a dozen later months differ by 0.01 to 0.03 between RBI tables |
  | external-rupee-sdr usd_avg | FMFXUSDINA11M | 8 months off by up to 0.07 |
  | external-intervention purchase, sale, net, forward_outstanding | FMFXRGPFXD11M, FMFXRGSFXD11M, FMFXRNPFXD11M, FMFXFWORNL00M | match |
  | external-forward-premia m3, m6 | FMFXFPRD3M11W, FMFXFPRD6M11W | match |
  | external-forward-premia m1 | FMFXFPRD1M11W | 3 of 176 months off by up to 0.64 |
  | external-reer-2015 REER/NEER, trade and export | FMFXERRTTR16M, FMFXERRTEX16M, FMFXERNTTR16M, FMFXERNTEX16M | match |
  | external-reer6-2015 | FMFXERRSTR16M, FMFXERNSTR16M | match |
  | external-fdi gross inflows | EXBPCDIFDI11M | match |
  | external-fdi direct investment to India | EXBPNDIFDI11M | match |
  | external-fdi FPI | EXBPNDIFII11M | match from April 2011; March 2011 differs (format change in report 34) |
  | external-fdi equity | EXBPCDIDIE11M | match from April 2011; March 2011 differs (format change in report 34) |

  EXBPNDIFPI11M matches no single line of report 34 and is not paired.

## Source quirks

All are in `docs/reference/dbie-external.md`. The new ones today:

- **730**: the "Sale_inr" provider is a copy of the dollar provider; the March 2014 sale cell
  repeats the purchase figure; the net line carries no item description.
- **290**: the "USD NEW" provider labels its rows "INDIAN RUPEES".
- **1076**: its BPM6 rows keep revisions that 58 has dropped.

## For the coordinator (shared files touched, all in external blocks)

- **Shared files**: registry.js, headline.js (external headline: current account, US$ bn a
  quarter), og.mjs (card draws weekly reserves), qc.mjs PAGES (16 checks), validate.mjs (the
  products and identities block), asof-manifest.json, slots.yml, series-kws.mjs, everycut.js
  UNITS, sources.yml, crosscheck/idh.yml.
- `pipeline/facts.mjs`: one `if (slug === "external")` block.
- `src/dossiers/register.client.js`: the external rows now read the DBIE bundles, and the trade
  rows are removed (they belong to the trade guide).
- **pipeline/verify.mjs traces only percents and points.** Dollar amounts, rupee rates and index
  levels in prose are never checked (it reported "0 figures" for a paragraph of US$ amounts). I
  checked every number in both external prose files against facts-external.json by script and
  read each claim against the bundles: all correct. Worth widening the verifier for every guide.
- **Mobile charts (all pages, not only external)**: at 390px the plates draw at 1184px inside a
  scrolling plotzone and open at the oldest end, so a reader first sees 1993 to 2003 on a
  rupee chart that runs to 2026. Worth opening scrolled to the latest end; that is in shared
  chart code, which is not mine to change.
