// scripts/search-index.mjs: writes the site search under dist/search/ after a build (run by the
// `atlas-search-index` hook in astro.config.mjs; `node scripts/search-index.mjs [dist]` by hand).
// Formats and the engine that reads them: src/dossiers/search-core.js. Budgets:
// docs/CONTRACT-render.md, checked by scripts/qc.mjs.
//
// Sources, so the index can never disagree with the site:
//   guides    src/dossiers/registry.js
//   plates    the built guide pages: each <figure id> with its plate title (h3) and finding (.sub)
//   bundles   data/series, with the guide and every-cut page each one's rows appear on
//             (src/dossiers/everycut.js everyCutPlan, the plan the pages are built from)
//   series    every row of every bundle, in the order its every-cut pages show them, with the
//             row's anchor (everycut.js rowAnchor) so a result opens on that row
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOSSIERS } from "../src/dossiers/registry.js";
import { everyCutPlan, guideBundles, rowsOf, loadBundle, bundleTitle, cutOf } from "../src/dossiers/everycut.js";
import { tokens, STOP, encodeIds } from "../src/dossiers/search-core.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.resolve(process.argv[2] ?? path.join(ROOT, "dist"));
const OUT = path.join(DIST, "search");
// a token whose coded posting list would pass this many bytes keeps none: it narrows rows another
// word found (search-core.js). Postings are run-length coded, so this is a handful of words.
const FREQUENT_BYTES = 900 * 1024;
// shards and chunks are packed to about this many bytes of JSON (CONTRACT-render: each <= 1 MB)
const PACK = 256 * 1024, PACK_ROWS = 128 * 1024;
const MAX_FILE = 1024 * 1024;

const decode = (s) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/\s+/g, " ").trim();
const round3 = (v) => (v == null ? null : +v.toPrecision(3));
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);

// ----- guides and plates
const guides = DOSSIERS.map((d) => [d.slug, d.title, clip(String(d.blurb ?? d.description ?? ""), 220)]);
const gIdx = Object.fromEntries(DOSSIERS.map((d, i) => [d.slug, i]));
const plates = [];
for (const d of DOSSIERS) {
  const f = path.join(DIST, "guides", d.slug, "index.html");
  if (!fs.existsSync(f)) throw new Error(`search-index: ${f} missing; run after astro build`);
  const html = fs.readFileSync(f, "utf8");
  const re = /<figure id="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/g;
  let m;
  while ((m = re.exec(html))) {
    const h3 = m[2].match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
    if (!h3) continue;
    const sub = m[2].match(/<div class="sub"[^>]*>([\s\S]*?)<\/div>/);
    // a title the page fills in by script ("–" in the HTML) gives way to the finding
    let title = decode(h3[1]), finding = sub ? decode(sub[1]) : "";
    if (!/[a-z0-9]/i.test(title)) [title, finding] = [clip(finding, 100), ""];
    if (!/[a-z0-9]/i.test(title)) continue;
    plates.push([gIdx[d.slug], m[1], title, clip(finding, 200)]);
  }
}

// ----- where every bundle's rows appear: the first guide (registry order) whose plan holds it
const place = new Map();   // bundle -> { guide, seq, rows: [[row, url]] }
let seq = 0;
const views = [];
for (const d of DOSSIERS) {
  const plan = everyCutPlan(d);
  const take = (b, rows, url) => {
    if (place.has(b) && place.get(b).guide !== d.slug) return;
    if (!place.has(b)) place.set(b, { guide: d.slug, seq: seq++, rows: [] });
    for (const r of rows) place.get(b).rows.push([r, url]);
  };
  for (const b of plan.inline) take(b, rowsOf(b), `/guides/${d.slug}/`);
  for (const t of plan.tails) {
    const base = `/guides/${d.slug}/every-cut/${t.id}/`;
    views.push([gIdx[d.slug], t.label, base, t.rows.length]);
    t.pages.forEach((rows, i) => {
      const url = i ? `${base}${i + 1}/` : base;
      const by = new Map();
      for (const r of rows) { if (!by.has(r.bundle)) by.set(r.bundle, []); by.get(r.bundle).push(r); }
      for (const [b, rs] of by) take(b, rs, url);
    });
  }
  void guideBundles;
}

// ----- bundles in order (by guide; within a guide, the order its page shows them: the current
// bundle and the registry's list inline first, then the long-tail views), rows in page order.
// Row order is the engine's tie-break, so a guide's headline series come before its long tail.
const all = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
const order = [...all.filter((b) => place.has(b)).sort((a, b) => place.get(a).seq - place.get(b).seq), ...all.filter((b) => !place.has(b))];
const bundles = [];
const rows = [];
const post = new Map();   // token -> row ids
for (const b of order) {
  const B = loadBundle(b);
  const p = place.get(b);
  const list = p ? p.rows : rowsOf(b).map((r) => [r, null]);
  const start = rows.length;
  const segs = [];
  list.forEach(([r, url], k) => { if (url && segs.at(-1)?.[1] !== url) segs.push([k, url]); });
  for (const [r] of list) {
    const s = B.series[r.key];
    let li = s.data.length - 1; while (li >= 0 && s.data[li] == null) li--;
    const recent = li < 0 ? [] : s.data.slice(Math.max(0, li - 11), li + 1).map(round3);
    const id = rows.length;
    rows.push([r.label, r.group || "", r.latestText, r.period + (r.estimated ? ", est." : ""), r.id, recent]);
    for (const t of new Set(tokens(r.label + " " + (r.group || "")))) {
      if (STOP.has(t)) continue;
      if (!post.has(t)) post.set(t, []);
      post.get(t).push(id);
    }
  }
  const m = B.meta ?? {};
  const ctx = clip([m.product || m.source, m.base && m.base !== "null" ? `base ${m.base}` : null, m.frequency].filter(Boolean).join(", "), 120);
  bundles.push([b, bundleTitle(b), list[0]?.[0].cut ?? cutOf(b), p ? gIdx[p.guide] : -1, start, list.length, segs, ctx]);
}

// ----- shards
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, "t"), { recursive: true });
fs.mkdirSync(path.join(OUT, "r"), { recursive: true });
const frequent = [];
const toks = [...post.keys()].sort();
const tFirst = [];
let cur = {}, curBytes = 2, n = 0;
const flushT = () => { if (!Object.keys(cur).length) return; fs.writeFileSync(path.join(OUT, "t", `${n++}.json`), JSON.stringify(cur)); cur = {}; curBytes = 2; };
for (const t of toks) {
  const d = encodeIds(post.get(t));
  const entry = JSON.stringify(t) + ":" + JSON.stringify(d) + ",";
  if (entry.length > FREQUENT_BYTES) { frequent.push(t); continue; }
  if (curBytes + entry.length > PACK && Object.keys(cur).length) flushT();
  if (!Object.keys(cur).length) tFirst.push(t);
  cur[t] = d; curBytes += entry.length;
}
flushT();
const rFirst = [];
let chunk = [], cBytes = 2, cn = 0;
const flushR = () => { if (!chunk.length) return; fs.writeFileSync(path.join(OUT, "r", `${cn++}.json`), JSON.stringify(chunk)); chunk = []; cBytes = 2; };
rows.forEach((r, i) => {
  const s = JSON.stringify(r).length + 1;
  if (cBytes + s > PACK_ROWS && chunk.length) flushR();
  if (!chunk.length) rFirst.push(i);
  chunk.push(r); cBytes += s;
});
flushR();
// the first shard must answer for any word sorting before its first token
if (tFirst.length) tFirst[0] = "";

// ---- profiles (lb/profiles): every state and UT profile, with each spelling the state key knows
// (Orissa, Pondicherry, NCT of Delhi), so a state's name finds its profile first
const { STATES } = await import("../src/dossiers/states-key.js");
const profiles = STATES.map((u) => [u.slug, u.name, [...new Set([u.short, ...u.aliases].filter(Boolean))].join(" | ")]);
// ---- end profiles
const core = { v: 1, built: new Date().toISOString().slice(0, 10), nSeries: rows.length, guides, plates, bundles, views, profiles,
  shards: { tokens: tFirst, rows: rFirst, frequent: frequent.sort() } };
fs.writeFileSync(path.join(OUT, "core.json"), JSON.stringify(core));

// sizes, for the log; qc enforces the budgets
let big = 0, tot = 0, nf = 0;
for (const dir of ["t", "r"]) for (const f of fs.readdirSync(path.join(OUT, dir))) { const s = fs.statSync(path.join(OUT, dir, f)).size; tot += s; nf++; big = Math.max(big, s); if (s > MAX_FILE) throw new Error(`search-index: ${dir}/${f} is ${(s / 1e6).toFixed(2)} MB, over 1 MB`); }
const coreBytes = fs.statSync(path.join(OUT, "core.json")).size;
console.log(`search index: ${rows.length.toLocaleString("en-IN")} series, ${plates.length} plates, ${bundles.length} files; core ${(coreBytes / 1024).toFixed(0)} KB; ${tFirst.length} token shards + ${rFirst.length} row chunks (${(tot / 1e6).toFixed(1)} MB, largest ${(big / 1024).toFixed(0)} KB); ${frequent.length} frequent words without postings`);
