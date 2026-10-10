# Launch status

Plan: `docs/PLAN-launch.md`. Branch: `launch-build`. Updated 2026-10-10, 21:10.

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
| atlas-industry | iip, factories (+ eight core industries) | **merged**: 0 pending; ASI to 4-digit and state, core industries, ASUSE every table |
| atlas-nas | gdp | **merged**: 0 pending; institutional sectors, revision paths, 18 sub-industries |

| atlas-health-gender | nfhs, gender | **merged**: 0 pending; found MoSPI misfiling NFHS-4 values the old guide had printed |
| atlas-households | consumption, aishe, mnre, deposits | **merged**: 0 pending; BSR-2 decoded; found our own corrupted AISHE download |

## Coordinator (this session) meanwhile

- Merging each family as it reports done, with the gates re-run after every merge.

## Next wave (after these merge)

Jobs deeper, industry deeper, prices deeper, national accounts remainder (all MoSPI, which
throttles, so not run alongside the states and services sessions). Then the launch pass.

## Where the site stands (21:10, 10 Oct)

**Ready to deploy, pending the owner's steps below.** 30 guides and 36 state profiles,
1,148 pages; `npm test` 70/70, every gate green, `coverage --strict` clean, all 54 prose files
verified and read by hand. The read-through (three reviewers plus a data-fix session) is
merged. Everything is on `launch-build`; nothing is pushed.

**For the owner, to go live:** (1) "upload" for the Hugging Face archive (119 "Finer detail"
links 404 until then); (2) a GitHub repository, the Cloudflare Pages project `india-atlas`
with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, DNS for atlas.thisindianlife.today;
(3) merge `launch-build` into `main` once pushed.

## Launch pass: what is left

| Item | Who | State |
|---|---|---|
| Search index was 306 MB | atlas-framework round 5 | **fixed**: 112 KB core + shards; largest file 6 MB |
| State profiles, /states/<state>/ (owner, in launch scope) | atlas-profiles | **all merged**, including public finance and UCB state cuts |
| Full fresh MoSPI re-download as an integrity audit | coordinator | **done, clean**: every MoSPI product re-fetched through the hardened client (or by its wave-2 session after the fix); 0 paging slips, 0 data values changed |
| Deep archive upload to Hugging Face (1.5 GB) | coordinator | **waiting on the owner's go** |
| Read every guide end to end at 1440 and 390; release checklist (`docs/briefs/review.md`) | atlas-review-a, -b, -c, datafix | **done and merged**: precision rule, false titles, copied runs, zeros for no estimate, units, search, GDP leads with the 2022-23 base, contact email |
| Profile wording: middle ranks read "17th lowest of 36"; say "17th of 36" | atlas-profiles | to fix |
| Prose rule: published precision | review-a | **done**: pipeline/lib/precision.mjs, enforced by verify |
| IIP annual 2024-25: API 5.7% against 6.4% in press summaries (MoSPI PDF 403) | open | not quoted anywhere meanwhile |
| New sources (SHRUG, Census 2011 PCA, data.gov.in, MGNREGA, TCPD): before or after launch? | **owner** | asked |
| DBIE wave: public finance, payments, farms, banks, markets (5 sessions) | atlas-* | **all merged**: payments 26, farms 27, banks 28, public finance 29, markets 30 |
| credit: cheque counts read as display codes (662), clearing-house totals from the wrong provider (743), a 0.001 placeholder | atlas-payments | fixing |
| MGNREGA | coordinator | **blocked**: MIS is CAPTCHA-gated (not circumvented); api.data.gov.in refuses connections from this network; needs an owner API key and a reachable API |
| GitHub remote, Cloudflare secrets and Pages project, DNS for atlas.thisindianlife.today, analytics | **owner** | to do |

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

## For the owner, not the Atlas

- **Personal data in the Data Bank.** Its copy of RBI DBIE report 273 (UCCS unit-level,
  2010-14) holds respondents' names, addresses, telephone numbers and pincodes (51,007 rows),
  apparently as RBI publishes it. Excluded from the Atlas (markets ledger); worth deleting or
  quarantining in the Data Bank and its backups, and perhaps telling RBI.
- Index levels (Sensex, Nifty) excluded as licensed exchange products; market cap and
  turnover baked. One ledger rule to flip if you decide otherwise.

## Build machine notes

- Two build slots (`scripts/build-slot.sh`); qc and chart lint need a 6 GB heap at ~1,150
  pages. A GitHub-hosted runner for a private repo has 7 GB of RAM: tight; consider a larger
  runner or building on this machine and deploying the built `dist`.

## After launch (decided)

- CPI bundles' meta.revisionPolicy still says "final on release" until the next CPI bake
  (sources.yml is corrected). Hybrid solar before April 2022: check against MNRE's archive.

- Time Use guide (national; TUS 2019 and 2024). BIS CPMI payments comparison (Data Bank to
  mirror the CPMI flows). Economic Census (no record endpoint known). NSS 80 (API 500).
  Census 2011 PCA, then SHRUG and TCPD after licence checks. MGNREGA as soon as data.gov.in
  is reachable with a key.

## For the launch-pass prose review

- (done by review-a) payments counts and gdp growth at published precision.
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
