# Brief: state profiles (`profiles`, port 4427)

A new kind of page: one profile for every state and union territory, at `/states/<state>/`,
with an index at `/states/`. A reader from Patna or Kochi should land on one page that tells
them how their state lives, earns, spends, borrows, learns, falls ill and warms, how it
compares with India and with its neighbours, and where to go deeper. The guides answer "how
does this indicator vary across states?"; a profile answers "what is true of my state?".

**In launch scope** (owner, 2026-10-10).

**Order of work.** Build in this order, so nothing waits on MoSPI:
1. The state key and its tests.
2. The template and profile builder on already-baked bundles.
3. The Data Bank gaps (Handbook tables, state finances, farms): read-only, no network.
4. Wiring, qc, the index page and OG cards.
5. **Last, and only when the coordinator says the MoSPI audit (`lb/audit-refresh`) is
   finished:** the new MoSPI pulls (NSS rounds, Economic Census). Until then, ledger them as
   `blocked: waiting for the MoSPI audit` and keep going.

Everything in `docs/briefs/README.md` applies. Read it first, then the `states` guide
(`src/pages/guides/states.astro`, brief `docs/briefs/states.md`), which is the closest
existing work and the main data partner.

## Why this is feasible now

The site already bakes most of what a profile needs. Bihar alone appears in about 10,000
series across 17 families (PLFS 2,472, credit 2,391, ASI 1,579, deposits 725, NFHS 657,
gender 582, states 483, climate 373, HCES 348, CPI 326, ASUSE 205, AISHE 95, wages 41, MNRE,
CPI-AL/RL, CPI-IW, rates). The work is mostly assembly, selection and explanation, plus the
gaps below. It is not a new data pipeline per state.

## Sources

Start from baked bundles (`data/series/`); add new bakes only for real gaps. For each
section, record in your status file which bundles it reads.

Already baked, by guide (read; never modify another family's bundles):
- **Income and output**: `states-*` (GSDP, NSDP, per-capita NSDP, GSVA shares, real growth,
  2011-12 base), `states-hbs-*` (the RBI Handbook of Statistics on Indian States, 148 bundles).
- **Prices**: CPI 2024 and 2012 by state, CPI-AL/RL by state, CPI-IW centres.
- **Jobs and wages**: PLFS by state (unemployment, LFPR, WPR, by gender and sector), rural
  wages by state.
- **Households**: HCES MPCE by state, poverty where the source gives states, NFHS-5 (and
  NFHS-4) state tables, gender statistics.
- **Industry and business**: ASI by state and state x industry, ASUSE by state, MNRE capacity
  by state.
- **Money**: deposits and credit by state (BSR), credit-deposit ratios, branches.
- **Education and climate**: AISHE by state, CCKP state temperature and rainfall series.

Gaps to inventory and, where the source has them, fill (the inventory,
`docs/INVENTORY-data-paths.md`, lists what each source publishes):
- **Handbook of Statistics on Indian States**: all 159 distinct tables. Check which the
  `states` session baked and which it ledgered as excluded or archive; a profile may need
  some it set aside (farm output, power, roads, health infrastructure, state finances).
  Coordinate through the coordinator; never edit `states` ledgers yourself.
- **State finances** (inventory R4): deficit and debt to GSDP, own tax revenue, interest
  burden, from the Handbook or the RBI's State Finances tables in the Data Bank.
- **Farms** (inventory R9): crop output, area and yield by state, if the Data Bank has them.
- **NSS rounds 75 to 80** on MoSPI (inventory: "None" baked): state cuts of health,
  education, drinking water and sanitation, and household assets, if the API gives states.
- **Economic Census** (three rounds, district counts; `state` is a required parameter).
- **Population** for context: use the population each source divides by. Never compute a
  per-capita figure from a different population series.

Rules for sources (README, "Data sources", applies in full): the Data Bank is read-only;
MoSPI only through `scripts/lib/mospi.mjs`, one request at a time, and **check with the
coordinator before any MoSPI download**, since an audit refresh may be running; never
India Data Hub values.

## The state key (build this first)

One registry, `src/dossiers/states-key.js` (or `.mjs` shared with scripts): every state and
union territory with its canonical slug, display name, ISO 3166-2:IN code, LGD code, and the
spellings each source uses (MoSPI codes, RBI names, PLFS, NFHS, CCKP `IND.<n>_1` geocodes,
"Orissa"/"Odisha", "Pondicherry"/"Puducherry", "NCT of Delhi", "Jammu & Kashmir"). Map
every source's state labels through it, and fail loudly on a label it cannot place.

Boundaries change, and every comparison must respect the seam:
- Andhra Pradesh and Telangana split in June 2014.
- Jammu and Kashmir became two union territories (J&K, Ladakh) in October 2019.
- Dadra and Nagar Haveli and Daman and Diu merged in January 2020.

A profile shows the post-change unit. Pre-change figures appear only labelled as the old
unit ("undivided Andhra Pradesh, 2011-12 to 2013-14"), never joined to the new series.

## The page (one template, data-driven)

One Astro template, `src/pages/states/[state].astro`, with `getStaticPaths` over the state
key and a profile builder in `src/dossiers/profiles.js` that reads the bundles at build time.
Not 36 hand-written pages. Follow `docs/DESIGN.md` and design v2; elevate, never redesign.

Suggested sections (adapt to what the data supports; drop a section for a state the
sources do not cover rather than fill it):
1. **At a glance**: four to six headline figures (per-capita income, growth, unemployment,
   inflation, MPCE, CD ratio), each with the year, the all-India figure and the state's rank.
2. **Income and growth**: GSDP, per-capita NSDP over time, real growth against India.
3. **What the economy runs on**: GSVA shares (farm, industry, services) against India.
4. **Prices**: state CPI against all-India, food against core where the state cut exists.
5. **Work and pay**: unemployment, LFPR and WPR by gender, rural wages.
6. **How households live**: MPCE, poverty, NFHS outcomes (nutrition, anaemia, sanitation,
   women's bank accounts and phones), gender gaps.
7. **Money**: deposits, credit, CD ratio, branches.
8. **Industry and energy**: factories (ASI), informal enterprises (ASUSE), renewable capacity.
9. **Education**: AISHE enrolment and GER.
10. **Climate**: temperature and rainfall against the state's own history (CCKP).
11. **State finances**: deficit, debt and interest burden, if baked.
12. **Neighbours and peers**: the state against its neighbours and two or three peers by
    income on the headline measures.
13. **Go deeper**: links to every guide section and every-cut row that holds this state
    (row anchors: `everycut.js rowAnchor`), plus the state's downloads.

Ranking and comparison rules:
- Rank only among states with a figure for the same period, and say how many ("12th of 33
  with 2024-25 figures").
- Show each figure's own year. States report at different lags; never pretend they align.
- Never rank or compare across a seam (base year, survey design, boundary change).
- Union territories without a legislature are often missing from state accounts; say so,
  and never fill them.

Words on the page:
- **For launch, templated sentences only**, filled from the bundles in code (the pattern of
  `src/dossiers/periods.js`): "Bihar's income per person was ₹69,321 in 2024-25, the lowest
  of 33 states with figures for that year, and 34% of the all-India figure." Every number
  must come from a bundle, and qc must trace it.
- Generated prose (facts sheets, `pipeline/`) for 36 states multiplies model calls by 36.
  Propose it to the coordinator as a follow-up; don't do it in this brief.
- Plain Indian English, no em dashes, no AI tells (`pipeline/banned.txt`); "we do not know"
  where a source has no figure.

## Wiring

- Index page `/states/` (a map is optional; a sorted, searchable list is required), and a
  link from the `states` guide and from the home page's every-guide index. Agree the nav
  change with the coordinator, since `Base.astro` is shared.
- Site search: state names should lead to the profile. Ask the framework session (through
  the coordinator) to add profiles to `scripts/search-index.mjs` / `core.json`, or append a
  marked block there yourself if the coordinator agrees.
- OG card per profile (one generated template, not 36 hand-made images), sitemap, RSS
  untouched.
- qc: a `profiles` block in `scripts/qc.mjs`: every state in the key has a page; every
  rendered number on a sample of profiles traces to its bundle; no page shows a figure
  without its year; chart lint clean; page budget (CONTRACT-render) met.
- Tests: the state key maps every state label in every baked bundle (or the bundle is listed
  as national-only), and no profile reads across a seam.

## Owns

`src/pages/states/**`, `src/dossiers/profiles.js`, `src/dossiers/states-key.js`,
`src/dossiers/profiles.client.js`, `data/series/profiles-*.json` (new bakes only),
`data/coverage/profiles*`, `scripts/lib/products/profiles*.mjs`, `docs/status/profiles.md`,
`public/og/states/*`. Shared files are append-only, per the README.

## Done means

- Every state and union territory has a profile; every section either shows data with its
  year or says the source has none.
- The state key covers every state label in the baked bundles; seams are respected and
  tested.
- Gaps inventoried: each Handbook table, NSS round and Economic Census cut the profiles
  could use has a decision in your status file (baked, used from another family, or not
  used and why).
- `npx astro build`, `npm run gates`, `npm test`, `npm run prose:dry` green; looked at 1440
  and 390 px for five states of different shapes (Bihar, Kerala, Goa, Ladakh, Telangana).
- Status file written; message the coordinator `profiles: done`.
