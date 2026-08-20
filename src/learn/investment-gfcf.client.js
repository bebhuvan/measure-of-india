// Learn № 12 · Investment / GFCF — single y/y plate with zero rule, COVID
// trough annotated, last-four end labels, all figure slots wired.
// Data: data/series/gdp.json (y/y bundle) + data/raw/nas-levels.json (share).
// Quarter formatting mirrors src/dossiers/gdp.client.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/gdp.json";
import levels from "../../data/raw/nas-levels.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, troughOf, peakOf } from "../charts/plumbing.js";

const S = hydrate(bundle);
const f = S.gfcf;
const dates = f.data.map((d) => d.date);
const fmtDate = (d) => {
  const m = d.getUTCMonth(), y = d.getUTCFullYear();
  const q = m === 3 ? 1 : m === 6 ? 2 : m === 9 ? 3 : 4;
  return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
};
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

const last = f.data.at(-1);
const trough = troughOf(f);
const peak = peakOf(f);
const trendAvg = f.data.slice(0, 16).reduce((a, d) => a + d.value, 0) / 16;
const last4 = f.data.slice(-4);
const lastKey = bundle.meta.latestPeriod;
const share = levels.levels.gfcf[lastKey] / levels.levels.gdp[lastKey] * 100;
/* the FY20 pre-pandemic slump: three straight quarters below zero */
const fy20run = f.data.filter((d) => d.date >= new Date(Date.UTC(2019, 6, 1)) && d.date <= new Date(Date.UTC(2020, 0, 1)));
const fy20gdp = S.gdp.data.find((d) => fmtDate(d.date) === "Q4 FY20");

/* ---------- figure slots ---------- */
setTxt("pv-gfcf", last.value.toFixed(2) + "%");
setTxt("pf-gfcf", bundle.meta.vintage);
setHTML("n-last", "+" + last.value.toFixed(2) + pc);
setHTML("n-trough", "−" + Math.abs(trough.value).toFixed(2) + pc);
setHTML("n-peak", "+" + peak.value.toFixed(2) + pc);
setTxt("n-share", share.toFixed(1) + "%");
setTxt("ht-peak", peak.value.toFixed(1) + " per cent");
setTxt("fy20-run", fy20run.map((d) => d.value.toFixed(1)).join(", "));
setTxt("fy20-gdp", fy20gdp.value.toFixed(2) + "%");
setTxt("rec-run", last4.map((d) => d.value.toFixed(1)).join(", "));
setTxt("rec-avg", trendAvg.toFixed(1) + " per cent");

/* ---------- the plate ---------- */
{
  const geo = { W: 1184, H: 500, ml: 70, mr: 150, mt: 30, mb: 48, d0: -50, d1: 70 };
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const t0 = dates[0].getTime(), t1 = dates.at(-1).getTime();
  const sx = (px) => px / ((geo.W - geo.ml - geo.mr) / (t1 - t0));
  const dxDate = (d, px) => new Date(d.getTime() + sx(px));
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-40, -20, 0, 20, 40, 60];
  const stag = [-14, 24, -14];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ real GFCF · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1.25 }),
      Plot.ruleX([trough.date], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: dxDate(trough.date, 10), value: 66 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.areaY(f.data, { x: "date", y: "value", y1: geo.d0, fill: "#8A857A", fillOpacity: 0.06 }),
      Plot.lineY(f.data, { x: "date", y: "value", stroke: "#8A857A", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(f.data.slice(-5), { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" }),
      /* the FY20 warning: three quarters below zero */
      ...fy20run.map((d) => Plot.dot([d], { x: "date", y: "value", fill: "#5B564B", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      Plot.text([{ date: fy20run[1].date, value: fy20run[1].value - sy(26) }], { x: "date", y: "value",
        text: () => "three quarters below zero · FY20, pre-pandemic", dx: -10, fill: "#5B564B", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
      /* the COVID trough */
      Plot.dot([trough], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: dxDate(trough.date, 12), value: trough.value + sy(2) }], { x: "date", y: "value", text: () => trough.value.toFixed(1) + "% · " + fmtDate(trough.date) + " · building stopped", dy: 4, fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "start" }),
      /* the rebound peak, base arithmetic */
      Plot.dot([peak], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: dxDate(peak.date, 24), value: peak.value - sy(3) }], { x: "date", y: "value", text: () => peak.value.toFixed(1) + "% · " + fmtDate(peak.date) + " · base effect", dy: 4, fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "start" }),
      Plot.line([{ x: dxDate(peak.date, 7), y: peak.value - sy(3) }, { x: dxDate(peak.date, 18), y: peak.value - sy(3) }], { x: "x", y: "y", stroke: "#BE3E26", strokeWidth: 1 }),
      /* the recent recovery, end-labelled */
      ...last4.slice(0, 3).map((d, i) => Plot.dot([d], { x: "date", y: "value", fill: "#BE3E26", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...last4.slice(0, 3).map((d, i) => Plot.text([d], { x: "date", y: "value", text: () => d.value.toFixed(1), dy: stag[i], fill: "#5B564B", fontSize: 11.5, fontFamily: mono, textAnchor: "middle" })),
      Plot.dot([last], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: () => last.value.toFixed(2) + "% · " + fmtDate(last.date), dx: 16, fill: "#BE3E26", fontSize: 14, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Real GFCF growth, year-on-year, Q1 FY17 to Q2 FY26",
    "Line chart. Investment growth turns negative for three quarters in FY20, crashes to " + trough.value.toFixed(1) + " per cent in the lockdown, spikes to " + peak.value.toFixed(1) + " on the base effect, and ends at " + last.value.toFixed(2) + " per cent in Q2 FY26.");
  document.getElementById("plot-gfcf").append(plot);
  wireTools(document.getElementById("cb-gfcf"), plot, [f], "india-atlas_learn_investment-gfcf_fy17-fy26", fmtDate);
  addCrosshair(document.getElementById("plot-gfcf"), plot, [f], geo, fmtDate);
}
