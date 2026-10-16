// Payments guide: the plates, drawn at build time with the chart kit (src/kit/). Each export
// returns a bare figure for a plate's .plotzone; titles, source lines and buttons stay in
// src/pages/guides/payments.astro. Bundles store volumes as counts and values as rupees (DBIE's
// ACTUALS); plates scale them to crore and lakh crore, and every label is written by the guide's
// own renderers (payments.fmt.js), the same ones the page's numbers and scripts/qc.mjs use.
// The RBI's old table (to October 2019) and the re-organised one are never joined.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as F from "./payments.fmt.js";
import m from "../../data/series/payments-monthly.json";
import t from "../../data/series/payments-ticket.json";
import inf from "../../data/series/payments-infra.json";
import a from "../../data/series/payments-annual.json";
import o from "../../data/series/payments-monthly-2004.json";
import h from "../../data/series/payments-cheques-1970.json";
import c from "../../data/series/payments-cheques-centres.json";
import chb from "../../data/series/payments-clearing-houses.json";
import e from "../../data/series/payments-erupee.json";
import money from "../../data/series/credit-money.json";

const CR = 1e7, LC = 1e12;
const { num } = K;
// [[date, value / k]] for one series; nulls stay null (a gap, never a zero)
const ser = (b, key, k = 1) => b.dates.map((d, i) => [d, b.series[key].data[i] == null ? null : b.series[key].data[i] / k]);
const lastOf = (P) => P.filter((p) => p[1] != null).at(-1);
// the RBI's yearly tables date a fiscal year by its closing March ("2016-03-01" is 2015-16);
// the kit's fy frequency names a year by its opening April, so yearly points move to April
const fyStart = (d) => `${+d.slice(0, 4) - 1}-04-01`;
const fyOf = (d) => `${+d.slice(0, 4) - 1}-${d.slice(2, 4)}`;
const fyPts = (P) => P.map(([d, v]) => [fyStart(d), v]);
const crore0 = (v) => num(v, { dp: v >= 100 ? 0 : 1, suffix: " crore" });   // a count already in crore, as F.crore writes it
const lakhRs = (v) => (v >= 1e5 ? "₹" + (v / 1e5).toFixed(1) + " lakh" : F.rupees(v));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

// Two charts side by side while each keeps 340 px, one above the other on a phone, each under a
// small head, as one drawing (kit panels()). Different units never share an axis, so a pair is two panels.
function pair(width, [A, B]) {
  const { across, w, gap } = K.panelFit(width, 2, { gap: 40 });
  return K.panels([A.draw(w), B.draw(w)], { across, gap, titles: [[A.name, A.sub], [B.name, B.sub]] });
}

/* ---------- § 01 ---------- */
export const sparkUpi = () => K.spark(ser(m, "upi_volume"), { width: 190, height: 44 });

/* ---------- § 02 what one payment is worth ---------- */
const SYS = [["UPI", "upi"], ["Wallets", "ppi_wallets"], ["FASTag toll (NETC)", "netc"], ["UPI on a basic phone (USSD)", "upi_ussd"], ["Benefit credit (APBS)", "apbs"],
  ["Cash at a micro ATM (AePS)", "microatm_cash"], ["Debit card", "debit_cards"], ["Credit card", "credit_cards"], ["BHIM Aadhaar Pay", "bhim_aadhaar_pay"],
  ["Cash from an ATM", "atm_cash"], ["NACH debit (EMIs, SIPs)", "nach_dr"], ["NACH credit (salaries, pensions)", "nach_cr"], ["IMPS", "imps"], ["NEFT", "neft"],
  ["Cheque", "paper"], ["RTGS", "rtgs"]];
const TICK = { 10: "₹10", 100: "₹100", 1000: "₹1,000", 10000: "₹10,000", 100000: "₹1 lakh", 1000000: "₹10 lakh", 10000000: "₹1 crore", 100000000: "₹10 crore" };
export function ticket() {
  const rows = SYS.map(([name, k]) => ({ name, k, value: t.series[k]?.data.at(-1), highlight: k === "upi" })).filter((r) => r.value != null && r.value > 0);
  return figure({
    bare: true, file: "india-atlas_payments-average-size",
    label: "Average value of one transaction by payment system, on a logarithmic scale: " + rows.slice().sort((p, q) => q.value - p.value).map((r) => `${r.name} ${lakhRs(r.value)}`).join(", "),
    data: { cols: ["system", "series", `average_inr_${t.dates.at(-1).slice(0, 7)}`], rows: rows.map((r) => [r.name, r.k, r.value]) },
    draw: (width) => K.bars({ width, rows, log: true, fmt: lakhRs, tickFmt: (v) => TICK[v] ?? "" }),
  });
}
export function upiTicket() {
  const P = ser(t, "upi"), mx = P.filter((p) => p[1] != null).reduce((x, y) => (y[1] > x[1] ? y : x));
  return figure({
    bare: true, file: "india-atlas_payments-average-upi",
    label: `Average value of one UPI payment, monthly: ${F.rupees(P.find((p) => p[1] != null)[1])} at the start, a high of ${F.rupees(mx[1])}, ${F.rupees(lastOf(P)[1])} in the latest month`,
    data: { cols: ["month", "average_upi_payment_inr"], rows: P },
    draw: (width) => K.line({
      width, freq: "month", unit: { prefix: "₹" }, endFormat: F.rupees, hoverDp: 0, yDomain: [0, mx[1] * 1.3], // headroom for the note on the high
      series: [{ name: "Average UPI payment", data: P, role: "lead" }],
      notes: [{ d: mx[0], v: mx[1], text: `Highest\n${F.rupees(mx[1])}, ${K.tlabel(mx[0], "month")}` }],
    }),
  });
}

/* ---------- § 04 UPI and everything else ---------- */
export function upi() {
  const U = ser(m, "upi_volume", CR);
  const R = m.dates.map((d, i) => { const tot = m.series.retail_total_volume.data[i], u = m.series.upi_volume.data[i]; return [d, tot == null || u == null ? null : (tot - u) / CR]; });
  return figure({
    bare: true, file: "india-atlas_payments-upi-vs-rest",
    label: "UPI payments and all other retail payments a month, crore: UPI rises steeply while the rest grows slowly",
    data: { cols: ["month", "upi_payments", "all_other_retail_payments", "upi_value_inr"], rows: m.dates.map((d, i) => { const tot = m.series.retail_total_volume.data[i], u = m.series.upi_volume.data[i]; return [d, u, tot == null ? null : tot - u, m.series.upi_value.data[i]]; }) },
    draw: (width) => K.line({
      width, freq: "month", unit: { suffix: " crore" }, endFormat: crore0, hoverDp: 1,
      series: [
        { name: "All other retail systems", short: "Other systems", data: R, role: "ctx" },
        { name: "UPI", data: U, role: "lead" },
      ],
    }),
  });
}
const GROUPS = [["UPI", ["upi"]], ["Cards", ["cards"]], ["Wallets and prepaid cards", ["ppi"]], ["IMPS", ["imps"]], ["NEFT", ["neft"]],
  ["Bulk and Aadhaar", ["nach_cr", "nach_dr", "apbs", "aeps_transfer", "bhim_aadhaar_pay", "ecs_cr", "ecs_dr", "netc"]], ["Cheques", ["paper"]], ["RTGS", ["rtgs"]]];
export function share() {
  const at = (k) => m.series[k]?.data.at(-1) ?? 0;
  const tot = { volume: at("total_volume"), value: at("total_value") };
  const rows = (f) => GROUPS.map(([name, keys]) => ({ name, value: (100 * keys.reduce((s, k) => s + at(`${k}_${f}`), 0)) / tot[f], highlight: name === "UPI" || (f === "value" && name === "RTGS") }));
  const V = rows("volume"), M = rows("value");
  const month = K.tlabel(m.dates.at(-1), "month");
  const pct = (v) => num(v, { dp: 1, suffix: "%" });
  return figure({
    bare: true, file: "india-atlas_payments-shares",
    label: `Each system's share of the number of payments and of their value, ${month}: ` + V.map((r, i) => `${r.name} ${pct(r.value)} of payments, ${pct(M[i].value)} of the money`).join("; "),
    data: { cols: ["system", "share_of_payments_pct", "share_of_value_pct"], rows: V.map((r, i) => [r.name, +r.value.toFixed(2), +M[i].value.toFixed(2)]) },
    draw: (width) => pair(width, [
      { name: "Of every 100 payments", sub: `share of the number of payments, ${month}`, draw: (w) => K.bars({ width: w, rows: V, sort: false, max: 100, fmt: pct, unit: { suffix: "%" } }) },
      { name: "Of every ₹100 paid", sub: `share of the money, ${month}`, draw: (w) => K.bars({ width: w, rows: M, sort: false, max: 100, fmt: pct, unit: { suffix: "%" } }) },
    ]),
  });
}
export function value() {
  const L = [["RTGS", "rtgs", "lead"], ["NEFT", "neft", "ctx"], ["UPI", "upi", "ctx"], ["IMPS", "imps", "ctx2"], ["Cheques", "paper", "ctx2"]];
  return figure({
    bare: true, file: "india-atlas_payments-value-by-system",
    label: "Value of payments a month by system, ₹ lakh crore: " + L.map(([n, k]) => `${n} ${F.lakhCrore(m.series[k + "_value"].data.at(-1))}`).join(", "),
    data: { cols: ["month", ...L.map(([n]) => `${n}_value_inr`)], rows: m.dates.map((d, i) => [d, ...L.map(([, k]) => m.series[k + "_value"].data[i])]) },
    draw: (width) => K.line({
      width, freq: "month", unit: { prefix: "₹", suffix: " lakh crore" }, endFormat: (v) => "₹" + num(v, { dp: 1 }), hoverDp: 1,
      series: L.slice().reverse().map(([name, k, role]) => ({ name, data: ser(m, k + "_value", LC), role })),
    }),
  });
}

/* ---------- § 05 cards, cash and the machines ---------- */
export function cards() {
  return figure({
    bare: true, file: "india-atlas_payments-cards",
    label: `Card payments a month by kind of card, crore: credit cards ${F.crore(m.series.credit_cards_volume.data.at(-1))}, debit cards ${F.crore(m.series.debit_cards_volume.data.at(-1))} in the latest month`,
    data: { cols: ["month", "credit_card_payments", "debit_card_payments", "credit_cards_in_issue", "debit_cards_in_issue"],
      rows: m.dates.map((d, i) => { const j = inf.dates.indexOf(d); return [d, m.series.credit_cards_volume.data[i], m.series.debit_cards_volume.data[i], j < 0 ? null : inf.series.credit_cards.data[j], j < 0 ? null : inf.series.debit_cards.data[j]]; }) },
    draw: (width) => K.line({
      width, freq: "month", unit: { suffix: " crore" }, endFormat: crore0, hoverDp: 1,
      series: [
        { name: "Debit cards", data: ser(m, "debit_cards_volume", CR), role: "ctx" },
        { name: "Credit cards", data: ser(m, "credit_cards_volume", CR), role: "lead" },
      ],
    }),
  });
}
const cwpAll = (() => { const i0 = money.dates.findIndex((d) => d >= "2016-01-01"); return money.dates.slice(i0).map((d, i) => [d, money.series.currency_with_public.data[i0 + i]]); })();
export function cash() {
  const atm = ser(m, "atm_cash_volume", CR);
  const lc = (v) => "₹" + v.toFixed(1) + " lakh crore";
  const dates = [...new Set([...m.dates, ...cwpAll.map((p) => p[0])])].sort();
  return figure({
    bare: true, file: "india-atlas_payments-cash",
    label: `Two charts. Cash withdrawals at ATMs a month, crore, ${F.crore(m.series.atm_cash_volume.data[0])} at the start and ${F.crore(m.series.atm_cash_volume.data.at(-1))} in the latest month. Currency with the public, ₹ lakh crore, every fortnight since January 2016, now ${lc(lastOf(cwpAll)[1])}`,
    data: { cols: ["date", "atm_cash_withdrawals", "currency_with_public_inr_lakh_crore"], rows: dates.map((d) => [d, m.series.atm_cash_volume.data[m.dates.indexOf(d)] ?? null, cwpAll.find((p) => p[0] === d)?.[1] ?? null]) },
    draw: (width) => pair(width, [
      { name: "Cash withdrawals at ATMs", sub: "crore a month", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: crore0, yDomain: [0, Math.max(...atm.filter((p) => p[1] != null).map((p) => p[1]))], series: [{ name: "ATM cash withdrawals", data: atm, role: "lead" }] }) },
      { name: "Currency with the public", sub: "₹ lakh crore", draw: (w) => K.line({ width: w, freq: "month", unit: { prefix: "₹" }, endFormat: (v) => "₹" + v.toFixed(1),
        events: [{ t: "2016-11-08", label: "Old notes withdrawn", short: "Notes withdrawn" }],
        series: [{ name: "Currency with the public", data: cwpAll, role: "lead" }] }) },
    ]),
  });
}

// a count panel on its own scale and in its own unit: crore from a crore, lakh from a lakh
function countPanel(b, key, name, sub, highlight) {
  const raw = b.series[key].data, mx = Math.max(...raw.filter((v) => v != null));
  const [k, suffix] = mx >= 1e7 ? [CR, " crore"] : mx >= 1e5 ? [1e5, " lakh"] : [1, ""];
  return { name, sub, highlight, data: ser(b, key, k), unit: { suffix }, vText: F.count(raw.filter((v) => v != null).at(-1)) };
}
export function machines() {
  const PANELS = [["upi_qr", "UPI QR codes", "stickers at shops and stalls"], ["pos", "Card machines (PoS terminals)", "at shops"], ["bharat_qr", "Bharat QR codes", "the card networks' QR"],
    ["atms", "ATMs", "bank-owned and white-label"], ["micro_atms", "Micro ATMs", "banking correspondents' devices"], ["debit_cards", "Debit cards", "in issue"],
    ["credit_cards", "Credit cards", "in issue"], ["ppi_wallets", "Wallets", "prepaid wallets in issue"]];
  const panels = PANELS.map(([k, name, sub]) => countPanel(inf, k, name, sub, k === "upi_qr"));
  const keys = Object.keys(inf.series);
  return figure({
    bare: true, file: "india-atlas_payments-infrastructure",
    label: "Eight small line charts of payment infrastructure at the end of each month, each on its own scale: " + panels.map((p) => `${p.name} ${p.vText}`).join(", "),
    data: { cols: ["month", ...keys], rows: inf.dates.map((d, i) => [d, ...keys.map((k) => inf.series[k].data[i])]) },
    draw: (width) => K.multiples({ width, panels, shared: false }),
  });
}
export function systems() {
  const PANELS = [["nach_dr", "NACH debits", "EMIs, SIPs, premiums, bills"], ["nach_cr", "NACH credits", "salaries, pensions, dividends"], ["apbs", "APBS", "government benefits to Aadhaar-linked accounts"],
    ["microatm_cash", "AePS cash withdrawals", "at banking correspondents"], ["imps", "IMPS", "instant transfers"], ["neft", "NEFT", "bank transfers"],
    ["rtgs", "RTGS", "large transfers"], ["ppi_wallets", "Wallets", "prepaid wallet payments"], ["ppi_cards", "Prepaid cards", "gift, meal and travel cards"],
    ["netc", "FASTag (NETC)", "toll payments from bank accounts"], ["bhim_aadhaar_pay", "BHIM Aadhaar Pay", "paying a shop by thumbprint"], ["upi_ussd", "UPI over USSD", "on a phone without internet"]];
  const panels = PANELS.map(([k, name, sub]) => countPanel(m, k + "_volume", name, sub, k === "nach_dr"));
  return figure({
    bare: true, file: "india-atlas_payments-every-system",
    label: "Twelve small line charts, one per payment system, number of payments a month, each on its own scale: " + panels.map((p) => `${p.name} ${p.vText}`).join(", "),
    data: { cols: ["month", ...PANELS.map(([k]) => k + "_payments")], rows: m.dates.map((d, i) => [d, ...PANELS.map(([k]) => m.series[k + "_volume"].data[i])]) },
    draw: (width) => K.multiples({ width, panels, shared: false }),
  });
}

export function channels() {
  return figure({
    bare: true, file: "india-atlas_payments-channels",
    label: `Value of payments a month by channel, ₹ lakh crore: mobile ${F.lakhCrore(m.series.mobile_value.data.at(-1))} and internet banking ${F.lakhCrore(m.series.internet_value.data.at(-1))} in the latest month`,
    data: { cols: ["month", "mobile_payments", "mobile_value_inr", "internet_payments", "internet_value_inr"], rows: m.dates.map((d, i) => [d, m.series.mobile_volume.data[i], m.series.mobile_value.data[i], m.series.internet_volume.data[i], m.series.internet_value.data[i]]) },
    draw: (width) => K.line({
      width, freq: "month", unit: { prefix: "₹", suffix: " lakh crore" }, endFormat: (v) => "₹" + num(v, { dp: 1 }), hoverDp: 1,
      series: [
        { name: "Internet banking", short: "Net banking", data: ser(m, "internet_value", LC), role: "ctx" },
        { name: "Mobile", data: ser(m, "mobile_value", LC), role: "lead" },
      ],
    }),
  });
}

/* ---------- § 07 the long view ---------- */
export function annual() {
  const rows = a.dates.map((d, i) => { const u = a.series.upi_volume.data[i] ?? 0, tot = a.series.total_volume.data[i]; return { name: fyOf(d), parts: [u / CR, (tot - u) / CR], highlight: i === a.dates.length - 1 }; });
  return figure({
    bare: true, file: "india-atlas_payments-by-fiscal-year",
    label: "Payments in each fiscal year, crore, UPI and every other payment: " + a.dates.map((d, i) => `${fyOf(d)} ${F.crore(a.series.total_volume.data[i])}, UPI ${F.crore(a.series.upi_volume.data[i] ?? 0)}`).join("; "),
    data: { cols: ["fiscal_year", "upi_payments", "all_payments", "digital_payments", "paper_payments"], rows: a.dates.map((d, i) => [fyOf(d), a.series.upi_volume.data[i], a.series.total_volume.data[i], a.series.digital_total_volume.data[i], a.series.paper_volume.data[i]]) },
    draw: (width) => K.stackBars({ width, rows, sort: false, parts: [{ name: "UPI", color: K.C.lead }, { name: "Every other payment", color: K.C.ctx2 }], absolute: { fmt: (v) => F.crore(v * CR), unit: { suffix: " crore" } } }),
  });
}
export function long() {
  const sum2 = (b, k1, k2) => b.dates.map((d, i) => { const x = b.series[k1].data[i], y = b.series[k2].data[i]; return [d, x == null || y == null ? null : (x + y) / CR]; });
  const posOld = sum2(o, "credit_cards_pos_volume", "debit_cards_pos_volume"), posNew = sum2(m, "credit_cards_pos_volume", "debit_cards_pos_volume");
  return figure({
    bare: true, file: "india-atlas_payments-neft-and-cards-since-2004",
    label: `NEFT and card payments at shops a month since April 2004, crore, the RBI's old table to October 2019 drawn apart from the re-organised one: NEFT ${F.crore(m.series.neft_volume.data.at(-1))} and card payments at shops ${F.crore(lastOf(posNew)[1] * CR)} in the latest month`,
    data: { cols: ["month", "table", "neft_payments", "card_payments_at_pos"],
      rows: [...o.dates.map((d, i) => [d, "old (to Oct 2019)", o.series.neft_volume.data[i], posOld[i][1] == null ? null : Math.round(posOld[i][1] * CR)]),
        ...m.dates.map((d, i) => [d, "re-organised (from Nov 2019)", m.series.neft_volume.data[i], posNew[i][1] == null ? null : Math.round(posNew[i][1] * CR)])] },
    draw: (width) => K.line({
      width, freq: "month", unit: { suffix: " crore" }, endFormat: crore0, hoverDp: 1,
      seam: { t: "2019-11-01", before: "Old table", after: "Re-organised table" },
      series: [
        { name: "Card payments at shops, old table", data: posOld, role: "ctx2", label: false },
        { name: "NEFT, old table", data: ser(o, "neft_volume", CR), role: "lead", color: K.C.leadSoft, label: false },
        { name: "Cards at shops", data: posNew, role: "ctx" },
        { name: "NEFT", data: ser(m, "neft_volume", CR), role: "lead" },
      ],
    }),
  });
}
export function cheques() {
  const hb = fyPts(ser(h, "all_india_number", CR)), pt = fyPts(ser(a, "paper_volume", CR));
  const mx = [...hb, ...pt].filter((p) => p[1] != null).reduce((x, y) => (y[1] > x[1] ? y : x));
  const fy = (d) => K.tlabel(d, "fy");
  return figure({
    bare: true, file: "india-atlas_payments-cheques-since-1970",
    label: `Cheques cleared each fiscal year since 1970-71, crore: ${crore0(hb[0][1])} in 1970-71, a high of ${crore0(mx[1])} in ${fy(mx[0])}, ${crore0(lastOf(pt)[1])} in ${fy(lastOf(pt)[0])}`,
    data: { cols: ["fiscal_year", "source", "cheques_cleared", "value_inr"],
      rows: [...h.dates.map((d, i) => [fyOf(d), "Handbook cheque clearances", h.series.all_india_number.data[i], h.series.all_india_amount.data[i]]), ...a.dates.map((d, i) => [fyOf(d), "Payment system table, paper instruments", a.series.paper_volume.data[i], null])] },
    draw: (width) => K.line({
      width, freq: "fy", unit: { suffix: " crore" }, endFormat: crore0, hoverDp: 1, yDomain: [0, mx[1] * 1.3], // headroom: the note on the peak sits clear of the seam labels
      seam: { t: pt[0][0], before: "Handbook series", after: "Payment table" },
      series: [
        { name: "Handbook cheque series", data: hb, role: "lead", color: K.C.leadSoft, label: false },
        { name: "Paper instruments", short: "Cheques", data: pt, role: "lead" },
      ],
      notes: [{ d: mx[0], v: mx[1], text: `Peak, ${fy(mx[0])}\n${crore0(mx[1])}` }],
    }),
  });
}
export function clearing() {
  const houses = ser(chb, "total");
  // three centres that cross one another: a fixed categorical hue each, so a line is traced by colour as well as by its end label
  const C3 = [["Mumbai", "mumbai_number", K.C.teal], ["New Delhi", "new_delhi_number", K.C.turmeric], ["Chennai", "chennai_number", K.C.plum]];
  const grid = fyPts(ser(c, "national_grid_number", CR));
  return figure({
    bare: true, file: "india-atlas_payments-clearing",
    label: `Two charts. Cheque clearing houses in India at end-March, ${houses[0][1]} in ${houses[0][0].slice(0, 4)} to ${lastOf(houses)[1]} in ${lastOf(houses)[0].slice(0, 4)}. Cheques cleared at Mumbai, New Delhi and Chennai, crore a year, until the national grid took them over in ${K.tlabel(grid.find((p) => p[1] != null)[0], "fy")}`,
    data: { cols: ["year_end_march", "clearing_houses", "micr_clearing_houses", "mumbai_cheques", "new_delhi_cheques", "chennai_cheques", "national_grid_cheques"],
      rows: chb.dates.map((d, i) => { const j = c.dates.indexOf(d); return [d, chb.series.total.data[i], chb.series.micr.data[i], ...["mumbai_number", "new_delhi_number", "chennai_number", "national_grid_number"].map((k) => (j < 0 ? null : c.series[k].data[j]))]; }) },
    draw: (width) => pair(width, [
      { name: "Clearing houses", sub: "end-March each year", draw: (w) => K.columns({ width: w, data: houses, freq: "year", dp: 0, valueDp: 0 }) },
      { name: "Cheques cleared by centre", sub: "crore a year", draw: (w) => K.line({ width: w, freq: "fy", unit: { suffix: " crore" }, endFormat: (v) => num(v, { dp: 1 }),
        series: [...C3.map(([name, k, color]) => ({ name, short: name === "New Delhi" ? "Delhi" : name, data: fyPts(ser(c, k, CR)), role: "cat", color })), { name: "National grid", data: grid, role: "lead" }] }) },
    ]),
  });
}

/* ---------- § 08 the digital rupee ---------- */
export function erupee() {
  const keys = Object.keys(e.series);
  const rows = e.dates.map((d, i) => ({ name: "March " + d.slice(0, 4), parts: [e.series.retail.data[i], e.series.wholesale.data[i]].map((v) => (v == null ? null : v / CR)), highlight: i === e.dates.length - 1 }));
  return figure({
    bare: true, file: "india-atlas_payments-e-rupee",
    label: "e-rupee in circulation on 31 March, retail and wholesale: " + e.dates.map((d, i) => `March ${d.slice(0, 4)} ${F.rsCrore(e.series.total.data[i])}`).join(", "),
    data: { cols: ["as_on", ...keys.map((k) => k + "_inr")], rows: e.dates.map((d, i) => [d, ...keys.map((k) => e.series[k].data[i])]) },
    draw: (width) => K.stackBars({ width, rows, sort: false, parts: [{ name: "Retail", color: K.C.lead }, { name: "Wholesale", color: K.C.ctx2 }], absolute: { fmt: (v) => F.rsCrore(v * CR), unit: { suffix: " crore" } } }),
  });
}
