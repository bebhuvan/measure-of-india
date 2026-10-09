#!/usr/bin/env node
// scripts/census.mjs — the full inventory of a dossier's data, computed
// deterministically from the baked bundles. This is the artifact an agent
// MUST produce and read before writing prose or charts for a dossier:
// every series, every cut, ranked, with extremes, runs, gaps and headline
// contradictions. Nothing here samples, filters or summarises away rows —
// the census exists because the writer's view must be the whole basket.
//
// Usage:
//   node scripts/census.mjs cpi            # every bundle whose meta.dossier = cpi
//   node scripts/census.mjs cpi --headline cpi-2024:headline
//   node scripts/census.mjs --bundle wpi-items   # a single bundle
//
// Output: pipeline/out/census-<dossier>.json plus a human-readable summary
// on stdout. Exit 1 if the dossier has no bundles.
//
// Long tails (round 4, framework): a bundle with more than SUMMARY_FROM series (trade's 6-digit
// tables, services' ASUSE profile, 10,000 series and more) is SUMMARISED: its counts and
// tail statistics, the extremes by level and by change, every series with a notable run, gap
// or null share (the human summary's notables), and the cross-bundle facts in full. Nothing
// downstream reads a census file to write or check prose: pipeline/facts.mjs computes the
// writer's facts from the bundles through pipeline/lib/census-core.mjs, the same functions.
// `--full` keeps every series. A census still over 10 MB is written to census-<dossier>.full.json,
// which is git-ignored, and the committed file stays the summary.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seriesFacts, crossBundle } from "../pipeline/lib/census-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const FULL = argv.includes("--full");
const SUMMARY_FROM = 150;          // the every-cut long-tail threshold (src/dossiers/everycut.js LONG_TAIL)
const MAX_COMMITTED = 10e6;        // bytes; census files larger than this are not committed
const bundleFlag = argv.indexOf("--bundle");
const headlineFlag = argv.indexOf("--headline");

let dossier = null;
let onlyBundle = null;
let headlineArg = null;
if (bundleFlag !== -1) onlyBundle = argv[bundleFlag + 1];
if (headlineFlag !== -1) headlineArg = argv[headlineFlag + 1];
dossier = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--bundle" && argv[i - 1] !== "--headline");
if (!dossier && !onlyBundle) {
  console.error("usage: node scripts/census.mjs <dossier> [--headline <bundle>:<series>] | --bundle <slug>");
  process.exit(1);
}

const SERIES_DIR = path.join(ROOT, "data", "series");
const OUT_DIR = path.join(ROOT, "pipeline", "out");

const load = (slug) => JSON.parse(fs.readFileSync(path.join(SERIES_DIR, slug + ".json"), "utf8"));

// per-series and cross-bundle fact extraction lives in
// pipeline/lib/census-core.mjs — shared with pipeline/facts.mjs so a ranking
// the prose uses is the ranking the census audited.

/* ---- assemble ---- */

let bundles;
if (onlyBundle) {
  bundles = [{ slug: onlyBundle, bundle: load(onlyBundle) }];
  dossier = onlyBundle;
} else {
  bundles = fs.readdirSync(SERIES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort() // deterministic bundle order — the census must be byte-stable
    .map((f) => {
      const slug = f.replace(/\.json$/, "");
      const b = load(slug);
      return b.meta?.dossier === dossier ? { slug, bundle: b } : null;
    })
    .filter(Boolean);
  if (!bundles.length) {
    console.error(`census: no bundles found with meta.dossier = "${dossier}"`);
    process.exit(1);
  }
}

// headline resolution: explicit `bundle:series` > conventional keys > none
function resolveHeadline() {
  if (headlineArg) {
    const [slug, key] = headlineArg.split(":");
    if (!bundles.some((x) => x.slug === slug) || !load(slug).series[key]) {
      console.error(`census: --headline ${headlineArg}: no such series`);
      process.exit(1);
    }
    return { bundle: slug, key };
  }
  const common = ["headline", "general", "gdp", "gva", "mpce_total", "wpr"];
  for (const key of common) {
    // several bundles can carry the key (a frozen back-cast beside the live
    // stream); the freshest one is the reading that matters
    const candidates = bundles
      .filter(({ bundle }) => bundle.series[key])
      .sort((a, b) => b.bundle.dates.at(-1).localeCompare(a.bundle.dates.at(-1)) || a.slug.localeCompare(b.slug));
    if (candidates.length) return { bundle: candidates[0].slug, key };
  }
  return null;
}
const headline = resolveHeadline();

const census = { dossier, headline: headline ? `${headline.bundle}:${headline.key}` : null, bundles: [] };

for (const { slug, bundle } of bundles) {
  const series = Object.entries(bundle.series).map(([key, s]) => seriesFacts(bundle.dates, { key, ...s }));
  census.bundles.push({
    slug,
    meta: {
      base: bundle.meta.base ?? null,
      frequency: bundle.meta.frequency ?? null,
      vintage: bundle.meta.vintage ?? null,
      latestPeriod: bundle.meta.latestPeriod ?? null,
      note: bundle.meta.note ?? null,
      gapsDeclared: Object.values(bundle.series).reduce((a, s) => a + (s.gaps?.length ?? 0), 0),
    },
    seriesCount: series.length,
    series,
  });
}

/* ---- cross-bundle facts ---- */

const cross = { headlineReading: null, perBundle: [] };
if (headline) {
  const hf = census.bundles.find((x) => x.slug === headline.bundle).series.find((s) => s.key === headline.key);
  cross.headlineReading = { ...hf };
  const hDir = hf.deltaVsYearAgo == null ? null : Math.sign(hf.deltaVsYearAgo);
  for (const { slug } of bundles) {
    const facts = census.bundles.find((x) => x.slug === slug).series;
    const entry = crossBundle(slug, facts, headline.key, hDir, slug === headline.bundle);
    cross.perBundle.push(entry);
  }
}

census.cross = cross;

/* ---- coverage summary ---- */

census.coverage = {
  bundleCount: census.bundles.length,
  seriesCount: census.bundles.reduce((a, b) => a + b.seriesCount, 0),
  pointCount: census.bundles.reduce((a, b) => a + b.series.reduce((x, s) => x + s.points, 0), 0),
  nullShare: (() => {
    const tot = census.bundles.reduce((a, b) => a + b.series.reduce((x, s) => x + s.points, 0), 0);
    const nn = census.bundles.reduce((a, b) => a + b.series.reduce((x, s) => x + s.nonNull, 0), 0);
    return tot ? +(1 - nn / tot).toFixed(4) : 1;
  })(),
  seriesWithInteriorGaps: census.bundles.reduce((a, b) => a + b.series.filter((s) => s.interiorGaps.length).length, 0),
};

/* ---- long tails: summarise (see the header) ---- */

const notableOf = (s) => s.run.length >= 3 || s.interiorGaps.length || s.nullShare > 0.1;
function summarise(b) {
  const S = b.series;
  const withLatest = S.filter((s) => s.latest != null).sort((a, c) => a.latest - c.latest);
  const withDelta = S.filter((s) => s.deltaVsYearAgo != null).sort((a, c) => a.deltaVsYearAgo - c.deltaVsYearAgo);
  const ends = (arr, n = 15) => [...arr.slice(0, n), ...arr.slice(-n)];
  const keep = new Map();
  // notables, capped: in a long tail most series carry some run, so the 100 with the most gaps,
  // then the longest runs, then the most nulls; the tail statistics count them all
  const notables = S.filter(notableOf).sort((a, c) => c.interiorGaps.length - a.interiorGaps.length || c.run.length - a.run.length || c.nullShare - a.nullShare || (a.key < c.key ? -1 : 1)).slice(0, 100);
  for (const s of [...ends(withLatest), ...ends(withDelta), ...notables]) keep.set(s.key, s);
  const med = (arr) => (arr.length ? arr[Math.floor(arr.length / 2)] : null);
  const units = {};
  for (const s of S) units[s.unit ?? "none"] = (units[s.unit ?? "none"] ?? 0) + 1;
  return {
    ...b,
    summarised: { from: SUMMARY_FROM, kept: keep.size, why: "the 15 highest and lowest by latest value and by change on a year earlier, and up to 100 notable series (most interior gaps, then the longest runs, then the most nulls); the tail counts cover every series" },
    tail: {
      latestMedian: med(withLatest)?.latest ?? null, latestMin: withLatest[0]?.latest ?? null, latestMax: withLatest.at(-1)?.latest ?? null,
      deltaVsYearAgoMedian: med(withDelta)?.deltaVsYearAgo ?? null,
      risingVsPrev: S.filter((s) => s.deltaVsPrev > 0).length, fallingVsPrev: S.filter((s) => s.deltaVsPrev < 0).length,
      risingVsYearAgo: S.filter((s) => s.deltaVsYearAgo > 0).length, fallingVsYearAgo: S.filter((s) => s.deltaVsYearAgo < 0).length,
      belowZero: withLatest.filter((s) => s.latest < 0).length, noLatest: S.length - withLatest.length,
      withInteriorGaps: S.filter((s) => s.interiorGaps.length).length, withRun3: S.filter((s) => s.run.length >= 3).length,
      units,
    },
    series: [...keep.values()].sort((a, c) => (a.key < c.key ? -1 : 1)),
  };
}
const longTail = new Set(census.bundles.filter((b) => b.seriesCount > SUMMARY_FROM).map((b) => b.slug));
const written = FULL ? census : {
  ...census,
  bundles: census.bundles.map((b) => (longTail.has(b.slug) ? summarise(b) : b)),
  // a long tail's ranking keeps its two ends and its length; the order in between is the
  // bundle's own and is recomputed by census-core whenever facts need it
  cross: { ...census.cross, perBundle: census.cross.perBundle.map((e) => (longTail.has(e.bundle) && e.ranking?.length > 60
    ? { ...e, ranking: [...e.ranking.slice(0, 30), ...e.ranking.slice(-30)], rankingLength: e.ranking.length, rankingKept: "top 30 and bottom 30" } : e)) },
};

/* ---- emit ---- */

fs.mkdirSync(OUT_DIR, { recursive: true });
let outFile = path.join(OUT_DIR, `census-${dossier}.json`);
let text = JSON.stringify(written, null, 2) + "\n";
if (text.length > MAX_COMMITTED) {
  // too large to commit even summarised (or --full): the git-ignored full file, and a pointer
  outFile = path.join(OUT_DIR, `census-${dossier}.full.json`);
  process.stdout.write(`census: ${(text.length / 1e6).toFixed(1)} MB is over the 10 MB committed limit; writing ${path.relative(ROOT, outFile)} (git-ignored)\n`);
}
fs.writeFileSync(outFile, text);

// human-readable summary
const line = (s) => process.stdout.write(s + "\n");
line(`census: ${dossier} — ${census.coverage.bundleCount} bundles, ${census.coverage.seriesCount} series, ${census.coverage.pointCount} points (null share ${(census.coverage.nullShare * 100).toFixed(1)}%)`);
if (census.headline) line(`headline: ${census.headline} latest ${census.cross.headlineReading.latest} at ${census.cross.headlineReading.latestPeriod} (Δ vs year ago ${census.cross.headlineReading.deltaVsYearAgo})`);
for (const b of census.bundles) {
  line(`\n== ${b.slug} — ${b.seriesCount} series, base ${b.meta.base ?? "—"}, through ${b.meta.latestPeriod ?? "—"} (vintage ${b.meta.vintage ?? "—"})`);
  const x = cross.perBundle.find((e) => e.bundle === b.slug);
  if (x?.topByDelta) {
    line(`   hottest: ${x.topByDelta.key} (${x.topByDelta.deltaVsYearAgo >= 0 ? "+" : ""}${x.topByDelta.deltaVsYearAgo})   coolest: ${x.bottomByDelta.key} (${x.bottomByDelta.deltaVsYearAgo})   spread: ${x.spreadDelta}`);
    if (x.contradictions.length) line(`   contradicts headline move: ${x.contradictions.join(", ")}`);
  }
  const notable = b.series.filter((s) => s.run.length >= 3 || s.interiorGaps.length || s.nullShare > 0.1);
  for (const s of notable.slice(0, 12)) {
    line(`   ${s.run.length >= 3 ? `run ${s.run.direction}×${s.run.length} since ${s.run.since}` : ""}${s.interiorGaps.length ? ` gaps:${s.interiorGaps.length}` : ""}${s.nullShare > 0.1 ? ` nullShare ${(s.nullShare * 100).toFixed(0)}%` : ""} — ${s.key}`);
  }
}
line(`\nwrote ${path.relative(ROOT, outFile)}`);
