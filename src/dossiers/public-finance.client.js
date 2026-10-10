// Guide: government budgets and debt (public finance). Plates and number wiring.
// Data: data/series/public-finance-*.json, baked by scripts/lib/products/public-finance.mjs from the
// Data Bank's mirror of RBI DBIE. Read-only from other guides: gdp (none directly; the ratios are baked),
// states-finances (the States guide), rates-borrowing (the Interest rates guide) and
// population-wpp-projection (the Population guide, for the per-person figure).
// Stages are never joined: accounts are lines, the revised estimate and the budget estimate are marks.
// GDP bases are never joined: the RBI's ratios on each base are separate rulers (seamMarks "side"), and
// the back-cast over the NSO's 2011-12 back series is drawn pale (seamMarks "agency").

import * as Plot from "@observablehq/plot";
import cmB from "../../data/series/public-finance-centre-monthly.json";
import gmB from "../../data/series/public-finance-centre-gfd-monthly.json";
import pathB from "../../data/series/public-finance-centre-budget-path.json";
import cdB from "../../data/series/public-finance-centre-deficits.json";
import ceB from "../../data/series/public-finance-centre-expenditure.json";
import crB from "../../data/series/public-finance-centre-receipts.json";
import cfB from "../../data/series/public-finance-centre-financing.json";
import g99B from "../../data/series/public-finance-centre-gdp-b1999.json";
import g04B from "../../data/series/public-finance-centre-gdp-b2004.json";
import g11B from "../../data/series/public-finance-centre-gdp-b2011.json";
import sg11B from "../../data/series/public-finance-allstates-gdp-b2011.json";
import dg11B from "../../data/series/public-finance-combined-debt-gdp-b2011.json";
import backB from "../../data/series/public-finance-ratios-backcast.json";
import r22B from "../../data/series/public-finance-ratios-2022.json";
import sdB from "../../data/series/public-finance-allstates-deficits.json";
import srxB from "../../data/series/public-finance-allstates-receipts.json";
import sxB from "../../data/series/public-finance-allstates-expenditure.json";
import ctaxB from "../../data/series/public-finance-combined-taxes.json";
import ownB from "../../data/series/public-finance-ownership-gsec.json";
import tbB from "../../data/series/public-finance-tbills.json";
import matB from "../../data/series/public-finance-maturity.json";
import ssB from "../../data/series/public-finance-small-savings.json";
import ssrB from "../../data/series/public-finance-small-savings-rates.json";
import wmaB from "../../data/series/public-finance-states-wma.json";
import sfinB from "../../data/series/states-finances.json";
import borrowB from "../../data/series/rates-borrowing.json";
import popB from "../../data/series/population-wpp-projection.json";
import { MONO as sans, a11y, addCrosshair, spark, dodgeEndLabels, downloadSVG, downloadPNG, saveBlob, seamMarks, tint, fmt } from "../charts/plumbing.js";

const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const ACC = "#2E4BD8", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6", GREY = "#878D99";
const W = 1184;
const ML = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MS = ML.map((m) => m.slice(0, 3));
const dt = (iso) => new Date(iso + "T00:00:00Z");
const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7), s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };
const fyD = (d) => fyOf(d.toISOString().slice(0, 10));
const monthOf = (d) => MS[d.getUTCMonth()] + " " + d.getUTCFullYear();
const dayOf = (d) => `${d.getUTCDate()} ${MS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const p1 = fmt.pct1, p2 = fmt.pct2;
const crore = (v) => "₹" + fmt.inr(v) + " crore";
const lc = (v) => "₹" + (v / 1e5).toFixed(2) + " lakh crore";
const lc1 = (v) => "₹" + (v / 1e5).toFixed(1) + " lakh crore";
const rs = (v) => "₹" + v.toFixed(0);
const style = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yearTicks = (a, b, step) => { const t = []; for (let y = a; y <= b; y += step) t.push(new Date(Date.UTC(y, 3, 1))); return t; };
const fyTick = (d) => { const y = d.getUTCFullYear(); return String(y); };
const lastOf = (b, k) => { const d = b.series[k]?.data ?? []; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, date: b.dates[i] }; return null; };
const firstOf = (b, k) => { const d = b.series[k]?.data ?? []; const i = d.findIndex((v) => v != null); return i < 0 ? null : { v: d[i], i, date: b.dates[i] }; };
const atFY = (b, k, fy) => { const i = b.dates.indexOf(`${fy.slice(0, 4)}-04-01`); return i < 0 ? null : b.series[k]?.data[i] ?? null; };
const ST = cdB.meta.stages, SS = sdB.meta.stages;
// a domain that admits every published value, rounded out to whole steps
function span(values, step, floor0 = true) {
  const v = values.filter((x) => x != null && Number.isFinite(x));
  const lo = floor0 ? Math.min(0, Math.floor(Math.min(...v) / step) * step) : Math.floor(Math.min(...v) / step) * step;
  const hi = Math.ceil(Math.max(...v) / step) * step;
  const ticks = []; for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { domain: [lo, hi], ticks };
}
function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  if (!el || !plot) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
const csvOf = (header, rows) => header.join(",") + "\n" + rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");
const put = (id, plot) => { document.getElementById(id)?.append(plot); return plot; };
// a series on a shared annual axis: { date, value } for every financial year on the axis
const onAxis = (axis, map) => axis.map((iso) => ({ date: dt(iso), value: map.get(iso) ?? null }));
const mapOf = (b, k) => new Map(b.dates.map((d, i) => [d, b.series[k]?.data[i] ?? null]).filter(([, v]) => v != null));
const fyAxis = (fromIso, toIso) => { const out = []; for (let y = +fromIso.slice(0, 4); y <= +toIso.slice(0, 4); y++) out.push(`${y}-04-01`); return out; };
// end labels on the right margin, dodged so they never overlap
function endLabels(list, gap, f) {
  const dodged = dodgeEndLabels(list.map((s) => ({ ...s, data: s.end ? [s.end] : s.data })), gap);
  return dodged.map((p) => { const lastPt = (p.s.end ? [p.s.end] : p.s.data).filter((d) => d.value != null).at(-1); return Plot.text([{ date: lastPt.date, value: p.y }], { x: "date", y: "value", text: () => `${p.s.label} ${f(p.value)}`, dx: 12, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: p.s.bold ? 600 : 400 }); });
}
// the revised estimate (filled) and the budget estimate (hollow) of one series, as marks
function stageMarks(points, color) {
  const re = points.filter((p) => p.kind === "re"), be = points.filter((p) => p.kind === "be");
  return [
    Plot.dot(re, { x: "date", y: "value", r: 4, fill: tint(color, 0.35), stroke: "#FFFFFF", strokeWidth: 1.25 }),
    Plot.dot(be, { x: "date", y: "value", r: 4, fill: "#FFFFFF", stroke: color, strokeWidth: 1.75 }),
  ];
}
const stagePts = (b, k) => [["re", `${k}__re`], ["be", `${k}__be`]].map(([kind, key]) => { const o = firstOf(b, key); return o ? { kind, date: dt(o.date), value: o.v } : null; }).filter(Boolean);
// accounts and stage marks on one shared axis, for the crosshair (accounts, then RE, then BE)
const stageLabel = (kind) => (kind === "re" ? "revised estimate" : kind === "be" ? "budget estimate" : "accounts");

/* =================== title block and § 01 =================== */
const ytd = lastOf(cmB, "fiscal_deficit_pct_be"), ytdInr = lastOf(cmB, "fiscal_deficit");
const ytdAgo = cmB.series.fiscal_deficit_pct_be.data[ytd.i - 12];
const lastMonth = ML[+ytd.date.slice(5, 7) - 1];
setHTML("n-ytd", ytd.v.toFixed(1) + pc("%"));
setHTML("d-ytd", `<b>${p1(ytdAgo)}</b> a year earlier, April to ${lastMonth}`);
spark("nspark-ytd", { data: gmB.dates.map((d, i) => ({ date: dt(d), value: gmB.series.gfd_fytd.data[i] })).slice(-87), color: ACC });
const gfdBE = firstOf(g11B, "gross_fiscal_deficit__be").v, gfdRE = firstOf(g11B, "gross_fiscal_deficit__re").v;
setHTML("n-gfd", gfdBE.toFixed(2) + pc("% of GDP"));
setHTML("d-gfd", `<b>${p2(gfdRE)}</b> revised estimate, ${ST.revisedEstimate}`);
const intRRbe = 100 * firstOf(ceB, "interest_payments__be").v / firstOf(crB, "revenue_receipts__be").v;
const intRRacc = 100 * atFY(ceB, "interest_payments", ST.accountsTo) / atFY(crB, "revenue_receipts", ST.accountsTo);
setHTML("n-int", "₹" + intRRbe.toFixed(1));
setHTML("d-int", `budget ${ST.budgetEstimate}; <b>₹${intRRacc.toFixed(1)}</b> in the accounts for ${ST.accountsTo}`);
const debtBE = firstOf(dg11B, "combined_total_liabilities_of_centre_and_states__be").v;
const debtAcc = lastOf(dg11B, "combined_total_liabilities_of_centre_and_states");
setHTML("n-debt", debtBE.toFixed(1) + pc("%"));
setHTML("d-debt", `budgets for ${SS.budgetEstimate}; <b>${p1(debtAcc.v)}</b> in ${fyOf(debtAcc.date)} accounts`);
setHTML("rb-ytd", ytd.v.toFixed(1) + pc("%"));
setHTML("rb-ytd-inr", lc(ytdInr.v));
setHTML("prov-vintage", cmB.meta.vintage);
setHTML("prov-vintage2", cmB.meta.vintage);

/* =================== § 02 lived reality =================== */
{
  const te = firstOf(ceB, "total_expenditure__be").v;
  const per100 = (k) => 100 * firstOf(ceB, k + "__be").v / te;
  const pop = (() => { const y = +ST.budgetEstimate.slice(0, 4); const i = popB.dates.indexOf(`${y}-01-01`); return i < 0 ? null : popB.series.tpopulation1july.data[i] * 1000; })();
  setHTML("lr-te", lc1(te));
  setHTML("lr-pp", pop ? "₹" + fmt.inr(Math.round(te * 1e7 / pop / 100) * 100) : "–");
  setHTML("lr-int", rs(per100("interest_payments")));
  setHTML("lr-def", rs(per100("defence_revenue") + per100("defence_capital")));
  setHTML("lr-sub", rs(per100("subsidies")));
  setHTML("lr-cap", rs(per100("capital_outlay")));
  const ssl = lastOf(ssB, "total__outstanding");
  setHTML("lr-ss", lc1(ssl.v));
  setHTML("lr-ss-when", monthOf(dt(ssl.date)));
  const ppf = lastOf(ssrB, "public_provident_fund_1968"), ssy = lastOf(ssrB, "sukanya_samriddhi_accounts");
  setHTML("lr-ppf", p1(ppf.v));
  setHTML("lr-ssy", p1(ssy.v));
  setHTML("lr-rate-when", dayOf(dt(ppf.date)));
}

/* =================== § 04 the deficit: Centre and states, 1970-71 to the budget =================== */
{
  const axis = fyAxis(backB.dates[0], g11B.dates.at(-1));
  const line = (bk, pk) => { const m = new Map([...mapOf(backB, bk), ...mapOf(pk[0], pk[1])]); return onAxis(axis, m); };
  const centre = line("centre_gross_fiscal_deficit", [g11B, "gross_fiscal_deficit"]);
  const states = line("states_gross_fiscal_deficit", [sg11B, "gross_fiscal_deficit"]);
  const cut = dt(g11B.dates[0]);
  const cSt = stagePts(g11B, "gross_fiscal_deficit"), sSt = stagePts(sg11B, "gross_fiscal_deficit");
  const all = [...centre, ...states, ...cSt, ...sSt].map((d) => d.value);
  const y = span(all, 2);
  const C = { label: "Centre", color: ACC, bold: true, data: centre, end: cSt.at(-1) };
  const S = { label: "States", color: GOLD, data: states, end: sSt.at(-1) };
  const plot = Plot.plot({
    width: W, height: 500, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of GDP", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("agency", [{ data: states, color: GOLD, width: 1.75, reconstructedUntil: cut }, { data: centre, color: ACC, width: 2.25, reconstructedUntil: cut }], { text: "NSO back series of GDP to 2010-11", y: y.domain[1] - 0.6, anchor: "end", at: cut }),
      ...stageMarks(sSt, GOLD), ...stageMarks(cSt, ACC),
      ...endLabels([C, S], 0.7, (v) => p1(v)),
    ],
  });
  a11y(plot, "Gross fiscal deficit of the Centre and the states, per cent of GDP", `Centre ${p2(gfdBE)} budgeted for ${ST.budgetEstimate}; states ${p2(sSt.at(-1).value)} budgeted for ${SS.budgetEstimate}.`);
  put("plot-deficit", plot);
  const cross = [{ label: "Centre", color: ACC, data: axis.map((iso, i) => ({ date: dt(iso), value: centre[i].value ?? cSt.find((p) => +p.date === +dt(iso))?.value ?? null })) },
    { label: "States", color: GOLD, data: axis.map((iso, i) => ({ date: dt(iso), value: states[i].value ?? sSt.find((p) => +p.date === +dt(iso))?.value ?? null })) }];
  addCrosshair(document.getElementById("plot-deficit"), plot, cross, null, (d) => fyD(d), (v) => (v == null ? "—" : p2(v)));
  wirePlate("cb-deficit", plot, "public-finance-deficit", csvOf(["financial_year", "centre_pct_gdp", "centre_stage", "states_pct_gdp", "states_stage", "gdp_ruler"], axis.map((iso, i) => {
    const c = cross[0].data[i].value, s = cross[1].data[i].value, f = fyOf(iso);
    const st = (pts, fy) => pts.find((p) => fyD(p.date) === fy)?.kind;
    return [f, c, c == null ? "" : stageLabel(st(cSt, f)), s, s == null ? "" : stageLabel(st(sSt, f)), iso < g11B.dates[0] ? "NSO back series, 2011-12 base (India Atlas ratio)" : "2011-12 base (RBI)"];
  })));
  setHTML("pv-deficit", p2(gfdBE));
  setHTML("ex-def-acc", p2(atFY(g11B, "gross_fiscal_deficit", ST.accountsTo)));
  setHTML("ex-def-re", p2(gfdRE));
  setHTML("ex-def-be", p2(gfdBE));
  setHTML("ex-def-st", p2(sSt.find((p) => p.kind === "be").value));
}

/* =================== § 04 this year so far, against the budget =================== */
{
  const curFY = fyOf(ytd.date);
  const fys = []; for (let k = 5; k >= 0; k--) { const y = +curFY.slice(0, 4) - k; fys.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`); }
  const rows = fys.map((fy) => ({ fy, pts: cmB.dates.map((d, i) => ({ d, v: cmB.series.fiscal_deficit_pct_be.data[i] })).filter((p) => fyOf(p.d) === fy).map((p) => ({ m: ((+p.d.slice(5, 7) + 8) % 12) + 1, value: p.v, fy })) }));
  const flat = rows.flatMap((r) => r.pts);
  const y = span(flat.map((p) => p.value), 20);
  const cur = rows.at(-1);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 120, marginTop: 28, marginBottom: 34, style,
    x: { label: null, domain: [1, 12], ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], tickSize: 0, tickPadding: 10, tickFormat: (m) => MS[(m + 2) % 12] },
    y: { label: "per cent of the year's budget estimate", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }), Plot.ruleY([100], { stroke: G2, strokeDasharray: "3,3" }),
      Plot.text([{ m: 1, value: 100 }], { x: "m", y: "value", text: ["The whole year's budgeted deficit"], dy: -8, textAnchor: "start", fill: G1, fontSize: 12 }),
      ...rows.slice(0, -1).map((r) => Plot.lineY(r.pts, { x: "m", y: "value", stroke: G3, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...rows.slice(0, -1).map((r) => Plot.text(r.pts.slice(-1), { x: "m", y: "value", text: () => r.fy, dx: 8, textAnchor: "start", fill: G1, fontSize: 11.5 })),
      Plot.lineY(cur.pts, { x: "m", y: "value", stroke: ACC, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(cur.pts.slice(-1), { x: "m", y: "value", r: 3.5, fill: ACC, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text(cur.pts.slice(-1), { x: "m", y: "value", text: (d) => `${cur.fy} ${p1(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: 600 }),
    ],
  });
  a11y(plot, "The Centre's deficit from April to each month as a share of the year's budget", `${curFY}: ${p1(ytd.v)} by ${lastMonth}; a year earlier ${p1(ytdAgo)}.`);
  put("plot-ytd", plot);
  wirePlate("cb-ytd", plot, "public-finance-deficit-so-far", csvOf(["financial_year", "month", "fiscal_deficit_pct_of_budget_estimate"], flat.map((p) => [p.fy, MS[(p.m + 2) % 12], p.value])));
  setHTML("pv-ytd", p1(ytd.v));
  setHTML("ex-ytd-inr", lc(ytdInr.v));
  setHTML("ex-ytd-pct", p1(ytd.v));
  setHTML("ex-ytd-ago", p1(ytdAgo));
  setHTML("ex-ytd-tax", p1(lastOf(cmB, "tax_revenue_net_pct_be").v));
  setHTML("ex-ytd-cap", p1(lastOf(cmB, "capital_expenditure_pct_be").v));
}

/* =================== § 04 budget, revised, accounts: every year =================== */
{
  const P = pathB, k = "fiscal_deficit";
  const rows = P.dates.map((d, i) => ({ date: dt(d), fy: fyOf(d), be: P.series[k + "__be"].data[i], re: P.series[k + "__re"].data[i], pr: P.series[k + "__provisional"].data[i] }));
  const L = (v) => (v == null ? null : v / 1e5);
  const y = span(rows.flatMap((r) => [L(r.be), L(r.re), L(r.pr)]), 4);
  const segs = rows.filter((r) => r.be != null && (r.pr ?? r.re) != null);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 40, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2000, +P.dates.at(-1).slice(0, 4), 2), tickFormat: fyTick },
    y: { label: "₹ lakh crore", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleX(segs, { x: "date", y1: (r) => L(r.be), y2: (r) => L(r.pr ?? r.re), stroke: G3, strokeWidth: 1.5 }),
      Plot.dot(rows.filter((r) => r.be != null), { x: "date", y: (r) => L(r.be), r: 4.5, fill: "#FFFFFF", stroke: GREY, strokeWidth: 1.75 }),
      Plot.dot(rows.filter((r) => r.re != null), { x: "date", y: (r) => L(r.re), r: 3.5, fill: GOLD, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot(rows.filter((r) => r.pr != null), { x: "date", y: (r) => L(r.pr), r: 4, fill: ACC, stroke: "#FFFFFF", strokeWidth: 1.25 }),
    ],
  });
  const lastPr = [...rows].reverse().find((r) => r.pr != null);
  a11y(plot, "The Centre's fiscal deficit each year: budget estimate, revised estimate and provisional accounts", `${lastPr.fy}: budgeted ${lc1(lastPr.be)}, revised ${lc1(lastPr.re)}, provisional accounts ${lc1(lastPr.pr)}.`);
  put("plot-path", plot);
  addCrosshair(document.getElementById("plot-path"), plot, [
    { label: "Budget estimate", color: GREY, data: rows.map((r) => ({ date: r.date, value: L(r.be) })) },
    { label: "Revised estimate", color: GOLD, data: rows.map((r) => ({ date: r.date, value: L(r.re) })) },
    { label: "Provisional accounts", color: ACC, data: rows.map((r) => ({ date: r.date, value: L(r.pr) })) }], null, (d) => fyD(d), (v) => (v == null ? "—" : "₹" + v.toFixed(2) + " lakh crore"));
  wirePlate("cb-path", plot, "public-finance-budget-path", csvOf(["financial_year", "budget_estimate_inr_crore", "revised_estimate_inr_crore", "provisional_accounts_inr_crore"], rows.map((r) => [r.fy, r.be, r.re, r.pr])));
  const miss = (r) => (r.pr - r.be) / r.be * 100;
  setHTML("pv-path", (miss(lastPr) < 0 ? "−" : "+") + Math.abs(miss(lastPr)).toFixed(1) + pc("%"));
  setHTML("ex-path-be", lc1(lastPr.be));
  setHTML("ex-path-re", lc1(lastPr.re));
  setHTML("ex-path-pr", lc1(lastPr.pr));
  const worst = rows.filter((r) => r.be != null && r.pr != null).sort((a, b) => miss(b) - miss(a))[0];
  setHTML("ex-path-max", `${worst.fy}, ${Math.round(miss(worst))}% above the budget`);
}

/* =================== § 04 how the deficit is paid for =================== */
{
  const b = cfB, axis = b.dates;
  const share = (k) => axis.map((d, i) => { const g = b.series.gross_fiscal_deficit.data[i], v = b.series[k]?.data[i]; return { date: dt(d), value: g && v != null ? 100 * v / g : null }; });
  const stShare = (k) => [["re", `${k}__re`, "gross_fiscal_deficit__re"], ["be", `${k}__be`, "gross_fiscal_deficit__be"]].map(([kind, kk, gk]) => { const v = firstOf(b, kk), g = firstOf(b, gk); return v && g ? { kind, date: dt(v.date), value: 100 * v.v / g.v } : null; }).filter(Boolean);
  const L = [["market_borrowings", "Market borrowing", ACC, 2.25, true], ["other_borrowings", "Other borrowing", GOLD, 1.75], ["external_finance", "External finance", GREY, 1.5], ["drawdown_of_cash_balances", "Cash", G3, 1.5]];
  const lines = L.map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: share(k), st: stShare(k) }));
  const y = span(lines.flatMap((l) => [...l.data.map((d) => d.value), ...l.st.map((d) => d.value)]), 20);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 190, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1980, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of the gross fiscal deficit", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...lines.flatMap((l) => stageMarks(l.st, l.color)),
      ...endLabels(lines.map((l) => ({ ...l, end: l.st.at(-1) })), 6, (v) => fmt.pct0(v)),
    ],
  });
  const mbBE = lines[0].st.find((p) => p.kind === "be").value;
  a11y(plot, "How the Centre's deficit is financed, per cent", `Market borrowing ${fmt.pct0(mbBE)} of the budgeted deficit for ${ST.budgetEstimate}.`);
  put("plot-financing", plot);
  addCrosshair(document.getElementById("plot-financing"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-financing", plot, "public-finance-financing", csvOf(["financial_year", ...lines.map((l) => l.k + "_pct_of_gfd")], axis.map((d, i) => [fyOf(d), ...lines.map((l) => (l.data[i].value == null ? "" : l.data[i].value.toFixed(2)))])));
  setHTML("pv-financing", fmt.pct0(mbBE));
  setHTML("ex-fin-acc", fmt.pct0(lines[0].data[b.dates.indexOf(`${ST.accountsTo.slice(0, 4)}-04-01`)].value));
  setHTML("ex-fin-be", fmt.pct0(mbBE));
  const bl = borrowB.dates.length - 1;
  setHTML("ex-fin-gross", lc1(borrowB.series.centre_gross.data[bl] + borrowB.series.states_gross.data[bl]));
}

/* =================== § 05 the Centre's taxes =================== */
{
  const b = crB, axis = b.dates.filter((d) => d <= `${ST.accountsTo.slice(0, 4)}-04-01`);
  const share = (k) => axis.map((d) => { const i = b.dates.indexOf(d); const t = b.series.tax_revenue_net.data[i], v = b.series[k]?.data[i]; return { date: dt(d), value: t && v != null ? 100 * v / t : null }; });
  const T = [["personal_income_tax", "Income tax", ACC, 2.25, true], ["corporation_tax", "Corporation tax", GOLD, 1.75], ["gst", "GST", INK, 1.75], ["excise_duties", "Excise", GREY, 1.5], ["customs_duties", "Customs", G3, 1.5]];
  const lines = T.map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: share(k) }));
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 10);
  const gstAt = dt("2017-04-01");
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, +ST.accountsTo.slice(0, 4), 5), tickFormat: fyTick },
    y: { label: "per cent of the Centre's net tax revenue", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleX([gstAt], { stroke: G3, strokeDasharray: "2,3" }),
      Plot.text([{ date: gstAt, value: y.domain[1] - 2 }], { x: "date", y: "value", text: ["GST, July 2017"], dx: -8, textAnchor: "end", fill: G1, fontSize: 12 }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...endLabels(lines, 3, (v) => fmt.pct0(v)),
    ],
  });
  const sh = (k) => lines.find((l) => l.k === k).data.at(-1).value;
  a11y(plot, "Each tax's share of the Centre's net tax revenue", `${ST.accountsTo}: income tax ${fmt.pct0(sh("personal_income_tax"))}, corporation tax ${fmt.pct0(sh("corporation_tax"))}, GST ${fmt.pct0(sh("gst"))}.`);
  put("plot-taxmix", plot);
  addCrosshair(document.getElementById("plot-taxmix"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-taxmix", plot, "public-finance-centre-taxes", csvOf(["financial_year", ...lines.map((l) => l.k + "_pct_of_net_tax")], axis.map((d, i) => [fyOf(d), ...lines.map((l) => (l.data[i].value == null ? "" : l.data[i].value.toFixed(2)))])));
  const top = [...lines].sort((a, b2) => b2.data.at(-1).value - a.data.at(-1).value)[0];
  setHTML("pv-taxmix", fmt.pct0(top.data.at(-1).value));
  setHTML("ex-tax-pit", fmt.pct0(sh("personal_income_tax")));
  setHTML("ex-tax-cit", fmt.pct0(sh("corporation_tax")));
  setHTML("ex-tax-gst", fmt.pct0(sh("gst")));
  setHTML("ex-tax-exc", fmt.pct0(sh("excise_duties")));
  setHTML("ex-tax-cus", fmt.pct0(sh("customs_duties")));
}
{
  // gross direct and indirect taxes, per cent of GDP, on three GDP rulers (never joined)
  const ruler = (b, k) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k]?.data[i] ?? null }));
  const R = [g99B, g04B, g11B];
  const dir = R.map((b) => ruler(b, "gross_direct_tax")), ind = R.map((b) => ruler(b, "gross_indirect_tax"));
  const y = span([...dir.flat(), ...ind.flat()].map((d) => d.value), 2);
  const stD = stagePts(g11B, "gross_direct_tax"), stI = stagePts(g11B, "gross_indirect_tax");
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of GDP", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("side", ind.map((data) => ({ data, color: GREY, width: 1.75 })), { text: "2004-05 base", y: y.domain[1] - 0.5, at: dt(g04B.dates[0]) }),
      ...seamMarks("side", dir.map((data) => ({ data, color: ACC, width: 2.25 })), { text: "2011-12 base", y: y.domain[1] - 0.5, at: dt(g11B.dates[0]) }),
      ...stageMarks(stI, GREY), ...stageMarks(stD, ACC),
      ...endLabels([{ label: "Direct", color: ACC, bold: true, data: dir[2], end: stD.at(-1) }, { label: "Indirect", color: GREY, data: ind[2], end: stI.at(-1) }], 0.6, (v) => p1(v)),
    ],
  });
  const dAcc = atFY(g11B, "gross_direct_tax", ST.accountsTo), iAcc = atFY(g11B, "gross_indirect_tax", ST.accountsTo);
  a11y(plot, "The Centre's gross direct and indirect taxes, per cent of GDP, on three GDP series", `${ST.accountsTo}: direct ${p1(dAcc)}, indirect ${p1(iAcc)}.`);
  put("plot-taxgdp", plot);
  const flat = (rs) => { const m = new Map(); rs.flat().forEach((d) => { if (d.value != null) m.set(+d.date, d.value); }); return m; };
  const axis = [...new Set([...dir.flat()].map((d) => +d.date))].sort((a, c) => a - c);
  const dm = flat(dir), im = flat(ind);
  addCrosshair(document.getElementById("plot-taxgdp"), plot, [{ label: "Direct", color: ACC, data: axis.map((t) => ({ date: new Date(t), value: dm.get(t) ?? null })) }, { label: "Indirect", color: GREY, data: axis.map((t) => ({ date: new Date(t), value: im.get(t) ?? null })) }], null, (d) => fyD(d), (v) => (v == null ? "—" : p2(v)));
  wirePlate("cb-taxgdp", plot, "public-finance-taxes-gdp", csvOf(["financial_year", "gross_direct_tax_pct_gdp", "gross_indirect_tax_pct_gdp", "gdp_series"], axis.map((t) => { const iso = new Date(t).toISOString().slice(0, 10); return [fyOf(iso), dm.get(t), im.get(t), iso < g04B.dates[0] ? "1999-2000 base" : iso < g11B.dates[0] ? "2004-05 base" : "2011-12 base"]; })));
  setHTML("pv-taxgdp", p1(dAcc));
  setHTML("ex-tg-dir", p2(dAcc));
  setHTML("ex-tg-ind", p2(iAcc));
  setHTML("ex-tg-be", p2(firstOf(g11B, "total_gross_tax__be").v));
}
{
  const b = ctaxB;
  const data = b.dates.map((d, i) => { const c = b.series.centre_total.data[i], s = b.series.states_total.data[i]; return { date: dt(d), value: c != null && s != null ? 100 * s / (c + s) : null }; });
  const y = span(data.map((d) => d.value), 10);
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 44, marginRight: 120, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1980, 2025, 5), tickFormat: fyTick },
    y: { label: "states' share of all taxes collected, per cent", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...endLabels([{ label: "States", color: ACC, bold: true, data }], 1, (v) => p1(v)),
    ],
  });
  const last = data.filter((d) => d.value != null).at(-1);
  a11y(plot, "The states' share of all taxes collected by India's governments", `${fyD(last.date)}: ${p1(last.value)}.`);
  put("plot-taxwho", plot);
  addCrosshair(document.getElementById("plot-taxwho"), plot, [{ label: "States' share", color: ACC, data }], null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-taxwho", plot, "public-finance-who-collects", csvOf(["financial_year", "centre_gross_taxes_inr_crore", "states_own_taxes_inr_crore", "states_share_pct"], b.dates.map((d, i) => [fyOf(d), b.series.centre_total.data[i], b.series.states_total.data[i], data[i].value == null ? "" : data[i].value.toFixed(2)])));
  setHTML("pv-taxwho", p1(last.value));
  setHTML("ex-tw-st", lc1(atFY(b, "states_total", SS.accountsTo)));
  setHTML("ex-tw-c", lc1(atFY(b, "centre_total", SS.accountsTo)));
}

/* =================== § 06 every ₹100 the Centre spends =================== */
{
  const b = ceB;
  const parts = (get) => {
    const te = get("total_expenditure"), int = get("interest_payments"), dr = get("defence_revenue"), dc = get("defence_capital"), sub = get("subsidies"), re = get("revenue_expenditure"), co = get("capital_outlay"), la = get("loans_and_advances");
    return [["Interest", int], ["Defence", dr + dc], ["Subsidies", sub], ["Other day-to-day spending", re - int - dr - sub], ["Capital outlay", co - dc], ["Loans", la]].map(([k, v]) => ({ k, v: 100 * v / te }));
  };
  const years = [["2004-05", (k) => atFY(b, k, "2004-05")], [ST.accountsTo, (k) => atFY(b, k, ST.accountsTo)], [`${ST.budgetEstimate} budget`, (k) => firstOf(b, k + "__be").v]];
  const rows = years.flatMap(([yl, get]) => { let x0 = 0; return parts(get).map((p) => { const r = { year: yl, part: p.k, x1: x0, x2: x0 + p.v, v: p.v }; x0 += p.v; return r; }); });
  const COL = { Interest: ACC, Defence: "#7F8FE6", Subsidies: GOLD, "Other day-to-day spending": "#E3E6EC", "Capital outlay": "#9AA9EE", Loans: G3 };
  const plot = Plot.plot({
    width: W, height: 300, marginLeft: 150, marginRight: 30, marginTop: 34, marginBottom: 30, style,
    x: { label: "per ₹100 of total expenditure", labelAnchor: "right", domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickSize: 0, tickFormat: (v) => String(v) },
    y: { label: null, domain: years.map((y) => y[0]), tickSize: 0, padding: 0.28 },
    marks: [
      Plot.barX(rows, { x1: "x1", x2: "x2", y: "year", fill: (d) => COL[d.part], stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text(rows.filter((d) => d.v >= 5.5), { x: (d) => (d.x1 + d.x2) / 2, y: "year", text: (d) => `${d.part === "Other day-to-day spending" ? "Other" : d.part} ₹${Math.round(d.v)}`, fill: (d) => (d.part === "Interest" ? "#FFFFFF" : INK), fontSize: 11.5, fontWeight: (d) => (d.part === "Interest" ? 600 : 400) }),
    ],
  });
  const be = parts((k) => firstOf(b, k + "__be").v);
  a11y(plot, "Every ₹100 the Centre spends, by head", `${ST.budgetEstimate} budget: interest ₹${Math.round(be[0].v)}, defence ₹${Math.round(be[1].v)}, subsidies ₹${Math.round(be[2].v)}.`);
  put("plot-spend", plot);
  wirePlate("cb-spend", plot, "public-finance-every-100-rupees", csvOf(["year", "head", "per_100_rupees"], rows.map((r) => [r.year, r.part, r.v.toFixed(2)])));
  setHTML("pv-spend", "₹" + be[0].v.toFixed(1));
  setHTML("ex-sp-int", "₹" + be[0].v.toFixed(1));
  setHTML("ex-sp-def", "₹" + be[1].v.toFixed(1));
  setHTML("ex-sp-sub", "₹" + be[2].v.toFixed(1));
  setHTML("ex-sp-cap", "₹" + be[4].v.toFixed(1));
}
{
  // interest per ₹100 of revenue receipts, the Centre and the states
  const ratio = (eb, ek, rb, rk) => eb.dates.map((d, i) => { const j = rb.dates.indexOf(d); const e = eb.series[ek].data[i], r = j < 0 ? null : rb.series[rk].data[j]; return { date: dt(d), value: e != null && r ? 100 * e / r : null }; });
  const stage = (eb, ek, rb, rk) => ["re", "be"].map((kind) => { const e = firstOf(eb, `${ek}__${kind}`), r = firstOf(rb, `${rk}__${kind}`); return e && r ? { kind, date: dt(e.date), value: 100 * e.v / r.v } : null; }).filter(Boolean);
  const c = ratio(ceB, "interest_payments", crB, "revenue_receipts"), s = ratio(sxB, "interest_payments", srxB, "total_revenue_receipts");
  const cS = stage(ceB, "interest_payments", crB, "revenue_receipts"), sS = stage(sxB, "interest_payments", srxB, "total_revenue_receipts");
  const y = span([...c, ...s, ...cS, ...sS].map((d) => d.value), 10);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 150, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "interest per ₹100 of revenue receipts", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(s, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(c, { x: "date", y: "value", stroke: ACC, strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...stageMarks(sS, GOLD), ...stageMarks(cS, ACC),
      ...endLabels([{ label: "Centre", color: ACC, bold: true, data: c, end: cS.at(-1) }, { label: "States", color: GOLD, data: s, end: sS.at(-1) }], 3, (v) => "₹" + v.toFixed(0)),
    ],
  });
  const cbe = cS.find((p) => p.kind === "be").value;
  a11y(plot, "Interest per ₹100 of revenue receipts, the Centre and the states", `Centre ₹${cbe.toFixed(0)} budgeted for ${ST.budgetEstimate}.`);
  put("plot-interest", plot);
  addCrosshair(document.getElementById("plot-interest"), plot, [{ label: "Centre", color: ACC, data: c }, { label: "States", color: GOLD, data: ceB.dates.map((d) => ({ date: dt(d), value: s.find((p) => +p.date === +dt(d))?.value ?? null })) }], null, (d) => fyD(d), (v) => (v == null ? "—" : "₹" + v.toFixed(1)));
  wirePlate("cb-interest", plot, "public-finance-interest-burden", csvOf(["financial_year", "centre_interest_per_100_revenue", "states_interest_per_100_revenue"], ceB.dates.map((d, i) => [fyOf(d), c[i].value == null ? "" : c[i].value.toFixed(2), s.find((p) => +p.date === +dt(d))?.value?.toFixed(2) ?? ""])));
  setHTML("pv-interest", "₹" + cbe.toFixed(1));
  setHTML("ex-int-acc", "₹" + c.find((p) => fyD(p.date) === ST.accountsTo).value.toFixed(1));
  setHTML("ex-int-be", "₹" + cbe.toFixed(1));
  setHTML("ex-int-st", "₹" + s.find((p) => fyD(p.date) === SS.accountsTo).value.toFixed(1));
}
{
  const b = g11B, L = (k) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k].data[i] }));
  const cap = L("capital_expenditure"), int = L("interest_payments"), cS = stagePts(b, "capital_expenditure"), iS = stagePts(b, "interest_payments");
  const y = span([...cap, ...int, ...cS, ...iS].map((d) => d.value), 1);
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 44, marginRight: 190, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2011, +b.dates.at(-1).slice(0, 4), 1), tickFormat: fyTick },
    y: { label: "per cent of GDP", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(int, { x: "date", y: "value", stroke: GREY, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(cap, { x: "date", y: "value", stroke: ACC, strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...stageMarks(iS, GREY), ...stageMarks(cS, ACC),
      ...endLabels([{ label: "Capital spending", color: ACC, bold: true, data: cap, end: cS.at(-1) }, { label: "Interest", color: GREY, data: int, end: iS.at(-1) }], 0.25, (v) => p1(v)),
    ],
  });
  a11y(plot, "The Centre's capital expenditure and interest payments, per cent of GDP", `${ST.budgetEstimate} budget: capital ${p2(cS.at(-1).value)}, interest ${p2(iS.at(-1).value)}.`);
  put("plot-capex", plot);
  addCrosshair(document.getElementById("plot-capex"), plot, [{ label: "Capital spending", color: ACC, data: cap }, { label: "Interest", color: GREY, data: int }], null, (d) => fyD(d), (v) => (v == null ? "—" : p2(v)));
  wirePlate("cb-capex", plot, "public-finance-capital-and-interest", csvOf(["financial_year", "capital_expenditure_pct_gdp", "interest_payments_pct_gdp", "stage"], b.dates.map((d, i) => [fyOf(d), b.series.capital_expenditure.data[i] ?? b.series.capital_expenditure__re.data[i] ?? b.series.capital_expenditure__be.data[i], b.series.interest_payments.data[i] ?? b.series.interest_payments__re.data[i] ?? b.series.interest_payments__be.data[i], fyOf(d) === ST.revisedEstimate ? "revised estimate" : fyOf(d) === ST.budgetEstimate ? "budget estimate" : "accounts"])));
  setHTML("pv-capex", p2(cS.at(-1).value));
  setHTML("ex-cap-acc", p2(atFY(b, "capital_expenditure", ST.accountsTo)));
  setHTML("ex-cap-int", p2(atFY(b, "interest_payments", ST.accountsTo)));
}

/* =================== § 07 debt =================== */
{
  const axis = fyAxis(backB.dates[backB.series.combined_liabilities.data.findIndex((v) => v != null)], dg11B.dates.at(-1));
  const line = (bk, pk) => onAxis(axis, new Map([...mapOf(backB, bk), ...mapOf(dg11B, pk)]));
  const comb = line("combined_liabilities", "combined_total_liabilities_of_centre_and_states");
  const cen = line("centre_liabilities", "total_liabilities_of_the_centre");
  const sta = line("states_liabilities", "total_liabilities_of_the_states");
  const cut = dt(dg11B.dates[0]);
  const st = (k) => stagePts(dg11B, k);
  const y = span([...comb, ...cen, ...sta, ...st("combined_total_liabilities_of_centre_and_states")].map((d) => d.value), 20);
  const plot = Plot.plot({
    width: W, height: 500, marginLeft: 44, marginRight: 190, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1980, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of GDP", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("agency", [{ data: sta, color: GOLD, width: 1.5, reconstructedUntil: cut }, { data: cen, color: INK, width: 1.5, reconstructedUntil: cut }, { data: comb, color: ACC, width: 2.25, reconstructedUntil: cut }], { text: "NSO back series of GDP to 2010-11", y: y.domain[1] - 4, anchor: "end", at: cut }),
      ...stageMarks(st("total_liabilities_of_the_states"), GOLD), ...stageMarks(st("total_liabilities_of_the_centre"), INK), ...stageMarks(st("combined_total_liabilities_of_centre_and_states"), ACC),
      ...endLabels([{ label: "Centre and states", color: ACC, bold: true, data: comb, end: st("combined_total_liabilities_of_centre_and_states").at(-1) }, { label: "Centre", color: INK, data: cen, end: st("total_liabilities_of_the_centre").at(-1) }, { label: "States", color: GOLD, data: sta, end: st("total_liabilities_of_the_states").at(-1) }], 4, (v) => fmt.pct0(v)),
    ],
  });
  a11y(plot, "What India's governments owe, per cent of GDP", `Centre and states ${p1(debtBE)} by the budgets for ${SS.budgetEstimate}.`);
  put("plot-debt", plot);
  addCrosshair(document.getElementById("plot-debt"), plot, [{ label: "Centre and states", color: ACC, data: comb }, { label: "Centre", color: INK, data: cen }, { label: "States", color: GOLD, data: sta }], null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-debt", plot, "public-finance-debt", csvOf(["financial_year", "centre_and_states_pct_gdp", "centre_pct_gdp", "states_pct_gdp", "gdp_ruler"], axis.map((iso, i) => [fyOf(iso), comb[i].value, cen[i].value, sta[i].value, iso < dg11B.dates[0] ? "NSO back series, 2011-12 base (India Atlas ratio)" : "2011-12 base (RBI)"])));
  setHTML("pv-debt", p1(debtBE));
  setHTML("ex-debt-acc", p1(atFY(dg11B, "combined_total_liabilities_of_centre_and_states", SS.accountsTo)));
  setHTML("ex-debt-c", p1(firstOf(dg11B, "total_liabilities_of_the_centre__be").v));
  setHTML("ex-debt-s", p1(firstOf(dg11B, "total_liabilities_of_the_states__be").v));
}
{
  const b = ownB;
  const H = [["commercial_banks", "Banks", ACC, 2.25, true], ["insurance_companies", "Insurers", GOLD, 1.75], ["rbi", "RBI", INK, 1.75], ["provident_funds", "Provident funds", GREY, 1.5], ["pension_funds", "Pension funds", G2, 1.5], ["foreign_portfolio_investors", "Foreign investors", G2, 1.5], ["mutual_funds", "Mutual funds", G3, 1.25]];
  const lines = H.map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: b.dates.map((d, i) => ({ date: dt(d), value: b.series[k]?.data[i] ?? null })) }));
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 10);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 190, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2007, 2026, 2), tickFormat: fyTick },
    y: { label: "per cent of the Centre's bonds outstanding", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...endLabels(lines, 2.4, (v) => p1(v)),
    ],
  });
  const at = (k) => b.series[k].data.at(-1);
  a11y(plot, "Who holds the Centre's dated securities", `${monthOf(dt(b.dates.at(-1)))}: banks ${p1(at("commercial_banks"))}, insurers ${p1(at("insurance_companies"))}, RBI ${p1(at("rbi"))}.`);
  put("plot-holders", plot);
  addCrosshair(document.getElementById("plot-holders"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => monthOf(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-holders", plot, "public-finance-who-holds-the-debt", csvOf(["quarter_end", ...lines.map((l) => l.k + "_pct"), "total_outstanding_inr_crore"], b.dates.map((d, i) => [d.slice(0, 7), ...lines.map((l) => l.data[i].value ?? ""), b.series.total.data[i]])));
  setHTML("pv-holders", lc1(at("total")));
  setHTML("ex-h-total", lc1(at("total")));
  setHTML("ex-h-pf", p1(at("provident_funds") + at("pension_funds")));
  setHTML("ex-h-fpi", p1(at("foreign_portfolio_investors")));
  setHTML("ex-h-mf", p1(at("mutual_funds")));
}
{
  const b = tbB, L = (k) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k]?.data[i] == null ? null : b.series[k].data[i] / 1e5 }));
  const lines = [["t364__total", "364-day", ACC, 2.25, true], ["t182__total", "182-day", GOLD, 1.75], ["t91__total", "91-day", INK, 1.75], ["cmb__total", "Cash management", G2, 1.5]].map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: L(k) }));
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 1);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2006, 2026, 2).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 0, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "₹ lakh crore outstanding", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...endLabels(lines.filter((l) => l.data.at(-1).value != null), 0.25, (v) => "₹" + v.toFixed(2) + " lakh cr"),
    ],
  });
  const last = (k) => b.series[k].data.at(-1);
  const total = ["t91__total", "t182__total", "t364__total"].reduce((a, k) => a + (last(k) ?? 0), 0) + (last("cmb__total") ?? 0);
  a11y(plot, "Treasury bills outstanding by tenor, every week", `${dayOf(dt(b.dates.at(-1)))}: ${lc(total)} in all.`);
  put("plot-tbills", plot);
  addCrosshair(document.getElementById("plot-tbills"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => dayOf(d), (v) => (v == null ? "—" : "₹" + v.toFixed(2) + " lakh crore"));
  wirePlate("cb-tbills", plot, "public-finance-treasury-bills", csvOf(["week_ended", ...lines.map((l) => l.k.replace("__total", "_inr_crore"))], b.dates.map((d, i) => [d, ...lines.map((l) => b.series[l.k].data[i] ?? "")])));
  setHTML("pv-tbills", lc(total));
  setHTML("ex-tb-364", lc(last("t364__total")));
  setHTML("ex-tb-182", lc(last("t182__total")));
  setHTML("ex-tb-91", lc(last("t91__total")));
  setHTML("ex-tb-st", fmt.pct0(100 * last("t91__state_governments") / last("t91__total")));
}
{
  const b = matB, sh = (k) => b.dates.map((d, i) => ({ date: dt(d), value: b.series.total_amount.data[i] ? 100 * (b.series[k].data[i] ?? 0) / b.series.total_amount.data[i] : null }));
  const lines = [["over_10_years", "After 10 years", ACC, 2.25, true], ["between_5_and_10_years", "5 to 10 years", GOLD, 1.75], ["under_5_years", "Within 5 years", GREY, 1.75]].map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: sh(k) }));
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 10);
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of dated securities outstanding", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...endLabels(lines, 3, (v) => fmt.pct0(v)),
    ],
  });
  const n = b.dates.length - 1;
  a11y(plot, "When the Centre's dated securities fall due", `End-March ${+b.dates[n].slice(0, 4) + 1}: ${fmt.pct0(lines[0].data[n].value)} after ten years.`);
  put("plot-maturity", plot);
  addCrosshair(document.getElementById("plot-maturity"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-maturity", plot, "public-finance-maturity", csvOf(["financial_year", ...lines.map((l) => l.k + "_pct"), "total_inr_crore"], b.dates.map((d, i) => [fyOf(d), ...lines.map((l) => (l.data[i].value == null ? "" : l.data[i].value.toFixed(2))), b.series.total_amount.data[i]])));
  setHTML("pv-maturity", lc1(b.series.total_amount.data[n]));
  setHTML("ex-mat-total", lc1(b.series.total_amount.data[n]));
  setHTML("ex-mat-5", fmt.pct0(lines[2].data[n].value));
}
{
  const b = ssB;
  const schemes = Object.keys(b.series).filter((k) => k.endsWith("__outstanding") && !/^(total|total_deposits|total_certificates)__/.test(k));
  const lastV = (k) => lastOf(b, k)?.v ?? 0;
  const top = schemes.filter((k) => lastOf(b, k)?.date === b.dates.at(-1)).sort((a, c) => lastV(c) - lastV(a)).slice(0, 6);
  const L = (k) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k].data[i] == null ? null : b.series[k].data[i] / 1e5 }));
  const nm = (k) => b.series[k].label.split(":")[0];
  const lines = [{ k: "total__outstanding", label: "All schemes", color: ACC, width: 2.25, bold: true, data: L("total__outstanding") }, ...top.map((k) => ({ k, label: nm(k), color: G2, width: 1.25, data: L(k) }))];
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 5);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 260, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1992, 2025, 4).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 0, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "₹ lakh crore outstanding", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.slice(1).map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      Plot.lineY(lines[0].data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...endLabels(lines, 0.9, (v) => "₹" + v.toFixed(1) + " lakh cr"),
    ],
  });
  const tot = lastOf(b, "total__outstanding");
  a11y(plot, "Small savings outstanding by scheme", `${monthOf(dt(tot.date))}: ${lc1(tot.v)} in all.`);
  put("plot-savings", plot);
  addCrosshair(document.getElementById("plot-savings"), plot, lines.map((l) => ({ label: l.label, color: l.color === G2 ? G1 : l.color, data: l.data })), null, (d) => monthOf(d), (v) => (v == null ? "—" : "₹" + v.toFixed(2) + " lakh crore"));
  wirePlate("cb-savings", plot, "public-finance-small-savings", csvOf(["month", ...lines.map((l) => l.k.replace("__outstanding", "_outstanding_inr_crore"))], b.dates.map((d, i) => [d.slice(0, 7), ...lines.map((l) => b.series[l.k].data[i] ?? "")])));
  setHTML("pv-savings", lc1(tot.v));
  setHTML("ex-sv-1", `${nm(top[0])} (${lc1(lastV(top[0]))})`);
  setHTML("ex-sv-2", `${nm(top[1])} (${lc1(lastV(top[1]))})`);
  const scss = lastOf(ssrB, "senior_citizens_saving_scheme"), posb = lastOf(ssrB, "post_office_savings_bank_accounts");
  setHTML("ex-sv-when", dayOf(dt(scss.date)));
  setHTML("ex-sv-scss", p1(scss.v));
  setHTML("ex-sv-posb", p1(posb.v));
}

/* =================== § 08 the states =================== */
{
  const b = srxB, axis = b.dates.filter((d) => d <= `${SS.accountsTo.slice(0, 4)}-04-01`);
  const share = (k) => axis.map((d) => { const i = b.dates.indexOf(d); const t = b.series.total_revenue_receipts.data[i], v = b.series[k]?.data[i]; return { date: dt(d), value: t && v != null ? 100 * v / t : null }; });
  const lines = [["tax_receipts", "Own taxes", ACC, 2.25, true], ["share_in_central_taxes", "Share in central taxes", GOLD, 1.75], ["grants_from_the_centre", "Grants from the Centre", INK, 1.75], ["non_tax_receipts", "Non-tax revenue", G2, 1.5]].map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: share(k) }));
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 10);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 230, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of the states' revenue receipts", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...endLabels(lines, 3, (v) => fmt.pct0(v)),
    ],
  });
  const sh = (k) => lines.find((l) => l.k === k).data.at(-1).value;
  a11y(plot, "The states' revenue by source", `${SS.accountsTo}: own taxes ${fmt.pct0(sh("tax_receipts"))}, share in central taxes ${fmt.pct0(sh("share_in_central_taxes"))}, grants ${fmt.pct0(sh("grants_from_the_centre"))}.`);
  put("plot-st-receipts", plot);
  addCrosshair(document.getElementById("plot-st-receipts"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-st-receipts", plot, "public-finance-states-revenue", csvOf(["financial_year", ...lines.map((l) => l.k + "_pct")], axis.map((d, i) => [fyOf(d), ...lines.map((l) => (l.data[i].value == null ? "" : l.data[i].value.toFixed(2)))])));
  setHTML("pv-st-receipts", fmt.pct0(sh("share_in_central_taxes") + sh("grants_from_the_centre")));
  setHTML("ex-sr-own", fmt.pct0(sh("tax_receipts")));
  setHTML("ex-sr-share", fmt.pct0(sh("share_in_central_taxes")));
  setHTML("ex-sr-grant", fmt.pct0(sh("grants_from_the_centre")));
  setHTML("ex-sr-nt", fmt.pct0(sh("non_tax_receipts")));
}
{
  const b = sxB, axis = b.dates.filter((d) => d <= `${SS.accountsTo.slice(0, 4)}-04-01`);
  const share = (k) => axis.map((d) => { const i = b.dates.indexOf(d); const t = b.series.total_expenditure.data[i], v = b.series[k]?.data[i]; return { date: dt(d), value: t && v != null ? 100 * v / t : null }; });
  const lines = [["social_services", "Social services", ACC, 2.25, true], ["economic_services", "Economic services", GOLD, 1.75], ["interest_payments", "Interest", INK, 1.75], ["pension_and_misc_general_services", "Pensions and general services", GREY, 1.5], ["capital_outlay", "Capital outlay", G3, 1.5]].map(([k, label, color, width, bold]) => ({ k, label, color, width, bold, data: share(k) }));
  const y = span(lines.flatMap((l) => l.data.map((d) => d.value)), 10);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 260, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of the states' total expenditure", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      ...lines.map((l) => Plot.lineY(l.data, { x: "date", y: "value", stroke: l.color, strokeWidth: l.width, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...endLabels(lines, 2.5, (v) => fmt.pct0(v)),
    ],
  });
  const sh = (k) => lines.find((l) => l.k === k).data.at(-1).value;
  a11y(plot, "The states' spending by head", `${SS.accountsTo}: social services ${fmt.pct0(sh("social_services"))}, interest ${fmt.pct0(sh("interest_payments"))}.`);
  put("plot-st-spend", plot);
  addCrosshair(document.getElementById("plot-st-spend"), plot, lines.map((l) => ({ label: l.label, color: l.color, data: l.data })), null, (d) => fyD(d), (v) => (v == null ? "—" : p1(v)));
  wirePlate("cb-st-spend", plot, "public-finance-states-spending", csvOf(["financial_year", ...lines.map((l) => l.k + "_pct")], axis.map((d, i) => [fyOf(d), ...lines.map((l) => (l.data[i].value == null ? "" : l.data[i].value.toFixed(2)))])));
  setHTML("pv-st-spend", fmt.pct0(sh("social_services")));
  setHTML("ex-ss-soc", fmt.pct0(sh("social_services")));
  setHTML("ex-ss-eco", fmt.pct0(sh("economic_services")));
  setHTML("ex-ss-int", fmt.pct0(sh("interest_payments")));
  setHTML("ex-ss-cap", fmt.pct0(sh("capital_outlay")));
}
{
  // each state's debt and deficit, per cent of its GSDP (the States guide's computed ratios)
  const b = sfinB, d = b.dates.at(-1), i = b.dates.length - 1;
  const rows = Object.entries(b.series).filter(([k]) => k.endsWith("__debt")).map(([k, s]) => ({ k: k.replace(/__debt$/, ""), state: s.label.split(":")[0], debt: s.data[i], gfd: b.series[k.replace(/__debt$/, "__gfd")]?.data[i] ?? null })).filter((r) => r.debt != null).sort((a, c) => c.debt - a.debt);
  const x = span(rows.flatMap((r) => [r.debt, r.gfd]), 10);
  const plot = Plot.plot({
    width: W, height: 26 * rows.length + 60, marginLeft: 190, marginRight: 70, marginTop: 30, marginBottom: 30, style,
    x: { label: "per cent of the state's GSDP", labelAnchor: "right", domain: x.domain, ticks: x.ticks, tickSize: 0, tickFormat: (v) => String(v), axis: "top" },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0 },
    marks: [
      Plot.gridX(x.ticks, { stroke: GRID }),
      Plot.ruleY(rows, { y: "state", x1: (r) => Math.min(r.debt, r.gfd ?? r.debt), x2: (r) => Math.max(r.debt, r.gfd ?? r.debt), stroke: GRID, strokeWidth: 1 }),
      Plot.dot(rows.filter((r) => r.gfd != null), { x: "gfd", y: "state", r: 4, fill: GOLD, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.dot(rows, { x: "debt", y: "state", r: 4.5, fill: ACC, stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.text(rows, { x: "debt", y: "state", text: (r) => r.debt.toFixed(1), dx: 10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  const med = rows.map((r) => r.debt).sort((a, c) => a - c)[Math.floor(rows.length / 2)];
  a11y(plot, "Each state's debt and deficit as a share of its economy", `${fyOf(d)}: highest debt ${rows[0].state} ${p1(rows[0].debt)}; median ${p1(med)}.`);
  put("plot-state-cut", plot);
  wirePlate("cb-state-cut", plot, "public-finance-states-debt", csvOf(["state", "financial_year", "debt_pct_gsdp", "gross_fiscal_deficit_pct_gsdp"], rows.map((r) => [r.state, fyOf(d), r.debt, r.gfd])));
  setHTML("pv-state-cut", p1(med));
  setHTML("ex-sc-n", String(rows.filter((r) => r.debt > 30).length));
  const lo = rows.at(-1);
  setHTML("ex-sc-lo", `${lo.state}, ${p1(lo.debt)}`);
}
{
  // states' days on the RBI's facilities, last twelve months
  const b = wmaB, n = b.dates.length, from = n - 12;
  const states = b.meta.states.map((s) => ({ s, k: s.toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }));
  const sum = (k) => (b.series[k]?.data.slice(from) ?? []).reduce((a, v) => a + (v ?? 0), 0);
  const rows = states.map(({ s, k }) => ({ state: s, sdf: sum(`${k}__sdf_days`), wma: sum(`${k}__wma_days`), od: sum(`${k}__od_days`) })).filter((r) => r.sdf + r.wma + r.od > 0).sort((a, c) => c.od - a.od || (c.wma + c.sdf) - (a.wma + a.sdf));
  const segs = rows.flatMap((r) => { let x0 = 0; return [["Overdraft", r.od, ACC], ["Ways and means advances", r.wma, GREY], ["Special drawing facility", r.sdf, G3]].map(([f, v, c]) => { const o = { state: r.state, f, x1: x0, x2: x0 + v, c, v }; x0 += v; return o; }); });
  const xmax = Math.max(...rows.map((r) => r.sdf + r.wma + r.od));
  const plot = Plot.plot({
    width: W, height: 26 * rows.length + 60, marginLeft: 190, marginRight: 60, marginTop: 30, marginBottom: 30, style,
    x: { label: "days used in the last twelve months", labelAnchor: "right", domain: [0, Math.ceil(xmax / 50) * 50], tickSize: 0, tickFormat: (v) => String(v), axis: "top" },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, padding: 0.25 },
    marks: [
      Plot.barX(segs.filter((d) => d.v > 0), { x1: "x1", x2: "x2", y: "state", fill: "c", stroke: "#FFFFFF", strokeWidth: 1 }),
      Plot.text(rows, { x: (r) => r.sdf + r.wma + r.od, y: "state", text: (r) => (r.od ? `${r.od} days in overdraft` : ""), dx: 8, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  const last = (k) => b.series[k].data.at(-1);
  a11y(plot, "Days each state drew on the RBI's facilities in the last twelve months", `${rows.filter((r) => r.od > 0).length} states ran an overdraft.`);
  put("plot-wma", plot);
  wirePlate("cb-wma", plot, "public-finance-states-cash", csvOf(["state", "special_drawing_facility_days", "ways_and_means_days", "overdraft_days", "period"], rows.map((r) => [r.state, r.sdf, r.wma, r.od, `${b.dates[from].slice(0, 7)} to ${b.dates.at(-1).slice(0, 7)}`])));
  setHTML("pv-wma", String(last("states_using_od")));
  setHTML("ex-wma-od", String(last("states_using_od")));
  setHTML("ex-wma-wma", String(last("states_using_wma")));
  setHTML("ex-wma-sdf", String(last("states_using_sdf")));
  const topOD = [...rows].sort((a, c) => c.od - a.od)[0];
  setHTML("ex-wma-top", topOD && topOD.od ? `${topOD.state}'s ${topOD.od}` : "none");
}

/* =================== § 09 which GDP =================== */
{
  const ruler = (b, k) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k]?.data[i] ?? null }));
  const pub = [ruler(g99B, "gross_fiscal_deficit"), ruler(g04B, "gross_fiscal_deficit"), ruler(g11B, "gross_fiscal_deficit").filter((p) => fyD(p.date) <= ST.accountsTo)];
  const backL = ruler(backB, "centre_gross_fiscal_deficit");
  const newL = ruler(r22B, "centre_gross_fiscal_deficit").filter((p) => fyD(p.date) <= ST.accountsTo);
  const y = span([...pub.flat(), ...backL, ...newL].map((d) => d.value), 2);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 200, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: fyTick },
    y: { label: "per cent of GDP", labelAnchor: "top", labelArrow: false, domain: y.domain, ticks: y.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(y.ticks, { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(backL, { x: "date", y: "value", stroke: tint(ACC, 0.6), strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...seamMarks("side", pub.map((data) => ({ data, color: GREY, width: 1.75 })), { text: "GDP rebased", y: y.domain[1] - 0.5, at: dt(g04B.dates[0]) }),
      Plot.lineY(newL, { x: "date", y: "value", stroke: ACC, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(newL.filter((p) => p.value != null), { x: "date", y: "value", r: 3, fill: ACC, stroke: "#FFFFFF", strokeWidth: 1 }),
      ...endLabels([{ label: "2022-23 series", color: ACC, bold: true, data: newL }, { label: "RBI, 2011-12 series", color: GREY, data: pub[2] }, { label: "2011-12 back series", color: tint(ACC, 0.6), data: backL }], 0.5, (v) => p1(v)),
    ],
  });
  const nw = newL.filter((p) => p.value != null).at(-1), od = pub[2].filter((p) => p.value != null).at(-1);
  a11y(plot, "The Centre's fiscal deficit on different GDP series", `${ST.accountsTo}: ${p2(od.value)} on the 2011-12 series, ${p2(nw.value)} on the 2022-23 series.`);
  put("plot-gdpbase", plot);
  const axis = [...new Set([...pub.flat(), ...backL, ...newL].map((p) => +p.date))].sort((a, c) => a - c);
  const m = (list) => new Map(list.filter((p) => p.value != null).map((p) => [+p.date, p.value]));
  const pm = m(pub.flat()), bm = m(backL), nm2 = m(newL);
  addCrosshair(document.getElementById("plot-gdpbase"), plot, [{ label: "RBI, GDP of the time", color: GREY, data: axis.map((t) => ({ date: new Date(t), value: pm.get(t) ?? null })) }, { label: "2011-12 back series", color: tint(ACC, 0.6), data: axis.map((t) => ({ date: new Date(t), value: bm.get(t) ?? null })) }, { label: "2022-23 series", color: ACC, data: axis.map((t) => ({ date: new Date(t), value: nm2.get(t) ?? null })) }], null, (d) => fyD(d), (v) => (v == null ? "—" : p2(v)));
  wirePlate("cb-gdpbase", plot, "public-finance-which-gdp", csvOf(["financial_year", "rbi_published_pct_gdp", "rbi_gdp_series", "over_2011_12_back_series", "over_2022_23_series"], axis.map((t) => { const iso = new Date(t).toISOString().slice(0, 10); return [fyOf(iso), pm.get(t), iso < g04B.dates[0] ? "1999-2000 base" : iso < g11B.dates[0] ? "2004-05 base" : "2011-12 base", bm.get(t), nm2.get(t)]; })));
  setHTML("pv-gdpbase", p2(nw.value));
  setHTML("ex-gb-new", p2(nw.value));
  setHTML("ex-gb-old", p2(od.value));
}
