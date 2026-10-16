// Debt guide (how much India owes): the plates, drawn at build time with the chart kit (src/kit/),
// and every number the page quotes. Each plate export returns a bare figure for its .plotzone; the
// plate's title, source line and buttons stay in src/pages/guides/debt.astro.
//
// Data: data/series/bis-*.json (BIS statistics). Quarterly, calendar quarters dated at their first
// month. BIS extrapolates India's latest credit quarters (series.estimated; CONTRACT-series 2b):
// those stretches are drawn pale and dashed (the kit line's `est`), and every claim about
// households or companies uses the last measured quarter.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import * as fmt from "../charts/format.js";
import creditB from "../../data/series/bis-credit.json";
import inrB from "../../data/series/bis-credit-inr.json";
import gapB from "../../data/series/bis-credit-gap.json";
import dsrB from "../../data/series/bis-dsr.json";
import gliB from "../../data/series/bis-gli.json";
import xruB from "../../data/series/bis-xru-quarterly.json";
import policyB from "../../data/series/bis-policy-rate.json";
import usa from "../../data/series/bis-peer-usa.json";
import chn from "../../data/series/bis-peer-chn.json";
import emu from "../../data/series/bis-peer-emu.json";
import gbr from "../../data/series/bis-peer-gbr.json";
import jpn from "../../data/series/bis-peer-jpn.json";
import kor from "../../data/series/bis-peer-kor.json";
import idn from "../../data/series/bis-peer-idn.json";
import bra from "../../data/series/bis-peer-bra.json";
import zaf from "../../data/series/bis-peer-zaf.json";
import mex from "../../data/series/bis-peer-mex.json";
import tur from "../../data/series/bis-peer-tur.json";
import aus from "../../data/series/bis-peer-aus.json";
import can from "../../data/series/bis-peer-can.json";

const PCT = { suffix: "%" };
const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MLONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const qlab = (iso) => { const m = +iso.slice(5, 7) - 1; return `${M3[m]} to ${M3[m + 2]} ${iso.slice(0, 4)}`; };
const LQ = creditB.dates.at(-1);

// a bundle as {key: [{date, value}]} with ISO dates (the shape the page's old client read)
const hyd = (b) => Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, { data: s.data.map((v, i) => ({ date: b.dates[i], value: v ?? null })) }]));
const C = hyd(creditB), G = hyd(gapB), R = hyd(dsrB), L = hyd(gliB), I = hyd(inrB);
const lastPt = (s) => s.data.filter((d) => d.value != null).at(-1);
const last = (s) => lastPt(s).value;
const estOf = (b, k) => new Set(b.series[k]?.estimated ?? []);
const lastMeasured = (s, set) => s.data.filter((d) => d.value != null && !set.has(d.date)).at(-1);
const firstEst = (b, k) => (b.series[k]?.estimated ?? [])[0] ?? null;
const EST = estOf(creditB, "households");
const pc = (u) => `<span class="pc">${u}</span>`;
const yearAgo = (s) => s.data[s.data.length - 5]?.value;
const maxPt = (s) => s.data.reduce((a, d) => (d.value != null && d.value > a.value ? d : a), { value: -1 });

/* peers, one bundle each (CONTRACT-series rule 8) */
const PEERS = [["United States", usa], ["China", chn], ["Euro area", emu], ["United Kingdom", gbr], ["Japan", jpn], ["Korea", kor], ["Indonesia", idn],
  ["Brazil", bra], ["South Africa", zaf], ["Mexico", mex], ["Türkiye", tur], ["Australia", aus], ["Canada", can]];
const lastOf = (b, k) => { const s = b.series[k]; if (!s) return null; for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return { v: s.data[i], d: b.dates[i] }; return null; };
const INDIA = { name: "India", households: last(C.households), companies: last(C.companies), government: last(C.government), total: last(C.total), private: last(C.private), credit_gap: last(G.gap), dsr: last(R.private) };
const peerRows = [INDIA, ...PEERS.map(([name, b]) => ({ name, ...Object.fromEntries(["households", "companies", "government", "total", "private", "credit_gap", "dsr"].map((k) => [k, lastOf(b, k)?.v ?? null])) }))];
const rankOf = (k) => { const xs = peerRows.filter((r) => r[k] != null).sort((a, b) => b[k] - a[k]); return { rank: xs.findIndex((r) => r.name === "India") + 1, n: xs.length }; };
// the comparison: three borrowers' sum (BIS's own "total" values government at market prices in
// some economies, so it does not always equal the parts); Korea has no nominal government figure
const sumRows = peerRows.filter((r) => r.households != null && r.companies != null)
  .map((r) => ({ ...r, sum: r.households + r.companies + (r.government ?? 0), noGov: r.government == null }))
  .sort((a, b) => b.sum - a.sum);
const gapRows = peerRows.filter((r) => r.credit_gap != null).sort((a, b) => b.credit_gap - a.credit_gap);

// a series as kit pairs from a date, values scaled (₹ billion -> lakh crore)
const P = (b, k, from, k2 = 1) => pairs(b, k, { from }).map(([d, v]) => [d, v == null ? null : v / k2]);
const csvOf = (cols, series) => {
  const dates = [...new Set(series.flatMap((s) => s.map((p) => p[0])))].sort();
  const at = series.map((s) => new Map(s));
  return { cols, rows: dates.map((d) => [d, ...at.map((m) => m.get(d) ?? null)]) };
};

/* ---------- § 02 who owes ---------- */
export function sectors() {
  const from = "1981-01-01";
  return figure({
    bare: true, file: "india-atlas_debt-by-borrower",
    label: `Debt of India's households, companies and government as a share of GDP, quarterly from 1981; households and companies from 2007, BIS estimates from ${qlab(firstEst(creditB, "households"))} drawn pale and dashed`,
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "Government", short: "Government", data: P(creditB, "government", from), role: "ctx2" },
        { name: "Companies", short: "Companies (est.)", data: P(creditB, "companies", from), role: "ctx", est: firstEst(creditB, "companies") },
        { name: "Households", short: "Households (est.)", data: P(creditB, "households", from), role: "lead", est: firstEst(creditB, "households") },
      ],
      events: [{ t: "2007-04-01", label: "Households and companies measured from 2007", short: "Split from 2007" }],
    }),
  });
}

export function long() {
  return figure({
    bare: true, file: "india-atlas_private-credit-since-1951",
    label: "Credit to India's households and companies as a share of GDP since 1951, from all lenders and from banks alone",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "Banks only", short: "Banks (est.)", data: P(creditB, "private_banks"), role: "ctx", est: firstEst(creditB, "private_banks") },
        { name: "All lenders", short: "Total (est.)", data: P(creditB, "private"), role: "lead", est: firstEst(creditB, "private") },
      ],
    }),
  });
}

/* ---------- § 03 in rupees ---------- */
export function inr() {
  const from = "2007-01-01", LC = { prefix: "₹", suffix: " lakh cr" };
  return figure({
    bare: true, file: "india-atlas_debt-in-rupees",
    label: "Debt of India's households, companies and government in rupees, lakh crore at current prices, quarterly from 2007",
    draw: (width) => K.line({
      width, freq: "quarter", unit: LC, endDp: 0, hoverDp: 0,
      series: [
        { name: "Government", short: "Government", data: P(inrB, "government", from, 1000), role: "ctx2" },
        { name: "Companies", short: "Companies (est.)", data: P(inrB, "companies", from, 1000), role: "ctx", est: firstEst(inrB, "companies") },
        { name: "Households", short: "Households (est.)", data: P(inrB, "households", from, 1000), role: "lead", est: firstEst(inrB, "households") },
      ],
    }),
  });
}

/* ---------- § 04 the credit gap: two panels, one ruler each ---------- */
const GAP_FROM = "1961-01-01";
export function gapRatio() {
  const ratio = P(gapB, "ratio", GAP_FROM), trend = P(gapB, "trend", GAP_FROM), gap = P(gapB, "gap", GAP_FROM);
  return figure({
    bare: true, file: "india-atlas_credit-gap",
    label: "India's private credit as a share of GDP since 1961, with its long-run trend dashed",
    data: csvOf(["Quarter", "Credit, % of GDP", "Trend, % of GDP", "Gap, points"], [ratio, trend, gap]),
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1, height: width < 520 ? 230 : 300, right: width < 520 ? 84 : 104, inside: false,
      series: [
        { name: "Trend", short: "Trend", data: trend, role: "ctx", dash: "4 3" },
        { name: "Credit", short: "Credit (est.)", data: ratio, role: "lead", est: firstEst(gapB, "ratio") },
      ],
    }),
  });
}
export function gapPoints() {
  return figure({
    bare: true, file: "india-atlas_credit-gap-points",
    label: "India's credit-to-GDP gap in percentage points since 1961, with the Basel buffer thresholds at 2 and 10 points",
    draw: (width) => K.line({
      width, freq: "quarter", unit: { suffix: " pt" }, endDp: 1, height: width < 520 ? 220 : 260, right: width < 520 ? 84 : 104, inside: false,
      endFormat: (v) => K.num(v, { dp: 1, sign: true, suffix: " pt" }),
      refs: [{ y: 2, label: "Buffer starts, 2 pt" }, { y: 10, label: "Buffer full, 10 pt" }],
      series: [{ name: "Gap", short: "Gap (est.)", data: P(gapB, "gap", GAP_FROM), role: "lead", est: firstEst(gapB, "gap"), area: true }],
    }),
  });
}

/* ---------- § 05 debt service ---------- */
export function dsr() {
  const from = "1999-01-01";
  return figure({
    bare: true, file: "india-atlas_debt-service-ratio",
    label: "Debt service ratio of households and companies, share of income, India, China and the United States, quarterly from 1999",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "United States", short: "United States", data: P(usa, "dsr", from), role: "ctx2" },
        { name: "China", short: "China", data: P(chn, "dsr", from), role: "ctx" },
        { name: "India", short: "India", data: P(dsrB, "private", from), role: "lead" },
      ],
    }),
  });
}

/* ---------- § 06 compared ---------- */
export function peers() {
  // India in full colour, every other economy in each part's tint (the subtitle: "India's bar in blue")
  const parts = [{ name: "Households", color: K.C.lead, tint: K.C.leadTint }, { name: "Companies", color: K.C.ink2, tint: K.C.ctx }, { name: "Government", color: K.C.ctx, tint: K.C.ctx2 }];
  return figure({
    bare: true, file: "india-atlas_debt-compared",
    label: "Debt of households, companies and government as a share of GDP, India and 13 economies, ranked by their sum: " + sumRows.map((r) => `${r.name} ${r.sum.toFixed(0)}%`).join(", "),
    data: { cols: ["Economy", "Households, % of GDP", "Companies, % of GDP", "Government (nominal), % of GDP", "Sum, % of GDP"],
      rows: sumRows.map((r) => [r.name, r.households, r.companies, r.government ?? null, r.noGov ? null : +r.sum.toFixed(1)]) },
    draw: (width) => K.stackBars({
      width, parts, sort: false, dim: true, absolute: { unit: PCT, dp: 0 },
      rows: sumRows.map((r) => ({ name: r.name, parts: [r.households, r.companies, r.government], highlight: r.name === "India", note: r.noGov ? "no government figure" : undefined })),
    }),
  });
}

export function peerGap() {
  return figure({
    bare: true, file: "india-atlas_credit-gap-compared",
    label: "Credit-to-GDP gap in percentage points, India and 13 economies: " + gapRows.map((r) => `${r.name} ${r.credit_gap.toFixed(1)}`).join(", "),
    data: { cols: ["Economy", "Credit gap, points"], rows: gapRows.map((r) => [r.name, r.credit_gap]) },
    draw: (width) => K.bars({
      width, dp: 1, sign: true, unit: { suffix: " pt" },
      rows: gapRows.map((r) => ({ name: r.name, value: r.credit_gap, highlight: r.name === "India" })),
    }),
  });
}

/* ---------- § 07 foreign-currency debt ---------- */
export function gli() {
  return figure({
    bare: true, file: "india-atlas_dollar-credit-to-india",
    label: "US dollar loans and bonds owed by Indian borrowers other than banks, US$ billion, quarterly from 2000, and the bank-loan part of it",
    draw: (width) => K.line({
      width, freq: "quarter", unit: { prefix: "$", suffix: " bn" }, endDp: 1,
      series: [
        { name: "Bank loans only", short: "Bank loans", data: P(gliB, "usd_bank_loans"), role: "ctx" },
        { name: "Loans and bonds", short: "Total", data: P(gliB, "usd"), role: "lead" },
      ],
    }),
  });
}

/* ---------- every number the page quotes, as the old client set it ---------- */
export function numbers() {
  const N = {};
  const tot = last(C.total), hh = last(C.households), co = last(C.companies), gov = last(C.government), gap = last(G.gap), dsrV = last(R.private);
  const sgn1 = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1);
  // title block
  N["m-latest"] = qlab(LQ);
  N["u-reading"] = `BIS, ${qlab(LQ)}`;
  N["n-total"] = fmt.pct1(tot);
  N["d-total"] = `<b>${fmt.pt1(tot - yearAgo(C.total)).replace(/^(?!-)/, "+").replace("-", "−")}</b> on a year ago${estOf(creditB, "total").has(LQ) ? ", BIS estimate" : ""}`;
  const hhM = lastMeasured(C.households, EST);
  N["n-hh"] = fmt.pct1(hhM.value);
  N["d-hh"] = EST.size ? `${qlab(hhM.date)}, the last measured quarter; BIS estimate for ${qlab(LQ)} <b>${fmt.pct1(hh)}</b>` : qlab(hhM.date);
  N["n-gap"] = sgn1(gap) + pc(" pt");
  N["d-gap"] = `${estOf(gapB, "gap").size ? "BIS estimate: " : ""}<b>${fmt.pct1(last(G.ratio))}</b> of GDP against a trend of <b>${fmt.pct1(last(G.trend))}</b>`;
  N["n-dsr"] = fmt.pct1(dsrV);
  N["d-dsr"] = `of income goes on interest and repayments`;
  N["nspark-total"] = K.spark(pairs(creditB, "total", { from: "2005-01-01" }), { width: 190, height: 44 });
  // § 01
  N["rb-total"] = fmt.pct1(tot) + pc(" of GDP");
  N["rb-inr"] = "₹" + Math.round(last(I.total) / 1000) + pc(" lakh crore");
  N["cr-per100"] = `₹${Math.round(tot)}`;
  // § 02
  const coM = lastMeasured(C.companies, EST), peakCo = maxPt(C.companies), pkG = maxPt(C.government);
  N["pv-sectors"] = fmt.pct1(hhM.value);
  N["ex-s-hh"] = fmt.pct1(hhM.value);
  N["ex-s-q"] = qlab(hhM.date);
  N["ex-s-hhe"] = fmt.pct1(hh);
  N["ex-s-coe"] = fmt.pct1(co);
  N["ex-s-hhpk"] = fmt.pct1(Math.max(...C.households.data.filter((d) => d.value != null && !EST.has(d.date)).map((d) => d.value)));
  N["ex-s-hh07"] = fmt.pct1(C.households.data.find((d) => d.value != null).value);
  N["ex-s-co"] = fmt.pct1(coM.value);
  N["ex-s-copk"] = fmt.pct1(peakCo.value);
  N["ex-s-copkq"] = qlab(peakCo.date);
  N["ex-s-gov"] = fmt.pct1(gov);
  N["ex-s-govpk"] = fmt.pct1(pkG.value);
  N["ex-s-govpkq"] = qlab(pkG.date);
  // the long view
  const first = C.private.data.find((d) => d.value != null);
  const pM = lastMeasured(C.private, EST), bM = lastMeasured(C.private_banks, EST);
  N["pv-long"] = fmt.pct1(last(C.private));
  N["ex-l-first"] = fmt.pct1(first.value);
  N["ex-l-now"] = fmt.pct1(last(C.private));
  N["ex-l-banks"] = fmt.pct1(last(C.private_banks));
  N["ex-l-share"] = fmt.pct0((100 * bM.value) / pM.value);
  N["ex-l-q"] = qlab(pM.date);
  // § 03 in rupees
  const h0 = I.households.data.find((d) => d.date >= "2007-01-01" && d.value != null);
  const iM = lastMeasured(I.households, estOf(inrB, "households"));
  N["pv-inr"] = "₹" + Math.round(last(I.households) / 1000) + " lakh crore";
  N["ex-i-hh"] = "₹" + Math.round(iM.value / 1000) + " lakh crore";
  N["ex-i-q"] = qlab(iM.date);
  N["ex-i-hh07"] = "₹" + Math.round(h0.value / 1000) + " lakh crore";
  N["ex-i-x"] = fmt.x1(iM.value / h0.value);
  N["ex-i-tot"] = "₹" + Math.round(last(I.total) / 1000) + " lakh crore";
  // § 04 the credit gap
  const g = G.gap.data.filter((d) => d.value != null);
  const mx = g.reduce((a, d) => (d.value > a.value ? d : a)), mn = g.reduce((a, d) => (d.value < a.value ? d : a));
  let i = g.length - 1; while (i > 0 && g[i - 1].value >= 0) i--;   // the start of the current run at or above zero
  N["pv-gap"] = sgn1(gap) + " pt";
  N["ex-g-gap"] = sgn1(gap) + " points";
  N["ex-g-since"] = qlab(g[i].date);
  N["ex-g-min"] = "−" + Math.abs(mn.value).toFixed(1) + " points";
  N["ex-g-minq"] = qlab(mn.date);
  N["ex-g-max"] = "+" + mx.value.toFixed(1) + " points";
  N["ex-g-maxq"] = qlab(mx.date);
  const Pv = I.private.data, n = Pv.length, Tv = I.total.data;
  N["ex-g-yoy"] = fmt.pct1((Pv[n - 1].value / Pv[n - 5].value - 1) * 100);
  N["ex-g-yoy1"] = fmt.pct1((Pv[n - 5].value / Pv[n - 9].value - 1) * 100);
  N["ex-g-tot"] = fmt.pct1((Tv[n - 1].value / Tv[n - 5].value - 1) * 100);
  const gM = lastMeasured(G.gap, estOf(gapB, "gap"));
  N["ex-g-meas"] = sgn1(gM.value) + " points";
  N["ex-g-measq"] = qlab(gM.date);
  // § 05 debt service
  const from99 = (b) => ({ data: hyd(b).dsr.data.filter((d) => d.date >= "1999-01-01") });
  const US = from99(usa), CN = from99(chn), pk = maxPt(R.private), pl = lastPt(hyd(policyB).policy_rate);
  N["pv-dsr"] = fmt.pct1(dsrV);
  N["ex-d-now"] = fmt.pct1(dsrV);
  N["ex-d-ya"] = fmt.pct1(yearAgo(R.private));
  N["ex-d-pk"] = fmt.pct1(pk.value);
  N["ex-d-pkq"] = qlab(pk.date);
  N["ex-d-cn"] = fmt.pct1(last(CN));
  N["ex-d-us"] = fmt.pct1(last(US));
  N["ex-d-pol"] = fmt.pct2(pl.value);
  N["ex-d-polm"] = `${MLONG[+pl.date.slice(5, 7) - 1]} ${pl.date.slice(0, 4)}`;
  // § 06 compared
  const full = sumRows.filter((r) => !r.noGov), rT = full.findIndex((r) => r.name === "India") + 1, rH = rankOf("households");
  N["pv-peers"] = `${rT} of ${full.length}`;
  N["ex-p-rank"] = `${rT} of ${full.length}`;
  N["ex-p-hhrank"] = `${rH.rank} of ${rH.n}`;
  N["ex-p-cn"] = fmt.pct0(sumRows.find((r) => r.name === "China").sum);
  N["ex-p-us"] = fmt.pct0(sumRows.find((r) => r.name === "United States").sum);
  N["ex-p-in"] = fmt.pct0(sumRows.find((r) => r.name === "India").sum);
  const pos = gapRows.filter((r) => r.credit_gap > 0);
  N["pv-peergap"] = `${pos.length} of ${gapRows.length}`;
  N["ex-pg-n"] = String(pos.length);
  N["ex-pg-of"] = String(gapRows.length);
  N["ex-pg-list"] = pos.map((r) => r.name).join(", ");
  // § 07 foreign currency: rupee value = dollars x the quarter's average rupee rate (BIS WS_XRU)
  const X = hyd(xruB).average, usd = L.usd, pkU = maxPt(usd);
  const rate = X.data.find((d) => d.date === LQ)?.value ?? null, r0 = X.data.find((d) => d.date === "2016-01-01")?.value;
  N["pv-gli"] = "$" + last(usd).toFixed(1) + " bn";
  N["ex-f-usd"] = "$" + last(usd).toFixed(1) + " billion";
  N["ex-f-pk"] = "$" + pkU.value.toFixed(1) + " billion";
  N["ex-f-pkq"] = qlab(pkU.date);
  N["ex-f-rate"] = "₹" + rate.toFixed(2);
  N["ex-f-inr"] = "₹" + ((last(usd) * rate) / 1000).toFixed(1) + " lakh crore";
  N["ex-f-yoy"] = fmt.pct1Minus(last(L.usd_yoy));
  N["ex-f-eur"] = "€" + last(L.eur).toFixed(1) + " billion";
  N["ex-f-jpy"] = "¥" + Math.round(last(L.jpy)).toLocaleString("en-IN") + " billion";
  N["ex-f-r16"] = "₹" + r0.toFixed(2);
  // provenance
  N["prov-vintage"] = creditB.meta.vintage;
  N["prov-vintage2"] = creditB.meta.vintage;
  return N;
}
