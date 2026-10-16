// Learn № 02 · Base effects: the autumn-2024 food spike as level and as base, drawn at build time
// with the chart kit (src/kit/), and every number the page shows (NUM, HTML text by element id).
// Levels: data/raw/cpi-indices.json (published food group index, 2012=100).
// Rate:   data/series/cpi.json (baked y/y bundle, quoted at two decimals as the page always has).
import * as K from "../kit/kit.js";
import { figure, WIDTHS } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

const F = levels.levels["combined:food_and_beverages"];
const ym = (d) => d.slice(0, 7);
const fk = Object.keys(F).filter((k) => k >= "2023-01" && k <= "2025-12").sort();
const flvl = fk.map((k) => [k + "-01", F[k]]);
const fyoy = pairs(bundle, "food", { round: false, from: flvl[0][0], to: flvl.at(-1)[0] });
const at = (P, key) => P.find(([d]) => ym(d) === key);
const lvlThen = at(flvl, "2024-12"), lvlNow = flvl.at(-1), lvl23 = at(flvl, "2023-12");
const pk = flvl.reduce((a, d) => (d[1] > a[1] ? d : a));
const yThen = at(fyoy, "2024-12"), yNow = fyoy.at(-1);
const ratio = lvlNow[1] / lvlThen[1];
const pc = '<span class="pc">%</span>';
const p2 = (v) => v.toFixed(2) + "%";

export const NUM = {
  "pv-be": p2(yNow[1]),
  "pf-be": bundle.meta.vintage,
  "ex-jul24": at(flvl, "2024-07")[1].toFixed(1),
  "ex-peak": pk[1].toFixed(1),
  "ex-print": p2(yNow[1]),
  "ex-y24": p2(yThen[1]),
  "n-then": lvlThen[1].toFixed(1),
  "n-now": lvlNow[1].toFixed(1),
  "n-rate": (ratio * 100 - 100).toFixed(1) + pc,
  "n-rupee": "₹" + Math.round(1000 * ratio).toLocaleString("en-IN"),
  "ar-now": lvlNow[1].toFixed(1),
  "ar-then": lvlThen[1].toFixed(1),
  "ar-ratio3": ratio.toFixed(3),
  "ar-print": p2(yNow[1]),
  "ar-23": lvl23[1].toFixed(1),
  "ar-alt": "+" + (lvlNow[1] / lvl23[1] * 100 - 100).toFixed(1) + "%",
  "mr-y24": p2(yThen[1]),
  "mr-y25": p2(yNow[1]),
  "mr-lvl": Math.abs((lvlNow[1] / pk[1] - 1) * 100).toFixed(1) + " per cent",
  "mr-a1": p2(yNow[1]),
  "mr-a2": "+" + (lvlNow[1] / lvl23[1] * 100 - 100).toFixed(1) + "%",
};

// The two panels share one time axis: the same gutter and right margin at each width.
// The spike window (Jul to Dec 2024) is shaded in both: above it is the spike, below it is the
// base the late-2025 prints are divided by. The lead colour marks the spike above and those prints below.
const GUTTER = 44;
const RIGHT = { [WIDTHS.wide]: 120, [WIDTHS.mid]: 104, [WIDTHS.phone]: 60 };
const SPIKE = { from: "2024-07-01", to: "2024-12-01" };
const within = (P, a, b) => P.filter(([d]) => d >= a && d <= b);

/** Top panel: the food level, the autumn-2024 spike in the lead colour. */
export function level() {
  return figure({
    bare: true, file: "india-atlas_learn_base-effects_food_2023-2025",
    label: `Food price level, index 2012=100, ${monthShort(flvl[0][0])} to ${monthShort(lvlNow[0])}: it rises from ${flvl[0][1].toFixed(1)} to a peak of ${pk[1].toFixed(1)} in ${monthShort(pk[0])}, then falls to ${lvlNow[1].toFixed(1)}; the autumn-2024 spike window is shaded as the base`,
    data: { cols: ["Month", "Food price level, 2012=100", "Food inflation, y/y %"], rows: flvl.map(([d, v]) => [ym(d), v, at(fyoy, ym(d))?.[1] ?? null]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 220 : 280, gutter: GUTTER, right: RIGHT[width], freq: "month", zero: false, dp: 0, endDp: 1, inside: false,
      unit: { suffix: "" }, yDomain: [170, 220],
      shade: [{ ...SPIKE, label: width < 520 ? "" : "The base" }],
      series: [
        { name: "Food price level", data: flvl, role: "ctx" },
        { name: "The spike", data: within(flvl, SPIKE.from, SPIKE.to), role: "lead", label: false, hover: false },
      ],
      notes: [{ d: pk[0], v: pk[1], text: `Peak, ${monthShort(pk[0])}\n${pk[1].toFixed(1)}`, side: "right" }],
    }),
  });
}

/** Bottom panel: food inflation, the late-2025 prints (divided by the spike) in the lead colour. */
export function rateChart() {
  return figure({
    bare: true, file: "india-atlas_learn_base-effects_food-yoy_2023-2025",
    label: `Food inflation, year-on-year, ${monthShort(fyoy[0][0])} to ${monthShort(yNow[0])}: ${p2(yThen[1])} in ${monthShort(yThen[0])}, then falling through 2025 to ${K.num(yNow[1], { dp: 2 })}% in ${monthShort(yNow[0])}; the autumn-2024 base window is shaded`,
    draw: (width) => K.line({
      width, height: width < 520 ? 240 : 300, gutter: GUTTER, right: RIGHT[width], freq: "month", endDp: 2, hoverDp: 2, inside: false,
      unit: { suffix: "%" }, yDomain: [-4, 12], yCount: 8,
      shade: [{ ...SPIKE }],
      series: [
        { name: "Food inflation, y/y", data: fyoy, role: "ctx", label: false },
        { name: "Late 2025", data: within(fyoy, "2025-07-01", yNow[0]), role: "lead", hover: false },
      ],
      notes: [{ d: yThen[0], v: yThen[1], text: `${monthShort(yThen[0])}\n${p2(yThen[1])}`, side: "left" }],
    }),
  });
}
