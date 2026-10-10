// scripts/lib/products/credit-deep.mjs: the long tail of the credit family. Every other RBI
// DBIE table on money, credit and banks that the guide does not draw, baked as published so
// that the guide's data downloads and every-cut table reach the finest cut the RBI publishes.
//
// One generic reader, one config line per table (DEEP below). A table's own columns decide
// everything: which column is the date, which the value, which the unit (one display unit kept,
// as DBIE repeats every value once per unit), which the version (Final over Provisional), and
// which columns name the series. Tables too large to load whole are streamed.
//
// The audit trail for these tables is a provenance file (data/raw/credit-deep.json): report,
// data provider, row count and the content sha256 of the Data Bank's immutable, content-addressed
// copy. Copying 30 million rows into git would add nothing the sha256 does not already pin.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { writeSeries, nullBornStandIns } from "../util.mjs";

const MON = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const pad = (n) => String(n).padStart(2, "0");
/** Any DBIE date form -> { iso, kind } where kind says what the date stands for. */
export function parseDbieDate(s) {
  const t = String(s ?? "").trim();
  let m;
  if ((m = t.match(/^(\d{4})[/-](\d{2})[/-](\d{2})/))) return { iso: `${m[1]}-${m[2]}-${m[3]}`, kind: "day" };
  if ((m = t.match(/^(\d{4})-(\d{2})$/)) && +m[2] === (+m[1] + 1) % 100) return { iso: `${+m[1] + 1}-03-31`, kind: "fy" };       // 2024-25
  if ((m = t.match(/^(\d{4})-(\d{4})$/))) return { iso: `${m[2]}-03-31`, kind: "fy" };
  if ((m = t.match(/^([A-Z]{3})-(\d{4})$/i)) && MON[m[1].toUpperCase()]) return { iso: `${m[2]}-${pad(MON[m[1].toUpperCase()])}-01`, kind: "month" };
  if ((m = t.match(/^(\d{4}):(\d{2})/))) return { iso: `${m[1]}-${m[2]}-01`, kind: "month" };                                          // 2015:06 (JUN)
  if ((m = t.match(/^([A-Z][a-z]{2}) (\d{1,2}), (\d{4})$/)) && MON[m[1].toUpperCase()]) return { iso: `${m[3]}-${pad(MON[m[1].toUpperCase()])}-${pad(+m[2])}`, kind: "day" };
  if ((m = t.match(/^(\d{4}):Q([1-4])$|^(\d{4})-(\d{2}):Q([1-4])$/))) {                                                                // 2025-26:Q1
    const y0 = +(m[3] ?? m[1]), q = +(m[5] ?? m[2]); const end = [`${y0}-06-30`, `${y0}-09-30`, `${y0}-12-31`, `${y0 + 1}-03-31`][q - 1]; return { iso: end, kind: "day" };
  }
  if ((m = t.match(/^(\d{4})$/))) return { iso: `${m[1]}-03-31`, kind: "fy" };
  return null;
}

/** Stream a gzip CSV (semicolon, quoted cells) row by row: cb(cells, header). */
export async function streamCsv(file, gz, cb) {
  let stream = fs.createReadStream(file); if (gz) stream = stream.pipe(zlib.createGunzip());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let header = null;
  for await (const line of rl) {
    if (!line) continue;
    const out = []; let cur = "", q = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ";" && !q) { out.push(cur.trim()); cur = ""; } else cur += ch; }
    out.push(cur.trim());
    if (!header) { header = out; continue; }
    cb(out, header);
  }
  return header;
}

/** Latest validated flow fetch of every (report, provider) in the Data Bank mirror. */
let IDX = null;
export function flowIndex(db) {
  if (IDX) return IDX;
  IDX = new Map();
  const base = path.join(db, "data/raw/metadata/rbi_dbie/rbi_dbie_webi_rows");
  for (const run of fs.readdirSync(base)) {
    const dir = path.join(base, run); if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); const m = j.metadata || {};
      if (m.webi_role !== "flow" || !m.report_id || !m.dataprovider?.id) continue;
      const k = `${m.report_id}|${m.dataprovider.id}`, p = IDX.get(k);
      if (!p || j.retrieved_at > p.retrieved) IDX.set(k, { content: j.content_path, gz: m.stored_encoding === "gzip", rows: m.dataprovider.rowCount ?? 0, name: m.dataprovider.name, retrieved: j.retrieved_at, sha256: j.sha256, document_id: m.document_id });
    }
  }
  return IDX;
}
export const providersOf = (db, id) => [...flowIndex(db).entries()].filter(([k]) => k.startsWith(id + "|")).map(([k, v]) => ({ dp: k.split("|")[1], ...v }));

// drop the table's own numbering ("MSM.1.1.4) ", "RBIS.1.1.1) ", "1.2A.2.1 ", "(iv) ", "3 . ") and its
// arithmetic notes ("(2+3)"), never a word ("No. of accounts" keeps its "No.")
const tidyLabel = (l) => String(l).replace(/\s+/g, " ").replace(/ & /g, " and ").trim()
  .replace(/^[A-Z]{2,6}[.\d]*\)\s*/, "").replace(/^\(?(?!no\b)[ivx]{1,5}[.)]\)?\s+(?=[A-Za-z])/i, "").replace(/^(\d+[A-Za-z]?\s*\.\s*)+(\d+[A-Za-z]?\s+)?(?=[A-Za-z(])/, "").replace(/^\d+(\.\d+[A-Za-z]?)*\s+(?=[A-Za-z(])/, "")
  .replace(/^\(?[a-z]\)\s+(?=[A-Za-z])/, "").replace(/\s*\(\s*\d+(\s*[+-]\s*\d+)+\s*\)/g, "").replace(/\s+,/g, ",").trim();
const ACRO = /^(NBFCS?|MSMES?|SCBS?|RRBS?|RBI|SHGS?|JLGS?|MFIS?|NRIS?|UCBS?|DICGC|NABARD|SIDBI|EXIM|IDBI|SBI|PSBS?|NPAS?|CRAR|GDP|HUF|NPISH|RIDF|FCNR|NRE|NRO|CP|CD|PSU|PSUS|LIC|GIC|UTI|II|III|IV|VI|VII|VIII|IX|XI|XII)$/;
const sentence = (l) => (l === l.toUpperCase() && /[A-Z]{4,}/.test(l) ? l.split(/(\W+)/).map((w) => (ACRO.test(w) ? w : w.toLowerCase())).join("").replace(/^\W*\w/, (c) => c.toUpperCase()).replace(/\bindia\b/g, "India") : l.replace(/\bindia\b/g, "India"));
const SMALL = new Set(["and", "of", "the", "&"]);
export const placeName = (v) => String(v).trim().toLowerCase().split(/(\s+|-|\(|\))/).map((w, i) => (i && SMALL.has(w) ? w : w.replace(/^\w/, (c) => c.toUpperCase()))).join("").replace(/\bAnd\b/g, "and");
const keyOf = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "x";
// a label whose last part is just "Number" ("Societies in Profit, Number") is a count too (2026-10-10)
const COUNT_RE = /(^|,\s*)number$|\b(no\.?|number|nos?)\b.*\b(of)\b|\baccounts?\b|borrowers|branches|offices|employees|banks\b|units\b|members|cases|shgs|centres|atms|staff|\bcount\b|outlets|cards issued/i;
const PCT_RE = /%|per ?cent|percentage|\bratios?\b|\brate\b|return on|yield|share in|\bcrar\b|margin/i;
export const RATIO_ROW = /\bratios?\b|as per ?cent|percentage (of|to)|as percentage|per ?cent (of|to)\b|% of\b|\(%\)/i;

/** Bake one DBIE table per its config. Returns a provenance record. */
export async function bakeDeep(root, db, cfg, meta) {
  const provs = providersOf(db, cfg.id).filter((p) => !cfg.dp || p.dp === cfg.dp).sort((a, b) => b.rows - a.rows);
  if (!provs.length) throw new Error(`credit-deep: report ${cfg.id}${cfg.dp ? " provider " + cfg.dp : ""} not in the Data Bank mirror`);
  const P = provs[0];
  const pick = new Map();   // seriesKey|date -> { v, final }
  const labels = new Map(), dvals = []; let header = null, n = 0, kept = 0;
  // cfg.also: further reports that publish the other half of the same table (e.g. spatial 6A
  // and 6B, each carrying some quarters of both); rows they share must agree to the rupee
  // also: [report, provider, {column overrides}] for a provider that names a column differently
  const parts = cfg.siblings ? await siblingParts(db, cfg)
    : [{ ...P, over: {} }, ...(cfg.also ?? []).map(([id, dp, over]) => { const q = providersOf(db, id).find((x) => x.dp === dp); if (!q) throw new Error(`credit-deep: report ${id} ${dp} not in the mirror`); return { ...q, id, over: over ?? {} }; })];
  let ci = null, clash = 0;
  for (const PP of parts) { ci = null; const C = { ...cfg, ...PP.over };
  header = await streamCsv(PP.content, PP.gz, (c, h) => {
    if (!ci) {
      const col = (name) => { const i = h.indexOf(name); if (i < 0) throw new Error(`credit-deep ${cfg.id}: no column "${name}" (have: ${h.join(" | ")})`); return i; };
      const vals = C.values ?? [{ col: C.value }];
      ci = { date: col(C.date), values: vals.map((v) => ({ ...v, i: col(v.col) })), dims: C.dims.map(col), unit: C.unitCol ? col(C.unitCol) : -1, version: C.version ? col(C.version) : -1 };
    }
    n++;
    if (ci.unit >= 0 && c[ci.unit] !== (cfg.unitKeep ?? "ACTUALS")) return;
    if (cfg.where && !cfg.where(c, h)) return;
    const d = parseDbieDate(c[ci.date]); if (!d) return;
    const dims = ci.dims.map((i) => c[i] ?? "");
    if (dims.every((x) => !x) && !cfg.allowNoDims) return;
    const fin = ci.version < 0 ? 3 : /final/i.test(c[ci.version]) || c[ci.version] === "F" ? 3 : /partial/i.test(c[ci.version]) ? 1 : /revised/i.test(c[ci.version]) ? 2 : 0;
    for (const v0 of ci.values) {
      const raw = cfg.parse ? cfg.parse(c[v0.i]) : String(c[v0.i] ?? "").replace(/,/g, ""); if (raw == null || raw === "" || raw === "-" || raw === "NULL" || isNaN(+raw)) continue;
      if (cfg.skip?.(c, h, v0)) continue;
      // cfg.measure: a value whose meaning depends on the row (a sub-table flag) is named per row
      const vv = cfg.measure ? cfg.measure(c, h, v0) : v0; if (!vv) continue;
      const key = [...dims.map(keyOf), ...(vv.key ? [vv.key] : [])].join("__") || "value";
      if (!labels.has(key)) { labels.set(key, { dims, vlabel: vv.label, unit: vv.unit }); dims.forEach((x, j) => (dvals[j] ??= new Set()).add(x)); }
      const k = `${key}|${d.iso}|${d.kind}`;
      const p = pick.get(k);
      if (PP !== parts[0] && p && p.fin === fin) { if (p.v !== +raw) clash++; continue; }
      // the same cell printed twice with different values (a fan-out in the export): we cannot
      // tell which is right, so the cell is marked and left out below
      if (p && p.fin === fin && p.v !== +raw) { p.conflict = true; continue; }
      if (!p || fin > p.fin) { pick.set(k, { v: +raw, fin }); kept++; }
    }
  }); }
  if (clash > (cfg.clashOk ?? 0)) throw new Error(`credit-deep ${cfg.id}: ${clash} values differ between ${parts.map((x) => x.id ?? cfg.id).join(" and ")}`);
  if (!pick.size) throw new Error(`credit-deep ${cfg.id}: no values kept from ${n} rows (check the unit filter "${cfg.unitKeep ?? "ACTUALS"}")`);
  // the axis: what the dates stand for decides the frequency
  const conflicts = [...pick.entries()].filter(([, o]) => o.conflict).map(([k]) => k.split("|"));
  const pts = [...pick.entries()].map(([k, o]) => { const [key, iso, kind] = k.split("|"); return { key, iso, kind, v: o.conflict ? null : o.v }; });
  const isos = [...new Set(pts.map((p) => p.iso))].sort();
  const gaps = isos.slice(1).map((d, i) => (Date.parse(d) - Date.parse(isos[i])) / 864e5).sort((a, b) => a - b);
  const med = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 365;
  const freq = cfg.freq ?? (pts[0].kind === "fy" || med > 300 ? "annual" : med > 80 ? "quarterly" : med > 25 ? "monthly" : med > 10 ? "fortnightly" : med > 3 ? "weekly" : "daily");
  const norm = (iso) => (freq === "annual" ? `${iso.slice(0, 4)}-03-01` : freq === "monthly" || freq === "quarterly" ? `${iso.slice(0, 7)}-01` : iso);
  // an annual table dated to March-end of each financial year; a calendar-year table (rare) says so
  const vals = new Map();
  for (const p of pts) { const d = norm(p.iso); vals.set(`${p.key}|${d}`, p.v); }
  let dates = [...new Set(pts.map((p) => norm(p.iso)))].sort();
  const step = { annual: 12, quarterly: 3, monthly: 1 }[freq];
  if (step) { const out = []; let [y, m] = dates[0].split("-").map(Number); for (;;) { const k = `${y}-${pad(m)}-01`; if (k > dates.at(-1)) break; out.push(k); m += step; while (m > 12) { m -= 12; y++; } } dates = out; }
  // labels: a dimension that only repeats another (a region beside its state, a numeric code)
  // stays in the key and leaves the label; cfg.dimLabel words a bare code ("2011" -> census)
  const hide = cfg.dims.map((c, j) => (cfg.hide ?? []).includes(c) ? true : (cfg.show ?? []).includes(c) ? false : [...(dvals[j] ?? [])].filter(Boolean).every((v) => /\bREGION$/i.test(v.trim()) || /^\d+$/.test(v.trim())) && !cfg.dimLabel?.[c]);
  for (const o of labels.values()) {
    const parts = o.dims.map((x, j) => (!x || hide[j] ? null : cfg.dimLabel?.[cfg.dims[j]] ? cfg.dimLabel[cfg.dims[j]](x) : (cfg.place ?? []).includes(cfg.dims[j]) ? placeName(x) : sentence(tidyLabel(x)))).filter(Boolean);
    const raw = o.dims.map((x, j) => (!x || hide[j] ? null : cfg.dimLabel?.[cfg.dims[j]] ? cfg.dimLabel[cfg.dims[j]](x) : (cfg.place ?? []).includes(cfg.dims[j]) ? placeName(x) : sentence(x.replace(/\s+/g, " ").trim()))).filter(Boolean);
    for (const L of [parts, raw]) for (let i = L.length - 1; i > 0; i--) if (L[i].toLowerCase() === L[i - 1].toLowerCase()) L.splice(i, 1);
    o.item = [parts.at(-1), o.vlabel].filter(Boolean).join(", ");
    if (o.vlabel) { parts.push(o.vlabel); raw.push(o.vlabel); }
    o.label = parts.join(", ") || (cfg.label ?? "Value"); o.raw = raw.join(", ");
  }
  // two source rows that tidy to the same label (e.g. "2.1 Central Government" deposits and
  // "4.1 Central Government" loans) keep the source's own numbering, so no two series read alike
  const seen = new Map(); for (const [, o] of labels) seen.set(o.label, (seen.get(o.label) ?? 0) + 1);
  for (const [, o] of labels) if (seen.get(o.label) > 1) o.label = o.raw;
  const seen2 = new Map(); for (const [k, o] of labels) { const n = (seen2.get(o.label) ?? 0) + 1; seen2.set(o.label, n); if (n > 1) o.label += ` (${n})`; }
  // the RBI's typewriter quotes (`Other' deposits) become plain ones (datafix: reader text)
  for (const o of labels.values()) { o.orig = o.label; for (const [re, to] of cfg.relabel ?? []) o.label = o.label.replace(re, to); o.label = o.label.replace(/`([^`']*)'/g, "'$1'").replace(/`/g, "'"); }
  const series = {}, slips = [];
  for (const [key, { label, orig, item, unit: vu }] of [...labels].sort((a, b) => a[1].label.localeCompare(b[1].label))) {
    const ub = (cfg.unitBy ?? []).find(([re]) => re.test(orig ?? label));
    let unit = vu ?? ub?.[1] ?? cfg.unit;
    // a row's unit from its label: ratios first, then amounts (an "amount outstanding with
    // co-operative banks" is money, not a count of banks), then counts, else money
    const it = item || label;
    if (unit === "auto") unit = PCT_RE.test(it) ? "pct" : /\bamount\b|outstanding|₹|rs\.? ?crore|deposits|advances|loans|credit|profit|loss|income|expen|charges|interest/i.test(it) && !/\b(no\.?|number)\b/i.test(it) ? "inr_crore" : COUNT_RE.test(it) ? "count" : "inr_crore";
    // a ratio row inside a money table ("% of PSA to ANBC", "Leverage Ratio", "NPA as percentage of
    // loans outstanding") is a per cent (a leverage ratio is times), never ₹ crore, and is not
    // divided by a crore (datafix 2026-10-10: these showed as ₹0.0000039 crore). Interest-rate
    // slabs ("5% to 6%, credit outstanding") are amounts and do not match.
    if (/^inr/.test(unit ?? "") && RATIO_ROW.test(label)) unit = /leverage ratio/i.test(label) ? "times" : "pct";
    const d = ub?.[2]?.div ? ub[2].div : unit === "inr_crore" ? (cfg.inCrore || ub?.[2]?.inCrore ? 1 : 1e7) : unit === "inr_lakh_crore" ? 1e12 : unit === "lakh_count" ? 1e5 : 1;
    // three decimals for 1 and above, four significant figures below (a small state's ₹ crore figure kept)
    const data = dates.map((dt) => { const v = vals.get(`${key}|${dt}`); if (v == null) return null; const x = (v * (cfg.scale ?? 1) * (cfg.scaleAt?.(key, dt) ?? 1)) / d; return Math.abs(x) >= 1 ? Math.round(x * 1000) / 1000 : x === 0 ? 0 : +x.toPrecision(4); });
    // a value 100,000 times its own series' median is the source printing rupees where the rest
    // of the series is in crore (or a ratio stored scaled); left out, and the note says where
    const nz = data.filter((x) => x != null && x !== 0).map(Math.abs).sort((a, b) => a - b), med = nz[Math.floor(nz.length / 2)];
    // and no percentage runs to a million: such a value is a scaled storage slip too
    if (/^pct/.test(unit)) data.forEach((x, i) => { if (x != null && (Math.abs(x) >= 1e6 || (cfg.pctMax != null && x > cfg.pctMax))) { slips.push(`${label} on ${dates[i]}`); data[i] = null; } });
    // an amount or a count a hundred times both its neighbours, which agree with each other, is
    // the same kind of slip (a value stored in the wrong unit for one date)
    if (unit === "count" || unit === "inr_crore") {
      const idx = data.map((x, i) => (x != null && x !== 0 ? i : -1)).filter((i) => i >= 0);
      for (let t = 1; t < idx.length - 1; t++) { const [a, b, c] = [data[idx[t - 1]], data[idx[t]], data[idx[t + 1]]];
        if (Math.sign(a) === Math.sign(b) && Math.sign(b) === Math.sign(c) && Math.abs(a / c) < 2 && Math.abs(c / a) < 2 && Math.abs(b / a) > 50 && Math.abs(b / c) > 50) { slips.push(`${label} on ${dates[idx[t]]}`); data[idx[t]] = null; } }
    }
    if (nz.length >= 5) data.forEach((x, i) => { if (x != null && Math.abs(x) > med * 1e5 && Math.abs(x) > 1e6) { slips.push(`${label} on ${dates[i]}`); data[i] = null; } });
    if (data.every((x) => x == null || x === 0) && !cfg.keepZero) continue;
    // a 0 that only pads the end of a stopped series is the source's filler, not a value
    let last = data.length - 1; while (last > 0 && (data[last] === 0 || data[last] == null)) last--;
    for (let i = last + 1; i < data.length; i++) data[i] = null;
    series[key] = { name: `${key}_${unit}`, label, unit, data };
  }
  // a display-order column: DBIE exports carry the report's row order as a value column (report
  // 662's "Num Chq" prints 17 for Mumbai in every year, 5 for Ahmedabad...). A measure whose
  // every series holds one small integer at every date, with the rows differing from each other,
  // is that code, not data: its series are dropped and the note says so (credit, 2026-10-10).
  const codeCols = [];
  { const byCol = new Map();
    for (const [key, s] of Object.entries(series)) { const col = labels.get(key)?.vlabel ?? ""; (byCol.get(col) ?? byCol.set(col, []).get(col)).push(key); }
    for (const [col, keys] of byCol) if (isCodeColumn(keys.map((k) => series[k].data))) { codeCols.push(col || "value"); for (const k of keys) delete series[k]; }
    if (codeCols.length) console.warn(`credit-deep ${cfg.id}: dropped display-order column(s) ${codeCols.join(", ")}`); }
  // a state's 0s before it existed (Telangana's co-operative banks in March 2014) are not values (util)
  nullBornStandIns(dates, series);
  // trim the axis to dates some series has; disclose interior gaps on each series
  const any = (i) => Object.values(series).some((s) => s.data[i] != null);
  let a = 0, b = dates.length - 1; while (a <= b && !any(a)) a++; while (b >= a && !any(b)) b--;
  const D = dates.slice(a, b + 1);
  for (const s of Object.values(series)) {
    s.data = s.data.slice(a, b + 1);
    const f = s.data.findIndex((v) => v != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const g = D.filter((dt, i) => i > f && i < l && s.data[i] == null); if (g.length) { s.gaps = g; s.gapsNote = "Not published for this date in the source table."; }
  }
  if (!Object.keys(series).length) throw new Error(`credit-deep ${cfg.id}: no series left to bake (every cell missing or ambiguous)`);
  const unitNote = cfg.unit === "auto" ? "Amounts in ₹ crore; counts as numbers; ratios in per cent, as each row's label says." : cfg.unit === "inr_crore" ? "Amounts in ₹ crore." : "";
  writeSeries(root, `data/series/${cfg.rel}.json`, { meta: { ...meta, frequency: freq, unit: cfg.unit === "auto" ? "mixed" : cfg.unit, base: cfg.base ?? `RBI DBIE report ${cfg.id}`, latestPeriod: D.at(-1),
    coverage: cfg.coverage, note: `RBI DBIE report ${cfg.id} (${P.name ? `data provider ${P.dp}` : P.dp})${cfg.also ? `, with report ${cfg.also.map((a) => a[0]).join(" and ")} for the dates it alone carries (shared rows agree)` : ""}, read from the local Data Bank mirror, as published. ${cfg.unitCol ? `One display unit kept (${cfg.unitKeep ?? "ACTUALS"}).` : ""} ${cfg.version ? "Final figures where published, else provisional." : ""} ${unitNote} ${cfg.note ?? ""} ${conflicts.length ? `${conflicts.length} cells the source prints more than once with different values (${[...new Set(conflicts.map((c) => c[1]))].slice(0, 4).join(", ")}${new Set(conflicts.map((c) => c[1])).size > 4 ? " and other dates" : ""}) are left out: we cannot tell which value is right.` : ""} ${codeCols.length ? `The export's display-order column (${codeCols.join(", ")}: one small code per row, the same in every year) is left out; it is not data.` : ""} ${parts.length > 1 && cfg.siblings ? `Measures read from the report's data providers ${parts.map((x) => x.dp).join(", ")}, each chosen by its content.` : ""} ${slips.length ? `Left out as printed in the wrong unit (${slips.length > 3 ? slips.length + " values, e.g. " : ""}${slips.slice(0, 3).join("; ")}).` : ""}`.replace(/\s+/g, " ").trim() }, dates: D, series });
  return { report: cfg.id, data_provider: P.dp, rows: n, sha256: P.sha256, retrieved_at: P.retrieved, document_id: P.document_id, bundle: cfg.rel, series: Object.keys(series).length,
    ...(cfg.also || cfg.siblings ? { also: parts.slice(1).map((x) => ({ report: x.id ?? cfg.id, data_provider: x.dp, sha256: x.sha256, retrieved_at: x.retrieved, document_id: x.document_id })) } : {}) };
}

/** True when a measure's series are display codes, not data: at least three series, each with
 *  at least three published dates holding one integer from 0 to 200 throughout, and the rows not
 *  all the same code. Genuine constants (a bank with one branch every year) sit beside series
 *  that move, so a whole measure of fixed small integers is the export's row order. */
export function isCodeColumn(datas) {
  const full = datas.map((d) => d.filter((v) => v != null)).filter((d) => d.length >= 3);
  if (full.length < 3 || full.length < datas.length * 0.8) return false;
  const codes = new Set();
  for (const d of full) { if (!d.every((v) => v === d[0] && Number.isInteger(v) && v >= 0 && v <= 200)) return false; codes.add(d[0]); }
  return codes.size >= 2;
}

/** cfg.siblings: a table split across its data providers, one measure each (report 662: the
 *  amounts in one provider, the number of cheques in another; report 743: MICR, non-MICR and
 *  total clearing houses). Every provider whose header has the table's date and dimension
 *  columns is read; its value column is the first column (not the date, a dimension or a unit
 *  column) that holds numbers and is not a display-order code (isCodeColumn); cfg.siblings
 *  names the measure from what the provider is (its name, whether it carries the display-unit
 *  picker) and returns null for a provider to skip. Provider ids are never named: DBIE
 *  renumbers them between exports. */
async function siblingParts(db, cfg) {
  const out = [];
  for (const p of providersOf(db, cfg.id).sort((a, b) => b.rows - a.rows)) {
    const rows = []; const header = await streamCsv(p.content, p.gz, (c) => rows.push(c));
    if (!header.includes(cfg.date) || !cfg.dims.every((d) => header.includes(d))) continue;
    const hasUnit = !!cfg.unitCol && header.includes(cfg.unitCol);
    const keep = rows.filter((c) => !hasUnit || c[header.indexOf(cfg.unitCol)] === (cfg.unitKeep ?? "ACTUALS"));
    const skip = new Set([cfg.date, ...cfg.dims]);
    const cands = header.filter((h) => !skip.has(h) && !/^unit/i.test(h));
    let col = null;
    for (const h of cands) {
      const i = header.indexOf(h), bySeries = new Map();
      for (const c of keep) { const raw = cfg.parse ? cfg.parse(c[i]) : String(c[i] ?? "").replace(/,/g, ""); if (raw == null || raw === "" || isNaN(+raw)) continue;
        const k = cfg.dims.map((d) => c[header.indexOf(d)]).join("|"); (bySeries.get(k) ?? bySeries.set(k, new Map()).get(k)).set(c[header.indexOf(cfg.date)], +raw); }
      if (!bySeries.size) continue;
      if (isCodeColumn([...bySeries.values()].map((m) => [...m.values()]))) continue;
      col = h; break;
    }
    if (!col) continue;
    const m = cfg.siblings({ name: p.name, hasUnit });
    if (!m) continue;
    out.push({ ...p, over: { values: [{ col, ...m }], unitCol: hasUnit ? cfg.unitCol : null } });
  }
  if (!out.length) throw new Error(`credit-deep ${cfg.id}: no data provider with a value column`);
  return out;
}

/** Clearing-house counts as STRBI Table 27 prints them: "1030 (52)" (total, MICR in brackets),
 *  "(16)" (MICR only), "1306(64+2*)$" (footnote marks): the number outside the brackets, else
 *  the bracketed sum. */
export function strbiCount(s) {
  const t = String(s ?? "").replace(/[*$#@]/g, "").trim(); if (!t) return null;
  const lead = /^(\d+)/.exec(t); if (lead) return lead[1];
  const br = /^\(([^)]*)\)$/.exec(t); if (br) { const n = br[1].match(/\d+/g); return n ? String(n.reduce((a, b) => a + +b, 0)) : null; }
  return null;
}

/* ---------- the tables, one line each ----------
 * id, dp (data provider), rel (bundle), coverage, date / value(s) / dims (column names),
 * unitCol + unitKeep (the display unit kept), version (Final over Provisional), unit:
 * inr_crore | count | pct | auto (per row: counts, ratios, else amounts in ₹ crore). */
const U = "Unit Description", UD = "Unit Desc";
export const DEEP = [
  // money, reserve money and the RBI's own accounts, beyond the Data Query tables
  { id: "6", rel: "credit-deep-cash-balances", date: "Date", value: "Item Values", dims: ["Description"], unitCol: U, unit: "inr_crore", coverage: "Scheduled commercial banks' cash balances with the RBI, every day since 2006 (the cash reserve banks keep)" },
  { id: "15", rel: "credit-deep-standing-facilities", date: "Date", value: "Amount", dims: ["item_hierarchy_level1", "Item Description (Bulletin)"], unitCol: U, unit: "inr_crore", coverage: "The RBI's standing facilities: export credit refinance, liquidity facilities for primary dealers, limits and amounts outstanding" },
  { id: "16", rel: "credit-deep-liquidity-aggregates", date: "Month", value: "Amount (Rs. Crore)", dims: ["Components of Liquidity"], unitCol: U, unit: "inr_crore", coverage: "Liquidity aggregates L1, L2 and L3: money plus postal deposits, financial institutions' borrowing and deposits, monthly since 1993" },
  { id: "24", rel: "credit-deep-monetary-survey", date: "Date", value: "Amount (in Rs. Crore)", dims: ["NMA Item Desc"], unitCol: "Unit DECS rbib 10", unit: "inr_crore", coverage: "The monetary survey: new monetary aggregates (NM2, NM3), their components and sources, fortnightly since 1999" },
  { id: "546", rel: "credit-deep-rbi-survey", date: "Date", value: "Item Value hbs 168", dims: ["RBIS Item Desc"], unitCol: UD, unit: "inr_crore", coverage: "The Reserve Bank of India survey: reserve money's components and the RBI's claims, monthly" },
  { id: "1548", rel: "credit-deep-flow-of-resources", date: "Time Date", value: "Item Value", dims: ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Description"], version: "Version Desc", unit: "inr_crore", coverage: "Flow of financial resources to the commercial sector: from banks and from non-bank sources at home and abroad (bonds, equity, NBFCs, foreign direct investment, external borrowing), each financial year so far" },
  { id: "1549", rel: "credit-deep-credit-to-commercial-sector", date: "Time Date", value: "Item Value", dims: ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Description"], version: "Version Desc", unit: "inr_crore", coverage: "Outstanding credit to the commercial sector from banks and from non-bank sources at home and abroad" },
  { id: "252", rel: "credit-deep-money-components-annual", date: "Time Date", value: "Amount (in Rs. Crore)", dims: ["RM Item Desc"], unitCol: UD, unit: "inr_crore", coverage: "Components of money stock and reserve money at the end of every financial year since 1951-52" },
  { id: "98", rel: "credit-deep-money-sources-annual", date: "Date", value: "Amount (in Rs. Crore)", dims: ["SOMS Item Desc"], unitCol: UD, unit: "inr_crore", where: (c, h) => c[h.indexOf("Time Fis End Of Year")] === "Y", coverage: "Sources of money stock at the end of every financial year since 1950-51" },
  { id: "96", rel: "credit-deep-average-money", date: "Fis Year", value: "Item Value", dims: ["Item Description"], unitCol: U, unit: "inr_crore", coverage: "Monetary aggregates averaged over each financial year, since 1951-52" },
  { id: "729", rel: "credit-deep-reserve-money-annual", date: "Time Fis Year", value: "Item Value Annual", dims: ["Item Description"], unitCol: U, unit: "inr_crore", coverage: "Reserve money's components and sources, each financial year" },
  { id: "89", rel: "credit-deep-rbi-accounts-annual", date: "Week", value: "Amount", dims: ["Hbs Hierarchy Level1", "Hbs Description"], unitCol: UD, unit: "inr_crore", freq: "annual", coverage: "The Reserve Bank's liabilities and assets, Issue and Banking Departments, at the end of every year since 1971" },
  { id: "568", rel: "credit-deep-money-growth-annual", date: "Fiscal Year (Bulletin)", value: "Item Value", dims: ["OMA Item Desc"], unit: "pct", coverage: "Growth of select monetary aggregates, each financial year since 1970-71, as the RBI publishes it" },
  { id: "764", rel: "credit-deep-monetary-ratios", date: "Fiscal Year", value: "Aggregate Values", dims: ["Hierarchy Level 1", "Item"], unit: "inr_crore", unitBy: [[/%/, "pct"], [/\//, "times"]], inCrore: true, coverage: "Select monetary ratios and the aggregates behind them, each financial year since 1951-52" },
  // credit, annual and by place, from the Handbook
  { id: "291", dp: "DP3", rel: "credit-deep-sectoral-annual-old", date: "Reporting Date", value: "Amount (Rs. Crore)", dims: ["Item Description"], unitCol: U, unit: "inr_crore", base: "Sectoral deployment, old format", coverage: "Non-food bank credit by sector at the end of each financial year, old classification" },
  { id: "291", dp: "DP0", rel: "credit-deep-sectoral-annual", date: "Reporting Date", value: "Amount (Rs. Crore)", dims: ["Item Description"], unitCol: U, unit: "inr_crore", base: "Sectoral deployment, new format", coverage: "Non-food bank credit by sector at the end of each financial year, current classification" },
  { id: "291", dp: "DP1", rel: "credit-deep-sectoral-annual-long", date: "Fiscal Year (Last Reporting Friday of March)", value: "Measure", dims: ["Item at Report level"], unitCol: U, unit: "inr_crore", base: "Sectoral deployment, the Handbook's long series", coverage: "Non-food bank credit by sector at the end of every financial year since 1980, the Handbook's long table" },
  { id: "526", dp: "DP1", rel: "credit-deep-industry-annual-long", date: "Fiscal Year (Last Reporting Friday of March)", value: "Measure", dims: ["Item at Report level"], unitCol: U, unit: "inr_crore", base: "Industry-wise deployment, the Handbook's long series", coverage: "Bank credit to industry by industry at the end of every financial year since 1990, the Handbook's long table" },
  { id: "526", dp: "DP0", rel: "credit-deep-industry-annual", date: "Reporting Date", value: "Amount (Rs. Crore)", dims: ["Item Description"], unitCol: U, unit: "inr_crore", base: "Industry-wise deployment, new format", coverage: "Bank credit to industry by industry at the end of each financial year, current classification" },
  { id: "103", rel: "credit-deep-savings-deposits", date: "Fiscal Year", value: "Amount", dims: ["Item Desc"], unitCol: U, unit: "inr_crore", coverage: "Savings deposits with commercial banks, Indian and foreign banks, each year since 1950-51" },
  { id: "112", rel: "credit-deep-rrb-indicators", date: "Time Date", value: "Amount", dims: ["Item Desc"], unitCol: UD, version: "Version Desc", unit: "inr_crore", coverage: "Regional rural banks' deposits, credit, investments and cash, every March since 1980" },
  { id: "114", dp: "DP1", rel: "credit-deep-credit-population-annual", date: "Year", value: "ACCOUNT_NO_AMOUNT", dims: ["V Popg D Pop Group Desc", "ITEM_DESCRIPTION"], unitCol: UD, unit: "auto", coverage: "Bank credit by rural, semi-urban, urban and metropolitan centres: accounts and amounts, every March since 1980" },
  { id: "114", dp: "DP0", rel: "credit-deep-deposits-population-annual", date: "Year", value: "ACCOUNT_NO_AMOUNT", dims: ["V Popg D Pop Group Desc", "ITEM_DESCRIPTION"], unitCol: UD, unit: "auto", coverage: "Bank deposits by rural, semi-urban, urban and metropolitan centres: accounts and amounts, every March since 1980" },
  { id: "115", rel: "credit-deep-branches-population", date: "Time Date", value: "No Of Branch", dims: ["Population Group Name"], unit: "count", coverage: "Bank branches by rural, semi-urban, urban and metropolitan centres, every March since 1969" },
  { id: "117", rel: "credit-deep-bank-balance-sheet", date: "Fiscal Year", value: "Amount (Rs. crore)", dims: ["Liability Asset Indicator", "Items Description"], unitCol: U, version: "Version Desc", unit: "inr_crore", coverage: "Consolidated balance sheet of scheduled commercial banks: capital, deposits, borrowings, investments, advances, each year since 1990-91" },
  { id: "118", rel: "credit-deep-cooperative-npa", date: "Time Date", value: "item_value", dims: ["item_description"], version: "Version Desc", unit: "pct", coverage: "Bad loans of co-operative banks: gross NPA ratios of urban co-operative banks and the rural co-operative tiers, every March since 1995" },
  { id: "199", rel: "credit-deep-bank-employees", date: "Date", value: "Measure", dims: ["Bank Group", "Staff Category"], unit: "count", coverage: "Employees of scheduled commercial banks by bank group: officers, clerks and subordinate staff, every March since 1992" },
  { id: "200", rel: "credit-deep-shg", date: "Time Date", value: "loan_value", dims: ["item_description"], unitCol: "Dim Unit Derived.Unit Description", unit: "auto", unitBy: [[/No\. of/i, "count", { div: 1e5 }]], note: "Numbers of groups are stored in the mirror multiplied by 100,000 (26.98 lakh groups in 2018-19 as 269,840,000,000, NABARD's own figure once divided back).", coverage: "Self-help group bank linkage: groups financed and bank loans to them, each year since 1992-93" },
  { id: "255", dp: "DP0", rel: "credit-deep-pacs", date: "Year", value: "Amount (Rs crore)", dims: ["Agricultural Banks Types", "Advanced/Amount", "Type of Measure"], unitCol: U, unit: "auto", coverage: "Loans of primary agricultural credit societies and land development banks: borrowers and amounts, each year since 1977-78" },
  { id: "281", rel: "credit-deep-state-cooperative-banks", date: "Time Fis Year", value: "Item Value HBS 59", dims: ["Hbs Hierarchy Level1", "Hbs Hierarchy Level2", "Hbs Hierarchy Level3"], unitCol: U, unit: "auto", coverage: "State co-operative banks that keep accounts with the RBI: deposits, borrowings and credit, each year since 1983-84" },
  { id: "299", rel: "credit-deep-term-deposit-maturity", date: "Time Date", value: "account_no_amount", dims: ["Account Type Level1", "Account Type Level2"], unitCol: U, unit: "auto", coverage: "Term deposits of scheduled commercial banks by original maturity: accounts and amounts, every March since 1990" },
  { id: "72", rel: "credit-deep-agri-institutional", date: "Year", value: "Measure", dims: ["Type of INSTITUTION", "Loan Issued/Outstanding"], unitCol: UD, unit: "inr_crore", coverage: "Institutional credit to agriculture by lender (co-operatives, regional rural banks, commercial banks, state governments): loans issued and outstanding, each year since 1971-72" },
  { id: "473", rel: "credit-deep-agri-short-term", date: "Year", value: "Measure", dims: ["Type of INSTITUTION", "Loan Issued/Outstanding"], unitCol: UD, unit: "inr_crore", coverage: "Direct short-term institutional credit to agriculture by lender, each year (discontinued table)" },
  { id: "790", rel: "credit-deep-agri-long-term", date: "Year", value: "Measure", dims: ["Type of INSTITUTION", "Loan Issued/Outstanding"], unitCol: UD, unit: "inr_crore", coverage: "Direct long-term institutional credit to agriculture by lender, each year (discontinued table)" },
  { id: "749", rel: "credit-deep-agri-indirect", date: "Year", value: "Measure", dims: ["Type of INSTITUTION", "Loan Issued/Outstanding"], unitCol: UD, unit: "inr_crore", coverage: "Indirect institutional credit to agriculture by lender, each year (discontinued table)" },
  { id: "474", rel: "credit-deep-agri-scb", date: "Year", value: "Amount (in Rs. Crore)", dims: ["Agr Scb Description"], unitCol: UD, unit: "inr_crore", coverage: "Scheduled commercial banks' advances to agriculture by kind, each year from 1971 to 2020 (discontinued)" },
  { id: "756", rel: "credit-deep-farmers-landholding-short", date: "Year", value: "Actual amount", dims: ["Range of Land Holding", "Account/Amount"], unitCol: UD, unit: "auto", coverage: "Banks' direct finance to farmers by size of land holding, short-term: accounts and amounts, 1981 to 2012 (discontinued)" },
  { id: "757", rel: "credit-deep-farmers-landholding-long", date: "Year", value: "Actual amount", dims: ["Range of Land Holding", "Account/Amount"], unitCol: UD, unit: "auto", coverage: "Banks' direct finance to farmers by size of land holding, long-term: accounts and amounts, 1981 to 2012 (discontinued)" },
  { id: "758", rel: "credit-deep-small-industries", date: "Year", value: "Amount (in Rs. Crore)", dims: ["Description"], unit: "inr_crore", inCrore: true, coverage: "Scheduled commercial banks' advances to small-scale industries, 1971 to 2020 (discontinued)" },
  { id: "762", rel: "credit-deep-sick-units", date: "Year (End March)", value: "N Amount Actual", dims: ["V Item Cd"], unitCol: U, unit: "inr_crore", unitBy: [[/\(Units\)$/, "count", { div: 1e7 }], [/Units \(Million|Employment/, "count"], [/US \$ million/, "usd_millions", { div: 1e6 }], [/per employee/, "inr", { div: 1 }]],
    relabel: [[/ \(Million Nos\.\)/, " (number)"], [/Rs\. thousand, /, "₹, "], [/Rs\. [Cc]rore, /, "₹ crore, "]],
    note: "Counts of sick and weak units are stored in the mirror multiplied by 10 million (85,187 sick small units in March 2008 as 851,870,000,000, the RBI's printed count once divided back); the counts of all small units and of their workers are stored as plain numbers although the labels say millions, and are kept as numbers; exports are in US$ million; production per employee in rupees.", coverage: "Sick small and large industrial units financed by banks: numbers and amounts outstanding, 1987 to 2017 (discontinued)" },
  { id: "905", rel: "credit-deep-food-procurement", date: "Date", value: "Copy of Outstanding Advences", dims: ["Bank Group Level3"], unitCol: U, unit: "inr_crore", coverage: "Banks' outstanding advances for public food procurement, by bank group, monthly since 2005" },
  { id: "906", rel: "credit-deep-exporters", date: "DATE", value: "Outstanding Advances_actuals", dims: [], allowNoDims: true, label: "Outstanding advances to exporters", unitCol: UD, unitKeep: "CRORES", unit: "inr_crore", coverage: "Scheduled commercial banks' outstanding advances to exporters, quarterly 2005 to 2018 (discontinued)" },
  { id: "446", rel: "credit-deep-notes-coins", date: "Year", value: "Amount (in Rs. crore/Number)", dims: ["Curr Coin Hierarchy Level 1", "Notes & Coin issued/ Currency Chests, Repositories & Small Coin Depots"], unitCol: U, unit: "auto", coverage: "Notes and coins in circulation by denomination, and the network of currency chests, each year since 1970-71" },
  { id: "450", rel: "credit-deep-nbfc-deposits", date: "Time Fis Year", value: "Item Value", dims: ["Company Type", "Item Hierarchy Level 2"], unitCol: U, version: "Version Desc", unit: "auto", coverage: "Deposits held by non-banking finance companies, by type of company, each year since 1997-98" },
  { id: "760", rel: "credit-deep-nbfc-financials", date: "Time Date", value: "Amount actual", dims: ["Tblno", "V Item D Itmdescr"], unitCol: UD, unit: "auto", unitBy: [[/%|\bratio\b/i, "pct", { div: 1e7 }]], note: "Ratios are stored in the mirror multiplied by 10 million (a CRAR of 31 per cent as 310,000,000) and are divided back.", coverage: "Financial statistics of the NBFC sector: balance sheet and income items, quarterly 2012 to 2015 (discontinued)" },
  { id: "1198", rel: "credit-deep-nbfc-sectors-2016", date: "D Time D Date", value: "Amount", dims: ["Rtp Desc"], version: "P F Flag", unit: "inr_crore", scale: 1e9, note: "The table's amounts are ₹ billion (NBFCs' gross advances about 17,600 in March 2018); converted to ₹ crore.", coverage: "Credit by NBFCs to various sectors, 2016 to 2018" },
];

// BSR-1 quarterly cross-tables: three measures each for total credit (set 1) and for small
// borrowal accounts, credit limits up to ₹2 lakh (set 2). Amounts are rupees in the source.
const bsrSets = (a, l, o, a2, l2, o2) => [
  { col: a, key: "accounts", label: "loan accounts", unit: "count" }, { col: l, key: "limit", label: "credit limits", unit: "inr_crore" }, { col: o, key: "amount", label: "credit outstanding", unit: "inr_crore" },
  ...(a2 ? [{ col: a2, key: "small_accounts", label: "small borrowal accounts, loan accounts", unit: "count" }, { col: l2, key: "small_limit", label: "small borrowal accounts, credit limits", unit: "inr_crore" }, { col: o2, key: "small_amount", label: "small borrowal accounts, credit outstanding", unit: "inr_crore" }] : []),
];
const KEYD = ["Key Description 1", "Key Description 2", "Key2 Description 1"];
const S1 = bsrSets("Num Of Acc", "Credit Limit", "Amt Outstd", "Set2 Num Of Acc", "Set2 Credit Limit", "Set2 Amt Outstd");
const BQ = (id, rel, coverage, extra = {}) => ({ id, rel, date: "Time Date", values: S1, dims: KEYD, unit: "inr_crore", base: "BSR-1 quarterly, excluding RRBs", coverage, ...extra });
DEEP.push(
  BQ("950", "credit-deep-bsr1-pop-bankgroup", "Bank credit by population group and bank group, total and small borrowal accounts, every quarter since June 2017"),
  BQ("951", "credit-deep-bsr1-state-pop", "Bank credit by state and population group, total and small borrowal accounts, every quarter since March 2014"),
  BQ("952", "credit-deep-bsr1-state-bankgroup", "Bank credit by state and bank group, total and small borrowal accounts, every quarter since June 2017"),
  BQ("953", "credit-deep-bsr1-bankgroup-size", "Bank credit by bank group and size of credit limit, every quarter since June 2017"),
  BQ("954", "credit-deep-bsr1-size-rate", "Bank loans by size of credit limit and interest rate band, every quarter since March 2021"),
  BQ("955", "credit-deep-bsr1-account-rate", "Bank loans by type of account and interest rate band, every quarter since March 2021"),
  BQ("956", "credit-deep-bsr1-bankgroup-rate", "Bank loans by bank group and interest rate band, every quarter since March 2021"),
  BQ("957", "credit-deep-bsr1-account-occupation", "Bank credit by type of account and occupation, every quarter since March 2014"),
  BQ("958", "credit-deep-bsr1-organisation-occupation", "Bank credit by kind of borrower and occupation, every quarter since March 2014"),
  BQ("959", "credit-deep-bsr1-rate-occupation", "Bank loans by interest rate band and occupation, every quarter since March 2021"),
  BQ("960", "credit-deep-bsr1-size-occupation", "Bank credit by size of credit limit and occupation, every quarter since March 2014"),
  BQ("968", "credit-deep-bsr1-size-rate-2014", "Bank loans by size of credit limit and interest rate band, the older table, March 2014 to September 2023", { base: "BSR-1 quarterly, interest rate bands to September 2023" }),
  BQ("969", "credit-deep-bsr1-bankgroup-rate-2017", "Bank loans by bank group and interest rate band, the older table, June 2017 to September 2023", { base: "BSR-1 quarterly, interest rate bands to September 2023" }),
  BQ("970", "credit-deep-bsr1-rate-occupation-2014", "Bank loans by interest rate band and occupation, the older table, March 2014 to September 2023", { base: "BSR-1 quarterly, interest rate bands to September 2023" }),
  BQ("971", "credit-deep-bsr1-account-rate-2014", "Bank loans by type of account and interest rate band, the older table, March 2014 to September 2023", { base: "BSR-1 quarterly, interest rate bands to September 2023" }),
  BQ("973", "credit-deep-bsr1-pop-bankgroup-2014", "Bank credit by population group and the old bank groups, March 2014 to September 2023", { base: "BSR-1 quarterly, bank groups before 2017" }),
  BQ("974", "credit-deep-bsr1-bankgroup-size-2014", "Bank credit by the old bank groups and size of credit limit, March 2014 to September 2023", { base: "BSR-1 quarterly, bank groups before 2017" }),
  BQ("975", "credit-deep-bsr1-bankgroup-rate-2014", "Bank loans by the old bank groups and interest rate band, March 2014 to September 2023", { base: "BSR-1 quarterly, bank groups before 2017" }),
  BQ("978", "credit-deep-bsr1-state-bankgroup-2014", "Bank credit by state and the old bank groups, total and small borrowal accounts, March 2014 to September 2023", { base: "BSR-1 quarterly, bank groups before 2017" }),
  { id: "961", rel: "credit-deep-bsr1-pop-occupation", date: "Reporting Date", values: bsrSets("Set1 Number Of Account", "Set1 Total Credit Limit", "Set1 Total Amount Outstanding"), dims: ["Key Description 1", "Key4 Description 1"], unit: "inr_crore", base: "BSR-1 quarterly, excluding RRBs", coverage: "Bank credit by population group and occupation, every quarter since March 2014" },
  { id: "962", rel: "credit-deep-bsr1-pop-occupation-small", date: "Reporting Date", values: bsrSets("Set2 Number Of Account", "Set2 Total Credit Limit", "Set2 Total Amount Outstanding"), dims: ["Key Description 1", "Key4 Description 1"], unit: "inr_crore", base: "BSR-1 quarterly, excluding RRBs", coverage: "Small borrowal accounts (credit limits up to ₹2 lakh) by population group and occupation, every quarter since March 2014" },
  { id: "964", rel: "credit-deep-bsr1-state-occupation-small", date: "Reporting Date", values: bsrSets("Set2 Number Of Account", "Set2 Total Credit Limit", "Set2 Total Amount Outstanding"), dims: ["Key3 Description 2", "Key4 Description 1"], unit: "inr_crore", base: "BSR-1 quarterly, excluding RRBs", coverage: "Small borrowal accounts (credit limits up to ₹2 lakh) by state and occupation, every quarter since March 2014" },
  { id: "965", rel: "credit-deep-bsr1-bankgroup-occupation", date: "Time Date", values: bsrSets("Set1 Number Of Account", "Set1 Total Credit Limit", "Set1 Total Amount Outstanding"), dims: ["Key2 Description 1", "Key4 Description 1"], unitCol: "Unit Description", unitKeep: "ACTUALS", unit: "inr_crore", base: "BSR-1 quarterly, excluding RRBs", coverage: "Bank credit by bank group and occupation, every quarter since June 2017" },
  { id: "976", rel: "credit-deep-bsr1-bankgroup-occupation-2014", date: "Time Date", values: bsrSets("Set1 Number Of Account", "Set1 Total Credit Limit", "Set1 Total Amount Outstanding"), dims: ["Key2 Description 1", "Key4 Description 1"], unit: "inr_crore", base: "BSR-1 quarterly, bank groups before 2017", coverage: "Bank credit by the old bank groups and occupation, March 2014 to September 2023" },
  { id: "967", rel: "credit-deep-bsr1-rate-2014", date: "Time Date", values: bsrSets("No of Accounts", "Credit Limit", "Amount Outstanding"), dims: ["Key Description 1"], unit: "inr_crore", base: "BSR-1 quarterly, interest rate bands to September 2023", coverage: "Bank loans by interest rate band, the older bands, March 2014 to September 2023" },
  { id: "972", rel: "credit-deep-bsr1-bankgroup-2014", date: "Time Date", values: [{ col: "No of Offices", key: "offices", label: "offices", unit: "count" }, ...bsrSets("No of Accounts", "Credit Limit", "Amount Outstanding")], dims: ["Item Hierarchy_BG(upto 2017Q1)", "Item Hierarchy_NewBG"], unit: "inr_crore", base: "BSR-1 quarterly, bank groups before 2017", coverage: "Bank credit by the old bank groups, March 2014 to March 2017" },
);

// bank health beyond the Data Query tables, scheduled banks beyond SCBs, the RBI's weekly statement
DEEP.push(
  { id: "665", rel: "credit-deep-asset-classification", date: "Year", values: [{ col: "Amount", key: "amount", label: "₹ crore", unit: "inr_crore" }, { col: "Percentage", key: "share", label: "per cent of gross advances", unit: "pct" }], dims: ["Bank Group Name", "Classification Name"], unitCol: U, unit: "inr_crore", coverage: "Classification of loan assets by bank group, as the RBI publishes the totals: standard, sub-standard, doubtful and loss advances and gross NPAs, amounts and shares, every March since 2004" },
  { id: "910", rel: "credit-deep-npa-by-sector", date: "Year", value: "Amount", dims: ["Bank Group Name", "Sector Name", "Item Description"], unitCol: U, unit: "inr_crore", unitBy: [[/percentage$/i, "pct"]], coverage: "Gross NPAs of public sector banks by sector: priority, non-priority and public sector loans, amounts and shares, every March since 2004" },
  { id: "1077", rel: "credit-deep-crar-banks", date: "Time Date", value: "Item Value", dims: ["Bank Group Name", "Bank Name", "Bal Sheet Description"], version: "Version Desc", unit: "pct", coverage: "Capital adequacy ratio of every scheduled commercial bank under Basel I, II and III: total, tier I and tier II, every March" },
  { id: "1078", dp: "DP1", rel: "credit-deep-bank-ratios", date: "Time Cal Year", value: "Ratio Amount", dims: ["Bank Group Name", "Bank Name", "Bal Sheet Description"], version: "Version Desc", unit: "pct", unitBy: [[/per employee/i, "inr_crore", { div: 100 }]], coverage: "Thirty-five financial ratios of every scheduled commercial bank: credit-deposit ratio, net interest margin, return on assets and equity, cost of funds, business and profit per employee, net NPA ratio, each year",
    // the RBI prints the per-employee figures in ₹ lakh (State Bank of India 3,410 in 2023-24: ₹34.1 crore of
    // business per employee; profit 26, ₹26 lakh). Read as rupees until 2026-10-10, they rounded to nothing.
    // ...and in rupees through March 2015: the switch is one clean break for every bank (the median bank's
    // business per employee is ₹14.42 crore in 2015 and ₹14.71 crore in 2016 once each year is read in its unit)
    scaleAt: (key, dt) => (/_per_employee$/.test(key) && dt <= "2015-03-01" ? 1e-5 : 1),
    note: "Business and profit per employee are printed in rupees to March 2015 and in ₹ lakh from March 2016 (one break, every bank); both converted to ₹ crore." },
  { id: "998", dp: "DP0", rel: "credit-deep-scheduled-banks", date: "Fortnight Date", value: "Item Values", dims: ["Item Description"], unitCol: U, version: "Provisional Final Flag", unit: "inr_crore", base: "Section 42, all scheduled banks", coverage: "Liabilities and assets of all scheduled banks (commercial and co-operative), every reporting Friday since 1997" },
  { id: "20", dp: "DP4", rel: "credit-deep-rbi-weekly-statement", date: "Week (RBI - Liabilities & Assets)", value: "Amount (RBI - Liabilities & Assets)", dims: ["Item Desc Level1 (RBI - Liabilities & Assets)", "Item Desc Level2 (RBI - Liabilities & Assets)", "Item Description (RBI - Liabilities & Assets)"], unitCol: U, unit: "inr_crore", coverage: "The RBI's weekly statement of affairs: liabilities and assets of the Issue and Banking Departments, every week since July 2004" },
  { id: "39", dp: "DP2", rel: "credit-deep-rbi-liabilities-assets", date: "Week", value: "Amount", dims: ["Item Desc WSS"], unitCol: U, unit: "inr_crore", coverage: "The RBI's liabilities and assets, Issue and Banking Departments combined (the Weekly Statistical Supplement's first table), every week since July 2004" },
  { id: "25", rel: "credit-deep-money-stock-fortnightly", date: "Date", value: "Amount (in Rs. Crore) (Fortnight)", dims: ["RBIS Item Desc"], unit: "inr_crore", coverage: "Money stock (M1, M2, M3), its components and its sources, every reporting fortnight since 1951, with the series excluding the HDFC merger beside the plain ones" },
);

// The RBI's spatial statements (Quarterly and Annual Statistics on Deposits and Credit of SCBs).
// The mirror names the measures only "Measure 1..6"; each meaning below is fixed by an identity
// against a table whose columns are named, checked when these configs were written (2026-10-09):
//  St 1: RPT_1_1 banks, RPT_1_2 offices; RPT_1_3* growth on a year earlier, measure 1 credit and
//        measure 2 deposits (payments banks, which may not lend, print 0 in measure 1; all-India
//        June 2026 = our statement 3A arithmetic, 16.84 and 11.35); RPT_1_4 the credit-deposit ratio.
//  St 2: measure 1 banked centres, measure 2 their offices (single-office centres: the two equal).
//  St 3B: current + savings + term = total (measure 4), every row.
//  St 4A: offices, deposits, credit; district sums equal statement 3A to the rupee. Measure 4 is
//        not named and matches nothing we can check, so it is left out.
//  St 4B: measures 4 + 5 + 6 (current, savings, term) = statement 4A deposits, every row.
//  St 6A/6B: offices, their deposits, their credit, by size class (summed: all-India deposits).
const SP_BG = "Dimension 1";
const census = { "Census Flag": (v) => `population groups by the ${v} census` };
const glance = (v) => ({ RPT_1_1: "number of banks", RPT_1_2: "number of reporting offices", RPT_1_3: "All banks", RPT_1_3A: "", RPT_1_3B: "", RPT_1_4: "All banks" })[v] ?? v;
const glanceMeasure = (c, h, v) => { const f = c[h.indexOf("St Flag")];
  if (f === "RPT_1_1" || f === "RPT_1_2") return v.col === "Measure 1" ? { key: "count", unit: "count" } : null;
  if (f === "RPT_1_4") return v.col === "Measure 1" ? { key: "cd_ratio", label: "credit-deposit ratio, per cent", unit: "pct" } : null;
  return v.col === "Measure 1" ? { key: "credit_growth", label: "credit growth on a year earlier, per cent", unit: "pct_yoy" } : v.col === "Measure 2" ? { key: "deposit_growth", label: "deposit growth on a year earlier, per cent", unit: "pct_yoy" } : null; };
const M = (n) => `Measure ${n}`;
const cnt = (n, key, label) => ({ col: M(n), key, label, unit: "count" }), amt = (n, key, label) => ({ col: M(n), key, label, unit: "inr_crore" });
const TYPES = (a, b, c) => [amt(a, "current", "current account deposits"), amt(b, "savings", "savings deposits"), amt(c, "term", "term deposits")];
const SPATIAL = [
  // [suffix, base, span, statement-1, 2, 3B, 4A, 4B (+ its measure columns), 6 (+also), census?]
  { sfx: "", base: "Spatial statements, excluding RRBs, from March 2023", span: "every quarter since March 2023, excluding regional rural banks",
    s1: ["1413", "DP8"], s2: ["1414", "DP1"], s3b: ["1417", "DP1"], s4a: ["1418", "DP1"], s4b: ["1419", "DP1", TYPES(4, 5, 6)], s6: ["1421", "DP0"] },
  { sfx: "-2017", base: "Spatial statements, including RRBs, June 2017 to December 2022", span: "every quarter from June 2017 to December 2022, including regional rural banks",
    s1: ["1463", "DP8"], s2: ["1464", "DP1"], s3b: ["1466", "DP1"], s4a: ["1467", "DP1"], s4b: ["1468", "DP1", TYPES(4, 5, 6)], s6: ["1470", "DP0"] },
  { sfx: "-2004", base: "Spatial statements, including RRBs, March 2004 to March 2017", span: "every quarter from March 2004 to March 2017, including regional rural banks", census: true,
    s1: ["1481", "DP8"], s2: ["1482", "DP1"], s3b: ["1484", "DP1"], s4a: ["1485", "DP1"], s4b: ["1486", "DP1", TYPES(4, 5, 6), true], s6: ["1489", "DP0", [["1488", "DP0"]]] },
  { sfx: "-annual", base: "Annual spatial statements, including RRBs, from March 2023", span: "every March since 2023, including regional rural banks",
    s1: ["1425", "DP9"], s2: ["1426", "DP6"], s3b: ["1428", "DP4"], s4a: ["1429", "DP4"], s4b: ["1430", "DP4", TYPES(4, 5, 6)], s6: ["1432", "DP5"] },
];
// Statements 4A and 4B (district x bank group x population group, every quarter) run to 16,000
// to 38,000 series a vintage: held for the deep-archive tier (data/coverage/credit.yml), their
// state sums baked in credit-places-states* and the deposit-type bundles below.
export const SPATIAL_DISTRICT = SPATIAL.flatMap((V) => [V.s4a[0], V.s4b[0]]);
for (const V of SPATIAL) {
  const cen = V.census ? ["Census Flag"] : [], dl = V.census ? census : {};
  const qd = (id) => (["1413", "1425", "1463", "1481"].includes(id) ? "Quarter Date" : "Fiscal Quarter");
  const common = { unit: "inr_crore", base: V.base };
  DEEP.push(
    { id: V.s1[0], dp: V.s1[1], rel: `credit-deep-spatial-glance${V.sfx}`, date: qd(V.s1[0]), values: [{ col: M(1) }, { col: M(2) }], dims: ["Dimension 1", "St Flag", ...cen], allowNoDims: true, measure: glanceMeasure, dimLabel: { "St Flag": glance, ...dl }, label: "All banks", ...common, unit: "mixed",
      coverage: `Commercial banks at a glance (statement 1): banks and offices, growth of deposits and credit by bank group and population group, and the credit-deposit ratio, ${V.span}` },
    { id: V.s2[0], dp: V.s2[1], rel: `credit-deep-spatial-centres${V.sfx}`, date: "Fiscal Quarter", values: [cnt(1, "centres", "banked centres"), cnt(2, "offices", "reporting offices in them")], dims: ["Dimension 1", "Dimension 2", "Dimension 3", "Dimension 4", ...cen], place: ["Dimension 3"], dimLabel: { "Dimension 4": (v) => `centres with ${v.toLowerCase().replace("single office", "a single office")}`, ...dl }, ...common, unit: "count",
      coverage: `Banked centres by state and population group, by how many bank offices each centre has (statement 2), ${V.span}` },
    { id: V.s3b[0], dp: V.s3b[1], rel: `credit-deep-spatial-deposit-types${V.sfx}`, date: "Fiscal Quarter", values: [...TYPES(1, 2, 3), amt(4, "total", "aggregate deposits")], dims: [SP_BG, "Dimension 2", "Dimension 3", "Dimension 4", "Dimension 5", ...cen], place: ["Dimension 5"], hide: ["Dimension 3", "Dimension 4"], dimLabel: dl, ...common,
      coverage: `Deposits by type (current, savings, term) by state, bank group and population group (statement 3B), ${V.span}` },
    { id: V.s6[0], dp: V.s6[1], ...(V.s6[2] ? { also: V.s6[2] } : {}), rel: `credit-deep-spatial-office-size${V.sfx}`, date: "Fiscal Quarter", values: [cnt(1, "offices", "reporting offices"), amt(2, "deposits", "their deposits"), amt(3, "credit", "their credit")], dims: [SP_BG, "Dimension 2", "Dimension 4", "Dimension 3", ...cen], dimLabel: { "Dimension 4": (v) => `offices ranked by ${v.toLowerCase()}`, "Dimension 3": (v) => `size class ${v} (₹ crore, as printed)`, ...dl }, ...common, unit: "mixed",
      coverage: `Bank offices by the size of their deposits or credit, by bank group and population group (statements 6A and 6B), ${V.span}` },
  );
}

// BSR-1 annual tables (including RRBs), the latest March only in the mirror. Measures are
// "Measure 1..9" in the mirror; their meanings were fixed by identities on 2026-10-09:
//  accounts, credit limit, amount outstanding: limit >= outstanding in every row, and table 1.8's
//    bands below ₹2 lakh = table 1.12's small borrowal totals (262.4 million accounts, ₹12.77 lakh crore);
//  1.10 / 1.11 measures 4-6: accounts with limits above ₹2 lakh (all accounts less these = table
//    1.8's two smallest bands);
//  1.2 / 1.2A / 1.4: by place of sanction, then by place of utilisation (each sums to the same all-India total);
//  2.11 / 2.13: offices, accounts, amount, then small borrowal accounts and their amount;
//  1.1 and 2.14: offices, accounts, amount (2.14's fourth column is not named and is left out);
//  1.14: men's accounts and amount, women's, then the totals (men + women = total, every row).
const A3 = [cnt(1, "accounts", "loan accounts"), amt(2, "limit", "credit limits"), amt(3, "amount", "credit outstanding")];
const A3BIG = [cnt(4, "big_accounts", "accounts with limits above ₹2 lakh"), amt(5, "big_limit", "credit limits of accounts above ₹2 lakh"), amt(6, "big_amount", "credit outstanding in accounts above ₹2 lakh")];
const OAA = [cnt(1, "offices", "reporting offices"), cnt(2, "accounts", "loan accounts"), amt(3, "amount", "credit outstanding")];
const SANC = [cnt(1, "accounts_sanction", "loan accounts, by place of sanction"), amt(2, "amount_sanction", "credit outstanding, by place of sanction"), cnt(3, "accounts_use", "loan accounts, by place of utilisation"), amt(4, "amount_use", "credit outstanding, by place of utilisation")];
const BA = (id, rel, dims, coverage, extra = {}) => ({ id, dp: "DP0", rel, date: "Time Cal Year", values: A3, dims, unit: "mixed", base: "BSR-1 annual, including RRBs", coverage: `${coverage}, as on 31 March (latest year)`, ...extra });
const D = (...n) => n.map((i) => `Dimension ${i}`);
DEEP.push(
  BA("1084", "credit-deep-bsr1a-occupation", D(1, 2), "Bank credit by occupation, every BSR-1 sector and sub-sector", { date: "Reporting Date" }),
  BA("1085", "credit-deep-bsr1a-size", D(1), "Bank credit by size of credit limit", { date: "Reporting Date" }),
  BA("1086", "credit-deep-bsr1a-account-type", D(1), "Bank credit by type of account, all accounts and those with limits above ₹2 lakh", { values: [...A3, ...A3BIG] }),
  BA("1087", "credit-deep-bsr1a-pop-occupation-small", D(1, 2, 3), "Small borrowal accounts (limits up to ₹2 lakh) by population group and occupation"),
  BA("1089", "credit-deep-bsr1a-pop-occupation", D(1, 2), "Bank credit by population group and occupation"),
  BA("1090", "credit-deep-bsr1a-occupation-account", D(1, 2), "Bank credit by occupation and type of account"),
  BA("1091", "credit-deep-bsr1a-occupation-account-small", D(1, 2), "Small borrowal accounts by occupation and type of account"),
  BA("1092", "credit-deep-bsr1a-occupation-organisation", D(1, 2), "Bank credit by occupation and kind of borrower (organisation)"),
  BA("1093", "credit-deep-bsr1a-occupation-organisation-small", D(1, 2, 3), "Small borrowal accounts by occupation and kind of borrower"),
  BA("1094", "credit-deep-bsr1a-account-organisation", D(1, 2), "Bank credit by type of account and kind of borrower"),
  BA("1095", "credit-deep-bsr1a-account-organisation-small", D(1, 2), "Small borrowal accounts by type of account and kind of borrower"),
  BA("1096", "credit-deep-bsr1a-size-organisation", D(1, 2), "Bank credit by size of credit limit and kind of borrower"),
  BA("1097", "credit-deep-bsr1a-size-account", D(1, 2), "Bank credit by size of credit limit and type of account"),
  BA("1119", "credit-deep-bsr1a-small-borrowers", D(1, 2, 3), "Small borrowal accounts by population group and broad category of borrower (men, women, others)", { values: [cnt(1, "accounts", "loan accounts"), amt(2, "amount", "credit outstanding")] }),
  BA("1120", "credit-deep-bsr1a-occupation-size", D(1, 2), "Bank credit by occupation and size of credit limit"),
  BA("1122", "credit-deep-bsr1a-rate-organisation", D(1, 2), "Bank credit by interest rate band and kind of borrower"),
  BA("1123", "credit-deep-bsr1a-size-rate", D(1, 2), "Bank credit by size of credit limit and interest rate band"),
  BA("1124", "credit-deep-bsr1a-rate-organisation-small", D(1, 2), "Small borrowal accounts by interest rate band and kind of borrower"),
  BA("1125", "credit-deep-bsr1a-rate-account", D(1, 2), "Bank credit by interest rate band and type of account"),
  BA("1126", "credit-deep-bsr1a-rate-account-small", D(1, 2), "Small borrowal accounts by interest rate band and type of account"),
  BA("1127", "credit-deep-bsr1a-occupation-rate", D(1, 2, 3), "Bank credit by occupation and interest rate band", { date: "Reporting Date" }),
  BA("1128", "credit-deep-bsr1a-occupation-rate-small", D(1, 2), "Small borrowal accounts by occupation and interest rate band"),
  BA("1129", "credit-deep-bsr1a-rate-size-account", D(1, 2, 3), "Bank credit by interest rate band, size of credit limit and type of account"),
  BA("1131", "credit-deep-bsr1a-bank-groups", D(1), "Offices, loan accounts and credit outstanding by bank group", { values: OAA }),
  BA("1132", "credit-deep-bsr1a-pop-sanction-use", D(1), "Bank credit by population group, by where it was sanctioned and where it is used", { values: SANC }),
  BA("1133", "credit-deep-bsr1a-pop-sanction-use-ex-food", D(1, 2), "Bank credit excluding food procurement by population group, by where it was sanctioned and where it is used", { values: SANC }),
  BA("1135", "credit-deep-bsr1a-state-pop-sanction-use", D(1, 2, 3, 4, 5, 6), "Bank credit by state and population group, by where it was sanctioned and where it is used", { dp: "DP5", values: [amt(1, "amount_sanction", "credit outstanding, by place of sanction"), amt(2, "amount_use", "credit outstanding, by place of utilisation")], place: ["Dimension 2"] }),
  BA("1136", "credit-deep-bsr1a-pop-occupation-share", D(1, 2), "Bank credit by population group and occupation (the table the RBI also prints as shares)"),
  BA("1137", "credit-deep-bsr1a-organisation", D(1, 2, 3, 4), "Bank credit by kind of borrower, all accounts and those with limits above ₹2 lakh", { date: "Reporting Date", values: [...A3, ...A3BIG] }),
  BA("1138", "credit-deep-bsr1a-size-bankgroup", D(1, 2), "Bank credit by size of credit limit and bank group"),
  BA("1139", "credit-deep-bsr1a-bankgroup-pop-size", D(1, 2, 3), "Bank credit by bank group, population group and size of credit limit"),
  BA("1140", "credit-deep-bsr1a-state-pop", D(1, 2, 3), "Bank credit by state and population group", { place: ["Dimension 2"] }),
  BA("1141", "credit-deep-bsr1a-state-bankgroup", D(1, 2, 3), "Bank credit by state and bank group", { place: ["Dimension 2"] }),
  BA("1142", "credit-deep-bsr1a-pop-bankgroup-small", D(1, 2, 3), "Offices, all credit and small borrowal accounts by population group and bank group, by place of sanction", { values: [...OAA, cnt(4, "small_accounts", "small borrowal accounts"), amt(5, "small_amount", "credit outstanding in small borrowal accounts")] }),
  BA("1143", "credit-deep-bsr1a-state-bankgroup-size", D(1, 2, 3, 4), "Bank credit by bank group, state and size of credit limit", { place: ["Dimension 3"] }),
  BA("1144", "credit-deep-bsr1a-state-pop-small", D(1, 2, 3), "Offices, all credit and small borrowal accounts by state and population group, by place of sanction", { values: [...OAA, cnt(4, "small_accounts", "small borrowal accounts"), amt(5, "small_amount", "credit outstanding in small borrowal accounts")], place: ["Dimension 3"] }),
  BA("1145", "credit-deep-bsr1a-districts", D(1, 2, 3, 4), "Offices, loan accounts and credit outstanding by district and population group, by place of sanction", { values: OAA, place: ["Dimension 2", "Dimension 3"], note: "A fourth amount column the mirror does not name is left out." }),
  BA("1149", "credit-deep-bsr1a-pop-occupation-bankgroup", D(1, 2, 3, 4), "Bank credit by population group, occupation and bank group"),
  BA("1150", "credit-deep-bsr1a-state-occupation-bankgroup", D(1, 2, 3, 4), "Bank credit by state, occupation and bank group", { place: ["Dimension 2"] }),
  BA("1151", "credit-deep-bsr1a-state-occupation-pop", D(1, 2, 3, 4), "Bank credit by state, occupation and population group", { place: ["Dimension 2"] }),
  BA("1152", "credit-deep-bsr1a-state-occupation-pop-small", D(1, 2, 3, 4, 5), "Small borrowal accounts by state, occupation and population group", { place: ["Dimension 2"] }),
  BA("1153", "credit-deep-bsr1a-district-occupation", D(1, 2, 3, 4), "Bank credit by district and occupation", { values: [cnt(1, "accounts", "loan accounts"), amt(3, "amount", "credit outstanding")], place: ["Dimension 2", "Dimension 3"] }),
  BA("1553", "credit-deep-bsr1a-district-gender", D(1, 2, 3), "Credit to individuals by district, men and women, by place of sanction", { date: "Reporting Date", place: ["Dimension 2", "Dimension 3"],
    values: [cnt(1, "men_accounts", "men's loan accounts"), amt(2, "men_amount", "credit outstanding to men"), cnt(3, "women_accounts", "women's loan accounts"), amt(4, "women_amount", "credit outstanding to women"), cnt(5, "accounts", "all individuals' loan accounts"), amt(6, "amount", "credit outstanding to all individuals")] }),
);

// The deep-archive tier (coordinator's rule, 2026-10-09): tables published at a grain that would
// make a chart bundle of more than about 5 MB are not baked here. data/coverage/credit.yml marks
// each `archive: true` with the baked bundles its coarser cuts live in; the archive builder
// writes them as gzipped CSV once hosting is chosen.
export const ARCHIVE = new Set(["1150", "1151", "1153"]);
for (let i = DEEP.length - 1; i >= 0; i--) if (ARCHIVE.has(DEEP[i].id)) DEEP.splice(i, 1);

// Report on Trend and Progress of Banking in India: the appendix tables (DBIE 1509-1547).
// Amounts are rupees in the mirror except where a row's own label says ₹ crore; a row's unit
// follows its label (numbers, per cent, amounts), checked by eye when these were written.
const V = "Version Desc", TD = "Time Date", FY = "Time Fis Year";
const CR = [/₹ ?crore|rs\.? ?crore/i, "inr_crore", { inCrore: true }];
const TP = (id, rel, date, dims, coverage, extra = {}) => ({ id, dp: "DP0", rel, date, value: "Item Value", dims, version: V, unit: "auto", base: "RBI Report on Trend and Progress of Banking in India", coverage, ...extra });
DEEP.push(
  TP("1509", "credit-deep-tp-international-liabilities", TD, ["Item Hierarchy Level 1", "Item Description"], "International liabilities of banks in India by type of instrument, each year", { unit: "inr_crore" }),
  TP("1510", "credit-deep-tp-international-assets", TD, ["Item Hierarchy Level 1", "Item Description"], "International assets of banks in India by type of instrument, each year", { unit: "inr_crore" }),
  TP("1511", "credit-deep-tp-international-claims", TD, ["Claim Hierarchy Level 1", "Claim Description"], "Consolidated international claims of banks by residual maturity and sector, each year", { unit: "inr_crore" }),
  TP("1517", "credit-deep-tp-claims-by-country", TD, ["Derived Country Name"], "Consolidated international claims of banks on countries other than India, each year", { dp: "DP2", unit: "inr_crore" }),
  TP("1512", "credit-deep-tp-off-balance-sheet", FY, ["Bank Group Name", "Balsheet Description"], "Off-balance-sheet exposure of scheduled commercial banks by bank group (forward contracts, guarantees, acceptances), each year", { unit: "inr_crore" }),
  TP("1513", "credit-deep-tp-sensitive-sectors", FY, ["Bank Group Name", "Sector Hierarchy Level 1", "Sector Description"], "Bank lending to the sensitive sectors (capital market, real estate, commodities) by bank group, each year", { unit: "inr_crore" }),
  TP("1514", "credit-deep-tp-overseas-operations", FY, ["Bank Group Name", "Bank Name", "Item Description"], "Overseas operations of Indian banks: branches, subsidiaries and representative offices abroad, by bank, each year", { dp: "DP2", unit: "count" }),
  TP("1515", "credit-deep-tp-shareholding", FY, ["Derived Bank Group Name", "Derived Bank Name", "Pattern Hierarchy Level 2", "Pattern Description"], "Shareholding pattern of domestic scheduled commercial banks, bank by bank (government, institutions, residents, non-residents), each year", { unit: "pct", version: undefined }),
  TP("1516", "credit-deep-tp-banking-glance", TD, ["Sector Hierarchy Level 1", "Sector Description"], "The Indian banking sector at a glance: balance sheet, capital, asset quality, profitability and reach, each year", { relabel: [[/ \(in lakhs\)/, ""]], note: "Card counts are stored as plain numbers although the table's labels say lakh; the labels here drop the word." }),
  TP("1518", "credit-deep-tp-branches-atms", FY, ["Derived Bank Group Name", "Derived Bank Name", "Item Hierarchy Level 1", "Item Description"], "Branches and ATMs of every scheduled commercial bank by population group, each year", { unit: "count", version: undefined }),
  TP("1519", "credit-deep-tp-microfinance", FY, ["Mfp Description", "Item Description", "Item Hierarchy Level 2", "Mfp Hierarchy Level 2"], "Progress of microfinance: self-help groups and joint liability groups, loans disbursed and outstanding, each year", { unitBy: [[/amount/i, "inr_crore"]], unit: "count" }),
  TP("1520", "credit-deep-tp-rrb-states", FY, ["Region Name", "Ind Description", "Ind Hierarchy Level 2"], "Regional rural banks by state: branches, deposits, credit, profit and bad loans, each year", { dp: "DP2", place: ["Region Name"] }),
  TP("1521", "credit-deep-tp-rrb-psl", FY, ["Target Description", "Sector Description"], "Regional rural banks' priority sector lending against targets, each year", { version: undefined }),
  TP("1522", "credit-deep-tp-ucb-performance", FY, ["Bank Group Name", "Derived Bank Name", "Ind Description"], "Financial performance of every scheduled urban co-operative bank, as per cent of total assets, each year", { unit: "pct" }),
  TP("1523", "credit-deep-tp-ucb-parameters", FY, ["Bank Group Name", "Derived Bank Name", "Parameter Description"], "Select financial parameters of every scheduled urban co-operative bank, each year", { unit: "pct", unitBy: [CR] }),
  TP("1524", "credit-deep-tp-dccb-health", FY, ["Region Name", "Dccb Ind Hierarchy Level 1", "Dccb Ind Description"], "District central co-operative banks by state: profit, loss, bad loans and recovery, each year", { dp: "DP2", place: ["Region Name"] }),
  TP("1525", "credit-deep-tp-pacs-members", FY, ["Catergory Description", "Mb Description"], "Members and borrowers of primary agricultural credit societies by social group, each year", { dp: "DP3", unit: "count" }),
  TP("1526", "credit-deep-tp-pacs", TD, ["Pacs Hierarchy Level 1", "Pacs Description"], "Primary agricultural credit societies: liabilities and assets, each year"),
  TP("1527", "credit-deep-tp-scb-coop-health", FY, ["Region Name", "Mscb Ind Description"], "State co-operative banks by state: profit, bad loans and recovery, each year", { place: ["Region Name"] }),
  TP("1528", "credit-deep-tp-pacs-states", FY, ["Region Name", "Ind Hierarchy Level 1", "Ind Hierarchy Level 2"], "Primary agricultural credit societies by state: number, members, deposits, loans and profit, each year",
    // the viability classes are numbers of societies; read as rupees they were divided by 10^7 (0.001)
    { dp: "DP3", place: ["Region Name"], unitBy: [[/, (viable|potentially viable|dormant|defunct|others)$/i, "count"]] }),
  TP("1529", "credit-deep-tp-scardb-balance-sheet", TD, ["Item Hierarchy Level 1", "Item Description"], "State co-operative agriculture and rural development banks: liabilities and assets, each year", { unit: "inr_crore" }),
  TP("1530", "credit-deep-tp-scardb-performance", FY, ["Per Hierarchy Level 1", "Per Description"], "State co-operative agriculture and rural development banks: income, expenditure and profit, each year", { unit: "inr_crore" }),
  TP("1531", "credit-deep-tp-scardb-asset-quality", TD, ["Quality Hierarchy Level 1", "Quality Description"], "State co-operative agriculture and rural development banks: bad loans and recovery, each year"),
  TP("1532", "credit-deep-tp-pcardb-performance", FY, ["Per Hierarchy Level 1", "Per Description"], "Primary co-operative agriculture and rural development banks: income, expenditure and profit, each year", { unit: "inr_crore" }),
  TP("1533", "credit-deep-tp-pcardb-asset-quality", TD, ["Quality Hierarchy Level 1", "Quality Description"], "Primary co-operative agriculture and rural development banks: bad loans and recovery, each year"),
  TP("1534", "credit-deep-tp-nbfc-balance-sheet", TD, ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Description"], "Consolidated balance sheet of non-banking financial companies", { unit: "inr_crore" }),
  TP("1535", "credit-deep-tp-nbfc-d-balance-sheet", TD, ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Description"], "Consolidated balance sheet of deposit-taking NBFCs, each year", { unit: "inr_crore" }),
  TP("1536", "credit-deep-tp-pcardb-balance-sheet", TD, ["Item Hierarchy Level 1", "Item Description"], "Primary co-operative agriculture and rural development banks: liabilities and assets, each year", { unit: "inr_crore" }),
  TP("1537", "credit-deep-tp-kcc-states", TD, ["State Name", "Kccs Hierarchy Level 1", "Kccs Hierarchy Level 2"], "Kisan Credit Cards by state and lender: operative cards and amounts outstanding, each year", { place: ["State Name"] }),
  TP("1537", "credit-deep-tp-kcc", TD, ["Region Name", "Kccs Hierarchy Level 1", "Kccs Hierarchy Level 2"], "Kisan Credit Cards, all India, by lender: operative cards and amounts outstanding, each year", { dp: "DP2" }),
  TP("1538", "credit-deep-tp-scardb-regions", TD, ["Region Name", "Ind Hierarchy Level 1", "Ind Description"], "State co-operative agriculture and rural development banks by region: branches, loans, recovery and profit, each year",
    { unitBy: [[/branches/i, "count", { div: 1e5 }]], note: "Branch counts are stored in the mirror multiplied by 100,000 (789 branches as 78,900,000); divided back, every one is a whole number." }),
  TP("1539", "credit-deep-tp-pcardb-regions", FY, ["Region Name", "Ind Hierarchy Level 1", "Ind Description"], "Primary co-operative agriculture and rural development banks by region: banks in profit and loss, and their amounts, each year", { dp: "DP4" }),
  TP("1540", "credit-deep-tp-nbfc-ul-balance-sheet", TD, ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Description"], "Consolidated balance sheet of upper-layer NBFCs", { unit: "inr_crore" }),
  TP("1541", "credit-deep-tp-nbfc-ml-balance-sheet", TD, ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Description"], "Consolidated balance sheet of middle-layer NBFCs", { unit: "inr_crore" }),
  TP("1542", "credit-deep-tp-nbfc-credit", TD, ["Item Hierarchy Level 2", "Item Description"], "Credit by NBFCs to agriculture, industry, services and retail, each year", { unit: "inr_crore" }),
  TP("1543", "credit-deep-tp-nbfc-ul-performance", TD, ["Item Hierarchy Level 1", "Item Description"], "Financial performance of upper-layer NBFCs: income, expenditure, profit and ratios to total assets"),
  TP("1544", "credit-deep-tp-nbfc-ml-performance", TD, ["Item Hierarchy Level 1", "Item Description"], "Financial performance of middle-layer NBFCs: income, expenditure, profit and ratios to total assets"),
  TP("1545", "credit-deep-tp-fi-assistance", TD, ["Fi Description", "Item Description", "Item Hierarchy Level 2"], "Financial assistance sanctioned and disbursed by all-India financial institutions", { unit: "inr_crore", dimLabel: { "Item Hierarchy Level 2": (v) => ({ S: "sanctioned", D: "disbursed" })[v] ?? v } }),
  TP("1546", "credit-deep-tp-primary-dealers", TD, ["Ind Description", "Item Description"], "Financial performance of standalone primary dealers"),
  TP("1547", "credit-deep-tp-primary-dealer-indicators", TD, ["Dim Primary Dealer.Ind Description", "Dim Rtp Pri Dealer Financial Ind.Ind Description"], "Select financial indicators of each standalone primary dealer"),
);

// T&P tables that mix March year-ends with September half-years keep their own dates
for (const c of DEEP) if (["1534", "1535", "1540", "1541", "1542", "1543", "1544", "1545", "1546", "1547"].includes(c.id)) c.freq = "irregular";

// Tables published twice or three times under different menus (twins found by fingerprinting
// every report's date-value pairs, 2026-10-09): one of each set is baked here, the rest are
// ledgered as duplicates of it. Plus the Statistical Tables Relating to Banks' bank-group tables.
DEEP.push(
  { id: "7", dp: "DP0", also: [["7", "DP5", { value: "Amount (in Rs. Crore)" }]], rel: "credit-deep-reserve-money-weekly", date: "Date", value: "Amount (in Rs. Crore) (Weekly)", dims: ["Item Hierarchy Level1", "RM Item Desc"], unitCol: U, unit: "inr_crore", coverage: "Reserve money, its components and sources, every week (the Weekly Statistical Supplement's table, also published as reports 614 and 751)" },
  { id: "443", dp: "DP0", rel: "credit-deep-commercial-bank-survey", date: "Time", value: "Outstanding Amount (Rs. Crore)", dims: ["Item Description"], unitCol: U, unit: "inr_crore", coverage: "The commercial bank survey: banks' deposits from residents, call borrowings and their claims on government and the commercial sector, every fortnight (also reports 100 and 903)" },
  { id: "639", dp: "DP2", rel: "credit-deep-scheduled-banks-annual", date: "Time Date", value: "Item Value", dims: ["Bank Group Name", "Item Description"], unitCol: U, version: "Version Desc", unit: "inr_crore", coverage: "Business of scheduled banks in India by bank group (commercial, co-operative) on a reporting Friday of every month since 2005: deposits, borrowings, credit, investments, cash (Statistical Tables Relating to Banks; also report 937)" },
  { id: "987", dp: "DP3", rel: "credit-deep-bank-group-business", date: "Time Date", value: "Item Value", dims: ["Bank Group Lev 1", "Item Desc"], unitCol: U, version: "P F Flag", unit: "inr_crore", coverage: "Business of scheduled banks by bank group, including regional rural banks and co-operative banks, every month (also report 991)" },
  { id: "661", dp: "DP0", rel: "credit-deep-derivatives", date: "Reporting Date", value: "Notional Principal Amt Out", dims: ["Bank Grp Name STRBI", "Bank Name STRBI", "Report Desc"], unitCol: U, unit: "inr_crore", coverage: "Derivatives of scheduled commercial banks by bank group and instrument: notional principal outstanding, each year (also report 679)" },
  { id: "706", dp: "DP0", rel: "credit-deep-state-investments", date: "Reporting Year", values: [["State Gov Securities_actuals", "state government securities"], ["Regional Rural Banks_actuals", "regional rural banks"], ["Co Operative Institutions_actuals", "co-operative institutions"], ["State Electricity Boards_actuals", "state electricity boards"], ["Munici Cop Municipality_actuals", "municipal corporations and municipalities"], ["State Financial Corps_actuals", "state financial corporations"], ["Housing Boards_actuals", "housing boards"], ["St Ind Dev Corp_actuals", "state industrial development corporations"], ["Road Trans Corp_actuals", "road transport corporations"], ["Oth Gov Quasi Govt_actuals", "other government and quasi-government bodies"]].map(([col, label]) => ({ col, key: keyOf(label), label: `investments in ${label}`, unit: "inr_crore" })),
    dims: ["State"], place: ["State"], unitCol: "Unit Desc", unit: "inr_crore", coverage: "Scheduled commercial banks' investments in each state's securities and bodies (state government, electricity boards, municipalities, state corporations), each year (also report 909)" },
  { id: "722", dp: "DP1", rel: "credit-deep-state-coop-banks-states", date: "Time Cal Year", value: "Item Value", dims: ["State Name", "Item Hierarchy Level 1", "Item Description"], place: ["State Name"], unitCol: U, unit: "inr_crore", coverage: "Liabilities and assets of state co-operative banks, state by state, each year (also report 988)" },
  { id: "725", dp: "DP1", rel: "credit-deep-dccb-states", date: "Time Cal Year", value: "Item Value", dims: ["State Name", "Item Hierarchy Level 1", "Item Description"], place: ["State Name"], unitCol: U, unit: "inr_crore", coverage: "Liabilities and assets of district central co-operative banks, state by state, each year (also report 939)" },
  { id: "723", dp: "DP3", rel: "credit-deep-banks-abroad", date: "Reporting Year", value: "Asset & Liab Value", dims: ["Asset Hierarchy Level1", "Asset & Liab Description"], unitCol: U, unit: "inr_crore", coverage: "Liabilities and assets of Indian scheduled commercial banks' branches in foreign countries, each year (also report 904)" },
  { id: "733", dp: "DP3", rel: "credit-deep-insured-deposits", date: "Time Date", value: "Item Value", dims: ["Bank Group Name", "Item Description"], unitCol: U, unit: "auto", pctMax: 100, coverage: "Deposit insurance by bank group: insured banks, assessable and insured deposits, and the insured share, each year (also report 938)" },
  { id: "1001", dp: "DP2", rel: "credit-deep-unclaimed-deposits", date: "Fiscal Year", value: "Deposit Values", dims: ["Bank Grp Name STRBI", "Bank Name STRBI", "deposit_hierarchy_level_1", "Deposit Description"], unitCol: U, unit: "auto", coverage: "Unclaimed deposits with every scheduled commercial bank: accounts and amounts, each year (also report 1005)" },
  { id: "1214", dp: "DP0", rel: "credit-deep-coop-balance-sheets", date: "V Time D Fis Year", value: "N Bkpr B Amt Performance", dims: ["V Bk Grp Name", "Level1", "V Blln Pl Item Desc"], hide: ["Level1"], unit: "inr_crore", inCrore: true,
    note: "The mirror files these balance sheets of co-operative banks and credit societies under the title 'Growth Rate of Select Balance Sheet Indicators of Scheduled UCBs' (1214) and again under 'Select Balance Sheet Indicators of PACS' (1215); the rows are identical and are balance-sheet amounts in ₹ crore for every co-operative tier.",
    coverage: "Balance sheets of the co-operative banks and credit societies, tier by tier (state, district, urban, agricultural and rural development banks, credit societies), each year since 2007-08" },
  { id: "879", dp: "DP2", also: [["879", "DP4"]], rel: "credit-deep-scb-annual-aggregates", date: "Date", value: "Rate", dims: ["Item Description"], unitCol: U, version: "Version Desc", unit: "inr_crore", coverage: "Select aggregates of scheduled commercial banks at the last reporting Friday of every financial year since 1950-51: deposits, credit, investments, borrowings from the RBI (also report 813)" },
);

// The every-cut table's "cut" column for each deep table (src/dossiers/everycut.js), where the
// coverage line does not already name it
export const DEEP_CUTS = {
  "cash-balances": "All India", "standing-facilities": "Facility", "liquidity-aggregates": "Component", "monetary-survey": "Component and source", "rbi-survey": "Component and source",
  "flow-of-resources": "Source of funds", "credit-to-commercial-sector": "Source of funds", "money-components-annual": "Component", "money-sources-annual": "Source", "average-money": "Aggregate",
  "reserve-money-annual": "Component and source", "rbi-accounts-annual": "Asset or liability", "money-growth-annual": "Aggregate", "monetary-ratios": "Ratio", "savings-deposits": "Bank group",
  "rrb-indicators": "Indicator", "credit-population-annual": "Population group", "deposits-population-annual": "Population group", "branches-population": "Population group",
  "bank-balance-sheet": "Balance sheet item", "cooperative-npa": "Co-operative tier", "shg": "Indicator", "pacs": "Lender and measure", "state-cooperative-banks": "Balance sheet item",
  "agri-scb": "Kind of advance", "small-industries": "Indicator", "sick-units": "Indicator", "nbfc-financials": "Balance sheet item", "nbfc-sectors-2016": "Sector",
  "crar-banks": "Bank", "bank-ratios": "Bank and ratio", "scheduled-banks": "Balance sheet item", "rbi-weekly-statement": "Asset or liability", "rbi-liabilities-assets": "Asset or liability",
  "money-stock-fortnightly": "Component and source", "bsr1a-rate-size-account": "Rate band, size and type of account", "bsr1a-pop-sanction-use": "Population group",
  "bsr1a-bankgroup-pop-size": "Bank group, population group and size", "bsr1a-state-bankgroup-size": "Bank group, state and size", "bsr1a-pop-occupation-bankgroup": "Population group, occupation and bank group",
  "bsr1a-state-occupation-pop-small": "State, occupation and population group", "bsr1a-district-gender": "District and gender", "tp-claims-by-country": "Country", "tp-off-balance-sheet": "Bank group and exposure",
  "tp-sensitive-sectors": "Bank group and sector", "tp-shareholding": "Bank and shareholder", "tp-banking-glance": "Indicator", "tp-branches-atms": "Bank and population group",
  "tp-microfinance": "Programme", "tp-rrb-psl": "Target", "tp-ucb-performance": "Bank", "tp-ucb-parameters": "Bank", "tp-pacs": "Balance sheet item", "tp-scardb-balance-sheet": "Balance sheet item",
  "tp-scardb-performance": "Income and expenditure", "tp-scardb-asset-quality": "Indicator", "tp-pcardb-performance": "Income and expenditure", "tp-pcardb-asset-quality": "Indicator",
  "tp-nbfc-balance-sheet": "Balance sheet item", "tp-nbfc-d-balance-sheet": "Balance sheet item", "tp-pcardb-balance-sheet": "Balance sheet item", "tp-nbfc-ul-balance-sheet": "Balance sheet item",
  "tp-nbfc-ml-balance-sheet": "Balance sheet item", "tp-nbfc-credit": "Sector", "tp-nbfc-ul-performance": "Income and expenditure", "tp-nbfc-ml-performance": "Income and expenditure",
  "tp-fi-assistance": "Institution", "tp-primary-dealers": "Dealer", "tp-primary-dealer-indicators": "Dealer", "reserve-money-weekly": "Component and source", "commercial-bank-survey": "Component and source",
  "state-investments": "State", "banks-abroad": "Asset or liability", "unclaimed-deposits": "Bank", "scb-annual-aggregates": "Balance sheet item", "spatial-deposit-types": "State, bank group and population group",
  "spatial-deposit-types-2017": "State, bank group and population group", "spatial-deposit-types-2004": "State, bank group and population group", "spatial-deposit-types-annual": "State, bank group and population group",
  "spatial-office-size": "Size class", "spatial-office-size-2017": "Size class", "spatial-office-size-2004": "Size class", "spatial-office-size-annual": "Size class", "exporters": "Bank group",
  "food-procurement": "Bank group", "notes-coins": "Denomination",
};

// Money and bank tables the Bulletin, the Handbook and the WSS each publish in their own cut
// (partly overlapping report 25 and the Section 42 tables, but each with dates or items the
// others lack)
const UDR = "Unit DECS rbib 10";
DEEP.push(
  { id: "13", dp: "DP0", rel: "credit-deep-money-stock-wss", date: "Date", value: "Amount (in Rs. Crore)", dims: ["Item Hierarchy Level1", "RM Item Desc"], unitCol: U, unit: "inr_crore", coverage: "Money stock, its components and sources, every reporting fortnight since 2001, as the Weekly Statistical Supplement prints it (also report 770)" },
  { id: "22", dp: "DP0", rel: "credit-deep-money-stock-measures", date: "Date", value: "Amount (in Rs. Crore) (Fortnight)", dims: ["OMA Item Desc"], unitCol: UDR, unit: "inr_crore", coverage: "Money stock measures (M1, M3 and their parts), every reporting fortnight, as the RBI Bulletin prints them" },
  { id: "22", dp: "DP1", rel: "credit-deep-money-stock-measures-annual", date: "Date", value: "Amount (in Rs. Crore)", dims: ["SOMS Item Desc"], unitCol: "Unit Desc", unit: "inr_crore", freq: "annual", coverage: "Money stock measures at the end of every financial year since 1954-55, as the RBI Bulletin prints them" },
  { id: "23", dp: "DP0", rel: "credit-deep-money-sources-bulletin", date: "Date", value: "Amount (in Rs. Crore)", dims: ["OMA Item Desc"], unitCol: U, unit: "inr_crore", coverage: "Sources of money stock (M3): bank credit to government and the commercial sector, foreign exchange assets, every reporting fortnight since 1951, as the RBI Bulletin prints them" },
  { id: "97", dp: "DP2", rel: "credit-deep-money-components-handbook", date: "Date", value: "Amount (in Rs. Crore)", dims: ["OMA Item Desc"], unitCol: U, unit: "inr_crore", coverage: "Components of money stock, every reporting fortnight since 1991, as the Handbook of Statistics prints them (also report 1373)" },
  { id: "97", dp: "DP5", rel: "credit-deep-money-components-handbook-annual", date: "Date", value: "Amount (in Rs. Crore) Annual", dims: ["OMA Item Desc"], unitCol: U, unit: "inr_crore", freq: "annual", coverage: "Components of money stock at the end of every financial year since 1950-51, as the Handbook of Statistics prints them" },
  { id: "215", dp: "DP2", rel: "credit-deep-money-sources-handbook", date: "Date", value: "Amount (in Rs. Crore)", dims: ["SOMS Item Desc"], unitCol: "Unit Desc", unit: "inr_crore", coverage: "Sources of money stock, every reporting fortnight since 1951, as the Handbook of Statistics prints them (also report 444)" },
  { id: "544", dp: "DP0", rel: "credit-deep-monetary-survey-monthly", date: "Date", value: "Amount (in Rs. Crore)_monthly", dims: ["MA Item Desc_monthly"], unitCol: UDR, unit: "inr_crore", coverage: "The monetary survey (new monetary aggregates NM1, NM2, NM3 and their sources), every month since 1999 (also report 826)" },
  { id: "188", dp: "DP1", rel: "credit-deep-industry-monthly-2007", date: "Reporting Date", value: "Amount (Rs. Crore)", dims: ["Industry/Sector Wise", "Item Description"], unit: "inr_crore", base: "Industry-wise deployment, old format", coverage: "Bank credit by industry, every month in the old classification, as the Handbook prints it (also reports 765, and 44 and 540 in the Bulletin)" },
  { id: "44", dp: "DP0", also: [["188", "DP0"]], rel: "credit-deep-industry-monthly", date: "Reporting Date", value: "Amount (Rs. Crore)", dims: ["Industry/Sector Wise", "Item Description"], unit: "inr_crore", base: "Industry-wise deployment, new format", coverage: "Bank credit by industry, every month in the current classification, with the series excluding the HDFC merger beside the plain ones, as the Bulletin and the Handbook print it (also reports 540, 188 and 765)" },
  { id: "42", dp: "DP1", rel: "credit-deep-scb-section42-full", date: "Fortnight Date Prov", value: "Item Values", dims: ["Item Code", "Item Description"], hide: ["Item Code"], version: "Provisional Final Flag", unit: "inr_crore", coverage: "Every line of the Section 42 return of scheduled commercial banks, every reporting fortnight since 1997, as the Bulletin prints it (also report 741)" },
  { id: "901", dp: "DP0", rel: "credit-deep-select-aggregates", date: "Time Date", value: "Item Value", dims: ["Bank Group Name", "Item Code", "Item Description"], hide: ["Item Code"], unitCol: U, version: "Version Desc", unit: "inr_crore", coverage: "Select aggregates of all scheduled commercial banks and of all scheduled banks, every reporting fortnight, with the series excluding the HDFC merger" },
  { id: "609", dp: "DPd", rel: "credit-deep-select-aggregates-handbook", date: "Time Date", value: "Rate", dims: ["Item Code", "Item Description"], hide: ["Item Code"], unitCol: U, version: "Version Desc", unit: "inr_crore", coverage: "Select aggregates of scheduled commercial banks on the last reporting Friday of each month, as the Handbook prints them (also report 803)" },
  { id: "1248", dp: "DP4", rel: "credit-deep-scb-resources", date: "Time Date", value: "Item Value", dims: ["Item Hierarchy Level1", "Item Code", "Item Description"], hide: ["Item Code"], unitCol: U, unit: "inr_crore", coverage: "Flow of financial resources from scheduled commercial banks to the commercial sector: credit and every investment in shares, bonds, commercial paper and other instruments, every reporting fortnight" },
  { id: "322", dp: "DP3", rel: "credit-deep-state-coop-banks-monthly", date: "Date", value: "Amount (Rs. Crore)", dims: ["Category Description (Bulletin)"], unitCol: U, unit: "inr_crore", coverage: "State co-operative banks that keep accounts with the RBI: deposits, borrowings, loans and investments, every month (also report 28 in the Bulletin)" },
  { id: "781", dp: "DP0", rel: "credit-deep-reserve-money-monthly", date: "Time Date", value: "Item Value Annual", dims: ["Item Hierarchy Level1", "Item Description"], unitCol: U, unit: "inr_crore", coverage: "Reserve money, its components and sources, every week since 2001, from the monthly reserve money table" },
  { id: "735", dp: "DP0", rel: "credit-deep-walr-bank-groups", date: "Year", values: [["SBI", "SBI"], ["Nationalised Bank", "nationalised banks"], ["Public Sector Bank", "public sector banks"], ["New Private Bank", "new private banks"], ["Old Private Bank", "old private banks"], ["Private Sector Bank", "private sector banks"], ["Foreign Bank", "foreign banks"], ["Regional Rural Bank", "regional rural banks"], ["All Scheduled Comm. Banks", "all scheduled commercial banks"], ["Othr Schdld Bk", "other scheduled banks"]].map(([col, label]) => ({ col, key: keyOf(label), label, unit: "pct_per_annum" })),
    dims: ["Category Desc"], relabel: [[/"\s*|\s*"/g, ""]], unit: "pct_per_annum", coverage: "Weighted average lending rates and deposit rates of scheduled commercial banks by bank group and by occupation, each year (discontinued)" },
);

// Statistical Tables Relating to Banks in India: offices, priority sector, and every bank's
// annual accounts (bank by bank, each year, as the RBI compiles them)
const VD = "Version Desc", BS = "Bal Sheet Description", BN = "Bank Name", BG = "Bank Group Name";
const ST = (id, dp, rel, date, value, dims, coverage, extra = {}) => ({ id, dp, rel, date, value, dims, unit: "inr_crore", base: "Statistical Tables Relating to Banks in India", coverage, ...extra });
DEEP.push(
  ST("615", "DP1", "credit-deep-offices-banks", "Time Date", "No Of Offices", [BG, BN, "Population Group Name", "Bnkchl Type"], "Functioning offices of every commercial bank by population group, every quarter", { unit: "count" }),
  ST("618", "DP2", "credit-deep-offices-states", "Time Date", "No Of Offices", ["State Name", "Bnkchl Type"], "Functioning offices of commercial banks by state, every quarter", { unit: "count", place: ["State Name"] }),
  ST("619", "DP1", "credit-deep-offices-bank-groups", "Time Date", "No Of Offices", [BG, "Bnkchl Type"], "Functioning offices of commercial banks by bank group, every quarter", { unit: "count" }),
  ST("621", "DP0", "credit-deep-coop-offices-districts", "Time Cal Year", null, ["Dim State.State Name", "District Name", "Population Group Name", "Tier"], "Centres and offices of state and district central co-operative banks by district and population group, each year",
    { values: [{ col: "No Of Centres", key: "centres", label: "centres", unit: "count" }, { col: "No Of Offices", key: "offices", label: "offices", unit: "count" }], place: ["Dim State.State Name", "District Name"], dimLabel: { Tier: (v) => `tier ${v}` }, unit: "count" }),
  ST("734", "DP0", "credit-deep-coop-branches-states", "Reporting Year", "Num Of Offices", ["State Name", BG], "Branches of state and district central co-operative banks by state, each year", { unit: "count", place: ["State Name"] }),
  ST("642", "DP0", "credit-deep-offices-abroad", "Reporting Year", "Office Count", ["Country Name"], "Offices of Indian commercial banks outside India, by country, each year", { unit: "count", place: ["Country Name"] }),
  ST("745", "DP0", "credit-deep-offices-abroad-banks", "Time Cal Year", "Office Count", [BN, "Country Name"], "Offices of Indian commercial banks outside India, bank by bank and country by country, each year", { unit: "count", place: ["Country Name"] }),
  // 662 and 743 are split across data providers, one measure each (siblingParts). Until
  // 2026-10-10 this read 662's DP0 alone and took its "Num Chq" column, a display-order code
  // (Mumbai 17 in every year), for the number of cheques; and 743's non-MICR provider alone,
  // labelled as all clearing houses. Hand check, 2026-10-10: Mumbai cleared 15.75 crore cheques
  // in 2023-24 and the national grid 60.95 crore in 2024-25 (STRBI Table 22); the national grid's
  // 2024-25 count equals the paper-instruments line of the RBI's payment system table (61.0 crore,
  // payments-annual). Clearing houses: 1,045 in 2005, of which 40 MICR (STRBI Table 27).
  ST("662", null, "credit-deep-cheque-clearances", "V T ime D Fis Year", null, ["Item Desc Level2"], "Cheque clearances: number of cheques and their value, by type of clearing centre, each year",
    { unitCol: U, unit: "mixed",
      // the provider with DBIE's display-unit picker carries rupees; the one without, the count
      siblings: ({ hasUnit }) => (hasUnit ? { key: "amount", label: "value cleared", unit: "inr_crore" } : { key: "cheques", label: "cheques cleared (number)", unit: "count" }) }),
  ST("743", null, "credit-deep-clearing-houses", "Reporting Year", null, ["Micr Description"], "Clearing houses, MICR (machine-read cheques) and non-MICR, by the bank that manages them, and all clearing houses, each year",
    { unit: "count", parse: strbiCount,
      // the table's providers are named for what they hold
      siblings: ({ name }) => (/^not micr$/i.test(name.trim()) ? { key: "non_micr", label: "non-MICR clearing houses", unit: "count" }
        : /^micr$/i.test(name.trim()) ? { key: "micr", label: "MICR clearing houses", unit: "count" }
        : /^total$/i.test(name.trim()) ? { key: "all", label: "all clearing houses", unit: "count" } : null) }),
  ST("705", "DP0", "credit-deep-scb-investments-old", "Reporting Date", null, ["Category Desc"], "Investments of scheduled commercial banks by kind of security: amounts and shares (discontinued)",
    { values: [{ col: "Amount_actuals", key: "amount", label: "₹ crore", unit: "inr_crore" }, { col: "Percent Share", key: "share", label: "per cent of the total", unit: "pct" }], unitCol: "Unit Desc", unit: "mixed" }),
  ST("747", "DP0", "credit-deep-scb-investments-offices", "D Time D Date", null, ["Category Desc"], "Investments of scheduled commercial banks by offices in India and abroad: amounts and shares (discontinued)",
    { values: [{ col: "Amount", key: "amount", label: "₹ crore", unit: "inr_crore" }, { col: "Percent Share", key: "share", label: "per cent of the total", unit: "pct" }], unitCol: "Unit Desc", inCrore: true, scale: 0.1, unit: "mixed",
      note: "Amounts are ₹ million in this table (government securities of ₹17,776,674 million in March 2012, report 705's ₹1,777,667 crore); converted to ₹ crore." }),
  ST("872", "DPa", "credit-deep-scb-growth-annual", "Time Date", "Amount", ["Item Desc"], "Growth of select aggregates of scheduled commercial banks (deposits, credit, investments) in each financial year since 1950-51, as the RBI prints it", { unit: "pct", freq: "annual" }),
  ST("983", "DP0", "credit-deep-priority-sector-banks", "Time Fis Year", "Item Value", ["Op Level4", BN, "Item Hierarchy Level1", "Dim Pr Scb Advances Item.Item Description", "Dim Item Account Amount.Item Description"], "Priority sector advances of every scheduled commercial bank by sector: accounts and amounts outstanding, each year (discontinued)",
    { unitCol: U, unit: "auto", skip: (c, h) => /a\/cs|accounts/i.test(c[h.indexOf("Dim Item Account Amount.Item Description")] ?? ""),
      note: "Bank groups are from the table's own bank-group column (Op Level4); its Bank Group Name column mislabels some banks. Numbers of accounts are left out: about a third are stored scaled by a thousand or more (up to 19 billion accounts for one bank) with no column saying which, so none can be trusted; the amounts are kept." }),
  ST("1003", "DP1", "credit-deep-priority-sector-states", "Time Cal Year", "Item Value", ["State Name", "Item Hierarchy Level1", "Dim Pr Scb Advances Item.Item Description", "Dim Item Account Amount.Item Description"], "Priority sector advances of scheduled commercial banks by state and sector: accounts and amounts outstanding, each year (discontinued)",
    { unitCol: U, unit: "auto", place: ["State Name"] }),
  ST("1056", "DP1", "credit-deep-bank-group-ratios", "Time Cal Year", "Ratio Amount", [BG, BS], "Select financial ratios of scheduled commercial banks by bank group, each year", { version: VD, unit: "pct", skip: (c, h) => /per employee/i.test(c[h.indexOf(BS)] ?? ""), note: "Business and profit per employee are left out: the table switches their unit from year to year (all banks' business per employee 173,638 in 2014, 20,187 in 2015, 1,413,244 in 2020) and prints no unit." }),
  ST("1057", "DP0", "credit-deep-employees-banks", "Year", "Item Value", ["Dim Bank.Bank Group Name", BN, BS], "Employees of every scheduled commercial bank by category (officers, clerks, subordinate staff), each year", { version: VD, unit: "count" }),
  ST("1058", "DP0", "credit-deep-restructured-loans", "Time Cal Year", "Item Value", [BG, BN, "Bal Sheet Hierarchy Level1", BS], "Loans restructured, including corporate debt restructuring, bank by bank, each year", { version: VD, unitCol: U, unit: "auto", relabel: [[/ \(Rs\. in Lakhs\)/i, ""]], note: "The table's headings say ₹ lakh; the values are rupees (State Bank of India's restructured doubtful assets ₹2,417 crore), shown in ₹ crore." }),
  ST("1079", "DP1", "credit-deep-contingent-liabilities", "Time Cal Year", "Item Value", [BG, BN, "Bal Sheet Hierarchy Level1", BS], "Contingent liabilities of every scheduled commercial bank, each year", { version: VD, unitCol: U }),
  ST("1088", "DP1", "credit-deep-sensitive-sectors-banks", "Time Cal Year", "Item Value", [BG, BN, BS], "Exposure of every scheduled commercial bank to the sensitive sectors (capital market, real estate, commodities), each year", { version: VD, unitCol: U }),
  ST("1111", "DP0", "credit-deep-bank-balance-sheets", "Time Cal Year", "Item Value", [BG, BN, "Bal Sheet Hierarchy Level1", "Bal Sheet Code", BS], "Liabilities and assets of every scheduled commercial bank, each year", { version: VD, hide: ["Bal Sheet Code"] }),
  ST("1112", "DP0", "credit-deep-bank-earnings", "Time Cal Year", "Item Value", [BG, BN, "Bal Sheet Hierarchy Level1", "Bal Sheet Code", BS], "Earnings and expenses of every scheduled commercial bank, each year", { version: VD, unitCol: U, hide: ["Bal Sheet Code"] }),
  ST("1113", "DP0", "credit-deep-bank-provisions", "Time Cal Year", "Item Value", [BG, BN, BS], "Provisions and contingencies of every scheduled commercial bank, each year", { version: VD, unitCol: U }),
  ST("1115", "DP1", "credit-deep-bank-profit-appropriation", "Time Cal Year", "Item Value", [BG, BN, "Bal Sheet Hierarchy Level1", BS], "Appropriation of profit of every scheduled commercial bank, each year", { version: VD, unitCol: U }),
  ST("1116", "DP1", "credit-deep-bank-maturity-profile", "Time Cal Year", "Item Value", [BG, BN, "Bal Sheet Hierarchy Level1", "Bal Sheet Code", BS], "Maturity profile of deposits, borrowings, loans and investments of every scheduled commercial bank, each year", { version: VD, unitCol: U, hide: ["Bal Sheet Code"] }),
  ST("1209", "DP0", "credit-deep-abridged-balance-sheets", "Time Line", "Amount", ["Bank Group Description", "Asset Liability Type", "Asset Liability Items"], "Abridged balance sheets of bank groups, every quarter (discontinued)", { inCrore: true }),
);

// more of the deep-archive tier: bank-by-bank balance sheets and maturity profiles (bundles of
// 6 to 10 MB); their bank-group sums are baked (reports 117, 639, 987)
for (const id of ["1111", "1116"]) ARCHIVE.add(id);
// blocked: the export prints every cell of report 976 more than once with different values
// (a dimension dropped from the WebI export), so no figure in it can be attributed
export const BLOCKED = new Set(["976"]);
for (let i = DEEP.length - 1; i >= 0; i--) if (BLOCKED.has(DEEP[i].id)) DEEP.splice(i, 1);
for (let i = DEEP.length - 1; i >= 0; i--) if (ARCHIVE.has(DEEP[i].id)) DEEP.splice(i, 1);
