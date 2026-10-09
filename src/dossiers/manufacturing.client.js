// Dossier 13 · Manufacturing (World Bank WDI) — plate definitions and number wiring.
// Data: data/series/wdi-manufacturing.json (1960–2025), wdi-manufacturing-composition.json
// (1963–2023), wdi-manufacturing-tech.json (1990–2022), wdi-manufacturing-exports.json
// (1962–2024), baked at build time. The WDI is calendar-year and revises history freely —
// every figure on the page is computed from the bundles and the vintage is quoted with it.
// The constant-US$ level is displayed in billions (display conversion only, never in data).

import * as Plot from "@observablehq/plot";
import wdiBundle from "../../data/series/wdi-manufacturing.json";
import compBundle from "../../data/series/wdi-manufacturing-composition.json";
import techBundle from "../../data/series/wdi-manufacturing-tech.json";
import expBundle from "../../data/series/wdi-manufacturing-exports.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  peakOf, troughOf, dodgeEndLabels, spark, makePlacer, annotationSpot,
} from "../charts/plumbing.js";

const S = hydrate(wdiBundle);       // mva_pct_gdp, industry_pct_gdp, mva_constant_usd, mva_growth
const C = hydrate(compBundle);      // five UNIDO shares, summing to ~100
const T = hydrate(techBundle);      // medhi_tech_share
const X = hydrate(expBundle);       // manufactures_share_of_exports

/* ---------- formatters ---------- */
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
const pc = (u) => `<span class="pc">${u}</span>`;
const f1 = (v) => v.toFixed(1) + "%";
const fS = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
const bn = (v) => "$" + Math.round(v / 1e9) + " bn"; // raw US$ → display billions
const pt = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt";
const yr = (d) => String(d.getUTCFullYear());
const fmtY = (d) => yr(d);
const nn = (s) => s.data.filter((d) => d.value != null);
const lastP = (s) => nn(s).at(-1);
const firstP = (s) => nn(s)[0];

const shareL = lastP(S.mva_pct_gdp), shareF = firstP(S.mva_pct_gdp);
const indL = lastP(S.industry_pct_gdp);
const levelL = lastP(S.mva_constant_usd), levelF = firstP(S.mva_constant_usd);
const growthL = lastP(S.mva_growth), growthP = nn(S.mva_growth).at(-2);
const techL = lastP(T.medhi_tech_share), techP = nn(T.medhi_tech_share).at(-2), techF = firstP(T.medhi_tech_share);
const expL = lastP(X.manufactures_share_of_exports), expP = nn(X.manufactures_share_of_exports).at(-2), expF = firstP(X.manufactures_share_of_exports);
const sharePk = peakOf(S.mva_pct_gdp), shareTr = troughOf(S.mva_pct_gdp);
const growthPk = peakOf(S.mva_growth), growthTr = troughOf(S.mva_growth);
const expPk = peakOf(X.manufactures_share_of_exports);
const techPk = peakOf(T.medhi_tech_share), techTr = troughOf(T.medhi_tech_share);

/* ---------- titleblock ---------- */
setTxt("meta-vintage", wdiBundle.meta.vintage);
setHTML("n-share", f1(shareL.value).replace("%", pc("%")));
setHTML("d-share", `<b>${pt(shareL.value - shareF.value)}</b> vs 1960, peak ${f1(sharePk.value)} (${yr(sharePk.date)})`);
setTxt("n-level", bn(levelL.value));
setHTML("d-level", `<b>▲ ×${(levelL.value / levelF.value).toFixed(1)}</b> since 1960 (${bn(levelF.value)})`);
setHTML("n-growth", f1(growthL.value).replace("%", pc("%")));
setHTML("d-growth", `<b>${pt(growthL.value - growthP.value)}</b> vs ${yr(growthP.date)}`);
setHTML("n-tech", f1(techL.value).replace("%", pc("%")));
setHTML("d-tech", `<b>${pt(techL.value - techP.value)}</b> vs ${yr(techP.date)}, series ends ${yr(techL.date)} (UNIDO lag)`);
spark("nspark-share", S.mva_pct_gdp);

/* ---------- § 01 current reading ---------- */
setHTML("cr-share", f1(shareL.value).replace("%", pc("%")));
setHTML("rb-peak", f1(sharePk.value).replace("%", pc("%")));
setTxt("cr-share2", f1(shareL.value));
setTxt("cr-share-2024", f1(nn(S.mva_pct_gdp).at(-2).value));
setTxt("cr-industry", f1(indL.value));
setTxt("cr-level", bn(levelL.value));
setTxt("cr-level-1960", bn(levelF.value));
setTxt("cr-growth", f1(growthL.value));
setTxt("cr-growth-2024", f1(growthP.value));
setTxt("cr-exports", f1(expL.value));
setTxt("cr-mach", f1(lastP(C.machinery_transport).value));
setTxt("cr-tex", f1(lastP(C.textiles_clothing).value));
  setTxt("cr-tech", f1(techL.value));

/* ---------- § 02 register ---------- */
const regRows = [
  [S.mva_pct_gdp, "Manufacturing value added, share of GDP", "WDI, ISIC C, national accounts", "s-acc", "#2E4BD8", f1],
  [S.industry_pct_gdp, "Industry incl. construction, share of GDP", "WDI, adds mining, utilities, construction", "s-g1", "#878D99", f1],
  [S.mva_constant_usd, "Manufacturing value added, constant 2015 US$", "WDI, volumes at the 2015 exchange rate", "s-g2", "#5F6675", bn],
  [S.mva_growth, "Manufacturing value added, annual growth", "WDI, real, y/y", "s-g3", "#A3A9B4", fS],
  [C.machinery_transport, "Machinery & transport, share of MVA", "UNIDO, technology decomposition", "s-acc", "#2E4BD8", f1],
  [C.chemicals, "Chemicals, share of MVA", "UNIDO, technology decomposition", "s-g1", "#5F6675", f1],
  [C.food_beverages_tobacco, "Food, beverages & tobacco, share of MVA", "UNIDO, technology decomposition", "s-g2", "#878D99", f1],
  [C.textiles_clothing, "Textiles & clothing, share of MVA", "UNIDO, technology decomposition", "s-g3", "#A3A9B4", f1],
  [C.other, "Other manufacturing, share of MVA", "UNIDO, the residual block", "s-g4", "#C9CED6", f1],
  [T.medhi_tech_share, "Medium- & high-tech, share of MVA", "UNIDO, ends 2022", "s-acc", "#2E4BD8", f1],
  [X.manufactures_share_of_exports, "Manufactures, share of merchandise exports", "UN Comtrade, SITC 5–8, ends 2024", "s-acc", "#2E4BD8", f1],
];
const regEl = document.getElementById("reg-manufacturing");
if (regEl) {
  regEl.innerHTML = regRows.map(([s, nm, sub, sw, col, f], i) => {
    const d = nn(s), l = d.at(-1), p = d.at(-2), f0 = d[0];
    return `<tr><td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>` +
      `<td class="val">${f(l.value)}, ${yr(l.date)}</td>` +
      `<td class="chg">${p ? f(p.value) + " · " + yr(p.date) : "—"}</td>` +
      `<td class="yr">${f(f0.value)}, ${yr(f0.date)}</td>` +
      `<td class="spark" id="sp-wm${i}"></td></tr>`;
  }).join("");
  regRows.forEach(([s, , , , col], i) => spark(`sp-wm${i}`, { ...s, color: col }));
}

/* ---------- shared plate helpers ---------- */
const pcFmt = (v) => (v == null ? "—" : v.toFixed(1) + "%");
function endLabelMark(s, fmt, fontSize = 14) {
  const l = lastP(s);
  return Plot.text([l], { x: "date", y: "value", text: () => fmt(l.value), dx: 16, fill: "#161A22", fontSize, fontFamily: mono, fontWeight: 500, textAnchor: "start" });
}

/* ---------- § 03 plate 1 : the share (headline) ---------- */
{
  const store = {
    mva_pct_gdp: { ...S.mva_pct_gdp, label: "Manufacturing", color: "#2E4BD8" },
    industry_pct_gdp: { ...S.industry_pct_gdp, label: "Industry", color: "#878D99" },
  };
  const keys = ["mva_pct_gdp", "industry_pct_gdp"];
  const seriesList = keys.map((k) => store[k]);
  const dates = S.mva_pct_gdp.data.map((d) => d.date);
  const covid = new Date(Date.UTC(2020, 0, 1));
  const geo = { W: 1184, H: 560, ml: 70, mr: 230, mt: 36, mb: 48, d0: 10, d1: 34 };
  const yTicks = [10, 15, 20, 25, 30];
  const xTicks = [1960, 1970, 1980, 1990, 2000, 2010, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.05);
  /* collision-aware annotations: both lines, the COVID rule and the dodged
   * end labels are obstacles (lint-charts.mjs verifies the same geometry) */
  const placer = makePlacer(geo, dates);
  keys.forEach((k) => placer.addSeries(store[k].data));
  placer.addRuleX(covid);
  for (const p of dodged) placer.addObstacleBox(placer.box({ x: dates.at(-1), y: p.y, anchor: "start", dx: 16 }, `${p.s.label} ${f1(p.value)}`, 14.5));
  const pkText = f1(sharePk.value) + ", " + yr(sharePk.date) + ", the peak";
  const pkA = annotationSpot(placer, sharePk, pkText, 13, [
    { x: sharePk.date, y: sharePk.value, anchor: "middle", dx: 0, dy: -40 },
    { x: sharePk.date, y: sharePk.value, anchor: "start", dx: 20, dy: -28 },
    { x: sharePk.date, y: sharePk.value, anchor: "end", dx: -20, dy: -28 },
    { x: sharePk.date, y: sharePk.value, anchor: "middle", dx: 0, dy: 46 },
  ]);
  placer.addObstacleBox(pkA.box);
  const covidSpot = placer.place("COVID-19", 12, [
    { x: covid, y: 33, anchor: "start", dx: 10, dy: 0 },
    { x: covid, y: 33, anchor: "end", dx: -10, dy: 0 },
    { x: covid, y: 21, anchor: "start", dx: 10, dy: 0 },
  ]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ per cent of GDP", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleX([covid], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: covidSpot.x, value: covidSpot.y }], { x: "date", y: "value", text: ["COVID-19"], dx: covidSpot.dx ?? 0, fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: covidSpot.anchor }),
      Plot.lineY(store.industry_pct_gdp.data, { x: "date", y: "value", stroke: store.industry_pct_gdp.color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(store.mva_pct_gdp.data, { x: "date", y: "value", stroke: store.mva_pct_gdp.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(store.mva_pct_gdp.data.slice(-13), { x: "date", y: "value", stroke: store.mva_pct_gdp.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([sharePk], { x: "date", y: "value", fill: store.mva_pct_gdp.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(pkA.leader, { x: "x", y: "y", stroke: store.mva_pct_gdp.color, strokeWidth: 1 }),
      Plot.text([{ date: pkA.textX, value: pkA.textY }], { x: "date", y: "value", text: [pkText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: pkA.spot.anchor }),
      ...seriesList.map((s) => Plot.dot([lastP(s)], { x: "date", y: "value", fill: s.color, r: s === store.mva_pct_gdp ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${f1(p.value)}`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === store.mva_pct_gdp ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  a11y(plot, "Manufacturing and industry value added, per cent of GDP, India, 1960 to 2025",
    "Line chart. Manufacturing (blue) ends at " + f1(shareL.value) + " in 2025, below its 1960 level of " + f1(shareF.value) + " and its 1995 peak of " + f1(sharePk.value) + ". Industry including construction (grey) ends at " + f1(indL.value) + ".");
  document.getElementById("plot-share")?.append(plot);
  wireTools(document.getElementById("cb-share"), plot, seriesList, "india-atlas_manufacturing_mva-share_1960-2025", fmtY);
  wireLegend(document.getElementById("legend-share"), plot, keys, store);
  addCrosshair(document.getElementById("plot-share"), plot, seriesList, geo, fmtY, pcFmt);
  setHTML("pv-share", f1(shareL.value).replace("%", pc("%")));
  setTxt("ex-share-peak", f1(sharePk.value));
  setTxt("ex-share-low", f1(shareTr.value));
  setTxt("ex-share-now", f1(shareL.value));
  setTxt("ex-share-ind", f1(indL.value));
  setTxt("ex-share-1960", f1(shareF.value));
  setTxt("src-vintage-share", wdiBundle.meta.vintage);
}

/* ---------- § 04 plate 2 : the level (constant 2015 US$ bn) ---------- */
{
  // display conversion to billions — the baked data stays in raw US$
  const s = {
    ...S.mva_constant_usd, name: "mva_constant_2015_usd_bn", label: "MVA, constant 2015 US$ bn", color: "#2E4BD8",
    data: S.mva_constant_usd.data.map((d) => ({ date: d.date, value: d.value == null ? null : d.value / 1e9 })),
  };
  const dates = s.data.map((d) => d.date);
  const geo = { W: 1184, H: 470, ml: 70, mr: 150, mt: 30, mb: 48, d0: 0, d1: 660 };
  const yTicks = [0, 150, 300, 450, 600];
  const xTicks = [1960, 1970, 1980, 1990, 2000, 2010, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ constant 2015 US$, billions", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => "$" + String(d) + " bn", ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.areaY(s.data, { x: "date", y: "value", y1: 0, fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-13), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([lastP(s)], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      endLabelMark(s, (v) => "$" + Math.round(v) + " bn"),
    ],
  });
  a11y(plot, "Manufacturing value added in constant 2015 US dollars, India, 1960 to 2025",
    "Line chart rising from " + bn(levelF.value) + " in 1960 to " + bn(levelL.value) + " in 2025: a " + (levelL.value / levelF.value).toFixed(1) + "-fold multiplication, displayed in billions.");
  document.getElementById("plot-level")?.append(plot);
  wireTools(document.getElementById("cb-level"), plot, [s], "india-atlas_manufacturing_mva-level-bn_1960-2025", fmtY);
  addCrosshair(document.getElementById("plot-level"), plot, [s], geo, fmtY, (v) => (v == null ? "—" : "$" + Math.round(v) + " bn"));
  setTxt("pv-level", bn(levelL.value));
  setTxt("ex-level-first", bn(levelF.value));
  setTxt("ex-level-now", bn(levelL.value));
  setTxt("ex-level-mult", (levelL.value / levelF.value).toFixed(1) + "-fold");
  setTxt("src-vintage-level", wdiBundle.meta.vintage);
}

/* ---------- § 05 plate 3 : growth ---------- */
{
  const s = { ...S.mva_growth, label: "MVA growth", color: "#2E4BD8" };
  const dates = s.data.map((d) => d.date);
  const covid = new Date(Date.UTC(2020, 0, 1));
  const dip2019 = s.data.find((d) => yr(d.date) === "2019");
  const geo = { W: 1184, H: 470, ml: 70, mr: 110, mt: 30, mb: 48, d0: -6, d1: 20 };
  const yTicks = [-5, 0, 5, 10, 15];
  const xTicks = [1960, 1970, 1980, 1990, 2000, 2010, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const placer = makePlacer(geo, dates);
  placer.addSeries(s.data).addRuleY(0).addRuleX(covid);
  const trText = fS(growthTr.value) + ", " + yr(growthTr.date) + ", the deepest fall";
  const trA = annotationSpot(placer, growthTr, trText, 13, [
    { x: growthTr.date, y: growthTr.value, anchor: "middle", dx: 0, dy: -36 },
    { x: growthTr.date, y: growthTr.value, anchor: "start", dx: 20, dy: -24 },
    { x: growthTr.date, y: growthTr.value, anchor: "middle", dx: 0, dy: 44 },
  ]);
  placer.addObstacleBox(trA.box);
  const dipText = fS(dip2019.value) + ", 2019";
  const dipA = annotationSpot(placer, dip2019, dipText, 13, [
    { x: dip2019.date, y: dip2019.value, anchor: "middle", dx: 0, dy: -36 },
    { x: dip2019.date, y: dip2019.value, anchor: "end", dx: -18, dy: -26 },
    { x: dip2019.date, y: dip2019.value, anchor: "start", dx: 18, dy: -26 },
    { x: dip2019.date, y: dip2019.value, anchor: "middle", dx: 0, dy: 40 },
  ]);
  placer.addObstacleBox(dipA.box);
  const covidSpot = placer.place("COVID-19", 12, [
    { x: covid, y: 19, anchor: "start", dx: 10, dy: 0 },
    { x: covid, y: 19, anchor: "end", dx: -10, dy: 0 },
    { x: covid, y: 13, anchor: "start", dx: 10, dy: 0 },
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
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      Plot.ruleX([covid], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: covidSpot.x, value: covidSpot.y }], { x: "date", y: "value", text: ["COVID-19"], dx: covidSpot.dx ?? 0, fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: covidSpot.anchor }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-13), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([growthTr], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(trA.leader, { x: "x", y: "y", stroke: s.color, strokeWidth: 1 }),
      Plot.text([{ date: trA.textX, value: trA.textY }], { x: "date", y: "value", text: [trText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: trA.spot.anchor }),
      Plot.dot([dip2019], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(dipA.leader, { x: "x", y: "y", stroke: s.color, strokeWidth: 1 }),
      Plot.text([{ date: dipA.textX, value: dipA.textY }], { x: "date", y: "value", text: [dipText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: dipA.spot.anchor }),
      Plot.dot([lastP(s)], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      endLabelMark(s, f1),
    ],
  });
  a11y(plot, "Manufacturing value added, annual growth, India, 1961 to 2025",
    "Line chart with a strong zero rule. Growth ends at " + f1(growthL.value) + " in 2025. The deepest fall is " + fS(growthTr.value) + " in " + yr(growthTr.date) + "; the pandemic stretch reads as a whipsaw, not a single crash.");
  document.getElementById("plot-growth")?.append(plot);
  wireTools(document.getElementById("cb-growth"), plot, [s], "india-atlas_manufacturing_mva-growth_1961-2025", fmtY);
  addCrosshair(document.getElementById("plot-growth"), plot, [s], geo, fmtY, (v) => (v == null ? "—" : fS(v)));
  setHTML("pv-growth", f1(growthL.value).replace("%", pc("%")));
  setTxt("ex-growth-trough", fS(growthTr.value) + " in " + yr(growthTr.date));
  setTxt("ex-growth-peak", "+" + f1(growthPk.value));
  setTxt("ex-growth-whipsaw", [2019, 2020, 2021, 2022, 2023].map((y) => {
    const p = s.data.find((d) => yr(d.date) === String(y));
    return (p.value < 0 ? "−" : "+") + Math.abs(p.value).toFixed(1);
  }).join(" → "));
  setTxt("ex-growth-latest", f1(growthL.value));
  setTxt("src-vintage-growth", wdiBundle.meta.vintage);
}

/* ---------- § 06 plate 4 : composition ---------- */
{
  const store = {
    machinery_transport: { ...C.machinery_transport, label: "Machinery & transport", color: "#2E4BD8" },
    chemicals: { ...C.chemicals, label: "Chemicals", color: "#5F6675" },
    food_beverages_tobacco: { ...C.food_beverages_tobacco, label: "Food & tobacco", color: "#878D99" },
    textiles_clothing: { ...C.textiles_clothing, label: "Textiles & clothing", color: "#A3A9B4" },
    other: { ...C.other, label: "Other mfg", color: "#C9CED6" },
  };
  const keys = ["machinery_transport", "chemicals", "food_beverages_tobacco", "textiles_clothing", "other"];
  const seriesList = keys.map((k) => store[k]);
  const dates = store.machinery_transport.data.map((d) => d.date);
  const geo = { W: 1184, H: 470, ml: 70, mr: 260, mt: 30, mb: 48, d0: 0, d1: 60 };
  const yTicks = [0, 15, 30, 45, 60];
  const xTicks = [1970, 1980, 1990, 2000, 2010, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * 0.05);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ share of manufacturing value added, per cent", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([0], { stroke: "#161A22", strokeOpacity: 0.55, strokeWidth: 1 }),
      ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(store.machinery_transport.data, { x: "date", y: "value", stroke: store.machinery_transport.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...seriesList.map((s) => Plot.dot([lastP(s)], { x: "date", y: "value", fill: s.color, r: s === store.machinery_transport ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      ...dodged.filter((p) => Math.abs(p.y - p.value) > 0.05).map((p) => Plot.line([
        { x: dates.at(-1), y: p.value }, { x: dates.at(-1), y: p.y },
      ], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
      ...dodged.map((p) => Plot.text([{ date: dates.at(-1), y: p.y }], {
        x: "date", y: "y", text: () => `${p.s.label} ${f1(p.value)}`,
        dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono,
        fontWeight: p.s === store.machinery_transport ? 500 : 400, textAnchor: "start",
      })),
    ],
  });
  const chemPk = peakOf(C.chemicals);
  a11y(plot, "Composition of manufacturing value added by UNIDO technology group, India, 1963 to 2023",
    "Five lines summing to 100. Machinery and transport (blue) ends at " + f1(lastP(C.machinery_transport).value) + ", its highest share on record; textiles and clothing ends at " + f1(lastP(C.textiles_clothing).value) + ", down from " + f1(firstP(C.textiles_clothing).value) + " in 1963.");
  document.getElementById("plot-composition")?.append(plot);
  wireTools(document.getElementById("cb-composition"), plot, seriesList, "india-atlas_manufacturing_unido-composition_1963-2023", fmtY);
  wireLegend(document.getElementById("legend-composition"), plot, keys, store);
  addCrosshair(document.getElementById("plot-composition"), plot, seriesList, geo, fmtY, pcFmt);
  setHTML("pv-composition", f1(lastP(C.machinery_transport).value).replace("%", pc("%")));
  setTxt("ex-comp-tex0", f1(firstP(C.textiles_clothing).value));
  setTxt("ex-comp-tex", f1(lastP(C.textiles_clothing).value));
  setTxt("ex-comp-mach0", f1(firstP(C.machinery_transport).value));
  setTxt("ex-comp-mach", f1(lastP(C.machinery_transport).value));
  setTxt("ex-comp-chem-peak", f1(chemPk.value));
  setTxt("ex-comp-mach2", f1(lastP(C.machinery_transport).value));
  setTxt("ex-comp-chem", f1(lastP(C.chemicals).value));
  setTxt("ex-comp-food", f1(lastP(C.food_beverages_tobacco).value));
  setTxt("ex-comp-tex2", f1(lastP(C.textiles_clothing).value));
  setTxt("ex-comp-other", f1(lastP(C.other).value));
  setTxt("src-vintage-composition", compBundle.meta.vintage);
}

/* ---------- § 07 plate 5 : exports ---------- */
{
  const s = { ...X.manufactures_share_of_exports, label: "Manufactures' share of exports", color: "#2E4BD8" };
  const dates = s.data.map((d) => d.date);
  const geo = { W: 1184, H: 470, ml: 70, mr: 120, mt: 30, mb: 48, d0: 35, d1: 85 };
  const yTicks = [40, 50, 60, 70, 80];
  const xTicks = [1970, 1980, 1990, 2000, 2010, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const placer = makePlacer(geo, dates);
  placer.addSeries(s.data);
  const pkText = f1(expPk.value) + ", " + yr(expPk.date) + ", the peak";
  const pkA = annotationSpot(placer, expPk, pkText, 13, [
    { x: expPk.date, y: expPk.value, anchor: "middle", dx: 0, dy: 40 },
    { x: expPk.date, y: expPk.value, anchor: "start", dx: 20, dy: 26 },
    { x: expPk.date, y: expPk.value, anchor: "end", dx: -20, dy: 26 },
    { x: expPk.date, y: expPk.value, anchor: "middle", dx: 0, dy: -44 },
  ]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ per cent of merchandise exports", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      // the domain excludes zero, so the wash anchors at the floor — an area
      // anchored at 0 renders below the plot (overflow:"visible" never clips)
      Plot.areaY(s.data, { x: "date", y: "value", y1: geo.d0, fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-13), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([expPk], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(pkA.leader, { x: "x", y: "y", stroke: s.color, strokeWidth: 1 }),
      Plot.text([{ date: pkA.textX, value: pkA.textY }], { x: "date", y: "value", text: [pkText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: pkA.spot.anchor }),
      Plot.dot([lastP(s)], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      endLabelMark(s, f1),
    ],
  });
  a11y(plot, "Manufactures' share of merchandise exports, India, 1962 to 2024",
    "Line chart rising from " + f1(expF.value) + " in 1962 to a peak of " + f1(expPk.value) + " in " + yr(expPk.date) + ", ending at " + f1(expL.value) + " in 2024.");
  document.getElementById("plot-exports")?.append(plot);
  wireTools(document.getElementById("cb-exports"), plot, [s], "india-atlas_manufacturing_manufactures-exports_1962-2024", fmtY);
  addCrosshair(document.getElementById("plot-exports"), plot, [s], geo, fmtY, pcFmt);
  setHTML("pv-exports", f1(expL.value).replace("%", pc("%")));
  setTxt("ex-exp-first", f1(expF.value));
  setTxt("ex-exp-peak", f1(expPk.value));
  setTxt("ex-exp-now", f1(expL.value));
  setTxt("ex-exp-prev", f1(expP.value));
  setTxt("src-vintage-exports", expBundle.meta.vintage);
}

/* ---------- § 08 plate 6 : technology ---------- */
{
  const s = { ...T.medhi_tech_share, label: "Medium- & high-tech share", color: "#2E4BD8" };
  const dates = s.data.map((d) => d.date);
  const geo = { W: 1184, H: 470, ml: 70, mr: 120, mt: 30, mb: 48, d0: 30, d1: 50 };
  const yTicks = [30, 35, 40, 45, 50];
  const xTicks = [1990, 1995, 2000, 2005, 2010, 2015, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const placer = makePlacer(geo, dates);
  placer.addSeries(s.data);
  const pkText = f1(techPk.value) + ", " + yr(techPk.date) + ", the spike";
  const pkA = annotationSpot(placer, techPk, pkText, 13, [
    { x: techPk.date, y: techPk.value, anchor: "middle", dx: 0, dy: 38 },
    { x: techPk.date, y: techPk.value, anchor: "start", dx: 20, dy: 24 },
    { x: techPk.date, y: techPk.value, anchor: "end", dx: -20, dy: 24 },
    { x: techPk.date, y: techPk.value, anchor: "middle", dx: 0, dy: -42 },
  ]);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 16, ticks: xTicks, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ per cent of manufacturing value added", labelAnchor: "top", labelArrow: false,
         tickFormat: (d) => (d === yTicks[yTicks.length - 1] ? d + "%" : String(d)), ticks: yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      // the domain excludes zero, so the wash anchors at the floor — an area
      // anchored at 0 renders below the plot (overflow:"visible" never clips)
      Plot.areaY(s.data, { x: "date", y: "value", y1: geo.d0, fill: s.color, fillOpacity: 0.06 }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(s.data.slice(-13), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([techPk], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.line(pkA.leader, { x: "x", y: "y", stroke: s.color, strokeWidth: 1 }),
      Plot.text([{ date: pkA.textX, value: pkA.textY }], { x: "date", y: "value", text: [pkText], fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: pkA.spot.anchor }),
      Plot.dot([lastP(s)], { x: "date", y: "value", fill: s.color, r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      endLabelMark(s, (v) => f1(v) + ", 2022"),
    ],
  });
  a11y(plot, "Medium- and high-technology share of manufacturing value added, India, 1990 to 2022",
    "Line chart. The share opened the 1990s at " + f1(techF.value) + ", spiked to " + f1(techPk.value) + " in " + yr(techPk.date) + ", troughed at " + f1(techTr.value) + " in " + yr(techTr.date) + ", and ends at " + f1(techL.value) + " in 2022, where the series stops.");
  document.getElementById("plot-tech")?.append(plot);
  wireTools(document.getElementById("cb-tech"), plot, [s], "india-atlas_manufacturing_medhi-tech_1990-2022", fmtY);
  addCrosshair(document.getElementById("plot-tech"), plot, [s], geo, fmtY, pcFmt);
  setHTML("pv-tech", f1(techL.value).replace("%", pc("%")));
  setTxt("ex-tech-first", f1(techF.value));
  setTxt("ex-tech-peak", f1(techPk.value));
  setTxt("ex-tech-trough", f1(techTr.value));
  setTxt("ex-tech-now", f1(techL.value));
  setTxt("ex-tech-prev", f1(techP.value));
  setTxt("src-vintage-tech", techBundle.meta.vintage);
}

/* ---------- provenance vintage — driven from the baked bundle, never hardcoded ---------- */
setTxt("prov-vintage", wdiBundle.meta.vintage);
setTxt("prov-vintage2", wdiBundle.meta.vintage);
