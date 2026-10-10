// src/dossiers/profiles.client.js: the charts of a state profile (src/pages/states/[state].astro).
// One module for all 36 profiles; each page carries its own data as one inline JSON block
// (#pf-data), written at build time by src/dossiers/profiles.js from the baked bundles. No
// runtime fetch. Every number in the page text is server-rendered; this only draws.
import * as Plot from "@observablehq/plot";
import { MONO as sans, a11y, addCrosshair, wireTools, seamMarks, dodgeEndLabels, saveBlob } from "../charts/plumbing.js";
import { FMT } from "./profiles.fmt.js";

const D = JSON.parse(document.getElementById("pf-data")?.textContent || "{}");
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16", GREY = "#A3A9B4", PALE = "#C9CED6";
const W = 1184;
const style = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const day = (iso) => new Date(iso + "T00:00:00Z");
const fy = (d) => { const y = d.getUTCFullYear(); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const mon = (d) => d.toLocaleString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
const pts = (arr) => arr.map(([d, v]) => ({ date: day(d), value: v }));
const el = (id) => document.getElementById(id);
const csvOf = (head, rows) => [head, ...rows].map((r) => r.map((c) => (c == null ? "" : /[",]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(",")).join("\n");
function wireCustom(figId, plot, filename, csv) {
  const fig = el(figId);
  if (!fig) return;
  wireTools(fig, plot, [], filename);
  // CSV for category charts: the rows as drawn (wireTools's CSV joins time series by date)
  const b = fig.querySelector('[data-dl="csv"]');
  if (b) { const nb = b.cloneNode(true); b.replaceWith(nb); nb.addEventListener("click", () => saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv")); }
}
const slug = (document.location?.pathname ?? "").split("/").filter(Boolean).at(-1) || "state";

/* ---------- where the state stands: one row per measure, each on its own scale ---------- */
if (D.where?.length && el("plot-where")) {
  const rows = D.where;
  // drawn once at the width the plate has: on a phone the measure's name sits above its row,
  // so the dots, not a column of labels, fill the screen (jsdom has no layout: the wide form)
  const avail = el("plot-where").clientWidth || W, narrow = avail < 700, PW = narrow ? avail : W;
  const H = narrow ? 92 : 64, TOP = narrow ? 44 : 30;
  const flat = [];
  const ends = [], mine = [], ind = [];
  rows.forEach((r, i) => {
    const vs = r.rows.map((x) => x.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
    const nx = (v) => (v - lo) / span;
    const y = i;
    for (const x of r.rows) flat.push({ y, x: nx(x.v), me: x.me });
    const minR = r.rows.find((x) => x.v === lo), maxR = r.rows.find((x) => x.v === hi);
    // the lowest and highest units, unless the unit itself is one (its own label says it)
    if (!minR.me) ends.push({ y, x: 0, t: `${minR.s} ${FMT[r.fmt](lo)}`, a: "start" });
    if (!maxR.me) ends.push({ y, x: 1, t: `${maxR.s} ${FMT[r.fmt](hi)}`, a: "end" });
    mine.push({ y, x: nx(r.me), t: FMT[r.fmt](r.me) });
    if (r.india != null) ind.push({ y, x: nx(r.india) });
  });
  const plot = Plot.plot({
    width: PW, height: TOP + rows.length * H, marginLeft: narrow ? 10 : 270, marginRight: narrow ? 10 : 24, marginTop: 0, marginBottom: 0, style,
    x: { domain: [-0.02, 1.02], axis: null },
    y: { domain: [-0.5, rows.length - 0.5], axis: null, range: [TOP / 2, TOP / 2 + rows.length * H] },
    marks: [
      Plot.ruleY(rows.map((_, i) => i), { x1: 0, x2: 1, stroke: GRID }),
      Plot.ruleX(ind, { x: "x", y1: (d) => d.y - 0.16, y2: (d) => d.y + 0.16, stroke: GOLD, strokeWidth: 2 }),
      Plot.dot(flat.filter((d) => !d.me), { x: "x", y: "y", r: 3.5, fill: PALE }),
      Plot.dot(flat.filter((d) => d.me), { x: "x", y: "y", r: 5.5, fill: ACC, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(mine, { x: "x", y: "y", text: "t", dy: -15, fill: INK, fontWeight: 600, fontSize: 12.5 }),
      Plot.text(ends.filter((e) => e.a === "start"), { x: "x", y: "y", text: "t", dy: 17, textAnchor: "start", fill: MUTED, fontSize: 11.5 }),
      Plot.text(ends.filter((e) => e.a === "end"), { x: "x", y: "y", text: "t", dy: 17, textAnchor: "end", fill: MUTED, fontSize: 11.5 }),
      // the measure on one line and its period under it, so no label runs past the left edge;
      // on a phone, the measure and its period on one line above the row
      ...(narrow
        ? [Plot.text(rows.map((_, i) => ({ y: i })), { x: -0.02, y: "y", text: (d) => `${rows[d.y].label}, ${rows[d.y].period}`, textAnchor: "start", dy: -36, fill: INK, fontSize: 12.5 })]
        : [Plot.text(rows.map((_, i) => ({ y: i })), { x: -0.02, y: "y", text: (d) => rows[d.y].label, textAnchor: "end", dx: -14, dy: -7, fill: INK, fontSize: 12.5 }),
           Plot.text(rows.map((_, i) => ({ y: i })), { x: -0.02, y: "y", text: (d) => rows[d.y].period, textAnchor: "end", dx: -14, dy: 9, fill: MUTED, fontSize: 11.5 })]),
    ],
  });
  // drawn to the phone's width, so the site's 700px floor for scrolling plates does not apply
  if (narrow) Object.assign(plot.style, { minWidth: "0", maxWidth: "100%" });
  el("plot-where").append(plot);
  a11y(plot, "Where the state stands", rows.map((r) => `${r.label} ${FMT[r.fmt](r.me)}, ${r.period}`).join("; "));
  wireCustom("cb-where", plot, `${slug}-where`, csvOf(["measure", "period", "state or UT", "value", "this unit"], rows.flatMap((r) => r.rows.map((x) => [r.label, r.period, x.s, x.v, x.me ? "yes" : ""]))));
}

/* ---------- a line plate over time, with end labels and a crosshair ---------- */
function lines(id, figId, list, { tickFmt, valFmt, yTick = valFmt, yLabel, fmtDate, extra = [], file }) {
  const host = el(id);
  if (!host || !list.length) return;
  const all = list.flatMap((s) => s.data.map((d) => d.value));
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const ends = dodgeEndLabels(list.filter((s) => s.end !== false), (hi - lo) / 16);
  const xEnd = new Date(Math.max(...list.flatMap((s) => s.data.filter((d) => d.value != null).map((d) => d.date.getTime()))));
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 64, marginRight: 230, marginTop: 30, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 8, tickFormat: tickFmt, ticks: 8 },
    y: { label: yLabel, labelAnchor: "top", labelArrow: false, tickSize: 0, tickPadding: 8, domain: [lo, hi * 1.06], ticks: 6, tickFormat: (v) => yTick(v), grid: false },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...extra,
      ...list.filter((s) => !s.custom).map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 2, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.dot(ends.map((e) => { const d = [...e.s.data].reverse().find((x) => x.value != null); return { ...d, c: e.s.color }; }), { x: "date", y: "value", r: 3.25, fill: (d) => d.c }),
      // end labels at one right edge, past every line's last point, so no line ending later strikes them
      Plot.text(ends.map((e) => ({ date: xEnd, y: e.y, t: `${e.s.endLabel ?? e.key} ${valFmt(e.value)}` })), { x: "date", y: "y", text: "t", dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  host.append(plot);
  a11y(plot, el(figId)?.querySelector("h3")?.textContent.trim() ?? "", ends.map((e) => `${e.key} ${valFmt(e.value)}`).join("; "));
  // one shared date axis for the crosshair and the CSV: every series aligned on the union of dates
  const keys = [...new Set(list.flatMap((s) => s.data.map((d) => d.date.getTime())))].sort((a, b) => a - b);
  const aligned = list.map((s) => { const m = new Map(s.data.map((d) => [d.date.getTime(), d.value])); return { label: s.label, name: s.label, color: s.color, data: keys.map((t) => ({ date: new Date(t), value: m.get(t) ?? null })) }; });
  addCrosshair(host, plot, aligned, null, fmtDate, (v) => (v == null ? "—" : valFmt(v)));
  wireTools(el(figId), plot, aligned, file, (d) => d.toISOString().slice(0, 10));
}

if (D.income) {
  const list = [{ label: D.income.mine.label, endLabel: D.short, data: pts(D.income.mine.data), color: ACC, width: 2.25 },
    { label: "Middle state", data: pts(D.income.median.data), color: GREY, width: 1.5 }];
  const extra = [];
  // the former state (J&K with Ladakh, to 2018-19) is another territory: its own ruler, beside
  for (const f of D.income.former) {
    const old = { label: f.label.replace(/^the former state of /, "former state, "), endLabel: "Former state", data: pts(f.data), color: "#7D8FE6", width: 1.5 };
    extra.push(...seamMarks("side", [{ ...old }, { data: list[0].data, color: ACC, width: 2.25 }], { text: "The union territory from here", y: Math.max(...list[0].data.map((d) => d.value)) * 0.06 }));
    list[0].custom = true;
    list.push({ ...old, custom: true });
  }
  lines("plot-income", "cb-income", list, { tickFmt: (d) => fy(d), valFmt: (v) => "₹" + Math.round(v).toLocaleString("en-IN"), yTick: (v) => (v === 0 ? "0" : "₹" + (v / 1e5).toLocaleString("en-IN") + " lakh"), yLabel: "₹ a year, current prices", fmtDate: fy, extra, file: `${slug}-income-per-person` });
}

if (D.climate) {
  const data = pts(D.climate.data);
  const vs = data.map((d) => d.value), lo = Math.floor(Math.min(...vs) - 0.5), hi = Math.ceil(Math.max(...vs) + 0.5);
  const host = el("plot-climate");
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 56, marginRight: 230, marginTop: 30, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 8, ticks: 10, tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "°C, the year's average", labelAnchor: "top", labelArrow: false, tickSize: 0, tickPadding: 8, domain: [lo, hi], tickFormat: (v) => v.toFixed(0) + "°C" },
    marks: [
      Plot.gridY({ stroke: GRID }),
      D.climate.normal != null ? Plot.ruleY([D.climate.normal], { stroke: GOLD, strokeDasharray: "3,3" }) : null,
      D.climate.normal != null ? Plot.text([{ date: data.at(-1).date, value: D.climate.normal }], { x: "date", y: "value", text: [`${D.climate.span} average ${FMT.degC(D.climate.normal)}`], dx: 10, dy: 14, textAnchor: "start", fill: MUTED, fontSize: 12 }) : null,
      Plot.lineY(data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([data.at(-1)], { x: "date", y: "value", r: 3.25, fill: ACC }),
      Plot.text([data.at(-1)], { x: "date", y: "value", text: (d) => `${d.date.getUTCFullYear()}: ${FMT.degC(d.value)}`, dx: 10, dy: -8, textAnchor: "start", fill: INK, fontSize: 12 }),
    ].filter(Boolean),
  });
  host.append(plot);
  a11y(plot, el("cb-climate").querySelector("h3").textContent.trim(), `${data.at(-1).date.getUTCFullYear()} ${FMT.degC(data.at(-1).value)}`);
  const S = [{ label: D.climate.label, name: "temperature_c", color: ACC, data }];
  addCrosshair(host, plot, S, null, (d) => String(d.getUTCFullYear()), (v) => (v == null ? "—" : FMT.degC(v)));
  wireTools(el("cb-climate"), plot, S, `${slug}-temperature`, (d) => String(d.getUTCFullYear()));
}

if (D.prices) {
  const [s12, s24] = [D.prices.rulers.find((r) => /2012/.test(r.label)), D.prices.rulers.find((r) => /2024/.test(r.label))];
  const [i12, i24] = D.prices.india;
  const R = (r, color, width) => (r ? { label: r.label, endLabel: /^All India/.test(r.label) ? "All India" : D.short, data: pts(r.data), color, width } : null);
  const st = [R(s12, ACC, 2), R(s24, ACC, 2.25)].filter(Boolean), ia = [R(i12, GREY, 1.5), R(i24, GREY, 1.5)];
  const all = [...st, ...ia].flatMap((s) => s.data.map((d) => d.value));
  const top = Math.max(...all);
  const extra = [...seamMarks("side", ia, false), ...(st.length === 2 ? seamMarks("side", st, { text: "Base 2024 from Jan 2026", y: top, anchor: "start" }) : st.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width })))];
  const list = [...st, ...ia].map((s) => ({ ...s, custom: true, end: s === st.at(-1) || s === ia[1] }));
  lines("plot-prices", "cb-prices", list, { tickFmt: (d) => String(d.getUTCFullYear()), valFmt: (v) => v.toFixed(1) + "%", yTick: (v) => v.toFixed(0) + "%", yLabel: "↑ per cent, on a year earlier", fmtDate: mon, extra, file: `${slug}-prices` });
}

/* ---------- category plates ---------- */
if (D.growth && el("plot-growth")) {
  const mine = D.growth.mine.data.map(([d, v]) => ({ y: fy(day(d)), v }));
  const ind = D.growth.india.data.map(([d, v]) => ({ y: fy(day(d)), v })).filter((x) => mine.some((m) => m.y === x.y));
  const all = [...mine, ...ind].map((x) => x.v), lo = Math.min(0, ...all), hi = Math.max(...all);
  const plot = Plot.plot({
    width: W, height: 430, marginLeft: 56, marginRight: 24, marginTop: 30, marginBottom: 34, style,
    x: { domain: mine.map((m) => m.y), label: null, tickSize: 0, tickPadding: 8, padding: 0.35 },
    y: { domain: [lo * 1.1, hi * 1.15], label: "↑ per cent, real", labelAnchor: "top", labelArrow: false, tickSize: 0, tickPadding: 8, tickFormat: (v) => v.toFixed(0) + "%" },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.barY(mine, { x: "y", y: "v", fill: (d) => (d === mine.at(-1) ? ACC : "#B9C3F3") }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.tickY(ind, { x: "y", y: "v", stroke: GOLD, strokeWidth: 2.5 }),
      Plot.text(mine.slice(-1), { x: "y", y: "v", text: (d) => FMT.pct1(d.v), dy: (mine.at(-1).v >= 0 ? -10 : 12), fill: INK, fontWeight: 600 }),
    ],
  });
  el("plot-growth").append(plot);
  a11y(plot, el("cb-growth").querySelector("h3").textContent.trim(), mine.map((m) => `${m.y} ${FMT.pct1(m.v)}`).join(", "));
  wireCustom("cb-growth", plot, `${slug}-growth`, csvOf(["year", "state real GSDP growth, %", "India real GDP growth, % (computed)"], mine.map((m) => [m.y, m.v, ind.find((x) => x.y === m.y)?.v ?? ""])));
}

function pairBars(id, figId, rows, { file, xMax = 100, catOf, whoOf }) {
  if (!el(id)) return;
  const cats = rows.map(catOf);
  const data = rows.flatMap((r) => [{ c: catOf(r), who: "this", v: r.me }, ...(r.india != null ? [{ c: catOf(r), who: "India", v: r.india }] : [])]);
  // on a phone the category name sits above its bar (measured once, as the where-chart is)
  const avail = el(id).clientWidth || W, narrow = avail < 700;
  const plot = Plot.plot({
    width: narrow ? avail : W, height: 40 + rows.length * (narrow ? 62 : 46), marginLeft: narrow ? 10 : 220, marginRight: narrow ? 56 : 90, marginTop: 30, marginBottom: 8, style,
    x: { domain: [0, xMax], axis: "top", label: null, tickSize: 0, tickPadding: 6, tickFormat: (v) => v + "%", ...(narrow ? { ticks: 5 } : {}) },
    y: { domain: cats, label: null, tickSize: 0, tickPadding: 12, axis: narrow ? null : "left" },
    fy: undefined,
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleY(data.filter((d) => d.who === "this"), { y: "c", x1: 0, x2: "v", stroke: ACC, strokeWidth: 9 }),
      // on a phone the tick spans the bar only, never the category name above it
      Plot.tickX(data.filter((d) => d.who === "India"), { y: "c", x: "v", stroke: GOLD, strokeWidth: 2.5, insetTop: narrow ? 20 : 8, insetBottom: narrow ? 20 : 8 }),
      // the value sits at the bar's end, or past the India tick when the tick would strike it
      Plot.text(data.filter((d) => d.who === "this"), { y: "c", x: (d) => { const i = rows.find((r) => catOf(r) === d.c).india; return i != null && i > d.v && i - d.v < (narrow ? 18 : 7) ? i : d.v; }, text: (d) => FMT.pct1(d.v), dx: 10, textAnchor: "start", fill: INK, fontWeight: 600 }),
      Plot.ruleX([0], { stroke: BASE }),
      ...(narrow ? [Plot.text(cats.map((c) => ({ c })), { y: "c", x: 0, text: "c", textAnchor: "start", dy: -16, fill: INK, fontSize: 12 })] : []),
    ],
  });
  if (narrow) Object.assign(plot.style, { minWidth: "0", maxWidth: "100%" });
  el(id).append(plot);
  a11y(plot, el(figId).querySelector("h3").textContent.trim(), rows.map((r) => `${catOf(r)} ${FMT.pct1(r.me)}${r.india != null ? ", India " + FMT.pct1(r.india) : ""}`).join("; "));
  wireCustom(figId, plot, file, csvOf(["measure", "this unit, %", "All India, %"], rows.map((r) => [catOf(r), r.me, r.india])));
}
if (D.structure) pairBars("plot-structure", "cb-structure", D.structure.rows, { file: `${slug}-structure`, catOf: (r) => r.label });
if (D.work) pairBars("plot-work", "cb-work", D.work.rows, { file: `${slug}-work`, catOf: (r) => `${r.label}, ${r.who.toLowerCase()}` });
