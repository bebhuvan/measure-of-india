// Dossier 01 · CPI — plate definitions and number wiring.
// Data: data/series/cpi.json, baked at build time by scripts/fetch.mjs.
// Plumbing (downloads, a11y, crosshair, legend, dodge, spark): src/charts/plumbing.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/cpi.json";
import ruralBundle from "../../data/series/cpi-rural.json";
import urbanBundle from "../../data/series/cpi-urban.json";
import subBundle from "../../data/series/cpi-subgroups.json";
import statesBundle from "../../data/series/cpi-states.json";
import statesSectorsBundle from "../../data/series/cpi-states-sectors.json";
import alrl2019Bundle from "../../data/series/cpialrl-2019.json";
import alrl1986Bundle from "../../data/series/cpialrl-1986.json";
import alrlGroupsBundle from "../../data/series/cpialrl-groups-2019.json";
import bundle2024 from "../../data/series/cpi-2024.json";
import back2024Bundle from "../../data/series/cpi-2024-back.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, peakBetween, dodgeEndLabels, spark, downloadCSV,
} from "../charts/plumbing.js";

const S = hydrate(bundle);
const R = hydrate(ruralBundle);
const U = hydrate(urbanBundle);
const SUB = hydrate(subBundle);
const ST = hydrate(statesBundle);
const SS = hydrate(statesSectorsBundle);
const AL19 = hydrate(alrl2019Bundle);
const AL86 = hydrate(alrl1986Bundle);
const ALG = hydrate(alrlGroupsBundle);
const S24 = hydrate(bundle2024);       // base 2024=100 — separate store, never merged with S
const B24 = hydrate(back2024Bundle);   // the NSO's own back-cast of the 2024-base General index

// §08 store — combined against its two sector halves
const RU = {
  combined: { ...S.headline, label: "Combined", color: "#BE3E26" },
  rural: { ...R.headline, label: "Rural", color: "#5B564B" },
  urban: { ...U.headline, label: "Urban", color: "#A8A293" },
};
// §02/§10 ledger copies of the Labour Bureau series
const ALP = { ...AL19.al_published_yoy, label: "AL", color: "#BE3E26" };
const RLP = { ...AL19.rl_published_yoy, label: "RL", color: "#5B564B" };
const dates = S.headline.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();

/* ---------- drive every displayed number from the data ---------- */
const L = {}; for (const k in S) L[k] = S[k].data.at(-1).value;
const P = {}; for (const k in S) P[k] = S[k].data.at(-2).value;
const Y = {}; for (const k in S) Y[k] = S[k].data.at(-13).value;
const pc = '<span class="pc">%</span>';
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
const word = (d) => (d >= 0 ? "firming" : "easing");
const bandNote = (v) => (v < 2 ? "below the RBI band" : v > 6 ? "above the RBI band" : "within RBI band");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);

/* 2024-base numbers for the titleblock and §01 — the latest prints live on
 * the new base; the 2012-base story stays below, always labelled */
const L24 = {}; for (const k in S24) L24[k] = S24[k].data.at(-1).value;
const P24 = {}; for (const k in S24) P24[k] = S24[k].data.at(-2).value;
const FIRST24 = S24.headline.data[0].value;

setHTML("n-head", L24.headline.toFixed(2) + pc);
setHTML("n-food", L24.food_and_beverages.toFixed(2) + pc);
setHTML("n-old", L.headline.toFixed(2) + pc);
setHTML("n-core", L.core.toFixed(2) + pc);
setHTML("d-head", `<b>${arrow(L24.headline - P24.headline)}</b> vs May · ${bandNote(L24.headline)}`);
setHTML("d-food", `<b>${arrow(L24.food_and_beverages - P24.food_and_beverages)}</b> vs May · ${word(L24.food_and_beverages - P24.food_and_beverages)}`);
setHTML("d-old", `base retired · series ends Dec 2025`);
setHTML("d-core", `<b>${arrow(L.core - P.core)}</b> vs Nov · to Dec 2025`);

setHTML("rb-big", L24.headline.toFixed(2) + pc);
setHTML("rb-band", `Position in RBI band — <b>${
  L24.headline < 2 ? (2 - L24.headline).toFixed(2) + " pt below the floor"
  : L24.headline < 4 ? (4 - L24.headline).toFixed(2) + " pt below target"
  : L24.headline <= 6 ? (L24.headline - 4).toFixed(2) + " pt above target"
  : (L24.headline - 6).toFixed(2) + " pt above the ceiling"
}</b>`);
{
  const W = 236, H = 46, min = 0, max = 8, val = L24.headline;
  const X = (v) => ((v - min) / (max - min)) * W, y = 18;
  document.getElementById("rb-scale").innerHTML =
    `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale from 0 to 8 per cent. The RBI tolerance band from 2 to 6 per cent is shaded; the 4 per cent target is dashed; the current reading, ${val.toFixed(2)} per cent, is marked.">` +
    `<rect x="${X(2)}" y="${y - 7}" width="${X(6) - X(2)}" height="14" fill="#F4F0E5" stroke="#E5DFCE" stroke-width="1"/>` +
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#DCD7C6" stroke-width="1"/>` +
    `<line x1="${X(4)}" y1="${y - 10}" x2="${X(4)}" y2="${y + 10}" stroke="#8A857A" stroke-width="1" stroke-dasharray="2,3"/>` +
    [0, 2, 4, 6, 8].map((t) => `<text x="${X(t)}" y="${H - 6}" font-family="'IBM Plex Mono',monospace" font-size="9.5" fill="#8A857A" text-anchor="middle">${t}%</text>`).join("") +
    `<circle cx="${X(val)}" cy="${y}" r="4.5" fill="#BE3E26" stroke="#FFFFFF" stroke-width="1.5"/>` +
    `</svg>`;
}
const f1 = (v) => v.toFixed(2) + "%";
setTxt("cr-h1", f1(L24.headline)); setTxt("cr-jan", f1(FIRST24));
setTxt("cr-f1", f1(L24.food_and_beverages)); setTxt("cr-tr", f1(L24.transport));
setTxt("cr-old", f1(L.headline)); setTxt("cr-c1", f1(L.core));

setTxt("pv-main", f1(L.headline));
setTxt("pv-food", f1(L.food)); setTxt("pv-fuel", f1(L.fuel)); setTxt("pv-core", f1(L.core));
setTxt("ex-food", f1(L.food)); setTxt("ex-food-y", f1(Y.food));
setTxt("ex-fuel", f1(L.fuel)); setTxt("ex-core", f1(L.core));
setTxt("ex-hjan", f1(S.headline.data.at(-12).value)); setTxt("ex-hdec", f1(L.headline));
const pkFood = peakOf(S.food), pkFuel = peakOf(S.fuel), pkCore = peakOf(S.core);
setTxt("pf-food", `peak — ${pkFood.value.toFixed(1)}%, ${fmtDate(pkFood.date)} · latest — ${f1(L.food)}`);
setTxt("pf-fuel", `peak — ${pkFuel.value.toFixed(1)}%, ${fmtDate(pkFuel.date)} · latest — ${f1(L.fuel)}`);
setTxt("pf-core", `peak — ${pkCore.value.toFixed(1)}%, ${fmtDate(pkCore.date)} · latest — ${f1(L.core)}`);

/* ---------- §02 the new base: 2012 → 2024, never spliced ----------
 * Same construction as the AL/RL two-base plate: each base keeps its own
 * series, padded onto one merged month axis so the CSV stays aligned and the
 * lines break at the seam instead of joining across it. The dashed line is
 * the NSO's own back-cast of the new index — their linking series, not ours. */
{
  const oldS = { ...S.headline, name: "headline_cpi_base2012_yoy_pct", label: "Base 2012", color: "#8A857A" };
  const newS = { ...S24.headline, name: "headline_cpi_base2024_yoy_pct", label: "Base 2024", color: "#BE3E26" };
  const backS = { ...B24.headline, name: "headline_cpi_base2024_nso_backcast_yoy_pct", label: "NSO back-cast", color: "#C6C0B0",
    data: B24.headline.data.filter((d) => d.date >= S.headline.data[0].date) };
  const axis = [...oldS.data.map((d) => d.date), ...newS.data.map((d) => d.date)];
  const padTo = (s) => {
    const m = new Map(s.data.map((d) => [d.date.getTime(), d.value]));
    return { ...s, data: axis.map((t) => ({ date: t, value: m.get(t.getTime()) ?? null })) };
  };
  const oldPad = padTo(oldS), newPad = padTo(newS), backPad = padTo(backS);
  const geo = { W: 1184, H: 520, ml: 70, mr: 195, mt: 36, mb: 48, d0: -1, d1: 10 };
  const yTicks = [0, 2, 4, 6, 8, 10];
  const xTicks = []; for (let y = 2016; y <= 2026; y += 2) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const seam = newS.data[0].date;
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: axis[0], x2: axis.at(-1), fill: "#F8F6F1" }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.ruleY([4], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.lineY(backPad.data, { x: "date", y: "value", stroke: backS.color, strokeWidth: 1.5, strokeDasharray: "4 3", strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(oldPad.data, { x: "date", y: "value", stroke: oldS.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(newPad.data, { x: "date", y: "value", stroke: newS.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.ruleX([seam], { stroke: "#C9C3B2", strokeWidth: 1 }),
      Plot.text([{ date: seam, value: 9.55 }], { x: "date", y: "value", text: ["base revised · 2012 → 2024 · series meet, never join"], fontSize: 12.5, fill: "#5C574C", fontFamily: mono, textAnchor: "end", dx: -8 }),
      Plot.dot([oldS.data.at(-1)], { x: "date", y: "value", fill: oldS.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([oldS.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 2012 ${d.value.toFixed(2)}%`, dx: 16, dy: 16, fill: oldS.color, fontSize: 13.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([newS.data.at(-1)], { x: "date", y: "value", fill: newS.color, r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([newS.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 2024 ${d.value.toFixed(2)}%`, dx: 16, dy: -8, fill: newS.color, fontSize: 14.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Headline CPI, year-on-year, on the retired 2012 base and the new 2024 base, with the NSO's back-cast",
    "Two line charts side by side on one time axis, never spliced. The 2012 base runs January 2016 to December 2025 and retires at " + L.headline.toFixed(1) + " per cent. The 2024 base begins January 2026 and ends at " + L24.headline.toFixed(1) + " per cent in June 2026. A dashed line shows the NSO's own back-cast of the new index over 2016 to 2024, tracking the old series closely. Shaded band marks the RBI tolerance range of 2 to 6 per cent; dashed rule the 4 per cent target.");
  document.getElementById("plot-nb").append(plot);
  wireTools(document.getElementById("cb-nb"), plot, [newPad, oldPad, backPad], "india-atlas_cpi_two-bases_2016-2026");
  // no crosshair: three different spans on one axis — a shared index would lie
  wireLegend(document.getElementById("legend-nb"), plot, ["nb_old", "nb_back", "nb_new"],
    { nb_old: { color: "#8A857A" }, nb_back: { color: "#C6C0B0" }, nb_new: { color: "#BE3E26" } });
  setTxt("pv-nb", f1(L24.headline));
  setTxt("nb-jan", f1(FIRST24)); setTxt("nb-new", f1(L24.headline));
  setTxt("nb-old-final", f1(L.headline));
  // widest gap between the back-cast and the retired series over their overlap
  const oldByT = new Map(oldS.data.map((d) => [d.date.getTime(), d.value]));
  let shadow = 0;
  for (const d of backS.data) {
    const o = oldByT.get(d.date.getTime());
    if (d.value != null && o != null) shadow = Math.max(shadow, Math.abs(d.value - o));
  }
  setTxt("nb-shadow", shadow.toFixed(1) + " pt");
}

/* ---------- register ----------
 * Rows are series objects, not keys, so the ledger can mix stores: the
 * combined index, its sector halves, three sub-groups and the two Labour
 * Bureau series. Weight is null where a share of the combined basket would
 * be a lie (sector indices weigh 100 of their own basket; AL/RL is another
 * index entirely). Year-ago is null where the series is younger than
 * thirteen months — shown as a dash, never invented. */
const regRows = [
  [S24.headline, "Headline CPI · base 2024", "All items — published all-groups index; the API serves no weights for this base yet", "s-acc", null, null],
  [S24.food_and_beverages, "Food & beverages · base 2024", "Division 01 of the redrawn COICOP-2018-style basket", "s-g1", null, null],
  [S.headline, "Headline CPI (combined) · base 2012", "Base retired · to Dec 2025 — computed from group indices", "s-acc", 100.0, "#BE3E26"],
  [S.food, "Food & beverages · base 2012", "Base retired · to Dec 2025 · nearly half the basket", "s-g1", 45.86, "#5B564B"],
  [S.fuel, "Fuel & light · base 2012", "Base retired · to Dec 2025 · LPG, kerosene, electricity", "s-g2", 6.84, "#A8A293"],
  [S.core, "Core · base 2012", "Base retired · to Dec 2025 · ex food, ex fuel — derived", "s-g3", 47.30, "#C6C0B0"],
  [RU.rural, "Headline · rural", "Sector index — food weighs 54.18 here; no housing group", "s-g1", null, null],
  [RU.urban, "Headline · urban", "Sector index — housing weighs 21.67; food only 36.29", "s-g2", null, null],
  [SUB.vegetables, "Vegetables", "Sub-group · the headline's wild card", "s-g1", 6.04, "#5B564B"],
  [SUB.cereals_and_products, "Cereals & products", "Sub-group · the staple floor", "s-g1", 9.67, "#5B564B"],
  [SUB.transport_and_communication, "Transport & communication", "Sub-group · fares, fuel at the pump, phone bills", "s-g2", 8.59, "#A8A293"],
  [ALP, "CPI-AL", "Agricultural labourers · Labour Bureau · base 2019 · to May 2026", "s-acc", null, null],
  [RLP, "CPI-RL", "Rural labourers · Labour Bureau · base 2019 · to May 2026", "s-g4", null, null],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, wt, col], i) => {
  const data = s.data.filter((d) => d.value != null);
  const l = data.at(-1).value, p = data.at(-2).value;
  const yv = s.data.length >= 13 ? s.data.at(-13).value : null;
  const wtCell = wt == null ? "—"
    : wt.toFixed(1) + `<span class="wtrack"><i style="width:${wt}%;background:${col}"></i></span>`;
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">${wtCell}</td>
    <td class="val">${f1(l)}</td>
    <td class="chg">${arrow(l - p)} · ${word(l - p)}</td>
    <td class="yr">${yv == null ? "—" : f1(yv)}</td>
    <td class="spark" id="sp-l${i}"></td>
  </tr>`;
}).join("");

/* ---------- basket composition ---------- */
const groups = [
  ["Food & beverages", 45.86, "#BE3E26"],
  ["Pan, tobacco & intoxicants", 2.38, "#4A463F"],
  ["Clothing & footwear", 6.53, "#8A857A"],
  ["Housing", 10.07, "#A8A293"],
  ["Fuel & light", 6.84, "#C6C0B0"],
  ["Miscellaneous · services", 28.32, "#DDD6C4"],
];
document.getElementById("basket-bar").innerHTML = groups.map(([n, w, c]) =>
  `<div class="seg" style="width:${w}%;background:${c}" title="${n} — ${w}%"></div>`).join("");
document.getElementById("basket-labels").innerHTML = groups.map(([n, w, c]) =>
  `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${w.toFixed(2)}%</div></div>`).join("");

/* ---------- plate 1 : headline + components ---------- */
{
  const keys = ["headline", "food", "fuel", "core"];
  const seriesList = keys.map((k) => S[k]);
  const geo = { W: 1184, H: 560, ml: 70, mr: 150, mt: 36, mb: 48, d0: -6, d1: 15 };
  const endGap = (geo.d1 - geo.d0) * 0.038;
  const dodged = dodgeEndLabels(seriesList, endGap);
  const pk19 = peakBetween(S.headline, 2019, 2019);   // onion shock, Dec 2019
  const pk22 = peakBetween(S.headline, 2021, 2022);   // Apr 2022
  const pk23 = peakBetween(S.headline, 2023, 2023);   // Jul 2023 vegetables
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-4, -2, 0, 2, 4, 6, 8, 10, 12, 14];
  const t0 = dates[0].getTime(), t1 = dates.at(-1).getTime();
  const sx = (px) => px / ((geo.W - geo.ml - geo.mr) / (t1 - t0));
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const dxDate = (d, px) => new Date(d.getTime() + sx(px));
  const ly19 = pk19.value + sy(30), ly22 = pk22.value + sy(32), ly23 = pk23.value + sy(14);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F8F6F1" }),
    Plot.ruleY([-6], { stroke: "#E0DACA", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
    Plot.ruleY([4], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }),
    Plot.text([{ date: dates[2], value: 4.42 }], { x: "date", y: "value", text: ["RBI target · 4%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    Plot.text([{ date: dates[2], value: 6.6 }], { x: "date", y: "value", text: ["Tolerance band · 2–6%"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
    Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 14.2 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    ...["food", "fuel"].map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(S.core.data, { x: "date", y: "value", stroke: S.core.color, strokeWidth: 1.75, strokeDasharray: "4 3", strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.headline.data, { x: "date", y: "value", stroke: S.headline.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.headline.data.slice(-13), { x: "date", y: "value", stroke: S.headline.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    Plot.dot([pk19, pk22, pk23], { x: "date", y: "value", fill: S.headline.color, r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line([{ x: pk19.date, y: pk19.value + sy(7) }, { x: pk19.date, y: ly19 - sy(9) }], { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: pk19.date, value: ly19 }], { x: "date", y: "value", text: () => pk19.value.toFixed(1) + "% · " + fmtDate(pk19.date) + " · onion shock", fill: S.headline.color, fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
    Plot.line([
      { x: pk22.date, y: pk22.value + sy(7) },
      { x: pk22.date, y: ly22 - sy(8) },
      { x: dxDate(pk22.date, 18), y: ly22 - sy(8) },
    ], { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: dxDate(pk22.date, 24), value: ly22 - sy(4) }], { x: "date", y: "value", text: () => pk22.value.toFixed(1) + "% · " + fmtDate(pk22.date), fill: S.headline.color, fontSize: 13, fontFamily: mono, textAnchor: "start" }),
    Plot.line([
      { x: pk23.date, y: pk23.value + sy(7) },
      { x: pk23.date, y: ly23 },
      { x: dxDate(pk23.date, 18), y: ly23 },
    ], { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: dxDate(pk23.date, 24), value: ly23 + sy(4) }], { x: "date", y: "value", text: () => fmtDate(pk23.date) + " · vegetables", fill: S.headline.color, fontSize: 13, fontFamily: mono, textAnchor: "start" }),
    ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === S.headline ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
      dx: 16, fill: p.s.color, fontSize: 14.5, fontFamily: mono,
      fontWeight: p.s === S.headline ? 500 : 400, textAnchor: "start",
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
  a11y(plot, "Headline CPI and components, year-on-year, January 2016 to December 2025",
    "Line chart. Headline ends at " + L.headline.toFixed(1) + " per cent, food at " + L.food.toFixed(1) + ", fuel at " + L.fuel.toFixed(1) + ", core at " + L.core.toFixed(1) + ". Shaded band marks the RBI tolerance range of 2 to 6 per cent; dashed line the 4 per cent target. Peaks of December 2019, April 2022 and July 2023 annotated.");
  document.getElementById("plot-main").append(plot);
  wireTools(document.getElementById("cb-main"), plot, seriesList, "india-atlas_cpi_headline-components_2016-2025");
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
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F8F6F1" }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.areaY(s.data, { x: "date", y: "value", fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-13), { x: "date", y: "value", stroke: s.color, strokeWidth: 4, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line([{ x: pk.date, y: pk.value + dir * sy(7) }, { x: pk.date, y: pk.value + dir * sy(19) }], { x: "x", y: "y", stroke: "#BE3E26", strokeWidth: 1 }),
      Plot.text([{ date: pk.date, value: pk.value + dir * sy(27) }], { x: "date", y: "value", text: () => pk.value.toFixed(1) + "% · " + fmtDate(pk.date), fill: "#BE3E26", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: "#BE3E26", r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([s.data.at(-1)], { x: "date", y: "value", text: (d) => d.value.toFixed(2) + "%", dx: 16, fill: "#BE3E26", fontSize: 14, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, s.label + " inflation, year-on-year, 2016 to 2025",
    "Line chart ending at " + s.data.at(-1).value.toFixed(1) + " per cent, peaking at " + pk.value.toFixed(1) + " per cent in " + fmtDate(pk.date) + ". " + (extraNote || ""));
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, [s], "india-atlas_cpi_" + key + "_2016-2025");
  addCrosshair(document.getElementById(plotId), plot, [s], geo, fmtDate);
}
componentChart("cb-food", "plot-food", "food", -5, 15, [-4, 0, 4, 8, 12], "Shaded band marks the RBI tolerance range. Food was in deflation for much of late 2025.");
componentChart("cb-fuel", "plot-fuel", "fuel", -7, 15, [-6, 0, 4, 8, 12], "Shaded band marks the RBI tolerance range. Fuel was in deflation from September 2023 to February 2025.");
componentChart("cb-core", "plot-core", "core", 2, 8, [3, 4, 5, 6, 7], "Core excludes food and fuel; derived, not published directly.");

/* ---------- shared multi-line plate renderer (jobs pattern) ---------- */
function multiLine(blockId, plotId, keys, store, geo, yTicks, xTicks, fmtX, dlName, a11yTitle, a11yDesc, opts = {}) {
  const { band = false, fmtCross = fmtDate, recentN = 13 } = opts;
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.06);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    band ? Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dts[0], x2: dts.at(-1), fill: "#F8F6F1" }) : null,
    Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(store[keys[0]].data.slice(-recentN), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
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
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, a11yTitle, a11yDesc);
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, seriesList, dlName, fmtCross);
  addCrosshair(document.getElementById(plotId), plot, seriesList, geo, fmtCross);
  return plot;
}
const fmtMY = (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2);

/* ---------- §07 the sub-indices, a field guide ----------
 * Two grids by volatility class, each with a shared, disclosed scale.
 * One shared axis across all 21 would iron the quiet panels flat: vegetables
 * span 88 points, prepared meals six. The 2–6% band is drawn in every panel
 * at that panel's scale — its apparent width is the volatility disclosure. */
{
  const SM_WILD = { d: [-30, 62], keys: [
    "cereals_and_products", "meat_and_fish", "egg", "oils_and_fats", "fruits", "vegetables",
    "pulses_and_products", "sugar_and_confectionery", "spices", "consumer_food_price", "personal_care_and_effects",
  ] };
  const SM_QUIET = { d: [-4, 16], keys: [
    "milk_and_products", "prepared_meals_snacks_sweets_etc", "non_alcoholic_beverages", "clothing", "footwear",
    "household_goods_and_services", "health", "transport_and_communication", "recreation_and_amusement", "education",
  ] };
  const TITLES = {
    cereals_and_products: "Cereals & products", meat_and_fish: "Meat & fish", egg: "Egg",
    milk_and_products: "Milk & products", oils_and_fats: "Oils & fats", fruits: "Fruits",
    vegetables: "Vegetables", pulses_and_products: "Pulses & products", sugar_and_confectionery: "Sugar & confectionery",
    spices: "Spices", prepared_meals_snacks_sweets_etc: "Prepared meals & snacks", non_alcoholic_beverages: "Non-alcoholic beverages",
    clothing: "Clothing", footwear: "Footwear", household_goods_and_services: "Household goods & services",
    health: "Health", transport_and_communication: "Transport & communication", recreation_and_amusement: "Recreation & amusement",
    education: "Education", personal_care_and_effects: "Personal care & effects · incl. gold",
    consumer_food_price: "Consumer food price · aggregate",
  };
  const outOfBand = (v) => v < 2 || v > 6;
  function smPanel(gridEl, key, domain) {
    const s = SUB[key];
    const v = s.data.at(-1).value;
    const acc = outOfBand(v);
    const el = document.createElement("div");
    el.className = "sm-panel";
    el.innerHTML = `<div class="sm-t">${TITLES[key]}</div><div class="sm-v${acc ? " acc" : ""}">${v.toFixed(1)}%</div>`;
    const p = Plot.plot({
      width: 262, height: 92,
      marginLeft: 4, marginRight: 4, marginTop: 6, marginBottom: 4,
      style: { background: "transparent", overflow: "visible" },
      x: { axis: null },
      y: { axis: null, domain },
      marks: [
        Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F4F0E5" }),
        Plot.ruleY([0], { stroke: "#C9C3B2", strokeWidth: 1 }),
        Plot.lineY(s.data, { x: "date", y: "value", stroke: "#5B564B", strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: acc ? "#BE3E26" : "#5B564B", r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    p.setAttribute("aria-hidden", "true");
    el.append(p);
    gridEl.append(el);
  }
  SM_WILD.keys.forEach((k) => smPanel(document.getElementById("sm-wild"), k, SM_WILD.d));
  SM_QUIET.keys.forEach((k) => smPanel(document.getElementById("sm-quiet"), k, SM_QUIET.d));
  // white filler cells so the 4-column grid ends clean, not on a dark gap
  [["sm-wild", 1], ["sm-quiet", 2]].forEach(([id, n]) => {
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "sm-panel";
      el.setAttribute("aria-hidden", "true");
      document.getElementById(id).append(el);
    }
  });

  const latest = [...SM_WILD.keys, ...SM_QUIET.keys].map((k) => SUB[k].data.at(-1).value);
  const lo = latest.filter((v) => v < 2).length, hi = latest.filter((v) => v > 6).length;
  setTxt("pv-sub", String(lo + hi));
  setTxt("sub-n", String(lo + hi)); setTxt("sub-lo", String(lo)); setTxt("sub-hi", String(hi));
  setTxt("sub-veg", f1(SUB.vegetables.data.at(-1).value));
  setTxt("sub-pulses", f1(SUB.pulses_and_products.data.at(-1).value));
  setTxt("sub-gold", f1(SUB.personal_care_and_effects.data.at(-1).value));
  setTxt("sub-oils", f1(SUB.oils_and_fats.data.at(-1).value));
  // downloads: CSV only — the plate is a DOM grid of 21 plots, not one SVG
  const subList = [...SM_WILD.keys, ...SM_QUIET.keys].map((k) => SUB[k]);
  document.querySelector("#cb-sub [data-dl='csv']").addEventListener("click", () =>
    downloadCSV(subList, "india-atlas_cpi_subgroups_2016-2025", fmtDate));
  const grids = document.querySelector("#cb-sub .frame");
  grids.setAttribute("role", "img");
  grids.setAttribute("aria-label",
    "Small-multiple grid of all 21 CPI sub-indices, 2016 to 2025, split into a wild half (scale minus 30 to plus 62 per cent) and a quiet half (minus 4 to plus 16). " +
    (lo + hi) + " of 21 ended 2025 outside the 2 to 6 per cent band. Each panel's title and latest reading are given as text.");
}

/* ---------- §08 rural vs urban ---------- */
{
  const keys = ["combined", "rural", "urban"];
  const geo = { W: 1184, H: 520, ml: 70, mr: 175, mt: 36, mb: 48, d0: -1, d1: 9 };
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = multiLine("cb-ru", "plot-ru", keys, RU, geo, [0, 2, 4, 6, 8], xTicks,
    (d) => String(d.getUTCFullYear()),
    "india-atlas_cpi_rural-urban_2016-2025",
    "Headline CPI inflation, rural and urban against combined, 2016 to 2025",
    "Three line charts on one axis. Combined ends at " + L.headline.toFixed(1) + " per cent, rural at " + RU.rural.data.at(-1).value.toFixed(1) + ", urban at " + RU.urban.data.at(-1).value.toFixed(1) + ". The rural line swings wider because food weighs 54 per cent of its basket against 36 urban. Shaded band marks the RBI tolerance range.",
    { band: true });
  wireLegend(document.getElementById("legend-ru"), plot, keys, RU);
  const rl = RU.rural.data.at(-1).value, ul = RU.urban.data.at(-1).value;
  setTxt("pv-ru", f1(rl));
  setTxt("ex-ru-r", f1(rl)); setTxt("ex-ru-u", f1(ul));
  setTxt("ex-ru-gap", Math.abs(ul - rl).toFixed(1) + " points");
  setTxt("ex-ru-ry", f1(RU.rural.data.at(-13).value)); setTxt("ex-ru-uy", f1(RU.urban.data.at(-13).value));
  setTxt("ex-ru-rf", f1(R.food.data.at(-1).value)); setTxt("ex-ru-uf", f1(U.food.data.at(-1).value));
  setTxt("ex-ru-rc", f1(R.core.data.at(-1).value)); setTxt("ex-ru-uc", f1(U.core.data.at(-1).value));
}

/* ---------- §09 states: sorted dot strip ---------- */
const stateName = (k) => ({
  jammu_kashmir: "Jammu & Kashmir",
  dadra_nagar_haveli: "Dadra & Nagar Haveli",
  daman_diu: "Daman & Diu",
  andaman_nicobar_islands: "Andaman & Nicobar Is.",
}[k] || k.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "));
{
  const rows = Object.entries(ST)
    .map(([k, s]) => ({ k, name: stateName(k), v: s.data.at(-1).value }))
    .sort((a, b) => b.v - a.v);
  const out = (v) => v < 2 || v > 6;
  const ai = L.headline;
  const geo = { W: 1184, H: 990, ml: 215, mr: 105, mt: 34, mb: 46 };
  const xt = [-4, -2, 0, 2, 4, 6, 8, 10];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13px", color: "#5C574C", overflow: "visible" },
    x: { label: null, domain: [-5.2, 10.6], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rect([{ x1: 2, x2: 6 }], { x1: "x1", x2: "x2", fill: "#F8F6F1" }),
      Plot.ruleX([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.ruleX([ai], { stroke: "#1B1A17", strokeWidth: 1, strokeDasharray: "3,3" }),
      Plot.text([{ x: ai }], { x: "x", text: () => "All-India · " + f1(ai), frameAnchor: "top", dy: -18, dx: 4, fill: "#1B1A17", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot(rows, { x: "v", y: "name", r: 4.5, fill: (d) => (out(d.v) ? "#BE3E26" : "#8A857A"), stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.text(rows, { x: "v", y: "name", text: (d) => d.v.toFixed(2) + "%", dx: 13, dy: 0.5, fill: (d) => (out(d.v) ? "#BE3E26" : "#8A857A"), fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  const top = rows[0], bot = rows.at(-1);
  a11y(plot, "State inflation, December 2025, all 35 published state and UT General indices, sorted",
    "Dot strip. " + top.name + " is highest at " + top.v.toFixed(1) + " per cent, " + bot.name + " lowest at " + bot.v.toFixed(1) + ". The all-India rate of " + ai.toFixed(1) + " is marked with a dashed rule; the 2 to 6 per cent band is shaded; dots outside it are vermilion.");
  document.getElementById("plot-states").append(plot);
  wireTools(document.getElementById("cb-states"), plot, Object.values(ST), "india-atlas_cpi_states_2016-2025");
  setTxt("pv-states", (top.v - bot.v).toFixed(1) + " pt");
  setTxt("st-top", top.name + ", " + f1(top.v));
  setTxt("st-bot", bot.name + ", " + f1(bot.v));
  setTxt("st-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("st-ai", f1(ai)); setTxt("pf-st-ai", f1(ai));
  setTxt("st-neg", String(rows.filter((r) => r.v < 0).length));
  setTxt("st-below", String(rows.filter((r) => r.v < 2).length));
  setTxt("st-above", String(rows.filter((r) => r.v > 6).length));
}

/* ---------- §09 companion: widest rural–urban gaps ---------- */
{
  const stems = [...new Set(Object.keys(SS).map((k) => k.replace(/_(rural|urban)$/, "")))];
  const rows = stems.map((st) => {
    const r = SS[st + "_rural"], u = SS[st + "_urban"];
    if (!r || !u) return null;
    const rv = r.data.at(-1).value, uv = u.data.at(-1).value;
    return rv == null || uv == null ? null : { k: st, name: stateName(st), r: rv, u: uv, gap: Math.abs(rv - uv) };
  }).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 5);
  const geo = { W: 1184, H: 264, ml: 215, mr: 105, mt: 26, mb: 46 };
  const xt = [-6, -4, -2, 0, 2, 4, 6, 8, 10];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13px", color: "#5C574C", overflow: "visible" },
    x: { label: null, domain: [-6.5, 11], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.rect([{ x1: 2, x2: 6 }], { x1: "x1", x2: "x2", fill: "#F8F6F1" }),
      Plot.ruleX([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.link(rows, { x1: "r", x2: "u", y: "name", stroke: "#C6C0B0", strokeWidth: 2 }),
      Plot.dot(rows, { x: "r", y: "name", r: 5, fill: "#5B564B", stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "u", y: "name", r: 5, fill: "#A8A293", stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.text(rows, { x: "r", y: "name", text: (d) => d.r.toFixed(2) + "%", dx: (d) => (d.r < d.u ? -12 : 12), dy: 0.5, fill: "#5B564B", fontSize: 11.5, fontFamily: mono, textAnchor: (d) => (d.r < d.u ? "end" : "start") }),
      Plot.text(rows, { x: "u", y: "name", text: (d) => d.u.toFixed(2) + "%", dx: (d) => (d.r < d.u ? 12 : -12), dy: 0.5, fill: "#8A857A", fontSize: 11.5, fontFamily: mono, textAnchor: (d) => (d.r < d.u ? "start" : "end") }),
    ],
  });
  a11y(plot, "Rural against urban inflation, December 2025, in the five states where they differ most",
    "Dumbbell strip. " + rows.map((d) => d.name + ": rural " + d.r.toFixed(1) + " per cent, urban " + d.u.toFixed(1)).join("; ") + ". The gap runs in both directions.");
  document.getElementById("plot-stgap").append(plot);
  wireTools(document.getElementById("cb-stgap"), plot,
    rows.flatMap((d) => [SS[d.k + "_rural"], SS[d.k + "_urban"]]),
    "india-atlas_cpi_state-sector-gaps_2016-2025");
  wireLegend(document.getElementById("legend-stgap"), plot, ["rural", "urban"],
    { rural: { color: "#5B564B" }, urban: { color: "#A8A293" } });
  setTxt("pv-stgap", rows[0].gap.toFixed(1) + " pt");
  const townDear = rows.find((d) => d.u > d.r), villageDear = rows.find((d) => d.r > d.u);
  setTxt("pf-stgap",
    (townDear ? "in " + townDear.name + " the town is dearer by " + (townDear.u - townDear.r).toFixed(1) + " pt" : "") +
    (townDear && villageDear ? "; " : "") +
    (villageDear ? "in " + villageDear.name + " the village by " + (villageDear.r - villageDear.u).toFixed(1) + " pt" : ""));
}

/* ---------- §10 CPI-AL: two bases, never spliced ---------- */
{
  // pad both series onto one merged month axis so the CSV stays aligned and
  // the lines break at the seam instead of joining across it
  const oldS = { ...AL86.al, label: "Base 1986-87", color: "#8A857A" };
  const newS = { ...AL19.al_published_yoy, label: "Base 2019", color: "#BE3E26" };
  const oldPad = { ...oldS, data: [...oldS.data, ...newS.data.map((d) => ({ date: d.date, value: null }))] };
  const newPad = { ...newS, data: [...oldS.data.map((d) => ({ date: d.date, value: null })), ...newS.data] };
  const geo = { W: 1184, H: 520, ml: 70, mr: 195, mt: 36, mb: 48, d0: -4, d1: 19 };
  const yTicks = [-4, 0, 4, 8, 12, 16];
  const xTicks = []; for (let y = 2000; y <= 2025; y += 5) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const pk = peakOf(oldS);
  const seam = newS.data[0].date;
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "13.5px", color: "#5C574C", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
      Plot.lineY(oldPad.data, { x: "date", y: "value", stroke: oldS.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(newPad.data, { x: "date", y: "value", stroke: newS.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#8A857A", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: pk.date, value: pk.value + 1.3 }], { x: "date", y: "value", text: () => pk.value.toFixed(1) + "% · " + fmtDate(pk.date) + " · after the failed monsoon", fill: "#8A857A", fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
      Plot.ruleX([seam], { stroke: "#C9C3B2", strokeWidth: 1 }),
      Plot.text([{ date: seam, value: 18.4 }], { x: "date", y: "value", text: ["base revised · 1986-87 → 2019"], fontSize: 12.5, fill: "#5C574C", fontFamily: mono, textAnchor: "end", dx: -8 }),
      Plot.dot([oldS.data.at(-1)], { x: "date", y: "value", fill: oldS.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([oldS.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 1986-87 ${d.value.toFixed(2)}%`, dx: 16, dy: 16, fill: oldS.color, fontSize: 13.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot([newS.data.at(-1)], { x: "date", y: "value", fill: newS.color, r: 5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([newS.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 2019 ${d.value.toFixed(2)}%`, dx: 16, dy: -8, fill: newS.color, fontSize: 14.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "CPI for agricultural labourers, year-on-year, on the retired 1986-87 base and the new 2019 base",
    "Two line charts side by side on one time axis, never spliced. The old base runs July 2000 to May 2025, peaking at " + pk.value.toFixed(1) + " per cent in January 2010 and retiring at " + oldS.data.at(-1).value.toFixed(1) + ". The new base runs June 2025 to May 2026 and ends at " + newS.data.at(-1).value.toFixed(1) + " per cent.");
  document.getElementById("plot-al").append(plot);
  wireTools(document.getElementById("cb-al"), plot, [newPad, oldPad], "india-atlas_cpial_two-bases_2000-2026");
  // no crosshair: the two bases have different spans, so a shared index
  // cannot address both — the tooltip would lie
  wireLegend(document.getElementById("legend-al"), plot, ["al_old", "al_new"],
    { al_old: { color: "#8A857A" }, al_new: { color: "#BE3E26" } });
  setTxt("pv-al", f1(newS.data.at(-1).value));
  setTxt("al-old-final", f1(oldS.data.at(-1).value));
  setTxt("al-new", f1(newS.data.at(-1).value));
  setTxt("al-peak", pk.value.toFixed(1) + "%");
}

/* ---------- §10 AL vs RL on the new base ---------- */
{
  const V = { al: ALP, rl: RLP };
  const geo = { W: 1184, H: 430, ml: 70, mr: 150, mt: 30, mb: 48, d0: -2.2, d1: 5 };
  const xTicks = [new Date(Date.UTC(2025, 5, 1)), new Date(Date.UTC(2025, 8, 1)), new Date(Date.UTC(2025, 11, 1)), new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 4, 1))];
  const plot = multiLine("cb-alrl", "plot-alrl", ["al", "rl"], V, geo, [-2, 0, 2, 4], xTicks, fmtMY,
    "india-atlas_cpialrl_al-vs-rl_base2019",
    "CPI-AL against CPI-RL, year-on-year, June 2025 to May 2026, base 2019",
    "Two line charts. AL ends at " + ALP.data.at(-1).value.toFixed(1) + " per cent, RL at " + RLP.data.at(-1).value.toFixed(1) + "; they part by fractions of a point.",
    { recentN: 3 });
  wireLegend(document.getElementById("legend-alrl"), plot, ["al", "rl"], V);
  const av = ALP.data.at(-1).value, rv = RLP.data.at(-1).value;
  setTxt("pv-alrl", f1(rv));
  setTxt("alrl-al", f1(av)); setTxt("alrl-rl", f1(rv));
  setTxt("alrl-gap", Math.abs(av - rv).toFixed(1) + " points");
  setTxt("alrl-cpirural", f1(RU.rural.data.at(-1).value));
}

/* ---------- §10 AL group indices ---------- */
{
  const V = {
    food: { ...ALG.food_published_yoy, label: "Food", color: "#BE3E26" },
    pan: { ...ALG.pan_tobacco_and_intoxicants_published_yoy, label: "Pan & tobacco", color: "#C6C0B0" },
    fuel: { ...ALG.fuel_and_light_published_yoy, label: "Fuel & light", color: "#8A857A" },
    clothing: { ...ALG.clothing_and_footwear_published_yoy, label: "Clothing & footwear", color: "#A8A293" },
    misc: { ...ALG.miscellaneous_published_yoy, label: "Miscellaneous", color: "#5B564B" },
  };
  const keys = ["food", "pan", "fuel", "clothing", "misc"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 255, mt: 30, mb: 48, d0: -5, d1: 7 };
  const xTicks = [new Date(Date.UTC(2025, 5, 1)), new Date(Date.UTC(2025, 8, 1)), new Date(Date.UTC(2025, 11, 1)), new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 4, 1))];
  const plot = multiLine("cb-algrp", "plot-algrp", keys, V, geo, [-4, -2, 0, 2, 4, 6], xTicks, fmtMY,
    "india-atlas_cpial_groups_base2019",
    "CPI-AL group indices, year-on-year, June 2025 to May 2026, base 2019",
    "Five line charts. Food ends at " + V.food.data.at(-1).value.toFixed(1) + " per cent, pan and tobacco at " + V.pan.data.at(-1).value.toFixed(1) + ", fuel and light at " + V.fuel.data.at(-1).value.toFixed(1) + ", clothing at " + V.clothing.data.at(-1).value.toFixed(1) + ", miscellaneous at " + V.misc.data.at(-1).value.toFixed(1) + ".",
    { recentN: 3 });
  wireLegend(document.getElementById("legend-algrp"), plot, keys, V);
  setTxt("pv-algrp", f1(V.food.data.at(-1).value));
  setTxt("alg-food", f1(V.food.data.at(-1).value));
  setTxt("alg-fuel", f1(V.fuel.data.at(-1).value));
  setTxt("alg-cloth", f1(V.clothing.data.at(-1).value));
  setTxt("alg-misc", f1(V.misc.data.at(-1).value));
  setTxt("alg-cpifood", f1(L.food));
}

/* ---------- ledger sparklines ---------- */
spark("nspark-head", S24.headline);
regRows.forEach(([s], i) => spark("sp-l" + i, s));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle2024.meta.vintage);
setTxt("prov-vintage24", bundle2024.meta.vintage);
setTxt("prov-vintage3", alrl2019Bundle.meta.vintage);
