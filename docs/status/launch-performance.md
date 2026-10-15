# Launch performance: 13 October 2026

Implemented and locally verified. Production cutover remains pending. Search reliability
and chart responsiveness improved, with full coverage retained. This is a qualified
readiness verdict: broad-query first-result precision and the largest Every Cut view's
cold layout shift remain limitations. No commit, push, deployment, DNS change, provider
retirement or model API call was performed.

## Accepted artifact and correctness

The fresh build produced 2,052 pages in 716 seconds. Its 15,229 files total
4,608,705,412 bytes; the largest remains the 16,931,967-byte Madhya Pradesh CSV.
`launch-performance/final-dist-manifest.json` records every path, size and SHA256;
manifest SHA256 is `29ee80576278f4fe2dd94d124759f7f2b00669d436a66386da6d46e2c4b61f10`.
The original baseline had 10,614 files and 3,435,302,298 bytes; growth includes the full
explorer, not reduced history. Both inventories fit their checked deployment budgets.

- Full `npm run gates` passed against the fresh build, followed by all 245 suite tests,
  asset size/content-hash checks and unchanged frozen inputs. Evidence:
  `launch-performance/integrated-gates-qc-lifecycle-repair.log`.
- Numerical QC traced 407 sampled search rows across all 34 guides to their exact row
  anchors, 10 state/topic queries and six state-name spellings. All 15,550 profile figures
  were reread from canonical bundles and dated; all 52 prose slots matched current prints.
- Desktop and 390px geometry gates checked 1,456 SVGs across 91 pages without collisions,
  overlaps, bleeds, clips or centred labels. Actual Chrome then passed all 280 guide/state
  cases at 320/390/545/1440px: complete authored chart zones, no page overflow, clipping,
  undersized chart text or browser errors. `guide-state-browser-final.json` records exact
  served HTML hashes against disk.
- Explorer independently passed 16 functional, 20 quality, 328 geometry and four
  home/Every Cut entry-point cases. Full packaging verification matched all 1,661,635
  canonical records and 14,852,313 observations. See `indicator-explorer.md` and its
  `explorer-*-built.json` receipts.
- Eighteen final browser-generated SVG/PNG/CSV downloads, from first/last plates in
  Farm Households, Households and Energy, exactly matched original baseline hashes.
  `exports-final.json` and `exports-final-parity.json` retain signatures and proof.

## Changes and measured result

Width reads are batched before chart writes in the three largest chart clients.
`queueCharts` renders every authored item cooperatively, retains independent jobs and
reports failures. Its 45ms scheduling target does not bound one expensive chart.
Beforeprint drains pending charts idempotently; gates and browser checks require full
completion. No chart or historical observation was dropped to improve these measurements.

Three-repeat Chrome mobile cold medians, at 4x CPU throttling, 150ms latency and
1.6Mbps down/750Kbps up:

- Farm Households first chart availability: 27.55s to 3.94s. Longest-task median:
  24.73s to 659ms. Final full-ready capture was 11.93s.
- Households: 11.18s to 3.32s; longest-task median 8.50s to 442ms; ready capture 7.60s.
- Energy: 19.54s to 3.76s; longest-task median 16.63s to 510ms; ready capture 11.09s.

These improve chart availability and main-thread blocking; hero LCP was already around
1.2–1.7s and changed little. Remaining half-second tasks are material. Ready capture is
an upper bound taken after load/all charts, including wait overhead; it is not exact last
paint. The first-chart observer measures availability, not field INP or paint.

Final page proof comprises 54 cold and 54 warm observations, three per route/device,
covering home, guide index, the largest guides, CPI, Karnataka and the largest Every Cut
view. Warm runs first completed an unrecorded full load in the same context. Reports:
`browser-final.json`, `browser-supplement-final.json`, `browser-warm-final.json` and
`page-final-summary.json`. Actual gzip transfer is recorded; preview is not uncompressed.
The original CPI cases that captured too early are retained and replaced for comparison
by explicit-load baseline supplement cases. These are local lab results, not field p75 CWV.

## Search: speed, reliability and relevance

Independent token/row requests overlap. Promise LRUs are bounded to 24 token and 48 row
files, failed promises are evicted, and cancellation invalidates old queries on clear,
Escape, blur or replacement. Core failures retry visibly. A conservative one-edit spelling
suggestion requires explicit selection; valid queries are never silently rewritten.
Content-hashed row/token filenames and quality-version checks prevent mixed-release rows
or policies from being accepted. Stable identity v1 is canonical bundle plus row anchor;
numeric row IDs remain release-local. Individual results open exact explorer records.
Matched guide navigation remains usable while remaining row chunks load.

Quantity intent is applied before the six-row-chunk selection budget. Explicit
share/count/index/growth intent takes precedence over money intent; ambiguous regular
wage-worker wording stays ambiguous. Actual `rural wages` results now show wage amounts
where the original led with worker shares. This fixes quantity confusion, not every
period, geography, denominator or instrument preference.

The final core is 353KB gzipped against a 500KB budget. It retains all 1,661,635 records,
99 token shards and 3,056 row chunks; no frequent-word postings were dropped.
All 108 final search observations passed three-repeat absolute/regression budgets:
mobile cold <=7.5s, warm <=2.5s; desktop cold <=1.8s, warm <=1s, plus the 30% +250ms
regression boundary. Every warm repeat made zero search-data requests. Mobile cold
complete-result medians were:

- Urban female unemployment: 6.21s to 5.52s.
- Food inflation: 5.96s to 5.28s.
- Rural wages: 5.57s to 4.92s.
- Conditional household debt: 4.82s to 4.68s.
- Listed-company sales: 4.37s to 4.64s; total: 5.95s to 5.83s.

Not every query became faster: policy, vocabulary and quantity metadata increase the
initial core transfer. Typical substantive mobile queries still need about 4.6–5.8s
for complete results. Useful navigation and complete results are separate raw fields.
`search-browser-final.json` and `search-final-budget.json` disclose all samples and checks.

Six final Chrome failure/race/keyboard cases passed. Two additional home cases proved
wrong-policy core rejection/retry, and exact discovery of a known pending label with a
neutral title, Under review readout and no spark (`home-quality-browser-final.json`).
170 stratified exact-label samples had zero candidate-recall misses. 19/20 reader queries
reached a relevant family destination directly; the typo needs the tested explicit
suggestion. These counts are not catalogue-wide first-result precision.

Remaining precision issues are explicit: generic food inflation leads with an older
Assam labour-price instrument; urban female unemployment leads with the previous ILO
definition; rural wages does not settle daily versus monthly pay; listed-company sales
can lead with growth rather than levels. Provenance/dates and guide navigation remain
available. An in-memory generic registered-current-bundle preference fixed food inflation
but regressed wages to an older household-income cut, so it was not shipped. Evidence:
`current-instrument-ranking-experiment.json`. No query-specific ranking hardcodes added.

## Source quality and vintage

The shared ledger retains all records, with 55,411 awaiting interpretation checks and
74 precisely bound reviewed digital records. Canonical equality does not certify labels,
units or denominators. Home/explorer use the same quality revision
`e7b6dd953100c2bd105450cb`; pending records remain discoverable with archived source
access while misleading numeric interpretation/selected exports are withheld in explorer.
State profiles identify their pending mappings; their two reviewed digital fields remain
eligible. No known-wrong selected profile field was silently patched or swapped.

Generic profile adapters no longer stamp fetch day as data vintage. An idempotent
metadata-only migration corrected 331 bundles; all dates/series hashes and associated raw
bytes were preserved. Source revision is unknown, archive capture is separate. Evidence:
`profile-vintage-migration-first.json`, rerun receipt and vintage regression tests.
`npm run prose:dry` completed after the metadata repair without API calls.

## Workers preparation

`wrangler.jsonc` prepares assets-only serving with trailing slashes, explicit 404 and both
provider endpoint settings disabled. No custom-domain route or active deploy workflow was
added. The example workflow requires full gates and a human-approved release.
Mutable HTML/manifests/downloads revalidate; only verified content-hashed Astro, search
and explorer chunks are immutable. Local Wrangler serving passed 17 cases and three
redirects: exact decoded bytes, MIME, security/cache headers, ETag 304, alias/slash query
preservation, missing JSON/CSV/HTML and reserved-file 404. Receipts:
`workers-serving.json` and `workers-serving.log`.

Wrangler 4.149.0 dry-run packaging passed without deployment; the owned dev server is
stopped. Its 17,354 scanned entries equal the independently counted 15,229 files plus
2,125 directories. Read-only authentication was confirmed; plan, zone ownership and the
actual live Pages URL remain unverified. Canonical stays atlas.thisindianlife.today under
the confirmed parent thisindianlife.today. See `../RUNBOOK-workers-cutover.md` for concrete
cutover, old-link redirects and rollback; no live provider was changed or deleted.

## Remaining launch limits and verification history

The largest Every Cut view's mobile cold CLS is 0.1306178, reproduced in three diagnostic
loads and unchanged from baseline; warm CLS is zero. Its LCP is 2.6–2.9s cold and about
3.0s warm. Late text/header movement is observed; the mechanism is not fully isolated. Primary
fonts are already preloaded.
`everycut-cls-diagnostic.json` records affected sources and timing. A full CWV pass is not
claimed. Broad-query instrument/scope ranking, review-pending source meaning and live
custom-domain/account prerequisites also remain explicit limits.

Earlier attempts are preserved, not passed: an interrupted axis-repair epoch, a bundled
source-hash-path build failure, then QC OOM at 6GB. The source helper now passes a real
SSR relocation regression. QC/lint close fully inspected jsdom windows and bound anchor
HTML caching; the unchanged 6GB limit completed full QC (sampled RSS high-water 6,284MiB).
The accepted built-source snapshot is preserved separately from verification-only harness
changes. Browser readiness now checks all SVG sub-panels, populated CSS baskets and
complete heat-map tables, excluding generated SVG internals; five focused regressions
pass. Original false-failure logs are retained. Final test-source hashes are recorded in
`final-test-source-manifest.json`. Final frozen inputs remained unchanged.

Source stays frozen until coordinator handoff. Timing workloads have ended; subsequent
source edits require a new accepted artifact and appropriate verification.
