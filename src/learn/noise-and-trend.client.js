// Learn № 19 · Noise and trend — CPI y/y (thick vermilion) against m/m
// (thin grey, computed from published levels), 2021-01..2025-12, with the
// July 2023 spike annotated as weather.
// Data: data/series/cpi.json (baked y/y) + data/raw/cpi-indices.json (levels).

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
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = '<span class="pc">%</span>';
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);

/* window: Jan 2021 to Dec 2025 */
const W0 = new Date(Date.UTC(2021, 0, 1)), W1 = new Date(Date.UTC(2025, 11, 1));
const yoy = S.headline.data.filter((d) => d.date >= W0 && d.date <= W1);

/* m/m computed from published levels, one step back for the first window month */
const lv = levelsFlat.published_headline;
const keys = Object.keys(lv).sort();
const mom = yoy.map((d) => {
  const k = d.date.toISOString().slice(0, 7);
  const prev = keys[keys.indexOf(k) - 1];
  return { date: d.date, value: (lv[k] / lv[prev] - 1) * 100 };
});

/* the spike that reversed: max m/m in the window (Jul 2023) */
let spike = mom[0], si = 0;
mom.forEach((d, i) => { if (d.value > spike.value) { spike = d; si = i; } });
const rev1 = mom[si + 1], rev2 = mom[si + 2];
const yAt = (dt) => yoy.find((d) => d.date.getTime() === dt.getTime());
const y0 = yAt(new Date(Date.UTC(2023, 5, 1))), y1 = yAt(spike.date), y2 = yAt(rev2.date);
const lastY = yoy.at(-1);

const yoyS = { name: "cpi_yoy_pct", label: "Inflation, y/y", color: "#BE3E26", data: yoy };
const momS = { name: "cpi_mom_pct", label: "Month-on-month", color: "#A8A293", data: mom };

/* ---------- figure slots ---------- */
const sgn = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1);
setTxt("pv-nt", lastY.value.toFixed(2) + "%");
setTxt("pf-nt", bundle.meta.vintage);
setHTML("n-spike", "+" + spike.value.toFixed(1) + pc);
setHTML("n-rev1", sgn(rev1.value) + pc);
setHTML("n-rev2", sgn(rev2.value) + pc);
setHTML("n-yoy", "+" + lastY.value.toFixed(2) + pc);
setTxt("c-spike", spike.value.toFixed(1) + " per cent");
setTxt("c-rev1", sgn(rev1.value) + " per cent");
setTxt("c-rev2", sgn(rev2.value) + " per cent");
setTxt("c-y0", y0.value.toFixed(1));
setTxt("c-y1", y1.value.toFixed(1));
setTxt("c-y2", y2.value.toFixed(1));

/* ---------- the plate ---------- */
{
  const geo = { W: 1184, H: 480, ml: 70, mr: 150, mt: 30, mb: 48, d0: -3, d1: 9 };
  const xTicks = []; for (let y = 2021; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-2, 0, 2, 4, 6, 8];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [W0, W1] },
    y: { label: "↑ per cent · grey: m/m · vermilion: y/y", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.lineY(mom, { x: "date", y: "value", stroke: "#A8A293", strokeWidth: 1.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(yoy, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      /* the spike and its reversal */
      Plot.dot([spike], { x: "date", y: "value", fill: "#5B564B", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([spike], { x: "date", y: "value", text: () => "+" + spike.value.toFixed(1) + "% · " + fmtDate(spike.date) + " · weather, not climate", dy: -14, fill: "#5B564B", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([rev1, rev2], { x: "date", y: "value", fill: "#5B564B", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([rev2], { x: "date", y: "value", text: () => "reversed within two months", dy: 22, dx: 10, fill: "#8A857A", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([lastY], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([lastY], { x: "date", y: "value", text: () => lastY.value.toFixed(2) + "% · " + fmtDate(lastY.date), dx: 12, dy: -2, fill: "#BE3E26", fontSize: 13, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text([{ date: new Date(Date.UTC(2022, 9, 1)), value: -2.4 }], { x: "date", y: "value", text: ["the grey line is the weather"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
    ],
  });
  a11y(plot, "CPI inflation, month-on-month and year-on-year, January 2021 to December 2025",
    "Two lines. The thin grey month-on-month line swings between " + Math.min(...mom.map((d) => d.value)).toFixed(1) + " and +" + spike.value.toFixed(1) + " per cent; the thick vermilion year-on-year line moves slowly between " + Math.min(...yoy.map((d) => d.value)).toFixed(1) + " and " + Math.max(...yoy.map((d) => d.value)).toFixed(1) + ". The July 2023 monthly spike of " + spike.value.toFixed(1) + " per cent reversed within two months.");
  document.getElementById("plot-nt").append(plot);
  wireTools(document.getElementById("cb-nt"), plot, [yoyS, momS], "india-atlas_learn_noise-and-trend_cpi-mom-yoy_2021-2025", fmtDate);
  addCrosshair(document.getElementById("plot-nt"), plot, [yoyS, momS], geo, fmtDate);
}
