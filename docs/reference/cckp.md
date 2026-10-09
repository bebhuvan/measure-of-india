# World Bank Climate Change Knowledge Portal (CCKP): what we learned

Probed 2026-10-09 for the climate guide. Client: `scripts/lib/cckp.mjs`. Adapter:
`scripts/lib/products/cckp.mjs` (variable labels in `cckp-vars.mjs`).

## Two hosts

**1. The aggregation API.** No key, JSON.

```
GET https://cckpapi.worldbank.org/cckp/v1/
    {collection}_{type}_{variable}_{product}_{aggregation}_{period}_{percentile}_{scenario}_{model}_{calc}_{statistic}
    /{geocodes}?_format=json
```

Working examples:

```
era5-x0.25_timeseries_tas_timeseries_annual_1950-2025_mean_historical_era5_x0.25_mean/IND
cru-x0.5_timeseries_tas,pr_timeseries_monthly_1901-2025_mean_historical_cru_ts4.10_mean/IND
cmip6-x0.25_timeseries_hd35_timeseries_annual_2015-2100_median,p10,p90_ssp126,ssp245_ensemble_all_mean/IND
cmip6-x0.25_climatology_tas_anomaly_annual_2040-2059,2080-2099_median_ssp245_ensemble_all_mean/IND,IND.1151
era5-x0.25_climatology_tas_climatology_annual_1991-2020_mean_historical_era5_x0.25_mean/global_countries_subnationals
```

- **Every facet takes a comma list**, and so does the geocode list. The response nests one
  level per facet given as a list of two or more, in facet order (variable, aggregation,
  period, percentile, scenario), then geocode, then `"YYYY-MM": value`. A one-item list adds
  no level. This turns thousands of calls into a few hundred.
- Periods are keyed `YYYY-MM`: annual values carry `-07`; seasonal values `-01` (December to
  February, dated by the later year), `-04`, `-07`, `-10`; climatologies carry the window's
  first year.
- Missing values are a float fill of about `1e20`. Treat any |value| >= 1e15 as missing.
- An unknown combination is not an error: status `success`, `data: []`. Assert what you asked for.
- `_format=xlsx` returns the same data with a **name** column; the JSON does not. We read
  place names from it (system `unzip`, shared strings only).
- Geographies: ISO3 country codes; `global_countries_subnationals` returns every country
  and first-level unit (3,775 keys). India's first-level units are `IND.1151` ... `IND.11536`
  (35 codes, no `IND.11515`). CCKP's boundary set predates Telangana and Ladakh as separate
  units; the names are CCKP's own.
- Rate limits: none observed at one request per 400 ms.

**2. The public S3 bucket** `https://wbg-cckp.s3.amazonaws.com/?list-type=2&prefix=data/...`
(XML listing, 1,000 keys a page, continuation tokens). Layout:
`data/{collection}/{variable}/{dataset}/{product}-{variable}-{aggregation}-{statistic}_{collection}_{dataset}_{category}_{percentile}_{period}.nc`.
The listing is CCKP's own catalogue; the coverage catalogue is generated from it.
Collections in the bucket: `era5-x0.25` (106 variables), `cmip6-x0.25` (95), `cru-x0.5` (5),
and others outside this guide (`cmip6-daily-x0.25`, `pop-x0.25`, sea level, glaciers, hazards).

The NetCDF headers (first ~150 KB) carry `long_name` and units for each variable; the
labels in `cckp-vars.mjs` are taken from them, rewritten plainly.

## Collections

| Collection | What | Span | Grid |
|---|---|---|---|
| `cru-x0.5` | CRU TS 4.10 (UEA): station readings interpolated | 1901 to 2025 | 0.5° |
| `era5-x0.25` | ERA5 reanalysis (Copernicus/ECMWF), downscaled | 1950 to 2025 | 0.25° |
| `cmip6-x0.25` | ~30 CMIP6 models, downscaled and bias-corrected | 1950-2014 historical runs; 2015-2100 SSP1-1.9, 1-2.6, 2-4.5, 3-7.0, 5-8.5 | 0.25° |

Products per variable: `timeseries`, `timeseriessmooth` / `timeseries-smooth` (a smoothed
copy), `climatology` (20- or 30-year means), `anomaly` (CMIP6: change from 1995-2014),
`trend`, `trendconfidence`, `trendsignificance`, `natvar` (natural variability),
`ensocorrelation`, `percentile` (daily percentiles), `heatplot`. CMIP6 percentiles:
`median`, `p10`, `p90` of the model ensemble.

## Quirks found

1. **Fill values as data.** ERA5 seasonal `1950-01` (December 1949 to February 1950) is
   `1e20`. Nulled.
2. **Simplified WBGT is corrupt in ERA5** (`swbgt`, `swbgt26/29/32`, `swbgtx1day/3day/5day`):
   2024 and 2025 carry values of about `1.2e18` to `1.6e19`; and the annual mean for India
   (about 18) is below the mean wet-bulb temperature (about 20), which a WBGT should exceed.
   Not baked; ledger status `blocked`, 2026-10-09.
3. **Map-only variables** (`hdcat`, `hdiff`, `hdtr`, `hdtrhi`, `hdtrhipopdensitycat`,
   `hdtrpopdensitycat`, `hicat`, `trcat`, `rsns`): categorical layers for maps; the API
   aggregates none of them to places.
4. **`prpercnt` in ERA5** is labelled only "percent of total precipitation" and its values
   (100 to 300) have no documented reference; baked as served, not drawn.
5. **Several CRU TS versions** sit side by side (4.07 to 4.10); the newest is used, older
   versions are earlier vintages of the same series.
6. The CCKP web portal (`climateknowledgeportal.worldbank.org`) is behind a Cloudflare
   challenge for scripts; the API and the bucket are not.
