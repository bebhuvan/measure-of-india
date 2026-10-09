# RBI house price index (DBIE report 688)

Read through `dbieReport(root, "688")`. Columns: City Name, Version Desc (Final/Provisional),
Version Sk, Dseries Description (the base: `HPI-Q4:2008-09`, `HPI-Q1:2010-11`, `HPI-Q1:2022-23`),
City Code, Index Value, Time Fis Quarter Year, Time Date (quarter end). One value per row, no unit
repetition. City indices only; the all-India composites reach us through BIS (WS_DPP).

- Bases: 9 cities 2009 Q1 to 2013 Q1; 10 cities 2010 Q2 to 2025 Q1; 18 cities from 2022 Q2. Each is its own bundle; seams registered in `sources.yml`.
- Final and Provisional both appear for many quarters. Usually equal, but not always: Chandigarh Jul-Sep 2025 provisional 109.0, final 128.3; Nagpur 112.7 vs 135.7; Chennai 144.4 vs 152.2; Mumbai Jan-Mar 2026 106.2 vs 108.2. Final wins; quarters with only a provisional value are listed per series (`provisional`).
- Every city averages 100 over its base year (validate, worst 0.11).
- City indices swing with the mix of sales: Kolkata rose ~50% from late 2023 to mid-2025 and fell back within a year.
- Hand check: all-India (18 cities, via BIS) Jan-Mar 2026 115.85 against 115.9 in the RBI press release of 29 May 2026.
