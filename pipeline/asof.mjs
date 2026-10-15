#!/usr/bin/env node
// pipeline/asof.mjs — the freshness gate for the hand-written "As of"
// paragraphs (.explain .now) in the dossier pages. These paragraphs are dated
// prose with static claims, precisely the ones that narrate the granular
// cuts, and they sit outside the slot system. Each one carries a manifest
// entry (pipeline/asof-manifest.json) declaring the bundle it describes and
// the print (dates.at(-1)) its text was last verified against. When the
// bundle advances, the gate fails — a release may not ship while a hand-written
// reading still describes the previous print.
//
// The refresh flow (after a release, per dossier):
//   1. re-read every flagged block against the new print; edit its stamp and
//      claims where they no longer hold;
//   2. run `node pipeline/asof.mjs --refresh <slug>#<figure-id> ...`
//      (or --refresh-all for the dossier you just reviewed) to record the
//      attestation. New blocks fail the gate until an entry is added —
//      `--scaffold` prints ready-to-paste JSON.
//
// Usage: node pipeline/asof.mjs [--scaffold] [--refresh <id>...] [--refresh-all]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marketsRbiSlices } from '../src/dossiers/markets-rbi.model.js';
import { DOSSIERS } from "../src/dossiers/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "pipeline", "asof-manifest.json");
const argv = process.argv.slice(2);
const REFRESH_ALL = argv.includes("--refresh-all");
const refreshIds = argv.includes("--refresh") ? argv.slice(argv.indexOf("--refresh") + 1).filter((a) => !a.startsWith("--")) : [];
const SCAFFOLD = argv.includes("--scaffold");

// every .now block, parsed from source: { id: "slug#figure", stamp, bundleSlug }
// ---- energy expansion ----
import {energyModel} from "../src/dossiers/energy.model.js";
// ---- end energy expansion ----
import {farmModel} from "../src/dossiers/farm-households.model.js"; // farm-households
function scanBlocks() {
  const blocks = [];
  for (const d of DOSSIERS) {
    const file = path.join(ROOT, "src/pages/guides", d.slug + ".astro");
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, "utf8");
    const figRe = /<figure id="([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/figure>/g;
    let m;
    while ((m = figRe.exec(src))) {
      const now = m[2].match(/<div class="now">\s*<span class="mk">As of (.*?)<\/span>/);
      if (now) blocks.push({ id: d.slug + "#" + m[1], stamp: now[1].trim(), dossier: d.slug });
    }
  }
  // markets-rbi: full-name listed-company plates use the same freshness contract.
  for (const p of marketsRbiSlices(slug => JSON.parse(fs.readFileSync(path.join(ROOT,'data/series',slug+'.json'),'utf8')))) blocks.push({id:`markets#cb-${p.id}`,stamp:"{view.f === 'a' ? fyOf(view.date) : qOf(view.date)}",dossier:'markets'});
  // Programmatic plates declare the same freshness contract as literal figures.
// ---- energy expansion ----
  for(const p of energyModel().plates)blocks.push({id:`energy#cb-${p.id}`,stamp:"{p.period}",dossier:"energy"});
  // ---- end energy expansion ----
  for(const p of farmModel().plates)blocks.push({id:`farm-households#cb-${p.id}`,stamp:"{p.period}",dossier:"farm-households"}); // farm-households
  return blocks;
}

const loadBundle = (slug) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));

const blocks = scanBlocks();
let manifest = {};
try { manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")); } catch {}

// --refresh: attest that the named blocks were re-read against the current print
if (REFRESH_ALL || refreshIds.length) {
  const targets = REFRESH_ALL ? blocks.map((b) => b.id) : refreshIds;
  for (const id of targets) {
    const block = blocks.find((b) => b.id === id);
    const entry = manifest[id];
    if (!block) { console.error(`asof: no .now block "${id}" in any dossier page`); process.exitCode = 1; continue; }
    if (!entry) { console.error(`asof: "${id}" has no manifest entry — add it first (--scaffold)`); process.exitCode = 1; continue; }
    entry.latestDate = loadBundle(entry.bundle).dates.at(-1);
    entry.stamp = block.stamp;
    console.log(`refreshed ${id} → ${entry.bundle} @ ${entry.latestDate}`);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
  if (!process.exitCode) console.log("asof: manifest updated");
  process.exit(process.exitCode ?? 0);
}

let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };

// 1. every block must be governed
const ungoverned = blocks.filter((b) => !manifest[b.id]);
for (const b of ungoverned) fail(`ungoverned "As of" paragraph: ${b.id} (stamp "${b.stamp}") — add a manifest entry`);
if (ungoverned.length && SCAFFOLD) {
  console.error("\nscaffold entries (attribute each block to the bundle it describes):");
  for (const b of ungoverned) {
    console.error(`  "${b.id}": { "bundle": "<bundle-slug>", "latestDate": "<see below>", "stamp": ${JSON.stringify(b.stamp)} },`);
  }
}

// 2. every manifest entry must correspond to a live block
for (const id of Object.keys(manifest)) {
  if (!blocks.some((b) => b.id === id)) fail(`manifest entry "${id}" matches no .now block on any page — remove it`);
}

// 3. every entry must describe the CURRENT print of its bundle
let checked = 0;
for (const [id, entry] of Object.entries(manifest)) {
  if (!manifest.hasOwnProperty(id)) continue;
  let bundle;
  try { bundle = loadBundle(entry.bundle); } catch { fail(`${id}: manifest bundle "${entry.bundle}" is not a baked bundle`); continue; }
  if (!entry.latestDate) { fail(`${id}: manifest entry has no latestDate`); continue; }
  if (bundle.dates.at(-1) !== entry.latestDate) {
    fail(`stale "As of" paragraph: ${id} (stamp "${entry.stamp}") describes ${entry.latestDate} but ${entry.bundle} now serves ${bundle.dates.at(-1)} — re-read the paragraph, then: node pipeline/asof.mjs --refresh ${id}`);
  } else checked++;
}

if (failures) { console.error(`\nasof: ${failures} failure(s)`); process.exit(1); }
console.log(`asof: ${checked} hand-written "As of" paragraphs verified against the current print`);
