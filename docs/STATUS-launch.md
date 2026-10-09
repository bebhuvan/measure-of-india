# Launch status

Plan: `docs/PLAN-launch.md`. Branch: `launch-build`. Updated 2026-10-10, 04:45.

## Running now: ten family sessions

Each is a Claude Code session in its own worktree (`~/Documents/Bhuvan projects/atlas-worktrees/<slug>`,
branch `lb/<slug>`), named `atlas-<slug>` in Remote Control. Rules: `docs/briefs/README.md`.
Each writes its own log in `docs/status/<slug>.md` on its branch.

| Session | Builds | State |
|---|---|---|
| atlas-external | External account rebuilt on DBIE: BoP, weekly reserves, FDI and FPI, external debt, REER | **merged** (BoP to Q1 FY27, weekly reserves to 25 Sep 2026, FDI/FPI, debt, REER) |
| atlas-trade | New guide: merchandise trade from TradeStat, HS 2 to 8 digit, partners | **merged** (HS 2/4, partners, regions; 6/8-digit staged for the archive) |
| atlas-credit | New guide: credit by sector, money supply, bank health | **merged** (credit by sector, money, banks; 228 deep RBI tables; 22 held for the archive) |
| atlas-rates | New guide: policy rates since 1935, MPC votes, lending and deposit rates, yields | **merged** (repo rate since 1935, every MPC vote, lending rates, yields) |
| atlas-states | New guide: state GDP, per-capita income, what each state runs on | **merged** (state economies; all 182 RBI Handbook tables, every unit resolved) |
| atlas-services | New guide: services output, exports, enterprises, jobs | **merged** |
| atlas-ilo | New guide: the ILO's labour estimates for India | **merged** (68 bundles; every one spot-checked against ILO) |
| atlas-climate | New guide: temperature, rain, emissions (OWID, World Bank climate portal) | **merged**, follow-up merged |
| atlas-worldbank | WDI inventory; new guides on poverty and on population | **merged** (poverty, population; all 1,395 WDI India indicators baked) |
| atlas-bis | BIS bundles; new guides on housing prices and on debt | **merged** (debt, housing; BIS India credit after 2023 marked as BIS estimates) |
| atlas-framework | Every-cut table, seam charts, IDH cross-check, ledgers for the 14 existing guides | **merged** round 4: archive builder (dry run passed), raw gzipped (559 to 57 MB) |

## Wave 2 (started 2026-10-10 00:05): deepening the existing guides

Each decides every `pending` item in its ledgers (brief: `docs/briefs/wave2.md`).

| Session | Guides | Pending items to decide |
|---|---|---|
| atlas-prices | cpi, wpi (+ CPI-IW, rural wages) | **merged**: 0 pending; CPI by state to the group, items staged for the archive |
| atlas-jobs-deep | jobs | **merged**: 0 pending (9,523 items); found the 2025 PLFS redesign splice. services-jobs-cy split at the seam too (merged) |
| atlas-industry | iip, factories (+ eight core industries) | 45,347; paging fix merged, audit clean so far (38 ASI tables, all 52 ASUSE, IIP annual); ASI download ~2 h left |
| atlas-nas | gdp | **merged**: 0 pending; institutional sectors, revision paths, 18 sub-industries |

| atlas-health-gender | nfhs, gender | **merged**: 0 pending; found MoSPI misfiling NFHS-4 values the old guide had printed |
| atlas-households | consumption, aishe, mnre, deposits | **merged**: 0 pending; BSR-2 decoded; found our own corrupted AISHE download |

## Coordinator (this session) meanwhile

- Merging each family as it reports done, with the gates re-run after every merge.

## Next wave (after these merge)

Jobs deeper, industry deeper, prices deeper, national accounts remainder (all MoSPI, which
throttles, so not run alongside the states and services sessions). Then the launch pass.

## Done on the branch

- 14 guides, all gates green (checkpoint `77384bd`).
- Launch plan, coverage contract and gate, Data Bank query helper, briefs (`da691ac`).
- Framework merged: every-cut table on all 14 guides, one seam treatment for charts, the
  IDH cross-check (10 pairs, 7 match on every date), ledgers for the existing guides.
- The ledgers found **146,863 items the existing guides don't cover yet** (mostly CPI
  state x item, ASI 3-4 digit, NFHS tables, 144 gender indicators). Each is in its ledger as
  `pending`, scheduled for wave 2. Gates pass; the launch setting (`--strict`) fails until
  they are decided.
- **Wave 1 complete: 25 guides on the branch**, 537 pages, all gates green, all 38 prose files verify.
- Every-cut marks estimated values (", est."), enforced by a test.
- DBIE reader fixed (quoted ";" misaligned 5,232 rows of report 1076).

## Waiting on the owner

- For the Data Bank (found by atlas-rates): the MPC stance classifier misses "change the
  stance to calibrated tightening", which blocks meeting 63's promotion; 2019-20 G-sec
  notified amounts disagree with DBIE report 559 on 17 days.

## Fixed

- **The prose verifier now traces every figure**, not only percentages: amounts with
  lakh/crore/billion, °C, mm, index levels, ratios, each scaled by its series' own unit.
  All 34 prose files on the site pass. It caught one real miss (a ratio the consumption
  writer computed itself; the ratio is now in the facts sheet). Limit, recorded in HISTORY:
  tracing proves a figure exists in the sheet, not that the sentence attaches it to the
  right period, so the hand read stays.
- Phone charts open at the latest end, with an "Earlier years" cue.
- Every-cut pages are lighter (states 0.87 to 0.50 MB, climate 1.43 to 0.69 MB), and all 208
  RBI Handbook tables are in the states guide's every-cut view.

## For the launch pass

- **Full fresh MoSPI refresh as an integrity audit.** Our AISHE dump of 2026-08-09 was
  corrupted by the API's unstable paging (a row repeated, another dropped, count intact).
  `mospiAll` now detects a repeated row in any page set, re-reads it in 100-row pages and
  compares, and fails loudly if the two disagree. Re-running every MoSPI adapter with
  MOSPI_NO_CACHE=1 after wave 2 checks every dump on the site the same way.

## For the launch-pass prose review

- gdp: growth quoted to two decimals ("7.82%", computed from levels) where MoSPI and the
  press print one ("7.8%"). Decide a site-wide rule: published precision for headline
  growth, with the computed figure only where it is the point.

## Queued (after wave 1 merges)

- **Deep archive upload: waiting on the owner's go.** Dry run: 14,457 files, 6.69 crore
  rows, 1.46 GB (climate, credit, ILO, trade; CPI items now staged too).
- **Deep archive on Hugging Face** (owner chose 2026-10-09): `bebhuvan1/india-atlas-archive`,
  public, Parquet plus CSV, manifest in the repo (`PLAN-launch.md` §2b); write token in
  `.env` verified. Built after trade merges. Credit holds 22 reports for it, ILO 17 rules,
  climate 2.
- Deposits: 690 pending BSR-2 items (ownership and maturity tables need the categories
  worked out; credit verified tables 2.1-2.3 and 2.8-2.10 add up). Wave 2.

- Store `data/raw` gzipped: 316 MB tracked today, one file over GitHub's 50 MB warning;
  gzip shrinks them 6-50x with the audit trail intact.
- Every-cut: one paged view for a family of small bundles (the 204 Handbook tables).
- Manufacturing page: hand-typed last years go stale on a WDI refresh (asof flags it).
