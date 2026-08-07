// Dossier 05 · External account — plate definitions and number wiring.
// Data: data/series/rbi-*.json, baked at build time by scripts/fetch.mjs.
// RBI values arrive in US$ millions; the page speaks in US$ billions.

import * as Plot from "@observablehq/plot";
import tradeBundle from "../../data/series/rbi-trade.json";
import forexBundle from "../../data/series/rbi-forex.json";
import bopBundle from "../../data/series/rbi-bop.json";
import ratiosBundle from "../../data/series/rbi-bop-ratios.json";
import debtBundle from "../../data/series/rbi-debt.json";
import nriBundle from "../../data/series/rbi-nri.json";
import invisiblesBundle from "../../data/series/rbi-invisibles.json";
import ratesBundle from "../../data/series/rbi-exchange-rates.json";
import interventionBundle from "../../data/series/rbi-intervention.json";
import premiaBundle from "../../data/series/rbi-forward-premia.json";
import debtQBundle from "../../data/series/rbi-debt-quarterly.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, troughOf, dodgeEndLabels, spark,
} from "../charts/plumbing.js";

const T = hydrate(tradeBundle);
const F = hydrate(forexBundle);
const B = hydrate(bopBundle);
const R = hydrate(ratiosBundle);
const D = hydrate(debtBundle);
const N = hydrate(nriBundle);
const INV = hydrate(invisiblesBundle);
const X4 = hydrate(ratesBundle);
const IV = hydrate(interventionBundle);
const P = hydrate(premiaBundle);
const DQ = hydrate(debtQBundle);
// US$ millions -> US$ billions (reserves scaled; exchange rates stay ₹,
// forward premia stay % p.a., quarterly debt stays ₹ crore)
for (const store of [T, B, D, N, INV, IV]) {
  for (const k in store) store[k] = { ...store[k], data: store[k].data.map((d) => ({ ...d, value: d.value == null ? null : d.value / 1000 })) };
}
F.reserves = { ...F.reserves, data: F.reserves.data.map((d) => ({ ...d, value: d.value == null ? null : d.value / 1000 })) };
const bn = (v) => "$" + (Math.abs(v) >= 100 ? Math.round(v) : v.toFixed(1)) + " bn";
const bn2 = (v) => (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(1) + " bn";
const rs = (v) => "₹" + v.toFixed(2);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
// annual FY series sit at April of the first year; label them "1990–91"
const fmtFY = (d) => {
  const y = d.getUTCFullYear();
  return y + "–" + String((y + 1) % 100).padStart(2, "0");
};
const lastOf = (s) => s.data.filter((d) => d.value != null).at(-1);
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const arrow = (d, u) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + u;

/* ---------- numbers ---------- */
const Lr = F.reserves.data.at(-1).value, Yr = F.reserves.data.at(-13).value;
const Lb = T.balance.data.at(-1).value, Pb = T.balance.data.at(-2).value;
const Lx = F.usdinr.data.at(-1).value, Yx = F.usdinr.data.at(-13).value;
const cad = R.cad_gdp.data.at(-1).value, cadPrev = R.cad_gdp.data.at(-2).value;
const cover = R.import_cover.data.at(-1).value;

setHTML("n-res", "$" + Lr.toFixed(0) + '<span class="pc">bn</span>');
setHTML("d-res", `<b>${arrow(Lr - Yr, " bn")}</b> vs a year ago`);
setHTML("n-bal", (Lb < 0 ? "−" : "") + Math.abs(Lb).toFixed(1));
setHTML("d-bal", `<b>${arrow(Lb - Pb, " bn")}</b> vs ${fmtDate(T.balance.data.at(-2).date)}`);
setHTML("n-fx", rs(Lx));
setHTML("d-fx", `<b>${(Yx <= Lx ? "▲ +" : "▼ −") + Math.abs(Lx - Yx).toFixed(2)}</b> vs a year ago · weaker ₹`);
setHTML("n-cad", cad.toFixed(1) + '<span class="pc">%</span>');
setHTML("d-cad", `FY25 · FY24 was ${cadPrev.toFixed(1)}%`);

setHTML("rb-big", "$" + Lr.toFixed(0) + '<span class="pc">bn</span>');
setHTML("rb-prev", "$" + Yr.toFixed(0) + '<span class="pc">bn</span>');
setTxt("rb-cover", Math.round(cover));
setTxt("cr-cad", cad.toFixed(1) + "%");
setTxt("cr-res", bn(Lr));
setTxt("cr-nri", bn(N.outstanding_total.data.at(-1).value));
setTxt("cr-bal", bn2(Lb));
setTxt("cr-exp", bn(T.exports.data.at(-1).value));
setTxt("cr-imp", bn(T.imports.data.at(-1).value));
setTxt("cr-fx", rs(Lx));

setTxt("pv-bop", bn2(B.current_account.data.at(-1).value));
setTxt("pv-main", bn2(Lb));
setTxt("pv-res", bn(Lr));
setTxt("pv-fx", rs(Lx));
setTxt("ex-bal", bn2(Lb));
setTxt("ex-balpk", bn2(troughOf(T.balance).value));
setTxt("ex-res", bn(Lr));
setTxt("ex-fx", rs(Lx));
const pkRes = peakOf(F.reserves);
setTxt("pf-res", `peak — ${bn(pkRes.value)}, ${fmtDate(pkRes.date)} · latest — ${bn(Lr)}`);

/* invisibles — latest FY, plus the FY25 goods deficit from the trade table */
const remL = INV.private_transfers.data.at(-1).value;
setTxt("pv-inv", bn(remL));
setTxt("ex-rem", bn(remL));
setTxt("ex-svc", bn(INV.services.data.at(-1).value));
setTxt("ex-inc", bn(Math.abs(INV.income.data.at(-1).value)));
setTxt("ex-inv", bn(INV.invisibles.data.at(-1).value));
const fy25 = T.balance.data.filter((d) => d.date >= new Date(Date.UTC(2024, 3, 1)) && d.date < new Date(Date.UTC(2025, 3, 1)));
setTxt("ex-gd", bn(Math.abs(fy25.reduce((a, d) => a + d.value, 0))));

/* four currencies — latest month */
const fx4 = (k) => lastOf(X4[k]).value;
setTxt("pv-fx4", rs(fx4("usd")));
setTxt("ex4-usd", rs(fx4("usd")));
setTxt("ex4-gbp", rs(fx4("gbp")));
setTxt("ex4-eur", rs(fx4("euro")));
setTxt("ex4-jpy", rs(fx4("jpy")));

/* intervention — latest month and the forward-book trough */
const netL = lastOf(IV.net).value;
const fwdL = lastOf(IV.forward_outstanding).value;
const fwdTr = troughOf({ data: IV.forward_outstanding.data.filter((d) => d.value != null) });
setTxt("pv-int", bn2(netL));
setTxt("ex-int", bn(Math.abs(netL)));
setTxt("ex-fwd", bn2(fwdL));
setTxt("ex-fwdtr", bn2(fwdTr.value));

/* ---------- register ---------- */
const regRows = [
  ["Exports, goods", "RBI-TX", "s-g1", T.exports, bn, false],
  ["Imports, goods", "RBI-TM", "s-g2", T.imports, bn, false],
  ["Trade balance", "RBI-TB", "s-acc", T.balance, bn2, false, "computed"],
  ["Forex reserves", "RBI-FX", "s-acc", F.reserves, bn, false],
  ["USD / INR, monthly avg", "RBI-USD", "s-g3", F.usdinr, rs, false],
  ["CAD, % of GDP (annual)", "RBI-CAD", "s-g4", R.cad_gdp, (v) => v.toFixed(2) + "%", false],
  ["Gross external debt", "RBI-ED", "s-g1", D.gross_external_debt, bn, false],
  ["NRI deposits outstanding", "RBI-NRI", "s-g2", N.outstanding_total, bn, false],
  ["Remittances, net", "RBI-REM", "s-acc", INV.private_transfers, bn, false, "annual, fiscal years"],
  ["RBI net US$ purchase(+)/sale(−)", "RBI-INT", "s-g3", IV.net, bn2, false, "blank months = no operations"],
  ["Forward premia, 3-month", "RBI-FWP", "s-g4", P.m3, (v) => v.toFixed(2) + "% p.a.", false, "inter-bank, monthly avg"],
  ["External debt, quarterly", "RBI-EDQ", "s-g2", DQ.gross, (v) => "₹" + (v / 1e5).toFixed(1) + " lakh cr", false, "₹ crore in source"],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([nm, code, sw, s, fmt, derived, note], i) => {
  const data = s.data.filter((d) => d.value != null);
  // nearest observation to 365 days back — works across monthly, quarterly and annual cadences
  const target = data.at(-1).date.getTime() - 365.25 * 86400000;
  let yi = 0, best = Infinity;
  data.forEach((d, j) => { const diff = Math.abs(d.date.getTime() - target); if (diff < best) { best = diff; yi = j; } });
  const yrAgo = data[yi];
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>Source: RBI via eSankhyiki${note ? " · " + note : ""}</small></td>
    <td class="val">${fmt(data.at(-1).value)}</td>
    <td class="chg">${fmt(data.at(-2).value)}</td>
    <td class="yr">${fmt(yrAgo.value)}</td>
    <td class="spark" id="sp-${i}"></td>
  </tr>`;
}).join("");
regRows.forEach(([nm, code, sw, s], i) => spark("sp-" + i, { ...s, data: s.data.filter((d) => d.value != null) }));

/* ---------- shared multi-line plate ---------- */
function multiLine(blockId, plotId, keys, store, geo, yTicks, xTicks, dlName, fmtV, a11yTitle, a11yDesc, fmtX = (d) => String(d.getUTCFullYear()), fmtCross = fmtDate) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const live = seriesList.filter((s) => s.data.at(-1).value != null);
  const dodged = dodgeEndLabels(live, (geo.d1 - geo.d0) * 0.055);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#1B1A17", strokeOpacity: 0.55, strokeWidth: 1 }),
    ...seriesList.map((s, i) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: i === 0 ? 3 : 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    ...live.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${fmtV(p.value)}`,
      dx: 16, fill: p.s.color, fontSize: 14, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: fmtX },
    y: { label: null, ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11, tickFormat: (d) => String(d) },
    marks,
  });
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, seriesList, dlName);
  addCrosshair(document.getElementById(plotId), plot, seriesList, geo, fmtCross, fmtV);
  return plot;
}

/* ---------- BoP identity ---------- */
{
  const since = (s) => ({ ...s, data: s.data.filter((d) => d.date >= new Date(Date.UTC(2016, 0, 1))) });
  const BB = { current_account: since(B.current_account), capital_account: since(B.capital_account), overall: since(B.overall) };
  const keys = ["current_account", "capital_account", "overall"];
  const geo = { W: 1184, H: 500, ml: 80, mr: 210, mt: 36, mb: 48, d0: -45, d1: 70 };
  const xTicks = []; for (let y = 2016; y <= 2026; y += 2) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = multiLine("cb-bop", "plot-bop", keys, BB, geo, [-40, -20, 0, 20, 40, 60], xTicks,
    "india-atlas_bop_quarterly", (v) => (v < 0 ? "−" : "+") + "$" + Math.abs(v).toFixed(1) + "bn",
    "Balance of payments, net quarterly transactions, 2016 to 2025",
    "Line chart in US$ billions. The current account is mostly negative, the capital account mostly positive; the overall balance is their sum and flows to reserves. Q4 of FY25 shows a rare current account surplus of 13.4 billion.");
  wireLegend(document.getElementById("legend-bop"), plot, keys, BB);
}

/* ---------- trade pipeline (2016 onward) ---------- */
{
  const since = (s) => ({ ...s, data: s.data.filter((d) => d.date >= new Date(Date.UTC(2016, 0, 1))) });
  const TT = { exports: since(T.exports), imports: since(T.imports), balance: since(T.balance) };
  const keys = ["exports", "imports", "balance"];
  const geo = { W: 1184, H: 520, ml: 80, mr: 190, mt: 36, mb: 48, d0: -40, d1: 70 };
  const xTicks = []; for (let y = 2016; y <= 2026; y += 2) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = multiLine("cb-main", "plot-main", keys, TT, geo, [-40, -20, 0, 20, 40, 60], xTicks,
    "india-atlas_trade_pipeline", (v) => (v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(1) + "bn",
    "Merchandise exports, imports and trade balance, monthly, 2016 to 2025",
    "Line chart in US$ billions per month. Imports end at " + TT.imports.data.at(-1).value.toFixed(1) + ", exports at " + TT.exports.data.at(-1).value.toFixed(1) + ", the balance at minus " + Math.abs(TT.balance.data.at(-1).value).toFixed(1) + ".");
  wireLegend(document.getElementById("legend-main"), plot, keys, TT);
}

/* ---------- single-series plates ---------- */
function singleLine(blockId, plotId, s, geo, yTicks, xTicks, dlName, fmtV, a11yTitle, a11yDesc, note) {
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const pk = peakOf(s);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: null, ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.areaY(s.data, { x: "date", y: "value", fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([pk], { x: "date", y: "value", text: () => fmtV(pk.value) + " · " + fmtDate(pk.date), dy: -12, fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", text: (d) => fmtV(d.value), dx: 16, fill: "#BE3E26", fontSize: 14, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, a11yTitle, a11yDesc + (note ? " " + note : ""));
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, [s], dlName);
  addCrosshair(document.getElementById(plotId), plot, [s], geo, fmtDate, fmtV);
}
{
  const xTicks = []; for (let y = 1990; y <= 2025; y += 5) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  singleLine("cb-res", "plot-res", { ...F.reserves, color: "#BE3E26" },
    { W: 1184, H: 470, ml: 80, mr: 150, mt: 40, mb: 48, d0: 0, d1: 750 },
    [0, 200, 400, 600], xTicks,
    "india-atlas_forex-reserves_1990-2025", (v) => "$" + v.toFixed(0) + "bn",
    "Total foreign exchange reserves, 1990 to 2025",
    "Area line in US$ billions, rising from near zero in 1991 to a peak of " + bn(peakOf(F.reserves).value) + " in September 2024, ending at " + bn(Lr) + ".");
}
{
  const xTicks = []; for (let y = 1990; y <= 2025; y += 5) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  singleLine("cb-fx", "plot-fx", { ...F.usdinr, color: "#BE3E26" },
    { W: 1184, H: 470, ml: 80, mr: 150, mt: 40, mb: 48, d0: 10, d1: 90 },
    [20, 40, 60, 80], xTicks,
    "india-atlas_usdinr_1990-2025", (v) => "₹" + v.toFixed(2),
    "Rupees per US dollar, monthly average, 1990 to 2025",
    "Line chart rising from about 17 rupees in 1990 to " + rs(Lx) + " in June 2025.",
    "A higher value is a weaker rupee.");
}

/* ---------- invisibles decomposition (annual FY, 1990-91 onward) ---------- */
{
  const since = (s) => ({ ...s, data: s.data.filter((d) => d.date >= new Date(Date.UTC(1990, 0, 1))) });
  const II = {
    private_transfers: { ...since(INV.private_transfers), label: "Remittances" },
    services: { ...since(INV.services), label: "Services" },
    income: { ...since(INV.income), label: "Income" },
    invisibles: { ...since(INV.invisibles), label: "Total invisibles" },
  };
  const keys = ["private_transfers", "services", "income", "invisibles"];
  const geo = { W: 1184, H: 520, ml: 80, mr: 235, mt: 36, mb: 48, d0: -60, d1: 280 };
  const xTicks = []; for (let y = 1990; y <= 2020; y += 5) xTicks.push(new Date(Date.UTC(y, 3, 1)));
  const plot = multiLine("cb-inv", "plot-inv", keys, II, geo, [-50, 0, 50, 100, 150, 200, 250], xTicks,
    "india-atlas_invisibles_1990-2025",
    (v) => (v == null ? "not published" : (v < 0 ? "−" : "") + "$" + Math.abs(v).toFixed(1) + "bn"),
    "Net invisibles by category, fiscal years 1990-91 to 2024-25",
    "Four line charts in US$ billions per fiscal year. Remittances end at " + II.private_transfers.data.at(-1).value.toFixed(1) + ", services at " + II.services.data.at(-1).value.toFixed(1) + ", income at minus " + Math.abs(II.income.data.at(-1).value).toFixed(1) + ", total invisibles at " + II.invisibles.data.at(-1).value.toFixed(1) + ". Income is negative throughout.",
    fmtFY, fmtFY);
  wireLegend(document.getElementById("legend-inv"), plot, keys, II);
}

/* ---------- four prices of the rupee (monthly, 1966 onward) ---------- */
{
  const FX = {
    usd: { ...X4.usd, label: "Dollar" },
    gbp: { ...X4.gbp, label: "Pound" },
    euro: { ...X4.euro, label: "Euro" },
    jpy: { ...X4.jpy, label: "Yen · per ¥1" },
  };
  const keys = ["usd", "gbp", "euro", "jpy"];
  const geo = { W: 1184, H: 520, ml: 80, mr: 195, mt: 36, mb: 48, d0: 0, d1: 125 };
  const xTicks = []; for (let y = 1970; y <= 2020; y += 10) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = multiLine("cb-fx4", "plot-fx4", keys, FX, geo, [0, 30, 60, 90, 120], xTicks,
    "india-atlas_rupee_four-currencies_1966-2025",
    (v) => (v == null ? "—" : "₹" + v.toFixed(2)),
    "Rupees per dollar, pound, euro and yen, monthly average, 1966 to 2025",
    "Four line charts. The pound ends at " + rs(lastOf(X4.gbp).value) + ", the euro at " + rs(lastOf(X4.euro).value) + ", the dollar at " + rs(lastOf(X4.usd).value) + ", the yen — quoted per single yen — near " + rs(lastOf(X4.jpy).value) + " along the floor. The euro line begins in January 1999; a source gap at May 2024 breaks all four lines.");
  wireLegend(document.getElementById("legend-fx4"), plot, keys, FX);
}

/* ---------- RBI intervention (monthly, 1995 onward) ---------- */
{
  const IVV = {
    net: { ...IV.net, label: "Net $ bought" },
    forward_outstanding: { ...IV.forward_outstanding, label: "Forward book" },
  };
  const keys = ["net", "forward_outstanding"];
  const geo = { W: 1184, H: 520, ml: 80, mr: 215, mt: 36, mb: 48, d0: -100, d1: 85 };
  const xTicks = []; for (let y = 1995; y <= 2025; y += 5) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = multiLine("cb-int", "plot-int", keys, IVV, geo, [-80, -40, 0, 40, 80], xTicks,
    "india-atlas_rbi-intervention_1995-2025",
    (v) => (v == null ? "no reported operations" : (v < 0 ? "−" : "+") + "$" + Math.abs(v).toFixed(1) + "bn"),
    "RBI net US dollar purchases and outstanding forward book, monthly, 1995 to 2025",
    "Two line charts in US$ billions around a zero rule. The monthly net line oscillates between plus 18.6 and minus 20.2; the forward book, a stock, swings wider, bottoming at minus " + Math.abs(troughOf({ data: IV.forward_outstanding.data.filter((d) => d.value != null) }).value).toFixed(1) + " in February 2025 and ending at minus " + Math.abs(lastOf(IV.forward_outstanding).value).toFixed(1) + ". Blank months are months with no reported operations; the lines break there.");
  wireLegend(document.getElementById("legend-int"), plot, keys, IVV);
}

/* ---------- sparkline ---------- */
spark("nspark-res", { ...F.reserves, color: "#BE3E26" });

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", forexBundle.meta.vintage);
setTxt("prov-vintage2", forexBundle.meta.vintage);
