// scripts/seo-check.mjs: the search, citation, feed and app gate. Reads a built dist and fails
// (exit 1) on anything a search engine, an AI assistant, a feed reader or an installing browser
// would trip on. Part of `npm run gates`; plan and reasons in docs/PLAN-seo-pwa.md.
//
//   node scripts/seo-check.mjs [dist]            check (dist defaults to QC_DIST or ./dist)
//   node scripts/seo-check.mjs [dist] --record   also add today's anchors to src/seo/anchors.json
//
// Pages: a title and description each, unique across the site; lang en-IN; a self canonical on
//   every indexable page and noindex on the rest; Open Graph and Twitter tags whose image exists.
// Structured data: every JSON-LD block parses; Datasets meet Google's rules (name, description of
//   50 to 5,000 characters, licence, creator, ISO coverage and dates, downloads that exist);
//   breadcrumbs and @id references point at pages that exist.
// Sitemap: every indexable page exactly once, nothing else; lastmod an ISO date, never the future.
// Anchors: every plate (figure) and numbered section has an id, unique on its page; an anchor once
//   recorded (src/seo/anchors.json) may not disappear, so a cited link keeps working.
// Feeds: well-formed, unique guids, links to real pages; the JSON Feed parses; the release log
//   holds every current print. llms.txt: links resolve; every guide's headline figure and every
//   verified prose paragraph appear exactly as published.
// App: the manifest is complete and its icons exist at their stated sizes; sw.js names a release
//   and every file of its shell exists; _headers keeps sw.js uncached.
// Accessibility that also serves search: every <img> has alt text; every link and button a name.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { SITE } from "../src/site.js";
import { DOSSIERS } from "../src/dossiers/registry.js";
import { headlineOf } from "../src/dossiers/headline.js";
import { guideProse } from "../src/seo/llms.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DIST = path.resolve(args.find((a) => !a.startsWith("--")) ?? process.env.QC_DIST ?? path.join(ROOT, "dist"));
const RECORD = args.includes("--record");
const ANCHORS = path.join(ROOT, "src/seo/anchors.json");
if (!fs.existsSync(path.join(DIST, "index.html"))) { console.error(`seo-check: no build at ${DIST}`); process.exit(1); }

const fails = [];
const fail = (m) => fails.push(m);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const today = new Date().toISOString().slice(0, 10);
const rel = (abs) => abs.startsWith(SITE.url) ? abs.slice(SITE.url.length) : null;
const exists = (p) => {
  const clean = decodeURIComponent(p.split(/[?#]/)[0]);
  const f = path.join(DIST, clean);
  return clean.endsWith("/") ? fs.existsSync(path.join(f, "index.html")) : fs.existsSync(f) || fs.existsSync(path.join(f, "index.html"));
};
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" };
const unesc = (s) => String(s ?? "").replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? (e[0] === "#" ? String.fromCodePoint(+e.slice(1)) : m));

// ---- pages
const pages = [];
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p); else if (e.name.endsWith(".html")) pages.push(p);
} })(DIST);
const urlOf = (f) => "/" + path.relative(DIST, f).replace(/index\.html$/, "").replace(/\\/g, "/");
const titles = new Map(), descs = new Map(), indexable = new Set();
const anchorsNow = {};
let ldBlocks = 0, datasets = 0, noAlt = 0, noName = 0;
const meta = (h, attr, name) => unesc(h.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`))?.[1] ?? "");

for (const f of pages) {
  const url = urlOf(f);
  const h = fs.readFileSync(f, "utf8");
  if (/^\/dossiers\//.test(url)) continue;                       // Astro's redirect stubs; _redirects answers first
  const head = h.slice(0, h.indexOf("</head>") + 7);
  const title = unesc(head.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
  const desc = meta(head, "name", "description");
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(head);
  const canon = head.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
  if (!/<html lang="en-IN"/.test(h)) fail(`${url}: lang is not en-IN`);
  if (!title) fail(`${url}: no <title>`);
  if (!desc || desc.length < 50) fail(`${url}: description missing or under 50 characters`);
  if (!noindex) {
    indexable.add(url);
    (titles.get(title) ?? titles.set(title, []).get(title)).push(url);
    (descs.get(desc) ?? descs.set(desc, []).get(desc)).push(url);
    if (!canon) fail(`${url}: no canonical`);
    else if (canon !== SITE.url + url) fail(`${url}: canonical points elsewhere (${canon})`);
    const og = meta(head, "property", "og:image");
    if (!og || !exists(rel(og) ?? "/missing")) fail(`${url}: og:image missing or not in dist (${og})`);
    if (meta(head, "property", "og:url") !== canon) fail(`${url}: og:url differs from the canonical`);
    for (const k of ["og:title", "og:description", "og:type", "og:locale"]) if (!meta(head, "property", k)) fail(`${url}: no ${k}`);
    if (!meta(head, "name", "twitter:card")) fail(`${url}: no twitter:card`);
  } else if (canon) fail(`${url}: noindex page carries a canonical`);
  if (!/<link rel="manifest" href="\/manifest.webmanifest">/.test(head)) fail(`${url}: no manifest link`);
  if (!/<link rel="alternate" type="application\/rss\+xml"/.test(head)) fail(`${url}: no feed autodiscovery`);

  // structured data
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    ldBlocks++;
    let g; try { g = JSON.parse(m[1]); } catch (e) { fail(`${url}: JSON-LD does not parse (${e.message})`); continue; }
    if (g["@context"] !== "https://schema.org") fail(`${url}: JSON-LD @context is not https://schema.org`);
    for (const node of g["@graph"] ?? [g]) checkNode(url, node);
  }
  // anchors: plates and numbered sections
  const ids = [...h.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) fail(`${url}: duplicate ids ${[...new Set(dup)].slice(0, 5).join(", ")}`);
  const figs = [...h.matchAll(/<figure(\s[^>]*)?>/g)].map((x) => x[1] ?? "");
  const bare = figs.filter((a) => !/\sid="/.test(a)).length;
  if (bare && /^\/(guides|states|learn)\//.test(url)) fail(`${url}: ${bare} figures without an id (no citable anchor)`);
  const secIds = [...h.matchAll(/<section[^>]*\sid="([^"]+)"[^>]*>\s*<div class="sec-head"/g)].map((x) => x[1]);
  const figIds = [...h.matchAll(/<figure[^>]*\sid="([^"]+)"/g)].map((x) => x[1]);
  if (/^\/(guides|states|learn)\/[^/]+\/$/.test(url)) anchorsNow[url] = [...new Set([...secIds, ...figIds])].sort();
  // names: images, links, buttons
  const body = h.replace(/<script\b[\s\S]*?<\/script>/g, "");
  for (const img of body.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(img[0])) noAlt++;
  for (const a of body.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/g)) {
    if (/aria-hidden="true"|\shidden[\s>]/.test(a[2])) continue;
    const text = a[3].replace(/<svg[\s\S]*?<\/svg>/g, (s) => s.match(/aria-label="([^"]+)"/)?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
    if (!text && !/aria-label="[^"]+"|title="[^"]+"/.test(a[2])) { noName++; if (noName <= 5) fail(`${url}: a ${a[1]} with no accessible name: ${a[0].slice(0, 120)}`); }
  }
}
for (const [t, u] of titles) if (u.length > 1) fail(`duplicate title on ${u.length} pages ("${t.slice(0, 80)}"): ${u.slice(0, 3).join(", ")}`);
for (const [t, u] of descs) if (u.length > 1) fail(`duplicate description on ${u.length} pages ("${t.slice(0, 60)}…"): ${u.slice(0, 3).join(", ")}`);
if (noAlt) fail(`${noAlt} images without alt text`);

function checkNode(url, n) {
  const t = n["@type"];
  if (t === "Dataset") {
    datasets++;
    const where = `${url}: Dataset ${n["@id"] ?? n.name}`;
    if (!n.name) fail(`${where}: no name`);
    if (!n.description || n.description.length < 50 || n.description.length > 5000) fail(`${where}: description must be 50 to 5,000 characters (${n.description?.length})`);
    if (!n.license) fail(`${where}: no licence`);
    const creators = [n.creator].flat().filter(Boolean);
    if (!creators.length || creators.some((c) => !c.name || !c["@type"])) fail(`${where}: creator without a type or name`);
    if (n.temporalCoverage && !/^\d{4}-\d{2}-\d{2}(\/\d{4}-\d{2}-\d{2})?$/.test(n.temporalCoverage)) fail(`${where}: temporalCoverage ${n.temporalCoverage} is not an ISO date or interval`);
    for (const k of ["dateModified", "datePublished"]) if (n[k] && (!ISO.test(n[k]) || n[k] > today)) fail(`${where}: ${k} ${n[k]} is not a past ISO date`);
    for (const d of n.distribution ?? []) {
      if (!d.contentUrl || !d.encodingFormat) fail(`${where}: a download without contentUrl or encodingFormat`);
      else if (!exists(rel(d.contentUrl) ?? "/x")) fail(`${where}: download ${d.contentUrl} is not in dist`);
    }
    if (!(n.distribution ?? []).length) fail(`${where}: no downloads`);
    for (const p of n.hasPart ?? []) if (!exists(rel(p["@id"]) ?? "/x")) fail(`${where}: part ${p["@id"]} has no page`);
    if (n.isPartOf && !exists(rel(n.isPartOf["@id"]) ?? "/x")) fail(`${where}: isPartOf ${n.isPartOf["@id"]} has no page`);
  }
  if (t === "BreadcrumbList") {
    const items = n.itemListElement ?? [];
    items.forEach((it, i) => {
      if (it.position !== i + 1) fail(`${url}: breadcrumb positions out of order`);
      if (!it.name) fail(`${url}: breadcrumb step ${i + 1} has no name`);
      if (!it.item || !exists(rel(it.item) ?? "/x")) fail(`${url}: breadcrumb ${it.name} points at ${it.item}, not a page`);
    });
    if (items.at(-1)?.item !== SITE.url + url) fail(`${url}: breadcrumb does not end at the page`);
  }
  if (t === "WebSite") {
    const tpl = n.potentialAction?.target?.urlTemplate;
    if (!tpl?.includes("{search_term_string}") || n.potentialAction["query-input"] !== "required name=search_term_string") fail(`${url}: WebSite SearchAction is malformed`);
  }
  if (t === "Article" && (!n.headline || !n.author?.name || !n.image)) fail(`${url}: Article needs a headline, an author and an image`);
}

// ---- anchors on record
const recorded = fs.existsSync(ANCHORS) ? JSON.parse(fs.readFileSync(ANCHORS, "utf8")) : {};
let lost = 0;
for (const [u, ids] of Object.entries(recorded)) {
  if (!anchorsNow[u]) { if (exists(u)) continue; fail(`anchors: ${u} is on record but no longer built`); lost++; continue; }
  const gone = ids.filter((id) => !anchorsNow[u].includes(id));
  if (gone.length) { lost += gone.length; fail(`anchors: ${u} lost ${gone.join(", ")} (a cited link would break; keep the id, or remove it from src/seo/anchors.json with a reason in the commit)`); }
}
if (RECORD) {
  const merged = { ...recorded };
  for (const [u, ids] of Object.entries(anchorsNow)) merged[u] = [...new Set([...(recorded[u] ?? []), ...ids])].sort();
  fs.writeFileSync(ANCHORS, JSON.stringify(Object.fromEntries(Object.entries(merged).sort()), null, 1) + "\n");
}

// ---- sitemap
const xml = (p) => fs.readFileSync(path.join(DIST, p), "utf8");
const index = xml("sitemap-index.xml");
const listed = new Map();
for (const m of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const body = xml(rel(m[1]));
  for (const u of body.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = u[1].match(/<loc>([^<]+)<\/loc>/)[1], lm = u[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    listed.set(rel(loc), (listed.get(rel(loc)) ?? 0) + 1);
    if (lm && !/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/.test(lm)) fail(`sitemap: ${loc} lastmod ${lm} is not ISO`);
    if (lm && lm.slice(0, 10) > today) fail(`sitemap: ${loc} lastmod ${lm} is in the future`);
  }
}
for (const u of indexable) if (!listed.has(u)) fail(`sitemap: ${u} is indexable but not listed`);
for (const [u, k] of listed) { if (k > 1) fail(`sitemap: ${u} listed ${k} times`); if (!indexable.has(u)) fail(`sitemap: ${u} is listed but not an indexable page`); }

// ---- robots
const robots = xml("robots.txt");
if (!robots.includes(`Sitemap: ${SITE.url}/sitemap-index.xml`)) fail("robots.txt: no Sitemap line");
if (/^Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt: disallows the whole site");

// ---- feeds
const parseXML = (p) => {
  const doc = new JSDOM(xml(p), { contentType: "application/xml" }).window.document;
  if (doc.querySelector("parsererror")) { fail(`${p}: not well-formed XML`); return null; }
  return doc;
};
const feeds = ["rss.xml", "feeds/releases.xml", ...DOSSIERS.map((d) => `guides/${d.slug}/feed.xml`)];
for (const p of feeds) {
  if (!fs.existsSync(path.join(DIST, p))) { fail(`feeds: /${p} missing`); continue; }
  const doc = parseXML(p); if (!doc) continue;
  if (!/<\?xml-stylesheet type="text\/css" href="\/feeds\/feed.css"\?>/.test(xml(p))) fail(`feeds: /${p} has no browser stylesheet`);
  const guids = [...doc.querySelectorAll("item > guid")].map((g) => g.textContent);
  if (new Set(guids).size !== guids.length) fail(`feeds: /${p} repeats a guid`);
  for (const l of doc.querySelectorAll("item > link")) if (!exists(rel(l.textContent) ?? "/x")) fail(`feeds: /${p} links ${l.textContent}, not a page`);
  if (p !== "rss.xml" && !doc.querySelectorAll("item").length) fail(`feeds: /${p} has no items`);
}
try {
  const jf = JSON.parse(xml("feeds/releases.json"));
  if (jf.version !== "https://jsonfeed.org/version/1.1" || !jf.items?.length || jf.items.some((i) => !i.id || !i.url)) fail("feeds: releases.json is not a complete JSON Feed 1.1");
} catch (e) { fail(`feeds: releases.json does not parse (${e.message})`); }
if (!fs.existsSync(path.join(DIST, "feeds/feed.css"))) fail("feeds: /feeds/feed.css missing");
try { execFileSync(process.execPath, [path.join(ROOT, "scripts/releases.mjs"), "--check"], { stdio: "pipe" }); }
catch (e) { fail(String(e.stderr || e.message).trim()); }

// ---- llms.txt
const llms = xml("llms.txt"), full = xml("llms-full.txt");
for (const m of (llms + full).matchAll(/\]\((https:[^)\s]+)\)/g)) if (rel(m[1]) !== null && !/<file>/.test(m[1]) && !exists(rel(m[1]))) fail(`llms: link ${m[1]} is not a page`);
for (const d of DOSSIERS) {
  const h = headlineOf(d);
  if (!llms.includes(`Latest: ${h.value}, ${h.what}`)) fail(`llms.txt: ${d.slug}'s headline figure (${h.value}) is missing or differs`);
  for (const s of guideProse(d.slug)) for (const p of s.paras) if (!full.includes(p)) fail(`llms-full.txt: ${d.slug} ${s.id} differs from the verified prose`);
}

// ---- the app
let man;
try { man = JSON.parse(xml("manifest.webmanifest")); } catch (e) { fail(`manifest: does not parse (${e.message})`); }
if (man) {
  for (const k of ["id", "name", "short_name", "start_url", "scope", "display", "theme_color", "background_color", "icons"]) if (!man[k]) fail(`manifest: no ${k}`);
  if (man.display !== "standalone") fail("manifest: display is not standalone");
  if (!man.start_url.startsWith(man.scope)) fail("manifest: start_url outside scope");
  const png = (p) => { const b = fs.readFileSync(path.join(DIST, p)); return b.readUInt32BE(16) + "x" + b.readUInt32BE(20); };
  for (const i of man.icons) {
    if (!exists(i.src)) { fail(`manifest: icon ${i.src} missing`); continue; }
    if (i.type === "image/png" && png(i.src) !== i.sizes) fail(`manifest: icon ${i.src} is ${png(i.src)}, says ${i.sizes}`);
  }
  for (const need of ["192x192", "512x512"]) for (const purpose of ["any", "maskable"])
    if (!man.icons.some((i) => i.sizes === need && i.purpose === purpose)) fail(`manifest: no ${purpose} icon at ${need}`);
  for (const s of man.shortcuts ?? []) if (!exists(s.url.split("#")[0])) fail(`manifest: shortcut ${s.name} points at ${s.url}, not a page`);
}
const sw = fs.existsSync(path.join(DIST, "sw.js")) ? xml("sw.js") : "";
if (!sw) fail("sw.js missing");
else {
  if (/__BUILD__|__SHELL__/.test(sw)) fail("sw.js: release id or shell not filled in");
  const shell = JSON.parse(sw.match(/const SHELL = (\[[^\n]*\]);/)?.[1] ?? "[]");
  if (!shell.includes("/offline/")) fail("sw.js: the offline page is not in the shell");
  for (const s of shell) if (!exists(s)) fail(`sw.js: shell file ${s} is not in dist`);
}
const headers = xml("_headers");
if (!/\/sw\.js\s*\n\s*Cache-Control: no-cache/.test(headers)) fail("_headers: sw.js is not served uncached");

console.log(`seo-check: ${pages.length.toLocaleString("en-IN")} pages, ${indexable.size.toLocaleString("en-IN")} indexable, ${ldBlocks.toLocaleString("en-IN")} JSON-LD blocks, ${datasets.toLocaleString("en-IN")} Datasets, ${listed.size.toLocaleString("en-IN")} sitemap entries, ${feeds.length} feeds, ${Object.values(anchorsNow).flat().length.toLocaleString("en-IN")} anchors${RECORD ? " (recorded)" : ""}`);
if (fails.length) {
  console.error(`seo-check: ${fails.length} failures`);
  for (const f of fails.slice(0, 80)) console.error("  " + f);
  if (fails.length > 80) console.error(`  … and ${fails.length - 80} more`);
  process.exit(1);
}
console.log("seo-check: pass");
