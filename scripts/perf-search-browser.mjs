// scripts/perf-search-browser.mjs: site search as a reader on a mid-range phone meets it. Serves a
// built dist/ (gzip), opens the home page in Chromium at 390 px with the CPU slowed 4x and the
// network at 1.6 Mbps down / 750 kbps up / 150 ms round trip, types each labelled query
// (perf/search-queries.json) and times:
//   first   from the keystroke to the first result row on screen (guides and charts, from the core)
//   series  from the keystroke to the series on screen (the shards): the Data series tab has its count
// cold: a fresh browser context, the query typed as soon as the page has loaded (the core not yet
//       fetched); idle: the same, typed after the page has been idle 3 s (the core warmed on idle);
// warm: a second query in the same tab. A report, not a gate (timings are noisy; bytes are gated
// by perf-search): node scripts/perf-search-browser.mjs [dist] [--json out.json] [--limit n]
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const DIST = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--json", "--limit"].includes(args[i - 1])) ?? process.env.QC_DIST ?? path.join(ROOT, "dist"));
const queries = JSON.parse(fs.readFileSync(path.join(ROOT, "perf/search-queries.json"), "utf8")).queries.filter((q) => !q.none && !q.suggest).slice(0, Number(opt("--limit") ?? 99));

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".gz": "application/gzip" };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404).end(); return; }
  const ext = path.extname(f), body = fs.readFileSync(f), h = { "content-type": TYPES[ext] ?? "application/octet-stream" };
  if ([".html", ".js", ".css", ".json"].includes(ext)) res.writeHead(200, { ...h, "content-encoding": "gzip" }).end(zlib.gzipSync(body, { level: 6 }));
  else res.writeHead(200, h).end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ ...(process.env.ATLAS_CHROME_CHANNEL ? { channel: process.env.ATLAS_CHROME_CHANNEL } : {}), args: ["--no-sandbox"] });

async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  return { ctx, page };
}
// type the query, then time the first option and the series count (draw() in src/search/ui.js)
async function ask(page, q) {
  await page.fill("#q", "");
  await page.evaluate(() => { const l = document.querySelector("#results .sx-list"), n = document.querySelector('#results [data-tab="series"] .n'); if (l) l.innerHTML = ""; if (n) n.textContent = ""; });
  const t0 = await page.evaluate((text) => { const el = document.getElementById("q"); el.focus(); el.value = text; const t = performance.now(); el.dispatchEvent(new Event("input", { bubbles: true })); return t; }, q);
  const first = await page.waitForFunction(() => { const li = document.querySelector('#results li[role="option"]'); return li ? performance.now() : null; }, null, { timeout: 60_000, polling: "raf" }).then((h) => h.jsonValue());
  const series = await page.waitForFunction(() => { const n = document.querySelector('#results [data-tab="series"] .n')?.textContent; return n && n !== "…" && !document.querySelector("#results .wait") ? performance.now() : null; }, null, { timeout: 60_000, polling: "raf" }).then((h) => h.jsonValue()).catch(() => null);
  return { first: Math.round(first - t0), series: series == null ? null : Math.round(series - t0) };
}

const out = [];
for (const [i, q] of queries.entries()) {
  const row = { q: q.q };
  { const { ctx, page } = await phone(); await page.goto(BASE + "/", { waitUntil: "load" }); row.cold = await ask(page, q.q); await ctx.close(); }
  { const { ctx, page } = await phone(); await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(3000); row.idle = await ask(page, q.q);
    const other = queries[(i + 1) % queries.length].q; await ask(page, other); row.warm = await ask(page, q.q); await ctx.close(); }
  out.push(row);
  console.log(`${q.q.padEnd(32)} cold ${String(row.cold.first).padStart(5)} / ${String(row.cold.series).padStart(5)} ms   after idle ${String(row.idle.first).padStart(5)} / ${String(row.idle.series).padStart(5)} ms   warm ${String(row.warm.first).padStart(4)} / ${String(row.warm.series).padStart(5)} ms`);
}
await browser.close(); server.close();
const med = (k, f) => { const v = out.map((r) => r[k][f]).filter((x) => x != null).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
const p90 = (k, f) => { const v = out.map((r) => r[k][f]).filter((x) => x != null).sort((a, b) => a - b); return v[Math.floor(v.length * 0.9)]; };
const summary = Object.fromEntries(["cold", "idle", "warm"].map((k) => [k, { firstMedian: med(k, "first"), seriesMedian: med(k, "series"), seriesP90: p90(k, "series") }]));
console.log("medians (first result / series), ms:", JSON.stringify(summary));
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ dist: DIST, conditions: "390px, 4x CPU, 1.6 Mbps/750 kbps/150 ms", summary, results: out }, null, 1));
