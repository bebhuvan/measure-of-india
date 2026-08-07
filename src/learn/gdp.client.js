// Learn № 09 · GDP — single y/y plate with trend rule, crash annotation,
// last-four end labels, and all figure-slot wiring.
// Data: data/series/gdp.json (baked y/y bundle, constant 2011-12 prices).
// Quarter formatting and x ticks mirror src/dossiers/gdp.client.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/gdp.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, troughOf, peakBetween } from "../charts/plumbing.js";

const S = hydrate(bundle);
const g = S.gdp;
const dates = g.data.map((d) => d.date);
const fmtDate = (d) => {
  const m = d.getUTCMonth(), y = d.getUTCFullYear();
  const q = m === 3 ? 1 : m === 6 ? 2 : m === 9 ? 3 : 4;
  return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
};
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

const last = g.data.at(-1);
const prev = g.data.at(-2);
const crash = troughOf(g);
const rebound = peakBetween(g, 2021, 2021);
const trendAvg = g.data.slice(0, 16).reduce((a, d) => a + d.value, 0) / 16;
const last4 = g.data.slice(-4);

/* ---------- figure slots ---------- */
setTxt("pv-gdp", last.value.toFixed(2) + "%");
setTxt("pf-gdp", bundle.meta.vintage);
setHTML("n-last", "+" + last.value.toFixed(2) + pc);
setHTML("n-prev", "+" + prev.value.toFixed(2) + pc);
setTxt("n-trend", trendAvg.toFixed(1) + "%");
setHTML("n-crash", "−" + Math.abs(crash.value).toFixed(2) + pc);
setTxt("fy26-run", last4.map((d) => d.value.toFixed(1)).join(", "));
setTxt("fy26-last", last.value.toFixed(2) + "%");

/* ---------- the plate ---------- */
{
  const geo = { W: 1184, H: 520, ml: 70, mr: 150, mt: 36, mb: 48, d0: -30, d1: 25 };
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const t0 = dates[0].getTime(), t1 = dates.at(-1).getTime();
  const sx = (px) => px / ((geo.W - geo.ml - geo.mr) / (t1 - t0));
  const dxDate = (d, px) => new Date(d.getTime() + sx(px));
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-20, -10, 0, 10, 20];
  const stag = [-14, 24, -14];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ real GDP · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleY([6], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ date: dates[1], value: 6.9 }], { x: "date", y: "value", text: ["Rough pre-pandemic trend · 6%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.ruleX([crash.date], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: dxDate(crash.date, 10), value: 23.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.areaY(g.data, { x: "date", y: "value", y1: geo.d0, fill: "#BE3E26", fillOpacity: 0.05 }),
      Plot.lineY(g.data, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(g.data.slice(-5), { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([crash], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line([{ x: crash.date, y: crash.value - sy(7) }, { x: crash.date, y: crash.value - sy(19) }], { x: "x", y: "y", stroke: "#BE3E26", strokeWidth: 1 }),
      Plot.text([{ date: crash.date, value: crash.value - sy(27) }], { x: "date", y: "value", text: () => crash.value.toFixed(1) + "% · " + fmtDate(crash.date) + " · lockdown", fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([rebound], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: dxDate(rebound.date, 24), value: rebound.value - sy(3) }], { x: "date", y: "value", text: () => rebound.value.toFixed(1) + "% · " + fmtDate(rebound.date) + " · base effect", dy: 4, fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "start" }),
      Plot.line([{ x: dxDate(rebound.date, 7), y: rebound.value - sy(3) }, { x: dxDate(rebound.date, 18), y: rebound.value - sy(3) }], { x: "x", y: "y", stroke: "#BE3E26", strokeWidth: 1 }),
      ...last4.slice(0, 3).map((d, i) => Plot.dot([d], { x: "date", y: "value", fill: "#BE3E26", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...last4.slice(0, 3).map((d, i) => Plot.text([d], { x: "date", y: "value", text: () => d.value.toFixed(1), dy: stag[i], fill: "#5B564B", fontSize: 11.5, fontFamily: mono, textAnchor: "middle" })),
      Plot.dot([last], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: () => last.value.toFixed(2) + "% · " + fmtDate(last.date), dx: 16, fill: "#BE3E26", fontSize: 14, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Real GDP growth, year-on-year, Q1 FY17 to Q2 FY26",
    "Line chart. Growth holds near a 6 per cent trend before 2020, crashes to " + crash.value.toFixed(1) + " per cent in the lockdown quarter, rebounds to " + rebound.value.toFixed(1) + " on the base effect, and ends at " + last.value.toFixed(2) + " per cent in Q2 FY26, with the last four quarters all above trend.");
  document.getElementById("plot-gdp").append(plot);
  wireTools(document.getElementById("cb-gdp"), plot, [g], "india-atlas_learn_gdp_real-gdp-yoy_fy17-fy26", fmtDate);
  addCrosshair(document.getElementById("plot-gdp"), plot, [g], geo, fmtDate);
}
