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
import linked2024Bundle from "../../data/series/cpi-2024-linked.json";
import sectors2024Bundle from "../../data/series/cpi-2024-sectors.json";
import groups2024Bundle from "../../data/series/cpi-2024-groups.json";
import items2024Bundle from "../../data/series/cpi-2024-items.json";
import states2024Bundle from "../../data/series/cpi-2024-states.json";
import alStates86Bundle from "../../data/series/cpialrl-states-1986.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, peakBetween, dodgeEndLabels, spark, downloadCSV, stripLabelSide, stripLabelSpot, makePlacer, annotationSpot,
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
const LN24 = hydrate(linked2024Bundle); // continuous 2024-base headline: NSO back-cast + live, one ruler
const S24S = hydrate(sectors2024Bundle); // base 2024=100 rural & urban General — separate, never merged
const G24 = hydrate(groups2024Bundle);   // the 43 groups below the divisions, base 2024
const IT24 = hydrate(items2024Bundle);   // all 358 items of the 2024 basket
const ST24 = hydrate(states2024Bundle);  // 36 state/UT General indices, base 2024
const ALS86 = hydrate(alStates86Bundle); // CPI-AL by state, base 1986-87 (retired) — final reading May 2025

// §08 store — combined against its two sector halves
const RU = {
  combined: { ...S.headline, label: "Combined", color: "#2E4BD8" },
  rural: { ...R.headline, label: "Rural", color: "#5F6675" },
  urban: { ...U.headline, label: "Urban", color: "#A3A9B4" },
};
// §02/§10 ledger copies of the Labour Bureau series
const ALP = { ...AL19.al_published_yoy, label: "AL", color: "#2E4BD8" };
const RLP = { ...AL19.rl_published_yoy, label: "RL", color: "#5F6675" };
const dates = S.headline.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();
// periods named in captions and descriptions come from the data, never typed in
const MLONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const longDate = (d) => MLONG[d.getUTCMonth()] + " " + d.getUTCFullYear();
const spanLong = (data) => longDate(data[0].date) + " to " + longDate(data.at(-1).date);

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
setHTML("d-head", `<b>${arrow(L24.headline - P24.headline)}</b> vs May, ${bandNote(L24.headline)}`);
setHTML("d-food", `<b>${arrow(L24.food_and_beverages - P24.food_and_beverages)}</b> vs May, ${word(L24.food_and_beverages - P24.food_and_beverages)}`);
setHTML("d-old", `base retired, series ends Dec 2025`);
setHTML("d-core", `<b>${arrow(L.core - P.core)}</b> vs Nov, to Dec 2025`);

setHTML("rb-big", L24.headline.toFixed(2) + pc);
setHTML("rb-band", `Position in RBI band: <b>${
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
    `<rect x="${X(2)}" y="${y - 7}" width="${X(6) - X(2)}" height="14" fill="#F6F7F9" stroke="#EEF0F3" stroke-width="1"/>` +
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#DADDE3" stroke-width="1"/>` +
    `<line x1="${X(4)}" y1="${y - 10}" x2="${X(4)}" y2="${y + 10}" stroke="#878D99" stroke-width="1" stroke-dasharray="2,3"/>` +
    [0, 2, 4, 6, 8].map((t, i, a) => `<text x="${X(t)}" y="${H - 6}" font-family="'Golos Text',sans-serif" font-size="11" fill="#878D99" text-anchor="${i === 0 ? "start" : i === a.length - 1 ? "end" : "middle"}">${t}%</text>`).join("") +
    `<circle cx="${X(val)}" cy="${y}" r="4.5" fill="#2E4BD8" stroke="#FFFFFF" stroke-width="1.5"/>` +
    `</svg>`;
}
const f1 = (v) => v.toFixed(2) + "%";
// §01 "current reading" prose is now pipeline-generated (pipeline/out/prose-cpi.*.md);
// the cr-* figure spans it used to carry are retired.

setTxt("pv-main", f1(L.headline));
setTxt("pv-food", f1(L.food)); setTxt("pv-fuel", f1(L.fuel)); setTxt("pv-core", f1(L.core));
setTxt("ex-food", f1(L.food)); setTxt("ex-food-y", f1(Y.food));
setTxt("ex-fuel", f1(L.fuel)); setTxt("ex-core", f1(L.core));
setTxt("ex-hjan", f1(S.headline.data.at(-12).value)); setTxt("ex-hdec", f1(L.headline));
const pkFood = peakOf(S.food), pkFuel = peakOf(S.fuel), pkCore = peakOf(S.core);
setTxt("pf-food", `peak: ${pkFood.value.toFixed(1)}%, ${fmtDate(pkFood.date)}, latest: ${f1(L.food)}`);
setTxt("pf-fuel", `peak: ${pkFuel.value.toFixed(1)}%, ${fmtDate(pkFuel.date)}, latest: ${f1(L.fuel)}`);
setTxt("pf-core", `peak: ${pkCore.value.toFixed(1)}%, ${fmtDate(pkCore.date)}, latest: ${f1(L.core)}`);

/* ---------- §02 a continuous headline on the 2024 base ----------
 * The NSO publishes its own back-cast to 2013 (series=Back) and live levels
 * from 2025 (series=Current) — both on base 2024=100. Joined, they form one
 * continuous headline on the new ruler, 2014–2026. This is NOT a cross-base
 * splice: no 2012 figure enters it. The 2025 y/y is computed at the handoff
 * from back-cast 2024 levels to current 2025 levels (same base). The retired
 * 2012 series is drawn faint, for comparison only. */
{
  const linked = LN24.headline;                                          // continuous 2024 base, primary
  const oldS = { ...S.headline, label: "Base 2012 · retired", color: "#C9CED6" };  // faint reference
  const handoff = new Date(Date.UTC(2025, 0, 1));                        // back-cast → live levels
  const geo = { W: 1184, H: 520, ml: 70, mr: 178, mt: 36, mb: 48, d0: -1, d1: 10 };
  const yTicks = [0, 2, 4, 6, 8, 10];
  const xTicks = []; for (let y = 2014; y <= 2026; y += 2) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const nbPlacer = makePlacer(geo, linked.data.map((d) => d.date));
  nbPlacer.addSeries(linked.data).addSeries(oldS.data).addRuleY(4);
  const nbRbiSpot = nbPlacer.place("RBI target, 4%", 12, [
    { x: new Date(Date.UTC(2023, 5, 1)), y: 3.3, anchor: "start" },
    { x: new Date(Date.UTC(2024, 0, 1)), y: 3.3, anchor: "start" },
    { x: new Date(Date.UTC(2017, 6, 1)), y: 3.3, anchor: "start" },
    { x: new Date(Date.UTC(2014, 2, 1)), y: 4.55, anchor: "start" },
  ]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ year-on-year, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: linked.data[0].date, x2: linked.data.at(-1).date, fill: "#F4F6FD" }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleY([4], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ date: nbRbiSpot.x, value: nbRbiSpot.y }], { x: "date", y: "value", text: ["RBI target, 4%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: nbRbiSpot.anchor }),
      Plot.lineY(oldS.data, { x: "date", y: "value", stroke: oldS.color, strokeWidth: 1.5, strokeOpacity: 0.7, strokeLinejoin: "round", strokeLinecap: "round" }),
      // the continuous 2024-base headline, in two evidence regimes:
      // NSO back-cast (reconstructed history, to 2024) — lighter, thinner
      Plot.lineY(linked.data.filter((d) => d.date < handoff), { x: "date", y: "value", stroke: linked.color, strokeWidth: 2, strokeOpacity: 0.55, strokeLinejoin: "round", strokeLinecap: "round" }),
      // live measurement (from Dec 2024 levels onward) — solid; starts at the join so the line never breaks
      Plot.lineY(linked.data.filter((d) => d.date >= new Date(Date.UTC(2024, 11, 1))), { x: "date", y: "value", stroke: linked.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.ruleX([handoff], { stroke: "#CDD1D8", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: handoff, value: 9.4 }], { x: "date", y: "value", text: ["live print begins, Jan 2025"], fontSize: 12, fill: "#5F6675", fontFamily: mono, textAnchor: "end", dx: -8 }),
      Plot.dot([oldS.data.at(-1)], { x: "date", y: "value", fill: oldS.color, r: 3, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot([linked.data.at(-1)], { x: "date", y: "value", fill: linked.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([linked.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 2024 ${d.value.toFixed(2)}%`, dx: 16, dy: -8, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Headline CPI as a continuous series on the 2024 base (NSO back-cast to 2014, live from 2025), beside the retired 2012 ruler",
    "A continuous blue line on the 2024 base runs from 2014 to " + longDate(LN24.headline.data.at(-1).date) + ", ending at " + L24.headline.toFixed(1) + " per cent: the NSO's own back-cast joined to the live print; no 2012-base figure enters it. A faint grey line shows the retired 2012 series for comparison, ending at " + L.headline.toFixed(1) + " per cent in December 2025. The two rulers read the overlap years slightly differently. Shaded band: RBI tolerance 2–6%; dashed rule: 4% target.");
  document.getElementById("plot-nb").append(plot);
  wireTools(document.getElementById("cb-nb"), plot, [linked, oldS], "india-atlas_cpi2024_linked-headline_2014-2026");
  wireLegend(document.getElementById("legend-nb"), plot, ["nb_new", "nb_old"],
    { nb_new: { color: "#2E4BD8" }, nb_old: { color: "#C9CED6" } });
  setTxt("pv-nb", f1(L24.headline));
  setTxt("nb-jan", f1(FIRST24)); setTxt("nb-new", f1(L24.headline));
  setTxt("nb-old-final", f1(L.headline));
  const oldByT = new Map(oldS.data.map((d) => [d.date.getTime(), d.value]));
  let shadow = 0;
  for (const d of linked.data) { const o = oldByT.get(d.date.getTime()); if (d.value != null && o != null) shadow = Math.max(shadow, Math.abs(d.value - o)); }
  setTxt("nb-shadow", shadow.toFixed(1) + " pt");
}

/* ---------- §03 the new basket, opened up ----------
 * The rebase's editorial point: six groups → thirteen COICOP-2018 divisions,
 * so services (housing, health, education, transport, recreation, restaurants,
 * personal care) are seen separately for the first time. The API serves no
 * division weights for this base, so divisions are a ranked strip, not a
 * weighted split — honestly unweighted. The companion plate wires the new-base
 * rural/urban General indices to test whether the rebase changed the wedge. */
{
  const DIV = {
    food_and_beverages: "Food & beverages",
    paan_tobacco_and_intoxicants: "Paan, tobacco & intoxicants",
    clothing_and_footwear: "Clothing & footwear",
    housing_water_electricity_gas_and_other_fuels: "Housing, water, electricity, gas & fuels",
    furnishings_household_equipment_and_routine_household_maintenance: "Furnishings & household equipment",
    health: "Health",
    transport: "Transport",
    information_and_communication: "Information & communication",
    recreation_sport_and_culture: "Recreation, sport & culture",
    education_services: "Education",
    restaurants_and_accommodation_services: "Restaurants & hotels",
    personal_care_social_protection_and_miscellaneous_goods_and_services: "Personal care, incl. gold",
  };
  const rows = Object.keys(DIV).map((k) => ({ k, name: DIV[k], s: S24[k], v: S24[k].data.at(-1).value }))
    .sort((a, b) => b.v - a.v);
  const head = L24.headline;   // published all-groups index = the reference rule
  const geo = { W: 1184, H: 500, ml: 304, mr: 88, mt: 34, mb: 46 };
  const divSpot = (v) => stripLabelSpot(geo, -1, 17.5, v, head);
  const xt = [0, 2, 4, 6, 8, 10, 12, 14, 16];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "year-on-year, per cent →", labelAnchor: "right", labelArrow: "none", domain: [-1, 17.5], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([head], { stroke: "#161A22", strokeWidth: 1, strokeDasharray: "3,3" }),
      Plot.text([{ x: head }], { x: "x", text: () => "Headline, " + f1(head), frameAnchor: "top", dy: -16, dx: 5, fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot(rows, { x: "v", y: "name", r: 5.5, fill: (d) => (d.v > head ? "#2E4BD8" : "#878D99"), stroke: "#FFFFFF", strokeWidth: 1 }),
      /* Plot ignores function-valued dx/textAnchor — one text mark per side */
      ["start", "end", "middle"].map((a) => Plot.text(rows.filter((d) => divSpot(d.v).anchor === a), { x: "v", y: "name", text: (d) => d.v.toFixed(2) + "%",
        dx: a === "end" ? -12 : a === "start" ? 12 : 0, dy: a === "middle" ? -11 : 0.5,
        fill: (d) => (d.v > head ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono, textAnchor: a })),
    ],
  });
  const top = rows[0], bot = rows.at(-1);
  const aboveN = rows.filter((r) => r.v > head).length;
  a11y(plot, "CPI divisions on the 2024 base, " + longDate(S24.headline.data.at(-1).date) + ", twelve COICOP divisions sorted by year-on-year rate",
    "Dot strip. " + top.name + " is highest at " + top.v.toFixed(1) + " per cent, " + bot.name + " lowest at " + bot.v.toFixed(1) + ". The all-groups headline of " + head.toFixed(1) + " per cent is marked; " + aboveN + " of twelve divisions sit above it. Personal care, which carries gold, is the outlier.");
  document.getElementById("plot-div").append(plot);
  wireTools(document.getElementById("cb-div"), plot, rows.map((r) => r.s), "india-atlas_cpi_13-divisions_2026");
  setTxt("pv-div", top.name);
  setTxt("div-top", top.name + ", " + f1(top.v));
  setTxt("div-bot", bot.name + ", " + bot.v.toFixed(2) + "%");
  setTxt("div-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("div-above", String(aboveN));
  setTxt("div-gold", f1(S24.personal_care_social_protection_and_miscellaneous_goods_and_services.data.at(-1).value));
  setTxt("div-rest", f1(S24.restaurants_and_accommodation_services.data.at(-1).value));
  setTxt("div-info", f1(S24.information_and_communication.data.at(-1).value));
}

/* §03 companion: rural vs urban on the new 2024 base */
{
  const V = {
    rural: { ...S24S.rural, label: "Rural", color: "#2E4BD8" },
    urban: { ...S24S.urban, label: "Urban", color: "#A3A9B4" },
  };
  // y-domain from the data (half-point grid), so a new print can never leave the frame
  const ruVals = [...V.rural.data, ...V.urban.data].map((d) => d.value).filter((v) => v != null);
  const ruLo = Math.floor(Math.min(...ruVals) * 2) / 2, ruHi = Math.ceil(Math.max(...ruVals) * 2) / 2;
  const ruTicks = []; for (let t = ruLo; t <= ruHi + 1e-9; t += 0.5) ruTicks.push(+t.toFixed(1));
  const geo = { W: 1184, H: 380, ml: 70, mr: 150, mt: 30, mb: 48, d0: ruLo - 0.1, d1: ruHi + 0.1 };
  const xTicks = S24S.rural.data.map((d) => d.date);
  const plot = multiLine("cb-ru24", "plot-ru24", ["rural", "urban"], V, geo, ruTicks, xTicks,
    (d) => MN[d.getUTCMonth()] + " " + String(d.getUTCFullYear()).slice(2),
    "india-atlas_cpi_rural-urban_base2024",
    "Headline CPI rural and urban on the 2024 base, " + spanLong(V.rural.data),
    "Two line charts. Rural ends at " + V.rural.data.at(-1).value.toFixed(1) + " per cent, urban at " + V.urban.data.at(-1).value.toFixed(1) + ". Rural runs above urban in " + V.rural.data.filter((d, i) => d.value > V.urban.data[i].value).length + " of the " + V.rural.data.length + " months of the new base.",
    { recentN: 3 });
  wireLegend(document.getElementById("legend-ru24"), plot, ["rural", "urban"], V);
  const rl = V.rural.data.at(-1).value, ul = V.urban.data.at(-1).value;
  setTxt("pv-ru24", f1(rl));
  setTxt("ru24-r", f1(rl)); setTxt("ru24-u", f1(ul));
  setTxt("ru24-gap", (rl - ul).toFixed(2) + " pt");
}

/* ---------- §03 the 43 groups — field-guide grid (base 2024) ----------
 * The dials format needs a decade to disclose volatility; six months cannot.
 * So this grid is read as a ranked field — positions and colour, not slopes.
 * Mirrors the §09 panel styling (sm-panel) for visual continuity. */
{
  const head = L24.headline;
  const rows = Object.values(G24)
    .map((s) => ({ s, label: s.label, v: s.data.at(-1).value }))
    .filter((r) => r.v != null)
    .sort((a, b) => b.v - a.v);
  const grid = document.getElementById("grid24");
  for (const r of rows) {
    const above = r.v > head;
    const col = above ? "#2E4BD8" : "#5F6675";
    /* each panel is on its own scale — say so, faintly, in its corner:
     * the tiny range makes the normalized shape quantitative */
    const vals = r.s.data.map((d) => d.value).filter((v) => v != null);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    const range = lo === hi ? hi.toFixed(1) : lo.toFixed(1) + "–" + hi.toFixed(1);
    /* baseline, two-sided: the time window on the left, the y-range on the
     * right — each panel is self-describing, no axis needed */
    const d0 = r.s.data[0].date, d1 = r.s.data.at(-1).date;
    const sameY = d0.getUTCFullYear() === d1.getUTCFullYear();
    const window_ = sameY
      ? MN[d0.getUTCMonth()] + "–" + MN[d1.getUTCMonth()] + " '" + String(d1.getUTCFullYear()).slice(2)
      : d0.getUTCFullYear() + "–" + String(d1.getUTCFullYear()).slice(2);
    const el = document.createElement("div");
    el.className = "sm-panel";
    el.innerHTML = `<div class="sm-t">${r.label}</div><div class="sm-v${above ? " acc" : ""}">${r.v.toFixed(1)}%</div><div class="sm-r"><span class="x">${window_}</span>${range}</div>`;
    const p = Plot.plot({
      width: 262, height: 92, marginLeft: 4, marginRight: 4, marginTop: 6, marginBottom: 4,
      style: { background: "transparent" },
      x: { axis: null },
      y: { axis: null, domain: [Math.min(...vals, 0), Math.max(...vals)] },
      marks: [
        Plot.ruleY([0], { stroke: "#E3E6EB", strokeWidth: 1 }),
        Plot.lineY(r.s.data, { x: "date", y: "value", stroke: col, strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([r.s.data.at(-1)], { x: "date", y: "value", fill: col, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    p.setAttribute("aria-hidden", "true");
    el.append(p);
    grid.append(el);
  }
  const fill = (4 - (rows.length % 4)) % 4;
  for (let i = 0; i < fill; i++) {
    const el = document.createElement("div");
    el.className = "sm-panel";
    el.setAttribute("aria-hidden", "true");
    grid.append(el);
  }
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", "Small-multiple grid of all 43 CPI groups on the 2024 base, " + spanLong(S24.headline.data) + ", ranked by latest year-on-year. Hottest: " + rows[0].label + " at " + rows[0].v.toFixed(1) + " per cent; " + rows.filter((r) => r.v > head).length + " of 43 sit above the headline.");
  setTxt("pv-grid24", rows[0].v.toFixed(1) + "%");
  setTxt("pc-grid24", fmtDate(S24.headline.data.at(-1).date) + ", " + rows[0].label);
  setTxt("ex-g24-n", String(rows.filter((r) => r.v > head).length));
  setTxt("ex-g24-hi", rows[0].label + ", " + rows[0].v.toFixed(1) + "%");
  setTxt("ex-g24-lo", rows.at(-1).label + ", " + rows.at(-1).v.toFixed(1) + "%");
  wireTools(document.getElementById("cb-grid24"), null, Object.values(G24), "india-atlas_cpi2024_43-groups_2026", fmtDate);
}

/* ---------- §03 the item ledger: all 358 items, extremes shown ----------
 * Grid-vs-ledger decision, as on the WPI page: 358 panels would be postage
 * stamps. Fifteen hottest and fifteen coldest carry sparklines; the full
 * basket ships in the CSV. The y/y column is computed from levels (six
 * same-base prints exist); the level column is the item's whole life on
 * this ruler, since the base average sits at 100 barely a year back. */
{
  const f01 = (v) => v.toFixed(1) + "%";
  const all = Object.keys(IT24).map((k) => {
    const d = IT24[k].data.filter((x) => x.value != null);
    if (!d.length) return null;
    const ext = items2024Bundle.series[k];
    return { k, s: IT24[k], latest: d.at(-1).value, prevV: d.length > 1 ? d.at(-2).value : null,
      level: ext.latest_level, code: ext.code, division: ext.division };
  }).filter(Boolean).sort((a, b) => b.latest - a.latest || a.s.label.localeCompare(b.s.label));
  const top = all.slice(0, 15), bot = all.slice(-15);
  const row = (r, rank) => `
  <tr>
    <td class="name">${r.s.label}<small>№ ${rank} of ${all.length}, ${r.division}, ${r.code}</small></td>
    <td class="val">${f1(r.latest)}</td>
    <td class="chg">${r.prevV == null ? "—" : arrow(r.latest - r.prevV) + " · " + word(r.latest - r.prevV)}</td>
    <td class="yr">${r.level == null ? "—" : r.level.toFixed(2)}</td>
    <td class="spark" id="sp-i24-${rank}"></td>
  </tr>`;
  document.getElementById("tail24-body").innerHTML =
    top.map((r, i) => row(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="5">⋯ ${all.length - 30} items between ${f1(top.at(-1).latest)} and ${f1(bot[0].latest)}: the full basket ships in the CSV ⋯</td></tr>` +
    bot.map((r, i) => row(r, all.length - 14 + i)).join("");
  top.forEach((r, i) => spark("sp-i24-" + (i + 1), { ...r.s, color: "#5F6675" }));
  bot.forEach((r, i) => spark("sp-i24-" + (all.length - 14 + i), { ...r.s, color: "#5F6675" }));

  const vals = all.map((r) => r.latest);
  const median = (vals[Math.floor((vals.length - 1) / 2)] + vals[Math.ceil((vals.length - 1) / 2)]) / 2;
  setTxt("pv-tail24", f1(top[0].latest));
  setTxt("pc-tail24", fmtDate(S24.headline.data.at(-1).date) + ", " + top[0].s.label.slice(0, 34) + ": hottest item");
  setTxt("pf-tail24", `cut lines: 15th hottest ${f1(top.at(-1).latest)}, 15th coldest ${f1(bot[0].latest)}`);
  setTxt("ex-t24span", (top[0].latest - bot.at(-1).latest).toFixed(1));
  setTxt("ex-t24topn", top[0].s.label.toLowerCase());
  setTxt("ex-t24top", f01(top[0].latest));
  setTxt("ex-t24botn", bot.at(-1).s.label.toLowerCase());
  setTxt("ex-t24bot", f01(bot.at(-1).latest));
  setTxt("ex-t24med", f01(median));
  setTxt("ex-t24neg", String(vals.filter((v) => v < 0).length));
  const lvlHi = [...all].sort((a, b) => (b.level ?? -1) - (a.level ?? -1))[0];
  setTxt("ex-t24lvln", lvlHi.s.label.toLowerCase());
  setTxt("ex-t24lvl", lvlHi.level.toFixed(1));
  wireTools(document.getElementById("cb-tail24"), null, Object.values(IT24), "india-atlas_cpi2024_358-items_2026");
}

/* ---------- register ----------
 * Rows are series objects, not keys, so the ledger can mix stores: the
 * combined index, its sector halves, three sub-groups and the two Labour
 * Bureau series. Weight is null where a share of the combined basket would
 * be a lie (sector indices weigh 100 of their own basket; AL/RL is another
 * index entirely). Year-ago is null where the series is younger than
 * thirteen months — shown as a dash, never invented. */
const regRows = [
  [S24.headline, "Headline CPI, base 2024", "All items: published all-groups index; the API serves no weights for this base yet", "s-acc", null, null, false],
  [S24.food_and_beverages, "Food & beverages, base 2024", "Division 01 of the redrawn COICOP-2018-style basket", "s-g1", null, null, false],
  [G24.other_personal_effects, "Other personal effects, base 2024", "Group, division 12: jewellery lives here; gold is priced in world markets", "s-g3", null, null, false],
  [G24.electricity_gas_and_other_fuels, "Electricity, gas & other fuels, base 2024", "Group, division 04: the household energy bill on the new basket", "s-g2", null, null, false],
  [G24.passenger_transport_services, "Passenger transport services, base 2024", "Group, division 07: fares, from bus to airline", "s-g4", null, null, false],
  [S.headline, "Headline CPI (combined), base 2012", "Base retired, to Dec 2025: computed from group indices", "s-acc", 100.0, "#2E4BD8", true],
  [S.food, "Food & beverages, base 2012", "Base retired, to Dec 2025, nearly half the basket", "s-g1", 45.86, "#5F6675", true],
  [S.fuel, "Fuel & light, base 2012", "Base retired, to Dec 2025, LPG, kerosene, electricity", "s-g2", 6.84, "#A3A9B4", true],
  [S.core, "Core, base 2012", "Base retired, to Dec 2025, ex food, ex fuel: derived", "s-g3", 47.30, "#C9CED6", true],
  [RU.rural, "Headline, rural, base 2012", "Sector index: food weighs 54.18 here; no housing group", "s-g1", null, null, true],
  [RU.urban, "Headline, urban, base 2012", "Sector index: housing weighs 21.67; food only 36.29", "s-g2", null, null, true],
  [SUB.vegetables, "Vegetables, base 2012", "Sub-group, the headline's wild card", "s-g1", 6.04, "#5F6675", true],
  [SUB.cereals_and_products, "Cereals & products, base 2012", "Sub-group, the staple floor", "s-g1", 9.67, "#5F6675", true],
  [SUB.transport_and_communication, "Transport & communication, base 2012", "Sub-group, fares, fuel at the pump, phone bills", "s-g2", 8.59, "#A3A9B4", true],
  [ALP, "CPI-AL", "Agricultural labourers, Labour Bureau, base 2019, to " + fmtDate(ALP.data.at(-1).date), "s-acc", null, null, false],
  [RLP, "CPI-RL", "Rural labourers, Labour Bureau, base 2019, to " + fmtDate(RLP.data.at(-1).date), "s-g4", null, null, false],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, wt, col, retired], i) => {
  const data = s.data.filter((d) => d.value != null);
  const l = data.at(-1).value, p = data.at(-2).value;
  const yv = s.data.length >= 13 ? s.data.at(-13).value : null;
  const wtCell = wt == null ? "—"
    : wt.toFixed(1) + `<span class="wtrack"><i style="width:${wt}%;background:${col}"></i></span>`;
  // retired-base rows have no live month-on-month: blank the Δ so the column
  // carries only current signals (the series' final reading still shows under Latest)
  const chgCell = retired
    ? `<td class="chg" style="color:var(--faint)" title="series ended: no live m/m">—</td>`
    : `<td class="chg">${arrow(l - p)}, ${word(l - p)}</td>`;
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">${wtCell}</td>
    <td class="val">${f1(l)}</td>
    ${chgCell}
    <td class="yr">${yv == null ? "—" : f1(yv)}</td>
    <td class="spark" id="sp-l${i}"></td>
  </tr>`;
}).join("");

/* ---------- basket composition : combined, rural, urban (CES 2011–12) ----------
 * The 2024 base serves NO weights (verified at the API), so the basket cannot
 * move to the new ruler. It can, however, show the three sector baskets side by
 * side on the 2012 weights — the rural basket has no housing group and a far
 * heavier food weight; the urban basket is housing-heavy. That structural
 * difference is the point of the split. */
const GROUP_DEFS = [
  ["food", "Food & beverages", "#2E4BD8"],
  ["pan", "Pan, tobacco & intoxicants", "#4A5160"],
  ["clothing", "Clothing & footwear", "#878D99"],
  ["housing", "Housing", "#A3A9B4"],
  ["fuel", "Fuel & light", "#C9CED6"],
  ["misc", "Miscellaneous, services", "#DADDE3"],
];
const SECTOR_W = {
  combined: { food: 45.86, pan: 2.38, clothing: 6.53, housing: 10.07, fuel: 6.84, misc: 28.32 },
  rural: { food: 54.18, pan: 3.26, clothing: 7.36, fuel: 7.94, misc: 27.26 },
  urban: { food: 36.29, pan: 1.36, clothing: 5.57, housing: 21.67, fuel: 5.58, misc: 29.53 },
};
const sectorOrder = [["combined", "Combined"], ["rural", "Rural, no housing"], ["urban", "Urban, housing 21.7%"]];
const bb = document.getElementById("basket-bar");
bb.style.cssText = "display:block;height:auto;border:none;padding:0;background:none";
/* row labels right-aligned so they hug the bars; the legend below indents
 * to the bars' left edge so the whole block shares one vertical seam */
const LAB_W = 172;
bb.innerHTML = sectorOrder.map(([key, nm]) => {
  const w = SECTOR_W[key];
  const segs = GROUP_DEFS.filter(([g]) => w[g] != null)
    .map(([g, label, c]) => `<div class="seg" style="width:${w[g]}%;background:${c}" title="${label}: ${w[g]}%"></div>`).join("");
  return `<div style="display:flex;align-items:center;gap:16px;margin-top:12px"><div style="width:${LAB_W}px;flex-shrink:0;text-align:right;font-family:var(--sans);font-size:.72rem;color:var(--ink-soft);line-height:1.5">${nm}</div><div style="flex:1;display:flex;height:34px;border:1px solid var(--ink)">${segs}</div></div>`;
}).join("");
document.getElementById("basket-labels").innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:14px 30px;margin:20px 0 0 ${LAB_W + 16}px">` +
  GROUP_DEFS.map(([g, label, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${label}</div></div>`).join("") + "</div>";

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
  /* collision-aware annotation placement: every series, the 4% rule and the
   * COVID rule are obstacles; each label takes the first candidate that fits */
  const placer = makePlacer(geo, dates);
  keys.forEach((k) => placer.addSeries(S[k].data));
  placer.addRuleY(4).addRuleX(new Date(Date.UTC(2020, 3, 1)));
  const D = (y, m, d) => new Date(Date.UTC(y, m, d));
  const a19 = annotationSpot(placer, pk19, pk19.value.toFixed(1) + "%, " + fmtDate(pk19.date) + ", onion shock", 13, [
    { x: pk19.date, y: pk19.value, anchor: "end", dx: -10, dy: 34 },
    { x: pk19.date, y: pk19.value, anchor: "end", dx: -10, dy: 52 },
    { x: pk19.date, y: pk19.value, anchor: "middle", dx: 0, dy: 34 },
    { x: pk19.date, y: pk19.value, anchor: "start", dx: 10, dy: 34 },
    { x: pk19.date, y: pk19.value, anchor: "end", dx: -10, dy: -40 },
  ]);
  placer.addObstacleBox(a19.box);
  const a22 = annotationSpot(placer, pk22, pk22.value.toFixed(1) + "%, " + fmtDate(pk22.date), 13, [
    { x: pk22.date, y: pk22.value, anchor: "start", dx: 22, dy: 26 },
    { x: pk22.date, y: pk22.value, anchor: "end", dx: -22, dy: 12 },
    { x: pk22.date, y: pk22.value, anchor: "end", dx: -22, dy: 40 },
    { x: pk22.date, y: pk22.value, anchor: "middle", dx: 0, dy: 40 },
    { x: D(2022, 0, 1), y: 3.4, anchor: "start" },
  ]);
  placer.addObstacleBox(a22.box);
  const a23 = annotationSpot(placer, pk23, fmtDate(pk23.date) + ", vegetables", 13, [
    { x: pk23.date, y: pk23.value, anchor: "start", dx: 22, dy: 6 },
    { x: pk23.date, y: pk23.value, anchor: "start", dx: 22, dy: 26 },
    { x: pk23.date, y: pk23.value, anchor: "start", dx: 22, dy: 55 },
    { x: D(2023, 0, 1), y: 11.0, anchor: "start" },
    { x: pk23.date, y: pk23.value, anchor: "middle", dx: 0, dy: 38 },
  ]);
  placer.addObstacleBox(a23.box);
  const rbiSpot = placer.place("RBI target, 4%", 12, [
    { x: D(2024, 0, 1), y: 2.4, anchor: "start" },
    { x: D(2022, 1, 10), y: 3.15, anchor: "start" },
    { x: D(2017, 0, 10), y: 3.4, anchor: "start" },
    { x: D(2016, 1, 10), y: 8.6, anchor: "start" },
  ]);
  const tolSpot = placer.place("Tolerance band, 2–6%", 12, [
    { x: D(2016, 1, 1), y: 8.6, anchor: "start" },
    { x: D(2018, 5, 1), y: 7.3, anchor: "start" },
    { x: D(2021, 5, 1), y: 1.95, anchor: "start" },
    { x: D(2017, 0, 10), y: 6.7, anchor: "start" },
  ]);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F4F6FD" }),
    Plot.ruleY([-6], { stroke: "#E3E6EB", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
    Plot.ruleY([4], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
    Plot.text([{ date: rbiSpot.x, value: rbiSpot.y }], { x: "date", y: "value", text: ["RBI target, 4%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: rbiSpot.anchor }),
    Plot.text([{ date: tolSpot.x, value: tolSpot.y }], { x: "date", y: "value", text: ["Tolerance band, 2–6%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: tolSpot.anchor }),
    Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
    Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 14.2 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
    ...["food", "fuel"].map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(S.core.data, { x: "date", y: "value", stroke: S.core.color, strokeWidth: 1.75, strokeDasharray: "4 3", strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.headline.data, { x: "date", y: "value", stroke: S.headline.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.headline.data.slice(-13), { x: "date", y: "value", stroke: S.headline.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    Plot.dot([pk19, pk22, pk23], { x: "date", y: "value", fill: S.headline.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line(a19.leader, { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: a19.textX, value: a19.textY }], { x: "date", y: "value", text: [pk19.value.toFixed(1) + "%, " + fmtDate(pk19.date) + ", onion shock"], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: a19.spot.anchor }),
    Plot.line(a22.leader, { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: a22.textX, value: a22.textY }], { x: "date", y: "value", text: [pk22.value.toFixed(1) + "%, " + fmtDate(pk22.date)], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: a22.spot.anchor }),
    Plot.line(a23.leader, { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: a23.textX, value: a23.textY }], { x: "date", y: "value", text: [fmtDate(pk23.date) + ", vegetables"], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: a23.spot.anchor }),
    ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === S.headline ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.label} ${p.value.toFixed(2)}%`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === S.headline ? 500 : 400, textAnchor: "start",
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
  /* collision-aware peak annotation: try above (or below for a ceiling peak),
   * then to the sides — wherever the label is not struck by the line */
  const placer = makePlacer(geo, dates);
  placer.addSeries(s.data).addRuleY(0);
  const nearCeiling = pk.value > d1 - (d1 - d0) * 0.14;
  const dir = nearCeiling ? -1 : 1;
  const pkText = pk.value.toFixed(1) + "%, " + fmtDate(pk.date);
  const { spot, textX, textY, leader, box } = annotationSpot(placer, pk, pkText, 13, [
    { x: pk.date, y: pk.value, anchor: "middle", dx: 0, dy: dir * 30 },
    { x: pk.date, y: pk.value, anchor: "start", dx: 22, dy: dir * 18 },
    { x: pk.date, y: pk.value, anchor: "end", dx: -22, dy: dir * 18 },
    { x: pk.date, y: pk.value, anchor: "start", dx: 22, dy: -dir * 18 },
    { x: pk.date, y: pk.value, anchor: "end", dx: -22, dy: -dir * 18 },
    { x: pk.date, y: pk.value, anchor: "middle", dx: 0, dy: -dir * 30 },
  ]);
  placer.addObstacleBox(box);
  /* the 2–6% band means nothing without a name — label it inside the band,
   * wherever the line leaves room (same text and style as the plate-1 label).
   * The candidate sweep covers the band interior first, then just outside it
   * (plate 1's habit); the placer takes the first clean box and lint-charts
   * verifies the choice at the gate. A static 5-spot list is not enough —
   * the series moves with each print and a stale list ships a struck label. */
  const bandCands = [];
  for (const y of [3.1, 4.0, 4.9, 2.55, 5.55])                 // inside the 2–6 band
    for (let yr = 2016; yr <= 2025; yr++) bandCands.push({ x: new Date(Date.UTC(yr, 0, 1)), y, anchor: "start" });
  for (const y of [6.45, 1.55])                                // just outside the band
    for (let yr = 2016; yr <= 2025; yr++) bandCands.push({ x: new Date(Date.UTC(yr, 0, 1)), y, anchor: "start" });
  bandCands.push({ x: new Date(Date.UTC(2016, 0, 1)), y: 6.45, anchor: "start" });
  const bandSpot = placer.place("Tolerance band, 2–6%", 12, bandCands);
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
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F4F6FD" }),
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.areaY(s.data, { x: "date", y: "value", y1: d0 <= 0 ? 0 : d0, fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-13), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.text([{ date: bandSpot.x, value: bandSpot.y }], { x: "date", y: "value", text: ["Tolerance band, 2–6%"], fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: bandSpot.anchor }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(leader, { x: "x", y: "y", stroke: "#2E4BD8", strokeWidth: 1 }),
      Plot.text([{ date: textX, value: textY }], { x: "date", y: "value", text: [pkText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: spot.anchor }),
      Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([s.data.at(-1)], { x: "date", y: "value", text: (d) => d.value.toFixed(2) + "%", dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
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
componentChart("cb-core", "plot-core", "core", 2, 8, [3, 4, 5, 6, 7], "Core excludes food and fuel; derived, not published directly. Shaded band marks the RBI tolerance range.");

/* ---------- shared multi-line plate renderer (jobs pattern) ---------- */
function multiLine(blockId, plotId, keys, store, geo, yTicks, xTicks, fmtX, dlName, a11yTitle, a11yDesc, opts = {}) {
  const { band = false, fmtCross = fmtDate, recentN = 13 } = opts;
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.06);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    band ? Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dts[0], x2: dts.at(-1), fill: "#F4F6FD" }) : null,
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    /* recent emphasis is a "last year" idiom — meaningless on a sub-year series */
    seriesList[0].data.length >= 13
      ? Plot.lineY(store[keys[0]].data.slice(-recentN), { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" })
      : null,
    ...seriesList.map((s) => Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
      { x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y },
    ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], {
      x: "date", y: "y", text: () => `${p.s.endLabel ?? p.s.label} ${p.value.toFixed(2)}%`,
      dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
      fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start",
    })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
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
    education: "Education", personal_care_and_effects: "Personal care & effects",
    consumer_food_price: "Consumer food price, aggregate",
  };
  const outOfBand = (v) => v < 2 || v > 6;
  function smPanel(gridEl, key, domain) {
    const s = SUB[key];
    const v = s.data.at(-1).value;
    const acc = outOfBand(v);
    /* baseline, two-sided as on the 43-group grid: the time window on the
     * left, the class's shared axis on the right — each panel self-describing */
    const d0 = s.data[0].date, d1 = s.data.at(-1).date;
    const sameY = d0.getUTCFullYear() === d1.getUTCFullYear();
    const window_ = sameY
      ? MN[d0.getUTCMonth()] + "–" + MN[d1.getUTCMonth()] + " '" + String(d1.getUTCFullYear()).slice(2)
      : d0.getUTCFullYear() + "–" + String(d1.getUTCFullYear()).slice(2);
    const sg = (n) => (n < 0 ? "−" + Math.abs(n) : "+" + n);
    const el = document.createElement("div");
    el.className = "sm-panel";
    el.innerHTML = `<div class="sm-t">${TITLES[key]}</div><div class="sm-v${acc ? " acc" : ""}">${v.toFixed(1)}%</div><div class="sm-r"><span class="x">${window_}</span>${sg(domain[0])}…${sg(domain[1])}</div>`;
    const p = Plot.plot({
      width: 262, height: 92,
      marginLeft: 4, marginRight: 4, marginTop: 6, marginBottom: 4,
      style: { background: "transparent", overflow: "visible" },
      x: { axis: null },
      y: { axis: null, domain },
      marks: [
        Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F6F7F9" }),
        Plot.ruleY([0], { stroke: "#CDD1D8", strokeWidth: 1 }),
        Plot.lineY(s.data, { x: "date", y: "value", stroke: "#5F6675", strokeWidth: 1.3, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: acc ? "#2E4BD8" : "#5F6675", r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
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

/* ---------- §11 states on the new base: sorted dot strip ----------
 * Same form as the retired strip below it, on the 2024-base bundle — the two
 * are different rulers, drawn as separate plates, never compared cell for
 * cell. The x-domain is computed from the data: the new base is six months
 * old and its dispersion has no decade of history to justify a fixed frame. */
{
  const SHORT24 = {
    the_dadra_and_nagar_haveli_and_daman_and_diu: "DNH & Daman & Diu",
    andaman_and_nicobar_islands: "Andaman & Nicobar Is.",
    jammu_and_kashmir: "Jammu & Kashmir",
  };
  const rows = Object.entries(ST24)
    .map(([k, s]) => ({ k, name: SHORT24[k] ?? s.label, v: s.data.at(-1).value }))
    .filter((r) => r.v != null)
    .sort((a, b) => b.v - a.v);
  const out = (v) => v < 2 || v > 6;
  const ai = L24.headline;
  const lo = Math.min(0, Math.floor(Math.min(...rows.map((r) => r.v))));
  const hi = Math.ceil(Math.max(...rows.map((r) => r.v), 6));
  const xt = []; for (let t = Math.floor(lo / 2) * 2; t <= hi; t += 2) xt.push(t);
  const geo = { W: 1184, H: 1010, ml: 215, mr: 105, mt: 34, mb: 46 };
  const stSpot = (v) => stripLabelSpot(geo, lo - 0.6, hi + 0.9, v, [ai, 0]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain: [lo - 0.6, hi + 0.9], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.rect([{ x1: 2, x2: 6 }], { x1: "x1", x2: "x2", fill: "#F4F6FD" }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([ai], { stroke: "#161A22", strokeWidth: 1, strokeDasharray: "3,3" }),
      Plot.text([{ x: ai }], { x: "x", text: () => "All-India, " + f1(ai), frameAnchor: "top", dy: -18, dx: 4, fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot(rows, { x: "v", y: "name", r: 5.5, fill: (d) => (out(d.v) ? "#2E4BD8" : "#878D99"), stroke: "#FFFFFF", strokeWidth: 1 }),
      ["start", "end", "middle"].map((a) => Plot.text(rows.filter((d) => stSpot(d.v).anchor === a), { x: "v", y: "name", text: (d) => d.v.toFixed(2) + "%",
        dx: a === "end" ? -13 : a === "start" ? 13 : 0, dy: a === "middle" ? -11 : 0.5,
        fill: (d) => (out(d.v) ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono, textAnchor: a })),
    ],
  });
  const top = rows[0], bot = rows.at(-1);
  a11y(plot, "State inflation on the 2024 base, " + longDate(S24.headline.data.at(-1).date) + ", all " + rows.length + " published state and UT General indices, sorted",
    "Dot strip. " + top.name + " is highest at " + top.v.toFixed(1) + " per cent, " + bot.name + " lowest at " + bot.v.toFixed(1) + ". The all-India rate of " + ai.toFixed(1) + " is marked with a dashed rule; the 2 to 6 per cent band is shaded; dots outside it are blue. A separate strip below shows the retired 2012 base's final month: the two are never spliced.");
  document.getElementById("plot-st24").append(plot);
  wireTools(document.getElementById("cb-st24"), plot, Object.values(ST24), "india-atlas_cpi2024_states_2026");
  setTxt("pv-st24", (top.v - bot.v).toFixed(1) + " pt");
  setTxt("st24-top", top.name + ", " + f1(top.v));
  setTxt("st24-bot", bot.name + ", " + f1(bot.v));
  setTxt("st24-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("st24-ai", f1(ai)); setTxt("pf-st24-ai", f1(ai));
  setTxt("st24-above", String(rows.filter((r) => r.v > 6).length));
  setTxt("st24-below", String(rows.filter((r) => r.v < 2).length));
  setTxt("st24-neg", String(rows.filter((r) => r.v < 0).length));
}

/* ---------- §11 states, retired base: sorted dot strip ---------- */
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
  const stSpot = (v) => stripLabelSpot(geo, -5.2, 10.6, v, [ai, 0]);
  const xt = [-4, -2, 0, 2, 4, 6, 8, 10];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain: [-5.2, 10.6], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.rect([{ x1: 2, x2: 6 }], { x1: "x1", x2: "x2", fill: "#F4F6FD" }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([ai], { stroke: "#161A22", strokeWidth: 1, strokeDasharray: "3,3" }),
      Plot.text([{ x: ai }], { x: "x", text: () => "All-India, " + f1(ai), frameAnchor: "top", dy: -18, dx: 4, fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot(rows, { x: "v", y: "name", r: 5.5, fill: (d) => (out(d.v) ? "#2E4BD8" : "#878D99"), stroke: "#FFFFFF", strokeWidth: 1 }),
      ["start", "end", "middle"].map((a) => Plot.text(rows.filter((d) => stSpot(d.v).anchor === a), { x: "v", y: "name", text: (d) => d.v.toFixed(2) + "%",
        dx: a === "end" ? -13 : a === "start" ? 13 : 0, dy: a === "middle" ? -11 : 0.5,
        fill: (d) => (out(d.v) ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono, textAnchor: a })),
    ],
  });
  const top = rows[0], bot = rows.at(-1);
  a11y(plot, "State inflation, December 2025, all 35 published state and UT General indices, sorted",
    "Dot strip. " + top.name + " is highest at " + top.v.toFixed(1) + " per cent, " + bot.name + " lowest at " + bot.v.toFixed(1) + ". The all-India rate of " + ai.toFixed(1) + " is marked with a dashed rule; the 2 to 6 per cent band is shaded; dots outside it are blue.");
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
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, domain: [-6.5, 11], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.rect([{ x1: 2, x2: 6 }], { x1: "x1", x2: "x2", fill: "#F4F6FD" }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.link(rows, { x1: "r", x2: "u", y: "name", stroke: "#C9CED6", strokeWidth: 2 }),
      Plot.dot(rows, { x: "r", y: "name", r: 3.5, fill: "#5F6675", stroke: "#FFFFFF", strokeWidth: 1.25 }),
      Plot.dot(rows, { x: "u", y: "name", r: 3.5, fill: "#A3A9B4", stroke: "#FFFFFF", strokeWidth: 1.25 }),
      /* labels outside the dumbbell; Plot ignores function dx/textAnchor,
       * so one text mark per quadrant */
      Plot.text(rows.filter((d) => d.r < d.u), { x: "r", y: "name", text: (d) => d.r.toFixed(2) + "%", dx: -16, dy: 0.5, fill: "#5F6675", fontSize: 11.5, fontFamily: mono, textAnchor: "end" }),
      Plot.text(rows.filter((d) => d.r >= d.u), { x: "r", y: "name", text: (d) => d.r.toFixed(2) + "%", dx: 16, dy: 0.5, fill: "#5F6675", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(rows.filter((d) => d.r < d.u), { x: "u", y: "name", text: (d) => d.u.toFixed(2) + "%", dx: 16, dy: 0.5, fill: "#878D99", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(rows.filter((d) => d.r >= d.u), { x: "u", y: "name", text: (d) => d.u.toFixed(2) + "%", dx: -16, dy: 0.5, fill: "#878D99", fontSize: 11.5, fontFamily: mono, textAnchor: "end" }),
    ],
  });
  a11y(plot, "Rural against urban inflation, December 2025, in the five states where they differ most",
    "Dumbbell strip. " + rows.map((d) => d.name + ": rural " + d.r.toFixed(1) + " per cent, urban " + d.u.toFixed(1)).join("; ") + ". The gap runs in both directions.");
  document.getElementById("plot-stgap").append(plot);
  wireTools(document.getElementById("cb-stgap"), plot,
    rows.flatMap((d) => [SS[d.k + "_rural"], SS[d.k + "_urban"]]),
    "india-atlas_cpi_state-sector-gaps_2016-2025");
  wireLegend(document.getElementById("legend-stgap"), plot, ["rural", "urban"],
    { rural: { color: "#5F6675" }, urban: { color: "#A3A9B4" } });
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
  const oldS = { ...AL86.al, label: "Base 1986-87", color: "#878D99" };
  const newS = { ...AL19.al_published_yoy, label: "Base 2019", color: "#2E4BD8" };
  const oldPad = { ...oldS, data: [...oldS.data, ...newS.data.map((d) => ({ date: d.date, value: null }))] };
  const newPad = { ...newS, data: [...oldS.data.map((d) => ({ date: d.date, value: null })), ...newS.data] };
  const geo = { W: 1184, H: 520, ml: 70, mr: 195, mt: 36, mb: 48, d0: -4, d1: 19 };
  const yTicks = [-4, 0, 4, 8, 12, 16];
  const xTicks = []; for (let y = 2000; y <= 2025; y += 5) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const pk = peakOf(oldS);
  const seam = newS.data[0].date;
  /* the old base's final label sits in the seam's busiest spot — place it
   * against both lines and the seam rule */
  const alPlacer = makePlacer(geo, oldPad.data.map((d) => d.date));
  alPlacer.addSeries(oldS.data).addSeries(newS.data).addRuleX(seam).addRuleY(0);
  const oldLabelSpot = annotationSpot(alPlacer, oldS.data.at(-1),
    `Base 1986-87 ${oldS.data.at(-1).value.toFixed(2)}%`, 13.5, [
      { x: oldS.data.at(-1).date, y: oldS.data.at(-1).value, anchor: "end", dx: -14, dy: -20 },
      { x: oldS.data.at(-1).date, y: oldS.data.at(-1).value, anchor: "end", dx: -14, dy: 26 },
      { x: oldS.data.at(-1).date, y: oldS.data.at(-1).value, anchor: "middle", dx: 0, dy: 32 },
      { x: oldS.data.at(-1).date, y: oldS.data.at(-1).value, anchor: "start", dx: 14, dy: -20 },
    ]);
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
      Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.lineY(oldPad.data, { x: "date", y: "value", stroke: oldS.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(newPad.data, { x: "date", y: "value", stroke: newS.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([pk], { x: "date", y: "value", fill: "#878D99", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: pk.date, value: pk.value + 1.3 }], { x: "date", y: "value", text: () => pk.value.toFixed(1) + "%, " + fmtDate(pk.date) + ", after the failed monsoon", fill: "#878D99", fontSize: 12, fontFamily: mono, textAnchor: "middle" }),
      Plot.ruleX([seam], { stroke: "#CDD1D8", strokeWidth: 1 }),
      Plot.text([{ date: seam, value: 18.4 }], { x: "date", y: "value", text: ["base revised, 1986-87 → 2019"], fontSize: 12.5, fill: "#5F6675", fontFamily: mono, textAnchor: "end", dx: -8 }),
      Plot.dot([oldS.data.at(-1)], { x: "date", y: "value", fill: oldS.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([{ date: oldLabelSpot.textX, value: oldLabelSpot.textY }], { x: "date", y: "value", text: [`Base 1986-87 ${oldS.data.at(-1).value.toFixed(2)}%`], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: oldLabelSpot.spot.anchor }),
      Plot.dot([newS.data.at(-1)], { x: "date", y: "value", fill: newS.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([newS.data.at(-1)], { x: "date", y: "value", text: (d) => `Base 2019 ${d.value.toFixed(2)}%`, dx: 16, dy: -8, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, "CPI for agricultural labourers, year-on-year, on the retired 1986-87 base and the new 2019 base",
    "Two line charts side by side on one time axis, never spliced. The old base runs July 2000 to May 2025, peaking at " + pk.value.toFixed(1) + " per cent in January 2010 and retiring at " + oldS.data.at(-1).value.toFixed(1) + ". The new base runs June 2025 to May 2026 and ends at " + newS.data.at(-1).value.toFixed(1) + " per cent.");
  document.getElementById("plot-al").append(plot);
  wireTools(document.getElementById("cb-al"), plot, [newPad, oldPad], "india-atlas_cpial_two-bases_2000-2026");
  // no crosshair: the two bases have different spans, so a shared index
  // cannot address both — the tooltip would lie
  wireLegend(document.getElementById("legend-al"), plot, ["al_old", "al_new"],
    { al_old: { color: "#878D99" }, al_new: { color: "#2E4BD8" } });
  setTxt("pv-al", f1(newS.data.at(-1).value));
  setTxt("al-old-final", f1(oldS.data.at(-1).value));
  setTxt("al-new", f1(newS.data.at(-1).value));
  setTxt("al-peak", pk.value.toFixed(1) + "%");
}

/* ---------- §10 AL vs RL on the new base ---------- */
{
  const V = { al: ALP, rl: RLP };
  // upper bound from the data: the latest AL print can pass the old fixed 5%
  const alHi = Math.max(5, Math.ceil(Math.max(...[...ALP.data, ...RLP.data].map((d) => d.value).filter((v) => v != null))) + 0.5);
  const geo = { W: 1184, H: 430, ml: 70, mr: 150, mt: 30, mb: 48, d0: -2.2, d1: alHi };
  const xTicks = [new Date(Date.UTC(2025, 5, 1)), new Date(Date.UTC(2025, 8, 1)), new Date(Date.UTC(2025, 11, 1)), new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 4, 1))];
  const alTicks = []; for (let t = -2; t <= alHi; t += 2) alTicks.push(t);
  const plot = multiLine("cb-alrl", "plot-alrl", ["al", "rl"], V, geo, alTicks, xTicks, fmtMY,
    "india-atlas_cpialrl_al-vs-rl_base2019",
    "CPI-AL against CPI-RL, year-on-year, " + spanLong(ALP.data) + ", base 2019",
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
    food: { ...ALG.food_published_yoy, label: "Food", color: "#2E4BD8" },
    pan: { ...ALG.pan_tobacco_and_intoxicants_published_yoy, label: "Pan & tobacco", color: "#C9CED6" },
    fuel: { ...ALG.fuel_and_light_published_yoy, label: "Fuel & light", color: "#878D99" },
    clothing: { ...ALG.clothing_and_footwear_published_yoy, label: "Clothing & footwear", color: "#A3A9B4" },
    misc: { ...ALG.miscellaneous_published_yoy, label: "Miscellaneous", color: "#5F6675" },
  };
  const keys = ["food", "pan", "fuel", "clothing", "misc"];
  const geo = { W: 1184, H: 470, ml: 70, mr: 255, mt: 30, mb: 48, d0: -5, d1: 7 };
  const xTicks = [new Date(Date.UTC(2025, 5, 1)), new Date(Date.UTC(2025, 8, 1)), new Date(Date.UTC(2025, 11, 1)), new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 4, 1))];
  const plot = multiLine("cb-algrp", "plot-algrp", keys, V, geo, [-4, -2, 0, 2, 4, 6], xTicks, fmtMY,
    "india-atlas_cpial_groups_base2019",
    "CPI-AL group indices, year-on-year, " + spanLong(ALP.data) + ", base 2019",
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

/* ---------- §12 lead: two rural populations — CPI-rural vs CPI-AL ----------
 * The contrast that frames the AL section: the general rural household against
 * the agricultural-labour household. Both rural, both y/y, overlapping Jan 2016
 * – May 2025 (the old AL base's final reading). Trimmed to the shared window so
 * one axis serves both; never spliced, never joined. */
{
  const end = AL86.al.data.at(-1).date;   // May 2025
  const rural = { ...R.headline, name: "cpi_rural_base2012_yoy_pct", label: "CPI · rural (all households)", endLabel: "CPI rural", color: "#A3A9B4",
    data: R.headline.data.filter((d) => d.date <= end) };
  const al = { ...AL86.al, name: "cpi_al_base1986_yoy_pct", label: "CPI-AL (farm-labour households)", endLabel: "CPI-AL", color: "#2E4BD8",
    data: AL86.al.data.filter((d) => d.date >= rural.data[0].date) };
  const V = { al, rural };
  const geo = { W: 1184, H: 470, ml: 70, mr: 200, mt: 30, mb: 48, d0: -1, d1: 12 };
  const xTicks = []; for (let y = 2016; y <= 2025; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const plot = multiLine("cb-alcpi", "plot-alcpi", ["al", "rural"], V, geo, [0, 2, 4, 6, 8, 10, 12], xTicks,
    (d) => String(d.getUTCFullYear()),
    "india-atlas_cpi-al_vs_cpi-rural_2016-2025",
    "CPI-AL against CPI-rural, year-on-year, January 2016 to May 2025",
    "Two line charts on one axis. CPI-AL (farm labour) ends at " + al.data.at(-1).value.toFixed(1) + " per cent in May 2025, CPI-rural at " + rural.data.at(-1).value.toFixed(1) + ". CPI-AL swings wider: its basket is heavier in food.",
    { recentN: 13 });
  wireLegend(document.getElementById("legend-alcpi"), plot, ["al", "rural"], V);
  const av = al.data.at(-1).value, rv = rural.data.at(-1).value;
  const ruralByT = new Map(rural.data.map((d) => [d.date.getTime(), d.value]));
  let gapSum = 0, gapN = 0, gapMax = 0, gapMaxDate = null;
  for (const d of al.data) {
    const r = ruralByT.get(d.date.getTime());
    if (d.value != null && r != null) { const g = Math.abs(d.value - r); gapSum += g; gapN++; if (g > gapMax) { gapMax = g; gapMaxDate = d.date; } }
  }
  setTxt("pv-alcpi", f1(av));
  setTxt("alcpi-al", f1(av)); setTxt("alcpi-rural", f1(rv));
  setTxt("alcpi-avgap", (gapSum / gapN).toFixed(1) + " pt");
  setTxt("alcpi-maxgap", gapMax.toFixed(1) + " pt, " + fmtDate(gapMaxDate));
}

/* ---------- §12 companion: CPI-AL state dispersion (old base, final reading) ----------
 * The only state-level rural-labourer y/y the data supports: the 2019 base
 * serves state LEVELS only (no same-base year-ago exists yet), so this is the
 * final state reading of the retired 1986-87 ruler, May 2025. Twenty states. */
{
  const rows = Object.entries(ALS86)
    .map(([k, s]) => ({ k, name: stateName(k), s, v: s.data.at(-1).value }))
    .sort((a, b) => b.v - a.v);
  const ai = AL86.al.data.at(-1).value;   // All-India CPI-AL, May 2025
  const geo = { W: 1184, H: 600, ml: 168, mr: 88, mt: 34, mb: 46 };
  const alSpot = (v) => stripLabelSpot(geo, -2.2, 8.6, v, [ai, 0]);
  const xt = [-2, 0, 2, 4, 6, 8];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "year-on-year, per cent →", labelAnchor: "right", labelArrow: "none", domain: [-2.2, 8.6], ticks: xt, tickSize: 0, tickPadding: 12,
         tickFormat: (d) => (d === xt[xt.length - 1] ? d + "%" : String(d)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xt, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([ai], { stroke: "#161A22", strokeWidth: 1, strokeDasharray: "3,3" }),
      Plot.text([{ x: ai }], { x: "x", text: () => "All-India CPI-AL, " + f1(ai), frameAnchor: "top", dy: -16, dx: 5, fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      Plot.dot(rows, { x: "v", y: "name", r: 5.5, fill: (d) => (d.v > ai ? "#2E4BD8" : "#878D99"), stroke: "#FFFFFF", strokeWidth: 1 }),
      ["start", "end", "middle"].map((a) => Plot.text(rows.filter((d) => alSpot(d.v).anchor === a), { x: "v", y: "name", text: (d) => d.v.toFixed(2) + "%",
        dx: a === "end" ? -12 : a === "start" ? 12 : 0, dy: a === "middle" ? -11 : 0.5,
        fill: (d) => (d.v > ai ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono, textAnchor: a })),
    ],
  });
  const top = rows[0], bot = rows.at(-1);
  const aboveN = rows.filter((r) => r.v > ai).length;
  a11y(plot, "CPI-AL by state, May 2025, twenty states sorted by year-on-year rate, base 1986-87 (retired)",
    "Dot strip. " + top.name + " is highest at " + top.v.toFixed(1) + " per cent, " + bot.name + " lowest at " + bot.v.toFixed(1) + ". All-India CPI-AL of " + ai.toFixed(1) + " is marked; " + aboveN + " of twenty states sit above it. Base 1986-87, the final state reading before the series retired.");
  document.getElementById("plot-alst").append(plot);
  wireTools(document.getElementById("cb-alst"), plot, rows.map((r) => r.s), "india-atlas_cpial_states_base1986-final");
  setTxt("pv-alst", top.name);
  setTxt("alst-top", top.name + ", " + f1(top.v));
  setTxt("alst-bot", bot.name + ", " + bot.v.toFixed(2) + "%");
  setTxt("alst-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("alst-above", String(aboveN));
}

/* (the 2024-base state strip is drawn once, in the §11 block above — a second
 * writer here would stack a duplicate SVG into #plot-st24) */

/* ---------- ledger sparklines ---------- */
spark("nspark-head", S24.headline);
regRows.forEach(([s], i) => spark("sp-l" + i, s));

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle2024.meta.vintage);
setTxt("prov-vintage24", bundle2024.meta.vintage);
setTxt("prov-vintage3", alrl2019Bundle.meta.vintage);
