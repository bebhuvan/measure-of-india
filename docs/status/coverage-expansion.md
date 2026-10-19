# Coverage expansion

18 October 2026: Time Use report/API evaluation and the first report-backed
2024 appendix guide edition are implemented and locally verified. See `time-use-expansion.md` for the 62 original
workbooks, complete source-cell replay, API discrepancies, reader scope and
unfinished historical/state-statement work. This does not mark the whole TUS
family complete.

Updated 10 October 2026. Plan: `docs/PLAN-coverage-expansion.md`.
Owner guardrail: `skills/atlas-comprehensive-expansion/SKILL.md`.

## Completed assessment

- Confirmed thirty registered guides and the local Data Bank's location.
- Added the temporary comprehensiveness skill and linked it from AGENTS.md and
  the skills index, so subsequent agents encounter it.
- Added `npm run coverage:expansion`: a read-only, repeatable census of canonical
  bundles, guide-table access, source ledgers, profile ingestion and DBIE report
  references. Derived output: `docs/expansion-audit.json`.
- Current baseline: 2,288 bundles, 820,428 series entries, 10,619,396 observations.
  354 bundles lie outside national guide tables, predominantly profile data and
  seventeen WDI topic bundles. These counts do not establish unique concepts or
  completed analytical coverage.
- Ranked national guide packets for schools, assets/debt, farm households,
  digital access, water/sanitation, energy, mutual funds and environment. Recorded
  their complete dimensions, chart questions, source traps and remaining work.
- Probed energy supply and consumption through the Atlas client; source now
  responds. Updated the dated reference notes. Found and probed NSS 74 through
  MCP; twenty-one indicators, one reachable services-enterprise record.
- Verified five candidate Data Bank publications through its lineage-only CLI.
  Added reproducible distinct-record queries in `scripts/expansion-local-probes.mjs`
  and saved their outputs in `docs/reference/expansion-local-probes.json`.
- Corrected the operating manual's historical thirteen-guide baseline.

## Validation

- Temporary skill passes the skill-creator validator.
- Both scripts pass Node syntax checks and execute on actual repository/local
  publication data.
- `npm test`: 70 passed, zero failed.
- `npm run gates`: passed, including rendered QC and chart lint (856 SVGs,
  87 pages).
- `node scripts/coverage.mjs --strict`: all 42 ledgers clean.
- No render, canonical-data or guide-prose changes in this assessment; gates
  checked the existing build. No new guide, full source ingest, archive upload,
  commit or deployment was performed.

## Next implementation

Schools is the first packet. Its forty-six raw tables are already held, but
profile bundles do not preserve every cross-tab. Read the full source listing,
run the census, reconcile the national publication and questionable dropout
cells, then build all finer cuts, analytical plates, explanations and EveryCut.
The subsequent packets and international discovery routes are in the plan.
The owner has authorized coverage expansion; routine implementation choices
do not require another permission request.

## First implementation packet

Schools now has a complete API census and analytical guide. Implementation scope
and evidence: `docs/status/schools-expansion.md`. The figures above remain the
assessment baseline, not the new site totals. Other ranked packets remain pending.

Schools verification is complete: build, gates, 76 tests, strict coverage and
prose dry run passed. Updated site census: 31 guides, 2,399 bundles, 930,926 series
entries and 10,896,532 finite observations. Counts include mirrored entries,
not distinct economic concepts. No commit or deployment was made.

## Household implementation packet, 11 October 2026

Household assets and borrowing is now guide 32, with complete recovery of all
22 archived AIDIS API cubes, a separate official conditional-debt release bundle,
109 analytical plates and full cut/download exposure. The wider report has
additional tables and columns that remain explicitly unfinished. See
`docs/status/households-expansion.md` for exact scope and verification in progress.
