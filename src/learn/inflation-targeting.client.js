// Learn № 07 · Inflation targeting — headline y/y against the 2–6% band.
// Rate: data/series/cpi.json (baked y/y bundle).
// Plumbing (downloads, a11y, crosshair): src/charts/plumbing.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/cpi.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair } from "../charts/plumbing.js";

const S = hydrate(bundle);
const h = S.headline;
const dates = h.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);

const at = (ym) => h.data.find((d) => d.date.toISOString().slice(0, 7) === ym);
const peakBetween = (a, b) => h.data.filter((d) => d.date >= a && d.date <= b).reduce((m, d) => (d.value > m.value ? d : m));
const qAvg = (y, m0) => {
  const vs = [0, 1, 2].map((i) => h.data.find((d) => d.date.getUTCFullYear() === y && d.date.getUTCMonth() === m0 - 1 + i).value);
  return vs.reduce((a, c) => a + c, 0) / 3;
};

const pk20 = peakBetween(new Date(Date.UTC(2019, 10, 1)), new Date(Date.UTC(2020, 2, 1)));    // Jan 2020
const pk22 = peakBetween(new Date(Date.UTC(2022, 0, 1)), new Date(Date.UTC(2022, 8, 1)));     // Apr 2022
const pk23 = peakBetween(new Date(Date.UTC(2023, 5, 1)), new Date(Date.UTC(2023, 11, 1)));    // Jul 2023
const low25 = h.data.filter((d) => d.date >= new Date(Date.UTC(2025, 0, 1))).reduce((m, d) => (d.value < m.value ? d : m)); // Oct 2025
const nAbove = h.data.filter((d) => d.value > 6).length;
const nBelow = h.data.filter((d) => d.value < 2).length;
const pNow = h.data.at(-1);

/* ---------- figure slots ---------- */
setTxt("pv-it", pNow.value.toFixed(2) + "%");
setTxt("pf-it", bundle.meta.vintage);
setTxt("it-m-above", String(nAbove));
setTxt("it-m-below", String(nBelow));
setTxt("it-pk20", pk20.value.toFixed(2) + "%");
setTxt("it-pk22", pk22.value.toFixed(2) + "%");
setTxt("it-pk23", pk23.value.toFixed(2) + "%");
setTxt("it-low25", low25.value.toFixed(2) + "%");
setTxt("it-c-q1", qAvg(2022, 1).toFixed(1) + " per cent");
setTxt("it-c-q2", qAvg(2022, 4).toFixed(1) + " per cent");
setTxt("it-c-q3", qAvg(2022, 7).toFixed(1) + " per cent");

/* ---------- shared x furniture ---------- */
const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
const plotStyle = { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" };

/* ---------- plate : ten years against the band ---------- */
{
  const geo = { W: 1184, H: 440, ml: 70, mr: 150, mt: 26, mb: 48, d0: -1, d1: 9 };
  const yTicks = [0, 2, 4, 6, 8];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: plotStyle,
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ headline inflation · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => d + "%", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F8F6F1" }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.ruleY([2], { stroke: "#D9D3C2", strokeWidth: 1 }),
      Plot.ruleY([6], { stroke: "#D9D3C2", strokeWidth: 1 }),
      Plot.ruleY([4], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ date: dates[2], value: 4.4 }], { x: "date", y: "value", text: ["RBI target · 4%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ date: dates[2], value: 6.4 }], { x: "date", y: "value", text: ["Tolerance band · 2–6% · law, not decoration"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.lineY(h.data, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pk20], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk20], { x: "date", y: "value", text: () => "Jan 2020 · " + pk20.value.toFixed(2) + "% · food above the ceiling", dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([pk22], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk22], { x: "date", y: "value", text: () => "Apr 2022 · " + pk22.value.toFixed(2) + "% · the letter year", dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([pk23], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk23], { x: "date", y: "value", text: () => "Jul 2023 · " + pk23.value.toFixed(2) + "% · vegetables", dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([low25], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([low25], { x: "date", y: "value", text: () => "Oct 2025 · " + low25.value.toFixed(2) + "% · through the floor", dx: 6, dy: 24, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "middle" }),
      Plot.dot([pNow], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pNow], { x: "date", y: "value", text: () => "Dec 2025 · " + pNow.value.toFixed(2) + "%", dx: -4, dy: -16, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
    ],
  });
  a11y(plot, "Headline inflation against the RBI tolerance band, January 2016 to December 2025",
    "Line chart. The rate ends at 1.34 per cent in December 2025. The shaded band marks the 2 to 6 per cent tolerance range with the 4 per cent target dashed. Excursions are marked: 7.51 per cent in January 2020, 7.74 in April 2022, 7.46 in July 2023, and 0.29 in October 2025, below the floor.");
  document.getElementById("plot-band").append(plot);
  wireTools(document.getElementById("cb-band"), plot, [{ name: "headline_inflation_yoy_pct", data: h.data }], "india-atlas_learn_inflation-targeting_band_2016-2025", fmtDate);
  addCrosshair(document.getElementById("plot-band"), plot,
    [{ label: "Inflation, y/y", color: "#BE3E26", data: h.data }], geo, fmtDate);
}
