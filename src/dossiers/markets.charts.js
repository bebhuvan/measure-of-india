// Markets guide (savings, markets and companies): the plates and the page's figures, drawn and
// written at build time with the chart kit (src/kit/). Each plate export returns a bare figure for
// its .plotzone; titles, source lines and buttons stay in src/pages/guides/markets.astro.
// numbers(BK) returns every figure the page names (id -> HTML), so the page ships no bundle JSON.
// Rulers are never joined: the company studies' old format and Ind AS format, and the
// forecasters' old and new GDP bases, are separate series across a drawn seam; rupee levels from
// different company samples are never drawn as a line.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";
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

const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fy = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const qtr = (iso) => { const m = +iso.slice(5, 7) - 1; return `${MS[m]} to ${MS[m + 2]} ${iso.slice(0, 4)}`; };
const monthOf = (iso) => MS[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pc = (u) => `<span class="pc">${u}</span>`;
const MINUS = "−";
const p1 = (v) => fmt.pct1Minus(v);
// one decimal of a lakh crore, whole lakh crore from 1,000 up ("₹5,704 lakh crore", not "₹5,703.6")
const lc = (crore) => { const d = Math.abs(crore) >= 1e8 ? 0 : 1; return (crore < 0 ? MINUS : "") + "₹" + (Math.abs(crore) / 1e5).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }) + " lakh crore"; };
const lc2 = (crore) => (crore < 0 ? MINUS : "") + "₹" + (Math.abs(crore) / 1e5).toFixed(1) + " lakh crore";
const tc = (crore) => (crore < 0 ? MINUS : "") + "₹" + Math.round(Math.abs(crore)).toLocaleString("en-IN") + " crore";
const lastOf = (b, k) => { const d = b.series[k]?.data; if (!d) return null; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, date: b.dates[i] }; return null; };
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
/** [[date, value]] with a scale, rounded for display; nulls kept as gaps. */
const ser = (b, k, scale = 1, from = null, round = r1) => b.dates.map((d, i) => [d, b.series[k].data[i] == null ? null : round(b.series[k].data[i] * scale)]).filter(([d]) => !from || d >= from);
const lastV = (P) => { for (let i = P.length - 1; i >= 0; i--) if (P[i][1] != null) return P[i][1]; return null; };
const PCT = { suffix: "%" };
const LCR = { prefix: "₹", suffix: " lakh cr" };
const lcrEnd = (v) => K.num(v, { dp: 1, prefix: "₹", suffix: " lakh cr" });

const NET = "per_cent_of_gdp_as_per_cent_to_gdp", GROSS = "gross_financial_assets_per_cent_of_gdp_as_per_cent_to_gdp", LIAB = "gross_financial_liabilities_per_cent_of_gdp_as_per_cent_to_g";
const LIABK = Object.keys(flowsB.series).find((k) => k.startsWith(LIAB));
const FA = {
  dep: "i_financial_assets_1_total_deposits_a_b", pf: "i_financial_assets_3_provident_and_pension_funds_including_ppf", ins: "i_financial_assets_2_life_insurance_funds",
  mf: "i_financial_assets_5_investments_a_mutual_funds", eq: "i_financial_assets_5_investments_b_equity", cash: "i_financial_assets_4_currency", ss: "i_financial_assets_6_small_savings_excluding_ppf",
  gross: "gross_financial_assets_i_financial_assets", liab: "gross_financial_liabilities_ii_financial_liabilities",
};
const fA = (k, i = flowsAB.dates.length - 1) => flowsAB.series[FA[k]]?.data[i] ?? null;

/* ---------------- shared slices ---------------- */
// § 05: each instrument's share of the year's change in financial assets
const longShare = (k) => { const T = longB.series["10_changes_in_financial_assets_2_to_10"].data; return longB.dates.map((d, i) => [d, longB.series[k].data[i] == null || !T[i] ? null : r1((100 * longB.series[k].data[i]) / T[i])]); };
// § 06: the balance sheet rows (assets, then all loans as a negative)
function stockRows() {
  const S = stocksB.series, i = stocksB.dates.length - 1;
  const items = [
    ["Bank deposits", /_a_bank_deposit[s]?_i_ii$|bank_deposits_i_ii$/], ["Shares (equity)", /_ii_equity$/], ["Life insurance funds", /_c_life_insuran/], ["Mutual funds", /_i_mutual_funds$/],
    ["Currency", /_d_currency$/], ["Small savings", /_h_small_saving/], ["Pension funds", /_g_pension_fund/], ["Public Provident Fund", /_f_public_provi/], ["Non-bank deposits", /_b_non_bank_dep[a-z_]*$/],
  ];
  const rows = items.map(([label, re]) => { const k = Object.keys(S).filter((x) => re.test(x)).sort((a, b) => a.length - b.length)[0]; return { label, v: k ? S[k].data[i] / 1e5 : null }; }).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const debtK = Object.keys(S).find((k) => /^financial_liabilities_financial_liabilities/.test(k));
  rows.push({ label: "Owed: all loans", v: -S[debtK].data[i] / 1e5 });
  return { rows, debtK, i };
}
// § 13: at each round, the median for the fiscal year in progress (ahead=false) or the year ahead
const fyOfRound = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7), st = m >= 4 ? y : y - 1; return `${st}-${String((st + 1) % 100).padStart(2, "0")}`; };
const nextFy = (f) => { const st = +f.slice(0, 4) + 1; return `${st}-${String((st + 1) % 100).padStart(2, "0")}`; };
const pickSpf = (list, ahead) => { const m = new Map(); for (const x of list ?? []) for (const [d, v] of x.data) { const f = fyOfRound(d); if (x.target === (ahead ? nextFy(f) : f)) m.set(d, v); }
  return [...m.entries()].sort().map(([d, v]) => [d, r1(v)]); };
const spfLatest = (BK) => {
  const lastRound = (BK.spfNew ?? []).flatMap((x) => x.data.map((p) => p[0])).sort().at(-1);
  const now = (BK.spfNew ?? []).map((s) => ({ ...s, last: s.data.at(-1) })).filter((s) => s.last?.[0] === lastRound).sort((a, b) => (a.target < b.target ? -1 : 1));
  return { cur: now[0], next: now[1] };
};

/* ---------------- the page's figures ---------------- */
export function numbers(BK) {
  const N = {};
  const net = lastOf(flowsB, NET);
  N["n-net"] = net.v.toFixed(1) + pc("%");
  N["d-net"] = `<b>${(net.v - flowsB.series[NET].data[net.i - 4]).toFixed(1)} pt</b> on a year earlier, ${qtr(net.date)}`.replace(/^<b>-/, `<b>${MINUS}`);
  N["rb-net"] = net.v.toFixed(1) + pc("% of GDP");
  N["rb-gross"] = lastOf(flowsB, GROSS).v.toFixed(1) + pc("%");
  const aumL = lastOf(aumB, "aum");
  N["n-aum"] = lc(aumL.v);
  N["d-aum"] = `<b>${p1(100 * (aumL.v / aumB.series.aum.data[aumL.i - 1] - 1))}</b> on a year earlier, March ${aumL.date.slice(0, 4)}`;
  const salesL = lastOf(lqB, "sales");
  N["n-sales"] = p1(salesL.v).replace("%", pc("%"));
  N["d-sales"] = `${qtr(salesL.date)}, <b>${lqB.series.companies.data[salesL.i].toLocaleString("en-IN")}</b> companies`;
  const { cur: spfCur, next: spfNext } = spfLatest(BK);
  if (spfCur) { N["n-spf"] = spfCur.last[1].toFixed(1) + pc("%"); N["d-spf"] = `for ${esc(spfCur.target)}, survey of ${monthOf(spfCur.last[0])}`; }

  // § 02 lived reality: of every hundred rupees put into financial assets
  { const g = fA("gross"), r = (k) => "₹" + Math.round((100 * fA(k)) / g).toString().replace("-", MINUS);
    for (const k of ["dep", "pf", "ins", "mf", "cash", "ss", "eq"]) N["lr-" + k] = r(k);
    N["lr-borrow"] = "₹" + Math.round((100 * fA("liab")) / g);
    N["lr-net"] = fmt.pct1(lastOf(flowsAB, NET).v); }

  // § 04
  N["pv-flows"] = lc(fA("gross"));
  for (const [id, k] of [["dep", "dep"], ["pf", "pf"], ["ins", "ins"], ["mf", "mf"], ["cash", "cash"], ["eq", "eq"]]) N["ex-fl-" + id] = lc(fA(k));
  N["ex-fl-mf0"] = lc(fA("mf", 0));
  N["pv-net"] = fmt.pct1(net.v);
  N["ex-net-g"] = fmt.pct1(flowsB.series[GROSS].data[net.i]); N["ex-net-l"] = fmt.pct1(flowsB.series[LIABK].data[net.i]);
  N["ex-net-n"] = fmt.pct1(net.v); N["ex-net-y"] = fmt.pct1(flowsB.series[NET].data[net.i - 4]);

  // § 05 (shares computed from the RBI's rupee figures, unrounded here as before)
  { const T = longB.series["10_changes_in_financial_assets_2_to_10"].data;
    const sh = (k) => longB.dates.map((d, i) => (longB.series[k].data[i] == null || !T[i] ? null : (100 * longB.series[k].data[i]) / T[i]));
    const last = (a) => a.filter((v) => v != null).at(-1);
    const dep = sh("02_bank_deposits");
    N["pv-long"] = fmt.pct1(last(dep)); N["ex-long-dep"] = fmt.pct1(last(dep)); N["ex-long-sh"] = fmt.pct1(last(sh("07_shares_and_debentures")));
    N["ex-long-pf"] = fmt.pct1(last(sh("05_provident_and_pension_fund"))); N["ex-long-ins"] = fmt.pct1(last(sh("04_life_insurance_fund")));
    N["ex-long-dep0"] = fmt.pct1(dep[0]); }

  // § 06
  { const S = stocksB.series, { rows, debtK, i } = stockRows(), find = (re) => Object.keys(S).find((k) => re.test(k));
    const aK = find(/^gross_financial_assets_financial_assets_a_b_c_d_e_f_g_h$/), agK = find(/^gross_financial_assets_per_cent_of_gdp/), lgK = find(/^financial_liabilities_per_cent_of_gdp/);
    N["pv-stocks"] = fmt.pct1(S[agK].data[i]);
    N["ex-st-a"] = lc(S[aK].data[i]); N["ex-st-ag"] = fmt.pct1(S[agK].data[i]); N["ex-st-l"] = lc(S[debtK].data[i]); N["ex-st-lg"] = fmt.pct1(S[lgK].data[i]);
    const row = (l) => rows.find((r) => r.label === l).v * 1e5;
    N["ex-st-dep"] = lc(row("Bank deposits")); N["ex-st-eq"] = lc(row("Shares (equity)")); N["ex-st-mf"] = lc(row("Mutual funds")); }

  // § 07
  N["pv-aum"] = lc(aumL.v); N["ex-aum"] = lc(aumL.v);
  N["ex-aum-y"] = p1(100 * (aumL.v / aumB.series.aum.data[aumL.i - 1] - 1)); N["ex-aum-5"] = lc(aumB.series.aum.data[aumL.i - 5]);
  { const H = BK.houses ?? [];
    N["pv-houses"] = lc(BK.housesTotal);
    if (H.length) {
      N["ex-h-top"] = esc(H[0].label); N["ex-h-topv"] = tc(H[0].v);
      N["ex-h-top5"] = fmt.pct0((100 * H.slice(0, 5).reduce((s, h) => s + h.v, 0)) / BK.housesTotal);
      N["ex-h-neg"] = fmt.count(H.filter((h) => h.v < 0).length);
    } }
  { const L = (k) => lastOf(sponsorB, k).v;
    N["pv-sponsor"] = tc(L("private"));
    N["ex-sp-p"] = tc(L("private")); N["ex-sp-b"] = tc(L("bank")); N["ex-sp-u"] = tc(L("uti")); N["ex-sp-t"] = tc(L("total")); }

  // § 08
  { const gm = lastOf(goldB, "gold_mumbai"), sv = lastOf(goldB, "silver_mumbai"), sp = lastOf(goldB, "gold_spread");
    N["pv-gold"] = fmt.inrR(gm.v); N["ex-g-m"] = fmt.inrR(gm.v); N["ex-g-s"] = fmt.inrR(sv.v);
    N["ex-g-sp"] = `${sp.v < 0 ? MINUS : ""}${fmt.inrR(Math.abs(sp.v))} (${monthOf(sp.date)})`; }

  // § 09
  { const eL = lastOf(issuesAB, "equity"), bL = lastOf(issuesAB, "bonds");
    N["pv-issues"] = lc2(eL.v); N["ex-is-eq"] = lc2(eL.v); N["ex-is-b"] = tc(bL.v);
    N["ex-is-mn"] = fmt.count(lastOf(issuesB, "equity_n").v); N["ex-is-mv"] = tc(lastOf(issuesB, "equity").v); }
  { const lst = (rows) => rows.filter((r) => r[1] != null).at(-1);
    const yAgo = (rows) => { const l = lst(rows); const t = new Date(new Date(l[0] + "T00:00:00Z").getTime() - 365 * 864e5).toISOString().slice(0, 10); return rows.filter((r) => r[1] != null && r[0] <= t).at(-1); };
    N["pv-cp"] = lc2(lst(BK.cp)[1]); N["ex-cp"] = lc2(lst(BK.cp)[1]); N["ex-cd"] = lc2(lst(BK.cd)[1]);
    N["ex-cp-y"] = lc2(yAgo(BK.cp)[1]); N["ex-cd-y"] = lc2(yAgo(BK.cd)[1]); }

  // § 10
  { const nL = lastOf(mcapB, "nse");
    N["pv-mcap"] = lc(nL.v); N["ex-mc-n"] = lc(nL.v); N["ex-mc-b"] = lc(lastOf(mcapB, "bse").v); N["ex-mc-ny"] = lc(mcapB.series.nse.data[nL.i - 12]); }
  { const { o, c } = derivSeries(BK);
    const oi = o.map((p) => p[1] != null).lastIndexOf(true), oL = o[oi], cL = c[oi];
    N["pv-turnover"] = cL?.[1] ? `${Math.round(oL[1] / cL[1])}${pc("×")}` : "—";
    N["ex-to-o"] = lc(oL[1] * 1e5); N["ex-to-c"] = cL?.[1] ? lc(cL[1] * 1e5) : "—"; }

  // § 11
  { const s = lastOf(lqB, "sales");
    N["pv-listed"] = p1(s.v);
    N["ex-ls-n"] = lqB.series.companies.data[s.i].toLocaleString("en-IN"); N["ex-ls-s"] = p1(s.v); N["ex-ls-o"] = p1(lqB.series.opr_pft.data[s.i]);
    N["ex-ls-p"] = p1(lqB.series.net_pft.data[s.i]); N["ex-ls-w"] = p1(lqB.series.expd_staff_cost.data[s.i]); }
  { const k = SECT, L = (x) => lastOf(lqsB, x).v;
    N["pv-sectors"] = p1(L(k.m)); N["ex-sec-m"] = p1(L(k.m)); N["ex-sec-i"] = p1(L(k.i)); N["ex-sec-s"] = p1(L(k.s)); }
  { const c = lastOf(lqrB, "int_cvg");
    N["pv-coverage"] = fmt.x1(c.v); N["ex-cv-i"] = fmt.x1(c.v); N["ex-cv-p"] = fmt.pct1(lastOf(lqrB, "net_pft_to_sal").v); N["ex-cv-is"] = fmt.pct1(lastOf(lqrB, "int_to_sal").v); }
  { const R = industryRows(BK);
    const sorted = R.map((r) => r.v).sort((a, b) => a - b), med = sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
    N["pv-industries"] = `${fmt.count(R.filter((r) => r.v > 10).length)} of ${fmt.count(R.length)}`;
    if (R.length) {
      N["ex-in-hi"] = `${esc(R[0].label)}, ${p1(R[0].v)}`; N["ex-in-lo"] = `${esc(R.at(-1).label)}, ${p1(R.at(-1).v)}`;
      N["ex-in-med"] = p1(med); N["ex-in-neg"] = fmt.count(R.filter((r) => r.v < 0).length); N["ex-in-n"] = fmt.count(R.length);
    } }
  for (const view of BK.rbiViews ?? []) { N["pv-" + view.id] = `${view.available} / ${view.total}`; N["ex-" + view.id] = `${view.available} of ${view.total}`; }

  // § 12
  { const L = (b) => lastOf(b, "net_sales").v;
    N["pv-studies"] = p1(L(pubG));
    N["ex-st-pub"] = p1(L(pubG)); N["ex-st-pvt"] = p1(L(pvtG)); N["ex-st-fdi"] = p1(L(fdiG));
    N["ev-st-pub"] = (lastOf(pubG, "companies")?.v ?? 0).toLocaleString("en-IN"); N["ev-st-pvt"] = (lastOf(pvtG, "companies")?.v ?? 0).toLocaleString("en-IN"); N["ev-st-fdi"] = (lastOf(fdiG, "companies")?.v ?? 0).toLocaleString("en-IN"); }
  N["pv-debt"] = fmt.pct1(lastOf(pubR, "debt_to_equity").v);
  N["ex-dt-pub"] = fmt.pct1(lastOf(pubR, "debt_to_equity").v); N["ex-dt-pvt"] = fmt.pct1(lastOf(pvtR, "debt_to_equity").v);

  // § 13
  if (spfCur) {
    N["pv-spf"] = spfCur.last[1].toFixed(1) + pc("%"); N["pv-spf-y"] = esc(spfCur.target);
    N["ex-spf-y"] = esc(spfCur.target); N["ex-spf-v"] = fmt.pct1(spfCur.last[1]);
    N["ex-spf-n"] = spfNext ? `${fmt.pct1(spfNext.last[1])} (${esc(spfNext.target)})` : "—";
  }
  const cpi = (BK.cpiNew ?? []).map((x) => ({ ...x, last: x.data.at(-1) })).filter((x) => x.last && x.last[0] === spfCur?.last[0]).sort((a, b) => (a.target < b.target ? -1 : 1))[0];
  if (cpi) { N["ex-spf-q"] = esc(cpi.target.replace(":", " ")); N["ex-spf-c"] = fmt.pct1(cpi.last[1]); }
  return N;
}

const SECT = { m: "icc_manf__sales", i: "icc_srv_it__sales", s: "icc_srv_non_it__sales" };
const industryRows = (BK) => (BK.industries ?? []).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
// NSE index options and cash-market turnover, ₹ lakh crore a month; the RBI's misprinted months
// are left off the chart (kept in the data), as are blanks and zeros a log scale cannot hold
function derivSeries(BK) {
  const D = BK.deriv ?? { dates: [], index_options: [], cash: [], anomalies: [] }, skip = new Set(D.anomalies ?? []);
  const mk = (arr) => D.dates.map((d, i) => [d, arr[i] == null || arr[i] <= 0 || skip.has(d) ? null : arr[i] / 1e5]);
  return { o: mk(D.index_options), c: mk(D.cash) };
}

/* ---------------- the plates ---------------- */
// spec may be a function of the drawing's width, for a plate that needs a different phone drawing
const lineFig = (file, label, spec, data = null) => figure({ bare: true, file: "india-atlas_markets-" + file, label, data, draw: (width) => K.line({ width, ...(typeof spec === "function" ? spec(width) : spec) }) });
const PHONE = 520;

/** § 01: the title block's small line of net financial saving. */
export const sparkNet = () => K.spark(ser(flowsB, NET), { width: 190, height: 44 });

/** § 04: what households added to each asset in the latest year, the first year as a circle. */
export function flows() {
  const L = { dep: "Deposits", pf: "Provident and pension funds", ins: "Life insurance", mf: "Mutual funds", ss: "Small savings", cash: "Currency", eq: "Shares, bought directly" };
  const y0 = fy(flowsAB.dates[0]), y1 = fy(flowsAB.dates.at(-1));
  const rows = Object.entries(L).map(([k, name]) => ({ name, value: r1(fA(k) / 1e5), mark: fA(k, 0) == null ? null : r1(fA(k, 0) / 1e5) })).sort((a, b) => b.value - a.value);
  rows[0].highlight = true;
  return figure({
    bare: true, file: "india-atlas_markets-flows",
    label: `Households' net additions to each financial asset in ${y1}, ₹ lakh crore, ranked, with ${y0} marked as a circle on each row`,
    data: { cols: ["Asset", `${y1}, ₹ lakh crore`, `${y0}, ₹ lakh crore`], rows: rows.map((r) => [r.name, r.value, r.mark]) },
    draw: (width) => K.bars({ width, rows, unit: LCR, dp: 1, markName: y0, markFmt: (v) => `${y0}: ${K.num(v, { dp: 1 })}` }),
  });
}

/** § 04: gross saving, borrowing and the net between them, per cent of GDP, quarterly. */
export function net() {
  return lineFig("net", "Households' gross financial saving, borrowing and net financial saving, per cent of GDP, quarterly", {
    freq: "quarter", unit: PCT, endDp: 1,
    series: [
      { name: "Gross financial saving", data: ser(flowsB, GROSS), role: "ctx" },
      { name: "Borrowing", data: ser(flowsB, LIABK), role: "comp" },
      { name: "Net financial saving", data: ser(flowsB, NET), role: "lead" },
    ],
  });
}

/** § 05: fifty years of each instrument's share of the year's financial saving. */
export function long() {
  return lineFig("long", "Shares of households' gross financial saving held in bank deposits, provident and pension funds, life insurance and shares, per cent, every year since 1970-71", {
    freq: "fy", unit: PCT, endDp: 1, yCount: 7,
    series: [
      { name: "Life insurance", data: longShare("04_life_insurance_fund"), role: "ctx2" },
      { name: "Provident and pension", data: longShare("05_provident_and_pension_fund"), role: "ctx" },
      { name: "Shares and debentures", data: longShare("07_shares_and_debentures"), role: "comp" },
      { name: "Bank deposits", data: longShare("02_bank_deposits"), role: "lead" },
    ],
  });
}

/** § 06: the household balance sheet, assets ranked and all loans below zero. */
export function stocks() {
  const { rows } = stockRows();
  const R = rows.map((r, i) => ({ name: r.label, value: r1(r.v), highlight: i === 0 }));
  return figure({
    bare: true, file: "india-atlas_markets-stocks",
    label: `Households' financial assets by instrument at the end of ${qtr(stocksB.dates.at(-1))}, ₹ lakh crore, ranked, with all loans owed shown as a negative bar`,
    data: { cols: ["Item", `${qtr(stocksB.dates.at(-1))}, ₹ lakh crore (debt negative)`], rows: R.map((r) => [r.name, r.value]) },
    draw: (width) => K.bars({ width, rows: R, unit: LCR, dp: 1, sort: false }),
  });
}

/** § 07: mutual fund assets, end-March. */
export function aum() {
  return lineFig("aum", "Assets under management of all mutual funds, ₹ lakh crore, end-March of each year", {
    freq: "month", unit: LCR, endFormat: lcrEnd, hoverDp: 1,
    series: [{ name: "All funds", data: ser(aumB, "aum", 1e-5), role: "lead" }],
  });
}

/** § 07: net money into each fund house, the twenty largest. */
export function houses(BK) {
  const H = (BK.houses ?? []).slice(0, 20), y = fy(BK.housesDate);
  const rows = H.map((h, i) => ({ name: h.label, value: h.v / 1000, highlight: i === 0 }));
  const hi = Math.max(0, ...rows.map((r) => r.value)), topTick = K.nice(Math.min(0, ...rows.map((r) => r.value)), hi, 4).ticks.filter((t) => t <= hi).at(-1);
  return figure({
    bare: true, file: "india-atlas_markets-houses",
    label: `Net money put into each of the twenty largest fund houses in ${y}, ₹ thousand crore, ranked`,
    data: { cols: ["Fund house", `${y}, ₹ crore`], rows: H.map((h) => [h.label, Math.round(h.v)]) },
    draw: (width) => K.bars({ width, rows, sort: false, nameMax: 300, fmt: (v) => K.num(v * 1000, { dp: 0, prefix: "₹", suffix: " crore" }), tickFmt: (v) => K.num(v, { dp: 0, suffix: v === topTick ? " thousand cr" : "" }) }),
  });
}

/** § 07: net inflows by sponsor, private funds against UTI and the bank-sponsored funds. */
export function sponsor() {
  const s = (k) => ser(sponsorB, k, 1e-3, "1987-04-01", (v) => Math.round(v * 1000) / 1000);
  return lineFig("sponsor", "Net resources mobilised by mutual funds by sponsor, private, bank-sponsored and UTI, ₹ thousand crore, every year since 1987-88", {
    freq: "fy", unit: { prefix: "₹", suffix: " thousand cr" }, hoverDp: 1, endFormat: (v) => K.num(Math.round(v * 1000), { dp: 0, prefix: "₹", suffix: " cr" }),
    series: [
      { name: "UTI", data: s("uti"), role: "ctx" },
      { name: "Bank-sponsored", short: "Banks", data: s("bank"), role: "comp" },
      { name: "Private", data: s("private"), role: "lead" },
    ],
  });
}

/** § 08: gold in Mumbai against London's price in rupees. */
export function gold() {
  const s = (k) => ser(goldB, k, 1, null, Math.round);
  return lineFig("gold", "Monthly average price of ten grams of gold in Mumbai, and the London price converted to rupees", {
    freq: "month", unit: { prefix: "₹" }, endDp: 0, hoverDp: 0,
    series: [
      { name: "London, in rupees", short: "London", data: s("gold_london_inr"), role: "comp" },
      { name: "Mumbai", data: s("gold_mumbai"), role: "lead" },
    ],
  });
}

/** § 09: new shares and bonds sold to the public each year. */
export function issues() {
  return lineFig("issues", "New capital raised from the public by companies each year, equity and bonds, ₹ lakh crore", {
    freq: "fy", unit: LCR, endFormat: lcrEnd, hoverDp: 1,
    series: [
      { name: "Bonds", data: ser(issuesAB, "bonds", 1e-5), role: "comp" },
      { name: "Equity", data: ser(issuesAB, "equity", 1e-5), role: "lead" },
    ],
  });
}

/** § 09: commercial paper and certificates of deposit outstanding, fortnightly. */
export function cpcd(BK) {
  const s = (rows) => (rows ?? []).map(([d, v]) => [d, v == null ? null : r1(v / 1e5)]);
  return lineFig("cpcd", "Commercial paper and certificates of deposit outstanding, ₹ lakh crore, fortnightly", {
    freq: "month", unit: LCR, endFormat: lcrEnd, hoverDp: 1,
    series: [
      { name: "Certificates of deposit", data: s(BK.cd), role: "comp" },
      { name: "Commercial paper", data: s(BK.cp), role: "lead" },
    ],
  });
}

/** § 10: market capitalisation of the NSE and BSE, end of month. */
export function mcap() {
  // the two exchanges' lines nearly coincide: on a phone only the NSE, the plate's subject, is named
  return lineFig("mcap", "Market capitalisation of companies listed on the NSE and BSE, end of month, ₹ lakh crore", (w) => ({
    freq: "month", unit: LCR, endFormat: lcrEnd, hoverDp: 1,
    series: [
      { name: "BSE", data: ser(mcapB, "bse", 1e-5, "1994-11-01"), role: "comp", label: w >= PHONE },
      { name: "NSE", data: ser(mcapB, "nse", 1e-5, "1994-11-01"), role: "lead" },
    ],
  }));
}

/** § 10: index options against shares traded, NSE, on a log scale. */
export function turnover(BK) {
  const { o, c } = derivSeries(BK);
  const rr = (P) => P.map(([d, v]) => [d, v == null ? null : v >= 1000 ? Math.round(v) : v >= 1 ? r1(v) : +v.toPrecision(2)]);
  const fmtV = (v) => K.num(v, { dp: v >= 1000 ? 0 : v >= 1 ? 1 : 3, prefix: "₹", suffix: " lakh cr" });
  return lineFig("turnover", "NSE: value of shares traded in the cash market and notional value of index options traded, ₹ lakh crore a month, logarithmic scale", {
    log: true, freq: "month", unit: LCR, endFormat: fmtV, hoverDp: 1,
    series: [
      { name: "Shares", data: rr(c), role: "ctx" },
      { name: "Index options", short: "Options", data: rr(o), role: "lead" },
    ],
  }, { cols: ["Month", "Shares traded, ₹ lakh crore", "Index options, notional, ₹ lakh crore"], rows: o.map(([d, v], i) => [d, c[i][1] == null ? null : +c[i][1].toPrecision(6), v == null ? null : +v.toPrecision(6)]) });
}

/** § 11: listed companies' sales and operating profit, growth on a year earlier. */
export function listed() {
  return lineFig("listed", "Listed private non-financial companies: growth in sales and operating profit on a year earlier, per cent, quarterly", {
    freq: "quarter", unit: PCT, endDp: 1,
    series: [
      { name: "Operating profit", data: ser(lqB, "opr_pft"), role: "ctx" },
      { name: "Sales", data: ser(lqB, "sales"), role: "lead" },
    ],
  });
}

/** § 11: sales growth by sector. */
export function sectors() {
  return lineFig("sectors", "Sales growth of listed private companies in manufacturing, IT and other services, on a year earlier, per cent, quarterly", {
    freq: "quarter", unit: PCT, endDp: 1,
    series: [
      { name: "Other services", data: ser(lqsB, SECT.s), role: "ctx" },
      { name: "IT", data: ser(lqsB, SECT.i), role: "comp" },
      { name: "Manufacturing", data: ser(lqsB, SECT.m), role: "lead" },
    ],
  });
}

/** § 11: interest coverage, times. */
export function coverage() {
  return lineFig("coverage", "Interest coverage of listed private non-financial companies, earnings before interest and tax divided by interest, times, quarterly", {
    freq: "quarter", unit: { suffix: "×" }, endDp: 1,
    series: [{ name: "Interest coverage", data: ser(lqrB, "int_cvg"), role: "lead" }],
  });
}

/** § 11: sales growth in every leaf industry, ranked. */
export function industries(BK) {
  const R = industryRows(BK), q = qtr(BK.industriesDate);
  const rows = R.map((r, i) => ({ name: r.label, value: r1(r.v), highlight: i === 0 }));
  return figure({
    bare: true, file: "india-atlas_markets-industries",
    label: `Sales growth of listed private companies by industry on a year earlier, ${q}, per cent, ranked`,
    data: { cols: ["Industry", `${q}, sales growth, per cent`, "Same quarter a year earlier, per cent"], rows: R.map((r) => [r.label, r1(r.v), r1(r.y)]) },
    draw: (width) => K.bars({ width, rows, unit: PCT, dp: 1, sort: false, nameMax: 360 }),
  });
}

/** The RBI listed-company views: every published group as a bar, a study's history as columns. */
export function rbiView(view, load) {
  const u = view.unit;
  const big = u === "inr_crore" && Math.max(...view.rows.map((r) => Math.abs(r.value ?? 0))) >= 1e5;
  const f = u === "count" ? (v) => K.num(v, { dp: 0 }) : u === "times" ? (v) => K.num(v, { dp: 1, suffix: "×" }) : u === "inr_crore" ? (v) => K.num(v, { dp: 0, prefix: "₹", suffix: " crore" }) : (v) => K.num(v, { dp: 1, suffix: "%" });
  const vals = view.rows.map((r) => r.value).filter((v) => v != null), hiV = Math.max(0, ...vals);
  const topTick = K.nice(Math.min(0, ...vals), hiV, 4).ticks.filter((t) => t <= hiV).at(-1);
  const tick = u === "inr_crore" && big ? (v) => K.num(v / 1e5, { dp: 0, suffix: v === topTick ? " lakh cr" : "" }) : null;
  const unitName = u === "count" ? "companies" : u === "times" ? "times" : u === "inr_crore" ? "₹ crore" : "per cent";
  const data = { cols: ["Group", unitName], rows: view.rows.map((r) => [r.label, r.value]) };
  if (view.history) {
    const b = load(view.bundle), dates = b.dates;
    const P = view.rows.map((r, j) => [dates[j], r.value == null ? null : u === "count" ? r.value : r1(r.value)]);
    return figure({
      bare: true, file: `india-atlas_markets-${view.bundle}-${view.item}`, data,
      label: `${view.title}: ${unitName}, every ${view.f === "a" ? "year" : "quarter"} of the study`,
      draw: (width) => K.columns({ width, data: P, freq: view.f === "a" ? "fy" : "quarter", unit: u === "pct" ? PCT : {}, valueDp: u === "count" ? 0 : 1, dp: undefined }),
    });
  }
  const rows = view.rows.filter((r) => r.value != null).map((r) => ({ name: r.label, value: r.value, highlight: /^all companies$/i.test(r.label) }));
  return figure({
    bare: true, file: `india-atlas_markets-${view.bundle}-${view.item}`, data,
    label: `${view.title}: ${unitName}, every published group`,
    draw: (width) => K.bars({ width, rows, sort: false, fmt: f, nameMax: 360, ...(tick ? { tickFmt: tick } : {}), ...(u === "pct" ? { unit: PCT } : u === "times" ? { unit: { suffix: "×" } } : {}) }),
  });
}

/** § 12 and the debt plate: each company type across the two reporting formats, never joined. */
function studyLines(file, label, pairs, oldKey, newKey, unitEnd) {
  const roles = ["lead", "comp", "ctx"], series = [];
  pairs.forEach(([old, cur, name], j) => {
    series.push({ name: `${name}, old format`, data: ser(old, oldKey), role: roles[j], label: false });
    series.push({ name, data: ser(cur, newKey), role: roles[j] });
  });
  // context first, the lead last (drawn on top)
  series.sort((a, b) => roles.indexOf(b.role) - roles.indexOf(a.role));
  const all = series.flatMap((s) => s.data.map((p) => p[0])).sort();
  return lineFig(file, label, {
    freq: "fy", unit: PCT, endDp: 1, tDomain: [K.tnum(all[0]), K.tnum(all.at(-1))],
    seam: { t: "2019-04-01", before: "Old format", after: "Ind AS" },
    series: series.map((s) => ({ ...s, data: s.data.filter((p) => p[1] != null) })),
  });
}
export function studies() {
  return studyLines("studies", "Sales growth of public limited, private limited and foreign-owned companies on the year before, per cent, from each year's RBI study; the old format to 2018-19 and Ind AS from 2020-21 drawn apart",
    [[pubG0, pubG, "Public limited"], [pvtG0, pvtG, "Private limited"], [fdiG0, fdiG, "Foreign-owned"]], "sales", "net_sales");
}
export function debt() {
  return studyLines("debt", "Debt to equity of public and private limited companies, per cent, from each year's RBI study; the old format to 2018-19 and Ind AS from 2020-21 drawn apart",
    [[pubR0, pubR, "Public limited"], [pvtR0, pvtR, "Private limited"]], "debt_to_equity", "debt_to_equity");
}

/** § 13: forecasters' medians for this year and next, the old GDP base and the new drawn apart. */
export function spf(BK) {
  const nT = pickSpf(BK.spfNew, false), nN = pickSpf(BK.spfNew, true), oT = pickSpf(BK.spfOld, false), oN = pickSpf(BK.spfOld, true);
  // the old base's two lines carry no end label: each is named once, where the plot is empty
  // around it (this year from above, in early 2022; next year from below, in early 2024)
  const near = (P, d) => P.filter((p) => p[1] != null).reduce((a, b) => (Math.abs(K.tnum(b[0]) - K.tnum(d)) < Math.abs(K.tnum(a[0]) - K.tnum(d)) ? b : a));
  const tA = near(oT, "2022-01-01");
  return lineFig("spf", "Median forecast of real GDP growth at each survey round, for the fiscal year in progress and the year ahead, per cent; the old GDP base and the new drawn apart", (w) => ({
    freq: "month", unit: PCT, endDp: 1, zero: false,
    seam: { t: nT[0]?.[0] ?? nN[0][0], before: "Old GDP base", after: "New base" },
    notes: [
      { d: tA[0], v: tA[1], text: "This year, old base", side: "right" },
      { d: near(oN, w >= PHONE ? "2024-01-01" : "2023-01-01")[0], v: near(oN, w >= PHONE ? "2024-01-01" : "2023-01-01")[1], text: "Next year, old base", side: "right", below: true },
    ],
    series: [
      { name: "This year, old base", data: oT, role: "ctx2", label: false },
      { name: "Next year, old base", data: oN, color: K.C.leadSoft, role: "ctx", label: false },
      { name: "This year", data: nT, role: "ctx" },
      { name: "Next year", data: nN, role: "lead" },
    ],
  }));
}
