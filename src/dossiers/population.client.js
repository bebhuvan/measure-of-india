// Guide: population. Plates and number wiring.
// Data: data/series/population-wpp*.json (UN World Population Prospects 2024, baked by
// scripts/lib/products/wpp.mjs) and population-wdi*.json (World Bank WDI, wdi-india.mjs).
// Two instruments are never joined: the UN's estimates (1950-2023) are solid lines, its
// projections (2024-2100) are dashed or pale and always labelled as projections.
// Populations arrive in thousands; the page shows crore, million or billion (display only).

import * as Plot from "@observablehq/plot";
import estB from "../../data/series/population-wpp.json";
import projB from "../../data/series/population-wpp-projection.json";
import varB from "../../data/series/population-wpp-variants.json";
import ageB from "../../data/series/population-wpp-age.json";
import ageProjB from "../../data/series/population-wpp-age-projection.json";
import urbB from "../../data/series/population-wdi-urban.json";
import migB from "../../data/series/population-wdi-migration.json";
import { MONO as sans, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob } from "../charts/plumbing.js";

/* ---------- shared ---------- */
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const ACC = "#2E4BD8", ACC_SOFT = "#B9C3F3", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", BAND = "#E7EBFC", BAND2 = "#F4F6FD";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const Y = (y) => new Date(Date.UTC(y, 0, 1));
const yearOf = (iso) => Number(iso.slice(0, 4));
/** [{date, value}] of one series, nulls dropped; `scale` converts units for display */
const pts = (b, k, scale = 1) => b.dates.map((d, i) => ({ date: new Date(d + "T00:00:00Z"), year: yearOf(d), value: b.series[k].data[i] == null ? null : b.series[k].data[i] * scale })).filter((p) => p.value != null);
const at = (b, k, y) => { const i = b.dates.indexOf(`${y}-01-01`); return i < 0 ? null : b.series[k].data[i]; };
const lastOf = (b, k) => pts(b, k).at(-1);
const both = (k, scale = 1) => [...pts(estB, k, scale), ...pts(projB, k, scale)];
const est0 = yearOf(estB.dates[0]), estN = yearOf(estB.dates.at(-1)), projN = yearOf(projB.dates.at(-1));
const bn = (thousands) => (thousands / 1e6).toFixed(3) + " billion";
const bn2 = (thousands) => (thousands / 1e6).toFixed(2) + " billion";
const crore = (thousands) => (thousands / 1e4).toFixed(1) + " crore";
const mn = (thousands) => (thousands / 1e3).toFixed(1) + " million";
const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);
const peak = (arr) => arr.reduce((a, p) => (p.value > a.value ? p : a));
const low = (arr) => arr.reduce((a, p) => (p.value < a.value ? p : a));
const yearTicks = (a, b, step) => { const t = []; for (let y = Math.ceil(a / step) * step; y <= b; y += step) t.push(Y(y)); return t; };
const yearFmt = (d) => String(d.getUTCFullYear());

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  if (!el) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
const csvOf = (header, rows) => header.join(",") + "\n" + rows.map((r) => r.map((v) => (v == null ? "" : typeof v === "string" && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n");

/* ---------- headline figures ---------- */
const popE = pts(estB, "tpopulation1july"), popP = pts(projB, "tpopulation1july");
const popL = popE.at(-1), popPrev = popE.at(-2);
const thisYear = new Date().getUTCFullYear();
const popNowProj = popP.find((p) => p.year === Math.min(Math.max(thisYear, popP[0].year), projN));
const popPeak = peak(popP);
const age = (k) => [...pts(ageB, k), ...pts(ageProjB, k)];
const waShare = age("share_15_64"), waPeak = peak(waShare), waL = pts(ageB, "share_15_64").at(-1);
const tfrAll = both("tfr"), tfrL = lastOf(estB, "tfr");
const tfrBelow = tfrAll.find((p) => p.value < 2.1);
const medL = lastOf(estB, "medianagepop"), med0 = pts(estB, "medianagepop")[0];

setHTML("m-latest", String(estN));
setHTML("u-reading", `UN WPP 2024 estimate for ${estN}, mid-year`);
setHTML("n-pop", (popL.value / 1e6).toFixed(3) + pc(" billion"));
setHTML("d-pop", `<b>+${mn(popL.value - popPrev.value)}</b> on ${popPrev.year}`);
setHTML("n-age", f1(medL.value) + pc(" years"));
setHTML("d-age", `<b>${f1(med0.value)}</b> in ${med0.year}`);
setHTML("n-tfr", f2(tfrL.value));
setHTML("d-tfr", `below 2.1 since <b>${tfrBelow.year}</b>`);
setHTML("n-wa", f1(waL.value) + pc("%"));
setHTML("d-wa", `peaks at <b>${f1(waPeak.value)}%</b> in ${waPeak.year} (projection)`);
spark("nspark-pop", { data: popE, color: ACC });

/* ---------- § 01 the current reading ---------- */
setHTML("rb-pop", (popL.value / 1e6).toFixed(3) + pc(" billion"));
setHTML("rb-proj", (popNowProj.value / 1e6).toFixed(3) + pc(" billion"));
setHTML("rb-proj-year", `Projected for ${popNowProj.year}`);
setHTML("cr-crore", crore(popL.value));

/* ---------- line chart over estimates and projections ---------- */
// series: [{ data, color, width, dash, label, labelAt: "end"|null, fmt }]
function lineChart(el, { series, yDomain, yTicks, yFmt, yLabel, x0, x1, xStep = 25, height = 460, bands = [], rules = [], notes = [], mr = 170, ml = 52, estRule = true }) {
  const marks = [Plot.gridY(yTicks.slice(1), { stroke: GRID })];
  for (const b of bands) marks.push(Plot.areaY(b.data, { x: "date", y1: "lo", y2: "hi", fill: b.fill }));
  marks.push(Plot.ruleY([yDomain[0]], { stroke: BASE }));
  for (const r of rules) marks.push(Plot.ruleY([r.y], { stroke: r.color ?? "#B5BAC4", strokeDasharray: "3 3" }));
  if (estRule) marks.push(Plot.ruleX([Y(estN)], { stroke: "#DFE2E8" }));   // where the UN's estimates end
  for (const s of series) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 1.75, strokeDasharray: s.dash ?? null, strokeLinejoin: "round", strokeLinecap: "round" }));
  for (const s of series.filter((x) => x.endLabel)) {
    const e = s.data.at(-1);
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: s.color, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: () => s.endLabel, dx: 10, dy: s.endDy ?? 0, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: s.bold ? 600 : 400 }));
  }
  for (const n of notes) {
    if (n.dot) marks.push(Plot.dot([n], { x: "date", y: "value", fill: n.color ?? ACC, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }));
    if (n.text) marks.push(Plot.text([n], { x: "date", y: "value", text: () => n.text, dx: n.dx ?? 0, dy: n.dy ?? -12, textAnchor: n.anchor ?? "middle", fill: n.fill ?? INK, fontSize: 12, fontWeight: n.bold ? 600 : 400, lineWidth: n.lineWidth ?? 30 }));
  }
  const plot = Plot.plot({
    width: W, height, marginLeft: ml, marginRight: mr, marginTop: 34, marginBottom: 34, style: baseStyle,
    x: { type: "utc", domain: [Y(x0), Y(x1)], ticks: yearTicks(x0, x1, xStep), tickFormat: yearFmt, tickSize: 0, tickPadding: 12, label: null },
    y: { domain: yDomain, ticks: yTicks, tickFormat: yFmt, tickSize: 0, tickPadding: 10, label: yLabel, labelAnchor: "top", labelArrow: false },
    marks,
  });
  document.getElementById(el).append(plot);
  return plot;
}

/* ---------- § 02 the long curve ---------- */
{
  const v = (k) => pts(varB, k);
  const lo95 = v("tpopulation1july__lower_95_pi"), hi95 = v("tpopulation1july__upper_95_pi");
  const lo80 = v("tpopulation1july__lower_80_pi"), hi80 = v("tpopulation1july__upper_80_pi");
  const band = (lo, hi) => lo.map((p, i) => ({ date: p.date, lo: p.value / 1e6, hi: hi[i].value / 1e6 }));
  const E = popE.map((p) => ({ ...p, value: p.value / 1e6 }));
  const P = popP.map((p) => ({ ...p, value: p.value / 1e6 }));   // the projection alone: never joined to the estimates
  const pk = { date: popPeak.date, value: popPeak.value / 1e6 };
  const plot = lineChart("plot-curve", {
    x0: est0, x1: projN, yDomain: [0, 2.4], yTicks: [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4], yFmt: (x) => x.toFixed(1), yLabel: "people, billion", height: 500, mr: 200,
    bands: [{ data: band(lo95, hi95), fill: BAND2 }, { data: band(lo80, hi80), fill: BAND }],
    series: [
      { data: P, color: ACC, width: 2, dash: "5 4", endLabel: `${projN}: ${bn2(popP.at(-1).value)}` },
      { data: E, color: ACC, width: 2.5 },
    ],
    notes: [
      { date: popL.date, value: popL.value / 1e6, text: `${estN}: ${bn2(popL.value)}`, dot: true, anchor: "end", dx: -8, dy: -12, bold: true },
      { ...pk, text: `Peak ${popPeak.year}: ${bn2(popPeak.value)}`, dot: true, dy: -16 },
      { date: Y(2085), value: hi95.find((p) => p.year === 2085).value / 1e6, text: "95% range", dy: -10, fill: MUTED },
      { date: Y(2092), value: hi80.find((p) => p.year === 2092).value / 1e6, text: "80% range", dy: 18, fill: MUTED },
      { date: Y(1985), value: 2.15, text: "UN estimates", fill: MUTED, anchor: "middle", dy: 0 },
      { date: Y(2045), value: 2.15, text: "UN projection (medium)", fill: MUTED, anchor: "middle", dy: 0 },
    ],
  });
  a11y(plot, "India's population, 1950 to 2100", `UN estimates rise from ${bn2(popE[0].value)} in ${est0} to ${bn2(popL.value)} in ${estN}; the medium projection peaks at ${bn2(popPeak.value)} in ${popPeak.year} and falls to ${bn2(popP.at(-1).value)} by ${projN}.`);
  addCrosshair(document.getElementById("plot-curve"), plot, [{ data: [...E, ...P], label: "Population", color: ACC }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(3) + " bn"));
  setHTML("pv-curve", `${popPeak.year}`);
  setHTML("ex-cu-peak", bn2(popPeak.value));
  setHTML("ex-cu-peakyr", String(popPeak.year));
  setHTML("ex-cu-2100", bn2(popP.at(-1).value));
  setHTML("ex-cu-lo", bn2(lo95.at(-1).value));
  setHTML("ex-cu-hi", bn2(hi95.at(-1).value));
  setHTML("ex-cu-2050", bn2(popP.find((p) => p.year === 2050).value));
  setHTML("ex-cu-1950", bn2(popE[0].value));
  setHTML("ex-cu-x", (popL.value / popE[0].value).toFixed(1) + " times");
  wirePlate("cb-curve", plot, "india-atlas_population-1950-2100", csvOf(["year", "kind", "population_thousands", "lower_95", "lower_80", "upper_80", "upper_95"],
    [...popE.map((p) => [p.year, "estimate", p.value, "", "", "", ""]), ...popP.map((p, i) => [p.year, "projection (medium)", p.value, lo95[i]?.value, lo80[i]?.value, hi80[i]?.value, hi95[i]?.value])]));
}

/* ---------- § 03 how old is India: the pyramid ---------- */
{
  const groups = ageB.meta.ageGroups;
  const yA = estN, yB = 2050, y0 = est0;
  const k = (g) => g.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const val = (b, g, sex, y) => at(b, `age_${k(g)}_${sex}`, y);
  const rows = [];
  for (const g of groups) {
    const lbl = g.replace("+", " and over");
    rows.push({ g: lbl, sex: "Men", now: -val(ageB, g, "male", yA) / 1e3, then: -val(ageProjB, g, "male", yB) / 1e3, past: -val(ageB, g, "male", y0) / 1e3 });
    rows.push({ g: lbl, sex: "Women", now: val(ageB, g, "female", yA) / 1e3, then: val(ageProjB, g, "female", yB) / 1e3, past: val(ageB, g, "female", y0) / 1e3 });
  }
  const order = [...groups].reverse().map((g) => g.replace("+", " and over"));
  const plot = Plot.plot({
    width: W, height: 620, marginLeft: 90, marginRight: 90, marginTop: 40, marginBottom: 36, style: baseStyle,
    x: { domain: [-75, 75], ticks: [-60, -40, -20, 0, 20, 40, 60], tickFormat: (v) => String(Math.abs(v)), tickSize: 0, tickPadding: 8, label: "people in each five-year age group, million", labelAnchor: "center", labelArrow: false },
    y: { domain: order, tickSize: 0, tickPadding: 10, label: null },
    marks: [
      Plot.gridX([-60, -40, -20, 20, 40, 60], { stroke: GRID }),
      Plot.barX(rows, { y: "g", x: "now", fill: (d) => (d.sex === "Women" ? ACC : "#7D8EE6"), insetTop: 2, insetBottom: 2 }),
      Plot.tickX(rows, { y: "g", x: "then", stroke: GOLD, strokeWidth: 2 }),
      Plot.ruleX([0], { stroke: "#fff", strokeWidth: 2 }),
      Plot.text([{ x: -70, y: order[0] }], { x: "x", y: "y", text: () => "Men", textAnchor: "start", fill: INK, fontSize: 13, fontWeight: 600 }),
      Plot.text([{ x: 70, y: order[0] }], { x: "x", y: "y", text: () => "Women", textAnchor: "end", fill: INK, fontSize: 13, fontWeight: 600 }),
    ],
  });
  a11y(plot, `India's population by age and sex, ${yA}, with the ${yB} projection`, `Median age ${f1(medL.value)} years in ${yA}. The bars are ${yA} estimates; the marigold ticks are the UN's ${yB} projection.`);
  document.getElementById("plot-pyramid").append(plot);
  const med50 = projB.series.medianagepop.data[projB.dates.indexOf(`${yB}-01-01`)];
  setHTML("pv-pyramid", f1(medL.value) + " years");
  setHTML("lg-pyr-now", String(yA));
  setHTML("lg-pyr-then", `${yB}, projected`);
  // the largest five-year group now
  const tot = groups.map((g) => ({ g, v: val(ageB, g, "total", yA), v50: val(ageProjB, g, "total", yB) }));
  const big = peak(tot.map((t) => ({ ...t, value: t.v }))), big50 = peak(tot.map((t) => ({ ...t, value: t.v50 })));
  setHTML("ex-py-med", f1(medL.value));
  setHTML("ex-py-med50", f1(med50));
  setHTML("ex-py-big", big.g);
  setHTML("ex-py-big50", big50.g);
  setHTML("ex-py-young", f1(at(ageB, "share_0_14", yA)) + "%");
  setHTML("ex-py-young0", f1(at(ageB, "share_0_14", y0)) + "%");
  wirePlate("cb-pyramid", plot, "india-atlas_population-pyramid", csvOf(["age_group", `men_${yA}_thousands`, `women_${yA}_thousands`, `men_${yB}_projected`, `women_${yB}_projected`, `men_${y0}`, `women_${y0}`],
    groups.map((g) => [g, val(ageB, g, "male", yA), val(ageB, g, "female", yA), val(ageProjB, g, "male", yB), val(ageProjB, g, "female", yB), val(ageB, g, "male", y0), val(ageB, g, "female", y0)])));
}

/* ---------- § 03 median age ---------- */
{
  const E = pts(estB, "medianagepop"), P = [...pts(projB, "medianagepop")];
  const lowE = low(E);
  const plot = lineChart("plot-median", {
    x0: est0, x1: projN, yDomain: [0, 50], yTicks: [0, 10, 20, 30, 40, 50], yFmt: (x) => String(x), yLabel: "median age, years", height: 380,
    series: [{ data: P, color: ACC, width: 1.75, dash: "5 4", endLabel: `${projN}: ${f1(P.at(-1).value)} years` }, { data: E, color: ACC, width: 2.25 }],
    notes: [
      { ...E.at(-1), text: `${estN}: ${f1(E.at(-1).value)}`, dot: true, anchor: "end", dx: -8, dy: -12, bold: true },
      { ...lowE, text: `Youngest, ${lowE.year}: ${f1(lowE.value)}`, dot: true, dy: 18 },
    ],
  });
  a11y(plot, "Median age of India's population, 1950 to 2100", `Half of Indians were younger than ${f1(lowE.value)} in ${lowE.year} and ${f1(E.at(-1).value)} in ${estN}; the UN projects ${f1(P.at(-1).value)} by ${projN}.`);
  addCrosshair(document.getElementById("plot-median"), plot, [{ data: [...E, ...P], label: "Median age", color: ACC }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(1) + " years"));
  setHTML("pv-median", f1(E.at(-1).value) + " years");
  setHTML("ex-md-low", f1(lowE.value));
  setHTML("ex-md-lowyr", String(lowE.year));
  setHTML("ex-md-2100", f1(P.at(-1).value));
  wirePlate("cb-median", plot, "india-atlas_median-age", csvOf(["year", "kind", "median_age_years"], [...E.map((p) => [p.year, "estimate", p.value]), ...P.map((p) => [p.year, "projection (medium)", p.value])]));
}

/* ---------- § 04 the working-age window ---------- */
{
  const E = pts(ageB, "share_15_64"), P = [...pts(ageProjB, "share_15_64")];
  const plot = lineChart("plot-window", {
    x0: est0, x1: projN, yDomain: [50, 75], yTicks: [50, 55, 60, 65, 70, 75], yFmt: (x) => x + (x === 75 ? "%" : ""), yLabel: "share of the population aged 15 to 64, per cent", height: 420,
    series: [{ data: P, color: ACC, width: 1.75, dash: "5 4", endLabel: `${projN}: ${f1(P.at(-1).value)}%` }, { data: E, color: ACC, width: 2.25 }],
    notes: [
      { ...waPeak, text: `Peak ${waPeak.year}: ${f1(waPeak.value)}%`, dot: true, dy: -14, bold: true },
      { ...E.at(-1), text: `${estN}: ${f1(E.at(-1).value)}%`, dot: true, anchor: "end", dx: -8, dy: -14 },
      { ...low(E), text: `${low(E).year}: ${f1(low(E).value)}%`, dot: true, dy: 18 },
    ],
  });
  a11y(plot, "Working-age share of India's population, 1950 to 2100", `People aged 15 to 64 were ${f1(E.at(-1).value)}% of Indians in ${estN}; the UN projects the share to peak at ${f1(waPeak.value)}% in ${waPeak.year}.`);
  addCrosshair(document.getElementById("plot-window"), plot, [{ data: [...E, ...P], label: "Aged 15 to 64", color: ACC }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(1) + "%"));
  const n = [...pts(ageB, "working_age"), ...pts(ageProjB, "working_age")], nPk = peak(n);
  setHTML("pv-window", String(waPeak.year));
  setHTML("ex-wi-now", f1(E.at(-1).value) + "%");
  setHTML("ex-wi-peak", f1(waPeak.value) + "%");
  setHTML("ex-wi-peakyr", String(waPeak.year));
  setHTML("ex-wi-npk", crore(nPk.value));
  setHTML("ex-wi-npkyr", String(nPk.year));
  setHTML("ex-wi-nnow", crore(n.find((p) => p.year === estN).value));
  wirePlate("cb-window", plot, "india-atlas_working-age-share", csvOf(["year", "kind", "share_15_64_pct", "aged_15_64_thousands"], [...E.map((p) => [p.year, "estimate", p.value, at(ageB, "working_age", p.year)]), ...P.map((p) => [p.year, "projection (medium)", p.value, at(ageProjB, "working_age", p.year)])]));
}

/* ---------- § 04 dependency ratios ---------- */
{
  const s = (k) => ({ E: pts(ageB, k), P: [...pts(ageProjB, k)] });
  const yg = s("dependency_young"), od = s("dependency_old");
  const cross = od.P.find((p) => p.value > yg.P.find((q) => q.year === p.year).value);
  const plot = lineChart("plot-dependency", {
    x0: est0, x1: projN, yDomain: [0, 80], yTicks: [0, 20, 40, 60, 80], yFmt: (x) => String(x), yLabel: "dependants per 100 people aged 15 to 64", height: 420, mr: 190,
    series: [
      { data: yg.P, color: ACC, width: 1.5, dash: "5 4", endLabel: `Children: ${f1(yg.P.at(-1).value)}` },
      { data: yg.E, color: ACC, width: 2 },
      { data: od.P, color: GOLD, width: 1.5, dash: "5 4", endLabel: `Aged 65+: ${f1(od.P.at(-1).value)}`, bold: true },
      { data: od.E, color: GOLD, width: 2 },
    ],
    // the crossing gets a dot; its label sits in the empty space below both lines
    notes: cross ? [{ ...cross, text: "", dot: true, color: GOLD }, { date: cross.date, value: 8, text: `More old than young from ${cross.year}`, dy: 0, fill: INK }] : [],
  });
  a11y(plot, "Young and old dependency ratios, 1950 to 2100", `In ${estN} there were ${f1(yg.E.at(-1).value)} children and ${f1(od.E.at(-1).value)} people aged 65 or more for every 100 of working age.`);
  addCrosshair(document.getElementById("plot-dependency"), plot, [{ data: [...yg.E, ...yg.P], label: "Children 0-14", color: ACC }, { data: [...od.E, ...od.P], label: "Aged 65+", color: GOLD }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(1)));
  setHTML("pv-dependency", f1(at(ageB, "dependency_total", estN)));
  setHTML("ex-de-young", f1(yg.E.at(-1).value));
  setHTML("ex-de-old", f1(od.E.at(-1).value));
  setHTML("ex-de-cross", cross ? String(cross.year) : "not before " + projN);
  setHTML("ex-de-old50", f1(at(ageProjB, "dependency_old", 2050)));
  setHTML("ex-de-65", f1(at(ageB, "share_65_plus", estN)) + "%");
  setHTML("ex-de-6550", f1(at(ageProjB, "share_65_plus", 2050)) + "%");
  wirePlate("cb-dependency", plot, "india-atlas_dependency-ratios", csvOf(["year", "kind", "young_per_100", "old_per_100", "total_per_100"],
    [...ageB.dates.map((d) => [yearOf(d), "estimate", at(ageB, "dependency_young", yearOf(d)), at(ageB, "dependency_old", yearOf(d)), at(ageB, "dependency_total", yearOf(d))]),
     ...ageProjB.dates.map((d) => [yearOf(d), "projection (medium)", at(ageProjB, "dependency_young", yearOf(d)), at(ageProjB, "dependency_old", yearOf(d)), at(ageProjB, "dependency_total", yearOf(d))])]));
}

/* ---------- § 05 fewer children ---------- */
{
  const E = pts(estB, "tfr"), P = [...pts(projB, "tfr")];
  const plot = lineChart("plot-tfr", {
    x0: est0, x1: projN, yDomain: [0, 6], yTicks: [0, 1, 2, 3, 4, 5, 6], yFmt: (x) => String(x), yLabel: "children per woman (total fertility rate)", height: 420,
    rules: [{ y: 2.1 }],
    series: [{ data: P, color: ACC, width: 1.75, dash: "5 4", endLabel: `${projN}: ${f2(P.at(-1).value)}` }, { data: E, color: ACC, width: 2.25 }],
    notes: [
      { date: Y(2075), value: 2.1, text: "Replacement, 2.1", dy: -10, fill: MUTED },
      { ...E[0], text: `${E[0].year}: ${f2(E[0].value)}`, dot: true, anchor: "start", dx: 8, dy: 20 },
      { ...tfrBelow, text: `Below 2.1 from ${tfrBelow.year}`, dot: true, anchor: "end", dx: -8, dy: 20, bold: true },
    ],
  });
  a11y(plot, "Total fertility rate, 1950 to 2100", `An Indian woman would have ${f2(E[0].value)} children over her life at ${E[0].year} rates and ${f2(E.at(-1).value)} at ${estN} rates; below replacement since ${tfrBelow.year}.`);
  addCrosshair(document.getElementById("plot-tfr"), plot, [{ data: [...E, ...P], label: "Fertility rate", color: ACC }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(2)));
  setHTML("pv-tfr", f2(E.at(-1).value));
  setHTML("ex-tf-1950", f2(E[0].value));
  setHTML("ex-tf-now", f2(E.at(-1).value));
  setHTML("ex-tf-yr", String(tfrBelow.year));
  setHTML("ex-tf-2100", f2(P.at(-1).value));
  wirePlate("cb-tfr", plot, "india-atlas_fertility-rate", csvOf(["year", "kind", "tfr"], [...E.map((p) => [p.year, "estimate", p.value]), ...P.map((p) => [p.year, "projection (medium)", p.value])]));
}
{
  const bE = pts(estB, "births", 1e-3), dE = pts(estB, "deaths", 1e-3);
  const bP = [...pts(projB, "births", 1e-3)], dP = [...pts(projB, "deaths", 1e-3)];
  const bPk = peak(bE);
  const cross = bP.find((p, i) => dP[i] && dP[i].value > p.value);
  const plot = lineChart("plot-births", {
    x0: est0, x1: projN, yDomain: [0, 35], yTicks: [0, 5, 10, 15, 20, 25, 30, 35], yFmt: (x) => String(x), yLabel: "per year, million", height: 420, mr: 190,
    series: [
      { data: bP, color: ACC, width: 1.5, dash: "5 4", endLabel: `Births: ${f1(bP.at(-1).value)} mn` },
      { data: bE, color: ACC, width: 2.25 },
      { data: dP, color: G1, width: 1.5, dash: "5 4", endLabel: `Deaths: ${f1(dP.at(-1).value)} mn` },
      { data: dE, color: G1, width: 2 },
    ],
    notes: [
      { ...bPk, text: `Most births, ${bPk.year}: ${f1(bPk.value)} mn`, dot: true, dy: -14, bold: true },
      ...(cross ? [{ ...cross, text: "", dot: true, color: G1 }, { date: cross.date, value: 10.5, text: `Deaths overtake births, ${cross.year}`, dy: 0, fill: INK }] : []),
    ],
  });
  a11y(plot, "Births and deaths a year, 1950 to 2100", `Births peaked at ${f1(bPk.value)} million in ${bPk.year}; ${f1(bE.at(-1).value)} million in ${estN} against ${f1(dE.at(-1).value)} million deaths.`);
  addCrosshair(document.getElementById("plot-births"), plot, [{ data: [...bE, ...bP], label: "Births", color: ACC }, { data: [...dE, ...dP], label: "Deaths", color: G1 }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(1) + " mn"));
  setHTML("pv-births", f1(bE.at(-1).value) + " mn");
  setHTML("ex-bi-pk", f1(bPk.value) + " million");
  setHTML("ex-bi-pkyr", String(bPk.year));
  setHTML("ex-bi-now", f1(bE.at(-1).value) + " million");
  setHTML("ex-bi-deaths", f1(dE.at(-1).value) + " million");
  setHTML("ex-bi-cross", cross ? String(cross.year) : "not before " + projN);
  wirePlate("cb-births", plot, "india-atlas_births-and-deaths", csvOf(["year", "kind", "births_thousands", "deaths_thousands"],
    [...estB.dates.map((d) => [yearOf(d), "estimate", at(estB, "births", yearOf(d)), at(estB, "deaths", yearOf(d))]), ...projB.dates.map((d) => [yearOf(d), "projection (medium)", at(projB, "births", yearOf(d)), at(projB, "deaths", yearOf(d))])]));
}

/* ---------- § 06 longer lives ---------- */
{
  const m = pts(estB, "lexmale"), f = pts(estB, "lexfemale");
  const mP = [...pts(projB, "lexmale")], fP = [...pts(projB, "lexfemale")];
  // the deepest one-year fall in the estimates (both sexes)
  const lx = pts(estB, "lex");
  let dip = null; for (let i = 1; i < lx.length; i++) { const d = lx[i].value - lx[i - 1].value; if (!dip || d < dip.d) dip = { d, at: lx[i], from: lx[i - 1] }; }
  const plot = lineChart("plot-life", {
    x0: est0, x1: projN, yDomain: [30, 90], yTicks: [30, 40, 50, 60, 70, 80, 90], yFmt: (x) => String(x), yLabel: "life expectancy at birth, years", height: 440, mr: 190,
    series: [
      { data: fP, color: ACC, width: 1.5, dash: "5 4", endLabel: `Women: ${f1(fP.at(-1).value)}`, endDy: -8, bold: true },
      { data: f, color: ACC, width: 2.25 },
      { data: mP, color: G1, width: 1.5, dash: "5 4", endLabel: `Men: ${f1(mP.at(-1).value)}`, endDy: 8 },
      { data: m, color: G1, width: 1.75 },
    ],
    notes: [{ ...dip.at, value: m.find((p) => p.year === dip.at.year).value, text: `${dip.at.year}: the pandemic`, dy: 24, fill: MUTED }],
  });
  a11y(plot, "Life expectancy at birth by sex, 1950 to 2100", `Women ${f1(f.at(-1).value)} years, men ${f1(m.at(-1).value)} years at ${estN} death rates.`);
  addCrosshair(document.getElementById("plot-life"), plot, [{ data: [...f, ...fP], label: "Women", color: ACC }, { data: [...m, ...mP], label: "Men", color: G1 }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(1) + " years"));
  setHTML("pv-life", f1(lx.at(-1).value) + " years");
  setHTML("ex-li-1950", f1(lx[0].value));
  setHTML("ex-li-now", f1(lx.at(-1).value));
  setHTML("ex-li-f", f1(f.at(-1).value));
  setHTML("ex-li-m", f1(m.at(-1).value));
  setHTML("ex-li-dipyr", String(dip.at.year));
  setHTML("ex-li-dip", f1(-dip.d * 1) + " years");
  setHTML("ex-li-dipfrom", String(dip.from.year));
  const imr = pts(estB, "imr"), u5 = pts(estB, "q5");
  setHTML("ex-li-imr0", Math.round(imr[0].value).toString());
  setHTML("ex-li-imr", f1(imr.at(-1).value));
  setHTML("ex-li-u50", Math.round(u5[0].value).toString());
  setHTML("ex-li-u5", f1(u5.at(-1).value));
  wirePlate("cb-life", plot, "india-atlas_life-expectancy", csvOf(["year", "kind", "women_years", "men_years", "both_years", "infant_mortality_per_1000", "under5_mortality_per_1000"],
    [...estB.dates.map((d) => [yearOf(d), "estimate", at(estB, "lexfemale", yearOf(d)), at(estB, "lexmale", yearOf(d)), at(estB, "lex", yearOf(d)), at(estB, "imr", yearOf(d)), at(estB, "q5", yearOf(d))]),
     ...projB.dates.map((d) => [yearOf(d), "projection (medium)", at(projB, "lexfemale", yearOf(d)), at(projB, "lexmale", yearOf(d)), at(projB, "lex", yearOf(d)), at(projB, "imr", yearOf(d)), at(projB, "q5", yearOf(d))])]));
}

/* ---------- § 07 cities ---------- */
const WUP_LAST = 2018;   // World Urbanization Prospects 2018: later years are its projections
{
  const u = pts(urbB, "sp_urb_totl_in_zs");
  const uE = u.filter((p) => p.year <= WUP_LAST), uP = u.filter((p) => p.year > WUP_LAST);
  const plot = lineChart("plot-urban", {
    x0: yearOf(urbB.dates[0]), x1: yearOf(urbB.dates.at(-1)), xStep: 10, yDomain: [0, 50], yTicks: [0, 10, 20, 30, 40, 50], yFmt: (x) => x + (x === 50 ? "%" : ""), yLabel: "share of Indians living in urban areas, per cent", height: 400, mr: 200, estRule: false,
    series: [{ data: uP, color: ACC, width: 1.75, dash: "5 4", endLabel: `${uP.at(-1).year}: ${f1(uP.at(-1).value)}%` }, { data: uE, color: ACC, width: 2.25 }],
    notes: [
      { ...uE[0], text: `${uE[0].year}: ${f1(uE[0].value)}%`, dot: true, anchor: "start", dx: 8, dy: -12 },
      { ...uE.at(-1), text: `${WUP_LAST}: ${f1(uE.at(-1).value)}%, last UN estimate`, dot: true, anchor: "end", dx: -8, dy: -14 },
    ],
  });
  a11y(plot, "Urban share of India's population, 1960 to the latest WDI year", `From ${f1(uE[0].value)}% in ${uE[0].year} to ${f1(uE.at(-1).value)}% in ${WUP_LAST}; the UN projects ${f1(uP.at(-1).value)}% for ${uP.at(-1).year}.`);
  addCrosshair(document.getElementById("plot-urban"), plot, [{ data: u, label: "Urban share", color: ACC }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(1) + "%"));
  const up = pts(urbB, "sp_urb_totl"), rp = pts(urbB, "sp_rur_totl");
  const ug = pts(urbB, "sp_urb_grow"), rg = pts(urbB, "sp_rur_totl_zg");
  const city = pts(urbB, "en_urb_lcty"), mcty = pts(urbB, "en_urb_mcty_tl_zs");
  setHTML("pv-urban", f1(uP.at(-1).value) + "%");
  setHTML("ex-ur-1960", f1(uE[0].value) + "%");
  setHTML("ex-ur-2018", f1(uE.at(-1).value) + "%");
  setHTML("ex-ur-last", f1(uP.at(-1).value) + "%");
  setHTML("ex-ur-lastyr", String(uP.at(-1).year));
  setHTML("ex-ur-n", crore(up.at(-1).value / 1e3));
  setHTML("ex-ur-rn", crore(rp.at(-1).value / 1e3));
  setHTML("ex-ur-g", f1(ug.at(-1).value) + "%");
  setHTML("ex-ur-rg", f1(rg.at(-1).value) + "%");
  setHTML("ex-ur-city", mn(city.at(-1).value / 1e3));
  setHTML("ex-ur-mcty", f1(mcty.at(-1).value) + "%");
  setHTML("ex-ur-mcty0", f1(mcty[0].value) + "%");
  wirePlate("cb-urban", plot, "india-atlas_urban-share", csvOf(["year", "kind", "urban_share_pct", "urban_population", "rural_population", "urban_growth_pct", "rural_growth_pct", "largest_city_population", "million_plus_cities_share_pct"],
    urbB.dates.map((d) => { const y = yearOf(d); return [y, y <= WUP_LAST ? "UN WUP 2018 estimate" : "UN WUP 2018 projection", at(urbB, "sp_urb_totl_in_zs", y), at(urbB, "sp_urb_totl", y), at(urbB, "sp_rur_totl", y), at(urbB, "sp_urb_grow", y), at(urbB, "sp_rur_totl_zg", y), at(urbB, "en_urb_lcty", y), at(urbB, "en_urb_mcty_tl_zs", y)]; })));
}
{
  const ug = pts(urbB, "sp_urb_grow"), rg = pts(urbB, "sp_rur_totl_zg");
  const plot = lineChart("plot-growth", {
    x0: yearOf(urbB.dates[0]), x1: yearOf(urbB.dates.at(-1)), xStep: 10, yDomain: [-1, 5], yTicks: [-1, 0, 1, 2, 3, 4, 5], yFmt: (x) => (x < 0 ? "−" + Math.abs(x) : String(x)) + (x === 5 ? "%" : ""), yLabel: "population growth a year, per cent", height: 380, mr: 190, estRule: false,
    rules: [{ y: 0, color: BASE }],
    series: [
      { data: ug, color: ACC, width: 2, endLabel: `Urban: ${f1(ug.at(-1).value)}%`, bold: true, endDy: -6 },
      { data: rg, color: G1, width: 1.75, endLabel: `Rural: ${f1(rg.at(-1).value)}%`, endDy: 6 },
    ],
  });
  a11y(plot, "Urban and rural population growth, per cent a year", `Urban ${f1(ug.at(-1).value)}% and rural ${f1(rg.at(-1).value)}% in ${ug.at(-1).year}.`);
  addCrosshair(document.getElementById("plot-growth"), plot, [{ data: ug, label: "Urban", color: ACC }, { data: rg, label: "Rural", color: G1 }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(2) + "%"));
  setHTML("pv-growth", f1(ug.at(-1).value) + "%");
  wirePlate("cb-growth", plot, "india-atlas_urban-rural-growth", csvOf(["year", "urban_growth_pct", "rural_growth_pct"], urbB.dates.map((d) => [yearOf(d), at(urbB, "sp_urb_grow", yearOf(d)), at(urbB, "sp_rur_totl_zg", yearOf(d))])));
}

/* ---------- § 08 migration ---------- */
{
  const nm = pts(estB, "netmigrations"), nmP = pts(projB, "netmigrations");
  const rows = [...nm.map((p) => ({ ...p, kind: "Estimate", v: p.value / 1e3 })), ...nmP.filter((p) => p.year <= 2050).map((p) => ({ ...p, kind: "Projection", v: p.value / 1e3 }))];
  const worst = low(nm);
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 52, marginRight: 40, marginTop: 34, marginBottom: 34, style: baseStyle,
    x: { type: "utc", domain: [Y(est0), Y(2051)], ticks: yearTicks(est0, 2050, 10), tickFormat: yearFmt, tickSize: 0, tickPadding: 12, label: null },
    y: { domain: [-1.6, 0.4], ticks: [-1.6, -1.2, -0.8, -0.4, 0, 0.4], tickFormat: (x) => (x < 0 ? "−" + Math.abs(x).toFixed(1) : x.toFixed(1)), tickSize: 0, tickPadding: 10, label: "net migration a year, million (arrivals minus departures)", labelAnchor: "top", labelArrow: false },
    marks: [
      Plot.gridY([-1.2, -0.8, -0.4, 0.4], { stroke: GRID }),
      Plot.rectY(rows, { x1: (d) => d.date, x2: (d) => Y(d.year + 1), y1: 0, y2: "v", fill: (d) => (d.kind === "Estimate" ? ACC : ACC_SOFT), insetLeft: 1, insetRight: 1 }),
      Plot.ruleY([0], { stroke: INK, strokeOpacity: 0.5 }),
      Plot.text([{ date: worst.date, v: worst.value / 1e3 }], { x: "date", y: "v", text: () => `${worst.year}: −${f2(Math.abs(worst.value) / 1e3)} million`, dy: 14, textAnchor: "middle", fill: INK, fontSize: 12, fontWeight: 600 }),
      Plot.text([{ date: Y(2037), v: 0.25 }], { x: "date", y: "v", text: () => "Projection", fill: MUTED, fontSize: 12 }),
    ],
  });
  a11y(plot, "India's net migration a year, 1950 to 2050", `More people leave India than arrive in most years: ${f2(nm.at(-1).value / 1e3)} million net in ${estN}; the largest net outflow was ${f2(worst.value / 1e3)} million in ${worst.year}.`);
  document.getElementById("plot-migration").append(plot);
  const stock = pts(migB, "sm_pop_totl"), stockPct = pts(migB, "sm_pop_totl_zs"), refg = pts(migB, "sm_pop_rhcr_ea");
  setHTML("pv-migration", (nm.at(-1).value < 0 ? "−" : "+") + f2(Math.abs(nm.at(-1).value) / 1e3) + " mn");
  setHTML("ex-mi-now", f2(Math.abs(nm.at(-1).value) / 1e3) + " million");
  setHTML("ex-mi-worst", f2(Math.abs(worst.value) / 1e3) + " million");
  setHTML("ex-mi-worstyr", String(worst.year));
  setHTML("ex-mi-stock", mn(stock.at(-1).value / 1e3));
  setHTML("ex-mi-stockyr", String(stock.at(-1).year));
  setHTML("ex-mi-stockpct", f1(stockPct.at(-1).value) + "%");
  setHTML("ex-mi-stock0", mn(stock[0].value / 1e3));
  setHTML("ex-mi-stock0yr", String(stock[0].year));
  setHTML("ex-mi-refg", Math.round(refg.at(-1).value).toLocaleString("en-IN"));
  setHTML("ex-mi-refgyr", String(refg.at(-1).year));
  wirePlate("cb-migration", plot, "india-atlas_net-migration", csvOf(["year", "kind", "net_migration_thousands"], rows.map((r) => [r.year, r.kind === "Estimate" ? "estimate" : "projection (medium)", r.value])));
}

/* ---------- § 09 the variants ---------- */
{
  const NAMES = { "": "Medium (the UN's central projection)", low: "Low fertility (half a child fewer)", high: "High fertility (half a child more)", constant_fertility: "Fertility stays at today's level", instant_replacement: "Fertility jumps to replacement", zero_migration: "No migration", constant_mortality: "Death rates stay at today's level", no_change: "Fertility and death rates frozen", momentum: "Replacement fertility, frozen death rates, no migration", lower_95_pi: "Lower end of the 95% range", upper_95_pi: "Upper end of the 95% range", lower_80_pi: "Lower end of the 80% range", upper_80_pi: "Upper end of the 80% range", median_pi: "Median of the probabilistic projection", instant_replacement_zero_migration: "Replacement fertility and no migration", no_fertility_below_age_18: "No births to mothers under 18", accelerated_abr_decline: "Faster fall in teenage births", accelerated_abr_decline_with_rec: "Faster fall in teenage births, later catch-up" };
  const keys = Object.keys(NAMES);
  for (const k of Object.keys(varB.series).filter((x) => x.startsWith("tpopulation1july__")).map((x) => x.slice(18))) if (!(k in NAMES)) throw new Error(`population: variant ${k} has no name on the What if plate`);
  const v2100 = (k) => (k === "" ? popP.at(-1).value : at(varB, `tpopulation1july__${k}`, projN));
  const v2050 = (k) => (k === "" ? at(projB, "tpopulation1july", 2050) : at(varB, `tpopulation1july__${k}`, 2050));
  const rows = keys.filter((k) => v2100(k) != null).map((k) => ({ k, name: NAMES[k], a: v2050(k) / 1e6, b: v2100(k) / 1e6 })).sort((x, y) => y.b - x.b);
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 38, marginLeft: 380, marginRight: 90, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { domain: [0, 2.6], ticks: [0, 0.5, 1, 1.5, 2, 2.5], tickFormat: (x) => x.toFixed(1), tickSize: 0, tickPadding: 8, label: "population, billion", labelAnchor: "right", labelArrow: false },
    y: { domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14, label: null },
    marks: [
      Plot.gridX([0.5, 1, 1.5, 2, 2.5], { stroke: GRID }),
      Plot.ruleX([popL.value / 1e6], { stroke: "#B5BAC4", strokeDasharray: "3 3" }),
      Plot.barX(rows, { y: "name", x: "b", fill: (d) => (d.k === "" ? ACC : "#C9CED6"), insetTop: 10, insetBottom: 10 }),
      Plot.dot(rows, { y: "name", x: "a", r: 4, fill: "#fff", stroke: GOLD, strokeWidth: 1.75 }),
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.a, d.b), text: (d) => d.b.toFixed(2), dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.k === "" ? 600 : 400) }),
    ],
  });
  a11y(plot, `India's population in ${projN} under each UN projection variant`, rows.map((r) => `${r.name}: ${r.b.toFixed(2)} billion`).join("; "));
  document.getElementById("plot-variants").append(plot);
  setHTML("lg-var-b", String(projN));
  setHTML("pv-variants", `${rows.at(-1).b.toFixed(2)} to ${rows[0].b.toFixed(2)} bn`);
  setHTML("ex-va-lo", rows.at(-1).b.toFixed(2) + " billion");
  setHTML("ex-va-lon", rows.at(-1).name.toLowerCase());
  setHTML("ex-va-hi", rows[0].b.toFixed(2) + " billion");
  setHTML("ex-va-hin", rows[0].name.toLowerCase());
  setHTML("ex-va-zm", (v2100("zero_migration") / 1e6).toFixed(2) + " billion");
  wirePlate("cb-variants", plot, "india-atlas_population-projection-variants", csvOf(["variant", "population_2050_thousands", `population_${projN}_thousands`], rows.map((r) => [r.name, r.a * 1e6, r.b * 1e6])));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", estB.meta.vintage);
setHTML("prov-vintage2", estB.meta.vintage);
setHTML("prov-wdi", urbB.meta.vintage);
