// Guide: poverty and inequality. Plates and number wiring.
// Data: data/series/poverty-pip-*.json (World Bank PIP, 2021 PPP, baked by
// scripts/lib/products/pip.mjs) and poverty-wdi.json (WDI's copies plus the national-line
// and multidimensional measures PIP does not serve). One bundle per comparable spell of
// surveys: rounds from different spells are drawn as separate dots, never joined by a line.
// The lineup (World Bank model estimates for every year) is pale and labelled; its
// nowcasts after the last survey are dashed.

import * as Plot from "@observablehq/plot";
import p2022 from "../../data/series/poverty-pip-2022.json";
import p2011 from "../../data/series/poverty-pip-2011.json";
import p1993 from "../../data/series/poverty-pip-1993.json";
import p1987 from "../../data/series/poverty-pip-1987.json";
import p1983 from "../../data/series/poverty-pip-1983.json";
import p1977 from "../../data/series/poverty-pip-1977.json";
import lineupB from "../../data/series/poverty-pip-lineup.json";
import wdiB from "../../data/series/poverty-wdi.json";
import { MONO as sans, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob } from "../charts/plumbing.js";

/* ---------- shared ---------- */
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const ACC = "#2E4BD8", ACC_SOFT = "#B9C3F3", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const Y = (y) => new Date(Date.UTC(y, 0, 1));
const yearOf = (iso) => Number(iso.slice(0, 4));
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const pct1 = (v) => v.toFixed(1) + "%";
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
const yearFmt = (d) => String(d.getUTCFullYear());
const csvOf = (header, rows) => header.join(",") + "\n" + rows.map((r) => r.map((v) => (v == null ? "" : typeof v === "string" && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",")).join("\n");
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

// every survey, with its spell; rounds are labelled the way Indians name them ("2023-24")
const SPELLS = [p1977, p1983, p1987, p1993, p2011, p2022];
const SURVEYS = SPELLS.flatMap((b) => b.dates.map((d, i) => ({ b, i, year: yearOf(d), date: Y(yearOf(d)), spell: b.meta.spell, survey: b.meta.surveys[i], round: b.meta.surveys[i].period?.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1-$2") ?? String(yearOf(d)) })));
const v = (s, k) => s.b.series[k].data[s.i];
// a survey year's tick reads as its round ("2023-24"); other years as the year
const roundTick = (d) => String(SURVEYS.find((x) => x.year === d.getUTCFullYear())?.round ?? d.getUTCFullYear());
const CUR = p2022, L = CUR.dates.length - 1;
const cur = (k, i = L) => CUR.series[k].data[i];
const roundOf = (b, i) => b.meta.surveys[i].period.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1-$2");
const LINES = [["3_00", "$3.00", ACC], ["4_20", "$4.20", GOLD], ["8_30", "$8.30", G1]];
// a 2021-PPP dollar a day in rupees at the survey's own prices: line x PPP factor x CPI (PIP's own factors)
const rupeesPerDay = (line, b, i) => line * b.series.ppp.data[i] * b.series.cpi.data[i];

/* ---------- headline ---------- */
const h3 = cur("headcount_3_00"), h3p = cur("headcount_3_00", L - 1), h42 = cur("headcount_4_20"), h83 = cur("headcount_8_30");
setHTML("m-latest", `HCES ${roundOf(CUR, L)}`);
setHTML("u-reading", `World Bank PIP, HCES ${roundOf(CUR, L)}, 2021 PPP`);
setHTML("n-h3", f1(h3) + pc("%"));
setHTML("d-h3", `<b>${pct1(h3p)}</b> in ${roundOf(CUR, L - 1)}`);
setHTML("n-h42", f1(h42) + pc("%"));
setHTML("d-h42", `<b>${pct1(cur("headcount_4_20", L - 1))}</b> in ${roundOf(CUR, L - 1)}`);
setHTML("n-poor", f1(cur("poor_3_00")) + pc(" million"));
setHTML("d-poor", `below $3.00 a day, <b>${f1(cur("poor_4_20"))} million</b> below $4.20`);
setHTML("n-gini", f1(cur("gini")));
setHTML("d-gini", `<b>${f1(cur("gini", L - 1))}</b> in ${roundOf(CUR, L - 1)}`);
spark("nspark-h3", { data: lineupB.dates.map((d, i) => ({ date: new Date(d + "T00:00:00Z"), value: lineupB.series.headcount_3_00.data[i] })).filter((p) => p.value != null), color: ACC });

/* ---------- § 01 ---------- */
setHTML("rb-h3", f2(h3) + pc("%"));
setHTML("rb-h42", f2(h42) + pc("%"));
setHTML("cr-line3", inr(rupeesPerDay(3, CUR, L)));
setHTML("cr-round", roundOf(CUR, L));

/* ---------- § 02 the line decides ---------- */
{
  const ladder = (b, i) => Object.keys(b.series).filter((k) => /^headcount_\d+_\d\d$/.test(k)).map((k) => ({ line: Number(k.slice(10).replace("_", ".")), share: b.series[k].data[i] })).sort((a, c) => a.line - c.line);
  const now = ladder(CUR, L), prev = ladder(CUR, L - 1), old = ladder(p2011, 0);
  const lastLine = now.at(-1).line;
  const plot = Plot.plot({
    width: W, height: 480, marginLeft: 52, marginRight: 40, marginTop: 44, marginBottom: 40, style: baseStyle,
    x: { type: "log", domain: [1, lastLine], ticks: [1, 2, 3, 4.2, 6, 8.3, 12, 20, 30, 40].filter((t) => t <= lastLine), tickFormat: (t) => "$" + (Number.isInteger(t) ? t : t.toFixed(2)), tickSize: 0, tickPadding: 10, label: "poverty line, 2021 PPP dollars a day per person (log scale)", labelAnchor: "center", labelArrow: false },
    y: { domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickFormat: (x) => x + (x === 100 ? "%" : ""), tickSize: 0, tickPadding: 10, label: "share of people below the line, per cent", labelAnchor: "top", labelArrow: false },
    marks: [
      Plot.gridY([20, 40, 60, 80, 100], { stroke: GRID }),
      Plot.ruleX([3, 4.2, 8.3], { stroke: "#B5BAC4", strokeDasharray: "3 3" }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(old, { x: "line", y: "share", stroke: G3, strokeWidth: 1.5, strokeDasharray: "2 3" }),
      Plot.lineY(prev, { x: "line", y: "share", stroke: ACC_SOFT, strokeWidth: 1.75 }),
      Plot.lineY(now, { x: "line", y: "share", stroke: ACC, strokeWidth: 2.25 }),
      Plot.dot(now.filter((p) => [3, 4.2, 8.3].includes(p.line)), { x: "line", y: "share", fill: ACC, r: 4, stroke: "#fff", strokeWidth: 1.5 }),
      // each line's name and share sit in the top margin, beside its rule (left of $3.00, right of the others)
      Plot.text([3], { x: (d) => d, y: () => 100, text: () => `${pct1(h3)} below $3.00`, dx: -6, dy: -16, textAnchor: "end", fill: INK, fontSize: 12.5, fontWeight: 600 }),
      Plot.text([4.2, 8.3], { x: (d) => d, y: () => 100, text: (d) => `${pct1(d === 4.2 ? h42 : h83)} below $${d.toFixed(2)}`, dx: 6, dy: -16, textAnchor: "start", fill: INK, fontSize: 12.5 }),
    ],
  });
  a11y(plot, "Share of Indians below each poverty line", `In ${roundOf(CUR, L)}, ${pct1(h3)} lived below $3.00 a day, ${pct1(h42)} below $4.20 and ${pct1(h83)} below $8.30 (2021 PPP).`);
  document.getElementById("plot-ladder").append(plot);
  setHTML("lg-lad-now", roundOf(CUR, L));
  setHTML("lg-lad-prev", roundOf(CUR, L - 1));
  setHTML("lg-lad-old", `${roundOf(p2011, 0)}, a different survey design`);
  setHTML("pv-ladder", `${f1(h3)} to ${f1(h83)}%`);
  // what each line is in rupees at the latest survey's prices
  const r = (line) => rupeesPerDay(line, CUR, L);
  setHTML("ex-la-3", pct1(h3));
  setHTML("ex-la-42", pct1(h42));
  setHTML("ex-la-83", pct1(h83));
  setHTML("ex-la-r3", inr(r(3)));
  setHTML("ex-la-r3m", inr(r(3) * 30));
  setHTML("ex-la-r3f", inr(r(3) * 30 * 5));
  setHTML("ex-la-r42", inr(r(4.2)));
  setHTML("ex-la-r42m", inr(r(4.2) * 30));
  setHTML("ex-la-r83", inr(r(8.3)));
  setHTML("ex-la-r83m", inr(r(8.3) * 30));
  setHTML("ex-la-ppp", f2(cur("ppp")));
  setHTML("ex-la-round", roundOf(CUR, L));
  const median = cur("median");
  setHTML("ex-la-med", "$" + f2(median));
  setHTML("ex-la-medr", inr(median * cur("ppp") * cur("cpi")));
  wirePlate("cb-ladder", plot, "india-atlas_share-below-each-poverty-line", csvOf(["line_2021ppp_usd_day", `share_below_${roundOf(CUR, L)}`, `share_below_${roundOf(CUR, L - 1)}`, `share_below_${roundOf(p2011, 0)}_different_design`, `line_in_rupees_a_day_${roundOf(CUR, L)}_prices`],
    now.map((p, i) => [p.line, p.share, prev[i]?.share, old.find((o) => o.line === p.line)?.share, Math.round(r(p.line) * 100) / 100])));
}

/* ---------- § 03 the survey record ---------- */
{
  const lu = lineupB.dates.map((d, i) => ({ date: new Date(d + "T00:00:00Z"), year: yearOf(d), v: lineupB.series.headcount_3_00.data[i], n: lineupB.series.headcount_3_00_nowcast?.data[i] ?? null }));
  const lineupIn = lu.filter((p) => p.v != null), lineupNow = [lineupIn.at(-1), ...lu.filter((p) => p.n != null).map((p) => ({ ...p, v: p.n }))];
  const pts = [];
  for (const s of SURVEYS) for (const [k, lab, col] of LINES) pts.push({ date: s.date, year: s.year, spell: s.spell, line: lab, col, value: v(s, "headcount_" + k), round: s.round });
  const lastSurvey = SURVEYS.at(-1), s11 = SURVEYS.find((s) => s.year === 2011);
  const marks = [
    Plot.gridY([20, 40, 60, 80, 100], { stroke: GRID }),
    // the eleven years with no survey
    Plot.rectY([{ x1: Y(s11.year + 1), x2: Y(SURVEYS.find((s) => s.year > 2011).year), y1: 0, y2: 100 }], { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "#F6F7F9" }),
    Plot.text([{ x: Y(Math.round((s11.year + 1 + SURVEYS.find((s) => s.year > 2011).year) / 2)), y: 100 }], { x: "x", y: "y", text: () => "No survey", dy: 4, fill: MUTED, fontSize: 11.5 }),
    Plot.ruleY([0], { stroke: BASE }),
    Plot.lineY(lineupIn, { x: "date", y: "v", stroke: ACC_SOFT, strokeWidth: 1.5 }),
    Plot.lineY(lineupNow, { x: "date", y: "v", stroke: ACC_SOFT, strokeWidth: 1.5, strokeDasharray: "4 3" }),
  ];
  // join dots only within a comparable spell
  for (const b of SPELLS) for (const [k, lab, col] of LINES) {
    const d = b.dates.map((dd, i) => ({ date: Y(yearOf(dd)), value: b.series["headcount_" + k].data[i] }));
    if (d.length > 1) marks.push(Plot.lineY(d, { x: "date", y: "value", stroke: col, strokeWidth: 2 }));
  }
  marks.push(Plot.dot(pts, { x: "date", y: "value", fill: (d) => d.col, r: 4, stroke: "#fff", strokeWidth: 1.5 }));
  for (const [k, lab, col] of LINES) {
    const e = pts.filter((p) => p.line === lab).at(-1);
    marks.push(Plot.text([e], { x: "date", y: "value", text: () => `${lab}: ${pct1(e.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: lab === "$3.00" ? 600 : 400 }));
  }
  marks.push(Plot.text([{ x: Y(1995), y: lineupIn.find((p) => p.year === 1995).v }], { x: "x", y: "y", text: () => "World Bank estimates between surveys", dy: 22, fill: MUTED, fontSize: 11.5 }));
  const plot = Plot.plot({
    width: W, height: 500, marginLeft: 52, marginRight: 150, marginTop: 34, marginBottom: 34, style: baseStyle,
    x: { type: "utc", domain: [Y(1975), Y(yearOf(lineupB.dates.at(-1)))], ticks: [1977, 1983, 1987, 1993, 2004, 2009, 2011, 2022].map(Y), tickFormat: yearFmt, tickSize: 0, tickPadding: 12, label: null },
    y: { domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickFormat: (x) => x + (x === 100 ? "%" : ""), tickSize: 0, tickPadding: 10, label: "share of people below the line, per cent", labelAnchor: "top", labelArrow: false },
    marks,
  });
  a11y(plot, "Share of Indians below the three international lines, every survey since 1977-78", `Below $3.00 a day: ${pct1(v(SURVEYS[0], "headcount_3_00"))} in ${SURVEYS[0].round}, ${pct1(v(s11, "headcount_3_00"))} in ${s11.round}, ${pct1(v(lastSurvey, "headcount_3_00"))} in ${lastSurvey.round}. Dots are surveys; lines join only surveys PIP treats as comparable.`);
  document.getElementById("plot-record").append(plot);
  setHTML("pv-record", String(SURVEYS.length));
  setHTML("ex-re-77", pct1(v(SURVEYS[0], "headcount_3_00")));
  setHTML("ex-re-77r", SURVEYS[0].round);
  setHTML("ex-re-11", pct1(v(s11, "headcount_3_00")));
  setHTML("ex-re-11r", s11.round);
  setHTML("ex-re-22", pct1(v(SURVEYS.at(-2), "headcount_3_00")));
  setHTML("ex-re-22r", SURVEYS.at(-2).round);
  setHTML("ex-re-23", pct1(v(lastSurvey, "headcount_3_00")));
  setHTML("ex-re-23r", lastSurvey.round);
  setHTML("ex-re-n", String(SURVEYS.length));
  setHTML("ex-re-spells", String(SPELLS.length));
  wirePlate("cb-record", plot, "india-atlas_poverty-every-survey", csvOf(["reporting_year", "survey_round", "survey", "comparable_spell", "below_3_00_pct", "below_4_20_pct", "below_8_30_pct", "lineup_estimate_below_3_00_pct"],
    lu.map((p) => { const s = SURVEYS.find((x) => x.year === p.year); return [p.year, s?.round ?? "", s?.survey.survey ?? "", s?.spell ?? "", s ? v(s, "headcount_3_00") : "", s ? v(s, "headcount_4_20") : "", s ? v(s, "headcount_8_30") : "", p.v ?? p.n]; })));
}

/* ---------- § 04 the gap years ---------- */
{
  const s11 = SURVEYS.find((s) => s.year === 2011), sNext = SURVEYS.find((s) => s.year > 2011);
  const lastS = lineupB.meta.lastSurveyYear;
  const rows = lineupB.dates.map((d, i) => ({ date: new Date(d + "T00:00:00Z"), year: yearOf(d), v: lineupB.series.headcount_3_00.data[i] ?? lineupB.series.headcount_3_00_nowcast?.data[i], poor: lineupB.series.poor_3_00.data[i], kind: lineupB.meta.estimationType[yearOf(d)] })).filter((p) => p.year >= 2005);
  const gap = rows.filter((p) => p.year > s11.year && p.year < sNext.year);
  const marks = [
    Plot.gridY([10, 20, 30, 40, 50], { stroke: GRID }),
    Plot.rectY([{ x1: Y(s11.year + 1), x2: Y(sNext.year), y1: 0, y2: 50 }], { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "#F6F7F9" }),
    Plot.ruleY([0], { stroke: BASE }),
    Plot.lineY(rows.filter((p) => p.year <= lastS), { x: "date", y: "v", stroke: ACC_SOFT, strokeWidth: 2 }),
    Plot.lineY(rows.filter((p) => p.year >= lastS), { x: "date", y: "v", stroke: ACC_SOFT, strokeWidth: 2, strokeDasharray: "4 3" }),
    Plot.dot(rows, { x: "date", y: "v", fill: "#fff", stroke: ACC_SOFT, strokeWidth: 1.5, r: 3 }),
    Plot.dot(SURVEYS.filter((s) => s.year >= 2004), { x: "date", y: (s) => v(s, "headcount_3_00"), fill: ACC, r: 5, stroke: "#fff", strokeWidth: 1.5 }),
    // survey labels: up-right while the record falls steeply, left of the last two (crowded) points
    Plot.text(SURVEYS.filter((s) => s.year === 2004), { x: "date", y: (s) => v(s, "headcount_3_00"), text: (s) => `Survey ${s.round}: ${pct1(v(s, "headcount_3_00"))}`, dx: 10, dy: -10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: 600 }),
    Plot.text(SURVEYS.filter((s) => s.year > 2004 && s.year <= 2011), { x: "date", y: (s) => v(s, "headcount_3_00"), text: (s) => `Survey ${s.round}: ${pct1(v(s, "headcount_3_00"))}`, dx: -10, dy: 2, textAnchor: "end", fill: INK, fontSize: 12, fontWeight: 600 }),
    Plot.text(SURVEYS.filter((s) => s.year > 2011).slice(0, 1), { x: "date", y: (s) => v(s, "headcount_3_00"), text: (s) => `Survey ${s.round}: ${pct1(v(s, "headcount_3_00"))}`, dx: -10, dy: -2, textAnchor: "end", fill: INK, fontSize: 12, fontWeight: 600 }),
    Plot.text(SURVEYS.filter((s) => s.year > 2011).slice(1), { x: "date", y: (s) => v(s, "headcount_3_00"), text: (s) => `Survey ${s.round}: ${pct1(v(s, "headcount_3_00"))}`, dx: -10, dy: 12, textAnchor: "end", fill: INK, fontSize: 12, fontWeight: 600 }),
    Plot.text([{ x: Y(Math.round((s11.year + sNext.year) / 2)), y: 50 }], { x: "x", y: "y", text: () => `${sNext.year - s11.year - 1} calendar years with no survey`, dy: 4, fill: MUTED, fontSize: 11.5 }),
    Plot.text([rows.at(-1)], { x: "date", y: "v", text: () => "Nowcast", dx: 10, textAnchor: "start", fill: MUTED, fontSize: 11.5 }),
  ];
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 52, marginRight: 180, marginTop: 34, marginBottom: 34, style: baseStyle,
    x: { type: "utc", domain: [Y(2003), Y(rows.at(-1).year)], ticks: [2005, 2010, 2015, 2020, 2025].map(Y), tickFormat: yearFmt, tickSize: 0, tickPadding: 12, label: null },
    y: { domain: [0, 50], ticks: [0, 10, 20, 30, 40, 50], tickFormat: (x) => x + (x === 50 ? "%" : ""), tickSize: 0, tickPadding: 10, label: "share below $3.00 a day, per cent", labelAnchor: "top", labelArrow: false },
    marks,
  });
  a11y(plot, "The World Bank's estimates for the years without a survey", `Between the ${s11.round} and ${sNext.round} surveys the World Bank estimates the share below $3.00 a day fell from ${pct1(gap[0].v)} in ${gap[0].year} to ${pct1(gap.at(-1).v)} in ${gap.at(-1).year}. These are model estimates, not survey readings.`);
  document.getElementById("plot-gap").append(plot);
  addCrosshair(document.getElementById("plot-gap"), plot, [{ data: rows.map((p) => ({ date: p.date, value: p.v })), label: "World Bank estimate", color: ACC_SOFT }], null, yearFmt, (x) => (x == null ? "—" : x.toFixed(2) + "%"));
  const covid = rows.find((p) => p.year === 2020), pre = rows.find((p) => p.year === 2019);
  setHTML("pv-gap", String(sNext.year - s11.year - 1) + " years");
  setHTML("ex-ga-n", String(sNext.year - s11.year - 1));
  setHTML("ex-ga-a", pct1(gap[0].v));
  setHTML("ex-ga-ay", String(gap[0].year));
  setHTML("ex-ga-b", pct1(gap.at(-1).v));
  setHTML("ex-ga-by", String(gap.at(-1).year));
  setHTML("ex-ga-19", pct1(pre.v));
  setHTML("ex-ga-20", pct1(covid.v));
  setHTML("ex-ga-now", pct1(rows.at(-1).v));
  setHTML("ex-ga-nowy", String(rows.at(-1).year));
  setHTML("ex-ga-poor", f1(rows.at(-1).poor) + " million");
  wirePlate("cb-gap", plot, "india-atlas_poverty-lineup-2005-onwards", csvOf(["year", "world_bank_estimate_below_3_00_pct", "people_below_3_00_millions", "estimation_type", "survey_reading_below_3_00_pct"],
    rows.map((p) => { const s = SURVEYS.find((x) => x.year === p.year); return [p.year, p.v, p.poor, p.kind, s ? v(s, "headcount_3_00") : ""]; })));
}

/* ---------- § 05 how many, how deep ---------- */
{
  const rows = SURVEYS.map((s) => ({ ...s, n3: v(s, "poor_3_00"), n42: v(s, "poor_4_20") }));
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 60, marginRight: 40, marginTop: 34, marginBottom: 40, style: baseStyle,
    x: { type: "band", domain: rows.map((r) => r.round), padding: 0.35, tickSize: 0, tickPadding: 10, label: null },
    y: { domain: [0, 900], ticks: [0, 150, 300, 450, 600, 750, 900], tickFormat: (x) => String(x), tickSize: 0, tickPadding: 10, label: "people, million", labelAnchor: "top", labelArrow: false },
    marks: [
      Plot.gridY([150, 300, 450, 600, 750, 900], { stroke: GRID }),
      Plot.barY(rows, { x: "round", y: "n42", fill: "#E7D2B0", insetLeft: 2, insetRight: 2 }),
      Plot.barY(rows, { x: "round", y: "n3", fill: ACC, insetLeft: 2, insetRight: 2 }),
      Plot.text(rows, { x: "round", y: "n3", text: (r) => Math.round(r.n3), dy: -8, fill: INK, fontSize: 12, fontWeight: 600 }),
      Plot.text(rows, { x: "round", y: "n42", text: (r) => Math.round(r.n42), dy: -8, fill: G1, fontSize: 11.5 }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "Number of Indians below $3.00 and $4.20 a day, every survey", rows.map((r) => `${r.round}: ${Math.round(r.n3)} million below $3.00, ${Math.round(r.n42)} million below $4.20`).join("; "));
  document.getElementById("plot-poor").append(plot);
  const last = rows.at(-1), pk = rows.reduce((a, r) => (r.n3 > a.n3 ? r : a));
  setHTML("pv-poor", f1(last.n3) + " mn");
  setHTML("ex-po-n", f1(last.n3) + " million");
  setHTML("ex-po-n42", f1(last.n42) + " million");
  setHTML("ex-po-pk", Math.round(pk.n3) + " million");
  setHTML("ex-po-pkr", pk.round);
  setHTML("ex-po-r", last.round);
  const gap3 = cur("poverty_gap_3_00"), r3 = rupeesPerDay(3, CUR, L);
  setHTML("ex-po-gap", pct1(gap3));
  // the poverty gap is the shortfall averaged over everyone (the non-poor count as zero);
  // divided by the headcount it is the average shortfall of a poor person
  setHTML("ex-po-short", pct1((100 * gap3) / h3));
  setHTML("ex-po-shortr", inr(((gap3 / h3) * r3)) + " a day");
  setHTML("ex-po-sev", f2(cur("poverty_severity_3_00")));
  setHTML("ex-po-gap42", pct1(cur("poverty_gap_4_20")));
  wirePlate("cb-poor", plot, "india-atlas_number-of-poor", csvOf(["reporting_year", "survey_round", "comparable_spell", "below_3_00_millions", "below_4_20_millions", "below_8_30_millions", "poverty_gap_3_00_pct", "poverty_gap_4_20_pct", "population"],
    rows.map((r) => [r.year, r.round, r.spell, r.n3, r.n42, v(r, "poor_8_30"), v(r, "poverty_gap_3_00"), v(r, "poverty_gap_4_20"), v(r, "reporting_pop")])));
}

/* ---------- § 06 inequality: the Gini by survey ---------- */
{
  const rows = SURVEYS.map((s) => ({ ...s, g: v(s, "gini") }));
  const marks = [Plot.gridY([20, 25, 30, 35], { stroke: GRID }), Plot.ruleY([15], { stroke: BASE })];
  for (const b of SPELLS) if (b.dates.length > 1) marks.push(Plot.lineY(b.dates.map((d, i) => ({ date: Y(yearOf(d)), g: b.series.gini.data[i] })), { x: "date", y: "g", stroke: ACC, strokeWidth: 2 }));
  marks.push(Plot.dot(rows, { x: "date", y: "g", fill: ACC, r: 4.5, stroke: "#fff", strokeWidth: 1.5 }));
  marks.push(Plot.text(rows, { x: "date", y: "g", text: (r) => f1(r.g), dy: -12, fill: INK, fontSize: 12, fontWeight: (r) => (r === rows.at(-1) ? 600 : 400) }));
  const plot = Plot.plot({
    width: W, height: 360, marginLeft: 52, marginRight: 40, marginTop: 34, marginBottom: 34, style: baseStyle,
    x: { type: "utc", domain: [Y(1975), Y(2025)], ticks: rows.map((r) => r.date), tickFormat: roundTick, tickSize: 0, tickPadding: 12, label: null },
    y: { domain: [15, 35], ticks: [15, 20, 25, 30, 35], tickFormat: (x) => String(x), tickSize: 0, tickPadding: 10, label: "Gini index of consumption (0 = equal, 100 = one person has all)", labelAnchor: "top", labelArrow: false },
    marks,
  });
  a11y(plot, "Gini index of consumption, every survey", rows.map((r) => `${r.round}: ${f1(r.g)}`).join(", "));
  document.getElementById("plot-gini").append(plot);
  setHTML("pv-gini", f1(rows.at(-1).g));
  setHTML("ex-gi-now", f1(rows.at(-1).g));
  setHTML("ex-gi-prev", f1(rows.at(-2).g));
  setHTML("ex-gi-11", f1(rows.find((r) => r.year === 2011).g));
  setHTML("ex-gi-mean", "$" + f2(cur("mean")));
  setHTML("ex-gi-med", "$" + f2(cur("median")));
  setHTML("ex-gi-meanr", inr(cur("survey_mean_lcu") * 30));
  setHTML("ex-gi-spl", "$" + f2(cur("spl")));
  setHTML("ex-gi-spr", pct1(cur("spr")));
  wirePlate("cb-gini", plot, "india-atlas_consumption-gini", csvOf(["reporting_year", "survey_round", "comparable_spell", "gini", "mean_2021ppp_usd_day", "median_2021ppp_usd_day", "mld", "polarisation"], rows.map((r) => [r.year, r.round, r.spell, r.g, v(r, "mean"), v(r, "median"), v(r, "mld"), v(r, "polarization")])));
}

/* ---------- § 06 deciles ---------- */
{
  const rows = Array.from({ length: 10 }, (_, k) => ({ d: k + 1, name: k === 0 ? "Poorest tenth" : k === 9 ? "Richest tenth" : `Tenth ${k + 1}`, now: cur("decile" + (k + 1)), prev: cur("decile" + (k + 1), L - 1) }));
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 38, marginLeft: 150, marginRight: 90, marginTop: 24, marginBottom: 34, style: baseStyle,
    x: { domain: [0, 25], ticks: [0, 5, 10, 15, 20, 25], tickFormat: (x) => x + (x === 25 ? "%" : ""), tickSize: 0, tickPadding: 8, label: "share of all consumption, per cent", labelAnchor: "right", labelArrow: false },
    y: { domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12, label: null },
    marks: [
      Plot.gridX([5, 10, 15, 20, 25], { stroke: GRID }),
      Plot.ruleX([10], { stroke: "#B5BAC4", strokeDasharray: "3 3" }),
      Plot.barX(rows, { y: "name", x: "now", fill: (r) => (r.d === 10 || r.d === 1 ? ACC : "#AAB8F2"), insetTop: 9, insetBottom: 9 }),
      Plot.dot(rows, { y: "name", x: "prev", r: 4, fill: "#fff", stroke: G1, strokeWidth: 1.5 }),
      Plot.text(rows, { y: "name", x: (r) => Math.max(r.now, r.prev), text: (r) => pct1(r.now), dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (r) => (r.d === 10 || r.d === 1 ? 600 : 400) }),
    ],
  });
  a11y(plot, "Share of consumption by tenth of the population", rows.map((r) => `${r.name} ${pct1(r.now)}`).join(", "));
  document.getElementById("plot-deciles").append(plot);
  const b40 = rows.slice(0, 4).reduce((s, r) => s + r.now, 0);
  setHTML("lg-dec-now", roundOf(CUR, L));
  setHTML("lg-dec-prev", roundOf(CUR, L - 1));
  setHTML("pv-deciles", (rows[9].now / rows[0].now).toFixed(1) + "×");
  setHTML("ex-dc-top", pct1(rows[9].now));
  setHTML("ex-dc-bot", pct1(rows[0].now));
  setHTML("ex-dc-x", (rows[9].now / rows[0].now).toFixed(1) + " times");
  setHTML("ex-dc-b40", pct1(b40));
  setHTML("ex-dc-top0", pct1(rows[9].prev));
  wirePlate("cb-deciles", plot, "india-atlas_consumption-by-decile", csvOf(["decile", `share_${roundOf(CUR, L)}_pct`, `share_${roundOf(CUR, L - 1)}_pct`], rows.map((r) => [r.name, r.now, r.prev])));
}

/* ---------- § 07 the numbers people quote ---------- */
{
  const w = (code) => { const s = Object.values(wdiB.series).find((x) => x.name === code); const i = s.data.findLastIndex((x) => x != null); return { v: s.data[i], year: yearOf(wdiB.dates[i]) }; };
  const round = (y) => { const s = SURVEYS.find((x) => x.year === y); return s ? s.round : String(y); };
  const nat = w("SI.POV.NAHC"), mpwb = w("SI.POV.MPWB"), mpun = w("SI.POV.MPUN");
  const rows = [
    { name: `$3.00 a day, World Bank, ${round(SURVEYS.at(-1).year)}`, v: h3, k: "acc" },
    { name: `$4.20 a day, World Bank, ${round(SURVEYS.at(-1).year)}`, v: h42 },
    { name: `$8.30 a day, World Bank, ${round(SURVEYS.at(-1).year)}`, v: h83 },
    { name: `Societal poverty line, World Bank, ${round(SURVEYS.at(-1).year)}`, v: cur("spr") },
    { name: `$3.00 a day, World Bank, ${round(2011)}`, v: v(SURVEYS.find((s) => s.year === 2011), "headcount_3_00"), old: true },
    { name: `National line (Tendulkar), ${round(nat.year)}`, v: nat.v, old: true },
    { name: `Multidimensional, World Bank, ${mpwb.year}`, v: mpwb.v },
    { name: `Multidimensional, UNDP and OPHI, ${mpun.year}`, v: mpun.v },
  ];
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 40, marginLeft: 340, marginRight: 90, marginTop: 24, marginBottom: 34, style: baseStyle,
    x: { domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickFormat: (x) => x + (x === 100 ? "%" : ""), tickSize: 0, tickPadding: 8, label: "share of Indians counted as poor, per cent", labelAnchor: "right", labelArrow: false },
    y: { domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12, label: null },
    marks: [
      Plot.gridX([20, 40, 60, 80, 100], { stroke: GRID }),
      Plot.ruleY(rows, { y: "name", x1: 0, x2: "v", stroke: (r) => (r.old ? G3 : "#AAB8F2"), strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "name", x: "v", r: 5, fill: (r) => (r.k === "acc" ? ACC : r.old ? G2 : "#7D8EE6"), stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(rows, { y: "name", x: "v", text: (r) => pct1(r.v), dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (r) => (r.k === "acc" ? 600 : 400) }),
    ],
  });
  a11y(plot, "The poverty figures people quote for India", rows.map((r) => `${r.name}: ${pct1(r.v)}`).join("; "));
  document.getElementById("plot-quotes").append(plot);
  setHTML("pv-quotes", `${f1(Math.min(...rows.map((r) => r.v)))} to ${f1(Math.max(...rows.map((r) => r.v)))}%`);
  setHTML("ex-qu-nat", pct1(nat.v));
  setHTML("ex-qu-naty", round(nat.year));
  setHTML("ex-qu-wb11", pct1(v(SURVEYS.find((s) => s.year === 2011), "headcount_3_00")));
  setHTML("ex-qu-mpwb", pct1(mpwb.v));
  setHTML("ex-qu-mpwby", String(mpwb.year));
  setHTML("ex-qu-mpun", pct1(mpun.v));
  setHTML("ex-qu-mpuny", String(mpun.year));
  wirePlate("cb-quotes", plot, "india-atlas_poverty-figures-compared", csvOf(["measure", "share_poor_pct"], rows.map((r) => [r.name, r.v])));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", CUR.meta.vintage);
setHTML("prov-vintage2", CUR.meta.vintage);
setHTML("prov-wdi", wdiB.meta.vintage);
