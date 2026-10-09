# states: state economies

Session `atlas-states`, branch `lb/states`, preview port 4405. Brief: `docs/briefs/states.md`.

## Done
- Read the briefs, contracts, design and skills.
- Probed MoSPI NAS regional account (account_code 2): 12 indicators, 23 to 34. 32 (per-capita
  NSDP) is served but missing from the indicator list.
- Surveyed all 182 RBI Handbook of States reports in the Data Bank mirror.

## Next
- Adapter `scripts/lib/products/states.mjs`, catalogue, bundles, validate, ledger.
- The guide, gates, prose, look at it, status.

## Decisions
- **J&K is two series.** RBI's Table 19 footnote: J&K figures for 2011-12 to 2018-19 cover J&K
  and Ladakh; 2019-20 on cover the UT of J&K only. MoSPI's J&K row is the same series. We split
  it at 2019-20 (`jammu_kashmir_state`, `jammu_kashmir_ut`) and never compute growth across it.
  2019-20 itself straddles the change (31 Oct 2019); disclosed.
- **Andhra Pradesh.** MoSPI and the Handbook's 2011-12-base SDP tables carry Andhra Pradesh and
  Telangana separately from 2011-12 (the states' own figures for today's territories). Other
  Handbook tables (state finances etc.) carry undivided AP under the same code until Telangana
  appears in 2014-15: those years become `andhra_pradesh_undivided`, never joined.
- **Four states have no published GSDP indicator.** MoSPI's GSDP, NSDP and growth indicators
  (23 to 28) serve 30 states; Assam, Haryana, Nagaland and Ladakh are absent, though their GSVA,
  taxes, subsidies and per-capita figures (29 to 34) are served. GSDP = GSVA + taxes on
  products - subsidies holds to rounding for all 30 (checked); for the four we bake GSDP from
  those published parts, flagged `derived` on the series and in its label.
- Growth is computed from constant-price levels (two decimals); MoSPI's one-decimal growth
  indicators are kept as a cross-check (validate).

## Source quirks
- MoSPI state GSDP/NSDP are in ₹ crore, GSVA/taxes in ₹ lakh, per capita in ₹.
- No revision field on state rows: each year is the state's latest estimate, and we cannot
  tell which years are advance or provisional for which state.
- RBI Handbook amounts are served in rupees; the Handbook (2025 edition) lags MoSPI by a
  vintage, so values differ slightly in recent years (AP 2023-24 GSDP: MoSPI ₹14,23,900 cr,
  Handbook ₹14,22,094 cr).

## Blocked
- Nothing yet.
