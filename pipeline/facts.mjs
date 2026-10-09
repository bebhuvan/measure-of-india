#!/usr/bin/env node
// pipeline/facts.mjs — compute the facts sheet for a dossier from its baked
// series JSON. The generator may write ONLY from this sheet.
// Usage: node pipeline/facts.mjs <slug>   → pipeline/out/facts-<slug>.json

import YAML from "yaml";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bySlug } from "../src/dossiers/registry.js";
import { makePeriodLabel, yearLag } from "./lib/periods.mjs";
import { seriesFacts, crossBundle, commonHeadline } from "./lib/census-core.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node pipeline/facts.mjs <slug | --all>"); process.exit(1); }

if (slug === "--all") {
  // recompute facts for every dossier that has prose slots — no slug may go
  // stale by omission (the qc freshness gate enforces the rest)
  const { execFileSync } = await import("node:child_process");
  const YAML = (await import("yaml")).default;
  const slots = YAML.parse(fs.readFileSync(path.join(ROOT, "pipeline/slots.yml"), "utf8"));
  let bad = 0;
  for (const s of Object.keys(slots)) {
    try { execFileSync(process.execPath, [import.meta.filename, s], { stdio: "inherit" }); }
    catch { bad++; }
  }
  process.exit(bad ? 1 : 0);
}

// The current print lives on the rebased bundle where one exists: the 2012 CPI
// base retired Dec 2025, the 2011-12 GDP base at Q2 FY26. Prose must describe
// the CURRENT ruler — the registry's currentBundle, not a retired base.
const D = bySlug[slug];
if (!D) { console.error(`facts: dossier "${slug}" is not in src/dossiers/registry.js`); process.exit(1); }
const bundleSlug = D.currentBundle;
const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", bundleSlug + ".json"), "utf8"));
const monthly = bundle.meta.frequency === "monthly";
const annual = bundle.meta.frequency === "annual";
const lag = yearLag(bundle.meta.frequency);
const calendar = D.calendar ?? "fiscal-apr";   // "fiscal-apr" for Indian official statistics; "calendar" for World Bank/OWID-style sources
const bands = D.bands ?? null;   // a policy band (e.g. the RBI 2–6% tolerance) exists only where the law says so
const periodLabel = makePeriodLabel(bundle.meta.frequency, calendar);

// the ruler of every number (F4, docs/INVENTORY-data-paths.md "Base years" point 3): the
// bundle a figure comes from, its base, and where data/sources.yml `seams:` places that base.
// Every series entry, every proseInputs summary and the legacy block carry one, so the writer
// can always say which ruler a number is on. Structural, never citable: verify.mjs skips
// `ruler` keys when it collects the numbers prose may use.
const SEAMS = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8")).seams ?? {};
function rulerOf(b) {
  const meta = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", b + ".json"), "utf8")).meta ?? {};
  for (const [product, bases] of Object.entries(SEAMS)) {
    for (const e of bases ?? []) {
      const win = { from: e.from ?? null, to: e.to ?? null };
      if ((e.bundles ?? []).includes(b)) return { bundle: b, base: e.base, product, window: win, current: e.to == null, agencyLink: null };
      if ((e.bridge?.bundles ?? []).includes(b)) return { bundle: b, base: e.base, product, window: win, current: e.to == null, agencyLink: e.bridge.what ?? e.bridge.kind };
    }
  }
  return { bundle: b, base: meta.base ?? null, product: null, window: null, current: null, agencyLink: null, note: "no registered seam: this product has one ruler" };
}

function streak(data, pred) {
  let n = 0;
  for (let i = data.length - 1; i >= 0 && pred(data[i].value); i--) n++;
  return n;
}

const facts = {
  dossier: slug,
  bundle: bundleSlug,
  base: bundle.meta.base,
  vintage: bundle.meta.vintage,
  latestPeriod: periodLabel(bundle.dates.at(-1)),
  releaseDate: bundle.meta.releaseDate,
  bands,
  ruler: rulerOf(bundleSlug),
  series: {},
};

for (const [k, s] of Object.entries(bundle.series)) {
  const data = s.data.map((v, i) => ({ date: bundle.dates[i], value: v }));
  const L = data.at(-1).value, P = data.at(-2).value;
  const yIdx = data.length - 1 - lag;
  const Y = yIdx >= 0 ? data.at(-1 - lag).value : null;   // young series (e.g. CPI base 2024) have no same-base year-ago yet
  const min = data.reduce((a, d) => (d.value < a.value ? d : a));
  const max = data.reduce((a, d) => (d.value > a.value ? d : a));
  // Level-based series (ASI counts, ₹ lakh; HCES ₹) need growth rates derived
  // from levels — the raw deltaVsPrev is an absolute change, not a rate. The
  // pipeline's rate-based streaks (below2/above6) are meaningless for levels,
  // so growth-based streaks replace them.
  const levelBased = s.unit && (s.unit === "count" || s.unit === "inr_lakh" || s.unit === "inr" || s.unit === "thousand" || s.unit === "inr_per_year");
  const growthVsPrevPct = levelBased && L != null && P != null && P !== 0 ? Math.round(((L / P) - 1) * 1000) / 10 : null;
  const growthVsYearPct = levelBased && L != null && Y != null && Y !== 0 ? Math.round(((L / Y) - 1) * 1000) / 10 : null;
  // trailing monotonic run of the values (for strict "every month" claims)
  const vals = data.map((d) => d.value);
  let run = null;
  for (let i = vals.length - 1; i > 0; i--) {
    const s = vals[i] > vals[i - 1] ? 1 : vals[i] < vals[i - 1] ? -1 : 0;
    if (s === 0) break;
    if (!run) run = { direction: s > 0 ? "up" : "down", length: 1 };
    else if ((s > 0) === (run.direction === "up")) run.length++;
    else break;
  }
  if (run) {
    const startIdx = vals.length - 1 - run.length;
    run.since = startIdx >= 0 ? periodLabel(data[startIdx].date) : periodLabel(data[0].date) + " (series start)";
  }
  const entry = {
    label: s.label,
    ruler: facts.ruler.base == null ? bundleSlug : `${facts.ruler.base}, ${bundleSlug}`,
    levelBased,
    latest: { value: L, period: periodLabel(data.at(-1).date) },
    previous: { value: P, period: periodLabel(data.at(-2).date) },
    yearAgo: Y == null ? null : { value: Y, period: periodLabel(data.at(-1 - lag).date) },
    deltaVsPrev: Math.round((L - P) * 100) / 100,
    deltaVsYear: Y == null ? null : Math.round((L - Y) * 100) / 100,
    ratioVsYearAgo: L > 0 && Y > 0 ? Math.round((L / Y) * 100) / 100 : null,
    growthVsPrevPct,
    growthVsYearPct,
    run,
    min: { value: min.value, period: periodLabel(min.date) },
    max: { value: max.value, period: periodLabel(max.date) },
    streaks: {
      negative: streak(data, (v) => v < 0),
      // policy-band streaks are computed only where a band exists in law —
      // the RBI 2–6% tolerance means nothing for a WDI or survey series
      ...(bands ? {
        belowFloor: streak(data, (v) => v < bands.floor),
        belowTarget: streak(data, (v) => v < bands.target),
        aboveCeiling: streak(data, (v) => v > bands.ceiling),
      } : {}),
    },
    last4: data.slice(-4).map((d) => d.value),
    yearStart: monthly
      ? (() => {
          const lastYear = Number(bundle.dates.at(-1).slice(0, 4));
          const i = bundle.dates.findIndex((d) => d.startsWith(String(lastYear)));
          return i >= 0 ? { value: bundle.series[k].data[i], period: periodLabel(bundle.dates[i]) } : null;
        })()
      : null,
    // base-effect warning: is the year-ago value an outlier vs its own neighbours?
    // Relative threshold (2σ of the window) — an absolute one flags every
    // level series (₹ MPCE, counts) whose raw deviations dwarf a rate's.
    baseEffect: (() => {
      const win = data.slice(-1 - lag - 3, -1 - lag + 4).map((d) => d.value);
      const avg = win.reduce((a, b) => a + b, 0) / win.length;
      const sd = Math.sqrt(win.reduce((a, b) => a + (b - avg) ** 2, 0) / win.length);
      const dev = Y - avg;
      return sd > 0 && Math.abs(dev) > 2 * sd
        ? `${s.label} year-ago (${Y} in ${periodLabel(data.at(-1 - lag).date)}) sits ${dev > 0 ? "above" : "below"} its neighbourhood; the current y/y is ${dev > 0 ? "flattered" : "depressed"} by the base`
        : null;
    })(),
  };
  facts.series[k] = entry;
}

// cross-series facts the corpus uses — computed for EVERY dossier from the
// shared census core (pipeline/lib/census-core.mjs), so the ranking the
// writer sees is the ranking the census audited. Dossier-specific extras
// (band position, gold, the retired base) layer on top.
const allSeries = Object.entries(bundle.series).map(([key, s]) => seriesFacts(bundle.dates, { key, ...s }));
const headKey = commonHeadline(Object.keys(bundle.series));
const xEntry = crossBundle(bundleSlug, allSeries, headKey, null, true);
const mover = (m) => m && { key: m.key, label: m.label, latest: m.latest, latestPeriod: m.latestPeriod, deltaVsYearAgo: m.deltaVsYearAgo };
// extremes read the PRIMARY series only — an "with imputation" disclosure
// variant is not a separate story, and naming the primary names the fact
const primary = allSeries.filter((s) => !/_imputed$/.test(s.key));
const byLatest = primary.filter((s) => s.latest != null).sort((a, b) => b.latest - a.latest);
const byDelta = primary.filter((s) => s.deltaVsYearAgo != null).sort((a, b) => b.deltaVsYearAgo - a.deltaVsYearAgo);
facts.cross = {
  headlineKey: headKey,
  countAboveHeadline: xEntry.countAboveHeadline ?? null,
  countBelowHeadline: xEntry.countBelowHeadline ?? null,
  countMovingWithHeadline: xEntry.countMovingWithHeadline,
  countMovingAgainstHeadline: xEntry.countMovingAgainstHeadline,
  topMover: mover(byDelta[0] ?? byLatest[0] ?? null),
  bottomMover: mover(byDelta.at(-1) ?? byLatest.at(-1) ?? null),
  topByLatest: mover(byLatest[0] ?? null),
  bottomByLatest: mover(byLatest.at(-1) ?? null),
  spreadLatest: byLatest.length > 1 ? Math.round((byLatest[0].latest - byLatest.at(-1).latest) * 100) / 100 : null,
  contradictions: xEntry.contradictions.map((k) => { const s = allSeries.find((f) => f.key === k); return { key: k, label: s.label, latest: s.latest, deltaVsYearAgo: s.deltaVsYearAgo }; }),
  ranking: xEntry.ranking,
};
if (bands) {
  const h = facts.series[headKey ?? Object.keys(facts.series)[0]];
  facts.cross.bandPosition =
    h.latest.value < bands.floor ? `${(bands.floor - h.latest.value).toFixed(2)} pt below the ${bands.floor}% floor`
    : h.latest.value < bands.target ? `${(bands.target - h.latest.value).toFixed(2)} pt below the ${bands.target}% target`
    : h.latest.value <= bands.ceiling ? `${(h.latest.value - bands.target).toFixed(2)} pt above the ${bands.target}% target`
    : `${(h.latest.value - bands.ceiling).toFixed(2)} pt above the ${bands.ceiling}% ceiling`;
}
if (slug === "cpi") {
  const gold = facts.series.personal_care_social_protection_and_miscellaneous_goods_and_services;
  facts.cross.goldDivision = gold ? gold.latest : null;
  facts.cross.goldNote = "Personal care is the division that carries gold; its price is set in world markets and is a spectator, not a domestic story.";
  // the retired 2012 base carries the only core index (the 2024 base serves no
  // weights, so core can't be computed on it) — expose its final reading so the
  // "what it does not say" slot can be honest about the ruler change.
  const old = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series/cpi.json"), "utf8"));
  facts.legacy = {
    retiredBase: old.meta.base,
    ruler: rulerOf("cpi"),
    oldHeadline: { value: old.series.headline.data.at(-1), period: periodLabel(old.dates.at(-1)) },
    core: { value: old.series.core.data.at(-1), period: periodLabel(old.dates.at(-1)) },
    note: "The 2024 base serves no component weights, so no core index can be computed on it; the core figure is the retired 2012 base's final reading.",
  };
}
// ---- external (lb/external): the account is published in US$ million; prose speaks in US$
// billion. The conversion is done here, in code, so the writer never does arithmetic: every
// dollar figure it may cite sits in cross.bn (one decimal), with the period it belongs to.
if (slug === "external") {
  const bn1 = (v) => (v == null ? null : Math.round(v / 100) / 10);
  const rd = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", f + ".json"), "utf8"));
  facts.cross.bn = {};
  for (const [k, s] of Object.entries(facts.series)) facts.cross.bn[k] = { latest: bn1(s.latest.value), previous: bn1(s.previous.value), yearAgo: s.yearAgo ? bn1(s.yearAgo.value) : null, period: s.latest.period };
  const g = rd("external-bop-gross");
  for (const k of ["goods_exports", "goods_imports", "services_exports", "remittances_in", "software_exports"]) facts.cross.bn[k] = { latest: bn1(g.series[k].data.at(-1)), period: facts.latestPeriod };
  const w = rd("external-reserves-weekly"), ws = w.series.total_usd.data;
  const iw = ws.length - 1 - [...ws].reverse().findIndex((v) => v != null);
  const peak = ws.reduce((a, v, i) => (v != null && v > ws[a] ? i : a), 0);
  facts.cross.reserves = { latest_bn: bn1(ws[iw]), week: w.dates[iw], weekBefore_bn: bn1(ws[iw - 1]), peak_bn: bn1(ws[peak]), peakWeek: w.dates[peak] };
  const ind = rd("external-bop-indicators");
  const lastI = (k) => { const d = ind.series[k].data; return Math.round(d.at(-1) * 100) / 100; };
  facts.cross.annual = { fiscalYear: `${ind.dates.at(-1).slice(0, 4)}-${String((+ind.dates.at(-1).slice(0, 4) + 1) % 100).padStart(2, "0")}`, ca_pct_gdp: lastI("cad_to_gdp"), import_cover_months: lastI("import_cover_of_reserves_in_months") };
  const re = rd("external-reer-2015"), ru = rd("external-rupee");
  facts.cross.rupee = { month: ru.dates.at(-1).slice(0, 7), inr_per_usd: Math.round(ru.series.usd.data.at(-1) * 100) / 100, inr_per_usd_year_ago: Math.round(ru.series.usd.data.at(-13) * 100) / 100,
    reer_month: re.dates.at(-1).slice(0, 7), reer: Math.round(re.series.reer_trade.data.at(-1) * 10) / 10, neer: Math.round(re.series.neer_trade.data.at(-1) * 10) / 10 };
  facts.cross.note = "Every dollar figure is in cross.bn, cross.reserves or the other cross blocks, already in US$ billion; cite them as written. The series values are US$ million and must not be cited directly.";
}
if (slug === "gdp") {
  const g = facts.series.gdp;
  facts.cross.vsTrend6 = Math.round((g.latest.value - 6) * 100) / 100;
  facts.cross.fastestSince = (() => {
    const data = bundle.series.gdp.data;
    const L = data.at(-1);
    for (let i = data.length - 2; i >= 0; i--) if (data[i] > L) return { value: data[i], period: periodLabel(bundle.dates[i]) };
    return null;
  })();
}

// the writer's window on the SIBLING bundles (registry `proseInputs`): the
// deep cuts — groups, items, states, sectors — summarized as field facts
// (rankings, extremes, contradictions), never 358 raw rows. Every number
// here is prose-citable and verify-traceable like the rest of the sheet.
if (D.proseInputs?.length) {
  const hDir = headKey != null && allSeries.find((s) => s.key === headKey)?.deltaVsYearAgo != null
    ? Math.sign(allSeries.find((s) => s.key === headKey).deltaVsYearAgo) : null;
  // never mix rulers in one sheet: a sibling bundle of the SAME product on a
  // different registered base (sources.yml seams) would put an old base's
  // figures beside the current print (GDP, 2026-10: Q2 FY26 2011-12-base
  // industries quoted beside Q1 FY27 on 2022-23). Different products sharing a
  // guide (ASI with ASUSE) are not a seam and pass.
  {
    const seams = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8")).seams ?? {};
    for (const slug2 of D.proseInputs) {
      const m2 = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug2 + ".json"), "utf8")).meta;
      if (m2.dossier === bundle.meta.dossier && seams[m2.dossier] && m2.base !== bundle.meta.base) {
        console.error(`facts: proseInput ${slug2} is on base "${m2.base}" but ${bundleSlug} is on "${bundle.meta.base}": point proseInputs at the current base's bundles`);
        process.exit(1);
      }
    }
  }
  facts.proseInputs = D.proseInputs.map((slug2) => {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug2 + ".json"), "utf8"));
    const list = Object.entries(b.series).map(([key, s]) => seriesFacts(b.dates, { key, ...s }));
    const e = crossBundle(slug2, list, commonHeadline(Object.keys(b.series)), hDir);
    const bl = list.filter((s) => s.latest != null).sort((a, c) => c.latest - a.latest);
    const out2 = {
      bundle: slug2,
      seriesCount: list.length,
      base: b.meta.base,
      ruler: rulerOf(slug2),
      coverage: b.meta.coverage ?? null,
      top: mover(e.topByDelta ?? bl[0] ?? null),
      bottom: mover(e.bottomByDelta ?? bl.at(-1) ?? null),
      topByLatest: mover(bl[0] ?? null),
      bottomByLatest: mover(bl.at(-1) ?? null),
      spread: e.spreadDelta,
      countAboveHeadline: e.countAboveHeadline ?? null,
      contradictions: e.contradictions,
      ranking: e.ranking.slice(0, 10),
    };
    // deep-tail bundles (items, all states): the summarize bucket — counts
    // and median, so the writer can narrate the field without 358 rows
    if (list.length > 30) {
      const latestVals = bl.map((s) => s.latest);
      const prevs = list.map((s) => s.deltaVsPrev).filter((v) => v != null);
      out2.tail = {
        median: Math.round(latestVals.sort((a, c) => a - c)[Math.floor(latestVals.length / 2)] * 100) / 100,
        rising: prevs.filter((v) => v > 0).length,
        falling: prevs.filter((v) => v < 0).length,
        belowZero: latestVals.filter((v) => v < 0).length,
      };
      out2.ranking = e.ranking.slice(0, 15);
    }
    return out2;
  });
}

fs.mkdirSync(path.join(ROOT, "pipeline/out"), { recursive: true });
const out = path.join(ROOT, "pipeline/out", `facts-${slug}.json`);
fs.writeFileSync(out, JSON.stringify(facts, null, 1) + "\n");
console.log("wrote", path.relative(ROOT, out));
console.log(JSON.stringify({ latest: facts.latestPeriod, headline: facts.series[Object.keys(facts.series)[0]].latest, cross: facts.cross }, null, 1));
