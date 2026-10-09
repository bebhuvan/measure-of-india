# TradeStat (Ministry of Commerce): India's merchandise trade by HS code

Probed live 2026-10-09. TradeStat (`https://tradestat.commerce.gov.in/`) is the Department
of Commerce's public front end to DGCI&S customs data: the Export Import Data Bank
(EIDB, annual) and the Monthly Export Import Data Bank (MEIDB), plus principal-commodity
and export-promotion-council views. It is the official source the monthly trade press
release is drawn from, it is current to the latest released month, and it is free. UN
Comtrade carries the same customs data but months late, so the Atlas uses TradeStat as the
source of record for commodity and partner detail, and RBI DBIE (the Data Bank mirror)
for the long headline history.

DGCI&S's own portal (`ftddp.dgciskol.gov.in`, the Foreign Trade Data Dissemination
Portal) returned 404 on the probe date and sells tariff-line data under registration;
`www.dgciskol.gov.in` serves classification files (ITC-HS 2012/2017/2022 PDFs, the
principal-commodity to HS mapping workbooks `QE_PC_HS_Mapping_<year>.xlsx`). We use those
mapping files to group HS lines into principal commodities when TradeStat's own grouping
is not enough.

## How a query works

Every view is a Laravel form. There is no API and no JavaScript data call for the tables:

1. `GET` the form page with a cookie jar. It sets a session cookie and embeds a CSRF token
   in `<input type="hidden" name="_token" value="...">`.
2. `POST` the same URL with the token, the cookie and the form fields (urlencoded).
3. The response is a full HTML page with one `<table>`; every row is a `<tr>` with `<td>`
   cells. The last data row is the total ("India's Total Export"). Numbers carry Indian
   or Western comma grouping and must go through `scripts/lib/tabular.mjs`.

A token is single-use in practice: after a failed POST (500) the next POST with the same
token returns 419 (CSRF expired). Fetch a fresh form page before every POST.

Speed: one month of exports at HS 8-digit (11,089 rows, 7.9 MB of HTML) returned in
1.6 seconds. Be polite anyway: one request at a time, the `net.mjs` throttle.

## Fields (the trap is that each form names them differently)

**EIDB annual commodity-wise** (`eidb/commodity_wise_export`, `eidb/commodity_wise_import`):

| Field | Values |
|---|---|
| `EidbYearCwe` | financial year start: `2018` … `2025` (2025 = 2025-26) |
| `comType` | `all` (all commodities) or the `commodityType=specific` path with `hscode_value` |
| `EidbComLevelCwe` | `2`, `4`, `6`, `8` (HS digits) |
| `Eidb_ReportCwe` | **`2` = US$ million, `1` = ₹ crore, `3` = quantity** |

Response columns: S.No., HSCode, Commodity, previous year value, %share, year value,
%share, %growth. Two years per call, so one call per year gives revisions too.

**MEIDB monthly commodity-wise** (`meidb/commoditywise_export`):

| Field | Values |
|---|---|
| `ddMonth` | `1` … `12` |
| `ddYear` | calendar year of the month, `2018` … `2026` |
| `comlev` | `all` (required; omitting it returns HTTP 500) |
| `ddCommodityLevel` | `2`, `4`, `6`, `8` |
| `ddReportVal` | **`1` = US$ million, `3` = ₹ crore, `2` = quantity** (codes differ from EIDB) |
| `ddReportYear` | `1` = financial-year cumulation, `2` = calendar-year cumulation |

The import form (`meidb/commoditywise_import`) uses the same fields with an `im` prefix
(`imddMonth`, `imddYear`, `imddCommodityLevel`, `imddReportVal`, `imddReportYear`).

Response columns: S., HS Code, Commodity, same month last year **(R)**, this month **(F)**,
% growth, cumulative last year (R), cumulative this year (F), % growth. The flags are the
revision state the ministry prints (R is revised; read F's meaning from the page's own
footnote before relying on it). Store the flag per value, never drop it.

Latest month on 2026-10-09: **July 2026** (exports US$ 44,302.74 million; Apr-Jul 2026
US$ 171,758.42 million). Annual 2024-25 exports: US$ 437,704.58 million.

## The full set of views (from the site's navigation)

EIDB (annual): `commodity_wise_export`, `commodity_wise_import`,
`chapter_wise_all_commodities_export`, `commodity_wise_all_countries_export`,
`commodityx_countries_wise_export`, `country_wise_export`, `country_wise_all_commodities_export`,
`country_wise_ttrade`, `region_wise_export`, `region_wise_all_countries_export`,
`region_wise_all_commodities_export`, `predefined_group_of_countries_export`,
`customised_group_of_countries_export`.

MEIDB (monthly): `commoditywise_export`, `commoditywise_import`,
`commodity_wise_all_countries_export`, `country_wise_export`,
`country_wise_all_commodities_export`, `country_wise_principal_commoditywiseall_hscode_export`,
`principal_commodity_wise_all_HSCode_export`, `region_wise_export`,
`region_wise_all_countries_export`, `region_wise_all_commodities_export`,
`predefined_group_of_countries_export`, `customised_group_of_countries_export`.

FTPA (principal commodity groups): `export_commodity_group_new`, `import_commodity_group_new`,
`export_matrix_new`, `export_region_wise`, `export_region_xcountry_wise`,
`export_top_n_commodities_new`, `export_top_n_countries`.

FTSPCC (export promotion councils): `export_commodity_wise`, `import_commodity_wise`,
`export_commodity_wise_all_countries`, `export_commodity_wise_fiveyears`,
`export_commodity_xCountry_nxn_matrices`, `export_commodity_xcountry_wise_annual`,
`export_commodity_xcountry_wise_monthly`, `export_country_wise`,
`export_country_wise_all_commodities`, `export_region_wise`, `export_region_wise_all_commodities`,
`export_region_wise_all_countries`, `export_customised_group_of_countries`,
`export_predefined_group_of_countries`, `ttrade_country_wise`.

Field names for the country, region and FTPA forms were not probed; map them from each
form's `<select name>` and `<option value>` before writing that part of the adapter
(capture a browser submission with Playwright if a field is set by script, as `comlev` was).

## History

The year pickers start at 2018 (2018-19 for EIDB, January 2018 for MEIDB). Earlier
commodity detail is not on TradeStat today. Long headline history (exports, imports,
balance, oil and non-oil; the RBI Handbook's annual tables reach back to the 1950s, span
to be confirmed per report) comes from RBI DBIE through the Data Bank; the two are different publications of one customs record and
are shown as such, never spliced.

## Value checks still to do before charting

- 2023-24 chapter values in the 2024-25 annual call look high against published sector
  totals (chapter 03, fish, 12,248 against roughly 7,400 reported for marine exports).
  Before baking, reconcile chapter sums to the printed total, compare one year's chapters
  across two calls (the 2023-24 column of the 2024-25 call against the 2023-24 call), and
  check five chapters against the DGCI&S quick-estimates release.
- HS revisions (HS 2017 to HS 2022 in April 2023) change 6 and 8 digit codes. A code
  series across that change is a seam; the 2 and 4 digit levels are stable enough to run
  through, the 8-digit level is not.
