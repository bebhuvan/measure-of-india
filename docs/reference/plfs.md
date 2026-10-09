# PLFS on the eSankhyiki API: what we learned (2026-10-09/10)

Source: MoSPI, NSO, Periodic Labour Force Survey, `https://api.mospi.gov.in/api/plfs/*`.
Client: `scripts/lib/mospi.mjs` (legacy TLS, one request at a time, 350 ms gap, backoff, an
on-disk response cache). Adapter: `scripts/lib/products/plfs.mjs` (curated bundles),
`plfs-cube.mjs` (fetch and archive), `plfs-deep.mjs` (every other cell).

## Listing calls

- `plfs/getFrequency`: 1 annual, 2 quarterly, 3 monthly.
- `plfs/getIndicatorListByFrequency?frequency_code=`: annual 1-8, quarterly 1-4, monthly 1-3.
  1 LFPR, 2 WPR, 3 UR, 4 percentage distribution of workers, 5 per cent of regular wage/salaried
  employees by employment condition, 6 regular wage (₹/month), 7 casual wage (₹/day, other than
  public works), 8 self-employment gross earnings (₹/30 days).
- `plfs/getFilterByIndicatorId?indicator_code=&frequency_code=`: the dimensions. Indicator 5
  lists no `year_type` (agriculture years only); the catalogue generator used to give it no
  items at all because of that (fixed 2026-10-10).

## getData: ask unfiltered

`plfs/getData?indicator_code=&frequency_code=&year=[&year_type_code=]&page=&limit=100` with
**no other filter** returns every cell the source holds for that indicator-year: for
indicator 3, 2023-24, 5,139 rows against 57 for the headline filter (All India, person, 15+).
Filters behave inconsistently (indicator 4 returns nothing with an age or gender filter; the
monthly bulletin defaults the sector to rural + urban unless `sector_code` is sent), so the
adapter never filters: it archives everything and cuts client-side. `limit` is capped at 100.

Row shapes:
- 1-3 annual: state (37 incl. merged DNH & DD; the two pre-merger UTs to 2019-20) x gender x
  sector x {age 15+, 15-29, 15-59, all ages} x weekly status, plus education (9 levels) on
  usual status only, and religion (4) and social group (4) at All India, usual status only.
- 1-3 quarterly: original design 2018 Q2 to 2024 Q4, urban only, 22 states + All India x
  gender x age (15+, 15-29, all ages); revamped design from Apr-Jun 2025, rural, urban and
  both. Jan-Mar 2025 was never published (the design change).
- 1-3 monthly: from Apr 2025, All India x gender x sector x age (15+, 15-29, all ages).
- 4 annual: status, broad industry (CWS too), NIC section, NCO division, NIC group crossed
  with status, enterprise type and size; All India and every state. Calendar years carry a
  smaller set. 4 quarterly: broad industry by state, gender, sector; the same table is
  labelled `nic_group` in some quarters and `broad_industry_work` in others.
- 5: state x gender x sector x 4 conditions, agriculture years 2017-18 to 2023-24 only.
  It answered HTTP 500 on every call until at least 2026-08; retested 2026-10-09: served.
- 6-8 agriculture years: state x gender x sector x quarter; calendar years: annual.
- `year` for calendar years is `2022`...; the API answers a year it does not hold with no
  rows (2026, asked 2026-10-10).

## Defects found (all quarantined in plfs-deep.mjs, disclosed on the series)

- **OCR debris in values**: `l0.8`, `IS.2`, `II.8`, `t2.3`, `S.6`, `20. I`, `16?`, `11&`,
  `20J`, plus `-`, `**`, `nan`, `NaN` (mostly the old quarterly bulletins, 2019-2022).
  `parseFloat` reads `20. I` as 20 and `16?` as 16: never use it on this source. Values are
  read strictly; anything else is not published here.
- **Impossible values**: quarterly WPR 415, 418, 464, 710, 712; UR 213, 459, 463.
- **Apr-Jun 2019, quarterly**: the UR column is a mislabelled copy (All India urban UR 21.6
  where the bulletin says 8.9); 95 of 198 state cells break UR = 1 - WPR/LFPR.
- **Jul-Sep 2025, quarterly LFPR, states**: labels shifted one row from Jammu & Kashmir on.
  The bulletin's Table 2 prints J&K last; the API maps the rows onto an alphabetical list.
  Bulletin Kerala 15+ person LFPR: rural 52.4, urban 49.8, all 51.1; the API's "Kerala" serves
  63.3, 49.4, 59.4 (Madhya Pradesh's row). WPR and UR are correctly labelled. Whole state
  table withheld (349 of 594 cells break the identity).
- **Oct-Dec 2020, quarterly**: Assam and Madhya Pradesh rows break the identity throughout
  (WPR rows apparently swapped); withheld cell by cell.
- **LFPR 0**: cells with no sampled person (Chandigarh rural, small UTs by education level).
- **Indicator 4, calendar years**: the contract-condition table is served with its
  `employee_contract` label missing (four unlabelled values per cell). Not usable.
- **Indicator 4 rows dropped `employee_contract`** for agriculture years too (by 2026-10).

## Two designs

MoSPI, "Changes in Periodic Labour Force Survey from 2025" (2025): the sample design was
revamped from January 2025 (rotational panel in rural and urban areas, monthly and rural
quarterly estimates, calendar-year annual estimates); the sample design and estimation
procedure "used in PLFS upto December 2024" are Appendix D of the 2023-24 annual report.
Calendar-year unit data for 2022, 2023 and 2024 was released from the original design.
So: original design = agriculture years, calendar years 2022-2024, urban quarterly to
Oct-Dec 2024; revamped = monthly, quarterly from Apr-Jun 2025, calendar year 2025 on.
Registered in `data/sources.yml` `seams: plfs`.

## Hand checks

- Quarterly Bulletin Oct-Dec 2025, para 2.6.2: UR (CWS, 15+) 4.8 all, 4.0 rural, 6.7 urban;
  `plfs-q25` matches.
- Quarterly Bulletin Jul-Sep 2025, Table 3: Kerala WPR 15+ person all areas 47.1; matches.
- All India regular wage, calendar 2024, person, rural + urban: 21,454.87 (`plfs-cy-earnings`).
