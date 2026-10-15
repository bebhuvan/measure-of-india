# Household assets and borrowing

Updated 11 October 2026. Guide `/guides/households/`, distinct from BIS macro Debt.

## Scope and source inventory

The official AIDIS API listing has 22 indicators. All 218,818 expected rows are
archived and replayed; the former profile aggregation retained 8,177 series.
The household bake retains all 218,818 observed joint grains without creating
Cartesian combinations. Six independently published debt means per indebted
household come from MoSPI's PIB release, giving 23 bundles and 218,824 observations.

`docs/status/households-inventory.json` lists every observed dimension and value.
`data/coverage/households.report-inventory.json` independently inventories all
39 numbered Appendix A tables (70 rural/urban/table variants). API coverage is
complete; transcription of the complete report remains **unfinished**. Seventeen
numbered report tables (27 variants) are outside the API listing: A1, A7, A13,
A14, A15, A20–A23, A25, A27, A28, A31, A33, A35, A37 and A39. They add sample
bases, household type versus asset classes, land area/location, individual
financial access, published asset shares, detailed business investment and land
purchases, and debt amount/incidence cross-tabs. Additional estimated/sample
count columns in implemented tables, Appendix B RSEs and Appendix C sample-design
information also need a structured transcription. These are pending source
extraction and analytical treatment, not excluded as unnecessary. The report's
extracted text and document hash are archived for that work.

## Reader coverage

109 analytical plates cover every API indicator: asset ownership and means,
land/buildings, livestock and equipment, deposits/shares, valuables, household
livelihood/type, head gender, asset deciles, expenditure quintiles, social groups,
rural/urban, states, investment incidence/amounts, creditor incidence/amount shares,
interest bands, loan purpose, tenure and loan-size codes. The directly published
conditional debt means have their own denominator plate and facts. All finer
source cross-tabs are in paginated EveryCut and whole-bundle CSV/JSON downloads.
State estimates are shown in source order, with explicit small-sample/RSE caution.
No state ratio is averaged into India, and no mean is called a representative
household or used to infer inequality.

## Statistical treatment

Stocks: 30 June 2018. Expenditure and expenditure-financing flows: July 2018–June
2019. Interviews occurred in 2019. The API publisher revision date is unknown. Canonical `meta.vintage` is null
with explicit unknown status and a substantive reason. The legacy raw stamp
records archive capture on 10 October 2026 as `archiveCapturedDate`; the
10 September 2021 report edition is recorded separately as `reportEditionDate`.
No equivalence between that edition and the current API body is inferred. The
national release retains its actual 10 September 2021 release vintage.

API headings for A2 and A16 conflict with their cells. Their rupee-lakh aggregates
are totals, never household means. A30 interest/creditor reporting conditions on
households reporting any outstanding cash loan. Household-head gender is distinct
from individual ownership. Asset classes are national sector deciles. Loan-size
codes have no rupee boundaries in the API or detailed table; no ranges are invented.
Valuables remain separate from the headline physical/financial asset total.

Validation independently replays every source cell, checks stock/flow dates and
units, and checks asset and capital-expenditure components, mutually exclusive
loan-amount shares and conditional debt identities against rounded incidence.
Two negative share-asset means for an Andhra Pradesh urban cut remain in the audit
data and are not plotted. One creditor share group has an unreported residual in
its inclusive total; no balancing value is imputed. Source-quality issues are
saved in `data/coverage/households.source-quality.json`.

## Reproduction and verification

`HOUSEHOLDS_FROM_RAW=1 node scripts/lib/products/households.mjs` rebuilds the API
cubes and release bundle offline. `node scripts/households-editorial.mjs` rebuilds
facts/coverage; `node scripts/households-report-inventory.mjs` inventories report
tables. `node scripts/census.mjs households` censuses the complete packet. The
adapter does not refresh existing stock archives automatically: explicit revision
checks must be added before treating it as a full live source refresh.

Focused source/statistical/mobile tests: 11 passing. SVG tests verify full labels,
dots and exact values at container widths 284, 354, 509 and 680 pixels. The combined
design's focused mobile suite passed all 15 tests. Preliminary browser checks
found a clipped zero tick and long hero values exceeding a two-column phone grid.
The zero tick now omits its redundant unit suffix, and headlines opt into responsive
200px minimum columns.

Actual static-browser checks on the combined output at
`http://127.0.0.1:4322/guides/households/` passed at viewport widths 320, 390, 545
and 1280 pixels: all 109 SVGs rendered, all 1,615 dots were present, all exact
values and label words were present, and no SVG text or dots exceeded their bounds.
Compact chart holders had no horizontal overflow. The phone hero values also fit.
A fresh HTTP audit of all 23 served CSVs matched all 218,824 canonical source cells,
including labels, observation dates and missing-value representation. The detailed audit JSON and phone screenshot were originally saved under `/tmp`;
those temporary files were lost after the laptop shutdown. The results above are
the historical checks recorded in this persistent status file, not a new audit.
The recovered handoff is `docs/status/households-handoff-2026-10-12.json`.

All three previously proposed fixes are now present in source, confirmed on
12 October. Their final combined static rendering still needs confirmation:

- Shared citation CSS: the unwrapped citation URL expands the 320px page to 376px;
  `.em-cite p` now has `overflow-wrap:anywhere`. Charts themselves did not overflow.
- Shared `GuideData.astro`: citation vintage is blank when the current bundle is
  inside a grouped family row; the component now reads that bundle's actual canonical vintage.
- Household editorial ledger: the fallback baked rule for the release bundle
  matches no remaining cells because all six conditional debt means are already
  shown. The generator now emits a fallback only when a bundle has unshown cells;
  strict coverage remains unchanged.

The coordinator owns the combined build and release gates; their final success is
still pending. No shared source files were changed during this verification.
First whole-suite run found metadata field names exposed in reader coverage;
the adapter now converts those field names to ordinary words. A separate validator
false positive classified investment by wage-earning households as a wage rate;
structured submeasures now determine the classification and a regression test
preserves actual wage checks.

No commit, push or deployment. Existing checkout changes remain intact. Preview
for the verified combined output uses 4322, managed by the coordinator. The earlier
4323 packet preview is not the current verification target.

## 12 October shutdown recovery

All 23 canonical bundles and their raw archives are present, with 218,824 series.
The persistent facts packet retains 109 plates and 1,615 plotted row appearances;
the source-quality register records 218,824 replayed cells and 3,558 statistical
checks. No source data or shared code changed during recovery. No heavy job was
started. Await the coordinator's final combined output after Farm for citation
vintage and phone-width verification. The report-only extraction gaps above
remain unfinished. Save new verification artifacts inside `docs/status`, rather
than relying on temporary files.

## 12 October vintage correction

A read-only provenance audit found that all 22 API canonical vintages inherited
the profile archiver's capture date. None of the 218,818 API rows provides a
publisher release or revision timestamp. The six-cell PIB release is independently
dated in its archived HTML. The report's original edition date does not establish
the API's latest revision date. Evidence is preserved in
`docs/status/households-vintage-audit-2026-10-12.json`.

The owned canonicalizer and 22 API bundles now declare unknown data vintage, with
`archiveCapturedDate`, `reportEditionDate` and null `apiRevisionDate` separate.
The model carries null/status/reason and formats vintage through the coordinator's
shared `vintageText(meta)` helper. The page's provenance uses that formatter.
The directly published release bundle is byte-for-byte unchanged.

The before-metadata snapshot and after-result audit are saved in
`docs/status/households-vintage-correction-snapshot-2026-10-12.json` and
`docs/status/households-vintage-correction-result-2026-10-12.json`. SHA-256 comparisons
confirm all 23 raw files, all observation dates and every entire series object
unchanged. All numerical facts are unchanged; the facts/plate packet was regenerated
only to carry corrected vintage metadata. All 109 plates and 1,615 plotted row
appearances remain. Seven focused source/statistical tests pass, including a new
capture-date regression and the replay of all 218,824 source cells. The log is
`docs/status/households-vintage-tests-2026-10-12.log`.

No fetch or heavy build was started. No central shared formatter, validator,
registry or QC source was edited by this task. The coordinator owns those changes
and the final combined build/gates/prose checks. Final static verification of
the new unknown-vintage display remains pending; the older browser checks above
pre-date this metadata correction. Source files are frozen again for integration.

## Provenance post-fix production check

The coordinator integrated the generic EveryCut state/sector fallback and the
per-plate canonical Source URL. Fresh served and dist household HTML are identical
at SHA-256 `e2dbf3388e3aaa8e1121105f911bcf3fb8dd3838dd0d09e6b3bd4089ce80b74d`
(526,056 UTF-8 bytes). All 23 bundle descriptors match their canonical metadata and
existing explicit rules in the rendered EveryCut pages. The actual Mizoram key
`c_ace93c93746c56d941dc3dcf` now shows “State and sector”, with its unchanged value
and reference date. All 109 rendered Source hrefs match canonical URLs, and the
conditional-debt Source action opens the PIB release page with its correct date.

The fresh 320px guide and EveryCut register both fit their 305px layout width
(the browser scrollbar occupies the remaining viewport space). All 109 guide
plots, 1,615 exact labels/values and dots remain unclipped. All 23 JSON and CSV
byte hashes are unchanged from the pre-fix wave; the new chart payload's numeric
rows, units and periods match the same canonical cells. Current served JavaScript
assets are byte-equal to dist and hashed. Earlier four-width and native export
checks remain distinct pre-fix evidence rather than being relabelled as reruns.

Fresh evidence is under `docs/status/expansion-verification/households-release/`,
with the targeted conclusion in `postfix-result.json`. Both provenance blockers
are resolved. No source/raw edits, full raw replay or rebuild were made during
this QA. Coordinator-wide release gates still need their own final result.

## Final font-room carry-forward

Fresh served/dist household HTML matches SHA-256
`a9b932d15dd7a8c7d2129ced073840e68076b876c21c51f9be87d8d6336907d6`.
Replacing only its new script URLs with the saved prior URLs reproduces the exact
prior provenance-fixed HTML hash, proving reader text, Source hrefs and embedded
payload unchanged. Current served JavaScript assets match dist and are hashed.
All 109 owned charts were checked at 320px: 1,615 exact labels/values and dots,
no clipping or overflow, and page/layout width both 305px. The served Mizoram
EveryCut row retains “State and sector” and its unchanged estimate. Fresh native
SVG and PNG button downloads are byte-identical to the prior visually verified
exports, including their wrapped metadata.

The remaining three width checks and the 23 JSON/CSV source-value proofs are
carried forward, explicitly not rerun. No CSV/raw replay, source edits or rebuild
was performed. Receipt: `docs/status/expansion-verification/households-release/`
`font-room-receipt.json`. Coordinator-wide final gates remain a separate result.
