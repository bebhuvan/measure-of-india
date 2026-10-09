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

/** Trim a bundle's axis to the dates some series reports, then write it. */
function bundleOut(root, rel, meta, dates, series, gapNote) {
  const any = (i) => Object.values(series).some((s) => s.data[i] != null);
  let a = 0, b = dates.length - 1;
  while (a <= b && !any(a)) a++;
  while (b >= a && !any(b)) b--;
  const D = dates.slice(a, b + 1);
  for (const s of Object.values(series)) { s.data = s.data.slice(a, b + 1); disclose(D, s, gapNote); }
  for (const [k, s] of Object.entries(series)) if (s.data.every((v) => v == null)) delete series[k];
  writeSeries(root, `data/series/${rel}.json`, { meta: { latestPeriod: D.at(-1), ...meta }, dates: D, series });
  return { dates: D, series };
}

// label tidying for display: RBI's ampersands, footnote digits and "of which" fragments
const tidy = (l) => String(l).replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, "").replace(/\s+\d$/, "").replace(/(\D)\d$/, "$1").replace(/\s*of which,?\s*$/i, "")
  .replace(/ & /g, " and ").replace(/&/g, " and ").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
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
  const pick = new Map();   // "date|group|code" -> { v, ver }
  for (const r of rows689) {
    const k = `${iso(r["Time Date"])}|${r["Bank Group Name"]}|${r["Item Code"]}`;
    const v = num(r["Item Value"]), ver = r["Version Desc"];
    const prev = pick.get(k);
    if (!prev || (prev.ver !== "Final" && ver === "Final") || (prev.v == null && v != null)) pick.set(k, { v, ver });
  }
  const D42 = [...new Set(rows689.map((r) => iso(r["Time Date"])))].sort();
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
  const m42 = (extra) => ({ ...base, vintage: V42, frequency: "fortnightly", base: "Section 42 return", unit: "inr_lakh_crore", ...extra });
  const scb = bundleOut(root, "credit-scb", m42({
    coverage: "Business of all scheduled commercial banks in India, every reporting fortnight since June 1997: deposits, credit, investments, cash and inter-bank positions",
    note: `RBI DBIE report 689 (Section 42 return), ₹ lakh crore. Final figures where RBI has published them (${finalShare} of ${D42.length} dates), provisional otherwise. Reporting dates were alternate Fridays until November 2025; from 15 December 2025 they are the 15th and the last day of each month (Banking Laws (Amendment) Act 2025). The "excluding the HDFC merger" series are RBI's adjusted figures, published from 14 July 2023 to 22 August 2025. Investments by instrument (the non-SLR rows) end at July 2026 in the source.`,
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
  bundleOut(root, "credit-food", { ...base, vintage: V42, frequency: "fortnightly", base: "Section 42 return", unit: "inr_lakh_crore",
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
    "select distinct statement, bank_universe, category_code, category_label, observation_date, amount_inr_cr, year_ago_date, year_ago_amount_inr_cr, growth_yoy_pct, release_date, release_prid from {table} order by statement, observation_date, category_code, release_prid, category_label, year_ago_date");
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
    // Bank credit, food and non-food credit are Section 42 figures: on a few dates the export
    // prints the next fortnight's figure (2023-10-20 carries 2023-11-03's). Where the export
    // disagrees with report 689 and the press release agrees with it, the press release wins.
    const fixed = [];
    if (statement === "sectors" && fmt === "new") {
      const s42at = new Map(scb.dates.map((d, i) => [d, scb.series.credit.data[i]]));
      for (const m of [...rep.keys()]) {
        const d = rep.get(m), ref = s42at.get(d), h = byCode.get("I")?.get(m);
        if (ref == null || h == null || Math.abs(h / CR_LC / ref - 1) < 0.002) continue;
        const rel = latestRel.get(`sectors|${d}|I`);
        if (!rel || Math.abs(rel.amount_inr_cr / CR_LC / ref - 1) >= 0.002) continue;
        for (const c of ["I", "II", "III"]) { const rr = latestRel.get(`sectors|${d}|${c}`); if (rr) byCode.get(c).set(m, rr.amount_inr_cr); }
        fixed.push(d);
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
    if (C.fixed.length) ex.note += ` Bank, food and non-food credit on ${C.fixed.join(", ")} are taken from the RBI press release: the export prints the following fortnight's Section 42 figures on those dates.`;
    const out = bundleOut(root, rel, { ...base, vintage: VS, frequency: "monthly", unit: "inr_lakh_crore", reportingDates: axis.map((m) => repByMonth.get(m) ?? null), ...ex }, axis, series,
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
  const cur = bundleOut(root, "credit-growth", { ...base, vintage: VS, frequency: "monthly", unit: "pct", base: "SIBC 2019 format",
    coverage: "Growth of bank credit on a year earlier, in total and for every sector and type of personal loan, monthly since January 2020",
    note: "Derived from credit-sectors. Where an RBI press release printed a year-ago figure for the month (December 2022 on), growth is the published amount over RBI's own printed year-ago amount, so it matches the release; earlier months compare with the same month a year before. The headline is bank credit of all scheduled commercial banks (Section 42). From December 2025 RBI compares month-end figures with the last reporting Friday a year earlier. July 2023 to June 2024 includes the HDFC merger's one-time jump; see credit-scb-ratios for growth excluding it.",
    yearAgoDates: Object.fromEntries(GS.comps),
  }, newS.dates, GS.series, "No year-earlier figure for this month.");
  void cur; void oldS; void newI;

  return { db, base, stamp };
}

// CLI: node scripts/lib/products/credit.mjs --catalogue  (writes the coverage catalogue only)
