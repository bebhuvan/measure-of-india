// scripts/lib/products/markets-lib.mjs: small shared helpers for the markets family adapters
// (markets.mjs, markets-companies.mjs, markets-hub.mjs). Reading, unit conversion and bundle
// assembly with per-series disclosure (CONTRACT-series rules 1 to 3). No network here.
import { writeSeries } from "../util.mjs";

export const M3 = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** A DBIE cell as a number, or null for an empty or non-numeric cell ("", "-", "NULL", "#"). */
export const num = (s) => {
  const t = String(s ?? "").trim().replace(/,/g, "");
  if (t === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
};
/** Rupees to ₹ crore, two decimals. */
export const crore = (v) => (v == null ? null : Math.round((v / 1e7) * 100) / 100);
export const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
export const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);

/** "2004/08/31 00:00:00" -> "2004-08-01" */
export const monthOfStamp = (s) => `${s.slice(0, 4)}-${s.slice(5, 7)}-01`;
/** "AUG-2004" -> "2004-08-01" */
export const monthOfMon = (s) => {
  const m = /^([A-Z]{3})-(\d{4})$/.exec(String(s).trim().toUpperCase());
  if (!m || M3.indexOf(m[1]) < 0) return null;
  return `${m[2]}-${String(M3.indexOf(m[1]) + 1).padStart(2, "0")}-01`;
};
/** "2024-25" -> "2024-04-01" (a fiscal year dated by its first month, as the site's annual
 *  fiscal bundles are); "1999-00" -> "1999-04-01". */
export const fyStart = (fy) => {
  const m = /^(\d{4})-(\d{2})$/.exec(String(fy).trim());
  return m ? `${m[1]}-04-01` : null;
};
/** The quarter that ends in a month, dated by its first month: "2026-03-01" -> "2026-01-01". */
export const quarterStartOfEnd = (iso) => {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7);
  const d = new Date(Date.UTC(y, m - 3, 1));
  return d.toISOString().slice(0, 10);
};

export const slug = (s, n = 60) => String(s ?? "").toLowerCase().normalize("NFKD")
  .replace(/₹/g, "rs").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, n).replace(/_+$/, "") || "x";
/** Readable text from a DBIE label: collapse spaces, drop trailing colons. */
export const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/\s*:\s*$/, "").trim();

/** Keep one display unit of a DBIE report that repeats every value per unit. */
export function oneUnit(rows, col, want = "ACTUALS") {
  if (!rows.length || !(col in rows[0])) return rows;
  const has = rows.some((r) => r[col] === want);
  if (!has) throw new Error(`markets: unit column "${col}" has no ${want} rows`);
  return rows.filter((r) => r[col] === want);
}

/** Build a bundle from Map<seriesKey, {label, unit, values: Map<iso, number|null>, ...extra}>:
 *  the axis is the union of dates with any value, sorted; series that never publish are
 *  dropped; leading and trailing empties of the axis are trimmed; each series' interior nulls
 *  are declared on that series (CONTRACT-series rule 2). `gapsNote` explains them. */
export function assemble(series, { gapsNote, axis } = {}) {
  const dates = axis ? [...axis].sort() : [...new Set([...series.values()].flatMap((s) => [...s.values.entries()].filter(([, v]) => v != null).map(([d]) => d)))].sort();
  const out = {};
  for (const [k, s] of series) {
    const data = dates.map((d) => (s.values.has(d) ? s.values.get(d) : null));
    if (!data.some((v) => v != null)) continue;
    const { values, ...rest } = s;
    const o = { ...rest, data };
    const a = data.findIndex((v) => v != null), z = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > a && i < z && data[i] == null);
    if (gaps.length) { o.gaps = gaps; o.gapsNote = s.gapsNote ?? gapsNote ?? "The RBI's table prints no value for these periods; left empty, never filled."; }
    out[k] = o;
  }
  // trim the axis to the span some series publishes
  const any = (i) => Object.values(out).some((s) => s.data[i] != null);
  let lo = 0, hi = dates.length - 1;
  while (lo <= hi && !any(lo)) lo++;
  while (hi >= lo && !any(hi)) hi--;
  const d2 = dates.slice(lo, hi + 1);
  for (const s of Object.values(out)) s.data = s.data.slice(lo, hi + 1);
  return { dates: d2, series: out };
}

const STEP = { monthly: 1, bimonthly: 2, quarterly: 3, "half-yearly": 12, annual: 12 };
const addMonths = (iso, k) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + k, 1)).toISOString().slice(0, 10);
/** A regular-frequency bundle keeps every period on its axis: a period no series publishes is
 *  an empty slot (null), declared in each series' gaps, never a hole in the axis (CONTRACT-series
 *  rule 2). */
function regularize(built, step, gapsNote) {
  const have = new Set(built.dates);
  const axis = [];
  for (let d = built.dates[0]; d <= built.dates.at(-1); d = addMonths(d, step)) axis.push(d);
  if (built.dates.some((d) => !axis.includes(d))) throw new Error(`markets: dates ${built.dates.filter((d) => !axis.includes(d)).slice(0, 3)} are off the ${step}-month cadence`);
  if (axis.length === built.dates.length) return built;
  const idx = new Map(built.dates.map((d, i) => [d, i]));
  for (const s of Object.values(built.series)) {
    s.data = axis.map((d) => (have.has(d) ? s.data[idx.get(d)] : null));
    const a = s.data.findIndex((v) => v != null), z = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = axis.filter((d, i) => i > a && i < z && s.data[i] == null);
    if (gaps.length) { s.gaps = gaps; s.gapsNote ??= gapsNote; } else { delete s.gaps; delete s.gapsNote; }
  }
  return { dates: axis, series: built.series };
}

/** Write one bundle: meta from the family defaults plus `extra`, dates and series from assemble(). */
export function emit(root, slugName, metaBase, extra, built) {
  if (!built.dates.length || !Object.keys(built.series).length) throw new Error(`markets: ${slugName} would be empty (no data returned)`);
  const meta = { ...metaBase, ...extra };
  const step = STEP[meta.frequency];
  if (step) built = regularize(built, step, extra.periodGapsNote ?? "No figure is published for these periods (the whole table skips them); left empty.");
  delete meta.periodGapsNote;
  if (!meta.latestPeriod) meta.latestPeriod = built.dates.at(-1).slice(0, 7);
  writeSeries(root, `data/series/${slugName}.json`, { meta, dates: built.dates, series: built.series });
  return { slug: slugName, series: Object.keys(built.series).length, dates: built.dates.length, last: built.dates.at(-1) };
}

/** Series map helper: get-or-create a series. */
export function ser(map, key, init) {
  if (!map.has(key)) map.set(key, { ...init, values: new Map() });
  return map.get(key);
}
