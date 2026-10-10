// src/dossiers/health-gender.charts.js: the chart helpers the Family health (NFHS) and Women
// and men guides share. Plot marks only, drawn once; every rule in src/charts/plumbing.js's
// header holds: one text mark per label side, labels outside dumbbells and never struck by a
// rule, ticks as strings, no smoothing.
import * as Plot from "@observablehq/plot";
import { MONO as mono, a11y, downloadSVG, downloadPNG, saveBlob, seamMarks, tint, SEAM_RULE } from "../charts/plumbing.js";

export const ACC = "#2E4BD8", INK = "#161A22", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6", GOLD = "#C47A16", GRID = "#F0F2F5";
export const W = 1184;
export const f1 = (v) => (v == null ? "—" : v.toFixed(1));
export const csvEsc = (s) => /[",\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s);
export const toCsv = (head, rows) => [head.join(","), ...rows.map((r) => r.map((x) => (x == null ? "" : csvEsc(x))).join(","))].join("\n") + "\n";

// downloads: the plate's own title, subtitle and source travel with the image (composeCardSVG)
export function wire(id, plot, file, csv) {
  const fig = document.getElementById(id);
  if (!fig) return;
  const meta = { title: fig.querySelector(".plate-head h3")?.textContent.trim(), sub: fig.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: fig.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  fig.querySelectorAll("[data-dl]").forEach((btn) => btn.addEventListener("click", () => {
    const k = btn.dataset.dl;
    if (k === "svg" && plot) downloadSVG(plot, file, meta);
    if (k === "png" && plot) downloadPNG(plot, file, meta);
    if (k === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), file + ".csv");
  }));
}
export const mount = (id) => document.getElementById(id);

/* ---------- dumbbell: NFHS-4 (grey) and NFHS-5 (blue) for each row ----------
 * rows: { label, a (NFHS-4 or null), b (NFHS-5) }. Labels sit outside the pair, never between
 * the dots (plumbing.js rule 2): the left dot's value to its left, the right dot's to its right.
 * A row with no NFHS-4 figure shows the NFHS-5 dot alone. */
export function dumbbell(el, rows, o = {}) {
  rows = rows.filter((r) => r.b != null);
  const vals = rows.flatMap((r) => [r.a, r.b]).filter((v) => v != null);
  const lo = o.lo ?? Math.min(0, ...vals), hi = o.hi ?? Math.max(...vals);
  const ml = o.ml ?? 330, mr = o.mr ?? 70;
  const fmt = o.fmt ?? f1;
  const left = rows.map((r) => (r.a != null && r.a < r.b ? { ...r, x: r.a, v: r.a, c: G1 } : { ...r, x: r.b, v: r.b, c: INK }));
  const right = rows.map((r) => (r.a != null && r.a > r.b ? { ...r, x: r.a, v: r.a, c: G1 } : { ...r, x: r.b, v: r.b, c: INK }));
  const onlyB = rows.filter((r) => r.a == null);
  const ticks = o.ticks ?? niceTicks(lo, hi, 5);
  const plot = Plot.plot({
    width: W, height: o.h ?? 34 + rows.length * 30 + 34, marginLeft: ml, marginRight: mr, marginTop: 10, marginBottom: 30,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { domain: [lo, Math.max(hi + (hi - lo) * 0.06, ticks.at(-1))], ticks, tickSize: 0, tickPadding: 8, tickFormat: (d) => String(o.tick ? o.tick(d) : d), label: o.xLabel ?? null, labelAnchor: "right", labelArrow: false },
    y: { domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s), label: null },
    marks: [
      Plot.gridX(ticks, { stroke: GRID }),
      ...(o.ref != null ? [Plot.ruleX([o.ref], { stroke: G2, strokeDasharray: "3,3" })] : []),
      Plot.link(rows.filter((r) => r.a != null), { y1: "label", y2: "label", x1: "a", x2: "b", stroke: G3, strokeWidth: 2 }),
      Plot.dot(rows.filter((r) => r.a != null), { y: "label", x: "a", r: 4.5, fill: G1, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "label", x: "b", r: 4.5, fill: ACC, stroke: "#fff", strokeWidth: 1.5 }),
      // the lower value labelled to its left, the higher to its right (one mark per side)
      Plot.text(left.filter((r) => !(r.a == null)), { y: "label", x: "x", text: (d) => fmt(d.v), dx: -10, textAnchor: "end", fill: (d) => d.c, fontSize: 12 }),
      Plot.text([...right.filter((r) => r.a != null), ...onlyB.map((r) => ({ ...r, x: r.b, v: r.b, c: INK }))], { y: "label", x: "x", text: (d) => fmt(d.v), dx: 10, textAnchor: "start", fill: (d) => d.c, fontSize: 12 }),
    ],
  });
  a11y(plot, o.title, o.desc);
  el.append(plot);
  return plot;
}
export function niceTicks(lo, hi, n) {
  const span = hi - lo, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? raw;
  const out = [];
  // the last tick reaches past the largest value, so no mark sits beyond the scale
  for (let v = Math.ceil(lo / step) * step; v < hi + step - 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/* ---------- state strip: one row per state, ranked; India as a labelled rule ----------
 * series: [{ key, label, color, hollow }] read from each row; the first is the one ranked. */
// the one state name too long for a chart's label column
const SHORT_GEO = { "Dadra & Nagar Haveli and Daman & Diu": "DNH and Daman & Diu", "Andaman & Nicobar  Islands": "Andaman & Nicobar Islands" };
export function stateStrip(el, rows, series, o = {}) {
  const k0 = series[0].key;
  rows = rows.map((r) => ({ ...r, geo: SHORT_GEO[r.geo] ?? r.geo }));
  rows = rows.filter((r) => r[k0] != null).sort((a, b) => b[k0] - a[k0]);
  const vals = rows.flatMap((r) => series.map((s) => r[s.key])).filter((v) => v != null);
  const hi = o.hi ?? Math.max(...vals, o.ref ?? 0), lo = o.lo ?? 0;
  const ticks = o.ticks ?? niceTicks(lo, hi, 5);
  const fmt = o.fmt ?? f1;
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 19 + 34, marginLeft: 230, marginRight: 70, marginTop: 30, marginBottom: 28,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { domain: [lo, Math.max(hi * 1.02, ticks.at(-1))], ticks, tickSize: 0, tickPadding: 8, tickFormat: (d) => String(o.tick ? o.tick(d) : d), label: null },
    y: { domain: rows.map((r) => r.geo), tickSize: 0, tickPadding: 10, tickFormat: (s) => String(s), label: null },
    marks: [
      Plot.gridX(ticks, { stroke: GRID }),
      ...(o.ref != null ? [
        Plot.ruleX([o.ref], { stroke: G1, strokeWidth: 1, strokeDasharray: "3,3" }),
        // the rule's label sits above the first row, clear of every dot
        Plot.text([{ x: o.ref }], { x: "x", frameAnchor: "top", dy: -18, text: () => `${o.refLabel ?? "India"} ${fmt(o.ref)}`, fill: G1, fontSize: 12 }),
      ] : []),
      ...(series.length > 1 ? [Plot.link(rows.filter((r) => series.every((s) => r[s.key] != null)), { y1: "geo", y2: "geo", x1: series[0].key, x2: series[1].key, stroke: G3, strokeWidth: 1.5 })] : []),
      ...series.slice().reverse().map((s) => Plot.dot(rows.filter((r) => r[s.key] != null), { y: "geo", x: s.key, r: 4, fill: s.hollow ? "#fff" : s.color, stroke: s.hollow ? s.color : "#fff", strokeWidth: 1.5 })),
      // the ranked value, at the row's right edge (outside the plot: no mark crosses it)
      Plot.text(rows, { y: "geo", frameAnchor: "right", dx: 58, text: (d) => fmt(d[k0]) + (d.caution ? "*" : ""), textAnchor: "end", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, o.title, o.desc);
  el.append(plot);
  return plot;
}

/* ---------- diverging bars: a change or a gap in points, one row each ---------- */
export function divBars(el, rows, o = {}) {
  const vals = rows.map((r) => r.v);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const pad = (hi - lo) * 0.14;
  const ticks = niceTicks(lo, hi, 6);
  const fmt = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1);
  const plot = Plot.plot({
    width: W, height: 30 + rows.length * 21 + 34, marginLeft: o.ml ?? 360, marginRight: 30, marginTop: 10, marginBottom: 30,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { domain: [lo - pad, hi + pad], ticks, tickSize: 0, tickPadding: 8, tickFormat: (d) => (d > 0 ? "+" : d < 0 ? "−" : "") + Math.abs(d), label: o.xLabel ?? null, labelAnchor: "right", labelArrow: false },
    y: { domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 10, tickFormat: (s) => String(s), label: null },
    marks: [
      Plot.gridX(ticks, { stroke: GRID }),
      Plot.barX(rows, { y: "label", x1: 0, x2: "v", fill: (d) => d.c ?? G2, insetTop: 4, insetBottom: 4 }),
      Plot.ruleX([0], { stroke: "#B5BAC4" }),
      Plot.text(rows.filter((r) => r.v >= 0), { y: "label", x: "v", text: (d) => fmt(d.v), dx: 6, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.text(rows.filter((r) => r.v < 0), { y: "label", x: "v", text: (d) => fmt(d.v), dx: -6, textAnchor: "end", fill: INK, fontSize: 11.5 }),
    ],
  });
  a11y(plot, o.title, o.desc);
  el.append(plot);
  return plot;
}


/* ---------- lines: one or more series over time, end-labelled ----------
 * series: [{ label, color, points: [{ date: Date, value }], width, est: Set(iso) of estimated
 * dates (drawn in a pale tint, CONTRACT-series 2b) }]. With `rulers`, the series are separate
 * instruments drawn through seamMarks("side"), never one line. */
export function lines(el, series, o = {}) {
  // the scales cover every point drawn, including the ruler groups seamMarks draws
  const all = [...series, ...(o.rulers?.flat() ?? [])].flatMap((s) => s.points);
  const vals = all.map((p) => p.value);
  const lo = o.lo ?? Math.min(0, ...vals), hi = o.hi ?? Math.max(...vals);
  const ticks = o.ticks ?? niceTicks(lo, hi, 5);
  const dates = all.map((p) => p.date);
  const x0 = new Date(Math.min(...dates)), x1 = new Date(Math.max(...dates));
  // xTicks "points": tick the observations themselves (census years, not every eighth year)
  const years = o.xTicks === "points" ? [...new Map(dates.map((d) => [+d, d])).values()].sort((a, b) => a - b) : o.xTicks ?? (() => { const a = x0.getUTCFullYear(), b = x1.getUTCFullYear(), step = Math.max(1, Math.ceil((b - a) / 8)); const t = []; for (let y = a; y <= b; y += step) t.push(new Date(Date.UTC(y, 0, 1))); return t; })();
  const fmt = o.fmt ?? f1;
  const marks = [Plot.gridY(ticks, { stroke: GRID }), Plot.ruleY([lo], { stroke: "#D3D7DE" })];
  if (o.ref != null) marks.push(Plot.ruleY([o.ref], { stroke: G2, strokeDasharray: "3,3" }), Plot.text([{ date: x0, value: o.ref }], { x: "date", y: "value", text: () => o.refLabel ?? String(o.ref), dy: -8, textAnchor: "start", fill: G1, fontSize: 12 }));
  for (const s of series) {
    const meas = s.points.filter((p) => !s.est?.has(p.iso)), est = s.points.filter((p, i, a) => s.est?.has(p.iso) || (i < a.length - 1 && s.est?.has(a[i + 1].iso)));
    if (s.ruler) continue;   // drawn by seamMarks below
    marks.push(Plot.lineY(meas, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 2, strokeLinejoin: "round", strokeLinecap: "round" }));
    if (est.length > 1) marks.push(Plot.lineY(est, { x: "date", y: "value", stroke: tint(s.color), strokeWidth: s.width ?? 2, strokeLinejoin: "round", strokeLinecap: "round" }));
    marks.push(Plot.dot(s.points, { x: "date", y: "value", r: s.points.length > 20 ? 0 : 2.5, fill: (p) => (s.est?.has(p.iso) ? tint(s.color) : s.color) }));
  }
  if (o.rulers) {
    // separate instruments, drawn side by side with the changeover marked (plumbing.js seamMarks)
    o.rulers.forEach((group, gi) => {
      // the changeover marker once per plate, on the first group; every group gets its lines
      marks.push(...seamMarks("side", group.map((s) => ({ data: s.points, color: s.color, width: s.width ?? 2 })), gi === 0 ? (o.seamMarker ?? { text: o.seamText, y: hi * 0.97 }) : false));
      // a group of three or more rulers: seamMarks marks the last changeover; the earlier ones get the same hairline
      if (gi === 0) for (const s of group.slice(1, -1)) marks.push(Plot.ruleX([s.points[0].date], { stroke: SEAM_RULE, strokeWidth: 1, strokeDasharray: "2,3" }));
      for (const s of group) marks.push(Plot.dot(s.points, { x: "date", y: "value", r: 3, fill: s.color, stroke: "#fff", strokeWidth: 1 }));
    });
  }
  // end labels, dodged so two lines ending close together never overlap
  // a series that runs on into a projection is labelled at its last measured point, so the label
  // states what was measured (the pale projection carries no number)
  const ends = series.filter((s) => !s.noLabel).map((s) => ({ s, p: s.points.filter((p) => !s.est?.has(p.iso)).at(-1) ?? s.points.at(-1) })).sort((a, b) => b.p.value - a.p.value);
  const gap = (hi - lo) * 0.06;
  ends.forEach((e, i) => { e.y = i && ends[i - 1].y - e.p.value < gap ? ends[i - 1].y - gap : e.p.value; });
  marks.push(Plot.text(ends, { x: (e) => e.p.date, y: "y", text: (e) => `${e.s.label} ${fmt(e.p.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }));
  const plot = Plot.plot({
    width: W, height: o.h ?? 420, marginLeft: 48, marginRight: o.mr ?? 210, marginTop: 20, marginBottom: 30,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    // windowed periods (three-year SRS averages) are labelled by their own names, not the middle year
    x: { type: "utc", domain: [x0, x1], ticks: o.periods ? [...new Set(all.map((p) => p.iso))].sort().filter((_, i, a) => a.length <= 9 || i % Math.ceil(a.length / 9) === 0 || i === a.length - 1).map((i) => new Date(i + "T00:00:00Z")) : years,
      tickSize: 0, tickPadding: 8, tickFormat: (d) => String(o.periods?.[d.toISOString().slice(0, 10)] ?? d.getUTCFullYear()) },
    y: { domain: [lo, Math.max(hi * 1.02, ticks.at(-1))], ticks, tickSize: 0, tickPadding: 8, tickFormat: (d) => String(o.tick ? o.tick(d) : d), label: o.yLabel ?? null, labelAnchor: "top", labelArrow: false },
    marks,
  });
  a11y(plot, o.title, o.desc);
  el.append(plot);
  return plot;
}

/* ---------- bars: one horizontal bar per row, value at the bar's end ---------- */
export function bars(el, rows, o = {}) {
  const hi = o.hi ?? Math.max(...rows.map((r) => r.v));
  const ticks = o.ticks ?? niceTicks(0, hi, 5);
  const fmt = o.fmt ?? f1;
  const plot = Plot.plot({
    width: W, height: 30 + rows.length * 26 + 34, marginLeft: o.ml ?? 330, marginRight: 80, marginTop: 10, marginBottom: 30,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { domain: [0, Math.max(hi * 1.05, ticks.at(-1))], ticks, tickSize: 0, tickPadding: 8, tickFormat: (d) => String(o.tick ? o.tick(d) : d), label: o.xLabel ?? null, labelAnchor: "right", labelArrow: false },
    y: { domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 10, tickFormat: (s) => String(s), label: null },
    marks: [
      Plot.gridX(ticks, { stroke: GRID }),
      ...(o.ref != null ? [Plot.ruleX([o.ref], { stroke: G1, strokeDasharray: "3,3" }), Plot.text([{ x: o.ref }], { x: "x", frameAnchor: "top", dy: -2, text: () => o.refLabel ?? String(o.ref), fill: G1, fontSize: 12, textAnchor: "start", dx: 4 })] : []),
      Plot.barX(rows, { y: "label", x1: 0, x2: "v", fill: (d) => d.c ?? ACC, insetTop: 5, insetBottom: 5 }),
      Plot.text(rows, { y: "label", x: "v", text: (d) => fmt(d.v), dx: 6, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, o.title, o.desc);
  el.append(plot);
  return plot;
}
