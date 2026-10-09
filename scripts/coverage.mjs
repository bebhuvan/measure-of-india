#!/usr/bin/env node
// scripts/coverage.mjs — the omission gate (docs/CONTRACT-coverage.md).
//
// For every family ledger in data/coverage/<family>.yml, checks that each item of the
// generated source catalogue is decided by a rule (shown / baked / excluded / blocked),
// that every rule still matches something, and that named bundles and series exist.
// --strict also requires every registered guide to sit under some ledger (the launch bar).
//
// Exit 1 on any failure.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COV = path.join(ROOT, "data", "coverage");
const SERIES = path.join(ROOT, "data", "series");
const strict = process.argv.includes("--strict");

const STATUSES = new Set(["shown", "baked", "excluded", "blocked"]);
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };
const ok = (m) => console.log("  ok:", m);

// glob over colon-separated ids: '*' matches any run of characters (including ':').
const toRegex = (g) => new RegExp("^" + g.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
const asList = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);

const bundleCache = new Map();
function bundle(slug) {
  if (!bundleCache.has(slug)) {
    const p = path.join(SERIES, slug + ".json");
    bundleCache.set(slug, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);
  }
  return bundleCache.get(slug);
}

const ledgers = fs.existsSync(COV) ? fs.readdirSync(COV).filter((f) => /\.ya?ml$/.test(f)).sort() : [];
const guidesCovered = new Set();

for (const file of ledgers) {
  const where = `coverage/${file}`;
  const L = YAML.parse(fs.readFileSync(path.join(COV, file), "utf8")) || {};
  for (const g of asList(L.guides)) guidesCovered.add(g);
  if (!L.catalogue) { fail(`${where}: no catalogue path`); continue; }
  const catPath = path.join(ROOT, L.catalogue);
  if (!fs.existsSync(catPath)) { fail(`${where}: catalogue ${L.catalogue} missing — run its generator`); continue; }
  const cat = JSON.parse(fs.readFileSync(catPath, "utf8"));
  if (!cat.generator) fail(`${where}: catalogue has no "generator" — catalogues are generated, never typed`);
  const items = cat.items || [];
  const ids = new Set();
  for (const it of items) { if (ids.has(it.id)) fail(`${where}: duplicate catalogue id ${it.id}`); ids.add(it.id); }

  const rules = (L.rules || []).map((r, i) => ({ ...r, i, res: asList(r.match).map(toRegex), hits: 0 }));
  for (const r of rules) {
    const tag = `${where} rule ${r.i + 1} (${asList(r.match).join(", ")})`;
    if (!STATUSES.has(r.status)) fail(`${tag}: status "${r.status}" is not one of ${[...STATUSES].join("/")}`);
    if ((r.status === "shown" || r.status === "baked") && !asList(r.bundle).length) fail(`${tag}: ${r.status} needs a bundle`);
    if (r.status === "shown" && !r.plate) fail(`${tag}: shown needs the plate it is drawn on`);
    if ((r.status === "excluded" || r.status === "blocked") && !(typeof r.reason === "string" && r.reason.trim().split(/\s+/).length >= 4))
      fail(`${tag}: ${r.status} needs a reason a reader would accept (a sentence, not a word)`);
    for (const slug of asList(r.bundle)) {
      const b = bundle(slug);
      if (!b) { fail(`${tag}: bundle ${slug} not in data/series/`); continue; }
      for (const s of asList(r.series)) if (!b.series?.[s]) fail(`${tag}: series ${s} not in bundle ${slug}`);
    }
  }

  const tally = { shown: 0, baked: 0, excluded: 0, blocked: 0 };
  let undecided = [];
  for (const it of items) {
    const r = rules.find((r) => r.res.some((re) => re.test(it.id)));
    if (!r) { undecided.push(it.id); continue; }
    r.hits++;
    if (tally[r.status] != null) tally[r.status]++;
  }
  if (undecided.length) fail(`${where}: ${undecided.length} catalogue item(s) undecided, e.g. ${undecided.slice(0, 5).join(", ")}`);
  for (const r of rules) if (!r.hits) fail(`${where} rule ${r.i + 1} (${asList(r.match).join(", ")}): matches no catalogue item (stale)`);
  ok(`${L.family || file}: ${items.length} items — ${tally.shown} shown, ${tally.baked} baked, ${tally.excluded} excluded, ${tally.blocked} blocked`);
}

// guides without a ledger
const reg = await import(path.join(ROOT, "src/dossiers/registry.js"));
const D = reg.DOSSIERS || reg.default;
const slugs = (Array.isArray(D) ? D : Object.values(D)).map((d) => d.slug);
const missing = slugs.filter((s) => !guidesCovered.has(s));
if (missing.length) {
  const msg = `${missing.length} guide(s) without a coverage ledger: ${missing.join(", ")}`;
  if (strict) fail(msg); else console.log("  warn:", msg, "(fails under --strict, the launch setting)");
}

if (failures) { console.error(`\ncoverage: ${failures} failure(s)`); process.exit(1); }
console.log(`coverage: ${ledgers.length} ledger(s) clean`);
