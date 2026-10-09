# Brief: shared framework for the launch (`framework`, port 4411)

You build the shared pieces every guide needs (`docs/PLAN-launch.md` §5, F4 to F6), and you
bring the 14 existing guides under the coverage gate. Ten family sessions are building new
guides in parallel; they are told not to touch `src/charts/`, so the chart work is yours.
Because other branches will merge around you, keep changes to existing files surgical.

## F6: the every-cut table (do this first: every family needs it)

A component (`src/components/EveryCut.astro` plus whatever client code it needs) that lists
every series of a guide's bundles at every granularity, built at render time from the baked
bundles (no client-side data fetching: AGENTS.md). Per row: the series' plain label, its
cut (state, item, sector, partner...), latest value with period, change over the year
where meaningful, a sparkline, and a download link to `/data/<bundle>.csv`. Sortable and
filterable by cut, readable at 390px, design v2 (`docs/DESIGN.md`), no widget clutter.
It must handle the long tail: 358 CPI items x 37 states, 11,000 HS lines (paginate or
group; never ship megabytes of HTML for one page: check `docs/CONTRACT-render.md`
budgets). Add it to the 14 existing guides, document it in `docs/CONTRACT-dossier-structure.md`
(a proposed edit: note it in your status file for the coordinator), and write a short note
in `docs/briefs/README.md`'s style telling family sessions how to add it (put that in your
status file; the coordinator will relay it).

## F4: seams on charts

`docs/INVENTORY-data-paths.md` "Base years" proposal point 3: one shared treatment in
`src/charts/plumbing.js` for (a) rulers side by side with a changeover marker, (b) an
agency-published link drawn and labelled as the agency's, (c) growth computed inside each
base and drawn through the overlap. Plus a facts-sheet field naming the base of every
number (`pipeline/facts.mjs`). Move the existing two-ruler plates (WPI, IIP, GDP, CPI) onto
it without changing what they show. Read the header of `plumbing.js` first.

## F5: India Data Hub cross-check

`scripts/crosscheck-idh.mjs`: a manifest (`data/crosscheck/idh.yml`) pairing our bundle
series with IDH series ids; it reads IDH values from the Data Bank's parsed
`india_data_hub_series` through `databankQuery` (read-only), compares on overlapping dates
(after units and scale), and writes `pipeline/out/crosscheck-idh.json` (git-ignored: IDH is a
paid service and its values must never enter this repo or the site) plus a stdout summary:
pairs checked, matches, worst delta and date. Disagreement is a flag, not a gate failure.
Pair what exists now (the Data Bank mirrors ~916 IDH series, mostly payments, markets,
rates, FX, banking; find the pairs with our bundles); then write the list of IDH series
ids the Atlas would want for GDP, CPI, WPI, IIP, PLFS and trade into
`docs/status/framework.md` as a request for the Data Bank (do not edit the Data Bank
yourself; it is read-only for you).

## Ledgers for the 14 existing guides

For each existing guide (cpi, gdp, wpi, iip, external*, jobs, consumption, factories, aishe,
gender, mnre, nfhs, manufacturing, deposits): a catalogue generator (a `--catalogue` mode
in its adapter, enumerating what the source publishes through the same metadata calls the
inventory used: `docs/INVENTORY-data-paths.md`) and a ledger, until
`node scripts/coverage.mjs --strict` lists no guide without one. The gaps you find are
real: mark them `excluded` only with a reason about the data; otherwise mark them as
`baked` work you do now if it is quick, or leave them undecided and list them in your
status file as omissions for the coordinator to schedule (the gate will fail on them,
which is the point). MoSPI throttles and two other sessions use it: be polite.

\* `external` is being rebuilt by atlas-external: skip its ledger.

## Shared rules

Everything in `docs/briefs/README.md` applies, except the file-ownership line about
`src/charts/`: that is yours. Commit each of F6, F4, F5 and the ledgers separately.
