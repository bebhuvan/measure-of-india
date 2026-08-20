# esankhyiki — Explore by Theme: Data Categories & API Endpoints

Source: [esankhyiki.mospi.gov.in](https://esankhyiki.mospi.gov.in/) (MoSPI data platform).

## API base URL

- Live/working API base: `https://api.mospi.gov.in/api/`
- The SPA bundle references `https://api.mospi.gov.in/api/esankhyiki/` (that prefix serves the
  site's SPA catch-all; the functional base that returns JSON is `.../api/`).
- Product metadata: `GET /esankhyiki/cms/getDashBoardData`, `GET /esankhyiki/cms/getMetaData`,
  `GET /esankhyiki/cms/getMetaDataByProduct?product_id=`
- OpenAPI/swagger: [https://esankhyiki.mospi.gov.in/EC/swagger-ui/index.html](https://esankhyiki.mospi.gov.in/EC/swagger-ui/index.html)

Notes:
- All requests are `GET`, JSON responses (except `cpi/getInflation` and the
  `cms/golden-sheet/*` endpoints, which the SPA calls via POST).
- Required parameters are shown for each endpoint. `indicator_code` values come from the
  `...IndicatorList` responses (metadata) listed below.

## Complete endpoint catalog

Extracted from the eSankhyiki SPA bundle (`main.89271b59.js` + 90 lazy chunks)
on 2026-08-04. ✓ = live-probed and returning data. Product prefixes are URL
paths under the API base; `macroindicators?product=<x>` is an SPA route, not
an API endpoint — each product has real API paths listed here.

| Product | Endpoints |
|---|---|
| cpi | `getCpiBaseYear` ✓, `getCpiFilterByLevelAndBaseYear` ✓, `getCPIData` ✓, `getDownloadCPIRecords`, `getInflation` (POST; SPA posts to an internal IP — unusable) |
| wpi | `getWpiBaseYear` ✓, `getWpiData` (filter metadata only), `getWpiRecords` ✓, `getDownloadRecords` |
| iip | `getIipBaseYear` ✓, `getIipFilter` ✓ (needs base_year+frequency), `getIIPData`, `getDownloadIIPRecords` |
| nas | `getNasIndicatorList` ✓, `getNasFilterByIndicatorId`, `getNasAccountTypeList`, `getNASData` ✓, `getDownloadNasRecords` |
| plfs | `getIndicatorList` ✓, `getIndicatorListByFrequency`, `getFrequency` ✓, `getFilterByIndicatorId`, `getData`, `getDownloadRecords` |
| rbi | `getRbiIndicatorList` ✓, `getRbiMetaData` ✓ (sub-indicators + dimension values per indicator), `getRbiRecords` |
| isp | `getISPFilter` ✓, `getISPRecords` ✓ (monthly, base 2024-25) |
| cpialrl | `getCpialrlIndicatorList`, `getCpialrlFilterByIndicatorId`, `getCpialrlRecords`, `getDownloadCpialrlRecords` |
| energy | `getEnergyIndicatorList`, `getEnergyFilterByIndicatorId`, `getEnergyRecords`, `getDownloadEnergyRecords` |
| mnre | `getTypeOfRenewableEnergy`, `getFilterByEnergy`, `getDataByEnergy` |
| asi | `getNicClassificationYear`, `getAsiFilter`, `getASIData`, `getDownloadASIRecords` |
| asuse | `getAsuseFrequencyList`, `getAsuseIndicatorList`, `getAsuseIndicatorListByFrequency`, `getAsuseFilterByIndicatorId`, `getAsuseRecords`, `getDownloadAsuseRecords` |
| hces | `getHcesIndicatorList`, `getHcesFilterByIndicatorId`, `getHcesRecords`, `getDownloadHcesRecords` |
| udise | `getIndicatorList`, `getUdiseFilterByIndicatorId`, `getUdiseRecords` |
| gender | `getGenderIndicatorList`, `getGenderFilterByIndicatorId`, `getGenderRecords`, `getDownloadGenderRecords` |
| env | `getEnvStatsIndicatorList`, `getEnvStatsFilterByIndicatorId`, `getEnvStatsRecords` |
| aishe | `getAisheIndicatorList`, `getAisheFilterByIndicatorId`, `getAisheRecords` |
| nfhs | `getNfhsIndicatorList`, `getnfhsFilterByIndicatorId`, `getNfhsRecords` |
| tus | `getTusIndicatorList`, `getTusFilterByIndicatorId`, `getTusRecords`, `getDownloadTusRecords` |
| nss-73 | `getNss73IndicatorList`, `getNss73FiltersByIndicatorCode`, `getNss73Records`, `getNss73Download` |
| nss-75 | `getSurveyList`, `getIndicatorList`, `getNss75FilterByIndicatorId`, `getNss75Records` |
| nss-76 | `getSurveyList`, `getIndicatorList`, `getNss76FilterByIndicatorId`, `getNss76Records` |
| nss-77 | `getIndicatorList`, `getFilterByIndicatorId`, `getNss77Records`; AIDIS: `getNss77AidisSurveyList`, `getNss77AidisIndicatorList`, `getNss77AidisFiltersByIndicatorCode`, `getNss77AidisRecords`, `getNss77AidisDownload` |
| nss-78 | `getIndicatorList`, `getFilterByIndicatorId`, `getNss78Records`, `getDownloadRecords` |
| nss-79 | `getNSS79SurveyList`, `getnss79IndicatorList`/`getNSS79IndicatorList`, `getNSS79FilterByIndicatorId`, `getNSS79Records` |
| nss-80 | `getSurvey`, `getIndicatorList`, `getFilterBySurveryAndIndicator` (sic), `getSubIndicatorByIndicatorIdAndSurvey`, `getNss80Records` |
| ec4/5/6 | `macroindicators?product=ec4|ec5|ec6` (no record API; note dashboard maps 5th EC→ec6, 6th EC→ec5) |
| esankhyiki/cms | `getDashBoardData` ✓, `getMetaData`, `getMetaDataByProduct`, `getInfographicsForDashboard`, `golden-sheet/list`, `golden-sheet/products`, `golden-sheet/distinct-products`, `golden-sheet/mappings` (POST) |
| users | `getTotalVisits` |

Every product also has a `getDownload*` bulk-records endpoint — likely the
fastest way to archive full raw dumps for `data/raw/` (unprobed).


## Prices Statistics

### Consumer Price Index (CPI)

- `cpi/getCpiBaseYear` — Base years / levels / series (params: none)

**Metadata keys:** `base_year`, `level`, `series`

### CPI for Agricultural Labourers & Rural Labourers (CPI-AL/RL)

- `cpialrl/getCpialrlIndicatorList` — Indicator list (params: none)
- `cpialrl/getCpialrlFilterByIndicatorId` — Filters by indicator (params: indicator_code)
- `cpialrl/getCpialrlRecords` — Records (params: indicator_code, ...)

**Indicators (2):**
  - `1` — General Index
  - `2` — Group Index

### Wholesale Price Index (WPI)

- `wpi/getWpiBaseYear` — Base years (params: none)
- `wpi/getWpiData` — Filter metadata (years, months, major groups, groups…)
- `wpi/getWpiRecords` ✓ — Records (params: base_year, major_group_code, year, page, limit≤500).
  Aggregate rows have `group/subgroup/item == null`; headline = major_group_code `1000000000`.
  ~147k item-level records total, Apr 2012–present.
- `wpi/getDownloadRecords` — Bulk download (unprobed)

**Base years:** 2011-12, 2004-05, 1993-94
**Major groups:** `1000000000` Headline · `1100000000` Primary articles ·
`1200000000` Fuel & power · `1300000000` Manufactured products · `2000000000` Food index


## Industrial Statistics

### Index of Industrial Production (IIP)

- `iip/getIipBaseYear` ✓ — Base years / frequency (params: none).
  Base years: **2022-23** (new), 2011-12, 2004-05, 1993-94. Frequencies: Monthly, Annually.
- `iip/getIipFilter` ✓ — Filter dimensions (params: base_year, frequency — both required)
- `iip/getIIPData` — Records (unprobed)
- `iip/getDownloadIIPRecords` — Bulk download (unprobed)

### Annual Survey of Industries (ASI)

- `asi/getNicClassificationYear` — NIC classification years (params: none)
- `asi/getAsiFilter` — Filters (params: classification_year)

**Indicators (4):**
  - {"classification_year": 2008, "viz": "line,hbar,vbar,map"}
  - {"classification_year": 2004, "viz": "line,hbar,vbar,map"}
  - {"classification_year": 1998, "viz": "line,hbar,vbar,map"}
  - {"classification_year": 1987, "viz": "line,hbar,vbar,map"}


## National Accounts Statistics

### National Accounts Statistics (NAS)

- `nas/getNasIndicatorList` — Indicator list (params: account_code)

**Indicators (22):**
  - `1` — Gross Value Added
  - `2` — Net Taxes on Products
  - `3` — Taxes on Products
  - `4` — Subsidies on Products
  - `5` — Gross Domestic Product
  - `6` — Consumption of Fixed Capital
  - `7` — Net Domestic Product
  - `8` — Gross Capital Formation by Industry of Use
  - `9` — Gross Fixed Capital Formation
  - `10` — Private Final Consumption Expenditure
  - `11` — Government Final Consumption Expenditure
  - `12` — Change in Stock
  - `13` — Valuables
  - `14` — Export of Goods and Services
  - `15` — Import of Goods and Services
  - `16` — Primary Income Receivable Net From Row
  - `17` — Gross National Income
  - `18` — Other Current Transfers Net From Row
  - `19` — Gross National Disposable Income
  - `20` — Gross Saving
  - `21` — GVA Growth Rate
  - `22` — GDP Growth Rate


## Labour Statistics

### Periodic Labour Force Survey (PLFS)

- `plfs/getIndicatorList` ✓ — Indicator list (params: viz_status)
- `plfs/getIndicatorListByFrequency` — Indicator list by frequency (params: none)
- `plfs/getFrequency` ✓ — Frequencies: 1 Annually, 2 Quarterly, 3 Monthly
- `plfs/getFilterByIndicatorId` — Filter dimensions (params: indicator_code)
- `plfs/getData` — Records (unprobed)
- `plfs/getDownloadRecords` — Bulk download (unprobed)

**Indicators (3):**
  - `1` — LFPR (Labour Force Participation Rate, in per cent)
  - `2` — WPR (Worker Population Ratio, in per cent)
  - `3` — UR (Unemployment Rate, in per cent)


## Economic Census

### 4th / 5th / 6th Economic Census

- `macroindicators?product=ec4|ec5|ec6` — E-Census data (params: none)


## National Sample Surveys

### Unincorporated Non-Agricultural Enterprises (NSS 73)

- `nss-73/getNss73IndicatorList` — Indicator list (params: viz_status)

### Household Social Consumption: Education (NSS 75)

- `nss-75/getSurveyList` — Survey list (params: none)
- `nss-75/getIndicatorList` — Indicator list (params: none)
- `nss-75/getNss75FilterByIndicatorId` — Filters (params: indicator_code)
- `nss-75/getNss75Records` — Records (params: indicator_code, ...)

**Indicators (55):**
  - `1` — Hospitalisation cases (excluding childbirth) per 100,000 persons during the last 365 days by age-group
  - `2` — Hospitalisation cases (excluding childbirth) per 100,000 persons of different social groups during the last 365 days
  - `3` — Cases of hospitalisation (excluding childbirth) reported per 100,000 persons during the last 365 days by broad ailment category
  - `4` — Percentage distribution of hospitalised cases (excluding childbirth) over detailed ailment types during last 365 days
  - `5` — Percentage distribution of hospitalised cases (excluding childbirth) over broad ailment categories for different age groups
  - `6` — Percentage distribution of hospitalised cases (excluding childbirth) by type of medical institution for each broad ailment type
  - `7` — Percentage distribution of hospitalisation cases(excluding childbirth) during the last 365 days by type of ward for each type of medical institution and, for each state/UT
  - `8` — Percentage distribution of hospitalisation cases (excluding childbirth) during last 365 days by nature of treatment received during hospitalisation, for each quintile class of household expenditure
  - `9` — Percentage distribution of hospitalisation cases (excluding childbirth) during last 365 days by nature of treatment received during hospitalisation, for each state/UT
  - `10` — Average medical expenditure for treatment per hospitalisation (excluding childbirth) case during stay at hospital (as inpatient) over last 365 days by quintile class of household expenditure
  - `11` — Average total medical expenditure per hospitalisation case (excluding childbirth) for treatment during stay at hospital (as inpatient) in last 365 days by type of hospital, broad nature of ailment
  - `12` — Average medical expenditure for treatment per hospitalisation (excluding childbirth) case during stay at hospital (as inpatient) over last 365 days by social group
  - `13` — Average medical expenditure and non-medical expenditure on account of hospitalisation per hospitalisation case (excluding childbirth) for each quintile class of household expenditure during last 365 days
  - `14` — Average medical expenditure and non-medical expenditure (in Rs.) on account of hospitalisation per hospitalisation case (excluding childbirth) for each State/UT during last 365 days
  - `15` — Average medical expenditure (Rs.) per hospitalisation case (excluding childbirth) during last 365 days and its break-up by category of expenditure separately for each State/UT
  - `16` — Average out-of-pocket medical expenditure (OOPME)for treatment per hospitalisation (excluding childbirth) case during stay at hospital (as inpatient) over last 365 days by quintile class of household expenditure
  - `17` — Average out-of-pocket medical expenditure (OOPME) per hospitalisation case (excluding childbirth) for treatment during stay at hospital (as inpatient) in last 365 days by type of hospital for each state/UT
  - `18` — Number per 1000 persons reporting ailments (PAP) during last 15 days by gender and age-group
  - `19` — Number of ailments reported Per 100000 persons during the last 15 days for each ailment type
  - `20` — Number of ailments of each broad ailment category reported per 100000 persons during the last 15 days by age-group
  - `21` — Percentage distribution of spells of ailment over broad ailment categories for different age groups during last 15 days
  - `22` — Number of persons per 1,00,000 reporting onset of ailments during last 15 days and average duration of ailment by gender and broad ailment category separately for chronic and non-chronic ailments
  - `23` — Average medical expenditure and non-medical expenditure (in Rs.) for treatment per ailing person during a period of last 15 days for each state/UT
  - `24` — Average medical expenditure and non-medical expenditure for treatment per treated spell of ailment during a period of last 15 days for each quintile class of household expenditure
  - `25` — Average medical expenditure for (non-hospitalised) treatment per treated spell of ailment during last 15 days by level of care for each broad nature of ailment
  - `26` — Average medical expenditure for (non-hospitalised) treatment per treated spell of ailment during last 15 days by level of care  for each quintile class of household expenditure
  - `27` — Average medical expenditure for (non-hospitalised) treatments per spell of treated ailment during last 15 days by nature of treatment, for each State/UT
  - `28` — Average medical expenditure for (non-hospitalised) treatments per treated spell of ailment during last 15 days by nature of treatment, for each quintile class of household expenditure
  - `29` — Average out-of-pocket medical expenditure for (non-hospitalised) treatment per treated spell of ailment during last 15 days by level of care  for each state/UT
  - `30` — Percentage distribution of aged persons by state of economic independence for each State/UT
  - … and 25 more

### Drinking Water, Sanitation, Hygiene & Housing (NSS 76)

- `nss-76/getIndicatorList` — Indicator list (params: survey_code)

**Indicators (13):**
  - `3` — Literacy rate (in per cent) of persons of age 7 years and above with disability
  - `11` — Percentage distribution of persons with disability by arrangement of regular care giver
  - `13` — Percentage distribution of persons with disability by receipt of aid/help
  - `4` — Percentage of persons of age 15 years and above with disability having highest level of completed education secondary and above
  - `2` — Percentage of persons with broad type of disability
  - `1` — Percentage of persons with disability
  - `7` — Percentage of persons with disability by status of treatment taken for different broad type of disability
  - `6` — Percentage of persons with disability having disability not since birth
  - `5` — Percentage of persons with disability having disability since birth
  - `12` — Percentage of persons with disability who used/ accessed public transport during last 365 days, accessed public building during last 365 days and problems faced in accessing/using publictransport/public building
  - `10` — Percentage of persons with hearing disability who were advised aid/appliances and acquired aid/appliances
  - `8` — Percentage of persons with locomotor disability who were advised aid/appliances and acquired aid/appliances
  - `9` — Percentage of persons with visual disability who were advised aid/appliances and acquired aid/appliances

### Persons with Disabilities (NSS 76)

- `nss-76/getIndicatorList` — Indicator list (params: survey_code)

### Situation Assessment of Agri. Households (NSS 77)

- `nss-77/getIndicatorList` — Indicator list (params: viz_status)
- `nss-77/getNss77AidisIndicatorList` — AIDIS indicator list (params: survey_code)

**Indicators (33):**
  - `16` — Estimated No. of Hhs for Each Size Class (ha.) of Land Possessed
  - `17` — Estimated No. of Hhs for Different Social Groups
  - `18` — Distribution of Hhs by Hh Classification for Different Size Classes of Land Possessed
  - `19` — No. Per Hh Operational Holding by Size Class of Hh Operational Holding
  - `21` — No. Per 1000 Crop Producing Agricultural Hhs Disposals of Crop by Agency and Satisfaction Level of Sale Outcomes
  - `22` — Agricultural Hhs Reporting Use of Different Farming Resources
  - `23` — Agricultural Hhs Reporting Use of Purchased Seed by their Quality
  - `24` — Avg. Monthly Income (in Rs.) Per Agricultural Hh (only the Paid Out Expenditure)
  - `25` — Avg. Monthly Income (in Rs.) Per Agricultural Hh (both the Paid Out and Imputed Expenditure)
  - `26` — Avg. Monthly Net Expenditure on Productive Assets
  - `27` — Avg. Expenditure and Receipts on Farm and Non-farm Assets
  - `28` — Avg. Monthly Expenses and Receipts for Crop Production
  - `29` — Avg. Monthly Total Expenses for Crop Production
  - `31` — Average Monthly Total Expenses and Receipts on Animal Farming During a Period of 30 Days
  - `32` — Average Expenses and Receipts From Non-farm Business
  - `33` — Distribution of Amount of Loan Outstanding by Source of Loan Taken
  - `34` — Distribution of Hhs by Size Class of Hh Ownership Holding, Average Area of Homestead Land Owned/land Owned (excluding Homestead Land)/area Owned and Estimated Area of Hh Ownership Holding
  - `35` — Distribution of Hhs Reporting Leasing-out of Land and Average Area of such Land for Each Social Group
  - `36` — Distribution of Hhs Reporting Leasing-in of Land and Average Area of such Land for Each Social Group
  - `37` — Percentage Distribution of Leased Out Land by Terms of Lease
  - `39` — No. of Hhs Owning of Livestock of Different Types
  - `40` — Percentage Distribution of Area of Land for the Hhs Belonging of Operational Holding by Kind of Possession
  - `41` — Distribution of Operational Holdings by Type of Possession of Hh Operational Holding
  - `42` — Average Gross Cropped Area / Value of Total Crop Production / Quantity of Crop Production Reporting Crop Production
  - `43` — Distribution of Agricultural Hhs Reporting Sale of Crops and Distribution of Quantity Sold by Agency of Major Disposal
  - `44` — Distribution of Agricultural Hhs Reporting Sale of Selected Crop by Level of Satisfaction
  - `45` — Distribution of Agricultural Hhs Reporting Use of Seed by their Agency of Procurement for Selected Crops
  - `46` — Distribution of Agricultural Hhs Reporting Use of Purchased Seed by their Quality
  - `47` — Per 1000 Distribution of Agricultural Households Reporting Sale of Crops by Awareness About Msp for Selected Crops
  - `48` — Distribution of Agricultural Hhs not Insuring their Crops by Reason for Selected Crops
  - … and 3 more

### All India Debt & Investment Survey (NSS 77)

- `nss-77/getNss77AidisIndicatorList` — AIDIS indicator list (params: survey_code)

### Multiple Indicator Survey (NSS 78)

- `nss-78/getIndicatorList` — Indicator list (params: viz_status)

**Indicators (14):**
  - `2` — Access to Improved Source of Drinking Water
  - `3` — Improved Source of Drinking Water Within Household
  - `4` — Exclusive Access to Improved Latrine
  - `5` — Improved Latrine and Hand Washing Facilities Within Household
  - `6` — Usage of Mobile Phone
  - `7` — Access to Mass Media and Broadband
  - `8` — Availability of Basic Transport and Public Facility
  - `9` — Household Assets
  - `10` — Different Sources of Finance
  - `11` — Usual Place of Residence Different From Current Place
  - `12` — Main Reason for Leaving Last Usual Place of Residence
  - `13` — Income Change Due to Migration
  - `14` — Main Reason for Migration
  - `15` — Possession of Air Conditioner and Air Cooler

### Survey on AYUSH (NSS 79)

- `nss-79/getNSS79SurveyList` — Survey list (params: none)
- `nss-79/getnss79IndicatorList` — Indicator list (params: survey_code)
- `nss-79/getNSS79Records` — Records (params: indicator_code, ...)

### CAMS (NSS 79)

- `nss-79/getNSS79SurveyList` — Survey list (params: none)
- `nss-79/getnss79IndicatorList` — Indicator list (params: survey_code)
- `nss-79/getNSS79Records` — Records (params: indicator_code, ...)

### CMST (NSS 80)

- `nss-80/getSurvey` — Survey list (params: none)
- `nss-80/getIndicatorList` — Indicator list (params: none)
- `nss-80/getSubIndicatorByIndicatorIdAndSurvey` — Sub-indicators (params: indicator_id, survey)
- `nss-80/getNSS80Records` — Records (params: ...)

**Indicators (2):**
  - Comprehensive Modular Survey (Telecom)
  - Comprehensive Modular Survey (Education)

### Household Consumption Expenditure Survey (HCES)

- `hces/getHcesIndicatorList` — Indicator list (params: none)

**Indicators (9):**
  - `1` — Average monthly per capita consumption expenditure (MPCE)
  - `2` — Average monthly per capita consumption expenditure (MPCE) Over 12 Fractile Classes
  - `3` — Monthly Per Capita Consumption Expenditure (MPCE) over Broad Categories in 30 Days
  - `4` — Percentage Share of Monthly Per Capita Consumption Expenditure (MPCE) over Broad Categories in 30 Days
  - `5` — Average Per Capita Monthly Quantity Consumption 
  - `6` — Average Monthly Per Capita Value of Consumption (Rs.)
  - `7` — Average Monthly Per Capita Consumption Expenditure (MPCE) across different Household Type
  - `8` — Average Monthly Per Capita Consumption Expenditure (MPCE) across different Social Group
  - `9` — Gini Coefficient for Per Capita Consumption Expenditure

### Annual Survey of Unincorporated Sector Enterprises (ASUSE)

- `asuse/getAsuseIndicatorListByFrequency` — Indicator list (params: frequency_code)

**Indicators (35):**
  - `1` — Estimated Number of Establishments Pursuing Mixed Activities
  - `2` — State/UT-wise Estimated Number of Establishments Pursuing Mixed Activities
  - `3` — Per 1000 Distribution of Establishments by Type of Ownership
  - `4` — State/UT-wise Per 1000 Distribution of Establishments by Type of Ownership
  - `5` — Per 1000 Distribution of Proprietary and Partnership Establishments by Level of General Education of Owner-Major Partner
  - `6` — Per 1000 Distribution of Prop. & Partnership Establishments by Social Group of Owner-Major Partner
  - `7` — State/UT-wise Per 1000 Distribution of Prop. & Partnership Establishments by Social Group of Owner-Major Partner
  - `8` — Per 1000 Distribution of Prop. & Partnership Estt. by Number of Other Economic Activities
  - `9` — State/UT-wise Number Per 1000 of Establishments Maintaining any Bank Account-Post Office Savings Bank Account
  - `10` — Per 1000 Distribution of Establishments by Type of Location 
  - `11` — State/UT-wise Per 1000 Distribution of Establishments by Type of Location
  - `12` — Per 1000 Distribution of Establishments by Nature of Operation
  - `13` — State/UT-wise Per 1000 Distribution of Establishments by Nature of Operation
  - `14` — Per 1000 Distribution of Establishments by Number of Months Operated During Last 365 Days
  - `15` — State/UT-wise Per 1000 Distribution of Establishments by Number of Months Operated During Last 365 Days
  - `16` — Per 1000 Distribution of Establishments by Number of Hours Normally Worked in a Day
  - `17` — State/UT-wise Per 1000 Distribution of Establishments by Number of Hours Normally Worked in a Day
  - `19` — Number of Per 1000 of Establishments which are NPIs (by type of major receipts) and non-NPIs
  - `20` — Number Per 1000 of Establishments Using Computers and Using Internet During Last 365 Days
  - `21` — State/UT-wise Number Per 1000 of Establishments Using Computers and Using Internet During Last 365 Days
  - `22` — Number Per 1000 of Establishments Registered Under Different Acts-Authorities
  - `23` — State/UT-wise Number Per 1000 of Establishments Registered Under Different Acts-Authorities
  - `25` — State/UT-wise Estimated Number of Establishments Serving as Franchisee Outlet
  - `26` — Estimated Number of Workers by Nature of Employment and Gender
  - `27` — State/UT-wise Estimated Number of Workers by Nature of Employment and Gender
  - `28` — Estimated Number of Workers by Type of Workers
  - `29` — State/UT-wise Estimated Number of Workers by Type of Workers
  - `30` — Estimated Annual Emoluments (Rs.) Per Hired Worker
  - `31` — State/UT-wise Estimated Annual Emoluments (Rs.) Per Hired Worker
  - `32` — Estimated Annual Gross Value Added (GVA) Per Worker (Rs.)
  - … and 5 more


## Social Indicators

### UDISE+

- `udise/getIndicatorList` — Indicator list (params: none)
- `udise/getUdiseFilterByIndicatorId` — Filters (params: indicator_code)
- `udise/getUdiseRecords` — Records (params: indicator_code, ...)

**Indicators (46):**
  - `1` — Total number of School
  - `2` — Total number of Enrolments
  - `3` — Total number of Teachers
  - `4` — Percentage Share of Schools by Category
  - `5` — Percentage Share of Enrolments by level
  - `6` — Percentage Share of Teachers by School Category
  - `7` — Pupil Teacher Ratio
  - `8` — Average Teachers Per School
  - `9` — Average Enrolments Per School
  - `10` — Schools with Zero Enrolments
  - `11` — Teachers in schools having zero Enrolments
  - `12` — Schools with Single Teachers
  - `13` — Enrolments in Single Teacher Schools
  - `14` — Percentage of Schools having Enrolments across various Enrolment brackets
  - `15` — Proportion of Enrolments to Total Enrolments (Pre-Primary to Higher Secondary)
  - `16` — Number of Schools having infrastructure facility
  - `18` — Number of schools by level of school education
  - `19` — Number of schools by management and school category
  - `20` — Number of schools with having AWC or Pre-Primary Sections
  - `21` — Number of Teachers (All Management)
  - `22` — Number of teachers by management
  - `23` — Pupil Teacher Ratio by level of education
  - `24` — Number of teachers by management, gender and classes taught
  - `25` — Percentage of Trained Teachers (All Management)
  - `26` — Percentage of Professionally Qualified Teachers (All Management)
  - `28` — Enrolment of Students
  - `29` — Children With Special Needs (CWSN) enrolment
  - `30` — New admission of students in class 1 who have pre-school experience
  - `31` — Gross Enrolment Ratio (GER)
  - `32` — Net Enrolment Rate (NER)
  - … and 16 more

### Time Use Survey (TUS)

- `tus/getTusIndicatorList` — Indicator list (params: viz_status)

**Indicators (8):**
  - `35` — Percentage of persons and minutes in a day spent on an average per participant in SNA activities, Non-SNA activities and residual other activities where the activity was a major activity for each broad principal activity status (age 6 years and above) 
  - `36` — Percentage of persons and minutes spent in a day on an average per participant in SNA activities, Non-SNA activities and residual other activities irrespective of major activity for each broad principal activity status (age 6 years and above) 
  - `37` — Percentage of persons and minutes in a day spent on an average per participant of different age groups in SNA activites,Non-SNA activities and residual Residual other activities where the activity was a major activity by type of the day
  - `38` — Percentage of persons and minutes in a day spent on an average per participant of different age groups in SNA activities, Non-SNA activities and residual Residual other activities irrespective of major activity by type of the day
  - `41` — Percentage of persons and minutes spent in a day on an average per person /per participant in unpaid activities, paid activities and other activities where the activity was a major activity (age 6 years and above) 
  - `42` — Percentage of persons and minutes spent in a day on an average per person/per participant in unpaid activites, paid activites and other activities irrespective of major activity (age 6 years and above) 
  - `43` — Percentage of persons and minutes spent in a day on an average per person/per participant for each household social group in unpaid activites, paid activites and other activites where the activity was a major activity all-India(age 6 years and above) 
  - `44` — Percentage of persons and minutes spent in a day on an average per person/per participant for each household social group in unpaid activities, paid activities and other activities irrespective of major activity (age 6 years and above)

### Women and Men in India

- `gender/getGenderIndicatorList` — Indicator list (params: none)

**Indicators (147):**
  - `1` — Trend in Population
  - `2` — Sex Ratio
  - `3` — Average Annual Growth Rate of Population
  - `4` — Percentage Distribution of Projected Population
  - `5` — Sex ratio in context of developmental planning
  - `6` — State-wise Sex Ratio 
  - `7` — Sex ratio at birth for bigger States based on Sample Registration System
  - `8` — General Fertility Rate
  - `9` — Age-specific Fertility rate
  - `10` — Total Fertility Rate 
  - `11` — Percentage distribution of live births
  - `12` — Adolescent Fertility Rates
  - `13` — Age Specific Fertility Rate by level of education of women
  - `14` — Women's Mean Age at Marriage
  - `15` — Year Wise Infant Mortality Rate
  - `16` — State/UT  Wise Infant Mortality Rate
  - `17` — Under-Five Mortality Rates (U5MR)
  - `18` — Year Wise Life Expectancy at birth
  - `19` — State/UT  wise Life Expectancy at birth
  - `20` — Life Expectation at age 60
  - `21` — Maternal Mortality Ratio
  - `22` — Maternity Care Indicators
  - `23` — Percentage of Births Attended by Skilled Health Personnel
  - `24` — Percentage of married women use any modern method of family planning
  - `25` — Unmet Need for Family Planning 
  - `26` — Need for Family Planning Satisfied with Modern Methods(Proportion of Women)
  - `27` — Current tobacco use (15years or above)
  - `28` — Proportion of Adults who are Obese (BMI >= 30.0)
  - `29` — Number of new HIV infections per 1000 uninfected population
  - `30` — Number of PLHIV alive and on ART at the end of January 2025
  - … and 117 more

### AISHE

- `aishe/getAisheIndicatorList` — Indicator list (params: viz_status)

**Indicators (9):**
  - `1` — Number of Universities 
  - `2` — Number of Colleges
  - `3` — Estimated Student Enrolment 
  - `4` — Social Group-wise Enrolment
  - `5` — PWD & Minority Community-wise Enrolment
  - `6` — Social Group wise Gross Enrolment Ratio (GER)
  - `7` — Social Group wise Gender Parity Index (GPI)
  - `8` — Mode of Education wise Pupil Teacher Ratio (PTR) 
  - `9` — Number of Teachers

**Live-probed (2026-08-09).** Five survey years served: 2017-18 to 2021-22.
Rows are plain `(indicator, year, state, value)` for ind 1/2, then gain
dimensions: ind 3 adds `gender × education_level` (9 levels incl. Grand
Total); ind 4 `social_category × gender`; ind 5 `gender × social_group`;
ind 6 `social_category × gender` (SC/ST/All Categories only — **no OBC
GER**); ind 7 `social_category` only (GPI is itself a gender ratio); ind 8
`learning_mode × institution_type`; ind 9 `gender × faculty_type` (7 types
incl. "All Teacher"). State 37 = All India; rows arrive alphabetically,
All India last (beyond page 1 for the larger indicators — page through).
Social-category labels carry stray double spaces ("Scheduled  Caste").

**SOURCE DEFECT — ind 9 (teachers), 2021-22:** the "All Teacher" total row
is garbled for 2021-22 — All India prints 12,904 against ~1.55M the year
before, and every state cell is likewise a near-zero residual. The same
year's "Visiting Teacher" row carries the real total (~1.60M) instead. The
dossier reconstructs 2021-22 teachers as the sum of the five regular
faculty types (Professor & Equivalent + Reader & Associate Professor +
Lecturer/Assistant Professor + Demonstrator/Tutor + Temporary Teacher) =
1,584,784, which equals 99.0–99.2% of the published "All Teacher" total in
every clean year. Disclosed in the dossier and `data/sources.yml`.

### NFHS

- `nfhs/getNfhsIndicatorList` — Indicator list (params: none)
- `nfhs/getnfhsFilterByIndicatorId` — Filters (params: indicator_code)
- `nfhs/getNfhsRecords` — Records (params: indicator_code, ...)

**Indicators (21):**
  - `1` — Population and Household Profile
  - `2` — Characteristics of Adults (age 15-49 years)
  - `3` — Marriage and Fertility
  - `4` — Infant and Child Mortality Rates (per 1,000 live births)
  - `5` — Current Use of Family Planning Methods (currently married women age 15–49 years)
  - `6` — Unmet Need for Family Planning (currently married women age 15–49 years)
  - `7` — Quality of Family Planning Services
  - `8` — Maternity Care (for last birth in the 5 years before the survey)
  - `9` — Delivery Care (for births in the 5 years before the survey)
  - `10` — Child Vaccinations and Vitamin A Supplementation
  - `11` — Treatment of Childhood Diseases (children under age 5 years)
  - `12` — Child Feeding Practices and Nutritional Status of Children
  - `13` — Nutritional Status of Adults (age 15-49 years)
  - `14` — Anaemia among Children and Adults
  - `15` — Blood Sugar Level among Adults (age 15 years and above)
  - `16` — Hypertension among Adults (age 15 years and above)
  - `17` — Screening for Cancer among Adults (age 30-49 years)
  - `18` — Knowledge of HIV/AIDS among Adults (age 15-49 years)
  - `19` — Women's Empowerment (women age 15-49 years)
  - `20` — Gender Based Violence (age 18-49 years)
  - `21` — Tobacco Use and Alcohol Consumption among Adults (age 15 years and above)

### Environment Statistics

- `env/getEnvStatsIndicatorList` — Indicator list (params: viz_status)

**Indicators (96):**
  - `1` — Annual and Seasonal Mean Temperature
  - `2` — Annual and Seasonal Minimum and Maximum Temperature
  - `3` — Annual and Monthly Rainfall
  - `4` — Wetland distribution in India
  - `8` — Length of Coastline and Coastal Population of India
  - `10` — Category-wise distribution of land degradation in different States of India
  - `11` — Area under land use and land cover classes in India
  - `12` — State-wise area by land cover classes
  - `14` — Terrestrial Protected Areas
  - `18` — State-wise Forest Area
  - `19` — Forest Cover in India under various forest classes
  - `20` — Forest Cover
  - `21` — Number of forest fire detected
  - `22` — Carbon Stock in different forest carbon pools
  - `24` — Tree Cover
  - `26` — Ambient Air Quality in major cities
  - `27` — Water Quality in Indian Rivers
  - `28` — River Water Quality
  - `34` — Import of Ores and Minerals
  - `35` — Export of Ores and Minerals (including re-export)
  - `36` — Inventory of geological reserves of coal by type
  - `37` — Inventory of geological reserves of coal
  - `38` — Inventory of geological reserve of Lignite
  - `39` — Total Primary Supply of Coal & Lignite
  - `41` — Annual gross generation of power by source and by sector
  - `42` — Import and Export of Electricity
  - `43` — Land Use Classification
  - `44` — Net area irrigated from different sources and gross irrigated area
  - `45` — State-wise area under organic farming (Registered under accredited certification bodies)
  - `46` — Value of Output - Forestry (At Current Prices)
  - … and 66 more


## Financial Statistics

### Reserve Bank of India (RBI)

- `rbi/getRbiIndicatorList` ✓ — Indicator list (params: viz_status)
- `rbi/getRbiMetaData` ✓ — Sub-indicators + dimension values per indicator
  (params: indicator_code)
- `rbi/getRbiRecords` — Records (params from getRbiMetaData dimensions; unprobed)

**Indicators (26):**
  - `22` — Balance of Payments ‑ Indicators
  - `24` — Broad Commodity Composition of India's Merchandise Trade ‑ Oil and Non oil Exports and Imports ‑ Rupees
  - `42` — Broad Commodity Composition of India’s Merchandise Trade - Oil and Non-Oil Exports and Imports - US Dollar
  - `1` — Direction of Foreign Trade ‑ Rupees
  - `11` — Direction of Foreign Trade ‑ US Dollars
  - `32` — Exchange Rate of the Indian Rupee Vis‑a‑Vis the SDR, US Dollar, Pound Sterling, D.M./Euro and Japanese Yen (Calendar Year ‑ Annual Average)
  - `31` — Exchange Rate of the Indian Rupee Vis‑A‑Vis the SDR, US Dollar, Pound Sterling, D.M./Euro and Japanese Yen (Financial Year ‑ Annual Average and End‑Year Rates)
  - `35` — Exchange Rate of the Indian Rupee vis-à-vis the SDR, US Dollar, Pound Sterling, Euro and Japanese Yen (High and Low During the Month)
  - `33` — Exchange Rate of the Indian Rupee vis-à-vis the SDR, US Dollar, Pound Sterling, Euro and Japanese Yen (Monthly Average and end-Month Rates)
  - `43` — EXPORTS OF MAJOR COMMODITIES - RUPEES
  - `44` — EXPORTS OF MAJOR COMMODITIES - US Dollars
  - `2` — Exports of Select Commodities to Principal Countries ‑ Rupees
  - `20` — Exports of Select Commodities to Principal Countries ‑ US Dollars
  - `48` — Foreign Exchange Reserve Annual
  - `47` —  Foreign Exchange Reserve Monthly
  - `29` — Forex Rates ‑ Month‑High / Month‑Low
  - `45` — Imports of Major Commodities - Rupees
  - `46` — Imports of Major Commodities - US Dollars
  - `13` — India's Foreign Trade – Rupees
  - `17` — India's Foreign Trade – Rupees-Annual
  - `12` — India's Foreign Trade ‑ US Dollars
  - `16` — India's Foreign Trade ‑ US Dollars - Annual
  - `37` — Monthly Average Exchange Rate (155 Currencies)
  - `36` — Monthly Average Exchange Rates (EURO, GBP, JPY, USD)
  - `40` — NRI Deposits - Outstandings and Inflows(+) / Outflows(-)
  - `28` — Sale/ Purchase of U.S. Dollar by the RBI


## Energy Statistics

### Energy Statistics India (ESI)

- `energy/getEnergyIndicatorList` — Indicator list (params: none)

**Live-probed (2026-08-09).** `getEnergyIndicatorList` returns 2
indicators (Energy Balance in KToE / PetaJoules) and a
`use_of_energy_balance` dimension (1=Supply, 2=Consumption). **Both the
filter and records endpoints are unfetchable**: `getEnergyFilterByIndicatorId`
returns HTTP 400 for every param combination tried (indicator_code alone,
+use_of_energy_balance, +year), and `getEnergyRecords` returns HTTP 500.
The product is **not buildable** via the standard pattern — skip unless the
endpoints are repaired upstream.

**Indicators (2):**
  - `1` — Energy Balance ( in KToE )
  - `2` — Energy Balance ( in PetaJoules )

### Renewable Power (Installed Capacity)

- `mnre/getTypeOfRenewableEnergy` ✓ — Type of renewable energy (params: none)
- `mnre/getFilterByEnergy` ✓ — Filters (params: type_of_renewable_energy_code)
- `mnre/getDataByEnergy` ✓ — Data (params: type_of_renewable_energy_code,
  state_code, year, month_code, category_code, page, limit)

**Live-probed (2026-08-10).** Five energy types, each a cumulative INSTALLED
CAPACITY stock in MW (not generation): Solar (1), Wind (2), Hydro (3), Bio
(4), Total (5). Monthly from Jan 2020 to the latest month (Jun 2026 = 78
months). state_code 36 = All India. Categories vary by type:
  - Solar (1): Ground Mounted / Rooftop (PM Surya Ghar) / Hybrid / Off-Grid KUSUM / Solar Power Total
  - Wind (2): no category dimension (single total per month)
  - Hydro (3): Small Hydro (≤25 MW) / Large Hydro (>25 MW)
  - Bio (4): Waste to Energy / Biomass Bagasse / Biomass Non-Bagasse / WtE Off-Grid / Bio Power Total
  - Total (5): no category (grand total)

**CLASSIFICATION BREAK (Dec 2023):** Large Hydro reads 0.00 MW through Nov
2023, then jumps to ~46,910 MW in Dec 2023 — a definitional change (large
hydro folded into the RE total), not a capacity addition. The Grand Total
steps from 132.7 GW (Nov) to 180.8 GW (Dec). Growth is never computed
across the seam. Individual sources (Solar, Wind, Small Hydro, Bio) are
unaffected.

**Indicators (5):**
  - Solar Power
  - Wind Power
  - Hydro Power
  - Bio Power
  - Total Power


## Services Statistics

### Index of Services Production (ISP)

- `isp/getISPFilter` ✓ — Frequencies (Yearly/Monthly), years, months, sectors
- `isp/getISPRecords` ✓ — Records: base 2024-25, monthly, rows carry
  `broad_sub_sector`, `index`, `growth_rate`. Currently only FY 2025-26 and
  2026-27 — a trial series with no history yet.
- `macroindicators?product=isp` — SPA route (not an API endpoint)


---

Generated by scraping the live esankhyiki API on 2026-08-04.
