// External account guide: the plates, drawn at build time with the chart kit (src/kit/), and every
// number the page quotes. Each plate export returns a bare figure for its .plotzone; titles, source
// lines and buttons stay in src/pages/guides/external.astro.
//
// Data: data/series/external-*.json (RBI DBIE via the Data Bank). Amounts arrive in US$ million
// (₹ crore where named) and the page speaks in US$ billion; indices and rates as published.
// Seams kept apart: RBI's overall-BoP layout is the only BoP drawn here (the BPM6 table is
// downloadable, never mixed in); the REER is drawn on its current 2015-16 base only.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";
import bopB from "../../data/series/external-bop.json";
import grossB from "../../data/series/external-bop-gross.json";
import vintB from "../../data/series/external-bop-vintages.json";
import indB from "../../data/series/external-bop-indicators.json";
import annB from "../../data/series/external-bop-annual-head.json";
import pplB from "../../data/series/external-invisibles-people.json";
import iipB from "../../data/series/external-iip-head.json";
import resWB from "../../data/series/external-reserves-weekly.json";
import resMB from "../../data/series/external-reserves-monthly.json";
import intB from "../../data/series/external-intervention.json";
import fbB from "../../data/series/external-forward-book.json";
import rupB from "../../data/series/external-rupee.json";
import reerB from "../../data/series/external-reer-2015.json";
import fdiB from "../../data/series/external-fdi.json";
import fpiB from "../../data/series/external-fpi.json";
import lrsB from "../../data/series/external-lrs.json";
import debtB from "../../data/series/external-debt-annual.json";
import sectB from "../../data/series/external-debt-sector-inr.json";
import nriB from "../../data/series/external-nri.json";
import invB from "../../data/series/external-invoicing.json";

const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pc = (u) => `<span class="pc">${u}</span>`;
const bn = (v) => fmt.bnFixed1(v / 1000);             // US$ million -> "−$4.2 bn"
const bnR = (v) => fmt.bnRound(v / 1000);             // "$748 bn"
const ms = (iso) => Date.parse(iso + "T00:00:00Z");
const qLabel = (iso) => { const m = +iso.slice(5, 7) - 1; return `${MS[m]} to ${MS[m + 2]} ${iso.slice(0, 4)}`; };
const qLong = (iso) => { const m = +iso.slice(5, 7) - 1; return `${MF[m]} to ${MF[m + 2]} ${iso.slice(0, 4)}`; };
const fyLabel = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const monLabel = (iso) => `${MS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const dayLabel = (iso) => `${+iso.slice(8, 10)} ${MS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const sum = (xs) => xs.reduce((a, x) => a + x, 0);
// chart text: the kit's own number format (a true minus, no joiners the chart face lacks)
const cbn = (v, dp = 1) => K.num(v, { dp, prefix: "$", suffix: " bn" });
const BN = { prefix: "$", suffix: " bn" };

// a bundle as {key: {data: [{date, value}]}} with ISO dates
const hyd = (b) => Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, { data: s.data.map((v, i) => ({ date: b.dates[i], value: v ?? null })) }]));
const lastPt = (s) => { for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i].value != null) return s.data[i]; return null; };
const peakOf = (s) => { let p = null; for (const d of s.data) if (d.value != null && (!p || d.value > p.value)) p = d; return p ?? s.data[0]; };
const troughOf = (s) => { let p = null; for (const d of s.data) if (d.value != null && (!p || d.value < p.value)) p = d; return p ?? s.data[0]; };
const since = (s, from) => ({ data: s.data.filter((d) => d.date >= from) });
const scaled = (s, k = 1 / 1000) => ({ data: s.data.map((d) => ({ date: d.date, value: d.value == null ? null : d.value * k })) });
const P = (s) => s.data.map((d) => [d.date, d.value]);   // kit pairs

const B = hyd(bopB), G = hyd(grossB), IND = hyd(indB), AN = hyd(annB), PPL = hyd(pplB), IIP = hyd(iipB);
const RW = hyd(resWB), RM = hyd(resMB), IV = hyd(intB), FB = hyd(fbB), RU = hyd(rupB), RE = hyd(reerB);
const FD = hyd(fdiB), FP = hyd(fpiB), LR = hyd(lrsB), DA = hyd(debtB), DS = hyd(sectB), NR = hyd(nriB), INV = hyd(invB);

const ca = lastPt(B.current_account);
const res = lastPt(RW.total_usd);
const usd = lastPt(RU.usd), usdYear = RU.usd.data.find((d) => d.date === `${+usd.date.slice(0, 4) - 1}${usd.date.slice(4, 7)}-01`);
const reer = lastPt(RE.reer_trade), neer = lastPt(RE.neer_trade);

/* ================= §02 the current account ================= */
const caQ = scaled(since(B.current_account, "2010-04-01"));
export function caPlate() {
  const tr = troughOf(caQ);
  return figure({
    bare: true, file: "india-atlas_current-account_quarterly",
    label: `India's current account balance every quarter since 2010-11, US$ billion; deepest deficit ${cbn(tr.value)} in ${qLabel(tr.date)}, latest ${cbn(lastPt(caQ).value)} in ${qLabel(lastPt(caQ).date)}`,
    data: { cols: ["Quarter (first month)", "Current account, US$ billion"], rows: P(caQ) },
    draw: (width) => K.columns({ width, data: P(caQ), freq: "quarter", unit: BN, fmt: (v) => cbn(v), events: [{ t: tr.date.slice(0, 7), label: `${cbn(tr.value)}\n${qLabel(tr.date)}` }] }),
  });
}
export function cagdp() {
  const s = IND.cad_to_gdp, tr = troughOf(s);
  return figure({
    bare: true, file: "india-atlas_current-account-gdp_annual",
    label: "India's current account balance as a share of GDP, fiscal years since 1970-71, with a deficit of 3% of GDP marked",
    data: { cols: ["Fiscal year (from April)", "Current account, % of GDP"], rows: P(s) },
    draw: (width) => K.line({
      width, freq: "fy", unit: { suffix: "%" }, endDp: 1,
      refs: [{ y: -3, label: "3% deficit" }],
      notes: [{ d: tr.date, v: tr.value, text: `${K.num(tr.value, { dp: 1, suffix: "%" })}, ${fyLabel(tr.date)}`, below: true }],
      series: [{ name: "Current account", short: "Current account", data: P(s), role: "lead" }],
    }),
  });
}

/* ================= §03 what fills the gap ================= */
export function parts() {
  const L = (k, name, role) => ({ name, short: name, data: P(scaled(since(B[k], "2011-04-01"))), role });
  return figure({
    bare: true, file: "india-atlas_current-account-parts_quarterly",
    label: "The parts of India's current account, net, US$ billion every quarter since 2011-12: goods, services, remittances and income",
    draw: (width) => K.line({ width, freq: "quarter", unit: BN, endDp: 1, series: [L("income", "Income", "ctx2"), L("services", "Services", "ctx"), L("private_transfers", "Remittances", "comp"), L("goods", "Goods", "lead")] }),
  });
}
export function long() {
  const L = (k, name, role) => ({ name, short: name, data: P(scaled(AN[k])), role });
  return figure({
    bare: true, file: "india-atlas_bop-since-1950_annual",
    label: "India's current account, goods and invisibles, net, US$ billion, fiscal years since 1950-51",
    draw: (width) => K.line({ width, freq: "fy", unit: BN, endDp: 1, series: [L("goods", "Goods", "ctx"), L("invisibles", "Invisibles", "comp"), L("current_account", "Current account", "lead")] }),
  });
}

/* ================= §04 money home, money out ================= */
export function remit() {
  return figure({
    bare: true, file: "india-atlas_remittances-received_quarterly",
    label: "Private transfers received from abroad, US$ billion a quarter, since 1990-91",
    draw: (width) => K.line({ width, freq: "quarter", unit: BN, endDp: 1, series: [{ name: "Remittances received", short: "Remittances", data: P(scaled(G.remittances_in)), role: "lead" }] }),
  });
}
const pplL = lastPt(PPL.remittances_received);
const pplAt = (k) => PPL[k].data.find((d) => d.date === pplL.date)?.value ?? null;
export function remitmix() {
  // [full name for the data, short name for the chart's name column]
  const rows = [["Sent home by Indians working abroad, for family", "Sent home for family", "family_remittances"], ["Withdrawn in India from NRI deposits", "NRI deposits withdrawn", "nri_withdrawals"],
    ["Gifts and donations", "Gifts and donations", "gifts_received"], ["Gold and silver in passengers' baggage", "Gold and silver in baggage", "gold_baggage"]]
    .map(([full, name, k]) => ({ full, name, value: pplAt(k) / 1000, highlight: k === "family_remittances" }));
  return figure({
    bare: true, file: "india-atlas_remittances-by-kind",
    label: "Private transfers received by kind, latest quarter, US$ billion: " + rows.map((r) => `${r.full} ${cbn(r.value)}`).join(", "),
    data: { cols: ["Kind", "US$ billion"], rows: rows.map((r) => [r.full, +r.value.toFixed(3)]) },
    draw: (width) => K.bars({ width, rows, unit: BN, dp: 1 }),
  });
}
// LRS: fiscal-year sums of RBI's monthly figures, complete years only (derived and labelled)
const LRS_GROUPS = [["Travel", ["travels"]], ["Relatives abroad", ["maintenance_of_close_relatives"]], ["Gifts", ["gift"]], ["Studies abroad", ["studies_abroad"]], ["Shares, bonds", ["investment_in_equity_debt"]],
  ["Deposits, property, other", ["deposit", "purchase_of_immovable_property", "donations", "medical_treatment", "others"]]];
const lrsFull = (() => {
  const fys = new Map();
  LR.total.data.forEach((d, i) => {
    if (d.value == null) return;
    const m = +d.date.slice(5, 7), y = m >= 4 ? +d.date.slice(0, 4) : +d.date.slice(0, 4) - 1;
    const e = fys.get(y) ?? { n: 0, g: LRS_GROUPS.map(() => 0), total: 0 };
    e.n++; e.total += d.value;
    LRS_GROUPS.forEach(([, ks], j) => { e.g[j] += sum(ks.map((k) => LR[k].data[i].value ?? 0)); });
    fys.set(y, e);
  });
  return [...fys.entries()].filter(([, e]) => e.n === 12).sort((a, b) => a[0] - b[0]);
})();
const fyOfY = (y) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
export function lrs() {
  const C = K.C;
  const parts = [{ name: "Travel", color: C.lead }, { name: "Relatives abroad", color: C.seq[3] }, { name: "Gifts", color: C.leadTint }, { name: "Studies abroad", color: C.comp }, { name: "Shares, bonds", color: C.ctx }, { name: "Deposits, property, other", color: C.ctx2 }];
  return figure({
    bare: true, file: "india-atlas_lrs-by-purpose_fiscal-years",
    label: `Outward remittances under the Liberalised Remittance Scheme by purpose, US$ billion, fiscal years ${fyOfY(lrsFull[0][0])} to ${fyOfY(lrsFull.at(-1)[0])}; travel is the largest purpose`,
    data: { cols: ["Fiscal year", ...LRS_GROUPS.map((g) => g[0] + ", US$ billion"), "Total, US$ billion"], rows: lrsFull.map(([y, e]) => [fyOfY(y), ...e.g.map((v) => +(v / 1000).toFixed(3)), +(e.total / 1000).toFixed(3)]) },
    draw: (width) => K.stackBars({ width, parts, sort: false, absolute: { unit: BN, dp: 1 }, rows: lrsFull.map(([y, e]) => ({ name: fyOfY(y), parts: e.g.map((v) => v / 1000), highlight: y === lrsFull.at(-1)[0] })) }),
  });
}

/* ================= §05 foreign money in and out ================= */
const fdiQ = scaled(since(B.fdi, "2010-04-01")), fpiQ = scaled(since(B.portfolio, "2010-04-01"));
export function flows() {
  return figure({
    bare: true, file: "india-atlas_fdi-portfolio_quarterly",
    label: "Net foreign direct investment and net portfolio investment, US$ billion a quarter, since 2010-11",
    draw: (width) => K.line({ width, freq: "quarter", unit: BN, endDp: 1, series: [{ name: "Portfolio investment, net", short: "Portfolio", data: P(fpiQ), role: "comp" }, { name: "Direct investment, net", short: "Direct", data: P(fdiQ), role: "lead" }] }),
  });
}
// FDI, monthly table: fiscal-year sums of gross inflows, repatriation and outward FDI (derived)
const FDI_K = [["Gross inflows into India", "a_i_a_gross_inflows_gross_investment"], ["Repatriated", "a_i_b_repatriation_disinvestment"], ["Indian investment abroad", "a_ii_foreign_direct_investment_by_i"]];
const fdiFull = (() => {
  const fys = new Map();
  FD[FDI_K[0][1]].data.forEach((d, i) => {
    if (d.value == null) return;
    const m = +d.date.slice(5, 7), y = m >= 4 ? +d.date.slice(0, 4) : +d.date.slice(0, 4) - 1;
    const e = fys.get(y) ?? { n: 0, v: FDI_K.map(() => 0) };
    e.n++; FDI_K.forEach(([, k], j) => { e.v[j] += FD[k].data[i].value ?? 0; });
    fys.set(y, e);
  });
  return [...fys.entries()].filter(([, e]) => e.n === 12).sort((a, b) => a[0] - b[0]);
})();
export function fdi() {
  const roles = ["lead", "comp", "ctx"], short = ["Gross inflows", "Repatriated", "Invested abroad"];
  const series = FDI_K.map(([name], j) => ({ name, short: short[j], role: roles[j], data: fdiFull.map(([y, e]) => [`${y}-04-01`, e.v[j] / 1000]) })).reverse();
  return figure({
    bare: true, file: "india-atlas_fdi-gross-repatriation_fiscal-years",
    label: "Foreign direct investment into India, repatriation by foreign investors, and Indian investment abroad, US$ billion, fiscal years",
    draw: (width) => K.line({ width, freq: "fy", unit: BN, endDp: 1, series }),
  });
}
const fpiM = since(FP.fpi_net, "2016-01-01");
const rsCr = (x) => (x < 0 ? "−₹" : "₹") + K.inGroup(Math.round(Math.abs(x))) + " cr";
export function fpi() {
  const data = fpiM.data.map((d) => [d.date, d.value == null ? null : d.value / 1000]);   // ₹ crore -> ₹ thousand crore
  return figure({
    bare: true, file: "india-atlas_fpi-net_monthly",
    label: `Net investment by foreign portfolio investors in Indian shares and bonds, ₹ thousand crore a month, since January 2016`,
    data: { cols: ["Month", "Net FPI investment, ₹ crore"], rows: P(fpiM) },
    draw: (width) => K.columns({ width, data, unit: { prefix: "₹", suffix: " thousand cr" }, fmt: (x) => rsCr(x * 1000) }),
  });
}

/* ================= §06 reserves ================= */
const resPeak = peakOf(RW.total_usd);
export function reserves() {
  const L = (k, name, short, role) => ({ name, short, data: P(scaled(RW[k])), role });
  return figure({
    bare: true, file: "india-atlas_forex-reserves_weekly",
    label: `India's foreign exchange reserves every week since April 2001, US$ billion: total ${bnR(res.value)} on ${dayLabel(res.date)}`,
    draw: (width) => K.line({ width, freq: "month", unit: BN, endDp: 0, series: [L("gold_usd", "Gold", "Gold", "comp"), L("fca_usd", "Foreign currency assets", "Currency assets", "ctx"), L("total_usd", "Total reserves", "Total", "lead")] }),
  });
}
// why reserves move: month-end change in reserves against the RBI's own net dollar purchases
const MOVE_FROM = "2023-08-01";
const resChg = (() => { const out = []; RM.total_usd.data.forEach((d, i) => { const p = RM.total_usd.data[i - 1]; if (i && d.date >= MOVE_FROM && d.value != null && p.value != null) out.push({ date: d.date, value: (d.value - p.value) / 1000 }); }); return out; })();
const resNet = IV.net.data.filter((d) => d.date >= MOVE_FROM && d.date <= resChg.at(-1).date).map((d) => ({ date: d.date, value: d.value == null ? null : d.value / 1000 }));
export function resmove() {
  return figure({
    bare: true, file: "india-atlas_reserves-change-vs-rbi-purchases",
    label: "Month-on-month change in total reserves (columns) against the RBI's net dollar purchases or sales in the same month (ticks), US$ billion, since August 2023",
    data: { cols: ["Month", "Change in reserves, US$ billion", "RBI net purchases, US$ billion"], rows: resChg.map((d) => [d.date, d.value, resNet.find((x) => x.date === d.date)?.value ?? null]) },
    draw: (width) => K.columns({ width, data: resChg.map((d) => [d.date, d.value]), unit: BN, fmt: (v) => cbn(v), marks: resNet.map((d) => [d.date, d.value]), markLabel: "RBI's net purchases (+) or sales (−)", markName: "RBI net purchases" }),
  });
}

/* ================= §07 the rupee ================= */
export function rupee() {
  return figure({
    bare: true, file: "india-atlas_usdinr_monthly",
    label: `Rupees per US dollar, monthly average, since April 1993, rising to ${fmt.inr2(usd.value)} in ${monLabel(usd.date)}; a higher number is a weaker rupee`,
    draw: (width) => K.line({ width, unit: { prefix: "₹" }, endDp: 2, series: [{ name: "₹ per US dollar", short: "₹ per dollar", data: P(since(RU.usd, "1993-04-01")), role: "lead" }] }),
  });
}
export function reerPlate() {
  return figure({
    bare: true, file: "india-atlas_reer-neer-40-currency_monthly",
    label: `The rupee against a 40-currency trade-weighted basket, real and nominal, index 2015-16 = 100: REER ${K.num(reer.value)} and NEER ${K.num(neer.value)} in ${monLabel(reer.date)}`,
    draw: (width) => K.line({
      width, unit: {}, endDp: 1, refs: [{ y: 100, label: "2015-16 = 100" }],
      series: [{ name: "Nominal (NEER)", short: "Nominal (NEER)", data: P(RE.neer_trade), role: "ctx" }, { name: "Real (REER)", short: "Real (REER)", data: P(RE.reer_trade), role: "lead" }],
    }),
  });
}

/* ================= §08 the RBI's dollar desk ================= */
const deskNet = scaled(since(IV.net, "2015-04-01")), deskFw = scaled(since(IV.forward_outstanding, "2015-04-01"));
export function desk() {
  return figure({
    bare: true, file: "india-atlas_rbi-dollar-desk_monthly",
    label: `The RBI's monthly net dollar purchases or sales (grey line) and its outstanding forward book at each month's end (blue line), US$ billion, since April 2015; forward book ${cbn(lastPt(deskFw).value)} at the end of ${monLabel(lastPt(deskFw).date)}`,
    data: { cols: ["Month", "Net purchases (+) / sales (−), US$ billion", "Forward book, end of month, US$ billion"], rows: deskNet.data.map((d) => [d.date, d.value, deskFw.data.find((x) => x.date === d.date)?.value ?? null]) },
    // two lines on one dollar scale: the forward book leads (the plate's figure), monthly net purchases in grey
    draw: (width) => K.line({ width, unit: BN, endDp: 1, series: [{ name: "Net purchases (+) / sales (−)", short: "Net purchases", data: P(deskNet), role: "ctx" }, { name: "Forward book, end of month", short: "Forward book", data: P(deskFw), role: "lead" }] }),
  });
}

/* ================= §09 what India owes ================= */
export function debt() {
  const L = (k, name, short, role) => ({ name, short, data: P(scaled(DA[k])), role });
  return figure({
    bare: true, file: "india-atlas_external-debt_end-march",
    label: `India's external debt as on 31 March each year since 1991, US$ billion: the total, commercial borrowing, NRI deposits and short-term debt`,
    draw: (width) => K.line({ width, unit: BN, endDp: 0, series: [L("e_1_2_short_term_debt", "Short-term debt", "Short-term", "ctx2"), L("e_1_1_6_nri_and_fc", "NRI deposits", "NRI deposits", "ctx"), L("e_1_1_5_commercial_borrowing", "Commercial borrowing", "Commercial", "comp"), L("e_1_gross_external_debt_position", "Total external debt", "Total", "lead")] }),
  });
}
const sectL = lastPt(DS.s_gross_external_debt_position_by_borrowing_sector) ?? lastPt(Object.values(DS)[0]);
const sectRows = (() => {
  const at = (k) => DS[k]?.data.find((d) => d.date === sectL.date)?.value ?? null, tot = sectL.value;
  return [["Companies (non-financial)", "s_non_financial_corporations"], ["Banks", "s_deposit_taking_corporations_except_the_central_ban"], ["Government", "s_general_government"], ["Other financial companies", "s_other_financial_corporations"],
    ["Lending within company groups", "s_direct_investment_intercompany_lending"], ["Reserve Bank of India", "s_central_bank"], ["Households and non-profits", "s_households_and_nonprofit_institutions_serving_hous"]]
    .map(([name, k]) => ({ name, k, v: at(k) })).filter((r) => r.v != null).map((r) => ({ ...r, v: (r.v / tot) * 100 })).sort((a, b) => b.v - a.v);
})();
export function sector() {
  return figure({
    bare: true, file: "india-atlas_external-debt-by-borrower",
    label: "India's external debt by who borrowed, share of the total, latest quarter: " + sectRows.map((r) => `${r.name} ${K.num(r.v, { suffix: "%" })}`).join(", "),
    data: { cols: ["Borrower", "Share of external debt, %"], rows: sectRows.map((r) => [r.name, +r.v.toFixed(2)]) },
    draw: (width) => K.bars({ width, unit: { suffix: "%" }, dp: 1, rows: sectRows.map((r, i) => ({ name: r.name, value: r.v, highlight: i === 0 })) }),
  });
}
export function iip() {
  const L = (k, name, short, role) => ({ name, short, data: P(scaled(IIP[k])), role });
  return figure({
    bare: true, file: "india-atlas_international-investment-position_quarterly",
    label: "India's international investment position, US$ billion at each quarter's end since December 2017: owned abroad, owed to the world and the net",
    draw: (width) => K.line({ width, freq: "quarter", unit: BN, endDp: 1, series: [L("assets", "Owned abroad", "Owned abroad", "ctx2"), L("liabilities", "Owed to the world", "Owed", "ctx"), L("net", "Net position", "Net", "lead")] }),
  });
}

/* ================= §10 how the numbers revise ================= */
const revRows = (() => { const V = hyd(vintB); return V.current_account_first.data.map((d, i) => ({ q: qLabel(d.date), date: d.date, a: d.value / 1000, b: V.current_account_latest.data[i].value / 1000, ver: vintB.meta.versions?.[d.date] ?? [] })); })();
export function rev() {
  const n = revRows.length;
  return figure({
    bare: true, file: "india-atlas_current-account-revisions",
    label: `India's current account as first published and as now published, US$ billion, for ${n} quarters`,
    data: { cols: ["Quarter", "First estimate, US$ billion", "Latest, US$ billion", "First version", "Latest version"], rows: revRows.map((r) => [r.q, +r.a.toFixed(3), +r.b.toFixed(3), r.ver[0] ?? "", r.ver.at(-1) ?? ""]) },
    // chronological, oldest first: the form sorts on a field, descending
    draw: (width) => K.dumbbell({ width, rows: revRows.map((r, i) => ({ name: r.q, a: r.a, b: r.b, ord: n - i })), sortBy: "ord", keys: { a: "First published", b: "Now" }, unit: { suffix: " bn" }, dp: 1 }),
  });
}

/* ---------- every number the page quotes, as the old client set it ---------- */
export function numbers() {
  const N = {};
  const caPrev = B.current_account.data.at(-2);
  const resYearAgo = (() => { const t = ms(res.date) - 364 * 86400000; let best = null; for (const d of RW.total_usd.data) if (d.value != null && (!best || Math.abs(ms(d.date) - t) < Math.abs(ms(best.date) - t))) best = d; return best; })();
  const cover = lastPt(IND.import_cover_of_reserves_in_months);
  // title block and §01
  N["m-latest"] = qLong(ca.date);
  N["m-week"] = dayLabel(res.date);
  N["n-ca"] = bn(ca.value);
  N["d-ca"] = `<b>${bn(caPrev.value)}</b> in ${qLabel(caPrev.date)}`;
  N["n-res"] = bnR(res.value);
  N["d-res"] = `<b>${bnR(resYearAgo.value)}</b> a year earlier`;
  N["n-inr"] = fmt.inr2(usd.value);
  N["d-inr"] = `<b>${fmt.inr2(usdYear.value)}</b> in ${monLabel(usdYear.date)}`;
  N["n-reer"] = fmt.num1(reer.value);
  N["d-reer"] = `2015-16 = 100, ${monLabel(reer.date)}`;
  N["nspark-ca"] = K.spark(P(scaled(since(B.current_account, "2016-04-01"))), { width: 190, height: 44 });
  N["u-reading"] = `Quarter of ${qLabel(ca.date)}, reserves to ${dayLabel(res.date)}`;
  N["rb-ca"] = bn(ca.value);
  N["rb-cap"] = `Current account, ${qLong(ca.date)}: ${ca.value < 0 ? "India paid the world more than it earned from it" : "India earned more from the world than it paid it"}, in goods, services, income and transfers together.`;
  N["rb-res"] = bnR(res.value) + pc("");
  // §02
  const tr = troughOf(caQ);
  N["pv-ca"] = bn(ca.value);
  N["ex-ca-latest"] = bn(ca.value);
  N["ex-ca-q"] = qLabel(ca.date);
  N["ex-ca-trough"] = `${fmt.bnFixed1(tr.value)} in ${qLabel(tr.date)}`;
  const sur = caQ.data.filter((d) => d.value != null && d.value > 0), nQ = caQ.data.filter((d) => d.value != null).length;
  N["ex-ca-surplus"] = `${sur.length} of ${nQ}`;
  // why the surpluses happened, counted from the bars: January to March quarters, and the 2020-21 lockdowns
  const nJM = sur.filter((d) => d.date.slice(5, 7) === "01").length;
  const nLock = sur.filter((d) => d.date.slice(5, 7) !== "01" && d.date >= "2020-04-01" && d.date < "2021-10-01").length;
  const nOther = sur.length - nJM - nLock, w = (n) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][n] ?? String(n);
  const why = [nJM && `${w(nJM)} January to March ${nJM === 1 ? "quarter" : "quarters"}, when exports run high before the fiscal year closes`,
    nLock && `${w(nLock)} around the 2020 and 2021 lockdowns, when imports collapsed`, nOther && `${w(nOther)} other${nOther === 1 ? "" : "s"}`].filter(Boolean);
  N["ex-ca-surplus-why"] = why.length > 1 ? why.slice(0, -1).join(", ") + ", and " + why.at(-1) : why[0] ?? "none";
  const cg = IND.cad_to_gdp, cgL = lastPt(cg), cgT = troughOf(cg);
  N["pv-cagdp"] = fmt.pct1Minus(cgL.value);
  N["ex-cagdp"] = fmt.pct1Minus(cgL.value);
  N["ex-cagdp-fy"] = fyLabel(cgL.date);
  N["ex-cagdp-trough"] = `${fmt.pct1Minus(cgT.value)} in ${fyLabel(cgT.date)}`;
  N["ex-cagdp-n3"] = String(cg.data.filter((d) => d.value != null && d.value < -3).length);
  // §03
  const g = lastPt(B.goods).value, sv = lastPt(B.services).value, rm = lastPt(B.private_transfers).value, inc = lastPt(B.income).value;
  N["pv-parts"] = bn(g);
  N["ex-p-goods"] = bn(g); N["ex-p-svc"] = bn(sv); N["ex-p-rem"] = bn(rm); N["ex-p-inc"] = bn(inc);
  N["ex-p-cover"] = fmt.pct0(((sv + rm) / -g) * 100);
  N["ex-p-soft"] = bn(lastPt(B.software).value);
  const anL = lastPt(AN.current_account);
  N["pv-long"] = bn(anL.value);
  N["ex-long-fy"] = fyLabel(anL.date);
  const firstInvBig = AN.invisibles.data.find((d) => d.value != null && d.value > 10000);
  N["ex-long-inv10"] = firstInvBig ? fyLabel(firstInvBig.date) : "–";
  N["ex-long-91"] = bn(AN.current_account.data.find((d) => d.date === "1990-04-01")?.value ?? null);
  // §04
  const rq = scaled(G.remittances_in), rL = lastPt(rq), iL = rq.data.indexOf(rL);
  N["pv-remit"] = fmt.bnFixed1(rL.value);
  N["ex-r-q"] = fmt.bnFixed1(rL.value);
  N["ex-r-year"] = fmt.bnFixed1(sum(rq.data.slice(iL - 3, iL + 1).map((d) => d.value ?? 0)));
  N["pv-remitmix"] = fmt.pct0((pplAt("family_remittances") / pplAt("remittances_received")) * 100);
  N["ex-rm-q"] = qLabel(pplL.date);
  N["ex-rm-family"] = fmt.bnFixed1(pplAt("family_remittances") / 1000);
  N["ex-rm-nri"] = fmt.bnFixed1(pplAt("nri_withdrawals") / 1000);
  N["ex-rm-wages"] = fmt.bnFixed1(pplAt("wages_received") / 1000);
  N["ex-rm-out"] = fmt.bnFixed1(pplAt("remittances_paid") / 1000);
  N["ex-rm-edu"] = fmt.bnFixed1(pplAt("travel_paid_education") / 1000);
  const lrsLast = lrsFull.at(-1);
  N["pv-lrs"] = fmt.bnFixed1(lrsLast[1].total / 1000);
  N["ex-l-fy"] = fyOfY(lrsLast[0]);
  N["ex-l-total"] = fmt.bnFixed1(lrsLast[1].total / 1000);
  N["ex-l-travel"] = fmt.pct0((lrsLast[1].g[0] / lrsLast[1].total) * 100);
  N["ex-l-study"] = fmt.bnFixed1(lrsLast[1].g[3] / 1000);
  N["ex-l-month"] = monLabel(lastPt(LR.total).date);
  const edu = lastPt(LR.travel_for_education);
  N["ex-l-edu"] = "$" + fmt.inr(edu.value) + " million";
  N["ex-l-edum"] = monLabel(edu.date);
  // §05
  const sd = (s) => { const v = s.data.map((d) => d.value).filter((x) => x != null); const m = sum(v) / v.length; return Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / v.length); };
  const neg = (s) => s.data.filter((d) => d.value != null && d.value < 0).length, nn = (s) => s.data.filter((d) => d.value != null).length;
  N["pv-flows"] = fmt.bnFixed1(lastPt(fpiQ).value);
  N["ex-f-fdi"] = fmt.bnFixed1(lastPt(fdiQ).value); N["ex-f-fpi"] = fmt.bnFixed1(lastPt(fpiQ).value);
  N["ex-f-sdfdi"] = fmt.bnFixed1(sd(fdiQ)); N["ex-f-sdfpi"] = fmt.bnFixed1(sd(fpiQ));
  N["ex-f-negfpi"] = `${neg(fpiQ)} of ${nn(fpiQ)}`; N["ex-f-negfdi"] = `${neg(fdiQ)} of ${nn(fdiQ)}`;
  const fL = fdiFull.at(-1)[1].v;
  N["pv-fdi"] = fmt.bnFixed1(fL[0] / 1000);
  N["ex-fdi-fy"] = fyOfY(fdiFull.at(-1)[0]);
  N["ex-fdi-gross"] = fmt.bnFixed1(fL[0] / 1000); N["ex-fdi-rep"] = fmt.bnFixed1(fL[1] / 1000); N["ex-fdi-out"] = fmt.bnFixed1(fL[2] / 1000);
  N["ex-fdi-share"] = fmt.pct0((fL[1] / fL[0]) * 100);
  const fpL = lastPt(FP.fpi_net);
  N["pv-fpi"] = (fpL.value < 0 ? "−₹" : "₹") + fmt.inr(Math.abs(fpL.value)) + " cr";
  N["ex-fpi-m"] = monLabel(fpL.date);
  N["ex-fpi-out"] = `${fpiM.data.filter((d) => d.value != null && d.value < 0).length} of ${fpiM.data.filter((d) => d.value != null).length}`;
  const fpT = troughOf(FP.fpi_net);
  N["ex-fpi-trough"] = `${"−₹" + fmt.inr(Math.abs(fpT.value))} crore in ${monLabel(fpT.date)}`;
  // §06
  N["pv-res"] = bnR(res.value);
  N["ex-res-week"] = dayLabel(res.date);
  N["ex-res-total"] = bnR(res.value);
  N["ex-res-peak"] = `${bnR(resPeak.value)} on ${dayLabel(resPeak.date)}`;
  const prev = RW.total_usd.data.filter((d) => d.value != null).at(-2);
  N["ex-res-wk"] = fmt.bnFixed1((res.value - prev.value) / 1000);
  N["ex-res-gold"] = fmt.pct0((lastPt(RW.gold_usd).value / res.value) * 100);
  N["ex-res-cover"] = fmt.num1(cover.value);
  N["ex-res-cover-fy"] = fyLabel(cover.date);
  const both = resChg.map((d) => ({ d: d.date, c: d.value, n: resNet.find((x) => x.date === d.date)?.value })).filter((x) => x.n != null);
  N["pv-resmove"] = fmt.bnFixed1(resChg.at(-1).value);
  N["ex-mv-month"] = monLabel(resChg.at(-1).date);
  N["ex-mv-chg"] = fmt.bnFixed1(resChg.at(-1).value);
  const lastBoth = both.at(-1);
  N["ex-mv-net"] = lastBoth ? fmt.bnFixed1(lastBoth.n) : "–";
  N["ex-mv-netm"] = lastBoth ? monLabel(lastBoth.d) : "–";
  N["ex-mv-gapmax"] = fmt.bnFixed1(Math.max(...both.map((x) => Math.abs(x.c - x.n))));
  // §07
  N["pv-rupee"] = fmt.inr2(usd.value);
  N["ex-ru-m"] = monLabel(usd.date); N["ex-ru-v"] = fmt.inr2(usd.value); N["ex-ru-y"] = fmt.inr2(usdYear.value);
  N["ex-ru-pct"] = fmt.pct1(((usd.value / usdYear.value) - 1) * 100);
  const ry = RE.reer_trade.data.find((d) => d.date === `${+reer.date.slice(0, 4) - 1}${reer.date.slice(4, 7)}-01`);
  N["pv-reer"] = fmt.num1(reer.value);
  N["ex-re-m"] = monLabel(reer.date); N["ex-re-reer"] = fmt.num1(reer.value); N["ex-re-neer"] = fmt.num1(neer.value);
  N["ex-re-reery"] = fmt.num1(ry.value);
  N["ex-re-gap"] = fmt.num1(reer.value - neer.value);
  // §08
  const ivL = lastPt(IV.net), fwT = troughOf(deskFw);
  N["pv-desk"] = fmt.bnFixed1(lastPt(deskFw).value);
  N["ex-d-m"] = monLabel(ivL.date); N["ex-d-net"] = fmt.bnFixed1(ivL.value / 1000);
  N["ex-d-fw"] = fmt.bnFixed1(lastPt(deskFw).value);
  N["ex-d-fwt"] = `${fmt.bnFixed1(fwT.value)} in ${monLabel(fwT.date)}`;
  const m1 = lastPt(FB.upto_1_month_net) ?? null;
  N["ex-d-1m"] = m1 ? fmt.bnFixed1(m1.value / 1000) : "–";
  N["ex-d-sold12"] = fmt.bnFixed1(sum(IV.sale.data.slice(-12).map((d) => d.value ?? 0)) / 1000);
  N["ex-d-bought12"] = fmt.bnFixed1(sum(IV.purchase.data.slice(-12).map((d) => d.value ?? 0)) / 1000);
  // §09
  const dL = lastPt(DA.e_1_gross_external_debt_position), dPct = (k) => lastPt(DA[k])?.value;
  N["pv-debt"] = bnR(dL.value);
  N["ex-debt-y"] = `March ${dL.date.slice(0, 4)}`; N["ex-debt-total"] = bnR(dL.value);
  N["ex-debt-gdp"] = fmt.pct1(dPct("e_7_debt_stock_gdp_ratio")); N["ex-debt-st"] = fmt.pct1(dPct("e_5_as_of_total_debt"));
  N["ex-debt-ds"] = fmt.pct1(dPct("e_8_debt_service_ratio"));
  N["ex-debt-cover"] = fmt.pct0((res.value / dL.value) * 100);
  const d91 = DA.e_1_gross_external_debt_position.data[0];
  N["ex-debt-91"] = bnR(d91.value); N["ex-debt-91y"] = `March ${d91.date.slice(0, 4)}`;
  N["pv-sector"] = fmt.pct1(sectRows[0].v);
  N["ex-s-q"] = qLabel(sectL.date); N["ex-s-top"] = sectRows[0].name.toLowerCase(); N["ex-s-topv"] = fmt.pct1(sectRows[0].v);
  const gov = sectRows.find((r) => r.name === "Government");
  N["ex-s-gov"] = gov ? fmt.pct1(gov.v) : "–";
  N["pv-iip"] = bn(lastPt(IIP.net).value);
  N["ex-iip-q"] = qLabel(lastPt(IIP.net).date);
  N["ex-iip-net"] = bn(lastPt(IIP.net).value);
  N["ex-iip-res"] = fmt.pct0((lastPt(IIP.a_reserves).value / lastPt(IIP.assets).value) * 100);
  N["ex-iip-ldi"] = fmt.pct0((lastPt(IIP.l_direct).value / lastPt(IIP.liabilities).value) * 100);
  // §10
  const big = revRows.reduce((m, r) => (Math.abs(r.b - r.a) > Math.abs(m.b - m.a) ? r : m), revRows[0]);
  N["pv-rev"] = `${big.b - big.a > 0 ? "+" : "−"}$${Math.abs(big.b - big.a).toFixed(1)} bn`;
  N["ex-rev-big"] = `${big.q}: first ${fmt.bnFixed1(big.a)}, now ${fmt.bnFixed1(big.b)}`;
  N["ex-rev-n"] = String(revRows.filter((r) => Math.abs(r.b - r.a) >= 1).length);
  N["ex-rev-of"] = String(revRows.length);
  // small facts in the text
  const nri = lastPt(NR.total_outstanding), inv = lastPt(INV.invoiced_exports_percent);
  N["ex-nri"] = bnR(nri.value); N["ex-nri-m"] = monLabel(nri.date);
  N["ex-inv"] = inv ? fmt.pct1(inv.value) : "–"; N["ex-inv-m"] = inv ? monLabel(inv.date) : "–";
  // provenance
  N["prov-vintage"] = bopB.meta.vintage;
  N["prov-vintage2"] = bopB.meta.vintage;
  return N;
}
