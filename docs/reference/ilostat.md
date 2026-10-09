# ILOSTAT: what we learned about the API

Probed 2026-10-09. Client: `scripts/lib/ilostat.mjs`. Adapter: `scripts/lib/products/ilostat.mjs`.

## Which endpoint

- **`rplumber.ilo.org` does not work.** Every query (`/data/indicator/?id=...`, `/metadata/toc/...`,
  `/files/website/bulk/...`) answers HTTP 200 with an empty body and a `content-disposition`
  filename. The old bulk-download host (`webapps.ilo.org/ilostat-files/...`) answers 404, and
  `ilostat.ilo.org` pages answer 403 to scripts (Cloudflare).
- **The SDMX 2.1 REST API at `https://sdmx.ilo.org/rest/` works.** NSI Web Service v8.19. No key.
  The v2 API and `availableconstraint` both answer "The method or operation is not implemented."

## Calls

| Call | URL | Notes |
|---|---|---|
| Every dataflow | `dataflow/ILO/all/latest` | XML, about 7 MB, 1,215 flows. Name, DSD id, a `LAST_UPDATE` annotation (dd/mm/yyyy hh:mm:ss). |
| A flow's availability | `contentconstraint/ILO/CCA_<flow>/latest` | XML, about 15 KB. Dimension order and the codes present across all countries. Tells you whether India (`IND`) is in the flow. |
| A codelist | `codelist/ILO/CL_<DIM>/latest` | XML. English name, display `ORDER`, `IS_TOTAL` per code. Codelists are `CL_` + the dimension id. |
| Data | `data/ILO,<flow>,1.0/IND.<empty slot per dimension>?format=csvfile` | SDMX-CSV 1.0, codes only. `format=csvfilewithlabels` adds a label column after each code column. `startPeriod`/`endPeriod` work. |

`dataflow/ILO/all/latest?references=all`, `datastructure/ILO/all` and `contentconstraint/ILO/all`
answer 413 ("Response is too large").

## Quirks

- **Unknown country = HTTP 500**, an Oracle `ORA-00936: missing expression`, not 404. Never
  query a flow for a country its constraint does not list (net.mjs would read 500 as throttling).
- **Key length must match exactly**: too few slots gives 422 "Not enough key values in query,
  expecting N got M". The constraint can omit a dimension (`DF_LAP_2LID_QTL_RT` has `DCL` in the
  data but not in its constraint), so the client retries with one more slot on 422.
- **Structure messages are XML only**, whatever `format=` says. They start with `<`, which
  net.mjs treats as an HTML throttle page unless `markup: true` is passed (added for this).
- **Cloudflare sometimes answers 403** to a request it serves a minute later; retried twice.
- `DF_IMF_ILOSTAT` is keyed by `MEASURE` alone (no country); it is not a country flow.
- Flow ids: `DF_<topic>_<measure>_<classifications...>_<unit>`. A measure starting with `2`
  (`EAP_2WAP`) is an ILO modelled estimate; `3` is a youth series; `X` an extended one.

## What the data is

- **India is in 693 of 1,215 flows, about 2.54 million observations.**
- **Sources (the `SOURCE` attribute)** decide the instrument: `ILO - Modelled Estimates`;
  `LFS - Periodic Labour Force Survey` (ILO processing of PLFS unit data, calendar years from
  2018 and quarters from 2017 Q3, current weekly status); `HS - National Sample Survey` (1994,
  2000, 2005, 2010, 2012, each the year the July-June round ends); `PC - Population Census` (1961
  to 2001); and about a dozen administrative sources (labour inspectorate records, strikes and
  lockouts, minimum wage, Employment Market Information, MEA and MOIA migration records).
- **`OBS_STATUS`**: `R` real value, `U` unreliable (14% of India's survey cells), `B` break in
  series, `A` adjusted, `M` model-based extrapolation, blank = none. Some cells come with a status
  and no value: the ILO withholds them.
- **Modelled estimates**: one edition a year (the flow name carries it: "ILO modelled estimates,
  Nov. 2025"); each edition re-estimates the whole history from 1990/91. The edition year and
  later are projections (2025 to 2027 in November 2025). Bounds (`LOWER_BOUND`, `UPPER_BOUND`)
  are published for some series: India's unemployment rate runs 1.9% to 14.7% in 1991.
  Most years are imputed: for India's unemployment rate only 2018 to 2024 are `R`; for
  participation, only 2010 (and only under the broad age bands).
- **Definitions**: modelled series follow the 13th ICLS; survey measures are labelled
  "previous ILO definition - ICLS13" where they use it.
- **Copies**: ILOSTAT also holds India's CPI (from MoSPI), exchange rates and PPP factors (IMF,
  World Bank) and dollar conversions of rupee earnings (`_CUR_` flows). The guide sets these aside.

## Catalogue

`node scripts/lib/products/ilostat.mjs --catalogue` walks every flow, reads its constraint, pulls
India's data and writes one item per (instrument, frequency, flow, classification versions):
3,445 items. `--spotcheck` re-reads one value per baked bundle from the labelled CSV with the
cache bypassed and compares it with the bundle.

## Politeness

One request in flight, 400 ms apart (`ILO_GAP_MS`). Responses cached at
`data/raw/http-cache/<sha1(url)>.json` for 20 hours (`ILO_CACHE_TTL_H`; `ILO_NO_CACHE=1` bypasses).
A full catalogue run is about 1,900 requests and 25 minutes uncached.
