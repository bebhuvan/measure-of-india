// Dossier 02 · National Accounts — plate definitions and number wiring.
// Data: data/series/gdp.json, baked at build time by scripts/fetch.mjs.
// Dates are fiscal-quarter starts (Q1 = Apr–Jun); growth is y/y from
// constant-price levels, computed in the pipeline.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/gdp.json";
import expBundle from "../../data/series/gdp-expenditure.json";
import accBundle from "../../data/series/gdp-accounts.json";
import indBundle from "../../data/series/gdp-industries.json";
import nomBundle from "../../data/series/gdp-nominal.json";
import nbBundle from "../../data/series/gdp-2022.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, troughOf, peakBetween, dodgeEndLabels, spark, makePlacer, annotationSpot,
} from "../charts/plumbing.js";

const S = hydrate(bundle);
const E = hydrate(expBundle);
const ACC = hydrate(accBundle);
const IND = hydrate(indBundle);   // 8-sector real GVA, same quarter grid as S
const N = hydrate(nomBundle);     // nominal GDP, real GDP, implied deflator
const NB = hydrate(nbBundle);     // the 2022-23 base — separate axis, never spliced
// presentation palette for the expenditure plate — unique per line
E.imports.color = "#BE3E26";
E.exports.color = "#5B564B";
E.gfce.color = "#8A857A";
E.gfce.label = "Government · GFCE";
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
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
const word = (d) => (d >= 0 ? "accelerating" : "slowing");
const prevQ = "vs " + fmtDate(dates.at(-2)).replace(/ FY\d+$/, "");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(2) + "%";

setHTML("n-gdp", LNB.gdp.toFixed(2) + pc);
setHTML("n-gva", LNB.gva.toFixed(2) + pc);
setHTML("n-pfce", LNB.pfce.toFixed(2) + pc);
setHTML("n-gfcf", LNB.gfcf.toFixed(2) + pc);
setHTML("d-gdp", `<b>${arrow(LNB.gdp - PNB.gdp)}</b> ${prevQNB} · ${word(LNB.gdp - PNB.gdp)}`);
setHTML("d-gva", `<b>${arrow(LNB.gva - PNB.gva)}</b> ${prevQNB} · ${word(LNB.gva - PNB.gva)}`);
setHTML("d-pfce", `<b>${arrow(LNB.pfce - PNB.pfce)}</b> ${prevQNB} · ${word(LNB.pfce - PNB.pfce)}`);
setHTML("d-gfcf", `<b>${arrow(LNB.gfcf - PNB.gfcf)}</b> ${prevQNB} · ${word(LNB.gfcf - PNB.gfcf)}`);

setHTML("rb-big", LNB.gdp.toFixed(2) + pc);
setHTML("rb-band", `vs 6% trend — <b>${(LNB.gdp - 6 >= 0 ? "+" : "") + (LNB.gdp - 6).toFixed(2)} pt</b>`);
{
  const W = 236, H = 46, min = 0, max = 10, val = LNB.gdp;
  const X = (v) => ((v - min) / (max - min)) * W, y = 18;
  document.getElementById("rb-scale").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale from 0 to 10 per cent. The rough pre-pandemic trend of 6 per cent is dashed; the current reading, ${val.toFixed(2)} per cent, is marked.">` +
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#DCD7C6" stroke-width="1"/>` +
    `<line x1="${X(6)}" y1="${y - 10}" x2="${X(6)}" y2="${y + 10}" stroke="#8A857A" stroke-width="1" stroke-dasharray="2,3"/>` +
    [0, 2, 4, 6, 8, 10].map((t) => `<text x="${X(t)}" y="${H - 6}" font-family="'IBM Plex Mono',monospace" font-size="9.5" fill="#8A857A" text-anchor="middle">${t}%</text>`).join("") +
    `<circle cx="${X(val)}" cy="${y}" r="4.5" fill="#BE3E26" stroke="#FFFFFF" stroke-width="1.5"/>` +
    `</svg>`;
}
// §01 "current reading" prose is pipeline-generated (pipeline/out/prose-gdp.*.md);
// the cr-* figure spans it used to carry are retired.

setTxt("pv-main", f1(L.gdp));
setTxt("pv-pfce", f1(L.pfce)); setTxt("pv-gfcf", f1(L.gfcf)); setTxt("pv-gva", f1(L.gva));
setTxt("ex-pfce", f1(L.pfce)); setTxt("ex-gfcf", f1(L.gfcf)); setTxt("ex-gva", f1(L.gva));
setTxt("ex-last4", S.gdp.data.slice(-4).map((d) => d.value.toFixed(1)).join(", "));
const pkP = peakOf(S.pfce), pkF = peakOf(S.gfcf), pkV = peakOf(S.gva);
setTxt("pf-pfce", `peak — ${pkP.value.toFixed(1)}%, ${fmtDate(pkP.date)} · latest — ${f1(L.pfce)}`);
setTxt("pf-gfcf", `peak — ${pkF.value.toFixed(1)}%, ${fmtDate(pkF.date)} · latest — ${f1(L.gfcf)}`);
setTxt("pf-gva", `peak — ${pkV.value.toFixed(1)}%, ${fmtDate(pkV.date)} · latest — ${f1(L.gva)}`);

/* ---------- expenditure-side numbers ---------- */
const fSigned = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%";
setTxt("pv-exp", f1(L.imports));
setTxt("ex-imp", f1(L.imports));
setTxt("ex-exp", f1(L.exports));
setTxt("ex-gfce", fSigned(L.gfce));
const trM = troughOf(E.imports), pkM = peakOf(E.imports);
setTxt("pf-exp", `imports swung −${Math.abs(trM.value).toFixed(1)}% (${fmtDate(trM.date)}) to +${pkM.value.toFixed(1)}% (${fmtDate(pkM.date)}) · latest — ${f1(L.imports)}`);

/* ---------- annual-accounts numbers ---------- */
const fmtFY = (d) => "FY" + String(d.getUTCFullYear() + 1).slice(2);
const accLast = (k) => ACC[k].data.filter((d) => d.value != null).at(-1);
setTxt("pv-acc", f1(accLast("ndp").value));
setTxt("pv-acc-c", fmtFY(accLast("ndp").date) + " · NDP y/y");
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

/* ---------- register ---------- */
const SH = indBundle.shares; // sector shares of NOMINAL GVA, last four quarters
const regRows = [
  ["gdp", "Real GDP", "Market prices · the headline", "s-acc", null, "#BE3E26"],
  ["gva", "Real GVA", "Basic prices · before net taxes", "s-g1", null, "#5B564B"],
  ["pfce", "Consumption · PFCE", "Household spending", "s-g2", 55.8, "#A8A293"],
  ["gfcf", "Investment · GFCF", "Machines, buildings, infrastructure", "s-g3", 33.5, "#8A857A"],
  ["gfce", "Government · GFCE", "The state's own consumption", "s-g4", 9.6, "#8A857A"],
  ["exports", "Exports · goods & services", "Demand from abroad", "s-g1", null, "#5B564B"],
  ["imports", "Imports · goods & services", "Enters with a minus sign", "s-acc", null, "#BE3E26"],
  // production side — the four most telling engines; shares are of GVA (see table note)
  ["agriculture", "Agriculture · GVA", "The monsoon engine · share of GVA", "s-g1", SH.agriculture, "#5B564B"],
  ["manufacturing", "Manufacturing · GVA", "The tradables cycle · share of GVA", "s-g2", SH.manufacturing, "#5B564B"],
  ["construction", "Construction · GVA", "Where investment becomes jobs · share of GVA", "s-g3", SH.construction, "#5B564B"],
  ["finance_realty", "Finance & real estate · GVA", "The largest engine · share of GVA", "s-g4", SH.finance_realty, "#5B564B"],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([k, nm, sub, sw, share, col]) => `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">${share === null ? "—" : share.toFixed(1) + '<span class="wtrack"><i style="width:' + share + '%;background:' + col + '"></i></span>'}</td>
    <td class="val">${f1(L[k])}</td>
    <td class="chg">${arrow(L[k] - P[k])} · ${word(L[k] - P[k])}</td>
    <td class="yr">${f1(Y[k])}</td>
    <td class="spark" id="sp-${k}"></td>
  </tr>`).join("");

/* ---------- expenditure composition ---------- */
const groups = [
  ["Consumption · PFCE", 55.8, "#BE3E26"],
  ["Investment · GFCF", 33.5, "#5B564B"],
  ["Government · GFCE", 9.6, "#A8A293"],
  ["Valuables & disc.", 1.1, "#DCD7C6"],
];
document.getElementById("basket-bar").innerHTML = groups.map(([n, w, c]) =>
  `<div class="seg" style="width:${w}%;background:${c}" title="${n} — ${w}%"></div>`).join("");
document.getElementById("basket-labels").innerHTML = groups.map(([n, w, c]) =>
  `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${w.toFixed(1)}% of GDP</div></div>`).join("");

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
    const lbl = `${p.s.label} ${p.value.toFixed(2)}%`;
    placer.addObstacleBox(placer.box({ x: dates.at(-1), y: p.y, anchor: "start", dx: 16 }, lbl, 14.5));
  }
  const trendSpot = placer.place("Rough pre-pandemic trend · 6%", 12, [
    { x: new Date(Date.UTC(2017, 0, 1)), y: 9.7, anchor: "start" },
    { x: new Date(Date.UTC(2016, 10, 1)), y: 9.7, anchor: "start" },
    { x: new Date(Date.UTC(2023, 1, 1)), y: 2.5, anchor: "start" },
  ]);
  const crashA = annotationSpot(placer, crash, crash.value.toFixed(1) + "% · " + fmtDate(crash.date) + " · lockdown", 13, [
    { x: crash.date, y: crash.value, anchor: "end", dx: -12, dy: -38 },
    { x: crash.date, y: crash.value, anchor: "start", dx: 12, dy: -38 },
    { x: crash.date, y: crash.value, anchor: "end", dx: -12, dy: 44 },
    { x: crash.date, y: crash.value, anchor: "middle", dx: 0, dy: -38 },
  ]);
  placer.addObstacleBox(crashA.box);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.ruleY([-30], { stroke: "#E0DACA", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
    Plot.ruleY([6], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
    Plot.text([{ date: trendSpot.x, value: trendSpot.y }], { x: "date", y: "value", text: ["Rough pre-pandemic trend · 6%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: trendSpot.anchor }),
    Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
    Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 23.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    ...["gva", "pfce"].map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(S.gdp.data, { x: "date", y: "value", stroke: S.gdp.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.gdp.data.slice(-5), { x: "date", y: "value", stroke: S.gdp.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    Plot.dot([crash], { x: "date", y: "value", fill: S.gdp.color, r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line(crashA.leader, { x: "x", y: "y", stroke: S.gdp.color, strokeWidth: 1 }),
    Plot.text([{ date: crashA.textX, value: crashA.textY }], { x: "date", y: "value", text: [crash.value.toFixed(1) + "% · " + fmtDate(crash.date) + " · lockdown"], fill: S.gdp.color, fontSize: 13, fontFamily: mono, textAnchor: crashA.spot.anchor }),
    Plot.dot([rebound], { x: "date", y: "value", fill: S.gdp.color, r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line([
      { x: dxDate(rebound.date, 7), y: rebound.value - sy(3) },
      { x: dxDate(rebound.date, 18), y: rebound.value - sy(3) },
    ], { x: "x", y: "y", stroke: S.gdp.color, strokeWidth: 1 }),
    Plot.text([{ date: dxDate(rebound.date, 24), value: rebound.value - sy(3) }], { x: "date", y: "value", text: () => rebound.value.toFixed(1) + "% · " + fmtDate(rebound.date) + " · base effect", dy: 4, fill: S.gdp.color, fontSize: 13, fontFamily: mono, textAnchor: "start" }),
    ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === S.gdp ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
      dx: 16, fill: p.s.color, fontSize: 14.5, fontFamily: mono,
      fontWeight: p.s === S.gdp ? 500 : 400, textAnchor: "start",
    })),
  ];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
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
  const pkText = pk.value.toFixed(1) + "% · " + fmtDate(pk.date);
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
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ y/y, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [d0, d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.areaY(s.data, { x: "date", y: "value", y1: d0 <= 0 ? 0 : d0, fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-5), { x: "date", y: "value", stroke: s.color, strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(leader, { x: "x", y: "y", stroke: "#BE3E26", strokeWidth: 1 }),
      Plot.text([{ date: textX, value: textY }], { x: "date", y: "value", text: [pkText], fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: spot.anchor }),
      Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([s.data.at(-1)], { x: "date", y: "value", text: (d) => d.value.toFixed(2) + "%", dx: 16, fill: "#BE3E26", fontSize: 14, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
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
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 47 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      ...keys.slice(1).map((k) => Plot.lineY(E[k].data, { x: "date", y: "value", stroke: E[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(E.imports.data, { x: "date", y: "value", stroke: E.imports.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(E.imports.data.slice(-5), { x: "date", y: "value", stroke: E.imports.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === E.imports ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
        dx: 16, fill: p.s.color, fontSize: 14.5, fontFamily: mono,
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
    ["ndp", "Net domestic product", "GDP minus depreciation", "#5B564B"],
    ["gni", "Gross national income", "GDP plus net income from abroad", "#5B564B"],
    ["taxes", "Taxes on products", "One side of the GDP–GVA wedge", "#5B564B"],
    ["subsidies", "Subsidies", "The other side of the wedge", "#BE3E26"],
    ["cfc", "Capital consumption", "Depreciation of the stock", "#5B564B"],
    ["gcf_industry", "Capital formation", "Gross, all assets", "#5B564B"],
  ];
  const fmtSigned = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%";
  const grid = document.getElementById("grid-acc");
  for (const [k, nm, sub, col] of panels) {
    const s = ACC[k];
    const nn = s.data.filter((d) => d.value != null);
    const last = nn.at(-1);
    const vs = nn.map((d) => d.value);
    const lo = Math.min(...vs, 0), hi = Math.max(...vs, 0);
    const pad = (hi - lo) * 0.12 + 0.5;
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #E6E2D6;padding-top:14px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
      `<div style="min-width:0"><div style="font-size:1.02rem;color:#1B1A17;line-height:1.35">${nm}</div>` +
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:#8A857A;margin-top:3px">${sub}</div></div>` +
      `<div style="text-align:right;flex-shrink:0"><div style="font-family:'Newsreader',serif;font-weight:300;font-size:1.55rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:${col === "#BE3E26" ? "#BE3E26" : "#1B1A17"}">${fmtSigned(last.value)}</div>` +
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:#8A857A;margin-top:3px">${fmtFY(last.date)} · y/y</div></div></div>`;
    const mini = Plot.plot({
      width: 340, height: 110, marginLeft: 4, marginRight: 10, marginTop: 10, marginBottom: 6,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [lo - pad, hi + pad] },
      marks: [
        Plot.ruleY([0], { stroke: "#D8D3C4", strokeWidth: 1 }),
        Plot.lineY(nn, { x: "date", y: "value", stroke: col, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([last], { x: "date", y: "value", fill: col, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    const foot = document.createElement("div");
    foot.style.cssText = "display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:#B4AFA2;margin-top:2px";
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
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => "FY" + String(d.getUTCFullYear() + 1).slice(2) },
    y: { label: "↑ gross saving, % of nominal GDP", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.areaY(nn, { x: "date", y: "value", y1: geo.d0 <= 0 ? 0 : geo.d0, fill: "#BE3E26", fillOpacity: 0.06 }),
      Plot.lineY(nn, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(nn, { x: "date", y: "value", fill: "#BE3E26", r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot([last], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => d.value.toFixed(1) + "%", dx: 16, fill: "#BE3E26", fontSize: 14, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Gross saving rate, share of nominal GDP, " + fmtFYs(first.date) + " to " + fmtFYs(last.date),
    "Line chart. The saving rate ends at " + last.value.toFixed(1) + " per cent of GDP in " + fmtFYs(last.date) + ", down from " + first.value.toFixed(1) + " at the start of the series. India invests more than it saves; the gap is the current account.");
  document.getElementById("plot-sav").append(plot);
  wireTools(document.getElementById("cb-sav"), plot, [s], "india-atlas_national-accounts_saving-rate", fmtFYs);
  setTxt("pv-sav", last.value.toFixed(1) + "%");
  setTxt("pv-sav-c", fmtFYs(last.date) + " · % of nominal GDP");
  setTxt("sav-first", first.value.toFixed(1) + "%");
  setTxt("sav-drop", (first.value - last.value).toFixed(1) + " points");
}

/* ---------- eight engines : industry GVA small multiples ---------- */
{
  const keys = Object.keys(IND);
  const latest = Object.fromEntries(keys.map((k) => [k, IND[k].data.at(-1).value]));
  // disclosed accent rule: the fastest and the slowest engine of the latest quarter
  const fastest = keys.reduce((a, k) => (latest[k] > latest[a] ? k : a));
  const slowest = keys.reduce((a, k) => (latest[k] < latest[a] ? k : a));
  setTxt("pv-ind", f1(latest[fastest]));
  setTxt("pv-ind-c", fmtDate(dates.at(-1)) + " · fastest — " + IND[fastest].label);
  const fmtSigned = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%";
  setTxt("ex-eng-fast", fmtSigned(latest[fastest]) + " (" + IND[fastest].label.toLowerCase() + ")");
  setTxt("ex-eng-slow", fmtSigned(latest[slowest]) + " (" + IND[slowest].label.toLowerCase() + ")");
  setTxt("ex-eng-mfg", f1(latest.manufacturing));
  setTxt("ex-eng-agri", f1(latest.agriculture));
  const grid = document.getElementById("grid-ind");
  for (const k of keys) {
    const s = IND[k];
    const nn = s.data.filter((d) => d.value != null);
    const last = nn.at(-1);
    const isExtreme = k === fastest || k === slowest;
    const lineCol = "#8A857A", accCol = "#BE3E26";
    const vs = nn.map((d) => d.value);
    const lo = Math.min(...vs, 0), hi = Math.max(...vs, 0);
    const pad = (hi - lo) * 0.12 + 0.5;
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #E6E2D6;padding-top:14px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">` +
      `<div style="min-width:0"><div style="font-size:1.02rem;color:#1B1A17;line-height:1.35">${s.label}</div>` +
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:#8A857A;margin-top:3px">${SH[k].toFixed(1)}% of GVA</div></div>` +
      `<div style="text-align:right;flex-shrink:0"><div style="font-family:'Newsreader',serif;font-weight:300;font-size:1.55rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:${isExtreme ? accCol : "#1B1A17"}">${fmtSigned(last.value)}</div>` +
      `<div style="font-family:'IBM Plex Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:#8A857A;margin-top:3px">${fmtDate(last.date)} · y/y</div></div></div>`;
    const mini = Plot.plot({
      width: 280, height: 96, marginLeft: 4, marginRight: 10, marginTop: 10, marginBottom: 6,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [lo - pad, hi + pad] },
      marks: [
        Plot.ruleY([0], { stroke: "#D8D3C4", strokeWidth: 1 }),
        Plot.lineY(nn, { x: "date", y: "value", stroke: lineCol, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([last], { x: "date", y: "value", fill: isExtreme ? accCol : lineCol, r: 3, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    const foot = document.createElement("div");
    foot.style.cssText = "display:flex;justify-content:space-between;font-family:'IBM Plex Mono',monospace;font-size:.55rem;letter-spacing:.1em;text-transform:uppercase;color:#B4AFA2;margin-top:2px";
    foot.innerHTML = `<span>${fmtDate(nn[0].date)}</span><span>${fmtDate(last.date)}</span>`;
    div.append(foot);
    grid.append(div);
  }
  grid.setAttribute("aria-label",
    "Eight small line charts of quarterly real GVA growth by industry: agriculture, mining, manufacturing, utilities, construction, trade and transport, finance and real estate, public administration, Q1 FY17 to " + fmtDate(dates.at(-1)) + ". Latest year-on-year values are printed beside each panel; the fastest, " + IND[fastest].label + ", and the slowest, " + IND[slowest].label + ", are marked in vermilion.");
  wireTools(document.getElementById("cb-ind"), null, keys.map((k) => IND[k]), "india-atlas_national-accounts_gva-by-industry_fy17-fy26", fmtDate);
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
  const pkText = pkD.value.toFixed(1) + "% · " + fmtDate(pkD.date) + " · deflator peak";
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
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 32.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      Plot.lineY(N.deflator.data, { x: "date", y: "value", stroke: N.deflator.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(N.gdp_real.data, { x: "date", y: "value", stroke: N.gdp_real.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(N.gdp_nominal.data, { x: "date", y: "value", stroke: N.gdp_nominal.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(N.gdp_nominal.data.slice(-5), { x: "date", y: "value", stroke: N.gdp_nominal.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([pkD], { x: "date", y: "value", fill: N.deflator.color, r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(pkSpot.leader, { x: "x", y: "y", stroke: "#8A857A", strokeWidth: 1 }),
      Plot.text([{ date: pkSpot.textX, value: pkSpot.textY }], { x: "date", y: "value", text: [pkText], fill: "#8A857A", fontSize: 13, fontFamily: mono, textAnchor: pkSpot.spot.anchor }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === N.gdp_nominal ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
        dx: 16, fill: p.s.color, fontSize: 14.5, fontFamily: mono,
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
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16,
         ticks: [2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
      ...keys.slice(1).map((k) => Plot.lineY(NB[k].data, { x: "date", y: "value", stroke: NB[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(NB.gdp.data, { x: "date", y: "value", stroke: NB.gdp.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(NB.gdp.data.slice(-3), { x: "date", y: "value", stroke: NB.gdp.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === NB.gdp ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: nbDates.at(-1), y: p.value }, { x: nbDates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: nbDates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
        dx: 16, fill: p.s.color, fontSize: 14.5, fontFamily: mono,
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
  setTxt("pv-nb-c", fmtDate(nbDates.at(-1)) + " · GDP y/y · base 2022–23");
  setTxt("nb-q3", f1(NB.gdp.data.at(-2).value));
  setTxt("nb-q4", f1(nbL));
  setTxt("nb-gfcf", f1(NB.gfcf.data.at(-1).value));
  // the overlap quarter, re-scored: Q1 FY26 on both bases
  const oldQ1 = S.gdp.data.at(-2);
  const newQ1 = NB.gdp.data.find((d) => d.date.getTime() === oldQ1.date.getTime());
  setTxt("nb-old-q1", f1(oldQ1.value));
  setTxt("nb-new-q1", f1(newQ1.value));
  setTxt("nb-gap", Math.abs(oldQ1.value - newQ1.value).toFixed(2) + " pt");
}

/* ---------- ledger sparklines ---------- */
spark("nspark-gdp", S.gdp);
spark("sp-gdp", S.gdp);
spark("sp-gva", S.gva);
spark("sp-pfce", S.pfce);
spark("sp-gfcf", S.gfcf);
spark("sp-gfce", E.gfce);
spark("sp-exports", E.exports);
spark("sp-imports", E.imports);
spark("sp-agriculture", IND.agriculture);
spark("sp-manufacturing", IND.manufacturing);
spark("sp-construction", IND.construction);
spark("sp-finance_realty", IND.finance_realty);

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle.meta.vintage);
