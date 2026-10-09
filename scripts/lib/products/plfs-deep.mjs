// scripts/lib/products/plfs-deep.mjs: every PLFS cell the curated bundles (plfs.mjs) do not
// carry, cut from the archived cube (plfs-cube.mjs), one bundle per instrument and table.
//
// Two survey designs, never joined (AGENTS.md rule 1; MoSPI, "Changes in Periodic Labour
// Force Survey from 2025": the sample design and estimation procedure "used in PLFS upto
// December 2024" were replaced by a rotational panel in rural and urban areas from January
// 2025; MoSPI says the new results are not straightforwardly comparable with earlier ones):
//   original design  agriculture years 2017-18 to 2023-24 (plfs-ay-*), calendar years 2022
//                    to 2024 (plfs-cy-*), urban quarterly bulletin to Oct-Dec 2024
//                    (plfs-quarterly, -quarterly-*)
//   revamped design  monthly bulletin from Apr 2025 (plfs-monthly, -cuts, -monthly-age),
//                    quarterly bulletin from Apr-Jun 2025 with rural areas and states
//                    (plfs-q25*), calendar year 2025 on (plfs-cy25-*)
// The agriculture-year and calendar-year estimates of the original design are the same survey
// over different twelve months: separate bundles, never one line.
//
// Cells are kept as published, with three quarantines, each disclosed on the series it hits:
//  1. a value the API serves malformed ("l0.8", "IS.2", "20. I", "16?", "-", "**", "NaN":
//     OCR debris and suppression marks) is not published here; we never repair OCR by guessing.
//     (plfs.mjs once read these with parseFloat, which takes "20. I" as 20.)
//  2. an LFPR of 0 is a cell with no sampled person (a Chandigarh rural diploma holder): the
//     three ratios of that cell are not published here.
//  3. the identity UR = 100 x (1 - WPR / LFPR) must hold within rounding (1.5 points; values
//     are published to one decimal). A cell whose three ratios break it is withheld: the data
//     cannot say which of the three is wrong (Apr-Jun 2019: the UR column is a mislabelled copy;
//     Oct-Dec 2020: Assam and Madhya Pradesh rows; OCR debris such as a WPR of 415). Any value
//     outside 0 to 100 is withheld the same way.
//  4. shifted state labels in the quarterly bulletins (shiftedStateTables below): Jul-Sep 2025
//     LFPR (checked against the bulletin: Kerala 15+ person LFPR 51.1, the API's "Kerala" 59.4
//     is Madhya Pradesh's row) and Apr-Jun 2025 LFPR, WPR and UR, where all three moved
//     together so the identity in rule 3 still held and only the shift test finds it.
//
// Hand checks (2026-10-10), each against MoSPI's own publication:
//   plfs-q25: All India, CWS, 15+, Oct-Dec 2025 UR rural 4.0, urban 6.7, all 4.8 (Quarterly
//     Bulletin Oct-Dec 2025, para 2.6.2); Jul-Sep 2025 Kerala WPR 15+ person r+u 47.1 (QB
//     Jul-Sep 2025, Table 3).
//   plfs-cy-earnings: All India regular wage, person, rural + urban, 2024 = 21,454.87.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { cubeRows, AGRI_YEARS, CAL_YEARS } from "./plfs-cube.mjs";
import { writeSeries, quarterAxis, monthAxis, MONTHS } from "../util.mjs";

// strict: a cell is a number or it is not published (rule 1 above)
export const num = (v) => { const s = String(v ?? "").trim(); return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : null; };
const slug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const NEW_DESIGN_FROM = "2025-01";
export const BASE_OLD = "PLFS original design (2017-18 to 2024)";
export const BASE_NEW = "PLFS revamped design (from January 2025)";

const IND = { 1: "lfpr", 2: "wpr", 3: "ur" };
const IND_LABEL = { lfpr: "Labour force participation rate", wpr: "Worker population ratio", ur: "Unemployment rate" };
const G = { person: "person", male: "men", female: "women" };
const S = { "rural + urban": "all", rural: "rural", urban: "urban" };
const S_LABEL = { all: "rural and urban", rural: "rural", urban: "urban" };
const AGE = { "15 years and above": "a15plus", "15-29 years": "a15_29", "15-59 years": "a15_59", "All ages": "all_ages" };
const AGE_LABEL = { a15plus: "15 and above", a15_29: "15 to 29", a15_59: "15 to 59", all_ages: "all ages" };
const WS = (w) => (w === "PS+SS" ? "psss" : "cws");
const WS_LABEL = { psss: "usual status", cws: "weekly status" };
const QSTART = { "Jan-Mar": "01", "Apr-Jun": "04", "Jul-Sep": "07", "Oct-Dec": "10" };
const AGRI_Q = { "Jul-Sep": [0, "07"], "Oct-Dec": [0, "10"], "Jan-Mar": [1, "01"], "Apr-Jun": [1, "04"] };
const EDU = (e) => e.replace(/^\d+\./, "").replace(/\s*\/\s*/g, " or ").trim();
const cutOf = (r) => {
  if ((r.religion ?? "all") !== "all") return ["rel_" + slug(r.religion), "religion: " + r.religion, "Religion"];
  if ((r.socialGroup ?? "all") !== "all") return ["soc_" + slug(r.socialGroup), "social group: " + r.socialGroup, "Social group"];
  if ((r.General_Education ?? "all") !== "all") return ["edu_" + slug(EDU(r.General_Education)), "education: " + EDU(r.General_Education), "Education"];
  return null;
};

/* ---------------- the three ratios (indicators 1-3) ---------------- */

// cells: Map(cellKey -> { meta, values: Map(date -> v) }) for one design and frequency
function rateCells(rows, dateOf) {
  const cells = new Map();
  const malformed = new Map();
  for (const r of rows) {
    const ind = IND[r.__ic]; const date = dateOf(r); if (!date) continue;
    const cut = cutOf(r);
    const meta = { state: r.state, g: r.gender, s: S[r.sector], age: AGE[r.AgeGroup], ws: WS(r.weekly_status), cut };
    if (!meta.s || !meta.age || !G[meta.g]) { process.stdout.write(`plfs-deep WARN unmapped row ${JSON.stringify(r).slice(0, 160)}\n`); continue; }
    const base = [meta.state, meta.g, meta.s, meta.age, meta.ws, cut?.[0] ?? ""].join("|");
    const v = num(r.value);
    if (v == null && r.value != null && r.value !== "") malformed.set(`${ind}|${base}|${date}`, r.value);
    const c = cells.get(`${ind}|${base}`) ?? { ind, base, meta, values: new Map() };
    c.values.set(date, v);
    cells.set(`${ind}|${base}`, c);
  }
  return { cells, malformed };
}

// rules 2 to 4: returns Map("ind|base|date" -> reason) of withheld cells
function quarantineRates(cells, { stateTables = false } = {}) {
  const out = new Map();
  const get = (ind, base, d) => (out.has(`${ind}|${base}|${d}`) ? null : cells.get(`${ind}|${base}`)?.values.get(d));
  const bases = new Set([...cells.values()].map((c) => c.base));
  const dates = [...new Set([...cells.values()].flatMap((c) => [...c.values.keys()]))].sort();
  if (stateTables) for (const [k, why] of shiftedStateTables(cells, dates)) out.set(k, why);
  for (const base of bases) for (const d of dates) {
    const lf = get("lfpr", base, d), wp = get("wpr", base, d), ur = get("ur", base, d);
    let why = null;
    if ([lf, wp, ur].some((v) => v != null && (v < 0 || v > 100))) why = "a value outside 0 to 100 per cent";
    else if (lf === 0) why = "no sampled person (LFPR served as 0)";
    else if (lf != null && wp != null && ur != null && Math.abs(100 * (1 - wp / lf) - ur) > 1.5) why = `its three ratios break UR = 1 - WPR/LFPR (served ${lf}, ${wp}, ${ur})`;
    if (why) for (const ind of ["lfpr", "wpr", "ur"]) if (get(ind, base, d) != null || ind === "lfpr") out.set(`${ind}|${base}|${d}`, why);
  }
  return out;
}

// rule 4, the shifted state labels. The quarterly bulletin prints its state tables with Jammu
// & Kashmir last; in some quarters the API maps those rows onto an alphabetical list, so from
// Jammu & Kashmir on every label carries the next state's row and "West Bengal" carries Jammu
// & Kashmir's. Test of that mechanism, per indicator and quarter: compare each of those
// labels' cells (gender x sector x age) with the per-cell median of its four nearest other
// quarters, for its own state and for the state the shift would put there. When two thirds or
// more fit the shift better, that indicator's table from Jammu & Kashmir on is withheld; the
// states before it are unaffected. Run on 2018-2026 (2026-10-10): exactly four tables score
// 12 of 14 (Apr-Jun 2025 LFPR, WPR and UR; Jul-Sep 2025 LFPR, confirmed against the bulletin);
// every other table scores 7 or below (the COVID quarters' real swings included).
function shiftedStateTables(cells, dates) {
  const out = new Map();
  const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2; };
  for (const ind of ["lfpr", "wpr", "ur"]) {
    const prof = {}; // state -> date -> rest-of-base -> v
    for (const c of cells.values()) {
      if (c.ind !== ind || c.meta.state === "All India") continue;
      const rest = c.base.slice(c.meta.state.length + 1);
      for (const [d, v] of c.values) if (v != null && v <= 100) ((prof[c.meta.state] ??= {})[d] ??= {})[rest] = v;
    }
    const states = Object.keys(prof).sort();
    const jk = states.indexOf("Jammu & Kashmir");
    if (jk < 0) continue;
    const tail = states.slice(jk);
    const shifted = Object.fromEntries(tail.map((st, i) => [st, tail[(i + 1) % tail.length]]));
    for (const d of dates) {
      const near = dates.filter((x) => x !== d).sort((a, b) => Math.abs(dates.indexOf(a) - dates.indexOf(d)) - Math.abs(dates.indexOf(b) - dates.indexOf(d))).slice(0, 4);
      let fit = 0, n = 0;
      for (const st of tail) {
        const t = prof[st]?.[d]; if (!t) continue;
        const dist = (o) => { let e = 0, m = 0; for (const k in t) { const vs = near.map((x) => prof[o]?.[x]?.[k]).filter((v) => v != null); if (vs.length) { e += (t[k] - med(vs)) ** 2; m++; } } return m ? Math.sqrt(e / m) : Infinity; };
        n++; if (dist(shifted[st]) < dist(st)) fit++;
      }
      if (n < 6 || fit / n < 2 / 3) continue;
      process.stdout.write(`plfs-deep: ${ind} state table ${d}: ${fit}/${n} labels from Jammu & Kashmir on fit the one-row shift; withheld\n`);
      for (const c of cells.values()) if (c.ind === ind && tail.includes(c.meta.state) && c.values.get(d) != null)
        out.set(`${ind}|${c.base}|${d}`, `the API's state labels for this quarter are shifted one row from Jammu & Kashmir on (${fit} of ${n} states fit the next state's row better than their own); the cells from Jammu & Kashmir to West Bengal are withheld`);
    }
  }
  return out;
}

function rateLabel(m, ind) {
  const parts = [IND_LABEL[ind], m.state === "All India" ? "All India" : m.state, G[m.g], S_LABEL[m.s], "age " + AGE_LABEL[m.age], WS_LABEL[m.ws]];
  if (m.cut) parts.push(m.cut[1]);
  return parts.join(" · ");
}
const rateKey = (m, ind, withState) => [withState ? slug(m.state) : null, `${ind}_${m.ws}`, `${m.g}_${m.s}`, m.age, m.cut?.[0]].filter(Boolean).join("__");

/* ---------------- bundle assembly ---------------- */

function assemble({ slug: bslug, axis, series, meta }) {
  // drop series with nothing published; trim trailing all-null dates (CONTRACT-series rule 2)
  const keep = Object.entries(series).filter(([, s]) => s.data.some((v) => v != null));
  let end = axis.length;
  while (end > 0 && keep.every(([, s]) => s.data[end - 1] == null)) end--;
  let start = 0;
  while (start < end && keep.every(([, s]) => s.data[start] == null)) start++;
  const dates = axis.slice(start, end);
  const out = {};
  for (const [k, s] of keep) {
    const data = s.data.slice(start, end);
    const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
    out[k] = { ...s, data };
    delete out[k].why;
    if (gaps.length) {
      out[k].gaps = gaps;
      const reasons = [...new Set(gaps.map((d) => s.why?.get(d) ?? "not published by MoSPI for this period"))];
      out[k].gapsNote = reasons.join("; ");
    }
    if (s.why?.size) {
      // a withheld cell at either end of the series is not a gap but is still disclosed
      const ends = [...s.why.keys()].filter((d) => dates.includes(d) && !gaps.includes(d));
      if (ends.length) out[k].withheld = ends.map((d) => `${d}: ${s.why.get(d)}`);
    }
  }
  if (!Object.keys(out).length) throw new Error(`plfs-deep: ${bslug} has no published series`);
  return { meta: { ...meta, latestPeriod: dates.at(-1).slice(0, 7) }, dates, series: out };
}

function rateBundles(cells, quarantined, axis, { india, states, own = () => false, groupIndia }) {
  const bundles = { india: {}, states: { lfpr: {}, wpr: {}, ur: {} } };
  for (const c of cells.values()) {
    const m = c.meta;
    if (own(m, c.ind)) continue;
    const isState = m.state !== "All India";
    const why = new Map();
    const data = axis.map((d) => {
      const q = quarantined.get(`${c.ind}|${c.base}|${d}`);
      if (q) { why.set(d, q); return null; }
      const v = c.values.get(d);
      return v == null ? null : v;
    });
    const s = { name: `plfs_${rateKey(m, c.ind, isState)}_pct`, label: rateLabel(m, c.ind), color: c.ind === "ur" ? "#2E4BD8" : "#5F6675", unit: "pct",
      group: isState ? m.state : groupIndia(m), data, why };
    if (isState) bundles.states[c.ind][rateKey(m, c.ind, true)] = s;
    else bundles.india[rateKey(m, c.ind, false)] = s;
  }
  const out = [];
  if (india) out.push([india.slug, assemble({ slug: india.slug, axis, series: bundles.india, meta: india.meta })]);
  if (states) for (const ind of ["lfpr", "wpr", "ur"]) {
    if (!Object.keys(bundles.states[ind]).length) continue;
    out.push([`${states.slug}-${ind}`, assemble({ slug: `${states.slug}-${ind}`, axis, series: bundles.states[ind], meta: { ...states.meta, coverage: states.meta.coverage.replace("{IND}", IND_LABEL[ind].toLowerCase()) } })]);
  }
  return out;
}

const groupIndia = (m) => m.cut ? m.cut[2] : m.age !== "a15plus" ? "Age" : "Gender and sector";

/* ---------------- the deep-archive tier (docs/PLAN-launch.md §2b) ----------------
 * Long-format gzipped CSV in data/archive/staging/plfs/ (git-ignored), for the archive builder
 * to upload: one row per cell, the cut's dimensions, period, value, unit, base, vintage. */
function stageCsv(root, file, header, rows, vintage) {
  const q = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const body = [[...header, "source", "vintage"], ...rows.map((r) => [...r, "MoSPI, NSO: PLFS (eSankhyiki API)", vintage])].map((r) => r.map(q).join(",")).join("\n") + "\n";
  const p = path.join(root, "data/archive/staging/plfs", file);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, zlib.gzipSync(body, { level: 9 }));
  process.stdout.write(`plfs-deep: staged ${rows.length} rows -> data/archive/staging/plfs/${file}\n`);
}

/* ---------------- composition tables (indicator 4) ----------------
 * A share table's members must add to 100 (published to one decimal: tolerance 0.05 per member
 * plus 0.15) and, on the usual status, the self-employed must equal own-account workers plus
 * helpers. A table whose
 * members are all 0 is a cell with no sampled worker. A table that fails either test is withheld
 * whole for that context and date: the source's own arithmetic says one of its cells is wrong
 * (OCR debris such as 6126 for 61.26 in the old quarterly industry table) and the data cannot
 * say which. Keys are <context>__<member>__<rest>; `memberOf` maps a key to [table, member]. */
function quarantineShares(series, axis, memberOf) {
  const tables = new Map(); // "table|context" -> [{ key, member }]
  for (const key of Object.keys(series)) {
    const m = memberOf(key); if (!m) continue;
    const id = `${m.table}|${m.context}`;
    (tables.get(id) ?? tables.set(id, []).get(id)).push({ key, member: m.member });
  }
  let n = 0;
  for (const [id, mem] of tables) {
    const table = id.split("|")[0];
    axis.forEach((d, i) => {
      const val = (k) => series[k].data[i];
      // status: self-employed + regular + casual = 100 (own-account and helpers split the
      // self-employed, and on the usual status only: the weekly status's self-employed also
      // hold those who had work but did not work that week)
      const parts = table === "status" ? mem.filter((x) => ["self_employed", "regular", "casual"].includes(x.member)) : mem;
      const vs = parts.map((x) => val(x.key));
      if (vs.every((v) => v == null)) return;
      let why = null;
      if (vs.some((v) => v != null && (v < 0 || v > 100))) why = "a share outside 0 to 100 (OCR debris in the source)";
      else if (vs.every((v) => v == null || v === 0)) why = "no sampled worker (every share served as 0)";
      else if (vs.every((v) => v != null)) {
        const sum = vs.reduce((a, v) => a + v, 0);
        if (Math.abs(sum - 100) > 0.05 * vs.length + 0.15) why = `the table's shares add to ${sum.toFixed(1)}, not 100`;
        if (!why && table === "status" && id.endsWith("|psss")) {
          const se = mem.find((x) => x.member === "self_employed"), oa = mem.find((x) => x.member === "own_account"), hp = mem.find((x) => x.member === "helper");
          if (se && oa && hp && val(se.key) != null && Math.abs(val(oa.key) + val(hp.key) - val(se.key)) > 0.25) why = `own-account workers and helpers (${val(oa.key)} + ${val(hp.key)}) do not add to the self-employed (${val(se.key)})`;
        }
      }
      if (!why) return;
      n++;
      for (const x of mem) if (series[x.key].data[i] != null) { series[x.key].why.set(d, why); series[x.key].data[i] = null; }
    });
  }
  return n;
}
const STATUS_M = new Set(["own_account", "helper", "self_employed", "regular", "casual"]);
const BROAD_M = new Set(["agriculture", "industry", "services"]);
// workers-states and quarterly-industry keys: <state>__<member>__<g>_<s>[__<ws>]
const shareMember = (key) => {
  const p = key.split("__");
  const [st, member, gs, ws] = p.length >= 3 && !BROAD_M.has(p[0]) && !STATUS_M.has(p[0]) ? p : ["all_india", ...p];
  const table = STATUS_M.has(member) ? "status" : BROAD_M.has(member) ? "broad" : member.startsWith("sec_") ? "section" : member.startsWith("nco_") ? "nco" : member.startsWith("ent_") ? "enterprise" : null;
  return table ? { table, member, context: [st, gs, ws ?? ""].join("|") } : null;
};

/* ---------------- the build ---------------- */

export function buildPlfsDeep(root, dcfg, vintage) {
  const meta0 = (frequency, base, coverage, extra = {}) => ({
    dossier: "plfs", frequency, base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
    releaseDate: null, coverage, revisionPolicy: dcfg.revision_policy, ...extra,
  });
  const write = ([s, b]) => writeSeries(root, `data/series/${s}.json`, b);
  const tagged = (freq, ic, yt) => cubeRows(root, { freq, ic, yt }).map((r) => ({ ...r, __ic: ic }));
  const ratesRows = (freq, yt) => [1, 2, 3].flatMap((ic) => tagged(freq, ic, yt));
  const counts = {};

  /* ---- annual, agriculture years (original design) ---- */
  {
    const axis = AGRI_YEARS.map((y) => `${y.slice(0, 4)}-07-01`);
    const { cells, malformed } = rateCells(ratesRows("annual", "agri"), (r) => `${String(r.year).slice(0, 4)}-07-01`);
    const q = quarantineRates(cells, { stateTables: true });
    for (const [k, v] of malformed) q.set(k, `the API serves a malformed value ("${v}")`);
    // cells the curated bundles carry: plfs-annual (All India headline), plfs-states (UR by
    // state, person, all areas, 15+), plfs-education (UR by education and the 15-29 cut)
    const own = (m, ind) => {
      const head = m.g === "person" && m.s === "all";
      if (m.state === "All India" && head && m.age === "a15plus" && !m.cut) return true;
      if (m.state !== "All India" && ind === "ur" && head && m.age === "a15plus" && !m.cut) return true;
      if (m.state === "All India" && ind === "ur" && head && m.ws === "psss" && ((m.age === "a15plus" && m.cut?.[2] === "Education") || (m.age === "a15_29" && !m.cut))) return true;
      return false;
    };
    for (const b of rateBundles(cells, q, axis, {
      own, groupIndia,
      india: { slug: "plfs-ay-india", meta: meta0("annual", BASE_OLD, "All India, agriculture years (July to June) plotted at July: LFPR, WPR and UR by gender x sector x age band, by education level, religion and social group, usual status (PS+SS) and weekly status (CWS). The headline cells live in plfs-annual and plfs-education.") },
      states: { slug: "plfs-ay-states", meta: meta0("annual", BASE_OLD, "States and UTs, agriculture years plotted at July: {IND} by gender x sector x age band and by education level, usual status (PS+SS) and weekly status (CWS). UR for all persons, all areas, 15+ is in plfs-states.") },
    })) { write(b); counts[b[0]] = Object.keys(b[1].series).length; }
  }

  /* ---- annual, calendar years: original design (2022-2024) and revamped (2025 on) ---- */
  for (const [tag, base, years, label] of [["cy", BASE_OLD, CAL_YEARS.filter((y) => `${y}-01` < NEW_DESIGN_FROM), "original design, calendar years (January to December)"],
    ["cy25", BASE_NEW, CAL_YEARS.filter((y) => `${y}-01` >= NEW_DESIGN_FROM), "revamped design, calendar years (January to December)"]]) {
    const axis = years.map((y) => `${y}-01-01`);
    const rows = ratesRows("annual", "cal").filter((r) => years.includes(String(r.year)));
    if (!rows.length) continue;
    const { cells, malformed } = rateCells(rows, (r) => `${r.year}-01-01`);
    const q = quarantineRates(cells, { stateTables: true });
    for (const [k, v] of malformed) q.set(k, `the API serves a malformed value ("${v}")`);
    for (const b of rateBundles(cells, q, axis, {
      groupIndia,
      india: { slug: `plfs-${tag}-india`, meta: meta0("annual", base, `All India, ${label}, plotted at January: LFPR, WPR and UR for every gender, sector, age band, education level, religion and social group, usual status (PS+SS) and weekly status (CWS).`) },
      states: { slug: `plfs-${tag}-states`, meta: meta0("annual", base, `States and UTs, ${label}: {IND} by gender x sector x age band and by education level, PS+SS and CWS.`) },
    })) { write(b); counts[b[0]] = Object.keys(b[1].series).length; }
  }

  /* ---- quarterly bulletin, original design (urban, to Oct-Dec 2024) and revamped (from Apr-Jun 2025) ---- */
  {
    const qDate = (r) => QSTART[r.quarter] ? `${r.year}-${QSTART[r.quarter]}-01` : null;
    const rows = ratesRows("quarterly");
    const old = rows.filter((r) => qDate(r) && qDate(r) < `${NEW_DESIGN_FROM}-01`);
    const neu = rows.filter((r) => qDate(r) && qDate(r) >= `${NEW_DESIGN_FROM}-01`);
    for (const [tag, base, rs, label] of [["quarterly", BASE_OLD, old, "urban areas, original design, Apr-Jun 2018 to Oct-Dec 2024"], ["q25", BASE_NEW, neu, "rural and urban areas, revamped design, from Apr-Jun 2025"]]) {
      if (!rs.length) continue;
      const ds = [...new Set(rs.map(qDate))].sort();
      const axis = quarterAxis(ds[0].slice(0, 7), ds.at(-1).slice(0, 7)).map((ym) => `${ym}-01`);
      const { cells, malformed } = rateCells(rs, qDate);
      const q = quarantineRates(cells, { stateTables: true });
      for (const [k, v] of malformed) q.set(k, `the API serves a malformed value ("${v}")`);
      // never-published quarters inside the axis (Jan-Mar 2025 was never published: the design change)
      const own = tag === "quarterly" ? (m) => m.state === "All India" && m.g === "person" && m.s === "urban" && m.age === "a15plus" : () => false;
      for (const b of rateBundles(cells, q, axis, {
        own, groupIndia: (m) => (m.age !== "a15plus" ? "Age" : "Gender and sector"),
        india: { slug: tag === "quarterly" ? "plfs-quarterly-cuts" : "plfs-q25", meta: meta0("quarterly", base, `All India, current weekly status (CWS), ${label}: LFPR, WPR and UR by gender, sector and age band (15 and above, 15 to 29, all ages).${tag === "quarterly" ? " All persons 15+ is plfs-quarterly." : ""}`) },
        states: { slug: tag === "quarterly" ? "plfs-quarterly-states" : "plfs-q25-states", meta: meta0("quarterly", base, `The 22 states the bulletin publishes, CWS, ${label}: {IND} by gender, sector and age band.`) },
      })) { write(b); counts[b[0]] = Object.keys(b[1].series).length; }
    }
  }

  /* ---- monthly bulletin: the age bands (15+ lives in plfs-monthly and plfs-cuts) ---- */
  {
    const mDate = (r) => { const m = MONTHS.indexOf(r.month) + 1; return m ? `${r.year}-${String(m).padStart(2, "0")}-01` : null; };
    const rows = ratesRows("monthly").filter((r) => r.AgeGroup !== "15 years and above");
    const ds = [...new Set(rows.map(mDate).filter(Boolean))].sort();
    const axis = monthAxis(ds[0].slice(0, 7), ds.at(-1).slice(0, 7)).map((ym) => `${ym}-01`);
    const { cells, malformed } = rateCells(rows, mDate);
    const q = quarantineRates(cells, { stateTables: true });
    for (const [k, v] of malformed) q.set(k, `the API serves a malformed value ("${v}")`);
    for (const b of rateBundles(cells, q, axis, {
      groupIndia: (m) => "Age " + AGE_LABEL[m.age],
      india: { slug: "plfs-monthly-age", meta: meta0("monthly", BASE_NEW, "All India, monthly bulletin, current weekly status: LFPR, WPR and UR for ages 15 to 29 and all ages, by gender and sector. Ages 15 and above are plfs-monthly and plfs-cuts.") },
    })) { write(b); counts[b[0]] = Object.keys(b[1].series).length; }
  }

  /* ---- indicator 4, quarterly: share of workers by broad industry (CWS) ---- */
  {
    const IND3 = { "01-03 (agriculture)": "agriculture", "05-43 (secondary)": "industry", "45-99 (tertiary)": "services",
      "primary sector (Div. 01-03 of NIC 2008)": "agriculture", "secondary sector (Div. 05-43 of NIC 2008)": "industry", "tertiary sector (Div. 45-99 of NIC 2008)": "services" };
    const L3 = { agriculture: "Agriculture and allied (NIC 01-03)", industry: "Industry and construction (NIC 05-43)", services: "Services (NIC 45-99)" };
    const qDate = (r) => QSTART[r.quarter] ? `${r.year}-${QSTART[r.quarter]}-01` : null;
    const rows = tagged("quarterly", 4);
    for (const [bslug, base, keepRow, label] of [
      ["plfs-quarterly-industry", BASE_OLD, (d) => d < `${NEW_DESIGN_FROM}-01`, "urban areas, original design, to Oct-Dec 2024"],
      ["plfs-q25-industry", BASE_NEW, (d) => d >= `${NEW_DESIGN_FROM}-01`, "rural and urban areas, revamped design, from Apr-Jun 2025"]]) {
      const series = {}; const seen = new Map();
      const rs = rows.filter((r) => qDate(r) && keepRow(qDate(r)));
      if (!rs.length) continue;
      const ds = [...new Set(rs.map(qDate))].sort();
      const axis = quarterAxis(ds[0].slice(0, 7), ds.at(-1).slice(0, 7)).map((ym) => `${ym}-01`);
      for (const r of rs) {
        // the same table is labelled nic_group in some quarters, broad_industry_work in others
        const k3 = IND3[r.broad_industry_work] ?? IND3[r.nic_group];
        if (!k3) continue;   // "all" (the 100 per cent total)
        const st = r.state, key = [st === "All India" ? null : slug(st), k3, `${r.gender}_${S[r.sector]}`].filter(Boolean).join("__");
        const d = qDate(r), v = num(r.value);
        const prev = seen.get(`${key}|${d}`);
        if (prev != null && v != null && prev !== v) process.stdout.write(`plfs-deep WARN ${bslug} ${key} ${d}: ${prev} vs ${v}, kept first\n`);
        if (prev != null) continue;
        seen.set(`${key}|${d}`, v);
        series[key] ??= { name: `plfs_workers_${key}_pct`, label: `Share of workers in ${L3[k3]} · ${st} · ${G[r.gender]} · ${S_LABEL[S[r.sector]]} · weekly status`, color: k3 === "services" ? "#2E4BD8" : "#5F6675", unit: "pct_of_workers", group: st, data: axis.map(() => null), why: new Map() };
        if (v == null && r.value != null && r.value !== "") series[key].why.set(d, `the API serves a malformed value ("${r.value}")`);
        series[key].data[axis.indexOf(d)] = v;
      }
      const nq = quarantineShares(series, axis, shareMember);
      if (nq) process.stdout.write(`plfs-deep: ${bslug}: ${nq} industry tables withheld (shares outside 0-100 or not adding to 100)\n`);
      const b = assemble({ slug: bslug, axis, series, meta: meta0("quarterly", base, `All India and the 22 states the bulletin publishes, ${label}: share of workers (CWS, 15+) in agriculture, industry and services, by gender and sector. The three add to 100.`) });
      write([bslug, b]); counts[bslug] = Object.keys(b.series).length;
    }
  }

  /* ---- indicator 5: regular employees' job conditions (agriculture years) ---- */
  {
    const C5 = { "1.with no written job contract": ["no_contract", "no written job contract"], "2.not eligible for paid leave": ["no_paid_leave", "not eligible for paid leave"],
      "3.without any social security benefit": ["no_social_security", "no social security benefit"], "4.not eligible for paid leave, w.o. written job contract and w.o. any SSB": ["none_of_three", "none of the three: no contract, no paid leave, no social security"] };
    const axis = AGRI_YEARS.map((y) => `${y.slice(0, 4)}-07-01`);
    const series = {};
    for (const r of tagged("annual", 5, "agri")) {
      const c = C5[r.employee_contract]; if (!c) continue;
      const st = r.state, key = [st === "All India" ? null : slug(st), c[0], `${r.gender}_${S[r.sector]}`].filter(Boolean).join("__");
      const v = num(r.value);
      series[key] ??= { name: `plfs_regular_employees_${key}_pct`, label: `Regular wage/salaried employees with ${c[1]} · ${st} · ${G[r.gender]} · ${S_LABEL[S[r.sector]]}`, color: c[0] === "none_of_three" ? "#2E4BD8" : "#5F6675", unit: "pct_of_employees", group: st, data: axis.map(() => null), why: new Map() };
      if (v == null && r.value != null && r.value !== "") series[key].why.set(`${String(r.year).slice(0, 4)}-07-01`, `the API serves a malformed value ("${r.value}")`);
      series[key].data[axis.indexOf(`${String(r.year).slice(0, 4)}-07-01`)] = v;
    }
    // "none of the three" is a subset of each single condition: where it exceeds one, the four
    // cells of that context contradict each other and are withheld together
    let nc = 0;
    for (const k of Object.keys(series).filter((k) => /(^|__)none_of_three__/.test(k))) {
      const fam = ["none_of_three", "no_contract", "no_paid_leave", "no_social_security"].map((c) => series[k.replace(/(^|__)none_of_three__/, `$1${c}__`)]).filter(Boolean);
      axis.forEach((d, i) => {
        const v = series[k].data[i];
        if (v == null || !fam.slice(1).some((s2) => s2.data[i] != null && v > s2.data[i] + 0.15)) return;
        nc++;
        for (const s2 of fam) { s2.why.set(d, `"none of the three" (${v}) exceeds a single condition in this cell: the four values contradict each other`); s2.data[i] = null; }
      });
    }
    if (nc) process.stdout.write(`plfs-deep: plfs-conditions: ${nc} contexts withheld (none of the three above a single condition)\n`);
    const b = assemble({ slug: "plfs-conditions", axis, series, meta: meta0("annual", BASE_OLD, "All India and states/UTs, agriculture years plotted at July: per cent of regular wage/salaried employees (usual status) with no written job contract, not eligible for paid leave, without any social security benefit, and with none of the three; by gender and sector. Indicator 5, which the API refused (HTTP 500) until 2026-10; retested 2026-10-09 and served.") });
    write(["plfs-conditions", b]); counts["plfs-conditions"] = Object.keys(b.series).length;
  }

  /* ---- indicators 6-8: earnings, every state and sector (agriculture years: quarterly grain; calendar years: annual) ---- */
  {
    const E = { 6: ["regular", "Regular wage/salary earnings, per month", "inr_per_month"], 7: ["casual", "Casual labour wage, per day (other than public works)", "inr_per_day"], 8: ["self_employed", "Self-employment gross earnings, per 30 days", "inr_per_30_days"] };
    const earnSeries = (rows, dateOf, own) => {
      const cells = new Map(); // "ic|state|gender|sector" -> Map(date -> v)
      const why = new Map();
      for (const r of rows) {
        const d = dateOf(r); if (!d) continue;
        const k = `${r.__ic}|${r.state}|${r.gender}|${S[r.sector]}`;
        let v = num(r.value);
        if (v == null && r.value != null && r.value !== "") why.set(`${k}|${d}`, `the API serves a malformed value ("${r.value}")`);
        // an earning of 0 is a cell with no sampled worker, not a wage of nothing
        if (v === 0) { why.set(`${k}|${d}`, "no sampled worker (served as 0)"); v = null; }
        (cells.get(k) ?? cells.set(k, new Map()).get(k)).set(d, v);
      }
      // identity: the rural + urban cell lies between its rural and urban cells (a weighted
      // mean), and the person cell between men and women; a cell that breaks it is withheld
      // (the 2017-18 All India rule of plfs-earnings, generalised: 1 per cent tolerance)
      for (const [k, m] of cells) {
        const [ic, st, g, s] = k.split("|");
        for (const [d, v] of m) {
          if (v == null) continue;
          const chk = (a, b, what) => { if (a == null || b == null) return; const lo = Math.min(a, b) * 0.99, hi = Math.max(a, b) * 1.01; if (v < lo || v > hi) why.set(`${k}|${d}`, `the ${what} cell (${v}) lies outside its parts (${a}, ${b})`); };
          if (s === "all") chk(cells.get(`${ic}|${st}|${g}|rural`)?.get(d), cells.get(`${ic}|${st}|${g}|urban`)?.get(d), "rural + urban");
          if (g === "person") chk(cells.get(`${ic}|${st}|male|${s}`)?.get(d), cells.get(`${ic}|${st}|female|${s}`)?.get(d), "person");
        }
      }
      return { cells, why, own };
    };
    const toBundle = ({ cells, why, own }, axis, bslug, meta) => {
      const series = {};
      for (const [k, m] of cells) {
        const [ic, st, g, s] = k.split("|");
        if (own && own(st, g, s)) continue;
        const [ek, el, unit] = E[ic];
        const key = [st === "All India" ? null : slug(st), ek, `${g}_${s}`].filter(Boolean).join("__");
        const w = new Map();
        const data = axis.map((d) => { const q = why.get(`${k}|${d}`); if (q) { w.set(d, q); return null; } return m.get(d) ?? null; });
        series[key] = { name: `plfs_earnings_${key}_inr`, label: `${el} · ${st} · ${G[g]} · ${S_LABEL[s]}`, color: ek === "regular" ? "#2E4BD8" : "#5F6675", unit, group: st, data, why: w };
      }
      return assemble({ slug: bslug, axis, series, meta });
    };
    // agriculture years: the quarterly grain the reports publish
    const agriDate = (r) => { const q = AGRI_Q[r.quarter]; return q ? `${Number(String(r.year).slice(0, 4)) + q[0]}-${q[1]}-01` : null; };
    const agri = [6, 7, 8].flatMap((ic) => tagged("annual", ic, "agri"));
    const ds = [...new Set(agri.map(agriDate).filter(Boolean))].sort();
    const axisA = quarterAxis(ds[0].slice(0, 7), ds.at(-1).slice(0, 7)).map((ym) => `${ym}-01`);
    // All India, rural + urban, by gender is plfs-earnings (with its own 2017-18 quarantine)
    const bA = toBundle(earnSeries(agri, agriDate, (st, g, s) => st === "All India" && s === "all"), axisA, "plfs-earnings-cuts",
      meta0("quarterly", BASE_OLD, "All India by sector and every state/UT by gender and sector: regular wage/salary earnings (₹ a month), casual wages (₹ a day, other than public works) and self-employment gross earnings (₹ per 30 days), quarterly grain inside each agriculture year. Three denominators: never add or compare them as one. All India rural + urban by gender is plfs-earnings."));
    write(["plfs-earnings-cuts", bA]); counts["plfs-earnings-cuts"] = Object.keys(bA.series).length;
    for (const [tag, base, keepY] of [["cy", BASE_OLD, (y) => `${y}-01` < NEW_DESIGN_FROM], ["cy25", BASE_NEW, (y) => `${y}-01` >= NEW_DESIGN_FROM]]) {
      const years = CAL_YEARS.filter(keepY);
      const rows = [6, 7, 8].flatMap((ic) => tagged("annual", ic, "cal")).filter((r) => years.includes(String(r.year)));
      if (!rows.length) continue;
      const axis = years.map((y) => `${y}-01-01`);
      const b = toBundle(earnSeries(rows, (r) => `${r.year}-01-01`), axis, `plfs-${tag}-earnings`,
        meta0("annual", base, `All India and every state/UT, ${tag === "cy" ? "original design" : "revamped design"}, calendar years plotted at January: regular wage/salary earnings (₹ a month), casual wages (₹ a day), self-employment gross earnings (₹ per 30 days), by gender and sector.`));
      write([`plfs-${tag}-earnings`, b]); counts[`plfs-${tag}-earnings`] = Object.keys(b.series).length;
    }
  }

  /* ---- indicator 4, annual: the share-of-workers tables for every state ----
   * All India is the services guide's (services-jobs-ay, services-jobs-cy: every cell, read
   * not rebuilt; plfs-status carries the headline split). Here: each state's cells, one
   * bundle per design and year type. A key names its cut the way services-jobs does. */
  {
    const DIMS = ["broad_industry_work", "broad_status_employment", "enterprise_size", "enterprise_type", "industry_section", "nco_division", "nic_group", "employee_contract"];
    const isAll = (v) => v == null || v === "" || v === "all" || v === "All";
    const STATUS = { "1.self-employed: own account worker, employer": ["own_account", "own-account workers and employers"], "2.self-employed: helper in household enterprise": ["helper", "unpaid helpers in household enterprises"], "3.all self employed": ["self_employed", "all self-employed"], "4.regular wage/salary": ["regular", "regular wage or salary"], "5.casual labour": ["casual", "casual labour"] };
    const BROAD = { "primary sector (Div. 01-03 of NIC 2008)": ["agriculture", "agriculture and allied (NIC 01-03)"], "secondary sector (Div. 05-43 of NIC 2008)": ["industry", "industry and construction (NIC 05-43)"], "tertiary sector (Div. 45-99 of NIC 2008)": ["services", "services (NIC 45-99)"] };
    const part = (dim, v) => {
      if (dim === "broad_status_employment") return STATUS[v] ?? ["st_" + slug(v), v];
      if (dim === "broad_industry_work") return BROAD[v] ?? ["bi_" + slug(v), v];
      if (dim === "industry_section") { const [code, ...rest] = v.split("_"); return ["sec_" + code.toLowerCase(), `NIC section ${code}: ${rest.join(" ")}`]; }
      if (dim === "nco_division") return ["nco_" + slug(v.split(":")[0]), "occupation " + v];
      if (dim === "nic_group") { const m = /^([\d, -]+)/.exec(v.replace("industry:", "").replace(/[()]/g, "")); return ["nic_" + slug(m ? m[1] : v), "NIC " + v.replace(/\s+/g, " ")]; }
      if (dim === "enterprise_type") return ["ent_" + slug(v.replace(/^\d+\./, "")), "enterprise: " + v.replace(/^\d+\./, "")];
      if (dim === "enterprise_size") return ["size_" + slug(v.replace(">=", "20plus")), `enterprise of ${v} workers`];
      return ["con_" + slug(v.replace(/^\d+\./, "")), "employees " + v.replace(/^\d+\./, "")];
    };
    const what = (dims, parts) => {
      const g = dims.indexOf("nic_group");
      if (g >= 0 && dims.length > 1) return `Workers in ${parts[g][1]}: share ${dims.includes("broad_status_employment") ? "who are" : "in"} ${parts.filter((_, i) => i !== g).map((p) => p[1]).join(", ")}`;
      return `Share of workers: ${parts.map((p) => p[1]).join(", ")}`;
    };
    const build = (rows, dateOf, axis, bslug, base, label) => {
      const series = {};
      const cross = [];   // multi-way tables by state: the deep-archive tier
      for (const r of rows) {
        if (r.state === "All India") continue;
        const dims = DIMS.filter((d) => !isAll(r[d]));
        if (!dims.length) continue;   // the 100 per cent total of all workers (or, in calendar years, the contract table served without its label)
        // a lone "industry: (05-99)" row carries a value the source does not explain (0.0 to 0.5;
        // the services guide excludes the same row at All India)
        if (dims.length === 1 && dims[0] === "nic_group") continue;
        if (dims.length > 1) { cross.push([bslug, dateOf(r).slice(0, 7), r.state, r.gender, r.sector, r.weekly_status, ...DIMS.map((d) => (isAll(r[d]) ? "" : r[d])), num(r.value) ?? "", "per cent of workers", base]); continue; }
        const parts = dims.map((d) => part(d, r[d]));
        const ws = WS(r.weekly_status);
        const key = [slug(r.state), ...parts.map((p) => p[0]), `${r.gender}_${S[r.sector]}`, ws].join("__");
        const d = dateOf(r), v = num(r.value);
        series[key] ??= { name: `plfs_workers_${key}_pct`, label: `${what(dims, parts)} · ${r.state} · ${G[r.gender]} · ${S_LABEL[S[r.sector]]} · ${WS_LABEL[ws]}`, color: "#5F6675", unit: "pct_of_workers", group: r.state, data: axis.map(() => null), why: new Map() };
        if (v == null && r.value != null && r.value !== "") series[key].why.set(d, `the API serves a malformed value ("${r.value}")`);
        const i = axis.indexOf(d);
        if (i >= 0) series[key].data[i] = v;
      }
      const nq = quarantineShares(series, axis, shareMember);
      if (nq) process.stdout.write(`plfs-deep: ${bslug}: ${nq} share tables withheld (no sample, or shares not adding up)\n`);
      const b = assemble({ slug: bslug, axis, series, meta: meta0("annual", base, `States and UTs, ${label}: per cent distribution of workers aged 15 and above by status in employment, broad industry, NIC section, NCO division and enterprise type, one cut at a time, by gender and sector; usual status (PS+SS), with status and broad industry also on the weekly status (CWS). The multi-way tables by state (status within each NIC group; enterprise type and size within each NIC group) are in the deep archive (data/archive/staging/plfs/${bslug}-cross.csv.gz). All India is services-jobs-ay / services-jobs-cy (the services guide). Each table's cells add to 100.`) });
      write([bslug, b]); counts[bslug] = Object.keys(b.series).length;
      if (cross.length) stageCsv(root, `${bslug}-cross.csv.gz`, ["table", "period", "state", "gender", "sector", "weekly_status", ...DIMS, "value", "unit", "base"], cross, vintage);
    };
    const rowsA = tagged("annual", 4, "agri");
    if (rowsA.length) build(rowsA, (r) => `${String(r.year).slice(0, 4)}-07-01`, AGRI_YEARS.map((y) => `${y.slice(0, 4)}-07-01`), "plfs-ay-workers-states", BASE_OLD, "original design, agriculture years plotted at July");
    const rowsC = tagged("annual", 4, "cal");
    for (const [tag, base, keepY, lab] of [["cy", BASE_OLD, (y) => `${y}-01` < NEW_DESIGN_FROM, "original design, calendar years plotted at January"], ["cy25", BASE_NEW, (y) => `${y}-01` >= NEW_DESIGN_FROM, "revamped design, calendar years plotted at January"]]) {
      const years = CAL_YEARS.filter(keepY);
      const rs = rowsC.filter((r) => years.includes(String(r.year)));
      if (rs.length) build(rs, (r) => `${r.year}-01-01`, years.map((y) => `${y}-01-01`), `plfs-${tag}-workers-states`, base, lab);
    }
  }

  process.stdout.write(`plfs-deep: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}\n`);
  return counts;
}
