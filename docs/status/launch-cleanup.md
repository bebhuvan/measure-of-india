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
