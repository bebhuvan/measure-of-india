# Women and Men in India on eSankhyiki

Learned 2026-10-10 (health-gender session). Adapter: `scripts/lib/products/gender.mjs`.

## Calls

- `gender/getGenderIndicatorList`: 154 indicators, codes 1 to 177 with gaps.
- `gender/getGenderFilterByIndicatorId`: each indicator's dimensions and their codes.
- `gender/getGenderRecords?indicator_code=N&page=&limit=100`: rows keyed on `year`, `state/UT` and the
  indicator's own dimensions, with `value` and `unit`. About 35,000 rows; one full fetch is about 600
  requests through `scripts/lib/mospi.mjs`.
- MoSPI's MCP server definitions (`github.com/nso-india/esankhyiki-mcp`, `definitions/gender_definitions.json`)
  list 12 more codes (32-39, 75, 76, 139, 148) that the records call answers "No Data Found" (2026-10-10).
  The catalogue adds them so the ledger records them as `blocked`.

## Quirks

- The year field mixes everything: `1951`, `2019-21` (an SRS window), `2017-18` (a school or PLFS year),
  `C.Y. 2022 (P)`, `NSS 64th round : 2007-08`, `Jul-Dec 2018`, `as on 31.03.2025`, `as of March 31 2021`,
  `FY26TD till Oct'25`, `at the end of November 2025`, `-` (table 126's All India row). `periodOf` in the
  adapter parses each; windows are dated at their middle year and labelled as printed.
- Units are often `-`: set per table in the adapter (`T`). Tables mixing counts and shares in one cut
  (ASUSE ownership, judges) get the unit in the series key.
- Values: Indian digit grouping (`7,75,947`), `-` (no observation), `NR` (not reported).
- Instruments joined in one column, split into separate bundles: census and NSS 2017-18 literacy (55, 58);
  PLFS agricultural years, original-design calendar years and the 2025 revamped design (72, 80, 83, 85,
  91, 93); ESAG and UDISE+ (62); NFHS rounds (22-28, 50-52, 138, 143, 146, 147).
- "Elected(%)- Female" in table 124 is women's success rate as candidates, not their share of seats.
- Source agencies are not in the API; they come from the compendium PDF's table notes
  (`Women & Men in India 2025, Complete publication`, mospi.gov.in).

## IDH

Checked 2026-10-10: the Data Bank's `india_data_hub_series` has no health, demographic or crime
category. Its "Capital Markets / Demat Accounts" series (30) were not paired with `gender-t115`
(CDSL demat accounts by sex); a pairing would need the IDH series definitions checked first.
