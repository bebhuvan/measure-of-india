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
import os from "node:os";
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
import { buildCpiiw } from "./lib/products/cpiiw.mjs";   // prices (lb/prices)
import { buildWagesRural } from "./lib/products/wagesrural.mjs";
// services guide: five products, one adapter
import { buildServicesIsp, buildServicesNas, buildServicesTrade, buildServicesJobs, buildServicesAsuse } from "./lib/products/services.mjs";
import { buildStates } from "./lib/products/states.mjs";
import { buildOwidClimate } from "./lib/products/owid-climate.mjs";   // climate
import { buildCckp } from "./lib/products/cckp.mjs";                  // climate
import { buildIlostat } from "./lib/products/ilostat.mjs";   // ilo
import { buildRbiRates } from "./lib/products/rbirates.mjs";
// external (lb/external): the External account guide on RBI DBIE
import { buildExternalBop } from "./lib/products/external-bop.mjs";
import { buildExternalFlows } from "./lib/products/external-flows.mjs";
import { buildExternalReer } from "./lib/products/external-reer.mjs";
// credit (lb/credit)
import { buildCredit } from "./lib/products/credit.mjs";
import { buildTradestat } from "./lib/products/tradestat-build.mjs";   // trade (lb/trade)
import { buildDbieTrade } from "./lib/products/dbie-trade.mjs";        // trade (lb/trade)
import { writeSeries } from "./lib/util.mjs";
// bis family session: BIS, RBI house price index, NHB RESIDEX
import { buildBis } from "./lib/products/bis.mjs";
import { buildRbihpi } from "./lib/products/rbihpi.mjs";
import { buildResidex } from "./lib/products/residex.mjs";
// worldbank family (2026-10-09): the WDI catalogue, PIP poverty, UN WPP population
import { buildWdiIndia } from "./lib/products/wdi-india.mjs";
import { buildPip } from "./lib/products/pip.mjs";
import { buildWpp } from "./lib/products/wpp.mjs";

import { buildCore, buildIip1980 } from "./lib/products/industry-dbie.mjs";   // industry (lb/industry)
import { buildHouseholds } from "./lib/products/households.mjs";
import { buildSchools } from "./lib/products/schools.mjs";
import { buildTimeUse } from "./lib/products/time-use.mjs";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const ONLY = args.includes("only") ? args.slice(args.indexOf("only") + 1) : null;
const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
const VINTAGE = new Date().toISOString().slice(0, 10);

// ---- energy expansion ----
import { buildEnergy } from "./lib/products/energy.mjs";
import { buildDigitalAccessProduct } from "./lib/products/digital-access.mjs";
// ---- end energy expansion ----
// farm-households expansion registration
import {buildFarmHouseholds} from "./lib/products/farm-households.mjs";
const REGISTRY = { households: buildHouseholds, schools: buildSchools, cpi: buildCpi, nas: buildNas, wpi: buildWpi, cpialrl: buildCpialrl, plfs: buildPlfs, rbi: buildRbi, isp: buildIsp, iip: buildIip, hces: buildHces, asi: buildAsi, asuse: buildAsuse, aishe: buildAishe, gender: buildGender, mnre: buildMnre, nfhs: buildNfhs, "worldbank-wdi": buildWorldbankWdi, bsr2: buildBsr2, "owid-climate": buildOwidClimate, cckp: buildCckp, ilostat: buildIlostat, rbirates: buildRbiRates };
Object.assign(REGISTRY, {"farm-households": buildFarmHouseholds});
Object.assign(REGISTRY, {"time-use": buildTimeUse});
Object.assign(REGISTRY, {energy: buildEnergy});
// Verified launch archive replay; live source-refresh contract is not yet wired.
Object.assign(REGISTRY, {"digital-access": buildDigitalAccessProduct});
Object.assign(REGISTRY, { bis: buildBis, rbihpi: buildRbihpi, residex: buildResidex });   // bis family session
// services guide
Object.assign(REGISTRY, { "services-isp": buildServicesIsp, "services-nas": buildServicesNas, "services-trade": buildServicesTrade, "services-jobs": buildServicesJobs, "services-asuse": buildServicesAsuse });
// states family session
Object.assign(REGISTRY, { states: buildStates });
Object.assign(REGISTRY, { "wdi-india": buildWdiIndia, pip: buildPip, wpp: buildWpp });   // worldbank family
// external (lb/external)
Object.assign(REGISTRY, { "external-bop": buildExternalBop, "external-flows": buildExternalFlows, "external-reer": buildExternalReer });
// credit (lb/credit)
Object.assign(REGISTRY, { credit: buildCredit });
Object.assign(REGISTRY, { tradestat: buildTradestat, "dbie-trade": buildDbieTrade });   // trade (lb/trade)
Object.assign(REGISTRY, { core: buildCore, "iip-1980": buildIip1980 });   // industry (lb/industry)
Object.assign(REGISTRY, { cpiiw: buildCpiiw, "wages-rural": buildWagesRural });   // prices (lb/prices)
import { buildProfilesNfhs6 } from "./lib/products/profiles-nfhs6.mjs";   // profiles (lb/profiles)
Object.assign(REGISTRY, { "profiles-nfhs6": buildProfilesNfhs6 });   // profiles (lb/profiles)
import { buildPayments } from "./lib/products/payments.mjs";   // payments (lb/payments)
Object.assign(REGISTRY, { payments: buildPayments });   // payments (lb/payments)
import { buildNpci } from "./lib/products/npci.mjs";   // npci (lb/npci)
Object.assign(REGISTRY, { npci: buildNpci });   // npci (lb/npci)
import { buildFarms } from "./lib/products/farms.mjs";   // farms (lb/farms)
Object.assign(REGISTRY, { farms: buildFarms });   // farms (lb/farms)
import { buildBanks } from "./lib/products/banks.mjs";   // banks (lb/banks)
Object.assign(REGISTRY, { banks: buildBanks });   // banks (lb/banks)

import { buildPublicFinance } from "./lib/products/public-finance.mjs";   // public-finance (lb/public-finance)
Object.assign(REGISTRY, { "public-finance": buildPublicFinance });   // public-finance (lb/public-finance)
import { buildMarkets, buildMarketsIssues } from "./lib/products/markets.mjs";   // markets (lb/markets)
Object.assign(REGISTRY, { markets: buildMarkets, "markets-issues": buildMarketsIssues });   // markets (lb/markets)
import { buildMarketsCompanies } from "./lib/products/markets-companies.mjs";   // markets (lb/markets)
Object.assign(REGISTRY, { "markets-companies": buildMarketsCompanies });   // markets (lb/markets)
// markets-rbi: read-only published local RBI corporate holdings.
import { buildMarketsRbi } from "./lib/products/markets-rbi.mjs";
Object.assign(REGISTRY, { "markets-rbi": buildMarketsRbi });
import { buildMarketsHubOnce } from "./lib/products/markets-hub.mjs";   // markets (lb/markets)
Object.assign(REGISTRY, { "markets-hub": buildMarketsHubOnce });   // markets (lb/markets)

import {buildPensionsProduct} from './lib/products/pensions.mjs';
Object.assign(REGISTRY, {pensions:buildPensionsProduct});
// investor-participation is parked (parked/investor-participation/README.md); re-add its product here on revival.

// One product's failure must not starve the rest: collect, continue, and
// exit non-zero at the end so CI still fails on the summary.
const failed = [], held = [];
// A family read from the owner's machine (transport: local: the Data Bank, the PDF parse folder)
// cannot be refreshed where its folder is absent, as in CI. Those products keep their committed
// bundles and are listed as held; they refresh when fetch runs on a machine that has the folder.
// --require-local makes an absent folder a failure again.
const localRoot = (fam) => (fam === "databank" && process.env.INDIA_ATLAS_DATABANK) || String(cfg.families[fam]?.root ?? "").replace(/^~(?=\/)/, os.homedir());
const unavailable = (fam) => cfg.families[fam]?.transport === "local" && !process.argv.includes("--require-local") && !fs.existsSync(localRoot(fam));
for (const [slug, dcfg] of Object.entries(cfg.dossiers)) {
  if (ONLY && !ONLY.includes(slug) && !ONLY.includes(dcfg.product)) continue;
  if (!dcfg.family) throw new Error(`dossier "${slug}" has no family: in data/sources.yml`);
  if (!cfg.families?.[dcfg.family]) throw new Error(`dossier "${slug}" declares unknown family "${dcfg.family}" (not in families: in data/sources.yml)`);
  if (unavailable(dcfg.family)) { held.push(slug); continue; }
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
if (held.length) console.log(`\nheld, local source folder not on this machine (committed bundles kept): ${held.join(", ")}`);
if (failed.length) {
  console.error(`\nfetch finished with ${failed.length} failed product(s): ${failed.join(", ")}`);
  process.exitCode = 1;
}
console.log("fetch complete (live)");
