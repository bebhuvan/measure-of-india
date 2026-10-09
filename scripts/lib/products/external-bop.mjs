// scripts/lib/products/external-bop.mjs: India's balance of payments and international investment
// position, from RBI DBIE through the owner's Data Bank mirror (read-only; see external-dbie.mjs).
//
// Reports read (DBIE report ids), and what each becomes:
//   56  India's Overall Balance of Payments, US$, quarterly, 1990-91 to date (Bulletin table)
//       -> external-bop (the headline net lines), external-bop-gross (receipts and payments of
//          the current account), external-bop-lines (every line, credit / debit / net),
//          external-bop-vintages (every revision DBIE still carries, first estimate vs latest)
//   57  the same table in rupees -> external-bop-inr-lines
//   58  Standard presentation of BoP as per BPM6, US$, quarterly, 2011-12 to date
//       -> external-bop6-lines. A DIFFERENT PRESENTATION from 56 (BPM6 classifies primary and
//       secondary income, the financial account and reserves differently): never joined to it,
//       never subtracted from it. Both are current; RBI's press release leads with 56's layout.
//   1502 BPM6 standard presentation in rupees (Handbook copy) -> external-bop6-inr-lines. The
//       Bulletin copy (report 59) labels two different Jan-Mar 2026 values both "provisional",
//       so its current value cannot be told from the superseded one; 1502 labels its versions.
//   875 / 878  Key components of BoP, annual, 1950-51 to date, US$ / rupees -> external-bop-annual,
//       external-bop-annual-inr
//   427 BoP indicators, annual ratios (CAD/GDP, import cover ...) -> external-bop-indicators
//   1076 Invisibles by category of transactions, quarterly, US$, 2010-11 to date: the detailed
//       receipts and payments behind services, primary income and private transfers
//       -> external-invisibles. (Its "BPM6" rows repeat report 58 and are not read.)
//   807 / 424  Invisibles by category, annual, 1948-49 to date, US$ / rupees -> external-
//       invisibles-annual, external-invisibles-annual-inr
//   982 International investment position, quarterly, US$ and rupees. Two classifications kept
//       apart: BPM5 (March 2006 to September 2021) -> external-iip-bpm5(-inr); BPM6 (December 2017
//       to date) -> external-iip(-inr). The overlap is two rulers, never joined.
//
// Units: amounts are actual US dollars / rupees in DBIE; baked as US$ million and ₹ crore (the
// units of RBI's own tables). Every value is the latest revision DBIE carries (Final > Revised >
// Partially Revised > Preliminary Estimates > Provisional); earlier versions live in the vintage
// bundle and in the raw archive.
//
// Hand check (2026-10-09): Q1 2026-27 (April to June 2026) current account, report 56 net,
// -4,241.2 US$ million provisional; the BPM6 table (58) gives -4,219.2 for the same quarter: the
// two presentations differ by design. FY 2024-25 CAD/GDP in report 427 is -0.58%, against
// "0.6 per cent of GDP" in RBI's press release of 27 June 2025 on BoP for Q4 2024-25.
import fs from "node:fs";
import path from "node:path";
import { writeSeries } from "../util.mjs";
import {
  databankRoot, dbieProviders, provider, actuals, num, quarterOf, fyStart, fyQuarter, vrank, slug, tidy, outlinePaths,
  bakeLong, finish, archive, onAxis, monthAxis, dupHandle, sameTable,
} from "./external-dbie.mjs";

const MN = 1e6, CR = 1e7;
const RAW = "data/raw/external-dbie";

/* outline-numbered BoP line -> stable series key: "1.2.1.5.1 Software Services" -> "1_2_1_5_1_software_services" */
export function lineKey(label) {
  const t = String(label).replace(/^Of which:\s*/i, "of_which ").trim();
  const m = t.match(/^(of_which )?((?:[A-Z]{1,2}\.)?\d+(?:\.[0-9A-Za-z]+)*|[A-Z]{1,2}O?\.\d+\)|[A-Z](?:\.\d+)*\)|[A-Z]\.\d\.[a-z]\))\s+(.*)$/);
  if (!m) return slug(tidy(t), 44);
  const n = m[2].replace(/\)$/, "").toLowerCase().replace(/\./g, "_");
  return `${m[1] ? "of_which_" : ""}${n}_${slug(tidy(m[3]).replace(/\s*\(.*$/, ""), 36)}`;
}
const CDN = { Credit: "credit", Debit: "debit", Net: "net" };
const prettyCdn = { credit: "receipts (credit)", debit: "payments (debit)", net: "net" };

/** every line x credit/debit/net of a BoP long table, latest version */
function bopTable(rows, { date, code, label, cdn, value, version, scale }) {
  const keyOf = new Map(), taken = new Map();
  const kOf = (r) => {
    const c = code(r);
    if (!keyOf.has(c)) {
      let k = lineKey(label(r));
      if (taken.has(k) && taken.get(k) !== c) k = `${k}_${c}`;
      taken.set(k, c); keyOf.set(c, k);
    }
    return keyOf.get(c);
  };
  return bakeLong(rows, {
    date, value: (r) => { const v = num(value(r)); return v; }, unitScale: scale, round: 3,
    key: (r) => { const d = CDN[cdn(r)]; return d ? `${kOf(r)}_${d}` : null; },
    rank: (r) => vrank(version(r)), version,
    label: (k, r) => `${tidy(label(r)).replace(/\s*\((?:[\d.+ A-Za-z]+)\)\s*/g, " ").trim()}, ${prettyCdn[CDN[cdn(r)]]}`,
    order: (r) => [Number(String(code(r)).replace(/\D/g, "")) || 0, ["Credit", "Debit", "Net"].indexOf(cdn(r))].map((x) => String(x).padStart(6, "0")).join("|"),
  });
}

// The headline lines of RBI's overall-BoP layout, addressed by their outline number and name.
const HEAD = [
  ["current_account", /^1 CURRENT ACCOUNT/, "Current account"],
  ["goods", /^1\.1 MERCHANDISE/, "Goods (merchandise trade)"],
  ["invisibles", /^1\.2 INVISIBLES/, "Invisibles (services, transfers, income)"],
  ["services", /^1\.2\.1 Services/, "Services"],
  ["travel", /^1\.2\.1\.1 Travel/, "Travel"],
  ["transport", /^1\.2\.1\.2 Transportation/, "Transport"],
  ["software", /^1\.2\.1\.5\.1 Software/, "Software services"],
  ["business_services", /^1\.2\.1\.5\.2 Business/, "Business services"],
  ["transfers", /^1\.2\.2 Transfers/, "Transfers"],
  ["private_transfers", /^1\.2\.2\.2 Private/, "Private transfers (remittances)"],
  ["income", /^1\.2\.3 Income/, "Income"],
  ["investment_income", /^1\.2\.3\.1 Investment Income/, "Investment income"],
  ["capital_account", /^2 CAPITAL ACCOUNT/, "Capital account"],
  ["foreign_investment", /^2\.1 Foreign Investment/, "Foreign investment"],
  ["fdi", /^2\.1\.1 Foreign Direct Investment/, "Foreign direct investment, net"],
  ["fdi_in_india", /^2\.1\.1\.1 In India/, "Direct investment into India"],
  ["fdi_abroad", /^2\.1\.1\.2 Abroad/, "Direct investment abroad by India"],
  ["portfolio", /^2\.1\.2 Portfolio Investment/, "Portfolio investment, net"],
  ["portfolio_in_india", /^2\.1\.2\.1 In India/, "Portfolio investment into India"],
  ["loans", /^2\.2 Loans/, "Loans"],
  ["external_assistance", /^2\.2\.1 External Assistance/, "External assistance"],
  ["commercial_borrowings", /^2\.2\.2 Commercial Borrowings/, "Commercial borrowings"],
  ["short_term_credit", /^2\.2\.3 Short Term to India/, "Short-term trade credit"],
  ["banking_capital", /^2\.3 Banking Capital/, "Banking capital"],
  ["nri_deposits", /^2\.3\.1\.2\.1 Non-Resident Deposits/, "Non-resident deposits"],
  ["other_capital", /^2\.5 Other Capital/, "Other capital"],
  ["errors_omissions", /^3 Errors & Omissions/, "Errors and omissions"],
  ["overall_balance", /^Overall balance/, "Overall balance"],
  ["reserves_change", /^4\.2 Foreign Exchange Reserves/, "Change in reserves (increase −, decrease +)"],
];
const GROSS = [
  ["goods_exports", /^1\.1 MERCHANDISE/, "Credit", "Goods exports (BoP basis)"],
  ["goods_imports", /^1\.1 MERCHANDISE/, "Debit", "Goods imports (BoP basis)"],
  ["services_exports", /^1\.2\.1 Services/, "Credit", "Services exports (receipts)"],
  ["services_imports", /^1\.2\.1 Services/, "Debit", "Services imports (payments)"],
  ["software_exports", /^1\.2\.1\.5\.1 Software/, "Credit", "Software services exports"],
  ["remittances_in", /^1\.2\.2\.2 Private/, "Credit", "Private transfers received (remittances in)"],
  ["remittances_out", /^1\.2\.2\.2 Private/, "Debit", "Private transfers paid (remittances out)"],
  ["income_receipts", /^1\.2\.3 Income/, "Credit", "Income received from abroad"],
  ["income_payments", /^1\.2\.3 Income/, "Debit", "Income paid abroad"],
  ["current_receipts", /^1 CURRENT ACCOUNT/, "Credit", "Current receipts"],
  ["current_payments", /^1 CURRENT ACCOUNT/, "Debit", "Current payments"],
];

const qOK = (q) => /^\d{4}-\d{2}:Q[1-4]$/.test(q);

export async function buildExternalBop(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const P = Object.fromEntries(["56", "57", "58", "1502", "875", "878", "427", "1076", "807", "424", "982"].map((id) => [id, dbieProviders(db, id)]));

  // ---------- the audit trail: every row read, as read (ACTUALS copies) ----------
  const V = {};
  V.bop = archive(root, `${RAW}/bop-quarterly.json`, vintage, "RBI DBIE: India's overall BoP quarterly, US$ (56) and rupees (57); BPM6 standard presentation, US$ (58) and rupees (1502). Read from the owner's Data Bank mirror; ACTUALS unit copies.",
    [...P["56"], ...P["57"], ...P["58"], ...P["1502"].filter((p) => p.header.includes("Amount (in Rupees)_BPM6"))]);
  V.annual = archive(root, `${RAW}/bop-annual.json`, vintage, "RBI DBIE: key components of BoP annual, US$ (875) and rupees (878); BoP indicators (427); invisibles by category annual, US$ (807) and rupees (424).",
    [...P["875"].filter((p) => p.name === "Query 1"), ...P["878"].filter((p) => p.name === "Query 1"), ...P["427"], ...P["807"], ...P["424"]]);
  V.inv = archive(root, `${RAW}/invisibles-quarterly.json`, vintage, "RBI DBIE report 1076: invisibles by category of transactions, quarterly, US$ (receipts and payments rows; the BPM6 rows repeat report 58 and are not archived).",
    P["1076"], (r) => /^Invisible/.test(r["System Type"]));
  V.iip = archive(root, `${RAW}/iip-quarterly.json`, vintage, "RBI DBIE report 982: international investment position, quarterly, US$ and rupees, BPM5 and BPM6 lines, with the line metadata provider.", P["982"]);

  const meta = (extra) => ({ dossier: "external-bop", source: dcfg.source_agency, geo: "IND", releaseDate: null, mock: false, revisionPolicy: dcfg.revision_policy, ...extra });
  const write = (rel, body, m) => {
    const b = finish(body, "The line is not published for these periods.", m.unit);
    if (b.empty.length) m.emptyLines = b.empty;
    delete b.empty; delete b.vintages;
    writeSeries(root, `data/series/${rel}.json`, { meta: { ...m, latestPeriod: b.dates.at(-1).slice(0, 7) }, dates: b.dates, series: b.series });
    return b;
  };

  // ---------- 56 / 57: RBI's overall BoP layout, quarterly ----------
  const overall = (id, scale) => {
    const rows = actuals(P[id][0]).filter((r) => qOK(r.Quarter));
    if (!rows.length) throw new Error(`external-bop: report ${id} served no quarterly rows`);
    return bopTable(rows, { date: (r) => fyQuarter(r.Quarter), code: (r) => r["Item Code"], label: (r) => r["Balance of Payment (Qtrly)"],
      cdn: (r) => r["Cdn Description"], value: (r) => r.Amount, version: (r) => r["Version Desc"], scale });
  };
  const usd = overall("56", MN);
  const qAxis = monthAxis(usd.dates[0], usd.dates.at(-1), 3);
  onAxis(usd, qAxis);
  // anchor: the table must reach the latest published quarter with a current-account figure
  const caKey = Object.keys(usd.series).find((k) => /^1_current_account_net$/.test(k));
  if (!caKey || usd.series[caKey].data.at(-1) == null) throw new Error("external-bop: no current-account net for the latest quarter in report 56");

  const byPrefix = (body, re, cdn) => {
    const k = Object.keys(body.series).find((k) => k.endsWith("_" + cdn) && re.test(body.series[k].label));
    if (!k) throw new Error(`external-bop: line ${re} (${cdn}) not found`);
    return k;
  };
  const headSeries = {}, grossSeries = {};
  for (const [k, re, lab] of HEAD) { const src = byPrefix(usd, re, "net"); headSeries[k] = { label: lab, source_line: usd.series[src].label, data: [...usd.series[src].data] }; }
  for (const [k, re, cdn, lab] of GROSS) { const src = byPrefix(usd, re, cdn.toLowerCase()); grossSeries[k] = { label: lab, source_line: usd.series[src].label, data: [...usd.series[src].data] }; }
  const qm = { frequency: "quarterly", base: "RBI overall-BoP layout", unit: "usd_million", vintage: V.bop };
  write("external-bop", { dates: [...qAxis], series: headSeries }, meta({ ...qm, product: "India's overall balance of payments (DBIE report 56)",
    coverage: "Balance of payments, the headline net lines: current account, goods, services, remittances, income, capital flows, reserves",
    note: "RBI DBIE report 56, US$ million, fiscal quarters (Q1 = April to June), net = credit minus debit as published. Latest revision of each quarter. Reserve change is signed as RBI signs it: an increase in reserves is a negative entry." }));
  write("external-bop-gross", { dates: [...qAxis], series: grossSeries }, meta({ ...qm, product: "India's overall balance of payments (DBIE report 56)",
    coverage: "Balance of payments, gross receipts and payments of the current account",
    note: "RBI DBIE report 56, US$ million, credit and debit columns as published. Goods are on a BoP basis (customs data adjusted for coverage and timing), not the monthly customs trade figures." }));
  write("external-bop-lines", { dates: [...qAxis], series: usd.series }, meta({ ...qm, product: "India's overall balance of payments (DBIE report 56)",
    coverage: "Balance of payments, every line of RBI's quarterly table, credit, debit and net",
    note: "RBI DBIE report 56, US$ million. Every line as published, keyed by RBI's outline number. A few lines exist only in some years (finer splits of software, business and financial services, FDI components, FII equity and debt from 2012); their absence elsewhere is the table's, disclosed per series." }));

  // vintages: every quarter for which DBIE still carries more than one version
  {
    const vq = [...new Set(Object.values(usd.vintages ?? {}).flatMap((o) => Object.keys(o)))].sort();
    const first = vq[0];
    const axis = monthAxis(first, qAxis.at(-1), 3);
    const series = {}, versions = {};
    for (const [k, re, lab] of HEAD) {
      const src = byPrefix(usd, re, "net");
      const iOf = (d) => usd.dates.indexOf(d);
      series[`${k}_first`] = { label: `${lab}: first estimate`, data: axis.map((d) => { const v = usd.vintages[src]?.[d]; return v ? v[0].value : usd.series[src].data[iOf(d)]; }) };
      series[`${k}_latest`] = { label: `${lab}: latest estimate`, data: axis.map((d) => usd.series[src].data[iOf(d)]) };
      for (const d of axis) { const v = usd.vintages[src]?.[d]; if (v) versions[d] = v.map((x) => x.version); else versions[d] ??= ["(one version)"]; }
    }
    write("external-bop-vintages", { dates: axis, series }, meta({ ...qm, product: "India's overall balance of payments (DBIE report 56)", versions,
      coverage: "How the balance of payments revises: first estimate against the latest, for every quarter DBIE still carries both",
      note: "RBI DBIE report 56. DBIE keeps two versions of each recent quarter: the first published (Provisional, or Preliminary Estimates in 2023-24) and the latest (Partially Revised). meta.versions names them per quarter. Older quarters are carried only in their final form, so their first estimates are not in DBIE." }));
  }

  {
    const inr = overall("57", CR);
    onAxis(inr, monthAxis(inr.dates[0], inr.dates.at(-1), 3));
    write("external-bop-inr-lines", inr, meta({ frequency: "quarterly", base: "RBI overall-BoP layout", unit: "inr_crore", vintage: V.bop, product: "India's overall balance of payments in rupees (DBIE report 57)",
      coverage: "Balance of payments in rupees, every line, credit, debit and net",
      note: "RBI DBIE report 57, ₹ crore: RBI's own rupee conversion of the dollar table, quarter by quarter. Not a separate measurement." }));
  }

  // ---------- 58 / 1502: BPM6 standard presentation ----------
  {
    const p58 = actuals(P["58"][0]).filter((r) => /^\d{4}\//.test(r["Time Date"]) && CDN[r["cdn Description"]]);
    const b6 = bopTable(p58, { date: (r) => quarterOf(r["Time Date"]), code: (r) => r["Item Code"], label: (r) => r["Hierarchy Description"],
      cdn: (r) => r["cdn Description"], value: (r) => r["Amount (USD)_BPM6"], version: (r) => r["Version Desc"], scale: MN });
    onAxis(b6, monthAxis(b6.dates[0], b6.dates.at(-1), 3));
    write("external-bop6-lines", b6, meta({ frequency: "quarterly", base: "BPM6", unit: "usd_million", vintage: V.bop, product: "Standard presentation of BoP as per BPM6 (DBIE report 58)",
      coverage: "Balance of payments, IMF BPM6 standard presentation, every line, credit, debit and net",
      note: "RBI DBIE report 58, US$ million, from 2011-12. A different presentation from RBI's overall-BoP layout (report 56): primary and secondary income replace 'income' and 'transfers', the financial account is signed as net acquisition of assets minus net incurrence of liabilities. Never joined to or subtracted from the other layout." }));
    // BPM6 revisions: 58 keeps only the latest one or two versions of a quarter, but 1076's BPM6
    // rows still carry earlier ones (Preliminary Estimates, Partially Revised) for many quarters.
    // Every cell the two share agrees (catalogue check); together they give each line's first estimate.
    {
      const lab58 = new Map(p58.map((r) => [r["Item Code"], r["Hierarchy Description"]]));
      const r1076 = actuals(P["1076"][0]).filter((r) => r["System Type"] === "BPM6" && /^\d{4}\//.test(r["Time Date"]) && CDN[r["Cdn Description"]] && lab58.has(r["Item Code"]))
        .map((r) => ({ "Time Date": r["Time Date"], "Item Code": r["Item Code"], "Hierarchy Description": lab58.get(r["Item Code"]), "cdn Description": r["Cdn Description"], "Amount (USD)_BPM6": r.Amount, "Version Desc": r["Version Desc"] }));
      const all = bopTable([...p58, ...r1076], { date: (r) => quarterOf(r["Time Date"]), code: (r) => r["Item Code"], label: (r) => r["Hierarchy Description"],
        cdn: (r) => r["cdn Description"], value: (r) => r["Amount (USD)_BPM6"], version: (r) => r["Version Desc"], scale: MN });
      const vq = [...new Set(Object.values(all.vintages).flatMap((o) => Object.keys(o)))].sort();
      const axis = monthAxis(vq[0], b6.dates.at(-1), 3);
      onAxis(all, axis);
      const series = {}, versions = {};
      for (const [k, s] of Object.entries(all.series)) {
        const v = all.vintages[k] ?? {};
        // distinct versions only (58 and 1076 repeat the same cell)
        series[`${k}_first`] = { label: `${s.label}: earliest estimate DBIE carries`, data: all.dates.map((d, i) => (v[d] ? v[d][0].value : s.data[i])) };
        for (const d of Object.keys(v)) versions[d] = [...new Set([...(versions[d] ?? []), ...v[d].map((x) => x.version)])];
      }
      write("external-bop6-vintages", { dates: all.dates, series }, meta({ frequency: "quarterly", base: "BPM6", unit: "usd_million", vintage: V.bop,
        product: "Standard presentation of BoP as per BPM6: first estimates (DBIE reports 58 and 1076)", versions,
        coverage: "The first published estimate of every BPM6 line, for every quarter DBIE still carries an earlier version of; the latest is in external-bop6-lines",
        note: "RBI DBIE reports 58 and 1076 (whose BPM6 rows keep versions 58 has dropped), US$ million. 'First' is the earliest version DBIE still carries for the quarter (meta.versions names them); where it carries one version, first equals latest. Subtract from external-bop6-lines for the revision." }));
    }
    const p1502 = P["1502"].find((p) => p.header.includes("Amount (in Rupees)_BPM6"));
    const r1502 = actuals(p1502).filter((r) => /^\d{4}\//.test(r.Date) && CDN[r["cdn Description"]] && r["Version Desc"] in { Provisional: 1, "Preliminary Estimates": 1, "Partially Revised": 1, Revised: 1, Final: 1 });
    const b6i = bopTable(r1502, { date: (r) => quarterOf(r.Date), code: (r) => r["Item Code"], label: (r) => r["Hierarchy Description"],
      cdn: (r) => r["cdn Description"], value: (r) => r["Amount (in Rupees)_BPM6"], version: (r) => r["Version Desc"], scale: CR });
    onAxis(b6i, monthAxis(b6i.dates[0], b6i.dates.at(-1), 3));
    write("external-bop6-inr-lines", b6i, meta({ frequency: "quarterly", base: "BPM6", unit: "inr_crore", vintage: V.bop, product: "Standard presentation of BoP as per BPM6, rupees (DBIE report 1502)",
      coverage: "Balance of payments in rupees, BPM6 standard presentation, every line",
      note: "RBI DBIE report 1502 (Handbook copy), ₹ crore. The Bulletin copy (report 59) carries one later revision (January to March 2026) but labels both of that quarter's values 'provisional'; this copy labels its versions, so it is the one baked." }));
  }

  // ---------- 875 / 878: key components, annual from 1950-51 ----------
  for (const [id, scale, rel, unit, col] of [["875", MN, "external-bop-annual", "usd_million", "Amount (USD million)"], ["878", CR, "external-bop-annual-inr", "inr_crore", "Amount (Rs.Crore)"]]) {
    const p = P[id].find((x) => x.header.includes(col));
    const rows = actuals(p).filter((r) => /^\d{4}-\d{2}$/.test(r["Fiscal Year"]) && CDN[r["Cdn Description"]]);
    const b = bopTable(rows, { date: (r) => fyStart(r["Fiscal Year"]), code: (r) => r["Item Code"], label: (r) => r.Description,
      cdn: (r) => r["Cdn Description"], value: (r) => r[col], version: (r) => r["Version Desc"], scale });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
    write(rel, b, meta({ frequency: "annual", base: "RBI overall-BoP layout", unit, vintage: V.annual, product: `Key components of India's balance of payments (DBIE report ${id})`,
      coverage: `Balance of payments, annual, every line since 1950-51${id === "878" ? ", in rupees" : ""}`,
      note: `RBI DBIE report ${id}, fiscal years plotted at April of the first year. The early decades use RBI's older capital-account lines (BO.1 to BO.6, A.1.1, A.1.2, EO.4); the modern lines start in 1990-91. Both are kept as published, never mapped onto each other.` }));
  }

  // ---------- 884 / 883, 814 / 305: annual tables of both presentations ----------
  // RBI's own fiscal-year figures. Not our sums of the quarters: an annual table can sit at a
  // different revision state from the quarterly one (2025-26 is "Preliminary Estimates" here and
  // "Partially Revised" quarter by quarter), so the annual figures are kept as published.
  {
    const ap = ["884", "883", "814", "305"].map((id) => ({ id, p: dbieProviders(db, id).find((x) => x.header.some((h) => /^amount|^Amount/.test(h))) }));
    const VA2 = archive(root, `${RAW}/bop-annual-tables.json`, vintage, "RBI DBIE: India's overall BoP annual, US$ (884) and rupees (883); BPM6 standard presentation annual, US$ (814) and rupees (305).", ap.map((x) => x.p));
    for (const { id, p } of ap) {
      const bpm6 = id === "814" || id === "305", usd = id === "884" || id === "814";
      const col = p.header.find((h) => /^amount|^Amount/.test(h));
      const rows = actuals(p).filter((r) => /^\d{4}-\d{2}$/.test(r[bpm6 ? "Year" : "Fiscal Year"] ?? ""));
      const b = bopTable(rows, { date: (r) => fyStart(r[bpm6 ? "Year" : "Fiscal Year"]), code: (r) => r["Item Code"], label: (r) => (bpm6 ? r["Hierarchy Description"] : r["Balance of Payment (Annual)"]),
        cdn: (r) => r[bpm6 ? "cdn_description" : "Cdn Description"], value: (r) => r[col], version: (r) => r["Version Desc"], scale: usd ? MN : CR });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
      write(`external-${bpm6 ? "bop6" : "bop"}-annual-${bpm6 ? "lines" : "overall"}${usd ? "" : "-inr"}`, b, meta({ frequency: "annual", base: bpm6 ? "BPM6" : "RBI overall-BoP layout", unit: usd ? "usd_million" : "inr_crore", vintage: VA2,
        product: `${bpm6 ? "Standard presentation of BoP as per BPM6" : "India's overall balance of payments"}, annual (DBIE report ${id})`,
        coverage: `Balance of payments, ${bpm6 ? "BPM6 standard presentation" : "RBI's overall layout"}, every line, fiscal years${usd ? "" : ", in rupees"}`,
        note: `RBI DBIE report ${id}, fiscal years plotted at April of the first year. RBI's annual figures as published; they can sit at a different revision state from the quarterly table, so they are not replaced by sums of the quarters.` }));
    }
  }

  // ---------- 427: BoP indicators ----------
  {
    const rows = P["427"].find((p) => p.header.includes("BoP Indicator")).rows.filter((r) => /^\d{4}-\d{2}$/.test(r["Time Fis Year"]));
    const b = bakeLong(rows, { date: (r) => fyStart(r["Time Fis Year"]), key: (r) => slug(r["BoP Indicator"].replace(/\//g, " to "), 40),
      value: (r) => num(r.Value), round: 3, label: (k, r) => `${r.Items}: ${r["BoP Indicator"].replace(/\s*\/\s*/g, " to ").replace(/\bCAD\b/, "Current account balance")}`,
      order: (r) => +r["Indicator Display Order"] });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
    if (!b.series.cad_to_gdp) throw new Error("external-bop: report 427 has no CAD/GDP indicator");
    write("external-bop-indicators", b, meta({ frequency: "annual", base: "RBI overall-BoP layout", unit: "percent_or_months", vintage: V.annual, product: "Balance of payments indicators (DBIE report 427)",
      coverage: "Balance of payments ratios: trade and invisibles to GDP, current account to GDP, import cover of reserves",
      note: "RBI DBIE report 427. Ratios to GDP in per cent; import cover in months of imports. As published: the current-account ratio is signed (a deficit is negative)." }));
  }

  // ---------- 1076: invisibles by category, quarterly ----------
  {
    const p = P["1076"][0];
    const rows = actuals(p).filter((r) => /^Invisible/.test(r["System Type"]) && /^\d{4}\//.test(r["Time Date"]));
    const recs = { "Invisibles Receipts": "rec", "Invisible Payments": "pay" };
    const labels = {};
    for (const [sys, pre] of Object.entries(recs)) {
      const lines = [...new Map(rows.filter((r) => r["System Type"] === sys).map((r) => [r["Item Code"], { code: r["Item Code"], label: r["Item Description"], o: +r["Item Display Order"] }])).values()].sort((a, b) => a.o - b.o);
      labels[pre] = outlinePaths(lines);
    }
    const taken = new Map();
    const keyOf = (r) => {
      const pre = recs[r["System Type"]]; const lab = labels[pre].get(r["Item Code"]);
      let k = `${pre}_${slug(lab, 56)}`;
      if (taken.has(k) && taken.get(k) !== r["Item Code"]) k = `${k}_${r["Item Code"]}`;
      taken.set(k, r["Item Code"]); return k;
    };
    const b = bakeLong(rows, { date: (r) => quarterOf(r["Time Date"]), key: keyOf, value: (r) => num(r.Amount), unitScale: MN, round: 3,
      rank: (r) => vrank(r["Version Desc"]), version: (r) => r["Version Desc"],
      label: (k, r) => `${r["System Type"] === "Invisibles Receipts" ? "Receipts" : "Payments"}: ${labels[recs[r["System Type"]]].get(r["Item Code"])}`,
      order: (r) => `${r["System Type"] === "Invisibles Receipts" ? 0 : 1}|${String(+r["Item Display Order"] || 0).padStart(6, "0")}` });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 3));
    write("external-invisibles", b, meta({ frequency: "quarterly", base: "BPM6", unit: "usd_million", vintage: V.inv, product: "Invisibles by category of transactions (DBIE report 1076)",
      coverage: "Invisibles in detail: every category of services, income and transfer receipts and payments, quarterly",
      note: "RBI DBIE report 1076, US$ million, from 2010-11, BPM6 categories. Receipts and payments as published; some finer lines start later (2012-13). Labels name each line with its parent category." }));
  }

  // ---------- 807 / 424: invisibles annual ----------
  for (const [id, scale, rel, unit, order] of [["807", MN, "external-invisibles-annual", "usd_million", "item_display_order(balance_payment)"], ["424", CR, "external-invisibles-annual-inr", "inr_crore", "Item Display Order"]]) {
    const rows = actuals(P[id][0]).filter((r) => /^\d{4}-\d{2}$/.test(r.Year) && CDN[r.cdn_description]);
    const b = bopTable(rows, { date: (r) => fyStart(r.Year), code: (r) => r["Item Code"], label: (r) => r["Item Desc"],
      cdn: (r) => r.cdn_description, value: (r) => r.amount, version: (r) => r["Version Desc"], scale });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
    write(rel, b, meta({ frequency: "annual", base: "RBI overall-BoP layout", unit, vintage: V.annual, product: `Invisibles by category of transactions, annual (DBIE report ${id})`,
      coverage: `Invisibles and the overall BoP lines, annual since 1948-49${id === "424" ? ", in rupees" : ""}`,
      note: `RBI DBIE report ${id}, fiscal years plotted at April of the first year. The table repeats the overall-BoP lines; services detail (software, business, financial, communication) starts in the 2000s.` }));
  }

  // ---------- 982: international investment position ----------
  {
    const metaP = P["982"].find((p) => p.name === "Query 1");
    const tree = new Map(); // itemSk -> { cat, list, name }
    for (const r of metaP.rows) tree.set(r["Item Sk"], { cat: r["Item Category"], list: r["Item List"], name: r["Reporting Seq"].replace(/\s+/g, " ").trim(), o: +r["Item Text Display Order"] });
    // labels: section (net / assets / liabilities) + ancestors by outline number within the section
    const pathOf = new Map();
    for (const cat of ["BPM5", "BPM6"]) {
      const items = [...tree.entries()].filter(([, t]) => t.cat === cat).sort((a, b) => a[1].o - b[1].o);
      let section = "Net", byList = new Map();
      for (const [sk, t] of items) {
        if (/^A\.?$/.test(t.list)) { section = "Assets"; byList = new Map(); }        // "A." in BPM5, "A." / "B" in BPM6
        else if (/^B\.?$/.test(t.list)) { section = "Liabilities"; byList = new Map(); }
        const L = t.list.replace(/\.$/, "");
        if (L && !/^[AB]$/.test(L)) byList.set(L, t.name);
        const parts = L.split(".").filter(Boolean);
        const anc = [];
        for (let i = 1; i < parts.length; i++) { const a = byList.get(parts.slice(0, i).join(".")); if (a) anc.push(a); }
        const leaf = /^[AB]$/.test(L) || !L ? (t.name === section ? "total" : t.name) : t.name;
        pathOf.set(sk, { section, label: [section, ...anc, leaf].filter((x, i, a) => i === 0 || x !== a[i - 1]).join(": ").replace(/(: [^:]+): /, "$1, ").replace(/\s+/g, " "), list: L || section.toLowerCase() });
      }
    }
    for (const [cur, scale, unit, col] of [["dollor", MN, "usd_million", "Amount (in $ million)"], ["INR", CR, "inr_crore", "Amount Inr"]]) {
      const p = P["982"].find((x) => x.name === cur);
      for (const cat of ["BPM6", "BPM5"]) {
        const rows = p.rows.filter((r) => r["Item Category"] === cat && /^\d{4}\//.test(r.Date) && tree.has(r["Item Code"]));
        const taken = new Map();
        const b = bakeLong(rows, { date: (r) => quarterOf(r.Date),
          key: (r) => { const t = pathOf.get(r["Item Code"]); let k = `${t.section[0].toLowerCase()}_${t.list.toLowerCase().replace(/\./g, "_")}_${slug(tree.get(r["Item Code"]).name, 28)}`.replace(/_+/g, "_");
            if (taken.has(k) && taken.get(k) !== r["Item Code"]) k += "_" + r["Item Code"]; taken.set(k, r["Item Code"]); return k; },
          value: (r) => num(r[col]), unitScale: scale, round: 3, rank: (r) => vrank(r.version_desc), version: (r) => r.version_desc,
          label: (k, r) => pathOf.get(r["Item Code"]).label, order: (r) => tree.get(r["Item Code"]).o });
        if (!b.dates.length) throw new Error(`external-bop: report 982 ${cur} ${cat} served nothing`);
        onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 3));
        const rel = `external-iip${cat === "BPM5" ? "-bpm5" : ""}${cur === "INR" ? "-inr" : ""}`;
        write(rel, b, meta({ frequency: "quarterly", base: cat, unit, vintage: V.iip, product: `International investment position of India, ${cat} (DBIE report 982)`,
          coverage: `International investment position${cat === "BPM5" ? ", old (BPM5) classification" : ""}: what India owns abroad and owes to the world, by instrument and sector${cur === "INR" ? ", in rupees" : ""}`,
          note: `RBI DBIE report 982, ${cur === "INR" ? "₹ crore" : "US$ million"}, stocks at the end of each quarter (plotted at the quarter's first month). ${cat === "BPM5" ? "The BPM5 classification, March 2006 to September 2021; replaced by BPM6 from December 2017. The overlap is two rulers, never joined. In December 2014 RBI's table gives a net position 8,233 US$ million away from assets minus liabilities; kept as published." : "The BPM6 classification, from December 2017. Net position = assets minus liabilities; a negative net position means India owes the world more than it owns abroad."}` }));
      }
    }
  }

  // ---------- 533 / 1503: the investment position, overall summary (Handbook) ----------
  // RBI's own summary layout (assets and liabilities by functional category and instrument),
  // quarterly from June 2018. Its figures agree with report 982 for most cells but not all
  // (about one in ten differs: different revision states), so it is baked as published.
  {
    const sp = [...dbieProviders(db, "533"), ...dbieProviders(db, "1503")].filter((x) => x.header.some((h) => /^Amount/.test(h)));
    const VS = archive(root, `${RAW}/iip-summary.json`, vintage, "RBI DBIE: international investment position, quarterly overall summary, US$ (533) and rupees (1503).", sp);
    for (const [id, rel, scale, unit, col] of [["533", "external-iip-summary", MN, "usd_million", "Amount Usd"], ["1503", "external-iip-summary-inr", CR, "inr_crore", "Amount Inr"]]) {
      const x = sp.find((q) => q.header.includes(col));
      const b = bakeLong(actuals(x).filter((r) => /^\d{4}\//.test(r["Time Date"])), { date: (r) => quarterOf(r["Time Date"]), unitScale: scale, round: 3,
        key: (r) => `${slug(r["Item Hierarchy Level 1"] || "net", 12)}_${slug(r["Item Description"], 40)}_${r["Item Code"]}`, value: (r) => num(r[col]),
        rank: (r) => vrank(r["Version Desc"]), version: (r) => r["Version Desc"],
        label: (k, r) => `${r["Item Hierarchy Level 1"] ? r["Item Hierarchy Level 1"] + ": " : ""}${r["Item Description"].replace(/\s+/g, " ")}`, order: (r) => +r["Item Text Display Order"] });
      onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 3));
      write(rel, b, meta({ frequency: "quarterly", base: "BPM6", unit, vintage: VS, product: `International investment position of India, overall summary (DBIE report ${id})`,
        coverage: `International investment position, RBI's summary layout, quarterly from June 2018${unit === "inr_crore" ? ", in rupees" : ""}`,
        note: `RBI DBIE report ${id} (Handbook), stocks at the end of each quarter plotted at the quarter's first month. RBI's summary of the BPM6 position; most cells equal report 982's, about one in ten differ (different revision states), so both are kept as published.` }));
    }
  }

  // ---------- curated selections for the page (published lines only, nothing derived) ----------
  // The full tables above are what a reader downloads; the guide's charts draw a handful of lines
  // from each, and these bundles carry exactly those lines so the page does not ship every line.
  const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, "data/series", rel + ".json"), "utf8"));
  const pick = (src, picks, rel, m) => {
    const b = read(src), series = {};
    for (const [k, re, lab] of picks) {
      const hit = Object.entries(b.series).filter(([, x]) => re.test(x.label));
      if (hit.length !== 1) throw new Error(`external-bop: ${rel}: ${re} matched ${hit.length} lines of ${src}`);
      series[k] = { label: lab, source_line: hit[0][1].label, data: [...hit[0][1].data], ...(hit[0][1].gaps ? { gaps: hit[0][1].gaps, gapsNote: hit[0][1].gapsNote } : {}) };
    }
    write(rel, { dates: [...b.dates], series }, meta({ ...m, vintage: b.meta.vintage, frequency: b.meta.frequency, base: b.meta.base, unit: b.meta.unit }));
  };
  pick("external-bop-annual", [
    ["current_account", /^1 CURRENT ACCOUNT, net$/, "Current account"], ["goods", /^1\.1 MERCHANDISE, net$/, "Goods"],
    ["invisibles", /^1\.2 INVISIBLES, net$/, "Invisibles"], ["services", /^1\.2\.1 Services, net$/, "Services"],
    ["private_transfers", /^1\.2\.2\.2 Private, net$/, "Private transfers (remittances)"], ["income", /^1\.2\.3 Income, net$/, "Income"],
    ["overall_balance", /^Overall balance, net$/, "Overall balance"],
  ], "external-bop-annual-head", { product: "Key components of India's balance of payments (DBIE report 875)",
    coverage: "Balance of payments since 1950-51, the current account and its parts, net, fiscal years",
    note: "Selected net lines of RBI DBIE report 875 (external-bop-annual carries every line), US$ million, fiscal years plotted at April of the first year." });
  pick("external-invisibles", [
    ["remittances_received", /^Receipts: Secondary Income Receipts: Private Transfers$/, "Private transfers received"],
    ["family_remittances", /^Receipts: Private Transfers: Inward Remittance from Indian workers abroad/, "Money sent home by Indians working abroad, for family maintenance"],
    ["nri_withdrawals", /^Receipts: Private Transfers: Local withdrawals/, "Withdrawals in India from NRI deposits"],
    ["gold_baggage", /^Receipts: Private Transfers: Gold and silver brought/, "Gold and silver brought in passengers' baggage"],
    ["gifts_received", /^Receipts: Private Transfers: Personal gifts\/donations/, "Gifts and donations received"],
    ["wages_received", /^Receipts: Compensation of Employee: Wages received/, "Wages earned by Indians on foreign contracts"],
    ["remittances_paid", /^Payments: Secondary Income Payments: Private Transfers$/, "Private transfers paid"],
    ["family_remittances_out", /^Payments: Private Transfers: Remittance by non-residents towards family/, "Money sent abroad by non-residents in India, for family and savings"],
    ["travel_received_business", /^Receipts: Travel: Business$/, "Visitors to India: business travel"], ["travel_received_health", /^Receipts: Travel: Health$/, "Visitors to India: health"],
    ["travel_received_education", /^Receipts: Travel: Education$/, "Visitors to India: education"], ["travel_received_other", /^Receipts: Travel: Others$/, "Visitors to India: other travel"],
    ["travel_paid_business", /^Payments: Travel: Business$/, "Indians abroad: business travel"], ["travel_paid_health", /^Payments: Travel: Health Related$/, "Indians abroad: health"],
    ["travel_paid_education", /^Payments: Travel: Education Related$/, "Indians abroad: education"], ["travel_paid_btq", /^Payments: Travel: Basic travel quota/, "Indians abroad: basic travel quota"],
    ["travel_paid_pilgrimage", /^Payments: Travel: Pilgrimage$/, "Indians abroad: pilgrimage"], ["travel_paid_other", /^Payments: Travel: Others/, "Indians abroad: other travel (including international card settlements)"],
  ], "external-invisibles-people", { product: "Invisibles by category of transactions (DBIE report 1076)",
    coverage: "The household side of the balance of payments: remittances in and out, wages earned abroad, and travel for business, health and education, quarterly",
    note: "Selected lines of RBI DBIE report 1076 (external-invisibles carries every line), US$ million, quarterly, from 2011-12 to the quarter DBIE's detail last reaches." });
  pick("external-iip", [
    ["net", /^Net: Net International Investment Position$/, "Net international investment position"],
    ["assets", /^Assets: total$/, "Assets abroad, total"], ["liabilities", /^Liabilities: total$/, "Liabilities to the world, total"],
    ["a_direct", /^Assets: Direct investment$/, "Assets: direct investment abroad"], ["a_portfolio", /^Assets: Portfolio investment$/, "Assets: portfolio investment abroad"],
    ["a_other", /^Assets: Other investment$/, "Assets: other investment (loans, deposits, trade credit)"], ["a_reserves", /^Assets: Reserve assets$/, "Assets: reserves"],
    ["l_direct", /^Liabilities: Direct investment$/, "Liabilities: direct investment in India"], ["l_portfolio", /^Liabilities: Portfolio investment$/, "Liabilities: portfolio investment in India"],
    ["l_other", /^Liabilities: Other investment$/, "Liabilities: other investment (loans, deposits, trade credit)"],
  ], "external-iip-head", { product: "International investment position of India, BPM6 (DBIE report 982)",
    coverage: "What India owns abroad and owes to the world, by broad category, quarterly from December 2017",
    note: "Selected lines of RBI DBIE report 982, BPM6 (external-iip carries every line), US$ million, end of quarter." });
}

/* ---------------- catalogue ---------------- */

export function catalogue(db) {
  const items = [], handles = {};
  const add = (id, label, dims) => items.push({ id, label, dims });
  const lines = (rep, rows, code, label, cdn, extra = {}) => {
    const seen = new Set();
    for (const r of rows) {
      const c = CDN[cdn(r)]; if (!c) continue;
      const k = `${lineKey(label(r))}:${c}`; if (seen.has(k)) continue; seen.add(k);
      add(`dbie:${rep}:${k}`, `${tidy(label(r))}, ${prettyCdn[c]}`, { report: rep, line: code(r), cdn: c, ...extra });
    }
  };
  const cellOverall = (r) => qOK(r.Quarter) && (r["Unit Desc"] === "ACTUALS") ? [`${r.Quarter}|${r["Item Code"]}|${r["Cdn Description"]}|${r["Version Desc"]}`, num(r.Amount)] : null;
  // 56 / 57: overall quarterly
  for (const rep of ["56", "57"]) { const rows = actuals(dbieProviders(db, rep)[0]).filter((r) => qOK(r.Quarter));
    lines(rep, rows, (r) => r["Item Code"], (r) => r["Balance of Payment (Qtrly)"], (r) => r["Cdn Description"], { freq: "quarterly", unit: rep === "56" ? "usd" : "inr" }); handles[rep] = "primary"; }
  // copies of 56 / 57 under other menus
  for (const [dup, prim] of [["141", "56"], ["885", "56"], ["142", "57"], ["791", "57"]]) {
    handles[dup] = dupHandle(db, prim, dup, (r) => { const q = r.Quarter; const lab = r["Balance of Payment (Qtrly)"] ?? r["Hbs Item Description"];
      return qOK(q) && r["Unit Desc"] === "ACTUALS" ? [`${q}|${r["Item Code"]}|${r["Cdn Description"]}|${r["Version Desc"]}`, num(r.Amount)] : null; });
    items.push(...items.filter((i) => i.dims.report === prim && i.id.startsWith(`dbie:${prim}:`)).map((i) => ({ id: i.id.replace(`dbie:${prim}:`, `dbie:${dup}:`), label: i.label, dims: { ...i.dims, report: dup, copyOf: prim } })));
  }
  // 58 BPM6 US$, 59 / 1502 / 143 rupees and copies
  { const rows = actuals(dbieProviders(db, "58")[0]).filter((r) => /^\d{4}\//.test(r["Time Date"]));
    lines("58", rows, (r) => r["Item Code"], (r) => r["Hierarchy Description"], (r) => r["cdn Description"], { freq: "quarterly", unit: "usd", presentation: "BPM6" }); handles["58"] = "primary"; }
  { const p = dbieProviders(db, "1502").find((x) => x.header.includes("Amount (in Rupees)_BPM6"));
    lines("1502", actuals(p).filter((r) => /^\d{4}\//.test(r.Date)), (r) => r["Item Code"], (r) => r["Hierarchy Description"], (r) => r["cdn Description"], { freq: "quarterly", unit: "inr", presentation: "BPM6" }); handles["1502"] = "primary"; }
  { const rows = actuals(dbieProviders(db, "59")[0]).filter((r) => /^\d{4}\//.test(r.Date));
    lines("59", rows, (r) => r["Item Code"], (r) => r["Hierarchy Description"], (r) => r["cdn Description"], { freq: "quarterly", unit: "inr", presentation: "BPM6", versionLabels: "unreliable" }); handles["59"] = "primary"; }
  handles["143"] = dupHandle(db, "58", "143", (r) => {
    const d = r["Time Date"] ?? r.Date, a = r["Amount (USD)_BPM6"];
    return /^\d{4}\//.test(d ?? "") && r["Unit Desc"] === "ACTUALS" && a != null ? [`${d.slice(0, 10)}|${r["Item Code"]}|${r["cdn Description"]}|${r["Version Desc"]}`, num(a)] : null;
  });
  items.push(...items.filter((i) => i.id.startsWith("dbie:58:")).map((i) => ({ id: i.id.replace("dbie:58:", "dbie:143:"), label: i.label, dims: { ...i.dims, report: "143", copyOf: "58" } })));
  // annual key components and copies
  for (const [rep, col] of [["875", "Amount (USD million)"], ["878", "Amount (Rs.Crore)"]]) {
    const p = dbieProviders(db, rep).find((x) => x.header.includes(col));
    lines(rep, actuals(p).filter((r) => /^\d{4}-\d{2}$/.test(r["Fiscal Year"])), (r) => r["Item Code"], (r) => r.Description, (r) => r["Cdn Description"], { freq: "annual", unit: rep === "875" ? "usd" : "inr" }); handles[rep] = "primary";
  }
  for (const [dup, prim, col] of [["815", "875", "Amount (USD million)"], ["819", "878", "Amount (Rs.Crore)"]]) {
    handles[dup] = dupHandle(db, prim, dup, (r) => /^\d{4}-\d{2}$/.test(r["Fiscal Year"] ?? "") && r["Unit Description"] === "ACTUALS" && r[col] != null ? [`${r["Fiscal Year"]}|${r["Item Code"]}|${r["Cdn Description"]}|${r["Version Desc"]}`, num(r[col])] : null);
    items.push(...items.filter((i) => i.id.startsWith(`dbie:${prim}:`)).map((i) => ({ id: i.id.replace(`dbie:${prim}:`, `dbie:${dup}:`), label: i.label, dims: { ...i.dims, report: dup, copyOf: prim } })));
  }
  // overall BoP annual (884 / 883 and Handbook copies 258 / 534): the fiscal-year sums of report 56 / 57's quarters
  for (const rep of ["884", "883"]) {
    const p = dbieProviders(db, rep)[0];
    lines(rep, actuals(p).filter((r) => /^\d{4}-\d{2}$/.test(r["Fiscal Year"] ?? "")), (r) => r["Item Code"], (r) => r["Balance of Payment (Annual)"] ?? r["Hbs Item Description"], (r) => r["Cdn Description"], { freq: "annual", unit: /88[3]|534/.test(rep) ? "inr" : "usd", annualOf: /88[3]|534/.test(rep) ? "57" : "56" });
    handles[rep] = "primary";
  }
  for (const [dup, prim] of [["258", "884"], ["534", "883"]]) {
    handles[dup] = dupHandle(db, prim, dup, (r) => /^\d{4}-\d{2}$/.test(r["Fiscal Year"] ?? "") && r["Unit Description"] === "ACTUALS" ? [`${r["Fiscal Year"]}|${r["Item Code"]}|${r["Cdn Description"]}|${r["Version Desc"]}`, num(r.Amount)] : null);
    items.push({ id: `dbie:${dup}:${handles[dup].unverified ? "copy-unverified" : "copy"}`, label: `India's overall balance of payments, annual (Handbook, DBIE report ${dup}): the same table as report ${prim}`, dims: { report: dup, copyOf: prim, match: handles[dup].match } });
  }
  // BPM6 annual (814 US$, 305 rupees)
  for (const rep of ["814", "305"]) {
    const p = dbieProviders(db, rep)[0]; const d = p.header.find((h) => /^Date$/.test(h)) ?? "Time Date";
    lines(rep, actuals(p).filter((r) => /^\d{4}/.test(r[d] ?? "")), (r) => r["Item Code"], (r) => r["Hierarchy Description"], (r) => r.cdn_description ?? r["cdn Description"], { freq: "annual", unit: rep === "814" ? "usd" : "inr", presentation: "BPM6", annualOf: rep === "814" ? "58" : "1502" });
    handles[rep] = "primary";
  }
  // indicators
  { const rows = dbieProviders(db, "427").find((p) => p.header.includes("BoP Indicator")).rows;
    for (const ind of [...new Set(rows.map((r) => r["BoP Indicator"]))]) add(`dbie:427:${slug(ind.replace(/\//g, " to "), 40)}`, `BoP indicator: ${ind}`, { report: "427", freq: "annual" });
    handles["427"] = "primary";
    handles["178"] = dupHandle(db, "427", "178", (r) => r["Time Fis Year"] && r["BoP Indicator"] ? [`${r["Time Fis Year"]}|${r["BoP Indicator"]}`, num(r.Value)] : null);
    items.push(...items.filter((i) => i.id.startsWith("dbie:427:")).map((i) => ({ id: i.id.replace("dbie:427:", "dbie:178:"), label: i.label, dims: { ...i.dims, report: "178", copyOf: "427" } })));
  }
  // invisibles quarterly: receipts and payments lines; the BPM6 rows repeat report 58
  { const rows = actuals(dbieProviders(db, "1076")[0]).filter((r) => /^\d{4}\//.test(r["Time Date"]));
    const seen = new Set();
    for (const r of rows) {
      const sys = r["System Type"]; const pre = sys === "Invisibles Receipts" ? "rec" : sys === "Invisible Payments" ? "pay" : "bpm6";
      const k = `${pre}:${r["Item Code"]}`; if (seen.has(k)) continue; seen.add(k);
      add(`dbie:1076:${k}`, `${sys}: ${r["Item Description"].replace(/\s+/g, " ").trim()}`, { report: "1076", system: sys, freq: "quarterly" });
    }
    handles["1076"] = "primary";
    // its BPM6 rows claim to repeat report 58: checked cell by cell
    const r58 = actuals(dbieProviders(db, "58")[0]).filter((r) => /^\d{4}\//.test(r["Time Date"]));
    const r1076 = rows.filter((r) => r["System Type"] === "BPM6");
    // 1076 keeps versions 58 has dropped, so only the cells both carry are compared: they must agree;
    // the rest are earlier versions, baked into external-bop6-vintages.
    const cell = (r) => [`${r["Time Date"].slice(0, 10)}|${r["Item Code"]}|${r["cdn Description"] ?? r["Cdn Description"]}|${r["Version Desc"]}`, num(r["Amount (USD)_BPM6"] ?? r.Amount)];
    const k58 = new Set(r58.map((r) => cell(r)[0]));
    const shared = r1076.filter((r) => k58.has(cell(r)[0]));
    const chk = sameTable(r58, shared, cell);
    for (const it of items) if (/^dbie:1076:bpm6:/.test(it.id)) Object.assign(it.dims, { copyOf: "58", match: chk.match, cells: chk.cells, earlierVersionCells: r1076.length - shared.length });
    if (chk.match < 0.995) for (const it of items) if (/^dbie:1076:bpm6:/.test(it.id)) it.id = it.id.replace(":bpm6:", ":bpm6-unverified:");
  }
  // invisibles annual and copies
  for (const rep of ["807", "424"]) { const rows = actuals(dbieProviders(db, rep)[0]).filter((r) => /^\d{4}-\d{2}$/.test(r.Year));
    lines(rep, rows, (r) => r["Item Code"], (r) => r["Item Desc"], (r) => r.cdn_description, { freq: "annual", unit: rep === "807" ? "usd" : "inr" }); handles[rep] = "primary"; }
  for (const [dup, prim] of [["131", "807"], ["132", "424"]]) {
    handles[dup] = dupHandle(db, prim, dup, (r) => /^\d{4}-\d{2}$/.test(r.Year ?? "") && r["Unit Description"] === "ACTUALS" ? [`${r.Year}|${r["Item Code"]}|${r.cdn_description}|${r["Version Desc"]}`, num(r.amount)] : null);
    items.push(...items.filter((i) => i.id.startsWith(`dbie:${prim}:`)).map((i) => ({ id: i.id.replace(`dbie:${prim}:`, `dbie:${dup}:`), label: i.label, dims: { ...i.dims, report: dup, copyOf: prim } })));
  }
  // IIP 982 and its copies (Bulletin 60, Handbook quarterly 145/1504 BPM6 and 144/1506 BPM5, end-March annual 1745/1746/1743/1744, overall summaries 533/1503)
  { const P = dbieProviders(db, "982"); const metaP = P.find((p) => p.name === "Query 1");
    for (const r of metaP.rows) for (const cur of ["usd", "inr"]) add(`dbie:982:${r["Item Category"].toLowerCase()}:${cur}:${r["Item Sk"]}`, `IIP ${r["Item Category"]}: ${r["Item List"]} ${r["Reporting Seq"]}`.replace(/\s+/g, " ").trim(), { report: "982", category: r["Item Category"], unit: cur, freq: "quarterly" });
    handles["982"] = "primary";
    const cell982 = (r) => { const a = r["Amount (in $ million)"] ?? r["Amount Inr"]; return /^\d{4}\//.test(r.Date ?? "") && a != null && r["Item Code"] ? [`${r.Date.slice(0, 10)}|${r["Item Code"]}|${r.version_desc}|${r["Amount Inr"] != null ? "inr" : "usd"}`, num(a)] : null; };
    for (const dup of ["60", "145", "1504", "144", "1506", "1745", "1746", "1743", "1744"]) {
      handles[dup] = dupHandle(db, "982", dup, cell982);
      add(`dbie:${dup}:${handles[dup].unverified ? "copy-unverified" : "copy"}`, `${dup}: copy of the international investment position table (report 982)`, { report: dup, copyOf: "982", match: handles[dup].match });
    }
    for (const rep of ["533", "1503"]) { handles[rep] = "primary"; const x = dbieProviders(db, rep).find((q) => q.header.some((h) => /^Amount/.test(h)));
      for (const k of new Set(actuals(x).map((r) => `${slug(r["Item Hierarchy Level 1"] || "net", 12)}:${r["Item Code"]}`))) add(`dbie:${rep}:${k}`, `IIP overall summary (report ${rep}): line ${k}`, { report: rep, freq: "quarterly" }); }
  }
  return { items, handles };
}
