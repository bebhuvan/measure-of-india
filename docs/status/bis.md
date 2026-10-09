# bis family: status

Branch `lb/bis`. Guides `debt` and `housing`. Updated 2026-10-09.

## Done

- **Adapters**: `bis` (Data Bank BIS mirror), `rbihpi` (DBIE 688), `residex` (NHB RESIDEX, live, new). Registered in `sources.yml` (families `bis`, `nhb`; dossiers `bis`, `rbihpi`, `residex`; seams for both house price indices) and `fetch.mjs`.
- **Bundles**: 32 `bis-*` (India credit, gap, DSR, property, GLI, EER, policy rate, rupee, long CPI; 13 peers, one per economy), 5 `housing-rbi-*`, 6 `housing-residex-*`.
- **Catalogues and ledgers**: `bis` 159 items (89 shown, 69 baked, 1 excluded), `bis-rbihpi` 37 (28 shown, 9 baked), `bis-residex` 3,192 (102 shown, 3,090 baked). `npm run coverage` clean.
- **Validate**: ranges per bundle; identities: gap = ratio − trend; total = private + government; private = households + companies from 2012; private credit equals the credit-gap ratio; BIS property y/y recomputes; RBI city y/y recomputes and every city averages 100 in its base year; RESIDEX India moving average tracks its four quarters.
- **Hand checks** (in adapter headers and `docs/reference/`): BIS credit Q1 2026; RBI 18-city 115.85 vs press release 115.9; RESIDEX Apr-Jun 2026 +7.0% and eight cities vs NHB press release, exact.
- **Guides**: `debt` (9 sections, 8 plates) and `housing` (9 sections, 8 plates), registry, headline, register rows, OG cards, qc PAGES, 16 asof entries, prose slots, corpus, keyword maps. Prose generated (DeepSeek) and read by hand against the data.
- **Gates**: `npx astro build`, `npm run gates`, `npm test` (18 pass), `npm run prose:dry` all green. Looked at 1440 and 390 px; share image downloaded (credit gap, both panels).

## Correction after the coordinator's review (2026-10-09)

- India's private credit after Q4 2023 is a **BIS estimate** (bank credit times the last financial-accounts ratio; household/company split frozen). BIS's documentation says so; its data flags nothing. Now marked `estimated` on 9 quarters of every private-credit series and the credit gap, drawn as pale dashed tails, labelled "est.", and households/companies quoted only for Q4 2023 (43.8% and 50.0%). The "highest household debt since 2007" claim was an artefact and is gone (measured peak 46.2% in 2007).
- CONTRACT-series rule 2b and `validate.mjs` now accept a trailing run of estimates (an agency's extrapolation), not only interior ones. validate also checks the estimated quarters hold the last measured split.
- Debt prose regenerated with the estimate in the facts sheet (`facts.mjs` exposes `estimated` with the last measured value); read by hand. One regenerated draft claimed "the total is measured" (false) and was discarded for the earlier passing draft.
- The 19.3% is private credit; all borrowers including government grew 14.0%. The page says both.

## After merging launch-build (428204b)

- Every-cut table on both guides (`<EveryCut>`); six units added to `UNITS` (₹/US$/€/¥ billion, percentage points, ₹ per sq ft) and my bundles' cuts to `CUT_BY_BUNDLE`, one block each; `series.unit` set in the adapters where bundles mix units. Long-tail pages for the RESIDEX bundles over 150 series.
- Seams: the three-rulers plate draws the RBI 10-to-18-city change and the RESIDEX rebase with `seamMarks("overlap")`; the note quotes `seamOverlap` (the RBI bases overlap for several quarters and differ by up to a few points).
- facts.mjs conflict resolved keeping both `ruler` and `estimated`.
- IDH pairs added to `data/crosscheck/idh.yml` (bis block), with a `quarter_level` transform in `scripts/crosscheck-idh.mjs` (IDH dates quarters by their last day). HPI 15/16 match; the one miss is RBI's revision of Q4 2025-26 (116.2) that BIS lacks. Policy rate 294/303; misses are rate-change months and the early 2000s, when the policy rate was not the repo.

## Findings worth a reader's attention

- On BIS's estimates the credit gap turned positive (+4.3 pt) for the first time since 2012; the last measured gap (Q4 2023) was −9.1.
- Household debt was 43.8% of GDP in Q4 2023, the last measured quarter.
- Real house prices are 8.3% below their 2019 peak; nominal +4.2% y/y, real +1.1%.
- RBI revises city HPIs sharply between provisional and final (Chandigarh 109.0 vs 128.3).

## Decisions

- Peers are one bundle per economy (`bis-peer-<iso3>`; euro area = EMU). validate checks their geo against the adapter's table, in an appended block (the shared checkMeta reads the dossier's IND).
- Peer comparison ranks the sum of households + companies + government at nominal value, not BIS's total (which values government at market in some economies). Korea has no nominal government series: drawn without it, excluded from the rank, said so.
- RESIDEX: both methods baked (moving average = NHB's headline, confirmed by the press release; `_q` = quarter alone). NHB's back-casts (`chkbefore1718`) not used. Zeros served by NHB are nulls. Only ₹/sq ft prices (per sq m/yard broken on the 2012-13 base).
- RBI HPI: Final over Provisional; provisional quarters listed per series.
- BIS cross-check copies (EER, policy rate, rupee, long CPI) are listed in the debt/housing data tables so they are downloadable; the rates and external guides should chart them.
- `bis-gli` left out of debt `proseInputs` (mixed currency units make its range summary meaningless).

## Shared files touched (append-only blocks, marked "bis family")

`sources.yml`, `registry.js`, `headline.js`, `validate.mjs`, `qc.mjs`, `og.mjs`, `asof-manifest.json`, `slots.yml`, `fetch.mjs` (imports + `Object.assign(REGISTRY, …)`), `register.client.js` (block at end), `pipeline/lib/series-kws.mjs`.

## For the coordinator

- `pipeline/facts.mjs`: min/max now skip nulls (a real bug for any series that starts after its bundle's axis), plus a `facts.peers` block for debt/housing. `pipeline/verify.mjs`: walks `facts.peers`.
- `scripts/lib/nhb.mjs` carries its own POST helper because `net.mjs` is GET-only; TradeStat will need POST too, so a shared `postForm` in `net.mjs` would be worth doing once.
- RESIDEX is slow: a full refetch is ~510 requests, about an hour. Set `INDIA_ATLAS_RESIDEX_CACHE=<dir>` for dev reruns.
- `data/raw/housing-residex.json` is 10 MB, `bis-india.json` 5.5 MB.
- IDH matches: `MOHPNIDXAC23Q:IND` ~ bis-property-cities; `MOIRRBIRPO11W:IND` ~ bis-policy-rate-daily.
- No every-cut explorer yet (F6 not built); the data tables list every bundle.

## Blocked

- Nothing. One catalogue item excluded: BIS daily rupee rate (not mirrored; RBI reference rate is the record).
