// scripts/perf-browser.mjs: the throttled-phone gate. Serves a built dist/ (gzip, as Cloudflare
// does), loads every guide and every state profile in Chromium at 390 px with the CPU slowed 4x,
// and fails (exit 1) when a page's main-thread blocking passes its budget (perf/budgets.json
// `browser`). Playwright is a devDependency; Chromium comes from `npx playwright install chromium`,
// or set ATLAS_CHROME_CHANNEL=chrome to use an installed Google Chrome.
//
//   node scripts/perf-browser.mjs [dist] [--only /guides/cpi/,/states/kerala/] [--runs 3]
//        [--json out.json] [--record]
//
// (plus the three every-cut pages with the most rows, which stream their packs after load).
// Per page, the median of --runs cold loads (fresh context each, so nothing is cached):
//   maxTask   the longest main-thread task (ms), from navigation until the page settles
//   tbt       total blocking time: the sum of (task - 50 ms) over the same window
//   cls       cumulative layout shift
//   lcp       largest contentful paint (ms)
//   settled   when the page settled: load fired, every queued chart job resolved
//             (document.__atlasChartJobs) and 1.5 s passed with no long task
// The network is not throttled: these budgets are about the main thread, which is what a phone
// lacks; transfer is gated byte-exactly by scripts/perf-budget.mjs. Medians of three cold runs
// keep the gate steady; budgets carry 15% + 50 ms of slack over a recorded value.
// Run it with the machine otherwise quiet: a build, qc or a second browser beside it inflates
// main-thread times by 15-25% (measured 2026-10-16) and fails pages that are not slower.
// A failure that does not reproduce with --only <pages> --workers 1 --runs 5 is contention.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DIST = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--only", "--runs", "--json", "--workers"].includes(args[i - 1])) ?? process.env.QC_DIST ?? path.join(ROOT, "dist"));
const RUNS = Number(opt("--runs") ?? process.env.ATLAS_PERF_RUNS ?? 3);
const WORKERS = Number(opt("--workers") ?? process.env.ATLAS_PERF_WORKERS ?? Math.max(1, Math.min(3, Math.floor(os.availableParallelism() / 4))));
const BUDGETS = path.join(ROOT, "perf/budgets.json");
const budgets = JSON.parse(fs.readFileSync(BUDGETS, "utf8"));
if (!fs.existsSync(path.join(DIST, "index.html"))) { console.error(`perf-browser: no build at ${DIST}`); process.exit(1); }

// ---- routes: every guide and every state profile in the build
const dirs = (p) => fs.existsSync(p) ? fs.readdirSync(p, { withFileTypes: true }).filter((e) => e.isDirectory() && fs.existsSync(path.join(p, e.name, "index.html"))).map((e) => e.name) : [];
let routes = [
  ...dirs(path.join(DIST, "guides")).map((s) => `/guides/${s}/`),
  ...dirs(path.join(DIST, "states")).map((s) => `/states/${s}/`),
].filter((r) => !/^<!doctype html><title>Redirecting/i.test(fs.readFileSync(path.join(DIST, r, "index.html"), "utf8").slice(0, 60)));
// and the three heaviest every-cut pages (the most rows on one page), which stream their packs
{
  const pages = [];
  for (const g of dirs(path.join(DIST, "guides"))) {
    const root = path.join(DIST, "guides", g, "every-cut");
    (function walk(d) { if (!fs.existsSync(d)) return; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name === "index.html") {
      const n = [...fs.readFileSync(p, "utf8").matchAll(/class="ec"[^>]*data-total="(\d+)"/g)].reduce((a, m) => a + +m[1], 0);
      pages.push(["/" + path.relative(DIST, path.dirname(p)).split(path.sep).join("/") + "/", n]); } } })(root);
  }
  routes.push(...pages.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([r]) => r));
}
if (opt("--only")) routes = opt("--only").split(",");

// ---- a static server with gzip, MIME types and trailing-slash directories
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".csv": "text/csv", ".xml": "application/xml", ".gz": "application/gzip" };
const COMPRESS = new Set([".html", ".js", ".css", ".json", ".svg", ".csv", ".xml"]);
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let f = path.join(DIST, p);
  if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  const ext = path.extname(f), body = fs.readFileSync(f);
  const headers = { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "no-store" };
  if (COMPRESS.has(ext) && /gzip/.test(req.headers["accept-encoding"] ?? "")) { headers["content-encoding"] = "gzip"; res.writeHead(200, headers).end(zlib.gzipSync(body, { level: 6 })); }
  else res.writeHead(200, headers).end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// installed before any page script: long tasks, layout shifts and LCP, buffered from the start
const OBSERVE = () => {
  const w = window; w.__perf = { tasks: [], cls: 0, lcp: 0 };
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__perf.tasks.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) w.__perf.cls += e.value; }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) w.__perf.lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
};

const launch = () => chromium.launch({ ...(process.env.ATLAS_CHROME_CHANNEL ? { channel: process.env.ATLAS_CHROME_CHANNEL } : {}), args: ["--no-sandbox"] });
async function measure(browser, route) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
  await page.addInitScript(OBSERVE);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  await page.goto(BASE + route, { waitUntil: "load", timeout: 180_000 });
  // settle: every chart job done, then 1.5 s with no new long task (capped at 120 s)
  const settled = await page.evaluate(async () => {
    const jobs = document.__atlasChartJobs ?? [];
    await Promise.allSettled(jobs.map((j) => j.promise));
    const quiet = 1500, cap = 120_000;
    // every-cut tables stream their packs after load (everycut.client.js): wait for them too
    while (document.querySelector(".ec[data-pack]:not([data-complete]):not([data-failed])") && performance.now() < cap) await new Promise((r) => setTimeout(r, 250));
    window.__perf.everyCutFailed = document.querySelectorAll(".ec[data-failed]").length;
    let last = performance.now();
    while (performance.now() < cap) {
      const end = Math.max(0, ...window.__perf.tasks.map(([s, d]) => s + d));
      if (performance.now() - Math.max(end, last) >= quiet) break;
      last = Math.max(last, end);
      await new Promise((r) => setTimeout(r, 250));
    }
    return Math.max(0, ...window.__perf.tasks.map(([s, d]) => s + d), performance.now() - 1500);
  });
  const p = await page.evaluate(() => window.__perf);
  await ctx.close();
  const maxTask = Math.max(0, ...p.tasks.map(([, d]) => d));
  const tbt = p.tasks.reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
  if (p.everyCutFailed) errors.push(`${p.everyCutFailed} every-cut table(s) failed to stream`);
  return { maxTask: Math.round(maxTask), tbt: Math.round(tbt), tasks: p.tasks.length, cls: +p.cls.toFixed(4), lcp: Math.round(p.lcp), settled: Math.round(settled), wall: Date.now() - t0, errors };
}

const results = {};
const queue = [...routes];
const t0 = Date.now();
await Promise.all(Array.from({ length: Math.min(WORKERS, queue.length) }, async () => {
  const browser = await launch();
  try {
    for (let r; (r = queue.shift()); ) {
      const runs = [];
      for (let i = 0; i < RUNS; i++) runs.push(await measure(browser, r));
      const med = (k) => { const s = runs.map((x) => x[k]).sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
      results[r] = { maxTask: med("maxTask"), tbt: med("tbt"), cls: med("cls"), lcp: med("lcp"), settled: med("settled"), tasks: med("tasks"), errors: [...new Set(runs.flatMap((x) => x.errors))], runs };
      const x = results[r];
      console.log(`${r.padEnd(34)} maxTask ${String(x.maxTask).padStart(6)} ms  tbt ${String(x.tbt).padStart(6)} ms  cls ${x.cls.toFixed(3)}  lcp ${String(x.lcp).padStart(5)} ms  settled ${(x.settled / 1000).toFixed(1)} s${x.errors.length ? "  ERRORS " + x.errors.length : ""}`);
    }
  } finally { await browser.close(); }
}));
server.close();

// ---- gate
const B = budgets.browser;
const failures = [];
const slack = (v) => Math.round(v * (1 + B.slack) + B.slackMs);
for (const [r, x] of Object.entries(results)) {
  const own = B.pages?.[r] ?? {};
  for (const k of ["maxTask", "tbt"]) {
    const ceiling = own[k] != null ? slack(own[k]) : B.default[k];
    if (x[k] > ceiling) failures.push(`${r} ${k}: ${x[k]} ms, over ${ceiling} ms${own[k] != null ? ` (recorded ${own[k]} + slack)` : " (default)"}`);
  }
  const clsCeil = own.cls != null ? Math.max(own.cls * (1 + B.slack), B.default.cls) : B.default.cls;
  if (x.cls > clsCeil) failures.push(`${r} cls: ${x.cls}, over ${clsCeil.toFixed(3)}`);
  if (x.errors.length) failures.push(`${r}: page errors: ${x.errors.slice(0, 3).join(" | ")}`);
}
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ dist: DIST, runs: RUNS, cpuThrottle: 4, viewport: "390x844", results }, null, 1));
if (args.includes("--record")) {
  // record only lowers: a page's recorded value is the smaller of the old record and today's median
  B.pages ??= {};
  for (const [r, x] of Object.entries(results)) {
    const o = (B.pages[r] ??= {});
    for (const k of ["maxTask", "tbt", "cls"]) o[k] = o[k] == null ? x[k] : Math.min(o[k], x[k]);
  }
  B.pages = Object.fromEntries(Object.entries(B.pages).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BUDGETS, JSON.stringify(budgets, null, 1) + "\n");
}
console.log(`perf-browser: ${Object.keys(results).length} pages x ${RUNS} runs in ${((Date.now() - t0) / 1000).toFixed(0)} s, ${WORKERS} workers`);
if (failures.length) { console.error(`\nperf-browser: ${failures.length} over budget`); for (const f of failures) console.error("  " + f); process.exit(1); }
console.log("perf-browser: all within budget");
