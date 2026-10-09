# Services: what the sources serve, and their quirks

Notes for whoever maintains the services guide (`scripts/lib/products/services.mjs`).
Checked live on 2026-10-09.

## MoSPI, trial Index of Services Production (`isp/getISPRecords`)

- 19 sub-sectors, base 2024-25 = 100. Monthly from April 2025; one annual year (2025-26).
- Monthly rows carry no month field: fetch per `month_code` (1 = April .. 12 = March) and read
  the row's financial-year label. `frequency_code: 1` returns the annual rows. Never send `year`.
- Rows carry `growth_rate` from April 2026 (the first month with a year-ago level). The adapter
  computes y/y from the index and keeps the published rate as a crosscheck (agrees within 0.15).
- Method (first release, 14 July 2026): GST returns for most sub-sectors; administrative data
  for railways, air, water freight, banking and insurance; weights from ASISSE at NIC 2-3 digit;
  deflators are WPI (wholesale) or the matching CPI (CPI-General for repair, banking,
  insurance; CPI-Services where nothing closer exists). Formal sector only, about 60% of
  services. No overall index until MoSPI has tested the sub-indices. Releases on the 29th.

## MoSPI, National Accounts (`nas/getNASData`, `nas/getNasFilterByIndicatorId`)

- The filter call needs all of `indicator_code, account_code, base_year, series,
  frequency_code`; any missing one gives HTTP 400.
- Annual GVA (indicator 1) has 15 industries and 18 sub-industries; codes 10 to 18 are the
  service sub-industries (1 to 9 are farm and factory). Quarterly has the 8-group table only.
- 2022-23 base: industries to 2025-26 (provisional), sub-industries to 2024-25.
- 2011-12 base: annual to 2025-26 (first advance estimates). The three combined service groups
  (6, 9, 12) are served only at advance and provisional stages, from 2014-15; their parts
  (7, 8, 10, 11, 13, 14) carry the later revised estimates from 2011-12. The two do not add up
  in the same year because they are different vintages. The services total uses the parts
  where all six exist.
- Each year keeps its most mature estimate (the same ranking as `nas.mjs`).

## RBI DBIE, through the Data Bank (`dbieReport`)

- **1501** India's international trade in services, monthly, US$ (receipts, payments, net),
  from April 2018; February 2020 is missing. On 2026-10-09 the DBIE copy ended at May 2026 and
  still carried the first May estimate (33,355 / 17,637), while RBI's 30 September 2026 press
  release had revised May (33,196 / 17,667) and published to August. The DBIE table lags.
- **1076** Invisibles by category, quarterly, two blocks in one report. "BPM6": the standard
  presentation, all of 1.A; services sub-items (computer services, R&D...) are published only
  to March 2021 plus March 2024. "Invisibles Receipts" / "Invisible Payments": purpose-code
  detail, to June 2025. Versions: Preliminary, Provisional, Partially Revised, Final; the most
  mature per period is kept ("Partially Revised" is the RBI's current table for past quarters).
  Each value repeats once per display unit (NUMBER, SECONDS, CRORES...): amounts are US$.
  Defects: the Jan-Mar 2013 purpose-code receipts hold the whole year 2012-13 (quarantined);
  a Preliminary Jan-Mar 2020 value of "23" for computer services is a unit slip (superseded).
  The `Hbs Description` column mislabels Credit as Payments: use `Cdn Description`.
  `dbieReport` splits on every ";" and misaligns rows whose quoted text contains one
  (item 3.4.2.1, 5,232 rows; no services row is affected).
- **807** Invisibles by category, annual, US$, from 1950-51: the older categories (travel,
  transportation, insurance, G.n.i.e., miscellaneous; software, business, financial and
  communication from the 1990s; software values from 1997-98). The 1985-86 services row does
  not add up as published (net 1,187 against 3,316 less 2,124).
- 131 is the same table as 807; 132 and 424 are its rupee version. 1597 to 1601 and 1725 to
  1727 are state value added in services (Handbook of States): the states guide's.

## MoSPI, PLFS indicator 4 (`plfs/getData`)

- Percentage distribution of workers. Rejects age, gender and sector params; fetch per year,
  unfiltered. Agriculture years `year_type_code: 1` (2017-18 to 2023-24), calendar years
  `year_type_code: 2` (2023 to 2025). Cuts served: NIC section (21), NIC group, status within
  group, enterprise type and size (non-farm), NCO division, broad industry (CWS).
- Lone NIC-group rows are the 100% totals of the status-within-group table.

## MoSPI, ASUSE (`asuse/getAsuseRecords`)

- Twelve indicators carry the activity dimension (1, 3, 6, 10, 12, 14, 16, 22, 26, 30, 32,
  34): about 28,000 rows a round, 100 a page. Rounds: 2021-22, 2022-23, 2023-24 (financial
  years) and 2025 (calendar year; hours worked, indicator 16, not served for 2025).
- Indicator 34's HWE and OAE rows are mislabelled (found by the factories adapter): baked for
  all establishments only.

## India Data Hub

No IDH series in the Data Bank's mirror matches these bundles (checked 2026-10-09). Its
"services" entries are bank credit to services (credit guide) and UPI by merchant category
(payments).
