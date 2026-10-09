# RBI rates sources, as read through the Data Bank (2026-10)

What the rates adapter (`scripts/lib/products/rbirates.mjs`) learned about its sources. All
reads are local and read-only: the Data Bank's parsed `rbi` datasets and its DBIE webi mirror.

## Parsed datasets (`databankQuery`)

- The query view unions every parse run, and each parse rebuilds the whole dataset. Read the
  newest parse file only (`read_parquet` on it, through the CLI) and list keys that only older
  runs carry (the adapter warns: gsec 11 keys, sdl 6, all footnote-mark renames).
- `rbi_policy_rates`: one row per change; the Handbook's later editions restate a few dates
  (nine listed in `rates-policy` meta). Repo and reverse repo already use post-2004 naming.
  CRR before 1962 is text ("5% of DL, 2% of TL"), value null.
- `rbi_mpc_meetings`: the 7 October 2026 meeting failed the Data Bank's audit only because its
  stance classifier missed "change the stance to calibrated tightening"; everything else passed
  and `rbi_policy_rates` (which passed) carries the same decision. The adapter classifies the
  stance from the sentence when, and only when, it names one stance verbatim. Chair is null
  until the minutes. The resolution text itself states the vote ("voted unanimously").
- `rbi_mpc_votes`: votes are on the repo resolution only; preferred sizes appear for five
  meetings. Roles come from DBIE report 1491 (names differ by middle initials).
- `rbi_lending_deposit_rates`: the newest monthly release repeats all history. Fresh WADTDR has
  March 2020 then monthly from January 2021 (9 interior gaps, declared).
- Auctions (from April 2019): used as cross-checks of the DBIE tables. T-bill cut-off yields
  match on every common auction. G-sec notified totals match on 332 of 349 days; the 17 that
  differ are all in 2019-20 layouts (press-release parse reads, e.g., 3,000 where DBIE and the
  accepted amounts say 2,000): worth a look in the Data Bank's 2019 G-sec parser.

## DBIE webi reports (`dbieReport`, plus a provider-level reader)

- Most reports repeat each row once per display unit; keep ACTUALS (values are identical).
- Report 10 (WSS Table 4) keeps its rates in data provider DP6, not the largest provider.
- Report 282 has two layouts (DP0 old, DP1 new); DP1 is read.
- Report 611 prints a day once per forward-ledger date around weekends; keep the row whose
  ledger date equals the report date. Its LAF lines are left to report 8.
- Report 1211 prints several auctions a day, numbered by `data_period_flag`; amounts are summed,
  cut-off rates weighted by amount accepted. Cut-off rates are stored x1e7 until August 2023.
- T-bill weighted average prices are stored x1e7 from September 2010; prices/yields of 0 mean
  nothing was accepted. 2026-06-17 prints lakh-crore devolvements (impossible; left empty).
- Report 38 labels state rows with the central government's item names from May 2023.
- Report 1213 spells states about 110 ways; a fixed alias table maps them (state totals agree
  with the press-release parse on 232 of 232 state-years).
- Negative printed tenors (report 267) and one negative CD rate (1996) are left empty.
- Money-market rates printed as 0 on no-deal days are left empty.
- Selection rule for the coverage catalogue: see the comment above `catalogueRbiRates`.
