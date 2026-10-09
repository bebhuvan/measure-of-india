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
    proseInputs: ["cpi-2024-groups", "cpi-2024-states", "cpi-2024-states-sectors", "cpi-2024-items", "cpi-2024-sectors",
      "cpi-2024-rural-divisions", "cpi-2024-urban-divisions", "cpi-2024-states-divisions", "cpiiw-2016"],   // prices wave 2
    currentBundle: "cpi-2024",
    calendar: "fiscal-apr",
    bands: { floor: 2, target: 4, ceiling: 6 },   // policy band, where one exists in law (CPI only)
    proseConstants: [2, 4, 6, 45.86, 6.84, 47.30, 2.38, 6.53, 10.07, 28.32, 100, 2012],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "cpi", series: "headline" },   // retired 2012 base: the long history
    prose: true,
    register: { id: "reg-cpi", label: "Prices", unit: "Monthly, base 2024 from Jan 2026, base 2012 retired Dec 2025", historyCol: "History" },
    bundles: ["cpi", "cpi-rural", "cpi-urban", "cpi-subgroups", "cpi-states", "cpi-states-sectors", "cpialrl-2019", "cpialrl-1986", "cpialrl-groups-2019", "cpi-2024", "cpi-2024-back", "cpi-2024-linked", "cpi-2024-sectors", "cpi-2024-groups", "cpi-2024-items", "cpi-2024-states", "cpialrl-states-1986", "cpialrl-states-2019",
      // ---- prices wave 2 (lb/prices): the deepening; the long tails sit in everyCutFamilies below
      "cpi-2024-classes", "cpi-2024-subclasses", "cpi-2024-back-sectors", "cpi-2024-rural-divisions", "cpi-2024-urban-divisions", "cpi-2024-states-divisions",
      "cpi-groups", "cpi-rural-detail", "cpi-urban-detail", "cpi-items-2012", "cpi-2012-early",
      "cpiiw-2016", "cpiiw-2001", "cpiiw-1982", "cpiiw-1960", "cpiiw-centres-2016", "wages-rural-2013", "wages-rural-1998", "cpialrl-groups-rl-2019", "cpialrl-states-rl-2019", "cpialrl-states-rl-1986"],
    // ---- prices wave 2 (lb/prices): the long tails, each family on its own paged view
    everyCutFamilies: [
      { id: "cpi-2024-sector-levels", label: "Base 2024, rural and urban: groups, classes, sub-classes and items", match: ["cpi-2024-rural-", "cpi-2024-urban-"] },
      { id: "cpi-2024-states-deep", label: "Base 2024, every state by division and by group, combined, rural and urban", match: ["cpi-2024-states-divisions-", "cpi-2024-states-groups"] },
      { id: "cpi-2012-states-deep", label: "Base 2012, every state by group and by sub-group, combined, rural and urban", match: ["cpi-states-groups", "cpi-states-subgroups"] },
      { id: "cpi-2012-early-states", label: "Base 2012, every state, 2012 to 2015 (2012 and 2013 on the NSO back series)", match: ["cpi-2012-early-states"] },
      { id: "cpiiw-centres", label: "CPI for industrial workers, by centre, three bases", match: ["cpiiw-centres-2001", "cpiiw-centres-1982"] },
      { id: "wages-rural-states", label: "Rural daily wages, every state by occupation, two occupation lists", match: ["wages-rural-states-"] },
      { id: "cpialrl-states-deep", label: "CPI-AL and CPI-RL, every state by group, two bases", match: ["cpialrl-states-groups-"] },
    ],
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
    stamp: { dateText: "October 2026", vintageStyle: "vintage" },   // dateText = page-revision month (no bundle fact); vintage derives from gdp-2022 meta.vintage
    statusNote: "Evergreen, revised with each print",
    version: "v1.9",
    proseInputs: ["gdp-2022-expenditure", "gdp-2022-industries", "gdp-2022-accounts", "gdp-2022-nominal"],
    currentBundle: "gdp-2022",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [55.8, 33.5, 9.6, 6, 100, 2011],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "gdp", series: "gdp" },   // retired 2011-12 base: the long history
    prose: true,
    register: { id: "reg-gdp", label: "Output", unit: "Quarterly, 2022-23 base current, 2011-12 base through Q2 FY26", historyCol: "2016 to 2025" },
    bundles: ["gdp-2022", "gdp-2022-expenditure", "gdp-2022-industries", "gdp-2022-nominal", "gdp-2022-accounts", "gdp-2022-annual-levels", "gdp-2022-annual-growth", "gdp-2022-annual-shares", "gdp-2022-annual-industries", "gdp-2022-annual-subindustries", "gdp-2022-annual-gcf-industries", "gdp-2022-sectors", "gdp-2022-revisions", "gdp-2022-quarterly-levels", "gdp-2022-quarterly-shares", "gdp-2022-quarterly-industry-levels", "gdp", "gdp-expenditure", "gdp-accounts", "gdp-industries", "gdp-nominal", "gdp-annual-levels", "gdp-annual-growth", "gdp-annual-shares", "gdp-annual-industries", "gdp-annual-subindustries", "gdp-annual-gcf-industries", "gdp-sectors", "gdp-revisions", "gdp-quarterly-levels", "gdp-quarterly-shares", "gdp-quarterly-industry-levels", "gdp-back", "gdp-back-levels", "gdp-back-growth", "gdp-back-shares", "gdp-back-industries", "gdp-back-subindustries"],
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
    proseInputs: ["wpi-2022-groups", "wpi-2022-subgroups", "wpi-2022-items", "wpi-2022-subsubgroups"],   // subsubgroups: prices wave 2
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100, 2011, 2022, 2023],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "wpi", series: "headline" },   // retired 2011-12 base: the long history
    prose: true,
    register: { id: "reg-wpi", label: "Wholesale prices", unit: "Monthly, provisional, 2022-23 base current, 2011-12 base through April 2026", historyCol: "2016 to 2026" },
    bundles: ["wpi", "wpi-groups", "wpi-subgroups", "wpi-items", "wpi-2022", "wpi-2022-groups", "wpi-2022-subgroups", "wpi-2022-items",
      // ---- prices wave 2 (lb/prices): sub-sub-groups and the two retired bases
      "wpi-subsubgroups", "wpi-2022-subsubgroups", "wpi-2004", "wpi-1993"],
    everyCutFamilies: [
      { id: "wpi-2004-tree", label: "Base 2004-05, the whole tree: groups, sub-groups, sub-sub-groups and items", match: ["wpi-2004-"] },
      { id: "wpi-1993-tree", label: "Base 1993-94, the whole tree: groups, sub-groups, sub-sub-groups and items", match: ["wpi-1993-"] },
    ],
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
    kickerTitle: "Balance of payments, reserves and the rupee",
    crumbTitle: "The External Account",
    headline: "What the country earns abroad, <i>and what it owes.</i>",
    ogTitle: "What the country earns abroad, and what it owes.",
    blurb: "India's account with the world: the current account, foreign money in and out, reserves week by week, the rupee against a basket, external debt, and the money families send and receive.",
    description: "India's balance of payments on RBI data to the latest quarter: the current account, FDI and portfolio flows, weekly reserves, the rupee's real exchange rate, external debt, remittances and the LRS, every line the RBI publishes.",
    rssDescription: "The balance of payments, reserves, the rupee and external debt, on RBI data. Revised with each release.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },   // the page mixes weekly, monthly and quarterly data: dated by data vintage
    statusNote: "Quarterly balance of payments, weekly reserves, monthly flows",
    version: "v2.0",
    // 2026-10: rebuilt on RBI DBIE (lb/external). The headline is the quarterly balance of
    // payments; the weekly reserves and monthly flows sit beside it as prose inputs.
    currentBundle: "external-bop",
    proseInputs: ["external-bop-gross", "external-reserves-weekly", "external-reer-2015"],
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: the REER base (2015-16 = 100)
    spark: { bundle: "external-reserves-weekly", series: "total_usd" },
    prose: true,
    register: { id: "reg-ext", label: "External", unit: "Quarterly BoP, weekly reserves, monthly flows; RBI DBIE", historyCol: "History" },
    bundles: [
      // the page draws these
      "external-bop", "external-bop-gross", "external-bop-vintages", "external-bop-indicators", "external-bop-annual-head",
      "external-invisibles-people", "external-iip-head", "external-reserves-weekly", "external-reserves-monthly",
      "external-intervention", "external-forward-book", "external-rupee", "external-reer-2015", "external-reer6-2022",
      "external-fdi", "external-fpi", "external-lrs", "external-debt-annual", "external-debt-sector-inr", "external-nri", "external-invoicing", "external-ecb-2025",
      // every other line the RBI publishes, baked for download and the every-cut table
      "external-bop-lines", "external-bop-inr-lines", "external-bop6-lines", "external-bop6-vintages", "external-bop6-inr-lines", "external-bop-annual", "external-bop-annual-inr", "external-bop-annual-overall", "external-bop-annual-overall-inr", "external-bop6-annual-lines", "external-bop6-annual-lines-inr",
      "external-invisibles", "external-invisibles-annual", "external-invisibles-annual-inr", "external-iip", "external-iip-inr", "external-iip-summary", "external-iip-summary-inr", "external-iip-bpm5", "external-iip-bpm5-inr",
      "external-reserves-weekly-inr", "external-reserves-monthly-inr", "external-reserves-annual", "external-intervention-inr", "external-fx-turnover", "external-fx-turnover-daily", "external-forward-premia-paise-daily",
      "external-forward-premia", "external-forward-premia-daily", "external-rupee-sdr", "external-rupee-daily", "external-rupee-interbank-daily", "external-rupee-155",
      "external-rupee-highlow", "external-rupee-month-extremes", "external-rupee-annual", "external-rupee-annual-calendar",
      "external-reer-1985", "external-reer-1993", "external-reer-2004", "external-reer-1993-calendar", "external-reer-1993-fiscal", "external-reer-2004-calendar", "external-reer-2004-fiscal",
      "external-reer-2015-calendar", "external-reer-2015-fiscal", "external-reer6-2015-calendar", "external-reer6-2015-fiscal", "external-reer6-1993", "external-reer6-2003", "external-reer6-2004", "external-reer6-2015", "external-reer6-2018",
      "external-fdi-1995", "external-fdi-yearly", "external-fdi-annual", "external-fdi-annual-inr", "external-fdi-annual-new", "external-fdi-annual-new-inr", "external-ecb", "external-ecb-annual",
      "external-lrs-annual", "external-nri-annual", "external-nri-annual-inr", "external-debt", "external-debt-inr", "external-debt-annual-inr",
      "external-assistance", "external-assistance-inr", "external-mf", "external-mf-inr",
    ],
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
    version: "v1.4",
    // the dated prose describes the current ruler (the revamped design, from January 2025):
    // facts.mjs refuses a sibling on the original design's base
    proseInputs: ["plfs-cuts", "plfs-monthly-age", "plfs-q25"],
    currentBundle: "plfs-monthly",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "plfs-monthly", series: "ur" },
    prose: true,
    register: { id: "reg-plfs", label: "Labour", unit: "Monthly, quarterly, annual, CWS & PS+SS, never spliced", historyCol: "History" },
    // jobs-deep (2026-10-10): the whole PLFS cube, both survey designs
    everyCutFamilies: [
      { id: "plfs-states-annual", label: "LFPR, WPR and UR for every state, annual (agriculture and calendar years)", match: ["plfs-ay-states-", "plfs-cy-states-", "plfs-cy25-states-"] },
      { id: "plfs-states-quarterly", label: "LFPR, WPR and UR for the bulletin's 22 states, quarterly", match: ["plfs-quarterly-states-", "plfs-q25-states-"] },
      { id: "plfs-workers-by-state", label: "Kinds of work in every state: status, industry, occupation, enterprise", match: ["plfs-ay-workers-", "plfs-cy-workers-", "plfs-cy25-workers-"] },
      { id: "plfs-pay-and-conditions", label: "Earnings and job conditions in every state", match: ["plfs-earnings-cuts", "plfs-cy-earnings", "plfs-cy25-earnings", "plfs-conditions"] },
    ],
    bundles: ["plfs-monthly", "plfs-quarterly", "plfs-annual", "plfs-cuts", "plfs-states", "plfs-status", "plfs-earnings", "plfs-education",
      "plfs-monthly-age", "plfs-q25", "plfs-q25-industry", "plfs-quarterly-cuts", "plfs-quarterly-industry", "plfs-ay-india", "plfs-cy-india", "plfs-cy25-india"],
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
    version: "v1.2",
    proseInputs: ["hces-fractiles", "hces-states", "hces-categories", "hces-gini", "hces-social", "hces-states-imputed", "hces-gini-states"],
    currentBundle: "hces-mpce",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "hces-fractiles", custom: "fractile-ladder" },   // 12-point rural ladder, 2023-24 round
    prose: true,
    register: { id: "reg-hces", label: "Consumption", unit: "Annual survey, rounds 2022-23 & 2023-24", historyCol: "History" },
    bundles: ["hces-mpce", "hces-states", "hces-fractiles", "hces-categories", "hces-gini", "hces-social", "hces-household-type", "hces-quantities", "hces-item-values", "hces-categories-states", "hces-states-imputed", "hces-fractiles-states", "hces-categories-inr", "hces-categories-imputed", "hces-categories-states-imputed", "hces-categories-inr-states", "hces-categories-inr-states-imputed", "hces-quantities-states", "hces-item-values-states", "hces-household-type-states", "hces-social-states", "hces-gini-states"],
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
    version: "v1.2",
    currentBundle: "aishe-headline",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "aishe-headline", series: "enrolment" },
    prose: false,
    register: { id: "reg-aishe", label: "Higher Education", unit: "Annual, AISHE, 2017-18 to 2021-22", historyCol: "5 rounds" },
    bundles: ["aishe-headline", "aishe-access", "aishe-composition", "aishe-states", "aishe-teachers", "aishe-minority", "aishe-states-institutions", "aishe-states-enrolment", "aishe-states-social", "aishe-states-minority", "aishe-states-ger", "aishe-ptr", "aishe-states-teachers"],
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
    version: "v1.1",
    currentBundle: "mnre-sources",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "mnre-sources", series: "grand_total" },
    prose: false,
    register: { id: "reg-mnre", label: "Renewable Energy", unit: "Monthly, MNRE, Jan 2020 to Jun 2026", historyCol: "78 months" },
    bundles: ["mnre-sources", "mnre-solar-categories", "mnre-states", "mnre-states-solar", "mnre-bio-categories", "mnre-states-wind", "mnre-states-hydro", "mnre-states-bio"],
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
    version: "v1.1",
    currentBundle: "deposits-owners",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "deposits-owners", series: "household_total" },
    prose: false,
    register: { id: "reg-deposits", label: "Bank deposits", unit: "Annual, RBI BSR-2, as on 31 March, ₹ lakh crore", historyCol: "Since 2019" },
    bundles: ["deposits-owners", "deposits-owners-2005", "deposits-population", "deposits-term-rates", "deposits-term-maturity", "deposits-term-size", "deposits-term-size-2026", "deposits-sectors", "deposits-sectors-2005", "deposits-age", "deposits-states-owners", "deposits-states-type", "deposits-districts", "deposits-districts-gender", "deposits-bankgroups-sectors", "deposits-employees-bankgroups", "deposits-employees-states", "deposits-maturity-owners", "deposits-q-sectors"],
    everyCutFamilies: [{ id: "bsr2-annual", label: "Every other annual BSR-2 table", match: ["deposits-states-sectors", "deposits-metros-sectors", "deposits-population-type", "deposits-bankgroups-type", "deposits-population-owners", "deposits-bankgroups-owners", "deposits-states-population-type", "deposits-states-bankgroups-type", "deposits-bankgroups-population-type", "deposits-maturity-population", "deposits-maturity-bankgroups", "deposits-maturity-population-owners", "deposits-maturity-states", "deposits-states-2010"] }, { id: "bsr2-quarterly", label: "The quarterly BSR-2 (excluding regional rural banks)", match: "deposits-q-" }],
  },
  // ---- bis family session: debt and housing (BIS backbone; RBI HPI and NHB RESIDEX as rulers) ----
  {
    slug: "debt",
    no: "15",
    section: "Money",
    name: "Debt, BIS total credit",
    title: "How much India owes",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Debt, BIS total credit statistics",
    crumbTitle: "Debt, BIS total credit",
    headline: "Who owes what, <i>and can they pay?</i>",
    ogTitle: "Who owes what, and can they pay?",
    blurb: "What India's households, companies and government owe, as a share of the economy; the credit gap central banks watch for booms; how much income goes on repayments; and how India compares with China, the US and its peers.",
    description: "India's debt by borrower: households, companies and government as a share of GDP since 1951, the credit-to-GDP gap, the debt service ratio, foreign-currency borrowing, and 13 economies for comparison. Bank for International Settlements data.",
    rssDescription: "Household, company and government debt as a share of GDP, the credit gap and the debt service ratio. Revised each quarter.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },
    statusNote: "Quarterly, BIS; revised as national sources revise",
    version: "v1.0",
    currentBundle: "bis-credit",
    calendar: "calendar",
    bands: null,
    proseConstants: [100, 2, 10],   // per 100 of GDP; the Basel buffer thresholds of 2 and 10 points of gap
    spark: { bundle: "bis-credit", series: "total" },
    prose: true,
    proseInputs: ["bis-credit-gap", "bis-dsr"],
    register: { id: "reg-debt", label: "Debt", unit: "Quarterly, BIS, % of GDP", historyCol: "Since 2007" },
    bundles: ["bis-credit", "bis-credit-inr", "bis-credit-usd", "bis-credit-gap", "bis-dsr", "bis-gli", "bis-policy-rate", "bis-policy-rate-daily", "bis-xru-quarterly", "bis-xru-monthly", "bis-xru-annual", "bis-eer", "bis-eer-daily",
      "bis-peer-usa", "bis-peer-chn", "bis-peer-emu", "bis-peer-gbr", "bis-peer-jpn", "bis-peer-kor", "bis-peer-idn", "bis-peer-bra", "bis-peer-zaf", "bis-peer-mex", "bis-peer-tur", "bis-peer-aus", "bis-peer-can"],
  },
  {
    slug: "housing",
    no: "16",
    section: "Prices",
    name: "House prices, BIS, RBI and NHB",
    title: "House prices",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "House prices, BIS, RBI HPI and NHB RESIDEX",
    crumbTitle: "House prices",
    headline: "What a home costs, <i>city by city.</i>",
    ogTitle: "What a home costs, city by city.",
    blurb: "Whether homes are getting dearer faster than everything else, which cities rose most, and why three official measures of house prices tell slightly different stories.",
    description: "Indian house prices on three rulers: BIS residential property prices (nominal and real), the RBI's house price index for 18 cities, and NHB RESIDEX for 50 cities with prices per square foot. Quarterly, 2009 to 2026.",
    rssDescription: "House prices, nominal and real, and by city, on the BIS, RBI and NHB measures. Revised each quarter.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },
    statusNote: "Quarterly; three rulers, never joined",
    version: "v1.0",
    currentBundle: "bis-property",
    calendar: "calendar",
    bands: null,
    proseConstants: [100, 2010],
    spark: { bundle: "bis-property", series: "real" },
    prose: true,
    proseInputs: ["housing-rbi-2022-yoy", "bis-property-cities"],
    register: { id: "reg-housing", label: "House prices", unit: "Quarterly, BIS, index 2010 = 100", historyCol: "Since 2009" },
    bundles: ["bis-property", "bis-property-cities", "bis-property-10cities", "housing-rbi-2022", "housing-rbi-2022-yoy", "housing-rbi-2010", "housing-rbi-2010-yoy", "housing-rbi-2009",
      "housing-residex-2025", "housing-residex-prices-2025", "housing-residex-2018", "housing-residex-prices-2018", "housing-residex-2013", "housing-residex-prices-2013", "bis-cpi-long", "bis-cpi-long-annual"],
  },
  // ---- end bis family ----
  // ---- services ----
  {
    slug: "services",
    no: "17",
    section: "Output",
    name: "Services",
    title: "Services",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Services in the national accounts, trade, jobs and enterprises",
    crumbTitle: "Services",
    headline: "More than half the economy, <i>mostly unseen.</i>",
    ogTitle: "More than half the economy, mostly unseen.",
    blurb: "The shop, the bus, the bank, the clinic and the software firm: how big India's services are, which are growing, what India sells to the world, and who does the work.",
    description: "India's services: their share of GDP by industry, the trial monthly Index of Services Production, services exports by category since 1950-51, services jobs from PLFS and informal service enterprises from ASUSE.",
    rssDescription: "Services output, trade, jobs and enterprises from MoSPI and the RBI. Revised with each release.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },
    statusNote: "New guide, revised with each release",
    version: "v1.0",
    currentBundle: "services-gva-2022-share",
    proseInputs: ["services-gva-2022-growth", "services-isp-growth", "services-trade-monthly"],
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100, 19, 2022, 2023, 2024, 2025, 60],   // 19 ISP sub-sectors, ~60% coverage, the bases
    spark: { bundle: "services-gva-2022-share", series: "services" },
    prose: true,
    register: { id: "reg-services", label: "Services", unit: "Annual share of GVA, 2022-23 base; monthly trade and ISP", historyCol: "Since 2022-23" },
    bundles: ["services-gva-2022-share", "services-gva-2022-growth", "services-gva-2022-level", "services-gva-2011-share", "services-gva-2011-growth", "services-gva-2011-level",
      "gdp-2022-industries", "isp", "services-isp-growth", "services-isp-annual",
      "services-trade-monthly", "services-bop-quarterly", "services-invisibles-quarterly", "services-bop-annual",
      "services-jobs-cy25", "services-jobs-cy", "services-jobs-ay", "services-asuse", "services-asuse-profile", "services-asuse-2025", "services-asuse-profile-2025", "asuse-sectors"],
  },
  // ---- end services ----
  // --- states (state economies) ---
  {
    slug: "states",
    no: "18",
    section: "Output",
    name: "State economies",
    title: "State economies",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "State domestic product, MoSPI and RBI",
    crumbTitle: "State economies",
    headline: "One country, <i>many economies.</i>",
    ogTitle: "One country, many economies.",
    blurb: "How big each state's economy is, how fast it grows, how much it produces per person, and what it runs on: farms, factories or services. From Sikkim and Goa to Bihar.",
    description: "State domestic product for every state and union territory: GSDP, income per person, growth, industry mix and state finances, 2011-12 to 2025-26, from MoSPI and the RBI Handbook of Statistics on Indian States.",
    rssDescription: "The size, speed and shape of every state's economy. Revised when states publish new estimates.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },
    statusNote: "Annual, revised as each state publishes; 2011-12 base",
    version: "v1.0",
    currentBundle: "states-spread",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100, 2011, 2012, 2014, 2019],   // base year 2011-12, the 2014 and 2019 splits
    spark: { bundle: "states-spread", series: "gap_current" },
    prose: true,
    // no proseInputs: every state bundle is ragged (states publish different latest years), and
    // the facts sheet's deep-cut summaries would set one state's 2025-26 beside another's
    // 2024-25. The prose speaks for the fixed panel only, one year throughout.
    register: { id: "reg-states", label: "State economies", unit: "Annual, MoSPI regional accounts, 2011-12 base", historyCol: "2011-12 to latest" },
    // every-cut: all 208 Handbook bundles share one paged long-tail view (framework, round 2)
    everyCutFamilies: [{ id: "handbook", label: "RBI Handbook of Statistics on Indian States", match: "states-hbs-" }],
    // the guide's own bundles plus the Handbook tables it draws on; all 208 Handbook bundles
    // are listed by section on the page (§12), from data/coverage/states.hbs-index.json
    bundles: ["states-spread", "states-pcnsdp-current", "states-pcnsdp-constant", "states-pcgsdp-current", "states-pcgsdp-constant", "states-gsdp-current", "states-gsdp-constant", "states-nsdp-current", "states-nsdp-constant", "states-growth-real", "states-growth-nominal", "states-structure", "states-industry-shares", "states-finances", "states-gsva-current", "states-gsva-constant", "states-nsva-current", "states-nsva-constant", "states-taxes-current", "states-taxes-constant", "states-hbs-t021", "states-hbs-t164", "states-hbs-t165", "states-hbs-t168", "states-hbs-t176"],
  },
  // --- worldbank family session (2026-10-09): poverty (World Bank PIP), population (UN WPP, WDI) ---
  {
    slug: "poverty",
    no: "19",
    section: "Consumption",
    name: "Poverty and inequality, World Bank PIP",
    title: "Poverty and inequality",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Poverty and inequality, World Bank PIP",
    crumbTitle: "Poverty and inequality, PIP",
    headline: "How many Indians are poor <i>depends on the line.</i>",
    ogTitle: "How many Indians are poor depends on the line.",
    blurb: "The share of Indians living below the World Bank's international poverty lines, from every consumption survey since 1977-78: what each line means in rupees, why the numbers people quote differ, and what a decade without a survey did to what we know.",
    description: "Poverty and inequality in India from the World Bank's Poverty and Inequality Platform: headcounts at $3.00, $4.20 and $8.30 a day (2021 PPP), the poverty gap, the Gini index and consumption shares by decile, survey by survey since 1977-78.",
    rssDescription: "The share of Indians below the World Bank's poverty lines, survey by survey. Revised with each PIP release.",
    stamp: { dateStyle: "release", vintageStyle: "release", vintagePrefix: "PIP release " },
    statusNote: "Revised with each PIP release, twice a year",
    version: "v1.0",
    currentBundle: "poverty-pip-2022",
    calendar: "calendar",
    bands: null,
    proseConstants: [3, 4.2, 8.3, 3.0, 4.20, 8.30, 2021, 2011, 100, 10, 40],   // the three lines, the PPP year, the last official line (2011-12), decile arithmetic
    spark: { bundle: "poverty-pip-lineup", series: "headcount_3_00" },
    prose: true,
    proseInputs: [],   // the lineup and older spells are other rulers: facts.mjs keeps them out of the sheet
    register: { id: "reg-poverty", label: "Poverty", unit: "Survey years, World Bank PIP, 2021 PPP", historyCol: "Lineup, 1981 to 2023", latestCol: "2023-24", agoCol: "2022-23" },
    bundles: ["poverty-pip-2022", "poverty-pip-2011", "poverty-pip-1993", "poverty-pip-1987", "poverty-pip-1983", "poverty-pip-1977", "poverty-pip-lineup", "poverty-wdi"],
  },
  {
    slug: "population",
    no: "20",
    section: "Social",
    name: "Population, UN WPP and World Bank",
    title: "Population",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Population, UN World Population Prospects",
    crumbTitle: "Population, UN WPP",
    headline: "How many of us, <i>and how old.</i>",
    ogTitle: "How many of us, and how old.",
    blurb: "India's population since 1950 and the UN's projections to 2100: how old the country is, when its working-age share peaks, how fast fertility fell, how long people live, and how fast its cities grow.",
    description: "India's population from the UN World Population Prospects 2024 and the World Bank's WDI: estimates from 1950, projections to 2100 drawn as projections, age structure, dependency, fertility, life expectancy, urbanisation and migration.",
    rssDescription: "India's population, age structure, fertility, cities and migration, from the UN and the World Bank. Revised with each WPP revision.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage", vintagePrefix: "WPP 2024, vintage " },
    statusNote: "Revised with each UN WPP revision, every two years",
    version: "v1.0",
    currentBundle: "population-wpp",
    calendar: "calendar",
    bands: null,
    proseConstants: [2.1, 15, 64, 65, 100, 1000, 1950, 2011, 2024, 2100],   // replacement fertility, the age bands, census and WPP years
    spark: { bundle: "population-wpp", series: "tpopulation1july" },
    prose: true,
    proseInputs: ["population-wpp-age"],   // estimates only: projections are drawn on the plates, never narrated from the sheet
    register: { id: "reg-population", label: "Population", unit: "Annual, UN WPP 2024 estimates, 1950 to 2023", historyCol: "1950 to 2023" },
    bundles: ["population-wpp", "population-wpp-projection", "population-wpp-variants", "population-wpp-age", "population-wpp-age-projection", "population-wdi", "population-wdi-vital", "population-wdi-urban", "population-wdi-migration"],
  },
  // --- end worldbank family block ---
  // --- climate (lb/climate) ---
  {
    slug: "climate",
    no: "21",
    section: "Environment",
    name: "Climate and temperature",
    title: "Climate and heat",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Temperature, rain, emissions and projections",
    crumbTitle: "Climate and temperature",
    headline: "How much hotter India has become, <i>and what comes next.</i>",
    ogTitle: "How much hotter India has become.",
    blurb: "A century of Indian temperature and rain, the heat people actually live through, what India emits against China, the US and the world, and what the climate models project for a child born today.",
    description: "India's changing climate as an economic fact: warming since 1901, by month and by state; hot nights and humid heat; the monsoon; emissions and the energy mix; and CMIP6 projections to 2100.",
    rssDescription: "India's temperature, monthly, against the 1991-2020 normal, with the long record, the heat, the monsoon, emissions and projections. Revised as the data move.",
    stamp: { dateStyle: "month", vintageStyle: "month" },
    statusNote: "Monthly temperature, records since 1901, projections to 2100",
    version: "v1.0",
    currentBundle: "climate-temp-monthly",
    // same instrument as the current bundle (ERA5, OWID); facts.mjs refuses mixed rulers. The ERA5
    // rain total runs above the IMD all-India figure readers know, so it stays out of the prose
    proseInputs: ["climate-temp-annual"],
    calendar: "calendar",
    bands: null,
    // structural numbers the prose may cite: baseline years and the reference windows
    proseConstants: [100, 1901, 1940, 1951, 1980, 1991, 2020, 26, 27, 35, 40, 41],
    spark: { bundle: "climate-temp-annual", series: "temperature_anomaly" },
    prose: true,
    register: { id: "reg-climate", label: "Climate", unit: "Monthly ERA5 anomaly from 1991-2020; annual records from 1901 (CRU) and 1950 (ERA5)", historyCol: "Since 1940" },
    bundles: ["climate-temp-monthly", "climate-burned-area","climate-cmip6-energy","climate-cmip6-energy-hist","climate-cmip6-heatstress","climate-cmip6-heatstress-hist","climate-cmip6-hotdays","climate-cmip6-hotdays-hist","climate-cmip6-rain","climate-cmip6-rain-hist","climate-cmip6-states-energy","climate-cmip6-states-heatstress","climate-cmip6-states-hotdays","climate-cmip6-states-rain","climate-cmip6-states-temp","climate-cmip6-temp","climate-cmip6-temp-hist","climate-cmip6-windows-energy","climate-cmip6-windows-heatstress","climate-cmip6-windows-hotdays","climate-cmip6-windows-rain","climate-cmip6-windows-temp","climate-co2","climate-co2-chn","climate-co2-usa","climate-co2-world","climate-cru","climate-cru-monthly","climate-cru-states","climate-energy","climate-energy-chn","climate-energy-usa","climate-energy-world","climate-era5-energy","climate-era5-energy-monthly","climate-era5-heatstress","climate-era5-heatstress-monthly","climate-era5-hotdays","climate-era5-hotdays-monthly","climate-era5-rain","climate-era5-rain-monthly","climate-era5-states-energy","climate-era5-states-heatstress","climate-era5-states-hotdays","climate-era5-states-rain","climate-era5-states-temp","climate-era5-temp","climate-era5-temp-monthly","climate-heat-deaths","climate-opinion-youth","climate-rain-owid","climate-seasons-cru","climate-seasons-era5-energy","climate-seasons-era5-heatstress","climate-seasons-era5-hotdays","climate-seasons-era5-rain","climate-seasons-era5-temp","climate-temp-annual","climate-temp-decadal","climate-warming-contrib","climate-wildfires","climate-wildfires-weekly"],
  },
  // --- end climate ---
  // ---- ilo (ILOSTAT) ----
  {
    slug: "ilo",
    no: "22",
    section: "Work",
    name: "Work in India, ILO estimates",
    title: "Work, as the ILO counts it",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "ILOSTAT, the ILO's labour statistics",
    crumbTitle: "Work, ILO estimates",
    headline: "How India works, <i>by the world's yardstick.</i>",
    ogTitle: "How India works, by the world's yardstick.",
    blurb: "How many Indians work, why so few women are counted at work, how many young people are neither working nor studying, and how India compares with China, Bangladesh, Indonesia and Vietnam, on the ILO's common definitions.",
    description: "Work in India through ILOSTAT: the ILO's modelled estimates since 1990 beside its own processing of PLFS, NSS and Census data, with four peer countries on the same definitions.",
    rssDescription: "Work in India on the ILO's definitions: participation, unemployment, informality, working poverty and earnings. Revised with each ILO edition.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage", vintagePrefix: "ILOSTAT vintage " },
    statusNote: "Annual, ILO modelled estimates and survey series, history revised each edition",
    version: "v1.0",
    currentBundle: "ilo-est-eap-2wap",
    proseInputs: ["ilo-est-emp-2wap", "ilo-est-une-2eap", "ilo-est-eip-2eet", "ilo-est-lap-2gdp", "ilo-est-how-2emp"],
    calendar: "calendar",
    bands: null,
    proseConstants: [15, 24, 25, 100, 1990, 1991, 3, 4.2],   // ages, the ILO's $3 and $4.20 lines, the model's first years
    spark: { bundle: "ilo-est-eap-2wap", series: "eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15" },
    prose: true,
    register: { id: "reg-ilo", label: "Work, ILO", unit: "Annual, ILO modelled estimates and ILO processing of PLFS", historyCol: "Since 1990" },
    bundles: ["ilo-est-eap-2wap", "ilo-est-emp-2wap", "ilo-est-une-2eap", "ilo-est-eip-2eet", "ilo-est-emp-2emp",
      "ilo-est-lap-2gdp", "ilo-est-lap-2lid", "ilo-est-how-2emp", "ilo-est-gdp-211p", "ilo-est-projections",
      "ilo-plfs-eap", "ilo-nss-eap", "ilo-census", "ilo-plfs-une", "ilo-nss-une", "ilo-plfs-sdg", "ilo-nss-more",
      "ilo-plfs-ear", "ilo-peer-chn", "ilo-peer-bgd", "ilo-peer-idn", "ilo-peer-vnm", "plfs-annual", "ilo-adm-ir",
      "ilo-adm-lir", "ilo-emi", "ilo-est-cld-2pop", "ilo-est-eap-2eap", "ilo-est-eip-2eip", "ilo-est-eip-2wap",
      "ilo-est-emp-2fte", "ilo-est-emp-2tru", "ilo-est-gdp-205u", "ilo-est-gdp-2hrw", "ilo-est-gdp-2tot",
      "ilo-est-how-2tdp", "ilo-est-how-2tot", "ilo-est-luu-2lu2", "ilo-est-pop-2ldr", "ilo-est-pop-2pop",
      "ilo-est-pop-2wap", "ilo-est-sdg-0111", "ilo-est-sdg-0821", "ilo-est-sdg-1041", "ilo-est-sdg-b821",
      "ilo-est-une-2une", "ilo-eus-estimates", "ilo-ihd", "ilo-ilo-estimates", "ilo-ilo-policy", "ilo-ilo-textual",
      "ilo-legislation", "ilo-mea", "ilo-moia", "ilo-nss-ear", "ilo-nss-ees", "ilo-nss-eip", "ilo-nss-emp",
      "ilo-nss-pop", "ilo-official", "ilo-plfs-ees", "ilo-plfs-eip", "ilo-plfs-emp", "ilo-plfs-how", "ilo-plfs-more",
      "ilo-plfs-pop", "ilo-plfs-q", "ilo-special", "ilo-ssi"],
  },
  // --- rates (atlas-rates family session, 2026-10) ---
  {
    slug: "rates",
    no: "23",
    section: "Money",
    name: "Interest Rates and Monetary Policy",
    title: "Interest rates",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Interest rates and monetary policy, RBI",
    crumbTitle: "Interest rates, RBI",
    headline: "The price of <i>money.</i>",
    ogTitle: "The price of money.",
    blurb: "What the RBI decides and why, every MPC vote since 2016, and how a change in the repo rate reaches your home loan, your fixed deposit and the government's borrowing.",
    description: "Interest rates in India: the repo rate since 1935, every Monetary Policy Committee decision and vote, lending and deposit rates by bank, call money, Treasury bills, the bond yield curve, state borrowing costs and real interest rates.",
    rssDescription: "The repo rate, the MPC's votes, and what banks charge and pay. Revised after each policy meeting and each monthly lending-rate release.",
    stamp: { dateStyle: "vintageMonth", vintageStyle: "vintage" },   // the latest decision is the data vintage of rates-monthly
    statusNote: "Revised after each MPC meeting and monthly rate release",
    version: "v1.0",
    currentBundle: "rates-monthly",
    calendar: "fiscal-apr",
    bands: null,   // the 2-6% band is for inflation, not for interest rates
    proseConstants: [4, 2, 6, 25, 100, 2016, 2011, 2019, 2022],   // the inflation target and band (law), a 25 bp step, the MPC (2016), the corridor and benchmark reforms
    spark: { bundle: "rates-monthly", series: "repo" },
    prose: true,
    proseInputs: ["rates-mpc", "rates-lending", "rates-real"],
    register: { id: "reg-rates", label: "Interest rates", unit: "Policy rates as decided; lending and deposit rates monthly; per cent a year", historyCol: "Since 2016" },
    bundles: ["rates-monthly", "rates-policy", "rates-mpc", "rates-mpc-votes", "rates-lending", "rates-mclr", "rates-mclr-banks", "rates-walr-sectors", "rates-walr-occupation", "rates-benchmarks",
      "rates-wss", "rates-real", "rates-real-cpi2012", "rates-call-daily", "rates-call-daily-detail", "rates-call-monthly", "rates-money-market", "rates-mibor", "rates-liquidity", "rates-laf", "rates-omo", "rates-market-repo",
      "rates-cd", "rates-cp", "rates-tbill-91", "rates-tbill-182", "rates-tbill-364", "rates-tbill-cmb", "rates-tbill-14", "rates-tbill-sgl", "rates-gsec-curve", "rates-gsec-annual", "rates-gsec-auctions", "rates-gsec-auctions-fy",
      "rates-sdl-states", "rates-borrowing", "rates-borrowing-weekly", "rates-state-borrowing", "rates-state-borrowing-monthly", "rates-structure", "rates-walr-1992", "rates-walr-groups-2005"],
  },
  // credit (lb/credit): money, credit and banks
  {
    slug: "credit",
    no: "24",
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
    // the 228 RBI tables baked as published (credit-deep.mjs), listed by family on their own pages
    everyCutFamilies: [
      { id: "rbi-bsr1-tables", label: "RBI BSR-1 tables: bank credit by place, occupation, borrower, loan size and interest rate", match: "credit-deep-bsr1" },
      { id: "rbi-spatial-tables", label: "RBI spatial statements: deposits, credit and offices by state, bank group and population group", match: "credit-deep-spatial-" },
      { id: "rbi-trend-progress-tables", label: "RBI Trend and Progress of Banking tables: banks, co-operatives, NBFCs and financial institutions", match: "credit-deep-tp-" },
      { id: "rbi-money-banking-tables", label: "Other RBI money, banking and bank-health tables", match: "credit-deep-" },
    ],
    bundles: ["credit-growth", "credit-sectors", "credit-sectors-ex-merger", "credit-sectors-2007", "credit-industry", "credit-industry-2007", "credit-scb", "credit-scb-ratios", "credit-food", "credit-money", "credit-money-growth", "credit-money-monthly", "credit-money-annual", "credit-money-ratios", "credit-reserve-money", "credit-reserve-money-weekly", "credit-bank-survey", "credit-rbi-balance-sheet", "credit-depth", "credit-npa", "credit-npa-amounts", "credit-npa-movement", "credit-npa-movement-banks", "credit-npa-banks", "credit-loan-quality", "credit-loan-quality-banks", "credit-crar", "credit-frauds", "credit-frauds-half-year", "credit-states-cd-annual", "credit-states-annual", "credit-utilisation", "credit-states-cd", "credit-states", "credit-places", "credit-places-states", "credit-offices", "credit-states-cd-2017", "credit-states-2017", "credit-places-2017", "credit-places-states-2017", "credit-offices-2017", "credit-states-cd-2004", "credit-states-2004", "credit-places-2004", "credit-places-states-2004", "credit-offices-2004", "credit-places-annual", "credit-places-states-annual", "credit-offices-annual", "credit-women", "credit-women-districts", "credit-occupation", "credit-organisation", "credit-size", "credit-interest-rates", "credit-lending-rates", "credit-population-group", "credit-bank-groups", "credit-account-type", "credit-states-bsr1", "credit-states-occupation", "credit-nbfc", "credit-deep-cash-balances", "credit-deep-standing-facilities", "credit-deep-liquidity-aggregates", "credit-deep-monetary-survey", "credit-deep-rbi-survey", "credit-deep-flow-of-resources", "credit-deep-credit-to-commercial-sector", "credit-deep-money-components-annual", "credit-deep-money-sources-annual", "credit-deep-average-money", "credit-deep-reserve-money-annual", "credit-deep-rbi-accounts-annual", "credit-deep-money-growth-annual", "credit-deep-monetary-ratios", "credit-deep-sectoral-annual-old", "credit-deep-sectoral-annual", "credit-deep-sectoral-annual-long", "credit-deep-industry-annual-long", "credit-deep-industry-annual", "credit-deep-savings-deposits", "credit-deep-rrb-indicators", "credit-deep-credit-population-annual", "credit-deep-deposits-population-annual", "credit-deep-branches-population", "credit-deep-bank-balance-sheet", "credit-deep-cooperative-npa", "credit-deep-bank-employees", "credit-deep-shg", "credit-deep-pacs", "credit-deep-state-cooperative-banks", "credit-deep-term-deposit-maturity", "credit-deep-agri-institutional", "credit-deep-agri-short-term", "credit-deep-agri-long-term", "credit-deep-agri-indirect", "credit-deep-agri-scb", "credit-deep-farmers-landholding-short", "credit-deep-farmers-landholding-long", "credit-deep-small-industries", "credit-deep-sick-units", "credit-deep-food-procurement", "credit-deep-exporters", "credit-deep-notes-coins", "credit-deep-nbfc-deposits", "credit-deep-nbfc-financials", "credit-deep-nbfc-sectors-2016", "credit-deep-bsr1-pop-bankgroup", "credit-deep-bsr1-state-pop", "credit-deep-bsr1-state-bankgroup", "credit-deep-bsr1-bankgroup-size", "credit-deep-bsr1-size-rate", "credit-deep-bsr1-account-rate", "credit-deep-bsr1-bankgroup-rate", "credit-deep-bsr1-account-occupation", "credit-deep-bsr1-organisation-occupation", "credit-deep-bsr1-rate-occupation", "credit-deep-bsr1-size-occupation", "credit-deep-bsr1-size-rate-2014", "credit-deep-bsr1-bankgroup-rate-2017", "credit-deep-bsr1-rate-occupation-2014", "credit-deep-bsr1-account-rate-2014", "credit-deep-bsr1-pop-bankgroup-2014", "credit-deep-bsr1-bankgroup-size-2014", "credit-deep-bsr1-bankgroup-rate-2014", "credit-deep-bsr1-state-bankgroup-2014", "credit-deep-bsr1-pop-occupation", "credit-deep-bsr1-pop-occupation-small", "credit-deep-bsr1-state-occupation-small", "credit-deep-bsr1-bankgroup-occupation", "credit-deep-bsr1-rate-2014", "credit-deep-bsr1-bankgroup-2014", "credit-deep-asset-classification", "credit-deep-npa-by-sector", "credit-deep-crar-banks", "credit-deep-bank-ratios", "credit-deep-scheduled-banks", "credit-deep-rbi-weekly-statement", "credit-deep-rbi-liabilities-assets", "credit-deep-money-stock-fortnightly", "credit-deep-spatial-glance", "credit-deep-spatial-centres", "credit-deep-spatial-deposit-types", "credit-deep-spatial-office-size", "credit-deep-spatial-glance-2017", "credit-deep-spatial-centres-2017", "credit-deep-spatial-deposit-types-2017", "credit-deep-spatial-office-size-2017", "credit-deep-spatial-glance-2004", "credit-deep-spatial-centres-2004", "credit-deep-spatial-deposit-types-2004", "credit-deep-spatial-office-size-2004", "credit-deep-spatial-glance-annual", "credit-deep-spatial-centres-annual", "credit-deep-spatial-deposit-types-annual", "credit-deep-spatial-office-size-annual", "credit-deep-bsr1a-occupation", "credit-deep-bsr1a-size", "credit-deep-bsr1a-account-type", "credit-deep-bsr1a-pop-occupation-small", "credit-deep-bsr1a-pop-occupation", "credit-deep-bsr1a-occupation-account", "credit-deep-bsr1a-occupation-account-small", "credit-deep-bsr1a-occupation-organisation", "credit-deep-bsr1a-occupation-organisation-small", "credit-deep-bsr1a-account-organisation", "credit-deep-bsr1a-account-organisation-small", "credit-deep-bsr1a-size-organisation", "credit-deep-bsr1a-size-account", "credit-deep-bsr1a-small-borrowers", "credit-deep-bsr1a-occupation-size", "credit-deep-bsr1a-rate-organisation", "credit-deep-bsr1a-size-rate", "credit-deep-bsr1a-rate-organisation-small", "credit-deep-bsr1a-rate-account", "credit-deep-bsr1a-rate-account-small", "credit-deep-bsr1a-occupation-rate", "credit-deep-bsr1a-occupation-rate-small", "credit-deep-bsr1a-rate-size-account", "credit-deep-bsr1a-bank-groups", "credit-deep-bsr1a-pop-sanction-use", "credit-deep-bsr1a-pop-sanction-use-ex-food", "credit-deep-bsr1a-state-pop-sanction-use", "credit-deep-bsr1a-pop-occupation-share", "credit-deep-bsr1a-organisation", "credit-deep-bsr1a-size-bankgroup", "credit-deep-bsr1a-bankgroup-pop-size", "credit-deep-bsr1a-state-pop", "credit-deep-bsr1a-state-bankgroup", "credit-deep-bsr1a-pop-bankgroup-small", "credit-deep-bsr1a-state-bankgroup-size", "credit-deep-bsr1a-state-pop-small", "credit-deep-bsr1a-districts", "credit-deep-bsr1a-pop-occupation-bankgroup", "credit-deep-bsr1a-state-occupation-pop-small", "credit-deep-bsr1a-district-gender", "credit-deep-tp-international-liabilities", "credit-deep-tp-international-assets", "credit-deep-tp-international-claims", "credit-deep-tp-claims-by-country", "credit-deep-tp-off-balance-sheet", "credit-deep-tp-sensitive-sectors", "credit-deep-tp-overseas-operations", "credit-deep-tp-shareholding", "credit-deep-tp-banking-glance", "credit-deep-tp-branches-atms", "credit-deep-tp-microfinance", "credit-deep-tp-rrb-states", "credit-deep-tp-rrb-psl", "credit-deep-tp-ucb-performance", "credit-deep-tp-ucb-parameters", "credit-deep-tp-dccb-health", "credit-deep-tp-pacs-members", "credit-deep-tp-pacs", "credit-deep-tp-scb-coop-health", "credit-deep-tp-pacs-states", "credit-deep-tp-scardb-balance-sheet", "credit-deep-tp-scardb-performance", "credit-deep-tp-scardb-asset-quality", "credit-deep-tp-pcardb-performance", "credit-deep-tp-pcardb-asset-quality", "credit-deep-tp-nbfc-balance-sheet", "credit-deep-tp-nbfc-d-balance-sheet", "credit-deep-tp-pcardb-balance-sheet", "credit-deep-tp-kcc-states", "credit-deep-tp-kcc", "credit-deep-tp-scardb-regions", "credit-deep-tp-pcardb-regions", "credit-deep-tp-nbfc-ul-balance-sheet", "credit-deep-tp-nbfc-ml-balance-sheet", "credit-deep-tp-nbfc-credit", "credit-deep-tp-nbfc-ul-performance", "credit-deep-tp-nbfc-ml-performance", "credit-deep-tp-fi-assistance", "credit-deep-tp-primary-dealers", "credit-deep-tp-primary-dealer-indicators", "credit-deep-reserve-money-weekly", "credit-deep-commercial-bank-survey", "credit-deep-scheduled-banks-annual", "credit-deep-bank-group-business", "credit-deep-derivatives", "credit-deep-state-investments", "credit-deep-state-coop-banks-states", "credit-deep-dccb-states", "credit-deep-banks-abroad", "credit-deep-insured-deposits", "credit-deep-unclaimed-deposits", "credit-deep-coop-balance-sheets", "credit-deep-scb-annual-aggregates", "credit-deep-money-stock-wss", "credit-deep-money-stock-measures", "credit-deep-money-stock-measures-annual", "credit-deep-money-sources-bulletin", "credit-deep-money-components-handbook", "credit-deep-money-components-handbook-annual", "credit-deep-money-sources-handbook", "credit-deep-monetary-survey-monthly", "credit-deep-industry-monthly-2007", "credit-deep-industry-monthly", "credit-deep-scb-section42-full", "credit-deep-select-aggregates", "credit-deep-select-aggregates-handbook", "credit-deep-scb-resources", "credit-deep-state-coop-banks-monthly", "credit-deep-reserve-money-monthly", "credit-deep-walr-bank-groups", "credit-deep-offices-banks", "credit-deep-offices-states", "credit-deep-offices-bank-groups", "credit-deep-coop-offices-districts", "credit-deep-coop-branches-states", "credit-deep-offices-abroad", "credit-deep-offices-abroad-banks", "credit-deep-cheque-clearances", "credit-deep-clearing-houses", "credit-deep-scb-investments-old", "credit-deep-scb-investments-offices", "credit-deep-scb-growth-annual", "credit-deep-priority-sector-banks", "credit-deep-priority-sector-states", "credit-deep-bank-group-ratios", "credit-deep-employees-banks", "credit-deep-restructured-loans", "credit-deep-contingent-liabilities", "credit-deep-sensitive-sectors-banks", "credit-deep-bank-earnings", "credit-deep-bank-provisions", "credit-deep-bank-profit-appropriation", "credit-deep-abridged-balance-sheets"],
  },
  // --- trade (lb/trade) ---
  {
    slug: "trade",
    no: "25",
    section: "External",
    name: "Merchandise Trade",
    title: "What India buys and sells",   // the topic as a reader names it: nav, lists, search
    kickerTitle: "Merchandise trade, DGCI&S customs data",
    crumbTitle: "Merchandise trade",
    headline: "What India sells, <i>and what it buys.</i>",
    ogTitle: "What India sells, and what it buys.",
    blurb: "Every shipment that crosses India's customs border, counted each month: what the country sells and buys, from crude oil and gold to phones and rice, and with whom.",
    description: "India's merchandise exports and imports by commodity and partner, every month since 2017 down to the 8-digit tariff line, with the long view since 1970-71.",
    rssDescription: "What India sells and buys, and with whom: exports, imports and the trade deficit, revised with each monthly release.",
    stamp: { dateStyle: "month", vintageStyle: "vintage" },
    statusNote: "Monthly, revised with each release",
    version: "v1.0",
    currentBundle: "trade-total",
    calendar: "fiscal-apr",
    bands: null,
    proseConstants: [100],   // verifier whitelist: weights/shares/base years this dossier may cite
    spark: { bundle: "trade-total", series: "exports" },
    prose: true,
    proseInputs: ["trade-hs2-exports", "trade-hs2-imports", "trade-partners-balance"],
    register: { id: "reg-trade", label: "Merchandise trade", unit: "Monthly, US$ billion, TradeStat (DGCI&S)", historyCol: "Since 2017" },
    bundles: [
      "trade-total", "trade-total-inr",
      ...["hs2", "hs4"].flatMap((l) => ["exports", "imports"].flatMap((f) => ["", "-fy", "-ytd"].flatMap((t) => [`trade-${l}-${f}${t}`, `trade-${l}-${f}${t}-inr`]))),
      ...["partners", "regions"].flatMap((l) => ["exports", "imports"].flatMap((f) => ["", "-fy", "-ytd"].flatMap((t) => [`trade-${l}-${f}${t}`, `trade-${l}-${f}${t}-inr`]))),
      "trade-partners-balance", "trade-partners-balance-fy", "trade-partners-long", "trade-partners-long-inr",
      ...["exports", "imports"].flatMap((f) => [`trade-principal-${f}`, `trade-principal-${f}-inr`, `trade-principal-${f}-fy`, `trade-principal-${f}-fy-inr`, `trade-principal-${f}-ytd`, `trade-principal-${f}-ytd-inr`, `trade-principal-quantity-${f}`]),
      ...["exports", "imports"].flatMap((f) => [`trade-partner-hs2-${f}`, `trade-partner-hs2-${f}-ytd`]),   // partner x heading: deep archive
      // 6 and 8 digits are not bundles: they are the deep-archive tier (PLAN-launch §2b),
      // staged by tradestat-bake.mjs and rolled up into trade-hs4-*.
      "trade-dbie-monthly", "trade-dbie-monthly-inr", "trade-dbie-annual", "trade-dbie-annual-inr", "trade-dbie-tot-2012", "trade-dbie-tot-1999", "trade-dbie-tot-1978",
      "trade-dbie-uvi-2012", "trade-dbie-uvi-1999", "trade-dbie-oil-volumes", "trade-dbie-direction", "trade-dbie-direction-1987", "trade-dbie-commodities", "trade-dbie-commodities-1987",
      "trade-dbie-commodity-partners", "trade-dbie-commodity-partners-1990",
    ],
  },
  // --- end trade ---
];
export const bySlug = Object.fromEntries(DOSSIERS.map((d) => [d.slug, d]));

/** "Prices: Consumer Price Index". The page kicker names the topic and the instrument; guides are not numbered. */
export const kicker = (d) => `${d.section}: ${d.kickerTitle}`;
