// Guide 15, money, credit and banks: plates and number wiring.
// Data: data/series/credit-*.json, baked by scripts/lib/products/credit.mjs from the RBI's DBIE
// (via the local Data Bank). Amounts are ₹ lakh crore unless a plate says otherwise.
// Rulers never joined across: the 2007 and 2019 sectoral classifications; series including and
// excluding the HDFC merger (July 2023); spatial statements with and without RRBs.
// CPI inflation for the money plate is read from the CPI guide's 2024-base linked bundle.

import * as Plot from "@observablehq/plot";
import growthB from "../../data/series/credit-growth.json";
import sectorsB from "../../data/series/credit-sectors.json";
import sectors07B from "../../data/series/credit-sectors-2007.json";
import industryB from "../../data/series/credit-industry.json";
import scbB from "../../data/series/credit-scb.json";
import ratiosB from "../../data/series/credit-scb-ratios.json";
import foodB from "../../data/series/credit-food.json";
import moneyB from "../../data/series/credit-money.json";
import moneyGB from "../../data/series/credit-money-growth.json";
import mratiosB from "../../data/series/credit-money-ratios.json";
import depthB from "../../data/series/credit-depth.json";
import npaB from "../../data/series/credit-npa.json";
import npaMoveB from "../../data/series/credit-npa-movement.json";
import crarB from "../../data/series/credit-crar.json";
import fraudB from "../../data/series/credit-frauds.json";
import stCdB from "../../data/series/credit-states-cd-annual.json";
import utilB from "../../data/series/credit-utilisation.json";
import stAnnB from "../../data/series/credit-states-annual.json";
import placesB from "../../data/series/credit-places.json";
import womenB from "../../data/series/credit-women.json";
import ratesB from "../../data/series/credit-lending-rates.json";
import sizeB from "../../data/series/credit-size.json";
import nbfcB from "../../data/series/credit-nbfc.json";
import cpiB from "../../data/series/cpi-2024-linked.json";
import { MONO as sans, hydrate, a11y, addCrosshair, spark, dodgeEndLabels, downloadSVG, downloadPNG, saveBlob, seamMarks, fmt } from "../charts/plumbing.js";

const INK = "#161A22", GRID = "#F0F2F5", ZERO = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", ACC_SOFT = "#AFBBF0", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const dayOf = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const lastOf = (b, k) => { const d = b.series[k].data; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, d: b.dates[i] }; return null; };
const at = (b, k, iso) => b.series[k]?.data[b.dates.indexOf(iso)] ?? null;
const yearsAgo = (iso, n) => `${+iso.slice(0, 4) - n}${iso.slice(4)}`;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yr = (y, m = 0) => new Date(Date.UTC(y, m, 1));
const yearTicks = (a, b, step) => { const t = []; for (let y = a; y <= b; y += step) t.push(yr(y)); return t; };
const yearFmt = (d) => { const y = d.getUTCFullYear(); return y % 10 === 0 || y === 2026 ? String(y) : "’" + String(y).slice(2); };
const oddOrLast = (y, b) => +y % 2 === 1 || y === b.dates.at(-1).slice(0, 4);   // year ticks on annual bar plates
const pts = (b, k) => b.dates.map((d, i) => ({ date: new Date(d + "T00:00:00Z"), value: b.series[k].data[i] })).filter((p) => p.value != null);

/* ---------- shared plate wiring ---------- */
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
const csvOf = (cols, rows) => [cols.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");
/** a date-joined CSV of several bundle series */
const seriesCsv = (list) => {
  const keys = [...new Set(list.flatMap(([b]) => b.dates))].sort();
  return csvOf(["date", ...list.map(([, k, name]) => name ?? k)], keys.map((d) => [d, ...list.map(([b, k]) => at(b, k, d))]));
};

/** Lines on a time axis with labels at the line ends (dodged), a crosshair and a11y. */
function lines(id, list, { yDomain, yTicks, yFmt = (v) => String(v), yLabel, xTicks, height = 470, mr = 210, ml = 48, labelFmt = (v) => v.toFixed(1) + "%", extra = [], tipFmt, dateFmt = (d) => monthOf(d.toISOString().slice(0, 10)) }) {
  const host = document.getElementById(id); if (!host) return null;
  const marks = [Plot.gridY(yTicks.filter((v) => v !== 0), { stroke: GRID }), Plot.ruleY([yDomain[0] <= 0 && yDomain[1] >= 0 ? 0 : yDomain[0]], { stroke: ZERO }), ...extra];
  // series drawn by a seam (seamMarks, passed in extra) set noLine: they keep their end label and tooltip
  for (const s of list.filter((s) => !s.lead && !s.noLine)) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 1.5, strokeLinejoin: "round", strokeLinecap: "round", ...(s.dash ? { strokeDasharray: s.dash } : {}) }));
  for (const s of list.filter((s) => s.lead && !s.noLine)) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 2, strokeLinejoin: "round", strokeLinecap: "round" }));
  const labelled = list.filter((s) => s.endLabel !== false && s.data.length);
  for (const s of labelled) marks.push(Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: s.lead ? 3.5 : 3, stroke: "#fff", strokeWidth: 1.5 }));
  const gap = (yDomain[1] - yDomain[0]) * 0.055;
  for (const p of dodgeEndLabels(labelled, gap)) marks.push(Plot.text([{ date: p.s.data.at(-1).date, y: p.y }], { x: "date", y: "y", text: () => `${p.s.label} ${labelFmt(p.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: p.s.lead ? 600 : 400 }));
  const plot = Plot.plot({
    width: W, height, marginLeft: ml, marginRight: mr, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: xTicks, tickFormat: yearFmt },
    y: { label: yLabel, labelAnchor: "top", labelArrow: false, domain: yDomain, ticks: yTicks, tickFormat: yFmt, tickSize: 0, tickPadding: 8 },
    marks,
  });
  host.append(plot);
  addCrosshair(host, plot, list.map((s) => ({ data: s.data, label: s.label, color: s.color })), null, dateFmt, tipFmt ?? ((v) => (v == null ? "—" : labelFmt(v))));
  return plot;
}

/** Horizontal bars, one highlighted, optional comparison dots, values outside the bar end. */
function hbars(id, rows, { valueFmt, hl = () => false, xDomain, xTicks, xFmt = (v) => String(v), label, ml = 260, mr = 110, dot = null, dotFmt = null, rowH = 34 }) {
  const host = document.getElementById(id); if (!host) return null;
  const neg = rows.some((r) => r.v < 0);
  const marks = [
    Plot.gridX(xTicks.filter((v) => v !== 0), { stroke: GRID }),
    Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? ACC : G3), insetTop: rowH * 0.28, insetBottom: rowH * 0.28 }),
    Plot.ruleX([0], { stroke: ZERO }),
  ];
  if (dot) marks.push(Plot.dot(rows.filter((r) => r[dot] != null), { y: "name", x: dot, r: 4, fill: "#fff", stroke: G1, strokeWidth: 1.5 }));
  // value labels sit at the bar's end; only when a comparison dot falls where the label would
  // be is the label moved past the dot, so a label always reads as its own bar's value
  const upx = (xDomain[1] - xDomain[0]) / (W - ml - mr);
  // the label's width: dx 9 and about 8.6px a character at 12.5px, plus the dot's radius and a gap
  const lx = (r) => { const wpx = valueFmt(r.v).length * 8.6 + 20; const d = dot ? r[dot] : null; return d != null && d >= r.v - 6 * upx && d <= r.v + wpx * upx ? d + 4 * upx : r.v; };
  const right = rows.filter((r) => r.v >= 0), left = rows.filter((r) => r.v < 0);
  marks.push(Plot.text(right, { y: "name", x: lx, text: (d) => valueFmt(d.v), dx: 9, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (hl(d) ? 600 : 400) }));
  if (left.length) marks.push(Plot.text(left, { y: "name", x: "v", text: (d) => valueFmt(d.v), dx: -9, textAnchor: "end", fill: INK, fontSize: 12.5 }));
  // labels for the dots themselves, muted, where a plate's story is the dot (loan sizes)
  if (dot && dotFmt) marks.push(Plot.text(rows.filter((r) => r[dot] != null && r[dot] > r.v + (valueFmt(r.v).length * 8.6 + 20) * upx), { y: "name", x: dot, text: (d) => dotFmt(d[dot]), dx: 9, textAnchor: "start", fill: MUTED, fontSize: 11.5 }));
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * rowH, marginLeft: ml, marginRight: mr, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: xDomain, ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: neg ? 70 : 14 },
    marks,
  });
  host.append(plot);
  return plot;
}

/* ======================================================================================
 * Title block and § 01
 * ==================================================================================== */
const G = growthB, S = sectorsB;
const gL = lastOf(G, "headline"), gDate = G.dates.at(-1), gPrevYear = at(G, "headline", yearsAgo(gDate, 1));
const nf = lastOf(S, "non_food_credit").v, pers = lastOf(S, "personal_loans").v;
const persShare = (100 * pers) / nf;
const persShareYA = (100 * at(S, "personal_loans", yearsAgo(gDate, 1))) / at(S, "non_food_credit", yearsAgo(gDate, 1));
const m3 = lastOf(moneyGB, "m3_incl_merger"), npaL = lastOf(npaB, "all_gnpa_ratio");
const npaPeak = npaB.series.all_gnpa_ratio.data.reduce((p, v, i) => (npaB.dates[i] >= "2010-01-01" && v > p.v ? { v, d: npaB.dates[i] } : p), { v: -1 });
setHTML("m-latest", monthOf(gDate));
setHTML("u-reading", `RBI, sectoral deployment of bank credit, ${monthOf(gDate)}`);
setHTML("n-growth", gL.v.toFixed(1) + pc("%"));
setHTML("d-growth", `<b>${fmt.pct1(gPrevYear)}</b> a year earlier`);
spark("nspark-growth", { ...hydrate(G).headline, color: ACC });
setHTML("n-pers", persShare.toFixed(1) + pc("%"));
setHTML("d-pers", `<b>${fmt.lc1(pers)}</b> in personal loans`);
setHTML("n-m3", m3.v.toFixed(1) + pc("%"));
setHTML("d-m3", `broad money, ${dayOf(m3.d)}`);
setHTML("n-npa", npaL.v.toFixed(1) + pc("%"));
setHTML("d-npa", `<b>${npaPeak.v.toFixed(1)}%</b> at the peak, March ${npaPeak.d.slice(0, 4)}`);

setHTML("rb-growth", gL.v.toFixed(1) + pc("%"));
setHTML("rb-stock", "₹" + lastOf(S, "bank_credit").v.toFixed(1) + pc(" lakh crore"));

/* ======================================================================================
 * § 02 how fast credit grows (fortnightly, 1998 on)
 * ==================================================================================== */
{
  const R = ratiosB, s = (k) => pts(R, k);
  // the merger seam: growth excluding the merger and growth as published, both drawn through
  // the two years RBI published both; the marker at the merger (July 2023)
  const exM = s("credit_growth_ex_merger"), raw = s("credit_growth");
  const seam = seamMarks("overlap", [{ data: exM, color: ACC_SOFT, width: 1.75 }, { data: raw, color: ACC, width: 2 }],
    { at: new Date(Date.UTC(2023, 6, 14)), text: "HDFC merger", y: 38 });
  const plot = lines("plot-growth", [
    { data: s("deposits_growth"), color: GOLD, width: 1.5, label: "Deposits" },
    { data: exM, color: ACC_SOFT, label: "Credit, excluding the merger", endLabel: false, noLine: true },
    { data: raw, color: ACC, label: "Bank credit", lead: true, noLine: true },
  ], { yDomain: [-5, 40], yTicks: [0, 10, 20, 30, 40], yFmt: (v) => v + (v === 40 ? "%" : ""), yLabel: "↑ growth on a year earlier", xTicks: yearTicks(1998, 2026, 2), mr: 170, extra: seam });
  const cg = lastOf(R, "credit_growth"), dg = lastOf(R, "deposits_growth");
  a11y(plot, "Growth of bank credit and deposits since 1998", `Bank credit grew ${fmt.pct1(cg.v)} and deposits ${fmt.pct1(dg.v)} in the year to ${dayOf(cg.d)}.`);
  // the slowest point after 2010 and the highest since, read from the data
  let lo = null, hi = null;
  R.dates.forEach((d, i) => { const v = R.series.credit_growth.data[i]; if (v == null || d < "2011-01-01") return; if (!lo || v < lo.v) lo = { v, d }; if (d < "2023-07-01" && (!hi || v > hi.v)) hi = { v, d }; });
  const exMax = R.series.credit_growth_ex_merger.data.reduce((p, v, i) => (v != null && v > p.v ? { v, d: R.dates[i] } : p), { v: -1 });
  setHTML("pv-growth", fmt.pct1(cg.v));
  setHTML("ex-g-credit", fmt.pct1(cg.v)); setHTML("ex-g-dep", fmt.pct1(dg.v)); setHTML("ex-g-date", dayOf(cg.d));
  setHTML("ex-g-lo", fmt.pct1(lo.v)); setHTML("ex-g-lo-d", monthOf(lo.d));
  setHTML("ex-g-exmax", fmt.pct1(exMax.v)); setHTML("ex-g-exmax-d", monthOf(exMax.d));
  wirePlate("cb-growth", plot, "india-atlas_bank-credit-growth", seriesCsv([[R, "credit_growth"], [R, "credit_growth_ex_merger"], [R, "deposits_growth"], [R, "deposits_growth_ex_merger"]]));
}

/* ---------- § 02 credit-deposit ratio and depth ---------- */
{
  const R = ratiosB;
  const plot = lines("plot-cd", [
    { data: pts(R, "credit_deposit_ratio"), color: ACC, width: 2, label: "Credit-deposit ratio", lead: true },
    { data: pts(R, "investment_deposit_ratio"), color: G2, width: 1.5, label: "Investment-deposit ratio" },
  ], { yDomain: [0, 90], yTicks: [0, 20, 40, 60, 80], yFmt: (v) => v + (v === 80 ? "%" : ""), yLabel: "↑ per cent of deposits", xTicks: yearTicks(1998, 2026, 2), height: 420, mr: 250 });
  const c = lastOf(R, "credit_deposit_ratio"), c0 = R.series.credit_deposit_ratio.data[0];
  a11y(plot, "Credit-deposit ratio since 1997", `Banks lent ${fmt.pct1(c.v)} of their deposits on ${dayOf(c.d)}, against ${fmt.pct1(c0)} in ${monthOf(R.dates[0])}.`);
  setHTML("pv-cd", fmt.pct1(c.v)); setHTML("ex-cd-now", fmt.pct1(c.v)); setHTML("ex-cd-0", fmt.pct1(c0)); setHTML("ex-cd-0d", monthOf(R.dates[0]));
  setHTML("ex-cd-inv", fmt.pct1(lastOf(R, "investment_deposit_ratio").v));
  wirePlate("cb-cd", plot, "india-atlas_credit-deposit-ratio", seriesCsv([[R, "credit_deposit_ratio"], [R, "investment_deposit_ratio"], [R, "cash_deposit_ratio"]]));
}
{
  const B = depthB;
  const plot = lines("plot-depth", [
    { data: pts(B, "aggregate_deposits_to_gdp"), color: GOLD, width: 1.5, label: "Deposits" },
    { data: pts(B, "credit_to_gdp"), color: ACC, width: 2, label: "Bank credit", lead: true },
  ], { yDomain: [0, 90], yTicks: [0, 20, 40, 60, 80], yFmt: (v) => v + (v === 80 ? "%" : ""), yLabel: "↑ per cent of GDP", xTicks: yearTicks(1950, 2026, 10).concat([yr(2026)]), height: 420, mr: 170, dateFmt: (d) => `${d.getUTCFullYear() - 1}-${String(d.getUTCFullYear() % 100).padStart(2, "0")}` });
  const c = lastOf(B, "credit_to_gdp"), dep = lastOf(B, "aggregate_deposits_to_gdp");
  a11y(plot, "Bank credit and deposits as a share of GDP since 1950-51", `Credit was ${fmt.pct1(c.v)} of GDP and deposits ${fmt.pct1(dep.v)} in ${+c.d.slice(0, 4) - 1}-${c.d.slice(2, 4)}.`);
  setHTML("pv-depth", fmt.pct1(c.v)); setHTML("ex-dp-c", fmt.pct1(c.v)); setHTML("ex-dp-d", fmt.pct1(dep.v)); setHTML("ex-dp-c0", fmt.pct1(B.series.credit_to_gdp.data[0]));
  setHTML("ex-dp-c91", fmt.pct1(at(B, "credit_to_gdp", "1991-03-01")));
  wirePlate("cb-depth", plot, "india-atlas_bank-credit-share-of-gdp", seriesCsv([[B, "credit_to_gdp"], [B, "aggregate_deposits_to_gdp"], [B, "investments_in_government_securities_to_gdp"]]));
}

/* ======================================================================================
 * § 03 who borrows
 * ==================================================================================== */
const ROWS_WHO = [
  ["agriculture", "Agriculture"], ["industry_micro_small", "Industry: micro and small"], ["industry_medium", "Industry: medium"], ["industry_large", "Industry: large"],
  ["nbfcs", "Services: NBFCs"], ["trade", "Services: trade"], ["commercial_real_estate", "Services: commercial real estate"], ["other_services_all", "Services: everything else"],
  ["housing", "Personal: housing"], ["vehicle_loans", "Personal: vehicles"], ["gold_loans", "Personal: gold loans"], ["credit_cards", "Personal: credit cards"], ["other_personal_all", "Personal: everything else"],
];
{
  const iL = S.dates.length - 1, iY = S.dates.indexOf(yearsAgo(S.dates[iL], 1));
  const v = (k, i) => {
    if (k === "other_services_all") return S.series.services.data[i] - S.series.nbfcs.data[i] - S.series.trade.data[i] - S.series.commercial_real_estate.data[i];
    if (k === "other_personal_all") return S.series.personal_loans.data[i] - ["housing", "vehicle_loans", "gold_loans", "credit_cards"].reduce((a, c) => a + S.series[c].data[i], 0);
    return S.series[k].data[i];
  };
  const tot = (i) => ["agriculture", "industry", "services", "personal_loans"].reduce((a, k) => a + S.series[k].data[i], 0);
  const rows = ROWS_WHO.map(([k, name]) => ({ k, name, v: (100 * v(k, iL)) / tot(iL), y: iY >= 0 ? (100 * v(k, iY)) / tot(iY) : null, amt: v(k, iL) }));
  const top = rows.reduce((p, r) => (r.v > p.v ? r : p));
  const plot = hbars("plot-who", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.k === "housing", xDomain: [0, 20], xTicks: [0, 5, 10, 15, 20], xFmt: (x) => x + (x === 20 ? "%" : ""), label: "share of credit to the four sectors", dot: "y", ml: 270 });
  a11y(plot, "Who borrows from India's banks", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  setHTML("pv-who", top.v.toFixed(1) + "%"); setHTML("lg-who", monthOf(S.dates[iL])); setHTML("lg-who-y", monthOf(S.dates[iY]));
  const share = (k) => rows.find((r) => r.k === k).v.toFixed(1) + "%";
  const grp = (ks) => rows.filter((r) => ks.includes(r.k)).reduce((a, r) => a + r.v, 0).toFixed(1) + "%";
  setHTML("ex-w-pers", grp(["housing", "vehicle_loans", "gold_loans", "credit_cards", "other_personal_all"]));
  setHTML("ex-w-ind", grp(["industry_micro_small", "industry_medium", "industry_large"]));
  setHTML("ex-w-serv", grp(["nbfcs", "trade", "commercial_real_estate", "other_services_all"]));
  setHTML("ex-w-agri", share("agriculture")); setHTML("ex-w-house", share("housing")); setHTML("ex-w-nbfc", share("nbfcs"));
  setHTML("ex-w-large", share("industry_large"));
  wirePlate("cb-who", plot, "india-atlas_who-borrows", csvOf(["borrower", `share_${S.dates[iL]}_pct`, `share_${S.dates[iY]}_pct`, `amount_${S.dates[iL]}_inr_lakh_crore`], rows.map((r) => [r.name, r.v.toFixed(2), r.y?.toFixed(2), r.amt.toFixed(3)])));
}

/* ---------- § 03 the mix since 2007 ---------- */
{
  const KEYS = [["personal_loans", "Personal loans", ACC], ["services", "Services", GOLD], ["industry", "Industry", G1], ["agriculture", "Agriculture", G2]];
  const share = (B, k) => B.dates.map((d, i) => { const t = ["agriculture", "industry", "services", "personal_loans"].reduce((a, c) => a + (B.series[c].data[i] ?? NaN), 0); const v = B.series[k].data[i]; return { date: new Date(d + "T00:00:00Z"), value: v == null || !Number.isFinite(t) ? null : (100 * v) / t }; }).filter((p) => p.value != null);
  // the 2019 reclassification: each sector's old-format share (pale, to December 2020) and new
  // format (solid, from January 2019) drawn through the two years both exist, never joined
  const TINT = { [ACC]: ACC_SOFT, [GOLD]: "#E7C48E", [G1]: "#B5BAC4", [G2]: "#D5D9E0" };
  const extra = [];
  KEYS.forEach(([k, , c], i) => extra.push(...seamMarks("overlap", [{ data: share(sectors07B, k), color: TINT[c], width: 1.5 }, { data: share(S, k), color: c, width: k === "personal_loans" ? 2 : 1.5 }],
    i === 0 ? { at: yr(2019), text: "New classification", y: 47, anchor: "start" } : false)));
  const plot = lines("plot-mix", KEYS.map(([k, name, c]) => ({ data: share(S, k), color: c, label: name, lead: k === "personal_loans", noLine: true })),
    { yDomain: [0, 50], yTicks: [0, 10, 20, 30, 40, 50], yFmt: (v) => v + (v === 50 ? "%" : ""), yLabel: "↑ share of credit to the four sectors", xTicks: yearTicks(2007, 2026, 1).filter((d) => d.getUTCFullYear() % 2 === 0 || d.getUTCFullYear() === 2007), height: 440, mr: 190, extra });
  const p07 = share(sectors07B, "personal_loans")[0].value, i07 = share(sectors07B, "industry")[0].value;
  const pNow = share(S, "personal_loans").at(-1).value, iNow = share(S, "industry").at(-1).value;
  a11y(plot, "Shares of bank credit by sector since 2007", `Industry fell from ${fmt.pct1(i07)} to ${fmt.pct1(iNow)}; personal loans rose from ${fmt.pct1(p07)} to ${fmt.pct1(pNow)}.`);
  setHTML("pv-mix", fmt.pct1(pNow)); setHTML("ex-mx-p07", fmt.pct1(p07)); setHTML("ex-mx-i07", fmt.pct1(i07)); setHTML("ex-mx-p", fmt.pct1(pNow)); setHTML("ex-mx-i", fmt.pct1(iNow));
  setHTML("ex-mx-s", fmt.pct1(share(S, "services").at(-1).value));
  // first month in which personal loans outweighed industry, on the 2019 classification
  const ps = share(S, "personal_loans"), is = share(S, "industry"); const cross = ps.find((p, i) => p.value > is[i].value);
  setHTML("ex-mx-cross", cross ? monthOf(cross.date.toISOString().slice(0, 10)) : "not yet");
  const rows = [...sectors07B.dates.map((d) => ["2007 format", d, ...["agriculture", "industry", "services", "personal_loans", "non_food_credit"].map((k) => at(sectors07B, k, d))]), ...S.dates.map((d) => ["2019 format", d, ...["agriculture", "industry", "services", "personal_loans", "non_food_credit"].map((k) => at(S, k, d))])];
  wirePlate("cb-mix", plot, "india-atlas_bank-credit-by-sector", csvOf(["classification", "month", "agriculture", "industry", "services", "personal_loans", "non_food_credit_inr_lakh_crore"], rows));
}

/* ---------- § 03 what is growing fastest ---------- */
{
  const KEYS = [["agriculture", "Agriculture"], ["industry_micro_small", "Industry: micro and small"], ["industry_medium", "Industry: medium"], ["industry_large", "Industry: large"], ["nbfcs", "Services: NBFCs"], ["trade", "Services: trade"],
    ["commercial_real_estate", "Services: commercial real estate"], ["housing", "Personal: housing"], ["vehicle_loans", "Personal: vehicles"], ["gold_loans", "Personal: gold loans"], ["credit_cards", "Personal: credit cards"],
    ["education", "Personal: education"], ["consumer_durables", "Personal: consumer durables"], ["other_personal_loans", "Personal: other personal loans"]];
  const iL = G.dates.length - 1;
  const rows = KEYS.map(([k, name]) => ({ k, name, v: G.series[k].data[iL], y: at(G, k, yearsAgo(G.dates[iL], 1)) })).sort((a, b) => b.v - a.v);
  const head = G.series.headline.data[iL];
  const xmax = Math.ceil(Math.max(...rows.map((r) => Math.max(r.v, r.y ?? 0))) / 20) * 20;
  // the axis reaches below zero when a bar or a year-ago circle does, so no circle sits on a row's name
  const xmin = Math.floor(Math.min(0, ...rows.map((r) => Math.min(r.v, r.y ?? 0))) / 20) * 20;
  const plot = hbars("plot-fast", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.v > head, xDomain: [xmin, xmax], xTicks: Array.from({ length: (xmax - xmin) / 20 + 1 }, (_, i) => xmin + i * 20), xFmt: (x) => x + (x === xmax ? "%" : ""), label: "growth on a year earlier", dot: "y", ml: 270,
    // the headline as a reference line
  });
  const svg = plot;
  a11y(svg, "Growth of bank credit by sector", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  const nAbove = rows.filter((r) => r.v > head).length;
  setHTML("pv-fast", fmt.pct1(rows[0].v)); setHTML("lg-fast", monthOf(G.dates[iL])); setHTML("lg-fast-y", monthOf(yearsAgo(G.dates[iL], 1)));
  setHTML("ex-f-top", rows[0].name.replace(/^Personal: |^Services: |^Industry: /, "").replace(/^\w/, (c) => c.toUpperCase())); setHTML("ex-f-topv", fmt.pct1(rows[0].v));
  setHTML("ex-f-low", rows.at(-1).name.replace(/^Personal: |^Services: |^Industry: /, "")); setHTML("ex-f-lowv", fmt.pct1(rows.at(-1).v));
  setHTML("ex-f-head", fmt.pct1(head)); setHTML("ex-f-n", String(nAbove)); setHTML("ex-f-of", String(rows.length));
  wirePlate("cb-fast", plot, "india-atlas_bank-credit-growth-by-sector", csvOf(["sector", `growth_${G.dates[iL]}_pct`, `growth_${yearsAgo(G.dates[iL], 1)}_pct`], rows.map((r) => [r.name, r.v, r.y])));
}

/* ======================================================================================
 * § 04 personal loans
 * ==================================================================================== */
{
  const KEYS = [["gold_loans", "Gold loans", GOLD], ["housing", "Housing", ACC], ["vehicle_loans", "Vehicles", G1], ["credit_cards", "Credit cards", G2], ["other_personal_loans", "Other personal loans", "#7D8494"]];
  const host = document.getElementById("plot-personal");
  const panels = [];
  if (host) {
    const grid = document.createElement("div"); grid.className = "credit-sm"; host.append(grid);
    for (const [k, name, c] of KEYS) {
      const d = pts(G, k), L = d.at(-1);
      const lo = Math.min(0, ...d.map((p) => p.value)), hi = Math.max(...d.map((p) => p.value));
      const top = hi > 100 ? Math.ceil(hi / 50) * 50 : Math.ceil(hi / 10) * 10, step = top > 100 ? 50 : top > 40 ? 20 : 10;
      const cell = document.createElement("div"); cell.className = "credit-sm-cell";
      cell.innerHTML = `<div class="sm-h">${name}</div><div class="sm-v">${fmt.pct1(L.value)}</div>`;
      const p = Plot.plot({
        width: 372, height: 196, marginLeft: 36, marginRight: 12, marginTop: 22, marginBottom: 26, style: baseStyle,
        x: { type: "utc", label: null, tickSize: 0, tickPadding: 8, ticks: [yr(2020), yr(2023), yr(2026)], tickFormat: (x) => String(x.getUTCFullYear()) },
        y: { label: null, domain: [Math.floor(lo / step) * step, top], ticks: Array.from({ length: Math.round((top - Math.floor(lo / step) * step) / step) + 1 }, (_, i) => Math.floor(lo / step) * step + i * step), tickFormat: (v) => String(v), tickSize: 0, tickPadding: 6 },
        marks: [Plot.gridY({ stroke: GRID }), Plot.ruleY([0], { stroke: ZERO }), Plot.lineY(d, { x: "date", y: "value", stroke: c, strokeWidth: 1.75, strokeLinejoin: "round" }), Plot.dot([L], { x: "date", y: "value", r: 3, fill: c, stroke: "#fff", strokeWidth: 1.5 })],
      });
      p.setAttribute("aria-hidden", "true");
      cell.append(p); grid.append(cell); panels.push(p);
    }
    host.setAttribute("role", "img");
    host.setAttribute("aria-label", "Growth of personal loans by type since 2020: " + KEYS.map(([k, n]) => `${n} ${fmt.pct1(lastOf(G, k).v)}`).join(", "));
  }
  const gold = lastOf(G, "gold_loans"), cards = lastOf(G, "credit_cards"), house = lastOf(G, "housing");
  setHTML("pv-personal", fmt.pct1(lastOf(G, "personal_loans").v));
  setHTML("ex-p-gold", fmt.pct1(gold.v)); setHTML("ex-p-cards", fmt.pct1(cards.v)); setHTML("ex-p-house", fmt.pct1(house.v)); setHTML("ex-p-date", monthOf(gold.d));
  const cardsPeak = G.series.credit_cards.data.reduce((p, v, i) => (v != null && G.dates[i] >= "2021-01-01" && v > p.v ? { v, d: G.dates[i] } : p), { v: -1e9 });
  setHTML("ex-p-cardspk", fmt.pct1(cardsPeak.v)); setHTML("ex-p-cardspkd", monthOf(cardsPeak.d));
  setHTML("ex-p-goldamt", fmt.lc1(lastOf(S, "gold_loans").v));
  const btn = document.querySelector("#cb-personal [data-dl='csv']");
  btn?.addEventListener("click", () => saveBlob(new Blob([seriesCsv(KEYS.map(([k, n]) => [G, k, n]))], { type: "text/csv" }), "india-atlas_personal-loan-growth.csv"));
  // image downloads take the first panel's frame as the plate's picture
  document.querySelectorAll("#cb-personal [data-dl='svg'], #cb-personal [data-dl='png']").forEach((b) => b.remove());
}

/* ---------- § 04 what loans cost ---------- */
{
  const R = ratesB, L = R.dates.length - 1;
  const KEYS = [["personal_credit_cards_rate", "Credit cards"], ["consumer_durables_rate", "Consumer durables"], ["other_personal_loans_rate", "Other personal loans"], ["agriculture_rate", "Agriculture"], ["transport_operators_rate", "Transport operators"],
    ["vehicles_rate", "Vehicles"], ["trade_rate", "Trade"], ["education_rate", "Education"], ["professional_and_other_services_rate", "Professional services"], ["industry_rate", "Industry"], ["housing_rate", "Housing"], ["finance_rate", "Finance"]];
  const rows = KEYS.map(([k, name]) => ({ k, name, v: R.series[k].data[L], y: at(R, k, yearsAgo(R.dates[L], 1)) }));
  const all = R.series.total_credit_rate.data[L];
  const plot = hbars("plot-cost", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.k === "personal_credit_cards_rate", xDomain: [0, 40], xTicks: [0, 10, 20, 30, 40], xFmt: (x) => x + (x === 40 ? "%" : ""), label: "interest rate, per cent a year", dot: "y" });
  a11y(plot, "What bank loans cost, by purpose", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  setHTML("pv-cost", fmt.pct1(all)); setHTML("lg-cost", monthOf(R.dates[L])); setHTML("lg-cost-y", monthOf(yearsAgo(R.dates[L], 1)));
  setHTML("ex-c-card", fmt.pct1(rows[0].v)); setHTML("ex-c-house", fmt.pct1(rows.find((r) => r.k === "housing_rate").v)); setHTML("ex-c-all", fmt.pct1(all)); setHTML("ex-c-date", monthOf(R.dates[L]));
  setHTML("ex-c-agri", fmt.pct1(rows.find((r) => r.k === "agriculture_rate").v)); setHTML("ex-c-ind", fmt.pct1(rows.find((r) => r.k === "industry_rate").v));
  wirePlate("cb-cost", plot, "india-atlas_lending-rates-by-purpose", seriesCsv(KEYS.map(([k, n]) => [R, k, n]).concat([[R, "total_credit_rate", "All loans"]])));
}

/* ---------- § 04 how big the loans are ---------- */
{
  const Z = sizeB, L = Z.dates.length - 1;
  const BANDS = [["25_000_and_less", "₹25,000 or less"], ["above_rs_25_000_and_up_to_rs_2_lakh", "₹25,000 to ₹2 lakh"], ["above_rs_2_lakh_and_up_to_rs_5_lakh", "₹2 to 5 lakh"], ["above_rs_5_lakh_and_up_to_rs_10_lakh", "₹5 to 10 lakh"],
    ["above_rs_10_lakh_and_up_to_rs_25_lakh", "₹10 to 25 lakh"], ["above_rs_25_lakh_and_up_to_rs_50_lakh", "₹25 to 50 lakh"], ["above_rs_50_lakh_and_up_to_rs_1_crore", "₹50 lakh to ₹1 crore"], ["above_rs_1_crore_and_up_to_rs_4_crore", "₹1 to 4 crore"],
    ["above_rs_4_crore_and_up_to_rs_6_crore", "₹4 to 6 crore"], ["above_rs_6_crore_and_up_to_rs_10_crore", "₹6 to 10 crore"], ["above_rs_10_crore_and_up_to_rs_25_crore", "₹10 to 25 crore"], ["above_rs_25_crore_and_up_to_rs_100_crore", "₹25 to 100 crore"], ["above_rs_100_crore", "Above ₹100 crore"]];
  const tA = Z.series.total_credit_amount.data[L], tN = Z.series.total_credit_accounts.data[L];
  const rows = BANDS.map(([k, name]) => ({ name, v: (100 * Z.series[k + "_amount"].data[L]) / tA, n: (100 * Z.series[k + "_accounts"].data[L]) / tN, k }));
  const plot = hbars("plot-size", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.k === "above_rs_100_crore", xDomain: [0, 60], xTicks: [0, 15, 30, 45, 60], xFmt: (x) => x + (x === 60 ? "%" : ""), label: "share of all bank credit (bars) and of loan accounts (circles)", dot: "n", dotFmt: (x) => x.toFixed(1) + "% of accounts", ml: 200 });
  a11y(plot, "Bank loans by size", rows.map((r) => `${r.name}: ${r.v.toFixed(1)}% of the money, ${r.n.toFixed(1)}% of accounts`).join("; "));
  const small = rows.slice(0, 2), big = rows.at(-1);
  setHTML("pv-size", fmt.pct1(big.v)); setHTML("ex-z-smalln", fmt.pct1(small.reduce((a, r) => a + r.n, 0))); setHTML("ex-z-smallv", fmt.pct1(small.reduce((a, r) => a + r.v, 0)));
  setHTML("ex-z-bigv", fmt.pct1(big.v)); setHTML("ex-z-bign", big.n < 0.01 ? "less than 0.01%" : fmt.pct2(big.n)); setHTML("ex-z-date", monthOf(Z.dates[L]));
  setHTML("ex-z-accts", (tN / 100).toFixed(1));
  wirePlate("cb-size", plot, "india-atlas_bank-loans-by-size", csvOf(["credit_limit", "share_of_amount_pct", "share_of_accounts_pct", "amount_inr_lakh_crore", "accounts_lakh"], rows.map((r) => [r.name, r.v.toFixed(3), r.n.toFixed(3), Z.series[r.k + "_amount"].data[L], Z.series[r.k + "_accounts"].data[L]])));
}

/* ======================================================================================
 * § 05 industry and services
 * ==================================================================================== */
{
  const plot = lines("plot-ind", [
    { data: pts(G, "industry_large"), color: G1, width: 1.5, label: "Large" },
    { data: pts(G, "industry_medium"), color: GOLD, width: 1.5, label: "Medium" },
    { data: pts(G, "industry_micro_small"), color: ACC, width: 2, label: "Micro and small", lead: true },
  ], { yDomain: [-10, 80], yTicks: [-10, 0, 20, 40, 60, 80], yFmt: (v) => v + (v === 80 ? "%" : ""), yLabel: "↑ growth on a year earlier", xTicks: yearTicks(2020, 2026, 1), height: 420, mr: 200 });
  const mse = lastOf(G, "industry_micro_small"), med = lastOf(G, "industry_medium"), lg = lastOf(G, "industry_large");
  a11y(plot, "Growth of credit to industry by size since 2020", `Micro and small ${fmt.pct1(mse.v)}, medium ${fmt.pct1(med.v)}, large ${fmt.pct1(lg.v)} in ${monthOf(mse.d)}.`);
  setHTML("pv-ind", fmt.pct1(lastOf(G, "industry").v)); setHTML("ex-i-mse", fmt.pct1(mse.v)); setHTML("ex-i-med", fmt.pct1(med.v)); setHTML("ex-i-lg", fmt.pct1(lg.v)); setHTML("ex-i-date", monthOf(mse.d));
  const medPeak = G.series.industry_medium.data.reduce((p, v, i) => (v != null && v > p.v ? { v, d: G.dates[i] } : p), { v: -1e9 });
  setHTML("ex-i-medpk", fmt.pct1(medPeak.v)); setHTML("ex-i-medpkd", monthOf(medPeak.d));
  wirePlate("cb-ind", plot, "india-atlas_industry-credit-growth-by-size", seriesCsv([[G, "industry_micro_small"], [G, "industry_medium"], [G, "industry_large"], [G, "industry"]]));
}
{
  const B = industryB, L = B.dates.length - 1, Y = B.dates.indexOf(yearsAgo(B.dates[L], 1));
  const TOP = ["infrastructure", "basic_metal_and_metal_product", "chemicals_and_chemical_products", "all_engineering", "food_processing", "textiles", "construction", "vehicles_vehicle_parts_and_transport_equipment", "petroleum_coal_products_and_nuclear_fuels",
    "rubber_plastic_and_their_products", "gems_and_jewellery", "cement_and_cement_products", "mining_and_quarrying", "paper_and_paper_products", "beverage_and_tobacco", "leather_and_leather_products", "wood_and_wood_products", "glass_and_glassware", "other_industries"];
  const NAME = { basic_metal_and_metal_product: "Basic metals and metal products", chemicals_and_chemical_products: "Chemicals", all_engineering: "Engineering", vehicles_vehicle_parts_and_transport_equipment: "Vehicles and parts", petroleum_coal_products_and_nuclear_fuels: "Petroleum and coal products",
    rubber_plastic_and_their_products: "Rubber and plastics", gems_and_jewellery: "Gems and jewellery", cement_and_cement_products: "Cement", mining_and_quarrying: "Mining", paper_and_paper_products: "Paper", beverage_and_tobacco: "Beverages and tobacco", leather_and_leather_products: "Leather", wood_and_wood_products: "Wood", glass_and_glassware: "Glass", other_industries: "Other industries", food_processing: "Food processing" };
  const tot = B.series.industry_total.data[L];
  const rows = TOP.filter((k) => B.series[k]).map((k) => ({ k, name: NAME[k] ?? B.series[k].label, v: (100 * B.series[k].data[L]) / tot, g: Y >= 0 && B.series[k].data[Y] ? 100 * (B.series[k].data[L] / B.series[k].data[Y] - 1) : null, amt: B.series[k].data[L] })).sort((a, b) => b.v - a.v);
  const plot = hbars("plot-industries", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.k === "infrastructure", xDomain: [0, 40], xTicks: [0, 10, 20, 30, 40], xFmt: (x) => x + (x === 40 ? "%" : ""), label: "share of bank credit to industry", ml: 240, rowH: 30 });
  a11y(plot, "Bank credit to industry, by industry", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  const infra = rows.find((r) => r.k === "infrastructure");
  setHTML("pv-industries", fmt.pct1(infra.v)); setHTML("ex-in-infra", fmt.pct1(infra.v)); setHTML("ex-in-power", fmt.pct1((100 * B.series.power.data[L]) / tot)); setHTML("ex-in-roads", fmt.pct1((100 * B.series.roads.data[L]) / tot));
  const fastest = rows.filter((r) => r.g != null && r.amt >= 0.5).sort((a, b) => b.g - a.g)[0];
  setHTML("ex-in-fast", fastest.name.toLowerCase()); setHTML("ex-in-fastg", fmt.pct1(fastest.g)); setHTML("ex-in-date", monthOf(B.dates[L]));
  wirePlate("cb-industries", plot, "india-atlas_bank-credit-by-industry", csvOf(["industry", "share_of_industry_credit_pct", "growth_on_a_year_earlier_pct", "amount_inr_lakh_crore"], rows.map((r) => [r.name, r.v.toFixed(2), r.g?.toFixed(2), r.amt])));
}
{
  // NBFCs: bank lending to them, and their own lending
  const N = nbfcB, L = N.dates.length - 1;
  const KEYS = [["retail_loans", "Retail loans, all"], ["housing_loans", "Retail: housing"], ["vehicle_loans", "Retail: vehicles"], ["loans_against_gold_jewellery", "Retail: gold loans"], ["industry", "Industry, all"], ["infrastructure", "Industry: infrastructure"], ["services", "Services"], ["other_loans", "Other loans"], ["agriculture_and_allied_activities", "Agriculture"]];
  const tot = N.series.nbfc_credit.data[L];
  const rows = KEYS.filter(([k]) => N.series[k]).map(([k, name]) => ({ k, name, v: N.series[k].data[L], s: (100 * N.series[k].data[L]) / tot }));
  const plot = hbars("plot-nbfc", rows, { valueFmt: (x) => "₹" + x.toFixed(1) + " lakh cr", hl: (d) => d.k === "retail_loans", xDomain: [0, 30], xTicks: [0, 10, 20, 30], label: "₹ lakh crore", ml: 230, mr: 140 });
  a11y(plot, "What NBFCs lend for", rows.map((r) => `${r.name} ₹${r.v.toFixed(1)} lakh crore`).join(", "));
  setHTML("pv-nbfc", fmt.lc1(tot)); setHTML("ex-n-tot", fmt.lc1(tot)); setHTML("ex-n-date", monthOf(N.dates[L]));
  setHTML("ex-n-retail", fmt.pct1(rows.find((r) => r.k === "retail_loans").s));
  setHTML("ex-n-bank", fmt.lc1(lastOf(S, "nbfcs").v)); setHTML("ex-n-bankg", fmt.pct1(lastOf(G, "nbfcs").v));
  wirePlate("cb-nbfc", plot, "india-atlas_nbfc-credit-by-sector", csvOf(["sector", "amount_inr_lakh_crore", "share_pct"], rows.map((r) => [r.name, r.v, r.s.toFixed(2)])));
}

/* ======================================================================================
 * § 06 food credit
 * ==================================================================================== */
{
  const F = foodB;
  const plot = lines("plot-food", [{ data: pts(F, "food_credit"), color: ACC, width: 1.5, label: "Food credit", lead: true }],
    { yDomain: [0, 1.8], yTicks: [0, 0.5, 1, 1.5], yFmt: (v) => String(v), yLabel: "↑ ₹ lakh crore", xTicks: yearTicks(1994, 2026, 2), height: 420, mr: 215, labelFmt: (v) => "₹" + v.toFixed(2) + " lakh cr", dateFmt: (d) => dayOf(d.toISOString().slice(0, 10)) });
  const L = lastOf(F, "food_credit"), share = lastOf(F, "food_share");
  const pk = F.series.food_credit.data.reduce((p, v, i) => (v != null && v > p.v ? { v, d: F.dates[i] } : p), { v: -1 });
  a11y(plot, "Food credit since 1993", `Food credit was ₹${L.v.toFixed(2)} lakh crore on ${dayOf(L.d)}; its highest was ₹${pk.v.toFixed(2)} lakh crore on ${dayOf(pk.d)}.`);
  setHTML("pv-food", "₹" + L.v.toFixed(2) + " lakh cr"); setHTML("ex-fd-now", "₹" + L.v.toFixed(2) + " lakh crore"); setHTML("ex-fd-date", dayOf(L.d)); setHTML("ex-fd-share", fmt.pct1(share.v));
  setHTML("ex-fd-pk", "₹" + pk.v.toFixed(2) + " lakh crore"); setHTML("ex-fd-pkd", dayOf(pk.d));
  // this year's low and high: the procurement season shows up as the swing
  const y = L.d.slice(0, 4), yr0 = F.dates.map((d, i) => [d, F.series.food_credit.data[i]]).filter(([d, v]) => d.startsWith(y) && v != null);
  const lo = yr0.reduce((p, c) => (c[1] < p[1] ? c : p)), hi = yr0.reduce((p, c) => (c[1] > p[1] ? c : p));
  setHTML("ex-fd-lo", "₹" + lo[1].toFixed(2) + " lakh crore"); setHTML("ex-fd-lod", dayOf(lo[0])); setHTML("ex-fd-hi", "₹" + hi[1].toFixed(2) + " lakh crore"); setHTML("ex-fd-hid", dayOf(hi[0]));
  wirePlate("cb-food", plot, "india-atlas_food-credit", seriesCsv([[F, "food_credit", "food_credit_inr_lakh_crore"], [F, "food_share", "share_of_bank_credit_pct"]]));
}

/* ======================================================================================
 * § 07 money
 * ==================================================================================== */
{
  const M = moneyGB;
  const cpi = pts(cpiB, "headline").filter((p) => p.date >= yr(2013));
  // two rulers: M3 excluding the merger (to June 2025) and including it (growth from July 2024),
  // both drawn through the year they overlap; the marker where the old ruler ends
  const mOld = pts(M, "m3").filter((p) => p.date >= yr(2013)), mNew = pts(M, "m3_incl_merger");
  const seam = seamMarks("overlap", [{ data: mOld, color: ACC_SOFT, width: 2 }, { data: mNew, color: ACC, width: 2 }], { text: "M3 excluding the merger ends", y: 19 });
  const plot = lines("plot-m3", [
    { data: cpi, color: GOLD, width: 1.5, label: "Consumer prices" },
    { data: mNew, color: ACC, label: "M3, with merger", lead: true, noLine: true },
    { data: mOld, color: ACC_SOFT, label: "M3", endLabel: false, noLine: true },
  ], { yDomain: [0, 20], yTicks: [0, 5, 10, 15, 20], yFmt: (v) => v + (v === 20 ? "%" : ""), yLabel: "↑ growth on a year earlier", xTicks: yearTicks(2013, 2026, 1), height: 440, mr: 230, extra: seam });
  const m = lastOf(M, "m3_incl_merger"), c = lastOf(cpiB, "headline");
  a11y(plot, "Money growth and inflation since 2013", `Broad money grew ${fmt.pct1(m.v)} in the year to ${dayOf(m.d)}; consumer prices rose ${fmt.pct1(c.v)} in the year to ${monthOf(c.d)}.`);
  setHTML("pv-m3", fmt.pct1(m.v)); setHTML("ex-m-m3", fmt.pct1(m.v)); setHTML("ex-m-m3d", dayOf(m.d)); setHTML("ex-m-cpi", fmt.pct1(c.v)); setHTML("ex-m-cpid", monthOf(c.d));
  setHTML("ex-m-m1", fmt.pct1(lastOf(M, "m1").v)); setHTML("ex-m-cur", fmt.pct1(lastOf(M, "currency_with_public").v));
  wirePlate("cb-m3", plot, "india-atlas_money-growth-and-inflation", seriesCsv([[M, "m3"], [M, "m3_incl_merger"], [M, "m1"], [cpiB, "headline", "cpi_inflation_2024_base_linked"]]));
}
{
  const R = mratiosB;
  const plot = lines("plot-velocity", [{ data: pts(R, "velocity_m3"), color: ACC, width: 2, label: "GDP over M3", lead: true }, { data: pts(R, "m3_multiplier"), color: G1, width: 1.5, label: "M3 over reserve money" }],
    { yDomain: [0, 6], yTicks: [0, 1, 2, 3, 4, 5, 6], yFmt: (v) => String(v), yLabel: "↑ times", xTicks: yearTicks(1950, 2026, 10).concat([yr(2025)]), height: 400, mr: 240, labelFmt: (v) => v.toFixed(2) + "×", dateFmt: (d) => `${d.getUTCFullYear() - 1}-${String(d.getUTCFullYear() % 100).padStart(2, "0")}` });
  const v = lastOf(R, "velocity_m3"), v0 = R.series.velocity_m3.data[0], mm = lastOf(R, "m3_multiplier");
  a11y(plot, "Velocity of money and the money multiplier since 1951-52", `GDP was ${v.v.toFixed(2)} times M3 in ${+v.d.slice(0, 4) - 1}-${v.d.slice(2, 4)}, against ${v0.toFixed(2)} in 1951-52.`);
  setHTML("pv-velocity", fmt.x2(v.v)); setHTML("ex-v-now", fmt.x2(v.v)); setHTML("ex-v-0", fmt.x2(v0)); setHTML("ex-v-mm", fmt.x2(mm.v)); setHTML("ex-v-yr", `${+v.d.slice(0, 4) - 1}-${v.d.slice(2, 4)}`);
  wirePlate("cb-velocity", plot, "india-atlas_velocity-of-money", seriesCsv([[R, "velocity_m3"], [R, "m3_multiplier"], [R, "currency_to_deposits"]]));
}
{
  const M = moneyGB;
  const plot = lines("plot-currency", [{ data: pts(M, "currency_share_m3"), color: ACC, width: 2, label: "Cash with the public", lead: true }],
    { yDomain: [0, 20], yTicks: [0, 5, 10, 15, 20], yFmt: (v) => v + (v === 20 ? "%" : ""), yLabel: "↑ share of broad money (M3)", xTicks: yearTicks(2002, 2026, 2), height: 380, mr: 210,
      extra: [Plot.ruleX([new Date(Date.UTC(2016, 10, 8))], { stroke: "#B5BAC4", strokeDasharray: "1 3" }), Plot.text([{ x: new Date(Date.UTC(2016, 10, 8)), y: 3 }], { x: "x", y: "y", text: () => "Demonetisation, Nov 2016", dx: 6, textAnchor: "start", fill: MUTED, fontSize: 11.5 })] });
  const c = lastOf(M, "currency_share_m3");
  let pre = null, low = null;
  M.dates.forEach((d, i) => { const v = M.series.currency_share_m3.data[i]; if (v == null) return; if (d < "2016-11-08") pre = { v, d }; if (d >= "2016-11-08" && d < "2017-12-31" && (!low || v < low.v)) low = { v, d }; });
  a11y(plot, "Cash with the public as a share of broad money", `${fmt.pct1(c.v)} on ${dayOf(c.d)}; ${fmt.pct1(pre.v)} just before demonetisation and ${fmt.pct1(low.v)} at its lowest after it.`);
  setHTML("pv-currency", fmt.pct1(c.v)); setHTML("ex-cu-now", fmt.pct1(c.v)); setHTML("ex-cu-pre", fmt.pct1(pre.v)); setHTML("ex-cu-low", fmt.pct1(low.v)); setHTML("ex-cu-lowd", dayOf(low.d));
  setHTML("ex-cu-amt", fmt.lc1(lastOf(moneyB, "currency_with_public").v));
  wirePlate("cb-currency", plot, "india-atlas_cash-share-of-money", seriesCsv([[M, "currency_share_m3"], [moneyB, "currency_with_public", "currency_with_public_inr_lakh_crore"]]));
}

/* ======================================================================================
 * § 08 where the credit goes
 * ==================================================================================== */
{
  const C = stCdB, L = C.dates.length - 1, U = utilB, A = stAnnB;
  const keys = Object.keys(C.series).filter((k) => k !== "all_india");
  const rows = keys.map((k) => {
    const dep = A.series[`${k}_deposits`]?.data[L], used = U.series[`${k}_utilised`]?.data[0];
    return { k, name: C.series[k].label.replace(/, credit-deposit ratio$/, ""), v: C.series[k].data[L], u: dep && used != null && U.dates[0] === C.dates[L] ? (100 * used) / dep : null, dep };
  }).filter((r) => r.v != null && r.dep >= 1).sort((a, b) => b.v - a.v);
  const all = C.series.all_india.data[L];
  const host = "plot-states";
  const plot = hbars(host, rows, { valueFmt: (x) => x.toFixed(0) + "%", hl: (d) => d.v >= all, xDomain: [0, 180], xTicks: [0, 50, 100, 150], xFmt: (x) => x + (x === 150 ? "%" : ""), label: "credit as a share of deposits", dot: "u", ml: 200, rowH: 26, mr: 90 });
  a11y(plot, "Credit-deposit ratio by state", rows.map((r) => `${r.name} ${r.v.toFixed(0)}%`).join(", "));
  const hi = rows[0], lo = rows.at(-1);
  setHTML("pv-states", fmt.pct1(all)); setHTML("ex-s-all", fmt.pct1(all)); setHTML("ex-s-hi", hi.name); setHTML("ex-s-hiv", hi.v.toFixed(0) + "%"); setHTML("ex-s-lo", lo.name); setHTML("ex-s-lov", lo.v.toFixed(0) + "%");
  setHTML("ex-s-n", String(rows.filter((r) => r.v < all).length)); setHTML("ex-s-of", String(rows.length)); setHTML("ex-s-date", `March ${C.dates[L].slice(0, 4)}`);
  const mh = rows.find((r) => r.k === "maharashtra"), bh = rows.find((r) => r.k === "bihar"), up = rows.find((r) => r.k === "uttar_pradesh");
  setHTML("ex-s-mh", mh.v.toFixed(0) + "%"); setHTML("ex-s-mhu", mh.u.toFixed(0) + "%"); setHTML("ex-s-bh", bh.v.toFixed(0) + "%"); setHTML("ex-s-bhu", bh.u.toFixed(0) + "%"); setHTML("ex-s-up", up.v.toFixed(0) + "%");
  setHTML("ex-s-n100", String(rows.filter((r) => r.v > 100).length));
  wirePlate("cb-states", plot, "india-atlas_credit-deposit-ratio-by-state", csvOf(["state", "credit_deposit_ratio_by_sanction_pct", "credit_deposit_ratio_by_utilisation_pct", "deposits_inr_lakh_crore"], rows.map((r) => [r.name, r.v, r.u?.toFixed(2), r.dep])));
}
{
  const P = placesB, L = P.dates.length - 1;
  const G4 = [["rural", "Rural"], ["semi_urban", "Semi-urban"], ["urban", "Urban"], ["metro", "Metropolitan"]];
  const tD = G4.reduce((a, [k]) => a + P.series[k + "_deposits"].data[L], 0), tC = G4.reduce((a, [k]) => a + P.series[k + "_credit"].data[L], 0);
  const rows = G4.map(([k, name]) => ({ k, name, v: (100 * P.series[k + "_credit"].data[L]) / tC, d: (100 * P.series[k + "_deposits"].data[L]) / tD, cd: (100 * P.series[k + "_credit"].data[L]) / P.series[k + "_deposits"].data[L] }));
  const plot = hbars("plot-pop", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.k === "metro", xDomain: [0, 70], xTicks: [0, 20, 40, 60], xFmt: (x) => x + (x === 60 ? "%" : ""), label: "share of all credit (bars) and of all deposits (circles)", dot: "d", ml: 200, rowH: 44 });
  a11y(plot, "Credit and deposits by population group", rows.map((r) => `${r.name}: ${r.v.toFixed(1)}% of credit, ${r.d.toFixed(1)}% of deposits`).join("; "));
  const metro = rows.find((r) => r.k === "metro"), rural = rows.find((r) => r.k === "rural");
  setHTML("pv-pop", fmt.pct1(metro.v)); setHTML("ex-pp-mc", fmt.pct1(metro.v)); setHTML("ex-pp-md", fmt.pct1(metro.d)); setHTML("ex-pp-rc", fmt.pct1(rural.v)); setHTML("ex-pp-rd", fmt.pct1(rural.d));
  setHTML("ex-pp-rcd", rural.cd.toFixed(0) + "%"); setHTML("ex-pp-mcd", metro.cd.toFixed(0) + "%"); setHTML("ex-pp-date", monthOf(P.dates[L]));
  wirePlate("cb-pop", plot, "india-atlas_credit-by-population-group", csvOf(["population_group", "share_of_credit_pct", "share_of_deposits_pct", "credit_deposit_ratio_pct"], rows.map((r) => [r.name, r.v.toFixed(2), r.d.toFixed(2), r.cd.toFixed(2)])));
}
{
  const B = womenB, L = B.dates.length - 1;
  const keys = Object.keys(B.series).filter((k) => k.endsWith("_women_share") && k !== "all_india_women_share");
  const rows = keys.map((k) => ({ k, name: B.series[k].label.replace(/, women's share of bank credit to individuals$/, ""), v: B.series[k].data[L], amt: B.series[k.replace("_women_share", "_individuals_amount")].data[L] }))
    .filter((r) => r.v != null && r.amt >= 0.2).sort((a, b) => b.v - a.v);
  const all = B.series.all_india_women_share.data[L], all0 = B.series.all_india_women_share.data[0];
  const plot = hbars("plot-women", rows, { valueFmt: (x) => x.toFixed(1) + "%", hl: (d) => d.v >= all, xDomain: [0, 50], xTicks: [0, 10, 20, 30, 40, 50], xFmt: (x) => x + (x === 50 ? "%" : ""), label: "women's share of bank credit to individuals", ml: 200, rowH: 26, mr: 80 });
  a11y(plot, "Women's share of bank loans to individuals, by state", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  setHTML("pv-women", fmt.pct1(all)); setHTML("ex-wo-all", fmt.pct1(all)); setHTML("ex-wo-0", fmt.pct1(all0)); setHTML("ex-wo-0d", monthOf(B.dates[0])); setHTML("ex-wo-date", monthOf(B.dates[L]));
  setHTML("ex-wo-hi", rows[0].name); setHTML("ex-wo-hiv", fmt.pct1(rows[0].v)); setHTML("ex-wo-lo", rows.at(-1).name); setHTML("ex-wo-lov", fmt.pct1(rows.at(-1).v));
  setHTML("ex-wo-acc", fmt.pct1(B.series.all_india_women_accounts_share.data[L]));
  wirePlate("cb-women", plot, "india-atlas_womens-share-of-credit-by-state", csvOf(["state", "womens_share_of_credit_to_individuals_pct", "credit_to_individuals_inr_lakh_crore"], rows.map((r) => [r.name, r.v, r.amt])));
}

/* ======================================================================================
 * § 09 bank health
 * ==================================================================================== */
{
  const N = npaB;
  const priv = pts(N, "private_new_gnpa_ratio").filter((p) => p.date >= yr(2014, 2));
  const plot = lines("plot-npa", [
    { data: pts(N, "foreign_gnpa_ratio"), color: G2, width: 1.5, label: "Foreign banks" },
    { data: priv, color: GOLD, width: 1.5, label: "Private banks" },
    { data: pts(N, "public_gnpa_ratio"), color: G1, width: 1.5, label: "Public sector banks" },
    { data: pts(N, "all_gnpa_ratio"), color: ACC, width: 2, label: "All banks", lead: true },
  ], { yDomain: [0, 20], yTicks: [0, 5, 10, 15, 20], yFmt: (v) => v + (v === 20 ? "%" : ""), yLabel: "↑ gross NPAs, per cent of gross advances", xTicks: yearTicks(1998, 2026, 2), height: 440, mr: 220, dateFmt: (d) => `March ${d.getUTCFullYear()}` });
  const a = lastOf(N, "all_gnpa_ratio"), p = lastOf(N, "public_gnpa_ratio");
  const pk = (k, from) => N.series[k].data.reduce((b, v, i) => (v != null && N.dates[i] >= from && v > b.v ? { v, d: N.dates[i] } : b), { v: -1 });
  const pkA = pk("all_gnpa_ratio", "2010-01-01"), pkP = pk("public_gnpa_ratio", "2010-01-01");
  a11y(plot, "Gross NPA ratio by bank group since 1997", `All banks ${fmt.pct1(a.v)} in March ${a.d.slice(0, 4)}, down from ${fmt.pct1(pkA.v)} in March ${pkA.d.slice(0, 4)}.`);
  setHTML("pv-npa", fmt.pct1(a.v)); setHTML("ex-np-all", fmt.pct1(a.v)); setHTML("ex-np-pub", fmt.pct1(p.v)); setHTML("ex-np-pk", fmt.pct1(pkA.v)); setHTML("ex-np-pkd", `March ${pkA.d.slice(0, 4)}`);
  setHTML("ex-np-pkp", fmt.pct1(pkP.v)); setHTML("ex-np-net", fmt.pct1(lastOf(N, "all_nnpa_ratio").v)); setHTML("ex-np-yr", `March ${a.d.slice(0, 4)}`);
  setHTML("ex-np-97", fmt.pct1(N.series.all_gnpa_ratio.data[0]));
  wirePlate("cb-npa", plot, "india-atlas_gross-npa-ratio-by-bank-group", seriesCsv([[N, "all_gnpa_ratio"], [N, "public_gnpa_ratio"], [N, "private_old_gnpa_ratio"], [N, "private_new_gnpa_ratio", "private_new_to_2013_all_private_from_2014_gnpa_ratio"], [N, "foreign_gnpa_ratio"], [N, "small_finance_gnpa_ratio"], [N, "all_nnpa_ratio"]]));
}
{
  const M = npaMoveB;
  const rows = M.dates.flatMap((d, i) => [["Added (new bad loans)", "all_gross_additions", ACC], ["Recovered or upgraded", "all_gross_reductions", G2], ["Written off", "all_gross_write_offs", GOLD]].map(([g, k, c]) => ({ year: d.slice(0, 4), group: g, v: M.series[k].data[i], c })));
  const host = document.getElementById("plot-npaflow");
  const order = ["Added (new bad loans)", "Recovered or upgraded", "Written off"];
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    fx: { label: null, tickSize: 0, tickPadding: 10, padding: 0.18, tickFormat: (y) => String(oddOrLast(y, M) ? y : "") },
    x: { axis: null, domain: order, padding: 0.08 },
    y: { label: "↑ ₹ lakh crore a year", labelAnchor: "top", labelArrow: false, domain: [0, 7], ticks: [0, 1, 2, 3, 4, 5, 6, 7], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    color: { domain: order, range: [ACC, G2, GOLD] },
    marks: [Plot.gridY([1, 2, 3, 4, 5, 6, 7], { stroke: GRID }), Plot.barY(rows, { fx: "year", x: "group", y: "v", fill: "group" }), Plot.ruleY([0], { stroke: ZERO })],
  });
  host?.append(plot);
  const pkAdd = M.series.all_gross_additions.data.reduce((b, v, i) => (v > b.v ? { v, d: M.dates[i] } : b), { v: -1 });
  const wo = M.series.all_gross_write_offs.data.reduce((a, v, i) => (M.dates[i] >= "2016-03-01" ? a + v : a), 0);
  const L = M.dates.length - 1;
  a11y(plot, "How bad loans were added, recovered and written off, every year since 2004-05", `New bad loans peaked at ₹${pkAdd.v.toFixed(1)} lakh crore in ${+pkAdd.d.slice(0, 4) - 1}-${pkAdd.d.slice(2, 4)}.`);
  setHTML("pv-npaflow", fmt.lc1(wo)); setHTML("ex-nf-pk", fmt.lc1(pkAdd.v)); setHTML("ex-nf-pkd", `${+pkAdd.d.slice(0, 4) - 1}-${pkAdd.d.slice(2, 4)}`); setHTML("ex-nf-wo", fmt.lc1(wo));
  setHTML("ex-nf-yr", `${+M.dates[L].slice(0, 4) - 1}-${M.dates[L].slice(2, 4)}`); setHTML("ex-nf-add", fmt.lc1(M.series.all_gross_additions.data[L])); setHTML("ex-nf-red", fmt.lc1(M.series.all_gross_reductions.data[L])); setHTML("ex-nf-wol", fmt.lc1(M.series.all_gross_write_offs.data[L]));
  setHTML("ex-nf-close", fmt.lc1(M.series.all_gross_closing.data[L]));
  wirePlate("cb-npaflow", plot, "india-atlas_npa-movement", seriesCsv([[M, "all_gross_opening"], [M, "all_gross_additions"], [M, "all_gross_reductions"], [M, "all_gross_write_offs"], [M, "all_gross_closing"]]));
}
{
  const C = crarB;
  const below = C.series.all_below_minimum, L = C.dates.length - 1;
  const n10 = C.series.all_above_10.data[L], b910 = C.series.all_between_9_10.data[L], b9 = C.series.all_below_9.data[L];
  setHTML("ex-cr-n", String(n10 + b910 + b9)); setHTML("ex-cr-b9", b9 === 0 ? "None" : String(b9)); setHTML("ex-cr-yr", `March ${C.dates[L].slice(0, 4)}`);
  const pk = below.data.reduce((b, v, i) => (v != null && C.dates[i] >= "2010-01-01" && v > b.v ? { v, d: C.dates[i] } : b), { v: -1 });
  setHTML("ex-cr-pk", String(pk.v)); setHTML("ex-cr-pkd", `March ${pk.d.slice(0, 4)}`);
}
{
  const F = fraudB;
  const rows = F.dates.flatMap((d, i) => [["Loans", "advances_amount", ACC], ["Everything else", null, G3]].map(([g, k]) => ({ year: d.slice(0, 4), group: g, v: k ? F.series[k].data[i] : F.series.total_amount.data[i] - F.series.advances_amount.data[i] })));
  const host = document.getElementById("plot-frauds");
  const order = ["Everything else", "Loans"];
  const plot = Plot.plot({
    width: W, height: 400, marginLeft: 56, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.25, tickFormat: (y) => String(oddOrLast(y, F) ? y : "") },
    y: { label: "↑ ₹ thousand crore, amount involved", labelAnchor: "top", labelArrow: false, domain: [0, 160000], ticks: [0, 40000, 80000, 120000, 160000], tickSize: 0, tickPadding: 8, tickFormat: (v) => (v / 1000).toFixed(0) },
    color: { domain: order, range: [G3, ACC] },
    marks: [Plot.gridY([40000, 80000, 120000, 160000], { stroke: GRID }), Plot.barY(rows, { x: "year", y: "v", fill: "group", order }), Plot.ruleY([0], { stroke: ZERO })],
  });
  host?.append(plot);
  const L = F.dates.length - 1, pk = F.series.total_amount.data.reduce((b, v, i) => (v > b.v ? { v, d: F.dates[i] } : b), { v: -1 });
  a11y(plot, "Bank frauds by amount, every year since 2004-05", `₹${Math.round(F.series.total_amount.data[L]).toLocaleString("en-IN")} crore in ${+F.dates[L].slice(0, 4) - 1}-${F.dates[L].slice(2, 4)}; the most was ₹${Math.round(pk.v).toLocaleString("en-IN")} crore in ${+pk.d.slice(0, 4) - 1}-${pk.d.slice(2, 4)}.`);
  const fy = (d) => `${+d.slice(0, 4) - 1}-${d.slice(2, 4)}`;
  setHTML("pv-frauds", "₹" + fmt.inr(F.series.total_amount.data[L]) + " crore"); setHTML("ex-fr-amt", "₹" + fmt.inr(F.series.total_amount.data[L]) + " crore"); setHTML("ex-fr-yr", fy(F.dates[L]));
  setHTML("ex-fr-adv", fmt.pct1((100 * F.series.advances_amount.data[L]) / F.series.total_amount.data[L])); setHTML("ex-fr-cards", fmt.pct1((100 * F.series.card_internet_cases.data[L]) / F.series.total_cases.data[L]));
  setHTML("ex-fr-n", fmt.inr(F.series.total_cases.data[L])); setHTML("ex-fr-pk", "₹" + fmt.inr(pk.v) + " crore"); setHTML("ex-fr-pkd", fy(pk.d));
  setHTML("ex-fr-cardamt", fmt.pct1((100 * F.series.card_internet_amount.data[L]) / F.series.total_amount.data[L]));
  wirePlate("cb-frauds", plot, "india-atlas_bank-frauds", seriesCsv(Object.keys(F.series).map((k) => [F, k])));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", growthB.meta.vintage);
setHTML("prov-vintage2", growthB.meta.vintage);
