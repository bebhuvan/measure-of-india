# MoSPI NAS regional accounts and the RBI Handbook of States: what we learned

Written 2026-10-09 by the states session, from live probes and the first bake.
Adapter: `scripts/lib/products/states.mjs`.

## MoSPI eSankhyiki, `nas/getNASData`, regional account

- Parameters: `base_year=2011-12`, `series=Current`, `frequency_code=1` (annual),
  `account_code=2` (regional), `indicator_code`, paged at 100.
- `nas/getNasIndicatorList?account_code=2` lists 23 to 31, 33, 34. **32 (per-capita NSDP)
  is served but not listed.** Codes 35 and up answer HTTP 500 after long retries: probe
  only 23 to 34.
- No filter endpoint for NAS (`getNasFilterByIndicatorId` and kin answer HTTP 400).
- Rows: `year, state, current_price, constant_price, unit`; 29 and 30 add `industry` and
  `subindustry` (11 industries, 13 sub-industries, a "Total" row). **No revision label**:
  each year is the state's latest estimate.
- Units: 23, 24 in ₹ crore; 25, 31, 32 in ₹; 29, 30, 33, 34 in ₹ lakh; 26 to 28 in % at one
  decimal.
- Coverage: 23 to 28 serve **30** states (no Assam, Haryana, Nagaland, Ladakh); 29 to 34
  serve 34. Ladakh: current prices only, 2022-23 and 2023-24.
- Identity: GSDP = GSVA + taxes on products − subsidies holds to under ₹1 crore for every
  state-year served (and NSDP with NSVA).
- **Defects (2026-10-09):** Karnataka's NSVA (30) repeats its GSVA at current prices, current
  equal to constant on every row; Karnataka's 32 repeats its 31 (per-capita GSDP). Indicator
  25 for Karnataka is right and matches the RBI Handbook. Mizoram's taxes and subsidies (33,
  34) are equal at current and constant prices in 9 of 13 years; consistent with its
  published GSDP, kept as published.
- 30 (NSVA): the total row is labelled "Total Gross State Value Added"; it is the NSVA total.
- Jammu & Kashmir: one row name; 2011-12 to 2018-19 cover J&K and Ladakh, 2019-20 on the UT
  of J&K (RBI Handbook Table 19 footnote, same NSO figures).

## RBI Handbook of Statistics on Indian States (DBIE, via the Data Bank mirror)

- 182 reports in the DBIE menu "Handbook of Statistics on Indian States", ids 1557 to 1741,
  182 distinct table numbers (the brief's "159 distinct tables" did not hold on this mirror).
- Each report's data provider is named "Main", "MAIN" or "Query 1"; the others are SAP unit
  and display pickers (`databank.mjs dbieReport()` picks the largest provider, which for
  report 1651 is the display list: read the named provider instead).
- Long format: `State Name`, `State Code`, a period column (`Time Fis Year`, else `Time Date`,
  else `Time Cal Year`), value columns named `Decitemvalue*`, `Value`, `Actual`, `Budget`,
  `Revised` and similar, and dimension columns (`Dseries Description` for the base,
  `Item Hierarchy Level 1/2`, `Item Description`, `Vunitdescription`). No display-unit
  duplication (unlike most DBIE reports).
- Rupee amounts are in rupees whatever `Vunitdescription` says.
- The SDP tables carry two bases in one report (`Base: 2004-05`, `Base: 2011-12`): split.
- Undivided Andhra Pradesh sits under code 80 (today's Andhra Pradesh) in tables that run
  before 2014-15 without Telangana: split.
- Kerala is "Keralam".
- **Defect:** Table 176 (outstanding liabilities), end-March 2015, Delhi, Puducherry,
  Tripura, Uttarakhand: 5 to 10 times the years either side.
- Against MoSPI: the SDP tables equal MoSPI to 2020-21 within 0.012%; later years carry an
  older round of state revisions (up to 18% apart for Goa).

## India Data Hub

No state domestic product series in the Data Bank's `india_data_hub_series` (checked
2026-10-09: no series name containing "state domestic", GSDP, NSDP or GSVA).
