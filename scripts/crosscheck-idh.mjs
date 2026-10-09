#!/usr/bin/env node
// scripts/crosscheck-idh.mjs: corroborate our bundles against India Data Hub (PLAN-launch §3).
//
// Reads the pairs in data/crosscheck/idh.yml, pulls the IDH series from the Data Bank's parsed
// `india_data_hub_series` through databankQuery (read-only; the Data Bank's CLI chooses the
// rows), keeps the latest vintage of each observation, maps IDH's month-end dates onto our
// month-start axis, applies the pair's transform and scale, and compares on the dates both
// publish. Writes pipeline/out/crosscheck-idh.json (git-ignored: IDH values are licensed and
// must never enter the repo or the site) and prints a summary: pairs checked, matches, worst
// delta and its date, and which side runs later.
//
// A disagreement is a flag to investigate, not a failure: exit 0 unless the run itself
// breaks (Data Bank missing, a manifest pair naming a bundle or series that does not exist).
//
// Usage: node scripts/crosscheck-idh.mjs [--json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { databankRoot, databankQuery } from "./lib/databank.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = YAML.parse(fs.readFileSync(path.join(ROOT, "data/crosscheck/idh.yml"), "utf8"));
const families = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8")).families ?? {};
const root = databankRoot(families.databank);

const pairs = manifest.pairs ?? [];
const ids = [...new Set(pairs.map((p) => p.idh))];
for (const id of ids) if (!/^[A-Z0-9_:]+$/.test(id)) throw new Error(`crosscheck-idh: odd IDH id "${id}"`);
const sql = `SELECT DISTINCT series_id, observation_date, value, vintage_date FROM {table} WHERE series_id IN (${ids.map((i) => `'${i}'`).join(",")}) ORDER BY series_id, observation_date, vintage_date`;
const { rows } = databankQuery(root, "india_data_hub_series", sql);

// latest vintage per (series, observation date); rows arrive vintage-ascending
const idh = new Map();
for (const r of rows) {
  if (r.value == null) continue;
  if (!idh.has(r.series_id)) idh.set(r.series_id, new Map());
  idh.get(r.series_id).set(String(r.observation_date).slice(0, 10), +r.value);
}

const monthKey = (iso) => iso.slice(0, 7) + "-01";
const yearEarlier = (iso) => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`;
function idhOnOurAxis(obs, transform, scale) {
  const out = new Map();
  if (transform === "monthly_mean") {
    const acc = new Map();
    for (const [d, v] of obs) { const k = monthKey(d); const a = acc.get(k) ?? [0, 0]; acc.set(k, [a[0] + v, a[1] + 1]); }
    for (const [k, [s, n]] of acc) out.set(k, (s / n) * scale);
    return out;
  }
  const monthly = new Map([...obs].map(([d, v]) => [monthKey(d), v * scale]));
  if (transform === "level") return monthly;
  if (transform === "yoy_from_index") {
    for (const [k, v] of monthly) { const p = monthly.get(yearEarlier(k)); if (p) out.set(k, (v / p - 1) * 100); }
    return out;
  }
  throw new Error(`crosscheck-idh: unknown transform "${transform}"`);
}

const results = [];
for (const p of pairs) {
  const file = path.join(ROOT, "data/series", p.bundle + ".json");
  if (!fs.existsSync(file)) throw new Error(`crosscheck-idh: bundle ${p.bundle} not in data/series/`);
  const b = JSON.parse(fs.readFileSync(file, "utf8"));
  const s = b.series[p.series];
  if (!s) throw new Error(`crosscheck-idh: series ${p.series} not in ${p.bundle}`);
  const obs = idh.get(p.idh);
  const rec = { bundle: p.bundle, series: p.series, label: s.label, idh: p.idh, transform: p.transform, tolerance: p.tolerance, note: p.note ?? null };
  if (!obs?.size) { results.push({ ...rec, status: "no idh data", checked: 0 }); continue; }
  const theirs = idhOnOurAxis(obs, p.transform, p.scale ?? 1);
  let n = 0, matches = 0, worst = null, first = null, last = null;
  const misses = [];
  b.dates.forEach((d, i) => {
    const ours = s.data[i], t = theirs.get(d);
    if (ours == null || t == null) return;
    n++; first ??= d; last = d;
    const delta = ours - t;
    if (Math.abs(delta) <= p.tolerance + 1e-9) matches++; else misses.push(d);
    if (!worst || Math.abs(delta) > Math.abs(worst.delta)) worst = { date: d, ours, idh: +t.toFixed(4), delta: +delta.toFixed(4) };
  });
  const ourLast = b.dates.filter((_, i) => s.data[i] != null).at(-1) ?? null;
  const idhLast = [...theirs.keys()].sort().at(-1) ?? null;
  results.push({ ...rec, status: n ? (matches === n ? "match" : "flag") : "no overlap", checked: n, matches, first, last,
    worst, misses: misses.slice(0, 24), missCount: misses.length, ourLast, idhLast });
}

const report = { generated_at: new Date().toISOString(), source: manifest.source, licence: "India Data Hub values: licensed, never committed or published", pairs: results };
fs.mkdirSync(path.join(ROOT, "pipeline/out"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "pipeline/out/crosscheck-idh.json"), JSON.stringify(report, null, 1) + "\n");

const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toFixed(3));
const checked = results.filter((r) => r.checked);
console.log(`IDH cross-check: ${checked.length} of ${results.length} pairs checked, ${checked.filter((r) => r.status === "match").length} match on every shared date`);
for (const r of results) {
  if (!r.checked) { console.log(`  ${r.status.padEnd(10)} ${r.bundle}.${r.series} vs ${r.idh}`); continue; }
  const lag = r.idhLast && r.ourLast && r.idhLast > r.ourLast ? `; IDH runs to ${r.idhLast.slice(0, 7)}, ours to ${r.ourLast.slice(0, 7)}` : "";
  console.log(`  ${r.status.padEnd(10)} ${r.bundle}.${r.series} vs ${r.idh}: ${r.matches}/${r.checked} within ${r.tolerance} (${r.first.slice(0, 7)} to ${r.last.slice(0, 7)}); worst ${fmt(r.worst.delta)} at ${r.worst.date.slice(0, 7)}${lag}`);
}
console.log("report: pipeline/out/crosscheck-idh.json (git-ignored)");
