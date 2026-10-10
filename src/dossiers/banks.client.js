// Guide 26, India's banks one by one: plates and number wiring.
// Data: the inline JSON block #banks-data, assembled at build time by src/dossiers/banks.data.js
// from data/series/banks-*.json (scripts/lib/products/banks.mjs) and three of the credit guide's
// bundles (branches, offices, NBFC credit). Bank-wise bundles run to megabytes; only what the
// plates draw is embedded. Rates are per cent; amounts ₹ crore in the data, ₹ lakh crore on charts.
// Rulers never joined: a merged bank's series ends, the acquirer's carries on (merger steps are
// marked on the mergers plate); infrastructure lending is drawn on its current list only.

import * as Plot from "@observablehq/plot";
import { MONO as sans, a11y, addCrosshair, spark, dodgeEndLabels, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

const D = JSON.parse(document.getElementById("banks-data")?.textContent || "{}");
const INK = "#161A22", GRID = "#F0F2F5", ZERO = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fyOf = (iso) => `${+iso.slice(0, 4) - 1}-${iso.slice(2, 4)}`;
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yr = (y, m = 0) => new Date(Date.UTC(y, m, 1));
const yearTicks = (a, b, step) => { const t = []; for (let y = a; y <= b; y += step) t.push(yr(y)); return t; };
const yearFmt = (d) => { const y = d.getUTCFullYear(); return y % 10 === 0 || y === 2014 ? String(y) : "’" + String(y).slice(2); };
const toDate = (iso) => new Date(iso + "T00:00:00Z");
const pts = (pairs) => pairs.map(([d, v]) => ({ date: toDate(d), value: v }));
const crore = (v) => "₹" + fmt.inr(v) + " crore";
const lakhCrore = (v) => fmt.lc1(v / 1e5);   // ₹ crore in, "₹12.3 lakh crore" out
const GROUPCOL = { psb: ACC, private: GOLD, foreign: G2, sfb: G3, all: INK };

/* ---------- shared plate wiring ---------- */
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
const csvOf = (cols, rows) => [cols.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");
/** a date-joined CSV of several [iso, value] series */
const pairsCsv = (list) => {
  const keys = [...new Set(list.flatMap(([, p]) => p.map(([d]) => d)))].sort();
  const maps = list.map(([, p]) => new Map(p));
  return csvOf(["date", ...list.map(([n]) => n)], keys.map((d) => [d, ...maps.map((m) => m.get(d) ?? null)]));
};
const healthPairs = (k) => D.healthDates.map((d, i) => [d, D.health[k][i]]).filter(([, v]) => v != null);
const lastH = (k) => { const a = healthPairs(k); return a.at(-1)?.[1] ?? null; };

/** Lines on a time axis with labels at the line ends (dodged), a crosshair and a11y. */
function lines(id, list, { yDomain, yTicks, yFmt = (v) => String(v), yLabel, xTicks, height = 470, mr = 220, ml = 48, labelFmt = (v) => fmt.pct1(v), extra = [], dateFmt = (d) => monthOf(d.toISOString().slice(0, 10)) }) {
  const host = document.getElementById(id); if (!host) return null;
  const marks = [Plot.gridY(yTicks.filter((v) => v !== 0), { stroke: GRID }), Plot.ruleY([yDomain[0] <= 0 && yDomain[1] >= 0 ? 0 : yDomain[0]], { stroke: ZERO }), ...extra];
  for (const s of list.filter((s) => !s.lead)) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 1.5, strokeLinejoin: "round", strokeLinecap: "round" }));
  for (const s of list.filter((s) => s.lead)) marks.push(Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.width ?? 2, strokeLinejoin: "round", strokeLinecap: "round" }));
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
  addCrosshair(host, plot, list.map((s) => ({ data: s.data, label: s.label, color: s.color })), null, dateFmt, (v) => (v == null ? "—" : labelFmt(v)));
  return plot;
}

/** Horizontal bars with values at the bar's end, optional comparison dots (open). */
function hbars(id, rows, { valueFmt, color = () => G3, xDomain, xTicks, xFmt = (v) => String(v), ml = 260, mr = 120, dot = null, rowH = 34 }) {
  const host = document.getElementById(id); if (!host) return null;
  const marks = [
    Plot.gridX(xTicks.filter((v) => v !== 0), { stroke: GRID }),
    Plot.barX(rows, { y: "name", x: "v", fill: color, insetTop: rowH * 0.28, insetBottom: rowH * 0.28 }),
    Plot.ruleX([0], { stroke: ZERO }),
  ];
  if (dot) marks.push(Plot.dot(rows.filter((r) => r[dot] != null), { y: "name", x: dot, r: 4, fill: "#fff", stroke: G1, strokeWidth: 1.5 }));
  // the value label sits past whichever is further out, the bar's end or the comparison dot
  const upx = (xDomain[1] - xDomain[0]) / (W - ml - mr);
  const lx = (r) => (dot && r[dot] != null && r[dot] > r.v - 6 * upx ? Math.max(r.v, r[dot] + 6 * upx) : r.v);
  marks.push(Plot.text(rows, { y: "name", x: lx, text: (d) => valueFmt(d.v), dx: 9, textAnchor: "start", fill: INK, fontSize: 12.5 }));
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * rowH, marginLeft: ml, marginRight: mr, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: xDomain, ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks,
  });
  host.append(plot);
  return plot;
}
const niceMax = (v, steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) => { const p = 10 ** Math.floor(Math.log10(v)); for (const s of steps) if (s * p >= v) return s * p; return 10 * p; };
const ticksTo = (max, n = 5) => { const st = max / n; return Array.from({ length: n + 1 }, (_, i) => +(i * st).toFixed(6)); };

/* ======================================================================================
 * Title block and § 01
 * ==================================================================================== */
const L = D.latest;
const all = lastH("all_gnpa"), peakAll = healthPairs("all_gnpa").reduce((p, c) => (c[1] > p[1] ? c : p));
const psbShare = lastH("psb_deposit_share"), psbShare0 = healthPairs("psb_deposit_share")[0];
setHTML("m-latest", monthOf(L));
setHTML("u-reading", `RBI, bank-wise returns, ${monthOf(L)}`);
setHTML("n-npa", all.toFixed(2) + pc("%"));
setHTML("d-npa", `<b>${fmt.pct2(peakAll[1])}</b> at the peak, ${monthOf(peakAll[0])}`);
spark("nspark-npa", { data: pts(healthPairs("all_gnpa")), color: ACC });
setHTML("n-psb", psbShare.toFixed(1) + pc("%"));
setHTML("d-psb", `<b>${fmt.pct1(psbShare0[1])}</b> in ${monthOf(psbShare0[0])}`);
setHTML("n-crar", lastH("all_crar").toFixed(2) + pc("%"));
setHTML("d-crar", `public sector <b>${fmt.pct2(lastH("psb_crar"))}</b>, private <b>${fmt.pct2(lastH("private_crar"))}</b>`);
setHTML("n-roa", lastH("all_roa").toFixed(2) + pc("%"));
setHTML("d-roa", `public sector <b>${fmt.pct2(lastH("psb_roa"))}</b>, private <b>${fmt.pct2(lastH("private_roa"))}</b>`);
setHTML("rb-npa", all.toFixed(2) + pc("%"));
setHTML("rb-peak", fmt.pct2(peakAll[1]));
setHTML("rb-peakd", monthOf(peakAll[0]));

/* ---------- § 02 lived reality: deposit insurance ---------- */
{
  const [d, ins, ass, acc, accAll] = D.insured.at(-1);
  setHTML("lr-ins-acc", fmt.pct1((100 * acc) / accAll));
  setHTML("lr-ins-share", fmt.pct1((100 * ins) / ass));
}

/* ======================================================================================
 * § 04 bad loans
 * ==================================================================================== */
{
  const list = [
    { key: "psb", label: "Public sector", color: ACC },
    { key: "private", label: "Private sector", color: GOLD },
    { key: "all", label: "All banks", color: INK, lead: true },
    { key: "foreign", label: "Foreign", color: G2 },
    { key: "sfb", label: "Small finance", color: G3 },
  ].map((s) => ({ ...s, data: pts(healthPairs(`${s.key}_gnpa`)) }));
  const psbPk = healthPairs("psb_gnpa").reduce((p, c) => (c[1] > p[1] ? c : p));
  const yMax = Math.ceil(psbPk[1] / 4) * 4;
  const plot = lines("plot-npa", list, { yDomain: [0, yMax], yTicks: ticksTo(yMax, yMax / 4), yFmt: (v) => v + (v === yMax ? "%" : ""), yLabel: "↑ gross NPAs, per cent of gross advances", xTicks: yearTicks(2014, +L.slice(0, 4), 1), labelFmt: fmt.pct2,
    extra: [Plot.text([{ date: toDate(psbPk[0]), value: psbPk[1] }], { x: "date", y: "value", text: [`${fmt.pct2(psbPk[1])}, ${monthOf(psbPk[0])}`], dy: -12, textAnchor: "middle", fill: INK, fontSize: 12, fontWeight: 600 })] });
  a11y(plot, "Bad loans of India's banks by bank group since 2013", `All banks' gross NPA ratio was ${fmt.pct2(all)} in ${monthOf(L)}, against ${fmt.pct2(peakAll[1])} at the peak in ${monthOf(peakAll[0])}.`);
  setHTML("pv-npa", fmt.pct2(all));
  setHTML("ex-n-all", fmt.pct2(all)); setHTML("ex-n-psb", fmt.pct2(lastH("psb_gnpa"))); setHTML("ex-n-pvt", fmt.pct2(lastH("private_gnpa"))); setHTML("ex-n-for", fmt.pct2(lastH("foreign_gnpa"))); setHTML("ex-n-sfb", fmt.pct2(lastH("sfb_gnpa")));
  setHTML("ex-n-pkd", monthOf(peakAll[0])); setHTML("ex-n-pk", fmt.pct2(peakAll[1])); setHTML("ex-n-pkpsb", fmt.pct2(psbPk[1])); setHTML("ex-n-net", fmt.pct2(lastH("all_nnpa")));
  wirePlate("cb-npa", plot, "india-atlas_bank-bad-loans-by-group", pairsCsv(["all", "psb", "private", "foreign", "sfb"].flatMap((g) => [[`${g}_gross_npa_ratio_pct`, healthPairs(`${g}_gnpa`)], [`${g}_net_npa_ratio_pct`, healthPairs(`${g}_nnpa`)]])));
}

/* ======================================================================================
 * § 05 public and private
 * ==================================================================================== */
{
  const host = document.getElementById("plot-shares");
  const G = [["psb", "Public sector", ACC], ["private", "Private sector", GOLD], ["foreign", "Foreign", G2], ["sfb", "Small finance", G3]];
  const panels = [["deposits", "Deposits"], ["advances", "Advances"]];
  const rows = panels.flatMap(([w, pn]) => G.flatMap(([g, name, c]) => (D.shares[`${g}__${w}`] ?? []).map(([d, v]) => ({ panel: pn, g, name, c, date: toDate(d), value: v }))));
  const ends = panels.flatMap(([w, pn]) => G.map(([g, name, c]) => { const a = D.shares[`${g}__${w}`]; return a?.length ? { panel: pn, name, c, date: toDate(a.at(-1)[0]), value: a.at(-1)[1] } : null; }).filter(Boolean));
  // end labels, dodged per panel
  const labelled = [];
  for (const [, pn] of panels) { const e = ends.filter((x) => x.panel === pn).sort((a, b) => b.value - a.value); let lastY = Infinity; for (const x of e) { const y = Math.min(x.value, lastY - 5.5); labelled.push({ ...x, y }); lastY = y; } }
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 190, marginTop: 40, marginBottom: 34, style: baseStyle,
    fx: { label: null, padding: 0.32, tickSize: 0, axis: "top", tickFormat: (p) => String(p) },
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2014, +L.slice(0, 4), 4), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ share of all banks, per cent", labelAnchor: "top", labelArrow: false, domain: [0, 80], ticks: [0, 20, 40, 60, 80], tickFormat: (v) => v + (v === 80 ? "%" : ""), tickSize: 0, tickPadding: 8 },
    marks: [
      Plot.gridY([20, 40, 60, 80], { stroke: GRID }),
      Plot.ruleY([0], { stroke: ZERO }),
      Plot.lineY(rows, { fx: "panel", x: "date", y: "value", z: "g", stroke: "c", strokeWidth: (d) => (d.g === "psb" || d.g === "private" ? 2 : 1.5), strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(ends, { fx: "panel", x: "date", y: "value", fill: "c", r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(labelled, { fx: "panel", x: "date", y: "y", text: (d) => `${d.name} ${fmt.pct1(d.value)}`, dx: 9, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  host?.append(plot);
  const S = (k) => D.shares[k] ?? [];
  const p = S("psb__deposits"), v = S("private__deposits");
  a11y(plot, "Shares of deposits and advances by bank group since 2013", `Public sector banks held ${fmt.pct1(p.at(-1)[1])} of deposits in ${monthOf(p.at(-1)[0])}, against ${fmt.pct1(p[0][1])} in ${monthOf(p[0][0])}; private sector banks ${fmt.pct1(v.at(-1)[1])}.`);
  setHTML("pv-shares", fmt.pct1(p.at(-1)[1]));
  setHTML("ex-s-psb", fmt.pct1(p.at(-1)[1])); setHTML("ex-s-psb0", fmt.pct1(p[0][1])); setHTML("ex-s-d0", monthOf(p[0][0]));
  setHTML("ex-s-pvt", fmt.pct1(v.at(-1)[1])); setHTML("ex-s-pvt0", fmt.pct1(v[0][1]));
  setHTML("ex-s-psba", fmt.pct1(S("psb__advances").at(-1)[1])); setHTML("ex-s-pvta", fmt.pct1(S("private__advances").at(-1)[1]));
  wirePlate("cb-shares", plot, "india-atlas_bank-group-shares", pairsCsv(G.flatMap(([g]) => panels.map(([w]) => [`${g}_${w}_share_pct`, S(`${g}__${w}`)]))));
}
{
  const rows = D.biggest.map((r) => ({ ...r, v: r.share, was: r.share0 }));
  const xMax = niceMax(Math.max(...rows.map((r) => Math.max(r.v, r.was ?? 0))) * 1.05);
  const plot = hbars("plot-biggest", rows, { valueFmt: fmt.pct1, color: (d) => GROUPCOL[d.group] ?? G3, xDomain: [0, xMax], xTicks: ticksTo(xMax, 5), xFmt: (x) => x + (x === xMax ? "%" : ""), dot: "was", ml: 230 });
  a11y(plot, "The fifteen largest banks by deposits in India", rows.map((r) => `${r.name} ${fmt.pct1(r.v)}`).join(", "));
  setHTML("pv-biggest", fmt.pct1(D.top5share));
  setHTML("ex-b-n", fmt.count(D.nBanks)); setHTML("ex-b-1", rows[0].name); setHTML("ex-b-1s", fmt.pct1(rows[0].v)); setHTML("ex-b-5", fmt.pct1(D.top5share));
  const h = rows.find((r) => r.id === "hdfc_bank_ltd");
  if (h) { setHTML("ex-b-h0", fmt.pct1(h.was)); setHTML("ex-b-h", fmt.pct1(h.v)); }
  // the merger quarter's step in HDFC Bank's share (June to September 2023), computed at build time
  setHTML("ex-b-hm", fmt.pt1(D.hdfcStep));
  wirePlate("cb-biggest", plot, "india-atlas_largest-banks-by-deposits", csvOf(["bank", "group", `deposits_${D.bsLatest}_inr_crore`, `share_${D.bsLatest}_pct`, `share_${D.bsFirst}_pct`, "merger"], rows.map((r) => [r.name, r.group, r.dep, r.v, r.was, r.merger])));
}

/* ======================================================================================
 * § 06 profit, capital, margins
 * ==================================================================================== */
{
  const host = document.getElementById("plot-profit");
  const G = [["psb", "Public sector", ACC], ["private", "Private sector", GOLD], ["foreign", "Foreign", G2]];
  const years = D.profit.years.map(fyOf);
  const rows = D.profit.years.flatMap((d, i) => G.map(([g, name, c]) => ({ fy: fyOf(d), g, name, c, v: D.profit[g][i] == null ? null : D.profit[g][i] / 1e5 }))).filter((r) => r.v != null);
  const lo = Math.min(0, ...rows.map((r) => r.v)), hi = Math.max(...rows.map((r) => r.v));
  const yMin = Math.floor(lo * 2) / 2, yMax = Math.ceil(hi * 2) / 2;
  const yt = []; for (let v = yMin; v <= yMax + 1e-9; v += 0.5) yt.push(+v.toFixed(1));
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 52, marginRight: 20, marginTop: 30, marginBottom: 40, style: baseStyle,
    fx: { label: null, domain: years, padding: 0.18, tickSize: 0, tickPadding: 10, tickFormat: (fy) => (fy === years[0] || fy === years.at(-1) || +fy.slice(0, 4) % 2 === 1 ? fy : "") },
    x: { axis: null, domain: G.map(([g]) => g), padding: 0.1 },
    y: { label: "↑ net profit, ₹ lakh crore", labelAnchor: "top", labelArrow: false, domain: [yMin, yMax], ticks: yt, tickFormat: (v) => (v < 0 ? "−" + Math.abs(v) : String(v)), tickSize: 0, tickPadding: 8 },
    marks: [
      Plot.gridY(yt.filter((v) => v !== 0), { stroke: GRID }),
      Plot.barY(rows, { fx: "fy", x: "g", y: "v", fill: "c" }),
      Plot.ruleY([0], { stroke: ZERO }),
    ],
  });
  host?.append(plot);
  const i = D.profit.years.length - 1;
  const allP = D.profit.all.map((v, j) => [D.profit.years[j], v]).filter(([, v]) => v != null);
  const worst = allP.reduce((p, c) => (c[1] < p[1] ? c : p));
  a11y(plot, "Net profit of India's banks by bank group, each financial year", `In ${fyOf(D.profit.years[i])} all banks earned ${lakhCrore(D.profit.all[i])}; the worst year was ${fyOf(worst[0])}.`);
  setHTML("pv-profit", lakhCrore(D.profit.all[i]));
  setHTML("ex-p-fy", fyOf(D.profit.years[i])); setHTML("ex-p-all", lakhCrore(D.profit.all[i])); setHTML("ex-p-psb", lakhCrore(D.profit.psb[i])); setHTML("ex-p-pvt", lakhCrore(D.profit.private[i]));
  setHTML("ex-p-wfy", fyOf(worst[0])); setHTML("ex-p-w", crore(-worst[1]));
  wirePlate("cb-profit", plot, "india-atlas_bank-profit-by-group", csvOf(["financial_year", ...["all", "psb", "private", "foreign", "sfb"].map((g) => `${g}_net_profit_inr_crore`)], D.profit.years.map((d, j) => [fyOf(d), ...["all", "psb", "private", "foreign", "sfb"].map((g) => D.profit[g][j])])));
}
{
  const list = [{ key: "psb", label: "Public sector", color: ACC }, { key: "private", label: "Private sector", color: GOLD }, { key: "foreign", label: "Foreign", color: G2 }, { key: "all", label: "All banks", color: INK, lead: true }]
    .map((s) => ({ ...s, data: pts(healthPairs(`${s.key}_crar`)) }));
  const plot = lines("plot-capital", list, { yDomain: [8, 22], yTicks: [8, 10, 12, 14, 16, 18, 20, 22], yFmt: (v) => v + (v === 22 ? "%" : ""), yLabel: "↑ capital, per cent of risk-weighted assets", xTicks: yearTicks(2014, +L.slice(0, 4), 1), labelFmt: fmt.pct2,
    extra: [Plot.ruleY([11.5], { stroke: G1, strokeDasharray: "4,3" }), Plot.text([{ date: toDate(D.healthDates[0]), value: 11.5 }], { x: "date", y: "value", text: ["Minimum with buffer, 11.5%"], dy: 12, textAnchor: "start", fill: G1, fontSize: 12 })] });
  const lows = ["psb", "private", "foreign"].map((g) => healthPairs(`${g}_crar`).reduce((p, c) => (c[1] < p[1] ? c : p)).concat(g));
  const lo = lows.reduce((p, c) => (c[1] < p[1] ? c : p));
  a11y(plot, "Capital adequacy of India's banks by bank group", `All banks held capital of ${fmt.pct2(lastH("all_crar"))} of risk-weighted assets in ${monthOf(L)}.`);
  setHTML("pv-capital", fmt.pct2(lastH("all_crar")));
  setHTML("ex-c-all", fmt.pct2(lastH("all_crar"))); setHTML("ex-c-psb", fmt.pct2(lastH("psb_crar"))); setHTML("ex-c-pvt", fmt.pct2(lastH("private_crar"))); setHTML("ex-c-for", fmt.pct2(lastH("foreign_crar")));
  setHTML("ex-c-lo", fmt.pct2(lo[1])); setHTML("ex-c-lod", `${{ psb: "public sector banks", private: "private sector banks", foreign: "foreign banks" }[lo[2]]}, ${monthOf(lo[0])}`);
  wirePlate("cb-capital", plot, "india-atlas_bank-capital-by-group", pairsCsv(["all", "psb", "private", "foreign", "sfb"].map((g) => [`${g}_crar_pct`, healthPairs(`${g}_crar`)])));
}
{
  const M = D.margins;
  const list = [{ label: "Yield on funds", color: G2, data: pts(M.yield) }, { label: "Cost of funds", color: GOLD, data: pts(M.cost) }, { label: "Net interest margin", color: ACC, lead: true, data: pts(M.nim) }];
  const plot = lines("plot-margins", list, { yDomain: [0, 12], yTicks: [0, 2, 4, 6, 8, 10, 12], yFmt: (v) => v + (v === 12 ? "%" : ""), yLabel: "↑ per cent, annualised", xTicks: yearTicks(2014, +L.slice(0, 4), 1), labelFmt: fmt.pct2 });
  a11y(plot, "Banks' cost of funds, yield and net interest margin", `Yield ${fmt.pct2(M.yield.at(-1)[1])}, cost ${fmt.pct2(M.cost.at(-1)[1])}, margin ${fmt.pct2(M.nim.at(-1)[1])} in ${monthOf(M.nim.at(-1)[0])}.`);
  setHTML("pv-margins", fmt.pct2(M.nim.at(-1)[1]));
  setHTML("ex-m-y", fmt.pct2(M.yield.at(-1)[1])); setHTML("ex-m-c", fmt.pct2(M.cost.at(-1)[1])); setHTML("ex-m-n", fmt.pct2(M.nim.at(-1)[1]));
  setHTML("ex-m-d0", monthOf(M.yield[0][0])); setHTML("ex-m-y0", fmt.pct2(M.yield[0][1])); setHTML("ex-m-c0", fmt.pct2(M.cost[0][1]));
  wirePlate("cb-margins", plot, "india-atlas_bank-margins", pairsCsv([["yield_on_funds_pct", M.yield], ["cost_of_funds_pct", M.cost], ["net_interest_margin_pct", M.nim]]));
}

/* ======================================================================================
 * § 07 bank by bank
 * ==================================================================================== */
{
  const host = document.getElementById("plot-bank-npa");
  const rows = D.lenders.filter((r) => r.now != null);
  const xMax = niceMax(Math.max(...rows.map((r) => Math.max(r.now, r.peak ?? 0))) * 1.08);
  const ml = 230, mr = 150, rowH = 30;
  const upx = xMax / (W - ml - mr);
  // value labels outside the pair: left of the lower dot when the peak is to the right, else right
    const plot = Plot.plot({
    width: W, height: 40 + rows.length * rowH, marginLeft: ml, marginRight: mr, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, xMax], ticks: ticksTo(xMax, 5), tickFormat: (x) => x + (x === xMax ? "%" : ""), tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(ticksTo(xMax, 5).filter((v) => v), { stroke: GRID }),
      Plot.ruleY(rows.filter((r) => r.peak != null), { y: "name", x1: "now", x2: "peak", stroke: G3, strokeWidth: 1.5 }),
      Plot.dot(rows.filter((r) => r.peak != null), { y: "name", x: "peak", r: 4, fill: "#fff", stroke: G1, strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "name", x: "now", r: 4.5, fill: (d) => GROUPCOL[d.group] ?? G2 }),
      // one label per row, after both dots: the latest value, then the 2018 one
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.now, d.peak ?? 0), text: (d) => (d.peak != null ? `${fmt.pct2(d.now)}, from ${fmt.pct2(d.peak)}` : fmt.pct2(d.now)), dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.ruleX([0], { stroke: ZERO }),
    ],
  });
  void upx;
  host?.append(plot);
  const hi = rows.reduce((p, c) => (c.now > p.now ? c : p)), lo = rows.reduce((p, c) => (c.now < p.now ? c : p));
  a11y(plot, "Bad loans of the twenty largest banks, now and in March 2018", rows.map((r) => `${r.name} ${fmt.pct2(r.now)}`).join(", "));
  setHTML("pv-bank-npa", fmt.pct2(hi.now));
  setHTML("ex-bn-hi", hi.name); setHTML("ex-bn-hiv", fmt.pct2(hi.now)); setHTML("ex-bn-lo", lo.name); setHTML("ex-bn-lov", fmt.pct2(lo.now));
  setHTML("ex-bn-n", fmt.count(D.nBig)); setHTML("ex-bn-x", D.npaHigh.name); setHTML("ex-bn-xv", fmt.pct2(D.npaHigh.v));
  wirePlate("cb-bank-npa", plot, "india-atlas_bank-bad-loans-largest-banks", csvOf(["bank", "group", `gross_advances_${D.aqLatest}_inr_crore`, `gnpa_ratio_${D.aqLatest}_pct`, `gnpa_ratio_${D.peakIso}_pct`], D.lenders.map((r) => [r.name, r.group, r.adv, r.now, r.peak])));
}
{
  const rows = D.lenders.filter((r) => r.roa != null).map((r) => ({ ...r, v: r.roa })).sort((a, b) => b.v - a.v);
  const xMax = niceMax(Math.max(...rows.map((r) => r.v)) * 1.08);
  const xMin = Math.min(0, ...rows.map((r) => r.v));
  const plot = hbars("plot-bank-roa", rows, { valueFmt: fmt.pct2, color: (d) => GROUPCOL[d.group] ?? G3, xDomain: [xMin, xMax], xTicks: ticksTo(xMax, 5), xFmt: (x) => x + (x === xMax ? "%" : ""), ml: 230, rowH: 30 });
  const sbi = rows.find((r) => r.id === "state_bank_of_india");
  a11y(plot, "Return on assets of the twenty largest banks", rows.map((r) => `${r.name} ${fmt.pct2(r.v)}`).join(", "));
  setHTML("pv-bank-roa", fmt.pct2(rows[0].v));
  setHTML("ex-r-hi", rows[0].name); setHTML("ex-r-hiv", fmt.pct2(rows[0].v)); setHTML("ex-r-lo", rows.at(-1).name); setHTML("ex-r-lov", fmt.pct2(rows.at(-1).v)); setHTML("ex-r-sbi", sbi ? fmt.pct2(sbi.v) : "–");
  wirePlate("cb-bank-roa", plot, "india-atlas_bank-return-on-assets", csvOf(["bank", "group", `return_on_assets_${D.aqLatest}_pct`, `net_interest_margin_${D.aqLatest}_pct`], rows.map((r) => [r.name, r.group, r.v, r.nim])));
}
{
  const COL = { state_bank_of_india: ACC, hdfc_bank_ltd: GOLD };
  const list = D.mergers.map((m) => ({ label: m.name, color: COL[m.id] ?? G2, lead: m.id === "state_bank_of_india", data: pts(m.data) }));
  const yMax = Math.ceil(Math.max(...list.flatMap((s) => s.data.map((p) => p.value))) / 10) * 10;
  // the merger quarters: a dot on the acquirer's line at the first quarter that includes the absorbed bank
  const MQ = { state_bank_of_india: "2017-06-01", hdfc_bank_ltd: "2023-09-01", bank_of_baroda: "2019-06-01", punjab_national_bank: "2020-06-01", canara_bank: "2020-06-01", union_bank_of_india: "2020-06-01" };
  const steps = D.mergers.map((m) => { const p = m.data.find(([d]) => d === MQ[m.id]); return p ? { date: toDate(p[0]), value: p[1], c: COL[m.id] ?? G2 } : null; }).filter(Boolean);
  const plot = lines("plot-mergers", list, { yDomain: [0, yMax], yTicks: ticksTo(yMax, yMax / 10), yFmt: (v) => String(v), yLabel: "↑ deposits in India, ₹ lakh crore", xTicks: yearTicks(2014, +L.slice(0, 4), 1), labelFmt: (v) => "₹" + v.toFixed(1), mr: 260,
    extra: [Plot.dot(steps, { x: "date", y: "value", r: 5, fill: "#fff", stroke: "c", strokeWidth: 1.75 })] });
  const v = (id) => D.mergers.find((m) => m.id === id).data.at(-1)[1];
  a11y(plot, "Deposits of the banks that absorbed others", list.map((s) => `${s.label} ₹${s.data.at(-1).value.toFixed(1)} lakh crore`).join(", "));
  setHTML("pv-mergers", fmt.lc1(v("state_bank_of_india")));
  setHTML("ex-mg-sbi", fmt.lc1(v("state_bank_of_india"))); setHTML("ex-mg-hdfc", fmt.lc1(v("hdfc_bank_ltd"))); setHTML("ex-mg-pnb", fmt.lc1(v("punjab_national_bank")));
  setHTML("ex-mg-can", fmt.lc1(v("canara_bank"))); setHTML("ex-mg-bob", fmt.lc1(v("bank_of_baroda"))); setHTML("ex-mg-ubi", fmt.lc1(v("union_bank_of_india")));
  wirePlate("cb-mergers", plot, "india-atlas_bank-mergers-deposits", pairsCsv(D.mergers.map((m) => [`${m.id}_deposits_inr_lakh_crore`, m.data])));
}

/* ======================================================================================
 * § 08 which loans go bad
 * ==================================================================================== */
{
  const COL = { Industry: ACC, Agriculture: GOLD, Services: G1, "Retail loans": G2 };
  const list = D.sector.map((s) => ({ label: s.name, color: COL[s.name], lead: s.name === "Industry", data: pts(s.data) }));
  const yMax = Math.ceil(Math.max(...list.flatMap((s) => s.data.map((p) => p.value))) / 5) * 5;
  const plot = lines("plot-sector-npa", list, { yDomain: [0, yMax], yTicks: ticksTo(yMax, yMax / 5), yFmt: (v) => v + (v === yMax ? "%" : ""), yLabel: "↑ gross NPAs, per cent of gross advances", xTicks: yearTicks(2014, +L.slice(0, 4), 1), labelFmt: fmt.pct2 });
  const S = Object.fromEntries(D.sector.map((s) => [s.name, s.data]));
  const ind = S.Industry, indPk = ind.reduce((p, c) => (c[1] > p[1] ? c : p));
  a11y(plot, "Bad loans by sector of the borrower", D.sector.map((s) => `${s.name} ${fmt.pct2(s.data.at(-1)[1])}`).join(", "));
  setHTML("pv-sector-npa", fmt.pct2(ind.at(-1)[1]));
  setHTML("ex-sn-ind", fmt.pct2(ind.at(-1)[1])); setHTML("ex-sn-indpk", `${fmt.pct2(indPk[1])}, ${monthOf(indPk[0])}`); setHTML("ex-sn-agr", fmt.pct2(S.Agriculture.at(-1)[1])); setHTML("ex-sn-ser", fmt.pct2(S.Services.at(-1)[1])); setHTML("ex-sn-ret", fmt.pct2(S["Retail loans"].at(-1)[1]));
  setHTML("ex-sn-psl", fmt.pct2(D.priority.psl.at(-1)[1])); setHTML("ex-sn-non", fmt.pct2(D.priority.non.at(-1)[1])); setHTML("ex-sn-mse", fmt.pct2(D.priority.mse.at(-1)[1]));
  wirePlate("cb-sector-npa", plot, "india-atlas_bad-loans-by-sector", pairsCsv([...D.sector.map((s) => [`${s.k}_pct`, s.data]), ["priority_sector_gnpa_ratio_pct", D.priority.psl], ["other_than_priority_gnpa_ratio_pct", D.priority.non], ["priority_mse_gnpa_ratio_pct", D.priority.mse]]));
}
{
  const rows = D.retail.filter((r) => r.ratio != null).map((r) => ({ ...r, v: r.ratio })).sort((a, b) => b.v - a.v);
  const xMax = niceMax(Math.max(...rows.map((r) => Math.max(r.v, r.peak))) * 1.05);
  const plot = hbars("plot-retail-npa", rows, { valueFmt: fmt.pct2, color: () => ACC, xDomain: [0, xMax], xTicks: ticksTo(xMax, 5), xFmt: (x) => x + (x === xMax ? "%" : ""), dot: "peak", ml: 200 });
  const g = (k) => D.retail.find((r) => r.k === k);
  a11y(plot, "Bad loans by type of retail loan", rows.map((r) => `${r.name} ${fmt.pct2(r.v)}`).join(", "));
  setHTML("pv-retail-npa", fmt.pct2(g("retail_loans_credit_card_receivables").ratio));
  setHTML("ex-rn-card", fmt.pct2(g("retail_loans_credit_card_receivables").ratio)); setHTML("ex-rn-veh", fmt.pct2(g("retail_loans_vehicle_auto_loans").ratio));
  setHTML("ex-rn-edu", fmt.pct2(g("retail_loans_education").ratio)); setHTML("ex-rn-edupk", fmt.pct2(g("retail_loans_education").peak)); setHTML("ex-rn-home", fmt.pct2(g("retail_loans_housing_loans").ratio));
  setHTML("ex-rn-homeamt", lakhCrore(g("retail_loans_housing_loans").adv));
  wirePlate("cb-retail-npa", plot, "india-atlas_bad-loans-retail", csvOf(["loan_type", `gnpa_ratio_${D.sectorLatest}_pct`, "highest_since_2013_pct", `gross_advances_${D.sectorLatest}_inr_crore`], D.retail.map((r) => [r.name, r.ratio, r.peak, r.adv])));
}
{
  const rows = D.infra.map((r) => ({ ...r, v: r.v / 1e5 }));
  const xMax = niceMax(Math.max(...rows.map((r) => r.v)) * 1.1);
  const plot = hbars("plot-infra", rows, { valueFmt: (v) => "₹" + v.toFixed(2) + " lakh crore", color: (d) => (d === rows[0] ? ACC : G3), xDomain: [0, xMax], xTicks: ticksTo(xMax, 5), xFmt: (x) => String(x), ml: 300, mr: 170 });
  const tot = D.infraTotal;
  const sh = (re) => { const r = D.infra.find((x) => re.test(x.name)); return r && tot ? fmt.pct1((100 * r.v) / tot) : "–"; };
  a11y(plot, "Bank lending to infrastructure by sector", rows.map((r) => `${r.name} ₹${r.v.toFixed(2)} lakh crore`).join(", "));
  setHTML("pv-infra", lakhCrore(tot));
  setHTML("ex-i-en", sh(/^Energy/)); setHTML("ex-i-tr", sh(/^Transport/)); setHTML("ex-i-co", sh(/^Communication/));
  wirePlate("cb-infra", plot, "india-atlas_bank-infrastructure-lending", csvOf(["sector", `outstanding_${D.infraLatest}_inr_crore`], D.infra.map((r) => [r.name, r.v])));
}

/* ======================================================================================
 * § 09 branches
 * ==================================================================================== */
{
  const COL = { rural: ACC, semi_urban: GOLD, urban: G1, metropolitan: G2 };
  const list = D.branches.map((b) => ({ label: b.name, color: COL[b.k] ?? G3, lead: b.k === "rural", data: pts(b.data) }));
  const yMax = Math.ceil(Math.max(...list.flatMap((s) => s.data.map((p) => p.value))) / 10000) * 10000;
  const y0 = +D.branches[0].data[0][0].slice(0, 4);
  const plot = lines("plot-branches", list, { yDomain: [0, yMax], yTicks: ticksTo(yMax, yMax / 10000), yFmt: (v) => fmt.inr(v), yLabel: "↑ branches", xTicks: yearTicks(1970, +L.slice(0, 4), 5), labelFmt: (v) => fmt.inr(v), mr: 210,
    dateFmt: (d) => `March ${d.getUTCFullYear()}` });
  const last = (k) => D.branches.find((b) => b.k === k).data.at(-1)[1];
  const tot = ["rural", "semi_urban", "urban", "metropolitan"].reduce((a, k) => a + last(k), 0);
  a11y(plot, `Bank branches by population group since ${y0}`, list.map((s) => `${s.label} ${fmt.inr(s.data.at(-1).value)}`).join(", "));
  setHTML("pv-branches", fmt.inr(last("rural")));
  setHTML("ex-br-r", fmt.inr(last("rural"))); setHTML("ex-br-s", fmt.inr(last("semi_urban"))); setHTML("ex-br-u", fmt.inr(last("urban"))); setHTML("ex-br-m", fmt.inr(last("metropolitan")));
  setHTML("ex-br-rs", fmt.pct1((100 * (last("rural") + last("semi_urban"))) / tot));
  wirePlate("cb-branches", plot, "india-atlas_bank-branches-by-place", pairsCsv(D.branches.map((b) => [b.k, b.data])));
}
{
  const rows = D.offices.map((r) => ({ ...r, name: r.name.replace(/, Branch$/, ""), v: r.v, was: r.v0 }));
  const xMax = niceMax(Math.max(...rows.map((r) => r.v)) * 1.08);
  const plot = hbars("plot-offices", rows, { valueFmt: (v) => fmt.inr(v), color: (d) => (d.k.startsWith("public") ? ACC : d.k.startsWith("private") ? GOLD : G3), xDomain: [0, xMax], xTicks: ticksTo(xMax, 5), xFmt: (x) => fmt.inr(x), dot: "was", ml: 210 });
  const g = (re) => rows.find((r) => re.test(r.k));
  a11y(plot, "Bank branches by bank group", rows.map((r) => `${r.name} ${fmt.inr(r.v)}`).join(", "));
  setHTML("pv-offices", fmt.inr(g(/^public/).v));
  setHTML("ex-of-psb", fmt.inr(g(/^public/).v)); setHTML("ex-of-psb0", fmt.inr(g(/^public/).was)); setHTML("ex-of-d0", monthOf(D.officesFirst));
  setHTML("ex-of-pvt", fmt.inr(g(/^private/).v)); setHTML("ex-of-pvt0", fmt.inr(g(/^private/).was)); setHTML("ex-of-rrb", fmt.inr(g(/^regional/).v)); setHTML("ex-of-sfb", fmt.inr(g(/^small/).v));
  wirePlate("cb-offices", plot, "india-atlas_bank-branches-by-group", csvOf(["bank_group", `branches_${D.officesLatest}`, `branches_${D.officesFirst}`], rows.map((r) => [r.name, r.v, r.was])));
}

/* ======================================================================================
 * § 10 urban co-operative banks
 * ==================================================================================== */
{
  const host = document.getElementById("plot-ucb");
  const cnt = D.ucbCount.all.map(([d, v]) => ({ panel: "Number of banks", date: toDate(d), value: v }));
  const npaU = D.ucbNpa.all.map(([d, v]) => ({ panel: "Gross NPA ratio", date: toDate(d), value: v, s: "u" }));
  const npaS = D.scbMarchNpa.map(([d, v]) => ({ panel: "Gross NPA ratio", date: toDate(d), value: v, s: "s" }));
  // two panels on their own scales: drawn as two plots side by side in one SVG via Plot facets is not
  // possible with independent y, so the count panel is a separate plot appended before the ratio one
  const mk = (data, opt) => Plot.plot({ width: W / 2 - 8, height: 400, marginLeft: 52, marginRight: opt.mr, marginTop: 34, marginBottom: 34, style: baseStyle,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2014, +D.ucbCount.all.at(-1)[0].slice(0, 4), 4), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: opt.yl, labelAnchor: "top", labelArrow: false, domain: opt.dom, ticks: opt.ticks, tickFormat: opt.tf, tickSize: 0, tickPadding: 8 }, marks: opt.marks });
  const cMax = Math.ceil(Math.max(...cnt.map((p) => p.value)) / 500) * 500;
  const p1 = mk(cnt, { mr: 70, yl: "↑ urban co-operative banks", dom: [0, cMax], ticks: ticksTo(cMax, cMax / 500), tf: (v) => fmt.inr(v), marks: [
    Plot.gridY(ticksTo(cMax, cMax / 500).filter((v) => v), { stroke: GRID }), Plot.rectY(cnt.map((p) => ({ ...p, x1: new Date(p.date.getTime() - 150 * 864e5), x2: new Date(p.date.getTime() + 150 * 864e5) })), { x1: "x1", x2: "x2", y: "value", fill: ACC }), Plot.ruleY([0], { stroke: ZERO }),
    Plot.text([cnt.at(-1)], { x: "date", y: "value", text: (d) => fmt.inr(d.value), dy: -10, fill: INK, fontSize: 12, fontWeight: 600 })] });
  const nMax = Math.ceil(Math.max(...npaU.map((p) => p.value), ...npaS.map((p) => p.value)) / 4) * 4;
  const p2 = mk(null, { mr: 190, yl: "↑ gross NPAs, per cent of advances", dom: [0, nMax], ticks: ticksTo(nMax, nMax / 2), tf: (v) => v + (v === nMax ? "%" : ""), marks: [
    Plot.gridY(ticksTo(nMax, nMax / 2).filter((v) => v), { stroke: GRID }), Plot.ruleY([0], { stroke: ZERO }),
    Plot.lineY(npaS, { x: "date", y: "value", stroke: G2, strokeWidth: 1.5 }), Plot.lineY(npaU, { x: "date", y: "value", stroke: ACC, strokeWidth: 2 }),
    Plot.dot([npaU.at(-1), npaS.at(-1)], { x: "date", y: "value", fill: (d) => (d.s === "u" ? ACC : G2), r: 3, stroke: "#fff", strokeWidth: 1.5 }),
    ...dodgeEndLabels([{ label: "UCBs", data: npaU }, { label: "Commercial banks", data: npaS }], nMax * 0.07).map((p) => Plot.text([{ date: p.s.data.at(-1).date, y: p.y }], { x: "date", y: "y", text: () => `${p.key} ${fmt.pct2(p.value)}`, dx: 9, textAnchor: "start", fill: INK, fontSize: 12 }))] });
  a11y(p1, "Number of urban co-operative banks", `${fmt.inr(cnt.at(-1).value)} banks in ${monthOf(D.ucbCount.all.at(-1)[0])}.`);
  a11y(p2, "Bad loans of urban co-operative banks and commercial banks", `Gross NPA ratio ${fmt.pct2(npaU.at(-1).value)} for urban co-operative banks, ${fmt.pct2(npaS.at(-1).value)} for commercial banks.`);
  // one SVG for downloads: the two panels side by side
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg"); svg.setAttribute("width", W); svg.setAttribute("height", 400); svg.setAttribute("viewBox", `0 0 ${W} 400`);
  const g2 = document.createElementNS(ns, "g"); g2.setAttribute("transform", `translate(${W / 2 + 8},0)`);
  svg.append(p1); g2.append(p2); svg.append(g2);
  host?.append(svg);
  const n = D.ucbCount.all.at(-1), n0 = D.ucbCount.all[0];
  a11y(svg, "Urban co-operative banks: how many, and their bad loans", `${fmt.inr(n[1])} banks in ${monthOf(n[0])}, against ${fmt.inr(n0[1])} in ${monthOf(n0[0])}; gross NPA ratio ${fmt.pct2(D.ucbNpa.all.at(-1)[1])}.`);
  setHTML("pv-ucb", fmt.inr(n[1]));
  setHTML("ex-u-n", fmt.inr(n[1])); setHTML("ex-u-n0", fmt.inr(n0[1])); setHTML("ex-u-d0", monthOf(n0[0])); setHTML("ex-u-sch", fmt.inr(D.ucbCount.scheduled.at(-1)[1]));
  setHTML("ex-u-npa", fmt.pct2(D.ucbNpa.all.at(-1)[1])); setHTML("ex-u-scb", fmt.pct2(D.scbMarchNpa.at(-1)[1])); setHTML("ex-u-non", fmt.pct2(D.ucbNpa.non.at(-1)[1]));
  wirePlate("cb-ucb", svg, "india-atlas_urban-cooperative-banks", pairsCsv([["ucbs_all", D.ucbCount.all], ["ucbs_scheduled", D.ucbCount.scheduled], ["ucbs_non_scheduled", D.ucbCount.non], ["ucb_gnpa_ratio_pct", D.ucbNpa.all], ["ucb_scheduled_gnpa_ratio_pct", D.ucbNpa.scheduled], ["ucb_non_scheduled_gnpa_ratio_pct", D.ucbNpa.non], ["scb_gnpa_ratio_march_pct", D.scbMarchNpa]]));
}
{
  const rows = D.ucbStates.slice(0, 12).map((r) => ({ ...r, v: r.dep }));
  const xMax = niceMax(Math.max(...rows.map((r) => r.v)) * 1.1);
  const tot = D.ucbStates.reduce((a, r) => a + r.dep, 0);
  const plot = hbars("plot-ucb-states", rows, { valueFmt: (v) => crore(v), color: (d) => (d === rows[0] ? ACC : G3), xDomain: [0, xMax], xTicks: ticksTo(xMax, 4), xFmt: (x) => fmt.inr(x), ml: 200, mr: 170, rowH: 30 });
  const g = (s) => D.ucbStates.find((r) => r.state === s);
  const few = D.ucbStates.filter((r) => (r.ucbs ?? 0) <= 1).length;
  a11y(plot, "Deposits of urban co-operative banks by state", rows.map((r) => `${r.name} ${crore(r.v)}`).join(", "));
  setHTML("pv-ucb-states", fmt.pct1((100 * g("maharashtra").dep) / tot));
  setHTML("ex-us-mh", crore(g("maharashtra").dep)); setHTML("ex-us-mhn", fmt.inr(g("maharashtra").ucbs)); setHTML("ex-us-gj", crore(g("gujarat").dep)); setHTML("ex-us-ka", crore(g("karnataka").dep));
  setHTML("ex-us-none", fmt.count(few));
  wirePlate("cb-ucb-states", plot, "india-atlas_urban-cooperative-banks-by-state", csvOf(["state", `deposits_${D.ucbStatesLatest}_inr_crore`, "ucbs", "branches"], D.ucbStates.map((r) => [r.name, r.dep, r.ucbs, r.branches])));
}
{
  const rows = D.ucbRatings.map((r) => ({ name: `Rating ${r.r}`, r: r.r, v: r.v }));
  const xMax = niceMax(Math.max(...rows.map((r) => r.v)) * 1.1);
  const plot = hbars("plot-ucb-ratings", rows, { valueFmt: (v) => fmt.inr(v), color: (d) => (d.r === "D" || d.r === "E" ? ACC : G3), xDomain: [0, xMax], xTicks: ticksTo(xMax, 4), xFmt: (x) => fmt.inr(x), ml: 140, rowH: 34 });
  const R = Object.fromEntries(D.ucbRatings.map((r) => [r.r, r.v]));
  const tot = D.ucbRatings.reduce((a, r) => a + r.v, 0);
  const low = D.ucbCrar.filter((b) => /< ?9|< 3|< 6/.test(b.band) && !/9 <=/.test(b.band)).reduce((a, b) => a + b.v, 0);
  a11y(plot, "Urban co-operative banks by supervisory rating", rows.map((r) => `${r.name} ${r.v}`).join(", "));
  setHTML("pv-ucb-ratings", fmt.pct1((100 * ((R.D ?? 0) + (R.E ?? 0))) / tot));
  setHTML("ex-ur-a", fmt.inr(R.A)); setHTML("ex-ur-bp", fmt.inr(R["B+"])); setHTML("ex-ur-b", fmt.inr(R.B)); setHTML("ex-ur-c", fmt.inr(R.C)); setHTML("ex-ur-d", fmt.inr(R.D)); setHTML("ex-ur-e", fmt.inr(R.E));
  setHTML("ex-ur-low", fmt.inr(low));
  wirePlate("cb-ucb-ratings", plot, "india-atlas_urban-cooperative-banks-ratings", csvOf(["rating", `ucbs_${D.ucbRatingsLatest}`], rows.map((r) => [r.r, r.v])) + "\n\n" + csvOf(["crar_band", `ucbs_${D.ucbCrarLatest}`], D.ucbCrar.map((b) => [b.band, b.v])));
}

/* ======================================================================================
 * § 11 NBFCs, development banks, deposit insurance
 * ==================================================================================== */
{
  const N = Object.fromEntries(D.nbfc.map((r) => [r.k, r.v]));
  const K = [["retail_loans", "Retail loans"], ["industry", "Industry"], ["services", "Services"], ["agriculture_and_allied_activities", "Agriculture"], ["other_loans", "Other loans"]];
  const rows = K.filter(([k]) => N[k] != null).map(([k, name]) => ({ k, name, v: N[k] }));
  const xMax = niceMax(Math.max(...rows.map((r) => r.v)) * 1.1);
  const plot = hbars("plot-nbfc", rows, { valueFmt: (v) => fmt.lc1(v), color: (d) => (d === rows[0] ? ACC : G3), xDomain: [0, xMax], xTicks: ticksTo(xMax, 5), xFmt: (x) => String(x), ml: 160, mr: 170 });
  a11y(plot, "Credit from NBFCs by sector", rows.map((r) => `${r.name} ${fmt.lc1(r.v)}`).join(", "));
  setHTML("pv-nbfc", fmt.lc1(N.nbfc_credit));
  setHTML("ex-nb-ind", fmt.lc1(N.industry)); setHTML("ex-nb-inf", fmt.lc1(N.infrastructure)); setHTML("ex-nb-ret", fmt.lc1(N.retail_loans)); setHTML("ex-nb-ser", fmt.lc1(N.services));
  wirePlate("cb-nbfc", plot, "india-atlas_nbfc-credit-by-sector", csvOf(["sector", `credit_${D.nbfcLatest}_inr_lakh_crore`], D.nbfc.map((r) => [r.name, r.v])));
}
{
  const COL = { NABARD: ACC, SIDBI: GOLD, "EXIM Bank": G1, NHB: G2 };
  const list = D.fi.map((f) => ({ label: f.name, color: COL[f.name], lead: f.name === "NABARD", data: pts(f.data) }));
  const yMax = Math.ceil(Math.max(...list.flatMap((s) => s.data.map((p) => p.value))) / 2) * 2;
  const plot = lines("plot-fi", list, { yDomain: [0, yMax], yTicks: ticksTo(yMax, yMax / 2), yFmt: (v) => String(v), yLabel: "↑ total liabilities, ₹ lakh crore", xTicks: yearTicks(1990, +L.slice(0, 4), 5), labelFmt: (v) => "₹" + v.toFixed(1), mr: 200, dateFmt: (d) => `March ${d.getUTCFullYear()}` });
  const v = (n) => D.fi.find((f) => f.name === n).data.at(-1)[1];
  a11y(plot, "The development banks' balance sheets", list.map((s) => `${s.label} ₹${s.data.at(-1).value.toFixed(1)} lakh crore`).join(", "));
  setHTML("pv-fi", fmt.lc1(v("NABARD")));
  setHTML("ex-fi-nab", fmt.lc1(v("NABARD"))); setHTML("ex-fi-sid", fmt.lc1(v("SIDBI"))); setHTML("ex-fi-exim", fmt.lc1(v("EXIM Bank"))); setHTML("ex-fi-nhb", fmt.lc1(v("NHB")));
  wirePlate("cb-fi", plot, "india-atlas_development-banks", pairsCsv(D.fi.map((f) => [`${f.name}_total_liabilities_inr_lakh_crore`, f.data])));
}
{
  const data = D.insured.map(([d, ins, ass]) => ({ date: toDate(d), value: (100 * ins) / ass }));
  const plot = lines("plot-insured", [{ label: "Insured share", color: ACC, lead: true, data }], { yDomain: [0, 100], yTicks: [0, 20, 40, 60, 80, 100], yFmt: (v) => v + (v === 100 ? "%" : ""), yLabel: "↑ insured deposits, per cent of assessable deposits", xTicks: yearTicks(1965, +L.slice(0, 4), 5), labelFmt: fmt.pct1, mr: 170,
    extra: [Plot.ruleX([toDate("2020-02-01")], { stroke: G3, strokeDasharray: "2,3" }), Plot.text([{ date: toDate("2020-02-01"), value: 92 }], { x: "date", y: "value", text: ["Cover raised to ₹5 lakh"], dx: -8, textAnchor: "end", fill: G1, fontSize: 12 })] });
  const [d, ins, ass, acc, accAll] = D.insured.at(-1);
  a11y(plot, "Share of bank deposits covered by deposit insurance", `${fmt.pct1((100 * ins) / ass)} of assessable deposits were insured in ${monthOf(d)}.`);
  setHTML("pv-insured", fmt.pct1((100 * ins) / ass));
  setHTML("ex-in-amt", lakhCrore(ins)); setHTML("ex-in-ass", lakhCrore(ass)); setHTML("ex-in-sh", fmt.pct1((100 * ins) / ass)); setHTML("ex-in-acc", fmt.pct1((100 * acc) / accAll));
  wirePlate("cb-insured", plot, "india-atlas_deposit-insurance", csvOf(["date", "insured_deposits_inr_crore", "assessable_deposits_inr_crore", "insured_share_pct", "fully_protected_accounts", "all_accounts"], D.insured.map(([d, a, b, c, e]) => [d, a, b, ((100 * a) / b).toFixed(2), c, e])));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", D.vintage ?? "–");
setHTML("prov-vintage2", D.vintage ?? "–");
