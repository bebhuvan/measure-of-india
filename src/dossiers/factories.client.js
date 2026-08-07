// Dossier 08 · Enterprises — plate definitions and number wiring.
// Data: data/series/asi-headline.json + asi-industries.json + asi-states.json
// + asuse-annual.json + asuse-sectors.json + asuse-quarterly.json,
// baked at build time by scripts/fetch.mjs.
// Two surveys share this page and are never conflated: ASI (registered
// factories, Factories Act) and ASUSE (unincorporated establishments).
// ASI monetary series arrive in ₹ lakh as published and are shown in
// ₹ lakh crore (1 lakh crore = 10^12 ₹), always nominal. ASUSE quarterly
// counts arrive in hundreds ('00) and are converted for display.
// The 2010-11 ASI frame revision is annotated on the chart it breaks.

import * as Plot from "@observablehq/plot";
import headlineBundle from "../../data/series/asi-headline.json";
import industriesBundle from "../../data/series/asi-industries.json";
import statesBundle from "../../data/series/asi-states.json";
import asuseBundle from "../../data/series/asuse-annual.json";
import asuseQBundle from "../../data/series/asuse-quarterly.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob,
} from "../charts/plumbing.js";

const H = hydrate(headlineBundle);
const UA = hydrate(asuseBundle);
const UQ = hydrate(asuseQBundle);

/* ---------- formatters ---------- */
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtIN = (n) => Math.round(n).toLocaleString("en-IN");
const fy = (d) => d.getUTCFullYear() + "-" + String((d.getUTCFullYear() + 1) % 100).padStart(2, "0");
const croreN = (n, dp = 2) => (n / 1e7).toFixed(dp);              // count -> crore
const lakhOf = (n, dp = 1) => (n / 1e5).toFixed(dp);              // count/₹ -> lakh
const lakhCr = (vLakh, dp = 1) => "₹" + (vLakh / 1e7).toFixed(dp) + " lakh cr"; // ₹ lakh -> ₹ lakh crore
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const prevV = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const firstV = (s) => s.data.filter((d) => d.value != null)[0].value;
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));

/* ---------- derived signature numbers (both surveys, same year, nominal) ---------- */
const gvaPerPersonASI = (last(H.gva) * 1e5) / last(H.persons_engaged);     // ₹ / year
const emolPerPersonASI = (last(H.emoluments) * 1e5) / last(H.persons_engaged);
const multAll = gvaPerPersonASI / last(UA.gva_per_worker_all);
const multOAE = gvaPerPersonASI / last(UA.gva_per_worker_oae);
const wageMult = emolPerPersonASI / last(UA.emoluments_per_hired_worker_hwe);

/* ---------- titleblock numbers ---------- */
setHTML("n-fact", lakhOf(last(H.factories_in_operation), 2) + pc("lakh"));
setHTML("d-fact", `<b>${arrow(last(H.factories_in_operation) - prevV(H.factories_in_operation), fmtIN)}</b> vs ${fy(H.factories_in_operation.data.at(-2).date)}`);
setHTML("n-pers", croreN(last(H.persons_engaged)) + pc("crore"));
setHTML("d-pers", `<b>${arrow(last(H.persons_engaged) - prevV(H.persons_engaged), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(H.persons_engaged.data.at(-2).date)}`);
setHTML("n-inf", croreN(last(UA.establishments_all)) + pc("crore"));
setHTML("d-inf", `<b>${arrow(last(UA.establishments_all) - prevV(UA.establishments_all), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(UA.establishments_all.data.at(-2).date)} · ASUSE`);
setHTML("n-mult", multAll.toFixed(1) + pc("×"));
setHTML("d-mult", `<b>₹${lakhOf(gvaPerPersonASI)} lakh</b> vs <b>₹${lakhOf(last(UA.gva_per_worker_all))} lakh</b> · per worker · nominal`);

/* ---------- § 01 current reading ---------- */
setHTML("rb-formal", croreN(last(H.persons_engaged)) + pc("crore"));
setHTML("rb-informal", croreN(last(UA.workers_all)) + pc("crore"));
setTxt("rt-ratio", (last(UA.workers_all) / last(H.persons_engaged)).toFixed(1));
setTxt("cr-fop", fmtIN(last(H.factories_in_operation)));
setTxt("cr-freg", fmtIN(last(H.number_of_factories)));
setTxt("cr-pers", croreN(last(H.persons_engaged)) + " crore");
setTxt("cr-fgva", lakhCr(last(H.gva)) + "ore");
setTxt("cr-gpwf", "₹" + lakhOf(gvaPerPersonASI) + " lakh");
setTxt("cr-est", croreN(last(UA.establishments_all)) + " crore");
setTxt("cr-wrk", croreN(last(UA.workers_all)) + " crore");
setTxt("cr-gpwi", "₹" + fmtIN(last(UA.gva_per_worker_all)));
setTxt("cr-mult", multAll.toFixed(1) + "×");

/* ---------- § 02 register of series ---------- */
H.factories_in_operation.color = "#BE3E26";
H.number_of_factories.color = "#5B564B";
H.persons_engaged.color = "#5B564B";
H.workers.color = "#A8A293";
H.gva.color = "#BE3E26";
H.emoluments.color = "#8A857A";
H.total_output.color = "#C6C0B0";
UA.establishments_all.color = "#A8A293";
UA.workers_all.color = "#A8A293";
UA.gva_per_worker_all.color = "#5B564B";
UA.emoluments_per_hired_worker_hwe.color = "#8A857A";

const regRows = [
  [H.factories_in_operation, "Factories in operation", "ASI · count · from 2008-09", "s-acc", fmtIN, fmtIN],
  [H.persons_engaged, "Persons engaged", "ASI · count · all registered factories", "s-g1", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [H.gva, "Factory gross value added", "ASI · ₹ lakh cr · nominal", "s-acc", (v) => lakhCr(v), (v) => lakhCr(v)],
  [H.emoluments, "Emoluments — wages & salaries", "ASI · ₹ lakh cr · nominal", "s-g4", (v) => lakhCr(v), (v) => lakhCr(v)],
  [H.total_output, "Gross output", "ASI · ₹ lakh cr · nominal", "s-g3", (v) => lakhCr(v), (v) => lakhCr(v)],
  [UA.establishments_all, "Establishments · unincorporated", "ASUSE · count · from 2021-22", "s-g2", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [UA.workers_all, "Workers · unincorporated", "ASUSE · count · from 2021-22", "s-g2", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [UA.gva_per_worker_all, "GVA per worker", "ASUSE · ₹ per year · market establishments", "s-g1", (v) => "₹" + fmtIN(v), (v) => "₹" + fmtIN(v)],
  [UA.emoluments_per_hired_worker_hwe, "Emoluments per hired worker", "ASUSE · HWE only · ₹ per year", "s-g4", (v) => "₹" + fmtIN(v), (v) => "₹" + fmtIN(v)],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fV, fD], i) => {
  const data = s.data.filter((d) => d.value != null);
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${fV(data.at(-1).value)}</td>
    <td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)} · vs ${fy(data.at(-2).date)}</td>
    <td class="yr">${fV(data[0].value)} · ${fy(data[0].date)}</td>
    <td class="spark" id="sp-f${i}"></td>
  </tr>`;
}).join("");

/* ---------- shared line-panel renderer (per-panel crosshair container) ---------- */
function linePanel(el, keys, store, geo, opts) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * (opts.gapFrac ?? 0.07));
  const marks = [
    Plot.gridY(opts.yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }) : null,
    ...(opts.preMarks || []),
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: opts.leadWidth ?? 3, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: opts.leadDash }),
    opts.emphasize !== false ? Plot.lineY(store[keys[0]].data.filter((d) => d.value != null).slice(-4), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: opts.leadDash }) : null,
    ...(opts.postMarks || []),
    ...seriesList.map((s) => Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > (geo.d1 - geo.d0) * 0.004).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${opts.endFmt(p.value)}`,
      dx: 16, fill: p.s.color, fontSize: 14, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 14, ticks: opts.xTicks, tickFormat: opts.xFmt },
    y: { label: opts.yLabel, labelAnchor: "top", labelArrow: false,
         tickFormat: opts.yFmt, ticks: opts.yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, opts.a11yTitle, opts.a11yDesc);
  el.append(plot);
  if (opts.crossFmt) addCrosshair(el, plot, seriesList, geo, fy, opts.crossFmt);
  return plot;
}

/* meta-carrying downloads for plates whose CSV is not a date×series matrix */
function wirePlate(blockEl, plot, filename, csvText) {
  const meta = {
    title: blockEl.querySelector(".plate-head h3")?.textContent.trim(),
    sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg" && plot) downloadSVG(plot, filename, meta);
      if (kind === "png" && plot) downloadPNG(plot, filename, meta);
      if (kind === "csv") saveBlob(new Blob([csvText], { type: "text/csv" }), filename + ".csv");
    });
  });
}

const xTicksASI = [2008, 2011, 2014, 2017, 2020, 2023].map((y) => new Date(Date.UTC(y, 3, 1)));
const frameBreak = new Date(Date.UTC(2010, 3, 1));

/* ---------- § 03 plate 1 : the counts, two panels ---------- */
{
  H.number_of_factories.label = "On the register";
  H.factories_in_operation.label = "In operation";
  H.persons_engaged.label = "Persons engaged";
  H.workers.label = "Workers";
  setTxt("pv-count", fmtIN(last(H.factories_in_operation)));
  setTxt("ex-c1", fmtIN(last(H.factories_in_operation)));
  setTxt("ex-c0", fmtIN(firstV(H.factories_in_operation)));
  setTxt("ex-cp", croreN(last(H.persons_engaged)) + " crore");
  setTxt("ex-cw", croreN(last(H.workers)) + " crore");
  setTxt("ex-cavg", fmtIN(last(H.persons_engaged) / last(H.factories_in_operation)));

  const geoA = { W: 1184, H: 340, ml: 70, mr: 230, mt: 30, mb: 42, d0: 0, d1: 280000 };
  const plotA = linePanel(document.getElementById("plot-fact"),
    ["factories_in_operation", "number_of_factories"], H, geoA, {
      yTicks: [0, 70000, 140000, 210000, 280000],
      yLabel: "↑ factories, thousand",
      yFmt: (d) => (d === 0 ? "0" : String(d / 1000) + "k"),
      xTicks: xTicksASI, xFmt: fy,
      endFmt: (v) => fmtIN(v),
      crossFmt: (v) => (v == null ? "—" : fmtIN(v)),
      preMarks: [
        Plot.ruleX([frameBreak], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
        Plot.text([{ date: frameBreak, value: 258000 }], { x: "date", y: "value", text: ["2010-11 · frame revised — a wider net, not new factories"], dx: 8, fontSize: 12.5, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
      ],
      a11yTitle: "Registered factories and factories in operation, 2008-09 to 2023-24",
      a11yDesc: "Two lines. The register rises from " + fmtIN(firstV(H.number_of_factories)) + " to " + fmtIN(last(H.number_of_factories)) + "; factories in operation from " + fmtIN(firstV(H.factories_in_operation)) + " to " + fmtIN(last(H.factories_in_operation)) + ". A step in 2010-11 marks the sampling-frame revision, annotated as a coverage change and not growth.",
    });

  const geoB = { W: 1184, H: 300, ml: 70, mr: 230, mt: 28, mb: 42, d0: 0, d1: 20000000 };
  const plotB = linePanel(document.getElementById("plot-pers"),
    ["persons_engaged", "workers"], H, geoB, {
      yTicks: [0, 5000000, 10000000, 15000000, 20000000],
      yLabel: "↑ people, crore",
      yFmt: (d) => (d === 0 ? "0" : (d / 1e7).toFixed(1) + (d === 20000000 ? " cr" : "")),
      xTicks: xTicksASI, xFmt: fy,
      leadWidth: 2.5,
      endFmt: (v) => croreN(v) + " cr",
      crossFmt: (v) => (v == null ? "—" : croreN(v) + " cr"),
      a11yTitle: "Persons engaged and workers in registered factories, 2008-09 to 2023-24",
      a11yDesc: "Two lines rising slowly: persons engaged from " + croreN(firstV(H.persons_engaged)) + " crore to " + croreN(last(H.persons_engaged)) + " crore, workers from " + croreN(firstV(H.workers)) + " crore to " + croreN(last(H.workers)) + " crore. The 2010-11 frame revision barely moves these lines.",
    });

  const block = document.getElementById("cb-count");
  wireTools(block, plotA, [H.factories_in_operation, H.number_of_factories, H.persons_engaged, H.workers], "india-atlas_asi_factory-counts_2008-2023", fy);
  wireLegend(document.getElementById("legend-count"), plotA, ["factories_in_operation", "number_of_factories"], H);
  wireLegend(document.getElementById("legend-count"), plotB, ["persons_engaged", "workers"], H);
}

/* ---------- § 04 plate 2 : the money (nominal) + derived y/y companion ---------- */
{
  // ₹ lakh (source) -> ₹ lakh crore for the axis
  const M = {
    gva: { label: "GVA", color: "#BE3E26", name: "asi_gva_lakh_crore", data: H.gva.data.map((d) => ({ date: d.date, value: d.value / 1e7 })) },
    emoluments: { label: "Emoluments", color: "#5B564B", name: "asi_emoluments_lakh_crore", data: H.emoluments.data.map((d) => ({ date: d.date, value: d.value / 1e7 })) },
  };
  const yoy = {
    label: "GVA y/y", color: "#BE3E26", name: "asi_gva_yoy_pct_derived",
    data: H.gva.data.map((d, i) => ({ date: d.date, value: i === 0 ? null : (d.value / H.gva.data[i - 1].value - 1) * 100 })),
  };
  setTxt("pv-money", lakhCr(last(H.gva)));
  setTxt("ex-m1", lakhCr(last(H.gva)) + "ore");
  setTxt("ex-m0", lakhCr(firstV(H.gva)) + "ore");
  setTxt("ex-mx", (last(H.gva) / firstV(H.gva)).toFixed(1) + "×");
  setTxt("ex-me", lakhCr(last(H.emoluments)) + "ore");
  setTxt("ex-mw", "₹" + lakhOf(emolPerPersonASI) + " lakh");

  const geoM = { W: 1184, H: 400, ml: 70, mr: 230, mt: 30, mb: 42, d0: 0, d1: 26 };
  const plotM = linePanel(document.getElementById("plot-money"), ["gva", "emoluments"], M, geoM, {
    yTicks: [0, 5, 10, 15, 20, 25],
    yLabel: "↑ ₹ lakh crore · nominal",
    yFmt: (d) => (d === 25 ? "₹25" : String(d)),
    xTicks: xTicksASI, xFmt: fy,
    gapFrac: 0.09,
    endFmt: (v) => "₹" + v.toFixed(1),
    crossFmt: (v) => (v == null ? "—" : "₹" + v.toFixed(1) + " lakh cr"),
    a11yTitle: "Factory gross value added and emoluments, nominal rupees, 2008-09 to 2023-24",
    a11yDesc: "Two rising lines in ₹ lakh crore, nominal. GVA ends at ₹" + (last(H.gva) / 1e7).toFixed(1) + " lakh crore, emoluments at ₹" + (last(H.emoluments) / 1e7).toFixed(1) + " lakh crore. No deflator exists for these series.",
  });

  // companion: derived, dashed, its own small panel — never on the levels axis
  const geoG = { W: 1184, H: 190, ml: 70, mr: 230, mt: 26, mb: 38, d0: -6, d1: 30 };
  const pk21 = yoy.data[13]; // 2021-22 rebound
  const plotG = linePanel(document.getElementById("plot-grow"), ["yoy"], { yoy }, geoG, {
    yTicks: [0, 15, 30],
    yLabel: "↑ y/y change, % · derived",
    yFmt: (d) => (d === 30 ? "30%" : String(d)),
    xTicks: xTicksASI, xFmt: fy,
    leadWidth: 1.75, leadDash: "4 3", emphasize: false,
    gapFrac: 0.1,
    endFmt: (v) => v.toFixed(1) + "%",
    postMarks: [
      Plot.dot([pk21], { x: "date", y: "value", fill: "#BE3E26", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk21], { x: "date", y: "value", text: (d) => "+" + d.value.toFixed(1) + "% · 2021-22 — rebound plus reflation", dx: -12, dy: -2, fontSize: 12.5, fill: "#8A857A", fontFamily: mono, textAnchor: "end" }),
    ],
    a11yTitle: "Year-on-year change in nominal factory GVA, derived",
    a11yDesc: "Dashed line between about minus 3 and plus 27 per cent, dipping in 2019-20 and 2020-21 and spiking to +" + pk21.value.toFixed(1) + " per cent in 2021-22, part recovery and part price surge. Latest: +" + (last(H.gva) / prevV(H.gva) * 100 - 100).toFixed(1) + " per cent.",
  });
  void plotG;

  const block = document.getElementById("cb-money");
  wireTools(block, plotM, [M.gva, M.emoluments, yoy], "india-atlas_asi_gva-emoluments_2008-2023", fy);
  wireLegend(document.getElementById("legend-money"), plotM, ["gva", "emoluments"], M);
  wireLegend(document.getElementById("legend-money"), plotG, ["gva_yoy"], { gva_yoy: yoy });
}

/* ---------- § 05 plate 3 : state shares, sorted dot strip ---------- */
{
  const rename = { "Dadra & Nagar Havelli and Daman & Diu": "DNH & Daman & Diu" };
  const rows = [];
  for (const [k, s] of Object.entries(statesBundle.series)) {
    if (!k.startsWith("gva_")) continue;
    const v = s.data.at(-1);
    if (v == null) continue; // pre-merger UTs with discontinued series
    const nm = s.label.split(" · ")[1];
    rows.push({ state: rename[nm] || nm, gva: v, slug: k.slice(4) });
  }
  const total = rows.reduce((a, r) => a + r.gva, 0);
  rows.forEach((r) => (r.share = (r.gva / total) * 100));
  rows.sort((a, b) => b.share - a.share);
  const top3 = rows.slice(0, 3);
  const isTop = (d) => top3.includes(d);
  const share3 = top3.reduce((a, r) => a + r.share, 0);
  const share5 = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);

  setTxt("pv-states", share3.toFixed(1) + "%");
  setTxt("ex-s1", rows[0].share.toFixed(1) + "%");
  setTxt("ex-s3", share3.toFixed(1) + "%");
  setTxt("ex-s5", share5.toFixed(1) + "%");
  setTxt("ex-stn", fmtIN(statesBundle.series.factories_in_operation_tamil_nadu.data.at(-1)));
  setTxt("ex-smh", fmtIN(statesBundle.series.factories_in_operation_maharashtra.data.at(-1)));

  const geo = { W: 1184, H: 30 + rows.length * 23 + 40, ml: 250, mr: 90, mt: 30, mb: 40 };
  const xTicks = [0, 4, 8, 12, 16];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#5C574C", overflow: "visible" },
    x: { label: "share of factory GVA →", labelAnchor: "right", labelArrow: false, domain: [0, 16.5], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 16 ? "16%" : String(d)), grid: false },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.ruleY(rows, { y: "state", x1: 0, x2: "share", stroke: (d) => (isTop(d) ? "#E5B8AE" : "#E0DACA"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "state", x: "share", fill: (d) => (isTop(d) ? "#BE3E26" : "#5B564B"), r: 4 }),
      Plot.text(rows.filter((d) => !isTop(d)), { y: "state", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#8A857A", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(top3, { y: "state", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#BE3E26", fontSize: 11.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "State shares of factory gross value added, 2023-24",
    "Sorted dot strip of " + rows.length + " states and union territories. " + rows[0].state + " leads at " + rows[0].share.toFixed(1) + " per cent, then " + rows[1].state + " at " + rows[1].share.toFixed(1) + " and " + rows[2].state + " at " + rows[2].share.toFixed(1) + "; together " + share3.toFixed(1) + " per cent. Shares fall below 2 per cent after the top ten.");
  document.getElementById("plot-states").append(plot);
  const csv = ["state,share_pct,gva_inr_lakh", ...rows.map((r) => `"${r.state}",${r.share.toFixed(2)},${r.gva}`)].join("\n");
  wirePlate(document.getElementById("cb-states"), plot, "india-atlas_asi_state-gva-shares_2023-24", csv);
}

/* ---------- § 06 plate 4 : industry small multiples ---------- */
{
  const SHORT = {
    "10": "Food products", "11": "Beverages", "12": "Tobacco", "13": "Textiles",
    "14": "Wearing apparel", "15": "Leather", "16": "Wood products", "17": "Paper",
    "18": "Printing", "19": "Coke & petroleum", "20": "Chemicals", "21": "Pharmaceuticals",
    "22": "Rubber & plastics", "23": "Non-metallic minerals", "24": "Basic metals",
    "25": "Fabricated metal", "26": "Electronics & optical", "27": "Electrical equipment",
    "28": "Machinery n.e.c.", "29": "Motor vehicles", "30": "Other transport eqpt",
    "31": "Furniture", "32": "Other manufacturing", "33": "Repair & installation",
    "38": "Waste & recovery", "58": "Publishing", "01": "Crop & animal services",
    "08": "Other mining", "99998": "Unclassified",
  };
  const dates = industriesBundle.dates.map((d) => new Date(d + "T00:00:00Z"));
  const totalGVA = last(H.gva);
  const cells = Object.entries(industriesBundle.series)
    .filter(([k]) => k.startsWith("gva_"))
    .map(([k, s]) => {
      const code = k.slice(4);
      return { code, name: SHORT[code] || s.label, latest: s.data.at(-1), data: s.data.map((v, i) => ({ date: dates[i], value: v })) };
    })
    .sort((a, b) => b.latest - a.latest);
  const top5 = new Set(cells.slice(0, 5).map((c) => c.code));
  const share5 = cells.slice(0, 5).reduce((a, c) => a + c.latest, 0) / totalGVA * 100;

  setTxt("pv-ind", share5.toFixed(1) + "%");
  setTxt("ex-i1", (cells[0].latest / totalGVA * 100).toFixed(1) + "%");
  setTxt("ex-i2", (cells[1].latest / totalGVA * 100).toFixed(1) + "%");
  setTxt("ex-i3", (cells[2].latest / totalGVA * 100).toFixed(1) + "%");
  setTxt("ex-i5", share5.toFixed(1) + "%");

  const grid = document.getElementById("grid-ind");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(5, minmax(0, 1fr))";
  grid.style.gap = "26px 26px";
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", "Small-multiple grid of 16-year nominal GVA lines for " + cells.length + " NIC divisions, sorted by 2023-24 GVA. Basic metals lead at " + (cells[0].latest / totalGVA * 100).toFixed(1) + " per cent of factory GVA; the top five accented panels hold " + share5.toFixed(1) + " per cent. Each panel is on its own scale.");
  for (const c of cells) {
    const acc = top5.has(c.code);
    const color = acc ? "#BE3E26" : "#8A857A";
    const cell = document.createElement("div");
    const lab = document.createElement("div");
    lab.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:.56rem;letter-spacing:.1em;text-transform:uppercase;color:" + (acc ? "#BE3E26" : "#8A857A") + ";margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    lab.textContent = c.code.length > 2 ? c.name : c.code + " · " + c.name;
    const val = document.createElement("div");
    val.style.cssText = "font-family:'IBM Plex Mono',monospace;font-size:.6rem;letter-spacing:.04em;color:#5C574C;margin-top:5px";
    val.textContent = lakhCr(c.latest) + " · " + (c.latest / totalGVA * 100).toFixed(1) + "%";
    const max = Math.max(...c.data.map((d) => d.value ?? 0));
    const mini = Plot.plot({
      width: 205, height: 62, marginLeft: 2, marginRight: 6, marginTop: 5, marginBottom: 2,
      style: { background: "transparent" },
      x: { axis: null },
      y: { axis: null, domain: [0, max * 1.05] },
      marks: [
        Plot.ruleY([0], { stroke: "#E6E2D6" }),
        Plot.lineY(c.data, { x: "date", y: "value", stroke: color, strokeWidth: acc ? 1.75 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([c.data.at(-1)], { x: "date", y: "value", fill: color, r: 2.2, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    cell.append(lab, mini, val);
    grid.append(cell);
  }
  const csvHead = "fiscal_year," + cells.map((c) => "nic_" + c.code).join(",");
  const csvRows = dates.map((d, i) => fy(d) + "," + cells.map((c) => c.data[i].value ?? "").join(","));
  wirePlate(document.getElementById("cb-ind"), null, "india-atlas_asi_gva-by-industry_2008-2023", [csvHead, ...csvRows].join("\n"));
}

/* ---------- § 07 the other economy ---------- */
{
  const estOAE = last(UA.establishments_oae), estHWE = last(UA.establishments_hwe), estAll = last(UA.establishments_all);
  const wrkOAE = last(UA.workers_oae), wrkHWE = last(UA.workers_hwe), wrkAll = last(UA.workers_all);
  setTxt("ot-oaesh", (estOAE / estAll * 100).toFixed(1) + "%");
  setTxt("ot-hwesh", (estHWE / estAll * 100).toFixed(1) + "%");
  setTxt("ot-hwewk", (wrkHWE / wrkAll * 100).toFixed(1) + "%");

  const baskets = [
    ["bar-est", "lab-est", [
      ["Establishments — own-account (OAE), nobody hired", estOAE, estAll, "#C6C0B0"],
      ["Hired-worker establishments (HWE)", estHWE, estAll, "#BE3E26"],
    ]],
    ["bar-wrk", "lab-wrk", [
      ["Workers — in own-account establishments", wrkOAE, wrkAll, "#C6C0B0"],
      ["Workers in hired-worker establishments", wrkHWE, wrkAll, "#BE3E26"],
    ]],
  ];
  for (const [barId, labId, segs] of baskets) {
    document.getElementById(barId).innerHTML = segs.map(([n, v, t, c]) =>
      `<div class="seg" style="width:${(v / t * 100).toFixed(2)}%;background:${c}" title="${n} — ${(v / t * 100).toFixed(1)}%"></div>`).join("");
    document.getElementById(labId).innerHTML = segs.map(([n, v, t, c]) =>
      `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${croreN(v)} cr · ${(v / t * 100).toFixed(1)}% · 2023-24</div></div>`).join("");
  }

  // quarterly bulletin — counts published in hundreds ('00); a level, not a trend
  const qEst = UQ.establishments_00_all_activities;
  setTxt("q-now", croreN(last(qEst) * 100) + " crore");
  setTxt("q-then", croreN(firstV(qEst) * 100) + " crore");
}

/* ---------- § 07 signature plate : GVA per worker, one scale ---------- */
{
  const rows = [
    { cat: "Registered factory · ASI (derived)", v: gvaPerPersonASI, c: "#BE3E26" },
    { cat: "Unincorporated · hires workers (HWE)", v: last(UA.gva_per_worker_hwe), c: "#5B564B" },
    { cat: "Unincorporated · all establishments", v: last(UA.gva_per_worker_all), c: "#8A857A" },
    { cat: "Unincorporated · own-account (OAE)", v: last(UA.gva_per_worker_oae), c: "#C6C0B0" },
  ];
  setTxt("pv-mult", multAll.toFixed(1) + "×");
  setTxt("ex-x1", "₹" + lakhOf(gvaPerPersonASI) + " lakh");
  setTxt("ex-x2", "₹" + fmtIN(last(UA.gva_per_worker_all)));
  setTxt("ex-x3", multAll.toFixed(1) + "×");
  setTxt("ex-x4", multOAE.toFixed(1) + "×");
  setTxt("ex-x5", "₹" + lakhOf(emolPerPersonASI) + " lakh");
  setTxt("ex-x6", "₹" + lakhOf(last(UA.emoluments_per_hired_worker_hwe)) + " lakh");
  setTxt("ex-x7", wageMult.toFixed(1) + "×");

  const xTicks = [0, 400000, 800000, 1200000];
  const plot = Plot.plot({
    width: 1184, height: 270, marginLeft: 330, marginRight: 150, marginTop: 12, marginBottom: 40,
    style: { background: "transparent", fontFamily: mono, fontSize: "13px", color: "#5C574C", overflow: "visible" },
    x: { label: "GVA per worker, ₹ per year · nominal · 2023-24 →", labelAnchor: "right", labelArrow: false, domain: [0, 1320000], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 0 ? "0" : "₹" + d / 100000 + " lakh") },
    y: { label: null, domain: rows.map((r) => r.cat), tickSize: 0, tickPadding: 14, tickFormat: (s) => String(s), padding: 0.28 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.barX(rows, { y: "cat", x: "v", fill: "c" }),
      Plot.text(rows.slice(1), { y: "cat", x: "v", dx: 12, text: (d) => "₹" + lakhOf(d.v) + " L", fill: (d) => (d.c === "#C6C0B0" ? "#8A857A" : d.c), fontSize: 13.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text([rows[0]], { y: "cat", x: "v", dx: 12, text: (d) => "₹" + lakhOf(d.v) + " L", fill: "#BE3E26", fontSize: 13.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Gross value added per worker, factory versus unincorporated establishments, 2023-24",
    "Four horizontal bars on one rupee scale. A registered factory adds ₹" + lakhOf(gvaPerPersonASI) + " lakh per person engaged per year (derived from ASI). Unincorporated establishments add ₹" + lakhOf(last(UA.gva_per_worker_hwe)) + " lakh with hired workers, ₹" + lakhOf(last(UA.gva_per_worker_all)) + " lakh overall and ₹" + lakhOf(last(UA.gva_per_worker_oae)) + " lakh for own-account establishments. The factory multiple over the overall figure is " + multAll.toFixed(1) + " times.");
  document.getElementById("plot-mult").append(plot);
  const csv = ["category,gva_per_worker_inr_per_year", ...rows.map((r) => `"${r.cat}",${Math.round(r.v)}`)].join("\n");
  wirePlate(document.getElementById("cb-mult"), plot, "india-atlas_asi-asuse_gva-per-worker_2023-24", csv);
}

/* ---------- sparklines ---------- */
spark("nspark-fact", H.factories_in_operation);
regRows.forEach(([s], i) => spark("sp-f" + i, s));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", headlineBundle.meta.vintage);
setTxt("prov-vintage2", headlineBundle.meta.vintage);
