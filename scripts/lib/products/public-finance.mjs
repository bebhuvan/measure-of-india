// scripts/lib/products/public-finance.mjs: what India's governments earn, spend, borrow and owe.
// The Centre, the states and the two together, from RBI's government-finance tables in DBIE,
// read from the owner's local Data Bank (scripts/lib/databank.mjs), read-only. Nothing here
// calls the RBI. One small exception, below: the RBI Innovation Hub's copy of the same
// Handbook tables is read for the tables' own NOTES, which the Data Bank does not keep.
//
// Reports read (DBIE report ids; the Handbook's and Public Debt Statistics' copies of the same
// tables are listed in the catalogue as duplicates):
//   Centre, annual (Handbook of Statistics on the Indian Economy, 1970-71 on):
//     713 key deficits, 655 receipts, 353 expenditure, 351 capital receipts, 352 developmental
//     and non-developmental spending, 656 the deficit and how it is financed, 1399 outstanding
//     liabilities, 355 fiscal indicators as per cent of GDP, 350 capital formation out of the
//     budget (discontinued 2017-18), 748 and 608 the Plan (discontinued 2016-17).
//   Centre, monthly: 49 Union Government Accounts at a Glance (RBI Bulletin, the Controller
//     General of Accounts' cumulative accounts with the year's budget and revised estimates),
//     349 the month-wise gross fiscal deficit (Handbook).
//   States, annual (all states and UTs with legislatures from 2017-18): 451 deficits, 709
//     receipts, 677 expenditure, 453 capital receipts, 692 the deficit and its financing,
//     452 outstanding liabilities, 454 fiscal indicators as per cent of GDP.
//   States, monthly (RBI Bulletin): 63 ways and means advances, special drawing facility and
//     overdraft by state; 37 states' investments in their reserve funds and Treasury bills.
//   Centre and states combined, annual: 346 deficits, 347 deficits as per cent of GDP, 339
//     liabilities, 342 debt as per cent of GDP, 340 developmental spending, 673 direct and
//     indirect taxes, 721 receipts and disbursements (states' and combined rows), 36 the
//     Bulletin's combined receipts and disbursements (budget, revised and actual).
//   Debt: 1369 who holds central and state government securities and Treasury bills
//     (quarterly), 1371 the same at end-March since 1991, 2 Treasury bills outstanding by holder
//     (weekly), 1362 the maturity of the Centre's dated securities, 581 and 356 small savings.
//   CAS (the Data Bank's parsed rbi_dbie_cas_money): FICG_GDP_RN and FISG_GDP_RN, the same
//     per-cent-of-GDP tables as 355 and 454, and CG_DEFM_RN, the same monthly deficit as 349:
//     read and checked equal (below), not baked twice.
//
// Value traps (docs/briefs/README.md), handled here:
//   - every webi value is repeated once per display unit (ACTUALS, LAKHS, CRORES, ...): ACTUALS
//     only, which are rupees; baked in ₹ crore.
//   - DBIE's "Version" labels are not reliable. The same figure is often tagged both "Budget
//     Estimates" and "Revised Estimates" (655, 2024-25: the figure is the year's accounts).
//     Where a year carries different figures under different labels, the most final label
//     wins (Final > Actual > Revised > Budget); that rule reproduces the Handbook as printed
//     (355, 2022-23: 6.46 per cent, the "Final" row). The STAGE of each year comes from the
//     table's own note, read from the Innovation Hub's export of the printed table ("Data for
//     2025-26 are Revised Estimates and data for 2026-27 are Budget Estimates"), and the
//     figures are split by stage: accounts in one series, the revised estimate and the budget
//     estimate each in its own series (never one line: brief, "show the path").
//   - Bulletin table 49 repeats the previous year's figures in some months (May 2009; July
//     2021 to February 2022: ten or more of its fourteen items equal the same month a year
//     earlier to the rupee). Those months are left empty and disclosed on each series. Its
//     budget-estimate column holds stray figures in a few months; the year's budget estimate
//     is the figure most months carry (the full budget's, in election years), and its revised
//     estimate the one printed in March (else February, else January) of the year.
//   - per cent of GDP: the RBI's ratios use GDP at current market prices on the 1999-2000 base
//     to 2003-04, the 2004-05 base to 2010-11 and the 2011-12 base from 2011-12 (Handbook table
//     on state indicators, note 4; the Centre's and the combined tables divide by the same
//     GDP, checked: the implied denominators agree to rounding). Three bases, three bundles
//     per table (AGENTS.md rule 1). The budget-estimate year divides by the budget's own GDP
//     projection. We add two rulers of our own: the same ratios on the 2011-12 series back to
//     1970-71 (the RBI's rupee figures over MoSPI's back series of GDP: arithmetic by Measure of India, its own
//     ruler, never joined to the RBI's) and on the new 2022-23 series.
//
// Hand checks against the RBI's own publications are recorded beside each bundle below.
import fs from "node:fs";
import path from "node:path";
import { databankRoot, dbieProvider, dbieProviders, databankQuery } from "../databank.mjs";
import { rbihubCatalogue, rbihubCsv } from "../rbihub.mjs";
import { writeSeries, writeRaw, readRaw } from "../util.mjs";
import { parseCsv } from "../tabular.mjs";
import { writeCatalogue, catalogueCli, sourceCfg, idPart } from "../catalogue.mjs";

const SLUG = "public-finance";
const C = { accent: "#2E4BD8", gold: "#C47A16", g1: "#5F6675", g2: "#A3A9B4", g3: "#C9CED6", muted: "#878D99" };
const CR = 1e7;                                                        // rupees per crore
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000);
const num = (s) => { const t = String(s ?? "").replace(/,/g, "").trim(); if (!t || /^(null|na|n\.a\.|-|—|–)$/i.test(t)) return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);
const isFY = (s) => /^\d{4}-\d{2}$/.test(String(s ?? "").trim());
const fyStart = (fy) => `${fy.slice(0, 4)}-04-01`;                     // "2024-25" -> "2024-04-01"
const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };
const fyNext = (fy) => { const y = +fy.slice(0, 4) + 1; return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const ymd = (s) => String(s).slice(0, 10).replace(/\//g, "-");          // "2026/09/15 00:00:00" -> "2026-09-15"
const month1 = (iso) => iso.slice(0, 7) + "-01";
function monthAxis(first, last) {
  const out = []; let [y, m] = first.split("-").map(Number); const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) { out.push(`${y}-${String(m).padStart(2, "0")}-01`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
function fyAxis(first, last) { const out = []; for (let f = first; f <= last; f = fyNext(f)) out.push(fyStart(f)); return out; }
// a clean reader's label: no table formula ("(2+10)"), no double spaces, sentence case kept as printed
const clean = (s) => String(s ?? "").replace(/\s*\((?:\d+\s*[+\-]\s*)+\d+\)\s*$/g, "").replace(/\s*\(\d+[+\-]\d+[+\-\d]*\)/g, "").replace(/^[A-Z]{2,3}\.[\d.]+\)\s*/, "").replace(/\s+/g, " ").trim();
// sentence case for the RBI's Title Case labels: words that are Capitalised become lower case
// (except the first), acronyms stay ("GST", "NSSF", "RBI", "WMA"); "Central - X" becomes "Centre: x"
const KEEP = new Set(["GST", "NSSF", "RBI", "WMA", "UDAY", "GFD", "CSF", "GRF", "ATBs", "BSF", "SDF", "OD", "PDs", "UTs", "NCT", "IINSS-C", "VAT", "PPF", "KVP", "NSC", "SCSS", "HUF", "PSUs", "I", "II", "III", "IV"]);
const sentence = (s) => {
  let t = clean(s)
    .replace(/^Central and States Combined\s*-\s*/i, "Centre and states: ").replace(/^Centre and States combined\s*/i, "Centre and states ")
    .replace(/^Central\s*-\s*/i, "Centre: ").replace(/^States\s*-\s*/i, "States: ").replace(/\bIncomeTax\b/, "Income tax");
  t = t.split(/(\s+)/).map((w, i) => (i === 0 || KEEP.has(w.replace(/[(),:]/g, "")) || !/^[A-Z][a-z]/.test(w) ? w : w.toLowerCase())).join("");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

// CONTRACT-series rule 5: a series computed here (a ratio, a share, a running total, a sum) says so
const derive = (series, note) => { for (const s of Object.values(series)) { s.derived = true; s.derivedNote = typeof note === "function" ? note(s) : note; } return series; };
const RANK = { Final: 4, Actual: 3, "Revised Estimates": 2, "Budget Estimates": 1 };

/* ======================================================================================
   Table definitions. Each annual Handbook table is read the same way; what differs is which
   columns carry the year, the item, its parent, the value, the unit and the version.
   ====================================================================================== */
const AMT = "Amount (Rs.Crore)";
const ANNUAL = [
  // ---------- Centre ----------
  { id: "713", hub: 180, bundle: "centre-deficits", scope: "centre", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc",
    title: "Key deficit indicators of the Central Government", coverage: "The Centre's deficits, every measure, ₹ crore, 1970-71 on",
    // hand check: 2024-25 gross fiscal deficit ₹15,74,431 crore and 2026-27 BE ₹16,95,768 crore, as printed in the
    // Handbook table (Innovation Hub export of report 180) and the Union Budget 2026-27 (Budget at a Glance)
    check: { item: "gross_fiscal_deficit", fy: "2024-25", value: 1574431, tol: 1 } },
  { id: "655", hub: 181, bundle: "centre-receipts", scope: "centre", unit: "inr_crore", year: "Year", item: "Budget Item", code: "Item Sk", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    // the table's own items; DBIE's query also returns 1970-71 to 1973-74 values of other tables' items, which those tables carry in full
    codes: ["8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "150"],
    title: "Central Government receipts, major components", coverage: "Where the Centre's money comes from: taxes (net of the states' share) by type, non-tax revenue, capital receipts, ₹ crore, 1970-71 on",
    note: "All taxes in this table are net of the states' share (Handbook note 2). GST, from July 2017, is CGST plus IGST plus the GST compensation cess (discontinued from 1 February 2026); it replaced most of the Centre's excise duty and service tax, so excise and GST are read together across 2017-18. Capital receipts exclude the drawdown of cash balances.",
    check: { item: "tax_revenue_net", fy: "2024-25", value: 2500038.78, tol: 1 } },
  { id: "353", hub: 75, bundle: "centre-expenditure", scope: "centre", unit: "inr_crore", year: "Year", item: "Item Description", code: "Item Sk", parent: "Cmb Item Hierarchy Level 1", value: AMT, unitCol: "Unit Desc",
    labels: { "28": "Defence (revenue account)", "34": "Defence (capital outlay)" }, keys: { "28": "defence_revenue", "34": "defence_capital" },
    title: "Major heads of expenditure of the Central Government", coverage: "Where the Centre's money goes: interest, defence, subsidies, capital spending, ₹ crore, 1970-71 on",
    note: "Defence excludes defence pensions and civil spending (Handbook note 4). 2007-08 includes ₹35,531 crore for the transfer of the RBI's stake in SBI to the government (note 3)." },
  { id: "351", hub: 182, bundle: "centre-capital-receipts", scope: "centre", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc",
    title: "Major heads of capital receipts of the Central Government", coverage: "The Centre's capital receipts: net market borrowing, small savings, provident funds, disinvestment, recoveries, ₹ crore, 1970-71 on",
    note: "Net of repayments; excludes the Market Stabilisation Scheme and changes in cash balances (Handbook note 4). From 2017-18 market borrowing is dated securities only (note 2)." },
  { id: "352", hub: 76, bundle: "centre-development", scope: "centre", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    title: "Developmental and non-developmental expenditure of the Central Government", coverage: "The Centre's spending on social and economic services against interest, defence and administration, ₹ crore, 1980-81 on" },
  { id: "656", hub: 210, bundle: "centre-financing", scope: "centre", unit: "inr_crore", year: "Year", item: "Budget Item", parent: "Cmb Item Hierarchy Level 1", value: AMT, unitCol: "Unit Desc",
    title: "The Centre's gross fiscal deficit and its financing", coverage: "How the Centre's deficit is financed: market borrowing, other borrowing, external finance, cash, ₹ crore, 1970-71 on",
    note: "From 2017-18 market borrowing is dated securities only; before, it included 364-day Treasury bills and the net effect of switches and buybacks (Handbook note 5). GFD receipts include disinvestment proceeds from 1991-92." },
  { id: "1399", hub: 82, bundle: "centre-liabilities", scope: "centre", unit: "inr_crore", year: "Year", item: "Item Description", value: AMT, unitCol: "Unit Description", version: "Version Desc",
    title: "Outstanding liabilities of the Central Government", coverage: "What the Centre owes at the end of each March, by instrument, ₹ crore, 1980-81 on",
    note: "External liabilities at the current exchange rate (Handbook note 2). Internal debt includes the Market Stabilisation Scheme from 2004-05 to 2012-13, and borrowing through extra-budgetary resources from 2016-17 (notes 4 and 5). The fall in 91-day bills in 1997-98 is the conversion of ad hoc Treasury bills into special securities (note 3)." },
  { id: "355", hub: 196, bundle: "centre-gdp", scope: "centre", unit: "pct_gdp", year: "Fis Year", item: "Items", value: "Amount", version: "Version Desc", gdp: true,
    title: "Select fiscal indicators of the Central Government, per cent of GDP", coverage: "The Centre's deficits, taxes, spending and interest as a share of GDP",
    note: "Net tax revenue is net of the states' share and the National Calamity Contingency Fund. Defence excludes pensions and civil spending. Capital receipts exclude the drawdown of cash balances.",
    check: { item: "gross_fiscal_deficit", fy: "2022-23", value: 6.46, tol: 0.01 } },
  { id: "350", hub: 77, bundle: "centre-capital-formation", scope: "centre", unit: "inr_crore", year: "Year", item: "Budget Item", code: "Item Sk", parent: "Cmb Item Hierarchy Level 1", value: AMT, unitCol: "Unit Desc", retired: "2017-18",
    labels: { "141": "Total capital formation out of the budget", "142": "Gross capital formation by the Centre", "143": "Gross financial assistance for capital formation" },
    title: "Gross capital formation from budgetary resources of the Central Government (discontinued)", coverage: "What the Centre's budget built or paid others to build, ₹ crore, 1970-71 to 2017-18 (the table ends there)",
    note: "From the Ministry of Finance's Economic and Functional Classification of the Central Government Budget; the RBI stopped the table at 2017-18 (BE)." },
  // ---------- States ----------
  { id: "451", hub: 78, bundle: "allstates-deficits", scope: "states", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc",
    title: "Key deficit indicators of the state governments", coverage: "All states' deficits added up, every measure, ₹ crore, 1970-71 on",
    note: "From 2017-18 all states and the union territories with legislatures (Handbook note 2). Net RBI credit is the change in the RBI's loans to states net of their deposits with it, a means of financing (note 4)." },
  { id: "709", provider: "DP0", hub: 79, bundle: "allstates-receipts", scope: "states", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc",
    title: "Pattern of receipts of the state governments", coverage: "Where the states' money comes from: their own taxes, their share of central taxes, grants from the Centre, capital receipts, ₹ crore, 1970-71 on",
    note: "'Sales tax' is the states' sales tax and VAT, and from 2017-18 their GST as the RBI groups it. Capital receipts include the public account on a net basis (Handbook note 5)." },
  { id: "677", hub: 80, bundle: "allstates-expenditure", scope: "states", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc",
    title: "Expenditure pattern of the state governments", coverage: "Where the states' money goes: social and economic services, interest, pensions, capital outlay, ₹ crore, 1970-71 on",
    note: "Developmental spending is social and economic services; non-developmental is interest, administration and pensions (Handbook note 5)." },
  { id: "453", hub: 211, bundle: "allstates-capital-receipts", scope: "states", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc",
    title: "Pattern of major capital receipts of the state governments", coverage: "The states' capital receipts: market loans, loans from the Centre, NSSF, provident funds, ₹ crore, 1970-71 on",
    note: "From 1999-2000 the states' share of small savings is shown as special securities issued to the NSSF, not as loans from the Centre (Handbook note 6)." },
  { id: "692", hub: 212, bundle: "allstates-financing", scope: "states", unit: "inr_crore", year: "Year", item: "Item Description", code: "Old Item Sk", value: AMT, unitCol: "Unit Desc",
    labels: { "70": "Special securities issued to NSSF (old classification)", "90": "State provident funds, small savings and others" }, keys: { "70": "nssf_old", "90": "provident_funds_and_others" },
    title: "The states' gross fiscal deficit and its financing", coverage: "How the states' deficit is financed: market borrowing, loans from the Centre, NSSF, provident funds, ₹ crore, 1970-71 on",
    note: "Financing items are net (Handbook note 5). Two codes for NSSF securities: the older one (to 1993-94) and the current one (from 1980-81), kept apart." },
  { id: "452", hub: 83, bundle: "allstates-liabilities", scope: "states", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    title: "Outstanding liabilities of the state governments", coverage: "What all states together owe at the end of each March, by instrument, ₹ crore, 1980-81 on",
    note: "Total liabilities include reserve funds, deposits and advances and contingency funds (Handbook note 3). Market loans include power bonds to 2014-15; UDAY bonds are in 'compensation and other bonds' from 2015-16 (notes 4 and 5)." },
  { id: "454", provider: "DP1", hub: 269, bundle: "allstates-gdp", scope: "states", unit: "pct_gdp", year: "Year", item: "Items", value: "Amount", gdp: true,
    title: "Select fiscal indicators of the state governments, per cent of GDP", coverage: "All states' deficits and receipts as a share of India's GDP" },
  // ---------- Centre and states combined ----------
  { id: "346", hub: 163, bundle: "combined-deficits", scope: "combined", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    title: "Combined deficits of the central and state governments", coverage: "The general government's deficits, the Centre and states together, ₹ crore, 1980-81 on",
    note: "Combined figures net out transactions between the Centre and the states; they are not the sum of the two." },
  { id: "347", hub: 86, bundle: "combined-gdp", scope: "combined", unit: "pct_gdp", year: "Fis Year", item: "Deficit Description", value: "Deficit Amount", version: "Version Desc", gdp: true,
    title: "Combined deficits of the central and state governments, per cent of GDP", coverage: "The general government's deficits as a share of GDP" },
  { id: "339", hub: 84, bundle: "combined-liabilities", scope: "combined", unit: "inr_crore", year: "Year", item: "Budget Item", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    title: "Combined liabilities of the central and state governments", coverage: "What the Centre and the states owe together, ₹ crore, 1980-81 on",
    note: "The combined total adjusts for what one government owes the other; it is not the sum of the Centre's and the states' liabilities (Handbook note 4). External liabilities at the current exchange rate." },
  { id: "342", hub: 87, bundle: "combined-debt-gdp", scope: "combined", unit: "pct_gdp", year: "Year", item: "Items", value: "Amount", version: "Version Desc", gdp: true,
    title: "Select debt indicators of the central and state governments, per cent of GDP", coverage: "Government debt as a share of GDP: the Centre, the states and the two together" },
  { id: "340", hub: 213, bundle: "combined-development", scope: "combined", unit: "inr_crore", year: "Year", item: "State Central Type", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    title: "Developmental and non-developmental expenditure of the central and state governments", coverage: "Developmental and non-developmental spending by the Centre, the states and the two together, ₹ crore, 1980-81 on" },
  { id: "673", hub: 81, bundle: "combined-taxes", scope: "combined", unit: "inr_crore", year: "Year", item: "Budget Item", code: "Item Sk", parent: "Cmb Item Hierarchy Level 1", value: AMT, unitCol: "Unit Description", version: "Version Desc",
    labels: { "102": "Centre (gross): direct taxes", "103": "Centre (gross): indirect taxes", "104": "Centre (gross): all taxes", "105": "States: direct taxes", "106": "States: indirect taxes", "107": "States: all taxes", "108": "Centre and states: direct taxes", "109": "Centre and states: indirect taxes", "110": "Centre and states: all taxes" },
    keys: { "102": "centre_direct", "103": "centre_indirect", "104": "centre_total", "105": "states_direct", "106": "states_indirect", "107": "states_total", "108": "combined_direct", "109": "combined_indirect", "110": "combined_total" },
    title: "Direct and indirect tax revenues of the central and state governments", coverage: "Direct and indirect taxes collected by the Centre (gross) and by the states, ₹ crore, 1980-81 on",
    note: "The Centre's taxes here are gross, before the states' share; the states' are their own taxes." },
  { id: "721", provider: "DP0", hub: 230, bundle: "combined-accounts", scope: "combined", unit: "inr_crore", year: "Year", item: "State Central Type", value: AMT, unitCol: "Unit Desc", version: "Version Desc",
    // the Centre's rows of this table repeat the Centre's own tables at an older stage (2024-25 revised
    // estimates where those tables carry accounts): read from the Centre's tables, not here
    only: (code) => !/^CG\./.test(code),
    title: "Receipts and disbursements of the central and state governments (states and combined)", coverage: "The states' and the combined general government's receipts, spending and deficit, ₹ crore, 1980-81 on",
    note: "Capital receipts and disbursements include the states' repayments of internal debt and the borrowing that replaced it (Handbook note 2). Combined finances exclude NCT Delhi from 2005-06 (note 4)." },
];

/* the stage notes of the printed tables, as the Innovation Hub exports them */
function stageOf(notes) {
  const t = notes.join(" ").replace(/\s+/g, " ");
  const re = /(\d{4}-\d{2})[^.;]{0,32}?Revised Estimates/.exec(t)?.[1] ?? null;
  const be = /(\d{4}-\d{2})[^.;]{0,32}?Budget Estimates/.exec(t)?.[1] ?? null;
  return { re, be };
}
const idx = (n) => `c${n}`;
function gridNotes(text) {
  const rows = parseCsv(text, ",");
  const head = rows[0].map((h) => String(h).trim());
  const c1 = head.indexOf("c1");
  return rows.slice(1).map((r) => String(r[c1] ?? "")).filter((s) => /\bNotes?\s*:|Source|Estimates|Accounts/.test(s)).map((s) => s.replace(/\s+/g, " ").trim());
}
// every number printed in each year row of the grid, for the cross-check
function gridYears(text) {
  const rows = parseCsv(text, ",");
  const head = rows[0].map((h) => String(h).trim());
  const cs = head.map((h, i) => (/^c\d+$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const out = new Map();
  for (const r of rows.slice(1)) {
    const y = String(r[cs[0]] ?? "").trim();
    if (!isFY(y)) continue;
    const cells = cs.slice(1).map((i) => String(r[i] ?? "").trim()).filter((s) => s !== "" && s !== "-")
      .map((s) => { const v = num(s.replace(/\s/g, "")); const d = (/\.(\d+)$/.exec(s.replace(/,/g, ""))?.[1] ?? "").length; return v == null ? null : { v, d }; }).filter(Boolean);
    out.set(y, [...(out.get(y) ?? []), ...cells]);
  }
  return out;
}

export async function buildPublicFinance(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const written = [];
  const meta = (extra) => ({ dossier: SLUG, source: "Reserve Bank of India, DBIE (via the Data Bank)", product: "public-finance", base: "n/a",
    vintage, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });
  const write = (name, obj) => {
    const rel = `data/series/${SLUG}-${name}.json`;
    trimAxis(obj);
    for (const [k, s] of Object.entries(obj.series)) {
      const a = s.data.findIndex((v) => v != null), z = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      if (a < 0) { delete obj.series[k]; continue; }
      const gaps = s.data.map((v, i) => (v == null && i > a && i < z ? obj.dates[i] : null)).filter(Boolean);
      if (gaps.length) { s.gaps = gaps; s.gapsNote ??= "The RBI's table prints no figure for these periods; left empty."; }
      else { delete s.gaps; }
    }
    if (!Object.keys(obj.series).length) throw new Error(`public-finance: ${name} has no data`);
    // a financial-year label ("2010-11") reads like a month to the freshness gate: name it as a year
    if (isFY(obj.meta.latestPeriod)) obj.meta.latestPeriod = `${obj.meta.latestPeriod} (financial year)`;
    writeSeries(root, rel, obj);
    written.push(`${SLUG}-${name}`);
    return obj;
  };
  function trimAxis(obj) {
    // the axis runs from the first to the last period any series reports (no empty lead or tail)
    const any = (i) => Object.values(obj.series).some((s) => s.data[i] != null);
    let a = 0, z = obj.dates.length - 1;
    while (a <= z && !any(a)) a++;
    while (z >= a && !any(z)) z--;
    obj.dates = obj.dates.slice(a, z + 1);
    for (const s of Object.values(obj.series)) s.data = s.data.slice(a, z + 1);
  }

  /* -------- raw archive: every row read, ACTUALS only, packed column by column -------- */
  const pack = (cols, rows) => ({ rows: rows.length, packing: "per column: {dict, codes} (codes = comma-separated indexes into dict) or {cells} (cells joined by a tab)",
    columns: Object.fromEntries(cols.map((c) => {
      const vals = rows.map((x) => String(x[c] ?? ""));
      const dict = [...new Set(vals)];
      if (dict.length <= 65536 && dict.length < vals.length / 2) { const ix = new Map(dict.map((v, i) => [v, i])); return [c, { dict, codes: vals.map((v) => ix.get(v)).join(",") }]; }
      return [c, { cells: vals.join("\t") }];
    })) });
  const RAWV = {};                                                     // report id -> data vintage
  const unitOK = (x) => { const u = x["Unit Desc"] ?? x["Unit Description"]; return u == null || u === "" || u === "ACTUALS"; };
  /** read a DBIE report's providers (ACTUALS rows only), archive them, return { provider: rows } */
  function readReport(id, providers = null) {
    const ps = dbieProviders(db, id).filter((p) => !providers || providers.includes(p.id));
    if (!ps.length) throw new Error(`public-finance: DBIE report ${id} has no data provider in the Data Bank`);
    const out = {}, arch = {};
    for (const p of ps) {
      const r = dbieProvider(db, id, p.id);
      const rows = r.rows.filter(unitOK);
      out[p.id] = rows;
      arch[p.id] = { name: p.name, provenance: r.provenance, header: r.header, rowsAllUnits: r.rows.length, ...pack(r.header, rows) };
    }
    RAWV[id] = writeRaw(root, `data/raw/${SLUG}-dbie-${id}.json`, { vintage, note: `RBI DBIE report ${id}, read from the local Data Bank mirror (rbi_dbie_webi_rows). Rows in ACTUALS (rupees) only: every other display unit repeats the same figure.`, providers: arch });
    return out;
  }

  /* -------- the printed tables' notes (Innovation Hub) and the grid cross-check -------- */
  const hubRel = `data/raw/${SLUG}-hub-notes.json`;
  let hub = null;
  try {
    const cat = await rbihubCatalogue();
    const want = [...new Set(ANNUAL.map((t) => t.hub))];
    const tables = {};
    for (const h of want) {
      const e = cat.find((x) => x.report_id === h && x.status === "loaded" && x.schema_name);
      if (!e) throw new Error(`Innovation Hub has no loaded table for report ${h}`);
      const text = await rbihubCsv(e.schema_name, e.table_name);
      const years = gridYears(text);
      tables[h] = { schema: e.schema_name, table: e.table_name, period_to: e.period_to, notes: gridNotes(text),
        grid: Object.fromEntries([...years].map(([y, cells]) => [y, cells.map((c) => `${c.v}|${c.d}`).join(" ")])) };
    }
    hub = { vintage, note: "The printed Handbook tables as the Reserve Bank Innovation Hub's DBIE service exports them (data-api.dbie.rbihub.in): their notes (which name the stage of each year) and every number in each year row, for the cross-check against the Data Bank.", tables };
    writeRaw(root, hubRel, hub);
  } catch (e) {
    console.warn(`public-finance: Innovation Hub unreachable (${e.message}); using the archived notes in ${hubRel}`);
    hub = readRaw(root, hubRel);
    if (!hub?.tables) throw new Error("public-finance: no Innovation Hub notes, live or archived; the stage of each year cannot be read");
  }

  /* =================== 1. the annual Handbook tables =================== */
  const T = {};                                                          // bundle name -> { years, items: Map(key -> {label, byFY}) , stage }
  const crossLog = {};
  for (const t of ANNUAL) {
    const R = readReport(t.id, t.provider ? [t.provider] : null);
    const all = R[t.provider ?? Object.entries(R).sort((a, b) => b[1].length - a[1].length)[0][0]];
    const H = hub.tables[t.hub];
    const stage = stageOf(H?.notes ?? []);
    if (t.stageless !== true && (!stage.be || !stage.re)) throw new Error(`public-finance: table ${t.id}: the printed note names no RE/BE years (${(H?.notes ?? []).join(" | ").slice(0, 200)})`);
    // item identity: a code where the table has one, else the label
    const items = new Map();
    for (const x of all) {
      const y = String(x[t.year] ?? "").trim(); if (!isFY(y)) continue;
      const v = num(x[t.value]); if (v == null) continue;
      const code = String(t.code ? x[t.code] : x[t.item]).trim();
      if (t.codes && !t.codes.includes(code)) continue;
      if (t.only && !t.only(code)) continue;
      const it = items.get(code) ?? { code, label: t.labels?.[code] ?? sentence(x[t.item]), parent: t.parent ? clean(x[t.parent]) : "", byFY: new Map() };
      const rk = t.version ? (RANK[x[t.version]] ?? 0) : 0;
      const prev = it.byFY.get(y);
      const val = t.unit === "inr_crore" ? v / CR : v;
      if (!prev || rk > prev.rk) it.byFY.set(y, { rk, v: val, ver: t.version ? x[t.version] : null, n: (prev?.n ?? 0) + 1, alt: prev ? [...(prev.alt ?? []), prev.v] : [] });
      else { prev.n++; if (Math.abs(prev.v - val) > 1e-9) prev.alt = [...(prev.alt ?? []), val]; }
      items.set(code, it);
    }
    if (!items.size) throw new Error(`public-finance: table ${t.id} served nothing`);
    // keys: a slug of the label; on a clash, the parent's slug in front (or the code)
    const keyOf = new Map(), seen = new Map();
    for (const it of items.values()) { const k = t.keys?.[it.code] ?? slug(it.label); seen.set(k, (seen.get(k) ?? 0) + 1); keyOf.set(it.code, k); }
    for (const it of items.values()) if (seen.get(keyOf.get(it.code)) > 1 && !t.keys?.[it.code]) keyOf.set(it.code, slug(`${it.parent && !/^of which$/i.test(it.parent) ? it.parent + " " : ""}${it.label}`) + (seen.get(slug(`${it.parent} ${it.label}`)) > 1 ? `_${it.code}` : ""));
    const keys = [...keyOf.values()];
    if (new Set(keys).size !== keys.length) throw new Error(`public-finance: table ${t.id}: duplicate series keys ${keys.join(",")}`);
    const fys = [...new Set([...items.values()].flatMap((it) => [...it.byFY.keys()]))].sort();
    const last = t.retired ?? fys.at(-1);
    // stage boundaries: accounts up to the year before the revised estimate
    const reFY = t.retired ? null : stage.re, beFY = t.retired ? null : stage.be;
    if (!t.retired && (beFY !== fys.at(-1) || fyNext(reFY) !== beFY)) throw new Error(`public-finance: table ${t.id}: note says RE ${reFY}, BE ${beFY} but the data end at ${fys.at(-1)}`);
    // the cross-check against the printed table: every figure we keep should be printed in its year row
    if (H?.grid) {
      let n = 0, hit = 0; const miss = [];
      for (const it of items.values()) for (const [y, o] of it.byFY) {
        const cells = (H.grid[y] ?? "").split(" ").filter(Boolean).map((s) => { const [v, d] = s.split("|"); return { v: +v, d: +d }; });
        if (!cells.length) continue;
        n++;
        if (cells.some((c) => Math.abs(c.v - o.v) <= 0.51 * 10 ** -c.d + 1e-9)) hit++; else if (miss.length < 8) miss.push(`${y} ${it.label}: ${r2(o.v)}`);
      }
      crossLog[t.id] = { hubReport: t.hub, checked: n, matched: hit, share: r4(hit / Math.max(1, n)), misses: miss };
      if (n && hit / n < 0.97) throw new Error(`public-finance: table ${t.id}: only ${hit}/${n} figures match the printed table (${miss.join("; ")})`);
    }
    // hand check
    if (t.check) {
      const it = [...items.values()].find((x) => keyOf.get(x.code) === t.check.item);
      const got = it?.byFY.get(t.check.fy)?.v;
      if (got == null || Math.abs(got - t.check.value) > t.check.tol) throw new Error(`public-finance: hand check failed for ${t.id} ${t.check.item} ${t.check.fy}: ${got} vs ${t.check.value}`);
    }
    T[t.bundle] = { t, items, keyOf, fys, reFY, beFY, last };
  }

  // assemble: accounts, revised estimate and budget estimate, each its own series
  const GDPB = [                                                      // the GDP series the RBI divides by (Handbook note on Table 269)
    { key: "b1999", base: "GDP 1999-2000 series", from: "1950-51", to: "2003-04", label: "GDP on the 1999-2000 base" },
    { key: "b2004", base: "GDP 2004-05 series", from: "2004-05", to: "2010-11", label: "GDP on the 2004-05 base" },
    { key: "b2011", base: "GDP 2011-12 series", from: "2011-12", to: null, label: "GDP on the 2011-12 base" },
  ];
  const STAGE_LABEL = { accounts: "accounts", re: "revised estimate", be: "budget estimate" };
  for (const [name, X] of Object.entries(T)) {
    const { t, items, keyOf, fys, reFY, beFY } = X;
    const unitLabel = t.unit === "inr_crore" ? "₹ crore" : "per cent of GDP";
    const mk = (fyList, gdpLabel) => {
      const dates = fyList.map(fyStart), series = {};
      let order = 0;
      for (const it of items.values()) {
        const k = keyOf.get(it.code);
        const val = (fy) => it.byFY.get(fy)?.v ?? null;
        const acc = fyList.map((fy) => (reFY && fy >= reFY ? null : val(fy)));
        const lab = it.label;
        const common = { unit: t.unit, group: it.parent && !/^of which$/i.test(it.parent) && it.parent !== it.label ? sentence(it.parent) : undefined, order: order++ };
        series[k] = { name: `${k}_${t.unit}`, label: `${lab}${t.unit === "pct_gdp" ? ", per cent of GDP" : ""}`, color: order === 1 ? C.accent : C.g2, stage: "accounts", ...common,
          data: acc.map((v) => (v == null ? null : t.unit === "inr_crore" ? r2(v) : r4(v))) };
        if (reFY && fyList.includes(reFY) && val(reFY) != null) series[`${k}__re`] = { name: `${k}_re_${t.unit}`, label: `${lab}: revised estimate ${reFY}`, color: C.gold, stage: "re", ...common, order: order++,
          data: fyList.map((fy) => (fy === reFY ? (t.unit === "inr_crore" ? r2(val(fy)) : r4(val(fy))) : null)) };
        if (beFY && fyList.includes(beFY) && val(beFY) != null) series[`${k}__be`] = { name: `${k}_be_${t.unit}`, label: `${lab}: budget estimate ${beFY}`, color: C.g1, stage: "be", ...common, order: order++,
          data: fyList.map((fy) => (fy === beFY ? (t.unit === "inr_crore" ? r2(val(fy)) : r4(val(fy))) : null)) };
      }
      for (const s of Object.values(series)) if (s.group === undefined) delete s.group;
      return { dates, series };
    };
    const stages = { accountsTo: reFY ? fys.filter((f) => f < reFY).at(-1) : X.last, revisedEstimate: reFY, budgetEstimate: beFY };
    const stageNote = reFY ? `Stages, from the printed table's own note: accounts to ${stages.accountsTo}, the revised estimate for ${reFY} and the budget estimate for ${beFY}, each in its own series (suffix __re and __be), never one line.` : `The RBI discontinued this table after ${X.last}.`;
    const crossNote = crossLog[t.id] ? ` Cross-checked against the printed table (Innovation Hub export of Handbook report ${t.hub}): ${crossLog[t.id].matched} of ${crossLog[t.id].checked} figures match.` : "";
    const baseMeta = { frequency: "annual", unit: t.unit, vintage: RAWV[t.id] ?? vintage, stages, scope: t.scope, table: { report: t.id, handbook: t.hub, title: t.title } };
    if (!t.gdp) {
      const obj = mk(fys, null);
      write(name, { meta: meta({ ...baseMeta, latestPeriod: fys.at(-1), coverage: t.coverage,
        note: `RBI, ${t.title} (DBIE report ${t.id}; Handbook of Statistics on the Indian Economy). Amounts in ₹ crore (DBIE serves rupees). ${t.note ? t.note + " " : ""}${stageNote}${crossNote}`.trim() }), ...obj });
    } else {
      for (const g of GDPB) {
        const fl = fys.filter((f) => f >= g.from && (g.to == null || f <= g.to));
        if (!fl.length) continue;
        const obj = mk(fl, g.label);
        write(`${name}-${g.key}`, { meta: meta({ ...baseMeta, base: g.base, latestPeriod: fl.at(-1), coverage: `${t.coverage}, ${fl[0]} to ${fl.at(-1)}, over ${g.label}`,
          note: `RBI, ${t.title} (DBIE report ${t.id}). Per cent of GDP at current market prices, ${g.label} (the RBI's note on its state-indicators table: 1999-2000 base to 2003-04, 2004-05 base to 2010-11, 2011-12 base from 2011-12; the Centre's and the combined tables divide by the same GDP, checked by their implied denominators). A different GDP base is a different ruler: never joined across bundles.${g.to == null && beFY ? ` The budget estimate for ${beFY} divides by the budget's own GDP projection.` : ""} ${t.note ? t.note + " " : ""}${g.to == null ? stageNote : ""}${crossNote}`.replace(/\s+/g, " ").trim() }), ...obj });
      }
    }
  }
  // identity: the Centre's GFD equals revenue deficit plus the rest only in concept; check the
  // published relation the table states, gross primary deficit = GFD minus interest payments
  {
    const D = T["centre-deficits"], E = T["centre-expenditure"];
    const get = (X, key, fy) => [...X.items.values()].find((it) => X.keyOf.get(it.code) === key)?.byFY.get(fy)?.v;
    let worst = 0;
    for (const fy of D.fys) { const g = get(D, "gross_fiscal_deficit", fy), p = get(D, "gross_primary_deficit", fy), i = get(E, "interest_payments", fy); if (g == null || p == null || i == null) continue; worst = Math.max(worst, Math.abs(g - i - p)); }
    if (worst > 2) throw new Error(`public-finance: gross primary deficit != GFD - interest (worst ${worst} crore)`);
    console.log(`public-finance: identity GPD = GFD - interest holds (worst ${r2(worst)} crore)`);
  }


  /* =================== 2. the Centre's monthly accounts =================== */
  // 349: the month's own gross fiscal deficit (Handbook, from the CGA); March from the final accounts
  {
    const rows = readReport("349").DP0;
    const by = new Map();
    for (const x of rows) {
      const d = month1(ymd(x.Year)), v = num(x.Value); if (v == null) continue;
      const rk = RANK[x["Version Desc"]] ?? 0, p = by.get(d);
      if (!p || rk > p.rk) by.set(d, { rk, v: v / CR });
    }
    if (!by.size) throw new Error("public-finance: report 349 served nothing");
    const ds = [...by.keys()].sort(), dates = monthAxis(ds[0].slice(0, 7), ds.at(-1).slice(0, 7));
    const month = dates.map((d) => (by.has(d) ? r2(by.get(d).v) : null));
    // running total within each financial year; empty when a month of the year so far is missing
    const fytd = []; let run = 0, fy = null, broken = false;
    dates.forEach((d, i) => { const f = fyOf(d); if (f !== fy) { fy = f; run = 0; broken = false; } if (month[i] == null) broken = true; else run += month[i]; fytd.push(broken ? null : r2(run)); });
    // identity: a whole year's months add up to the year's accounts in table 713
    const D = T["centre-deficits"]; const gfd = [...D.items.values()].find((it) => D.keyOf.get(it.code) === "gross_fiscal_deficit");
    let worst = 0, worstFY = null, nYears = 0; const off = [];
    dates.forEach((d, i) => { if (d.slice(5, 7) !== "03" || fytd[i] == null) return; const f = fyOf(d); const a = gfd.byFY.get(f); if (!a || f >= D.reFY) return; nYears++; const rel = Math.abs(fytd[i] - a.v) / Math.abs(a.v); if (rel > 0.0005) off.push(`${f} (${r2(fytd[i])} against ${r2(a.v)})`); if (rel > worst) { worst = rel; worstFY = f; } });
    if (worst > 0.02) throw new Error(`public-finance: 349's months do not add up to 713's annual GFD (worst ${(worst * 100).toFixed(2)}% in ${worstFY})`);
    console.log(`public-finance: 349 months add up to 713's annual GFD in ${nYears - off.length} of ${nYears} years; differ in ${off.join(", ")}`);
    write("centre-gfd-monthly", { meta: meta({ frequency: "monthly", unit: "inr_crore", vintage: RAWV["349"], latestPeriod: dates.at(-1).slice(0, 7),
      coverage: "The Centre's gross fiscal deficit month by month, and the running total since April, ₹ crore, April 1994 on",
      note: `RBI, Month-wise Gross Fiscal Deficit of the Central Government (DBIE report 349; Handbook), from the Controller General of Accounts. A negative month is a surplus (the RBI's dividend to the government usually lands in May). March is from the final accounts, so a year's twelve months add up to the year's accounts in the Centre's deficit table: checked, they do in ${nYears - off.length} of ${nYears} years; in ${off.map((x) => x.split(" ")[0]).join(", ")} the months differ from the year's audited figure by up to ${(worst * 100).toFixed(1)}% (the monthly table was not restated). The running total is computed here.` }),
      dates, series: {
        gfd_month: { name: "gfd_month_inr_crore", label: "Gross fiscal deficit in the month", unit: "inr_crore", color: C.g2, data: month },
        gfd_fytd: { name: "gfd_fytd_inr_crore", label: "Gross fiscal deficit, April to the month (computed)", unit: "inr_crore", color: C.accent, data: fytd, derived: true, derivedNote: "The RBI's monthly deficits added up from April; computed by Measure of India." },
      } });
    T.gfdMonthly = { dates, month, fytd };
  }

  // 49: Union Government Accounts at a Glance (Bulletin): cumulative accounts, budget and revised estimates
  {
    const R = readReport("49");
    const KEY = { "Revenue Receipts": "revenue_receipts", "Tax Revenue (Net)": "tax_revenue_net", "Non-Tax Revenue": "non_tax_revenue", "Capital Receipts": "non_debt_capital_receipts",
      "Recovery of Loans": "recovery_of_loans", "Other Receipts": "other_receipts", "Total Receipts": "total_receipts", "Revenue Expenditure": "revenue_expenditure",
      "of which : (i) Interest Payments": "interest_payments", "Capital Expenditure": "capital_expenditure", "Total Expenditure": "total_expenditure",
      "Revenue Deficit": "revenue_deficit", "Fiscal Deficit": "fiscal_deficit", "Gross Primary Deficit": "primary_deficit" };
    const LABEL = { revenue_receipts: "Revenue receipts", tax_revenue_net: "Tax revenue (net of the states' share)", non_tax_revenue: "Non-tax revenue", non_debt_capital_receipts: "Non-debt capital receipts",
      recovery_of_loans: "Recovery of loans", other_receipts: "Other receipts (mainly disinvestment)", total_receipts: "Total receipts, excluding borrowing", revenue_expenditure: "Revenue expenditure",
      interest_payments: "Interest payments", capital_expenditure: "Capital expenditure", total_expenditure: "Total expenditure", revenue_deficit: "Revenue deficit", fiscal_deficit: "Fiscal deficit", primary_deficit: "Primary deficit" };
    const A = new Map(), BE = new Map(), RE = new Map(); let conflicts = 0;
    for (const rows of Object.values(R)) for (const x of rows) {
      const k = KEY[x["Budget Item"]]; if (!k) { console.warn(`public-finance: 49: unknown item "${x["Budget Item"]}"`); continue; }
      const v = num(x.Amount); if (v == null) continue;
      const m = month1(ymd(x["Time Date"])), fy = String(x["Fiscal Year String"]).trim();
      if (x.Version === "Actual") { const key = `${m}|${k}`; if (A.has(key) && Math.abs(A.get(key) - v / CR) > 0.5) conflicts++; A.set(key, v / CR); }
      else if (x.Version === "Budget Estimates") { if (v !== 0) BE.set(`${fy}|${k}|${m}`, v / CR); }
      else if (x.Version === "Revised Estimates") { if (v !== 0) RE.set(`${fy}|${k}|${m}`, v / CR); }
    }
    const months = [...new Set([...A.keys()].map((s) => s.split("|")[0]))].sort();
    const keys = Object.values(KEY);
    // months where the table repeats the same month of the year before (ten or more of fourteen items, to the rupee)
    const repeated = months.filter((m) => { const prev = `${+m.slice(0, 4) - 1}${m.slice(4)}`; let same = 0; for (const k of keys) { const a = A.get(`${m}|${k}`), b = A.get(`${prev}|${k}`); if (a != null && b != null && Math.abs(a - b) < 1e-9) same++; } return same >= 10; });
    const dates = monthAxis(months[0].slice(0, 7), months.at(-1).slice(0, 7));
    const fys = [...new Set(dates.map(fyOf))];
    // the year's budget estimate: the figure most months carry; its revised estimate: March, else February, else January
    // the old layout (to April 2019) mostly counts borrowing inside capital receipts and total receipts, so
    // total receipts equal total expenditure; the new layout counts only non-debt receipts. Two measures:
    // a month (or a year's estimate) whose total receipts equal its total expenditure goes to the
    // "including borrowing" series of those two items, never into the non-debt series.
    const INCL = ["non_debt_capital_receipts", "total_receipts"];
    const tolOf = (e) => Math.max(2, 0.001 * Math.abs(e ?? 0));
    const inclAt = (get) => { const t = get("total_receipts"), e = get("total_expenditure"), f = get("fiscal_deficit"); return t != null && e != null && Math.abs(t - e) <= tolOf(e) && Math.abs(f ?? 0) > tolOf(e); };
    // a row of the table is usable only where its own arithmetic holds: total spending = revenue + capital
    // spending, the revenue deficit = revenue spending - revenue receipts, the primary deficit = the fiscal
    // deficit - interest, revenue receipts = net tax + non-tax revenue, and (in the non-debt layout) the fiscal
    // deficit = spending - receipts. In some months the RBI's columns slip between items (2025-26's budget
    // estimates: capital spending carries the revenue-spending figure); such rows fail and are not used.
    const vecOk = (get) => {
      const v = (k) => get(k); const near = (a, b, scale) => Math.abs(a - b) <= tolOf(scale);
      const tests = [];
      const add = (vals, f) => { if (vals.every((x) => x != null)) tests.push(f(...vals)); };
      add([v("total_expenditure"), v("revenue_expenditure"), v("capital_expenditure")], (t, r, c) => near(t, r + c, t));
      add([v("revenue_deficit"), v("revenue_expenditure"), v("revenue_receipts")], (d, e, r) => near(d, e - r, e));
      add([v("primary_deficit"), v("fiscal_deficit"), v("interest_payments")], (p, f, i) => near(p, f - i, f));
      add([v("revenue_receipts"), v("tax_revenue_net"), v("non_tax_revenue")], (r, t, n) => near(r, t + n, r));
      if (!inclAt(get)) add([v("fiscal_deficit"), v("total_expenditure"), v("total_receipts")], (f, e, r) => near(f, e - r, e));
      return tests.length >= 3 && tests.every(Boolean);
    };
    // the year's budget estimate: the row (all fourteen items of one month) that most of the year's months
    // print and whose arithmetic holds; in election years that is the full budget's, not the interim one's
    const rowsOf = (M, fy, monthsList) => monthsList.map((d) => Object.fromEntries(keys.map((k) => [k, M.get(`${fy}|${k}|${d}`) ?? null])));
    const beRow = new Map(), reRow = new Map(), rejected = [];
    for (const fy of fys) {
      const ms = dates.filter((d) => fyOf(d) === fy);
      const counts = new Map();
      for (const row of rowsOf(BE, fy, ms)) { if (!Object.values(row).some((x) => x != null)) continue; const key = JSON.stringify(Object.values(row).map((x) => (x == null ? null : r2(x)))); const c = counts.get(key) ?? { row, n: 0 }; c.n++; counts.set(key, c); }
      const ok = [...counts.values()].filter((c) => vecOk((k) => c.row[k])).sort((a, b) => b.n - a.n);
      if (ok.length) beRow.set(fy, ok[0].row); else if (counts.size) rejected.push(`${fy} budget estimate`);
      const y2 = +fy.slice(0, 4) + 1;
      for (const mm of ["03", "02", "01"]) { const [row] = rowsOf(RE, fy, [`${y2}-${mm}-01`]); if (!Object.values(row).some((x) => x != null)) continue; if (vecOk((k) => row[k])) { reRow.set(fy, row); break; } rejected.push(`${fy} revised estimate as printed in ${y2}-${mm}`); }
    }
    const reOf = (fy, k) => { const v = reRow.get(fy)?.[k]; return v == null ? null : r2(v); };
    const beBy = new Map(fys.flatMap((fy) => keys.map((k) => { const v = beRow.get(fy)?.[k]; return [`${fy}|${k}`, v == null ? null : r2(v)]; })));
    const inclFY = new Set(fys.filter((fy) => inclAt((k) => beBy.get(`${fy}|${k}`))));
    const inclMonth = new Set(dates.filter((d) => inclAt((k) => A.get(`${d}|${k}`))));
    // a month whose own figures do not add up (the deficit is not spending less non-debt receipts, nor is
    // it the old layout), or that repeats an earlier month of the same year item for item, is left empty
    // a row of zeros adds up trivially but is not a month of accounts (March 2007 prints 0 for every item)
    const zeroRow = (d) => !A.get(`${d}|total_expenditure`);
    const inconsistent = dates.filter((d) => !repeated.includes(d) && keys.some((k) => A.get(`${d}|${k}`) != null) && (zeroRow(d) || !vecOk((k) => A.get(`${d}|${k}`) ?? null)));
    const echoes = dates.filter((d, i) => keys.some((k) => A.get(`${d}|${k}`) != null) && dates.slice(0, i).some((p) => fyOf(p) === fyOf(d) && keys.every((k) => A.get(`${p}|${k}`) === A.get(`${d}|${k}`))));
    repeated.push(...inconsistent, ...echoes);
    console.log(`public-finance: 49: months left empty: repeated year ${repeated.length - inconsistent.length - echoes.length}, inconsistent ${inconsistent.join(" ")}, echoes ${echoes.join(" ")}`);
    const series = {};
    keys.forEach((k, j) => {
      const raw = dates.map((d) => (repeated.includes(d) ? null : r2(A.get(`${d}|${k}`) ?? null)));
      const data = INCL.includes(k) ? raw.map((v, i) => (inclMonth.has(dates[i]) ? null : v)) : raw;
      if (INCL.includes(k)) series[`${k}_incl_borrowing`] = { name: `${k}_incl_borrowing_inr_crore`, label: `${k === "total_receipts" ? "Total receipts" : "Capital receipts"}, including borrowing (the old layout), April to the month`, unit: "inr_crore", color: C.g3,
        data: raw.map((v, i) => (inclMonth.has(dates[i]) ? v : null)), gapsNote: "Only the months in which the table counted borrowing inside receipts (total receipts equal total expenditure); the other months are in the non-debt series." };
      series[k] = { name: `${k}_inr_crore`, label: `${LABEL[k]}, April to the month`, unit: "inr_crore", color: k === "fiscal_deficit" ? C.accent : C.g2, data };
      const pct = dates.map((d, i) => { const be = beBy.get(`${fyOf(d)}|${k}`); return data[i] == null || !be || (INCL.includes(k) && inclFY.has(fyOf(d))) ? null : r2((100 * data[i]) / be); });
      series[`${k}_pct_be`] = { name: `${k}_pct_of_be`, label: `${LABEL[k]}, April to the month, per cent of the year's budget estimate (computed)`, unit: "pct", color: k === "fiscal_deficit" ? C.accent : C.g2, data: pct,
        derived: true, derivedNote: "The CGA's cumulative figure as printed by the RBI, divided by the year's budget estimate from the same table; computed by Measure of India." };
    });
    for (const s of Object.values(series)) {
      const rep = repeated.filter((d) => dates.indexOf(d) > s.data.findIndex((v) => v != null));
      if (rep.length) s.gapsNote = `Months left empty: ${rep.map((d) => d.slice(0, 7)).join(", ")}. In each the RBI's table either repeats the figures of a year earlier (ten or more of its fourteen items match the same month of the previous year to the rupee), repeats an earlier month of the same year, or prints figures that do not add up (the deficit is not spending less receipts). Other empty months are months the table does not print.`;
    }
    const old = Object.fromEntries(Object.entries(series).filter(([k]) => k.endsWith("_incl_borrowing")));
    for (const k of Object.keys(old)) delete series[k];
    write("centre-monthly-incl-borrowing", { meta: meta({ frequency: "monthly", unit: "inr_crore", vintage: RAWV["49"], latestPeriod: dates.at(-1).slice(0, 7),
      coverage: "The Centre's capital receipts and total receipts counted with borrowing, the measure the Bulletin's old layout used in most months to April 2019, April to the month, ₹ crore",
      note: "RBI Bulletin, Union Government Accounts at a Glance (DBIE report 49). In these months the table counts borrowing inside capital receipts and total receipts (total receipts equal total expenditure): a different measure from the non-debt receipts in public-finance-centre-monthly, so a separate bundle, never joined." }),
      dates, series: old });
    write("centre-monthly", { meta: meta({ frequency: "monthly", unit: "inr_crore", vintage: RAWV["49"], latestPeriod: dates.at(-1).slice(0, 7),
      coverage: "The Centre's accounts month by month, April to the month: receipts, spending, interest and the deficits, ₹ crore, and each as a share of the year's budget estimate",
      repeatedMonths: repeated,
      note: `RBI Bulletin, Union Government Accounts at a Glance (DBIE report 49, two data providers: the old layout to April 2019 and the new from May 2019, the same fourteen items), from the Controller General of Accounts. Figures are cumulative from April and unaudited (the table's note 1). The share of the budget estimate is computed here against the year's budget estimate (from the row most of the year's months print whose own arithmetic holds; the full budget's figure in election years). A month whose own figures do not add up is left empty. ${repeated.length} months are left empty: they repeat a year earlier, repeat an earlier month, or do not add up (listed on each series). In ${inclMonth.size} months, mostly in the old layout, the table counts borrowing inside capital receipts and total receipts (total receipts equal total expenditure); those two items for those months are in a separate bundle (public-finance-centre-monthly-incl-borrowing). ${conflicts} duplicate rows with differing figures were found (the later row wins).` }),
      dates, series });
    // the path of each year: budget estimate, revised estimate, provisional accounts (the March figure)
    const pf = fys.filter((fy) => keys.some((k) => beBy.get(`${fy}|${k}`) != null));
    const path = {};
    const reIncl = new Set(pf.filter((fy) => inclAt((k) => reOf(fy, k))));
    const prIncl = new Set(pf.filter((fy) => inclMonth.has(`${+fy.slice(0, 4) + 1}-03-01`)));
    keys.forEach((k) => {
      const keep = (set) => (fy, v) => (INCL.includes(k) && set.has(fy) ? null : v);
      const only = (set) => (fy, v) => (set.has(fy) ? v : null);
      const prov = (fy) => { const d = `${+fy.slice(0, 4) + 1}-03-01`; return repeated.includes(d) ? null : r2(A.get(`${d}|${k}`) ?? null); };
      path[`${k}__be`] = { name: `${k}_be_inr_crore`, label: `${LABEL[k]}: budget estimate`, unit: "inr_crore", stage: "be", color: C.g1, data: pf.map((fy) => keep(inclFY)(fy, beBy.get(`${fy}|${k}`) ?? null)) };
      path[`${k}__re`] = { name: `${k}_re_inr_crore`, label: `${LABEL[k]}: revised estimate`, unit: "inr_crore", stage: "re", color: C.gold, data: pf.map((fy) => keep(reIncl)(fy, reOf(fy, k))) };
      path[`${k}__provisional`] = { name: `${k}_provisional_inr_crore`, label: `${LABEL[k]}: provisional accounts (March, unaudited)`, unit: "inr_crore", stage: "provisional", color: C.accent, data: pf.map((fy) => keep(prIncl)(fy, prov(fy))) };
      if (INCL.includes(k)) {
        const L2 = k === "total_receipts" ? "Total receipts, including borrowing (the old layout)" : "Capital receipts, including borrowing (the old layout)";
        path[`${k}_incl_borrowing__be`] = { name: `${k}_incl_borrowing_be_inr_crore`, label: `${L2}: budget estimate`, unit: "inr_crore", stage: "be", color: C.g3, data: pf.map((fy) => only(inclFY)(fy, beBy.get(`${fy}|${k}`) ?? null)) };
        path[`${k}_incl_borrowing__re`] = { name: `${k}_incl_borrowing_re_inr_crore`, label: `${L2}: revised estimate`, unit: "inr_crore", stage: "re", color: C.g3, data: pf.map((fy) => only(reIncl)(fy, reOf(fy, k))) };
        path[`${k}_incl_borrowing__provisional`] = { name: `${k}_incl_borrowing_provisional_inr_crore`, label: `${L2}: provisional accounts`, unit: "inr_crore", stage: "provisional", color: C.g3, data: pf.map((fy) => only(prIncl)(fy, prov(fy))) };
      }
    });
    for (const s of Object.values(path)) if (/incl_borrowing/.test(s.name)) s.gapsNote = "Only the years in which the table counted borrowing inside receipts; the other years are in the non-debt series.";
    // checks: the latest budget and revised estimates equal the Handbook's (713 for the deficits, 655, 353)
    const hb = (bundle, key, fy) => { const X = T[bundle]; const it = [...X.items.values()].find((i) => X.keyOf.get(i.code) === key); return it?.byFY.get(fy)?.v ?? null; };
    const pairs = [["fiscal_deficit", "centre-deficits", "gross_fiscal_deficit"], ["revenue_deficit", "centre-deficits", "revenue_deficit"], ["revenue_receipts", "centre-receipts", "revenue_receipts"],
      ["tax_revenue_net", "centre-receipts", "tax_revenue_net"], ["total_expenditure", "centre-expenditure", "total_expenditure"], ["interest_payments", "centre-expenditure", "interest_payments"]];
    const D = T["centre-deficits"]; const checks = [];
    for (const [k, b, hk] of pairs) {
      const be = beBy.get(`${D.beFY}|${k}`), hbe = hb(b, hk, D.beFY), re = reOf(D.reFY, k), hre = hb(b, hk, D.reFY);
      checks.push(`${k}: BE ${D.beFY} ${be} vs ${r2(hbe)}; RE ${D.reFY} ${re} vs ${r2(hre)}`);
      if (be == null || Math.abs(be - hbe) > 1 || re == null || Math.abs(re - hre) > 1) throw new Error(`public-finance: 49's budget path disagrees with the Handbook: ${checks.at(-1)}`);
    }
    console.log(`public-finance: 49 BE/RE rule matches the Handbook for ${pairs.length} items`);
    write("centre-budget-path", { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV["49"], latestPeriod: pf.at(-1),
      coverage: "Each year's path from the budget estimate to the revised estimate to the provisional accounts, for the Centre's fourteen headline items, ₹ crore, 1999-2000 on",
      checks, rejectedRows: rejected,
      note: `RBI Bulletin, Union Government Accounts at a Glance (DBIE report 49). For each financial year: the budget estimate (the row of fourteen items that most of the year's months print and whose own arithmetic holds, which in election years is the full budget's rather than the interim budget's), the revised estimate (as printed in March, else February, else January of the year, again only from a row that adds up) and the provisional accounts (the cumulative figure for March, unaudited). The audited accounts, published later, are in the Centre's Handbook tables. Checked: the rule gives the Handbook's figures for the latest budget and revised estimates (${pairs.length} items). Rows whose own arithmetic fails are not used${rejected.length ? ` (${rejected.join("; ")})` : ""}. Three stages, three series per item; never one line.` }),
      dates: pf.map(fyStart), series: path });
  }

  /* =================== 3. the states' cash: WMA, SDF, overdraft; reserve funds =================== */
  const stateName = (s) => String(s).trim().toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/&/g, "and");
  {
    const rows = readReport("63").DP0;
    const FAC = { "Special Drawing Facility (SDF)": "sdf", "Ways and Means Advances (WMA)": "wma", "Overdraft (OD)": "od" };
    const MEAS = { "Number of days availed": "days", "Average amount availed": "amount" };
    const by = new Map(), states = new Map(), ds = new Set();
    for (const x of rows) {
      const f = FAC[x["Item Hierarchy Level1"]], m = MEAS[x["Item Hierarchy Level2"]]; if (!f || !m) { console.warn(`public-finance: 63: unknown item ${x["Item Name"]}`); continue; }
      const d = month1(ymd(x["D Time D Date"])), st = stateName(x["State Name"]); ds.add(d); states.set(slug(st), st);
      // the Bulletin prints "-" for nil (its note 5): an empty cell is a zero, a month the state did not use the facility
      const v = num(x.Amount);
      by.set(`${slug(st)}|${f}|${m}|${d}`, v == null ? 0 : m === "amount" ? v / CR : v);
    }
    const dates = monthAxis([...ds].sort()[0].slice(0, 7), [...ds].sort().at(-1).slice(0, 7));
    const series = {};
    const FL = { sdf: "special drawing facility", wma: "ways and means advances", od: "overdraft" };
    for (const [k, st] of [...states].sort()) for (const f of ["wma", "sdf", "od"]) for (const m of ["days", "amount"]) {
      const data = dates.map((d) => { const v = by.get(`${k}|${f}|${m}|${d}`); return v == null ? null : m === "amount" ? r2(v) : v; });
      series[`${k}__${f}_${m}`] = { name: `${k}_${f}_${m}`, label: `${st}: ${FL[f]}, ${m === "days" ? "days used in the month" : "average amount used, ₹ crore"}`, unit: m === "days" ? "days" : "inr_crore", group: st, color: f === "od" ? C.accent : C.g2, data };
    }
    // how many states drew on each facility in the month (computed)
    for (const f of ["wma", "sdf", "od"]) series[`states_using_${f}`] = { name: `states_using_${f}`, label: `Total: number of states that used ${FL[f]} in the month (computed)`, unit: "count", group: "All states", color: f === "od" ? C.accent : C.g2,
      data: dates.map((d) => { let n = 0, seen = 0; for (const [k] of states) { const v = by.get(`${k}|${f}|days|${d}`); if (v == null) continue; seen++; if (v > 0) n++; } return seen ? n : null; }),
      derived: true, derivedNote: "States with at least one day on the facility in the month, counted by Measure of India from the RBI's table." };
    write("states-wma", { meta: meta({ frequency: "monthly", unit: "inr_crore", vintage: RAWV["63"], latestPeriod: dates.at(-1).slice(0, 7), states: [...states.values()].sort(),
      coverage: "Which states ran short of cash: days each state drew on the RBI's special drawing facility, ways and means advances and overdraft, and the average amount, every month since September 2017",
      note: "RBI Bulletin, Financial Accommodation Availed by State Governments under various Facilities (DBIE report 63). SDF is drawn against the state's reserve funds and Treasury bills held with the RBI; WMA is the RBI's advance for temporary cash mismatches; overdraft is anything beyond the WMA limit (the table's notes 1 to 3). Average amount is the total drawn divided by the days it was drawn (note 4). The table prints '-' for nil: read as zero. State counts are computed here." }),
      dates, series });
  }
  {
    const rows = readReport("37").DP0;
    const by = new Map(), states = new Map(), items = new Map(), ds = new Set();
    for (const x of rows) {
      const d = month1(ymd(x["D Time D Date"])), st = stateName(x["State Name"]); ds.add(d); states.set(slug(st), st);
      const it = slug(x["Item Name"]); items.set(it, clean(x["Item Name"]));
      const v = num(x.Amount); if (v == null) continue;                  // "--": not a member of the scheme (note 3)
      by.set(`${slug(st)}|${it}|${d}`, v / CR);
    }
    const dates = monthAxis([...ds].sort()[0].slice(0, 7), [...ds].sort().at(-1).slice(0, 7));
    const series = {};
    for (const [k, st] of [...states].sort()) for (const [it, lab] of items) series[`${k}__${it}`] = { name: `${k}_${it}_inr_crore`, label: `${st}: ${lab}, ₹ crore`, unit: "inr_crore", group: st, color: C.g2,
      data: dates.map((d) => r2(by.get(`${k}|${it}|${d}`) ?? null)) };
    for (const [it, lab] of items) series[`all__${it}`] = { name: `all_${it}_inr_crore`, label: `All states: ${lab}, ₹ crore (sum of the states that report, computed)`, unit: "inr_crore", group: "All states", color: C.accent,
      data: dates.map((d) => { let s = 0, n = 0; for (const [k] of states) { const v = by.get(`${k}|${it}|${d}`); if (v != null) { s += v; n++; } } return n ? r2(s) : null; }),
      derived: true, derivedNote: "The states' holdings in the RBI's table added up by Measure of India." };
    write("states-investments", { meta: meta({ frequency: "monthly", unit: "inr_crore", vintage: RAWV["37"], latestPeriod: dates.at(-1).slice(0, 7),
      coverage: "The states' cushions: what each state holds in its consolidated sinking fund, guarantee redemption fund, budget stabilisation fund and Treasury bills with the RBI, month-end, since September 2017",
      note: "RBI Bulletin, Investments by State Governments (DBIE report 37). The sinking fund (CSF), guarantee redemption fund (GRF) and budget stabilisation fund (BSF, from December 2025) are reserve funds kept with the RBI; ATBs are Treasury bills bought at auction (the table's notes 1, 2 and 4). An empty cell is '--', not a member of the scheme: left empty. All-state sums are computed here." }),
      dates, series });
  }

  /* =================== 4. who holds the debt =================== */
  const HOLDER = (s) => clean(String(s).replace(/^\d+(\.\d+)?\.?\s+/, "").replace(/^[ivx]+\)\s*/i, "").replace(/Total \(in ₹\. Crore\)/, "Total"));
  {
    const R = readReport("1369");
    const DEFS = [["DP0", "gsec", "Date", "Amount (in Rs. Crore) Central Govt (Quarterly)", "Central government dated securities"],
      ["DP1", "sdl", "D_TIME_D_DATE", "Amount (in Rs. Crore) State Development (Quarterly)", "State government securities (SDLs)"],
      ["DP2", "tbills", "D_TIME_D_DATE", "Amount (in Rs. Crore) Treasury Bills (Quarterly)", "Treasury bills"]];
    for (const [p, nm, dcol, vcol, what] of DEFS) {
      const by = new Map(), hs = new Map(), ds = new Set();
      for (const x of R[p] ?? []) {
        const d = month1(ymd(x[dcol])), h = HOLDER(x["bulletin desc"]), k = h === "Total" ? "total" : slug(h); const v = num(x[vcol]); if (v == null) continue;
        ds.add(d); hs.set(k, h); by.set(`${k}|${d}`, k === "total" ? v / CR : v);
      }
      if (!ds.size) throw new Error(`public-finance: 1369 ${p} served nothing`);
      const sorted = [...ds].sort(), dates = monthAxis(sorted[0].slice(0, 7), sorted.at(-1).slice(0, 7)).filter((d) => ["03", "06", "09", "12"].includes(d.slice(5, 7)));
      const series = {};
      for (const [k, h] of hs) {
        if (k === "others") {        // 'Others' included pension funds until December 2021: two definitions, two series
          series.others_to_2021 = { name: "others_incl_pension_pct", label: "Others, including pension funds (to December 2021), per cent", unit: "pct", color: C.g3, data: dates.map((d) => (d <= "2021-12-01" ? r4(by.get(`others|${d}`) ?? null) : null)) };
          series.others = { name: "others_pct", label: "Others (from March 2022, pension funds shown apart), per cent", unit: "pct", color: C.g3, data: dates.map((d) => (d >= "2022-03-01" ? r4(by.get(`others|${d}`) ?? null) : null)) };
          continue;
        }
        series[k] = { name: k === "total" ? "total_inr_crore" : `${k}_pct`, label: k === "total" ? `${what} outstanding, ₹ crore` : `${h}${k === "state_governments" ? " (within others)" : ""}, per cent of the total`, unit: k === "total" ? "inr_crore" : "pct",
          color: k === "commercial_banks" ? C.accent : k === "rbi" ? C.gold : C.g2, data: dates.map((d) => (k === "total" ? r2(by.get(`${k}|${d}`) ?? null) : r4(by.get(`${k}|${d}`) ?? null))) };
      }
      // identity: the holders' shares add up to 100 (state governments are inside 'others')
      dates.forEach((d, i) => { const parts = Object.entries(series).filter(([k, s]) => s.unit === "pct" && k !== "state_governments").map(([, s]) => s.data[i]).filter((v) => v != null); if (parts.length < 5) return; const sum = parts.reduce((a, b) => a + b, 0); if (Math.abs(sum - 100) > 0.6) throw new Error(`public-finance: 1369 ${nm} shares add to ${sum.toFixed(2)} at ${d}`); });
      write(`ownership-${nm}`, { meta: meta({ frequency: "quarterly", unit: "pct", vintage: RAWV["1369"], latestPeriod: dates.at(-1).slice(0, 7),
        coverage: `Who holds India's ${what.toLowerCase()}: banks, insurers, provident and pension funds, mutual funds, foreign investors, the RBI and others, per cent of the total at each quarter-end`,
        note: `RBI Bulletin, Ownership Pattern of Government Securities (DBIE report 1369, provider ${p}; Bulletin table 47), quarter-end, dated on the quarter's last month. Shares in per cent; the total in ₹ crore (DBIE serves rupees). Commercial banks include bank primary dealers. 'Others' included pension funds until December 2021; from March 2022 pension funds are shown apart, so 'others' is two series (the table's note 3). State governments are part of 'others'. Shares add to 100 at every quarter (checked). Provisional, subject to revision.` }),
        dates, series });
    }
  }
  {
    const R = readReport("1371");
    const DEFS = [["DP2", "gsec", "ownership_central_sec_annual_Item Value", "Currency Sk (Central)", "central_data flag", "Central government securities"],
      ["DP1", "sdl", "ownership_state_sec_annual_Item Value", "Currency Sk (State)", "state_data flag", "State government securities"],
      ["DP0", "tbills", "ownership_tbills_annual_Item Value", "Currency Sk (Tbills)", "tbills_flag", "Treasury bills"]];
    const unknownCur = new Set();
    for (const [p, nm, vcol, ccol, fcol, what] of DEFS) {
      // two layouts of the table (flag 0: the old one with commercial banks split by group; flag 1: the current one)
      for (const flag of ["0", "1"]) {
        const by = new Map(), hs = new Map(), ys = new Set();
        for (const x of R[p] ?? []) {
          if (String(x[fcol]) !== flag) continue;
          const cur = String(x[ccol]); const unit = cur === "55" || cur === "31" ? "inr_crore" : cur === "-1" ? "pct" : null;   // 31: the rupee total in the 2025-26 layout, which prints shares and the total only if (!unit) { unknownCur.add(cur); continue; }
          const v = num(x[vcol]); if (v == null) continue;
          const y = String(x.Year).trim(); const fy = `${+y - 1}-${y.slice(2)}`;   // end-March of `Year`
          const h = HOLDER(x["Category of Holder"]), k = (h === "Total" ? "total" : slug(h)) + (unit === "pct" ? "__share" : "");
          ys.add(fy); hs.set(k, { h, unit }); by.set(`${k}|${fy}`, unit === "inr_crore" ? v / CR : v);
        }
        if (!ys.size) continue;
        const fl = [...ys].sort(), dates = fyAxis(fl[0], fl.at(-1));
        const series = {};
        for (const [k, { h, unit }] of hs) series[k] = { name: `${k}_${unit}`, label: `${h === "Total" ? `${what} outstanding` : h}${unit === "pct" ? ", per cent of the total" : ", ₹ crore"}`, unit, group: unit === "pct" ? "Share" : "Amount",
          color: /commercial_banks/.test(k) ? C.accent : /^rbi/.test(k) ? C.gold : C.g2, data: dates.map((d) => { const v = by.get(`${k}|${fyOf(d)}`); return v == null ? null : unit === "pct" ? r4(v) : r2(v); }) };
        const nmx = `ownership-annual-${nm}${flag === "0" ? "-old" : ""}`;
        write(nmx, { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV["1371"], latestPeriod: fyOf(dates.at(-1)),
          coverage: `Who held ${what.toLowerCase()} at the end of each March, ₹ crore and per cent, ${fl[0]} to ${fl.at(-1)}${flag === "0" ? " (the table's old layout, with commercial banks split into SBI, nationalised, other and regional rural banks)" : ""}`,
          note: `RBI, Ownership Pattern of Central and State Government Securities, outstanding on 31 March (DBIE report 1371, provider ${p}; Handbook table, report 553). Dated by the financial year that ends that March. ${flag === "0" ? "The old layout of the table: a different set of holder categories from the current one, never joined to it." : "The current layout of the table (from the 2010-11 Handbook, revised again in 2025-26). Central securities include special securities and Sovereign Gold Bonds; state securities include UDAY bonds; bank PDs sit with commercial banks."} Amounts in ₹ crore (DBIE serves rupees).` }),
          dates, series });
      }
    }
    if (unknownCur.size) console.warn(`public-finance: 1371: rows in an unknown currency code skipped: ${[...unknownCur].join(", ")}`);
  }
  // 2: Treasury bills outstanding by holder, every week (WSS table 13)
  {
    // WSS table 13 (report 2, provider DP1 with the RBI's own holding) and the Bulletin's monthly print of the
    // same table (report 29), which adds 14-day intermediate bills and the weeks of early 2006. Where both
    // print a week, they must agree to the rupee (checked).
    const rows = readReport("2").DP1, rows29 = readReport("29").DP0;
    const INS = { "91 Day (Auction)": "t91", "182 Day (Auction)": "t182", "364 Day (Auction)": "t364", CMB: "cmb", "14 Day (Intermediate)": "t14" };
    const INL = { t91: "91-day Treasury bills", t182: "182-day Treasury bills", t364: "364-day Treasury bills", cmb: "Cash management bills", t14: "14-day intermediate Treasury bills" };
    const by = new Map(), hs = new Map(), ds = new Set(); let agree = 0, clash = 0; const impossible = [], voidWeek = new Set();
    for (const [src, list] of [["2", rows], ["29", rows29]]) for (const x of list) {
      const i = INS[x.Instruments]; if (!i) { console.warn(`public-finance: ${src}: unknown instrument ${x.Instruments}`); continue; }
      const d = ymd(x.Date), h = slug(x.Holders);
      const v = num(x["Face Value (in Rs. Crore)"]); if (v == null) continue;
      ds.add(d); hs.set(h, clean(x.Holders));
      const key = `${i}|${h}|${d}`;
      if (by.has(key)) { if (Math.abs(by.get(key) - v / CR) < 1e-6) agree++; else clash++; continue; }
      if (v < 0) { impossible.push(`${INL[i] ?? i}, ${clean(x.Holders)}, ${d}: ${r2(v / CR)}`); voidWeek.add(`${i}|${d}`); continue; }   // a holding cannot be negative: left empty, the printed figure recorded
      by.set(key, v / CR);
    }
    if (clash) throw new Error(`public-finance: reports 2 and 29 disagree on ${clash} Treasury bill holdings`);
    console.log(`public-finance: Treasury bills: reports 2 and 29 agree on ${agree} holdings`);
    const dates = [...ds].sort();
    const series = {};
    for (const i of Object.values(INS)) {
      for (const [h, hl] of hs) if ([...by.keys()].some((k) => k.startsWith(`${i}|${h}|`))) series[`${i}__${h}`] = { name: `${i}_${h}_inr_crore`, label: `${INL[i]} held by ${hl === "Others" ? "others" : hl.replace(/^(Banks|Primary Dealers|State Governments)$/, (m) => m.toLowerCase())}, ₹ crore`, unit: "inr_crore", group: INL[i], color: C.g2,
        data: dates.map((d) => r2(by.get(`${i}|${h}|${d}`) ?? null)) };
      series[`${i}__total`] = { name: `${i}_total_inr_crore`, label: `${INL[i]} outstanding, all holders, ₹ crore (computed)`, unit: "inr_crore", group: INL[i], color: C.accent,
        derived: true, derivedNote: "The holders the RBI's table prints for the week, added up by Measure of India.",
        data: dates.map((d) => { if (voidWeek.has(`${i}|${d}`)) return null; const vs = [...hs.keys()].map((h) => by.get(`${i}|${h}|${d}`)); return vs.some((v) => v != null) ? r2(vs.reduce((a, v) => a + (v ?? 0), 0)) : null; }) };
    }
    write("tbills", { meta: meta({ frequency: "weekly", unit: "inr_crore", vintage: RAWV["2"], latestPeriod: dates.at(-1).slice(0, 7),
      coverage: "The Centre's short-term borrowing: 91, 182 and 364-day Treasury bills and cash management bills outstanding, and who holds them, every Friday since May 2006",
      note: `RBI Weekly Statistical Supplement table 13, Government of India Treasury Bills Outstanding (DBIE report 2, provider DP1), with the Bulletin's print of the same table (report 29), which adds 14-day intermediate bills (bought only by state governments, to park surplus cash) and the weeks of January to May 2006; the two agree on all ${agree} holdings both print. The RBI's own holding is listed in the table but never printed. Face value, close of business on Friday. Banks, primary dealers and state governments are holdings in SGL and CSGL accounts with the RBI (the table's note 2). Totals add the holders the table prints for that week (computed); an empty cell is not printed and is not counted.${impossible.length ? ` A holding printed below zero cannot be true and is left empty, with no total that week: ${impossible.join("; ")}.` : ""}` }),
      dates, series });
  }
  // 1362: maturity of the Centre's dated securities
  {
    const rows = readReport("1362").DP0;
    const by = new Map(), its = new Map(), ys = new Set();
    for (const x of rows) { const y = String(x.Year).trim(); if (!isFY(y)) continue; const v = num(x["Amount (in Rs. Crore)"]); const k = slug(x["Hbs Item Description"]); its.set(k, clean(x["Hbs Item Description"])); if (v == null) continue; ys.add(y); by.set(`${k}|${y}`, v / CR); }
    const fl = [...ys].sort(), dates = fyAxis(fl[0], fl.at(-1));
    const L = { under_5_years: "Maturing within 5 years", between_5_and_10_years: "Maturing in 5 to 10 years", over_10_years: "Maturing after 10 years", iinss_c: "Inflation Index National Savings Scheme (cumulative)", undated: "Undated", total_amount: "All dated securities" };
    const series = Object.fromEntries([...its].map(([k, l]) => [k, { name: `${k}_inr_crore`, label: `${L[k] ?? l}, ₹ crore`, unit: "inr_crore", color: k === "total_amount" ? C.accent : C.g2, data: dates.map((d) => r2(by.get(`${k}|${fyOf(d)}`) ?? null)) }]));
    write("maturity", { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV["1362"], latestPeriod: fl.at(-1),
      coverage: "When the Centre's dated securities fall due: outstanding at each end-March, by years left to maturity, ₹ crore",
      note: "RBI, Maturity Pattern of Government of India Rupee Loans (DBIE report 1362; Handbook report 106; Public Debt Statistics report 313). Outstanding at the end of each financial year, excluding special securities and compensation bonds (the table's note). IINSS-C: Inflation Index National Savings Scheme, cumulative." }),
      dates, series });
  }

  /* =================== 5. small savings: the household's lender to the government =================== */
  {
    const R = readReport("581");
    const SCHEME = (s) => clean(String(s).replace(/^[\d.]+\s+/, "")).replace(/\bYojna\b/, "Yojana").replace(/Saving Bank/, "Savings Bank");
    const mk = (rows, vcol, dateOf, freq) => {
      const by = new Map(), sch = new Map(), ds = new Set();
      for (const x of rows) {
        const lvl = String(x["Sav Scheme Level2"]); const what = /^Receipts/.test(lvl) ? "receipts" : /^Outstanding/.test(lvl) ? "outstanding" : null; if (!what) continue;
        const name = SCHEME(x["Sav Scheme Description"]), k = slug(name); sch.set(k, { name, order: +x["Sav Scheme Display Order"] || 99 });
        const v = num(x[vcol]); if (v == null) continue;
        const d = dateOf(x); ds.add(d); by.set(`${k}|${what}|${d}`, v / CR);
      }
      return { by, sch, ds };
    };
    // monthly (DP1): receipts in the month, outstanding at month-end
    {
      const { by, sch, ds } = mk(R.DP1, "Sav Scheme Value_Monthly", (x) => month1(ymd(x["Time Date"])), "monthly");
      const sorted = [...ds].sort(), dates = monthAxis(sorted[0].slice(0, 7), sorted.at(-1).slice(0, 7));
      const series = {};
      for (const [k, { name, order }] of [...sch].sort((a, b) => a[1].order - b[1].order)) {
        // receipts are gross to March 2017 and net of withdrawals from April 2017 (the table's note): two series
        series[`${k}__receipts_gross`] = { name: `${k}_receipts_gross_inr_crore`, label: `${name}: money put in during the month (gross, to March 2017), ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => (d < "2017-04-01" ? r2(by.get(`${k}|receipts|${d}`) ?? null) : null)) };
        series[`${k}__receipts_net`] = { name: `${k}_receipts_net_inr_crore`, label: `${name}: money put in during the month, net of withdrawals (from April 2017), ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => (d >= "2017-04-01" ? r2(by.get(`${k}|receipts|${d}`) ?? null) : null)) };
        series[`${k}__outstanding`] = { name: `${k}_outstanding_inr_crore`, label: `${name}: outstanding at the end of the month, ₹ crore`, unit: "inr_crore", group: name, color: k === "total" ? C.accent : C.g2, data: dates.map((d) => r2(by.get(`${k}|outstanding|${d}`) ?? null)) };
      }
      // the table's grand total leaves out Sukanya Samriddhi and PM CARES in some months: find and disclose them
      const g = (k, i) => series[k]?.data[i] ?? 0;
      const leftOut = dates.filter((d, i) => { const t = series.total__outstanding?.data[i]; if (t == null) return false; const diff = g("total_deposits__outstanding", i) + g("total_certificates__outstanding", i) + g("public_provident_fund__outstanding", i) - t; const ss = g("sukanya_samriddhi_yojana__outstanding", i) + g("pm_care_for_children__outstanding", i); return ss > 0 && Math.abs(diff - ss) <= 3 && Math.abs(diff) > 60; }).map((d) => d.slice(0, 7));
      if (leftOut.length) series.total__outstanding.note = `In ${leftOut.join(", ")} the RBI's total leaves out the Sukanya Samriddhi and PM CARES deposits that its own deposit total includes; printed as published.`;
      write("small-savings", { meta: meta({ frequency: "monthly", unit: "inr_crore", vintage: RAWV["581"], latestPeriod: dates.at(-1).slice(0, 7), totalLeavesOut: leftOut,
        coverage: "Small savings scheme by scheme: Post Office deposits, PPF, Sukanya Samriddhi, NSC, Kisan Vikas Patra, senior citizens' and monthly income schemes; money put in and outstanding, every month since April 1992",
        note: "RBI Bulletin, Small Savings (DBIE report 581, provider DP1; Public Debt Statistics report 320), from the Accountant General, Posts and Telegraphs. Receipts are gross to March 2017 and net of withdrawals from April 2017 (the table's note): a different measure, so two series, never joined. Outstanding is the stock at the month's end." }),
        dates, series });
    }
    // annual (DP6): end-March since 1970-71
    {
      const { by, sch, ds } = mk(R.DP6, "Sav Scheme Value_Anuual", (x) => fyStart(String(x["Year (Bulletin)"]).trim()), "annual");
      const sorted = [...ds].sort(), dates = fyAxis(fyOf(sorted[0]), fyOf(sorted.at(-1)));
      const series = {};
      for (const [k, { name, order }] of [...sch].sort((a, b) => a[1].order - b[1].order)) {
        series[`${k}__receipts_gross`] = { name: `${k}_receipts_gross_inr_crore`, label: `${name}: money put in during the year (gross, to 2016-17), ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => (d < "2017-04-01" ? r2(by.get(`${k}|receipts|${d}`) ?? null) : null)) };
        series[`${k}__receipts_net`] = { name: `${k}_receipts_net_inr_crore`, label: `${name}: money put in during the year, net of withdrawals (from 2017-18), ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => (d >= "2017-04-01" ? r2(by.get(`${k}|receipts|${d}`) ?? null) : null)) };
        series[`${k}__outstanding`] = { name: `${k}_outstanding_inr_crore`, label: `${name}: outstanding at the end of March, ₹ crore`, unit: "inr_crore", group: name, color: k === "total" ? C.accent : C.g2, data: dates.map((d) => r2(by.get(`${k}|outstanding|${d}`) ?? null)) };
      }
      write("small-savings-annual", { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV["581"], latestPeriod: fyOf(dates.at(-1)),
        coverage: "Small savings scheme by scheme, financial year by financial year since 1970-71: money put in and outstanding at the end of March",
        note: "RBI, Small Savings (DBIE report 581, provider DP6; Handbook report 231, Bulletin report 62). Receipts are gross to 2016-17 and net of withdrawals from 2017-18: two series, never joined." }),
        dates, series });
    }
  }
  // 600: the Handbook's printing of the annual totals (a separate printing: it differs from 581 in some years)
  {
    const R = readReport("600");
    const by = new Map(), its = new Map(), ys = new Set();
    for (const x of [...(R.DP0 ?? []), ...(R.DP1 ?? [])]) {
      const y = String(x["Year (Bulletin)"]).trim(); if (!isFY(y)) continue;
      const what = /^Receipt/.test(x["Sav Scheme Level2"]) ? "receipts" : /^Outstanding/.test(x["Sav Scheme Level2"]) ? "outstanding" : null; if (!what) continue;
      const name = clean(x["Saving Scheme Annual"]); const k = slug(name); its.set(k, sentence(name));
      const v = num(x["Sav Scheme Value Annual"]); if (v == null) continue;
      ys.add(y); by.set(`${k}|${what}|${y}`, v / CR);
    }
    const fl = [...ys].sort(), dates = fyAxis(fl[0], fl.at(-1));
    const series = {};
    for (const [k, name] of its) {
      series[`${k}__receipts_gross`] = { name: `${k}_receipts_gross_inr_crore`, label: `${name}: money put in during the year (gross, to 2016-17), ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => (d < "2017-04-01" ? r2(by.get(`${k}|receipts|${fyOf(d)}`) ?? null) : null)) };
      series[`${k}__receipts_net`] = { name: `${k}_receipts_net_inr_crore`, label: `${name}: money put in during the year, net of withdrawals (from 2017-18), ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => (d >= "2017-04-01" ? r2(by.get(`${k}|receipts|${fyOf(d)}`) ?? null) : null)) };
      series[`${k}__outstanding`] = { name: `${k}_outstanding_inr_crore`, label: `${name}: outstanding at the end of March, ₹ crore`, unit: "inr_crore", group: name, color: C.g2, data: dates.map((d) => r2(by.get(`${k}|outstanding|${fyOf(d)}`) ?? null)) };
    }
    write("small-savings-handbook", { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV["600"], latestPeriod: fl.at(-1),
      coverage: "Small savings in total, deposits, certificates and the Public Provident Fund, money put in and outstanding at the end of March, as the RBI's Handbook prints them, since 1970-71",
      note: "RBI, Small Savings (DBIE report 600, annual; Handbook report 231). A separate printing of the totals in report 581: it reaches years 581 does not and differs from it in some years (by up to a few per cent: neither is corrected to the other). Receipts are gross to 2016-17 and net of withdrawals from 2017-18: two series." }),
      dates, series });
  }
  // 356: the schemes' interest rates, as each quarterly reset left them
  {
    const R = readReport("356");
    const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const sinceOf = (s) => { const m = /Since (\w{3})\.?\s*(\d+),\s*(\d{4})/.exec(String(s)); return m ? `${m[3]}-${String(MON[m[1]]).padStart(2, "0")}-${String(+m[2]).padStart(2, "0")}` : null; };
    const by = new Map(), sch = new Map(), ds = new Set();
    for (const x of R.DP4 ?? []) {
      const d = sinceOf(x["Interest Rate Since Description"]); if (!d) continue;
      const name = clean([x["Derived Table Dim Small Savings Schemes.Scheme Hierarchy Level1"], x["Derived Table Dim Small Savings Schemes.Scheme Hierarchy Level2"]].filter(Boolean).join(" ")).replace(/\*$/, "");
      const k = slug(name); sch.set(k, { name, active: x["Derived Table Dim Small Savings Schemes.Active Flag"] === "Y" });
      const v = num(x["Interest Rate"]); if (v == null) continue;
      ds.add(d); by.set(`${k}|${d}`, v);
    }
    const dates = [...ds].sort();
    const series = Object.fromEntries([...sch].map(([k, { name }]) => [k, { name: `${k}_pct_per_annum`, label: `${name}: interest rate, per cent a year`, unit: "pct_per_annum", color: /public_provident/.test(k) ? C.accent : C.g2, data: dates.map((d) => by.get(`${k}|${d}`) ?? null) }]));
    write("small-savings-rates", { meta: meta({ frequency: "irregular", unit: "pct_per_annum", vintage: RAWV["356"], latestPeriod: dates.at(-1).slice(0, 7),
      coverage: "What the government pays savers: the interest rate on each small savings scheme at each reset the RBI's table lists, April 2016 on",
      note: "RBI, Small Savings Schemes (DBIE report 356, provider 'rate'; Handbook report 746). Each date is a reset listed in the table ('Since Jul.1, 2026'); the rate holds until the next date shown. Rates have been set each quarter since April 2016, linked to government bond yields. The table's outstanding amounts by scheme (end-March 2025) are in the small savings bundles." }),
      dates, series });
  }

  /* =================== 6. the Plan (discontinued with the Planning Commission) =================== */
  for (const [id, nm, title, cov] of [["748", "plan-outlay", "Public Sector Plan Outlay at current prices (discontinued)", "Plan spending by the public sector, by head of development, ₹ crore, to 2016-17"],
    ["608", "plan-financing", "Financing of the Public Sector Plan (discontinued)", "How the public sector's Plan was paid for, ₹ crore, to 2016-17"]]) {
    const rows = readReport(id).DP0;
    const by = new Map(), its = new Map(), ys = new Set();
    for (const x of rows) { const y = String(x.Year).trim(); if (!isFY(y)) continue; const raw = String(x["Plan outlay and Financing of Plan"]); const l = clean(raw.replace(/\s*\((?:Public Sector Plan Outlay at current prices|Financing of Public Sector Plan)\)/, "").replace(/\(11\+12\+13\)\s*/, "").replace(/Balnace/, "Balance")); const k = slug(l); its.set(k, sentence(l)); const v = num(x.Value_actuals); if (v == null) continue; ys.add(y); by.set(`${k}|${y}`, v / CR); }
    const fl = [...ys].sort(), dates = fyAxis(fl[0], fl.at(-1));
    const series = Object.fromEntries([...its].map(([k, l]) => [k, { name: `${k}_inr_crore`, label: `${l}, ₹ crore`, unit: "inr_crore", color: /^total/.test(k) ? C.accent : C.g2, data: dates.map((d) => r2(by.get(`${k}|${fyOf(d)}`) ?? null)) }]));
    write(nm, { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV[id], latestPeriod: fl.at(-1), coverage: cov,
      note: `RBI, ${title} (DBIE report ${id}). The Five-Year Plans ended with the Twelfth Plan in March 2017 and the RBI stopped the table there. Figures as the table carries them, stage by stage as the Planning Commission published them.` }),
      dates, series });
  }

  /* =================== 7. the Bulletin's combined account: budget, revised and actual, each year =================== */
  {
    const rows = readReport("36").DP0;
    const VER = { "Budget Estimates": "be", "Revised Estimates": "re", Actual: "actual" };
    const VL = { be: "budget estimate", re: "revised estimate", actual: "accounts" };
    const by = new Map(), its = new Map(), ys = new Set();
    for (const x of rows) {
      const ver = VER[x["Version Desc"]]; const y = String(x["Fiscal Year"]).trim(); if (!ver || !isFY(y)) continue;
      const raw = String(x["Item Description (Bulletin)"]); const code = raw.match(/^([\dA-B.]+)\s/)?.[1] ?? raw;
      const lab = clean(raw.replace(/^[\dA-B.]+\s+/, "").replace(/\s*\[.*\]$/, "")); const pct = /per cent of GDP/i.test(lab);
      const k = slug(`${code.replace(/\./g, "_")} ${lab.replace(/as per cent of GDP/i, "")}`);
      its.set(k, { lab, pct, code, order: +x["Sequence (Bulletin)"] || 99 });
      const v = num(x.Amount); if (v == null) continue; ys.add(y);
      by.set(`${k}|${ver}|${y}`, pct ? v : v / CR);
    }
    const fl = [...ys].sort();
    const mkS = (fys) => { const s = {}; for (const [k, { lab, pct, order }] of [...its].sort((a, b) => a[1].order - b[1].order)) for (const v of ["actual", "re", "be"]) s[`${k}__${v}`] = { name: `${k}_${v}_${pct ? "pct_gdp" : "inr_crore"}`, label: `${lab}: ${VL[v]}${pct ? "" : ", ₹ crore"}`, unit: pct ? "pct_gdp" : "inr_crore", stage: v, group: lab, color: v === "actual" ? C.accent : v === "re" ? C.gold : C.g1, data: fys.map((fy) => { const x = by.get(`${k}|${v}|${fy}`); return x == null ? null : pct ? r4(x) : r2(x); }) }; return s; };
    const amounts = Object.fromEntries(Object.entries(mkS(fl)).filter(([, s]) => s.unit === "inr_crore"));
    write("combined-bulletin", { meta: meta({ frequency: "annual", unit: "inr_crore", vintage: RAWV["36"], latestPeriod: fl.at(-1),
      coverage: "The general government's account as the RBI Bulletin prints it: receipts, spending, the deficit and how it is financed, with the budget estimate, revised estimate and accounts of each year side by side, ₹ crore",
      note: "RBI Bulletin, Combined Receipts and Disbursements of the Central and State Governments (DBIE report 36). Unlike the Handbook tables, this one keeps each year's budget estimate, revised estimate and accounts as separate figures: three series per item, never joined. Totals exclude National Calamity Contingency Fund spending (the table's note 4)." }),
      dates: fl.map(fyStart), series: amounts });
    // the per-cent-of-GDP rows: one bundle per GDP base, as for the Handbook tables
    for (const g of GDPB) {
      const fys = fl.filter((f) => f >= g.from && (g.to == null || f <= g.to)); if (!fys.length) continue;
      const pcts = Object.fromEntries(Object.entries(mkS(fys)).filter(([, s]) => s.unit === "pct_gdp"));
      write(`combined-bulletin-gdp-${g.key}`, { meta: meta({ frequency: "annual", unit: "pct_gdp", base: g.base, vintage: RAWV["36"], latestPeriod: fys.at(-1),
        coverage: `The general government's receipts, spending, taxes and deficit as per cent of GDP, budget, revised and accounts, ${fys[0]} to ${fys.at(-1)}, over ${g.label}`,
        note: `RBI Bulletin, Combined Receipts and Disbursements of the Central and State Governments (DBIE report 36), the per-cent-of-GDP rows, over ${g.label} (the table's note 1: the 2011-12 base from 2011-12). Each stage its own series.` }),
        dates: fys.map(fyStart), series: pcts });
    }
  }

  /* =================== 8. CAS: the same tables through RBI's data query service, checked equal =================== */
  {
    const q = databankQuery(db, "rbi_dbie_cas_money", "select distinct dsd_code, series_label, observation_date, value from {table} where dsd_code in ('FICG_GDP_RN','FISG_GDP_RN','CG_DEFM_RN') order by 1, 2, 3");
    writeRaw(root, `data/raw/${SLUG}-cas.json`, { vintage, note: "RBI DBIE CAS (Data Query) government-finance series, from the Data Bank's parsed rbi_dbie_cas_money: the same tables as DBIE webi reports 355, 454 and 349, read to check them.", provenance: q.provenance, rows: q.rows });
    const cmp = { FICG_GDP_RN: ["centre-gdp", 0.011], FISG_GDP_RN: ["allstates-gdp", 0.011] };
    const report = {};
    for (const [dsd, [bn, tol]] of Object.entries(cmp)) {
      const X = T[bn]; const byLab = new Map([...X.items.values()].map((it) => [slug(it.label), it]));
      const alias = { direct_gross_tax: "gross_direct_tax", indirect_gross_tax: "gross_indirect_tax", gross_tax: "total_gross_tax", expenditure: "total_expenditure", net_rbi_credit_to_center: "net_rbi_credit_to_centre", revenue_receipts_tax_receipts_revenue_receipts: "tax_receipts", revenue_receipts_non_tax_receipts_revenue_receipts: "non_tax_receipts" };
      let n = 0, bad = 0; const miss = new Set(), worst = [];
      for (const r of q.rows.filter((x) => x.dsd_code === dsd)) {
        const k = alias[slug(r.series_label)] ?? slug(r.series_label); const it = byLab.get(k); if (!it) { miss.add(r.series_label); continue; }
        const fy = fyOf(r.observation_date.slice(0, 10)); const ours = it.byFY.get(fy)?.v; if (ours == null || r.value == null) continue;
        n++; if (Math.abs(ours - r.value) > tol) { bad++; if (worst.length < 5) worst.push(`${fy} ${r.series_label}: CAS ${r.value} vs ${r4(ours)}`); }
      }
      report[dsd] = { compared: n, differ: bad, unmatched: [...miss], worst };
      if (!n || bad / n > 0.02) throw new Error(`public-finance: CAS ${dsd} disagrees with the webi table (${bad}/${n}: ${worst.join("; ")}; unmatched ${[...miss].join(", ")})`);
    }
    { // the monthly deficit
      const G = T.gfdMonthly; let n = 0, bad = 0;
      for (const r of q.rows.filter((x) => x.dsd_code === "CG_DEFM_RN")) { const i = G.dates.indexOf(month1(r.observation_date.slice(0, 10))); if (i < 0 || G.month[i] == null || r.value == null) continue; n++; if (Math.abs(G.month[i] - r.value / CR) > 1) bad++; }
      report.CG_DEFM_RN = { compared: n, differ: bad };
      if (!n || bad / n > 0.02) throw new Error(`public-finance: CAS CG_DEFM_RN disagrees with report 349 (${bad}/${n})`);
    }
    console.log(`public-finance: CAS checks ${JSON.stringify(report)}`);
    T.cas = report;
  }

  /* =================== 9. two more GDP rulers, computed here =================== */
  {
    const B = (s) => JSON.parse(fs.readFileSync(path.join(root, "data/series", s + ".json"), "utf8"));
    const back = B("gdp-back-levels"), cur = B("gdp-annual-levels"), g22 = B("gdp-2022-annual-levels");
    const gdpAt = (b) => new Map(b.dates.map((d, i) => [fyOf(d), b.series.gdp_current.data[i]]));
    const GB = gdpAt(back), GC = gdpAt(cur), G22 = gdpAt(g22);
    const ITEMS = [["centre-deficits", "gross_fiscal_deficit", "Centre: gross fiscal deficit"], ["centre-deficits", "revenue_deficit", "Centre: revenue deficit"], ["centre-deficits", "gross_primary_deficit", "Centre: primary deficit"],
      ["centre-expenditure", "interest_payments", "Centre: interest payments"], ["centre-expenditure", "total_expenditure", "Centre: total expenditure"], ["centre-expenditure", "capital_expenditure", "Centre: capital expenditure"],
      ["centre-receipts", "tax_revenue_net", "Centre: tax revenue, net of the states' share"], ["centre-receipts", "revenue_receipts", "Centre: revenue receipts"], ["centre-liabilities", "total_liabilities", "Centre: outstanding liabilities"],
      ["allstates-deficits", "gross_fiscal_deficit", "States: gross fiscal deficit"], ["allstates-deficits", "revenue_deficit", "States: revenue deficit"], ["allstates-liabilities", "total_liabilities_of_the_states", "States: outstanding liabilities"],
      ["combined-deficits", "gross_fiscal_deficit", "Centre and states: gross fiscal deficit"], ["combined-liabilities", "combined_total_liabilities_of_centre_and_states", "Centre and states: outstanding liabilities"]];
    const pick = (bn, key) => { const X = T[bn]; const it = [...X.items.values()].find((i) => X.keyOf.get(i.code) === key); if (!it) throw new Error(`public-finance: ratios: no ${key} in ${bn} (${[...X.keyOf.values()].join(", ")})`); return { it, X }; };
    // check first: on the 2011-12 series our own division reproduces the RBI's published ratio for the Centre's GFD
    {
      const { it } = pick("centre-deficits", "gross_fiscal_deficit"); const P = T["centre-gdp"]; const pub = [...P.items.values()].find((i) => P.keyOf.get(i.code) === "gross_fiscal_deficit");
      let worst = 0, n = 0; for (const [fy, o] of it.byFY) { const g = GC.get(fy), p = pub.byFY.get(fy)?.v; if (g == null || p == null || fy >= T["centre-deficits"].beFY) continue; n++; worst = Math.max(worst, Math.abs((100 * o.v) / g - p)); }
      if (!n || worst > 0.02) throw new Error(`public-finance: the RBI's GFD ratio is not GFD over the 2011-12 GDP series (worst ${worst})`);
      console.log(`public-finance: RBI's GFD/GDP = GFD over MoSPI's 2011-12 series in ${n} years (worst ${r4(worst)} pt)`);
    }
    const mkR = (G, fys, stageCut, gdpName) => { const s = {}; ITEMS.forEach(([bn, key, lab], j) => { const { it, X } = pick(bn, key); const k = `${X.t.scope}_${key.replace(/_of_the_states|_of_centre_and_states|^combined_/g, "").replace(/total_liabilities.*/, "liabilities")}`;
      s[k] = { name: `${k}_pct_gdp`, label: `${lab}, per cent of GDP (computed)`, unit: "pct_gdp", group: X.t.scope === "centre" ? "Centre" : X.t.scope === "states" ? "States" : "Centre and states", color: j === 0 ? C.accent : C.g2,
        data: fys.map((fy) => { const g = G.get(fy), o = it.byFY.get(fy); if (g == null || o == null || (X.reFY && fy >= X.reFY && !stageCut)) return null; if (X.reFY && fy > X.reFY) return null; return r4((100 * o.v) / g); }) };
      if (stageCut) s[k].note = `The last year may be a revised estimate (Centre ${T["centre-deficits"].reFY}, states and combined ${T["allstates-deficits"].reFY}).`;
      s[k].derived = true; s[k].derivedNote = `${lab.replace(/^(Centre|States|Centre and states): /, (m, g) => (g === "Centre" ? "The Centre's " : g === "States" ? "The states' " : "The Centre's and states' "))} as the RBI prints it in rupees (DBIE report ${X.t.id}), divided by MoSPI's GDP at current prices, ${gdpName}; computed by Measure of India, not an RBI ratio.`; }); return s; };
    const fb = [...GB.keys()].filter((fy) => fy >= "1970-71" && fy <= "2010-11").sort();
    write("ratios-backcast", { meta: meta({ source: "Computed by Measure of India from RBI DBIE (amounts) and MoSPI NAS (GDP)", frequency: "annual", unit: "pct_gdp", base: "Measure of India ratio over the NSO back series of 2011-12-base GDP", vintage, latestPeriod: fb.at(-1),
      coverage: "Deficits, interest, taxes, spending and debt as a share of GDP on one ruler, 1970-71 to 2010-11: the RBI's rupee figures over MoSPI's back-cast of the 2011-12 GDP series",
      note: "Computed here: the accounts in the RBI's rupee tables divided by GDP at current market prices from the NSO's back series on the 2011-12 base (gdp-back-levels). Arithmetic by Measure of India, not an RBI ratio and not an agency link: its own ruler, never joined to the RBI's printed ratios. From 2011-12 the RBI's published ratios are on this same series (checked: our division reproduces its GFD ratio), so this bundle stops at 2010-11. Different from the RBI's published ratios for these years, which divide by the GDP series of the time (1999-2000 and 2004-05 bases)." }),
      dates: fb.map(fyStart), series: mkR(GB, fb, false, "the NSO's back series on the 2011-12 base") });
    const f22 = [...G22.keys()].sort();
    const s22 = mkR(G22, f22, true, "2022-23 series");
    for (const s of Object.values(s22)) s.data = s.data.map((v, i) => v);   // the revised-estimate year is kept and named in the note
    write("ratios-2022", { meta: meta({ source: "Computed by Measure of India from RBI DBIE (amounts) and MoSPI NAS (GDP)", frequency: "annual", unit: "pct_gdp", base: "GDP 2022-23 series", vintage: g22.meta.vintage > vintage ? vintage : g22.meta.vintage, latestPeriod: f22.at(-1),
      coverage: "The same ratios over the new GDP series (2022-23 base), 2022-23 on: what the deficit and debt look like against the larger or smaller economy the new series measures",
      note: `Computed here: the RBI's rupee figures over GDP at current market prices on the 2022-23 base (gdp-2022-annual-levels). The RBI still divides by the 2011-12 series. The Centre's ${T["centre-deficits"].reFY} figure is its revised estimate and the states' ${T["allstates-deficits"].reFY} theirs, over the NSO's estimate of that year's GDP; budget estimates are left out (they assume a GDP the NSO has not measured).` }),
      dates: f22.map(fyStart), series: s22 });
  }

  return { written, T, crossLog };
}

/* =================== the catalogue: everything the RBI publishes on government finance =================== */
// Scope, by rule: every report in DBIE's four government-finance menus; every report elsewhere in DBIE
// (Handbook, Bulletin, Weekly Statistical Supplement, government securities market) that carries the
// same name as one of them; and the Bulletin and debt tables the guide reads (EXTRA). A report the
// adapter reads is listed item by item (and every other data provider of it as one item); any other
// report in scope is listed whole. CAS series are listed one by one.
const MENUS = ["Central Govt. Finance", "State Govt. Finance", "Central & State Govt. Finance (Combined)", "Public Debt Statistics"];
const EXTRA = ["2", "29", "35", "36", "37", "49", "63", "553", "1362", "1369", "1371", "559", "1213", "576", "727", "3"];
// what identifies an item in each report the adapter reads: [provider, columns]
const ITEMS = {
  "713": [["DP0", ["Budget Item"]]], "655": [["DP0", ["Item Sk", "Budget Item"]]], "353": [["DP0", ["Item Sk", "Item Description"]]], "351": [["DP0", ["Budget Item"]]],
  "352": [["DP0", ["Budget Item"]]], "656": [["DP0", ["Cmb Item Hierarchy Level 1", "Budget Item"]]], "1399": [["DP0", ["Item Description"]]], "355": [["DP0", ["Items"]]],
  "350": [["DP0", ["Item Sk", "Budget Item"]]], "451": [["DP0", ["Budget Item"]]], "709": [["DP0", ["Budget Item"]]], "677": [["DP0", ["Budget Item"]]], "453": [["DP0", ["Budget Item"]]],
  "692": [["DP0", ["Old Item Sk", "Item Description"]]], "452": [["DP0", ["Budget Item"]]], "454": [["DP1", ["Items"]]], "346": [["DP0", ["Budget Item"]]], "347": [["DP0", ["Deficit Description"]]],
  "339": [["DP0", ["Budget Item"]]], "342": [["DP0", ["Items"]]], "340": [["DP0", ["State Central Type"]]], "673": [["DP0", ["Item Sk", "Budget Item"]]], "721": [["DP0", ["State Central Type"]]],
  "349": [["DP0", []]], "49": [["DP0", ["Budget Item"]], ["DP4", ["Budget Item"]]], "63": [["DP0", ["State Name", "Item Hierarchy Level1", "Item Hierarchy Level2"]]], "37": [["DP0", ["State Name", "Item Name"]]],
  "1369": [["DP0", ["bulletin desc"]], ["DP1", ["bulletin desc"]], ["DP2", ["bulletin desc"]]],
  "1371": [["DP0", ["tbills_flag", "Category of Holder", "Currency Sk (Tbills)"]], ["DP1", ["state_data flag", "Category of Holder", "Currency Sk (State)"]], ["DP2", ["central_data flag", "Category of Holder", "Currency Sk (Central)"]]],
  "2": [["DP1", ["Instruments", "Holders"]]], "1362": [["DP0", ["Hbs Item Description"]]], "581": [["DP1", ["Sav Scheme Description", "Sav Scheme Level2"]], ["DP6", ["Sav Scheme Description", "Sav Scheme Level2"]]],
  "356": [["DP4", ["Derived Table Dim Small Savings Schemes.Name Of Scheme"]], ["DP3", ["Derived Table Dim Small Savings Schemes.Name Of Scheme", "Dim Small Savings Schemes.Name Of Scheme"]]],
  "748": [["DP0", ["Plan outlay and Financing of Plan"]]], "608": [["DP0", ["Plan outlay and Financing of Plan"]]], "36": [["DP0", ["Item Description (Bulletin)"]]],
};
const norm = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "").replace(/\s*\((discontinued|as percentage (to|of) gdp)\)\s*/g, " ").replace(/\bthe\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export async function buildCatalogue(cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const inv = parseCsv(fs.readFileSync(path.join(db, "data/derived/rbi_dbie_webi_inventory.csv"), "utf8"), ",");
  const head = inv[0]; const rows = inv.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  const core = rows.filter((r) => MENUS.includes(r.menu));
  const names = new Set(core.map((r) => norm(r.report_name)));
  const scope = new Map();
  for (const r of rows) if (MENUS.includes(r.menu) || names.has(norm(r.report_name)) || EXTRA.includes(r.report_id)) scope.set(r.report_id, r);
  const items = [];
  for (const [id, r] of [...scope].sort((a, b) => +a[0] - +b[0])) {
    if (!ITEMS[id]) { items.push({ id: `dbie:${id}`, label: `${r.report_name} (${r.menu || "DBIE"}, report ${id})`, dims: { report: id, menu: r.menu, status: r.last_status } }); continue; }
    let provs = []; try { provs = dbieProviders(db, id); } catch { /* not mirrored */ }
    const spec = new Map(ITEMS[id]);
    for (const p of provs) {
      if (!spec.has(p.id)) { items.push({ id: `dbie:${id}:${idPart(p.id)}`, label: `${r.report_name}, data provider "${p.name}" (${p.rows ?? "?"} rows)`, dims: { report: id, provider: p.id } }); continue; }
      const cols = spec.get(p.id);
      const seen = new Set();
      for (const x of dbieProvider(db, id, p.id).rows) {
        const u = x["Unit Desc"] ?? x["Unit Description"]; if (u != null && u !== "" && u !== "ACTUALS") continue;
        const parts = cols.map((c) => idPart(String(x[c] ?? "").replace(/^[A-Z]{2,3}\.[\d.]+\)\s*/, "")).slice(0, 48).replace(/-+$/, ""));
        const iid = ["dbie", id, idPart(p.id), ...parts].filter((s) => s !== "").join(":");
        if (seen.has(iid)) continue; seen.add(iid);
        items.push({ id: iid, label: `${r.report_name}: ${cols.map((c) => clean(x[c])).filter(Boolean).join(", ") || "the series"}`, dims: { report: id, provider: p.id } });
      }
    }
  }
  // CAS government-finance series in the Data Bank's parsed CAS mirror
  const q = databankQuery(db, "rbi_dbie_cas_money", "select distinct dsd_code, element_label, series_label from {table} where domain_group = 'government_finance' order by 1, 3");
  for (const x of q.rows) items.push({ id: `cas:${idPart(x.dsd_code)}:${idPart(x.series_label || "series")}`, label: `${x.element_label}: ${x.series_label || "the series"} (DBIE CAS ${x.dsd_code})`, dims: { dsd: x.dsd_code } });
  items.push({ id: "parsed:rbi_sdl_auctions", label: "State development loan auctions, every state, every auction (the Data Bank's parsed rbi_sdl_auctions)", dims: { dataset: "rbi_sdl_auctions" } });
  return writeCatalogue(SLUG, { source: "Reserve Bank of India, DBIE (webi reports and CAS), via the Data Bank", generator: "scripts/lib/products/public-finance.mjs --catalogue",
    note: `Scope by rule: DBIE's menus ${MENUS.join(", ")}; reports elsewhere in DBIE with the same name; and reports ${EXTRA.join(", ")}. ${scope.size} reports.`, items });
}
catalogueCli(import.meta.url, async () => {
  const { cfg } = sourceCfg(SLUG);
  await buildCatalogue(cfg);
});
