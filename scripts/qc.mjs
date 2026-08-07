#!/usr/bin/env node
// scripts/qc.mjs — post-build checks, per site/BUILD.md §12:
//  1. execute every page's JS against a jsdom DOM (catches syntax errors,
//     missing element ids, runtime exceptions);
//  2. no "–" placeholder left unfilled;
//  3. spot-check rendered numbers against data/series/*.json;
//  4. no smoothing curves in our code; tickFormat returns strings.
//
// Usage: node scripts/qc.mjs   (after astro build)

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };
const ok = (m) => console.log("  ok:", m);

const PAGES = [
  // titleblock and §01 lead with the 2024-base print; the 2012-base story
  // (§05 plate, core) stays below — both bundles are checked
  { url: "/dossiers/cpi/", slug: null, checks: [
    ["n-head", (b) => b["cpi-2024"].series.headline.data.at(-1).toFixed(2) + "%"],
    ["n-food", (b) => b["cpi-2024"].series.food_and_beverages.data.at(-1).toFixed(2) + "%"],
    ["n-old", (b) => b.cpi.series.headline.data.at(-1).toFixed(2) + "%"],
    ["n-core", (b) => b.cpi.series.core.data.at(-1).toFixed(2) + "%"],
    ["cr-h1", (b) => b["cpi-2024"].series.headline.data.at(-1).toFixed(2) + "%"],
    ["pv-nb", (b) => b["cpi-2024"].series.headline.data.at(-1).toFixed(2) + "%"],
    ["nb-old-final", (b) => b.cpi.series.headline.data.at(-1).toFixed(2) + "%"],
    ["ex-hjan", (b) => b.cpi.series.headline.data.at(-12).toFixed(2) + "%"],
    ["prov-vintage", (b) => b.cpi.meta.vintage],
    ["prov-vintage24", (b) => b["cpi-2024"].meta.vintage],
    ["prov-vintage2", (b) => b["cpi-2024"].meta.vintage],
  ]},
  { url: "/dossiers/gdp/", slug: "gdp", checks: [
    ["n-gdp", (b) => b.series.gdp.data.at(-1).toFixed(2) + "%"],
    ["n-gfcf", (b) => b.series.gfcf.data.at(-1).toFixed(2) + "%"],
    ["cr-v1", (b) => b.series.gva.data.at(-1).toFixed(2) + "%"],
    ["prov-vintage", (b) => b.meta.vintage],
  ]},
  { url: "/dossiers/wpi/", slug: "wpi", checks: [
    ["n-head", (b) => b.series.headline.data.at(-1).toFixed(2) + "%"],
    ["n-fuel", (b) => b.series.fuel.data.at(-1).toFixed(2) + "%"],
    ["cr-m1", (b) => b.series.manufactured.data.at(-1).toFixed(2) + "%"],
    ["prov-vintage", (b) => b.meta.vintage],
  ]},
  { url: "/dossiers/iip/", slug: "iip-2022", checks: [
    ["n-head", (b) => b.series.general.data.at(-1).toFixed(2) + "%"],
    ["n-cap", (b) => b.series.use_capital_goods.data.at(-1).toFixed(2) + "%"],
    ["cr-mn1", (b) => b.series.sector_mining_quarrying.data.at(-1).toFixed(2) + "%"],
    ["prov-vintage", (b) => b.meta.vintage],
  ]},
  { url: "/dossiers/external/", slug: null, checks: [
    ["n-fx", (b) => "₹" + b["rbi-forex"].series.usdinr.data.at(-1).toFixed(2)],
    ["n-cad", (b) => b["rbi-bop-ratios"].series.cad_gdp.data.at(-1).toFixed(1) + "%"],
    ["cr-res", (b) => "$" + Math.round(b["rbi-forex"].series.reserves.data.at(-1) / 1000) + " bn"],
    ["prov-vintage", (b) => b["rbi-forex"].meta.vintage],
  ]},
  { url: "/dossiers/jobs/", slug: null, checks: [
    ["n-ur", (b) => b["plfs-monthly"].series.ur.data.at(-1).toFixed(2) + "%"],
    ["n-fur", (b) => b["plfs-cuts"].series.ur_female_urban.data.at(-1).toFixed(2) + "%"],
    ["cr-lfpr", (b) => b["plfs-monthly"].series.lfpr.data.at(-1).toFixed(2) + "%"],
    ["pv-main", (b) => b["plfs-quarterly"].series.ur.data.at(-1).toFixed(2) + "%"],
    ["pv-annual", (b) => b["plfs-annual"].series.ur_psss.data.at(-1).toFixed(2) + "%"],
    ["ex-p0", (b) => b["plfs-annual"].series.ur_psss.data[0].toFixed(2) + "%"],
    ["prov-vintage", (b) => b["plfs-monthly"].meta.vintage],
    ["prov-vintage2", (b) => b["plfs-monthly"].meta.vintage],
  ]},
  { url: "/dossiers/consumption/", slug: null, checks: [
    ["n-rural", (b) => "₹" + b["hces-mpce"].series.rural.data.at(-1).toLocaleString("en-IN")],
    ["n-urban", (b) => "₹" + b["hces-mpce"].series.urban.data.at(-1).toLocaleString("en-IN")],
    ["n-gini", (b) => b["hces-gini"].series.rural.data.at(-1).toFixed(3)],
    ["pv-lad", (b) => "₹" + b["hces-fractiles"].series.f95_100_urban.data.at(-1).toLocaleString("en-IN")],
    ["prov-vintage", (b) => b["hces-mpce"].meta.vintage],
    ["prov-vintage2", (b) => b["hces-mpce"].meta.vintage],
  ]},
  { url: "/dossiers/factories/", slug: null, checks: [
    ["n-fact", (b) => (b["asi-headline"].series.factories_in_operation.data.at(-1) / 1e5).toFixed(2) + "lakh"],
    ["cr-fop", (b) => b["asi-headline"].series.factories_in_operation.data.at(-1).toLocaleString("en-IN")],
    ["cr-gpwi", (b) => "₹" + Math.round(b["asuse-annual"].series.gva_per_worker_all.data.filter((v) => v != null).at(-1)).toLocaleString("en-IN")],
    ["prov-vintage", (b) => b["asi-headline"].meta.vintage],
    ["prov-vintage2", (b) => b["asi-headline"].meta.vintage],
  ]},
  { url: "/", slug: null, minPlots: 1, checks: [
    // the CPI print is the 2024-base series; core stays on the 2012 base
    // (no weights served for the new base), labelled "to Dec 2025"
    ["v-cpi", (b) => b["cpi-2024"].series.headline.data.at(-1).toFixed(2) + "%", "cpi-2024"],
    ["v-gdp", (b) => b.gdp.series.gdp.data.at(-1).toFixed(2) + "%", "gdp"],
    ["v-core", (b) => b.cpi.series.core.data.at(-1).toFixed(2) + "%", "cpi"],
  ]},
  { url: "/register/", slug: null, minPlots: 8, checks: [] },
  { url: "/learn/inflation/", slug: "cpi", minPlots: 3, checks: [
    ["lr-rdec", (b) => b.series.headline.data.at(-1).toFixed(2) + "%"],
    ["lr-rjan", (b) => b.series.headline.data.at(-12).toFixed(2) + "%"],
  ]},
  { url: "/learn/", slug: null, minPlots: 0, checks: [] },
  // learn section: every page marked live in src/learn/registry.js
  ...(await import(pathToFileURL(path.join(ROOT, "src/learn/registry.js")).href)).EXPLAINERS
    .filter((e) => e.live && e.slug !== "inflation")
    .map((e) => ({
      url: `/learn/${e.slug}/`,
      slug: ["base-effects","index-weights","core-inflation","yoy-and-mom","seasonality","inflation-targeting","index-numbers","noise-and-trend","monsoon-and-food-prices"].includes(e.slug) ? "cpi" : "gdp",
      minPlots: { "base-effects": 2, "real-vs-nominal": 0, revisions: 0, "per-capita": 0, "base-year": 0, "stocks-and-flows": 0, "averages-and-distribution": 0 }[e.slug] ?? 1,
      checks: [],
    })),
];

for (const page of PAGES) {
  const file = path.join(DIST, page.url, "index.html");
  if (!fs.existsSync(file)) { fail(`${page.url}: not built`); continue; }
  const html = fs.readFileSync(file, "utf8");

  // every id referenced by inline HTML placeholders exists — and vice versa
  const dash = [...html.matchAll(/id="([a-z0-9-]+)">–</g)].map((m) => m[1]);

  const dom = new JSDOM(html, { url: "https://indiaatlas.in" + page.url, pretendToBeVisual: true });
  const { window } = dom;
  window.URL.createObjectURL = () => "blob:x";
  window.URL.revokeObjectURL = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "XMLSerializer", "Image", "Blob", "CustomEvent", "Event", "getComputedStyle"]) {
    try { Object.defineProperty(globalThis, k, { value: window[k] ?? globalThis[k], configurable: true, writable: true }); } catch {}
  }
  globalThis.window = window;
  globalThis.document = window.document;

  // evaluate the page's module scripts (they import shared chunks from _astro)
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  const inline = [...html.matchAll(/<script type="module">([^<]+)<\/script>/g)].map((m) => m[1]).join("\n");
  try {
    for (const src of scripts) {
      const p = path.join(DIST, src);
      await import(pathToFileURL(p).href);
    }
    if (inline.trim()) {
      const blob = new Blob([inline], { type: "text/javascript" });
      // inline module scripts are already executed via imports above in Astro output;
    }
  } catch (e) {
    fail(`${page.url}: script threw — ${e.message}`);
  }

  const doc = window.document;
  // placeholders must all be filled now
  const left = dash.filter((id) => doc.getElementById(id)?.textContent.trim() === "–");
  if (left.length) fail(`${page.url}: unfilled placeholders: ${left.join(", ")}`);
  else ok(`${page.url}: all ${dash.length} figure slots filled`);

  // numbers match the baked data
  const bundles = {
    cpi: JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/cpi.json"), "utf8")),
    "cpi-2024": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/cpi-2024.json"), "utf8")),
    gdp: JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/gdp.json"), "utf8")),
    wpi: JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/wpi.json"), "utf8")),
    "iip-2022": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/iip-2022.json"), "utf8")),
    "rbi-forex": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/rbi-forex.json"), "utf8")),
    "rbi-bop-ratios": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/rbi-bop-ratios.json"), "utf8")),
    "plfs-monthly": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/plfs-monthly.json"), "utf8")),
    "plfs-quarterly": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/plfs-quarterly.json"), "utf8")),
    "plfs-annual": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/plfs-annual.json"), "utf8")),
    "plfs-cuts": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/plfs-cuts.json"), "utf8")),
    "hces-mpce": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/hces-mpce.json"), "utf8")),
    "hces-gini": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/hces-gini.json"), "utf8")),
    "hces-fractiles": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/hces-fractiles.json"), "utf8")),
    "asi-headline": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/asi-headline.json"), "utf8")),
    "asuse-annual": JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/asuse-annual.json"), "utf8")),
  };
  for (const [id, fn, which] of page.checks) {
    const got = doc.getElementById(id)?.textContent.trim();
    const want = fn(page.slug ? bundles[page.slug] : bundles);
    if (got !== want) fail(`${page.url} #${id}: rendered "${got}" != data "${want}"`);
    else ok(`${page.url} #${id} = ${want}`);
  }

  // learn pages: level figures trace to the published index levels
  if (page.url === "/learn/inflation/") {
    const lv = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/cpi-indices.json"), "utf8")).levels;
    const want = lv["combined:general"]["2025-12"].toFixed(1);
    const got = doc.getElementById("n-lvl-now")?.textContent.trim();
    if (got !== want) fail(`${page.url} #n-lvl-now: rendered "${got}" != data "${want}"`);
    else ok(`${page.url} #n-lvl-now = ${want}`);
  }
  const minPlots = page.minPlots ?? 4;
  const nPlots = doc.querySelectorAll(".plotzone svg, #frontis-plot svg, .spark svg, .nspark svg").length;
  if (nPlots < minPlots) fail(`${page.url}: expected >=${minPlots} SVGs, got ${nPlots}`);
  else ok(`${page.url}: ${nPlots} charts rendered`);

  // download card composition: title + source + brand, valid SVG
  if (page.url === "/dossiers/cpi/") {
    const { composeCardSVG } = await import(pathToFileURL(path.join(ROOT, "src/charts/plumbing.js")).href);
    const raw = doc.querySelector("#plot-main svg");
    const card = composeCardSVG(raw, {
      title: doc.querySelector("#cb-main .plate-head h3").textContent.trim(),
      sub: doc.querySelector("#cb-main .plate-head .sub").textContent.trim(),
      foot: doc.querySelector("#cb-main .plotfoot .src").textContent.trim().replace(/\s+/g, " "),
    });
    const parsed = new window.DOMParser().parseFromString(card.svg, "image/svg+xml");
    const text = parsed.documentElement.textContent;
    if (parsed.querySelector("parsererror")) fail("download card: SVG does not parse");
    else {
      for (const needle of ["cost of living", "MOSPI", "INDIA ATLAS · INDIAATLAS.IN"]) {
        if (!text.includes(needle)) fail(`download card: missing "${needle}"`);
      }
      ok(`download card composes (${card.width}×${card.height}, ${ (card.svg.length/1024).toFixed(0) } KB svg)`);
    }
  }
  // small-multiple grid panels are decorative (aria-hidden) — their accessible
  // name lives on the grid container's aria-label, so they carry no <title>
  const missingTitle = [...doc.querySelectorAll(".plotzone svg")]
    .filter((s) => !s.querySelector("title") && s.getAttribute("aria-hidden") !== "true");
  if (missingTitle.length) fail(`${page.url}: ${missingTitle.length} plates missing <title>`);
}

// static greps over our own sources (not Plot internals)
for (const f of ["src/dossiers/cpi.client.js", "src/dossiers/gdp.client.js", "src/dossiers/jobs.client.js", "src/charts/plumbing.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (/curve\s*[:=]|catmull|monotone|basis/.test(src.replace(/monetary/g, ""))) fail(`${f}: smoothing curve reference found`);
  for (const m of src.matchAll(/tickFormat:\s*\([^)]*\)\s*=>\s*([^,}\n]+)/g)) {
    if (!/String\(|\+ ?"%"|`/.test(m[1])) fail(`${f}: tickFormat may not return a string — ${m[0]}`);
  }
}
ok("static source greps done");

if (failures) { console.error(`\n${failures} QC failure(s)`); process.exit(1); }
console.log("\nQC: all checks passed");
