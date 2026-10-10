# datafix: data fixes from the read-through

Brief: `docs/briefs/datafix.md`. Branch `lb/datafix`. Every fix is in an adapter, rebaked
offline from the archived raw (or the local Data Bank), with a check so it cannot come back.

## State (2026-10-10)

All five items done. `npx astro build` (1,148 pages) and `npm run gates` green in a slot
(validate, coverage 42 ledgers, as-of, qc, chart lint 855 SVGs clean); `npm test` 66/66;
`prose:dry` green. Facts sheets changed in two title strings only (climate, gdp), no figure, so
no prose was regenerated. Looked at /register/, gender, mnre and external at 1440 and 390, and
the home search for three state queries (profile first, then the state's own row). dist deleted.

## 1. Zeros that mean "no estimate"

The gender compendium API serves PLFS blank cells as 0. Sweep of all 2,288 bundles found the
same class in six more sources. Each fixed by a rule read from the data, never a cell list:

| Where | What the 0 was | Rule (adapter) |
|---|---|---|
| gender t087, t088 (PLFS wages) | women's casual wage Rs 0 a day in 23 cells, hourly wage 0.00 in 72 | a wage is never 0 (`zeroNone`) |
| gender t084, t092, t095 | Chandigarh rural 2025: WPR, informal share, unemployment all 0.0 | a PLFS domain whose all-persons WPR is 0 was not sampled: every PLFS table's cells for it are "no estimate" |
| gender t064 (and the other GPI tables) | Ladakh GPI 0.00 in 2018-19 | a parity index is never 0 |
| gender t078, t133 | Ladakh before it existed | shared rule below |
| trade-dbie-uvi-1999/2012 | 67 commodity indices printed as 0 in every year, more 0s inside series | an index is never 0: gap; an all-0 line is not baked (`dbie-trade.mjs`) |
| external-rupee-155 | rupiah Jan 2018 (no quote); old Turkish lira and Zimbabwe dollar below 4 decimals | an exchange rate is never 0 (`external-flows.mjs`) |
| aishe-ptr, aishe-states-ger | Lakshadweep pupils per teacher 0 (no college counted); GER 0 for SC in Arunachal, Nagaland, A&N, Lakshadweep, ST in Delhi, Haryana, Punjab, Chandigarh, Puducherry | a ratio with no base is no figure (`aishe.mjs`) |
| asuse-t30/t31, services-asuse | emoluments per hired worker 0 for own-account establishments (they have no hired workers) and empty cells | rupees per worker or per establishment, tables 30 to 35, never 0 (`asuse.mjs` `noEstimate`, shared with `services.mjs`) |
| states-hbs t059, t066, t068, t100, t151, t172, t181 | Telangana 2004-05 to 2013-14 (capital receipts 0), Ladakh before 2019 | a state's 0s before it existed (`states.mjs` `hbsValue`) |
| states-hbs t081, t086 | cotton and wheat yield 0 in 2016-17 to 2019-20 for ten states | a yield is never 0 |
| credit-deep-dccb-states, profiles-mospi-env-0-114..128 | Telangana co-op banks March 2014; Ladakh disease cases before 2019 | shared rule below |

Shared rule: `util.mjs` `STATE_BORN` / `bornStandIns` / `nullBornStandIns`: a state's figures
before it was formed are stand-ins when every one of them is 0 and the series has a non-zero
figure after formation (a landlocked state's water transport and a warm state's frost days stay).

Side effects worth knowing: Telangana's pre-2014 zeros used to hide the undivided Andhra Pradesh
in HBS tables 100 and 172; those tables now split `andhra_pradesh_undivided` like the others.

Check: `validate.mjs` "no-estimate zeros" (`NONZERO` classes by unit and label: exchange rates,
index levels, GPI and pupil-teacher ratios, yields, wages per person, rupees per worker, WPR and
LFPR for whole populations, GER; plus the state-before-formation run). 27,093 series checked.

Reviewed and left alone (0 is a real value or cannot be told from the source): ASI wage bills
(an industry with no factories), HCES item values rounding to Rs 0, NSS 0 medical spending on
a system of medicine (no case in the sample), PLFS narrow age and education cells, IMR 0 in
Delhi rural and Kerala urban female (SRS small samples), worldbank flows, payments values of
discontinued systems, DBIE balance-sheet lines, climate day counts.

## 2. MNRE

- `mnre-sources.large_hydro`: null before it enters the table; the entry month (December 2023)
  is read from the data and written into every MNRE bundle's note and the series label.
  The old note said "January 2023" in one place; now derived.
- `mnre-solar-categories`: off-grid and hybrid zeros are not capacity. Evidence from the table
  itself: off-grid reads 1,150.64 MW in March 2021, 0 in April and May, 1,272.49 MW in June, and
  the published solar total drops by the same amount in those two months. Rule for every MNRE
  series: a cumulative stock never falls to 0 and comes back (gap); an All-India category's
  zeros before its first figure are "not counted yet" (empty, note names the entry month:
  off-grid March 2021, hybrid April 2022, waste to energy off-grid likewise). A state's leading
  zeros are kept (a state can have had no capacity). Not settled from the source: whether
  hybrid capacity existed before April 2022 (MNRE's archive pages were not checked); we show
  no figure before then, which is the honest reading either way.
- Registry `register.unit` and `historyCol` for mnre are tokens (`{span}`, `{n} months`) that
  `periods.js fillPeriods` fills from the bundle on the register page. Test: no register text
  types a span's end or a period count.
- Not changed, for the coordinator: the published Grand Total carries the large-hydro step in
  one series (a coverage break inside a series; rule 1 says separate rulers). The page draws
  the break; a split into two bundles is a page change for the mnre owner.

## 3. Ratios carrying a money unit

- `external-debt-annual(-inr)` E.9 reserves to total debt: `percent`, label says "per cent"
  (`external-dbie.mjs unitFor`: a "ratio" or "share of" label is a per cent).
- Sweep found more: `credit-deep-coop-balance-sheets` (NPA percentages as ₹ crore),
  `credit-deep-priority-sector-banks` (% of PSA to ANBC stored as ₹ crore and divided by a
  crore: 0.0000039; now 39 to 43 per cent against the 40 per cent target),
  `credit-deep-tp-nbfc-*` (CME as per cent of assets; leverage ratio, now `times`, 4.2),
  `states-hbs-t177` (guarantees per cent of GDP as ₹). Fixed in `credit-deep.mjs RATIO_ROW` and
  `states.mjs hbsUnit`.
- Test: `test/units.test.mjs` sweeps every bundle for a ratio-labelled series with a money unit.

## 4. Jargon in titles

Moved to `meta.note` or written in words, at the adapter: HCES state key note, deposits-population
key note (`bsr2.mjs`), API field names in 139 profile-bundle titles (`profiles-mospi.mjs`
`fieldWords`), OWID dataset ids in climate titles and snake_case labels of the youth-opinion
bundle (`owid-climate.mjs`), `saving_rate` in the GDP accounts title (`nas.mjs`), backtick quotes
in credit labels, "infIow/materiaIs" in a markets table (label only; keys keep the source spelling).
OWID and NAS bake only from the network: `scripts/migrations/2026-10-datafix-reader-text.mjs`
applies the adapters' own functions to the baked bundles (titles and labels only).
Check: `scripts/lib/reader-text.mjs`, run by `qc.mjs` and `test/reader-text.test.mjs`.

## 5. Search

`search-index.mjs` writes `core.own`: the rows each state profile quotes (profiles.js MEASURES),
glance measures marked. `search-core.js`: when a query names a state (any spelling) and its other
words are the row's topic (label, bundle title or guide, not the source line), the state's own
rows gain 2 (a glance measure a quarter more); the profile leads when the rest is a topic the
site covers. Also: "prices" means inflation and is no longer matched by "at current prices";
synonyms take plurals; "gdp" finds GSDP; a state named as "Orissa" finds rows labelled Odisha.
Real index, before and after: "inflation in kerala" opened on CPI-RL, now Kerala's CPI;
"unemployment in punjab" opened on a rural young men's cell of the old PLFS design, now the state's headline rate;
"bank deposits maharashtra" opened on foreign banks' deposits, now the state's deposits.
Tests: eleven state-and-topic queries in `test/search.test.mjs` (with a control that fails
without the boost); ten on the real built index in `qc.mjs`.

First gates run caught one regression of mine: dropping "prices" after "current" from the index
but not from the query broke finding seven GDP and state rows by their own label; the query now
uses the index's tokens (commit bb03529), 1,171 sampled labels all found.

## Decisions

- Zeros become gaps with a note on the series, never a fill; series left with no figure are not
  baked (counted in `meta.omitted` for gender).
- Offline rebake switches added where missing: `AISHE_FROM_RAW`, `ASUSE_FROM_RAW` (staged
  archive, sha256-checked against the index), `SERVICES_ASUSE_FROM_RAW`, `MNRE_FROM_RAW`,
  `STATES_FROM_RAW`; gender `--bake` and `HCES_FROM_RAW` read the gzipped raw (they were broken
  since the raw-gzip migration). MNRE and services-asuse bundles now carry the data's vintage,
  not the run date.
- `validate.mjs`: the copied-runs block ran after the final exit, so its failures never failed
  the gate; the exit now comes last.

## For the coordinator

- `bsr2.mjs` turns `data/raw/bsr2-tables-index.json` into `.json.gz` on every run (writeRaw);
  index files are meant to stay plain (`raw-gzip.test.mjs`). Restored by hand here; the adapter
  (deposits family) should write it with writeJson.
- MNRE Grand Total spans the large-hydro coverage break in one series (see item 2).
- `trade-dbie` ledger lists a few unit-value lines that are now not baked (printed 0 in every
  year); coverage stays clean but the ledger could say why.
