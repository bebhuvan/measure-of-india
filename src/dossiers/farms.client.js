// The farms guide: plates and number wiring.
// Data (all baked at build, nothing fetched for the charts):
//   farms-production, -area, -yield   crop output, area and yield, final estimates, 1950-51 on
//   farms-advance                     the latest year, the ministry's advance estimate (a separate ruler)
//   farms-index-1982, -1994, -2008    index numbers of agricultural production, three bases, never linked
//   farms-msp                         minimum support prices, rupees a quintal, 1975-76 on
//   farms-landuse                     land use, irrigation, fertiliser and pesticides
//   farms-pds, farms-pds-latest       procurement, off-take and central-pool stocks; the part year apart
// Build-time picks in the page (#farms-data): the states guide's Handbook tables (state output and
// yield), farms-states-production (long state shares), farms-states-fertiliser, the climate guide's
// monthly CRU rainfall (June to September totals) and the prices guide's CPI for agricultural labourers.

import * as Plot from "@observablehq/plot";
import prodB from "../../data/series/farms-production.json";
import areaB from "../../data/series/farms-area.json";
import yieldB from "../../data/series/farms-yield.json";
import aeB from "../../data/series/farms-advance.json";
import idx82 from "../../data/series/farms-index-1982.json";
import idx94 from "../../data/series/farms-index-1994.json";
import idx08 from "../../data/series/farms-index-2008.json";
import mspB from "../../data/series/farms-msp.json";
import landB from "../../data/series/farms-landuse.json";
import pdsB from "../../data/series/farms-pds.json";
import pdsL from "../../data/series/farms-pds-latest.json";
import { MONO as sans, hydrate, a11y, addCrosshair, spark, seamMarks, tint, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

const PICK = JSON.parse(document.getElementById("farms-data")?.textContent || "{}");
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16", PALE = "#B9C3F3", GREY = "#A3A9B4", GREY1 = "#5F6675";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const lastIdx = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
const firstIdx = (arr) => arr.findIndex((v) => v != null);
const fyOf = (iso) => { const y = +String(iso).slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const dayOf = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const csvOf = (header, rows) => [header.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");
const mt = (v) => v / 1000;                       // thousand tonnes -> million tonnes
const mtS = (v) => fmt.num1(mt(v)) + " million tonnes";
const kg = (v) => fmt.inr(v) + " kg";
const pct = (a, b) => (a / b - 1) * 100;
const signPct = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1) + "%";
const yearDate = (y) => new Date(Date.UTC(y, 3, 1));
const fyTick = (d) => { const y = d.getUTCFullYear(); return y % 10 === 0 || y === 1950 ? String(y) : "’" + String(y).slice(2); };
const decadeTicks = (y0, y1) => { const t = []; for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) t.push(yearDate(y)); return t; };

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id); if (!el) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
function mount(id, plot) { const el = document.getElementById(id); if (el) el.append(plot); return el; }
const pts = (b, k, f = (v) => v) => hydrate(b)[k].data.filter((d) => d.value != null).map((d) => ({ date: d.date, value: f(d.value) }));

/* ======================== the figures the page leads with ======================== */
const P = prodB.series, iP = prodB.dates.length - 1, FY = fyOf(prodB.dates[iP]);
const AE = aeB.series, AEY = fyOf(aeB.dates[0]), AES = aeB.meta.stage, aeStage = AES.toLowerCase();
const Y = yieldB.series, iY = yieldB.dates.length - 1;
const M = mspB.series;
const S = pdsB.series, iS = pdsB.dates.length - 1, stockAsOn = `1 April ${+pdsB.dates[iS].slice(0, 4) + 1}`;
const NORM = 210.4;   // lakh tonnes: the 1 April operational buffer and strategic reserve (Department of Food and Public Distribution, January 2015)
const iPad = lastIdx(M.paddy_common.data), iWht = lastIdx(M.wheat.data);

setHTML("m-latest", `${FY} final; ${AEY} advance estimate; stocks to ${dayOf(pdsL.dates[0])}`);
setHTML("n-fg", fmt.num1(mt(P.foodgrains.data[iP])) + pc(" mt"));
setHTML("d-fg", `${FY}; <b>${fmt.num1(mt(AE.production_foodgrains.data[0]))} mt</b> in ${AEY} (${aeStage})`);
spark("nspark-fg", { ...hydrate(prodB).foodgrains, color: ACC });
setHTML("n-yield", fmt.inr(Y.wheat.data[iY]) + pc(" kg"));
setHTML("d-yield", `<b>${fmt.x1(Y.wheat.data[iY] / Y.wheat.data[0])}</b> the 1950-51 yield, ${fyOf(yieldB.dates[iY])}`);
setHTML("n-msp", fmt.inrR(M.paddy_common.data[iPad]));
setHTML("d-msp", `${fyOf(mspB.dates[iPad])}, up <b>${fmt.pct1(pct(M.paddy_common.data[iPad], M.paddy_common.data[iPad - 1]))}</b>`);
setHTML("n-stock", fmt.num1(S.stocks_total.data[iS] / 10) + pc(" mt"));
setHTML("d-stock", `<b>${fmt.x1(S.stocks_total.data[iS] / NORM)}</b> the buffer norm, ${stockAsOn}`);

/* ======================== § 01 the current reading ======================== */
setHTML("u-reading", `Crop year ${FY}, final estimates; ${AEY}, ${aeStage}`);
setHTML("rb-fg", fmt.num1(mt(P.foodgrains.data[iP])) + pc(" mt"));
setHTML("rt-fy", FY);
setHTML("rb-side-l", `${AEY}, ${aeStage}`);
setHTML("rb-side", fmt.num1(mt(AE.production_foodgrains.data[0])) + " mt");

/* ======================== § 02 a hectare at the support price ======================== */
{
  const rows = yieldB.dates.map((d, i) => {
    const j = mspB.dates.indexOf(d);
    const y = Y.wheat.data[i], p = j >= 0 ? M.wheat.data[j] : null;
    return y != null && p != null ? { date: new Date(d + "T00:00:00Z"), iso: d, yield: y, msp: p, value: Math.round((y * p) / 100) } : null;
  }).filter(Boolean);
  const last = rows.at(-1), first = rows[0];
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 70, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1975, +last.iso.slice(0, 4)), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ rupees a hectare, at the support price, before costs", labelAnchor: "top", labelArrow: false, domain: [0, Math.ceil(last.value / 20000) * 20000], tickFormat: (d) => String(fmt.inrR(d)), tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(rows, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([last], { x: "date", y: "value", fill: ACC, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => `${fyOf(d.iso)}: ${fmt.inrR(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "A hectare of wheat at the support price", `In ${fyOf(last.iso)} an average hectare of wheat (${kg(last.yield)}) at the support price of ${fmt.inrR(last.msp)} a quintal came to ${fmt.inrR(last.value)}; in ${fyOf(first.iso)}, ${fmt.inrR(first.value)}.`);
  const el = mount("plot-hectare", plot);
  addCrosshair(el, plot, [{ label: "Wheat, per hectare at MSP", color: ACC, data: rows.map((r) => ({ date: r.date, value: r.value })) }], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.inrR(v)));
  setHTML("pv-hectare", fmt.inrR(last.value));
  setHTML("pc-hectare", `a hectare of wheat, ${fyOf(last.iso)}`);
  setHTML("lr-yield", kg(last.yield));
  setHTML("lr-gross", fmt.inrR(last.value));
  setHTML("ex-ha-fy", fyOf(last.iso));
  setHTML("ex-ha-yield", kg(last.yield));
  setHTML("ex-ha-msp", fmt.inrR(last.msp));
  setHTML("ex-ha-gross", fmt.inrR(last.value));
  setHTML("ex-ha-fy0", fyOf(first.iso));
  setHTML("ex-ha-gross0", fmt.inrR(first.value));
  wirePlate("cb-hectare", plot, "india-atlas_wheat-hectare-at-msp", csvOf(["crop_year", "wheat_yield_kg_per_ha", "wheat_msp_rs_per_quintal", "rs_per_ha_at_msp"], rows.map((r) => [fyOf(r.iso), r.yield, r.msp, r.value])));
}

/* ======================== § 04 the harvest ======================== */
const aeDate = new Date(aeB.dates[0] + "T00:00:00Z");
{
  const fin = pts(prodB, "foodgrains", mt);
  const ae = [{ date: aeDate, value: mt(AE.production_foodgrains.data[0]) }];
  const first = fin[0], last = fin.at(-1);
  const top = Math.ceil(Math.max(last.value, ae[0].value) / 50) * 50;
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 52, marginRight: 200, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1950, 2025), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ foodgrains, million tonnes", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("side", [{ data: fin, color: ACC, width: 2 }, { data: ae, color: ACC }], { text: `${AEY}, advance`, y: top * 0.97, anchor: "end" }),
      Plot.dot([last], { x: "date", y: "value", fill: ACC, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.dot(ae, { x: "date", y: "value", fill: "#fff", stroke: ACC, strokeWidth: 1.75, r: 4.5 }),
      Plot.text(ae, { x: "date", y: "value", text: (d) => `Advance: ${fmt.num1(d.value)}`, dx: 12, dy: -12, textAnchor: "start", fill: MUTED, fontSize: 12 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => `${fyOf(d.date.toISOString())} final ${fmt.num1(d.value)}`, dx: 12, dy: 12, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "Foodgrain production since 1950-51", `Final estimates rise from ${fmt.num1(first.value)} million tonnes in 1950-51 to ${fmt.num1(last.value)} in ${FY}; the ${aeStage} for ${AEY} is ${fmt.num1(ae[0].value)}.`);
  const el = mount("plot-harvest", plot);
  addCrosshair(el, plot, [{ label: "Foodgrains, final", color: ACC, data: hydrate(prodB).foodgrains.data.map((d) => ({ date: d.date, value: d.value == null ? null : mt(d.value) })) }], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.num1(v) + " mt"));
  setHTML("tt-harvest", WORDS[Math.round(last.value / first.value)] ?? fmt.x1(last.value / first.value));
  setHTML("pv-harvest", fmt.num1(last.value) + " mt");
  setHTML("pc-harvest", `foodgrains, ${FY}, final estimate`);
  setHTML("lg-ae", `${AEY}, ${aeStage}`);
  setHTML("ex-hv-fy", FY);
  setHTML("ex-hv-fg", mtS(P.foodgrains.data[iP]));
  setHTML("ex-hv-fg0", mtS(P.foodgrains.data[0]));
  setHTML("ex-hv-fy0", fyOf(prodB.dates[0]));
  setHTML("ex-hv-stage", aeStage);
  setHTML("ex-hv-aey", AEY);
  setHTML("ex-hv-ae", mtS(AE.production_foodgrains.data[0]));
  wirePlate("cb-harvest", plot, "india-atlas_foodgrain-production", csvOf(["crop_year", "estimate", "foodgrains_million_tonnes"], [...fin.map((d) => [fyOf(d.date.toISOString()), "final", d.value]), [AEY, aeStage, ae[0].value]]));
}
{
  const CROPS = [["rice", "Rice"], ["wheat", "Wheat"], ["coarse_cereals", "Coarse cereals"], ["pulses", "Pulses"]];
  const rows = CROPS.flatMap(([k, l]) => pts(prodB, k, mt).map((d) => ({ ...d, crop: l })));
  const ae = CROPS.map(([k, l]) => ({ crop: l, date: aeDate, value: mt(AE[`production_${k}`].data[0]) }));
  const ends = CROPS.map(([k, l]) => ({ crop: l, date: new Date(prodB.dates[iP] + "T00:00:00Z"), value: mt(P[k].data[iP]) }));
  const plot = Plot.plot({
    width: W, height: 330, marginLeft: 44, marginRight: 30, marginTop: 34, marginBottom: 34, style: baseStyle,
    fx: { label: null, domain: CROPS.map((c) => c[1]), padding: 0.12, tickSize: 0 },
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: [1960, 1990, 2020].map(yearDate), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ million tonnes", labelAnchor: "top", labelArrow: false, domain: [0, 160], ticks: [0, 40, 80, 120, 160], tickSize: 0, tickPadding: 8, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID, ticks: [40, 80, 120, 160] }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(rows, { fx: "crop", x: "date", y: "value", stroke: ACC, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(ends, { fx: "crop", x: "date", y: "value", fill: ACC, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.dot(ae, { fx: "crop", x: "date", y: "value", fill: "#fff", stroke: ACC, strokeWidth: 1.5, r: 3.5 }),
      Plot.text(ends, { fx: "crop", x: "date", y: "value", text: (d) => fmt.num1(d.value), dy: -14, textAnchor: "end", fill: INK, fontSize: 12, fontWeight: 600 }),
    ],
  });
  a11y(plot, "Production of rice, wheat, coarse cereals and pulses", `In ${FY}: rice ${mtS(P.rice.data[iP])}, wheat ${mtS(P.wheat.data[iP])}, coarse cereals ${mtS(P.coarse_cereals.data[iP])}, pulses ${mtS(P.pulses.data[iP])}.`);
  mount("plot-grains", plot);
  setHTML("pv-grains", fmt.num1(mt(P.rice.data[iP])) + " mt");
  setHTML("ex-gr-fy", FY);
  setHTML("ex-gr-rice", mtS(P.rice.data[iP]));
  setHTML("ex-gr-wheat", mtS(P.wheat.data[iP]));
  setHTML("ex-gr-coarse", mtS(P.coarse_cereals.data[iP]));
  setHTML("ex-gr-pulses", mtS(P.pulses.data[iP]));
  wirePlate("cb-grains", plot, "india-atlas_foodgrains-by-crop", csvOf(["crop", "crop_year", "estimate", "million_tonnes"], [...rows.map((d) => [d.crop, fyOf(d.date.toISOString()), "final", d.value]), ...ae.map((d) => [d.crop, AEY, aeStage, d.value])]));
}
{
  const CROPS = [["wheat", "Wheat", ACC], ["rice", "Rice", GOLD], ["coarse_cereals", "Coarse cereals", GREY1], ["pulses", "Pulses", GREY]];
  const series = CROPS.map(([k, l, c]) => ({ key: k, label: l, color: c, data: hydrate(yieldB)[k].data }));
  const ends = series.map((s) => { const i = lastIdx(s.data.map((d) => d.value)); return { ...s.data[i], label: s.label, color: s.color }; });
  // end labels: at least 16px apart (about 170 kg on this scale)
  const sorted = [...ends].sort((a, b) => b.value - a.value);
  sorted.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, sorted[i - 1].ly - 170); });
  const plot = Plot.plot({
    width: W, height: 450, marginLeft: 56, marginRight: 190, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1950, 2025), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ kg per hectare", labelAnchor: "top", labelArrow: false, domain: [0, 4000], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(fmt.inr(d)) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data.filter((d) => d.value != null), { x: "date", y: "value", stroke: s.color, strokeWidth: s.key === "wheat" ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.color, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label} ${fmt.inr(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  const mult = Y.wheat.data[iY] / Y.wheat.data[0];
  a11y(plot, "Yield per hectare of wheat, rice, coarse cereals and pulses", `In ${fyOf(yieldB.dates[iY])}: wheat ${kg(Y.wheat.data[iY])}, rice ${kg(Y.rice.data[iY])}, coarse cereals ${kg(Y.coarse_cereals.data[iY])}, pulses ${kg(Y.pulses.data[iY])} per hectare.`);
  const el = mount("plot-yield", plot);
  addCrosshair(el, plot, series, null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : kg(v)));
  setHTML("pv-yield", fmt.x1(mult));
  setHTML("ex-yl-fy", fyOf(yieldB.dates[iY]));
  for (const k of ["wheat", "rice", "pulses"]) { setHTML(`ex-yl-${k}`, kg(Y[k].data[iY])); setHTML(`ex-yl-${k}0`, kg(Y[k].data[0])); }
  wirePlate("cb-yield", plot, "india-atlas_foodgrain-yield", csvOf(["crop_year", ...CROPS.map((c) => c[0] + "_kg_per_ha")], yieldB.dates.map((d, i) => [fyOf(d), ...CROPS.map(([k]) => Y[k].data[i])])));
}
{
  const A = areaB.series, iA = areaB.dates.length - 1;
  const CROPS = [["rice", "Rice", ACC], ["wheat", "Wheat", GOLD], ["coarse_cereals", "Coarse cereals", GREY1], ["pulses", "Pulses", GREY]];
  const mha = (v) => v / 1000;
  const series = CROPS.map(([k, l, c]) => ({ key: k, label: l, color: c, data: hydrate(areaB)[k].data.map((d) => ({ date: d.date, value: d.value == null ? null : mha(d.value) })) }));
  const ends = series.map((s) => ({ ...s.data[iA], label: s.label, color: s.color }));
  const sorted = [...ends].sort((a, b) => b.value - a.value);
  sorted.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, sorted[i - 1].ly - 2.8); });
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 190, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1950, 2025), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ million hectares", labelAnchor: "top", labelArrow: false, domain: [0, 60], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data.filter((d) => d.value != null), { x: "date", y: "value", stroke: s.color, strokeWidth: s.key === "coarse_cereals" ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.color, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label} ${fmt.num1(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Area under each foodgrain", `In ${fyOf(areaB.dates[iA])}: rice ${fmt.num1(mha(A.rice.data[iA]))}, wheat ${fmt.num1(mha(A.wheat.data[iA]))}, coarse cereals ${fmt.num1(mha(A.coarse_cereals.data[iA]))}, pulses ${fmt.num1(mha(A.pulses.data[iA]))} million hectares.`);
  const el = mount("plot-area", plot);
  addCrosshair(el, plot, series, null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.num1(v) + " m ha"));
  const fall = -pct(A.coarse_cereals.data[iA], A.coarse_cereals.data[0]);
  setHTML("tt-area", Math.abs(fall - 100 / 3) < 3 ? "a third" : fmt.pct0(fall));
  setHTML("pv-area", fmt.num1(mha(A.foodgrains.data[iA])));
  setHTML("ex-ar-fy", fyOf(areaB.dates[iA]));
  setHTML("ex-ar-rice", fmt.num1(mha(A.rice.data[iA])));
  setHTML("ex-ar-wheat", fmt.num1(mha(A.wheat.data[iA])));
  setHTML("ex-ar-coarse", fmt.num1(mha(A.coarse_cereals.data[iA])));
  setHTML("ex-ar-pulses", fmt.num1(mha(A.pulses.data[iA])));
  setHTML("ex-ar-coarse0", fmt.num1(mha(A.coarse_cereals.data[0])));
  wirePlate("cb-area", plot, "india-atlas_foodgrain-area", csvOf(["crop_year", ...CROPS.map((c) => c[0] + "_thousand_ha")], areaB.dates.map((d, i) => [fyOf(d), ...CROPS.map(([k]) => A[k].data[i])])));
}

/* ======================== § 05 beyond grain ======================== */
{
  // every commercial crop, its own scale and unit: million tonnes; cotton and jute lakh bales; tea and coffee thousand tonnes
  const CROPS = [["sugarcane", "Sugarcane", "million tonnes", (v) => v / 1000], ["oilseeds", "Oilseeds (nine)", "million tonnes", (v) => v / 1000], ["soyabean", "Soyabean", "million tonnes", (v) => v / 1000],
    ["groundnut", "Groundnut", "million tonnes", (v) => v / 1000], ["rapeseed_mustard", "Rapeseed and mustard", "million tonnes", (v) => v / 1000], ["cotton", "Cotton", "lakh bales of 170 kg", (v) => v / 100],
    ["jute_mesta", "Jute and mesta", "lakh bales of 180 kg", (v) => v / 100], ["tea", "Tea", "thousand tonnes", (v) => v], ["coffee", "Coffee", "thousand tonnes", (v) => v], ["tobacco", "Tobacco", "thousand tonnes", (v) => v]];
  const ncol = 5, cw = 220, ch = 150, gx = 16, gy = 64, H = 2 * ch + gy + 40;
  // one svg, ten small panels drawn as Plot plots and stacked into it (each its own y scale)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H); svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("font-family", sans); svg.setAttribute("font-size", "12"); svg.setAttribute("style", `color:${MUTED};overflow:visible`);
  const csvRows = [];
  CROPS.forEach(([k, label, unit, f], n) => {
    const data = pts(prodB, k, f);
    const aeV = AE[`production_${k}`]?.data[0];
    const ae = aeV != null ? [{ date: aeDate, value: f(aeV) }] : [];
    const last = data.at(-1);
    const hi = Math.max(...data.map((d) => d.value), ...ae.map((d) => d.value));
    const p = Plot.plot({
      width: cw, height: ch, marginLeft: 40, marginRight: 14, marginTop: 10, marginBottom: 22, style: { ...baseStyle, fontSize: "11.5px" },
      x: { label: null, domain: [yearDate(1950), yearDate(2026)], ticks: [1960, 2000].map(yearDate), tickSize: 0, tickPadding: 6, tickFormat: (d) => String(d.getUTCFullYear()) },
      y: { label: null, domain: [0, hi * 1.08], ticks: 3, tickSize: 0, tickPadding: 4, tickFormat: (d) => String(fmt.inr(d)) },
      marks: [
        Plot.gridY({ stroke: GRID, ticks: 3 }),
        Plot.ruleY([0], { stroke: BASE }),
        Plot.lineY(data, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([last], { x: "date", y: "value", fill: ACC, r: 2.5 }),
        Plot.dot(ae, { x: "date", y: "value", fill: "#fff", stroke: ACC, strokeWidth: 1.25, r: 3 }),
      ],
    });
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const x0 = (n % ncol) * (cw + gx) + 6, y0 = Math.floor(n / ncol) * (ch + gy) + 40;
    g.setAttribute("transform", `translate(${x0},${y0})`);
    const t1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t1.setAttribute("x", 0); t1.setAttribute("y", -22); t1.setAttribute("fill", INK); t1.setAttribute("font-weight", "600"); t1.setAttribute("font-size", "12.5");
    t1.textContent = `${label}: ${fmt.num1(last.value)}`;
    const t2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
    t2.setAttribute("x", 0); t2.setAttribute("y", -7); t2.setAttribute("fill", MUTED); t2.setAttribute("font-size", "11.5");
    t2.textContent = unit;
    g.append(t1, t2);
    while (p.firstChild) { if (p.firstChild.tagName?.toLowerCase() === "style") { p.removeChild(p.firstChild); continue; } g.append(p.firstChild); }
    svg.append(g);
    for (const d of data) csvRows.push([label, unit, fyOf(d.date.toISOString()), "final", d.value]);
    for (const d of ae) csvRows.push([label, unit, AEY, aeStage, d.value]);
  });
  a11y(svg, "Production of commercial crops", `In ${FY}: sugarcane ${mtS(P.sugarcane.data[iP])}, oilseeds ${mtS(P.oilseeds.data[iP])}, cotton ${fmt.num1(P.cotton.data[iP] / 100)} lakh bales, tea ${fmt.num1(P.tea.data[iP])} thousand tonnes.`);
  mount("plot-crops", svg);
  setHTML("pv-crops", fmt.num1(mt(P.sugarcane.data[iP])));
  setHTML("ex-cr-fy", FY);
  setHTML("ex-cr-sugar", mtS(P.sugarcane.data[iP]));
  setHTML("ex-cr-oil", mtS(P.oilseeds.data[iP]));
  setHTML("ex-cr-cotton", fmt.num1(P.cotton.data[iP] / 100) + " lakh bales");
  setHTML("ex-cr-tea", fmt.num1(P.tea.data[iP]) + " thousand tonnes");
  wirePlate("cb-crops", svg, "india-atlas_commercial-crops", csvOf(["crop", "unit", "crop_year", "estimate", "value"], csvRows));
}
{
  // all crops, production index, three bases side by side, never joined
  const ruler = (b) => pts(b, "production_all_crops");
  const r82 = ruler(idx82), r94 = ruler(idx94), r08 = ruler(idx08);
  const aeIdx = AE.index_production_all_crops?.data[0];
  const last = r08.at(-1);
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 220, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1950, 2025), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ index, base years = 100", labelAnchor: "top", labelArrow: false, domain: [0, 200], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleY([100], { stroke: BASE, strokeDasharray: "2,3" }),
      ...seamMarks("side", [{ data: r82, color: tint(ACC, 0.6), width: 1.5 }, { data: r94, color: tint(ACC, 0.35), width: 1.5 }, { data: r08, color: ACC }], false),
      Plot.dot(aeIdx != null ? [{ date: aeDate, value: aeIdx }] : [], { x: "date", y: "value", fill: "#fff", stroke: ACC, strokeWidth: 1.5, r: 4 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => `TE 2007-08 = 100: ${fmt.num1(d.value)}`, dx: 12, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "Index of agricultural production, three bases", `On the base triennium ending 2007-08, all crops ${fmt.num1(last.value)} in ${fyOf(last.date.toISOString())}; the 1981-82 base runs ${fyOf(r82[0].date.toISOString())} to ${fyOf(r82.at(-1).date.toISOString())}, the 1993-94 base ${fyOf(r94[0].date.toISOString())} to ${fyOf(r94.at(-1).date.toISOString())}.`);
  mount("plot-index", plot);
  const I = idx08.series, i8 = idx08.dates.length - 1;
  setHTML("pv-index", fmt.num1(I.production_all_crops.data[i8]));
  setHTML("pc-index", `all crops, ${fyOf(idx08.dates[i8])}, TE 2007-08 = 100`);
  setHTML("ex-ix-fy", fyOf(idx08.dates[i8]));
  setHTML("ex-ix-all", fmt.num1(I.production_all_crops.data[i8]));
  setHTML("ex-ix-fg", fmt.num1(I.production_foodgrains.data[i8]));
  setHTML("ex-ix-nfg", fmt.num1(I.production_non_foodgrains.data[i8]));
  wirePlate("cb-index", plot, "india-atlas_agricultural-production-index-three-bases", csvOf(["crop_year", "base", "all_crops_production_index"], [...r82.map((d) => [fyOf(d.date.toISOString()), "TE 1981-82=100", d.value]), ...r94.map((d) => [fyOf(d.date.toISOString()), "TE 1993-94=100", d.value]), ...r08.map((d) => [fyOf(d.date.toISOString()), "TE 2007-08=100", d.value])]));
}

/* ======================== § 06 land, water and fertiliser ======================== */
const L = landB.series, iL = landB.dates.length - 1;
{
  const mha = (v) => (v == null ? null : v / 1000);
  const KEYS = [["gross_sown_area", "Gross sown", GREY1, 1.5], ["net_sown_area", "Net sown", GREY, 1.5], ["gross_irrigated_area", "Gross irrigated", ACC, 2]];
  const series = KEYS.map(([k, l, c, w]) => ({ key: k, label: l, color: c, w, data: hydrate(landB)[k].data.map((d) => ({ date: d.date, value: mha(d.value) })) }));
  const ends = series.map((s) => { const i = lastIdx(s.data.map((d) => d.value)); return { ...s.data[i], label: s.label }; }).sort((a, b) => b.value - a.value);
  ends.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, ends[i - 1].ly - 11); });
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 190, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1950, 2025), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ million hectares", labelAnchor: "top", labelArrow: false, domain: [0, 250], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data.filter((d) => d.value != null), { x: "date", y: "value", stroke: s.color, strokeWidth: s.w, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: INK, r: 2.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label} ${fmt.num1(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Net sown, gross sown and irrigated area", `In ${fyOf(landB.dates[iL])}: net sown ${fmt.num1(mha(L.net_sown_area.data[iL]))}, gross sown ${fmt.num1(mha(L.gross_sown_area.data[iL]))}, gross irrigated ${fmt.num1(mha(L.gross_irrigated_area.data[iL]))} million hectares.`);
  const el = mount("plot-land", plot);
  addCrosshair(el, plot, series, null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.num1(v) + " m ha"));
  setHTML("pv-land", fmt.pct1(L.irrigated_share.data[iL]));
  setHTML("ex-ld-net", fmt.num1(mha(L.net_sown_area.data[iL])));
  setHTML("ex-ld-gross", fmt.num1(mha(L.gross_sown_area.data[iL])));
  setHTML("ex-ld-ci", fmt.pct1(L.cropping_intensity.data[iL]));
  setHTML("ex-ld-irr", fmt.pct1(L.irrigated_share.data[iL]));
  setHTML("ex-ld-irr0", fmt.pct1(L.irrigated_share.data[0]));
  setHTML("mn-unirr", fmt.pct0(100 - L.irrigated_share.data[iL]));
  wirePlate("cb-land", plot, "india-atlas_land-use-and-irrigation", csvOf(["year", "net_sown_thousand_ha", "gross_sown_thousand_ha", "gross_irrigated_thousand_ha", "cropping_intensity_pct", "irrigated_share_pct"], landB.dates.map((d, i) => [fyOf(d), L.net_sown_area.data[i], L.gross_sown_area.data[i], L.gross_irrigated_area.data[i], L.cropping_intensity.data[i], L.irrigated_share.data[i]])));
}
{
  const data = pts(landB, "fertiliser_per_ha");
  const last = data.at(-1);
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 48, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1950, 2025), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ kg of nutrients per hectare of gross sown area", labelAnchor: "top", labelArrow: false, domain: [0, Math.ceil(Math.max(...data.map((d) => d.value)) / 20) * 20], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([last], { x: "date", y: "value", fill: ACC, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => `${fmt.num1(d.value)} kg`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "Fertiliser per hectare", `Fertiliser per hectare of gross sown area: ${fmt.num1(data[0].value)} kg in ${fyOf(data[0].date.toISOString())}, ${fmt.num1(last.value)} kg in ${fyOf(last.date.toISOString())}.`);
  const el = mount("plot-fert", plot);
  addCrosshair(el, plot, [{ label: "Fertiliser per hectare", color: ACC, data: hydrate(landB).fertiliser_per_ha.data }], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.num1(v) + " kg"));
  const iPe = lastIdx(L.pesticides.data);
  setHTML("pv-fert", fmt.num1(last.value));
  setHTML("ex-ft-tot", fmt.num1(L.fertiliser_npk.data[iL]));
  setHTML("ex-ft-fy", fyOf(landB.dates[iL]));
  setHTML("ex-ft-ha", fmt.num1(last.value) + " kg");
  setHTML("ex-ft-pest", fmt.num1(L.pesticides.data[iPe]));
  setHTML("ex-ft-pfy", fyOf(landB.dates[iPe]));
  wirePlate("cb-fert", plot, "india-atlas_fertiliser-per-hectare", csvOf(["year", "fertiliser_npk_lakh_tonnes", "gross_sown_thousand_ha", "kg_per_ha"], landB.dates.map((d, i) => [fyOf(d), L.fertiliser_npk.data[i], L.gross_sown_area.data[i], L.fertiliser_per_ha.data[i]])));
}

/* ======================== § 07 support prices ======================== */
{
  const series = [{ key: "paddy_common", label: "Paddy (common)", color: ACC, data: hydrate(mspB).paddy_common.data }, { key: "wheat", label: "Wheat", color: GOLD, data: hydrate(mspB).wheat.data }];
  const ends = series.map((s) => { const i = lastIdx(s.data.map((d) => d.value)); return { ...s.data[i], label: s.label, color: s.color }; });
  ends.sort((a, b) => b.value - a.value);
  ends.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, ends[i - 1].ly - 130); });
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 64, marginRight: 230, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1975, 2026), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ rupees a quintal", labelAnchor: "top", labelArrow: false, domain: [0, 2800], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(fmt.inrR(d)) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data.filter((d) => d.value != null), { x: "date", y: "value", stroke: s.color, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.color, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label.replace(" (common)", "")} ${fyOf(d.date.toISOString())}: ${fmt.inrR(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Support prices for paddy and wheat", `Paddy ${fmt.inrR(M.paddy_common.data[iPad])} a quintal in ${fyOf(mspB.dates[iPad])}; wheat ${fmt.inrR(M.wheat.data[iWht])} in ${fyOf(mspB.dates[iWht])}.`);
  const el = mount("plot-msp", plot);
  addCrosshair(el, plot, series, null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.inrR(v)));
  setHTML("tt-msp", fmt.count(M.paddy_common.data[iPad] / M.paddy_common.data[0]));
  setHTML("pv-msp", fmt.inrR(M.paddy_common.data[iPad]));
  setHTML("pc-msp", `paddy, a quintal, ${fyOf(mspB.dates[iPad])}`);
  setHTML("ex-ms-py", fyOf(mspB.dates[iPad]));
  setHTML("ex-ms-p", fmt.inrR(M.paddy_common.data[iPad]));
  setHTML("ex-ms-pr", fmt.pct1(pct(M.paddy_common.data[iPad], M.paddy_common.data[iPad - 1])));
  setHTML("ex-ms-wy", fyOf(mspB.dates[iWht]));
  setHTML("ex-ms-w", fmt.inrR(M.wheat.data[iWht]));
  setHTML("ex-ms-wr", fmt.pct1(pct(M.wheat.data[iWht], M.wheat.data[iWht - 1])));
  wirePlate("cb-msp", plot, "india-atlas_msp-paddy-wheat", csvOf(["crop_year", "paddy_common_rs_per_quintal", "wheat_rs_per_quintal"], mspB.dates.map((d, i) => [fyOf(d), M.paddy_common.data[i], M.wheat.data[i]])));
}
{
  // MSP rise on the year before against the crop-year (July to June) average of the twelve monthly
  // year-on-year rates of the CPI for agricultural labourers (1986-87 = 100), where all twelve exist
  const C = PICK.cpial ?? { dates: [], al: [] };
  const cpiByFy = new Map();
  C.dates.forEach((d, i) => { const y = +d.slice(0, 4), m = +d.slice(5, 7), fy = m >= 7 ? y : y - 1; if (C.al[i] == null) return; const e = cpiByFy.get(fy) ?? []; e.push(C.al[i]); cpiByFy.set(fy, e); });
  const rows = [];
  mspB.dates.forEach((d, i) => {
    const y = +d.slice(0, 4), c = cpiByFy.get(y);
    if (!c || c.length !== 12 || i === 0) return;
    const p = M.paddy_common.data[i] != null && M.paddy_common.data[i - 1] != null ? pct(M.paddy_common.data[i], M.paddy_common.data[i - 1]) : null;
    const w = M.wheat.data[i] != null && M.wheat.data[i - 1] != null ? pct(M.wheat.data[i], M.wheat.data[i - 1]) : null;
    rows.push({ y, fy: fyOf(d), paddy: p, wheat: w, cpi: c.reduce((a, b) => a + b, 0) / 12 });
  });
  const bars = rows.flatMap((r) => [{ fy: r.fy, k: "Paddy", v: r.paddy }, { fy: r.fy, k: "Wheat", v: r.wheat }]).filter((b) => b.v != null);
  const lo = Math.min(0, ...bars.map((b) => b.v), ...rows.map((r) => r.cpi)), hi = Math.max(...bars.map((b) => b.v), ...rows.map((r) => r.cpi));
  const fys = rows.map((r) => r.fy);
  const bw = ((W - 48 - 30) / fys.length) * 0.8;   // the band's width at padding 0.2: paddy takes its left half, wheat its right
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 30, marginTop: 30, marginBottom: 44, style: baseStyle,
    x: { label: null, domain: fys, tickSize: 0, tickPadding: 8, padding: 0.2, tickFormat: (d, i) => (i % 3 === 0 ? d : "") },
    y: { label: "↑ per cent, on the year before", labelAnchor: "top", labelArrow: false, domain: [Math.floor(lo / 5) * 5, Math.ceil(hi / 5) * 5], tickSize: 0, tickPadding: 10, tickFormat: (d) => d + "%" },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.barY(bars.filter((b) => b.k === "Paddy"), { x: "fy", y: "v", fill: ACC, insetRight: bw / 2 + 1 }),
      Plot.barY(bars.filter((b) => b.k === "Wheat"), { x: "fy", y: "v", fill: GOLD, insetLeft: bw / 2 + 1 }),
      Plot.lineY(rows, { x: "fy", y: "cpi", stroke: INK, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(rows, { x: "fy", y: "cpi", fill: INK, r: 2.5 }),
    ],
  });
  a11y(plot, "Support price rises against farm labourers' inflation", `Across ${rows.length} crop years, the paddy price rose faster than farm labourers' inflation in ${rows.filter((r) => r.paddy != null && r.paddy > r.cpi).length}, wheat in ${rows.filter((r) => r.wheat != null && r.wheat > r.cpi).length}.`);
  mount("plot-mspinfl", plot);
  const nP = rows.filter((r) => r.paddy != null && r.paddy > r.cpi).length, nW = rows.filter((r) => r.wheat != null && r.wheat > r.cpi).length;
  const lastR = rows.at(-1);
  setHTML("pv-mspinfl", `${nP} of ${rows.filter((r) => r.paddy != null).length}`);
  setHTML("sb-mi-span", `${rows[0].fy} to ${lastR.fy}`);
  setHTML("ex-mi-n", String(rows.length));
  setHTML("ex-mi-p", String(nP));
  setHTML("ex-mi-w", String(nW));
  setHTML("ex-mi-fy", lastR.fy);
  setHTML("ex-mi-pl", fmt.pct1(lastR.paddy));
  setHTML("ex-mi-wl", fmt.pct1(lastR.wheat));
  setHTML("ex-mi-cl", fmt.pct1(lastR.cpi));
  wirePlate("cb-mspinfl", plot, "india-atlas_msp-rise-vs-cpi-al", csvOf(["crop_year", "paddy_msp_rise_pct", "wheat_msp_rise_pct", "cpi_al_crop_year_average_yoy_pct"], rows.map((r) => [r.fy, r.paddy == null ? null : +r.paddy.toFixed(2), r.wheat == null ? null : +r.wheat.toFixed(2), +r.cpi.toFixed(2)])));
}
{
  // ten-year rise in every crop's MSP: latest price against the price ten crop years earlier
  const rows = Object.entries(M).map(([k, s]) => {
    const i = lastIdx(s.data);
    const j = i - 10;
    if (i < 0 || j < 0 || s.data[j] == null) return null;
    return { k, label: s.label, latest: s.data[i], fy: fyOf(mspB.dates[i]), fy0: fyOf(mspB.dates[j]), rise: pct(s.data[i], s.data[j]) };
  }).filter(Boolean).sort((a, b) => b.rise - a.rise);
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 30, marginLeft: 200, marginRight: 240, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, Math.ceil(Math.max(...rows.map((r) => r.rise)) / 50) * 50], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "label", x: "rise", fill: (d) => (d.k === "paddy_common" || d.k === "wheat" ? ACC : GREY), insetTop: 6, insetBottom: 6 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.text(rows, { y: "label", x: "rise", text: (d) => `${fmt.pct0(d.rise)}, now ${fmt.inrR(d.latest)} (${d.fy})`, dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Ten-year rise in each crop's support price", `${rows[0].label} rose most, ${fmt.pct0(rows[0].rise)}; ${rows.at(-1).label} least, ${fmt.pct0(rows.at(-1).rise)}.`);
  mount("plot-mspall", plot);
  const p = rows.find((r) => r.k === "paddy_common"), w = rows.find((r) => r.k === "wheat");
  setHTML("pv-mspall", fmt.pct0(rows[0].rise));
  setHTML("pc-mspall", `${rows[0].label.toLowerCase()}, ${rows[0].fy0} to ${rows[0].fy}`);
  setHTML("ex-ma-top", `${rows[0].label.toLowerCase()} (${fmt.pct0(rows[0].rise)})`);
  setHTML("ex-ma-bot", `${rows.at(-1).label.toLowerCase()} (${fmt.pct0(rows.at(-1).rise)})`);
  setHTML("ex-ma-p", fmt.pct0(p.rise));
  setHTML("ex-ma-w", fmt.pct0(w.rise));
  wirePlate("cb-mspall", plot, "india-atlas_msp-ten-year-rise", csvOf(["crop", "from_crop_year", "to_crop_year", "latest_rs_per_quintal", "rise_pct"], rows.map((r) => [r.label, r.fy0, r.fy, r.latest, +r.rise.toFixed(2)])));
}

/* ======================== § 08 procurement and stocks ======================== */
{
  const lt = (v) => (v == null ? null : v / 10);   // lakh tonnes -> million tonnes
  const KEYS = [["procurement_rice", "Rice procured", ACC, 2], ["procurement_wheat", "Wheat procured", GOLD, 2], ["offtake_total", "Issued", GREY, 1.5]];
  const series = KEYS.map(([k, l, c, w]) => ({ key: k, label: l, color: c, w, data: hydrate(pdsB)[k].data.map((d) => ({ date: d.date, value: lt(d.value) })) }));
  const ends = series.map((s) => { const i = lastIdx(s.data.map((d) => d.value)); return { ...s.data[i], label: s.label, color: s.color }; }).sort((a, b) => b.value - a.value);
  ends.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, ends[i - 1].ly - 6); });
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 200, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1972, 2026), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ million tonnes", labelAnchor: "top", labelArrow: false, domain: [0, 110], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data.filter((d) => d.value != null), { x: "date", y: "value", stroke: s.color, strokeWidth: s.w, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.color, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label} ${fmt.num1(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  const rw = (S.procurement_rice.data[iS] + S.procurement_wheat.data[iS]) / ((P.rice.data[iP] + P.wheat.data[iP]) / 100);   // lakh tonnes over thousand tonnes / 100
  a11y(plot, "Procurement and off-take", `In ${fyOf(pdsB.dates[iS])}: rice procured ${fmt.num1(lt(S.procurement_rice.data[iS]))}, wheat ${fmt.num1(lt(S.procurement_wheat.data[iS]))}, issued ${fmt.num1(lt(S.offtake_total.data[iS]))} million tonnes.`);
  const el = mount("plot-proc", plot);
  addCrosshair(el, plot, series, null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.num1(v) + " mt"));
  // the share: procurement in the latest year over the previous crop year's rice and wheat harvest
  // (wheat bought in April 2025 is the 2024-25 crop); stated as a rough share, in words
  const share = rw;
  setHTML("tt-proc", share > 30 && share < 36 ? "a third" : share > 22 && share <= 30 ? "a quarter" : fmt.pct0(share));
  setHTML("pv-proc", fmt.pct0(share));
  setHTML("pc-proc", `rice and wheat bought in ${fyOf(pdsB.dates[iS])}, of the ${FY} harvest`);
  setHTML("ex-pr-fy", fyOf(pdsB.dates[iS]));
  setHTML("ex-pr-rice", fmt.num1(lt(S.procurement_rice.data[iS])) + " million tonnes");
  setHTML("ex-pr-wheat", fmt.num1(lt(S.procurement_wheat.data[iS])) + " million tonnes");
  setHTML("ex-pr-off", fmt.num1(lt(S.offtake_total.data[iS])) + " million tonnes");
  wirePlate("cb-proc", plot, "india-atlas_procurement-offtake", csvOf(["year", "rice_procured_lakh_t", "wheat_procured_lakh_t", "offtake_total_lakh_t"], pdsB.dates.map((d, i) => [fyOf(d), S.procurement_rice.data[i], S.procurement_wheat.data[i], S.offtake_total.data[i]])));
}
{
  const lt = (v) => (v == null ? null : v / 10);
  const KEYS = [["stocks_total", "Total", ACC, 2], ["stocks_rice", "Rice", MUTED, 1.5], ["stocks_wheat", "Wheat", GOLD, 1.5]];
  // a year-end stock is the position on 1 April of the next year: dated there
  const shift = (d) => new Date(Date.UTC(d.getUTCFullYear() + 1, 3, 1));
  const series = KEYS.map(([k, l, c, w]) => ({ key: k, label: l, color: c, w, data: hydrate(pdsB)[k].data.map((d) => ({ date: shift(d.date), value: lt(d.value) })) }));
  const latest = { date: new Date(pdsL.dates[0] + "T00:00:00Z"), value: lt(pdsL.series.stocks_total.data[0]) };
  const normFrom = new Date(Date.UTC(2015, 3, 1));
  const ends = series.map((s) => { const i = lastIdx(s.data.map((d) => d.value)); return { ...s.data[i], label: s.label }; }).sort((a, b) => b.value - a.value);
  ends.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, ends[i - 1].ly - 7); });
  const top = Math.ceil(Math.max(latest.value, ...series[0].data.map((d) => d.value ?? 0)) / 20) * 20;
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 48, marginRight: 210, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: decadeTicks(1973, 2026), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ million tonnes in the central pool", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleY([NORM / 10], { x1: normFrom, x2: shift(new Date(pdsB.dates[iS] + "T00:00:00Z")), stroke: INK, strokeDasharray: "4,3", strokeWidth: 1 }),
      ...series.map((s) => Plot.lineY(s.data.filter((d) => d.value != null), { x: "date", y: "value", stroke: s.color, strokeWidth: s.w, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: INK, r: 2.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label} ${fmt.num1(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.dot([latest], { x: "date", y: "value", fill: "#fff", stroke: ACC, strokeWidth: 1.75, r: 4.5 }),
      Plot.text([latest], { x: "date", y: "value", text: (d) => `${dayOf(pdsL.dates[0])}: ${fmt.num1(d.value)}`, dx: -10, textAnchor: "end", fill: MUTED, fontSize: 12 }),
    ],
  });
  a11y(plot, "Central pool stocks against the buffer norm", `On ${stockAsOn} the pool held ${fmt.num1(lt(S.stocks_total.data[iS]))} million tonnes, ${fmt.x1(S.stocks_total.data[iS] / NORM)} the 1 April norm; on ${dayOf(pdsL.dates[0])}, ${fmt.num1(latest.value)}.`);
  const el = mount("plot-stocks", plot);
  addCrosshair(el, plot, series, null, (d) => `1 April ${d.getUTCFullYear()}`, (v) => (v == null ? "—" : fmt.num1(v) + " mt"));
  setHTML("pv-stocks", fmt.num1(lt(S.stocks_total.data[iS])) + " mt");
  setHTML("pc-stocks", `on ${stockAsOn}, ${fmt.x1(S.stocks_total.data[iS] / NORM)} the norm`);
  setHTML("ex-st-date", stockAsOn);
  setHTML("ex-st-tot", mtS(S.stocks_total.data[iS] * 100));
  setHTML("ex-st-rice", mtS(S.stocks_rice.data[iS] * 100));
  setHTML("ex-st-wheat", mtS(S.stocks_wheat.data[iS] * 100));
  setHTML("ex-st-x", fmt.x1(S.stocks_total.data[iS] / NORM));
  setHTML("ex-st-ld", dayOf(pdsL.dates[0]));
  setHTML("ex-st-lv", mtS(pdsL.series.stocks_total.data[0] * 100));
  wirePlate("cb-stocks", plot, "india-atlas_central-pool-stocks", csvOf(["as_on", "total_lakh_t", "rice_lakh_t", "wheat_lakh_t"], [...pdsB.dates.map((d, i) => [`1 April ${+d.slice(0, 4) + 1}`, S.stocks_total.data[i], S.stocks_rice.data[i], S.stocks_wheat.data[i]]), [dayOf(pdsL.dates[0]), pdsL.series.stocks_total.data[0], pdsL.series.stocks_rice?.data[0], pdsL.series.stocks_wheat?.data[0]]]));
}

/* ======================== § 09 the states ======================== */
{
  const ST = PICK.states ?? {};
  const CROPS = [["foodgrains", "Foodgrains"], ["rice", "Rice"], ["wheat", "Wheat"], ["coarse_cereals", "Coarse cereals"], ["pulses", "Pulses"], ["oilseeds", "Oilseeds"], ["sugarcane", "Sugarcane"], ["cotton", "Cotton"], ["jute_mesta", "Jute"]];
  const fy = fyOf(ST.foodgrains.year);
  const share = (c, name) => { const r = ST[c].rows.find((x) => x.name === name); return r && ST[c].ai ? (100 * r.v) / ST[c].ai : null; };
  // states with at least 1% of any crop, ordered by foodgrain share
  const names = [...new Set(CROPS.flatMap(([c]) => ST[c].rows.filter((r) => ST[c].ai && (100 * r.v) / ST[c].ai >= 1).map((r) => r.name)))];
  names.sort((a, b) => (share("foodgrains", b) ?? 0) - (share("foodgrains", a) ?? 0));
  const cells = names.flatMap((n) => CROPS.map(([c, l]) => ({ state: n, crop: l, v: share(c, n) })));
  const plot = Plot.plot({
    width: W, height: 40 + names.length * 26, marginLeft: 170, marginRight: 20, marginTop: 34, marginBottom: 10, style: baseStyle,
    x: { label: null, axis: "top", domain: CROPS.map((c) => c[1]), tickSize: 0, padding: 0.04 },
    y: { label: null, domain: names, tickSize: 0, tickPadding: 10, padding: 0.06 },
    color: { type: "linear", domain: [0, 40], range: ["#F4F6FD", "#7F93E6"], clamp: true },
    marks: [
      Plot.cell(cells.filter((d) => d.v != null), { x: "crop", y: "state", fill: "v" }),
      Plot.text(cells.filter((d) => d.v != null && d.v >= 0.5), { x: "crop", y: "state", text: (d) => d.v.toFixed(1), fill: INK, fontSize: 11.5 }),
    ],
  });
  const up = share("foodgrains", "Uttar Pradesh");
  const top3 = (c) => ST[c].rows.map((r) => (100 * r.v) / ST[c].ai).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  a11y(plot, "Each state's share of India's crops", `In ${fy}, Uttar Pradesh grew ${fmt.pct1(up)} of foodgrains; the top three states grew ${fmt.pct0(top3("wheat"))} of wheat and ${fmt.pct0(top3("cotton"))} of cotton.`);
  mount("plot-states", plot);
  setHTML("sb-states-fy", fy);
  setHTML("pv-states", fmt.pct1(up));
  setHTML("pc-states", `Uttar Pradesh's share of foodgrains, ${fy}`);
  setHTML("ex-sg-up", fmt.pct1(up));
  setHTML("ex-sg-wheat3", fmt.pct0(top3("wheat")));
  setHTML("ex-sg-cotton3", fmt.pct0(top3("cotton")));
  setHTML("ex-sg-sugar3", fmt.pct0(top3("sugarcane")));
  wirePlate("cb-states", plot, "india-atlas_state-shares-of-crops", csvOf(["state", ...CROPS.map((c) => c[0] + "_share_pct")], names.map((n) => [n, ...CROPS.map(([c]) => { const v = share(c, n); return v == null ? null : +v.toFixed(2); })])));
}
{
  // long state shares of wheat and rice, final estimates; split states as two rulers (seamMarks)
  const LG = PICK.long ?? { dates: [], series: {} };
  const dates = LG.dates.map((d) => new Date(d + "T00:00:00Z"));
  const share = (k, crop) => {
    const s = LG.series[k], ai = LG.series[`all_india__${crop}`];
    if (!s || !ai) return [];
    return s.data.map((v, i) => (v != null && ai.data[i] ? { date: dates[i], value: (100 * v) / ai.data[i] } : null)).filter((d) => d && d.date >= new Date(Date.UTC(1980, 3, 1)));
  };
  const lastFy = fyOf(LG.dates.at(-1));
  const panels = [
    { crop: "wheat", title: "Wheat", lines: [["punjab", "Punjab", GOLD], ["haryana", "Haryana", GREY]], split: [["uttar_pradesh", "Uttar Pradesh", GREY1], ["madhya_pradesh", "Madhya Pradesh", ACC]] },
    { crop: "rice", title: "Rice", lines: [["punjab", "Punjab", GOLD], ["west_bengal", "West Bengal", GREY1], ["odisha", "Odisha", GREY]], split: [["andhra_pradesh", "Andhra Pradesh", ACC]] },
  ];
  const pw = 560, ph = 400;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", ph + 30); svg.setAttribute("viewBox", `0 0 ${W} ${ph + 30}`);
  svg.setAttribute("font-family", sans); svg.setAttribute("font-size", "12"); svg.setAttribute("style", `color:${MUTED};overflow:visible`);
  const csvRows = [];
  panels.forEach((pn, n) => {
    const marks = [Plot.gridY({ stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
    const labels = [];
    for (const [k, l, c] of pn.lines) { const d = share(`${k}__${pn.crop}`, pn.crop); if (!d.length) continue; marks.push(Plot.lineY(d, { x: "date", y: "value", stroke: c, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })); labels.push({ ...d.at(-1), label: l }); d.forEach((x) => csvRows.push([pn.title, l, fyOf(x.date.toISOString()), +x.value.toFixed(2)])); }
    for (const [k, l, c] of pn.split) {
      const old = share(`${k}_undivided__${pn.crop}`, pn.crop), nw = share(`${k}__${pn.crop}`, pn.crop);
      if (old.length && nw.length) marks.push(...seamMarks("side", [{ data: old, color: tint(c, 0.55), width: 1.5 }, { data: nw, color: c, width: 2 }], false));
      else if (nw.length) marks.push(Plot.lineY(nw, { x: "date", y: "value", stroke: c, strokeWidth: 2 }));
      if (nw.length) labels.push({ ...nw.at(-1), label: l });
      old.forEach((x) => csvRows.push([pn.title, `${l} (undivided)`, fyOf(x.date.toISOString()), +x.value.toFixed(2)]));
      nw.forEach((x) => csvRows.push([pn.title, l, fyOf(x.date.toISOString()), +x.value.toFixed(2)]));
    }
    labels.sort((a, b) => b.value - a.value);
    labels.forEach((e, i) => { e.ly = i === 0 ? e.value : Math.min(e.value, labels[i - 1].ly - 2.2); });
    marks.push(Plot.dot(labels, { x: "date", y: "value", fill: INK, r: 2.5 }));
    marks.push(Plot.text(labels, { x: "date", y: "ly", text: (d) => `${d.label} ${fmt.pct1(d.value)}`, dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }));
    const p = Plot.plot({
      width: pw, height: ph, marginLeft: 44, marginRight: 150, marginTop: 34, marginBottom: 30, style: baseStyle,
      x: { label: null, tickSize: 0, tickPadding: 10, ticks: [1980, 1990, 2000, 2010, 2020].map(yearDate), tickFormat: (d) => String(d.getUTCFullYear()) },
      y: { label: `↑ ${pn.title.toLowerCase()}, share of India's output, per cent`, labelAnchor: "top", labelArrow: false, domain: [0, pn.crop === "wheat" ? 40 : 20], tickSize: 0, tickPadding: 8, tickFormat: (d) => d + "%" },
      marks,
    });
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${n * (pw + 64)},14)`);
    while (p.firstChild) { if (p.firstChild.tagName?.toLowerCase() === "style") { p.removeChild(p.firstChild); continue; } g.append(p.firstChild); }
    svg.append(g);
  });
  const mpw = share("madhya_pradesh__wheat", "wheat"), upw = share("uttar_pradesh__wheat", "wheat"), pbw = share("punjab__wheat", "wheat");
  a11y(svg, "State shares of wheat and rice since 1980-81", `In ${lastFy}: Uttar Pradesh ${fmt.pct1(upw.at(-1).value)} of wheat, Madhya Pradesh ${fmt.pct1(mpw.at(-1).value)}, Punjab ${fmt.pct1(pbw.at(-1).value)} (${fmt.pct1(pbw[0].value)} in 1980-81).`);
  mount("plot-statelong", svg);
  setHTML("sb-long-fy", lastFy);
  setHTML("pv-statelong", fmt.pct1(mpw.at(-1).value));
  setHTML("ex-sl-fy", lastFy);
  setHTML("ex-sl-upw", fmt.pct1(upw.at(-1).value));
  setHTML("ex-sl-mpw", fmt.pct1(mpw.at(-1).value));
  setHTML("ex-sl-pbw", fmt.pct1(pbw.at(-1).value));
  setHTML("ex-sl-pbw0", fmt.pct1(pbw[0].value));
  wirePlate("cb-statelong", svg, "india-atlas_state-shares-wheat-rice", csvOf(["crop", "state", "crop_year", "share_of_india_pct"], csvRows));
}
{
  const YP = PICK.yields ?? {};
  const PR = PICK.states ?? {};
  const fy = fyOf(YP.wheat.year);
  // states with at least 0.1% of the crop's output
  const keep = (crop) => { const out = PR[crop]; return new Set(out.rows.filter((r) => out.ai && (100 * r.v) / out.ai >= 0.1).map((r) => r.name)); };
  const rows = ["wheat", "rice"].flatMap((c) => { const k = keep(c); return YP[c].rows.filter((r) => k.has(r.name)).map((r) => ({ crop: c === "wheat" ? "Wheat" : "Rice", name: r.name, v: r.v })); });
  const order = [...new Set(rows.filter((r) => r.crop === "Rice").sort((a, b) => b.v - a.v).map((r) => r.name)), ...rows.filter((r) => r.crop === "Wheat").map((r) => r.name)].filter((v, i, a) => a.indexOf(v) === i);
  const ai = { Wheat: YP.wheat.ai, Rice: YP.rice.ai };
  const plot = Plot.plot({
    width: W, height: 60 + order.length * 22, marginLeft: 170, marginRight: 60, marginTop: 40, marginBottom: 30, style: baseStyle,
    fx: { label: null, domain: ["Rice", "Wheat"], padding: 0.1, axis: "top", tickSize: 0 },
    x: { label: null, domain: [0, 5600], ticks: [0, 2000, 4000], tickFormat: (d) => String(fmt.inr(d)), tickSize: 0 },
    y: { label: null, domain: order, tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridX({ stroke: GRID, ticks: [1000, 2000, 3000, 4000, 5000] }),
      Plot.ruleX([{ crop: "Rice", v: ai.Rice }, { crop: "Wheat", v: ai.Wheat }], { fx: "crop", x: "v", stroke: ACC, strokeDasharray: "3,3", strokeOpacity: 0.7 }),
      Plot.ruleY(rows, { fx: "crop", y: "name", x1: 0, x2: "v", stroke: "#DFE2E8", strokeWidth: 1.5 }),
      Plot.dot(rows, { fx: "crop", y: "name", x: "v", fill: (d) => (d.name === "Punjab" ? ACC : GREY1), r: 4 }),
      Plot.text(rows, { fx: "crop", y: "name", x: "v", text: (d) => fmt.inr(d.v), dx: 9, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  const top = (c) => rows.filter((r) => r.crop === c).sort((a, b) => b.v - a.v)[0];
  a11y(plot, "Rice and wheat yield by state", `In ${fy}, the highest wheat yield was ${top("Wheat").name}'s, ${kg(top("Wheat").v)} per hectare; the highest rice yield ${top("Rice").name}'s, ${kg(top("Rice").v)}; All India ${kg(ai.Wheat)} and ${kg(ai.Rice)}.`);
  mount("plot-stateyield", plot);
  setHTML("sb-sy-fy", fy);
  setHTML("pv-stateyield", kg(top("Wheat").v));
  setHTML("pc-stateyield", `${top("Wheat").name}, wheat per hectare, ${fy}`);
  setHTML("ex-sy-wt", top("Wheat").name);
  setHTML("ex-sy-wv", kg(top("Wheat").v));
  setHTML("ex-sy-rt", top("Rice").name);
  setHTML("ex-sy-rv", kg(top("Rice").v));
  setHTML("ex-sy-wai", kg(ai.Wheat));
  setHTML("ex-sy-rai", kg(ai.Rice));
  wirePlate("cb-stateyield", plot, "india-atlas_rice-wheat-yield-by-state", csvOf(["crop", "state", "crop_year", "kg_per_ha"], rows.map((r) => [r.crop, r.name, fy, r.v])));
}
{
  const F = PICK.fert ?? { rows: [] };
  const fy = fyOf(F.year);
  const aiRow = F.rows.find((r) => /all_india/.test(r.k));
  const rows = F.rows.filter((r) => !/all_india|former_/.test(r.k) && r.v != null).sort((a, b) => b.v - a.v);
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 22, marginLeft: 220, marginRight: 80, marginTop: 30, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, Math.ceil(Math.max(...rows.map((r) => r.v)) / 50) * 50], tickFormat: (d) => String(d), tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: GREY, insetTop: 5, insetBottom: 5 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.ruleX([aiRow.v], { stroke: ACC, strokeDasharray: "3,3" }),
      Plot.text([{ x: aiRow.v }], { x: "x", frameAnchor: "top", text: () => `All India ${fmt.num1(aiRow.v)} kg`, dy: -16, dx: 6, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.text(rows, { y: "name", x: "v", text: (d) => fmt.num1(d.v), dx: 6, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  a11y(plot, "Fertiliser per hectare by state", `In ${fy}, ${rows[0].name} used ${fmt.num1(rows[0].v)} kg per hectare and ${rows.at(-1).name} ${fmt.num1(rows.at(-1).v)}; All India ${fmt.num1(aiRow.v)}.`);
  mount("plot-statefert", plot);
  setHTML("sb-sf-fy", fy);
  setHTML("pv-statefert", fmt.num1(rows[0].v) + " kg");
  setHTML("pc-statefert", `${rows[0].name}, per hectare, ${fy}`);
  setHTML("ex-sf-fy", fy);
  setHTML("ex-sf-top", rows[0].name);
  setHTML("ex-sf-topv", fmt.num1(rows[0].v) + " kg");
  setHTML("ex-sf-ai", fmt.num1(aiRow.v) + " kg");
  wirePlate("cb-statefert", plot, "india-atlas_fertiliser-per-hectare-by-state", csvOf(["state", "year", "kg_per_ha"], [[aiRow.name, fy, aiRow.v], ...rows.map((r) => [r.name, fy, r.v])]));
}

/* ======================== § 10 the monsoon ======================== */
{
  const MN = PICK.monsoon ?? [];
  const base = MN.filter((r) => r.y >= 1951 && r.y <= 2000);
  const mean = base.reduce((a, r) => a + r.mm, 0) / base.length;
  const byY = new Map(MN.map((r) => [r.y, (100 * r.mm) / mean - 100]));
  const fg = P.foodgrains.data;
  const rows = prodB.dates.map((d, i) => {
    const y = +d.slice(0, 4);
    if (i === 0 || fg[i] == null || fg[i - 1] == null || !byY.has(y)) return null;
    return { y, fy: fyOf(d), rain: byY.get(y), chg: pct(fg[i], fg[i - 1]) };
  }).filter(Boolean);
  const driest = [...rows].sort((a, b) => a.rain - b.rain).slice(0, 10);
  const fell = driest.filter((r) => r.chg < 0).length;
  const worst = driest[0];
  const label = [...rows].sort((a, b) => a.chg - b.chg).slice(0, 4);
  const lastR = rows.at(-1);
  const plot = Plot.plot({
    width: W, height: 480, marginLeft: 56, marginRight: 40, marginTop: 30, marginBottom: 44, style: baseStyle,
    x: { label: "June to September rainfall, per cent above or below the 1951-2000 average →", labelAnchor: "right", labelArrow: false, domain: [-30, 30], tickFormat: (d) => (d > 0 ? "+" : "") + d + "%", tickSize: 0 },
    y: { label: "↑ change in foodgrain production on the year before, per cent", labelAnchor: "top", labelArrow: false, domain: [-25, 25], tickFormat: (d) => (d > 0 ? "+" : "") + d + "%", tickSize: 0, tickPadding: 8 },
    marks: [
      Plot.gridX({ stroke: GRID }), Plot.gridY({ stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }), Plot.ruleY([0], { stroke: BASE }),
      Plot.dot(rows, { x: "rain", y: "chg", r: 4, fill: (d) => (d.y >= 2000 ? ACC : PALE), stroke: "#fff", strokeWidth: 1 }),
      Plot.text(label, { x: "rain", y: "chg", text: (d) => d.fy, dx: 9, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Monsoon rainfall and the change in the foodgrain harvest", `Of the ten driest monsoons since 1951, ${fell} were followed by a smaller foodgrain harvest; the driest, ${worst.fy}, saw output change by ${signPct(worst.chg)}.`);
  mount("plot-monsoon", plot);
  setHTML("pv-monsoon", `${WORDS[fell] ?? fell} of ten`.replace(/^\w/, (c) => c.toUpperCase()));
  setHTML("ex-mn-dy", `the monsoon of ${worst.y}`);
  setHTML("ex-mn-dv", fmt.pct1(-worst.rain));
  setHTML("ex-mn-dc", signPct(worst.chg));
  setHTML("ex-mn-ly", `${lastR.y} (crop year ${lastR.fy})`);
  setHTML("ex-mn-lv", (lastR.rain >= 0 ? fmt.pct1(lastR.rain) + " above" : fmt.pct1(-lastR.rain) + " below"));
  setHTML("ex-mn-lc", signPct(lastR.chg));
  wirePlate("cb-monsoon", plot, "india-atlas_monsoon-and-harvest", csvOf(["monsoon_year", "crop_year", "jjas_rain_departure_pct_vs_1951_2000", "foodgrain_change_pct"], rows.map((r) => [r.y, r.fy, +r.rain.toFixed(2), +r.chg.toFixed(2)])));
}

/* ======================== provenance ======================== */
setHTML("prov-vintage", prodB.meta.vintage);
setHTML("prov-vintage2", prodB.meta.vintage);
