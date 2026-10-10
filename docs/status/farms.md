# Status: farms (`lb/farms`)

A new guide, `/guides/farms/`: what India grows, where, how much a hectare gives, the support
prices, and the grain the state buys and stores. RBI DBIE, agriculture ministry and food
ministry data. Updated 2026-10-10.

## Done

- **Adapter** `scripts/lib/products/farms.mjs` (product `farms`, sources.yml dossier `farms`).
  Data Bank: reports 623, 624, 625, 886, 887 (output, area, yield), 459, 460 (index numbers),
  461, 462 (MSP), 463 (land use, inputs), 464 (procurement, off-take, stocks), 465 (state output).
  RBI Hub: report 190's commercial-crop area through its SDMX twin AREA_UNDER_CULT_RN (full
  precision; 190 prints whole lakh hectares), the Handbook's printed grids of every report (for
  footnotes and the cross-check) and AGG_STAT_IS_RN (fertiliser per hectare by state).
  Raw dump: `data/raw/farms-dbie.json.gz` (585 KB).
- **Cross-check**: every Data Bank cell against RBI's printed Handbook cell at its printed
  precision: 16,840 cells, all equal. SDMX areas against 190 (699) and 625 (456), all equal.
  The adapter fails the bake if more than 0.2% of a table disagrees.
- **14 bundles**: farms-production, -area, -yield (final estimates, 1950-51 to 2024-25);
  farms-advance (2025-26, third advance estimates); farms-index-1982, -1994, -2008; farms-msp
  (1975-76 to 2026-27); farms-landuse; farms-pds (1972-73 to 2025-26); farms-pds-latest (stocks
  on 31 May 2026); farms-states-production (1980-81 to 2021-22; All India from 1950-51) and
  -advance (2022-23); farms-states-fertiliser (2004-05 to 2020-21).
- **validate.mjs**: ranges, cereals = rice + wheat + coarse; foodgrains = cereals + pulses (within
  0.1%); yield = output / area (within 3%); PDS totals = rice + wheat; stocks >= rice + wheat;
  gross >= net areas; state table's All India within 5% of the national table; undivided-state
  series stop at the split. Seams registered in sources.yml (6 bases).
- **Coverage**: `data/coverage/farms.yml`: 971 items, 103 shown, 411 baked, 457 excluded (each
  with a reason), 0 blocked, 0 pending.
- **Guide**: 11 sections, 19 plates, every-cut (780 series), data and downloads; registry
  (`no: "26"`), headline, spark, OG card, qc PAGES (17 value checks), 19 as-of entries, prose
  slots (facts block `cross.farms` in pipeline/facts.mjs, keyword map in series-kws.mjs).
- **Prose** generated (DeepSeek) and read against the data line by line; three rounds of brief
  fixes (FY labels, "revised twice", stock total includes coarse grain, area times yield).
- Hand-checked values: in the adapter header (rice 2024-25 vs Handbook 189; cotton 2023-24
  325.22 lakh bales; paddy MSP 2024-25 Rs 2,300, wheat 2025-26 Rs 2,585; wheat stocks 1 April
  2025, 11.8 million tonnes).

## Decisions

- **Final against advance estimates are two rulers.** The stage is read from the Handbook's
  footnote ("Data for 2025-26 are based on Third Advance Estimates") on every run; a year past
  the footnote's fails the bake. Advance years live in their own bundles and are drawn as open
  circles (seamMarks on the harvest plate).
- **Report 464's 1950-51 to 1970-71 stocks are left out**: printed at 6,680 lakh tonnes of rice
  and similar (more than the whole harvest), the same in the Handbook. Unit unreadable.
- **The part year (2026-27 to 31 May)** is its own bundle, dated 2026-05-31, never mixed with
  1 April stocks.
- **Split states** (MP, Bihar, UP before 2000-01; AP before 2015-16; J&K with Ladakh to 2018-19)
  are separate series; the J&K seam follows DBIE's state keys, not its footnote 8, which disagrees.
- **Buffer norm** 210.4 lakh tonnes for 1 April (DFPD, January 2015) is a constant on the stocks
  plate and in the facts sheet, cited to its source.
- **MSP against inflation**: CPI for agricultural labourers (prices guide's cpialrl-1986,
  read-only), crop-year average of the monthly y/y rates, 2000-01 to 2023-24. Costs of
  cultivation are not in RBI's tables: the page says "we do not know" whether margins rose.
- **Index bases keep only the years RBI prints for them** (Handbook reports 164 and 165). The
  Data Bank also holds TE 1981-82 values for 1994-95 to 2003-04 and TE 1993-94 values for 2008-09
  to 2012-13 that the Handbook does not print; the last of these falls 36% in one year with no
  drought, the mark of a mis-based row. They are left out and named in each bundle's note; the
  cell cross-check could not catch them because they have no printed cell.
- **The visual review changed three plate titles that the data did not support**: support prices
  beat farm labourers' inflation in only 11 of 24 years for paddy (8 for wheat), not "usually";
  over ten years pulses rose about as much as paddy and wheat, so the biggest rises are oilseeds
  and cotton; the monsoon plate's "less so than they used to" was dropped.
- **proseInputs** are farms-yield and farms-area only (facts.mjs refuses siblings on another
  base); the advance estimate, MSPs and stocks reach the writer through `cross.farms`.

## Read-only use of other families' bundles

states-hbs-t058 to t066 (state output 2024-25), t080, t081 (state yields); climate-cru-monthly
(June-September rainfall, the monsoon plate); cpialrl-1986 (MSP vs inflation).

## For the coordinator

- **State profiles** (`atlas-profiles`): state cuts in `farms-states-production` (keys
  `<state>__<crop>`, thousand tonnes or thousand bales, 1980-81 to 2021-22) and
  `farms-states-fertiliser` (kg per hectare, 2004-05 to 2020-21). The fresher state crop tables
  are the states family's states-hbs-t058 on.
- **Registry number**: farms took `no: "26"` (the test wants sequential numbers); renumber at
  merge if another DBIE-wave guide takes 26.
- **docs/reference/rbihub.md** could add: code lists are served at `/api/codelists/<DSD code>`;
  Handbook grids stack several tables per tab (index numbers on three bases). Details in
  `docs/reference/dbie-agriculture.md`.
- **IDH series**: none match. Searched the Data Bank's 916 India Data Hub series (names and
  categories) for crops, MSP, procurement, stocks, sowing and fertiliser on 2026-10-10: the only
  hits are bank credit to agriculture and fertiliser companies (the credit guide's).

## Source quirks

See `docs/reference/dbie-agriculture.md`: display-unit repeats, "TONNES" that are bales or kg,
pesticides ACTUALS at 100,000 times the print, "coarse cereals" MSP = maize, two state keys per
state in 465, MSP crop years are sowing years (wheat 2025-26 sold from April 2026).

## Next

Nothing pending in this ledger. Possible later: the state-wise tables of the Handbook of
Statistics on Indian States for land use and irrigation by state (states family bundles) as a
plate; milk, eggs and fish (states-hbs-t090 to t093) as a livestock section.
