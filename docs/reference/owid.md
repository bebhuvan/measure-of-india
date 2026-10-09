# Our World in Data (OWID): what we learned

Probed 2026-10-09 for the climate guide. Client: `scripts/lib/owid.mjs`. Adapter:
`scripts/lib/products/owid-climate.mjs`. Licence CC BY 4.0: credit OWID and the producer.

## The datasets with codebooks

| Dataset | Data | Codebook |
|---|---|---|
| CO2 and greenhouse gases | `https://owid-public.owid.io/data/co2/owid-co2-data.csv` (33 MB, 79 columns) | `https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-codebook.csv` |
| Energy | `https://owid-public.owid.io/data/energy/owid-energy-data.csv` (16 MB, 130 columns) | `https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-codebook.csv` |

- One row per country (or region) and year. `iso_code` is empty for regions; the World is
  matched by `country == "World"`.
- The codebook on `owid-public.owid.io` returns a Cloudflare 404 page; the GitHub copy works.
- Producers (codebook `source` column): Global Carbon Project (fossil CO2, land use,
  consumption-based), Jones et al. (methane, nitrous oxide, warming contributions),
  Energy Institute Statistical Review and Ember (energy and electricity), plus OWID's own
  arithmetic for growth, per-capita, shares and cumulative sums.

## Grapher charts and indicators

- Site map: `https://ourworldindata.org/sitemap.xml` lists ~4,400 grapher charts.
- Chart: `https://ourworldindata.org/grapher/<slug>.config.json` (the indicator ids under
  `dimensions[].variableId`), `.metadata.json` (citations), `.csv?csvType=full`.
- Indicator: `https://api.ourworldindata.org/v1/indicators/<id>.metadata.json` gives the
  `catalogPath` (`grapher/<namespace>/<version>/<dataset>/<table>#<short name>`), units,
  origins, and `dimensions.entities` (India is entity 137, code `IND`).
  `.../<id>.data.json` gives parallel arrays `values`, `years`, `entities`.
- Monthly and weekly indicators store days since `display.zeroDay` in `years`
  (`1949-01-01` for monthly ERA5, `2000-01-01` for weekly wildfires).
- Indicator ids change with every ETL version (2026-09-11 for the climate namespace now).
  Our catalogue ids drop the version: `owid:<namespace>:<dataset>:<short name>:ind`.

## What is in scope, and what we found

The catalogue takes charts whose slug matches a broad climate keyword list, then keeps
indicators in OWID's `climate` and `emissions` namespaces and the heat-death datasets, and
only those covering India. For India (2026-10-09): 14 datasets, 280 indicators.

- `surface_temperature`: monthly ERA5 country average temperature and its anomaly from
  1991-2020, January 1940 to August 2026. The freshest series in the guide.
- `surface_temperature_annual_average`: annual and decadal temperature and anomaly. The
  current year is an average of the months published so far (2026 = January to August):
  dropped.
- `surface_temperature_monthly`, `surface_temperature_anomalies`,
  `surface_country_level_monthly_anomaly`: the same monthly values rearranged by year,
  decade or calendar month for OWID's charts (checked: January 1940 in the by-month table
  equals January 1940 in the monthly series). Not baked twice.
- `total_precipitation_annual`: ERA5 annual precipitation and anomaly, 1940 to 2025.
- `wildfires_by_year`, `yearly_burned_area`, `weekly_wildfires` (GWIS): area burnt,
  fire counts, emissions; `wildfires_by_week(_average)` are cumulative re-cuts of the
  weekly series.
- `national_contributions` (Jones et al.): India's contribution to global warming by gas
  and by fossil versus land use, 1851 to 2024.
- `heat_deaths_undp_climate_horizons`: projected change in the death rate from
  non-optimal temperatures under RCP4.5, per 100,000, for 2030, 2050 and 2090.
- `young_people_opinions_climate_change__hickman_et_al__2021`: a 2021 survey of
  16 to 25 year olds.
