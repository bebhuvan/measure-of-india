// Dossier 03 · WPI — plate definitions and number wiring.
// Data: data/series/wpi.json, baked at build time by scripts/fetch.mjs.
// Plumbing (downloads, a11y, crosshair, legend, dodge, spark): src/charts/plumbing.js.

import * as Plot from "@observablehq/plot";
import bundle from "../../data/series/wpi.json";
import groupsBundle from "../../data/series/wpi-groups.json";
import subgroupsBundle from "../../data/series/wpi-subgroups.json";
import itemsBundle from "../../data/series/wpi-items.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, peakBetween, troughOf, dodgeEndLabels, spark, saveBlob,
} from "../charts/plumbing.js";

const S = hydrate(bundle);
const G = hydrate(groupsBundle);    // 29 two-digit groups, y/y from levels
const SG = hydrate(subgroupsBundle); // 134 sub-groups, y/y from levels
const IT = hydrate(itemsBundle);     // 697 items, y/y from levels
const dates = S.headline.data.map((d) => d.date);
const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => MN[d.getUTCMonth()] + " " + d.getUTCFullYear();

/* ---------- drive every displayed number from the data ---------- */
const L = {}; for (const k in S) L[k] = S[k].data.at(-1).value;
const P = {}; for (const k in S) P[k] = S[k].data.at(-2).value;
const Y = {}; for (const k in S) Y[k] = S[k].data.at(-13).value;
const prevName = fmtDate(S.headline.data.at(-2).date);
const pc = '<span class="pc">%</span>';
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
const word = (d) => (d >= 0 ? "firming" : "easing");
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const f1 = (v) => v.toFixed(2) + "%";

setHTML("n-head", L.headline.toFixed(2) + pc);
setHTML("n-food", L.food_index.toFixed(2) + pc);
setHTML("n-fuel", L.fuel.toFixed(2) + pc);
setHTML("n-mfg", L.manufactured.toFixed(2) + pc);
setHTML("d-head", `<b>${arrow(L.headline - P.headline)}</b> vs ${prevName} · ${word(L.headline - P.headline)}`);
setHTML("d-food", `<b>${arrow(L.food_index - P.food_index)}</b> vs ${prevName} · ${word(L.food_index - P.food_index)}`);
setHTML("d-fuel", `<b>${arrow(L.fuel - P.fuel)}</b> vs ${prevName} · ${word(L.fuel - P.fuel)}`);
setHTML("d-mfg", `<b>${arrow(L.manufactured - P.manufactured)}</b> vs ${prevName} · ${word(L.manufactured - P.manufactured)}`);

setHTML("rb-big", L.headline.toFixed(2) + pc);
setHTML("rb-prev", P.headline.toFixed(2) + pc);
// §01 "current reading" prose is pipeline-generated (pipeline/out/prose-wpi.*.md).

setTxt("pv-main", f1(L.headline));
setTxt("pv-fuel", f1(L.fuel)); setTxt("pv-mfg", f1(L.manufactured));
setTxt("ex-fuel", f1(L.fuel)); setTxt("ex-mfg", f1(L.manufactured));
const valAt = (s, ym) => S[s].data.find((d) => d.date.toISOString().slice(0, 7) === ym)?.value;
setTxt("ex-hsep", f1(valAt("headline", "2025-09"))); setTxt("ex-hapr", f1(L.headline));
const pkFuel = peakOf(S.fuel), pkMfg = peakOf(S.manufactured);
setTxt("pf-fuel", `peak — ${pkFuel.value.toFixed(1)}%, ${fmtDate(pkFuel.date)} · latest — ${f1(L.fuel)}`);
setTxt("pf-mfg", `peak — ${pkMfg.value.toFixed(1)}%, ${fmtDate(pkMfg.date)} · latest — ${f1(L.manufactured)}`);

/* ---------- register ---------- */
const regRows = [
  ["headline", "Headline WPI", "All commodities — computed from the three major groups", "s-acc", "100.0", "#BE3E26"],
  ["primary", "Primary articles", "Farm, mineral — the volatile rim", "s-g1", "22.62", "#5B564B"],
  ["fuel", "Fuel & power", "Mineral oils, electricity, coal", "s-g2", "13.15", "#A8A293"],
  ["manufactured", "Manufactured products", "Two-thirds of the basket — the calm core", "s-g3", "64.23", "#C6C0B0"],
  ["food_index", "Food index", "Primary + manufactured food — published directly", "s-g4", "—", "#8A857A"],
];
// notable 2-digit groups, from the groups bundle — weights below the majors
// are not carried in the bundle, so the weight cell stays em-dash.
const LG = {}, PG = {}, YG = {};
for (const k in G) { LG[k] = G[k].data.at(-1).value; PG[k] = G[k].data.at(-2).value; YG[k] = G[k].data.at(-13).value; }
const groupRows = [
  ["food_articles", "Food articles", "Group · under primary — the mandi gate", "s-g1"],
  ["crude_petroleum_natural_gas", "Crude petroleum & natural gas", "Group · under primary — the wellhead", "s-g2"],
  ["mineral_oils", "Mineral oils", "Group · under fuel & power — the refinery gate", "s-g3"],
  ["manufacture_of_basic_metals", "Basic metals", "Group · under manufactured — steel, aluminium", "s-g4"],
  ["manufacture_of_chemicals_and_chemical_products", "Chemicals & chemical products", "Group · under manufactured", "s-g1"],
  ["manufacture_of_textiles", "Textiles", "Group · under manufactured — the loom", "s-g2"],
];
// notable items, from the items bundle (v1.2) — petrol carries this print's
// fuel event to the pump grade; gold sits behind §07's other-manufacturing
// story; onion is the register's memento of what usually drives a WPI panic.
const LI = {}, PI = {}, YI = {};
const itemRows = [
  ["petrol", "Petrol", "Item · under mineral oils — the refinery gate, before taxes", "s-g2"],
  ["gold_gold_ornaments", "Gold & gold ornaments", "Item · under other manufacturing — the metal behind the jewellery group", "s-g4"],
  ["onion", "Onion", "Item · under food articles — the old headline-maker", "s-g1"],
];
for (const [k] of itemRows) { LI[k] = IT[k].data.at(-1).value; PI[k] = IT[k].data.at(-2).value; YI[k] = IT[k].data.at(-13).value; }
document.getElementById("ledger-body").innerHTML = regRows.map(([k, nm, sub, sw, wt, col]) => `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">${wt}${wt !== "—" ? `<span class="wtrack"><i style="width:${wt}%;background:${col}"></i></span>` : ""}</td>
    <td class="val">${f1(L[k])}</td>
    <td class="chg">${arrow(L[k] - P[k])} · ${word(L[k] - P[k])}</td>
    <td class="yr">${f1(Y[k])}</td>
    <td class="spark" id="sp-${k}"></td>
  </tr>`).join("") + groupRows.map(([k, nm, sub, sw]) => `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">—</td>
    <td class="val">${f1(LG[k])}</td>
    <td class="chg">${arrow(LG[k] - PG[k])} · ${word(LG[k] - PG[k])}</td>
    <td class="yr">${f1(YG[k])}</td>
    <td class="spark" id="sp-g-${k}"></td>
  </tr>`).join("") + itemRows.map(([k, nm, sub, sw]) => `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="wt">—</td>
    <td class="val">${f1(LI[k])}</td>
    <td class="chg">${arrow(LI[k] - PI[k])} · ${word(LI[k] - PI[k])}</td>
    <td class="yr">${f1(YI[k])}</td>
    <td class="spark" id="sp-it-${k}"></td>
  </tr>`).join("");

/* ---------- basket composition ---------- */
const groups = [
  ["Primary articles", 22.62, "#BE3E26"],
  ["Fuel & power", 13.15, "#4A463F"],
  ["Manufactured products", 64.23, "#A8A293"],
];
document.getElementById("basket-bar").innerHTML = groups.map(([n, w, c]) =>
  `<div class="seg" style="width:${w}%;background:${c}" title="${n} — ${w}%"></div>`).join("");
document.getElementById("basket-labels").innerHTML = groups.map(([n, w, c]) =>
  `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${w.toFixed(2)}%</div></div>`).join("");

/* ---------- plate 1 : headline + components ---------- */
{
  const keys = ["headline", "primary", "manufactured", "food_index"];
  const seriesList = keys.map((k) => S[k]);
  const geo = { W: 1184, H: 560, ml: 70, mr: 170, mt: 36, mb: 48, d0: -8, d1: 20 };
  const endGap = (geo.d1 - geo.d0) * 0.04;
  const dodged = dodgeEndLabels(seriesList, endGap);
  const pk22 = peakBetween(S.headline, 2021, 2022);   // May 2022 commodity shock
  const tr23 = troughOf({ data: S.headline.data.filter((d) => d.date.getUTCFullYear() === 2023) });
  const xTicks = []; for (let y = 2016; y <= 2026; y++) xTicks.push(new Date(Date.UTC(y, 0, 1)));
  const yTicks = [-5, 0, 5, 10, 15, 20];
  const t0 = dates[0].getTime(), t1 = dates.at(-1).getTime();
  const sx = (px) => px / ((geo.W - geo.ml - geo.mr) / (t1 - t0));
  const sy = (px) => px / ((geo.H - geo.mt - geo.mb) / (geo.d1 - geo.d0));
  const dxDate = (d, px) => new Date(d.getTime() + sx(px));
  const marks = [
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    Plot.ruleY([-8], { stroke: "#E0DACA", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: "#B9B2A1", strokeWidth: 1.25 }),
    Plot.ruleX([new Date(Date.UTC(2020, 3, 1))], { stroke: "#D8D3C4", strokeWidth: 1, strokeDasharray: "2,3" }),
    Plot.text([{ date: new Date(Date.UTC(2020, 5, 1)), value: 19 }], { x: "date", y: "value", text: ["COVID-19"], fontSize: 12, fill: "#8A857A", fontFamily: mono, textAnchor: "start" }),
    ...["primary", "manufactured", "food_index"].map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(S.headline.data, { x: "date", y: "value", stroke: S.headline.color, strokeWidth: 3, strokeLinejoin: "round", strokeLinecap: "round" }),
    Plot.lineY(S.headline.data.slice(-13), { x: "date", y: "value", stroke: S.headline.color, strokeWidth: 4.5, strokeLinecap: "round", strokeLinejoin: "round" }),
    Plot.dot([pk22, tr23], { x: "date", y: "value", fill: S.headline.color, r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
    Plot.line([{ x: pk22.date, y: pk22.value + sy(7) }, { x: pk22.date, y: pk22.value + sy(24) }], { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: pk22.date, value: pk22.value + sy(30) }], { x: "date", y: "value", text: () => pk22.value.toFixed(1) + "% · " + fmtDate(pk22.date) + " · commodity shock", fill: S.headline.color, fontSize: 13, fontFamily: mono, textAnchor: "middle" }),
    Plot.line([{ x: tr23.date, y: tr23.value - sy(7) }, { x: tr23.date, y: tr23.value - sy(20) }, { x: dxDate(tr23.date, -18), y: tr23.value - sy(20) }], { x: "x", y: "y", stroke: S.headline.color, strokeWidth: 1 }),
    Plot.text([{ date: dxDate(tr23.date, -24), value: tr23.value - sy(26) }], { x: "date", y: "value", text: () => tr23.value.toFixed(1) + "% · " + fmtDate(tr23.date) + " · seven months below zero", fill: S.headline.color, fontSize: 13, fontFamily: mono, textAnchor: "end" }),
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
  a11y(plot, "Headline WPI and components, year-on-year, January 2016 to April 2026",
    "Line chart. Headline ends at " + L.headline.toFixed(1) + " per cent, primary articles at " + L.primary.toFixed(1) + ", manufactured at " + L.manufactured.toFixed(1) + ", food index at " + L.food_index.toFixed(1) + ". Peak of May 2022 and the 2023 deflation annotated.");
  document.getElementById("plot-main").append(plot);
  wireTools(document.getElementById("cb-main"), plot, seriesList, "india-atlas_wpi_headline-components_2016-2026");
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
         ticks: [2016, 2018, 2020, 2022, 2024, 2026].map((y) => new Date(Date.UTC(y, 0, 1))),
         tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ y/y, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [d0, d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
      Plot.ruleY([d0], { stroke: "#E0DACA", strokeWidth: 1 }),
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
  a11y(plot, s.label + " inflation, year-on-year, 2016 to 2026",
    "Line chart ending at " + s.data.at(-1).value.toFixed(1) + " per cent, peaking at " + pk.value.toFixed(1) + " per cent in " + fmtDate(pk.date) + ". " + (extraNote || ""));
  document.getElementById(plotId).append(plot);
  wireTools(document.getElementById(blockId), plot, [s], "india-atlas_wpi_" + key + "_2016-2026");
  addCrosshair(document.getElementById(plotId), plot, [s], geo, fmtDate);
}
componentChart("cb-fuel", "plot-fuel", "fuel", -25, 55, [-20, 0, 20, 40], "Fuel and power is the most volatile major group in Indian price statistics.");
componentChart("cb-mfg", "plot-mfg", "manufactured", -5, 15, [-4, 0, 4, 8, 12], "Manufactured products carry two-thirds of the basket's weight.");

/* ---------- §07 : the 29 groups, one panel each ----------
 * Scale decision: two shared axes by volatility class. A group whose y/y has
 * ever left ±20% joins the wide axis (−50…+90, sized to the class extremes:
 * crude −46.2 … +86.4); the rest share −12…+20. One uniform axis would iron
 * the manufactured panels flat; per-panel axes would make panels
 * incomparable. Both classes stay comparable within themselves, and the
 * split is disclosed on the plate.
 * Accent decision: vermilion only where the latest |y/y| exceeds 6 — one
 * story per plate: where the heat is, this print. Threshold in the plotfoot. */
const f01 = (v) => (v < 0 ? "−" + Math.abs(v).toFixed(1) : v.toFixed(1)) + "%";
const fmtSigned = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%";
const SHORT = {
  coal: "Coal",
  crude_petroleum_natural_gas: "Crude petroleum & gas",
  electricity: "Electricity",
  food_articles: "Food articles",
  manufacture_of_basic_metals: "Basic metals",
  manufacture_of_beverages: "Beverages",
  manufacture_of_chemicals_and_chemical_products: "Chemicals",
  manufacture_of_computer_electronic_and_optical_products: "Computers & electronics",
  manufacture_of_electrical_equipment: "Electrical equipment",
  manufacture_of_fabricated_metal_products_except_machinery_and_equipment: "Fabricated metals",
  manufacture_of_food_products: "Food products (mfd.)",
  manufacture_of_furniture: "Furniture",
  manufacture_of_leather_and_related_products: "Leather",
  manufacture_of_machinery_and_equipment: "Machinery & equipment",
  manufacture_of_motor_vehicles_trailers_and_semi_trailers: "Motor vehicles",
  manufacture_of_other_non_metallic_mineral_products: "Non-metallic minerals",
  manufacture_of_other_transport_equipment: "Other transport eq.",
  manufacture_of_paper_and_paper_products: "Paper",
  manufacture_of_pharmaceuticals_medicinal_chemical_and_botanical_products: "Pharmaceuticals",
  manufacture_of_rubber_and_plastics_products: "Rubber & plastics",
  manufacture_of_textiles: "Textiles",
  manufacture_of_tobacco_products: "Tobacco",
  manufacture_of_wearing_apparel: "Wearing apparel",
  manufacture_of_wood_and_of_products_of_wood_and_cork: "Wood & cork",
  mineral_oils: "Mineral oils",
  minerals: "Minerals",
  non_food_articles: "Non-food articles",
  other_manufacturing: "Other manufacturing",
  printing_and_reproduction_of_recorded_media: "Printing & media",
};
{
  const HOT = 6, WILD = 20;
  const rows = Object.keys(G).map((k) => {
    const vals = G[k].data.map((d) => d.value);
    return { k, s: G[k], latest: vals.at(-1), wild: vals.some((v) => Math.abs(v) > WILD) };
  });
  const wild = rows.filter((r) => r.wild).sort((a, b) => b.latest - a.latest);
  const calm = rows.filter((r) => !r.wild).sort((a, b) => b.latest - a.latest);
  const hot = rows.filter((r) => Math.abs(r.latest) > HOT);

  function panel(target, r, domain) {
    const isHot = Math.abs(r.latest) > HOT;
    const col = isHot ? "#BE3E26" : "#5B564B";
    const el = document.createElement("div");
    el.className = "gm" + (isHot ? " hot" : "");
    el.innerHTML = `<div class="gm-h"><span class="gm-t" title="${r.s.label}">${SHORT[r.k] || r.s.label}</span><span class="gm-v">${fmtSigned(r.latest)}</span></div><div class="gm-p"></div>`;
    const p = Plot.plot({
      width: 260, height: 74,
      marginLeft: 2, marginRight: 6, marginTop: 4, marginBottom: 4,
      style: { background: "transparent" },
      x: { axis: null }, y: { axis: null, domain },
      marks: [
        Plot.ruleY([0], { stroke: "#E0DACA", strokeWidth: 1 }),
        Plot.lineY(r.s.data, { x: "date", y: "value", stroke: col, strokeWidth: isHot ? 1.5 : 1.2, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([r.s.data.at(-1)], { x: "date", y: "value", fill: col, r: 2 }),
      ],
    });
    p.setAttribute("aria-hidden", "true");
    el.querySelector(".gm-p").append(p);
    target.append(el);
  }
  const gw = document.getElementById("grid-wild"), gc = document.getElementById("grid-calm");
  wild.forEach((r) => panel(gw, r, [-50, 90]));
  calm.forEach((r) => panel(gc, r, [-12, 20]));
  setTxt("cap-wild", `The commodity rim — ${wild.length} groups whose y/y has left ±20% · shared axis −50 … +90`);
  setTxt("cap-calm", `The manufactured mass — ${calm.length} groups · shared axis −12 … +20`);
  setTxt("pf-nhot", String(hot.length));
  gw.setAttribute("role", "img");
  gw.setAttribute("aria-label", "Small-multiple grid of the " + wild.length + " most volatile WPI groups, year-on-year, 2016 to 2026, ranked by latest value. Hottest: " + (SHORT[wild[0].k] || wild[0].s.label) + " at " + wild[0].latest.toFixed(1) + " per cent.");
  gc.setAttribute("role", "img");
  gc.setAttribute("aria-label", "Small-multiple grid of the " + calm.length + " quieter WPI groups, year-on-year, 2016 to 2026, ranked by latest value. Hottest: " + (SHORT[calm[0].k] || calm[0].s.label) + " at " + calm[0].latest.toFixed(1) + " per cent.");

  setTxt("pv-groups", f1(wild[0].latest));
  setTxt("pc-groups", fmtDate(wild[0].s.data.at(-1).date) + " · " + (SHORT[wild[0].k] || wild[0].s.label) + " — hottest group");
  setTxt("ex-gcrude", f01(LG.crude_petroleum_natural_gas));
  setTxt("ex-goil", f01(LG.mineral_oils));
  setTxt("ex-gother", f01(LG.other_manufacturing));
  setTxt("ex-gtext", f01(LG.manufacture_of_textiles));
  setTxt("ex-gmet", f01(LG.manufacture_of_basic_metals));
  wireTools(document.getElementById("cb-groups"), null, [...wild, ...calm].map((r) => r.s), "india-atlas_wpi_29-groups_2016-2026");
}

/* ---------- §08 : the 134 sub-groups — extremes ledger ----------
 * Grid-vs-ledger decision: a 134-panel grid at this column width is postage
 * stamps — noise dressed as rigor. The ledger shows the 15 hottest and 15
 * coldest with full sparklines; the other 104 ship in the CSV, complete. */
{
  const all = Object.keys(SG).map((k) => {
    const d = SG[k].data;
    return { k, s: SG[k], latest: d.at(-1).value, prevV: d.at(-2).value, yr: d.at(-13).value };
  }).sort((a, b) => b.latest - a.latest || a.s.label.localeCompare(b.s.label));
  const top = all.slice(0, 15), bot = all.slice(-15);
  const shortLabel = (r) => r.s.label.replace(/^Manufacture of /, "").replace(/^./, (c) => c.toUpperCase());
  const row = (r, rank) => `
  <tr>
    <td class="name">${shortLabel(r)}<small>№ ${rank} of 134 · ${r.s.label}</small></td>
    <td class="val">${f1(r.latest)}</td>
    <td class="chg">${arrow(r.latest - r.prevV)} · ${word(r.latest - r.prevV)}</td>
    <td class="yr">${f1(r.yr)}</td>
    <td class="spark" id="sp-t${rank}"></td>
  </tr>`;
  const midCount = all.length - 30;
  document.getElementById("tail-body").innerHTML =
    top.map((r, i) => row(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="5">⋯ ${midCount} sub-groups between ${f1(top.at(-1).latest)} and ${f1(bot[0].latest)} — the full field ships in the CSV ⋯</td></tr>` +
    bot.map((r, i) => row(r, all.length - 14 + i)).join("");
  top.forEach((r, i) => spark("sp-t" + (i + 1), { ...r.s, color: "#5B564B" }));
  bot.forEach((r, i) => spark("sp-t" + (all.length - 14 + i), { ...r.s, color: "#5B564B" }));

  const vals = all.map((r) => r.latest);
  const median = (vals[66] + vals[67]) / 2;
  const negatives = vals.filter((v) => v < 0).length;
  setTxt("pv-tail", f1(top[0].latest));
  setTxt("pc-tail", fmtDate(top[0].s.data.at(-1).date) + " · " + shortLabel(top[0]).slice(0, 34) + " — hottest sub-group");
  setTxt("pf-tail", `cut lines — 15th hottest ${f1(top.at(-1).latest)}, 15th coldest ${f1(bot[0].latest)}`);
  setTxt("ex-tspan", (top[0].latest - bot.at(-1).latest).toFixed(1));
  setTxt("ex-ttopn", shortLabel(top[0]).toLowerCase());
  setTxt("ex-ttop", f01(top[0].latest));
  setTxt("ex-tbotn", shortLabel(bot.at(-1)).toLowerCase());
  setTxt("ex-tbot", f01(bot.at(-1).latest));
  setTxt("ex-tmed", f01(median));
  setTxt("ex-tneg", String(negatives));
  wireTools(document.getElementById("cb-tail"), null, Object.keys(SG).map((k) => SG[k]), "india-atlas_wpi_134-subgroups_2016-2026");
}

/* ---------- §09 : the 697 items — extremes ledger ----------
 * Same ledger-not-grid decision as §08, one level down. Items ranked by
 * latest y/y; lineage (group › sub-group › sub-sub-group) shown under each
 * name so a hot row traces back to the aggregate it feeds. The CSV is the
 * full latest-month cross-section: index level + y/y for every item. */
{
  const IM = itemsBundle.series; // carries lineage + latestIndex per item
  const allI = Object.keys(IT).map((k) => {
    const d = IT[k].data;
    return {
      k, s: IT[k], lineage: IM[k].lineage.split(" › ").slice(1).join(" › "),
      latest: d.at(-1).value, prevV: d.at(-2)?.value, yr: d.at(-13)?.value,
    };
  }).filter((r) => r.latest != null)
    .sort((a, b) => b.latest - a.latest || a.s.label.localeCompare(b.s.label));
  const nRanked = allI.length, nItems = Object.keys(IT).length;
  const topI = allI.slice(0, 15), botI = allI.slice(-15);
  const chgCell = (r) => r.prevV == null ? "—" : `${arrow(r.latest - r.prevV)} · ${word(r.latest - r.prevV)}`;
  const rowI = (r, rank) => `
  <tr>
    <td class="name">${r.s.label}<small>№ ${rank} of ${nRanked} · ${r.lineage}</small></td>
    <td class="val">${f1(r.latest)}</td>
    <td class="chg">${chgCell(r)}</td>
    <td class="yr">${r.yr == null ? "—" : f1(r.yr)}</td>
    <td class="spark" id="sp-i${rank}"></td>
  </tr>`;
  document.getElementById("items-body").innerHTML =
    topI.map((r, i) => rowI(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="5">⋯ ${nRanked - 30} items between ${f1(topI.at(-1).latest)} and ${f1(botI[0].latest)} — the full field ships in the CSV ⋯</td></tr>` +
    botI.map((r, i) => rowI(r, nRanked - 14 + i)).join("");
  const sparkData = (r) => ({ ...r.s, color: "#5B564B", data: r.s.data.filter((d) => d.value != null) });
  topI.forEach((r, i) => spark("sp-i" + (i + 1), sparkData(r)));
  botI.forEach((r, i) => spark("sp-i" + (nRanked - 14 + i), sparkData(r)));

  const valsI = allI.map((r) => r.latest);
  const medI = nRanked % 2 ? valsI[(nRanked - 1) / 2] : (valsI[nRanked / 2 - 1] + valsI[nRanked / 2]) / 2;
  const negI = valsI.filter((v) => v < 0).length;
  setTxt("pv-items", f1(topI[0].latest));
  setTxt("pc-items", fmtDate(topI[0].s.data.at(-1).date) + " · " + topI[0].s.label.slice(0, 34) + " — hottest item");
  setTxt("pf-items", `${nRanked} of ${nItems} items carry an April y/y · cut lines — 15th hottest ${f1(topI.at(-1).latest)}, 15th coldest ${f1(botI[0].latest)}`);
  setTxt("ex-ispan", (topI[0].latest - botI.at(-1).latest).toFixed(1));
  setTxt("ex-itopn", topI[0].s.label.toLowerCase());
  setTxt("ex-itop", f01(topI[0].latest));
  setTxt("ex-ibotn", botI.at(-1).s.label.toLowerCase());
  setTxt("ex-ibot", f01(botI.at(-1).latest));
  setTxt("ex-imed", f01(medI));
  setTxt("ex-ineg", String(negI));
  const itemLatest = (k) => IT[k]?.data.at(-1)?.value;
  setTxt("ex-ipetrol", f01(itemLatest("petrol")));
  setTxt("ex-iatf", f01(itemLatest("atf")));
  setTxt("ex-ihsd", f01(itemLatest("hsd")));
  setTxt("ex-ionion", f01(itemLatest("onion")));

  // cross-section CSV: one row per item, with lineage, latest index level and
  // the three y/y readings shown in the ledger. Labels carry commas — quoted.
  const q = (s) => '"' + String(s ?? "").replace(/"/g, '""') + '"';
  const ymTag = itemsBundle.meta.latestPeriod.replace("-", "");
  document.querySelector("#cb-items [data-dl=csv]").addEventListener("click", () => {
    const header = ["item", "lineage", `index_${ymTag}`, "yoy_pct", "yoy_prev_month_pct", "yoy_year_ago_pct"];
    const rows = Object.keys(IM).sort().map((k) => {
      const d = IT[k].data;
      return [q(IM[k].label), q(IM[k].lineage), IM[k].latestIndex ?? "",
        d.at(-1).value ?? "", d.at(-2)?.value ?? "", d.at(-13)?.value ?? ""];
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    saveBlob(new Blob([csv], { type: "text/csv" }), `india-atlas_wpi_697-items_cross-section_${itemsBundle.meta.latestPeriod}.csv`);
  });
}

/* ---------- ledger sparklines ---------- */
spark("nspark-head", S.headline);
for (const k of ["headline", "primary", "fuel", "manufactured", "food_index"]) spark("sp-" + k, S[k]);
for (const [k] of groupRows) spark("sp-g-" + k, { ...G[k], color: "#5B564B" });
for (const k of ["petrol", "gold_gold_ornaments", "onion"]) spark("sp-it-" + k, { ...IT[k], color: "#5B564B", data: IT[k].data.filter((d) => d.value != null) });

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", bundle.meta.vintage);
setTxt("prov-vintage2", bundle.meta.vintage);
