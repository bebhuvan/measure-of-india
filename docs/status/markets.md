# Status: markets (savings, markets and companies)

Branch `lb/markets`, port 4435. Guide `/guides/markets/`. Inventory items R11, R12, R13.

## Done

- **Adapters** (all read-only on the Data Bank; one display unit kept per DBIE report):
  - `scripts/lib/products/markets.mjs`: household financial flows and stocks (1225, 1226, 246),
    mutual funds (126, 1359, 1360, 1361), gold and silver (17, 108), Euro issues (1356), market
    capitalisation (1350, 1351), turnover (990, 1352), derivatives (1357), daily exchange data
    (658, 680); and, as its own builder, new capital issues (1355 monthly, 277 annual).
  - `markets-companies.mjs`: every RBI company finance study the Data Bank holds: public limited
    (1172 to 1208), private limited, FDI companies (1146 to 1196), NBFCs (731 to 754), listed
    half-yearly (1075). 140 bundles, ~50,000 series.
  - `markets-hub.mjs`: Survey of Professional Forecasters (1475) and the 20 listed-company SDMX
    tables, from the RBI Innovation Hub.
  - `markets-catalogue.mjs --catalogue`: 22,948 items from the Data Bank inventory and rows and
    the Hub catalogue.
- **192 bundles** (`markets-*`), registered in `data/sources.yml` (entries `markets`,
  `markets-issues`, `markets-companies`, `markets-listed`, `markets-spf`), seams registered.
- **validate**: generic checks on every bundle, plus the RBI tables' own arithmetic (issues
  subtotals, gold spread, household net = assets − liabilities, every company balance sheet
  balances study by study, listed EBITDA and EBIT identities, SPF median inside its range) and
  eight values pinned to RBI publications.
- **Coverage**: `data/coverage/markets.yml`, clean under `--strict`: 1,335 shown, 21,499
  baked, 101 excluded, 13 blocked, 0 pending.
- **Guide**: 19 plates in 15 sections, every-cut table (57,569 series, three long-tail
  families), GuideData, OG card, registry, headline, qc PAGES, asof entries, prose slots,
  corpus, facts block (`cross.lakhCrore`, `cross.per100`, `cross.year`, `cross.markets`) and the
  series keyword map. Prose generated and read against the facts sheet: every figure matches.

## Hand checks (all recorded in the adapter headers)

| Bundle | Value | RBI publication |
|---|---|---|
| markets-hh-flows | Oct-Dec 2025 net ₹4,22,796.8 crore, 4.6% of GDP | Bulletin table 52 (Id 24362) |
| markets-co-public-growth | 2024-25 net sales +7.8%, 7,992 companies | press release 30 Mar 2026 |
| markets-listed-q | Oct-Dec 2025 sales +10.1%, 3,188 companies; sectors 11.4/8.8/10.6 | release 25 Feb 2026 |
| markets-spf | round 101 (Jul 2026) GDP 2026-27 median 6.6 | 101st round results |
| markets-issues | Apr 2024 equity ₹25,371 crore, 35 issues | Bulletin, new capital issues |
| markets-gold-annual | 2025-26 Mumbai ₹1,18,420.9 / 10 g | Handbook table 35 |
| markets-mf-aum | Mar 2026 ₹73.73 lakh crore | AMFI March 2026 note |

## Decisions (for HISTORY.md)

- **Index levels excluded, market size baked.** Sensex, Nifty, BSE 100, foreign indices and the
  Sensex P/E and P/B (693, 728, 726, 802, 898, 1353, 477, 478, 1358, and the Hub's index
  SDMX) are excluded as licensed index products. Market capitalisation, turnover, derivatives
  turnover and new issues are exchange statistics, not index products: baked and shown. The
  owner can overturn this; the ledger rule is one line.
- **Company studies are never chained in levels.** Growth rates and ratios for year t come from
  year t's own study (the bundle without suffix); the same study's figure for the year before is
  in `-prior` bundles; rupee levels are one series per item per study (`__sYYYY`).
- **Two formats, two rulers.** Old reporting format (studies to 2018-19, `-2011` bundles) and
  Ind AS (studies from 2020-21; there is no 2019-20 study). Plates draw them with seamMarks.
- **SPF base seam at round 99** (the RBI's own disclaimer on report 1476): `-2019` bundles for
  rounds 61 to 98. Round dates are inferred from the bimonthly schedule (round 61 = Nov 2019)
  and checked against each round's first forecast quarter; the RBI's round 101 release confirms
  July 2026 and round 100 May 2026.
- **Household financial saving lives here.** Reports 1225, 1226, 246 were unclaimed and are the
  core of "where savings go". The nas brief mentions household financial saving "if served":
  link from `gdp` to this guide rather than baking twice.
- **CP and CD**: drawn from the rates family's `rates-cp` and `rates-cd` (read only).
- Listed-company levels: each quarter is a different set of companies, so the `-levels`
  bundles are baked but never drawn as lines.
- Guide number "26" (sequential on this branch); renumber at merge if another wave guide took it.

## Source quirks found

- 1355 carries two layouts; items 61 to 64 are zero in every month 2011 to 2022 (excluded);
  November 2024 debentures do not add up as printed; the annual 2023-24 IPO line (₹3,856 crore)
  equals March 2024's month, not the year (months add to ₹65,832 crore).
- Report 17's Item Code column is misaligned with its descriptions; series follow descriptions.
- The monthly market capitalisation table carries a month-to-date row for the current month;
  held back until the month closes.
- Company count tables (e.g. 1173) hold one unlabelled row per size class; their sum is the
  RBI's total (7,992 for 2024-25).
- The Hub's quarterly listed-company sector table tags services' "other expenditure" rupee
  levels as per cent (94 rows): moved to levels, noted on the series.
- The Hub's SPF export repeats round 101 in the slots of rounds 64, 71, 75, 78, 84, 86, 94, 100
  (blocked); its export of report 1476 has no rows.
- Hub code lists are served by DSD code (`/api/codelists/PRF_LNGNFC_QTR_RN`), not by
  dimension name: worth adding to `docs/reference/rbihub.md`.
- Report 1357 prints every NSE instrument (and BSE index futures) in March 2011 at some 230
  times the months either side: flagged as `anomalies` on the series, kept as printed, left off
  the turnover plate with a footnote.
- Report 1361 stopped printing its total row: the page sums the fund houses and says so.
- SPF wording changed with the base: "GDP at constant (2011-12) prices" before round 99.
- **Privacy**: Data Bank report 273 (UCCS unit-level, 2010-14) holds respondents' names,
  addresses and phone numbers. Excluded here; the Data Bank owner may want to know.

## Blocked

- Household inflation expectations (IESH 271), urban and rural consumer confidence (272, 1478),
  SPF individual responses (1473): prompt-gated in DBIE, absent from the Hub (2026-10-10).
- Freshness: the Hub's listed-company tables end Oct-Dec 2025 (loaded 2026-09-18), behind the
  RBI's June 2026 release; the Data Bank's household flows hold the first print of Oct-Dec 2025
  (a later Bulletin revised it to ₹4,31,039.9 crore). Rebake when the mirrors refresh.

## IDH series (for the coordinator's cross-check)

Names only, from the Data Bank's `india_data_hub_series` (no values used):
- `MOINGOINRS11M:IND` Average Price of Gold in India ↔ `markets-gold.gold_mumbai`
- `MOINGOGLRS11M:IND` / `MOINGOGLUS11M:IND` international gold price (₹ / US$) ↔ `markets-gold.gold_london_inr` / `gold_london_usd`
- `CMEQCRNTOT11M:IND` Number of equity capital issues in the month ↔ `markets-issues.equity_n`
- `CMMFAUMTOT11M:IND` AUM of all mutual funds (monthly; compare March) ↔ `markets-mf-aum.aum`
- `CMMMCPMNIR11F:IND` / `CMMMCPMXIR11F:IND` CP yields ↔ `rates-cp` (the rates family)

## Next (after merge)

- Rebake when the Data Bank and the Hub refresh (listed companies past Dec 2025; revised household flows).
- Link from `gdp` (household saving) and `rates` (CP/CD) to this guide.

Nothing outstanding on the bar. Final check (2026-10-10): `npx astro build` and `npm run gates`
green (validate, coverage --strict, asof, QC, chart lint clean), `npm test` 52/52,
`npm run prose:dry` green. Looked at every plate at 1440 and 390 over four rounds (fixed: bar
labels colliding with row names, tick clutter, the log-scale floor, quarter-named subtitles, the
fund-house total, the SPF plate redrawn as "year in progress / year ahead" per ruler, end labels
running past the frame). Share image downloaded from the page (cb-flows PNG) and read.
