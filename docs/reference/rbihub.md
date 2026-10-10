# The Reserve Bank Innovation Hub's DBIE data service

Probed 2026-10-10. `dbie.rbihub.in` ("DBIE: Database of the Indian Economy", RBI seal, on the
domain of the Reserve Bank Innovation Hub, RBI's wholly owned subsidiary) is a modern
front end to RBI DBIE. The pages state no terms, licence or disclaimer. Its data comes from
an API at `https://data-api.dbie.rbihub.in` (the site's `NEXT_PUBLIC_DATA_API_URL`).
Client: `scripts/lib/rbihub.mjs`.

## Routes (from the site's own JavaScript)

| Route | Returns |
|---|---|
| `GET /api/catalogue?limit=2000&offset=N` | `{ data: [entry], total }`; 1,430 entries |
| `GET /api/tables/{schema}/{table}` | metadata: columns, layout, `loaded_at`, report id, provenance (DBIE document id, exported files) |
| `GET /api/tables/{schema}/{table}/rows?limit=&offset=` | `{ columns, rows }`, paged |
| `GET /api/tables/{schema}/{table}/csv` | the whole table as CSV |
| `GET /api/codelists/{code}` | an SDMX code list |

A catalogue entry: `entry_id, report_id, title, menu_path, frequency, kind (table, dataset,
archive file, documentation), source (publications 766, statistics 398, sdmx 252,
indicators 14), schema_name, table_name, status (loaded 1,049; not exported 279; archive
file 101; exported empty 1), row_count, period_from, period_to, notes, dsd_code`.

## What the data is

The report exports as DBIE gives them, not cleaned: a table with `layout: "columns"` has
`src_file, tab, period, row_no, c1..cN`, all text, with title, header and footnote rows among
the data rows (report 575, exchange rates: 6,804 rows, 1998 to 28 Sep 2026, five columns).
Every adapter must find the header, the unit and the data block itself, as it does for the
Data Bank's webi exports (`scripts/lib/databank.mjs`). Nothing here is easier than the Data
Bank; what it adds is coverage.

## When to use it

The local Data Bank (`databank` family) stays the record for every report it holds validated
(1,243). Use this service only for:

- the 24 loaded reports the Data Bank could not fetch (DBIE gates them behind an input
  prompt, or the fetch failed): urban co-operative banks (772, 784-789, 795-800), bank-wise
  variables (1221, 42,372 rows), the Survey of Professional Forecasters (1475, 1476), district
  credit (1456), area under major commercial crops since 1951 (190), BSR-2 table 1.2 (1303),
  bank offices by group (617), SLR securities (1207), NSE corporate debt volumes (750, 804),
  authorised-dealer branches (740);
- the 252 SDMX datasets (the Data Bank's CAS mirror holds 47).

Where a report exists in both, check a sample of cells against the Data Bank before
using either, and record the check in the adapter header. Print the source as
"Reserve Bank of India, DBIE, via the Reserve Bank Innovation Hub's data service".

## Freshness

The site's headline panel on 2026-10-10 showed the repo rate as of July 2026 and CPI to July
2026, behind the Data Bank (repo decision of 7 Oct 2026 held). Table `loaded_at` dates are
per table; check them.
