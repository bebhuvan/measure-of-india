// Learn № 04 · Core inflation — core (dashed, grey) vs headline (blue), 2016–2025.
// Rate: data/series/cpi.json (baked y/y bundle; core computed upstream from group indices).

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/cpi.json";
import { MONO as mono, hydrate, wireTools, a11y, addCrosshair, dodgeEndLabels } from "../charts/plumbing.js";

const S = hydrate(bundle);
const dates = S.headline.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const setTxt = (id, t) => (document.getElementById(id).textContent = t);

const h = S.headline, c = S.core;
const hNow = h.data.at(-1), cNow = c.data.at(-1);
const cMin = c.data.reduce((a, d) => (d.value < a.value ? d : a));
const cMax = c.data.reduce((a, d) => (d.value > a.value ? d : a));
const gap = cNow.value - hNow.value;

/* ---------- figure slots ---------- */
setTxt("pv-core", cNow.value.toFixed(2) + "%");
setTxt("pf-core", bundle.meta.vintage);
setTxt("ev-cmin", cMin.value.toFixed(1) + " per cent");
setTxt("ev-cmax", cMax.value.toFixed(1) + " per cent");
setTxt("ex-hdec", hNow.value.toFixed(2) + "%");
setTxt("ex-cdec", cNow.value.toFixed(2) + "%");
setTxt("ex-gap", gap.toFixed(1) + " points");
setTxt("mr3-h", hNow.value.toFixed(2) + "%");
setTxt("mr3-c", cNow.value.toFixed(2) + "%");
setTxt("mr3-gap", gap.toFixed(1) + " points");

/* ---------- plate : core vs headline ---------- */
{
  const geo = { W: 1184, H: 480, ml: 70, mr: 150, mt: 30, mb: 48, d0: 0, d1: 9 };
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [0, 2, 4, 6, 8];
  const endGap = (geo.d1 - geo.d0) * 0.05;
  const dodged = dodgeEndLabels([
    { label: "Headline", color: "#2E4BD8", data: h.data },
    { label: "Core", color: "#5F6675", data: c.data },
  ], endGap);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()), domain: [dates[0], dates.at(-1)] },
    y: { label: "↑ inflation · year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => d + "%", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F4F6FD" }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleY([4], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ date: new Date(Date.UTC(2022, 1, 10)), value: 3.5 }], { x: "date", y: "value", text: ["RBI target, 4%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ date: dates[2], value: 6.5 }], { x: "date", y: "value", text: ["Tolerance band, 2–6%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.lineY(c.data, { x: "date", y: "value", stroke: "#5F6675", strokeWidth: 2.25, strokeDasharray: "6,4", strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(h.data, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([hNow], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([cNow], { x: "date", y: "value", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text(dodged, {
        x: () => dates.at(-1), y: "y",
        text: (d) => d.s.label + ", " + d.s.data.at(-1).value.toFixed(2) + "%",
        dx: 14, textAnchor: "start", fontSize: 12, fontFamily: mono, fontWeight: 500,
        fill: "#161A22",
      }),
      Plot.text([{ date: new Date(Date.UTC(2020, 8, 1)), value: 1.6 }], {
        x: "date", y: "value",
        text: ["the 2025 wedge: the average is held down by volatile items"],
        fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start",
      }),
    ],
  });
  a11y(plot, "Core and headline CPI inflation, year-on-year, 2016 to 2025",
    "Line chart. The dashed grey core line ends at 4.63 per cent in December 2025 while the blue headline ends at 1.34 per cent, a wedge of 3.3 points. Core ranged between 3.1 and 7.0 per cent across the decade; the shaded band marks the RBI tolerance range of 2 to 6 per cent.");
  document.getElementById("plot-core").append(plot);
  wireTools(document.getElementById("cb-core"), plot, [
    { name: "headline_cpi_yoy_pct", data: h.data },
    { name: "core_cpi_yoy_pct_computed", data: c.data },
  ], "india-atlas_learn_core-inflation_2016-2025", fmtDate);
  addCrosshair(document.getElementById("plot-core"), plot, [
    { label: "Headline, y/y", color: "#2E4BD8", data: h.data },
    { label: "Core, y/y", color: "#5F6675", data: c.data },
  ], geo, fmtDate);
}
