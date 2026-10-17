// Masthead fit gate: the site header must sit inside its column at every screen width.
//   node scripts/masthead-fit.mjs [dist] [--from 320] [--to 1600]
// Steps the viewport one pixel at a time over a few page kinds (each carries the same header,
// but the dateline differs) and fails on any width where a header part runs past the column,
// the name touches the nav or search, or the page scrolls sideways. The name, Beta mark and
// tagline come from src/site.js, so a longer name or one more nav item is caught here, not by readers.
// ATLAS_CHROME_CHANNEL=chrome uses an installed Google Chrome, as perf-browser does.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : Number(args[i + 1]); };
const DIST = path.resolve(args.find((a, i) => !a.startsWith("--") && !["--from", "--to"].includes(args[i - 1])) ?? process.env.QC_DIST ?? path.join(ROOT, "dist"));
const FROM = opt("--from", 320), TO = opt("--to", 1600);
const PAGES = ["/", "/guides/cpi/", "/states/bihar/"]; // every page shares the header; these differ in dateline

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };
const server = http.createServer((req, res) => {
  let f = path.join(DIST, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
  if (!fs.existsSync(f)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] ?? "application/octet-stream" }).end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// one measurement: what is wrong with the header at the current width, or null
const MEASURE = () => {
  const box = (s) => { const e = document.querySelector(s); if (!e || getComputedStyle(e).display === "none") return null; const r = e.getBoundingClientRect(); return r.width ? r : null; };
  const col = box(".sh-in"), brand = box(".brand"), nav = box(".sh-nav"), search = box(".sh-search");
  if (!col || !brand) return "no masthead";
  const bad = [];
  // on phones the nav is a strip that scrolls sideways and runs to the screen edge on purpose
  const navScrolls = nav && /auto|scroll/.test(getComputedStyle(document.querySelector(".sh-nav")).overflowX);
  const edge = (n) => (n === "nav" && navScrolls ? document.documentElement.clientWidth : col.right);
  for (const [n, r] of [["name", brand], ["nav", nav], ["search", search]]) if (r && r.right > edge(n) + 0.5) bad.push(`${n} ${Math.round(r.right - edge(n))}px past the ${n === "nav" && navScrolls ? "screen" : "column"}`);
  const hit = (a, b) => a && b && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  if (hit(brand, nav)) bad.push("name overlaps the nav");
  if (hit(brand, search)) bad.push("name overlaps search");
  const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
  if (sw > cw) bad.push(`page scrolls sideways by ${sw - cw}px`);
  return bad.length ? bad.join("; ") : null;
};

const browser = await chromium.launch({ ...(process.env.ATLAS_CHROME_CHANNEL ? { channel: process.env.ATLAS_CHROME_CHANNEL } : {}), args: ["--no-sandbox"] });
let failures = 0;
try {
  const page = await browser.newPage({ viewport: { width: TO, height: 700 } });
  for (const url of PAGES) {
    await page.goto(BASE + url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const runs = []; // consecutive failing widths with the same reason, reported as one range
    for (let w = FROM; w <= TO; w++) {
      await page.setViewportSize({ width: w, height: 700 });
      const why = await page.evaluate(MEASURE);
      const last = runs.at(-1);
      if (why && last && last.why === why.replace(/\d+px/g, "Npx") && last.to === w - 1) { last.to = w; last.worst = why; }
      else if (why) runs.push({ from: w, to: w, why: why.replace(/\d+px/g, "Npx"), worst: why });
    }
    for (const r of runs) { failures++; console.log(`  ${url} ${r.from === r.to ? r.from : `${r.from}-${r.to}`}px: ${r.worst}`); }
  }
} finally { await browser.close(); server.close(); }

if (failures) { console.log(`masthead-fit: ${failures} failing width range(s) over ${FROM}-${TO}px`); process.exit(1); }
console.log(`  ok: masthead fits its column at every width ${FROM}-${TO}px on ${PAGES.length} page kinds`);
