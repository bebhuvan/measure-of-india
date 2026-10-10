# RBI DBIE: the agriculture tables

Read 2026-10-10 for the farms guide (`scripts/lib/products/farms.mjs`). RBI reproduces the
agriculture ministry's crop statistics and the food ministry's procurement and stock figures in
DBIE (Statistics > Real Sector > Agriculture) and in the Handbook of Statistics on the Indian
Economy (Part I, Output and prices). MoSPI does not serve these tables.

## The reports

| Report | What | Data Bank | Handbook twin (RBI Hub) |
|---|---|---|---|
| 623 | Production, foodgrains (rice, wheat, coarse cereals, cereals, pulses, foodgrains), tonnes, 1950-51 on | yes | 189 |
| 624 | Production, commercial crops (10), 1950-51 on | yes | 166 |
| 625 | Area, foodgrains, hectares | yes | 167 |
| 190 / 458 | Area, commercial crops | no (fetch failed: "flow has fewer rows than the data provider rowCount") | 190 (whole lakh ha) |
| 886, 887 | Yield, kg per hectare | yes | 191, 192 |
| 459 | Index of production by crop, three bases | yes | 165 |
| 460 | Index of area, production and yield (foodgrains, non-foodgrains, all crops), three bases | yes | 164 |
| 461, 462 | Minimum support prices, Rs a quintal, crop years 1975-76 on (462 = 461's non-foodgrain rows) | yes | 194, 195 |
| 463 | Land use, irrigation, fertiliser, pesticides | yes | 278 |
| 464 | Procurement, off-take and stocks of rice and wheat | yes | 169 |
| 465 | State-wise production (HBS table 16D), 1980-81 on (All India from 1950-51) | yes | 465 |

SDMX datasets on the RBI Hub (Data Query > Real Sector > Agriculture): AGR_PROD_RN, AGR_PRODUCTIVITY_RN,
AREA_UNDER_CULT_RN, MIN_SUP_PRICE_RN, PATT_LU_UAII_RN, PDS_AGR_PROD_RN, AGR_INDEX_RN,
AGR_INDEX_MJR_CRPS_RN, AGR_PROD_ST_RN, AGG_STAT_IS_RN. All repeat the reports except:
AREA_UNDER_CULT_RN holds report 190's commercial-crop areas at full precision (hectares), plus
"other oilseeds" and RBI's total of commercial-crop area; AGG_STAT_IS_RN holds fertiliser per
hectare by state (HBS of Indian States table 94, 2004-05 to 2020-21), which no webi report carries.

## Quirks

- **Display units.** Most reports repeat each value six times (ACTUALS, THOUSANDS, LAKHS, MILLIONS,
  CRORES, BILLIONS) with the same stored number; read ACTUALS and scale yourself.
- **"Pub Unit Desc" lies for some crops.** It says TONNES throughout report 624, but ACTUALS is
  bales for cotton (170 kg) and jute and mesta (180 kg) and kg for tea and coffee (the Handbook's
  footnotes say so). Report 463's pesticide ACTUALS is the printed '000 tonnes times 100,000.
  Report 463 says TONNES for land areas, which are hectares.
- **Advance estimates are flagged only in the Handbook's footnotes** ("Data for 2025-26 are based
  on Third Advance Estimates"), never in the webi rows. The adapter reads the footnote from the
  Hub's grid each run and fails if a report runs past the year it names.
- **Report 464's early stocks** (1950-51 to 1970-71) are printed at 6,680 lakh tonnes of rice and
  the like; the Handbook prints them the same way. Unit unreadable; left out. 1971-72 is absent.
  Its latest year is a part year; footnotes date it ("Stock for 2026-27 relates to position as on
  May 31, 2026"; "Off-take 2026-27 relates to April-May 2026").
- **MSP "Coarse cereals"** is the maize price (the Handbook heads the column Maize). Wheat's crop
  year is the sowing year: wheat 2025-26 is the price for the crop marketed from April 2026.
- **Report 465 keys each state twice** (State Sk): one key for 1980-81 to 2021-22 and another for
  2022-23 (the advance year); no value conflicts. Jammu and Kashmir has three keys (83: with Ladakh
  to 2018-19; 21: 2019-20 and 2020-21; 57: empty). The footnote's own dates for the J&K split
  (2002-03 to 2019-20 undivided) disagree with the keys; the keys are followed.
- **The Hub's Handbook grids stack several tables in one tab** (index numbers on three bases, one
  after another), each with its own unit line and column-number row. Parse per block.
- **SDMX code lists** are served at `/api/codelists/<DSD code>` (for example
  `/api/codelists/AGG_STAT_IS_RN`), not by code-list name. State codes include old names
  (UTTA = Uttaranchal, ORI = Orissa, DADI = Daman and Diu).

## Cross-check (2026-10-10)

Every Data Bank cell against the Handbook's printed cell at its printed precision: 623, 624, 625,
886, 887, 459/460, 461, 463, 464 and 465 (16,840 cells), all equal; the SDMX commercial areas
against report 190's whole lakh hectares (699 cells) and its foodgrain areas against report 625
(456 cells), all equal. The summary is in `data/raw/farms-dbie.json.gz` (`crosscheck`).
