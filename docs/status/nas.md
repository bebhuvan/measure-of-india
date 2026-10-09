# nas: status

Session: atlas-nas, branch `lb/nas`, port 4424. Guide: `gdp`. Brief: `docs/briefs/nas.md`.

## Done

- **Every row the API serves, to raw** (2026-10-10). `scripts/lib/products/nas-deep.mjs` pulls
  `getNASData` unfiltered for every base x series x frequency x indicator the coverage
  catalogue lists: 86 queries, about 4,000 rows, no throttling seen. Five dumps,
  `data/raw/nas-deep-{2011-back-annual,2011-current-annual,2011-current-quarterly,2022-current-annual,2022-current-quarterly}.json`,
  2 MB in all. Run by `buildNas` after the headline bundles.
- **27 new bundles** from those dumps (`nas-deep-build.mjs`, no network). Per base
  (2011-12 as `gdp-*`, 2022-23 as `gdp-2022-*`): annual levels (every indicator, both prices,
  plus NNI and the discrepancy, computed), annual growth, annual shares of GDP, GVA by 15
  industry rows, GVA by 18 sub-industries, capital formation by industry of use,
  institutional sectors, revision stages, quarterly levels, quarterly shares, quarterly
  industry levels. Back series: levels, growth, shares, industries, 19 sub-industries.
  Services' bundles `gdp-industries` and `gdp-2022-industries` are unchanged.
- **Ledger decided**: `gdp` 621 items, 179 shown, 334 baked, 108 excluded, 0 pending.
- **Validate**: rows for all 27 bundles, plus identities (GDP = GVA + net taxes, net taxes =
  taxes less subsidies, NDP = GDP less depreciation, 11 industries and 8 groups sum to GVA,
  sectors sum to totals, quarterly GDP = GVA + net taxes, back-series industries from 2004-05).

## Hand checks

- Base 2022-23, against MoSPI's press release "National Accounts Statistics 2026", 31 Aug 2026,
  para 10: real GDP 2022-23 ₹2,61,77,001 crore, 2024-25 (FRE) ₹3,01,15,428 crore, 2025-26 (PE)
  ₹3,24,70,100 crore. All three exact in `gdp-2022-annual-levels`.
- Base 2011-12, against the press note of 28 Feb 2025: real GDP 2023-24 (FRE) ₹176.51 lakh
  crore (bundle: 1,76,50,590), growth 9.2% (stage growth computed from levels: 9.19; the API's
  own rate says 9.1, see quirks); 2024-25 (SAE) growth 6.5% (computed 6.48).

## Source quirks (for HISTORY)

- The filter lists an `approach` cut, but `getNASData` ignores `approach_code`: same rows for
  every code. Excluded; the discrepancy is computed from levels instead.
- Taxes and subsidies on products (ic3, ic4) are labelled "₹ Lakh"; they are ₹ crore (net taxes
  equal taxes less subsidies to the rupee). validate re-checks it on every bake.
- The API's growth-rate indicators are one decimal and sometimes **truncated** rather than
  rounded (2023-24 FRE: API 9.1, press note 9.2, levels 9.19; 2024-25 PE: 6.4 vs 6.5). Stage
  growth is computed from levels, against the previous year's stage that reproduces the
  published rate within 0.1 point (`meta.pairs` records it). One API rate matches no
  pairing at all (GVA 2019-20 second advance, nominal: API 3.3, levels 7.9) and is flagged.
- Stage labels are not vintages: on 31 Aug 2026 MoSPI restated every new-base year (new PPI
  and IIP) and the API now holds the new figure under the old label (2025-26 "Provisional"
  ₹3,24,70,100 crore; June's provisional was ₹3,23,12,034 crore).
- ic21 (GVA growth) serves the same sub-industry cell up to three times with different
  values (forestry 2013-14: −1.5, 5.9, 5.8). Not used; excluded as a cross-check anyway.
- Total GVA from the industry table and the sector table differ by rounding (₹2 crore,
  2018-19). The industry table wins.
- Revised stages publish 11 industries, 18 sub-industries and 7 sectors; advance and
  provisional stages only the 8 groups. For years standing at a revised estimate the group
  is the sum of its two published parts (listed in each series' `derived`).
- Back series: industries reconcile with total GVA only from 2004-05 (before that the sum
  runs above or below the total, as published); its expenditure side runs 5 to 14% of GDP
  above output before the 1990s (the computed discrepancy). Both disclosed in bundle notes.
- Base 2022-23 final years (2022-23, 2023-24) are balanced: the discrepancy is zero at
  current prices.
- Per-capita income: the 2026 publication has a per-capita statement, but the API serves
  per-capita only state-wise. Not derived.

## Next

Guide plates (where the money goes, income from abroad, the discrepancy, who saves, sub-
industries, revision paths, the economy's make-up since 1950), stale "As of" notes and
header, prose, OG card, looks at 1440 and 390.

## IDH series

None for national accounts in the Data Bank's `india_data_hub_series` yet (framework's
request list covers GDP, GVA, expenditure and industries on both bases).
