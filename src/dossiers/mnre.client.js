// Dossier 11 · Renewable Energy — plate definitions and number wiring.
// Data: data/series/mnre-sources.json + mnre-solar-categories.json +
// mnre-states.json, baked at build time from MNRE installed capacity data.
// Values are cumulative installed capacity in MW; displayed in GW. The
// Dec 2023 classification break (large hydro added) is annotated on every
// chart that crosses it; growth is never computed across the seam.

import * as Plot from "@observablehq/plot";
import sourcesBundle from "../../data/series/mnre-sources.json";
import solarBundle from "../../data/series/mnre-solar-categories.json";
import statesBundle from "../../data/series/mnre-states.json";
import solarStatesBundle from "../../data/series/mnre-states-solar.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob,
} from "../charts/plumbing.js";

const S = hydrate(sourcesBundle);
const SOL = hydrate(solarBundle);
const ST = hydrate(statesBundle);
const ST_SOL = hydrate(solarStatesBundle);

/* ---------- formatters ---------- */
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtMY = (d) => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()] + " " + d.getUTCFullYear();
const gw = (v, dp = 1) => (v / 1000).toFixed(dp);
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
// the latest month, for descriptions (never typed in)
const LATEST_SHORT = (() => { const d = S.grand_total.data.filter((x) => x.value != null).at(-1).date; return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()] + " " + d.getUTCFullYear(); })();
const prevV = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const firstV = (s) => s.data.filter((d) => d.value != null)[0].value;
const atYearAgo = (s) => { const d = s.data.filter((d) => d.value != null); const t = d.at(-1).date.getTime() - 365.25 * 86400000; let best = null; for (const p of d) { if (p.date.getTime() <= t) best = p; else break; } return best ? best.value : null; };
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));

/* ---------- titleblock ---------- */
setHTML("n-total", gw(last(S.grand_total)) + pc("GW"));
setHTML("d-total", `<b>${arrow(last(S.grand_total) - prevV(S.grand_total), (v) => gw(v, 2) + " GW")}</b> vs ${fmtMY(S.grand_total.data.at(-2).date)}`);
setHTML("n-solar-share", (last(S.solar) / last(S.grand_total) * 100).toFixed(0) + pc("%"));
{
  const yrAgoTotal = atYearAgo(S.grand_total), yrAgoSolar = atYearAgo(S.solar);
  const shareNow = last(S.solar) / last(S.grand_total) * 100;
  const shareThen = yrAgoSolar && yrAgoTotal ? yrAgoSolar / yrAgoTotal * 100 : null;
  setHTML("d-solar-share", shareThen != null ? `<b>${arrow(shareNow - shareThen, (v) => v.toFixed(0) + " pt")}</b> vs Jun 2025` : "—");
}
{
  const yoy = atYearAgo(S.grand_total);
  const yoyPct = yoy ? ((last(S.grand_total) / yoy - 1) * 100) : null;
  setHTML("n-yoy", yoyPct != null ? "+" + yoyPct.toFixed(0) + pc("%") : "—");
  setHTML("d-yoy", yoyPct != null ? `<b>▲ +${gw(last(S.grand_total) - yoy)} GW</b> vs Jun 2025` : "—");
}
{
  // top state
  const stEntries = Object.entries(statesBundle.series).map(([k, s]) => ({ k, label: s.label, v: s.data.at(-1) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
  const top = stEntries[0];
  setHTML("n-top-state", gw(top.v, 0) + pc("GW"));
  setHTML("d-top-state", `<b>${top.label.split(" · ")[1]}</b>, ${gw(top.v)} GW`);
}
// titleblock sparkline
{
  const plot = Plot.plot({ width: 190, height: 44, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4, style: { background: "transparent" }, x: { axis: null }, y: { axis: null, domain: [Math.min(...S.grand_total.data.map((d) => d.value)) - 5000, Math.max(...S.grand_total.data.map((d) => d.value)) + 5000] }, marks: [Plot.lineY(S.grand_total.data, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 1.5, strokeLinejoin: "round" }), Plot.dot([S.grand_total.data.at(-1)], { x: "date", y: "value", fill: "#2E4BD8", r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 })] });
  plot.setAttribute("aria-hidden", "true");
  document.getElementById("nspark-total").append(plot);
}

/* ---------- § 01 current reading ---------- */
setHTML("rb-total", gw(last(S.grand_total)) + pc("GW"));
setHTML("rb-solar", gw(last(S.solar)) + pc("GW"));
setHTML("rt-solar", gw(last(S.solar)) + pc("GW"));
setHTML("cr-total", gw(last(S.grand_total)) + pc("GW"));
setHTML("cr-total-first", gw(firstV(S.grand_total)) + pc("GW"));
setHTML("cr-growth", ((last(S.grand_total) / firstV(S.grand_total) - 1) * 100).toFixed(0) + pc("%"));
setHTML("cr-solar-share", (last(S.solar) / last(S.grand_total) * 100).toFixed(0) + pc("%"));
setHTML("cr-wind-share", (last(S.wind) / last(S.grand_total) * 100).toFixed(0) + pc("%"));
setHTML("cr-gm-share", (last(SOL.ground_mounted) / last(S.solar) * 100).toFixed(0) + pc("%"));
setHTML("cr-rt-share", (last(SOL.rooftop) / last(S.solar) * 100).toFixed(0) + pc("%"));
setHTML("cr-rt-growth", ((last(SOL.rooftop) / firstV(SOL.rooftop) - 1) * 100).toFixed(0) + pc("%"));

/* ---------- § 02 register ---------- */
const regRows = [
  [S.grand_total, "Grand Total", "MNRE, MW, includes large hydro from Dec 2023", "s-acc", (v) => gw(v) + " GW", (v) => gw(v, 2) + " GW"],
  [S.solar, "Solar Power", "MNRE, MW, Solar Power Total", "s-g1", (v) => gw(v) + " GW", (v) => gw(v, 2) + " GW"],
  [S.wind, "Wind Power", "MNRE, MW", "s-g2", (v) => gw(v) + " GW", (v) => gw(v, 2) + " GW"],
  [S.small_hydro, "Small Hydro Power", "MNRE, MW, ≤25 MW", "s-g3", (v) => gw(v, 0) + " GW", (v) => gw(v, 0) + " GW"],
  [S.bio, "Bio Power", "MNRE, MW, Bio Power Total", "s-g4", (v) => gw(v, 0) + " GW", (v) => gw(v, 0) + " GW"],
  [SOL.rooftop, "Solar, Rooftop (PM Surya Ghar)", "MNRE, MW", "s-acc", (v) => gw(v, 0) + " GW", (v) => gw(v, 1) + " GW"],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fV, fD], i) => {
  const data = s.data.filter((d) => d.value != null);
  return `<tr><td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td><td class="val">${fV(data.at(-1).value)}</td><td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)}, vs ${fmtMY(data.at(-2).date)}</td><td class="yr">${fV(data[0].value)}, ${fmtMY(data[0].date)}</td><td class="spark" id="sp-m${i}"></td></tr>`;
}).join("");
regRows.forEach(([s], i) => spark(`sp-m${i}`, { ...s, color: "#2E4BD8" }));

/* ---------- shared helpers ---------- */
function linePanel(el, keys, store, geo, opts) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * (opts.gapFrac ?? 0.07));
  const marks = [
    Plot.gridY(opts.yTicks, { stroke: "#EEF0F3", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    ...(opts.preMarks || []),
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: opts.leadWidth ?? 2, strokeLinejoin: "round", strokeLinecap: "round" }),
    ...(opts.postMarks || []),
    ...seriesList.map((s) => Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], { x: "date", y: "y", text: () => `${p.s.label.split(" (")[0]} ${opts.endFmt(p.value)}`, dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start" })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 14, ticks: opts.xTicks, tickFormat: opts.xFmt },
    y: { label: opts.yLabel, labelAnchor: "top", labelArrow: false, tickFormat: opts.yFmt, ticks: opts.yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, opts.a11yTitle, opts.a11yDesc);
  el.append(plot);
  if (opts.crossFmt) addCrosshair(el, plot, seriesList, geo, opts.xFmt, opts.crossFmt);
  return plot;
}
function wirePlate(blockEl, plot, filename, csvText) {
  const meta = { title: blockEl.querySelector(".plate-head h3")?.textContent.trim(), sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(), foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => { btn.addEventListener("click", () => { const kind = btn.dataset.dl; if (kind === "svg" && plot) downloadSVG(plot, filename, meta); if (kind === "png" && plot) downloadPNG(plot, filename, meta); if (kind === "csv") saveBlob(new Blob([csvText], { type: "text/csv" }), filename + ".csv"); }); });
}
const xTicksM = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 5, 1)));
const breakDate = new Date(Date.UTC(2023, 11, 1)); // Dec 2023

/* ---------- § 03 composition basket ---------- */
{
  const total = last(S.grand_total);
  const segs = [
    ["Solar Power", last(S.solar), total, "#2E4BD8"],
    ["Wind Power", last(S.wind), total, "#5F6675"],
    ["Bio Power", last(S.bio), total, "#878D99"],
    ["Small Hydro", last(S.small_hydro), total, "#A3A9B4"],
    ["Large Hydro (from Dec 2023)", last(S.large_hydro), total, "#C9CED6"],
  ].filter(([, v]) => v > 0);
  document.getElementById("bar-comp").innerHTML = segs.map(([n, v, t, c]) => `<div class="seg" style="width:${(v / t * 100).toFixed(2)}%;background:${c}" title="${n}: ${(v / t * 100).toFixed(1)}%"></div>`).join("");
  document.getElementById("lab-comp").innerHTML = segs.map(([n, v, t, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${n}</div><div class="w">${gw(v)} GW, ${(v / t * 100).toFixed(1)}%</div></div>`).join("");
  setHTML("pv-comp", (last(S.solar) / total * 100).toFixed(0) + pc("%"));
  wirePlate(document.getElementById("cb-comp"), null, "india-atlas_mnre_source-mix_2026-06", "source,capacity_mw,share_pct\n" + segs.map(([n, v, t]) => `"${n}",${Math.round(v)},${(v / t * 100).toFixed(1)}`).join("\n"));
}

/* ---------- § 04 headline : Grand Total ---------- */
{
  const store = { grand_total: { ...S.grand_total, label: "Grand Total", color: "#2E4BD8" } };
  const data = store.grand_total.data.map((d) => ({ date: d.date, value: d.value }));
  const geo = { W: 1184, H: 460, ml: 70, mr: 230, mt: 30, mb: 42, d0: 80000, d1: 300000 };
  const plot = linePanel(document.getElementById("plot-total"), ["grand_total"], store, geo, {
    yTicks: [100000, 150000, 200000, 250000],
    yLabel: "↑ installed capacity, MW",
    yFmt: (d) => String(d / 1000) + "k",
    xTicks: xTicksM, xFmt: (d) => String(d.getUTCFullYear()),
    leadWidth: 3,
    endFmt: (v) => gw(v) + " GW",
    crossFmt: (v) => (v == null ? "—" : gw(v) + " GW"),
    gapFrac: 0.1,
    preMarks: [
      Plot.ruleX([breakDate], { stroke: "#2E4BD8", strokeWidth: 1.5, strokeDasharray: "3,3" }),
      Plot.text([{ date: breakDate, value: 285000 }], { x: "date", y: "value", text: ["Dec 2023, large hydro added →"], dx: 8, fontSize: 12.5, fill: "#161A22", fontFamily: mono, textAnchor: "start" }),
    ],
    a11yTitle: "Grand Total renewable capacity, All India, monthly Jan 2020 to " + LATEST_SHORT,
    a11yDesc: "A rising line from " + gw(firstV(S.grand_total)) + " GW (Jan 2020) to " + gw(last(S.grand_total)) + " GW (" + LATEST_SHORT + "), with a visible step at Dec 2023 where large hydro was added to the definition (+48 GW).",
  });
  setHTML("pv-total", gw(firstV(S.grand_total)) + " → " + gw(last(S.grand_total)));
  // the step magnitude: Nov 2023 vs Dec 2023
  const novIdx = sourcesBundle.dates.indexOf("2023-11-01");
  const decIdx = sourcesBundle.dates.indexOf("2023-12-01");
  const step = S.grand_total.data[decIdx].value - S.grand_total.data[novIdx].value;
  setHTML("ex-total-now", gw(last(S.grand_total)) + pc("GW"));
  setHTML("ex-total-first", gw(firstV(S.grand_total)) + pc("GW"));
  setHTML("ex-total-step", "+" + gw(step, 0) + pc("GW"));
  setHTML("ex-total-real", gw(last(S.grand_total) - step - firstV(S.grand_total)) + pc("GW"));
  wirePlate(document.getElementById("cb-total"), plot, "india-atlas_mnre_grand-total_2020-2026", "month,grand_total_mw\n" + S.grand_total.data.map((d) => d.date.toISOString().slice(0, 7) + "," + d.value).join("\n"), fmtMY);
}

/* ---------- § 06 sources ---------- */
{
  const store = { solar: { ...S.solar, label: "Solar", color: "#2E4BD8" }, wind: { ...S.wind, label: "Wind", color: "#5F6675" }, bio: { ...S.bio, label: "Bio", color: "#878D99" }, small_hydro: { ...S.small_hydro, label: "Small Hydro", color: "#A3A9B4" } };
  const geo = { W: 1184, H: 460, ml: 70, mr: 230, mt: 30, mb: 42, d0: 0, d1: 175000 };
  const plot = linePanel(document.getElementById("plot-sources"), ["solar", "wind", "bio", "small_hydro"], store, geo, {
    yTicks: [40000, 80000, 120000, 160000],
    yLabel: "↑ installed capacity, MW",
    yFmt: (d) => String(d / 1000) + "k",
    xTicks: xTicksM, xFmt: (d) => String(d.getUTCFullYear()),
    endFmt: (v) => gw(v) + " GW",
    crossFmt: (v) => (v == null ? "—" : gw(v) + " GW"),
    gapFrac: 0.07,
    a11yTitle: "Renewable capacity by source, All India, monthly Jan 2020 to " + LATEST_SHORT,
    a11yDesc: "Four lines. Solar (blue) quadrupled to " + gw(last(S.solar)) + " GW; wind (grey) grew to " + gw(last(S.wind)) + "; bio and small hydro are nearly flat. Solar overtook wind inside the window.",
  });
  setHTML("pv-sources", (last(S.solar) / last(S.wind)).toFixed(1) + pc("×"));
  setHTML("ex-src-solar", gw(last(S.solar)) + pc("GW"));
  setHTML("ex-src-wind", gw(last(S.wind)) + pc("GW"));
  setHTML("ex-src-bio", gw(last(S.bio), 0) + pc("GW"));
  setHTML("ex-src-sh", gw(last(S.small_hydro), 1) + pc("GW"));
  setHTML("ex-src-ratio", (last(S.solar) / last(S.wind)).toFixed(1) + pc("×"));
  setHTML("ex-src-ratio0", (firstV(S.solar) / firstV(S.wind)).toFixed(2) + pc("×"));
  wirePlate(document.getElementById("cb-sources"), plot, "india-atlas_mnre_sources_2020-2026", "month,solar_mw,wind_mw,bio_mw,small_hydro_mw\n" + S.solar.data.map((d, i) => d.date.toISOString().slice(0, 7) + "," + d.value + "," + S.wind.data[i].value + "," + S.bio.data[i].value + "," + S.small_hydro.data[i].value).join("\n"), fmtMY);
  wireLegend(document.getElementById("legend-sources"), plot, ["solar", "wind", "bio", "small_hydro"], store);
}

/* ---------- § 07 solar categories ---------- */
{
  const store = { ground_mounted: { ...SOL.ground_mounted, label: "Ground Mounted", color: "#2E4BD8" }, rooftop: { ...SOL.rooftop, label: "Rooftop (PM Surya Ghar)", color: "#5F6675" } };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 0, d1: 135000 };
  const plot = linePanel(document.getElementById("plot-solar"), ["ground_mounted", "rooftop"], store, geo, {
    yTicks: [30000, 60000, 90000, 120000],
    yLabel: "↑ solar capacity, MW",
    yFmt: (d) => String(d / 1000) + "k",
    xTicks: xTicksM, xFmt: (d) => String(d.getUTCFullYear()),
    endFmt: (v) => gw(v) + " GW",
    crossFmt: (v) => (v == null ? "—" : gw(v) + " GW"),
    gapFrac: 0.08,
    a11yTitle: "Solar capacity by sub-category, All India, monthly Jan 2020 to " + LATEST_SHORT,
    a11yDesc: "Ground mounted (blue) reaches " + gw(last(SOL.ground_mounted)) + " GW; rooftop (grey) reaches " + gw(last(SOL.rooftop)) + " GW: rooftop grew nearly nine-fold.",
  });
  setHTML("pv-solar", (last(SOL.rooftop) / last(S.solar) * 100).toFixed(0) + pc("%"));
  setHTML("ex-sol-gm", gw(last(SOL.ground_mounted)) + pc("GW"));
  setHTML("ex-sol-rt", gw(last(SOL.rooftop)) + pc("GW"));
  setHTML("ex-sol-rtshare", (last(SOL.rooftop) / last(S.solar) * 100).toFixed(0) + pc("%"));
  setHTML("ex-sol-rtshare0", (firstV(SOL.rooftop) / firstV(S.solar) * 100).toFixed(0) + pc("%"));
  wirePlate(document.getElementById("cb-solar"), plot, "india-atlas_mnre_solar-categories_2020-2026", "month,ground_mounted_mw,rooftop_mw\n" + SOL.ground_mounted.data.map((d, i) => d.date.toISOString().slice(0, 7) + "," + d.value + "," + SOL.rooftop.data[i].value).join("\n"), fmtMY);
  wireLegend(document.getElementById("legend-solar"), plot, ["ground_mounted", "rooftop"], store);
}

/* ---------- § 08 plate 4 : state buildout over time ---------- */
{
  // top 6 states by Grand Total, latest month
  const topKeys = Object.entries(statesBundle.series)
    .map(([k, s]) => ({ k, label: s.label.split(" · ")[1], v: s.data.at(-1) }))
    .filter((d) => d.v != null && d.v > 0)
    .sort((a, b) => b.v - a.v).slice(0, 6);
  const store = {};
  topKeys.forEach((d, i) => {
    store[d.k] = { ...ST[d.k], label: d.label, color: i < 2 ? "#2E4BD8" : ["#5F6675","#878D99","#A3A9B4","#C9CED6"][i - 2] || "#C9CED6" };
  });
  const keys = topKeys.map((d) => d.k);
  const totalAI = last(S.grand_total);
  const gr2Share = (topKeys[0].v + topKeys[1].v) / totalAI * 100;
  const next4Share = topKeys.slice(2, 6).reduce((a, d) => a + d.v, 0) / totalAI * 100;
  setHTML("pv-sttime", gr2Share.toFixed(0) + pc("%"));
  // state names come from the ranking, never typed into the page: the leaders can change
  const tc = (t) => t.replace(/\b\w/g, (c) => c.toUpperCase());
  setTxt("ex-st-n1", tc(topKeys[0].label)); setTxt("ex-st-n2", tc(topKeys[1].label));
  setHTML("ex-st-gj", gw(topKeys[0].v) + pc("GW"));
  setHTML("ex-st-rj", gw(topKeys[1].v) + pc("GW"));
  setHTML("ex-st-gr2", gr2Share.toFixed(0) + pc("%"));
  const n4 = topKeys.slice(2, 6).map((d) => tc(d.label));
  setTxt("ex-st-next4n", n4.slice(0, -1).join(", ") + " and " + n4.at(-1));
  setHTML("ex-st-next4", next4Share.toFixed(0) + pc("%"));

  const geo = { W: 1184, H: 460, ml: 70, mr: 230, mt: 30, mb: 42, d0: 0, d1: 58000 };
  const plot = linePanel(document.getElementById("plot-sttime"), keys, store, geo, {
    yTicks: [10000, 20000, 30000, 40000, 50000],
    yLabel: "↑ installed capacity by state, MW",
    yFmt: (d) => String(d / 1000) + "k",
    xTicks: xTicksM, xFmt: (d) => String(d.getUTCFullYear()),
    leadWidth: 2.5,
    endFmt: (v) => gw(v, 0) + " GW",
    crossFmt: (v) => (v == null ? "—" : gw(v, 0) + " GW"),
    gapFrac: 0.05,
    preMarks: [Plot.ruleX([breakDate], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" })],
    a11yTitle: "Grand Total renewable capacity, top six states, monthly Jan 2020 to " + LATEST_SHORT,
    a11yDesc: "Six rising lines. " + topKeys[0].label + " leads at " + gw(topKeys[0].v) + " GW, " + topKeys[1].label + " at " + gw(topKeys[1].v) + "; together " + gr2Share.toFixed(0) + " per cent of all-India. The Dec 2023 hydro reclassification steps up states with large hydro.",
  });
  wirePlate(document.getElementById("cb-sttime"), plot, "india-atlas_mnre_top-states-timeseries_2020-2026", "month," + keys.join(",") + "\n" + ST[keys[0]].data.map((d, i) => d.date.toISOString().slice(0, 7) + "," + keys.map((k) => ST[k].data[i].value ?? "").join(",")).join("\n"), fmtMY);
  wireLegend(document.getElementById("legend-sttime"), plot, keys, store);
}

/* ---------- § 08 dual strip : solar by state + total by state ---------- */
{
  // long UT names would spill past the y-axis margin and clip at the frame
  const SHORT_STATE = {
    "The Dadra and Nagar Haveli and Daman and Diu": "DNH & Daman & Diu",
    "Dadra and Nagar Haveli and Daman and Diu": "DNH & Daman & Diu",
    "Andaman and Nicobar Islands": "Andaman & Nicobar Is.",
  };
  const shortState = (s) => SHORT_STATE[s] || s;
  const makeStrip = (entries, totalAI, label) => {
    const rows = entries.filter((d) => d.v != null && d.v > 0).sort((a, b) => b.v - a.v);
    const geo = { W: 1184, H: 30 + rows.length * 22 + 40, ml: 200, mr: 90, mt: 30, mb: 40 };
    const xTicks = label.includes("Solar") ? [0, 10000, 20000, 30000, 40000] : [0, 10000, 20000, 30000, 40000, 50000];
    const isTop = (d, i) => i < 2;
    return Plot.plot({
      width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
      style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
      x: { label: label + ", GW →", labelAnchor: "right", labelArrow: false, domain: [0, rows[0].v * 1.12], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 0 ? "0" : String(d / 1000)) },
      y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
      marks: [
        Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
        Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
        Plot.ruleY(rows, { y: "state", x1: 0, x2: "v", stroke: (d, i) => (isTop(d, i) ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
        Plot.dot(rows, { y: "state", x: "v", fill: (d, i) => (isTop(d, i) ? "#2E4BD8" : "#5F6675"), r: 5.5 }),
        Plot.text(rows, { y: "state", x: "v", dx: 12, text: (d) => gw(d.v, 1) + " GW", fill: (d, i) => (isTop(d, i) ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono, fontWeight: (d, i) => (isTop(d, i) ? 500 : 400), textAnchor: "start" }),
      ],
    });
  };

  // solar by state
  const solarEntries = Object.entries(solarStatesBundle.series).map(([k, s]) => ({ state: shortState(s.label.split(" · ")[1] || k), v: s.data.at(-1) }));
  const plotSolSt = makeStrip(solarEntries, last(S.grand_total), "Solar capacity");
  a11y(plotSolSt, "Solar Power Total capacity by state, " + LATEST_SHORT, (() => { const r = solarEntries.sort((a, b) => b.v - a.v); return "Sorted dot strip. " + r[0].state + " leads at " + gw(r[0].v) + " GW, then " + r[1].state + "."; })());
  document.getElementById("plot-solar-states").append(plotSolSt);

  // total by state
  const totalEntries = Object.entries(statesBundle.series).map(([k, s]) => ({ state: shortState(s.label.split(" · ")[1] || k), v: s.data.at(-1) }));
  const plotTotSt = makeStrip(totalEntries, last(S.grand_total), "Grand Total capacity");
  a11y(plotTotSt, "Grand Total renewable capacity by state, " + LATEST_SHORT, (() => { const r = totalEntries.sort((a, b) => b.v - a.v); return "Sorted dot strip. " + r[0].state + " leads at " + gw(r[0].v) + " GW, then " + r[1].state + "."; })());
  document.getElementById("plot-states").append(plotTotSt);

  // wire numbers
  const solSorted = solarEntries.filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
  const totSorted = totalEntries.filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
  const totalAI = last(S.grand_total);
  const top5Share = totSorted.slice(0, 5).reduce((a, r) => a + r.v, 0) / totalAI * 100;
  setHTML("pv-states", gw(solSorted[0].v, 0) + pc("GW"));
  setHTML("ex-sst-top", solSorted[0].state + ", " + gw(solSorted[0].v) + pc("GW"));
  setHTML("ex-tst-top", totSorted[0].state + ", " + gw(totSorted[0].v) + pc("GW"));
  setHTML("ex-tst-top5", top5Share.toFixed(0) + pc("%"));

  const csv = "state,solar_mw,total_mw\n" + totSorted.map((r) => { const sol = solSorted.find((s) => s.state === r.state); return `"${r.state}",${sol ? Math.round(sol.v) : ""},${Math.round(r.v)}`; }).join("\n");
  wirePlate(document.getElementById("cb-states"), plotTotSt, "india-atlas_mnre_state-solar-total_2026-06", csv);
}

/* ---------- provenance ---------- */
setTxt("prov-vintage", sourcesBundle.meta.vintage);
setTxt("prov-vintage2", sourcesBundle.meta.vintage);
