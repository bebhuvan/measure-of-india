// Guide: work in India as the ILO counts it. Plates and number wiring.
// Data: the ilo-* bundles (scripts/lib/products/ilostat.mjs), read at build time by
// src/dossiers/ilo.data.js and embedded in the page as one JSON block (#ilo-data) holding only
// the series drawn here, in bundle shape. Instruments are never joined: the ILO's modelled
// estimates (ILOEST), its processing of PLFS, NSS rounds and the Census are drawn as separate
// marks, and MoSPI's own PLFS figures (data/series/plfs-annual.json, the jobs guide's bundle)
// sit beside them as a fifth ruler. Modelled years flagged R (real) by the ILO are drawn as
// solid dots; projection years are dashed and never labelled as data.

import * as Plot from "@observablehq/plot";
import { MONO as sans, hydrate, a11y, addCrosshair, wireTools, spark, seamMarks, fmt } from "../charts/plumbing.js";

const RAW = JSON.parse(document.getElementById("ilo-data")?.textContent || "{}");
const B = Object.fromEntries(Object.entries(RAW).map(([k, b]) => [k, { ...b, S: hydrate(b) }]));

const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const ACC = "#2E4BD8", ACC_T = "#AFBBF0", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const style = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const Y = (y) => new Date(Date.UTC(y, 0, 1));
const yr = (d) => d.getUTCFullYear();
const nn = (s) => s.data.filter((d) => d.value != null);
const lastP = (s) => nn(s).at(-1);
const firstP = (s) => nn(s)[0];
const atY = (s, y) => s.data.find((d) => yr(d.date) === y)?.value ?? null;
const mn = (v) => (v / 1000).toFixed(1);           // thousands -> millions, display only
const p1 = (v) => fmt.pct1(v);

/* ---------- year ticks: 1991, ’95, ’00 … 2024 ---------- */
function yearTicks(from, to, step) {
  const t = [];
  for (let y = Math.ceil(from / step) * step; y <= to; y += step) t.push(y);
  if (t[0] !== from && t[0] - from < step / 2) t.shift();
  if (t.at(-1) !== to && to - t.at(-1) < step / 2) t.pop();
  return [from, ...t.filter((y) => y !== from && y !== to), to].map(Y);
}
const yearFmt = (ticks) => (d) => {
  const y = yr(d);
  return y === yr(ticks[0]) || y === yr(ticks.at(-1)) ? String(y) : "’" + String(y).slice(2);
};

/* ---------- end labels: placed right of every line, pushed apart so none overlap ---------- */
function dodge(items, gap) {
  const s = [...items].sort((a, b) => a.v - b.v);
  for (let i = 1; i < s.length; i++) if (s[i].y - s[i - 1].y < gap) s[i].y = s[i - 1].y + gap;
  return s;
}

/**
 * A time-series plate. series: [{ s (hydrated), label, color, width, dash, dots, hollow, end }]
 * end: text for the end label (null = none). Optional band: { lo:[{date,value}], hi, color }.
 */
function timeChart(id, { series, from, to, seam = false, ml = 48, step = 5, yDomain, yTicks, yFmt = (v) => String(v), yLabel, height = 440, mr = 200, rules = [], bands = [], tipFmt = (v) => (v == null ? "—" : v.toFixed(1)), title, desc, fname }) {
  const host = document.getElementById("plot-" + id);
  if (!host) return null;
  const ticks = yearTicks(from, to, step);
  const marks = [Plot.gridY(yTicks.slice(1), { stroke: GRID }), Plot.ruleY([yDomain[0] < 0 ? 0 : yDomain[0]], { stroke: BASE })];
  for (const b of bands) marks.push(Plot.areaY(b.rows, { x: "date", y1: "lo", y2: "hi", fill: b.color, fillOpacity: 1 }));
  for (const r of rules) {
    marks.push(Plot.ruleX([r.date], { stroke: "#B5BAC4", strokeDasharray: "2 3" }));
    marks.push(Plot.text([{ x: r.date, y: r.y }], { x: "x", y: "y", text: () => r.text, dx: r.side === "end" ? -6 : 6, textAnchor: r.side === "end" ? "end" : "start", fill: MUTED, fontSize: 11.5 }));
  }
  const pxPerUnit = (height - 70) / (yDomain[1] - yDomain[0]);
  const labels = [];
  // a plate of several instruments draws its line rulers through the shared seam helper:
  // side by side on one axis, never joined (src/charts/plumbing.js seamMarks)
  if (seam) marks.push(...seamMarks("side", series.filter((x) => !x.dots).map((x) => ({ data: x.s.data.filter((d) => yr(d.date) >= from && yr(d.date) <= to), color: x.color, width: x.width ?? 1.75 })), false));
  for (const x of series) {
    const data = x.s.data.filter((d) => yr(d.date) >= from && yr(d.date) <= to);
    if (seam && !x.dots) {
      // drawn by seamMarks above; only its end label is collected below
    } else if (x.dots) {
      marks.push(Plot.dot(data.filter((d) => d.value != null), { x: "date", y: "value", r: x.r ?? 3.5, fill: x.hollow ? "#fff" : x.color, stroke: x.color, strokeWidth: 1.5 }));
    } else {
      marks.push(Plot.lineY(data, { x: "date", y: "value", stroke: x.color, strokeWidth: x.width ?? 1.75, strokeDasharray: x.dash, strokeLinejoin: "round", strokeLinecap: "round" }));
      if (x.real) marks.push(Plot.dot(data.filter((d) => d.value != null && x.real.has(yr(d.date))), { x: "date", y: "value", r: 2.6, fill: x.color, stroke: "#fff", strokeWidth: 1 }));
    }
    const e = data.filter((d) => d.value != null).at(-1);
    if (x.end && e) labels.push({ v: e.value, y: e.value * pxPerUnit, text: x.end, bold: !!x.bold });
  }
  for (const l of dodge(labels, 15)) {
    marks.push(Plot.text([{ x: Y(to), y: l.y / pxPerUnit }], { x: "x", y: "y", text: () => l.text, dx: 12, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: l.bold ? 600 : 400 }));
  }
  const plot = Plot.plot({
    width: W, height, marginLeft: ml, marginRight: mr, marginTop: 30, marginBottom: 34, style,
    x: { type: "utc", domain: [Y(from), Y(to)], ticks, tickFormat: yearFmt(ticks), tickSize: 4, tickPadding: 8, label: null },
    y: { domain: yDomain, ticks: yTicks, tickFormat: yFmt, tickSize: 0, tickPadding: 10, label: yLabel, labelAnchor: "top", labelArrow: false },
    marks,
  });
  a11y(plot, title, desc);
  host.append(plot);
  const tipSeries = series.filter((x) => !x.noTip).map((x) => ({ ...x.s, label: x.label, color: x.color }));
  addCrosshair(host, plot, tipSeries, null, (d) => String(yr(d)), tipFmt);
  wireTools(document.getElementById("cb-" + id), plot, tipSeries.map((s) => ({ ...s, name: s.label })), "india-atlas_ilo-" + (fname ?? id), (d) => String(yr(d)));
  return plot;
}

/** Horizontal bars for one period, with an optional hollow dot for an earlier period. */
function hbars(id, rows, { xMax, xTicks, xFmt, label, valueFmt, hl, title, desc, csv, ml = 250 }) {
  const host = document.getElementById("plot-" + id);
  if (!host) return null;
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 40, marginLeft: ml, marginRight: 100, marginTop: 24, marginBottom: 30, style,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks.slice(1), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? ACC : "#C9CED6"), insetTop: 11, insetBottom: 11 }),
      Plot.dot(rows.filter((r) => r.was != null), { y: "name", x: "was", r: 4, fill: "#fff", stroke: G1, strokeWidth: 1.5 }),
      // the value sits at the bar's end; only an earlier dot just beyond the bar pushes it past
      // the dot (a dot far beyond the bar is left alone, so the value never reads as the dot's)
      Plot.text(rows, { y: "name", x: (d) => (d.was != null && d.was > d.v && (d.was - d.v) * ((W - ml - 100) / xMax) < 60 ? d.was : d.v), text: (d) => valueFmt(d.v), dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  a11y(plot, title, desc);
  host.append(plot);
  const el = document.getElementById("cb-" + id);
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "csv") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `india-atlas_ilo-${id}.csv`; a.click(); }
  }));
  wireTools(el, plot, [], "india-atlas_ilo-" + id);
  return plot;
}

/* ======================================================================
   title block and § 01
   ====================================================================== */
const E = B.lfpr?.S, EW = B.epr?.S, U = B.ur?.S, N = B.neet?.S, M = B.emp?.S;
const keyL = (sex, a = "yge15") => `eap_2wap_sex_age_rt__sex_${sex}__age_ythadult_${a}`;
const keyU = (sex, a = "yge15") => `une_2eap_sex_age_rt__sex_${sex}__age_ythadult_${a}`;
const keyEmp = "emp_2emp_sex_age_nb__sex_t__age_ythadult_yge15";
if (E && M && N) {
  const empL = lastP(M[keyEmp]), lf = lastP(E[keyL("t")]), lfw = lastP(E[keyL("f")]), lfw91 = firstP(E[keyL("f")]);
  const nt = lastP(N.eip_2eet_sex_rt__sex_f), ntT = lastP(N.eip_2eet_sex_rt__sex_t);
  setHTML("m-latest", String(yr(lf.date)));
  setHTML("n-emp", mn(empL.value) + pc(" million"));
  setHTML("d-emp", `<b>${mn(firstP(M[keyEmp]).value)} million</b> in ${yr(firstP(M[keyEmp]).date)}`);
  setHTML("n-lfpr", lf.value.toFixed(1) + pc("%"));
  setHTML("d-lfpr", `<b>${fmt.pct1(atY(E[keyL("t")], 2000))}</b> in 2000`);
  setHTML("n-women", lfw.value.toFixed(1) + pc("%"));
  setHTML("d-women", `<b>${fmt.pct1(lfw91.value)}</b> in ${yr(lfw91.date)}; men ${fmt.pct1(lastP(E[keyL("m")]).value)}`);
  setHTML("n-neet", nt.value.toFixed(1) + pc("%"));
  setHTML("d-neet", `young women aged 15 to 24; <b>${fmt.pct1(ntT.value)}</b> of all youth`);
  spark("nspark-emp", { ...M[keyEmp], color: ACC });
  setHTML("rb-emp", mn(empL.value) + pc(" million"));
  setHTML("rb-lfpr", lf.value.toFixed(1) + pc("%"));
  setHTML("cr-emp", mn(empL.value) + " million");
  setHTML("cr-lfpr", fmt.pct1(lf.value));
}

/* ======================================================================
   § 02 participation since 1991
   ====================================================================== */
if (E) {
  const P = B.proj?.S ?? {};
  const realOf = (k) => new Set((B.lfpr.series[k].flags?.R ?? []).map((d) => +d.slice(0, 4)));
  const ser = [
    { s: E[keyL("m")], label: "Men", color: G1, end: `Men ${p1(lastP(E[keyL("m")]).value)}`, real: realOf(keyL("m")) },
    { s: E[keyL("t")], label: "Everyone 15+", color: G2, end: `All ${p1(lastP(E[keyL("t")]).value)}`, real: realOf(keyL("t")) },
    { s: E[keyL("f")], label: "Women", color: ACC, width: 2.25, bold: true, end: `Women ${p1(lastP(E[keyL("f")]).value)}`, real: realOf(keyL("f")) },
  ];
  for (const [k, c] of [[keyL("m"), G1], [keyL("t"), G2], [keyL("f"), ACC]]) if (P[k]) ser.push({ s: { ...P[k], data: P[k].data.filter((d) => yr(d.date) <= 2027) }, label: "Projection", color: c, dash: "3 4", width: 1.5, noTip: true });
  const lastYr = yr(lastP(E[keyL("t")]).date);
  timeChart("lfpr", {
    series: ser, from: 1990, to: 2027, yDomain: [0, 100], yTicks: [0, 20, 40, 60, 80, 100], yFmt: (v) => v + (v === 100 ? "%" : ""), yLabel: "share of people aged 15+ in the labour force, per cent",
    rules: [{ date: Y(lastYr + 0.5), y: 96, text: "Projections", side: "start" }],
    title: "Labour force participation by sex, ILO modelled estimates", fname: "participation",
    desc: `Women ${p1(firstP(E[keyL("f")]).value)} in 1990, ${p1(lastP(E[keyL("f")]).value)} in ${lastYr}; men ${p1(lastP(E[keyL("m")]).value)}.`,
  });
  const lw = E[keyL("f")], low = nn(lw).filter((d) => yr(d.date) >= 2005).reduce((a, d) => (d.value < a.value ? d : a));
  setHTML("pv-lfpr", p1(lastP(lw).value));
  setHTML("ex-lfpr-low", `${p1(low.value)} in ${yr(low.date)}`);
  setHTML("ex-lfpr-peak", `${p1(atY(lw, 2005))}`);
  setHTML("ex-lfpr-now", p1(lastP(lw).value));
}

/* ======================================================================
   § 03 five rulers for one question
   ====================================================================== */
if (B.slfpr && B.nlfpr && B.clfpr && E && B.mospi) {
  const sk = (sex) => `eap_dwap_sex_age_rt__sex_${sex}__age_ythadult_yge15`;
  const MO = B.mospi.S;
  // MoSPI's July-June survey years are plotted at their middle (1 January of the second year)
  const shift = (s) => ({ ...s, data: s.data.map((d) => ({ date: new Date(Date.UTC(yr(d.date) + 1, 0, 1)), value: d.value })) });
  const ser = [
    { s: E[keyL("t")], label: "ILO model", color: G2, width: 1.5, end: `ILO model ${p1(lastP(E[keyL("t")]).value)}` },
    { s: B.clfpr.S[sk("t")], label: "Census (ILO processing)", color: G1, dots: true, hollow: true, end: null },
    { s: B.nlfpr.S[sk("t")], label: "NSS rounds (ILO processing)", color: G1, dots: true, end: null },
    { s: shift(MO.lfpr_psss), label: "PLFS, MoSPI, usual status", color: GOLD, width: 1.75, end: `MoSPI, usual status ${p1(lastP(MO.lfpr_psss).value)}` },
    { s: shift(MO.lfpr_cws), label: "PLFS, MoSPI, weekly status", color: "#E2B36F", width: 1.5, end: `MoSPI, weekly status ${p1(lastP(MO.lfpr_cws).value)}` },
    { s: B.slfpr.S[sk("t")], label: "PLFS, ILO processing", color: ACC, width: 2.25, bold: true, end: `ILO, from PLFS ${p1(lastP(B.slfpr.S[sk("t")]).value)}` },
  ];
  timeChart("rulers", {
    series: ser, seam: true, from: 1961, to: 2025, step: 10, yDomain: [40, 70], yTicks: [40, 45, 50, 55, 60, 65, 70], yFmt: (v) => v + (v === 70 ? "%" : ""), yLabel: "labour force participation, everyone aged 15+, per cent", mr: 240,
    title: "Labour force participation by instrument", fname: "five-rulers",
    desc: `ILO from PLFS ${p1(lastP(B.slfpr.S[sk("t")]).value)} in ${yr(lastP(B.slfpr.S[sk("t")]).date)}; MoSPI usual status ${p1(lastP(MO.lfpr_psss).value)} in 2023-24.`,
  });
  const gap = lastP(MO.lfpr_psss).value - lastP(MO.lfpr_cws).value;
  setHTML("pv-rulers", fmt.pt1(gap));
  setHTML("ex-r-psss", p1(lastP(MO.lfpr_psss).value));
  setHTML("ex-r-cws", p1(lastP(MO.lfpr_cws).value));
  setHTML("ex-r-ilo", p1(atY(B.slfpr.S[sk("t")], 2024)));
  setHTML("ex-r-est", p1(atY(E[keyL("t")], 2024)));
}

/* ======================================================================
   § 04 the unemployment rate the model made up
   ====================================================================== */
if (U) {
  const k = keyU("t"), ky = keyU("t", "y15_24");
  const bnd = (key) => { const b = B.ur.series[key]; return B.ur.dates.map((d, i) => ({ date: new Date(d + "T00:00:00Z"), lo: b.lower?.[i], hi: b.upper?.[i] })).filter((r) => r.lo != null && r.hi != null && r.hi > r.lo); };
  const realY = new Set((B.ur.series[k].flags?.R ?? []).map((d) => +d.slice(0, 4)));
  const firstReal = Math.min(...realY);
  const survey = B.sur?.S?.["une_deap_sex_age_rt__sex_t__age_ythadult_yge15"];
  const nssU = B.nur?.S?.["une_deap_sex_age_rt__sex_t__age_ythadult_yge15"];
  const ser = [
    { s: U[ky], label: "Youth 15-24, model", color: G2, width: 1.5, end: `Aged 15-24 ${p1(lastP(U[ky]).value)}`, real: new Set((B.ur.series[ky].flags?.R ?? []).map((d) => +d.slice(0, 4))) },
    { s: U[k], label: "Everyone 15+, model", color: ACC, width: 2.25, bold: true, end: `Everyone 15+ ${p1(lastP(U[k]).value)}`, real: realY },
    ...(survey ? [{ s: survey, label: "PLFS, ILO processing", color: G1, dots: true, end: null }] : []),
    ...(nssU ? [{ s: nssU, label: "NSS rounds, ILO processing", color: G1, dots: true, hollow: true, end: null }] : []),
  ];
  timeChart("unemp", {
    series: ser, from: 1991, to: 2024, yDomain: [0, 30], yTicks: [0, 5, 10, 15, 20, 25, 30], yFmt: (v) => v + (v === 30 ? "%" : ""), yLabel: "unemployment rate, per cent of the labour force",
    bands: [{ rows: bnd(k), color: "#E7EBFC" }],
    rules: [{ date: Y(firstReal), y: 28.5, text: "Survey data from here", side: "start" }],
    title: "India's unemployment rate in the ILO's model, with its uncertainty band", fname: "unemployment",
    desc: `Imputed at about ${p1(atY(U[k], 2000))} through ${firstReal - 1}, band from ${p1(bnd(k)[0].lo)} to ${p1(bnd(k)[0].hi)} in ${yr(bnd(k)[0].date)}; ${p1(lastP(U[k]).value)} in ${yr(lastP(U[k]).date)}.`,
  });
  const b0 = bnd(k).find((r) => yr(r.date) === 2000) ?? bnd(k)[0];
  setHTML("pv-unemp", p1(lastP(U[k]).value));
  setHTML("ex-u-flat", p1(atY(U[k], 2000)));
  setHTML("ex-u-band", `${p1(b0.lo)} to ${p1(b0.hi)}`);
  setHTML("ex-u-first", String(firstReal));
  setHTML("ex-u-now", p1(lastP(U[k]).value));
  setHTML("ex-u-youth", p1(lastP(U[ky]).value));
  if (nssU) { const v = nn(nssU).map((d) => d.value); setHTML("ex-u-nss", `between ${p1(Math.min(...v))} and ${p1(Math.max(...v))}`); }
}

/* ======================================================================
   § 05 women: by age, by schooling, by place
   ====================================================================== */
if (B.slfpr) {
  const S = B.slfpr.S, L = B.slfpr.dates.length - 1, Ly = +B.slfpr.dates[L].slice(0, 4), F0 = +B.slfpr.dates[0].slice(0, 4);
  const bands = ["y15_19", "y20_24", "y25_29", "y30_34", "y35_39", "y40_44", "y45_49", "y50_54", "y55_59", "y60_64", "yge65"];
  const nameOf = (b) => b === "yge65" ? "65 and over" : b.slice(1).replace("_", " to ");
  const rows = bands.map((b) => { const s = S[`eap_dwap_sex_age_rt__sex_f__age_5yrbands_${b}`]; return { name: nameOf(b), v: atY(s, Ly), was: atY(s, F0), b }; });
  const peak = rows.reduce((a, r) => (r.v > a.v ? r : a));
  hbars("women-age", rows, { xMax: 60, xTicks: [0, 10, 20, 30, 40, 50, 60], xFmt: (v) => v + (v === 60 ? "%" : ""), label: "women in the labour force, per cent", valueFmt: p1, hl: (d) => d === peak,
    title: "Women's labour force participation by age", desc: rows.map((r) => `${r.name}: ${p1(r.v)} in ${Ly}, ${p1(r.was)} in ${F0}`).join("; "),
    csv: "age_band,lfpr_" + F0 + ",lfpr_" + Ly + "\n" + rows.map((r) => `${r.name},${r.was},${r.v}`).join("\n") });
  setHTML("pv-women-age", `${p1(peak.v)}`);
  setHTML("ex-wa-peak", `${peak.name}, ${p1(peak.v)}`);
  setHTML("ex-wa-young", p1(rows[1].v));
  setHTML("ex-wa-young0", p1(rows[1].was));

  const EDU = [["ltb", "Less than basic"], ["bas", "Basic (primary, lower secondary)"], ["int", "Intermediate (upper secondary)"], ["adv", "Advanced (graduate and above)"]];
  const erows = EDU.map(([c, name]) => ({ name, v: atY(S[`eap_dwap_sex_edu_rt__sex_f__edu_aggregate_${c}`], Ly), was: atY(S[`eap_dwap_sex_edu_rt__sex_f__edu_aggregate_${c}`], F0), c }));
  hbars("women-edu", erows, { xMax: 50, xTicks: [0, 10, 20, 30, 40, 50], xFmt: (v) => v + (v === 50 ? "%" : ""), label: "women in the labour force, per cent", valueFmt: p1, hl: (d) => d.c === "int", ml: 280,
    title: "Women's labour force participation by schooling", desc: erows.map((r) => `${r.name}: ${p1(r.v)}`).join("; "),
    csv: "education,lfpr_" + F0 + ",lfpr_" + Ly + "\n" + erows.map((r) => `"${r.name}",${r.was},${r.v}`).join("\n") });
  setHTML("pv-women-edu", p1(erows[2].v));
  setHTML("ex-we-low", p1(erows[0].v));
  setHTML("ex-we-mid", p1(erows[2].v));
  setHTML("ex-we-high", p1(erows[3].v));

  const rur = S.eap_dwap_sex_geo_rt__sex_f__geo_cov_rur, urb = S.eap_dwap_sex_geo_rt__sex_f__geo_cov_urb;
  const mr = S.eap_dwap_sex_geo_rt__sex_m__geo_cov_rur, mu = S.eap_dwap_sex_geo_rt__sex_m__geo_cov_urb;
  timeChart("women-area", {
    series: [
      { s: mr, label: "Rural men", color: G2, width: 1.5, end: `Rural men ${p1(lastP(mr).value)}` },
      { s: mu, label: "Urban men", color: G3, width: 1.5, end: `Urban men ${p1(lastP(mu).value)}` },
      { s: urb, label: "Urban women", color: G1, width: 1.75, end: `Urban women ${p1(lastP(urb).value)}` },
      { s: rur, label: "Rural women", color: ACC, width: 2.25, bold: true, end: `Rural women ${p1(lastP(rur).value)}` },
    ],
    from: F0, to: Ly, step: 1, yDomain: [0, 100], yTicks: [0, 20, 40, 60, 80, 100], yFmt: (v) => v + (v === 100 ? "%" : ""), yLabel: "labour force participation, aged 15+, per cent", height: 400,
    title: "Labour force participation, rural and urban, women and men", fname: "women-rural-urban",
    desc: `Rural women ${p1(firstP(rur).value)} in ${F0}, ${p1(lastP(rur).value)} in ${Ly}; urban women ${p1(lastP(urb).value)}.`,
  });
  setHTML("pv-women-area", p1(lastP(rur).value));
  setHTML("ex-wr-rur0", p1(firstP(rur).value));
  setHTML("ex-wr-rur", p1(lastP(rur).value));
  setHTML("ex-wr-urb0", p1(firstP(urb).value));
  setHTML("ex-wr-urb", p1(lastP(urb).value));
}

/* ======================================================================
   § 06 NEET
   ====================================================================== */
if (N) {
  const sN = B.sneet?.S, nN = B.nneet?.S;
  timeChart("neet", {
    series: [
      { s: N.eip_2eet_sex_rt__sex_m, label: "Young men, model", color: G1, width: 1.5, end: `Young men ${p1(lastP(N.eip_2eet_sex_rt__sex_m).value)}` },
      { s: N.eip_2eet_sex_rt__sex_t, label: "All youth, model", color: G2, width: 1.5, end: `All youth ${p1(lastP(N.eip_2eet_sex_rt__sex_t).value)}` },
      { s: N.eip_2eet_sex_rt__sex_f, label: "Young women, model", color: ACC, width: 2.25, bold: true, end: `Young women ${p1(lastP(N.eip_2eet_sex_rt__sex_f).value)}` },
      ...(sN ? [{ s: sN.sdg_0861_sex_rt__sex_f, label: "Young women, PLFS (ILO processing)", color: ACC, dots: true, hollow: true, end: null }] : []),
      ...(nN ? [{ s: nN.sdg_0861_sex_rt__sex_f, label: "Young women, NSS (ILO processing)", color: G1, dots: true, hollow: true, end: null }] : []),
    ],
    from: 2005, to: 2025, step: 5, yDomain: [0, 70], yTicks: [0, 10, 20, 30, 40, 50, 60, 70], yFmt: (v) => v + (v === 70 ? "%" : ""), yLabel: "share of people aged 15-24 not in employment, education or training, per cent",
    title: "Young people not in employment, education or training", fname: "neet",
    desc: `Young women ${p1(firstP(N.eip_2eet_sex_rt__sex_f).value)} in ${yr(firstP(N.eip_2eet_sex_rt__sex_f).date)}, ${p1(lastP(N.eip_2eet_sex_rt__sex_f).value)} in ${yr(lastP(N.eip_2eet_sex_rt__sex_f).date)}.`,
  });
  setHTML("pv-neet", p1(lastP(N.eip_2eet_sex_rt__sex_f).value));
  setHTML("ex-n-f0", p1(firstP(N.eip_2eet_sex_rt__sex_f).value));
  setHTML("ex-n-f", p1(lastP(N.eip_2eet_sex_rt__sex_f).value));
  setHTML("ex-n-m", p1(lastP(N.eip_2eet_sex_rt__sex_m).value));
  setHTML("ex-n-num", mn(lastP(N.eip_2eet_sex_nb__sex_t).value) + " million");
  if (sN) setHTML("ex-n-plfs", p1(lastP(sN.sdg_0861_sex_rt__sex_f).value));
}

/* ======================================================================
   § 07-08 status in employment, sector
   ====================================================================== */
function shareLines(id, parts, totalKey, { title, fname, yMax = 80, endFmt = p1 }) {
  const tot = M[totalKey];
  const sh = parts.map(([k, label, color, bold]) => ({
    s: { label, data: M[k].data.map((d, i) => ({ date: d.date, value: d.value != null && tot.data[i].value ? (100 * d.value) / tot.data[i].value : null })) },
    label, color, width: bold ? 2.25 : 1.6, bold, end: null,
  }));
  for (const x of sh) x.end = `${x.label} ${endFmt(lastP(x.s).value)}`;
  const ly = yr(lastP(tot).date);
  timeChart(id, { series: sh, from: 1991, to: ly, yDomain: [0, yMax], yTicks: Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10), yFmt: (v) => v + (v === yMax ? "%" : ""), yLabel: "share of everyone employed, per cent", height: 420,
    title, fname, desc: sh.map((x) => `${x.label} ${p1(firstP(x.s).value)} in 1991, ${p1(lastP(x.s).value)} in ${ly}`).join("; ") });
  return sh;
}
if (M) {
  const st = shareLines("status", [
    ["emp_2emp_sex_ste_nb__sex_t__ste_icse93_3", "Own-account", G1],
    ["emp_2emp_sex_ste_nb__sex_t__ste_icse93_1", "Employees", ACC, true],
    ["emp_2emp_sex_ste_nb__sex_t__ste_icse93_5", "Family workers", G2],
    ["emp_2emp_sex_ste_nb__sex_t__ste_icse93_2", "Employers", G3],
  ], "emp_2emp_sex_ste_nb__sex_t__ste_icse93_total", { title: "Employment by status in employment, ILO modelled estimates", fname: "status" });
  setHTML("pv-status", p1(lastP(st[1].s).value));
  setHTML("ex-s-emp0", p1(firstP(st[1].s).value));
  setHTML("ex-s-emp", p1(lastP(st[1].s).value));
  setHTML("ex-s-own", p1(lastP(st[0].s).value));
  setHTML("ex-s-fam", p1(lastP(st[2].s).value));

  const ec = shareLines("sector", [
    ["emp_2emp_sex_eco_nb__sex_t__eco_sector_agr", "Agriculture", ACC, true],
    ["emp_2emp_sex_eco_nb__sex_t__eco_sector_ser", "Services", G1],
    ["emp_2emp_sex_eco_nb__sex_t__eco_sector_ind", "Industry", G2],
  ], "emp_2emp_sex_eco_nb__sex_t__eco_sector_total", { title: "Employment by broad sector, ILO modelled estimates", fname: "sector" });
  const agr = ec[0].s, low = nn(agr).reduce((a, d) => (d.value < a.value ? d : a));
  setHTML("pv-sector", p1(lastP(agr).value));
  setHTML("ex-e-agr0", p1(firstP(agr).value));
  setHTML("ex-e-low", `${p1(low.value)} in ${yr(low.date)}`);
  setHTML("ex-e-agr", p1(lastP(agr).value));
}

/* ======================================================================
   § 09 informality
   ====================================================================== */
if (B.inf) {
  const S = B.inf.S, L = B.inf.dates.length - 1, Ly = +B.inf.dates[L].slice(0, 4), F0 = +B.inf.dates[0].slice(0, 4);
  const rows = [["total", "All work"], ["agr", "Agriculture"], ["ind", "Industry"], ["ser", "Services"]].map(([c, name]) => ({ name, c, v: atY(S[`sdg_0831_sex_eco_rt__sex_t__eco_sector_${c}`], Ly), was: atY(S[`sdg_0831_sex_eco_rt__sex_t__eco_sector_${c}`], F0) }));
  hbars("informal", rows, { xMax: 100, xTicks: [0, 25, 50, 75, 100], xFmt: (v) => v + (v === 100 ? "%" : ""), label: "share of employment that is informal, per cent", valueFmt: p1, hl: (d) => d.c === "total",
    title: "Informal employment by sector", desc: rows.map((r) => `${r.name}: ${p1(r.v)} in ${Ly}, ${p1(r.was)} in ${F0}`).join("; "),
    csv: "sector,informal_share_" + F0 + ",informal_share_" + Ly + "\n" + rows.map((r) => `${r.name},${r.was},${r.v}`).join("\n") });
  setHTML("pv-informal", p1(rows[0].v));
  setHTML("ex-i-tot", p1(rows[0].v));
  setHTML("ex-i-tot0", p1(rows[0].was));
  setHTML("ex-i-ser", p1(rows[3].v));
  setHTML("ex-i-agr", p1(rows[1].v));
}

/* ======================================================================
   § 10 working poverty
   ====================================================================== */
if (M) {
  const ck = (c) => `emp_2emp_sex_age_cla_nb__sex_t__age_ythadult_yge15__cla_ecocla_${c}`;
  const toM = (s) => ({ ...s, data: s.data.map((d) => ({ date: d.date, value: d.value == null ? null : d.value / 1000 })) });
  const ex = toM(M[ck("cat1")]), mod = toM(M[ck("cat2")]), up = toM(M[ck("cat34")]);
  const ly = yr(lastP(ex).date);
  timeChart("poverty", {
    series: [
      { s: up, label: "$4.20 a day or more", color: G1, width: 1.6, end: `$4.20 or more ${lastP(up).value.toFixed(0)} mn` },
      { s: mod, label: "$3 to $4.20 a day", color: G2, width: 1.6, end: `$3 to $4.20 ${lastP(mod).value.toFixed(0)} mn` },
      { s: ex, label: "Under $3 a day", color: ACC, width: 2.25, bold: true, end: `Under $3 ${lastP(ex).value.toFixed(0)} mn` },
    ],
    from: 1991, to: ly, yDomain: [0, 500], yTicks: [0, 100, 200, 300, 400, 500], yFmt: (v) => String(v), yLabel: "employed people, millions, by their household's daily income per person (2021 PPP dollars)", tipFmt: (v) => (v == null ? "—" : v.toFixed(1) + " mn"),
    title: "Workers by economic class, ILO modelled estimates", fname: "working-poverty",
    desc: `Workers in households under $3 a day: ${firstP(ex).value.toFixed(0)} million in 1991, ${lastP(ex).value.toFixed(0)} million in ${ly}.`,
  });
  const tot = M[ck("total")];
  setHTML("pv-poverty", lastP(ex).value.toFixed(1) + " mn");
  setHTML("ex-p-ex0", `${firstP(ex).value.toFixed(0)} million`);
  setHTML("ex-p-ex0s", p1((100 * firstP(M[ck("cat1")]).value) / firstP(tot).value));
  setHTML("ex-p-ex", `${lastP(ex).value.toFixed(0)} million`);
  setHTML("ex-p-exs", p1((100 * lastP(M[ck("cat1")]).value) / lastP(tot).value));
  setHTML("ex-p-mod", `${lastP(mod).value.toFixed(0)} million`);
}

/* ======================================================================
   § 11 labour's share of income
   ====================================================================== */
if (B.lshare) {
  const s = B.lshare.S.lap_2gdp_noc_rt, ly = yr(lastP(s).date), fy = yr(firstP(s).date);
  timeChart("lshare", {
    series: [{ s, label: "Labour income share of GDP", color: ACC, width: 2.25, bold: true, end: `${p1(lastP(s).value)}` }],
    from: fy, to: ly, step: 5, yDomain: [40, 70], yTicks: [40, 50, 60, 70], yFmt: (v) => v + (v === 70 ? "%" : ""), yLabel: "share of GDP paid to labour, per cent", height: 380, mr: 120,
    title: "Labour income share of GDP, ILO modelled estimates", fname: "labour-share",
    desc: `${p1(firstP(s).value)} in ${fy}, ${p1(lastP(s).value)} in ${ly}.`,
  });
  setHTML("pv-lshare", p1(lastP(s).value));
  setHTML("ex-ls-0", p1(firstP(s).value));
  setHTML("ex-ls", p1(lastP(s).value));
}
if (B.ldist) {
  const S = B.ldist.S, L = B.ldist.dates.length - 1, Ly = +B.ldist.dates[L].slice(0, 4), F0 = +B.ldist.dates[0].slice(0, 4);
  const rows = Array.from({ length: 10 }, (_, i) => {
    const s = S[`lap_2lid_qtl_rt__dcl_decile_${String(i + 1).padStart(2, "0")}`];
    return { name: i === 0 ? "Poorest tenth of workers" : i === 9 ? "Richest tenth of workers" : `Tenth ${i + 1}`, v: atY(s, Ly), was: atY(s, F0), i };
  });
  hbars("deciles", rows, { xMax: 70, xTicks: [0, 10, 20, 30, 40, 50, 60, 70], xFmt: (v) => v + (v === 70 ? "%" : ""), label: "share of all labour income, per cent", valueFmt: p1, hl: (d) => d.i === 9,
    title: "How labour income is split among workers", desc: rows.map((r) => `${r.name}: ${p1(r.v)}`).join("; "),
    csv: "tenth_of_workers,share_" + F0 + ",share_" + Ly + "\n" + rows.map((r) => `${r.i + 1},${r.was},${r.v}`).join("\n") });
  const bottom5 = rows.slice(0, 5).reduce((a, r) => a + r.v, 0);
  setHTML("pv-deciles", p1(rows[9].v));
  setHTML("ex-d-top", p1(rows[9].v));
  setHTML("ex-d-top0", p1(rows[9].was));
  setHTML("ex-d-bottom", p1(bottom5));
}

/* ======================================================================
   § 12 hours, § 13 earnings
   ====================================================================== */
if (B.hours) {
  const S = B.hours.S, ly = yr(lastP(S.how_2emp_sex_nb__sex_t).date), fy = yr(firstP(S.how_2emp_sex_nb__sex_t).date);
  timeChart("hours", {
    series: [
      { s: S.how_2emp_sex_nb__sex_m, label: "Men", color: G1, width: 1.6, end: `Men ${lastP(S.how_2emp_sex_nb__sex_m).value.toFixed(1)} h` },
      { s: S.how_2emp_sex_nb__sex_t, label: "Everyone", color: G2, width: 1.6, end: `All ${lastP(S.how_2emp_sex_nb__sex_t).value.toFixed(1)} h` },
      { s: S.how_2emp_sex_nb__sex_f, label: "Women", color: ACC, width: 2.25, bold: true, end: `Women ${lastP(S.how_2emp_sex_nb__sex_f).value.toFixed(1)} h` },
    ],
    from: fy, to: ly, step: 5, yDomain: [30, 60], yTicks: [30, 40, 50, 60], yFmt: (v) => v + (v === 60 ? " h" : ""), yLabel: "hours actually worked in a week, per employed person", height: 380, tipFmt: (v) => (v == null ? "—" : v.toFixed(1) + " h"),
    title: "Average weekly hours worked, ILO modelled estimates", fname: "hours",
    desc: `Women ${lastP(S.how_2emp_sex_nb__sex_f).value.toFixed(1)} hours, men ${lastP(S.how_2emp_sex_nb__sex_m).value.toFixed(1)} hours a week in ${ly}.`,
  });
  setHTML("pv-hours", lastP(S.how_2emp_sex_nb__sex_t).value.toFixed(1) + " h");
  setHTML("ex-h-f", lastP(S.how_2emp_sex_nb__sex_f).value.toFixed(1));
  setHTML("ex-h-m", lastP(S.how_2emp_sex_nb__sex_m).value.toFixed(1));
  setHTML("ex-h-f0", atY(S.how_2emp_sex_nb__sex_f, 2019).toFixed(1));
}
if (B.earn) {
  const S = B.earn.S, k = (sex) => `ear_emta_sex_age_nb__sex_${sex}__age_ythadult_yge15`;
  const ly = yr(lastP(S[k("t")]).date), fy = yr(firstP(S[k("t")]).date);
  const rs = (v) => "₹" + fmt.inr(v);
  timeChart("earn", {
    series: [
      { s: S[k("m")], label: "Men", color: G1, width: 1.6, end: `Men ${rs(lastP(S[k("m")]).value)}` },
      { s: S[k("t")], label: "All employees", color: G2, width: 1.6, end: `All ${rs(lastP(S[k("t")]).value)}` },
      { s: S[k("f")], label: "Women", color: ACC, width: 2.25, bold: true, end: `Women ${rs(lastP(S[k("f")]).value)}` },
    ],
    from: fy, to: ly, step: 1, ml: 70, yDomain: [0, 30000], yTicks: [0, 5000, 10000, 15000, 20000, 25000, 30000], yFmt: (v) => "₹" + fmt.inr(v), yLabel: "average monthly earnings of employees, rupees, current prices", height: 400, tipFmt: (v) => (v == null ? "—" : rs(v)),
    title: "Average monthly earnings of employees, PLFS as processed by the ILO", fname: "earnings",
    desc: `All employees ${rs(firstP(S[k("t")]).value)} in ${fy}, ${rs(lastP(S[k("t")]).value)} in ${ly}; women ${rs(lastP(S[k("f")]).value)}, men ${rs(lastP(S[k("m")]).value)}.`,
  });
  setHTML("pv-earn", rs(lastP(S[k("t")]).value));
  setHTML("ex-er-t", rs(lastP(S[k("t")]).value));
  setHTML("ex-er-t0", rs(firstP(S[k("t")]).value));
  setHTML("ex-er-ratio", p1((100 * lastP(S[k("f")]).value) / lastP(S[k("m")]).value));
  if (B.gap) setHTML("ex-er-gap", p1(lastP(B.gap.S.ear_ggap_ocu_rt__ocu_skill_total).value));
}

/* ======================================================================
   § 14 peers
   ====================================================================== */
const PEERS = [["chn", "China"], ["bgd", "Bangladesh"], ["idn", "Indonesia"], ["vnm", "Vietnam"]];
if (E && PEERS.every(([g]) => B["peer_" + g])) {
  const panels = [
    ["Women's participation", (b) => b.S["eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15"], [0, 80]],
    ["Youth unemployment", (b) => b.S["une_2eap_sex_age_rt__sex_t__age_ythadult_y15_24"], [0, 30]],
    ["Youth not in work or study", (b) => b.S["eip_2eet_sex_rt__sex_t"], [0, 40]],
    ["Own-account and family workers", (b) => { const t = b.S["emp_2emp_sex_ste_nb__sex_t__ste_icse93_total"], a = b.S["emp_2emp_sex_ste_nb__sex_t__ste_icse93_3"], c = b.S["emp_2emp_sex_ste_nb__sex_t__ste_icse93_5"];
      return { data: t.data.map((d, i) => ({ date: d.date, value: d.value && a.data[i].value != null && c.data[i].value != null ? (100 * (a.data[i].value + c.data[i].value)) / d.value : null })) }; }, [0, 100]],
  ];
  const india = { S: { ...B.lfpr.S, ...B.ur.S, ...B.neet.S, ...B.emp.S } };
  const rows = [];
  for (const [p, get] of panels) {
    for (const [g, name] of [...PEERS, ["ind", "India"]]) {
      const s = get(g === "ind" ? india : B["peer_" + g]);
      for (const d of s.data) if (d.value != null && yr(d.date) >= 1991) rows.push({ panel: p, country: name, date: d.date, value: d.value });
    }
  }
  const order = panels.map((p) => p[0]);
  const ends = order.flatMap((p) => {
    const L = [...PEERS.map((x) => x[1]), "India"].map((c) => rows.filter((r) => r.panel === p && r.country === c).at(-1)).filter(Boolean);
    return dodge(L.map((r) => ({ ...r, v: r.value, y: r.value * 2.6 })), 15).map((r) => ({ ...r, ly: r.y / 2.6 }));
  });
  const host = document.getElementById("plot-peers");
  if (host) {
    const plot = Plot.plot({
      width: W, height: 330, marginLeft: 40, marginRight: 96, marginTop: 34, marginBottom: 34, style,
      fx: { domain: order, label: null, padding: 0.28, tickSize: 0 },
      x: { type: "utc", domain: [Y(1991), Y(2024)], ticks: [Y(1991), Y(2024)], tickFormat: (d) => String(yr(d)), tickSize: 4, label: null },
      y: { domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickFormat: (v) => v + (v === 100 ? "%" : ""), tickSize: 0, tickPadding: 8, label: null },
      marks: [
        Plot.gridY([25, 50, 75, 100], { stroke: GRID }),
        Plot.ruleY([0], { stroke: BASE }),
        Plot.lineY(rows.filter((r) => r.country !== "India"), { fx: "panel", x: "date", y: "value", z: "country", stroke: G3, strokeWidth: 1.25, strokeLinejoin: "round" }),
        Plot.lineY(rows.filter((r) => r.country === "India"), { fx: "panel", x: "date", y: "value", stroke: ACC, strokeWidth: 2.25, strokeLinejoin: "round" }),
        Plot.text(ends, { fx: "panel", x: () => Y(2024), y: "ly", text: (d) => `${d.country} ${d.value.toFixed(0)}`, dx: 6, textAnchor: "start", fontSize: 11, fill: (d) => (d.country === "India" ? INK : MUTED), fontWeight: (d) => (d.country === "India" ? 600 : 400) }),
      ],
    });
    a11y(plot, "India and its peers on four ILO measures", ends.filter((e) => e.country === "India").map((e) => `${e.panel}: India ${e.value.toFixed(1)}%`).join("; "));
    host.append(plot);
    const series = [];
    for (const p of order) for (const c of ["India", ...PEERS.map((x) => x[1])]) series.push({ name: `${p}, ${c}`, label: `${p}, ${c}`, data: rows.filter((r) => r.panel === p && r.country === c) });
    wireTools(document.getElementById("cb-peers"), plot, series, "india-atlas_ilo-peers", (d) => String(yr(d)));
    const iw = ends.find((e) => e.country === "India" && e.panel === order[0]);
    setHTML("pv-peers", p1(iw.value));
    for (const [g, name] of PEERS) setHTML("ex-pw-" + g, p1(ends.find((e) => e.country === name && e.panel === order[0]).value));
    setHTML("ex-pw-ind", p1(iw.value));
  }
  // output per worker
  const opw = (b) => b.S["gdp_211p_noc_nb"];
  const ser = [...PEERS.map(([g, name]) => ({ s: opw(B["peer_" + g]), label: name, color: G3, width: 1.4, end: `${name} $${fmt.inr(lastP(opw(B["peer_" + g])).value)}` })),
    { s: B.opw.S.gdp_211p_noc_nb, label: "India", color: ACC, width: 2.25, bold: true, end: `India $${fmt.inr(lastP(B.opw.S.gdp_211p_noc_nb).value)}` }];
  const fy = yr(firstP(B.opw.S.gdp_211p_noc_nb).date), ly = yr(lastP(B.opw.S.gdp_211p_noc_nb).date);
  timeChart("output", {
    series: ser, from: fy, to: ly, step: 5, ml: 70, yDomain: [0, 50000], yTicks: [0, 10000, 20000, 30000, 40000, 50000], yFmt: (v) => "$" + fmt.inr(v), yLabel: "GDP per employed person, constant 2021 international dollars (PPP)", height: 400, mr: 190, tipFmt: (v) => (v == null ? "—" : "$" + fmt.inr(v)),
    title: "Output per worker, India and its peers, ILO modelled estimates", fname: "output-per-worker",
    desc: `India $${fmt.inr(lastP(B.opw.S.gdp_211p_noc_nb).value)} in ${ly}; China $${fmt.inr(lastP(opw(B.peer_chn)).value)}.`,
  });
  setHTML("pv-output", "$" + fmt.inr(lastP(B.opw.S.gdp_211p_noc_nb).value));
  setHTML("ex-o-ind0", "$" + fmt.inr(firstP(B.opw.S.gdp_211p_noc_nb).value));
  setHTML("ex-o-ind", "$" + fmt.inr(lastP(B.opw.S.gdp_211p_noc_nb).value));
  setHTML("ex-o-chn", "$" + fmt.inr(lastP(opw(B.peer_chn)).value));
  setHTML("ex-o-chn0", "$" + fmt.inr(firstP(opw(B.peer_chn)).value));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", B.lfpr?.meta.vintage ?? "");
setHTML("prov-vintage2", B.lfpr?.meta.vintage ?? "");
