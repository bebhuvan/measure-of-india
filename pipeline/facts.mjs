#!/usr/bin/env node
// pipeline/facts.mjs — compute the facts sheet for a dossier from its baked
// series JSON. The generator may write ONLY from this sheet.
// Usage: node pipeline/facts.mjs <slug>   → pipeline/out/facts-<slug>.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const slug = process.argv[2];
if (!slug) { console.error("usage: node pipeline/facts.mjs <slug>"); process.exit(1); }

const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));
const monthly = bundle.meta.frequency === "monthly";
const lag = monthly ? 12 : 4;
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function periodLabel(iso) {
  const [y, m] = iso.split("-").map(Number);
  if (monthly) return `${MN[m - 1]} ${y}`;
  const q = m === 4 ? 1 : m === 7 ? 2 : m === 10 ? 3 : 4;
  return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
}

function streak(data, pred) {
  let n = 0;
  for (let i = data.length - 1; i >= 0 && pred(data[i].value); i--) n++;
  return n;
}

const facts = {
  dossier: slug,
  vintage: bundle.meta.vintage,
  latestPeriod: periodLabel(bundle.dates.at(-1)),
  releaseDate: bundle.meta.releaseDate,
  series: {},
};

for (const [k, s] of Object.entries(bundle.series)) {
  const data = s.data.map((v, i) => ({ date: bundle.dates[i], value: v }));
  const L = data.at(-1).value, P = data.at(-2).value, Y = data.at(-1 - lag).value;
  const min = data.reduce((a, d) => (d.value < a.value ? d : a));
  const max = data.reduce((a, d) => (d.value > a.value ? d : a));
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
    latest: { value: L, period: periodLabel(data.at(-1).date) },
    previous: { value: P, period: periodLabel(data.at(-2).date) },
    yearAgo: { value: Y, period: periodLabel(data.at(-1 - lag).date) },
    deltaVsPrev: Math.round((L - P) * 100) / 100,
    deltaVsYear: Math.round((L - Y) * 100) / 100,
    ratioVsYearAgo: L > 0 && Y > 0 ? Math.round((L / Y) * 100) / 100 : null,
    run,
    min: { value: min.value, period: periodLabel(min.date) },
    max: { value: max.value, period: periodLabel(max.date) },
    streaks: {
      negative: streak(data, (v) => v < 0),
      below2: streak(data, (v) => v < 2),
      below4: streak(data, (v) => v < 4),
      above6: streak(data, (v) => v > 6),
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
    baseEffect: (() => {
      const win = data.slice(-1 - lag - 3, -1 - lag + 4).map((d) => d.value);
      const avg = win.reduce((a, b) => a + b, 0) / win.length;
      const dev = Y - avg;
      return Math.abs(dev) > 1.5
        ? `${s.label} year-ago (${Y} in ${periodLabel(data.at(-1 - lag).date)}) sits ${dev > 0 ? "above" : "below"} its neighbourhood; the current y/y is ${dev > 0 ? "flattered" : "depressed"} by the base`
        : null;
    })(),
  };
  facts.series[k] = entry;
}

// cross-series facts the corpus uses
if (slug === "cpi") {
  const h = facts.series.headline, c = facts.series.core, f = facts.series.food;
  facts.cross = {
    coreMinusHeadline: Math.round((c.latest.value - h.latest.value) * 100) / 100,
    coreAboveHeadline: c.latest.value > h.latest.value,
    foodDeflationMonthsOfLast7: bundle.series.food.data.slice(-7).filter((v) => v < 0).length,
    bandPosition:
      h.latest.value < 2 ? `${(2 - h.latest.value).toFixed(2)} pt below the 2% floor`
      : h.latest.value < 4 ? `${(4 - h.latest.value).toFixed(2)} pt below the 4% target`
      : h.latest.value <= 6 ? `${(h.latest.value - 4).toFixed(2)} pt above the 4% target`
      : `${(h.latest.value - 6).toFixed(2)} pt above the 6% ceiling`,
    monthsBelow2EverBeforeLatestYear: bundle.series.headline.data.slice(0, -12).filter((v) => v < 2).length,
  };
}
if (slug === "gdp") {
  const g = facts.series.gdp;
  facts.cross = {
    vsTrend6: Math.round((g.latest.value - 6) * 100) / 100,
    fastestSince: (() => {
      const data = bundle.series.gdp.data;
      const L = data.at(-1);
      for (let i = data.length - 2; i >= 0; i--) if (data[i] > L) return { value: data[i], period: periodLabel(bundle.dates[i]) };
      return null;
    })(),
  };
}

fs.mkdirSync(path.join(ROOT, "pipeline/out"), { recursive: true });
const out = path.join(ROOT, "pipeline/out", `facts-${slug}.json`);
fs.writeFileSync(out, JSON.stringify(facts, null, 1) + "\n");
console.log("wrote", path.relative(ROOT, out));
console.log(JSON.stringify({ latest: facts.latestPeriod, headline: facts.series[Object.keys(facts.series)[0]].latest, cross: facts.cross }, null, 1));
