# Parallel expansion, 11 October 2026

This brief supersedes the old worktree names and commit instructions in
`docs/briefs/README.md` for this wave. Bhuvanesh authorized separate Codex
chats and managed worktrees. No subagents. No commits, pushes, release merges
or deployment. The coordinator integrates reviewed file changes into the
existing dirty `launch-build` checkout, preserving Schools and AIDIS.

## Common operating rules

Read AGENTS.md, GOAL, VISION, ARCHITECTURE, DESIGN, PLAN-launch,
STATUS-launch, the series/render/coverage/dossier contracts, RUNBOOK-sources,
`skills/atlas-comprehensive-expansion/SKILL.md`, `skills/analyze-series.md`,
`skills/add-source.md`, `skills/write-dossier.md`, PLAN-coverage-expansion,
coverage-expansion status and expansion-audit. Run the analysis playbook
before selecting chart narratives. More points, granularity, cuts,
explanations and charts when in doubt; account for the complete source family.

Work only in your assigned managed worktree. It is seeded from the working
tree, including uncommitted infrastructure; verify Schools, households and
the corrected NSS80 profile routes before editing. Record your initial HEAD
and baseline hashes. Do not treat inherited dirty files as your changes.
Never modify the parent, sibling project, Data Bank or another worker's tree.

Own files named for your slug: adapter; raw/series/coverage artifacts;
model/format/client/plot; guide; corpus/facts; family validation/tests;
reference notes; family status. Shared registration additions must be small
contiguous blocks naming your slug: sources, fetch registry, dossier registry,
headline/periods, validate, QC, OG, slots, as-of. Do not reformat or regenerate
other families' assets. Coordinator owns common docs, shared chart plumbing,
final shared outputs and integration. Propose shared fixes in your status.

Use the two machine-wide build slots:
`scripts/build-slot.sh sh -c 'npx astro build && npm run gates'`.
Run whole suites as `npm test -- --test-concurrency=2`; all tests still run.
Avoid broad suites during two simultaneous search-index phases.
Keep browser QA within the slot when it requires a build. Remove only your
own rebuildable dist after checks. Preserve main preview port 4322.
Use existing dependencies; do not reinstall them merely for a worktree.
Avoid copying large cache/archive trees. Never mutate hard-linked data files.

Serialize MoSPI network work across chats using a machine-wide advisory lock
`flock /tmp/atlas-mospi-expansion.lock <your fetch command>` around the whole
fetch, plus the shared client's throttling/backoff. Reuse validated caches;
detect repeated pages and reconcile exact expected row counts. A successful
first page is not ingestion. Do not run broad all-family network refreshes.

Numbers must trace through facts; review all numerical editorial output.
Never refresh stale prose attestations merely to make gates pass. Separate
instrument seams; series-level null/gap disclosures; true data vintage.
Source replay, identities and exact source denominators are required.
Inventory source reports beyond API listings; mark unfinished omissions
explicitly with evidence, without claiming report completeness.

Use Schools and households as patterns, without copying domain assumptions.
All new charts must be usable on phones, with full names and values. Check
containers 284/354/509/680 and actual browsers 320/390/545 plus desktop 1440.
Inspect text bounds, clipping, collisions and readable type, not only page
overflow. No horizontal scrolling as a substitute for a usable chart.
Use family-local responsive plotting/CSS if shared plumbing is insufficient.

Completion requires adapter/catalogue/ledger, source replay and identities,
guide with explained analytical plates, full Every Cut/downloads, editorial
checks, build/gates, strict coverage, appropriate tests, prose dry run,
actual rendered visual QA, hand source checks and current family status.
Report available/archived/canonical/exposed rows and charts separately.
Provide a family file list and shared integration hunks relative to your
initial baseline, with logs and explicit omissions. Do not commit.

## Farm households: `farm-households`

Complement Farms production/yields and households assets/debt. Verify the
33 NSS77 listed indicators and previously archived rows. Earlier inventory
counted 14,112 profile entries and 471,001 expected raw rows; recount them.
Recover all actual source cross-tabs, rather than reusing sparse profile cuts.

Cover income from wages, crops, animals and nonfarm work; paid-out versus
imputed costs; receipts and expenses; landholdings, leasing/tenure, social
groups and livestock; creditors; crop disposal and satisfaction; seed
procurement/quality; MSP awareness; insurance and reasons for noncoverage;
crop losses/causes. Retain every available state/crop/rural/social/other cut.
Agricultural households are not all rural households. Establish exact survey
reference dates and universes for each measure. This is a stale survey
snapshot, never a current monthly-income estimate.

Own `farm-households*` files and use preview port 4331. Status:
`docs/status/farm-households-expansion.md`.

## Energy: `energy`

First audit Climate and MNRE for overlap; add genuinely new reader questions.
Read MoSPI discovery/esankhyiki/reference probe evidence. Fully enumerate
energy balance metadata, all years/units/fuels/subproducts and real cuts.
Cover supply/production/imports/exports/stocks, transformation and final
consumption, every industry/transport/other subsector and comparable state
cut where actually available. Verify signs and balance identities.

Earlier total-primary-supply canary for 2023–24 was 903157.89 KToE; verify.
Consumption only inspected page one, not full ingestion. Electricity-output
rows labelled `Elect. Output in GWh` appear under KToE metadata: isolate and
verify true units against the report. Reconcile PJ/KToE only with an explicit
conversion and published precision. Never sum nested totals and their parts.

Integrate useful Ember annual/monthly generation, demand, fuel mix, emissions,
intensity, capacity and available state cuts. Keep electricity/total energy,
capacity/generation and renewable/low-carbon concepts separate.

Read-only sibling: `/home/bhuvanesh.r/Documents/Bhuvan projects/THis Indian Life`.
Its Ember adapter and ingestion/derivation scripts have lineage; national
manifest has four ready outputs (416/26/416/26 rows), state manifest nineteen.
Verify actual output files and original sources. Derived mirrors are not new
independent measures. Load keys from local env files without printing values
or key-bearing URLs; never copy secrets into briefs, commands or public files.
The sibling env contains an Ember key; presence is not authenticated access.
Use Atlas's shared network client and canonical contract when adapting.

Own `energy*` files, plus a uniquely named Ember transport if needed. Use
preview port 4332. Status: `docs/status/energy-expansion.md`.
