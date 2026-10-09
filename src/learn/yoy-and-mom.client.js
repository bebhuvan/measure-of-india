// Learn № 05 · y/y and m/m — one index, two speeds, 2021–2025.
// y/y: data/series/cpi.json (baked bundle). m/m: computed from
// data/raw/cpi-indices.json (published_headline levels).

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
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, dodgeEndLabels } from "../charts/plumbing.js";

const S = hydrate(bundle);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

/* y/y in the window, and m/m computed from the published levels */
const yy = S.headline.data.filter((d) => d.date >= new Date(Date.UTC(2021, 0, 1)));
const ph = levelsFlat.published_headline;
const ks = Object.keys(ph).filter((k) => k >= "2020-12" && k <= "2025-12").sort();
const mm = [];
for (let i = 1; i < ks.length; i++) {
  mm.push({ date: new Date(ks[i] + "-01T00:00:00Z"), value: (ph[ks[i]] / ph[ks[i - 1]] - 1) * 100 });
}
const mNow = mm.at(-1), yNow = yy.at(-1);
const mMax = mm.reduce((a, d) => (d.value > a.value ? d : a));
const negMonths = mm.filter((d) => d.value < 0).length;
let flips = 0;
for (let i = 1; i < mm.length; i++) if ((mm[i].value > 0) !== (mm[i - 1].value > 0)) flips++;
const yJul23 = yy.find((d) => d.date.toISOString().slice(0, 7) === "2023-07");

/* ---------- figure slots ---------- */
setTxt("pv-ym", yNow.value.toFixed(2) + "%");
setTxt("pf-ym", bundle.meta.vintage);
setTxt("ev-flips", String(flips));
setTxt("ex-mjump", "+" + mMax.value.toFixed(1) + " per cent");
setTxt("ex-yjul", yJul23.value.toFixed(2) + "%");
setHTML("n-ym-mom", "+" + mNow.value.toFixed(1) + pc);
setHTML("n-ym-yoy", yNow.value.toFixed(2) + pc);
setHTML("n-ym-max", "+" + mMax.value.toFixed(1) + pc);
setTxt("n-ym-flips", String(flips));
setTxt("ar-flips", String(flips));
setTxt("mr1-neg", String(negMonths));

/* ---------- plate : the two measures ---------- */
{
  const geo = { W: 1184, H: 460, ml: 70, mr: 150, mt: 30, mb: 48, d0: -2, d1: 8 };
  const xTicks = [2021, 2022, 2023, 2024, 2025].map((y) => new Date(Date.UTC(y, 0, 1)));
  const yTicks = [0, 2, 4, 6, 8];
  const dodged = dodgeEndLabels([
    { label: "y/y", color: "#2E4BD8", data: yy },
    { label: "m/m", color: "#A3A9B4", data: mm },
  ], (geo.d1 - geo.d0) * 0.06);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [yy[0].date, yy.at(-1).date] },
    y: { label: "↑ change in the CPI · per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => d + "%", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.lineY(mm, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(yy, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([mMax], { x: "date", y: "value", fill: "#A3A9B4", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([mMax], { x: "date", y: "value", text: () => "Jul 2023, +" + mMax.value.toFixed(1) + "% in a single month", dx: 8, dy: -14, fill: "#878D99", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([yNow], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([mNow], { x: "date", y: "value", fill: "#A3A9B4", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text(dodged, {
        x: () => yy.at(-1).date, y: "y",
        text: (d) => d.s.label + ", " + (d.value >= 0 ? "+" : "") + d.value.toFixed(2) + "%",
        dx: 12, textAnchor: "start", fontSize: 12, fontFamily: mono, fontWeight: 500,
        fill: "#161A22",
      }),
      Plot.text([{ date: new Date(Date.UTC(2021, 4, 1)), value: -1.55 }], { x: "date", y: "value", text: ["mostly noise"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ date: new Date(Date.UTC(2021, 4, 1)), value: 6.9 }], { x: "date", y: "value", text: ["the signal"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Headline CPI inflation, year-on-year and month-on-month, 2021 to 2025",
    "Line chart. The blue year-on-year line ends at 1.34 per cent in December 2025. The thin grey month-on-month line swings between minus 1.1 and plus 2.9 per cent, changing sign seventeen times across the five years.");
  document.getElementById("plot-ym").append(plot);
  wireTools(document.getElementById("cb-ym"), plot, [
    { name: "headline_cpi_yoy_pct", data: yy },
    { name: "headline_cpi_mom_pct", data: mm },
  ], "india-atlas_learn_yoy-and-mom_2021-2025", fmtDate);
  addCrosshair(document.getElementById("plot-ym"), plot, [
    { label: "y/y", color: "#2E4BD8", data: yy },
    { label: "m/m", color: "#A3A9B4", data: mm },
  ], geo, fmtDate);
}
