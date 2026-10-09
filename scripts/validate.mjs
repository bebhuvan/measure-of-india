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
import { readRawFile } from "./lib/util.mjs";
// raw dumps are stored gzipped (scripts/lib/util.mjs readRawFile reads either form)
const rawFileExists = (f) => fs.existsSync(f) || fs.existsSync(f + ".gz");

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

// true when every published point from index i to the series' last point is listed as estimated
function trailingEst(s, dates, i, last) {
  const est = new Set(s.estimated ?? []);
  for (let j = i; j <= last; j++) if (s.data[j] != null && !est.has(dates[j])) return false;
  return true;
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
      // interior (an interpolation) or part of one unbroken run that ends the series (an agency's
      // extrapolation of its latest periods, e.g. BIS India credit; CONTRACT-series rule 2b)
      else if (i <= first || (i >= last && !trailingEst(s, bundle.dates, i, last))) fail(`${slug}.${k}: estimated ${d} is neither interior to the series' span nor part of a trailing run of estimates`);
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
  // ---- nas (wave 2): the rest of the national accounts, nas-deep-build.mjs ----
  // Levels in Rs crore (negative lines: discrepancy, net primary income, stocks, government
  // saving); shares of nominal GDP run to 103 (GNDI exceeds GDP by the remittances);
  // sub-industry growth reaches -62.5 (air transport, 2020-21); the back series'
  // discrepancy reaches -13.6% of GDP (1955-56): its expenditure side is not reconciled
  // with output before the 1990s, as published.
  ...[["", "2011-12", { levels: "2025-04", subs: "2023-04", gcf: "2023-04", q: "2025-07" }], ["-2022", "2022-23", { levels: "2025-04", subs: "2024-04", gcf: "2024-04", q: "2026-04" }]].flatMap(([b, base, st]) => [
    { slug: `gdp${b}-annual-levels`, dossier: "gdp", cadence: 12, staleAfter: st.levels, range: [-2e6, 5e7], base, freq: "annual" },
    { slug: `gdp${b}-annual-growth`, dossier: "gdp", cadence: 12, staleAfter: st.levels, range: [-40, 60], base, freq: "annual" },
    { slug: `gdp${b}-annual-shares`, dossier: "gdp", cadence: 12, staleAfter: st.levels, range: [-15, 110], base, freq: "annual" },
    { slug: `gdp${b}-annual-industries`, dossier: "gdp", cadence: 12, staleAfter: st.levels, range: [-40, 5e7], base, freq: "annual" },
    { slug: `gdp${b}-annual-subindustries`, dossier: "gdp", cadence: 12, staleAfter: st.subs, range: [-80, 5e7], base, freq: "annual" },
    { slug: `gdp${b}-annual-gcf-industries`, dossier: "gdp", cadence: 12, staleAfter: st.gcf, range: [-1e6, 5e7], base, freq: "annual" },
    { slug: `gdp${b}-sectors`, dossier: "gdp", cadence: 12, staleAfter: st.levels, range: [-3e6, 5e7], base, freq: "annual" },
    { slug: `gdp${b}-revisions`, dossier: "gdp", cadence: 12, staleAfter: st.levels, range: [-2e6, 5e7], base, freq: "annual" },
    { slug: `gdp${b}-quarterly-levels`, dossier: "gdp", cadence: 3, staleAfter: st.q, range: [-1e6, 2e7], base },
    { slug: `gdp${b}-quarterly-shares`, dossier: "gdp", cadence: 3, staleAfter: st.q, range: [-15, 100], base },
    { slug: `gdp${b}-quarterly-industry-levels`, dossier: "gdp", cadence: 3, staleAfter: st.q, range: [0, 2e7], base },
  ]),
  ...["levels", "growth", "shares", "industries", "subindustries"].map((k) => ({ slug: `gdp-back-${k}`, dossier: "gdp", cadence: 12, staleAfter: "2011-04", range: k === "shares" ? [-15, 110] : [-2e6, 2e7], base: "2011-12", freq: "annual" })),
  // ---- end nas ----
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
  // ---- jobs (PLFS): two survey designs, each its own base (sources.yml seams: plfs) ----
  // revamped design (from January 2025): the sources.yml base
  { slug: "plfs-monthly", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-cuts", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-monthly-age", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-q25", dossier: "plfs", cadence: 3, staleAfter: "2026-04", range: [0, 100] },
  { slug: "plfs-q25-states-lfpr", dossier: "plfs", cadence: 3, staleAfter: "2026-04", range: [0, 100] },
  { slug: "plfs-q25-states-wpr", dossier: "plfs", cadence: 3, staleAfter: "2026-04", range: [0, 100] },
  { slug: "plfs-q25-states-ur", dossier: "plfs", cadence: 3, staleAfter: "2026-04", range: [0, 100] },
  { slug: "plfs-q25-industry", dossier: "plfs", cadence: 3, staleAfter: "2026-04", range: [0, 100] },
  { slug: "plfs-cy25-india", dossier: "plfs", cadence: 12, staleAfter: "2025-01", range: [0, 100] },
  { slug: "plfs-cy25-states-lfpr", dossier: "plfs", cadence: 12, staleAfter: "2025-01", range: [0, 100] },
  { slug: "plfs-cy25-states-wpr", dossier: "plfs", cadence: 12, staleAfter: "2025-01", range: [0, 100] },
  { slug: "plfs-cy25-states-ur", dossier: "plfs", cadence: 12, staleAfter: "2025-01", range: [0, 100] },
  { slug: "plfs-cy25-workers-states", dossier: "plfs", cadence: 12, staleAfter: "2025-01", range: [0, 100] },
  // ₹: casual day wages from ~₹100 (a state's rural women) to regular monthly pay of
  // ~₹1 lakh in a small UT's urban cell
  { slug: "plfs-cy25-earnings", dossier: "plfs", cadence: 12, staleAfter: "2025-01", range: [20, 200000] },
  // original design (2017-18 to 2024): frozen, each at its last period
  { slug: "plfs-quarterly", dossier: "plfs", cadence: 3, staleAfter: "2024-10", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-quarterly-cuts", dossier: "plfs", cadence: 3, staleAfter: "2024-10", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-quarterly-states-lfpr", dossier: "plfs", cadence: 3, staleAfter: "2024-10", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-quarterly-states-wpr", dossier: "plfs", cadence: 3, staleAfter: "2024-10", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-quarterly-states-ur", dossier: "plfs", cadence: 3, staleAfter: "2024-10", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-quarterly-industry", dossier: "plfs", cadence: 3, staleAfter: "2024-10", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-annual", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-states", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 45], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-status", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  // ₹ levels: casual female r+u floor ~₹165/day, regular male ceiling ~₹22k/mo
  { slug: "plfs-earnings", dossier: "plfs", cadence: 3, staleAfter: "2024-04", range: [100, 60000], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-education", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 45], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-ay-india", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-ay-states-lfpr", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-ay-states-wpr", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-ay-states-ur", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-ay-workers-states", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-conditions", dossier: "plfs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-earnings-cuts", dossier: "plfs", cadence: 3, staleAfter: "2024-04", range: [20, 200000], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-cy-india", dossier: "plfs", cadence: 12, staleAfter: "2024-01", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-cy-states-lfpr", dossier: "plfs", cadence: 12, staleAfter: "2024-01", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-cy-states-wpr", dossier: "plfs", cadence: 12, staleAfter: "2024-01", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-cy-states-ur", dossier: "plfs", cadence: 12, staleAfter: "2024-01", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-cy-workers-states", dossier: "plfs", cadence: 12, staleAfter: "2024-01", range: [0, 100], base: "PLFS original design (2017-18 to 2024)" },
  { slug: "plfs-cy-earnings", dossier: "plfs", cadence: 12, staleAfter: "2024-01", range: [20, 200000], base: "PLFS original design (2017-18 to 2024)" },
  // ---- end jobs ----
  // RBI via eSankhyiki: the mirror lags the RBI's own publications by
  // up to a year, so each bundle carries its own regression floor
  { slug: "rbi-trade", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [-60000, 80000], cross: ["balance", "balance_published", 5] },
  { slug: "rbi-trade-oil", dossier: "rbi", cadence: 1, staleAfter: "2025-06", range: [0, 100000] },
  // low bound is the yen: quoted ₹ per single yen (0.01 in 1966); USD itself
  // stays within 4.76 (pre-1966-devaluation) .. ~90
  // gross legs peak ~69bn/month (Feb 2025 sales); forward book has hit -89bn
  // ₹ Crore stocks, all positive; gross ≈ 63 lakh crore end-Mar 2025
  // ceiling is imports from China (~$113bn FY25); identities checked below
  { slug: "rbi-trade-partners", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [0, 250000], freq: "annual" },
  // ceilings: engineering exports ~$117bn; crude & products imports ~$186bn
  { slug: "rbi-commodities-exports", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [0, 150000], freq: "annual" },
  { slug: "rbi-commodities-imports", dossier: "rbi", cadence: 12, staleAfter: "2024-04", range: [0, 250000], freq: "annual" },
  // gross monthly turnover, both legs: ~$76bn Aug 1996 to ~$3.0tn Jul 2025
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
  { slug: "hces-categories-states", dossier: "hces", cadence: 12, range: [0, 100] },
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
  { slug: "aishe-teachers", dossier: "aishe", cadence: 12, range: [0, 2e6] },
  // minority enrolment: Muslims peak ~2.1M
  { slug: "aishe-minority", dossier: "aishe", cadence: 12, range: [0, 2.5e6] },
  // MNRE: installed capacity in MW. Grand Total peaks ~289k; states peak ~52k
  { slug: "mnre-sources", dossier: "mnre", cadence: 1, range: [0, 300000] },
  { slug: "mnre-solar-categories", dossier: "mnre", cadence: 1, range: [0, 200000] },
  { slug: "mnre-states", dossier: "mnre", cadence: 1, range: [0, 60000] },
  { slug: "mnre-states-solar", dossier: "mnre", cadence: 1, range: [0, 50000] },
  // World Bank WDI (first non-MoSPI family): annual, calendar years. The
  // headline bundle mixes % of GDP with a constant-2015-US$ level — the
  // level carries its own range. Growth dips to about -10 (2020 lockdown).
  { slug: "wdi-manufacturing", dossier: "manufacturing", cadence: 12, staleAfter: "2025-01", range: [-70, 100], seriesRange: { mva_constant_usd: [1e9, 3e12] } },
  { slug: "wdi-manufacturing-composition", dossier: "manufacturing", cadence: 12, staleAfter: "2023-01", range: [0, 100] },
  { slug: "wdi-manufacturing-tech", dossier: "manufacturing", cadence: 12, staleAfter: "2022-01", range: [0, 100] },
  { slug: "wdi-manufacturing-exports", dossier: "manufacturing", cadence: 12, staleAfter: "2024-01", range: [0, 100] },
  // ---- services (scripts/lib/products/services.mjs) ----
  // ISP y/y on a young trial base: April 2026 prints run from -14 (air) to +37 (hotels);
  // range is documentation, wide while the series is a few months old.
  { slug: "services-isp-growth", dossier: "services-isp", cadence: 1, range: [-60, 120] },
  { slug: "services-isp-annual", dossier: "services-isp", cadence: 12, staleAfter: "2025-04", range: [50, 200], freq: "annual" },
  // NAS shares of nominal GVA (0-60), real y/y on the 2011-12 base spans the 2020-21 lockdown
  // (air transport -62.5, storage +112.7 in 2017-18 as published), levels ₹ lakh crore
  { slug: "services-gva-2022-share", dossier: "services-nas", cadence: 12, range: [0, 100] },
  { slug: "services-gva-2022-growth", dossier: "services-nas", cadence: 12, range: [-40, 60] },
  { slug: "services-gva-2022-level", dossier: "services-nas", cadence: 12, range: [0, 400] },
  { slug: "services-gva-2011-share", dossier: "services-nas", cadence: 12, range: [0, 100], base: "2011-12" },
  { slug: "services-gva-2011-growth", dossier: "services-nas", cadence: 12, range: [-80, 130], base: "2011-12" },
  { slug: "services-gva-2011-level", dossier: "services-nas", cadence: 12, range: [0, 400], base: "2011-12" },
  // DBIE services trade, US$ billion monthly and US$ million quarterly/annual; nets swing sign.
  // The monthly table lags RBI's press releases (DBIE 1501 to May 2026 on 2026-10-09).
  { slug: "services-trade-monthly", dossier: "services-trade", cadence: 1, range: [-10, 60], freq: "monthly" },
  { slug: "services-bop-quarterly", dossier: "services-trade", cadence: 3, range: [-200000, 300000], freq: "quarterly" },
  { slug: "services-invisibles-quarterly", dossier: "services-trade", cadence: 3, staleAfter: "2025-04", range: [-1000, 150000], freq: "quarterly" },
  { slug: "services-bop-annual", dossier: "services-trade", cadence: 12, staleAfter: "2025-04", range: [-500000, 1000000], freq: "annual" },
  // PLFS shares of workers, per cent
  { slug: "services-jobs-ay", dossier: "services-jobs", cadence: 12, staleAfter: "2023-07", range: [0, 100], base: "agriculture year (PLFS 2017-18 to 2023-24)" },
  // calendar years split at the PLFS redesign (January 2025): original design frozen at 2024
  { slug: "services-jobs-cy", dossier: "services-jobs", cadence: 12, staleAfter: "2024-01", range: [0, 100], base: "calendar year (PLFS original design, to 2024)" },
  { slug: "services-jobs-cy25", dossier: "services-jobs", cadence: 12, range: [0, 100] },
  // ASUSE: counts (to ~7 crore), ₹ per year, per-1,000 distributions
  { slug: "services-asuse", dossier: "services-asuse", cadence: 12, range: [0, 1e9] },
  { slug: "services-asuse-profile", dossier: "services-asuse", cadence: 12, range: [0, 1000] },
  { slug: "services-asuse-2025", dossier: "services-asuse", cadence: 12, staleAfter: "2025-01", range: [0, 1e9], base: "calendar-year round (ASUSE 2025)" },
  { slug: "services-asuse-profile-2025", dossier: "services-asuse", cadence: 12, staleAfter: "2025-01", range: [0, 1000], base: "calendar-year round (ASUSE 2025)" },
  // ---- end services ----
  // --- rates (atlas-rates family session, 2026-10). Interest rates in per cent; amounts in ₹ crore.
  // Ranges document the measured extremes, they do not curate them: call money printed 80% in the
  // 1990s (monthly high) and MIBOR 68%; one foreign bank's 1-year MCLR is 1.56%; a credit-card WALR
  // of 38.9%; CD rates of 26 to 37% in early 1998 and a CP rate of 37.73% (30 Nov 2017) are as
  // printed. Negative tenors and rates the RBI's tables print are left empty by the adapter.
  // Event-dated, daily and weekly bundles skip the monthly cadence check (noCadence).
  { slug: "rates-policy", dossier: "rates", noCadence: true, freq: "irregular", staleAfter: "2026-10", range: [0, 40] },
  { slug: "rates-monthly", dossier: "rates", cadence: 1, staleAfter: "2026-10", range: [0, 40] },
  { slug: "rates-mpc", dossier: "rates", noCadence: true, freq: "irregular", staleAfter: "2026-10", range: [-100, 100] },
  { slug: "rates-mpc-votes", dossier: "rates", noCadence: true, freq: "irregular", staleAfter: "2026-08", range: [0, 6] },
  { slug: "rates-lending", dossier: "rates", cadence: 1, staleAfter: "2026-08", range: [1, 16] },
  { slug: "rates-mclr", dossier: "rates", cadence: 1, staleAfter: "2026-09", range: [1, 16] },
  { slug: "rates-mclr-banks", dossier: "rates", cadence: 1, staleAfter: "2026-09", range: [1, 16] },
  { slug: "rates-walr-sectors", dossier: "rates", cadence: 1, staleAfter: "2026-08", range: [3, 16] },
  { slug: "rates-benchmarks", dossier: "rates", cadence: 3, freq: "quarterly", staleAfter: "2026-06", range: [0, 100] },
  { slug: "rates-call-daily", dossier: "rates", noCadence: true, freq: "daily", staleAfter: "2026-09", range: [0, 100], seriesRange: ratesRanges("rates-call-daily", { inr_crore: [0, 250000] }) },
  { slug: "rates-call-daily-detail", dossier: "rates", noCadence: true, freq: "daily", staleAfter: "2026-09", range: [0, 100], seriesRange: ratesRanges("rates-call-daily-detail", { inr_crore: [0, 250000] }) },
  { slug: "rates-call-monthly", dossier: "rates", cadence: 1, staleAfter: "2026-09", range: [0, 100] },
  { slug: "rates-money-market", dossier: "rates", noCadence: true, freq: "daily", staleAfter: "2026-09", range: [0, 20], seriesRange: ratesRanges("rates-money-market", { inr_crore: [0, 2e6] }) },
  { slug: "rates-mibor", dossier: "rates", noCadence: true, freq: "daily", staleAfter: "2026-09", range: [0, 100] },
  // liquidity operations print a few negative amounts (long-term repo unwinds), kept as printed
  { slug: "rates-liquidity", dossier: "rates", noCadence: true, freq: "daily", staleAfter: "2026-09", range: [-1e5, 2e6] },
  { slug: "rates-laf", dossier: "rates", noCadence: true, freq: "daily", staleAfter: "2026-10", range: [0, 5000], seriesRange: ratesRanges("rates-laf", { pct: [0, 100], inr_crore: [0, 2e6] }) },
  { slug: "rates-cd", dossier: "rates", noCadence: true, freq: "fortnightly", staleAfter: "2026-09", range: [0, 40], seriesRange: ratesRanges("rates-cd", { inr_crore: [0, 2e6] }) },
  { slug: "rates-cp", dossier: "rates", noCadence: true, freq: "fortnightly", staleAfter: "2026-09", range: [0, 40], seriesRange: ratesRanges("rates-cp", { inr_crore: [0, 2e6] }) },
  { slug: "rates-tbill-91", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2026-09", range: [0, 1e5], seriesRange: ratesRanges("rates-tbill-91", { pct: [0, 20], inr_crore: [0, 1e6] }) },
  { slug: "rates-tbill-182", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2026-09", range: [0, 1e5], seriesRange: ratesRanges("rates-tbill-182", { pct: [0, 20], inr_crore: [0, 1e6] }) },
  { slug: "rates-tbill-364", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2026-09", range: [0, 1e5], seriesRange: ratesRanges("rates-tbill-364", { pct: [0, 20], inr_crore: [0, 1e6] }) },
  // the DBIE table carries cash management bills to May 2020 and the 14-day bill 1997 to 2001: frozen
  { slug: "rates-tbill-cmb", dossier: "rates", noCadence: true, freq: "irregular", staleAfter: "2020-05", range: [0, 1e5], seriesRange: ratesRanges("rates-tbill-cmb", { pct: [0, 20], inr_crore: [0, 1e6] }) },
  { slug: "rates-tbill-14", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2001-05", range: [0, 1e4], seriesRange: ratesRanges("rates-tbill-14", { pct: [0, 20] }) },
  { slug: "rates-tbill-sgl", dossier: "rates", cadence: 1, staleAfter: "2026-06", range: [0, 20] },
  { slug: "rates-gsec-curve", dossier: "rates", cadence: 1, staleAfter: "2026-08", range: [-5, 20] },
  { slug: "rates-gsec-annual", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2025-04", range: [0, 20] },
  { slug: "rates-borrowing", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2025-04", range: [0, 5e6] },
  { slug: "rates-borrowing-weekly", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2026-09", range: [-5e5, 5e6] },
  { slug: "rates-state-borrowing-monthly", dossier: "rates", cadence: 1, staleAfter: "2026-07", range: [-1e5, 1e5] },
  { slug: "rates-state-borrowing", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2024-04", range: [0, 2e6] },
  { slug: "rates-wss", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2026-09", range: [0, 40] },
  { slug: "rates-structure", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2026-04", range: [0, 40] },
  { slug: "rates-gsec-auctions", dossier: "rates", noCadence: true, freq: "irregular", staleAfter: "2026-09", range: [0, 100], seriesRange: ratesRanges("rates-gsec-auctions", { pct: [0, 20], inr_crore: [0, 5e5] }) },
  { slug: "rates-gsec-auctions-fy", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2026-04", range: [0, 500], seriesRange: ratesRanges("rates-gsec-auctions-fy", { pct: [0, 20], inr_crore: [0, 1e7] }) },
  { slug: "rates-sdl-states", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2026-04", range: [0, 20], seriesRange: ratesRanges("rates-sdl-states", { inr_crore: [0, 2e6] }) },
  { slug: "rates-walr-1992", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2014-03", range: [0, 100] },
  { slug: "rates-walr-groups-2005", dossier: "rates", cadence: 12, freq: "annual", staleAfter: "2014-03", range: [0, 40] },
  { slug: "rates-walr-occupation", dossier: "rates", noCadence: true, freq: "irregular", staleAfter: "2026-06", range: [0, 60] },
  { slug: "rates-omo", dossier: "rates", cadence: 1, staleAfter: "2026-06", range: [-5e5, 5e5] },
  { slug: "rates-market-repo", dossier: "rates", noCadence: true, freq: "weekly", staleAfter: "2026-09", range: [0, 5000], seriesRange: ratesRanges("rates-market-repo", { pct: [0, 100], inr_crore: [0, 5e6] }) },
  { slug: "rates-real", dossier: "rates", cadence: 1, staleAfter: "2026-08", range: [-20, 20], base: "CPI 2024=100" },
  { slug: "rates-real-cpi2012", dossier: "rates", cadence: 1, staleAfter: "2025-12", range: [-20, 20], base: "CPI 2012=100" },
  // ---- external (lb/external, 2026-10): the External account on RBI DBIE ----
  // US$ million / ₹ crore as in RBI's tables. Ranges are documentation, set from the first bake
  // with headroom: BoP lines reach ~₹52 lakh crore (rupee receipts in 2026), debt ~US$ 0.8 tn,
  // reserves ~₹75 lakh crore; flows and positions are signed. Weekly and daily bundles skip the
  // monthly cadence check and get their own below.
  { slug: "external-bop", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-200000, 200000] },
  { slug: "external-bop-gross", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [0, 600000] },
  { slug: "external-bop-lines", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-300000, 1200000] },
  { slug: "external-bop-vintages", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-200000, 200000] },
  { slug: "external-bop-inr-lines", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-6e6, 1.2e7] },
  { slug: "external-bop6-lines", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-300000, 700000], base: "BPM6" },
  { slug: "external-bop6-vintages", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-300000, 700000], base: "BPM6" },
  { slug: "external-bop6-inr-lines", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-3e6, 1e7], base: "BPM6" },
  { slug: "external-bop-annual", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-800000, 5e6] },
  { slug: "external-bop-annual-inr", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-7e6, 5e7] },
  // ratios to GDP in per cent and import cover in months; current receipts to payments reaches ~113
  { slug: "external-bop-indicators", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-15, 200] },
  { slug: "external-invisibles", dossier: "external-bop", cadence: 3, staleAfter: "2025-04", range: [0, 500000], base: "BPM6" },
  { slug: "external-invisibles-annual", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-800000, 5e6] },
  { slug: "external-invisibles-annual-inr", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-7e6, 5e7] },
  { slug: "external-iip", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-1e6, 3e6], base: "BPM6" },
  { slug: "external-iip-inr", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-1e7, 3e7], base: "BPM6" },
  { slug: "external-iip-bpm5", dossier: "external-bop", cadence: 3, staleAfter: "2021-07", range: [-1e6, 3e6], base: "BPM5" },
  { slug: "external-iip-bpm5-inr", dossier: "external-bop", cadence: 3, staleAfter: "2021-07", range: [-1e7, 3e7], base: "BPM5" },
  { slug: "external-bop-annual-head", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-800000, 800000] },
  { slug: "external-bop-annual-overall", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-800000, 5e6] },
  { slug: "external-bop-annual-overall-inr", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-7e6, 5e7] },
  { slug: "external-bop6-annual-lines", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-800000, 3e6], base: "BPM6" },
  { slug: "external-bop6-annual-lines-inr", dossier: "external-bop", cadence: 12, staleAfter: "2025-04", range: [-7e6, 3e7], base: "BPM6" },
  { slug: "external-fx-turnover-daily", dossier: "external-flows", noCadence: true, staleAfter: "2026-07", range: [0, 5e5] },
  { slug: "external-forward-premia-paise-daily", dossier: "external-flows", noCadence: true, staleAfter: "2026-06", range: [-100, 1500] },
  { slug: "external-fdi-yearly", dossier: "external-flows", cadence: 12, staleAfter: "2023-04", range: [-200000, 300000] },
  { slug: "external-invisibles-people", dossier: "external-bop", cadence: 3, staleAfter: "2025-04", range: [0, 200000], base: "BPM6" },
  { slug: "external-iip-head", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-1e6, 3e6], base: "BPM6" },
  { slug: "external-iip-summary", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-1e6, 3e6], base: "BPM6" },
  { slug: "external-iip-summary-inr", dossier: "external-bop", cadence: 3, staleAfter: "2026-04", range: [-1e7, 3e7], base: "BPM6" },
  { slug: "external-reserves-weekly", dossier: "external-flows", noCadence: true, staleAfter: "2026-09", range: [0, 2e7] },
  { slug: "external-reserves-weekly-inr", dossier: "external-flows", noCadence: true, staleAfter: "2026-09", range: [0, 2e7] },
  { slug: "external-reserves-monthly-inr", dossier: "external-flows", cadence: 1, staleAfter: "2026-08", range: [0, 2e7] },
  { slug: "external-debt-sector-inr", dossier: "external-flows", cadence: 3, staleAfter: "2026-01", range: [-1000, 2e7] },
  { slug: "external-reserves-monthly", dossier: "external-flows", cadence: 1, staleAfter: "2026-08", range: [0, 2e7] },
  { slug: "external-reserves-annual", dossier: "external-flows", cadence: 12, staleAfter: "2026-03", range: [0, 2e7] },
  // the forward book has reached -US$ 137 bn (a stock); monthly gross legs up to ~US$ 73 bn
  { slug: "external-intervention", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [-300000, 300000] },
  { slug: "external-intervention-inr", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [-3e6, 3e6] },
  { slug: "external-forward-book", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [-300000, 300000] },
  { slug: "external-fx-turnover", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [0, 5e6] },
  { slug: "external-forward-premia", dossier: "external-flows", cadence: 1, staleAfter: "2026-06", range: [-10, 50] },
  // per cent a year beside paise per dollar (12-month cash premium reaches ~550 paise)
  { slug: "external-forward-premia-daily", dossier: "external-flows", noCadence: true, staleAfter: "2026-06", range: [-100, 1000] },
  // the yen is quoted per single yen in this table (0.013 in 1966)
  { slug: "external-rupee", dossier: "external-flows", cadence: 1, staleAfter: "2026-09", range: [0.005, 200] },
  { slug: "external-rupee-sdr", dossier: "external-flows", cadence: 1, staleAfter: "2026-09", range: [1, 200] },
  { slug: "external-rupee-daily", dossier: "external-flows", noCadence: true, staleAfter: "2026-10", range: [1, 200] },
  { slug: "external-rupee-interbank-daily", dossier: "external-flows", noCadence: true, staleAfter: "2026-06", range: [10, 200] },
  { slug: "external-rupee-155", dossier: "external-flows", cadence: 1, staleAfter: "2026-09", range: [0, 2000] },
  { slug: "external-rupee-highlow", dossier: "external-flows", cadence: 1, staleAfter: "2026-08", range: [1, 200] },
  { slug: "external-rupee-month-extremes", dossier: "external-flows", cadence: 1, staleAfter: "2024-01", range: [1, 200] },
  { slug: "external-rupee-annual", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [0.5, 200] },
  { slug: "external-rupee-annual-calendar", dossier: "external-flows", cadence: 12, staleAfter: "2025-01", range: [0.5, 200] },
  { slug: "external-fdi", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [-60000, 60000] },
  { slug: "external-fdi-1995", dossier: "external-flows", cadence: 1, staleAfter: "2011-02", range: [-60000, 60000] },
  { slug: "external-fdi-annual", dossier: "external-flows", cadence: 12, staleAfter: "2022-04", range: [-200000, 300000] },
  { slug: "external-fdi-annual-inr", dossier: "external-flows", cadence: 12, staleAfter: "2019-04", range: [-2e6, 3e6] },
  { slug: "external-fdi-annual-new", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [-200000, 300000] },
  { slug: "external-fdi-annual-new-inr", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [-2e6, 3e6] },
  { slug: "external-fpi", dossier: "external-flows", cadence: 1, staleAfter: "2026-06", range: [-400000, 400000] },
  // counts, US$ million, years and per cent side by side
  { slug: "external-ecb", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [0, 100000] },
  { slug: "external-ecb-2025", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [0, 100000] },
  { slug: "external-ecb-annual", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [0, 200000] },
  { slug: "external-lrs", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [0, 20000] },
  { slug: "external-lrs-annual", dossier: "external-flows", cadence: 12, staleAfter: "2024-04", range: [0, 100000] },
  { slug: "external-nri", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [-50000, 500000] },
  { slug: "external-nri-annual", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [-100000, 500000] },
  { slug: "external-nri-annual-inr", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [-1e6, 5e6] },
  { slug: "external-invoicing", dossier: "external-flows", cadence: 1, staleAfter: "2026-07", range: [0, 2e6] },
  { slug: "external-debt-annual", dossier: "external-flows", cadence: 12, staleAfter: "2026-03", range: [-100, 2e6] },
  { slug: "external-debt-annual-inr", dossier: "external-flows", cadence: 12, staleAfter: "2026-03", range: [-1000, 2e7] },
  { slug: "external-debt-inr", dossier: "external-flows", cadence: 3, staleAfter: "2026-01", range: [-1000, 2e7] },
  { slug: "external-debt", dossier: "external-flows", cadence: 3, staleAfter: "2025-10", range: [-1000, 2e6] },
  { slug: "external-assistance", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [-100000, 100000] },
  { slug: "external-assistance-inr", dossier: "external-flows", cadence: 12, staleAfter: "2025-04", range: [-1e6, 1e6] },
  { slug: "external-mf", dossier: "external-flows", cadence: 12, staleAfter: "2026-03", range: [0, 200000] },
  { slug: "external-mf-inr", dossier: "external-flows", cadence: 12, staleAfter: "2026-03", range: [0, 2e6] },
  { slug: "external-reer-2015", dossier: "external-reer", cadence: 1, staleAfter: "2026-08", range: [40, 200] },
  { slug: "external-reer6-2015", dossier: "external-reer", cadence: 1, staleAfter: "2026-08", range: [40, 200] },
  { slug: "external-reer6-2022", dossier: "external-reer", cadence: 1, staleAfter: "2026-08", range: [40, 200], base: "2022-23=100" },
  { slug: "external-reer6-2018", dossier: "external-reer", cadence: 1, staleAfter: "2024-03", range: [40, 200], base: "2018-19=100" },
  { slug: "external-reer-2004", dossier: "external-reer", cadence: 1, staleAfter: "2021-12", range: [40, 200], base: "2004-05=100" },
  { slug: "external-reer6-2004", dossier: "external-reer", cadence: 1, staleAfter: "2020-12", range: [40, 200], base: "2004-05=100" },
  { slug: "external-reer6-2003", dossier: "external-reer", cadence: 1, staleAfter: "2006-08", range: [40, 200], base: "2003-04=100" },
  { slug: "external-reer-1993", dossier: "external-reer", cadence: 1, staleAfter: "2011-01", range: [40, 200], base: "1993-94=100" },
  { slug: "external-reer6-1993", dossier: "external-reer", cadence: 1, staleAfter: "2011-01", range: [40, 200], base: "1993-94=100" },
  { slug: "external-reer-1985", dossier: "external-reer", cadence: 1, staleAfter: "1993-03", range: [20, 200], base: "1985=100" },
  { slug: "external-reer-1993-calendar", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2010-01", range: [40, 200], base: "1993-94=100" },
  { slug: "external-reer-1993-fiscal", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2010-04", range: [40, 200], base: "1993-94=100" },
  { slug: "external-reer-2004-calendar", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2021-01", range: [40, 200], base: "2004-05=100" },
  { slug: "external-reer-2004-fiscal", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2020-04", range: [40, 200], base: "2004-05=100" },
  { slug: "external-reer-2015-calendar", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2025-01", range: [40, 200] },
  { slug: "external-reer-2015-fiscal", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2025-04", range: [40, 200] },
  { slug: "external-reer6-2015-calendar", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2025-01", range: [40, 200] },
  { slug: "external-reer6-2015-fiscal", dossier: "external-reer", cadence: 12, freq: "annual", staleAfter: "2025-04", range: [40, 200] },
  // ---- end external ----
  // ---- prices wave 2 (lb/prices): CPI deep, CPI-IW, rural wages, CPI-AL/RL deep, WPI old bases ----
  ...["cpi-2024-classes", "cpi-2024-subclasses", ...["rural", "urban"].flatMap((s) => ["divisions", "groups", "classes", "subclasses", "items"].map((l) => `cpi-2024-${s}-${l}`))]
    .map((slug) => ({ slug, dossier: "cpi", cadence: 1, range: [-70, 300], base: "2024=100" })),
  ...["", "-rural", "-urban"].flatMap((s) => [`cpi-2024-states-divisions${s}`, `cpi-2024-states-groups${s}`])
    .map((slug) => ({ slug, dossier: "cpi", cadence: 1, range: [-80, 300], base: "2024=100" })),
  { slug: "cpi-2024-back-sectors", dossier: "cpi", cadence: 1, staleAfter: "2024-12", range: [-8, 20], base: "2024=100" },
  { slug: "cpi-groups", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-30, 70] },
  { slug: "cpi-rural-detail", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-50, 120] },
  { slug: "cpi-urban-detail", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-50, 120] },
  ...["", "-rural", "-urban"].flatMap((s) => [`cpi-states-groups${s}`, `cpi-states-subgroups${s}`])
    .map((slug) => ({ slug, dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-90, 400] })),
  { slug: "cpi-items-2012", dossier: "cpi", cadence: 1, staleAfter: "2025-12", range: [-95, 600] },
  { slug: "cpi-2012-early", dossier: "cpi", cadence: 1, staleAfter: "2015-12", range: [-40, 100] },
  { slug: "cpi-2012-early-states", dossier: "cpi", cadence: 1, staleAfter: "2015-12", range: [-90, 400] },
  { slug: "cpiiw-2016", dossier: "cpiiw", cadence: 1, range: [-20, 40], base: "2016=100" },
  { slug: "cpiiw-2016-index", dossier: "cpiiw", cadence: 1, range: [100, 400], base: "2016=100" },
  { slug: "cpiiw-2001", dossier: "cpiiw", cadence: 1, staleAfter: "2020-08", range: [-20, 40], base: "2001=100" },
  { slug: "cpiiw-1982", dossier: "cpiiw", cadence: 1, staleAfter: "2005-12", range: [-20, 40], base: "1982=100" },
  { slug: "cpiiw-1960", dossier: "cpiiw", cadence: 1, staleAfter: "1988-09", range: [-30, 45], base: "1960=100" },
  { slug: "cpiiw-centres-2016", dossier: "cpiiw", cadence: 1, range: [-30, 50], base: "2016=100" },
  { slug: "cpiiw-centres-2001", dossier: "cpiiw", cadence: 1, staleAfter: "2020-08", range: [-50, 80], base: "2001=100" },
  { slug: "cpiiw-centres-1982", dossier: "cpiiw", cadence: 1, staleAfter: "2005-12", range: [-50, 80], base: "1982=100" },
  // rupees a day: the lowest occupation-state cells near Rs 15 in 1998, the highest near Rs 1,500 now
  { slug: "wages-rural-2013", dossier: "wages-rural", cadence: 1, range: [50, 3000] },
  { slug: "wages-rural-states-2013", dossier: "wages-rural", cadence: 1, range: [20, 3000] },
  { slug: "wages-rural-1998", dossier: "wages-rural", cadence: 1, staleAfter: "2013-10", range: [5, 1500], base: "occupations 1998 (18)" },
  { slug: "wages-rural-states-1998", dossier: "wages-rural", cadence: 1, staleAfter: "2013-10", range: [5, 1500], base: "occupations 1998 (18)" },
  { slug: "cpialrl-states-rl-1986", dossier: "cpialrl", cadence: 1, staleAfter: "2025-05", range: [-25, 45], base: "1986-87=100" },
  { slug: "cpialrl-states-groups-1986", dossier: "cpialrl", cadence: 1, staleAfter: "2025-05", range: [-60, 120], base: "1986-87=100" },
  { slug: "cpialrl-states-rl-2019", dossier: "cpialrl", cadence: 1, range: [50, 300], base: "2019=100" },
  { slug: "cpialrl-states-groups-2019", dossier: "cpialrl", cadence: 1, range: [50, 300], base: "2019=100" },
  { slug: "cpialrl-groups-rl-2019", dossier: "cpialrl", cadence: 1, range: [-10, 300], base: "2019=100" },
  { slug: "wpi-subsubgroups", dossier: "wpi", cadence: 1, staleAfter: "2026-04", range: [-90, 500] },
  { slug: "wpi-2022-subsubgroups", dossier: "wpi", cadence: 1, staleAfter: "2026-08", range: [-90, 500], base: "2022-23=100" },
  ...[["2004", "2004-05=100", "2017-03"], ["1993", "1993-94=100", "2010-03"]].flatMap(([t, base, stale]) => [
    { slug: `wpi-${t}`, dossier: "wpi", cadence: 1, staleAfter: stale, range: [-30, 60], base },
    ...["groups", "subgroups", "subsubgroups", "items"].map((l) => ({ slug: `wpi-${t}-${l}`, dossier: "wpi", cadence: 1, staleAfter: stale, range: [-95, 900], base })),
  ]),
  // ---- end prices wave 2 ----
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
  if (rawFileExists(rawFile)) {
    const raw = readRawFile(rawFile);
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
  if (!rawFileExists(rawFile)) return fail(`${itemsSlug}: ${rawRel} missing`);
  const raw = readRawFile(rawFile);
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
  if (rawFileExists(indFile) && rawFileExists(totFile)) {
    const ind = readRawFile(indFile).constant;
    const tot = readRawFile(totFile).levels.gva;
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
  if (rawFileExists(rawFile)) {
    const ind3 = readRawFile(rawFile).indicators?.["3"] ?? [];
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

/* ---- jobs (PLFS) deep bundles: identities on every cell (scripts/lib/products/plfs-deep.mjs) ---- */
{
  // the three ratios: for every cell the bundles carry, WPR <= LFPR and UR = 100 x (1 - WPR/LFPR)
  // within rounding (1.5 points; the adapter withholds cells that break it, so none may remain)
  const rateSets = [["plfs-ay-india"], ["plfs-cy-india"], ["plfs-cy25-india"], ["plfs-q25"], ["plfs-quarterly-cuts"], ["plfs-monthly-age"],
    ...["ay", "cy", "cy25", "q25", "quarterly"].map((t) => ["lfpr", "wpr", "ur"].map((i) => `plfs-${t}-states-${i}`))];
  for (const set of rateSets) {
    if (!set.every((sl) => fs.existsSync(path.join(ROOT, "data/series", sl + ".json")))) { fail(`plfs deep: missing bundle in ${set.join(", ")}`); continue; }
    const bs = set.map(load);
    const all = Object.assign({}, ...bs.map((b) => b.series));
    const dates = bs[0].dates;
    if (bs.some((b) => b.dates.join() !== dates.join())) { fail(`plfs deep: ${set.join(", ")} do not share one date axis`); continue; }
    let n = 0, bad = 0;
    for (const [k, s] of Object.entries(all)) {
      if (!/(^|__)lfpr_/.test(k)) continue;
      const w = all[k.replace(/(^|__)lfpr_/, "$1wpr_")], u = all[k.replace(/(^|__)lfpr_/, "$1ur_")];
      if (!w || !u) continue;
      s.data.forEach((lf, i) => {
        const wp = w.data[i], ur = u.data[i];
        if (lf == null || wp == null || ur == null) return;
        n++;
        if (wp > lf + 0.05 || Math.abs(100 * (1 - wp / lf) - ur) > 1.5) { bad++; if (bad <= 3) fail(`plfs deep ${set[0]}: ${k} at ${dates[i]}: LFPR ${lf}, WPR ${wp}, UR ${ur} break the identity`); }
      });
    }
    if (!bad) ok(`plfs deep ${set[0]}${set.length > 1 ? " (+" + (set.length - 1) + ")" : ""}: WPR <= LFPR and UR = 1 - WPR/LFPR in all ${n} cells`);
  }
  // quarterly industry shares: agriculture + industry + services = 100 per state, gender, sector, quarter
  for (const sl of ["plfs-quarterly-industry", "plfs-q25-industry"]) withBundle(sl, (b) => {
    let n = 0;
    for (const k of Object.keys(b.series).filter((k) => /(^|__)agriculture__/.test(k))) {
      const ks = ["agriculture", "industry", "services"].map((x) => b.series[k.replace(/(^|__)agriculture__/, `$1${x}__`)]);
      if (ks.some((s) => !s)) { fail(`${sl}: ${k} has no industry or services sibling`); continue; }
      b.dates.forEach((d, i) => {
        const v = ks.map((s) => s.data[i]);
        if (v.some((x) => x == null)) return;
        n++;
        const sum = v.reduce((a, x) => a + x, 0);
        if (Math.abs(sum - 100) > 0.35) fail(`${sl}: ${k} shares sum ${sum.toFixed(1)} at ${d}`);
      });
    }
    ok(`${sl}: agriculture + industry + services = 100 (±0.35) in ${n} cells`);
  });
  // job conditions: "none of the three" can never exceed any one of the three
  withBundle("plfs-conditions", (b) => {
    let n = 0;
    for (const k of Object.keys(b.series).filter((k) => /(^|__)none_of_three__/.test(k))) {
      const parts = ["no_contract", "no_paid_leave", "no_social_security"].map((x) => b.series[k.replace(/(^|__)none_of_three__/, `$1${x}__`)]);
      b.dates.forEach((d, i) => {
        const v = b.series[k].data[i];
        if (v == null) return;
        n++;
        for (const p of parts) if (p?.data[i] != null && v > p.data[i] + 0.15) fail(`plfs-conditions: ${k} ${v} exceeds a single condition (${p.data[i]}) at ${d}`);
      });
    }
    ok(`plfs-conditions: "none of the three" never exceeds a single condition (${n} cells)`);
  });
  // workers by status, every state: self-employed + regular + casual = 100; own-account + helpers = self-employed (usual status)
  for (const sl of ["plfs-ay-workers-states", "plfs-cy-workers-states", "plfs-cy25-workers-states"]) withBundle(sl, (b) => {
    let n = 0, bad = 0;
    for (const k of Object.keys(b.series).filter((k) => /^[a-z_]+__self_employed__[a-z]+_[a-z]+__(psss|cws)$/.test(k))) {
      const [rg, cs, oa, hp] = ["regular", "casual", "own_account", "helper"].map((x) => b.series[k.replace("__self_employed__", `__${x}__`)]);
      b.dates.forEach((d, i) => {
        const se = b.series[k].data[i];
        if (se == null || rg?.data[i] == null || cs?.data[i] == null) return;
        n++;
        const sum = se + rg.data[i] + cs.data[i];
        if (Math.abs(sum - 100) > 0.35) { bad++; if (bad <= 3) fail(`${sl}: ${k} statuses sum ${sum.toFixed(1)} at ${d}`); }
        // own-account + helpers = self-employed on the usual status only (the weekly status's
        // self-employed also hold those with work who did not work that week)
        if (k.endsWith("__psss") && oa?.data[i] != null && hp?.data[i] != null && Math.abs(oa.data[i] + hp.data[i] - se) > 0.35) { bad++; if (bad <= 3) fail(`${sl}: ${k} own-account + helpers != self-employed at ${d}`); }
      });
    }
    if (!n) fail(`${sl}: no status cells found`);
    else if (!bad) ok(`${sl}: statuses sum to 100 and self-employment splits add up in ${n} cells`);
  });
}

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
  // teachers are the published "All Teacher" total in every year (the 2021-22 "defect" was a
  // paging artifact of the 2026-08-09 dump; docs/status/households.md)
  const t = b.series.teachers.data;
  const lastT = t.at(-1);
  if (lastT == null || lastT < 1000000) fail(`aishe-headline: teachers 2021-22 = ${lastT} (expected the published ~16 lakh)`);
  else ok(`aishe-headline: teachers 2021-22 = ${lastT.toLocaleString("en-IN")} (published All Teacher)`);
  // enrolment must be strictly increasing (the expansion story)
  for (let i = 1; i < t.length; i++) {
    const e = b.series.enrolment.data;
    if (e[i] != null && e[i - 1] != null && e[i] <= e[i - 1]) fail(`aishe-headline: enrolment not increasing at ${b.dates[i]}`);
  }
  ok("aishe-headline: enrolment strictly increasing across the five rounds");
});

withBundle("aishe-teachers", (b) => {
  // the six faculty types add up to the published all-teachers total (All India 2020-21 is
  // printed 34 apart; nothing else may be)
  const FAC = ["professor", "reader_associate", "lecturer_assistant", "demonstrator", "temporary", "visiting"];
  b.dates.forEach((d, i) => { for (const g of ["both", "male", "female"]) {
    const sum = FAC.reduce((s, f) => s + (b.series[`${f}_${g}`]?.data[i] ?? 0), 0), all = b.series[`all_${g}`]?.data[i];
    if (all != null && Math.abs(sum - all) > 40) fail(`aishe-teachers: ${g} ${d}: the six types sum to ${sum}, all teachers ${all}`);
  } });
  ok("aishe-teachers: the six faculty types sum to all teachers in every year (within 40)");
  withBundle("aishe-headline", (h) => { if (h.series.teachers.data.at(-1) !== b.series.all_both.data.at(-1)) fail("aishe-teachers: all teachers differs from the headline"); });
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

/* ---- health-gender: the NFHS (nfhs-4-*, nfhs-5-*) and the gender compendium (gender-t*) ----
 * Bundles are found by prefix, so a table or indicator baked tomorrow is checked the day it lands.
 * Ranges are per unit; the identities are the surveys' own arithmetic. */
{
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const NF = files.filter((f) => /^nfhs-[45]-/.test(f)), GT = files.filter((f) => /^gender-t\d{3}/.test(f));
  const nfhsCfg = cfg.dossiers.nfhs, genderCfg = cfg.dossiers.gender;
  const RANGE = { percent: [0, 200], pp: [-60, 60], ratio: [500, 1600], births_per_woman: [0.5, 8], per_1000: [0, 1000], per_1000_women: [0, 320],
    per_100k_live_births: [0, 1000], years: [0, 100], inr: [0, 1e6], inr_amount: [0, 1e13], inr_crore: [0, 1e8], inr_lakh: [0, 1e9],
    count: [0, 1e10], million_persons: [0, 2000], thousand: [0, 1e8], gpi: [0, 10], minutes: [0, 1440], per_100_males: [0, 1000],
    per_lakh_women: [0, 1000], multiple: [0, 10], unstated: [0, 1e8] };
  const ranges = (b, slug) => {
    const r = {};
    for (const [k, s2] of Object.entries(b.series)) { if (!RANGE[s2.unit]) fail(`${slug}.${k}: unit "${s2.unit}" has no range in validate.mjs`); else r[k] = RANGE[s2.unit]; }
    return r;
  };
  // NFHS: one round per bundle, one date, the round's base; every cell in range
  if (NF.length < 30) fail(`nfhs: only ${NF.length} nfhs-4-/nfhs-5- bundles (expected 37)`);
  const ROUND = { 4: { base: "NFHS-4 (2015-16)", date: "2016-01-01" }, 5: { base: "NFHS-5 (2019-21)", date: "2020-01-01" } };
  let triplets = 0, flagged = 0;
  for (const slug of NF) {
    const b = load(slug), R = ROUND[slug[5]];
    checkMeta(b, slug, "nfhs", R.base);
    checkFreshness(b, slug, slug.startsWith("nfhs-5-") ? {} : { stale: false }, "nfhs");
    if (b.dates.length !== 1 || b.dates[0] !== R.date) fail(`${slug}: a round is one cross-section dated ${R.date}; got ${b.dates.join(", ")}`);
    checkRange(b, -Infinity, Infinity, slug, ranges(b, slug));
    // the round's total lies between its rural and urban figures (a combined rate is a weighted
    // mean of the two), except where the source's own cell is flagged inconsistent
    const by = {};
    for (const [k, s2] of Object.entries(b.series)) (by[k.replace(/__(total|rural|urban)$/, "")] ??= {})[s2.sector] = s2;
    for (const [k, o] of Object.entries(by)) {
      if (!o.total || !o.rural || !o.urban || o.total.flags?.caution || o.rural.flags?.caution || o.urban.flags?.caution) continue;
      const t = o.total.data[0], lo = Math.min(o.rural.data[0], o.urban.data[0]), hi = Math.max(o.rural.data[0], o.urban.data[0]);
      triplets++;
      if (t < lo - Math.max(0.15, hi * 0.005) || t > hi + Math.max(0.15, hi * 0.005)) {
        if (o.total.flags?.inconsistent) { flagged++; continue; }
        fail(`${slug}.${k}: total ${t} outside rural ${o.rural.data[0]} and urban ${o.urban.data[0]}`);
      }
    }
    // the DHS cross-check the adapter ran is on the bundle: every pair agrees or is a re-proved quarantine
    for (const c of b.meta.crosscheck_dhs ?? []) if (!c.agrees && !c.quarantined) fail(`${slug}: DHS ${c.dhs} ${c.dhsValue} vs API ${c.api}`);
  }
  ok(`nfhs: ${NF.length} bundles; the total lies between rural and urban in ${triplets - flagged} of ${triplets} places (${flagged} flagged at source)`);
  // the quarantined NFHS-4 sub-indicators never reach a bundle
  for (const slug of NF.filter((x) => x.startsWith("nfhs-4-"))) {
    const q = load(slug).meta.quarantined ?? [];
    for (const s2 of Object.values(load(slug).series)) if (q.some((x) => x.sub === s2.group)) fail(`${slug}: quarantined sub-indicator "${s2.group}" was baked`);
  }
  // the story anchor: child anaemia rose between the rounds (All India, total)
  {
    const k = "children_age_6_59_months_who_are_anaemic_11__all_india__total";
    const a4 = load("nfhs-4-anaemia").series[k]?.data[0], a5 = load("nfhs-5-anaemia").series[k]?.data[0];
    if (a4 == null || a5 == null) fail("nfhs: All India child anaemia missing in a round");
    else ok(`nfhs: child anaemia ${a4}% (NFHS-4) and ${a5}% (NFHS-5)`);
  }

  // gender: every compendium bundle, its unit ranges, and the identities of its tables
  if (GT.length < 150) fail(`gender: only ${GT.length} gender-t bundles (expected about 180)`);
  for (const slug of GT) {
    const b = load(slug);
    checkMeta(b, slug, "gender", b.meta.base);
    checkFreshness(b, slug, slug === "gender-t007" ? {} : { stale: false }, "gender");
    checkRange(b, -Infinity, Infinity, slug, ranges(b, slug));
    if (!b.meta.compendiumTable) fail(`${slug}: no compendium table named`);
  }
  const S = (slug, k) => load(slug).series[k]?.data ?? [];
  // the census sex ratio's low point is 1991 (the "missing women" census)
  { const b = load("gender-t002"), v = b.series.all_india.data; const i = v.indexOf(Math.min(...v.filter((x) => x != null)));
    if (b.dates[i].slice(0, 4) !== "1991") fail(`gender-t002: census sex ratio low point at ${b.dates[i]}, expected 1991`); else ok(`gender-t002: the census sex ratio bottoms in 1991 (${v[i]})`); }
  // sex ratio at birth: the combined ratio lies between rural and urban in every window and state
  { const b = load("gender-t007"); let n = 0;
    for (const [k, s2] of Object.entries(b.series)) { if (!k.startsWith("total__")) continue; const g = k.slice(7);
      s2.data.forEach((t, i) => { const r = b.series["rural__" + g]?.data[i], u = b.series["urban__" + g]?.data[i]; if (t == null || r == null || u == null) return; n++;
        if (t < Math.min(r, u) - 1 || t > Math.max(r, u) + 1) fail(`gender-t007.${k}: ${t} outside rural ${r} and urban ${u} at ${b.dates[i]}`); }); }
    ok(`gender-t007: sex ratio at birth, total between rural and urban in ${n} windows`); }
  // women outlive men in every life-expectancy period, SRS and projection alike
  { const m = S("gender-t018", "male__all_india"), f = S("gender-t018", "female__all_india");
    m.forEach((v, i) => { if (v != null && f[i] != null && f[i] <= v) fail(`gender-t018: female ${f[i]} <= male ${v} at ${load("gender-t018").dates[i]}`); });
    ok("gender-t018: female life expectancy above male in every period"); }
  // census literacy: male above female in every census
  { const m = S("gender-t055-census", "total__male__all_india"), f = S("gender-t055-census", "total__female__all_india");
    if (!m.length || !f.length) fail("gender-t055-census: All India male/female literacy missing");
    m.forEach((v, i) => { if (v != null && f[i] != null && f[i] >= v) fail(`gender-t055-census: female literacy ${f[i]} >= male ${v}`); }); }
  // shares that must add to 100: birth order (t011), projected ages per sex and year (t004),
  // workers by industry per sector and sex (t091), and by status: regular + casual + all
  // self-employed per sector and sex (t090; "all" is the 100 itself, the self-employed parts are a subtotal)
  const sumCheck = (slug, take, groupOf) => {
    const b = load(slug); const sums = {};
    for (const [k, s2] of Object.entries(b.series)) { if (!take(k)) continue; const g = groupOf(k);
      s2.data.forEach((v, i) => { if (v == null) return; const key = g + "|" + b.dates[i]; sums[key] = (sums[key] ?? 0) + v; }); }
    const off = Object.entries(sums).filter(([, v]) => Math.abs(v - 100) > 1.2);
    if (!Object.keys(sums).length) fail(`${slug}: no share groups found`);
    else if (off.length) fail(`${slug}: ${off.length} share groups do not sum to 100 (first: ${off[0][0]} = ${off[0][1].toFixed(1)})`);
    else ok(`${slug}: ${Object.keys(sums).length} share groups sum to 100`);
  };
  sumCheck("gender-t011", () => true, (k) => k.split("__")[0]);
  sumCheck("gender-t004", () => true, (k) => k.split("__")[0]);
  sumCheck("gender-t091-cy25", () => true, (k) => k.split("__").slice(0, 2).join("__"));
  sumCheck("gender-t090-cy25", (k) => /__(regular_wage_salaried_employee|casual_labour|self_employed_all_self_employed)__/.test(k), (k) => k.split("__").slice(0, 2).join("__"));
  // the compendium's NFHS reprints match the NFHS bundles where both are baked (All India, total)
  { let n = 0;
    const pairs = [["gender-t146-nfhs5", "all_india", "nfhs-5-marriage-fertility", "women_age_20_24_years_married_before_age_18__all_india__total"],
      ["gender-t146-nfhs4", "all_india", "nfhs-4-marriage-fertility", "women_age_20_24_years_married_before_age_18__all_india__total"],
      ["gender-t051-nfhs5", "all_india", "nfhs-5-hiv-knowledge", "women_age_15_49_years_who_have_comprehensive__all_india__total"]];
    for (const [g, gk, nf, nk] of pairs) { const a = load(g).series[gk]?.data[0], c = load(nf).series[nk]?.data[0];
      if (a == null || c == null) { fail(`gender/nfhs reprint check: ${g}.${gk} or ${nf}.${nk} missing`); continue; }
      n++; if (Math.abs(a - c) > 0.06) fail(`${g}: compendium prints ${a}, the NFHS API ${c}`); }
    ok(`gender: ${n} NFHS reprints match the NFHS bundles`); }
}

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
  if (rawFileExists(bf) && rawFileExists(nf)) {
    const back = readRawFile(bf).constant?.gdp?.["2011-04"];
    const cur = readRawFile(nf).annual_constant_gdp?.["2011-04"];
    if (back == null || cur == null) fail("gdp-back: 2011-12 GDP level missing from the back or current raw dump");
    else if (Math.abs(back / cur - 1) > 1e-4) fail(`gdp-back: 2011-12 GDP ${back} (back series) != ${cur} (current 2011-12 base): the bridge does not meet the series`);
    else ok(`gdp-back: 2011-12 GDP level meets the current series (${back} vs ${cur} crore)`);
  }
}

/* ---- nas (wave 2): identities of the deep national-accounts bundles ----
 * Published levels are whole crore, so each identity holds to a few crore. India's accounts
 * are fixed-base, so constant-price aggregates add up too: the 11 industries sum to total
 * GVA, the institutional sectors to the total, and taxes less subsidies to net taxes (which
 * is also how we know the API's "Rs Lakh" label on taxes and subsidies is wrong). */
{
  const near = (a, b, tol) => a == null || b == null || Math.abs(a - b) <= Math.max(tol, Math.abs(b) * 2e-6);
  const each = (slug, label, fn) => withBundle(slug, (b) => {
    let n = 0, bad = null;
    b.dates.forEach((d, i) => { const r = fn(b.series, i, d); if (r == null) return; n++; if (!r.ok && !bad) bad = `${d}: ${r.msg}`; });
    if (!n) fail(`${slug}: ${label} checked 0 periods`);
    else if (bad) fail(`${slug}: ${label} fails at ${bad}`);
    else ok(`${slug}: ${label} (${n} periods)`);
  });
  const v = (S, k, i) => S[k]?.data[i] ?? null;
  for (const b of ["gdp", "gdp-2022"]) {
    each(`${b}-annual-levels`, "GDP = GVA + net taxes, both prices", (S, i) => {
      const r = ["constant", "current"].map((p) => [v(S, `gdp_${p}`, i), v(S, `gva_${p}`, i), v(S, `net_taxes_${p}`, i)]).filter((x) => x.every((y) => y != null));
      return r.length ? { ok: r.every(([g, a, t]) => near(g, a + t, 6)), msg: JSON.stringify(r) } : null;
    });
    each(`${b}-annual-levels`, "net taxes = taxes less subsidies (taxes and subsidies are Rs crore, not the API's Rs lakh)", (S, i) => {
      const t = v(S, "taxes_current", i), s = v(S, "subsidies_current", i), n = v(S, "net_taxes_current", i);
      return t == null || s == null ? null : { ok: near(n, t - s, 6), msg: `${t} - ${s} != ${n}` };
    });
    each(`${b}-annual-levels`, "NDP = GDP less consumption of fixed capital", (S, i) => {
      const g = v(S, "gdp_current", i), c = v(S, "cfc_current", i), n = v(S, "ndp_current", i);
      return c == null ? null : { ok: near(n, g - c, 6), msg: `${g} - ${c} != ${n}` };
    });
    each(`${b}-annual-industries`, "the 11 industries sum to total GVA at constant prices", (S, i) => {
      const parts = ["agriculture", "mining", "manufacturing", "utilities", "construction", "trade_hotels", "transport", "finance", "realty", "public_admin", "other_services"].map((k) => v(S, `${k}_constant`, i));
      if (parts.some((x) => x == null)) return null;
      const sum = parts.reduce((a, x) => a + x, 0), tot = v(S, "total_constant", i);
      return { ok: near(sum, tot, 15), msg: `${sum} != ${tot}` };
    });
    each(`${b}-annual-industries`, "the 8 groups sum to total GVA at current prices", (S, i) => {
      const parts = ["agriculture", "mining", "manufacturing", "utilities", "construction", "trade_transport", "finance_realty", "public_admin_other"].map((k) => v(S, `${k}_current`, i));
      if (parts.some((x) => x == null)) return null;
      const sum = parts.reduce((a, x) => a + x, 0), tot = v(S, "total_current", i);
      return { ok: near(sum, tot, 15), msg: `${sum} != ${tot}` };
    });
    each(`${b}-sectors`, "institutional sectors sum to the total (saving and fixed investment)", (S, i) => {
      const sec = ["public_nfc", "private_nfc", "public_fc", "private_fc", "government", "households"];
      const out = [];
      for (const m of ["saving", "gfcf"]) {
        const parts = sec.map((k) => v(S, `${m}_${k}`, i));
        if (parts.some((x) => x == null)) continue;
        out.push([parts.reduce((a, x) => a + x, 0), v(S, `${m}_total`, i)]);
      }
      return out.length ? { ok: out.every(([a, t]) => near(a, t, 15)), msg: JSON.stringify(out) } : null;
    });
    each(`${b}-quarterly-levels`, "quarterly GDP = GVA + net taxes", (S, i) => {
      const g = v(S, "gdp_constant", i), a = v(S, "gva_constant", i), t = v(S, "net_taxes_constant", i);
      return g == null || a == null || t == null ? null : { ok: near(g, a + t, 6), msg: `${a} + ${t} != ${g}` };
    });
    // a stage's growth must sit near the growth its levels imply against the previous year
    // at the stage that stood in the same release; checked loosely, for the latest print
    withBundle(`${b}-revisions`, (bb) => {
      const st = bb.meta.stages?.map((x) => x.key) ?? [];
      if (st.length !== 8) fail(`${b}-revisions: meta.stages must list the 8 MoSPI stages`);
      const first = bb.series.gdp_growth_first, latest = bb.series.gdp_growth_latest;
      if (b === "gdp" && (!first || !latest)) fail(`${b}-revisions: first and latest GDP growth missing`);
      else ok(`${b}-revisions: ${Object.keys(bb.series).length} stage series`);
    });
  }
  // the back series' industries reconcile with its total only from 2004-05: before that the
  // sum runs above or below the published total (+471 crore in 1950-51, -4,630 in 1997-98,
  // current prices), as published; disclosed in the bundle note, held from 2004-05 on
  each("gdp-back-industries", "the 11 back-series industries sum to total GVA at 2011-12 prices, 2004-05 on", (S, i, d) => {
    if (d < "2004-04-01") return null;
    const parts = ["agriculture", "mining", "manufacturing", "utilities", "construction", "trade_hotels", "transport", "finance", "realty", "public_admin", "other_services"].map((k) => v(S, `${k}_constant`, i));
    if (parts.some((x) => x == null)) return null;
    const sum = parts.reduce((a, x) => a + x, 0), tot = v(S, "total_constant", i);
    return { ok: near(sum, tot, 15), msg: `${sum} != ${tot}` };
  });
}

/* ---- services: the family's identities (scripts/lib/products/services.mjs) ---- */
{
  // ISP: y/y computed from index levels agrees with MoSPI's published growth (levels are
  // published to one or two decimals, so a 0.15 pt tolerance)
  for (const slug of ["services-isp-growth", "services-isp-annual"]) withBundle(slug, (b) => {
    let worst = 0, at = null;
    for (const [k, s] of Object.entries(b.series)) s.data.forEach((v, i) => {
      const p = b.crosscheck?.[k]?.[i]; if (v == null || p == null) return;
      const d = Math.abs((slug === "services-isp-annual" ? v - 100 : v) - p); if (d > worst) { worst = d; at = `${k} ${b.dates[i]}`; }
    });
    if (worst > 0.15) fail(`${slug}: computed growth deviates ${worst.toFixed(2)} pt from published at ${at}`);
    else ok(`${slug}: computed growth within ${worst.toFixed(3)} pt of MoSPI's published rate`);
  });
  // NAS: parts add to their groups at current prices, and the derived services total built from
  // the three groups equals the one built from the six finer groups (rounding: 0.5%)
  for (const base of ["2022", "2011"]) withBundle(`services-gva-${base}-level`, (b) => {
    const S = b.series; let worst = 0, at = "";
    const chk = (whole, parts) => b.dates.forEach((d, i) => {
      const w = S[whole]?.data[i]; const ps = parts.map((p) => S[p]?.data[i]);
      if (w == null || ps.some((v) => v == null)) return;
      // compare like with like: the NSO serves groups and parts at different revision stages
      // on the 2011-12 base (groups advance/provisional only); only same-stage years must add up
      const rv = (k) => S[k]?.revisions?.[i];
      if (whole === "total_gva" ? [S.services.revisions?.[i] === "six groups" ? "trade_hotels" : "trade_transport_comm", "agriculture"].some((p) => rv(p) !== rv(whole))
        : parts.some((p) => rv(p) !== rv(whole))) return;
      const dev = Math.abs(ps.reduce((a, c) => a + c, 0) / w - 1); if (dev > worst) { worst = dev; at = `${whole} ${d}`; }
    });
    chk("trade_transport_comm", ["trade_hotels", "transport_comm"]); chk("finance_realty_prof", ["finance", "realty_prof"]); chk("public_admin_other", ["public_admin", "other_services"]);
    chk("trade_hotels", ["trade_repair", "hotels_restaurants"]); chk("transport_comm", ["railways", "road_transport", "water_transport", "air_transport", "transport_services", "storage", "communication"]);
    chk("total_gva", ["services", "goods"]);
    b.crosscheck?.services_from_six_groups?.forEach((v, i) => { const w = S.services.data[i]; if (v == null || w == null) return; const dev = Math.abs(v / w - 1); if (dev > worst) { worst = dev; at = `services (3 vs 6 groups) ${b.dates[i]}`; } });
    if (worst > 0.005) fail(`services-gva-${base}-level: parts do not add to their group (${(worst * 100).toFixed(2)}% at ${at})`);
    else ok(`services-gva-${base}-level: every group equals the sum of its parts (worst ${(worst * 100).toFixed(3)}%)`);
  });
  // BoP: credit - debit = net for every services item, quarterly and annual (US$ 0.5 million)
  for (const slug of ["services-bop-quarterly", "services-bop-annual"]) withBundle(slug, (b) => {
    let worst = 0, at = "";
    for (const k of Object.keys(b.series).filter((k) => k.endsWith("_credit"))) {
      const base = k.slice(0, -7); const c = b.series[k].data, d = b.series[base + "_debit"]?.data, n = b.series[base + "_net"]?.data; if (!d || !n) continue;
      c.forEach((v, i) => {
        if (v == null || d[i] == null || n[i] == null) return;
        // as published: RBI's 1985-86 services row prints net 1,187 against 3,316 - 2,124 = 1,192
        if (slug === "services-bop-annual" && base === "s1_2_1" && b.dates[i] === "1985-04-01") return;
        const e = Math.abs(v - d[i] - n[i]); if (e > worst) { worst = e; at = `${base} ${b.dates[i]}`; }
      });
    }
    if (worst > 1) fail(`${slug}: credit - debit != net by US$ ${worst.toFixed(1)} million at ${at}`);
    else ok(`${slug}: credit - debit = net for every item (worst US$ ${worst.toFixed(2)} million)`);
  });
  // the monthly table and the quarterly BoP: three months sum to the quarter within 3%
  // (monthly data are provisional; RBI revises them pro rata once the quarter is compiled)
  withBundle("services-trade-monthly", (m) => withBundle("services-bop-quarterly", (q) => {
    let worst = 0, at = "", n = 0;
    q.dates.forEach((d, i) => {
      const y = +d.slice(0, 4), mo = +d.slice(5, 7); const ms = [0, 1, 2].map((k) => { const mm = mo + k; return `${mm > 12 ? y + 1 : y}-${String(((mm - 1) % 12) + 1).padStart(2, "0")}-01`; });
      const vs = ms.map((x) => m.series.exports.data[m.dates.indexOf(x)]); const qv = q.series["1_a_b_credit"].data[i];
      if (vs.some((v) => v == null) || qv == null || ms.some((x) => m.dates.indexOf(x) < 0)) return;
      n++; const dev = Math.abs((vs.reduce((a, c) => a + c, 0) * 1000) / qv - 1); if (dev > worst) { worst = dev; at = d; }
    });
    if (worst > 0.03) fail(`services-trade-monthly: three months differ from the BoP quarter by ${(worst * 100).toFixed(1)}% at ${at}`);
    else ok(`services-trade-monthly: monthly exports sum to the BoP quarter within ${(worst * 100).toFixed(2)}% (${n} quarters)`);
  }));
  // PLFS: the 21 NIC sections add to 100 for every gender, sector and year (published to one
  // or two decimals: 0.6 pt)
  for (const slug of ["services-jobs-ay", "services-jobs-cy", "services-jobs-cy25"]) withBundle(slug, (b) => {
    const groups = {};
    for (const [k, s] of Object.entries(b.series)) { const m = k.match(/^sec_[a-u]__(.+)$/); if (m) (groups[m[1]] ??= []).push(s.data); }
    let worst = 0, at = "";
    for (const [g, arrs] of Object.entries(groups)) b.dates.forEach((d, i) => {
      const vs = arrs.map((a) => a[i]); if (vs.every((v) => v == null)) return;
      const dev = Math.abs(vs.reduce((a, c) => a + (c ?? 0), 0) - 100); if (dev > worst) { worst = dev; at = `${g} ${d}`; }
    });
    if (!Object.keys(groups).length) fail(`${slug}: no NIC-section series`);
    else if (worst > 0.6) fail(`${slug}: NIC sections sum to 100 ± ${worst.toFixed(2)} at ${at}`);
    else ok(`${slug}: NIC sections sum to 100 in every cell (worst ${worst.toFixed(2)} pt, ${Object.keys(groups).length} cells)`);
  });
  // ASUSE: the published aggregates in this bundle equal the factories guide's asuse-sectors
  // (same source rows, two adapters): establishments, combined, Other Services and All
  withBundle("services-asuse", (a) => withBundle("asuse-sectors", (s) => {
    const pairs = [["establishments__estimated_no_of_establishments__other_services_group__rural__all", "establishments_rural_other_services"], ["establishments__estimated_no_of_establishments__trading__urban__all", "establishments_urban_trading"], ["workers__all__all__all_activities__rural__all", "workers_rural_all"]];
    let bad = 0;
    for (const [ka, ks] of pairs) a.dates.forEach((d, i) => { const j = s.dates.indexOf(d); const x = a.series[ka]?.data[i], y = s.series[ks]?.data[j]; if (x != null && y != null && x !== y) { bad++; fail(`services-asuse: ${ka} ${d} = ${x} but asuse-sectors ${ks} = ${y}`); } });
    if (!a.series[pairs[0][0]]) fail("services-asuse: establishments, Other Services, rural, all establishments: series missing");
    else if (!bad) ok("services-asuse: published aggregates agree with asuse-sectors");
  }));
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
    const raw = readRawFile(path.join(ROOT, "data/raw/states-nas.json")).indicators;
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

/* ---- external (lb/external, 2026-10): identities of the DBIE external-sector bundles ---- */
{
  const near = (a, b, tol) => a == null || b == null || Math.abs(a - b) <= tol;
  const identity = (slug, what, dates, f, tol) => {
    let worst = 0, at = null, n = 0;
    dates.forEach((d, i) => { const x = f(i); if (x == null || Number.isNaN(x)) return; n++; if (Math.abs(x) > Math.abs(worst)) { worst = x; at = d; } });
    if (!n) fail(`${slug}: ${what}: nothing to check`);
    else if (Math.abs(worst) > tol) fail(`${slug}: ${what}: off by ${worst.toFixed(3)} at ${at}`);
    else ok(`${slug}: ${what}, within ${Math.abs(worst).toFixed(3)} over ${n} periods`);
  };
  const all = (...xs) => (xs.some((x) => x == null) ? null : xs);
  withBundle("external-bop", (b) => {
    const S = b.series, v = (k, i) => S[k].data[i];
    // RBI rounds each line to the million: sums of three or four lines may differ by a few units
    identity("external-bop", "current + capital + errors = overall balance", b.dates, (i) => all(v("current_account", i), v("capital_account", i), v("errors_omissions", i), v("overall_balance", i)) && v("current_account", i) + v("capital_account", i) + v("errors_omissions", i) - v("overall_balance", i), 3);
    identity("external-bop", "current account = goods + invisibles", b.dates, (i) => all(v("current_account", i), v("goods", i), v("invisibles", i)) && v("current_account", i) - v("goods", i) - v("invisibles", i), 3);
    identity("external-bop", "invisibles = services + transfers + income", b.dates, (i) => all(v("invisibles", i), v("services", i), v("transfers", i), v("income", i)) && v("invisibles", i) - v("services", i) - v("transfers", i) - v("income", i), 3);
    withBundle("external-bop-gross", (g) => identity("external-bop-gross", "current receipts - payments = current account (external-bop)", g.dates,
      (i) => all(g.series.current_receipts.data[i], g.series.current_payments.data[i], v("current_account", b.dates.indexOf(g.dates[i]))) && g.series.current_receipts.data[i] - g.series.current_payments.data[i] - v("current_account", b.dates.indexOf(g.dates[i])), 3));
    withBundle("external-bop-vintages", (w) => identity("external-bop-vintages", "latest estimate = external-bop", w.dates,
      (i) => all(w.series.current_account_latest.data[i]) && w.series.current_account_latest.data[i] - v("current_account", b.dates.indexOf(w.dates[i])), 0.001));
    // the indicators' current-account ratio must carry the sign of the fiscal year's four quarters
    withBundle("external-bop-indicators", (ind) => {
      let bad = 0, n = 0;
      ind.dates.forEach((d, i) => {
        const y = +d.slice(0, 4); const r = ind.series.cad_to_gdp.data[i];
        const q = [`${y}-04-01`, `${y}-07-01`, `${y}-10-01`, `${y + 1}-01-01`].map((x) => v("current_account", b.dates.indexOf(x)));
        if (r == null || q.some((x) => x == null)) return;
        const sum = q.reduce((a, x) => a + x, 0); n++;
        if (Math.abs(r) > 0.05 && Math.sign(sum) !== Math.sign(r)) { bad++; fail(`external-bop-indicators: CAD/GDP ${r} in FY ${y}-${String((y + 1) % 100).padStart(2, "0")} has the opposite sign to the quarters' sum ${sum.toFixed(0)}`); }
      });
      if (!bad) ok(`external-bop-indicators: CAD/GDP sign agrees with the quarterly current account in ${n} fiscal years`);
    });
  });
  for (const slug of ["external-reserves-weekly", "external-reserves-monthly", "external-reserves-annual"]) withBundle(slug, (b) => {
    const S = b.series;
    identity(slug, "total = FCA + gold + SDR + IMF position (US$)", b.dates, (i) => S.total_usd.data[i] == null ? null : S.total_usd.data[i] - ["fca", "gold", "sdr", "imf"].reduce((a, k) => a + (S[`${k}_usd`]?.data[i] ?? 0), 0), Math.max(25, 0));
    if (slug.endsWith("weekly")) {
      // week-ending Fridays, plus the extra end-March (and a few holiday-shifted) dates RBI reports:
      // no week may be missing, extra dates are fine
      let gap = 0; for (let i = 1; i < b.dates.length; i++) { const days = (Date.parse(b.dates[i]) - Date.parse(b.dates[i - 1])) / 864e5; if (days > 9) { gap++; fail(`${slug}: ${days} days between ${b.dates[i - 1]} and ${b.dates[i]} (a missing week)`); } }
      const fridays = b.dates.filter((d) => new Date(d + "T00:00:00Z").getUTCDay() === 5).length;
      if (!gap) ok(`${slug}: no missing week; ${fridays} Fridays and ${b.dates.length - fridays} extra reporting dates (31 March and holiday shifts)`);
    }
  });
  withBundle("external-debt-annual", (b) => { const S = b.series;
    identity("external-debt-annual", "gross debt = long-term + short-term", b.dates, (i) => all(S.e_1_gross_external_debt_position.data[i], S.e_1_1_total_long_term_debt.data[i], S.e_1_2_short_term_debt.data[i]) && S.e_1_gross_external_debt_position.data[i] - S.e_1_1_total_long_term_debt.data[i] - S.e_1_2_short_term_debt.data[i], 3);
    withBundle("external-debt", (q) => { const g = q.series.gross_ttl_dbt; if (!g) return fail("external-debt: no gross debt series");
      identity("external-debt", "end-March gross debt = the end-March table (563), within 0.5%", q.dates, (i) => { if (!q.dates[i].endsWith("-01-01")) return null; const j = b.dates.indexOf(`${q.dates[i].slice(0, 4)}-03-01`); const a = S.e_1_gross_external_debt_position.data[j]; return a == null || g.data[i] == null ? null : (g.data[i] - a) / a * 100; }, 0.5); });
  });
  // one source discrepancy, disclosed in the bundle note: BPM5 December 2014 (net -356,010 against
  // assets 522,402 less liabilities 886,645, a gap of 8,233 US$ million in RBI's own table)
  for (const slug of ["external-iip", "external-iip-bpm5"]) withBundle(slug, (b) => { const S = b.series; const n = Object.keys(S).find((k) => /^n_/.test(k));
    identity(slug, "net position = assets - liabilities (source exception: BPM5 Dec 2014)", b.dates, (i) => (slug.endsWith("bpm5") && b.dates[i] === "2014-10-01") || !all(S[n].data[i], S.a_a_assets.data[i], S.l_b_liabilities.data[i]) ? null : S[n].data[i] - S.a_a_assets.data[i] + S.l_b_liabilities.data[i], 3); });
  // September 2018 carries a discrepancy in RBI's own table (grand total above merchant plus
  // inter-bank by about US$ 28-33 bn each side), disclosed in the bundle note and excepted here
  withBundle("external-fx-turnover", (b) => { const S = b.series;
    for (const side of ["purchases", "sales"]) identity("external-fx-turnover", `grand total ${side} = merchant + inter-bank (source exception: Sep 2018)`, b.dates, (i) => b.dates[i] === "2018-09-01" || !all(S[`grand_total_all_all_${side}`].data[i], S[`merchant_all_total_${side}`].data[i], S[`inter_bank_all_total_${side}`].data[i]) ? null : S[`grand_total_all_all_${side}`].data[i] - S[`merchant_all_total_${side}`].data[i] - S[`inter_bank_all_total_${side}`].data[i], 5); });
  withBundle("external-lrs", (b) => { const S = b.series; const top = ["deposit", "purchase_of_immovable_property", "investment_in_equity_debt", "gift", "donations", "travels", "maintenance_of_close_relatives", "medical_treatment", "studies_abroad", "others"];
    identity("external-lrs", "total = the ten purposes", b.dates, (i) => S.total.data[i] == null ? null : S.total.data[i] - top.reduce((a, k) => a + (S[k]?.data[i] ?? 0), 0), 1); });
  // a base year's own months average 100: the index is anchored where it says it is
  for (const slug of ["external-reer-1985", "external-reer-1993", "external-reer-2004", "external-reer-2015", "external-reer6-1993", "external-reer6-2003", "external-reer6-2004", "external-reer6-2015", "external-reer6-2018", "external-reer6-2022"]) withBundle(slug, (b) => {
    const y = b.meta.base.slice(0, 4);
    const months = y === "1985" ? b.dates.filter((d) => d.startsWith("1985")) : b.dates.filter((d) => d >= `${y}-04-01` && d < `${+y + 1}-04-01`);
    if (months.length !== 12) return fail(`${slug}: base year ${b.meta.base} not fully on the axis`);
    for (const [k, s] of Object.entries(b.series)) { const avg = months.reduce((a, d) => a + s.data[b.dates.indexOf(d)], 0) / 12;
      if (Math.abs(avg - 100) > 1) fail(`${slug}.${k}: base-year average ${avg.toFixed(2)}, not 100`); }
    ok(`${slug}: every series averages 100 (within 1) over its base year ${b.meta.base}`);
  });
}

/* ---- credit (lb/credit): money, credit and banks ----
 * Every credit-* bundle: meta, cadence, ranges by unit. Then the family's identities, each
 * of which has caught or would catch a real failure: deposits = demand + time; non-food =
 * bank credit - food; industry = its three sizes; the NPA flow balances; M3 = its parts;
 * credit used in a state = what is sanctioned there and used there + what comes from
 * elsewhere; growth equals the RBI's printed growth; and the values checked by hand against
 * RBI publications (docs/status/credit.md) stay what they were. */
{
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => /^credit-.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, ""));
  if (files.length < 50) fail(`credit: only ${files.length} credit-* bundles (expected 55)`);
  // growth rates of small or negative stocks (net RBI credit to government) run to thousands of per cent
  const RANGE = { inr_lakh_crore: [-100, 400], pct: [-100, 2500], count: [0, 200000], ratio: [0, 20] };
  for (const slug of files) {
    const b = load(slug);
    checkMeta(b, slug, "credit", b.meta.base, b.meta.frequency);
    if (b.meta.frequency === "monthly") checkCadence(b.dates, 1, slug);
    if (b.meta.frequency === "quarterly") checkCadence(b.dates, 3, slug);
    if (b.meta.frequency === "annual" && !["credit-frauds"].includes(slug)) checkCadence(b.dates, 12, slug);
    if (["fortnightly", "weekly", "irregular"].includes(b.meta.frequency)) for (let i = 1; i < b.dates.length; i++) if (b.dates[i] <= b.dates[i - 1]) fail(`${slug}: dates not ascending at ${b.dates[i]}`);
    const unit = String(b.meta.unit).split(":")[0];
    for (const [k, s] of Object.entries(b.series)) if (!s.unit) fail(`${slug}.${k}: no unit`);
    // the deep tables (one bundle per RBI table, credit-deep.mjs) hold every kind of number a
    // table prints; they get a sanity range per series unit, the guide's bundles the tight one
    if (b.meta.dossier === "credit-deep" || ["credit-women-districts", "credit-places-states", "credit-places-states-2004", "credit-places-states-2017", "credit-places-states-annual", "credit-npa-movement-banks", "credit-loan-quality-banks"].includes(slug)) {
      // a foreign bank with almost no deposits prints deposit ratios in the millions of per cent
      const DEEP_RANGE = { count: [0, 5e9], inr_crore: [-1e8, 1e9], inr_lakh_crore: [-1e3, 1e4], lakh_count: [0, 5e4], pct: [-1e7, 1e7], pct_yoy: [-1e5, 1e5], pct_per_annum: [0, 100], times: [-1e3, 1e4], inr: [0, 1e8], inr_lakh: [-1e6, 1e6], usd_millions: [0, 1e7] };
      const sr = Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, DEEP_RANGE[s.unit] ?? [NaN, NaN]]));
      for (const [k, s] of Object.entries(b.series)) if (!DEEP_RANGE[s.unit]) fail(`${slug}.${k}: unit ${s.unit} has no range`);
      checkRange(b, -Infinity, Infinity, slug, sr);
      continue;
    }
    // mixed bundles carry the unit in each series name
    const sr = {};
    if (unit === "mixed") for (const [k, s] of Object.entries(b.series)) sr[k] = /_pct$/.test(s.name) ? RANGE.pct : /_accounts$/.test(s.name) ? [0, 100000] : /_offices$/.test(s.name) ? [0, 200000] : /_cases$/.test(s.name) ? [0, 100000] : /_amount$/.test(s.name) && slug.startsWith("credit-frauds") ? [0, 200000] : RANGE.inr_lakh_crore;
    const [lo, hi] = slug === "credit-money-annual" ? [-10000, 10000] : RANGE[unit] ?? [-1e9, 1e9];
    checkRange(b, lo, hi, slug, sr);
  }
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  const ident = (slug, label, fn) => { const b = load(slug); let n = 0, bad = 0, worst = 0, at = null;
    b.dates.forEach((d, i) => { const r = fn(b.series, i, d); if (!r) return; n++; const dev = Math.abs(r[0] - r[1]); if (dev > worst) { worst = dev; at = d; } if (dev > r[2]) bad++; });
    if (!n) fail(`credit ${slug}: identity "${label}" checked no dates`);
    else if (bad) fail(`credit ${slug}: ${label} fails on ${bad} of ${n} dates (worst ${worst.toFixed(3)} at ${at})`);
    else ok(`credit ${slug}: ${label} (${n} dates, worst ${worst.toFixed(3)})`); };
  ident("credit-scb", "deposits = demand + time", (S, i) => S.deposits.data[i] != null && S.demand_deposits.data[i] != null && S.time_deposits.data[i] != null && [S.deposits.data[i], S.demand_deposits.data[i] + S.time_deposits.data[i], 0.02]);
  ident("credit-scb", "credit = loans + bills", (S, i) => { const p = ["loans_cash_credit_overdrafts", "inland_bills_purchased", "inland_bills_discounted", "foreign_bills_purchased", "foreign_bills_discounted"].map((k) => S[k].data[i]); return S.credit.data[i] != null && p.every((v) => v != null) && [S.credit.data[i], p.reduce((a, c) => a + c, 0), 0.02]; });
  for (const sl of ["credit-sectors", "credit-sectors-2007"]) {
    ident(sl, "non-food = bank credit - food", (S, i) => S.bank_credit.data[i] != null && S.food_credit.data[i] != null && S.non_food_credit.data[i] != null && [S.non_food_credit.data[i], S.bank_credit.data[i] - S.food_credit.data[i], 0.005]);
    ident(sl, "industry = micro and small + medium + large", (S, i) => S.industry.data[i] != null && [S.industry.data[i], S.industry_micro_small.data[i] + S.industry_medium.data[i] + S.industry_large.data[i], 0.02]);
    ident(sl, "the four sectors sit inside non-food credit (selected banks: 85-100%)", (S, i) => { const sum = ["agriculture", "industry", "services", "personal_loans"].reduce((a, k) => a + (S[k].data[i] ?? NaN), 0); return Number.isFinite(sum) && [Math.min(Math.max(sum / S.non_food_credit.data[i], 0.85), 1.0), sum / S.non_food_credit.data[i], 0]; });
  }
  ident("credit-sectors", "personal loans = the sum of their nine types", (S, i) => { const p = ["consumer_durables", "housing", "advances_against_fds", "advances_against_shares", "credit_cards", "education", "vehicle_loans", "gold_loans", "other_personal_loans"].map((k) => S[k].data[i]); return S.personal_loans.data[i] != null && p.every((v) => v != null) && [S.personal_loans.data[i], p.reduce((a, c) => a + c, 0), 0.02]; });
  // the monthly sectoral bank credit is the Section 42 figure of the same reporting date
  {
    const s = load("credit-sectors"), f = load("credit-scb"); let n = 0, bad = 0;
    s.dates.forEach((m, i) => { const d = s.meta.reportingDates[i], j = f.dates.indexOf(d); if (j < 0 || s.series.bank_credit.data[i] == null) return; n++; if (Math.abs(s.series.bank_credit.data[i] / f.series.credit.data[j] - 1) > 0.003) { bad++; fail(`credit-sectors: bank credit ${s.series.bank_credit.data[i]} on ${d} != Section 42 ${f.series.credit.data[j]}`); } });
    if (!bad) ok(`credit-sectors: bank credit equals the Section 42 return on ${n} shared reporting dates`);
  }
  // growth equals the RBI's printed growth wherever a release printed a one-year comparison
  {
    const g = load("credit-growth"), raw = readRawFile(path.join(ROOT, "data/raw/credit-sectoral.json")).rbi_sectoral_credit;
    const c = Object.fromEntries(raw.columns.map((k, i) => [k, i])); const s = load("credit-sectors");
    const printed = new Map();
    for (const r of raw.rows) if (r[c.category_code] === "I" && r[c.growth_yoy_pct] != null && r[c.release_date] >= "2024-01-01" && Math.abs((Date.parse(r[c.observation_date]) - Date.parse(r[c.year_ago_date])) / 864e5 - 365) <= 20) { const p = printed.get(r[c.observation_date]); if (!p || +r[c.release_prid] > +p.prid) printed.set(r[c.observation_date], { v: r[c.growth_yoy_pct], prid: r[c.release_prid] }); }
    let n = 0, bad = 0;
    g.dates.forEach((m, i) => { const d = s.meta.reportingDates[s.dates.indexOf(m)], p = printed.get(d); if (!p || g.series.headline.data[i] == null) return; n++; if (Math.abs(p.v - g.series.headline.data[i]) > 0.05) { bad++; fail(`credit-growth: headline ${g.series.headline.data[i]} in ${m} != RBI printed ${p.v.toFixed(2)}`); } });
    if (n < 12) fail(`credit-growth: only ${n} months matched to RBI printed growth`); else if (!bad) ok(`credit-growth: headline equals RBI's printed growth on ${n} months`);
  }
  ident("credit-money", "M3 = currency + demand + time + other deposits with RBI", (S, i) => S.m3.data[i] != null && [S.m3.data[i], S.currency_with_public.data[i] + S.demand_deposits.data[i] + S.time_deposits.data[i] + S.other_deposits_rbi.data[i], 0.05]);
  ident("credit-money", "M3 including the merger = its parts", (S, i) => S.m3_incl_merger.data[i] != null && [S.m3_incl_merger.data[i], S.currency_with_public.data[i] + S.demand_deposits.data[i] + S.time_deposits_incl_merger.data[i] + S.other_deposits_rbi.data[i], 0.05]);
  ident("credit-money-monthly", "M3 = M1 + time deposits", (S, i) => S.m3.data[i] != null && S.time_deposits.data[i] != null && [S.m3.data[i], S.m1.data[i] + S.time_deposits.data[i], 0.05]);
  for (const g of ["all", "public", "private"]) ident("credit-npa-movement", `${g}: closing = opening + additions - reductions - write-offs`, (S, i) => [`${g}_gross_opening`, `${g}_gross_additions`, `${g}_gross_reductions`, `${g}_gross_write_offs`, `${g}_gross_closing`].every((k) => S[k]?.data[i] != null) && [S[`${g}_gross_closing`].data[i], S[`${g}_gross_opening`].data[i] + S[`${g}_gross_additions`].data[i] - S[`${g}_gross_reductions`].data[i] - S[`${g}_gross_write_offs`].data[i], 0.05]);
  {
    const m = load("credit-npa-movement"), a = load("credit-npa-amounts"); let n = 0, bad = 0;
    m.dates.forEach((d, i) => { const j = a.dates.indexOf(d), x = m.series.all_gross_closing.data[i], y = j >= 0 ? a.series.all_gnpa.data[j] : null; if (x == null || y == null) return; n++; if (Math.abs(x / y - 1) > 0.05) { bad++; fail(`credit: NPA movement closing ${x} != report 330 gross NPAs ${y} in ${d}`); } });
    if (!bad) ok(`credit: report 1114 summed bank by bank meets report 330's gross NPAs within 5% (${n} years)`);
  }
  ident("credit-utilisation", "credit used = used where sanctioned + brought in from other states", (S, i) => { const out = []; for (const k of Object.keys(S).filter((k) => k.endsWith("_utilised") && k !== "all_india_utilised")) { const st = k.replace(/_utilised$/, ""); out.push(Math.abs(S[k].data[i] - S[`${st}_sanctioned_used_here`].data[i] - S[`${st}_sanctioned_elsewhere_used_here`].data[i])); } return [Math.max(...out), 0, 0.01]; });
  ident("credit-women", "women's credit sits inside credit to individuals", (S, i) => S.all_india_women_amount.data[i] != null && [Math.min(S.all_india_women_amount.data[i], S.all_india_individuals_amount.data[i]), S.all_india_women_amount.data[i], 0]);
  // the deep tables (credit-deep.mjs) against the guide's own bundles and against each other
  {
    const x = (a, b, tol) => a != null && b != null && Math.abs(a / b - 1) <= tol;
    const cross = (label, A, ka, B, kb, scale, tol, dateMap = (d) => d) => { const a = load(A), b = load(B); let n = 0, bad = 0;
      a.dates.forEach((d, i) => { const j = b.dates.indexOf(dateMap(d)); if (j < 0) return; const va = a.series[ka]?.data[i], vb = b.series[kb]?.data[j]; if (va == null || vb == null) return; n++; if (!x(va * scale, vb, tol)) { bad++; if (bad <= 3) fail(`credit-deep: ${label}: ${A}.${ka} ${va} vs ${B}.${kb} ${vb} on ${d}`); } });
      if (!n) fail(`credit-deep: ${label}: no shared dates`); else if (!bad) ok(`credit-deep: ${label} (${n} dates)`); };
    cross("money stock M3 (report 25) = CAS M3 including the merger", "credit-deep-money-stock-fortnightly", "msm_1_7_m3", "credit-money", "m3_incl_merger", 1e-5, 0.001);
    cross("BSR-1 all-India credit by state and bank group (report 952) = the bank-group table (942)", "credit-deep-bsr1-state-bankgroup", "all_india__all_india__all_scheduled_commercial_banks__amount", "credit-bank-groups", "all_scheduled_commercial_banks_amount", 1e-5, 0.001);
    { const g = load("credit-deep-spatial-glance"), s = load("credit-states"); let n = 0, bad = 0;
      g.dates.forEach((d, i) => { const j = s.dates.indexOf(d), k = s.dates.indexOf(`${+d.slice(0, 4) - 1}${d.slice(4)}`); const v = g.series.x__rpt_1_3__credit_growth?.data[i]; if (j < 0 || k < 0 || v == null) return; n++;
        const ours = (s.series.all_india_credit.data[j] / s.series.all_india_credit.data[k] - 1) * 100; if (Math.abs(ours - v) > 0.05) { bad++; fail(`credit-deep: statement 1 credit growth ${v} vs statement 3A ${ours.toFixed(3)} on ${d}`); } });
      if (!n) fail("credit-deep: statement 1 vs 3A: no shared dates"); else if (!bad) ok(`credit-deep: spatial statement 1's credit growth = statement 3A's levels (${n} quarters)`); }
    { const d = load("credit-deep-bsr1a-district-gender"), S = d.series, p = "all_india__all_india__all_india__";
      const ok2 = ["accounts", "amount"].every((m) => Math.abs(S[p + "men_" + m].data[0] + S[p + "women_" + m].data[0] - S[p + m].data[0]) <= Math.max(1, S[p + m].data[0] * 1e-6));
      if (ok2) ok("credit-deep: BSR-1 table 1.14, men + women = all individuals (all India)"); else fail("credit-deep: BSR-1 table 1.14, men + women != all individuals"); }
    { const a = load("credit-deep-bsr1a-account-type"), z = load("credit-deep-bsr1a-size"); const sum = (b, re) => Object.entries(b.series).filter(([k]) => re.test(k)).reduce((t, [, s]) => t + (s.data.at(-1) ?? 0), 0);
      const lhs = sum(a, /__accounts$/) - sum(a, /__big_accounts$/), rhs = sum(z, /^(a|b)_.*__accounts$/);
      if (lhs === rhs) ok(`credit-deep: BSR-1 annual, all accounts less those above ₹2 lakh = the two smallest size bands (${rhs})`); else fail(`credit-deep: BSR-1 annual accounts identity ${lhs} != ${rhs}`); }
  }
  // values checked by hand against RBI publications (docs/status/credit.md): they must not move
  // unless the RBI revises them, in which case re-check and update both places
  const HAND = [
    ["credit-npa", "all_gnpa_ratio", "2018-03-01", 11.2, 0.05],        // RBI Trend and Progress 2017-18: 11.2%
    ["credit-npa", "all_gnpa_ratio", "2025-03-01", 2.22, 0.05],        // RBI Trend and Progress 2024-25: 2.2%
    ["credit-scb", "deposits", "2026-09-15", 276.231, 0.001],          // RBI statement of position, 15 Sep 2026: ₹2,76,23,065.76 crore
    ["credit-scb-ratios", "deposits_growth", "2026-09-15", 17.31, 0.05], // RBI WSS, 15 Sep 2026: 17.3%
    ["credit-growth", "non_food_credit", "2026-08-01", 18.77, 0.05],   // RBI sectoral credit release, 30 Sep 2026: 18.8%
    ["credit-growth", "agriculture", "2026-08-01", 17.22, 0.05],       // same release: 17.2%
    ["credit-growth", "industry", "2026-08-01", 18.23, 0.05],          // same release: 18.2%
    ["credit-frauds", "total_cases", "2025-03-01", 23879, 0.5],        // RBI Trend and Progress 2024-25: 23,879 frauds
    ["credit-frauds", "total_amount", "2025-03-01", 34771, 1],         // same: ₹34,771 crore
  ];
  for (const [sl, k, d, v, tol] of HAND) { const b = load(sl), i = b.dates.indexOf(d), got = i >= 0 ? b.series[k]?.data[i] : null; if (!near(got, v, tol)) fail(`credit hand-check: ${sl}.${k} at ${d} is ${got}, checked by hand as ${v}`); else ok(`credit hand-check: ${sl}.${k} at ${d} = ${got}`); }
}

/* ---- trade (lb/trade): TradeStat and DBIE merchandise-trade bundles ----
 * Every trade-* bundle gets the generic checks (meta vs sources.yml, cadence, ranges, gap
 * disclosure, freshness). Family identities: parts sum to the printed total, balance is
 * exports minus imports, oil plus non-oil is the total, a financial year is the sum of its
 * months, and the two publications of one customs record agree where they overlap. */
{
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => /^trade-.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, ""));
  // ranges document the measured extremes: the 2025-26 deficit (-333,248 US$ mn), imports
  // ~776,000; commodity quantum indices reach several thousand on a small base and print 0
  // for a year with no trade
  const RANGES = { usd_million: [-500000, 1000000], inr_crore: [-40000000, 90000000], index: [0, 50000], million_tonnes: [0, 400], quantity: [0, 1e15] };
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  for (const slug of files) {
    const b = load(slug);
    const key = /^trade-dbie/.test(slug) ? "trade-dbie" : "trade";
    const freq = b.meta.frequency;
    checkMeta(b, slug, key, b.meta.base, freq);
    const step = { monthly: 1, quarterly: 3, annual: 12 }[freq];
    if (!step) fail(`${slug}: frequency "${freq}" unknown`);
    else if (!/-ytd/.test(slug)) checkCadence(b.dates, step, slug);
    // commodity-level quantum indices start from tiny base-year volumes (electric current
    // exports, SITC 35, print near 5 million on base 2012-13): documented, not curated
    const [lo, hi] = /-uvi-/.test(slug) ? [0, 1e7] : RANGES[b.meta.unit] ?? [-Infinity, Infinity];
    checkRange(b, lo, hi, slug);
    // retired rulers (older bases and groupings, closed HS-edition years) are frozen; live
    // annual bundles must reach the financial year that holds the monthly floor's year-ago month
    const floor = cfg.dossiers[key]?.stale_after;
    const fyFloor = floor ? `${+floor.slice(0, 4) - (floor.slice(5, 7) < "04" ? 2 : 1)}-04` : null;
    checkFreshness(b, slug, b.meta.retired || b.meta.closed ? { stale: false } : { staleAfter: freq === "monthly" ? floor : fyFloor }, key);
    if (b.meta.revision) for (const d of Object.keys(b.meta.revision)) if (!b.dates.includes(d)) fail(`${slug}: meta.revision names ${d}, not on the axis`);
  }
  ok(`trade: ${files.length} bundles through the generic checks`);

  // balance = exports - imports; oil + non-oil = total (DBIE monthly and annual, both currencies)
  for (const slug of ["trade-dbie-monthly", "trade-dbie-monthly-inr", "trade-dbie-annual", "trade-dbie-annual-inr", "trade-total", "trade-total-inr"].filter((x) => files.includes(x))) {
    const S = load(slug).series, D = load(slug).dates;
    const tol = /inr/.test(slug) ? 30 : 3;
    let bad = 0, worst = 0;
    D.forEach((d, i) => {
      const e = S.exports.data[i], m = S.imports.data[i], bl = S.balance.data[i];
      // known: the RBI prints a June 2001 rupee balance of -1,970 crore against exports minus
      // imports of -1,904 (its own arithmetic slip); shown as published, disclosed in the note
      if (e != null && m != null && bl != null && !(slug === "trade-dbie-monthly-inr" && d === "2001-06-01") && !near(e - m, bl, tol)) { bad++; worst = Math.max(worst, Math.abs(e - m - bl)); }
      for (const f of ["exports", "imports"]) {
        const o = S[f + "_oil"]?.data[i], n = S[f + "_non_oil"]?.data[i], t = S[f].data[i];
        // the RBI's oil split can lag a revision of the total by a few months: 0.5% tolerance
        // known: in the RBI's own tables the Feb and Mar 2017 oil split (an earlier print) sums
        // about 1.3% above the revised total; disclosed in the bundle note, not smoothed
        const KNOWN = ["2017-02-01", "2017-03-01"];
        if (o != null && n != null && t != null && !KNOWN.includes(d) && !near(o + n, t, Math.max(tol, Math.abs(t) * 0.005))) { bad++; worst = Math.max(worst, Math.abs(o + n - t)); if (bad < 4) console.error(`   ${slug} ${d} ${f}: oil ${o} + non-oil ${n} != ${t}`); }
      }
    });
    if (bad) fail(`${slug}: ${bad} identity breaks (balance or oil split), worst ${worst.toFixed(2)}`);
    else ok(`${slug}: balance = exports - imports and oil + non-oil = total in every period`);
  }

  // TradeStat: chapters and headings sum to the printed India total (rounding: 0.05 per line)
  for (const slug of files.filter((f) => /^trade-hs[24]-(exports|imports)(-fy|-ytd)?(-inr)?$/.test(f))) {
    const b = load(slug), keys = Object.keys(b.series).filter((k) => k !== "total");
    let worst = 0, at = null;
    b.dates.forEach((d, i) => {
      const t = b.series.total.data[i]; if (t == null) return;
      const sum = keys.reduce((a, k) => a + (b.series[k].data[i] ?? 0), 0);
      const dev = Math.abs(sum - t) / Math.max(1, Math.abs(t));
      if (dev > worst) { worst = dev; at = d; }
    });
    if (worst > 0.001) fail(`${slug}: lines sum ${(worst * 100).toFixed(3)}% away from the printed total at ${at}`);
    else ok(`${slug}: lines sum to the printed total within ${(worst * 100).toFixed(4)}%`);
  }
  // a financial year is the sum of its twelve months (US$, both flows, HS 2)
  for (const f of ["exports", "imports"]) {
    if (!files.includes(`trade-hs2-${f}`) || !files.includes(`trade-hs2-${f}-fy`)) continue;
    const M = load(`trade-hs2-${f}`), Y = load(`trade-hs2-${f}-fy`);
    let worst = 0, at = null, n = 0;
    Y.dates.forEach((d, j) => {
      const y0 = +d.slice(0, 4), months = Array.from({ length: 12 }, (_, k) => `${k < 9 ? y0 : y0 + 1}-${String(((k + 3) % 12) + 1).padStart(2, "0")}-01`);
      const idx = months.map((m) => M.dates.indexOf(m));
      if (idx.some((i) => i < 0)) return;
      const sum = idx.reduce((a, i) => a + M.series.total.data[i], 0), t = Y.series.total.data[j];
      const dev = Math.abs(sum - t) / t; n++;
      if (dev > worst) { worst = dev; at = d; }
    });
    // the monthly values take each month's latest print; the March cumulative is one print: they can differ by revisions
    if (worst > 0.01) fail(`trade-hs2-${f}-fy: a financial year differs ${(worst * 100).toFixed(2)}% from the sum of its months at ${at}`);
    else ok(`trade-hs2-${f}-fy: ${n} years within ${(worst * 100).toFixed(3)}% of the sum of their months`);
  }
  // the two publications of one customs record agree (TradeStat annual vs RBI annual, US$)
  if (files.includes("trade-hs2-exports-fy") && files.includes("trade-dbie-annual")) {
    const A = load("trade-dbie-annual");
    for (const f of ["exports", "imports"]) {
      const Y = load(`trade-hs2-${f}-fy`);
      let worst = 0, at = null;
      Y.dates.forEach((d, j) => { const i = A.dates.indexOf(d); if (i < 0 || A.series[f].data[i] == null) return; const dev = Math.abs(Y.series.total.data[j] / A.series[f].data[i] - 1); if (dev > worst) { worst = dev; at = d; } });
      if (worst > 0.01) fail(`trade: TradeStat and RBI annual ${f} differ ${(worst * 100).toFixed(2)}% at ${at}`);
      else ok(`trade: TradeStat and RBI annual ${f} agree within ${(worst * 100).toFixed(2)}% (different prints of one record)`);
    }
  }
  // partners: every country sums to the India total (regions overlap nothing)
  for (const f of ["exports", "imports"]) {
    const slug = `trade-partners-${f}`; if (!files.includes(slug)) continue;
    const P = load(slug), T = load("trade-total");
    let worst = 0, at = null;
    P.dates.forEach((d, i) => { const j = T.dates.indexOf(d); if (j < 0) return; const sum = Object.values(P.series).reduce((a, s) => a + (s.data[i] ?? 0), 0); const dev = Math.abs(sum / T.series[f].data[j] - 1); if (dev > worst) { worst = dev; at = d; } });
    if (worst > 0.002) fail(`${slug}: partners sum ${(worst * 100).toFixed(3)}% away from India's total at ${at}`);
    else ok(`${slug}: partners sum to India's total within ${(worst * 100).toFixed(3)}%`);
  }
  // the EIDB defect stays documented, not hidden: report whether it is still there
  {
    const zlib = await import("node:zlib");
    const f = path.join(ROOT, "data/raw/trade/eidb-check/export-hs2-usd-2023.json.gz");
    if (fs.existsSync(f)) {
      const r = JSON.parse(zlib.gunzipSync(fs.readFileSync(f)).toString());
      const num = (c) => parseFloat(String(c).replace(/,/g, ""));
      const body = r.rows.filter((x) => /^\d\d$/.test(x[1]));
      const tot = r.rows.find((x) => /Total/.test(x.join(" ")));
      const ratio = body.reduce((a, x) => a + num(x[5]), 0) / num(tot[3]);
      ok(`trade: EIDB 2023-24 chapter sum is ${ratio.toFixed(3)} x its printed total (the double count that keeps EIDB out of every bundle)`);
    }
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

/* ---- bis family session: BIS (India and peers), RBI house price index, NHB RESIDEX ----
 * Rows run through the same meta/freshness/cadence/range checks as PRODUCTS. Peer bundles are
 * one geography each (CONTRACT-series rule 8): their geo is checked against the adapter's
 * PEERS table, not against the dossier's IND. Ranges are documentation of measured extremes. */
{
  const { PEERS } = await import("./lib/products/bis.mjs");
  const BIS_ROWS = [
    // credit % of GDP: India's total peaked near 190; private credit 1951 floor ~ 4
    { slug: "bis-credit", dossier: "bis", cadence: 3, range: [0, 250], base: "% of GDP", freq: "quarterly" },
    { slug: "bis-credit-inr", dossier: "bis", cadence: 3, range: [0, 1e6], base: "INR billion, current prices", freq: "quarterly" },
    { slug: "bis-credit-usd", dossier: "bis", cadence: 3, range: [0, 1e5], base: "USD billion, current prices", freq: "quarterly" },
    // the gap is negative as often as positive (about -15 after 2013's bank clean-up years)
    { slug: "bis-credit-gap", dossier: "bis", cadence: 3, range: [-40, 250], base: "% of GDP", freq: "quarterly" },
    { slug: "bis-dsr", dossier: "bis", cadence: 3, range: [0, 40], base: "% of income", freq: "quarterly" },
    { slug: "bis-property", dossier: "bis", cadence: 3, range: [-30, 500], base: "2010=100", freq: "quarterly" },
    { slug: "bis-property-cities", dossier: "bis", cadence: 3, range: [10, 250], base: "2022-23=100", freq: "quarterly" },
    { slug: "bis-property-10cities", dossier: "bis", cadence: 3, staleAfter: "2025-01", range: [50, 400], base: "2010-11=100", freq: "quarterly" },
    // levels in billions of each currency (yen to ~2,000 bn) beside y/y swings of +-60%
    { slug: "bis-gli", dossier: "bis", cadence: 3, range: [-80, 3000], base: "billions of the currency of denomination", freq: "quarterly" },
    { slug: "bis-eer", dossier: "bis", cadence: 1, staleAfter: "2026-06", range: [50, 250], base: "2020=100", freq: "monthly" },
    { slug: "bis-eer-daily", dossier: "bis", noCadence: true, staleAfter: "2026-06", range: [50, 250], base: "2020=100", freq: "daily" },
    // policy rate: 2% (1946) to 14.5% (1990s); the 1946 floor is the bank rate of the time
    { slug: "bis-policy-rate", dossier: "bis", cadence: 1, staleAfter: "2026-03", range: [1, 20], base: "per cent a year", freq: "monthly" },
    { slug: "bis-policy-rate-daily", dossier: "bis", noCadence: true, staleAfter: "2026-03", range: [1, 20], base: "per cent a year", freq: "daily" },
    { slug: "bis-xru-monthly", dossier: "bis", cadence: 1, staleAfter: "2026-06", range: [4, 120], base: "INR per USD", freq: "monthly" },
    { slug: "bis-xru-quarterly", dossier: "bis", cadence: 3, staleAfter: "2026-04", range: [4, 120], base: "INR per USD", freq: "quarterly" },
    { slug: "bis-xru-annual", dossier: "bis", cadence: 12, staleAfter: "2025-01", range: [4, 120], base: "INR per USD", freq: "annual" },
    // index from ~4 (1953) beside y/y from about -12% (1970s deflation episodes) to +34% (1974)
    { slug: "bis-cpi-long", dossier: "bis", cadence: 1, staleAfter: "2026-06", range: [-20, 400], base: "2010=100", freq: "monthly" },
    { slug: "bis-cpi-long-annual", dossier: "bis", cadence: 12, staleAfter: "2025-01", range: [-20, 400], base: "2010=100", freq: "annual" },
    // RBI HPI: three bases, never joined; city levels and derived y/y
    { slug: "housing-rbi-2009", dossier: "rbihpi", cadence: 3, staleAfter: "2013-01", range: [50, 400], base: "2008-09=100" },
    { slug: "housing-rbi-2010", dossier: "rbihpi", cadence: 3, staleAfter: "2025-01", range: [50, 600], base: "2010-11=100" },
    { slug: "housing-rbi-2010-yoy", dossier: "rbihpi", cadence: 3, staleAfter: "2025-01", range: [-40, 80], base: "2010-11=100" },
    { slug: "housing-rbi-2022", dossier: "rbihpi", cadence: 3, range: [50, 300], base: "2022-23=100" },
    { slug: "housing-rbi-2022-yoy", dossier: "rbihpi", cadence: 3, range: [-40, 80], base: "2022-23=100" },
    // RESIDEX: indices; prices in rupees per sq ft (Mumbai's large homes ~ 45,000) beside record counts
    { slug: "housing-residex-2013", dossier: "residex", cadence: 3, staleAfter: "2018-01", range: [30, 400], base: "2012-13=100" },
    { slug: "housing-residex-2018", dossier: "residex", cadence: 3, staleAfter: "2025-10", range: [30, 400], base: "2017-18=100" },
    { slug: "housing-residex-2025", dossier: "residex", cadence: 3, range: [30, 400], base: "2024-25=100" },
    { slug: "housing-residex-prices-2013", dossier: "residex", cadence: 3, staleAfter: "2018-01", range: [0, 2e6], base: "2012-13=100" },
    { slug: "housing-residex-prices-2018", dossier: "residex", cadence: 3, staleAfter: "2025-10", range: [0, 2e6], base: "2017-18=100" },
    { slug: "housing-residex-prices-2025", dossier: "residex", cadence: 3, range: [0, 2e6], base: "2024-25=100" },
  ];
  for (const p of BIS_ROWS) {
    if (!fs.existsSync(path.join(ROOT, "data/series", p.slug + ".json"))) { fail(`${p.slug}: data/series/${p.slug}.json missing`); continue; }
    const b = load(p.slug);
    checkMeta(b, p.slug, p.dossier, p.base, p.freq);
    checkFreshness(b, p.slug, p, p.dossier);
    if (!p.noCadence) checkCadence(b.dates, p.cadence, p.slug);
    else for (let i = 1; i < b.dates.length; i++) if (b.dates[i] <= b.dates[i - 1]) fail(`${p.slug}: dates not ascending at ${b.dates[i]}`);
    checkRange(b, p.range[0], p.range[1], p.slug, p.seriesRange);
    console.log(`  ${p.slug}: ${b.dates.length} pts, ${b.dates[0]} .. ${b.dates.at(-1)}, vintage ${b.meta.vintage}`);
  }
  // peers: one economy per bundle, geo from the adapter's table
  for (const [area, [iso3]] of Object.entries(PEERS)) {
    const slug = `bis-peer-${iso3.toLowerCase()}`;
    if (!fs.existsSync(path.join(ROOT, "data/series", slug + ".json"))) { fail(`${slug}: missing`); continue; }
    const b = load(slug);
    if (b.meta.geo !== iso3) fail(`${slug}: meta.geo "${b.meta.geo}" != ${iso3} (BIS area ${area})`);
    checkFreshness(b, slug, { staleAfter: "2026-01" }, "bis");
    checkCadence(b.dates, 3, slug);
    // Japan's total non-financial credit reached 401.9% of GDP (2022); Turkey's real house prices swing by tens of per cent
    checkRange(b, -100, 500, slug);
  }
  ok(`bis peers: ${Object.keys(PEERS).length} economies, one bundle each`);

  // identities
  withBundle("bis-credit-gap", (b) => {
    let worst = 0;
    b.dates.forEach((d, i) => { const [r, t, g] = ["ratio", "trend", "gap"].map((k) => b.series[k].data[i]); if (r != null && t != null && g != null) worst = Math.max(worst, Math.abs(r - t - g)); });
    if (worst > 0.15) fail(`bis-credit-gap: gap != ratio - trend by ${worst.toFixed(2)} pt`); else ok(`bis-credit-gap: gap = ratio - trend (worst ${worst.toFixed(2)} pt, rounding)`);
  });
  withBundle("bis-credit", (b) => withBundle("bis-credit-gap", (g) => {
    const S = b.series; let w1 = 0, w2 = 0, w3 = 0;
    b.dates.forEach((d, i) => {
      const [t, p, gv, h, c] = ["total", "private", "government", "households", "companies"].map((k) => S[k].data[i]);
      if (t != null && p != null && gv != null) w1 = Math.max(w1, Math.abs(t - p - gv));
      // BIS break-adjusts households and companies separately from the private total; they
      // reconcile only from 2012 (before that the parts exceed the whole by up to 8.4 pt, disclosed)
      if (d >= "2012-01-01" && p != null && h != null && c != null) w2 = Math.max(w2, Math.abs(p - h - c));
      const j = g.dates.indexOf(d), gr = j >= 0 ? g.series.ratio.data[j] : null;
      if (gr != null && p != null) w3 = Math.max(w3, Math.abs(gr - p));
    });
    if (w1 > 0.25) fail(`bis-credit: total != private + government by ${w1.toFixed(2)} pt`); else ok(`bis-credit: total = private + government (worst ${w1.toFixed(2)} pt)`);
    if (w2 > 0.25) fail(`bis-credit: private != households + companies by ${w2.toFixed(2)} pt from 2012`); else ok(`bis-credit: private = households + companies from 2012 (worst ${w2.toFixed(2)} pt)`);
    if (w3 > 0.15) fail(`bis-credit: private credit != credit-gap ratio by ${w3.toFixed(2)} pt`); else ok(`bis-credit: private credit equals the credit-gap ratio (worst ${w3.toFixed(2)} pt)`);
  }));
  // BIS's India extrapolation (series.estimated): in every estimated quarter households/private and
  // banks/private equal their last measured ratio, which is what the adapter's detection claims
  withBundle("bis-credit-inr", (b) => {
    const S = b.series, est = new Set(S.households.estimated ?? []);
    if (!est.size) return ok("bis-credit-inr: no BIS-estimated quarters this vintage");
    const j0 = b.dates.findIndex((d) => est.has(d)) - 1;
    let w = 0;
    for (const k of ["households", "companies", "private_banks"]) {
      const r0 = S[k].data[j0] / S.private.data[j0];
      b.dates.forEach((d, i) => { if (est.has(d)) w = Math.max(w, Math.abs(S[k].data[i] / S.private.data[i] - r0) / r0); });
      if (JSON.stringify(S[k].estimated) !== JSON.stringify(S.households.estimated)) fail(`bis-credit-inr.${k}: estimated dates differ from households'`);
    }
    if (w > 1e-5) fail(`bis-credit-inr: estimated quarters do not hold the last measured split (worst ${w})`); else ok(`bis-credit-inr: ${est.size} BIS-estimated quarters hold the ${b.dates[j0].slice(0, 7)} split`);
  });
  withBundle("bis-property", (b) => {
    let w = 0;
    for (const k of ["nominal", "real"]) b.dates.forEach((d, i) => { const a = b.series[k].data[i], z = b.series[k].data[i - 4], y = b.series[k + "_yoy"].data[i]; if (i >= 4 && a != null && z != null && y != null) w = Math.max(w, Math.abs((a / z - 1) * 100 - y)); });
    if (w > 0.1) fail(`bis-property: published y/y deviates ${w.toFixed(3)} pt from the index`); else ok(`bis-property: published y/y matches the index (worst ${w.toFixed(3)} pt)`);
  });
  for (const base of ["2010", "2022"]) withBundle(`housing-rbi-${base}`, (b) => withBundle(`housing-rbi-${base}-yoy`, (y) => {
    let w = 0;
    for (const [k, s] of Object.entries(y.series)) y.dates.forEach((d, i) => { const j = b.dates.indexOf(d), v = s.data[i]; if (v == null) return; const a = b.series[k].data[j], z = b.series[k].data[j - 4]; w = Math.max(w, Math.abs((a / z - 1) * 100 - v)); });
    if (w > 0.01) fail(`housing-rbi-${base}-yoy: derived y/y deviates from the index by ${w}`); else ok(`housing-rbi-${base}-yoy: y/y recomputes from the index`);
    // the base year averages 100 for every city (2010-11 and 2022-23: four fiscal quarters)
    const fy = base === "2010" ? ["2010-04-01", "2010-07-01", "2010-10-01", "2011-01-01"] : ["2022-04-01", "2022-07-01", "2022-10-01", "2023-01-01"];
    let wb = 0;
    for (const s of Object.values(b.series)) { const v = fy.map((d) => s.data[b.dates.indexOf(d)]); if (v.every((x) => x != null)) wb = Math.max(wb, Math.abs(v.reduce((a, c) => a + c, 0) / 4 - 100)); }
    if (wb > 0.5) fail(`housing-rbi-${base}: base-year average is ${wb.toFixed(2)} away from 100`); else ok(`housing-rbi-${base}: every city averages 100 over the base year (worst ${wb.toFixed(2)})`);
  }));
  // RESIDEX: the four-quarter moving average (keys without suffix) tracks the mean of the four
  // single quarters (_q). NHB averages prices weighted by records, so small cities drift by
  // several points; the all-India index stays within a point (0.16 on 2024-25; up to 1.0 on the older bases, which NHB rounds to whole numbers).
  for (const t of ["2013", "2018", "2025"]) withBundle(`housing-residex-${t}`, (b) => {
    const a = b.series.india_hfc.data, q = b.series.india_hfc_q.data; let w = 0;
    for (let i = 3; i < a.length; i++) if (a[i] != null && q.slice(i - 3, i + 1).every((v) => v != null)) w = Math.max(w, Math.abs(a[i] - q.slice(i - 3, i + 1).reduce((x, y) => x + y, 0) / 4));
    if (w > 1.5) fail(`housing-residex-${t}: India moving average is ${w.toFixed(2)} from the mean of its four quarters`); else ok(`housing-residex-${t}: India moving average tracks its four quarters (worst ${w.toFixed(2)})`);
  });
}

/* ---- worldbank family (2026-10-09): WDI catalogue, PIP poverty, UN WPP population ----
 * Bundles are found by meta.product, so a new topic bundle or survey spell is checked
 * the day it is baked. Ranges come from sources.yml (WDI: per unit class). */
{
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  const byProduct = (p) => files.filter((slug) => load(slug).meta?.product === p);
  const wdi = byProduct("wdi-india"), pipB = byProduct("pip"), wppB = byProduct("wpp");
  // WDI: every configured group baked (a group may only be absent if WDI serves it nothing)
  const wcfg = cfg.dossiers.worldbank;
  const groups = wcfg.fetch.groups.map((g) => g.bundle);
  for (const slug of wdi) if (!groups.includes(slug)) fail(`${slug}: product wdi-india but no group in sources.yml names it (orphaned bundle)`);
  const UR = wcfg.unit_ranges;
  for (const slug of wdi) {
    const b = load(slug);
    checkMeta(b, slug, "worldbank");
    checkFreshness(b, slug, { staleAfter: slug === "worldbank-social-protection" ? "2011-01" : slug === "worldbank-gender" ? "2017-01" : wcfg.stale_after }, "worldbank");
    checkCadence(b.dates, 12, slug);
    const sr = Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, UR[s.unit] ?? (fail(`${slug}.${k}: unit class "${s.unit}" has no unit_ranges entry`), [-Infinity, Infinity])]));
    checkRange(b, -Infinity, Infinity, slug, sr);
  }
  ok(`worldbank: ${wdi.length} WDI topic bundles, ${wdi.reduce((a, s) => a + Object.keys(load(s).series).length, 0)} series checked`);
  const W = (code) => {
    for (const slug of wdi) { const b = load(slug); const s = Object.values(b.series).find((x) => x.name === code); if (s) return { b, s }; }
    return null;
  };
  const near = (a, b, tol) => a != null && b != null && Math.abs(a - b) <= tol;
  // identity: the three broad age shares sum to 100
  {
    const a = W("SP.POP.0014.TO.ZS"), m = W("SP.POP.1564.TO.ZS"), o = W("SP.POP.65UP.TO.ZS");
    let worst = 0;
    a.b.dates.forEach((d, i) => { const x = a.s.data[i], y = m.s.data[i], z = o.s.data[i]; if (x != null && y != null && z != null) worst = Math.max(worst, Math.abs(x + y + z - 100)); });
    if (worst > 0.05) fail(`population-wdi: age shares sum off 100 by ${worst.toFixed(3)}`); else ok(`population-wdi: 0-14 + 15-64 + 65+ = 100 every year (worst ${worst.toFixed(4)})`);
  }
  // identity: urban + rural shares = 100; male + female = total
  {
    const u = W("SP.URB.TOTL.IN.ZS"), r = W("SP.RUR.TOTL.ZS");
    const bad = u.b.dates.filter((d, i) => u.s.data[i] != null && r.s.data[i] != null && !near(u.s.data[i] + r.s.data[i], 100, 0.01));
    if (bad.length) fail(`population-wdi-urban: urban + rural != 100 at ${bad.slice(0, 3).join(", ")}`); else ok("population-wdi-urban: urban + rural shares = 100 every year");
    const t = W("SP.POP.TOTL"), ma = W("SP.POP.TOTL.MA.IN"), fe = W("SP.POP.TOTL.FE.IN");
    const bad2 = t.b.dates.filter((d, i) => t.s.data[i] != null && ma.s.data[i] != null && fe.s.data[i] != null && Math.abs(ma.s.data[i] + fe.s.data[i] - t.s.data[i]) / t.s.data[i] > 1e-4);
    if (bad2.length) fail(`population-wdi: male + female != total at ${bad2.slice(0, 3).join(", ")}`); else ok("population-wdi: male + female = total every year");
  }
  // WPP: estimates and projection never overlap; age groups sum to the total; births - deaths = natural change
  for (const slug of wppB) {
    const b = load(slug);
    checkMeta(b, slug, "population");
    checkFreshness(b, slug, {}, "population");
    checkCadence(b.dates, 12, slug);
    const sr = Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, { thousand: [-1e5, 3e6], pct: [-10, 100], per_1000: [-60, 1000], years: [0, 120], per_woman: [0, 10], males_per_100_females: [0, 250], per_sq_km: [0, 1000], per_100: [0, 200], doubling_years: [0, 10000], billion: [0, 3], crore: [0, 300] }[s.unit] ?? (fail(`${slug}.${k}: unit "${s.unit}" has no range`), [0, 0])]));
    checkRange(b, 0, 0, slug, sr);
  }
  withBundle("population-wpp", (e) => withBundle("population-wpp-projection", (p) => {
    if (e.dates.at(-1) >= p.dates[0]) fail(`population-wpp: estimates (to ${e.dates.at(-1)}) overlap the projection (from ${p.dates[0]})`);
    else ok(`population-wpp: estimates end ${e.dates.at(-1).slice(0, 4)}, projection starts ${p.dates[0].slice(0, 4)}, no overlap`);
    for (const [slug, b] of [["population-wpp", e], ["population-wpp-projection", p]]) {
      let worst = 0;
      b.dates.forEach((d, i) => { const n = b.series.natchange?.data[i], bi = b.series.births?.data[i], de = b.series.deaths?.data[i]; if (n != null && bi != null && de != null) worst = Math.max(worst, Math.abs(bi - de - n)); });
      if (worst > 1) fail(`${slug}: births - deaths differs from natural change by ${worst.toFixed(2)} thousand`); else ok(`${slug}: births - deaths = natural change (worst ${worst.toFixed(3)} thousand)`);
    }
    // WDI's population is WPP's: estimates and the medium projection, year by year
    const t = W("SP.POP.TOTL");
    let worst = 0, n = 0;
    t.b.dates.forEach((d, i) => {
      const w = t.s.data[i]; if (w == null) return;
      const j = e.dates.indexOf(d), k = p.dates.indexOf(d);
      const u = j >= 0 ? e.series.tpopulation1july.data[j] : k >= 0 ? p.series.tpopulation1july.data[k] : null;
      if (u == null) return; n++; worst = Math.max(worst, Math.abs(w / (u * 1000) - 1));
    });
    if (worst > 0.005) fail(`population: WDI SP.POP.TOTL differs from UN WPP by ${(worst * 100).toFixed(2)}%`); else ok(`population: WDI SP.POP.TOTL equals UN WPP in all ${n} years (worst ${(worst * 100).toFixed(4)}%)`);
  }));
  for (const slug of ["population-wpp-age", "population-wpp-age-projection"]) withBundle(slug, (a) => withBundle(slug === "population-wpp-age" ? "population-wpp" : "population-wpp-projection", (t) => {
    let worst = 0, worstS = 0;
    a.dates.forEach((d, i) => {
      const sum = Object.entries(a.series).filter(([k]) => /^age_.*_total$/.test(k)).reduce((s, [, x]) => s + x.data[i], 0);
      const tot = t.series.tpopulation1july.data[t.dates.indexOf(d)];
      worst = Math.max(worst, Math.abs(sum / tot - 1));
      worstS = Math.max(worstS, Math.abs(a.series.share_0_14.data[i] + a.series.share_15_64.data[i] + a.series.share_65_plus.data[i] - 100));
    });
    if (worst > 0.001) fail(`${slug}: age groups sum off the total population by ${(worst * 100).toFixed(3)}%`); else ok(`${slug}: age groups sum to the total population (worst ${(worst * 100).toFixed(4)}%)`);
    if (worstS > 0.001) fail(`${slug}: broad age shares sum off 100 by ${worstS}`); else ok(`${slug}: broad age shares sum to 100`);
  }));
  withBundle("population-wpp-variants", (v) => {
    const lo = v.series.tpopulation1july__lower_95_pi?.data, md = v.series.tpopulation1july__median_pi?.data, hi = v.series.tpopulation1july__upper_95_pi?.data;
    if (!lo || !md || !hi) fail("population-wpp-variants: the 95% interval for total population is missing");
    else {
      const bad = v.dates.filter((d, i) => !(lo[i] <= md[i] && md[i] <= hi[i]));
      if (bad.length) fail(`population-wpp-variants: 95% interval out of order at ${bad.slice(0, 3).join(", ")}`); else ok("population-wpp-variants: lower 95% <= median <= upper 95% every year");
    }
  });
  // PIP: one bundle per comparable spell, registered as a base in seams
  const PR = { pct: [0, 100], ppp_usd_day: [0, 200], gini_index: [0, 100], coefficient: [0, 5], multiple: [0, 50], inr_per_ppp_usd: [1, 100], count: [1e8, 2e9], million_persons: [0, 2000], inr_day: [0, 10000] };
  for (const slug of pipB) {
    const b = load(slug);
    checkMeta(b, slug, "poverty", b.meta.base, b.meta.frequency);
    checkFreshness(b, slug, slug === "poverty-pip-lineup" || slug === "poverty-pip-2022" ? {} : { stale: false }, "poverty");
    if (slug === "poverty-pip-lineup") checkCadence(b.dates, 12, slug);
    checkRange(b, 0, 0, slug, Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, PR[s.unit] ?? (fail(`${slug}.${k}: unit "${s.unit}" has no range`), [0, 0])])));
    if (b.meta.frequency === "annual" && slug !== "poverty-pip-lineup") checkCadence(b.dates, 12, slug);
    if (slug === "poverty-pip-lineup") continue;
    const lines = Object.keys(b.series).filter((k) => /^headcount_\d+_\d\d$/.test(k)).map((k) => [Number(k.slice(10).replace("_", ".")), k]).sort((x, y) => x[0] - y[0]);
    b.dates.forEach((d, i) => {
      for (let j = 1; j < lines.length; j++) if (b.series[lines[j][1]].data[i] < b.series[lines[j - 1][1]].data[i]) fail(`${slug}: share below $${lines[j][0]} < share below $${lines[j - 1][0]} at ${d}`);
      const dec = Array.from({ length: 10 }, (_, k) => b.series["decile" + (k + 1)].data[i]).reduce((a, x) => a + x, 0);
      if (!near(dec, 100, 0.1)) fail(`${slug}: decile shares sum to ${dec.toFixed(2)} at ${d}`);
      const lcu = b.series.mean.data[i] * b.series.ppp.data[i] * b.series.cpi.data[i], pub = b.series.survey_mean_lcu.data[i];
      if (Math.abs(lcu / pub - 1) > 0.005) fail(`${slug}: mean x ppp x cpi = ${lcu.toFixed(2)} but the survey mean is ₹${pub} at ${d}`);
      for (const l of ["3_00", "4_20", "8_30"]) if (b.series["poverty_gap_" + l].data[i] > b.series["headcount_" + l].data[i]) fail(`${slug}: poverty gap above headcount at $${l} ${d}`);
    });
    // WDI republishes PIP rounded to one decimal: they must agree
    for (const [code, key, tol] of [["SI.POV.DDAY", "headcount_3_00", 0.051], ["SI.POV.LMIC", "headcount_4_20", 0.051], ["SI.POV.UMIC", "headcount_8_30", 0.051], ["SI.POV.GINI", "gini", 0.051]]) {
      const w = W(code); if (!w) { fail(`poverty: WDI ${code} missing for the PIP cross-check`); continue; }
      b.dates.forEach((d, i) => { const j = w.b.dates.indexOf(d); const x = j >= 0 ? w.s.data[j] : null; if (x != null && !near(x, b.series[key].data[i], tol)) fail(`${slug}: PIP ${key} ${b.series[key].data[i]} vs WDI ${code} ${x} at ${d}`); });
    }
  }
  ok(`poverty: ${pipB.length} PIP bundles; ladder monotonic, deciles sum to 100, rupee means reconcile, WDI agrees`);
  withBundle("poverty-pip-lineup", (L) => {
    const last = L.meta.lastSurveyYear;
    const bad = L.dates.filter((d, i) => (Number(d.slice(0, 4)) > last) !== (L.series.headcount_3_00_nowcast?.data[i] != null));
    if (bad.length) fail(`poverty-pip-lineup: nowcasts must be exactly the years after the last survey (${last}); off at ${bad.slice(0, 3).join(", ")}`); else ok(`poverty-pip-lineup: nowcasts are kept apart, after ${last}`);
  });
}

/* ---- climate (lb/climate): OWID and CCKP bundles, meta.dossier "climate" ----
 * Two products feed one guide: sources.yml `climate` (OWID) and `climate-cckp` (CCKP).
 * Each bundle declares its instrument as meta.base; the declared base comes from that
 * entry's `bases` map. Comparator bundles (China, US, world) carry their own geo, listed
 * in `comparators`. Ranges key on each series' unit; identities are physical (a minimum
 * never above a mean, a higher threshold never counting more days) or published (CCKP's
 * own 1991-2020 climatology, OWID's fuel split). */
{
  const OW = cfg.dossiers.climate, CK = cfg.dossiers["climate-cckp"];
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => /^climate-.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, ""));
  if (files.length < 40) fail(`climate: only ${files.length} bundles baked`);
  const declaredBase = (slug, b) => {
    if (b.meta.product === "cckp") return /-cru(-|$)/.test(slug) ? CK.bases.cru : slug.includes("cmip6") ? CK.bases.cmip6 : CK.bases.era5;
    if (b.meta.product === "owid-co2-data") return OW.bases["owid-co2"];
    if (b.meta.product === "owid-energy-data") return OW.bases["owid-energy"];
    return OW.bases[slug] ?? OW.bases.default;
  };
  // unit -> plausible range (CCKP vocabulary, then OWID's free-text units)
  const RANGE = { degC: [-45, 60], days: [0, 366], mm: [0, 16000], mm_day: [0, 200], pct: [0, 1000], wm2: [0, 1000], ms: [0, 80],
    degday_c: [0, 12000], degday_f: [0, 22000], doy: [0, 366], index: [-6, 6], risk_ratio: [0, 10], person_days: [-1e12, 1e13] };
  // OWID unit codes (scripts/lib/products/owid-climate.mjs OWID_UNITS)
  const OWID_RANGE = { pct: [-100, 1e7], degC: [-20, 50], count: [0, 1e10], intl_usd_2011: [0, 1e15], hectares: [0, 1e9], tonnes: [0, 1e10],
    mt: [-1e7, 1e7], mt_co2e: [-1e7, 1e7], t_per_person: [-100, 100], t_co2e_per_person: [-100, 100], kg_per_intl_usd: [-10, 10], g_per_kwh: [0, 5000],
    g_co2e_per_kwh: [0, 5000], kwh_per_person: [-1e6, 1e6], kwh_per_intl_usd: [0, 50], twh: [-1e6, 1e6], per_100k: [-1000, 1000], mm: [-5000, 16000] };   // mm: an anomaly can be negative
  const owidRange = (u) => OWID_RANGE[u];
  const anomalyUnit = (k) => /__change__|anomaly|change/.test(k);
  let checked = 0;
  for (const slug of files) {
    const b = load(slug), m = b.meta;
    if (m.dossier !== "climate") { fail(`${slug}: meta.dossier "${m.dossier}" is not climate`); continue; }
    const key = m.product === "cckp" ? "climate-cckp" : "climate";
    for (const k of ["source", "vintage", "base", "frequency"]) if (m[k] == null) fail(`${slug}: meta.${k} missing`);
    const want = declaredBase(slug, b);
    if (m.base !== want) fail(`${slug}: meta.base "${m.base}" != sources.yml "${want}" (one instrument per bundle)`);
    const geos = ["IND", ...(cfg.dossiers[key].comparators ?? [])];
    if (!geos.includes(m.geo)) fail(`${slug}: meta.geo "${m.geo}" is not India or a declared comparator`);
    const proj = /cmip6|heat-deaths/.test(slug);
    checkFreshness(b, slug, proj || /opinion|decadal|-chn|-usa|-world/.test(slug) ? { stale: false } : { staleAfter: key === "climate-cckp" ? CK.stale_after : m.frequency === "monthly" || m.frequency === "weekly" ? OW.stale_after : "2024-01" }, key);
    const step = { monthly: 1, seasonal: 3, annual: 12 }[m.frequency];
    if (step) checkCadence(b.dates, step, slug);
    const seriesRange = {};
    for (const [k, s] of Object.entries(b.series)) {
      if (m.product === "cckp") {
        const r = RANGE[s.unit];
        if (!r) { fail(`${slug}.${k}: unit "${s.unit}" has no range`); continue; }
        // a change from 1995-2014 can be negative: widen to the symmetric range
        seriesRange[k] = anomalyUnit(k) || slug.startsWith("climate-cmip6-states") ? [-Math.max(Math.abs(r[0]), r[1]), Math.max(Math.abs(r[0]), r[1])] : r;
      } else if (!owidRange(s.unit)) fail(`${slug}.${k}: unit "${s.unit}" has no range`);
      else seriesRange[k] = owidRange(s.unit);
    }
    checkRange(b, -1e13, 1e13, slug, seriesRange);
    checked++;
  }
  ok(`climate: ${checked} bundles checked for instrument, geography, cadence and unit ranges`);

  const ord = (slug, b, keys, at, tol = 1e-6) => {
    // values of keys[0] <= keys[1] <= ... at every date where all are published
    let bad = 0;
    for (let i = 0; i < b.dates.length; i++) {
      const v = keys.map((k) => b.series[at(k)]?.data[i]);
      if (v.some((x) => x == null)) continue;
      for (let j = 1; j < v.length; j++) if (v[j - 1] > v[j] + tol) { bad++; if (bad <= 3) fail(`${slug}: ${at(keys[j - 1])} ${v[j - 1]} > ${at(keys[j])} ${v[j]} at ${b.dates[i]}`); }
    }
    return bad;
  };
  const NESTS = [["tasmin", "tas", "tasmax"], ["hd50", "hd45", "hd42", "hd40", "hd35", "hd30"], ["tr32", "tr29", "tr26", "tr23", "tr"],
    ["hi41", "hi39", "hi37", "hi35"], ["wbt31", "wbt29", "wbt27", "wbt25"], ["esi35", "esi32", "esi29", "esi26"], ["r50mm", "r20mm", "r10mm"],
    ["r99p", "r95p"], ["rx1day", "rx5day"], ["tx5day", "tx3day", "txx"]];
  // ERA5 and CRU, India and states, every aggregation: nested thresholds and min <= mean <= max
  let nests = 0;
  for (const slug of files.filter((s) => /^climate-(era5|cru)/.test(s))) {
    const b = load(slug);
    const suffixes = slug.includes("states") ? [...new Set(Object.keys(b.series).map((k) => k.split("__")[1]))].map((s) => "__" + s) : [""];
    for (const nest of NESTS) for (const suf of suffixes) {
      if (!nest.every((v) => b.series[v + suf])) continue;
      // 0.05: CCKP aggregates each index to places separately, so area averages of nested
      // indices can cross by a few hundredths (seen: 0.04°C, tx5day over tx3day, Chandigarh)
      if (!ord(slug, b, nest, (k) => k + suf, 0.05)) nests++;
    }
  }
  ok(`climate: ${nests} nested-threshold and min/mean/max orderings hold (ERA5 and CRU, India and states)`);

  // CMIP6: p10 <= median <= p90 for every projected series
  let pcts = 0;
  for (const slug of files.filter((s) => /^climate-cmip6-(?!states)/.test(s))) {
    const b = load(slug);
    const stems = new Set(Object.keys(b.series).filter((k) => k.endsWith("__median")).map((k) => k.slice(0, -"__median".length)));
    for (const st of stems) if (b.series[st + "__p10"] && b.series[st + "__p90"] && !ord(slug, b, ["p10", "median", "p90"], (p) => `${st}__${p}`, 0.011)) pcts++;
  }
  ok(`climate: CMIP6 ensemble 10th <= median <= 90th percentile in ${pcts} projected series`);

  // monthly -> annual: CRU annual rainfall is the sum of its months, temperature the mean
  withBundle("climate-cru", (a) => withBundle("climate-cru-monthly", (mo) => {
    let worstP = 0, worstT = 0, at = null;
    a.dates.forEach((d, i) => {
      const y = d.slice(0, 4), idx = mo.dates.map((x, j) => (x.startsWith(y) ? j : -1)).filter((j) => j >= 0);
      if (idx.length !== 12) return;
      const pr = idx.map((j) => mo.series.pr.data[j]), t = idx.map((j) => mo.series.tas.data[j]);
      if (pr.some((v) => v == null) || t.some((v) => v == null) || a.series.pr.data[i] == null) return;
      const dp = Math.abs(pr.reduce((s, v) => s + v, 0) - a.series.pr.data[i]) / a.series.pr.data[i];
      const dt = Math.abs(t.reduce((s, v) => s + v, 0) / 12 - a.series.tas.data[i]);
      if (dp > worstP) { worstP = dp; at = d; }
      worstT = Math.max(worstT, dt);
    });
    if (worstP > 0.01 || worstT > 0.05) fail(`climate-cru: annual is not the sum/mean of its months (rain ${(worstP * 100).toFixed(2)}%, temperature ${worstT.toFixed(3)}°C, worst ${at})`);
    else ok(`climate-cru: annual rain = sum of months (worst ${(worstP * 100).toFixed(2)}%), annual temperature = mean of months (worst ${worstT.toFixed(3)}°C)`);
  }));

  // CCKP's own published 1991-2020 climatology equals the mean of the annual series we baked
  for (const [slug, v] of [["climate-era5-temp", "tas"], ["climate-era5-rain", "pr"], ["climate-era5-hotdays", "hd35"]]) withBundle(slug, (b) => {
    const pub = b.crosscheck?.[`${v}_climatology_1991_2020`]?.IND;
    if (pub == null) return fail(`${slug}: crosscheck ${v}_climatology_1991_2020 missing`);
    const vals = b.dates.map((d, i) => (d >= "1991" && d < "2021" ? b.series[v].data[i] : null)).filter((x) => x != null);
    const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
    const tol = v === "pr" ? Math.abs(pub) * 0.01 : 0.06;
    if (vals.length !== 30 || Math.abs(mean - pub) > tol) fail(`${slug}: mean of 1991-2020 ${v} ${mean.toFixed(2)} != CCKP climatology ${pub}`);
    else ok(`${slug}: 1991-2020 mean of ${v} ${mean.toFixed(2)} matches CCKP's published climatology ${pub}`);
  });
  withBundle("climate-era5-states-temp", (b) => {
    const pub = b.crosscheck?.tas_climatology_1991_2020 ?? {};
    let worst = 0, at = null, n = 0;
    for (const [st, p] of Object.entries(pub)) {
      const s = b.series[`tas__${st}`];
      if (!s || st === "IND") continue;
      const vals = b.dates.map((d, i) => (d >= "1991" && d < "2021" ? s.data[i] : null)).filter((x) => x != null);
      const dv = Math.abs(vals.reduce((a, x) => a + x, 0) / vals.length - p);
      n++; if (dv > worst) { worst = dv; at = st; }
    }
    if (n < 30 || worst > 0.06) fail(`climate-era5-states-temp: state means differ from CCKP's 1991-2020 climatology by ${worst.toFixed(3)}°C (${at}), ${n} states compared`);
    else ok(`climate-era5-states-temp: ${n} state 1991-2020 means within ${worst.toFixed(3)}°C of CCKP's published climatology`);
  });

  // OWID CO2: the fuel split adds up to the total; per capita and world share follow
  for (const slug of ["climate-co2", "climate-co2-chn", "climate-co2-usa", "climate-co2-world"]) withBundle(slug, (b) => {
    const S = b.series, parts = ["coal_co2", "oil_co2", "gas_co2", "cement_co2", "flaring_co2", "other_industry_co2"].filter((k) => S[k]);
    let worst = 0, at = null;
    b.dates.forEach((d, i) => {
      if (d < "1950" || S.co2.data[i] == null) return;
      const sum = parts.reduce((s, k) => s + (S[k].data[i] ?? 0), 0);
      const dv = Math.abs(sum - S.co2.data[i]) / S.co2.data[i];
      if (dv > worst) { worst = dv; at = d; }
    });
    if (worst > 0.02) fail(`${slug}: fuels sum off total CO2 by ${(worst * 100).toFixed(2)}% at ${at}`);
    else ok(`${slug}: coal+oil+gas+cement+flaring(+other) = total CO2 since 1950 (worst ${(worst * 100).toFixed(2)}%)`);
    let wpc = 0;
    b.dates.forEach((d, i) => {
      const c = S.co2.data[i], p = S.population?.data[i], pc = S.co2_per_capita?.data[i];
      if (c == null || p == null || pc == null || d < "1950") return;
      wpc = Math.max(wpc, Math.abs((c * 1e6) / p - pc) / pc);
    });
    if (wpc > 0.01) fail(`${slug}: CO2 per capita deviates ${(wpc * 100).toFixed(2)}% from total / population`);
  });
  withBundle("climate-co2", (ind) => withBundle("climate-co2-world", (w) => {
    let worst = 0;
    ind.dates.forEach((d, i) => {
      const j = w.dates.indexOf(d), sh = ind.series.share_global_co2?.data[i];
      if (j < 0 || sh == null || d < "1950") return;
      worst = Math.max(worst, Math.abs((100 * ind.series.co2.data[i]) / w.series.co2.data[j] - sh));
    });
    if (worst > 0.05) fail(`climate-co2: India's share of world CO2 deviates ${worst.toFixed(3)} pt from India / World`);
    else ok(`climate-co2: share_global_co2 = India / World within ${worst.toFixed(3)} pt`);
  }));
  // OWID energy: fossil and low-carbon shares of electricity are complements
  withBundle("climate-energy", (b) => {
    let worst = 0, at = null;
    b.dates.forEach((d, i) => {
      const f = b.series.fossil_share_elec?.data[i], l = b.series.low_carbon_share_elec?.data[i];
      if (f == null || l == null) return;
      const dv = Math.abs(f + l - 100); if (dv > worst) { worst = dv; at = d; }
    });
    if (worst > 0.6) fail(`climate-energy: fossil + low-carbon electricity shares = ${(100 + worst).toFixed(2)} at ${at}`);
    else ok(`climate-energy: fossil + low-carbon shares of electricity sum to 100 (worst ${worst.toFixed(2)} pt)`);
  });
}
/* ---- end climate ---- */

/* ---- ilo (ILOSTAT): every ilo-* bundle, by instrument; ranges by series unit; identities ----
 * Bundles come from scripts/lib/products/ilostat.mjs. Each instrument is its own ruler (the
 * seams registry in sources.yml lists them); peers carry their own geo (sources.yml peers). */
{
  const D = cfg.dossiers.ilo;
  const UNIT_RANGE = { pct: [-50, 100], per_100k_workers: [0, 20000], days: [0, 1e8], cases: [0, 1e6], thousand: [0, 1.6e6],
    usd_2015: [0, 1e5], usd_ppp_2021: [0, 1e5], usd_ppp_2021_million: [0, 1e8], hours: [0, 100], hours_thousand: [0, 1e8], score: [0, 10],
    inr: [0, 1e6], gini: [0, 1], dependency_ratio: [0, 5] };
  const files = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => /^ilo-.*\.json$/.test(f)).sort();
  if (files.length < 60) fail(`ilo: only ${files.length} ilo-* bundles (expected ~68)`);
  let n = 0;
  for (const f of files) {
    const slug = f.replace(/\.json$/, ""), b = load(slug), m = b.meta ?? {};
    for (const k of ["source", "vintage", "base", "frequency", "geo"]) if (m[k] == null) fail(`${slug}: meta.${k} missing`);
    if (m.dossier !== "ilo") fail(`${slug}: meta.dossier "${m.dossier}" != "ilo"`);
    const geoOk = m.peer ? D.peers.includes(m.geo) : m.geo === D.geo;
    if (!geoOk) fail(`${slug}: meta.geo "${m.geo}" is neither India nor a declared peer (one bundle, one geography)`);
    const seriesRange = {};
    for (const [k, s2] of Object.entries(b.series)) {
      if (!UNIT_RANGE[s2.unit]) fail(`${slug}.${k}: unit "${s2.unit}" has no range in validate.mjs`);
      else seriesRange[k] = UNIT_RANGE[s2.unit];
      for (const [st, ds] of Object.entries(s2.flags ?? {})) for (const d of ds) {
        const i = b.dates.indexOf(d);
        if (i < 0 || s2.data[i] == null) fail(`${slug}.${k}: flag ${st} on ${d}, which has no value`);
      }
      if (s2.lower && (s2.lower.length !== b.dates.length || s2.upper.length !== b.dates.length)) fail(`${slug}.${k}: bounds not aligned to the axis`);
      if (s2.lower) s2.data.forEach((v, i) => { if (v != null && s2.lower[i] != null && (s2.lower[i] > v + 1e-9 || s2.upper[i] < v - 1e-9)) fail(`${slug}.${k}: value ${v} outside its bounds at ${b.dates[i]}`); });
    }
    checkRange(b, -Infinity, Infinity, slug, seriesRange);
    // cadence: modelled and PLFS annual axes are consecutive years, PLFS quarters consecutive
    // quarters; NSS rounds, the Census and administrative sources are irregular by nature
    if (/^ilo-(est|peer)-/.test(slug)) checkCadence(b.dates, 12, slug);
    else if (slug === "ilo-plfs-q") checkCadence(b.dates, 3, slug);
    else if (/^ilo-plfs-/.test(slug)) checkCadence(b.dates, 12, slug);
    // freshness floors on the guide's headline rulers only
    if (["ilo-est-eap-2wap", "ilo-est-une-2eap", "ilo-plfs-eap"].includes(slug)) checkFreshness(b, slug, { staleAfter: D.stale_after }, "ilo");
    else checkFreshness(b, slug, { stale: false }, "ilo");
    if (/^ilo-est-/.test(slug) && slug !== "ilo-est-projections" && b.dates.at(-1) >= "2025-01-01" && !/pop-2|cld-2/.test(slug)) fail(`${slug}: modelled bundle reaches ${b.dates.at(-1)}: projection years belong in ilo-est-projections`);
    n++;
  }
  ok(`ilo: ${n} bundles, units ranged, flags on the axis, bounds bracket values`);

  const at = (b, k, i) => b.series[k]?.data[i] ?? null;
  // identity 1 (modelled): EPR = LFPR x (1 - UR/100), every year, every sex and age
  for (const bslug of ["ilo-est-eap-2wap", ...D.peers.map((g) => `ilo-peer-${g.toLowerCase()}`)]) {
    const L = load(bslug), E = bslug === "ilo-est-eap-2wap" ? load("ilo-est-emp-2wap") : L, U = bslug === "ilo-est-eap-2wap" ? load("ilo-est-une-2eap") : L;
    let worst = 0, where = null, checked = 0;
    for (const sex of ["t", "m", "f"]) for (const age of ["yge15", "y15_24", "yge25"]) {
      const kl = `eap_2wap_sex_age_rt__sex_${sex}__age_ythadult_${age}`, ke = `emp_2wap_sex_age_rt__sex_${sex}__age_ythadult_${age}`, ku = `une_2eap_sex_age_rt__sex_${sex}__age_ythadult_${age}`;
      L.dates.forEach((d, i) => {
        const l = at(L, kl, i), e = at(E, ke, E.dates.indexOf(d)), u = at(U, ku, U.dates.indexOf(d));
        if (l == null || e == null || u == null) return;
        const dev = Math.abs(l * (1 - u / 100) - e); checked++;
        if (dev > worst) { worst = dev; where = `${kl} ${d}`; }
      });
    }
    if (!checked) fail(`${bslug}: participation identity found nothing to check`);
    else if (worst > 0.1) fail(`${bslug}: EPR != LFPR x (1 - UR) by ${worst.toFixed(3)} pt at ${where}`);
    else ok(`${bslug}: EPR = LFPR x (1 - UR) within ${worst.toFixed(3)} pt (${checked} points)`);
  }
  // identity 2: female and male rates bracket the total (participation, every instrument)
  for (const bslug of ["ilo-est-eap-2wap", "ilo-plfs-eap", "ilo-nss-eap"]) {
    const b = load(bslug); let bad = 0, checked = 0;
    // rates only (eap_dwap, eap_2wap): a count's total is the sum of its parts, not between them
    for (const k of Object.keys(b.series).filter((x) => x.includes("__sex_t__") && /^eap_(dwap|2wap)_/.test(x))) {
      const kf = k.replace("__sex_t__", "__sex_f__"), km = k.replace("__sex_t__", "__sex_m__");
      if (!b.series[kf] || !b.series[km]) continue;
      b.dates.forEach((d, i) => {
        const t = at(b, k, i), f2 = at(b, kf, i), m2 = at(b, km, i);
        if (t == null || f2 == null || m2 == null) return; checked++;
        if (t < Math.min(f2, m2) - 0.05 || t > Math.max(f2, m2) + 0.05) { bad++; if (bad < 4) fail(`${bslug}: ${k} ${t} outside female ${f2} / male ${m2} at ${d}`); }
      });
    }
    if (!bad) ok(`${bslug}: total participation sits between women's and men's (${checked} points)`);
  }
  // identity 3 (modelled): employment by status and by economic class add up to total employment
  {
    const b = load("ilo-est-emp-2emp");
    const sumCheck = (totalKey, partKeys, tag) => {
      let worst = 0, where = null, checked = 0;
      b.dates.forEach((d, i) => {
        const t = at(b, totalKey, i), parts = partKeys.map((k) => at(b, k, i));
        if (t == null || parts.some((v) => v == null)) return; checked++;
        const dev = Math.abs(parts.reduce((a, v) => a + v, 0) / t - 1);
        if (dev > worst) { worst = dev; where = d; }
      });
      if (!checked) fail(`ilo-est-emp-2emp: ${tag} identity found nothing to check`);
      else if (worst > 0.002) fail(`ilo-est-emp-2emp: ${tag} parts miss the total by ${(100 * worst).toFixed(2)}% at ${where}`);
      else ok(`ilo-est-emp-2emp: ${tag} parts add to the total within ${(100 * worst).toFixed(3)}% (${checked} years)`);
    };
    const ste = Object.keys(b.series).filter((k) => /^emp_2emp_sex_ste_nb__sex_t__ste_icse93_[1235]$/.test(k));
    sumCheck("emp_2emp_sex_ste_nb__sex_t__ste_icse93_total", ste, "status in employment");
    // cat1 < $3 PPP, cat2 $3 to 4.2, cat34 >= $4.2 (itself cat3 + cat4)
    const cla = ["cat1", "cat2", "cat34"].map((c) => `emp_2emp_sex_age_cla_nb__sex_t__age_ythadult_yge15__cla_ecocla_${c}`).filter((k) => b.series[k]);
    if (cla.length === 3) sumCheck("emp_2emp_sex_age_cla_nb__sex_t__age_ythadult_yge15__cla_ecocla_total", cla, "economic class");
    else fail(`ilo-est-emp-2emp: economic-class series not found (${cla.length} of 3)`);
  }
  // identity 4 (modelled): labour income deciles add up to 100
  {
    const b = load("ilo-est-lap-2lid"); let worst = 0;
    b.dates.forEach((d, i) => { const v = Object.values(b.series).map((s2) => s2.data[i]); if (v.every((x) => x != null)) worst = Math.max(worst, Math.abs(v.reduce((a, x) => a + x, 0) - 100)); });
    if (worst > 0.6) fail(`ilo-est-lap-2lid: deciles sum off 100 by ${worst.toFixed(2)}`);
    else ok(`ilo-est-lap-2lid: deciles sum to 100 within ${worst.toFixed(2)}`);
  }
  // hand-checked anchors (docs/status/ilo.md): ILOEST UR 2024 and PLFS women's LFPR 2024
  {
    const u = load("ilo-est-une-2eap"), p = load("ilo-plfs-eap");
    const uv = at(u, "une_2eap_sex_age_rt__sex_t__age_ythadult_yge15", u.dates.indexOf("2024-01-01"));
    const pv = at(p, "eap_dwap_sex_age_rt__sex_f__age_ythadult_yge15", p.dates.indexOf("2024-01-01"));
    if (uv !== 4.173) fail(`ilo-est-une-2eap: 2024 UR ${uv} != hand-checked 4.173 (a new ILOEST edition? re-check by hand and update)`);
    else if (pv !== 34.389) fail(`ilo-plfs-eap: 2024 women's LFPR ${pv} != hand-checked 34.389`);
    else ok("ilo: hand-checked anchors hold (ILOEST UR 2024 = 4.173; PLFS women's LFPR 2024 = 34.389)");
  }
}

/* ---- rates (atlas-rates family session): identities across the RBI's own tables ---- */
// series ranges by unit suffix (name ends _pct, _inr_crore, ...), so a bundle mixing rates and
// rupee amounts checks each against its own scale
function ratesRanges(slug, byUnit) {
  const f = path.join(ROOT, "data/series", slug + ".json");
  if (!fs.existsSync(f)) return {};
  const b = JSON.parse(fs.readFileSync(f, "utf8"));
  const out = {};
  for (const [k, s] of Object.entries(b.series)) for (const [u, r] of Object.entries(byUnit)) if (String(s.name).endsWith("_" + u)) out[k] = r;
  return out;
}
{
  const near = (a, b, t) => a != null && b != null && Math.abs(a - b) <= t;
  // the corridor: floor <= repo <= ceiling on every date the rates coexist
  withBundle("rates-policy", (b) => {
    const s = b.series; let bad = 0;
    b.dates.forEach((d, i) => {
      const r = s.repo.data[i]; if (r == null) return;
      if (s.msf.data[i] != null && s.msf.data[i] < r) bad++;
      if (s.sdf.data[i] != null && s.sdf.data[i] > r) bad++;
      if (s.reverse_repo.data[i] != null && s.reverse_repo.data[i] > r) bad++;
    });
    if (bad) fail(`rates-policy: ${bad} date(s) where the corridor is out of order (floor above repo or ceiling below it)`);
    else ok("rates-policy: SDF and reverse repo at or below the repo rate, MSF at or above it, on every date");
  });
  // every MPC decision is a change event in the policy history (or a hold at the level in force)
  withBundle("rates-mpc", (m) => withBundle("rates-policy", (p) => {
    let bad = [];
    m.dates.forEach((d, i) => {
      let j = -1; for (let k = 0; k < p.dates.length && p.dates[k] <= d; k++) j = k;
      const lvl = j >= 0 ? p.series.repo.data[j] : null, want = m.series.repo.data[i];
      if (!near(lvl, want, 1e-9)) bad.push(`${d}: MPC ${want} vs policy history ${lvl}`);
      const prev = i > 0 ? m.series.repo.data[i - 1] : null;
      if (prev != null && !near(Math.round((want - prev) * 100), m.series.change_bps.data[i], 0.5)) bad.push(`${d}: change ${m.series.change_bps.data[i]} bps vs ${prev} -> ${want}`);
    });
    if (bad.length) fail(`rates-mpc: ${bad.length} meeting(s) disagree with the policy-rate history, e.g. ${bad.slice(0, 3).join("; ")}`);
    else ok(`rates-mpc: all ${m.dates.length} decisions equal the policy-rate history and their own changes`);
  }));
  withBundle("rates-mpc-votes", (b) => {
    const members = Object.keys(b.series).filter((k) => k !== "votes_for" && k !== "votes_against");
    let bad = 0;
    b.dates.forEach((d, i) => {
      const f = b.series.votes_for.data[i], a = b.series.votes_against.data[i];
      const seated = members.filter((k) => b.series[k].data[i] != null);
      const withD = seated.filter((k) => b.series[k].data[i] === 1).length;
      if (f + a !== 6 || seated.length !== 6 || withD !== f) bad++;
    });
    if (bad) fail(`rates-mpc-votes: ${bad} meeting(s) where the six members' votes do not add up to the split`);
    else ok(`rates-mpc-votes: six members and a split that adds up at all ${b.dates.length} meetings with minutes`);
  });
  // the weekly supplement's repo rate equals the policy history on the same Friday
  withBundle("rates-wss", (w) => withBundle("rates-policy", (p) => {
    let n = 0, bad = [];
    w.dates.forEach((d, i) => {
      const v = w.series.repo.data[i]; if (v == null) return;
      let j = -1; for (let k = 0; k < p.dates.length && p.dates[k] <= d; k++) j = k;
      n++; if (!near(v, p.series.repo.data[j], 1e-9)) bad.push(`${d}: WSS ${v} vs ${p.series.repo.data[j]}`);
    });
    // a decision announced on a Friday can reach the table a week late; allow a handful
    if (bad.length > 8) fail(`rates-wss: repo rate differs from the policy history on ${bad.length} of ${n} weeks, e.g. ${bad.slice(0, 3).join("; ")}`);
    else ok(`rates-wss: repo rate equals the policy history on ${n - bad.length} of ${n} weeks${bad.length ? ` (${bad.join("; ")})` : ""}`);
  }));
  withBundle("rates-benchmarks", (b) => {
    let worst = 0;
    for (const g of ["all", "public", "private", "foreign"]) b.dates.forEach((d, i) => {
      const parts = ["eblr", "mclr", "base_rate", "others"].map((x) => b.series[`${g}_${x}`]?.data[i]);
      if (parts.some((v) => v == null)) return;
      worst = Math.max(worst, Math.abs(parts.reduce((a, c) => a + c, 0) - 100));
    });
    if (worst > 0.6) fail(`rates-benchmarks: benchmark shares miss 100 by ${worst.toFixed(2)} pt`);
    else ok(`rates-benchmarks: benchmark shares add to 100 within ${worst.toFixed(2)} pt`);
  });
  withBundle("rates-mclr", (b) => {
    let bad = 0;
    for (const g of ["all", "public", "private", "foreign"]) b.dates.forEach((d, i) => { const lo = b.series[`${g}_min`].data[i], md = b.series[`${g}_median`].data[i], hi = b.series[`${g}_max`].data[i]; if (lo != null && md != null && hi != null && !(lo <= md && md <= hi)) bad++; });
    if (bad) fail(`rates-mclr: ${bad} month-group(s) where the median MCLR is outside the lowest and highest bank`);
    else ok("rates-mclr: median MCLR between the lowest and highest bank in every month and group");
  });
  // the daily call rate sits inside the day's range, and its monthly average matches the RBI's own
  withBundle("rates-call-daily", (b) => withBundle("rates-call-monthly", (m) => {
    let out = 0;
    b.dates.forEach((d, i) => { const w = b.series.wacr.data[i], lo = b.series.low.data[i], hi = b.series.high.data[i]; if (w != null && lo != null && hi != null && (w < lo - 0.005 || w > hi + 0.005)) out++; });
    if (out > 5) fail(`rates-call-daily: weighted average call rate outside the day's range on ${out} days`);
    else ok(`rates-call-daily: weighted average call rate inside the day's lowest and highest deal (${out} exceptions)`);
    // the Handbook's monthly average is weighted by turnover: rebuild it from the daily rates
    const byM = new Map();
    b.dates.forEach((d, i) => { const v = b.series.wacr.data[i], w = b.series.turnover.data[i]; if (v == null || !w) return; const k = d.slice(0, 7) + "-01"; const e = byM.get(k) ?? byM.set(k, []).get(k); e.push([v, w]); });
    let n = 0; const off = [];
    for (const [k, vs] of byM) { const j = m.dates.indexOf(k); const pub = j >= 0 ? m.series.average.data[j] : null; if (pub == null || vs.length < 15) continue; n++; const W = vs.reduce((a, c) => a + c[1], 0); const dlt = Math.abs(vs.reduce((a, c) => a + c[0] * c[1], 0) / W - pub); if (dlt > 0.15) off.push(`${k.slice(0, 7)} (${dlt.toFixed(2)})`); }
    // measured 2026-10: 3 of 258 months differ by more than 0.15 pt, all in 2007
    if (off.length > n * 0.03) fail(`rates-call-monthly: the RBI's monthly average differs from the turnover-weighted daily rates by more than 0.15 pt in ${off.length} of ${n} months: ${off.join(", ")}`);
    else ok(`rates-call-monthly: monthly averages equal the turnover-weighted daily rates within 0.15 pt in ${n - off.length} of ${n} months (${off.join(", ")})`);
  }));
  for (const t of ["91", "182", "364"]) withBundle(`rates-tbill-${t}`, (b) => {
    let n = 0, bad = 0;
    // from 2001: earlier totals include amounts the table does not print separately (bundle note)
    b.dates.forEach((d, i) => { if (d < "2001-04-01") return; const ti = b.series.total_issue.data[i], c = b.series.accepted_comp.data[i], nc = b.series.accepted_noncomp?.data[i], dv = b.series.devolvement?.data[i]; if (ti == null || c == null) return; n++; if (Math.abs(ti - (c + (nc ?? 0) + (dv ?? 0))) > Math.max(1, ti * 0.001)) bad++; });
    if (bad > n * 0.02) fail(`rates-tbill-${t}: total issue != accepted plus devolvement on ${bad} of ${n} auctions`);
    else ok(`rates-tbill-${t}: total issue = accepted (competitive + non-competitive) + devolvement on ${n - bad} of ${n} auctions`);
  });
  withBundle("rates-gsec-curve", (b) => {
    let worst = 0;
    b.dates.forEach((d, i) => { const s = b.series.spread_10_1.data[i]; if (s != null) worst = Math.max(worst, Math.abs(s - (b.series.y10.data[i] - b.series.y1.data[i]))); });
    if (worst > 1e-3) fail(`rates-gsec-curve: term spread differs from 10y - 1y by ${worst}`);
    else ok("rates-gsec-curve: term spread = 10-year minus 1-year yield in every month");
  });
  for (const [slug, cpiSlug] of [["rates-real", "cpi-2024-linked"], ["rates-real-cpi2012", "cpi"]]) withBundle(slug, (r) => withBundle(cpiSlug, (c) => withBundle("rates-monthly", (m) => {
    let n = 0, worst = 0;
    r.dates.forEach((d, i) => { const ci = c.dates.indexOf(d), mi = m.dates.indexOf(d); const v = r.series.repo.data[i]; if (v == null || ci < 0 || mi < 0) return; n++; worst = Math.max(worst, Math.abs(v - (m.series.repo.data[mi] - c.series.headline.data[ci]))); });
    if (worst > 0.006) fail(`${slug}: real repo differs from repo minus CPI inflation by ${worst.toFixed(3)}`);
    else ok(`${slug}: real repo = month-end repo minus ${cpiSlug} inflation in all ${n} months`);
  })));
  withBundle("rates-sdl-states", (b) => {
    let worst = 0;
    b.dates.forEach((d, i) => { const all = b.series.all_raised.data[i]; const sum = Object.entries(b.series).filter(([k]) => k.endsWith("_raised") && k !== "all_raised").reduce((t, [, s]) => t + (s.data[i] ?? 0), 0); worst = Math.max(worst, Math.abs(all - sum)); });
    if (worst > 1) fail(`rates-sdl-states: all-state total differs from the sum of states by ₹${worst.toFixed(2)} crore`);
    else ok("rates-sdl-states: the all-state total is the sum of the states in every year");
  });
  withBundle("rates-borrowing", (b) => {
    let bad = 0;
    b.dates.forEach((d, i) => { for (const w of ["centre", "states"]) { const g = b.series[`${w}_gross`].data[i], n = b.series[`${w}_net`].data[i]; if (g != null && n != null && n > g + 0.5) bad++; } });
    if (bad) fail(`rates-borrowing: net borrowing above gross in ${bad} year(s)`);
    else ok("rates-borrowing: net market borrowing never exceeds gross");
  });
  withBundle("rates-structure", (b) => {
    let bad = 0;
    // as printed: the 1971-72 short-term G-sec range reads 4.21 to 4.17
    const KNOWN = new Set(["gsec_short_low|1971-04-01"]);
    for (const k of Object.keys(b.series).filter((k) => k.endsWith("_low"))) { const h = b.series[k.replace(/_low$/, "_high")]; b.series[k].data.forEach((v, i) => { if (v != null && h?.data[i] != null && v > h.data[i] && !KNOWN.has(`${k}|${b.dates[i]}`)) bad++; }); }
    if (bad) fail(`rates-structure: ${bad} range(s) with the low end above the high end`);
    else ok("rates-structure: every printed range runs low to high");
  });
}

/* ---- prices wave 2 (lb/prices): identities for the deepening ---- */
// y/y computed from levels against the NSO's own published inflation, on every new base-2024 bundle
for (const slug of ["cpi-2024-classes", "cpi-2024-subclasses", ...["rural", "urban"].flatMap((s) => ["divisions", "groups", "classes", "subclasses", "items"].map((l) => `cpi-2024-${s}-${l}`)),
  ...["", "-rural", "-urban"].flatMap((s) => [`cpi-2024-states-divisions${s}`, `cpi-2024-states-groups${s}`])]) crossInflationMap(slug, 0.15);
crossInflationMap("cpi-2024-back-sectors", 0.25);   // the back-cast's own rate, as cpi-2024-back
withBundle("cpi-2024-states-divisions", (b) => {
  const states = new Set(Object.values(b.series).map((s) => s.state));
  if (states.size !== 36) fail(`cpi-2024-states-divisions: ${states.size} states/UTs, expected 36`);
  else ok("cpi-2024-states-divisions: all 36 states/UTs present");
});
withBundle("cpi-items-2012", (b) => {
  const n = Object.keys(b.series).length;
  if (n < 295 || n > 300) fail(`cpi-items-2012: ${n} items, the 2012 basket has 299`);
  else ok(`cpi-items-2012: ${n} items`);
});
withBundle("cpiiw-2016", (b) => withBundle("cpiiw-2016-index", (x) => {
  // the y/y the page shows must follow from the published levels
  const lv = new Map(x.dates.map((d, i) => [d, x.series.general_index.data[i]]));
  const ago = (d) => `${+d.slice(0, 4) - 1}${d.slice(4)}`;
  let bad = 0;
  b.dates.forEach((d, i) => { const y = b.series.general.data[i], L = lv.get(d), P = lv.get(ago(d)); if (y != null && L != null && P != null && Math.abs((L / P - 1) * 100 - y) > 0.01) bad++; });
  if (bad) fail(`cpiiw-2016: ${bad} months where the y/y does not follow from the index levels`);
  else ok("cpiiw-2016: y/y follows from the published levels in every month");
}));
withBundle("cpiiw-centres-2016", (b) => {
  const n = Object.keys(b.series).length;
  if (n !== 88) fail(`cpiiw-centres-2016: ${n} centres, the 2016 base prices 88`);
  else ok("cpiiw-centres-2016: all 88 centres present");
});
withBundle("wages-rural-2013", (b) => {
  if (!b.series.o1210) fail("wages-rural-2013: no general agricultural labourer series (code 1210)");
  else ok(`wages-rural-2013: ${Object.keys(b.series).length} occupations, general agricultural labourer present`);
});

/* ---- households (wave 2): consumption (hces), higher education (aishe), renewable energy
 * (mnre), deposits (bsr2) ----
 * Every bundle of the four families that the PRODUCTS table does not list gets the generic
 * checks (meta against sources.yml, cadence, unit ranges, disclosed gaps). Then the family
 * identities on the baked numbers: each would catch a misread column or a mislabelled row. */
{
  const listed = new Set(PRODUCTS.map((p) => p.slug));
  const fam = [["hces-", "hces"], ["aishe-", "aishe"], ["mnre-", "mnre"], ["deposits-", "deposits"]];
  const UR = { inr: [0, 2e5], pct_of_mpce: [0, 100], gini: [0, 1], kg_per_month: [0, 40], count: [0, 4e9],
    // GER and GPI of tiny groups in tiny places run wild (Ladakh's Scheduled Caste women: a GER
    // of 335, a GPI of 14.8): published as such, ranged wide; a zero PTR marks no institution
    percent: [0, 400], index: [0, 20], pupils_per_teacher: [0, 1000], mw: [0, 3e5], inr_crore: [-1, 3e7], inr_lakh_crore: [0, 400] };
  let n = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => fam.some(([p]) => f.startsWith(p))).sort()) {
    const slug = f.replace(/\.json$/, "");
    if (listed.has(slug)) continue;
    const dossier = fam.find(([p]) => slug.startsWith(p))[1];
    const b = load(slug);
    checkMeta(b, slug, dossier, dossier === "deposits" ? b.meta.base : undefined, dossier === "deposits" ? b.meta.frequency : undefined);
    if (b.dates.length > 1) checkCadence(b.dates, { monthly: 1, quarterly: 3, annual: 12 }[b.meta.frequency] ?? 12, slug);
    const sr = {};
    for (const [k, s] of Object.entries(b.series)) { const u = s.unit ?? b.meta.unit; if (!UR[u]) fail(`${slug}.${k}: unit "${u}" has no range`); sr[k] = UR[u] ?? [-Infinity, Infinity]; }
    checkRange(b, -Infinity, Infinity, slug, sr);
    n++;
  }
  ok(`households: ${n} wave-2 bundles checked for meta, cadence, unit ranges and gaps`);

  // a generic "parts add to the total" check over series that share a prefix
  const parts = (slug, label, total, list, tol, { sep = "__", prefixOk = () => true } = {}) => withBundle(slug, (b) => {
    let checked = 0, bad = 0, worst = 0, at = "";
    const prefixes = new Set(Object.keys(b.series).filter((k) => k.endsWith(sep + total)).map((k) => k.slice(0, -(sep + total).length)).filter(prefixOk));
    for (const p of prefixes) b.dates.forEach((d, i) => {
      const T = b.series[p + sep + total]?.data[i]; const xs = list.map((x) => b.series[p + sep + x]?.data[i]);
      if (T == null || xs.some((v) => v == null)) return;
      checked++; const dev = Math.abs(xs.reduce((a, v) => a + v, 0) - T); if (dev > worst) { worst = dev; at = `${p} ${d}`; } if (dev > tol) bad++;
    });
    if (!checked) fail(`${slug}: identity "${label}" checked nothing`);
    else if (bad) fail(`${slug}: ${label} fails in ${bad} of ${checked} cells (worst ${worst.toFixed(3)} at ${at})`);
    else ok(`${slug}: ${label} in all ${checked} cells (worst ${worst.toFixed(3)})`);
  });

  // HCES: shares by category add to 100 (food total + non-food total) everywhere
  for (const [sl, foodKey] of [["hces-categories-states", (p) => p], ["hces-categories-states-imputed", (p) => p + "__food_total"], ["hces-categories-imputed", (p) => p + "__food_total"]]) withBundle(sl, (b) => {
    let n = 0, bad = 0;
    for (const k of Object.keys(b.series).filter((k) => k.endsWith("__non_food_total"))) { const p = k.slice(0, -"__non_food_total".length); const f = b.series[foodKey(p)];
      if (!f) continue; b.series[k].data.forEach((v, i) => { if (v == null || f.data[i] == null) return; n++; if (Math.abs(v + f.data[i] - 100) > 0.11) bad++; }); }
    if (!n) fail(`${sl}: food + non-food checked nothing`); else if (bad) fail(`${sl}: food + non-food != 100 in ${bad} of ${n} cells`); else ok(`${sl}: food + non-food = 100 in all ${n} cells`);
  });
  withBundle("hces-categories-states", (b) => { let bad = 0; const pre = Object.keys(b.series).filter((k) => !k.includes("__"));
    for (const k of pre) b.series[k].data.forEach((v, i) => { if (v != null && (v < 20 || v > 80)) bad++; }); if (bad) fail(`hces-categories-states: ${bad} food shares outside 20-80%`); else ok("hces-categories-states: every state food share between 20% and 80%"); });
  // HCES: rupees by category add to the MPCE (within 1%), state by state
  for (const [sl, mp] of [["hces-categories-inr-states", "hces-states"], ["hces-categories-inr-states-imputed", "hces-states-imputed"]]) withBundle(sl, (b) => withBundle(mp, (m) => {
    let bad = 0, n = 0;
    for (const [k, s] of Object.entries(b.series)) { if (!k.endsWith("__food_total")) continue; const p = k.slice(0, -"__food_total".length); const nf = b.series[p + "__non_food_total"]; const mpce = m.series[p];
      if (!nf || !mpce) continue; s.data.forEach((v, i) => { if (v == null || nf.data[i] == null || mpce.data[i] == null) return; n++; if (Math.abs(v + nf.data[i] - mpce.data[i]) / mpce.data[i] > 0.01) bad++; }); }
    if (!n) fail(`${sl}: nothing matched ${mp}`); else if (bad) fail(`${sl}: food + non-food differs from ${mp} by over 1% in ${bad} of ${n} cells`); else ok(`${sl}: food + non-food = the state's MPCE (${mp}) within 1% in all ${n} cells`);
  }));
  // HCES: each state's fractile ladder rises class by class
  withBundle("hces-fractiles-states", (b) => { const FR = ["0_5", "5_10", "10_20", "20_30", "30_40", "40_50", "50_60", "60_70", "70_80", "80_90", "90_95", "95_100"]; let bad = 0, n = 0;
    const pre = new Set(Object.keys(b.series).map((k) => k.split("__f")[0]));
    for (const p of pre) b.dates.forEach((d, i) => { const v = FR.map((f) => b.series[`${p}__f${f}`]?.data[i]); if (v.some((x) => x == null)) return; n++; if (v.some((x, j) => j && x < v[j - 1])) bad++; });
    if (bad) fail(`hces-fractiles-states: ${bad} of ${n} ladders do not rise class by class`); else ok(`hces-fractiles-states: all ${n} state ladders rise class by class`); });
  parts("hces-quantities-states", "rice + wheat + coarse + other cereals = total cereals", "total_cereals", ["rice", "wheat", "coarse_grains", "other_cereals"], 0.02);

  // AISHE: levels add to all levels; women + men = both; six posts = all teachers
  for (const g of ["both", "male", "female"]) parts("aishe-states-enrolment", `the eight levels sum to all levels (${g})`, `grand_total_${g}`,
    ["phd", "mphil", "post_graduate", "under_graduate", "pg_diploma", "diploma", "certificate", "integrated"].map((l) => `${l}_${g}`), 2);
  withBundle("aishe-states-enrolment", (b) => { let bad = 0, n = 0; for (const k of Object.keys(b.series).filter((k) => k.endsWith("_both"))) { const m = b.series[k.replace(/_both$/, "_male")], f = b.series[k.replace(/_both$/, "_female")]; if (!m || !f) continue;
    b.series[k].data.forEach((v, i) => { if (v == null || m.data[i] == null || f.data[i] == null) return; n++; if (Math.abs(m.data[i] + f.data[i] - v) > 2) bad++; }); }
    if (bad) fail(`aishe-states-enrolment: women + men != both in ${bad} of ${n} cells`); else ok(`aishe-states-enrolment: women + men = both in all ${n} cells`); });
  for (const g of ["both", "male", "female"]) withBundle("aishe-states-teachers", (b) => { let bad = 0, n = 0;
    for (const k of Object.keys(b.series).filter((k) => k.endsWith(`__all_${g}`))) { const p = k.slice(0, -`__all_${g}`.length);
      b.series[k].data.forEach((v, i) => { const xs = ["professor", "reader_associate", "lecturer_assistant", "demonstrator", "temporary", "visiting"].map((f) => b.series[`${p}__${f}_${g}`]?.data[i] ?? 0); if (v == null) return; n++; if (Math.abs(xs.reduce((a, x) => a + x, 0) - v) > 40) bad++; }); }
    if (bad) fail(`aishe-states-teachers: six posts != all teachers (${g}) in ${bad} of ${n} cells`); else ok(`aishe-states-teachers: six posts = all teachers (${g}) in all ${n} cells (within 40)`); });

  // MNRE: the four bio kinds add to bio total, nationally and in every state; solar categories to solar total
  parts("mnre-bio-categories", "four bio kinds = bio total", "total", ["bagasse", "non_bagasse", "waste_to_energy", "waste_to_energy_off_grid"], 1, { sep: "", prefixOk: () => true });
  parts("mnre-states-bio", "four bio kinds = bio total, every state", "total", ["bagasse", "non_bagasse", "waste_to_energy", "waste_to_energy_off_grid"], 1);
  withBundle("mnre-states-solar", (b) => { let bad = 0, n = 0, worst = 0; for (const k of Object.keys(b.series).filter((k) => !k.includes("__"))) b.series[k].data.forEach((v, i) => {
    const xs = ["ground_mounted", "rooftop", "hybrid", "off_grid"].map((c) => b.series[`${k}__${c}`]?.data[i]); if (v == null || xs.every((x) => x == null)) return; n++; const dev = Math.abs(xs.reduce((a, x) => a + (x ?? 0), 0) - v); worst = Math.max(worst, dev); if (dev > 1) bad++; });
    if (bad) fail(`mnre-states-solar: categories != solar total in ${bad} of ${n} cells (worst ${worst.toFixed(2)} MW)`); else ok(`mnre-states-solar: categories = solar total in all ${n} state-months`); });

  // deposits: every table's parts add to its totals, on the baked (crore) values
  const A3 = 3.5, C2 = 2;
  for (const sl of fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => /^deposits-.*\.json$/.test(f)).map((f) => f.replace(/\.json$/, ""))) {
    const ks = Object.keys(load(sl).series);
    const has = (suf) => ks.some((k) => k.endsWith("__" + suf));
    if (has("savings_accounts") && has("term_accounts")) { if (has("total")) parts(sl, "current + savings + term = all deposits", "total", ["current", "savings", "term"], A3);
      if (has("current_accounts") && has("total_accounts")) parts(sl, "accounts: current + savings + term = all", "total_accounts", ["current_accounts", "savings_accounts", "term_accounts"], C2); }
    else if (has("individuals") && has("others")) { parts(sl, "individuals + others = all", "total", ["individuals", "others"], A3); parts(sl, "accounts: individuals + others = all", "total_accounts", ["individuals_accounts", "others_accounts"], C2); }
    else if (has("deposit_taking")) parts(sl, "the six owning sectors = all sectors", "total", ["government", "nfc", "deposit_taking", "other_fc", "households", "rest_of_world"], A3);
    else if (has("psb") && has("all_banks")) parts(sl, "the bank groups = all banks", "all_banks", ["psb", "foreign", "rrb", "private", "sfb", "payments"], A3);
    else if (has("officers")) { parts(sl, "officers + clerks + subordinates = all employees", "total", ["officers", "clerks", "subordinates"], 0); parts(sl, "women: officers + clerks + subordinates = all", "women_total", ["women_officers", "women_clerks", "women_subordinates"], 0); }
    else if (has("current") && has("savings") && has("term")) parts(sl, "current + savings + term = all deposits", "total", ["current", "savings", "term"], A3);
  }
  // deposits: the values checked by hand against RBI's release of 29 May 2026 (March 2026)
  withBundle("deposits-sectors", (b) => { const i = b.dates.indexOf("2026-03-01"); const T = b.series.total__total.data[i];
    const hh = b.series.s4__total.data[i] / T * 100, sv = b.series.total__savings.data[i] / T * 100, tm = b.series.total__term.data[i] / T * 100;
    if (Math.abs(hh - 59.3) > 0.05 || Math.abs(sv - 28.7) > 0.05 || Math.abs(tm - 61.6) > 0.05) fail(`deposits-sectors: March 2026 shares ${hh.toFixed(2)}/${sv.toFixed(2)}/${tm.toFixed(2)} differ from RBI's 59.3/28.7/61.6`);
    else ok(`deposits-sectors: March 2026 households ${hh.toFixed(1)}%, savings ${sv.toFixed(1)}%, term ${tm.toFixed(1)}% = RBI's release`); });
  withBundle("deposits-age", (b) => withBundle("deposits-sectors", (s) => { const i = b.dates.indexOf("2026-03-01"), j = s.dates.indexOf("2026-03-01");
    const sen = (b.series.individuals__a7_60_to_69__total.data[i] + b.series.individuals__a8_70_and_above__total.data[i]) / s.series.total__total.data[j] * 100;
    if (Math.abs(sen - 20.0) > 0.05) fail(`deposits-age: seniors ${sen.toFixed(2)}% of deposits, RBI says 20.0%`); else ok(`deposits-age: seniors hold ${sen.toFixed(2)}% of deposits = RBI's 20.0%`); }));
  withBundle("deposits-maturity-owners", (b) => { const i = b.dates.indexOf("2026-03-01"); const sh = b.series["m4_1_to_3_years__total"].data[i] / b.series["all__total"]?.data[i] * 100;
    if (!(Math.abs(sh - 69.8) <= 0.05)) fail(`deposits-maturity-owners: 1-3 year share ${sh} differs from RBI's 69.8%`); else ok(`deposits-maturity-owners: 1-3 years ${sh.toFixed(2)}% of term deposits = RBI's 69.8%`); });
}

if (failures) { console.error(`\n${failures} validation failure(s)`); process.exit(1); }
console.log("validate: all checks passed");
