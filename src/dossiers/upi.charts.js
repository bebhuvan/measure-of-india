// UPI guide (NPCI): the plates, drawn at build time with the chart kit (src/kit/). Each export
// returns a bare figure for a plate's .plotzone; titles, source lines and buttons stay in
// src/pages/guides/upi.astro, and every number the page prints comes from src/dossiers/upi.model.js.
// Bundles store counts and rupees (NPCI's millions and crores times a power of ten, see
// scripts/lib/products/npci.mjs). Shares, averages and rates are computed here from NPCI's own
// figures and labelled as such; NPCI's rulers (BHIM's two definitions, the cheque grids and the
// national grid) are drawn apart and never joined.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as F from "./payments.fmt.js";
import { B, U } from "./upi.model.js";

const CR = 1e7, LK = 1e5, LC = 1e12;
const { num } = K;
const ser = (b, key, k = 1) => b.dates.map((d, i) => [d, b.series[key].data[i] == null ? null : b.series[key].data[i] / k]);
const ratio = (b, a, c, k = 1, from = null) => b.dates.map((d, i) => { const x = b.series[a].data[i], y = b.series[c].data[i]; return [d, x == null || y == null || y === 0 || (from && d < from) ? null : (k * x) / y]; });
const lastOf = (P) => P.filter((p) => p[1] != null).at(-1);
const pct1 = (v) => num(v, { dp: 1, suffix: "%" });
const crore1 = (v) => num(v, { dp: v >= 100 ? 0 : 1, suffix: " crore" });
const lakhRs = (v) => (v >= 1e5 ? "₹" + num(v / 1e5, { dp: 1 }) + " lakh" : F.rupees(v));
const cols = (b, keys) => ({ cols: ["date", ...keys], rows: b.dates.map((d, i) => [d, ...keys.map((k) => b.series[k]?.data[i] ?? null)]) });
const TICK = { 10: "₹10", 100: "₹100", 1000: "₹1,000", 10000: "₹10,000", 100000: "₹1 lakh", 1000000: "₹10 lakh" };

function pair(width, [A, Bp]) {
  const { across, w, gap } = K.panelFit(width, 2, { gap: 40 });
  return K.panels([A.draw(w), Bp.draw(w)], { across, gap, titles: [[A.name, A.sub], [Bp.name, Bp.sub]] });
}
// a count panel on its own scale and unit: crore from a crore, lakh from a lakh
function countPanel(b, key, name, sub, highlight, k0 = null) {
  const raw = b.series[key].data, mx = Math.max(...raw.filter((v) => v != null));
  const [k, suffix] = k0 ?? (mx >= 1e7 ? [CR, " crore"] : mx >= 1e5 ? [LK, " lakh"] : [1, ""]);
  return { name, sub, highlight, data: ser(b, key, k), unit: { suffix }, vText: F.count(raw.filter((v) => v != null).at(-1)) };
}

// daily tables carry NPCI's typing slips (a day printed ten times too large); a chart does not draw a
// day above five times the median of the fortnight around it, and says which; the data keep it
export function dropSpikes(P) {
  const skipped = [];
  const out = P.map(([d, v], i) => {
    if (v == null) return [d, v];
    const nb = P.slice(Math.max(0, i - 7), i + 8).filter((q) => q[0] !== d && q[1] != null).map((q) => q[1]).sort((x, y) => x - y);
    const med = nb[nb.length >> 1];
    if (med > 0 && v > 5 * med) { skipped.push(d); return [d, null]; }
    return [d, v];
  });
  return { out, skipped };
}
/* ---------- title block ---------- */
export const sparkUpi = () => K.spark(ser(B.upi, "volume"), { width: 190, height: 44 });

/* ---------- § UPI month by month ---------- */
export function growth() {
  const u = B.upi;
  return figure({
    bare: true, file: "measure-of-india_upi-monthly",
    label: `Two charts. UPI payments a month, crore, ${F.crore(U.upi.n0)} in ${U.upi.firstMonth} to ${F.crore(U.upi.n)} in ${U.upi.month}. Value of UPI payments a month, ₹ lakh crore, now ${F.lakhCrore(U.upi.v)}`,
    data: cols(u, ["volume", "value", "banks_live"]),
    draw: (width) => pair(width, [
      { name: "UPI payments a month", sub: "crore", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: crore1, hoverDp: 1,
        events: [{ t: "2016-11-08", label: "Old notes withdrawn", short: "Notes withdrawn" }], series: [{ name: "UPI payments", short: "Payments", data: ser(u, "volume", CR), role: "lead" }] }) },
      { name: "Money moved a month", sub: "₹ lakh crore", draw: (w) => K.line({ width: w, freq: "month", unit: { prefix: "₹" }, endFormat: (v) => "₹" + num(v, { dp: 1 }), hoverDp: 2,
        series: [{ name: "Value", data: ser(u, "value", LC), role: "lead" }] }) },
    ]),
  });
}
const sgn = (v) => num(v, { dp: 1, sign: true, suffix: "%" });
export function yoy() {
  const Y = U.yoy;
  return figure({
    bare: true, file: "measure-of-india_upi-growth",
    label: `Growth of UPI on the same month a year earlier, per cent, from ${Y.from}: number of payments ${sgn(Y.v)} and value ${sgn(Y.val1)} in ${Y.month}`,
    data: { cols: ["month", "payments_growth_pct", "value_growth_pct"], rows: Y.vol.map(([d, v], i) => [d, v == null ? null : +v.toFixed(3), Y.val[i][1] == null ? null : +Y.val[i][1].toFixed(3)]).filter((r) => r[1] != null || r[2] != null) },
    draw: (width) => K.line({ width, freq: "month", unit: { suffix: "%" }, endFormat: sgn, hoverDp: 1,
      events: [{ t: "2020-03-25", label: "Lockdown", short: "Lockdown" }],
      series: [{ name: "Value of payments", short: "Value", data: Y.val.filter((q) => q[0] >= "2019-04-01"), role: "ctx" }, { name: "Number of payments", short: "Number", data: Y.vol.filter((q) => q[0] >= "2019-04-01"), role: "lead" }] }),
  });
}
export function yoyNetworks() {
  const panels = U.yoyNet.map((x) => ({ name: x.name, sub: x.what + ", growth on a year earlier", highlight: x.key === "upi", data: x.data.filter((q) => q[0] >= "2023-04-01"), unit: { suffix: "%" }, vText: sgn(x.last) }));
  return figure({
    bare: true, file: "measure-of-india_growth-by-network",
    label: "Four small line charts, growth on the same month a year earlier, per cent, each on its own scale: " + U.yoyNet.map((x) => `${x.name} ${sgn(x.last)} in ${x.month}`).join(", "),
    data: { cols: ["month", ...U.yoyNet.map((x) => x.key + "_growth_pct")], rows: U.yoyNet[0].data.filter((q) => q[0] >= "2023-04-01").map(([d]) => [d, ...U.yoyNet.map((x) => { const v = x.data.find((q) => q[0] === d)?.[1]; return v == null ? null : +v.toFixed(3); })]) },
    draw: (width) => K.multiples({ width, panels, shared: false, cols: width < 560 ? 2 : 4 }),
  });
}
export function ticket() {
  const u = B.upi, p = B.p2p;
  const all = ratio(u, "value", "volume", 1, U.ticket.from), P2P = ratio(p, "p2p_value", "p2p_volume"), P2M = ratio(p, "p2m_value", "p2m_volume");
  return figure({
    bare: true, file: "measure-of-india_upi-average-payment",
    label: `Average UPI payment in rupees, monthly: all UPI ${F.rupees(lastOf(all)[1])}, between people ${F.rupees(lastOf(P2P)[1])}, to merchants ${F.rupees(lastOf(P2M)[1])} in the latest month`,
    data: { cols: ["month", "average_all_upi_inr", "average_person_to_person_inr", "average_person_to_merchant_inr"],
      rows: u.dates.map((d, i) => { const j = p.dates.indexOf(d); return [d, all[i][1], j < 0 ? null : P2P[j][1], j < 0 ? null : P2M[j][1]]; }) },
    draw: (width) => K.line({ width, freq: "month", unit: { prefix: "₹" }, endFormat: F.rupees, hoverDp: 0,
      series: [
        { name: "Between people (P2P)", short: "Between people", data: P2P, role: "ctx" },
        { name: "All UPI", data: all, role: "lead" },
        { name: "To merchants (P2M)", short: "To merchants", data: P2M, role: "comp" },
      ] }),
  });
}
export function p2m() {
  const p = B.p2p, V = ratio(p, "p2m_volume", "total_volume", 100), M = ratio(p, "p2m_value", "total_value", 100);
  return figure({
    bare: true, file: "measure-of-india_upi-merchant-share",
    label: `Payments to merchants as a share of all UPI, per cent: ${pct1(V[0][1])} of payments in ${U.p2p.firstMonth}, ${pct1(lastOf(V)[1])} in ${U.p2p.month}; ${pct1(lastOf(M)[1])} of the money`,
    data: cols(p, Object.keys(p.series)),
    draw: (width) => K.line({ width, freq: "month", unit: { suffix: "%" }, endFormat: pct1, hoverDp: 1, yDomain: [0, 100],
      refs: [{ y: 50, label: "Half" }],
      series: [{ name: "Share of the money", short: "Of the money", data: M, role: "ctx" }, { name: "Share of payments", short: "Of payments", data: V, role: "lead" }] }),
  });
}
export function daily() {
  const d = B.daily, { out: P } = dropSpikes(ser(d, "upi_volume", CR)), mx = P.filter((p) => p[1] != null).reduce((x, y) => (y[1] > x[1] ? y : x));
  return figure({
    bare: true, file: "measure-of-india_upi-daily",
    label: `UPI payments each day, crore, from ${K.tlabel(d.dates[0], "day")} to ${K.tlabel(d.dates.at(-1), "day")}; the busiest day was ${K.tlabel(mx[0], "day")} with ${crore1(mx[1])}`,
    data: cols(d, ["upi_volume", "upi_value"]),
    // the busiest day is the plate's own figure; a note on the line would sit on the end label when that day is recent
    draw: (width) => K.line({ width, freq: "day", unit: { suffix: " crore" }, endFormat: crore1, hoverDp: 1, yDomain: [0, mx[1] * 1.15],
      series: [{ name: "UPI payments a day", short: "Per day", data: P, role: "lead" }] }),
  });
}

/* ---------- § apps ---------- */
export function apps() {
  const a = B.apps, rows = U.apps.lines;
  return figure({
    bare: true, file: "measure-of-india_upi-app-shares",
    label: "Share of UPI payments made from each app, per cent of all apps' payments in NPCI's table, monthly: " + rows.map((r) => `${r.name} ${pct1(lastOf(r.data)[1])}`).join(", "),
    data: { cols: ["month", ...rows.map((r) => r.key + "_share_pct")], rows: a.dates.map((d, i) => [d, ...rows.map((r) => r.data[i][1] == null ? null : +r.data[i][1].toFixed(3))]) },
    draw: (width) => K.line({ width, freq: "month", unit: { suffix: "%" }, endFormat: pct1, hoverDp: 1, yDomain: [0, 60],
      notes: (() => { const pb = rows.find((r) => r.key === "paytmpaymentsbankapp"), e = pb && lastOf(pb.data); return e ? [{ d: e[0], v: e[1], text: `Paytm Payments Bank app\nlast listed ${K.tlabel(e[0], "month")}` }] : []; })(),
      // the Paytm Payments Bank app ends in January 2024: no end label at the right edge for a finished line
      series: rows.slice().reverse().map((r) => ({ name: r.name, short: r.short, data: r.data, role: r.role, color: r.color, ...(r.key === "paytmpaymentsbankapp" ? { label: false } : {}) })) }),
  });
}
export function appsLatest() {
  const rows = U.apps.latest.slice(0, 15).map((r) => ({ name: r.name, value: r.share, highlight: r.rank < 2 }));
  return figure({
    bare: true, file: "measure-of-india_upi-apps-latest",
    label: `The fifteen apps with the most UPI payments, ${U.apps.month}, share of all apps' payments: ` + rows.map((r) => `${r.name} ${pct1(r.value)}`).join(", "),
    data: { cols: ["app", "payments", "value_inr", "share_of_payments_pct"], rows: U.apps.latest.map((r) => [r.name, r.volume, r.value, +r.share.toFixed(3)]) },
    draw: (width) => K.bars({ width, rows, sort: false, fmt: (v) => num(v, { dp: v < 1 ? 2 : 1, suffix: "%" }), unit: { suffix: "%" } }),
  });
}
export function appsKind() {
  const rows = U.apps.b2c.slice(0, 12).map((r, i) => ({ name: r.name, value: r.b2c / LK, highlight: i === 0 }));
  return figure({
    bare: true, file: "measure-of-india_upi-apps-business-payouts",
    label: `The twelve apps carrying the most business-to-customer UPI payments, ${U.apps.month}, lakh: ` + rows.map((r) => `${r.name} ${num(r.value, { dp: 1 })} lakh`).join(", "),
    data: { cols: ["app", "business_to_customer_payments", "business_to_customer_value_inr", "all_payments"], rows: U.apps.b2c.map((r) => [r.name, r.b2c, r.b2cValue, r.total]) },
    draw: (width) => K.bars({ width, rows, sort: false, fmt: (v) => num(v, { dp: 1, suffix: " lakh" }), nameMax: 190 }),
  });
}

/* ---------- § what people pay for ---------- */
export function mcc() {
  const L = U.mcc.latest.slice(0, 15);
  const V = L.map((r) => ({ name: r.short, value: r.volume / CR, highlight: r.code === "5411" }));
  const M = U.mcc.byValue.slice(0, 15).map((r) => ({ name: r.short, value: r.value / 1e7, highlight: r.code === "5411" }));
  return figure({
    bare: true, file: "measure-of-india_upi-merchant-categories",
    label: `Two charts. The fifteen merchant categories with the most UPI payments, ${U.mcc.month}, crore: ` + V.map((r) => `${r.name} ${crore1(r.value)}`).join(", ") + `. The fifteen with the most money, ₹ crore: ` + M.map((r) => `${r.name} ₹${num(r.value, { dp: 0 })}`).join(", "),
    data: { cols: ["mcc", "category", "payments", "value_inr", "average_inr"], rows: U.mcc.all.map((r) => [r.code, r.name, r.volume, r.value, r.volume ? Math.round(r.value / r.volume) : null]) },
    draw: (width) => pair(width, [
      { name: "By number of payments", sub: `crore, ${U.mcc.month}`, draw: (w) => K.bars({ width: w, rows: V, sort: false, fmt: crore1, nameMax: 170 }) },
      { name: "By money paid", sub: `₹ crore, ${U.mcc.month}`, draw: (w) => K.bars({ width: w, rows: M, sort: false, fmt: (v) => "₹" + num(v, { dp: 0 }), nameMax: 170 }) },
    ]),
  });
}
export function mccTicket() {
  const rows = U.mcc.latest.slice(0, 20).map((r) => ({ name: r.short, value: r.value / r.volume, highlight: r.code === "5411" }));
  return figure({
    bare: true, file: "measure-of-india_upi-merchant-average",
    label: `Average UPI payment in the twenty biggest merchant categories by number, ${U.mcc.month}, rupees, logarithmic scale: ` + rows.slice().sort((a, b) => b.value - a.value).map((r) => `${r.name} ${lakhRs(r.value)}`).join(", "),
    data: { cols: ["category", "average_inr"], rows: rows.map((r) => [r.name, Math.round(r.value)]) },
    draw: (width) => K.bars({ width, rows, log: true, fmt: lakhRs, tickFmt: (v) => TICK[v] ?? "", nameMax: 190 }),
  });
}
export function mccTrend() {
  const panels = U.mcc.trend.map((t) => countPanel(B.mcc, t.key, t.name, t.sub, t.code === "5411", [CR, " crore"]));
  return figure({
    bare: true, file: "measure-of-india_upi-merchant-category-trends",
    label: "Small line charts, UPI payments a month in eight merchant categories, crore, each on its own scale; a gap is a month NPCI did not list the category: " + panels.map((p) => `${p.name} ${p.vText}`).join(", "),
    data: cols(B.mcc, U.mcc.trend.map((t) => t.key)),
    draw: (width) => K.multiples({ width, panels, shared: false }),
  });
}
export function segments() {
  const panels = U.segments.map((s) => ({ ...countPanel(B.seg, s.key + "__volume", s.name, s.sub, false), vText: F.count(lastOf(ser(B.seg, s.key + "__volume"))[1]) }));
  return figure({
    bare: true, file: "measure-of-india_upi-segments",
    label: "Six small line charts, UPI payments a month to merchants in six segments NPCI reports apart, each on its own scale: " + panels.map((p) => `${p.name} ${p.vText}`).join(", "),
    data: cols(B.seg, Object.keys(B.seg.series)),
    draw: (width) => K.multiples({ width, panels, shared: false }),
  });
}

/* ---------- § where ---------- */
export function statesMap() {
  const S = U.states;
  return figure({
    bare: true, file: "measure-of-india_upi-states-map",
    label: `A tile map of India, one equal tile per state and union territory, shaded by its share of the UPI payments NPCI assigned to a state, ${S.month}: ` + S.rows.slice(0, 6).map((r) => `${r.name} ${pct1(r.shareOfAssigned)}`).join(", "),
    data: { cols: ["state", "payments", "value_inr", "share_of_assigned_pct", "average_inr"], rows: S.rows.map((r) => [r.name, r.volume, r.value, +r.shareOfAssigned.toFixed(3), Math.round(r.avg)]) },
    draw: (width) => K.tileMap({ width, unit: { suffix: "%" }, dp: 1, legendLabel: "Share of the payments NPCI assigned to a state", breaks: [0.5, 1, 2, 4, 8],
      values: Object.fromEntries(S.rows.map((r) => [r.tile, r.shareOfAssigned])), names: Object.fromEntries(S.rows.map((r) => [r.tile, r.name])) }),
  });
}
const SHORT_STATE = { "Dadra and Nagar Haveli and Daman and Diu": "DNH and Daman Diu", "Andaman and Nicobar Islands": "Andaman and Nicobar" };
export function statesRank() {
  const S = U.states;
  const V = S.rows.map((r) => ({ name: SHORT_STATE[r.name] ?? r.name, value: r.volume / CR, highlight: r.rank === 0 }));
  const A = S.rows.slice().sort((a, b) => b.avg - a.avg).map((r) => ({ name: SHORT_STATE[r.name] ?? r.name, value: r.avg }));
  return figure({
    bare: true, file: "measure-of-india_upi-states",
    label: `Two charts. UPI payments by state, ${S.month}, crore, ranked: ` + V.slice(0, 8).map((r) => `${r.name} ${crore1(r.value)}`).join(", ") + `. Average payment by state, rupees: highest ${A[0].name} ${F.rupees(A[0].value)}, lowest ${A.at(-1).name} ${F.rupees(A.at(-1).value)}`,
    data: { cols: ["state", "payments", "value_inr", "average_inr"], rows: S.rows.map((r) => [r.name, r.volume, r.value, Math.round(r.avg)]) },
    draw: (width) => pair(width, [
      { name: "Payments in the month", sub: `crore, ${S.month}`, draw: (w) => K.bars({ width: w, rows: V, sort: false, fmt: crore1, nameMax: 150 }) },
      { name: "The average payment", sub: `rupees, ${S.month}`, draw: (w) => K.bars({ width: w, rows: A, sort: false, fmt: F.rupees, ref: { value: S.avgAll, label: `All assigned ${F.rupees(S.avgAll)}` }, nameMax: 150 }) },
    ]),
  });
}
export function unassigned() {
  const P = U.unassigned.line;
  return figure({
    bare: true, file: "measure-of-india_upi-unassigned",
    label: `Share of UPI payments NPCI could not assign to a state, per cent, monthly: ${pct1(P.find((p) => p[1] != null)[1])} in ${U.unassigned.first} and ${pct1(lastOf(P)[1])} in ${U.unassigned.month}`,
    data: { cols: ["month", "unassigned_share_pct"], rows: P.map(([d, v]) => [d, v == null ? null : +v.toFixed(3)]) },
    draw: (width) => K.line({ width, freq: "month", unit: { suffix: "%" }, endFormat: pct1, hoverDp: 1, yDomain: [0, 60],
      series: [{ name: "Not assigned to any state", short: "Unassigned", data: P, role: "comp" }] }),
  });
}
export function districts() {
  const rows = U.districts.top.map((r, i) => ({ name: r.name, value: r.volume / CR, highlight: i === 0 }));
  return figure({
    bare: true, file: "measure-of-india_upi-districts",
    label: `The twenty-five districts with the most UPI payments, ${U.districts.month}, crore: ` + rows.map((r) => `${r.name} ${crore1(r.value)}`).join(", "),
    data: { cols: ["district", "state", "payments", "value_inr", "average_inr"], rows: U.districts.all.map((r) => [r.district, r.state, r.volume, r.value, r.volume ? Math.round(r.value / r.volume) : null]) },
    draw: (width) => K.bars({ width, rows, sort: false, fmt: crore1, nameMax: 280 }),
  });
}

/* ---------- § the other networks ---------- */
export function imps() {
  const b = B.imps, avg = ratio(b, "value", "volume");
  return figure({
    bare: true, file: "measure-of-india_imps",
    label: `Two charts. IMPS transfers a month, crore, now ${F.crore(U.imps.n)}. The average IMPS transfer, rupees, ${F.rupees(avg[0][1])} in ${U.imps.firstMonth} and ${F.rupees(lastOf(avg)[1])} in ${U.imps.month}`,
    data: cols(b, ["volume", "value", "member_banks"]),
    draw: (width) => pair(width, [
      { name: "IMPS transfers a month", sub: "crore", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: crore1, series: [{ name: "IMPS", data: ser(b, "volume", CR), role: "lead" }] }) },
      { name: "The average transfer", sub: "rupees", draw: (w) => K.line({ width: w, freq: "month", unit: { prefix: "₹" }, endFormat: F.rupees, hoverDp: 0, series: [{ name: "Average", data: avg, role: "lead" }] }) },
    ]),
  });
}
export function nachDebit() {
  const b = B.nachDr, rate = ratio(b, "total_debit__returned", "total_debit__presented", 100);
  return figure({
    bare: true, file: "measure-of-india_nach-debits",
    label: `Two charts. NACH debits presented a month (EMIs, SIPs, premiums, bills), crore, now ${F.crore(U.nach.dr)}. Share returned unpaid, per cent, ${pct1(lastOf(rate)[1])} in ${U.nach.month}`,
    data: cols(b, Object.keys(b.series).filter((k) => k.startsWith("total_debit") || k.startsWith("debit_"))),
    draw: (width) => pair(width, [
      { name: "Debits presented a month", sub: "crore", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: crore1, yDomain: [0, Math.max(...b.series.total_debit__presented.data.filter((v) => v != null)) / CR * 1.2], series: [{ name: "Presented", data: ser(b, "total_debit__presented", CR), role: "lead" }] }) },
      { name: "Returned unpaid", sub: "per cent of debits presented", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: "%" }, endFormat: pct1, yDomain: [0, 50], series: [{ name: "Returned", data: rate, role: "comp" }] }) },
    ]),
  });
}
export function nachCredit() {
  const b = B.nachCr;
  const P = [["apbs__dbt__successful", "Benefits by Aadhaar number", "APBS, direct benefit transfers", true], ["credit_306__dbt__successful", "Benefits by account number", "NACH, direct benefit transfers"],
    ["credit_306__other_credits__successful", "Salaries, pensions, dividends", "NACH, other credits"], ["apbs__dbt_lpg__successful", "LPG subsidy by Aadhaar", "APBS"],
    ["credit_306__dbt_lpg__successful", "LPG subsidy by account", "NACH"], ["apbs__other_credits__successful", "Other credits by Aadhaar", "APBS"]];
  const panels = P.map(([k, name, sub, hi]) => countPanel(b, k, name, sub + ", credited a month", hi));
  return figure({
    bare: true, file: "measure-of-india_nach-credits",
    label: "Six small line charts, NACH and APBS credits that reached accounts each month, by kind, each on its own scale: " + panels.map((p) => `${p.name} ${p.vText}`).join(", "),
    data: cols(b, Object.keys(b.series)),
    draw: (width) => K.multiples({ width, panels, shared: false, cols: width < 560 ? 2 : 3 }),
  });
}
export function mandates() {
  const b = B.mms;
  // a month whose processed count is not accepted + rejected (NPCI's slip, February 2023: a digit
  // dropped from the rejected count) has no rate drawn; the figures stay in the data as printed
  const adds = (i) => { const p = b.series.processed.data[i], a = b.series.accepted.data[i], r = b.series.rejected.data[i]; return p != null && a != null && r != null && Math.abs(p - a - r) <= 1; };
  const rate = ratio(b, "rejected", "processed", 100).map(([d, v], i) => [d, adds(i) ? v : null]);
  return figure({
    bare: true, file: "measure-of-india_nach-mandates",
    label: `Two charts. NACH mandates processed a month, lakh, now ${F.count(U.mms.n)}. Share rejected, per cent, ${pct1(lastOf(rate)[1])} in ${U.mms.month}`,
    data: cols(b, ["processed", "accepted", "rejected"]),
    draw: (width) => pair(width, [
      { name: "Mandates processed a month", sub: "lakh", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " lakh" }, endFormat: (v) => num(v, { dp: 1, suffix: " lakh" }), series: [{ name: "Processed", data: ser(b, "processed", LK), role: "lead" }] }) },
      { name: "Rejected", sub: "per cent of mandates processed", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: "%" }, endFormat: pct1, yDomain: [0, 100], series: [{ name: "Rejected", data: rate, role: "comp" }] }) },
    ]),
  });
}
export function fastag() {
  const b = B.netc;
  return figure({
    bare: true, file: "measure-of-india_fastag",
    label: `Two charts. FASTag toll and parking payments a month, crore, now ${F.crore(U.netc.n)}, with trips on the annual pass from August 2025, now ${F.crore(U.netc.pass)}. FASTags issued, cumulative, crore, now ${F.crore(U.netc.tags)}`,
    data: cols(b, Object.keys(b.series)),
    draw: (width) => pair(width, [
      { name: "Toll and parking payments a month", sub: "crore", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: crore1,
        series: [{ name: "Annual-pass trips", short: "Annual pass", data: ser(b, "annual_pass_volume", CR), role: "ctx" }, { name: "Toll and parking", short: "Paid trips", data: ser(b, "volume", CR), role: "lead" }] }) },
      { name: "FASTags issued", sub: "crore, cumulative", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: crore1, series: [{ name: "Tags", data: ser(b, "tags_issued", CR), role: "lead" }] }) },
    ]),
  });
}
export function aeps() {
  const b = B.aeps;
  const P = [["offus_volume", "Off-us transactions", "agent and customer at different banks", true], ["onus_volume", "On-us transactions", "agent and customer at the same bank"],
    ["bhim_aadhaar_pay_volume", "BHIM Aadhaar Pay", "paying a shop by fingerprint"], ["ekyc", "eKYC", "identity checks by Aadhaar"], ["demo_auth", "Demographic checks", "name, age, address matched"]];
  const panels = P.map(([k, name, sub, hi]) => countPanel(b, k, name, sub, hi));
  return figure({
    bare: true, file: "measure-of-india_aeps",
    label: "Five small line charts, Aadhaar-enabled payments and checks a month, each on its own scale: " + panels.map((p) => `${p.name} ${p.vText}`).join(", "),
    data: cols(b, Object.keys(b.series)),
    draw: (width) => K.multiples({ width, panels, shared: false, cols: width < 560 ? 2 : 3 }),
  });
}
export function cheques() {
  const g = B.ctsGrids, n = B.cts;
  const C3 = [["Western grid (Mumbai)", "western", K.C.teal, "Western"], ["Southern grid (Chennai)", "southern", K.C.turmeric, "Southern"], ["Northern grid (Delhi)", "northern", K.C.plum, "Northern"]];
  return figure({
    bare: true, file: "measure-of-india_cheques",
    label: `Two charts. Cheques presented a month, crore: the three regional grids to October 2023, then the national grid, now ${F.crore(U.cts.n)}. Share of cheques returned, per cent, ${pct1(U.cts.rate)} in ${U.cts.month}`,
    data: { cols: ["month", ...C3.flatMap(([, k]) => [`${k}_presented`, `${k}_return_rate_pct`]), "national_presented", "national_return_rate_pct"],
      rows: [...g.dates.map((d, i) => [d, ...C3.flatMap(([, k]) => [g.series[`${k}__presented`]?.data[i] ?? null, g.series[`${k}__return_rate`]?.data[i] ?? null]), null, null]),
        ...n.dates.map((d, i) => [d, ...C3.flatMap(() => [null, null]), n.series.presented.data[i], n.series.return_rate.data[i]])] },
    draw: (width) => pair(width, [
      { name: "Cheques presented a month", sub: "crore", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: " crore" }, endFormat: (v) => num(v, { dp: 2 }), hoverDp: 2,
        seam: { t: n.dates[0], before: "Three grids", after: "National grid" },
        series: [...C3.map(([name, k, color, short]) => ({ name, short, data: ser(g, `${k}__presented`, CR), role: "cat", color, label: false })), { name: "National grid", short: "National", data: ser(n, "presented", CR), role: "lead" }] }) },
      { name: "Returned", sub: "per cent of cheques presented", draw: (w) => K.line({ width: w, freq: "month", unit: { suffix: "%" }, endFormat: pct1, yDomain: [0, 10],
        seam: { t: n.dates[0], before: "Grids", after: "National" },
        series: [...C3.map(([name, k, color, short]) => ({ name, short, data: ser(g, `${k}__return_rate`), role: "cat", color, label: false })), { name: "National grid", short: "National", data: ser(n, "return_rate"), role: "lead" }] }) },
    ]),
  });
}
export function atm() {
  const d = B.daily, { out: P } = dropSpikes(ser(d, "nfs_volume", LK));
  return figure({
    bare: true, file: "measure-of-india_nfs-daily",
    label: `Transactions on the shared ATM network (NFS) each day, lakh, ${K.tlabel(d.dates[0], "day")} to ${K.tlabel(d.dates.at(-1), "day")}; ${num(lastOf(P)[1], { dp: 1 })} lakh on the latest day`,
    data: cols(d, ["nfs_volume", "nfs_value"]),
    draw: (width) => K.line({ width, freq: "day", unit: { suffix: " lakh" }, endFormat: (v) => num(v, { dp: 1, suffix: " lakh" }), hoverDp: 1,
      series: [{ name: "NFS transactions a day", short: "Per day", data: P, role: "lead" }] }),
  });
}
export function bhim() {
  const o = B.bhimOld, nw = B.bhim, u = B.upi;
  const share = (b) => b.dates.map((d, i) => { const j = u.dates.indexOf(d), v = b.series.volume.data[i], t = j < 0 ? null : u.series.volume.data[j]; return [d, v == null || !t ? null : (100 * v) / t]; });
  const S0 = share(o), S1 = share(nw);
  return figure({
    bare: true, file: "measure-of-india_bhim-share",
    label: `NPCI's own BHIM app as a share of all UPI payments, per cent: ${pct1(S0.find((p) => p[1] != null)[1])} in ${K.tlabel(o.dates[0], "month")}, ${pct1(lastOf(S1)[1])} in ${K.tlabel(lastOf(S1)[0], "month")}; NPCI changed what it counts in April 2020, so the two lines are not joined`,
    data: { cols: ["month", "definition", "bhim_payments", "bhim_share_of_upi_pct"], rows: [...o.dates.map((d, i) => [d, "started in BHIM", o.series.volume.data[i], S0[i][1] == null ? null : +S0[i][1].toFixed(3)]), ...nw.dates.map((d, i) => [d, "BHIM as the payer's app", nw.series.volume.data[i], S1[i][1] == null ? null : +S1[i][1].toFixed(3)])] },
    draw: (width) => K.line({ width, freq: "month", unit: { suffix: "%" }, endFormat: pct1, hoverDp: 1,
      seam: { t: nw.dates[0], before: "Started in BHIM", after: "BHIM as payer's app" },
      series: [{ name: "BHIM, old count", data: S0, role: "lead", color: K.C.leadSoft, label: false }, { name: "BHIM's share of UPI", short: "BHIM", data: S1, role: "lead" }] }),
  });
}
export function erupi() {
  const b = B.erupi, T = U.erupi;
  return figure({
    bare: true, file: "measure-of-india_e-rupi",
    label: `e-RUPI vouchers created a month: the total NPCI printed to December 2023, then the sum of the issuing banks it lists from January 2024; ${F.count(T.last)} in ${T.month}`,
    data: cols(b, Object.keys(b.series)),
    draw: (width) => K.line({ width, freq: "month", unit: { suffix: " lakh" }, endFormat: (v) => num(v, { dp: 2, suffix: " lakh" }), hoverDp: 2,
      seam: { t: "2024-01-01", before: "By scheme", after: "By bank" },
      series: [{ name: "All vouchers, NPCI's total", short: "Total", data: T.total.map(([d, v]) => [d, v == null ? null : v / LK]), role: "lead", color: K.C.leadSoft, label: false },
        { name: "Sum of issuing banks", short: "Banks' sum", data: T.banks.map(([d, v]) => [d, v == null ? null : v / LK]), role: "lead" }] }),
  });
}
export function rbi() {
  const P = U.rbi.diff;
  return figure({
    bare: true, file: "measure-of-india_upi-npci-vs-rbi",
    label: `Difference between NPCI's and the RBI's count of UPI payments each month, per cent of the RBI's figure; the largest is ${num(U.rbi.worst[1], { dp: 2, sign: true, suffix: "%" })} in ${K.tlabel(U.rbi.worst[0], "month")}`,
    data: { cols: ["month", "npci_upi_payments", "rbi_upi_payments", "difference_pct"], rows: U.rbi.rows },
    draw: (width) => K.columns({ width, data: P, freq: "month", unit: { suffix: "%" }, dp: 2, valueDp: 2, highlight: "none" }),
  });
}
