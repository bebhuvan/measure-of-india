#!/usr/bin/env node
// scripts/fetch.mjs — per-product fetcher registry driven by data/sources.yml.
// Each dossier entry names a product; the registry maps product -> fetcher.
// Usage: node scripts/fetch.mjs [only cpi wpi ...]
//
// Invariants enforced across products:
//  - headline aggregates are computed from components via real weights,
//    never taken from a published aggregate (cpi, wpi);
//  - growth rates are computed from constant-price / index LEVELS, never
//    taken from the API's rounded growth fields (nas, cpialrl);
//  - series on different base years are never spliced (base-year rule);
//  - raw level dumps are the audit trail; revisions archive the previous
//    vintage instead of overwriting it (scripts/lib/util.mjs writeRaw).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { buildCpi } from "./lib/products/cpi.mjs";
import { buildNas } from "./lib/products/nas.mjs";
import { buildWpi } from "./lib/products/wpi.mjs";
import { buildCpialrl } from "./lib/products/cpialrl.mjs";
import { buildPlfs } from "./lib/products/plfs.mjs";
import { buildRbi } from "./lib/products/rbi.mjs";
import { buildIsp } from "./lib/products/isp.mjs";
import { buildIip } from "./lib/products/iip.mjs";
import { buildHces } from "./lib/products/hces.mjs";
import { buildAsi } from "./lib/products/asi.mjs";
import { buildAsuse } from "./lib/products/asuse.mjs";
import { buildAishe } from "./lib/products/aishe.mjs";
import { buildGender } from "./lib/products/gender.mjs";
import { buildMnre } from "./lib/products/mnre.mjs";
import { buildNfhs } from "./lib/products/nfhs.mjs";
import { buildWorldbankWdi } from "./lib/products/worldbank-wdi.mjs";
import { buildBsr2 } from "./lib/products/bsr2.mjs";
// services guide: five products, one adapter
import { buildServicesIsp, buildServicesNas, buildServicesTrade, buildServicesJobs, buildServicesAsuse } from "./lib/products/services.mjs";
import { buildStates } from "./lib/products/states.mjs";
import { writeSeries } from "./lib/util.mjs";
// bis family session: BIS, RBI house price index, NHB RESIDEX
import { buildBis } from "./lib/products/bis.mjs";
import { buildRbihpi } from "./lib/products/rbihpi.mjs";
import { buildResidex } from "./lib/products/residex.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const ONLY = args.includes("only") ? args.slice(args.indexOf("only") + 1) : null;
const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
const VINTAGE = new Date().toISOString().slice(0, 10);

const REGISTRY = { cpi: buildCpi, nas: buildNas, wpi: buildWpi, cpialrl: buildCpialrl, plfs: buildPlfs, rbi: buildRbi, isp: buildIsp, iip: buildIip, hces: buildHces, asi: buildAsi, asuse: buildAsuse, aishe: buildAishe, gender: buildGender, mnre: buildMnre, nfhs: buildNfhs, "worldbank-wdi": buildWorldbankWdi, bsr2: buildBsr2 };
Object.assign(REGISTRY, { bis: buildBis, rbihpi: buildRbihpi, residex: buildResidex });   // bis family session
// services guide
Object.assign(REGISTRY, { "services-isp": buildServicesIsp, "services-nas": buildServicesNas, "services-trade": buildServicesTrade, "services-jobs": buildServicesJobs, "services-asuse": buildServicesAsuse });
// states family session
Object.assign(REGISTRY, { states: buildStates });

// One product's failure must not starve the rest: collect, continue, and
// exit non-zero at the end so CI still fails on the summary.
const failed = [];
for (const [slug, dcfg] of Object.entries(cfg.dossiers)) {
  if (ONLY && !ONLY.includes(slug) && !ONLY.includes(dcfg.product)) continue;
  if (!dcfg.family) throw new Error(`dossier "${slug}" has no family: in data/sources.yml`);
  if (!cfg.families?.[dcfg.family]) throw new Error(`dossier "${slug}" declares unknown family "${dcfg.family}" (not in families: in data/sources.yml)`);
  const fetcher = REGISTRY[dcfg.product];
  if (!fetcher) throw new Error(`no fetcher registered for product "${dcfg.product}" (dossier ${slug})`);
  console.log(`\n== ${slug} (${dcfg.product}) ==`);
  try {
    await fetcher(ROOT, dcfg, VINTAGE, cfg);
  } catch (err) {
    failed.push(slug);
    console.error(`FAILED: ${slug}: ${err.message}`);
  }
}
if (failed.length) {
  console.error(`\nfetch finished with ${failed.length} failed product(s): ${failed.join(", ")}`);
  process.exitCode = 1;
}
console.log("fetch complete (live)");
