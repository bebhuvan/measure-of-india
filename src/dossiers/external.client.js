// Guide 05, the external account: plates and number wiring.
// Data: data/series/external-*.json, baked by scripts/lib/products/external-{bop,flows,reer}.mjs
// from RBI DBIE (through the owner's Data Bank mirror). Amounts arrive in US$ million (₹ crore
// where named) and the page speaks in US$ billion; indices and rates as published.
// Seams kept apart: RBI's overall-BoP layout is the only BoP drawn here (the BPM6 table is
// downloadable, never mixed in); the REER is drawn on its current 2015-16 base only.

import * as Plot from "@observablehq/plot";
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
import { MONO as sans, hydrate, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, dodgeEndLabels, troughOf, peakOf, fmt } from "../charts/plumbing.js";

const ACC = "#2E4BD8", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const bn = (v) => fmt.bnFixed1(v / 1000);             // US$ million -> "−$4.2 bn"
const bnR = (v) => fmt.bnRound(v / 1000);             // "$748 bn"
const iso = (d) => d.toISOString().slice(0, 10);
const dOf = (s) => new Date(s + "T00:00:00Z");
// a fiscal quarter's months, from its first month: 2026-04-01 -> "Apr to Jun 2026"
const qLabel = (d) => { const m = d.getUTCMonth(); return `${MS[m]} to ${MS[m + 2]} ${d.getUTCFullYear()}`; };
const qLong = (d) => { const m = d.getUTCMonth(); return `${MF[m]} to ${MF[m + 2]} ${d.getUTCFullYear()}`; };
const fyLabel = (d) => { const y = d.getUTCFullYear(); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const monLabel = (d) => `${MS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const dayLabel = (d) => `${d.getUTCDate()} ${MS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const lastPt = (s) => { for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i].value != null) return s.data[i]; return null; };
const atDate = (s, dateIso) => s.data.find((d) => iso(d.date) === dateIso)?.value ?? null;
const scaled = (s, k = 1 / 1000, label, color) => ({ ...s, label: label ?? s.label, color: color ?? s.color, data: s.data.map((d) => ({ date: d.date, value: d.value == null ? null : d.value * k })) });
const since = (s, from) => ({ ...s, data: s.data.filter((d) => d.date >= dOf(from)) });
const yearTicks = (a, b, step) => { const t = []; for (let y = a; y <= b; y += step) t.push(new Date(Date.UTC(y, 0, 1))); return t; };
const yTickFmt = (d) => String(d.getUTCFullYear());
const sum = (xs) => xs.reduce((a, x) => a + x, 0);

const B = hydrate(bopB), G = hydrate(grossB), IND = hydrate(indB), AN = hydrate(annB), PPL = hydrate(pplB), IIP = hydrate(iipB);
const RW = hydrate(resWB), RM = hydrate(resMB), IV = hydrate(intB), FB = hydrate(fbB), RU = hydrate(rupB), RE = hydrate(reerB);
const FD = hydrate(fdiB), FP = hydrate(fpiB), LR = hydrate(lrsB), DA = hydrate(debtB), DS = hydrate(sectB), NR = hydrate(nriB), INV = hydrate(invB);

/* ---------- shared plate wiring ---------- */
function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  if (!el) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg" && plot) downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png" && plot) downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
const csvOf = (seriesList, fmtDate = (d) => iso(d)) => {
  const keys = [...new Set(seriesList.flatMap((s) => s.data.map((d) => iso(d.date))))].sort();
  const maps = seriesList.map((s) => new Map(s.data.map((d) => [iso(d.date), d.value])));
  const esc = (t) => (/[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  return [["period", ...seriesList.map((s) => esc(s.label))].join(","), ...keys.map((k) => [fmtDate(dOf(k)), ...maps.map((m) => m.get(k) ?? "")].join(","))].join("\n");
};
const mount = (id, plot) => { const el = document.getElementById(id); if (el) el.append(plot); return plot; };

/* A multi-line plate with end labels: the first series is the lead (accent, heavier). */
function lines(plotId, figId, list, { d0, d1, yTicks, xTicks, xFmt = yTickFmt, yLabel, valFmt, tipDate, file, title, desc, H = 470, mr = 230, zero = true, extra = [] }) {
  const live = list.filter((s) => lastPt(s));
  const dodged = dodgeEndLabels(live, (d1 - d0) * 0.06);
  const plot = Plot.plot({
    width: W, height: H, marginLeft: 56, marginRight: mr, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: xTicks, tickFormat: xFmt },
    y: { label: yLabel, labelAnchor: "top", labelArrow: false, domain: [d0, d1], ticks: yTicks, tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(yTicks, { stroke: GRID }),
      zero ? Plot.ruleY([0], { stroke: d0 < 0 ? INK : BASE, strokeOpacity: d0 < 0 ? 0.5 : 1 }) : null,
      ...extra,
      ...list.slice().reverse().map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s === list[0] ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...live.map((s) => Plot.dot([lastPt(s)], { x: "date", y: "value", fill: s.color, r: s === list[0] ? 3.5 : 3, stroke: "#fff", strokeWidth: 1.5 })),
      ...dodged.map((p) => Plot.text([{ date: lastPt(p.s).date, y: p.y }], { x: "date", y: "y", text: () => `${p.s.label} ${valFmt(p.value)}`, dx: 12, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: p.s === list[0] ? 600 : 400 })),
    ].filter(Boolean),
  });
  a11y(plot, title, desc);
  mount(plotId, plot);
  addCrosshair(document.getElementById(plotId), plot, list, null, tipDate, (v) => (v == null ? "—" : valFmt(v)));
  wirePlate(figId, plot, file, csvOf(list, tipDate));
  return plot;
}

/* Signed bars on a time axis (one bar per period). */
function bars(plotId, figId, s, { d0, d1, yTicks, xTicks, xFmt = yTickFmt, yLabel, valFmt, tipDate, file, title, desc, H = 430, color = ACC, labelLast = true, extra = [] }) {
  const pts = s.data.filter((d) => d.value != null);
  const span = pts.length > 1 ? (pts.at(-1).date - pts[0].date) / (pts.length - 1) : 86400000 * 90;
  const half = span * 0.38;
  const L = pts.at(-1);
  const plot = Plot.plot({
    width: W, height: H, marginLeft: 56, marginRight: 120, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 12, ticks: xTicks, tickFormat: xFmt },
    y: { label: yLabel, labelAnchor: "top", labelArrow: false, domain: [d0, d1], ticks: yTicks, tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(yTicks, { stroke: GRID }),
      Plot.rectY(pts, { x1: (d) => new Date(+d.date - half), x2: (d) => new Date(+d.date + half), y1: 0, y2: "value", fill: (d) => (d === L ? color : d.value >= 0 ? "#AAB8F2" : "#8FA0EA"), insetLeft: 0, insetRight: 0 }),
      Plot.ruleY([0], { stroke: INK, strokeOpacity: 0.5 }),
      ...extra,
      labelLast ? Plot.text([L], { x: "date", y: "value", text: (d) => valFmt(d.value), dx: 10, dy: L.value >= 0 ? -4 : 4, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }) : null,
    ].filter(Boolean),
  });
  a11y(plot, title, desc);
  mount(plotId, plot);
  addCrosshair(document.getElementById(plotId), plot, [{ ...s, color }], null, tipDate, (v) => (v == null ? "—" : valFmt(v)));
  wirePlate(figId, plot, file, csvOf([s], tipDate));
  return plot;
}

/* Horizontal bars, one highlighted group. */
function hbars(plotId, rows, { valueFmt, hl, xMax, xTicks, xFmt, label, ml = 330 }) {
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 38, marginLeft: ml, marginRight: 110, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks.slice(1), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? ACC : G3), insetTop: 10, insetBottom: 10 }),
      Plot.text(rows, { y: "name", x: "v", text: (d) => valueFmt(d.v), dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  mount(plotId, plot);
  return plot;
}

/* ================= title block and §01 ================= */
const ca = lastPt(B.current_account), caPrev = B.current_account.data.at(-2), caYear = B.current_account.data.at(-5);
const res = lastPt(RW.total_usd);
const resYearAgo = (() => { const t = +res.date - 364 * 86400000; let best = null; for (const d of RW.total_usd.data) if (d.value != null && (!best || Math.abs(+d.date - t) < Math.abs(+best.date - t))) best = d; return best; })();
const resPeak = peakOf(RW.total_usd);
const usd = lastPt(RU.usd), usdYear = RU.usd.data.find((d) => +d.date === Date.UTC(usd.date.getUTCFullYear() - 1, usd.date.getUTCMonth(), 1));
const reer = lastPt(RE.reer_trade), neer = lastPt(RE.neer_trade);
const cadGdp = lastPt(IND.cad_to_gdp), cover = lastPt(IND.import_cover_of_reserves_in_months);

setHTML("m-latest", qLong(ca.date));
setHTML("m-week", dayLabel(res.date));
setHTML("n-ca", bn(ca.value));
setHTML("d-ca", `<b>${bn(caPrev.value)}</b> in ${qLabel(caPrev.date)}`);
setHTML("n-res", bnR(res.value));
setHTML("d-res", `<b>${bnR(resYearAgo.value)}</b> a year earlier`);
setHTML("n-inr", fmt.inr2(usd.value));
setHTML("d-inr", `<b>${fmt.inr2(usdYear.value)}</b> in ${monLabel(usdYear.date)}`);
setHTML("n-reer", fmt.num1(reer.value));
setHTML("d-reer", `2015-16 = 100, ${monLabel(reer.date)}`);
spark("nspark-ca", { ...scaled(since(B.current_account, "2016-04-01")), color: ACC });

setHTML("u-reading", `Quarter of ${qLabel(ca.date)}, reserves to ${dayLabel(res.date)}`);
setHTML("rb-ca", bn(ca.value));
setHTML("rb-cap", `Current account, ${qLong(ca.date)}: ${ca.value < 0 ? "India paid the world more than it earned from it" : "India earned more from the world than it paid it"}, in goods, services, income and transfers together.`);
setHTML("rb-res", bnR(res.value) + pc(""));

/* ================= §02 the current account ================= */
{
  const s = scaled(since(B.current_account, "2010-04-01"), 1 / 1000, "Current account", ACC);
  const tr = troughOf(s), pk = peakOf(s);
  bars("plot-ca", "cb-ca", s, { d0: -35, d1: 20, yTicks: [-30, -20, -10, 0, 10, 20], xTicks: yearTicks(2011, 2026, 3), yLabel: "US$ billion, a quarter", valFmt: (v) => fmt.bnFixed1(v), tipDate: qLabel,
    file: "india-atlas_current-account_quarterly", title: "India's current account balance, every quarter since 2010-11",
    desc: `Bars in US$ billion. Deepest deficit ${fmt.bnFixed1(tr.value)} in ${qLabel(tr.date)}; largest surplus ${fmt.bnFixed1(pk.value)} in ${qLabel(pk.date)}; latest ${fmt.bnFixed1(lastPt(s).value)} in ${qLabel(lastPt(s).date)}.`,
    extra: [Plot.text([tr], { x: "date", y: "value", text: () => `${fmt.bnFixed1(tr.value)}, ${qLabel(tr.date)}`, dy: 14, textAnchor: "middle", fill: INK, fontSize: 12 })] });
  setHTML("pv-ca", bn(ca.value));
  setHTML("ex-ca-latest", bn(ca.value));
  setHTML("ex-ca-q", qLabel(ca.date));
  setHTML("ex-ca-trough", `${fmt.bnFixed1(tr.value)} in ${qLabel(tr.date)}`);
  const surplusQ = s.data.filter((d) => d.value != null && d.value > 0).length, nQ = s.data.filter((d) => d.value != null).length;
  setHTML("ex-ca-surplus", `${surplusQ} of ${nQ}`);
  // why the surpluses happened, counted from the bars: January to March quarters, and the 2020-21 lockdowns
  const sur = s.data.filter((d) => d.value != null && d.value > 0);
  const nJM = sur.filter((d) => d.date.getUTCMonth() === 0).length;
  const nLock = sur.filter((d) => d.date.getUTCMonth() !== 0 && d.date >= new Date(Date.UTC(2020, 3, 1)) && d.date < new Date(Date.UTC(2021, 9, 1))).length;
  const nOther = sur.length - nJM - nLock, w = (n) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][n] ?? String(n);
  const parts = [nJM && `${w(nJM)} January to March ${nJM === 1 ? "quarter" : "quarters"}, when exports run high before the fiscal year closes`,
    nLock && `${w(nLock)} around the 2020 and 2021 lockdowns, when imports collapsed`, nOther && `${w(nOther)} other${nOther === 1 ? "" : "s"}`].filter(Boolean);
  setHTML("ex-ca-surplus-why", parts.length > 1 ? parts.slice(0, -1).join(", ") + ", and " + parts.at(-1) : parts[0] ?? "none");
}
{
  const s = { ...IND.cad_to_gdp, label: "Current account", color: ACC };
  const tr = troughOf(s), L = lastPt(s), pk = peakOf(s);
  const p = lines("plot-cagdp", "cb-cagdp", [s], { d0: -5.5, d1: 3, yTicks: [-5, -4, -3, -2, -1, 0, 1, 2, 3], xTicks: yearTicks(1970, 2025, 5).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 3, 1))), xFmt: yTickFmt,
    yLabel: "per cent of GDP, fiscal years", valFmt: (v) => fmt.pct1Minus(v), tipDate: fyLabel, file: "india-atlas_current-account-gdp_annual",
    title: "India's current account as a share of GDP, fiscal years since 1970-71",
    desc: `Line in per cent of GDP. Deepest deficit ${fmt.pct1Minus(tr.value)} in ${fyLabel(tr.date)}; largest surplus ${fmt.pct1Minus(pk.value)} in ${fyLabel(pk.date)}; latest ${fmt.pct1Minus(L.value)} in ${fyLabel(L.date)}.`,
    extra: [Plot.ruleY([-3], { stroke: G2, strokeDasharray: "3 4" }), Plot.text([{ d: new Date(Date.UTC(1971, 3, 1)), y: -3 }], { x: "d", y: "y", text: () => "3% deficit", dy: -8, textAnchor: "start", fill: MUTED, fontSize: 11.5 }),
      Plot.text([tr], { x: "date", y: "value", text: () => `${fmt.pct1Minus(tr.value)}, ${fyLabel(tr.date)}`, dy: 16, textAnchor: "middle", fill: INK, fontSize: 12 })], mr: 210 });
  setHTML("pv-cagdp", fmt.pct1Minus(L.value));
  setHTML("ex-cagdp", fmt.pct1Minus(L.value));
  setHTML("ex-cagdp-fy", fyLabel(L.date));
  setHTML("ex-cagdp-trough", `${fmt.pct1Minus(tr.value)} in ${fyLabel(tr.date)}`);
  const below3 = s.data.filter((d) => d.value != null && d.value < -3).map((d) => fyLabel(d.date));
  setHTML("ex-cagdp-n3", String(below3.length));
}

/* ================= §03 what fills the gap ================= */
{
  const list = [
    scaled(since(B.goods, "2011-04-01"), 1 / 1000, "Goods", ACC),
    scaled(since(B.services, "2011-04-01"), 1 / 1000, "Services", G1),
    scaled(since(B.private_transfers, "2011-04-01"), 1 / 1000, "Remittances", GOLD),
    scaled(since(B.income, "2011-04-01"), 1 / 1000, "Income", G2),
  ];
  lines("plot-parts", "cb-parts", list, { d0: -110, d1: 75, yTicks: [-100, -75, -50, -25, 0, 25, 50, 75], xTicks: yearTicks(2012, 2026, 2), yLabel: "US$ billion, net, a quarter",
    valFmt: (v) => fmt.bnFixed1(v), tipDate: qLabel, file: "india-atlas_current-account-parts_quarterly",
    title: "The parts of India's current account, net, every quarter since 2011-12",
    desc: `Four lines in US$ billion. In ${qLabel(ca.date)}: goods ${bn(lastPt(B.goods).value)}, services ${bn(lastPt(B.services).value)}, remittances ${bn(lastPt(B.private_transfers).value)}, income ${bn(lastPt(B.income).value)}.` });
  const g = lastPt(B.goods).value, sv = lastPt(B.services).value, rm = lastPt(B.private_transfers).value, inc = lastPt(B.income).value;
  setHTML("pv-parts", bn(g));
  setHTML("ex-p-goods", bn(g)); setHTML("ex-p-svc", bn(sv)); setHTML("ex-p-rem", bn(rm)); setHTML("ex-p-inc", bn(inc));
  setHTML("ex-p-cover", fmt.pct0(((sv + rm) / -g) * 100));
  setHTML("ex-p-soft", bn(lastPt(B.software).value));
}
{
  const list = [
    scaled(AN.current_account, 1 / 1000, "Current account", ACC),
    scaled(AN.goods, 1 / 1000, "Goods", G1),
    scaled(AN.invisibles, 1 / 1000, "Invisibles", GOLD),
  ];
  const L = lastPt(AN.current_account);
  lines("plot-long", "cb-long", list, { d0: -350, d1: 300, yTicks: [-300, -200, -100, 0, 100, 200, 300], xTicks: yearTicks(1950, 2025, 10).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 3, 1))),
    yLabel: "US$ billion, net, fiscal years", valFmt: (v) => fmt.bnFixed1(v), tipDate: fyLabel, file: "india-atlas_bop-since-1950_annual",
    title: "India's current account, goods and invisibles, fiscal years since 1950-51",
    desc: `Three lines in US$ billion. In ${fyLabel(L.date)} the current account was ${bn(L.value)}, goods ${bn(lastPt(AN.goods).value)}, invisibles ${bn(lastPt(AN.invisibles).value)}.` });
  setHTML("pv-long", bn(L.value));
  setHTML("ex-long-fy", fyLabel(L.date));
  const firstInvBig = AN.invisibles.data.find((d) => d.value != null && d.value > 10000);
  setHTML("ex-long-inv10", firstInvBig ? fyLabel(firstInvBig.date) : "–");
  const g91 = atDate(AN.goods, "1990-04-01"), ca91 = atDate(AN.current_account, "1990-04-01");
  setHTML("ex-long-91", bn(ca91));
}

/* ================= §04 money home, money out ================= */
{
  const s = scaled(G.remittances_in, 1 / 1000, "Remittances received", ACC);
  const L = lastPt(s);
  const yearSum = (series, endIdx) => sum(series.data.slice(endIdx - 3, endIdx + 1).map((d) => d.value ?? 0));
  const iL = s.data.indexOf(L);
  lines("plot-remit", "cb-remit", [s], { d0: 0, d1: 50, yTicks: [0, 10, 20, 30, 40, 50], xTicks: yearTicks(1992, 2026, 4), yLabel: "US$ billion, a quarter", valFmt: (v) => fmt.bnFixed1(v),
    tipDate: qLabel, file: "india-atlas_remittances-received_quarterly", mr: 260, zero: false,
    title: "Private transfers received from abroad, every quarter since 1990-91",
    desc: `Line in US$ billion a quarter, from ${fmt.bnFixed1(s.data.find((d) => d.value != null).value)} in 1990-91 to ${fmt.bnFixed1(L.value)} in ${qLabel(L.date)}.` });
  setHTML("pv-remit", fmt.bnFixed1(L.value));
  setHTML("ex-r-q", fmt.bnFixed1(L.value));
  setHTML("ex-r-year", fmt.bnFixed1(yearSum(s, iL)));
}
{
  // latest quarter of the detailed table: where the remittance money comes from
  const L = lastPt(PPL.remittances_received);
  const at = (k) => PPL[k].data.find((d) => +d.date === +L.date)?.value ?? null;
  const rows = [
    ["Sent home by Indians working abroad, for family", "family_remittances"],
    ["Withdrawn in India from NRI deposits", "nri_withdrawals"],
    ["Gifts and donations", "gifts_received"],
    ["Gold and silver in passengers' baggage", "gold_baggage"],
  ].map(([name, k]) => ({ name, k, v: at(k) / 1000 }));
  const plot = hbars("plot-remitmix", rows, { valueFmt: (v) => fmt.bnFixed1(v), hl: (d) => d.k === "family_remittances", xMax: 30, xTicks: [0, 10, 20, 30], xFmt: (v) => String(v), label: "US$ billion, in the quarter" });
  a11y(plot, "Private transfers received, by kind, latest quarter", rows.map((r) => `${r.name} ${fmt.bnFixed1(r.v)}`).join(", "));
  const csv = "kind,usd_billion\n" + rows.map((r) => `"${r.name}",${r.v.toFixed(3)}`).join("\n");
  wirePlate("cb-remitmix", plot, "india-atlas_remittances-by-kind", csv);
  setHTML("pv-remitmix", fmt.pct0((at("family_remittances") / at("remittances_received")) * 100));
  setHTML("ex-rm-q", qLabel(L.date));
  setHTML("ex-rm-family", fmt.bnFixed1(at("family_remittances") / 1000));
  setHTML("ex-rm-nri", fmt.bnFixed1(at("nri_withdrawals") / 1000));
  setHTML("ex-rm-wages", fmt.bnFixed1(at("wages_received") / 1000));
  setHTML("ex-rm-out", fmt.bnFixed1(at("remittances_paid") / 1000));
  setHTML("ex-rm-edu", fmt.bnFixed1(at("travel_paid_education") / 1000));
}
{
  // LRS: fiscal-year sums of RBI's monthly figures, complete years only (derived and labelled)
  const GROUPS = [
    ["Travel", ["travels"], ACC], ["Relatives abroad", ["maintenance_of_close_relatives"], G1], ["Gifts", ["gift"], "#7D8596"],
    ["Studies abroad", ["studies_abroad"], GOLD], ["Shares, bonds", ["investment_in_equity_debt"], G2], ["Deposits, property, other", ["deposit", "purchase_of_immovable_property", "donations", "medical_treatment", "others"], G3],
  ];
  const fys = new Map();
  LR.total.data.forEach((d, i) => {
    if (d.value == null) return;
    const y = d.date.getUTCMonth() >= 3 ? d.date.getUTCFullYear() : d.date.getUTCFullYear() - 1;
    const e = fys.get(y) ?? { n: 0, g: GROUPS.map(() => 0), total: 0 };
    e.n++; e.total += d.value;
    GROUPS.forEach(([, ks], j) => { e.g[j] += sum(ks.map((k) => LR[k].data[i].value ?? 0)); });
    fys.set(y, e);
  });
  const full = [...fys.entries()].filter(([, e]) => e.n === 12).sort((a, b) => a[0] - b[0]);
  const rows = full.flatMap(([y, e]) => GROUPS.map(([name], j) => ({ fy: `${y}-${String((y + 1) % 100).padStart(2, "0")}`, group: name, v: e.g[j] / 1000 })));
  const order = GROUPS.map((g) => g[0]);
  document.getElementById("legend-lrs").innerHTML = GROUPS.map(([g, , c]) => `<span class="chip"><i class="sq" style="background:${c};width:10px;height:10px"></i>${g}</span>`).join("");
  const plot = Plot.plot({
    width: W, height: 430, marginLeft: 56, marginRight: 20, marginTop: 30, marginBottom: 40, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.28, tickFormat: (fy) => (/^(20(09|12|15|18|21|24))/.test(fy) ? fy : "") },
    y: { label: "US$ billion, fiscal years", labelAnchor: "top", labelArrow: false, domain: [0, 35], ticks: [0, 5, 10, 15, 20, 25, 30, 35], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    color: { domain: order, range: GROUPS.map((g) => g[2]) },
    marks: [Plot.gridY([5, 10, 15, 20, 25, 30, 35], { stroke: GRID }), Plot.barY(rows, { x: "fy", y: "v", fill: "group", order, insetLeft: 0.5, insetRight: 0.5 }), Plot.ruleY([0], { stroke: BASE })],
  });
  const last = full.at(-1), first = full[0];
  a11y(plot, "Outward remittances under the LRS by purpose, fiscal years", `Stacked bars in US$ billion, from ${(first[1].total / 1000).toFixed(1)} in ${first[0]}-${String((first[0] + 1) % 100).padStart(2, "0")} to ${(last[1].total / 1000).toFixed(1)} in ${last[0]}-${String((last[0] + 1) % 100).padStart(2, "0")}; travel is the largest purpose.`);
  mount("plot-lrs", plot);
  wirePlate("cb-lrs", plot, "india-atlas_lrs-by-purpose_fiscal-years", "fiscal_year," + order.map((g) => `"${g}"`).join(",") + ",total\n" + full.map(([y, e]) => [`${y}-${String((y + 1) % 100).padStart(2, "0")}`, ...e.g.map((v) => (v / 1000).toFixed(3)), (e.total / 1000).toFixed(3)].join(",")).join("\n"));
  const fyl = `${last[0]}-${String((last[0] + 1) % 100).padStart(2, "0")}`;
  setHTML("pv-lrs", fmt.bnFixed1(last[1].total / 1000));
  setHTML("ex-l-fy", fyl);
  setHTML("ex-l-total", fmt.bnFixed1(last[1].total / 1000));
  setHTML("ex-l-travel", fmt.pct0((last[1].g[0] / last[1].total) * 100));
  setHTML("ex-l-study", fmt.bnFixed1(last[1].g[3] / 1000));
  const lm = lastPt(LR.total);
  setHTML("ex-l-month", monLabel(lm.date));
  { const e = lastPt(LR.travel_for_education); setHTML("ex-l-edu", "$" + fmt.inr(e.value) + " million"); setHTML("ex-l-edum", monLabel(e.date)); }
}

/* ================= §05 foreign money in and out ================= */
{
  const f = scaled(since(B.fdi, "2010-04-01"), 1 / 1000, "Direct investment, net", ACC);
  const p = scaled(since(B.portfolio, "2010-04-01"), 1 / 1000, "Portfolio investment, net", GOLD);
  lines("plot-flows", "cb-flows", [f, p], { d0: -30, d1: 35, yTicks: [-30, -20, -10, 0, 10, 20, 30], xTicks: yearTicks(2011, 2026, 3), yLabel: "US$ billion, a quarter",
    valFmt: (v) => fmt.bnFixed1(v), tipDate: qLabel, file: "india-atlas_fdi-portfolio_quarterly", mr: 290,
    title: "Net direct and portfolio investment, every quarter since 2010-11",
    desc: `Two lines in US$ billion. Latest quarter: direct investment ${fmt.bnFixed1(lastPt(f).value)}, portfolio ${fmt.bnFixed1(lastPt(p).value)}.` });
  const sd = (s) => { const v = s.data.map((d) => d.value).filter((x) => x != null); const m = sum(v) / v.length; return Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / v.length); };
  const neg = (s) => s.data.filter((d) => d.value != null && d.value < 0).length, n = (s) => s.data.filter((d) => d.value != null).length;
  setHTML("pv-flows", fmt.bnFixed1(lastPt(p).value));
  setHTML("ex-f-fdi", fmt.bnFixed1(lastPt(f).value)); setHTML("ex-f-fpi", fmt.bnFixed1(lastPt(p).value));
  setHTML("ex-f-sdfdi", fmt.bnFixed1(sd(f))); setHTML("ex-f-sdfpi", fmt.bnFixed1(sd(p)));
  setHTML("ex-f-negfpi", `${neg(p)} of ${n(p)}`); setHTML("ex-f-negfdi", `${neg(f)} of ${n(f)}`);
}
{
  // FDI, monthly table: fiscal-year sums of gross inflows, repatriation and outward FDI (derived)
  const K = [["Gross inflows into India", "a_i_a_gross_inflows_gross_investment", ACC], ["Repatriated", "a_i_b_repatriation_disinvestment", GOLD], ["Indian investment abroad", "a_ii_foreign_direct_investment_by_i", G1]];
  const fys = new Map();
  FD[K[0][1]].data.forEach((d, i) => {
    if (d.value == null) return;
    const y = d.date.getUTCMonth() >= 3 ? d.date.getUTCFullYear() : d.date.getUTCFullYear() - 1;
    const e = fys.get(y) ?? { n: 0, v: K.map(() => 0) };
    e.n++; K.forEach(([, k], j) => { e.v[j] += FD[k].data[i].value ?? 0; });
    fys.set(y, e);
  });
  const full = [...fys.entries()].filter(([, e]) => e.n === 12).sort((a, b) => a[0] - b[0]);
  const list = K.map(([lab, , c], j) => ({ label: lab, color: c, data: full.map(([y, e]) => ({ date: new Date(Date.UTC(y, 3, 1)), value: e.v[j] / 1000 })) }));
  lines("plot-fdi", "cb-fdi", list, { d0: 0, d1: 100, yTicks: [0, 20, 40, 60, 80, 100], xTicks: full.filter(([y]) => y % 2 === 0).map(([y]) => new Date(Date.UTC(y, 3, 1))), xFmt: fyLabel,
    yLabel: "US$ billion, fiscal years (sum of the months)", valFmt: (v) => fmt.bnFixed1(v), tipDate: fyLabel, file: "india-atlas_fdi-gross-repatriation_fiscal-years", mr: 320, zero: false,
    title: "Foreign direct investment into India: what comes in and what goes back, fiscal years",
    desc: `Three lines in US$ billion: gross inflows, repatriation, and Indian investment abroad, ${fyLabel(list[0].data[0].date)} to ${fyLabel(list[0].data.at(-1).date)}.` });
  const L = full.at(-1)[1].v;
  setHTML("pv-fdi", fmt.bnFixed1(L[0] / 1000));
  setHTML("ex-fdi-fy", fyLabel(list[0].data.at(-1).date));
  setHTML("ex-fdi-gross", fmt.bnFixed1(L[0] / 1000)); setHTML("ex-fdi-rep", fmt.bnFixed1(L[1] / 1000)); setHTML("ex-fdi-out", fmt.bnFixed1(L[2] / 1000));
  setHTML("ex-fdi-share", fmt.pct0((L[1] / L[0]) * 100));
}
{
  // FPI monthly, rupees: the fickle money, month by month
  const s = { ...since(FP.fpi_net, "2016-01-01"), label: "Net FPI investment", color: ACC };
  const v = s.data.map((d) => ({ ...d, value: d.value == null ? null : d.value / 1000 }));   // ₹ crore -> ₹ thousand crore
  const ss = { ...s, data: v };
  bars("plot-fpi", "cb-fpi", ss, { d0: -130, d1: 80, yTicks: [-120, -80, -40, 0, 40, 80], xTicks: yearTicks(2016, 2026, 2), yLabel: "₹ thousand crore, a month", valFmt: (x) => (x < 0 ? "−₹" : "₹") + fmt.inr(Math.round(Math.abs(x) * 1000)) + " cr",
    tipDate: monLabel, file: "india-atlas_fpi-net_monthly", title: "Net investment by foreign portfolio investors in Indian shares and bonds, monthly since 2016",
    desc: `Bars in ₹ thousand crore; the latest month ${monLabel(lastPt(ss).date)} is ${lastPt(ss).value.toFixed(1)}.` });
  const L = lastPt(FP.fpi_net);
  setHTML("pv-fpi", (L.value < 0 ? "−₹" : "₹") + fmt.inr(Math.abs(L.value)) + " cr");
  setHTML("ex-fpi-m", monLabel(L.date));
  const outM = s.data.filter((d) => d.value != null && d.value < 0).length, nM = s.data.filter((d) => d.value != null).length;
  setHTML("ex-fpi-out", `${outM} of ${nM}`);
  const tr = troughOf(FP.fpi_net);
  setHTML("ex-fpi-trough", `${"−₹" + fmt.inr(Math.abs(tr.value))} crore in ${monLabel(tr.date)}`);
}

/* ================= §06 reserves ================= */
{
  const list = [
    scaled(RW.total_usd, 1 / 1000, "Total reserves", ACC),
    scaled(RW.fca_usd, 1 / 1000, "Foreign currency assets", G1),
    scaled(RW.gold_usd, 1 / 1000, "Gold", GOLD),
  ];
  lines("plot-res", "cb-res", list, { d0: 0, d1: 900, yTicks: [0, 200, 400, 600, 800], xTicks: yearTicks(2002, 2026, 4), yLabel: "US$ billion, end of each week",
    valFmt: (v) => "$" + v.toFixed(0) + " bn", tipDate: dayLabel, file: "india-atlas_forex-reserves_weekly", mr: 280, zero: false,
    title: "India's foreign exchange reserves, every week since April 2001",
    desc: `Lines in US$ billion: total ${bnR(res.value)} on ${dayLabel(res.date)}, peak ${bnR(resPeak.value)} on ${dayLabel(resPeak.date)}.` });
  setHTML("pv-res", bnR(res.value));
  setHTML("ex-res-week", dayLabel(res.date));
  setHTML("ex-res-total", bnR(res.value));
  setHTML("ex-res-peak", `${bnR(resPeak.value)} on ${dayLabel(resPeak.date)}`);
  const prev = RW.total_usd.data.filter((d) => d.value != null).at(-2);
  setHTML("ex-res-wk", fmt.bnFixed1((res.value - prev.value) / 1000));
  setHTML("ex-res-gold", fmt.pct0((lastPt(RW.gold_usd).value / res.value) * 100));
  setHTML("ex-res-cover", fmt.num1(cover.value));
  setHTML("ex-res-cover-fy", fyLabel(cover.date));
}
{
  // why reserves move: month-end change in reserves against the RBI's own net dollar purchases
  const from = "2023-08-01";
  const chg = [];
  RM.total_usd.data.forEach((d, i) => { if (i && d.date >= dOf(from) && d.value != null && RM.total_usd.data[i - 1].value != null) chg.push({ date: d.date, value: (d.value - RM.total_usd.data[i - 1].value) / 1000 }); });
  const lastM = chg.at(-1).date;
  const net = IV.net.data.filter((d) => d.date >= dOf(from) && d.date <= lastM).map((d) => ({ date: d.date, value: d.value == null ? null : d.value / 1000 }));
  const sC = { label: "Change in reserves", color: ACC, data: chg }, sN = { label: "RBI's net dollar purchases", color: GOLD, data: net };
  // the domain follows the data: a month like August 2026 (+$59 bn) must not be clipped
  const allV = [...chg, ...net].map((d) => d.value).filter((v) => v != null);
  const yLo = Math.min(-20, Math.floor((Math.min(...allV) - 5) / 10) * 10), yHi = Math.max(20, Math.ceil((Math.max(...allV) + 5) / 10) * 10);
  const yT = []; for (let v = yLo; v <= yHi; v += yHi - yLo > 80 ? 20 : 10) yT.push(v);
  const plot = Plot.plot({
    width: W, height: 430, marginLeft: 56, marginRight: 250, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 12, ticks: yearTicks(2024, 2026, 1), tickFormat: yTickFmt },
    y: { label: "US$ billion, a month", labelAnchor: "top", labelArrow: false, domain: [yLo, yHi], ticks: yT, tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(yT.filter((v) => v !== 0), { stroke: GRID }),
      Plot.rectY(chg, { x1: (d) => new Date(+d.date - 11 * 864e5), x2: (d) => new Date(+d.date + 11 * 864e5), y1: 0, y2: "value", fill: "#AAB8F2" }),
      Plot.ruleY([0], { stroke: INK, strokeOpacity: 0.5 }),
      Plot.dot(net.filter((d) => d.value != null), { x: "date", y: "value", fill: GOLD, r: 3.5, stroke: "#fff", strokeWidth: 1 }),
      Plot.text([chg.at(-1)], { x: "date", y: "value", text: () => `Change in reserves ${fmt.bnFixed1(chg.at(-1).value)}`, dx: 14, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
      ...(lastPt(sN) ? [Plot.text([lastPt(sN)], { x: "date", y: "value", text: () => `RBI net purchases ${fmt.bnFixed1(lastPt(sN).value)}`, dx: 14, dy: lastPt(sN).value > chg.at(-1).value ? -14 : 14, textAnchor: "start", fill: INK, fontSize: 12.5 })] : []),
    ],
  });
  a11y(plot, "Monthly change in reserves against the RBI's net dollar purchases", `Bars: month-on-month change in total reserves, US$ billion; dots: RBI net purchases (+) or sales (−). Latest month ${monLabel(lastM)}: change ${fmt.bnFixed1(chg.at(-1).value)}, RBI ${lastPt(sN) ? fmt.bnFixed1(lastPt(sN).value) : "not published"}.`);
  mount("plot-resmove", plot);
  addCrosshair(document.getElementById("plot-resmove"), plot, [sC, sN], null, monLabel, (v) => (v == null ? "—" : fmt.bnFixed1(v)));
  wirePlate("cb-resmove", plot, "india-atlas_reserves-change-vs-rbi-purchases", csvOf([sC, sN], monLabel));
  // the gap between the two, month by month: valuation and everything else
  const both = chg.map((d) => ({ d: d.date, c: d.value, n: net.find((x) => +x.date === +d.date)?.value })).filter((x) => x.n != null);
  const gaps = both.map((x) => Math.abs(x.c - x.n));
  setHTML("pv-resmove", fmt.bnFixed1(chg.at(-1).value));
  setHTML("ex-mv-month", monLabel(lastM));
  setHTML("ex-mv-chg", fmt.bnFixed1(chg.at(-1).value));
  const lastBoth = both.at(-1);
  setHTML("ex-mv-net", lastBoth ? fmt.bnFixed1(lastBoth.n) : "–");
  setHTML("ex-mv-netm", lastBoth ? monLabel(lastBoth.d) : "–");
  setHTML("ex-mv-gapmax", fmt.bnFixed1(Math.max(...gaps)));
}

/* ================= §07 the rupee ================= */
{
  const s = { ...since(RU.usd, "1993-04-01"), label: "₹ per US dollar", color: ACC };
  lines("plot-rupee", "cb-rupee", [s], { d0: 20, d1: 110, yTicks: [20, 40, 60, 80, 100], xTicks: yearTicks(1994, 2026, 4), yLabel: "rupees per US dollar, monthly average",
    valFmt: (v) => fmt.inr2(v), tipDate: monLabel, file: "india-atlas_usdinr_monthly", mr: 220, zero: false,
    title: "Rupees per US dollar, monthly average, since 1993",
    desc: `Line rising from ${fmt.inr2(s.data[0].value)} in ${monLabel(s.data[0].date)} to ${fmt.inr2(usd.value)} in ${monLabel(usd.date)}. A higher number is a weaker rupee.` });
  setHTML("pv-rupee", fmt.inr2(usd.value));
  setHTML("ex-ru-m", monLabel(usd.date)); setHTML("ex-ru-v", fmt.inr2(usd.value)); setHTML("ex-ru-y", fmt.inr2(usdYear.value));
  setHTML("ex-ru-pct", fmt.pct1(((usd.value / usdYear.value) - 1) * 100));
}
{
  const list = [
    { ...RE.reer_trade, label: "Real (REER)", color: ACC },
    { ...RE.neer_trade, label: "Nominal (NEER)", color: G1 },
  ];
  lines("plot-reer", "cb-reer", list, { d0: 70, d1: 145, yTicks: [70, 80, 90, 100, 110, 120, 130, 140], xTicks: yearTicks(2005, 2025, 4), yLabel: "index, 2015-16 = 100, trade-weighted, 40 currencies",
    valFmt: (v) => v.toFixed(1), tipDate: monLabel, file: "india-atlas_reer-neer-40-currency_monthly", mr: 220, zero: false,
    title: "The rupee against a basket of 40 currencies, nominal and real, since 2004",
    desc: `Two lines: REER ${fmt.num1(reer.value)} and NEER ${fmt.num1(neer.value)} in ${monLabel(reer.date)}, against 100 in 2015-16. A rise is a stronger rupee.`,
    extra: [Plot.ruleY([100], { stroke: G2, strokeDasharray: "3 4" }), Plot.text([{ d: new Date(Date.UTC(2004, 6, 1)), y: 100 }], { x: "d", y: "y", text: () => "2015-16 = 100", dy: -8, textAnchor: "start", fill: MUTED, fontSize: 11.5 })] });
  const ry = RE.reer_trade.data.find((d) => +d.date === Date.UTC(reer.date.getUTCFullYear() - 1, reer.date.getUTCMonth(), 1));
  setHTML("pv-reer", fmt.num1(reer.value));
  setHTML("ex-re-m", monLabel(reer.date)); setHTML("ex-re-reer", fmt.num1(reer.value)); setHTML("ex-re-neer", fmt.num1(neer.value));
  setHTML("ex-re-reery", fmt.num1(ry.value));
  setHTML("ex-re-gap", fmt.num1(reer.value - neer.value));
}

/* ================= §08 the RBI's dollar desk ================= */
{
  const n = { ...since(IV.net, "2015-04-01"), label: "Net purchases (+) / sales (−)", color: ACC };
  const ns = { ...n, data: n.data.map((d) => ({ ...d, value: d.value == null ? null : d.value / 1000 })) };
  const fw = scaled(since(IV.forward_outstanding, "2015-04-01"), 1 / 1000, "Forward book, end of month", GOLD);
  const pts = ns.data.filter((d) => d.value != null);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 56, marginRight: 270, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 12, ticks: yearTicks(2016, 2026, 2), tickFormat: yTickFmt },
    y: { label: "US$ billion", labelAnchor: "top", labelArrow: false, domain: [-150, 100], ticks: [-150, -100, -50, 0, 50, 100], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY([-150, -100, -50, 50, 100], { stroke: GRID }),
      Plot.rectY(pts, { x1: (d) => new Date(+d.date - 11 * 864e5), x2: (d) => new Date(+d.date + 11 * 864e5), y1: 0, y2: "value", fill: "#8FA0EA" }),
      Plot.ruleY([0], { stroke: INK, strokeOpacity: 0.5 }),
      Plot.lineY(fw.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.dot([lastPt(fw)], { x: "date", y: "value", fill: GOLD, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([lastPt(fw)], { x: "date", y: "value", text: () => `Forward book ${fmt.bnFixed1(lastPt(fw).value)}`, dx: 12, textAnchor: "start", fill: INK, fontSize: 12.5 }),
      Plot.text([pts.at(-1)], { x: "date", y: "value", text: () => `Net purchases ${fmt.bnFixed1(pts.at(-1).value)}`, dx: 12, dy: pts.at(-1).value > lastPt(fw).value ? -2 : 14, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "The RBI's monthly net dollar purchases and its outstanding forward book, since 2015", `Bars: net purchases (+) or sales (−), US$ billion; line: the forward book, ${fmt.bnFixed1(lastPt(fw).value)} at the end of ${monLabel(lastPt(fw).date)}.`);
  mount("plot-desk", plot);
  addCrosshair(document.getElementById("plot-desk"), plot, [ns, fw], null, monLabel, (v) => (v == null ? "—" : fmt.bnFixed1(v)));
  wirePlate("cb-desk", plot, "india-atlas_rbi-dollar-desk_monthly", csvOf([ns, fw], monLabel));
  const L = lastPt(IV.net), fwT = troughOf(fw);
  setHTML("pv-desk", fmt.bnFixed1(lastPt(fw).value));
  setHTML("ex-d-m", monLabel(L.date)); setHTML("ex-d-net", fmt.bnFixed1(L.value / 1000));
  setHTML("ex-d-fw", fmt.bnFixed1(lastPt(fw).value));
  setHTML("ex-d-fwt", `${fmt.bnFixed1(fwT.value)} in ${monLabel(fwT.date)}`);
  const m1 = lastPt(FB.upto_1_month_net) ?? null;
  setHTML("ex-d-1m", m1 ? fmt.bnFixed1(m1.value / 1000) : "–");
  const sales12 = sum(IV.sale.data.slice(-12).map((d) => d.value ?? 0)), buys12 = sum(IV.purchase.data.slice(-12).map((d) => d.value ?? 0));
  setHTML("ex-d-sold12", fmt.bnFixed1(sales12 / 1000)); setHTML("ex-d-bought12", fmt.bnFixed1(buys12 / 1000));
}

/* ================= §09 what India owes ================= */
{
  const list = [
    scaled(DA.e_1_gross_external_debt_position, 1 / 1000, "Total external debt", ACC),
    scaled(DA.e_1_1_5_commercial_borrowing, 1 / 1000, "Commercial borrowing", G1),
    scaled(DA.e_1_1_6_nri_and_fc, 1 / 1000, "NRI deposits", GOLD),
    scaled(DA.e_1_2_short_term_debt, 1 / 1000, "Short-term debt", G2),
  ];
  const L = lastPt(DA.e_1_gross_external_debt_position);
  lines("plot-debt", "cb-debt", list, { d0: 0, d1: 900, yTicks: [0, 200, 400, 600, 800], xTicks: yearTicks(1992, 2026, 4).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 2, 1))), yLabel: "US$ billion, as on 31 March",
    valFmt: (v) => "$" + v.toFixed(0) + " bn", tipDate: (d) => `March ${d.getUTCFullYear()}`, file: "india-atlas_external-debt_end-march", mr: 300, zero: false,
    title: "India's external debt as on 31 March, by kind, since 1991",
    desc: `Lines in US$ billion; total ${bnR(L.value)} in March ${L.date.getUTCFullYear()}.` });
  const pct = (k) => lastPt(DA[k])?.value;
  setHTML("pv-debt", bnR(L.value));
  setHTML("ex-debt-y", `March ${L.date.getUTCFullYear()}`); setHTML("ex-debt-total", bnR(L.value));
  setHTML("ex-debt-gdp", fmt.pct1(pct("e_7_debt_stock_gdp_ratio"))); setHTML("ex-debt-st", fmt.pct1(pct("e_5_as_of_total_debt")));
  setHTML("ex-debt-ds", fmt.pct1(pct("e_8_debt_service_ratio")));
  setHTML("ex-debt-cover", fmt.pct0((lastPt(RW.total_usd).value / L.value) * 100));
  const d91 = DA.e_1_gross_external_debt_position.data[0];
  setHTML("ex-debt-91", bnR(d91.value)); setHTML("ex-debt-91y", `March ${d91.date.getUTCFullYear()}`);
}
{
  // who owes it: borrowing sectors in the latest quarter, shares of the total (unit-free)
  const L = lastPt(DS.s_gross_external_debt_position_by_borrowing_sector) ?? lastPt(Object.values(DS)[0]);
  const at = (k) => DS[k]?.data.find((d) => +d.date === +L.date)?.value ?? null;
  const tot = L.value;
  const rows = [
    ["Companies (non-financial)", "s_non_financial_corporations"],
    ["Banks", "s_deposit_taking_corporations_except_the_central_ban"],
    ["Government", "s_general_government"],
    ["Other financial companies", "s_other_financial_corporations"],
    ["Lending within company groups", "s_direct_investment_intercompany_lending"],
    ["Reserve Bank of India", "s_central_bank"],
    ["Households and non-profits", "s_households_and_nonprofit_institutions_serving_hous"],
  ].map(([name, k]) => ({ name, k, v: at(k) })).filter((r) => r.v != null).map((r) => ({ ...r, v: (r.v / tot) * 100 })).sort((a, b) => b.v - a.v);
  const plot = hbars("plot-sector", rows, { valueFmt: (v) => fmt.pct1(v), hl: (d) => d === rows[0], xMax: 50, xTicks: [0, 10, 20, 30, 40, 50], xFmt: (v) => String(v), label: "per cent of external debt" });
  a11y(plot, "India's external debt by who borrowed, latest quarter", rows.map((r) => `${r.name} ${fmt.pct1(r.v)}`).join(", "));
  wirePlate("cb-sector", plot, "india-atlas_external-debt-by-borrower", "borrower,share_percent\n" + rows.map((r) => `"${r.name}",${r.v.toFixed(2)}`).join("\n"));
  setHTML("pv-sector", fmt.pct1(rows[0].v));
  setHTML("ex-s-q", qLabel(L.date)); setHTML("ex-s-top", rows[0].name.toLowerCase()); setHTML("ex-s-topv", fmt.pct1(rows[0].v));
  const gov = rows.find((r) => r.name === "Government");
  setHTML("ex-s-gov", gov ? fmt.pct1(gov.v) : "–");
}
{
  const list = [
    scaled(IIP.liabilities, 1 / 1000, "Owed to the world", G1),
    scaled(IIP.assets, 1 / 1000, "Owned abroad", GOLD),
    scaled(IIP.net, 1 / 1000, "Net position", ACC),
  ];
  // the lead series (net) is drawn last in the legend order; reorder so the accent leads
  const lead = [list[2], list[0], list[1]];
  lines("plot-iip", "cb-iip", lead, { d0: -600, d1: 1600, yTicks: [-400, 0, 400, 800, 1200, 1600], xTicks: yearTicks(2018, 2026, 2), yLabel: "US$ billion, end of quarter",
    valFmt: (v) => fmt.bnFixed1(v), tipDate: qLabel, file: "india-atlas_international-investment-position_quarterly", mr: 260,
    title: "What India owns abroad and owes to the world, every quarter since December 2017",
    desc: `Three lines in US$ billion: owed ${bn(lastPt(IIP.liabilities).value)}, owned ${bn(lastPt(IIP.assets).value)}, net ${bn(lastPt(IIP.net).value)}.` });
  setHTML("pv-iip", bn(lastPt(IIP.net).value));
  setHTML("ex-iip-q", qLabel(lastPt(IIP.net).date));
  setHTML("ex-iip-net", bn(lastPt(IIP.net).value)); setHTML("ex-iip-res", fmt.pct0((lastPt(IIP.a_reserves).value / lastPt(IIP.assets).value) * 100));
  setHTML("ex-iip-ldi", fmt.pct0((lastPt(IIP.l_direct).value / lastPt(IIP.liabilities).value) * 100));
}

/* ================= §10 how the numbers revise ================= */
{
  const V = hydrate(vintB);
  const rows = V.current_account_first.data.map((d, i) => ({ q: qLabel(d.date), date: d.date, a: d.value / 1000, b: V.current_account_latest.data[i].value / 1000, ver: vintB.meta.versions?.[iso(d.date)] ?? [] }));
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 32, marginLeft: 150, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: "US$ billion, current account", labelAnchor: "right", labelArrow: false, domain: [-25, 20], ticks: [-20, -10, 0, 10, 20], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: rows.map((r) => r.q), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX([-20, -10, 10, 20], { stroke: GRID }),
      Plot.ruleX([0], { stroke: INK, strokeOpacity: 0.5 }),
      Plot.ruleY(rows.filter((r) => Math.abs(r.a - r.b) > 0.05), { y: "q", x1: "a", x2: "b", stroke: "#AAB8F2", strokeWidth: 2 }),
      Plot.dot(rows, { y: "q", x: "a", r: 4, fill: "#fff", stroke: MUTED, strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "q", x: "b", r: 4, fill: ACC }),
      Plot.text(rows, { y: "q", x: () => 20, dx: 18, text: (d) => (Math.abs(d.b - d.a) < 0.05 ? "unrevised" : `${d.b - d.a > 0 ? "+" : "−"}${Math.abs(d.b - d.a).toFixed(1)}`), textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  const big = rows.reduce((m, r) => (Math.abs(r.b - r.a) > Math.abs(m.b - m.a) ? r : m), rows[0]);
  a11y(plot, "How the current account revises: first estimate against the latest", `Hollow dot first estimate, filled dot latest, US$ billion, ${rows.length} quarters. Largest revision ${(big.b - big.a).toFixed(1)} in ${big.q}.`);
  mount("plot-rev", plot);
  wirePlate("cb-rev", plot, "india-atlas_current-account-revisions", "quarter,first_estimate_usd_bn,latest_usd_bn,first_version,latest_version\n" + rows.map((r) => `"${r.q}",${r.a.toFixed(3)},${r.b.toFixed(3)},"${r.ver[0] ?? ""}","${r.ver.at(-1) ?? ""}"`).join("\n"));
  setHTML("pv-rev", `${big.b - big.a > 0 ? "+" : "−"}$${Math.abs(big.b - big.a).toFixed(1)} bn`);
  setHTML("ex-rev-big", `${big.q}: first ${fmt.bnFixed1(big.a)}, now ${fmt.bnFixed1(big.b)}`);
  setHTML("ex-rev-n", String(rows.filter((r) => Math.abs(r.b - r.a) >= 1).length));
  setHTML("ex-rev-of", String(rows.length));
}

/* ================= small facts in the text ================= */
{
  const nri = lastPt(NR.total_outstanding);
  setHTML("ex-nri", bnR(nri.value)); setHTML("ex-nri-m", monLabel(nri.date));
  const inv = lastPt(INV.invoiced_exports_percent);
  setHTML("ex-inv", inv ? fmt.pct1(inv.value) : "–"); setHTML("ex-inv-m", inv ? monLabel(inv.date) : "–");
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", bopB.meta.vintage);
setHTML("prov-vintage2", bopB.meta.vintage);
