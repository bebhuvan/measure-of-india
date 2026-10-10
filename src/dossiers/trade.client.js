// Guide 15, merchandise trade: plates and number wiring.
// Data: the JSON block #trade-data, cut at build time by src/pages/guides/trade.astro from
// data/series/trade-*.json (TradeStat and RBI DBIE bundles). Values are US$ million unless
// a plate says otherwise. The every-cut explorer reads chapters and partners from the same
// block and fetches the finer tables (/data/<bundle>.json, static files) only on request.

import * as Plot from "@observablehq/plot";
import { CHAPTER } from "./trade-chapters.js";
import { MONO as sans, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

const T = JSON.parse(document.getElementById("trade-data")?.textContent || "{}");
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));
const D = (iso) => new Date(iso + "T00:00:00Z");
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fyOf = (iso) => `${iso.slice(0, 4)}-${String((+iso.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
const bn = (v) => fmt.bnFixed1(v / 1000);                 // US$ million -> "$44.3 bn", "−$31.9 bn"
const mn = (v) => "$" + Math.round(v).toLocaleString("en-IN") + " mn";
const pct = (a, b) => (100 * a) / b;
const growth = (a, b) => (a / b - 1) * 100;
const yearTicks = (from, to, step) => { const out = []; for (let y = from; y <= to; y += step) out.push(new Date(Date.UTC(y, 0, 1))); return out; };
const yr = (d) => { const y = d.getUTCFullYear(); return y % 10 === 0 || y === 1970 ? String(y) : "’" + String(y).slice(2); };
const series = (dates, vals, label, color) => ({ label, color, data: dates.map((d, i) => ({ date: D(d), value: vals[i] ?? null })) });
const shortChap = (s, code) => CHAPTER[code] ?? s.replace(/\s*\(HS \d+\)$/, "").replace(/;.*$/, "").slice(0, 46);
const ord = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? "th");
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const bnAbs = (v) => fmt.bnFixed1(Math.abs(v) / 1000);

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  if (!el) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg" && plot) downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png" && plot) downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv()], { type: "text/csv" }), filename + ".csv");
  }));
}
const mount = (id, plot) => { document.getElementById(id)?.append(plot); return plot; };
const csvRows = (header, rows) => [header.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");

/* ---------- title block and § 01 ---------- */
const t = T.total;
const n = t.dates.length - 1;
const ex = t.exports[n], im = t.imports[n], bal = t.balance[n];
const exY = t.exports[n - 12], imY = t.imports[n - 12], balY = t.balance[n - 12];
const latestMonth = monthOf(t.dates[n]), yearAgoMonth = monthOf(t.dates[n - 12]);
setHTML("n-exp", bn(ex));
setHTML("d-exp", `<b>${fmt.pct1Minus(growth(ex, exY))}</b> on ${yearAgoMonth}`);
setHTML("n-imp", bn(im));
setHTML("d-imp", `<b>${fmt.pct1Minus(growth(im, imY))}</b> on ${yearAgoMonth}`);
setHTML("n-bal", bn(bal));
setHTML("d-bal", `<b>${bn(balY)}</b> in ${yearAgoMonth}`);
setHTML("n-ytd", bn(T.ytd.cur[0]));
setHTML("d-ytd", `<b>${fmt.pct1Minus(growth(T.ytd.cur[0], T.ytd.prev[0]))}</b> on the same months a year earlier`);
spark("nspark-exp", series(t.dates.slice(-60), t.exports.slice(-60), "Exports", ACC));
setHTML("rb-big", bn(bal));
setHTML("rb-exp", bn(ex));
if (T.qe) {
  setHTML("qe-month", monthOf(T.qe.date));
  setHTML("qe-exp", bn(T.qe.exports));
  setHTML("qe-imp", bn(T.qe.imports));
}

/* ---------- § 02 eight goods, small multiples ---------- */
{
  const grid = document.getElementById("plot-home");
  const svgs = [];
  for (const g of T.home) {
    const panel = document.createElement("div");
    panel.className = "sm-panel";
    const last = g.values.at(-1);
    const top = Math.max(...g.values.filter((v) => v != null));
    panel.innerHTML = `<div class="sm-t">${g.name}<small>HS ${g.code}, ${g.flow}; scale 0 to ${mn(top)}</small></div><div class="sm-v">${mn(last)}</div>`;
    const data = g.dates.map((d, i) => ({ date: D(d), value: g.values[i] })).filter((d) => d.value != null);
    const max = Math.max(...data.map((d) => d.value));
    const plot = Plot.plot({
      width: 280, height: 130, marginLeft: 4, marginRight: 4, marginTop: 8, marginBottom: 20, style: { ...baseStyle, fontSize: "11px" },
      x: { label: null, tickSize: 0, ticks: [2018, 2022, 2026].map((y) => new Date(Date.UTC(y, 0, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
      y: { axis: null, domain: [0, max * 1.05] },
      marks: [
        Plot.ruleY([0], { stroke: BASE }),
        Plot.lineY(data, { x: "date", y: "value", stroke: g.flow === "exports" ? ACC : GOLD, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([data.at(-1)], { x: "date", y: "value", r: 3, fill: g.flow === "exports" ? ACC : GOLD, stroke: "#fff", strokeWidth: 1.5 }),
      ],
    });
    plot.setAttribute("aria-hidden", "true");
    panel.append(plot);
    grid?.append(panel);
    svgs.push(plot);
  }
  const byCode = Object.fromEntries(T.home.map((g) => [g.code, g]));
  const phone = byCode["8517"];
  setHTML("pv-home", mn(phone.values.at(-1)));
  const p17 = phone.values[phone.dates.indexOf("2017-01-01")], r = T.homeRank;
  setHTML("h-home", `Phone and telecom exports rose from ${mn(p17)} in January 2017 to ${mn(phone.values.at(-1))} in ${latestMonth}, ${r.phone === 1 ? "the largest" : "the " + (["", "", "second", "third", "fourth", "fifth"][r.phone] ?? ord(r.phone)) + "-largest"} of India's ${r.of.toLocaleString("en-IN")} export headings that month${r.phone === 1 ? "" : byCode[r.top] ? ` (behind ${byCode[r.top].name.toLowerCase().replace(/ \(.*\)$/, "")})` : ` (behind HS heading ${r.top})`}`);
  setHTML("ex-h-phone", mn(phone.values.at(-1)));
  setHTML("ex-h-phone17", mn(phone.values[phone.dates.indexOf("2017-01-01")]));
  setHTML("ex-h-crude", mn(byCode["2709"].values.at(-1)));
  setHTML("ex-h-gold", mn(byCode["7108"].values.at(-1)));
  const q = T.qty;
  const mt = (v) => (v / 1e6).toFixed(1) + " million tonnes";
  setHTML("lv-oil", mt(q.vegoil));
  setHTML("lv-gold", Math.round(q.gold / 1000).toLocaleString("en-IN") + " tonnes");
  setHTML("lv-crude", mt(q.crude));
  setHTML("lv-rice", mt(q.riceB + q.riceNB));
  wirePlate("cb-home", null, "india-atlas_trade-eight-goods", () => {
    const dates = T.home[0].dates;
    return csvRows(["month", ...T.home.map((g) => `${g.flow} HS ${g.code} ${g.name} (US$ mn)`)], dates.map((d, i) => [d, ...T.home.map((g) => g.values[g.dates.indexOf(d)])]));
  });
}

/* ---------- § 04 the long view ---------- */
{
  const L = T.long, i = L.dates.length - 1;
  const X = series(L.dates, L.exports.map((v) => v / 1000), "Exports", ACC), M = series(L.dates, L.imports.map((v) => v / 1000), "Imports", GOLD);
  const top = Math.ceil(Math.max(...L.imports) / 1000 / 100) * 100;
  // the band between the two lines is the deficit: it is anchored on exports, not on zero
  const gapBand = L.dates.map((d, k) => ({ date: D(d), lo: L.exports[k] / 1000, hi: L.imports[k] / 1000 })).filter((d) => d.lo != null && d.hi != null);
  const ends = [{ ...X.data.at(-1), t: `Exports ${bn(L.exports[i])}`, c: ACC }, { ...M.data.at(-1), t: `Imports ${bn(L.imports[i])}`, c: GOLD }];
  const plot = Plot.plot({
    width: W, height: 480, marginLeft: 48, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 3, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ US$ billion", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.areaY(gapBand, { x: "date", y1: "lo", y2: "hi", fill: "#F4F6FD" }),
      Plot.lineY(M.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.lineY(X.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.c, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "value", text: "t", dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5 }),
    ],
  });
  a11y(plot, "India's merchandise exports and imports since 1970-71", `Exports ${bn(L.exports[i])} and imports ${bn(L.imports[i])} in ${fyOf(L.dates[i])}; ${bn(L.exports[0])} and ${bn(L.imports[0])} in 1970-71.`);
  mount("plot-long", plot);
  addCrosshair(document.getElementById("plot-long"), plot, [X, M], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : "$" + v.toFixed(1) + " bn"));
  setHTML("pv-long", bn(L.balance[i]));
  setHTML("ex-l-exp", bn(L.exports[i]));
  setHTML("ex-l-imp", bn(L.imports[i]));
  setHTML("ex-l-bal", bn(L.balance[i]));
  const i90 = L.dates.indexOf("1990-04-01");
  setHTML("ex-l-x", fmt.num1(L.exports[i] / L.exports[i90]));
  const surplus = L.dates.filter((d, k) => L.balance[k] > 0).map(fyOf);
  const words = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a.at(-1));
  setHTML("ex-l-surp", surplus.length ? `${surplus.length === 1 ? "one year" : surplus.length + " years"}, ${words(surplus)}` : "none of these years");
  const narrow = L.dates.map((d, k) => (k ? { fy: fyOf(d), dv: L.balance[k] - L.balance[k - 1], im: L.imports[k] - L.imports[k - 1] } : null)).filter((r) => r && r.dv > 0 && r.im < 0).sort((a, b) => b.dv - a.dv).slice(0, 2);
  setHTML("ex-l-narrow", words(narrow.map((r) => r.fy)));
  setHTML("h-long", `India has bought more than it sold in ${L.dates.length - surplus.length} of the ${L.dates.length} years since 1970-71, and the gap has widened as trade grew`);
  wirePlate("cb-long", plot, "india-atlas_trade-since-1970", () => csvRows(["financial_year", "exports_usd_mn", "imports_usd_mn", "balance_usd_mn"], L.dates.map((d, k) => [fyOf(d), L.exports[k], L.imports[k], L.balance[k]])));
}
{
  const X = series(t.dates, t.exports.map((v) => v / 1000), "Exports", ACC), M = series(t.dates, t.imports.map((v) => v / 1000), "Imports", GOLD), B = series(t.dates, t.balance.map((v) => v / 1000), "Balance", MUTED);
  const lo = Math.floor(Math.min(...t.balance) / 1000 / 10) * 10, hi = Math.ceil(Math.max(...t.imports) / 1000 / 10) * 10;
  const plot = Plot.plot({
    width: W, height: 480, marginLeft: 48, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2017, 2026, 1), tickFormat: yr },
    y: { label: "↑ US$ billion", labelAnchor: "top", labelArrow: false, domain: [lo, hi], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(B.data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.lineY(M.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.lineY(X.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
      Plot.text([X.data.at(-1), M.data.at(-1), B.data.at(-1)], { x: "date", y: "value", text: (d, k) => ["Exports", "Imports", "Balance"][k] + " " + (d.value < 0 ? "−$" : "$") + Math.abs(d.value).toFixed(1) + " bn", dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5 }),
    ],
  });
  a11y(plot, "India's monthly merchandise trade since January 2017", `In ${latestMonth} exports ${bn(ex)}, imports ${bn(im)}, balance ${bn(bal)}.`);
  mount("plot-month", plot);
  addCrosshair(document.getElementById("plot-month"), plot, [X, M, B], null, (d) => monthOf(d.toISOString()), (v) => (v == null ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(1) + " bn"));
  setHTML("pv-month", bn(bal));
  setHTML("ex-m-bal", bn(bal));
  setHTML("ex-m-bal1", bn(balY));
  let kmin = 0; t.balance.forEach((v, k) => { if (v < t.balance[kmin]) kmin = k; });
  setHTML("ex-m-max", bn(t.balance[kmin]));
  setHTML("ex-m-maxd", monthOf(t.dates[kmin]));
  const fyMonths = {};
  t.dates.forEach((d, k) => { const y = +d.slice(0, 4), m = +d.slice(5, 7), f = m >= 4 ? y : y - 1; (fyMonths[f] ??= []).push([m, t.exports[k]]); });
  const full = Object.values(fyMonths).filter((a) => a.length === 12);
  const marchTop = full.filter((a) => a.reduce((p, c) => (c[1] > p[1] ? c : p))[0] === 3).length;
  setHTML("ex-m-march", `${marchTop} of ${full.length}`);
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const first12 = avg(t.balance.slice(0, 12)), last12 = avg(t.balance.slice(-12));
  setHTML("h-month", first12 < 0 && last12 < 0
    ? `The monthly trade deficit averaged ${bnAbs(last12)} over the last twelve months, against ${bnAbs(first12)} a month in 2017`
    : `India's monthly trade balance averaged ${bn(last12)} over the last twelve months, against ${bn(first12)} in 2017`);
  wirePlate("cb-month", plot, "india-atlas_trade-monthly", () => csvRows(["month", "exports_usd_mn", "imports_usd_mn", "balance_usd_mn", "print"], t.dates.map((d, k) => [d, t.exports[k], t.imports[k], t.balance[k], t.revision?.[d] ?? ""])));
}

/* ---------- § 05 oil and gold ---------- */
{
  const rows = T.oilgold.flatMap((r) => [["Petroleum", r.pet], ["Gold", r.gold], ["Everything else", r.rest]].map(([part, v]) => ({ fy: r.fy, part, v: v / 1000 })));
  const order = ["Petroleum", "Gold", "Everything else"];
  const totals = T.oilgold.map((r) => ({ fy: r.fy, v: r.bal / 1000 }));
  const lo = Math.floor(Math.min(...T.oilgold.map((r) => Math.min(0, r.pet) + Math.min(0, r.gold) + Math.min(0, r.rest))) / 1000 / 50) * 50;
  const hi = Math.max(50, Math.ceil(Math.max(...T.oilgold.map((r) => Math.max(0, r.rest) + Math.max(0, r.pet) + Math.max(0, r.gold))) / 1000 / 50) * 50);
  const plot = Plot.plot({
    width: W, height: 480, marginLeft: 52, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.3, tickFormat: (fy) => (T.oilgold.findIndex((r) => r.fy === fy) % 2 === 0 || fy === T.oilgold.at(-1).fy ? fy : "") },
    y: { label: "↑ US$ billion (below zero: deficit)", labelAnchor: "top", labelArrow: false, domain: [lo, hi], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)) },
    color: { domain: order, range: [ACC, GOLD, "#C9CED6"] },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.barY(rows, { x: "fy", y: "v", fill: "part", order, insetLeft: 0.5, insetRight: 0.5 }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.tickY(totals, { x: "fy", y: "v", stroke: INK, strokeWidth: 2 }),
    ],
  });
  const L = T.oilgold.at(-1);
  a11y(plot, "India's trade deficit split into petroleum, gold and everything else", `${L.fy}: deficit ${bn(L.bal)}, petroleum ${bn(L.pet)}, gold ${bn(L.gold)}, everything else ${bn(L.rest)}.`);
  mount("plot-oilgold", plot);
  setHTML("pv-oilgold", fmt.pct1(pct(L.pet + L.gold, L.bal)));
  const shares = T.oilgold.map((r) => pct(r.pet + r.gold, r.bal));
  setHTML("h-oilgold", Math.min(...shares) > 50
    ? `Oil and gold made up more than half of India's trade deficit in every year since ${T.oilgold[0].fy}; the rest has grown from ${bnAbs(T.oilgold[0].rest)} to ${bnAbs(L.rest)}`
    : `Oil and gold made up ${fmt.pct1(shares.at(-1))} of India's trade deficit in ${L.fy}`);
  setHTML("ex-og-bal", bn(L.bal));
  setHTML("ex-og-pet", bn(L.pet));
  setHTML("ex-og-gold", bn(L.gold));
  setHTML("ex-og-rest", bn(L.rest));
  wirePlate("cb-oilgold", plot, "india-atlas_trade-deficit-oil-gold", () => csvRows(["financial_year", "balance_usd_mn", "petroleum_balance_usd_mn", "gold_balance_usd_mn", "everything_else_usd_mn", "print"], T.oilgold.map((r) => [r.fy, r.bal, r.pet, r.gold, r.rest, r.flag])));
}
{
  const O = T.oilm;
  const oil = series(O.dates, O.oil.map((v) => (v == null ? null : v / 1000)), "Oil", ACC), non = series(O.dates, O.nonoil.map((v) => (v == null ? null : v / 1000)), "Non-oil", "#A3A9B4");
  const lo = Math.floor(Math.min(...O.oil.filter((v) => v != null), ...O.nonoil.filter((v) => v != null)) / 1000 / 5) * 5;
  const hi = Math.max(5, Math.ceil(Math.max(...O.oil.filter((v) => v != null), ...O.nonoil.filter((v) => v != null)) / 1000 / 5) * 5);
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 48, marginRight: 160, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1998, 2026, 4), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ US$ billion a month (below zero: deficit)", labelAnchor: "top", labelArrow: false, domain: [lo, hi], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(non.data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.25, strokeLinejoin: "round" }),
      Plot.lineY(oil.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.text([oil.data.at(-1), non.data.at(-1)], { x: "date", y: "value", text: (d, k) => ["Oil", "Non-oil"][k] + " " + (d.value < 0 ? "−$" : "$") + Math.abs(d.value).toFixed(1) + " bn", dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5 }),
    ],
  });
  const k = O.dates.length - 1;
  a11y(plot, "India's monthly trade balance in oil and in everything else since 1997", `${monthOf(O.dates[k])}: oil ${bn(O.oil[k])}, non-oil ${bn(O.nonoil[k])}.`);
  mount("plot-oilm", plot);
  addCrosshair(document.getElementById("plot-oilm"), plot, [oil, non], null, (d) => monthOf(d.toISOString()), (v) => (v == null ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(1) + " bn"));
  setHTML("pv-oilm", bn(O.oil[k]));
  setHTML("ex-om-oil", bn(O.oil[k]));
  setHTML("ex-om-non", bn(O.nonoil[k]));
  setHTML("ex-om-rev", O.lastRev === "Provisional" ? "provisional" : "final");
  wirePlate("cb-oilm", plot, "india-atlas_trade-oil-non-oil-balance", () => csvRows(["month", "balance_usd_mn", "oil_balance_usd_mn", "non_oil_balance_usd_mn"], O.dates.map((d, j) => [d, O.balance[j], O.oil[j], O.nonoil[j]])));
}

/* ---------- § 06 groups and chapters: horizontal bars with the earlier year as a circle ---------- */
function dumbbell(id, rows, color, { label = "US$ billion", hl = () => false } = {}) {
  const max = Math.max(...rows.map((r) => Math.max(r.a ?? 0, r.b ?? 0)));
  const xMax = Math.ceil(max / (max > 100 ? 50 : 10)) * (max > 100 ? 50 : 10);
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 30, marginLeft: 330, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [0, xMax], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "b", fill: (d) => (hl(d) ? color : color === ACC ? "#AAB8F2" : "#E7C38E"), insetTop: 8, insetBottom: 8 }),
      Plot.dot(rows.filter((r) => r.a != null), { y: "name", x: "a", r: 4, fill: "#fff", stroke: MUTED, strokeWidth: 1.5 }),
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.b ?? 0, d.a ?? 0), text: (d) => "$" + (d.b ?? 0).toFixed(1), dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  return mount(id, plot);
}
const cleanGroup = (s) => s.replace(/Electorinics/i, "Electronics").replace(/Electoronics/i, "Electronics").replace(/^Articles of stone.*$/i, "Stone, ceramics and glass").replace(/\s+items$/i, "");
for (const [flow, id, color] of [["exports", "sell", ACC], ["imports", "buy", GOLD]]) {
  const G = T.groups[flow].map((g) => ({ name: cleanGroup(g.label), a: g.first / 1000, b: g.last / 1000, key: g.key })).sort((x, y) => y.b - x.b);
  const hlKey = flow === "exports" ? "g14" : "g20";
  const plot = dumbbell(`plot-${id}`, G, color, { hl: (d) => d.key === hlKey });
  a11y(plot, `India's ${flow} by principal-commodity group`, G.slice(0, 5).map((g) => `${g.name} $${g.b.toFixed(1)} bn`).join(", "));
  const pick = G.find((g) => g.key === hlKey);
  setHTML(`pv-${id}`, fmt.bnFixed1(pick.b));
  const tag = flow === "exports" ? "s" : "b";
  G.slice(0, 3).forEach((g, k) => setHTML(`ex-${tag}-${k + 1}`, `${g.name.toLowerCase()} (${fmt.bnFixed1(g.b)})`));
  if (flow === "exports") {
    setHTML("ex-s-el0", fmt.bnFixed1(pick.a)); setHTML("ex-s-el1", fmt.bnFixed1(pick.b));
    setHTML("h-sell", `Electronics exports grew ${fmt.num1(pick.b / pick.a)} times between ${T.groups.firstFy} and ${T.groups.lastFy}, to ${ord(G.indexOf(pick) + 1)} place among India's ${G.length} export groups`);
  } else {
    setHTML("h-buy", `${cap(G[0].name.toLowerCase())}, ${G[1].name.toLowerCase()} and ${G[2].name.toLowerCase()} are what India buys most: ${fmt.pct1(pct(G[0].b + G[1].b + G[2].b, T.groups.totalM[1] / 1000))} of its imports in ${T.groups.lastFy}`);
  }
  wirePlate(`cb-${id}`, plot, `india-atlas_trade-${flow}-by-group`, () => csvRows(["group", `${T.groups.firstFy}_usd_mn`, `${T.groups.lastFy}_usd_mn`], T.groups[flow].map((g) => [cleanGroup(g.label), g.first, g.last])));
}

for (const [flow, id, color] of [["exports", "chapx", ACC], ["imports", "chapm", GOLD]]) {
  const C = T.chapters[flow];
  const rows = C.rows.slice(0, 12).map((r) => ({ name: `${shortChap(r.label, r.code)} (${r.code})`, a: r.prev / 1000, b: r.last / 1000, code: r.code }));
  const plot = dumbbell(`plot-${id}`, rows, color, { hl: (d, ) => d === rows[0] });
  a11y(plot, `India's ${flow} by HS chapter, ${C.fy}`, rows.map((r) => `${r.name} $${r.b.toFixed(1)} bn`).join(", "));
  const share = pct(C.rows.slice(0, 12).reduce((s, r) => s + r.last, 0), C.total);
  setHTML(`pv-${id}`, fmt.pct1(share));
  const tag = flow === "exports" ? "x" : "m";
  setHTML(`ex-c-${tag}1`, shortChap(C.rows[0].label, C.rows[0].code).toLowerCase() + ` (HS ${C.rows[0].code})`);
  setHTML(`ex-c-${tag}1v`, bn(C.rows[0].last));
  setHTML(`ex-c-${tag}2`, shortChap(C.rows[1].label, C.rows[1].code).toLowerCase() + ` (HS ${C.rows[1].code})`);
  setHTML(`ex-c-${tag}2v`, bn(C.rows[1].last));
  setHTML(`h-${id}`, `${shortChap(C.rows[0].label, C.rows[0].code)} led India's ${flow} in ${C.fy}, ahead of ${shortChap(C.rows[1].label, C.rows[1].code).toLowerCase()}; the top twelve chapters made up ${fmt.pct1(share)} of the total`);
  wirePlate(`cb-${id}`, plot, `india-atlas_trade-${flow}-by-chapter`, () => csvRows(["hs_chapter", "description", `${C.prevFy}_usd_mn`, `${C.fy}_usd_mn`], C.rows.map((r) => [r.code, r.label, r.prev, r.last])));
}

/* ---------- § 07 partners ---------- */
{
  const P = T.partners;
  const rows = [...P.deficits, ...P.surpluses.slice().reverse()].map((r) => ({ name: r.name, v: r.bal / 1000 }));
  const lo = Math.floor((Math.min(...rows.map((r) => r.v)) - 18) / 20) * 20, hi = Math.ceil((Math.max(...rows.map((r) => r.v)) + 10) / 20) * 20;
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 28, marginLeft: 180, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [lo, hi], tickSize: 0, tickPadding: 8, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (d.v < 0 ? GOLD : ACC), insetTop: 7, insetBottom: 7 }),
      Plot.text(rows.filter((r) => r.v < 0), { y: "name", x: "v", text: (d) => "−$" + Math.abs(d.v).toFixed(1), dx: -8, textAnchor: "end", fill: INK, fontSize: 12 }),
      Plot.text(rows.filter((r) => r.v >= 0), { y: "name", x: "v", text: (d) => "$" + d.v.toFixed(1), dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.ruleX([0], { stroke: INK, strokeOpacity: 0.4 }),
    ],
  });
  a11y(plot, `India's trade balance with its largest deficit and surplus partners, ${P.fy}`, rows.map((r) => `${r.name} ${r.v.toFixed(1)}`).join(", "));
  mount("plot-partners", plot);
  const cn = P.deficits.find((r) => r.key === "china"), us = P.surpluses.find((r) => r.key === "united_states");
  const the = (nm) => (/^(United|Netherlands|Philippines)/.test(nm) ? "the " + nm : nm);
  setHTML("h-partners", `India's largest trade deficit is with ${the(P.deficits[0].name)} (${bn(P.deficits[0].bal)}); its largest surplus is with ${the(P.surpluses[0].name)} (${bn(P.surpluses[0].bal)})`);
  setHTML("pv-partners", bn(cn?.bal));
  setHTML("ex-p-n", String(P.inDeficit));
  setHTML("ex-p-of", String(P.n));
  setHTML("ex-p-cn", bn(cn?.bal));
  setHTML("ex-p-us", bn(us?.bal));
  wirePlate("cb-partners", plot, "india-atlas_trade-balance-by-partner", () => csvRows(["partner", "exports_usd_mn", "imports_usd_mn", "balance_usd_mn"], [...P.deficits, ...P.surpluses].map((r) => [r.name, r.exp, r.imp, r.bal])));
}
{
  const C = T.chinaus, k = C.dates.length - 1;
  const cn = series(C.dates, C.china.bal.map((v) => (v == null ? null : v / 1000)), "China", GOLD), us = series(C.dates, C.usa.bal.map((v) => (v == null ? null : v / 1000)), "United States", ACC);
  const lo = Math.floor(Math.min(...C.china.bal.filter((v) => v != null)) / 1000 / 20) * 20, hi = Math.ceil(Math.max(...C.usa.bal.filter((v) => v != null)) / 1000 / 20) * 20;
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 48, marginRight: 200, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2011, 2025, 2).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 3, 1))), tickFormat: (d) => fyOf(d.toISOString()) },
    y: { label: "↑ US$ billion (below zero: deficit)", labelAnchor: "top", labelArrow: false, domain: [lo, hi], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(cn.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 2, strokeLinejoin: "round" }),
      Plot.lineY(us.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
      Plot.text([us.data.at(-1), cn.data.at(-1)], { x: "date", y: "value", text: (d, j) => ["United States", "China"][j] + " " + (d.value < 0 ? "−$" : "$") + Math.abs(d.value).toFixed(1) + " bn", dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5 }),
    ],
  });
  a11y(plot, "India's trade balance with China and the United States since 2009-10", `${fyOf(C.dates[k])}: China ${bn(C.china.bal[k])}, United States ${bn(C.usa.bal[k])}.`);
  mount("plot-chinaus", plot);
  addCrosshair(document.getElementById("plot-chinaus"), plot, [us, cn], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(1) + " bn"));
  setHTML("pv-chinaus", bn(C.china.imp[k]));
  setHTML("h-chinaus", `The deficit with China grew from ${bnAbs(C.china.bal[0])} in ${fyOf(C.dates[0])} to ${bnAbs(C.china.bal[k])} in ${fyOf(C.dates[k])}; the surplus with the United States from ${bnAbs(C.usa.bal[0])} to ${bnAbs(C.usa.bal[k])}`);
  setHTML("ex-cu-cnm", bn(C.china.imp[k]));
  setHTML("ex-cu-cnx", bn(C.china.exp[k]));
  setHTML("ex-cu-usx", bn(C.usa.exp[k]));
  setHTML("ex-cu-usm", bn(C.usa.imp[k]));
  wirePlate("cb-chinaus", plot, "india-atlas_trade-china-united-states", () => csvRows(["financial_year", "china_exports", "china_imports", "china_balance", "us_exports", "us_imports", "us_balance"], C.dates.map((d, j) => [fyOf(d), C.china.exp[j], C.china.imp[j], C.china.bal[j], C.usa.exp[j], C.usa.imp[j], C.usa.bal[j]])));
}
if (T.cxc) {
  const rows = [...T.cxc.us.rows.map((r) => ({ name: `To the US: ${shortChap(r.label, r.code)} (${r.code})`, v: r.last / 1000, c: ACC })), ...T.cxc.china.rows.map((r) => ({ name: `From China: ${shortChap(r.label, r.code)} (${r.code})`, v: r.last / 1000, c: GOLD }))];
  const xMax = Math.ceil(Math.max(...rows.map((r) => r.v)) / 5) * 5;
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 28, marginLeft: 380, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "US$ billion", labelAnchor: "right", labelArrow: false, domain: [0, xMax], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: "c", insetTop: 7, insetBottom: 7 }),
      Plot.text(rows, { y: "name", x: "v", text: (d) => "$" + d.v.toFixed(1), dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "What India sells to the United States and buys from China", rows.map((r) => `${r.name} $${r.v.toFixed(1)} bn`).join(", "));
  mount("plot-cxc", plot);
  const elec = T.cxc.china.rows.find((r) => r.code === "85");
  setHTML("pv-cxc", bn(elec?.last ?? 0));
  setHTML("sub-cxc", T.cxc.us.fy);
  setHTML("ex-x-us1", shortChap(T.cxc.us.rows[0].label, T.cxc.us.rows[0].code).toLowerCase());
  setHTML("ex-x-us1v", bn(T.cxc.us.rows[0].last));
  setHTML("ex-x-cn1", shortChap(T.cxc.china.rows[0].label, T.cxc.china.rows[0].code).toLowerCase());
  setHTML("ex-x-cn1v", bn(T.cxc.china.rows[0].last));
  wirePlate("cb-cxc", plot, "india-atlas_trade-us-china-by-chapter", () => csvRows(["direction", "hs_chapter", "description", "usd_mn"], [...T.cxc.us.rows.map((r) => ["exports to United States", r.code, r.label, r.last]), ...T.cxc.china.rows.map((r) => ["imports from China", r.code, r.label, r.last])]));
}
{
  const R = T.regions.filter((r) => r.exp != null || r.imp != null).sort((a, b) => (b.exp + b.imp) - (a.exp + a.imp));
  const rows = R.flatMap((r) => [{ name: r.name, f: "Exports", v: (r.exp ?? 0) / 1000 }, { name: r.name, f: "Imports", v: (r.imp ?? 0) / 1000 }]);
  const xMax = Math.ceil(Math.max(...rows.map((r) => r.v)) / 50) * 50;
  const plot = Plot.plot({
    width: W, height: 44 + R.length * 56, marginLeft: 200, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "US$ billion", labelAnchor: "right", labelArrow: false, domain: [0, xMax], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: R.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows.filter((r) => r.f === "Exports"), { y: "name", x: "v", fill: ACC, insetTop: 10, insetBottom: 30 }),
      Plot.barX(rows.filter((r) => r.f === "Imports"), { y: "name", x: "v", fill: GOLD, insetTop: 30, insetBottom: 10 }),
      Plot.text(rows.filter((r) => r.f === "Exports"), { y: "name", x: "v", text: (d) => "$" + d.v.toFixed(1), dx: 8, dy: -10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.text(rows.filter((r) => r.f === "Imports"), { y: "name", x: "v", text: (d) => "$" + d.v.toFixed(1), dx: 8, dy: 10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  a11y(plot, `India's exports and imports by region, ${T.partners.fy}`, R.map((r) => `${r.name}: exports ${bn(r.exp)}, imports ${bn(r.imp)}`).join("; "));
  mount("plot-regions", plot);
  const asia = T.regions.find((r) => /^Asia$/i.test(r.name));
  const tx = T.regions.reduce((s, r) => s + (r.exp ?? 0), 0), tm = T.regions.reduce((s, r) => s + (r.imp ?? 0), 0);
  setHTML("pv-regions", fmt.pct1(pct(asia.imp, tm)));
  const bigX = T.regions.reduce((a, r) => ((r.exp ?? 0) > (a.exp ?? 0) ? r : a)), bigM = T.regions.reduce((a, r) => ((r.imp ?? 0) > (a.imp ?? 0) ? r : a));
  setHTML("h-regions", bigX === asia && bigM === asia ? `Asia is India's biggest market and its biggest supplier: ${fmt.pct1(pct(asia.exp, tx))} of exports go there and ${fmt.pct1(pct(asia.imp, tm))} of imports come from there` : `${bigX.name} buys most of India's exports; ${bigM.name} supplies most of its imports`);
  setHTML("ex-r-ax", fmt.pct1(pct(asia.exp, tx)));
  setHTML("ex-r-am", fmt.pct1(pct(asia.imp, tm)));
  wirePlate("cb-regions", plot, "india-atlas_trade-by-region", () => csvRows(["region", "exports_usd_mn", "imports_usd_mn"], T.regions.map((r) => [r.name, r.exp, r.imp])));
}

/* ---------- § 08 prices and volumes, tonnes, the rupee ---------- */
{
  const P = T.tot, k = P.dates.length - 1;
  const S = [series(P.dates, P.uviX, "Export prices", ACC), series(P.dates, P.uviM, "Import prices", GOLD), series(P.dates, P.qiX, "Export volume", ACC), series(P.dates, P.qiM, "Import volume", "#A3A9B4")];
  const all = [...P.uviX, ...P.uviM, ...P.qiX, ...P.qiM].filter((v) => v != null);
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 48, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: P.dates.filter((_, j) => j % 2 === 0).map(D), tickFormat: (d) => fyOf(d.toISOString()) },
    y: { label: "↑ index, 2012-13 = 100", labelAnchor: "top", labelArrow: false, domain: [Math.min(50, Math.floor(Math.min(...all) / 10) * 10), Math.ceil(Math.max(...all) / 20) * 20], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([100], { stroke: BASE }),
      Plot.lineY(S[3].data, { x: "date", y: "value", stroke: "#A3A9B4", strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.lineY(S[2].data, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.5, strokeDasharray: "4 3", strokeLinejoin: "round" }),
      Plot.lineY(S[1].data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 2, strokeLinejoin: "round" }),
      Plot.lineY(S[0].data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
    ],
  });
  a11y(plot, "Unit value and quantum indices of India's trade, 2012-13 = 100", `${fyOf(P.dates[k])}: export prices ${fmt.num1(P.uviX[k])}, import prices ${fmt.num1(P.uviM[k])}.`);
  mount("plot-tot", plot);
  addCrosshair(document.getElementById("plot-tot"), plot, S, null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : v.toFixed(1)));
  setHTML("pv-tot", fmt.num1(P.net[k]));
  const g0 = (a) => { const j = a.findIndex((v) => v != null); return { j, v: a[j] }; };
  const lastOf = (a) => { for (let j = a.length - 1; j >= 0; j--) if (a[j] != null) return { j, v: a[j] }; return null; };
  const mP = g0(P.uviM), mPl = lastOf(P.uviM), mV = g0(P.qiM), mVl = lastOf(P.qiM);
  setHTML("h-tot", `Between ${fyOf(P.dates[mP.j])} and ${fyOf(P.dates[mPl.j])}, the volume of India's imports rose ${fmt.pct0(growth(mVl.v, mV.v))} and their average price ${fmt.pct0(growth(mPl.v, mP.v))}`);
  setHTML("ex-t-ux", fmt.num1(P.uviX[k]));
  setHTML("ex-t-um", fmt.num1(P.uviM[k]));
  setHTML("ex-t-withheld", P.withheld ? "The export volume index for the latest year is not shown: the RBI's table prints a figure that cannot be reconciled with the value of exports." : "No point is withheld.");
  wirePlate("cb-tot", plot, "india-atlas_trade-prices-volumes", () => csvRows(["financial_year", "export_unit_value", "import_unit_value", "export_quantum", "import_quantum", "net_terms_of_trade"], P.dates.map((d, j) => [fyOf(d), P.uviX[j], P.uviM[j], P.qiX[j], P.qiM[j], P.net[j]])));
}
{
  const C = T.crude, k = C.dates.length - 1;
  const I = series(C.dates, C.imports, "Imported", GOLD), Pr = series(C.dates, C.production, "Produced in India", "#5F6675");
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 190, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1975, 2025, 5).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 3, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ million tonnes", labelAnchor: "top", labelArrow: false, domain: [0, Math.ceil(Math.max(...C.imports.filter((v) => v != null)) / 50) * 50], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(Pr.data, { x: "date", y: "value", stroke: "#5F6675", strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.lineY(I.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 2, strokeLinejoin: "round" }),
      Plot.text([I.data.at(-1), Pr.data.at(-1)], { x: "date", y: "value", text: (d, j) => ["Imported", "Produced"][j] + " " + d.value.toFixed(1) + " Mt", dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5 }),
    ],
  });
  a11y(plot, "Crude oil produced in India and imported, million tonnes", `${fyOf(C.dates[k])}: imported ${C.imports[k]} Mt, produced ${C.production[k]} Mt.`);
  mount("plot-crude", plot);
  addCrosshair(document.getElementById("plot-crude"), plot, [I, Pr], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : v.toFixed(1) + " Mt"));
  setHTML("pv-crude", fmt.pct1(pct(C.imports[k], C.imports[k] + C.production[k])));
  const j0 = C.dates.findIndex((d, j) => C.imports[j] != null && C.production[j] != null);
  setHTML("h-crude", `India bought ${fmt.pct0(pct(C.imports[k], C.imports[k] + C.production[k]))} of its crude oil abroad in ${fyOf(C.dates[k])}, against ${fmt.pct0(pct(C.imports[j0], C.imports[j0] + C.production[j0]))} in ${fyOf(C.dates[j0])}`);
  setHTML("ex-cr-imp", fmt.num1(C.imports[k]) + " million tonnes");
  setHTML("ex-cr-prod", fmt.num1(C.production[k]) + " million tonnes");
  wirePlate("cb-crude", plot, "india-atlas_crude-oil-production-imports", () => csvRows(["financial_year", "crude_imported_mt", "crude_produced_mt"], C.dates.map((d, j) => [fyOf(d), C.imports[j], C.production[j]])));
}
{
  const C = T.ccy;
  const i0 = C.dates.indexOf("1991-04-01");
  const rows = C.dates.map((d, j) => (j < i0 || j === 0 ? null : { date: D(d), usd: growth(C.usd[j], C.usd[j - 1]), inr: C.inr[j] != null && C.inr[j - 1] != null ? growth(C.inr[j], C.inr[j - 1]) : null })).filter(Boolean);
  const U = { label: "In US dollars", color: ACC, data: rows.map((r) => ({ date: r.date, value: r.usd })) }, R = { label: "In rupees", color: GOLD, data: rows.map((r) => ({ date: r.date, value: r.inr })) };
  const all = rows.flatMap((r) => [r.usd, r.inr]).filter((v) => v != null);
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 130, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1992, 2025, 4).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 3, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ growth over the previous year, per cent", labelAnchor: "top", labelArrow: false, domain: [Math.floor(Math.min(...all) / 10) * 10, Math.ceil(Math.max(...all) / 10) * 10], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(R.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.lineY(U.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
    ],
  });
  const L = rows.at(-1);
  a11y(plot, "Export growth in dollars and in rupees", `${fyOf(L.date.toISOString())}: ${fmt.pct1Minus(L.usd)} in dollars, ${fmt.pct1Minus(L.inr)} in rupees.`);
  mount("plot-ccy", plot);
  addCrosshair(document.getElementById("plot-ccy"), plot, [U, R], null, (d) => fyOf(d.toISOString()), (v) => (v == null ? "—" : fmt.pct1Minus(v)));
  const beat = rows.filter((r) => r.inr != null && r.inr > r.usd).length;
  setHTML("pv-ccy", `${beat} of ${rows.filter((r) => r.inr != null).length}`);
  setHTML("h-ccy", `Measured in rupees, exports grew faster than in dollars in ${beat} of the ${rows.filter((r) => r.inr != null).length} years since ${fyOf(rows[0].date.toISOString())}: the rupee weakened against the dollar in most of them`);
  setHTML("ex-cc-usd", fmt.pct1Minus(L.usd));
  setHTML("ex-cc-inr", fmt.pct1Minus(L.inr));
  wirePlate("cb-ccy", plot, "india-atlas_trade-growth-dollars-rupees", () => csvRows(["financial_year", "export_growth_usd_pct", "export_growth_inr_pct"], rows.map((r) => [fyOf(r.date.toISOString()), r.usd.toFixed(2), r.inr == null ? "" : r.inr.toFixed(2)])));
}

/* ---------- § 09 every cut ---------- */
{
  const E = T.explorer;
  const lvl = document.getElementById("xp-level"), flow = document.getElementById("xp-flow"), q = document.getElementById("xp-q");
  const body = document.getElementById("xp-body");
  // US$ million: whole millions, except small lines that would round to nothing (the CSV keeps every decimal)
  const xpVal = (v) => (v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0 }));
  const cache = new Map();
  let state = { rows: [], fyLabels: ["", ""], sortK: "cur", sortDir: -1, file: null };
  async function load(file) {
    if (!cache.has(file)) cache.set(file, fetch(`/data/${file}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }));
    return cache.get(file);
  }
  // a bundle -> table rows: annual bundles compare their last two years; a one-year monthly
  // bundle (6 and 8 digits) shows the sum of its published months beside the same months of the
  // year before, read from the previous year's file where it exists
  function fromAnnual(b, i) {
    const n = i ?? b.dates.length - 1;
    return { fy: [fyOf(b.dates[n]), n > 0 ? fyOf(b.dates[n - 1]) : ""], rows: Object.entries(b.series ?? {}).map(([k, s]) => [k, s.label, s.data[n], n > 0 ? s.data[n - 1] : null]) };
  }
  const code = (k, label) => (label.match(/\(HS (\d+)\)/)?.[1] ?? k.replace(/^c/, "").replace(/__c/, " / "));
  function render() {
    const term = q.value.trim().toLowerCase();
    let rows = state.rows.map(([k, label, cur, prev]) => ({ code: code(k, label), label: label.replace(/\s*\(HS \d+\)/, ""), cur, prev, chg: cur != null && prev != null && prev !== 0 ? (cur / prev - 1) * 100 : null }))
      .filter((r) => r.code !== "total" && (!term || r.label.toLowerCase().includes(term) || r.code.includes(term)));
    rows.sort((a, b) => { const x = a[state.sortK], y = b[state.sortK]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.sortDir; });
    const shown = rows.slice(0, 400);
    body.innerHTML = shown.map((r) => `<tr><td class="c">${esc(r.code)}</td><td>${esc(r.label)}</td><td class="n">${xpVal(r.cur)}</td><td class="n">${xpVal(r.prev)}</td><td class="n">${r.chg == null ? "—" : fmt.pct1Minus(r.chg)}</td></tr>`).join("");
    setHTML("xp-n", `${rows.length.toLocaleString("en-IN")} rows${rows.length > shown.length ? `, first ${shown.length} shown; the CSV has all` : ""}`);
    setHTML("xp-h-cur", state.fyLabels[0] || "Latest");
    setHTML("xp-h-prev", state.fyLabels[1] || "Year before");
    state.filtered = rows;
  }
  async function update() {
    const L = lvl.value, F = flow.value;
    try {
      if (L === "hs2" || L === "partners") {
        const src = L === "hs2" ? (F === "exports" ? E.hs2x : E.hs2m) : (F === "exports" ? E.px : E.pm);
        const b = { dates: src.dates, series: Object.fromEntries(src.rows.map(([k, label, data]) => [k, { label, data }])) };
        const r = fromAnnual(b); state.rows = r.rows; state.fyLabels = r.fy;
      } else if (L === "hs4" || L === "cxc") {
        setHTML("xp-n", "Loading…");
        const b = await load(L === "hs4" ? `trade-hs4-${F}-fy` : `trade-partner-hs2-${F}`);
        const r = fromAnnual(b); state.rows = r.rows; state.fyLabels = r.fy;
      }
    } catch (e) {
      state.rows = []; setHTML("xp-n", "This table could not be loaded here; it is in the data downloads below.");
    }
    render();
  }
  lvl?.addEventListener("change", update);
  flow?.addEventListener("change", update);
  q?.addEventListener("input", render);
  document.querySelectorAll("#cb-every th[data-k]").forEach((th) => th.addEventListener("click", () => { const k = th.dataset.k; state.sortDir = state.sortK === k ? -state.sortDir : (k === "label" || k === "code" ? 1 : -1); state.sortK = k; render(); }));
  document.getElementById("xp-csv")?.addEventListener("click", () => saveBlob(new Blob([csvRows(["code", "description", state.fyLabels[0] || "latest", state.fyLabels[1] || "previous", "change_pct"], (state.filtered || []).map((r) => [r.code, r.label, r.cur, r.prev, r.chg == null ? "" : r.chg.toFixed(2)]))], { type: "text/csv" }), `india-atlas_trade-every-cut-${lvl.value}-${flow.value}.csv`));
  if (body) update();
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", T.vintage ?? "");
setHTML("prov-vintage2", T.vintage ?? "");
