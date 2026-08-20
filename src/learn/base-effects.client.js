// Learn № 02 · Base effects — the autumn-2024 food spike as level and as base.
// Levels: data/raw/cpi-indices.json (published food group index, 2012=100).
// Rate:   data/series/cpi.json (baked y/y bundle).

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
import { MONO as mono, hydrate, a11y, addCrosshair, downloadSVG, downloadPNG, downloadCSV } from "../charts/plumbing.js";

const S = hydrate(bundle);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

/* food level + y/y, 2023-01 .. 2025-12 */
const fk = Object.keys(levelsFlat.food).filter((k) => k >= "2023-01" && k <= "2025-12").sort();
const flvl = fk.map((k) => ({ date: new Date(k + "-01T00:00:00Z"), value: levelsFlat.food[k] }));
const fyoy = S.food.data.filter((d) => d.date >= flvl[0].date && d.date <= flvl.at(-1).date);
const at = (arr, key) => arr.find((d) => d.date.toISOString().slice(0, 7) === key);
const lvlThen = at(flvl, "2024-12");
const lvlNow = flvl.at(-1);
const lvl23 = at(flvl, "2023-12");
const pk = flvl.reduce((a, d) => (d.value > a.value ? d : a));
const yThen = at(fyoy, "2024-12");
const yNow = fyoy.at(-1);
const ratio = lvlNow.value / lvlThen.value;

/* ---------- figure slots ---------- */
setTxt("pv-be", yNow.value.toFixed(2) + "%");
setTxt("pf-be", bundle.meta.vintage);
setTxt("ex-jul24", at(flvl, "2024-07").value.toFixed(1));
setTxt("ex-peak", pk.value.toFixed(1));
setTxt("ex-print", yNow.value.toFixed(2) + "%");
setTxt("ex-y24", yThen.value.toFixed(2) + "%");
setTxt("n-then", lvlThen.value.toFixed(1));
setTxt("n-now", lvlNow.value.toFixed(1));
setHTML("n-rate", (ratio * 100 - 100).toFixed(1) + pc);
setTxt("n-rupee", "₹" + Math.round(1000 * ratio).toLocaleString("en-IN"));
setTxt("ar-now", lvlNow.value.toFixed(1));
setTxt("ar-then", lvlThen.value.toFixed(1));
setTxt("ar-ratio3", ratio.toFixed(3));
setTxt("ar-print", yNow.value.toFixed(2) + "%");
setTxt("ar-23", lvl23.value.toFixed(1));
setTxt("ar-alt", "+" + (lvlNow.value / lvl23.value * 100 - 100).toFixed(1) + "%");
setTxt("mr-y24", yThen.value.toFixed(2) + "%");
setTxt("mr-y25", yNow.value.toFixed(2) + "%");
setTxt("mr-lvl", Math.abs((lvlNow.value / pk.value - 1) * 100).toFixed(1) + " per cent");
setTxt("mr-a1", yNow.value.toFixed(2) + "%");
setTxt("mr-a2", "+" + (lvlNow.value / lvl23.value * 100 - 100).toFixed(1) + "%");

/* ---------- shared x furniture ---------- */
const d0w = flvl[0].date, d1w = flvl.at(-1).date;
const s0 = new Date(Date.UTC(2024, 6, 1)), s1 = new Date(Date.UTC(2024, 11, 1)); // the spike window
const xTicks = [2023, 2024, 2025].map((y) => new Date(Date.UTC(y, 0, 1)));
const plotStyle = { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" };

/* ---------- panel a : the food level ---------- */
{
  const geo = { W: 1184, H: 290, ml: 70, mr: 150, mt: 26, mb: 12, d0: 170, d1: 215 };
  const yTicks = [180, 190, 200, 210];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { axis: null, domain: [d0w, d1w] },
    y: { label: "↑ food price level · index, 2012 = 100", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => String(d), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.rect([{ x1: s0, x2: s1 }], { x1: "x1", x2: "x2", y1: geo.d0, y2: geo.d1, fill: "#F8F6F1" }),
      Plot.lineY(flvl, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk], { x: "date", y: "value", text: () => "peak · " + pk.value.toFixed(1) + " · " + fmtDate(pk.date), dx: 14, dy: -16, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([lvlNow], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([lvlNow], { x: "date", y: "value", text: () => "Dec 2025 · " + lvlNow.value.toFixed(1), dx: -6, dy: 24, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.text([{ date: new Date(Date.UTC(2024, 8, 15)), value: 195.5 }], { x: "date", y: "value", text: ["the base"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "Food price level, index 2012=100, January 2023 to December 2025",
    "Line chart. The food index rises from 176.7 in January 2023 to a peak of 209.4 in October 2024, then falls to 202.1 by December 2025. The autumn-2024 spike window is shaded and marked as the base.");
  document.getElementById("plot-be-level").append(plot);
  addCrosshair(document.getElementById("plot-be-level"), plot,
    [{ label: "Food price level", color: "#BE3E26", data: flvl }], geo, fmtDate, (v) => v.toFixed(1));
}

/* ---------- panel b : the y/y rate ---------- */
{
  const geo = { W: 1184, H: 320, ml: 70, mr: 150, mt: 16, mb: 48, d0: -6, d1: 12 };
  const yTicks = [-5, 0, 5, 10];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [d0w, d1w] },
    y: { label: "↑ food inflation · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => d + "%", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rect([{ x1: s0, x2: s1 }], { x1: "x1", x2: "x2", y1: geo.d0, y2: geo.d1, fill: "#F8F6F1" }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.lineY(fyoy, { x: "date", y: "value", stroke: "#5B564B", strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(fyoy.slice(-13), { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([yThen], { x: "date", y: "value", fill: "#5B564B", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([yThen], { x: "date", y: "value", text: () => "Dec 2024 · " + yThen.value.toFixed(2) + "%", dx: 14, dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([yNow], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([yNow], { x: "date", y: "value", text: () => "Dec 2025 · " + yNow.value.toFixed(2) + "%", dx: 12, dy: -2, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text([{ date: new Date(Date.UTC(2024, 8, 15)), value: -4.6 }], { x: "date", y: "value", text: ["the base"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
      Plot.text([{ date: new Date(Date.UTC(2023, 6, 1)), value: 10.9 }], { x: "date", y: "value", text: ["each reading divides by a month a year back"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "Food inflation, year-on-year, January 2023 to December 2025",
    "Line chart. The rate peaks at 10.6 per cent in July 2023, reads 7.69 per cent in December 2024, then falls through 2025 to minus 1.85 per cent in December 2025. The shaded window marks the autumn-2024 base.");
  document.getElementById("plot-be-rate").append(plot);
  addCrosshair(document.getElementById("plot-be-rate"), plot,
    [{ label: "Food inflation, y/y", color: "#5B564B", data: fyoy }], geo, fmtDate);

  /* downloads for the two-panel frame: stack both panels into one tall card */
  const block = document.getElementById("cb-be");
  const meta = {
    title: block.querySelector(".plate-head h3")?.textContent.trim(),
    sub: block.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  const lvlSvg = document.querySelector("#plot-be-level svg"), rateSvg = document.querySelector("#plot-be-rate svg");
  const stacked = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  stacked.setAttribute("width", "1184");
  stacked.setAttribute("height", String(+lvlSvg.getAttribute("height") + +rateSvg.getAttribute("height") + 34));
  stacked.setAttribute("viewBox", `0 0 1184 ${stacked.getAttribute("height")}`);
  const g1 = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g1.append(lvlSvg.cloneNode(true));
  const g2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g2.setAttribute("transform", `translate(0,${+lvlSvg.getAttribute("height") + 34})`);
  g2.append(rateSvg.cloneNode(true));
  stacked.append(g1, g2);
  const seriesList = [
    { name: "food_level_2012eq100", data: flvl },
    { name: "food_inflation_yoy_pct", data: fyoy },
  ];
  block.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg") downloadSVG(stacked, "india-atlas_learn_base-effects_food_2023-2025", meta);
      if (kind === "png") downloadPNG(stacked, "india-atlas_learn_base-effects_food_2023-2025", meta);
      if (kind === "csv") downloadCSV(seriesList, "india-atlas_learn_base-effects_food_2023-2025", fmtDate);
    });
  });
}
