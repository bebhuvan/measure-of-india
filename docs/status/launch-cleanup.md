# Launch cleanup (brief: docs/briefs/launch-cleanup-2026-10-15.md)

Owner: Claude Code session on `launch-build`, main tree. Short dated entries, newest last.

## 2026-10-15

- Started. Tree at 3fa544a plus ~1,530 uncommitted paths (500 modified, 1,033 untracked). Disk 6.9 GB free.
- Scratch moved out of the repo (not deleted) to
  `/home/bhuvanesh.r/Documents/Bhuvan projects/atlas-archive/codex-wave2-2026-10-15/`, paths kept,
  list in its `MANIFEST.txt`: 220 `docs/status` evidence items (259 MB to 0.7 MB left: only the
  per-workstream `.md` logs stay), 25 one-off QA/browser/performance scripts (13 of them loaded
  Playwright from Codex's private runtime), 4 tests that only replayed one-off migrations against
  that evidence (`accepted-artifact-guard`, `performance-browser-ready`, `energy-vintage`,
  `pensions-expected-relocation`), `design-mocks/v4` (unlinked; v5/v6 stay, `docs/DESIGN-v4.md`
  links them), `.github/workflows/deploy-workers.yml.example`, and
  `pipeline/out/facts-energy-editorial.json` (a byte copy of `facts-energy.json`; the two energy
  generators now write only the one file).
- `.gitignore`: `.wrangler/`, `.dev.vars`, `*.tmp`, `.DS_Store`.
- investor-participation parked in `parked/investor-participation/` (README says what moved, what
  stayed dormant, and how to revive). Unregistered from registry, sources and headline; fetch
  product unhooked; `qc.mjs` loads the investor model only when the slug is registered.
- Codex worktrees: all three last touched 12-13 Oct; the main tree carries 15 Oct work. Only
  `ed83` held anything newer: the markets-rbi doc and status-log sections describing the vintage
  and reader-coverage changes that the main tree already applied. Both docs copied in. The
  remaining worktree-only files (logs, a proposal patch, cleanup inspections) are copied to the
  archive's `worktree-salvage/`. Nothing else to salvage. **Owner:** remove them with
  `git worktree remove --force` for `~/.codex/worktrees/{56ae,9dde,ed83}/Economic atlas new Kimi`.
- Coverage's 45 failures were the parked investor ledger; it moved to the parked folder too.
  Catalogues over 20 MB are now stored gzipped by `writeCatalogue` (farm 72 MB to 8.8 MB,
  schools 42 to 3.4, households 28 to 3.8); `readCatalogue` reads either form.
- Baseline on the committed tree: `npm test` 325/325 (944 s), `validate.mjs` passes (13 min wall),
  `coverage.mjs` 49 ledgers clean. No build yet (step 7).
- `design-mocks/chartkit/` left untracked on purpose: another session owns it.

CHECKPOINT READY 417a96f

### Step 2: hard rules (2026-10-15, evening)

- **Generalised in the validator.** New `scripts/lib/unit-envelope.mjs` gives all 163 stored units a
  range from what the unit means. `validate.mjs` now ends with an EVERY BUNDLE pass: each series of
  each bundle must sit inside its unit's envelope, and any bundle no family check range-checked gets
  the null rule and envelopes too (547 bundles had none). Energy's ±1e8 and pensions' ±1e15 are
  replaced by the envelopes. CONTRACT-series rules 2e and 2f, AGENTS.md rule 2 updated.
- **No empty series.** `writeSeries` refuses an all-null series (except digital access's proved
  source-unpublished declarations) and an empty bundle; `splitEmptySeries` lets adapters catalogue
  such cells as withheld, with the reason. Schools: 3,826 blank series out. Farm households: 9,724
  out, including all of tables 33-01 and 47-01 (quarantined source defects); the adapter now also
  deletes chunk files it no longer writes. Coverage still accounts for every cell (excluded, with
  reasons). Values of every kept series checked unchanged against HEAD.
- **Schools vintage.** All 111 bundles move to the declared-unknown contract with
  `archiveCapturedDate`, like the profiles (same eSankhyiki API). Values unchanged.
- **Schools GER.** The range is back to [0, 200]. UDISE+ prints GERs up to 3,955% for SC and ST
  children in Mizoram, Meghalaya, Ladakh and Sikkim (tiny population bases): 271 cells above 200%
  are withheld with a reader note and the printed value kept on the series (`withheld`).
- **Defects the envelope found beyond the brief.** (a) Ember's state CSV prints power-sector
  emissions a second time under unit "%" (every one of 49,098 rows repeats the ktCO2 value): the
  7 "%" emissions bundles are now catalogued as source duplicates, not baked. (b) The state-profile
  adapter took units from the table title before the column: 7,000-odd series fixed, e.g. "average
  amount per household (Rs.)" was per-1,000 and "per 1,000 households reporting" was a count;
  household counts under "Percentage of households…" are counts. Values unchanged. (c) MoSPI serves
  env table 99 (rural tap water) with its column labels rotated (the "Percentage" column holds
  household counts): excluded with the evidence, raw kept. (d) The renderer's own unit resolver let a
  "(per 1,000)" in a table title override a rupee column; it now only overrides generic units.
- **Ember units (item 8) verified.** Ember's subnational methodology (archived in
  `data/raw/energy-ember-methodology-subnational.json`) defines the figures as lifecycle emissions
  "converted into CO2 equivalent"; the CSV header's ktCO2 is shorthand. `kt_co2e` is truthful.
- **Tests that would have caught each:** `test/hard-rules.test.mjs` (writer, splitter, capture date
  as vintage, envelopes on the shipped mislabels, profile units, Ember duplicates, a scan of the
  wave-2 families), plus updated energy, farm, units and expected-schedule tests.

### Step 3: gates read-only

- `validate.mjs` no longer writes the households/energy/farm source-quality registers; it fails if
  the committed copy differs from what replay computes. `scripts/source-quality.mjs` writes them.
- `explore-verify.mjs` prints its evidence instead of writing `docs/status/`. Its 16,000-file
  budget is explained in place: Cloudflare Pages takes 20,000 files per deployment and the budget
  keeps 4,000 spare; raising it belongs to the performance session's hosting move.
- `lint-charts.mjs` now fails on a page the registry promises but the build lacks.
- `test/gates-read-only.test.mjs` walks every gate and its validators for write calls.
- Verified: `npm test` + `validate.mjs` run together left `git status` unchanged.

### Step 4: repo weight

| | before (15 Oct) | after |
|---|---|---|
| Largest tracked file | 72 MB (`farm-households.catalogue.json`) | 14.2 MB (`households-aidis-34.json`) |
| Files over 25 MB tracked | 3 catalogues (72, 42, 28 MB) | none (gzipped: 8.8, 3.4, 3.8 MB) |
| `docs/status/` | 259 MB | 0.7 MB |
| `data/coverage/` | 212 MB on disk | 91 MB |
| `data/series/` | 1.1 GB (farm 393 MB, households 127 MB) | 1.1 GB (farm 369 MB after 9,724 empty series left) |

Not done, proposed instead: the farm cubes are 356 MB for 5.7 MB of numbers. Per-series `dims`
(100 MB), `label` (95 MB), `group` (50 MB) and `name` (21 MB) are all derivable from `dims`.
A compact encoding for single-date survey cubes (store `dims`, derive the rest in one shared
loader) would cut farm and households by roughly 70%, but it changes the canonical bundle shape
every consumer reads (Every Cut, explorer, downloads, search, models). That belongs to the
performance session or a dedicated change, not a cleanup. Git compresses these well: the
checkpoint commit added about 14 MB to `.git`.

### Step 5: reader quality

- One masthead rule for every guide: "Latest: <period of the headline figure>" (`mastheadStamp`
  in headline.js). It replaces a mix of release months, report editions and fetch dates shown as
  vintages ("October 2026" on nine guides was the fetch day).
- Households rewritten by the lens method: 109 plates to 15; prose for a general reader; every
  number a model fact on the page; boilerplate per-plate "As of" blocks and their 109 freshness
  manifest entries removed (a survey snapshot has nothing to go stale).
- Shared components: Every Cut, downloads and every-cut pages say "checked" / "not yet checked"
  instead of reviewed/pending/canonical/archival. Home page drops "Records awaiting checks".
- Then pensions, digital access, schools, energy and farm households, by the same method. Plates
  per guide, before and after: households 109 to 15, pensions 278 to 16, digital access 158 to 18,
  schools 66 to 19, energy 164 to 19, farm households 229 to 20. 1,004 plates in all became 107,
  each answering one reader question. Nothing was dropped from the data: every table and cut is
  still in Every Cut and the downloads (coverage: 49 ledgers clean).
- Every number in the new prose is a model fact on the page, so `asof.mjs` and qc trace it. The
  boilerplate "As of" blocks went from all six; the freshness manifest is down to 497 entries.
- Smaller fixes on the way: energy's headline is now 933 Mtoe (it was printed in ktoe); Every Cut
  says "thousand toe", not "ktoe"; the pensions masthead names the full month; farm's period text
  stops at the first ";"; households-editorial now bakes every bundle (it had left 107,226 cells
  undecided).
- Farm API tables 18, 34, 36 and 39 looked wrong (0.086 ha "owned" per agricultural household).
  Checked against Report 587 on 2026-10-17: the labels were wrong, not the values, and they are
  now corrected in the adapter (owner decision 5 below). No lens plate was ever drawn from them,
  so there is nothing to put back.

### Steps 6-7 so far

- Item 6, refreshability: 21 products already read the owner's local Data Bank, so the weekly
  workflow's fetch failed on all of them in CI and could never reach validate. `fetch.mjs` now
  holds those (committed bundles kept, listed as held) when the folder is absent; markets-listed is
  one of them. Pensions and digital access refresh only by replaying archived originals.
- Item 7, portability: no hardcoded user paths left in scripts; Codex-runtime Playwright scripts
  are archived; `requirements.txt` (openpyxl 3.1.5) installed in all workflows; acorn and esbuild
  declared; workflow timeouts 90/75/150 minutes for ci/deploy/update.

## 2026-10-16

- The chart-kit session's rebuilds found four launch-build items; all fixed in 5dafdfad:
  qc checked guide stamps with the old display.js rule instead of `mastheadStamp`, and still
  checked energy's removed `#prov-vintage`.
- **API zeros checked against the printed source.** The UDISE API served Bihar's 2024-25
  secondary dropout as 0, 0, 0; the printed 2024-25 report (Table 6.13) has 7.0, 6.8, 6.9. The
  schools adapter now checks every dropout cell the report prints: 321 of 324 agree, the 3
  are withheld with a note, and the 43 zeros the report also prints stay (UDISE+ defines
  dropout as non-negative, so a 0 is its floor). A disagreeing figure stops the rebake.
- **Shares of a nil amount.** AIDIS prints a "per Rs. 1000 of loans" breakdown as 0 in every
  cell for Chandigarh's rural cultivators: the amount was nil or unsampled, so the shares do
  not exist. 99 such cells (tables 26, 29, 34) are withheld and excluded with the reason. The
  other 6,061 zeros in table 26 are published figures that round to zero: each breakdown
  still adds to 1,000. Tests for both rules in `test/hard-rules.test.mjs`.
- The first full build's chart lint found one collision: farm's net investment by land size has
  a negative group (-289), and the interim Plot drawing prints its label across the zero rule.
  The brief allows no drawing-code edits, so the plate is out (farm 21 to 20 plates); its cells
  stay in Every Cut and the downloads. The chart kit should bring it back. The section heading
  now reads "What farming costs, and what animals earn".
- validate's schools replay applies the same printed-report rule as the adapter (it flagged the
  three Bihar cells as changed until it did).
- **Final check.** Build of 2,097 pages, 15,657 files, 4.5 GB (largest file 17.3 MB, under the
  20 MB limit); `npm run gates` passes end to end; `npm test` 337/337; `prose:dry` clean. dist
  deleted afterwards.
- Build blocked twice by machine memory (other sessions' browsers and emulator, swap full);
  the low-memory guard stopped one build. npm's download cache was cleared with the owner's
  approval (1.2 GB).

## Decisions only the owner can make

1. **Codex worktrees.** Remove with `git worktree remove --force` for
   `~/.codex/worktrees/{56ae,9dde,ed83}/Economic atlas new Kimi`. Their newer docs are salvaged.
2. **Vintage semantics.** Older eSankhyiki and DBIE families date a bundle by when its body
   first changed (CONTRACT-series rule 4 allows it). Schools and the state profiles follow the
   stricter rule: null vintage plus `archiveCapturedDate`. Migrate the others or not.
3. **GER above 200%.** 271 schools cells withheld as small-population artefacts; the threshold
   is editorial.
4. **UDISE dropout against the printed reports. Decided 2026-10-17.** The 2022-23 and 2023-24
   reports are archived through the adapter (`REPORTS` in `scripts/lib/products/schools.mjs`, URL and
   sha256 pinned), and Table 6.13 is checked for every year with a report. The API's 2023-24 year is
   wrong: only 39 of 324 cells agree. Owner's rule: where the API disagrees with the printed report,
   the printed figure is published; the API figure stays in the raw archive and in the series'
   `sourceValues` and note. Within 0.1 counts as rounding (printed kept). Zeros the report prints stay.
   Per year (cells, exact agreement, rounding, printed zeros, replaced non-zero, API zero replaced):
   2022-23 324: 292, 1, 31, 0, 0; 2023-24 324: 2, 12, 37, 210, 63; 2024-25 324: 278, 0, 43, 0, 3.
   These counts are pinned, so a new disagreement stops the rebake for review. Bihar secondary now
   reads 29.5, 25.6, 6.9. The state-profile bundle `profiles-mospi-udise-0-41` applies the same rule.
5. **Farm tables 18, 34, 36, 39. Decided 2026-10-17.** The labels were wrong, not the values: 18, 19
   and 34 swap agricultural and non-agricultural households (agricultural households own 0.876 ha;
   0.086 is the non-agricultural figure), 18 shifts Himachal Pradesh's social groups, 36 says
   leasing-out over leasing-in values, and 39 drops "in milk" and its visit-1 season.
   `scripts/lib/farm-households-corrections.mjs` relabels the raw rows and every bake replays
   291,314 corrected cells against Report 587 (all agree, or the bake stops). See
   `docs/reference/farm-households.md`.
6. **Compact encoding for survey cubes.** Farm and households cubes are 356 MB for 5.7 MB of
   numbers; a compact shape would cut about 70% but changes what every consumer reads.
   Proposed for the performance session, not done.
7. **Refreshability.** markets-listed and 21 Data Bank products refresh only on your machine
   (CI holds them). Pensions and digital access refresh only by archive replay. Investor
   participation stays parked: its 42 bundles were never produced.
8. **Interim charts.** Charts stay on Observable Plot until the chart kit lands; the farm axis
   prints raw unit names ("hundreds →", "pct →"), drawing code this cleanup did not touch. Farm's
   net investment plate (negative values) waits for the kit.
9. **Hosting.** The Workers cutover (`wrangler.jsonc`) is the performance session's; the
   Pages example workflow is archived.
