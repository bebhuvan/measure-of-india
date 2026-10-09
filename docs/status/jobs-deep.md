# jobs-deep: status

Session: atlas-jobs-deep, branch `lb/jobs-deep`, port 4422. Brief: `docs/briefs/jobs-deep.md`.
Guide: `jobs` (family `plfs`).

## Done (2026-10-10)

- **The whole PLFS cube, archived.** `scripts/lib/products/plfs-cube.mjs` asks getData for
  every indicator x frequency x year with no filters (the unfiltered answer is every cell)
  and archives it as served: 133 call sets, gzipped JSON in `data/raw/plfs/`, 3 MB, indexed
  with rows and sha256 in `data/raw/plfs-index.json`. Resumable; a release run refetches
  only call sets a release can change. Every bundle is now cut from these rows.
- **Indicator 5 (job conditions) works.** It answered HTTP 500 until at least 2026-08;
  retested 2026-10-09, served. Baked (`plfs-conditions`) and drawn (§08).
- **Two survey designs, never joined.** MoSPI revamped the PLFS from January 2025. Original
  design: agriculture years 2017-18 to 2023-24, calendar years 2022-2024, urban quarterly
  to Oct-Dec 2024. Revamped: monthly, quarterly with villages and states from Apr-Jun 2025,
  calendar year 2025. Registered in `sources.yml seams: plfs`; plates draw them with
  `seamMarks("side")` (§03 seam plate, §04 plate 1).
- **30 new bundles**, 91,006 series in every-cut: LFPR, WPR, UR for every state x gender x
  sector x age band x education, both weekly and usual status, both designs; religion and
  social group; quarterly states (22); monthly and quarterly age bands; the worker
  distribution for every state (status, broad industry, NIC section, NCO division,
  enterprise type); earnings for every state and sector; job conditions for every state.
- **Ledger complete.** `plfs` 9,523 items (the listing's one-cut items plus every cross
  table getData serves, read from the cube): 339 shown, 8,784 baked, 392 excluded,
  8 blocked, 0 pending.
- **Guide v1.4.** Nine new plates: two designs side by side (§03); plate 1 across the seam;
  the whole country by quarter; young people's unemployment by state (§04); young people,
  monthly (§06); salaried and casual work by state (§07); regular pay by state; job
  conditions (§08); women's participation by social group and religion (§09); who works,
  women and men, by state (§10). Two new misreadings. Links to the ILO and services guides
  with how they differ.

## Decisions (for HISTORY.md)

- **Quarterly bulletin split at the redesign.** `plfs-quarterly` used to run Apr-Jun 2018 to
  Apr-Jun 2026 as one urban line across the Jan-Mar 2025 gap. The redesign is a new ruler
  (hard rule 1), so it now ends Oct-Dec 2024 and the new quarters live in `plfs-q25`.
- **Calendar years split too.** 2022-2024 are the original design (MoSPI, "Changes in PLFS
  from 2025": calendar-year unit data for those years was released from the old survey);
  2025 is the revamped. `plfs-cy-*` and `plfs-cy25-*`.
- **Prose inputs are new-design only.** `facts.mjs` refuses a sibling on another base, so
  `proseInputs` is now plfs-cuts, plfs-monthly-age, plfs-q25 (was plfs-states, -status,
  -earnings, all original design).
- **The catalogue now lists cross tables** (`plfs:<freq>:<ind>:<ws>:x:<dims>:<state>`),
  read from the cube, so the brief's state x gender x sector cuts are on the ledger.
- **No archive tier needed.** By state the source serves one-way tables only; everything
  fits in bundles (35 MB of PLFS bundles in all).
- **Quarantine rules, general, each disclosed on its series** (`plfs-deep.mjs` header):
  malformed values (OCR debris: "l0.8", "IS.2", "20. I"); 0 that means no sample (LFPR,
  earnings, all-zero share tables); UR = 1 - WPR/LFPR broken (1.5 pt); shares not adding to
  100 or own-account + helpers != self-employed (usual status only: on the weekly status
  the self-employed also hold those with work who did not work that week); "none of the
  three" above a single condition; and shifted state labels (below).
- **Strict number parsing.** `parseFloat` read "20. I" as 20 and "16?" as 16; all parsing is
  now strict. No curated bundle's values changed (diffed).

## Source quirks found

- **State labels shifted one row** in the quarterly bulletin's state tables: Jul-Sep 2025
  LFPR, and Apr-Jun 2025 LFPR, WPR and UR. The bulletin prints Jammu & Kashmir last; the
  API maps rows onto an alphabetical list. Checked against the Jul-Sep 2025 bulletin
  (Table 2: Kerala 51.1, the API's "Kerala" 59.4 is Madhya Pradesh's row). Apr-Jun 2025 was
  invisible to the identity check (all three indicators moved together); a mechanism test
  finds exactly these four tables (12 of 14 labels fit the shift; every other table 7 or
  fewer). Cells from J&K to West Bengal withheld for those tables.
- Apr-Jun 2019 quarterly UR is a mislabelled copy in every state, not only All India.
- Oct-Dec 2020 quarterly: Assam and Madhya Pradesh rows break the identity throughout.
- Indicator 4, calendar years: the contract table is served without its label (blocked).
- Indicator 4 lone "industry: (05-99)" rows by state carry 0.0 to 0.5, unexplained (excluded,
  as services does at All India).
- The API answers a calendar year it does not hold (2026) with no rows.

## For other owners (coordinator)

- **`services-jobs-cy` (services guide) joins two designs**: its calendar years 2023 and 2024
  are the original design and 2025 the revamped one (MoSPI's own note). Its meta says "new
  design" for all three. It should split like `plfs-cy-*` / `plfs-cy25-*`, or at least
  disclose the seam. I have not edited it.
- **Disk**: the machine filled to 0 bytes at about 00:10 on 2026-10-10; my cube fetch died
  with ENOSPC and was re-run. I deleted only my own http-cache and test bundles.

## IDH series matching these bundles

None. The Data Bank's `india_data_hub_series` (checked 2026-10-10) holds 23 labour series,
all EPFO and ESIC payroll counts, no PLFS rate. Nothing to pair for the cross-check.

## Checks run (2026-10-10)

- `npx astro build`, `npm run gates` (validate, coverage, asof, qc, chart lint), `npm test`
  (34), `npm run prose:dry`: all green. `coverage --strict`: plfs clean (other families'
  pending items are theirs).
- Every rebuilt curated bundle diffed against the committed one: no value changed; only the
  base names, revision note, and plfs-quarterly ending at Oct-Dec 2024.
- Prose regenerated (DeepSeek via .env), both files read against the bundles figure by
  figure; two phrases fixed by hand ("the April to June 2026 quarter"; "the jobs it
  counts"); verify (16 and 3 figures traced), lint and contract green. The slot brief now
  forbids comparing participation with unemployment rates (the deep-cut summaries rank
  them together) and counting rising and falling series.
- Looked at 1440 and 390: the ten new and changed plates; no page errors, no horizontal page
  overflow. Fixed on the way: a clipped long UT name (short display names), legends whose
  colour did not match every dot, the seam plate's dot on its own rule (years now drawn at
  their middle), two-panel plates stacking on phones, two titles that claimed more than the
  data (now computed). One share image downloaded (§10, PNG 3888 x 4200, title, key, source,
  brand).
- Hand checks: plfs-q25 against the Oct-Dec 2025 bulletin; Kerala WPR against the Jul-Sep 2025
  bulletin; plfs-annual 2023-24 UR 3.2 against the 2023-24 annual report headline.

## Not done / left

- The old raw dumps `data/raw/plfs-levels.json` and `plfs-extras.json` are no longer written
  (the cube replaces them); left in place as the earlier audit trail, not hand-edited.
- `data/raw/http-cache` was emptied once to free disk (it is a cache; the cube is archived).
