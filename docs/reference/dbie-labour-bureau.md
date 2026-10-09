# Labour Bureau series in RBI DBIE (via the Data Bank)

Written 2026-10-10 by the prices session (lb/prices). Read through `scripts/lib/databank.mjs`
from the Data Bank's DBIE mirror (`rbi_dbie_webi_rows`); never fetched from RBI live.

## Report 699: CPI for industrial workers, All India

- One data provider (DP0, about 3,300 rows). Columns: `Index Current Month`,
  `Index Current Month (Industrial Workers)`, `Commodity Stats Desc` (General Index and six
  groups), `Dseries Description` (the base), `Time Date` (the month's last day).
- The two value columns differ only by rounding: the second is the first rounded to a whole
  number. Bake the first (it carries the published decimals: 154.4 for August 2026).
- Bases (`Dseries Description`): `CPI-1960` (General Aug 1968 to Sep 1988, Food Apr 1970 to
  Mar 1984), `CPI-1982` (Food from Apr 1983, General from Oct 1988, other groups from Jan 1995,
  all to Dec 2005), `CPI-2001` (Jan 2006 to Sep 2020; groups to Aug 2020), `CPI-2016 = 100`
  (Sep 2020 on).
- Defect: 28 rows labelled `CPI-1986-87` (scattered months 2016 to 2020, values like 1,340).
  CPI-IW has no such base; these look like CPI-AL/RL group values filed under the wrong
  series. Dropped.
- No linking factors between bases. The Labour Bureau publishes them (dearness allowance is
  carried across a rebase with them), but not in this report.

## Report 1168: CPI-IW by centre

- Four data providers. **DP0 ("Centre")** is the one to read: it names the centres
  (`Centre Description`) and carries every base. DP3 ("State") has the same rows without
  centre names; DP9 is the 2016 base alone; DP8 is the centre list.
- 88 centres plus ALL INDIA on base 2016; 78 on 2001; 78 on 1982; ALL INDIA only on 1960.
- Defects: the ALL INDIA row for September 2023 repeats August's 139.2 (report 699 and the
  Bureau's release: 137.5); a few 2001-base centre rows are dated before the base began
  (Kanpur from 1991): dropped.

## Report 664: Wage Rates in Rural India

- One data provider, about 137,600 rows: `Occ Code`, `Occ Description`, `State Code`,
  `State Name`, `Time Date`, `Wages In Rupees` (rupees per day).
- Two occupation lists: codes 10 to 180 (18 occupations) from April 1998 to October 2013;
  codes 1110 to 1350 (25 occupations, 12 agricultural and 13 non-agricultural) from November
  2013. Different definitions and samples: never joined.
- From April 2023 months are dated on the 23rd, not the last day. State 16 is spelled both
  ORISSA and ODISHA. 43 rows (Odisha, March 2009) repeat with the same value.
- These are men's wages: the RBI Handbook of Statistics on Indian States reprints the series
  as tables 112 to 115, "Average daily wage rates in rural India (men)".
- `ALL_IND` is the All-India row. Latest month in the mirror on 2026-10-08: April 2025.

## Checks done by hand

- CPI-IW All India, August 2026, base 2016: 154.4, up 4.96% on a year earlier: the Labour
  Bureau's press release of 30 September 2026 gives 154.4 and 4.96%.
- Rural wages, general agricultural labourer (code 1210), 2024-25 average of the monthly
  figures: Kerala 868.7, Karnataka 454.3, Assam 384.8, Bihar 362.8, Gujarat 280.8 rupees a day;
  RBI Handbook of Statistics on Indian States 2024-25, table 113, prints the same.
