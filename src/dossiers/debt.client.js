// Guide 15, how much India owes: plates and number wiring.
// Data: data/series/bis-*.json, baked by scripts/lib/products/bis.mjs from the Bank for
// International Settlements' statistics (via the owner's Data Bank). Quarterly, calendar quarters
// dated at their first month (2026-01-01 = January to March 2026). Credit is loans and debt
// securities from every lender; % of GDP uses BIS's four-quarter GDP. Peers: one bundle each.

import * as Plot from "@observablehq/plot";
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
import { MONO as sans, hydrate, a11y, addCrosshair, spark, wireTools, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

const C = hydrate(creditB), G = hydrate(gapB), R = hydrate(dsrB), L = hydrate(gliB);
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const lastPt = (s) => s.data.filter((d) => d.value != null).at(-1);
const last = (s) => lastPt(s).value;
const valAt = (s, iso) => s.data.find((d) => d.date.toISOString().slice(0, 10) === iso)?.value ?? null;
const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const qlab = (d) => { const iso = d instanceof Date ? d.toISOString() : d; const m = +iso.slice(5, 7) - 1; return `${M3[m]} to ${M3[m + 2]} ${iso.slice(0, 4)}`; };
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yr = (y) => new Date(Date.UTC(y, 0, 1));
const xYears = (ys) => ({ label: null, tickSize: 0, tickPadding: 10, ticks: ys.map(yr), tickFormat: (d) => String(d.getUTCFullYear()) });
const LQ = creditB.dates.at(-1);
const pctV = (v) => (v == null ? "—" : v.toFixed(1) + "%");

/* BIS extrapolates India's latest credit quarters (series.estimated; CONTRACT-series 2b): after the
 * last quarter of the RBI's financial accounts it scales private credit with bank credit and freezes
 * the household/company split. Estimated stretches are drawn as a pale dashed tail, labelled "est.",
 * and every claim about households or companies uses the last measured quarter. */
const iso = (d) => d.toISOString().slice(0, 10);
const estOf = (b, k) => new Set(b.series[k]?.estimated ?? []);
const lastMeasured = (s, set) => s.data.filter((d) => d.value != null && !set.has(iso(d.date))).at(-1);
const TINT = { [ACC]: "#AFBBF0", [G1]: "#B5BAC4", [G2]: "#D5D9E0" };
function linesWithEst(data, set, c, w, extra = {}) {
  const m = data.map((d) => (set.has(iso(d.date)) ? { ...d, value: null } : d));
  const f = data.findIndex((d) => set.has(iso(d.date)));
  const e = f < 0 ? [] : data.slice(Math.max(0, f - 1));
  return [Plot.lineY(m, { x: "date", y: "value", stroke: c, strokeWidth: w, strokeLinejoin: "round", strokeLinecap: "round", ...extra }),
    ...(e.length ? [Plot.lineY(e, { x: "date", y: "value", stroke: TINT[c] ?? c, strokeWidth: w, strokeDasharray: "3 3" })] : [])];
}
const EST = estOf(creditB, "households");
const isEst = (d) => EST.has(iso(d.date));

/* peers, one bundle each (CONTRACT-series rule 8) */
const PEERS = [["United States", usa], ["China", chn], ["Euro area", emu], ["United Kingdom", gbr], ["Japan", jpn], ["Korea", kor], ["Indonesia", idn],
  ["Brazil", bra], ["South Africa", zaf], ["Mexico", mex], ["Türkiye", tur], ["Australia", aus], ["Canada", can]];
const lastOf = (b, k) => { const s = b.series[k]; if (!s) return null; for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return { v: s.data[i], d: b.dates[i] }; return null; };
const INDIA = { name: "India", households: last(C.households), companies: last(C.companies), government: last(C.government), total: last(C.total), private: last(C.private), credit_gap: last(G.gap), dsr: last(R.private) };
const peerRows = [INDIA, ...PEERS.map(([name, b]) => ({ name, ...Object.fromEntries(["households", "companies", "government", "total", "private", "credit_gap", "dsr"].map((k) => [k, lastOf(b, k)?.v ?? null])) }))];
const rankOf = (k, desc = true) => { const xs = peerRows.filter((r) => r[k] != null).sort((a, b) => (desc ? b[k] - a[k] : a[k] - b[k])); return { rank: xs.findIndex((r) => r.name === "India") + 1, n: xs.length }; };

/* ---------- title block ---------- */
const tot = last(C.total), hh = last(C.households), co = last(C.companies), gov = last(C.government), gap = last(G.gap), dsr = last(R.private);
const yearAgo = (s) => s.data[s.data.length - 5]?.value;
setHTML("m-latest", qlab(LQ));
setHTML("u-reading", `BIS, ${qlab(LQ)}`);
setHTML("n-total", fmt.pct1(tot));
setHTML("d-total", `<b>${fmt.pt1(tot - yearAgo(C.total)).replace(/^(?!-)/, "+").replace("-", "−")}</b> on a year ago${estOf(creditB, "total").has(LQ) ? ", BIS estimate" : ""}`);
const hhM = lastMeasured(C.households, EST);
setHTML("n-hh", fmt.pct1(hhM.value));
setHTML("d-hh", EST.size ? `${qlab(hhM.date)}, the last measured quarter; BIS estimate for ${qlab(LQ)} <b>${fmt.pct1(hh)}</b>` : qlab(hhM.date));
setHTML("n-gap", (gap >= 0 ? "+" : "−") + Math.abs(gap).toFixed(1) + pc(" pt"));
setHTML("d-gap", `${estOf(gapB, "gap").size ? "BIS estimate: " : ""}<b>${fmt.pct1(last(G.ratio))}</b> of GDP against a trend of <b>${fmt.pct1(last(G.trend))}</b>`);
setHTML("n-dsr", fmt.pct1(dsr));
setHTML("d-dsr", `of income goes on interest and repayments`);
spark("nspark-total", { ...C.total, data: C.total.data.filter((d) => d.date >= yr(2005)), color: ACC });

/* ---------- § 01 ---------- */
setHTML("rb-total", fmt.pct1(tot) + pc(" of GDP"));
setHTML("rb-inr", "₹" + Math.round(last(hydrate(inrB).total) / 1000) + pc(" lakh crore"));
setHTML("cr-per100", `₹${Math.round(tot)}`);

/* ---------- § 02 who owes ---------- */
{
  const KEYS = [["households", ACC, "Households", 2], ["companies", G1, "Companies", 1.5], ["government", G2, "Government", 1.5]];
  const from = yr(1981);
  const marks = [Plot.gridY([25, 50, 75, 100], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [k, c, , w] of KEYS) marks.push(...linesWithEst(C[k].data.filter((d) => d.date >= from), estOf(creditB, k), c, w));
  for (const [k, c, name] of KEYS) {
    const e = lastPt(C[k]), est = estOf(creditB, k).has(iso(e.date));
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: est ? "#fff" : c, stroke: c, r: 3, strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ${d.value.toFixed(1)}%${est ? " est." : ""}`, dx: 10, dy: k === "companies" ? 4 : 0, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: k === "households" ? 600 : 400 }));
  }
  marks.push(Plot.text([{ x: yr(2007), y: 22 }], { x: "x", y: "y", text: () => "Households and companies are measured from 2007", textAnchor: "start", fill: MUTED, fontSize: 11.5 }));
  const plot = Plot.plot({ width: W, height: 440, marginLeft: 44, marginRight: 195, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([1981, 1990, 2000, 2010, 2020, 2026]),
    y: { label: "% of GDP", labelAnchor: "top", labelArrow: false, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickSize: 0, tickPadding: 10 }, marks });
  a11y(plot, "Debt of India's households, companies and government, % of GDP", `In ${qlab(LQ)} households owed ${fmt.pct1(hh)} of GDP, companies ${fmt.pct1(co)} and government ${fmt.pct1(gov)}.`);
  document.getElementById("plot-sectors").append(plot);
  const series = KEYS.map(([k, c, name]) => ({ ...C[k], label: name, color: c, data: C[k].data.filter((d) => d.date >= from) }));
  addCrosshair(document.getElementById("plot-sectors"), plot, series, null, qlab, pctV);
  wireTools(document.getElementById("cb-sectors"), plot, series, "india-atlas_debt-by-borrower");
  const peakCo = C.companies.data.reduce((a, d) => (d.value != null && d.value > a.value ? d : a), { value: -1 });
  const coM = lastMeasured(C.companies, EST);
  setHTML("pv-sectors", fmt.pct1(hhM.value));
  setHTML("ex-s-hh", fmt.pct1(hhM.value));
  setHTML("ex-s-q", qlab(hhM.date));
  setHTML("ex-s-hhe", fmt.pct1(hh));
  setHTML("ex-s-coe", fmt.pct1(co));
  setHTML("ex-s-hhpk", fmt.pct1(Math.max(...C.households.data.filter((d) => d.value != null && !isEst(d)).map((d) => d.value))));
  setHTML("ex-s-hh07", fmt.pct1(C.households.data.find((d) => d.value != null).value));
  setHTML("ex-s-co", fmt.pct1(coM.value));
  setHTML("ex-s-copk", fmt.pct1(peakCo.value));
  setHTML("ex-s-copkq", qlab(peakCo.date));
  setHTML("ex-s-gov", fmt.pct1(gov));
  const pkG = C.government.data.reduce((a, d) => (d.value != null && d.value > a.value ? d : a), { value: -1 });
  setHTML("ex-s-govpk", fmt.pct1(pkG.value));
  setHTML("ex-s-govpkq", qlab(pkG.date));
}

/* ---------- § 03 the long view, and who lends ---------- */
{
  const KEYS = [["private", ACC, "All lenders", 2], ["private_banks", G2, "Banks only", 1.5]];
  const marks = [Plot.gridY([25, 50, 75, 100, 125], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [k, c, , w] of KEYS) marks.push(...linesWithEst(C[k].data, estOf(creditB, k), c, w));
  for (const [k, c, name] of KEYS) {
    const e = lastPt(C[k]), est = estOf(creditB, k).has(iso(e.date));
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: est ? "#fff" : c, stroke: c, r: 3, strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ${d.value.toFixed(1)}%${est ? " est." : ""}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: k === "private" ? 600 : 400 }));
  }
  const plot = Plot.plot({ width: W, height: 420, marginLeft: 44, marginRight: 200, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([1951, 1960, 1970, 1980, 1990, 2000, 2010, 2026]),
    y: { label: "% of GDP", labelAnchor: "top", labelArrow: false, domain: [0, 125], ticks: [0, 25, 50, 75, 100, 125], tickSize: 0, tickPadding: 10 }, marks });
  const first = C.private.data.find((d) => d.value != null);
  a11y(plot, "Credit to India's households and companies since 1951, % of GDP", `From ${fmt.pct1(first.value)} of GDP in ${qlab(first.date)} to ${fmt.pct1(last(C.private))} in ${qlab(LQ)}; banks lent ${fmt.pct1(last(C.private_banks))}.`);
  document.getElementById("plot-long").append(plot);
  const series = KEYS.map(([k, c, name]) => ({ ...C[k], label: name, color: c }));
  addCrosshair(document.getElementById("plot-long"), plot, series, null, qlab, pctV);
  wireTools(document.getElementById("cb-long"), plot, series, "india-atlas_private-credit-since-1951");
  setHTML("pv-long", fmt.pct1(last(C.private)));
  setHTML("ex-l-first", fmt.pct1(first.value));
  setHTML("ex-l-now", fmt.pct1(last(C.private)));
  setHTML("ex-l-banks", fmt.pct1(last(C.private_banks)));
  const pM = lastMeasured(C.private, EST), bM = lastMeasured(C.private_banks, EST);
  setHTML("ex-l-share", fmt.pct0((100 * bM.value) / pM.value));
  setHTML("ex-l-q", qlab(pM.date));
}

/* ---------- § 04 in rupees ---------- */
{
  const I = hydrate(inrB);
  const KEYS = [["government", G2, "Government"], ["companies", G1, "Companies"], ["households", ACC, "Households"]];
  const toLC = (s) => ({ ...s, data: s.data.filter((d) => d.date >= yr(2007)).map((d) => ({ ...d, value: d.value == null ? null : d.value / 1000 })) });
  const marks = [Plot.gridY([100, 200, 300], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [k, c] of KEYS) marks.push(...linesWithEst(toLC(I[k]).data, estOf(inrB, k), c, k === "households" ? 2 : 1.5));
  for (const [k, c, name] of KEYS) {
    const e = lastPt(toLC(I[k])), est = estOf(inrB, k).has(iso(e.date));
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: est ? "#fff" : c, stroke: c, r: 3, strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ₹${Math.round(d.value)} lakh cr${est ? " est." : ""}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: k === "households" ? 600 : 400 }));
  }
  const plot = Plot.plot({ width: W, height: 400, marginLeft: 44, marginRight: 260, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([2007, 2010, 2014, 2018, 2022, 2026]),
    y: { label: "₹ lakh crore", labelAnchor: "top", labelArrow: false, domain: [0, 300], ticks: [0, 100, 200, 300], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) }, marks });
  const h0 = I.households.data.find((d) => d.date >= yr(2007) && d.value != null);
  a11y(plot, "Debt of India's households, companies and government, ₹ lakh crore", `Households owed ₹${Math.round(last(I.households) / 1000)} lakh crore in ${qlab(LQ)}, against ₹${Math.round(h0.value / 1000)} lakh crore in ${qlab(h0.date)}.`);
  document.getElementById("plot-inr").append(plot);
  const series = KEYS.map(([k, c, name]) => ({ ...toLC(I[k]), label: name, color: c }));
  addCrosshair(document.getElementById("plot-inr"), plot, series, null, qlab, (v) => (v == null ? "—" : "₹" + Math.round(v) + " lakh cr"));
  wireTools(document.getElementById("cb-inr"), plot, series, "india-atlas_debt-in-rupees");
  setHTML("pv-inr", "₹" + Math.round(last(I.households) / 1000) + " lakh crore");
  const iM = lastMeasured(I.households, estOf(inrB, "households"));
  setHTML("ex-i-hh", "₹" + Math.round(iM.value / 1000) + " lakh crore");
  setHTML("ex-i-q", qlab(iM.date));
  setHTML("ex-i-hh07", "₹" + Math.round(h0.value / 1000) + " lakh crore");
  setHTML("ex-i-x", fmt.x1(iM.value / h0.value));
  setHTML("ex-i-tot", "₹" + Math.round(last(I.total) / 1000) + " lakh crore");
}

/* ---------- § 05 the credit gap ---------- */
{
  const g = G.gap.data.filter((d) => d.value != null);
  const top = Plot.plot({ width: W, height: 300, marginLeft: 44, marginRight: 150, marginTop: 30, marginBottom: 26, style: baseStyle,
    x: xYears([1961, 1970, 1980, 1990, 2000, 2010, 2020, 2026]),
    y: { label: "% of GDP", labelAnchor: "top", labelArrow: false, domain: [0, 125], ticks: [0, 25, 50, 75, 100, 125], tickSize: 0, tickPadding: 10 },
    marks: [Plot.gridY([25, 50, 75, 100, 125], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(G.trend.data.filter((d) => d.date >= yr(1961)), { x: "date", y: "value", stroke: G2, strokeWidth: 1.5, strokeDasharray: "4 3" }),
      ...linesWithEst(G.ratio.data.filter((d) => d.date >= yr(1961)), estOf(gapB, "ratio"), ACC, 2),
      Plot.text([lastPt(G.ratio)], { x: "date", y: "value", text: (d) => `Credit ${d.value.toFixed(1)}%`, dx: 10, dy: -8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
      Plot.text([lastPt(G.trend)], { x: "date", y: "value", text: (d) => `Trend ${d.value.toFixed(1)}%`, dx: 10, dy: 9, textAnchor: "start", fill: INK, fontSize: 12.5 })] });
  const bottom = Plot.plot({ width: W, height: 240, marginLeft: 44, marginRight: 150, marginTop: 24, marginBottom: 34, style: baseStyle,
    x: xYears([1961, 1970, 1980, 1990, 2000, 2010, 2020, 2026]),
    y: { label: "gap, points", labelAnchor: "top", labelArrow: false, domain: [-25, 25], ticks: [-20, -10, 0, 10, 20], tickSize: 0, tickPadding: 10, tickFormat: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) },
    marks: [Plot.gridY([-20, -10, 10, 20], { stroke: GRID }),
      Plot.rectY(g, { x1: (d) => new Date(+d.date - 30 * 864e5), x2: (d) => new Date(+d.date + 30 * 864e5), y1: 0, y2: "value", fill: (d) => (estOf(gapB, "gap").has(iso(d.date)) ? (d.value >= 0 ? "#AFBBF0" : "#E3E6EB") : d.value >= 0 ? ACC : G3) }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleY([2, 10], { stroke: GOLD, strokeDasharray: "3 3" }),
      Plot.text([{ x: yr(2026), y: 2 }], { x: "x", y: "y", text: () => "2 pt: buffer starts", dx: 10, dy: 6, textAnchor: "start", fill: MUTED, fontSize: 11.5 }),
      Plot.text([{ x: yr(2026), y: 10 }], { x: "x", y: "y", text: () => "10 pt: buffer full", dx: 10, dy: -6, textAnchor: "start", fill: MUTED, fontSize: 11.5 })] });
  a11y(top, "India's private credit-to-GDP ratio and its long-run trend", `In ${qlab(LQ)} credit was ${fmt.pct1(last(G.ratio))} of GDP against a trend of ${fmt.pct1(last(G.trend))}.`);
  a11y(bottom, "India's credit-to-GDP gap, percentage points", `The gap was ${last(G.gap).toFixed(1)} points in ${qlab(LQ)}.`);
  const zone = document.getElementById("plot-gap");
  zone.append(top); zone.append(bottom);
  addCrosshair(zone, top, [{ ...G.ratio, label: "Credit", color: ACC }, { ...G.trend, label: "Trend", color: G2 }, { ...G.gap, label: "Gap (points)", color: G1 }], null, qlab, (v) => (v == null ? "—" : v.toFixed(1)));
  // downloads carry both panels: one SVG with the gap panel stacked under the ratio panel
  const both = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const th = +top.getAttribute("height"), bh = +bottom.getAttribute("height");
  both.setAttribute("width", W); both.setAttribute("height", th + bh); both.setAttribute("viewBox", `0 0 ${W} ${th + bh}`);
  for (const [svg, y] of [[top, 0], [bottom, th]]) { const c = svg.cloneNode(true); c.setAttribute("y", y); c.setAttribute("x", 0); both.append(c); }
  wireTools(document.getElementById("cb-gap"), both, [{ ...G.ratio, name: "ratio_pct_gdp" }, { ...G.trend, name: "trend_pct_gdp" }, { ...G.gap, name: "gap_pt" }], "india-atlas_credit-gap");
  const mx = g.reduce((a, d) => (d.value > a.value ? d : a)), mn = g.reduce((a, d) => (d.value < a.value ? d : a));
  // when did the gap last sit at or above zero before the current run?
  let i = g.length - 1; while (i > 0 && g[i - 1].value >= 0) i--;
  setHTML("pv-gap", (gap >= 0 ? "+" : "−") + Math.abs(gap).toFixed(1) + " pt");
  setHTML("ex-g-gap", (gap >= 0 ? "+" : "−") + Math.abs(gap).toFixed(1) + " points");
  setHTML("ex-g-since", qlab(g[i].date));
  setHTML("ex-g-min", "−" + Math.abs(mn.value).toFixed(1) + " points");
  setHTML("ex-g-minq", qlab(mn.date));
  setHTML("ex-g-max", "+" + mx.value.toFixed(1) + " points");
  setHTML("ex-g-maxq", qlab(mx.date));
  const P = hydrate(inrB).private.data, n = P.length;
  setHTML("ex-g-yoy", fmt.pct1((P[n - 1].value / P[n - 5].value - 1) * 100));
  setHTML("ex-g-yoy1", fmt.pct1((P[n - 5].value / P[n - 9].value - 1) * 100));
  const T = hydrate(inrB).total.data;
  setHTML("ex-g-tot", fmt.pct1((T[n - 1].value / T[n - 5].value - 1) * 100));
  const gM = lastMeasured(G.gap, estOf(gapB, "gap"));
  setHTML("ex-g-meas", (gM.value >= 0 ? "+" : "−") + Math.abs(gM.value).toFixed(1) + " points");
  setHTML("ex-g-measq", qlab(gM.date));
}

/* ---------- § 06 debt service ---------- */
{
  // peer bundles run on their own axes (the US from 1947): clip every line to the DSR era
  const from99 = (s) => ({ ...s, data: s.data.filter((d) => d.date >= yr(1999)) });
  const US = from99(hydrate(usa).dsr), CN = from99(hydrate(chn).dsr);
  const pol = hydrate(policyB).policy_rate;
  const KEYS = [[R.private, ACC, "India", 2], [CN, GOLD, "China", 1.5], [US, G2, "United States", 1.5]];
  const marks = [Plot.gridY([5, 10, 15, 20], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [s, c, , w] of KEYS) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: c, strokeWidth: w, strokeLinejoin: "round" }));
  for (const [s, c, name] of KEYS) {
    const e = lastPt(s);
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ${d.value.toFixed(1)}%`, dx: 10, dy: name === "United States" ? 6 : name === "China" ? -4 : 0, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: name === "India" ? 600 : 400 }));
  }
  const plot = Plot.plot({ width: W, height: 400, marginLeft: 44, marginRight: 170, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([1999, 2004, 2008, 2012, 2016, 2020, 2026]),
    y: { label: "% of income", labelAnchor: "top", labelArrow: false, domain: [0, 25], ticks: [0, 5, 10, 15, 20, 25], tickSize: 0, tickPadding: 10 }, marks });
  a11y(plot, "Debt service ratio: India, China and the United States", `India's households and companies spent ${fmt.pct1(dsr)} of income on interest and repayments in ${qlab(LQ)}.`);
  document.getElementById("plot-dsr").append(plot);
  const series = KEYS.map(([s, c, name]) => ({ ...s, label: name, color: c }));
  addCrosshair(document.getElementById("plot-dsr"), plot, series, null, qlab, pctV);
  wireTools(document.getElementById("cb-dsr"), plot, series, "india-atlas_debt-service-ratio");
  const pk = R.private.data.reduce((a, d) => (d.value != null && d.value > a.value ? d : a), { value: -1 });
  setHTML("pv-dsr", fmt.pct1(dsr));
  setHTML("ex-d-now", fmt.pct1(dsr));
  setHTML("ex-d-ya", fmt.pct1(yearAgo(R.private)));
  setHTML("ex-d-pk", fmt.pct1(pk.value));
  setHTML("ex-d-pkq", qlab(pk.date));
  setHTML("ex-d-cn", fmt.pct1(last(CN)));
  setHTML("ex-d-us", fmt.pct1(last(US)));
  const pl = lastPt(pol);
  setHTML("ex-d-pol", fmt.pct2(pl.value));
  setHTML("ex-d-polm", `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][pl.date.getUTCMonth()]} ${pl.date.getUTCFullYear()}`);
}

/* ---------- § 07 compared with other economies ----------
 * Bars are the three borrowers stacked; the label is their sum (BIS's own "total" values
 * government at market prices in some economies, so it does not always equal the parts).
 * Korea has no government debt at nominal value in BIS: drawn without it and marked. */
{
  const rows = peerRows.filter((r) => r.households != null && r.companies != null)
    .map((r) => ({ ...r, sum: r.households + r.companies + (r.government ?? 0), noGov: r.government == null }))
    .sort((a, b) => b.sum - a.sum);
  const parts = [["households", "Households", ACC, "#AAB8F2"], ["companies", "Companies", G1, "#C9CED6"], ["government", "Government", G2, "#E3E6EB"]];
  const stack = rows.flatMap((r) => parts.filter(([k]) => r[k] != null).map(([k, name]) => ({ name: r.name, part: name, v: r[k], india: r.name === "India" })));
  const plot = Plot.plot({ width: W, height: 44 + rows.length * 32, marginLeft: 140, marginRight: 200, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "% of GDP", labelAnchor: "right", labelArrow: false, domain: [0, 400], ticks: [0, 100, 200, 300, 400], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [Plot.gridX([100, 200, 300, 400], { stroke: GRID }),
      Plot.barX(stack, Plot.stackX({ y: "name", x: "v", fill: (d) => { const p = parts.find((q) => q[1] === d.part); return d.india ? p[2] : p[3]; }, order: parts.map((p) => p[1]), insetTop: 7, insetBottom: 7 })),
      Plot.text(rows, { y: "name", x: "sum", text: (d) => d.sum.toFixed(0) + "%" + (d.noGov ? ", no government figure" : ""), dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.name === "India" ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE })] });
  a11y(plot, "Debt by borrower, India and 13 economies, % of GDP", rows.map((r) => `${r.name} ${r.sum.toFixed(0)}%`).join(", "));
  document.getElementById("plot-peers").append(plot);
  const csv = "economy,households_pct_gdp,companies_pct_gdp,government_nominal_pct_gdp,sum_pct_gdp\n" + rows.map((r) => [r.name, r.households, r.companies, r.government ?? "", r.noGov ? "" : r.sum.toFixed(1)].join(",")).join("\n");
  const el = document.getElementById("cb-peers");
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim() };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, "india-atlas_debt-compared", meta);
    if (b.dataset.dl === "png") downloadPNG(plot, "india-atlas_debt-compared", meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), "india-atlas_debt-compared.csv");
  }));
  const full = rows.filter((r) => !r.noGov);
  const rT = full.findIndex((r) => r.name === "India") + 1;
  const rH = rankOf("households");
  setHTML("pv-peers", `${rT} of ${full.length}`);
  setHTML("ex-p-rank", `${rT} of ${full.length}`);
  setHTML("ex-p-hhrank", `${rH.rank} of ${rH.n}`);
  setHTML("ex-p-cn", fmt.pct0(rows.find((r) => r.name === "China").sum));
  setHTML("ex-p-us", fmt.pct0(rows.find((r) => r.name === "United States").sum));
  setHTML("ex-p-in", fmt.pct0(rows.find((r) => r.name === "India").sum));
}

/* ---------- § 07b the credit gap compared ---------- */
{
  const rows = peerRows.filter((r) => r.credit_gap != null).sort((a, b) => b.credit_gap - a.credit_gap);
  const plot = Plot.plot({ width: W, height: 44 + rows.length * 30, marginLeft: 140, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "gap, points", labelAnchor: "right", labelArrow: false, domain: [-30, 15], ticks: [-30, -20, -10, 0, 10], tickSize: 0, tickPadding: 8, tickFormat: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [Plot.gridX([-30, -20, -10, 10], { stroke: GRID }),
      Plot.barX(rows, { y: "name", x1: 0, x2: "credit_gap", fill: (d) => (d.name === "India" ? ACC : G3), insetTop: 7, insetBottom: 7 }),
      Plot.text(rows.filter((r) => r.credit_gap >= 0), { y: "name", x: "credit_gap", text: (d) => "+" + d.credit_gap.toFixed(1), dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.name === "India" ? 600 : 400) }),
      Plot.text(rows.filter((r) => r.credit_gap < 0), { y: "name", x: "credit_gap", text: (d) => "−" + Math.abs(d.credit_gap).toFixed(1), dx: -8, textAnchor: "end", fill: INK, fontSize: 12.5 }),
      Plot.ruleX([0], { stroke: BASE })] });
  a11y(plot, "Credit-to-GDP gap, India and 13 economies", rows.map((r) => `${r.name} ${r.credit_gap.toFixed(1)}`).join(", "));
  document.getElementById("plot-peergap").append(plot);
  const csv = "economy,credit_gap_pt\n" + rows.map((r) => `${r.name},${r.credit_gap}`).join("\n");
  const el = document.getElementById("cb-peergap");
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim() };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, "india-atlas_credit-gap-compared", meta);
    if (b.dataset.dl === "png") downloadPNG(plot, "india-atlas_credit-gap-compared", meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), "india-atlas_credit-gap-compared.csv");
  }));
  const pos = rows.filter((r) => r.credit_gap > 0);
  setHTML("pv-peergap", `${pos.length} of ${rows.length}`);
  setHTML("ex-pg-n", String(pos.length));
  setHTML("ex-pg-of", String(rows.length));
  setHTML("ex-pg-list", pos.map((r) => r.name).join(", "));
}

/* ---------- § 08 foreign-currency debt ---------- */
{
  const X = hydrate(xruB).average;
  const usd = L.usd, loans = L.usd_bank_loans;
  const KEYS = [[usd, ACC, "Loans and bonds", 2], [loans, G2, "Bank loans only", 1.5]];
  const marks = [Plot.gridY([50, 100, 150], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [s, c, , w] of KEYS) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: c, strokeWidth: w, strokeLinejoin: "round" }));
  for (const [s, c, name] of KEYS) {
    const e = lastPt(s);
    marks.push(Plot.dot([e], { x: "date", y: "value", fill: c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    marks.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} $${d.value.toFixed(1)} bn`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: name.startsWith("Loans") ? 600 : 400 }));
  }
  const plot = Plot.plot({ width: W, height: 400, marginLeft: 44, marginRight: 220, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: xYears([2000, 2005, 2010, 2015, 2020, 2026]),
    y: { label: "US$ billion", labelAnchor: "top", labelArrow: false, domain: [0, 150], ticks: [0, 50, 100, 150], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) }, marks });
  a11y(plot, "US dollar credit to Indian borrowers outside banks", `$${last(usd).toFixed(1)} billion in ${qlab(LQ)}, of which bank loans $${last(loans).toFixed(1)} billion.`);
  document.getElementById("plot-gli").append(plot);
  const series = KEYS.map(([s, c, name]) => ({ ...s, label: name, color: c }));
  addCrosshair(document.getElementById("plot-gli"), plot, series, null, qlab, (v) => (v == null ? "—" : "$" + v.toFixed(1) + " bn"));
  wireTools(document.getElementById("cb-gli"), plot, series, "india-atlas_dollar-credit-to-india");
  const pk = usd.data.reduce((a, d) => (d.value != null && d.value > a.value ? d : a), { value: -1 });
  // rupee value: dollars x the quarter's average rupee rate (BIS WS_XRU), a derived figure
  const rate = valAt(X, LQ), r0 = X.data.find((d) => d.date.toISOString().slice(0, 10) === "2016-01-01")?.value;
  setHTML("pv-gli", "$" + last(usd).toFixed(1) + " bn");
  setHTML("ex-f-usd", "$" + last(usd).toFixed(1) + " billion");
  setHTML("ex-f-pk", "$" + pk.value.toFixed(1) + " billion");
  setHTML("ex-f-pkq", qlab(pk.date));
  setHTML("ex-f-rate", "₹" + rate.toFixed(2));
  setHTML("ex-f-inr", "₹" + ((last(usd) * rate) / 1000).toFixed(1) + " lakh crore");
  setHTML("ex-f-yoy", fmt.pct1Minus(last(L.usd_yoy)));
  setHTML("ex-f-eur", "€" + last(L.eur).toFixed(1) + " billion");
  setHTML("ex-f-jpy", "¥" + Math.round(last(L.jpy)).toLocaleString("en-IN") + " billion");
  setHTML("ex-f-r16", "₹" + r0.toFixed(2));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", creditB.meta.vintage);
setHTML("prov-vintage2", creditB.meta.vintage);
