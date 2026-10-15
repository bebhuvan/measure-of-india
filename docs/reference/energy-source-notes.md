# Energy source notes

Scope: complete energy balance chapter and annex, MoSPI balance API, and original Ember national and subnational electricity releases. No count here establishes unique economic concepts.

## Official lineage

MoSPI API: `energy/getEnergyIndicatorList`, `getEnergyFilterByIndicatorId` and `getEnergyRecords`, with `indicator_code` and `use_of_energy_balance_code`. The shared client enforces the 100-row cap, response count reconciliation, repeated-row detection, throttle and backoff. Whole fetches run under `/tmp/atlas-mospi-expansion.lock`. `scripts/energy-probe.mjs` and `scripts/energy-ingest-mospi.mjs` reproduce the inventory and ingestion.

The official publication listing is served by the website's `publications-reports/get-web-chapter-data` POST endpoint, with publication_id 2817, language en and explicit pagination. The archived listing contains every chapter, source filename and URL. `scripts/energy-report-2026.mjs` downloads the balance and historical-annex workbooks through the shared bounded network client. Original bytes and SHA256 remain in raw wrappers, with a separate extracted-cell wrapper. `scripts/energy-replay-workbooks.py` rereads original XLSX bytes at validation; edited extraction cannot pass replay.

The older official PDF is archived by source hash and full `pdftotext -layout` extraction. `scripts/energy-report-cells.mjs` addresses named balance table headers, exact periods and column counts. Whole-number cells are report precision; the earlier API's two-decimal representations remain separate.

Ember national source snapshots in the read-only sibling have four original ready products. Their hashing convention is SHA256 of JSON.stringify(body,null,2), before the stored final newline. All four hashes and declared record counts verify. The nineteen derived state-manifest products reduce to two original CSVs; original bytes, hashes and full rows are retained. `scripts/energy-ingest-ember.mjs` imports only verified original lineage, without opening the sibling env file or copying any key.

Ember national source: https://api.ember-energy.org/v1/docs . State sources: https://files.ember-energy.org/public-downloads/india_yearly_full_release_long_format.csv and https://files.ember-energy.org/public-downloads/india_monthly_full_release_long_format.csv . National and subnational releases remain separate instruments.

## Coal and lignite definition boundary

The 2025 report Annex IV Tables I–IX (2012–13 through 2020–21, printed pages 139–147; PDF pages 181–189) explicitly label Coal # with the footnote “# Includes lignite”. Table X for 2021–22 (printed 148/PDF 190), Table 7.2 for 2022–23 (printed 74/PDF 112) and Table 7.6 for 2023–24 (printed 78/PDF 116) have separate Coal and Lignite columns. `data/coverage/energy.fuel-definition-evidence.json` records exact headings, years, pages and source hash. Twelve independent production-cell comparisons tie the API edition to these source-rounded tables within 0.5 KToE.

All API unit/use branches split at that boundary, including electricity-output branches, so no bundle implies a continuous fuel ruler. Older labels say Coal (including lignite). Combined years do not receive fabricated lignite cells; split years preserve the published coal and lignite rows and their source zeros/nulls. Interior missing values remain null and are declared in their own series gaps. Historical report transformations also keep separate rulers. The 2026 revisions remain a separate report edition.

## Signs, units and hierarchy

API primary supply = production + imports + signed exports + signed stock changes. The current report additionally publishes bunker rows and revisions. Workbook bunker signs differ from conventional deductions and some subtotal cells are blank. Preserve the published convention and disclose it; do not silently negate or fill cells.

Reported final consumption = primary supply + statistical differences + signed transformations + signed own use + signed losses. Some historical natural-gas transformations fail that bridge; the same discrepancy reaches Total. The reviewed residuals are in `energy-reviewed-source-discrepancies.json`; changed discrepancies fail validation. Statistical identities are checked after exact source replay so published errors cannot be mistaken for an adapter error.

The workbook numerical conversion is 0.041868 PJ per KToE. An older sheet prints a tenfold contradictory conversion note. The numerical factor, independently checked against source pairs at published precision, controls the comparison.

Electricity-output rows in KToE tables contain GWh. PJ tables multiply those values by 0.041868 and retain the GWh heading. The latter are `source_scaled_gwh`, an audit-only unit with a warning in EveryCut/downloads; no chart or physical headline/facts input uses them.

Fuel and subsector subtotals overlap their parts. Oil Products overlaps its eleven subproducts. Electricity in final consumption overlaps the primary fuels that produced it upstream. Ember Clean = fossil-free generation including nuclear; Renewables excludes nuclear. No total is summed with its components.

State production locates power stations, not resident consumption. Original state tables do not publish state demand. India Total and unallocated Others remain preserved, without constructing state-demand estimates. Current comparisons label a series' own period where it ends before its bundle; nulls are never interpreted as zeros.

## Beyond this packet

The archived official report listing inventories reserves, production, trade/prices, credit, availability, sustainability, energy accounts and world statistics in other chapters. These are additional source products, not secretly completed by the balance guide. Climate/MNRE overlap is audited in the energy status file. Report inventory is an omission disclosure, not a completion claim.

## Lifecycle emissions definition correction

Ember’s original API/CSV tags retain CO2-style names, but its official national and subnational methodologies define lifecycle greenhouse-gas emissions in CO2-equivalent using a 100-year horizon. The canonical units and six bundle filenames now use CO2e. Archived original tags/bytes remain intact. Every numeric value, date, dimension and data vintage in those six bundles is independently unchanged (energy-co2e-migration.json). Archived methodology documents are definition evidence observed on 2026-10-11, not new numeric-data vintages. National methodology v1.6 does not establish which coefficient version produced the June 2026 snapshots; no coefficient-version equivalence is claimed.

The subnational methodology’s India source notes (page 5) also record captive-generation exclusion from state totals, historical renewable capacity imputation from upstream MNRE sources, and Jammu and Kashmir/Ladakh combined reporting through July 2021. No cell-level imputation flags are supplied. National and state totals remain separate instruments. These boundaries are explained in reader prose without untraced numeric constants.

The final development QA initially compared chart values by DOM position. Sections group plates, so that comparison misaligned ten positions while the values themselves matched. It now independently compares all 129 chart values by stable plate IDs. Geometry preflight after the unit correction passes all 129 SVGs. Focused tests pass 13/13; prose dry-run and all 769 as-of attestations pass. Final rebuilt-artifact verification remains pending.

## Geographic scope partition, final verification restarted

Coordinator review identified that a caveat alone did not prevent a canonical Jammu and Kashmir history crossing the Ladakh reporting boundary. The in-progress static build was stopped. Actual original monthly CSV availability independently places the first non-null Ladakh cell at July 2021. Monthly combined reporting before July 2021 and separate reporting from July 2021 now live in different bundles. Annual 2019–2020 combined reporting, the mixed-scope 2021 transition, and separate reporting from 2022 live in three distinct instruments. Original state names/codes, all source metric cells and numeric vintages remain untouched. No values are allocated, interpolated or subtracted to invent a retrospective state series.

Other states and India Total keep their source-native histories in the original bundle names. Geographic bundles contain only the affected states; annual transition records remain available in detail tables/downloads and are excluded from cross-year analytical comparisons. Separate-scope Jammu and Kashmir/Ladakh get their own explained state plates. Census/ledger/facts/registry/source seams are regenerated. The inventory now has 73 bundles, 10,814 nonempty series and 164 explained plates; the source metric-cell count stays 281,060. Extra series reflect partitioned histories, not new source concepts. EveryCut inline cap is 150 to accommodate added explained plates within the existing HTML budget. Actual rebuilt static QA and gates are pending again. Evidence: data/coverage/energy.geographic-definition-evidence.json.

## Publisher vintage correction — 12 October 2026

The earlier verified artifact included misleading vintage metadata. This patch supersedes that metadata without changing raw archives, observation dates, series fields, units or values. Of 73 bundles, 64 now have null vintage, explicit unknown status and a substantive note: 49 Ember bundles, 12 MoSPI API bundles and three report-2025 transformation bundles. Nine report-2026 bundles retain 2026-03-30 with a publisher publication-edition basis, official source-date URL and archived listing record evidence. The date does not establish later undocumented file revisions.

Report 2025’s 2025-03-25 date is a foreword signature date, stored separately with edition year 2025. Neither that date nor the PIB announcement that the report “has released” establishes an API revision or exact publication day. Capture provenance is separate and hash-linked: national originals record 2026-06-13T10:35:11.071Z; the annual state CSV records 2026-06-13T11:05:01.339Z. The 12:35 derived-manifest timestamp is not the original CSV capture. The monthly CSV’s precise capture timestamp is not retained, so it remains unknown; its legacy June label is non-authoritative.

Model plates, source maps and headline facts retain status, note, vintage text and capture/publication provenance. The inline payload pools provenance per bundle and reconstructs the complete model exactly. Both current facts entrypoints are authoritative and generated from the current model; the original pre-seam canary is preserved only under docs/status/energy-legacy-facts-canary.json with superseded provenance. Source replay now checks vintage/capture metadata and rejects promotion of capture dates into producer dates.

Focused tests: 24/24 pass, including full source replay, equivalence for all 73 canonical bundles and all 24 raw archive hashes, exact observation-date tracing, geometric label bounds and lossless metadata roundtrip. No isolated build or live data acquisition was run. The pre-patch static/build/browser results remain historical evidence; the patched metadata and page require central build and artifact verification.

The owned `scripts/energy-editorial.mjs` generator validates exact canonical cells and writes the current-model sheet to `pipeline/out/facts-energy.json`. `src/dossiers/energy.facts.js` defines their common shape, and coverage analysis uses it too. The original canary remains intact inside the explicitly superseded status archive. Direct generator execution and identical-file/current-source regression tests pass. Central registration of the trusted facts generator remains the coordinator’s task; no shared pipeline entrypoint was edited here.
