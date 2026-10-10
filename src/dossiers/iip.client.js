// Dossier 04 · IIP — plate definitions and number wiring.
// Data: data/series/iip-2022.json (current base) + iip-2011.json (retired base)
// + iip-industries-2022.json, baked at build time by scripts/fetch.mjs.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/iip-2022.json";
import oldBundle from "../../data/series/iip-2011.json";
import indBundle from "../../data/series/iip-industries-2022.json";
import oldIndBundle from "../../data/series/iip-industries-2011.json";
import herit04Bundle from "../../data/series/iip-2004.json";
import herit93Bundle from "../../data/series/iip-1993.json";
import ispBundle from "../../data/series/isp.json";
import herit80Bundle from "../../data/series/iip-1980.json";
import fy80Bundle from "../../data/series/iip-annual-1980.json";
import fy93Bundle from "../../data/series/iip-annual-1993.json";
import fy04Bundle from "../../data/series/iip-annual-2004.json";
import fy11Bundle from "../../data/series/iip-annual-2011.json";
import fy22Bundle from "../../data/series/iip-annual-2022.json";
import core93Bundle from "../../data/series/core-1993.json";
import core04Bundle from "../../data/series/core-2004.json";
import core11Bundle from "../../data/series/core-2011.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend, seamMarks, seamOverlap,
  peakOf, dodgeEndLabels, spark, fmt,
} from "../charts/plumbing.js";

const S = hydrate(bundle);
const OLD = hydrate(oldBundle);
const IND = hydrate(indBundle);
const OLDIND = hydrate(oldIndBundle);
const ISP = hydrate(ispBundle);
// presentation palette: bundle default colors repeat across charts — assign
// per-plate so every line on a chart is unique (the legend dimmer and end
// labels key off color)
S.sector_manufacturing.color = "#5F6675";
S.sector_mining_quarrying.color = "#A3A9B4";
S.sector_electricity_gas_supply.color = "#878D99";
S.sector_water_supply_sewerage_waste_management.color = "#C9CED6";
S.sector_water_supply_sewerage_waste_management.label = "Water & waste";
S.use_capital_goods.color = "#2E4BD8";
S.use_infrastructure_construction_goods.color = "#5F6675";
S.use_consumer_durables.color = "#A3A9B4";
S.use_consumer_non_durables.color = "#878D99";
/* end labels must fit the right margin; the full bundle labels stay in the
 * legend chips and tooltips, the short forms ride the line ends */
S.sector_electricity_gas_supply.endLabel = "Electricity";
S.sector_mining_quarrying.endLabel = "Mining";
S.use_infrastructure_construction_goods.endLabel = "Infrastructure";
S.use_consumer_non_durables.endLabel = "Non-durables";
S.use_consumer_durables.endLabel = "Durables";
IND.sub_manufacturing_manufacture_of_electrical_equipment.color = "#2E4BD8";
IND.sub_manufacturing_manufacture_of_motor_vehicles_trailers_and_semi_trailers.color = "#5F6675";
IND.sub_manufacturing_manufacture_of_wearing_apparel.color = "#A3A9B4";
IND.sub_manufacturing_manufacture_of_wood_and_products_of_wood_and_cork_except_furniture_manufacture_of_articles_of_straw_and_plaiting_materials.color = "#878D99";
const dates = S.general.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
// periods named in descriptions come from the data, never typed in
const MLONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const longDate = (d) => MLONG[d.getUTCMonth()] + " " + d.getUTCFullYear();
const LATEST = longDate(S.general.data.at(-1).date);

/* ---------- numbers ---------- */
const L = {}; for (const k in S) L[k] = S[k].data.at(-1).value;
const P = {}; for (const k in S) P[k] = S[k].data.at(-2).value;
const Y = {}; for (const k in S) Y[k] = S[k].data.at(-13).value;
const prevName = fmtDate(S.general.data.at(-2).date);
const pc = '<span class="pc">%</span>';
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
const word = (d) => (d >= 0 ? "accelerating" : "cooling");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(2) + "%";

setHTML("n-head", L.general.toFixed(2) + pc);
setHTML("n-mfg", L.sector_manufacturing.toFixed(2) + pc);
setHTML("n-cap", L.use_capital_goods.toFixed(2) + pc);
setHTML("n-elec", L.sector_electricity_gas_supply.toFixed(2) + pc);
setHTML("d-head", `<b>${arrow(L.general - P.general)}</b> vs ${prevName}, ${word(L.general - P.general)}`);
setHTML("d-mfg", `<b>${arrow(L.sector_manufacturing - P.sector_manufacturing)}</b> vs ${prevName}`);
setHTML("d-cap", `<b>${arrow(L.use_capital_goods - P.use_capital_goods)}</b> vs ${prevName}`);
setHTML("d-elec", `<b>${arrow(L.sector_electricity_gas_supply - P.sector_electricity_gas_supply)}</b> vs ${prevName}`);

setHTML("rb-big", L.general.toFixed(2) + pc);
setHTML("rb-prev", P.general.toFixed(2) + pc);
// §01 "current reading" prose is pipeline-generated (pipeline/out/prose-iip.*.md).

setTxt("pv-bases", f1(L.general));
setTxt("pv-main", f1(L.general));
setTxt("pv-use", f1(L.use_capital_goods));
setTxt("pv-ind", f1(IND.sub_manufacturing_manufacture_of_electrical_equipment.data.at(-1).value));
setTxt("ex-cap", f1(L.use_capital_goods));
setTxt("ex-cnd", f1(L.use_consumer_non_durables));
setTxt("ex-elec", f1(IND.sub_manufacturing_manufacture_of_electrical_equipment.data.at(-1).value));
setTxt("ex-mv", f1(IND.sub_manufacturing_manufacture_of_motor_vehicles_trailers_and_semi_trailers.data.at(-1).value));
setTxt("ex-app", f1(Math.abs(IND.sub_manufacturing_manufacture_of_wearing_apparel.data.at(-1).value)));

/* ---------- register ---------- */
const regRows = [
  ["general", "General (headline)", "The whole index", "s-acc"],
  ["sector_manufacturing", "Manufacturing", "The heavyweight sector", "s-g1"],
  ["sector_mining_quarrying", "Mining & quarrying", "Answers to the monsoon", "s-g2"],
  ["sector_electricity_gas_supply", "Electricity & gas supply", "Generation, not consumption", "s-g3"],
  ["sector_water_supply_sewerage_waste_management", "Water supply & waste", "Fourth sector, new on this base", "s-g4"],
  ["use_primary_goods", "Primary goods", "Use-based", "s-g1"],
  ["use_capital_goods", "Capital goods", "The investment cycle", "s-acc"],
  ["use_intermediate_goods", "Intermediate goods", "Use-based", "s-g2"],
  ["use_infrastructure_construction_goods", "Infrastructure / construction", "Use-based", "s-g3"],
  ["use_consumer_durables", "Consumer durables", "The confident household", "s-g4"],
  ["use_consumer_non_durables", "Consumer non-durables", "The everyday household", "s-g1"],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([k, nm, sub, sw]) => `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${f1(L[k])}</td>
    <td class="chg">${arrow(L[k] - P[k])}, ${word(L[k] - P[k])}</td>
    <td class="yr">${f1(Y[k])}</td>
    <td class="spark" id="sp-${k}"></td>
  </tr>`).join("");

/* ---------- shared plate renderer ---------- */
function multiLine(blockId, plotId, keys, store, geo, yTicks, xTicks, dlName, a11yTitle, a11yDesc) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList.filter((s) => s.data.at(-1).value != null), (geo.d1 - geo.d0) * 0.05);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(store[keys[0]].data.filter((d) => d.value != null).slice(-7), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    ...seriesList.filter((s) => s.data.at(-1).value != null).map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.endLabel ?? p.s.label} ${p.value.toFixed(2)}%`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
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
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, seriesList, dlName);
  addCrosshair(document.getElementById(plotId), plot, seriesList, geo, fmtDate);
  return plot;
}

/* ---------- two bases ---------- */
{
  // the retired base's first year has no y/y (no year-ago level); leading
  // nulls are trimmed, interior gaps stay null (Mar 2025 was missing until MoSPI loaded it, seen 2026-10)
  // and break the line — the gap is the story
  const oldData = OLD.general.data;
  const firstValid = oldData.findIndex((d) => d.value != null);
  const old = { ...OLD.general, label: "Base 2011-12", color: "#878D99", data: oldData.slice(firstValid) };
  const cur = { ...S.general, label: "Base 2022-23", color: "#2E4BD8" };
  const geo = { W: 1184, H: 520, ml: 80, mr: 195, mt: 36, mb: 48, d0: -65, d1: 140 };
  const yTicks = [-50, 0, 50, 100];
  const xTicks = []; for (let y = 2014; y <= 2026; y += 2) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      // the shared seam: two rulers side by side, the changeover marked where the new base starts
      ...seamMarks("side", [old, cur], { at: new Date(Date.UTC(2023, 3, 1)), text: "base revised, 2011-12 → 2022-23",
        textAt: new Date(Date.UTC(2023, 5, 1)), y: 132, anchor: "start", dx: 0, fontSize: 12.5, solid: true }),
      Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2018, 0, 1)), value: 133 }], { x: "date", y: "value", text: ["COVID-19, −57% then +134%"], fontSize: 12.5, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.dot([cur.data.at(-1)], { x: "date", y: "value", fill: cur.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([cur.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 2022-23 ${d.value.toFixed(2)}%`, dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.dot([old.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: old.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([old.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", text: (d) => `Base 2011-12 ${d.value.toFixed(2)}%`, dx: 16, dy: 20, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "IIP year-on-year growth on the retired 2011-12 base and the current 2022-23 base",
    "Two line charts side by side on one time axis. The old base spans 2013 to 2026 including the COVID crash of minus 57 per cent and rebound of plus 134 per cent. The current base runs from 2024 and ends at " + L.general.toFixed(1) + " per cent. The bases are never spliced.");
  document.getElementById("plot-bases").append(plot);
  wireTools(document.getElementById("cb-bases"), plot, [cur, old], "india-atlas_iip_two-bases");
  // no crosshair here: the two bases have different spans, so a shared index
  // cannot address both — the tooltip would lie
}

/* ---------- the deep ledger: heritage bases 1993-94 and 2004-05 ---------- */
{
  const H04 = hydrate(herit04Bundle);
  const H93 = hydrate(herit93Bundle);
  const H80 = hydrate(herit80Bundle);
  // leading nulls (the base's first year has no same-base year-ago level)
  // are trimmed; the two spans differ and are never spliced
  const trim = (s, label, color) => {
    const i = s.data.findIndex((d) => d.value != null);
    return { ...s, label, color, data: s.data.slice(i) };
  };
  const h93 = trim(H93.general, "Base 1993-94", "#A3A9B4");
  const h04 = trim(H04.general, "Base 2004-05", "#5F6675");
  const h80 = trim(H80.general, "Base 1980-81", "#C9CED6");
  const low80 = h80.data.reduce((a, d) => (d.value != null && d.value < a.value ? d : a), h80.data[0]);
  const end80 = h80.data.filter((d) => d.value != null).at(-1);
  const fmtM = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%";
  // the one industrial winter: the deepest print either heritage ruler gave
  const trough = h04.data.reduce((a, d) => (d.value != null && d.value < a.value ? d : a), h04.data[0]);
  const gfc93 = h93.data.find((d) => d.date.getTime() === trough.date.getTime());
  const end93 = h93.data.filter((d) => d.value != null).at(-1);
  const end04 = h04.data.filter((d) => d.value != null).at(-1);
  setTxt("pv-herit", fmtM(trough.value));
  setTxt("her-gfc04", fmtM(trough.value));
  setTxt("her-gfc93", "+" + gfc93.value.toFixed(2) + "%");
  setTxt("her-end93", fmtM(end93.value));
  setTxt("her-low80", fmtM(low80.value));
  setTxt("her-low80-at", fmtDate(low80.date));
  setTxt("her-end80", fmtM(end80.value));
  setTxt("her-end04", fmtM(end04.value));
  const geo = { W: 1184, H: 520, ml: 80, mr: 190, mt: 36, mb: 48, d0: -12, d1: 26 };
  const yTicks = [-10, 0, 10, 20];
  const xTicks = []; for (let y = 1984; y <= 2016; y += 4) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.lineY(h80.data, { x: "date", y: "value", stroke: "#B5BAC4", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(h93.data, { x: "date", y: "value", stroke: h93.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(h04.data, { x: "date", y: "value", stroke: h04.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.ruleX([trough.date], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: new Date(Date.UTC(2008, 3, 1)), value: 24 }], { x: "date", y: "value", text: [`winter of 2008-09, ${fmtM(trough.value)} on one ruler, +${gfc93.value.toFixed(2)}% on the other`], fontSize: 12.5, fill: "#878D99", fontFamily: mono, textAnchor: "end" }),
      Plot.ruleX([new Date(Date.UTC(2006, 3, 1))], { stroke: "#CDD1D8", strokeWidth: 1 }),
      Plot.text([{ date: new Date(Date.UTC(2006, 5, 1)), value: -9.5 }], { x: "date", y: "value", text: ["base revised, 1993-94 → 2004-05"], fontSize: 12.5, fill: "#5F6675", fontFamily: mono, textAnchor: "start" }),
      Plot.ruleX([new Date(Date.UTC(1995, 3, 1))], { stroke: "#CDD1D8", strokeWidth: 1 }),
      Plot.text([{ date: new Date(Date.UTC(1995, 5, 1)), value: -9.5 }], { x: "date", y: "value", text: ["1980-81 → 1993-94"], fontSize: 12.5, fill: "#5F6675", fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ date: new Date(Date.UTC(1983, 0, 1)), value: 21 }], { x: "date", y: "value", text: ["Base 1980-81 (RBI's copy)"], fontSize: 12, fill: "#161A22", fontFamily: mono, textAnchor: "start" }),
      Plot.dot([trough], { x: "date", y: "value", fill: "#2E4BD8", r: 4, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([end93], { x: "date", y: "value", fill: h93.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      // the 1993-94 line ends mid-chart where the 2004-05 line is busy —
      // lift its label into the empty upper region on a short leader
      Plot.line([{ x: end93.date, y: end93.value + 1.2 }, { x: end93.date, y: 12.2 }], { x: "x", y: "y", stroke: h93.color, strokeWidth: 1, strokeOpacity: 0.45 }),
      Plot.text([{ date: end93.date, value: 13 }], { x: "date", y: "value", text: [`Base 1993-94 ${end93.value.toFixed(2)}%`], dx: 6, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([end04], { x: "date", y: "value", fill: h04.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([end04], { x: "date", y: "value", text: (d) => `Base 2004-05 ${d.value.toFixed(2)}%`, dx: 16, fill: "#161A22", fontSize: 12, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "IIP year-on-year growth on the retired 1980-81, 1993-94 and 2004-05 bases, 1982 to 2017",
    "Three line charts side by side on one time axis. The 1980-81 base runs from 1982 to 1998 and touches " + fmtM(low80.value) + " in " + fmtDate(low80.date) + ". The 1993-94 base runs from 1995 to 2011 and never prints below zero. The 2004-05 base runs from 2006 to 2017 and dips to " + fmtM(trough.value) + " in February 2009. The bases are never spliced.");
  document.getElementById("plot-herit").append(plot);
  wireTools(document.getElementById("cb-herit"), plot, [h04, h93, h80], "india-atlas_iip_heritage-bases");
  // no crosshair: the two bases have different spans, so a shared index
  // cannot address both — the tooltip would lie
}

const fS = fmt.pct2Minus;   // signed with a true minus

/* ---------- financial years on five rulers ---------- */
{
  const fyLabel = (d) => `${d.getUTCFullYear()}-${String((d.getUTCFullYear() + 1) % 100).padStart(2, "0")}`;
  const R = [
    ["Base 1980-81", fy80Bundle, "#C9CED6"], ["Base 1993-94", fy93Bundle, "#A3A9B4"], ["Base 2004-05", fy04Bundle, "#878D99"],
    ["Base 2011-12", fy11Bundle, "#5F6675"], ["Base 2022-23", fy22Bundle, "#2E4BD8"],
  ].map(([label, b, color]) => { const H = hydrate(b); const s = H.general_growth; const i = s.data.findIndex((d) => d.value != null); return { ...s, label, color, data: s.data.slice(i) }; });
  const cur = R.at(-1), last = cur.data.at(-1);
  setTxt("pv-fy", fS(last.value));
  const all = R.flatMap((r) => r.data.filter((d) => d.value != null).map((d) => ({ ...d, r })));
  const falls = all.filter((d) => d.value < 0);
  const geo = { W: 1184, H: 500, ml: 70, mr: 150, mt: 36, mb: 48, d0: -11.5, d1: 17 };
  const yTicks = [-5, 0, 5, 10, 15];
  const xTicks = []; for (let y = 1982; y <= 2026; y += 4) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ growth on the year before, per cent", labelAnchor: "top", labelArrow: false, ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d === yTicks.at(-1) ? d + "%" : String(d)) },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      ...seamMarks("side", R, { text: "base 2022-23 from 2023-24", y: 15.5, anchor: "end", solid: true }),
      ...R.map((r) => Plot.dot(r.data.filter((d) => d.value != null), { x: "date", y: "value", fill: r.color, r: r === cur ? 4 : 3, stroke: "#FFFFFF", strokeWidth: 1 })),
      Plot.dot(falls, { x: "date", y: "value", r: 6, stroke: "#2E4BD8", strokeWidth: 1.5, fill: "none" }),
      // ruler names along the floor, under each ruler's own span, clear of every dot
      ...R.map((r) => { const v = r.data.filter((d) => d.value != null); const mid = new Date((v[0].date.getTime() + v.at(-1).date.getTime()) / 2);
        return Plot.text([{ date: mid, value: -10.4 }], { x: "date", y: "value", text: () => r.label.replace("Base ", ""), fill: "#4A5160", fontSize: 11.5, fontFamily: mono, textAnchor: "middle" }); }),
      Plot.text([last], { x: "date", y: "value", text: (d) => `${fyLabel(d.date)} ${fS(d.value)}`, dx: 14, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "IIP growth by financial year on five bases, " + fyLabel(R[0].data[0].date) + " to " + fyLabel(last.date),
    "Dots per financial year on five rulers drawn side by side. Output fell in " + falls.map((d) => fyLabel(d.date) + " (" + d.value.toFixed(1) + "%, " + d.r.label + ")").join(", ") + ". The latest year, " + fyLabel(last.date) + ", grew " + last.value.toFixed(1) + " per cent on base 2022-23.");
  document.getElementById("plot-fy").append(plot);
  wireTools(document.getElementById("cb-fy"), plot, R, "india-atlas_iip_financial-years_five-bases");
}

/* ---------- the core eight: latest financial year, by industry ---------- */
{
  const C = hydrate(core11Bundle);
  const i = C.composite_growth.data.length - 1;
  const fy = C.composite_growth.data[i].date;
  const fyLabel = `${fy.getUTCFullYear()}-${String((fy.getUTCFullYear() + 1) % 100).padStart(2, "0")}`;
  const rows = Object.keys(C).filter((k) => k.endsWith("_growth") && k !== "composite_growth")
    .map((k) => ({ k, name: C[k].label.split(",")[0], v: C[k].data[i].value, w: core11Bundle.series[k].weight }))
    .sort((a, b) => b.v - a.v).map((r) => ({ ...r, cat: `${r.name} (${r.w})` }));
  const comp = C.composite_growth.data[i].value;
  setTxt("pv-core", fS(comp));
  const ext = Math.max(...rows.map((r) => Math.abs(r.v)), Math.abs(comp)) * 1.25;
  const pos = rows.filter((r) => r.v >= 0), neg = rows.filter((r) => r.v < 0);
  const plot = Plot.plot({
    width: 1184, height: 430, marginLeft: 250, marginRight: 90, marginTop: 30, marginBottom: 40,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "growth on the year before, per cent →", labelAnchor: "right", domain: [-ext, ext], tickSize: 0, tickFormat: (d) => (d > 0 ? "+" : "") + d + "%" },
    y: { label: null, domain: rows.map((r) => r.cat), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: "#F0F2F5" }),
      Plot.barX(rows, { x: "v", y: "cat", fill: (d) => (d.v >= 0 ? "#2E4BD8" : "#A3A9B4"), insetTop: 6, insetBottom: 6 }),
      Plot.ruleX([0], { stroke: "#161A22", strokeOpacity: 0.55 }),
      Plot.ruleX([comp], { stroke: "#161A22", strokeDasharray: "3,3", strokeOpacity: 0.6 }),
      Plot.text([{ x: comp, y: rows[0].cat }], { x: "x", y: "y", text: [`composite ${fS(comp)}`], dy: -16, dx: 6, textAnchor: "start", fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(pos, { x: "v", y: "cat", text: (d) => "+" + d.v.toFixed(1) + "%", dx: 8, textAnchor: "start", fill: "#161A22", fontSize: 12.5, fontFamily: mono }),
      Plot.text(neg, { x: "v", y: "cat", text: (d) => "−" + Math.abs(d.v).toFixed(1) + "%", dx: -8, textAnchor: "end", fill: "#161A22", fontSize: 12.5, fontFamily: mono }),
    ],
  });
  a11y(plot, "The eight core industries, growth in " + fyLabel + ", base 2011-12",
    "Bar chart. " + rows.map((r) => r.name + " " + r.v.toFixed(1) + " per cent").join(", ") + ". Composite " + comp.toFixed(1) + " per cent.");
  document.getElementById("plot-core").append(plot);
  const csv = [{ ...C.composite_growth, label: "Composite", data: [C.composite_growth.data[i]] }, ...rows.map((r) => ({ ...C[r.k], label: r.name, data: [C[r.k].data[i]] }))];
  wireTools(document.getElementById("cb-core"), plot, csv, "india-atlas_iip_core-eight_" + fyLabel);
}

/* ---------- the core over three rulers, against the IIP ---------- */
{
  const fyLabel = (d) => `${d.getUTCFullYear()}-${String((d.getUTCFullYear() + 1) % 100).padStart(2, "0")}`;
  const trim = (s, label, color, width) => { const i = s.data.findIndex((d) => d.value != null); let j = s.data.length - 1; while (j > i && s.data[j].value == null) j--; return { ...s, label, color, width, data: s.data.slice(i, j + 1) }; };
  const R = [
    trim(hydrate(core93Bundle).composite_growth, "Core, base 1993-94", "#A3A9B4"),
    trim(hydrate(core04Bundle).composite_growth, "Core, base 2004-05", "#878D99"),
    trim(hydrate(core11Bundle).composite_growth, "Core, base 2011-12", "#2E4BD8", 2.25),
  ];
  const iip = trim(hydrate(fy11Bundle).general_growth, "IIP general, base 2011-12", "#C47A16", 1.5);
  const at = (s, y) => s.data.find((d) => d.date.getUTCFullYear() === y)?.value;
  setTxt("pv-corelong", fS(at(R[2], 2020)));
  setTxt("core-2020", fS(at(R[2], 2020)));
  setTxt("iip-2020", fS(at(iip, 2020)));
  const ov = seamOverlap(R[0], R[1]);
  setTxt("core-gap", ov.gap.toFixed(1) + " points (" + fyLabel(ov.gapAt) + ")");
  const geo = { W: 1184, H: 500, ml: 70, mr: 130, mt: 36, mb: 48, d0: -10, d1: 14 };
  const yTicks = [-5, 0, 5, 10];
  const xTicks = []; for (let y = 1996; y <= 2024; y += 4) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const ends = [...R, iip].map((r) => ({ r, d: r.data.filter((d) => d.value != null).at(-1) }));
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ growth on the year before, per cent", labelAnchor: "top", labelArrow: false, ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d === yTicks.at(-1) ? d + "%" : String(d)) },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.lineY(iip.data, { x: "date", y: "value", stroke: iip.color, strokeWidth: 1.5, strokeDasharray: "4,3" }),
      ...seamMarks("overlap", R, { text: "rulers overlap", y: 12.8, anchor: "end" }),
      ...R.map((r) => Plot.dot(r.data.filter((d) => d.value != null), { x: "date", y: "value", fill: r.color, r: 2.5 })),
      // end labels for the two live lines only, the lower value pushed down, the higher up
      ...ends.filter((e) => e.r === R[2] || e.r === iip).map((e) => { const other = ends.find((o) => (o.r === R[2] || o.r === iip) && o !== e);
        return Plot.text([e.d], { x: "date", y: "value", text: () => `${e.r === iip ? "IIP" : "Core"} ${fS(e.d.value)}`, dx: 12, dy: e.d.value < other.d.value ? 8 : -8, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start", fontWeight: e.r === R[2] ? 500 : 400 }); }),
      // ruler names along the floor, under each ruler's own span
      ...R.map((r) => { const v = r.data.filter((d) => d.value != null); const mid = new Date((v[0].date.getTime() + v.at(-1).date.getTime()) / 2);
        return Plot.text([{ date: mid, value: -9.3 }], { x: "date", y: "value", text: () => r.label.replace("Core, base ", "core, base "), fill: "#4A5160", fontSize: 11.5, fontFamily: mono, textAnchor: "middle" }); }),
      Plot.text([{ date: new Date(Date.UTC(1996, 0, 1)), value: 12.6 }], { x: "date", y: "value", text: ["dashed: IIP general index, base 2011-12"], fill: "#4A5160", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Growth of the eight-core composite index on three bases, with the IIP",
    "Lines per base, never spliced. The core fell only in 2020-21, by " + Math.abs(at(R[2], 2020)).toFixed(1) + " per cent, when the IIP fell " + Math.abs(at(iip, 2020)).toFixed(1) + " per cent.");
  document.getElementById("plot-corelong").append(plot);
  wireTools(document.getElementById("cb-corelong"), plot, [...R, iip], "india-atlas_iip_core-three-bases");
}

/* ---------- sectors ---------- */
{
  const keys = ["general", "sector_manufacturing", "sector_mining_quarrying", "sector_electricity_gas_supply", "sector_water_supply_sewerage_waste_management"];
  const geo = { W: 1184, H: 520, ml: 70, mr: 220, mt: 36, mb: 48, d0: -8, d1: 17 };
  const plot = multiLine("cb-main", "plot-main", keys, S, geo, [-5, 0, 5, 10, 15],
    [2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 0, 1))),
    "india-atlas_iip_sectors_base2022",
    "IIP by sector including water supply and waste management, year-on-year, April 2024 to " + LATEST,
    "Line chart. General ends at " + L.general.toFixed(1) + " per cent, manufacturing " + L.sector_manufacturing.toFixed(1) + ", mining " + L.sector_mining_quarrying.toFixed(1) + ", electricity and gas " + L.sector_electricity_gas_supply.toFixed(1) + ", water supply and waste " + L.sector_water_supply_sewerage_waste_management.toFixed(1) + ".");
  wireLegend(document.getElementById("legend-main"), plot, keys, S);
}

/* ---------- use-based ---------- */
{
  const keys = ["use_capital_goods", "use_infrastructure_construction_goods", "use_consumer_durables", "use_consumer_non_durables"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 230, mt: 30, mb: 48, d0: -11, d1: 18 };
  multiLine("cb-use", "plot-use", keys, S, geo, [-10, 0, 5, 10, 15],
    [2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 0, 1))),
    "india-atlas_iip_use-based_base2022",
    "IIP use-based categories, year-on-year, April 2024 to " + LATEST,
    "Line chart. Capital goods ends at " + L.use_capital_goods.toFixed(1) + " per cent against consumer non-durables at " + L.use_consumer_non_durables.toFixed(1) + ".");
}

/* ---------- industries ---------- */
{
  const keys = [
    "sub_manufacturing_manufacture_of_electrical_equipment",
    "sub_manufacturing_manufacture_of_motor_vehicles_trailers_and_semi_trailers",
    "sub_manufacturing_manufacture_of_wearing_apparel",
    "sub_manufacturing_manufacture_of_wood_and_products_of_wood_and_cork_except_furniture_manufacture_of_articles_of_straw_and_plaiting_materials",
  ];
  IND[keys[3]].label = "Wood products";
  IND[keys[1]].label = "Motor vehicles";
  IND[keys[0]].endLabel = "Electrical eq.";
  IND[keys[2]].endLabel = "Wearing apparel";
  const geo = { W: 1184, H: 470, ml: 70, mr: 210, mt: 30, mb: 48, d0: -14, d1: 36 };
  multiLine("cb-ind", "plot-ind", keys, IND, geo, [-10, 0, 10, 20, 30],
    [2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 0, 1))),
    "india-atlas_iip_industries_base2022",
    "Selected manufacturing industries, year-on-year, April 2024 to " + LATEST,
    "Line chart. Electrical equipment ends at +" + IND[keys[0]].data.at(-1).value.toFixed(1) + " per cent, apparel at " + IND[keys[2]].data.at(-1).value.toFixed(1) + ".");
}

/* ---------- the current-base industry field: every industry on 2022-23 base ----------
 * The retired base's 23-panel grid is a memory; the current base is the live
 * field. The freshest detail the index offers, ranked by the latest print. */
{
  const labelOf = (k) => k
    .replace(/^sub_manufacturing_manufacture_of_/, "")
    .replace(/^sub_manufacturing_/, "")
    .replace(/^sub_(mining_quarrying|electricity_gas_supply|water_supply_sewerage_waste_management)_/, "")
    .split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  const TH = 10;
  const fmtSigned = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
  const rows = Object.keys(IND).map((k) => {
    const s = IND[k];
    return { k, s, label: labelOf(k), last: s.data.filter((d) => d.value != null).at(-1) };
  }).sort((a, b) => b.last.value - a.last.value);
  const extremes = rows.filter((r) => Math.abs(r.last.value) >= TH);
  setTxt("ind-n", String(rows.length));
  setTxt("ind-hot", String(extremes.length));
  setTxt("ind-hi", rows[0].label + ", " + fmtSigned(rows[0].last.value));
  setTxt("ind-lo", rows.at(-1).label + ", " + fmtSigned(rows.at(-1).last.value));
  const grid = document.getElementById("grid-ind22");
  for (const r of rows) {
    const ex = Math.abs(r.last.value) >= TH;
    const col = ex ? "#2E4BD8" : "#5F6675";
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #ECEEF2;padding-top:11px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">` +
      `<div style="font-family:var(--sans);font-size:.58rem;color:#878D99;line-height:1.6;min-width:0">${r.label}</div>` +
      `<div style="font-family:var(--serif);font-weight:300;font-size:1.3rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:${ex ? "#2E4BD8" : "#161A22"}">${fmtSigned(r.last.value)}</div></div>`;
    const mini = Plot.plot({
      width: 260, height: 70, marginLeft: 2, marginRight: 8, marginTop: 6, marginBottom: 4,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [-20, 45] },
      marks: [
        Plot.ruleY([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
        Plot.lineY(r.s.data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.1, strokeLinejoin: "round", clip: true }),
        Plot.dot([r.last], { x: "date", y: "value", fill: col, r: 2.6, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    grid.append(div);
  }
  grid.setAttribute("aria-label",
    rows.length + " small line charts, one per industry on the current 2022-23 base, April 2024 to " + LATEST + ", ordered by the latest print. " + extremes.length + " industries ended beyond plus or minus 10 per cent.");
  wireTools(document.getElementById("cb-ind22"), null, rows.map((r) => r.s), "india-atlas_iip_industries_base2022-all", fmtDate);
}

/* ---------- the long ledger: 23 industries on the retired base ----------
 * Small multiples on one clipped scale. The lockdown prints (−99% to past
 * +1000%) are clipped off scale on purpose; the CSV carries full values. */
{
  const P = "sub_manufacturing_";
  const SHORT = {
    [P + "manufacture_of_basic_metals"]: "Basic metals",
    [P + "manufacture_of_basic_pharmaceutical_products_and_pharmaceutical_preparations"]: "Pharmaceuticals",
    [P + "manufacture_of_beverages"]: "Beverages",
    [P + "manufacture_of_chemicals_and_chemical_products"]: "Chemicals",
    [P + "manufacture_of_coke_and_refined_petroleum_products"]: "Coke & refined petroleum",
    [P + "manufacture_of_computer_electronic_and_optical_products"]: "Electronics & optical",
    [P + "manufacture_of_electrical_equipment"]: "Electrical equipment",
    [P + "manufacture_of_fabricated_metal_products_except_machinery_and_equipment"]: "Fabricated metals",
    [P + "manufacture_of_food_products"]: "Food products",
    [P + "manufacture_of_furniture"]: "Furniture",
    [P + "manufacture_of_leather_and_related_products"]: "Leather",
    [P + "manufacture_of_machinery_and_equipment_n_e_c"]: "Machinery n.e.c.",
    [P + "manufacture_of_motor_vehicles_trailers_and_semi_trailers"]: "Motor vehicles",
    [P + "manufacture_of_other_non_metallic_mineral_products"]: "Non-metallic minerals",
    [P + "manufacture_of_other_transport_equipment"]: "Other transport equipment",
    [P + "manufacture_of_paper_and_paper_products"]: "Paper",
    [P + "manufacture_of_rubber_and_plastics_products"]: "Rubber & plastics",
    [P + "manufacture_of_textiles"]: "Textiles",
    [P + "manufacture_of_tobacco_products"]: "Tobacco",
    [P + "manufacture_of_wearing_apparel"]: "Wearing apparel",
    [P + "manufacture_of_wood_and_products_of_wood_and_cork_except_furniture_manufacture_of_articles_of_straw_and_plaiting_materials"]: "Wood & cork",
    [P + "other_manufacturing"]: "Other manufacturing",
    [P + "printing_and_reproduction_of_recorded_media"]: "Printing & media",
  };
  const TH = 10; // disclosed accent threshold, per cent y/y
  const fmtSigned = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
  const rows = Object.keys(OLDIND).map((k) => {
    const s = OLDIND[k];
    return { k, s, last: s.data.filter((d) => d.value != null).at(-1) };
  }).sort((a, b) => b.last.value - a.last.value);
  const extremes = rows.filter((r) => Math.abs(r.last.value) >= TH);
  setTxt("pv-old", extremes.length + " / " + rows.length);
  setTxt("old-n", String(extremes.length));
  const hi = rows[0], lo = rows.at(-1);
  setTxt("old-hi-name", SHORT[hi.k].toLowerCase());
  setTxt("old-hi", fmtSigned(hi.last.value));
  setTxt("old-lo-name", SHORT[lo.k].toLowerCase());
  setTxt("old-lo", fmtSigned(lo.last.value));
  // shared axis is deliberately bounded: the 2021 rebound prints run to five
  // figures of per cent and are clipped by it — the swing is disclosed in prose
  const grid = document.getElementById("grid-old");
  for (const r of rows) {
    const ex = Math.abs(r.last.value) >= TH;
    const col = ex ? "#2E4BD8" : "#5F6675";
    const div = document.createElement("div");
    div.style.cssText = "border-top:1px solid #ECEEF2;padding-top:11px;min-width:0";
    div.innerHTML =
      `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">` +
      `<div style="font-family:var(--sans);font-size:.58rem;color:#878D99;line-height:1.6;min-width:0">${SHORT[r.k]}</div>` +
      `<div style="font-family:var(--serif);font-weight:300;font-size:1.3rem;font-variant-numeric:tabular-nums;white-space:nowrap;color:${ex ? "#2E4BD8" : "#161A22"}">${fmtSigned(r.last.value)}</div></div>`;
    const mini = Plot.plot({
      width: 260, height: 76, marginLeft: 2, marginRight: 8, marginTop: 6, marginBottom: 4,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [-40, 45] },
      marks: [
        Plot.ruleY([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
        Plot.lineY(r.s.data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.1, strokeLinejoin: "round", clip: true }),
        Plot.dot([r.last], { x: "date", y: "value", fill: col, r: 2.6, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    mini.style.width = "100%"; mini.style.height = "auto";
    div.append(mini);
    grid.append(div);
  }
  grid.setAttribute("aria-label",
    "Twenty-three small line charts, one per manufacturing industry on the retired 2011-12 base, April 2013 to March 2026, ordered by the final print. Latest values are printed beside each panel; " + extremes.length + " industries ended beyond plus or minus 10 per cent.");
  wireTools(document.getElementById("cb-old"), null, rows.map((r) => r.s), "india-atlas_iip_industries_base2011", fmtDate);
}

/* ---------- the services counterpart: ISP ---------- */
{
  const pick = [
    ["retail_trade", "#2E4BD8", "Retail trade"],
    ["road_transport", "#878D99", "Road transport"],
    ["banking", "#5F6675", "Banking"],
    ["telecommunication", "#C9CED6", "Telecommunication"],
    ["it_computer_related_services", "#A3A9B4", "IT services"],
  ];
  for (const [k, c, lb] of pick) { ISP[k].color = c; ISP[k].label = lb; }
  const keys = pick.map((p) => p[0]);
  const seriesList = keys.map((k) => ISP[k]);
  const dsI = ISP.retail_trade.data.map((d) => d.date);
  const li = dsI.length - 1, yi = li - 12;
  const lvl = (k, i) => ISP[k].data[i].value;

  // dated slots — all driven from the bundle
  setTxt("pv-isp", lvl("retail_trade", li).toFixed(1));
  setTxt("isp-rt", lvl("retail_trade", li).toFixed(1));
  setTxt("isp-rt-yy", ((lvl("retail_trade", li) / lvl("retail_trade", yi) - 1) * 100).toFixed(1) + "%");
  setTxt("isp-bk", lvl("banking", li).toFixed(1));
  // March by date (the year-end month), not by position: positions drift with every print
  const insMar = [...ISP.insurance.data].reverse().find((d) => d.date.getUTCMonth() === 2), insMay = ISP.insurance.data[li];
  setTxt("isp-ins-mar", insMar.value.toFixed(1));
  setTxt("isp-ins-may", insMay.value.toFixed(1));

  // range from the plotted series (20-point grid), so a new print never leaves the frame
  const ispVals = seriesList.flatMap((x) => x.data.map((d) => d.value)).filter((v) => v != null);
  const ispLo = Math.min(80, Math.floor(Math.min(...ispVals) / 20) * 20), ispHi = Math.max(160, Math.ceil(Math.max(...ispVals) / 20) * 20);
  const geo = { W: 1184, H: 470, ml: 70, mr: 250, mt: 30, mb: 48, d0: ispLo, d1: ispHi };
  const yTicks = []; for (let t = ispLo; t <= ispHi; t += 20) yTicks.push(t);
  const xTicks = [new Date(Date.UTC(2025, 3, 1)), new Date(Date.UTC(2025, 6, 1)), new Date(Date.UTC(2025, 9, 1)), new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 3, 1))];
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.055);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2) },
    y: { label: "↑ index · base 2024–25 = 100", labelAnchor: "top", labelArrow: false,
         ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([100], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ date: dsI[0], value: 88 }], { x: "date", y: "value", text: ["base-year average, 100"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      ...keys.slice(1).map((k) => Plot.lineY(ISP[k].data, { x: "date", y: "value", stroke: ISP[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(ISP.retail_trade.data, { x: "date", y: "value", stroke: ISP.retail_trade.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dsI.at(-1), y: p.value }, { x: dsI.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dsI.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(1)}`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  a11y(plot, "Index of Services Production, five selected series, levels, April 2025 to " + longDate(ISP.retail_trade.data.at(-1).date),
    "Line chart of index levels against a base-year average of 100, dashed. Retail trade ends at " + lvl("retail_trade", li).toFixed(1) + ", road transport " + lvl("road_transport", li).toFixed(1) + ", banking " + lvl("banking", li).toFixed(1) + ", telecommunication " + lvl("telecommunication", li).toFixed(1) + ", IT and computer services " + lvl("it_computer_related_services", li).toFixed(1) + ". The series is fourteen months old; no seasonal history exists.");
  document.getElementById("plot-isp").append(plot);
  wireTools(document.getElementById("cb-isp"), plot, seriesList, "india-atlas_isp_selected-services_base2024", fmtDate);
  wireLegend(document.getElementById("legend-isp"), plot, keys, ISP);
  addCrosshair(document.getElementById("plot-isp"), plot, seriesList, geo, fmtDate, (v) => v.toFixed(1));

  /* ---- the full ISP register: all 19 series, levels ---- */
  setTxt("isp-th-latest", "Level, " + fmtDate(dsI[li]));
  setTxt("isp-th-yoy", "vs " + fmtDate(dsI[yi]) + ", from levels");
  setTxt("isp-th-year", fmtDate(dsI[yi]));
  const sparkLevel = (id, s) => {
    const vs = s.data.map((d) => d.value);
    const p = Plot.plot({
      width: 190, height: 44, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain: [Math.min(...vs, 100), Math.max(...vs, 100)] },
      marks: [
        Plot.ruleY([100], { stroke: "#ECEEF2" }),
        Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 1.5, strokeLinejoin: "round" }),
        Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    p.setAttribute("aria-hidden", "true");
    document.getElementById(id).append(p);
  };
  const ispRows = Object.keys(ISP).map((k) => ISP[k]);
  document.getElementById("isp-ledger-body").innerHTML = ispRows.map((s, i) => {
    const l = s.data[li].value, y = s.data[yi].value;
    const g = (l / y - 1) * 100;
    const vs = s.data.map((d) => d.value);
    return `
  <tr>
    <td class="name"><span class="sw" style="background:${s.color}"></span>${s.label.trim()}<small>14 months, range ${Math.min(...vs).toFixed(1)} – ${Math.max(...vs).toFixed(1)}</small></td>
    <td class="val">${l.toFixed(1)}</td>
    <td class="chg">${(g >= 0 ? "▲ +" : "▼ −") + Math.abs(g).toFixed(1)}%</td>
    <td class="yr">${y.toFixed(1)}</td>
    <td class="spark" id="sp-isp${i}"></td>
  </tr>`;
  }).join("");
  ispRows.forEach((s, i) => sparkLevel("sp-isp" + i, s));

  /* ---- the full ISP field: all 19 services as small multiples ----
   * The 5-line chart above picks; this grid shows. Organised by cluster:
   * trade, logistics, finance, ICT, contact-intensive, professional. */
  const CLUSTERS = [
    ["Trade", ["wholesale_trade", "retail_trade"]],
    ["Logistics", ["air_transport", "railway_transport", "road_transport", "water_transport", "warehousing_and_support_activities_for_transportation", "postal_and_courier"]],
    ["Finance", ["banking", "insurance"]],
    ["ICT", ["it_computer_related_services", "telecommunication", "information_and_broadcasting"]],
    ["Contact-intensive", ["accommodation_and_food", "arts_entertainment_and_recreation", "repair_services"]],
    ["Professional & property", ["professional_scientific_technical_services_including_r_d", "administrative_and_support_services", "real_estate"]],
  ];
  const grid = document.getElementById("grid-isp");
  if (grid) {
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(230px, 1fr))";
    grid.style.gap = "24px 32px";
    const li2 = dsI.length - 1, yi2 = li2 - 12;
    for (const [cluster, services] of CLUSTERS) {
      for (const k of services) {
        const s = ISP[k];
        const lv = s.data[li2].value;
        const yoy = ((s.data[li2].value / s.data[yi2].value - 1) * 100);
        const vs = s.data.map((d) => d.value);
        const div = document.createElement("div");
        div.style.cssText = "border-top:1px solid #ECEEF2;padding-top:10px;min-width:0";
        const shortLabel = s.label.trim().replace(/\s+/g, " ");
        div.innerHTML =
          `<div style="font-family:var(--sans);font-size:.5rem;color:#A3A9B4;margin-bottom:2px">${cluster}</div>` +
          `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">` +
          `<div style="font-family:var(--sans);font-size:.56rem;letter-spacing:.06em;color:#5B564C;line-height:1.5;min-width:0">${shortLabel}</div></div>` +
          `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px">` +
          `<div style="font-family:var(--serif);font-weight:300;font-size:1.2rem;font-variant-numeric:tabular-nums;color:#161A22">${lv.toFixed(1)}</div>` +
          `<div style="font-family:var(--sans);font-size:.58rem;color:${yoy >= 0 ? "#5F6675" : "#2E4BD8"}">${(yoy >= 0 ? "+" : "") + yoy.toFixed(1)}%</div></div>`;
        const mini = Plot.plot({
          width: 210, height: 54, marginLeft: 2, marginRight: 6, marginTop: 4, marginBottom: 2,
          style: { background: "transparent" },
          x: { axis: null },
          y: { axis: null, domain: [Math.min(...vs, 95), Math.max(...vs, 105)] },
          marks: [
            Plot.ruleY([100], { stroke: "#ECEEF2", strokeWidth: 1 }),
            Plot.lineY(s.data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.25, strokeLinejoin: "round" }),
            Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: "#5F6675", r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
          ],
        });
        mini.setAttribute("aria-hidden", "true");
        mini.style.width = "100%"; mini.style.height = "auto";
        div.append(mini);
        grid.append(div);
      }
    }
    grid.setAttribute("aria-label", "Nineteen small line charts, one per ISP service, grouped into six clusters (trade, logistics, finance, ICT, contact-intensive, professional). Each shows the index level over fourteen months against a base-year average of 100. Retail trade ends at " + ISP.retail_trade.data[li2].value.toFixed(1) + ".");
  }
}

/* ---------- sparklines ---------- */
spark("nspark-head", S.general);
for (const [k] of regRows) spark("sp-" + k, S[k]);

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle.meta.vintage);
