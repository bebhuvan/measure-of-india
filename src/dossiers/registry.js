// src/dossiers/registry.js — THE dossier registry. Single source of truth.
// One entry per dossier; every consumer derives from here: the homepage
// dossier list, the register sections, the RSS feed, the 404 page, the OG
// cards, and the page enumerations of qc.mjs / lint-charts.mjs. Pure data —
// no imports — so node scripts (pipeline, og, qc) and Astro pages alike can
// read it. Adding dossier N+1 = one entry here + the artefacts listed in
// docs/RUNBOOK-sources.md.
//
// Field conventions:
//   section       IA grouping shown in breadcrumbs ("Prices", "Output", …)
//   name          short display name (homepage, 404, RSS title)
//   title         the topic as a reader names it ("Consumer prices"): home, guides index, search
//   kickerTitle   the instrument name in the page kicker ("Section: kickerTitle")
//   crumbTitle    the bolded tail of the dossier page breadcrumb
//   headline      page h1, with one <i>accent</i> phrase (docs/DESIGN.md §4)
//   currentBundle the CURRENT ruler — the bundle prose/RSS/facts describe
//                 (docs/CONTRACT-series.md §3; never a retired base)
//   calendar      period labelling: "fiscal-apr" (Indian FY, Q1 = Apr–Jun) or
//                 "calendar" (World Bank/OWID style: Q1 = Jan–Mar, year labels)
//   bands         the policy band where one exists in law ({floor, target,
//                 ceiling}); facts/generate/verify use it only when declared
//   proseConstants the verifier's whitelist of structural numbers this
//                 dossier may cite (weights, shares, base years)
//   spark         homepage row sparkline: { bundle, series } or { bundle,
//                 custom } for synthesized shapes (see home.client.js)
//   prose         has dated LLM slots in pipeline/slots.yml
//   proseInputs   the sibling bundles a dossier's writer must see — facts.mjs
//                 summarizes each (rankings, extremes, contradictions) into
//                 the facts sheet, and the coverage gates hold the prose to it
//   register      register section: tbody id, heading label, unit note,
//                 and column headers where they deviate from Latest/Year ago
//
// dateStamp/vintageLabel are DERIVED from bundle meta at build by
// display.js (stamp.dateStyle/stamp.vintageStyle declare the derivation;
// dateText/vintageText are allowed only where no bundle fact exists) —
// hand-typed display strings that embed data facts rotted silently.

export const DOSSIERS = [
  {
    slug: "cpi",
    no: "01",
    section: "Prices",
    name: "Consumer Price Index",
    title: "Consumer prices",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Consumer Price Index",
    crumbTitle: "Consumer Price Index",
    headline: "The price of a <i>basket of life.</i>",
    ogTitle: "The price of a basket of life.",
    blurb: "The cost of an ordinary shopping basket, measured monthly. The RBI's target, your salary's adversary, and the most argued-about number in Indian economics.",
    description: "The Consumer Price Index: a decade of Indian retail inflation, its components, and how to read the latest print.",
    rssDescription: "The cost of an ordinary shopping basket, measured monthly. Revised with the latest print.",
    stamp: { dateStyle: "release", vintageStyle: "release" },
    statusNote: "Evergreen, revised with each print",
    version: "v2.4",
    proseInputs: ["cpi-2024-groups", "cpi-2024-states", "cpi-2024-states-sectors", "cpi-2024-items", "cpi-2024-sectors"],
    currentBundle: "cpi-2024",
    calendar: "fiscal-apr",
    bands: { floor: 2, target: 4, ceiling: 6 },   // policy band, where one exists in law (CPI only)
    proseConstants: [2, 4, 6, 45.86, 6.84, 47.30, 2.38, 6.53, 10.07, 28.32, 100, 2012],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "cpi", series: "headline" },   // retired 2012 base: the long history
    prose: true,
    register: { id: "reg-cpi", label: "Prices", unit: "Monthly, base 2024 from Jan 2026, base 2012 retired Dec 2025", historyCol: "History" },
    bundles: ["cpi", "cpi-rural", "cpi-urban", "cpi-subgroups", "cpi-states", "cpi-states-sectors", "cpialrl-2019", "cpialrl-1986", "cpialrl-groups-2019", "cpi-2024", "cpi-2024-back", "cpi-2024-linked", "cpi-2024-sectors", "cpi-2024-groups", "cpi-2024-items", "cpi-2024-states", "cpialrl-states-1986", "cpialrl-states-2019"],
  },
  {
    slug: "gdp",
    no: "02",
    section: "Output",
    name: "National Accounts, GDP",
    title: "GDP",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "National Accounts",
    crumbTitle: "National Accounts, GDP",
    headline: "The speed of the <i>whole economy.</i>",
    ogTitle: "The speed of the whole economy.",
    blurb: "The size and speed of the whole economy, estimated quarterly: what growth is made of, from consumption to investment and government, and what the aggregate hides.",
    description: "GDP and GVA: a decade of Indian growth, the pandemic wound, and how to read the latest quarterly print.",
    rssDescription: "The size and speed of the whole economy, estimated quarterly. Revised with the latest print.",
    stamp: { dateText: "August 2026", vintageStyle: "vintage" },   // dateText = page-revision month (no bundle fact); vintage derives from gdp-2022 meta.vintage
    statusNote: "Evergreen, revised with each print",
    version: "v1.8",
    proseInputs: ["gdp-2022-expenditure", "gdp-2022-industries", "gdp-2022-accounts", "gdp-2022-nominal"],
    currentBundle: "gdp-2022",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [55.8, 33.5, 9.6, 6, 100, 2011],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "gdp", series: "gdp" },   // retired 2011-12 base: the long history
    prose: true,
    register: { id: "reg-gdp", label: "Output", unit: "Quarterly, 2022-23 base current, 2011-12 base through Q2 FY26", historyCol: "2016 to 2025" },
    bundles: ["gdp", "gdp-expenditure", "gdp-accounts", "gdp-industries", "gdp-nominal", "gdp-2022", "gdp-2022-expenditure", "gdp-2022-industries", "gdp-2022-nominal", "gdp-2022-accounts", "gdp-back"],
  },
  {
    slug: "wpi",
    no: "03",
    section: "Prices",
    name: "Wholesale Prices, WPI",
    title: "Wholesale prices",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Wholesale Price Index",
    crumbTitle: "Wholesale Price Index",
    headline: "The price at the <i>factory gate.</i>",
    ogTitle: "The price at the factory gate.",
    blurb: "Factory-gate prices, a different basket from the CPI that measures a different thing. Why the two often part ways, and why both can be right.",
    description: "The Wholesale Price Index: factory-gate inflation, its three moving parts, and why it argues with the CPI while both are right.",
    rssDescription: "Factory-gate prices: a different basket from the CPI, measuring a different thing. Revised with the latest print.",
    stamp: { dateStyle: "release", vintageStyle: "release" },
    statusNote: "Evergreen, revised with each print",
    version: "v1.2",
    currentBundle: "wpi-2022",
    proseInputs: ["wpi-2022-groups", "wpi-2022-subgroups", "wpi-2022-items"],
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100, 2011, 2022, 2023],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "wpi", series: "headline" },   // retired 2011-12 base: the long history
    prose: true,
    register: { id: "reg-wpi", label: "Wholesale prices", unit: "Monthly, provisional, 2022-23 base current, 2011-12 base through April 2026", historyCol: "2016 to 2026" },
    bundles: ["wpi", "wpi-groups", "wpi-subgroups", "wpi-items", "wpi-2022", "wpi-2022-groups", "wpi-2022-subgroups", "wpi-2022-items"],
  },
  {
    slug: "iip",
    no: "04",
    section: "Output",
    name: "Index of Industrial Production",
    title: "Industrial production",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Index of Industrial Production",
    crumbTitle: "Index of Industrial Production",
    headline: "The monthly pulse of <i>making things.</i>",
    ogTitle: "The monthly pulse of making things.",
    blurb: "The monthly pulse of mining, manufacturing and electricity. Volatile, revised, and read far too literally.",
    description: "The Index of Industrial Production: the monthly pulse of mining, manufacturing and power, in four bases that never meet: and its new services counterpart, the ISP.",
    rssDescription: "The monthly pulse of mining, manufacturing and electricity. Revised with the latest print.",
    stamp: { dateStyle: "monthNext", vintageStyle: "monthNext" },
    statusNote: "Evergreen, revised with each print",
    version: "v1.2",
    currentBundle: "iip-2022",
    proseInputs: ["iip-industries-2022"],
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100, 2022],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "iip-2022", series: "general" },
    prose: true,
    register: { id: "reg-iip", label: "Industry", unit: "Monthly, base 2022-23, quick estimates", historyCol: "2024 to 2026" },
    bundles: ["iip-2022", "iip-2011", "iip-industries-2022", "iip-industries-2011", "iip-2004", "iip-1993", "isp"],
  },
  {
    slug: "external",
    no: "05",
    section: "External",
    name: "The External Account",
    title: "External account",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Balance of Payments",
    crumbTitle: "The Balance of Payments",
    headline: "What the country earns abroad, <i>and what it owes.</i>",
    ogTitle: "What the country earns abroad, and what it owes.",
    blurb: "Exports, imports, reserves and the rupee: the country's ledger with the rest of the world, and the buffer that keeps it honest.",
    description: "The balance of payments: exports, imports, reserves and the rupee. What the country earns abroad, what it owes, and the buffer in between.",
    rssDescription: "Exports, imports, reserves and the rupee: the country's ledger with the rest of the world. Revised with each release.",
    stamp: { dateStyle: "month", vintageStyle: "month" },
    statusNote: "Evergreen, revised with each print",
    version: "v1.2",
    currentBundle: "rbi-forex",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "rbi-forex", series: "reserves" },
    prose: false,
    register: { id: "reg-ext", label: "External", unit: "Monthly & annual, data through Jun 2025 / FY 2024–25", historyCol: "History" },
    bundles: ["rbi-trade", "rbi-forex", "rbi-bop", "rbi-bop-ratios", "rbi-debt", "rbi-nri", "rbi-invisibles", "rbi-exchange-rates", "rbi-intervention", "rbi-forward-premia", "rbi-debt-quarterly", "rbi-trade-partners", "rbi-commodities-exports", "rbi-commodities-imports", "rbi-fx-turnover"],
  },
  {
    slug: "jobs",
    no: "06",
    section: "Labour",
    name: "Employment & Unemployment, PLFS",
    title: "Jobs",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Periodic Labour Force Survey",
    crumbTitle: "Employment & Unemployment, PLFS",
    headline: "Who has work, who wants it, <i>who is counted.</i>",
    ogTitle: "Who has work, who wants it, who is counted.",
    blurb: "Who has work, who wants it, and who is counted. India's jobs number is not a count of jobs; it is three surveys, timed three ways, kept side by side.",
    description: "The Periodic Labour Force Survey: unemployment, participation, and the three stopwatches India times its workers with.",
    rssDescription: "The Periodic Labour Force Survey: unemployment, participation, and the three stopwatches India times its workers with. Revised with each bulletin.",
    stamp: { dateStyle: "monthNext", vintageStyle: "month" },
    statusNote: "Evergreen, revised with each bulletin",
    version: "v1.3",
    proseInputs: ["plfs-cuts", "plfs-states", "plfs-status", "plfs-earnings"],
    currentBundle: "plfs-monthly",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "plfs-monthly", series: "ur" },
    prose: true,
    register: { id: "reg-plfs", label: "Labour", unit: "Monthly, quarterly, annual, CWS & PS+SS, never spliced", historyCol: "History" },
    bundles: ["plfs-monthly", "plfs-quarterly", "plfs-annual", "plfs-cuts", "plfs-states", "plfs-status", "plfs-earnings", "plfs-education"],
  },
  {
    slug: "consumption",
    no: "07",
    section: "Consumption",
    name: "Household Consumption, HCES",
    title: "Household spending",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Household Consumption Expenditure Survey",
    crumbTitle: "Household Consumption, HCES",
    headline: "What India spends, <i>one person at a time.</i>",
    ogTitle: "What India spends, one person at a time.",
    blurb: "The household budget of a country, averaged: what a person spends in a month, rung by rung of the ladder, and why the average is nobody's life.",
    description: "The Household Consumption Expenditure Survey: what India spends per person per month, rung by rung, state by state.",
    rssDescription: "The Household Consumption Expenditure Survey: what a person spends in a month, rung by rung of the ladder. Revised with each survey round.",
    stamp: { dateText: "August 2026", vintageStyle: "round" },
    statusNote: "Two survey rounds, final on release",
    version: "v1.1",
    proseInputs: ["hces-fractiles", "hces-states", "hces-categories", "hces-gini", "hces-social"],
    currentBundle: "hces-mpce",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "hces-fractiles", custom: "fractile-ladder" },   // 12-point rural ladder, 2023-24 round
    prose: true,
    register: { id: "reg-hces", label: "Consumption", unit: "Annual survey, rounds 2022-23 & 2023-24", historyCol: "History" },
    bundles: ["hces-mpce", "hces-states", "hces-fractiles", "hces-categories", "hces-gini", "hces-social", "hces-household-type", "hces-quantities", "hces-item-values", "hces-categories-states"],
  },
  {
    slug: "factories",
    no: "08",
    section: "Enterprises",
    name: "Enterprises, ASI + ASUSE",
    title: "Factories and enterprises",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Annual Survey of Industries & ASUSE",
    crumbTitle: "Factories & Informal Enterprises, ASI + ASUSE",
    headline: "The factory, the shop, <i>and the line between them.</i>",
    ogTitle: "The factory, the shop, and the line between them.",
    blurb: "The factory, the shop and the line between them. Registered factories audited to the last rupee, and informal firms counted only since 2021, side by side and never summed.",
    description: "The Annual Survey of Industries and ASUSE: registered factories and unincorporated enterprises, side by side and never conflated.",
    rssDescription: "The Annual Survey of Industries and ASUSE: registered factories and unincorporated enterprises, side by side and never conflated. Revised with each survey round.",
    stamp: { dateText: "August 2026", vintageStyle: "round", plural: true },
    statusNote: "Evergreen, revised with each survey round",
    version: "v1.2",
    proseInputs: ["asi-industries", "asi-states", "asuse-annual", "asuse-sectors", "asuse-states"],
    currentBundle: "asi-headline",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "asi-headline", series: "factories_in_operation" },
    prose: true,
    register: { id: "reg-asi", label: "Enterprises", unit: "Annual, ASI from 2008-09, ASUSE from 2021-22", historyCol: "History" },
    bundles: ["asi-headline", "asi-accounts", "asi-headline-1987", "asi-headline-1998", "asi-headline-2004", "asi-industries", "asi-states", "asuse-annual", "asuse-quarterly", "asuse-sectors", "asuse-states", "asuse-owners", "asuse-modernity", "asuse-structure"],
  },
  {
    slug: "aishe",
    no: "09",
    section: "Education",
    name: "Higher Education, AISHE",
    title: "Higher education",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "All India Survey on Higher Education",
    crumbTitle: "Higher Education, AISHE",
    headline: "Who goes to college in India, <i>and who does not.</i>",
    ogTitle: "Who goes to college, and who does not.",
    blurb: "Who enrols in college, who is left out, and what the Gross Enrolment Ratio really measures, across five rounds of the national survey.",
    description: "The All India Survey on Higher Education: who enrols, who is left out, and what the Gross Enrolment Ratio really measures.",
    rssDescription: "AISHE: who enrols, who teaches, and who is left out of Indian higher education. Revised with each round.",
    stamp: { dateText: "August 2026", vintageStyle: "round" },
    statusNote: "Five survey rounds, final on release",
    version: "v1.0",
    currentBundle: "aishe-headline",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "aishe-headline", series: "enrolment" },
    prose: false,
    register: { id: "reg-aishe", label: "Higher Education", unit: "Annual, AISHE, 2017-18 to 2021-22", historyCol: "5 rounds" },
    bundles: ["aishe-headline", "aishe-access", "aishe-composition", "aishe-states", "aishe-teachers", "aishe-minority"],
  },
  {
    slug: "gender",
    no: "10",
    section: "Social",
    name: "Women & Men in India",
    title: "Women and men",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Women and Men in India",
    crumbTitle: "Women & Men in India, Gender Statistics",
    headline: "Women and men in India, <i>measured side by side.</i>",
    ogTitle: "The balance, measured side by side.",
    blurb: "The sex ratio across seven censuses, and everything that follows it: mortality, fertility, literacy and work, measured side by side and never spliced across sources.",
    description: "Women and Men in India: sex ratio, mortality, fertility, education and work across seventy years, from the multi-source gender compendium.",
    rssDescription: "The long arc of the sex ratio, and the gaps education, work and survival still carry. Revised with each round.",
    stamp: { dateText: "August 2026", vintageText: "Multi-source, latest 2023-24" },
    statusNote: "Multi-source compendium, each indicator its own vintage",
    version: "v1.0",
    currentBundle: "gender-sexratio",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "gender-sexratio", series: "sex_ratio" },
    prose: false,
    register: { id: "reg-gender", label: "Women & Men", unit: "Multi-source, each indicator its own vintage", historyCol: "History" },
    bundles: ["gender-sexratio", "gender-imr", "gender-lifeexp", "gender-mmr", "gender-fertility", "gender-literacy", "gender-work", "gender-states"],
  },
  {
    slug: "mnre",
    no: "11",
    section: "Energy",
    name: "Renewable Energy, MNRE",
    title: "Renewable energy",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Ministry of New and Renewable Energy",
    crumbTitle: "Renewable Power, MNRE",
    headline: "The renewable buildout, <i>month by month.</i>",
    ogTitle: "The buildout, month by month.",
    blurb: "India's renewable capacity, month by month: solar, wind, hydro and bio, including the month the total jumped because a definition changed.",
    description: "India's renewable power installed capacity: solar, wind, hydro and bio, monthly since 2020, with the 2023 large-hydro classification break disclosed.",
    rssDescription: "Solar, wind and the rest of the renewable build-out, counted at the meter. Revised with each release.",
    stamp: { dateText: "August 2026", vintageStyle: "month" },
    statusNote: "Monthly installed capacity, Dec 2023 classification break disclosed",
    version: "v1.0",
    currentBundle: "mnre-sources",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "mnre-sources", series: "grand_total" },
    prose: false,
    register: { id: "reg-mnre", label: "Renewable Energy", unit: "Monthly, MNRE, Jan 2020 to Jun 2026", historyCol: "78 months" },
    bundles: ["mnre-sources", "mnre-solar-categories", "mnre-states", "mnre-states-solar"],
  },
  {
    slug: "nfhs",
    no: "12",
    section: "Health",
    name: "Health, NFHS",
    title: "Family health",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "National Family Health Survey",
    crumbTitle: "National Family Health Survey, NFHS",
    headline: "Most things improved. <i>Anaemia did not.</i>",
    ogTitle: "Most things improved. Anaemia did not.",
    blurb: "Anaemia, child nutrition, maternal care, adult health, fertility and women's empowerment across two national surveys. Most things improved. Anaemia did not.",
    description: "The National Family Health Survey: anaemia, child nutrition, maternal care, adult NCDs, fertility and women's empowerment, NFHS-4 vs NFHS-5, every indicator.",
    rssDescription: "The National Family Health Survey: what two rounds say about anaemia, mortality and the state of care. Revised with each round.",
    stamp: { dateText: "August 2026", vintageText: "NFHS-5, 2019-21" },
    statusNote: "Two survey rounds, NFHS-4 (2015-16) & NFHS-5 (2019-21)",
    version: "v1.0",
    currentBundle: "nfhs-anaemia",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "nfhs-anaemia", custom: "child-anaemia-rounds" },   // series found by label, two rounds
    prose: false,
    register: { id: "reg-nfhs", label: "Health", unit: "NFHS-4 & NFHS-5, cross-sectional", historyCol: "2 rounds", latestCol: "NFHS-5", agoCol: "NFHS-4" },
    bundles: ["nfhs-child", "nfhs-maternal", "nfhs-anaemia", "nfhs-adult", "nfhs-fertility", "nfhs-household", "nfhs-states"],
  },
  {
    slug: "manufacturing",
    no: "13",
    section: "Output",
    name: "Manufacturing, World Bank",
    title: "Manufacturing",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Manufacturing in the World Bank's WDI",
    crumbTitle: "Manufacturing, World Bank WDI",
    headline: "Sixty-five years of <i>making things.</i>",
    ogTitle: "Sixty-five years of making things.",
    blurb: "India's manufacturing since 1960: the share of GDP that never took off, the slow climb toward high technology, and what factories sell abroad. Measured by the World Bank, not MoSPI.",
    description: "Manufacturing in India through the World Bank's WDI: value added since 1960, the UNIDO technology decomposition, and manufactures' share of exports.",
    rssDescription: "Manufacturing value added in India, 1960 to the latest WDI vintage. Revised with each WDI update.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage", vintagePrefix: "WDI vintage " },
    statusNote: "Annual, World Bank WDI, history revised freely",
    version: "v1.0",
    currentBundle: "wdi-manufacturing",
    spark: { bundle: "wdi-manufacturing", series: "mva_pct_gdp" },
    prose: false,
    calendar: "calendar",
    bands: null,
    proseConstants: [100, 1960, 2015],
    register: { id: "reg-manufacturing", label: "Manufacturing", unit: "Annual, World Bank WDI, 1960–2025", historyCol: "1960 to 2025" },
    bundles: ["wdi-manufacturing", "wdi-manufacturing-composition", "wdi-manufacturing-tech", "wdi-manufacturing-exports"],
  },
  {
    slug: "deposits",
    no: "14",
    section: "Money",
    name: "Bank Deposits, BSR-2",
    title: "Where Indians keep their money",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Bank deposits, RBI BSR-2",
    crumbTitle: "Bank deposits, BSR-2",
    headline: "Where Indians keep <i>their money.</i>",
    ogTitle: "Where Indians keep their money.",
    blurb: "How much Indian households hold in savings accounts and fixed deposits, what interest those deposits earn, how long they are locked away, and who holds them.",
    description: "Bank deposits by owner, type, interest rate, maturity and size, from the RBI's annual survey of deposits (BSR-2), March 2005 to March 2026.",
    rssDescription: "Savings accounts and fixed deposits: how much, at what rate, for how long. Revised each year.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },
    statusNote: "Annual, as on 31 March; classification change in 2018-19 disclosed",
    version: "v1.0",
    currentBundle: "deposits-owners",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "deposits-owners", series: "household_total" },
    prose: false,
    register: { id: "reg-deposits", label: "Bank deposits", unit: "Annual, RBI BSR-2, as on 31 March, ₹ lakh crore", historyCol: "Since 2019" },
    bundles: ["deposits-owners", "deposits-owners-2005", "deposits-population", "deposits-term-rates", "deposits-term-maturity", "deposits-term-size", "deposits-term-size-2026"],
  },
  // credit (lb/credit): money, credit and banks
  {
    slug: "credit",
    no: "15",
    section: "Money",
    name: "Money, Credit and Banks",
    title: "Bank credit and money",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Bank credit, money and bank health, RBI",
    crumbTitle: "Money, credit and banks",
    headline: "Who India's banks lend to, <i>and how safely.</i>",
    ogTitle: "Who India's banks lend to.",
    blurb: "Who borrows from India's banks, from farmers and factories to home buyers and gold-loan takers; how fast credit and money grow; where the loans go, state by state; and how the bad-loan cycle of 2015 to 2020 was cleaned up.",
    description: "Bank credit by sector, industry and type of personal loan, money supply (M3), food credit, credit and deposits by state, women's share of loans, and banks' bad loans and capital, from the RBI's data, 1951 to 2026.",
    rssDescription: "Who borrows from India's banks and how fast credit grows. Revised with each monthly sectoral credit release.",
    stamp: { dateStyle: "month", vintageStyle: "vintage" },
    statusNote: "Monthly, revised with each sectoral credit release",
    version: "v1.0",
    currentBundle: "credit-growth",
    proseInputs: ["credit-sectors", "credit-industry"],
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100, 2019, 2023, 2025],   // verifier whitelist: years of the merger and the reporting change
    spark: { bundle: "credit-growth", series: "headline" },
    prose: true,
    register: { id: "reg-credit", label: "Bank credit", unit: "Monthly, all scheduled commercial banks, growth on a year earlier", historyCol: "Since 2020" },
    bundles: ["credit-growth", "credit-sectors", "credit-sectors-2007", "credit-industry", "credit-industry-2007", "credit-scb", "credit-scb-ratios", "credit-food", "credit-money", "credit-money-growth", "credit-money-monthly", "credit-money-annual", "credit-money-ratios", "credit-reserve-money", "credit-reserve-money-weekly", "credit-bank-survey", "credit-rbi-balance-sheet", "credit-depth", "credit-npa", "credit-npa-amounts", "credit-npa-movement", "credit-npa-banks", "credit-loan-quality", "credit-crar", "credit-frauds", "credit-frauds-half-year", "credit-states-cd-annual", "credit-states-annual", "credit-utilisation", "credit-states-cd", "credit-states", "credit-places", "credit-offices", "credit-states-cd-2017", "credit-states-2017", "credit-places-2017", "credit-offices-2017", "credit-states-cd-2004", "credit-states-2004", "credit-places-2004", "credit-offices-2004", "credit-places-annual", "credit-offices-annual", "credit-women", "credit-occupation", "credit-organisation", "credit-size", "credit-interest-rates", "credit-lending-rates", "credit-population-group", "credit-bank-groups", "credit-account-type", "credit-states-bsr1", "credit-states-occupation", "credit-nbfc"],
  },
];
export const bySlug = Object.fromEntries(DOSSIERS.map((d) => [d.slug, d]));

/** "Prices: Consumer Price Index". The page kicker names the topic and the instrument; guides are not numbered. */
export const kicker = (d) => `${d.section}: ${d.kickerTitle}`;
