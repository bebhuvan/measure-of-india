// scripts/lib/products/credit.mjs: money, credit and banks. Who borrows from India's banks,
// how fast credit and money grow, where the credit goes by state, and how healthy the banks
// are. Everything is read, read-only, from the owner's local Data Bank (scripts/lib/databank.mjs):
// its RBI DBIE webi mirror and its parsed RBI datasets. Nothing here calls the RBI live.
//
// Sources, by part of the guide (DBIE report ids; parsed Data Bank datasets in backticks):
//   Bank business, fortnightly (Section 42 return, all scheduled commercial banks):
//     689  Business of Scheduled Banks, June 1997 on: deposits, credit, investments, cash.
//          Items 0061/0251 are deposits and credit "(Adjusted)": RBI's figures excluding the
//          July 2023 merger of HDFC Ltd with HDFC Bank, published 14 Jul 2023 to 22 Aug 2025
//          (equal to the raw figures before; blank after). Each date carries a Provisional
//          and (later) a Final row: the Final row wins, the version kept is recorded.
//     1130 provider DPd: food credit, fortnightly from 1993 (the FCI consortium's borrowing).
//   Credit by sector and industry, monthly (sector-wise and industry-wise bank credit, SIBC):
//     `rbi_credit_history`: the RBI's DBIE exports of "Deployment of Bank Credit by Major
//          Sectors" and "RBIB Table 16, Industry-wise Deployment", April 2007 on, in two
//          classifications never joined (AGENTS.md rule 1): the old format (Apr 2007 to Dec 2020)
//          and the new format (Jan 2019 on; new codes, adds aviation, gold loans, PSL items).
//     `rbi_sectoral_credit`: the monthly press-release workbooks; used only for months after
//          the history export ends, and checked against it where both exist (validate.mjs).
//          Bank credit, food and non-food rows cover all SCBs (Section 42); the sector rows
//          cover selected banks (about 95% of non-food credit; 90% in the old format).
//   NBFCs' own credit: `rbi_nbfc_credit` (selected NBFCs and HFCs, from May 2024).
//   Money: `rbi_dbie_cas_money` (DBIE Data Query tables): MSC_F/MSS_F fortnightly M3 and its
//          sources (2001 on), BMC_M/MSS_M monthly (1991 on), RMC_M/RMS_M reserve money,
//          MON_AG annual growth rates (1971 on), MONTRY_RATIOS (1952 on). The "_IM" series are
//          RBI's figures including the merger from July 2023; the plain series exclude it
//          until they stop (June 2025). Both are kept, never joined.
//   Banking health (annual, as on 31 March): 330 gross and net NPAs by bank group (1997 on),
//     329 banks by capital adequacy band, 1114 movement of NPAs bank by bank (2005 on; its
//     unit column is junk, values are rupees), 1508 frauds by banking operation (2005 on).
//   Credit by place: 1415 quarterly spatial statement 3A (offices, deposits, credit by state,
//     bank group and population group, Mar 2023 on), 1465 (Jun 2017 to Dec 2022), 1483
//     (Mar 2004 to Mar 2017): three report generations, kept as three bundles. 1134 BSR-1
//     table 1.3, credit by place of sanction and of utilisation, by state (March 2026).
//
// Units: rupee amounts are baked as ₹ lakh crore (1e12 rupees) unless a bundle says otherwise.
// Hand-checked values are recorded in docs/status/credit.md and in validate.mjs.
import { databankRoot, dbieReport, dbieProvider, databankQuery } from "../databank.mjs";
import { writeSeries, writeRaw } from "../util.mjs";
import { DEEP, bakeDeep } from "./credit-deep.mjs";
import fs from "node:fs";
import path from "node:path";

const LC = 1e12;                       // rupees in a lakh crore
const CR_LC = 1e5;                     // crore in a lakh crore
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const num = (s) => { if (s == null || s === "") return null; const v = parseFloat(String(s).replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
const iso = (s) => String(s).slice(0, 10).replace(/\//g, "-");   // "2026/09/15 00:00:00" -> "2026-09-15"
const monthKey = (d) => `${d.slice(0, 7)}-01`;
const dayMs = 86400000;
const t = (d) => Date.parse(d + "T00:00:00Z");

/** y/y growth against the reporting date closest to one year earlier (within 10 days).
 *  Before December 2025 the Section 42 return fell on alternate Fridays, so the match is the
 *  date 364 days earlier; from December 2025 it falls on the 15th and the last day of the
 *  month, and the match is the nearest old-calendar Friday, which is what RBI compares too. */
function yoyByDate(dates, values) {
  return dates.map((d, i) => {
    const v = values[i]; if (v == null) return null;
    const target = t(d) - 365 * dayMs; let best = -1, bd = Infinity;
    for (let j = i - 1; j >= 0; j--) { const dd = Math.abs(t(dates[j]) - target); if (dd < bd) { bd = dd; best = j; } if (t(dates[j]) < target - 20 * dayMs) break; }
    if (best < 0 || bd > 10 * dayMs || values[best] == null || values[best] === 0) return null;
    return r2((v / values[best] - 1) * 100);
  });
}

/** Interior nulls of a series, disclosed on the series (CONTRACT-series rule 2). */
function disclose(dates, s, note) {
  const first = s.data.findIndex((v) => v != null), last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
  const gaps = dates.filter((d, i) => i > first && i < last && s.data[i] == null);
  if (gaps.length) { s.gaps = gaps; if (note) s.gapsNote = note; }
  return s;
}

/** The unit the every-cut table shows for a series (src/dossiers/everycut.js UNITS). */
function unitFor(rel, name, bundleUnit) {
  const n = String(name);
  if (rel === "credit-money-annual") return "pct_yoy";
  if (rel === "credit-money-ratios") return "times";
  if (/_yoy_pct$/.test(n)) return "pct_yoy";
  if (/_pct$/.test(n)) return "pct";
  if (/_inr_lakh_crore$/.test(n)) return "inr_lakh_crore";
  if (/_(banks|offices|cases)$/.test(n)) return "count";
  if (/_rate$/.test(n)) return "pct_per_annum";
  if (rel.startsWith("credit-frauds") && /_amount$/.test(n)) return "inr_crore";
  if (/_(amount|limit)$/.test(n)) return "inr_lakh_crore";
  if (/_accounts$/.test(n)) return "lakh_count";
  if (["inr_lakh_crore", "pct", "count"].includes(bundleUnit)) return bundleUnit;
  throw new Error(`credit: no unit for series ${n} in ${rel}`);
}

/** Trim a bundle's axis to the dates some series reports, then write it. */
function bundleOut(root, rel, meta, dates, series, gapNote) {
  const any = (i) => Object.values(series).some((s) => s.data[i] != null);
  let a = 0, b = dates.length - 1;
  while (a <= b && !any(a)) a++;
  while (b >= a && !any(b)) b--;
  const D = dates.slice(a, b + 1);
  for (const s of Object.values(series)) { s.data = s.data.slice(a, b + 1); disclose(D, s, gapNote); }
  for (const [k, s] of Object.entries(series)) if (s.data.every((v) => v == null)) delete series[k];
  for (const s of Object.values(series)) s.unit ??= unitFor(rel, s.name, meta.unit);
  writeSeries(root, `data/series/${rel}.json`, { meta: { latestPeriod: D.at(-1), ...meta }, dates: D, series });
  return { dates: D, series };
}

// label tidying for display: RBI's ampersands, footnote digits and "of which" fragments
const tidy = (l) => String(l).replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, "").replace(/([a-z)])\d$/, "$1").replace(/\s*of which,?\s*$/i, "")
  .replace(/ & /g, " and ").replace(/&/g, " and ").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
const sentenceCase = (l) => (l === l.toUpperCase() ? l.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : l);
const norm = (l) => tidy(l).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const slug = (l) => norm(l).replace(/ /g, "_").slice(0, 48);


/* ======================================================================================
 * 2. Sectoral deployment of bank credit (SIBC), monthly, two classifications
 * ==================================================================================== */
// code -> [key, display label]; the code is the source's, the label is checked against it
const SECTORS_NEW = {
  "I": ["bank_credit", "Bank credit, all scheduled commercial banks"], "II": ["food_credit", "Food credit"], "III": ["non_food_credit", "Non-food credit"],
  "1": ["agriculture", "Agriculture and allied activities"], "2": ["industry", "Industry"], "2.1": ["industry_micro_small", "Industry, micro and small"],
  "2.2": ["industry_medium", "Industry, medium"], "2.3": ["industry_large", "Industry, large"], "3": ["services", "Services"],
  "3.1": ["transport_operators", "Transport operators"], "3.2": ["computer_software", "Computer software"], "3.3": ["tourism_hotels_restaurants", "Tourism, hotels and restaurants"],
  "3.4": ["shipping", "Shipping"], "3.5": ["aviation", "Aviation"], "3.6": ["professional_services", "Professional services"], "3.7": ["trade", "Trade"],
  "3.7.1": ["wholesale_trade", "Wholesale trade"], "3.7.2": ["retail_trade", "Retail trade"], "3.8": ["commercial_real_estate", "Commercial real estate"],
  "3.9": ["nbfcs", "Non-banking financial companies (NBFCs)"], "3.9.1": ["hfcs", "Housing finance companies"], "3.9.2": ["pfis", "Public financial institutions"],
  "3.10": ["other_services", "Other services"], "4": ["personal_loans", "Personal loans"], "4.1": ["consumer_durables", "Consumer durables"],
  "4.2": ["housing", "Housing loans"], "4.3": ["advances_against_fds", "Loans against fixed deposits"], "4.4": ["advances_against_shares", "Loans against shares and bonds"],
  "4.5": ["credit_cards", "Credit card outstanding"], "4.6": ["education", "Education loans"], "4.7": ["vehicle_loans", "Vehicle loans"],
  "4.8": ["gold_loans", "Loans against gold jewellery"], "4.9": ["other_personal_loans", "Other personal loans"],
  "5.1": ["psl_agriculture", "Priority sector: agriculture"], "5.2": ["psl_micro_small", "Priority sector: micro and small enterprises"], "5.3": ["psl_medium", "Priority sector: medium enterprises"],
  "5.4": ["psl_housing", "Priority sector: housing"], "5.5": ["psl_education", "Priority sector: education loans"], "5.6": ["psl_renewable_energy", "Priority sector: renewable energy"],
  "5.7": ["psl_social_infrastructure", "Priority sector: social infrastructure"], "5.8": ["psl_export_credit", "Priority sector: export credit"], "5.9": ["psl_others", "Priority sector: others"],
  "5.10": ["psl_weaker_sections", "Priority sector: weaker sections"],
};
const SECTORS_OLD = {
  "I": ["bank_credit", "Bank credit, all scheduled commercial banks"], "II": ["food_credit", "Food credit"], "III": ["non_food_credit", "Non-food credit"],
  "1": ["agriculture", "Agriculture and allied activities"], "2": ["industry", "Industry"], "2.1": ["industry_micro_small", "Industry, micro and small"],
  "2.2": ["industry_medium", "Industry, medium"], "2.3": ["industry_large", "Industry, large"], "3": ["services", "Services"],
  "3.1": ["transport_operators", "Transport operators"], "3.2": ["computer_software", "Computer software"], "3.3": ["tourism_hotels_restaurants", "Tourism, hotels and restaurants"],
  "3.4": ["shipping", "Shipping"], "3.5": ["professional_services", "Professional services"], "3.6": ["trade", "Trade"],
  "3.6.1": ["wholesale_trade", "Wholesale trade (other than food procurement)"], "3.6.2": ["retail_trade", "Retail trade"], "3.7": ["commercial_real_estate", "Commercial real estate"],
  "3.8": ["nbfcs", "Non-banking financial companies (NBFCs)"], "3.9": ["other_services", "Other services"], "4": ["personal_loans", "Personal loans"],
  "4.1": ["consumer_durables", "Consumer durables"], "4.2": ["housing", "Housing loans"], "4.3": ["advances_against_fds", "Loans against fixed deposits"],
  "4.4": ["advances_against_shares", "Loans against shares and bonds"], "4.5": ["credit_cards", "Credit card outstanding"], "4.6": ["education", "Education loans"],
  "4.7": ["vehicle_loans", "Vehicle loans"], "4.8": ["other_personal_loans", "Other personal loans"], "5": ["psl_total", "Priority sector (memo)"],
  "5.1": ["psl_agriculture", "Priority sector: agriculture"], "5.2": ["psl_micro_small", "Priority sector: micro and small enterprises"],
  "5.2(a)": ["psl_micro_small_manufacturing", "Priority sector: micro and small enterprises, manufacturing"], "5.2(b)": ["psl_micro_small_services", "Priority sector: micro and small enterprises, services"],
  "5.3": ["psl_housing", "Priority sector: housing"], "5.4": ["psl_micro_credit", "Priority sector: micro-credit"], "5.5": ["psl_education", "Priority sector: education loans"],
  "5.6": ["psl_sc_st_organisations", "Priority sector: state-sponsored organisations for SC/ST"], "5.7": ["psl_weaker_sections", "Priority sector: weaker sections"], "5.8": ["psl_export_credit", "Priority sector: export credit"],
};
// a loose check that the source label still means what the code map says (first word)
const labelOk = (code, srcLabel, ours) => {
  const a = norm(srcLabel), b = norm(ours);
  if (code === "I") return /bank credit/.test(a);
  if (code === "2" && /^industr/.test(a)) return true;
  const w = a.replace(/^(priority sector )/, "").split(" ")[0];
  return b.includes(w.slice(0, 6)) || (w === "adv" && /loans against/.test(b)) || (w === "advances" && /loans against/.test(b)) || (w === "industries" && /industry/.test(b));
};
const ROMAN = { "(i)": "5.1", "(ii)": "5.2", "(iii)": "5.3", "(iv)": "5.4", "(v)": "5.5", "(vi)": "5.6", "(vii)": "5.7", "(viii)": "5.8", "(ix)": "5.9", "(x)": "5.10" };

/** Industry keys from labels, with the parent's key on the generic "Others" rows. */
function industryKeys(rows) {
  const lab = new Map(rows.map((r) => [r.code, r.label]));
  const key = new Map();
  for (const code of [...lab.keys()].sort((a, b) => a.split(".").length - b.split(".").length)) {
    if (code === "2" || code === "total") { key.set(code, ["industry_total", "Industry, all"]); continue; }
    const l = tidy(lab.get(code));
    const parent = code.split(".").slice(0, -1).join(".");
    if (/^others?$/i.test(l) && key.has(parent)) key.set(code, [`${key.get(parent)[0]}_others`, `${key.get(parent)[1]}, others`]);
    else key.set(code, [slug(l.replace(/\(.*?\)/g, "")), l.replace(/ \(other than Indian Railways\)/, "")]);
  }
  return key;
}

// state names as a reader writes them
const STATE_NAME = { "NCT OF DELHI": "Delhi", "JAMMU & KASHMIR": "Jammu and Kashmir", "ANDAMAN & NICOBAR ISLANDS": "Andaman and Nicobar Islands",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "Dadra and Nagar Haveli and Daman and Diu", "DADRA & NAGAR HAVELI": "Dadra and Nagar Haveli", "DAMAN & DIU": "Daman and Diu" };
const stateName = (s) => STATE_NAME[s] ?? s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/ & /g, " and ");
/** a continuous axis of quarter-end months from the first to the last date (gaps become nulls) */
const quarterAxis = (dates) => { const ds = [...dates].sort(), out = []; let [y, m] = ds[0].split("-").map(Number); for (;;) { const k = `${y}-${String(m).padStart(2, "0")}-01`; if (k > ds.at(-1)) break; out.push(k); m += 3; if (m > 12) { m -= 12; y++; } } return out; };
const SPLITS = { TELANGANA: "ANDHRA PRADESH", LADAKH: "JAMMU & KASHMIR" };   // new unit -> the state it was carved from
const fqDate = (fq) => { const [fy, q] = fq.split(":"); const y0 = +fy.slice(0, 4); return { Q1: `${y0}-06-01`, Q2: `${y0}-09-01`, Q3: `${y0}-12-01`, Q4: `${y0 + 1}-03-01` }[q]; };

export async function buildCredit(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const base = { dossier: "credit", source: dcfg.source_agency, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy };
  const stamp = (rel, obj) => { writeRaw(root, rel, { vintage, ...obj }); return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")).vintage; };

  /* ======================================================================================
   * 1. Section 42: bank business, fortnightly (689), food credit (1130 DPd)
   * ==================================================================================== */
  const R689 = dbieReport(db, "689");
  const F1130 = dbieProvider(db, "1130", "DPd");
  // one display unit only: every value is repeated once per unit (ACTUALS, LAKHS, CRORES...)
  const rows689 = R689.rows.filter((r) => r["Unit Description"] === "ACTUALS");
  const rows1130 = F1130.rows.filter((r) => r["Unit Desc wss4"] === "ACTUALS");
  if (rows689.length < 40000) throw new Error(`credit: report 689 served ${rows689.length} ACTUALS rows; expected 1997-2026 fortnightly (>40,000)`);
  const V42 = stamp("data/raw/credit-section42.json", {
    note: "RBI DBIE report 689 (Business of Scheduled Banks, fortnightly) and report 1130 data provider DPd (food credit), read from the local Data Bank mirror. Only the ACTUALS display unit is kept: DBIE repeats every value once per unit. Values are rupees.",
    reports: {
      "689": { provenance: R689.provenance, filter: "Unit Description = ACTUALS", columns: ["Time Date", "Bank Group Name", "Item Code", "Item Description", "Version Desc", "Reporting Bank Count", "Item Value"],
        rows: rows689.map((r) => [iso(r["Time Date"]), r["Bank Group Name"], r["Item Code"], r["Item Description"], r["Version Desc"], r["Reporting Bank Count"], r["Item Value"]]) },
      "1130:DPd": { provenance: F1130.provenance, filter: "Unit Desc wss4 = ACTUALS", columns: ["Fortnight Date Prov", "Item Code", "Description", "Version Desc", "Item_Values"],
        rows: rows1130.map((r) => [iso(r["Fortnight Date Prov"]), r["Item Code"], r["Description"], r["Version Desc"], r["Item_Values"]]) },
    },
  });

  // value per (date, item): the Final row if one exists, else the Provisional
  const pick = new Map(), prov = new Map();   // "date|group|code" -> { v, ver }
  for (const r of rows689) {
    const k = `${iso(r["Time Date"])}|${r["Bank Group Name"]}|${r["Item Code"]}`;
    const v = num(r["Item Value"]), ver = r["Version Desc"];
    if (ver === "Provisional" && v != null) prov.set(k, { v, ver });
    const prev = pick.get(k);
    if (!prev || (prev.ver !== "Final" && ver === "Final") || (prev.v == null && v != null)) pick.set(k, { v, ver });
  }
  const D42 = [...new Set(rows689.map((r) => iso(r["Time Date"])))].sort();
  // Source defect: on some dates (mid-2021) the Final rows do not add up (Final bank credit is
  // not Final loans plus bills) while the Provisional rows do. Bank credit and its five parts
  // are taken as one set: the Final set where it adds up, else the Provisional set where that
  // adds up. The dates switched are disclosed in the bundle note.
  const CREDIT_SET = ["0250", "0260", "0280", "0290", "0310", "0320"];
  const addsUp = (m, d) => { const v = CREDIT_SET.map((c) => m.get(`${d}|ALL SCBS|${c}`)?.v); return v.every((x) => x != null) && Math.abs(v[0] - v.slice(1).reduce((a, c) => a + c, 0)) <= 2e10; };
  const provDates = [];
  for (const d of D42) if (!addsUp(pick, d) && addsUp(prov, d)) { for (const c of CREDIT_SET) pick.set(`${d}|ALL SCBS|${c}`, prov.get(`${d}|ALL SCBS|${c}`)); provDates.push(d); }
  const g42 = (code, grp = "ALL SCBS") => D42.map((d) => { const o = pick.get(`${d}|${grp}|${code}`); return o?.v == null ? null : r3(o.v / LC); });
  const finalShare = D42.filter((d) => pick.get(`${d}|ALL SCBS|0250`)?.ver === "Final").length;

  // the items, in the report's own order; derived rows are labelled as such
  const ITEMS689 = [
    ["0060", "deposits", "Aggregate deposits", "#2E4BD8"],
    ["0070", "demand_deposits", "Demand deposits (current and savings accounts)"],
    ["0080", "time_deposits", "Time deposits (fixed and recurring)"],
    ["0061", "deposits_ex_merger", "Aggregate deposits, excluding the HDFC merger (RBI adjusted)"],
    ["0250", "credit", "Bank credit", "#2E4BD8"],
    ["0251", "credit_ex_merger", "Bank credit, excluding the HDFC merger (RBI adjusted)"],
    ["0260", "loans_cash_credit_overdrafts", "Loans, cash credits and overdrafts"],
    ["0280", "inland_bills_purchased", "Inland bills purchased"],
    ["0290", "inland_bills_discounted", "Inland bills discounted"],
    ["0310", "foreign_bills_purchased", "Foreign bills purchased"],
    ["0320", "foreign_bills_discounted", "Foreign bills discounted"],
    ["0220", "slr_securities", "Investments in SLR securities"],
    ["0221", "slr_securities_ex_merger", "Investments in SLR securities, excluding the HDFC merger (RBI adjusted)"],
    ["0230", "government_securities", "Government securities"],
    ["0240", "other_approved_securities", "Other approved securities"],
    ["1751", "non_slr_government_securities", "Investments in other government securities (non-SLR)"],
    ["1780", "commercial_paper", "Investments in commercial paper"],
    ["1810", "shares_psus", "Shares issued by public sector undertakings"],
    ["1820", "shares_private_corporates", "Shares issued by private companies"],
    ["1840", "shares_others", "Shares, others"],
    ["1860", "bonds_psus", "Bonds and debentures of public sector undertakings"],
    ["1870", "bonds_private_corporates", "Bonds and debentures of private companies"],
    ["1890", "bonds_others", "Bonds and debentures, others"],
    ["1790", "mutual_fund_units", "Units of mutual funds"],
    ["1830", "financial_institution_instruments", "Instruments issued by financial institutions"],
    ["1880", "public_financial_institutions", "Instruments of public financial institutions"],
    ["0190", "cash_and_rbi_balances", "Cash in hand and balances with the RBI"],
    ["0200", "cash_in_hand", "Cash in hand"],
    ["0213", "balances_with_rbi", "Balances with the RBI"],
    ["0010", "liabilities_to_banks", "Liabilities to the banking system"],
    ["0020", "deposits_from_banks", "Demand and time deposits from banks"],
    ["0030", "borrowings_from_banks", "Borrowings from banks"],
    ["0040", "other_liabilities_to_banks", "Other demand and time liabilities to banks"],
    ["0050", "liabilities_to_others", "Liabilities to others"],
    ["0090", "borrowings_from_others", "Borrowings from others"],
    ["0100", "other_liabilities_to_others", "Other demand and time liabilities"],
    ["0110", "assets_with_banks", "Assets with the banking system"],
    ["0120", "balances_with_other_banks", "Balances with other banks"],
    ["0130", "balances_current_account", "Balances with other banks, current account"],
    ["0140", "balances_other_accounts", "Balances with other banks, other accounts"],
    ["0150", "call_money_lent", "Money at call and short notice"],
    ["0160", "advances_to_banks", "Advances to banks"],
    ["0170", "other_assets_with_banks", "Other assets with the banking system"],
  ];
  const seen689 = new Set(rows689.filter((r) => r["Bank Group Name"] === "ALL SCBS").map((r) => r["Item Code"]));
  for (const c of seen689) if (!ITEMS689.some(([k]) => k === c)) console.warn(`credit: report 689 item ${c} not mapped (new item?)`);
  const s42 = {};
  for (const [code, key, label, color] of ITEMS689) s42[key] = { name: `${key}_inr_lakh_crore`, label, ...(color ? { color } : {}), data: g42(code) };
  // the adjusted items repeat the raw figures before the merger and go blank after it: keep
  // them from the first date RBI actually adjusted (differs from the raw item by more than
  // rounding) to the last date it published one
  for (const [k, rawKey] of [["deposits_ex_merger", "deposits"], ["credit_ex_merger", "credit"], ["slr_securities_ex_merger", "slr_securities"]]) {
    const adj = s42[k].data, raw = s42[rawKey].data;
    const a = adj.findIndex((v, i) => v != null && raw[i] != null && Math.abs(v - raw[i]) > 0.001);
    const b = adj.length - 1 - [...adj].reverse().findIndex((v) => v != null);
    s42[k].data = adj.map((v, i) => (a >= 0 && i >= a && i <= b ? v : null));
  }
  const m42 = (extra) => ({ ...base, dossier: "credit-s42", vintage: V42, frequency: "fortnightly", base: "Section 42 return", unit: "inr_lakh_crore", ...extra });
  const scb = bundleOut(root, "credit-scb", m42({
    coverage: "Business of all scheduled commercial banks in India, every reporting fortnight since June 1997: deposits, credit, investments, cash and inter-bank positions",
    note: `RBI DBIE report 689 (Section 42 return), ₹ lakh crore. Final figures where RBI has published them (${finalShare} of ${D42.length} dates), provisional otherwise.${provDates.length ? ` On ${provDates.join(", ")} the Final rows do not add up (bank credit is not loans plus bills) while the Provisional rows do, so bank credit and its parts are the Provisional figures on those dates.` : ""} Reporting dates were alternate Fridays until November 2025; from 15 December 2025 they are the 15th and the last day of each month (Banking Laws (Amendment) Act 2025). The "excluding the HDFC merger" series are RBI's adjusted figures, published from 14 July 2023 to 22 August 2025. Investments by instrument (the non-SLR rows) end at July 2026 in the source.`,
    reportingCalendarChange: "2025-12-15",
  }), D42, s42, "Not reported for this date in DBIE report 689.");

  // derived: growth and ratios (pct), from the levels above
  const L = scb.series, DD = scb.dates;
  const growth = {
    credit_growth: { name: "credit_yoy_pct", label: "Bank credit, growth on a year earlier", color: "#2E4BD8", data: yoyByDate(DD, L.credit.data) },
    deposits_growth: { name: "deposits_yoy_pct", label: "Aggregate deposits, growth on a year earlier", color: "#C47A16", data: yoyByDate(DD, L.deposits.data) },
    // ex-merger growth: RBI's adjusted level over the raw level a year earlier while the year
    // ago predates the merger, then adjusted over adjusted
    credit_growth_ex_merger: { name: "credit_ex_merger_yoy_pct", label: "Bank credit, growth excluding the HDFC merger", data: yoyByDate(DD, DD.map((d, i) => L.credit_ex_merger.data[i] ?? (d < "2023-07-01" ? L.credit.data[i] : null))).map((v, i) => (L.credit_ex_merger.data[i] == null ? null : v)) },
    deposits_growth_ex_merger: { name: "deposits_ex_merger_yoy_pct", label: "Aggregate deposits, growth excluding the HDFC merger", data: yoyByDate(DD, DD.map((d, i) => L.deposits_ex_merger.data[i] ?? (d < "2023-07-01" ? L.deposits.data[i] : null))).map((v, i) => (L.deposits_ex_merger.data[i] == null ? null : v)) },
    credit_deposit_ratio: { name: "credit_deposit_ratio_pct", label: "Credit-deposit ratio: bank credit as a share of deposits", data: DD.map((_, i) => (L.credit.data[i] != null && L.deposits.data[i] ? r2((100 * L.credit.data[i]) / L.deposits.data[i]) : null)) },
    investment_deposit_ratio: { name: "investment_deposit_ratio_pct", label: "Investment-deposit ratio: SLR securities as a share of deposits", data: DD.map((_, i) => (L.slr_securities.data[i] != null && L.deposits.data[i] ? r2((100 * L.slr_securities.data[i]) / L.deposits.data[i]) : null)) },
    cash_deposit_ratio: { name: "cash_deposit_ratio_pct", label: "Cash-deposit ratio: cash and RBI balances as a share of deposits", data: DD.map((_, i) => { const c = L.cash_and_rbi_balances?.data[i] ?? ((L.cash_in_hand.data[i] ?? null) != null && L.balances_with_rbi.data[i] != null ? L.cash_in_hand.data[i] + L.balances_with_rbi.data[i] : null); return c != null && L.deposits.data[i] ? r2((100 * c) / L.deposits.data[i]) : null; }) },
  };
  bundleOut(root, "credit-scb-ratios", m42({ unit: "pct",
    coverage: "Growth of bank credit and deposits on a year earlier, with and without the HDFC merger, and the credit-deposit, investment-deposit and cash-deposit ratios, every fortnight",
    note: "Derived from credit-scb (RBI DBIE report 689). Growth compares each reporting date with the reporting date closest to one year earlier (within 10 days): 364 days earlier on the alternate-Friday calendar; from December 2025, the nearest old-calendar Friday, as RBI does. Ex-merger growth uses RBI's adjusted levels while RBI published them (July 2023 to August 2025). Ratios are computed from the levels.",
  }), DD, growth, "No reporting date within ten days of one year earlier, or a level missing.");

  // food credit (1130 DPd), and its share of bank credit on dates that match report 689
  const fpick = new Map();
  for (const r of rows1130) { const d = iso(r["Fortnight Date Prov"]), v = num(r["Item_Values"]), ver = r["Version Desc"]; const p = fpick.get(d); if (!p || (p.ver !== "Final" && ver === "Final")) fpick.set(d, { v, ver }); }
  const DF = [...fpick.keys()].sort();
  const creditAt = new Map(scb.dates.map((d, i) => [d, scb.series.credit.data[i]]));
  const food = DF.map((d) => r3(fpick.get(d).v / LC));
  bundleOut(root, "credit-food", { ...base, dossier: "credit-s42", vintage: V42, frequency: "fortnightly", base: "Section 42 return", unit: "inr_lakh_crore",
    coverage: "Food credit: bank loans to the Food Corporation of India and state agencies for buying and storing grain, every fortnight since 1993",
    note: "RBI DBIE report 1130 (data provider DPd, item 7a.1 Food Credit), ₹ lakh crore; Final where published, else Provisional. The share of bank credit is derived where the date matches a report-689 reporting date." },
  DF, {
    food_credit: { name: "food_credit_inr_lakh_crore", label: "Food credit", color: "#2E4BD8", data: food },
    food_share: { name: "food_credit_share_of_bank_credit_pct", label: "Food credit as a share of bank credit, per cent (derived)", unit: "pct", data: DF.map((d, i) => (creditAt.get(d) && food[i] != null ? r2((100 * food[i]) / creditAt.get(d)) : null)) },
  }, "Not reported for this fortnight in DBIE report 1130.");


  /* ---------- 2. sectoral deployment ---------- */
  const H = databankQuery(db, "rbi_credit_history",
    "select distinct statement, format_segment, category_code, category_label, observation_date, amount_inr_cr from {table} order by statement, format_segment, observation_date, category_code");
  if (H.rows.length < 15000) throw new Error(`credit: rbi_credit_history served ${H.rows.length} rows; expected the 2007-2026 export (>15,000)`);
  const histMax = {};
  for (const r of H.rows) if (r.format_segment === "new") histMax[r.statement] = r.observation_date > (histMax[r.statement] ?? "") ? r.observation_date : histMax[r.statement];
  const REL = databankQuery(db, "rbi_sectoral_credit",
    "select distinct statement, bank_universe, category_code, category_label, observation_date, amount_inr_cr, year_ago_date, year_ago_amount_inr_cr, growth_yoy_pct, release_date, release_prid from {table} order by statement, observation_date, category_code, release_prid, category_label, year_ago_date, bank_universe, amount_inr_cr, release_date");
  // RBI's printed comparison, per observation and category: the latest release's pair
  const relCode = (st, c) => (st === "industry" && c === "total" ? "2" : ROMAN[c] ?? c);
  const latestRel = new Map();     // "statement|date|code" -> the row of the highest release_prid
  const printedYoY = new Map();    // same key -> RBI's printed one-year comparison (latest release that printed one)
  const oneYear = (d, y) => Math.abs((t(d) - t(y)) / dayMs - 365) <= 20;
  for (const r of REL.rows) {
    // only the monthly press-release cycle from January 2024 is in the 2019 format; the
    // recovered 2019-2021 workbooks print the old classification under overlapping codes
    if (r.amount_inr_cr == null || r.release_date < "2024-01-01") continue;
    const k = `${r.statement}|${r.observation_date}|${relCode(r.statement, r.category_code)}`;
    const p = latestRel.get(k);
    if (!p || +r.release_prid > +p.release_prid) latestRel.set(k, r);
    // March releases also print two-year comparisons; only a one-year pair is a y/y comparison
    if (r.year_ago_amount_inr_cr != null && r.year_ago_date && oneYear(r.observation_date, r.year_ago_date)) {
      const q = printedYoY.get(k);
      if (!q || +r.release_prid > +q.release_prid) printedYoY.set(k, r);
    }
  }
  const VS = stamp("data/raw/credit-sectoral.json", {
    note: "Sectoral and industry-wise deployment of bank credit, as read from the local Data Bank: rbi_credit_history (the RBI's DBIE exports, April 2007 on, old and new formats) and rbi_sectoral_credit (the monthly press-release workbooks, with RBI's printed year-ago comparisons). Amounts in ₹ crore, as published.",
    rbi_credit_history: { provenance: H.provenance, columns: ["statement", "format_segment", "category_code", "category_label", "observation_date", "amount_inr_cr"], rows: H.rows.map((r) => [r.statement, r.format_segment, r.category_code, r.category_label, r.observation_date, r.amount_inr_cr]) },
    rbi_sectoral_credit: { provenance: REL.provenance, columns: ["statement", "bank_universe", "category_code", "category_label", "observation_date", "amount_inr_cr", "year_ago_date", "year_ago_amount_inr_cr", "growth_yoy_pct", "release_date", "release_prid"],
      rows: REL.rows.map((r) => [r.statement, r.bank_universe, r.category_code, r.category_label, r.observation_date, r.amount_inr_cr, r.year_ago_date, r.year_ago_amount_inr_cr, r.growth_yoy_pct, r.release_date, r.release_prid]) },
  });

  /** one statement in one format: { months, reportDates, byCode: Map(code -> Map(month -> crore)), labels } */
  const collect = (statement, fmt) => {
    const byCode = new Map(), labels = new Map(), rep = new Map();
    for (const r of H.rows) {
      if (r.statement !== statement || r.format_segment !== fmt || r.amount_inr_cr == null) continue;
      const m = monthKey(r.observation_date);
      // two reporting dates inside one month (old industry export, Mar and Oct 2018): the later one is the month's
      if (rep.has(m) && rep.get(m) > r.observation_date) continue;
      if (rep.has(m) && rep.get(m) < r.observation_date) for (const mp of byCode.values()) mp.delete(m);
      rep.set(m, r.observation_date);
      labels.set(r.category_code, r.category_label);
      (byCode.get(r.category_code) ?? byCode.set(r.category_code, new Map()).get(r.category_code)).set(m, r.amount_inr_cr);
    }
    // the new format continues past the export with the press-release workbooks
    if (fmt === "new") {
      for (const [k, r] of latestRel) {
        const [st, d, code] = k.split("|");
        if (st !== statement || d <= histMax[statement]) continue;
        const m = monthKey(d);
        if (!labels.has(code)) { console.warn(`credit: release row ${statement} ${code} "${r.category_label}" has no column in the export; skipped`); continue; }
        rep.set(m, d);
        byCode.get(code).set(m, r.amount_inr_cr);
      }
    }
    // Bank credit, food and non-food credit are Section 42 figures. On some dates the export
    // prints the next fortnight's (2021-06-18 carries 2021-07-02's bank credit). Wherever report
    // 689 has the same reporting date, bank credit is taken from it, food credit from report
    // 1130 and non-food credit as the difference; the dates that changed are disclosed.
    const fixed = [];
    if (statement === "sectors") {
      const s42at = new Map(scb.dates.map((d, i) => [d, scb.series.credit.data[i]]));
      const foodAt = new Map(DF.map((d, i) => [d, food[i]]));
      for (const m of [...rep.keys()]) {
        const d = rep.get(m), c = s42at.get(d), f = foodAt.get(d), h = byCode.get("I")?.get(m);
        if (c == null || f == null || h == null) continue;
        if (Math.abs(h / CR_LC / c - 1) >= 0.002) fixed.push(d);
        byCode.get("I").set(m, c * CR_LC); byCode.get("II").set(m, f * CR_LC); byCode.get("III").set(m, (c - f) * CR_LC);
      }
    }
    const months = [...rep.keys()].sort();
    return { months, reportDates: months.map((m) => rep.get(m)), byCode, labels, fixed };
  };
  // a continuous month axis between the first and last month (gaps disclosed on the series)
  const monthAxis = (months) => { const out = []; let [y, m] = months[0].slice(0, 7).split("-").map(Number); const last = months.at(-1); for (;;) { const k = `${y}-${String(m).padStart(2, "0")}-01`; if (k > last) break; out.push(k); m++; if (m > 12) { m = 1; y++; } } return out; };

  const sectoralBundle = (statement, fmt, map, rel, extra) => {
    const C = collect(statement, fmt);
    const axis = monthAxis(C.months);
    const repByMonth = new Map(C.months.map((m, i) => [m, C.reportDates[i]]));
    const keyMap = map ?? industryKeys([...C.labels].map(([code, label]) => ({ code, label })));
    const series = {};
    for (const [code, lbl] of C.labels) {
      const km = map ? map[code] : keyMap.get(code);
      if (!km) { console.warn(`credit: ${statement}/${fmt} code ${code} "${lbl}" not mapped; skipped`); continue; }
      if (map && !labelOk(code, lbl, km[1])) throw new Error(`credit: ${statement}/${fmt} code ${code} is "${lbl}" in the source, expected "${km[1]}": the classification moved`);
      const mp = C.byCode.get(code);
      series[km[0]] = { name: `${km[0]}_inr_lakh_crore`, label: km[1], code, data: axis.map((m) => (mp.has(m) ? r3(mp.get(m) / CR_LC) : null)) };
    }
    const ex = extra(axis);
    if (statement === "sectors") ex.note += ` Bank, food and non-food credit are the Section 42 figures of the same reporting date (DBIE reports 689 and 1130) wherever those reports carry it${C.fixed.length ? `; on ${C.fixed.join(", ")} the export printed a different fortnight's figures` : ""}.`;
    const out = bundleOut(root, rel, { ...base, dossier: "credit-sibc", vintage: VS, frequency: "monthly", unit: "inr_lakh_crore", reportingDates: axis.map((m) => repByMonth.get(m) ?? null), ...ex }, axis, series,
      "No figure for this month in the RBI's export (the industry statement skips some months in its old format).");
    out.reportDates = out.dates.map((m) => repByMonth.get(m) ?? null);
    out.fixed = C.fixed;
    return out;
  };
  const SIBC_NOTE = "Bank credit, food credit and non-food credit cover all scheduled commercial banks (Section 42 return); every sector and industry row covers the selected banks of the sector-wise and industry-wise return (SIBC)";
  const oldS = sectoralBundle("sectors", "old", SECTORS_OLD, "credit-sectors-2007", () => ({ base: "SIBC 2007 format",
    coverage: "Bank credit by sector, old classification: agriculture, industry by size, services, personal loans by type, priority sector, monthly April 2007 to December 2020",
    note: `RBI, Deployment of Bank Credit by Major Sectors, old format (DBIE export via the Data Bank), ₹ lakh crore, last reporting Friday of each month. ${SIBC_NOTE}, about 90% of non-food credit from September 2017. Priority sector follows the definition before April 2015. A ₹17,300 crore drop in consumer durables in August 2018 corrects one bank's misclassified housing loans. Never joined to the 2019 format.` }));
  const newS = sectoralBundle("sectors", "new", SECTORS_NEW, "credit-sectors", () => ({ base: "SIBC 2019 format",
    coverage: "Bank credit by sector, current classification: agriculture, industry by size, services and NBFCs, personal loans by type (housing, vehicles, cards, gold, education), priority sector, monthly since January 2019",
    note: `RBI, Deployment of Bank Credit by Major Sectors, new format, ₹ lakh crore: the DBIE export to ${histMax.sectors}, then the monthly press-release workbooks. ${SIBC_NOTE}, about 95% of non-food credit. Each month is its last reporting fortnight; from December 2025 the last day of the month (Banking Laws (Amendment) Act 2025). From July 2023 the figures include HDFC Ltd's loans, merged into HDFC Bank: housing loans jump and loans to NBFCs drop that month. Since May 2024 one bank reclassifies a category of agricultural loans as loans against gold jewellery. Not merger-adjusted.` }));
  sectoralBundle("industry", "old", null, "credit-industry-2007", () => ({ base: "SIBC 2007 format",
    coverage: "Bank credit to industry by industry, old classification, monthly April 2007 to December 2018, with months missing from the RBI's export",
    note: "RBI, Industry-wise Deployment of Bank Credit (RBIB Table 16), old format, ₹ lakh crore, selected banks. The total for all industries is printed only for a few months in this export; the industry rows are complete for the months shown. Never joined to the 2019 format." }));
  const newI = sectoralBundle("industry", "new", null, "credit-industry", () => ({ base: "SIBC 2019 format",
    coverage: "Bank credit to industry by industry: mining, food processing, textiles, chemicals, metals, engineering, vehicles, construction, infrastructure (power, roads, telecom, ports, airports, railways) and more, monthly since January 2019",
    note: `RBI, Industry-wise Deployment of Bank Credit (RBIB Table 16), new format, ₹ lakh crore, selected banks (about 95% of non-food credit): the DBIE export to ${histMax.industry}, then the press-release workbooks.` }));

  /* ---------- 2a. RBI's sectoral series excluding mergers (DBIE 539) ---------- */
  // Report 539 carries, beside each big aggregate, RBI's own figure "(Excluding Merger)" (codes
  // ending _1). They differ from the raw figures from January 2021 (an earlier amalgamation) and
  // again from July 2023 (HDFC Ltd into HDFC Bank), and stop after June 2025 (0 printed after:
  // not a value). Baked as published, beside the raw series, never joined to them.
  {
    const R539 = dbieProvider(db, "539", "DP0");
    const rows = R539.rows.filter((r) => r["Unit Description"] === "ACTUALS" && /_1$/.test(r["Item Code"]));
    stamp("data/raw/credit-sectors-ex-merger.json", { note: "RBI DBIE report 539 data provider DP0 (Deployment of Bank Credit by Major Sectors), the rows 'Excluding Merger' (item codes ending _1), ACTUALS unit only. Rupees.",
      provenance: R539.provenance, columns: ["Reporting Date", "Item Code", "Item Description", "Amount (Rs. Crore)"], rows: rows.map((r) => [iso(r["Reporting Date"]), r["Item Code"], r["Item Description"], r["Amount (Rs. Crore)"]]) });
    const KEYS = { "I_1": ["bank_credit", "Bank credit"], "III_1": ["non_food_credit", "Non-food credit"], "2_1": ["industry", "Industry"], "3_1": ["services", "Services"], "3.1_1": ["transport_operators", "Transport operators"],
      "3.8_1": ["commercial_real_estate", "Commercial real estate"], "4_1": ["personal_loans", "Personal loans"], "4.2_1": ["housing", "Housing loans"], "4.9_1": ["other_personal_loans", "Other personal loans"], "5.4_1": ["psl_housing", "Priority sector: housing"] };
    const v = new Map(), months = new Set();
    for (const r of rows) { const k = KEYS[r["Item Code"]]; if (!k) { console.warn(`credit: 539 ex-merger code ${r["Item Code"]} not mapped`); continue; } const x = num(r["Amount (Rs. Crore)"]); if (!x) continue; const m = monthKey(iso(r["Reporting Date"])); months.add(m); v.set(`${k[0]}|${m}`, x); }
    const axis = monthAxis([...months].sort());
    const series = Object.fromEntries(Object.values(KEYS).map(([k, l]) => [k, { name: `${k}_ex_merger_inr_lakh_crore`, label: `${l}, excluding mergers (RBI)`, data: axis.map((m) => (v.has(`${k}|${m}`) ? r3(v.get(`${k}|${m}`) / LC) : null)) }]));
    bundleOut(root, "credit-sectors-ex-merger", { ...base, dossier: "credit-sibc", vintage: VS, frequency: "monthly", unit: "inr_lakh_crore", base: "SIBC 2019 format",
      coverage: "Bank credit by sector excluding the effect of bank mergers, as the RBI publishes it beside the raw figures, January 2019 to June 2025",
      note: "RBI DBIE report 539, the 'Excluding Merger' rows, ₹ lakh crore, the month's last reporting Friday. They differ from the raw figures (credit-sectors) from January 2021 to April 2022 for an earlier amalgamation, and from July 2023 for HDFC Ltd's merger into HDFC Bank; RBI stopped them after June 2025. Bank credit excluding mergers is printed only from February 2023. Never joined to the raw series." },
      axis, series, "Not printed for this month in report 539.");
  }

  /* ---------- 2b. growth on a year earlier, the guide's current bundle ---------- */
  // Each month's growth uses RBI's own printed year-ago figure where a press release printed
  // one (December 2022 on), else the same month a year earlier in the series. From December
  // 2025 RBI compares a month-end with the old-calendar last reporting Friday a year before.
  const growthBundle = (src, statement, codes) => {
    const comps = [];
    const series = {};
    for (const [key, s] of Object.entries(src.series)) {
      if (codes && !codes.includes(s.code)) continue;
      const data = src.dates.map((m, i) => {
        const v = s.data[i]; if (v == null) return null;
        const pr = printedYoY.get(`${statement}|${src.reportDates[i]}|${s.code}`);
        if (pr?.year_ago_amount_inr_cr && Math.abs(pr.amount_inr_cr / CR_LC / v - 1) < 0.002) { if (key === "bank_credit") comps.push([src.reportDates[i], pr.year_ago_date]); return r2((100 * (pr.amount_inr_cr / pr.year_ago_amount_inr_cr - 1))); }
        const j = src.dates.indexOf(`${+m.slice(0, 4) - 1}${m.slice(4)}`);
        const y = j >= 0 ? s.data[j] : null;
        return y ? r2(100 * (v / y - 1)) : null;
      });
      series[key === "bank_credit" ? "headline" : key] = { name: `${key}_yoy_pct`, label: `${s.label}, growth on a year earlier`, data };
    }
    return { series, comps };
  };
  const GS = growthBundle(newS, "sectors", Object.keys(SECTORS_NEW).filter((c) => !c.startsWith("5.")));
  GS.series.headline.color = "#2E4BD8";
  const cur = bundleOut(root, "credit-growth", { ...base, dossier: "credit-sibc", vintage: VS, frequency: "monthly", unit: "pct", base: "SIBC 2019 format",
    coverage: "Growth of bank credit on a year earlier, in total and for every sector and type of personal loan, monthly since January 2020",
    note: "Derived from credit-sectors. Where an RBI press release printed a year-ago figure for the month (December 2022 on), growth is the published amount over RBI's own printed year-ago amount, so it matches the release; earlier months compare with the same month a year before. The headline is bank credit of all scheduled commercial banks (Section 42). From December 2025 RBI compares month-end figures with the last reporting Friday a year earlier. July 2023 to June 2024 includes the HDFC merger's one-time jump; see credit-scb-ratios for growth excluding it.",
    yearAgoDates: Object.fromEntries(GS.comps),
  }, newS.dates, GS.series, "No year-earlier figure for this month.");
  void cur; void oldS; void newI;

  /* ======================================================================================
   * 3. Money: M3, M1, reserve money and their sources (DBIE Data Query tables)
   * ==================================================================================== */
  const MONEY_DSDS = ["MSC_F_RN", "MSS_F_RN", "BMC_M_RN", "MSS_M_RN", "RMC_M_RN", "RMS_M_RN", "RMC_W_RN", "RMS_W_RN", "MON_AG_RN", "MONTRY_RATIOS_RN", "CSURYCOM_F_RN", "CSURYSOR_F_RN", "RBI_ASSET_W_RN", "RBI_LIAB_W_RN"];
  const CAS = databankQuery(db, "rbi_dbie_cas_money",
    `select distinct dsd_code, series_key, series_label, frequency, unit_code, observation_date, value from {table} where dsd_code in (${MONEY_DSDS.map((d) => `'${d}'`).join(", ")}) order by dsd_code, series_key, observation_date`);
  if (CAS.rows.length < 50000) throw new Error(`credit: rbi_dbie_cas_money served ${CAS.rows.length} money rows; expected the 1952-2026 tables (>50,000)`);
  const VM = stamp("data/raw/credit-money.json", {
    note: "RBI DBIE Data Query (CAS) money tables, read from the local Data Bank (rbi_dbie_cas_money). Values in RBI 'actuals': rupees (INR), per cent (PT) or ratio (RO). Series codes ending _IM are RBI's figures including the July 2023 HDFC merger.",
    provenance: CAS.provenance, columns: ["dsd_code", "series_key", "series_label", "frequency", "unit_code", "observation_date", "value"],
    rows: CAS.rows.map((r) => [r.dsd_code, r.series_key, r.series_label, r.frequency, r.unit_code, r.observation_date, r.value]),
  });
  // one value per (dsd, series, date): the view repeats observations once per parse run
  const casSeries = new Map();   // dsd -> Map(seriesKey -> { label, unit, pts: Map(date -> value) })
  for (const r of CAS.rows) {
    const m = casSeries.get(r.dsd_code) ?? casSeries.set(r.dsd_code, new Map()).get(r.dsd_code);
    const s = m.get(r.series_key) ?? m.set(r.series_key, { label: r.series_label, unit: r.unit_code, pts: new Map() }).get(r.series_key);
    const prev = s.pts.get(r.observation_date);
    if (prev != null && r.value != null && Math.abs(prev - r.value) > 1e-6 * Math.abs(prev)) throw new Error(`credit: ${r.dsd_code} ${r.series_key} ${r.observation_date} carries two values (${prev}, ${r.value})`);
    if (r.value != null) s.pts.set(r.observation_date, r.value);
  }
  const codeOf = (sk) => sk.split("|").map((p) => p.split("=")[1]).filter((c) => c && c !== "N_A" && !/^(INR|PT|RO|USD|IX)$/.test(c)).join("_").toLowerCase();
  const casLabel = (sk, l) => { const parts = l.split(" / ").map((x) => x.trim()).filter((x) => x && x !== "Not applicable"); const im = /_IM\b|_IM\|/.test(sk); return tidy(parts[0]).replace(/^Other' /, "Other ") + (parts.length > 1 && !im ? ` (${tidy(parts.slice(1).join(", "))})` : "") + (im ? ", including the HDFC merger" : ""); };
  /** One bundle from a set of CAS tables. alias: code -> [key, label]; dateFn maps observation dates. */
  const casBundle = (dsds, rel, extra, { alias = {}, unitDiv = LC, dateFn = (d) => d, keep = null, identity = null } = {}) => {
    const series = {}, dates = new Set();
    for (const dsd of dsds) for (const [sk, s] of casSeries.get(dsd) ?? []) {
      const code = codeOf(sk); if (keep && !keep.includes(code)) continue;
      const [key, label] = alias[code] ?? [code, casLabel(sk, s.label)];
      if (series[key]) throw new Error(`credit: ${rel} key ${key} appears twice`);
      const pts = new Map([...s.pts].map(([d, v]) => [dateFn(d), s.unit === "INR" ? v / unitDiv : v]));
      for (const d of pts.keys()) dates.add(d);
      series[key] = { name: key, label, code: sk, pts };
    }
    const D = [...dates].sort();
    for (const s of Object.values(series)) { s.data = D.map((d) => (s.pts.has(d) ? r3(s.pts.get(d)) : null)); delete s.pts; }
    // Source defect: once RBI stopped a series that excludes the HDFC merger (mid-2025), these
    // tables keep printing it as 0 while its "including the merger" twin carries the figure.
    // A 0 from July 2023 on, in a series that has such a twin, is not a value: dropped.
    let dropped = 0;
    const twinOf = (s) => Object.values(series).find((x) => x !== s && x.code.replace(/_IM\b/, "") !== x.code && x.code.replace(/_IM\b/, "").replace(/=N_A/g, "") !== "" && codeOf(x.code).replace(/_im$/, "") === codeOf(s.code));
    for (const s of Object.values(series)) {
      if (/_IM\b/.test(s.code) || !twinOf(s)) continue;
      s.data = s.data.map((v, i) => (v === 0 && D[i] >= "2023-07-01" ? (dropped++, null) : v));
    }
    if (dropped) extra = { ...extra, note: `${extra.note} ${dropped} zeros printed for discontinued series that exclude the merger (after June 2025) are dropped as not published.` };
    if (identity) identity(D, series);
    return bundleOut(root, rel, { ...base, dossier: "credit-money", vintage: VM, ...extra }, D, series, "Not published for this date in the RBI's Data Query table.");
  };
  const MERGER = "Series marked 'including the HDFC merger' are RBI's figures from July 2023 that count HDFC Ltd's balance sheet inside the banking system; the plain series exclude it until they stop (time deposits and M3 in June 2025). The two are different rulers and are never joined.";
  const money = casBundle(["MSC_F_RN", "MSS_F_RN"], "credit-money", { frequency: "fortnightly", base: "M3, RBI money stock", unit: "inr_lakh_crore",
    coverage: "Money supply (M3) every fortnight since 2001: currency with the public, demand and time deposits with banks, and where the money comes from (bank credit to government and to the commercial sector, foreign exchange assets)",
    note: `RBI DBIE Data Query tables MSC_F (money stock components) and MSS_F (sources), ₹ lakh crore. M1 is derived as currency with the public plus demand deposits plus other deposits with the RBI. ${MERGER}` },
    { alias: { cf1: ["currency_with_public", "Currency with the public"], cf15: ["demand_deposits", "Demand deposits with banks"], cf16: ["other_deposits_rbi", "Other deposits with the RBI"],
      cf4: ["time_deposits", "Time deposits with banks"], cf4_im: ["time_deposits_incl_merger", "Time deposits with banks, including the HDFC merger"],
      cf5: ["m3", "Broad money (M3)"], cf5_im: ["m3_incl_merger", "Broad money (M3), including the HDFC merger"],
      sf1: ["net_bank_credit_to_government", "Net bank credit to government"], sf1_im: ["net_bank_credit_to_government_incl_merger", "Net bank credit to government, including the HDFC merger"],
      sf11: ["rbi_credit_to_government", "Net RBI credit to government"], sf12: ["other_banks_credit_to_government", "Other banks' credit to government"], sf12_im: ["other_banks_credit_to_government_incl_merger", "Other banks' credit to government, including the HDFC merger"],
      sf2: ["credit_to_commercial_sector", "Bank credit to the commercial sector"], sf2_im: ["credit_to_commercial_sector_incl_merger", "Bank credit to the commercial sector, including the HDFC merger"],
      sf21: ["rbi_credit_to_commercial_sector", "RBI credit to the commercial sector"], sf22: ["other_banks_credit_to_commercial_sector", "Other banks' credit to the commercial sector"], sf22_im: ["other_banks_credit_to_commercial_sector_incl_merger", "Other banks' credit to the commercial sector, including the HDFC merger"],
      sf3: ["net_foreign_exchange_assets", "Net foreign exchange assets of the banking sector"], sf4: ["government_currency", "Government's currency liabilities to the public"],
      sf5: ["net_non_monetary_liabilities", "Banking sector's net non-monetary liabilities"], sf5_im: ["net_non_monetary_liabilities_incl_merger", "Banking sector's net non-monetary liabilities, including the HDFC merger"],
      sf51: ["rbi_net_non_monetary_liabilities", "RBI's net non-monetary liabilities"], sf52: ["other_net_non_monetary_liabilities", "Other net non-monetary liabilities"] } });
  // derived M1, beside its parts
  {
    const f = path.join(root, "data/series/credit-money.json"), b = JSON.parse(fs.readFileSync(f, "utf8"));
    const S = b.series;
    S.m1 = { name: "m1", label: "Narrow money (M1), derived: currency with the public, demand deposits and other deposits with the RBI",
      data: b.dates.map((_, i) => (S.currency_with_public.data[i] != null && S.demand_deposits.data[i] != null && S.other_deposits_rbi.data[i] != null ? r3(S.currency_with_public.data[i] + S.demand_deposits.data[i] + S.other_deposits_rbi.data[i]) : null)) };
    S.m1.unit = "inr_lakh_crore";
    disclose(b.dates, S.m1, "A component is missing for this date.");
    writeSeries(root, "data/series/credit-money.json", b);
    money.series.m1 = S.m1;
  }
  // growth of money, fortnightly, inside each ruler
  {
    const M = money.series, D = money.dates;
    const g = (k) => yoyByDate(D, M[k].data);
    bundleOut(root, "credit-money-growth", { ...base, dossier: "credit-money", vintage: VM, frequency: "fortnightly", base: "M3, RBI money stock", unit: "pct",
      coverage: "Growth of money on a year earlier, every fortnight since 2002: M3 (excluding and including the HDFC merger), M1, currency with the public, deposits, and bank credit to the commercial sector",
      note: `Derived from credit-money: each date against the reporting date closest to one year earlier (within 10 days). Growth is computed inside each ruler: the series excluding the merger against itself, the series including it against itself (from July 2024, when a year of it exists). ${MERGER}` },
    D, {
      m3: { name: "m3_yoy_pct", label: "Broad money (M3), growth on a year earlier", color: "#2E4BD8", data: g("m3") },
      m3_incl_merger: { name: "m3_incl_merger_yoy_pct", label: "Broad money (M3) including the HDFC merger, growth on a year earlier", data: g("m3_incl_merger") },
      m1: { name: "m1_yoy_pct", label: "Narrow money (M1), growth on a year earlier", data: g("m1") },
      currency_with_public: { name: "currency_yoy_pct", label: "Currency with the public, growth on a year earlier", data: g("currency_with_public") },
      demand_deposits: { name: "demand_deposits_yoy_pct", label: "Demand deposits, growth on a year earlier", data: g("demand_deposits") },
      time_deposits: { name: "time_deposits_yoy_pct", label: "Time deposits, growth on a year earlier", data: g("time_deposits") },
      time_deposits_incl_merger: { name: "time_deposits_incl_merger_yoy_pct", label: "Time deposits including the HDFC merger, growth on a year earlier", data: g("time_deposits_incl_merger") },
      credit_to_commercial_sector: { name: "credit_to_commercial_sector_yoy_pct", label: "Bank credit to the commercial sector, growth on a year earlier", data: g("credit_to_commercial_sector") },
      credit_to_commercial_sector_incl_merger: { name: "credit_to_commercial_sector_incl_merger_yoy_pct", label: "Bank credit to the commercial sector including the HDFC merger, growth on a year earlier", data: g("credit_to_commercial_sector_incl_merger") },
      currency_share_m3: { name: "currency_share_of_m3_pct", label: "Currency with the public as a share of M3", data: D.map((_, i) => { const m3 = M.m3.data[i] ?? M.m3_incl_merger.data[i]; return M.currency_with_public.data[i] != null && m3 ? r2((100 * M.currency_with_public.data[i]) / m3) : null; }) },
    }, "No reporting date within ten days of one year earlier, or a level missing.");
  }
  const monthEnd = (d) => monthKey(d);
  casBundle(["BMC_M_RN", "MSS_M_RN"], "credit-money-monthly", { frequency: "monthly", base: "M3, RBI money stock", unit: "inr_lakh_crore",
    coverage: "Money supply month by month since 1991: M3 and M1, their components, and their sources",
    note: `RBI DBIE Data Query tables BMC_M (broad money components, monthly) and MSS_M (sources of money stock, monthly), ₹ lakh crore, last reporting Friday of each month (dated to the month). ${MERGER}` },
    { dateFn: monthEnd, identity: (D, S) => {
      // Source defect: after time deposits excluding the merger stop (June 2025), the table's
      // broad money keeps printing, equal to narrow money alone. M3 = M1 + time deposits, so M3
      // is kept only where its time deposits are published.
      let n = 0; S.m3.data = S.m3.data.map((v, i) => (v != null && S.time_deposits.data[i] == null ? (n++, null) : v));
      if (n) S.m3.gapsNote = `Dropped ${n} months after June 2025 where the source prints M3 equal to M1 (its time deposits discontinued).`;
    }, alias: { cms1: ["m3", "Broad money (M3)"], cms11: ["m1", "Narrow money (M1)"], cms1101: ["currency_with_public", "Currency with the public"], cms1102: ["other_deposits_rbi", "Other deposits with the RBI"],
      cms1103: ["demand_deposits", "Demand deposits"], cms1104: ["cash_with_banks", "Cash with banks"], cms12: ["time_deposits", "Time deposits"], cms12_im: ["time_deposits_incl_merger", "Time deposits, including the HDFC merger"], cms1_im: ["m3_incl_merger", "Broad money (M3), including the HDFC merger"] } });
  casBundle(["RMC_M_RN", "RMS_M_RN"], "credit-reserve-money", { frequency: "monthly", base: "Reserve money (M0)", unit: "inr_lakh_crore",
    coverage: "Reserve money (M0), the RBI's own money, month by month since 1991: currency in circulation, banks' deposits with the RBI, and its sources",
    note: "RBI DBIE Data Query tables RMC_M (reserve money components, monthly, from 1991) and RMS_M (sources, monthly, from 2001), ₹ lakh crore, dated to the month." },
    { dateFn: monthEnd, alias: { com1: ["reserve_money", "Reserve money (M0)"], com11: ["currency_in_circulation", "Currency in circulation"], com12: ["other_deposits_rbi", "Other deposits with the RBI"], com13: ["bankers_deposits_rbi", "Bankers' deposits with the RBI"],
      sor1: ["rbi_claims_government", "RBI's net claims on government"], sor2: ["rbi_claims_central_government", "RBI's claims on the central government"], sor3: ["rbi_claims_banks_commercial", "RBI's claims on banks and the commercial sector"],
      sor4: ["rbi_claims_banks", "RBI's claims on banks, including NABARD"], sor5: ["rbi_claims_commercial", "RBI's claims on the commercial sector, excluding NABARD"], sor6: ["rbi_net_foreign_assets", "Net foreign exchange assets of the RBI"],
      sor7: ["government_currency", "Government's currency liabilities to the public"], sor8: ["rbi_net_non_monetary_liabilities", "Net non-monetary liabilities of the RBI"] } });
  casBundle(["RMC_W_RN", "RMS_W_RN"], "credit-reserve-money-weekly", { frequency: "weekly", base: "Reserve money (M0)", unit: "inr_lakh_crore",
    coverage: "Reserve money (M0) and its sources every week, July 2001 to December 2025",
    note: "RBI DBIE Data Query tables RMC_W and RMS_W (weekly), ₹ lakh crore. The weekly table ends in December 2025 in the source; the monthly table continues." });
  casBundle(["CSURYCOM_F_RN", "CSURYSOR_F_RN"], "credit-bank-survey", { frequency: "fortnightly", base: "Commercial bank survey", unit: "inr_lakh_crore",
    coverage: "The commercial bank survey every fortnight since 1999: banks' deposits by maturity and their credit to government and the commercial sector, foreign assets and reserves",
    note: `RBI DBIE Data Query tables CSURYCOM_F (components) and CSURYSOR_F (sources), ₹ lakh crore. ${MERGER}` });
  casBundle(["RBI_ASSET_W_RN", "RBI_LIAB_W_RN"], "credit-rbi-balance-sheet", { frequency: "weekly", base: "RBI weekly statement of affairs", unit: "inr_lakh_crore",
    coverage: "The Reserve Bank's own balance sheet every week since July 2004: notes issued, deposits held, foreign assets, loans and investments",
    note: "RBI DBIE Data Query tables RBI_ASSET_W and RBI_LIAB_W (weekly statement of affairs), ₹ lakh crore." });
  const yearEnd = (d) => `${d.slice(0, 4)}-03-01`;
  casBundle(["MON_AG_RN"], "credit-money-annual", { frequency: "annual", base: "RBI monetary aggregates, annual", unit: "pct",
    coverage: "Annual growth of money and its sources, as published by the RBI, every financial year since 1970-71",
    note: "RBI DBIE Data Query table MON_AG (monetary aggregates: variations, per cent), as published, financial years ending March, dated to March." },
    { unitDiv: 1, dateFn: yearEnd, alias: { brd_mon: ["m3", "Broad money (M3), growth"], nar_mon: ["m1", "Narrow money (M1), growth"], res_mon: ["reserve_money", "Reserve money (M0), growth"], cur_pub: ["currency_with_public", "Currency with the public, growth"],
      dd: ["demand_deposits", "Demand deposits, growth"], tim_de: ["time_deposits", "Time deposits, growth"], net_rbi_ccg: ["net_rbi_credit_central_government", "Net RBI credit to the central government, growth"],
      nfeabs: ["net_foreign_exchange_assets", "Net foreign exchange assets of the banking sector, growth"], oth_bnk_ccs: ["other_banks_credit_commercial", "Other banks' credit to the commercial sector, growth"],
      oth_bnk_cg: ["other_banks_credit_government", "Other banks' credit to government, growth"], rbi_ccs: ["rbi_credit_commercial", "RBI credit to the commercial sector, growth"], rbi_net_cb: ["rbi_net_claims_banks", "RBI's net claims on banks, growth"] } });
  casBundle(["MONTRY_RATIOS_RN"], "credit-money-ratios", { frequency: "annual", base: "RBI monetary ratios, annual", unit: "ratio",
    coverage: "Monetary ratios every financial year since 1951-52: the money multiplier (M3 over reserve money), the income velocity of money (GDP over M3), and the currency-deposit ratio",
    note: "RBI DBIE Data Query table MONTRY_RATIOS, as published, financial years ending March, dated to March. GDP is at current market prices on the national accounts base RBI used for each year." },
    { unitDiv: 1, dateFn: yearEnd, alias: { ro1: ["currency_to_demand_deposits", "Currency with the public over demand deposits"], ro2: ["reserves_to_demand_deposits", "Bank reserves over demand deposits"],
      ro3: ["currency_to_deposits", "Currency with the public over aggregate deposits"], ro4: ["reserves_to_deposits", "Bank reserves over aggregate deposits"], ro5: ["m1_multiplier", "Narrow money over reserve money (M1 multiplier)"],
      ro6: ["m3_multiplier", "Broad money over reserve money (money multiplier)"], ro7: ["velocity_m3", "GDP over broad money (income velocity of M3)"], ro8: ["velocity_m1", "GDP over narrow money"], ro9: ["gdp_to_currency", "GDP over currency with the public"] } });

  /* ======================================================================================
   * 4. Banking health, annual, as on 31 March
   * ==================================================================================== */
  const R330 = dbieReport(db, "330"), R329 = dbieReport(db, "329"), R1114 = dbieReport(db, "1114"), R1508 = dbieReport(db, "1508"), R336 = dbieReport(db, "336"), R332 = dbieReport(db, "332");
  const one = (rows, col, val) => rows.filter((r) => r[col] === val);
  const rows330 = one(R330.rows, "Unit Description", "ACTUALS"), rows1114 = one(R1114.rows, "Unit Description", "ACTUALS"), rows336 = one(R336.rows, "Derived Unit Decs.Unit Description", "ACTUALS");
  if (rows330.length < 900 || rows1114.length < 10000 || rows336.length < 5000) throw new Error(`credit: banking-health reports served too little (330: ${rows330.length}, 1114: ${rows1114.length}, 336: ${rows336.length})`);
  const VH = stamp("data/raw/credit-health.json", {
    note: "Banking health tables from the RBI's DBIE (local Data Bank mirror): 330 gross and net NPAs by bank group; 329 banks by capital adequacy band; 1114 movement of NPAs, bank by bank; 1508 frauds by banking operation; 336 classification of loan assets, bank by bank; 332 select ratios of scheduled commercial banks. One display unit kept where DBIE repeats values per unit (the unit columns of 1114 and 336 are junk: SECONDS, LAKH TONNES; their values are rupees).",
    reports: {
      "330": { provenance: R330.provenance, filter: "Unit Description = ACTUALS", columns: ["Time Date", "Institution", "Items", "Value"], rows: rows330.map((r) => [iso(r["Time Date"]), r.Institution, r.Items, r.Value]) },
      "329": { provenance: R329.provenance, columns: ["Time Fis Year", "Bank Group Name", "Item Description", "No Of Banks"], rows: R329.rows.map((r) => [r["Time Fis Year"], r["Bank Group Name"], r["Item Description"], r["No Of Banks"]]) },
      "1114": { provenance: R1114.provenance, filter: "Unit Description = ACTUALS", columns: ["Time Cal Year", "Bank Name", "Bank Group Name", "Bal Sheet Hierarchy Level2", "Bal Sheet Description", "Version Desc", "Item Value"],
        rows: rows1114.map((r) => [r["Time Cal Year"], r["Bank Name"], r["Bank Group Name"], r["Bal Sheet Hierarchy Level2"], r["Bal Sheet Description"], r["Version Desc"], r["Item Value"]]) },
      "1508": { provenance: R1508.provenance, columns: ["Time Date", "Operation Description", "Na Description", "Version Desc", "Item Value", "Special Data Value"], rows: R1508.rows.map((r) => [iso(r["Time Date"]), r["Operation Description"], r["Na Description"], r["Version Desc"], r["Item Value"], r["Special Data Value"]]) },
      "336": { provenance: R336.provenance, filter: "Derived Unit Decs.Unit Description = ACTUALS", columns: ["Time Date", "Bank Name", "Bank Group Name", "Classification Name", "Amount"], rows: rows336.map((r) => [iso(r["Time Date"]), r["Bank Name"], r["Bank Group Name"], r["Classification Name"], r.Amount]) },
      "332": { provenance: R332.provenance, columns: ["Time Date", "Item Category", "Item Name", "Ratio"], rows: R332.rows.map((r) => [iso(r["Time Date"]), r["Item Category"], r["Item Name"], r.Ratio]) },
    },
  });
  const march = (d) => `${d.slice(0, 4)}-03-01`;
  const fyEnd = (fy) => `${+fy.slice(0, 4) + 1}-03-01`;     // "2024-25" -> "2025-03-01"
  const H_ = (extra) => ({ ...base, dossier: "credit-health", vintage: VH, frequency: "annual", ...extra });

  // ---- 330: NPAs by bank group ----
  {
    const GROUPS = [["Scheduled Commercial Banks", "all", "All scheduled commercial banks"], ["Public Sector Banks", "public", "Public sector banks"], ["Private Sector Banks", "private_pre2011", "Private sector banks"],
      ["Old Private Sector Banks", "private_old", "Old private sector banks"], ["New Private Sector Banks", "private_new", "New private sector banks"], ["Foreign Banks In India", "foreign", "Foreign banks"], ["Small Finance Banks", "small_finance", "Small finance banks"]];
    const ITEMS = { "NPA Gross As Percentage of Gross Advances": ["gnpa_ratio", "gross NPA ratio (gross NPAs as a share of gross advances)"], "NPA Net As Percentage of Net Advances": ["nnpa_ratio", "net NPA ratio (net NPAs as a share of net advances)"],
      "NPA Gross As Percentage of Total Assets": ["gnpa_to_assets", "gross NPAs as a share of total assets"], "NPA Net As Percentage of Total Assets": ["nnpa_to_assets", "net NPAs as a share of total assets"],
      "NPA Gross Amount": ["gnpa", "gross NPAs"], "NPA Net Amount": ["nnpa", "net NPAs"], "GROSS ADVANCES": ["gross_advances", "gross advances"], "NET ADVANCES": ["net_advances", "net advances"] };
    const v = new Map(); const years = new Set();
    for (const r of rows330) { const d = march(iso(r["Time Date"])); years.add(d); v.set(`${r.Institution}|${r.Items}|${d}`, num(r.Value)); }
    const Y = [...years].sort();
    // Source defect: before 2011 the "Private Sector Banks" row of the ratio items is the SUM of
    // the old and new private banks' ratios (13.3 = 10.7 + 2.6 in 1997), not a ratio. Dropped.
    // From March 2014 the source labels all private sector banks "New Private Sector Banks"
    // (their NPAs equal old plus new of the year before); the series is relabelled to say so.
    let droppedSum = 0;
    const ratios = {}, amounts = {};
    for (const [inst, gk, gl] of GROUPS) for (const [item, [ik, il]] of Object.entries(ITEMS)) {
      const isRatio = /ratio|share/.test(il);
      let data = Y.map((d) => v.get(`${inst}|${item}|${d}`) ?? null);
      if (gk === "private_pre2011" && isRatio) data = data.map((x, i) => { const o = v.get(`Old Private Sector Banks|${item}|${Y[i]}`), n = v.get(`New Private Sector Banks|${item}|${Y[i]}`); return x != null && o != null && n != null && Math.abs(x - (o + n)) < 0.01 ? (droppedSum++, null) : x; });
      if (data.every((x) => x == null)) continue;
      const label = gk === "private_new" ? `Private sector banks (new private banks to March 2013; all private banks from March 2014, as the source labels them)` : gl;
      if (isRatio) ratios[`${gk}_${ik}`] = { name: `${gk}_${ik}_pct`, label: `${label}, ${il}`, data: data.map(r2) };
      else amounts[`${gk}_${ik}`] = { name: `${gk}_${ik}_inr_lakh_crore`, label: `${label}, ${il}`, data: data.map((x) => (x == null ? null : r3(x / LC))) };
    }
    ratios.all_gnpa_ratio.color = "#2E4BD8";
    bundleOut(root, "credit-npa", H_({ base: "RBI bank groups, as on 31 March", unit: "pct",
      coverage: "Bad loans: gross and net non-performing assets as a share of advances and of assets, for all scheduled commercial banks and each bank group, every March since 1997",
      note: `RBI DBIE report 330 (Gross and Net NPAs of Scheduled Commercial Banks, bank group-wise), per cent, as published. Bank groups change: old and new private banks are reported apart until March 2013 and together from March 2014 (under the label "New Private Sector Banks"); small finance banks appear from March 2019. ${droppedSum} values of the pre-2011 "Private Sector Banks" row that are the sum of two ratios, not a ratio, are dropped.` }), Y, ratios, "Not reported for this bank group in this year.");
    bundleOut(root, "credit-npa-amounts", H_({ base: "RBI bank groups, as on 31 March", unit: "inr_lakh_crore",
      coverage: "Bad loans in rupees: gross and net NPAs and gross and net advances, all scheduled commercial banks and each bank group, every March since 1997",
      note: "RBI DBIE report 330, converted from rupees to ₹ lakh crore. Bank groups as in credit-npa." }), Y, amounts, "Not reported for this bank group in this year.");
  }

  // ---- 1114: movement of NPAs, summed over banks ----
  {
    const acc = new Map(); const years = new Set(); const groups = new Set();
    const pickV = new Map();   // bank|year|level|desc -> {v, ver}
    for (const r of rows1114) { const k = `${r["Bank Name"]}|${r["Time Cal Year"]}|${r["Bal Sheet Hierarchy Level2"]}|${r["Bal Sheet Description"]}`; const vv = num(r["Item Value"]), ver = r["Version Desc"]; const p = pickV.get(k); if (vv == null) continue; if (!p || (p.ver !== "Final" && ver === "Final")) pickV.set(k, { v: vv, ver, grp: r["Bank Group Name"] }); }
    const GRP = (g) => (/PUBLIC|NATIONALISED|STATE BANK/.test(g) ? "public" : /PRIVATE/.test(g) ? "private" : /FOREIGN/.test(g) ? "foreign" : /SMALL FINANCE/.test(g) ? "small_finance" : /PAYMENTS/.test(g) ? "payments" : "other");
    for (const [k, o] of pickV) {
      const [, y, lvl, desc] = k.split("|"); const d = `${y}-03-01`; years.add(d);
      const g = GRP(o.grp); groups.add(g);
      for (const gg of ["all", g]) { const kk = `${gg}|${lvl}|${desc}|${d}`; acc.set(kk, (acc.get(kk) ?? 0) + o.v); }
    }
    const Y = [...years].sort(), series = {};
    const DESCS = [["Opening Balance", "opening", "at the start of the year"], ["Addition during the Year", "additions", "added during the year (fresh slippages)"], ["Reduction during the Year", "reductions", "reduced during the year (recoveries and upgrades)"], ["Write-off during the Year", "write_offs", "written off during the year"], ["Closing Balance", "closing", "at the end of the year"]];
    const GL = { all: "All scheduled commercial banks", public: "Public sector banks", private: "Private sector banks", foreign: "Foreign banks", small_finance: "Small finance banks", payments: "Payments banks" };
    for (const g of ["all", "public", "private", "foreign", "small_finance"]) for (const [lvl, lk] of [["Gross NPAs", "gross"], ["Net NPAs", "net"]]) for (const [desc, dk, dl] of DESCS) {
      const data = Y.map((d) => { const x = acc.get(`${g}|${lvl}|${desc}|${d}`); return x == null ? null : r3(x / LC); });
      if (data.some((x) => x != null)) series[`${g}_${lk}_${dk}`] = { name: `${g}_${lk}_${dk}_inr_lakh_crore`, label: `${GL[g]}, ${lk} NPAs ${dl}`, data };
    }
    // bank by bank, as reported (the finest cut the table publishes)
    {
      const banks = new Map(); for (const [k, o] of pickV) { const b = k.split("|")[0]; if (!banks.has(b)) banks.set(b, o.grp); }
      const bs = {};
      for (const [b, g] of [...banks].sort()) for (const [lvl, lk] of [["Gross NPAs", "gross"], ["Net NPAs", "net"]]) for (const [desc, dk, dl] of DESCS) {
        const data = Y.map((d) => { const o = pickV.get(`${b}|${d.slice(0, 4)}|${lvl}|${desc}`); return o == null ? null : r3(o.v / 1e7); });
        if (data.some((x) => x != null && x !== 0)) bs[`${slug(b)}__${lk}_${dk}`] = { name: `${slug(b)}__${lk}_${dk}_inr_crore`, label: `${tidy(b).replace(/\b(LIMITED|LTD\.?)\b/gi, "").replace(/\s+/g, " ").trim()} (${tidy(g).toLowerCase()}): ${lk} NPAs ${dl}`, unit: "inr_crore", data };
      }
      bundleOut(root, "credit-npa-movement-banks", H_({ base: "RBI bank groups, as on 31 March", unit: "inr_crore",
        coverage: "Bad loans bank by bank: each scheduled commercial bank's gross and net NPAs at the start of the year, added, reduced, written off and at the end, every year since 2004-05",
        note: "RBI DBIE report 1114, every bank as reported, ₹ crore; Final where published. Banks that merged stop; new banks start late. The unit column of the report is unreliable; values are rupees." }), Y, bs, "This bank reported no figure this year.");
    }
    bundleOut(root, "credit-npa-movement", H_({ base: "RBI bank groups, as on 31 March", unit: "inr_lakh_crore",
      coverage: "How bad loans move each year: gross and net NPAs at the start, added, recovered or upgraded, written off, and at the end, all banks and by bank group, 2004-05 to 2024-25",
      note: "RBI DBIE report 1114 (Movement of NPAs of Scheduled Commercial Banks), bank by bank, summed here to all banks and to bank groups (public: nationalised banks, SBI and its associates; private: old, new and all private banks; small finance banks), ₹ lakh crore; Final where published. The report's unit column is unreliable (it lists SECONDS, LAKH TONNES and the like); values are rupees, which reconcile with report 330's bank-group NPAs." }), Y, series, "No bank of this group reported this item in this year.");
  }

  // ---- 329: banks by capital adequacy band ----
  {
    const v = new Map(), years = new Set(), bands = new Map();
    for (const r of R329.rows) { const d = fyEnd(r["Time Fis Year"]); years.add(d); v.set(`${r["Bank Group Name"]}|${r["Item Description"]}|${d}`, num(r["No Of Banks"])); bands.set(r["Item Description"], +r["Item Display Order"]); }
    const Y = [...years].sort(), series = {};
    const GK = { "ALL SCBS": "all", "PUBLIC SECTOR BANKS": "public", "NATIONALISED BANKS": "nationalised", "SBI AND ITS ASSOCIATES": "sbi_group", "STATE BANK OF INDIA AND ITS ASSOCIATES": "sbi_group", "OLD PRIVATE SECTOR BANKS": "private_old", "NEW PRIVATE SECTOR BANKS": "private_new", "FOREIGN BANKS": "foreign" };
    const GLB = { all: "All scheduled commercial banks", public: "Public sector banks", nationalised: "Nationalised banks", sbi_group: "SBI and its associates", private_old: "Old private sector banks", private_new: "New private sector banks", foreign: "Foreign banks" };
    for (const g of new Set(R329.rows.map((r) => r["Bank Group Name"]))) for (const [b] of [...bands].sort((a, c) => a[1] - c[1])) {
      const gk = GK[g]; if (!gk) { console.warn(`credit: 329 bank group "${g}" not mapped`); continue; }
      const key = `${gk}_${b.toLowerCase().replace(/ per cent/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
      const data = Y.map((d) => v.get(`${g}|${b}|${d}`) ?? null);
      if (data.every((x) => x == null)) continue;
      if (series[key]) { series[key].data = series[key].data.map((x, i) => x ?? data[i]); continue; }   // SBI group under two names in different years
      series[key] = { name: `${key}_banks`, label: `${GLB[gk]}: number of banks with capital adequacy ${b.toLowerCase().replace("per cent", "per cent of risk-weighted assets")}`, data };
    }
    // derived: banks below the 9% regulatory minimum (in force from 1999-2000), all banks
    const below4 = series.all_below_4?.data ?? [], b49 = series.all_between_4_9?.data ?? [], below9 = series.all_below_9?.data ?? [];
    if (!below4.length || !b49.length || !below9.length) throw new Error("credit: 329 lost a band (below 4, 4-9 or below 9 per cent)");
    series.all_below_minimum = { name: "all_below_9pct_banks", label: "All scheduled commercial banks: number below the 9% minimum (derived: below 4% plus 4 to 9% until 2006-07)", color: "#2E4BD8",
      data: Y.map((d, i) => (below9[i] != null ? below9[i] : d >= "2000-03-01" && below4[i] != null && b49[i] != null ? below4[i] + b49[i] : null)) };
    bundleOut(root, "credit-crar", H_({ base: "RBI bank groups, as on 31 March", unit: "count",
      coverage: "How many banks hold enough capital: banks counted by capital adequacy ratio band, all banks and by bank group, every March since 1996",
      note: "RBI DBIE report 329 (Distribution of Scheduled Commercial Banks by CRAR), number of banks, as published. The bands change over time (4/8/10 per cent to 1999; 4/9/10 to 2007; 9/10 per cent after), so each band is its own series. The count below the 9% minimum is derived for 2000 to 2007 by adding two published bands." }), Y, series, "This band was not used in this year.");
  }

  // ---- 1508: frauds by banking operation ----
  {
    const v = new Map(), years = new Set(), half = new Set(), ops = new Map();
    for (const r of R1508.rows) {
      const d = iso(r["Time Date"]); const x = num(r["Item Value"]); if (x == null) continue;
      const k = `${r["Operation Description"]}|${r["Na Description"]}|${d}`; const p = v.get(k);
      if (!p || (p.ver !== "Final" && r["Version Desc"] === "Final")) v.set(k, { x, ver: r["Version Desc"] });
      (d.slice(5, 7) === "03" ? years : half).add(d); ops.set(r["Operation Description"], +r["Operation Code"]);
    }
    const mk = (dates, dfn) => { const out = {}; for (const [op] of [...ops].sort((a, c) => a[1] - c[1])) for (const [na, nk, unitDiv, nl] of [["No.", "cases", 1, "number of cases"], ["Amount", "amount", 1e7, "amount involved, ₹ crore"]]) {
      const key = `${slug(op)}_${nk}`; const data = dates.map((d) => { const o = v.get(`${op}|${na}|${d}`); return o == null ? null : r2(o.x / unitDiv); });
      if (data.some((x) => x != null)) out[key] = { name: key, label: `${op === "Total" ? "All frauds" : tidy(op).replace(/,etc\.$/, ", etc.")}: ${nl}`, data }; } return out; };
    const YF = [...years].sort();
    bundleOut(root, "credit-frauds", H_({ base: "RBI, date of reporting", unit: "mixed: count and inr_crore",
      coverage: "Bank frauds by banking operation (loans, cards and internet, cash, deposits, cheques, foreign exchange, off-balance sheet), number of cases and amount, every financial year since 2004-05",
      note: "RBI DBIE report 1508 (Report on Trend and Progress: frauds in various banking operations, based on the date of reporting), scheduled commercial banks and select financial institutions as RBI reports them. Amount in ₹ crore, number in cases. A fraud is counted in the year it is reported, which can be years after it happened. Financial years dated to their March." }), YF.map((d) => `${d.slice(0, 4)}-03-01`), mk(YF), "Not reported for this operation in this year.");
    const YH = [...half].sort();
    if (YH.length) bundleOut(root, "credit-frauds-half-year", H_({ base: "RBI, date of reporting", frequency: "irregular", unit: "mixed: count and inr_crore",
      coverage: "Bank frauds in the first half of the financial year (April to September), by banking operation, provisional",
      note: "RBI DBIE report 1508, the April-September figures RBI prints beside the annual table; provisional, and not comparable with full years." }), YH, mk(YH), "Not reported.");
  }

  // ---- 336: classification of loan assets, bank by bank ----
  {
    const v = new Map(), years = new Set(), banks = new Map();
    for (const r of rows336) { const d = march(iso(r["Time Date"])); years.add(d); const x = num(r.Amount); if (x == null) continue; v.set(`${r["Bank Name"]}|${r["Classification Name"]}|${d}`, x); banks.set(r["Bank Name"], r["Bank Group Name"]); }
    const Y = [...years].sort();
    const CL = [["Standard Advances", "standard", "standard (performing) advances"], ["Sub-Standard Advances", "sub_standard", "sub-standard advances (NPA for up to a year)"], ["Doubtful Advances", "doubtful", "doubtful advances (NPA for more than a year)"], ["Loss Advances", "loss", "loss advances (identified as uncollectable)"], ["Gross NPAs", "gnpa", "gross NPAs"], ["Total Gross Advances (ALE)", "gross_advances", "gross advances"]];
    const tot = {};
    for (const [c, ck, cl] of CL) tot[ck] = { name: `${ck}_inr_lakh_crore`, label: `All scheduled commercial banks, ${cl} (sum of banks)`, data: Y.map((d) => { let s = 0, n = 0; for (const b of banks.keys()) { const x = v.get(`${b}|${c}|${d}`); if (x != null) { s += x; n++; } } return n ? r3(s / LC) : null; }) };
    bundleOut(root, "credit-loan-quality", H_({ base: "RBI asset classification, as on 31 March", unit: "inr_lakh_crore",
      coverage: "Every bank loan by its health: standard, sub-standard, doubtful and loss advances, summed over all scheduled commercial banks, every March since 2004",
      note: "RBI DBIE report 336 (Bank-wise and bank group-wise classification of loan assets), summed over every bank in the report, ₹ lakh crore. The report's unit column is unreliable; values are rupees." }), Y, tot, "No bank reported this item in this year.");
    const per = {};
    for (const [b, g] of [...banks].sort()) {
      const data = Y.map((d) => { const n = v.get(`${b}|Gross NPAs|${d}`), a = v.get(`${b}|Total Gross Advances (ALE)|${d}`); return n != null && a ? r2((100 * n) / a) : null; });
      if (data.every((x) => x == null)) continue;
      per[slug(b)] = { name: `${slug(b)}_gnpa_ratio_pct`, label: `${tidy(b).replace(/\b(LIMITED|LTD\.?)\b/gi, "").replace(/\s+/g, " ").trim()} (${tidy(g).toLowerCase()}), gross NPA ratio`, data };
    }
    const cls = {};
    for (const [b, g] of [...banks].sort()) for (const [c, ck, cl] of CL) {
      const data = Y.map((d) => { const x = v.get(`${b}|${c}|${d}`); return x == null ? null : r3(x / 1e7); });
      if (data.some((x) => x != null && x !== 0)) cls[`${slug(b)}__${ck}`] = { name: `${slug(b)}__${ck}_inr_crore`, label: `${tidy(b).replace(/\b(LIMITED|LTD\.?)\b/gi, "").replace(/\s+/g, " ").trim()} (${tidy(g).toLowerCase()}): ${cl}`, unit: "inr_crore", data };
    }
    bundleOut(root, "credit-loan-quality-banks", H_({ base: "RBI asset classification, as on 31 March", unit: "inr_crore",
      coverage: "Every bank's loans by their health: standard, sub-standard, doubtful and loss advances, gross NPAs and gross advances, bank by bank, every March since 2004",
      note: "RBI DBIE report 336, every bank as reported, ₹ crore. The asset classes are published to March 2013; gross NPAs and advances run on." }), Y, cls, "This bank reported no figure this year.");
    bundleOut(root, "credit-npa-banks", H_({ base: "RBI asset classification, as on 31 March", unit: "pct",
      coverage: "Gross NPA ratio of every scheduled commercial bank, bank by bank, every March since 2004",
      note: "RBI DBIE report 336: gross NPAs over gross advances, computed for each bank from the two published amounts. Banks that merged or closed stop; banks that opened start late." }), Y, per, "This bank reported no figure this year.");
  }

  // ---- 332: bank deposits and credit against GDP and deposits, since 1951 ----
  {
    const v = new Map(), years = new Set();
    for (const r of R332.rows) { const d = march(iso(r["Time Date"])); years.add(d); v.set(`${r["Item Category"]}|${r["Item Name"]}|${d}`, num(r.Ratio)); }
    const Y = [...years].sort(), series = {};
    for (const cat of [...new Set(R332.rows.map((r) => r["Item Category"]))]) for (const nm of ["As per cent to GDP", "As per cent to Aggregate Deposits"]) {
      const data = Y.map((d) => v.get(`${cat}|${nm}|${d}`) ?? null);
      // a 0 where the source has no figure (total investments before 1970s) is not a value
      const clean = data.map((x) => (x === 0 ? null : x));
      if (clean.every((x) => x == null) || (cat === "Aggregate Deposits" && nm === "As per cent to Aggregate Deposits")) continue;
      const key = `${slug(cat)}_${nm.includes("GDP") ? "to_gdp" : "to_deposits"}`;
      series[key] = { name: `${key}_pct`, label: `${tidy(cat).replace("Excluding Merger", "excluding the HDFC merger")}, ${nm.replace("As per cent to", "as a share of").replace("Aggregate Deposits", "deposits")}`, data: clean.map(r2) };
    }
    if (series.credit_to_gdp) series.credit_to_gdp.color = "#2E4BD8";
    bundleOut(root, "credit-depth", H_({ base: "RBI select ratios, financial year", unit: "pct",
      coverage: "How deep banking runs: scheduled commercial banks' deposits, credit and investments as a share of GDP and of deposits, every year since 1950-51",
      note: "RBI DBIE report 332 (Scheduled Commercial Banks: Ratios), per cent, as published, financial years dated to March. GDP at current market prices on the national accounts base RBI used. The rows excluding the HDFC merger are RBI's own. A 0 printed where the source has no figure is dropped." }), Y, series, "Not published for this year.");
  }

  /* ======================================================================================
   * 5. Credit by place: the spatial statements (BSR-7) and BSR-1 sanction vs utilisation
   * ==================================================================================== */
  const SP = { "1483": dbieReport(db, "1483"), "1465": dbieReport(db, "1465"), "1415": dbieReport(db, "1415"), "1427": dbieProvider(db, "1427", "DP1") };
  const S1134 = dbieProvider(db, "1134", "DP5");
  const VP = stamp("data/raw/credit-place.json", {
    note: "Deposits and credit of scheduled commercial banks by state, bank group and population group, from the RBI's quarterly and annual spatial statements (statement 3A; DBIE reports 1483: Mar 2004 to Mar 2017, 1465: Jun 2017 to Dec 2022, 1415: Mar 2023 on, excluding RRBs; 1427: annual, including RRBs), and BSR-1 table 1.3, credit by place of sanction and of utilisation (DBIE 1134). Measures: 1 reporting offices, 2 deposits, 3 credit (rupees); 1134: 1 credit sanctioned in the state, 2 of which used in the state, 3 used in other states, 4 sanctioned elsewhere and used here, 5 credit used in the state.",
    reports: { ...Object.fromEntries(Object.entries(SP).map(([id, r]) => [id, { provenance: r.provenance, columns: r.header, rows: r.rows.map((x) => r.header.map((h) => x[h])) }])),
      "1134": { provenance: S1134.provenance, columns: S1134.header, rows: S1134.rows.map((x) => S1134.header.map((h) => x[h])) } },
  });
  const P_ = (extra) => ({ ...base, dossier: "credit-place", vintage: VP, ...extra });
  const spatial = (ids, suffix, cover, notePart) => {
    // state x date -> [offices, deposits, credit]; also population group and bank group totals
    const st = new Map(), pg = new Map(), bg = new Map(), dates = new Set(), flagOf = new Map();
    // where a quarter is printed under both census population classifications (2015-16), the
    // 2011 one is kept; state totals are the same under both (checked below)
    const rowsAll = ids.flatMap((id) => SP[id].rows);
    for (const r of rowsAll) { const d = fqDate(r["Fiscal Quarter"]); const f = r["Census Flag"]; if (!flagOf.has(d) || f > flagOf.get(d)) flagOf.set(d, f); }
    const chk = new Map();
    for (const r of rowsAll) {
      const d = fqDate(r["Fiscal Quarter"]); const m = [num(r["Measure 1"]), num(r["Measure 2"]), num(r["Measure 3"])];
      const ck = `${d}|${r["Census Flag"]}`; const c = chk.get(ck) ?? [0, 0]; c[0] += m[1] ?? 0; c[1] += m[2] ?? 0; chk.set(ck, c);
      if (r["Census Flag"] !== flagOf.get(d)) continue;
      dates.add(d);
      for (const [map, k] of [[st, `${r["Dimension 5"]}|${d}`], [pg, `${r["Dimension 2"].replace("SEMI-URBAN", "SEMI URBAN")}|${d}`], [bg, `${r["Dimension 1"]}|${d}`], [st, `ALL INDIA|${d}`]]) {
        const o = map.get(k) ?? [0, 0, 0]; m.forEach((x, i) => (o[i] += x ?? 0)); map.set(k, o);
      }
    }
    for (const d of dates) { const a = chk.get(`${d}|2001`), b = chk.get(`${d}|2011`); if (a && b && (Math.abs(a[0] / b[0] - 1) > 1e-6 || Math.abs(a[1] / b[1] - 1) > 1e-6)) throw new Error(`credit: spatial ${ids} ${d}: totals differ between the 2001 and 2011 census classifications`); }
    const D = [...dates].sort();
    const states = [...new Set([...st.keys()].map((k) => k.split("|")[0]))].filter((x) => x !== "ALL INDIA").sort();
    const amt = {}, cd = {}, off = {};
    // A state that lost territory to a new state or union territory inside the bundle's span
    // (Andhra Pradesh to Telangana in 2014, Jammu and Kashmir to Ladakh in 2019) is a different
    // unit before and after: two series, never one (the states brief; AGENTS.md rule 1).
    const firstOf = (name) => D.find((d) => st.has(`${name}|${d}`));
    const segments = [];
    for (const name of ["ALL INDIA", ...states]) {
      const k = name === "ALL INDIA" ? "all_india" : slug(stateName(name)), L = name === "ALL INDIA" ? "All India" : stateName(name);
      const child = Object.entries(SPLITS).find(([, par]) => par === name)?.[0];
      const cut = child && states.includes(child) && firstOf(child) > D[0] ? firstOf(child) : null;
      if (!cut) { segments.push([name, k, L, () => true]); continue; }
      segments.push([name, k, `${L} (before ${stateName(child)} was separated)`, (d) => d < cut]);
      segments.push([name, `${k}_from_${cut.slice(0, 4)}`, `${L} (after ${stateName(child)} was separated)`, (d) => d >= cut]);
    }
    for (const [name, k, L, keep] of segments) {
      const o = (d) => (keep(d) ? st.get(`${name}|${d}`) : null);
      amt[`${k}_deposits`] = { name: `${k}_deposits_inr_lakh_crore`, label: `${L}, deposits`, data: D.map((d) => { const x = o(d); return x ? r3(x[1] / LC) : null; }) };
      amt[`${k}_credit`] = { name: `${k}_credit_inr_lakh_crore`, label: `${L}, credit`, data: D.map((d) => { const x = o(d); return x ? r3(x[2] / LC) : null; }) };
      cd[k] = { name: `${k}_cd_ratio_pct`, label: `${L}, credit-deposit ratio`, data: D.map((d) => { const x = o(d); return x && x[1] ? r2((100 * x[2]) / x[1]) : null; }) };
      off[k] = { name: `${k}_offices`, label: `${L}, bank offices reporting`, data: D.map((d) => o(d)?.[0] ?? null) };
    }
    if (cd.all_india) cd.all_india.color = "#2E4BD8";
    const PGN = { RURAL: "rural", "SEMI URBAN": "semi_urban", URBAN: "urban", METROPOLITAN: "metro" }, PGL = { rural: "Rural", semi_urban: "Semi-urban", urban: "Urban", metro: "Metropolitan" };
    // centres are classed rural to metropolitan by census population; when the RBI moved from
    // the 2001 to the 2011 census (2015-16) every centre could change class: two rulers
    const flags = [...new Set(D.map((d) => flagOf.get(d)))].sort();
    const groups = {};
    for (const f of flags) for (const [src, k] of Object.entries(PGN)) for (const [i, mk, ml] of [[1, "deposits", "deposits"], [2, "credit", "credit"]]) {
      const kk = flags.length > 1 ? `${k}_${mk}_census${f}` : `${k}_${mk}`;
      groups[kk] = { name: `${kk}_inr_lakh_crore`, label: `${PGL[k]} centres, ${ml}${flags.length > 1 ? ` (centres classed by the ${f} census)` : ""}`, data: D.map((d) => { const o = flagOf.get(d) === f ? pg.get(`${src}|${d}`) : null; return o ? r3(o[i] / LC) : null; }) };
    }
    for (const b of [...new Set([...bg.keys()].map((k) => k.split("|")[0]))].sort()) for (const [i, mk] of [[1, "deposits"], [2, "credit"]])
      groups[`${slug(b)}_${mk}`] = { name: `${slug(b)}_${mk}_inr_lakh_crore`, label: `${tidy(b).toLowerCase().replace(/^\w/, (c) => c.toUpperCase()).replace("Sbi", "SBI")}, ${mk}`, data: D.map((d) => { const o = bg.get(`${b}|${d}`); return o ? r3(o[i] / LC) : null; }) };
    const meta = (unit, what) => P_({ frequency: ids.includes("1427") ? "annual" : "quarterly", base: ids.includes("1427") ? `Spatial statements, annual, ${cover}` : `Spatial statements, ${cover}`, unit, coverage: `${what}, ${notePart}`,
      note: `RBI quarterly statistics on deposits and credit of scheduled commercial banks, statement 3A (DBIE ${ids.join(" and ")}), ${cover}. Summed over bank groups and population groups to each state; by the location of the branch that books the deposit or loan. Dated to the last month of each quarter.` });
    // the finest cut the statement publishes: state x bank group x population group
    {
      const fine = new Map(), names = new Map();
      for (const r of rowsAll) { if (r["Census Flag"] !== flagOf.get(fqDate(r["Fiscal Quarter"]))) continue; const pgk = r["Dimension 2"].replace("SEMI-URBAN", "SEMI URBAN");
        const k = `${slug(stateName(r["Dimension 5"]))}__${slug(r["Dimension 1"])}__${slug(pgk)}`; names.set(k, `${stateName(r["Dimension 5"])}, ${sentenceCase(tidy(r["Dimension 1"]))}, ${sentenceCase(pgk)} centres`);
        fine.set(`${k}|${fqDate(r["Fiscal Quarter"])}`, [num(r["Measure 1"]), num(r["Measure 2"]), num(r["Measure 3"])]); }
      const fs_ = {};
      for (const [k, l] of [...names].sort()) for (const [i, mk, u, dv] of [[0, "offices", "count", 1], [1, "deposits", "inr_crore", 1e7], [2, "credit", "inr_crore", 1e7]]) {
        const data = D.map((d) => { const o = fine.get(`${k}|${d}`); return o?.[i] == null ? null : r3(o[i] / dv); });
        if (data.some((x) => x != null && x !== 0)) fs_[`${k}__${mk}`] = { name: `${k}__${mk}_${u}`, unit: u, label: `${l}: ${mk === "offices" ? "bank offices reporting" : mk}`, data };
      }
      bundleOut(root, `credit-places-states${suffix}`, meta("mixed: count, inr_crore", "Deposits, credit and bank offices in every state, by bank group and by rural, semi-urban, urban and metropolitan centres"), D, fs_, "Not reported in this quarter.");
    }
    bundleOut(root, `credit-states${suffix}`, meta("inr_lakh_crore", "Bank deposits and credit in every state and union territory, ₹ lakh crore"), D, amt, "Not reported for this state in this quarter.");
    bundleOut(root, `credit-states-cd${suffix}`, meta("pct", "Credit-deposit ratio of every state and union territory: credit booked in the state as a share of deposits booked there"), D, cd, "Not reported for this state in this quarter.");
    bundleOut(root, `credit-offices${suffix}`, meta("count", "Bank offices reporting, in every state and union territory"), D, off, "Not reported for this state in this quarter.");
    bundleOut(root, `credit-places${suffix}`, meta("inr_lakh_crore", "Deposits and credit by population group (rural, semi-urban, urban, metropolitan centres) and by bank group, all India"), D, groups, "Not reported in this quarter.");
  };
  spatial(["1483"], "-2004", "including regional rural banks", "every quarter from March 2004 to March 2017");
  spatial(["1465"], "-2017", "including regional rural banks", "every quarter from June 2017 to December 2022");
  spatial(["1415"], "", "excluding regional rural banks", "every quarter since March 2023");
  spatial(["1427"], "-annual", "including regional rural banks", "every March since 2023");

  // ---- 1134: credit by place of sanction and of utilisation, March 2026 ----
  {
    const D = [...new Set(S1134.rows.map((r) => `${iso(r["Reporting Date"]).slice(0, 7)}-01`))].sort();
    if (D.length !== 1) console.warn(`credit: 1134 carries ${D.length} dates; the bundle keeps all`);
    const series = {};
    const add = (k, label, f) => { series[k] = { name: k, label, data: D.map((d) => f(d)) }; };
    const rowsBy = new Map(S1134.rows.filter((r) => r["Dimension 2"]).map((r) => [`${r["Dimension 2"]}|${iso(r["Reporting Date"]).slice(0, 7)}-01`, r]));
    const regions = new Map(S1134.rows.filter((r) => !r["Dimension 2"]).map((r) => [`${r["Dimension 1"]}|${iso(r["Reporting Date"]).slice(0, 7)}-01`, r]));
    const allInd = (d, m) => [...regions.entries()].filter(([k]) => k.endsWith(d)).reduce((a, [, r]) => a + num(r[m]), 0);
    add("all_india_sanctioned", "All India, credit by place of sanction", (d) => r3(allInd(d, "Measure 1") / LC));
    add("all_india_utilised", "All India, credit by place of utilisation", (d) => r3(allInd(d, "Measure 5") / LC));
    for (const name of [...new Set(S1134.rows.map((r) => r["Dimension 2"]).filter(Boolean))].sort()) {
      const k = slug(stateName(name)), L = stateName(name);
      const g = (m) => (d) => { const r = rowsBy.get(`${name}|${d}`); return r ? r3(num(r[m]) / LC) : null; };
      add(`${k}_sanctioned`, `${L}, credit sanctioned by branches in the state`, g("Measure 1"));
      add(`${k}_sanctioned_used_here`, `${L}, of which used in the state`, g("Measure 2"));
      add(`${k}_sanctioned_used_elsewhere`, `${L}, of which used in other states`, g("Measure 3"));
      add(`${k}_sanctioned_elsewhere_used_here`, `${L}, credit sanctioned in other states and used here`, g("Measure 4"));
      add(`${k}_utilised`, `${L}, credit used in the state (place of utilisation)`, g("Measure 5"));
    }
    bundleOut(root, "credit-utilisation", P_({ frequency: "annual", base: "BSR-1, as on 31 March", unit: "inr_lakh_crore",
      coverage: "Where loans are booked and where the money is used, state by state: credit by place of sanction and by place of utilisation, March 2026",
      note: "RBI BSR-1 table 1.3 (DBIE 1134): outstanding credit of scheduled commercial banks (including RRBs) by the state of the branch that sanctioned it and by the state where it is used, ₹ lakh crore. Credit used in a state = sanctioned and used there + sanctioned elsewhere and used there." }), D, series, "Not reported.");
  }

  /* ======================================================================================
   * 6. BSR-1, quarterly: who holds bank loans (occupation, organisation, gender), in what
   *    size, at what rate, where (population group, state, district), by bank group
   * ==================================================================================== */
  const B1 = { "941": "DP0", "942": "DP0", "943": "DP0", "944": "DP0", "945": "DP0", "946": "DP0", "947": "DP0", "948": "DP0", "949": "DP0", "963": "DP0", "1555": "DP0" };
  const BR = Object.fromEntries(Object.entries(B1).map(([id, dp]) => [id, dbieProvider(db, id, dp)]));
  const VB = stamp("data/raw/credit-bsr1.json", {
    note: "RBI Basic Statistical Return 1 (BSR-1), quarterly tables on outstanding credit of scheduled commercial banks (excluding RRBs), read from the local Data Bank's DBIE mirror: 941 population group, 942 bank group, 943 state, 944 occupation, 945 type of account, 946 organisation (incl. male and female individuals), 947 size of credit limit, 948 interest rate range, 949 weighted average lending rate by occupation, 963 state x occupation, 1555 district x gender (credit to individuals). Amounts in rupees.",
    reports: Object.fromEntries(Object.entries(BR).map(([id, r]) => [id, { provenance: r.provenance, columns: r.header, rows: r.rows.map((x) => r.header.map((h) => x[h])) }])),
  });
  const B_ = (extra) => ({ ...base, dossier: "credit-bsr1", vintage: VB, frequency: "quarterly", base: "BSR-1 quarterly, excluding RRBs", ...extra });
  const qEnd = (s) => `${iso(s).slice(0, 7)}-01`;
  const clean = (l) => tidy(String(l).replace(/^\s*(\(?[a-z0-9ivx]+[.)]\)?\s+)/i, "")).replace(/\s+/g, " ").trim();
  const sentence = (l) => (l === l.toUpperCase() ? l.toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : l);
  /** a quarterly "key" table: one series per key and measure (amount and limit in ₹ lakh crore,
   *  accounts in lakh, offices as counts) */
  const bsr1 = (id, rel, coverage, { key = (r) => r["Key Description 1"], date = (r) => qEnd(r["Time Date"]), measures = [["Amount Outstanding", "amount", "credit outstanding"], ["Credit Limit", "limit", "credit limits sanctioned"], ["No of Accounts", "accounts", "loan accounts, lakh"]], note = "" } = {}) => {
    const rows = BR[id].rows, dates = new Set(), keys = new Map(), v = new Map();
    for (const r of rows) {
      const k = key(r); if (!k) continue; const d = date(r); dates.add(d);
      if (!keys.has(k)) keys.set(k, +r["Sorting Order"] || keys.size);
      for (const [col] of measures) v.set(`${k}|${col}|${d}`, num(r[col]));
    }
    const D = quarterAxis(dates), series = {}, used = new Set();
    for (const [k] of [...keys].sort((a, b) => a[1] - b[1])) {
      let ks = slug(clean(k)) || slug(k); if (used.has(ks)) ks = `${ks}_${keys.get(k)}`; used.add(ks);
      for (const [col, suf, ml] of measures) {
        const div = suf === "accounts" ? 1e5 : suf === "offices" ? 1 : suf === "rate" ? 1 : LC;
        const data = D.map((d) => { const x = v.get(`${k}|${col}|${d}`); return x == null ? null : suf === "rate" ? r2(x) : r3(x / div); });
        if (data.some((x) => x != null)) series[`${ks}_${suf}`] = { name: `${ks}_${suf}`, label: `${sentence(clean(k))}, ${ml}`, data };
      }
    }
    return bundleOut(root, rel, B_({ unit: measures.length > 1 ? "mixed: inr_lakh_crore (amount, limit), lakh accounts" : measures[0][1] === "rate" ? "pct" : "inr_lakh_crore",
      coverage, note: `RBI BSR-1 quarterly (DBIE ${id}), outstanding credit of scheduled commercial banks excluding RRBs, as at the end of each quarter (dated to that month). Amounts and limits in ₹ lakh crore; accounts in lakh. ${note}`.trim() }), D, series, "Not published for this quarter: the RBI's table skips it (September 2014).");
  };
  bsr1("944", "credit-occupation", "Bank credit by the borrower's occupation, at every level the RBI publishes: agriculture, industries one by one, transport, professional services, personal loans by type, trade, finance, every quarter since March 2014");
  bsr1("941", "credit-population-group", "Bank credit by the population group of the branch: rural, semi-urban, urban, metropolitan, every quarter since March 2014", { key: (r) => r["Key Description 1"] });
  bsr1("943", "credit-states-bsr1", "Bank credit by state and union territory (place of sanction), every quarter since March 2014", { key: (r) => r["Key Description 2"], note: "States are as the RBI lists them in each quarter: Telangana from December 2014, Ladakh from December 2019, and Dadra and Nagar Haveli with Daman and Diu merged from March 2020. Andhra Pradesh and Jammu and Kashmir before those dates are larger units than after, so read their series across those quarters as two." });
  bsr1("942", "credit-bank-groups", "Bank credit by bank group: public sector, private sector, foreign, small finance banks, every quarter since June 2017", { key: (r) => r["Item Hierarchy_NewBG"], measures: [["Amount Outstanding", "amount", "credit outstanding"], ["Credit Limit", "limit", "credit limits sanctioned"], ["No of Accounts", "accounts", "loan accounts, lakh"], ["No of Offices", "offices", "offices reporting"]] });
  bsr1("945", "credit-account-type", "Bank credit by type of account: cash credit, overdraft, demand, medium and long-term loans, bills and packing credit, every quarter since March 2014");
  bsr1("946", "credit-organisation", "Bank credit by the kind of borrower: government, public and private companies, co-operatives, households (individuals, men and women), microfinance institutions, non-residents, every quarter since March 2014",
    { key: (r) => { const k = r["Key Description 1"]; return /^a\)\s+Male/.test(k.trim()) ? "Individuals, male" : /^b\)\s+Female/.test(k.trim()) ? "Individuals, female" : k; } });
  bsr1("947", "credit-size", "Bank credit by the size of the credit limit, from loans of ₹25,000 or less to loans above ₹100 crore, every quarter since March 2014");
  bsr1("948", "credit-interest-rates", "Bank loans by the interest rate they carry, in one-point bands from below 5% to 13% and above, every quarter since March 2021", { note: "Bands are the interest rate on each outstanding loan. Bills purchased and discounted carry no rate and are shown apart." });
  bsr1("949", "credit-lending-rates", "Weighted average lending rate on outstanding loans, by the borrower's occupation, every quarter since March 2014",
    { date: (r) => qEnd(r["Reporting Date"]), measures: [["Credit Limit", "rate", "weighted average lending rate, per cent"]], note: "The source names the rate column 'Credit Limit'; its values are interest rates in per cent (about 10%), which is what the table's title says they are." });
  // 963: state x occupation group, amount outstanding only
  {
    const rows = BR["963"].rows, dates = new Set(), v = new Map(), states = new Map(), occs = new Map();
    for (const r of rows) { const d = qEnd(r["Reporting Date"]); dates.add(d); states.set(r["Key3 Description 2"], +r["Sorting Order3"]); occs.set(r["Key4 Description 1"], +r["Sorting Order4"]); v.set(`${r["Key3 Description 2"]}|${r["Key4 Description 1"]}|${d}`, num(r["Set1 Total Amount Outstanding"])); v.set(`${r["Key3 Description 2"]}|${r["Key4 Description 1"]}|${d}|acc`, num(r["Set1 Number Of Account"])); v.set(`${r["Key3 Description 2"]}|${r["Key4 Description 1"]}|${d}|lim`, num(r["Set1 Total Credit Limit"])); }
    const D = quarterAxis(dates), series = {};
    for (const [st] of [...states].sort((a, b) => a[1] - b[1])) for (const [oc] of [...occs].sort((a, b) => a[1] - b[1])) {
      const data = D.map((d) => { const x = v.get(`${st}|${oc}|${d}`); return x == null ? null : r3(x / LC); });
      if (data.some((x) => x != null)) series[`${slug(st)}__${slug(clean(oc))}`] = { name: `${slug(st)}__${slug(clean(oc))}_inr_lakh_crore`, label: `${st.replace(/ & /g, " and ")}: ${sentence(clean(oc))}, credit outstanding`, data };
      const lim = D.map((d) => { const x = v.get(`${st}|${oc}|${d}|lim`); return x == null ? null : r3(x / LC); });
      if (lim.some((x) => x != null)) series[`${slug(st)}__${slug(clean(oc))}__limit`] = { name: `${slug(st)}__${slug(clean(oc))}__limit`, unit: "inr_lakh_crore", label: `${st.replace(/ & /g, " and ")}: ${sentence(clean(oc))}, credit limits sanctioned`, data: lim };
      const acc = D.map((d) => { const x = v.get(`${st}|${oc}|${d}|acc`); return x == null ? null : r3(x / 1e5); });
      if (acc.some((x) => x != null)) series[`${slug(st)}__${slug(clean(oc))}__accounts`] = { name: `${slug(st)}__${slug(clean(oc))}__accounts`, unit: "lakh_count", label: `${st.replace(/ & /g, " and ")}: ${sentence(clean(oc))}, loan accounts, lakh`, data: acc };
    }
    bundleOut(root, "credit-states-occupation", B_({ unit: "mixed: inr_lakh_crore, lakh accounts", coverage: "Bank credit in every state by the borrower's occupation group (agriculture, industry, transport, services, personal loans, trade, finance): amount, limits and accounts, every quarter since March 2014",
      note: "RBI BSR-1 quarterly table 3.6 (DBIE 963), amount outstanding and limits in ₹ lakh crore, accounts in lakh, by state of the sanctioning branch. States as listed by the RBI each quarter (see credit-states-bsr1)." }), D, series, "Not reported for this state in this quarter.");
  }
  // 1555: credit to individuals by gender, district rows summed to states and all India
  {
    const rows = BR["1555"].rows, dates = new Set(), acc = new Map();
    // the table's six measures: 1, 2 accounts and amount of men; 3, 4 of women; 5, 6 totals (5 = 1 + 3 and 6 = 2 + 4, checked)
    let bad = 0;
    for (const r of rows) {
      const d = qEnd(r["Period End Date"]); dates.add(d); const m = [1, 2, 3, 4, 5, 6].map((i) => num(r[`Measure_${i}`]) ?? 0);
      if (Math.abs(m[0] + m[2] - m[4]) > 1 || Math.abs(m[1] + m[3] - m[5]) > 1000) bad++;
      // the source prints an ALL INDIA row beside the district rows in some quarters: it is
      // read as its own figure, never added to the districts
      const st = r.Dimension_2 === "ALL INDIA" || r.Dimension_1 === "ALL INDIA" ? "ALL INDIA (printed)" : r.Dimension_2;
      for (const k of st === "ALL INDIA (printed)" ? [`${st}|${d}`] : [`${st}|${d}`, `ALL INDIA|${d}`]) { const o = acc.get(k) ?? [0, 0, 0, 0, 0, 0]; m.forEach((x, i) => (o[i] += x)); acc.set(k, o); }
    }
    // where the source prints an all-India row it must equal the sum of its districts
    for (const d of dates) { const a = acc.get(`ALL INDIA (printed)|${d}`), b = acc.get(`ALL INDIA|${d}`); if (a && b && Math.abs(a[5] / b[5] - 1) > 0.002) throw new Error(`credit: 1555 ${d}: printed all-India ${a[5]} != sum of districts ${b[5]}`); }
    if (bad > rows.length * 0.01) throw new Error(`credit: 1555 male + female != total on ${bad} rows: the measure layout moved`);
    // district by district, as the RBI names them each quarter (a district carved out appears as
    // a new series; its parent's series then covers less ground: read across such breaks with care)
    {
      const dv = new Map(), dn = new Map(), DQ = quarterAxis([...new Set(rows.map((r) => qEnd(r["Period End Date"])))]);
      for (const r of rows) { if (r.Dimension_2 === "ALL INDIA" || r.Dimension_1 === "ALL INDIA" || !r.Dimension_3) continue; const k = `${slug(stateName(r.Dimension_2))}__${slug(r.Dimension_3)}`; dn.set(k, `${stateName(r.Dimension_2)}: ${sentence(r.Dimension_3)}`); dv.set(`${k}|${qEnd(r["Period End Date"])}`, [1, 2, 3, 4, 5, 6].map((i) => num(r[`Measure_${i}`]) ?? 0)); }
      const ds = {};
      for (const [k, l] of [...dn].sort()) {
        const g = (f) => DQ.map((d) => { const o = dv.get(`${k}|${d}`); return o ? f(o) : null; });
        ds[`${k}__women_share`] = { name: `${k}__women_share_pct`, unit: "pct", label: `${l}, women's share of bank credit to individuals`, data: g((o) => (o[5] ? r2((100 * o[3]) / o[5]) : null)) };
        ds[`${k}__women_amount`] = { name: `${k}__women_amount_inr_crore`, unit: "inr_crore", label: `${l}, credit to women`, data: g((o) => r3(o[3] / 1e7)) };
        ds[`${k}__individuals_amount`] = { name: `${k}__individuals_amount_inr_crore`, unit: "inr_crore", label: `${l}, credit to all individuals`, data: g((o) => r3(o[5] / 1e7)) };
      }
      bundleOut(root, "credit-women-districts", B_({ unit: "mixed: pct, inr_crore",
        coverage: "Bank credit to women in every district: women's share of loans to individuals and the amounts, every quarter since March 2014",
        note: "RBI BSR-1 quarterly table 1.10 (DBIE 1555), district by district as the RBI names them each quarter, ₹ crore. A district carved out of another appears as a new series and its parent then covers less ground." }), DQ, ds, "Not reported for this district in this quarter.");
    }
    const D = quarterAxis(dates), series = {};
    const names = [...new Set([...acc.keys()].map((k) => k.split("|")[0]))].filter((x) => !x.startsWith("ALL INDIA")).sort();
    for (const st of ["ALL INDIA", ...names]) {
      const k = st === "ALL INDIA" ? "all_india" : slug(stateName(st)), L = st === "ALL INDIA" ? "All India" : stateName(st);
      const g = (f) => D.map((d) => { const o = acc.get(`${st}|${d}`); return o ? f(o) : null; });
      series[`${k}_women_share`] = { name: `${k}_women_share_of_amount_pct`, label: `${L}, women's share of bank credit to individuals`, data: g((o) => (o[5] ? r2((100 * o[3]) / o[5]) : null)) };
      series[`${k}_women_accounts_share`] = { name: `${k}_women_share_of_accounts_pct`, label: `${L}, women's share of individuals' loan accounts`, data: g((o) => (o[4] ? r2((100 * o[2]) / o[4]) : null)) };
      series[`${k}_women_amount`] = { name: `${k}_women_amount_inr_lakh_crore`, label: `${L}, credit to women, ₹ lakh crore`, data: g((o) => r3(o[3] / LC)) };
      series[`${k}_individuals_amount`] = { name: `${k}_individuals_amount_inr_lakh_crore`, label: `${L}, credit to all individuals, ₹ lakh crore`, data: g((o) => r3(o[5] / LC)) };
    }
    series.all_india_women_share.color = "#2E4BD8";
    bundleOut(root, "credit-women", B_({ unit: "mixed: pct (shares), inr_lakh_crore (amounts)",
      coverage: "Bank credit to women: women's share of bank loans to individuals, by amount and by number of accounts, in every state, every quarter since March 2014",
      note: "RBI BSR-1 quarterly table 1.10 (DBIE 1555), district-wise and gender-wise credit to individuals, summed here to states and all India. Measures 1-2 are men's accounts and amounts, 3-4 women's, 5-6 the totals (checked: men + women = total). Credit to individuals only; loans to firms, including those women own, are not counted here." }), D, series, "Not reported for this state in this quarter.");
  }

  /* ======================================================================================
   * 7. NBFCs' own credit (selected NBFCs and HFCs)
   * ==================================================================================== */
  {
    const N = databankQuery(db, "rbi_nbfc_credit", "select distinct observation_date, category_code, category_label, amount_inr_cr, year_ago_date, year_ago_amount_inr_cr, growth_yoy_pct, release_date, release_prid from {table} order by observation_date, category_code, release_prid, category_label, year_ago_date, amount_inr_cr");
    const VN = stamp("data/raw/credit-nbfc.json", { note: "Credit by selected NBFCs and HFCs, by sector, from the RBI's monthly sectoral-credit release, read from the local Data Bank (rbi_nbfc_credit). ₹ crore.", provenance: N.provenance,
      columns: ["observation_date", "category_code", "category_label", "amount_inr_cr", "year_ago_date", "year_ago_amount_inr_cr", "growth_yoy_pct", "release_date", "release_prid"], rows: N.rows.map((r) => [r.observation_date, r.category_code, r.category_label, r.amount_inr_cr, r.year_ago_date, r.year_ago_amount_inr_cr, r.growth_yoy_pct, r.release_date, r.release_prid]) });
    const latest = new Map();
    for (const r of N.rows) { if (r.amount_inr_cr == null) continue; const k = `${r.observation_date}|${r.category_code}`; const p = latest.get(k); if (!p || +r.release_prid > +p.release_prid) latest.set(k, r); }
    const months = [...new Set([...latest.keys()].map((k) => monthKey(k.split("|")[0])))].sort();
    const axis = (() => { const out = []; let [y, m] = months[0].split("-").map(Number); for (;;) { const k = `${y}-${String(m).padStart(2, "0")}-01`; if (k > months.at(-1)) break; out.push(k); m++; if (m > 12) { m = 1; y++; } } return out; })();
    const codes = new Map(N.rows.map((r) => [r.category_code, r.category_label]));
    const series = {};
    for (const [c, l] of [...codes].sort((a, b) => (a[0] === "total" ? -1 : b[0] === "total" ? 1 : a[0].localeCompare(b[0], undefined, { numeric: true })))) {
      const k = c === "total" ? "nbfc_credit" : slug(tidy(l).replace(/\*+$/, "").replace(/ of which$/i, ""));
      series[k] = { name: `${k}_inr_lakh_crore`, label: c === "total" ? "NBFC credit, all sectors" : `NBFC credit: ${tidy(l).replace(/\*+$/, "").replace(/ of which$/i, "")}`,
        data: axis.map((m) => { const r = [...latest.values()].find((x) => monthKey(x.observation_date) === m && x.category_code === c); return r ? r3(r.amount_inr_cr / CR_LC) : null; }) };
    }
    series.nbfc_credit.color = "#2E4BD8";
    bundleOut(root, "credit-nbfc", { ...base, dossier: "credit-nbfc", vintage: VN, frequency: "monthly", base: "Selected NBFCs and HFCs", unit: "inr_lakh_crore",
      coverage: "Credit given by non-banking finance companies (NBFCs and housing finance companies) by sector, for the months the RBI's release prints, from May 2024",
      note: "RBI, Sectoral Deployment of Credit by NBFCs (selected NBFCs and HFCs, in the monthly sectoral-credit release), ₹ lakh crore, latest release per month. The release prints the current month, the same month a year earlier and the previous March, so months between are not published: they are gaps, not zeros. Housing loans include those of HFCs." }, axis, series, "Not printed in any release: the RBI publishes the current month, a year earlier and March.");
  }

  /* ======================================================================================
   * 8. Every other table the RBI publishes on money, credit and banks (credit-deep.mjs):
   *    baked as published, one bundle per table; the raw archive is provenance only (the
   *    Data Bank's content-addressed copy, by sha256), since the tables run to millions of rows
   * ==================================================================================== */
  {
    const tables = [];
    for (const c of DEEP) tables.push(await bakeDeep(root, db, c, { ...base, dossier: "credit-deep", vintage }));
    stamp("data/raw/credit-deep.json", { note: "Provenance of every table baked by scripts/lib/products/credit-deep.mjs: DBIE report, data provider, rows read, and the sha256 of the Data Bank's stored copy. The bundles are baked from those copies as published.", tables });
  }

  return { db, base, stamp };
}

// CLI: node scripts/lib/products/credit.mjs --catalogue  (writes the coverage catalogue only)

/* Catalogue (docs/CONTRACT-coverage.md): what the RBI publishes on money, credit and banks.
 * From the Data Bank's DBIE report catalogue (rbi_dbie_report_catalog), every report in the
 * money, banking and BSR-1 menus, the Handbook's "Money and Banking" tables, the Bulletin's
 * "Money and Banking" section and the Weekly Statistical Supplement's money and bank tables;
 * and, from the parsed datasets this guide reads, every series they carry:
 *   dbie:<report>                                   one DBIE report (all its providers)
 *   sibc:<statement>:<old|new|release>:<code>       sectoral and industry credit categories
 *   cas:<dsd>:<series key>                          CAS money and reserve money series
 *   nbfc:<category>, position:<bank group>, growth:<universe>:<category>
 * Reports another family owns are left to its catalogue: 737 (deposits, BSR-2), 151 (policy
 * rates), 824 (payment systems). */
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
const CAT_MENUS = ["Banking - Sectoral Statistics", "Banking - Assets & Liabilities", "Banking - Performance Indicators", "Monetary Statistics", "Reserve Money", "Business of Scheduled Banks",
  "RBI Balance Sheet", "Non Banking Financial Companies", "Quarterly Spatial Distribution of Deposits and Credit", "Annual Spatial Distribution of Deposits and Credit - (Including Regional Rural Banks)",
  "Statistical Tables Relating to Banks in India", "Report on Trend and Progress of Banking in India"];
const CAT_IDS = ["6", "7", "9", "13", "39", "15", "20"], CAT_OTHERS = ["737", "151", "824"];
export const CAS_DSDS = ["MSC_F_RN", "MSS_F_RN", "MSS_M_RN", "MON_AG_RN", "MONTRY_RATIOS_RN", "BMC_M_RN", "CSURYCOM_F_RN", "CSURYSOR_F_RN", "RMC_M_RN", "RMC_W_RN", "RMS_M_RN", "RMS_W_RN", "RBI_ASSET_W_RN", "RBI_LIAB_W_RN"];
export async function catalogueCredit() {
  const { cfg } = sourceCfg("credit");
  const db = databankRoot(cfg?.families?.databank);
  const q = (ds, sql) => databankQuery(db, ds, sql).rows;
  const items = [];
  const reps = q("rbi_dbie_report_catalog", "SELECT DISTINCT report_id, report_name, menu, section, subsection FROM {table} ORDER BY report_id, menu, section, subsection");
  const seen = new Set();
  for (const r of reps) {
    const inMenu = CAT_MENUS.includes(r.menu) || /\(BSR\)-1/.test(r.menu) || (/^Handbook/.test(r.menu) && /money and banking/i.test(r.subsection ?? "")) || (r.menu === "Monthly RBI Bulletin" && /money and banking/i.test(r.section ?? "")) || CAT_IDS.includes(r.report_id);
    if (!inMenu || CAT_OTHERS.includes(r.report_id) || seen.has(r.report_id)) continue;
    seen.add(r.report_id);
    items.push({ id: `dbie:${r.report_id}`, label: `${String(r.report_name).trim()} (${r.menu})` });
  }
  for (const r of q("rbi_credit_history", "SELECT DISTINCT statement, format_segment, category_code, category_label FROM {table} ORDER BY statement, format_segment, category_code, category_label"))
    items.push({ id: `sibc:${r.statement}:${r.format_segment}:${idPart(r.category_code)}`, label: tidy(r.category_label) });
  for (const r of q("rbi_sectoral_credit", "SELECT DISTINCT statement, bank_universe, category_code, category_label FROM {table} ORDER BY statement, bank_universe, category_code, category_label"))
    items.push({ id: `sibc:${r.statement}:${r.bank_universe === "all_scb_section42" ? "section42" : "release"}:${idPart(r.category_code)}`, label: tidy(r.category_label) });
  for (const r of q("rbi_dbie_cas_money", `SELECT DISTINCT dsd_code, series_key, series_label FROM {table} WHERE dsd_code IN (${CAS_DSDS.map((d) => `'${d}'`).join(",")}) ORDER BY dsd_code, series_key, series_label`))
    items.push({ id: `cas:${idPart(r.dsd_code)}:${idPart(r.series_key)}`, label: r.series_label });
  for (const r of q("rbi_nbfc_credit", "SELECT DISTINCT category_code, category_label FROM {table} ORDER BY category_code, category_label")) items.push({ id: `nbfc:${idPart(r.category_code)}`, label: tidy(r.category_label) });
  for (const r of q("rbi_bank_position", "SELECT DISTINCT bank_group FROM {table} ORDER BY bank_group")) items.push({ id: `position:${idPart(r.bank_group)}`, label: `Section 42 position, ${r.bank_group}` });
  for (const r of q("rbi_credit_growth_summary", "SELECT DISTINCT bank_universe, category FROM {table} ORDER BY bank_universe, category")) items.push({ id: `growth:${idPart(r.bank_universe)}:${idPart(r.category)}`, label: `Printed credit growth, ${r.category}` });
  writeCatalogue("credit", { source: "Reserve Bank of India: DBIE money, banking and BSR-1 reports, and the parsed sectoral-credit, CAS money and NBFC datasets (via the local Data Bank)",
    generator: "scripts/lib/products/credit.mjs --catalogue",
    note: "DBIE reports from rbi_dbie_report_catalog: the money, banking, BSR-1, spatial, NBFC, Statistical Tables and Trend and Progress menus, the Handbook's and Bulletin's money and banking tables, and the Weekly Statistical Supplement's money and bank tables; 737, 151 and 824 belong to the deposits, rates and payments catalogues. Parsed datasets itemised by series.", items });
}
await catalogueCli(import.meta.url, catalogueCredit);
