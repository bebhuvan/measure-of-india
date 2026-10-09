# Launch status

Plan: `docs/PLAN-launch.md`. Branch: `launch-build`. Updated 2026-10-09, 19:45.

## Running now: ten family sessions

Each is a Claude Code session in its own worktree (`~/Documents/Bhuvan projects/atlas-worktrees/<slug>`,
branch `lb/<slug>`), named `atlas-<slug>` in Remote Control. Rules: `docs/briefs/README.md`.
Each writes its own log in `docs/status/<slug>.md` on its branch.

| Session | Builds | State |
|---|---|---|
| atlas-external | External account rebuilt on DBIE: BoP, weekly reserves, FDI and FPI, external debt, REER | started 18:17 |
| atlas-trade | New guide: merchandise trade from TradeStat, HS 2 to 8 digit, partners | started 18:18 |
| atlas-credit | New guide: credit by sector, money supply, bank health | started 18:18 |
| atlas-rates | New guide: policy rates since 1935, MPC votes, lending and deposit rates, yields | started 18:18 |
| atlas-states | New guide: state GDP, per-capita income, what each state runs on | **merged** (state economies; all 182 RBI Handbook tables, every unit resolved) |
| atlas-services | New guide: services output, exports, enterprises, jobs | **merged** |
| atlas-ilo | New guide: the ILO's labour estimates for India | started 18:18 |
| atlas-climate | New guide: temperature, rain, emissions (OWID, World Bank climate portal) | **merged**; prose follow-up sent (a seasonal misreading) |
| atlas-worldbank | WDI inventory; new guides on poverty and on population | **merged** (poverty, population; all 1,395 WDI India indicators baked) |
| atlas-bis | BIS bundles; new guides on housing prices and on debt | **merged** (debt, housing; BIS India credit after 2023 marked as BIS estimates) |
| atlas-framework | Every-cut table, seam charts, IDH cross-check, ledgers for the 14 existing guides | **merged** (every-cut table, seam charts, IDH cross-check, ledgers) |

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
- Merged guides on the branch: 21 (bis, services, states, worldbank, climate in).
- Every-cut marks estimated values (", est."), enforced by a test.
- DBIE reader fixed (quoted ";" misaligned 5,232 rows of report 1076).

## Waiting on the owner

- Climate: state-by-season/month and some CMIP6 state projections were left out for size
  (they would multiply the climate archive 10-15x). Include them?

## Queued (after wave 1 merges)

- Store `data/raw` gzipped: 316 MB tracked today, one file over GitHub's 50 MB warning;
  gzip shrinks them 6-50x with the audit trail intact.
- Every-cut: one paged view for a family of small bundles (the 204 Handbook tables).
- Manufacturing page: hand-typed last years go stale on a WDI refresh (asof flags it).
