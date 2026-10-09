// Learn № 13 · Consumption / PFCE — single y/y plate with zero rule, COVID
// crash annotated, recent pace end-labelled, all figure slots wired.
// Data: data/series/gdp.json (y/y bundle) + data/raw/nas-levels.json (share).
// Quarter formatting mirrors src/dossiers/gdp.client.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/gdp.json";
import levels from "../../data/raw/nas-levels.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, troughOf, peakOf } from "../charts/plumbing.js";

const S = hydrate(bundle);
const p = S.pfce;
const dates = p.data.map((d) => d.date);
const fmtDate = (d) => {
  const m = d.getUTCMonth(), y = d.getUTCFullYear();
  const q = m === 3 ? 1 : m === 6 ? 2 : m === 9 ? 3 : 4;
  return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
};
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

const last = p.data.at(-1);
const trough = troughOf(p);
const peak = peakOf(p);
const trendAvg = p.data.slice(0, 16).reduce((a, d) => a + d.value, 0) / 16;
const last4 = p.data.slice(-4);
const lastKey = bundle.meta.latestPeriod;
const share = levels.levels.pfce[lastKey] / levels.levels.gdp[lastKey] * 100;
/* the FY23 idle: Q3 and Q4 FY23 */
const fy23 = p.data.filter((d) => ["Q3 FY23", "Q4 FY23"].includes(fmtDate(d.date)));

/* ---------- figure slots ---------- */
setTxt("pv-pfce", last.value.toFixed(2) + "%");
setTxt("pf-pfce", bundle.meta.vintage);
setHTML("n-last", "+" + last.value.toFixed(2) + pc);
setTxt("n-share", share.toFixed(1) + "%");
setHTML("n-trough", "−" + Math.abs(trough.value).toFixed(2) + pc);
setTxt("n-trend", trendAvg.toFixed(1) + "%");
setTxt("ht-peak", peak.value.toFixed(1) + " per cent");
setTxt("fy23-run", fy23.map((d) => d.value.toFixed(1)).join(" and "));
setTxt("rec-run", last4.map((d) => d.value.toFixed(1)).join(", "));

/* ---------- the plate ---------- */
{
  const geo = { W: 1184, H: 500, ml: 70, mr: 150, mt: 30, mb: 48, d0: -28, d1: 24 };
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
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ real PFCE · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1.25 }),
      Plot.ruleX([trough.date], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: dxDate(trough.date, 10), value: 22.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.areaY(p.data, { x: "date", y: "value", y1: geo.d0, fill: "#A3A9B4", fillOpacity: 0.08 }),
      Plot.lineY(p.data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(p.data.slice(-5), { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      /* the FY23 idle */
      ...fy23.map((d) => Plot.dot([d], { x: "date", y: "value", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      Plot.text([{ date: dxDate(fy23[0].date, -20), value: fy23[0].value - sy(26) }], { x: "date", y: "value",
        text: () => "the engine idles, FY23", fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "middle" }),
      /* the COVID crash */
      Plot.dot([trough], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: dxDate(trough.date, 12), value: trough.value + sy(2) }], { x: "date", y: "value", text: () => trough.value.toFixed(1) + "%, " + fmtDate(trough.date) + ", the shops closed", dy: 4, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      /* the base-effect peak */
      Plot.dot([peak], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: dxDate(peak.date, 24), value: peak.value - sy(3) }], { x: "date", y: "value", text: () => peak.value.toFixed(1) + "%, " + fmtDate(peak.date) + ", base effect", dy: 4, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.line([{ x: dxDate(peak.date, 7), y: peak.value - sy(3) }, { x: dxDate(peak.date, 18), y: peak.value - sy(3) }], { x: "x", y: "y", stroke: "#2E4BD8", strokeWidth: 1 }),
      /* the recent pace, end-labelled */
      ...last4.slice(0, 3).map((d, i) => Plot.dot([d], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...last4.slice(0, 3).map((d, i) => Plot.text([d], { x: "date", y: "value", text: () => d.value.toFixed(1), dy: stag[i], fill: "#5F6675", fontSize: 11.5, fontFamily: mono, textAnchor: "middle" })),
      Plot.dot([last], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: () => last.value.toFixed(2) + "%, " + fmtDate(last.date), dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Real PFCE growth, year-on-year, Q1 FY17 to Q2 FY26",
    "Line chart. Household spending growth holds near 7 per cent before 2020, crashes to " + trough.value.toFixed(1) + " per cent in the lockdown, peaks at " + peak.value.toFixed(1) + " on the base effect, idles near 2 per cent in FY23, and ends at " + last.value.toFixed(2) + " per cent in Q2 FY26.");
  document.getElementById("plot-pfce").append(plot);
  wireTools(document.getElementById("cb-pfce"), plot, [p], "india-atlas_learn_consumption-pfce_fy17-fy26", fmtDate);
  addCrosshair(document.getElementById("plot-pfce"), plot, [p], geo, fmtDate);
}
