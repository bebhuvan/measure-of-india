// scripts/lib/products/banks-ucb.mjs: urban co-operative banks (UCBs), for the banks guide.
// Called by banks.mjs, which fetches and archives the Innovation Hub tables.
//
// Two copies of the RBI's "Primary (Urban) Co-operative Banks' Outlook", read apart (one report,
// one bundle) and proved equal where they overlap (scripts/validate.mjs):
//
//  A. The Outlook's data tables as report grids, via the Reserve Bank Innovation Hub's service
//     (DBIE gates them behind a prompt; the Data Bank has no copy), one grid per edition,
//     as on 31 March 2014 to 2024 (profit and loss to 2025):
//       795 balance sheet, 784 profit and loss, 785 NPAs, 788 select indicators: each edition
//           prints the previous March and its own, for scheduled, non-scheduled and all UCBs;
//       786 tiers, 789 CRAR bands, 796 supervisory ratings, 772 size bands, 787 priority-sector
//           advances, 800 states and regions: each edition prints its own March;
//       797, 798, 799 the scheduled UCBs bank by bank (profit and loss, balance sheet, ratios).
//     A date printed by two editions takes the later edition's figure (the earlier edition's
//     was provisional). Rows are found by their labels and columns by their headers, which
//     change between editions (column order in 800, single and double header rows in 786, 772,
//     796, 799); nothing is read by position alone.
//  B. The Outlook's statistical tables, typed, in the local Data Bank (read-only), to March
//     2026: 771 balance-sheet shares, 773 indicators, 774 NPAs, 775 CRAR bands, 776 ratings,
//     777 UCBs by state, 810 priority-sector advances, 811 size bands (shares), 812 structure.
//     TRAP (found 2026-10-10): in 771, 773 and 774 every edition carries two rows per item, both
//     stamped with the edition's date: "Final" (Version Sk 5) is the PREVIOUS March and
//     "Provisional" (Version Sk 2) the edition's own March. Proof: the 2023-24 edition of 773
//     gives all UCBs' net interest margin as 2.99 (Final) and 3.70 (Provisional); the Outlook's
//     table 6 (report 788) prints 2.99 for March 2023 and 3.70 for March 2024. So a March's
//     value is the next edition's Final where one exists, else its own edition's Provisional.
//
// Left out, with the reason in the coverage ledger: 799's business and profit per employee
// (printed in ₹ million, ₹ crore and plain rupees in different editions, under labels that do
// not always say which), and 812's four sub-groups (unlabelled in both copies).
//
// Hand check: see the status file (docs/status/banks.md); the two copies are proved equal on
// every shared March by scripts/validate.mjs.
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../tabular.mjs";
import { writeSeries, writeRaw } from "../util.mjs";
import { dbieProvider, dbieReport, dbieLocate } from "../databank.mjs";
import { readRaw } from "../util.mjs";
import { place as placeSlug, unit as stateUnit } from "../../../src/dossiers/states-key.js";
const place = (t) => { const s = placeSlug(t); return s ? stateUnit(s) : null; };

const clean = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/[\t\n\r]+/g, " ").replace(/\s+/g, " ").trim();
const keyOf = (s, n = 60) => clean(s).toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n).replace(/_$/, "");
const num = (s) => { const t = clean(s).replace(/,/g, "").replace(/%$/, "").replace(/^`/, ""); if (t === "" || t === "-" || /^n\.?a\.?$/i.test(t)) return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const isNum = (s) => num(s) != null;
const march = (y) => `${y}-03-01`;
const editionYear = (p) => { const m = /^(\d{4})-(\d{2})$/.exec(p); if (!m) throw new Error(`banks-ucb: edition "${p}" is not a financial year`); return +m[1] + 1; };
// "2023", "2022-23", "2023-24" -> the March it ends
const yearOf = (s) => { const t = clean(s); let m; if ((m = /^(\d{4})$/.exec(t))) return +m[1]; if ((m = /^(\d{4})-(\d{2})$/.exec(t))) return +m[1] + 1; return null; };
const GROUPS = [[/^scheduled ucbs?$/i, "scheduled", "Scheduled UCBs"], [/^non-?scheduled ucbs?$/i, "non_scheduled", "Non-scheduled UCBs"], [/^all ucbs?$/i, "all", "All UCBs"]];
const groupOf = (s) => GROUPS.find(([re]) => re.test(clean(s)));
// early editions of table 7 print all UCBs only, under "As on March 31"
const groupOrAll = (s) => groupOf(s) ?? (/^as on march 31$/i.test(clean(s)) ? GROUPS[2] : null);
// tidy a table's item label: numbering, arithmetic notes and stray spacing out; sentence case kept
const itemLabel = (s) => clean(s).replace(/^(\d+\.|\d+\)|[A-Z]\)|\(?[ivx]+\)|[a-z]\)|\(?[a-z]\))\s*/i, "").replace(/\s*\[[^\]]*\]\s*/g, " ").replace(/\s*\((?:\d+\s*[+-]\s*)+\d+\)/g, "").replace(/\s+\*+$|\s*\*+$/, "").replace(/\s+@$/, "").replace(/\s+/g, " ").trim();

// depth of an item from its numbering: "1) Capital" or "3. Total Income" 0, "A) SLR" 1, "i) ..." 2
const levelOf = (raw) => { const t = clean(raw); return /^[A-Z]\)\s/.test(t) ? 1 : /^\(?[ivx]+[).]\s/i.test(t) || /^[a-z]\)\s/.test(t) ? 2 : 0; };
/** One Innovation Hub grid as blocks: Map(edition -> rows of cells c1..cN). */
function blocks(csv) {
  const rows = parseCsv(csv, ",");
  const ix = Object.fromEntries(rows[0].map((h, i) => [h, i]));
  const out = new Map();
  for (const r of rows.slice(1)) {
    if (r.length < 4) continue;
    const p = r[ix.period];
    if (!out.has(p)) out.set(p, []);
    out.get(p).push({ n: +r[ix.row_no], c: r.slice(ix.c1).map(clean) });
  }
  // an edition is the latest March it prints ("As on March 31, 2024", or its year columns), not
  // the service's period label: the service files nine copies of report 798's 2024 grid under
  // the periods 2015-16 to 2022-23. A repeated edition must be an exact copy, and is read once.
  const byEd = new Map();
  for (const [p, b] of out) {
    const rows = b.sort((a, z) => a.n - z.n).map((x) => x.c);
    const head = rows.slice(0, 16);
    const yrs = [...head.flatMap((r) => r.flatMap((c) => [...c.matchAll(/March 31,?\s*(\d{4})/gi)].map((m) => +m[1]))), ...head.flatMap((r) => r.map((c) => yearOf(c)).filter(Boolean))];
    const ed = yrs.length ? Math.max(...yrs) : editionYear(p);
    const label = `${ed - 1}-${String(ed % 100).padStart(2, "0")}`;
    if (byEd.has(label)) {
      if (JSON.stringify(byEd.get(label)) !== JSON.stringify(rows)) throw new Error(`banks-ucb: two different grids print the ${label} edition (periods include ${p})`);
      continue;
    }
    byEd.set(label, rows);
  }
  return byEd;
}

/** Collect values: put(seriesKey, label, unit, date, value, editionYear, extra). Later editions win. */
function collector() {
  const S = new Map();
  return {
    S,
    put(key, label, unit, date, v, ed, extra = {}) {
      if (v == null) return;
      const s = S.get(key) ?? { label, unit, vals: new Map(), ...extra };
      S.set(key, s);
      const p = s.vals.get(date);
      if (!p || ed > p.ed) s.vals.set(date, { v, ed });
      else if (ed === p.ed && p.v !== v) throw new Error(`banks-ucb: ${label} ${date} printed twice in one edition (${p.v}, ${v})`);
    },
  };
}

// catalogue mode (banks.mjs --catalogue): collect what each table holds instead of writing
export const SINK = { on: false, out: [] };
function writeBundle(root, rel, C, metaBase, extra) {
  if (SINK.on) { SINK.out.push({ rel, keys: [...C.S].filter(([, v]) => [...v.vals.values()].some((x) => x.v != null)).map(([k]) => k), labels: Object.fromEntries([...C.S].map(([k, v]) => [k, v.label])) }); return { bundle: rel, series: C.S.size, from: "", to: "" }; }
  const dates = [...new Set([...C.S.values()].flatMap((s) => [...s.vals.keys()]))].sort();
  if (!dates.length) throw new Error(`banks-ucb: ${rel} has no values`);
  // annual axis, every March from the first to the last
  const axis = []; for (let y = +dates[0].slice(0, 4); y <= +dates.at(-1).slice(0, 4); y++) axis.push(march(y));
  const series = {};
  for (const [k, s] of C.S) {
    const data = axis.map((d) => s.vals.get(d)?.v ?? null);
    if (data.every((x) => x == null)) continue;
    const f = data.findIndex((x) => x != null), l = data.length - 1 - [...data].reverse().findIndex((x) => x != null);
    const gaps = axis.filter((d, i) => i > f && i < l && data[i] == null);
    const { vals, ...rest } = s;
    series[k] = { name: `${k}_${s.unit}`, ...rest, data, ...(gaps.length ? { gaps, gapsNote: s.gapsNote ?? "No edition of the RBI's table prints this figure for these years." } : {}) };
    delete series[k].gapsNote; if (gaps.length) series[k].gapsNote = s.gapsNote ?? "No edition of the RBI's table prints this figure for these years.";
  }
  writeSeries(root, `data/series/${rel}.json`, { meta: { ...metaBase, frequency: "annual", unit: extra.unit ?? "mixed", base: "as on 31 March", latestPeriod: axis.at(-1).slice(0, 7), ...extra }, dates: axis, series });
  return { bundle: rel, series: Object.keys(series).length, from: axis[0], to: axis.at(-1) };
}

/* ---------------- A. the Innovation Hub grids ---------------- */

// item x {scheduled, non-scheduled, all} x two years (795, 784, 785, 788); 795 adds a row of
// shares (per cent of total liabilities or assets) under each item
function twoYearGroups(csv, { shares = false, unitOf, id = "?" }) {
  const C = collector();
  for (const [p, rows] of blocks(csv)) {
    const ed = editionYear(p);
    const gi = rows.findIndex((r) => r.filter((c) => groupOrAll(c)).length >= 1 && (rows[rows.indexOf(r) + 1] ?? []).some((c) => yearOf(c)));
    if (gi < 0) throw new Error(`banks-ucb: report ${id}: no scheduled / non-scheduled / all header in edition ${p}`);
    const g = rows[gi], y = rows[gi + 1];
    const cols = [];   // { i, grp, year }
    let cur = null;
    for (let i = 0; i < Math.max(g.length, y.length); i++) {
      if (groupOrAll(g[i] ?? "")) cur = groupOrAll(g[i]);
      const yr = yearOf(y[i] ?? "");
      if (cur && yr) cols.push({ i, grp: cur, year: yr });
    }
    const ng = g.filter((c) => groupOrAll(c)).length;
    if (cols.length !== 2 * ng) throw new Error(`banks-ucb: report ${id} edition ${p}: expected ${2 * ng} group-year columns, found ${cols.length}`);
    // where the values start relative to the year row: the first year sits over the first value
    // values sit in the year row's columns; the item label is the text before the first of them
    let last = null;
    const path = [];   // the item's parents, from the table's numbering (1) > A) > i))
    for (const r of rows.slice(gi + 2)) {
      const lab = r.slice(0, cols[0].i).find((c, i) => c && !isNum(c));
      let label = lab ? itemLabel(lab) : null;
      if (label) {
        const lv = levelOf(lab);
        path.length = lv; path[lv] = label;
        if (lv > 0) label = path.filter(Boolean).map((x, j) => (j ? x.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()) : x)).join(", ");
      }
      if (label && /^(note|source)/i.test(label)) break;
      const vals = cols.map((c) => num(r[c.i]));
      if (label) {
        if (vals.every((v) => v == null)) { last = null; continue; }   // a heading row ("Liabilities")
        last = label;
        const unit = unitOf(label);
        cols.forEach((col, j) => C.put(`${col.grp[1]}__${keyOf(label)}`, `${col.grp[2]}, ${label}`, unit, march(col.year), vals[j], ed, { group: col.grp[2] }));
      } else if (shares && last) {
        if (vals.some((v) => v != null)) cols.forEach((col, j) => C.put(`${col.grp[1]}__${keyOf(last)}__share`, `${col.grp[2]}, ${last}, per cent of total`, "pct", march(col.year), vals[j], ed, { group: col.grp[2] }));
        last = null;
      }
    }
  }
  return C;
}

// a single-year table with a label column and named measure columns (786, 789, 796, 787, 799):
// header rows are joined column by column; a percentage column is the share of the measure before it
function singleYear(csv, { labelRe, measures, unitOf, skipRow = () => false, group = () => null, editionOk = () => true }) {
  const C = collector();
  for (const [p, rows] of blocks(csv)) {
    if (!editionOk(p)) continue;
    const ed = editionYear(p);
    const hi = rows.findIndex((r) => r.some((c) => labelRe.test(c)));
    if (hi < 0) throw new Error(`banks-ucb: edition ${p}: no header row matching ${labelRe}`);
    // header block: the label row and any text rows under it before the first data row
    let end = hi + 1;
    while (end < rows.length && rows[end].some((c) => c) && !rows[end].some((c, i) => i > 0 && isNum(c) && !/^\d$/.test(c))) end++;
    const width = Math.max(...rows.slice(hi, end).map((r) => r.length));
    const names = [];
    for (let i = 0; i < width; i++) names.push(rows.slice(hi, end).map((r) => r[i] ?? "").filter(Boolean).join(" "));
    // forward-fill a measure over the columns it spans (a two-row header)
    const top = rows[hi]; let span = null;
    for (let i = 0; i < width; i++) { if (top[i]) span = top[i]; else if (span && names[i] && end - hi > 1) names[i] = `${span} ${names[i]}`; }
    const li = names.findIndex((n) => labelRe.test(n));
    const cols = [];
    let lastMeasure = null;
    names.forEach((n, i) => {
      if (i <= li || !n) return;
      const own = rows.slice(hi, end).map((r) => r[i] ?? "").filter(Boolean).at(-1) ?? "";   // the column's lowest header cell
      const m = measures.find(([re]) => re.test(n)) ?? measures.find(([re]) => re.test(own));
      if (/percent|%|share/i.test(own) && lastMeasure && !(m && m[3] === "pct")) cols.push({ i, key: `${lastMeasure[1]}_share`, label: `${lastMeasure[2]}, per cent of total`, unit: "pct" });
      else if (m) { cols.push({ i, key: m[1], label: m[2], unit: m[3] ?? unitOf(m[1]) }); lastMeasure = m; }
    });
    if (!cols.length) throw new Error(`banks-ucb: edition ${p}: no measure columns in ${names.join(" | ")}`);
    for (const r of rows.slice(end)) {
      const lab = r[li];
      if (!lab) { if (r.some((c) => /^note|^source/i.test(c))) break; continue; }
      if (/^note|^source/i.test(lab)) break;
      if (skipRow(lab)) continue;
      const L = itemLabel(lab);
      for (const col of cols) {
        const v = num(r[col.i]);
        const g = group(L);
        C.put(`${keyOf(L, 50)}__${col.key}`, `${L}, ${col.label}`, col.unit, march(ed), v, ed, g ? { group: g } : {});
      }
    }
  }
  return C;
}

// 772: three side-by-side blocks (by deposits, by advances, by total assets), each
// band | number | share | amount | share; the band label says which block it is (D, Ad, Asset)
function sizeBands(csv) {
  const C = collector();
  const BLOCK = { D: ["deposits", "UCBs by size of deposits"], AD: ["advances", "UCBs by size of advances"], ASSET: ["assets", "UCBs by size of total assets"] };
  for (const [p, rows] of blocks(csv)) {
    const ed = editionYear(p);
    for (const r of rows) {
      for (let i = 0; i < r.length; i++) {
        const m = /^(?:([\d.]+)\s*<=\s*)?(D|Ad|Asset)\s*(<|≥|>=)\s*([\d.]+)$/i.exec(r[i]) ?? (/^total$/i.test(r[i]) && isNum(r[i + 1]) ? [r[i], null, null, "total", null] : null);
        if (!m) continue;
        // which block a "Total" row belongs to: by its position among the row's totals
        const which = m[2] ? m[2].toUpperCase() : ["D", "AD", "ASSET"][r.slice(0, i).filter((c) => /^total$/i.test(c)).length];
        const [word, title] = BLOCK[which];
        const band = m[4] === "total" || m[3] === "total" ? "All UCBs" : m[1] != null ? `₹${+m[1]} crore to ₹${+m[4]} crore` : `₹${+m[4]} crore and above`;
        const bk = keyOf(band);
        const v = r.slice(i + 1, i + 5).map(num);
        if (v.filter((x) => x != null).length < 4) continue;
        C.put(`${word}__${bk}__number`, `${title}, ${band}, number of UCBs`, "count", march(ed), v[0], ed, { group: title });
        C.put(`${word}__${bk}__number_share`, `${title}, ${band}, per cent of UCBs`, "pct", march(ed), v[1], ed, { group: title });
        C.put(`${word}__${bk}__amount`, `${title}, ${band}, ${word}`, "inr_crore", march(ed), v[2], ed, { group: title });
        C.put(`${word}__${bk}__amount_share`, `${title}, ${band}, per cent of all UCBs' ${word}`, "pct", march(ed), v[3], ed, { group: title });
      }
    }
  }
  return C;
}

// 800: states and regions; columns by header name (their order changed in 2014-15)
function states(csv) {
  const C = collector();
  const M = [[/^no\.? of ucbs/i, "ucbs", "number of UCBs", "count"], [/branches/i, "branches", "branches", "count"], [/^deposits/i, "deposits", "deposits", "inr_crore"], [/^advances/i, "advances", "advances", "inr_crore"],
    [/^total districts/i, "districts", "districts", "count"], [/districts with(?!out)/i, "districts_with_ucb", "districts with a UCB", "count"], [/districts without/i, "districts_without_ucb", "districts without a UCB", "count"],
    [/extension counters/i, "extension_counters", "extension counters", "count"], [/atms/i, "atms", "ATMs", "count"]];
  const unplaced = new Set();
  for (const [p, rows] of blocks(csv)) {
    const ed = editionYear(p);
    const hi = rows.findIndex((r) => r.some((c) => /^name$/i.test(c)));
    const H = rows[hi];
    const cols = H.map((h, i) => [i, M.find(([re]) => re.test(h))]).filter(([, m]) => m);
    const ni = H.findIndex((c) => /^name$/i.test(c)), si = H.findIndex((c) => /state ?\/ ?ut/i.test(c));
    for (const r of rows.slice(hi + 1)) {
      if (r.some((c) => /^note|^\d\. data|^source/i.test(c))) break;
      let name, off;
      if (/^\d+$/.test(r[0]) && r[ni]) { name = r[ni]; off = 0; }                         // a state row
      else if (r[0] && /total$|^all india$/i.test(r[0]) && isNum(r[1])) { name = r[0]; off = si - 0; }   // region total or all-India: values two columns left
      else continue;
      const isAgg = /total$|^all india$/i.test(name);
      let slug, label;
      if (isAgg) { slug = keyOf(name.replace(/ total$/i, "")); label = /^all india$/i.test(name) ? "All India" : name.replace(/ Total$/i, ""); }
      else {
        const u = place(name);
        if (!u) { unplaced.add(name); continue; }
        // a state that changed shape inside the span is two series (states-key.js SEAMS)
        slug = u.slug === "andhra-pradesh" && ed <= 2014 ? "andhra-pradesh-undivided" : u.slug === "jammu-kashmir" && ed <= 2019 ? "jammu-kashmir-state" : u.slug;
        label = slug === "andhra-pradesh-undivided" ? "Andhra Pradesh (undivided)" : slug === "jammu-kashmir-state" ? "Jammu and Kashmir (state)" : u.name;
      }
      for (const [i, m] of cols) C.put(`${keyOf(slug)}__${m[1]}`, `${label}, ${m[2]}`, m[3], march(ed), num(r[i - off]), ed, { group: isAgg ? "Regions and all India" : "States and union territories", ...(isAgg ? {} : { state: slug }) });
    }
  }
  if (unplaced.size) throw new Error(`banks-ucb 800: state names not in states-key.js: ${[...unplaced].join(", ")}`);
  return C;
}

// bank-wise scheduled UCBs (797 P&L and 798 balance sheet: two years per item; 799 ratios: one)
const bankKey = (n) => keyOf(clean(n).replace(/^the\s+/i, "").replace(/[#*@]+/g, "").replace(/co-?op(?:erative)?\.?\s*/gi, "cooperative ").replace(/\bltd\.?|\blimited\b/gi, "").replace(/,.*$/, "").replace(/\((?:[^)]*)\)$/, "").replace(/\s+/g, " "), 40);
const nameKey = (n) => clean(n).replace(/\s*[#*@$]+$/, "").toLowerCase();
/** Link a scheduled UCB's names across editions of the bank-wise profit and loss table (797, the
 *  one with every edition): each edition reprints the previous year's interest received, which
 *  must equal (within 0.5 per cent, as a revision allows) what the previous edition printed for
 *  the same bank. Returns
 *  Map(name -> stable key, from the bank's latest name). Unmatched names stand alone. */
export function linkUcbNames(csv797) {
  const ed = new Map();   // edition -> Map(name -> { [year]: deposits })
  for (const [p, rows] of blocks(csv797)) {
    const bi = rows.findIndex((r) => r.some((c) => /^bank name$/i.test(c))); const ni = rows[bi].findIndex((c) => /^bank name$/i.test(c));
    const RE = /^1\. interest \/ discount received/i;
    let mi = bi; while (!rows[mi].some((c) => RE.test(c))) mi++;
    const dcols = rows[mi].map((c, i) => (RE.test(c) ? i : -1)).filter((i) => i >= 0);
    const di = dcols[0]; const yr = rows[mi + 1];
    const m = new Map();
    // two figures per year: interest received (all) and on advances, the next measure's columns
    for (const r of rows.slice(mi + 2)) { const n = r[ni]; if (!n || /^total$/i.test(n)) continue; m.set(nameKey(n), { [yearOf(yr[di])]: [num(r[di]), num(r[di + 2])], [yearOf(yr[di + 1])]: [num(r[di + 1]), num(r[di + 3])] }); }
    ed.set(editionYear(p), m);
  }
  const parent = new Map(); const find = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  for (const m of ed.values()) for (const n of m.keys()) parent.set(n, n);
  const eds = [...ed.keys()].sort();
  for (let j = 1; j < eds.length; j++) {
    const cur = ed.get(eds[j]), prev = ed.get(eds[j - 1]); const y = eds[j] - 1;
    for (const [n, v] of cur) {
      if (prev.has(n)) { parent.set(find(n), find(n)); continue; }
      const a = v[y]; if (!a || a.some((x) => x == null || x <= 0)) continue;
      const near = (x, z) => x != null && Math.abs(x - z) <= 0.005 * z;
      const hits = [...prev].filter(([pn, pv]) => pv[y] && near(pv[y][0], a[0]) && near(pv[y][1], a[1]) && !cur.has(pn));
      if (hits.length === 1) parent.set(find(hits[0][0]), find(n));
    }
  }
  // key each linked group by its latest name
  const latest = new Map();
  for (const e of eds) for (const n of ed.get(e).keys()) latest.set(find(n), n);
  return new Map([...parent.keys()].map((n) => [n, latest.get(find(n))]));
}
function bankWise(csv, { twoYear, measureRow, measureOf, skip = () => false, alias = new Map() }) {
  const C = collector();
  const names = new Map();   // key -> latest name
  for (const [p, rows] of blocks(csv)) {
    const ed = editionYear(p);
    const bi = rows.findIndex((r) => r.some((c) => /^bank name$/i.test(c)));
    if (bi < 0) throw new Error(`banks-ucb: edition ${p}: no "Bank Name" header`);
    const ni = rows[bi].findIndex((c) => /^bank name$/i.test(c));
    // the measure names: on the Bank Name row, or on a row under it (798: Liabilities / Assets above)
    let mi = bi; while (mi < bi + 3 && rows[mi].slice(ni + 1).filter((c) => c && measureOf(c)).length < 3) mi++;
    if (mi >= bi + 3) throw new Error(`banks-ucb: edition ${p}: no measure row`);
    const MR = rows[mi];
    const yr = twoYear ? rows[mi + 1] : null;
    const cols = [];
    let cur = null;
    const path = [];
    for (let i = ni + 1; i < Math.max(MR.length, yr?.length ?? 0); i++) {
      if (MR[i]) {
        cur = measureOf(MR[i]);
        // a sub-item ("A) SLR Investments", "i) ...") carries its parents, so repeated names stay apart
        if (cur && cur !== "skip") { const lv = levelOf(MR[i]); path.length = lv; path[lv] = cur.label; if (lv > 0) { const L = path.filter(Boolean).join(", "); cur = { ...cur, key: keyOf(L), label: L }; } }
      }
      if (!cur || cur === "skip") continue;
      if (twoYear) { const y = yearOf(yr[i] ?? ""); if (y) cols.push({ i, m: cur, year: y }); }
      else if (MR[i]) cols.push({ i, m: cur, year: ed });
    }
    const seenM = new Map(); for (const c of cols) seenM.set(`${c.m.key}|${c.year}`, (seenM.get(`${c.m.key}|${c.year}`) ?? 0) + 1);
    for (const [k, n] of seenM) if (n > 1) throw new Error(`banks-ucb: edition ${p}: ${k} in ${n} columns`);
    for (const r of rows.slice((twoYear ? mi + 2 : mi + 1))) {
      const name = r[ni];
      if (!name || /^total$/i.test(name)) { if (/^total$/i.test(name)) for (const c of cols) C.put(`all_scheduled__${c.m.key}`, `All scheduled UCBs (table total), ${c.m.label}`, c.m.unit, march(c.year), num(r[c.i]), ed, { group: "Table total" }); continue; }
      if (/^note|^source/i.test(name) || skip(name)) continue;
      const canon = alias.get(nameKey(name)) ?? nameKey(name);
      const bk = bankKey(canon);
      const prev = names.get(bk); if (!prev || prev.ed <= ed) names.set(bk, { name: clean(name).replace(/\s*[#*@$]+$/, ""), ed });
      for (const c of cols) C.put(`${bk}__${c.m.key}`, null, c.m.unit, march(c.year), num(r[c.i]), ed, { measure: c.m.label });
    }
  }
  for (const [k, s] of C.S) if (!s.label) { const bk = k.split("__")[0]; s.label = `${names.get(bk).name}, ${s.measure}`; s.group = "Scheduled UCBs, bank by bank"; s.bank = names.get(bk).name; delete s.measure; }
  return C;
}

/* ---------------- B. the Data Bank's typed tables ---------------- */

// 771, 773, 774: Final = the previous March, Provisional = the edition's own March
function typedVersioned(db, id, dp, { item, group = "Bank Group Ucb Description", value = "Item Value", unitOf, scale = (v) => v }) {
  const r = dp ? dbieProvider(db, id, dp) : dbieReport(db, id);
  const C = collector();
  for (const x of r.rows) {
    const v0 = num(x[value]); if (v0 == null) continue;
    const ed = editionYear(x["Time Fis Year"]);
    const fin = /final/i.test(x["Version Desc"] ?? "") || x["Version Sk"] === "5";
    const date = march(fin ? ed - 1 : ed);
    const g = groupOf(x[group]); if (!g) continue;
    const L = itemLabel(x[item]);
    const unit = unitOf(L, x);
    // a Final row is the settled figure; it outranks the Provisional of the same March
    C.put(`${g[1]}__${keyOf(L)}`, `${g[2]}, ${L}`, unit, date, scale(v0, unit), fin ? ed * 10 + 1 : ed * 10, { group: g[2] });
  }
  return { C, provenance: r.provenance };
}

export const UCB_TYPED = [["771", null], ["773", "DP0"], ["774", null], ["775", null], ["776", null], ["777", null], ["810", null], ["811", null], ["812", "DP2"]];
export async function buildBanksUcb(root, db, R, metaBase, dcfg, runVintage) {
  const out = [];
  const M = (extra) => ({ ...metaBase, ...extra });
  const src = (id) => `RBI DBIE report ${id}, the Primary (Urban) Co-operative Banks' Outlook, via the Reserve Bank Innovation Hub's data service (one grid per edition, as on 31 March; a March printed by two editions takes the later edition's figure).`;
  const amountOrPct = (label) => (/ratio|%|per cent|return on|margin|coverage/i.test(label) ? "pct" : /^no\.? of/i.test(label) ? "count" : "inr_crore");

  // ---- A: the grids ----
  out.push(writeBundle(root, "banks-ucb-balance-sheet", twoYearGroups(R[795].csv, { id: "795", shares: true, unitOf: amountOrPct }), M({ source: metaBase.source }),
    { coverage: "Liabilities and assets of urban co-operative banks, scheduled, non-scheduled and all, every March, in ₹ crore and as shares of the total", note: `${src(795)} Table 1. Shares are per cent of total liabilities (or assets), as printed.` }));
  out.push(writeBundle(root, "banks-ucb-income", twoYearGroups(R[784].csv, { id: "784", unitOf: amountOrPct }), M({}),
    { coverage: "Income, expenses and profit of urban co-operative banks, scheduled, non-scheduled and all, each financial year", note: `${src(784)} Table 2. Each year runs April to March; 'No. of UCBs' is the count the year's figures cover.` }));
  out.push(writeBundle(root, "banks-ucb-npa", twoYearGroups(R[785].csv, { id: "785", unitOf: amountOrPct }), M({}),
    { coverage: "Bad loans of urban co-operative banks: gross and net NPAs, their ratios, provisions and coverage, scheduled, non-scheduled and all", note: `${src(785)} Table 7. The latest March is provisional in its own edition.` }));
  out.push(writeBundle(root, "banks-ucb-indicators", twoYearGroups(R[788].csv, { id: "788", unitOf: () => "pct" }), M({}),
    { unit: "pct", coverage: "Return on assets, return on equity and net interest margin of urban co-operative banks, scheduled, non-scheduled and all", note: `${src(788)} Table 6. Per cent.` }));
  out.push(writeBundle(root, "banks-ucb-tiers", singleYear(R[786].csv, { labelRe: /^tier$/i, unitOf: (k) => (k === "ucbs" ? "count" : "inr_crore"),
    measures: [[/^no\.? of ucbs/i, "ucbs", "number of UCBs"], [/^deposits/i, "deposits", "deposits"], [/^advances/i, "advances", "advances"], [/^total assets/i, "assets", "total assets"]], group: () => "UCBs by tier" }), M({}),
    { coverage: "Urban co-operative banks by regulatory tier (I to IV): number, deposits, advances and assets, and each tier's share", note: `${src(786)} Table 5. Tiers are the RBI's four-tier framework for UCBs (December 2022) where the edition is from 2022-23; earlier editions use the tiers of their time, so a tier's meaning changed in 2023 (disclosed, not joined: read the shares year by year).` }));
  out.push(writeBundle(root, "banks-ucb-crar", singleYear(R[789].csv, { labelRe: /^crar/i, unitOf: () => "count",
    measures: [[/^scheduled/i, "scheduled", "scheduled UCBs"], [/^non-?scheduled/i, "non_scheduled", "non-scheduled UCBs"], [/^all ucbs?/i, "all", "all UCBs"]], skipRow: (l) => /^total$/i.test(l) && false, group: () => "UCBs by capital adequacy ratio" }), M({}),
    { unit: "count", coverage: "Urban co-operative banks counted by capital adequacy ratio band, scheduled, non-scheduled and all", note: `${src(789)} Table 8.` }));
  out.push(writeBundle(root, "banks-ucb-ratings", singleYear(R[796].csv, { labelRe: /^ratings?$/i, unitOf: (k) => (k === "ucbs" ? "count" : "inr_crore"),
    measures: [[/^no\.? of ucbs|^number|^banks/i, "ucbs", "number of UCBs", "count"], [/^deposits/i, "deposits", "deposits"], [/^advances/i, "advances", "advances"]], group: () => "UCBs by supervisory rating" }), M({}),
    { coverage: "Urban co-operative banks by the RBI's supervisory rating (A to E): number, deposits, advances and shares", note: `${src(796)} Table 9. The 2023-24 edition's shares add to 104 per cent as printed (the RBI's rounding of a rating it lists twice is not explained); kept as printed.` }));
  out.push(writeBundle(root, "banks-ucb-size", sizeBands(R[772].csv), M({}),
    { coverage: "Urban co-operative banks by size of deposits, of advances and (from 2024) of total assets: number of banks and amounts in each band, with shares", note: `${src(772)} Table 4. Bands in ₹ crore.` }));
  out.push(writeBundle(root, "banks-ucb-priority", singleYear(R[787].csv, { labelRe: /^item$/i, unitOf: () => "inr_crore",
    measures: [[/weaker.*amount/i, "weaker_amount", "advances to weaker sections"], [/weaker.*(percentage|share)/i, "weaker_share", "advances to weaker sections, per cent of total advances", "pct"], [/priority sector advances amount|^amount$/i, "amount", "priority-sector advances"], [/percentage to total|share in total/i, "share", "per cent of total advances", "pct"]],
    group: () => "Priority-sector advances of UCBs" }), M({}),
    { coverage: "Urban co-operative banks' priority-sector advances by sector (agriculture, micro and small enterprises, housing, education...), in ₹ crore and as a share of all their advances", note: `${src(787)} Table 3. All UCBs.` }));
  out.push(writeBundle(root, "banks-ucb-states", states(R[800].csv), M({}),
    { coverage: "Urban co-operative banks state by state and region by region: number of banks, branches, deposits, advances, districts reached, extension counters and ATMs", note: `${src(800)} Table 10. Andhra Pradesh before the 2014 split and Jammu and Kashmir before 2019 are their own series.` }));
  const alias = linkUcbNames(R[797].csv);
  const P = { cost_of_deposits: [/cost of dep/i, "average cost of deposits", "pct"], yield_on_advances: [/yield on adv/i, "average yield on advances", "pct"], nii_to_assets: [/nii to ta|net int(?:erest)? inc(?:ome)? to tot/i, "net interest income to total assets (spread)", "pct"],
    nii_to_working_funds: [/nii to wf|net int(?:erest)? inc(?:ome)? to w(?:or)?k?i?ng/i, "net interest income to working funds", "pct"], non_interest_income_to_working_funds: [/non-?ii to wf|non-?int(?:erest)? inc(?:ome)? to w/i, "non-interest income to working funds", "pct"],
    roa: [/return on/i, "return on assets", "pct"], crar: [/^crar/i, "capital adequacy ratio (CRAR)", "pct"] };
  const measure799 = (h) => { if (/per employ|^b\/e|^p\/e/i.test(h)) return "skip"; const e = Object.entries(P).find(([, [re]]) => re.test(h)); return e ? { key: e[0], label: e[1][1], unit: e[1][2] } : null; };
  out.push(writeBundle(root, "banks-ucb-banks-ratios", bankWise(R[799].csv, { twoYear: false, measureOf: measure799, alias }), M({}),
    { unit: "pct", coverage: "Each scheduled urban co-operative bank's cost of deposits, yield on advances, spread, return on assets and capital adequacy ratio, every March", note: `${src(799)} Table 13. Business and profit per employee are left out: the editions print them in ₹ million, ₹ crore and plain rupees under labels that do not always say which.` }));
  const bsMeasure = (h) => { const L = itemLabel(h); return L ? { key: keyOf(L), label: L.replace(/^./, (c) => c.toLowerCase()), unit: "inr_crore" } : null; };
  out.push(writeBundle(root, "banks-ucb-banks-balance-sheet", bankWise(R[798].csv, { twoYear: true, alias, measureOf: (h) => (/^(liabilities|assets)$/i.test(clean(h)) ? null : bsMeasure(h)) }), M({}),
    { unit: "inr_crore", coverage: "Each scheduled urban co-operative bank's balance sheet: capital, reserves, deposits, borrowings, investments, loans and advances, every March", note: `${src(798)} Table 11. ₹ crore.` }));
  out.push(writeBundle(root, "banks-ucb-banks-income", bankWise(R[797].csv, { twoYear: true, measureOf: bsMeasure, alias }), M({}),
    { unit: "inr_crore", coverage: "Each scheduled urban co-operative bank's income, expenses and profit, each financial year", note: `${src(797)} Table 12. ₹ crore.` }));

  // ---- B: the Data Bank's typed tables (to March 2026) ----
  // the typed tables' provenance is archived first, so their bundles carry its data vintage
  const prov = Object.fromEntries(UCB_TYPED.map(([id, dp]) => { const l = dbieLocate(db, id, dp); return [id, { report_id: id, data_provider: l.provider, rows: l.rowCount, retrieved_at: l.retrieved_at, sha256: l.sha256, document_id: l.document_id }]; }));
  if (!SINK.on) writeRaw(root, "data/raw/banks-ucb-databank.json", { vintage: runVintage ?? metaBase.vintage, note: "Provenance of the Outlook's typed tables read from the local Data Bank mirror (read-only): report, data provider, rows, the Data Bank's fetch time and the content sha256 of its stored copy. The rows themselves are pinned by that sha256.", reports: prov });
  const VB = SINK.on ? null : readRaw(root, "data/raw/banks-ucb-databank.json").vintage;
  const MB = (extra) => ({ ...metaBase, vintage: VB, source: "Reserve Bank of India, DBIE (via the local Data Bank)", ...extra });
  const dbSrc = (id) => `RBI DBIE report ${id}, the Primary (Urban) Co-operative Banks' Outlook (statistical table), read from the local Data Bank mirror.`;
  const crore = (v, unit) => (unit === "inr_crore" ? Math.round((v / 1e7) * 100) / 100 : Math.round(v * 100) / 100);
  const vrule = " Each edition prints the previous March as 'Final' and its own March as 'Provisional', both under the edition's date; read accordingly (a March takes the next edition's Final where one exists).";
  {
    const { C, provenance } = typedVersioned(db, "774", null, { item: "Item Description", unitOf: (L) => (/ratio|%/i.test(L) ? "pct" : "inr_crore"), scale: crore });
    out.push(writeBundle(root, "banks-ucb-npa-dbie", C, MB({}), { coverage: "Bad loans of urban co-operative banks to March 2026: gross and net NPAs, ratios, provisions and coverage, scheduled, non-scheduled and all", note: dbSrc(774) + vrule + " Amounts in ₹ crore." }));
  }
  {
    const { C, provenance } = typedVersioned(db, "773", "DP0", { item: "Item Description", unitOf: () => "pct", scale: crore });
    out.push(writeBundle(root, "banks-ucb-indicators-dbie", C, MB({}), { unit: "pct", coverage: "Return on assets, return on equity and net interest margin of urban co-operative banks to March 2026", note: dbSrc(773) + vrule }));
  }
  {
    const { C, provenance } = typedVersioned(db, "771", null, { item: "Item Description", unitOf: () => "pct", scale: crore });
    for (const s of C.S.values()) s.label += ", per cent of total";
    out.push(writeBundle(root, "banks-ucb-balance-sheet-shares", C, MB({}), { unit: "pct", coverage: "Liabilities and assets of urban co-operative banks as shares of the total, to March 2026", note: dbSrc(771) + vrule + " The Data Bank's copy carries only the shares (per cent of total liabilities or assets); the amounts are in banks-ucb-balance-sheet, to March 2024." }));
  }
  // single-version typed tables
  const typed = (id, dp, fn) => { const r = dp ? dbieProvider(db, id, dp) : dbieReport(db, id); const C = collector(); for (const x of r.rows) fn(x, C); return C; };
  out.push(writeBundle(root, "banks-ucb-crar-dbie", typed("775", null, (x, C) => { const g = groupOf(x["Bank Group Ucb Description"]); const v = num(x["Item Value"]); if (!g || v == null) return; const ed = editionYear(x["Time Fis Year"]);
    C.put(`${keyOf(x["Item Description"])}__${g[1]}`, `${clean(x["Item Description"])}, ${g[2].toLowerCase().replace("ucbs", "UCBs")}`, "count", march(ed), v, ed, { group: "UCBs by capital adequacy ratio" }); }), MB({}),
    { unit: "count", coverage: "Urban co-operative banks counted by capital adequacy ratio band, to March 2026", note: dbSrc(775) }));
  out.push(writeBundle(root, "banks-ucb-ratings-dbie", typed("776", null, (x, C) => { const v = num(x["Item Value"]); if (v == null) return; const ed = editionYear(x["Time Fis Year"]); const rt = clean(x["Item Hierarchy Level1"]);
    C.put(`${keyOf(rt)}__ucbs`, `Rating ${rt}, number of UCBs`, "count", march(ed), v, ed, { group: "UCBs by supervisory rating" }); }), MB({}),
    { unit: "count", coverage: "Urban co-operative banks by supervisory rating (A to E), number of banks, to March 2026", note: dbSrc(776) + " The Data Bank's copy carries the counts only." }));
  {
    const unplaced = new Set();
    out.push(writeBundle(root, "banks-ucb-states-dbie", typed("777", null, (x, C) => { const v = num(x["Item Value"]); if (v == null) return; const ed = editionYear(x["Time Fis Year"]); const u = place(x["State Name"]); if (!u) { unplaced.add(x["State Name"]); return; }
      const slug = u.slug === "jammu-kashmir" && ed <= 2019 ? "jammu-kashmir-state" : u.slug;
      C.put(`${keyOf(slug)}__ucbs`, `${slug === "jammu-kashmir-state" ? "Jammu and Kashmir (state)" : u.name}, number of UCBs`, "count", march(ed), v / 1e7, ed, { group: "States and union territories", state: slug }); }), MB({}),
      { unit: "count", coverage: "Number of urban co-operative banks in each state and union territory, to March 2026", note: dbSrc(777) + " Counts are stored multiplied by 10 million in the source (its unit field says crore); divided back, as the 2024 figures equal report 800's to the bank." }));
    if (unplaced.size) throw new Error(`banks-ucb 777: unplaced states ${[...unplaced].join(", ")}`);
  }
  out.push(writeBundle(root, "banks-ucb-priority-dbie", typed("810", null, (x, C) => { const v = num(x["Priority Sector Advances Value"]); if (v == null) return; const ed = editionYear(x["Time Fis Year"]);
    const L = itemLabel(x["Item Description"]).replace(/^Micro and Small and Medium/i, "Micro, Small and Medium");
    C.put(keyOf(L), `${L}, priority-sector advances of all UCBs`, "inr_crore", march(ed), Math.round((v / 1e7) * 100) / 100, ed, { group: "Priority-sector advances of UCBs" }); }), MB({}),
    { unit: "inr_crore", coverage: "Urban co-operative banks' priority-sector advances by sector, to March 2026", note: dbSrc(810) + " Provisional, as the source marks every row. ₹ crore. Micro and small enterprises became micro, small and medium enterprises in the table's own labels; kept as two series." }));
  out.push(writeBundle(root, "banks-ucb-size-dbie", typed("811", null, (x, C) => { const v = num(x["Item Value"]); if (v == null) return; const ed = editionYear(x["Time Fis Year"]);
    const band = clean(x["Depo Adv Description"]); const m = /^(?:([\d.]+)\s*<=\s*)?(D|Ad|Asset)\s*(<|≥|>=)\s*([\d.]+)$/i.exec(band); if (!m) return;
    const word = { D: "deposits", AD: "advances", ASSET: "assets" }[m[2].toUpperCase()];
    const bl = m[1] != null ? `₹${+m[1]} crore to ₹${+m[4]} crore` : `₹${+m[4]} crore and above`;
    const what = /no\.? of ucbs/i.test(x["Item Hierarchy Level2"]) || /no\.? of ucbs/i.test(x["Item Hierarchy Level3"]) ? ["number_share", "per cent of UCBs"] : ["amount_share", `per cent of all UCBs' ${word}`];
    C.put(`${word}__${keyOf(bl)}__${what[0]}`, `UCBs by size of ${word === "assets" ? "total assets" : word}, ${bl}, ${what[1]}`, "pct", march(ed), Math.round(v * 100) / 100, ed, { group: `UCBs by size of ${word}` }); }), MB({}),
    { unit: "pct", coverage: "Urban co-operative banks by size band of deposits, advances and assets: shares of banks and of amounts, to March 2026", note: dbSrc(811) + " The Data Bank's copy carries the shares only." }));
  out.push(writeBundle(root, "banks-ucb-structure", typed("812", "DP2", (x, C) => { const v = num(x["Item Value"]); if (v == null) return; const ed = editionYear(x["Time Fis Year"]);
    const o = x["Bank Group Ucb Display Order"]; const g = { 1: ["all", "All UCBs"], 2: ["scheduled", "Scheduled UCBs"], 3: ["non_scheduled", "Non-scheduled UCBs"] }[o]; if (!g) return;
    C.put(`${g[0]}__ucbs`, `${g[1]}, number of banks`, "count", march(ed), v, ed, { group: "Number of UCBs" }); }), MB({}),
    { unit: "count", coverage: "How many urban co-operative banks there are, scheduled and non-scheduled, every March to 2026", note: dbSrc(812) + " The source's date column is empty (1 January 1970); its financial year is used. Four sub-groups (display orders 4 to 7) carry no label in either copy of the table and are left out." }));

  for (const o of out) console.log(`banks-ucb: ${o.bundle}: ${o.series} series, ${o.from} to ${o.to}`);
  return out;
}
