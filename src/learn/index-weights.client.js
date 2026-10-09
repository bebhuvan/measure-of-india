// Learn № 03 · Index weights — the basket as a budget, and a worked family.
// Weights: structural constants (CES 2011–12, frozen into the CPI on 2012=100).
// Prints: data/series/cpi.json + data/raw/cpi-indices.json (group levels).

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json";

// the raw store keys levels by sector since the full-grid ingest; these pages
// read the combined sector only, mapped back to the legacy flat keys
const levelsFlat = {
  published_headline: levels.levels["combined:general"],
  food: levels.levels["combined:food_and_beverages"],
  pan: levels.levels["combined:pan_tobacco_and_intoxicants"],
  clothing: levels.levels["combined:clothing_and_footwear"],
  housing: levels.levels["combined:housing"],
  fuel: levels.levels["combined:fuel_and_light"],
  misc: levels.levels["combined:miscellaneous"],
};
import { MONO as mono, hydrate, wireTools, a11y, peakBetween } from "../charts/plumbing.js";

const S = hydrate(bundle);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

/* structural constants: the six groups and their weights, in basket order */
const groups = [
  ["Food & beverages", 45.86, "#2E4BD8"],
  ["Pan, tobacco & intoxicants", 2.38, "#4A5160"],
  ["Clothing & footwear", 6.53, "#878D99"],
  ["Housing", 10.07, "#A3A9B4"],
  ["Fuel & light", 6.84, "#C9CED6"],
  ["Miscellaneous, services", 28.32, "#DADDE3"],
];
const KEYS = { "Food & beverages": "food", "Pan, tobacco & intoxicants": "pan",
  "Clothing & footwear": "clothing", "Housing": "housing", "Fuel & light": "fuel",
  "Miscellaneous, services": "misc" };

/* ---------- basket composition ---------- */
document.getElementById("basket-bar").innerHTML = groups.map(([n, w, c]) =>
  `<div class="seg" style="width:${w}%;background:${c}" title="${n}: ${w}%"></div>`).join("");
document.getElementById("basket-labels").innerHTML = groups.map(([n, w, c]) =>
  `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${w.toFixed(2)}%</div></div>`).join("");

/* ---------- worked example: a food-heavy family ---------- */
const yoyLvl = (g, key) => {
  const prevYear = `${+key.slice(0, 4) - 1}-${key.slice(5, 7)}`;
  return (levelsFlat[g][key] / levelsFlat[g][prevYear] - 1) * 100;
};
const nonFood = groups.filter(([n]) => n !== "Food & beverages");
const nfWeight = nonFood.reduce((a, [, w]) => a + w, 0);
const nonFoodYoy = (key) => nonFood.reduce((a, [n, w]) => a + w * yoyLvl(KEYS[n], key), 0) / nfWeight;
const familyYoy = (key) => 0.6 * yoyLvl("food", key) + 0.4 * nonFoodYoy(key);

const hDec25 = S.headline.data.at(-1).value;
const hDec24 = S.headline.data.at(-13).value;
const fDec25 = S.food.data.at(-1).value;
const nf25 = nonFoodYoy("2025-12");
const fam25 = familyYoy("2025-12");
const fam24 = familyYoy("2024-12");

setHTML("n-wx-head", hDec25.toFixed(2) + pc);
setHTML("n-wx-food", fDec25.toFixed(2) + pc);
setHTML("n-wx-nonfood", "+" + nf25.toFixed(1) + pc);
setHTML("n-wx-fam", "+" + fam25.toFixed(1) + pc);
setTxt("wx-fam25", fam25.toFixed(1) + " per cent");
setTxt("wx-h25", hDec25.toFixed(2) + "%");
setTxt("wx-gap25", Math.abs(hDec25 - fam25).toFixed(1) + " of a point");
setTxt("wx-fam24", fam24.toFixed(1) + " per cent");
setTxt("wx-h24", hDec24.toFixed(2) + "%");
setTxt("mr2-fam", "+" + fam25.toFixed(1) + " per cent");
setTxt("mr2-head", hDec25.toFixed(2) + "%");

/* ---------- the 2019 case ---------- */
const pkF19 = peakBetween(S.food, 2019, 2019);
const pkH19 = peakBetween(S.headline, 2019, 2019);
setTxt("ex-f19", pkF19.value.toFixed(2) + "%");
setTxt("ex-h19", pkH19.value.toFixed(2) + "%");

/* ---------- plate : the weights as bars ---------- */
setTxt("pv-wt", groups[0][1].toFixed(2) + "%");
{
  const bars = groups.map(([n, w, c]) => ({ group: n, weight: w, color: c }))
    .sort((a, b) => a.weight - b.weight);
  const plot = Plot.plot({
    width: 1184, height: 380,
    marginLeft: 250, marginRight: 120, marginTop: 20, marginBottom: 48,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "↑ weight in the CPI combined index · points of 100", labelAnchor: "center", labelArrow: false,
         tickFormat: (d) => String(d), ticks: [0, 10, 20, 30, 40, 50], domain: [0, 52], tickSize: 0, tickPadding: 11 },
    y: { label: null, tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX([0, 10, 20, 30, 40, 50], { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.barX(bars, { y: "group", x: "weight", fill: "color", insetTop: 14, insetBottom: 14 }),
      Plot.text(bars, { y: "group", x: "weight", text: (d) => d.weight.toFixed(2), dx: 10, fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "CPI group weights, per cent, Consumer Expenditure Survey 2011-12",
    "Horizontal bar chart. Food and beverages carry 45.86 of 100 points, miscellaneous services 28.32, housing 10.07, fuel and light 6.84, clothing and footwear 6.53, and pan, tobacco and intoxicants 2.38.");
  document.getElementById("plot-wt").append(plot);
  wireTools(document.getElementById("cb-wt"), plot,
    [{ name: "weight_pct", data: groups.map(([n, w]) => ({ date: n, value: w })) }],
    "india-atlas_learn_index-weights_ces-2011-12", (s) => String(s));
}
