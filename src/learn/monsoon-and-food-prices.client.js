// Learn № 20 · The monsoon and food prices — food y/y with real episodes.
// Rate: data/series/cpi.json (baked y/y bundle).
// Plumbing (downloads, a11y, crosshair): src/charts/plumbing.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/cpi.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair } from "../charts/plumbing.js";

const S = hydrate(bundle);
const f = S.food;
const dates = f.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);

const at = (ym) => f.data.find((d) => d.date.toISOString().slice(0, 7) === ym);
const onion = at("2019-12");                                   // the onion spike
const veg23 = at("2023-07");                                   // the vegetable spike
const defl25 = f.data.filter((d) => d.date >= new Date(Date.UTC(2025, 0, 1))).reduce((m, d) => (d.value < m.value ? d : m)); // Oct 2025
const pNow = f.data.at(-1);

/* ---------- figure slots ---------- */
setTxt("pv-mo", pNow.value.toFixed(2) + "%");
setTxt("pf-mo", bundle.meta.vintage);
setTxt("mo-onion", onion.value.toFixed(2) + "%");
setTxt("mo-defl", defl25.value.toFixed(2) + "%");
setTxt("mo-dec25", pNow.value.toFixed(2) + "%");

/* ---------- shared x furniture ---------- */
const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
const plotStyle = { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#5F6675", overflow: "visible" };

/* ---------- plate : the sky, visible in the data ---------- */
{
  const geo = { W: 1184, H: 440, ml: 70, mr: 150, mt: 26, mb: 48, d0: -6, d1: 14 };
  const yTicks = [-5, 0, 5, 10];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ food inflation · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => d + "%", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.rectX([{ x1: new Date(Date.UTC(2019, 5, 1)), x2: new Date(Date.UTC(2019, 9, 1)) }],
        { x1: "x1", x2: "x2", y1: geo.d0, y2: geo.d1, fill: "#F4F6FD" }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.text([{ date: new Date(Date.UTC(2019, 6, 15)), value: -4.6 }], { x: "date", y: "value", text: ["the 2019 monsoon"], fontSize: 12, fill: "#A3A9B4", fontFamily: mono, textAnchor: "middle" }),
      Plot.lineY(f.data, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([onion], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([onion], { x: "date", y: "value", text: () => "its harvest: Dec 2019, onions, " + onion.value.toFixed(2) + "%", dx: 8, dy: -12, fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([veg23], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([veg23], { x: "date", y: "value", text: () => "Jul 2023, vegetables, " + veg23.value.toFixed(2) + "%", dx: 6, dy: -14, fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([defl25], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([defl25], { x: "date", y: "value", text: () => "Oct 2025, " + defl25.value.toFixed(2) + "%, a good harvest, one winter late", dx: -6, dy: 26, fill: "#161A22", fontSize: 12, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.dot([pNow], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pNow], { x: "date", y: "value", text: () => "Dec 2025, " + pNow.value.toFixed(2) + "%", dx: 12, dy: -2, fill: "#161A22", fontSize: 12, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text([{ date: new Date(Date.UTC(2017, 5, 1)), value: 13.8 }], { x: "date", y: "value", text: ["rain falls in the monsoon; the print answers by winter"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "Food inflation rate with monsoon episodes marked, January 2016 to December 2025",
    "Line chart. Food inflation ends at minus 1.85 per cent in December 2025. Marked episodes: the December 2019 onion spike at 12.16 per cent, months after the shaded 2019 monsoon; the July 2023 vegetable spike at 10.57 per cent; and the 2025 deflation bottoming at minus 3.72 per cent in October.");
  document.getElementById("plot-monsoon").append(plot);
  wireTools(document.getElementById("cb-monsoon"), plot, [{ name: "food_inflation_yoy_pct", data: f.data }], "india-atlas_learn_monsoon_food-yoy_2016-2025", fmtDate);
  addCrosshair(document.getElementById("plot-monsoon"), plot,
    [{ label: "Food inflation, y/y", color: "#2E4BD8", data: f.data }], geo, fmtDate);
}
