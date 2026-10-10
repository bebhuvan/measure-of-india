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

- Guide `/guides/payments/`: 9 sections, 16 plates (36 charts), every number data-bound;
  every-cut table and data downloads; registry (number 26, next free on this branch: the
  coordinator renumbers at merge), headline, spark, register rows, OG card, qc PAGES (32
  checks through `src/dossiers/payments.fmt.js`, shared with the client), 15 asof entries.
- Prose: facts module `pipeline/lib/facts-payments.mjs` (registry `factsModule`), slots,
  keyword map, corpus. Generated with DeepSeek, passed verify, lint and contract, and read by
  hand against the sheet: every figure checked (one wrong qualifier, "at the card machine" for
  an all-cards ratio, caught on reading and fixed by naming both ratios in the sheet).
- Gates on the last build: validate, coverage, asof, qc, chart lint all green; npm test green.
- Looked at 1440px (every plate) and 390px (no overflow); downloaded the UPI plate's share image; OG card `public/og/payments.png` generated (other cards restored).

## Next

Nothing for this guide beyond the coordinator's merge. Blocked items are listed below.

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
- Shared files touched, each one block marked "payments": sources.yml (dossier and seams),
  fetch.mjs, validate.mjs, registry.js, headline.js (HEADLINE and SPARK), og.mjs, qc.mjs,
  slots.yml, asof-manifest.json, series-kws.mjs, everycut.js (CUT_BY_BUNDLE),
  register.client.js, test/states-key.test.mjs (cheque centres are not states).
- This guide reads the credit guide's `credit-money` bundle (currency with the public),
  read-only, for the cash plate and the prose.
- NPCI: UPI by app and by bank is published on npci.org.in, but its terms page renders only
  with JavaScript and states no licence we could read (2026-10-10). Not used.
- IDH series that match these bundles (for the cross-check manifest; names only, no values
  read): MOPYVOUPIP11M / MOPYVAUPIP11M (UPI), MOPYVONEFT11M / MOPYVANEFT11M, MOPYVORTGS11M /
  MOPYVARTGS11M, MOPYVOIMPS11M / MOPYVAIMPS11M, MOPYVONACH11M, MOPYVONETC11M, MOPYVOAEPS11M,
  MOPYVOCCPS11M / MOPYVODCPS11M (cards), MOPYVOCCPO11M / MOPYVODCPO11M (PoS), MOPYVOCDTM11M /
  MOPYVACDTM11M (ATM cash), MOPYVOPPIS11M, MOPYVOCHEQ11M, MOPYVOATMS11M, MOPYVOPOST11M,
  MOPYVOMATM11M, MOPYVOUPQR11M, MOPYVOCCOS11M / MOPYVODCOS11M (cards outstanding).

## Mistakes and fixes this session

- A first `generate.mjs payments --dry` was not the dry-run flag (`--dry-run`) and made real
  API calls; the drafts were discarded and regenerated after the facts sheet was fixed.
- A headline.js and og.mjs edit swallowed two newlines and broke one build; fixed before commit.

## Follow-up: the credit fixes (2026-10-10, after payments merged)

Asked by the coordinator; the credit session is closed. All in the credit adapters, rebaked from
the Data Bank, credit prose regenerated and read.

- **Cheque clearances (662).** `bakeDeep` gained `siblings`: a table split across data providers
  is read provider by provider, each value column chosen by content, never by provider id. The
  count comes from the provider without DBIE's display-unit picker. Mumbai 2023-24: 15.75 crore
  cheques; national grid 2024-25: 60.95 crore, equal to the payment system table's paper line.
  validate now checks all 218 counts against `payments-cheques-centres` (report 678).
- **Clearing houses (743).** MICR, non-MICR (by managing bank) and the total, read from the
  providers named for them; STRBI strings ("1306(64+2*)$") parsed by `strbiCount`. Totals equal
  `payments-clearing-houses` (checked in validate).
- **A general display-code guard.** `isCodeColumn` drops any measure whose series are all one
  small integer at every date (the export's row order). The sweep of all 228 deep tables found no
  other such column; no all-zero totals remain.
- **Rounding (credit.mjs `r3`, credit-deep).** Amounts in ₹ lakh crore were rounded to three
  decimals (₹1,000 crore steps), so small states and categories read 0 or 0.001. Now four
  significant figures below 1. Dadra and Nagar Haveli's farm credit limit is ₹62 to ₹125 crore
  a quarter, as the RBI prints it (not a placeholder). Growth rates computed from those levels
  moved for small categories (computer software by up to 4.6 points); the latest month's figures
  changed only for loans against shares (12.24% to 12.67%).
- **PACS by state (1528).** Viability classes and "Number" rows were read as rupees and divided
  by 10^7; now counts. Dormant and defunct societies, rounded away before, are back; the classes
  add up to the number of PACS (Gujarat 2024: 9,622).
- **Bank ratios (1078).** Business and profit per employee are in rupees to March 2015 and in
  ₹ lakh from March 2016 (one clean break for every bank); both now in ₹ crore (SBI 2023-24:
  ₹34.10 crore of business, ₹26 lakh of profit per employee).
- Credit prose regenerated (the month-on-month counts moved to 36 of 43 sectors and 30 of 43
  industries); every figure checked against the facts sheet.
- `data/raw/vintages/` holds two credit-deep provenance archives from today's rebakes (the
  writer archives each superseded provenance file).
