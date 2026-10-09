// scripts/lib/products/gender.mjs: MoSPI's "Women and Men in India" compendium (27th edition,
// 2025, released 29 April 2026) as the eSankhyiki API serves it (gender/getGenderRecords).
//
// What the source publishes: 154 indicators (the API's codes 1 to 177, with gaps), each the
// compendium's reprint of one table from another agency: the Census and Sample Registration
// System (Registrar General), NFHS, PLFS, the Time Use Survey, UDISE+ and AISHE, the RBI,
// NCRB, the Election Commission, ministries' scheme portals. Every indicator has its own
// dimensions (state, sector, sex, age, education, scheme, crime head...) and its own
// calendar (census decades, SRS three- and five-year windows, school years, PLFS agricultural
// and calendar years, "as on" dates). About 35,000 cells. All of them are baked.
//
// Bundles: one per indicator, gender-t<code> (three-digit code), each series one combination
// of the indicator's dimensions. Where an indicator joins two instruments in one column the
// bundle is split by ruler, never spliced (AGENTS.md rule 1):
//   - the NFHS reprints (surveys 2015-16 and 2019-21): -nfhs4 and -nfhs5;
//   - literacy (55, 58): the census rounds and NSS 2017-18: -census and -nss;
//   - PLFS (72, 80, 83, 85, 91, 93): agricultural years July-June (-ay), the original design's
//     calendar years 2022-2024 (-cy) and the revamped design from January 2025 (-cy25);
//   - the gender parity index (62): Educational Statistics at a Glance to 2011-12 (-esag),
//     UDISE+ and AISHE from 2012-13 (-udise);
//   - women-led start-ups (133): the cumulative 2017-25 count apart from the yearly counts;
//   - state assemblies (126): the undated All India total apart from the state rows.
// Population projections (1, 3, 4) and life expectancy after 2016-20 (18) are the Technical
// Group on Population Projections' figures (July 2020): kept on the series they extend, each
// date listed in `estimated` (CONTRACT-series rule 2b).
//
// Source quirks: values "-" (no observation) and "NR" (not reported) are not baked (counted in
// meta.omitted); numbers can carry Indian digit grouping ("7,75,947"); a few units are "-"
// and are set per table below; the API's year field mixes "2019", "2019-21", "C.Y. 2022 (P)",
// "as on 31.03.2025" and "FY26TD till Oct'25", all parsed by periodOf. The API lists 154
// codes; the codes in between (32 to 49, 75, 76, 139, 148, 158) answer "No Data Found" or
// HTTP 500 (probed 2026-10-10): the compendium's earlier editions' tables MoSPI no longer
// serves. Source agencies come from the compendium PDF's table notes.
//
// Hand-check (2026-10-10), against the compendium PDF (Women & Men in India 2025): sex ratio
// 1951, 946 (table 1.1); MMR 2004-06, 254 (table 2.9); total unmet need for family planning,
// NFHS-4, 12.9 (table 2.13; the NFHS API misfiles this one, see nfhs.mjs).
//
//   node scripts/lib/products/gender.mjs --fetch       refresh the raw dump (about 600 requests)
//   node scripts/lib/products/gender.mjs --bake        rebuild the bundles from the raw dump
//   node scripts/lib/products/gender.mjs --catalogue   the coverage catalogue

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { mospi, mospiAll } from "../mospi.mjs";
import { writeSeries, writeRaw } from "../util.mjs";
import { getJson } from "../net.mjs";
import { parseNumber } from "../tabular.mjs";

/* ---------- the compendium's agencies ---------- */
const A = {
  rgi: "Office of the Registrar General of India",
  census: "Census of India, Office of the Registrar General of India",
  proj: "Office of the Registrar General of India; Report of the Technical Group on Population Projections (July 2020), National Commission on Population, MoHFW",
  crs: "Civil Registration System, Office of the Registrar General of India",
  srs: "Sample Registration System, Office of the Registrar General of India",
  nfhs: "National Family Health Survey, NFHS-4 (2015-16) and NFHS-5 (2019-21), Ministry of Health and Family Welfare (IIPS)",
  naco: "National AIDS Control Organisation, Ministry of Health and Family Welfare",
  dhs: "Directorate of Health Services of each State and UT",
  mohfw: "Ministry of Health and Family Welfare",
  ayush: "Ministry of Ayush",
  nss: "National Sample Survey, National Statistics Office, MoSPI",
  udise: "UDISE+, Department of School Education and Literacy, Ministry of Education",
  aishe: "All India Survey on Higher Education, Department of Higher Education, Ministry of Education",
  moe: "Department of School Education and Literacy, Ministry of Education",
  plfs: "Periodic Labour Force Survey, National Statistics Office, MoSPI",
  tus: "Time Use Survey, National Statistics Office, MoSPI",
  rbi: "Basic Statistical Return 2, Reserve Bank of India",
  dfs: "Department of Financial Services, Ministry of Finance",
  mudra: "Mudra portal, member lending institutions",
  cdsl: "Central Depository Services (India) Limited",
  nabard: "Department of Microfinance and Financial Inclusion, NABARD",
  nse: "National Stock Exchange",
  asuse: "Annual Survey of Unincorporated Sector Enterprises, MoSPI",
  mord: "National Social Assistance Programme, Ministry of Rural Development",
  lss: "Lok Sabha Secretariat",
  eci: "Election Commission of India",
  mopr: "Ministry of Panchayati Raj",
  doj: "Department of Justice, Ministry of Law and Justice",
  mca: "Ministry of Corporate Affairs",
  bprd: "Data on Police Organisations, Bureau of Police Research and Development",
  dpiit: "Department for Promotion of Industry and Internal Trade",
  mod: "Ministry of Defence",
  msme: "Udyam portal, Ministry of Micro, Small and Medium Enterprises",
  ncrb: "Crime in India, National Crime Records Bureau",
  adsi: "Accidental Deaths and Suicides in India, National Crime Records Bureau",
  njdg: "National Judicial Data Grid",
  ncert: "PARAKH Rashtriya Sarvekshan 2024, NCERT",
  wmi: "",   // the compendium's table carries no source line
};

/* ---------- per indicator: compendium table, agency, slug, unit for "-" ----------
 * unit: one unit for the whole table, or units: { <row unit>: <atlas unit> }. Row units not
 * listed fall back to UNIT_OF below. plfs: PLFS rulers by year label. split: a custom ruler. */
const T = {
  1: { tab: "1.1", src: A.proj, slug: "population", est: (l) => +String(l).slice(0, 4) > 2011 },
  2: { tab: "1.3", src: A.census, slug: "sex-ratio-census", unit: "ratio" },
  3: { tab: "1.1", src: A.proj, slug: "population-growth", est: (l) => +String(l).slice(0, 4) > 2011 },
  4: { tab: "1.2", src: A.proj, slug: "population-age", est: (l) => +String(l).slice(0, 4) > 2011 },
  5: { tab: "1.4", src: A.census, slug: "sex-ratio-age", unit: "ratio" },
  6: { tab: "1.5", src: A.crs, slug: "srb-registered", unit: "ratio" },
  7: { tab: "1.6", src: A.srs, slug: "srb-srs", unit: "ratio" },
  8: { tab: "2.1", src: A.srs, slug: "gfr", unit: "per_1000_women" },
  9: { tab: "2.1", src: A.srs, slug: "asfr", unit: "per_1000_women" },
  10: { tab: "2.1", src: A.srs, slug: "tfr", unit: "births_per_woman" },
  11: { tab: "2.1", src: A.srs, slug: "birth-order" },
  12: { tab: "2.2", src: A.srs, slug: "adolescent-fertility", unit: "per_1000_women" },
  13: { tab: "2.3", src: A.srs, slug: "asfr-education", unit: "per_1000_women" },
  14: { tab: "2.4", src: A.srs, slug: "age-at-marriage" },
  15: { tab: "2.5", src: A.srs, slug: "imr", unit: "per_1000" },
  16: { tab: "2.6", src: A.srs, slug: "imr-states", unit: "per_1000" },
  17: { tab: "2.7", src: A.srs, slug: "u5mr", unit: "per_1000" },
  18: { tab: "2.8(a)", src: A.srs + "; projections from the Technical Group on Population Projections (July 2020)", slug: "life-expectancy", unit: "years", est: (l) => +String(l).slice(0, 4) >= 2021 },
  19: { tab: "2.8(b)", src: A.srs, slug: "life-expectancy-states", unit: "years" },
  20: { tab: "2.8(c)", src: A.srs, slug: "life-expectancy-60", unit: "years" },
  21: { tab: "2.9", src: A.srs, slug: "mmr", unit: "per_100k_live_births" },
  22: { tab: "2.10", src: A.nfhs, slug: "maternity-care", nfhs: true },
  23: { tab: "2.11", src: A.nfhs, slug: "skilled-births", nfhs: true },
  24: { tab: "2.12", src: A.nfhs, slug: "family-planning", nfhs: true },
  25: { tab: "2.13", src: A.nfhs, slug: "unmet-need", nfhs: true },
  26: { tab: "2.14", src: A.nfhs, slug: "demand-satisfied", nfhs: true, units: { "-": "percent" } },
  27: { tab: "2.15", src: A.nfhs, slug: "tobacco", nfhs: true },
  28: { tab: "2.16", src: A.nfhs, slug: "obesity", nfhs: true },
  29: { tab: "2.17", src: A.naco, slug: "hiv-incidence", unit: "per_1000" },
  30: { tab: "2.18", src: A.naco, slug: "hiv-art", unit: "count" },
  31: { tab: "2.19", src: A.dhs, slug: "diarrhoea" },
  50: { tab: "2.21", src: A.nfhs, slug: "cancer-screening", nfhs: true },
  51: { tab: "2.22", src: A.nfhs, slug: "hiv-knowledge", nfhs: true },
  52: { tab: "2.23", src: A.nfhs, slug: "bmi-women", nfhs: true },
  53: { tab: "2.24", src: A.ayush, slug: "ayush-doctors" },
  54: { tab: "2.25", src: A.wmi, slug: "nurses" },
  55: { tab: "3.1", src: A.census + "; 2017: NSS 75th round (July 2017 to June 2018)", slug: "literacy", split: (r) => (/^20(1[7-9])/.test(r.year) ? ["nss", "NSS 75th round"] : ["census", "Census"]) },
  56: { tab: "3.2", src: A.nss, slug: "literacy-gap", unitOf: (r) => (/gap/i.test(r.sub_indicator) ? "pp" : null) },
  57: { tab: "3.3", src: A.nss + " (75th round, 2017-18)", slug: "literacy-gap-states", july: true, unit: "pp" },
  58: { tab: "3.4.1", src: A.census + "; 2017: NSS 75th round", slug: "youth-literacy", split: (r) => (/^2017/.test(r.year) ? ["nss", "NSS 75th round"] : ["census", "Census"]) },
  59: { tab: "3.4.2", src: A.nss + " (Comprehensive Annual Modular Survey 2022-23, 79th round)", slug: "read-write", july: true },
  60: { tab: "3.5", src: A.udise + "; higher education from AISHE", slug: "ger", unit: "percent" },
  61: { tab: "3.6", src: A.udise, slug: "aner", unit: "percent" },
  62: { tab: "3.7", src: "Educational Statistics at a Glance to 2011-12; UDISE+ and AISHE, Ministry of Education, from 2012-13", slug: "gpi", unit: "gpi", split: (r) => (Number(String(r.year).slice(0, 4)) < 2012 ? ["esag", "Educational Statistics at a Glance"] : ["udise", "UDISE+ and AISHE"]) },
  63: { tab: "3.8.2", src: A.udise, slug: "gpi-nep-states", unit: "gpi" },
  64: { tab: "3.8.3", src: A.aishe, slug: "gpi-higher-states", unit: "gpi" },
  65: { tab: "3.9", src: A.aishe, slug: "ug-enrolment" },
  66: { tab: "3.10", src: A.aishe, slug: "pg-enrolment" },
  67: { tab: "3.11", src: A.aishe, slug: "female-per-100-male-programmes", unit: "per_100_males" },
  68: { tab: "3.12.1", src: A.nss + " (75th round, 2017-18)", slug: "years-completed", july: true },
  69: { tab: "3.12.2", src: A.nss + " (79th round, 2022-23)", slug: "mean-schooling", july: true },
  70: { tab: "3.12.3", src: A.nss + " (Comprehensive Annual Modular Survey 2022-23)", slug: "mean-schooling-15", july: true },
  71: { tab: "3.12.3", src: A.nss + " (Comprehensive Annual Modular Survey 2022-23)", slug: "mean-schooling-25", july: true },
  72: { tab: "3.13", src: A.plfs, slug: "secondary-25", plfs: true },
  73: { tab: "3.14", src: A.aishe, slug: "out-turn", unit: "count" },
  74: { tab: "3.15", src: A.udise, slug: "dropout", unit: "percent" },
  77: { tab: "3.18", src: A.udise, slug: "female-teachers-per-100", unit: "per_100_males" },
  78: { tab: "3.19", src: A.aishe, slug: "tertiary-teachers" },
  79: { tab: "3.20", src: A.aishe, slug: "teachers-position" },
  80: { tab: "4.1", src: A.plfs, slug: "lfpr", plfs: true },
  81: { tab: "4.2", src: A.plfs, slug: "lfpr-all-ages-states", plfs: true },
  82: { tab: "4.3", src: A.plfs, slug: "lfpr-states", plfs: true },
  83: { tab: "4.4", src: A.plfs, slug: "wpr-all-ages-states", plfs: true },
  84: { tab: "4.5", src: A.plfs, slug: "wpr-states", plfs: true },
  85: { tab: "4.6.1", src: A.plfs, slug: "wpr", plfs: true },
  86: { tab: "4.6.2", src: A.plfs, slug: "wpr-age", plfs: true },
  87: { tab: "4.7", src: A.plfs, slug: "casual-wage", plfs: true },
  88: { tab: "4.8", src: A.plfs, slug: "hourly-wage-occupation", plfs: true },
  89: { tab: "4.9", src: A.plfs, slug: "employment-status-states", plfs: true },
  90: { tab: "4.10", src: A.plfs, slug: "employment-status", plfs: true },
  91: { tab: "4.11", src: A.plfs, slug: "industry", plfs: true },
  92: { tab: "4.12", src: A.plfs, slug: "informal-states", plfs: true },
  93: { tab: "4.13", src: A.plfs, slug: "unemployment", plfs: true },
  94: { tab: "4.14", src: A.plfs, slug: "unemployment-age", plfs: true },
  95: { tab: "4.15", src: A.plfs, slug: "unemployment-states", plfs: true },
  96: { tab: "4.16.1", src: A.tus + " (2019)", slug: "tus2019-participation" },
  97: { tab: "4.16.2", src: A.tus + " (2024)", slug: "tus2024-participation" },
  98: { tab: "4.17.2", src: A.tus + " (2024)", slug: "tus2024-minutes" },
  99: { tab: "4.17.1", src: A.tus + " (2019)", slug: "tus2019-minutes" },
  100: { tab: "4.18", src: A.tus + " (2019)", slug: "tus2019-participation-age" },
  101: { tab: "4.19", src: A.tus + " (2019)", slug: "tus2019-learning" },
  102: { tab: "4.20", src: A.tus + " (2019)", slug: "tus2019-paid-unpaid-age" },
  103: { tab: "4.21.1", src: A.tus + " (2019)", slug: "tus2019-paid-unpaid" },
  104: { tab: "4.21.2", src: A.tus + " (2024)", slug: "tus2024-paid-unpaid" },
  105: { tab: "4.22", src: A.rbi, slug: "bank-women-employees", unit: "count" },
  106: { tab: "4.23", src: A.rbi, slug: "bank-employees-states" },
  107: { tab: "4.24", src: A.rbi, slug: "deposits-population-group" },
  108: { tab: "4.25", src: A.rbi, slug: "deposits-states" },
  109: { tab: "4.26", src: A.dfs, slug: "pmjjby-pmsby" },
  110: { tab: "4.27", src: A.dfs, slug: "pmvvy" },
  111: { tab: "4.28", src: A.dfs, slug: "pmjdy" },
  112: { tab: "4.29", src: A.mudra, slug: "mudra" },
  113: { tab: "4.30", src: A.dfs, slug: "apy" },
  114: { tab: "4.31", src: A.dfs, slug: "stand-up-india" },
  115: { tab: "4.32", src: A.cdsl, slug: "demat" },
  116: { tab: "4.33", src: A.nabard, slug: "shg-savings" },
  117: { tab: "4.34", src: A.nabard, slug: "shg-loans-disbursed" },
  118: { tab: "4.36", src: A.nse, slug: "investors" },
  119: { tab: "4.37", src: A.asuse, slug: "asuse-female-workers-top3" },
  120: { tab: "4.38", src: A.asuse, slug: "asuse-female-headed" },
  121: { tab: "4.39", src: A.asuse, slug: "asuse-ownership", units: { Number: "per_1000" } },
  122: { tab: "4.40", src: A.asuse, slug: "asuse-female-workers" },
  123: { tab: "5.1", src: A.lss, slug: "council-of-ministers" },
  124: { tab: "5.2", src: A.eci, slug: "lok-sabha-elections", drop: ["lok_sabha_election"] },
  125: { tab: "5.3", src: A.lss, slug: "lok-sabha-2024" },
  126: { tab: "5.4", src: A.eci, slug: "state-assemblies", split: (r) => (r.year === "-" ? ["total", "All India, latest assemblies"] : ["states", "States"]) },
  127: { tab: "5.5", src: A.mopr, slug: "panchayats" },
  128: { tab: "5.6", src: A.eci, slug: "electors" },
  129: { tab: "5.7", src: A.eci, slug: "turnout-2024" },
  130: { tab: "5.8", src: A.doj, slug: "judges" },
  131: { tab: "5.9", src: A.mca, slug: "managers" },
  132: { tab: "5.10", src: A.bprd, slug: "police-capf" },
  133: { tab: "5.12", src: A.dpiit, slug: "startups", split: (r) => (/^\d{4}-\d{2}$/.test(r.year) ? ["cumulative", "cumulative 2017-25"] : ["yearly", "by year"]) },
  134: { tab: "5.14", src: A.mod, slug: "armed-forces" },
  135: { tab: "5.15", src: A.wmi, slug: "central-services-intake" },
  136: { tab: "5.16", src: A.msme, slug: "msme-women", units: { "-": "unstated" } },
  137: { tab: "5.17", src: A.msme, slug: "ime-women", unit: "count" },
  138: { tab: "5.19", src: A.nfhs, slug: "household-decisions", nfhs: true },
  140: { tab: "6.1", src: A.ncrb, slug: "crimes" },
  141: { tab: "6.2", src: A.ncrb, slug: "crime-rates-states", units: { "-": "per_lakh_women" } },
  142: { tab: "6.3", src: A.ncrb, slug: "rape-victims-age" },
  143: { tab: "6.4", src: A.nfhs, slug: "spousal-violence", nfhs: true },
  144: { tab: "6.5", src: A.ncrb, slug: "police-disposal" },
  145: { tab: "6.6", src: A.ncrb, slug: "court-disposal" },
  146: { tab: "6.7", src: A.nfhs, slug: "child-marriage-women", nfhs: true },
  147: { tab: "6.8", src: A.nfhs, slug: "child-marriage-men", nfhs: true },
  149: { tab: "6.9", src: A.adsi, slug: "suicides", units: { Ratio: "multiple" } },
  150: { tab: "6.10", src: A.adsi, slug: "suicide-profile" },
  151: { tab: "6.12", src: A.ncrb, slug: "cyber-crimes-states" },
  152: { tab: "2.26", src: A.nss + " (76th round, July to December 2018)", slug: "disability" },
  153: { tab: "2.27", src: A.nss + " (76th round, July to December 2018)", slug: "disability-type" },
  154: { tab: "2.28", src: A.nss + " (76th round, July to December 2018)", slug: "disability-states" },
  155: { tab: "2.29", src: A.nss + " (76th round, July to December 2018)", slug: "disability-type-women-states" },
  156: { tab: "6.14", src: A.njdg, slug: "cases-filed-by-women" },
  157: { tab: "6.11", src: A.ncrb, slug: "cyber-crimes" },
  159: { tab: "2.20", src: A.mohfw, slug: "tb-notified" },
  160: { tab: "2.30", src: A.srs + " (Cause of Death Statistics)", slug: "causes-of-death" },
  161: { tab: "3.8.1", src: A.udise + "; higher education from AISHE", slug: "gpi-states", unit: "gpi" },
  162: { tab: "3.16", src: A.nss + " (Comprehensive Modular Survey: Education, 2025)", slug: "course-fees" },
  163: { tab: "3.17", src: A.nss + " (Comprehensive Modular Survey: Education, 2025)", slug: "school-spending" },
  164: { tab: "3.21", src: A.moe, slug: "class-x-regular" },
  165: { tab: "3.22", src: A.moe, slug: "class-x-open" },
  166: { tab: "3.23", src: A.moe, slug: "class-xii-regular" },
  167: { tab: "3.24", src: A.moe, slug: "class-xii-open" },
  168: { tab: "3.25", src: A.aishe, slug: "stem-enrolment" },
  169: { tab: "3.26", src: A.wmi, slug: "students-abroad" },
  170: { tab: "3.27", src: A.ncert, slug: "learning-outcomes" },
  171: { tab: "4.41", src: A.mord, slug: "nsap" },
  172: { tab: "5.11", src: A.bprd, slug: "women-police-states" },
  173: { tab: "5.13", src: A.wmi, slug: "officers" },
  174: { tab: "5.18", src: A.msme, slug: "msme-owners", unit: "count" },
  175: { tab: "6.13", src: A.wmi, slug: "cybercrime-reporting" },
  176: { tab: "6.15", src: A.bprd, slug: "women-help-desks" },
  177: { tab: "4.35", src: A.nabard, slug: "shg-loans-outstanding" },
};
export const GENDER_TABLES = T;

const UNIT_WORD = { percent: "per cent", count: "number", per_1000: "per 1,000", inr_crore: "₹ crore", thousand: "thousands", inr_lakh: "₹ lakh", million_persons: "millions", multiple: "ratio", per_lakh_women: "per lakh women", unstated: "as printed" };
// the compendium's row units, as the Atlas shows them (src/dossiers/everycut.js UNITS)
const UNIT_OF = {
  "%": "percent", "in Million": "million_persons", "in Millions": "million_persons", Number: "count", "No. of Subscribers": "count",
  "Age (in Years)": "years", Years: "years", "in Minutes": "minutes", "Rs.": "inr", "In Rs.": "inr_amount", "in Crore": "inr_crore",
  "in Crores": "inr_crore", "Amount (in crore)": "inr_crore", "in Rs. Lakh": "inr_lakh", "in Thousand": "thousand", "in Thousands": "thousand",
};

/* ---------- periods ----------
 * Every year label the API uses, to { date, label, kind }. Windows of several years are dated
 * at their middle year; fiscal and school years at April, PLFS agricultural years at July;
 * "as on" stocks at their day. */
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
const iso = (y, m = 1, d = 1) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export function periodOf(raw, { july = false, nfhs = false } = {}) {
  const s = String(raw ?? "").trim();
  let m;
  if (nfhs) {
    if (/2015-16/.test(s)) return { date: "2016-01-01", label: "NFHS-4, 2015-16", kind: "round" };
    if (/2019-21/.test(s)) return { date: "2020-01-01", label: "NFHS-5, 2019-21", kind: "round" };
  }
  if ((m = s.match(/^(\d{4})$/))) return { date: iso(+m[1]), label: s, kind: "year" };
  if ((m = s.match(/^C\.Y\.\s*(\d{4})(\s*\(P\))?$/))) return { date: iso(+m[1]), label: m[2] ? `${m[1]} (provisional)` : m[1], kind: "year", provisional: !!m[2] };
  if ((m = s.match(/^(\d{4})-(\d{2})$/))) {
    const y0 = +m[1]; let y1 = Math.floor(y0 / 100) * 100 + +m[2]; if (y1 < y0) y1 += 100;
    if (y1 - y0 === 1) return { date: iso(y0, july ? 7 : 4), label: s, kind: july ? "agri-year" : "fiscal-year" };
    return { date: iso(Math.round((y0 + y1) / 2)), label: s, kind: "window" };
  }
  if ((m = s.match(/^NSS\s+(\d+)\w*\s+round\s*:\s*(\d{4})(?:-(\d{2}))?$/i))) return { date: m[3] ? iso(+m[2], 7) : iso(+m[2]), label: s.replace(/\s*:\s*/, ", "), kind: "round" };
  if ((m = s.match(/^Jul-Dec\s+(\d{4})$/i))) return { date: iso(+m[1], 7), label: `July to December ${m[1]}`, kind: "round" };
  if ((m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})\s*$/))) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return { date: iso(y, +m[2], +m[1]), label: s.replace(/^as on/i, "as on").replace(/^As on/, "as on"), kind: "stock" }; }
  if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/))) return { date: iso(+m[3], MON[m[2].toLowerCase()], +m[1]), label: s, kind: "stock" };
  if ((m = s.match(/([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})$/)) && MON[m[1].toLowerCase()]) return { date: iso(+m[3], MON[m[1].toLowerCase()], +m[2]), label: s, kind: "stock" };
  if ((m = s.match(/end of\s+([A-Za-z]+)\s+(\d{4})$/i))) { const mo = MON[m[1].toLowerCase()]; return { date: iso(+m[2], mo, new Date(Date.UTC(+m[2], mo, 0)).getUTCDate()), label: s, kind: "stock" }; }
  if ((m = s.match(/^FY(\d{2})\s+till\s+Mar'(\d{2})$/i))) return { date: iso(2000 + +m[2], 3, 31), label: `financial year 20${+m[1] - 1}-${m[1]}`, kind: "stock" };
  if ((m = s.match(/^FY(\d{2})TD\s+till\s+([A-Za-z]{3})'(\d{2})$/i))) { const mo = MON[m[2].toLowerCase()]; return { date: iso(2000 + +m[3], mo, new Date(Date.UTC(2000 + +m[3], mo, 0)).getUTCDate()), label: `financial year 20${+m[1] - 1}-${m[1]} to ${m[2]} 20${m[3]}`, kind: "stock" }; }
  return null;
}
// meta.latestPeriod is a display label; a bare "2011-12" would read as December 2011 to the
// freshness gate (YYYY-MM), so a span says what kind of span it is
const latestLabel = (label, kind) => (/^\d{4}-\d{2}$/.test(label) ? `${label} (${kind === "agri-year" ? "July to June" : kind === "fiscal-year" ? "April to March" : "the years averaged"})` : label);
// PLFS rulers by year label: agricultural years (original design), the original design's
// calendar years 2022-2024, the revamped design from January 2025
const plfsRuler = (y) => (/^\d{4}-\d{2}$/.test(y) ? ["ay", "PLFS, agricultural years (July to June)"] : +y >= 2025 ? ["cy25", "PLFS, revamped design, calendar year"] : ["cy", "PLFS, original design, calendar years"]);

/* ---------- fetch ---------- */
/* Every indicator the compendium lists, paged in full (mospiAll checks totalRecords), plus
 * the filter listing of each (its dimensions and their codes). One request at a time through
 * the shared MoSPI client; the http cache makes a killed run resume where it stopped. */
export async function fetchGenderRaw(root, vintage) {
  const list = (await mospi("gender/getGenderIndicatorList", {})).data ?? [];
  const inds = Array.isArray(list) ? list : list.indicator ?? [];
  if (inds.length < 100) throw new Error(`gender: indicator list has ${inds.length} entries (expected about 154)`);
  const indicators = {}, filters = {}, failed = {};
  for (const ind of inds) {
    const code = String(ind.indicator_code);
    try {
      filters[code] = (await mospi("gender/getGenderFilterByIndicatorId", { indicator_code: code })).data ?? null;
      indicators[code] = await mospiAll("gender/getGenderRecords", { indicator_code: code });
      process.stdout.write(`  gender ${code}: ${indicators[code].length} rows\n`);
    } catch (e) {
      failed[code] = `${e.message.slice(0, 200)} (${new Date().toISOString().slice(0, 10)})`;
      process.stdout.write(`  gender ${code}: FAILED ${failed[code]}\n`);
    }
  }
  const raw = {
    vintage,
    note: "Every indicator of MoSPI's 'Women and Men in India' compendium served by gender/getGenderIndicatorList, each paged in full from gender/getGenderRecords, with its filter listing. Each indicator reprints a different source agency (Census, SRS, NFHS, PLFS, NCRB, RBI, ministries) with its own dimensions and cadence. Values '-' at source are missing; years marked '*' are projections.",
    list: inds, filters, indicators, failed,
  };
  writeRaw(root, "data/raw/gender-records.json", raw);
  return raw;
}

/* ---------- bake ---------- */
const slug = (s, n = 40) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n).replace(/_$/, "") || "x";
const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/\s*\*+\s*$/, "").replace(/\s+\(%\)$/, "").trim();
const GEO_KEYS = ["state/UT", "state"];
// the every-cut table's "cut" column: the dimensions a bundle's series are crossed by
const DIM_WORD = { sub_indicator: "measure", gender: "sex", sector: "rural or urban", age_group: "age", education_level: "education",
  birth_order: "birth order", family_planning_method: "method", unmet_need_for_family_planning: "measure", demand_for_family_planning: "measure",
  survey: "round", ayush_category: "system of medicine", discipline: "discipline", category: "category", "NCO Division": "occupation",
  employment_category: "employment status", industry: "industry", activity: "activity", bank_group: "bank group", deposit_amount: "measure",
  scheme: "scheme", broad_activity_category: "activity", type_of_establishment: "establishment type", lok_sabha_election: "election",
  court: "court", police: "force", service: "service", crime_head: "crime", board: "board", country: "country", subject: "subject" };
const SKIP = new Set(["year", "indicator", "value", "unit", ...GEO_KEYS]);
const GREY = "#5F6675";
const pad3 = (c) => String(c).padStart(3, "0");
export const genderSlug = (code, ruler) => `gender-t${pad3(code)}${ruler ? "-" + ruler : ""}`;

export function bakeGender(root, dcfg, raw) {
  const vintage = raw.vintage;
  const listed = new Map(raw.list.map((i) => [String(i.indicator_code), String(i.description).trim()]));
  if (listed.size < 150) throw new Error(`gender: raw lists ${listed.size} indicators`);
  // anchor: the census sex ratio the guide opens on
  const sr = (raw.indicators["2"] ?? []).find((r) => r["state/UT"] === "All India" && r.year === "1951");
  if (!sr || parseNumber(sr.value) !== 946) throw new Error(`gender: no data returned: sex ratio 1951 (got ${sr?.value})`);
  const missingCfg = [...listed.keys()].filter((c) => !T[c]);
  if (missingCfg.length) throw new Error(`gender: no table config for indicator(s) ${missingCfg.join(", ")}: add them to T in gender.mjs`);

  const written = [];
  for (const [code, rows] of Object.entries(raw.indicators)) {
    const cfg = T[code];
    if (!rows.length) throw new Error(`gender ${code}: no rows`);
    const name = listed.get(code);
    // an NFHS reprint's round is its bundle (the ruler), not a cut of it
    const dims = Object.keys(rows[0]).filter((k) => !SKIP.has(k) && !(cfg.drop ?? []).includes(k) && !(cfg.nfhs && k === "survey"));
    // sub_indicator first, then the indicator's own order
    dims.sort((a, b) => (a === "sub_indicator" ? -1 : b === "sub_indicator" ? 1 : 0));
    const groups = new Map();   // ruler -> rows
    for (const r of rows) {
      let ruler = ["", ""];
      if (cfg.nfhs) ruler = /2015-16/.test(r.year) ? ["nfhs4", "NFHS-4, 2015-16"] : ["nfhs5", "NFHS-5, 2019-21"];
      else if (cfg.plfs) ruler = plfsRuler(String(r.year).trim());
      else if (cfg.split) ruler = cfg.split(r);
      if (!groups.has(ruler[0])) groups.set(ruler[0], { label: ruler[1], rows: [] });
      groups.get(ruler[0]).rows.push(r);
    }
    for (const [ruler, g] of groups) {
      const omitted = {};
      const axis = new Map();   // date -> label
      const kindOf = new Map();   // date -> period kind
      const series = {};
      const unitsSeen = new Set();
      let provisional = false;
      // the cuts printed in more than one unit
      const unitsByKey = new Map();
      for (const r of g.rows) {
        const geoRaw = GEO_KEYS.map((k) => r[k]).find((v) => v != null);
        const geo = geoRaw == null ? null : (String(geoRaw).trim() === "India" ? "All India" : String(geoRaw).trim());
        const k = [...dims.map((d) => tidy(r[d])).filter((v2) => v2 !== "").map((v2) => slug(v2, 56)), geo ? slug(geo, 30) : null].filter(Boolean).join("__");
        (unitsByKey.get(k) ?? unitsByKey.set(k, new Set()).get(k)).add(r.unit);
      }
      const multiUnit = new Set([...unitsByKey].filter(([, u]) => u.size > 1).map(([k]) => k));
      for (const r of g.rows) {
        const geoRaw = GEO_KEYS.map((k) => r[k]).find((v) => v != null);
        const geo = geoRaw == null ? null : (String(geoRaw).trim() === "India" ? "All India" : String(geoRaw).trim());
        let p = periodOf(r.year, { july: cfg.plfs || cfg.july || /NSS/.test(r.year), nfhs: cfg.nfhs });
        if (Number(code) === 126 && r.year === "-") p = { date: "2025-01-01", label: "latest assembly in each state, as compiled in 2025", kind: "stock" };
        if (Number(code) === 133 && /^2017-25$/.test(r.year)) p = { date: "2025-01-01", label: "2017 to 2025, cumulative", kind: "stock" };
        // literacy's 2017 point is the NSS 75th round, July 2017 to June 2018
        if ([55, 58].includes(Number(code)) && String(r.year).trim() === "2017") p = { date: "2017-07-01", label: "2017-18 (NSS 75th round)", kind: "round" };
        if (!p) throw new Error(`gender ${code}: unparsed year "${r.year}"`);
        if (p.provisional) provisional = true;
        const v = parseNumber(r.value);
        if (v == null) { const k = String(r.value).trim() || "blank"; omitted[k] = (omitted[k] ?? 0) + 1; continue; }
        const unit = cfg.unitOf?.(r) ?? cfg.units?.[r.unit] ?? cfg.unit ?? UNIT_OF[r.unit];
        if (!unit) throw new Error(`gender ${code}: no Atlas unit for row unit "${r.unit}"`);
        unitsSeen.add(unit);
        const parts = dims.map((k) => [k, tidy(r[k])]).filter(([, v2]) => v2 !== "");
        // a table that prints one cut twice, as a count and as a share (ASUSE ownership, judges by
        // court), tells the two apart only by the row unit: the unit then joins the label and key
        const baseKey = [...parts.map(([, v2]) => slug(v2, 56)), geo ? slug(geo, 30) : null].filter(Boolean).join("__");
        const unitTag = multiUnit.has(baseKey) ? UNIT_WORD[unit] ?? unit : null;
        const label = [...parts.map(([, v2]) => v2), geo, unitTag].filter(Boolean).join(", ") || name;
        let key = [...parts.map(([, v2]) => slug(v2, 56)), geo ? slug(geo, 30) : null, unitTag ? slug(unit) : null].filter(Boolean).join("__") || "value";
        // a long name cut to 36 characters can collide with its neighbour: add a short hash of the full label
        if (series[key] && series[key].label !== label) key += "_" + crypto.createHash("sha1").update(label).digest("hex").slice(0, 6);
        const s = (series[key] ??= { name: `gender_t${code}_${key}`, label, color: GREY, unit, map: new Map(), labels: new Map(), group: parts[0]?.[1] ?? geo ?? "", geo: geo ?? undefined });
        if (s.unit !== unit) throw new Error(`gender ${code}: series ${key} mixes units ${s.unit} and ${unit}`);
        if (s.map.has(p.date) && s.map.get(p.date) !== v) throw new Error(`gender ${code}: two values for ${key} at ${p.date} (${s.map.get(p.date)}, ${v})`);
        s.map.set(p.date, v);
        s.labels.set(p.date, String(r.year).trim());
        axis.set(p.date, p.label);
        kindOf.set(p.date, p.kind);
      }
      const dates = [...axis.keys()].sort();
      const out = {};
      for (const [k, s] of Object.entries(series)) {
        const data = dates.map((d) => s.map.get(d) ?? null);
        const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
        const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
        const o = { name: s.name, label: s.label, color: s.color, unit: s.unit, data, group: s.group };
        if (s.geo) o.geo = s.geo;
        if (gaps.length) { o.gaps = gaps; o.gapsNote = "The compendium prints no figure for this cut in these periods."; }
        if (cfg.est) {
          const est = dates.filter((d, i) => data[i] != null && cfg.est(s.labels.get(d)));
          if (est.length && est.length < data.filter((v) => v != null).length) { o.estimated = est; o.estimatedNote = "Projection: the Technical Group on Population Projections (July 2020), not a census or survey count."; }
        }
        out[k] = o;
      }
      if (!Object.keys(out).length) throw new Error(`gender ${code}${ruler ? "-" + ruler : ""}: nothing to bake`);
      const kinds = new Set([...axis.keys()].map((d) => d.slice(5)));
      const yearly = dates.length > 1 && dates.every((d, i) => i === 0 || +d.slice(0, 4) - +dates[i - 1].slice(0, 4) === 1) && kinds.size === 1 && [...kinds][0].endsWith("-01");
      const frequency = dates.length === 1 ? "cross-sectional" : yearly ? "annual" : "irregular";
      const slugB = genderSlug(code, ruler);
      const src = cfg.src ? `${cfg.src}, as reprinted in MoSPI's Women and Men in India 2025 (table ${cfg.tab})` : `MoSPI, Women and Men in India 2025 (table ${cfg.tab})`;
      const bundle = {
        meta: {
          dossier: "gender", product: "gender", source: src, agency: cfg.src || null, compendiumTable: cfg.tab, indicatorCode: Number(code),
          base: g.label ? g.label : "as published", frequency, unit: unitsSeen.size === 1 ? [...unitsSeen][0] : "mixed",
          vintage, geo: dcfg.geo ?? "IND", latestPeriod: latestLabel(axis.get(dates.at(-1)), kindOf.get(dates.at(-1))), releaseDate: "2026-04-29",
          revisionPolicy: dcfg.revision_policy,
          coverage: `${name}${g.label ? ` (${g.label})` : ""}`,
          periodLabels: Object.fromEntries(dates.map((d) => [d, axis.get(d)])),
          cut: (() => { const w = [...dims.map((k) => DIM_WORD[k] ?? k.replace(/_/g, " ")), ...(g.rows.some((r) => GEO_KEYS.some((k) => r[k] != null && !/^(All )?India$/.test(String(r[k]).trim()))) ? ["state"] : [])]; return w.length ? (w.length > 1 ? w.slice(0, -1).join(", ") + " and " + w.at(-1) : w[0]).replace(/^./, (c) => c.toUpperCase()) : "All India"; })(),
          note: `MoSPI's compendium reprints this table from ${cfg.src || "the agency its table names"}; the figures are that agency's.${g.label ? ` This bundle holds one instrument only (${g.label}); the indicator's other instrument is a separate bundle, never joined to this one.` : ""}${provisional ? " The latest year is provisional at source." : ""} Values printed as "-" (no observation) or "NR" (not reported) are not baked; meta.omitted counts them.`,
          omitted,
        },
        dates, series: out,
      };
      writeSeries(root, `data/series/${slugB}.json`, bundle);
      written.push(slugB);
    }
  }
  // retire the pre-2026-10-10 curated bundles (the per-indicator bundles replace them, and
  // gender-literacy spliced the census with NSS 2017-18)
  for (const old of ["sexratio", "imr", "lifeexp", "mmr", "fertility", "literacy", "work", "states"]) {
    const p = path.join(root, `data/series/gender-${old}.json`);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`retired data/series/gender-${old}.json`); }
  }
  return written;
}

export async function buildGender(root, dcfg, vintage) {
  const raw = await fetchGenderRaw(root, vintage);
  const failed = Object.keys(raw.failed ?? {});
  if (failed.length) throw new Error(`gender: ${failed.length} indicator(s) failed to fetch: ${failed.join(", ")}`);
  const onDisk = JSON.parse(fs.readFileSync(path.join(root, "data/raw/gender-records.json"), "utf8"));
  return bakeGender(root, dcfg, onDisk);
}

/* Catalogue (docs/CONTRACT-coverage.md): gender/getGenderIndicatorList and
 * gender/getGenderFilterByIndicatorId for all of the compendium's indicators, one cut at a
 * time: gender:<indicator>:all | :<dimension>:<value>. */
import { writeCatalogue, indicatorCatalogue, catalogueCli, sourceCfg, ROOT } from "../catalogue.mjs";
// MoSPI's own MCP server lists the compendium's indicators in a definitions file; codes it
// lists that the live API no longer serves enter the catalogue too, so the ledger has to take
// a position on them (they are `blocked`).
const MCP_DEFINITIONS = "https://raw.githubusercontent.com/nso-india/esankhyiki-mcp/HEAD/definitions/gender_definitions.json";
export async function catalogueGender() {
  const inds = (await mospi("gender/getGenderIndicatorList", {})).data ?? [];
  const live = Array.isArray(inds) ? inds : inds.indicator ?? [];
  const items = await indicatorCatalogue({ mospi, prefix: "gender", indicators: live,
    filter: (ind) => ["gender/getGenderFilterByIndicatorId", { indicator_code: ind.indicator_code }] });
  const defs = Object.values(await getJson(MCP_DEFINITIONS, { retries: 3, headers: { "User-Agent": "india-atlas" } }));
  const served = new Set(live.map((i) => String(i.indicator_code)));
  for (const d of defs) if (!served.has(String(d.indicator_code))) items.push({ id: `gender:${d.indicator_code}:all`, label: `${String(d.name).trim()} (in MoSPI's MCP definitions, not in the live indicator list)` });
  writeCatalogue("gender", { source: "MoSPI: Women and Men in India, the multi-source gender compendium (eSankhyiki API)",
    generator: "scripts/lib/products/gender.mjs --catalogue",
    note: "From getGenderIndicatorList and getGenderFilterByIndicatorId: one cut at a time; each indicator's own years sit inside it.", items });
}
await catalogueCli(import.meta.url, catalogueGender);
if (process.argv[1] && path.resolve(process.argv[1]).endsWith("products/gender.mjs")) {
  if (process.argv.includes("--fetch")) await fetchGenderRaw(ROOT, new Date().toISOString().slice(0, 10));
  if (process.argv.includes("--bake")) {
    const { dcfg } = sourceCfg("gender");
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/gender-records.json"), "utf8"));
    const w = bakeGender(ROOT, dcfg, raw);
    console.log(`gender: ${w.length} bundles`);
  }
}
