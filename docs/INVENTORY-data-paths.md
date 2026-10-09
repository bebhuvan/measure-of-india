# Inventory: data paths India Atlas could show

Checked 2026-10-09. Sources: the MoSPI MCP server (`mcp.mospi.gov.in`, v2.3.0, every
product, indicator and metadata variant queried live) and the Data Bank's RBI holdings
(`~/Documents/Data/Data bank`: inventory CSV regenerated today, `datasets list`,
`datasets health`, `query summary`). Brief: `docs/BRIEF-data-paths-inventory.md`.
Nothing in the Atlas or the Data Bank was changed.

Effort: **S** = data already flows, a refresh or a few bundles (under a day).
**M** = new bundles and plates inside an existing guide (one to three days).
**L** = a new guide (about a week). **Seam** = the item crosses a base-year or
methodology change; see "Base years" below before starting it.

## The checklist

MoSPI first (the first goal is to finish MoSPI), then RBI. Within each, ranked by what
an ordinary reader gains for the effort.

### MoSPI

- [x] **1. Refresh to the latest prints.** *Done 2026-10-09: data, prose and all dated notes; `npm run gates` passes.* Six series trail the source by one to three
  months: CPI 2024 (Atlas Jun, source Aug 2026), IIP 2022-23 (Jun, Aug), PLFS monthly
  (Jun, Aug), CPI-AL/RL (May, Aug), ISP (May, Jul), MNRE (Jun, Jul). MoSPI. **S.**
- [x] **2. WPI on the new base, 2022-23.** *Done 2026-10-09: `wpi-2022*` bundles, §02 two-ruler plate, title strip and current reading on the new base; §05 onwards still the 2011-12 base, labelled.* The guide is frozen at April 2026 because the
  2011-12 base ended there. The new base has 953 items, Apr 2023 to Aug 2026. MoSPI.
  **M, seam.**
- [x] **3. GDP on the 2022-23 base, in full.** *Done 2026-10-09: `gdp-2022-*` bundles to Q1 FY27; new-base engines plate; prose fed from the new base.* Today `gdp-2022` carries four quarterly
  series. The new base also has annual accounts for all 22 national indicators, GVA by 15 industries
  and 18 sub-industries, capital formation and saving by institutional sector, and
  revision stages. MoSPI. **M, seam.**
- [x] **4. GDP back to 1950-51.** *Done 2026-10-09: `gdp-back.json`, two plates in the GDP guide (§11).* NSO's own back series (2011-12 base): GDP, GVA by
  industry, consumption, investment, saving, 62 years to 2011-12. The Atlas starts in
  2011-12. A separate bundle, never joined to the current series. MoSPI. **M, seam.**
- [ ] **5. State economies.** GSDP, NSDP, per-capita income and GSVA by industry for
  every state, 2011-12 to 2025-26 (NAS indicators 23 to 34). Not shown anywhere today.
  A new guide. MoSPI. **L.**
- [ ] **6. Time use.** How Indians spend their day: 41 indicators, 230 activities, by
  gender, age and sector, 2019 and 2024 (TUS). A new guide. MoSPI. **L.**
- [ ] **7. Jobs, deeper.** Calendar-year annual estimates for 2023 to 2025 (new PLFS
  design, archived but not baked); LFPR and WPR by state and gender; religion, social
  group and education cuts; quarterly bulletin for 23 states; retest indicator 5
  (job conditions), which failed earlier. MoSPI. **M, seam** (agricultural to calendar
  years).
- [ ] **8. Prices, deeper.** CPI 2024 by state and division and by rural/urban and
  division; CPI 2012 for 2011 to 2015 (the guide window starts in 2016); the 299 CPI
  2012 items (from 2014). MoSPI. **M.**
- [ ] **9. Schools.** UDISE+ school education: schools, enrolment, teachers, GER, NER,
  dropout, infrastructure, 2018-19 to 2024-25, 46 indicators. A new guide, beside
  Higher education. MoSPI. **L.**
- [ ] **10. Women and men, up to date.** The Atlas holds 17 of 154 GENDER indicators,
  most ending by 2020 (work rates run to 2023); 45 indicators now run to 2025. MoSPI. **M.**
- [ ] **11. Informal enterprises, 2025 round.** ASUSE annual data for 2025 (32
  indicators; the Atlas stops at 2023-24) and the quarterly bulletin to Apr-Jun 2026.
  MoSPI. **S.**
- [ ] **12. Energy.** The national energy balance: supply and use by fuel and sector,
  2012-13 to 2023-24 (ENERGY). A new guide that can absorb Renewable energy. MoSPI.
  **M to L.**
- [ ] **13. Factories, deeper.** ASI at NIC 3 and 4 digits (79 and 151 classes), state
  by industry, and all 57 indicators for industries and states (today: core
  indicators only). MoSPI. **M, seam** (NIC 1987/1998/2004/2008).
- [ ] **14. Family health, fuller.** All 21 NFHS tables are archived; the guide bakes a
  subset. Add blood sugar, hypertension, cancer screening, women's empowerment, gender
  violence, tobacco and alcohol; NFHS-4 for states; rural and urban. MoSPI. **M.**
- [ ] **15. One-off household surveys.** NSS 77 (farm households and household debt,
  2019), 78 (living conditions, 2020-21), 79 (digital skills, finance, health spending,
  2022-23), 80 (telecom and education spending, 2025), 76 (disability, housing), 75
  (education). Years are from the round names; the server states them only for
  78. Fold into existing guides or one "Household surveys" guide. MoSPI.
  **M each.**
- [ ] **16. Environment.** 126 indicators: temperature, rainfall, forests, air and
  water quality, minerals, land. Heterogeneous; most end 2022 to 2024. One or two new
  guides. MoSPI. **L.**
- [ ] **17. Small gaps in finished guides.** HCES "with imputation" MPCE and rupee
  category tables; IIP and ISP annual (financial-year) series. MoSPI. **S.**
- [ ] **18. Economic Census.** District establishment and worker counts, EC4 (1998), EC5
  (2005), EC6 (2013-14). Old; low value. MoSPI. **M.**
- [ ] **19. NSS 73 (enterprises, 2015-16).** Blocked: every data call returns HTTP 400.

### RBI (Data Bank)

- [ ] **R0. A Data Bank reader.** *Started: `scripts/lib/databank.mjs` (family `databank`) exists for the deposits guide; extend it to the warehouse tables.* The Atlas's RBI
  data otherwise comes through MoSPI's mirror. One deterministic export adapter is the
  prerequisite for every item below. **M.**
- [ ] **R1. External account on DBIE.** MoSPI's RBI mirror stopped in mid-2025 (BoP to
  Q1 FY26, reserves Jun 2025). DBIE has BoP to Q1 FY27 with every revision vintage,
  weekly reserves to Sep 2026, the investment position, quarterly external debt, REER
  and NEER, FDI and FPI, ECBs, LRS remittances, services trade, rupee invoicing. Extends
  the External account guide. **M.**
- [ ] **R2. Interest rates and monetary policy.** Policy rates since 1935, every MPC
  decision and vote since 2016, lending and deposit rates (WALR, WADTDR, MCLR) since
  2012, the call rate daily since 2005, T-bill and G-sec yields, auctions. A new guide.
  **M to L.**
- [ ] **R3. Money, credit and banks.** Reserve money, M3, bank deposits and credit
  fortnightly since 1997, credit by sector and industry since 2007, food credit since
  1993. A new guide. **M to L.**
- [ ] **R4. Public finance.** Central and state deficits as a share of GDP since 1971,
  monthly central deficit, receipts, spending, debt, market borrowing. A new guide.
  **M to L.**
- [ ] **R5. Banking health.** NPAs by bank group and bank, NPA movement, capital
  adequacy, bank ratios, frauds. Part of R3 or its own guide. **M.**
- [ ] **R6. States, the RBI view.** Credit, deposits and CD ratios by state and
  district (BSR, spatial statements), branches, plus 159 tables of the Handbook of
  Statistics on Indian States (state finances, farm output, power, health). Pairs with
  MoSPI item 5. **L.**
- [ ] **R7. Household finance.** Household financial flows and stocks (quarterly),
  household saving, deposit ownership and depositors by age. Needs value checks first
  (see notes). **M.**
- [ ] **R8. Payments.** UPI, cards, NEFT, RTGS volumes and values monthly; e-rupee.
  **S to M.**
- [ ] **R9. Farms.** Crop output, area, yield by state, MSP, procurement and stocks (RBI
  reproduces the agriculture ministry; MoSPI does not serve these). A new guide. **M.**
- [ ] **R10. Prices MoSPI does not serve.** CPI for industrial workers (Labour Bureau),
  RBI's house price index, rural daily wages, gold and silver. Extends Consumer prices.
  **S to M, seam** (CPI-IW bases).
- [ ] **R11. Markets.** CP and CD issuance, FPI flows, mutual fund resources, new
  capital issues. Exchange index levels are BSE/NSE data reproduced by RBI: a licensing
  question for the owner. **M.**
- [ ] **R12. Company finances.** RBI studies of private and public limited companies
  and FDI companies, to 2024-25. **L, low priority.**
- [ ] **R13. Expectation surveys.** Household inflation expectations, consumer
  confidence, professional forecasters. Blocked: the reports ask for input and the Data
  Bank's client cannot answer prompts yet.

---

## Base years: the seams we have to handle

Base changes are the hardest part of this expansion: CPI, WPI, IIP, GDP and CPI-AL/RL
have all moved base since 2023. Hard rule 1 (AGENTS.md) settles the principle: two bases
are two rulers and never one series. What follows is the practice, product by product.

| Product | Bases served (live 2026-10-09) | Overlap | Official bridge | Atlas today |
|---|---|---|---|---|
| CPI | 2010 (2011 to Dec 2014), 2012 (2011 to Dec 2025), 2024 (Jan 2025 to Aug 2026) | 2012 and 2024 both cover 2025 | NSO back series on 2024 base, 2013 to 2024, General index, All India only | 2012 and 2024 as separate bundles; `cpi-2024-linked` uses only NSO's back series and live 2024-base levels. No 2010 base. Components cannot be compared across the seam |
| WPI | 1993-94 (1994 to 2010), 2004-05 (2005 to 2017), 2011-12 (2012 to Apr 2026), 2022-23 (Apr 2023 to Aug 2026) | 2011-12 and 2022-23 overlap 37 months | None found on the server | 2011-12 only, from 2016. Guide frozen at Apr 2026 |
| IIP | 1993-94, 2004-05, 2011-12 (to Mar 2026), 2022-23 (Apr 2023 to Aug 2026) | 2011-12 and 2022-23 overlap 36 months | None on the server | All four bases, separate bundles |
| GDP (NAS) | 2011-12 Back (1950-51 to 2011-12), 2011-12 Current (2011-12 to 2025-26), 2022-23 Current (2022-23 to 2025-26) | 2022-23 to 2025-26 on both | The Back series is NSO's own back-cast onto the 2011-12 base | 2011-12 quarterly from 2016 and annual accounts; 2022-23 quarterly headline only |
| State GDP | 2011-12 only | none | none | not shown |
| CPI-AL/RL | 1986-87 (to May 2025), 2019 (from Jun 2025) | none | Labour Bureau linking factor: not checked | Separate bundles |
| ISP | 2024-25 only (trial) | none | none | shown |
| ASI | NIC 1987, 1998, 2004, 2008 classifications | none | none | Separate bundles per NIC block |
| PLFS | agricultural years 2017-18 to 2023-24; calendar years 2023 to 2025 | 2023 | none | agricultural years only |

Two discrepancies to settle before building:
- **Old WPI bases.** The Data Bank's 2026-10-02 probe found 2004-05 and 1993-94
  returned 0 rows; today's MCP probe got rows for both (2,391 and 4,328 records). Use
  the live answer, but re-probe with the Atlas's own fetcher.
- **GDP latest quarter on 2022-23.** The Data Bank notes say quarterly data run to Q1
  2026-27; today's MCP metadata shows Q1 to Q4 of 2025-26 on the 2022-23 base. Not
  checked further.

**Proposal: make seams a registry, not a case-by-case fix.** *Points 1 and 4 built 2026-10-09 (`seams:` in `sources.yml`, enforced by `validate.mjs`); point 3 built 2026-10-09 on lb/framework (`seamMarks` in `plumbing.js`, the CPI, CPI-AL, WPI, IIP and GDP plates moved onto it; `ruler` on every facts-sheet number).*
1. A `bases:` block per product in `data/sources.yml`: each base with its first and
   last period, the overlap window, and the official bridge if one exists (with its
   source URL). `validate.mjs` reads it and fails a bundle whose dates leave its base's
   window or whose `meta.base` is not listed.
2. Three allowed treatments, nothing else:
   (a) the default: rulers side by side with a changeover marker;
   (b) a linked line only where the agency publishes the link (NSO's CPI back series,
   the NAS Back series, a Labour Bureau linking factor once verified), labelled as the
   agency's;
   (c) for growth, each base's y/y computed inside its own base, with both lines drawn
   through the overlap. The overlaps are long (WPI 37 months, IIP 36), so readers get
   an unbroken growth story without us chaining anything.
3. One shared chart treatment in `src/charts/plumbing.js` for (a) to (c), so every guide
   draws a seam the same way, and a facts-sheet field naming the base of every number.
4. Never our own chain-linking or back-casting.

With this in place, items 2, 3, 4, 7, 13 and R10 become configuration plus plates
rather than new seam logic each time.

---

## Part 1: MoSPI, in detail

The MCP server is a thin wrapper over `api.mospi.gov.in`, the same eSankhyiki API the
Atlas adapters use, so anything found here can be fetched by our existing code. It
exposes 27 products and 791 coded indicators, plus the CPI, WPI, IIP and ISP trees,
which have no indicator list. Full notes, including every indicator and every
dimension count: the agent's working file (not committed; regenerate from the server if
needed).

Status: **full** = everything the server offers is in the Atlas (raw and baked);
**part** = some cuts or years missing; **none** = not in the Atlas.

| Product | What the server has | Atlas | Status, and what is missing |
|---|---|---|---|
| CPI | Base 2024: 13 divisions, 43 groups, 92 classes, 162 sub-classes, 358 items; 37 states (1 = All India); rural, urban, combined; Jan 2025 to Aug 2026. Base 2012: 8 groups, 28 sub-groups, 299 items (from 2014); 2011 to Dec 2025. Base 2010: 2011 to 2014 | 2024: all divisions, groups and items (All India), state General index; 2012: groups and sub-groups from 2016, state General index | **Part.** Missing: 2024 states by division, sectors by division, classes and sub-classes as plates; 2012 before 2016; 2012 items; 2010 base. Behind by two months |
| WPI | 4 bases (above); 2022-23 has 29 groups, 142 sub-groups, 953 items | 2011-12 only: majors, 29 groups, 134 sub-groups, 697 items, from 2016 | **Part.** Missing the 2022-23 base entirely, 2012 to 2015, and the two old bases |
| IIP | 4 bases; general, sectoral, NIC 2-digit, use-based; monthly and annual | all four bases, monthly | **Part.** Missing annual series. Behind by two months |
| ISP | base 2024-25, 19 sub-sectors, monthly from Apr 2025 to Jul 2026, one year of annual | monthly | **Full** but behind by two months; annual missing |
| NAS | 33 indicators; three series (above); industry 15, sub-industry 18, institutional sector 7, revision stages up to 8; states for 23 to 34 | 2011-12 quarterly headline, expenditure, 8 industries, nominal, annual accounts (7 series); 2022-23 quarterly headline | **Part.** Missing: 2022-23 detail, the Back series, all state indicators, sub-industries, institutional sectors |
| PLFS | annual 8 indicators with state (39), gender, sector, age, education, religion, social group, NIC, NCO, enterprise cuts, 2017-18 to 2025; quarterly 4 indicators, 23 states, to Apr-Jun 2026; monthly 3 indicators to Aug 2026 | monthly, quarterly urban, annual headline, states (UR), status, earnings, education | **Part.** Missing calendar years 2023 to 2025, state LFPR/WPR, religion and social group, quarterly states, indicator 5 |
| CPI-AL/RL | 2 indicators, 35 states, 7 groups, base 1986-87 and 2019, to Aug 2026 | both bases, states, groups (2019) | **Full** but behind by three months |
| HCES | 9 indicators, 2022-23 and 2023-24 | all 9 in raw; baked without imputation | **Nearly full.** Missing "with imputation" plates |
| ASI | 57 indicators; NIC 2008, 2004, 1998, 1987; states (39); NIC 2, 3, 4 digit; 1992-93 to 2023-24 | full 2008 accounts (All India), 2-digit industries, states, older blocks headline | **Part.** Missing 3 and 4 digit, state by industry, older blocks in depth |
| ASUSE | 50 indicators (42 annual, 8 quarterly); annual 2021-22 to 2025; quarterly to Apr-Jun 2026 | annual to 2023-24, quarterly to Jan-Mar 2026 | **Part.** Missing the 2025 round and the latest quarter |
| AISHE | 9 indicators, 2017-18 to 2021-22, 37 states | all 9 in raw, five years | **Full** (AISHE 2022-23 is not on the server) |
| GENDER | 154 indicators, 1951 to 2026, 75 single snapshots | 17 indicators, mostly ending by 2020 | **Part.** 137 indicators missing |
| NFHS | 21 tables, NFHS-4 and NFHS-5 | all 21 in raw; six bundles plus NFHS-5 states | **Part.** Several tables and NFHS-4 states not baked |
| MNRE | 5 types, 40 states, 2020 to Jul 2026 | all | **Full** but behind by one month |
| RBI (MoSPI copy) | 39 tables, monthly series end mid-2025 | 16 tables baked | **Superseded** by DBIE (R1) |
| ENERGY | energy balance, 10 commodities, 11 sub-commodities, end-use sectors and 24 sub-sectors, KToE and PJ, 2012-13 to 2023-24 | none | **None** |
| ENVSTATS | 126 indicators (11 and 72 empty) | none | **None** |
| TUS | 41 indicators, 230 activities, 2019 and 2024 | none | **None** |
| UDISE | 46 indicators, 2018-19 to 2024-25 | none | **None** |
| NSS 75, 76, 77, 78, 79, 80 | 13, 25, 55, 14, 35, 38 indicators; single rounds (round years not stated by the server for most) | none | **None** |
| NSS 73 | 6 indicators | none | **None; broken at source** |
| EC | 3 rounds, district counts; `state` required | none | **None** |

Server quirks worth knowing before fetching (all seen live):
- CPI base 2024 rejects `limit` below 10, and needs `limit` of at least 10 even for a
  probe. Base 2024 All India is state 1; base 2012 All India is state 99.
- IIP needs `type`, ASI needs `sector_code` and `nic_type`, EC needs `state`.
- IIP's own notes still call 2011-12 the latest base; 2022-23 works.
- NAS: the indicator-list call failed upstream today ("too many 500 error responses");
  state code 37, documented as All India, returns nothing for GSDP; state indicators
  exist only on the 2011-12 Current series; the Back series has no taxes, subsidies or
  growth rates.
- GENDER: the GitHub definitions list 12 codes the live server no longer serves.

## Part 2: RBI DBIE in the Data Bank, in detail

### What is held

| Dataset | Rows | What it is | Health (2026-10-09) |
|---|---|---|---|
| `rbi_dbie_webi_rows` (raw mirror) | 1,243 reports, about 76 million rows, 1.02 GB gzip | Every DBIE statistical report, long format, with revision vintages | 1,196 `ok`, 28 `behind` (behind at the source, not in our copy), 0 integrity errors in the 2026-10-08 audit |
| `rbi_dbie_webi_rows` (parsed) | 30 reports published | The reviewed subset (credit, BoP, NPAs, payments, CP/CD, household finance) | promotion ready |
| `rbi_dbie_cas_money` | 368,243 | 47 Data Query tables: money, liquidity, G-secs, external, government finance | fresh |
| `rbi_policy_rates` | 395 changes | 1935 to the last change (Dec 2025) | fresh |
| `rbi_mpc_meetings`, `rbi_mpc_votes` | 61 meetings, 366 votes | Oct 2016 to Aug 2026 | votes ready; meetings show promotion blocked |
| `rbi_lending_deposit_rates` | 15,714 | WALR, WADTDR, MCLR by bank group and bank, 2012 to Sep 2026 | fresh |
| `rbi_gsec_auctions`, `rbi_tbill_auctions`, `rbi_sdl_auctions` | 424, 537, 200 | auctions from Apr 2023 (SDL from Aug 2026) | fresh |
| `rbi_sectoral_credit`, `rbi_nbfc_credit`, `rbi_bank_position`, `rbi_credit_history` | 91,369; 225 facts; 34; 20,008 | press-release credit data | fresh |
| other `rbi_dbie_*` (forex, trade, FDI, payments) | small | older single-purpose pulls | mostly fresh; `deposit_credit_growth` stale |

The report catalogue has 1,414 entries. Not held: 132 PDFs (archived BSR volumes, notes),
35 reports that ask for input (household surveys, UCB tables, listed-company tables),
2 empty, 2 failing at RBI. `query summary` counts some datasets across more than one
file (for example 794 rows for `rbi_policy_rates` against 395 unique changes in the
docs); counts above are from the Data Bank docs where they differ.

Health flags such as `latest_failed=audit_failed` record the most recent failed run of
that kind, not necessarily the current state; promotion status is the better guide.

### Families

| Family | Main reports or tables | Frequency, history, latest | Atlas today |
|---|---|---|---|
| Money and reserve money | CAS `MSC_F`, `BMC_M`, `RMC_W`; reports 22, 23, 26, 97, 554, 826 | fortnightly and monthly from 1991; Sep 2026 | none |
| Bank deposits and credit | 689 (from 1997), 1130 food credit (from 1993), 539, 540 sector and industry (2007 on), 998, 901 | fortnightly and monthly; Sep 2026 | none |
| Credit and deposits by place | BSR-1 and BSR-2 annual and quarterly (about 160 tables), spatial statements 1413 to 1489, branch statistics (32) | quarterly and annual; Jun 2026 | none |
| Interest rates and policy | `rbi_policy_rates`, MPC, lending rates; 151 and 531 key rates, 1491 MPC votes; call money 198, 690; MIBOR 993; yields 1368, 809 | daily to annual; Oct 2026 | none |
| Government securities and debt | T-bill auctions 307 to 311, borrowings 559, 1213, ownership 1369, 1371, yields | weekly; Sep 2026 | none |
| Public finance | central 349, 355, 655, 656, 713, 1399; states 451 to 454, 677, 692, 709; combined 339 to 347, 673, 721; CAS `FICG_GDP` (from 1971), `FISG_GDP` (from 1974) | annual (budget estimates to 2026-27), monthly central deficit; May 2026 | none |
| External sector | BoP 141, 143, 56 to 59 (to Q1 FY27, all vintages); IIP 145, 982; external debt 660; REER 584; reserves 1, 574; FDI 34, 997; ECB 55; LRS 793; services 1501; INR invoicing 1550, 1551 | weekly to annual; Jun to Sep 2026 | **part**, via MoSPI's mirror to mid-2025 |
| Banking health | 254, 330 NPAs by group; 336, 986 bank-wise; 1114 NPA movement; 329, 1077 CRAR; 332, 1078 ratios; 1508 frauds; Trend and Progress tables 1508 to 1547 | annual; Mar 2025 | none |
| Payments | 61, 612 payment indicators; 1404 e-rupee; 678 cheques | monthly; Jul 2026 | none |
| Household finance | 1225, 1226 household flows and stocks; 246, 508 household financial assets; small savings 581; BSR-2 ownership | quarterly and annual; Mar 2026 | none |
| Markets | CP 5, 32; CD 4, 31; FPI 136, 1354; mutual funds 1359 to 1361; capital issues 1355; BSE/NSE indices 693, 728 | daily to annual | none |
| States | Handbook of Indian States: 182 reports, 159 distinct tables (GSDP, state finances, crops, power, health, roads, tourism, SDGs), most to 2024-25 | annual | none |
| Agriculture | 459 to 465, 623 to 625, 886, 887: output, area, yield, MSP, PDS | annual; to 2025-26 (state crop output to 2022-23) | none |
| Prices and wages | CPI-IW 699, 1168; house prices 688; rural wages 664; gold 197; WPI 1062 (1.6m rows); CPI 626, 994 (state-wise) | monthly and quarterly | CPI, WPI from MoSPI (source of record); CPI-IW, house prices, wages none |
| National accounts and output | GDP 160, 161, 504 to 507; NSDP 65, 66, 248; IIP 638; core industries 499, 989 | quarterly and annual | from MoSPI (source of record) |
| Companies and institutions | company finance studies 1146 to 1208; NBFC 1534 to 1544; financial institutions 382 to 398 | annual; 2024-25 | none |
| Surveys | IESH 271, UCCS 272, RCCS 1478, SPF 1473 to 1476 | bi-monthly | not held (prompts) |

### Notes for whoever builds from the RBI data

- **Values are text, units repeat.** Most reports repeat each value once per display
  unit (ACTUALS, LAKHS, CRORES...). Filter to one unit before summing, and check one
  value against a published figure before charting. Some unit columns are nonsense
  (1226, 1114).
- **Versions.** Many reports carry Provisional, Partially Revised and Revised rows. Pick
  the latest final version per date and say which one a chart uses.
- **Not yet value-checked:** 4, 947, 949, 1346, 1324, 1225, 1226. Report 1226 gives
  household gross financial assets of 143% of GDP for Mar 2024 against an older 106.3%;
  the table looks revised (equity now included). Confirm before R7.
- **Centre-wise tables (1420, 1469, 1487, about 5 million rows)** are not in the parsed
  table; the Data Bank proposes a separate `rbi_dbie_webi_spatial` dataset. Needed only
  for district or centre maps in R6.
- **Source of record.** MoSPI stays the source of record for CPI, WPI, IIP and GDP;
  RBI copies are cross-checks only. One exception worth testing: RBI's WPI report 1062
  may carry old-base history; not checked.
- **Schedule.** The Data Bank refreshes the DBIE mirror monthly (3rd of the month) and
  Data Query tables on Tuesday and Saturday. The Atlas adapter should read the
  warehouse snapshot, never the live site.

## Gaps and open questions

- The MCP probe is a metadata-and-sample pass, not a full download. Row counts per
  product were not measured; latest periods for products without a time dimension
  (NSS rounds, NFHS, EC) come from the server's descriptions.
- Labour Bureau's CPI-AL/RL linking factor between bases: not checked.
- Licensing of BSE and NSE index values reproduced by RBI (R11): the owner's call.
- The household-survey reports (R13) need prompt support in the Data Bank's client;
  that is Data Bank work, not Atlas work.
- `docs/HANDOFF-dbie-expansion.md` plans the RBI build in more detail; this inventory
  should feed its Phase B coverage map.
