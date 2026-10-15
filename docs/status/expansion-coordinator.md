# Expansion coordination

Updated 11 October 2026. Coordinator chat:
`01a1289e-da11-7e30-9de6-03d154fffcf4` (local).
Owner authorized separate Codex chats and managed worktrees, with file-level
integration. No commits, pushes, release merges or deployment.

## Wave one ownership

| Family | Chat | Checkout | State |
|---|---|---|---|
| Household assets and debt | `01a12891-9de8-72e1-9869-6a5cf4dc0a6a` | Main checkout | Final build/gates and mobile QA; source fetch finished |
| Farm households, income and risk | `01a128a0-ae1b-7342-9532-318f7d01bed0` | `/home/bhuvanesh.r/.codex/worktrees/9dde/Economic atlas new Kimi` | Active, full NSS77 raw inventory |
| Energy supply, use and electricity transition | `01a128a0-d8e6-7b21-b18f-0d15769328b2` | `/home/bhuvanesh.r/.codex/worktrees/56ae/Economic atlas new Kimi` | Active, overlap/source audit |
| RBI company finances | `01a128a9-19e4-72e2-805d-08ad82cf02bc` | `/home/bhuvanesh.r/.codex/worktrees/ed83/Economic atlas new Kimi` | Active; deepens existing Markets and audits unused cuts |

Detailed worker contract: `docs/briefs/expansion-wave-1.md`. Workers own their
slug files and isolated registration blocks. Coordinator owns common docs,
plumbing, parent integration and final regeneration. Existing old `lb/*`
worktrees are unrelated and are not reused or cleaned up.

## Seed evidence

Main branch `launch-build`, HEAD
`3fa544aa31051bc0e803ea82afdc390fd385252c`, with extensive uncommitted Schools,
assessment and AIDIS changes. AIDIS signalled a coherent checkpoint at
2026-10-11 01:42:15 UTC (07:12:15 IST) in
`/tmp/atlas-aidis-checkpoint.json`. Both builders were created with explicit
`startingState: working-tree`, not the remote default.

Both managed worktrees have that HEAD and detached checkout state. Verified
byte equality with the parent before family edits for AGENTS.md,
schools.plot.js, households.model.js, dossier registry, corrected profile
adapter, measure-semantics.mjs and the wave brief. Builders independently
record their full inherited baseline for integration. Their dirty seed is
not their patch. No ordinary Git commit was created by this coordinator.

## Checks and source gaps

AIDIS checkpoint: 22 API indicators; 23 bundles; 218,824 observations;
109 analytical plates. Source replay/statistical checks and 11 focused tests
passed at checkpoint. Final rendered phone boundaries and full gates are
still in progress. Seventeen report tables and additional sample/count/RSE
columns remain explicitly unfinished. New actual status is
`docs/status/households-expansion.md`; the old households.md is historical.

Farm inventory figures and energy canaries in the plan are starting evidence,
not completed ingestion. Each worker must recount and replay full source
tables. Energy must reconcile electricity output's GWh unit separately from
the KToE metadata branch. Ember source copies/derived outputs are not counted
as independent coverage. Sibling project and Data Bank stay read-only.

MoSPI fetches use `/tmp/atlas-mospi-expansion.lock` around the whole fetch and
shared throttling. Builds hold one of two `scripts/build-slot.sh` slots.
Initial disk availability was about 7 GB; avoid duplicated large archives,
caches and retained build trees. Preserve main preview 4322; AIDIS uses 4323,
farm 4331 and energy 4332.
RBI Markets uses 4333. Immutable inherited canonical files in the farm/energy
worktrees were hash-checked against their recorded baselines and deduplicated
with atomic hard-link replacement: 2,422 files and 618,489,365 bytes per tree.
All bytes/baseline hashes remain unchanged; family files are independent and
canonical writes must remain atomic. This recovered about 1.2 GB.

Farm replay found indicator 33 repeating Andhra Pradesh's debt vector under
all 31 state labels; official Report 587 contradicts the API national value.
Builder is preserving defective cells and recovering report-native debt.
Energy fully acquired 14,970 API rows, verified the supply canary and identified
a scaled-GWh defect in the PJ branch. It is adding complete report transformation
rows and checking the newer official 2026 workbooks before guide completion.
These are implementation milestones, not completed/verified guides.

Owner's RBI follow-up: `docs/reference/rbi-expansion-check.md`. Current mirror
catalogue has 797 loaded report IDs and 252 elements; 197 of 758 comparable
report end dates lag the local official inventory. New local prompted corporate
holdings reach later than Atlas's RBIhub-based listed-company family. Builder
brief: `docs/briefs/expansion-rbi-markets.md`. Unreferenced IDs are not assumed
to be unique missing concepts; rural wages already has a CPI destination.

## Coordinator work and integration

Read-only audit of the separate older design preview covered 30 guides and
467 plot zones at phone and desktop widths. Phone: 264 zones scrolled, three
had tiny scaled labels and fourteen had text outside their SVG bounds. This
diagnostic is not validation of the current combined output.

AIDIS handed over a shared-files-free checkpoint at 07:23:30 IST. Reviewed
Claude design files were integrated by three-way file comparison, preserving
new registrations, generic compact SVG exemption and long household values.
Rollback snapshot: `/tmp/atlas-pre-design-snapshot/manifest.json`. No Git
history change. Wrapped full category names replace the wrapper's truncation;
continuous/time plots now keep all observations and domains at phone width
with fewer axis ticks. Six shared plot tests and the 15 focused shared/Schools/
households mobile tests pass. Actual combined rendered QA remains required.

The local app closure interrupted all four builders and stopped build/test processes.
On 2026-10-11 the coordinator retriggered the existing four chats from their
saved checkpoints; no duplicate chats or worktrees were created. Farm and
energy are reclaiming only their own partial dist outputs. Verification now
runs sequentially to avoid the prior memory pressure. Previous incomplete
logs are not passing results. Coordinator combined build/gates and tests
were restarted in one sequential shell job (session 76825): build, gates,
bounded whole-suite tests, then prose dry run. Completion remains unverified. Logs:
`/tmp/atlas-coordinator-build.log`, `/tmp/atlas-coordinator-gates.log`,
`/tmp/atlas-coordinator-tests.log`. Do not refresh prose attestations without
actual review. Worker guide handoffs are still pending.

Integrate only changes against each worker's baseline, preserve later parent
edits, review shared hunks individually, regenerate shared outputs once, then
build/gates, strict coverage, tests, prose dry run and actual artifact QA.
No guide is complete from a catalogue or green ledger alone.

Next waves remain digital access/skills, WTO services/tariffs, UNCTAD
shipping/FDI and reviewed population/climate/water/environment depth. Launch
them when integration and disk/build capacity permit; audit overlap first.

## Resumed worker review

Farm source replay checks 501,008 cells and 24,741 identities. Its full build
and gates remain pending. Two reviewed proposals await central integration:
`/tmp/atlas-farm-measure-semantics-proposal/proposed.patch` separates legitimate
zero household wage-income components from wage rates;
`/tmp/atlas-farm-households-og-proposal.patch` adds a custom OG renderer for
the two monthly income cost conventions. The worker regenerated and visually
checked only its own card. Neither proposal has been applied to main yet.

RBI worker isolated whole-table zero-fill amounts and an invalid CAS ratio
aggregation for Agriculture: Others. It is retaining historical cells with
explicit mirror provenance pending direct report evidence; no wider tolerance
is accepted. These are source-quality findings, not completed rendered QA.

Farm follow-up handoff includes all 13,950 API leasing cells reconciled to
report Table 34; indicator 48 strings are documented as source headers. The
15 disposal-rate outliers are confirmed in report Table 13A and remain
withheld from plots with originals preserved. Worker fact explanations and
canonical notes changed without numeric/vintage changes. Central sync awaits
current verification; these updates are not yet in main.

Energy follow-up detects an API coal/lignite definition seam and splits
source-native bundles without dropping cells. Direct definition evidence and
affected-year boundaries are requested for review; row availability alone
does not prove a methodological boundary. The worker adds a separately
labelled partial GWh-output plate (129 plates reported), keeping scaled PJ
rows audit-only. Main integration and rendered checks remain pending.

## Combined build checkpoint

Main static build completed at 09:43 IST: 1,507 pages, 1,149,750 search
series, 651 indexed plates. Gates are running; tests/prose dry run are queued
in the same sequential job. AIDIS now audits actual static output at4322.
Current 32-guide browser bounds audit covers 642 plot zones per width:
320px:23 overflow/3 tiny-label/51 clipped zones;390px:22/3/31;
545px:24/5/19;1440px:0/0/10. No page errors. These are actionable failures,
not an all-clear. Staged annotation wrapping preserves full words and76
observations with zero fixture clipping at320/390/545; staged change is not
yet in main and complete guide verification remains required.

Energy may queue one final full build behind main using ATLAS_BUILD_SLOTS=1,
checking at least3GB free at actual start. Farm may apply reviewed wage
semantics only in its own worktree; its full build remains held behind energy.
RBI full build remains held. Each worker must reclaim only its own dist after
final QA to keep disk available.

Farm applied the reviewed household-income predicate only in its own checkout
and added `test/farm-households-semantics.test.mjs`; focused regression passes.
Main retains the old predicate until the running verification job finishes.
Energy now reports43bundles/10,504series/10,908catalogue entries/129plates
with explicit coal/lignite source evidence; its source-focused10tests pass.
Main gates remain active. No gate success is claimed from incomplete logs.

Energy full validator now passes279,401cells/14,018identities/43bundles;
prose dry run passes. Current development-render QA found shared CSS minimum
width overriding compact family charts; a scoped fix is being rechecked.
Static build/gates remain pending. Main household replay passes218,824cells
and3,558identities with three published discrepancies retained in the audit;
combined gates are still running beyond this checkpoint.

## Reviewed corrections applied centrally

The first combined build passed, then gates stopped at the single unused
household fallback rule46. Data validation passed; later as-of/qc/chart
gates and whole tests did not run because the sequential command stopped.
AIDIS owner static QA passes109charts at320/390/545/1280 and23CSVs against
218,824cells. Citation overflow/vintage and coverage fallback remained.

Applied the owner-reviewed three-file correction, regenerated household
ledger/facts without changing data, and applied the reviewed wage-income
semantics fix centrally. Long annotation wrapping and edge anchors were
applied from the staged browser-tested wrapper; font-size-aware wrapping
has regression coverage. Backup:/tmp/atlas-resume-fixes-snapshot.
13focused tests pass; refreshed shared plot/semantics8tests pass. Main prose
dry run passes. These source corrections still require a fresh combined
build and rendered checks. Existing4322output predates these corrections.
Energy final isolated build started with5.23GB free under exclusive slot1.
Farm remains next after energy; RBI source review still evolves and full
production checks are held.

RBI share review establishes noncomparable source populations rather than
numeric corruption: report1073 FY2024 share uses3,922companies while sales
amount/growth use3,902; FY2025 uses4,302versus4,278. Published values remain
in raw/source-quality records with exact denominator/sample lineage and are
isolated from comparable share series. Above100alone is not accepted as
proof of corruption. Final worker replay/count/hash refresh remains pending.

RBI integration review found a fetch ownership regression before copying:
new markets-listed runs before markets-spf, whose legacy hub adapter emits
listed bundles too. A future all-product refresh would overwrite the official
canonical history with mirror outputs. Worker must condition legacy listed
emission on configured product ownership and prove an offline SPF replay
leaves official listed bytes unchanged. Integration remains held for this fix.

## RBI integration checkpoint

Integrated64files after every main file matched the worker baseline and every
worker file matched its handoff hash. Source archives copied byte-identically;
inherited household ledger/source-quality excluded. Snapshot:
/tmp/atlas-rbi-integration-snapshot. Ten focused source/ownership tests pass in
main; syntax/diff checks pass. Updated Markets production build/QA is pending.
Legacy hub now respects configured listed-company output ownership; offline
SPF replay updates6forecast bundles without altering26official listed bundles.

Energy acquisition scope is explicit: this wave verifies the archived2026
report/API/Ember packet, while the registered adapter canonicalizes it offline.
Automatic future release detection/acquisition remains unfinished and must not
be described as live refresh. Source vintage must remain unchanged on replay.

Energy isolated static rebuild passes1,527pages including search. Gates and
actual static129-plate audit remain active. Acquisition runbook explicitly
separates frozen-source replay from unfinished future release transport.
Farm may perform family-only development QA while its full build remains held
behind energy; reconciliation gaps must reflect already confirmed evidence.

Energy first final gates pass validation and45coverage ledgers, then fail on
one orphaned as-of key `energy#cb-sectors-non-energy`, superseded by current
`sectors-non-energy-use`. Worker removes only that inactive entry, preserving
129active blocks and review dates; verification continues against unchanged
successful static build. This is not yet a complete gate pass.

Preview port correction:4331is an unrelated existing Python server and must
remain untouched. Farm's new dev process auto-selected4332; coordinator
requested moving only that owned process to free4334, leaving4332reserved
for Energy final static QA. Main remains4322and RBI4333. Each worker must
verify actual port and guide ownership before recording browser evidence.

Farm development render caught missing plainkg EveryCut formatter before
integration. Worker adds it in the exact family unit hunk and must verify
formatting for every unit across83canonical bundles plus actual kg EveryCut
output. All13family units are registered; rendered QA continues.

Farm all-cell unit formatting regression passes across83bundles/501,008
entries; distinctunitcount corrected to13. First390pxrender loads213charts
and exposes compact-SVG CSSfloor plus long unit-bearing axis ticks. Scoped
CSS/numeric-tick changes are being rechecked with units retained in explicit
axis/footer labels. Final geometry/values/pageoverflow QA remains incomplete.

Energy continuation passes fullvalidation/45ledgers/asof769blocks. Rendered
QC finds ownHTML1.35MB > normative1.2MB. Worker lowers onlyenergy inline
EveryCut limit600→300, preserving129explainedcharts and10,504series through
linkedviews/downloads, then rebuilds. Farm must preflight devHTMLbytebudget
before its fullbuild. No budget or source granularity may be weakened.

Farm development QA now passes213charts at320/390/545/1440 with full
category words, exact values, units and no pageoverflow. HTMLbytepreflight
and downloads remain. kgEveryCut route verification waits for final static
artifact rather than adding a temporary dev-only production-route filter.
Model cache review confirms bigintmtimeNs/size snapshot of manifest,83
canonical files and definitionarchive; same-size/label invalidation
regressions requested before integration.

Farm devHTML1,738,637bytes includes913,512bytes of dev-only inspector
attributes; projected825,125bytes is underbudget but actual staticQC still
required. Published API42kg quantities were absent from analytical selection;
worker audits alljointmeasure definitions and adds source-native quantity
cuts with correct conditional household bases. Previous213chart dev pass
does not verify any new plates added after this source-selection review.

Farm adds16direct-source API42quantity/value slices, retaining213earlier
charts (229total). Audit maps13jointmeasurement identities/3,211cells to
analyticalplates; nationalmeasurement gaps reported resolved. Coconut count
and countperhectare remain distinct fromweightunits, conditional bases
explicit. Source/canonical/download unit consistency requested; all229plots
require newfourwidthQA and finalstaticchecks.

Energy methodology review stops only its own rebuild for verifiedEmber
semantic unit correction: lifecycleGHG/allgases inCO2-equivalent, notCO2only.
Rawco2tags/numericvalues/sourcevintage retained; canonicalunits/notes updated.
Coordinator independently verifies official subnationalmethod pp5–7:
https://files.ember-energy.org/public-downloads/ember_subnational_data_methodology.pdf
State/national captive-generation coverage differs, Ladakh/J&K history is
combined untilJuly2021, and upstream historicalcapacity canbe interpolated.
These source boundaries must be explicit rather than fabricated reconciliation
or claims that everycapacitycell is directly observed. NationalPDF couldnot
be fetched by coordinatorwebtool; worker's direct verification is retained.

Farm229chart fresh320QA passes; remainingwidths rerun. DownloadedcropCSV
13rows matches exactkg values andJan–Jun2019period. OfficialReport587
Statement3.4/AppendixTable11 establishes coconutcounts versusothercropkg;
canonical/download unit evidence is being retained. Farmfullbuild stays
sequenced after Energy finalverification/distreclamation, even during
momentarilyfree slots for Energyfocusedchecks.

Farm finaldevelopment229chart fourwidthQA/family13tests/cacheinvalidation
pass; actual kg/coconut count/yield CSVs match source. Prosedryrunpasses.
ProjectedproductionHTML891,760bytes; actualstaticbudget stillpending.
Exactfamily registration/asof packet:
/tmp/atlas-farm-shared-registration-hunks.json. RegistryFarm33is correctly
atend; allregisteredheadline/spark preflight requested beforeheavybuild.
Fullbuild/productionQA remains sequenced after Energy.

Promoted generalheadline/spark regression into main;40checks pass for
current32guides. Rerun after Farm/Energyintegration. Independentlyverified
EmberJ&K/Ladakh sourceboundary must also be reflected in canonical histories,
not only prose: combined preboundary versusseparatepostboundary andannual
transition scope require explicit partition if notalreadycovered byseams.
Worker scope checkrequested; allrawcells/vintagepreserved.

Energy confirms priorJ&K/Ladakhboundary was caveat-only and nowpartitions
canonical scopes using independentraw firstnon-nullLadakhJuly2021:
monthlycombined beforeJuly2021/separateafter; annual2019–20combined,
2021mixedtransition(detail/downloadonly),2022onwardseparate. Affected
sourcecells only partitioned, noallocations/subtractions, rawstatecodes and
vintagesretained. Now73bundles/10,814nonemptyseries/164plates with unchanged
281,060source metriccells. Previous129plotQA superseded; source/layout/budget
preflights and completeproductionchecks remain. Currentallstate comparisons
must include currentaffected scopes rather than omitting those states.

Energy currentallstatecomparisons include separatedJ&K/Ladakh source-latest
rows plus unchangedotherstates, with canonicaladdresses. Annualtransition
remainsdetailonly. Payloadcompactencoding is intendedlossless; everyfield
roundtrip and decodedCSV/image/sourcelink checks requested. Reported
1,000,070characters is not yetUTF8bytebudgetproof; Buffer.byteLength and
actualstaticQC required. Source164plate preflight supersedes prior129checks.

## Latest verification checkpoint, 11 October

Energy's rebuilt static output passed: 1,528 pages, including all 164 energy
plates. The actual energy HTML is 1,003,577 UTF-8 bytes, below the 1,200,000-byte
budget. The new full gates are running against this artifact. Source validation
replayed 279,395 cells and checked 14,018 identities; final coverage, chart gates,
download replay and static browser verification remain pending. Earlier failed
build logs are superseded only by corresponding completed checks in the new run.

Farm remains at 83 bundles and 229 explained plates. Its development browser
checks passed at four widths, and its headline/registry preflight passed 41 tests.
Its full static build remains held until Energy finishes verification and removes
its own saved build output. Main integration will preserve the RBI work and the
Claude design changes by applying only the families' named shared blocks.

The main preview still serves the earlier combined build. The newer citation,
annotation and RBI source changes require a fresh combined build and browser
verification after Farm and Energy integration.

Energy final full gates now pass against the rebuilt artifact: 45 coverage
ledgers, 804 as-of blocks, rendered values and all 10,814 canonical series,
plus 1,195 SVGs across 90 pages clean in desktop chart lint. Strict coverage,
73-bundle download replay and actual four-width static browser checks remain
pending. An explicit 390-pixel chart-lint run was requested as well, because
the isolated worktree gates command does not include main’s mobile lint step.

Energy strict coverage is clean for all 45 ledgers. Its served downloads
replay all 73 bundles and 10,814 nonempty series exactly, including 276,442
nonnull canonical cells and 8,184 null cells. Final static browser QA has
started. Main’s width-aware linter will be run from a temporary isolated
copy on the energy page at 390 pixels; the inherited linter’s ignored width
argument will not be presented as mobile proof.

Energy's final static browser checks passed at all four widths, including all
164 plates and UI downloads. A separate forced 354-pixel geometry check using
main's linter flagged eight long state labels under its conservative glyph-width
estimate. Chrome's actual text bounds were clean. The worker is nevertheless
aligning the general wrapping estimate with the stricter geometry check, without
exemptions. That render change requires a fresh build and verification. The
packet remains unready; Farm's full-build hold remains in force.

Correction after full log inspection: the stricter forced-phone check found
13 long-label bleeds in the same wrapping class, rather than the eight visible
in the initial log tail. The same conservative wrapping change addresses the
class. The worker is saving the failed check and clean preflight separately;
readiness still requires rebuilt static output and completed verification.

Energy's revised wrapping passes preflight for all 164 plots under both the
strict desktop check and main's forced phone-width geometry check. The worker
saved prior artifact evidence and reclaimed only its superseded dist
(2,059,840,222 measured file bytes). Its exclusive full build and verification restarted,
now including the genuine mobile check before final downloads and browser QA.
Farm's hold remains unchanged until the new artifact completes verification.

Energy final CSV review found an observation-date defect: a state comparison
row correctly labelled 2020 and using its canonical 2020 value exported the
plate's 2024 date. Prior UI assertions reused the model fallback and therefore
did not detect it. The worker is retaining canonical observation dates for all
comparison rows and deriving download expectations independently from source
bundles and series. Values and membership remain unchanged. The superseded
build must be stopped or discarded; source-date preflight and a fresh artifact
are required before readiness. Farm remains held.

Source-date correction from the exact canonical cell: the affected Dadra
coal observation is 2021-01-01, rather than the initial 2020 reading from
truncated output. Its old CSV date was 2024. All comparison rows now retain
source ISO dates; editorial facts include dated observations, and trace tests
require exact bundle/series/date/value equality. The obsolete verification
chain was stopped. Seventeen focused tests, compiled geometry preflight and
independent decoded UI-date checks precede the next full artifact build.

Energy's complete source-date audit passes all 4,947 chart rows; 58 comparison
rows end before the plate reference period and retain their own source dates.
The coordinator independently checked every row's bundle, series, date, value
and unit against canonical cells. Focused tests (17), prose dry, strict desktop
and forced phone geometry preflight, and four-width development browser checks
pass. UTF-8 preflight is 1,035,964 bytes. Full static build, gates and exact
artifact checks restart after only the worker's superseded output is removed.

The source-date-corrected Energy static build passes: 1,528 pages in 431.42
seconds. Actual energy HTML is 1,036,397 UTF-8 bytes. Full gates pass, including
source replay, coverage, as-of, rendered QC and desktop geometry across 1,195
SVGs on 90 pages. The copied main linter with enforced 354-pixel container and
390-pixel viewport also passes all 164 charts against this actual final dist.
Strict coverage, canonical downloads and final exact-static four-width browser
checks remain in progress. Integration-ready remains false until completion.

## Energy integrated; Farm build released

Energy's complete final artifact verification passed. The saved page SHA256 is
2984085d2a28ab4436c06a97822bd515f445e19115432ef3bd0646f7c9c3cccc.
All 73 JSON downloads are byte-identical to canonical bundles; every CSV cell
replays, including 276,442 numeric and 8,184 blank cells. Four-width static
browser checks cover all 164 plots and independently sourced CSV dates, values
and units, plus SVG/PNG and source controls. Only Energy's own dist was removed,
reclaiming 2,059,873,032 measured file bytes.

The coordinator copied 185 owned files with exact handoff SHA256 verification
and merged 13 marked shared blocks across 10 files, 164 as-of entries and the
fetch registration. Snapshot: /tmp/atlas-energy-integration-snapshot/manifest.json.
Shared RBI work, Claude design changes and general fixes are preserved. Central
Energy number 34 is in place; Farm number 33 must be inserted before it before
registry checks and the combined build. Syntax and whitespace checks pass;
focused integrated Energy tests are running. Main static output is still old.

Farm's exclusive build was explicitly released after Energy cleanup. Farm
verified over 5 GB free at start and stopped only its own development preview.
Its 83-bundle, 229-plate scope remains frozen pending final verification.

Automatic future Energy release detection/acquisition remains unfinished. The
integrated runbook documents deterministic archived-edition replay and separate
acquisition commands. Report chapters outside the implemented balance/history
scope remain inventoried rather than silently counted as complete.

## 12 October: recovery after laptop shutdown

Source files and integrated Energy/RBI work survived. Temporary logs, baseline
snapshots and handoffs under /tmp were cleared, so recovered packets and new
verification logs must now be saved persistently inside docs/status. Energy and
RBI workers are reconstructing read-only handoffs; AIDIS awaits final main QA.
Farm's saved dist has a complete-looking guide but no final search manifest,
so successful completion of its interrupted build cannot be assumed. Its worker
will save recovered evidence and repeat the required full verification chain.

The coordinator removed only the superseded main dist after recording its
file count, byte count and selected HTML hashes in
expansion-recovery-2026-10-12.json: 2,039,330,390 file bytes across 8,248 files.
Sources, archived raw data, edits and other projects were preserved. Farm owns
its remaining build output and will reclaim it after saving evidence. Builds
remain exclusive with ATLAS_BUILD_SLOTS=1.

Energy recovery metadata is now copied into main docs/status. The coordinator
recomputed all 185 integrated file hashes against the recovered frozen packet:
185 match, zero missing or changed files. Lost dirty-baseline snapshots and
/tmp logs are explicitly marked unavailable; the saved final artifact evidence
remains preserved and is not presented as a newly executed check.

Recovered RBI handoff and surviving share-image evidence are copied into main
docs/status. Source files and the SPF ownership fix match the worker packet;
shared file differences are expected from later Energy integration. Production
RBI QA still waits for the final combined artifact.

The coordinator fixed the previously observed small-multiple scaling class:
Payments/Trade panels use their CSS grid track width, endpoint year labels
reserve horizontal room, and compact category panels can opt into complete
phone labels. Eight focused plot tests pass. A controlled actual-browser fixture
passes four widths, preserving all 76 observations in every test history, with
no tiny or clipped text. This is preflight evidence; actual guide verification
will run against the final combined build.

The final combined verification commands and generic Chrome audit are now
persistent, under docs/status/expansion-verification and scripts/atlas-browser-audit.mjs.
The browser audit requires each served guide HTML to equal the local dist
artifact before measuring real text bounds and font size at four widths. Family
source/export checks supplement it. These checks are prepared, not yet run on
the combined site. Farm's fresh build is completing its search-index hook.

Farm's recovery build completed successfully: 2,026 pages in 638.67 seconds,
including 1,650,758 indexed series and the final search hook. Its full gates,
strict coverage, bounded whole suite and actual static QA remain in progress.
Current available disk is about 11 GB after removal of superseded generated
outputs. Shared caches used by other active work were left intact.

The prepared combined Chrome audit covers all guides and all 36 state profiles
at four widths. The final chain runs the whole suite with concurrency two before
OG/build/gates, with source/prose dry verification afterward. It has not started:
Farm must first pass verification and be integrated ahead of Energy in the
registry. No commits, pushes, branch merges or deployments are authorized.

Farm's full source replay passed, but the generic nonzero wage-rate predicate
misclassified pension/remittance components of household-normalized income.
The coordinator inspected the actual canonical cells: 1,486 zero pension/
remittance series across six income bundles are source-native estimates under
'Avg. Monthly Income ... Per Agricultural Hh'. A general semantic correction
will use this explicit income denominator, while retaining checks for genuine
per-person/worker/employee rates. No cells, vintages or render inputs change.
Regression evidence and the exact shared change will be reviewed centrally.

The exact semantic correction is now applied centrally. Both generic regressions
pass: household-normalized component amounts and transfer-only pension/remittance
income are excluded from wage-rate zero checks; true per-worker/day earnings and
per-employee monthly emoluments remain checked. Farm's actual-cell regression
covers 42,336 cells across six bundles. The old helper is saved persistently in
expansion-verification/measure-semantics-before-farm-fix.mjs. Source values and
render artifacts are unchanged; Farm's final gates are rerunning.

Farm final full gates pass: 501,008 source cells replayed, 24,741 identities,
45 coverage ledgers clean (1,958 Farm items shown and 499,050 baked), 869
as-of blocks, full rendered QC and 1,260 SVGs across 90 pages clean. Strict
coverage, the whole suite with two workers, prose dry and final actual static
browser/download checks remain sequential and unfinished. Main integration
waits for the final ready handoff and worker-owned dist cleanup.

Farm provenance audit confirms 78 API vintages were archive captures, whereas
five report bundles carry the documented edition date. The shared contract now
requires explicitly declared unknown revision dates rather than borrowing either
date. Strict helper regressions (2) pass, including rejection of undeclared null,
invalid/future dates and contradictory dated-unknown status. Shared source tables
and citations expose unknown or mixed provenance; headers support an explicit
report-edition stamp. Owned survey metadata/model changes are in progress. The
old-vintage Farm build/tests/plot/source proofs remain saved; corrected metadata
and final static output will be verified in the combined main build.

Farm's pre-provenance-correction whole suite passed 140 tests, strict coverage
passed 45 ledgers, prose dry passed and the fresh static download/unit audit
passed. These results belong to the old metadata artifact and are preserved as
such. Corrected metadata will have focused source/numeric equivalence tests;
its final rendered labels, downloads, gates and browser checks will be verified
in the combined main artifact rather than repeating an isolated heavy build.
Shared Every Cut headers now expose explicitly unknown vintages; cross-sectional
views describe estimates/downloads rather than claiming annual changes/trends.

AIDIS corrected all 22 API vintages to explicitly unknown; its PIB release
bundle remains dated. Saved before/after hashes confirm unchanged raw bytes,
observation dates, series and numerical facts. Central AIDIS provenance/header
checks pass 14 focused tests. Household header now derives the known report
edition separately, while its vintage label and citation expose the unknown
API revision date. Shared Vintage/Semantics checks pass four tests.

The family renderers explicitly opt out of the shared automatic phone layout:
already-authored compact geometry must not be redrafted at 600–680 pixels.
A controlled medium-width regression verifies no duplicate category labels and
unchanged source observations. Final actual combined browser checks remain
required. Energy's numerical/source packet is unchanged; its renderer received
only this explicit layout opt-out.

Farm is merged centrally: 125 owned files match the corrected handoff SHA256s;
10 shared files received only its registrations, units, 229 as-of entries and
OG callback. The OG footnote period is derived from the canonical season. The
old shared files are saved under expansion-verification/farm-integration-snapshot.
Farm33 precedes Energy34. Corrected static verification remains pending main.

Combined registry/headline preflight passes 42 checks. The old registry test
assumed every source had a dated vintage and tried to format null before even
checking whether a manual date was printed. It now tests such dates only when
present and rejects hand-typed dates without a known source date. Full dated
source checks remain intact. The bounded whole suite and subsequent OG/build/
gates/strict coverage/prose-dry chain have restarted under the exclusive slot.

The first combined whole suite completed: 179 passed, two failed. One profiles
process hit the default heap ceiling; it was retaining a second full canonical
cache beside Every Cut's cache. Profiles now reuse the existing canonical
loader, preserving all rows and state cuts. A focused profile replay is running.
The other failure exposes technical audit paths in all 26 RBI reader-facing
coverage captions. The RBI owner is correcting the canonicalizer's public
caption while retaining full notes/lineage and proving unchanged observations.
The complete failed suite log is retained as tests-before-memory-reader-fixes.log.
`npm test` now defaults to two workers so later runs retain the bounded policy.

Both combined test failures are resolved: six profile checks pass with the shared
canonical cache (including all state ranks/periods/seams), and thirteen RBI plus
reader-text checks pass. RBI correction changes only public coverage captions;
complete objects excluding that field, all dates/series/units/lineage/vintages,
and twelve raw archives are unchanged. Original files are saved in the guarded
rbi-coverage-snapshot. The original whole suite passed 179 checks; targeted
reruns cover both changed modules. This is not claimed as a fresh green whole
suite. Exact evidence is recorded in expansion-verification/test-resolution.json.
The OG/build/full-gates/strict-coverage/prose-dry chain now runs exclusively.

Further incoming-vintage audit found direct capture-date reuse in 49 Ember
bundles and 26 official RBI listed-company bundles, and unsupported revision
dates in 12 MoSPI API Energy bundles. Energy's three older report bundles use
a foreword date, not an evidenced publication day; the official PIB announcement
only says the publication has been released. Nine Energy2026 workbook bundles
have archived publisher-listing publication dates. Owners are preparing strict
unknown declarations/capture provenance and byte/series-equivalence proofs.
The current main build independently stopped at RSS, which assumed a known
vintage. RSS now uses known source release/report edition dates or omits pubDate
when none exists; it never substitutes capture dates. No completed main artifact
or full gates are claimed yet. Current partial output is superseded.

Incoming vintage correction is being extended to Energy and official RBI.
Energy audit: 64 bundles lack an evidenced source revision/publication day
(49 Ember capture dates, 12 API dates and three foreword-dated report extracts);
nine 2026 workbook bundles have archived publisher-listing publication dates.
RBI's 26 vintages are source retrieval dates; provider update timestamps reflect
client-triggered export refresh, not economic revisions. No dates are inferred.

The shared raw writer now avoids capture-only revision churn and preserves
multiple distinct bodies sharing one unknown/dated snapshot key using content
hash archive names. Six regression tests pass; repository raw archives were
not rewritten. The current primary Energy facts filename also held an unused
retired-source canary. It will be preserved as audit evidence and replaced by
the authoritative current facts sheet, with trusted per-guide facts entrypoints.

Energy's guarded correction is merged: 96 explicitly listed files, 64 unknown
source-vintage declarations and nine evidenced 2026 publication-edition dates.
All 73 date/series/unit/value vectors and 24 raw archives remain unchanged.
Captures are kept only where evidenced; monthly precise capture is unknown.
The retired active facts canary is preserved in audit evidence; both current
Energy facts outputs now contain identical authoritative model/provenance data.

RBI's 26 incoming vintages are explicitly unknown, with aggregate capture dates
and unchanged exact per-cell lineage. Guarded adapter/test/census/canonical files
are merged; all other metadata and whole series/date bodies are identical.
Snapshot: expansion-verification/incoming-vintage-snapshot/manifest.json.
Focused incoming provenance/raw tests and trusted per-guide facts entrypoints
are being checked before the next complete main build. No source fetches or raw
rewrites occurred. The failed/superseded partial dist was inventoried and removed,
reclaiming 2,544,183,774 file bytes; about 13 GB is available.

Incoming provenance checks pass centrally: 38 tests covering Energy, RBI,
explicit unknown dates, raw archive behavior and complete source equivalence.
Trusted native facts entrypoints for AIDIS/Farm/Energy execute successfully.
RSS regression passes all 34 guide items, using the documented 2021 survey
report edition instead of capture dates. Fresh bounded whole-suite→OG→build→
full-gates→strict-coverage→prose-dry chain is running after all corrections.
No source code/metadata edits are planned during this frozen verification run.

Fresh combined test run passed all 199 active checks. Three additional failures
were accidental discovery of backup *.test.mjs files under audit snapshots,
whose relative imports naturally have no copied dependency tree. `npm test` now
runs only the canonical test/*.test.mjs set with two workers. Backup evidence is
preserved; it is not executable test input. The failed-discovery log is retained
as tests-before-discovery-fix.log. The corrected test command and full chain are
running again before the build; no source/data changes accompany this fix.

Visual inspection of the integrated Farm OG exposed an existing generic caption
cutoff: the left caption ended at 'July 2018–June', dropping the final year. The
shared OG generator now retains all wrapped caption lines instead of slicing
at four. The source-backed top period and both income values were already
correct. Regenerated cards will be visually checked again; no source values or
facts are changed by this typography correction.

Fresh canonical whole suite passes: 199 tests, zero failures, concurrency two,
400.67 seconds. This supersedes the prior partial/failed suite summaries. The
exclusive chain now proceeds through OG, the corrected combined build and full
rendered/source gates. Final browser and served-download checks remain pending.

Corrected combined main build passes: 2,047 pages in 597.53 seconds; search
indexes 1,661,635 series, 1,076 plates and 2,578 files, with no frequent words
missing postings. Fresh source/render gates are running against this completed
artifact. Main preview is being started on the reserved local port 4332 for
exact-artifact browser and family source/export verification. No deployment.

### 12 October: follow-up presentation verification

The combined 2,047-page build and 199-test suite completed. Desktop chart lint was clean; the phone gate failed and remains a release blocker. The previous build is preserved as pre-follow-up evidence. Real Chrome audit covered 280 guide/state viewport combinations, finding 940 clipped text instances, no undersized text, and one CPI document overflow. Family audits separately verified Farm/Energy/RBI source cells and downloads against that exact artifact.

Root has applied aggregate guide citation dates, the EveryCut plural interpolation correction, a responsive CPI basket key, axis-room adjustments, and stacked export metadata on intrinsic chart widths below 640px. Twelve focused presentation tests pass. The updated axis-room fixture passes real Chrome at 320,390,545,1440px with all 76 observations and full unit descriptions retained. Export metadata has been visually inspected in a controlled SVG fixture; final production download checks remain pending.

The chart checker previously concatenated multiline tspans into a single width. Its boxes now measure the longest rendered line and actual multiline vertical extent. Rerunning that corrected checker against the old build exposes additional annotation/stroke collisions; these are not waived. A lightweight source-client render preflight is being prepared before another full build. No publication, commit or push has occurred.

The approved RBI four-file follow-up was integrated with exact baseline SHA guards; 28 focused tests pass. It compacts large monetary axis ticks to explicitly labelled lakh crore while retaining canonical/CSV crore values, and derives the Markets provenance summary from all guide inputs. Both server footer fields now show that summary. No canonical/raw files changed in this follow-up.

The corrected source-client phone preflight is clean across 1,456 SVGs. It inherits the previous built HTML/styles and is not final production evidence. Dense compact layouts with unresolved annotations now retain the original readable scrolling canvas and expose a diagnostic, consistent with DESIGN's phone scrolling contract. A meaningful regression verifies all observations, domains and full annotation text survive that fallback. The fresh full test run completed 203/203; the subsequently merged two RBI tests also pass in the 28-test targeted run. A final frozen-source full suite/build/gates/browser run is still required. Current disk headroom is about 8.6 GB before replacing the previous 3.3 GB generated build.

Both corrected desktop and phone source-client geometry preflights pass. Forty browser checks over ten selected guides found only one remaining issue: an explicit Credit small-multiple tick of 60 was generated beyond its upper domain of 50 by a rounded tick count. The count now floors the interval, preserving the domain and every observation. A focused four-width recheck is running before replacement of the previous generated build. CSS font-size precedence was also corrected in measurement: the charts used 12px CSS over Plot's 10px SVG presentation attribute.

Final frozen-source suite passed 205/205 in 406.9 seconds. The superseded generated main build was then removed with a recorded path guard and file/byte count, while pre-follow-up logs and all source/download evidence remained. Fresh production build is now running under the single-build slot. Gates, strict coverage, prose dry run and the exact-artifact browser audit follow automatically; no readiness claim is made before they pass.

Fresh four-guide HTML integrity confirmed while the overall build finished its remaining routes: households09b3f80b62050db8eeef9dae8cb4ad6553de83a3475c3f15bd9aa5b1fc12dd0d; farm-households3b6bd857fdc7217249e29d2c1be9939887bff829027867d8fbd1a1ef32444b2b; energyb2166a5f0fd5c131379587c92b047f75b331b21a1643b15ded7e9e4366c52779; markets5f0935b7927d553d740a7b6aefd3ae8d86e7bd2f0e79e4211a665dcd14d35e19. Each served response is byte-identical to main dist, with all chart JS assets returning200. All four existing worker chats were explicitly resumed for final read-only artifact QA; no additional builds or source edits authorized in those checks.

Fresh production gates stopped on one concrete QC expectation mismatch: Markets' corrected all-input mixed-vintage display was compared with the old primary household-flow date. The expected value now independently derives the summary from every guide input and checks both footer fields; the gate is not waived. Source/capture distinctions in the corrected display are retained.

Final household browser QA discovered two additional provenance defects despite correct numeric cells: unregistered multi-dimensional API bundles fell back to “All India” in the Cut descriptor, and the conditional-debt Source button used a hardcoded report URL. Three source files plus regressions were integrated with exact baseline SHA guards. Generic state/sector fallback now uses declared bundle schema, preserving explicit cut mappings and rules, and each household plate carries its canonical publisher URL. No raw/canonical data changed. Existing numeric/export receipts remain valid for their pinned artifact; a new build and post-fix provenance/browser checks are required before readiness.

The post-provenance chain is queued on build slot1 behind a live build in the separate atlas-worktrees/design-v4 checkout. Main source manifest comparison showed no external source changes. No other session was interrupted or cleaned. The latest complete main artifact remains pinned as pre-provenance; 30 focused regressions passed after the three provenance changes and QC expectation correction. Whole EveryCut regression, fresh build and required gates are scheduled in the persistent main-provenance-final.sh chain once the slot is available.

The whole EveryCut plus new provenance regression passed 11/11 in190.7seconds. All30targeted household/mobile/Markets checks had also passed. The second provenance-corrected production build is now running; old complete 205-test evidence and the fresh numeric/export family receipts are preserved with their exact prior artifact hashes. The next artifact must pass required gates including the updated all-source vintage expectation, then strict coverage, prose dry run and full browser audit.

The provenance-corrected build passed npm gates, strict47-ledger coverage and prose:dry. Its complete real-Chrome280-page/viewport audit found19remaining font-line-box/long-caption clips (zero tiny text/documentoverflow/runtime errors), concentrated in15state captions, NFHS top row names and one Services label. That failed audit is preserved; the build is not marked ready.

State comparison captions now wrap generically by the available width. Canvas containment includes row names and reserves the full font ascent/descent; stroke-collision geometry retains its ink bounds and halo treatment, avoiding false collisions in unpainted font padding. Sixteen relevant Plot/profile tests pass. Updated source-client desktop and390px geometry preflights are both clean at1456SVGs; real-browser source preflight shows the corrected phone cases clean. A final immutable production build/gates/strict/prose-dry/broad-browser chain is now running via main-font-room-final.sh, with previous evidence retained.

### 13 October: restart and final annotation placement correction

The laptop restart did not lose the completed 12 October build, gates, strict 47-ledger coverage or prose dry run. All 280 audited guide/state response hashes still match the saved dist artifact, and the frozen source manifest is unchanged. The final browser audit had one remaining failure: Services at 320 px, where the annotation placement pass moved a label into the font ascent outside the canvas. The placement boundary now reserves the same full font line box as initial canvas fitting; collision checks continue to use painted ink. Ten focused Plot tests pass and the fresh Services source-client audit passes all four widths. This preflight is diagnostic; another production build, required gates and full actual-artifact browser audit are necessary. Four family source/export receipts remain saved with exact old artifact hashes. No raw/canonical data, prose or family-specific rendering was changed by this correction.

### 13 October: completed combined verification

The final annotation placement correction is verified in the actual immutable production artifact. Build passed: 2, 047 pages in 632.53 seconds. Fresh npm run gates passed, including 47 coverage ledgers, rendered QC, 52/52 fresh prose slots, and desktop/390 px chart lint at 1, 456 SVGs across 91 pages. Real Chrome completed 280 checks: 34 guides plus 36 state profiles at 320, 390, 545, 1440 px. All 5, 756 chart instances have zero clipped or undersized text; no document overflow or runtime errors. Every audited HTML hash matches current dist. The final frozen src/scripts/pipeline/test manifest has no changed files. Ten focused tests pass for the final correction; the prior 205-test suite and later focused regression receipts are retained. Strict 47-ledger coverage and prose:dry passed on 12 October; final changes were limited to chart geometry, with normal coverage replayed in today's gates.

All four current family HTML files reconstruct their exact previous verified hashes after replacing only the entry-script URL. Embedded numbers, periods, reader prose, publisher URLs and provenance bytes therefore remain exact. Earlier family source/CSV/native export receipts are carried forward with that documented boundary; native exports were not rerun after this last placement-only correction. Fresh combined browser geometry passes for every family. See expansion-verification/completion-2026-10-13.json and final-placement-family-carry-forward.json for machine-readable completion evidence.

Removed only our superseded reproducible build and the 97, 922, 331-byte source-client preflight directory; retained production dist, all source/archives, logs, browser results and family receipts. The temporary preflight server was stopped. Disk remains tight at about 3.5 GB free. No other checkout or shared runtime cache was cleaned.

This completes recovery, integration and verification of the reviewed AIDIS, Farm households, Energy and official RBI Markets expansion with the reviewed Claude design changes. It does not claim complete DBIE/Data Bank coverage: 17 household report-only tables, other Energy report chapters and automated future-edition acquisition remain identified follow-on work. RBIhub freshness counts remain a dated 11 October metadata comparison. No commit, push, branch merge or deployment was performed.
