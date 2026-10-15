# NSS77 farm households: source semantics and repairs

Official source: https://www.mospi.gov.in/sites/default/files/publication_reports/Report_587m_0.pdf
Release: September 2021; first interviews January–August 2019, second September–December 2019. Report §1.6.3: value of agricultural produce above ₹4,000 in preceding 365 days and member self-employed in agriculture. Entirely wage-only agricultural labour, coastal fishing, rural artisans and agricultural services excluded from agricultural-household measures. All rural/non-agricultural household land/livestock estimates remain broader populations.

Report §2.1: crops, wages, land and productive assets July–December 2018 / January–June 2019; animals and nonfarm business last 30 days before interview; indebtedness as on interview date. Combined common-household animal/nonfarm aggregates use visit weights 8 and 4, not a simple unweighted average; six-month measurements combine visits by simple average. Household counts have moving survey-midpoint reference (§2.1.2). API indexing endpoint 2019-06-30 does not overwrite cell references.

API inventory verified through getIndicatorList viz_status 1 and 0: 33 indicators. Offline archives reconcile 471,001 rows; profile subset 14,112 entries. Every joint dimension is preserved, no synthetic cube. The census and shown/baked ledger record all original cells and report recovery separately.

## Defects and deterministic remedies

* Indicator 33: the entire 184-cell Andhra Pradesh creditor/debt vector is identically copied under 31 state labels. Whole-family state-vector detection found this issue only in 33. Original API values quarantined as null with sourceValue retained. Report Appendix A Table 29 (all 31 geographies, 8 land classes, 25 columns) replaces analytical debt/lenders, including sample/control totals. Report Statement 5.7.1, printed p. 138, independently anchors national loan ₹74,121 and incidence 50.2%. These are agricultural-household estimates, distinct from AIDIS.
* Indicator 47: wrong insurance category labels assigned to MSP table; report Table 18 supplies correct awareness, procurement, reasons, output shares, prices and sample/control bases. API 47 numeric values quarantined.
* Indicator 48: 78 cells contain PDF column headers (2) through (14), repeated for six crops, not negative estimates. Original strings preserved as null; report Table 19 recovers full noninsurance/insurance rates and sample/control bases.
* Indicator 36: leasing-in table has leasing-out sublabels. All 13,950 numerical cells reconcile exactly with report Table 34 by state, season, holding class, social group and measure. Original labels and warnings remain preserved. Reproducible check: `scripts/farm-households-leasing-audit.mjs`.
* Indicator 18 count rows have missing land-class dimension, regardless of livelihood category. They are hundreds of households, not per-thousand shares. API count and distribution rows use distinct unit selection.
* Indicator 21: 15 published rates exceed 1,000. All 15 are confirmed in report Table 13A by page and source line, including missing-season Assam using its visit identity. They remain quarantined as source inconsistencies. No rescaling or clipping.
* API 31 includes only animal costs, despite receipts in heading. Report 27A/27B recovers paid-out costs, receipts, imputed costs, sample/control bases across 31 geographies, 3 references and 8 classes. Report 27B itself supplies only expenses despite receipts in title.
* Report 29 repeatedly prints 0.01–0.04 where the standard class is 0.01–0.40. Normalized only in report-native extraction, with explicit note and Statement 5.7 check. It does not change archived PDF text.

## Remaining report scope

The Appendix contains report-only material beyond the 33 API visualisation indicators: individual employment/principal-status transitions, technical advice and adoption, purchased-resource quality, debt purpose, operational use, further tenure/sample/area totals and relative standard errors. API inventory is complete; whole-report transcription is unfinished. The guide explicitly names this limit. Recovered tables 18/19/29/27A/27B are a separate scope with exact row assertions. Source quantity basis of average sale rates is labelled as published, not assumed uniform across crops.

## Census decision

Lead: income after paid-out versus imputed inputs, national debt/incidence from report 29.
Show: every substantive table measure and every available non-state dimension through national direct-cell analytical slices; state income (both conventions), debt and incidence with source totals explicit.
Summarize: remaining joint-state/crop/social/holding/visit combinations, all retained in Every Cut and downloadable canonical bundles, with per-source count/unit/reference labels.
Skip numerical interpretation only: corrupted API 33/47, header cells in 48 and 15 out-of-base rates in 21. They remain discoverable as null with original strings. No source cut is dropped for convenience.

Crop measure audit: all 13 joint identities of `sub_indicator`, `harvested` and `sub_harvested` in API 42 are mapped across 3,211 original cells. Sixteen additional direct-source analytical slices preserve the original 213 charts. Quantities, value and area condition on reporting households, and coconut numbers stay separate from kilograms. No national production total is constructed. Audit: `scripts/farm-households-crop-audit.mjs`. Layout verification must be rerun for all 229 charts.
