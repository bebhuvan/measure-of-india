// scripts/perf-search.mjs: site search, measured and judged on a built dist/ through the same
// engine the home page runs (src/dossiers/search-core.js). Deterministic: it counts the files and
// gzip bytes each query fetches cold and how long the engine computes in Node; browser
// latency is perf-browser's business. The labelled queries (perf/search-queries.json) say where
// a reader should land; a query passes when its expected destination is in the top N.
//
//   node scripts/perf-search.mjs [dist] [--json out.json] [--show 5]
//
// Fails (exit 1) on: a labelled query missing its destination, a cold query fetching more
// gzip bytes than budgets.json `search.maxQueryGz`, or the core over `search.maxCoreGz`.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createSearch } from "../src/dossiers/search-core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DIST = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--json", "--show"].includes(args[i - 1])) ?? process.env.QC_DIST ?? path.join(ROOT, "dist"));
const SHOW = Number(opt("--show") ?? 0);
const budgets = JSON.parse(fs.readFileSync(path.join(ROOT, "perf/budgets.json"), "utf8")).search ?? {};
const queries = JSON.parse(fs.readFileSync(path.join(ROOT, "perf/search-queries.json"), "utf8")).queries;
const DIR = path.join(DIST, "search");
const gzBytes = new Map();
const gz = (rel) => { if (!gzBytes.has(rel)) gzBytes.set(rel, zlib.gzipSync(fs.readFileSync(path.join(DIR, rel)), { level: 6 }).length); return gzBytes.get(rel); };

const coreText = fs.readFileSync(path.join(DIR, "core.json"), "utf8");
const t0 = performance.now();
const core = JSON.parse(coreText);
let fetched = [];
const load = async (rel) => { fetched.push(rel); return JSON.parse(fs.readFileSync(path.join(DIR, rel), "utf8")); };
const fresh = () => createSearch(core, load);
fresh();
const initMs = performance.now() - t0;
const coreGz = gz("core.json");
console.log(`core: ${(coreText.length / 1024).toFixed(0)} KB raw, ${(coreGz / 1024).toFixed(0)} KB gzip, parse+init ${initMs.toFixed(0)} ms (Node, unthrottled)`);

const re = (s) => new RegExp(s, "i");
const out = [], failures = [], known = [];
for (const q of queries) {
  const S = fresh();           // cold: a new engine, nothing cached
  fetched = [];
  const t = performance.now();
  const quick = S.quick(q.q);
  const series = await S.series(q.q, { limit: 8 });
  const ms = performance.now() - t;
  const bytes = fetched.reduce((a, f) => a + gz(f), 0);
  // the reader's list, in the order the home page shows it: state profiles that lead, guides,
  // charts, then series (home.client.js)
  const list = [
    ...quick.states.filter((s) => s.lead).map((s) => ({ kind: "state", href: s.href, label: s.title })),
    ...quick.guides.map((g) => ({ kind: "guide", href: g.href, label: g.title })),
    ...quick.plates.map((p) => ({ kind: "chart", href: p.href, label: p.title })),
    ...series.rows.map((r) => ({ kind: "series", href: r.guideHref, label: r.label + (r.group ? ` (${r.group})` : ""), bundle: r.bundle })),
  ];
  const top = list.slice(0, q.top ?? 3);
  const hit = (x) => (!q.href || re(q.href).test(x.href)) && (!q.label || re(q.label).test(x.label)) && (!q.bundle || re(q.bundle).test(x.bundle ?? ""));
  const firstSeries = series.rows[0];
  const seriesOk = !q.series || (firstSeries && re(q.series).test(firstSeries.label + " " + firstSeries.bundle));
  const suggestOk = !q.suggest || S.suggest(q.q) === q.suggest;
  const ok = (q.none ? list.length === 0 : q.suggest ? true : top.some(hit)) && seriesOk && suggestOk;
  if (q.known) { if (ok) failures.push(`"${q.q}": now passes; remove its known mark ("${q.known}") so it stays fixed`); else known.push(`"${q.q}": ${q.known}`); }
  else if (!ok) failures.push(`"${q.q}": expected ${JSON.stringify({ href: q.href, label: q.label, series: q.series, none: q.none })} in top ${q.top ?? 3}; got ${top.map((x) => `${x.kind}:${x.label}`).join(" | ") || "nothing"}${q.series ? `; first series ${firstSeries?.label ?? "none"} [${firstSeries?.bundle}]` : ""}`);
  if (budgets.maxQueryGz && bytes > budgets.maxQueryGz) failures.push(`"${q.q}": cold query fetched ${(bytes / 1024).toFixed(0)} KB gzip in ${fetched.length} files, over ${(budgets.maxQueryGz / 1024).toFixed(0)} KB`);
  out.push({ q: q.q, ok, ms: Math.round(ms), files: fetched.length, gzBytes: bytes, total: series.total, top: list.slice(0, 8) });
  console.log(`${ok ? "pass" : q.known ? "know" : "FAIL"}  ${q.q.padEnd(34)} ${String(fetched.length).padStart(2)} files ${String(Math.round(bytes / 1024)).padStart(4)} KB gz ${String(Math.round(ms)).padStart(5)} ms  ${series.total.toLocaleString("en-IN")} rows`);
  if (SHOW) for (const x of list.slice(0, SHOW)) console.log(`        ${x.kind.padEnd(6)} ${x.label.slice(0, 90)}  ${x.bundle ?? x.href}`);
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const sum = { core: { raw: coreText.length, gz: coreGz, initMs: Math.round(initMs) }, queries: out.length, passed: out.filter((x) => x.ok).length, known: known.length,
  medianQueryGz: med(out.map((x) => x.gzBytes)), maxQueryGz: Math.max(...out.map((x) => x.gzBytes)), medianFiles: med(out.map((x) => x.files)), medianMs: med(out.map((x) => x.ms)) };
console.log(`search: ${sum.passed}/${sum.queries} labelled queries pass; per cold query median ${(sum.medianQueryGz / 1024).toFixed(0)} KB gz in ${sum.medianFiles} files (max ${(sum.maxQueryGz / 1024).toFixed(0)} KB), engine median ${sum.medianMs} ms`);
if (known.length) { console.log(`known ranking issues (${known.length}):`); for (const k of known) console.log("  " + k); }
if (budgets.maxCoreGz && coreGz > budgets.maxCoreGz) failures.push(`core: ${(coreGz / 1024).toFixed(0)} KB gzip, over ${(budgets.maxCoreGz / 1024).toFixed(0)} KB`);
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ summary: sum, results: out }, null, 1));
if (failures.length) { console.error(`\nperf-search: ${failures.length} failures`); for (const f of failures) console.error("  " + f); process.exit(1); }
