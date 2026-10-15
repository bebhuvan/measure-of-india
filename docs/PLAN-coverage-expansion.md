# Coverage expansion after the thirty-guide checkpoint

Owner direction: 10 October 2026. Build breadth and depth before launch. When in
doubt, more data points, granularity, cuts, explanations and charts. Operational
skill: `skills/atlas-comprehensive-expansion/SKILL.md`. This extends the launch
plan; it does not retire its release gates or design contracts.

## What the inspection establishes

The working repository is India Atlas, at
`~/Documents/Bhuvan projects/Economic atlas new Kimi`. The local Data Bank is
`~/Documents/Data/Data bank`. The latter is read-only for this assessment.

The registry contains **30 guides**. The canonical files contain **2,288 bundles,
820,428 series entries and 10,619,396 non-null observations**. These are file-level
counts: a series is often a state, industry, age, bank or survey cut; multiple
instruments and source copies can represent the same economic concept. Do not
advertise this as 820,428 distinct indicators.

`npm run coverage:expansion` regenerates `docs/expansion-audit.json`. It uses the
same bundle selection as the site's EveryCut component, including family-prefix
matches, and records every bundle, guide, ledger and locally inventoried DBIE
report. It does not fetch anything or change canonical data. It deliberately
does not equate ledger labels with independently verified charts.

**354 bundles, with 56,090 series entries, are outside national guide tables.**
Of these, 331 are the newer MoSPI profile bundles (54,659 entries), 17 are WDI
topic bundles (1,259 indicators), five are the superseded MoSPI RBI trade mirror,
and one is a CPI state/sector bundle. Selected profile measures are already shown
on state pages. "Outside guide tables" does not mean absent everywhere on the
site, nor does it mean every entry merits a separate chart.

The WDI catalogue is already comprehensive for India: 1,498 listed indicators,
1,395 with observations, in 22 topic bundles. Importing WDI again would add little.
The ILO family already has 68 dedicated bundles; population already uses UN WPP.
The RBI inventory lists 1,414 reports, of which 1,243 are `raw_validated`.
Counts of reports, provider rows and statistical measures must stay distinct.

The older `INVENTORY-data-paths.md` is a dated discovery snapshot. Its unchecked
items and "Atlas today" columns are not the current baseline: states, credit,
rates, public finance, payments, banks, farms and markets have since been built.
The old DBIE handoff's thirteen-guide baseline is also historical.

## The quickest useful expansion

Build from validated local holdings first. Downloading a new source is only one
part of the cost: units, denominators, seams, source identities, explanations,
charts, facts and visual inspection still take work. These are relative effort
judgements, not guaranteed day estimates.

### 1. Schools: new guide, beside Higher education

**Readiness:** all 46 UDISE+ indicators archived; 46 profile bundles, 7,942 series
entries, 52,334 observations. The ingestion index expects 243,018 source rows.
The profile bake intentionally keeps headline values of several dimensions;
the full raw tables need to be reviewed and rebaked for this guide's finer cuts.

**Whole-family scope:** school, pupil and teacher counts; level and management;
gender, social group, minorities and children with special needs; gross, net,
adjusted net and age-specific enrolment; gender parity; trained and qualified
teachers; pupil-teacher ratios; single-teacher and zero-enrolment schools;
promotion, repetition, dropout, transition and retention; drinking water,
electricity, toilets, libraries, computers and ICT. Cover every state and year
served, not only the six measures already on state profiles.

**Analytical plates:** enrolment through school stages; state gaps by stage;
teachers versus pupils; one-teacher schools; social-group and gender access;
infrastructure small multiples; progression through school. Every finer table
goes into EveryCut and downloads.

**Checks before headline selection:** the API has no national row in the
profile inspection; obtain national figures from the Ministry's report, with
their own provenance. Do not average state ratios or quietly call their sum an
agency national figure. Check implausible zero dropout cells against the
publication. Keep the existing school structure and the NEP structure separate.
Ministry source: [UDISE+](https://www.udiseplus.gov.in/).

### 2. Household assets and borrowing: new household guide

**Readiness:** AIDIS has all 22 indicators archived; 22 bundles, 8,177 series
entries, 8,177 snapshot observations; 218,818 expected source rows.

**Whole-family scope:** assets by type, land, homes, financial assets, gold and
valuables; incidence and amounts of debt; formal and informal creditors;
interest-rate bands, borrowing purpose, tenure and loan-size classes; capital
expenditure and fixed-capital formation; occupational group, household type,
asset class, spending quintile, social group, rural/urban and state.

**Plates:** what households own; who owes and how much; which creditors lend;
what a loan funds; interest-rate distribution; wealth-class and state contrasts.
Keep mean debt per household separate from debt per indebted household.

The existing Debt guide is BIS macro credit; Deposits is bank liabilities;
Markets covers saving flows and companies. None substitutes for the household
survey. The survey is NSS 77 (2019), but many debt stocks are explicitly **as
at 30 June 2018**. Label the actual reference date, not just the survey round.
No mean-based inequality or representative-household claim.

### 3. Farm households, incomes and risk: new guide linked to Farms

**Readiness:** all 33 NSS 77 land/livestock indicators archived; 33 bundles,
14,112 series entries, 14,112 snapshot observations; 471,001 expected raw rows.

**Whole-family scope:** income from wages, crops, animals and non-farm business;
paid-out costs versus imputed costs; productive assets, receipts and expenses;
landholding size, leasing terms and social group; livestock; creditors; crop
disposal agencies and satisfaction; seed procurement and quality; MSP awareness;
insurance, reasons for non-insurance, crop losses and causes. State and crop
cuts must be retained wherever the published table supplies them.

**Plates:** income composition; how costs change the income measure; land-size
distribution; state income differences; credit sources; where crops are sold;
insurance and loss. Production and yield in Farms stay the source-specific
counterpart. This survey describes agricultural households, not all rural
households, and the snapshot is not a current monthly income print.

### 4. Digital access and skills: new guide

**Readiness:** NSS 79 has all 35 indicators archived and baked in 35 bundles
(5,217 series entries); NSS 78 has all 14 indicators in 14 bundles (2,398
entries). These families contain other topics too; not all belong to this guide.

**Whole-family scope:** owning or using a phone; internet use and ability;
coverage versus adoption; household broadband; messaging with attachments,
copy/paste, search, email and online banking; household devices; bank-account
access where it contextualizes digital participation. Every supplied state,
gender, age, rural/urban and education cut. Use 28 WDI infrastructure indicators
as a reviewed long-history supplement, not automatic duplicates.

**Plates:** access versus use; rural/urban and gender gaps; age and education;
the ladder from messaging to banking; state contrasts. Explain that a network
covering a person does not mean they own a device, use it or have the skill.
NSS 80 is now an accessible extension: direct probes on 10 October returned
20 telecom and 18 education indicators. The old HTTP 500 arose from incorrect
request parameters; the profile adapter is corrected. Add the complete CMST
family to digital and the CMSE expenditure/coaching family to schools, with
separate survey rulers. These are discovery canaries, not completed ingestion.
See `reference/mospi-api-discovery.md`.

### 5. Water, sanitation and household amenities: new guide

**Readiness:** NSS 78, NSS 79, NFHS and 111 baked EnvStats bundles supply a broad
starting point. NSS 76 has 24 of 25 indicators archived; one incomplete fetch
remains blocked. Source universes differ and need a measure-by-measure map.

**Whole-family scope:** improved versus piped sources; water within premises;
exclusive access, sufficiency and handwashing; improved and exclusive latrines;
household cooking fuel; wastewater, sewage and treatment; groundwater, reservoir
storage and river quality as separate physical-resource measures. State,
rural/urban and other published cuts, with source dates visible.

**Plates:** the ladder of water access; sanitation access and exclusivity;
state gaps; sewage generated versus treated; groundwater extraction versus
availability; water quality by monitored river/location. A household with an
improved source is not evidence of safe water on every day; toilet access is
not a sewage-treatment measure. Split physical water resources into a linked
guide if the anatomy deserves its own space; do not bury it in one token chart.

### 6. Energy supply and use: new guide, retaining Renewable energy

**Readiness changed today:** metadata and records now work through the Atlas
client as well as MCP. The historical note saying `getEnergyRecords` returns
500 is no longer a blanket blocker. A supply canary for 2023–24 returns total
primary supply of **903,157.89 KToE**. A consumption canary returns 600 records
for that year (first page inspected), including fuel and industry cuts.
This is a successful probe, **not a complete ingestion**.

**Whole-family scope:** all fuels; production, imports, exports, stocks and
primary supply; final consumption by industry, transport and other sectors;
petroleum sub-products; all industry and transport sub-sectors; KToE and PJ
representations; every year served (metadata: 2012–13 through 2023–24).

**Plates:** supply mix and history; domestic production and import dependence;
where final energy goes; industry small multiples; transport fuels; primary
versus final energy; electricity capacity versus actual generation. The 27
WDI energy indicators and existing OWID energy bundles supplement the balance.
CEA expansion follows for monthly generation, plant/fuel/state cuts and power
availability: [CEA power data](https://cea.nic.in/power-data-management-division/?lang=en).

**Source trap already visible:** the consumption records include an `Elect.
Output in GWh` branch even under the KToE indicator. Do not label every value
KToE blindly. Check this branch against the source report and isolate its unit.
Supply imports are positive and exports negative in the canary. Reconcile the
published balance and KToE/PJ equivalence at published precision. Readiness is
high for ingestion; statistical validation is still essential.

### 7. Mutual funds and participation: new guide or substantial Markets extension

**Readiness:** the local Data Bank documents AMFI category flows/AUM, state AUM,
investor classes and holding periods, direct-plan splits and monthly reports;
SEBI's bulletin has both generic workbook extraction and curated monthly series.
No AMFI/SEBI product is registered in the Atlas today. Confirm publication and
raw lineage with the Data Bank CLI before exporting.

The read-only publication checks subsequently passed (`expansion-local-probes.json`):
AMFI detailed flows have 14 category labels over 39 months, April 2023–July 2026;
state AUM has 38 geographic labels and 16 categories, March 2014–August 2026;
SEBI has 15 curated families, including 225 category-series labels in its fund
category family and 17 monthly unique-investor observations, April 2025–August
2026. Geography/category counts include source aggregates and need a codebook;
they are not counts of mutually exclusive states or fund classes. The published
holdings make this a strong first-wave candidate. Full-history AMFI category
flows require its separate monthly-report dataset, not extrapolation from the
2023-on detailed-flow subset.

**Whole-family scope:** all scheme categories; gross inflow, redemption and net
flow; AUM and average AUM; active/passive and ETF/FoF detail; SIPs where served;
folios versus unique investors; retail/institutional classes; state geography;
direct/regular and distribution channels; holding periods. Preserve historical
AMFI category/layout changes. Do not count a folio as a person or infer household
wealth from geography of fund AUM. Do not turn this into fund-return rankings.

**Plates:** fund-category anatomy; flows versus market-value changes; investor
participation; geographic concentration; investor classes; SIPs; active/passive
mix. RBI's mutual-fund resources remain a separately labelled historical source.
Sources: Data Bank `AMFI_SOURCES.md`, `SEBI_BULLETIN_SOURCES.md`, and
[SEBI publications](https://www.sebi.gov.in/reports-and-statistics/publications.html).

### 8. Environment beyond climate: forest, air and waste guides

**Readiness:** 126 EnvStats indicators archived; 111 period-bearing canonical
bundles with 11,523 series entries and 34,957 observations. Ten deliberately
excluded tables are documented in the profile status; remaining absent bundles
must be reconciled with the ingestion index, not inferred from the difference.
WDI adds 68 environment indicators, with overlap reviewed before use.

Build coherent readers' subjects: (a) air pollution and monitoring; (b) forests,
land and biodiversity; (c) waste generated and treated. Cover each published
pollutant, city/site, forest density/type, carbon pool, land class and waste
type rather than using one national proxy for each subject.

**Checks:** monitoring coverage changes, units, station versus city averages,
forest cover versus legal forest area, stocks versus annual change, reported
waste versus actual generation. Do not splice pollution exposure models into
station readings. Do not count thematic source copies as independent coverage.

## Additional domestic families worth a bounded discovery pass

These are candidates with official publication routes, not verified Atlas-ready
adapters. Inspect a real file and its full table listing before promising breadth.

- **Pensions:** PFRDA NPS/APY subscribers, AUM, contributions and withdrawals,
  sector, state, gender/age and pension slabs. Its
  [statistical tables](https://pfrda.org.in/en/research-publications/statistics/statistical-data)
  and [handbook](https://pfrda.org.in/en/research-publications/statistics/handbook)
  make this worth testing before difficult portals. Subscribers are not unique
  universal pension coverage; active contributors need separate measures.
- **Insurance:** IRDAI life/non-life/health, premiums, policies/lives covered,
  claims, solvency, distribution and insurer classes. The
  [handbook](https://irdai.gov.in/handbook-of-indian-insurance) lists a workbook
  ZIP as well as reports. Check workbook structure and licence before choosing
  a PDF extraction route. Distinguish premiums from protection and claim amounts
  from claim settlement counts.
- **Transport and logistics:** state Handbook and EnvStats transport series,
  WDI infrastructure, then Railways, MoRTH, civil aviation and port statistics.
  The Data Bank documents IMF PortWatch for 37 Indian ports and four chokepoints.
  AIS-derived trade estimates are not customs merchandise values. A traffic
  guide can begin with local holdings; each modal primary source needs a canary.
  The read-only query now confirms 37 India ports and 104,525 distinct port/date
  keys from 1 January 2019 to 25 September 2026.
- **Tourism:** RBI state Handbook and existing WDI tourism indicators in the
  trade bundle; Ministry of Tourism for domestic visits, foreign arrivals,
  states, purpose and receipts. A visit is not a unique visitor. Prefer this
  specific question to duplicating the broad trade guide.
- **Social protection and rural employment:** MGNREGA, pensions and scheme
  administrative totals. Existing WDI ASPIRE entries end in 2011; their 25
  indicators cannot anchor a current welfare story. MGNREGA remains blocked in
  the launch status by CAPTCHA/network/key access; do not make it critical path.
- **Employment formalization:** EPFO/ESIC and NPS administrative flows alongside
  PLFS. Registration, net payroll additions and employment are different things.
  Discover every age/gender/state/industry cut and revision policy first.
- **Health spending and disability:** NSS 75/76/79 are already partly or fully
  held; a national guide could explain out-of-pocket costs, inpatient/outpatient
  expenses, disability, aids and care. Keep the seven incomplete NSS indicators
  explicitly blocked. WDI health has 151 indicators, many WHO/UNICEF-origin;
  distinguish survey observations from model estimates.

## International expansion: add what is genuinely new

1. **FAOSTAT:** deepen Farms with livestock, food balances, nutrition supply,
   fertilizer, land and farm emissions. Bulk downloads are offered by
   [FAOSTAT](https://www.fao.org/faostat/). Catalogue all India-bearing domains
   first. Preserve elements, items, units and estimate flags; old/new food
   balances have a methodology seam. Food available per person is not measured
   food eaten or nutrition outcomes.
2. **UNESCO UIS:** extend Schools/Higher education with attainment, completion,
   finance, teachers, learning and science/R&D beyond the 168 WDI education
   indicators. Official [bulk files and API resources](https://databrowser.uis.unesco.org/resources)
   are a practical route. Identify what WDI already contains before importing.
3. **WHO/UNICEF/JMP/UN IGME:** causes of death, health expenditure, child nutrition
   and survival, water/sanitation service ladders and uncertainty. The official
   [UNICEF India page](https://data.unicef.org/country/ind/) and
   [child mortality downloads](https://data.unicef.org/topic/child-survival/under-five-mortality/)
   provide discovery paths. National modeled estimates do not replace NFHS state
   survey measurements. Do not blend model intervals with survey point estimates.
4. **UNCTAD:** shipping connectivity, port calls/performance, merchant fleet,
   digital trade and productive capacity. The
   [Data Centre](https://unctadstat.unctad.org/datacentre/) lists the relevant
   tables. TradeStat already covers goods at deep HS detail; another total-trade
   import is a low-value duplicate. Test actual exports before estimating effort.
5. **BIS CPMI:** international payment-system comparison extends Payments.
   Its India keys are already catalogued; the ledger says the Data Bank does
   not mirror those flows. Start with that finite gap. Stocks, flows and payment
   instrument definitions differ by country; no universal digital-payment rank.
6. **ILO:** new work should extend verified India-bearing flows and genuine
   dimensions beyond the 68 bundles and deep archive already present. Audit
   survey versus model coverage first. "Connect ILO" is not a new task here.
7. **IMF/OECD:** local Data Bank SDMX holdings can add expectations, fiscal or
   external definitions and international context where domestic guides lack
   them. Country readiness, estimate flags and transformations must be queried;
   documented global row totals are not verified India coverage. Do not use
   projections to extend observed history.
8. **UN SDG, UNIDO, IRENA and UN Comtrade:** second-tier discovery for genuinely
   missing social/economic, industrial, energy or trade dimensions. Use custodian
   metadata to deduplicate against WDI and existing ministry bundles. Licence,
   full-country exports and table completeness still need verification.

## Newly verified discovery opportunities

- **NSS 74, services enterprises (July 2016–June 2017):** live MCP lists 21
  indicators; indicator 1 metadata exposes activity, frame and registration;
  the all-activity EC-frame/all-registration canary returns a record. This
  family is not in the profile ingestion plan. Extend Services with enterprises,
  establishments, ICT, seasonality, labour costs, capital, GVA/worker-size and
  productivity ratios. Keep EC, business-register and MCA sampling frames
  distinct; do not sum them without the survey's estimator. The old round is
  a structural benchmark, not a current services print. Inspect units against
  the report before interpreting the returned count.
- **Economic Census:** direct form-POST EC6 ranking now matches MCP output.
  This adds historical district establishments and workers, with activity,
  ownership, finance and rural/urban cuts. A dedicated adapter must verify
  full district coverage and detail pagination; top-five output alone is not
  comprehensive. Keep EC4/5/6 codes and census instruments separate. See
  `reference/mospi-api-discovery.md`.
- **Prompted RBI corporate tables:** the Data Bank status now documents a new
  prompted-export dataset, reviewed for reports 1067–1074, 1117 and 1118. That
  does not prove household confidence prompts are supported. Retest aggregate
  expectations reports with the Data Bank's supported prompt route, one report
  at a time. Never publish the personally identifying UCCS unit records excluded
  by the Markets ledger. Existing listed-company tables already cover a lot;
  compare actual history before importing another copy.
- **DBIE remainder:** the audit's unreferenced-report list uses explicit report
  identifiers in catalogues. It is incomplete lineage detection, not proof of
  missing economic coverage: BSR, Handbook and provider duplicates require their
  adapter manifests too. Resolve equivalence and current/old providers before
  proposing additional RBI guides. Most obvious RBI families are already here.

## Execution order and the launch bar

First implementation packet: **Schools**, then household assets/debt, farm
households, digital access, water/sanitation and energy. Mutual funds can move
earlier if the local published holdings verify cleanly. Forest/air/waste then
broaden the physical-economy side. Time Use is a high-value dedicated guide but
needs its full 41-indicator fetch (379,755 expected records), not just the ready
metadata. Fetch it sequentially through the existing MoSPI client and preserve
participation/per-person/per-participant and major/all-activities definitions.

This first group could take the site from 30 to roughly **38–41 guides**, depending
on which broad families deserve separate pages. That is a proposed coverage
shape, not completed work or a numeric quota. Pension, insurance and transport
would extend it further after their source canaries succeed.

Each packet must identify every published table and available cross-tab, build
the complete canonical/archival grain, draw the substantive anatomy, explain it,
and expose the tail. No catch-all exclusion or baked-only rule may declare the
reader's question answered. The profile adapter's headline selection is a useful
starting point, not an acceptable limit on a comprehensive national guide.

Before a family is called finished: census, source anchors/identities, facts and
verified prose, desktop/phone inspection, share-image check, build, gates,
strict coverage and appropriate tests. Separate observation dates from download
dates. Keep old source snapshots and survey universes visible. Do not commit,
upload archives or deploy as part of this assessment.

## Status of this pass

Finished: repository and local-source audit, temporary skill, repeatable expansion
inventory, ranked implementation packets, successful energy and NSS 74 canaries.
No new guide or complete data family has been published or claimed complete.
Guide implementation and new ingestion remain the next phase of the expansion.
