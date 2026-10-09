# worldbank family: status

Session: atlas-worldbank, branch `lb/worldbank`, port 4409. Guides: `poverty`, `population`.
State on 2026-10-09: **done**. Build, gates, `npm test` (27/27), `prose:dry` green; chart lint clean.

## What is built

- **WDI, the whole India catalogue** (`wdi-india.mjs`). 1,498 indicators listed, 1,395 with
  India data, all baked into 22 topic bundles (`population-wdi*`, `poverty-wdi`,
  `worldbank-<topic>`). Ledger `data/coverage/worldbank.yml`: 6 shown, 1,389 baked, each
  topic rule naming the guide that covers it from its primary source.
- **Poverty guide** (`/guides/poverty/`, PIP release 2026-09-22, 2021 PPP). Nine surveys
  1977-78 to 2023-24, one bundle per comparable spell, plus the lineup. Plates: the line
  ladder with each line in rupees; every survey, spells never joined (seamMarks); the decade
  without a survey; counts and depth; Gini and deciles; every poverty figure people quote
  (PIP lines, societal line, Tendulkar national line, two multidimensional measures).
  Ledger: 218 items, 42 shown, 165 baked, 11 excluded, 0 pending.
- **Population guide** (`/guides/population/`, UN WPP 2024 plus WDI). Estimates 1950-2023
  and projections to 2100, never joined; the long curve with 80% and 95% ranges, pyramid,
  median age, working-age window (peak 2034), dependency, fertility, births and deaths,
  life expectancy, cities, migration, all 18 projection variants. Ledger: 905 items, 159
  shown, 635 baked, 111 excluded (a WPP file defect), 0 pending.
- Every-cut table on both guides; prose generated (DeepSeek) for both slugs and read by
  hand against the facts (one population draft regenerated: it blurred estimate and forecast).
- Also, for the framework session: `manufacturing` now has a `sources.yml` entry (product
  `worldbank-wdi`), its adapter takes the newest per-indicator WDI stamp as vintage, and
  its 10 pending ledger items are decided (baked in the WDI topic bundles).

## Decisions (and why)

- **WDI via the per-country bulk zip**, not 1,500 API calls: the World Bank host's firewall
  blocks bursts, `source=` and `;` lists, then the whole IP for minutes, and calls took
  ~20 s each. The Data Bank's `worldbank_indicators` holds only 17 India indicators.
- **Every WDI indicator baked, none excluded**: baking is cheap and the topic owner is named
  in the ledger. Bundles with no guide yet are downloadable at `/data/`.
- **WDI bundles carry `meta.dossier: worldbank`**; the guides draw from PIP and WPP directly,
  because WDI joins non-comparable surveys and runs estimates into projections.
- **One bundle per PIP comparable spell**, each a base in `sources.yml seams:`; the lineup
  its own base, nowcasts in separate `*_nowcast` series. A spell of consecutive yearly
  surveys (HCES 2022-23, 2023-24) is `annual`, the rest `irregular`.
- **Projections from UN WPP directly**: the WB's projection source (40) is firewall-blocked,
  and WPP is the primary source. Projection lines start at the first projected year; they
  never touch the estimates.
- **Prose covers the current ruler only**: facts.mjs refuses other rulers in the sheet, so
  the poverty prose sees only HCES 2022-23 and 2023-24, and the population prose only the
  estimates. Derived `population_billion` / `population_crore` series exist so prose can cite
  the total in a reader's units.
- Units renamed to avoid clashes with the shared every-cut `UNITS` (e.g. `ratio` there means
  females per 1,000 males): `males_per_100_females`, `gini_index`, `coefficient`, `multiple`,
  WDI `usd` / `lcu` / `ppp_usd` instead of one `money` class.

## Source quirks

- PIP serves India at national level only: no rural or urban rows, and WDI has no rural or
  urban poverty series either. The guide says so and links the consumption guide.
- WPP 2024 OtherVariants: LE15/65/80 and Q5/Q00xx/Q15xx are garbled in the five
  probabilistic-interval variants (India and China alike). Not baked, excluded in the ledger.
- WDI's source-level `lastupdated` (07-13) lags indicator updates (10-08).
- Full notes: `docs/reference/worldbank.md`.

## For the coordinator

- **Manufacturing page will need a re-read when its data next refreshes.** With the new
  `sources.yml` entry, `npm run data` advances `wdi-manufacturing-tech` to 2024 and
  `wdi-manufacturing-exports` to 2025 (WDI 2026-10-08). The page hand-types "2022" and
  "2024" as those series' last years in several places (sub, plate value, notes), and the
  asof gate will fail `manufacturing#cb-tech` until someone re-reads it. I tested the refresh,
  then restored the committed manufacturing data so this branch stays green.
- Shared files touched outside the append list: `scripts/lib/net.mjs` (appended a
  self-contained `getBuffer`), `scripts/lib/worldbank.mjs` (pacing, firewall wait, `pip()`,
  `wbCountryZip()`), `scripts/fetch.mjs` (two import lines and one `Object.assign` line),
  `src/dossiers/register.client.js` (appended block), `pipeline/lib/series-kws.mjs` (two
  entries), `src/dossiers/everycut.js` (one block per table), `scripts/lib/products/worldbank-wdi.mjs`
  (vintage fix), `data/coverage/manufacturing.yml` (pending decided).
- Registry numbers `no: "15"` (poverty) and `"16"` (population) may clash with other families.
- India Data Hub: no series in the Data Bank's `india_data_hub_series` matches these bundles
  (searched population, poverty, fertility, life expectancy, Gini, migration; 2026-10-09).
- This guide reads no other family's bundle; it links the consumption, jobs, NFHS, gender and
  external guides.
