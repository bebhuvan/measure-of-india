// scripts/lib/products/bsr2.mjs: who owns India's bank deposits, in what kind of account,
// at what interest rate, for how long, and in what size. RBI's annual Basic Statistical
// Return 2 (BSR-2) on deposits with scheduled commercial banks (including RRBs), as served by
// DBIE and mirrored in the local Data Bank (scripts/lib/databank.mjs). Stocks as on 31 March.
//
// Reports read (DBIE report ids):
//   737  Ownership of Deposits with SCBs: deposits by owning sector x type (current, savings,
//        term), annual. TWO CLASSIFICATIONS, never spliced (AGENTS.md rule 1):
//          old scheme, codes 1..53, March 2005 to March 2018 ("IV. Household Sector" =
//            individuals, trusts, proprietary and partnership concerns, institutions);
//          new scheme (SNA-based), codes 54..84, March 2019 onward ("4 Household sector" =
//            individuals incl. HUF + unincorporated enterprises + NPISH; "4.1.1 of which Female").
//        The new scheme has no grand-total row; the all-sector total is the sum of its five
//        top-level sectors, which reconciles exactly with report 847's ALL INDIA (checked).
//   847  Table 1.2, ownership by population group (rural, semi-urban, urban, metro).
//   864  Table 3.4, term deposits by residual maturity and broad ownership category.
//   865  Table 3.5, term deposits by interest-rate range and broad ownership category.
//   866  Table 3.6, term deposits by size of deposit and broad ownership category.
// In tables 3.x the "broad ownership category" is INDIVIDUALS (including HUF) vs OTHERS
// (Measure 1-2 individuals: accounts, amount; 3-4 others; 5-6 total). Verified: the
// individuals' term amount equals report 737 code 72's term amount to the rupee.
// Rows with an empty Dimension 1 in the 3.x tables are percentage shares, not data; skipped.
//
// Units: amounts are rupees in the source; baked as ₹ lakh crore (1e12 rupees), 3 decimals.
import { databankRoot, dbieReport } from "../databank.mjs";
import { writeSeries, writeRaw, readRaw } from "../util.mjs";
import fs from "node:fs";
import path from "node:path";

const LC = 1e12;
const r3 = (v) => v == null ? null : Math.round((v / LC) * 1000) / 1000;
const num = (s) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
const marchOf = (fy) => `20${fy.slice(5, 7)}-03-01`;                 // "2024-25" -> "2025-03-01"
const qd = (s) => `${s.slice(0, 4)}-03-01`;                          // "2026/03/31 00:00:00" -> "2026-03-01"

export async function buildBsr2(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const R = Object.fromEntries(["737", "847", "864", "865", "866"].map((id) => [id, dbieReport(db, id)]));

  // ---------- the audit trail: every row we read, as read ----------
  const rawRel = "data/raw/bsr2-deposits.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "RBI DBIE BSR-2 deposit tables, read from the local Data Bank mirror (rbi_dbie_webi_rows). Provenance per report: DBIE report id, SAP data provider, Data Bank fetch time and content sha256.",
    reports: Object.fromEntries(Object.entries(R).map(([id, r]) => [id, { provenance: r.provenance, header: r.header, rows: r.rows }])),
  });
  // vintage = the date the DATA last changed (writeRaw keeps the old stamp when nothing changed)
  const V = readRaw(root, rawRel).vintage;
  const meta = (extra) => ({ dossier: "deposits", frequency: "annual", base: "as on 31 March", unit: "inr_lakh_crore",
    source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });
  const bundle = (rel, dates, series, extra) => {
    // the axis starts at the first date any series reports (CONTRACT-series: no empty lead)
    const first = Math.max(0, dates.findIndex((_, i) => Object.values(series).some((s) => s.data[i] != null)));
    for (const s of Object.values(series)) s.data = s.data.slice(first);
    writeSeries(root, `data/series/${rel}.json`, { meta: meta({ latestPeriod: dates.at(-1).slice(0, 7), ...extra }), dates: dates.slice(first), series });
  };

  // ---------- 737: ownership x type ----------
  const own = new Map();   // code|fy -> {Current, Saving, Term, Total}
  const fys = { old: new Set(), new: new Set() };
  for (const r of R["737"].rows) {
    const a = num(r["Amount"]); if (a == null || r["Unit Description"] !== "ACTUALS") continue;
    const code = +r["Dim Economy Sect Deposit.Item Code"], fy = r["Year"];
    const k = `${code}|${fy}`; const o = own.get(k) ?? {}; o[r["Item Hierarchy Level2"].split(" ")[0]] = a; own.set(k, o);
    (code <= 53 ? fys.old : fys.new).add(fy);
  }
  const typeSeries = (code, years, who) => Object.fromEntries([["Current", "current"], ["Saving", "savings"], ["Term", "term"], ["Total", "total"]].map(([t, k]) =>
    [`${who}_${k}`, { name: `${who}_${k}_inr_lakh_crore`, color: { term: "#2E4BD8", savings: "#5F6675", current: "#A3A9B4", total: "#878D99" }[k], label: `${{ household: "Households", individuals: "Individuals", female: "Women", all: "All depositors" }[who]}, ${{ current: "current accounts", savings: "savings accounts", term: "term (fixed) deposits", total: "all deposits" }[k]}`,
      data: years.map((fy) => r3(own.get(`${code}|${fy}`)?.[t])) }]));

  const oldY = [...fys.old].sort(), newY = [...fys.new].sort();
  bundle("deposits-owners-2005", oldY.map(marchOf), { ...typeSeries(37, oldY, "household"), ...typeSeries(53, oldY, "all") },
    { coverage: "Bank deposits by owner and type, old sector classification (households include individuals, trusts, proprietary and partnership concerns, institutions); retired after March 2018",
      note: "RBI BSR-2 via DBIE report 737, sector codes 1 to 53. A different classification from the March 2019 series: never joined to it." });

  // new scheme: all-sector total = sum of the five top-level sectors (54 government, 58 non-financial
  // corporations, 61 financial corporations, 71 households, 80 rest of the world)
  const TOP = [54, 58, 61, 71, 80];
  for (const fy of newY) {
    const sum = {}; for (const t of ["Current", "Saving", "Term", "Total"]) sum[t] = TOP.reduce((s, c) => s + (own.get(`${c}|${fy}`)?.[t] ?? 0), 0);
    own.set(`0|${fy}`, sum);
  }
  const NB = newY.map(marchOf);
  bundle("deposits-owners", NB, { ...typeSeries(71, newY, "household"), ...typeSeries(72, newY, "individuals"), ...typeSeries(73, newY, "female"), ...typeSeries(0, newY, "all") },
    { coverage: "Bank deposits by owner and type: households, individuals, women and all depositors, savings vs term vs current, as on 31 March",
      note: "RBI BSR-2 via DBIE report 737, SNA-based sector classification from March 2019. 'All depositors' is the sum of the five top-level sectors (derived; reconciles with DBIE report 847 ALL INDIA). Women = 'of which Female' within individuals." });

  // ---------- 847: households by population group ----------
  const POP = [["rural", "Rural"], ["semi_urban", "Semi-urban"], ["urban", "Urban"], ["metro", "Metropolitan"], ["all_india", "All India"]];
  const p847 = new Map(); const y847 = new Set();
  for (const r of R["847"].rows) {
    const d = r["Dimension 1"]; if (!d) continue; const y = qd(r["Quarter Date"]); y847.add(y);
    p847.set(`${d}|${y}`, [1, 2, 3, 4, 5].map((i) => num(r[`Measure ${i}`])));
  }
  const D847 = [...y847].sort();
  const popSeries = (label, key, who) => Object.fromEntries(POP.map(([k, l], i) => [`${key}_${k}`,
    { name: `${key}_${k}_inr_lakh_crore`, color: k === "all_india" ? "#2E4BD8" : "#878D99", label: `${who}, ${l.toLowerCase()}`, data: D847.map((y) => r3(p847.get(`${label}|${y}`)?.[i])) }]));
  bundle("deposits-population", D847, { ...popSeries("4 Household sector", "household", "Households"), ...popSeries("4.1.1 of which  Female", "female", "Women"), ...popSeries("ALL INDIA", "all", "All depositors") },
    { coverage: "Bank deposits of households, women and all depositors, by rural, semi-urban, urban and metropolitan centres",
      note: "RBI BSR-2 Table 1.2 via DBIE report 847. Population groups are classified by the location of the bank branch." });

  // ---------- 3.x tables: individuals' term deposits by band ----------
  const bands = (id) => {
    const out = new Map(); const ys = new Set(); const order = new Map();
    for (const r of R[id].rows) {
      const d = r["Dimension 1"]; if (!d) continue;          // percentage-share rows
      const y = qd(r["Quarter Date"]); ys.add(y); order.set(d, Math.min(order.get(d) ?? 99, +r["Sequence No"]));
      out.set(`${d}|${y}`, { ind: num(r["Measure 2"]), all: num(r["Measure 6"]), indAcc: num(r["Measure 1"]), allAcc: num(r["Measure 5"]) });
    }
    return { out, ys: [...ys].sort(), labels: [...order.entries()].sort((a, b) => a[1] - b[1]).map(([d]) => d) };
  };
  const slug = (l) => l.toLowerCase().replace(/\brs\.\s*/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
  const tidy = (l) => l.replace(/ % /g, "% ").replace(/ %/g, "%").replace(/Rs\. ?/g, "₹").replace(/ & /g, " and ").replace(/\bCrore\b/g, "crore");
  const bandBundle = (id, rel, total, cov, note, map = null) => {
    const { out, ys, labels } = bands(id);
    const L = labels.filter((l) => l !== total);
    const series = {};
    for (const who of ["ind", "all"]) {
      for (const l of [...L, total]) series[`${who}_${slug(l)}`] = { name: `${who}_${slug(l)}_inr_lakh_crore`,
        label: `${who === "ind" ? "Individuals" : "All depositors"}, ${l === total ? "total" : tidy(l)}`, data: ys.map((y) => r3(out.get(`${l}|${y}`)?.[who])) };
      series[`${who}_accounts`] = { name: `${who}_accounts`, label: `${who === "ind" ? "Individuals" : "All depositors"}, number of term deposit accounts`,
        data: ys.map((y) => out.get(`${total}|${y}`)?.[who + "Acc"] ?? null) };
    }
    bundle(rel, ys, series, { coverage: cov, note, bands: L.map((l) => ({ key: slug(l), label: tidy(l) })) });
  };
  bandBundle("865", "deposits-term-rates", "TOTAL", "Term deposits by the interest rate they earn, individuals and all depositors",
    "RBI BSR-2 Table 3.5 via DBIE report 865. Bands are the contracted rate on outstanding term deposits; the same twelve bands every year.");
  bandBundle("864", "deposits-term-maturity", "GRAND TOTAL", "Term deposits by time left to maturity, individuals and all depositors",
    "RBI BSR-2 Table 3.4 via DBIE report 864. Residual maturity: time remaining until the deposit matures, as on 31 March.");

  // 866: size bands changed in March 2026 (finer). Comparable series use the old four bands, with
  // March 2026 added up from its finer bands (exact sums, disclosed); the finer split is baked apart.
  const s = bands("866");
  const COARSE = [
    ["less_than_1_lakh", "Less than ₹1 lakh", ["Less than Rs.1 lakh"]],
    ["1_lakh_to_15_lakh", "₹1 lakh to ₹15 lakh", ["Rs.1 lakh & above but less than Rs.15 lakh", "Rs.1 lakh & above but less than Rs. 5 lakh", "Rs.5 lakh & above but less than Rs. 10 lakh", "Rs.10 lakh & above but less than Rs. 15 lakh"]],
    ["15_lakh_to_1_crore", "₹15 lakh to ₹1 crore", ["Rs.15 lakh & above but less than Rs.1 crore", "Rs.15 lakh & above but less than Rs. 1 Crore"]],
    ["1_crore_and_above", "₹1 crore and above", ["Rs.1 crore & above", "Rs.1 Crore & above but less than Rs. 3 Crore", "Rs.3 Crore & above but less than Rs. 5 Crore", "Rs.5 crore & above"]],
  ];
  const sizeSeries = {};
  for (const who of ["ind", "all"]) for (const [k, l, srcs] of COARSE) sizeSeries[`${who}_${k}`] = { name: `${who}_${k}_inr_lakh_crore`,
    label: `${who === "ind" ? "Individuals" : "All depositors"}, ${l}`,
    data: s.ys.map((y) => { const vals = srcs.map((src) => s.out.get(`${src}|${y}`)?.[who]).filter((v) => v != null); return vals.length ? r3(vals.reduce((a, b) => a + b, 0)) : null; }) };
  for (const who of ["ind", "all"]) sizeSeries[`${who}_total`] = { name: `${who}_total_inr_lakh_crore`, label: `${who === "ind" ? "Individuals" : "All depositors"}, total`, data: s.ys.map((y) => r3(s.out.get(`Total|${y}`)?.[who])) };
  bundle("deposits-term-size", s.ys, sizeSeries, { coverage: "Term deposits by size of deposit, four bands, individuals and all depositors",
    note: "RBI BSR-2 Table 3.6 via DBIE report 866. RBI split the bands more finely from March 2026; the March 2026 values here are exact sums of the finer bands into the four bands used before. The finer March 2026 split is in deposits-term-size-2026.", bands: COARSE.map(([k, l]) => ({ key: k, label: l })) });
  const fine = s.labels.filter((l) => l !== "Total" && s.out.has(`${l}|2026-03-01`));
  const lastY = s.ys.at(-1);
  bundle("deposits-term-size-2026", [lastY], Object.fromEntries(["ind", "all"].flatMap((who) => fine.map((l) => [`${who}_${slug(l)}`,
    { name: `${who}_${slug(l)}_inr_lakh_crore`, label: `${who === "ind" ? "Individuals" : "All depositors"}, ${tidy(l)}`, data: [r3(s.out.get(`${l}|${lastY}`)?.[who])] }]))),
    { coverage: "Term deposits by size of deposit, the finer bands RBI introduced in March 2026", note: "RBI BSR-2 Table 3.6 via DBIE report 866, March 2026 only.",
      bands: fine.map((l) => ({ key: slug(l), label: tidy(l) })) });
}

/* Catalogue (docs/CONTRACT-coverage.md): the RBI's BSR-2 deposit tables, from the DBIE report
 * catalogue in the Data Bank (dataset rbi_dbie_report_catalog, read-only): every report in
 * the annual and quarterly BSR-2 menus, plus the ownership table 737. The five reports this
 * guide reads are listed row by row, from their own content in the Data Bank mirror:
 *   bsr2:<report>                                            a report not read
 *   bsr2:737:<sector code>:<current|saving|term|total>       ownership x type
 *   bsr2:847:<owner>:<rural|semi-urban|urban|metro|all-india>
 *   bsr2:864|865|866:<band>:<individuals|others|total>:<accounts|amount> */
import { databankQuery } from "../databank.mjs";
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
export async function catalogueBsr2() {
  const { cfg } = sourceCfg("deposits");
  const db = databankRoot(cfg?.families?.databank);
  const cat = databankQuery(db, "rbi_dbie_report_catalog", "SELECT DISTINCT report_id, report_name, menu FROM {table} WHERE menu LIKE '%Basic Statistical Return (BSR)-2%' OR report_id = '737' ORDER BY report_id").rows;
  const READ = new Set(["737", "847", "864", "865", "866"]);
  const items = [];
  const seen = new Set();
  for (const r of cat) {
    if (seen.has(r.report_id)) continue; seen.add(r.report_id);
    const q = /Quarterly/i.test(r.menu) ? "Quarterly. " : "";
    if (!READ.has(r.report_id)) { items.push({ id: `bsr2:${r.report_id}`, label: q + r.report_name.trim() }); continue; }
    const rep = dbieReport(db, r.report_id);
    if (r.report_id === "737") {
      for (const x of rep.rows) items.push({ id: `bsr2:737:${x["Dim Economy Sect Deposit.Item Code"]}:${idPart(String(x["Item Hierarchy Level2"]).split(" ")[0])}`, label: String(x["Item Description"]).trim() });
    } else if (r.report_id === "847") {
      for (const x of rep.rows) if (x["Dimension 1"]) for (const p of ["rural", "semi-urban", "urban", "metro", "all-india"]) items.push({ id: `bsr2:847:${idPart(x["Dimension 1"])}:${p}`, label: x["Dimension 1"].trim() });
    } else {
      for (const x of rep.rows) if (x["Dimension 1"]) for (const w of ["individuals", "others", "total"]) for (const m of ["accounts", "amount"]) items.push({ id: `bsr2:${r.report_id}:${idPart(x["Dimension 1"])}:${w}:${m}`, label: x["Dimension 1"].trim() });
    }
  }
  writeCatalogue("deposits", { source: "Reserve Bank of India: Basic Statistical Return 2 on deposits (DBIE, via the local Data Bank)",
    generator: "scripts/lib/products/bsr2.mjs --catalogue",
    note: "Reports from the Data Bank's rbi_dbie_report_catalog (annual and quarterly BSR-2 menus, and report 737); the five reports read are itemised from their own rows in the Data Bank mirror.", items });
}
await catalogueCli(import.meta.url, catalogueBsr2);
