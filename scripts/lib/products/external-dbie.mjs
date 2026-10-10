// scripts/lib/products/external-dbie.mjs: shared machinery for the External account guide's
// three DBIE adapters (external-bop, external-flows, external-reer), and the family's catalogue
// generator:  node scripts/lib/products/external-dbie.mjs --catalogue
//
// Everything here reads the owner's Data Bank (read-only): the RBI DBIE webi mirror through the
// same files scripts/lib/databank.mjs reads, and the Data Bank's parsed datasets through
// databankQuery(). Never RBI live.
//
// Why a reader of its own: databank.mjs's dbieReport() returns only the largest data provider of
// a report. Many external-sector reports split one table across providers ("Old"/"New" BoP
// layouts, "dollar"/"inr" reserves, a metadata provider naming the IIP lines), so the adapters
// here read every flow provider of a report, latest validated fetch each, exactly as dbieReport
// chooses its one.
//
// DBIE quirks handled here (each was seen in the 2026-10-08 mirror):
//  - every value is repeated once per display unit (ACTUALS, THOUSANDS, LAKHS, MILLIONS, CRORES,
//    BILLIONS, and in some reports NUMBER, SECONDS, YEARS ...): the amount is the same in every
//    copy (it is always in actual units); we keep the ACTUALS copy only;
//  - some rows are misaligned by the SAP export (a unit name in the credit/debit column, a fiscal
//    year in the date column): rows whose date or key does not parse are dropped, never guessed;
//  - recent periods carry several revision versions at once (Provisional or Preliminary
//    Estimates, then Partially Revised, then Revised or Final): VRANK orders them, the latest
//    rank is the current value and the earlier ones are kept as vintages.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { databankRoot, databankQuery } from "../databank.mjs";
import { writeRaw } from "../util.mjs";
import { parseCsv } from "../tabular.mjs";

export { databankRoot, databankQuery };

/* ---------------- the reader ---------------- */

let INDEX = null;
function index(root) {
  if (INDEX) return INDEX;
  INDEX = new Map();
  const base = path.join(root, "data/raw/metadata/rbi_dbie/rbi_dbie_webi_rows");
  for (const run of fs.readdirSync(base)) {
    const dir = path.join(base, run);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const m = j.metadata || {};
      if (m.webi_role !== "flow" || !m.report_id || !m.dataprovider?.id) continue;
      const key = `${m.report_id}|${m.dataprovider.id}`;
      const prev = INDEX.get(key);
      if (!prev || j.retrieved_at > prev.retrieved) INDEX.set(key, { content: j.content_path, meta: m, retrieved: j.retrieved_at, sha256: j.sha256 });
    }
  }
  return INDEX;
}

/** Every data provider of a DBIE report: [{ id, name, header, rows, provenance }]. */
const CACHE = new Map();
export function dbieProviders(root, reportId) {
  const key = `${root}|${reportId}`;
  if (!CACHE.has(key)) CACHE.set(key, readProviders(root, reportId));
  return CACHE.get(key);
}
function readProviders(root, reportId) {
  const out = [];
  for (const [k, v] of index(root)) {
    if (!k.startsWith(reportId + "|")) continue;
    let buf = fs.readFileSync(v.content);
    if (v.meta.stored_encoding === "gzip") buf = zlib.gunzipSync(buf);
    // a real CSV parse: quoted DBIE text can hold ";" (report 1076, item 3.4.2.1), which a naive
    // split misaligns (found by atlas-services, 2026-10-09)
    const table = parseCsv(buf.toString("utf8"), ";").filter((r) => r.some((c) => String(c).trim() !== ""));
    const header = table[0].map((x) => String(x).trim());
    const rows = table.slice(1).map((c) => Object.fromEntries(header.map((h, i) => [h, String(c[i] ?? "").trim()])));
    out.push({ id: v.meta.dataprovider.id, name: v.meta.dataprovider.name, header, rows,
      provenance: { report_id: String(reportId), report: v.meta.document_name ?? null, data_provider: v.meta.dataprovider.id,
        provider_name: v.meta.dataprovider.name, rows: rows.length, retrieved_at: v.retrieved, sha256: v.sha256 } });
  }
  if (!out.length) throw new Error(`external-dbie: DBIE report ${reportId} is not in the Data Bank mirror`);
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** One named provider (by SAP provider name, case-insensitive), or throw. */
export function provider(root, reportId, name) {
  const all = dbieProviders(root, reportId);
  const p = all.find((x) => x.name.toLowerCase() === name.toLowerCase());
  if (!p) throw new Error(`external-dbie: report ${reportId} has no provider "${name}" (has: ${all.map((x) => x.name).join(", ")})`);
  return p;
}

/* ---------------- parsing helpers ---------------- */

export const num = (s) => {
  const t = String(s ?? "").replace(/,/g, "").trim();
  if (t === "" || /^(na|n\.a\.|-|–)$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
/** "2026/06/30 00:00:00" | "2026-06-30" -> [y, m, d] or null */
export function ymd(s) {
  const m = String(s ?? "").match(/^(\d{4})[/-](\d{2})[/-](\d{2})/);
  return m ? [+m[1], +m[2], +m[3]] : null;
}
const pad = (n) => String(n).padStart(2, "0");
/** period-end date -> the month it falls in, "YYYY-MM-01" */
export const monthOf = (s) => { const d = ymd(s); return d ? `${d[0]}-${pad(d[1])}-01` : null; };
/** quarter-end date (Jun/Sep/Dec/Mar) -> the quarter's first month, "YYYY-MM-01" (Q1 FY = April) */
export const quarterOf = (s) => {
  const d = ymd(s); if (!d || d[1] % 3 !== 0) return null;
  return `${d[0]}-${pad(d[1] - 2)}-01`;
};
/** the exact day, for weekly and daily series */
export const dayOf = (s) => { const d = ymd(s); return d ? `${d[0]}-${pad(d[1])}-${pad(d[2])}` : null; };
/** "2025-26" -> the fiscal year's first month "2025-04-01" (flows over a year) */
export const fyStart = (fy) => { const m = String(fy ?? "").match(/^(\d{4})-\d{2}$/); return m ? `${m[1]}-04-01` : null; };
/** "2025-26" -> the year-end month "2026-03-01" (stocks as on 31 March) */
export const fyEnd = (fy) => { const m = String(fy ?? "").match(/^(\d{4})-\d{2}$/); return m ? `${+m[1] + 1}-03-01` : null; };
/** "2025-26:Q1" -> "2025-04-01" */
export const fyQuarter = (q) => {
  const m = String(q ?? "").match(/^(\d{4})-\d{2}:Q([1-4])/); if (!m) return null;
  const y = +m[1], n = +m[2];
  return n === 4 ? `${y + 1}-01-01` : `${y}-${pad(1 + 3 * n)}-01`;
};
const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
/** "JUL-2015" | "2014:10(OCT)" -> "YYYY-MM-01" */
export function monthLabel(s) {
  let m = String(s ?? "").match(/^([A-Z]{3})-(\d{4})$/i);
  if (m && MON[m[1].toUpperCase()]) return `${m[2]}-${pad(MON[m[1].toUpperCase()])}-01`;
  m = String(s ?? "").match(/^(\d{4}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-01`;
  return null;
}

/** The provider's display-unit column, if it has one. */
export const unitColumn = (p) => p.header.find((h) => /^unit desc(ription)?$/i.test(h) || /^unit decs$/i.test(h) || /^Unit Desc$/i.test(h));
/** Rows of a provider in actual units only (every other display-unit copy repeats the amount). */
export function actuals(p) {
  const u = unitColumn(p);
  if (!u || !p.rows.some((r) => r[u] === "ACTUALS")) return p.rows;
  return p.rows.filter((r) => r[u] === "ACTUALS");
}

/**
 * Outline labels without context ("i) Surplus remitted ...", "(ii) Debt securities") read badly
 * on their own. Given rows in display order, return code -> "Parent: child" labels, where each
 * line's parent is the nearest earlier line one outline level up. Levels come from the prefix:
 * "A)"/"I." 1, "1)"/"I.A." 2, "a)"/"(i)" 3, "i)" 4; a bare label continues its predecessor's level + 1.
 */
export function outlinePaths(lines) {
  const strip = (l) => l.replace(/^([A-Z]\)|[A-Z]\.(?=\s?[A-Z])|[IVX]+(\.[A-Z0-9]+)*\.|\d+\)|[a-z]\s?\)|\([ivx]+\)|[ivx]+\.\d+\)|[ivx]+\))\s*/, "").replace(/\s+/g, " ").trim();
  const out = new Map(), stack = [];
  let prev = 1, prevLabel = "", l3Style = null, lastLetter = null, r3 = 0, r4 = 0;
  const rnum = (t) => { const v = { i: 1, v: 5, x: 10 }; let n = 0; for (let i = 0; i < t.length; i++) { const a = v[t[i]], b = v[t[i + 1]] ?? 0; n += a < b ? -a : a; } return n; };
  for (const { code, label } of lines) {
    let lv = null, style = null;
    const letter = label.match(/^([a-z])\s?\)\s/), roman = label.match(/^([ivx]+)\)\s/), paren = label.match(/^\(([ivx]+)\)\s/);
    const sub = label.match(/^[ivx]+\.\d+\)\s/);   // "iv.1)": a numbered split of the roman line before it
    if (/^[A-Z]\)\s|^[A-Z]\.\s?(?=[A-Z])|^[IVX]+\.\s/.test(label)) lv = 1;
    else if (sub) lv = Math.min((r4 ? 4 : r3 ? 3 : prev) + 1, 6);
    else if (/^\d+\)\s|^[IVX]+\.[A-Z0-9]+\.\s/.test(label)) lv = 2;
    else if (letter && !(("ivx".includes(letter[1])) && !(l3Style === "letter" && lastLetter === String.fromCharCode(letter[1].charCodeAt(0) - 1)))) { lv = 3; style = "letter"; lastLetter = letter[1]; }
    else if (roman || paren || letter) {
      // a roman numeral: one level under an open lettered list, else a list of its own at level
      // 3; a list that restarts at "i)" inside a roman list nests under its last item, and the
      // numbering decides where each later item belongs
      const n = rnum((roman ?? paren ?? letter)[1]);
      if (l3Style === "letter" && stack[3]) { lv = 4; r4 = n; }
      else if (l3Style === "roman" && stack[3] && n === 1 && r3 >= 1) { lv = 4; r4 = 1; }
      else if (l3Style === "roman" && r4 && n === r4 + 1 && n !== r3 + 1) { lv = 4; r4 = n; }
      else { lv = 3; style = "roman"; r3 = n; r4 = 0; }
    }
    // an unnumbered line hangs under the line before it, except a run of "of which" lines, which
    // are siblings under the same parent
    if (lv == null) lv = /^of which/i.test(label) && /^of which/i.test(prevLabel) ? prev : Math.min(prev + 1, 5);
    if (lv < 3) { l3Style = null; lastLetter = null; r3 = 0; r4 = 0; }
    else if (lv === 3) l3Style = style ?? l3Style;
    stack.length = lv; stack[lv] = strip(label);
    const parents = stack.slice(1, lv).filter(Boolean);
    out.set(code, parents.length ? `${parents.at(-1)}: ${strip(label)}` : strip(label));
    prev = lv; prevLabel = label;
  }
  return out;
}

/** Revision versions, earliest to latest. A row's version picks among values for the same key. */
export const VRANK = { Forecast: 0, Provisional: 1, "Preliminary Estimates": 2, "Partially Revised": 3, Revised: 4, Final: 5 };
export const vrank = (s) => {
  const r = VRANK[String(s ?? "").trim()];
  if (r == null) throw new Error(`external-dbie: unknown revision version "${s}"`);
  return r;
};

export const slug = (s, n = 48) => String(s).toLowerCase().normalize("NFKD").replace(/[^\x00-\x7f]/g, "")
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n).replace(/_$/, "");
/** strip a leading outline number ("1.2.1.5 ", "E.1.1 ", "(ii) ", "A.I.a. ") and footnote marks */
export const tidy = (s) => String(s).replace(/\s+/g, " ").replace(/\s*[#$@*^+]+\s*$/g, "").replace(/\s*\(([0-9A-Za-z.+ ]+|[0-9.]+ to [0-9.]+)\)$/, "").trim();

/* ---------------- the long-table baker ---------------- */

/**
 * Turn long rows into a bundle body. For every row: date(row) -> ISO or null (dropped),
 * key(row) -> series key or null (dropped), value(row) -> number or null. When several rows hit
 * one (key, date), rank(row) picks the latest version; identical values at one rank are fine,
 * conflicting ones throw (a misread table must never bake). label(key, row) names each series
 * once; order(row) sorts series (default: first seen).
 * Returns { dates, series: { key: { label, data } }, vintages } where vintages[key][date] is
 * [{ rank, version, value }] for every version seen (earliest first) when more than one exists.
 * tol: an absolute tolerance under which two copies of a cell count as the same value (rounding
 * noise between DBIE copies, e.g. 73.7562 and 73.7561 for one index month); the first is kept.
 */
export function bakeLong(rows, { date, key, value, rank = () => 0, version = () => null, label, order, unitScale = 1, round = 6, tol = 0 }) {
  const cells = new Map();   // key|date -> [{ rank, version, value }]
  const meta = new Map();    // key -> { label, order, seen }
  let seen = 0;
  for (const r of rows) {
    const d = date(r); if (!d) continue;
    const k = key(r); if (k == null) continue;
    const raw = value(r);
    const sc = typeof unitScale === "function" ? unitScale(k) : unitScale;
    const v = raw == null ? null : +(raw / sc).toFixed(round);
    const rk = rank(r);
    const ck = `${k}|${d}`;
    const list = cells.get(ck) ?? [];
    // several values at one version rank are kept; only a conflict at the winning (latest) rank
    // is fatal, checked below: superseded versions may disagree among themselves (DBIE carries two
    // "Partially Revised" 2023-24 debt totals under a "Revised" one) without touching the result
    const same = list.find((x) => x.rank === rk && (x.value === v || (x.value != null && v != null && Math.abs(x.value - v) <= Math.max(tol, 1e-9 * Math.max(1, Math.abs(v))))));
    if (!same) {
      const blank = list.find((x) => x.rank === rk && (x.value == null || v == null));
      if (blank) { if (blank.value == null) blank.value = v; }   // a blank copy is not a conflict
      else list.push({ rank: rk, version: version(r), value: v });
    }
    cells.set(ck, list);
    if (!meta.has(k)) meta.set(k, { label: label(k, r), order: order ? order(r) : seen, seen: seen++ });
  }
  const dates = [...new Set([...cells.keys()].map((ck) => ck.slice(ck.lastIndexOf("|") + 1)))].sort();
  const keys = [...meta.keys()].sort((a, b) => {
    const A = meta.get(a), B = meta.get(b);
    return A.order < B.order ? -1 : A.order > B.order ? 1 : A.seen - B.seen;
  });
  const series = {}, vintages = {};
  for (const k of keys) {
    series[k] = { label: meta.get(k).label, data: dates.map((d) => {
      const list = cells.get(`${k}|${d}`);
      if (!list) return null;
      list.sort((a, b) => a.rank - b.rank);
      const top = list.filter((x) => x.rank === list.at(-1).rank);
      if (top.length > 1) throw new Error(`bakeLong: conflicting values for ${k} at ${d}, latest version "${top[0].version}": ${top.map((x) => x.value).join(" vs ")}`);
      if (list.length > 1) (vintages[k] ??= {})[d] = list;
      return list.at(-1).value;
    }) };
  }
  return { dates, series, vintages };
}

/** Fill a continuous axis (months step 1 or 3, or a given list) so cadence holds; absent = null. */
export function onAxis(body, axis) {
  const idx = new Map(body.dates.map((d, i) => [d, i]));
  for (const s of Object.values(body.series)) s.data = axis.map((d) => (idx.has(d) ? s.data[idx.get(d)] : null));
  body.dates = axis;
  return body;
}
export function monthAxis(first, last, step = 1) {
  const out = []; let [y, m] = first.split("-").map(Number); const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) { out.push(`${y}-${pad(m)}-01`); m += step; while (m > 12) { m -= 12; y++; } }
  return out;
}

/**
 * Finish a bundle body for writeSeries: trim leading dates no series reports and trailing dates
 * no series reports (CONTRACT-series: no empty lead, no trailing nulls), drop series that are
 * entirely empty (listed in meta.emptyLines so nothing vanishes silently), and disclose every
 * interior null on the series that misses it.
 */
/**
 * The unit of one series, for the every-cut table (src/dossiers/everycut.js UNITS): read from the
 * series label where the bundle mixes units (ratios beside amounts, counts beside dollars),
 * else the bundle's own unit.
 */
export function unitFor(label, metaUnit) {
  const l = String(label);
  if (/tonnes/i.test(l)) return "tonnes";
  if (/paise/i.test(l)) return "paise";
  if (/in months\)?$|cover of reserves/i.test(l)) return "months";
  if (/per cent a year/i.test(l)) return "pct_per_annum";
  if (/to GDP|GDP Ratio/i.test(l)) return "pct_of_gdp";
  if (/per cent|%/i.test(l)) return "percent";
  // a ratio or share named without its unit ("E.9 Forex Reserves - Total Debt Ratio") is a per
  // cent, never the bundle's money unit (datafix: it showed as "$0.10 bn" in the every-cut table)
  if (/\bratio\b|\bshare of\b/i.test(l)) return "percent";
  if (/, number$/i.test(l)) return "count";
  if (/, years$/i.test(l)) return "years";
  if (/SDR million/.test(l)) return "sdr_million";
  if (/₹ crore/.test(l)) return "inr_crore";
  if (/US\$ million/.test(l)) return "usd_million";
  if (/^₹ per /.test(l)) return "inr_per_unit";
  if (/Receipts to Current Payments|Investment to Exports/i.test(l)) return "percent";
  if (metaUnit && !/mixed|percent_or_months/.test(metaUnit)) return metaUnit;
  throw new Error(`unitFor: no unit for series "${l}" (bundle unit ${metaUnit})`);
}

export function finish(body, gapsNote, metaUnit) {
  const any = (i) => Object.values(body.series).some((s) => s.data[i] != null);
  let a = 0, b = body.dates.length - 1;
  while (a <= b && !any(a)) a++;
  while (b >= a && !any(b)) b--;
  body.dates = body.dates.slice(a, b + 1);
  const empty = [];
  for (const [k, s] of Object.entries(body.series)) {
    s.data = s.data.slice(a, b + 1);
    const first = s.data.findIndex((v) => v != null);
    if (first < 0) { empty.push(s.label ?? k); delete body.series[k]; continue; }
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = [];
    for (let i = first + 1; i < last; i++) if (s.data[i] == null) gaps.push(body.dates[i]);
    if (gaps.length) { s.gaps = gaps; s.gapsNote = s.gapsNote ?? gapsNote; }
    if (metaUnit !== undefined) s.unit = s.unit ?? unitFor(s.label ?? k, metaUnit);
  }
  return { ...body, empty };
}

/* ---------------- archiving ---------------- */

/**
 * Archive the rows an adapter read, as read, to data/raw/<rel> (writeRaw keeps the old vintage
 * when nothing changed). Rows are stored as arrays under their header, ACTUALS-unit copies only
 * where a unit column exists (the other unit copies repeat the same amount). Returns the data
 * vintage of the archive.
 */
export function archive(root, rel, vintage, note, providers, keep = () => true) {
  const reports = {};
  for (const p of providers) {
    const unitCol = unitColumn(p);
    const hasActuals = unitCol && p.rows.some((r) => r[unitCol] === "ACTUALS");
    const rows = p.rows.filter((r) => (!hasActuals || r[unitCol] === "ACTUALS") && keep(r, p));
    // compact and lossless: a column that repeats an earlier one cell for cell is stored as a
    // pointer to it; each row is one line of the kept columns joined by ";" (the source's own
    // separator), CSV-quoted where a cell holds ";" or a quote
    const same = {};
    const kept = [];
    for (const h of p.header) {
      const twin = kept.find((k) => rows.every((r) => r[k] === r[h]));
      if (twin) same[h] = twin; else kept.push(h);
    }
    reports[`${p.provenance.report_id}:${p.id}`] = { provenance: { ...p.provenance, rows_archived: rows.length }, header: kept, sameAs: same,
      rows: rows.map((r) => kept.map((h) => { const c = String(r[h] ?? ""); return /[;"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; }).join(";")) };
  }
  return writeRaw(root, rel, { vintage, note, reports });   // the stored vintage
}

/* ---------------- the catalogue ---------------- */

// The family's scope, decided mechanically from the Data Bank's DBIE inventory: every report in
// an external-sector menu or section, or whose name names an external-sector statistic. Reports
// that are merchandise trade (the `trade` family's catalogue) or not external-sector statistics
// at all (gold prices, foreign equity indices, company finances, banks' branches abroad) are
// left to their own families; the patterns are listed so the choice is auditable.
export const SCOPE = {
  menus: ["External Debt", "External Sector Indices", "Exchange Rate", "Foreign Exchange Reserves", "Forex Market", "Forex Reserve",
    "International Finance", "Data on International Banking Statistics of India", "International Trade"],
  name: /balance of payments|\bbop\b|invisibles|investment position|foreign exchange reserves|forex reserves|exchange rate|\bneer\b|\breer\b|forward premia|nri deposit|foreign investment|\bfii|\bfpi|external debt|external assistance|external commercial|liberali[sz]ed remittance|foreign exchange market|purchase of u\.?s\.? dollar|invoicing in inr|settlement in inr|international liabilities|international claims|forex rates/i,
  trade: /foreign trade|principal commodities|commodity composition|select commodities|index numbers? (and terms )?of (foreign trade|exports|imports)|terms of foreign trade|trade in services/i,
  other: /gold and silver|equity market indices|finances? of (the )?select foreign direct|foreign direct investment compan|in foreign countries|banks in india . by type|consolidated international claims/i,
};

export function inventory(db) {
  const file = path.join(db, "data/derived/rbi_dbie_webi_inventory.csv");
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  // RFC-4180-ish: fields may be quoted and contain commas
  const parse = (l) => { const out = []; let cur = "", q = false;
    for (let i = 0; i < l.length; i++) { const c = l[i];
      if (q) { if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c; }
    out.push(cur); return out; };
  const head = parse(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(parse(l).map((v, i) => [head[i], v])));
}

export function inScope(r) {
  const hit = SCOPE.menus.includes(r.menu) || SCOPE.name.test(r.report_name);
  return hit && !SCOPE.trade.test(r.report_name) && !SCOPE.other.test(r.report_name);
}

/**
 * The catalogue generator. Each adapter exports `catalogue(db)` returning
 * { items: [...], handles: { reportId: "primary" | { dupOf, match } } }. Every in-scope report
 * must be handled by some adapter; one that is not is still listed (as a report-level item) so
 * the ledger has to take a position on it.
 */
async function writeCatalogue() {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
  const db = databankRoot(cfg.families?.databank);
  const inv = inventory(db).filter(inScope);
  const items = [], handled = new Map();
  for (const mod of ["external-bop.mjs", "external-flows.mjs", "external-reer.mjs"]) {
    const m = await import(path.join(path.dirname(fileURLToPath(import.meta.url)), mod));
    const c = m.catalogue(db);
    items.push(...c.items);
    for (const [id, h] of Object.entries(c.handles)) handled.set(String(id), h);
  }
  for (const r of inv) {
    if (handled.has(r.report_id)) continue;
    items.push({ id: `dbie:${r.report_id}:report`, label: `${r.report_name} (DBIE report ${r.report_id}, not yet read by any adapter)`,
      dims: { report: r.report_id, menu: r.menu, frequency: r.frequency, to: r.dbie_to_date } });
  }
  // items of a report whose copy claim failed its check are marked, so a ledger rule written for
  // verified copies cannot decide them
  for (const it of items) {
    const h = handled.get(String(it.dims?.report));
    if (h?.unverified && !/:copy-unverified$/.test(it.id)) it.id = it.id.replace(/^dbie:(\d+):/, "dbie:$1:unverified:");
  }
  const ids = new Set();
  for (const it of items) { if (ids.has(it.id)) throw new Error(`catalogue: duplicate id ${it.id}`); ids.add(it.id); }
  items.sort((a, b) => (a.id < b.id ? -1 : 1));
  const out = {
    family: "external",
    source: "Reserve Bank of India, Database on Indian Economy (DBIE), through the owner's Data Bank mirror",
    generator: "scripts/lib/products/external-dbie.mjs --catalogue",
    generated_at: new Date().toISOString().slice(0, 10),
    scope: { reports: inv.length, rule: "DBIE inventory reports in external-sector menus or naming an external-sector statistic; merchandise trade and non-external tables left to their families (SCOPE in the generator)" },
    reports: Object.fromEntries(inv.map((r) => [r.report_id, { name: r.report_name, menu: r.menu, frequency: r.frequency, to: r.dbie_to_date, handled: handled.get(r.report_id) ?? null }])),
    items,
  };
  const p = path.join(ROOT, "data/coverage/external.catalogue.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(out, null, 1) + "\n");
  console.log(`catalogue: ${items.length} items from ${inv.length} in-scope reports -> ${path.relative(ROOT, p)}`);
}

/**
 * Duplicate check for the catalogue: report `dup` claims to be the same table as `primary`
 * (DBIE serves one table under several menus). Both are reduced to key|date -> value maps with
 * the same functions; returns the share of the duplicate's cells that the primary carries with
 * the same value (within 1e-6 relative). The generator refuses a claim below 0.995.
 */
export function sameTable(primaryRows, dupRows, cell) {
  // a key can carry more than one value in the primary (DBIE repeats some cells with a second,
  // superseded value under the same version label): a duplicate cell matches if it equals any
  const P = new Map();
  for (const r of primaryRows) { const c = cell(r); if (c) { const a = P.get(c[0]); if (a) a.push(c[1]); else P.set(c[0], [c[1]]); } }
  const eq = (a, b) => a === b || (a != null && b != null && Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a)));
  let n = 0, hit = 0;
  for (const r of dupRows) {
    const c = cell(r); if (!c) continue; n++;
    if ((P.get(c[0]) ?? []).some((v) => eq(v, c[1]))) hit++;
  }
  return { cells: n, match: n ? Math.round((hit / n) * 10000) / 10000 : 0 };
}

export function dupHandle(db, primaryId, dupId, cell, pick = (ps) => ps, min = 0.995) {
  // rows carry their provider's name (r._p): two providers of one report can hold the same
  // date and line in different layouts, and a cell key that ignores this collides
  const tag = (ps) => ps.flatMap((p) => p.rows.map((r) => Object.assign(Object.create(r), { _p: p.name })));
  const P = tag(pick(dbieProviders(db, primaryId)));
  const D = tag(pick(dbieProviders(db, dupId)));
  const r = sameTable(P, D, cell);
  // a claim that fails is not thrown (one run reads every report and is slow): it is reported,
  // and the report's catalogue item is marked unverified so no ledger rule for copies fits it
  if (r.match < min) {
    console.error(`catalogue: report ${dupId} was declared a copy of ${primaryId} but only ${(r.match * 100).toFixed(2)}% of its ${r.cells} cells match`);
    return { dupOf: String(primaryId), ...r, unverified: true };
  }
  return { dupOf: String(primaryId), ...r };
}

export const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && process.argv.includes("--catalogue")) {
  // not awaited: the adapters import this module, so it must finish evaluating first
  writeCatalogue().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
}
