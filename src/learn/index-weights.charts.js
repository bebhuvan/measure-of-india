// Learn № 03 · Index weights: the plate, drawn at build time with the chart kit (src/kit/), the
// basket strip, and every number the page shows (NUM, text by element id, the old client's arithmetic).
// Weights: structural constants (CES 2011–12, frozen into the CPI on 2012=100).
// Prints: data/series/cpi.json (two decimals, as the page always quoted) + data/raw/cpi-indices.json (group levels).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

const L = levels.levels;
const KEY = { food: "combined:food_and_beverages", pan: "combined:pan_tobacco_and_intoxicants", clothing: "combined:clothing_and_footwear",
  housing: "combined:housing", fuel: "combined:fuel_and_light", misc: "combined:miscellaneous" };

/* structural constants: the six groups and their weights, in basket order; food leads, the rest in greys */
const groups = [
  ["Food & beverages", 45.86, "food", K.C.lead],
  ["Pan, tobacco & intoxicants", 2.38, "pan", "#4A5160"],
  ["Clothing & footwear", 6.53, "clothing", K.C.muted],
  ["Housing", 10.07, "housing", K.C.ctx],
  ["Fuel & light", 6.84, "fuel", K.C.ctx2],
  ["Miscellaneous, services", 28.32, "misc", "#DADDE3"],
];

/* the basket strip of §02, HTML set at build time */
export const BASKET_BAR = groups.map(([n, w, , c]) => `<div class="seg" style="width:${w}%;background:${c}" title="${n}: ${w}%"></div>`).join("");
export const BASKET_LABELS = groups.map(([n, w, , c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n.replace(/&/g, "&amp;")}</div><div class="w">${w.toFixed(2)}%</div></div>`).join("");

/* worked example: a food-heavy family */
const yoyLvl = (g, key) => { const prev = `${+key.slice(0, 4) - 1}-${key.slice(5, 7)}`; return (L[KEY[g]][key] / L[KEY[g]][prev] - 1) * 100; };
const nonFood = groups.filter(([, , k]) => k !== "food");
const nfWeight = nonFood.reduce((a, [, w]) => a + w, 0);
const nonFoodYoy = (key) => nonFood.reduce((a, [, w, k]) => a + w * yoyLvl(k, key), 0) / nfWeight;
const familyYoy = (key) => 0.6 * yoyLvl("food", key) + 0.4 * nonFoodYoy(key);

const RAW = { round: false };
const H = pairs(bundle, "headline", RAW), F = pairs(bundle, "food", RAW);
const hDec25 = H.at(-1)[1], hDec24 = H.at(-13)[1], fDec25 = F.at(-1)[1];
const nf25 = nonFoodYoy("2025-12"), fam25 = familyYoy("2025-12"), fam24 = familyYoy("2024-12");
// the 2019 peaks (the old peakBetween over the calendar year)
const peak19 = (P) => P.filter(([d, v]) => v != null && d.startsWith("2019")).reduce((m, p) => (!m || p[1] > m[1] ? p : m), null);
const pc = '<span class="pc">%</span>';

export const NUM = {
  "n-wx-head": hDec25.toFixed(2) + pc,
  "n-wx-food": fDec25.toFixed(2) + pc,
  "n-wx-nonfood": "+" + nf25.toFixed(1) + pc,
  "n-wx-fam": "+" + fam25.toFixed(1) + pc,
  "wx-fam25": fam25.toFixed(1) + " per cent",
  "wx-h25": hDec25.toFixed(2) + "%",
  "wx-gap25": Math.abs(hDec25 - fam25).toFixed(1) + " of a point",
  "wx-fam24": fam24.toFixed(1) + " per cent",
  "wx-h24": hDec24.toFixed(2) + "%",
  "mr2-fam": "+" + fam25.toFixed(1) + " per cent",
  "mr2-head": hDec25.toFixed(2) + "%",
  "ex-f19": peak19(F)[1].toFixed(2) + "%",
  "ex-h19": peak19(H)[1].toFixed(2) + "%",
  "pv-wt": groups[0][1].toFixed(2) + "%",
  "basket-bar": BASKET_BAR,
  "basket-labels": BASKET_LABELS,
};

/** The six weights ranked, food in the lead colour against a rule at half the index. */
export function weights() {
  const rows = groups.map(([name, value, k]) => ({ name, value, highlight: k === "food" }));
  return figure({
    bare: true, file: "india-atlas_learn_index-weights_ces-2011-12",
    label: "CPI group weights, per cent, Consumer Expenditure Survey 2011-12: food and beverages carry 45.86 of 100 points, miscellaneous services 28.32, housing 10.07, fuel and light 6.84, clothing and footwear 6.53, and pan, tobacco and intoxicants 2.38",
    data: { cols: ["Group", "Weight, per cent"], rows: groups.map(([n, w]) => [n, w]) },
    draw: (width) => K.bars({ width, rows, dp: 2, unit: { suffix: "%" }, ref: { value: 50, label: "Half the index", dash: "1 3" }, refFill: false }),
  });
}
