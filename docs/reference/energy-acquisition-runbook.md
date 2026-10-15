# Energy acquisition and replay

## Operating mode

This wave registers **archived-edition replay**. `REGISTRY.energy` canonicalizes the verified archives. `npm run data` does not automatically discover or acquire a fresh energy release. The adapter ignores the fetcher's current-date vintage argument and retains each archived source vintage. Automatic future release detection and acquisition are unfinished.

Supported editions are the 2025 MoSPI API balance, separately defined combined-coal and split-coal histories, the 2025 report transformation tables, the 2026 balance chapter/annex, and the original verified Ember national/subnational snapshots. New editions require reviewed lineage, definitions, unit/sign checks, source discrepancies and seams. A successful replay does not establish that the source website has published nothing newer.

The Ember and MoSPI API archives do not establish publisher revision dates. Canonical `vintage` is null with an explicit unknown status and note. Capture provenance is separate: national API ingestion and annual state CSV capture timestamps are hash-linked in `data/coverage/energy.capture-evidence.json`; the monthly CSV's exact capture timestamp is unknown. The legacy raw `vintage` label is not authoritative publisher metadata. Report 2025 retains its foreword date and edition year separately, with an unknown publication/revision vintage. The archived official 2026 listing supports a publication-edition date, not any later undocumented byte revision. Acquisition guards retain original archive bytes and reject changed source identities; an unchanged-body rule cannot turn a capture date into a producer date.

## Offline reproduction

Run from the Atlas checkout using its existing dependencies:

```sh
node scripts/lib/products/energy.mjs
node scripts/energy-analysis.mjs
node scripts/census.mjs energy --full
node scripts/energy-census-review.mjs
node scripts/energy-editorial.mjs
node scripts/validate.mjs
```

Validation reparses the historical report's archived full page text and rereads the original XLSX bytes, then replays canonical cells and statistical identities. This path uses no credential or network. Raw files are never edited by hand.

## Original-edition acquisition commands

MoSPI metadata and missing record archives must run under the machine-wide lock. Complete pagination uses the shared MoSPI/network client; existing record archives resume without another fetch.

```sh
flock /tmp/atlas-mospi-expansion.lock sh -c 'node scripts/energy-probe.mjs && node scripts/energy-ingest-mospi.mjs'
```

Changed metadata stops the archived-edition acquisition rather than assigning new years to an old fuel definition. Direct definition evidence is in `energy.fuel-definition-evidence.json`; the API's coal production is independently compared with twelve report tables.

The original 2025 PDF and current balance chapter are downloaded through the shared bounded network client. `pdftotext` is required for page text. Every source hash is retained.

```sh
node scripts/energy-report-probe.mjs
node scripts/energy-report-cells.mjs
node scripts/energy-report-2026.mjs
python3 scripts/energy-extract-workbooks.py
node scripts/energy-archive-workbook-rows.mjs
node scripts/energy-report-2026-pdf.mjs
```

`python3` needs the existing `openpyxl` library. The 2026 downloader uses the archived publication listing, or an explicitly staged `/tmp/atlas-energy-report-2026-list.json`; the latter must match the reviewed listing. Its original discovery request was POST `https://www.mospi.gov.in/api/publications-reports/get-web-chapter-data`, with `publication_id:2817`, `lang:"en"`, `page_no:1`, `page_size:100`, `sort_field:"id"`, `sort_order:"ASC"`, `data_source:"web"`. Staging a newer listing is a source-review step, not an automatic refresh implemented here.

Ember import reads the original manifest/API snapshots and two CSVs in the read-only sibling named in the wave brief. It verifies their hashes and record counts; nineteen derived state views do not create nineteen original datasets.

```sh
node scripts/energy-ingest-ember.mjs
```

That import requires the verified sibling files and needs no credential. Live national API acquisition upstream requires the securely configured `EMBER_API_KEY`; this wave neither reads nor copies the sibling key. Public CSV URLs and original lineage are recorded in `energy-source-notes.md`. Missing upstream originals or changed archived identities stop acquisition. No fallback estimate is fabricated.

## Reviewing a future edition

Stage candidate bytes separately. Compare complete inventories and numerical data with the archived version; a response timestamp alone is not a data revision. Obtain source vintage evidence, re-read fuel definitions and units, register separate bundles for changed rulers, preserve originals, and update the supported-edition parser and discrepancy review. Then regenerate facts/census and inspect every added cut. Build, gates, strict coverage, meaningful source tests and actual phone/desktop QA must pass before central integration. Human release merging remains required.

Methodology evidence is separately archived by `node scripts/energy-methodology-evidence.mjs`. Review unit definitions, geographic/captive coverage and imputation changes before accepting a future edition. Definition evidence never changes numeric-data vintage; current method version must not be assumed to match historical coefficients.
