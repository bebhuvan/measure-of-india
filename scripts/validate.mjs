#!/usr/bin/env node
// scripts/validate.mjs — fails the build if baked series are malformed.
// Per-product checks: monotonic gapless dates, plausible ranges, weights sum
// to 100, computed-vs-published cross-checks, and the base-year rule (every
// series file's base must be the base declared for its dossier in
// data/sources.yml — a series that crossed a base revision would fail this).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
let failures = 0;
const fail = (msg) => { failures++; console.error("FAIL:", msg); };
const ok = (msg) => console.log("  ok:", msg);

const load = (slug) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));

function checkCadence(dates, stepMonths, slug) {
  let prev = null;
  for (const d of dates) {
    const t = new Date(d + "T00:00:00Z").getTime();
    if (prev != null) {
      if (t <= prev) fail(`${slug}: dates not monotonic at ${d}`);
      const p = new Date(prev);
      const expect = new Date(Date.UTC(p.getUTCFullYear(), p.getUTCMonth() + stepMonths, 1)).getTime();
      if (t !== expect) fail(`${slug}: gap in cadence before ${d}`);
    }
    prev = t;
  }
}

function checkRange(bundle, lo, hi, slug, seriesRange) {
  // CONTRACT-series rule 2: disclosure lives on the series. A bundle-level
  // meta.gaps union survived only in the legacy shape; writeSeries migrates
  // it, so any meta.gaps here bypassed the writer by hand.
  if (bundle.meta?.gaps?.length) fail(`${slug}: bundle-level meta.gaps is retired — declare gaps on the series that miss the dates (writeSeries migrates automatically)`);
  for (const [k, s] of Object.entries(bundle.series)) {
    // a bundle may mix units (a % share beside a constant-US$ level); a
    // per-series range overrides the bundle default
    const [slo, shi] = seriesRange?.[k] ?? [lo, hi];
    // series may legitimately start late or end early (e.g. a state series
    // shorter than the bundle axis); nulls outside a series' own published
    // span are fine, interior nulls must be disclosed in that series' gaps.
    const first = s.data.findIndex((v) => v != null);
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    if (first === -1) { fail(`${slug}.${k}: entirely empty`); continue; }
    const gaps = new Set(s.gaps ?? []);
    const estimated = new Set(s.estimated ?? []);
    for (const d of s.estimated ?? []) {
      const i = bundle.dates.indexOf(d);
      if (i === -1) fail(`${slug}.${k}: estimated date ${d} is not on the axis`);
      else if (s.data[i] == null) fail(`${slug}.${k}: estimated ${d} carries no value`);
      else if (i <= first || i >= last) fail(`${slug}.${k}: estimated ${d} is not interior to the series' span`);
      else if (gaps.has(d)) fail(`${slug}.${k}: ${d} cannot be both estimated and a gap`);
    }
    s.data.forEach((v, i) => {
      if (v === null) {
        if (i > first && i < last && !gaps.has(bundle.dates[i])) fail(`${slug}.${k}: null at ${bundle.dates[i]} (not disclosed in series.gaps)`);
      } else if (v < slo || v > shi) fail(`${slug}.${k}: implausible ${v} at ${bundle.dates[i]}`);
    });
    if (s.data.length !== bundle.dates.length) fail(`${slug}.${k}: length ${s.data.length} != dates ${bundle.dates.length}`);
  }
}

function checkMeta(bundle, slug, dossierKey, baseOverride, freqOverride) {
  const m = bundle.meta ?? {};
  for (const k of ["source", "vintage", "base", "frequency"]) {
    if (m[k] == null) fail(`${slug}: meta.${k} missing`);
  }
  const declared = baseOverride ?? cfg.dossiers[dossierKey]?.base;
  if (declared && m.base !== declared) fail(`${slug}: meta.base "${m.base}" != sources.yml "${declared}" (base-year rule)`);
  const freq = freqOverride ?? cfg.dossiers[dossierKey]?.frequency;
  // a dossier whose bundles legitimately mix frequencies (multi-survey
  // compendia) declares frequency_exempt in sources.yml — never a hardcoded
  // list in code
  if (freq && m.frequency !== freq && !cfg.dossiers[dossierKey]?.frequency_exempt) fail(`${slug}: meta.frequency "${m.frequency}" != sources.yml "${freq}"`);
  // one bundle, one geography. Bundles baked before the geo field carry no
  // meta.geo — they default to "IND", as does a sources.yml entry without
  // geo; new bakes stamp it explicitly and a mismatch fails loudly.
  const declaredGeo = cfg.dossiers[dossierKey]?.geo ?? "IND";
  const bundleGeo = m.geo ?? "IND";
  if (bundleGeo !== declaredGeo) fail(`${slug}: meta.geo "${m.geo}" != sources.yml "${declaredGeo}" (one bundle, one geography)`);
}

// FRESHNESS — two mechanical checks.
// 1) meta.latestPeriod is a display label; when machine-parseable (YYYY-MM or
//    YYYY) it must name the axis end. A hardcoded label that outlives its data
//    is exactly the rot this gate exists for; prose-range labels ("2019-21")
//    are not parseable and are skipped.
// 2) The staleness floor: `stale_after` in sources.yml (per dossier; a row's
//    `staleAfter` overrides) is the minimum period a live bundle must cover.
//    It is a regression floor — newer data never fails it, a bake that loses
//    ground does. Retired rulers carry their own frozen floor with a comment;
//    the floor is a minimum, so late-arriving history can never false-fail.
function checkFreshness(bundle, slug, row, dossierKey) {
  const m = bundle.meta ?? {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(m.vintage ?? ""))) fail(`${slug}: meta.vintage "${m.vintage}" is not an ISO date`);
  else if (m.vintage > new Date().toISOString().slice(0, 10)) fail(`${slug}: meta.vintage ${m.vintage} is in the future — vintage is the data vintage, not the fetch date`);
  const last = bundle.dates.at(-1);
  const lp = m.latestPeriod;
  if (typeof lp === "string") {
    // a real month only: "2019-21" is a survey-round range label, not YYYY-MM
    const ym = /^\d{4}-(0[1-9]|1[0-2])$/.test(lp) ? lp : /^\d{4}$/.test(lp) ? `${lp}-01` : null;
    if (ym && ym !== last.slice(0, 7)) fail(`${slug}: meta.latestPeriod "${lp}" does not match axis end ${last.slice(0, 7)}`);
  }
  if (row.stale === false) return;
  const floor = row.staleAfter ?? cfg.dossiers[dossierKey]?.stale_after;
  if (floor && last.slice(0, 7) < floor) fail(`${slug}: stale — last period ${last.slice(0, 7)} is behind the stale_after floor ${floor}`);
  else if (floor) ok(`${slug}: covers through ${last.slice(0, 7)} (floor ${floor})`);
}

function checkWeights(dossierKey, field = "weights") {
  const w = cfg.dossiers[dossierKey]?.[field];
  if (!w) return;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) fail(`${dossierKey}: ${field} sum to ${sum}, not 100`);
  else ok(`${dossierKey}: ${field} sum to ${sum.toFixed(2)}`);
}

function checkCrosscheck(bundle, slug, computedKey, publishedKey, tol) {
  const published = bundle.crosscheck?.[publishedKey];
  if (!published) return fail(`${slug}: crosscheck.${publishedKey} missing`);
  let worst = 0, worstAt = null;
  bundle.series[computedKey].data.forEach((v, i) => {
    const p = published[i];
    if (v == null || p == null) return;
    const d = Math.abs(v - p);
    if (d > worst) { worst = d; worstAt = bundle.dates[i]; }
  });
  if (worst > tol) fail(`${slug}: computed ${computedKey} deviates ${worst.toFixed(2)}pt from published at ${worstAt}`);
  else ok(`${slug}: computed ${computedKey} within ${worst.toFixed(3)}pt of published`);
}

/* ---- per-product table ---- */

const PRODUCTS = [
  // FRESHNESS FLOORS — the dossier-level floor lives in sources.yml
  // (`stale_after`); a row's `staleAfter` overrides it. Floors are minimums:
  // newer data never fails, a bake that loses ground does. Retired rulers
  // carry a frozen floor so a refetch cannot silently truncate them.
  // The 2012-base CPI stream was retired at Dec 2025 — frozen by design.
  { slug: "cpi", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-8, 20], cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-rural", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-12, 20], cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-urban", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-12, 20], cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-subgroups", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-30, 70] },
  { slug: "cpi-states", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-8, 30] },
  // range is wide: Daman & Diu's published rural index falls ~13% over
  // late 2018 – early 2019 (as-published in eSankhyiki)
  { slug: "cpi-states-sectors", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-15, 35] },
  // base 2024=100 — separate bundles, never spliced with the 2012 base.
  // Upper range bound is the personal-care division (carries gold, ~19% y/y
  // through H1 2026). Crosscheck here is computed-from-levels y/y against the
  // API's published inflation rate — NOT a weights recomputation; the API
  // serves no weights for this base (disclosed in meta.note).
  { slug: "cpi-2024", dossier: "cpi", cadence: 1, range: [-8, 25], base: "2024=100", cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-2024-sectors", dossier: "cpi", cadence: 1, range: [-12, 25], base: "2024=100" },
  // the NSO's own back-cast (series=Back): levels published to one decimal,
  // so computed y/y can sit ~0.16pt from the published rate — tolerance 0.25
  { slug: "cpi-2024-back", dossier: "cpi", cadence: 1, staleAfter: "2024-12", range: [-8, 20], base: "2024=100", cross: ["headline", "published_headline", 0.25] },
  // 2024-base depth (v2.4): groups, items, states. Ranges are documentation
  // of the measured extremes, not curation — silver jewellery y/y reaches
  // +160.9 (Apr 2026), garlic -53.0; the hottest group is Other personal
  // effects (jewellery) at +60.8; state General y/y stays in single digits
  // on this young base. Per-series published-inflation crosschecks below.
  { slug: "cpi-2024-groups", dossier: "cpi", cadence: 1, range: [-30, 70], base: "2024=100" },
  { slug: "cpi-2024-linked", dossier: "cpi", cadence: 1, range: [-2, 10], base: "2024=100" },
  { slug: "cpi-2024-items", dossier: "cpi", cadence: 1, range: [-60, 200], base: "2024=100" },
  { slug: "cpi-2024-states", dossier: "cpi", cadence: 1, range: [-10, 25], base: "2024=100" },
  { slug: "cpi-2024-states-sectors", dossier: "cpi", cadence: 1, range: [-12, 30], base: "2024=100" },
  // the 2011-12 base was retired after the 2022-23 base revision — frozen
  { slug: "gdp", dossier: "gdp", cadence: 3, staleAfter: "2025-07", range: [-70, 90], cross: ["gdp", "gdp_growth_published", 0.6], cross2: ["gva", "gva_growth_published", 0.6] },
  { slug: "gdp-expenditure", dossier: "gdp", cadence: 3, staleAfter: "2025-07", range: [-90, 150] },
  { slug: "gdp-accounts", dossier: "gdp", cadence: 12, staleAfter: "2025-04", range: [-90, 150], freq: "annual" },
  // 8-sector quarterly real GVA; range spans the lockdown whipsaw
  // (trade/construction fell ~-50% and rebounded past +45%)
  { slug: "gdp-industries", dossier: "gdp", cadence: 3, staleAfter: "2025-07", range: [-70, 90] },
  // nominal GDP y/y and the implied deflator. Nominal >= real in
  // inflationary years is NOT asserted — the deflator can print below zero
  // (WPI-heavy) while the CPI is positive, and did in FY16.
  { slug: "gdp-nominal", dossier: "gdp", cadence: 3, staleAfter: "2025-07", range: [-40, 45], cross: ["gdp_nominal", "nominal_growth_published", 0.6] },
  // the new base: quarterly prints continue here after Q2 FY26; separate
  // bundle, never spliced with the 2011-12 base
  { slug: "gdp-2022", dossier: "gdp", cadence: 3, range: [-10, 20], base: "2022-23", cross: ["gdp", "gdp_growth_published", 0.6], cross2: ["gva", "gva_growth_published", 0.6] },
  // the 2022-23 base in full (2026-10): same builder as the 2011-12 set.
  // Ranges are provisional documentation, wide until the first bake is measured.
  { slug: "gdp-2022-expenditure", dossier: "gdp", cadence: 3, range: [-40, 60], base: "2022-23" },
  { slug: "gdp-2022-industries", dossier: "gdp", cadence: 3, range: [-40, 60], base: "2022-23" },
  { slug: "gdp-2022-nominal", dossier: "gdp", cadence: 3, range: [-20, 40], base: "2022-23", cross: ["gdp_nominal", "nominal_growth_published", 0.6] },
  { slug: "gdp-2022-accounts", dossier: "gdp", cadence: 12, staleAfter: "2025-04", range: [-40, 60], base: "2022-23", freq: "annual" },
  // the NSO back series, 1951-52 to 2011-12 at 2011-12 prices — frozen; an
  // agency bridge in sources.yml seams, never joined to the current series.
  // Range documents the measured extremes: GDP -5.24 (1979-80), gfcf 22.19,
  // gfce 22.88, saving rate 37.82; mining -17.53 in 2011-12, the year the
  // back-cast meets the current series (level 316,533 -> 261,035 as published)
  { slug: "gdp-back", dossier: "gdp", cadence: 12, staleAfter: "2011-04", range: [-20, 45], base: "2011-12", freq: "annual" },
  // base 2011-12 ended at Apr 2026 (the OEA moved to 2022-23) — frozen
  { slug: "wpi", dossier: "wpi", cadence: 1, staleAfter: "2026-04", range: [-30, 60], cross: ["headline", "published_headline", 0.15] },
  { slug: "wpi-groups", dossier: "wpi", cadence: 1, staleAfter: "2026-04", range: [-70, 130] },
  { slug: "wpi-subgroups", dossier: "wpi", cadence: 1, staleAfter: "2026-04", range: [-80, 250] },
  // base 2022-23 — separate bundles, never spliced with 2011-12. No weights
  // are served, so there is no computed-vs-published crosscheck here; the
  // headline IS the published index (meta.note). Ranges are provisional
  // documentation, set wide until the first bake is measured.
  { slug: "wpi-2022", dossier: "wpi", cadence: 1, staleAfter: "2026-08", range: [-30, 60], base: "2022-23=100" },
  { slug: "wpi-2022-groups", dossier: "wpi", cadence: 1, staleAfter: "2026-08", range: [-70, 130], base: "2022-23=100" },
  { slug: "wpi-2022-subgroups", dossier: "wpi", cadence: 1, staleAfter: "2026-08", range: [-80, 250], base: "2022-23=100" },
  { slug: "wpi-2022-items", dossier: "wpi", cadence: 1, staleAfter: "2026-08", range: [-90, 500], base: "2022-23=100" },
  // single named goods: the extremes are real observations (garlic +476%
  // y/y in Jan 2024; molasses swings between -83% and +361%); range is
  // documentation, not curation. Seasonal items (litchi, mango and kin)
  // carry interior nulls where the source serves 0/absent levels —
  // disclosed per series (CONTRACT-series rule 2).
  { slug: "wpi-items", dossier: "wpi", cadence: 1, staleAfter: "2026-04", range: [-90, 500] },
  { slug: "cpialrl-1986", dossier: "cpialrl", cadence: 1, staleAfter: "2025-05", range: [-5, 25], base: "1986-87=100" },
  { slug: "cpialrl-2019", dossier: "cpialrl", cadence: 1, range: [-10, 300], base: "2019=100" },
  // range is wide: Assam's published old-base levels spike ~20% in late 2021
  // (as-published in eSankhyiki), dragging 2022 y/y to about -14%
  { slug: "cpialrl-states-1986", dossier: "cpialrl", cadence: 1, staleAfter: "2025-05", range: [-20, 40], base: "1986-87=100" },
  { slug: "cpialrl-states-2019", dossier: "cpialrl", cadence: 1, range: [50, 300], base: "2019=100" },
  { slug: "cpialrl-groups-2019", dossier: "cpialrl", cadence: 1, range: [-10, 300], base: "2019=100" },
  { slug: "plfs-monthly", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-quarterly", dossier: "plfs", cadence: 3, staleAfter: "2026-01", range: [0, 100] },
  { slug: "plfs-cuts", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-annual", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100] },
  { slug: "plfs-states", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 45] },
  { slug: "plfs-status", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100] },
  // ₹ levels: casual female r+u floor ~₹165/day, regular male ceiling ~₹22k/mo
  { slug: "plfs-earnings", dossier: "plfs", cadence: 3, staleAfter: "2024-04", range: [100, 60000] },
  { slug: "plfs-education", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 45] },
  // RBI via eSankhyiki: the mirror lags the RBI's own publications by
  // up to a year, so each bundle carries its own regression floor
  { slug: "rbi-trade", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [-60000, 80000], cross: ["balance", "balance_published", 5] },
  { slug: "rbi-forex", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [5, 1000000] },
  { slug: "rbi-trade-oil", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [0, 100000] },
  { slug: "rbi-bop", dossier: "rbi", cadence: 3, staleAfter: "2025-04", range: [-200000, 200000], freq: "quarterly" },
  { slug: "rbi-bop-ratios", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [-15, 60], freq: "annual" },
  { slug: "rbi-debt", dossier: "rbi", cadence: 12, staleAfter: "2025-03", range: [0, 1500000], freq: "annual" },
  { slug: "rbi-nri", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [-60000, 500000] },
  // low bound is the yen: quoted ₹ per single yen (0.01 in 1966); USD itself
  // stays within 4.76 (pre-1966-devaluation) .. ~90
  { slug: "rbi-exchange-rates", dossier: "rbi", cadence: 1, staleAfter: "2025-07", range: [0.005, 130] },
  { slug: "rbi-forward-premia", dossier: "rbi", cadence: 1, staleAfter: "2025-08", range: [-10, 40] },
  // gross legs peak ~69bn/month (Feb 2025 sales); forward book has hit -89bn
  { slug: "rbi-intervention", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [-100000, 80000] },
  { slug: "rbi-invisibles", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [-60000, 300000], freq: "annual" },
  // ₹ Crore stocks, all positive; gross ≈ 63 lakh crore end-Mar 2025
  { slug: "rbi-debt-quarterly", dossier: "rbi", cadence: 3, staleAfter: "2025-03", range: [0, 10000000], freq: "quarterly" },
  // ceiling is imports from China (~$113bn FY25); identities checked below
  { slug: "rbi-trade-partners", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [0, 250000], freq: "annual" },
  // ceilings: engineering exports ~$117bn; crude & products imports ~$186bn
  { slug: "rbi-commodities-exports", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [0, 150000], freq: "annual" },
  { slug: "rbi-commodities-imports", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [0, 250000], freq: "annual" },
  // gross monthly turnover, both legs: ~$76bn Aug 1996 to ~$3.0tn Jul 2025
  { slug: "rbi-fx-turnover", dossier: "rbi", cadence: 1, staleAfter: "2025-07", range: [0, 4000000] },
  { slug: "isp", dossier: "isp", cadence: 1, range: [50, 250] },
  { slug: "iip-2022", dossier: "iip", cadence: 1, range: [-30, 60], cross: ["general", "headline_growth_published", 0.3] },
  // old base spans the COVID whipsaw: near-zero lockdown levels make the
  // 2021 y/y mathematically correct but enormous (consumer durables +1778%,
  // Apr 2021). Ranges are documentation, not curation — values as computed.
  { slug: "iip-2011", dossier: "iip", cadence: 1, staleAfter: "2026-03", range: [-100, 1800], base: "2011-12=100", cross: ["general", "headline_growth_published", 0.3] },
  { slug: "iip-industries-2022", dossier: "iip", cadence: 1, range: [-60, 120] },
  { slug: "iip-industries-2011", dossier: "iip", cadence: 1, staleAfter: "2026-03", range: [-100, 55000], base: "2011-12=100" },
  // heritage bases (full-surface audit, 2026-08-08) — separate rulers, never
  // spliced. Capital goods on the old bases is lumpy-order volatile (+65% in
  // single months); 2-digit extremes are as published (electrical machinery
  // +275% y/y in 2007 on the 2004-05 base; jute swings past +860% on the
  // 1993-94 base). Ranges are documentation, not curation.
  { slug: "iip-2004", dossier: "iip", cadence: 1, staleAfter: "2017-03", range: [-45, 80], base: "2004-05=100", cross: ["general", "headline_growth_published", 0.3] },
  { slug: "iip-industries-2004", dossier: "iip", cadence: 1, staleAfter: "2017-03", range: [-90, 320], base: "2004-05=100" },
  { slug: "iip-1993", dossier: "iip", cadence: 1, staleAfter: "2011-06", range: [-30, 80], base: "1993-94=100", cross: ["general", "headline_growth_published", 0.3] },
  { slug: "iip-industries-1993", dossier: "iip", cadence: 1, staleAfter: "2011-06", range: [-100, 900], base: "1993-94=100" },
  // HCES: two survey rounds, annual axis; ₹ levels (Chandigarh urban top
  // fractile is the ceiling driver), category shares in %, Gini 0.2-0.5
  { slug: "hces-mpce", dossier: "hces", cadence: 12, range: [500, 20000] },
  { slug: "hces-states", dossier: "hces", cadence: 12, range: [500, 20000] },
  { slug: "hces-fractiles", dossier: "hces", cadence: 12, range: [500, 60000] },
  { slug: "hces-categories", dossier: "hces", cadence: 12, range: [0, 100] },
  { slug: "hces-gini", dossier: "hces", cadence: 12, range: [0.2, 0.5] },
  // group means sit between the ST rural floor (~3,000) and the urban
  // "Others" household-type ceiling (~9,200)
  { slug: "hces-social", dossier: "hces", cadence: 12, range: [1500, 15000] },
  { slug: "hces-household-type", dossier: "hces", cadence: 12, range: [1500, 15000] },
  // kg per person per month: Other Cereals is ~0.01, Total Cereals ~8-10
  { slug: "hces-quantities", dossier: "hces", cadence: 12, range: [0.005, 15] },
  { slug: "hces-item-values", dossier: "hces", cadence: 12, range: [0.1, 1000] },
  // food share of MPCE by state-sector: ~36% (urban Chandigarh/Kerala end)
  // to ~58% (rural Ladakh end)
  { slug: "hces-categories-states", dossier: "hces", cadence: 12, range: [20, 80] },
  // ASI: mixed units — counts (factories ~2.6e5, persons ~1.9e7) and ₹ lakh
  // levels (gross output ~1.2e9 lakh); ranges are wide by construction
  { slug: "asi-headline", dossier: "asi", cadence: 12, range: [0, 2.5e9] },
  // the complete indicator ledger: stock-change indicators (24-27) and
  // Net Profit (30) are legitimately negative; fuel values (i52-i57) are
  // published in ₹ THOUSAND, so total fuel reaches ~6e9
  { slug: "asi-accounts", dossier: "asi", cadence: 12, range: [-5e8, 8e9] },
  // legacy classification blocks — separate rulers, never spliced. Ranges
  // as for the 2008 block, scaled to their (smaller, older) economies.
  { slug: "asi-headline-2004", dossier: "asi", cadence: 12, staleAfter: "2007-04", range: [-5e8, 2.5e9], base: "NIC 2004" },
  { slug: "asi-headline-1998", dossier: "asi", cadence: 12, staleAfter: "2003-04", range: [-5e8, 2.5e9], base: "NIC 1998" },
  { slug: "asi-headline-1987", dossier: "asi", cadence: 12, staleAfter: "1997-04", range: [-5e8, 2.5e9], base: "NIC 1987" },
  // industry/state cuts can carry real negative GVA (e.g. Ladakh 2021-22,
  // GVA -434 ₹ lakh — aggregate losses in a tiny UT, as published)
  { slug: "asi-industries", dossier: "asi", cadence: 12, range: [-1e8, 2.5e9] },
  { slug: "asi-states", dossier: "asi", cadence: 12, range: [-1e8, 2.5e9] },
  // ASUSE: counts up to ~1.2e8 workers; per-worker ₹/year values ~1e5-1e6
  { slug: "asuse-annual", dossier: "asuse", cadence: 12, range: [0, 5e8] },
  { slug: "asuse-sectors", dossier: "asuse", cadence: 12, range: [0, 5e8] },
  // per-1000 distributions: hard-bounded to [0, 1000] by construction
  { slug: "asuse-owners", dossier: "asuse", cadence: 12, range: [0, 1000] },
  { slug: "asuse-structure", dossier: "asuse", cadence: 12, range: [0, 1000] },
  // modernity mixes per-1000 rates with the franchise COUNT (~68-140k);
  // the per-1000 keys get their own [0,1000] hard check below
  { slug: "asuse-modernity", dossier: "asuse", cadence: 12, range: [0, 5e5] },
  { slug: "asuse-states", dossier: "asuse", cadence: 12, range: [0, 5e8] },
  // counts are in hundreds ('00): workers reach ~1.5e6 ('00) ≈ 152M
  { slug: "asuse-quarterly", dossier: "asuse", cadence: 3, staleAfter: "2026-01", range: [0, 3e6], freq: "quarterly" },
  // AISHE: counts (enrolment to ~4.3e7, teachers ~1.6e6) mixed with ratios
  // (GER ~25%, GPI ~1, PTR ~26); wide range admits them all
  { slug: "aishe-headline", dossier: "aishe", cadence: 12, range: [0, 5e7] },
  { slug: "aishe-access", dossier: "aishe", cadence: 12, range: [0, 3e7] },
  { slug: "aishe-composition", dossier: "aishe", cadence: 12, range: [0, 4e7] },
  // state enrolment (UP ~5e6 is the ceiling) + GER (0-50) + GPI (0-2)
  { slug: "aishe-states", dossier: "aishe", cadence: 12, range: [0, 1e7] },
  // teachers by faculty type: lecturer/assistant peaks ~1.09M
  { slug: "aishe-teachers", dossier: "aishe", cadence: 12, range: [0, 1.2e6] },
  // minority enrolment: Muslims peak ~2.1M
  { slug: "aishe-minority", dossier: "aishe", cadence: 12, range: [0, 2.5e6] },
  // Gender compendium — each indicator its own source/cadence. Sex ratio is
  // decadal census (120-month steps); MMR & literacy have irregular cadences
  // (overlapping 3-year periods; mixed census + NSO estimate) and skip the
  // cadence check. Ranges: sex ratio 900-1000, IMR 0-100, life-exp 40-80,
  // MMR 0-300, TFR 0-6, literacy 0-100, LFPR/unemp 0-100.
  { slug: "gender-sexratio", dossier: "gender", cadence: 120, range: [900, 1000] },
  { slug: "gender-imr", dossier: "gender", cadence: 12, range: [0, 100] },
  { slug: "gender-lifeexp", dossier: "gender", noCadence: true, range: [40, 85] },
  { slug: "gender-mmr", dossier: "gender", noCadence: true, range: [0, 300] },
  { slug: "gender-fertility", dossier: "gender", cadence: 12, range: [0, 6] },
  { slug: "gender-literacy", dossier: "gender", noCadence: true, range: [0, 100] },
  { slug: "gender-work", dossier: "gender", cadence: 12, range: [0, 100] },
  // some tribal/UT populations have sex ratio >1000 (more females than males)
  { slug: "gender-states", dossier: "gender", noCadence: true, range: [0, 1200] },
  // MNRE: installed capacity in MW. Grand Total peaks ~289k; states peak ~52k
  { slug: "mnre-sources", dossier: "mnre", cadence: 1, range: [0, 300000] },
  { slug: "mnre-solar-categories", dossier: "mnre", cadence: 1, range: [0, 200000] },
  { slug: "mnre-states", dossier: "mnre", cadence: 1, range: [0, 60000] },
  { slug: "mnre-states-solar", dossier: "mnre", cadence: 1, range: [0, 50000] },
  // NFHS: 2-point cross-sections (NFHS-4, NFHS-5). Wide ranges: IMR in per
  // 1000, most indicators in per cent. noCadence (2 points, irregular).
  { slug: "nfhs-child", dossier: "nfhs", noCadence: true, range: [0, 100] },
  // maternal mixes per cent with OOP expenditure (₹) and counts — wide range
  { slug: "nfhs-maternal", dossier: "nfhs", noCadence: true, range: [0, 3500] },
  { slug: "nfhs-anaemia", dossier: "nfhs", noCadence: true, range: [0, 100] },
  { slug: "nfhs-adult", dossier: "nfhs", noCadence: true, range: [0, 100] },
  { slug: "nfhs-fertility", dossier: "nfhs", noCadence: true, range: [0, 100] },
  // household carries sex ratios (up to ~1020) alongside per cent
  { slug: "nfhs-household", dossier: "nfhs", noCadence: true, range: [0, 1200] },
  { slug: "nfhs-states", dossier: "nfhs", noCadence: true, range: [0, 100] },
  // World Bank WDI (first non-MoSPI family): annual, calendar years. The
  // headline bundle mixes % of GDP with a constant-2015-US$ level — the
  // level carries its own range. Growth dips to about -10 (2020 lockdown).
  { slug: "wdi-manufacturing", dossier: "manufacturing", cadence: 12, staleAfter: "2025-01", range: [-70, 100], seriesRange: { mva_constant_usd: [1e9, 3e12] } },
  { slug: "wdi-manufacturing-composition", dossier: "manufacturing", cadence: 12, staleAfter: "2023-01", range: [0, 100] },
  { slug: "wdi-manufacturing-tech", dossier: "manufacturing", cadence: 12, staleAfter: "2022-01", range: [0, 100] },
  { slug: "wdi-manufacturing-exports", dossier: "manufacturing", cadence: 12, staleAfter: "2024-01", range: [0, 100] },
];

for (const p of PRODUCTS) {
  const file = path.join(ROOT, "data/series", p.slug + ".json");
  if (!fs.existsSync(file)) { fail(`${p.slug}: data/series/${p.slug}.json missing`); continue; }
  const b = load(p.slug);
  checkMeta(b, p.slug, p.dossier, p.base, p.freq);
  checkFreshness(b, p.slug, p, p.dossier);
  if (!p.noCadence) checkCadence(b.dates, p.cadence, p.slug);
  checkRange(b, p.range[0], p.range[1], p.slug, p.seriesRange);
  if (p.cross) checkCrosscheck(b, p.slug, ...p.cross);
  if (p.cross2) checkCrosscheck(b, p.slug, ...p.cross2);
  const last = b.dates.at(-1);
  console.log(`  ${p.slug}: ${b.dates.length} pts, ${b.dates[0]} .. ${last}, vintage ${b.meta.vintage}`);
}

checkWeights("cpi");
checkWeights("cpi", "weights_rural");
checkWeights("cpi", "weights_urban");
checkWeights("wpi");

/* ---- World Bank WDI manufacturing identities ---- */
withBundle("wdi-manufacturing", (b) => {
  const mva = b.series.mva_pct_gdp.data, ind = b.series.industry_pct_gdp.data;
  const lvl = b.series.mva_constant_usd.data, pub = b.series.mva_growth.data;
  // manufacturing is a subset of industry — its share can never exceed it
  for (let i = 0; i < mva.length; i++) {
    if (mva[i] != null && ind[i] != null && mva[i] > ind[i] + 1e-9) fail(`wdi-manufacturing: MVA share ${mva[i]} exceeds industry share ${ind[i]} at ${b.dates[i]}`);
  }
  ok("wdi-manufacturing: MVA share never exceeds the industry share");
  // the published growth rate must equal the constant-US$ level's own y/y
  // (WDI computes it from constant LCU; constant-USD is the same growth)
  let worst = 0, worstAt = null;
  for (let i = 1; i < lvl.length; i++) {
    if (lvl[i] == null || lvl[i - 1] == null || pub[i] == null) continue;
    const d = Math.abs((lvl[i] / lvl[i - 1] - 1) * 100 - pub[i]);
    if (d > worst) { worst = d; worstAt = b.dates[i]; }
  }
  if (worst > 0.05) fail(`wdi-manufacturing: published growth deviates ${worst.toFixed(3)}pt from level-derived y/y at ${worstAt}`);
  else ok(`wdi-manufacturing: published growth within ${worst.toFixed(4)}pt of level-derived y/y`);
});
withBundle("wdi-manufacturing-composition", (b) => {
  // the five UNIDO decomposition shares are exhaustive — they must sum to 100
  for (let i = 0; i < b.dates.length; i++) {
    const sum = Object.values(b.series).reduce((a, s) => a + (s.data[i] ?? 0), 0);
    if (Math.abs(sum - 100) > 0.5) fail(`wdi-manufacturing-composition: shares sum to ${sum.toFixed(2)} at ${b.dates[i]}, not 100`);
  }
  ok("wdi-manufacturing-composition: shares sum to 100 in every year");
});

/* ---- CPI base-year seam: two bases, never overlapping-spliced ---- */
withBundle("cpi", (b12) => withBundle("cpi-2024", (b24) => {
  if (b12.meta.base === b24.meta.base) fail("cpi/cpi-2024: both bundles declare the same base");
  // the 2012-base stream stopped at Dec 2025; the first same-base y/y on the
  // new base is Jan 2026 — the seam is clean, no month carries both bases
  const last12 = b12.dates.at(-1), first24 = b24.dates[0];
  if (!(last12 < first24)) fail(`cpi: 2012-base bundle runs to ${last12}, overlapping 2024-base y/y from ${first24} — seam not clean`);
  else ok(`cpi: base seam clean — 2012 base ends ${last12}, 2024-base y/y begins ${first24}`);
}));

/* ---- 2024-base depth: counts, same-base y/y rule, inflation crosscheck ---- */

// per-series published-inflation crosscheck: computed-from-levels y/y vs the
// API's own inflation field, worst cell across every series in the bundle.
// NOT a weights recomputation — the API serves no weights for this base.
const crossInflationMap = (slug, tol) => withBundle(slug, (b) => {
  const pub = b.crosscheck?.published_inflation;
  if (!pub) return fail(`${slug}: crosscheck.published_inflation missing`);
  let worst = 0, worstAt = null, n = 0;
  for (const [k, s] of Object.entries(b.series)) {
    const arr = pub[k];
    if (!arr) { fail(`${slug}: no published-inflation column for series ${k}`); continue; }
    s.data.forEach((v, i) => {
      const p = arr[i];
      if (v == null || p == null) return;
      n++;
      const d = Math.abs(v - p);
      if (d > worst) { worst = d; worstAt = `${k} at ${b.dates[i]}`; }
    });
  }
  if (!n) fail(`${slug}: published-inflation crosscheck matched no cells`);
  else if (worst > tol) fail(`${slug}: computed y/y deviates ${worst.toFixed(2)}pt from published inflation (${worstAt})`);
  else ok(`${slug}: y/y within ${worst.toFixed(3)}pt of published inflation (${n} cells)`);
});
crossInflationMap("cpi-2024-groups", 0.15);
crossInflationMap("cpi-2024-items", 0.15);
crossInflationMap("cpi-2024-states", 0.15);
crossInflationMap("cpi-2024-states-sectors", 0.15);

withBundle("cpi-2024-states", (b) => {
  // 36 states/UTs in the 2024-base filter list (All India excluded here)
  const n = Object.keys(b.series).length;
  if (n !== 36) fail(`cpi-2024-states: ${n} states/UTs baked, expected 36`);
  else ok("cpi-2024-states: all 36 states/UTs present");
});
withBundle("cpi-2024-states-sectors", (b) => {
  const keys = Object.keys(b.series);
  const r = keys.filter((k) => k.endsWith("_rural")).length;
  const u = keys.filter((k) => k.endsWith("_urban")).length;
  if (u !== 36 || r !== 35) fail(`cpi-2024-states-sectors: ${r} rural + ${u} urban series, expected 35 + 36 (Chandigarh is a city-UT with no rural index)`);
  else ok("cpi-2024-states-sectors: 35 rural + 36 urban series present (Chandigarh urban-only, as published)");
});
withBundle("cpi-2024-groups", (b) => {
  const n = Object.keys(b.series).length;
  if (n !== 43) fail(`cpi-2024-groups: ${n} groups baked, expected 43`);
  else ok("cpi-2024-groups: all 43 groups present");
});
withBundle("cpi-2024-items", (b) => {
  const n = Object.keys(b.series).length;
  if (n !== 358) fail(`cpi-2024-items: ${n} items baked, expected 358`);
  else ok("cpi-2024-items: all 358 items present");
  // y/y only where a same-base year-ago level exists — the axis must not
  // reach back into 2025 (a cross-base computation would be the only way)
  if (b.dates[0] < "2026-01-01") fail(`cpi-2024-items: axis starts ${b.dates[0]} — before the first same-base y/y month`);
  else ok(`cpi-2024-items: axis starts ${b.dates[0]} (first same-base y/y month)`);
  // imputation disclosure: the meta note must exist, and any imputed month
  // must be listed on its series
  if (!b.meta.imputationNote) fail("cpi-2024-items: meta.imputationNote missing");
  for (const [k, s] of Object.entries(b.series)) {
    if (!s.code || s.latest_level == null) { fail(`cpi-2024-items.${k}: code or latest_level missing`); break; }
  }
  // tripwire: §03 prose states no item-month has needed imputation. If the
  // source starts flagging Y, this fails so the dossier text is revisited
  // rather than silently contradicted.
  const imputed = Object.entries(b.series).filter(([, s]) => (s.imputed_months ?? []).length);
  if (imputed.length) fail(`cpi-2024-items: ${imputed.length} items now carry imputed months (e.g. ${imputed[0][0]}) — §03 prose asserts none; update the dossier`);
  else ok("cpi-2024-items: no imputed item-months (matches the §03 disclosure)");
});
{
  const rawFile = path.join(ROOT, "data/raw/cpi-2024-indices.json");
  if (fs.existsSync(rawFile)) {
    const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
    let bad = 0;
    for (const [key, months] of Object.entries(raw.levels)) {
      if (key.startsWith("back:")) continue; // back-cast falls to ~55 by 2013, by design
      for (const [ym, v] of Object.entries(months)) {
        if (v < 80 || v > 130) { bad++; fail(`cpi-2024 raw: ${key} ${ym} level ${v} far from base ~100`); }
      }
    }
    if (!bad) ok("cpi-2024 raw: all Current levels within 80–130 of the 2024=100 base");
  } else fail("cpi-2024: data/raw/cpi-2024-indices.json missing");
}

/* ---- WPI items (v1.2): y/y from levels, hull sanity, completeness ---- */

// One check for every WPI base: itemsSlug/subgroupsSlug are the baked
// bundles, rawRel the item-level raw dump (2011-12 field names on every base),
// minItems the basket size floor.
function checkWpiItems(itemsSlug, subgroupsSlug, rawRel, minItems, basket) {
withBundle(itemsSlug, (b) => {
  const rawFile = path.join(ROOT, rawRel);
  if (!fs.existsSync(rawFile)) return fail(`${itemsSlug}: ${rawRel} missing`);
  const raw = JSON.parse(fs.readFileSync(rawFile, "utf8"));
  const n = Object.keys(b.series).length;
  if (n < minItems) fail(`${itemsSlug}: only ${n} item series baked (${basket})`);
  else ok(`${itemsSlug}: ${n} item series baked`);
  // every baked y/y must equal the recomputation from the raw index levels
  const r2 = (v) => Math.round(v * 100) / 100;
  let cells = 0, bad = 0;
  for (const [k, s] of Object.entries(b.series)) {
    const lv = raw.items[k]?.levels;
    if (!lv) { fail(`${itemsSlug}: ${k} missing from raw dump`); continue; }
    b.dates.forEach((d, i) => {
      const ym = d.slice(0, 7);
      const [y, m] = ym.split("-");
      const prev = lv[`${+y - 1}-${m}`], cur = lv[ym];
      const expect = cur != null && prev != null && prev !== 0 ? r2((cur / prev - 1) * 100) : null;
      const got = s.data[i];
      if (expect == null && got == null) return;
      cells++;
      if (expect == null || got == null || Math.abs(expect - got) > 0.005) {
        bad++;
        if (bad <= 5) fail(`${itemsSlug}: ${k} ${ym} baked ${got} != recomputed ${expect}`);
      }
    });
  }
  if (bad > 5) fail(`${itemsSlug}: ${bad - 5} further y/y recomputation mismatches suppressed`);
  if (!bad) ok(`${itemsSlug}: y/y matches recomputation from raw levels (${cells} cells)`);
  // hull sanity: a sub-group index is a positive-weighted mean of its items'
  // indices, so its y/y must lie inside the min–max hull of its items' y/y
  // (exact weights are not served — no weighted recomposition is possible).
  // Checked for every sub-group-month whose full item set carries a y/y;
  // items sitting directly under a group (Atf, Electricity, …) are skipped.
  // Measured before asserting: worst deviation 0.10pt over 16,492 cells.
  withBundle(subgroupsSlug, (sg) => {
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const members = {};
    for (const [k, it] of Object.entries(raw.items)) {
      if (it.subgroup == null) continue;
      (members[slug(it.subgroup)] ??= []).push(k);
    }
    let checked = 0, viol = 0, worst = 0, worstAt = null;
    b.dates.forEach((d, i) => {
      for (const [sk, keys] of Object.entries(members)) {
        const sv = sg.series[sk]?.data[i];
        if (sv == null) continue;
        const vals = keys.map((k) => b.series[k]?.data[i]);
        if (vals.some((v) => v == null)) continue;
        checked++;
        const lo = Math.min(...vals), hi = Math.max(...vals);
        const dev = sv < lo ? lo - sv : sv > hi ? sv - hi : 0;
        if (dev > worst) { worst = dev; worstAt = `${sk} ${d.slice(0, 7)}`; }
        if (dev > 0.75) { viol++; if (viol <= 5) fail(`${itemsSlug}: sub-group ${sk} y/y ${sv} outside its items' hull [${lo.toFixed(2)}, ${hi.toFixed(2)}] at ${d.slice(0, 7)}`); }
      }
    });
    if (!checked) fail(`${itemsSlug}: hull sanity checked 0 sub-group-months`);
    else if (!viol) ok(`${itemsSlug}: every sub-group y/y inside its items' hull (${checked} cells, worst dev ${worst.toFixed(3)}pt at ${worstAt})`);
  });
});
}
checkWpiItems("wpi-items", "wpi-subgroups", "data/raw/wpi-items.json", 690, "the 2011-12 basket has 697");
checkWpiItems("wpi-2022-items", "wpi-2022-subgroups", "data/raw/wpi-2022-items.json", 940, "the 2022-23 basket has 953");

/* ---- RBI v1.2 identities: partners, commodities, turnover ---- */

// helper: fiscal-year sum of a monthly rbi-trade series, keyed "YYYY-04-01"
function tradeFYSums(tradeBundle, key) {
  const m = new Map(tradeBundle.dates.map((d, i) => [d.slice(0, 7), tradeBundle.series[key].data[i]]));
  const out = new Map();
  for (const [ym] of m) {
    if (!ym.endsWith("-04")) continue;
    const y = +ym.slice(0, 4);
    let s = 0, complete = true;
    for (let i = 0; i < 12; i++) {
      const mo = ((3 + i) % 12) + 1, yy = mo >= 4 ? y : y + 1;
      const v = m.get(`${yy}-${String(mo).padStart(2, "0")}`);
      if (v == null) { complete = false; break; }
      s += v;
    }
    if (complete) out.set(`${y}-04-01`, s);
  }
  return out;
}

withBundle("rbi-trade-partners", (b) => withBundle("rbi-trade", (t) => {
  // 1) the eight partner-group rows sum to the published Total, both directions
  for (const dir of ["exports", "imports"]) {
    let worst = 0;
    b.dates.forEach((d, i) => {
      const tot = b.crosscheck[`total_${dir}`][i], grp = b.crosscheck[`groups_${dir}_sum`][i];
      if (tot != null && grp != null) worst = Math.max(worst, Math.abs(tot - grp));
    });
    if (worst > 1) fail(`rbi-trade-partners: ${dir} group sum deviates $${worst.toFixed(2)}mn from published Total`);
    else ok(`rbi-trade-partners: ${dir} groups sum to Total within $${worst.toFixed(2)}mn`);
  }
  // 2) USA > UK in every year, both directions — the label-pair separation rule
  b.dates.forEach((d, i) => {
    for (const dir of ["exports", "imports"]) {
      const us = b.series[`${dir}_usa`]?.data[i], uk = b.series[`${dir}_uk`]?.data[i];
      if (us != null && uk != null && us <= uk) fail(`rbi-trade-partners: USA ${dir} (${us}) <= UK (${uk}) at ${d} — label-pair separation broken`);
    }
  });
  ok("rbi-trade-partners: USA > UK in every year, both directions");
  // 3) DoT Total vs the monthly customs series, fiscal-year sums (different
  //    compilations of the same trade; measured worst gap is ~0.27%)
  for (const [dir, key] of [["exports", "exports"], ["imports", "imports"]]) {
    const fy = tradeFYSums(t, key);
    let worst = 0;
    b.dates.forEach((d, i) => {
      const tot = b.crosscheck[`total_${dir}`][i], s = fy.get(d);
      if (tot != null && s != null) worst = Math.max(worst, Math.abs(tot - s) / s);
    });
    if (worst > 0.005) fail(`rbi-trade-partners: ${dir} Total deviates ${(worst * 100).toFixed(2)}% from rbi-trade FY sums (>0.5%)`);
    else ok(`rbi-trade-partners: ${dir} Total within ${(worst * 100).toFixed(2)}% of rbi-trade FY sums`);
  }
}));

for (const [slug, key] of [["rbi-commodities-exports", "exports"], ["rbi-commodities-imports", "imports"]]) {
  withBundle(slug, (b) => withBundle("rbi-trade", (t) => {
    // commodity groups sum to the published Total row
    let worst = 0;
    b.dates.forEach((d, i) => {
      const tot = b.crosscheck.total_published[i];
      if (tot == null) return;
      const s = Object.values(b.series).reduce((a, sr) => a + (sr.data[i] ?? 0), 0);
      worst = Math.max(worst, Math.abs(tot - s));
    });
    if (worst > 1) fail(`${slug}: commodity groups deviate $${worst.toFixed(2)}mn from published Total`);
    else ok(`${slug}: commodity groups sum to Total within $${worst.toFixed(2)}mn`);
    // published Total vs the monthly customs series (worst measured ~0.3%)
    const fy = tradeFYSums(t, key);
    let worstR = 0;
    b.dates.forEach((d, i) => {
      const tot = b.crosscheck.total_published[i], s = fy.get(d);
      if (tot != null && s != null) worstR = Math.max(worstR, Math.abs(tot - s) / s);
    });
    if (worstR > 0.005) fail(`${slug}: Total deviates ${(worstR * 100).toFixed(2)}% from rbi-trade FY sums (>0.5%)`);
    else ok(`${slug}: Total within ${(worstR * 100).toFixed(2)}% of rbi-trade FY sums`);
  }));
}

withBundle("rbi-fx-turnover", (b) => {
  // computed total (merchant + inter-bank) vs the published Grand Total;
  // Sep 2018 carries a ~$62bn discrepancy in the source itself (disclosed
  // in meta.note) and is the one tolerated exception
  let worst = 0, worstAt = null;
  b.dates.forEach((d, i) => {
    const c = b.series.total.data[i], p = b.crosscheck.grand_total_published[i];
    if (c == null || p == null || d === "2018-09-01") return;
    const diff = Math.abs(c - p);
    if (diff > worst) { worst = diff; worstAt = d; }
  });
  if (worst > 2) fail(`rbi-fx-turnover: computed total deviates $${worst.toFixed(2)}mn from Grand Total at ${worstAt}`);
  else ok(`rbi-fx-turnover: computed total within $${worst.toFixed(2)}mn of published Grand Total (Sep 2018 source discrepancy excepted)`);
});

/* ---- NAS: industry identity, sector cross-checks, saving rate ---- */

withBundle("gdp-industries", (b) => {
  // each sector's computed y/y vs the API's rounded per-industry growth
  for (const k of Object.keys(b.series)) {
    checkCrosscheck(b, "gdp-industries", k, `${k}_growth_published`, 0.6);
  }
  // shares of nominal GVA must sum to ~100 — GVA by industry is additive
  const sum = Object.values(b.shares ?? {}).reduce((a, v) => a + (v ?? 0), 0);
  if (Math.abs(sum - 100) > 0.2) fail(`gdp-industries: sector shares sum to ${sum.toFixed(2)}, not 100`);
  else ok(`gdp-industries: sector shares sum to ${sum.toFixed(2)}`);
  // level identity from the raw dumps: the 8 sectors sum to Total GVA
  const indFile = path.join(ROOT, "data/raw/nas-industries.json");
  const totFile = path.join(ROOT, "data/raw/nas-levels.json");
  if (fs.existsSync(indFile) && fs.existsSync(totFile)) {
    const ind = JSON.parse(fs.readFileSync(indFile, "utf8")).constant;
    const tot = JSON.parse(fs.readFileSync(totFile, "utf8")).levels.gva;
    let worst = 0, worstAt = null, n = 0;
    for (const [ym, t] of Object.entries(tot)) {
      const s = Object.values(ind).reduce((a, m) => a + (m[ym] ?? NaN), 0);
      if (!Number.isFinite(s)) continue;
      n++;
      const rel = Math.abs(s - t) / t * 100;
      if (rel > worst) { worst = rel; worstAt = ym; }
    }
    if (!n) fail("gdp-industries: sector-sum identity checked 0 quarters");
    else if (worst > 0.1) fail(`gdp-industries: sectors sum deviates ${worst.toFixed(3)}% from Total GVA at ${worstAt}`);
    else ok(`gdp-industries: sectors sum to Total GVA within ${worst.toFixed(4)}% (${n} quarters)`);
  } else fail("gdp-industries: raw level dumps missing for the sector-sum identity");
});

withBundle("gdp-2022", (b) => {
  // the new base must stand alone: its first y/y needs a same-base year-ago
  // level, i.e. one year after the base year starts
  if (b.dates[0] !== "2023-04-01") fail(`gdp-2022: first y/y at ${b.dates[0]}, expected 2023-04-01`);
  else ok("gdp-2022: y/y starts 2023-04 (first quarter with a same-base year-ago level)");
});

withBundle("gdp-accounts", (b) => {
  const sr = b.series.saving_rate;
  if (!sr) return fail("gdp-accounts: saving_rate series missing");
  const vals = sr.data.filter((v) => v != null);
  if (!vals.length) fail("gdp-accounts: saving_rate empty");
  for (const v of vals) {
    if (v < 25 || v > 40) fail(`gdp-accounts: saving_rate ${v} outside plausible 25-40% of nominal GDP`);
  }
  if (vals.every((v) => v >= 25 && v <= 40)) ok(`gdp-accounts: saving rate within 25-40% of nominal GDP (${vals.length} years)`);
});

/* ---- survey-product hard checks (HCES / ASI / ASUSE) ---- */

function withBundle(slug, fn) {
  const file = path.join(ROOT, "data/series", slug + ".json");
  if (!fs.existsSync(file)) return; // absence already failed in the main loop
  fn(load(slug));
}

withBundle("hces-mpce", (b) => {
  const at = (key, ym) => {
    const i = b.dates.findIndex((d) => d.startsWith(ym));
    return i >= 0 ? b.series[key]?.data[i] : undefined;
  };
  // known published figure: All-India rural MPCE 2023-24, without imputation
  const r2324 = at("rural", "2023-04");
  if (r2324 !== 4122) fail(`hces-mpce: rural 2023-24 (without imputation) is ${r2324}, expected 4122`);
  else ok("hces-mpce: rural 2023-24 without imputation = 4122 (published figure)");
  // urban MPCE must exceed rural in every round, both imputation variants
  b.dates.forEach((d, i) => {
    for (const [u, r] of [["urban", "rural"], ["urban_imputed", "rural_imputed"]]) {
      const uv = b.series[u]?.data[i], rv = b.series[r]?.data[i];
      if (uv != null && rv != null && uv <= rv) fail(`hces-mpce: ${u} (${uv}) <= ${r} (${rv}) at ${d}`);
    }
  });
  ok("hces-mpce: urban > rural in all rounds and imputation variants");
});

withBundle("hces-gini", (b) => {
  // range check already enforces [0.2, 0.5]; assert the series are non-empty
  for (const k of ["rural", "urban"]) {
    if (!b.series[k]?.data.some((v) => v != null)) fail(`hces-gini: series ${k} empty`);
  }
  ok("hces-gini: rural/urban Gini present, within [0.2, 0.5] (range check)");
});

withBundle("hces-social", (b) => {
  // ordering sanity: "Others" is the highest of the four group means in both
  // sectors and both rounds (true in the data; note the floor is NOT the
  // same group everywhere — rural ST is lowest, urban SC is lowest)
  b.dates.forEach((d, i) => {
    for (const sec of ["rural", "urban"]) {
      const oth = b.series[`others_${sec}`]?.data[i];
      for (const g of ["st", "sc", "obc"]) {
        const v = b.series[`${g}_${sec}`]?.data[i];
        if (oth != null && v != null && oth < v) fail(`hces-social: others_${sec} (${oth}) < ${g}_${sec} (${v}) at ${d}`);
      }
    }
  });
  ok("hces-social: Others >= ST/SC/OBC in both sectors, both rounds");
});

withBundle("hces-quantities", (b) => {
  // cereals are single-digit kg per head per month; components sum to Total
  b.dates.forEach((d, i) => {
    for (const sec of ["rural", "urban"]) {
      const total = b.series[`total_cereals_${sec}`]?.data[i];
      if (total == null || total < 4 || total > 15) fail(`hces-quantities: total_cereals_${sec} ${total} implausible at ${d}`);
      const sum = ["rice", "wheat", "coarse_grains", "other_cereals"]
        .reduce((a, c) => a + (b.series[`${c}_${sec}`]?.data[i] ?? 0), 0);
      if (total != null && Math.abs(sum - total) > 0.05) fail(`hces-quantities: components sum ${sum.toFixed(3)} != total ${total} (${sec}, ${d})`);
    }
  });
  for (const [k, s] of Object.entries(b.series)) {
    if (s.data.some((v) => v != null && v <= 0)) fail(`hces-quantities.${k}: non-positive quantity`);
  }
  ok("hces-quantities: positive, single-digit totals, components sum to Total Cereals");
});

withBundle("hces-item-values", (b) => {
  for (const [k, s] of Object.entries(b.series)) {
    if (s.data.some((v) => v != null && v <= 0)) fail(`hces-item-values.${k}: non-positive value`);
  }
  // redundancy cross-check against indicator 3 (broad categories in ₹, not
  // baked as a bundle): its All-India "Cereal" row must equal Total Cereals
  const rawFile = path.join(ROOT, "data/raw/hces-records.json");
  if (fs.existsSync(rawFile)) {
    const ind3 = JSON.parse(fs.readFileSync(rawFile, "utf8")).indicators?.["3"] ?? [];
    let checked = 0;
    b.dates.forEach((d, i) => {
      const fy = `${d.slice(0, 4)}-${String((+d.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
      for (const sec of ["Rural", "Urban"]) {
        const pub = ind3.find((r) => r.state === "All India" && r.imputation_type === "Without Imputation" && r.item_category === "Cereal" && r.sector === sec && r.year === fy);
        const v = b.series[`total_cereals_${sec.toLowerCase()}`]?.data[i];
        if (!pub || v == null) continue;
        checked++;
        if (Math.abs(parseFloat(pub.value) - v) > 0.01) fail(`hces-item-values: total_cereals_${sec.toLowerCase()} ${v} != ind-3 Cereal ${pub.value} at ${fy}`);
      }
    });
    if (checked) ok(`hces-item-values: positive; Total Cereals matches ind-3 Cereal row (${checked} cells)`);
    else fail("hces-item-values: ind-3 cross-check matched no cells");
  }
});

withBundle("asi-headline", (b) => {
  const gva = b.series.gva?.data ?? [];
  if (!gva.length || gva.some((v) => v != null && v <= 0)) fail("asi-headline: GVA missing or non-positive");
  else ok("asi-headline: GVA positive in all published years");
  // factories count plausibility for recent years (last 3 published values)
  const nf = (b.series.number_of_factories?.data ?? []).filter((v) => v != null).slice(-3);
  if (!nf.length) fail("asi-headline: number_of_factories empty");
  for (const v of nf) {
    if (v < 200000 || v > 300000) fail(`asi-headline: number_of_factories ${v} outside plausible 200k-300k for recent years`);
  }
  if (nf.length && nf.every((v) => v >= 200000 && v <= 300000)) ok(`asi-headline: recent factory counts plausible (${nf.join(", ")})`);
});

/* ---- ASI legacy blocks: positive counts, below the 2008-block era ---- */
withBundle("asi-headline", (b08) => {
  const first08 = (b08.series.number_of_factories?.data ?? []).find((v) => v != null);
  for (const cy of ["2004", "1998", "1987"]) {
    withBundle(`asi-headline-${cy}`, (b) => {
      const nf = (b.series.number_of_factories?.data ?? []).filter((v) => v != null);
      if (!nf.length) return fail(`asi-headline-${cy}: number_of_factories empty`);
      for (const v of nf) {
        if (v <= 0) fail(`asi-headline-${cy}: non-positive factory count ${v}`);
        // the register only grows era over era: every legacy count must sit
        // below the 2008 block's first published count (155,321 in 2008-09)
        if (first08 != null && v >= first08) fail(`asi-headline-${cy}: factory count ${v} not below the 2008-block era (first 2008-block value ${first08})`);
      }
      ok(`asi-headline-${cy}: factory counts positive (${nf[0]}..${nf.at(-1)}) and below the 2008-block era`);
    });
  }
});

/* ---- asi-accounts: the ledger must carry (nearly) all 57 indicators ---- */
withBundle("asi-accounts", (b) => {
  const n = Object.keys(b.series).length;
  if (n < 55) fail(`asi-accounts: only ${n} of 57 indicators baked`);
  else ok(`asi-accounts: ${n} indicators baked`);
  // redundancy: the ledger's GVA (i19) must equal the headline bundle's gva
  withBundle("asi-headline", (h) => {
    const a = b.series.i19?.data ?? [], g = h.series.gva?.data ?? [];
    const same = a.length === g.length && a.every((v, i) => v === g[i]);
    if (!same) fail("asi-accounts: i19 (GVA) differs from asi-headline.gva");
    else ok("asi-accounts: i19 identical to asi-headline.gva");
  });
});

/* ---- ASUSE portrait: per-1000 bounds and distribution identities ---- */
// modernity mixes rates with the franchise count — bound its per-1000 keys
withBundle("asuse-modernity", (b) => {
  let bad = 0;
  for (const [k, s] of Object.entries(b.series)) {
    if (s.unit !== "per_1000") continue;
    for (const v of s.data) if (v != null && (v < 0 || v > 1000)) { bad++; fail(`asuse-modernity.${k}: per-1000 value ${v} outside [0,1000]`); }
  }
  if (!bad) ok("asuse-modernity: all per-1000 rates within [0,1000]");
  // internet use must be at least computer use is NOT asserted (phones);
  // but any-account must be >= establishment-name account in every cell
  b.dates.forEach((d, i) => {
    for (const sec of ["rural", "urban", "combined"]) {
      const any = b.series[`bank_any_account_${sec}`]?.data[i];
      const est = b.series[`bank_estab_account_${sec}`]?.data[i];
      if (any != null && est != null && any < est) fail(`asuse-modernity: any_account (${any}) < estab_account (${est}) at ${d}, ${sec}`);
    }
  });
  ok("asuse-modernity: any-account rate >= establishment-name-account rate everywhere");
});

// per-1000 distributions must close to 1000 (integer rounding: ±6 parts).
// Identities verified against the published data before being asserted here.
{
  const sumCheck = (slug, groupsOf) => withBundle(slug, (b) => {
    let checked = 0;
    for (const [tag, keys] of groupsOf(b)) {
      b.dates.forEach((d, i) => {
        const vals = keys.map((k) => b.series[k]?.data[i]);
        if (vals.some((v) => v == null)) return;
        const sum = vals.reduce((a, v) => a + v, 0);
        checked++;
        if (Math.abs(sum - 1000) > 6) fail(`${slug}: ${tag} sums to ${sum}, not ~1000, at ${d}`);
      });
    }
    if (checked) ok(`${slug}: per-1000 distributions close to 1000 (${checked} cells)`);
    else fail(`${slug}: no distribution cells found to check`);
  });
  const secs = ["rural", "urban", "combined"];
  sumCheck("asuse-owners", () => [
    ...secs.map((s) => [`social ${s}`, ["st", "sc", "obc", "others", "not_known"].map((g) => `social_${g}_${s}`)]),
    ...secs.map((s) => [`education ${s}`, ["not_literate", "below_primary", "primary_to_secondary", "secondary_to_hs", "hs_to_graduate", "graduate_and_above"].map((g) => `edu_${g}_${s}`)]),
  ]);
  sumCheck("asuse-structure", () => [
    // exclusive ownership set: Proprietary-All (not its M/F split) + the rest
    ...secs.map((s) => [`ownership ${s}`, ["proprietary_all", "partnership_same_hh", "partnership_diff_hh", "shg", "society_trust", "cooperatives", "others"].map((g) => `own_${g}_${s}`)]),
    ...secs.map((s) => [`location ${s}`, ["within_household", "fixed_permanent", "fixed_temporary", "fixed_no_structure", "mobile_market", "street_vendor"].map((g) => `loc_${g}_${s}`)]),
    ...secs.map((s) => [`operation ${s}`, ["perennial", "seasonal", "casual"].map((g) => `op_${g}_${s}`)]),
    ...secs.map((s) => [`months ${s}`, ["le3", "4_6", "7_9", "gt9"].map((g) => `months_${g}_${s}`)]),
    ...secs.map((s) => [`hours ${s}`, ["lt4", "4_7", "8_11", "gt11"].map((g) => `hours_${g}_${s}`)]),
    ...secs.map((s) => [`npi ${s}`, ["npi_donation", "npi_other", "non_npi"].map((g) => `npi_${g}_${s}`)]),
  ]);
}

/* ---- PLFS annual-report extras ---- */

withBundle("plfs-status", (b) => {
  // composition identities as published: the three broad statuses sum to 100
  // per gender; the two self-employment components sum to the total; the
  // three broad industries sum to 100 (rounding: published to one decimal)
  b.dates.forEach((d, i) => {
    for (const g of ["person", "male", "female"]) {
      const se = b.series[`self_employed_${g}`]?.data[i];
      const rg = b.series[`regular_${g}`]?.data[i];
      const cs = b.series[`casual_${g}`]?.data[i];
      if (se == null || rg == null || cs == null) fail(`plfs-status: missing status cell (${g}, ${d})`);
      else if (Math.abs(se + rg + cs - 100) > 0.15) fail(`plfs-status: statuses sum ${(se + rg + cs).toFixed(2)} != 100 (${g}, ${d})`);
    }
    const oa = b.series.se_own_account_person?.data[i];
    const hp = b.series.se_helper_person?.data[i];
    const seP = b.series.self_employed_person?.data[i];
    if (oa != null && hp != null && seP != null && Math.abs(oa + hp - seP) > 0.15)
      fail(`plfs-status: SE components ${oa}+${hp} != ${seP} at ${d}`);
    const indSum = ["primary", "secondary", "tertiary"]
      .reduce((a, k) => a + (b.series[`industry_${k}_person`]?.data[i] ?? NaN), 0);
    if (!Number.isFinite(indSum)) fail(`plfs-status: missing industry cell at ${d}`);
    else if (Math.abs(indSum - 100) > 0.15) fail(`plfs-status: industries sum ${indSum.toFixed(2)} != 100 at ${d}`);
  });
  ok("plfs-status: status, SE-component and industry compositions sum to 100 (±0.15)");
});

withBundle("plfs-earnings", (b) => {
  // the gender gap holds in every published quarter for all three statuses
  b.dates.forEach((d, i) => {
    for (const k of ["regular", "casual", "self_employed"]) {
      const m = b.series[`${k}_male`]?.data[i], f = b.series[`${k}_female`]?.data[i];
      if (m != null && f != null && m <= f) fail(`plfs-earnings: ${k} male (${m}) <= female (${f}) at ${d}`);
    }
  });
  // quarantine honoured: regular/self-employed series must not carry 2017-18
  for (const k of ["regular_person", "self_employed_person"]) {
    const first = b.series[k]?.data.findIndex((v) => v != null);
    if (first === -1 || b.dates[first] < "2018-07-01") fail(`plfs-earnings: ${k} starts ${b.dates[first]} — 2017-18 quarantine not applied`);
  }
  ok("plfs-earnings: male > female throughout; 2017-18 quarantine applied to regular/self-employed");
});

withBundle("plfs-education", (b) => {
  // the ladder story is real in every year: graduates queue, non-literates cannot
  b.dates.forEach((d, i) => {
    const g = b.series.graduate?.data[i], nl = b.series.not_literate?.data[i];
    if (g != null && nl != null && g <= nl) fail(`plfs-education: graduate UR (${g}) <= not-literate (${nl}) at ${d}`);
  });
  ok("plfs-education: graduate UR above not-literate UR in every published year");
});

withBundle("asuse-annual", (b) => {
  const estKeys = Object.keys(b.series).filter((k) => k.startsWith("establishments_"));
  if (!estKeys.length) fail("asuse-annual: no establishment series");
  for (const k of estKeys) {
    if (b.series[k].data.some((v) => v != null && v <= 0)) fail(`asuse-annual.${k}: non-positive establishment count`);
  }
  ok("asuse-annual: establishment counts positive");
});

/* ---- AISHE: composition identities + the teacher reconstruction ---- */

withBundle("aishe-composition", (b) => withBundle("aishe-headline", (h) => {
  // the eight education levels (Both) sum exactly to the Grand Total enrolment
  const LEVELS = ["phd", "mphil", "post_graduate", "under_graduate", "pg_diploma", "diploma", "certificate", "integrated"];
  let worst = 0, worstAt = null;
  b.dates.forEach((d, i) => {
    const total = h.series.enrolment.data[i];
    if (total == null) return;
    const sum = LEVELS.reduce((a, k) => a + (b.series[k]?.data[i] ?? 0), 0);
    const dev = Math.abs(sum - total);
    if (dev > worst) { worst = dev; worstAt = d; }
    if (dev > 1) fail(`aishe-composition: education levels sum ${sum} != Grand Total ${total} at ${d}`);
  });
  if (worst <= 1) ok(`aishe-composition: education levels sum to Grand Total (worst dev ${worst.toFixed(2)} at ${worstAt})`);
  // SC + ST + OBC + Others (residual) sum to the Grand Total
  b.dates.forEach((d, i) => {
    const total = h.series.enrolment.data[i];
    if (total == null) return;
    const sum = ["sc", "st", "obc", "others"].reduce((a, g) => a + (b.series[`social_${g}`]?.data[i] ?? 0), 0);
    if (Math.abs(sum - total) > 1) fail(`aishe-composition: social groups sum ${sum} != Grand Total ${total} at ${d}`);
  });
  ok("aishe-composition: SC + ST + OBC + Others sum to Grand Total");
}));

withBundle("aishe-access", (b) => withBundle("aishe-headline", (h) => {
  // male + female enrolment (Grand Total) = Both, every year
  b.dates.forEach((d, i) => {
    const total = h.series.enrolment.data[i];
    const m = b.series.enrolment_male?.data[i], f = b.series.enrolment_female?.data[i];
    if (total != null && m != null && f != null && Math.abs(m + f - total) > 1)
      fail(`aishe-access: male + female (${m + f}) != Both (${total}) at ${d}`);
  });
  ok("aishe-access: male + female enrolment = Both in every year");
  // GER All Categories Both in the access bundle = headline GER
  let worst = 0;
  b.dates.forEach((d, i) => {
    const acc = b.series.ger_all_both?.data[i], head = h.series.ger.data[i];
    if (acc != null && head != null) worst = Math.max(worst, Math.abs(acc - head));
  });
  if (worst > 0.01) fail(`aishe-access: ger_all_both deviates ${worst}pt from headline`);
  else ok("aishe-access: ger_all_both matches headline GER");
  // GPI >= 0.9 for All Categories in every year (parity is the story)
  b.series.gpi_all?.data.forEach((v, i) => {
    if (v != null && v < 0.9) fail(`aishe-access: gpi_all ${v} below 0.9 at ${b.dates[i]}`);
  });
  ok("aishe-access: GPI All Categories >= 0.9 in every year");
}));

withBundle("aishe-headline", (b) => {
  // the teacher reconstruction: 2021-22 must be the core5 sum (~1.58M), not
  // the broken "All Teacher" value (12,904). Assert the last value is plausible.
  const t = b.series.teachers.data;
  const lastT = t.at(-1);
  if (lastT == null || lastT < 1000000) fail(`aishe-headline: teachers 2021-22 = ${lastT} — reconstruction not applied (expected ~1.58M)`);
  else ok(`aishe-headline: teachers 2021-22 reconstructed to ${lastT.toLocaleString("en-IN")} (source defect disclosed in meta.note)`);
  // enrolment must be strictly increasing (the expansion story)
  for (let i = 1; i < t.length; i++) {
    const e = b.series.enrolment.data;
    if (e[i] != null && e[i - 1] != null && e[i] <= e[i - 1]) fail(`aishe-headline: enrolment not increasing at ${b.dates[i]}`);
  }
  ok("aishe-headline: enrolment strictly increasing across the five rounds");
});

withBundle("aishe-teachers", (b) => {
  // the 2021-22 core5 sum must equal the headline reconstruction exactly
  const FAC = ["professor", "reader_associate", "lecturer_assistant", "demonstrator", "temporary"];
  withBundle("aishe-headline", (h) => {
    const i = b.dates.length - 1;
    const sum = FAC.reduce((s, f) => s + (b.series[`${f}_both`]?.data[i] ?? 0), 0);
    if (sum !== h.series.teachers.data[i]) fail(`aishe-teachers: 2021-22 core5 sum ${sum} != headline teachers ${h.series.teachers.data[i]}`);
    else ok(`aishe-teachers: 2021-22 core5 sum (${sum.toLocaleString("en-IN")}) = headline reconstruction`);
  });
  // the academic-hierarchy gender gradient: female share rises as rank falls
  // (Professor < Reader < Lecturer < Demonstrator) in every year
  b.dates.forEach((d, i) => {
    const share = (f) => {
      const bt = b.series[`${f}_both`]?.data[i], fe = b.series[`${f}_female`]?.data[i];
      return bt != null && fe != null ? fe / bt : null;
    };
    const prof = share("professor"), dem = share("demonstrator");
    if (prof != null && dem != null && prof >= dem) fail(`aishe-teachers: professor female share (${(prof * 100).toFixed(0)}%) >= demonstrator (${(dem * 100).toFixed(0)}%) at ${d} — hierarchy gradient broken`);
  });
  ok("aishe-teachers: female share rises down the faculty hierarchy (professor < demonstrator) in every year");
});

withBundle("aishe-minority", (b) => {
  // Muslims > Other Minority > PWD (Both) in every year — the volume ordering
  b.dates.forEach((d, i) => {
    const mus = b.series.muslims_both?.data[i], om = b.series.other_minority_both?.data[i], pwd = b.series.pwd_both?.data[i];
    if (mus != null && om != null && mus <= om) fail(`aishe-minority: Muslims (${mus}) <= Other Minority (${om}) at ${d}`);
    if (om != null && pwd != null && om <= pwd) fail(`aishe-minority: Other Minority (${om}) <= PWD (${pwd}) at ${d}`);
  });
  ok("aishe-minority: Muslims > Other Minority > PWD in every year");
  // EWS is a later-starting category — its early nulls are the disclosed gap
  const ews = b.series.ews_both?.data ?? [];
  const firstEws = ews.findIndex((v) => v != null);
  if (firstEws < 0 || firstEws < 2) fail(`aishe-minority: EWS starts at index ${firstEws} — expected >= 2 (introduced ~2019-20)`);
  else ok(`aishe-minority: EWS starts at ${b.dates[firstEws]} (disclosed late-start gap, not a fetch failure)`);
});

/* ---- Gender compendium: directional identities ---- */

withBundle("gender-lifeexp", (b) => {
  // female life expectancy > male in every period (the universal pattern)
  b.dates.forEach((d, i) => {
    const m = b.series.life_exp_male?.data[i], f = b.series.life_exp_female?.data[i];
    if (m != null && f != null && f <= m) fail(`gender-lifeexp: female (${f}) <= male (${m}) at ${d}`);
  });
  ok("gender-lifeexp: female > male in every period");
});

withBundle("gender-mmr", (b) => {
  // MMR strictly declining (the steepest mortality improvement)
  const v = b.series.mmr.data.filter((x) => x != null);
  for (let i = 1; i < v.length; i++) if (v[i] >= v[i - 1]) fail(`gender-mmr: not declining at index ${i} (${v[i - 1]} -> ${v[i]})`);
  ok(`gender-mmr: strictly declining (${v[0]} -> ${v.at(-1)})`);
});

withBundle("gender-literacy", (b) => {
  // male literacy > female in every year (the gap, closing but not closed)
  b.dates.forEach((d, i) => {
    const m = b.series.literacy_male?.data[i], f = b.series.literacy_female?.data[i];
    if (m != null && f != null && f >= m) fail(`gender-literacy: female (${f}) >= male (${m}) at ${d}`);
  });
  ok("gender-literacy: male > female (gap closing, not closed)");
});

withBundle("gender-work", (b) => {
  // male LFPR > female LFPR in every year (the stubborn work gap)
  b.dates.forEach((d, i) => {
    const m = b.series.lfpr_male?.data[i], f = b.series.lfpr_female?.data[i];
    if (m != null && f != null && f >= m) fail(`gender-work: female LFPR (${f}) >= male (${m}) at ${d}`);
  });
  ok("gender-work: male LFPR > female throughout");
});

withBundle("gender-fertility", (b) => {
  // TFR declines with education: graduate < illiterate in every year
  b.dates.forEach((d, i) => {
    const ill = b.series.tfr_illiterate?.data[i], grad = b.series.tfr_graduate_and_above?.data[i];
    if (ill != null && grad != null && grad >= ill) fail(`gender-fertility: graduate TFR (${grad}) >= illiterate (${ill}) at ${d}`);
  });
  ok("gender-fertility: TFR declines with education (graduate < illiterate)");
});

withBundle("gender-sexratio", (b) => {
  // the 1991 nadir: the lowest sex ratio in the series
  const v = b.series.sex_ratio.data;
  const minIdx = v.indexOf(Math.min(...v));
  const minY = b.dates[minIdx].slice(0, 4);
  if (minY !== "1991") fail(`gender-sexratio: nadir at ${minY}, expected 1991`);
  else ok(`gender-sexratio: 1991 is the nadir (${v[minIdx]}) — the 'missing women' low point`);
});

/* ---- MNRE: classification break + solar category identity ---- */

withBundle("mnre-sources", (b) => {
  // the Dec 2023 classification break: Large Hydro must be 0 before Dec 2023
  // and >0 from Dec 2023 onward
  const lh = b.series.large_hydro.data;
  const breakIdx = b.dates.findIndex((d) => d.startsWith("2023-12"));
  if (breakIdx < 0) return fail("mnre-sources: Dec 2023 not found in date axis");
  let badBefore = 0, badAfter = 0;
  for (let i = 0; i < breakIdx; i++) if (lh[i] != null && lh[i] > 0) badBefore++;
  for (let i = breakIdx; i < lh.length; i++) if (lh[i] != null && lh[i] === 0) badAfter++;
  if (badBefore) fail(`mnre-sources: Large Hydro >0 before Dec 2023 (${badBefore} months)`);
  if (badAfter) fail(`mnre-sources: Large Hydro =0 after Dec 2023 (${badAfter} months)`);
  if (!badBefore && !badAfter) ok(`mnre-sources: Large Hydro classification break clean — 0 through Nov 2023, ${lh[breakIdx].toLocaleString("en-IN")} MW from Dec 2023`);
  // Solar overtook Wind: latest solar > latest wind
  const sNow = b.series.solar.data.at(-1), wNow = b.series.wind.data.at(-1);
  if (sNow != null && wNow != null && sNow <= wNow) fail(`mnre-sources: Solar (${sNow}) has not overtaken Wind (${wNow})`);
  else ok(`mnre-sources: Solar (${(sNow / 1000).toFixed(1)} GW) > Wind (${(wNow / 1000).toFixed(1)} GW)`);
});

/* ---- NFHS: the direction-of-change identities ---- */
// NOTE: these blocks must stay OUTSIDE the mnre-sources callback above —
// nesting them inside meant one early return in an MNRE check silently
// disabled every NFHS identity.

withBundle("nfhs-anaemia", (b) => {
  // child anaemia WORSENED: NFHS-5 > NFHS-4
  const s = Object.values(b.series).find((x) => x.label.toLowerCase().includes("children age 6-59"));
  if (!s || s.data[0] == null || s.data[1] == null) return fail("nfhs-anaemia: child anaemia series missing");
  if (s.data[1] <= s.data[0]) fail(`nfhs-anaemia: child anaemia did not worsen (${s.data[0]} → ${s.data[1]})`);
  else ok(`nfhs-anaemia: child anaemia worsened (${s.data[0]}% → ${s.data[1]}%) — the central story`);
  // women anaemia also worsened
  const w = Object.values(b.series).find((x) => x.label.toLowerCase().includes("all women age 15-49"));
  if (w && w.data[0] != null && w.data[1] != null && w.data[1] > w.data[0]) ok(`nfhs-anaemia: women anaemia also worsened (${w.data[0]}% → ${w.data[1]}%)`);
});

withBundle("nfhs-child", (b) => {
  // IMR improved: NFHS-5 < NFHS-4
  const imr = Object.values(b.series).find((x) => x.label.toLowerCase().includes("infant mortality"));
  if (imr && imr.data[0] != null && imr.data[1] != null) {
    if (imr.data[1] >= imr.data[0]) fail(`nfhs-child: IMR did not improve (${imr.data[0]} → ${imr.data[1]})`);
    else ok(`nfhs-child: IMR improved (${imr.data[0]} → ${imr.data[1]} per 1,000)`);
  }
  // stunting improved
  const stunt = Object.values(b.series).find((x) => x.label.toLowerCase().includes("stunted"));
  if (stunt && stunt.data[0] != null && stunt.data[1] != null && stunt.data[1] < stunt.data[0]) ok(`nfhs-child: stunting improved (${stunt.data[0]}% → ${stunt.data[1]}%)`);
});

withBundle("nfhs-fertility", (b) => {
  // TFR below replacement in NFHS-5
  const tfr = Object.values(b.series).find((x) => x.label.toLowerCase().includes("total fertility rate"));
  if (tfr && tfr.data[1] != null) {
    if (tfr.data[1] > 2.1) fail(`nfhs-fertility: TFR ${tfr.data[1]} not below replacement (2.1)`);
    else ok(`nfhs-fertility: TFR ${tfr.data[1]} — below replacement (2.1)`);
  }
  // bank accounts jumped massively
  const bank = Object.values(b.series).find((x) => x.label.toLowerCase().includes("bank or savings"));
  if (bank && bank.data[0] != null && bank.data[1] != null) {
    const jump = bank.data[1] - bank.data[0];
    if (jump < 30) fail(`nfhs-fertility: bank account jump only ${jump.toFixed(0)}pt — expected >30`);
    else ok(`nfhs-fertility: women's bank account jumped ${jump.toFixed(0)}pt (${bank.data[0]}% → ${bank.data[1]}%) — the Jan Dhan effect`);
  }
});

withBundle("mnre-solar-categories", (b) => withBundle("mnre-sources", (s) => {
  // the four sub-categories sum to the Solar Total
  let worst = 0, worstAt = null;
  b.dates.forEach((d, i) => {
    const total = s.series.solar.data[i];
    if (total == null) return;
    const sum = (b.series.ground_mounted?.data[i] ?? 0) + (b.series.rooftop?.data[i] ?? 0) + (b.series.hybrid?.data[i] ?? 0) + (b.series.off_grid?.data[i] ?? 0);
    const dev = Math.abs(sum - total);
    if (dev > worst) { worst = dev; worstAt = d; }
    if (dev > 1) fail(`mnre-solar-categories: sum ${sum.toFixed(2)} != Solar Total ${total} at ${d}`);
  });
  if (worst <= 1) ok(`mnre-solar-categories: sub-categories sum to Solar Total (worst dev ${worst.toFixed(2)} MW at ${worstAt})`);
}));

/* ---- the NSO back series meets the current 2011-12 series ----
 * The back series is a bridge only if its last year sits on the current
 * series: its 2011-12 GDP level must equal the 2011-12-base level for the same
 * year (measured 2026-10-09: 87,36,331 vs 87,36,328 crore, a rounding gap). */
{
  const bf = path.join(ROOT, "data/raw/nas-back-levels.json"), nf = path.join(ROOT, "data/raw/nas-nominal.json");
  if (fs.existsSync(bf) && fs.existsSync(nf)) {
    const back = JSON.parse(fs.readFileSync(bf, "utf8")).constant?.gdp?.["2011-04"];
    const cur = JSON.parse(fs.readFileSync(nf, "utf8")).annual_constant_gdp?.["2011-04"];
    if (back == null || cur == null) fail("gdp-back: 2011-12 GDP level missing from the back or current raw dump");
    else if (Math.abs(back / cur - 1) > 1e-4) fail(`gdp-back: 2011-12 GDP ${back} (back series) != ${cur} (current 2011-12 base): the bridge does not meet the series`);
    else ok(`gdp-back: 2011-12 GDP level meets the current series (${back} vs ${cur} crore)`);
  }
}

/* ---- states: state economies (MoSPI regional accounts + RBI Handbook of States) ----
 * One contiguous block (docs/briefs/README.md). Ranges document the measured extremes of the
 * 2026-10-09 bake: Maharashtra's GSDP (~₹45 lakh crore) is the level ceiling; per-capita runs
 * from Bihar (~₹22,000 in 2011-12) to Sikkim and Goa (~₹6-7 lakh); the 2020-21 lockdown year
 * and small economies give real growth from about -30% to +40%. */
{
  const ST = [
    // [slug, range, extra]
    ["states-gsdp-current", [100, 8e6]], ["states-gsdp-constant", [100, 5e6]],
    ["states-nsdp-current", [100, 8e6]], ["states-nsdp-constant", [100, 5e6]],
    ["states-pcnsdp-current", [10000, 1.5e6]], ["states-pcnsdp-constant", [10000, 8e5]],
    ["states-pcgsdp-current", [10000, 1.5e6]], ["states-pcgsdp-constant", [10000, 8e5]],
    // value added by industry: a sub-industry can be negative (losses in a small UT)
    ["states-gsva-current", [-1e5, 8e6]], ["states-gsva-constant", [-1e5, 5e6]],
    ["states-nsva-current", [-1e5, 8e6]], ["states-nsva-constant", [-1e5, 5e6]],
    ["states-taxes-current", [0, 1e6]], ["states-taxes-constant", [0, 6e5]],
    ["states-growth-real", [-60, 80]], ["states-growth-nominal", [-60, 90]],
    ["states-structure", [0, 100]], ["states-industry-shares", [-5, 100]],
    // deficits, own tax and debt over GSDP: a revenue surplus is negative; debt runs to ~60% (Punjab-type)
    ["states-finances", [-30, 150], { staleAfter: "2022-04" }],
    // the fixed panel ends at the latest year three-quarters of states report
    ["states-spread", [-20, 2e6], { staleAfter: "2024-04", seriesRange: { gap_current: [1, 30], gap_constant: [1, 30], cv_constant: [0, 200] } }],
  ];
  for (const [slug, range, extra = {}] of ST) {
    const file = path.join(ROOT, "data/series", slug + ".json");
    if (!fs.existsSync(file)) { fail(`${slug}: data/series/${slug}.json missing`); continue; }
    const b = load(slug);
    const row = { slug, dossier: "states", cadence: 12, ...extra };
    checkMeta(b, slug, "states", "2011-12", "annual");
    checkFreshness(b, slug, row, "states");
    checkCadence(b.dates, 12, slug);
    checkRange(b, range[0], range[1], slug, extra.seriesRange);
    if (Object.keys(b.series).some((k) => /^jammu_and_kashmir(__|$)/.test(k))) fail(`${slug}: an unsplit Jammu & Kashmir series (the territory changed in 2019-20)`);
    for (const [k, s] of Object.entries(b.series)) {
      const span = (() => { const f = s.data.findIndex((v) => v != null); const l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null); return [b.dates[f], b.dates[l]]; })();
      if (/^jammu_and_kashmir_state/.test(k) && span[1] > "2018-04-01") fail(`${slug}.${k}: the J&K state series runs past 2018-19 (${span[1]})`);
      if (/^jammu_and_kashmir_ut/.test(k) && span[0] < (slug.startsWith("states-growth") ? "2020-04-01" : "2019-04-01")) fail(`${slug}.${k}: the J&K UT series starts ${span[0]}, before the UT existed (or growth crosses the split)`);
    }
    console.log(`  ${slug}: ${b.dates.length} pts, ${Object.keys(b.series).length} series, ${b.dates[0]} .. ${b.dates.at(-1)}, vintage ${b.meta.vintage}`);
  }

  // identities on the published figures (every state, every year, both prices)
  withBundle("states-gsva-current", () => {
    for (const pk of ["current", "constant"]) {
      for (const [what, va] of [["gsdp", "gsva"], ["nsdp", "nsva"]]) {
        const P = load(`states-${what}-${pk}`), V = load(`states-${va}-${pk}`), T = load(`states-taxes-${pk}`);
        let worst = 0, worstAt = "", n = 0;
        for (const [k, s] of Object.entries(P.series)) {
          if (s.derived) continue;
          s.data.forEach((v, i) => {
            const d = P.dates[i], at = (B, key) => B.series[key]?.data[B.dates.indexOf(d)];
            const x = at(V, `${k}__total`), t = at(T, `${k}__taxes`), sb = at(T, `${k}__subsidies`);
            if (v == null || x == null || t == null || sb == null) return;
            const dev = Math.abs(x + t - sb - v); n++;
            if (dev > worst) { worst = dev; worstAt = `${k} ${d}`; }
          });
        }
        // published crore values are whole numbers: rounding alone moves the sum by < ₹1 crore
        if (!n) fail(`states-${what}-${pk}: identity checked no cells`);
        else if (worst > 1) fail(`states-${what}-${pk}: ${va.toUpperCase()} + taxes - subsidies misses the published ${what.toUpperCase()} by ₹${worst.toFixed(2)} crore at ${worstAt}`);
        else ok(`states-${what}-${pk}: ${what.toUpperCase()} = ${va.toUpperCase()} + taxes - subsidies within ₹${worst.toFixed(2)} crore (${n} cells): the identity behind the derived states`);
      }
      // industries sum to the total; sub-industries sum to their industry
      const V = load(`states-gsva-${pk}`), inds = V.meta.industries;
      let worst = 0, worstAt = "", n = 0;
      const states = new Set(Object.keys(V.series).map((k) => k.split("__")[0]));
      for (const st of states) V.dates.forEach((d, i) => {
        const g = (key) => V.series[`${st}__${key}`]?.data[i];
        const check = (parts, whole, tag) => {
          const xs = parts.map(g), w = g(whole);
          if (w == null || xs.some((x) => x == null) || !xs.length) return;
          const dev = Math.abs(xs.reduce((a, b) => a + b, 0) - w) / Math.max(1, Math.abs(w)); n++;
          if (dev > worst) { worst = dev; worstAt = `${st} ${tag} ${d}`; }
        };
        check(inds.filter((x) => !x.parent && x.key !== "total").map((x) => x.key), "total", "industries");
        for (const p of new Set(inds.filter((x) => x.parent).map((x) => x.parent))) check(inds.filter((x) => x.parent === p).map((x) => x.key), p, p);
      });
      if (worst > 0.002) fail(`states-gsva-${pk}: parts miss their total by ${(worst * 100).toFixed(2)}% at ${worstAt}`);
      else ok(`states-gsva-${pk}: industries and sub-industries add up within ${(worst * 100).toFixed(3)}% (${n} sums)`);
    }
    // per-capita NSDP: indicator 32 (baked) repeats indicator 25 wherever both are served
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/states-nas.json"), "utf8")).indicators;
    // except a copied block (32 repeating 31, per-capita GSDP: Karnataka on 2026-10-09), which
    // the adapter excludes; the copy is reported here so it is seen on every run
    const i25 = new Map((raw[25] ?? []).map((r) => [`${r.state}|${r.year}`, r]));
    const i31 = new Map((raw[31] ?? []).map((r) => [`${r.state}|${r.year}`, r.current_price]));
    const copies = new Set([...new Set((raw[32] ?? []).map((r) => r.state))].filter((st) => (raw[32] ?? []).filter((r) => r.state === st && r.current_price != null).every((r) => r.current_price === i31.get(`${r.state}|${r.year}`))));
    if (copies.size) ok(`states: NAS 32 is a copy of 31 for ${[...copies].join(", ")} (excluded by the adapter; 25 used)`);
    if (load("states-pcnsdp-current").series.karnataka?.data[0] !== Number(i25.get("Karnataka|2011-12")?.current_price)) fail("states-pcnsdp-current: Karnataka 2011-12 is not MoSPI indicator 25's value");
    let diff = 0, n = 0;
    for (const r of raw[32] ?? []) { if (copies.has(r.state)) continue; const o = i25.get(`${r.state}|${r.year}`); if (!o) continue; for (const f of ["current_price", "constant_price"]) { if (o[f] == null && r[f] == null) continue; n++; if (Number(o[f]) !== Number(r[f])) diff++; } }
    if (!n || diff) fail(`states: per-capita NSDP indicators 25 and 32 disagree in ${diff} of ${n} cells`);
    else ok(`states: per-capita NSDP indicators 25 and 32 agree in all ${n} cells (32 also covers Assam, Haryana, Nagaland, Ladakh)`);
    // growth from levels against MoSPI's one-decimal growth indicators
    for (const pk of ["real", "nominal"]) {
      const G = load(`states-growth-${pk}`), pub = G.crosscheck?.published_growth ?? {};
      let worst = 0, worstAt = "", n = 0;
      for (const [k, arr] of Object.entries(pub)) arr.forEach((p, i) => {
        const v = G.series[k]?.data[i]; if (p == null || v == null) return; n++;
        const dev = Math.abs(v - p); if (dev > worst) { worst = dev; worstAt = `${k} ${G.dates[i]}`; }
      });
      // one-decimal publication (±0.05) plus whole-crore levels in small states
      if (n < 500) fail(`states-growth-${pk}: only ${n} cells cross-checked against MoSPI's growth indicators`);
      else if (worst > 0.15) fail(`states-growth-${pk}: computed growth deviates ${worst.toFixed(2)}pt from MoSPI's published growth at ${worstAt}`);
      else ok(`states-growth-${pk}: computed from levels within ${worst.toFixed(3)}pt of MoSPI's published growth (${n} cells)`);
    }
    // structure: three shares make the whole
    const S = load("states-structure");
    let bad = 0;
    const sts = new Set(Object.keys(S.series).map((k) => k.split("__")[0]));
    for (const st of sts) S.dates.forEach((d, i) => {
      const xs = ["agriculture", "industry", "services"].map((g) => S.series[`${st}__${g}`]?.data[i]);
      if (xs.every((x) => x != null) && Math.abs(xs.reduce((a, b) => a + b, 0) - 100) > 0.05) bad++;
    });
    if (bad) fail(`states-structure: ${bad} state-years where farm, industry and services do not sum to 100`);
    else ok(`states-structure: farm + industry + services = 100 for every state-year`);
    // the spread panel: richest above middle above poorest, the ratio matches its parts
    const P = load("states-spread"), s = P.series;
    let badP = 0;
    P.dates.forEach((d, i) => {
      if (!(s.richest_current.data[i] >= s.median_current.data[i] && s.median_current.data[i] >= s.poorest_current.data[i])) badP++;
      if (Math.abs(s.richest_current.data[i] / s.poorest_current.data[i] - s.gap_current.data[i]) > 0.006) badP++;
    });
    if (badP) fail(`states-spread: ${badP} inconsistent panel cells`);
    else ok(`states-spread: ${P.meta.panel.length}-state panel consistent (richest >= middle >= poorest; ratio = richest / poorest)`);
  });

  // the RBI Handbook against MoSPI: the same NSO figures until the Handbook's vintage
  // (2025 edition) falls behind MoSPI's revisions. Exact to 2020-21 (measured 2026-10-09);
  // later years differ by up to ~18% for small states revised since (Goa).
  withBundle("states-hbs-t021", (h) => {
    for (const [hb, ms] of [["states-hbs-t021", "states-gsdp-current"], ["states-hbs-t022", "states-gsdp-constant"], ["states-hbs-t023", "states-nsdp-current"]]) {
      const H = load(hb), M = load(ms);
      let worst = 0, worstAt = "", n = 0;
      for (const [k, s] of Object.entries(M.series)) {
        if (!H.series[k] || s.derived) continue;
        M.dates.forEach((d, i) => {
          if (d > "2020-04-01") return;
          const j = H.dates.indexOf(d); const a = s.data[i], b = j >= 0 ? H.series[k].data[j] : null;
          if (a == null || b == null) return; n++;
          const dev = Math.abs(b / 1e7 / a - 1); if (dev > worst) { worst = dev; worstAt = `${k} ${d}`; }
        });
      }
      if (n < 200) fail(`${hb}: only ${n} cells compared with MoSPI`);
      else if (worst > 0.0005) fail(`${hb}: RBI Handbook differs from MoSPI ${ms} by ${(worst * 100).toFixed(2)}% at ${worstAt} (to 2020-21, where both carry the same NSO vintage)`);
      else ok(`${hb}: RBI Handbook = MoSPI ${ms} within ${(worst * 100).toFixed(3)}% to 2020-21 (${n} cells)`);
    }
  });

  // every Handbook table baked: shape, disclosure, axis
  {
    const idx = JSON.parse(fs.readFileSync(path.join(ROOT, "data/coverage/states.hbs-index.json"), "utf8"));
    if (idx.problems?.length) fail(`states-hbs: ${idx.problems.length} Handbook table(s) did not bake: ${idx.problems.slice(0, 3).join("; ")}`);
    const tables = new Set(idx.tables.map((t) => t.table));
    if (tables.size < 180) fail(`states-hbs: only ${tables.size} Handbook tables baked (182 on 2026-10-09)`);
    let n = 0;
    for (const t of idx.tables) {
      if (!t.bundle) continue;
      const file = path.join(ROOT, "data/series", t.bundle + ".json");
      if (!fs.existsSync(file)) { fail(`${t.bundle}: missing`); continue; }
      const b = load(t.bundle);
      const dossier = t.sdp ? "states" : "states-hbs";
      if (b.meta.dossier !== dossier) fail(`${t.bundle}: meta.dossier ${b.meta.dossier}, expected ${dossier}`);
      checkMeta(b, t.bundle, dossier, t.sdp ? (t.base ?? "2011-12") : "as published", "annual");
      if (!b.meta.sparse) checkCadence(b.dates, 12, t.bundle);
      checkRange(b, -1e16, 1e16, t.bundle);
      if (Object.keys(b.series).some((k) => /^jammu_and_kashmir(__|$)/.test(k))) fail(`${t.bundle}: an unsplit Jammu & Kashmir series`);
      n++;
    }
    ok(`states-hbs: ${n} Handbook bundles from ${tables.size} tables pass shape, disclosure and split checks`);
  }
}

/* ---- seams: the base-year registry (sources.yml `seams`) ----
 * For every product that has changed ruler: each bundle of that dossier is
 * registered under exactly one base, its meta.base matches, and its dates
 * stay inside that base's window. Bundles drawn from an agency bridge (a
 * published back series) are registered under the bridge, never as a
 * second base. Overlaps between consecutive bases are reported. */
{
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json"));
  const byDossier = {};
  for (const f of files) {
    const slug = f.replace(/\.json$/, "");
    const m = load(slug).meta ?? {};
    (byDossier[m.dossier] ??= []).push(slug);
  }
  for (const [dossier, bases] of Object.entries(cfg.seams ?? {})) {
    const owner = new Map(); // bundle slug -> base entry
    const windowOf = new Map(); // bundle slug -> { from, to } it must stay inside
    for (const b of bases) {
      for (const slug of [...(b.bundles ?? []), ...(b.bridge?.bundles ?? [])]) {
        if (owner.has(slug)) fail(`seams/${dossier}: ${slug} registered under both "${owner.get(slug).base}" and "${b.base}"`);
        owner.set(slug, b);
        // a bridge (an agency back series) may declare its own window
        const viaBridge = (b.bridge?.bundles ?? []).includes(slug);
        windowOf.set(slug, viaBridge && b.bridge.from ? { from: b.bridge.from, to: b.bridge.to ?? null } : { from: b.from, to: b.to });
      }
    }
    for (const slug of byDossier[dossier] ?? []) {
      if (!owner.has(slug)) fail(`seams/${dossier}: ${slug} is not registered under any base in sources.yml seams`);
    }
    let inWindow = 0;
    for (const [slug, b] of owner) {
      const file = path.join(ROOT, "data/series", slug + ".json");
      if (!fs.existsSync(file)) { fail(`seams/${dossier}: registered bundle ${slug} does not exist`); continue; }
      const bundle = load(slug);
      if (bundle.meta.dossier !== dossier) fail(`seams/${dossier}: ${slug} belongs to dossier "${bundle.meta.dossier}"`);
      if (bundle.meta.base !== b.base) fail(`seams/${dossier}: ${slug} meta.base "${bundle.meta.base}" != registered base "${b.base}"`);
      const first = bundle.dates[0].slice(0, 7), last = bundle.dates.at(-1).slice(0, 7);
      const w = windowOf.get(slug);
      if (first < w.from) fail(`seams/${dossier}: ${slug} starts ${first}, before its window on base ${b.base} begins (${w.from})`);
      else if (w.to && last > w.to) fail(`seams/${dossier}: ${slug} runs to ${last}, after its window on base ${b.base} ends (${w.to})`);
      else inWindow++;
    }
    const sorted = [...bases].sort((x, y) => (x.from < y.from ? -1 : 1));
    const overlaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], cur = sorted[i];
      if (prev.to && prev.to >= cur.from) overlaps.push(`${prev.base}/${cur.base} ${cur.from}..${prev.to}`);
    }
    ok(`seams/${dossier}: ${owner.size} bundles on ${bases.length} bases, ${inWindow} inside their window${overlaps.length ? `; overlaps ${overlaps.join(", ")}` : ""}`);
  }
}

if (failures) { console.error(`\n${failures} validation failure(s)`); process.exit(1); }
console.log("validate: all checks passed");
