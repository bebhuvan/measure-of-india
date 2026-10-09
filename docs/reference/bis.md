# BIS statistics for India: what we learned

Values come from the owner's Data Bank (`bis_series`, `bis_daily`; its `docs/BIS_SOURCES.md`).
The coverage catalogue comes from BIS itself: `https://stats.bis.org/api/v1/data/<FLOW>/all?detail=serieskeysonly&format=csv`
(a few KB per flow, no key; `format=csv` works without an Accept header). Adapter:
`scripts/lib/products/bis.mjs`; catalogue: `node scripts/lib/products/bis.mjs --catalogue`.

## What BIS lists for India (2026-10-09): 57 series

| Flow | India series | Baked as |
|---|---|---|
| WS_TC | 22: borrowers C, P, H, N, G x lenders (all; banks for P) x units (% GDP, USD, INR; INR unadjusted for H, N, P) | bis-credit, bis-credit-inr, bis-credit-usd |
| WS_CREDIT_GAP | ratio, trend, gap | bis-credit-gap |
| WS_DSR | private non-financial only (no H/N split for India) | bis-dsr |
| WS_SPP | nominal, real x index (2010=100), y/y | bis-property |
| WS_DPP | Delhi, Mumbai, 18 cities (2022-23 base), 10 cities (2010-11 base, discontinued) | bis-property-cities, bis-property-10cities |
| WS_CPP | none for India | |
| WS_GLI | USD, EUR, JPY credit to non-banks (levels, y/y), USD bank loans | bis-gli |
| WS_EER | NEER, REER broad monthly; NEER broad daily (no narrow basket for India) | bis-eer, bis-eer-daily |
| WS_CBPOL | monthly, daily | bis-policy-rate, bis-policy-rate-daily |
| WS_XRU | M, Q, A x average, end; daily average | bis-xru-*; daily excluded (not mirrored; RBI reference rate is the record) |
| WS_LONG_CPI | M, A x index, y/y | bis-cpi-long, bis-cpi-long-annual |

## Quirks found

- The Data Bank view holds one row per parse run; we keep the latest `source_retrieved_at` per (flow, key, date) with a window function.
- India's government debt is published at nominal value only (`G.A.N`); other borrowers at market value. BIS's total `C` equals private + government to 0.1 pt.
- Households + companies exceed the private total by up to 8.4 pt in 2007-2011 (separate break adjustment); they reconcile from 2012. validate asserts it from 2012.
- Households' unadjusted INR credit carries OBS_STATUS B (break) in 2024 Q1.
- **India's latest private credit is a BIS estimate, not a measurement.** BIS's documentation
  ("Long series on total credit and domestic bank credit to the private non-financial sector, data
  documentation", India entry, updated 14 Sep 2026, https://www.bis.org/pages/statistics/credit-private-documentation.pdf):
  "From Q4 2011 onwards annual financial accounts data; intra-year pattern of annual total credit data
  derived from quarterly domestic bank credit series. The most recent periods which are not yet available
  at source are estimated using bank credit series multiplied by the ratio between the last financial
  accounts observation and the corresponding bank credit observation." The observations carry no flag:
  WS_TC returns OBS_STATUS A and OBS_CONF F for every India quarter (checked live 2026-10-09 with full
  attributes). In the data the extrapolation shows as households/private, companies/private and
  banks/private frozen at their Q4 2023 values (0.46709, 0.53291, 0.61069) for Q1 2024 to Q1 2026, so all
  three grow at the private total's pace (7.3% q/q in Q4 2025, 19.3% y/y in Q1 2026; all borrowers
  including government 14.0% y/y). The adapter detects the frozen run mechanically and lists those 9
  quarters in `estimated` (with `estimatedNote`) on private, households, companies, bank credit and the
  total in all three units, and on the credit-gap ratio, trend and gap. The guide quotes households and
  companies only for Q4 2023 (43.8% and 50.0% of GDP; the 2007 peak of 46.2% is higher, so the earlier
  "highest since 2007" claim was an artefact of the estimate and has gone). The DSR is computed from the
  same credit stock. Scan of every other India series (and peers' household/company shares) for a constant
  ratio to a parent over the latest quarters: no other case (two hits were rounding coincidences).
- Korea has no `G.A.N` (government at nominal value); the euro area has no DSR.
- BIS's India property series (SPP, DPP) are the RBI's indices. BIS 18-city Q1 2026 = 115.85; RBI press release 29 May 2026 = 115.9 (checked). RBI later revised Q4 2025-26 to 116.2; BIS has not picked it up and lacks Q1 2026-27.

## Hand checks

- bis-credit: Q1 2026 private 105.1, households 49.1, companies 56.0, government 83.5, total 188.6 (Data Bank validation against BIS bulk files; BIS data portal).
- bis-credit-gap: Q1 2026 ratio 105.1, trend 100.8, gap 4.3; identity gap = ratio - trend in validate.
- bis-property: published y/y recomputes from the index (validate, 0.011 pt worst).
- bis-property-cities: 18 cities Q1 2026 115.85 vs RBI press release 115.9.
- bis-dsr: India 12.5, US 13.8 (Data Bank validation note).
- bis-eer: REER Aug 2026 90.14 (Data Bank cross-check against RBI 40-currency REER).
- bis-policy-rate: 5.25% from Dec 2025, matching RBI decisions (Data Bank note).

IDH series in the Data Bank's `india_data_hub_series` that match these bundles (for the coordinator's cross-check):
`MOHPNIDXAC23Q:IND` (HPI 2022-23 base, all cities) ~ bis-property-cities `cities_18`;
`MOIRRBIRPO11W:IND` (repo rate, weekly) ~ bis-policy-rate-daily;
`FMFXERNTTR16M:IND`, `FMFXERRTTR16M:IND` (RBI 40-country NEER/REER, 2015-16 base) are RBI's own rulers, a direction check for bis-eer only.
No IDH series for BIS total credit, credit gap, DSR or RESIDEX.
