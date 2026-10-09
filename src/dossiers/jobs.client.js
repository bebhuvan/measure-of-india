// Dossier 06 · Jobs — plate definitions and number wiring.
// Data: data/series/plfs-monthly.json + plfs-quarterly.json + plfs-annual.json
// + plfs-cuts.json + plfs-status.json + plfs-earnings.json +
// plfs-education.json, baked at build time by scripts/fetch.mjs.
// The three instruments (monthly, quarterly, annual) are shown side by side
// and never spliced; the quarterly series carries two disclosed gaps
// (Apr–Jun 2019 quarantined cell, Jan–Mar 2025 never published) which break
// the line — the gaps are the story, not a rendering defect. The earnings
// bundle carries three denominators (₹/month, ₹/day, ₹/30 days): the
// month-scale pair share a plate, the day-rate has its own.

import * as Plot from "@observablehq/plot";
import monthlyBundle from "../../data/series/plfs-monthly.json";
import quarterlyBundle from "../../data/series/plfs-quarterly.json";
import annualBundle from "../../data/series/plfs-annual.json";
import cutsBundle from "../../data/series/plfs-cuts.json";
import statesBundle from "../../data/series/plfs-states.json";
import statusBundle from "../../data/series/plfs-status.json";
import earningsBundle from "../../data/series/plfs-earnings.json";
import educationBundle from "../../data/series/plfs-education.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob, seamMarks,
} from "../charts/plumbing.js";

// the deep bundles' slices, embedded at build time by the page (src/dossiers/jobs.data.js)
const JD = JSON.parse(document.getElementById("jobs-data")?.textContent || "{}");
const Q25 = hydrate(JD.q25);

const M = hydrate(monthlyBundle);
const ST = hydrate(statesBundle);
const Q = hydrate(quarterlyBundle);
const A = hydrate(annualBundle);
const CUTS = hydrate(cutsBundle);
const STA = hydrate(statusBundle);
const EARN = hydrate(earningsBundle);
const EDU = hydrate(educationBundle);

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
// the cuts' latest month, spelled out, for descriptions (never typed in)
const CUTS_LATEST = ["January","February","March","April","May","June","July","August","September","October","November","December"][Object.values(CUTS)[0].data.at(-1).date.getUTCMonth()] + " " + Object.values(CUTS)[0].data.at(-1).date.getUTCFullYear();
const QN = { 0: "Jan–Mar", 3: "Apr–Jun", 6: "Jul–Sep", 9: "Oct–Dec" };
const fmtQ = (d) => QN[d.getUTCMonth()] + " " + d.getUTCFullYear();
const fmtAgri = (d) => {
  const y = d.getUTCFullYear();
  return y + "–" + String((y + 1) % 100).padStart(2, "0");
};

/* ---------- numbers ---------- */
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const prev = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const first = (s) => s.data.filter((d) => d.value != null)[0].value;
const pc = '<span class="pc">%</span>';
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
// annual-report figures are published to one decimal / whole rupees
const arrow1 = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt";
const arrowInr = (d) => (d >= 0 ? "▲ +₹" : "▼ −₹") + Math.abs(Math.round(d)).toLocaleString("en-IN");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(2) + "%";
const f1a = (v) => v.toFixed(1) + "%";
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");

setHTML("n-ur", last(M.ur).toFixed(2) + pc);
setHTML("n-lfpr", last(M.lfpr).toFixed(2) + pc);
setHTML("n-fur", last(CUTS.ur_female_urban).toFixed(2) + pc);
setHTML("n-psss", last(A.ur_psss).toFixed(2) + pc);
setHTML("d-ur", `<b>${arrow(last(M.ur) - prev(M.ur))}</b> vs ${fmtDate(M.ur.data.at(-2).date)}`);
setHTML("d-lfpr", `<b>${arrow(last(M.lfpr) - prev(M.lfpr))}</b> vs ${fmtDate(M.lfpr.data.at(-2).date)}`);
setHTML("d-fur", `<b>${arrow(last(CUTS.ur_female_urban) - prev(CUTS.ur_female_urban))}</b> vs ${fmtDate(CUTS.ur_female_urban.data.at(-2).date)}`);
setHTML("d-psss", `<b>${arrow(last(A.ur_psss) - prev(A.ur_psss))}</b> vs ${fmtAgri(A.ur_psss.data.at(-2).date)}`);

setHTML("rb-big", last(M.ur).toFixed(2) + pc);
setHTML("rb-first", first(M.ur).toFixed(2) + pc);
// §01 "current reading" prose is pipeline-generated (pipeline/out/prose-jobs.*.md).

setTxt("pv-annual", f1(last(A.ur_psss)));
setTxt("ex-p0", f1(first(A.ur_psss))); setTxt("ex-p1", f1(last(A.ur_psss)));
setTxt("ex-q0", f1(first(Q.ur))); setTxt("ex-q1", f1(last(Q.ur)));
setTxt("pv-cuts", f1(last(CUTS.ur_female_urban)));
setTxt("ex-fu", f1(last(CUTS.ur_female_urban))); setTxt("ex-mu", f1(last(CUTS.ur_male_urban)));
setTxt("pv-lfpr", f1(last(CUTS.lfpr_female_urban)));
setTxt("ex-fl", f1(last(CUTS.lfpr_female_urban)));

/* ---------- §07 what work is — numbers ---------- */
setTxt("pv-status", f1a(last(STA.self_employed_person)));
setTxt("ex-st-se", f1a(last(STA.self_employed_person)));
setTxt("ex-st-oa", f1a(last(STA.se_own_account_person)));
setTxt("ex-st-hp", f1a(last(STA.se_helper_person)));
setTxt("ex-st-rg", f1a(last(STA.regular_person)));
setTxt("ex-st-cs", f1a(last(STA.casual_person)));
setTxt("ex-st-dse", (last(STA.self_employed_person) - first(STA.self_employed_person)).toFixed(1) + " points");
setTxt("ex-st-dcs", Math.abs(last(STA.casual_person) - first(STA.casual_person)).toFixed(1) + " points");

/* ---------- §08 what work pays — numbers ---------- */
setTxt("pv-pay", inr(last(EARN.regular_person)));
setTxt("ex-pay-rg", inr(last(EARN.regular_male)));
setTxt("ex-pay-rgf", inr(last(EARN.regular_female)));
setTxt("ex-pay-se", inr(last(EARN.self_employed_male)));
setTxt("ex-pay-sef", inr(last(EARN.self_employed_female)));
setTxt("ex-pay-ratio", (last(EARN.regular_male) / last(EARN.self_employed_female)).toFixed(1) + "×");
setTxt("pv-casual", inr(last(EARN.casual_person)));
setTxt("ex-cas-p", inr(last(EARN.casual_person)));
setTxt("ex-cas-m", inr(last(EARN.casual_male)));
setTxt("ex-cas-f", inr(last(EARN.casual_female)));
setTxt("ex-cas-0", inr(first(EARN.casual_person)));
setTxt("ex-cas-r", Math.round((last(EARN.casual_person) / first(EARN.casual_person) - 1) * 100) + "%");
setTxt("ex-cas-mo", inr(26 * last(EARN.casual_person)));

/* ---------- §09 the educated queue — numbers ---------- */
setTxt("pv-edu", f1a(last(EDU.graduate)));
setTxt("ex-edu-g", f1a(last(EDU.graduate)));
setTxt("ex-edu-nl", f1a(last(EDU.not_literate)));
setTxt("ex-edu-x", Math.round(last(EDU.graduate) / last(EDU.not_literate)) + "×");
setTxt("ex-edu-y", f1a(last(EDU.youth_15_29)));
setTxt("ex-edu-all", f1a(last(A.ur_psss)));
setTxt("ex-edu-g0", f1a(first(EDU.graduate)));
setTxt("ex-edu-y0", f1a(first(EDU.youth_15_29)));

/* ---------- register ---------- */
const regRows = [
  [M.ur, "UR, all-India, monthly", "Current weekly status, 15+", "s-acc", fmtDate],
  [M.lfpr, "LFPR, all-India, monthly", "Labour force participation, 15+", "s-g1", fmtDate],
  [M.wpr, "WPR, all-India, monthly", "Worker population ratio, 15+", "s-g2", fmtDate],
  [Q.ur, "UR, urban, quarterly", "CWS, urban, 15+, two disclosed gaps", "s-g3", fmtQ],
  [Q.lfpr, "LFPR, urban, quarterly", "CWS, urban, 15+", "s-g4", fmtQ],
  [A.ur_psss, "UR, annual, usual status", "PS+SS, agriculture years", "s-acc", fmtAgri],
  [A.ur_cws, "UR, annual, weekly status", "CWS, agriculture years", "s-g1", fmtAgri],
  // annual-report extras: published to one decimal / whole rupees
  [STA.self_employed_person, "Self-employed share, annual", "PS+SS, share of all workers", "s-g2", fmtAgri, f1a, arrow1],
  [EARN.regular_person, "Regular wage, ₹ per month", "Nominal, annual reports, quarterly grain", "s-acc", fmtQ, inr, arrowInr],
  [EARN.casual_person, "Casual wage, ₹ per day", "Non-public works, annual reports", "s-g3", fmtQ, inr, arrowInr],
  [EDU.graduate, "UR, graduates, annual", "PS+SS, 15+, the educated queue", "s-g4", fmtAgri, f1a, arrow1],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fmt, fv = f1, fd = arrow], i) => {
  const data = s.data.filter((d) => d.value != null);
  const target = data.at(-1).date.getTime() - 365.25 * 86400000;
  let yi = 0, best = Infinity;
  data.forEach((d, j) => { const diff = Math.abs(d.date.getTime() - target); if (diff < best) { best = diff; yi = j; } });
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${fv(data.at(-1).value)}</td>
    <td class="chg">${fd(data.at(-1).value - data.at(-2).value)}, vs ${fmt(data.at(-2).date)}</td>
    <td class="yr">${fv(data[yi].value)}</td>
    <td class="spark" id="sp-j${i}"></td>
  </tr>`;
}).join("");

/* ---------- shared plate renderer ---------- */
function multiLine(blockId, plotId, keys, store, geo, yTicks, xTicks, fmtX, dlName, a11yTitle, a11yDesc, fmtCross = fmtDate, fmtV = (v) => v.toFixed(2) + "%") {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList.filter((s) => s.data.at(-1).value != null), (geo.d1 - geo.d0) * 0.06);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(store[keys[0]].data.filter((d) => d.value != null).slice(-7), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    ...seriesList.filter((s) => s.data.at(-1).value != null).map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.endLabel ?? p.s.label} ${fmtV(p.value)}`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: fmtX },
    y: { label: "↑ per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, seriesList, dlName, fmtCross);
  addCrosshair(document.getElementById(plotId), plot, seriesList, geo, fmtCross, fmtV);
  return plot;
}

/* ---------- shared ₹ plate renderer (annual reports, quarterly grain) ----
 * Same vocabulary as multiLine, but rupee levels: ₹ tick labels, ₹ end
 * labels, ₹ crosshair. Leading nulls are quarantined/late-start cells. */
function moneyPlate(blockId, plotId, keys, store, geo, yTicks, xTicks, tickFmt, yLabel, dlName, a11yTitle, a11yDesc) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList.filter((s) => s.data.at(-1).value != null), (geo.d1 - geo.d0) * 0.06);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    geo.d0 === 0 ? Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(store[keys[0]].data.filter((d) => d.value != null).slice(-5), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    ...seriesList.filter((s) => s.data.at(-1).value != null).map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > (geo.d1 - geo.d0) * 0.002).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${inr(p.value)}`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: yLabel, labelAnchor: "top", labelArrow: false,
         tickFormat: tickFmt, ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, seriesList, dlName, fmtQ);
  addCrosshair(document.getElementById(plotId), plot, seriesList, geo, fmtQ,
    (v) => (v == null ? "not published" : inr(v)));
  return plot;
}

/* ---------- §03 three stopwatches: annual CWS vs usual status ---------- */
{
  A.ur_cws.color = "#5F6675";
  A.ur_psss.color = "#2E4BD8";
  A.ur_cws.label = "Weekly status, CWS";
  A.ur_psss.label = "Usual status, PS+SS";
  A.ur_cws.endLabel = "CWS";
  A.ur_psss.endLabel = "PS+SS";
  const keys = ["ur_psss", "ur_cws"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 230, mt: 30, mb: 48, d0: 2, d1: 10 };
  const xTicks = []; for (let y = 2018; y <= 2023; y++) xTicks.push(new Date(Date.UTC(y, 6, 1)));
  const plot = multiLine("cb-annual", "plot-annual", keys, A, geo, [2, 4, 6, 8, 10], xTicks,
    (d) => String(d.getUTCFullYear()),
    "india-atlas_plfs_annual-stopwatches",
    "All-India unemployment rate on the weekly and the usual status, 2017-18 to 2023-24",
    "Two line charts on one time axis. The weekly status starts at 8.7 per cent and ends at " + last(A.ur_cws).toFixed(1) + " per cent; the usual status starts at " + first(A.ur_psss).toFixed(1) + " and ends at " + last(A.ur_psss).toFixed(1) + ". The gap between them is underemployment. The two are never spliced.",
    fmtAgri);
  wireLegend(document.getElementById("legend-annual"), plot, keys, A);
}

/* ---------- §03 companion: annual LFPR — the seven-year structural story ----------
 * The monthly LFPR plate (§06) is young (monthly bulletin from April 2025). This annual companion
 * runs seven agriculture years and shows the structural rise in participation
 * the monthly view cannot yet see — driven overwhelmingly by rural women. */
{
  A.lfpr_cws.color = "#5F6675";
  A.lfpr_psss.color = "#2E4BD8";
  A.lfpr_cws.label = "LFPR, weekly status";
  A.lfpr_psss.label = "LFPR, usual status";
  A.lfpr_cws.endLabel = "weekly";
  A.lfpr_psss.endLabel = "usual";
  const keys = ["lfpr_psss", "lfpr_cws"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 240, mt: 30, mb: 48, d0: 40, d1: 65 };
  const xTicks = []; for (let y = 2017; y <= 2023; y++) xTicks.push(new Date(Date.UTC(y, 6, 1)));
  setTxt("pv-lfpr-ann", f1(last(A.lfpr_psss)));
  setTxt("ex-lf0", f1(first(A.lfpr_psss)));
  setTxt("ex-lf1", f1(last(A.lfpr_psss)));
  setTxt("ex-lfc0", f1(first(A.lfpr_cws)));
  setTxt("ex-lfc1", f1(last(A.lfpr_cws)));
  setTxt("ex-lf-d", "+" + (last(A.lfpr_psss) - first(A.lfpr_psss)).toFixed(1) + " points");
  const plot = multiLine("cb-lfpr-ann", "plot-lfpr-ann", keys, A, geo, [40, 45, 50, 55, 60, 65], xTicks,
    (d) => String(d.getUTCFullYear()),
    "india-atlas_plfs_annual-lfpr",
    "Labour force participation rate, annual, usual status beside weekly status, 2017-18 to 2023-24",
    "Two rising lines. Usual-status LFPR climbs from " + first(A.lfpr_psss).toFixed(1) + " to " + last(A.lfpr_psss).toFixed(1) + " per cent; weekly-status LFPR from " + first(A.lfpr_cws).toFixed(1) + " to " + last(A.lfpr_cws).toFixed(1) + ".",
    fmtAgri, f1);
  wireLegend(document.getElementById("legend-lfpr-ann"), plot, keys, A);
}

/* ---------- §04 plate 1: the long arc, urban quarterly, two survey designs ----------
 * The original design's urban bulletin (plfs-quarterly, to Oct-Dec 2024) and the revamped
 * design's urban figure (plfs-q25, from Apr-Jun 2025) are two rulers: drawn side by side with
 * seamMarks, never joined (AGENTS.md rule 1). */
{
  const s = Q.ur;
  const neu = Q25.ur_cws__person_urban__a15plus;
  const geo = { W: 1184, H: 520, ml: 70, mr: 200, mt: 36, mb: 48, d0: 0, d1: 24 };
  const yTicks = [0, 5, 10, 15, 20];
  const xTicks = []; for (let y = 2018; y <= neu.data.at(-1).date.getUTCFullYear(); y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const peak = peakOf(s);
  const lastOld = s.data.filter((d) => d.value != null).at(-1), lastNew = neu.data.filter((d) => d.value != null).at(-1);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      // nulls at Apr–Jun 2019 (quarantined) break the old line; the two designs never meet
      ...seamMarks("side", [{ data: s.data, color: "#5F6675", width: 1.75 }, { data: neu.data, color: "#2E4BD8", width: 2.5 }],
        { at: new Date(Date.UTC(2025, 0, 1)), text: "survey redesigned, Jan 2025", y: 15.5, anchor: "end" }),
      Plot.ruleX([peak.date], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: peak.date, value: 22.6 }], { x: "date", y: "value", text: ["lockdown, one urban worker in five"], fontSize: 12.5, fill: "#878D99", fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([lastOld], { x: "date", y: "value", fill: "#5F6675", r: 3, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot(neu.data.filter((d) => d.value != null), { x: "date", y: "value", fill: "#2E4BD8", r: 3, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.text([lastOld], { x: "date", y: "value", text: (d) => `original ${d.value.toFixed(1)}%`, dy: 18, fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "middle" }),
      Plot.text([lastNew], { x: "date", y: "value", text: (d) => `Revamped ${d.value.toFixed(1)}%`, dx: 14, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  const sNew = { ...neu, label: "Urban UR, revamped design", color: "#2E4BD8" };
  const sOld = { ...s, label: "Urban UR, original design", color: "#5F6675" };
  a11y(plot, "Urban unemployment rate, quarterly, current weekly status, two survey designs drawn side by side",
    "The original design's line starts at " + first(Q.ur).toFixed(1) + " per cent in April–June 2018, spikes to " + peak.value.toFixed(1) + " per cent in the April–June 2020 lockdown quarter and ends at " + lastOld.value.toFixed(1) + " per cent in " + fmtQ(lastOld.date) + ". After a gap for the redesign, the revamped design's urban figure runs from " + fmtQ(neu.data[0].date) + " to " + lastNew.value.toFixed(1) + " per cent in " + fmtQ(lastNew.date) + ". April–June 2019 is quarantined.");
  document.getElementById("plot-main").append(plot);
  wireTools(document.getElementById("cb-main"), plot, [sOld, sNew], "india-atlas_plfs_urban-quarterly", fmtQ);
  addCrosshair(document.getElementById("plot-main"), plot, [sOld, sNew], geo, fmtQ,
    (v) => (v == null ? "not published" : v.toFixed(1) + "%"));
  setTxt("pv-main", f1a(lastNew.value));
  setTxt("ex-q25u", f1a(lastNew.value));
}

/* ---------- §06 cuts: four labour markets ---------- */
{
  const V = {
    ur_female_urban: { ...CUTS.ur_female_urban, label: "Urban women", color: "#2E4BD8" },
    ur_male_urban: { ...CUTS.ur_male_urban, label: "Urban men", color: "#5F6675" },
    ur_female_rural: { ...CUTS.ur_female_rural, label: "Rural women", color: "#A3A9B4" },
    ur_male_rural: { ...CUTS.ur_male_rural, label: "Rural men", color: "#878D99" },
  };
  const keys = ["ur_female_urban", "ur_male_urban", "ur_female_rural", "ur_male_rural"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 190, mt: 30, mb: 48, d0: 2, d1: 11 };
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  multiLine("cb-cuts", "plot-cuts", keys, V, geo, [2, 4, 6, 8, 10], xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_plfs_ur-by-gender-sector",
    "Unemployment rate by gender and sector, monthly, April 2025 to " + CUTS_LATEST,
    "Four line charts. Urban women end at " + last(CUTS.ur_female_urban).toFixed(1) + " per cent, urban men at " + last(CUTS.ur_male_urban).toFixed(1) + ", rural women at " + last(CUTS.ur_female_rural).toFixed(1) + ", rural men at " + last(CUTS.ur_male_rural).toFixed(1) + ".");
}

/* ---------- §06 cuts: the participation chasm ---------- */
{
  const V = {
    lfpr_female_urban: { ...CUTS.lfpr_female_urban, label: "Urban women", color: "#2E4BD8" },
    lfpr_male_urban: { ...CUTS.lfpr_male_urban, label: "Urban men", color: "#5F6675" },
    lfpr_female_rural: { ...CUTS.lfpr_female_rural, label: "Rural women", color: "#A3A9B4" },
    lfpr_male_rural: { ...CUTS.lfpr_male_rural, label: "Rural men", color: "#878D99" },
  };
  const keys = ["lfpr_female_urban", "lfpr_male_urban", "lfpr_female_rural", "lfpr_male_rural"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 190, mt: 30, mb: 48, d0: 20, d1: 85 };
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  multiLine("cb-lfpr", "plot-lfpr", keys, V, geo, [20, 30, 40, 50, 60, 70, 80], xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_plfs_lfpr-by-gender-sector",
    "Labour force participation rate by gender and sector, monthly, April 2025 to " + CUTS_LATEST,
    "Four line charts. Rural men end at " + last(CUTS.lfpr_male_rural).toFixed(1) + " per cent, urban men at " + last(CUTS.lfpr_male_urban).toFixed(1) + ", rural women at " + last(CUTS.lfpr_female_rural).toFixed(1) + ", urban women at " + last(CUTS.lfpr_female_urban).toFixed(1) + ": the chasm the plate is about.");
}

/* ---------- §06 cuts: who is actually working (WPR) ----------
 * The third ratio, absent until now. The share of people actually working —
 * the gap between this line and the LFPR line above IS the unemployment rate. */
{
  setTxt("pv-wpr", last(CUTS.wpr_male_urban).toFixed(2) + "%");
  const V = {
    wpr_male_urban: { ...CUTS.wpr_male_urban, label: "Urban men", color: "#5F6675" },
    wpr_male_rural: { ...CUTS.wpr_male_rural, label: "Rural men", color: "#878D99" },
    wpr_female_rural: { ...CUTS.wpr_female_rural, label: "Rural women", color: "#A3A9B4" },
    wpr_female_urban: { ...CUTS.wpr_female_urban, label: "Urban women", color: "#2E4BD8" },
  };
  const keys = ["wpr_male_urban", "wpr_male_rural", "wpr_female_rural", "wpr_female_urban"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 190, mt: 30, mb: 48, d0: 10, d1: 85 };
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  multiLine("cb-wpr", "plot-wpr", keys, V, geo, [10, 30, 50, 70], xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_plfs_wpr-by-gender-sector",
    "Worker population ratio (the share actually working) by gender and sector, monthly, April 2025 to " + CUTS_LATEST,
    "Four line charts. Rural men end at " + last(CUTS.wpr_male_rural).toFixed(1) + " per cent, urban men at " + last(CUTS.wpr_male_urban).toFixed(1) + ", rural women at " + last(CUTS.wpr_female_rural).toFixed(1) + ", urban women at " + last(CUTS.wpr_female_urban).toFixed(1) + ".");
}

/* ---------- §07 what work is: baskets + the status-shares plate ---------- */
{
  const basket = (barId, labId, segs) => {
    document.getElementById(barId).innerHTML = segs.map(([n, w, c]) =>
      `<div class="seg" style="width:${w}%;background:${c}" title="${n}: ${w.toFixed(1)}%"></div>`).join("");
    document.getElementById(labId).innerHTML = segs.map(([n, w, c]) =>
      `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${w.toFixed(1)}%</div></div>`).join("");
  };
  basket("bk-st-bar", "bk-st-labels", [
    ["Status, Self-employed", last(STA.self_employed_person), "#2E4BD8"],
    ["Regular wage/salary", last(STA.regular_person), "#5F6675"],
    ["Casual labour", last(STA.casual_person), "#A3A9B4"],
  ]);
  basket("bk-in-bar", "bk-in-labels", [
    ["Industry, Agriculture & allied", last(STA.industry_primary_person), "#2E4BD8"],
    ["Industry & construction", last(STA.industry_secondary_person), "#5F6675"],
    ["Services", last(STA.industry_tertiary_person), "#A3A9B4"],
  ]);

  const V = {
    self_employed_person: { ...STA.self_employed_person, label: "Self-employed", color: "#2E4BD8" },
    regular_person: { ...STA.regular_person, label: "Regular wage/salary", color: "#5F6675" },
    casual_person: { ...STA.casual_person, label: "Casual labour", color: "#A3A9B4" },
  };
  const keys = ["self_employed_person", "regular_person", "casual_person"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 260, mt: 30, mb: 48, d0: 15, d1: 65 };
  const xTicks = []; for (let y = 2017; y <= 2023; y++) xTicks.push(new Date(Date.UTC(y, 6, 1)));
  const plot = multiLine("cb-status", "plot-status", keys, V, geo, [20, 30, 40, 50, 60], xTicks,
    (d) => String(d.getUTCFullYear()),
    "india-atlas_plfs_worker-status-shares",
    "Share of workers by broad status in employment, usual status, 2017-18 to 2023-24",
    "Three line charts summing to 100 per cent. Self-employment rises from " + first(STA.self_employed_person).toFixed(1) + " to " + last(STA.self_employed_person).toFixed(1) + " per cent of workers; regular wage work edges from " + first(STA.regular_person).toFixed(1) + " to " + last(STA.regular_person).toFixed(1) + "; casual labour falls from " + first(STA.casual_person).toFixed(1) + " to " + last(STA.casual_person).toFixed(1) + ".",
    fmtAgri, f1a);
  wireLegend(document.getElementById("legend-status"), plot, keys, V);
}

/* ---------- §07 companion: status composition by gender ----------
 * The person-level status plate above shows self-employed, regular and casual
 * shares for everyone. This companion splits each status by gender: the same
 * three lines, drawn once for men and once for women, on one scale. The
 * female self-employment line is the headline — it climbs fifteen points in
 * seven years. */
{
  const STATUS_COLORS = { self_employed: "#2E4BD8", regular: "#5F6675", casual: "#A3A9B4" };
  const STATUS_LABELS = [["self_employed", "Self-employed"], ["regular", "Regular wage"], ["casual", "Casual labour"]];
  const xTicks = []; for (let y = 2017; y <= 2023; y++) xTicks.push(new Date(Date.UTC(y, 6, 1)));

  const miniGender = (plotId, gender) => {
    const seriesList = STATUS_LABELS.map(([k, label]) => ({
      ...STA[k + "_" + gender], label, color: STATUS_COLORS[k],
    }));
    const dts = seriesList[0].data.map((d) => d.date);
    const dodged = dodgeEndLabels(seriesList, 2.2);
    const marks = [
      Plot.gridY([20, 30, 40, 50, 60, 70], { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([20], { stroke: "#E3E6EB", strokeWidth: 1 }),
      ...seriesList.slice(1).map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(seriesList[0].data, { x: "date", y: "value", stroke: seriesList[0].color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(1)}%`,
        dx: 12, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
      })),
    ];
    return Plot.plot({
      width: 570, height: 400,
      marginLeft: 56, marginRight: 160, marginTop: 28, marginBottom: 44,
      style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
      x: { label: null, tickSize: 0, tickPadding: 14, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
      y: { label: "↑ per cent", labelAnchor: "top", labelArrow: false,
           tickFormat: (d) => (d === 70 ? d + "%" : String(d)), ticks: [20, 30, 40, 50, 60, 70], domain: [15, 72], tickSize: 0, tickPadding: 11 },
      marks,
    });
  };

  const plotM = miniGender("plot-gender-male", "male");
  a11y(plotM, "Share of male workers by employment status, usual status, 2017-18 to 2023-24",
    "Three lines summing to 100 per cent. Male self-employment holds near " + last(STA.self_employed_male).toFixed(1) + " per cent, regular wage at " + last(STA.regular_male).toFixed(1) + ", casual labour at " + last(STA.casual_male).toFixed(1) + ".");
  document.getElementById("plot-gender-male").append(plotM);

  const plotF = miniGender("plot-gender-female", "female");
  a11y(plotF, "Share of female workers by employment status, usual status, 2017-18 to 2023-24",
    "Three lines summing to 100 per cent. Female self-employment rises from " + first(STA.self_employed_female).toFixed(1) + " to " + last(STA.self_employed_female).toFixed(1) + " per cent, regular wage falls from " + first(STA.regular_female).toFixed(1) + " to " + last(STA.regular_female).toFixed(1) + ", casual labour from " + first(STA.casual_female).toFixed(1) + " to " + last(STA.casual_female).toFixed(1) + ".");
  document.getElementById("plot-gender-female").append(plotF);

  setTxt("pv-gender", last(STA.self_employed_female).toFixed(1) + "%");
  setTxt("ex-g-se-f", last(STA.self_employed_female).toFixed(1) + "%");
  setTxt("ex-g-se-f0", first(STA.self_employed_female).toFixed(1) + "%");
  setTxt("ex-g-se-m", last(STA.self_employed_male).toFixed(1) + "%");
  setTxt("ex-g-rg-f", last(STA.regular_female).toFixed(1) + "%");
  setTxt("ex-g-rg-m", last(STA.regular_male).toFixed(1) + "%");
  setTxt("ex-g-cs-f", last(STA.casual_female).toFixed(1) + "%");
  setTxt("ex-g-cs-m", last(STA.casual_male).toFixed(1) + "%");
  const block = document.getElementById("cb-gender");
  const meta = {
    title: block.querySelector(".plate-head h3")?.textContent.trim(),
    sub: block.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  const dlName = "india-atlas_plfs_status-by-gender";
  block.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      const csv = ["gender,status,year,share_pct",
        ...["male", "female"].flatMap((g) =>
          STATUS_LABELS.map(([k, label]) => STA[k + "_" + g].data.map((d) => `${g},${label.replace(/,/g, "")},${fmtAgri(d.date)},${d.value}`).join("\n"))
        ),
      ].join("\n");
      if (kind === "svg") downloadSVG(plotF, dlName, meta);
      if (kind === "png") downloadPNG(plotF, dlName, meta);
      if (kind === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), dlName + ".csv");
    });
  });
}

/* ---------- §08 what work pays: the salary ladder + the casual day ---------- */
{
  const V = {
    regular_male: { ...EARN.regular_male, label: "Regular · men", color: "#5F6675" },
    regular_female: { ...EARN.regular_female, label: "Regular · women", color: "#878D99" },
    self_employed_male: { ...EARN.self_employed_male, label: "Self-emp · men", color: "#A3A9B4" },
    self_employed_female: { ...EARN.self_employed_female, label: "Self-emp · women", color: "#2E4BD8" },
  };
  const keys = ["regular_male", "regular_female", "self_employed_male", "self_employed_female"];
  const geo = { W: 1184, H: 520, ml: 76, mr: 268, mt: 36, mb: 48, d0: 0, d1: 25000 };
  const yTicks = [0, 5000, 10000, 15000, 20000, 25000];
  const xTicks = []; for (let y = 2018; y <= 2024; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = moneyPlate("cb-pay", "plot-pay", keys, V, geo, yTicks, xTicks,
    (d) => (d === 25000 ? `₹${d / 1000}k` : d === 0 ? `0` : `${d / 1000}k`), "↑ ₹ per month",
    "india-atlas_plfs_earnings-by-status",
    "Average monthly earnings by worker status and gender, 2017-18 to 2023-24",
    "Four line charts of nominal rupees. Regular-wage men end at " + inr(last(EARN.regular_male)) + " a month, regular-wage women at " + inr(last(EARN.regular_female)) + ", self-employed men at " + inr(last(EARN.self_employed_male)) + " per 30 days, self-employed women at " + inr(last(EARN.self_employed_female)) + ". The 2017-18 all-India aggregates are quarantined; those series start in 2018-19.");
  wireLegend(document.getElementById("legend-pay"), plot, keys, V);
}
{
  const V = {
    casual_person: { ...EARN.casual_person, label: "Person", color: "#2E4BD8" },
    casual_male: { ...EARN.casual_male, label: "Men", color: "#5F6675" },
    casual_female: { ...EARN.casual_female, label: "Women", color: "#A3A9B4" },
  };
  const keys = ["casual_person", "casual_male", "casual_female"];
  const geo = { W: 1184, H: 470, ml: 76, mr: 200, mt: 30, mb: 48, d0: 100, d1: 500 };
  const yTicks = [100, 200, 300, 400, 500];
  const xTicks = []; for (let y = 2018; y <= 2024; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = moneyPlate("cb-casual", "plot-casual", keys, V, geo, yTicks, xTicks,
    (d) => (d === 500 ? `₹${d}` : `${d}`), "↑ ₹ per day",
    "india-atlas_plfs_casual-daily-wage",
    "Average daily wage from casual labour, other than public works, 2017-18 to 2023-24",
    "Three line charts of nominal rupees per day. The person line runs from " + inr(first(EARN.casual_person)) + " in July-September 2017 to " + inr(last(EARN.casual_person)) + " in April-June 2024; men end at " + inr(last(EARN.casual_male)) + ", women at " + inr(last(EARN.casual_female)) + ": the lines never touch.");
  wireLegend(document.getElementById("legend-casual"), plot, keys, V);
}

/* ---------- §09 the educated queue: UR by education level ----------
 * Ladder-ordered strip, not value-sorted: the ladder IS the story. Dark dot
 * 2023-24, pale dot 2017-18, blue where the level prints at twice the
 * all-India usual-status rate or more (same rule as the state strip). */
{
  const LEVELS = [
    ["not_literate", "Not literate"],
    ["up_to_primary", "Up to primary"],
    ["middle", "Middle"],
    ["secondary", "Secondary"],
    ["higher_secondary", "Higher secondary"],
    ["diploma", "Diploma/certificate"],
    ["graduate", "Graduate"],
    ["postgraduate", "Postgraduate & above"],
  ];
  const rows = LEVELS.map(([k, name]) => ({
    key: k, name,
    cur: last(EDU[k]),
    start: first(EDU[k]),
  }));
  const aiPsss = last(A.ur_psss);
  const thr = aiPsss * 2;
  const geo = { W: 1184, H: 34 + rows.length * 34 + 46, ml: 200, mr: 84, mt: 34, mb: 46 };
  const xTicks = [0, 5, 10, 15];
  const names = rows.map((r) => r.name);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain: [0, 20], ticks: xTicks, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xTicks[xTicks.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: names, tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleX([aiPsss], { stroke: "#878D99", strokeWidth: 1.25 }),
      Plot.text([{ x: aiPsss }], { x: "x", y: () => names[0], dy: -26, text: () => `All-India, PS+SS ${aiPsss.toFixed(1)}%`, textAnchor: "start", dx: 7, fill: "#5F6675", fontSize: 12, fontFamily: mono }),
      Plot.link(rows, { x1: "start", x2: "cur", y1: "name", y2: "name", stroke: "#C9CED6", strokeWidth: 1 }),
      Plot.dot(rows, { x: "start", y: "name", fill: "#C9CED6", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot(rows, { x: "cur", y: "name", fill: (d) => (d.cur >= thr ? "#2E4BD8" : "#5F6675"), r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{}], { frameAnchor: "top-right", dx: 60, dy: -26, text: () => "2023-24", fill: "#878D99", fontSize: 10.5, fontFamily: mono }),
      Plot.text(rows, { x: () => 20, y: "name", text: (d) => d.cur.toFixed(1), dx: 60, textAnchor: "end", fill: (d) => (d.cur >= thr ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono }),
    ],
  });
  a11y(plot, "Unemployment rate by general education level, usual status, 2023-24 with 2017-18 as pale dots",
    "Eight education rows in ladder order. The rate climbs the ladder: not literate " + rows[0].cur.toFixed(1) +
    " per cent, secondary " + rows[3].cur.toFixed(1) + ", graduate " + rows[6].cur.toFixed(1) +
    ", postgraduate " + rows[7].cur.toFixed(1) + ", around an all-India rate of " + aiPsss.toFixed(1) +
    ". Every level's pale 2017-18 dot sits to the right of its 2023-24 dot: the whole ladder fell.");
  document.getElementById("plot-edu").append(plot);

  // strip CSV: level × year matrix, hand-rolled like the state strip
  const block = document.getElementById("cb-edu");
  const meta = {
    title: block.querySelector(".plate-head h3")?.textContent.trim(),
    sub: block.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  const dlName = "india-atlas_plfs_ur-by-education";
  block.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg") downloadSVG(plot, dlName, meta);
      if (kind === "png") downloadPNG(plot, dlName, meta);
      if (kind === "csv") {
        const yrs = EDU[LEVELS[0][0]].data.map((d) => fmtAgri(d.date));
        const header = ["education_level", ...yrs.map((y) => "ur_psss_" + y)];
        const lines = LEVELS.map(([k, name]) => [
          name.replace(/,/g, ""),
          ...EDU[k].data.map((d) => d.value ?? ""),
        ]);
        saveBlob(new Blob([[header, ...lines].map((l) => l.join(",")).join("\n")], { type: "text/csv" }), dlName + ".csv");
      }
    });
  });
}

/* ---------- §10 states: a country of labour markets ----------
 * Sorted dot strip, latest agriculture year. The usual status (PS+SS, the
 * annual-report headline) sorts the strip; the weekly status (CWS) rides as
 * a paired pale dot on the same row. The two stopwatches are paired, never
 * averaged. The two pre-merger UTs (Dadra & Nagar Haveli; Daman & Diu) end
 * in 2019-20 and are excluded here; the merged UT carries them from 2020-21. */
{
  const STATE_NAMES = {
    andaman_nicobar_islands: "Andaman & Nicobar", andhra_pradesh: "Andhra Pradesh",
    arunachal_pradesh: "Arunachal Pradesh", assam: "Assam", bihar: "Bihar",
    chandigarh: "Chandigarh", chhattisgarh: "Chhattisgarh",
    dadra_nagar_haveli_daman_diu: "DNH & Daman & Diu", delhi: "Delhi", goa: "Goa",
    gujarat: "Gujarat", haryana: "Haryana", himachal_pradesh: "Himachal Pradesh",
    jammu_kashmir: "Jammu & Kashmir", jharkhand: "Jharkhand", karnataka: "Karnataka",
    kerala: "Kerala", ladakh: "Ladakh", lakshadweep: "Lakshadweep",
    madhya_pradesh: "Madhya Pradesh", maharashtra: "Maharashtra", manipur: "Manipur",
    meghalaya: "Meghalaya", mizoram: "Mizoram", nagaland: "Nagaland", odisha: "Odisha",
    puducherry: "Puducherry", punjab: "Punjab", rajasthan: "Rajasthan", sikkim: "Sikkim",
    tamil_nadu: "Tamil Nadu", telangana: "Telangana", tripura: "Tripura",
    uttar_pradesh: "Uttar Pradesh", uttarakhand: "Uttarakhand", west_bengal: "West Bengal",
  };
  // value AT the latest year (not last non-null): the defunct UTs must drop out
  const rows = Object.keys(ST).filter((k) => k.endsWith("_psss"))
    .map((k) => k.slice(0, -5))
    .map((b) => ({
      key: b,
      name: STATE_NAMES[b] || b,
      psss: ST[b + "_psss"].data.at(-1).value,
      cws: ST[b + "_cws"].data.at(-1).value,
      psssPrev: ST[b + "_psss"].data.at(-2).value,
    }))
    .filter((r) => r.psss != null && r.cws != null);
  rows.sort((a, b) => b.psss - a.psss || b.cws - a.cws || a.name.localeCompare(b.name));

  const aiPsss = last(A.ur_psss); // All-India, same agriculture year, annual bundle
  const aiCws = last(A.ur_cws);
  const thr = aiPsss * 2; // disclosed threshold: twice the All-India rate
  const outliers = rows.filter((r) => r.psss >= thr);
  const top = rows[0], bot = rows.at(-1);
  const spread = top.psss - bot.psss;
  const f1s = (v) => v.toFixed(1) + "%";
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

  setTxt("pv-states", spread.toFixed(1) + " pt");
  setTxt("st-max", `${top.name}, ${f1s(top.psss)}`);
  setTxt("st-min", `${bot.name}, ${f1s(bot.psss)}`);
  setTxt("st-spread", spread.toFixed(1) + " points");
  setTxt("st-ai", f1s(aiPsss));
  setTxt("st-kerala", f1s(rows.find((r) => r.key === "kerala").psss));
  setTxt("st-gujarat", f1s(rows.find((r) => r.key === "gujarat").psss));
  setTxt("st-nout", WORDS[outliers.length] || String(outliers.length));

  // movers vs previous year, PS+SS only — never across stopwatches
  const movers = rows.filter((r) => r.psssPrev != null)
    .map((r) => ({ ...r, d: r.psss - r.psssPrev }))
    .sort((a, b) => a.d - b.d);
  const fall = movers[0], rise = movers.at(-1);
  setTxt("st-fall", `${fall.name}, down ${Math.abs(fall.d).toFixed(1)} points to ${f1s(fall.psss)}`);
  setTxt("st-rise", `${rise.name}, up ${rise.d.toFixed(1)} points to ${f1s(rise.psss)}`);

  const geo = { W: 1184, H: 34 + rows.length * 27 + 46, ml: 200, mr: 84, mt: 34, mb: 46 };
  const xTicks = [0, 5, 10, 15];
  const names = rows.map((r) => r.name);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain: [0, 19], ticks: xTicks, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xTicks[xTicks.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: names, tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleX([aiCws], { stroke: "#C9CED6", strokeWidth: 1.25, strokeDasharray: "2,3" }),
      Plot.ruleX([aiPsss], { stroke: "#878D99", strokeWidth: 1.25 }),
      Plot.text([{ x: aiPsss }], { x: "x", y: () => names[0], dy: -26, dx: -7, text: () => `All-India, PS+SS ${aiPsss.toFixed(1)}%`, textAnchor: "end", fill: "#5F6675", fontSize: 12, fontFamily: mono }),
      Plot.text([{ x: aiCws }], { x: "x", y: () => names[0], dy: -26, dx: 7, text: () => `CWS ${aiCws.toFixed(1)}%`, textAnchor: "start", fill: "#878D99", fontSize: 12, fontFamily: mono }),
      Plot.link(rows, { x1: "cws", x2: "psss", y1: "name", y2: "name", stroke: "#C9CED6", strokeWidth: 1 }),
      Plot.dot(rows, { x: "cws", y: "name", fill: "#C9CED6", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot(rows, { x: "psss", y: "name", fill: (d) => (d.psss >= thr ? "#2E4BD8" : "#5F6675"), r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{}], { frameAnchor: "top-right", dx: 60, dy: -26, text: () => "PS+SS", fill: "#878D99", fontSize: 10.5, fontFamily: mono }),
      Plot.text(rows, { x: () => 19, y: "name", text: (d) => d.psss.toFixed(1), dx: 60, textAnchor: "end", fill: (d) => (d.psss >= thr ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono }),
    ],
  });
  a11y(plot, "Unemployment rate by State and Union Territory, 2023-24, usual status beside weekly status",
    "Sorted dot strip of " + rows.length + " States and UTs. " + top.name + " is highest at " + top.psss.toFixed(1) +
    " per cent on the usual status and " + bot.name + " lowest at " + bot.psss.toFixed(1) +
    ": a spread of " + spread.toFixed(1) + " points around the All-India rate of " + aiPsss.toFixed(1) +
    ". Each row pairs the usual-status dot with the same year's weekly-status dot; the two are never averaged.");
  document.getElementById("plot-states").append(plot);

  // downloads: the strip is not a time series, so the CSV is hand-rolled
  // (state × year × both stopwatches) instead of going through wireTools
  const block = document.getElementById("cb-states");
  const meta = {
    title: block.querySelector(".plate-head h3")?.textContent.trim(),
    sub: block.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  const dlName = "india-atlas_plfs_states-ur";
  block.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg") downloadSVG(plot, dlName, meta);
      if (kind === "png") downloadPNG(plot, dlName, meta);
      if (kind === "csv") {
        const yrs = ST[rows[0].key + "_psss"].data.map((d) => fmtAgri(d.date));
        const header = ["state", ...yrs.map((y) => "ur_psss_" + y), ...yrs.map((y) => "ur_cws_" + y)];
        const lines = rows.map((r) => [
          r.name.replace(/,/g, ""),
          ...ST[r.key + "_psss"].data.map((d) => d.value ?? ""),
          ...ST[r.key + "_cws"].data.map((d) => d.value ?? ""),
        ]);
        saveBlob(new Blob([[header, ...lines].map((l) => l.join(",")).join("\n")], { type: "text/csv" }), dlName + ".csv");
      }
    });
  });
}

/* ---------- shared: a sorted dot strip (one row per state or group) ----------
 * Dark dot `a` (blue where hi(row)), pale dot `b`, a hairline between them, a reference rule,
 * the dark value at the right. Labels sit outside the dots (plumbing.js rule 2). The CSV is
 * the rows as drawn. Strips are not time series, so downloads are wired by hand. */
function strip({ blockId, plotId, rows, domain, ticks, tickFmt, ref, refLabel, hi = () => false, fmtV, dlName, csvHeader, a11yTitle, a11yDesc, rowH = 27, ml = 220 }) {
  const geo = { W: 1184, H: 34 + rows.length * rowH + 46, ml, mr: 84, mt: 34, mb: 46 };
  const names = rows.map((r) => r.name);
  const marks = [
    Plot.gridX(ticks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.ruleX([domain[0]], { stroke: "#E3E6EB", strokeWidth: 1 }),
    ref != null ? Plot.ruleX([ref], { stroke: "#878D99", strokeWidth: 1.25 }) : null,
    ref != null ? Plot.text([{ x: ref }], { x: "x", y: () => names[0], dy: -26, dx: 7, text: () => refLabel, textAnchor: "start", fill: "#5F6675", fontSize: 12, fontFamily: mono }) : null,
    Plot.link(rows.filter((r) => r.b != null), { x1: "b", x2: "a", y1: "name", y2: "name", stroke: "#C9CED6", strokeWidth: 1 }),
    Plot.dot(rows.filter((r) => r.b != null), { x: "b", y: "name", fill: "#C9CED6", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1 }),
    Plot.dot(rows, { x: "a", y: "name", fill: (d) => (hi(d) ? "#2E4BD8" : "#5F6675"), r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.text(rows, { x: () => domain[1], y: "name", text: (d) => fmtV(d.a), dx: 60, textAnchor: "end", fill: (d) => (hi(d) ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono }),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain, ticks, tickSize: 0, tickPadding: 12, tickFormat: tickFmt },
    y: { label: null, domain: names, tickSize: 0, tickPadding: 14 },
    marks,
  });
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  const block = document.getElementById(blockId);
  const meta = {
    title: block.querySelector(".plate-head h3")?.textContent.trim(),
    sub: block.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  block.querySelectorAll("[data-dl]").forEach((btn) => btn.addEventListener("click", () => {
    const kind = btn.dataset.dl;
    if (kind === "svg") downloadSVG(plot, dlName, meta);
    if (kind === "png") downloadPNG(plot, dlName, meta);
    if (kind === "csv") saveBlob(new Blob([[csvHeader.join(","), ...rows.map((r) => [r.name.replace(/,/g, ""), r.a ?? "", r.b ?? ""].join(","))].join("\n")], { type: "text/csv" }), dlName + ".csv");
  }));
  return plot;
}
const desc = (rows, k) => [...rows].sort((x, y) => y[k] - x[k] || x.name.localeCompare(y.name));
const pct = (v) => v.toFixed(1);
const nice = (v, step) => Math.ceil(v / step) * step;

/* ---------- §03 the seam: two survey designs, side by side ---------- */
{
  const ay = hydrate(JD.seam.ay), cy = hydrate(JD.seam.cy), c5 = hydrate(JD.seam.cy25);
  const H = "__person_all__a15plus";
  const panel = (plotId, ind, d0, d1, ticks) => {
    // each year is drawn at its middle: an agriculture year (July to June) at January, a
    // calendar year at July, so the redesign rule falls between the two designs' years
    const mid = (s, months) => ({ ...s, data: s.data.map((d) => ({ ...d, date: new Date(Date.UTC(d.date.getUTCFullYear(), d.date.getUTCMonth() + months, 1)) })) });
    const sA = mid(ay[ind + "_psss"], 6), sC = mid(cy[ind + "_psss" + H], 6), sN = mid(c5[ind + "_psss" + H], 6);
    const nNew = sN.data.filter((d) => d.value != null);
    const plot = Plot.plot({
      width: 570, height: 400, marginLeft: 56, marginRight: 150, marginTop: 28, marginBottom: 44,
      style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
      x: { label: null, tickSize: 0, tickPadding: 14, domain: [new Date(Date.UTC(2017, 0, 1)), new Date(Date.UTC(nNew.at(-1).date.getUTCFullYear(), 11, 31))],
           ticks: [2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
           tickFormat: (d) => String(d.getUTCFullYear()) },
      y: { label: ind === "lfpr" ? "↑ participation, per cent" : "↑ unemployment, per cent", labelAnchor: "top", labelArrow: false, domain: [d0, d1], ticks, tickSize: 0, tickPadding: 11,
           tickFormat: (d) => (d === ticks.at(-1) ? d + "%" : String(d)) },
      marks: [
        Plot.gridY(ticks, { stroke: "#F0F2F5", strokeWidth: 1 }),
        ...seamMarks("side", [{ data: sA.data, color: "#A3A9B4", width: 1.5 }, { data: sC.data, color: "#5F6675", width: 1.75 }, { data: sN.data, color: "#2E4BD8", width: 2 }],
          { at: new Date(Date.UTC(2025, 0, 1)), text: "redesign", y: d1 - (d1 - d0) * 0.06, anchor: "end" }),
        Plot.dot(sC.data.filter((d) => d.value != null), { x: "date", y: "value", fill: "#5F6675", r: 3, stroke: "#FFFFFF", strokeWidth: 1 }),
        Plot.dot(nNew, { x: "date", y: "value", fill: "#2E4BD8", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
        Plot.text(nNew.slice(-1), { x: "date", y: "value", text: (d) => `${d.date.getUTCFullYear()} ${d.value.toFixed(1)}%`, dx: 12, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      ],
    });
    a11y(plot, (ind === "lfpr" ? "Participation" : "Unemployment") + " rate, usual status, on three rulers",
      "Agriculture years run from " + first(sA).toFixed(1) + " to " + last(sA).toFixed(1) + " per cent; the original design's calendar years end at " + last(sC).toFixed(1) + "; the revamped design's first year reads " + last(sN).toFixed(1) + ". The rulers are drawn side by side and never joined.");
    document.getElementById(plotId).append(plot);
    return { plot, series: [{ ...sA, label: "Agriculture years, original design" }, { ...sC, label: "Calendar years, original design" }, { ...sN, label: "Calendar year, revamped design" }] };
  };
  const L = panel("plot-seam-l", "lfpr", 45, 65, [45, 50, 55, 60, 65]);
  const U = panel("plot-seam-u", "ur", 0, 7, [0, 2, 4, 6]);
  setTxt("pv-seam", f1a(last(c5["lfpr_psss" + H])));
  const block = document.getElementById("cb-seam");
  const meta = { title: block.querySelector(".plate-head h3")?.textContent.trim(), sub: block.querySelector(".plate-head .sub")?.textContent.trim(), foot: block.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  block.querySelectorAll("[data-dl]").forEach((btn) => btn.addEventListener("click", () => {
    const kind = btn.dataset.dl;
    if (kind === "svg") downloadSVG(L.plot, "india-atlas_plfs_two-designs", meta);
    if (kind === "png") downloadPNG(L.plot, "india-atlas_plfs_two-designs", meta);
    if (kind === "csv") {
      const lines = ["indicator,ruler,period,value"];
      for (const [ind, P] of [["lfpr_psss", L], ["ur_psss", U]]) for (const s of P.series) for (const d of s.data) if (d.value != null)
        lines.push(`${ind},${s.label.replace(/,/g, "")},${s.label.startsWith("Agri") ? fmtAgri(d.date) : d.date.getUTCFullYear()},${d.value}`);
      saveBlob(new Blob([lines.join("\n")], { type: "text/csv" }), "india-atlas_plfs_two-designs.csv");
    }
  }));
}

/* ---------- §04 the whole country, quarter by quarter (revamped design) ---------- */
{
  const V = {
    ur_cws__person_all__a15plus: { ...Q25.ur_cws__person_all__a15plus, label: "All India", color: "#2E4BD8" },
    ur_cws__person_urban__a15plus: { ...Q25.ur_cws__person_urban__a15plus, label: "Urban", color: "#5F6675" },
    ur_cws__person_rural__a15plus: { ...Q25.ur_cws__person_rural__a15plus, label: "Rural", color: "#A3A9B4" },
  };
  const keys = Object.keys(V);
  const geo = { W: 1184, H: 420, ml: 70, mr: 190, mt: 30, mb: 48, d0: 0, d1: 8 };
  const xTicks = V[keys[0]].data.map((d) => d.date);
  const plot = multiLine("cb-q25", "plot-q25", keys, V, geo, [0, 2, 4, 6, 8], xTicks, fmtQ,
    "india-atlas_plfs_quarterly-rural-urban",
    "Unemployment rate, quarterly, rural, urban and all India, revamped design",
    "Three short lines. Urban ends at " + last(V.ur_cws__person_urban__a15plus).toFixed(1) + " per cent, all India at " + last(V.ur_cws__person_all__a15plus).toFixed(1) + ", rural at " + last(V.ur_cws__person_rural__a15plus).toFixed(1) + ".",
    fmtQ, f1a);
  wireLegend(document.getElementById("legend-q25"), plot, keys, V);
  setTxt("pv-q25", f1a(last(V.ur_cws__person_all__a15plus)));
  setTxt("ex-q25a", f1a(last(V.ur_cws__person_all__a15plus)));
  setTxt("ex-q25r", f1a(last(V.ur_cws__person_rural__a15plus)));
  setTxt("ex-q25ub", f1a(last(V.ur_cws__person_urban__a15plus)));
  setTxt("ex-q25l", f1a(last(Q25.lfpr_cws__person_all__a15plus)));
}

/* ---------- §04 young people's unemployment by state (revamped design, latest quarter) ---------- */
{
  const rows = desc(JD.youthStates.map((r) => ({ name: r.name, a: r.y, b: r.all })), "a");
  const d1 = nice(Math.max(...rows.map((r) => r.a)) + 2, 5);
  const ticks = []; for (let t = 0; t <= d1; t += 5) ticks.push(t);
  strip({ blockId: "cb-ystates", plotId: "plot-ystates", rows, domain: [0, d1], ticks, tickFmt: (d) => (d === ticks.at(-1) ? d + "%" : String(d)),
    ref: JD.youthAi.y, refLabel: `All India, ages 15 to 29 ${pct(JD.youthAi.y)}%`, hi: () => true, fmtV: pct,
    dlName: "india-atlas_plfs_youth-ur-states", csvHeader: ["state", "ur_cws_15_29", "ur_cws_15_plus"],
    a11yTitle: "Unemployment rate of 15-to-29-year-olds by state, latest quarter",
    a11yDesc: `Sorted dot strip of ${rows.length} states. ${rows[0].name} is highest at ${pct(rows[0].a)} per cent and ${rows.at(-1).name} lowest at ${pct(rows.at(-1).a)}, around an all-India youth rate of ${pct(JD.youthAi.y)}. Each row pairs the youth rate with the state's rate for everyone 15 and above.` });
  setTxt("pv-ystates", f1a(JD.youthAi.y));
}

/* ---------- §06 young people, monthly ---------- */
{
  const Y = hydrate(JD.youth);
  const V = {
    ur_cws__female_urban__a15_29: { ...Y.ur_cws__female_urban__a15_29, label: "Urban women", color: "#2E4BD8" },
    ur_cws__male_urban__a15_29: { ...Y.ur_cws__male_urban__a15_29, label: "Urban men", color: "#5F6675" },
    ur_cws__female_rural__a15_29: { ...Y.ur_cws__female_rural__a15_29, label: "Rural women", color: "#A3A9B4" },
    ur_cws__male_rural__a15_29: { ...Y.ur_cws__male_rural__a15_29, label: "Rural men", color: "#878D99" },
  };
  const keys = Object.keys(V);
  const top = nice(Math.max(...keys.flatMap((k) => V[k].data.map((d) => d.value ?? 0))) + 1, 5);
  const yT = []; for (let t = 5; t <= top; t += 5) yT.push(t);
  const geo = { W: 1184, H: 470, ml: 70, mr: 190, mt: 30, mb: 48, d0: 5, d1: top };
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  multiLine("cb-youth", "plot-youth", keys, V, geo, yT, xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_plfs_youth-ur-gender-sector",
    "Unemployment rate of 15-to-29-year-olds by gender and sector, monthly",
    "Four lines. Young urban women end at " + last(V.ur_cws__female_urban__a15_29).toFixed(1) + " per cent, young urban men at " + last(V.ur_cws__male_urban__a15_29).toFixed(1) + ", young rural women at " + last(V.ur_cws__female_rural__a15_29).toFixed(1) + ", young rural men at " + last(V.ur_cws__male_rural__a15_29).toFixed(1) + ".",
    fmtDate, f1a);
  setTxt("pv-youth", f1a(last(V.ur_cws__female_urban__a15_29)));
  setTxt("ex-y-fu", f1a(last(V.ur_cws__female_urban__a15_29)));
  setTxt("ex-y-mu", f1a(last(V.ur_cws__male_urban__a15_29)));
  setTxt("ex-y-fr", f1a(last(V.ur_cws__female_rural__a15_29)));
  setTxt("ex-y-mr", f1a(last(V.ur_cws__male_rural__a15_29)));
  setTxt("ex-y-all", f1a(last(Y.ur_cws__person_all__a15_29)));
  setTxt("ex-y-one", String(Math.round(100 / last(V.ur_cws__female_urban__a15_29))));
}

/* ---------- §07 kinds of work, state by state ---------- */
{
  const rows = desc(JD.kinds.map((r) => ({ name: r.name, a: r.rg, b: r.cs })), "a");
  const d1 = nice(Math.max(...rows.map((r) => Math.max(r.a, r.b))) + 2, 10);
  const ticks = []; for (let t = 0; t <= d1; t += 10) ticks.push(t);
  strip({ blockId: "cb-kinds", plotId: "plot-kinds", rows, domain: [0, d1], ticks, tickFmt: (d) => (d === ticks.at(-1) ? d + "%" : String(d)),
    ref: null, hi: () => true, fmtV: pct,
    dlName: "india-atlas_plfs_salaried-share-states", csvHeader: ["state", "regular_wage_share_pct", "casual_share_pct"],
    a11yTitle: "Share of workers in regular wage or salaried jobs, and in casual labour, by state",
    a11yDesc: `Sorted dot strip of ${rows.length} states and UTs. ${rows[0].name} has the largest salaried share, ${pct(rows[0].a)} per cent; ${rows.at(-1).name} the smallest, ${pct(rows.at(-1).a)}. The pale dot is casual labour.` });
  setTxt("pv-kinds", (rows[0].a - rows.at(-1).a).toFixed(1) + " pt");
}

/* ---------- §08 what a regular job pays, state by state ---------- */
{
  const ai = JD.payAi;
  const rows = desc(JD.pay.map((r) => ({ name: r.name, a: r.p, b: r.f })), "a");
  const d1 = nice(Math.max(...rows.map((r) => Math.max(r.a, r.b))) + 1000, 10000);
  const ticks = []; for (let t = 0; t <= d1; t += 10000) ticks.push(t);
  strip({ blockId: "cb-paystates", plotId: "plot-paystates", rows, domain: [0, d1], ticks,
    tickFmt: (d) => (d === 0 ? "0" : d === ticks.at(-1) ? `₹${d / 1000}k` : `${d / 1000}k`),
    ref: ai.regular__person_all, refLabel: `All India ${inr(ai.regular__person_all)}`, hi: (r) => r.a > ai.regular__person_all, fmtV: inr,
    dlName: "india-atlas_plfs_regular-wage-states", csvHeader: ["state", "regular_wage_inr_month_all", "regular_wage_inr_month_women"],
    a11yTitle: "Average monthly earnings from regular wage or salaried work, by state",
    a11yDesc: `Sorted dot strip of ${rows.length} states and UTs, nominal rupees a month. ${rows[0].name} pays most, ${inr(rows[0].a)}; ${rows.at(-1).name} least, ${inr(rows.at(-1).a)}; all India ${inr(ai.regular__person_all)}. The pale dot is women's earnings.` });
  setTxt("pv-paystates", inr(ai.regular__person_all));
  setTxt("ex-ps-ai", inr(ai.regular__person_all));
  setTxt("ex-ps-m", inr(ai.regular__male_all));
  setTxt("ex-ps-f", inr(ai.regular__female_all));
}

/* ---------- §08 job conditions of regular employees ---------- */
{
  const C = hydrate(JD.cond);
  const V = {
    none_of_three__person_all: { ...C.none_of_three__person_all, label: "None of the three", color: "#2E4BD8" },
    no_contract__person_all: { ...C.no_contract__person_all, label: "No written contract", color: "#5F6675" },
    no_social_security__person_all: { ...C.no_social_security__person_all, label: "No social security", color: "#878D99" },
    no_paid_leave__person_all: { ...C.no_paid_leave__person_all, label: "No paid leave", color: "#A3A9B4" },
  };
  const keys = Object.keys(V);
  const geo = { W: 1184, H: 470, ml: 70, mr: 230, mt: 30, mb: 48, d0: 20, d1: 80 };
  const xTicks = V[keys[0]].data.map((d) => d.date);
  const plot = multiLine("cb-cond", "plot-cond", keys, V, geo, [20, 40, 60, 80], xTicks,
    (d) => String(d.getUTCFullYear()),
    "india-atlas_plfs_job-conditions",
    "Regular wage or salaried employees without a written contract, paid leave or social security, agriculture years",
    "Four lines. No written contract falls from " + first(V.no_contract__person_all).toFixed(1) + " to " + last(V.no_contract__person_all).toFixed(1) + " per cent; no paid leave from " + first(V.no_paid_leave__person_all).toFixed(1) + " to " + last(V.no_paid_leave__person_all).toFixed(1) + "; no social security moves from " + first(V.no_social_security__person_all).toFixed(1) + " to " + last(V.no_social_security__person_all).toFixed(1) + "; none of the three from " + first(V.none_of_three__person_all).toFixed(1) + " to " + last(V.none_of_three__person_all).toFixed(1) + ".",
    fmtAgri, f1a);
  wireLegend(document.getElementById("legend-cond"), plot, keys, V);
  setTxt("pv-cond", f1a(last(V.none_of_three__person_all)));
  setTxt("ex-c-nc0", f1a(first(V.no_contract__person_all)));
  setTxt("ex-c-nc1", f1a(last(V.no_contract__person_all)));
  setTxt("ex-c-n0", f1a(first(V.none_of_three__person_all)));
  setTxt("ex-c-n1", f1a(last(V.none_of_three__person_all)));
  setTxt("ex-c-ten", String(Math.round(last(V.none_of_three__person_all) / 10)));
}

/* ---------- §09 women's work by social group and religion ---------- */
{
  const S = JD.social.series;
  const v = (g, k) => S[`lfpr_psss__${g}_all__a15plus__${k}`]?.data.at(-1);
  const GROUPS = [["soc_scheduled_tribe", "Scheduled Tribe"], ["soc_scheduled_caste", "Scheduled Caste"], ["soc_other_backward_class", "Other Backward Class"], ["soc_others", "Others (outside the three)"],
    ["rel_christianity", "Christian"], ["rel_hinduism", "Hindu"], ["rel_sikhism", "Sikh"], ["rel_islam", "Muslim"]];
  const rows = GROUPS.map(([k, name]) => ({ name, a: v("female", k), b: v("male", k) })).filter((r) => r.a != null);
  const fAi = JD.socialAi.f;
  strip({ blockId: "cb-social", plotId: "plot-social", rows, domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickFmt: (d) => (d === 100 ? "100%" : String(d)),
    ref: fAi, refLabel: `All women ${pct(fAi)}%`, hi: () => true, fmtV: pct, rowH: 34,
    dlName: "india-atlas_plfs_lfpr-social-religion", csvHeader: ["group", "lfpr_women_pct", "lfpr_men_pct"],
    a11yTitle: "Labour force participation by social group and religion, women and men",
    a11yDesc: "Eight rows: four social groups then four religions. " + rows.map((r) => `${r.name}: women ${pct(r.a)}, men ${pct(r.b)}`).join("; ") + "." });
  setTxt("pv-social", f1a(fAi));
}

/* ---------- §10 how many people in each state work ---------- */
{
  const rows = desc(JD.work.map((r) => ({ name: r.name, a: r.f, b: r.m })), "a");
  strip({ blockId: "cb-work", plotId: "plot-work", rows, domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickFmt: (d) => (d === 100 ? "100%" : String(d)),
    ref: JD.workAi.f, refLabel: `All-India women ${pct(JD.workAi.f)}%`, hi: () => true, fmtV: pct,
    dlName: "india-atlas_plfs_wpr-states-gender", csvHeader: ["state", "wpr_women_pct", "wpr_men_pct"],
    a11yTitle: "Share of people aged 15 and above who are working, women and men, by state",
    a11yDesc: `Sorted dot strip of ${rows.length} states and UTs. Women's worker ratio runs from ${pct(rows[0].a)} per cent in ${rows[0].name} to ${pct(rows.at(-1).a)} in ${rows.at(-1).name}; men's stays between ${pct(Math.min(...rows.map((r) => r.b)))} and ${pct(Math.max(...rows.map((r) => r.b)))}.` });
  setTxt("pv-work", (rows[0].a - rows.at(-1).a).toFixed(1) + " pt");
}

/* ---------- sparklines ---------- */
spark("nspark-ur", M.ur);
regRows.forEach(([s], i) => spark("sp-j" + i, s));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", monthlyBundle.meta.vintage);
setTxt("prov-vintage2", monthlyBundle.meta.vintage);
