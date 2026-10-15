// scripts/perf-budget.mjs: the static performance gate. Reads a built dist/ and fails (exit 1) on
// any page or file over its budget. Budgets: perf/budgets.json (docs/CONTRACT-render.md "Budgets").
//
//   node scripts/perf-budget.mjs [dist]            check
//   node scripts/perf-budget.mjs [dist] --record   also lower recorded ceilings to today's values
//                                                  (never raises one; see perf/README.md)
//   node scripts/perf-budget.mjs [dist] --json out.json   write the per-page measurements
//
// What it measures, per HTML page, in the bytes a reader actually transfers (gzip -6, which is
// close to what Cloudflare serves; brotli is smaller still):
//   html     the page itself
//   js       every module script the page loads, following static imports through _astro/
//   css      linked stylesheets
//   json     inline <script type="application/json"> payloads (already counted inside html,
//            reported separately because they are the usual cause of a heavy page)
//   fonts    the woff2 files the page can need: preloads, plus every @font-face whose
//            unicode-range covers a character of the page's text (an upper bound: the browser
//            also needs the family and style to be used, which this does not try to prove)
// and for the deploy as a whole: file count and the largest file.
//
// Pages are typed by path (guide, state, everycut, explore, other); a type has a ceiling in
// budgets.json `types`, and a page may carry its own lower ceiling in `pages` (the ratchet:
// --record writes min(current ceiling, measured * 1.10 rounded up to 1 KB)).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DIST = path.resolve(args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--json") ?? process.env.QC_DIST ?? path.join(ROOT, "dist"));
const BUDGETS = path.join(ROOT, "perf/budgets.json");
const budgets = JSON.parse(fs.readFileSync(BUDGETS, "utf8"));
if (!fs.existsSync(path.join(DIST, "index.html"))) { console.error(`perf-budget: no build at ${DIST}; run npx astro build first`); process.exit(1); }

const gz = (buf) => zlib.gzipSync(buf, { level: 6 }).length;
const KB = (n) => (n / 1024).toFixed(1) + " KB";

// ---- every file: count and largest
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p); else files.push(p);
  }
})(DIST);
const failures = [];
const fileCap = Number(process.env.ATLAS_DEPLOY_FILE_CAP ?? budgets.deploy.maxFiles);
if (files.length > fileCap) failures.push(`deploy: ${files.length.toLocaleString("en-IN")} files, over the cap of ${fileCap.toLocaleString("en-IN")} (Workers static assets allow 100,000 on paid plans)`);
let totalBytes = 0;
for (const f of files) {
  const s = fs.statSync(f).size; totalBytes += s;
  if (s > budgets.deploy.maxFileBytes) failures.push(`deploy: ${path.relative(DIST, f)} is ${(s / 2 ** 20).toFixed(1)} MiB, over ${(budgets.deploy.maxFileBytes / 2 ** 20).toFixed(0)} MiB (platform cap 25 MiB)`);
}

// ---- shared assets, measured once
const gzCache = new Map();
const gzOf = (abs) => { if (!gzCache.has(abs)) gzCache.set(abs, fs.existsSync(abs) ? gz(fs.readFileSync(abs)) : 0); return gzCache.get(abs); };
const urlToFile = (u, from) => {
  if (!u || /^(https?:)?\/\//.test(u) || u.startsWith("data:")) return null;
  const clean = u.split(/[?#]/)[0];
  return clean.startsWith("/") ? path.join(DIST, clean) : path.resolve(path.dirname(from), clean);
};
// static imports of a built module: import "x"; import {a} from "x"; export * from "x"
const importsOf = new Map();
const moduleGraph = (abs, seen = new Set()) => {
  if (seen.has(abs) || !fs.existsSync(abs)) return seen;
  seen.add(abs);
  if (!importsOf.has(abs)) {
    const src = fs.readFileSync(abs, "utf8");
    const out = [];
    for (const m of src.matchAll(/(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["']([^"']+\.js)["']/g)) out.push(path.resolve(path.dirname(abs), m[1]));
    importsOf.set(abs, out);
  }
  for (const d of importsOf.get(abs)) moduleGraph(d, seen);
  return seen;
};

// @font-face rules: from every CSS file in dist plus inline <style> blocks (read per page)
const faceRe = /@font-face\s*{([^}]*)}/g;
const parseFaces = (css, from) => [...css.matchAll(faceRe)].map((m) => {
  const body = m[1];
  const src = body.match(/url\(\s*["']?([^"')]+\.woff2?)["']?\s*\)/)?.[1];
  const ranges = (body.match(/unicode-range\s*:\s*([^;]+)/)?.[1] ?? "U+0-10FFFF").split(",").map((r) => {
    const [a, b] = r.trim().replace(/^U\+/i, "").split("-");
    if (a.includes("?")) return [parseInt(a.replace(/\?/g, "0"), 16), parseInt(a.replace(/\?/g, "F"), 16)];
    return [parseInt(a, 16), parseInt(b ?? a, 16)];
  });
  const italic = /font-style\s*:\s*italic/.test(body);
  return { file: src ? urlToFile(src, from) : null, ranges, italic };
}).filter((f) => f.file);
const cssFaces = new Map();
const facesOfCss = (abs) => { if (!cssFaces.has(abs)) cssFaces.set(abs, fs.existsSync(abs) ? parseFaces(fs.readFileSync(abs, "utf8"), abs) : []); return cssFaces.get(abs); };

const typeOf = (rel) => {
  if (/^guides\/[^/]+\/every-cut\//.test(rel)) return "everycut";
  if (/^guides\/[^/]+\/index\.html$/.test(rel)) return "guide";
  if (/^states\/[^/]+\/index\.html$/.test(rel)) return "state";
  if (/^explore\//.test(rel)) return "explore";
  return "other";
};
const route = (rel) => "/" + rel.replace(/index\.html$/, "");

const pages = [];
const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
for (const abs of files) {
  if (!abs.endsWith(".html")) continue;
  const rel = path.relative(DIST, abs).split(path.sep).join("/");
  const html = fs.readFileSync(abs, "utf8");
  if (/^<!doctype html><title>Redirecting/i.test(html.slice(0, 60))) continue;   // astro redirect stubs
  const m = { route: route(rel), type: typeOf(rel), html: gzOf(abs), js: 0, css: 0, json: 0, fonts: 0, fontFiles: [] };
  const js = new Set();
  for (const s of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)) { const f = urlToFile(s[1], abs); if (f) moduleGraph(f, js); }
  // inline module scripts can import chunks too
  for (const s of html.matchAll(/<script\b[^>]*type=["']module["'][^>]*>([\s\S]*?)<\/script>/g))
    for (const i of s[1].matchAll(/(?:import|from)\s*["']([^"']+\.js)["']/g)) { const f = urlToFile(i[1], abs); if (f) moduleGraph(f, js); }
  for (const f of js) m.js += gzOf(f);
  for (const s of html.matchAll(/<script\b[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/g)) m.json += gz(Buffer.from(s[1]));
  const faces = [];
  for (const l of html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/g)) {
    const href = l[0].match(/href=["']([^"']+)["']/)?.[1]; const f = urlToFile(href, abs);
    if (f) { m.css += gzOf(f); faces.push(...facesOfCss(f)); }
  }
  for (const s of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) faces.push(...parseFaces(s[1], abs));
  const fonts = new Set();
  for (const l of html.matchAll(/<link\b[^>]*rel=["']preload["'][^>]*as=["']font["'][^>]*>|<link\b[^>]*as=["']font["'][^>]*rel=["']preload["'][^>]*>/g)) {
    const f = urlToFile(l[0].match(/href=["']([^"']+)["']/)?.[1], abs); if (f) fonts.add(f);
  }
  const cps = new Set([...textOf(html)].map((c) => c.codePointAt(0)));
  const usesItalic = /<(em|i|cite)\b|font-style\s*:\s*italic/.test(html);
  for (const face of faces) {
    if (face.italic && !usesItalic) continue;
    if ([...cps].some((c) => face.ranges.some(([a, b]) => c >= a && c <= b))) fonts.add(face.file);
  }
  for (const f of fonts) { m.fonts += fs.existsSync(f) ? fs.statSync(f).size : 0; m.fontFiles.push(path.relative(DIST, f)); }
  pages.push(m);
}

// ---- check against ceilings
const METRICS = ["html", "js", "css", "json", "fonts"];
const ceilingOf = (p, k) => budgets.pages?.[p.route]?.[k] ?? budgets.types[p.type]?.[k];
for (const p of pages) for (const k of METRICS) {
  const c = ceilingOf(p, k);
  if (c != null && p[k] > c) failures.push(`${p.route} ${k}: ${KB(p[k])} gzip, over its ceiling of ${KB(c)}${budgets.pages?.[p.route]?.[k] != null ? " (recorded)" : ` (${p.type} default)`}`);
}

// ---- summary
const byType = {};
for (const p of pages) { const t = (byType[p.type] ??= { n: 0, ...Object.fromEntries(METRICS.map((k) => [k, []])) }); t.n++; for (const k of METRICS) t[k].push(p[k]); }
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
console.log(`perf-budget: ${files.length.toLocaleString("en-IN")} files, ${(totalBytes / 1e9).toFixed(2)} GB, ${pages.length} pages`);
for (const [t, v] of Object.entries(byType)) console.log(`  ${t.padEnd(9)} ${String(v.n).padStart(5)} pages  ` + METRICS.map((k) => `${k} med ${KB(med(v[k]))} max ${KB(Math.max(...v[k]))}`).join(" | "));

if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ dist: DIST, files: files.length, bytes: totalBytes, pages }, null, 1));
if (flag("--record")) {
  budgets.pages ??= {};
  let lowered = 0;
  for (const p of pages) for (const k of METRICS) {
    if (p.type === "everycut" || p.type === "other") continue;   // these gate on the type ceiling only
    const want = Math.ceil((p[k] * 1.10) / 1024) * 1024 || 1024;
    const cur = ceilingOf(p, k);
    if (cur == null || want < cur) { (budgets.pages[p.route] ??= {})[k] = want; lowered++; }
  }
  budgets.pages = Object.fromEntries(Object.entries(budgets.pages).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BUDGETS, JSON.stringify(budgets, null, 1) + "\n");
  console.log(`perf-budget: --record lowered ${lowered} ceilings in perf/budgets.json`);
}
if (failures.length) {
  console.error(`\nperf-budget: ${failures.length} over budget`);
  for (const f of failures.slice(0, 200)) console.error("  " + f);
  if (failures.length > 200) console.error(`  ... and ${failures.length - 200} more`);
  process.exit(1);
}
console.log("perf-budget: all within budget");
