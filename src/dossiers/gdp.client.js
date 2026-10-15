// Dossier 02 · National Accounts — plate definitions and number wiring.
// Data: data/series/gdp.json, baked at build time by scripts/fetch.mjs.
// Dates are fiscal-quarter starts (Q1 = Apr–Jun); growth is y/y from
// constant-price levels, computed in the pipeline.

import * as Plot from "@observablehq/plot";
import bundle_raw from "../../data/series/gdp.json";
import expBundle_raw from "../../data/series/gdp-expenditure.json";
import accBundle_raw from "../../data/series/gdp-accounts.json";
import indBundle_raw from "../../data/series/gdp-industries.json";
import nomBundle_raw from "../../data/series/gdp-nominal.json";
import nbBundle_raw from "../../data/series/gdp-2022.json";
import nbIndBundle_raw from "../../data/series/gdp-2022-industries.json";
import nbExpBundle_raw from "../../data/series/gdp-2022-expenditure.json";
import nbAccBundle_raw from "../../data/series/gdp-2022-accounts.json";
import backBundle_raw from "../../data/series/gdp-back.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend, seamMarks, seamOverlap,
  peakOf, troughOf, peakBetween, dodgeEndLabels, spark, makePlacer, annotationSpot,
} from "../charts/plumbing.js";

import { roundRates } from "./precision.js";
// review-a (2026-10): rates at the precision the agency publishes, rounded once as they load
// (src/dossiers/precision.js), so every delta and spread on the page is redone from what is shown
const bundle = roundRates(bundle_raw);
const expBundle = roundRates(expBundle_raw);
const accBundle = roundRates(accBundle_raw);
const indBundle = roundRates(indBundle_raw);
const nomBundle = roundRates(nomBundle_raw);
const nbBundle = roundRates(nbBundle_raw);
const nbIndBundle = roundRates(nbIndBundle_raw);
const nbExpBundle = roundRates(nbExpBundle_raw);
const nbAccBundle = roundRates(nbAccBundle_raw);
const backBundle = roundRates(backBundle_raw);

const S = hydrate(bundle);
const E = hydrate(expBundle);
const ACC = hydrate(accBundle);
const IND = hydrate(indBundle);   // 8-sector real GVA, same quarter grid as S
const N = hydrate(nomBundle);     // nominal GDP, real GDP, implied deflator
const NB = hydrate(nbBundle);     // the 2022-23 base — separate axis, never spliced
const NBIND = hydrate(nbIndBundle); // 8-sector real GVA on the 2022-23 base
const NBE = hydrate(nbExpBundle);   // government, exports, imports on the 2022-23 base
// the deep accounts (wave 2): slim data the page baked from the gdp-*-annual, -sectors,
// -revisions and back bundles at build time (src/pages/guides/gdp.astro, GD)
const GD = JSON.parse(document.getElementById("gdp-deep")?.textContent || "{}");
const NBACC = hydrate(nbAccBundle); // annual accounts on the 2022-23 base
const BACK = hydrate(backBundle);   // the NSO back series, 1951-52 to 2011-12, a separate ruler
// presentation palette for the expenditure plate — unique per line
E.imports.color = "#2E4BD8";
E.exports.color = "#5F6675";
E.gfce.color = "#878D99";
E.gfce.label = "Government, GFCE";
const dates = S.gdp.data.map((d) => d.date);
// fiscal quarter label: 2016-04 -> "Q1 FY17", 2017-01 -> "Q4 FY17"
const fmtDate = (d) => {
  const m = d.getUTCMonth(), y = d.getUTCFullYear();
  const q = m === 3 ? 1 : m === 6 ? 2 : m === 9 ? 3 : 4;
  const fy = q === 4 ? y : y + 1;
  return "Q" + q + " FY" + String(fy).slice(2);
};

/* ---------- drive every displayed number from the data ---------- */
const ALL = { ...S, ...E, ...IND }; // gdp, gdp-expenditure and gdp-industries share the same quarter grid
const L = {}; for (const k in ALL) L[k] = ALL[k].data.at(-1).value;
const P = {}; for (const k in ALL) P[k] = ALL[k].data.at(-2).value;
const Y = {}; for (const k in ALL) Y[k] = ALL[k].data.at(-5).value;
// the current print lives on the 2022-23 base (NB); the 2011-12 base (L) retired
// at Q2 FY26 and lives on below in the decade plate. Titleblock + §01 use NB.
const LNB = {}; for (const k in NB) LNB[k] = NB[k].data.at(-1).value;
const PNB = {}; for (const k in NB) PNB[k] = NB[k].data.at(-2).value;
const prevQNB = "vs " + fmtDate(NB.gdp.data.at(-2).date).replace(/ FY\d+$/, "");
const pc = '<span class="pc">%</span>';
const arrow = (d) => (Math.abs(d) < 0.05 ? "unchanged" : (d > 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt");
const word = (d) => (d >= 0 ? "accelerating" : "slowing");
const prevQ = "vs " + fmtDate(dates.at(-2)).replace(/ FY\d+$/, "");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(1) + "%";

setHTML("n-gdp", LNB.gdp.toFixed(1) + pc);
setHTML("n-gva", LNB.gva.toFixed(1) + pc);
setHTML("n-pfce", LNB.pfce.toFixed(1) + pc);
setHTML("n-gfcf", LNB.gfcf.toFixed(1) + pc);
setHTML("d-gdp", `<b>${arrow(LNB.gdp - PNB.gdp)}</b> ${prevQNB}, ${word(LNB.gdp - PNB.gdp)}`);
setHTML("d-gva", `<b>${arrow(LNB.gva - PNB.gva)}</b> ${prevQNB}, ${word(LNB.gva - PNB.gva)}`);
setHTML("d-pfce", `<b>${arrow(LNB.pfce - PNB.pfce)}</b> ${prevQNB}, ${word(LNB.pfce - PNB.pfce)}`);
setHTML("d-gfcf", `<b>${arrow(LNB.gfcf - PNB.gfcf)}</b> ${prevQNB}, ${word(LNB.gfcf - PNB.gfcf)}`);

setHTML("rb-big", LNB.gdp.toFixed(1) + pc);
setHTML("rb-band", `vs 6% trend: <b>${(LNB.gdp - 6 >= 0 ? "+" : "") + (LNB.gdp - 6).toFixed(1)} pt</b>`);
{
  const W = 236, H = 46, min = 0, max = 10, val = LNB.gdp;
  const X = (v) => ((v - min) / (max - min)) * W, y = 18;
  document.getElementById("rb-scale").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale from 0 to 10 per cent. The rough pre-pandemic trend of 6 per cent is dashed; the current reading, ${val.toFixed(1)} per cent, is marked.">` +
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#DADDE3" stroke-width="1"/>` +
    `<line x1="${X(6)}" y1="${y - 10}" x2="${X(6)}" y2="${y + 10}" stroke="#878D99" stroke-width="1" stroke-dasharray="2,3"/>` +
    [0, 2, 4, 6, 8, 10].map((t, i, a) => `<text x="${X(t)}" y="${H - 6}" font-family="'Golos Text',sans-serif" font-size="11" fill="#878D99" text-anchor="${i === 0 ? "start" : i === a.length - 1 ? "end" : "middle"}">${t}%</text>`).join("") +
    `<circle cx="${X(val)}" cy="${y}" r="4.5" fill="#2E4BD8" stroke="#FFFFFF" stroke-width="1.5"/>` +
    `</svg>`;
}
// §01 "current reading" prose is pipeline-generated (pipeline/out/prose-gdp.*.md);
// the cr-* figure spans it used to carry are retired.

setTxt("pv-main", f1(L.gdp));
setTxt("pv-pfce", f1(L.pfce)); setTxt("pv-gfcf", f1(L.gfcf)); setTxt("pv-gva", f1(L.gva));
setTxt("ex-pfce", f1(L.pfce)); setTxt("ex-gfcf", f1(L.gfcf)); setTxt("ex-gva", f1(L.gva));
setTxt("ex-last4", S.gdp.data.slice(-4).map((d) => d.value.toFixed(1)).join(", "));
const pkP = peakOf(S.pfce), pkF = peakOf(S.gfcf), pkV = peakOf(S.gva);
setTxt("pf-pfce", `peak: ${pkP.value.toFixed(1)}%, ${fmtDate(pkP.date)}, latest: ${f1(L.pfce)}`);
setTxt("pf-gfcf", `peak: ${pkF.value.toFixed(1)}%, ${fmtDate(pkF.date)}, latest: ${f1(L.gfcf)}`);
setTxt("pf-gva", `peak: ${pkV.value.toFixed(1)}%, ${fmtDate(pkV.date)}, latest: ${f1(L.gva)}`);

/* ---------- expenditure-side numbers ---------- */
const fSigned = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
setTxt("pv-exp", f1(L.imports));
setTxt("ex-imp", f1(L.imports));
setTxt("ex-exp", f1(L.exports));
setTxt("ex-gfce", fSigned(L.gfce));
const trM = troughOf(E.imports), pkM = peakOf(E.imports);
setTxt("pf-exp", `imports swung −${Math.abs(trM.value).toFixed(1)}% (${fmtDate(trM.date)}) to +${pkM.value.toFixed(1)}% (${fmtDate(pkM.date)}), latest: ${f1(L.imports)}`);

/* ---------- annual-accounts numbers ---------- */
const fmtFY = (d) => "FY" + String(d.getUTCFullYear() + 1).slice(2);
const accLast = (k) => ACC[k].data.filter((d) => d.value != null).at(-1);
setTxt("pv-acc", f1(accLast("ndp").value));
setTxt("pv-acc-c", fmtFY(accLast("ndp").date) + ", NDP y/y");
setTxt("ac-ndp", f1(accLast("ndp").value));
setTxt("ac-gni", f1(accLast("gni").value));
setTxt("ac-tax", f1(accLast("taxes").value));
setTxt("ac-sub", fSigned(accLast("subsidies").value));
setTxt("ac-cfc", f1(accLast("cfc").value));
{
  const vs = ACC.cfc.data.filter((d) => d.value != null).map((d) => d.value);
  setTxt("ac-cfc-lo", Math.min(...vs).toFixed(1) + "%");
  setTxt("ac-cfc-hi", Math.max(...vs).toFixed(1) + "%");
}

/* ---------- register: the 2022-23 base, where the quarterly series now lives ---------- */
const SH = nbIndBundle.shares; // sector shares of NOMINAL GVA, last four quarters, base 2022-23
const NBX = { ...NB, ...NBE, ...NBIND };
const RL = {}, RP = {}, RY = {};
for (const k in NBX) { const d = NBX[k].data; RL[k] = d.at(-1).value; RP[k] = d.at(-2).value; RY[k] = d.at(-5)?.value ?? null; }
// expenditure shares of nominal GDP, latest fiscal year on the 2022-23 base
const sp22 = GD.spend?.b22 ?? { dates: [], s: {} };
const spLast = (k) => { const a = sp22.s[k] ?? []; for (let i = a.length - 1; i >= 0; i--) if (a[i] != null) return a[i]; return null; };
const regRows = [
  ["gdp", "Real GDP", "Market prices, the headline", "s-acc", null, "#2E4BD8"],
  ["gva", "Real GVA", "Basic prices, before net taxes", "s-g1", null, "#5F6675"],
  ["pfce", "Consumption, PFCE", "Household spending", "s-g2", spLast("pfce"), "#A3A9B4"],
  ["gfcf", "Investment, GFCF", "Machines, buildings, infrastructure", "s-g3", spLast("gfcf"), "#878D99"],
  ["gfce", "Government, GFCE", "The state's own consumption", "s-g4", spLast("gfce"), "#878D99"],
  ["exports", "Exports, goods & services", "Demand from abroad", "s-g1", null, "#5F6675"],
  ["imports", "Imports, goods & services", "Enters with a minus sign", "s-acc", null, "#2E4BD8"],
  // production side — the four most telling engines; shares are of GVA (see table note)
  ["agriculture", "Agriculture, GVA", "The monsoon engine, share of GVA", "s-g1", SH.agriculture, "#5F6675"],
  ["manufacturing", "Manufacturing, GVA", "The tradables cycle, share of GVA", "s-g2", SH.manufacturing, "#5F6675"],
  ["construction", "Construction, GVA", "Where investment becomes jobs, share of GVA", "s-g3", SH.construction, "#5F6675"],
  ["finance_realty", "Finance & real estate, GVA", "The largest engine, share of GVA", "s-g4", SH.finance_realty, "#5F6675"],
];
const fRow = (v) => (v == null ? "—" : f1(v));
document.getElementById("ledger-body").innerHTML = regRows.map(([k, nm, sub, sw, share, col]) => `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">${share == null ? "—" : share.toFixed(1) + '<span class="wtrack"><i style="width:' + share + '%;background:' + col + '"></i></span>'}</td>
    <td class="val">${fRow(RL[k])}</td>
    <td class="chg">${arrow(RL[k] - RP[k])}, ${word(RL[k] - RP[k])}</td>
    <td class="yr">${fRow(RY[k])}</td>
    <td class="spark" id="sp-${k}"></td>
  </tr>`).join("");

/* ---------- expenditure composition: latest fiscal year, base 2022-23 ---------- */
{
  const groups = [
    ["Consumption, PFCE", spLast("pfce"), "#2E4BD8"],
    ["Investment, GFCF", spLast("gfcf"), "#5F6675"],
    ["Government, GFCE", spLast("gfce"), "#A3A9B4"],
    ["Stocks & valuables", (spLast("stocks") ?? 0) + (spLast("valuables") ?? 0), "#DADDE3"],
  ];
  document.getElementById("basket-bar").innerHTML = groups.map(([n, w, c]) =>
    `<div class="seg" style="width:${w}%;background:${c}" title="${n}: ${w.toFixed(1)}%"></div>`).join("");
  document.getElementById("basket-labels").innerHTML = groups.map(([n, w, c]) =>
    `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${w.toFixed(1)}% of GDP</div></div>`).join("");
  const sgn1 = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1) + "%";
  setTxt("bk-nx", sgn1(spLast("net_exports")));
  setTxt("bk-disc", sgn1(spLast("discrepancy")));
  setTxt("bk-inv", spLast("gfcf").toFixed(1) + "%");
}

/* ---------- plate 1 : GDP + GVA + PFCE ---------- */
{
  const keys = ["gdp", "gva", "pfce"];
  const seriesList = keys.map((k) => S[k]);
  const geo = { W: 1184, H: 560, ml: 70, mr: 180, mt: 36, mb: 48, d0: -30, d1: 25 };
  const endGap = (geo.d1 - geo.d0) * 0.038;
  const dodged = dodgeEndLabels(seriesList, endGap);
  const crash = troughOf(S.gdp);
  const rebound = peakBetween(S.gdp, 2021, 2021);
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-20, -10, 0, 10, 20];
  const t0 = dates[0].getTime(), t1 = dates.at(-1).getTime();
  const sx = (px) => px / ((geo.W - geo.ml - geo.mr) / (t1 - t0));
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const dxDate = (d, px) => new Date(d.getTime() + sx(px));
  /* collision-aware annotations: the three series, the 6% rule and the
   * COVID rule are obstacles; placed labels become obstacles for later ones */
  const placer = makePlacer(geo, dates);
  keys.forEach((k) => placer.addSeries(S[k].data));
  placer.addRuleY(6).addRuleX(new Date(Date.UTC(2020, 3, 1)));
  /* the dodged end labels are obstacles too — nothing may overlap them */
  for (const p of dodged) {
    const lbl = `${p.s.label} ${p.value.toFixed(1)}%`;
    placer.addObstacleBox(placer.box({ x: dates.at(-1), y: p.y, anchor: "start", dx: 16 }, lbl, 14.5));
  }
  const trendSpot = placer.place("Rough pre-pandemic trend, 6%", 12, [
    { x: new Date(Date.UTC(2017, 0, 1)), y: 9.7, anchor: "start" },
    { x: new Date(Date.UTC(2016, 10, 1)), y: 9.7, anchor: "start" },
    { x: new Date(Date.UTC(2023, 1, 1)), y: 2.5, anchor: "start" },
  ]);
  const crashA = annotationSpot(placer, crash, crash.value.toFixed(1) + "%, " + fmtDate(crash.date) + ", lockdown", 13, [
    { x: crash.date, y: crash.value, anchor: "end", dx: -12, dy: -38 },
    { x: crash.date, y: crash.value, anchor: "start", dx: 12, dy: -38 },
    { x: crash.date, y: crash.value, anchor: "end", dx: -12, dy: 44 },
    { x: crash.date, y: crash.value, anchor: "middle", dx: 0, dy: -38 },
  ]);
  placer.addObstacleBox(crashA.box);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.ruleY([-30], { stroke: "#E3E6EB", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
    Plot.ruleY([6], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
    Plot.text([{ date: trendSpot.x, value: trendSpot.y }], { x: "date", y: "value", text: ["Rough pre-pandemic trend, 6%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: trendSpot.anchor }),
    Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
    Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 23.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
    ...["gva", "pfce"].map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(S.gdp.data, { x: "date", y: "value", stroke: S.gdp.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.gdp.data.slice(-5), { x: "date", y: "value", stroke: S.gdp.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    Plot.dot([crash], { x: "date", y: "value", fill: S.gdp.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line(crashA.leader, { x: "x", y: "y", stroke: S.gdp.color, strokeWidth: 1 }),
    Plot.text([{ date: crashA.textX, value: crashA.textY }], { x: "date", y: "value", text: [crash.value.toFixed(1) + "%, " + fmtDate(crash.date) + ", lockdown"], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: crashA.spot.anchor }),
    Plot.dot([rebound], { x: "date", y: "value", fill: S.gdp.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line([
      { x: dxDate(rebound.date, 7), y: rebound.value - sy(3) },
      { x: dxDate(rebound.date, 18), y: rebound.value - sy(3) },
    ], { x: "x", y: "y", stroke: S.gdp.color, strokeWidth: 1 }),
    Plot.text([{ date: dxDate(rebound.date, 24), value: rebound.value - sy(3) }], { x: "date", y: "value", text: () => rebound.value.toFixed(1) + "%, " + fmtDate(rebound.date) + ", base effect", dy: 4, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
    ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === S.gdp ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(1)}%`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === S.gdp ? 500 : 400, textAnchor: "start",
    })),
  ];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, "Real GDP, GVA and consumption growth, year-on-year, Q1 FY17 to Q2 FY26",
    "Line chart. GDP ends at " + L.gdp.toFixed(1) + " per cent, GVA at " + L.gva.toFixed(1) + ", consumption at " + L.pfce.toFixed(1) + ". The 2020 lockdown crash and 2021 base-effect rebound are annotated; dashed rule marks a rough 6 per cent trend.");
  document.getElementById("plot-main").append(plot);
  wireTools(document.getElementById("cb-main"), plot, seriesList, "india-atlas_national-accounts_gdp-gva-pfce_fy17-fy26", fmtDate);
  wireLegend(document.getElementById("legend-main"), plot, keys, S);
  addCrosshair(document.getElementById("plot-main"), plot, seriesList, geo, fmtDate);
}

/* ---------- component plates ---------- */
function componentChart(blockId, plotId, key, d0, d1, yTicks, extraNote) {
  const s = S[key];
  const pk = peakOf(s);
  const dates = s.data.map((d) => d.date);
  const geo = { W: 1184, H: 470, ml: 70, mr: 136, mt: 30, mb: 48, d0, d1 };
  const dir = pk.value > d1 - (d1 - d0) * 0.14 ? -1 : 1;
  /* collision-aware peak annotation (placer, verified by lint-charts) */
  const placer = makePlacer(geo, dates);
  placer.addSeries(s.data).addRuleY(0);
  const pkText = pk.value.toFixed(1) + "%, " + fmtDate(pk.date);
  const { spot, textX, textY, leader } = annotationSpot(placer, pk, pkText, 13, [
    { x: pk.date, y: pk.value, anchor: "middle", dx: 0, dy: dir * 30 },
    { x: pk.date, y: pk.value, anchor: "start", dx: 22, dy: dir * 18 },
    { x: pk.date, y: pk.value, anchor: "end", dx: -22, dy: dir * 18 },
    { x: pk.date, y: pk.value, anchor: "start", dx: 22, dy: -dir * 18 },
    { x: pk.date, y: pk.value, anchor: "end", dx: -22, dy: -dir * 18 },
    { x: pk.date, y: pk.value, anchor: "middle", dx: 0, dy: -dir * 30 },
  ]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ y/y, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [d0, d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-5), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(leader, { x: "x", y: "y", stroke: "#2E4BD8", strokeWidth: 1 }),
      Plot.text([{ date: textX, value: textY }], { x: "date", y: "value", text: [pkText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: spot.anchor }),
      Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([s.data.at(-1)], { x: "date", y: "value", text: (d) => d.value.toFixed(1) + "%", dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, s.label + " growth, year-on-year, FY17 to FY26",
    "Line chart ending at " + s.data.at(-1).value.toFixed(1) + " per cent, peaking at " + pk.value.toFixed(1) + " per cent in " + fmtDate(pk.date) + ". " + (extraNote || ""));
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, [s], "india-atlas_national-accounts_" + key + "_fy17-fy26", fmtDate);
  addCrosshair(document.getElementById(plotId), plot, [s], geo, fmtDate);
}
componentChart("cb-pfce", "plot-pfce", "pfce", -28, 22, [-20, -10, 0, 10, 20], "Consumption crashed in the 2020 lockdown and rebounded on the base effect.");
componentChart("cb-gfcf", "plot-gfcf", "gfcf", -50, 70, [-40, -20, 0, 20, 40, 60], "Investment collapsed more than 40 per cent in Q1 FY21, the widest swing in the accounts.");
componentChart("cb-gva", "plot-gva", "gva", -28, 24, [-20, -10, 0, 10, 20], "GVA excludes net indirect taxes.");

/* ---------- expenditure plate : imports + exports + GFCE ---------- */
{
  const keys = ["imports", "exports", "gfce"];
  const seriesList = keys.map((k) => E[k]);
  const geo = { W: 1184, H: 470, ml: 70, mr: 230, mt: 30, mb: 48, d0: -45, d1: 50 };
  const yTicks = [-40, -20, 0, 20, 40];
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.05);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 47 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      ...keys.slice(1).map((k) => Plot.lineY(E[k].data, { x: "date", y: "value", stroke: E[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(E.imports.data, { x: "date", y: "value", stroke: E.imports.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(E.imports.data.slice(-5), { x: "date", y: "value", stroke: E.imports.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === E.imports ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(1)}%`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === E.imports ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  a11y(plot, "Government consumption, exports and imports growth, year-on-year, Q1 FY17 to Q2 FY26",
    "Line chart. Imports end at " + L.imports.toFixed(1) + " per cent, exports at " + L.exports.toFixed(1) + ", government consumption at " + L.gfce.toFixed(1) + ". All three swung hard in the 2020 lockdown; imports fell " + Math.abs(trM.value).toFixed(1) + " per cent at the trough.");
  document.getElementById("plot-exp").append(plot);
  wireTools(document.getElementById("cb-exp"), plot, seriesList, "india-atlas_national-accounts_gfce-exports-imports_fy17-fy26", fmtDate);
  wireLegend(document.getElementById("legend-exp"), plot, keys, E);
  addCrosshair(document.getElementById("plot-exp"), plot, seriesList, geo, fmtDate);
}

/* ---------- annual accounts : six small multiples ---------- */
{
  const panels = [
    ["ndp", "Net domestic product", "GDP minus depreciation", "#5F6675"],
    ["gni", "Gross national income", "GDP plus net income from abroad", "#5F6675"],
    ["taxes", "Taxes on products", "One side of the GDP–GVA wedge", "#5F6675"],
    ["subsidies", "Subsidies", "The other side of the wedge", "#2E4BD8"],
    ["cfc", "Capital consumption", "Depreciation of the stock", "#5F6675"],
    ["gcf_industry", "Capital formation", "Gross, all assets", "#5F6675"],
  ];
  const fmtSigned = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
  const grid = document.getElementById("grid-acc");
  for (const [k, nm, sub, col] of panels) {
    const s = ACC[k];
    const nn = s.data.filter((d) => d.value != null);
    const last = nn.at(-1);
    const vs = nn.map((d) => d.value);
    const lo = Math.min(...vs, 0), hi = Math.max(...vs, 0);
    const pad = (hi - lo) * 0.12 + 0.5;
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #ECEEF2;padding-top:14px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
      `<div style="min-width:0"><div style="font-size:1.02rem;color:#161A22;line-height:1.35">${nm}</div>` +
      `<div style="font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:3px">${sub}</div></div>` +
      `<div style="text-align:right;flex-shrink:0"><div style="font-family:var(--serif);font-weight:300;font-size:1.55rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:${col === "#2E4BD8" ? "#2E4BD8" : "#161A22"}">${fmtSigned(last.value)}</div>` +
      `<div style="font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:3px">${fmtFY(last.date)}, y/y</div></div></div>`;
    const mini = Plot.plot({
      width: 340, height: 110, marginLeft: 4, marginRight: 10, marginTop: 10, marginBottom: 6,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [lo - pad, hi + pad] },
      marks: [
        Plot.ruleY([0], { stroke: "#DADDE3", strokeWidth: 1 }),
        Plot.lineY(nn, { x: "date", y: "value", stroke: col, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([last], { x: "date", y: "value", fill: col, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    const foot = document.createElement("div");
    foot.style.cssText = "display:flex;justify-content:space-between;font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:2px";
    foot.innerHTML = `<span>${fmtFY(nn[0].date)}</span><span>${fmtFY(last.date)}</span>`;
    div.append(foot);
    grid.append(div);
  }
  const accSeries = panels.map(([k]) => ACC[k]);
  document.getElementById("grid-acc").setAttribute("aria-label",
    "Six small line charts of annual growth: NDP, GNI, taxes on products, subsidies, capital consumption and capital formation, fiscal years FY13 to FY26. Latest values are printed beside each panel.");
  wireTools(document.getElementById("cb-acc"), null, accSeries, "india-atlas_national-accounts_annual-six-accounts", fmtFY);
}

/* ---------- §09 companion: the saving rate (annual, % of nominal GDP) ---------- */
{
  const s = ACC.saving_rate;
  const nn = s.data.filter((d) => d.value != null);
  const last = nn.at(-1), first = nn[0];
  const fmtFYs = (d) => "FY" + String(d.getUTCFullYear() + 1).slice(2);
  const geo = { W: 1184, H: 360, ml: 70, mr: 150, mt: 30, mb: 48, d0: 28, d1: 35 };
  const yTicks = [28, 30, 32, 34];
  const xTicks = nn.filter((d) => d.date.getUTCMonth() === 3).map((d) => d.date);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => "FY" + String(d.getUTCFullYear() + 1).slice(2) },
    y: { label: "↑ gross saving, % of nominal GDP", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.lineY(nn, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(nn, { x: "date", y: "value", fill: "#2E4BD8", r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot([last], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => d.value.toFixed(1) + "%", dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Gross saving rate, share of nominal GDP, " + fmtFYs(first.date) + " to " + fmtFYs(last.date),
    "Line chart. The saving rate ends at " + last.value.toFixed(1) + " per cent of GDP in " + fmtFYs(last.date) + ", down from " + first.value.toFixed(1) + " at the start of the series. India invests more than it saves; the gap is the current account.");
  document.getElementById("plot-sav").append(plot);
  wireTools(document.getElementById("cb-sav"), plot, [s], "india-atlas_national-accounts_saving-rate", fmtFYs);
  setTxt("pv-sav", last.value.toFixed(1) + "%");
  setTxt("pv-sav-c", fmtFYs(last.date) + ", % of nominal GDP");
  setTxt("sav-first", first.value.toFixed(1) + "%");
  setTxt("sav-drop", (first.value - last.value).toFixed(1) + " points");
}

/* ---------- eight engines : industry GVA small multiples ----------
 * One function for both bases: the grid, its accent rule (fastest and slowest
 * engine of the latest quarter, in blue) and its numbers. `o.ids` names the
 * page elements; each base gets its own plate. */
function enginesGrid(IND, SH, o) {
  const keys = Object.keys(IND);
  const dts = IND[keys[0]].data.map((d) => d.date);
  const latest = Object.fromEntries(keys.map((k) => [k, IND[k].data.at(-1).value]));
  // disclosed accent rule: the fastest and the slowest engine of the latest quarter
  const fastest = keys.reduce((a, k) => (latest[k] > latest[a] ? k : a));
  const slowest = keys.reduce((a, k) => (latest[k] < latest[a] ? k : a));
  const fmtSigned = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
  setTxt(o.ids.pv, f1(latest[fastest]));
  setTxt(o.ids.pvc, fmtDate(dts.at(-1)) + ", fastest: " + IND[fastest].label);
  if (o.ids.fast) setTxt(o.ids.fast, fmtSigned(latest[fastest]) + " (" + IND[fastest].label.toLowerCase() + ")");
  if (o.ids.slow) setTxt(o.ids.slow, fmtSigned(latest[slowest]) + " (" + IND[slowest].label.toLowerCase() + ")");
  if (o.ids.mfg) setTxt(o.ids.mfg, f1(latest.manufacturing));
  if (o.ids.agri) setTxt(o.ids.agri, f1(latest.agriculture));
  const grid = document.getElementById(o.grid);
  for (const k of keys) {
    const s = IND[k];
    const nn = s.data.filter((d) => d.value != null);
    const last = nn.at(-1);
    const isExtreme = k === fastest || k === slowest;
    const lineCol = "#878D99", accCol = "#2E4BD8";
    const vs = nn.map((d) => d.value);
    const lo = Math.min(...vs, 0), hi = Math.max(...vs, 0);
    const pad = (hi - lo) * 0.12 + 0.5;
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #ECEEF2;padding-top:14px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
      `<div style="min-width:0"><div style="font-size:1.02rem;color:#161A22;line-height:1.35">${s.label}</div>` +
      `<div style="font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:3px">${SH[k].toFixed(1)}% of GVA</div></div>` +
      `<div style="text-align:right;flex-shrink:0"><div style="font-family:var(--serif);font-weight:300;font-size:1.55rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:#161A22">${fmtSigned(last.value)}</div>` +
      `<div style="font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:3px">${fmtDate(last.date)}, y/y</div></div></div>`;
    const mini = Plot.plot({
      width: 280, height: 96, marginLeft: 4, marginRight: 10, marginTop: 10, marginBottom: 6,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [lo - pad, hi + pad] },
      marks: [
        Plot.ruleY([0], { stroke: "#DADDE3", strokeWidth: 1 }),
        Plot.lineY(nn, { x: "date", y: "value", stroke: lineCol, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([last], { x: "date", y: "value", fill: isExtreme ? accCol : lineCol, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    const foot = document.createElement("div");
    foot.style.cssText = "display:flex;justify-content:space-between;font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:2px";
    // review-a (2026-10): each panel has its own scale and no axis, so the foot names it:
    // the panel's low and high, and the grey rule is zero
    const vMin = Math.min(...vs), vMax = Math.max(...vs);
    foot.innerHTML = `<span>${fmtDate(nn[0].date)}</span><span>low ${fmtSigned(vMin)}, high ${fmtSigned(vMax)}; rule at 0</span><span>${fmtDate(last.date)}</span>`;
    div.append(foot);
    grid.append(div);
  }
  grid.setAttribute("aria-label",
    "Eight small line charts of quarterly real GVA growth by industry, " + o.baseLabel + ": agriculture, mining, manufacturing, utilities, construction, trade and transport, finance and real estate, public administration, " + fmtDate(dts[0]) + " to " + fmtDate(dts.at(-1)) + ". Latest year-on-year values are printed beside each panel; the fastest, " + IND[fastest].label + ", and the slowest, " + IND[slowest].label + ", are marked in blue.");
  wireTools(document.getElementById(o.cb), null, keys.map((k) => IND[k]), o.file, fmtDate);
  return { fastest, slowest, latest };
}
enginesGrid(IND, SH, { grid: "grid-ind", cb: "cb-ind", baseLabel: "base 2011-12", file: "india-atlas_national-accounts_gva-by-industry_fy17-fy26",
  ids: { pv: "pv-ind", pvc: "pv-ind-c", fast: "ex-eng-fast", slow: "ex-eng-slow", mfg: "ex-eng-mfg", agri: "ex-eng-agri" } });
{
  const r = enginesGrid(NBIND, nbIndBundle.shares, { grid: "grid-nbind", cb: "cb-nbind", baseLabel: "base 2022-23",
    file: "india-atlas_national-accounts_gva-by-industry_base2022",
    ids: { pv: "pv-nbind", pvc: "pv-nbind-c", fast: "nbind-fast", slow: "nbind-slow", mfg: "nbind-mfg", agri: "nbind-agri" } });
}

/* ---------- deflator wedge : nominal vs real GDP ---------- */
{
  const keys = ["gdp_nominal", "gdp_real", "deflator"];
  const seriesList = keys.map((k) => N[k]);
  const geo = { W: 1184, H: 470, ml: 70, mr: 230, mt: 30, mb: 48, d0: -25, d1: 35 };
  const yTicks = [-20, -10, 0, 10, 20, 30];
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.05);
  const pkD = peakOf(N.deflator);
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  /* deflator peak, placed against all three lines and the COVID rule */
  const dPlacer = makePlacer(geo, dates);
  keys.forEach((k) => dPlacer.addSeries(N[k].data));
  dPlacer.addRuleX(new Date(Date.UTC(2020, 3, 1)));
  const pkText = pkD.value.toFixed(1) + "%, " + fmtDate(pkD.date) + ", deflator peak";
  const pkSpot = annotationSpot(dPlacer, pkD, pkText, 13, [
    { x: pkD.date, y: pkD.value, anchor: "start", dx: 20, dy: 24 },
    { x: pkD.date, y: pkD.value, anchor: "end", dx: -20, dy: 24 },
    { x: pkD.date, y: pkD.value, anchor: "middle", dx: 0, dy: 44 },
    { x: pkD.date, y: pkD.value, anchor: "start", dx: 20, dy: -85 },
    { x: pkD.date, y: pkD.value, anchor: "middle", dx: 0, dy: -36 },
  ]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 32.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.lineY(N.deflator.data, { x: "date", y: "value", stroke: N.deflator.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(N.gdp_real.data, { x: "date", y: "value", stroke: N.gdp_real.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(N.gdp_nominal.data, { x: "date", y: "value", stroke: N.gdp_nominal.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(N.gdp_nominal.data.slice(-5), { x: "date", y: "value", stroke: N.gdp_nominal.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([pkD], { x: "date", y: "value", fill: N.deflator.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(pkSpot.leader, { x: "x", y: "y", stroke: "#878D99", strokeWidth: 1 }),
      Plot.text([{ date: pkSpot.textX, value: pkSpot.textY }], { x: "date", y: "value", text: [pkText], fill: "#878D99", fontSize: 12, fontFamily: mono, textAnchor: pkSpot.spot.anchor }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === N.gdp_nominal ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(1)}%`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === N.gdp_nominal ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  const Ld = N.deflator.data.at(-1).value, Ln = N.gdp_nominal.data.at(-1).value;
  a11y(plot, "Nominal GDP, real GDP and the implied deflator, year-on-year, Q1 FY17 to " + fmtDate(dates.at(-1)),
    "Line chart. Nominal GDP ends at " + Ln.toFixed(1) + " per cent, real GDP at " + L.gdp.toFixed(1) + ", the implied deflator at " + Ld.toFixed(1) + ". The deflator peaked at " + pkD.value.toFixed(1) + " per cent in " + fmtDate(pkD.date) + " and briefly turned negative in FY16.");
  document.getElementById("plot-defl").append(plot);
  wireTools(document.getElementById("cb-defl"), plot, seriesList, "india-atlas_national-accounts_nominal-real-deflator_fy17-fy26", fmtDate);
  wireLegend(document.getElementById("legend-defl"), plot, keys, N);
  addCrosshair(document.getElementById("plot-defl"), plot, seriesList, geo, fmtDate);
  setTxt("pv-defl", f1(Ld));
  setTxt("ex-defl-n", f1(Ln));
  setTxt("ex-defl-r", f1(L.gdp));
  setTxt("ex-defl-d", f1(Ld));
  setTxt("ex-defl-pk", pkD.value.toFixed(1) + "% (" + fmtDate(pkD.date) + ")");
}

/* ---------- saving rate — current prices only, so a share, not a growth ---------- */
setTxt("ac-sav", accLast("saving_rate").value.toFixed(1) + "%");
setTxt("ac-sav0", ACC.saving_rate.data.find((d) => d.value != null).value.toFixed(1) + "%");

/* ---------- the new base : 2022-23, separate axis, never spliced ---------- */
{
  const nbDates = NB.gdp.data.map((d) => d.date);
  const keys = ["gdp", "gva", "pfce", "gfcf"];
  const seriesList = keys.map((k) => NB[k]);
  const geo = { W: 1184, H: 440, ml: 70, mr: 210, mt: 30, mb: 48, d0: 0, d1: 13 };
  const yTicks = [0, 2, 4, 6, 8, 10, 12];
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.05);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      ...keys.slice(1).map((k) => Plot.lineY(NB[k].data, { x: "date", y: "value", stroke: NB[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(NB.gdp.data, { x: "date", y: "value", stroke: NB.gdp.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(NB.gdp.data.slice(-3), { x: "date", y: "value", stroke: NB.gdp.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === NB.gdp ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: nbDates.at(-1), y: p.value }, { x: nbDates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: nbDates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(1)}%`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === NB.gdp ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  const nbL = NB.gdp.data.at(-1).value;
  a11y(plot, "Real GDP, GVA and the consumption and investment engines on the 2022-23 base, year-on-year, Q1 FY24 to " + fmtDate(nbDates.at(-1)),
    "Line chart on a deliberately short axis. GDP ends at " + nbL.toFixed(1) + " per cent, GVA at " + NB.gva.data.at(-1).value.toFixed(1) + ", consumption at " + NB.pfce.data.at(-1).value.toFixed(1) + ", investment at " + NB.gfcf.data.at(-1).value.toFixed(1) + ". This series is on the new 2022-23 base and is never spliced with the 2011-12-base plates above.");
  document.getElementById("plot-nb").append(plot);
  wireTools(document.getElementById("cb-nb"), plot, seriesList, "india-atlas_national-accounts_base2022-four-engines_fy24-fy26", fmtDate);
  wireLegend(document.getElementById("legend-nb"), plot, keys, NB);
  addCrosshair(document.getElementById("plot-nb"), plot, seriesList, geo, fmtDate);
  setTxt("pv-nb", f1(nbL));
  setTxt("pv-nb-c", fmtDate(nbDates.at(-1)) + ", GDP y/y, base 2022–23");
  setTxt("nb-q3", f1(NB.gdp.data.at(-2).value));
  setTxt("nb-q4", f1(nbL));
  setTxt("nb-q3-m", fmtDate(NB.gdp.data.at(-2).date));
  setTxt("nb-q4-m", fmtDate(NB.gdp.data.at(-1).date));
  setTxt("nb-gfcf", f1(NB.gfcf.data.at(-1).value));
  // the overlap quarter, re-scored: Q1 FY26 on both bases
  const oldQ1 = S.gdp.data.at(-2);
  const newQ1 = NB.gdp.data.find((d) => d.date.getTime() === oldQ1.date.getTime());
  setTxt("nb-old-q1", f1(oldQ1.value));
  setTxt("nb-new-q1", f1(newQ1.value));
  setTxt("nb-gap", Math.abs(oldQ1.value - newQ1.value).toFixed(1) + " pt");
}

/* ---------- §11 seventy-five years: the NSO back series beside both bases ----------
 * Three rulers on one time axis, never joined: the back series (1951-52 to
 * 2011-12, at 2011-12 prices, the NSO's own back-cast), the 2011-12 base's
 * annual series (FY13 on) and the 2022-23 base's (FY24 on). The back series
 * is what the plate is about, so it carries the accent. */
const fyLabel = (d) => { const y = d.getUTCFullYear(); return y + "-" + String((y + 1) % 100).padStart(2, "0"); };
{
  const back = { ...BACK.gdp, key: "lh_back", label: "NSO back series, 2011-12 prices", color: "#2E4BD8" };
  const b11 = { ...ACC.gdp, key: "lh_b11", label: "Base 2011-12", color: "#878D99" };
  const b22 = { ...NBACC.gdp, key: "lh_b22", label: "Base 2022-23", color: "#5F6675" };
  const lines = [back, b11, b22].map((x) => ({ ...x, data: x.data.filter((d) => d.value != null) }));
  const all = lines.flatMap((x) => x.data.map((d) => d.value));
  const lo = Math.floor(Math.min(...all) / 2) * 2, hi = Math.ceil(Math.max(...all) / 2) * 2;
  const geo = { W: 1184, H: 480, ml: 70, mr: 190, mt: 36, mb: 48, d0: lo, d1: hi };
  const yTicks = []; for (let t = lo; t <= hi; t += 2) yTicks.push(t);
  const y0 = back.data[0].date.getUTCFullYear(), y1 = lines.reduce((m, x) => Math.max(m, x.data.at(-1).date.getUTCFullYear()), 0);
  const xTicks = []; for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) xTicks.push(new Date(Date.UTC(y, 3, 1)));
  const low = back.data.reduce((a, d) => (d.value < a.value ? d : a));
  const high = back.data.reduce((a, d) => (d.value > a.value ? d : a));
  // end labels for the two current series only: the back series ends in
  // 2011-12, far from the right edge, and is named by the legend instead
  const dodged = dodgeEndLabels(lines.slice(1), (hi - lo) * 0.05);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ real GDP growth, fiscal year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      // the shared seam: three rulers side by side, never joined. No marker: the back series
      // ends in 2011-12 and the 2011-12 base's annual growth starts a year later, so the rulers
      // never meet. The back series, the plate's subject, is drawn last, on top.
      ...seamMarks("side", [lines[1], lines[2], lines[0]], false),
      Plot.dot([low], { x: "date", y: "value", fill: back.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([low], { x: "date", y: "value", text: (d) => `${fyLabel(d.date)}, ${d.value < 0 ? "−" : ""}${Math.abs(d.value).toFixed(1)}%`, dy: 16, fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "middle" }),
      ...lines.map((x) => Plot.dot([x.data.at(-1)], { x: "date", y: "value", fill: x.color, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 })),
      ...dodged.filter((d) => Math.abs(d.y - d.value) > 0.05).map((d) => Plot.line([{ x: d.s.data.at(-1).date, y: d.value }, { x: d.s.data.at(-1).date, y: d.y }], { x: "x", y: "y", stroke: d.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((d) => Plot.text([{ date: d.s.data.at(-1).date, y: d.y }], {
        x: "date", y: "y", text: () => `${d.s.label} ${d.value.toFixed(1)}%`, dx: 16, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" })),
    ],
  });
  a11y(plot, `Real GDP growth by fiscal year, ${fyLabel(back.data[0].date)} to ${fyLabel(lines[2].data.at(-1).date)}, on three separate rulers`,
    `A long blue line, the NSO's own back series at 2011-12 prices, runs from ${fyLabel(back.data[0].date)} to ${fyLabel(back.data.at(-1).date)}; its low is ${low.value.toFixed(1)} per cent in ${fyLabel(low.date)} and its high ${high.value.toFixed(1)} per cent in ${fyLabel(high.date)}. Two grey lines continue on the 2011-12 base from ${fyLabel(b11.data.find((d) => d.value != null).date)} and on the 2022-23 base from ${fyLabel(lines[2].data[0].date)}. The three are separate series and are not joined.`);
  document.getElementById("plot-lh").append(plot);
  wireTools(document.getElementById("cb-lh"), plot, lines, "india-atlas_national-accounts_gdp-growth_back-series_1951-2026", (d) => fyLabel(d));
  wireLegend(document.getElementById("legend-lh"), plot, ["lh_back", "lh_b11", "lh_b22"], { lh_back: { color: back.color }, lh_b11: { color: b11.color }, lh_b22: { color: b22.color } });
  setTxt("pv-lh", (back.data.reduce((a, d) => a + d.value, 0) / back.data.length).toFixed(1) + "%");
  setTxt("pv-lh-c", `average, ${fyLabel(back.data[0].date)} to ${fyLabel(back.data.at(-1).date)}`);
  // decade averages of the back series, the plate's reading
  const dec = (from, to) => { const v = back.data.filter((d) => { const y = d.date.getUTCFullYear(); return y >= from && y <= to; }).map((d) => d.value); return (v.reduce((a, x) => a + x, 0) / v.length).toFixed(1) + "%"; };
  setTxt("lh-5079", dec(1951, 1979)); setTxt("lh-8090", dec(1980, 1990)); setTxt("lh-9111", dec(1991, 2011));
  setTxt("lh-low", `${low.value < 0 ? "−" : ""}${Math.abs(low.value).toFixed(1)}% in ${fyLabel(low.date)}`);
  setTxt("lh-high", `${high.value.toFixed(1)}% in ${fyLabel(high.date)}`);
  setTxt("lh-last-back", `${back.data.at(-1).value.toFixed(1)}% in ${fyLabel(back.data.at(-1).date)}`);
  const b11First = b11.data.find((d) => d.value != null);
  setTxt("lh-first-b11", `${b11First.value.toFixed(1)}% in ${fyLabel(b11First.date)}`);
}

/* ---------- §11 companion: saving and investment, 1951-52 to 2011-12 ----------
 * Shares of nominal GDP from the back series. Saving is the subject (accent);
 * investment is the comparison (marigold). */
{
  const sv = { ...BACK.saving_rate, key: "si_sav", label: "Gross saving", color: "#2E4BD8" };
  const iv = { ...BACK.gfcf_rate, key: "si_inv", label: "Fixed investment", color: "#C47A16" };
  const lines = [sv, iv].map((x) => ({ ...x, data: x.data.filter((d) => d.value != null) }));
  const all = lines.flatMap((x) => x.data.map((d) => d.value));
  const hi = Math.ceil(Math.max(...all) / 5) * 5;
  const geo = { W: 1184, H: 420, ml: 70, mr: 220, mt: 30, mb: 48, d0: 0, d1: hi };
  const yTicks = []; for (let t = 0; t <= hi; t += 10) yTicks.push(t);
  const xTicks = []; for (let y = 1960; y <= 2010; y += 10) xTicks.push(new Date(Date.UTC(y, 3, 1)));
  const dodged = dodgeEndLabels(lines, hi * 0.05);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ share of nominal GDP, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.lineY(lines[1].data, { x: "date", y: "value", stroke: iv.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(lines[0].data, { x: "date", y: "value", stroke: sv.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...lines.map((x) => Plot.dot([x.data.at(-1)], { x: "date", y: "value", fill: x.color, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 })),
      ...dodged.map((d) => Plot.text([{ date: d.s.data.at(-1).date, y: d.y }], { x: "date", y: "y", text: () => `${d.s.label} ${d.value.toFixed(1)}%`, dx: 16, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" })),
    ],
  });
  const f = (x, i) => x.data[i];
  a11y(plot, `Gross saving and fixed investment as shares of nominal GDP, ${fyLabel(sv.data[0].date)} to ${fyLabel(sv.data.at(-1).date)}`,
    `Two lines. Saving rises from ${f(lines[0], 0).value.toFixed(1)} per cent of GDP in ${fyLabel(f(lines[0], 0).date)} to ${lines[0].data.at(-1).value.toFixed(1)} in ${fyLabel(lines[0].data.at(-1).date)}; fixed investment from ${f(lines[1], 0).value.toFixed(1)} to ${lines[1].data.at(-1).value.toFixed(1)}.`);
  document.getElementById("plot-si").append(plot);
  wireTools(document.getElementById("cb-si"), plot, lines, "india-atlas_national-accounts_saving-investment_back-series_1951-2012", (d) => fyLabel(d));
  wireLegend(document.getElementById("legend-si"), plot, ["si_sav", "si_inv"], { si_sav: { color: sv.color }, si_inv: { color: iv.color } });
  const pk = lines[0].data.reduce((a, d) => (d.value > a.value ? d : a));
  setTxt("pv-si", lines[0].data.at(-1).value.toFixed(1) + "%");
  setTxt("pv-si-c", fyLabel(lines[0].data.at(-1).date) + ", saving, % of GDP");
  setTxt("si-first", `${lines[0].data[0].value.toFixed(1)}% in ${fyLabel(lines[0].data[0].date)}`);
  setTxt("si-peak", `${pk.value.toFixed(1)}% in ${fyLabel(pk.date)}`);
  setTxt("si-inv-first", lines[1].data[0].value.toFixed(1) + "%");
  setTxt("si-inv-last", lines[1].data.at(-1).value.toFixed(1) + "%");
}

/* ---------- ledger sparklines ---------- */
spark("nspark-gdp", NB.gdp);
for (const [k] of regRows) spark("sp-" + k, NBX[k]);

/* ====================================================================================
 * The deep accounts (wave 2): §10 where the money goes, income from abroad, the
 * discrepancy; §11 who saves; §12 sub-industries; §13 revisions; §15 what India makes.
 * Data: GD, baked by the page from the gdp-*-annual, -sectors, -revisions and back bundles.
 * Rulers (back series, base 2011-12, base 2022-23) are drawn side by side, never joined.
 * ==================================================================================== */
const ISO = (d) => new Date(d + "T00:00:00Z");
const pts = (block, k) => (block?.s?.[k] ?? []).map((v, i) => ({ date: ISO(block.dates[i]), value: v })).filter((d) => d.value != null);
const fyL = (d) => { const y = d.getUTCFullYear(); return y + "-" + String((y + 1) % 100).padStart(2, "0"); };
const pct1 = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
const RULERS = [["back", "NSO back series", "#2E4BD8"], ["b11", "base 2011-12", "#A3A9B4"], ["b22", "base 2022-23", "#161A22"]];

/* small multiples over three rulers: one panel per key, each on its own scale. The header
 * prints the newest ruler's latest value; the foot names the span. */
function rulerGrid(gridId, src, panels, file) {
  const grid = document.getElementById(gridId);
  if (!grid) return [];
  const csv = [];
  for (const [k, nm, sub] of panels) {
    const rulers = RULERS.map(([r, lab, color]) => ({ key: r, label: `${nm}, ${lab}`, name: `${k}_${r}`, color, data: pts(src[r], k) })).filter((r) => r.data.length);
    if (!rulers.length) continue;
    csv.push(...rulers);
    const newest = rulers.at(-1), last = newest.data.at(-1);
    const vs = rulers.flatMap((r) => r.data.map((d) => d.value));
    const lo = Math.min(...vs, 0), hi = Math.max(...vs, 0), pad = (hi - lo) * 0.1 + 0.2;
    const first = rulers[0].data[0];
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #ECEEF2;padding-top:14px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
      `<div style="min-width:0"><div style="font-size:1.02rem;color:#161A22;line-height:1.35">${nm}</div>` +
      `<div style="font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:3px">${sub}</div></div>` +
      `<div style="text-align:right;flex-shrink:0"><div style="font-family:var(--serif);font-weight:300;font-size:1.55rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:#161A22">${pct1(last.value)}</div>` +
      `<div style="font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:3px">${fyL(last.date)}, ${RULERS.find(([r]) => r === newest.key)[1]}</div></div></div>`;
    const marks = [Plot.ruleY([0], { stroke: "#DADDE3", strokeWidth: 1 })];
    marks.push(...(rulers.length > 1 ? seamMarks("side", rulers.map((r, i) => ({ ...r, width: i === rulers.length - 1 ? 2 : 1.6 })), false) : [Plot.lineY(rulers[0].data, { x: "date", y: "value", stroke: rulers[0].color, strokeWidth: 1.75 })]));
    marks.push(Plot.dot([last], { x: "date", y: "value", fill: newest.color, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }));
    const mini = Plot.plot({
      width: 300, height: 104, marginLeft: 4, marginRight: 10, marginTop: 10, marginBottom: 6,
      style: { background: "transparent" }, x: { axis: null }, y: { axis: null, domain: [lo - pad, hi + pad] }, marks,
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    const foot = document.createElement("div");
    foot.style.cssText = "display:flex;justify-content:space-between;font-family:var(--sans);font-size:.75rem;color:#6B7180;margin-top:2px";
    foot.innerHTML = `<span>${fyL(first.date)}, ${pct1(first.value)}</span><span>${fyL(last.date)}</span>`;
    div.append(foot);
    grid.append(div);
  }
  return csv;
}

/* ---------- §10 where the money goes ---------- */
{
  const panels = [
    ["pfce", "Consumption", "Households' spending, PFCE"],
    ["gfcf", "Fixed investment", "Buildings, machines, roads, GFCF"],
    ["gfce", "Government consumption", "The state's own services, GFCE"],
    ["stocks", "Change in stocks", "Goods added to inventories"],
    ["valuables", "Valuables", "Gold, silver, jewellery"],
    ["net_exports", "Net exports", "Exports less imports"],
  ];
  const csv = rulerGrid("grid-spend", GD.spend, panels);
  document.getElementById("grid-spend")?.setAttribute("aria-label", "Six small line charts of spending as a share of GDP: consumption, fixed investment, government consumption, change in stocks, valuables and net exports, on the NSO back series and the two current bases, never joined.");
  wireTools(document.getElementById("cb-spend"), null, csv, "india-atlas_national-accounts_spending-shares_1950-2026", fyL);
  const b22 = GD.spend.b22, b11 = GD.spend.b11;
  const lastI = b22.s.pfce.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).at(-1);
  const y = b22.dates[lastI], v = (k) => b22.s[k][lastI];
  const oldI = b11.dates.indexOf(y), old = oldI >= 0 ? b11.s.pfce[oldI] : null;
  setTxt("pv-spend", pct1(v("pfce")));
  setTxt("pv-spend-c", fyL(ISO(y)) + ", consumption, base 2022–23");
  setTxt("wm-pfce", pct1(v("pfce"))); setTxt("wm-gfcf", pct1(v("gfcf"))); setTxt("wm-gfce", pct1(v("gfce")));
  setTxt("wm-val", pct1(v("valuables"))); setTxt("wm-stk", pct1(v("stocks")));
  setTxt("wm-val-cmp", v("valuables") > v("stocks") ? "more than" : v("valuables") < v("stocks") ? "less than" : "the same as");
  setTxt("wm-nx", pct1(Math.abs(v("net_exports"))));
  setTxt("wm-pfce-old", old == null ? "—" : pct1(old));
  setTxt("wm-gap", old == null ? "—" : Math.abs(old - v("pfce")).toFixed(1) + " points");
  const p11 = b11.s.pfce.filter((x) => x != null);
  const move = Math.max(...p11.slice(1).map((x, i) => Math.abs(x - p11[i])));
  setTxt("wm-move", move.toFixed(1) + " points");
}

/* ---------- §10 income from abroad ---------- */
{
  const panels = [
    ["transfers_row", "Net current transfers from abroad", "Mostly remittances from Indians working abroad"],
    ["primary_income_row", "Net primary income from abroad", "Interest, profits and wages crossing the border"],
  ];
  const csv = rulerGrid("grid-abroad", GD.abroad, panels);
  document.getElementById("grid-abroad")?.setAttribute("aria-label", "Two small line charts, shares of GDP since 1950-51: net current transfers from abroad, rising from near zero to about 3 per cent, and net primary income, below zero, on three rulers never joined.");
  wireTools(document.getElementById("cb-abroad"), null, csv, "india-atlas_national-accounts_income-from-abroad_1950-2026", fyL);
  const t = pts(GD.abroad.b22, "transfers_row").at(-1), p = pts(GD.abroad.b22, "primary_income_row").at(-1);
  const t0 = pts(GD.abroad.back, "transfers_row")[0];
  setTxt("pv-abroad", pct1(t.value));
  setTxt("pv-abroad-c", fyL(t.date) + ", transfers, % of GDP");
  setTxt("ab-tr", pct1(t.value)); setTxt("ab-tr0", pct1(t0.value)); setTxt("ab-tr0-y", fyL(t0.date)); setTxt("ab-pi", pct1(p.value));
  setTxt("ab-gndi", (100 + t.value + p.value).toFixed(1) + "%");
}

/* ---------- §10 the discrepancy: two ways of adding up ---------- */
{
  const a = { key: "b11", label: "Discrepancy, base 2011-12", name: "discrepancy_pct_gdp_base2011", color: "#A3A9B4", data: pts(GD.disc.q11, "discrepancy") };
  const b = { key: "b22", label: "Discrepancy, base 2022-23", name: "discrepancy_pct_gdp_base2022", color: "#2E4BD8", data: pts(GD.disc.q22, "discrepancy") };
  const all = [...a.data, ...b.data].map((d) => d.value);
  const lo = Math.floor(Math.min(...all)) - 1, hi = Math.ceil(Math.max(...all)) + 1;
  const geo = { W: 1184, H: 400, ml: 70, mr: 200, mt: 30, mb: 48, d0: lo, d1: hi };
  const yTicks = []; for (let t = Math.ceil(lo / 2) * 2; t <= hi; t += 2) yTicks.push(t);
  const xTicks = []; for (let y = 2012; y <= b.data.at(-1).date.getUTCFullYear(); y += 2) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const dodged = dodgeEndLabels([a, b], (hi - lo) * 0.06);
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ GDP less spending, % of GDP", labelAnchor: "top", labelArrow: false, ticks: yTicks, domain: [lo, hi], tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d === yTicks.at(-1) ? d + "%" : (d < 0 ? "−" + Math.abs(d) : String(d))) },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      ...seamMarks("overlap", [a, b], false),
      Plot.dot(b.data, { x: "date", y: "value", fill: b.color, r: 2.5 }),
      ...[a, b].map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([{ x: p.s.data.at(-1).date, y: p.value }, { x: p.s.data.at(-1).date, y: p.y }], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: p.s.data.at(-1).date, y: p.y }], { x: "date", y: "y", text: () => `${p.s.key === "b22" ? "Base 2022–23" : "Base 2011–12"} ${pct1(p.value)}`, dx: 14, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" })),
    ],
  });
  const mean = (xs) => xs.reduce((s, d) => s + Math.abs(d.value), 0) / xs.length;
  a11y(plot, "The discrepancy between GDP and its spending components, share of GDP, quarterly, both bases",
    `Two lines around zero. On the 2011-12 base the gap swings up to ${Math.max(...a.data.map((d) => Math.abs(d.value))).toFixed(1)} per cent of GDP; on the 2022-23 base up to ${Math.max(...b.data.map((d) => Math.abs(d.value))).toFixed(1)}. The latest quarter reads ${b.data.at(-1).value.toFixed(1)} per cent.`);
  document.getElementById("plot-disc").append(plot);
  wireTools(document.getElementById("cb-disc"), plot, [a, b], "india-atlas_national-accounts_discrepancy_quarterly", fmtDate);
  addCrosshair(document.getElementById("plot-disc"), plot, [a, b], geo, fmtDate);
  setTxt("pv-disc", pct1(b.data.at(-1).value));
  setTxt("pv-disc-c", fmtDate(b.data.at(-1).date) + ", % of GDP");
  setTxt("dc-last", pct1(b.data.at(-1).value));
  setTxt("dc-n", String(b.data.length));
  setTxt("dc-mean", mean(b.data).toFixed(1) + "%");
  setTxt("dc-mean11", mean(a.data).toFixed(1) + "%");
  const zero = (GD.spend.b22.s.discrepancy ?? []).map((v, i) => (v === 0 ? fyL(ISO(GD.spend.b22.dates[i])) : null)).filter(Boolean);
  setTxt("dc-zero", zero.length ? zero.join(" and ") : "none so far");
}

/* ---------- §11 who saves, who invests: one dumbbell per sector ---------- */
{
  const src = GD.sect.b22;
  const SECTORS = [["households", "Households"], ["private_nfc", "Private companies"], ["private_fc", "Private financial firms"], ["public_nfc", "Public-sector companies"], ["public_fc", "Public financial firms"], ["government", "General government"]];
  const li = src.s.saving_households_pct_gdp.map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0).at(-1);
  const year = fyL(ISO(src.dates[li]));
  const rows = SECTORS.map(([k, nm]) => ({ k, nm, s: src.s[`saving_${k}_pct_gdp`][li], i: src.s[`gfcf_${k}_pct_gdp`][li] }));
  const all = rows.flatMap((r) => [r.s, r.i]);
  const lo = Math.floor(Math.min(...all, 0)) - 2, hi = Math.ceil(Math.max(...all)) + 3;
  const H = 70 + rows.length * 54;
  const left = rows.map((r) => ({ nm: r.nm, v: Math.min(r.s, r.i), kind: r.s <= r.i ? "s" : "i" }));
  const right = rows.map((r) => ({ nm: r.nm, v: Math.max(r.s, r.i), kind: r.s > r.i ? "s" : "i" }));
  const xTicks = []; for (let t = Math.ceil(lo / 5) * 5; t <= hi; t += 5) xTicks.push(t);
  const plot = Plot.plot({
    width: 1184, height: H, marginLeft: 220, marginRight: 60, marginTop: 30, marginBottom: 40,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "share of GDP, per cent →", labelAnchor: "right", labelArrow: false, domain: [lo, hi], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d < 0 ? "−" + Math.abs(d) : String(d)) },
    y: { label: null, domain: rows.map((r) => r.nm), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleY(rows, { y: "nm", x1: (r) => Math.min(r.s, r.i), x2: (r) => Math.max(r.s, r.i), stroke: "#C9CED6", strokeWidth: 2 }),
      Plot.dot(rows, { y: "nm", x: "i", fill: "#C47A16", r: 5.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "nm", x: "s", fill: "#2E4BD8", r: 5.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      // labels outside the two dots, never between them
      Plot.text(left, { y: "nm", x: "v", text: (d) => pct1(d.v), dx: -12, textAnchor: "end", fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(right, { y: "nm", x: "v", text: (d) => pct1(d.v), dx: 12, textAnchor: "start", fill: "#161A22", fontSize: 12, fontFamily: mono }),
    ],
  });
  const hh = rows[0], gg = rows.at(-1), pc = rows[1];
  a11y(plot, `Gross saving and fixed investment by institutional sector, share of GDP, ${year}`,
    `Dumbbells, one per sector. Households save ${hh.s.toFixed(1)} per cent of GDP and invest ${hh.i.toFixed(1)}. Private companies save ${pc.s.toFixed(1)} and invest ${pc.i.toFixed(1)}. General government saves ${gg.s.toFixed(1)} and invests ${gg.i.toFixed(1)}.`);
  document.getElementById("plot-sect").append(plot);
  wireTools(document.getElementById("cb-sect"), plot, [
    { name: `gross_saving_pct_of_gdp_${year}`, data: rows.map((r) => ({ date: r.nm, value: r.s })) },
    { name: `gfcf_pct_of_gdp_${year}`, data: rows.map((r) => ({ date: r.nm, value: r.i })) },
  ], "india-atlas_national-accounts_saving-investment-by-sector_" + year, (d) => d);
  setTxt("pv-sect", pct1(hh.s - hh.i));
  setTxt("pv-sect-c", year + ", households' surplus, % of GDP");
  setTxt("se-hh-s", pct1(hh.s)); setTxt("se-hh-i", pct1(hh.i)); setTxt("se-hh-gap", (hh.s - hh.i).toFixed(1) + " points");
  setTxt("se-pc-i", pct1(pc.i)); setTxt("se-pc-s", pct1(pc.s));
  setTxt("se-gg-s", pct1(gg.s)); setTxt("se-gg-i", pct1(gg.i));
  setTxt("se-tot-s", pct1(src.s.saving_total_pct_gdp[li]));
}

/* ---------- §11 household and government saving over time, two rulers ---------- */
{
  const mk = (blk, k, lab, color, opacity, r) => ({ key: `${k}_${r}`, label: lab, name: `${k}_${r}`, color, opacity, data: pts(blk, k) });
  const hh11 = mk(GD.sect.b11, "saving_households_pct_gdp", "Households, base 2011-12", "#2E4BD8", 0.4, "b11");
  const hh22 = mk(GD.sect.b22, "saving_households_pct_gdp", "Households, base 2022-23", "#2E4BD8", 1, "b22");
  const gg11 = mk(GD.sect.b11, "saving_government_pct_gdp", "Government, base 2011-12", "#C47A16", 0.4, "b11");
  const gg22 = mk(GD.sect.b22, "saving_government_pct_gdp", "Government, base 2022-23", "#C47A16", 1, "b22");
  const lines = [hh11, hh22, gg11, gg22];
  const all = lines.flatMap((l) => l.data.map((d) => d.value));
  const lo = Math.floor(Math.min(...all) / 5) * 5, hi = Math.ceil(Math.max(...all) / 5) * 5;
  const geo = { W: 1184, H: 440, ml: 70, mr: 230, mt: 30, mb: 48, d0: lo, d1: hi };
  const yTicks = []; for (let t = lo; t <= hi; t += 5) yTicks.push(t);
  const xTicks = []; for (let y = 2012; y <= hh22.data.at(-1).date.getUTCFullYear(); y += 2) xTicks.push(new Date(Date.UTC(y, 3, 1)));
  const ends = [hh22, gg22];
  const dodged = dodgeEndLabels(ends, (hi - lo) * 0.06);
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(fyL(d)) },
    y: { label: "↑ gross saving, % of GDP", labelAnchor: "top", labelArrow: false, ticks: yTicks, domain: [lo, hi], tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d === yTicks.at(-1) ? d + "%" : (d < 0 ? "−" + Math.abs(d) : String(d))) },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      ...seamMarks("overlap", [hh11, hh22], false),
      ...seamMarks("overlap", [gg11, gg22], false),
      ...lines.map((l) => Plot.dot(l.data, { x: "date", y: "value", fill: l.color, fillOpacity: l.opacity, r: 2.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([{ x: p.s.data.at(-1).date, y: p.value }, { x: p.s.data.at(-1).date, y: p.y }], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: p.s.data.at(-1).date, y: p.y }], { x: "date", y: "y", text: () => `${p.s.label.split(",")[0]} ${pct1(p.value)}`, dx: 14, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" })),
    ],
  });
  const ggLow = gg11.data.reduce((m, d) => (d.value < m.value ? d : m));
  const hhAt = hh11.data.find((d) => d.date.getTime() === ggLow.date.getTime());
  const before = hh11.data.filter((d) => d.date < ggLow.date && d.value >= hhAt.value);
  a11y(plot, "Household and government gross saving, share of GDP, both bases",
    `Households save between ${Math.min(...hh11.data.map((d) => d.value)).toFixed(1)} and ${Math.max(...hh11.data.map((d) => d.value)).toFixed(1)} per cent of GDP on the 2011-12 base; government saving falls to ${ggLow.value.toFixed(1)} in ${fyL(ggLow.date)}. The 2022-23 base reads households at ${hh22.data.at(-1).value.toFixed(1)} in ${fyL(hh22.data.at(-1).date)}.`);
  document.getElementById("plot-hh").append(plot);
  wireTools(document.getElementById("cb-hh"), plot, lines, "india-atlas_national-accounts_household-government-saving", fyL);
  addCrosshair(document.getElementById("plot-hh"), plot, lines, geo, fyL);
  setTxt("pv-hh", pct1(hh22.data.at(-1).value));
  setTxt("pv-hh-c", fyL(hh22.data.at(-1).date) + ", households, base 2022–23");
  setTxt("hh-gg-low", pct1(ggLow.value)); setTxt("hh-gg-low-y", fyL(ggLow.date));
  setTxt("hh-2020", pct1(hhAt.value));
  setTxt("hh-2020-since", before.length ? fyL(before.at(-1).date) : "the series began");
  setTxt("hh-new", pct1(hh22.data.at(-1).value));
}

/* ---------- §12 sub-industries: compound real growth, one dot each ---------- */
{
  const rows = [...(GD.sub?.rows ?? [])].sort((a, b) => b.cagr - a.cagr);
  const ACC = new Set(["crops", "livestock", "fishing"]);
  const lo = Math.floor(Math.min(...rows.map((r) => r.cagr), 0)), hi = Math.ceil(Math.max(...rows.map((r) => r.cagr))) + 2;
  const xTicks = []; for (let t = lo; t <= hi; t += 2) xTicks.push(t);
  const plot = Plot.plot({
    width: 1184, height: 60 + rows.length * 30, marginLeft: 290, marginRight: 150, marginTop: 30, marginBottom: 40,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "average real growth a year, per cent →", labelAnchor: "right", labelArrow: false, domain: [lo, hi], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => d + "%" },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleY(rows, { y: "label", x1: 0, x2: "cagr", stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.dot(rows, { y: "label", x: "cagr", fill: (r) => (ACC.has(r.key) ? "#2E4BD8" : "#878D99"), r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.text(rows, { y: "label", x: "cagr", text: (r) => `${r.cagr.toFixed(1)}%, ${r.share1.toFixed(1)}% of GVA`, dx: 12, textAnchor: "start", fill: "#161A22", fontSize: 11.5, fontFamily: mono }),
    ],
  });
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  const from = fyL(ISO(GD.sub.from)), to = fyL(ISO(GD.sub.to));
  a11y(plot, `Average annual real growth of GVA by sub-industry, ${from} to ${to}`,
    `Eighteen dots, sorted. Fastest: ${rows[0].label}, ${rows[0].cagr.toFixed(1)} per cent a year. Slowest: ${rows.at(-1).label}, ${rows.at(-1).cagr.toFixed(1)}. Crops grew ${by.crops.cagr.toFixed(1)}, livestock ${by.livestock.cagr.toFixed(1)}, fishing ${by.fishing.cagr.toFixed(1)}.`);
  document.getElementById("plot-sub").append(plot);
  wireTools(document.getElementById("cb-sub"), plot, [
    { name: `average_real_growth_pct_${from}_to_${to}`, data: rows.map((r) => ({ date: r.label, value: r.cagr })) },
    { name: `share_of_nominal_gva_${from}`, data: rows.map((r) => ({ date: r.label, value: r.share0 })) },
    { name: `share_of_nominal_gva_${to}`, data: rows.map((r) => ({ date: r.label, value: r.share1 })) },
  ], "india-atlas_national-accounts_sub-industries_" + from + "_" + to, (d) => d);
  setTxt("pv-sub", by.livestock.cagr.toFixed(1) + "%");
  setTxt("pv-sub-c", "livestock, a year, " + from + " to " + to);
  setTxt("sb-crops0", by.crops.share0.toFixed(1) + "%"); setTxt("sb-crops1", by.crops.share1.toFixed(1) + "%");
  setTxt("sb-live0", by.livestock.share0.toFixed(1) + "%"); setTxt("sb-live1", by.livestock.share1.toFixed(1) + "%");
  setTxt("sb-food", by.food_products.cagr.toFixed(1) + "%"); setTxt("sb-mach", by.machinery.cagr.toFixed(1) + "%");
  // the new base's last sub-industry year, from the every-cut bundle the page lists
  setTxt("sb-new", GD.sub.newTo ? fyL(ISO(GD.sub.newTo)) : "—");
}

/* ---------- §13 revisions: each year's path from its first print ---------- */
{
  const STG = [["fae", "First advance"], ["sae", "Second advance"], ["pe", "Provisional"], ["fre", "First revised"], ["sre", "Second revised"], ["tre", "Third revised or final"]];
  const src = GD.rev.b11;
  const years = src.dates.map((d, i) => ({ d, i })).filter(({ i }) => src.s.gdp_growth_fae_real?.[i] != null);
  const paths = years.map(({ d, i }) => {
    const first = src.s.gdp_growth_fae_real[i];
    const steps = STG.map(([k, nm], j) => {
      const v = k === "tre" ? (src.s.gdp_growth_tre_real?.[i] ?? src.s.gdp_growth_final_real?.[i]) : src.s[`gdp_growth_${k}_real`]?.[i];
      return v == null ? null : { x: j, v, rev: v - first, stage: nm };
    }).filter(Boolean);
    return { fy: fyL(ISO(d)), first, steps, last: steps.at(-1) };
  }).filter((p) => p.steps.length > 1);
  const up = paths.reduce((m, p) => (p.last.rev > m.last.rev ? p : m)), down = paths.reduce((m, p) => (p.last.rev < m.last.rev ? p : m));
  const hl = new Set([up.fy, down.fy]);
  const all = paths.flatMap((p) => p.steps.map((s) => s.rev));
  const lo = Math.floor(Math.min(...all) * 2) / 2 - 0.5, hi = Math.ceil(Math.max(...all) * 2) / 2 + 0.5;
  const yTicks = []; for (let t = Math.ceil(lo); t <= hi; t += 1) yTicks.push(t);
  const rowsAll = paths.flatMap((p) => p.steps.map((s) => ({ ...s, fy: p.fy })));
  const sgnPt = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + " pt";
  const plot = Plot.plot({
    width: 1184, height: 460, marginLeft: 70, marginRight: 230, marginTop: 30, marginBottom: 52,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain: [-0.2, STG.length - 0.8], ticks: STG.map((_, j) => j), tickFormat: (j) => String(STG[j][1]), tickSize: 0, tickPadding: 16 },
    y: { label: "↑ change from the first print, percentage points", labelAnchor: "top", labelArrow: false, domain: [lo, hi], ticks: yTicks, tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d > 0 ? "+" + d : d < 0 ? "−" + Math.abs(d) : "0") },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.line(rowsAll.filter((r) => !hl.has(r.fy)), { x: "x", y: "rev", z: "fy", stroke: "#C9CED6", strokeWidth: 1.25 }),
      Plot.line(rowsAll.filter((r) => hl.has(r.fy)), { x: "x", y: "rev", z: "fy", stroke: "#2E4BD8", strokeWidth: 2.25 }),
      Plot.dot(rowsAll.filter((r) => hl.has(r.fy)), { x: "x", y: "rev", fill: "#2E4BD8", r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      ...[up, down].map((p) => Plot.text([p.last], { x: "x", y: "rev", text: () => `${p.fy}: ${pct1(p.first)} first, ${pct1(p.last.v)} now`, dx: 12, textAnchor: "start", fill: "#161A22", fontSize: 12, fontFamily: mono })),
    ],
  });
  const revs = paths.map((p) => p.last.rev);
  const meanAbs = revs.reduce((s, v) => s + Math.abs(v), 0) / revs.length;
  a11y(plot, "How each year's GDP growth moved from its first advance estimate, base 2011-12",
    `${paths.length} grey lines start at zero and move as later estimates arrive. Highlighted: ${up.fy}, first ${up.first.toFixed(1)} per cent, now ${up.last.v.toFixed(1)}; and ${down.fy}, first ${down.first.toFixed(1)}, now ${down.last.v.toFixed(1)}. The average move was ${meanAbs.toFixed(1)} points.`);
  document.getElementById("plot-rev").append(plot);
  wireTools(document.getElementById("cb-rev"), plot, STG.map(([k, nm]) => ({
    name: `gdp_real_growth_${k}`, data: paths.map((p) => ({ date: p.fy, value: p.steps.find((s) => s.stage === nm)?.v ?? null })),
  })), "india-atlas_national-accounts_gdp-revisions_base2011", (d) => d);
  setTxt("pv-rev", meanAbs.toFixed(1) + " pt");
  setTxt("pv-rev-c", "average move, first print to latest");
  setTxt("rv-n", String(paths.length));
  setTxt("rv-mean", meanAbs.toFixed(1) + " points");
  setTxt("rv-up", String(revs.filter((v) => v > 0).length));
  setTxt("rv-max", `${sgnPt(up.last.rev)} (${up.fy})`);
  setTxt("rv-min", `${sgnPt(down.last.rev)} (${down.fy})`);
  const r22 = GD.rev.b22, n22 = r22.dates.filter((d, i) => ["pe", "fre", "final"].some((k) => r22.s[`gdp_growth_${k}_real`]?.[i] != null)).length;
  setTxt("rv-22", `it holds ${n22} years, each at a single stage so far`);
}

/* ---------- §15 what India makes: industry shares since 1950-51 ---------- */
{
  const panels = [
    ["agriculture_share", "Agriculture", "Crops, livestock, forestry, fishing"],
    ["manufacturing_share", "Manufacturing", "Factories and workshops"],
    ["construction_share", "Construction", "Buildings, roads, works"],
    ["trade_hotels_share", "Trade, hotels, restaurants", "Shops, repair, eating out"],
    ["transport_share", "Transport and communication", "Rail, road, air, phones"],
    ["finance_share", "Financial services", "Banks, insurance"],
    ["realty_share", "Real estate and professional", "Dwellings, IT, consulting"],
    ["public_admin_share", "Public administration", "Government and defence"],
    ["other_services_share", "Other services", "Schools, hospitals, personal"],
    ["mining_share", "Mining", "Coal, oil, ores"],
    ["utilities_share", "Electricity, gas, water", "The utilities"],
  ];
  const csv = rulerGrid("grid-make", GD.make, panels);
  document.getElementById("grid-make")?.setAttribute("aria-label", "Eleven small line charts of each industry's share of GVA since 1950-51, on the NSO back series and the two current bases, never joined. Agriculture falls from about half to under a fifth; services rise.");
  wireTools(document.getElementById("cb-make"), null, csv, "india-atlas_national-accounts_industry-shares_1950-2026", fyL);
  const bk = (k) => pts(GD.make.back, k), nw = (k) => pts(GD.make.b22, k);
  const ag0 = bk("agriculture_share")[0], ag1 = bk("agriculture_share").at(-1);
  setTxt("pv-make", pct1(nw("agriculture_share").at(-1).value));
  setTxt("pv-make-c", fyL(nw("agriculture_share").at(-1).date) + ", agriculture, base 2022–23");
  setTxt("mk-ag0", `${pct1(ag0.value)} in ${fyL(ag0.date)}`); setTxt("mk-ag1", `${pct1(ag1.value)} in ${fyL(ag1.date)}`);
  setTxt("mk-con0", pct1(bk("construction_share")[0].value)); setTxt("mk-con1", pct1(bk("construction_share").at(-1).value));
  setTxt("mk-fin0", pct1(bk("finance_share")[0].value)); setTxt("mk-fin1", pct1(bk("finance_share").at(-1).value));
  const mfg = [...bk("manufacturing_share"), ...pts(GD.make.b11, "manufacturing_share")];
  const pk = mfg.reduce((m, d) => (d.value > m.value ? d : m));
  setTxt("mk-mfg-pk", `${pct1(pk.value)} in ${fyL(pk.date)}`);
  setTxt("mk-mfg1", pct1(nw("manufacturing_share").at(-1).value));
}

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle.meta.vintage);
