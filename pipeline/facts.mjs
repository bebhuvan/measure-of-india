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

// --- trade (lb/trade): the month's figures in the units the prose uses (US$ billion, one
// decimal; growth in per cent), the drivers by chapter, the first estimate for the next month,
// and the partners. Every figure is computed here from the baked bundles.
if (slug === "trade") {
  const { chapterName } = await import("../src/dossiers/trade-chapters.js");
  const B = (s) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", s + ".json"), "utf8"));
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
  const bn = (v) => r1(v / 1000);
  const g = (a, b) => (a == null || b == null || b === 0 ? null : r1((a / b - 1) * 100));
  const S = bundle.series, n = bundle.dates.length - 1;
  const X = S.exports.data, M = S.imports.data, BL = S.balance.data;
  const T = {
    month: periodLabel(bundle.dates[n]), yearAgoMonth: periodLabel(bundle.dates[n - 12]),
    print: bundle.meta.revision?.[bundle.dates[n]] === "F" ? "final (the month's own detailed table)" : "revised",
    exportsBn: bn(X[n]), importsBn: bn(M[n]), balanceBn: bn(BL[n]), deficitBn: bn(-BL[n]),
    exportsYearAgoBn: bn(X[n - 12]), importsYearAgoBn: bn(M[n - 12]), balanceYearAgoBn: bn(BL[n - 12]), deficitYearAgoBn: bn(-BL[n - 12]),
    exportsYoYPct: g(X[n], X[n - 12]), importsYoYPct: g(M[n], M[n - 12]),
    exportsPrevMonthBn: bn(X[n - 1]), importsPrevMonthBn: bn(M[n - 1]), deficitPrevMonthBn: bn(-BL[n - 1]),
  };
  // the largest monthly deficit on record in this series
  let kmin = 0; BL.forEach((v, k) => { if (v != null && v < BL[kmin]) kmin = k; });
  T.largestDeficit = { bn: bn(-BL[kmin]), period: periodLabel(bundle.dates[kmin]) };
  // the year so far
  const YX = B("trade-hs2-exports-ytd"), YM = B("trade-hs2-imports-ytd");
  T.yearToDate = { months: YX.meta.period?.label, exportsBn: bn(YX.series.total.data[1]), exportsPrevBn: bn(YX.series.total.data[0]), exportsGrowthPct: g(YX.series.total.data[1], YX.series.total.data[0]),
    importsBn: bn(YM.series.total.data[1]), importsPrevBn: bn(YM.series.total.data[0]), importsGrowthPct: g(YM.series.total.data[1], YM.series.total.data[0]) };
  // drivers: chapters whose value moved most against the same month a year earlier (US$ billion)
  const movers = (slug2) => {
    const b = B(slug2), i = b.dates.indexOf(bundle.dates[n]), j = b.dates.indexOf(bundle.dates[n - 12]);
    const rows = Object.entries(b.series).filter(([k]) => k !== "total").map(([k, s]) => ({ chapter: `${chapterName(k.slice(1), s.label)} (HS ${k.slice(1)})`, now: s.data[i], ago: s.data[j] }))
      .filter((r) => r.now != null && r.ago != null)
      .map((r) => ({ chapter: r.chapter, nowBn: bn(r.now), yearAgoBn: bn(r.ago), changeBn: bn(r.now - r.ago), changeMn: Math.round(r.now - r.ago), nowMn: Math.round(r.now), growthPct: g(r.now, r.ago), _d: r.now - r.ago }));
    rows.sort((a, b2) => b2._d - a._d);   // exact changes: rounding to 0.1 bn would tie the small falls
    for (const r of rows) delete r._d;
    return { largestRises: rows.slice(0, 3), largestFalls: rows.slice(-3).reverse() };
  };
  T.exportDrivers = movers("trade-hs2-exports");
  T.importDrivers = movers("trade-hs2-imports");
  // the first estimate for the next month (principal-commodity quick estimates, provisional)
  const QX = B("trade-principal-exports"), QM = B("trade-principal-imports"), q = QX.dates.length - 1;
  if (QX.dates[q] > bundle.dates[n]) T.quickEstimate = { month: periodLabel(QX.dates[q]), print: "provisional quick estimate",
    exportsBn: bn(QX.series.total.data[q]), importsBn: bn(QM.series.total.data[q]), balanceBn: bn(QX.series.total.data[q] - QM.series.total.data[q]),
    exportsYearAgoBn: bn(QX.series.total.data[q - 12]), exportsYoYPct: g(QX.series.total.data[q], QX.series.total.data[q - 12]), importsYoYPct: g(QM.series.total.data[q], QM.series.total.data[q - 12]) };
  // partners this month: the largest deficits and surpluses (US$ billion)
  const P = B("trade-partners-balance"), pi = P.dates.indexOf(bundle.dates[n]);
  const prow = Object.entries(P.series).map(([k, s]) => ({ partner: s.label.replace(/: exports minus imports \(derived\)$/, ""), balanceBn: bn(s.data[pi]), raw: s.data[pi] })).filter((r) => r.raw != null && !/unspecified/i.test(r.partner)).sort((a, b2) => a.raw - b2.raw);
  T.partners = { largestDeficits: prow.slice(0, 3), largestSurpluses: prow.slice(-3).reverse(),
    countInDeficit: prow.filter((r) => r.raw < 0).length, countInSurplus: prow.filter((r) => r.raw > 0).length, countListed: prow.length,
    note: "countInDeficit and countInSurplus count partners by the sign of this month's balance (any size); partners with no trade either way are in neither." };
  for (const r of prow) delete r.raw;
  // how broad the month was: chapters above and below the same month a year earlier
  const breadth = (slug2) => { const b = B(slug2), i = b.dates.indexOf(bundle.dates[n]), j = b.dates.indexOf(bundle.dates[n - 12]);
    const ch = Object.entries(b.series).filter(([k]) => k !== "total").map(([, s]) => [s.data[i], s.data[j]]).filter(([a, c]) => a != null && c != null);
    return { chaptersCompared: ch.length, chaptersHigher: ch.filter(([a, c]) => a > c).length, chaptersLower: ch.filter(([a, c]) => a < c).length }; };
  T.exportBreadth = breadth("trade-hs2-exports");
  T.importBreadth = breadth("trade-hs2-imports");
  // oil and gold this month: HS 27 (mineral fuels) and HS 7108 (gold) imports
  const H2 = B("trade-hs2-imports"), H4 = B("trade-hs4-imports"), i2 = H2.dates.indexOf(bundle.dates[n]), i4 = H4.dates.indexOf(bundle.dates[n]);
  T.fuelImports = { bn: bn(H2.series.c27.data[i2]), yearAgoBn: bn(H2.series.c27.data[i2 - 12]), growthPct: g(H2.series.c27.data[i2], H2.series.c27.data[i2 - 12]), shareOfImportsPct: r1(100 * H2.series.c27.data[i2] / M[n]) };
  T.goldImports = { bn: bn(H4.series.c7108.data[i4]), yearAgoBn: bn(H4.series.c7108.data[i4 - 12]), growthPct: g(H4.series.c7108.data[i4], H4.series.c7108.data[i4 - 12]) };
  facts.cross.trade = T;
}
// --- end trade ---

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
