// Guide 16, house prices: plates and number wiring.
// Three rulers, never joined: BIS residential property prices (bis-property*, scripts/lib/products/bis.mjs),
// the RBI house price index by city (housing-rbi-*, rbihpi.mjs) and NHB RESIDEX (housing-residex-*,
// residex.mjs). Quarters dated at their first month. Year-on-year changes for the RBI all-India and
// RESIDEX series are computed here within each base (index / index four quarters earlier).

import * as Plot from "@observablehq/plot";
import propB from "../../data/series/bis-property.json";
import citiesB from "../../data/series/bis-property-cities.json";
import cities10B from "../../data/series/bis-property-10cities.json";
import rbi22 from "../../data/series/housing-rbi-2022.json";
import rbi22y from "../../data/series/housing-rbi-2022-yoy.json";
import rbi10 from "../../data/series/housing-rbi-2010.json";
import rx18 from "../../data/series/housing-residex-2018.json";
import rx25 from "../../data/series/housing-residex-2025.json";
import rxp25 from "../../data/series/housing-residex-prices-2025.json";
import usa from "../../data/series/bis-peer-usa.json";
import chn from "../../data/series/bis-peer-chn.json";
import emu from "../../data/series/bis-peer-emu.json";
import gbr from "../../data/series/bis-peer-gbr.json";
import jpn from "../../data/series/bis-peer-jpn.json";
import kor from "../../data/series/bis-peer-kor.json";
import idn from "../../data/series/bis-peer-idn.json";
import bra from "../../data/series/bis-peer-bra.json";
import zaf from "../../data/series/bis-peer-zaf.json";
import mex from "../../data/series/bis-peer-mex.json";
import tur from "../../data/series/bis-peer-tur.json";
import aus from "../../data/series/bis-peer-aus.json";
import can from "../../data/series/bis-peer-can.json";
import { MONO as sans, hydrate, a11y, addCrosshair, spark, wireTools, downloadSVG, downloadPNG, saveBlob, fmt, seamMarks, seamOverlap } from "../charts/plumbing.js";

const P = hydrate(propB);
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const lastPt = (s) => s.data.filter((d) => d.value != null).at(-1);
const last = (s) => lastPt(s).value;
const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const qlab = (d) => { const iso = d instanceof Date ? d.toISOString() : d; const m = +iso.slice(5, 7) - 1; return `${M3[m]} to ${M3[m + 2]} ${iso.slice(0, 4)}`; };
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yr = (y) => new Date(Date.UTC(y, 0, 1));
const xYears = (ys) => ({ label: null, tickSize: 0, tickPadding: 10, ticks: ys.map(yr), tickFormat: (d) => String(d.getUTCFullYear()) });
const sgn = (v, dp = 1) => (+Math.abs(v).toFixed(dp) === 0 ? "" : v < 0 ? "−" : "+") + Math.abs(v).toFixed(dp) + "%";
const pctV = (v) => (v == null ? "—" : sgn(v));
/** y/y within one series (index four quarters back), as {date, value} points */
const yoyOf = (s) => s.data.map((d, i) => ({ date: d.date, value: i >= 4 && d.value != null && s.data[i - 4].value != null ? (d.value / s.data[i - 4].value - 1) * 100 : null }));
// city names come from the sources (NHB serves them over the wire): escape before any innerHTML
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cityName = (label) => label.split(",")[0].replace(/ \(.*\)$/, "");
function wireCustom(id, plot, filename, csv) {
  const el = document.getElementById(id);
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
function hbars(id, rows, { x0 = 0, x1, ticks, tickFmt, label, valueFmt, hl, rowH = 30, mr = 120, ml = 190 }) {
  const plot = Plot.plot({ width: W, height: 44 + rows.length * rowH, marginLeft: ml, marginRight: mr, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [x0, x1], ticks, tickFormat: tickFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [Plot.gridX(ticks.filter((t) => t !== 0), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x1: 0, x2: "v", fill: (d) => (hl(d) ? ACC : G3), insetTop: rowH > 26 ? 7 : 5, insetBottom: rowH > 26 ? 7 : 5 }),
      Plot.text(rows.filter((r) => r.v >= 0), { y: "name", x: "v", text: (d) => valueFmt(d), dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.text(rows.filter((r) => r.v < 0), { y: "name", x: "v", text: (d) => valueFmt(d), dx: -8, textAnchor: "end", fill: INK, fontSize: 12.5, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE })] });
  document.getElementById(id).append(plot);
  return plot;
}

/* ---------- shared derived figures ---------- */
const LQ = propB.dates.at(-1);
const C18 = hydrate(citiesB).cities_18, C10 = hydrate(cities10B).cities_10;
const rbiYoy = yoyOf(C18), rbi10Yoy = yoyOf(C10);
const X18 = hydrate(rx18), X25 = hydrate(rx25);
const rx18Yoy = yoyOf(X18.india_hfc), rx25Yoy = yoyOf(X25.india_hfc);
const lastYoy = (arr) => arr.filter((d) => d.value != null).at(-1);
const rxLast = lastYoy(rx25Yoy) ?? lastYoy(rx18Yoy);

/* ---------- title block ---------- */
setHTML("m-latest", qlab(LQ));
setHTML("u-reading", `BIS, ${qlab(LQ)}`);
setHTML("n-nom", fmt.pct1(last(P.nominal_yoy)));
setHTML("d-nom", `<b>${fmt.pct1(P.nominal_yoy.data.at(-5).value)}</b> a year earlier`);
setHTML("n-real", fmt.pct1(last(P.real_yoy)));
setHTML("d-real", `<b>${fmt.pct1(P.real_yoy.data.at(-5).value)}</b> a year earlier`);
setHTML("n-rbi", sgn(lastYoy(rbiYoy).value));
setHTML("d-rbi", `${qlab(lastYoy(rbiYoy).date)}, base 2022-23`);
setHTML("n-rx", sgn(rxLast.value));
setHTML("d-rx", `${qlab(rxLast.date)}, base 2024-25`);
spark("nspark-real", { ...P.real, color: ACC });

/* ---------- § 01 ---------- */
setHTML("rb-real", fmt.pct1(last(P.real_yoy)));
setHTML("rb-nom", fmt.pct1(last(P.nominal_yoy)));

/* ---------- § 02 nominal and real ---------- */
{
  const KEYS = [["nominal", ACC, "Nominal", 2], ["real", GOLD, "Real", 2]];
  const marks = [Plot.gridY([100, 200, 300, 400], { stroke: GRID }), Plot.ruleY([100], { stroke: BASE })];
  for (const [k, c, , w] of KEYS) marks.push(Plot.lineY(P[k].data, { x: "date", y: "value", stroke: c, strokeWidth: w, strokeLinejoin: "round" }));
  for (const [k, c, name] of KEYS) {
    const e = lastPt(P[k]);
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ${d.value.toFixed(1)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }));
  }
  const pk = P.real.data.reduce((a, d) => (d.value != null && d.value > a.value ? d : a), { value: -1 });
  marks.push(Plot.dot([pk], { x: "date", y: "value", fill: "#fff", stroke: GOLD, r: 3.5, strokeWidth: 1.5 }));
  marks.push(Plot.text([pk], { x: "date", y: "value", text: (d) => `Real peak ${d.value.toFixed(1)}`, dy: -14, textAnchor: "middle", fill: INK, fontSize: 12 }));
  marks.push(Plot.text([{ x: yr(2010), y: 100 }], { x: "x", y: "y", text: () => "2010 = 100", dx: 4, dy: 10, textAnchor: "start", fill: MUTED, fontSize: 11.5 }));
  const plot = Plot.plot({ width: W, height: 440, marginLeft: 44, marginRight: 130, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([2009, 2012, 2015, 2018, 2021, 2024, 2026]),
    y: { label: "index, 2010 = 100", labelAnchor: "top", labelArrow: false, domain: [50, 400], ticks: [100, 200, 300, 400], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) }, marks });
  a11y(plot, "India's house prices, nominal and real, index 2010 = 100", `In ${qlab(LQ)} the nominal index stood at ${last(P.nominal).toFixed(1)} and the real index at ${last(P.real).toFixed(1)}; the real index peaked at ${pk.value.toFixed(1)} in ${qlab(pk.date)}.`);
  document.getElementById("plot-nr").append(plot);
  const series = KEYS.map(([k, c, name]) => ({ ...P[k], label: name, color: c }));
  addCrosshair(document.getElementById("plot-nr"), plot, series, null, qlab, (v) => (v == null ? "—" : v.toFixed(1)));
  wireTools(document.getElementById("cb-nr"), plot, series, "india-atlas_house-prices-nominal-real");
  setHTML("pv-nr", last(P.real).toFixed(1));
  setHTML("ex-nr-nom", last(P.nominal).toFixed(1));
  setHTML("ex-nr-x", fmt.x1(last(P.nominal) / 100));
  setHTML("ex-nr-real", last(P.real).toFixed(1));
  setHTML("ex-nr-below", fmt.pct1((1 - last(P.real) / pk.value) * 100));
  setHTML("ex-nr-pk", pk.value.toFixed(1));
  setHTML("ex-nr-pkq", qlab(pk.date));
}

/* ---------- § 02 change on a year ago ---------- */
{
  const KEYS = [["nominal_yoy", ACC, "Nominal"], ["real_yoy", GOLD, "Real"]];
  const marks = [Plot.gridY([-10, 10, 20, 30], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [k, c] of KEYS) marks.push(Plot.lineY(P[k].data, { x: "date", y: "value", stroke: c, strokeWidth: 2, strokeLinejoin: "round" }));
  for (const [k, c, name] of KEYS) {
    const e = lastPt(P[k]);
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ${sgn(d.value)}`, dx: 10, dy: k === "nominal_yoy" ? -6 : 6, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }));
  }
  const plot = Plot.plot({ width: W, height: 400, marginLeft: 44, marginRight: 130, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([2010, 2013, 2016, 2019, 2022, 2026]),
    y: { label: "% change on a year ago", labelAnchor: "top", labelArrow: false, domain: [-10, 30], ticks: [-10, 0, 10, 20, 30], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" : "") + Math.abs(v) }, marks });
  a11y(plot, "India's house prices, change on a year ago, nominal and real", `Nominal ${sgn(last(P.nominal_yoy))}, real ${sgn(last(P.real_yoy))} in ${qlab(LQ)}.`);
  document.getElementById("plot-yoy").append(plot);
  const series = KEYS.map(([k, c, name]) => ({ ...P[k], label: name, color: c }));
  addCrosshair(document.getElementById("plot-yoy"), plot, series, null, qlab, pctV);
  wireTools(document.getElementById("cb-yoy"), plot, series, "india-atlas_house-prices-change");
  const since = P.real_yoy.data.filter((d) => d.value != null && d.date >= new Date(Date.UTC(2019, 3, 1)));
  // the title is the current run of the real line: how long prices have run ahead of (or behind) inflation
  const ry = P.real_yoy.data.filter((d) => d.value != null);
  let k = ry.length - 1; const up = ry[k].value >= 0;
  while (k > 0 && (ry[k - 1].value >= 0) === up) k--;
  const run = ry.length - k, runFrom = qlab(ry[k].date);
  setHTML("h-yoy", run >= 4
    ? `Since ${runFrom}, house prices have risen ${up ? "faster" : "more slowly"} than inflation every quarter${ry.slice(k).every((d) => Math.abs(d.value) < 4) ? ", but only just" : ""}`
    : `House prices ${up ? "have edged ahead of" : "have fallen behind"} inflation again in the last ${run === 1 ? "quarter" : run + " quarters"}`);
  setHTML("pv-yoy", fmt.pct1(last(P.real_yoy)));
  setHTML("ex-y-nom", fmt.pct1(last(P.nominal_yoy)));
  setHTML("ex-y-real", fmt.pct1(last(P.real_yoy)));
  setHTML("ex-y-n", String(since.length));
  setHTML("ex-y-avg", sgn(since.reduce((a, d) => a + d.value, 0) / since.length));
}

/* ---------- § 03 cities: the 2010-11 base ---------- */
{
  const S = hydrate(rbi10);
  const rows = Object.values(S).map((s) => ({ name: cityName(s.label), v: last(s) })).sort((a, b) => b.v - a.v);
  const plot = hbars("plot-cities10", rows, { x1: 450, ticks: [0, 100, 200, 300, 400], tickFmt: (v) => String(v), label: "index, 2010-11 = 100", valueFmt: (d) => d.v.toFixed(0), hl: (d) => d === rows[0] });
  a11y(plot, "RBI house price index by city, base 2010-11", rows.map((r) => `${r.name} ${r.v.toFixed(0)}`).join(", "));
  wireCustom("cb-cities10", plot, "india-atlas_house-prices-10-cities-2010-base", "city,index_2010_11_eq_100,quarter\n" + rows.map((r) => `${r.name},${r.v},${rbi10.dates.at(-1)}`).join("\n"));
  const med = [...rows].sort((a, b) => a.v - b.v);
  setHTML("pv-cities10", rows[0].v.toFixed(0));
  setHTML("ex-c10-top", `${esc(rows[0].name)} ${rows[0].v.toFixed(0)}`);
  setHTML("ex-c10-bot", `${esc(rows.at(-1).name)} ${rows.at(-1).v.toFixed(0)}`);
  setHTML("ex-c10-med", ((med[4].v + med[5].v) / 2).toFixed(0));
}

/* ---------- § 03 cities: the 2022-23 base ---------- */
{
  const S = hydrate(rbi22), Y = hydrate(rbi22y);
  const rows = Object.entries(S).map(([k, s]) => ({ k, name: cityName(s.label), v: last(s), y: last(Y[k]) })).sort((a, b) => b.v - a.v);
  const plot = Plot.plot({ width: W, height: 44 + rows.length * 30, marginLeft: 190, marginRight: 200, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "index, 2022-23 = 100", labelAnchor: "right", labelArrow: false, domain: [0, 180], ticks: [0, 50, 100, 150], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [Plot.gridX([50, 150], { stroke: GRID }),
      Plot.barX(rows, { y: "name", x1: 0, x2: "v", fill: (d) => (d === rows[0] || d === rows.at(-1) ? ACC : G3), insetTop: 7, insetBottom: 7 }),
      Plot.ruleX([100], { stroke: G2, strokeDasharray: "3 3" }),
      Plot.text(rows, { y: "name", x: "v", text: (d) => `${d.v.toFixed(0)}   ${sgn(d.y)} on a year`, dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5 }),
      Plot.ruleX([0], { stroke: BASE })] });
  a11y(plot, "RBI house price index by city, base 2022-23", rows.map((r) => `${r.name} ${r.v.toFixed(0)}, ${sgn(r.y)} on a year`).join("; "));
  document.getElementById("plot-cities").append(plot);
  wireCustom("cb-cities", plot, "india-atlas_house-prices-18-cities", "city,index_2022_23_eq_100,pct_change_on_year,quarter,provisional\n" + rows.map((r) => `${r.name},${r.v},${r.y.toFixed(2)},${rbi22.dates.at(-1)},yes`).join("\n"));
  const ys = [...rows].sort((a, b) => b.y - a.y);
  setHTML("pv-cities", rows[0].v.toFixed(0));
  const below = rows.filter((r) => r.v < 100);
  setHTML("h-cities", `On the new 2022-23 base, ${esc(rows[0].name)} has risen most${below.length === 0 ? " and every city is above its base" : below.length === 1 ? ` and ${esc(below[0].name)} has fallen` : `; ${below.length} cities are below their base`}`);
  setHTML("ex-c-topn", esc(rows[0].name));
  setHTML("ex-c-top", rows[0].v.toFixed(1));
  setHTML("ex-c-botn", esc(rows.at(-1).name));
  setHTML("ex-c-bot", rows.at(-1).v.toFixed(1));
  setHTML("ex-c-up", String(rows.filter((r) => r.y > 0).length));
  setHTML("ex-c-yhi", `${esc(ys[0].name)}, ${sgn(ys[0].y)}`);
  setHTML("ex-c-ylo", `${esc(ys.at(-1).name)}, ${sgn(ys.at(-1).y)}`);
}

/* ---------- § 04 three rulers ---------- */
{
  const lines = [
    { data: P.nominal_yoy.data, c: ACC, name: "BIS", w: 2 },
    { data: rbi10Yoy, c: G1, name: "RBI, 10 cities", w: 1.5 },
    { data: rbiYoy, c: G1, name: "RBI, 18 cities", w: 1.5 },
    { data: rx18Yoy, c: GOLD, name: "RESIDEX, 2017-18 base", w: 1.5 },
    { data: rx25Yoy, c: GOLD, name: "RESIDEX, 2024-25 base", w: 1.5 },
  ];
  // each agency's base change is a seam (data/sources.yml seams): growth inside each base, drawn
  // through the quarters both bases describe, never joined (seamMarks "overlap")
  const marks = [Plot.gridY([-10, 10, 20, 30], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
    Plot.lineY(lines[0].data, { x: "date", y: "value", stroke: lines[0].c, strokeWidth: lines[0].w, strokeLinejoin: "round" }),
    ...seamMarks("overlap", [{ data: rbi10Yoy, color: G1, width: 1.5 }, { data: rbiYoy, color: G1, width: 1.5 }], { text: "RBI: 10 cities end", y: 27 }),
    ...seamMarks("overlap", [{ data: rx18Yoy, color: GOLD, width: 1.5 }, { data: rx25Yoy, color: GOLD, width: 1.5 }], { text: "RESIDEX rebased", y: 21, anchor: "start" })];
  // end labels for the live rulers only; the retired bases (RBI 10 cities, RESIDEX 2017-18) end mid-chart and are named in the legend and the crosshair
  const ends = lines.filter((l) => !/10 cities|2017-18/.test(l.name)).map((l) => ({ l, e: l.data.filter((d) => d.value != null).at(-1) })).filter((x) => x.e);
  // end labels, dodged by value so they never overlap
  const sorted = [...ends].sort((a, b) => b.e.value - a.e.value); let prev = Infinity;
  for (const x of sorted) { x.y = Math.min(x.e.value, prev - 2.6); prev = x.y; }
  for (const x of ends) {
    marks.push(Plot.dot([x.e], { x: "date", y: "value", fill: x.l.c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    marks.push(Plot.text([{ date: x.e.date, value: x.y }], { x: "date", y: "value", text: () => `${x.l.name} ${sgn(x.e.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: x.l.name === "BIS" ? 600 : 400 }));
  }
  const plot = Plot.plot({ width: W, height: 420, marginLeft: 44, marginRight: 230, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { ...xYears([2011, 2014, 2017, 2020, 2023, 2026]), domain: [yr(2010), new Date(Date.UTC(2026, 6, 1))] },
    y: { label: "% change on a year ago", labelAnchor: "top", labelArrow: false, domain: [-10, 30], ticks: [-10, 0, 10, 20, 30], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" : "") + Math.abs(v) }, marks });
  a11y(plot, "Three measures of India's house prices, change on a year ago", ends.map((x) => `${x.l.name} ${sgn(x.e.value)} in ${qlab(x.e.date)}`).join("; "));
  document.getElementById("plot-rulers").append(plot);
  const series = [{ data: P.nominal_yoy.data, label: "BIS", color: ACC, name: "bis_nominal_yoy" }, { data: rbi10Yoy, label: "RBI 10 cities", color: G1, name: "rbi_10_cities_yoy" },
    { data: rbiYoy, label: "RBI 18 cities", color: G1, name: "rbi_18_cities_yoy" }, { data: rx18Yoy, label: "RESIDEX 2017-18", color: GOLD, name: "residex_2018_base_yoy" }, { data: rx25Yoy, label: "RESIDEX 2024-25", color: GOLD, name: "residex_2025_base_yoy" }];
  addCrosshair(document.getElementById("plot-rulers"), plot, series, null, qlab, pctV);
  wireTools(document.getElementById("cb-rulers"), plot, series, "india-atlas_house-prices-three-rulers");
  const latest = [lastYoy(P.nominal_yoy.data), lastYoy(rbiYoy), rxLast].map((d) => d.value);
  setHTML("pv-rulers", (Math.max(...latest) - Math.min(...latest)).toFixed(1) + " pt");
  setHTML("ex-r-bis", `${sgn(latest[0])} (${qlab(lastYoy(P.nominal_yoy.data).date)})`);
  setHTML("ex-r-rbi", `${sgn(latest[1])} (${qlab(lastYoy(rbiYoy).date)})`);
  setHTML("ex-r-rx", `${sgn(latest[2])} (${qlab(rxLast.date)})`);
  const ov = seamOverlap({ data: rbi10Yoy }, { data: rbiYoy });
  setHTML("ex-r-ovn", String(ov.n));
  setHTML("ex-r-ovgap", ov.gap.toFixed(1) + " points");
}

/* ---------- § 05 RESIDEX cities ---------- */
{
  const keys = Object.keys(rx25.series).filter((k) => /_hfc$/.test(k) && k !== "india_hfc");
  const rows = keys.map((k) => { const y = lastYoy(yoyOf(X25[k])); return y && { k, name: cityName(X25[k].label), v: y.value }; }).filter(Boolean).sort((a, b) => b.v - a.v);
  const lo = Math.floor(Math.min(-5, ...rows.map((r) => r.v)) / 5) * 5, hi = Math.ceil(Math.max(...rows.map((r) => r.v)) / 5) * 5 + 5;
  const ticks = []; for (let t = lo; t <= hi; t += 5) ticks.push(t);
  const plot = hbars("plot-rxcities", rows, { x0: lo, x1: hi, ticks, tickFmt: (v) => (v < 0 ? "−" : v > 0 ? "+" : "") + Math.abs(v), label: "% change on a year ago", valueFmt: (d) => sgn(d.v), hl: (d) => d === rows[0] || d === rows.at(-1), rowH: 22, ml: 230, mr: 80 });
  a11y(plot, "NHB RESIDEX, change on a year ago by city", rows.map((r) => `${r.name} ${sgn(r.v)}`).join(", "));
  wireCustom("cb-rxcities", plot, "india-atlas_residex-cities-change", "city,pct_change_on_year,quarter\n" + rows.map((r) => `"${r.name}",${r.v.toFixed(2)},${rx25.dates.at(-1)}`).join("\n"));
  const up = rows.filter((r) => r.v > 0).length;
  setHTML("pv-rxcities", `${up} of ${rows.length}`);
  setHTML("ex-x-up", String(up));
  setHTML("ex-x-n", String(rows.length));
  setHTML("ex-x-top", `${esc(rows[0].name)}, ${sgn(rows[0].v)}`);
  setHTML("ex-x-bot", `${esc(rows.at(-1).name)}, ${sgn(rows.at(-1).v)}`);
  setHTML("ex-x-india", sgn(lastYoy(rx25Yoy).value));
}

/* ---------- § 05 price per square foot ---------- */
{
  const Q = hydrate(rxp25);
  const all = Object.keys(rxp25.series).filter((k) => /_hfc_price$/.test(k)).map((k) => ({ k, name: cityName(Q[k].label), v: last(Q[k]) })).sort((a, b) => b.v - a.v);
  const rows = [...all.slice(0, 20), all.at(-1)];
  const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
  const flat = (v) => (v * 646 >= 1e7 ? "₹" + ((v * 646) / 1e7).toFixed(2) + " crore" : "₹" + ((v * 646) / 1e5).toFixed(0) + " lakh");
  const plot = hbars("plot-price", rows, { x1: 40000, ticks: [0, 10000, 20000, 30000, 40000], tickFmt: (v) => (v ? (v / 1000).toFixed(0) + ",000" : "0"), label: "₹ per sq ft",
    valueFmt: (d) => `${inr(d.v)}, flat ${flat(d.v)}`, hl: (d) => d === rows[0], rowH: 26, ml: 230, mr: 200 });
  a11y(plot, "Average price per square foot by city, NHB RESIDEX", rows.map((r) => `${r.name} ${inr(r.v)}`).join(", "));
  wireCustom("cb-price", plot, "india-atlas_price-per-sq-ft", "city,inr_per_sq_ft,implied_646_sq_ft_flat_inr,quarter\n" + all.map((r) => `"${r.name}",${r.v},${Math.round(r.v * 646)},${rxp25.dates.at(-1)}`).join("\n"));
  const med = [...all].sort((a, b) => a.v - b.v)[Math.floor(all.length / 2)];
  setHTML("pv-price", inr(all[0].v));
  setHTML("ex-p-top", `${esc(all[0].name)}, ${inr(all[0].v)}`);
  setHTML("ex-p-flat", flat(all[0].v));
  setHTML("ex-p-bot", `${esc(all.at(-1).name)}, ${inr(all.at(-1).v)}`);
  setHTML("ex-p-med", `${inr(med.v)} (${esc(med.name)})`);
  setHTML("ex-p-x", fmt.x1(all[0].v / med.v));
}

/* ---------- § 06 compared ---------- */
{
  const PEERS = [["United States", usa], ["China", chn], ["Euro area", emu], ["United Kingdom", gbr], ["Japan", jpn], ["Korea", kor], ["Indonesia", idn],
    ["Brazil", bra], ["South Africa", zaf], ["Mexico", mex], ["Türkiye", tur], ["Australia", aus], ["Canada", can]];
  const lastOf = (b) => { const s = b.series.real_house_prices_yoy; for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return { v: s.data[i], d: b.dates[i] }; return null; };
  const rows = [{ name: "India", v: last(P.real_yoy), d: LQ }, ...PEERS.map(([name, b]) => ({ name, ...lastOf(b) }))].filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const plot = hbars("plot-peers", rows, { x0: -10, x1: 10, ticks: [-10, -5, 0, 5, 10], tickFmt: (v) => (v < 0 ? "−" : v > 0 ? "+" : "") + Math.abs(v), label: "% change on a year ago, real", valueFmt: (d) => sgn(d.v), hl: (d) => d.name === "India", rowH: 28, ml: 160, mr: 90 });
  a11y(plot, "Real house prices, change on a year ago, India and 13 economies", rows.map((r) => `${r.name} ${sgn(r.v)}`).join(", "));
  wireCustom("cb-peers", plot, "india-atlas_real-house-prices-compared", "economy,real_pct_change_on_year,quarter\n" + rows.map((r) => `${r.name},${r.v},${r.d}`).join("\n"));
  const rank = rows.findIndex((r) => r.name === "India") + 1;
  setHTML("pv-peers", `${rank} of ${rows.length}`);
  setHTML("ex-pp-in", sgn(last(P.real_yoy), 2));
  setHTML("ex-pp-rank", `${rank} of ${rows.length}`);
  setHTML("ex-pp-top", `${esc(rows[0].name)}, ${sgn(rows[0].v)}`);
  setHTML("ex-pp-bot", `${esc(rows.at(-1).name)}, ${sgn(rows.at(-1).v)}`);
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", propB.meta.vintage);
setHTML("prov-vintage2", propB.meta.vintage);
