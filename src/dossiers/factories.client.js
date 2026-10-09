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
import accountsBundle from "../../data/series/asi-accounts.json";
import legacy1987 from "../../data/series/asi-headline-1987.json";
import legacy1998 from "../../data/series/asi-headline-1998.json";
import legacy2004 from "../../data/series/asi-headline-2004.json";
import industriesBundle from "../../data/series/asi-industries.json";
import statesBundle from "../../data/series/asi-states.json";
import asuseBundle from "../../data/series/asuse-annual.json";
import asuseQBundle from "../../data/series/asuse-quarterly.json";
import asuseSectorsBundle from "../../data/series/asuse-sectors.json";
import asuseStatesBundle from "../../data/series/asuse-states.json";
import ownersBundle from "../../data/series/asuse-owners.json";
import modernityBundle from "../../data/series/asuse-modernity.json";
import structureBundle from "../../data/series/asuse-structure.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob,
} from "../charts/plumbing.js";

const H = hydrate(headlineBundle);
const ACC = hydrate(accountsBundle);
const L87 = hydrate(legacy1987);
const L98 = hydrate(legacy1998);
const L04 = hydrate(legacy2004);
const UA = hydrate(asuseBundle);
const UQ = hydrate(asuseQBundle);
const USec = hydrate(asuseSectorsBundle);
const USt = hydrate(asuseStatesBundle);
const UO = hydrate(ownersBundle);
const UM = hydrate(modernityBundle);
const US = hydrate(structureBundle);

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
setHTML("d-inf", `<b>${arrow(last(UA.establishments_all) - prevV(UA.establishments_all), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(UA.establishments_all.data.at(-2).date)}, ASUSE`);
setHTML("n-mult", multAll.toFixed(1) + pc("×"));
setHTML("d-mult", `<b>₹${lakhOf(gvaPerPersonASI)} lakh</b> vs <b>₹${lakhOf(last(UA.gva_per_worker_all))} lakh</b>, per worker, nominal`);

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
H.factories_in_operation.color = "#2E4BD8";
H.number_of_factories.color = "#5F6675";
H.persons_engaged.color = "#5F6675";
H.workers.color = "#A3A9B4";
H.gva.color = "#2E4BD8";
H.emoluments.color = "#878D99";
H.total_output.color = "#C9CED6";
UA.establishments_all.color = "#A3A9B4";
UA.workers_all.color = "#A3A9B4";
UA.gva_per_worker_all.color = "#5F6675";
UA.emoluments_per_hired_worker_hwe.color = "#878D99";

UM.internet_all_combined.color = "#2E4BD8";
UM.reg_not_registered_combined.color = "#5F6675";
US.own_proprietary_female_combined.color = "#878D99";
const per1000 = (v) => fmtIN(v) + " / 1,000";

const regRows = [
  [H.factories_in_operation, "Factories in operation", "ASI, count, from 2008-09", "s-acc", fmtIN, fmtIN],
  [H.persons_engaged, "Persons engaged", "ASI, count, all registered factories", "s-g1", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [H.gva, "Factory gross value added", "ASI, ₹ lakh cr, nominal", "s-acc", (v) => lakhCr(v), (v) => lakhCr(v)],
  [H.emoluments, "Emoluments: wages & salaries", "ASI, ₹ lakh cr, nominal", "s-g4", (v) => lakhCr(v), (v) => lakhCr(v)],
  [H.total_output, "Gross output", "ASI, ₹ lakh cr, nominal", "s-g3", (v) => lakhCr(v), (v) => lakhCr(v)],
  [UA.establishments_all, "Establishments, unincorporated", "ASUSE, count, from 2021-22", "s-g2", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [UA.workers_all, "Workers, unincorporated", "ASUSE, count, from 2021-22", "s-g2", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [UA.gva_per_worker_all, "GVA per worker", "ASUSE, ₹ per year, market establishments", "s-g1", (v) => "₹" + fmtIN(v), (v) => "₹" + fmtIN(v)],
  [UA.emoluments_per_hired_worker_hwe, "Emoluments per hired worker", "ASUSE, HWE only, ₹ per year", "s-g4", (v) => "₹" + fmtIN(v), (v) => "₹" + fmtIN(v)],
  [UM.internet_all_combined, "Establishments using the internet", "ASUSE, per 1,000, from 2021-22", "s-acc", per1000, fmtIN],
  [UM.reg_not_registered_combined, "Registered under no act", "ASUSE, per 1,000, from 2021-22", "s-g1", per1000, fmtIN],
  [US.own_proprietary_female_combined, "Female-proprietor establishments", "ASUSE, per 1,000, from 2021-22", "s-g4", per1000, fmtIN],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fV, fD], i) => {
  const data = s.data.filter((d) => d.value != null);
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${fV(data.at(-1).value)}</td>
    <td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)}, vs ${fy(data.at(-2).date)}</td>
    <td class="yr">${fV(data[0].value)}, ${fy(data[0].date)}</td>
    <td class="spark" id="sp-f${i}"></td>
  </tr>`;
}).join("");

/* ---------- shared line-panel renderer (per-panel crosshair container) ---------- */
function linePanel(el, keys, store, geo, opts) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * (opts.gapFrac ?? 0.07));
  const marks = [
    Plot.gridY(opts.yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }) : null,
    ...(opts.preMarks || []),
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: opts.leadWidth ?? 2, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: opts.leadDash }),
    opts.emphasize !== false ? Plot.lineY(store[keys[0]].data.filter((d) => d.value != null).slice(-4), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round", strokeDasharray: opts.leadDash }) : null,
    ...(opts.postMarks || []),
    ...seriesList.map((s) => Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > (geo.d1 - geo.d0) * 0.004).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${opts.endFmt(p.value)}`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
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

/* ---------- § 03 plate 1 : the long century — four rulers, never joined ----------
 * The house two-bases pattern (iip) generalised to four classification
 * blocks. Each block is its own line; nothing crosses a seam; the 1987
 * block's missing 1993-94 stays a hole in its line. */
{
  const BLOCKS = [
    ["b1987", L87, "NIC-1987", "#C9CED6"],
    ["b1998", L98, "NIC-1998", "#A3A9B4"],
    ["b2004", L04, "NIC-2004", "#878D99"],
    ["b2008", H, "NIC-2008", "#2E4BD8"],
  ];
  const storeOf = (key) => Object.fromEntries(BLOCKS.map(([bk, S, lab, col]) => [bk, { ...S[key], label: lab, color: col }]));
  const factStore = storeOf("number_of_factories");
  const persStore = storeOf("persons_engaged");
  const seams = [1998, 2004, 2008].map((y) => new Date(Date.UTC(y, 3, 1)));
  const xTicksLong = [1992, 1996, 2000, 2004, 2008, 2012, 2016, 2020, 2023].map((y) => new Date(Date.UTC(y, 3, 1)));
  const lastPt = (s) => s.data.filter((d) => d.value != null).at(-1);
  const firstPt = (s) => s.data.filter((d) => d.value != null)[0];

  const panel = (el, store, geo, opts) => {
    const sers = BLOCKS.map(([bk]) => store[bk]);
    const plot = Plot.plot({
      width: geo.W, height: geo.H,
      marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
      style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
      x: { label: null, tickSize: 0, tickPadding: 14, ticks: xTicksLong, tickFormat: fy },
      y: { label: opts.yLabel, labelAnchor: "top", labelArrow: false,
           tickFormat: opts.yFmt, ticks: opts.yTicks, domain: [0, geo.d1], tickSize: 0, tickPadding: 11 },
      marks: [
        Plot.gridY(opts.yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
        Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
        ...seams.map((d) => Plot.ruleX([d], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" })),
        ...(opts.seamLabels ? seams.map((d, i) => Plot.text([{ date: d, value: geo.d1 * 0.97 }], {
          x: "date", y: "value", text: [["'98", "'04", "'08"][i] + " reclassified"],
          dx: 6, fontSize: 11.5, fill: "#878D99", fontFamily: mono, textAnchor: "start",
        })) : []),
        ...sers.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.color === "#2E4BD8" ? 2.75 : 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
        ...sers.map((s) => Plot.dot([lastPt(s)], { x: "date", y: "value", fill: s.color, r: s.color === "#2E4BD8" ? 4.5 : 3, stroke: "#FFFFFF", strokeWidth: 1.5 })),
        ...(opts.blockLabels ? sers.slice(0, 3).map((s) => Plot.text([lastPt(s)], {
          x: "date", y: "value", text: (d) => opts.endFmt(d.value),
          dy: opts.labelDy?.[s.label] ?? -14, dx: -8, fontSize: 12, fill: "#161A22" === "#C9CED6" ? "#878D99" : s.color, fontFamily: mono, textAnchor: "end",
        })) : []),
        Plot.text([lastPt(sers[3])], { x: "date", y: "value", text: (d) => `NIC-2008 ${opts.endFmt(d.value)}`, dx: 14, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      ],
    });
    a11y(plot, opts.a11yTitle, opts.a11yDesc);
    el.append(plot);
    return plot;
  };

  const geoF = { W: 1184, H: 350, ml: 70, mr: 210, mt: 30, mb: 42, d1: 300000 };
  const plotF = panel(document.getElementById("plot-long-fact"), factStore, geoF, {
    yTicks: [0, 100000, 200000, 300000],
    yLabel: "↑ factories on the register, thousand",
    yFmt: (d) => (d === 0 ? "0" : String(d / 1000) + "k"),
    endFmt: (v) => lakhOf(v, 2) + " L",
    seamLabels: true, blockLabels: true,
    labelDy: { "NIC-1987": -16, "NIC-1998": 18, "NIC-2004": 18 },
    a11yTitle: "Factories on the ASI register, 1992-93 to 2023-24, across four classification blocks drawn as four separate lines",
    a11yDesc: "Four line segments that never join. The NIC-1987 block runs from " + fmtIN(firstPt(factStore.b1987).value) + " in 1992-93 to " + fmtIN(lastPt(factStore.b1987).value) + " in 1997-98, with 1993-94 missing at source. The 1998 block dips to " + fmtIN(128549) + " in 2001-02. The 2004 block climbs to " + fmtIN(lastPt(factStore.b2004).value) + " by 2007-08, and the current 2008 block rises from " + fmtIN(firstPt(factStore.b2008).value) + " to " + fmtIN(lastPt(factStore.b2008).value) + ", including the 2010-11 frame revision. Seams mark reclassifications, not events.",
  });

  const geoP = { W: 1184, H: 300, ml: 70, mr: 210, mt: 28, mb: 42, d1: 20000000 };
  panel(document.getElementById("plot-long-pers"), persStore, geoP, {
    yTicks: [0, 5000000, 10000000, 15000000, 20000000],
    yLabel: "↑ persons engaged, crore",
    yFmt: (d) => (d === 0 ? "0" : (d / 1e7).toFixed(1) + (d === 20000000 ? " cr" : "")),
    endFmt: (v) => croreN(v) + " cr",
    seamLabels: false, blockLabels: true,
    labelDy: { "NIC-1987": -16, "NIC-1998": 20, "NIC-2004": 18 },
    a11yTitle: "Persons engaged in registered factories, 1992-93 to 2023-24, across four classification blocks",
    a11yDesc: "Four separate line segments. Factory employment stood at " + croreN(lastPt(persStore.b1987).value) + " crore in 1997-98, fell through the 1998 block to " + croreN(lastPt(persStore.b1998).value) + " crore by 2003-04, recovered through the 2004 block, and rises through the current block to " + croreN(lastPt(persStore.b2008).value) + " crore in 2023-24.",
  });

  setTxt("pv-long", lakhOf(lastPt(factStore.b1987).value, 2) + " → " + lakhOf(lastPt(factStore.b2008).value, 2) + " lakh");
  setTxt("ex-l87", fmtIN(firstPt(factStore.b1987).value));
  setTxt("ex-l98", fmtIN(lastPt(factStore.b1987).value));
  setTxt("ex-l02", fmtIN(L98.number_of_factories.data.find((d) => d.date.getUTCFullYear() === 2001).value));
  setTxt("ex-lp97", croreN(lastPt(persStore.b1987).value) + " crore");
  setTxt("ex-lp03", croreN(lastPt(persStore.b1998).value) + " crore");
  setTxt("ex-lp23", croreN(lastPt(persStore.b2008).value) + " crore");

  const csvRows = [];
  {
    const head = ["fiscal_year"];
    const cols = [];
    for (const [bk, , lab] of BLOCKS) {
      head.push(`factories_${lab.toLowerCase().replace("-", "")}`, `persons_${lab.toLowerCase().replace("-", "")}`);
      cols.push([factStore[bk], persStore[bk]]);
    }
    for (let y = 1992; y <= 2023; y++) {
      const row = [`${y}-${String((y + 1) % 100).padStart(2, "0")}`];
      for (const [f, p] of cols) {
        const fv = f.data.find((d) => d.date.getUTCFullYear() === y);
        const pv = p.data.find((d) => d.date.getUTCFullYear() === y);
        row.push(fv?.value ?? "", pv?.value ?? "");
      }
      csvRows.push(row.join(","));
    }
    csvRows.unshift(head.join(","));
  }
  wirePlate(document.getElementById("cb-long"), plotF, "india-atlas_asi_four-blocks_1992-2023", csvRows.join("\n"));
  const legendEl = document.getElementById("legend-long");
  const pf = document.getElementById("plot-long-fact").querySelector("svg");
  const pp = document.getElementById("plot-long-pers").querySelector("svg");
  wireLegend(legendEl, pf, ["b1987", "b1998", "b2004", "b2008"], factStore);
  wireLegend(legendEl, pp, ["b1987", "b1998", "b2004", "b2008"], persStore);
}

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
        Plot.ruleX([frameBreak], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
        Plot.text([{ date: frameBreak, value: 258000 }], { x: "date", y: "value", text: ["2010-11, frame revised: a wider net, not new factories"], dx: 8, fontSize: 12.5, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
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
    gva: { label: "GVA", color: "#2E4BD8", name: "asi_gva_lakh_crore", data: H.gva.data.map((d) => ({ date: d.date, value: d.value / 1e7 })) },
    emoluments: { label: "Emoluments", color: "#5F6675", name: "asi_emoluments_lakh_crore", data: H.emoluments.data.map((d) => ({ date: d.date, value: d.value / 1e7 })) },
  };
  const yoy = {
    label: "GVA y/y", color: "#2E4BD8", name: "asi_gva_yoy_pct_derived",
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
    yLabel: "↑ ₹ lakh crore, nominal",
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
    yLabel: "↑ y/y change, %, derived",
    yFmt: (d) => (d === 30 ? "30%" : String(d)),
    xTicks: xTicksASI, xFmt: fy,
    leadWidth: 1.75, leadDash: "4 3", emphasize: false,
    gapFrac: 0.1,
    endFmt: (v) => v.toFixed(1) + "%",
    postMarks: [
      Plot.dot([pk21], { x: "date", y: "value", fill: "#2E4BD8", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk21], { x: "date", y: "value", text: (d) => "+" + d.value.toFixed(1) + "%, 2021-22: rebound plus reflation", dx: -12, dy: -2, fontSize: 12.5, fill: "#878D99", fontFamily: mono, textAnchor: "end" }),
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
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "share of factory GVA →", labelAnchor: "right", labelArrow: false, domain: [0, 16.5], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 16 ? "16%" : String(d)), grid: false },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleY(rows, { y: "state", x1: 0, x2: "share", stroke: (d) => (isTop(d) ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "state", x: "share", fill: (d) => (isTop(d) ? "#2E4BD8" : "#5F6675"), r: 4 }),
      Plot.text(rows.filter((d) => !isTop(d)), { y: "state", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#878D99", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(top3, { y: "state", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
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
    const color = acc ? "#2E4BD8" : "#878D99";
    const cell = document.createElement("div");
    const lab = document.createElement("div");
    lab.style.cssText = "font-family:var(--sans);font-size:.56rem;color:" + (acc ? "#2E4BD8" : "#878D99") + ";margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    lab.textContent = c.code.length > 2 ? c.name : c.code + ", " + c.name;
    const val = document.createElement("div");
    val.style.cssText = "font-family:var(--sans);font-size:.6rem;letter-spacing:.04em;color:#5F6675;margin-top:5px";
    val.textContent = lakhCr(c.latest) + ", " + (c.latest / totalGVA * 100).toFixed(1) + "%";
    const max = Math.max(...c.data.map((d) => d.value ?? 0));
    const mini = Plot.plot({
      width: 205, height: 62, marginLeft: 2, marginRight: 6, marginTop: 5, marginBottom: 2,
      style: { background: "transparent" },
      x: { axis: null },
      y: { axis: null, domain: [0, max * 1.05] },
      marks: [
        Plot.ruleY([0], { stroke: "#ECEEF2" }),
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

/* ---------- § 06 plate 4c : jobs vs value — the industry scatter ----------
 * Where the jobs are, against where the value is. Industries below the diagonal
 * are labour-intensive (big in employment, modest in value added); above it,
 * capital-intensive. The persons_engaged series were ingested but never shown. */
{
  const SHORT = {
    "10": "Food", "11": "Beverages", "12": "Tobacco", "13": "Textiles", "14": "Apparel", "15": "Leather",
    "16": "Wood", "17": "Paper", "18": "Printing", "19": "Coke & petroleum", "20": "Chemicals",
    "21": "Pharmaceuticals", "22": "Rubber & plastics", "23": "Non-metallic minerals", "24": "Basic metals",
    "25": "Fabricated metal", "26": "Electronics", "27": "Electrical eqpt", "28": "Machinery", "29": "Motor vehicles",
    "30": "Other transport", "31": "Furniture", "32": "Other mfg", "33": "Repair", "38": "Waste", "58": "Publishing",
    "01": "Crop services", "08": "Other mining",
  };
  const codes = [...new Set(Object.keys(industriesBundle.series).filter((k) => k.startsWith("gva_")).map((k) => k.slice(4)))].filter((c) => c !== "99998");
  const gv = (c) => industriesBundle.series["gva_" + c].data.at(-1);
  const em = (c) => industriesBundle.series["persons_engaged_" + c]?.data.at(-1);
  const codes2 = codes.filter((c) => em(c) != null && gv(c) != null);
  const totG = codes2.reduce((a, c) => a + gv(c), 0);
  const totE = codes2.reduce((a, c) => a + em(c), 0);
  const pts = codes2.map((c) => ({ code: c, name: SHORT[c] || c, g: gv(c) / totG * 100, e: em(c) / totE * 100 })).filter((p) => p.g > 0.1 && p.e > 0.1);
  const maxS = Math.max(...pts.map((p) => p.g), ...pts.map((p) => p.e)) * 1.15;
  const labour = [...pts].sort((a, b) => b.e / b.g - a.e / a.g).slice(0, 4);
  const labelled = new Set([...labour.map((p) => p.code), ...[...pts].sort((a, b) => b.g - a.g).slice(0, 3).map((p) => p.code)]);
  const isLab = (p) => labour.includes(p);
  setTxt("pv-jv", labour[0].name + ", " + labour[0].e.toFixed(1) + "% of jobs, " + labour[0].g.toFixed(1) + "% of value");
  setTxt("ex-jv-lab", labour[0].name + ": " + labour[0].e.toFixed(1) + "% of jobs, " + labour[0].g.toFixed(1) + "% of value");
  const capTop = [...pts].sort((a, b) => b.g / b.e - a.g / a.e)[0];
  setTxt("ex-jv-cap", capTop.name + ": " + capTop.g.toFixed(1) + "% of value, " + capTop.e.toFixed(1) + "% of jobs");

  const geo = { W: 1184, H: 560, ml: 70, mr: 40, mt: 30, mb: 56 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "share of factory employment →", labelAnchor: "right", labelArrow: "none", domain: [0, maxS], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => String(d) + "%" },
    y: { label: "↑ share of factory value added", labelAnchor: "top", labelArrow: false, domain: [0, maxS], tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d === Math.round(maxS) ? d + "%" : String(d)) },
    marks: [
      Plot.gridY([0, 5, 10, 15, 20], { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.gridX([0, 5, 10, 15, 20], { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.line([{ e: 0, g: 0 }, { e: maxS, g: maxS }], { x: "e", y: "g", stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ e: maxS * 0.86, g: maxS * 0.9 }], { x: "e", y: "g", text: ["capital-intensive →"], fontSize: 11.5, fill: "#878D99", fontFamily: mono, textAnchor: "end" }),
      Plot.text([{ e: maxS * 0.9, g: maxS * 0.78 }], { x: "e", y: "g", text: ["← labour-intensive"], fontSize: 11.5, fill: "#878D99", fontFamily: mono, textAnchor: "end" }),
      Plot.dot(pts, { x: "e", y: "g", fill: (d) => (isLab(d) ? "#2E4BD8" : "#A3A9B4"), r: (d) => (labelled.has(d.code) ? 5.5 : 4), stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.text(pts.filter((p) => labelled.has(p.code) && p.code !== "15"), { x: "e", y: "g", text: "name", dx: 9, dy: -7, fill: (d) => (isLab(d) ? "#161A22" : "#5F6675"), fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      // Leather's dot sits beneath Tobacco's — label it below, not above
      Plot.text(pts.filter((p) => p.code === "15" && labelled.has(p.code)), { x: "e", y: "g", text: "name", dx: 9, dy: 15, fill: (d) => (isLab(d) ? "#161A22" : "#5F6675"), fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Share of factory employment against share of factory value added, by two-digit industry, 2023-24",
    "Scatter, one dot per industry. Above the diagonal sit capital-intensive industries (more value than their headcount would imply); below it, labour-intensive ones (big in jobs, modest in value). The most labour-intensive is " + labour[0].name + " at " + labour[0].e.toFixed(1) + " per cent of jobs against " + labour[0].g.toFixed(1) + " per cent of value; the most capital-intensive is " + capTop.name + ".");
  document.getElementById("plot-jv").append(plot);
  wirePlate(document.getElementById("cb-jv"), plot, "india-atlas_asi_jobs-vs-value_2023-24",
    "nic_code,name,employment_share_pct,gva_share_pct\n" + pts.map((p) => p.code + "," + p.name + "," + p.e.toFixed(2) + "," + p.g.toFixed(2)).join("\n"));
}

/* ---------- § 06 plate 4d : labour share by industry — where the jobs are ----------
 * Companion to the GVA small-multiples (value) and the jobs-vs-value scatter
 * (the gap). This dot strip ranks industries by share of factory employment,
 * the third view of the same industries. persons_engaged per industry was
 * ingested but never shown on its own until now. */
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
    "08": "Other mining",
  };
  const codes = Object.keys(industriesBundle.series)
    .filter((k) => k.startsWith("persons_engaged_"))
    .map((k) => k.slice(16))
    .filter((c) => c !== "99998");
  const totE = codes.reduce((a, c) => a + industriesBundle.series["persons_engaged_" + c].data.at(-1), 0);
  const rows = codes
    .map((c) => ({ code: c, name: SHORT[c] || c, emp: industriesBundle.series["persons_engaged_" + c].data.at(-1) }))
    .filter((d) => d.emp > 0)
    .map((d) => ({ ...d, share: (d.emp / totE) * 100 }))
    .sort((a, b) => b.share - a.share);
  const top3 = rows.slice(0, 3);
  const isTop = (d) => top3.includes(d);
  const share3 = top3.reduce((a, r) => a + r.share, 0);
  const share5 = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);

  setTxt("pv-lab", share3.toFixed(1) + "%");
  setTxt("ex-lb1", rows[0].name + ", " + rows[0].share.toFixed(1) + "%");
  setTxt("ex-lb2", rows[1].name + ", " + rows[1].share.toFixed(1) + "%");
  setTxt("ex-lb3", rows[2].name + ", " + rows[2].share.toFixed(1) + "%");
  setTxt("ex-lb5", share5.toFixed(1) + "%");

  const geo = { W: 1184, H: 30 + rows.length * 23 + 40, ml: 250, mr: 90, mt: 30, mb: 40 };
  const xTicks = [0, 4, 8, 12, 16];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "share of factory employment →", labelAnchor: "right", labelArrow: false, domain: [0, Math.ceil(rows[0].share / 2) * 2 + 1], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 0 ? "0" : String(d) + "%"), grid: false },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleY(rows, { y: "name", x1: 0, x2: "share", stroke: (d) => (isTop(d) ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "name", x: "share", fill: (d) => (isTop(d) ? "#2E4BD8" : "#5F6675"), r: 4 }),
      Plot.text(rows.filter((d) => !isTop(d)), { y: "name", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#878D99", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(top3, { y: "name", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Share of factory employment by two-digit industry, 2023-24",
    "Sorted dot strip of " + rows.length + " industries. " + rows[0].name + " leads at " + rows[0].share.toFixed(1) + " per cent of factory employment, then " + rows[1].name + " at " + rows[1].share.toFixed(1) + " and " + rows[2].name + " at " + rows[2].share.toFixed(1) + "; together " + share3.toFixed(1) + " per cent.");
  document.getElementById("plot-lab").append(plot);
  const csv = ["nic_code,name,employment_share_pct,persons_engaged_2023_24", ...rows.map((r) => r.code + "," + r.name + "," + r.share.toFixed(2) + "," + r.emp)].join("\n");
  wirePlate(document.getElementById("cb-lab"), plot, "india-atlas_asi_employment-share-by-industry_2023-24", csv);
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
      ["Establishments: own-account (OAE), nobody hired", estOAE, estAll, "#C9CED6"],
      ["Hired-worker establishments (HWE)", estHWE, estAll, "#2E4BD8"],
    ]],
    ["bar-wrk", "lab-wrk", [
      ["Workers: in own-account establishments", wrkOAE, wrkAll, "#C9CED6"],
      ["Workers in hired-worker establishments", wrkHWE, wrkAll, "#2E4BD8"],
    ]],
  ];
  for (const [barId, labId, segs] of baskets) {
    document.getElementById(barId).innerHTML = segs.map(([n, v, t, c]) =>
      `<div class="seg" style="width:${(v / t * 100).toFixed(2)}%;background:${c}" title="${n}: ${(v / t * 100).toFixed(1)}%"></div>`).join("");
    document.getElementById(labId).innerHTML = segs.map(([n, v, t, c]) =>
      `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${croreN(v)} cr, ${(v / t * 100).toFixed(1)}%, 2023-24</div></div>`).join("");
  }

  // quarterly bulletin — counts published in hundreds ('00); a level, not a trend
  const qEst = UQ.establishments_00_all_activities;
  setTxt("q-now", croreN(last(qEst) * 100) + " crore");
  setTxt("q-then", croreN(firstV(qEst) * 100) + " crore");
}

/* ---------- § 07 signature plate : GVA per worker, one scale ---------- */
{
  const rows = [
    { cat: "Registered factory, ASI (derived)", v: gvaPerPersonASI, c: "#2E4BD8" },
    { cat: "Unincorporated, hires workers (HWE)", v: last(UA.gva_per_worker_hwe), c: "#5F6675" },
    { cat: "Unincorporated, all establishments", v: last(UA.gva_per_worker_all), c: "#878D99" },
    { cat: "Unincorporated, own-account (OAE)", v: last(UA.gva_per_worker_oae), c: "#C9CED6" },
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
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "GVA per worker, ₹ per year · nominal · 2023-24 →", labelAnchor: "right", labelArrow: false, domain: [0, 1320000], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 0 ? "0" : "₹" + d / 100000 + " lakh") },
    y: { label: null, domain: rows.map((r) => r.cat), tickSize: 0, tickPadding: 14, tickFormat: (s) => String(s), padding: 0.28 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.barX(rows, { y: "cat", x: "v", fill: "c" }),
      Plot.text(rows.slice(1), { y: "cat", x: "v", dx: 12, text: (d) => "₹" + lakhOf(d.v) + " L", fill: (d) => (d.c === "#C9CED6" ? "#878D99" : d.c), fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.text([rows[0]], { y: "cat", x: "v", dx: 12, text: (d) => "₹" + lakhOf(d.v) + " L", fill: "#161A22", fontSize: 12, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Gross value added per worker, factory versus unincorporated establishments, 2023-24",
    "Four horizontal bars on one rupee scale. A registered factory adds ₹" + lakhOf(gvaPerPersonASI) + " lakh per person engaged per year (derived from ASI). Unincorporated establishments add ₹" + lakhOf(last(UA.gva_per_worker_hwe)) + " lakh with hired workers, ₹" + lakhOf(last(UA.gva_per_worker_all)) + " lakh overall and ₹" + lakhOf(last(UA.gva_per_worker_oae)) + " lakh for own-account establishments. The factory multiple over the overall figure is " + multAll.toFixed(1) + " times.");
  document.getElementById("plot-mult").append(plot);
  const csv = ["category,gva_per_worker_inr_per_year", ...rows.map((r) => `"${r.cat}",${Math.round(r.v)}`)].join("\n");
  wirePlate(document.getElementById("cb-mult"), plot, "india-atlas_asi-asuse_gva-per-worker_2023-24", csv);
}

/* ---------- § 08 plate : the informal economy's sectoral structure ----------
 * ASUSE splits the informal economy three ways by activity (Manufacturing,
 * Trading, Other Services) and two ways by sector (Rural, Urban). The
 * dumbbell shows the rural→urban gap per activity for workers and for GVA
 * per worker — volume skews rural in manufacturing, value skews urban
 * everywhere. */
{
  const acts = [
    ["manufacturing", "Manufacturing"],
    ["trading", "Trading"],
    ["other_services", "Other services"],
  ];
  const li = asuseSectorsBundle.dates.length - 1;
  const pick = (metric, sector, act) => USec[metric + "_" + sector + "_" + act].data[li].value;
  const buildRows = (metric) => acts.map(([k, label]) => ({ activity: label, rural: pick(metric, "rural", k), urban: pick(metric, "urban", k) }));

  const wrkRows = buildRows("workers");
  const gpwRows = buildRows("gva_per_worker");
  const estRows = buildRows("establishments");
  const totEstR = estRows.reduce((a, d) => a + d.rural, 0);
  const totEstU = estRows.reduce((a, d) => a + d.urban, 0);
  const totWrkR = wrkRows.reduce((a, d) => a + d.rural, 0);
  const totWrkU = wrkRows.reduce((a, d) => a + d.urban, 0);

  setTxt("pv-sec", (totEstR / (totEstR + totEstU) * 100).toFixed(0) + "%");
  setTxt("ex-sec-estr", (totEstR / (totEstR + totEstU) * 100).toFixed(0) + "%");
  setTxt("ex-sec-estu", (totEstU / (totEstR + totEstU) * 100).toFixed(0) + "%");
  setTxt("ex-sec-wrkr", croreN(totWrkR) + " cr");
  setTxt("ex-sec-wrku", croreN(totWrkU) + " cr");
  const gpwGap = acts.map(([k]) => pick("gva_per_worker", "urban", k) / pick("gva_per_worker", "rural", k));
  setTxt("ex-sec-gap", gpwGap[0].toFixed(1) + "×");
  setTxt("ex-sec-gaps", gpwGap[2].toFixed(1) + "×");

  const dumbbell = (rows, xLabel, xFmt, domain, xTicks) => {
    const flat = rows.flatMap((r) => [
      { activity: r.activity, sector: "Rural", v: r.rural },
      { activity: r.activity, sector: "Urban", v: r.urban },
    ]);
    return Plot.plot({
      width: 1184, height: 220,
      marginLeft: 180, marginRight: 140, marginTop: 14, marginBottom: 42,
      style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
      x: { label: xLabel, labelAnchor: "right", labelArrow: false, domain, ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: xFmt },
      y: { label: null, domain: acts.map(([, l]) => l), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s), padding: 0.32 },
      marks: [
        Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
        Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
        Plot.link(rows, { y: "activity", x1: "rural", x2: "urban", stroke: "#C9CED6", strokeWidth: 2 }),
        Plot.dot(flat.filter((d) => d.sector === "Rural"), { y: "activity", x: "v", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
        Plot.dot(flat.filter((d) => d.sector === "Urban"), { y: "activity", x: "v", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
        Plot.text(rows.filter((d) => d.rural < d.urban), { y: "activity", x: "rural", dx: -12, text: (d) => xFmt(d.rural), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
        Plot.text(rows.filter((d) => d.rural >= d.urban), { y: "activity", x: "rural", dx: 12, text: (d) => xFmt(d.rural), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
        Plot.text(rows.filter((d) => d.urban <= d.rural), { y: "activity", x: "urban", dx: -12, text: (d) => xFmt(d.urban), fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
        Plot.text(rows.filter((d) => d.urban > d.rural), { y: "activity", x: "urban", dx: 12, text: (d) => xFmt(d.urban), fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      ],
    });
  };

  const plotWrk = dumbbell(wrkRows, "workers, crore →, 2023-24", (d) => (d === 0 ? "0" : croreN(d) + " cr"), [0, 3e7], [0, 1e7, 2e7, 3e7]);
  a11y(plotWrk, "Informal workers by activity and sector, rural versus urban, 2023-24",
    "Dumbbell chart, three rows. Rural workers (grey) versus urban workers (blue) per activity. Manufacturing: " + croreN(wrkRows[0].rural) + " crore rural, " + croreN(wrkRows[0].urban) + " crore urban. Trading: " + croreN(wrkRows[1].rural) + " rural, " + croreN(wrkRows[1].urban) + " urban. Other services: " + croreN(wrkRows[2].rural) + " rural, " + croreN(wrkRows[2].urban) + " urban.");
  document.getElementById("plot-sec-wrk").append(plotWrk);

  const plotGpw = dumbbell(gpwRows, "GVA per worker, ₹ per year →, 2023-24", (d) => (d === 0 ? "0" : "₹" + lakhOf(d) + " L"), [0, 220000], [0, 50000, 100000, 150000, 200000]);
  a11y(plotGpw, "GVA per worker in informal establishments by activity and sector, rural versus urban, 2023-24",
    "Dumbbell chart, three rows. Rural GVA per worker (grey) versus urban (blue) per activity. The urban premium ranges from " + gpwGap[2].toFixed(1) + " times in other services to " + gpwGap[0].toFixed(1) + " times in manufacturing.");
  document.getElementById("plot-sec-gpw").append(plotGpw);

  const csv = ["metric,activity,sector,value_2023_24",
    ...wrkRows.map((r) => `workers,"${r.activity}",Rural,${r.rural}`),
    ...wrkRows.map((r) => `workers,"${r.activity}",Urban,${r.urban}`),
    ...estRows.map((r) => `establishments,"${r.activity}",Rural,${r.rural}`),
    ...estRows.map((r) => `establishments,"${r.activity}",Urban,${r.urban}`),
    ...gpwRows.map((r) => `gva_per_worker,"${r.activity}",Rural,${r.rural}`),
    ...gpwRows.map((r) => `gva_per_worker,"${r.activity}",Urban,${r.urban}`),
  ].join("\n");
  wirePlate(document.getElementById("cb-sec"), plotWrk, "india-atlas_asuse_sectoral-structure_2023-24", csv);
}

/* ---------- § 08 plate : informal state dispersion ----------
 * The ASI state strip (§06) shows where the factory rupee concentrates. This
 * ASUSE mirror shows where informal workers sit — a far wider map, because
 * the informal economy is everywhere the factory economy is not. */
{
  const rename = { "Dadra & Nagar Haveli and Daman & Diu": "DNH & Daman & Diu" };
  const rows = [];
  for (const [k, s] of Object.entries(asuseStatesBundle.series)) {
    if (!k.startsWith("wrk_")) continue;
    const v = s.data.at(-1);
    if (v == null || v === 0) continue;
    const nm = s.label.split(" · ")[1];
    rows.push({ state: rename[nm] || nm, workers: v });
  }
  const total = rows.reduce((a, r) => a + r.workers, 0);
  rows.forEach((r) => (r.share = (r.workers / total) * 100));
  rows.sort((a, b) => b.share - a.share);
  const top3 = rows.slice(0, 3);
  const isTop = (d) => top3.includes(d);
  const share3 = top3.reduce((a, r) => a + r.share, 0);
  const share5 = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);

  setTxt("pv-ust", share3.toFixed(1) + "%");
  setTxt("ex-ust1", rows[0].state + ", " + rows[0].share.toFixed(1) + "%");
  setTxt("ex-ust3", share3.toFixed(1) + "%");
  setTxt("ex-ust5", share5.toFixed(1) + "%");

  const geo = { W: 1184, H: 30 + rows.length * 23 + 40, ml: 220, mr: 90, mt: 30, mb: 40 };
  const xMax = Math.ceil(rows[0].share / 2) * 2 + 1;
  const xTicks = [0, 4, 8, 12, 16].filter((d) => d <= xMax);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "share of informal workers →", labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 0 ? "0" : String(d) + "%"), grid: false },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleY(rows, { y: "state", x1: 0, x2: "share", stroke: (d) => (isTop(d) ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "state", x: "share", fill: (d) => (isTop(d) ? "#2E4BD8" : "#5F6675"), r: 4 }),
      Plot.text(rows.filter((d) => !isTop(d)), { y: "state", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#878D99", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(top3, { y: "state", x: "share", dx: 12, text: (d) => d.share.toFixed(1) + "%", fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Share of informal workers by state and union territory, 2023-24",
    "Sorted dot strip of " + rows.length + " states and union territories. " + rows[0].state + " leads at " + rows[0].share.toFixed(1) + " per cent, then " + rows[1].state + " at " + rows[1].share.toFixed(1) + " and " + rows[2].state + " at " + rows[2].share.toFixed(1) + "; together " + share3.toFixed(1) + " per cent. Dispersion is far wider than the factory GVA map.");
  document.getElementById("plot-ust").append(plot);
  const csv = ["state,workers_share_pct,workers_count_2023_24", ...rows.map((r) => `"${r.state}",${r.share.toFixed(2)},${r.workers}`)].join("\n");
  wirePlate(document.getElementById("cb-ust"), plot, "india-atlas_asuse_state-worker-shares_2023-24", csv);
}

/* ---------- § 09 : the informal firm, described ---------- */
const renderBasket = (barId, labId, segs, denom) => {
  document.getElementById(barId).innerHTML = segs.map(([n, v, c]) =>
    `<div class="seg" style="width:${(v / 10).toFixed(2)}%;background:${c}" title="${n}: ${v} per 1,000"></div>`).join("");
  document.getElementById(labId).innerHTML = segs.map(([n, v, c]) =>
    `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${fmtIN(v)} / 1,000 ${denom}, 2023-24</div></div>`).join("");
};
{
  setTxt("if-reg", fmtIN(last(UM.reg_not_registered_combined)));
  setTxt("if-comp", fmtIN(last(UM.computer_all_combined)));

  /* -- who owns the shop -- */
  const soc = (g) => last(UO[`social_${g}_combined`]);
  const own = (g) => last(US[`own_${g}_combined`]);
  const socSegs = [
    ["Other Backward Classes", soc("obc"), "#2E4BD8"],
    ["Scheduled Caste", soc("sc"), "#5F6675"],
    ["Scheduled Tribe", soc("st"), "#878D99"],
    ["Others", soc("others"), "#C9CED6"],
    ["Not known", soc("not_known"), "#ECEEF2"],
  ];
  const collective = own("partnership_same_hh") + own("partnership_diff_hh") + own("shg") + own("society_trust") + own("cooperatives") + own("others");
  const sexSegs = [
    ["Proprietary: male owner", own("proprietary_male"), "#5F6675"],
    ["Proprietary: female owner", own("proprietary_female"), "#2E4BD8"],
    ["Partnerships, SHGs, societies, co-operatives", collective, "#C9CED6"],
  ];
  renderBasket("bar-social", "lab-social", socSegs, "proprietary & partnership estts.");
  renderBasket("bar-sex", "lab-sex", sexSegs, "of all establishments");
  const edu = (g) => last(UO[`edu_${g}_combined`]);
  setTxt("pv-owner", fmtIN(soc("obc") + soc("sc") + soc("st")) + " / 1,000");
  setTxt("ex-o-obc", fmtIN(soc("obc")));
  setTxt("ex-o-sc", fmtIN(soc("sc")));
  setTxt("ex-o-st", fmtIN(soc("st")));
  setTxt("ex-o-fem", fmtIN(Math.round(own("proprietary_female") / own("proprietary_all") * 1000)));
  setTxt("ex-o-edu", fmtIN(edu("not_literate") + edu("below_primary") + edu("primary_to_secondary")));
  const ownerCsv = ["dimension,category,per_1000_2023_24",
    ...socSegs.map(([n, v]) => `owner_social_group,"${n}",${v}`),
    ...sexSegs.map(([n, v]) => `ownership_type,"${n}",${v}`),
    ...["not_literate", "below_primary", "primary_to_secondary", "secondary_to_hs", "hs_to_graduate", "graduate_and_above"].map((g) => `owner_education,"${UO[`edu_${g}_combined`].label}",${edu(g)}`),
  ].join("\n");
  wirePlate(document.getElementById("cb-owner"), null, "india-atlas_asuse_who-owns-the-shop_2023-24", ownerCsv);
}

{
  /* -- the paperwork and the wires: per-1,000 dot strip -- */
  const m = (k) => last(UM[k]);
  const rows = [
    { cat: "Bank / post-office account: any", v: m("bank_any_account_combined"), c: "#5F6675" },
    { cat: "Not registered under any act", v: m("reg_not_registered_combined"), c: "#C9CED6" },
    { cat: "Using the internet", v: m("internet_all_combined"), c: "#2E4BD8" },
    { cat: "State-specific licence / registration", v: m("reg_state_licence_combined"), c: "#878D99" },
    { cat: "Account in the establishment's name", v: m("bank_estab_account_combined"), c: "#878D99" },
    { cat: "Regional Transport Office", v: m("reg_rto_combined"), c: "#878D99" },
    { cat: "Shops & Establishments Act", v: m("reg_shops_estb_act_combined"), c: "#878D99" },
    { cat: "Using a computer", v: m("computer_all_combined"), c: "#5F6675" },
    { cat: "GST: CGST Act", v: m("reg_cgst_act_combined"), c: "#878D99" },
  ].sort((a, b) => b.v - a.v);
  const xTicks = [0, 250, 500, 750, 1000];
  const plot = Plot.plot({
    width: 1184, height: 30 + rows.length * 34 + 40, marginLeft: 330, marginRight: 110, marginTop: 20, marginBottom: 40,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "per 1,000 establishments · 2023-24 →", labelAnchor: "right", labelArrow: false, domain: [0, 1000], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    y: { label: null, domain: rows.map((r) => r.cat), tickSize: 0, tickPadding: 14, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([1000], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY(rows, { y: "cat", x1: 0, x2: "v", stroke: (d) => (d.c === "#2E4BD8" ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "cat", x: "v", fill: "c", r: 3.5 }),
      Plot.text(rows, { y: "cat", x: "v", dx: 12, text: (d) => fmtIN(d.v), fill: (d) => (d.c === "#C9CED6" ? "#878D99" : d.c), fontSize: 12.5, fontFamily: mono, fontWeight: (d) => (d.c === "#161A22" ? 500 : 400), textAnchor: "start" }),
    ],
  });
  a11y(plot, "Rates per 1,000 unincorporated establishments: accounts, digital use and registrations, 2023-24",
    "Dot strip on a 0 to 1,000 scale. " + fmtIN(rows[0].v) + " per 1,000 maintain a bank or post-office account; " + fmtIN(m("reg_not_registered_combined")) + " are registered under no act; " + fmtIN(m("internet_all_combined")) + " use the internet and " + fmtIN(m("computer_all_combined")) + " a computer; GST registration is " + fmtIN(m("reg_cgst_act_combined")) + " per 1,000.");
  document.getElementById("plot-modern").append(plot);

  setTxt("pv-modern", fmtIN(m("internet_all_combined")));
  setTxt("ex-m-bank", fmtIN(m("bank_any_account_combined")));
  setTxt("ex-m-net", fmtIN(m("internet_all_combined")));
  setTxt("ex-m-comp", fmtIN(m("computer_all_combined")));
  setTxt("ex-m-gst", fmtIN(m("reg_cgst_act_combined")));
  setTxt("ex-m-shops", fmtIN(m("reg_shops_estb_act_combined")));
  setTxt("ex-m-none", fmtIN(m("reg_not_registered_combined")));
  setTxt("ex-m-hwe", fmtIN(m("internet_hwe_combined")));
  setTxt("ex-m-oae", fmtIN(m("internet_oae_combined")));
  const csv = ["metric,per_1000_2023_24", ...rows.map((r) => `"${r.cat}",${r.v}`)].join("\n");
  wirePlate(document.getElementById("cb-modern"), plot, "india-atlas_asuse_paperwork-and-wires_2023-24", csv);
}

{
  /* -- where it stands, when it works -- */
  const s = (k) => last(US[k]);
  const locSegs = [
    ["Within the household premises", s("loc_within_household_combined"), "#5F6675"],
    ["Fixed premises, permanent structure", s("loc_fixed_permanent_combined"), "#878D99"],
    ["Fixed premises, temporary / kiosk / stall", s("loc_fixed_temporary_combined"), "#A3A9B4"],
    ["Fixed premises, no structure", s("loc_fixed_no_structure_combined"), "#C9CED6"],
    ["Mobile markets", s("loc_mobile_market_combined"), "#E3E6EB"],
    ["Street vending, no fixed premises", s("loc_street_vendor_combined"), "#2E4BD8"],
  ];
  const moSegs = [
    ["3 months or fewer", s("months_le3_combined"), "#2E4BD8"],
    ["4 to 6 months", s("months_4_6_combined"), "#C9CED6"],
    ["7 to 9 months", s("months_7_9_combined"), "#A3A9B4"],
    ["More than 9 months", s("months_gt9_combined"), "#5F6675"],
  ];
  const hrSegs = [
    ["Under 4 hours a day", s("hours_lt4_combined"), "#C9CED6"],
    ["4 to 7 hours", s("hours_4_7_combined"), "#A3A9B4"],
    ["8 to 11 hours", s("hours_8_11_combined"), "#5F6675"],
    ["Over 11 hours", s("hours_gt11_combined"), "#2E4BD8"],
  ];
  renderBasket("bar-loc", "lab-loc", locSegs, "by location");
  renderBasket("bar-months", "lab-months", moSegs, "by months operated");
  renderBasket("bar-hours", "lab-hours", hrSegs, "by hours worked");
  setTxt("pv-rhythm", fmtIN(s("months_gt9_combined")) + " / 1,000");
  setTxt("ex-r-house", fmtIN(s("loc_within_household_combined")));
  setTxt("ex-r-perm", fmtIN(s("loc_fixed_permanent_combined")));
  setTxt("ex-r-street", fmtIN(s("loc_street_vendor_combined") + s("loc_mobile_market_combined")));
  setTxt("ex-r-m9", fmtIN(s("months_gt9_combined")));
  setTxt("ex-r-h8", fmtIN(s("hours_8_11_combined")));
  setTxt("ex-r-avg", s("months_avg_combined").toFixed(1));
  const csv = ["dimension,category,per_1000_2023_24",
    ...locSegs.map(([n, v]) => `location,"${n}",${v}`),
    ...moSegs.map(([n, v]) => `months_operated,"${n}",${v}`),
    ...hrSegs.map(([n, v]) => `hours_per_day,"${n}",${v}`),
    `months_operated,"Average months (count)",${s("months_avg_combined")}`,
  ].join("\n");
  wirePlate(document.getElementById("cb-rhythm"), null, "india-atlas_asuse_rhythm-of-the-firm_2023-24", csv);
}

/* ---------- § 10 : the factory accounts, complete ---------- */
{
  const codes = Object.keys(accountsBundle.series).map((k) => Number(k.slice(1))).sort((a, b) => a - b);
  const unitLabel = (code, unit) => {
    if (code === 42) return "thousand mandays";
    return { inr_lakh: "₹ lakh, nominal", count: "count", thousand: "₹ thousand, nominal", thousand_kwh: "thousand kWh", thousand_tonne: "thousand tonnes" }[unit] ?? unit;
  };
  const fmtVal = (code, unit, v) => {
    if (v == null) return "–";
    const sign = v < 0 ? "−" : "";
    const a = Math.abs(v);
    if (unit === "inr_lakh") return sign + (a >= 1e7 ? "₹" + (a / 1e7).toFixed(1) + " L cr" : "₹" + fmtIN(Math.round(a / 100)) + " cr");
    if (unit === "count") return sign + (a >= 1e7 ? croreN(a) + " cr" : a >= 2e5 ? lakhOf(a) + " lakh" : fmtIN(a));
    if (code === 42) return sign + croreN(a * 1000) + " cr days";
    if (unit === "thousand") return sign + "₹" + (a / 1e9).toFixed(2) + " L cr";
    if (unit === "thousand_kwh") return sign + fmtIN(Math.round(a / 1e6)) + " bn kWh";
    if (unit === "thousand_tonne") return sign + croreN(a * 1000, 1) + " cr t";
    return sign + fmtIN(a);
  };
  const rowsHtml = codes.map((code) => {
    const key = "i" + String(code).padStart(2, "0");
    const unit = accountsBundle.series[key].unit;
    const s = ACC[key];
    const pts = s.data.filter((d) => d.value != null);
    const latest = pts.at(-1), prev = pts.at(-2), first = pts[0];
    const f = (v) => fmtVal(code, unit, v);
    return `
    <tr>
      <td class="name">${s.label}<small>ASI ${code}, ${unitLabel(code, unit)}</small></td>
      <td class="val">${f(latest.value)}</td>
      <td class="chg">${arrow(latest.value - prev.value, (d) => f(d))}</td>
      <td class="yr">${f(first.value)}, ${fy(first.date)}</td>
      <td class="spark" id="sp-a${code}"></td>
    </tr>`;
  }).join("");
  document.getElementById("acct-body").innerHTML = rowsHtml;
  codes.forEach((code) => {
    const key = "i" + String(code).padStart(2, "0");
    spark("sp-a" + code, { ...ACC[key], color: code === 19 ? "#2E4BD8" : "#5F6675" });
  });

  setTxt("pv-acct", lakhCr(last(ACC.i19)));
  setTxt("ex-a-emol", lakhCr(last(ACC.i43)) + "ore");
  setTxt("ex-a-wrk", lakhCr(last(ACC.i46)) + "ore");
  setTxt("ex-a-con", (last(ACC.i37) / last(ACC.i32) * 100).toFixed(1) + "%");
  setTxt("ex-a-mand", croreN(last(ACC.i42) * 1000, 0));
  setTxt("ex-a-fuel", lakhCr(last(ACC.i16)) + "ore");
  setTxt("ex-a-elec", lakhCr(last(ACC.i54) / 100) + "ore"); // ₹ thousand -> ₹ lakh
  const years = accountsBundle.dates.map((d) => {
    const y = Number(d.slice(0, 4));
    return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
  });
  const csv = ["asi_code,indicator,unit," + years.join(","),
    ...codes.map((code) => {
      const key = "i" + String(code).padStart(2, "0");
      const b = accountsBundle.series[key];
      return `${code},"${b.label}",${b.unit},` + b.data.map((v) => v ?? "").join(",");
    }),
  ].join("\n");
  wirePlate(document.getElementById("cb-acct"), null, "india-atlas_asi_all-indicators_2008-2023", csv);
}

/* ---------- sparklines ---------- */
spark("nspark-fact", H.factories_in_operation);
regRows.forEach(([s], i) => spark("sp-f" + i, s));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", headlineBundle.meta.vintage);
setTxt("prov-vintage2", headlineBundle.meta.vintage);
