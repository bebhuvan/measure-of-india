# Launch status

Plan: `docs/PLAN-launch.md`. Branch: `launch-build`. Updated 2026-10-09, 21:00.

## Running now: ten family sessions

Each is a Claude Code session in its own worktree (`~/Documents/Bhuvan projects/atlas-worktrees/<slug>`,
branch `lb/<slug>`), named `atlas-<slug>` in Remote Control. Rules: `docs/briefs/README.md`.
Each writes its own log in `docs/status/<slug>.md` on its branch.

| Session | Builds | State |
|---|---|---|
| atlas-external | External account rebuilt on DBIE: BoP, weekly reserves, FDI and FPI, external debt, REER | **merged** (BoP to Q1 FY27, weekly reserves to 25 Sep 2026, FDI/FPI, debt, REER) |
| atlas-trade | New guide: merchandise trade from TradeStat, HS 2 to 8 digit, partners | started 18:18 |
| atlas-credit | New guide: credit by sector, money supply, bank health | started 18:18 |
| atlas-rates | New guide: policy rates since 1935, MPC votes, lending and deposit rates, yields | **merged** (repo rate since 1935, every MPC vote, lending rates, yields) |
| atlas-states | New guide: state GDP, per-capita income, what each state runs on | **merged** (state economies; all 182 RBI Handbook tables, every unit resolved) |
| atlas-services | New guide: services output, exports, enterprises, jobs | **merged** |
| atlas-ilo | New guide: the ILO's labour estimates for India | **merged** (68 bundles; every one spot-checked against ILO) |
| atlas-climate | New guide: temperature, rain, emissions (OWID, World Bank climate portal) | **merged**, follow-up merged |
| atlas-worldbank | WDI inventory; new guides on poverty and on population | **merged** (poverty, population; all 1,395 WDI India indicators baked) |
| atlas-bis | BIS bundles; new guides on housing prices and on debt | **merged** (debt, housing; BIS India credit after 2023 marked as BIS estimates) |
| atlas-framework | Every-cut table, seam charts, IDH cross-check, ledgers for the 14 existing guides | **merged**, round 2 merged (verifier traces every figure; phone charts open at today; lighter every-cut) |

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
- Merged guides on the branch: 23, and external rebuilt on DBIE (bis, services, states, worldbank, climate, ilo, rates, external in). Still building: trade, credit.
- Every-cut marks estimated values (", est."), enforced by a test.
- DBIE reader fixed (quoted ";" misaligned 5,232 rows of report 1076).

## Waiting on the owner

- **A deep-archive tier for cuts too big to bake** (climate state x season/month and CMIP6
  state cuts; ILO three-way survey cubes, ~950k cells; credit district and centre-wise tables,
  ~10m rows): publish them as compressed downloads outside the chart bundles, listed in a
  committed manifest. Where to host them (Cloudflare R2, GitHub release assets, or the site
  itself within its 25 MB-per-file limit)? Meanwhile sessions mark them `archive: true`.
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

## Queued (after wave 1 merges)

- Store `data/raw` gzipped: 316 MB tracked today, one file over GitHub's 50 MB warning;
  gzip shrinks them 6-50x with the audit trail intact.
- Every-cut: one paged view for a family of small bundles (the 204 Handbook tables).
- Manufacturing page: hand-typed last years go stale on a WDI refresh (asof flags it).
