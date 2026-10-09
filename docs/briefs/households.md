# Brief: households, higher education, energy and deposits, fuller (`households`, port 4426; guides `consumption`, `aishe`, `mnre`, `deposits`)

Read `wave2.md` first. Families: `hces` (634 pending), `aishe` (225), `mnre` (121),
`deposits` (690, DBIE via the Data Bank). Inventory item 17 and the framework's list.

- HCES: the "with imputation" MPCE below All India; MPCE in rupees by category; fractiles,
  quantities, household type, social group and Gini by state; categories by state beyond the
  food share. Two survey rounds (2022-23, 2023-24): two points, never drawn as a trend.
- AISHE: universities, colleges, teachers, social-group and minority enrolment and the
  pupil-teacher ratio by state; PTR by institution type and mode.
- MNRE: wind, hydro and bio-power by state; the bio-power categories. The `climate` guide
  covers the energy mix and emissions: link.
- Deposits (BSR-2): the other owning sectors one by one; the finer household split; the
  "others" category and accounts by size band; the state, district, bank-group, metro, age
  and gender tables; the quarterly BSR-2. The credit session verified that tables 2.1-2.3
  and 2.8-2.10 add up by identity; the ownership tables (2.4-2.6) do not partition and the
  maturity tables print signed values whose meaning is not yet fixed: work the categories
  out from RBI's BSR-2 documentation before baking, and say what you found. District
  tables may be archive-sized.

Reader questions: what does a household in my state spend on food, fuel, education, health?
Who goes to college, where, taught by whom? Where is India's renewable power? Who keeps
money in banks, in which accounts, how old are they, and where?
