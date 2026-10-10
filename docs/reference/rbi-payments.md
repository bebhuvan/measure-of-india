# RBI payment system statistics in DBIE (what the payments guide learned)

Read 2026-10-10 from the local Data Bank mirror of DBIE (`scripts/lib/databank.mjs`). Adapter:
`scripts/lib/products/payments.mjs`.

## The reports

| DBIE id | What | Copies of the same table | Notes |
|---|---|---|---|
| 612 | Payment System Indicators, monthly (RBI Bulletin Table 45), Apr 2004 to the latest month | 61 (Bulletin menu), 778 (Payment Systems menu) | one provider (DP0), 365,484 rows |
| 907 | Payment System Indicators, annual (Handbook) | 824 | four providers: DP5 volume, DP4 value, DP6 cheque numbers, DP3 cheque amounts |
| 678 | Cheque clearances by centre (STRBI Table 22) | 662 | DP0 amount, DP1 number of cheques |
| 936 | Number of clearing houses (STRBI Table 27) | 743 | DP4 total "1030 (52)", DP3 non-MICR by manager, DP2 MICR by manager "(16)" |
| 1404 | e₹ in circulation, retail by denomination and wholesale (Handbook) | none | end-March 2023 on |
| RBIB43 | WSS growth rates of IMPS, NACH Cr, NEFT, UPI | Data Bank parsed dataset `rbi_dbie_payment_system_indicators` | y/y per cent, May 2022 on |

The RBI Innovation Hub service (`docs/reference/rbihub.md`) holds the same reports (61, 612, 662,
678, 778, 824, 907, 1404) and an SDMX "Clearing House" dataset; nothing payments-specific that
the Data Bank lacks. Its copy of 1404 matches the Data Bank cell for cell.

## Traps

- **Display units.** Every value is printed once per display unit (14 units in 612, 6 in 907).
  The number is the same in every row; keep `ACTUALS`.
- **Two layouts in 612.** Old layout (item sk 1 to 42) runs April 2004 to October 2019; the
  re-organised layout (sk 45 to 146) runs from November 2019. No item crosses the seam. Lines
  were redefined: card lines lost ATM withdrawals (now "Cash withdrawal at ATMs"); UPI, AePS,
  APBS got their own lines; UPI is not a line of the old monthly layout at all.
- **Header rows carry values.** Item 97 "B. ATMs" holds zeros for Apr 2022 to May 2023.
- **Old ATM and PoS counts x 10^6.** Items 37 and 38 store 229,374 ATMs as 229,374,000,000.
- **907 old layout is mis-scaled.** Its 2012-13 to 2017-18 values are 1/100 and volumes 1/10 of
  the monthly sums. Its re-organised layout (sk 120 on, from 2015-16) is right and equals the
  monthly sums from 2020-21, except PPIs 2022-23 and CCIL volume 2025-26 (small, as published).
- **907 carries the year in progress** (2026-27 = April to July 2026).
- **678's "Num Chq" is a display-order code**, not a count. Counts are in DP1.
- **936 is strings with footnote marks**: "1306(64+2*)$", "1373(15+3)#". Its DP3 "Total" row
  prints 0.
- **e₹ March 2026**: ₹771.25 crore of ₹771.66 crore retail in the ₹1 column, nothing in ₹500
  (₹857.68 crore a year earlier). Printed so by the RBI; the reason is not given.
- **Item numbering drifts**: WSS calls UPI "2.6 UPI @", the Bulletin "2.7 UPI". The item sk is
  stable; the adapter asserts each sk's description.

## Not in DBIE

BBPS (bill payments), NPCI's UPI figures by app and by bank, state or district detail, and any
cross-country comparison. The official comparison is the BIS CPMI statistics
(stats.bis.org dataflows WS_CPMI_CASHLESS, _CT1, _CT2, _DEVICES, _INSTITUT, _MACRO, _PARTICIP,
_SYSTEMS), which list India; the Data Bank does not mirror them yet.
