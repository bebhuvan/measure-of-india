# Indicator explorer status — 13 October 2026

## Current state

The implemented explorer passes accepted-artifact verification. The corrected
integrated build, full gates, all 245 tests, asset limits and source-freeze check
completed successfully. Production preview HTML and search core match the built
files by SHA256. Final quality version is `e7b6dd953100c2bd105450cb`.
Broader guide/search QA is now complete; source remains frozen for parent handoff.
No commit, push, deployment or DNS change was made.

Two failed acceptance attempts remain in the record. The first exposed an SSR
helper path error after Astro relocated the module; project-root paths and an
actual relocated SSR regression test fixed it. The second completed the build
but QC exhausted its 6 GiB heap. Performance repaired verification-only DOM
lifecycle and anchor-cache retention, then reran full gates at the same heap
limit against the unchanged artifact. No checks were skipped.

Accepted chain: `docs/status/launch-performance/integrated-gates-qc-lifecycle-repair.log`.
Artifact identity: `docs/status/launch-performance/preview-artifact-check.json`.
Earlier build/failure: `docs/status/launch-performance/integrated-final-build-gates-attempt2.log`.

## Delivered behaviour

`/explore/` resolves stable bundle/row-anchor identities, renders full source
history or survey snapshots, retains nulls and estimates, provides date controls,
a paginated underlying table, copy links and exact selected CSV/JSON plus SVG/PNG
exports. Four curated static landing pages have complete no-JavaScript tables.
The long tail uses the shared explorer. Guide and EveryCut links preserve context;
search integration is owned by the performance task.

Comparisons allow up to four same-instrument CPI components or explicitly
compatible state/sector cuts with the measure and other dimensions fixed. The
model checks units, instrument, frequency, base, calendar and snapshot reference
period. No conversion, aggregation, interpolation or instrument splicing occurs.
Exported comparison charts include full names and line-style samples.

Exact indicator lookup fetches one deterministic manifest bucket and one hashed
shard. Shards are capped at 256 KiB; manifest buckets at 1 MiB. The client checks
schema, instrument, content hashes and compiled quality version; caches are
bounded and navigations can be cancelled. Small records share instrument-separated
pooled shards. The whole published artifact must have at most 16,000 files.
These are first-party static reader assets, not live government requests.

## Coverage and source interpretation

The settled source contains 2,578 bundles, 1,661,635 retained series identities
and 14,852,313 canonical value slots. There are 1,005,214 series with at most one
non-null observation; a catalogue record does not imply a useful time series.
The latest diagnostic census has 1,606,224 numeric-eligible records, 55,411 pending
interpretation and 839,584 comparison-eligible records. Final build verification reproduced these counts.

The quality registry retains original records and archive access while withholding
numeric charts, comparisons and interpreted exports for pending mappings. Specific
housing mislabels, sewage unit uncertainty and slum dimension/unit failures have
distinct reasons. Unreviewed generic profile mappings and unknown or mixed scales
remain pending; this does not assert that all are corrupt. Seventy-four named
digital survey records have source/report evidence and raw/canonical drift-bound
opt-ins. Positive reviews cannot silently survive measurement, unit or raw drift.

For all 331 generic profile bundles, canonical metadata now distinguishes unknown
data revision from archive capture. The performance owner verified all 54,659
series/date/unit/label objects and 331 raw files unchanged. Source-quality receipts
and exposure accounting are under `docs/status/source-quality/`. Public JSON keeps
canonical metadata separately from effective public revision/reference metadata.

The accepted pack generated 4,582 active explorer assets in 71 seconds with
353,730,560 bytes maximum RSS. Maximum shard is 262,143 bytes and maximum
manifest 541,996 bytes. `explorer-build-verification.json` proves exact coverage,
canonical output/quality parity and 15,229 whole-site files within the 16,000
project budget. The existing baseline had 10,614 files and 3,435,302,298 bytes;
the accepted integrated artifact has 15,229 files and 4,608,705,412 bytes.
This adds about 1.17 GB to the whole artifact, including explorer and concurrent
search/build changes; it is not an isolated explorer-only storage difference.
Initial per-bundle packaging needed 8,446 explorer files. Deterministic bucket
manifests and pooled small shards reduced that to 4,582 while retaining coverage.
Explorer shard bytes are 1,022,161,493 and manifest bytes 11,410,121.

## Verification completed

Twenty focused model/quality tests pass, including stable identities, exact
null-preserving CSV/JSON, comparison seams, snapshot periods, deterministic UTF-8
packing, cancellation/retry, bounded caches, hash/version failures, evidence-bound
reviews and real relocated SSR execution. The earlier EveryCut suite exercised
all retained catalogue records. Performance's combined lifecycle/search/profile
suite and prose dry run also passed; no model calls were made.

Actual Chrome fixture checks passed at 320, 390, 545 and 1440 px:

- 328 numeric geometry cases covering 153 eligible unit classes and 158 selected
  source series; zero SVG text clips or document overflow, exact JSON values/axes.
- 20 source-quality cases covering pending reasons and reviewed digital snapshots,
  with revision/capture distinctions and original canonical metadata.
- 16 history, snapshot and two/four-series comparison cases, exact CSV/JSON,
  labelled SVG/PNG, keyboard/search navigation, date URL replay, mismatched-seam
  rejection and no-JavaScript landing/hydration.

Fixture timing is not production performance evidence. Fixture port 4333 is
stopped and its owned public symlink removed. Screenshots and machine-readable
receipts are preserved under `docs/status/indicator-explorer-fixture/` and the
explorer evidence files.

## Accepted production browser evidence

Actual Chrome 151.0.7922.137 on the SHA-matched port-4332 build passed:

- `explorer-browser-built.json`: 16 history/snapshot/two- and four-series cases
  across 320/390/545/1440, exact CSV/JSON, SVG/PNG, keyboard navigation, date
  filtering, seam rejection and complete no-JavaScript curated landing.
- `explorer-quality-browser-built.json`: 20 reviewed/pending cases across the
  same widths, including unknown revision versus capture and original metadata.
- `explorer-axis-browser-built.json`: all 328 numeric cases covering 153 eligible
  unit classes and 158 selected series, exact source JSON, no clips/overflow.
- `explorer-entrypoints-built.json`: home search and guide EveryCut at 390/1440,
  exact identity and exported source values/date axes, no page errors/overflow.

The ad-hoc entrypoint harness initially asserted a nonexistent JSON `values`
field. It was corrected to the documented `observations[].value/date`; the
corrected replay passes without any product source change. The receipt records
this test-only correction.

## Measured delivery and limits

`explorer-performance-built.json` preserves all 36 serial loads; the compact
`explorer-performance-summary-built.json` reports three samples per group,
medians and maxima. Independent cold contexts and warm reloads use current CPI,
a survey snapshot and the complete 21,465-point daily policy-rate history.
Mobile uses 4× CPU throttling, 150 ms latency and 1.6 Mbps down/750 Kbps up.

Desktop median chart-ready time is 231–348 ms cold and 125–248 ms warm. Mobile
medians are 2.92–3.70 seconds cold and 1.13–1.66 seconds warm. Every exact view
has two data requests, no page errors and no overflow. Actual cold data transfer
is 80,069–117,238 bytes (observed compression), with 436,959–787,446 decoded
bytes. Total cold page transfer is 373,804–410,973 bytes; warm data transfer is
600 bytes and total transfer 3,300 bytes, including revalidation overhead.

The longest full history peaks at 30,671,596 bytes used JS heap in these cases.
Its largest mobile long task is 799 ms cold/594 ms warm. Maximum observed CLS is
0.007765. Pooled data trades extra decoded bytes for static asset-count headroom;
large histories still have visible main-thread work. These are local preview
lab samples, not deployed field CWV or statistically reliable tail percentiles.
No before/after speed claim is made for the new explorer, which had no prior
individual-series reader. Existing guide/search baseline comparison belongs to
the performance owner's separate receipts.

Long-tail pages require JavaScript; four curated landings retain no-JavaScript
source tables. Comparisons are limited to observed compatible cuts with no
transformations and a four-series cap. The 55,411 pending mappings remain
source-accessible but have no interpreted numeric chart/export/compare. None of
these exclusions removes canonical records from coverage.

One generic-query relevance limitation remains: the first individual result for
“food inflation” is an older Assam agricultural/rural-labour price series rather
than national current CPI food. It navigates and exports correctly and clearly
names its instrument. This finding was handed to the performance/search owner
for relevance judgment; it is not a reason to remove the underlying catalogue.

## Handoff

Explorer functional, source-quality, geometry, entrypoint and timing phases are
complete; all owned Chrome processes are closed and the browser phase was
explicitly released to performance. Final receipts and status were sent to the
coordinator and performance sibling. Wider guide/search performance review and
human publication remain separate. Source/raw archives were preserved, fixture
port 4333 stopped and its owned public symlink removed. No deployment, commit,
push or infrastructure change occurred.

## Integrated performance packet received

The performance owner completed `docs/status/launch-performance/final-acceptance.json`
and `final-dist-manifest.json` against the same 15,229-file artifact and quality
version. It records 280 actual guide/state Chrome cases, 108 page observations,
108 search observations within budgets, six search UI and two home-quality cases,
18 exports identical to baseline SHA256, 17 local Workers cases, three redirects,
a successful dry run and five browser-readiness regression tests. All owned
browser/Workers/timing processes ended. Verification-only source changes are
listed separately from the unchanged render inputs.

Readiness remains qualified: generic-query precision limits affect food inflation,
urban female unemployment, wage pay duration and listed-company growth versus
levels. A largest EveryCut cold-load CLS of 0.130618 is documented; warm CLS was
zero and the cold shift was diagnosed in three loads. Full chart completion is
not instantaneous. This packet does not establish field CWV, complete source
semantic certification, live hosting/account/zone verification or deployment.
Source freeze remains in place pending coordinator handoff.
