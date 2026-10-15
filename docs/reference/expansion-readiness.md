# Coverage expansion: source canaries, 10 October 2026

These are discovery checks, not canonical series or published numerical prose.
The expansion plan is `../PLAN-coverage-expansion.md`. Local publication queries
are reproducible with `node scripts/expansion-local-probes.mjs`; exact SQL and
results are saved in `expansion-local-probes.json`.

NSS 80 and Economic Census follow-up: [direct API discovery](mospi-api-discovery.md).
The old NSS 80 failure is resolved at the request level; full ingestion is pending.

## MoSPI energy

Verified through both the MCP and `scripts/lib/mospi.mjs` (one retry for canaries):

```js
await mospi('energy/getEnergyFilterByIndicatorId', {
  indicator_code: 1, use_of_energy_balance_code: 2
}, 1);
await mospi('energy/getEnergyRecords', {
  indicator_code: 1, use_of_energy_balance_code: 1,
  year: '2023-24', limit: 10, page: 1
}, 1);
await mospi('energy/getEnergyRecords', {
  indicator_code: 1, use_of_energy_balance_code: 2,
  year: '2023-24', limit: 10, page: 1
}, 1);
```

Supply response: 50 records expected for that year. Coal imports 141,638.82,
production 403,799.46, exports −1,040.87, stocks −10,299.09, primary supply
534,098.32 KToE. The signed components reconcile. A filtered MCP total-fuel,
total-primary-supply query returns 903,157.89 KToE for the same year.

Consumption response: 600 records expected for that year. Coal final consumption
200,947.38; industry includes iron/steel, construction and chemical/petrochemical
cuts. Metadata gives 11 petroleum sub-products and 24 end-use sub-sectors,
including electricity-output branches. Counts reflect this metadata response,
not remembered maximum code ranges in old notes. Rows headed `Elect. Output in
GWh` appear under the KToE indicator: investigate the unit before canonicalizing.

Metadata gives twelve fiscal years, 2012–13 to 2023–24. Only page one was read in
each record canary. Full pagination, duplicates, both unit representations and
all source balances remain unverified. Do not call this family ingested.

## NSS 74: a previously unlisted family in our plan

MCP sequence: `list_datasets`, `get_indicators(dataset='NSS74')`,
`get_metadata(dataset='NSS74', indicator_code=1)`, then
`get_data(dataset='NSS74', filters={indicator_code:1,state_code:37,bac_code:14,
frame_code:1,registration_status_code:4,limit:10,page:1})`.

The listing returns 21 indicators. Metadata for indicator 1 supplies All India
code 37, fourteen broad activity codes including All, three frames (EC, business
register, MCA), and four registration classes including All. The canary returns
one July 2016–June 2017 EC-frame, all-activity, all-registration record, value
20968, unit `Number`. This proves a reachable record, not whether its displayed
unit needs a survey-table multiplier. The survey report is still required for
that decision. No complete table or frame reconciliation was performed.

## Time Use

The Atlas client's `tus/getTusIndicatorList` with `viz_status=1` answers. The
existing ingestion index enumerates 41 indicators and 379,755 expected rows;
none is archived. Full acquisition was intentionally deferred by the earlier
state-profile work because it needs a national guide. That exclusion does not
mean this family is outside the Atlas mission.

## Candidate local publications

`databank query summary <dataset> --lineage-only --json` succeeded for:

- `amfi_industry_flows`: 546 published rows, one selected file.
- `amfi_statewise_aum`: 50,255 rows, one selected file.
- `sebi_bulletin_series`: 70,962 rows, one selected file.
- `imf_portwatch_ports_daily`: 104,525 rows, one selected file.
- `rbi_dbie_webi_prompted_rows`: 117,324 rows, one selected file.

The companion queries check distinct records, date spans, dimensions and report
coverage. Publication/raw lineage is not proof that a family is fully usable in
the Atlas. Do not infer universal prompt support from the corporate reports.
No Data Bank files, publications, policies or downloads were changed.
