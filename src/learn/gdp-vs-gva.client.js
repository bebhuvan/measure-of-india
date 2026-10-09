// Learn № 10 · GDP versus GVA — two y/y lines, the gap annotated once as
// the tax wedge, end labels dodged, all figure slots wired.
// Data: data/series/gdp.json (y/y bundle) + data/raw/nas-levels.json (levels
// for the wedge share). Quarter formatting mirrors src/dossiers/gdp.client.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/gdp.json";
import levels from "../../data/raw/nas-levels.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, dodgeEndLabels } from "../charts/plumbing.js";

const S = hydrate(bundle);
const g = S.gdp, v = S.gva;
const dates = g.data.map((d) => d.date);
const fmtDate = (d) => {
  const m = d.getUTCMonth(), y = d.getUTCFullYear();
  const q = m === 3 ? 1 : m === 6 ? 2 : m === 9 ? 3 : 4;
  return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
};
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

const lastG = g.data.at(-1), lastV = v.data.at(-1);
const lastKey = bundle.meta.latestPeriod;                    // "2025-07"
const wedgeShare = (levels.levels.gdp[lastKey] - levels.levels.gva[lastKey]) / levels.levels.gdp[lastKey] * 100;

/* the widest pre-2020 gap between the lines: the wedge, annotated once */
let wp = null;
g.data.forEach((d, i) => {
  if (d.date >= new Date(Date.UTC(2020, 0, 1))) return;
  const gap = d.value - v.data[i].value;
  if (!wp || Math.abs(gap) > Math.abs(wp.gap)) wp = { date: d.date, gdp: d.value, gva: v.data[i].value, gap };
});

/* the FY21 inversion: GVA above GDP */
const fy21 = { gdp: g.data.find((d) => fmtDate(d.date) === "Q4 FY21"), gva: v.data.find((d) => fmtDate(d.date) === "Q4 FY21") };

/* ---------- figure slots ---------- */
setTxt("pv-gg", lastG.value.toFixed(2) + "%");
setTxt("pf-gg", bundle.meta.vintage);
setHTML("n-gdp", "+" + lastG.value.toFixed(2) + pc);
setHTML("n-gva", "+" + lastV.value.toFixed(2) + pc);
setTxt("n-gap", (lastG.value - lastV.value >= 0 ? "+" : "−") + Math.abs(lastG.value - lastV.value).toFixed(1) + " pt");
setTxt("n-wedge", wedgeShare.toFixed(1) + "%");
setTxt("fy21-gdp", fy21.gdp.value.toFixed(2) + "%");
setTxt("fy21-gva", fy21.gva.value.toFixed(2) + "%");

/* ---------- the plate ---------- */
{
  const seriesList = [g, v];
  const geo = { W: 1184, H: 520, ml: 70, mr: 170, mt: 36, mb: 48, d0: -30, d1: 25 };
  const endGap = (geo.d1 - geo.d0) * 0.04;
  const dodged = dodgeEndLabels(seriesList, endGap);
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-20, -10, 0, 10, 20];
  const t0 = dates[0].getTime(), t1 = dates.at(-1).getTime();
  const sx = (px) => px / ((geo.W - geo.ml - geo.mr) / (t1 - t0));
  const dxDate = (d, px) => new Date(d.getTime() + sx(px));
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 23.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.lineY(v.data, { x: "date", y: "value", stroke: v.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(g.data, { x: "date", y: "value", stroke: g.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      /* the wedge, annotated once at its widest pre-2020 gap */
      Plot.line([{ x: wp.date, y: wp.gva }, { x: wp.date, y: wp.gdp }], { x: "x", y: "y", stroke: "#878D99", strokeWidth: 1.25 }),
      Plot.dot([{ date: wp.date, value: wp.gva }], { x: "date", y: "value", fill: v.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([{ date: wp.date, value: wp.gdp }], { x: "date", y: "value", fill: g.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: dxDate(wp.date, 12), value: (wp.gdp + wp.gva) / 2 + 3.6 }], { x: "date", y: "value",
        text: () => "the gap is net taxes, " + fmtDate(wp.date), fill: "#878D99", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      /* the FY21 inversion, marked */
      Plot.line([{ x: fy21.gva.date, y: fy21.gdp.value }, { x: fy21.gva.date, y: fy21.gva.value }], { x: "x", y: "y", stroke: "#878D99", strokeWidth: 1.25, strokeDasharray: "2,3" }),
      Plot.text([{ date: dxDate(fy21.gva.date, 12), value: (fy21.gdp.value + fy21.gva.value) / 2 - 5.5 }], { x: "date", y: "value",
        text: () => "FY21: subsidies surge, GDP below GVA", fill: "#878D99", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === g ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === g ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  a11y(plot, "Real GDP and real GVA growth, year-on-year, Q1 FY17 to Q2 FY26",
    "Two line charts on one axis. GDP ends at " + lastG.value.toFixed(2) + " per cent and GVA at " + lastV.value.toFixed(2) + ". The gap between the lines is net taxes; it is widest before 2020 in " + fmtDate(wp.date) + " and inverts in Q4 FY21, when GVA grew faster than GDP.");
  document.getElementById("plot-gg").append(plot);
  wireTools(document.getElementById("cb-gg"), plot, seriesList, "india-atlas_learn_gdp-vs-gva_fy17-fy26", fmtDate);
  addCrosshair(document.getElementById("plot-gg"), plot, seriesList, geo, fmtDate);
}
