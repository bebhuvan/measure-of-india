// Learn № 06 · Seasonality — food level with Nov–Feb bands.
// Levels: data/raw/cpi-indices.json (published food group index, 2012=100).
// Plumbing (downloads, a11y, crosshair): src/charts/plumbing.js.

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
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair } from "../charts/plumbing.js";

const S = hydrate(bundle);
const dates = S.headline.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);

/* food level aligned to the baked bundle's window */
const F = levelsFlat.food;
const fdata = dates
  .map((date) => ({ date, value: F[date.toISOString().slice(0, 7)] }))
  .filter((d) => d.value != null);

/* winter windows: November y to February y+1 */
const winters = [];
for (let y = 2016; y <= 2024; y++) {
  const x1 = new Date(Date.UTC(y, 10, 1));
  const x2 = new Date(Date.UTC(y + 1, 2, 1));
  const v1 = F[y + "-11"], v2 = F[y + 1 + "-02"];
  winters.push({ x1, x2, v1, v2, chg: (v2 / v1 - 1) * 100 });
}
const fell = winters.filter((w) => w.chg < 0).length;
const deep = winters.reduce((a, w) => (w.chg < a.chg ? w : a));
const onion = { date: new Date(Date.UTC(2019, 11, 1)), value: F["2019-12"] };

/* ---------- figure slots ---------- */
setTxt("pv-seas", fdata.at(-1).value.toFixed(1));
setTxt("pf-seas", bundle.meta.vintage);
setTxt("se-fell", fell === winters.length ? "every one" : fell + " out of " + winters.length);
setTxt("se-rise", ((fdata.at(-1).value / fdata[0].value - 1) * 100).toFixed(1) + " per cent");
setTxt("se-c-nov", deep.v1.toFixed(1));
setTxt("se-c-feb", deep.v2.toFixed(1));
setTxt("se-c-drop", Math.abs(deep.chg).toFixed(1) + " per cent");

/* ---------- shared x furniture ---------- */
const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
const plotStyle = { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" };

/* ---------- plate : the calendar drawn ten times ---------- */
{
  const geo = { W: 1184, H: 430, ml: 70, mr: 150, mt: 30, mb: 48, d0: 125, d1: 215 };
  const yTicks = [140, 160, 180, 200];
  const pNov = { date: deep.x1, value: deep.v1 };
  const pFeb = { date: new Date(Date.UTC(deep.x2.getUTCFullYear(), 1, 1)), value: deep.v2 };
  const pNow = fdata.at(-1);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ food price level · index, 2012 = 100", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => String(d), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rectX(winters, { x1: "x1", x2: "x2", y1: geo.d0, y2: geo.d1, fill: "#F8F6F1" }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.text([{ date: new Date(Date.UTC(2017, 0, 15)), value: 212 }], { x: "date", y: "value", text: ["Nov – Feb, every year"], fontSize: 12, fill: "#A8A293", fontFamily: mono, textAnchor: "middle" }),
      Plot.lineY(fdata, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([onion], { x: "date", y: "value", fill: "#5B564B", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([onion], { x: "date", y: "value", text: () => "the onion spike sits inside the winter window · Dec 2019 · " + onion.value.toFixed(1), dx: 10, dy: -12, fill: "#5B564B", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([pNov], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([pFeb], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pNov], { x: "date", y: "value", text: () => "Nov 2024 · " + pNov.value.toFixed(1), dy: -14, fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.text([pFeb], { x: "date", y: "value", text: () => "Feb 2025 · " + pFeb.value.toFixed(1) + " · the deepest dip of the decade", dx: -6, dy: 26, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.dot([pNow], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pNow], { x: "date", y: "value", text: () => "Dec 2025 · " + pNow.value.toFixed(1), dx: -4, dy: -16, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.text([{ date: new Date(Date.UTC(2018, 5, 1)), value: 131 }], { x: "date", y: "value", text: ["the wobble is the season; the climb is the trend"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "Food price level with November to February shaded, January 2016 to December 2025",
    "Line chart. The food index rises from 131.3 to 202.1 across the decade. Shaded bands mark November to February each year; the level ends every winter window lower than it began, most deeply in 2024-25, falling from 208.4 to 197.6.");
  document.getElementById("plot-seas").append(plot);
  wireTools(document.getElementById("cb-seas"), plot, [{ name: "food_level_2012eq100", data: fdata }], "india-atlas_learn_seasonality_food-level_2016-2025", fmtDate);
  addCrosshair(document.getElementById("plot-seas"), plot,
    [{ label: "Food price level", color: "#BE3E26", data: fdata }], geo, fmtDate, (v) => v.toFixed(1));
}
