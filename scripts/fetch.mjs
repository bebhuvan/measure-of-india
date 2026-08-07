#!/usr/bin/env node
// scripts/fetch.mjs — per-product fetcher registry driven by data/sources.yml.
// Each dossier entry names a product; the registry maps product -> fetcher.
// Usage: node scripts/fetch.mjs [--mock] [only cpi wpi ...]
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
import { writeJson } from "./lib/util.mjs";
import { mockCpi, mockGdp, mockWpi, mockCpialrl, mockCpialrlGroups, mockPlfs, mockPlfsStates, mockGdpExp, mockRbi, mockRbiExtended, mockIsp, mockIip, mockCpiSectors, mockCpiSubgroups, mockCpiStates, mockCpiStatesSectors, mockGdpAccounts, mockWpiGroups, mockWpiSubgroups, mockPlfsCutsAnnual, mockCpialrlStates } from "./lib/mock.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((a) => a !== "--mock");
const MOCK = process.argv.includes("--mock");
const ONLY = args.includes("only") ? args.slice(args.indexOf("only") + 1) : null;
const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
const VINTAGE = new Date().toISOString().slice(0, 10);

// hces/asi/asuse are live-only (no mock generators): the --mock branch below
// simply never emits them, which is fine — validate is run against live bakes.
const REGISTRY = { cpi: buildCpi, nas: buildNas, wpi: buildWpi, cpialrl: buildCpialrl, plfs: buildPlfs, rbi: buildRbi, isp: buildIsp, iip: buildIip, hces: buildHces, asi: buildAsi, asuse: buildAsuse };

if (MOCK) {
  const meta = (dossier, extra) => ({
    dossier, source: "MOCK generator", vintage: VINTAGE, mock: true, revisionPolicy: "mock", ...extra,
  });
  const cpi = mockCpi();
  writeJson(ROOT, "data/series/cpi.json", {
    meta: meta("cpi", { frequency: "monthly", base: "2012=100", latestPeriod: cpi.dates.at(-1).slice(0, 7), releaseDate: "2026-01-12" }),
    ...cpi,
  });
  const sectors = mockCpiSectors();
  writeJson(ROOT, "data/series/cpi-rural.json", {
    meta: meta("cpi", { frequency: "monthly", base: "2012=100", latestPeriod: sectors.rural.dates.at(-1).slice(0, 7), releaseDate: "2026-01-12", coverage: "All India, rural" }),
    ...sectors.rural,
  });
  writeJson(ROOT, "data/series/cpi-urban.json", {
    meta: meta("cpi", { frequency: "monthly", base: "2012=100", latestPeriod: sectors.urban.dates.at(-1).slice(0, 7), releaseDate: "2026-01-12", coverage: "All India, urban" }),
    ...sectors.urban,
  });
  writeJson(ROOT, "data/series/cpi-subgroups.json", {
    meta: meta("cpi", { frequency: "monthly", base: "2012=100", latestPeriod: "2025-12", releaseDate: "2026-01-12", coverage: "All India, Combined; sub-groups" }),
    ...mockCpiSubgroups(),
  });
  writeJson(ROOT, "data/series/cpi-states.json", {
    meta: meta("cpi", { frequency: "monthly", base: "2012=100", latestPeriod: "2025-12", releaseDate: "2026-01-12", coverage: "States/UTs, Combined; published General index" }),
    ...mockCpiStates(),
  });
  writeJson(ROOT, "data/series/cpi-states-sectors.json", {
    meta: meta("cpi", { frequency: "monthly", base: "2012=100", latestPeriod: "2025-12", releaseDate: "2026-01-12", coverage: "States/UTs, Rural and Urban; published General index" }),
    ...mockCpiStatesSectors(),
  });
  const gdp = mockGdp();
  writeJson(ROOT, "data/series/gdp.json", {
    meta: meta("gdp", { frequency: "quarterly", base: "2011-12", latestPeriod: gdp.dates.at(-1).slice(0, 7), releaseDate: "2025-11-28" }),
    ...gdp,
  });
  writeJson(ROOT, "data/series/gdp-expenditure.json", {
    meta: meta("gdp", { frequency: "quarterly", base: "2011-12", latestPeriod: gdp.dates.at(-1).slice(0, 7), releaseDate: "2025-11-28" }),
    ...mockGdpExp(),
  });
  writeJson(ROOT, "data/series/gdp-accounts.json", {
    meta: meta("gdp", { frequency: "annual", base: "2011-12", latestPeriod: mockGdpAccounts().dates.at(-1).slice(0, 7), releaseDate: "2025-11-28" }),
    ...mockGdpAccounts(),
  });
  writeJson(ROOT, "data/series/wpi.json", {
    meta: meta("wpi", { frequency: "monthly", base: "2011-12=100", latestPeriod: "2025-12", releaseDate: "2026-01-14" }),
    ...mockWpi(),
  });
  writeJson(ROOT, "data/series/wpi-groups.json", {
    meta: meta("wpi", { frequency: "monthly", base: "2011-12=100", latestPeriod: "2025-12", releaseDate: "2026-01-14", coverage: "2-digit groups" }),
    ...mockWpiGroups(),
  });
  writeJson(ROOT, "data/series/wpi-subgroups.json", {
    meta: meta("wpi", { frequency: "monthly", base: "2011-12=100", latestPeriod: "2025-12", releaseDate: "2026-01-14", coverage: "sub-groups" }),
    ...mockWpiSubgroups(),
  });
  const alrl = mockCpialrl();
  writeJson(ROOT, "data/series/cpialrl-1986.json", {
    meta: meta("cpialrl", { frequency: "monthly", base: "1986-87=100", latestPeriod: alrl.b86.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...alrl.b86,
  });
  writeJson(ROOT, "data/series/cpialrl-2019.json", {
    meta: meta("cpialrl", { frequency: "monthly", base: "2019=100", latestPeriod: alrl.b19.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...alrl.b19,
  });
  const alrlStates = mockCpialrlStates();
  writeJson(ROOT, "data/series/cpialrl-states-1986.json", {
    meta: meta("cpialrl", { frequency: "monthly", base: "1986-87=100", latestPeriod: alrlStates.b86.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "States/UTs" }),
    ...alrlStates.b86,
  });
  writeJson(ROOT, "data/series/cpialrl-states-2019.json", {
    meta: meta("cpialrl", { frequency: "monthly", base: "2019=100", latestPeriod: alrlStates.b19.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "States/UTs" }),
    ...alrlStates.b19,
  });
  writeJson(ROOT, "data/series/cpialrl-groups-2019.json", {
    meta: meta("cpialrl", { frequency: "monthly", base: "2019=100", latestPeriod: alrl.b19.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "All India, Group Index (AL)" }),
    ...mockCpialrlGroups(),
  });
  const plfs = mockPlfs();
  writeJson(ROOT, "data/series/plfs-monthly.json", {
    meta: meta("plfs", { frequency: "monthly", base: "survey 2017-18 onward", latestPeriod: plfs.monthly.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "All India, 15 years and above, person, rural + urban, CWS" }),
    ...plfs.monthly,
  });
  writeJson(ROOT, "data/series/plfs-quarterly.json", {
    meta: meta("plfs", { frequency: "quarterly", base: "survey 2017-18 onward", latestPeriod: plfs.quarterly.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "All India, 15 years and above, person, urban, CWS" }),
    ...plfs.quarterly,
  });
  const plfsExtra = mockPlfsCutsAnnual(plfs.monthly.dates);
  writeJson(ROOT, "data/series/plfs-cuts.json", {
    meta: meta("plfs", { frequency: "monthly", base: "survey 2017-18 onward", latestPeriod: plfs.monthly.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "gender × sector cuts" }),
    ...plfsExtra.cutsBundle,
  });
  writeJson(ROOT, "data/series/plfs-annual.json", {
    meta: meta("plfs", { frequency: "annual", base: "survey 2017-18 onward", latestPeriod: plfsExtra.annualBundle.dates.at(-1).slice(0, 7), releaseDate: null, coverage: "agriculture years" }),
    ...plfsExtra.annualBundle,
  });
  writeJson(ROOT, "data/series/plfs-states.json", {
    meta: meta("plfs", { frequency: "annual", base: "survey 2017-18 onward", latestPeriod: "2023-07", releaseDate: null, coverage: "States/UTs, UR, CWS + PS+SS" }),
    ...mockPlfsStates(),
  });
  const rbi = mockRbi();
  writeJson(ROOT, "data/series/rbi-trade.json", {
    meta: meta("rbi", { frequency: "monthly", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbi.trade.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbi.trade,
  });
  writeJson(ROOT, "data/series/rbi-forex.json", {
    meta: meta("rbi", { frequency: "monthly", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbi.forex.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbi.forex,
  });
  const rbiX = mockRbiExtended();
  writeJson(ROOT, "data/series/rbi-trade-oil.json", {
    meta: meta("rbi", { frequency: "monthly", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbiX.tradeOil.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbiX.tradeOil,
  });
  writeJson(ROOT, "data/series/rbi-bop.json", {
    meta: meta("rbi", { frequency: "quarterly", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbiX.bop.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbiX.bop,
  });
  writeJson(ROOT, "data/series/rbi-bop-ratios.json", {
    meta: meta("rbi", { frequency: "annual", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbiX.bopRatios.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbiX.bopRatios,
  });
  writeJson(ROOT, "data/series/rbi-debt.json", {
    meta: meta("rbi", { frequency: "annual", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbiX.debt.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbiX.debt,
  });
  writeJson(ROOT, "data/series/rbi-nri.json", {
    meta: meta("rbi", { frequency: "monthly", base: "as published (US$ Millions; ₹ per US$)", latestPeriod: rbiX.nri.dates.at(-1).slice(0, 7), releaseDate: null }),
    ...rbiX.nri,
  });
  writeJson(ROOT, "data/series/isp.json", {
    meta: meta("isp", { frequency: "monthly", base: "2024-25=100", latestPeriod: mockIsp().dates.at(-1).slice(0, 7), releaseDate: null }),
    ...mockIsp(),
  });
  const iip = mockIip();
  writeJson(ROOT, "data/series/iip-2011.json", {
    meta: meta("iip", { frequency: "monthly", base: "2011-12=100", latestPeriod: "2025-12", releaseDate: null }),
    ...iip.top,
  });
  writeJson(ROOT, "data/series/iip-industries-2011.json", {
    meta: meta("iip", { frequency: "monthly", base: "2011-12=100", latestPeriod: "2025-12", releaseDate: null, coverage: "2-digit industries" }),
    ...iip.ind,
  });
  writeJson(ROOT, "data/series/iip-2022.json", {
    meta: meta("iip", { frequency: "monthly", base: "2022-23=100", latestPeriod: "2025-12", releaseDate: null }),
    ...iip.top22,
  });
  writeJson(ROOT, "data/series/iip-industries-2022.json", {
    meta: meta("iip", { frequency: "monthly", base: "2022-23=100", latestPeriod: "2025-12", releaseDate: null, coverage: "2-digit industries" }),
    ...iip.ind22,
  });
} else {
  for (const [slug, dcfg] of Object.entries(cfg.dossiers)) {
    if (ONLY && !ONLY.includes(slug) && !ONLY.includes(dcfg.product)) continue;
    const fetcher = REGISTRY[dcfg.product];
    if (!fetcher) throw new Error(`no fetcher registered for product "${dcfg.product}" (dossier ${slug})`);
    console.log(`\n== ${slug} (${dcfg.product}) ==`);
    await fetcher(ROOT, dcfg, VINTAGE);
  }
}
console.log("fetch complete", MOCK ? "(mock)" : "(live)");
