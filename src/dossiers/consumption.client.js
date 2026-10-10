// Dossier 07 · Consumption — plate definitions and number wiring.
// Data: data/series/hces-mpce.json + hces-states.json + hces-fractiles.json
// + hces-categories.json + hces-gini.json + hces-social.json
// + hces-household-type.json + hces-quantities.json + hces-item-values.json
// + hces-categories-states.json, baked at build time by scripts/fetch.mjs.
// The HCES is cross-sectional: two survey rounds, almost no time axis. The
// plates are therefore dot strips, dumbbells and composition bars — a line is
// drawn only where a real ordering exists (the fractile ladder). The headline
// convention is "without imputation"; the with-imputation variants are shown
// and named where used. The 2011-12 and earlier NSS rounds use a different
// method, are not served, and are never spliced or compared here.

import * as Plot from "@observablehq/plot";
import mpceBundle from "../../data/series/hces-mpce.json";
import statesBundle from "../../data/series/hces-states.json";
import fractilesBundle from "../../data/series/hces-fractiles.json";
import categoriesBundle from "../../data/series/hces-categories.json";
import giniBundle from "../../data/series/hces-gini.json";
import socialBundle from "../../data/series/hces-social.json";
import hhTypeBundle from "../../data/series/hces-household-type.json";
import quantitiesBundle from "../../data/series/hces-quantities.json";
import itemValuesBundle from "../../data/series/hces-item-values.json";
import foodStatesBundle from "../../data/series/hces-categories-states.json";
import inrStatesBundle from "../../data/series/hces-categories-inr-states.json";
import inrAllBundle from "../../data/series/hces-categories-inr.json";
import imputedStatesBundle from "../../data/series/hces-states-imputed.json";
import giniStatesBundle from "../../data/series/hces-gini-states.json";
import { MONO as mono, hydrate, wireTools, a11y } from "../charts/plumbing.js";

const M = hydrate(mpceBundle);
const ST = hydrate(statesBundle);
const F = hydrate(fractilesBundle);
const C = hydrate(categoriesBundle);
const G = hydrate(giniBundle);
const SO = hydrate(socialBundle);
const HT = hydrate(hhTypeBundle);
const Q = hydrate(quantitiesBundle);
const IV = hydrate(itemValuesBundle);
const FS = hydrate(foodStatesBundle);

/* ---------- helpers ---------- */
// two rounds only: index 0 = 2022-23, index 1 = 2023-24
const cur = (s) => s.data[1].value;
const prv = (s) => s.data[0].value;
const fmtRound = (d) => d.getUTCFullYear() + "-" + String((d.getUTCFullYear() + 1) % 100).padStart(2, "0");

// Indian digit grouping: 20310 -> "20,310", 137000 -> "1,37,000"
const grp = (v) => {
  const s = String(Math.round(Math.abs(v)));
  if (s.length <= 3) return s;
  return s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3);
};
const inr = (v) => (v < 0 ? "−₹" : "₹") + grp(v);
const inrBig = (v) => '<span class="pc">₹</span>' + grp(v);
const p1 = (v) => v.toFixed(1) + "%";
const p2 = (v) => v.toFixed(2) + "%";
const kg1 = (v) => v.toFixed(1) + " kg";
const kg2 = (v) => v.toFixed(2) + " kg";
const kgd = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2) + " kg";
const g3 = (v) => v.toFixed(3);
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const arrowPct = (c, p) => { const d = ((c - p) / p) * 100; return (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + "%"; };
const arrowAbs = (c, p, dp) => { const d = c - p; return (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(dp); };
const arrowPt = (c, p) => { const d = c - p; return (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt"; };

/* ---------- titleblock numbers ---------- */
const ratio1 = cur(M.urban) / cur(M.rural);
const ratio0 = prv(M.urban) / prv(M.rural);

setHTML("n-rural", inrBig(cur(M.rural)));
setHTML("n-urban", inrBig(cur(M.urban)));
setHTML("n-ratio", ratio1.toFixed(2) + '<span class="pc">×</span>');
setHTML("n-gini", g3(cur(G.rural)));
setHTML("d-rural", `<b>${arrowPct(cur(M.rural), prv(M.rural))}</b> vs 2022-23`);
setHTML("d-urban", `<b>${arrowPct(cur(M.urban), prv(M.urban))}</b> vs 2022-23`);
setHTML("d-ratio", `<b>${arrowAbs(ratio1, ratio0, 2)}</b> vs 2022-23`);
setHTML("d-gini", `<b>${arrowAbs(cur(G.rural), prv(G.rural), 3)}</b> vs 2022-23`);

/* ---------- § 01 current reading ---------- */
setHTML("rb-big", inrBig(cur(M.rural)));
setHTML("rb-first", inrBig(cur(M.urban)));
// §01 "current reading" prose is pipeline-generated (pipeline/out/prose-consumption.*.md).

/* ---------- § 02 register ----------
 * Two data points per series: a two-point sparkline is a bare diagonal, so
 * the history cell is replaced by the previous round's value. */
const regRows = [
  { nm: "MPCE, rural", sub: "₹ per person per month, without imputation", sw: "s-acc",
    v: inr(cur(M.rural)), d: arrowPct(cur(M.rural), prv(M.rural)), p: inr(prv(M.rural)) },
  { nm: "MPCE, urban", sub: "₹ per person per month, without imputation", sw: "s-g1",
    v: inr(cur(M.urban)), d: arrowPct(cur(M.urban), prv(M.urban)), p: inr(prv(M.urban)) },
  { nm: "Urban ÷ rural", sub: "computed from the two means", sw: "s-g2",
    v: ratio1.toFixed(2) + "×", d: arrowAbs(ratio1, ratio0, 2), p: ratio0.toFixed(2) + "×" },
  { nm: "Gini, rural", sub: "consumption, without imputation", sw: "s-g4",
    v: g3(cur(G.rural)), d: arrowAbs(cur(G.rural), prv(G.rural), 3), p: g3(prv(G.rural)) },
  { nm: "Gini, urban", sub: "consumption, without imputation", sw: "s-g3",
    v: g3(cur(G.urban)), d: arrowAbs(cur(G.urban), prv(G.urban), 3), p: g3(prv(G.urban)) },
  { nm: "Bottom 5%, rural", sub: "average MPCE of the lowest fractile class", sw: "s-g1",
    v: inr(cur(F.f0_5_rural)), d: arrowPct(cur(F.f0_5_rural), prv(F.f0_5_rural)), p: inr(prv(F.f0_5_rural)) },
  { nm: "Top 5%, urban", sub: "average MPCE of the highest fractile: fell between rounds", sw: "s-acc",
    v: inr(cur(F.f95_100_urban)), d: arrowPct(cur(F.f95_100_urban), prv(F.f95_100_urban)), p: inr(prv(F.f95_100_urban)) },
  { nm: "MPCE, Scheduled Tribe, rural", sub: "lowest social-group average in villages", sw: "s-g3",
    v: inr(cur(SO.st_rural)), d: arrowPct(cur(SO.st_rural), prv(SO.st_rural)), p: inr(prv(SO.st_rural)) },
  { nm: "Others ÷ ST, rural", sub: "social-group gap, computed from the two means", sw: "s-g1",
    v: (cur(SO.others_rural) / cur(SO.st_rural)).toFixed(2) + "×",
    d: arrowAbs(cur(SO.others_rural) / cur(SO.st_rural), prv(SO.others_rural) / prv(SO.st_rural), 2),
    p: (prv(SO.others_rural) / prv(SO.st_rural)).toFixed(2) + "×" },
  { nm: "MPCE, casual labour, urban", sub: "lowest household-type average in towns", sw: "s-g2",
    v: inr(cur(HT.casual_labour_urban)), d: arrowPct(cur(HT.casual_labour_urban), prv(HT.casual_labour_urban)), p: inr(prv(HT.casual_labour_urban)) },
  { nm: "Cereals, rural quantity", sub: "kg per person per month, all cereals", sw: "s-g4",
    v: kg2(cur(Q.total_cereals_rural)), d: arrowPct(cur(Q.total_cereals_rural), prv(Q.total_cereals_rural)), p: kg2(prv(Q.total_cereals_rural)) },
  { nm: "Food share, rural", sub: "% of MPCE, all food categories", sw: "s-g2",
    v: p2(cur(C.food_total_rural)), d: arrowPt(cur(C.food_total_rural), prv(C.food_total_rural)), p: p2(prv(C.food_total_rural)) },
  { nm: "Food share, urban", sub: "% of MPCE, all food categories", sw: "s-g4",
    v: p2(cur(C.food_total_urban)), d: arrowPt(cur(C.food_total_urban), prv(C.food_total_urban)), p: p2(prv(C.food_total_urban)) },
];
document.getElementById("ledger-body").innerHTML = regRows.map((r) => `
  <tr>
    <td class="name"><span class="sw ${r.sw}"></span>${r.nm}<small>${r.sub}</small></td>
    <td class="val">${r.v}</td>
    <td class="chg">${r.d}, vs 2022-23</td>
    <td class="yr">${r.p}</td>
  </tr>`).join("");

/* ---------- § 03 the ladder : fractile classes ---------- */
{
  const FRACS = ["f0_5", "f5_10", "f10_20", "f20_30", "f30_40", "f40_50",
    "f50_60", "f60_70", "f70_80", "f80_90", "f90_95", "f95_100"];
  const FRACLAB = ["0–5", "5–10", "10–20", "20–30", "30–40", "40–50",
    "50–60", "60–70", "70–80", "80–90", "90–95", "95–100"];
  const rows = FRACS.map((k, i) => ({
    i,
    rural1: cur(F[k + "_rural"]), rural0: prv(F[k + "_rural"]),
    urban1: cur(F[k + "_urban"]), urban0: prv(F[k + "_urban"]),
  }));
  const topDrop = prv(F.f95_100_urban) - cur(F.f95_100_urban);
  const topDropR = prv(F.f95_100_rural) - cur(F.f95_100_rural);
  const mult = cur(F.f95_100_urban) / cur(F.f0_5_rural);
  setTxt("pv-lad", inr(cur(F.f95_100_urban)));
  setTxt("ex-lad-bot", inr(cur(F.f0_5_rural)));
  setTxt("ex-lad-top", inr(cur(F.f95_100_urban)));
  setTxt("ex-lad-mult", mult.toFixed(1) + "×");
  setTxt("ex-lad-drop", inr(topDrop));
  setTxt("ex-lad-rdrop", inr(topDropR));

  const geo = { W: 1184, H: 520, ml: 90, mr: 215, mt: 44, mb: 48 };
  const yTicks = [0, 5000, 10000, 15000, 20000];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 14, ticks: rows.map((r) => r.i),
         tickFormat: (d) => FRACLAB[d], domain: [-0.4, 11.55] },
    y: { label: "↑ ₹ per person per month", labelAnchor: "top", labelArrow: false,
         ticks: yTicks, domain: [0, 22000], tickSize: 0, tickPadding: 11,
         tickFormat: (d) => (d === 20000 ? "₹20,000" : grp(d)) },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      // previous round, pale — never chained to the current one
      Plot.dot(rows, { x: "i", y: "urban0", fill: "#C9CED6", r: 3 }),
      Plot.dot(rows, { x: "i", y: "rural0", fill: "#C9CED6", r: 3 }),
      Plot.lineY(rows, { x: "i", y: "urban1", stroke: "#5F6675", strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(rows, { x: "i", y: "rural1", stroke: "#2E4BD8", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(rows, { x: "i", y: "urban1", fill: "#5F6675", r: 4, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "i", y: "rural1", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.text([{ i: 11, y: cur(F.f95_100_urban) }], { x: "i", y: "y", text: () => "Urban " + inr(cur(F.f95_100_urban)), dx: 18, fill: "#5F6675", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text([{ i: 11, y: cur(F.f95_100_rural) }], { x: "i", y: "y", text: () => "Rural " + inr(cur(F.f95_100_rural)), dx: 18, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text([{ i: 10.75, y: 21750 }], { x: "i", y: "y", text: () => "top 5% urban fell " + inr(topDrop) + " between rounds", fill: "#878D99", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
    ],
  });
  a11y(plot, "Average MPCE by fractile class, rural and urban, 2023-24, with 2022-23 as pale dots",
    "Two rising dot-and-line ladders across twelve fractile classes. Rural runs from " + inr(cur(F.f0_5_rural)) + " in the bottom five per cent to " + inr(cur(F.f95_100_rural)) + " in the top; urban from " + inr(cur(F.f0_5_urban)) + " to " + inr(cur(F.f95_100_urban)) + ". The top urban class fell " + inr(topDrop) + " against the previous round.");
  document.getElementById("plot-ladder").append(plot);
  const csvList = FRACS.flatMap((k) => [F[k + "_rural"], F[k + "_urban"]]);
  wireTools(document.getElementById("cb-ladder"), plot, csvList, "india-atlas_hces_fractile-ladder", fmtRound);
}

/* ---------- § 04a who spends what : social groups ---------- */
{
  // sorted by the rural mean, largest first (Others tops both sectors;
  // the floor differs — rural ST, urban SC)
  const GROUPS = [
    ["others", "Others"],
    ["obc", "Other Backward Class"],
    ["sc", "Scheduled Caste"],
    ["st", "Scheduled Tribe"],
  ];
  const rows = GROUPS.map(([k, label]) => ({
    label,
    rural1: cur(SO[k + "_rural"]), rural0: prv(SO[k + "_rural"]),
    urban1: cur(SO[k + "_urban"]), urban0: prv(SO[k + "_urban"]),
  }));
  const mult = cur(SO.others_rural) / cur(SO.st_rural);
  setTxt("pv-social", mult.toFixed(2) + "×");
  setTxt("ex-so-st", inr(cur(SO.st_rural)));
  setTxt("ex-so-oth", inr(cur(SO.others_rural)));
  setTxt("ex-so-mult", mult.toFixed(2) + "×");
  setTxt("ex-so-stg", p1(((cur(SO.st_rural) - prv(SO.st_rural)) / prv(SO.st_rural)) * 100));
  setTxt("ex-so-othg", p1(((cur(SO.others_rural) - prv(SO.others_rural)) / prv(SO.others_rural)) * 100));
  setTxt("ex-so-scu", inr(cur(SO.sc_urban)));

  const xTicks = [0, 2000, 4000, 6000, 8000];
  const geo = { W: 1184, H: 300, ml: 235, mr: 110, mt: 44, mb: 48 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "₹ per person per month →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0, 9000], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === 8000 ? "₹8,000" : grp(d)) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([cur(M.rural)], { stroke: "#2E4BD8", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.ruleX([cur(M.urban)], { stroke: "#5F6675", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.text([{ x: cur(M.rural) }], { x: "x", frameAnchor: "top", dy: -26, dx: -6, text: () => "all-India rural " + inr(cur(M.rural)), fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
      Plot.text([{ x: cur(M.urban) }], { x: "x", frameAnchor: "top", dy: -26, dx: 6, text: () => "all-India urban " + inr(cur(M.urban)), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.link(rows, { x1: "rural1", x2: "urban1", y: "label", stroke: "#DADDE3", strokeWidth: 1.5 }),
      // previous round, pale — never chained to the current one
      Plot.dot(rows, { x: "rural0", y: "label", fill: "#C9CED6", r: 3 }),
      Plot.dot(rows, { x: "urban0", y: "label", fill: "#C9CED6", r: 3 }),
      Plot.dot(rows, { x: "urban1", y: "label", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "rural1", y: "label", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      // rural < urban in every group; the rural label drops below its dot so
      // it clears the pale previous-round dot sitting just to the left
      Plot.text(rows, { x: "rural1", y: "label", text: (d) => inr(d.rural1), dy: 17, fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(rows, { x: "urban1", y: "label", text: (d) => inr(d.urban1), dx: 12, textAnchor: "start", fill: "#5F6675", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Average MPCE by social group, rural and urban paired per group, 2023-24",
    "Four group rows sorted by the rural mean. Rural runs from " + inr(cur(SO.st_rural)) + " for Scheduled Tribe households to " + inr(cur(SO.others_rural)) + " for the Others group; urban from " + inr(cur(SO.sc_urban)) + " for Scheduled Caste households to " + inr(cur(SO.others_urban)) + ". Pale dots mark the 2022-23 round; dashed rules the all-India rural and urban means.");
  document.getElementById("plot-social").append(plot);
  const csvList = GROUPS.flatMap(([k]) => [SO[k + "_rural"], SO[k + "_urban"]]);
  wireTools(document.getElementById("cb-social"), plot, csvList, "india-atlas_hces_social-group-mpce", fmtRound);
}

/* ---------- § 04b who spends what : household employment types ---------- */
{
  // rural first (published with the farm/non-farm split), urban after;
  // sorted within each sector, largest first
  const TYPES = [
    ["regular_wage_salaried_in_non_agriculture_rural", "Rural, regular wage, non-farm", "#2E4BD8"],
    ["others_rural", "Rural, others", "#2E4BD8"],
    ["self_employed_in_non_agriculture_rural", "Rural, self-employed, non-farm", "#2E4BD8"],
    ["self_employed_in_agriculture_rural", "Rural, self-employed, farm", "#2E4BD8"],
    ["regular_wage_salaried_in_agriculture_rural", "Rural, regular wage, farm", "#2E4BD8"],
    ["casual_labour_in_non_agriculture_rural", "Rural, casual labour, non-farm", "#2E4BD8"],
    ["casual_labour_in_agriculture_rural", "Rural, casual labour, farm", "#2E4BD8"],
    ["others_urban", "Urban, others", "#5F6675"],
    ["regular_wage_salaried_urban", "Urban, regular wage/salaried", "#5F6675"],
    ["self_employed_urban", "Urban, self-employed", "#5F6675"],
    ["casual_labour_urban", "Urban, casual labour", "#5F6675"],
  ];
  const rows = TYPES.map(([k, label, c]) => ({ label, c, v1: cur(HT[k]), v0: prv(HT[k]) }));
  setTxt("pv-hht", inr(cur(HT.casual_labour_urban)));
  setTxt("ex-ht-casu", inr(cur(HT.casual_labour_urban)));
  setTxt("ex-ht-um", inr(cur(M.urban)));
  setTxt("ex-ht-regnf", inr(cur(HT.regular_wage_salaried_in_non_agriculture_rural)));
  setTxt("ex-ht-ratio", (cur(HT.regular_wage_salaried_urban) / cur(HT.casual_labour_urban)).toFixed(2) + "×");
  setTxt("ex-ht-oth", inr(cur(HT.others_urban)));

  const xTicks = [0, 2000, 4000, 6000, 8000, 10000];
  const geo = { W: 1184, H: 520, ml: 275, mr: 110, mt: 44, mb: 48 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "₹ per person per month →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0, 10000], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === 10000 ? "₹10,000" : grp(d)) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([cur(M.rural)], { stroke: "#2E4BD8", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.ruleX([cur(M.urban)], { stroke: "#5F6675", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.text([{ x: cur(M.rural) }], { x: "x", frameAnchor: "top", dy: -26, dx: -6, text: () => "all-India rural " + inr(cur(M.rural)), fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
      Plot.text([{ x: cur(M.urban) }], { x: "x", frameAnchor: "top", dy: -26, dx: 6, text: () => "all-India urban " + inr(cur(M.urban)), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      // round-on-round movement: pale 2022-23 dot linked to the filled 2023-24 dot
      Plot.link(rows, { x1: "v0", x2: "v1", y: "label", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "v0", y: "label", fill: "#C9CED6", r: 3 }),
      Plot.dot(rows, { x: "v1", y: "label", fill: "c", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      // every type rose between the rounds, so the current label sits right
      Plot.text(rows, { x: "v1", y: "label", text: (d) => inr(d.v1), dx: 12, textAnchor: "start", fill: "c", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Average MPCE by household employment type, rural and urban, 2023-24, with 2022-23 as pale dots",
    "Eleven rows, rural types then urban. Casual labour is the floor of both sectors: " + inr(cur(HT.casual_labour_in_agriculture_rural)) + " for rural farm work and " + inr(cur(HT.casual_labour_urban)) + " in towns. The top urban row is others, pension, rent or remittance households, at " + inr(cur(HT.others_urban)) + ".");
  document.getElementById("plot-hhtype").append(plot);
  const csvList = TYPES.map(([k]) => HT[k]);
  wireTools(document.getElementById("cb-hhtype"), plot, csvList, "india-atlas_hces_household-type-mpce", fmtRound);
}

/* ---------- § 05 Engel's law : baskets + category dumbbells ---------- */
{
  // food vs non-food composition bars, one per sector
  const basket = (barId, labId, sector, segs) => {
    document.getElementById(barId).innerHTML = segs.map(([n, w, c]) =>
      `<div class="seg" style="width:${w}%;background:${c}" title="${sector}, ${n}: ${w.toFixed(2)}%"></div>`).join("");
    document.getElementById(labId).innerHTML = segs.map(([n, w, c]) =>
      `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${sector}, ${n}</div><div class="w">${w.toFixed(2)}%</div></div>`).join("");
  };
  basket("bk-r-bar", "bk-r-labels", "Rural", [
    ["Food", cur(C.food_total_rural), "#2E4BD8"],
    ["Non-food", cur(C.non_food_total_rural), "#C9CED6"],
  ]);
  basket("bk-u-bar", "bk-u-labels", "Urban", [
    ["Food", cur(C.food_total_urban), "#2E4BD8"],
    ["Non-food", cur(C.non_food_total_urban), "#C9CED6"],
  ]);

  setTxt("pv-engel", p2(cur(C.food_total_rural)));
  setTxt("ex-en-fr", p1(cur(C.food_total_rural)));
  setTxt("ex-en-fu", p1(cur(C.food_total_urban)));
  setTxt("ex-en-rent-u", p1(cur(C.rent_urban)));
  setTxt("ex-en-rent-r", p1(cur(C.rent_rural)));
  setTxt("ex-en-edu-u", p1(cur(C.education_urban)));
  setTxt("ex-en-edu-r", p1(cur(C.education_rural)));

  // the thirteen largest detail categories, sorted by the rural share
  const CATS = [
    ["beverages_processed_food_etc", "Beverages & processed food"],
    ["milk_and_milk_products", "Milk & milk products"],
    ["conveyance", "Conveyance"],
    ["durable_goods", "Durable goods"],
    ["fuel_and_light", "Fuel & light"],
    ["vegetables", "Vegetables"],
    ["clothing_bedding", "Clothing & bedding"],
    ["consumer_services_excluding_conveyance", "Consumer services"],
    ["cereal", "Cereals"],
    ["egg_fish_meat", "Egg, fish & meat"],
    ["medical_non_hospitalization", "Medicine (non-hospital)"],
    ["education", "Education"],
    ["rent", "Rent"],
  ];
  const rows = CATS.map(([k, label]) => ({ label, rural: cur(C[k + "_rural"]), urban: cur(C[k + "_urban"]) }));
  const domain = rows.map((r) => r.label);
  const xTicks = [0, 2, 4, 6, 8, 10, 12];
  const geo = { W: 1184, H: 560, ml: 240, mr: 90, mt: 20, mb: 46 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "share of MPCE →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0, 12], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === 12 ? "12%" : String(d)) },
    y: { label: null, domain, tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.link(rows, { x1: "rural", x2: "urban", y: "label", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "urban", y: "label", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "rural", y: "label", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      // value labels sit on the outer side of each pair
      // (dx and textAnchor are constants in Plot, so one mark per side)
      Plot.text(rows.filter((d) => d.rural <= d.urban), { x: "rural", y: "label", text: (d) => d.rural.toFixed(2), dx: -12, textAnchor: "end", fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(rows.filter((d) => d.rural > d.urban), { x: "rural", y: "label", text: (d) => d.rural.toFixed(2), dx: 12, textAnchor: "start", fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(rows.filter((d) => d.urban < d.rural), { x: "urban", y: "label", text: (d) => d.urban.toFixed(2), dx: -12, textAnchor: "end", fill: "#5F6675", fontSize: 12, fontFamily: mono }),
      Plot.text(rows.filter((d) => d.urban >= d.rural), { x: "urban", y: "label", text: (d) => d.urban.toFixed(2), dx: 12, textAnchor: "start", fill: "#5F6675", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Share of MPCE by item category, rural versus urban, 2023-24",
    "Thirteen category rows, each with a rural and an urban dot joined by a line. Beverages and processed food lead the rural rupee at " + cur(C.beverages_processed_food_etc_rural).toFixed(1) + " per cent. The widest urban-rural splits are rent, " + cur(C.rent_urban).toFixed(1) + " per cent urban against " + cur(C.rent_rural).toFixed(1) + " rural, and education, " + cur(C.education_urban).toFixed(1) + " against " + cur(C.education_rural).toFixed(1) + ".");
  document.getElementById("plot-engel").append(plot);
  const csvList = CATS.flatMap(([k]) => [C[k + "_rural"], C[k + "_urban"]]);
  wireTools(document.getElementById("cb-engel"), plot, csvList, "india-atlas_hces_category-shares", fmtRound);
}

/* ---------- § 05 companion : round-on-round composition shift ----------
 * The baskets above show 2023-24 only. This companion plots the CHANGE in
 * each category's budget share between the two rounds — the composition shift
 * Engel's law would predict downward, but food share actually rose. Every
 * detail category is here, including the ~16 previously invisible: fruits,
 * pulses, intoxicants, household services, hospitalisation. */
{
  const CATS = [
    ["beverages_processed_food_etc", "Beverages & proc. food"],
    ["cereal", "Cereals"], ["cereal_substitutes", "Cereal substitutes"],
    ["clothing_bedding", "Clothing & bedding"],
    ["consumer_services_excluding_conveyance", "Consumer services"],
    ["conveyance", "Conveyance"], ["durable_goods", "Durable goods"],
    ["edible_oil", "Edible oil"], ["education", "Education"],
    ["egg_fish_meat", "Egg, fish & meat"], ["entertainment", "Entertainment"],
    ["footwear", "Footwear"], ["fruits_dry", "Fruits (dry)"],
    ["fruits_fresh", "Fruits (fresh)"], ["fuel_and_light", "Fuel & light"],
    ["gram", "Gram"], ["medical_hospitalization", "Medical (hospital)"],
    ["medical_non_hospitalization", "Medical (non-hospital)"],
    ["milk_and_milk_products", "Milk & milk products"],
    ["other_household_consumables", "Other consumables"],
    ["other_taxes_cesses", "Other taxes & cesses"],
    ["pan_tobacco_intoxicants", "Pan, tobacco & intoxicants"],
    ["pulses_and_pulse_products", "Pulses & pulse products"],
    ["rent", "Rent"], ["salt", "Salt"], ["spices", "Spices"],
    ["sugar", "Sugar"], ["toilet_articles", "Toilet articles"],
    ["vegetables", "Vegetables"],
  ];
  const rows = CATS.map(([k, label]) => ({
    label,
    dr: cur(C[k + "_rural"]) - prv(C[k + "_rural"]),
    du: cur(C[k + "_urban"]) - prv(C[k + "_urban"]),
  })).sort((a, b) => b.dr - a.dr);

  setTxt("pv-shift", arrowPt(cur(C.food_total_rural), prv(C.food_total_rural)));
  setTxt("ex-sh-food-r", arrowPt(cur(C.food_total_rural), prv(C.food_total_rural)));
  setTxt("ex-sh-food-u", arrowPt(cur(C.food_total_urban), prv(C.food_total_urban)));
  const oilDrop = rows.find((r) => r.label === "Edible oil");
  setTxt("ex-sh-oil", arrowPt(cur(C.edible_oil_rural), prv(C.edible_oil_rural)));
  setTxt("ex-sh-veg", arrowPt(cur(C.vegetables_rural), prv(C.vegetables_rural)));
  setTxt("ex-sh-fuel-r", arrowPt(cur(C.fuel_and_light_rural), prv(C.fuel_and_light_rural)));
  setTxt("ex-sh-fuel-u", arrowPt(cur(C.fuel_and_light_urban), prv(C.fuel_and_light_urban)));

  const allDr = rows.map((r) => r.dr);
  const xMax = Math.ceil(Math.max(...allDr, ...rows.map((r) => r.du)) * 10) / 10 + 0.1;
  const xMin = Math.floor(Math.min(...allDr, ...rows.map((r) => r.du)) * 10) / 10 - 0.1;
  const span = xMax - xMin;
  const xTicks = [];
  for (let t = Math.ceil(xMin * 2) / 2; t <= xMax; t += 0.5) xTicks.push(Math.round(t * 100) / 100);
  const geo = { W: 1184, H: 30 + rows.length * 23 + 40, ml: 230, mr: 70, mt: 30, mb: 46 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "change in share of MPCE · percentage points →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [xMin, xMax], tickSize: 0, tickPadding: 10,
         tickFormat: (d) => (d === 0 ? "0" : (d > 0 ? "+" : "") + d.toFixed(1)) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.link(rows, { x1: "dr", x2: "du", y: "label", stroke: "#E3E6EB", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "du", y: "label", fill: "#A3A9B4", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot(rows, { x: "dr", y: "label", fill: (d) => (Math.abs(d.dr) >= 0.5 ? "#2E4BD8" : "#5F6675"), r: 4, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      /* Plot ignores function-valued dx/textAnchor — one text mark per side */
      Plot.text(rows.filter((d) => Math.abs(d.dr) >= 0.5 && d.dr > 0), { x: "dr", y: "label", text: (d) => "+" + d.dr.toFixed(2), dx: 12, textAnchor: "start", fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500 }),
      Plot.text(rows.filter((d) => Math.abs(d.dr) >= 0.5 && d.dr < 0), { x: "dr", y: "label", text: (d) => d.dr.toFixed(2), dx: -12, textAnchor: "end", fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500 }),
      Plot.text(rows.filter((d) => Math.abs(d.dr) < 0.5 && d.dr >= 0), { x: "dr", y: "label", text: (d) => (d.dr > 0 ? "+" : "") + d.dr.toFixed(2), dx: 12, textAnchor: "start", fill: "#878D99", fontSize: 11.5, fontFamily: mono }),
      Plot.text(rows.filter((d) => Math.abs(d.dr) < 0.5 && d.dr < 0), { x: "dr", y: "label", text: (d) => d.dr.toFixed(2), dx: -12, textAnchor: "end", fill: "#878D99", fontSize: 11.5, fontFamily: mono }),
    ],
  });
  a11y(plot, "Change in budget share by item category, 2022-23 to 2023-24, rural and urban",
    "Sorted dot strip of " + rows.length + " categories. Rural changes (dark) range from " + rows.at(-1).label + " at " + (rows.at(-1).dr > 0 ? "+" : "") + rows.at(-1).dr.toFixed(2) + " points to " + rows[0].label + " at +" + rows[0].dr.toFixed(2) + ". The food share rose between rounds: against Engel's prediction. Edible oil fell most; vegetables and processed food rose most.");
  document.getElementById("plot-shift").append(plot);
  const csv = ["category,rural_2022_23_pct,rural_2023_24_pct,rural_change_pt,urban_2022_23_pct,urban_2023_24_pct,urban_change_pt",
    ...CATS.map(([k, label]) => `${label.replace(/,/g, "")},${prv(C[k + "_rural"])},${cur(C[k + "_rural"])},${(cur(C[k + "_rural"]) - prv(C[k + "_rural"])).toFixed(3)},${prv(C[k + "_urban"])},${cur(C[k + "_urban"])},${(cur(C[k + "_urban"]) - prv(C[k + "_urban"])).toFixed(3)}`),
  ].join("\n");
  wireTools(document.getElementById("cb-shift"), plot, CATS.flatMap(([k]) => [C[k + "_rural"], C[k + "_urban"]]), "india-atlas_hces_composition-shift", fmtRound);
}

/* ---------- § 06 what the plate holds : cereal quantities ---------- */
{
  // "Other Cereals" (~0.01 kg) is omitted from the plate — invisible at this
  // scale — but ships in the CSV and the bundle; disclosed in the plate sub.
  const CROPS = [
    ["rice", "Rice"],
    ["wheat", "Wheat"],
    ["coarse_grains", "Coarse grains"],
    ["total_cereals", "All cereals"],
  ];
  const rows = CROPS.flatMap(([k, name]) => [
    { label: `${name}, Rural`, c: "#2E4BD8", v1: cur(Q[k + "_rural"]), v0: prv(Q[k + "_rural"]) },
    { label: `${name}, Urban`, c: "#5F6675", v1: cur(Q[k + "_urban"]), v0: prv(Q[k + "_urban"]) },
  ]);
  setTxt("pv-plate", kg2(cur(Q.total_cereals_rural)));
  setTxt("ex-q-rt1", kg1(cur(Q.total_cereals_rural)));
  setTxt("ex-q-rt0", kg1(prv(Q.total_cereals_rural)));
  setTxt("ex-q-ut1", kg1(cur(Q.total_cereals_urban)));
  setTxt("ex-q-vg", p1(((cur(IV.total_cereals_rural) - prv(IV.total_cereals_rural)) / prv(IV.total_cereals_rural)) * 100));
  setTxt("ex-q-vr1", inr(cur(IV.total_cereals_rural)));
  setTxt("ex-q-rice", kg1(cur(Q.rice_rural)));
  setTxt("ex-q-wheat", kg1(cur(Q.wheat_rural)));
  setTxt("ex-q-riced", kgd(cur(Q.rice_rural) - prv(Q.rice_rural)));
  setTxt("ex-q-wheatd", kgd(cur(Q.wheat_rural) - prv(Q.wheat_rural)));

  const xTicks = [0, 2, 4, 6, 8, 10];
  const geo = { W: 1184, H: 440, ml: 235, mr: 110, mt: 24, mb: 48 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "kg per person per month →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0, 10], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === 10 ? "10 kg" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      // round-on-round movement: pale 2022-23 dot linked to the filled 2023-24 dot
      Plot.link(rows, { x1: "v0", x2: "v1", y: "label", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "v0", y: "label", fill: "#C9CED6", r: 3.5 }),
      Plot.dot(rows, { x: "v1", y: "label", fill: "c", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      // value labels sit on the side away from the pale dot
      // (dx and textAnchor are constants in Plot, so one mark per direction)
      Plot.text(rows.filter((d) => d.v1 <= d.v0), { x: "v1", y: "label", text: (d) => kg2(d.v1), dx: -12, textAnchor: "end", fill: "c", fontSize: 12, fontFamily: mono }),
      Plot.text(rows.filter((d) => d.v1 > d.v0), { x: "v1", y: "label", text: (d) => kg2(d.v1), dx: 12, textAnchor: "start", fill: "c", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Average monthly per-capita quantity of cereals by type, rural and urban, both rounds",
    "Eight rows of paired dots, one per cereal and sector. Rural cereal quantity fell from " + kg2(prv(Q.total_cereals_rural)) + " to " + kg2(cur(Q.total_cereals_rural)) + " a head a month between the rounds; urban held near " + kg2(cur(Q.total_cereals_urban)) + ". Rice leads in both sectors; the rural fall is almost all rice.");
  document.getElementById("plot-plate").append(plot);
  const csvList = ["rice", "wheat", "coarse_grains", "other_cereals", "total_cereals"]
    .flatMap((k) => [Q[k + "_rural"], Q[k + "_urban"], IV[k + "_rural"], IV[k + "_urban"]]);
  wireTools(document.getElementById("cb-plate"), plot, csvList, "india-atlas_hces_cereal-quantities", fmtRound);
}

/* ---------- § 06 companion : cereal VALUES (₹) — dearer grain, not more of it ----------
 * The quantities plate above shows kg falling; this one shows ₹ rising. Read the
 * pair together: the cereal story is a price story, not a quantity story. */
{
  const CROPS = [["rice", "Rice"], ["wheat", "Wheat"], ["coarse_grains", "Coarse grains"], ["total_cereals", "All cereals"]];
  const rows = CROPS.flatMap(([k, name]) => [
    { label: `${name}, Rural`, c: "#2E4BD8", v1: cur(IV[k + "_rural"]), v0: prv(IV[k + "_rural"]) },
    { label: `${name}, Urban`, c: "#5F6675", v1: cur(IV[k + "_urban"]), v0: prv(IV[k + "_urban"]) },
  ]);
  const maxV = Math.max(...rows.map((r) => r.v1), ...rows.map((r) => r.v0));
  const xTop = Math.ceil(maxV / 50) * 50;
  const xTicks = [0, xTop / 4, xTop / 2, (3 * xTop) / 4, xTop].map((t) => Math.round(t));
  setTxt("pv-val", inr(cur(IV.total_cereals_rural)));
  setTxt("ex-v-rt1", inr(cur(IV.total_cereals_rural)));
  setTxt("ex-v-rt0", inr(prv(IV.total_cereals_rural)));
  setTxt("ex-v-pct", p1(((cur(IV.total_cereals_rural) - prv(IV.total_cereals_rural)) / prv(IV.total_cereals_rural)) * 100));
  const geo = { W: 1184, H: 440, ml: 235, mr: 110, mt: 24, mb: 48 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "₹ per person per month →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0, xTop], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xTop ? "₹" + d : String(d)) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.link(rows, { x1: "v0", x2: "v1", y: "label", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "v0", y: "label", fill: "#C9CED6", r: 3.5 }),
      Plot.dot(rows, { x: "v1", y: "label", fill: "c", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.text(rows.filter((d) => d.v1 <= d.v0), { x: "v1", y: "label", text: (d) => inr(d.v1), dx: -12, textAnchor: "end", fill: "c", fontSize: 12, fontFamily: mono }),
      Plot.text(rows.filter((d) => d.v1 > d.v0), { x: "v1", y: "label", text: (d) => inr(d.v1), dx: 12, textAnchor: "start", fill: "c", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Average monthly per-capita value of cereals by type, rural and urban, both rounds",
    "Eight rows of paired dots in rupees. Rural cereal value rose from " + inr(prv(IV.total_cereals_rural)) + " to " + inr(cur(IV.total_cereals_rural)) + " a head a month between the rounds: even as the quantity on the plate above fell. That is the price of grain climbing, not the amount eaten.");
  document.getElementById("plot-val").append(plot);
  wireTools(document.getElementById("cb-val"), plot, ["rice", "wheat", "coarse_grains", "other_cereals", "total_cereals"].flatMap((k) => [IV[k + "_rural"], IV[k + "_urban"]]), "india-atlas_hces_cereal-values", fmtRound);
}

/* ---------- § 08a the map : 36 states, paired dots ---------- */
{
  const SHORT = { "Dadra & Nagar Haveli and Daman & Diu": "D&N Haveli, Daman & Diu" };
  const rows = Object.keys(ST)
    .filter((k) => k.endsWith("_rural"))
    .map((k) => {
      const base = k.slice(0, -6);
      const full = ST[k].label.split(" · ")[0];
      return {
        name: SHORT[full] || full,
        rural: cur(ST[k]), urban: cur(ST[base + "_urban"]),
      };
    })
    .sort((a, b) => b.rural - a.rural);

  const hi = rows[0], lo = rows[rows.length - 1];
  const uHi = rows.reduce((a, b) => (b.urban > a.urban ? b : a));
  const uLo = rows.reduce((a, b) => (b.urban < a.urban ? b : a));
  const delhi = rows.find((r) => r.name === "Delhi");
  setTxt("pv-states", (hi.rural / lo.rural).toFixed(2) + "×");
  setTxt("ex-st-hi", inr(hi.rural));
  setTxt("ex-st-lo", inr(lo.rural));
  setTxt("ex-st-mult", (hi.rural / lo.rural).toFixed(1) + "×");
  setTxt("ex-st-del", inr(delhi.rural));
  setTxt("ex-st-urb", inr(cur(M.urban)));
  setTxt("ex-st-uhi", inr(uHi.urban));
  setTxt("ex-st-ulo", inr(uLo.urban));

  const xTicks = [0, 2000, 4000, 6000, 8000, 10000, 12000, 14000];
  const geo = { W: 1184, H: 1064, ml: 235, mr: 110, mt: 44, mb: 48 };
  const ends = [rows[0], rows[rows.length - 1]];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "₹ per person per month →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0, 14500], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === 14000 ? "₹14,000" : grp(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([cur(M.rural)], { stroke: "#2E4BD8", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.ruleX([cur(M.urban)], { stroke: "#5F6675", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.text([{ x: cur(M.rural) }], { x: "x", frameAnchor: "top", dy: -26, dx: -6, text: () => "all-India rural " + inr(cur(M.rural)), fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
      Plot.text([{ x: cur(M.urban) }], { x: "x", frameAnchor: "top", dy: -26, dx: 6, text: () => "all-India urban " + inr(cur(M.urban)), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.link(rows, { x1: "rural", x2: "urban", y: "name", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "urban", y: "name", fill: "#5F6675", r: 4, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "rural", y: "name", fill: "#2E4BD8", r: 4, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      // value labels on the top and bottom rows anchor the scale
      Plot.text(ends, { x: "rural", y: "name", text: (d) => inr(d.rural), dx: -12, textAnchor: "end", fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(ends, { x: "urban", y: "name", text: (d) => inr(d.urban), dx: 12, textAnchor: "start", fill: "#5F6675", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Average MPCE by state and union territory, rural and urban paired per state, 2023-24",
    "Thirty-six rows sorted by rural MPCE. Rural runs from " + inr(hi.rural) + " in " + hi.name + " down to " + inr(lo.rural) + " in " + lo.name + "; urban from " + inr(uHi.urban) + " down to " + inr(uLo.urban) + ". Dashed rules mark the all-India rural and urban means.");
  document.getElementById("plot-states").append(plot);
  const csvList = Object.keys(ST).sort().map((k) => ST[k]);
  wireTools(document.getElementById("cb-states"), plot, csvList, "india-atlas_hces_state-mpce", fmtRound);
}

/* ---------- § 08b Engel across the map : food share by state ---------- */
{
  const SHORT = { "Dadra & Nagar Haveli and Daman & Diu": "D&N Haveli, Daman & Diu" };
  const rows = Object.keys(FS)
    .filter((k) => k.endsWith("_rural"))
    .map((k) => {
      const base = k.slice(0, -6);
      const full = FS[k].label.split(" · ")[0];
      return { name: SHORT[full] || full, rural: cur(FS[k]), urban: cur(FS[base + "_urban"]) };
    })
    .sort((a, b) => b.rural - a.rural);

  const hi = rows[0], lo = rows[rows.length - 1];
  const lk = rows.find((r) => r.name === "Lakshadweep");
  const bihar = rows.find((r) => r.name === "Bihar");
  setTxt("pv-food", p2(hi.rural));
  setTxt("ex-fs-hi", p1(hi.rural));
  setTxt("ex-fs-lo", p1(lo.rural));
  setTxt("ex-fs-bu", p1(bihar.urban));
  setTxt("ex-fs-lk", p1(lk.urban));
  setTxt("ex-fs-lkr", p1(lk.rural));

  const xTicks = [30, 35, 40, 45, 50, 55, 60];
  const geo = { W: 1184, H: 1064, ml: 235, mr: 110, mt: 44, mb: 48 };
  const ends = [rows[0], rows[rows.length - 1]];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "share of MPCE going to food →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [30, 60], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === 60 ? "60%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([cur(C.food_total_rural)], { stroke: "#2E4BD8", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.ruleX([cur(C.food_total_urban)], { stroke: "#5F6675", strokeWidth: 1, strokeDasharray: "2,3", strokeOpacity: 0.8 }),
      Plot.text([{ x: cur(C.food_total_rural) }], { x: "x", frameAnchor: "top", dy: -26, dx: 6, text: () => "all-India rural " + p2(cur(C.food_total_rural)), fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text([{ x: cur(C.food_total_urban) }], { x: "x", frameAnchor: "top", dy: -26, dx: -6, text: () => "all-India urban " + p2(cur(C.food_total_urban)), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
      Plot.link(rows, { x1: "rural", x2: "urban", y: "name", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "urban", y: "name", fill: "#5F6675", r: 4, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "rural", y: "name", fill: "#2E4BD8", r: 4, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      // value labels on the top and bottom rows anchor the scale
      Plot.text(ends, { x: "rural", y: "name", text: (d) => p2(d.rural), dx: 12, textAnchor: "start", fill: "#161A22", fontSize: 12, fontFamily: mono }),
      Plot.text(ends, { x: "urban", y: "name", text: (d) => p2(d.urban), dx: -12, textAnchor: "end", fill: "#5F6675", fontSize: 12, fontFamily: mono }),
    ],
  });
  a11y(plot, "Share of MPCE going to food by state and union territory, rural and urban paired per state, 2023-24",
    "Thirty-six rows sorted by the rural food share, from " + p2(hi.rural) + " in rural " + hi.name + " down to " + p2(lo.rural) + ". The urban dot sits left of the rural in every state except Lakshadweep. Dashed rules mark the all-India rural and urban shares.");
  document.getElementById("plot-food").append(plot);
  // the food share only (keys without "__"; every other category by state sits beside them)
  const csvList = Object.keys(FS).filter((k) => !k.includes("__")).sort().map((k) => FS[k]);
  wireTools(document.getElementById("cb-foodmap"), plot, csvList, "india-atlas_hces_state-food-share", fmtRound);
}

/* ---------- § 08c the Gini : four rows, two rounds ---------- */
{
  const rows = [
    { label: "Rural · headline", v0: prv(G.rural), v1: cur(G.rural), c: "#2E4BD8" },
    { label: "Rural · with imputation", v0: prv(G.rural_imputed), v1: cur(G.rural_imputed), c: "#878D99" },
    { label: "Urban · headline", v0: prv(G.urban), v1: cur(G.urban), c: "#2E4BD8" },
    { label: "Urban · with imputation", v0: prv(G.urban_imputed), v1: cur(G.urban_imputed), c: "#878D99" },
  ];
  setTxt("pv-gini", g3(cur(G.rural)));
  setTxt("ex-gi-r0", g3(prv(G.rural)));
  setTxt("ex-gi-r1", g3(cur(G.rural)));
  setTxt("ex-gi-u0", g3(prv(G.urban)));
  setTxt("ex-gi-u1", g3(cur(G.urban)));
  setTxt("ex-gi-impr", inr(cur(M.rural_imputed) - cur(M.rural)));
  setTxt("ex-gi-impu", inr(cur(M.urban_imputed) - cur(M.urban)));

  const xTicks = [0.22, 0.24, 0.26, 0.28, 0.3, 0.32];
  const geo = { W: 1184, H: 264, ml: 235, mr: 130, mt: 24, mb: 46 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "Gini →", labelAnchor: "right", labelArrow: false,
         ticks: xTicks, domain: [0.22, 0.32], tickSize: 0, tickPadding: 12,
         tickFormat: (d) => d.toFixed(2) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.link(rows, { x1: "v1", x2: "v0", y: "label", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { x: "v0", y: "label", fill: "#C9CED6", r: 4 }),
      Plot.dot(rows, { x: "v1", y: "label", fill: "c", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.text(rows, { x: "v1", y: "label", text: (d) => g3(d.v1), dx: -12, textAnchor: "end", fill: "c", fontSize: 12.5, fontFamily: mono, fontWeight: 500 }),
      Plot.text(rows, { x: "v0", y: "label", text: (d) => g3(d.v0), dx: 12, textAnchor: "start", fill: "#A3A9B4", fontSize: 12.5, fontFamily: mono }),
    ],
  });
  a11y(plot, "Gini coefficient of per-capita consumption by sector and imputation convention, both rounds",
    "Four rows. Each shows a pale 2022-23 dot and a filled 2023-24 dot to its left: rural fell from " + g3(prv(G.rural)) + " to " + g3(cur(G.rural)) + ", urban from " + g3(prv(G.urban)) + " to " + g3(cur(G.urban)) + "; the with-imputation variants sit slightly lower still.");
  document.getElementById("plot-gini").append(plot);
  wireTools(document.getElementById("cb-gini"), plot, [G.rural, G.urban, G.rural_imputed, G.urban_imputed], "india-atlas_hces_gini", fmtRound);
}


/* ---------- § 09 what a person spends, state by state (wave 2) ---------- */
const IS = hydrate(inrStatesBundle), IMS = hydrate(imputedStatesBundle), GS = hydrate(giniStatesBundle);
const SHORT9 = { "Dadra & Nagar Haveli and Daman & Diu": "D&N Haveli, Daman & Diu", "Andaman & Nicobar Islands": "Andaman & Nicobar" };
const stateName = (s) => SHORT9[s] || s;
{
  const COLS = [["MPCE", null], ["Food", "food_total"], ["Fuel, light", "fuel_and_light"], ["Schooling", "education"], ["Medicines, doctor", "medical_non_hospitalization"],
    ["Hospital", "medical_hospitalization"], ["Travel", "conveyance"], ["Rent", "rent"], ["Durables", "durable_goods"]];
  const I = inrStatesBundle.dates.length - 1;
  for (const sec of ["rural", "urban"]) {
    const keys = Object.keys(statesBundle.series).filter((k) => k.endsWith("_" + sec));
    const states = keys.map((k) => ({ k, name: stateName(statesBundle.series[k].label.split(" · ")[0]), mpce: statesBundle.series[k].data[I] })).filter((d) => d.mpce != null).sort((a, b) => b.mpce - a.mpce);
    const cells = [];
    for (const st of states) for (const [col, cat] of COLS) {
      const v = cat ? inrStatesBundle.series[`${st.k}__${cat}`]?.data[I] : st.mpce;
      if (v != null) cells.push({ state: st.name, col, v });
    }
    // shade within each column: 0 = the column's lowest state, 1 = its highest
    const span = Object.fromEntries(COLS.map(([c]) => { const vs = cells.filter((d) => d.col === c).map((d) => d.v); return [c, [Math.min(...vs), Math.max(...vs)]]; }));
    const t = (d) => { const [lo, hi] = span[d.col]; return hi > lo ? (d.v - lo) / (hi - lo) : 0; };
    const plot = Plot.plot({
      width: 1184, height: 46 + states.length * 25, marginLeft: 190, marginRight: 4, marginTop: 40, marginBottom: 6,
      style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
      x: { domain: COLS.map((c) => c[0]), axis: "top", label: null, tickSize: 0, tickPadding: 10, padding: 0.04 },
      y: { domain: states.map((d) => d.name), label: null, tickSize: 0, tickPadding: 10, padding: 0.08 },
      color: { type: "linear", domain: [0, 1], range: ["#F7F8FD", "#9DADEE"] },
      marks: [
        Plot.cell(cells, { x: "col", y: "state", fill: (d) => t(d) }),
        Plot.text(cells, { x: "col", y: "state", text: (d) => "₹" + grp(Math.round(d.v)), fill: "#161A22", fontSize: 11.5, fontWeight: (d) => (d.col === "MPCE" ? 600 : 400), className: "inbar" }),
      ],
    });
    const top = (cat) => { const r = states.map((st) => ({ n: st.name, v: inrStatesBundle.series[`${st.k}__${cat}`]?.data[I] })).filter((d) => d.v != null).sort((a, b) => b.v - a.v); return r; };
    const food = top("food_total"), edu = top("education"), med = top("medical_non_hospitalization");
    const span2 = (r) => `highest ${r[0].n} ${inr(Math.round(r[0].v))}, lowest ${r.at(-1).n} ${inr(Math.round(r.at(-1).v))}`;
    a11y(plot, `What a ${sec} person spends a month, by state and category, 2023-24`, `Highest food bill ${food[0].n} ${inr(Math.round(food[0].v))}; schooling from ${span2(edu)}.`);
    document.getElementById(`plot-spend-${sec}`).append(plot);
    setTxt(`pv-spend-${sec}`, inr(Math.round(food[0].v)));
    setTxt(`ex-sp-${sec}-food`, span2(food));
    setTxt(`ex-sp-${sec}-edu`, span2(edu));
    setTxt(`ex-sp-${sec}-med`, span2(med));
    const ai = (cat) => inr(Math.round(inrAllBundle.series[`all_india_${sec}__${cat}`].data[I]));
    setTxt(`ex-sp-${sec}-ai`, ai("food_total"));
    setTxt(`ex-sp-${sec}-aiedu`, ai("education"));
    setTxt(`ex-sp-${sec}-aimed`, ai("medical_non_hospitalization"));
    const csvList = states.flatMap((st) => COLS.filter(([, c]) => c).map(([, c]) => IS[`${st.k}__${c}`]).filter(Boolean));
    wireTools(document.getElementById(`cb-spend-${sec}`), plot, csvList, `india-atlas_hces_spending-by-state-${sec}`, fmtRound);
  }
}

/* ---------- § 09 with imputation, by state (wave 2) ---------- */
{
  const I = 1;
  const rows = Object.keys(statesBundle.series).filter((k) => k.endsWith("_rural")).map((k) => {
    const a = statesBundle.series[k].data[I], b = imputedStatesBundle.series[k]?.data[I];
    return { name: stateName(statesBundle.series[k].label.split(" · ")[0]), a, b, add: b - a, pct: ((b - a) / a) * 100 };
  }).filter((d) => d.a != null && d.b != null).sort((x, y) => y.pct - x.pct);
  const aiPct = ((cur(M.rural_imputed) - cur(M.rural)) / cur(M.rural)) * 100;
  const plot = Plot.plot({
    width: 1184, height: 40 + rows.length * 24 + 44, marginLeft: 210, marginRight: 120, marginTop: 30, marginBottom: 44,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "added by counting free items, per cent →", labelAnchor: "right", labelArrow: false, domain: [0, 8], ticks: [0, 2, 4, 6, 8], tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 8 ? "8%" : String(d)) },
    y: { label: null, domain: rows.map((d) => d.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX([2, 4, 6, 8], { stroke: "#F0F2F5" }),
      Plot.barX(rows, { y: "name", x: "pct", fill: (d) => (d.pct > aiPct ? "#2E4BD8" : "#C9CED6"), insetTop: 6, insetBottom: 6 }),
      Plot.text(rows, { y: "name", x: "pct", dx: 8, text: (d) => `${d.pct.toFixed(1)}%  ${inr(d.add)}`, textAnchor: "start", fill: "#161A22", fontSize: 11.5 }),
      Plot.ruleX([0], { stroke: "#B5BAC4" }),
    ],
  });
  a11y(plot, "Rural spending with and without free items, by state, 2023-24", rows.slice(0, 4).map((d) => `${d.name} +${d.pct.toFixed(1)}%`).join(", "));
  document.getElementById("plot-impute").append(plot);
  setTxt("pv-impute", inr(cur(M.rural_imputed) - cur(M.rural)));
  setTxt("ex-imp-hi", `${rows[0].name}, ${inr(rows[0].add)} (${rows[0].pct.toFixed(1)}%)`);
  setTxt("ex-imp-ai", `${inr(cur(M.rural_imputed) - cur(M.rural))} (${aiPct.toFixed(1)}%)`);
  setTxt("ex-imp-aiu", inr(cur(M.urban_imputed) - cur(M.urban)));
  const zero = Object.keys(statesBundle.series).filter((k) => imputedStatesBundle.series[k]?.data[I] === statesBundle.series[k].data[I]).map((k) => k.replace(/_(rural|urban)$/, ""));
  setTxt("ex-imp-zero", String(new Set(zero.filter((z) => zero.filter((x) => x === z).length === 2)).size));
  wireTools(document.getElementById("cb-impute"), plot, Object.keys(IMS).sort().map((k) => IMS[k]), "india-atlas_hces_mpce-with-imputation-by-state", fmtRound);
}

/* ---------- § 09 Gini by state (wave 2) ---------- */
{
  const I = 1;
  const rows = Object.keys(giniStatesBundle.series).filter((k) => k.endsWith("_rural")).map((k) => ({
    name: stateName(giniStatesBundle.series[k].label.split(" · ")[0]), r: giniStatesBundle.series[k].data[I], u: giniStatesBundle.series[k.replace(/_rural$/, "_urban")]?.data[I],
  })).filter((d) => d.r != null && d.u != null).sort((a, b) => b.u - a.u);
  const more = rows.filter((d) => d.u > d.r).length;
  const plot = Plot.plot({
    width: 1184, height: 40 + rows.length * 24 + 44, marginLeft: 210, marginRight: 80, marginTop: 30, marginBottom: 44,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "Gini →", labelAnchor: "right", labelArrow: false, domain: [0.14, 0.34], ticks: [0.15, 0.2, 0.25, 0.3], tickSize: 0, tickPadding: 10, tickFormat: (d) => d.toFixed(2) },
    y: { label: null, domain: rows.map((d) => d.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX([0.15, 0.2, 0.25, 0.3], { stroke: "#F0F2F5" }),
      Plot.link(rows, { y: "name", x1: "r", x2: "u", stroke: "#DADDE3", strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "name", x: "u", r: 4, fill: "#5F6675", stroke: "#fff", strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "name", x: "r", r: 4, fill: "#2E4BD8", stroke: "#fff", strokeWidth: 1.25 }),
      // the higher of the pair carries its value to its right, never across the connector
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.r, d.u), dx: 10, text: (d) => `${g3(d.u)} / ${g3(d.r)}`, textAnchor: "start", fill: "#4A5160", fontSize: 11 }),
    ],
  });
  a11y(plot, "Gini of consumption spending by state, rural and urban, 2023-24", `Urban more unequal than rural in ${more} of ${rows.length} states. Highest urban ${rows[0].name} ${g3(rows[0].u)}.`);
  document.getElementById("plot-ginist").append(plot);
  const all = rows.flatMap((d) => [{ n: `${d.name}, urban`, v: d.u }, { n: `${d.name}, rural`, v: d.r }]).sort((a, b) => b.v - a.v);
  setTxt("pv-ginist", `${more} of ${rows.length}`);
  setTxt("ex-gs-hi", `${all[0].n}, ${g3(all[0].v)}`);
  setTxt("ex-gs-lo", `${all.at(-1).n}, ${g3(all.at(-1).v)}`);
  setTxt("ex-gs-air", g3(cur(G.rural)));
  setTxt("ex-gs-aiu", g3(cur(G.urban)));
  wireTools(document.getElementById("cb-ginist"), plot, Object.keys(GS).sort().map((k) => GS[k]), "india-atlas_hces_gini-by-state", fmtRound);
}

/* ---------- § 09 misread ---------- */
setTxt("mr-rural", inr(cur(M.rural)));
setTxt("mr-fam", inr(cur(M.rural) * 5));
setTxt("mr-ratio", p1((ratio1 - 1) * 100));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", mpceBundle.meta.vintage);
setTxt("prov-vintage2", mpceBundle.meta.vintage);
