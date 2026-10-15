# MoSPI MCP and direct API discovery, 10 October 2026

These checks identify usable source routes. They do not establish complete
coverage, validate survey estimates against reports, or publish new guide data.

## Official access points

- [API platform](https://api.mospi.gov.in/): live HTML loads a Swagger stylesheet;
  the macro JSON base used by this repository is `https://api.mospi.gov.in/api/`.
- [MoSPI MCP landing page](https://datainnovation.mospi.gov.in/mospi-mcp):
  server `https://mcp.mospi.gov.in`.
- [Official MCP source](https://github.com/nso-india/esankhyiki-mcp), particularly
  `mospi/client.py`, `mospi_server.py`, and `swagger/swagger_user_*.yaml`.
  These expose routes and parameter schemas beyond the historical SPA notes.
- [Official Python client](https://github.com/nso-india/mospi-esankhyiki).

The connected MCP currently lists 28 dataset identifiers. It is a discovery and
query wrapper over direct APIs, not a separate statistical warehouse. Catalogues
and SDK module counts can differ because surveys and modules are grouped
differently. Do not equate these counts with independent statistical families.
For production ingestion retain our shared throttled client, raw archives,
complete-page counts and series contracts; use MCP to inspect metadata and
cross-check bounded queries. Codes must come from each product's metadata.

## Newly resolved: NSS 80 telecom and education

Direct GET routes verified through `scripts/lib/mospi.mjs`:

| Route under `/api/` | Parameters checked | Result |
|---|---|---|
| `nss-80/getIndicatorList` | `survey_code=1` | 20 telecom indicators |
| `nss-80/getIndicatorList` | `survey_code=2` | 18 education indicators |
| `nss-80/getFilterBySurveryAndIndicator` | `indicator_code=1`, `survey_code=1` | States, age, gender, sector |
| Same metadata route | `indicator_code=33`, `survey_code=2` | States, expenditure items, gender, sector |
| `nss-80/getNSS80Records` | Telecom indicator 1, All-India, All sector, Person, 15+ | One record; 85.7 |
| Same records route | Education indicator 33, All-India, All sector, Person | Six expenditure-item records |

Exact requests and source responses are in `mospi-direct-probes.json`.
The MCP telecom query returned the identical record. Indicator labels specify
mobile use during the last three months; the response supplies no survey year.
The survey report must establish the reference window and unit before baking.

The old profile adapter used `survey` instead of `survey_code`, `indicator_id`
instead of `indicator_code`, and a differently cased records route. These are
corrected, with explicit survey modules 1 and 2 and `desc` label support. Its
existing index remains the historical failed attempt, not a successful ingest.

Whole-family extensions: digital access, use, skills, cybercrime reporting,
online banking and purchases; school enrolment, fees and expenditure by item,
private coaching, funding sources. Carry every supplied state, gender, age,
sector and expenditure cut, with separate survey instruments from NSS 78/79.
There are 38 listed indicators, not all integers through code 42 are active.

## Newly resolved: Economic Census

Separate host and protocol: form-POST to
`https://esankhyiki.mospi.gov.in/EC/filterDistrict6` (and suffix 5 or 4).
The official client also specifies detail endpoints under
`/dashboard/EC/submitForm6|5|4`; detail endpoints were not directly probed here.

EC6 ranking was checked both directly and via MCP, for Karnataka, top five
districts. Both return Bangalore 408,130 establishments and the same five
ranked districts. The direct response also contains totals 2,880,548
establishments and 7,145,885 workers. Exact form and response are in
`mospi-ec-direct-probe.json`. Form includes `ec=6`, `state=29`, `param1=val1`,
`top5opt=1`, and empty optional activity/ownership/finance/sector filters.
The source serializes table rows as HTML inside JSON. HTTP 200 alone is
insufficient: malformed forms also return 200 with an error message.

This opens a historical establishments/workers family by district, activity,
sector, ownership, operation and finance. EC4/5/6 have different state codes
and reference periods. Ranking output is not an exhaustive district table;
validate detail pagination and full district coverage before a guide. Our
current GET client cannot ingest this POST route without a dedicated adapter.

## Further direct coverage

`nss-74/getIndicatorList` returned 21 active services-enterprise indicators.
The official client documents `getNss74FilterByIndicatorId` and
`getNss74Records`; these latter direct routes were not probed in this pass.
The previous MCP canary is recorded in `expansion-readiness.md`. Scope includes
enterprise structure, ICT, workers, value and technical ratios. Preserve the
Economic Census, Business Register and MCA sampling frames separately.

Energy supply/consumption and time use are already reachable via direct macro
routes; earlier canaries are in `expansion-readiness.md`. Bulk-download route
names in the historical SPA remain untested. No claim of complete ingestion
or unrestricted downloads follows from this discovery.

## Verification

Corrected adapter configuration exercised both modules through listing,
metadata and record retrieval. `npm test`: 70 passed. `npm run gates`: passed,
including page QC and geometry lint on 856 SVGs across 87 pages. Syntax check,
plan-mode execution and `git diff --check` passed. No new canonical data,
guide prose, build artifacts, commits or deployment were produced by this pass.
