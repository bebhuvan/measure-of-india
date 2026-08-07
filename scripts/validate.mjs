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
  // ASI: mixed units — counts (factories ~2.6e5, persons ~1.9e7) and ₹ lakh
  // levels (gross output ~1.2e9 lakh); ranges are wide by construction
  { slug: "asi-headline", dossier: "asi", cadence: 12, range: [0, 2.5e9] },
  // industry/state cuts can carry real negative GVA (e.g. Ladakh 2021-22,
  // GVA -434 ₹ lakh — aggregate losses in a tiny UT, as published)
  { slug: "asi-industries", dossier: "asi", cadence: 12, range: [-1e8, 2.5e9] },
  { slug: "asi-states", dossier: "asi", cadence: 12, range: [-1e8, 2.5e9] },
  // ASUSE: counts up to ~1.2e8 workers; per-worker ₹/year values ~1e5-1e6
  { slug: "asuse-annual", dossier: "asuse", cadence: 12, range: [0, 5e8] },
  { slug: "asuse-sectors", dossier: "asuse", cadence: 12, range: [0, 5e8] },
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
