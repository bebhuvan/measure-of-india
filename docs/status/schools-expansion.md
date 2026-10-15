# Schools expansion

First implementation packet, 10 October 2026. The guide uses every observed row
from 46 UDISE API indicators and 18 CMSE education indicators, plus all 86
national highlights in the Ministry's existing-structure report. This is API
coverage, not a claim to cover every table in every school publication.

111 canonical bundles preserve 110,498 distinct source cuts. Earlier
institution-level and newer student-level collection are split at 2022–23.
The state, management, gender, social-group, school-stage, school-category,
facility, household sector, expenditure and coaching dimensions remain intact.
The 66 analytical plates have labelled denominators and explanations; all other
cuts are searchable, paginated and downloadable through the guide's register.

The adapter reuses unchanged archived UDISE rows for the launch bake.
`SCHOOLS_FROM_RAW=1 node scripts/lib/products/schools.mjs` reproduces the bundles;
`node scripts/fetch.mjs only schools` refreshes complete API cubes. The report
URL and anchor assertions intentionally require review when its edition changes.
`node scripts/schools-editorial.mjs` regenerates deterministic facts, coverage
and the source-quality register. The adapter runs this editorial regeneration after a bake. It never updates
freshness attestations. Live PDF extraction requires Poppler’s `pdftotext`; the
release workflow installs it and includes updated coverage files in its PR.

Source replay verifies 281,757 API rows and 9,978 count/share identities. Ministry
national pupil, school and teacher counts reconcile with additive state totals.
CMSE school-type shares and school-expenditure components reconcile within
published rounding. GER source zeros without estimates stay null; reported
zero dropout rates remain zero. Population-base anomalies and a negative CMSE
funding share are retained in `data/coverage/schools.source-quality.json`.
Published facility rates keep their own eligible populations; derived all-school
facility shares are separately labelled. State rate medians are unweighted and
are never described as national rates.

Still outside this packet: the separate NEP structure, Ministry report tables
not in these API products, independent learning/attendance evidence, and survey
uncertainty tables. Broader expansion continues with the next ranked packet in
`docs/PLAN-coverage-expansion.md`.

## Verification completed

- Full Astro build: 1,277 pages; search indexes all 930,926 site series entries.
- `npm run gates`: passed, including validation, coverage, freshness, rendered
  numbers, complete register/download access, file budgets, search and chart lint.
- Chart lint: 922 SVGs across 88 site pages, no geometry failures.
- Strict coverage: 43 ledgers clean; Schools has 6,454 shown and 104,044 baked
  cuts, with no exclusions or pending decisions within its stated API scope.
- Full tests: 76 passed. The six Schools tests also passed after the final edits.
- `npm run prose:dry`: passed; no paid narration calls made.
- Every Schools CSV was parsed and replayed: 290,849 date-aligned cells,
  with canonical nulls exported as empty fields.
- Browser inspection: desktop and phone layouts, grouped counts, chart scrolling,
  updated unit labels and the CSV menu action; no browser errors. The download
  event automation timed out on an incorrect menu locator; the visible menu item
  was subsequently clicked successfully, while file contents were verified directly.
- Archive rebake ran the new editorial callback successfully. The release
  workflow now installs Poppler and stages changed coverage files.

Changes remain local and uncommitted. Publication still requires the normal
human-merged release PR. This packet completes Schools API coverage; the other
ranked expansion packets remain pending.

### Phone chart correction — 2026-10-11

The owner’s screenshots showed category labels occupying the visible phone chart
while the dots and values sat beyond its right edge. The old fixed-width charts
passed geometry lint but required a swipe to see the measure. That was inadequate.
All 66 Schools plates now choose a compact layout once at load when their container
is at most 680px wide: full names wrap above each measurement, dots share a common
scale, and exact values occupy a separate right column. Desktop retains its wide chart
layout. The compact SVG opts out of the shared 700px minimum; no data is removed.
SVG and PNG downloads use the displayed layout, with normal metadata; CSV is unchanged.

Regression tests render every plate at four container widths and verify all dots,
full labels and exact values. Browser checks at 320px, 390px and 545px found all 66
plates fitting their containers without horizontal overflow; the narrowest phone
also has no text extending outside an SVG. These are actual mobile geometry checks,
which the previous desktop-only chart lint did not provide.

Saved phone evidence: `docs/status/schools-mobile-fixed.png`. The full unit suite
passes 81 tests, including five new mobile/desktop geometry tests. Reproduce the
focused checks with `node --test test/schools-mobile.test.mjs`.

Final verification: the full Astro build completed all 1,277 pages and the search
index; `npm run gates` exited zero. All 43 coverage ledgers and 531 as-of blocks
passed, page QC passed, and chart lint found no geometry faults in 922 SVGs across
88 pages. The rebuilt static preview was also checked at phone width: all 66
Schools plots fit, with no browser warnings or errors. Desktop reload restores
1,120px charts. The temporary development server was stopped; the updated static
preview remains open. Changes are local and uncommitted; nothing was deployed.
