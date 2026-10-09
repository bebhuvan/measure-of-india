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

## Findings worth a reader's attention

- India's credit gap turned positive (+4.3 pt) for the first time since 2012. Most of the swing is two quarters: private credit in rupees +19.3% y/y vs 11.7% a year earlier, no break flagged by BIS. The page says we do not know yet whether that is borrowing or new data.
- Household debt 49.1% of GDP, highest since the series began (2007).
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
