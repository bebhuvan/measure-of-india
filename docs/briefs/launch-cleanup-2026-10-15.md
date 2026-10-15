# Brief: launch cleanup after the Codex wave (2026-10-15)

You own the main tree (`/home/bhuvanesh.r/Documents/Bhuvan projects/Economic atlas new Kimi`, branch
`launch-build`). Your job is to turn Codex's uncommitted second wave into a clean, buildable,
reader-ready, committed tree. The owner has decided not to launch until this is done.

Read first: `AGENTS.md` (hard rules 1-5 are non-negotiable), `docs/GOAL.md`, `docs/CONTRACT-series.md`,
`docs/RELEASE-CHECKLIST.md`, `skills/atlas-comprehensive-expansion/SKILL.md`.

## Authority and limits

- The owner authorised local commits on `launch-build` for this work. Commit in small, named steps.
  Never push, never deploy, never touch `main`, never edit `data/raw/` by hand.
- One tree, one attempt. Codex's failure mode was many parallel attempts (`epoch-attempt-*`,
  `*-repair-*`, `*.patch`) in one uncommitted tree. Do not create worktrees or attempt folders.
- Disk: about 7 GB free; one `astro build` writes about 4.5 GB to `dist/`. Delete `dist/` before
  rebuilding if space is short. Never run two builds at once.
- Do not restyle charts. A new chart kit (`design-mocks/chartkit/`, owned by another session) will
  replace Observable Plot; do not edit `src/charts/` or chart drawing code except to remove plates.

## What the audit found (2026-10-15, evidence in the session that wrote this brief)

1. **The tree does not build.** `investor-participation` is registered (`src/dossiers/registry.js`,
   `data/sources.yml`, `src/dossiers/headline.js`) but none of its ~42 bundles exist. `npm test` fails
   5/359 (ENOENT investor bundles), `scripts/coverage.mjs` fails 45, `scripts/qc.mjs` crashes on import
   (`No investor canonical bundles`, `investor-participation.candidate.js:8`), `lint-charts` prints
   `MISSING BUILD` but exits 0.
2. **Hard-rule breaks.** All 111 `schools-*` bundles carry `vintage: "2026-10-10"` (the fetch date;
   rule 5). `validate.mjs` never calls `checkRange` for schools, households and farm-households
   (around lines 3962, 3973, 4106), so 3,826 all-null schools series and 9,724 all-null farm series
   ship undeclared; `farm-households-nss77-33-01` (5,704 series) and `-47-01` are entirely null.
   Energy (±1e8) and pensions (±1e15) range checks check nothing; the schools percentage range was
   widened to [0, 10000] so a 3,955% GER passes.
3. **Gates write into the repo.** `validate.mjs` (3979, 4098, 4108) rewrites `data/coverage/*.source-quality.json`;
   `explore-verify.mjs` writes `docs/status/explorer-build-verification.json`;
   `test/energy-vintage.test.mjs` rewrites `pipeline/out/facts-energy*.json`. A gate must only read.
4. **Repo weight.** `data/series` grows about 637 MB (farm-households 393 MB, households 127 MB: one
   date per bundle, 0.6-0.9 KB of labels per single-value series); `data/coverage` about 168 MB
   (`farm-households.catalogue.json` 72 MB, schools 42 MB). `docs/status/` holds about 259 MB of
   untracked evidence (PNGs, patches, logs, `wave-2-*-epoch*`, `*-attempt-*`, `*-preflight*`,
   `disk-cleanup-receipts-*`).
5. **Reader quality of the new guides is not publishable.** Pensions is 158,000 px tall with 278
   charts and copy that reads like an internal QA log ("273 reviewed observed records", "2072 pending
   records", "Keep unresolved meanings separate", "Do not add it to its components"). Energy has 164
   charts and raw labels ("India / Bioenergy / share_of_generation_pct / false"); dot plots show
   "0 KToE" for products that are probably blank in the source. Households, schools, digital access
   and farm households lean the same way. The masthead date reads "June 2026" on pensions and
   "September 2026" elsewhere. The home page pitches "Search 17,08,268 source records … Records
   awaiting checks are clearly marked" (pipeline language) and says 36 guides where AGENTS.md says 32.
6. **Refreshability.** `markets-listed` moved from the RBIH API (CI-fetchable) to the local Data Bank,
   so the weekly workflow cannot refresh it. Pensions, investor and digital access are archive replays.
7. **Portability.** About 15 QA scripts load Playwright from `/home/bhuvanesh.r/.cache/codex-runtimes/…`;
   `investor-archive-originals.py` hardcodes `~/.codex/atlas-staging`; `markets-rbi-source-audit.mjs`
   and `energy-ingest-ember.mjs` hardcode local paths. Tests and `validate.mjs` shell out to Python with
   `openpyxl` (installed only in `~/.local`). `deploy.yml`/`ci.yml` keep `timeout-minutes: 30` while the
   build took 716 s and `npm test` 9 min.
8. **Unverified.** Ember's state columns say `ktCO2`/`gCO2/kWh` but the bundles say `kt_co2e`
   (`docs/status/energy-co2e-migration.json`): check Ember's methodology and label truthfully.
9. **Codex's three worktrees** (`~/.codex/worktrees/{56ae,9dde,ed83}/Economic atlas new Kimi`) differ
   from the main tree in 126, 122 and 67 files. Find out whether any holds work newer than the main
   tree; salvage it if so; then list them for the owner to remove (do not delete them yourself).

What is sound and should be kept: the profiles vintage migration (values unchanged, the fetch-date
vintage removed); households, digital access, energy and schools headline figures (they match the
published reports); markets prose (verify passes 20/20).

## Order of work

1. **Clean commit first.** Move (do not delete) scratch out of the repo to
   `/home/bhuvanesh.r/Documents/Bhuvan projects/atlas-archive/codex-wave2-2026-10-15/` keeping paths:
   the `docs/status` evidence above, throwaway QA/probe scripts, `design-mocks/v4..v6` only if no doc
   links them, `pipeline/out/facts-energy-editorial.json` if it is a byte copy. Add `.wrangler/` and
   other local state to `.gitignore`. Pull investor-participation out of the registry, sources, headline
   and tests (park the code under a clearly named flag or folder; do not delete the work). Get
   `npm test` green. Commit. Then append `CHECKPOINT READY <sha>` to `docs/status/launch-cleanup.md` —
   the performance session branches from it.
2. Hard-rule fixes (item 2), each with a test that would have caught it. Generalise: the validator must
   apply the null and range rules to every family by default, not per family.
3. Gates read-only (item 3); `lint-charts` fails on a missing build; explain or raise the
   `explore-verify` 16,000-file cap.
4. Repo weight (item 4): nothing over 25 MB tracked; large catalogues to the Hugging Face archive per
   `docs/PLAN-launch.md` §2b or a compact encoding; report before/after sizes.
5. Reader quality (item 5). Apply the lens method (thisindianlife.today
   `docs/CHART_SELECTION_PHILOSOPHY.md`): each reader question at most once, the full data stays in
   Every Cut and the downloads. Write for a curious Indian reader in plain English, no pipeline
   vocabulary, human labels, no fabricated zeros. Numbers in prose only from facts sheets (rule 3).
6. Items 6-9.
7. Finish: `npm test`, `npx astro build`, `npm run gates`, `npm run prose:dry` all green; `git status`
   clean; `docs/STATUS-launch.md` and `docs/status/launch-cleanup.md` updated with what changed, sizes,
   and the decisions only the owner can make.

Report progress in `docs/status/launch-cleanup.md` as you go (short, dated entries).

## Addendum (from the design session, 2026-10-15 evening)

- `wpi-2022` headline is exactly `0` for 2025-08. Check the source: a published 0.00 is fine; a blank turned into 0 breaks rule 2.
- Headline figures that print badly (`src/dossiers/headline.js`): energy "9,32,816.19 KToE" (say 932.8 Mtoe),
  pensions "7,71,12,121" (7.71 crore), households "₹15,92,379" (₹15.9 lakh), farm-households period
  "July 2018–June 2019; seasonal/visit references in each cell" (2018-19). Readers see these on the home page.
