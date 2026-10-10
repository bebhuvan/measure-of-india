# profiles: state profiles

Session `atlas-profiles`, branch `lb/profiles`, port 4427. Brief: `docs/briefs/state-profiles.md`.
Status: **steps 1 to 4 done; step 5 (new MoSPI pulls) blocked, waiting for the MoSPI audit.**
Updated 2026-10-10.

## What shipped
- **The state key** `src/dossiers/states-key.js`: 36 units (28 states, 8 UTs) with slug, name,
  ISO 3166-2:IN (2023 codes), LGD code, CCKP geocode, region, land neighbours, every spelling
  the baked bundles use; four former units (undivided AP, the J&K state with Ladakh, the two
  pre-2020 UTs); the three boundary seams. `sameTerritory()` decides when a figure labelled
  "Andhra Pradesh" or "Jammu and Kashmir" is the undivided unit's.
  Test `test/states-key.test.mjs`: every state label in all 1,616 bundles places, or the bundle
  is declared another geography (banks, cities, high courts, IMD sub-divisions) with a reason.
- **The profiles** `/states/<state>/` (36 pages, one template `src/pages/states/[state].astro`,
  builder `src/dossiers/profiles.js`, charts `src/dossiers/profiles.client.js`, formats
  `src/dossiers/profiles.fmt.js`). 91 measures in 12 sections, about 90 figures per state. Each
  figure: its own period, rank among units with the same period ("10th highest of 32"), the
  all-India figure on the same ruler. Templated sentences only; lived-reality lines (income a
  day, spending a day, the CD ratio per ₹100, prices per ₹100).
- Plates: where the state stands (9 measures, every unit), income per person over time, real
  growth against India's GDP, output shares against India, prices on two CPI rulers
  (`seamMarks` side), women and men at work, temperature since 1950 against 1951-80.
- Neighbours and peers table (land neighbours plus the three nearest in income), Go deeper
  (every guide with the count of series naming the state), and `/states/<state>.csv`: every
  series naming the state (Bihar 10,288) with latest value and a link to its every-cut row.
- **Index** `/states/`: sorted, searchable list with six headline figures each.
- **OG cards** `public/og/states/<slug>.png`, one generated template (block in `scripts/og.mjs`).
- **NFHS-6 (2023-24)** added at the owner's request (2026-10-10), from the owner's parse of
  the IIPS fact sheets: adapter `scripts/lib/products/profiles-nfhs6.mjs`, bundles
  `profiles-nfhs6` (10,600 series) and `profiles-nfhs6-nfhs5` (the NFHS-5 column the same
  fact sheets print), notes in `docs/reference/nfhs6-factsheets.md`. MoSPI's API has only
  NFHS-4 and NFHS-5.
- More HCES on the profiles (owner's question): food's share of spending, the poorest and
  richest 5%, Gini rural and urban, Scheduled Caste households' spending.
- **Round 2, from bundles already baked** (owner, 2026-10-10: "do it"): what the state's
  factories make (ASI by two-digit industry: value added, its share of the state's factory
  value added, people engaged); every district (deposits, credit, CD ratio, women's share of
  loans to individuals, as on 31 March 2026); solar and wind capacity; unemployment among
  graduates; CPI for farm labourers (y/y computed from the base-2019 index, India the same
  way); farm and personal loans as shares of bank credit; women among MLAs; extra days above
  35°C by 2040-59 on SSP2-4.5 and SSP5-8.5 (CMIP6 median); what the state pays to borrow
  (SDL cut-off yield, the last full financial year).
- Coverage `data/coverage/profiles.yml` (generator `scripts/lib/products/profiles.mjs
  --catalogue --ledger`): 3,929 items, 3,491 shown, 241 baked, 187 excluded, 10 blocked.

## Checks
- qc `profiles` block: every figure on all 37 pages re-read from its bundle by qc's own
  evaluator and rendered through the profiles' formats (8,031 on the first full run, all
  matched); every figure sits beside a period; each page under 1 MB; every unit has a page and
  a CSV. Five profiles (Bihar, Kerala, Goa, Ladakh, Telangana) run their charts in the PAGES
  harness; lint-charts covers all 36.
- `test/profiles.test.mjs`: every unit builds; no figure reads a former unit's series; AP and
  J&K figures before the split stand only where the source carries the successor; ranks count
  exactly the units with the same period; every figure has a format and a period.
- NFHS-6 parse: 2,486 of 2,499 NFHS-5 cells agree with MoSPI's NFHS-5; every total between
  urban and rural; Bihar checked by hand against the PDF (stunting 35.6%, insurance 21.1%,
  women's bank accounts 90.9%, men's tobacco 45.8%).

## Decisions (for HISTORY)
- **Ties are not ranks** when many units share a zero (no wind capacity); a shared value
  elsewhere reads "joint 5th highest".
- **State borrowing reads the last full year**: the newest financial year on the axis is still
  being auctioned.
- **District sums**: district deposits and credit are the sums of the published population
  groups (rural, semi-urban, urban, metropolitan), named as such on the page and re-added by qc.
- **qc and lint-charts import each page's scripts with a per-page query**, so an entry module
  that 36 pages share runs on every page. Before, only the first profile's charts were checked
  (a one-line change in each harness).
- **Rank at the comparison period.** MoSPI's newest state year comes from a few states first
  (2025-26: 15 states). Each measure ranks at the latest period at least three in four units
  report; a newer figure is given beside it with how many have published.
- **No all-India income per person.** MoSPI publishes none on the 2011-12 base beside the
  states (the national 2011-12 NNI is not baked); the profile ranks and shows the middle state
  of the states guide's fixed panel instead. India's real growth is computed from MoSPI's
  2011-12 GDP levels, labelled.
- **Former units** appear once per section, under their own name and period, never compared.
  J&K's income chart draws the J&K state (to 2018-19) as its own ruler.
- **CCKP** draws Dadra and Nagar Haveli and Daman and Diu separately and no J&K or Ladakh: the
  merged UT's climate figures appear as the former territories', J&K and Ladakh say none.
- **NFHS-6 against NFHS-5:** each NFHS-6 figure is compared with the NFHS-5 figure the NFHS-6
  fact sheets print (same definitions), not MoSPI's NFHS-5 (which the fact sheets restate for
  some indicators). Anaemia, sanitation, cooking fuel and sex ratio at birth stay on NFHS-5.
- **The PDF is not in git**: named by URL and sha256 in sources.yml and the raw dump; the parse
  CSV is archived whole in `data/raw/profiles-nfhs6.json.gz`.
- SDG India Index scores (Handbook t106) left off: the Handbook dates each edition at March of
  a year and we have not confirmed which edition each date is.
- Templated sentences only, as the brief says. Generated prose for 36 states is proposed as a
  follow-up (36 times the model calls).

## Handbook tables (all 182; each has a decision in the ledger)
- **Shown on profiles** (20): t001 school GER, t004 IMR, t007 life expectancy, t010 MPI, t017
  hospital beds, t053, t055, t057, t062, t084, t091 (farms), t112, t113, t115 (rural wages),
  t138, t148 (power), t166 and t170 (interest burden), t181 (exports).
- **Baked, in the states guide, not on profiles**, by group with the reason in the ledger: state
  domestic product reprints (t019 to t052: profiles read MoSPI directly); SRS births and deaths;
  old-design unemployment (another ruler); tourism; doctors and health spending; crop-by-crop
  output, livestock and storage; forests, IMD rainfall, heat and cold waves, groundwater; CPI
  averages; horticulture wages; ASI reprints and small industry; roads, rail, telephones,
  schools; bank reprints (profiles read the RBI's quarterly tables); budget lines.
- State finances (inventory R4): deficit, debt and own tax as the states guide computes them,
  plus interest against revenue spending (t170 over t166, both actuals). Farms (R9): from the
  Handbook, as above. Nothing new baked for either.

## Wiring (coordinator's answers, 2026-10-10)
- **Nav**: a "States" entry beside Guides (marked block in `src/layouts/Base.astro`); profiles
  and the index set `nav="states"`.
- **Home page**: a "Your state" entry point above the every-guide index, every unit linked
  (marked block in `src/pages/index.astro`).
- **Site search**: `core.json` carries `profiles` (name plus every spelling in the state key;
  block in `scripts/search-index.mjs`); `search-core.js quick()` returns `states`, `lead` when
  the query is the unit's name; the home page shows a leading "State profile" result above the
  series. Tests: 6 spellings plus a mixed query in `test/search.test.mjs`; qc checks six
  spellings against the built core.
- **NFHS-6 in the nfhs guide** (done, the coordinator brought it forward): `profiles-nfhs6` and
  `profiles-nfhs6-nfhs5` in the nfhs registry entry (marked block) as a third ruler; one note on
  the page (§02) on where NFHS-6 comes from and how it was checked; margin note iii updated
  ("NFHS-6 will be the third point" was no longer true). No new plates, prose not regenerated.
  The guide's every-cut now lists 37,634 series.
- **Step 5 prepared** (`scripts/lib/products/profiles-mospi.mjs`): UDISE+, Time Use, EnvStats,
  NSS 75 to 80 as three resumable phases (A lists, B filters and page 1 for the expected row
  counts, C every page checked against B), fenced behind `PROFILES_MOSPI_GO=1`; `--plan` and
  `--status`. The Economic Census needs a manual discovery step: no record endpoint is known.
- **Not to start**: new external sources (SHRUG, Census PCA, data.gov.in, MGNREGA, TCPD); the
  coordinator is taking the scope to the owner.

## Blocked
- **NSS 73, 75 to 80 and the Economic Census** (brief step 5): `blocked` in the ledger, waiting
  for the coordinator to release MoSPI after the audit (lb/audit-refresh).

## For the coordinator
- Shared files touched, each one marked block: `data/sources.yml` (family `pdfparse`, dossier
  `profiles-nfhs6`, seams `profiles-nfhs6`), `scripts/fetch.mjs`, `scripts/validate.mjs`,
  `scripts/qc.mjs` (PAGES entries and the profiles block), `scripts/lint-charts.mjs` (PAGES),
  `scripts/og.mjs`. One sentence added to `src/pages/guides/states.astro` §09 linking `/states/`
  (another family's page: please keep or move).
- Asks (1) to (3) answered and done or scheduled: see Wiring above.
- Not done, worth doing: CPI-IW centres mapped to states; generated prose per state.
