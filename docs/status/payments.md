# payments: status

Guide: how Indians pay (`/guides/payments/`, port 4432). Branch `lb/payments`.

## Done

- Adapter `scripts/lib/products/payments.mjs` (product `payments`, family `databank`), raw
  archive `data/raw/payments-dbie.json.gz`, catalogue generator (`--catalogue`).
- 11 bundles: `payments-monthly` (Nov 2019 on, 57 lines x number and value), `payments-infra`
  (cards, PPIs, ATMs, micro ATMs, PoS, Bharat QR, UPI QR), `payments-monthly-2004` and
  `payments-infra-2004` (the old layout, Apr 2004 to Oct 2019), `payments-ticket` (average
  payment, derived), `payments-annual` (fiscal years 2015-16 to 2025-26), `payments-cheques-1970`
  (cheques since 1970-71), `payments-cheques-centres` (cheques by clearing centre),
  `payments-clearing-houses`, `payments-erupee`, `payments-growth-wss` (RBI's printed growth).
- validate: every total = its parts (exact in the new layout), annual = sum of months, the
  RBI's printed growth = growth from levels (408 months, worst 0.005 pt), six values checked by
  hand against RBI publications.
- Coverage ledger `data/coverage/payments.yml`: nothing pending.

## Next

Guide page and client, registry, headline, OG card, qc, asof, prose.

## Decisions

- **Two layouts, two rulers.** The RBI re-organised Bulletin Table 45 in November 2019. Lines
  were redefined (card payments stopped counting cash at ATMs; UPI, AePS and APBS got their own
  lines), so the old layout is its own bundle and never joined.
- **Values in rupees, volumes as counts**, as DBIE stores them (units `inr_amount`, `count`).
- **The old annual table (907, 2012-13 to 2017-18) is excluded**: DBIE stores its values at
  one-hundredth and volumes at one-tenth of the monthly sums. The monthly table has those years.
- **The year in progress is dropped from the annual bundle** (907 carries April to July 2026 as
  "2026-27").
- **International comparison: blocked.** The official source is the BIS CPMI statistics. The
  Atlas reads BIS values only from the Data Bank, which does not mirror the WS_CPMI dataflows.
  The 812 India series are in the catalogue and marked blocked. Asked the coordinator.

## Source quirks

- Every DBIE value repeats once per display unit (14 units); ACTUALS kept.
- Old-layout ATM and PoS counts are stored multiplied by 10^6 (229,374 ATMs appear as
  229,374,000,000). Divided back; they meet the new layout's first month (231,955 ATMs).
- Report 678 (cheques by centre): the "Num Chq" column is a display-order code, not a count.
  The count is in data provider DP1.
- The Handbook's annual table differs from the Bulletin's months in two places, as published:
  PPIs 2022-23 (1.76 crore transactions below the months' sum, carried into the totals) and
  CCIL 2025-26 volume (84 trades above). Declared exactly in validate.
- e-rupee, March 2026: the RBI's table puts ₹771.25 crore of the ₹771.66 crore retail e-rupee
  in the ₹1 denomination and nothing in ₹500 (March 2025: ₹857.68 crore in ₹500). The RBI
  Innovation Hub's copy of report 1404 is identical. Shown as printed; the page says we do not
  know why.
- Section title row "B. ATMs" (item 97) carries zeros for Apr 2022 to May 2023: excluded.

## For other owners (coordinator)

- **credit**: `credit-deep-cheque-clearances` (report 662 DP0) takes the "Num Chq" display code
  for the number of cheques (its "cheques" series reads 17, 23...). The count is in DP1.
  `credit-deep-clearing-houses` (743 DP3) holds only non-MICR clearing houses by manager (and a
  "Total" row of zeros); the total with MICR is in DP4. `payments-cheques-centres` and
  `payments-clearing-houses` read them correctly.
- **Data Bank**: please add the BIS CPMI dataflows (WS_CPMI_CASHLESS, _CT1, _CT2, _DEVICES,
  _INSTITUT, _MACRO, _PARTICIP, _SYSTEMS) to `bis_series` so the guide can compare India.
- **banks**: report 1518 (branches and ATMs of SCBs, Trend and Progress) is theirs; this guide
  uses the ATM counts in the payment table instead.
- No state cut: the RBI publishes payment statistics for India only.
