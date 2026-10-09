# World Bank (WDI, PIP) and UN WPP: what we learned about the sources

Written 2026-10-09 by the worldbank family session. Adapters: `scripts/lib/products/wdi-india.mjs`,
`pip.mjs`, `wpp.mjs`, `worldbank-wdi.mjs`; transport `scripts/lib/worldbank.mjs`.

## api.worldbank.org: the firewall

- The host sits behind a WAF. A burst of requests (about ten in a few seconds), any `source=`
  query parameter, or a `;`-joined indicator list returns an HTML "5xx Error Page" with HTTP
  200, and then the client IP is blocked on every path, PIP included, for several minutes.
- Sessions on this machine share one IP, so another session's burst can block yours.
- On 2026-10-09 a single indicator call took about 20 s.
- `worldbank.mjs` spaces calls 1.5 s apart, treats an HTML answer as a block, waits 300 s,
  doubles the gap and retries (up to 6 times). Never use `source=`; list a source's
  indicators with `/v2/sources/<id>/indicators` (works) not `/v2/indicator?source=<id>`
  (blocked). `/v2/sources/40/indicators` (population projections) is blocked outright.

## WDI for one country: the bulk file

- `https://api.worldbank.org/v2/en/country/IND?downloadformat=csv` returns a 600 KB zip:
  `API_IND_DS2_en_csv_v2_<n>.csv` (every WDI indicator for India, years 1960 to the latest
  as columns, a "Last Updated Date" line at the top) and `Metadata_Indicator_...csv` (name,
  source note, source organisation). One request instead of 1,500.
- 2026-10-09: 1,498 indicators listed, 1,395 with at least one India value. The list from
  `/v2/sources/2/indicators` matched the file exactly; the adapter checks this every run.
- The file's Last Updated Date (2026-10-08) was newer than `/v2/sources` (2026-07-13): per
  indicator envelopes carry their own `lastupdated`, and the source-level stamp lags.
- WDI is a republisher. Population and vital rates are UN WPP (WDI runs WPP's estimates into
  its medium projection without a break in 2024 and 2025); urban shares are UN World
  Urbanization Prospects 2018 (projections after 2018); poverty and distribution are PIP, but
  WDI joins survey rounds PIP marks as not comparable into one series and rounds to one decimal.
  The `wdi-india` adapter discloses each of these in the bundle notes.
- WDI calls India's distribution shares "income share"; for India they are consumption.

## PIP (api.worldbank.org/pip/v1)

- Same host, same firewall. Plain JSON arrays, no envelope. `pip?country=IND&year=all&povline=<x>`
  gives every survey at one line; `fill_gaps=true` gives the lineup (every calendar year).
- `versions` lists releases; the current 2021 PPP release on 2026-10-09 was `20260922_2021_01_02_PROD`.
  `aux?table=poverty_lines` lists lines; the visible ones are $3.00 (default), $4.20, $8.30.
- India: nine surveys, national level only (no rural or urban rows, for any line or version
  tried), welfare type consumption. `comparable_spell` groups them: 1977, 1983, 1987,
  1993-2009, 2011, 2022-2023. `survey_acronym` NSS, NSS-SCH1, NSS-SCH2, HCES.
- Identity that holds exactly: `survey_mean_lcu` (aux `survey_means`) = `mean` x `ppp` x `cpi`.
  `ppp` for India is 19.469 rupees per 2021 PPP dollar; `cpi` is relative to 2021.
- Lineup rows carry `estimation_type` (survey, interpolation, extrapolation) and
  `estimate_type` (actual, projection, nowcast). Survey-year lineup values are calendar-year
  aligned and differ from the survey reading.
- Bulk files exist on the Data Catalog (dataset 0063646, percentiles, 100 bins per survey),
  but its API (datacatalogapi.worldbank.org) answered 429 to every call that day.

## UN WPP 2024 (population.un.org)

- Standard CSV files, gzip, all locations; India is LocID 356. Demographic indicators
  (medium, 16.5 MB gz; other variants, 75 MB gz) and population by five-year age group and
  sex (30 MB gz). The UN data portal API needs a token; the CSVs do not.
- Estimates run 1950 to 2023, the medium projection 2024 to 2100; a 1 January 2101 row
  carries only the closing stock.
- Defect: in the five probabilistic-interval variants (Median, Lower/Upper 80 and 95 PI),
  LE15, LE65, LE80 and the Q5/Q0040/Q0060/Q1550/Q1560 columns carry impossible values
  (life expectancy at 15 of about 1.5 years; mortality 1,000 per 1,000), for India and China
  alike. The adapter skips those cells (`sources.yml` population.fetch.defects).
- WDI's SP.POP.TOTL equals WPP's 1 July total to the person in all 66 years.
- No WPP 2026 files on 2026-10-09 (404 for `WPP2026_*`); WDI's October 2026 update still
  carries WPP 2024.
