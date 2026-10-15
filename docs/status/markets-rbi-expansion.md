# RBI Markets expansion — recovered handoff, 12 October 2026

Implementation is integrated into main; combined production verification is pending.
Coordinator confirmed the 64 reviewed files and SPF ownership fix survived the
laptop shutdown. Source and family edits remain on hold. No commits, pushes,
deployment, new source queries, server or heavy build were run during recovery.

## Persistent handoff

[Handoff inventory and current SHA256 hashes](markets-rbi-handoff.json) records
all 64 integrated worker paths, shared-block ownership, source counts and evidence.
These are recovery-time hashes, not reconstructed pre-edit baseline hashes.
The original temporary baseline, handoff, test/build logs, phone screenshot and
browser-QA JSON were lost at shutdown. Their historical results below are retained
from the recorded status and coordinator confirmations; they were not rerun today.
Inherited Schools/AIDIS/assessment changes, Households ledger/source-quality and
initial census-markets.json remain outside this worker inventory. Main's subsequent
shared changes remain protected; differences in shared hashes are not instructions
to overwrite them.

## Surviving source and implementation evidence

The quality manifest contains 82,826 distinct CAS rows, 117,324 deduplicated
prompted rows from ten reports/thirty exports, 110 artifact-lineage records,
87,805 meaningful reconciled cells, 868 source-record quarantines and 11,377
meaningful overlaps with zero unresolved conflicts. The 26 listed bundles hold
3,296 series and 95,090 non-null observations, through Apr–Jun 2026 and FY2025–26.
Eleven compressed source archives remain in data/raw/markets-rbi*.

- [Internal quality and per-cell source evidence](../../data/coverage/markets-rbi.source-quality.json)
- [Public quality download](../../public/data/markets-rbi-source-quality.json)
- [Source semantics and ownership method](../reference/markets-rbi.md)
- [Five exact source comparisons, including population evidence](../reference/markets-rbi-source-checks.json)
- [Complete mirror and bounded semantic audit](../reference/markets-rbi-semantic-audit.json)
- [Final full family census](../../pipeline/out/census-markets-listed.json)
- [Parser, lineage, ambiguity, share and ownership regression tests](../../test/markets-rbi.test.mjs)

Ten duplicate annual margin keys reflect a CAS SUM of non-additive mirror rows.
Official reports resolve the newest two periods; eight historical selections stay
explicitly ambiguous in labels, notes and lineage. Two annual published sales-share
observations have different company populations from their available denominator
rows. Comparable series keep nulls while source values, counts and denominator rows
remain in quality/download evidence. They are noncomparable, not labelled corrupt,
and are never clamped.

32 new explained plates plus four existing listed plates expose major cuts;
EveryCut and whole-file downloads retain the other measures and history. The hub
emits listed canonical files only when markets-listed.product is markets-hub.
With the official adapter as owner, later SPF refreshes cannot overwrite them.

## Verification record

Read-only recovery check on 12 October: the family validator returned zero errors,
780 accounting identities and lineage for all 95,090 non-null observations. All 64
inventory files exist. Recovery hashes and retained chart-image hash are persisted
in the handoff JSON. No original baseline hashes or lost screenshots were invented.

Historical 11 October checks: ten tests passed, including real offline hub refresh
of six SPF files while all 26 official listed hashes and mirror raw bytes stayed
unchanged; explicit legacy ownership still emitted listed output. Coordinator also
reported ten tests passing in main after integration. Strict coverage passed all
45 ledgers; all twenty current-reading prose figures verified; Markets dry run and
672 freshness paragraphs passed. Offline replay reproduced all 26 canonical files
byte for byte. npm gates passed validation, coverage and as-of, then post-build QC
failed because this held worker build had no dist.

Historical dev QA checked all 36 listed charts at 320/390/545/1440 pixels with no
SVG text bleed. The shared 700px minimum was overridden only on listed plates.
The phone screenshot and browser-QA JSON are lost. The actual downloaded share
image survived and is now stored here:

![Retained 11 October chart export](markets-rbi-share-image.png)

## Remaining checks

Await the coordinator's combined main build after Farm verification. Final Markets
production QA must check all listed charts at the four widths, EveryCut interactions,
complete downloads, ambiguity/population notes and share exports. Production QC/chart
lint and the full shared prose dry run remain coordinator-owned final gates.
The scoped dev server on 4333 was stopped before shutdown. Do not recreate it or
change handed-off source bytes without a concrete defect and an exact proposed fix.

## Reader-facing coverage correction, 12 October

Coordinator authorized a metadata-only exception to the source freeze after the
combined reader-text suite found technical audit notes in all 26 table titles.
The owned adapter now describes annual/quarterly scope, company group and actual
measures in meta.coverage. Full audit text stays unchanged in meta.note and lineage.
Offline replay changed only meta.coverage across all 26 canonical files. Dates,
complete series (including values, units and lineage), every other metadata field
and data vintage 2026-10-10 are identical by SHA256 comparison. All twelve family
and mirror raw archives are byte-identical. No network, source fetch, heavy build
or main edits. This correction awaits central application.

- [Exact adapter and regression patch](markets-rbi-coverage.patch)
- [Before/after file, series, dates, vintage and raw-hash evidence](markets-rbi-coverage-change.json)
- [Eleven passing tests, including all 26 reader titles](markets-rbi-coverage-tests.log)

Example: “Quarterly results of listed non-government non-financial companies by
manufacturing, IT and other services: rupee totals for the companies reporting in
each period.” Coverage distinguishes common-company growth from changing-sample
rupee totals; audit filenames and implementation fields no longer become titles.

## Vintage audit awaiting review, 12 October

[Read-only audit and minimal proposal](markets-rbi-vintage-proposal.md) confirms
all 26 current vintage dates equal archive retrieval, while no held field establishes
publisher revision. Provider.updated and CAS is_revised were examined explicitly.
The [proposed adapter patch](markets-rbi-vintage-proposed.patch) is not applied.
Source code, raw archives and canonical bundles, including their present vintage,
remain unchanged until coordinator review. Strict unknown-vintage metadata was
checked against main's new shared contract; no network or build was run.

## Approved vintage correction applied in worker, 12 October

Coordinator approved the strict unknown state after reviewing the timestamp audit.
The owned adapter and all 26 canonical bundles now declare vintage:null,
vintageStatus:unknown and a substantive vintageNote. archiveCapturedDate is
2026-10-10, the latest aggregate capture date only. Per-date artifact lineage and
the eight inherited mirror selections are untouched. Existing raw files retain
their archival bytes; future archive wrappers separate capture from source vintage.

- [Exact applied adapter and test patch](markets-rbi-vintage-applied.patch)
- [Before/after hashes and full series/date equivalence](markets-rbi-vintage-change.json)
- [Offline replay log](markets-rbi-vintage-replay.log)
- [Thirteen passing tests](markets-rbi-vintage-tests.log)
- [Twenty verified prose figures](markets-rbi-vintage-prose-verify.log)

All 26 files changed only in vintage metadata. Complete series JSON, dates, units,
values, lineage and every other canonical metadata field are SHA-identical. All
twelve source/mirror archives are byte-identical. The owned census was regenerated
with null vintages; Markets facts regenerated byte-identically because their primary
headline belongs to the other-owned household table and listed inputs do not
serialize vintage. The central vintage helper was copied unchanged solely for
focused checks, and need not be merged back. No main edits, network, source fetch
or heavy build. This applied correction is ready for central integration; final
production QA remains pending the combined main build.

## Production QA and owned presentation fixes, 12 October

Main's 2,047-page production output was audited read-only on 4332. Served Markets
and four EveryCut pages equal main dist by SHA. All 36 chart full names/values and
32 new periods match canonical sources. All 52 JSON/CSV routes equal dist, every
CSV cell/date/label/null matches canonical, eight historical ambiguity flags and
two noncomparable-share omissions survive. EveryCut's four pages hold all 3,296
series; search/filter/sort/pagination and source/download/copy-link controls work.
At 390/545/1440 all Listed SVG text geometry is clear. At 320 one large-money axis
collided. Shared citation/template/export defects were reported to coordinator.
Pre-fix evidence is in main docs/status/expansion-verification/markets-final.

The approved owned plot fix compacts large monetary ticks into explicitly labelled
₹ lakh crore while domain/values/CSV remain crore. Footer summary now uses every
guide input bundle. No main edits or data/raw changes.
[Exact patch](markets-rbi-production-fix.patch),
[baseline/current hashes](markets-rbi-production-fix.json),
[15 passing tests](markets-rbi-production-fix-tests.log) and
[independent 265px preview](markets-rbi-money-axis-320-fixed.png) are durable.
Central application and fresh final production verification remain required.
