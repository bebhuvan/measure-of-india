// Guide: savings, markets and companies. Plates and number wiring.
// Data: data/series/markets-*.json, baked by scripts/lib/products/markets.mjs (DBIE via the Data
// Bank), markets-companies.mjs (the RBI's company studies) and markets-hub.mjs (forecasters and
// listed companies, via the RBI Innovation Hub). The commercial paper and certificates of deposit
// bundles belong to the rates guide and are read only. Heavy bundles are sliced by the page at
// build time and handed over as baked JSON (#markets-baked): the page makes no data requests.
// Rulers are never joined: the company studies' old format and Ind AS format, and the forecasters'
// old and new GDP bases, are drawn through seamMarks; rupee levels from different company samples
// are never drawn as a line.

import * as Plot from "@observablehq/plot";
import flowsB from "../../data/series/markets-hh-flows.json";
import flowsAB from "../../data/series/markets-hh-flows-annual.json";
import stocksB from "../../data/series/markets-hh-stocks.json";
import longB from "../../data/series/markets-hh-annual.json";
import aumB from "../../data/series/markets-mf-aum.json";
import sponsorB from "../../data/series/markets-mf-sponsor.json";
import goldB from "../../data/series/markets-gold.json";
import issuesAB from "../../data/series/markets-issues-annual.json";
import issuesB from "../../data/series/markets-issues.json";
import mcapB from "../../data/series/markets-mcap.json";
import lqB from "../../data/series/markets-listed-q.json";
import lqsB from "../../data/series/markets-listed-q-sector.json";
import lqrB from "../../data/series/markets-listed-q-ratios.json";
import pubG from "../../data/series/markets-co-public-growth.json";
import pubG0 from "../../data/series/markets-co-public-growth-2011.json";
import pvtG from "../../data/series/markets-co-private-growth.json";
import pvtG0 from "../../data/series/markets-co-private-growth-2011.json";
import fdiG from "../../data/series/markets-co-fdi-growth.json";
import fdiG0 from "../../data/series/markets-co-fdi-growth-2011.json";
import pubR from "../../data/series/markets-co-public-ratios.json";
import pubR0 from "../../data/series/markets-co-public-ratios-2011.json";
import pvtR from "../../data/series/markets-co-private-ratios.json";
import pvtR0 from "../../data/series/markets-co-private-ratios-2011.json";
import { MONO as sans, a11y, addCrosshair, spark, dodgeEndLabels, downloadSVG, downloadPNG, saveBlob, seamMarks, fmt } from "../charts/plumbing.js";

const BK = JSON.parse(document.getElementById("markets-baked")?.textContent || "{}");
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const ACC = "#2E4BD8", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dt = (iso) => new Date(iso + "T00:00:00Z");
const fy = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const qtr = (iso) => { const m = +iso.slice(5, 7) - 1; return `${MS[m]} to ${MS[m + 2]} ${iso.slice(0, 4)}`; };
const monthOf = (d) => MS[d.getUTCMonth()] + " " + d.getUTCFullYear();
const qOfDate = (d) => qtr(d.toISOString().slice(0, 10));
const fyOfDate = (d) => fy(d.toISOString().slice(0, 10));
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const MINUS = "−";
const p1 = (v) => fmt.pct1Minus(v);                                   // a signed rate, one decimal
const lc = (crore) => (crore < 0 ? MINUS : "") + "₹" + (Math.abs(crore) / 1e5).toFixed(1) + " lakh crore";
const lc2 = (crore) => (crore < 0 ? MINUS : "") + "₹" + (Math.abs(crore) / 1e5).toFixed(2) + " lakh crore";
const tc = (crore) => (crore < 0 ? MINUS : "") + "₹" + Math.round(Math.abs(crore)).toLocaleString("en-IN") + " crore";
const lastOf = (b, k) => { const d = b.series[k]?.data; if (!d) return null; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, date: b.dates[i] }; return null; };
const at = (b, k, iso) => { const i = b.dates.indexOf(iso); return i < 0 ? null : b.series[k]?.data[i] ?? null; };
const pts = (b, k, scale = 1, from) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k].data[i] == null ? null : b.series[k].data[i] * scale })).filter((p) => !from || p.date >= dt(from));
const style = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yearTicks = (a, b, step) => { const t = []; for (let y = a; y <= b; y += step) t.push(new Date(Date.UTC(y, 0, 1))); return t; };
const yearFmt = (d) => String(d.getUTCFullYear());
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
// CSV joined by date across series (union of dates, sorted): never index-joined
const csvSeries = (list, dateFmt = (d) => d.toISOString().slice(0, 10)) => {
  const keys = [...new Set(list.flatMap((s) => s.data.map((p) => p.date.getTime())))].sort((a, b) => a - b);
  const maps = list.map((s) => new Map(s.data.map((p) => [p.date.getTime(), p.value])));
  return csvOf(["date", ...list.map((s) => s.label)], keys.map((t) => [dateFmt(new Date(t)), ...maps.map((m) => m.get(t) ?? null)]));
};
const put = (id, plot) => { document.getElementById(id)?.append(plot); return plot; };
function endLabels(list, gap, f) {
  return dodgeEndLabels(list, gap).map((p) => Plot.text([{ date: p.s.data.filter((d) => d.value != null).at(-1).date, value: p.y }], { x: "date", y: "value", text: () => `${p.s.label} ${f(p.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: p.s.bold ? 600 : 400 }));
}

/** A time-series plate: lines (or a seam's marks), grid, zero rule, end labels, crosshair, a11y,
 *  downloads. opts: { y: {step, floor0, label, fmt, type}, x: {from, to, step}, marks (extra),
 *  pre (marks drawn first), height, mr, gap, tipFmt, dateFmt, noLines (the seam draws the lines) } */
function lines(figId, plotId, list, opts) {
  const all = list.flatMap((s) => s.data.map((p) => p.value));
  const yS = opts.y.domain ? { domain: opts.y.domain, ticks: opts.y.ticks } : span(all, opts.y.step, opts.y.floor0 ?? true);
  const dates = list.flatMap((s) => s.data.filter((p) => p.value != null).map((p) => p.date.getTime()));
  const y0 = new Date(Math.min(...dates)).getUTCFullYear(), y1 = new Date(Math.max(...dates)).getUTCFullYear();
  const xs = opts.x?.step ?? (y1 - y0 > 30 ? 10 : y1 - y0 > 12 ? 4 : y1 - y0 > 6 ? 2 : 1);
  const tickStart = Math.ceil(y0 / xs) * xs;
  const plot = Plot.plot({
    width: W, height: opts.height ?? 470, marginLeft: 52, marginRight: opts.mr ?? 200, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(tickStart, y1, xs), tickFormat: yearFmt },
    y: { type: opts.y.type ?? "linear", label: opts.y.label, labelAnchor: "top", labelArrow: false, domain: yS.domain, ticks: yS.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(opts.y.fmt(v)) },
    marks: [
      Plot.gridY(yS.ticks, { stroke: GRID }),
      ...(opts.y.type === "log" ? [] : [Plot.ruleY([0], { stroke: BASE })]),
      ...(opts.pre ?? []),
      ...(opts.noLines ? [] : list.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.bold ? 2 : 1.75, strokeLinejoin: "round", strokeLinecap: "round" }))),
      ...(opts.marks ?? []),
      ...list.map((s) => { const e = s.data.filter((p) => p.value != null).at(-1); return Plot.dot(e ? [e] : [], { x: "date", y: "value", fill: s.color, r: 3, stroke: "#FFFFFF", strokeWidth: 1 }); }),
      ...endLabels(list.filter((s) => !s.noLabel), opts.gap ?? (yS.domain[1] - yS.domain[0]) / 24, opts.labelFmt ?? opts.tipFmt),
    ],
  });
  a11y(plot, document.querySelector(`#${figId} .plate-head h3`)?.textContent.trim() ?? figId, list.map((s) => { const e = s.data.filter((p) => p.value != null).at(-1); return `${s.label} ${opts.tipFmt(e.value)} (${(opts.dateFmt ?? monthOf)(e.date)})`; }).join("; "));
  put(plotId, plot);
  // the crosshair reads every series at the same index: hand it copies aligned on the union of dates
  const axis = [...new Set(list.flatMap((s) => s.data.map((p) => p.date.getTime())))].sort((a, b) => a - b);
  const aligned = list.map((s) => { const m = new Map(s.data.map((p) => [p.date.getTime(), p.value])); return { ...s, data: axis.map((t) => ({ date: new Date(t), value: m.get(t) ?? null })) }; });
  const zone = document.getElementById(plotId);
  // the shared crosshair reads linear scales only: a log-scale plate goes without one
  if (zone && opts.y.type !== "log") addCrosshair(zone, plot, aligned, null, opts.dateFmt ?? monthOf, (v) => (v == null ? "—" : opts.tipFmt(v)));
  wirePlate(figId, plot, figId.replace(/^cb-/, "markets-"), csvSeries(list));
  return plot;
}

/** A horizontal bar plate for one period: rows {label, v, ref?}, sorted as given. */
function bars(figId, plotId, rows, opts) {
  const vals = rows.flatMap((r) => [r.v, r.ref]).filter((v) => v != null);
  const xS = span(vals, opts.step, true);
  const h = Math.max(220, rows.length * (opts.rowH ?? 30) + 70);
  const plot = Plot.plot({
    width: W, height: h, marginLeft: opts.ml ?? 300, marginRight: 120, marginTop: 34, marginBottom: 20, style,
    x: { label: opts.label, labelAnchor: "right", labelArrow: false, domain: xS.domain, ticks: xS.ticks, tickSize: 0, tickFormat: (v) => String(opts.fmt(v)), axis: "top" },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridX(xS.ticks, { stroke: GRID }),
      Plot.barX(rows, { x: "v", y: "label", fill: (r) => (r.hi ? ACC : r.v < 0 ? GOLD : "#AFBBF0"), insetTop: 6, insetBottom: 6 }),
      Plot.ruleX([0], { stroke: BASE }),
      ...(rows.some((r) => r.ref != null) ? [Plot.tickX(rows.filter((r) => r.ref != null), { x: "ref", y: "label", stroke: INK, strokeWidth: 1.5, insetTop: 4, insetBottom: 4 })] : []),
      // values outside the bar's end, on the side away from zero
      Plot.text(rows.filter((r) => r.v >= 0), { x: (r) => Math.max(r.v, r.ref ?? -Infinity), y: "label", text: (r) => opts.fmt(r.v), dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.text(rows.filter((r) => r.v < 0), { x: (r) => Math.min(r.v, r.ref ?? Infinity), y: "label", text: (r) => opts.fmt(r.v), dx: -8, textAnchor: "end", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, document.querySelector(`#${figId} .plate-head h3`)?.textContent.trim() ?? figId, rows.slice(0, 8).map((r) => `${r.label} ${opts.fmt(r.v)}`).join("; "));
  put(plotId, plot);
  wirePlate(figId, plot, figId.replace(/^cb-/, "markets-"), csvOf(["item", opts.csvHead ?? "value", ...(rows.some((r) => r.ref != null) ? [opts.refHead ?? "reference"] : [])], rows.map((r) => [r.label, r.v, ...(rows.some((x) => x.ref != null) ? [r.ref] : [])])));
  return plot;
}

/* =================== title block and § 01 =================== */
const NET = "per_cent_of_gdp_as_per_cent_to_gdp", GROSS = "gross_financial_assets_per_cent_of_gdp_as_per_cent_to_gdp", LIAB = "gross_financial_liabilities_per_cent_of_gdp_as_per_cent_to_g";
const LIABK = Object.keys(flowsB.series).find((k) => k.startsWith(LIAB));
const net = lastOf(flowsB, NET);
setHTML("n-net", net.v.toFixed(1) + pc("%"));
setHTML("d-net", `<b>${(net.v - flowsB.series[NET].data[net.i - 4]).toFixed(1)} pt</b> on a year earlier, ${qtr(net.date)}`.replace(/^<b>-/, `<b>${MINUS}`));
spark("nspark-net", { data: pts(flowsB, NET), color: ACC });
setHTML("rb-net", net.v.toFixed(1) + pc("% of GDP"));
setHTML("rb-gross", lastOf(flowsB, GROSS).v.toFixed(1) + pc("%"));
const aumL = lastOf(aumB, "aum");
setHTML("n-aum", lc(aumL.v));
setHTML("d-aum", `<b>${p1(100 * (aumL.v / aumB.series.aum.data[aumL.i - 1] - 1))}</b> on a year earlier, March ${aumL.date.slice(0, 4)}`);
const salesL = lastOf(lqB, "sales");
setHTML("n-sales", p1(salesL.v).replace("%", pc("%")));
setHTML("d-sales", `${qtr(salesL.date)}, <b>${fmt.count(lqB.series.companies.data[salesL.i])}</b> companies`);
// forecasters: the current fiscal year's median in the latest round
const spfNow = (BK.spfNew ?? []).map((s) => ({ ...s, last: s.data.at(-1) })).filter((s) => s.last[0] === (BK.spfNew ?? []).flatMap((x) => x.data.map((p) => p[0])).sort().at(-1));
const spfCur = spfNow.sort((a, b) => (a.target < b.target ? -1 : 1))[0], spfNext = spfNow.sort((a, b) => (a.target < b.target ? -1 : 1))[1];
if (spfCur) {
  setHTML("n-spf", spfCur.last[1].toFixed(1) + pc("%"));
  setHTML("d-spf", `for ${spfCur.target}, survey of ${monthOf(dt(spfCur.last[0]))}`);
}

/* =================== § 02 lived reality =================== */
const FA = {
  dep: "i_financial_assets_1_total_deposits_a_b", pf: "i_financial_assets_3_provident_and_pension_funds_including_ppf", ins: "i_financial_assets_2_life_insurance_funds",
  mf: "i_financial_assets_5_investments_a_mutual_funds", eq: "i_financial_assets_5_investments_b_equity", cash: "i_financial_assets_4_currency", ss: "i_financial_assets_6_small_savings_excluding_ppf",
  gross: "gross_financial_assets_i_financial_assets", liab: "gross_financial_liabilities_ii_financial_liabilities",
};
const fA = (k, i = flowsAB.dates.length - 1) => flowsAB.series[FA[k]]?.data[i] ?? null;
{
  const g = fA("gross"), r = (k) => "₹" + Math.round((100 * fA(k)) / g).toString().replace("-", MINUS);
  for (const k of ["dep", "pf", "ins", "mf", "cash", "ss", "eq"]) setHTML("lr-" + k, r(k));
  setHTML("lr-borrow", "₹" + Math.round((100 * fA("liab")) / g));
  setHTML("lr-net", fmt.pct1(lastOf(flowsAB, NET).v));
}

/* =================== § 04 where the money went =================== */
{
  const L = { dep: "Deposits", pf: "Provident and pension funds", ins: "Life insurance", mf: "Mutual funds", ss: "Small savings", cash: "Currency", eq: "Shares, bought directly" };
  const rows = Object.entries(L).map(([k, label]) => ({ label, v: fA(k) / 1e5, ref: fA(k, 0) == null ? null : fA(k, 0) / 1e5 })).sort((a, b) => b.v - a.v);
  rows[0].hi = true;
  bars("cb-flows", "plot-flows", rows, { step: 2, fmt: (v) => (v < 0 ? MINUS : "") + "₹" + Math.abs(v).toFixed(1) + " lakh cr", label: "₹ lakh crore", csvHead: `${fy(flowsAB.dates.at(-1))}, ₹ lakh crore`, refHead: `${fy(flowsAB.dates[0])}, ₹ lakh crore`, ml: 240, rowH: 40 });
  setHTML("pv-flows", lc(fA("gross")));
  const ex = (id, k) => setHTML(id, lc(fA(k)));
  ex("ex-fl-dep", "dep"); ex("ex-fl-pf", "pf"); ex("ex-fl-ins", "ins"); ex("ex-fl-mf", "mf"); ex("ex-fl-cash", "cash"); ex("ex-fl-eq", "eq");
  setHTML("ex-fl-mf0", lc(fA("mf", 0)));
}
{
  const g = { label: "Gross financial saving", color: G1, data: pts(flowsB, GROSS) };
  const l = { label: "Borrowing", color: GOLD, data: pts(flowsB, LIABK) };
  const n = { label: "Net financial saving", color: ACC, bold: true, data: pts(flowsB, NET) };
  lines("cb-net", "plot-net", [g, n, l], { y: { step: 2, label: "per cent of GDP", fmt: (v) => String(v) }, tipFmt: (v) => v.toFixed(1) + "%", dateFmt: qOfDate, x: { step: 1 }, mr: 230 });
  setHTML("pv-net", fmt.pct1(net.v));
  const i = net.i;
  setHTML("ex-net-g", fmt.pct1(flowsB.series[GROSS].data[i])); setHTML("ex-net-l", fmt.pct1(flowsB.series[LIABK].data[i]));
  setHTML("ex-net-n", fmt.pct1(net.v)); setHTML("ex-net-y", fmt.pct1(flowsB.series[NET].data[i - 4]));
}

/* =================== § 05 fifty years =================== */
{
  const T = longB.series["10_changes_in_financial_assets_2_to_10"].data;
  const share = (k) => longB.dates.map((d, i) => ({ date: dt(d), value: longB.series[k].data[i] == null || !T[i] ? null : (100 * longB.series[k].data[i]) / T[i] }));
  const dep = { label: "Bank deposits", color: ACC, bold: true, data: share("02_bank_deposits") };
  const sh = { label: "Shares and debentures", color: GOLD, data: share("07_shares_and_debentures") };
  const pf = { label: "Provident and pension", color: G1, data: share("05_provident_and_pension_fund") };
  const ins = { label: "Life insurance", color: G2, data: share("04_life_insurance_fund") };
  lines("cb-long", "plot-long", [dep, pf, ins, sh], { y: { step: 10, label: "per cent of the year's financial saving", fmt: (v) => String(v) }, tipFmt: (v) => v.toFixed(1) + "%", dateFmt: fyOfDate, x: { step: 10 }, mr: 230 });
  const last = (s) => s.data.filter((p) => p.value != null).at(-1).value;
  setHTML("pv-long", fmt.pct1(last(dep)));
  setHTML("ex-long-dep", fmt.pct1(last(dep))); setHTML("ex-long-sh", fmt.pct1(last(sh))); setHTML("ex-long-pf", fmt.pct1(last(pf))); setHTML("ex-long-ins", fmt.pct1(last(ins)));
  setHTML("ex-long-dep0", fmt.pct1(dep.data[0].value));
}

/* =================== § 06 the balance sheet =================== */
{
  const S = stocksB.series, find = (re) => Object.keys(S).find((k) => re.test(k));
  const i = stocksB.dates.length - 1;
  const items = [
    ["Bank deposits", /_a_bank_deposit[s]?_i_ii$|bank_deposits_i_ii$/], ["Shares (equity)", /_ii_equity$/], ["Life insurance funds", /_c_life_insuran/], ["Mutual funds", /_i_mutual_funds$/],
    ["Currency", /_d_currency$/], ["Small savings", /_h_small_saving/], ["Pension funds", /_g_pension_fund/], ["Public Provident Fund", /_f_public_provi/], ["Non-bank deposits", /_b_non_bank_dep[a-z_]*$/],
  ];
  const rows = items.map(([label, re]) => { const k = Object.keys(S).filter((x) => re.test(x)).sort((a, b) => a.length - b.length)[0]; return { label, v: k ? S[k].data[i] / 1e5 : null }; }).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const debtK = find(/^financial_liabilities_financial_liabilities/);
  rows.push({ label: "Owed: all loans", v: -S[debtK].data[i] / 1e5 });
  rows[0].hi = true;
  bars("cb-stocks", "plot-stocks", rows, { step: 20, fmt: (v) => (v < 0 ? MINUS : "") + "₹" + Math.abs(v).toFixed(1) + " lakh cr", label: "₹ lakh crore", csvHead: `${qtr(stocksB.dates.at(-1))}, ₹ lakh crore (debt negative)`, ml: 240, rowH: 36 });
  const aK = find(/^gross_financial_assets_financial_assets_a_b_c_d_e_f_g_h$/), agK = find(/^gross_financial_assets_per_cent_of_gdp/), lgK = find(/^financial_liabilities_per_cent_of_gdp/);
  setHTML("pv-stocks", fmt.pct1(S[agK].data[i]));
  setHTML("ex-st-a", lc(S[aK].data[i])); setHTML("ex-st-ag", fmt.pct1(S[agK].data[i])); setHTML("ex-st-l", lc(S[debtK].data[i])); setHTML("ex-st-lg", fmt.pct1(S[lgK].data[i]));
  setHTML("ex-st-dep", lc(rows.find((r) => r.label === "Bank deposits").v * 1e5)); setHTML("ex-st-eq", lc(rows.find((r) => r.label === "Shares (equity)").v * 1e5)); setHTML("ex-st-mf", lc(rows.find((r) => r.label === "Mutual funds").v * 1e5));
}

/* =================== § 07 mutual funds =================== */
{
  const a = { label: "Assets under management", color: ACC, bold: true, data: pts(aumB, "aum", 1e-5) };
  lines("cb-aum", "plot-aum", [a], { y: { step: 10, label: "₹ lakh crore, end-March", fmt: (v) => String(v) }, tipFmt: (v) => "₹" + v.toFixed(1) + " lakh cr", dateFmt: (d) => "March " + d.getUTCFullYear(), x: { step: 4 }, mr: 260 });
  setHTML("pv-aum", lc(aumL.v)); setHTML("ex-aum", lc(aumL.v));
  setHTML("ex-aum-y", p1(100 * (aumL.v / aumB.series.aum.data[aumL.i - 1] - 1))); setHTML("ex-aum-5", lc(aumB.series.aum.data[aumL.i - 5]));
}
{
  const H = BK.houses ?? [], top = H.slice(0, 20).map((h) => ({ label: h.label, v: h.v / 1000 }));
  if (top.length) top[0].hi = true;
  bars("cb-houses", "plot-houses", top, { step: 20, fmt: (v) => (v < 0 ? MINUS : "") + "₹" + Math.abs(v).toFixed(1) + " th cr", label: "₹ thousand crore", csvHead: `${fy(BK.housesDate)}, ₹ thousand crore`, ml: 300, rowH: 28 });
  setHTML("pv-houses", lc(BK.housesTotal));
  if (H.length) {
    setHTML("ex-h-top", H[0].label); setHTML("ex-h-topv", tc(H[0].v));
    const pos = H.filter((h) => h.v > 0).reduce((s, h) => s + h.v, 0);
    setHTML("ex-h-top5", fmt.pct0((100 * H.slice(0, 5).reduce((s, h) => s + h.v, 0)) / BK.housesTotal));
    setHTML("ex-h-neg", fmt.count(H.filter((h) => h.v < 0).length));
    void pos;
  }
}
{
  const s = (k, label, color, bold) => ({ label, color, bold, data: pts(sponsorB, k, 1e-3, "1987-04-01") });
  const list = [s("private", "Private", ACC, true), s("bank", "Bank-sponsored", GOLD), s("uti", "UTI", G2)];
  lines("cb-sponsor", "plot-sponsor", list, { y: { step: 50, label: "₹ thousand crore, net inflow", fmt: (v) => String(v) }, tipFmt: (v) => "₹" + v.toFixed(1) + " th cr", dateFmt: fyOfDate, x: { step: 4 }, mr: 200 });
  const L = (k) => lastOf(sponsorB, k).v;
  setHTML("pv-sponsor", tc(L("private")));
  setHTML("ex-sp-p", tc(L("private"))); setHTML("ex-sp-b", tc(L("bank"))); setHTML("ex-sp-u", tc(L("uti"))); setHTML("ex-sp-t", tc(L("total")));
}

/* =================== § 08 gold =================== */
{
  const m = { label: "Mumbai", color: ACC, bold: true, data: pts(goldB, "gold_mumbai", 1e-3) };
  const l = { label: "London, in rupees", color: GOLD, data: pts(goldB, "gold_london_inr", 1e-3) };
  lines("cb-gold", "plot-gold", [l, m], { y: { step: 20, label: "₹ thousand per 10 grams", fmt: (v) => String(v) }, tipFmt: (v) => "₹" + (v * 1000).toLocaleString("en-IN", { maximumFractionDigits: 0 }), x: { step: 4 }, mr: 220 });
  const gm = lastOf(goldB, "gold_mumbai"), sv = lastOf(goldB, "silver_mumbai"), sp = lastOf(goldB, "gold_spread");
  setHTML("pv-gold", fmt.inrR(gm.v)); setHTML("ex-g-m", fmt.inrR(gm.v)); setHTML("ex-g-s", fmt.inrR(sv.v));
  setHTML("ex-g-sp", `${sp.v < 0 ? MINUS : ""}${fmt.inrR(Math.abs(sp.v))} (${monthOf(dt(sp.date))})`);
}

/* =================== § 09 issues, CP and CD =================== */
{
  const e = { label: "Equity", color: ACC, bold: true, data: pts(issuesAB, "equity", 1e-5) };
  const b = { label: "Bonds", color: GOLD, data: pts(issuesAB, "bonds", 1e-5) };
  lines("cb-issues", "plot-issues", [b, e], { y: { step: 0.5, label: "₹ lakh crore", fmt: (v) => v.toFixed(1) }, tipFmt: (v) => "₹" + v.toFixed(2) + " lakh cr", dateFmt: fyOfDate, x: { step: 4 }, mr: 220 });
  const eL = lastOf(issuesAB, "equity"), bL = lastOf(issuesAB, "bonds");
  setHTML("pv-issues", lc2(eL.v)); setHTML("ex-is-eq", lc2(eL.v)); setHTML("ex-is-b", tc(bL.v));
  const mn = lastOf(issuesB, "equity_n"), mv = lastOf(issuesB, "equity");
  setHTML("ex-is-mn", fmt.count(mn.v)); setHTML("ex-is-mv", tc(mv.v));
}
{
  const s = (rows, label, color, bold) => ({ label, color, bold, data: (rows ?? []).map(([d, v]) => ({ date: dt(d), value: v == null ? null : v / 1e5 })) });
  const cp = s(BK.cp, "Commercial paper", ACC, true), cd = s(BK.cd, "Certificates of deposit", GOLD);
  lines("cb-cpcd", "plot-cpcd", [cd, cp], { y: { step: 1, label: "₹ lakh crore outstanding", fmt: (v) => String(v) }, tipFmt: (v) => "₹" + v.toFixed(2) + " lakh cr", dateFmt: (d) => `${d.getUTCDate()} ${monthOf(d)}`, x: { step: 4 }, mr: 260 });
  const lc_ = (rows) => rows.filter((r) => r[1] != null).at(-1);
  const yAgo = (rows) => { const l = lc_(rows); const t = new Date(dt(l[0]).getTime() - 365 * 864e5); return rows.filter((r) => r[1] != null && dt(r[0]) <= t).at(-1); };
  setHTML("pv-cp", lc2(lc_(BK.cp)[1])); setHTML("ex-cp", lc2(lc_(BK.cp)[1])); setHTML("ex-cd", lc2(lc_(BK.cd)[1]));
  setHTML("ex-cp-y", lc2(yAgo(BK.cp)[1])); setHTML("ex-cd-y", lc2(yAgo(BK.cd)[1]));
}

/* =================== § 10 market size =================== */
{
  const n = { label: "NSE", color: ACC, bold: true, data: pts(mcapB, "nse", 1e-5, "1994-11-01") };
  const b = { label: "BSE", color: GOLD, data: pts(mcapB, "bse", 1e-5, "1994-11-01") };
  lines("cb-mcap", "plot-mcap", [b, n], { y: { step: 100, label: "₹ lakh crore, end of month", fmt: (v) => String(v) }, tipFmt: (v) => "₹" + v.toFixed(1) + " lakh cr", x: { step: 4 }, mr: 220 });
  const nL = lastOf(mcapB, "nse");
  setHTML("pv-mcap", lc(nL.v)); setHTML("ex-mc-n", lc(nL.v)); setHTML("ex-mc-b", lc(lastOf(mcapB, "bse").v)); setHTML("ex-mc-ny", lc(mcapB.series.nse.data[nL.i - 12]));
}
{
  const D = BK.deriv ?? { dates: [], index_options: [], cash: [] };
  const mk = (arr, label, color, bold) => ({ label, color, bold, data: D.dates.map((d, i) => ({ date: dt(d), value: arr[i] == null || arr[i] <= 0 ? null : arr[i] / 1e5 })) });
  const o = mk(D.index_options, "Index options", ACC, true), c = mk(D.cash, "Shares", G1);
  const ticks = [0.1, 1, 10, 100, 1000, 10000];
  lines("cb-turnover", "plot-turnover", [c, o], { y: { type: "log", domain: [0.1, 10000], ticks, label: "₹ lakh crore a month (log scale)", fmt: (v) => v.toLocaleString("en-IN") }, tipFmt: (v) => "₹" + (v >= 100 ? Math.round(v).toLocaleString("en-IN") : v.toFixed(1)) + " lakh cr", x: { step: 4 }, mr: 220, gap: 0 });
  const oL = o.data.filter((p) => p.value != null).at(-1), cL = c.data.find((p) => p.date.getTime() === oL.date.getTime());
  setHTML("pv-turnover", cL?.value ? `${Math.round(oL.value / cL.value)}${pc("×")}` : "—");
  setHTML("ex-to-o", lc(oL.value * 1e5)); setHTML("ex-to-c", cL?.value ? lc(cL.value * 1e5) : "—");
}

/* =================== § 11 listed companies =================== */
{
  const s = lastOf(lqB, "sales");
  const list = [{ label: "Sales", color: ACC, bold: true, data: pts(lqB, "sales") }, { label: "Operating profit", color: GOLD, data: pts(lqB, "opr_pft") }];
  lines("cb-listed", "plot-listed", list, { y: { step: 10, label: "growth on a year earlier, per cent", fmt: (v) => String(v) }, tipFmt: (v) => p1(v), dateFmt: qOfDate, x: { step: 2 }, mr: 220 });
  setHTML("pv-listed", p1(s.v));
  setHTML("ex-ls-n", fmt.count(lqB.series.companies.data[s.i])); setHTML("ex-ls-s", p1(s.v)); setHTML("ex-ls-o", p1(lqB.series.opr_pft.data[s.i]));
  setHTML("ex-ls-p", p1(lqB.series.net_pft.data[s.i])); setHTML("ex-ls-w", p1(lqB.series.expd_staff_cost.data[s.i]));
}
{
  const k = { m: "icc_manf__sales", i: "icc_srv_it__sales", s: "icc_srv_non_it__sales" };
  const list = [{ label: "Manufacturing", color: ACC, bold: true, data: pts(lqsB, k.m) }, { label: "IT", color: GOLD, data: pts(lqsB, k.i) }, { label: "Other services", color: G2, data: pts(lqsB, k.s) }];
  lines("cb-sectors", "plot-sectors", list, { y: { step: 10, label: "sales growth on a year earlier, per cent", fmt: (v) => String(v) }, tipFmt: (v) => p1(v), dateFmt: qOfDate, x: { step: 2 }, mr: 220 });
  const L = (x) => lastOf(lqsB, x).v;
  setHTML("pv-sectors", p1(L(k.m))); setHTML("ex-sec-m", p1(L(k.m))); setHTML("ex-sec-i", p1(L(k.i))); setHTML("ex-sec-s", p1(L(k.s)));
}
{
  const list = [{ label: "Interest coverage", color: ACC, bold: true, data: pts(lqrB, "int_cvg") }, { label: "Net profit to sales", color: GOLD, data: pts(lqrB, "net_pft_to_sal") }];
  lines("cb-coverage", "plot-coverage", list, { y: { step: 2, label: "times (coverage) and per cent (margin)", fmt: (v) => String(v) }, tipFmt: (v) => v.toFixed(1), labelFmt: (v) => v.toFixed(1), dateFmt: qOfDate, x: { step: 2 }, mr: 240 });
  const c = lastOf(lqrB, "int_cvg");
  setHTML("pv-coverage", fmt.x1(c.v)); setHTML("ex-cv-i", fmt.x1(c.v)); setHTML("ex-cv-p", fmt.pct1(lastOf(lqrB, "net_pft_to_sal").v)); setHTML("ex-cv-is", fmt.pct1(lastOf(lqrB, "int_to_sal").v));
}
{
  const R = (BK.industries ?? []).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const rows = R.map((r) => ({ label: r.label, v: r.v, ref: r.y }));
  if (rows.length) rows[0].hi = true;
  bars("cb-industries", "plot-industries", rows, { step: 20, fmt: (v) => p1(v), label: "sales growth, per cent", csvHead: `${qtr(BK.industriesDate)}, per cent`, refHead: "a year earlier, per cent", ml: 360, rowH: 24 });
  const sorted = R.map((r) => r.v).sort((a, b) => a - b), med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  setHTML("pv-industries", `${fmt.count(R.filter((r) => r.v > 10).length)} of ${fmt.count(R.length)}`);
  if (R.length) {
    setHTML("ex-in-hi", `${R[0].label}, ${p1(R[0].v)}`); setHTML("ex-in-lo", `${R.at(-1).label}, ${p1(R.at(-1).v)}`);
    setHTML("ex-in-med", p1(med)); setHTML("ex-in-neg", fmt.count(R.filter((r) => r.v < 0).length)); setHTML("ex-in-n", fmt.count(R.length));
  }
}

/* =================== § 12 the company studies (two formats, drawn apart) =================== */
{
  const run = (b, k) => pts(b, k).filter((p) => p.value != null);
  const C = [[pubG0, pubG, ACC, "Public limited", true], [pvtG0, pvtG, GOLD, "Private limited"], [fdiG0, fdiG, G2, "Foreign-owned"]];
  const seams = [], list = [];
  C.forEach(([old, cur, color, label, bold], j) => {
    // the old format calls the item "Sales", the Ind AS format "Net sales": the two rulers
    const o = { label, color, data: run(old, "sales"), noLabel: true }, n = { label, color, bold, data: run(cur, "net_sales") };
    seams.push(...seamMarks("side", [{ data: o.data, color, width: 1.5 }, { data: n.data, color, width: bold ? 2 : 1.75 }], j === 0 ? { text: "Ind AS format from the 2020-21 study", y: 26, at: dt("2019-10-01") } : false));
    list.push(n, o);
  });
  lines("cb-studies", "plot-studies", list, { y: { step: 10, label: "net sales, growth on the year before, per cent", fmt: (v) => String(v) }, tipFmt: (v) => p1(v), dateFmt: fyOfDate, x: { step: 2 }, mr: 220, noLines: true, pre: seams });
  const L = (b) => lastOf(b, "net_sales").v;
  setHTML("pv-studies", p1(L(pubG)));
  setHTML("ex-st-pub", p1(L(pubG))); setHTML("ex-st-pvt", p1(L(pvtG))); setHTML("ex-st-fdi", p1(L(fdiG)));
  setHTML("ev-st-pub", (lastOf(pubG, "companies")?.v ?? 0).toLocaleString("en-IN")); setHTML("ev-st-pvt", (lastOf(pvtG, "companies")?.v ?? 0).toLocaleString("en-IN")); setHTML("ev-st-fdi", (lastOf(fdiG, "companies")?.v ?? 0).toLocaleString("en-IN"));
}
{
  const run = (b) => pts(b, "debt_to_equity").filter((p) => p.value != null);
  const seams = [], list = [];
  [[pubR0, pubR, ACC, "Public limited", true], [pvtR0, pvtR, GOLD, "Private limited"]].forEach(([old, cur, color, label, bold], j) => {
    const o = { label, color, data: run(old), noLabel: true }, n = { label, color, bold, data: run(cur) };
    seams.push(...seamMarks("side", [{ data: o.data, color, width: 1.5 }, { data: n.data, color, width: bold ? 2 : 1.75 }], j === 0 ? { text: "Ind AS format from the 2020-21 study", y: 64, at: dt("2019-10-01") } : false));
    list.push(n, o);
  });
  lines("cb-debt", "plot-debt", list, { y: { step: 10, label: "debt to equity, per cent", fmt: (v) => String(v) }, tipFmt: (v) => fmt.pct1(v), dateFmt: fyOfDate, x: { step: 2 }, mr: 220, noLines: true, pre: seams });
  setHTML("pv-debt", fmt.pct1(lastOf(pubR, "debt_to_equity").v));
  setHTML("ex-dt-pub", fmt.pct1(lastOf(pubR, "debt_to_equity").v)); setHTML("ex-dt-pvt", fmt.pct1(lastOf(pvtR, "debt_to_equity").v));
}

/* =================== § 13 forecasters (old and new GDP base, drawn apart) =================== */
{
  const toS = (x, color) => ({ label: x.target, color, data: x.data.map(([d, v]) => ({ date: dt(d), value: v })) });
  const olds = (BK.spfOld ?? []).sort((a, b) => (a.target < b.target ? -1 : 1)), news = (BK.spfNew ?? []).sort((a, b) => (a.target < b.target ? -1 : 1));
  const palette = [G3, G2, G1, "#8790A0", G2, G1, G3, G2];
  const oldS = olds.map((x, j) => toS(x, palette[j % palette.length])), newS = news.map((x, j) => toS(x, j === 0 ? ACC : GOLD));
  const all = [...oldS, ...newS];
  const yS = span(all.flatMap((s) => s.data.map((p) => p.value)), 2, false);
  const plot = Plot.plot({
    width: W, height: 500, marginLeft: 52, marginRight: 120, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2020, 2026, 1), tickFormat: yearFmt },
    y: { label: "median forecast of real GDP growth, per cent", labelAnchor: "top", labelArrow: false, domain: yS.domain, ticks: yS.ticks, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(yS.ticks, { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      // the new base is a second ruler: the seam treatment draws both sets apart, with the changeover marked
      ...seamMarks("side", [...oldS.map((s) => ({ data: s.data, color: s.color, width: 1.5 })), ...newS.map((s) => ({ data: s.data, color: s.color, width: 2 }))], { text: "New GDP base from round 99", y: yS.domain[1] - 1, at: dt("2026-02-01") }),
      Plot.dot(all.flatMap((s) => s.data.filter((p) => p.value != null).map((p) => ({ ...p, c: s.color }))), { x: "date", y: "value", fill: "c", r: 2.2 }),
      // each target year labelled at its first round, above the point
      Plot.text(all.map((s) => ({ ...s.data.find((p) => p.value != null), t: s.label })), { x: "date", y: "value", text: "t", dy: -10, fontSize: 11.5, fill: INK }),
    ],
  });
  const cur = newS[0]?.data.at(-1);
  a11y(plot, document.querySelector("#cb-spf .plate-head h3")?.textContent.trim(), cur ? `Median forecast for ${newS[0].label}: ${cur.value.toFixed(1)}% in ${monthOf(cur.date)}` : "");
  put("plot-spf", plot);
  wirePlate("cb-spf", plot, "markets-spf", csvSeries(all.map((s) => ({ ...s, label: `GDP growth forecast for ${s.label}, median (${newS.includes(s) ? "GDP 2022-23 base" : "GDP 2011-12 base"})` }))));
  if (spfCur) {
    setHTML("pv-spf", spfCur.last[1].toFixed(1) + pc("%")); setHTML("pv-spf-y", spfCur.target);
    setHTML("ex-spf-y", spfCur.target); setHTML("ex-spf-v", fmt.pct1(spfCur.last[1]));
    setHTML("ex-spf-n", spfNext ? `${fmt.pct1(spfNext.last[1])} (${spfNext.target})` : "—");
  }
  const cpi = (BK.cpiNew ?? []).map((x) => ({ ...x, last: x.data.at(-1) })).filter((x) => x.last && x.last[0] === (spfCur?.last[0])).sort((a, b) => (a.target < b.target ? -1 : 1))[0];
  if (cpi) { setHTML("ex-spf-q", cpi.target.replace(":", " ")); setHTML("ex-spf-c", fmt.pct1(cpi.last[1])); }
}

/* =================== provenance =================== */
setHTML("prov-vintage", flowsB.meta.vintage);
setHTML("prov-vintage2", flowsB.meta.vintage);
