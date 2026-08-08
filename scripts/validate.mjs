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

function checkRange(bundle, lo, hi, slug) {
  const gaps = new Set(bundle.meta?.gaps ?? []);
  for (const [k, s] of Object.entries(bundle.series)) {
    // series may legitimately start late or end early (e.g. a state series
    // shorter than the bundle axis); nulls outside a series' own published
    // span are fine, interior nulls must be disclosed in meta.gaps.
    const first = s.data.findIndex((v) => v != null);
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    if (first === -1) { fail(`${slug}.${k}: entirely empty`); continue; }
    s.data.forEach((v, i) => {
      if (v === null) {
        if (i > first && i < last && !gaps.has(bundle.dates[i])) fail(`${slug}.${k}: null at ${bundle.dates[i]} (not disclosed in meta.gaps)`);
      } else if (v < lo || v > hi) fail(`${slug}.${k}: implausible ${v} at ${bundle.dates[i]}`);
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
  if (freq && m.frequency !== freq && !(dossierKey === "plfs")) fail(`${slug}: meta.frequency "${m.frequency}" != sources.yml "${freq}"`);
}

function checkWeights(dossierKey, field = "weights") {
  const w = cfg.dossiers[dossierKey]?.[field];
  if (!w) return;
  const sum = Object.values(w).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.01) fail(`${dossierKey}: ${field} sum to ${sum}, not 100`);
  else ok(`${dossierKey}: ${field} sum to ${sum.toFixed(2)}`);
}

function checkCrosscheck(bundle, slug, computedKey, publishedKey, tol) {
  if (bundle.meta.mock) return;
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
  { slug: "cpi", dossier: "cpi", cadence: 1, range: [-8, 20], cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-rural", dossier: "cpi", cadence: 1, range: [-12, 20], cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-urban", dossier: "cpi", cadence: 1, range: [-12, 20], cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-subgroups", dossier: "cpi", cadence: 1, range: [-30, 70] },
  { slug: "cpi-states", dossier: "cpi", cadence: 1, range: [-8, 30] },
  // range is wide: Daman & Diu's published rural index falls ~13% over
  // late 2018 – early 2019 (as-published in eSankhyiki)
  { slug: "cpi-states-sectors", dossier: "cpi", cadence: 1, range: [-15, 35] },
  // base 2024=100 — separate bundles, never spliced with the 2012 base.
  // Upper range bound is the personal-care division (carries gold, ~19% y/y
  // through H1 2026). Crosscheck here is computed-from-levels y/y against the
  // API's published inflation rate — NOT a weights recomputation; the API
  // serves no weights for this base (disclosed in meta.note).
  { slug: "cpi-2024", dossier: "cpi", cadence: 1, range: [-8, 25], base: "2024=100", cross: ["headline", "published_headline", 0.15] },
  { slug: "cpi-2024-sectors", dossier: "cpi", cadence: 1, range: [-12, 25], base: "2024=100" },
  // the NSO's own back-cast (series=Back): levels published to one decimal,
  // so computed y/y can sit ~0.16pt from the published rate — tolerance 0.25
  { slug: "cpi-2024-back", dossier: "cpi", cadence: 1, range: [-8, 20], base: "2024=100", cross: ["headline", "published_headline", 0.25] },
  { slug: "gdp", dossier: "gdp", cadence: 3, range: [-70, 90], cross: ["gdp", "gdp_growth_published", 0.6], cross2: ["gva", "gva_growth_published", 0.6] },
  { slug: "gdp-expenditure", dossier: "gdp", cadence: 3, range: [-90, 150] },
  { slug: "gdp-accounts", dossier: "gdp", cadence: 12, range: [-90, 150], freq: "annual" },
  // 8-sector quarterly real GVA; range spans the lockdown whipsaw
  // (trade/construction fell ~-50% and rebounded past +45%)
  { slug: "gdp-industries", dossier: "gdp", cadence: 3, range: [-70, 90] },
  // nominal GDP y/y and the implied deflator. Nominal >= real in
  // inflationary years is NOT asserted — the deflator can print below zero
  // (WPI-heavy) while the CPI is positive, and did in FY16.
  { slug: "gdp-nominal", dossier: "gdp", cadence: 3, range: [-40, 45], cross: ["gdp_nominal", "nominal_growth_published", 0.6] },
  // the new base: quarterly prints continue here after Q2 FY26; separate
  // bundle, never spliced with the 2011-12 base
  { slug: "gdp-2022", dossier: "gdp", cadence: 3, range: [-10, 20], base: "2022-23", cross: ["gdp", "gdp_growth_published", 0.6], cross2: ["gva", "gva_growth_published", 0.6] },
  { slug: "wpi", dossier: "wpi", cadence: 1, range: [-30, 60], cross: ["headline", "published_headline", 0.15] },
  { slug: "wpi-groups", dossier: "wpi", cadence: 1, range: [-70, 130] },
  { slug: "wpi-subgroups", dossier: "wpi", cadence: 1, range: [-80, 250] },
  { slug: "cpialrl-1986", dossier: "cpialrl", cadence: 1, range: [-5, 25], base: "1986-87=100" },
  { slug: "cpialrl-2019", dossier: "cpialrl", cadence: 1, range: [-10, 300], base: "2019=100" },
  // range is wide: Assam's published old-base levels spike ~20% in late 2021
  // (as-published in eSankhyiki), dragging 2022 y/y to about -14%
  { slug: "cpialrl-states-1986", dossier: "cpialrl", cadence: 1, range: [-20, 40], base: "1986-87=100" },
  { slug: "cpialrl-states-2019", dossier: "cpialrl", cadence: 1, range: [50, 300], base: "2019=100" },
  { slug: "cpialrl-groups-2019", dossier: "cpialrl", cadence: 1, range: [-10, 300], base: "2019=100" },
  { slug: "plfs-monthly", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-quarterly", dossier: "plfs", cadence: 3, range: [0, 100] },
  { slug: "plfs-cuts", dossier: "plfs", cadence: 1, range: [0, 100] },
  { slug: "plfs-annual", dossier: "plfs", cadence: 12, range: [0, 100] },
  { slug: "plfs-states", dossier: "plfs", cadence: 12, range: [0, 45] },
  { slug: "plfs-status", dossier: "plfs", cadence: 12, range: [0, 100] },
  // ₹ levels: casual female r+u floor ~₹165/day, regular male ceiling ~₹22k/mo
  { slug: "plfs-earnings", dossier: "plfs", cadence: 3, range: [100, 60000] },
  { slug: "plfs-education", dossier: "plfs", cadence: 12, range: [0, 45] },
  { slug: "rbi-trade", dossier: "rbi", cadence: 1, range: [-60000, 80000], cross: ["balance", "balance_published", 5] },
  { slug: "rbi-forex", dossier: "rbi", cadence: 1, range: [5, 1000000] },
  { slug: "rbi-trade-oil", dossier: "rbi", cadence: 1, range: [0, 100000] },
  { slug: "rbi-bop", dossier: "rbi", cadence: 3, range: [-200000, 200000], freq: "quarterly" },
  { slug: "rbi-bop-ratios", dossier: "rbi", cadence: 12, range: [-15, 60], freq: "annual" },
  { slug: "rbi-debt", dossier: "rbi", cadence: 12, range: [0, 1500000], freq: "annual" },
  { slug: "rbi-nri", dossier: "rbi", cadence: 1, range: [-60000, 500000] },
  // low bound is the yen: quoted ₹ per single yen (0.01 in 1966); USD itself
  // stays within 4.76 (pre-1966-devaluation) .. ~90
  { slug: "rbi-exchange-rates", dossier: "rbi", cadence: 1, range: [0.005, 130] },
  { slug: "rbi-forward-premia", dossier: "rbi", cadence: 1, range: [-10, 40] },
  // gross legs peak ~69bn/month (Feb 2025 sales); forward book has hit -89bn
  { slug: "rbi-intervention", dossier: "rbi", cadence: 1, range: [-100000, 80000] },
  { slug: "rbi-invisibles", dossier: "rbi", cadence: 12, range: [-60000, 300000], freq: "annual" },
  // ₹ Crore stocks, all positive; gross ≈ 63 lakh crore end-Mar 2025
  { slug: "rbi-debt-quarterly", dossier: "rbi", cadence: 3, range: [0, 10000000], freq: "quarterly" },
  // ceiling is imports from China (~$113bn FY25); identities checked below
  { slug: "rbi-trade-partners", dossier: "rbi", cadence: 12, range: [0, 250000], freq: "annual" },
  // ceilings: engineering exports ~$117bn; crude & products imports ~$186bn
  { slug: "rbi-commodities-exports", dossier: "rbi", cadence: 12, range: [0, 150000], freq: "annual" },
  { slug: "rbi-commodities-imports", dossier: "rbi", cadence: 12, range: [0, 250000], freq: "annual" },
  // gross monthly turnover, both legs: ~$76bn Aug 1996 to ~$3.0tn Jul 2025
  { slug: "rbi-fx-turnover", dossier: "rbi", cadence: 1, range: [0, 4000000] },
  { slug: "isp", dossier: "isp", cadence: 1, range: [50, 250] },
  { slug: "iip-2022", dossier: "iip", cadence: 1, range: [-30, 60], cross: ["general", "headline_growth_published", 0.3] },
  // old base spans the COVID whipsaw: near-zero lockdown levels make the
  // 2021 y/y mathematically correct but enormous (consumer durables +1778%,
  // Apr 2021). Ranges are documentation, not curation — values as computed.
  { slug: "iip-2011", dossier: "iip", cadence: 1, range: [-100, 1800], base: "2011-12=100", cross: ["general", "headline_growth_published", 0.3] },
  { slug: "iip-industries-2022", dossier: "iip", cadence: 1, range: [-60, 120] },
  { slug: "iip-industries-2011", dossier: "iip", cadence: 1, range: [-100, 55000], base: "2011-12=100" },
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
  { slug: "asi-headline-2004", dossier: "asi", cadence: 12, range: [-5e8, 2.5e9], base: "NIC 2004" },
  { slug: "asi-headline-1998", dossier: "asi", cadence: 12, range: [-5e8, 2.5e9], base: "NIC 1998" },
  { slug: "asi-headline-1987", dossier: "asi", cadence: 12, range: [-5e8, 2.5e9], base: "NIC 1987" },
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
  { slug: "asuse-quarterly", dossier: "asuse", cadence: 3, range: [0, 3e6], freq: "quarterly" },
];

for (const p of PRODUCTS) {
  const file = path.join(ROOT, "data/series", p.slug + ".json");
  if (!fs.existsSync(file)) { fail(`${p.slug}: data/series/${p.slug}.json missing`); continue; }
  const b = load(p.slug);
  checkMeta(b, p.slug, p.dossier, p.base, p.freq);
  checkCadence(b.dates, p.cadence, p.slug);
  checkRange(b, p.range[0], p.range[1], p.slug);
  if (p.cross) checkCrosscheck(b, p.slug, ...p.cross);
  if (p.cross2) checkCrosscheck(b, p.slug, ...p.cross2);
  const last = b.dates.at(-1);
  console.log(`  ${p.slug}: ${b.dates.length} pts, ${b.dates[0]} .. ${last}, vintage ${b.meta.vintage}${b.meta.mock ? " (MOCK)" : ""}`);
}

checkWeights("cpi");
checkWeights("cpi", "weights_rural");
checkWeights("cpi", "weights_urban");
checkWeights("wpi");

/* ---- CPI base-year seam: two bases, never overlapping-spliced ---- */
withBundle("cpi", (b12) => withBundle("cpi-2024", (b24) => {
  if (b12.meta.base === b24.meta.base) fail("cpi/cpi-2024: both bundles declare the same base");
  // the 2012-base stream stopped at Dec 2025; the first same-base y/y on the
  // new base is Jan 2026 — the seam is clean, no month carries both bases
  const last12 = b12.dates.at(-1), first24 = b24.dates[0];
  if (!(last12 < first24)) fail(`cpi: 2012-base bundle runs to ${last12}, overlapping 2024-base y/y from ${first24} — seam not clean`);
  else ok(`cpi: base seam clean — 2012 base ends ${last12}, 2024-base y/y begins ${first24}`);
}));

/* ---- 2024-base raw levels: a young index must sit near 100 ---- */
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

if (failures) { console.error(`\n${failures} validation failure(s)`); process.exit(1); }
console.log("validate: all checks passed");
