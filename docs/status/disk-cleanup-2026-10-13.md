# Disk cleanup, 13 October 2026

Dedicated owner-authorized cleanup. Initial available space: 2,267,787,264 bytes (2.27 GB). No removal yet. Metadata-only top-level inventory and process cwd inspection completed without printing arguments or file contents.

Main dist, .astro, node_modules, source, preview 4332, active browser/runtime files, wave-2 staging and primary datasets/documents/secrets are protected. Performance/explorer contacted for I/O timing and explicit obsolete-path ownership. Completed Farm/Energy/RBI owners contacted for recoverable archival eligibility and ignored-file/evidence preservation. No gate/build will be started during the frozen artifact interval.

Receipts: `docs/status/disk-cleanup-receipts-2026-10-13/`.

## First safe action and inventory

Native `uv cache prune --offline --no-config --cache-dir /home/bhuvanesh.r/.cache/uv` completed without force/CI options. Native in-use protection retained; visible process/open-fd inspection showed no cache acquisition/open files. Tool reported 1,733 files / 52.7 MiB removed, but allocated cache bytes fell only 10,432,512 bytes (1,604,718,592 → 1,594,286,080), consistent with shared/hardlinked storage. During-action available-space delta was +10,346,496 bytes; concurrent activity prevents perfect attribution. Current available space: 1,205,874,688 bytes, lower than initial baseline because the active build grew. Never count native logical bytes as recovered physical capacity.

Bounded allocated-byte inventory: npm download cache 159,703,040; npm npx environments 717,287,424 (retained as installed tools); pnpm store 604,839,936 (retained pending dependency safety); Hugging Face cache 2,332,069,888 (protected primary/runtime ambiguity); browser cache 137,515,008 (protected); visible /tmp 2,457,505,792 (mixed active profiles/data/evidence, retained). No broad home/disk scan or blanket cache deletion.

Worker checkouts: Farm 1,404,157,952; Energy 282,181,632; RBI 299,290,624 allocated bytes. RBI owner confirms unique untracked evidence and no attached managed-worktree artifact: handoff equality alone is insufficient for disposal; retain pending recoverable snapshot mechanism. Farm/Energy owner checks pending.

Wave-2 coordinator and original coordinator notified of ~1.2 GB current space and recommendation to defer major acquisitions; all three named staging families and wave-2 status evidence protected.

## Native npm download-cache cleanup

`npm cache clean --force --cache /home/bhuvanesh.r/.npm` succeeded; native command's required flag applies only to reproducible package downloads. Available space increased exactly 159,703,040 bytes (1,194,921,984 → 1,354,625,024). Installed `_npx` tools, protected Wrangler `_npx/32026684e21afda6`, Node 22.22.3, shared node_modules and bundled runtime/Playwright retained. pnpm store retained: available runtime is pnpm 11 while populated store is v10, so no unsupported cross-version pruning.

Performance/root confirmed bounded metadata/cache I/O safe during owner repair; no timed browser measurement then. A wider Documents metadata scan was explicitly stopped after exceeding its bounded budget, by terminating only our exact inventory command. No worker/build/browser process interrupted. Documents/Data (~60.8 GB) and Akshara (~72.4 GB) are protected primary data; model/runtime/session/index stores retained.

Farm owner confirms unique ignored original Report 587 PDF (60,536,852 logical / 60,542,976 allocated bytes) absent in main, two ambiguous HTTP responses and inherited dirty files. Energy owner confirms 157 ignored HTTP responses (~4.18 MB allocated) and dirty inherited files. All three checkouts retained; no managed recovery attachment/reference exists in their owner chats. Their small .astro caches (Farm/RBI 28,672; Energy 36,864 bytes) do not justify recovery-risk churn. No force worktree removal or Git snapshot mutation.

Potential additional target pending root ownership confirmation: old Atlas scratchpad `/tmp/claude-546000862/-home-bhuvanesh-r-Documents-Bhuvan-projects-Economic-atlas-new-Kimi/2e56e0dd-e093-48e4-877a-1150aef9bb87/scratchpad/cdp-profile-*` contains repeated downloaded browser components. No visible live cwd/exe/open-fd references found, but absence alone does not establish disposal. Retain pending explicit obsolete test-profile confirmation; preserve all exports/screenshots/logs and scratchpad `wr/node_modules`.

Wave-2 readiness-canaries staging also protected under the same entire protected wave-2 root; all named children remain within coordinator's 100 MB total staging allowance.

## Verified Chromium download-cache action

Atlas scratchpad `cdp.mjs:7` explicitly creates headless Chrome test profiles at the exact `cdp-profile-PORT` paths. Only 40 `component_crx_cache` directories were selected. Every member was a regular hash-named CRX download (Cr24 magic plus SHA-256 content equal to filename), or generated cache metadata. [Chromium cache implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/update_client/crx_cache.cc) identifies these as cached component update downloads, separately from installed components. Full process-name/argument reference check performed internally without printing arguments; all profile open descriptors checked. No actual browser references. First guard matched its own shell command text and safely aborted before mutation; corrected to actual browser names and repeated validation.

244,350,976 allocated file bytes plus emptied-directory blocks removed; exact during-action df increase 244,514,816 bytes. All profile state, installed components, `Default`, cookies/history/preferences, screenshots/exports/task logs and `wr/node_modules` retained. Candidate/action receipts enumerate all paths and entries.

## Complete local recovery feasibility

Owners confirm conditional willingness for verified private lossless recovery; no unconditional retirement or managed recovery reference. Every worker has only the main node_modules symlink as a checkout external link, plus shared main Git object/config/ref dependency. All checkout files, ignored PDF/HTTP sources, index/admin/HEAD/ORIG_HEAD/reflog objects and staged/unmerged blobs would need preservation. Shared `.git` occupies 798,212,096 allocated bytes.

Hardlink-aware metadata materially reduces expected recovery: Farm 779,726,848; Energy 281,751,552; RBI 298,815,488 independently reclaimable regular-file blocks. Each also contains roughly 603–624 MB of externally hardlinked blocks; removal of one checkout does not reclaim these. The initial multi-path du totals must not be added to claim per-checkout recovery. Farm logical files total 1,393,876,012 bytes; Energy 895,630,621; RBI 892,131,479. A 10 MB bounded first-chunk compression sample suggests JSON compresses well (roughly 6–18%) and unique PDF much less (86%), but this is not a guaranteed archive bound.

Current headroom cannot safely accommodate independent Git closure, complete recovery archive and actual full Farm restoration with a 750 MB reserve. No compressed archive, snapshot, restore or checkout removal was performed. Retain all three. Practical next step requires an additional recovery volume/headroom and coordinated I/O, then private complete archive plus streamed entry/hash checks and Git-state restoration test before owner handoff/retirement.

## Result

Identified allocated recovery: **414,650,368 bytes (414.65 MB / 395.44 MiB)** across uv unreachable objects, npm downloads and verified old Chrome CRX cache downloads. Sum of during-action df gains: 414,564,352 bytes; slight difference reflects concurrent changes/receipts. Latest available space: **1,620,172,800 bytes**; initial 2,267,787,264, overall delta **-647,614,464 bytes**. Concurrent active build/staging consumption explains why overall headroom can fall despite cleanup; do not present 414 MB as a positive end-to-end df delta. 10 GB target was not safely achieved.

Protected-path existence checked and recorded in final receipt. Source/dependencies/raw/canonical datasets/staging/evidence preserved by cleanup. No feature commit, app uninstall, deployment, source edit, force worktree removal, reflog pruning or shared Git mutation. No gates or rebuild run, per the specific generated/cache-only cleanup brief and frozen combined artifact interval.

Final coordinator acknowledgement: retain all workers; no further proven large cache candidates. Wave-2 staging cap remains 100 MB unless increased headroom is confirmed after performance-owned guarded replacement. Handoff available space: 1,641,771,008 bytes; overall initial-to-handoff delta -626,016,256 bytes. Identified cleanup allocation reduction remains 414,650,368 bytes.

Farm owner follow-up confirms codex-thread metadata ownership, 3,809 index entries and zero unmerged entries. Streaming member verification could avoid a second full data expansion, but full Git/index/HEAD reconstruction and pointer adaptation remain unproven. Conditional handoff only; original checkout retained, no archive/retirement.

Farm owner corrected the prior message index-count typo to 3,809; durable owner feasibility receipt was already correct. Zero unmerged entries; no further worker I/O or retirement.

Capacity follow-up for Insurance request: measured df available 761,143,296 bytes; wave-2 allocated 97,841,152 bytes versus owner-retained logical 92,959,496. No further verified cleanup. Recommend retaining 100 MB total cap, tracking allocated blocks, and read-only/in-memory reuse rather than source duplication; only ~11 MB above 750 MB decimal reserve. Entire wave-2 root remains protected. Both coordinators notified.

Diagnostic pressure follow-up: available 721,825,792 bytes; swap 8,197,718,016 / 8,589,930,496; RAM available 21,678,964,736 bytes. Active diagnostic dist (~4.4 GB) protected, no independent deletion/archive creation. Performance/explorer asked for exact explicitly superseded disposable path ownership confirmation. No new recovery; 100 MB staging cap unchanged and larger acquisitions held. Both coordinators notified.

Read-only owner-confirmed obsolete shard assistance: 110/110 listed generated chunks present, regular/nonsymlink/nlink1, exact listed sizes and truncated SHA256 filename identities verified. All 256 current manifest buckets stable across scan, 4,324 current referenced chunks; zero candidates referenced. Candidates total 24,397,650 logical / 24,588,288 allocated bytes. No independent dist deletion: performance owns fresh mutation checks/fixture coordination/removal. Available at verification 697,802,752 bytes; no new recovery by this cleanup. Exact content+manifest hashes saved in obsolete-shards-readonly-verification.json; root and performance notified.

Digital-only next-build preflight after accepted QA release: available 936,136,704 bytes; existing dist allocated 4,645,834,752; staged root 96,079,872. No duplicate full dist fits. Requested owner exact epoch/replacement guards/harness. Reported source-install reservation 55.55 MB leaves only ~130.59 MB for net dist growth plus all other outputs above 750 MB decimal reserve. This is a conditional thin budget, not build clearance; canonical null-contract hold must resolve first. Existing-dist guarded replacement releases capacity temporarily, not new net recovered bytes. No deletion/mutation by cleanup. Coordinator notified.

Root assigned digital-only next replacement/build ownership to wave-2 coordinator, conditional on source-null contract approval/source settled. Existing ATLAS_BUILD_SLOTS=1 scripts/build-slot.sh and frozen-source/guarded tooling require coordinator interface/manifest/current-artifact inspection. Cleanup remains read-only and relayed the ownership decision plus thin measured budget. No replacement during HOLD.

Accepted artifact guard clarification: old --replace-dist baseline and --replace-diagnostic-dist interrupted-epoch modes cannot authorize accepted-artifact replacement. Root instructed wave-2 coordinator to implement/test an accepted-manifest-specific guard (local realpath, nonsymlink, exact file set/bytes/full SHA, no extras), preserve receipts, pin new digital epoch and hold one build slot. Null-contract HOLD remains; no deletion and no old broad guard reuse. Cleanup capacity role remains read-only.

Digital source-only capacity follow-up: available 867,000,320 bytes; dist unchanged at 4,645,834,752; staging 96,391,168 (+311,296 since preflight); uv cache unchanged and npm download cache absent. Main series/raw measured as new baseline only. Bounded recent-large metadata shows active session/Markets launch logs, all protected; no cumulative-size-as-growth attribution. No >=10MBdocs/status output. Conservative 55.55MB reservation leaves61.45MB net build/other-output growth above750MB reserve. No cleanup/independent census removal; owner compression requires its exactreadback/no-consumer proof. Null-contract HOLD remains and sourcepeak requires remeasurement. Both coordinators notified.

Root null-contract review subsequently approved exact925 descriptor/factory/normal finite bounds/class+consumer activation and canonical promotion; earlier HOLD released within that scope. Build replacement still requires post-promotion freshcapacity, exact accepted-manifest guard and sourcefreeze. Previous867MB reading and61.45MB budget are historical pre-promotion measures, not fit guarantees. Cleanup remains read-only with no new deletion authority.

Read-only Playwright candidate check: total278,790,144 allocated bytes, headless-shell1243=273,637,376 and ffmpeg1011=5,140,480. No visible process exe/cwd/open-fd references, but .links registers an existing Maatu/server/node_modules/playwright-core whose browsers.json requires these exact revisions. Retain as installed other-project runtime; Atlas explicit systemChrome does not establish disposal authorization. No new recovery. Available863,928,320 bytes; notified both coordinators.

Root intentional operating reserve update for ONE Digital guardedbuild:750MB→500,000,000 bytes. No cleanup gain or weakerdata/gates implied. Freshavailable856,465,408; unchangeddist4,645,834,752; staging96,403,456. Budgetabove500M356,465,408 for ALLremainingnetgrowth/temp/log margin (300,915,408 if prior55.55Mreservation remains conservativelyapplied). Completeforecast/freshadmissiondf/exactmanifestguard/sourcefreeze/dfmonitor-abort required; no unconditionalfit. Otheracquisitions/integrationhelduntilactualpostDigitalcapacity. Coordinatornotified, cleanupread-only.

## Pension browser-QA headroom, 14 October

Root authorized three precise cache actions after a read-only assessment:

- Generated Node compile-cache entries: **26,664,960 bytes** recovered from 3,212 regular, single-link files owned by this user. Node binaries and installed packages were preserved. The [Node documentation](https://nodejs.org/api/module.html#module-compile-cache) explains how this cache is recreated.
- npm download cache: **182,059,008 bytes** recovered through the native clean command. The first process guard skipped two npm wrappers; subsequent checks established that they were long-running Astro and preview servers with running Node children, rather than package acquisitions. Both servers, `_npx`, `_prebuilds` and installed dependencies were preserved.
- Xet upload-dedup metadata: **76,222,464 allocated bytes** recovered by deleting only the 269 approved `.mdb` files in the exact `shard-cache` directory. The inventory fingerprint matched twice, all files were regular and single-linked, and there were no open descriptors or memory maps. [Hugging Face documentation](https://huggingface.co/docs/huggingface_hub/guides/manage-cache#limits-and-limitations) distinguishes this optional optimization cache from model and dataset assets. Hub assets, credentials, staging, shard sessions, logs and the parent directory were preserved.

**Today’s identified allocation reduction: 284,946,432 bytes (284.95 MB).** The sum of during-action disk gains was 284,942,336 bytes; concurrent writes explain the 4 KB difference. This is an action total, not a permanent lifetime headroom claim: caches can regenerate.

Immediate post-action free space was 854,200,320 bytes. A later lightweight reading showed **829,751,296 bytes available**, leaving **61,315,840 bytes above the 768,435,456-byte QA admission threshold**. Fresh admission checks and monitoring of the 500 MB retained floor remain necessary. Root received both readings.

No further 400 MB candidate was proved. The roughly 650 MB pnpm store is mostly hardlinked elsewhere; only 11.9 MB was singly linked, and no store deletion was performed. UV has an active Folio process, so its cache and temporary extractions were retained. Pip, go-build and ccache directories were absent; apt downloads were negligible. Other temporary storage contained protected profiles, logs, source or ambiguous fixtures.

The pension artifact, all source, raw and canonical data, staging, evidence, required runtimes, browser profiles and worktrees remain protected. No process interruption, source edit, build or gate run occurred. The three action receipts and compact summary are in `disk-cleanup-receipts-2026-10-13/*2026-10-14.json`; they all parse successfully.
