# PLAN: the launch build

Written 2026-10-09. Owner's brief, in their words: the canonical place people go to see
India's economic and financial statistics *and understand them*, connected to how an
Indian lives; every major family from MoSPI, RBI DBIE and the other official sources;
LLM commentary that cannot hallucinate because it writes only from data packets; and
comprehensiveness as the reason people come: "if we are trying to explain a family of
indicators, we need to explain all the indicators across different granularities."

Progress lives in `docs/STATUS-launch.md` (short, phone-readable). This file is the plan;
change it when the plan changes, and say why in `docs/HISTORY.md`.

## 1. The launch bar

The site goes live when every family below is in a guide and each guide passes the
definition of done (section 6). Families in launch scope:

| # | Family | Guide | State today | Launch work |
|---|---|---|---|---|
| A | Jobs (PLFS) | `jobs` | monthly, quarterly urban, annual headline, UR by state, status, earnings, education | calendar-year estimates 2023-25 (new design, a seam); LFPR and WPR by state x gender x sector; religion, social group, age, NIC and NCO cuts; quarterly bulletin for 23 states; retest indicator 5 |
| B | National accounts | `gdp` | both bases, quarterly and annual accounts, expenditure, 8 then 15 industries, back series to 1950-51 | sub-industries (18), institutional sectors (saving, capital formation), revision stages as a plate |
| B2 | State economies | new `states` | none | GSDP, NSDP, per-capita NSDP, GSVA by industry for every state, 2011-12 base; RBI Handbook of States as the second view |
| C | Prices | `cpi`, `wpi` | CPI 2012 and 2024 (items, states), CPI-AL/RL, WPI both bases | CPI 2024 by state x division and sector x division, classes and sub-classes; CPI 2012 from 2011 and its 299 items; CPI-IW (Labour Bureau, via DBIE); the 2010 base as a labelled ruler |
| D | Industry | `iip`, `factories`, `manufacturing` | IIP four bases, ASI 2-digit and states, ASUSE to 2023-24, WDI | eight core industries (DBIE); IIP and ISP annual series; ASI at 3 and 4 digits and state x industry, all 57 indicators; ASUSE 2025 round and latest quarter |
| E | Services | new `services` | ISP only, inside another guide | ISP (19 sub-sectors), services GVA by sub-industry (NAS), services exports and imports by category (DBIE BoP), informal service enterprises (ASUSE), services employment (PLFS NIC cuts) |
| F | Trade | new `trade` | `rbi-trade*` from MoSPI's RBI mirror, ending 2024-25 | TradeStat: exports and imports by HS 2, 4 (and selected 6/8) digit, by country and region, monthly and annual, US$ and ₹ and quantity; DBIE: the long monthly headline, oil and non-oil, services trade |
| G | External account | `external` | BoP to Q1 FY26, reserves to Jun 2025, via MoSPI's mirror | move to DBIE: BoP to the latest quarter with vintages, weekly reserves, international investment position, external debt, REER and NEER, FDI and FPI (portfolio flows), ECBs, LRS remittances, rupee invoicing |
| H | Money and credit | new `credit` (with `deposits`) | deposits guide (BSR-2) | bank credit by sector and industry (2007 on), food credit, deposits and credit fortnightly (1997 on), M3 and reserve money, credit-deposit ratios by state, NBFC credit; banking health (NPAs, CRAR) as a section or its own guide |
| I | Interest rates and monetary policy | new `rates` | none | policy rates since 1935, every MPC decision and vote since 2016, WALR, WADTDR, MCLR by bank group, call rate, T-bill and G-sec yields, auctions |
| J | Work, the ILO's estimates | new `ilo` | none | ILOSTAT modelled and survey series for India at every breakdown; a separate instrument from PLFS, never spliced (added 2026-10-09 at the owner's request: clean and dense) |
| K | Climate | new `climate` | none (`mnre` covers renewable capacity) | temperature, rain, heat days, emissions, energy mix, projections: Our World in Data and the World Bank Climate Change Knowledge Portal (ERA5, CRU, CMIP6, Global Carbon Project) |
| L | World Bank | new `poverty`, `population` | WDI in `manufacturing` | the whole WDI India catalogue baked and ledgered; PIP poverty and inequality; population and demography |
| M | BIS | new `housing`, `debt` | none | BIS series baked as `bis-*` for every guide to use; residential property prices with RBI's HPI; total credit by sector, credit gap, debt service ratios |

Not in launch scope (they follow, in the inventory's order): time use, schools (UDISE+),
public finance, payments, energy balance, environment, gender to 2025, NFHS fuller,
household-survey rounds, farms, markets, company finances. The framework built for
launch is what makes each of these an afternoon of configuration plus a guide, not a
project.

## 2. Comprehensiveness, made mechanical

The census (`scripts/census.mjs`) proves a guide has seen everything *we baked*. Nothing
today proves we baked everything *the source publishes*. That is the gap the owner's bar
exposes, and it gets closed before any family is built:

**The coverage ledger.** One file per family, `data/coverage/<family>.yml`, listing every
indicator the source publishes and every cut of it (state, sector, gender, age, item,
industry digit, partner, unit, frequency), each with one status:

- `shown`: baked and drawn on a plate (the ledger names the plate);
- `baked`: in a bundle, in the census and the facts sheet, downloadable from
  `/data/`, but not drawn (the guide's data table lists it);
- `excluded`: deliberately left out, with the reason in one sentence a reader would
  accept (source broken, sample too small to publish, duplicate of another cut);
- `blocked`: the source fails; the ledger records the error and the date.

The ledger is generated, not typed: each adapter enumerates its source's catalogue
(the MoSPI metadata calls, the DBIE report catalogue, TradeStat's pickers) into
`data/coverage/<family>.catalogue.json`, and `scripts/coverage.mjs` fails if any
catalogue entry has no status, or if a `shown`/`baked` entry has no bundle behind it.
`npm run gates` runs it. Omission becomes a failing gate, which is what `GOAL.md` asks
("the gates fail on omission, not only on error").

**Every granularity, readably.** Comprehensive does not mean every cut gets a chart.
Each guide shows the cuts that carry a finding on plates, and makes every other cut
reachable: the guide's data section lists every bundle and series with a download, and
a "Every cut" explorer table per family (sortable, filterable, built at render time from
the bundles, no client fetch) covers the long tail (all 358 CPI items, all HS chapters,
all states). A reader can always get from the headline to the finest cut the source
publishes.

## 2b. The deep archive (owner's decision, 2026-10-09)

Some sources publish a finer grain than a chart bundle can carry: RBI district and centre-wise
credit tables (about 10 million rows), the ILO's three-way survey cubes (about 950,000 cells),
climate cuts by state and month. They are neither dropped nor forced into `data/series/`.
Ledger rules mark them `archive: true` with `rolls_up_to` (`docs/CONTRACT-coverage.md`).

- **Host:** a public Hugging Face dataset, `huggingface.co/datasets/bebhuvan1/india-atlas-archive`
  (the owner's account; uploads use the token already on the build machine, never one in
  the repo). Chosen over Cloudflare R2: free for public data, every upload is a commit (so
  each data vintage is kept and citable, which fits rule 5), a table viewer for readers,
  and a place researchers already look. The manifest makes an R2 mirror possible later.
- **Format:** Parquet per cut (HF's viewer reads it), plus gzipped CSV for spreadsheet users.
  Same long shape for every file: the cut's dimensions, date, value, unit, source, vintage.
- **Manifest:** `data/archive/manifest.json`, committed: for each file, the ledger rule it
  comes from, source, rows, sha256, vintage, the HF commit it was uploaded at, and the baked
  bundle it rolls up to. The every-cut table links each `rolls_up_to` bundle to its archive
  files.
- **Builder:** `scripts/archive.mjs` reads every `archive: true` rule, exports through the
  family adapters' raw readers, writes locally (git-ignored), verifies row counts against the
  catalogue, uploads, and updates the manifest. Run after the trade and credit families merge.



| Transport | Used for | Reader | Status |
|---|---|---|---|
| `mospi` | MoSPI eSankhyiki API (all MoSPI products) | `scripts/lib/mospi.mjs` | live |
| `worldbank` | WDI | `scripts/lib/worldbank.mjs` | live |
| `databank` (webi raw) | any of the 1,243 DBIE reports mirrored as raw CSV | `scripts/lib/databank.mjs` `dbieReport()` | live (deposits) |
| `databank` (parsed) | the Data Bank's typed datasets: policy rates, MPC, lending rates, auctions, sectoral credit, forex reserves, CAS money tables | new `databankQuery()`: runs `uv run databank query sql <dataset> "<sql>" --json`, so the Data Bank's own publication rules choose the rows | to build |
| `tradestat` | Ministry of Commerce TradeStat (EIDB, MEIDB, FTPA) | new `scripts/lib/tradestat.mjs`: token, cookie, POST, table parse | to build; see `docs/reference/tradestat.md` |
| `idh` (cross-check only) | India Data Hub, a paid service: a baseline to corroborate our numbers | new `scripts/crosscheck-idh.mjs` reading the Data Bank's `india_data_hub_series` | to build |

Rules for each:

- **The Data Bank is read-only from here.** Refreshing it (DBIE mirror, IDH series) is
  done with its own CLI under its own rules; adding a dataset or an IDH series is Data
  Bank work, recorded in its `docs/CURRENT_STATUS.md`. The Atlas never calls DBIE live.
- **India Data Hub never reaches the site or this repo.** IDH is licensed data. The
  cross-check reads IDH values from the Data Bank, compares them to our bundles, and
  writes only a report (`pipeline/out/crosscheck-idh.json`: series pairs, match or
  delta, worst date) that is git-ignored. Disagreement is a flag to investigate, not a
  failure: IDH is a baseline, not the truth. The Data Bank today mirrors 916 IDH
  series, mostly markets, payments, rates and banking; macro series (GDP, CPI, IIP,
  trade) have to be added to its IDH update config first.
- **Source of record.** MoSPI for CPI, WPI, IIP, GDP, PLFS, ASI, ASUSE. RBI for money,
  credit, rates, the external account. Ministry of Commerce (TradeStat) for commodity
  and partner trade. A copy from another agency is a cross-check, never a second guide.

## 4. Seams

Settled by the inventory and hard rule 1. Points 1 and 4 of the inventory's proposal
are built (`seams:` in `sources.yml`, validated). Still to do, before the families that
need it: the shared chart treatment (side-by-side rulers with a changeover marker;
agency-published links only; growth computed inside each base and drawn through the
overlap) in `src/charts/plumbing.js`, and a facts-sheet field naming the base of every
number. New seams in launch scope: PLFS agricultural to calendar years; CPI-IW bases;
HS 2017 to HS 2022 at 6 and 8 digits; NIC classifications in ASI.

## 5. Order of work

Framework first, because every family depends on it:

1. **F1** coverage ledger and `scripts/coverage.mjs`, wired into `npm run gates`, with
   ledgers back-filled for the 14 existing guides (this will surface real omissions in
   finished guides; each becomes `shown`, `baked`, or `excluded` with a reason).
2. **F2** `databankQuery()` for the Data Bank's parsed datasets.
3. **F3** `scripts/lib/tradestat.mjs` and its catalogue enumeration.
4. **F4** the seam chart treatment and base-of-number facts field.
5. **F5** the IDH cross-check (and the Data Bank config change for macro series).
6. **F6** the "Every cut" explorer component.

Then the families, in this order (staleness and reader value first):
**G** external account on DBIE (the most visibly stale page), **F** trade, **H** money and
credit, **I** rates, **B2** state economies, **E** services, **A** jobs deeper, **D**
industry deeper, **C** prices deeper, **B** national accounts remainder. Then the launch
pass (section 7).

## 6. Definition of done, per guide

1. Adapter in `scripts/lib/products/`, registered in `data/sources.yml`, archived to
   `data/raw/` (never hand-edited), catalogue enumerated for the ledger.
2. Bundles per `docs/CONTRACT-series.md`: one instrument per bundle, no splices, `null`
   for missing with gaps declared on the series, `meta.vintage` as the data vintage.
   Family identities and ranges in `scripts/validate.mjs`. One value per bundle checked
   by hand against the agency's own publication, recorded in the adapter's header.
3. Coverage ledger complete: every catalogue entry `shown`, `baked`, `excluded` or
   `blocked`.
4. Guide per `docs/CONTRACT-dossier-structure.md` (broad, context, granular cuts,
   misreadings), registry, headline, periods, OG card, qc PAGES, asof manifest, prose
   slots; lived-reality translation in every section; the every-cut explorer.
5. Gates: `npx astro build`, `npm run gates` (now including coverage), `npm test`,
   `npm run prose:dry`; prose generated and passing verify and lint, and read by hand
   against the data (the verifier cannot yet catch a sentence that contradicts its own
   paragraph).
6. Looked at: rendered at 1440px and 390px, every chart read, one share image
   downloaded.
7. Recorded: `STATUS-launch.md`, `HISTORY.md`, the docs it touched, the inventory box
   ticked. One commit per guide.

## 7. The launch pass

Every guide read end to end at both widths; `docs/RELEASE-CHECKLIST.md` in full; the
home page, guides index, search, RSS and OG cards show all guides; redirects; the
deploy workflow dry-run; domain and analytics confirmed with the owner; a final
`npm run gates` on the release commit; the owner merges.

## 8. How the work is run

- Branch `launch-build` off `main` (checkpoint `77384bd` holds the 2026-10-09 work).
  `main` stays the last released state; the owner merges.
- One commit per framework piece and per guide, each with the gates green at that
  commit. Nothing is pushed without the owner asking.
- Families are built in parallel by separate Claude Code sessions (not subagents: the
  owner's call on cost), each in its own git worktree branched from `launch-build`, named
  `atlas-<slug>` for Remote Control, following `docs/briefs/README.md` and its family brief.
  The coordinator merges each back one at a time with the gates re-run after each merge. Shared files (registry, sources.yml, qc PAGES, og.mjs,
  the asof manifest, slots.yml) are append-only edits, so merges stay mechanical.
- One session owns this work tree at a time. On 2026-10-09 the earlier sessions
  (inventory, design, build) were asked to stand down and confirmed idle.
