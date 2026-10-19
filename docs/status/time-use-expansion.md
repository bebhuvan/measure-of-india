# Time Use Survey expansion

18 October 2026. Current work: direct-source evaluation and the first report-backed
guide edition. The first report-backed appendix edition is implemented and locally verified.
No commit, push or deployment is authorized or performed.

## Chart-kit edition (lb/time-use, 18 October 2026)

The guide now lives on `lb/time-use`, branched from `lb/chartkit` (the live site), and is drawn at
build time with chart kit v5. Codex's first edition (167 Plot dot charts, client-side payload) is
retired: `time-use.client.js`, `time-use.plot.js` and `time-use.payload.js` are gone, and the page
ships no chart script beyond `guide.client.js`.

- **20 plates, chosen by finding rather than one per cell.** The day (24-hour bars, by sex, sector
  and age); share who did it × time among them (rectangles); participation; normal versus other
  days; tasks inside domestic work and care; kinds of employment; leisure and rest; paid and unpaid
  work by age (published totals); where work happens; marriage; usual status; education; spending
  fifths; social group; a state tile map, a ranked state dumbbell and a state uncertainty chart;
  proxy response; precision. Every other cell remains in Every cut and the downloads.
- **Model** (`src/dossiers/time-use.model.js`): each plate is a list of traced rows (bundle,
  series, workbook cell) and a `shape` that names rows by index; titles and the plate's lead figure
  are computed from the same rows. Categories are mutually exclusive (no aggregate drawn beside its
  own components); nested age bands are labelled as such.
- **Charts** (`src/dossiers/time-use.charts.js`). Two new kit forms, `dayBars` and `rects`, plus
  three kit options: `stackBars` row.total (a published total that can differ from the parts by
  rounding), `dumbbell` spec.max (one scale across panels) and `rects` per-person shown as ≈ when it
  is a product rather than a published figure.
- **One computed quantity**: the state range is estimate ± 1.96 × estimate × published RSE ÷ 100
  (sampling error only), labelled as approximate on the page. 34 of 35 adjacent ranked pairs
  overlap, and the plate's title says so.
- Coverage after the change: 514 cells shown, 221,116 baked, 5,071 source dashes excluded.
- Tests: `test/time-use.test.mjs` now checks that every drawn number is a traced row, every row is
  drawn, the day budgets hold, location shares overlap and the state ranges use the published RSEs.
- The OG card draws the guide's own day bars.

Parts of the record below describe the first edition (plate counts, payload factoring, the
Plot-era phone rule). They are kept as history; the bullets above are current.

## Source decision

Use the original NSO report workbooks as the current canonical source. The
direct MoSPI API responds through `scripts/lib/mospi.mjs`, but changing from
MCP to HTTP does not remove source defects. The direct route is used for
metadata and bounded cross-checks, not as an automatic replacement for report
definitions or cells.

The direct indicator catalogue contains 41 indicators. Discovery archives retain
each indicator, its actual metadata and its first 100 records. Complete direct
API cubes for indicators 39–44 are also retained, including the source's separate
survey years. A larger acquisition was stopped once the report's complete
workbook route was recovered; its successful HTTP pages remain resumable in the
shared cache. This is not a complete API acquisition.

The bounded comparison is in `docs/reference/time-use-api-report-audit.json`.
Indicator 32 is labelled major-only participant time, but 98 of its first 100
records differ from the corresponding original major-only report table. The
audit also checks whether the alternatives reproduce the all-activities table.
Mixed-measure indicators label minute observations `%`. Unmatched and ambiguous
cuts are counted separately; they are not counted as agreement or source errors.
API revision timestamps are unavailable, so no fetch date becomes a revision date.

## Complete archived appendix inventory

The official report is 19,594,975 original bytes. Its PDF URI annotations name
all 46 Appendix A workbooks and all 16 Appendix B sampling-error workbooks.
All 62 original XLSX files are archived with URL, SHA256, report hash and the
original PDF page/annotation coordinates. No filename guessing or MCP wrapper
is required. Raw writes use `writeRaw`; original source bytes are unchanged.

The extractor reads every workbook/sheet and uses explicit numbered columns,
merged header paths and labelled context panels. It rejects unaccounted numeric
cells and ambiguous canonical cuts. Source controls and RSEs are distinct from
activity estimates. There are 226,701 headed source cells: 221,630 numeric cells
and 5,071 exact source dashes. Dashes are accounted for, never baked as zero.
Counts include controls, nested activity classifications, overlapping groups,
alternative allocation methods and repeated statistical views. They are not
counts of independent concepts or unique people.

The family has 74 single-survey snapshot bundles. Tables 4 and 5 are partitioned
by rural/urban/combined scope to retain every observation within the deployed
file budget. Leaf and parent activities can share wording; their official
classification codes remain in reader labels and CSV headers to preserve identity.
The first original CSV build rejected duplicate human labels; the code-preserving
fix addresses the whole hierarchy and has a regression check.

The RSE8 India workbook repeats Table 36's title. Its original heading remains
in `sourceTitle`; its RSE interpretation follows the explicit Appendix B
attachment listing. RSEs have their existing `pct_rse` unit and can exceed 100%.
Participation percentages remain subject to their own share envelope.

The activity dictionary is independently recovered from the report’s Appendix C.
All 230 codes are present; 229 API labels agree, while code 490 incorrectly
appends the following volunteering category in the API. Reader labels use the
report dictionary. The audit is `docs/reference/time-use-classification-audit.json`.

## Reader edition

`/guides/time-use/` is guide 37. The deterministic model currently authors 167
analytical plates, each with a source-bound reading, exact source coordinates and
chart downloads. The review-fixes section below records the changes and checks. Topics include participation versus participant duration versus
population duration; paid and unpaid work together; accounting boundaries;
day type; detailed domestic work and care; age, usual employment, marriage,
consumption fifths, educational and social groups; rural/urban; geographic time
shares; proxy reporting and sampling uncertainty. Every finite appendix cell
is reachable through EveryCut and bundle downloads.

All prose figures and chart rows are in `pipeline/out/facts-time-use.json`.
No LLM arithmetic or live reader fetches are used. Census classification is in
`docs/reference/time-use-census-review.json`; “summarize” means a discoverable
fine cut rather than an independently authored plate for each cell.

The editorial leads distinguish population averages from participant averages.
Among domestic-work participants, female regular wage/salaried workers record
197 minutes, males 81. Female participants in the lowest/highest consumption
fifths record 285/289 minutes. The source's combined paid-and-unpaid population
time is 367 minutes for females and 307 for males. These are age-six-plus group
estimates, not adult-only, causal, or matched-partner comparisons.

## Verification

- Independent original-XLSX replay: all 221,630 numeric cells and 5,071 dashes
  match their exact workbook/sheet/cell; zero differences. Receipt:
  `docs/reference/time-use-source-replay.json`.
- Source-to-canonical replay binds all original workbook hashes, the report
  hash, every canonical record and its complete dimensions/units/labels.
- 11,087 identities pass: detailed participation × participant time, rounded
  day budgets and the joint paid/unpaid table denominators. Rounding tolerances
  come from published decimal and whole-minute precision.
- Focused tests cover zero/dash distinctions, duplicate cuts, stable identities,
  RSE versus participation envelopes, full source-family conservation, unique
  CSV headers and exact caption/export source identities.
- Full unit suite: 345 tests passed. Latest source/registry/payload run: 17
  passed; the subsequent coverage matcher parity suite: 2 passed.
- Strict coverage: 50 ledgers pass. Time use accounts for 1,583 shown cells,
  220,047 additional baked cells and 5,071 excluded source dashes, with no
  blocked items in this appendix scope. Exact-ID matching uses sets instead
  of compiling thousands of regular expressions; rule priority is unchanged.
- Prose dry run completed; as-of checks pass all 497 dated paragraphs.
- Production Time Use chart lint passes all 121 SVGs at desktop and 390px: no
  collisions, text overlaps, bleeds, clipping or centred-label findings.
- Production HTML is 522,524 bytes (75,694 gzipped); payload factoring is
  lossless and tested against the full analytical model.
- Desktop production browser inspection: all 121 charts render, headline
  figures populate, and the fresh production tab reports no console errors.
  An independent visual check of original report page 18 confirms the four
  headline anchors and employment/leisure population averages.
- Full-site chart lint passes all 1,116 SVGs across 94 pages at desktop and
  390px, with no geometry findings. Search checks find all 443 sampled series
  across 37 guides by their label, then open each exact row.
- `npm run gates` was run: Time Use source validation passes, while the overall
  command exits non-zero for exactly two pre-existing public-finance backcast
  base-name/seam failures. The dirty bundle says “Measure of India ratio over
  the NSO back series of 2011-12-base GDP”; registry/seam checks expect “India
  Atlas ratio over the NSO back series of 2011-12-base GDP”. No gate is weakened
  and no unrelated bundle is changed here. Rendered QC is run separately.
- Browser inspection found the shared 700px plot minimum stretching the custom
  compact charts. The Time Use phone rule now clears that minimum; a fresh
  production rebuild has emitted the corrected page. Actual 390px browser
  reinspection renders all 121 charts, with 0 oversized chart SVGs, 375px
  document width inside the 390px viewport and no console warnings/errors.
- The share image uses four source-bound domestic/care dots rather than a
  one-point time-series template. It was regenerated and visually inspected;
  full source labels no longer overflow the card.
- Full rendered QC passes: numeric checks, all 221,630 EveryCut rows, all
  source downloads, search anchors, source text, no placeholders/non-finite
  text and all 52 prose freshness contracts.
- Actual browser downloads were checked from disk. The broad-day chart CSV
  contains all 18 source-traced rows, matching facts-sheet labels, values,
  units, survey year, bundle IDs, series IDs and workbook cells. The downloaded
  SVG parses and contains its title, NSO source and expected source figures.
- The initial complete explorer replay then caught an integrated deployment
  count of 17,107 files, exceeding the existing 16,000 headroom budget. This
  expansion must meet that budget without dropping rows or changing its limit.
  Search row chunks now target 256 KiB rather than 128 KiB, measured in UTF-8
  bytes. The 1 MiB hard ceiling and the 500 KiB gzipped core ceiling remain
  unchanged. The complete pre-repack row stream is hashed for lossless replay.
  Search’s 20 focused tests pass. Repacking retains the full index in 1,748 row
  chunks (previously 3,475). Final explorer verification passes all 1,914,883
  records across 2,717 bundles and the unchanged deployment headroom budget:
  15,400 assets against 16,000. Receipt:
  `docs/reference/time-use-explorer-verification.json`. The independent exact
  row-stream/core comparison and all 443 real-query/anchor checks pass too.
  Receipt: `docs/reference/time-use-search-repack-audit.json`. All 1,914,883
  search rows have the same SHA256 stream before and after repacking; all
  other core fields are identical. Maximum row chunk: 262,143 bytes; core:
  356,271 bytes gzipped. The final verified build is promoted to `dist/`.
- CSV, SVG and PNG downloads were activated in the actual browser. The PNG was
  inspected visually after download: source, title, labels and values are legible.

## Reproduce

Use a Python executable with `pypdf` and `openpyxl`, supplied locally by the
Codex workspace runtime. Set `ATLAS_PYTHON` to that executable; this is a runtime
path, not a credential. No new repository dependencies were installed.

```sh
node scripts/time-use-report-acquire.mjs
"$ATLAS_PYTHON" scripts/time-use-classification.py . > /tmp/atlas-time-use-classification.json
node scripts/lib/products/time-use.mjs --import-classification /tmp/atlas-time-use-classification.json
"$ATLAS_PYTHON" scripts/time-use-extract.py . /tmp/atlas-time-use-extracted.json
node scripts/lib/products/time-use.mjs --import-extraction /tmp/atlas-time-use-extracted.json
"$ATLAS_PYTHON" scripts/time-use-source-replay.py
node scripts/time-use-api-audit.mjs
node scripts/census.mjs time-use
node scripts/time-use-editorial.mjs
node scripts/fetch.mjs only time-use
```

`fetch only time-use` is explicit offline replay of the archived, interpreted
report edition. It does not discover a future survey, refresh an API revision,
or certify a new report. New editions require catalogue acquisition, source
interpretation and reconciliation before promotion. Archive/current/source
revision dates are separate.

## Scheduled, unfinished coverage

The preceding survey's full original tables and report-defined comparability
remain unfinished. The metadata/API contain two years, but that is not a
validated historical series. Do not splice the observations into one ruler.

The report chapter's additional state Statements 1.1–17.1 remain to be extracted
and reconciled in full. The current edition includes the appendix's geographic
time shares and state RSE tables; those do not substitute for every state
statement. Neither the guide count nor the complete appendix inventory is a
claim that the entire Time Use Survey family is finished.

## Full-guide review, 18 October 2026

A subsequent editorial and statistical-meaning review found issues that the
source-cell and geometry checks do not detect. The review recommended these
corrections before publication; implementation is recorded in the next section. Full findings and all 74 bundle dispositions:
`docs/reference/time-use-review-audit.json`.

Required: correct the overlapping location-participation explanation and the
paid-only filter under a paid-and-unpaid title; correct the age captions’
participant/per-person mismatch; complete analytical treatment of the omitted
volunteering, social/religious and personal-care/sleep dimension cuts.

Recommended: paired gender dots with one category label, natural age order and
a distinct treatment of nested ages, clearer sector-relative consumption fifths,
source definitions of household social group, and source-traced takeaways for
the individual comparisons. There are 121 plots but only 33 distinct explainers.
The rendered guide is 165,606 CSS pixels high at desktop width and 242,510 at
390px. No horizontal overflow was found; geometric cleanliness alone does not
make this volume of material easy to read.

Fresh source validation passes 11,087 identities; all nine focused tests pass.
The overall gates still fail only the two known public-finance base/seam checks.
A new independent location check examined all 27 sector/gender/activity groups:
all have overlapping location percentages; weighted location durations reproduce
the all-location participant duration within 0.664 minutes at worst, consistent
with published rounding. Female paid-work location participation sums to 107.4%,
which directly rules out treating it as a mutually exclusive composition.

That pass recorded the findings without changing guide source or analytical
selections. The subsequent implementation is recorded below.

## Review fixes, 18 October 2026

The review findings above have now been implemented. Location charts separately
cover paid work, unpaid work and their union on both participation and conditional
duration. Their captions explain overlapping locations; the all-location control
remains in EveryCut, outside the plotted locations. Validation now checks the
location-weighted duration identity in all 27 source groups using a rounding-derived
tolerance. No source rate is renormalised.

All nine major divisions now have duration and participation comparisons for age,
usual work status, marriage, consumption fifth, education and household social
group, plus rural/urban population-time comparisons. Age companions correctly
name per-person time. Three source-defined combined-work age charts add the
working-age comparison without constructing a synthetic disjoint age band.
The young-adult group is explicitly labelled as nested within working age.

The guide now presents 167 plots and 2,131 distinct source observations (previously
121 and 1,583). Every plot has a deterministic reading from its own source cells,
recorded in the facts sheet and checked against rendered text. Shared dimension
definitions sit at chapter level. Spending labels name the fifths, explain their
separate rural/urban ranks and short consumption module, and avoid income/wealth
or common-rupee-band claims. Social groups follow the household head's reported
group, assigned to household members.

Paired female/male dots share a category row and have labelled value columns.
Equal values have separate visible dots. Each label controls only its own row's
spacing; source observations and identities survive unchanged in accessible
text and CSV exports. Provenance now precedes the explorer/download endmatter.

Checks completed: all 352 repository tests, including 12 focused Time Use tests;
strict coverage; prose dry run; as-of freshness; 11,114 source identities; and all
167 charts at both desktop and 390px geometry checks. Actual browser checks at
1280px and 390px show all charts and readings, the added working-age facts and no
horizontal overflow. Downloaded CSV/SVG retain all 18 broad-day observations;
the phone PNG is legible at 1,341 × 3,054 pixels (previous export: 4,890 pixels tall).

The whole page is longer because it includes the additional comparisons and
readings: 185,349 CSS pixels at desktop, 260,625 at phone width. This is a
presentation-density improvement within individual charts, not a claim that the
expanded guide is shorter. The phone's tallest plot is 2,014 pixels. HTML remains
under the page budget at 692,685 bytes.

The full production build finished with 2,370 pages. Integrated explorer
verification passes for all 2,717 bundles, 1,914,883 records and 15,747,610
observations. Full rendered QC passes, including every source-bound reading.
Both geometry sweeps pass: 1,162 SVGs across 94 pages at desktop and 390px.
The final browser preview has no runtime errors or warnings.
The post-build `npm run gates` again stops only at the two existing
public-finance-ratios-backcast base/seam metadata failures; Time Use source
validation passes. No raw data was edited,
and nothing has been committed, pushed or published. The overall release gate remains blocked by those two unrelated metadata
failures; no Time Use validation or rendered-QC failure remains.

Rendered text checks account for the existing guide formatter’s display punctuation
(middle dots become commas, spaced em dashes become colons). The original numeric
strings remain exact; six initial punctuation-only check mismatches were corrected
and the full rendered suite was rerun successfully. Downloaded CSV values, units,
periods, source cells and dimensions also match the canonical observations exactly.
