// Learn № 01 · Inflation: the plates, drawn at build time with the chart kit (src/kit/), and
// every number the page shows (NUM, HTML text by element id, the arithmetic the old client used).
// Levels: data/raw/cpi-indices.json (published group indices, 2012=100).
// Rate:   data/series/cpi.json (baked y/y bundle, shown at two decimals as the page always has).
import * as K from "../kit/kit.js";
import { figure, WIDTHS } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

const RAW = { round: false }; // the page quotes this bundle at two decimals (qc checks lr-rdec, lr-rjan)
const rate = pairs(bundle, "headline", RAW);
const dates = rate.map(([d]) => d);
const ym = (d) => d.slice(0, 7);
// the published level, on the bundle's months
const levelOf = (key) => dates.map((d) => [d, levels.levels[key][ym(d)] ?? null]).filter(([, v]) => v != null);
const lvl = levelOf("combined:general");
const lvlNow = lvl.at(-1)[1], lvlThen = lvl.at(-13)[1], ratio = lvlNow / lvlThen;
const jan25 = rate.at(-12)[1], dec25 = rate.at(-1)[1];
const pc = '<span class="pc">%</span>';

// the food level, Jan 2023 to Dec 2025, its peak and where it ended
const foodKeys = Object.keys(levels.levels["combined:food_and_beverages"]).filter((k) => k >= "2023-01" && k <= "2025-12").sort();
const food = foodKeys.map((k) => [k + "-01", levels.levels["combined:food_and_beverages"][k]]);
const pk = food.reduce((a, d) => (d[1] > a[1] ? d : a));
const fnow = food.at(-1);
const dropPct = (fnow[1] / pk[1] - 1) * 100;

const rupee = "₹" + Math.round(1000 * ratio).toLocaleString("en-IN");
export const NUM = {
  "pv-lr": lvlNow.toFixed(1),
  "pf-lr": bundle.meta.vintage,
  "lr-rjan": jan25.toFixed(2) + "%",
  "lr-rdec": dec25.toFixed(2) + "%",
  "lr-ldec": lvlNow.toFixed(1),
  "n-lvl-then": lvlThen.toFixed(1),
  "n-lvl-now": lvlNow.toFixed(1),
  "n-rate-now": "+" + (ratio * 100 - 100).toFixed(1) + pc,
  "n-rupee": rupee,
  "ar-ratio": lvlNow.toFixed(1),
  "ar-then": lvlThen.toFixed(1),
  "ar-rupee": rupee,
  "ar-decade": Math.round((lvlNow / lvl[0][1] - 1) * 100) + " per cent",
  "pv-foodlvl": fnow[1].toFixed(1),
  "pf-foodlvl": "peak: " + pk[1].toFixed(1) + ", " + monthShort(pk[0]) + ", latest: " + fnow[1].toFixed(1),
  "fl-peak": pk[1].toFixed(1),
  "fl-now": fnow[1].toFixed(1),
  "fl-drop": Math.abs(dropPct).toFixed(1) + " per cent",
};

// The two panels of §02 share one time axis: the same gutter and right margin at each width.
const GUTTER = 44;
const RIGHT = { [WIDTHS.wide]: 120, [WIDTHS.mid]: 104, [WIDTHS.phone]: 56 };
const lastYear = (P) => P.slice(-13); // Dec 2024 to Dec 2025
const tLast = lvl.at(-13)[0];

/** §02 top: the price level, rising to its highest reading in the last month. */
export function level() {
  return figure({
    bare: true, file: "india-atlas_learn_inflation_level-vs-rate_2016-2025",
    label: `CPI price level, index 2012=100, ${monthShort(lvl[0][0])} to ${monthShort(lvl.at(-1)[0])}: it rises from ${lvl[0][1].toFixed(1)} to ${lvlNow.toFixed(1)}, ending at its highest point; ${monthShort(tLast)}, ${lvlThen.toFixed(1)}, is marked`,
    data: { cols: ["Month", "Price level, 2012=100", "Inflation, y/y %"], rows: dates.map((d, i) => [ym(d), levels.levels["combined:general"][ym(d)] ?? null, rate[i][1]]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 220 : 280, gutter: GUTTER, right: RIGHT[width], freq: "month", zero: false, dp: 0, endDp: 1, inside: false,
      unit: { suffix: "" }, endSub: width < 520 ? null : "the highest yet",
      series: [
        { name: "Price level", data: lvl, role: "ctx", label: false },
        { name: "2025", data: lastYear(lvl), role: "lead", hover: false },
      ],
      notes: [{ d: tLast, v: lvlThen, text: `${monthShort(tLast)}\n${lvlThen.toFixed(1)}`, side: "left" }],
    }),
  });
}

/** §02 bottom: the same decade as a year-on-year rate, the last year in the lead colour. */
export function rateChart() {
  return figure({
    bare: true, file: "india-atlas_learn_inflation_rate_2016-2025",
    label: `CPI inflation, year-on-year, ${monthShort(dates[0])} to ${monthShort(dates.at(-1))}: the rate ends at ${dec25.toFixed(2)}% in ${monthShort(dates.at(-1))}, down from ${rate.at(-13)[1].toFixed(2)}% a year earlier; the RBI tolerance band of 2 to 6% shaded`,
    draw: (width) => K.line({
      width, height: width < 520 ? 240 : 300, gutter: GUTTER, right: RIGHT[width], freq: "month", endDp: 2, hoverDp: 2, inside: false,
      unit: { suffix: "%" }, yDomain: [0, 8],
      series: [
        { name: "Inflation, y/y", data: rate, role: "ctx", label: false },
        { name: "2025", data: lastYear(rate), role: "lead", hover: false },
      ],
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
      refs: [{ y: 4, label: "Target 4%" }],
      notes: [{ d: rate.at(-13)[0], v: rate.at(-13)[1], text: `${monthShort(rate.at(-13)[0])}\n${rate.at(-13)[1].toFixed(2)}%`, side: "left" }],
    }),
  });
}

/** §04: the food level turning down after its peak: deflation drawn as a level. */
export function foodLevel() {
  const after = food.filter(([d]) => d >= pk[0]);
  return figure({
    bare: true, file: "india-atlas_learn_inflation_food-level_2023-2025",
    label: `Food price level, index 2012=100, ${monthShort(food[0][0])} to ${monthShort(fnow[0])}: the food index peaks at ${pk[1].toFixed(1)} in ${monthShort(pk[0])}, then falls to ${fnow[1].toFixed(1)}, an actual decline in the price level`,
    data: { cols: ["Month", "Food price level, 2012=100"], rows: food.map(([d, v]) => [ym(d), v]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 240 : 340, freq: "month", zero: false, dp: 0, endDp: 1, inside: false, yDomain: [Math.floor(food[0][1] / 10) * 10, Math.ceil(pk[1] / 10) * 10 + 10],
      unit: { suffix: "" }, endSub: `${K.num(dropPct, { dp: 1 })}% from peak`,
      series: [
        { name: "Food price level", data: food.filter(([d]) => d <= pk[0]), role: "ctx", label: false },
        { name: "Food price level", data: after, role: "lead", hover: false },
      ],
      notes: [{ d: pk[0], v: pk[1], text: `Peak, ${monthShort(pk[0])}\n${pk[1].toFixed(1)}`, side: "left" }],
    }),
  });
}
