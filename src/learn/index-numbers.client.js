// Learn № 08 · Index numbers — published level vs the same series rebased.
// Levels: data/raw/cpi-indices.json (published combined index, 2012=100).
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

/* published level aligned to the baked bundle's window, plus the rebased twin */
const P = levelsFlat.published_headline;
const pub = dates
  .map((date) => ({ date, value: P[date.toISOString().slice(0, 7)] }))
  .filter((d) => d.value != null);
const baseVal = pub[0].value;                                   // Jan 2016
const reb = pub.map((d) => ({ date: d.date, value: (d.value / baseVal) * 100 }));
const pubEnd = pub.at(-1).value;                                // Dec 2025
const rebEnd = reb.at(-1).value;
const rise = (pubEnd / baseVal - 1) * 100;

/* ---------- figure slots ---------- */
setTxt("pv-in", pubEnd.toFixed(1));
setTxt("pf-in", bundle.meta.vintage);
setTxt("in-def-lvl", pubEnd.toFixed(1));
setTxt("in-def-pc", (pubEnd - 100).toFixed(1) + " per cent");
setTxt("in-mn-pub", pubEnd.toFixed(1));
setTxt("in-mn-reb", rebEnd.toFixed(1));
setTxt("in-end-pub", pubEnd.toFixed(1));
setTxt("in-end-reb", rebEnd.toFixed(1));
setTxt("in-rise", rise.toFixed(1) + " per cent");
setTxt("in-n-pub0", baseVal.toFixed(1));
setTxt("in-n-reb0", "100.0");
setTxt("in-n-pub1", pubEnd.toFixed(1));
setTxt("in-n-reb1", rebEnd.toFixed(1));
setTxt("in-base", baseVal.toFixed(1));
setTxt("in-mis-pub", pubEnd.toFixed(1));
setTxt("in-mis-reb", rebEnd.toFixed(1));

/* ---------- shared x furniture ---------- */
const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
const plotStyle = { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" };

/* ---------- plate : same decade, two rulers ---------- */
{
  const geo = { W: 1184, H: 430, ml: 70, mr: 190, mt: 30, mb: 48, d0: 90, d1: 210 };
  const yTicks = [100, 120, 140, 160, 180, 200];
  const ePub = pub.at(-1), eReb = reb.at(-1);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ price level · two rulers, one series", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => String(d), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([100], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.lineY(pub, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(reb, { x: "date", y: "value", stroke: "#A8A293", strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([ePub], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([ePub], { x: "date", y: "value", text: () => "published · 2012 = 100 · " + ePub.value.toFixed(1), dx: -8, dy: -16, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
      Plot.dot([eReb], { x: "date", y: "value", fill: "#A8A293", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: new Date(Date.UTC(2020, 9, 1)), value: 151.5 }], { x: "date", y: "value", text: ["rebased · Jan 2016 = 100 · " + eReb.value.toFixed(1)], fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([pub[0]], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([reb[0]], { x: "date", y: "value", fill: "#A8A293", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: new Date(Date.UTC(2016, 3, 1)), value: 122.5 }], { x: "date", y: "value", text: ["Jan 2016: published reads " + baseVal.toFixed(1) + ", rebased reads 100"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ date: new Date(Date.UTC(2021, 0, 1)), value: 197 }], { x: "date", y: "value", text: ["same shape, same rise: only the labels differ"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "CPI level on two bases, published 2012=100 and rebased January 2016=100, 2016 to 2025",
    "Line chart with two identical-shaped lines. The published index rises from 126.3 to 198.0; rebased to January 2016 equals 100, the same data rises from 100.0 to 156.8. Both report the same 56.8 per cent rise.");
  document.getElementById("plot-rulers").append(plot);
  wireTools(document.getElementById("cb-rulers"), plot,
    [{ name: "cpi_level_2012eq100", data: pub }, { name: "cpi_level_jan2016eq100", data: reb }],
    "india-atlas_learn_index-numbers_two-rulers_2016-2025", fmtDate);
  addCrosshair(document.getElementById("plot-rulers"), plot,
    [{ label: "Published · 2012 = 100", color: "#BE3E26", data: pub },
     { label: "Rebased · Jan 2016 = 100", color: "#A8A293", data: reb }],
    geo, fmtDate, (v) => v.toFixed(1));
}
