// Dossier 06 · Jobs — plate definitions and number wiring.
// Data: data/series/plfs-monthly.json + plfs-quarterly.json + plfs-annual.json
// + plfs-cuts.json, baked at build time by scripts/fetch.mjs.
// The three instruments (monthly, quarterly, annual) are shown side by side
// and never spliced; the quarterly series carries two disclosed gaps
// (Apr–Jun 2019 quarantined cell, Jan–Mar 2025 never published) which break
// the line — the gaps are the story, not a rendering defect.

import * as Plot from "@observablehq/plot";
import monthlyBundle from "../../data/series/plfs-monthly.json";
import quarterlyBundle from "../../data/series/plfs-quarterly.json";
import annualBundle from "../../data/series/plfs-annual.json";
import cutsBundle from "../../data/series/plfs-cuts.json";
import statesBundle from "../../data/series/plfs-states.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob,
} from "../charts/plumbing.js";

const M = hydrate(monthlyBundle);
const ST = hydrate(statesBundle);
const Q = hydrate(quarterlyBundle);
const A = hydrate(annualBundle);
const CUTS = hydrate(cutsBundle);

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
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
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(2) + "%";

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
setTxt("cr-ur0", f1(first(M.ur))); setTxt("cr-ur1", f1(last(M.ur)));
setTxt("cr-lfpr", f1(last(M.lfpr)));
setTxt("cr-fur", f1(last(CUTS.ur_female_urban)));
setTxt("cr-mur", f1(last(CUTS.ur_male_urban)));
setTxt("cr-flfpr", f1(last(CUTS.lfpr_female_urban)));

setTxt("pv-annual", f1(last(A.ur_psss)));
setTxt("ex-p0", f1(first(A.ur_psss))); setTxt("ex-p1", f1(last(A.ur_psss)));
setTxt("pv-main", f1(last(Q.ur)));
setTxt("ex-q0", f1(first(Q.ur))); setTxt("ex-q1", f1(last(Q.ur)));
setTxt("pv-cuts", f1(last(CUTS.ur_female_urban)));
setTxt("ex-fu", f1(last(CUTS.ur_female_urban))); setTxt("ex-mu", f1(last(CUTS.ur_male_urban)));
setTxt("pv-lfpr", f1(last(CUTS.lfpr_female_urban)));
setTxt("ex-fl", f1(last(CUTS.lfpr_female_urban)));

/* ---------- register ---------- */
const regRows = [
  [M.ur, "UR · all-India · monthly", "Current weekly status, 15+", "s-acc", fmtDate],
  [M.lfpr, "LFPR · all-India · monthly", "Labour force participation, 15+", "s-g1", fmtDate],
  [M.wpr, "WPR · all-India · monthly", "Worker population ratio, 15+", "s-g2", fmtDate],
  [Q.ur, "UR · urban · quarterly", "CWS, urban, 15+ · two disclosed gaps", "s-g3", fmtQ],
  [Q.lfpr, "LFPR · urban · quarterly", "CWS, urban, 15+", "s-g4", fmtQ],
  [A.ur_psss, "UR · annual · usual status", "PS+SS, agriculture years", "s-acc", fmtAgri],
  [A.ur_cws, "UR · annual · weekly status", "CWS, agriculture years", "s-g1", fmtAgri],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fmt], i) => {
  const data = s.data.filter((d) => d.value != null);
  const target = data.at(-1).date.getTime() - 365.25 * 86400000;
  let yi = 0, best = Infinity;
  data.forEach((d, j) => { const diff = Math.abs(d.date.getTime() - target); if (diff < best) { best = diff; yi = j; } });
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${f1(data.at(-1).value)}</td>
    <td class="chg">${arrow(data.at(-1).value - data.at(-2).value)} · vs ${fmt(data.at(-2).date)}</td>
    <td class="yr">${f1(data[yi].value)}</td>
    <td class="spark" id="sp-j${i}"></td>
  </tr>`;
}).join("");

/* ---------- shared plate renderer ---------- */
function multiLine(blockId, plotId, keys, store, geo, yTicks, xTicks, fmtX, dlName, a11yTitle, a11yDesc, fmtCross = fmtDate) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList.filter((s) => s.data.at(-1).value != null), (geo.d1 - geo.d0) * 0.06);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(store[keys[0]].data.filter((d) => d.value != null).slice(-7), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    ...seriesList.filter((s) => s.data.at(-1).value != null).map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
      dx: 16, fill: p.s.color, fontSize: 14.5, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: fmtX },
    y: { label: "↑ per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, seriesList, dlName, fmtCross);
  addCrosshair(document.getElementById(plotId), plot, seriesList, geo, fmtCross);
  return plot;
}

/* ---------- §03 three stopwatches: annual CWS vs usual status ---------- */
{
  A.ur_cws.color = "#5B564B";
  A.ur_psss.color = "#BE3E26";
  A.ur_cws.label = "Weekly status · CWS";
  A.ur_psss.label = "Usual status · PS+SS";
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

/* ---------- §04 plate 1: the long arc, urban quarterly ---------- */
{
  const s = Q.ur;
  const geo = { W: 1184, H: 520, ml: 70, mr: 180, mt: 36, mb: 48, d0: 0, d1: 24 };
  const yTicks = [0, 5, 10, 15, 20];
  const xTicks = []; for (let y = 2018; y <= 2026; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const peak = peakOf(s);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      // nulls at Apr–Jun 2019 (quarantined) and Jan–Mar 2025 (unpublished)
      // break the line — the gaps are disclosed, not interpolated
      Plot.lineY(s.data, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.filter((d) => d.value != null).slice(-7), { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.ruleX([peak.date], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: peak.date, value: 22.6 }], { x: "date", y: "value", text: ["lockdown · one urban worker in five"], fontSize: 12.5, fill: "#8A857A", fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", text: (d) => `Urban UR ${d.value.toFixed(2)}%`, dx: 16, fill: "#BE3E26", fontSize: 14.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Urban unemployment rate, quarterly, current weekly status, 2018 to 2026",
    "Line chart starting at 9.7 per cent in April–June 2018, spiking to " + peak.value.toFixed(1) + " per cent in the April–June 2020 lockdown quarter, then grinding down to " + last(Q.ur).toFixed(1) + " per cent in January–March 2026. Two quarters are missing by design: April–June 2019 is quarantined and January–March 2025 was never published.");
  document.getElementById("plot-main").append(plot);
  wireTools(document.getElementById("cb-main"), plot, [s], "india-atlas_plfs_urban-quarterly", fmtQ);
  // the two disclosed gaps are null; the tooltip says so instead of NaN
  addCrosshair(document.getElementById("plot-main"), plot, [s], geo, fmtQ,
    (v) => (v == null ? "not published" : v.toFixed(2) + "%"));
}

/* ---------- §06 cuts: four labour markets ---------- */
{
  const V = {
    ur_female_urban: { ...CUTS.ur_female_urban, label: "Urban women", color: "#BE3E26" },
    ur_male_urban: { ...CUTS.ur_male_urban, label: "Urban men", color: "#5B564B" },
    ur_female_rural: { ...CUTS.ur_female_rural, label: "Rural women", color: "#A8A293" },
    ur_male_rural: { ...CUTS.ur_male_rural, label: "Rural men", color: "#8A857A" },
  };
  const keys = ["ur_female_urban", "ur_male_urban", "ur_female_rural", "ur_male_rural"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 190, mt: 30, mb: 48, d0: 2, d1: 11 };
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  multiLine("cb-cuts", "plot-cuts", keys, V, geo, [2, 4, 6, 8, 10], xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_plfs_ur-by-gender-sector",
    "Unemployment rate by gender and sector, monthly, April 2025 to June 2026",
    "Four line charts. Urban women end at " + last(CUTS.ur_female_urban).toFixed(1) + " per cent, urban men at " + last(CUTS.ur_male_urban).toFixed(1) + ", rural women at " + last(CUTS.ur_female_rural).toFixed(1) + ", rural men at " + last(CUTS.ur_male_rural).toFixed(1) + ".");
}

/* ---------- §06 cuts: the participation chasm ---------- */
{
  const V = {
    lfpr_female_urban: { ...CUTS.lfpr_female_urban, label: "Urban women", color: "#BE3E26" },
    lfpr_male_urban: { ...CUTS.lfpr_male_urban, label: "Urban men", color: "#5B564B" },
    lfpr_female_rural: { ...CUTS.lfpr_female_rural, label: "Rural women", color: "#A8A293" },
    lfpr_male_rural: { ...CUTS.lfpr_male_rural, label: "Rural men", color: "#8A857A" },
  };
  const keys = ["lfpr_female_urban", "lfpr_male_urban", "lfpr_female_rural", "lfpr_male_rural"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 190, mt: 30, mb: 48, d0: 20, d1: 85 };
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  multiLine("cb-lfpr", "plot-lfpr", keys, V, geo, [20, 30, 40, 50, 60, 70, 80], xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_plfs_lfpr-by-gender-sector",
    "Labour force participation rate by gender and sector, monthly, April 2025 to June 2026",
    "Four line charts. Rural men end at " + last(CUTS.lfpr_male_rural).toFixed(1) + " per cent, urban men at " + last(CUTS.lfpr_male_urban).toFixed(1) + ", rural women at " + last(CUTS.lfpr_female_rural).toFixed(1) + ", urban women at " + last(CUTS.lfpr_female_urban).toFixed(1) + " — the chasm the plate is about.");
}

/* ---------- §07 states: a country of labour markets ----------
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
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, domain: [0, 19], ticks: xTicks, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xTicks[xTicks.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: names, tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleX([aiCws], { stroke: "#C6C0B0", strokeWidth: 1.25, strokeDasharray: "2,3" }),
      Plot.ruleX([aiPsss], { stroke: "#8A857A", strokeWidth: 1.25 }),
      Plot.text([{ x: aiPsss }], { x: "x", y: () => names[0], dy: -26, dx: -7, text: () => `All-India · PS+SS ${aiPsss.toFixed(1)}%`, textAnchor: "end", fill: "#5B564B", fontSize: 12, fontFamily: mono }),
      Plot.text([{ x: aiCws }], { x: "x", y: () => names[0], dy: -26, dx: 7, text: () => `CWS ${aiCws.toFixed(1)}%`, textAnchor: "start", fill: "#8A857A", fontSize: 12, fontFamily: mono }),
      Plot.link(rows, { x1: "cws", x2: "psss", y1: "name", y2: "name", stroke: "#C6C0B0", strokeWidth: 1 }),
      Plot.dot(rows, { x: "cws", y: "name", fill: "#C6C0B0", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot(rows, { x: "psss", y: "name", fill: (d) => (d.psss >= thr ? "#BE3E26" : "#5B564B"), r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{}], { frameAnchor: "top-right", dx: 60, dy: -26, text: () => "PS+SS", fill: "#8A857A", fontSize: 10.5, fontFamily: mono }),
      Plot.text(rows, { x: () => 19, y: "name", text: (d) => d.psss.toFixed(1), dx: 60, textAnchor: "end", fill: (d) => (d.psss >= thr ? "#BE3E26" : "#8A857A"), fontSize: 12.5, fontFamily: mono }),
    ],
  });
  a11y(plot, "Unemployment rate by State and Union Territory, 2023-24, usual status beside weekly status",
    "Sorted dot strip of " + rows.length + " States and UTs. " + top.name + " is highest at " + top.psss.toFixed(1) +
    " per cent on the usual status and " + bot.name + " lowest at " + bot.psss.toFixed(1) +
    " — a spread of " + spread.toFixed(1) + " points around the All-India rate of " + aiPsss.toFixed(1) +
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

/* ---------- sparklines ---------- */
spark("nspark-ur", M.ur);
regRows.forEach(([s], i) => spark("sp-j" + i, s));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", monthlyBundle.meta.vintage);
setTxt("prov-vintage2", monthlyBundle.meta.vintage);
