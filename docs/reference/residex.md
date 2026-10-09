# NHB RESIDEX: reverse-engineering notes (2026-10-09)

Site: https://residex.nhbonline.org.in (ASP.NET; jQuery; answers form POSTs with
`{status, data: "<JSON string>"}`). No login, no token. Responses are slow (5 to 10 s each).
Client: `scripts/lib/nhb.mjs` (POST with deadline, size cap, retries; 1.5 s gap). Adapter:
`scripts/lib/products/residex.mjs`. A full pull is ~510 requests, about an hour.

## Endpoints

| Call | Use |
|---|---|
| `GET /ApplicationUtilities/GetAllCity` | the 50 cities `{value: id, text: name}`; ids are stable across bases |
| `POST /<ctl>/Get_NHBResiCersai_PriceTrend` `reporttype=COUNTRY&lookup=BOTH_INDEX&pricemtdid=1|2&chkbefore1718=0` | all-India HFC and UC index |
| `POST /<ctl>/Get_NHBResiCersai_PriceTrend` `reporttype=CITY&lookup=HFC|UC&cityid=<id>&pricemtdid=1|2&locid=0&pincode=0&wardid=0&chkbefore1718=0` | one city: index, ₹/sq ft overall and by size (<=60, 60-110, >110 sq m), record counts, margins of error |
| `POST /Dashboard/Get_NHBResiCersai_PriceTrend_ForCity` `reporttype=ALLCITY` | all cities wide, current base only |
| `POST /Dashboard/GetFileDataToDownload` `reporttype=PIVOT_HFC|UC_INDEX|PRICE` | the download pivot; ignores the controller (always current data) |

Controllers: `DashboardBY2013` (base 2012-13, Jun 2013 to Mar 2018), `DashboardBY2018` (2017-18,
Jun 2018 to Dec 2025; UC to Sep 2024), `Dashboard` (2024-25, Jun 2025 on; HFC only, UC returns status Error).

`pricemtdid`: 2 = four-quarter moving average (every dashboard's default), 1 = current quarter.
`chkbefore1718=1` returns the newer base carried back into older years (NHB's back-cast); not used.

## Quirks

- Missing values are served as `0.0` (UC after Sep 2024): baked as null.
- Older bases round the index to whole numbers until about 2022.
- On the 2012-13 base the per-sq-m and per-sq-yard prices are not 10.76x and 9x the per-sq-ft price; only ₹/sq ft is baked.
- The four-quarter moving average is of prices weighted by records, so it is not the mean of four index values for small cities; for all-India it is within 0.16 (2024-25) to 1.0 (older bases), checked in validate.
- Quarters: `QTR` "26-27 Q1" and `QTR_YEAR` "Jun 2026" are cross-checked; baked as the quarter's first month (2026-04-01).
- Hand check (2026-10-09) against NHB's press release for April-June 2026 (`/DataUploadFormats/PressRelease_English/Press Release April-June 2026.pdf`): India valuation prices +7.0% y/y; Ahmedabad 7.9, Bengaluru 21.5, Chennai 10.8, Hyderabad 5.2, Kolkata 6.9, Mumbai 6.2, Pune 3.7, and the highest city +24.4% (Faridabad). Our bundle (four-quarter moving average, y/y computed from the index) gives the same figures to one decimal. NHB's headline is therefore the moving-average series.
