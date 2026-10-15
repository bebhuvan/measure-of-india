# Wave 2: mutual funds and investor participation

State: source-frozen preparation; no main source/data/artifact changes. Main integration and build remain pending explicit performance release and coordinator slot. Owner: investor-participation family chat. Coordinator: 01a1338d-367f-77c1-944a-be3c0c16ffe3.

Protected staging: `/home/bhuvanesh.r/.codex/atlas-staging/2026-10-13-wave-2/investor-participation`. Allocation: 30MB total, 10MB source replay, AMFI/SEBI single request with five-second gap. Data Bank is read-only. No paid India Data Hub data used.

## Verified local inventory

Selected latest `source_native` warehouse publication by catalogue timestamp, rather than concatenating historical warehouse versions. Warehouse hashes and every publication-input official blob hash checked. Receipts: staging `local-inventory.json`, `lineage.json.gz`. Exact latest publication rows:

- AMFI monthly report: 5,439 rows, 89 months, May 2019–September 2026; 89 category labels across the source's section/group/total hierarchy.
- State average AUM: 50,255 rows, 150 months, March 2014–August 2026; 38 geographic labels, 16 source category labels.
- Category × city × investor/channel average AUM: 154,513 rows, 149 months, March 2014–July 2026; 17 categories. The API returns T15/B15 keys: do not rename them T30/B30 from prose alone.
- Investor-classification AUM/folios: 5,174 rows, 58 periods, September 2009–June 2026. Half-yearly and quarterly cadence must remain distinct.
- Holding-period AUM: 5,278 rows, same 58 periods. Investment age is not investor age.
- Direct-plan RIA/PMS/DIY AAUM: 31 monthly rows, January 2024–July 2026.
- Passive/other-scheme subclassification: 546 rows, 39 months, April 2023–July 2026, 14 subcategory labels.
- SIF: 132 rows, 12 months, October 2025–September 2026; distinct strategy instrument.
- Combined MF/SIF table: three rows for August 2026; separate from conventional MF history.
- Selected SEBI MF/investor/depository families: 22,766 rows, 149 monthly observations, April 2014–August 2026. Counts are after selecting the latest publication and filtering families, not all SEBI rows.
- SEBI source listing: 327 issue months, 928 file-role rows, October 1998–September 2026. PDF-only early history is source catalogue, not canonical coverage.

## Official current-release replay

Three official AMFI pages captured through shared `scripts/lib/net.mjs` and archived with `writeRaw`: monthly report listing (259,440 bytes), investor/holding periods (184,210 bytes), direct-plan periods (180,283 bytes). The actual lists confirm September 2026 monthly report, June 2026 investor/holding period and July 2026 direct-plan report. Bounded source-cell replay is underway; each cut retains its own period. Capture time is never used as data vintage.

## Packet direction and remaining work

Coordinator accepted a linked `/guides/investor-participation/` guide; recent RBI Markets work stays intact. Prepare canonical category monetary/count/SIP measures, active/passive/ETF/FoF detail, investor classes, holding periods, direct channels, geography, city buckets, unique investors versus folios, SIF and historical SEBI resource-mobilisation/depository measures. Each substantive dimension needs explained plates; full tail needs EveryCut/explorer/download exposure. Group totals and domestic FoF memo rows must never be added together.

198.7MB distinct official input blobs were hash-audited without copying. Full SEBI workbooks dominate the archive requirement. Existing public deep-archive mapping must be inspected before transfer. Local absolute paths are not public provenance; missing archive mapping stays blocked explicitly. Temporary verbose row export exceeded staging allocation briefly, then own uncompressed intermediates were removed after gzip; measured staging after correction 3,233,854 bytes. Future exports must stream or gzip directly.

Not yet complete: archived/public provenance transfer, canonical adapter and identity checks, historical seams/census, explained page/client, shared wiring patch, integrated gates, strict coverage, facts/prose dry run and real browser/export QA. Builds and all main mutations are forbidden until the freeze is explicitly released.

## Staged handoff, 13 October 2026

Reviewable candidate packet prepared; heavy staging is now on hold at coordinator request. Main remains source-frozen, with no family integration or build. All main shared wiring is proposed, not edited. Provisional guide number 37 is reserved; final numbering remains coordinator-owned.

Final source-backed candidate counts: **244,150 selected source rows; 310,368 numeric measures; 42 canonical bundles; 7,657 series; 326 candidate plates; 4,091 series used directly in analytical views**. Reader exposure is planned through the complete EveryCut family and downloads, not claimed integrated. All numeric source columns are accounted for independently of the adapter selector; serial ordering, source group identifiers and revision metadata are explicitly separate. A final audit recovered 168 previously omitted passive segregated-portfolio counts (14 series). The official July workbook header defines these **as-of reporting-date counts**, not creations during a month; exact header/URL/hash evidence is staged.

Nine focused checks pass, including **all 310,368 exact raw tuple/measure/month/value comparisons**, full numeric-column accounting, identity/rounding mutation checks, every headline/plate value, unique plate IDs/names, date separation, lossless client packing and complete plotted-history CSV exports. The latest monthly workbook's Grand Total was traced directly: `MCR_MonthlyReport`, zero-based row 103, column 7 month-end AUM 8,264,116.632060861 crore; column 8 average AUM 8,709,182.159081941 crore; column 6 net flow −133,375.56520788925 crore. Official source `https://portal.amfiindia.com/spages/amsep2026repo.xls`, original SHA-256 `b1daaaf1a8c71260c10e9056272bebf7f3367559ac66d5ad5d6d0ec8a9f09967`.

Astro source transform has no syntax diagnostics; this is not a site build. Full staged prose dry prompt was checked for every bundle, required investor-count/date/city-definition guards and absence of undefined coverage fields; no LLM generation or generated-prose verification is claimed. Four source-client fixture cases finish 4/4 charts at 320/390/545/1440 in jsdom; actual Chrome/font/geometry/export and all 326-plate performance readiness remain pending.

Two added source distinctions are carried forward: Ladakh appears separately in the source reporting list from April 2025, and state/monthly category taxonomy changes in August 2026. Territory mapping is not politically inferred. The unparameterised state API's undated Grand Total adds stocks across returned months and is excluded from point estimates; 13 valid explicitly dated August national-total cells are retained. SIP counts/contributions have separate observed-period bundles. Retired or lagged subgroup views retain their own reference dates. **1,020 source city-bucket series carry unresolved-definition flags**: literal T15/B15 is preserved, with no certified top-15/top-30 boundary or urban concentration interpretation. Arithmetic identities do not resolve geography definitions.

The final incremental explorer pack measures **7,657 records, 58 unpooled shards, 7,159,896 bytes, largest 262,008 bytes**. Conservative additional asset projection is **289 files**, including data/download/lineage/EveryCut/guide/client/OG and 50 explicitly unmeasured search-file reserve. Whole-site packing and the actual ≤16,000 asset gate remain mandatory; no source cuts were removed to meet budgets. Compact client payload is 322,940 bytes before compression. Actual HTML/JS/EveryCut budgets remain unverified until integration.

The source release catalogue accounts for 327 AMFI monthly publications (102 Excel-listed, 89 MCR months canonical, 13 earlier Excel layouts unparsed, 225 PDF/HTML-only) and 327 SEBI issues (145 workbook issues, 182 earlier PDF-only). AMFI NSR launch sheets and early report layouts/SEBI PDF extraction remain explicitly unfinished. Scheme NAV/returns/TER/fund rankings are separate instruments outside this aggregate participation packet; these are not counted as covered. Existing RBI AUM reports 126/382 are aliases of the Markets family, not additional coverage.

Protected staging is capped at **23,000,000 actual bytes**. Canonical and full census candidates are losslessly gzipped, with plain/gzip hashes and loaders; production canonical replay still writes ordinary JSON. No unique source evidence was removed. Concrete handoff: staging `integration-manifest.json` with owned-file hashes versus live main baselines, `shared-wiring-proposal.json`, `canonical-compression-manifest.json`, `census-compression.json` and `explorer-projection.json`.

**Prior rights review, superseded by the owner decision below:** Original public redistribution remains blocked by explicit AMFI and SEBI policies pending permission evidence. Numeric-canonical publication has a distinct owner-reviewed basis decision pending. The no-copy official original plan references 522 verified files /149,934,485 bytes; it has not uploaded anything. [AMFI terms](https://www.amfiindia.com/terms-of-use) restrict uses beyond personal non-commercial access without written agreement. [SEBI policy](https://www.sebi.gov.in/website-policy.html) requires reproduction permission and excludes third-party rights. AMFI policy HTML was internally captured/hash-recorded; direct SEBI HTML capture failed DNS, while its official policy text was read through the web tool. No publisher emails, public uploads, commits, pushes or deployments occurred.

Remaining gates: explicit freeze release and sequential integration slot; original public archive upload plus readback where authorised; real shared registry/facts/keywords/source/fetch/validate/coverage/as-of/QC/OG and Markets crosslink integration; generated dated prose with verification; build/gates/strict coverage/full tests/prose:dry; actual complete EveryCut/explorer/source/export accessibility; all-chart Chrome desktop/phone geometry/performance; historical extraction omissions. This packet is **not a completed or published family**.

## Owner publication decision supersedes the rights hold

The original coordinator and wave-2 coordinator relayed the direct human instruction: **“This is all public data. It's good to publish. No need to worry about rights.”** Public charts/downloads and original source archive preparation are now owner-authorised; no publication-rights/licence question remains blocking this task. The policy receipts remain factual evidence, and this instruction is recorded as an owner decision rather than verified publisher permission. No publisher emails are authorised or sent.

`publication-rights.json`, `upload-evidence.json`, `shared-wiring-proposal.json` and the hash-guarded handoff now reflect that decision. The source freeze, storage quotas, sequential integration/archive operational preflight, original public upload/readback, exact source validation, full build/gates/strict coverage/tests/prose and actual all-chart browser readiness still apply. No original upload has occurred. Immutable staged raw capture metadata from before the instruction is retained as audit history; the production adapter now records pending transfer without a rights hold. Heavy staging remains paused after handoff.

### 2026-10-15 bounded preflight

[Preflight receipt](wave-2-investor-preflight-2026-10-15.md): frozen manifest, all 56 owned hashes, 42 decompressed canonical hashes and 522 originals (149,934,485 bytes) match. No frozen/main source/data/dist mutation or build/browser/network/upload. Current helper compatibility fails on native lakh/million units; literal `investor-*` family prefix also needs correction. Proposed in-memory corrected plan has 11 EveryCut pages. External all-7,657-row search forecast delivered to coordinator; explicit source policies, governed investor exports and source-date ticks remain integration blockers. This supersedes the earlier eight-page reserve for capacity planning only; it does not admit the default-quality forecast.

### 2026-10-15 separate corrective proposal packet

Coordinator released bounded stage-only source review and responsive proposal work. Consolidated packet: [investor proposal](investor-proposal-2026-10-15/README.md), pinned by `proposal-manifest.json` SHA256 `f0451b9e73969ba179ed0b056f494446036fb624542e9f6d4eaadfc66e503249`. Three two-month national source records (six original cells) proposed reviewed; 7,654 records pending; all 7,657 archival records retained; no comparisons/derived rates approved. All 42 pending policies have nonempty source-literal titles. Final policy-aware search input SHA256 `0e9ba169fd664caf5ce813fdce2ee87a549b3300be80c600fe128ef3ea2ea19f`; earlier default-quality search input unchanged. Ten structural responsive fixtures demonstrate actual old fixed-width failure and proposed measured-width behavior; no native browser/export/production lifecycle claim. Native-format inventory distinguishes 35 OLE/BIFF originals with misleading XLSX suffixes. Policy/model/payload/export/download guards, full-label fallback, additive shared integration, actual build/asset/Chrome checks and source upload/readback remain blockers. Frozen package/main source/data/dist remain untouched.
