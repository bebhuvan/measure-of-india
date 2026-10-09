// Guide 15, climate and temperature: plates.
// Data: the page embeds the output of src/dossiers/climate.data.js (#climate-data), derived at
// build time from data/series/climate-*.json (OWID and the World Bank CCKP). The text figures
// are rendered by the page itself; this module draws the plates and wires their downloads.
// Three instruments (station record, reanalysis, model projections) are drawn apart, never
// joined; projections are hollow and dashed.

import * as Plot from "@observablehq/plot";
import { MONO as sans, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, seamMarks, fmt } from "../charts/plumbing.js";

const C = JSON.parse(document.getElementById("climate-data")?.textContent ?? "null");
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16";
const G1 = "#5F6675", G2 = "#878D99", G3 = "#A3A9B4", G4 = "#C9CED6";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yd = (y) => new Date(Date.UTC(y, 0, 1));
const sd1 = (v) => (v < 0 ? "−" : "+") + fmt.num1(Math.abs(v));
const yearTicks = (a, b, step) => { const t = []; for (let y = Math.ceil(a / step) * step; y <= b; y += step) t.push(yd(y)); return t; };
const yearFmt = (d) => String(d.getUTCFullYear());
const SSP = { ssp126: "SSP1-2.6", ssp245: "SSP2-4.5", ssp370: "SSP3-7.0", ssp585: "SSP5-8.5" };
const SSPC = { ssp126: G2, ssp245: ACC, ssp370: G1, ssp585: GOLD };
const csvOf = (header, rows) => header.join(",") + "\n" + rows.map((r) => r.map((v) => (v == null ? "" : typeof v === "string" && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n");

/* ---------- plate wiring: append, describe, downloads ---------- */
function place(id, plot, title, desc, filename, csv) {
  const host = document.getElementById("plot-" + id);
  if (!host || !plot) return;
  a11y(plot, title, desc);
  host.append(plot);
  const fig = document.getElementById("cb-" + id);
  const meta = { title: fig?.querySelector(".plate-head h3")?.textContent.trim(), sub: fig?.querySelector(".plate-head .sub")?.textContent.trim(), foot: fig?.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  fig?.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, "india-atlas_climate-" + filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, "india-atlas_climate-" + filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), "india-atlas_climate-" + filename + ".csv");
  }));
}

// several Plot charts on their own scales, set in one SVG so a plate downloads as one image;
// each panel carries its title above it, and the inner charts are decorative to screen readers
function panels(list, { cols = 2, pw = 568, ph = 220, gapX = 48, gapY = 64, titleH = 26 } = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const rows = Math.ceil(list.length / cols);
  const totalW = cols * pw + (cols - 1) * gapX, totalH = rows * (ph + titleH) + (rows - 1) * gapY;
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", totalW); svg.setAttribute("height", totalH); svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  svg.setAttribute("font-family", sans);
  // the merged SVG has no scales of its own: declare whether time runs along x, from the panels'
  // own x scales, so a phone opens it at its latest end (guide.client.js reads data-x)
  svg.setAttribute("data-x", list.every(({ plot }) => ["time", "utc"].includes(plot.scale?.("x")?.type)) ? "time" : "other");
  list.forEach(({ title, plot }, i) => {
    const x = (i % cols) * (pw + gapX), y = Math.floor(i / cols) * (ph + titleH + gapY);
    const t = document.createElementNS(ns, "text");
    t.setAttribute("x", x); t.setAttribute("y", y + 14); t.setAttribute("font-size", "13"); t.setAttribute("fill", INK); t.setAttribute("font-weight", "600");
    t.textContent = title;
    svg.append(t);
    // the panel's marks move into a translated group that keeps the chart's class and
    // presentation attributes, so Plot's scoped styles still apply and every coordinate
    // composes to the outer SVG (the chart lint and the download both read it that way)
    const g = document.createElementNS(ns, "g");
    for (const a of [...plot.attributes]) if (!["width", "height", "viewBox", "x", "y", "xmlns", "role", "aria-label"].includes(a.name)) g.setAttribute(a.name, a.value);
    g.setAttribute("transform", `translate(${x},${y + titleH})`);
    g.setAttribute("aria-hidden", "true");
    while (plot.firstChild) g.append(plot.firstChild);
    svg.append(g);
  });
  return svg;
}

/* ---------- spark beside the month's figure: the last five years of months ---------- */
if (C) {
  const last = C.stripes.slice(-60).map(([y, m, v]) => ({ date: new Date(Date.UTC(y, m - 1, 1)), value: v }));
  spark("nspark-anom", { data: last, color: ACC, label: "Anomaly" });
}

/* ---------- the stripes: every month since 1940 ---------- */
if (C) {
  const cells = C.stripes.map(([y, m, v]) => ({ y, m, v }));
  const y0 = cells[0].y, y1 = cells.at(-1).y;
  const years = Array.from({ length: y1 - y0 + 1 }, (_, i) => y0 + i);
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const color = { type: "linear", domain: [-2, 0, 2], range: ["#6F86E4", "#FFFFFF", "#D58A1E"], clamp: true };
  const plot = Plot.plot({
    width: W, height: 12 * 20 + 56, marginLeft: 44, marginRight: 8, marginTop: 8, marginBottom: 40, style: baseStyle,
    x: { type: "band", domain: years, label: null, tickSize: 0, tickPadding: 8, ticks: years.filter((y) => y % 10 === 0), tickFormat: (y) => String(y), padding: 0.04 },
    y: { type: "band", domain: MON.map((_, i) => i + 1), label: null, tickSize: 0, tickPadding: 8, tickFormat: (m) => MON[m - 1], padding: 0.06 },
    color,
    marks: [Plot.cell(cells, { x: "y", y: "m", fill: "v", title: (d) => `${MON[d.m - 1]} ${d.y}: ${sd1(d.v)}°C` })],
  });
  document.getElementById("legend-stripes").innerHTML = [-2, -1, 0, 1, 2].map((v) => {
    const c = v < 0 ? (v === -2 ? "#6F86E4" : "#B7C3F2") : v === 0 ? "#FFFFFF" : v === 1 ? "#EAC48E" : "#D58A1E";
    return `<span class="chip"><i style="background:${c};border:1px solid #DFE2E8;width:10px;height:10px"></i>${v === 0 ? "0" : (v < 0 ? "−" : "+") + Math.abs(v)}°C${v === 2 ? " or warmer" : v === -2 ? " or colder" : ""}</span>`;
  }).join("");
  const n2000 = cells.filter((c) => c.y >= 2000), cool = n2000.filter((c) => c.v < 0).length;
  place("stripes", plot, "India's monthly temperature against the 1991-2020 average, January 1940 onward",
    `${cells.length} months. Since 2000, ${cool} of ${n2000.length} months were below the 1991-2020 average for their month. Latest: ${MON[cells.at(-1).m - 1]} ${cells.at(-1).y}, ${sd1(cells.at(-1).v)}°C.`,
    "monthly-anomaly", csvOf(["year", "month", "anomaly_c_vs_1991_2020"], cells.map((c) => [c.y, c.m, c.v])));
}

/* ---------- small multiples of yearly counts (heat, rain extremes) ---------- */
function yearPanel(p, { color = ACC, unit = "", pw = 568, ph = 220, fmtV = (v) => fmt.num1(v) } = {}) {
  const data = p.data.map(([y, v]) => ({ date: yd(y), value: v }));
  const vals = data.map((d) => d.value);
  const hi = Math.max(...vals, p.base), lo = Math.min(0, ...vals);
  const top = hi * 1.12;
  const last = data.at(-1);
  return Plot.plot({
    width: pw, height: ph, marginLeft: 40, marginRight: 64, marginTop: 14, marginBottom: 28, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 8, ticks: yearTicks(1950, 2025, 25), tickFormat: yearFmt },
    y: { label: unit || null, labelAnchor: "top", labelArrow: false, domain: [lo, top], ticks: 4, tickSize: 0, tickPadding: 6, tickFormat: (v) => String(fmt.count(v)) },
    marks: [
      Plot.gridY({ ticks: 4, stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleY([p.base], { stroke: G3, strokeDasharray: "3 3" }),
      Plot.lineY(data, { x: "date", y: "value", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([last], { x: "date", y: "value", fill: color, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([last], { x: "date", y: "value", text: (d) => fmtV(d.value), dx: 8, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: 600 }),
    ],
  });
}

if (C) {
  const list = C.heat.map((p) => ({ title: p.label, plot: yearPanel(p, { unit: "days a year" }) }));
  const svg = panels(list);
  const H = Object.fromEntries(C.heat.map((p) => [p.k, p]));
  place("heat", svg, "Hot days, warm nights and humid heat in India, 1950 onward",
    C.heat.map((p) => `${p.label}: ${fmt.num1(p.base)} a year in 1951-1980, ${fmt.num1(p.recent)} in 1996-2025`).join("; ") + ".",
    "heat-days", csvOf(["year", ...C.heat.map((p) => p.k)], H.tr26.data.map(([y], i) => [y, ...C.heat.map((p) => p.data.find((d) => d[0] === y)?.[1] ?? null)])));
}

/* ---------- a century of warming: two instruments, never joined ---------- */
if (C) {
  const cru = C.century.cru.map(([y, v]) => ({ date: yd(y), value: v }));
  const era = C.century.era5.map(([y, v]) => ({ date: yd(y), value: v }));
  const ends = [{ ...cru.at(-1), label: "Stations", c: ACC }, { ...era.at(-1), label: "Reanalysis", c: G3 }].sort((a, b) => b.value - a.value);
  // end labels sit right of the last points; nudge apart when within 0.12°C
  if (ends[0].value - ends[1].value < 0.12) { ends[0].ly = ends[1].value + 0.12; ends[1].ly = ends[1].value; } else ends.forEach((e) => (e.ly = e.value));
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 48, marginRight: 170, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: yearTicks(1910, 2020, 10), tickFormat: yearFmt },
    y: { label: "°C against 1951-1980", labelAnchor: "top", labelArrow: false, domain: [-1, 1.25], ticks: [-1, -0.5, 0, 0.5, 1], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt.num1(Math.abs(v)) },
    marks: [
      Plot.gridY([-1, -0.5, 0.5, 1], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      // two instruments on one axis: the "side" seam, marked where the reanalysis begins
      ...seamMarks("side", [{ data: cru, color: ACC, width: 2, label: "Stations" }, { data: era, color: G3, width: 1.5, label: "Reanalysis" }],
        { text: "Reanalysis begins, 1950", at: yd(1950), y: 1.12, anchor: "end" }),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.c, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.label} ${sd1(d.value)}°C`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.c === ACC ? 600 : 400) }),
    ],
  });
  const host = document.getElementById("plot-century");
  place("century", plot, "India's annual mean temperature against 1951-1980, station record and reanalysis",
    `Station record from 1901, ${sd1(cru[0].value)}°C, to ${C.century.cruLast}, ${sd1(cru.at(-1).value)}°C; reanalysis from 1950. Warming ${fmt.num2(C.century.rate1901)}°C a decade since 1901, ${fmt.num2(C.century.rate1976)}°C since 1976.`,
    "century", csvOf(["year", "cru_ts_c_vs_1951_1980", "era5_c_vs_1951_1980"], C.century.cru.map(([y, v]) => [y, v, C.century.era5.find((e) => e[0] === y)?.[1] ?? null])));
  addCrosshair(host, plot, [{ data: cru, label: "Stations (CRU TS)", color: ACC }, { data: cru.map((d) => ({ date: d.date, value: era.find((e) => +e.date === +d.date)?.value ?? null })), label: "Reanalysis (ERA5)", color: G3 }], null, yearFmt, (v) => (v == null ? "—" : sd1(v) + "°C"));
}

/* ---------- dumbbells: two values a row, labels outside the dots ---------- */
function dumbbell(rows, { y, a, b, aLab, bLab, domain, ticks, fmtV, rowH = 30, marginLeft = 200, aFill = "#fff", aStroke = G2, bFill = ACC, label = "°C" }) {
  const lo = rows.map((r) => ({ ...r, v: Math.min(r[a], r[b]) })), hi = rows.map((r) => ({ ...r, v: Math.max(r[a], r[b]) }));
  return Plot.plot({
    width: W, height: 50 + rows.length * rowH, marginLeft, marginRight: 70, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label, labelAnchor: "right", labelArrow: false, domain, ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + fmt.num1(Math.abs(v)) },
    y: { label: null, domain: rows.map((r) => r[y]), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(ticks, { stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.link(rows, { x1: a, x2: b, y1: y, y2: y, stroke: "#DFE2E8", strokeWidth: 2 }),
      Plot.dot(rows, { x: a, y, r: 4.5, fill: aFill, stroke: aStroke, strokeWidth: 1.5 }),
      Plot.dot(rows, { x: b, y, r: 4.5, fill: bFill, stroke: bFill === "#fff" ? ACC : "#fff", strokeWidth: 1.5 }),
      Plot.text(hi, { x: "v", y, text: (d) => fmtV(d.v), dx: 10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.text(lo, { x: "v", y, text: (d) => fmtV(d.v), dx: -10, textAnchor: "end", fill: MUTED, fontSize: 11.5 }),
    ],
  });
}

/* ---------- months: days and nights ---------- */
if (C) {
  const rows = C.months;
  const plot = dumbbell(rows, { y: "m", a: "tmax", b: "tmin", domain: [0, 1.1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], fmtV: (v) => sd1(v), marginLeft: 70, label: "change, °C" });
  place("months", plot, "Change in day and night temperature by month, 1951-1980 to 1996-2025",
    rows.map((r) => `${r.m}: days ${sd1(r.tmax)}, nights ${sd1(r.tmin)}`).join("; "),
    "months-day-night", csvOf(["month", "change_tmax_c", "change_tmin_c", "change_tmean_c"], rows.map((r) => [r.m, r.tmax, r.tmin, r.tas])));
}

/* ---------- states: two instruments ---------- */
if (C) {
  const rows = [...C.states].sort((p, q) => q.tasCru - p.tasCru);
  const hiV = Math.max(...rows.flatMap((r) => [r.tasCru, r.tas])), loV = Math.min(0, ...rows.flatMap((r) => [r.tasCru, r.tas]));
  const plot = dumbbell(rows, { y: "name", a: "tas", b: "tasCru", domain: [Math.floor(loV * 4) / 4, Math.ceil(hiV * 4) / 4 + 0.05], ticks: [-0.5, 0, 0.5, 1, 1.5, 2].filter((t) => t >= Math.floor(loV * 4) / 4 && t <= hiV + 0.3), fmtV: (v) => sd1(v), rowH: 24, marginLeft: 230, label: "change, °C" });
  place("states", plot, "Warming by state, 1951-1980 to 1996-2025, station record and reanalysis",
    rows.map((r) => `${r.name}: stations ${sd1(r.tasCru)}, reanalysis ${sd1(r.tas)}`).join("; "),
    "states-warming", csvOf(["state", "change_cru_c", "change_era5_c", "change_era5_tmax_c", "change_era5_tmin_c"], rows.map((r) => [r.name, r.tasCru, r.tas, r.tmax, r.tmin])));
}

/* ---------- states: humid days and 40°C days ---------- */
if (C) {
  const rows = [...C.states].sort((p, q) => q.wbt27 - p.wbt27);
  const bars = rows.flatMap((r) => [{ name: r.name, k: "wbt", v: r.wbt27 }, { name: r.name, k: "hd", v: r.hd40 }]);
  const lo = Math.min(0, ...bars.map((b) => b.v)), hi = Math.max(...bars.map((b) => b.v));
  const ticks = []; for (let t = Math.ceil(lo / 20) * 20; t <= hi; t += 20) ticks.push(t);
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 28, marginLeft: 230, marginRight: 60, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "change in days a year", labelAnchor: "right", labelArrow: false, domain: [lo - 6, hi + 14], ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    fy: { axis: null },
    marks: [
      Plot.gridX(ticks, { stroke: GRID }),
      Plot.barX(bars.filter((b) => b.k === "wbt"), { y: "name", x: "v", fill: ACC, insetTop: 5, insetBottom: 14 }),
      Plot.barX(bars.filter((b) => b.k === "hd"), { y: "name", x: "v", fill: G4, insetTop: 14, insetBottom: 5 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.text(bars.filter((b) => b.k === "wbt" && b.v >= 0), { y: "name", x: "v", text: (d) => "+" + fmt.num1(d.v), dx: 6, dy: -4, textAnchor: "start", fill: INK, fontSize: 11 }),
    ],
  });
  place("states-humid", plot, "Change in humid days and in 40°C days by state, 1951-1980 to 1996-2025",
    rows.slice(0, 8).map((r) => `${r.name}: humid days ${sd1(r.wbt27)}, 40°C days ${sd1(r.hd40)}`).join("; "),
    "states-humid-heat", csvOf(["state", "change_wbt27_days", "change_hd40_days", "wbt27_days_1996_2025", "hd40_days_1996_2025"], rows.map((r) => [r.name, r.wbt27, r.hd40, r.wbt27now, r.hd40now])));
}

/* ---------- the monsoon: a century of annual rain ---------- */
if (C) {
  const R = C.rain;
  const data = R.annual.map(([y, v]) => ({ y, date: yd(y), value: v, dry: v < R.base * 0.9 }));
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 52, marginRight: 200, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: yearTicks(1910, 2020, 10), tickFormat: yearFmt },
    y: { label: "mm", labelAnchor: "top", labelArrow: false, domain: [0, 1500], ticks: [0, 300, 600, 900, 1200, 1500], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(fmt.inr(v)) },
    marks: [
      Plot.gridY([300, 600, 900, 1200, 1500], { stroke: GRID }),
      Plot.rectY(data, { x1: (d) => yd(d.y), x2: (d) => yd(d.y + 1), y1: 0, y2: "value", fill: (d) => (d.dry ? ACC : G4), insetLeft: 0.6, insetRight: 0.6 }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleY([R.base], { stroke: INK, strokeDasharray: "3 3" }),
      Plot.text([{ x: yd(2026), y: R.base }], { x: "x", y: "y", text: () => `1951-80 average ${fmt.inr(R.base)} mm`, dx: 8, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  const host = document.getElementById("plot-rain");
  const dry = data.filter((d) => d.dry).length;
  place("rain", plot, "India's annual rainfall, 1901 onward, station record",
    `${data.length} years; ${dry} years at least 10% below the 1951-1980 average of ${fmt.inr(R.base)} mm, shown in blue. Latest ${data.at(-1).y}: ${fmt.inr(data.at(-1).value)} mm.`,
    "annual-rainfall", csvOf(["year", "rain_mm", "june_to_september_share_pct"], R.annual.map(([y, v]) => [y, v, R.jjasShare.find((j) => j[0] === y)?.[1] ?? null])));
  addCrosshair(host, plot, [{ data: data.map((d) => ({ date: d.date, value: d.value })), label: "Rainfall", color: ACC }], null, yearFmt, (v) => (v == null ? "—" : fmt.inr(v) + " mm"));
}

/* ---------- the monsoon: the shape of the season ---------- */
if (C) {
  const rows = C.rain.months;
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 52, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", domain: rows.map((r) => r.m), label: null, tickSize: 0, tickPadding: 10, padding: 0.3 },
    y: { label: "mm", labelAnchor: "top", labelArrow: false, domain: [0, 330], ticks: [0, 100, 200, 300], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY([100, 200, 300], { stroke: GRID }),
      Plot.barY(rows, { x: "m", y: "recent", fill: "#AFBBF0" }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.dot(rows, { x: "m", y: "base", r: 4, fill: "#fff", stroke: G1, strokeWidth: 1.5 }),
      Plot.text(rows.filter((r) => r.recent >= 100), { x: "m", y: (r) => Math.max(r.recent, r.base), text: (r) => String(r.recent), dy: -14, fill: INK, fontSize: 11.5 }),
    ],
  });
  place("rain-months", plot, "Average rainfall by month, 1951-1980 and 1996-2025",
    rows.map((r) => `${r.m}: ${r.base} mm then, ${r.recent} mm now`).join("; "),
    "rain-by-month", csvOf(["month", "rain_mm_1951_1980", "rain_mm_1996_2025"], rows.map((r) => [r.m, r.base, r.recent])));
}

/* ---------- rain extremes: four measures, four scales ---------- */
if (C) {
  const list = C.rain.extremes.map((p) => ({ title: p.label, plot: yearPanel(p, { color: ACC }) }));
  const svg = panels(list);
  place("rain-extremes", svg, "Rain extremes over India, 1950 onward",
    C.rain.extremes.map((p) => `${p.label}: ${fmt.num1(p.base)} in 1951-1980, ${fmt.num1(p.recent)} in 1996-2025`).join("; "),
    "rain-extremes", csvOf(["year", ...C.rain.extremes.map((p) => p.k)], C.rain.extremes[0].data.map(([y]) => [y, ...C.rain.extremes.map((p) => p.data.find((d) => d[0] === y)?.[1] ?? null)])));
}

/* ---------- lines with end labels (emissions, energy, fires) ---------- */
function linesPlot(series, { domain, ticks, yLabel, fmtTick, fmtEnd, height = 440, x0 = 1950, x1, marginRight = 170, step = 10 }) {
  const ends = series.map((s) => ({ ...s.data.at(-1), s })).sort((a, b) => b.value - a.value);
  // dodge end labels 15 px apart in value space: push down from the top, then, if the stack
  // runs below the floor, lift it back up from the bottom (labels never sit under the axis)
  const px = (domain[1] - domain[0]) / (height - 64), gap = 15 * px;
  ends.forEach((e, i) => (e.ly = i ? Math.min(e.value, ends[i - 1].ly - gap) : e.value));
  const floor = domain[0] + gap * 0.4;
  for (let i = ends.length - 1; i >= 0; i--) ends[i].ly = Math.max(ends[i].ly, i === ends.length - 1 ? floor : ends[i + 1].ly + gap);
  return Plot.plot({
    width: W, height, marginLeft: 56, marginRight, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: yearTicks(x0, x1, step), tickFormat: yearFmt },
    y: { label: yLabel, labelAnchor: "top", labelArrow: false, domain, ticks, tickSize: 0, tickPadding: 10, tickFormat: fmtTick },
    marks: [
      Plot.gridY(ticks.filter((t) => t !== 0), { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...[...series].reverse().map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.lead ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends, { x: "date", y: "value", fill: (d) => d.s.color, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(ends, { x: "date", y: "ly", text: (d) => `${d.s.label} ${fmtEnd(d.value)}`, dx: 9, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (d.s.lead ? 600 : 400) }),
    ],
  });
}
const ser = (arr, label, color, lead = false) => ({ label, color, lead, data: arr.map(([y, v]) => ({ date: yd(y), value: v })) });
const chipLegend = (id, list) => { const el = document.getElementById(id); if (el) el.innerHTML = list.map((s) => `<button class="chip"><i style="background:${s.color}"></i>${s.label}</button>`).join(""); };

if (C) {
  const E = C.em, Y = E.year;
  // total CO2
  {
    const S = [ser(E.total.IND, "India", ACC, true), ser(E.total.CHN, "China", GOLD), ser(E.total.USA, "United States", G2)];
    const plot = linesPlot(S, { domain: [0, 13000], ticks: [0, 2500, 5000, 7500, 10000, 12500], yLabel: "million tonnes", fmtTick: (v) => fmt.inr(v), fmtEnd: (v) => fmt.inr(v), x1: Y });
    place("co2", plot, "CO₂ emissions, India, China and the United States, 1950 onward", S.map((s) => `${s.label}: ${fmt.inr(s.data.at(-1).value)} Mt in ${Y}`).join("; "),
      "co2-total", csvOf(["year", "india_mt", "china_mt", "usa_mt"], E.total.IND.map(([y, v]) => [y, v, E.total.CHN.find((d) => d[0] === y)?.[1] ?? null, E.total.USA.find((d) => d[0] === y)?.[1] ?? null])));
    addCrosshair(document.getElementById("plot-co2"), plot, S, null, yearFmt, (v) => (v == null ? "—" : fmt.inr(v) + " Mt"));
  }
  // per person
  {
    const S = [ser(E.pc.USA, "United States", G2), ser(E.pc.CHN, "China", GOLD), ser(E.pc.WLD, "World", G4), ser(E.pc.IND, "India", ACC, true)];
    const plot = linesPlot(S, { domain: [0, 24], ticks: [0, 5, 10, 15, 20], yLabel: "tonnes per person", fmtTick: (v) => String(v), fmtEnd: (v) => fmt.num1(v) + " t", x1: Y });
    place("percap", plot, "CO₂ per person, 1950 onward", S.map((s) => `${s.label}: ${fmt.num2(s.data.at(-1).value)} t in ${Y}`).join("; "),
      "co2-per-person", csvOf(["year", "india_t", "china_t", "usa_t", "world_t"], E.pc.IND.map(([y, v]) => [y, v, ...["CHN", "USA", "WLD"].map((g) => E.pc[g].find((d) => d[0] === y)?.[1] ?? null)])));
    addCrosshair(document.getElementById("plot-percap"), plot, [S[3], S[1], S[0], S[2]], null, yearFmt, (v) => (v == null ? "—" : fmt.num2(v) + " t"));
  }
  // shares: annual, cumulative, warming
  {
    const N = { IND: "India", CHN: "China", USA: "United States" };
    const M = [["annual", `Share of ${Y} CO₂`, G4], ["cumulative", "Share of all CO₂ since 1750", G2], ["warming", "Share of warming caused", ACC]];
    const rows = Object.entries(N).flatMap(([g, n]) => M.map(([k, lab, c]) => ({ g: n, k: lab, v: E.share[g][k], c })));
    const plot = Plot.plot({
      width: W, height: 3 * 3 * 26 + 3 * 22 + 60, marginLeft: 150, marginRight: 70, marginTop: 20, marginBottom: 30, style: baseStyle,
      x: { label: "per cent", labelAnchor: "right", labelArrow: false, domain: [0, 35], ticks: [0, 10, 20, 30], tickSize: 0, tickPadding: 8, tickFormat: (v) => v + (v === 30 ? "%" : "") },
      y: { label: null, domain: M.map((m) => m[1]), axis: null, padding: 0.18 },
      fy: { label: null, domain: Object.values(N), tickSize: 0, tickPadding: 14, padding: 0.22 },
      marks: [
        Plot.gridX([10, 20, 30], { stroke: GRID }),
        Plot.barX(rows, { fy: "g", y: "k", x: "v", fill: (d) => d.c }),
        Plot.text(rows, { fy: "g", y: "k", x: "v", text: (d) => fmt.num1(d.v) + "%", dx: 7, textAnchor: "start", fill: INK, fontSize: 11.5, fontWeight: (d) => (d.c === ACC ? 600 : 400) }),
        Plot.ruleX([0], { stroke: BASE }),
      ],
    });
    place("stock", plot, "Shares of CO₂ and of warming: India, China and the United States", rows.map((r) => `${r.g}, ${r.k}: ${fmt.num1(r.v)}%`).join("; "),
      "shares-of-emissions-and-warming", csvOf(["country", "share_annual_co2_pct", "share_cumulative_co2_pct", "share_of_warming_pct"], Object.entries(N).map(([g, n]) => [n, E.share[g].annual, E.share[g].cumulative, E.share[g].warming])));
  }
  // fuels
  {
    const L = { coal_co2: ["Coal", ACC, true], oil_co2: ["Oil", G1], cement_co2: ["Cement", G2], gas_co2: ["Gas", G3], flaring_co2: ["Flaring", G4] };
    const S = E.fuels.map((f) => ser(f.data, ...L[f.k]));
    chipLegend("legend-fuels", S);
    const plot = linesPlot(S, { domain: [0, 2400], ticks: [0, 500, 1000, 1500, 2000], yLabel: "million tonnes", fmtTick: (v) => fmt.inr(v), fmtEnd: (v) => fmt.inr(v), x1: Y, marginRight: 140 });
    place("fuels", plot, "India's CO₂ by fuel, 1950 onward", S.map((s) => `${s.label}: ${fmt.inr(s.data.at(-1).value)} Mt`).join("; "),
      "india-co2-by-fuel", csvOf(["year", ...E.fuels.map((f) => f.k + "_mt")], E.fuels[0].data.map(([y]) => [y, ...E.fuels.map((f) => f.data.find((d) => d[0] === y)?.[1] ?? null)])));
    addCrosshair(document.getElementById("plot-fuels"), plot, S, null, yearFmt, (v) => (v == null ? "—" : fmt.inr(v) + " Mt"));
  }
  // gases
  {
    const L = { co2_including_luc: ["Carbon dioxide", ACC, true], methane: ["Methane", GOLD], nitrous_oxide: ["Nitrous oxide", G2] };
    const S = E.gases.map((g) => ser(g.data, ...L[g.k]));
    const plot = linesPlot(S, { domain: [0, 3600], ticks: [0, 1000, 2000, 3000], yLabel: "million tonnes CO₂-equivalent", fmtTick: (v) => fmt.inr(v), fmtEnd: (v) => fmt.inr(v), x1: Y });
    place("gases", plot, "India's greenhouse gas emissions by gas, 1950 onward", S.map((s) => `${s.label}: ${fmt.inr(s.data.at(-1).value)} Mt CO₂e`).join("; "),
      "india-ghg-by-gas", csvOf(["year", "co2_incl_land_use_mt", "methane_mt_co2e", "nitrous_oxide_mt_co2e"], E.gases[0].data.map(([y]) => [y, ...E.gases.map((g) => g.data.find((d) => d[0] === y)?.[1] ?? null)])));
    addCrosshair(document.getElementById("plot-gases"), plot, S, null, yearFmt, (v) => (v == null ? "—" : fmt.inr(v) + " Mt"));
  }
}

/* ---------- energy mix ---------- */
if (C) {
  const EN = C.energy;
  const NAMES = { coal: "Coal", oil: "Oil", gas: "Gas", nuclear: "Nuclear", hydro: "Hydro", solar: "Solar", wind: "Wind", biofuel: "Biofuels", other_renewables: "Other renewables" };
  const COL = { coal: ACC, oil: G1, gas: G2, hydro: G3, nuclear: G4, solar: GOLD, wind: "#E3B977", biofuel: "#DFE2E8", other_renewables: "#DFE2E8" };
  const draw = (id, rows, year, x0, top, ticks, file, what) => {
    const shown = rows.filter((r) => r.last != null && r.last >= 2);   // sources under 2% sit in the CSV download, not on the chart
    const S = shown.map((r) => ser(r.data, NAMES[r.f], COL[r.f], r.f === "coal"));
    chipLegend("legend-" + id, S);
    const plot = linesPlot(S, { domain: [0, top], ticks, yLabel: "per cent", fmtTick: (v) => v + (v === ticks.at(-1) ? "%" : ""), fmtEnd: (v) => fmt.num1(v) + "%", x0, x1: year, step: 5, marginRight: 190 });
    place(id, plot, what, S.map((s) => `${s.label}: ${fmt.num1(s.data.at(-1).value)}%`).join("; "), file,
      csvOf(["year", ...rows.map((r) => r.f + "_pct")], rows[0].data.map(([y]) => [y, ...rows.map((r) => r.data.find((d) => d[0] === y)?.[1] ?? null)])));
    addCrosshair(document.getElementById("plot-" + id), plot, S, null, yearFmt, (v) => (v == null ? "—" : fmt.num1(v) + "%"));
  };
  draw("energy", EN.primary, EN.year, 1965, 70, [0, 20, 40, 60], "india-primary-energy-mix", "Shares of India's primary energy by source, 1965 onward");
  draw("power", EN.elec, EN.elYear, 1985, 80, [0, 20, 40, 60, 80], "india-electricity-mix", "Shares of India's electricity generation by source, 1985 onward");
}

/* ---------- projections: dot and range, hollow ---------- */
if (C) {
  const P = C.proj, wl = (y) => `${y}-${String(y + 19).slice(2)}`;
  const order = Object.keys(SSP), off = { ssp126: -27, ssp245: -9, ssp370: 9, ssp585: 27 };
  const rows = P.tas.flatMap((s) => s.w.map((w) => ({ s: s.s, win: wl(w.y), ...w })));
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 52, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", domain: P.windows.map(wl), label: null, tickSize: 0, tickPadding: 12, padding: 0.2 },
    y: { label: "°C, change from 1995-2014", labelAnchor: "top", labelArrow: false, domain: [0, 6], ticks: [0, 1, 2, 3, 4, 5, 6], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v ? "+" : "") + v },
    marks: [
      Plot.gridY([1, 2, 3, 4, 5, 6], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...order.flatMap((s) => [
        Plot.ruleX(rows.filter((r) => r.s === s), { x: "win", y1: "p10", y2: "p90", dx: off[s], stroke: SSPC[s], strokeWidth: 1.5, strokeDasharray: "3 2" }),
        Plot.dot(rows.filter((r) => r.s === s), { x: "win", y: "med", dx: off[s], r: 4.5, fill: "#fff", stroke: SSPC[s], strokeWidth: 2 }),
      ]),
      ...order.map((s) => Plot.text(rows.filter((r) => r.s === s && r.y === P.windows.at(-1)), { x: "win", y: "p90", text: (d) => sd1(d.med), dx: off[s], dy: -12, fill: INK, fontSize: 11 })),
    ],
  });
  place("proj", plot, "Projected warming of India from 1995-2014, by scenario and 20-year window",
    rows.filter((r) => r.y === P.windows.at(-1)).map((r) => `${SSP[r.s]} in ${r.win}: ${sd1(r.med)}°C (range ${sd1(r.p10)} to ${sd1(r.p90)})`).join("; "),
    "projected-warming", csvOf(["scenario", "window", "median_c", "p10_c", "p90_c"], rows.map((r) => [SSP[r.s], r.win, r.med, r.p10, r.p90])));
}

if (C) {
  const P = C.proj, wl = (y) => `${y}-${String(y + 19).slice(2)}`;
  const list = P.days.map((d) => {
    const rows = d.s.flatMap((s) => s.w.map((w) => ({ s: s.s, win: wl(w.y), v: w.med })));
    const top = Math.max(d.ref, ...rows.map((r) => r.v)) * 1.18;
    return { title: d.label, plot: Plot.plot({
      width: 370, height: 230, marginLeft: 40, marginRight: 10, marginTop: 14, marginBottom: 28, style: baseStyle,
      x: { type: "band", domain: P.windows.map(wl), label: null, tickSize: 0, tickPadding: 8, padding: 0.3, tickFormat: (s) => String(s).slice(0, 4) + "s" },
      y: { label: "days a year", labelAnchor: "top", labelArrow: false, domain: [0, top], ticks: 4, tickSize: 0, tickPadding: 6, tickFormat: (v) => String(fmt.count(v)) },
      marks: [
        Plot.gridY({ ticks: 4, stroke: GRID }),
        Plot.ruleY([d.ref], { stroke: G3, strokeDasharray: "3 3" }),
        ...["ssp245", "ssp585"].map((s) => Plot.line(rows.filter((r) => r.s === s), { x: "win", y: "v", stroke: SSPC[s], strokeWidth: 1.25, strokeDasharray: "3 3" })),
        ...["ssp245", "ssp585"].map((s) => Plot.dot(rows.filter((r) => r.s === s), { x: "win", y: "v", r: 4, fill: "#fff", stroke: SSPC[s], strokeWidth: 2 })),
        Plot.text(rows.filter((r) => r.win === wl(P.windows.at(-1))), { x: "win", y: "v", text: (r) => fmt.count(r.v), dy: -12, fill: INK, fontSize: 11 }),
      ],
    }) };
  });
  const svg = panels(list, { cols: 3, pw: 370, ph: 230, gapX: 37 });
  place("proj-heat", svg, "Projected hot days and nights in India by 20-year window, SSP2-4.5 and SSP5-8.5",
    P.days.map((d) => `${d.label}: ${fmt.num1(d.ref)} in the models' 1995-2014; ${d.s.map((s) => `${SSP[s.s]} ${s.w.map((w) => fmt.num1(w.med)).join(", ")}`).join("; ")}`).join(". "),
    "projected-heat-days", csvOf(["index", "scenario", "window", "days_median"], P.days.flatMap((d) => [[d.k, "1995-2014 (model)", "1995-2014", d.ref], ...d.s.flatMap((s) => s.w.map((w) => [d.k, SSP[s.s], wl(w.y), w.med]))])));
}

if (C) {
  const rows = C.states.filter((s) => s.proj != null).sort((p, q) => q.proj - p.proj);
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 24, marginLeft: 230, marginRight: 70, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "°C, change from 1995-2014", labelAnchor: "right", labelArrow: false, domain: [0, 2], ticks: [0, 0.5, 1, 1.5, 2], tickSize: 0, tickPadding: 8, tickFormat: (v) => (v ? "+" : "") + fmt.num1(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX([0.5, 1, 1.5, 2], { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "proj", fill: "#EEF1FC", stroke: ACC, strokeWidth: 1, strokeDasharray: "3 2", insetTop: 6, insetBottom: 6 }),
      Plot.text(rows, { y: "name", x: "proj", text: (d) => sd1(d.proj), dx: 7, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  place("proj-states", plot, "Projected warming by state, 2040-2059, SSP2-4.5, ensemble median",
    rows.map((r) => `${r.name} ${sd1(r.proj)}°C`).join("; "),
    "projected-warming-by-state", csvOf(["state", "change_2040_2059_ssp245_median_c", "change_2080_2099_ssp585_median_c"], rows.map((r) => [r.name, r.proj, r.proj85])));
}

/* ---------- cooling degree days: observed line, projected hollow dots, never joined ---------- */
if (C) {
  const P = C.proj, obs = C.cost.cdd.map(([y, v]) => ({ date: yd(y), value: v }));
  const proj = P.cdd65.s.flatMap((s) => s.w.map((w) => ({ s: s.s, date: yd(w.y + 10), value: w.med })));
  const ref = [{ date: yd(2005), value: P.cdd65.ref }];
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 60, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: yearTicks(1950, 2100, 10), tickFormat: yearFmt, domain: [yd(1950), yd(2100)] },
    y: { label: "cooling degree days (°F)", labelAnchor: "top", labelArrow: false, domain: [3500, 7800], ticks: [4000, 5000, 6000, 7000], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(fmt.inr(v)) },
    marks: [
      Plot.gridY([4000, 5000, 6000, 7000], { stroke: GRID }),
      Plot.ruleX([yd(2026)], { stroke: BASE, strokeDasharray: "1 3" }),
      Plot.lineY(obs, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.dot(ref, { x: "date", y: "value", r: 4, fill: "#fff", stroke: G2, strokeWidth: 1.5 }),
      ...["ssp245", "ssp585"].map((s) => Plot.dot(proj.filter((p) => p.s === s), { x: "date", y: "value", r: 4.5, fill: "#fff", stroke: SSPC[s], strokeWidth: 2 })),
      Plot.text(proj.filter((p) => +p.date === +yd(2090)), { x: "date", y: "value", text: (d) => `${SSP[d.s]} ${fmt.inr(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  place("cool", plot, "Cooling degree days in India: observed 1950 onward, and projected by 20-year window",
    `Observed ${fmt.inr(obs.at(-1).value)} in ${obs.at(-1).date.getUTCFullYear()}; projected ${proj.filter((p) => +p.date === +yd(2090)).map((p) => `${SSP[p.s]} ${fmt.inr(p.value)}`).join(", ")} in 2080-2099.`,
    "cooling-degree-days", csvOf(["year_or_window", "instrument", "cooling_degree_days_f"], [...C.cost.cdd.map(([y, v]) => [y, "ERA5 observed", v]), ["1995-2014", "CMIP6 median, historical", P.cdd65.ref], ...P.cdd65.s.flatMap((s) => s.w.map((w) => [`${w.y}-${w.y + 19}`, `CMIP6 median, ${SSP[s.s]}`, w.med]))]));
}

/* ---------- heat deaths (projection, hollow) ---------- */
if (C) {
  const rows = C.cost.heatDeaths.map(([y, v]) => ({ y: String(y), v }));
  const plot = Plot.plot({
    width: W, height: 300, marginLeft: 52, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", domain: rows.map((r) => r.y), label: null, tickSize: 0, tickPadding: 10, padding: 0.55 },
    y: { label: "deaths per 100,000 a year, change", labelAnchor: "top", labelArrow: false, domain: [0, 14], ticks: [0, 4, 8, 12], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v ? "+" : "") + v },
    marks: [
      Plot.gridY([4, 8, 12], { stroke: GRID }),
      Plot.barY(rows, { x: "y", y: "v", fill: "#EEF1FC", stroke: ACC, strokeWidth: 1, strokeDasharray: "3 2" }),
      Plot.text(rows, { x: "y", y: "v", text: (d) => "+" + fmt.num1(d.v), dy: -12, fill: INK, fontSize: 12, fontWeight: 600 }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  place("deaths", plot, "Projected change in India's death rate from non-optimal temperatures, RCP4.5",
    rows.map((r) => `${r.y}: +${fmt.num1(r.v)} per 100,000`).join("; "), "projected-heat-deaths", csvOf(["year", "change_deaths_per_100k_rcp45"], rows.map((r) => [r.y, r.v])));
}

/* ---------- fires ---------- */
if (C) {
  const NAMES = { croplands: ["Croplands", ACC, true], forest: ["Forests", GOLD], savannas: ["Savannas", G2], shrublands_grasslands: ["Shrubland and grassland", G3], other: ["Other land", G4] };
  const S = C.cost.fires.filter((f) => NAMES[f.k]).map((f) => ser(f.data.map(([y, v]) => [y, v / 1e5]), ...NAMES[f.k]));
  chipLegend("legend-fires", S);
  const y1 = C.cost.firesAll.at(-1)[0];
  const top = Math.ceil(Math.max(...S.flatMap((s) => s.data.map((d) => d.value))) / 10) * 10 + 5;
  const ticks = []; for (let t = 0; t <= top; t += 10) ticks.push(t);
  const plot = linesPlot(S, { domain: [0, top], ticks, yLabel: "lakh hectares", fmtTick: (v) => String(v), fmtEnd: (v) => fmt.num1(v), x0: 2005, x1: y1, step: 5, marginRight: 230 });
  place("fires", plot, "Area burnt in India by land type, 2002 onward", S.map((s) => `${s.label}: ${fmt.num1(s.data.at(-1).value)} lakh hectares`).join("; "),
    "burnt-area-by-land-type", csvOf(["year", ...C.cost.fires.map((f) => f.k + "_ha")], C.cost.firesAll.map(([y]) => [y, ...C.cost.fires.map((f) => f.data.find((d) => d[0] === y)?.[1] ?? null)])));
  addCrosshair(document.getElementById("plot-fires"), plot, S, null, yearFmt, (v) => (v == null ? "—" : fmt.num1(v) + " lakh ha"));
}

/* ---------- every state: a sortable table ---------- */
{
  const table = document.getElementById("explorer");
  table?.querySelectorAll("th").forEach((th, col) => th.addEventListener("click", () => {
    const tbody = table.tBodies[0], rows = [...tbody.rows];
    const asc = th.getAttribute("aria-sort") === "descending";
    table.querySelectorAll("th").forEach((h) => h.removeAttribute("aria-sort"));
    th.setAttribute("aria-sort", asc ? "ascending" : "descending");
    const val = (r) => (col === 0 ? r.cells[0].textContent : parseFloat(r.cells[col].dataset.v));
    rows.sort((a, b) => {
      const x = val(a), y = val(b);
      if (col === 0) return asc ? x.localeCompare(y) : y.localeCompare(x);
      if (Number.isNaN(x)) return 1; if (Number.isNaN(y)) return -1;
      return asc ? x - y : y - x;
    });
    rows.forEach((r) => tbody.append(r));
  }));
}
