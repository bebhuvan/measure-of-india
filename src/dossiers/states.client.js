// Guide 15, state economies: plates and number wiring.
// Data: data/series/states-*.json, baked by scripts/lib/products/states.mjs from MoSPI's
// regional accounts (base 2011-12) and the RBI Handbook of Statistics on Indian States.
// Cross-state plates compare one fiscal year, the latest the fixed panel covers
// (states-spread's last date), so no ranking mixes years; 2025-26, where a state has
// published it, is in the every-state table. Every number on the page is read from the bundles.

import * as Plot from "@observablehq/plot";
import { numWord } from "./precision.js";
import spreadB from "../../data/series/states-spread.json";
import pcB from "../../data/series/states-pcnsdp-current.json";
import pcRealB from "../../data/series/states-pcnsdp-constant.json";
import gsdpB from "../../data/series/states-gsdp-current.json";
import gsdpRealB from "../../data/series/states-gsdp-constant.json";
import growthB from "../../data/series/states-growth-real.json";
import structB from "../../data/series/states-structure.json";
import sharesB from "../../data/series/states-industry-shares.json";
import finB from "../../data/series/states-finances.json";
import { MONO as sans, hydrate, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GREY = "#C9CED6", PALE = "#E4E7EC";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const fy = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const inrR = fmt.inrR;
const lakhCr = (crore) => "₹" + (crore / 1e5).toFixed(1) + " lakh crore";   // review-a: one decimal on a lakh crore figure
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// a state's display name: the label as served, less our own annotations
const nameOf = (s) => s.label.replace(/ \(derived.*\)$/, "").replace(/:.*$/, "");
const SHORT = { "Andaman & Nicobar Islands": "Andaman & Nicobar", "Jammu & Kashmir (UT, from 2019-20)": "J&K (UT)", "Jammu & Kashmir (state, with Ladakh, to 2018-19)": "J&K (state, to 2018-19)" };
const short = (n) => SHORT[n] ?? n;

// the comparison year: the panel's latest (every cross-state plate uses it)
const Y = spreadB.dates.at(-1), YL = fy(Y), Y0 = spreadB.dates[0];
const NEXT = `${+Y.slice(0, 4) + 1}-04-01`;
const at = (b, key, iso) => { const s = b.series[key]; const i = b.dates.indexOf(iso); return s && i >= 0 ? s.data[i] : null; };
const lastOf = (s, dates) => { for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return { i, date: dates[i], value: s.data[i] }; return null; };
// states for cross-state plates: everything but the pre-2019 J&K state series
const STATE_KEYS = Object.keys(pcB.series).filter((k) => k !== "jammu_and_kashmir_state");

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
const csvRow = (cells) => cells.map((c) => (c == null ? "" : /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",");

/* ---------- title block and § 01 ---------- */
const SP = spreadB.series, n = spreadB.dates.length - 1;
const richest = spreadB.meta.richest.at(-1), poorest = spreadB.meta.poorest.at(-1);
setHTML("m-count", String(STATE_KEYS.length));
setHTML("m-latest", `${YL} for ${STATE_KEYS.filter((k) => at(pcB, k, Y) != null).length} of ${STATE_KEYS.length}; 2025-26 for ${STATE_KEYS.filter((k) => at(pcB, k, NEXT) != null).length}`);
setHTML("u-reading", `MoSPI, fixed panel, ${YL}`);
setHTML("n-gap", fmt.x1(SP.gap_current.data[n]));
setHTML("d-gap", `<b>${fmt.x1(SP.gap_current.data[0])}</b> in ${fy(Y0)}`);
spark("nspark-gap", { ...hydrate(spreadB).gap_current, color: ACC });
setHTML("n-rich", inrR(SP.richest_current.data[n]));
setHTML("d-rich", `<b>${short(richest.label)}</b>, ${YL}`);
setHTML("n-poor", inrR(SP.poorest_current.data[n]));
setHTML("d-poor", `<b>${poorest.label}</b>, about ${inrR(SP.poorest_current.data[n] / 365)} a day`);
setHTML("n-grow", fmt.pct1(SP.median_real_growth.data[n]));
setHTML("d-grow", `<b>${YL}</b>, at constant prices`);
setHTML("rb-gap", SP.gap_current.data[n].toFixed(1) + pc("×"));
setHTML("rt-panel", String(spreadB.meta.panel.length));
setHTML("rt-first", fy(Y0));
setHTML("rt-gap0", fmt.x1(SP.gap_current.data[0]));
setHTML("rb-cv", SP.cv_constant.data[n].toFixed(1) + pc("%"));

/* ---------- horizontal bar helper ---------- */
function hbars(id, rows, { x, xMax, xTicks, xFmt, val, hl, extra = [], marginLeft = 190, marginRight = 120, rowH = 26 }) {
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * rowH, marginLeft, marginRight, marginTop: 30, marginBottom: 26, style: baseStyle,
    x: { label: null, domain: [0, xMax], ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8, axis: "top" },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks.slice(1), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x, fill: (d) => (hl(d) ? ACC : d.faint ? PALE : GREY), insetTop: rowH * 0.28, insetBottom: rowH * 0.28 }),
      ...extra,
      Plot.text(rows, { y: "name", x: (d) => Math.max(d[x], d.dot ?? 0), text: val, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  document.getElementById(id).append(plot);
  return plot;
}

/* ---------- § 02 income per person ---------- */
{
  const rows = STATE_KEYS.map((k) => {
    const s = pcB.series[k], v = at(pcB, k, Y), l = lastOf(s, pcB.dates);
    const useLast = v == null;
    return { key: k, name: short(nameOf(s)), v: useLast ? l.value : v, year: useLast ? fy(l.date) : YL, faint: useLast,
      dot: at(pcB, k, Y0), tick: at(pcB, k, NEXT) };
  }).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const top = rows[0], low = rows.at(-1);
  const med = SP.median_current.data[n];
  const hl = (d) => d === top || d === low;
  const plot = hbars("plot-pc", rows, {
    x: "v", xMax: 700000, xTicks: [0, 100000, 200000, 300000, 400000, 500000, 600000, 700000], xFmt: (v) => (v === 0 ? "0" : "₹" + v / 100000 + "L"),
    val: (d) => inrR(d.v) + (d.faint ? `, ${d.year}` : ""), hl,
    extra: [
      Plot.dot(rows.filter((r) => r.dot != null), { y: "name", x: "dot", r: 3.5, fill: "#fff", stroke: MUTED, strokeWidth: 1.25 }),
    ],
  });
  a11y(plot, "Income per person by state", rows.map((r) => `${r.name} ${inrR(r.v)}`).join(", "));
  const ratio = top.v / low.v;
  setHTML("h-pc", `${top.name} produces ${Math.round(ratio)} times as much per person as ${low.name}`);
  setHTML("s-pc-year", YL);
  setHTML("pv-pc", inrR(top.v));
  setHTML("pc-pc", `${top.name}, per person`);
  setHTML("ex-pc-top", `${top.name}, ${inrR(top.v)}`);
  setHTML("ex-pc-low", `${low.name}, ${inrR(low.v)}`);
  setHTML("ex-pc-lowday", inrR(low.v / 365));
  setHTML("ex-pc-med", inrR(med));
  setHTML("ex-pc-n25", numWord(rows.filter((r) => r.tick != null).length, true));
  wirePlate("cb-pc", plot, "india-atlas_states-income-per-person",
    "state,year,per_capita_nsdp_inr_current,per_capita_nsdp_2011_12,per_capita_nsdp_2025_26\n" + rows.map((r) => csvRow([r.name, r.year, r.v, r.dot, r.tick])).join("\n"));
}

/* ---------- § 03 the gap over time ---------- */
{
  const S = hydrate(spreadB);
  const lines = [["gap_constant", "#A3A9B4", 1.5, "At constant prices"], ["gap_current", ACC, 2, "At current prices"]];
  const marks = [Plot.gridY([2, 4, 6, 8, 10, 12, 14], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [k, c, w] of lines) marks.push(Plot.lineY(S[k].data, { x: "date", y: "value", stroke: c, strokeWidth: w, strokeLinejoin: "round", strokeLinecap: "round" }));
  const endC = S.gap_current.data.at(-1), endK = S.gap_constant.data.at(-1), startC = S.gap_current.data[0];
  // end labels: whichever line ends higher is labelled above its dot, the other below
  const hiC = endC.value >= endK.value;
  marks.push(Plot.dot([endC], { x: "date", y: "value", r: 3.5, fill: ACC, stroke: "#fff", strokeWidth: 1.5 }));
  marks.push(Plot.dot([startC], { x: "date", y: "value", r: 3, fill: ACC, stroke: "#fff", strokeWidth: 1.5 }));
  marks.push(Plot.text([endC], { x: "date", y: "value", text: (d) => fmt.x1(d.value) + " current", dx: 10, dy: hiC ? -8 : 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }));
  marks.push(Plot.text([endK], { x: "date", y: "value", text: (d) => fmt.x1(d.value) + " constant", dx: 10, dy: hiC ? 8 : -8, textAnchor: "start", fill: INK, fontSize: 12 }));
  const yrs = spreadB.dates.map((d) => new Date(d + "T00:00:00Z"));
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 44, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: yrs.filter((_, i) => i % 2 === 0), tickFormat: (d) => fy(d.toISOString()) },
    y: { label: "richest ÷ poorest, times", labelAnchor: "top", labelArrow: false, domain: [0, 14], ticks: [0, 2, 4, 6, 8, 10, 12, 14], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks,
  });
  a11y(plot, "Richest state's income per person as a multiple of the poorest's", `From ${fmt.x1(startC.value)} in ${fy(Y0)} to ${fmt.x1(endC.value)} in ${YL} at current prices.`);
  document.getElementById("plot-gap").append(plot);
  addCrosshair(document.getElementById("plot-gap"), plot, lines.map(([k, c, , label]) => ({ ...S[k], label, color: c })), null, (d) => fy(d.toISOString()), (v) => (v == null ? "—" : fmt.x2(v)));
  const g0 = SP.gap_current.data[0], gl = SP.gap_current.data[n];
  setHTML("h-gap", gl < g0 ? "The multiple between the richest and poorest state has narrowed" : "The multiple between the richest and poorest state has widened");
  setHTML("s-gap-n", String(spreadB.meta.panel.length));
  setHTML("pv-gap", fmt.x1(gl));
  setHTML("pc-gap", `${YL}, current prices`);
  setHTML("ex-gap-0", fmt.x1(g0));
  setHTML("ex-gap-l", fmt.x1(gl) + ` in ${YL}`);
  setHTML("ex-cv-0", fmt.pct1(SP.cv_constant.data[0]));
  setHTML("ex-cv-l", fmt.pct1(SP.cv_constant.data[n]));
  setHTML("ex-gap-r0", inrR(SP.richest_current.data[0] - SP.poorest_current.data[0]));
  setHTML("ex-gap-rl", inrR(SP.richest_current.data[n] - SP.poorest_current.data[n]));
  wirePlate("cb-gap", plot, "india-atlas_states-gap",
    "year,richest_over_poorest_current,richest_over_poorest_constant,spread_cv_pct_constant,richest_inr,poorest_inr,median_inr,richest_state,poorest_state\n" +
    spreadB.dates.map((d, i) => csvRow([fy(d), SP.gap_current.data[i], SP.gap_constant.data[i], SP.cv_constant.data[i], SP.richest_current.data[i], SP.poorest_current.data[i], SP.median_current.data[i], spreadB.meta.richest[i].label, spreadB.meta.poorest[i].label])).join("\n"));
}

/* ---------- § 04 size ---------- */
{
  const rows = STATE_KEYS.filter((k) => gsdpB.series[k]).map((k) => {
    const s = gsdpB.series[k], v = at(gsdpB, k, Y), l = lastOf(s, gsdpB.dates);
    const useLast = v == null;
    return { key: k, name: short(nameOf(s)) + (s.derived ? " †" : ""), v: (useLast ? l.value : v) / 1e5, year: useLast ? fy(l.date) : YL, faint: useLast,
      tick: at(gsdpB, k, NEXT) == null ? null : at(gsdpB, k, NEXT) / 1e5 };
  }).sort((a, b) => b.v - a.v);
  const top = rows[0], low = rows.at(-1);
  const plot = hbars("plot-size", rows, {
    x: "v", xMax: 50, xTicks: [0, 10, 20, 30, 40, 50], xFmt: (v) => String(v),
    val: (d) => "₹" + d.v.toFixed(2) + (d.faint ? `, ${d.year}` : ""), hl: (d) => d === top,
  });
  a11y(plot, "Size of each state's economy", rows.map((r) => `${r.name} ₹${r.v.toFixed(2)} lakh crore`).join(", "));
  const same = rows.filter((r) => !r.faint), total = same.reduce((a, r) => a + r.v, 0);
  setHTML("h-size", `${top.name} is the largest economy among the states; the five largest make about ${Math.round((100 * same.slice(0, 5).reduce((a, r) => a + r.v, 0)) / total)}% of the total`);
  setHTML("s-size-year", YL);
  setHTML("pv-size", "₹" + top.v.toFixed(1) + pc(" lakh cr"));
  setHTML("pc-size", `${top.name}, ${YL}`);
  setHTML("ex-size-1", `${rows[0].name}, ${lakhCr(rows[0].v * 1e5)}`);
  setHTML("ex-size-2", `${rows[1].name}, ${lakhCr(rows[1].v * 1e5)}`);
  setHTML("ex-size-3", `${rows[2].name}, ${lakhCr(rows[2].v * 1e5)}`);
  setHTML("ex-size-top5", fmt.pct1((100 * same.slice(0, 5).reduce((a, r) => a + r.v, 0)) / total));
  // the largest economy against the poorest state's (same year, from the panel)
  const poor = rows.find((r) => r.key === spreadB.meta.poorest.at(-1).key);
  setHTML("ex-size-big", top.name);
  setHTML("ex-size-x", fmt.x1(top.v / poor.v));
  setHTML("ex-size-small", poor.name.replace(" †", ""));
  wirePlate("cb-size", plot, "india-atlas_states-gsdp",
    "state,year,gsdp_inr_lakh_crore_current,gsdp_2025_26,built_from_parts\n" + rows.map((r) => csvRow([r.name.replace(" †", ""), r.year, r.v, r.tick, r.name.endsWith("†") ? "yes" : "no"])).join("\n"));
}

/* ---------- § 05 growth ---------- */
// average real growth a year between 2011-12 and Y: the compound rate of the constant-price level
const span = +Y.slice(0, 4) - +Y0.slice(0, 4);
const cagr = (b, k) => { const a = at(b, k, Y0), z = at(b, k, Y); return a != null && z != null && a > 0 ? (Math.pow(z / a, 1 / span) - 1) * 100 : null; };
{
  const rows = STATE_KEYS.filter((k) => !/^jammu_and_kashmir/.test(k) && gsdpRealB.series[k]).map((k) => ({ key: k, name: short(nameOf(gsdpRealB.series[k])) + (gsdpRealB.series[k].derived ? " †" : ""), g: cagr(gsdpRealB, k) }))
    .filter((r) => r.g != null).sort((a, b) => b.g - a.g);
  const med = median(rows.map((r) => r.g));
  const top = rows[0], low = rows.at(-1);
  const xMin = Math.floor(Math.min(0, low.g)), xMax = Math.ceil(top.g + 1);
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 24, marginLeft: 190, marginRight: 80, marginTop: 30, marginBottom: 26, style: baseStyle,
    x: { label: null, domain: [xMin, xMax], tickSize: 0, tickPadding: 8, axis: "top", tickFormat: (v) => v + "%" },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.ruleX([med], { stroke: MUTED, strokeDasharray: "3 3" }),
      Plot.ruleY(rows, { y: "name", x1: xMin, x2: "g", stroke: "#ECEEF2" }),
      Plot.dot(rows, { y: "name", x: "g", r: 4.5, fill: (d) => (d === top ? ACC : "#878D99"), stroke: "#fff", strokeWidth: 1 }),
      Plot.text(rows, { y: "name", x: "g", text: (d) => d.g.toFixed(1) + "%", dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (d === top ? 600 : 400) }),
    ],
  });
  a11y(plot, "Average real growth of GSDP a year by state", rows.map((r) => `${r.name} ${r.g.toFixed(1)}%`).join(", "));
  document.getElementById("plot-growth").append(plot);
  setHTML("h-growth", `${top.name.replace(" †", "")} grew fastest after inflation; ${low.name.replace(" †", "")} slowest`);
  setHTML("s-growth-year", YL);
  setHTML("pv-growth", fmt.pct1(top.g));
  setHTML("pc-growth", `${top.name.replace(" †", "")}, a year`);
  setHTML("ex-gr-top", `${top.name.replace(" †", "")}, ${fmt.pct1(top.g)} a year`);
  setHTML("ex-gr-low", `${low.name.replace(" †", "")}, ${fmt.pct1(low.g)}`);
  setHTML("ex-gr-med", fmt.pct1(med));
  const covid = STATE_KEYS.map((k) => at(growthB, `${k}__gsdp`, "2020-04-01")).filter((v) => v != null);
  setHTML("ex-gr-neg", String(covid.filter((v) => v < 0).length));
  setHTML("ex-gr-negn", String(covid.length));
  wirePlate("cb-growth", plot, "india-atlas_states-real-growth",
    `state,average_real_gsdp_growth_pct_${fy(Y0)}_to_${YL}\n` + rows.map((r) => csvRow([r.name.replace(" †", ""), r.g.toFixed(2)])).join("\n"));
}

/* ---------- § 05 convergence ---------- */
{
  const pts = spreadB.meta.panel.map(({ key }) => ({ key, name: short(nameOf(pcRealB.series[key])), x: at(pcRealB, key, Y0), g: cagr(pcRealB, key) })).filter((p) => p.x != null && p.g != null);
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.g, 0) / pts.length;
  const r = pts.reduce((a, p) => a + (p.x - mx) * (p.g - my), 0) / Math.sqrt(pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) * pts.reduce((a, p) => a + (p.g - my) ** 2, 0));
  const byX = [...pts].sort((a, b) => a.x - b.x), byG = [...pts].sort((a, b) => a.g - b.g);
  const poorest = byX[0], richestP = byX.at(-1);
  // label the two ends of each axis and the four largest economies; the side of each label is
  // chosen by position (Plot ignores function-valued dx), so labels never cross the frame
  const big = ["uttar_pradesh", "maharashtra", "tamil_nadu", "west_bengal"];
  const labelled = [...new Set([poorest, richestP, byG[0], byG.at(-1), ...pts.filter((p) => big.includes(p.key))])];
  const xMax = 300000, gMin = Math.floor(byG[0].g) - 1, gMax = Math.ceil(byG.at(-1).g) + 1;
  const right = labelled.filter((p) => p.x < xMax * 0.7), left = labelled.filter((p) => p.x >= xMax * 0.7);
  const plot = Plot.plot({
    width: W, height: 500, marginLeft: 54, marginRight: 40, marginTop: 30, marginBottom: 40, style: baseStyle,
    x: { label: "income per person in 2011-12, ₹", labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: [0, 50000, 100000, 150000, 200000, 250000, 300000], tickFormat: (v) => (v === 0 ? "0" : "₹" + (v / 1000) + "k"), tickSize: 0, tickPadding: 10 },
    y: { label: "real growth per person, per cent a year", labelAnchor: "top", labelArrow: false, domain: [gMin, gMax], tickSize: 0, tickPadding: 10, tickFormat: (v) => v + "%" },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.dot(pts, { x: "x", y: "g", r: 5, fill: (d) => (labelled.includes(d) ? ACC : "#A3A9B4"), fillOpacity: 0.9, stroke: "#fff", strokeWidth: 1 }),
      Plot.text(right, { x: "x", y: "g", text: "name", dx: 9, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.text(left, { x: "x", y: "g", text: "name", dx: -9, textAnchor: "end", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Income per person in 2011-12 against its growth since", `Correlation ${r.toFixed(2)} across ${pts.length} states. ${poorest.name}: ${inrR(poorest.x)}, ${poorest.g.toFixed(1)}% a year; ${richestP.name}: ${inrR(richestP.x)}, ${richestP.g.toFixed(1)}% a year.`);
  document.getElementById("plot-converge").append(plot);
  setHTML("h-converge", Math.abs(r) < 0.3 ? "Poorer states have not grown clearly faster than richer ones" : r < 0 ? "Poorer states have grown faster per person, but not by much" : "Richer states have grown faster per person");
  setHTML("s-conv-year", YL);
  setHTML("pv-converge", fmt.num2(r).replace("-", "−"));
  setHTML("ex-cv-r", fmt.num2(r).replace("-", "−"));
  setHTML("ex-cv-poor", poorest.name);
  setHTML("ex-cv-poorg", fmt.pct1(poorest.g));
  setHTML("ex-cv-rich", richestP.name);
  setHTML("ex-cv-richg", fmt.pct1(richestP.g));
  wirePlate("cb-converge", plot, "india-atlas_states-convergence",
    `state,income_per_person_${fy(Y0)}_inr,real_growth_per_person_pct_a_year_to_${YL}\n` + pts.map((p) => csvRow([p.name, p.x, p.g.toFixed(2)])).join("\n"));
}

/* ---------- § 06 structure ---------- */
{
  const G = ["agriculture", "industry", "services"], COL = { agriculture: ACC, industry: "#A3A9B4", services: "#DFE2E8" };
  const states = STATE_KEYS.filter((k) => at(structB, `${k}__agriculture`, Y) != null);
  const rows = states.map((k) => ({ key: k, name: short(nameOf(structB.series[`${k}__agriculture`])), ...Object.fromEntries(G.map((g) => [g, at(structB, `${k}__${g}`, Y)])) }))
    .sort((a, b) => b.agriculture - a.agriculture);
  const long = rows.flatMap((r) => G.map((g) => ({ name: r.name, group: g, share: r[g] })));
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 26, marginLeft: 190, marginRight: 20, marginTop: 30, marginBottom: 26, style: baseStyle,
    x: { label: null, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickSize: 0, tickPadding: 8, axis: "top", tickFormat: (v) => v + (v === 100 ? "%" : "") },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    color: { domain: G, range: G.map((g) => COL[g]) },
    marks: [
      Plot.barX(long, { y: "name", x: "share", fill: "group", order: G, insetTop: 6, insetBottom: 6, insetRight: 0.5 }),
      Plot.text(long.filter((d) => d.share >= 7), Plot.stackX({ y: "name", x: "share", order: G, text: (d) => d.share.toFixed(0) + "%", fill: (d) => (d.group === "agriculture" ? "#fff" : INK), fontSize: 11.5, className: "inbar" })),
    ],
  });
  a11y(plot, "Agriculture, industry and services shares by state", rows.map((r) => `${r.name}: farm ${r.agriculture.toFixed(0)}%, industry ${r.industry.toFixed(0)}%, services ${r.services.toFixed(0)}%`).join("; "));
  document.getElementById("plot-structure").append(plot);
  const by = (g) => [...rows].sort((a, b) => b[g] - a[g]);
  setHTML("h-structure", `Farming is ${fmt.pct0(by("agriculture")[0].agriculture)} of ${by("agriculture")[0].name}'s value added and ${fmt.pct1(by("agriculture").at(-1).agriculture)} of ${by("agriculture").at(-1).name}'s`);
  setHTML("s-str-year", YL);
  setHTML("pv-structure", fmt.pct1(by("agriculture")[0].agriculture));
  setHTML("pc-structure", `farm share, ${by("agriculture")[0].name}`);
  setHTML("ex-st-agtop", `${by("agriculture")[0].name}, ${fmt.pct1(by("agriculture")[0].agriculture)}`);
  setHTML("ex-st-aglow", `${by("agriculture").at(-1).name}, ${fmt.pct1(by("agriculture").at(-1).agriculture)}`);
  setHTML("ex-st-intop", `${by("industry")[0].name}, ${fmt.pct1(by("industry")[0].industry)}`);
  setHTML("ex-st-svtop", `${by("services")[0].name}, ${fmt.pct1(by("services")[0].services)}`);
  wirePlate("cb-structure", plot, "india-atlas_states-structure",
    "state,agriculture_pct,industry_pct,services_pct\n" + rows.map((r) => csvRow([r.name, r.agriculture, r.industry, r.services])).join("\n"));
}

/* ---------- § 06 industries heat table ---------- */
{
  const IND = sharesB.meta.industries;
  const SHORTI = { agriculture: "Farming", mining: "Mining", manufacturing: "Manufact.", utilities: "Utilities", construction: "Construct.", trade_hotels: "Trade, hotels", transport_comm: "Transport", financial: "Finance", real_estate: "Real estate", public_admin: "Public admin", other_services: "Other serv." };
  const states = STATE_KEYS.filter((k) => at(sharesB, `${k}__agriculture`, Y) != null);
  const rows = states.map((k) => ({ key: k, name: short(nameOf(sharesB.series[`${k}__agriculture`])) })).sort((a, b) => a.name.localeCompare(b.name));
  const cells = rows.flatMap((r) => IND.map((ind) => ({ name: r.name, ind: SHORTI[ind.key] ?? ind.label, key: ind.key, v: at(sharesB, `${r.key}__${ind.key}`, Y) }))).filter((c) => c.v != null);
  const plot = Plot.plot({
    width: W, height: 70 + rows.length * 24, marginLeft: 190, marginRight: 10, marginTop: 44, marginBottom: 10, style: baseStyle,
    x: { label: null, domain: IND.map((i) => SHORTI[i.key] ?? i.label), axis: "top", tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    color: { type: "linear", domain: [0, 40], range: ["#FFFFFF", "#7F92E6"], clamp: true },
    marks: [
      Plot.cell(cells, { x: "ind", y: "name", fill: "v", inset: 1 }),
      Plot.text(cells, { x: "ind", y: "name", text: (d) => d.v.toFixed(1), fill: INK, fontSize: 11, className: "inbar" }),
    ],
  });
  a11y(plot, "Industry shares of each state's GSVA", `${rows.length} states by ${IND.length} industries, ${YL}.`);
  document.getElementById("plot-industries").append(plot);
  const top = (key) => cells.filter((c) => c.key === key).sort((a, b) => b.v - a.v)[0];
  const mfg = top("manufacturing");
  setHTML("h-industries", `Manufacturing ranges from a sliver to ${fmt.pct0(mfg.v)} of a state's value added, in ${mfg.name}`);
  setHTML("s-ind-year", YL);
  setHTML("pv-industries", fmt.pct1(mfg.v));
  setHTML("pc-industries", `manufacturing, ${mfg.name}`);
  for (const [id, key] of [["ex-in-mfg", "manufacturing"], ["ex-in-min", "mining"], ["ex-in-pub", "public_admin"], ["ex-in-fin", "financial"]]) { const t = top(key); setHTML(id, `${t.name}, ${fmt.pct1(t.v)}`); }
  wirePlate("cb-industries", plot, "india-atlas_states-industry-shares",
    "state," + IND.map((i) => i.key).join(",") + "\n" + rows.map((r) => csvRow([r.name, ...IND.map((i) => at(sharesB, `${r.key}__${i.key}`, Y))])).join("\n"));
}

/* ---------- § 07 finances ---------- */
{
  // the latest year with an actual deficit for most states
  const FY = [...finB.dates].reverse().find((d) => Object.keys(finB.series).filter((k) => k.endsWith("__debt")).filter((k) => at(finB, k, d) != null).length >= 20);
  const rows = Object.keys(finB.series).filter((k) => k.endsWith("__debt") && at(finB, k, FY) != null).map((k) => {
    const st = k.replace(/__debt$/, "");
    return { key: st, name: short(nameOf(finB.series[k])), v: at(finB, k, FY), gfd: at(finB, `${st}__gfd`, FY) };
  }).sort((a, b) => b.v - a.v);
  const top = rows[0], low = rows.at(-1), med = median(rows.map((r) => r.v));
  const plot = hbars("plot-finance", rows, {
    x: "v", xMax: 60, xTicks: [0, 10, 20, 30, 40, 50, 60], xFmt: (v) => v + (v === 60 ? "%" : ""),
    val: (d) => fmt.pct1(d.v) + (d.gfd != null ? `   deficit ${fmt.pct1Minus(d.gfd)}` : ""), hl: (d) => d === top, marginRight: 190,
  });
  a11y(plot, "State government debt as a share of GSDP", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  const end = +FY.slice(0, 4) + 1;
  const gfdTop = [...rows].filter((r) => r.gfd != null).sort((a, b) => b.gfd - a.gfd)[0];
  setHTML("h-finance", `${top.name}'s government owes ${fmt.pct0(top.v)} of its GSDP, ${low.name}'s ${fmt.pct0(low.v)}`);
  setHTML("s-fin-end", String(end));
  setHTML("s-fin-year", fy(FY));
  setHTML("pv-finance", fmt.pct1(top.v));
  setHTML("pc-finance", `${top.name}, debt to GSDP`);
  setHTML("ex-fn-top", `${top.name}, ${fmt.pct1(top.v)}`);
  setHTML("ex-fn-low", `${low.name}, ${fmt.pct1(low.v)}`);
  setHTML("ex-fn-med", fmt.pct1(med));
  setHTML("ex-fn-gfd", `${gfdTop.name}, ${fmt.pct1(gfdTop.gfd)} of GSDP`);
  wirePlate("cb-finance", plot, "india-atlas_states-debt-deficit",
    `state,outstanding_liabilities_pct_gsdp_end_march_${end},gross_fiscal_deficit_pct_gsdp_${fy(FY)}\n` + rows.map((r) => csvRow([r.name, r.v, r.gfd])).join("\n"));
}

/* ---------- § 08 every state, every measure ---------- */
{
  const finY = [...finB.dates].reverse().find((d) => Object.keys(finB.series).filter((k) => k.endsWith("__debt")).filter((k) => at(finB, k, d) != null).length >= 20);
  const keys = Object.keys(pcB.series);
  const data = keys.map((k) => {
    const s = pcB.series[k], l = lastOf(s, pcB.dates);
    const g = gsdpB.series[k], gl = g ? lastOf(g, gsdpB.dates) : null;
    const gr = growthB.series[`${k}__gsdp`], grl = gr ? lastOf(gr, growthB.dates) : null;
    const sl = structB.series[`${k}__agriculture`] ? lastOf(structB.series[`${k}__agriculture`], structB.dates) : null;
    return {
      key: k, name: nameOf(s) + (g?.derived ? " †" : ""), year: l ? fy(l.date) : null, yearSort: l ? +l.date.slice(0, 4) : -1,
      gsdp: gl ? gl.value / 1e5 : null, pc: l?.value ?? null, g: grl?.value ?? null, gYear: grl ? fy(grl.date) : null,
      cagr: k.startsWith("jammu_and_kashmir") ? null : cagr(gsdpRealB, k),
      ag: sl ? at(structB, `${k}__agriculture`, sl.date) : null, ind: sl ? at(structB, `${k}__industry`, sl.date) : null, sv: sl ? at(structB, `${k}__services`, sl.date) : null,
      debt: at(finB, `${k}__debt`, finY), gfd: at(finB, `${k}__gfd`, finY),
    };
  });
  const f = { name: (r) => r.name, year: (r) => r.year ?? "", gsdp: (r) => (r.gsdp == null ? "—" : "₹" + r.gsdp.toFixed(2)), pc: (r) => (r.pc == null ? "—" : inrR(r.pc)),
    g: (r) => (r.g == null ? "—" : fmt.pct1Minus(r.g) + `<small>${r.gYear}</small>`), cagr: (r) => (r.cagr == null ? "—" : fmt.pct1(r.cagr)),
    ag: (r) => (r.ag == null ? "—" : fmt.pct1(r.ag)), ind: (r) => (r.ind == null ? "—" : fmt.pct1(r.ind)), sv: (r) => (r.sv == null ? "—" : fmt.pct1(r.sv)),
    debt: (r) => (r.debt == null ? "—" : fmt.pct1(r.debt)), gfd: (r) => (r.gfd == null ? "—" : fmt.pct1Minus(r.gfd)) };
  const cols = ["name", "year", "gsdp", "pc", "g", "cagr", "ag", "ind", "sv", "debt", "gfd"];
  const body = document.getElementById("st-body");
  const draw = (rows) => { body.innerHTML = rows.map((r) => `<tr>${cols.map((c) => `<td>${f[c](r)}</td>`).join("")}</tr>`).join(""); };
  let sorted = [...data].sort((a, b) => (b.pc ?? -1) - (a.pc ?? -1));
  draw(sorted);
  document.querySelectorAll("#st-table th button").forEach((btn) => btn.addEventListener("click", () => {
    const k = btn.dataset.k, desc = btn.getAttribute("aria-sort") !== "descending";
    document.querySelectorAll("#st-table th button").forEach((b) => b.removeAttribute("aria-sort"));
    btn.setAttribute("aria-sort", desc ? "descending" : "ascending");
    const val = (r) => (k === "name" ? r.name : k === "year" ? r.yearSort : r[k]);
    sorted = [...data].sort((a, b) => {
      const x = val(a), y = val(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      const c = typeof x === "string" ? x.localeCompare(y) : x - y;
      return desc ? -c : c;
    });
    draw(sorted);
  }));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", pcB.meta.vintage);
setHTML("prov-vintage2", pcB.meta.vintage);
