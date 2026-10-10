// scripts/lib/products/banks-fi.mjs: the RBI's financial-institutions tables (DBIE, "Financial
// Institutions" menu), for the banks guide: the development and refinance institutions
// (NABARD, SIDBI, NHB, EXIM Bank, IFCI, the state financial corporations), deposit insurance
// (DICGC), LIC's investments, mutual funds' assets, PSU bonds, private placements and HDFC's
// housing loans. Read from the local Data Bank mirror (read-only), one bundle per report.
//
// One small reader for all of them (bakeTable): a table's own columns name the date, the value,
// the display unit (DBIE repeats every value once per unit: ACTUALS kept), the version (Final
// over Provisional) and the item. A label decides a series' unit: counts ("No. of", "number"),
// per cent, else rupees baked as ₹ crore. Dates: a financial year ("1999-00") is its March; a
// bare year ("1991") is dated to March of that year, as the tables give no month; a full date
// keeps its month (deposit insurance is printed for September and March).
//
// Hand check (2026-10-10): DICGC insured deposits, March 2025: report 384 prints
// ₹1,00,12,064.5 crore; DICGC's newsletter Safety Net (issue 5) charts ₹100.12 lakh crore insured
// against ₹241 lakh crore assessable (41.5 per cent), and the sum of scheduled commercial and
// co-operative banks in DBIE report 733 (credit-deep-insured-deposits) is ₹1,00,12,064.5 crore
// to the rupee (co-operative banks ₹7.73 lakh crore, as DICGC's annual report 2024-25 says).
import { dbieReport, dbieProvider } from "../databank.mjs";
import { writeSeries, writeRaw, readRaw } from "../util.mjs";

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const keyOf = (s, n = 70) => clean(s).toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n).replace(/_$/, "");
const num = (s) => { const t = clean(s).replace(/,/g, ""); if (t === "" || t === "-") return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
export function fiDate(s) {
  const t = clean(s); let m;
  if ((m = /^(\d{4})-(\d{2})$/.exec(t))) return `${+m[1] + 1}-03-01`;                                  // 1999-00
  if ((m = /^(\d{4})-([A-Za-z]{3})-(\d{2})$/.exec(t))) return `${m[1]}-${String(MON[m[2].toLowerCase()]).padStart(2, "0")}-01`;   // 2021-Mar-31
  if ((m = /^(\d{4})\/(\d{2})\/\d{2}/.exec(t))) return `${m[1]}-${m[2]}-01`;                              // 2012/03/31 00:00:00
  if ((m = /^(\d{4})$/.exec(t))) return `${m[1]}-03-01`;
  return null;
}
const sentence = (l) => { const t = clean(l); return t === t.toUpperCase() && /[A-Z]{4}/.test(t) ? t.toLowerCase().replace(/^./, (c) => c.toUpperCase()).replace(/\b(goi|ida|ibrd|rbi|ardr|kfw|nabard|ridf|sidbi|idbi|exim|ifci|icici|iibi|uti|gic|lic|sfcs?|sidcs?|scici|ivcf|tfci|irbi|iifcl|nrc|adfc|edf|vds|hlas|psus?|mt|lt|st|nhb|sebi)\b/gi, (w) => w.toUpperCase()) : t; };
const unitOf = (label) => (/\bno\.? of\b|number|issues$|^banks$/i.test(label) && !/amount/i.test(label) ? "count" : /%|per ?cent|percentage|ratio/i.test(label) ? "pct" : "inr_crore");

export const FI = [
  { id: "382", rel: "banks-fi-mutual-funds", date: "Fiscal Year", value: "Aggregate Value", dims: ["Item Description"], label: () => "Assets under management of mutual funds", coverage: "Assets managed by India's mutual funds at the end of each financial year" },
  { id: "383", rel: "banks-fi-psu-bonds", date: "Fiscal Year", value: "Aggregate Values", dims: ["Item"], coverage: "Bonds issued by public sector undertakings each year: taxable and tax-free" },
  { id: "384", rel: "banks-fi-insured-deposits", date: "Time Date", value: "Measure", dims: ["item description"], freq: "irregular", coverage: "Deposit insurance (DICGC): accounts fully protected, all accounts, insured deposits and assessable deposits, half-yearly and yearly since 1979" },
  { id: "385", rel: "banks-fi-dicgc-credit-guarantee", date: "Time Fis Year", value: "Amount(Rs. Crore)", dims: ["B/S Item Description"], coverage: "DICGC's Credit Guarantee Fund: liabilities and assets each year" },
  { id: "386", rel: "banks-fi-dicgc-deposit-insurance", date: "Time Fis Year", value: "Amount(Rs. Crore)", dims: ["B/S Item Description"], coverage: "DICGC's Deposit Insurance Fund: liabilities and assets each year (claims paid and outstanding, investments)" },
  { id: "387", rel: "banks-fi-dicgc-general", date: "Time Fis Year", value: "Amount(Rs. Crore)", dims: ["B/S Item Description"], coverage: "DICGC's General Fund: liabilities and assets each year" },
  { id: "388", rel: "banks-fi-nhb-refinance", date: "Year", value: "Value", dims: ["Disbursement/Outstanding", "Items"], coverage: "National Housing Bank's refinance to banks, housing finance companies and others: disbursed each year and outstanding" },
  { id: "389", rel: "banks-fi-assistance", date: "Year", value: "amount", dims: ["fin_institute_parent_description", "fin_institute_description", "item_description"], coverage: "Financial assistance sanctioned and disbursed by every all-India financial institution (IDBI, IFCI, ICICI, SIDBI, IIBI, LIC, UTI, GIC and others), each year since 1970-71" },
  { id: "390", rel: "banks-fi-lic-investments", date: "Calendar Year", value: "Aggregate Value", dims: ["Item Description"], coverage: "LIC's investments by sector (public, private, joint, co-operative) and instrument, each year" },
  { id: "391", rel: "banks-fi-ifci", date: "Year", value: "Amount (Rs. Crore)", dims: ["Parent Item Description", "Item Description", "Item Hierarchy Level3"], coverage: "IFCI's liabilities and assets, each year" },
  { id: "392", rel: "banks-fi-nabard", date: "Year", value: "Amount (Rs. Crore)", dims: ["Item Hierarchy Level1", "Item Description1"], coverage: "NABARD's liabilities and assets as on 31 March: capital, borrowings, refinance outstanding, rural infrastructure deposits" },
  { id: "393", rel: "banks-fi-nhb", date: "Year", value: "Amount (Rs. Crore)", dims: ["Item Hierarchy Level1", "B/S Item Description"], unitCol: "Derived Unit Desc.Unit Description", version: "Version Desc", coverage: "National Housing Bank's liabilities and assets, each year" },
  { id: "394", rel: "banks-fi-sfcs", date: "Year", value: "Amount", dims: ["Item Hierarchy Level1", "B/S Item Description"], coverage: "State financial corporations' liabilities and assets, each year since 1960s" },
  { id: "395", rel: "banks-fi-sidbi", date: "Year", value: "Amount (Rs. Crore)", dims: ["Item Hierarchy Level1", "B/S Item Description"], coverage: "SIDBI's liabilities and assets, each year" },
  { id: "396", rel: "banks-fi-nabard-assistance", date: "Year", value: "Value", dims: ["Item Description Type", "Items"], coverage: "NABARD's financial assistance: schemes sanctioned, assistance sanctioned, its commitment and disbursements, during each year and cumulatively" },
  { id: "398", rel: "banks-fi-private-placement", date: "Year", value: "Measure", dims: ["Hierarchy Level 1", "Hierarchy Level 2", "Hierarchy Level 3"], coverage: "Money raised in the private placement market by public and private sector issuers, financial and non-financial: number of issues and amounts" },
  { id: "801", rel: "banks-fi-industrial-refinance", date: "Year", value: "Value", dims: ["Institution", "Long term/Short term"], coverage: "The RBI's industrial refinance to financial institutions (IDBI, SIDBI, SFCs and others): long and short-term finance outstanding" },
  { id: "873", rel: "banks-fi-exim", date: "Time Fis Year", value: "Amount (Rs. Crore)", dims: ["Item Hierarchy Level1", "Parent Item Description", "Item Description", "Item Hierarchy Level3"], coverage: "EXIM Bank's liabilities and assets, each year" },
  { id: "1372", rel: "banks-fi-hdfc", date: "Fiscal Year", value: "Aggregate Value", dims: ["Item Description"], coverage: "HDFC Limited's housing loans: approvals, disbursements and amount outstanding, each year to 2023 (merged into HDFC Bank in July 2023)" },
];

export const FI_SINK = { on: false, out: [] };
/** Bake one table; returns its provenance. */
export function bakeTable(root, db, cfg, meta) {
  const r = cfg.dp ? dbieProvider(db, cfg.id, cfg.dp) : dbieReport(db, cfg.id);
  const unitCol = cfg.unitCol ?? "Unit Description";
  if (!r.header.includes(unitCol)) throw new Error(`banks-fi ${cfg.id}: no unit column "${unitCol}"`);
  for (const c of [cfg.date, cfg.value, ...cfg.dims]) if (!r.header.includes(c)) throw new Error(`banks-fi ${cfg.id}: no column "${c}" (have ${r.header.join(" | ")})`);
  const pick = new Map(), labels = new Map();
  let kept = 0;
  for (const x of r.rows) {
    if (x[unitCol] !== "ACTUALS") continue;
    const v = num(x[cfg.value]); if (v == null) continue;
    const d = fiDate(x[cfg.date]); if (!d) throw new Error(`banks-fi ${cfg.id}: unreadable date "${x[cfg.date]}"`);
    const dims = cfg.dims.map((c) => clean(x[c])).filter(Boolean);
    const dedup = dims.filter((p, i) => !i || p.toLowerCase() !== dims[i - 1].toLowerCase());
    const label = cfg.label ? cfg.label(dedup) : dedup.map(sentence).join(", ");
    const key = keyOf(dedup.join(" "));
    labels.set(key, label);
    const fin = cfg.version ? (/final/i.test(x[cfg.version]) ? 2 : /revised/i.test(x[cfg.version]) ? 1 : 0) : 0;
    const k = `${key}|${d}`, p = pick.get(k);
    // the same cell printed twice with different values and nothing to tell them apart: left
    // out and counted in the note (credit-deep's rule), never guessed
    if (p && p.fin === fin && p.v !== v) { p.conflict = true; continue; }
    if (!p || fin > p.fin) pick.set(k, { v, fin });
    kept++;
  }
  if (!pick.size) throw new Error(`banks-fi ${cfg.id}: no ACTUALS values in ${r.rows.length} rows`);
  const ds = [...new Set([...pick.keys()].map((k) => k.split("|")[1]))].sort();
  let dates = ds;
  if (!cfg.freq) { dates = []; for (let y = +ds[0].slice(0, 4); y <= +ds.at(-1).slice(0, 4); y++) dates.push(`${y}-03-01`); }
  const series = {}, conflicts = [];
  for (const [key, label] of [...labels].sort((a, b) => a[1].localeCompare(b[1]))) {
    const unit = unitOf(label);
    const data = dates.map((d) => { const o = pick.get(`${key}|${d}`); if (o?.conflict) conflicts.push(`${label} ${d.slice(0, 4)}`); return o == null || o.conflict ? null : unit === "inr_crore" ? Math.round((o.v / 1e7) * 100) / 100 : o.v; });
    if (data.every((x) => x == null || x === 0)) continue;
    const f = data.findIndex((x) => x != null), l = data.length - 1 - [...data].reverse().findIndex((x) => x != null);
    const gaps = dates.filter((d, i) => i > f && i < l && data[i] == null);
    series[key] = { name: `${key}_${unit}`, unit, label, data, ...(gaps.length ? { gaps, gapsNote: "The RBI's table prints no figure for these years." } : {}) };
  }
  if (FI_SINK.on) { FI_SINK.out.push({ rel: cfg.rel, report: cfg.id, labels: Object.fromEntries(labels), kept: Object.keys(series) }); return {}; }
  writeSeries(root, `data/series/${cfg.rel}.json`, { meta: { ...meta, frequency: cfg.freq ?? "annual", unit: "mixed", base: "as published", latestPeriod: dates.at(-1).slice(0, 7), coverage: cfg.coverage,
    note: `RBI DBIE report ${cfg.id} (financial institutions), read from the local Data Bank mirror, as published. One display unit kept (ACTUALS); amounts in ₹ crore, counts as numbers.${cfg.version ? " Final figures where the RBI has them, else provisional." : ""} ${cfg.freq ? "Dated to the month the RBI prints." : "Each year is dated to its March; a bare calendar year in the source is dated to March of that year (the table gives no month)."}${conflicts.length ? ` Left out: ${conflicts.length} cells the table prints twice with different values (${conflicts.slice(0, 3).join("; ")}${conflicts.length > 3 ? "..." : ""}).` : ""}` },
    dates, series });
  return { report: cfg.id, data_provider: r.provenance.data_provider, rows: r.rows.length, kept, sha256: r.provenance.sha256, retrieved_at: r.provenance.retrieved_at, document_id: r.provenance.document_id, bundle: cfg.rel, series: Object.keys(series).length };
}

export async function buildBanksFi(root, db, dcfg, runVintage) {
  // provenance first (the bundles carry its data vintage)
  const prov = FI.map((cfg) => { const r = cfg.dp ? dbieProvider(db, cfg.id, cfg.dp) : dbieReport(db, cfg.id); return { report: cfg.id, data_provider: r.provenance.data_provider, rows: r.rows.length, sha256: r.provenance.sha256, retrieved_at: r.provenance.retrieved_at, document_id: r.provenance.document_id }; });
  writeRaw(root, "data/raw/banks-fi.json", { vintage: runVintage, note: "Provenance of the RBI financial-institutions tables read from the local Data Bank mirror (read-only): report, data provider, rows, fetch time and the content sha256 of the stored copy, which pins every row.", reports: prov });
  const V = readRaw(root, "data/raw/banks-fi.json").vintage;
  const meta = { dossier: "banks", source: "Reserve Bank of India, DBIE (via the local Data Bank)", vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy };
  for (const cfg of FI) { const p = bakeTable(root, db, cfg, meta); console.log(`banks-fi: ${p.bundle}: ${p.series} series from ${p.kept} values`); }
}
