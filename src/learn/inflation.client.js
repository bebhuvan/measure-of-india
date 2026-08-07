// Learn № 01 · Inflation — level-vs-rate plates and figure wiring.
// Levels: data/raw/cpi-indices.json (published group indices, 2012=100).
// Rate:   data/series/cpi.json (baked y/y bundle).
// Plumbing (downloads, a11y, crosshair, spark): src/charts/plumbing.js.

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
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, downloadSVG, downloadPNG, downloadCSV } from "../charts/plumbing.js";

const S = hydrate(bundle);
const dates = S.headline.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

/* level series aligned to the baked bundle's window */
const LEVELS = {};
for (const key of ["published_headline", "food"]) {
  LEVELS[key] = dates.map((date) => {
    const k = date.toISOString().slice(0, 7);
    return { date, value: levelsFlat[key][k] };
  }).filter((d) => d.value != null);
}
const lvl = LEVELS.published_headline;
const lvlNow = lvl.at(-1).value;                       // Dec 2025
const lvlThen = lvl.at(-13).value;                     // Dec 2024
const ratio = lvlNow / lvlThen;
const jan25 = S.headline.data.at(-12).value;
const dec25 = S.headline.data.at(-1).value;

/* ---------- §02 figure slots ---------- */
setTxt("pv-lr", lvlNow.toFixed(1));
setTxt("pf-lr", bundle.meta.vintage);
setTxt("lr-rjan", jan25.toFixed(2) + "%");
setTxt("lr-rdec", dec25.toFixed(2) + "%");
setTxt("lr-ldec", lvlNow.toFixed(1));

/* ---------- §03 arithmetic slots ---------- */
setTxt("n-lvl-then", lvlThen.toFixed(1));
setTxt("n-lvl-now", lvlNow.toFixed(1));
setHTML("n-rate-now", "+" + (ratio * 100 - 100).toFixed(1) + pc);
setTxt("n-rupee", "₹" + Math.round(1000 * ratio).toLocaleString("en-IN"));
setTxt("ar-ratio", lvlNow.toFixed(1));
setTxt("ar-then", lvlThen.toFixed(1));
setTxt("ar-rupee", "₹" + Math.round(1000 * ratio).toLocaleString("en-IN"));
setTxt("ar-decade", Math.round((lvlNow / lvl[0].value - 1) * 100) + " per cent");

/* ---------- shared x furniture ---------- */
const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
const d24 = new Date(Date.UTC(2024, 11, 1)), d25 = new Date(Date.UTC(2025, 11, 1));
const plotStyle = { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" };

/* ---------- plate 1a : the price level ---------- */
{
  const geo = { W: 1184, H: 290, ml: 70, mr: 150, mt: 26, mb: 12, d0: 120, d1: 205 };
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const pThen = lvl.find((d) => d.date.getTime() === d24.getTime());
  const pNow = lvl.at(-1);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { axis: null, domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ price level · index, 2012 = 100", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => String(d), ticks: [120, 140, 160, 180, 200], domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY([120, 140, 160, 180, 200], { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleX([d24], { stroke: "#C9C2B0", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.ruleX([d25], { stroke: "#C9C2B0", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.lineY(lvl, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pThen], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([pNow], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pThen], { x: "date", y: "value", text: () => "Dec 2024 · " + pThen.value.toFixed(1), dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.text([pNow], { x: "date", y: "value", text: () => pNow.value.toFixed(1) + " · the highest reading is the last one", dx: -12, dy: -16, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.text([{ date: new Date(Date.UTC(2016, 3, 1)), value: 129 }], { x: "date", y: "value", text: ["what the basket costs"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "CPI price level, index 2012=100, January 2016 to December 2025",
    "Line chart. The level rises from 126.3 to 198.0 across the decade, ending at its highest point. December 2024, 195.4, and December 2025, 198.0, are marked.");
  document.getElementById("plot-level").append(plot);
  addCrosshair(document.getElementById("plot-level"), plot,
    [{ label: "Price level", color: "#BE3E26", data: lvl }], geo, fmtDate, (v) => v.toFixed(1));
}

/* ---------- plate 1b : the y/y rate ---------- */
{
  const h = S.headline;
  const geo = { W: 1184, H: 320, ml: 70, mr: 150, mt: 16, mb: 48, d0: -1, d1: 9 };
  const pThen = h.data.at(-13), pNow = h.data.at(-1);
  const yTicks = [0, 2, 4, 6, 8];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ the rate · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => d + "%", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F8F6F1" }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.ruleY([4], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ date: dates[2], value: 4.4 }], { x: "date", y: "value", text: ["RBI target · 4%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ date: dates[2], value: 6.5 }], { x: "date", y: "value", text: ["Tolerance band · 2–6%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.ruleX([d24], { stroke: "#C9C2B0", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.ruleX([d25], { stroke: "#C9C2B0", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.lineY(h.data, { x: "date", y: "value", stroke: "#5B564B", strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(h.data.slice(-13), { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 4, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pThen], { x: "date", y: "value", fill: "#5B564B", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([pNow], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pThen], { x: "date", y: "value", text: () => "Dec 2024 · " + pThen.value.toFixed(2) + "%", dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.text([pNow], { x: "date", y: "value", text: () => "Dec 2025 · " + pNow.value.toFixed(2) + "%", dx: -4, dy: -16, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.text([{ date: new Date(Date.UTC(2025, 6, 1)), value: 7.4 }], { x: "date", y: "value", text: ["the same 2025, drawn as a rate"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "CPI inflation rate, year-on-year, January 2016 to December 2025",
    "Line chart. The rate ends at 1.34 per cent in December 2025, down from 5.19 per cent a year earlier. Shaded band marks the RBI tolerance range of 2 to 6 per cent.");
  document.getElementById("plot-rate").append(plot);
  addCrosshair(document.getElementById("plot-rate"), plot,
    [{ label: "Inflation, y/y", color: "#5B564B", data: h.data }], geo, fmtDate);

  /* downloads for the two-panel frame: stack both panels into one tall card */
  const block = document.getElementById("cb-lr");
  const meta = {
    title: block.querySelector(".plate-head h3")?.textContent.trim(),
    sub: block.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  const lvlSvg = document.querySelector("#plot-level svg"), rateSvg = document.querySelector("#plot-rate svg");
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
    { name: "price_level_2012eq100", data: lvl },
    { name: "inflation_yoy_pct", data: S.headline.data },
  ];
  block.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg") downloadSVG(stacked, "india-atlas_learn_inflation_level-vs-rate_2016-2025", meta);
      if (kind === "png") downloadPNG(stacked, "india-atlas_learn_inflation_level-vs-rate_2016-2025", meta);
      if (kind === "csv") downloadCSV(seriesList, "india-atlas_learn_inflation_level-vs-rate_2016-2025", fmtDate);
    });
  });
}

/* ---------- plate 2 : the food level, actual deflation ---------- */
{
  const fk = Object.keys(levelsFlat.food).filter((k) => k >= "2023-01" && k <= "2025-12").sort();
  const fdata = fk.map((k) => ({ date: new Date(k + "-01T00:00:00Z"), value: levelsFlat.food[k] }));
  const pk = fdata.reduce((a, d) => (d.value > a.value ? d : a));
  const now = fdata.at(-1);
  const dropPct = (now.value / pk.value - 1) * 100;
  setTxt("pv-foodlvl", now.value.toFixed(1));
  setTxt("pf-foodlvl", "peak — " + pk.value.toFixed(1) + ", " + fmtDate(pk.date) + " · latest — " + now.value.toFixed(1));
  setTxt("fl-peak", pk.value.toFixed(1));
  setTxt("fl-now", now.value.toFixed(1));
  setTxt("fl-drop", Math.abs(dropPct).toFixed(1) + " per cent");

  const geo = { W: 1184, H: 420, ml: 70, mr: 136, mt: 30, mb: 48, d0: 180, d1: 215 };
  const yTicks = [180, 190, 200, 210];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2023, 2024, 2025].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ food price level · index, 2012 = 100", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => String(d), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.areaY(fdata, { x: "date", y: "value", y1: geo.d0, fill: "#5B564B", fillOpacity: 0.05 }),
      Plot.lineY(fdata, { x: "date", y: "value", stroke: "#5B564B", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(fdata.filter((d) => d.date >= pk.date), { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#5B564B", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk], { x: "date", y: "value", text: () => "peak · " + pk.value.toFixed(1) + " · " + fmtDate(pk.date), dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([now], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([now], { x: "date", y: "value", text: () => now.value.toFixed(1) + " · " + dropPct.toFixed(1) + "% from the peak", dx: -8, dy: 26, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.text([{ date: new Date(Date.UTC(2024, 8, 1)), value: 185 }], { x: "date", y: "value", text: ["the line itself turns down: this is deflation"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "Food price level, index 2012=100, January 2023 to December 2025",
    "Line chart. The food index peaks at 209.4 in October 2024, then falls to 202.1 by December 2025, an actual decline in the price level.");
  document.getElementById("plot-foodlvl").append(plot);
  wireTools(document.getElementById("cb-foodlvl"), plot, [{ name: "food_level_2012eq100", data: fdata }], "india-atlas_learn_inflation_food-level_2023-2025", fmtDate);
  addCrosshair(document.getElementById("plot-foodlvl"), plot,
    [{ label: "Food price level", color: "#5B564B", data: fdata }], geo, fmtDate, (v) => v.toFixed(1));
}
