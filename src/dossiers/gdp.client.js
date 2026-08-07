// Dossier 02 · National Accounts — plate definitions and number wiring.
// Data: data/series/gdp.json, baked at build time by scripts/fetch.mjs.
// Dates are fiscal-quarter starts (Q1 = Apr–Jun); growth is y/y from
// constant-price levels, computed in the pipeline.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/gdp.json";
import expBundle from "../../data/series/gdp-expenditure.json";
import accBundle from "../../data/series/gdp-accounts.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, troughOf, peakBetween, dodgeEndLabels, spark,
} from "../charts/plumbing.js";

const S = hydrate(bundle);
const E = hydrate(expBundle);
const ACC = hydrate(accBundle);
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
const ALL = { ...S, ...E }; // gdp.json and gdp-expenditure.json share the same quarter grid
const L = {}; for (const k in ALL) L[k] = ALL[k].data.at(-1).value;
const P = {}; for (const k in ALL) P[k] = ALL[k].data.at(-2).value;
const Y = {}; for (const k in ALL) Y[k] = ALL[k].data.at(-5).value;
const pc = '<span class="pc">%</span>';
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
const word = (d) => (d >= 0 ? "accelerating" : "slowing");
const prevQ = "vs " + fmtDate(dates.at(-2)).replace(/ FY\d+$/, "");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(2) + "%";

setHTML("n-gdp", L.gdp.toFixed(2) + pc);
setHTML("n-gva", L.gva.toFixed(2) + pc);
setHTML("n-pfce", L.pfce.toFixed(2) + pc);
setHTML("n-gfcf", L.gfcf.toFixed(2) + pc);
setHTML("d-gdp", `<b>${arrow(L.gdp - P.gdp)}</b> ${prevQ} · ${word(L.gdp - P.gdp)}`);
setHTML("d-gva", `<b>${arrow(L.gva - P.gva)}</b> ${prevQ} · ${word(L.gva - P.gva)}`);
setHTML("d-pfce", `<b>${arrow(L.pfce - P.pfce)}</b> ${prevQ} · ${word(L.pfce - P.pfce)}`);
setHTML("d-gfcf", `<b>${arrow(L.gfcf - P.gfcf)}</b> ${prevQ} · ${word(L.gfcf - P.gfcf)}`);

setHTML("rb-big", L.gdp.toFixed(2) + pc);
setHTML("rb-band", `vs 6% trend — <b>${(L.gdp - 6 >= 0 ? "+" : "") + (L.gdp - 6).toFixed(2)} pt</b>`);
{
  const W = 236, H = 46, min = 0, max = 10, val = L.gdp;
  const X = (v) => ((v - min) / (max - min)) * W, y = 18;
  document.getElementById("rb-scale").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale from 0 to 10 per cent. The rough pre-pandemic trend of 6 per cent is dashed; the current reading, ${val.toFixed(2)} per cent, is marked.">` +
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#DCD7C6" stroke-width="1"/>` +
    `<line x1="${X(6)}" y1="${y - 10}" x2="${X(6)}" y2="${y + 10}" stroke="#8A857A" stroke-width="1" stroke-dasharray="2,3"/>` +
    [0, 2, 4, 6, 8, 10].map((t) => `<text x="${X(t)}" y="${H - 6}" font-family="'IBM Plex Mono',monospace" font-size="9.5" fill="#8A857A" text-anchor="middle">${t}%</text>`).join("") +
    `<circle cx="${X(val)}" cy="${y}" r="4.5" fill="#BE3E26" stroke="#FFFFFF" stroke-width="1.5"/>` +
    `</svg>`;
}
setTxt("cr-g1", f1(L.gdp)); setTxt("cr-g0", f1(P.gdp)); setTxt("cr-g3", f1(L.gdp));
setTxt("cr-c1", f1(L.pfce)); setTxt("cr-i1", f1(L.gfcf)); setTxt("cr-v1", f1(L.gva));

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
const regRows = [
  ["gdp", "Real GDP", "Market prices · the headline", "s-acc", null, "#BE3E26"],
  ["gva", "Real GVA", "Basic prices · before net taxes", "s-g1", null, "#5B564B"],
  ["pfce", "Consumption · PFCE", "Household spending", "s-g2", 55.8, "#A8A293"],
  ["gfcf", "Investment · GFCF", "Machines, buildings, infrastructure", "s-g3", 33.5, "#8A857A"],
  ["gfce", "Government · GFCE", "The state's own consumption", "s-g4", 9.6, "#8A857A"],
  ["exports", "Exports · goods & services", "Demand from abroad", "s-g1", null, "#5B564B"],
  ["imports", "Imports · goods & services", "Enters with a minus sign", "s-acc", null, "#BE3E26"],
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
  const geo = { W: 1184, H: 560, ml: 70, mr: 150, mt: 36, mb: 48, d0: -30, d1: 25 };
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
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.ruleY([-30], { stroke: "#E0DACA", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
    Plot.ruleY([6], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
    Plot.text([{ date: dates[1], value: 6.8 }], { x: "date", y: "value", text: ["Rough pre-pandemic trend · 6%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
    Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 23.5 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    ...["gva", "pfce"].map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(S.gdp.data, { x: "date", y: "value", stroke: S.gdp.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.gdp.data.slice(-5), { x: "date", y: "value", stroke: S.gdp.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    Plot.dot([crash], { x: "date", y: "value", fill: S.gdp.color, r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line([{ x: crash.date, y: crash.value - sy(7) }, { x: crash.date, y: crash.value - sy(19) }], { x: "x", y: "y", stroke: S.gdp.color, strokeWidth: 1 }),
    Plot.text([{ date: crash.date, value: crash.value - sy(27) }], { x: "date", y: "value", text: () => crash.value.toFixed(1) + "% · " + fmtDate(crash.date) + " · lockdown", fill: S.gdp.color, fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
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
  const geo = { W: 1184, H: 470, ml: 70, mr: 136, mt: 30, mb: 48, d0, d1 };
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (d1 - d0));
  const dir = pk.value > d1 - (d1 - d0) * 0.14 ? -1 : 1;
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
      Plot.areaY(s.data, { x: "date", y: "value", fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-5), { x: "date", y: "value", stroke: s.color, strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line([{ x: pk.date, y: pk.value + dir * sy(7) }, { x: pk.date, y: pk.value + dir * sy(19) }], { x: "x", y: "y", stroke: "#BE3E26", strokeWidth: 1 }),
      Plot.text([{ date: pk.date, value: pk.value + dir * sy(27) }], { x: "date", y: "value", text: () => pk.value.toFixed(1) + "% · " + fmtDate(pk.date), fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
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

/* ---------- ledger sparklines ---------- */
spark("nspark-gdp", S.gdp);
spark("sp-gdp", S.gdp);
spark("sp-gva", S.gva);
spark("sp-pfce", S.pfce);
spark("sp-gfcf", S.gfcf);
spark("sp-gfce", E.gfce);
spark("sp-exports", E.exports);
spark("sp-imports", E.imports);

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle.meta.vintage);
