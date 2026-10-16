// src/dossiers/gender.data.js: build-time reader for the Women and men guide
// (src/pages/guides/gender.astro). The guide draws on about 40 of the compendium's 180 bundles
// (one per table, split by instrument); the page reads them here at build time, computes the
// figures its copy names, and hands what each plate draws to src/dossiers/health-gender.charts.js,
// which draws it at build time. No runtime fetch; every value is a bundle's own, and a
// derived figure (a share computed from two counts) says so where it is shown.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cache = new Map();
export function load(slug) {
  if (!cache.has(slug)) cache.set(slug, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8")));
  return cache.get(slug);
}
const need = (slug, key) => {
  const s = load(slug).series[key];
  if (!s) throw new Error(`gender.data: ${slug} has no series ${key}`);
  return s;
};
/** a series as points: [{ iso, period, value }] over its published span */
export function points(slug, key) {
  const b = load(slug), s = need(slug, key);
  return b.dates.map((d, i) => ({ iso: d, period: b.meta.periodLabels?.[d] ?? d.slice(0, 4), value: s.data[i] })).filter((p) => p.value != null);
}
export const last = (slug, key) => points(slug, key).at(-1);
export const first = (slug, key) => points(slug, key)[0];
export const value = (slug, key) => last(slug, key).value;
/** every state's latest value for keys built as `${prefix}${geo}` (All India and blanks left out), highest first */
export function states(slug, prefix, suffix = "") {
  const b = load(slug);
  return Object.entries(b.series)
    .filter(([k, s]) => k.startsWith(prefix) && k.endsWith(suffix) && s.geo && s.geo !== "All India" && k.slice(prefix.length, k.length - suffix.length).indexOf("__") === -1)
    .map(([, s]) => { let i = s.data.length - 1; while (i >= 0 && s.data[i] == null) i--; return { geo: s.geo, v: i < 0 ? null : s.data[i], period: i < 0 ? null : b.meta.periodLabels?.[b.dates[i]] }; })
    .filter((r) => r.v != null).sort((a, b) => b.v - a.v);
}
export const periodOf = (slug) => load(slug).meta.latestPeriod;
export const agencyOf = (slug) => load(slug).meta.agency;
export const tableOf = (slug) => load(slug).meta.compendiumTable;
export const r1 = (v) => Math.round(v * 10) / 10;
export const share = (part, whole) => r1((100 * part) / whole);
