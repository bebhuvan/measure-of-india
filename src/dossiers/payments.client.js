// Guide 26, how Indians pay: plates and number wiring.
// Data: the JSON block #payments-data, cut at build time by src/pages/guides/payments.astro from
// data/series/payments-*.json (RBI payment system statistics, scripts/lib/products/payments.mjs)
// and the credit guide's credit-money bundle (currency with the public). Volumes are counts of
// transactions and values are rupees, as the RBI stores them; plates scale them to crore and
// lakh crore. The old table (to October 2019) and the re-organised one are never joined.

import * as Plot from "@observablehq/plot";
import { MONO as sans, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, seamMarks, dodgeEndLabels, tint } from "../charts/plumbing.js";
import * as F from "./payments.fmt.js";

const P = JSON.parse(document.getElementById("payments-data")?.textContent || "{}");
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));
const D = (iso) => new Date(iso + "T00:00:00Z");
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const monShort = (d) => `${M3[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const fyOf = (iso) => `${+iso.slice(0, 4) - 1}-${iso.slice(2, 4)}`;            // "2026-03-01" -> "2025-26"
const fyD = (d) => fyOf(d.toISOString().slice(0, 10));
const yr = (d) => { const y = d.getUTCFullYear(); return y % 10 === 0 ? String(y) : "’" + String(y).slice(2); };
const ticksY = (from, to, step = 1) => { const out = []; for (let y = from; y <= to; y += step) out.push(new Date(Date.UTC(y, 0, 1))); return out; };
const niceMax = (v, step) => Math.ceil(v / step) * step;
const csvRows = (header, rows) => [header.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");
const ser = (dates, vals, k = 1) => dates.map((d, i) => ({ date: D(d), value: vals[i] == null ? null : vals[i] / k }));
const pub = (s) => s.filter((d) => d.value != null);
const lastPt = (s) => pub(s).at(-1);
const firstPt = (s) => pub(s)[0];
const CR = 1e7, LC = 1e12;

const M = P.m, L = M.dates.length - 1, Y = L - 12;
const mv = (k, i = L) => M[k]?.[i] ?? null;
const lastMonth = monthOf(M.dates[L]), yearAgoMonth = monthOf(M.dates[Y]), firstMonth = monthOf(M.dates[0]);

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  if (!el) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg" && plot) downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png" && plot) downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv()], { type: "text/csv" }), filename + ".csv");
  }));
}
const mount = (id, plot) => { document.getElementById(id)?.append(plot); return plot; };
// a labelled end dot for each line, labels dodged apart in data units
function endLabels(list, gap, fmtV, { bold = 0 } = {}) {
  const pts = dodgeEndLabels(list, gap);
  return [
    Plot.dot(pts.map((p) => lastPt(p.s.data)), { x: "date", y: "value", r: 3, fill: (d, i) => pts[i].s.color, stroke: "#fff", strokeWidth: 1.5 }),
    Plot.text(pts.map((p) => ({ date: lastPt(p.s.data).date, y: p.y, t: `${p.key} ${fmtV(p.value)}`, b: p.s === list[bold] })), { x: "date", y: "y", text: "t", dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.b ? 600 : 400) }),
  ];
}
// small-multiple panel: a titled cell with its own small plot
function panel(grid, name, sub, valueText, plot) {
  const div = document.createElement("div");
  div.className = "sm-panel";
  div.innerHTML = `<div class="sm-t">${name}${sub ? `<small>${sub}</small>` : ""}</div><div class="sm-v">${valueText}</div>`;
  plot.setAttribute("aria-hidden", "true");
  div.append(plot);
  grid?.append(div);
  return div;
}
function miniLine(data, { color = ACC, w = 280, h = 120, xTicks, yMax } = {}) {
  const top = yMax ?? Math.max(...pub(data).map((d) => d.value));
  return Plot.plot({
    width: w, height: h, marginLeft: 4, marginRight: 8, marginTop: 8, marginBottom: 20, style: { ...baseStyle, fontSize: "11px" },
    x: { label: null, tickSize: 0, ticks: xTicks ?? [2020, 2023, 2026].map((y) => new Date(Date.UTC(y, 0, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { axis: null, domain: [0, top * 1.08] },
    marks: [
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(data, { x: "date", y: "value", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([lastPt(data)], { x: "date", y: "value", r: 3, fill: color, stroke: "#fff", strokeWidth: 1.5 }),
    ],
  });
}

/* ---------- title block and § 01 ---------- */
const upiN = mv("upi_volume"), upiV = mv("upi_value"), T = P.t;
const upiAvg = T.upi.at(-1);
// big numerals carry their unit in the small .pc span (atlas.css), as every guide's do
const pcU = (txt) => txt.replace(/^(₹?[\d,.]+)( .+)$/, '$1<span class="pc">$2</span>');
setHTML("n-upi", pcU(F.crore(upiN)));
setHTML("d-upi", `<b>${F.growth(upiN, mv("upi_volume", Y))}</b> on ${yearAgoMonth}`);
setHTML("n-upiv", pcU(F.lakhCrore(upiV)));
setHTML("d-upiv", `<b>${F.growth(upiV, mv("upi_value", Y))}</b> on ${yearAgoMonth}`);
setHTML("n-avg", F.rupees(upiAvg));
setHTML("d-avg", `<b>${F.rupees(T.upi[0])}</b> in ${firstMonth}`);
setHTML("n-atm", pcU(F.crore(mv("atm_cash_volume"))));
setHTML("d-atm", `<b>${F.growth(mv("atm_cash_volume"), mv("atm_cash_volume", Y))}</b> on ${yearAgoMonth}`);
spark("nspark-upi", { data: ser(M.dates, M.upi_volume), color: ACC });
setHTML("rb-upi", pcU(F.crore(upiN)));
setHTML("rb-share", F.share(upiN, mv("retail_total_volume")));
setHTML("mr-avg", F.rupees(upiAvg));
setHTML("prov-vintage", P.vintage);
setHTML("prov-vintage2", P.vintage);

/* ---------- § 02 what one payment is worth ---------- */
const lakhRs = (v) => (v >= 1e5 ? "₹" + (v / 1e5).toFixed(1) + " lakh" : F.rupees(v));
{
  const SYS = [["UPI", "upi"], ["Wallets", "ppi_wallets"], ["FASTag toll (NETC)", "netc"], ["UPI on a basic phone (USSD)", "upi_ussd"], ["Benefit credit (APBS)", "apbs"],
    ["Cash at a micro ATM (AePS)", "microatm_cash"], ["Debit card", "debit_cards"], ["Credit card", "credit_cards"], ["BHIM Aadhaar Pay", "bhim_aadhaar_pay"],
    ["Cash from an ATM", "atm_cash"], ["NACH debit (EMIs, SIPs)", "nach_dr"], ["NACH credit (salaries, pensions)", "nach_cr"], ["IMPS", "imps"], ["NEFT", "neft"],
    ["Cheque", "paper"], ["RTGS", "rtgs"]];
  const rows = SYS.map(([name, k]) => ({ name, k, v: T[k]?.at(-1) })).filter((r) => r.v != null && r.v > 0).sort((a, b) => a.v - b.v);
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 30, marginLeft: 250, marginRight: 120, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { type: "log", domain: [50, 1e8], ticks: [100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8], tickFormat: (v) => ({ 100: "₹100", 1000: "₹1,000", 10000: "₹10,000", 100000: "₹1 lakh", 1000000: "₹10 lakh", 10000000: "₹1 crore", 100000000: "₹10 crore" }[v] ?? ""), tickSize: 0, tickPadding: 8, label: null },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX([100, 1e3, 1e4, 1e5, 1e6, 1e7, 1e8], { stroke: GRID }),
      Plot.ruleY(rows, { y: "name", x1: 50, x2: "v", stroke: (d) => (d.k === "upi" ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "name", x: "v", r: 4.5, fill: (d) => (d.k === "upi" ? ACC : G1), stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text(rows, { y: "name", x: "v", text: (d) => lakhRs(d.v), dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.k === "upi" ? 600 : 400) }),
    ],
  });
  a11y(plot, "Average value of one transaction by payment system", rows.map((r) => `${r.name} ${lakhRs(r.v)}`).join(", "));
  mount("plot-ticket", plot);
  const at = (k) => T[k].at(-1);
  setHTML("h-ticket", `An average UPI payment is ${F.rupees(at("upi"))}; an average RTGS transfer is ${lakhRs(at("rtgs"))}`);
  setHTML("pv-ticket", F.rupees(at("upi")));
  setHTML("ex-tk-upi", F.rupees(at("upi")));
  setHTML("ex-tk-dc", F.rupees(at("debit_cards")));
  setHTML("ex-tk-cc", F.rupees(at("credit_cards")));
  setHTML("ex-tk-atm", F.rupees(at("atm_cash")));
  setHTML("ex-tk-netc", F.rupees(at("netc")));
  setHTML("ex-tk-neft", F.rupees(at("neft")));
  setHTML("ex-tk-chq", lakhRs(at("paper")));
  setHTML("ex-tk-rtgs", lakhRs(at("rtgs")));
  wirePlate("cb-ticket", plot, "india-atlas_payments-average-size", () => csvRows(["system", "series", `average_inr_${M.dates[L].slice(0, 7)}`], rows.map((r) => [r.name, r.k, r.v])));
}
{
  const s = { label: "Average UPI payment", color: ACC, data: ser(T.dates, T.upi) };
  const vals = pub(s.data), mx = vals.reduce((a, d) => (d.value > a.value ? d : a)), top = niceMax(mx.value * 1.1, 500);
  const e = lastPt(s.data);
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 56, marginRight: 150, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(2020, 2026), tickFormat: yr },
    y: { label: "↑ rupees per payment", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => "₹" + v.toLocaleString("en-IN") },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([e], { x: "date", y: "value", r: 3.5, fill: ACC, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([e], { x: "date", y: "value", text: () => F.rupees(e.value), dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "Average value of one UPI payment", `${F.rupees(vals[0].value)} in ${firstMonth}, ${F.rupees(e.value)} in ${lastMonth}, highest ${F.rupees(mx.value)} in ${monShort(mx.date)}.`);
  mount("plot-upi-ticket", plot);
  addCrosshair(document.getElementById("plot-upi-ticket"), plot, [s], null, monShort, (v) => (v == null ? "—" : F.rupees(v)));
  setHTML("pv-upi-ticket", F.rupees(e.value));
  setHTML("ex-ut-now", F.rupees(e.value));
  setHTML("ex-ut-first", F.rupees(vals[0].value));
  setHTML("ex-ut-max", F.rupees(mx.value));
  setHTML("ex-ut-maxm", monthOf(mx.date.toISOString().slice(0, 10)));
  wirePlate("cb-upi-ticket", plot, "india-atlas_payments-average-upi", () => csvRows(["month", "average_upi_payment_inr"], T.dates.map((d, i) => [d, T.upi[i]])));
}

/* ---------- § 04 UPI and everything else ---------- */
{
  const upi = { label: "UPI", color: ACC, data: ser(M.dates, M.upi_volume, CR) };
  const rest = { label: "All other retail", color: G2, data: M.dates.map((d, i) => ({ date: D(d), value: M.retail_total_volume[i] == null || M.upi_volume[i] == null ? null : (M.retail_total_volume[i] - M.upi_volume[i]) / CR })) };
  const top = niceMax(Math.max(...pub(upi.data).map((d) => d.value)) * 1.08, 500);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 56, marginRight: 230, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(2020, 2026), tickFormat: yr },
    y: { label: "↑ crore payments a month", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => v.toLocaleString("en-IN") },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(rest.data, { x: "date", y: "value", stroke: G2, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.lineY(upi.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...endLabels([upi, rest], top * 0.06, (v) => v.toLocaleString("en-IN", { maximumFractionDigits: 0 }) + " crore"),
    ],
  });
  a11y(plot, "UPI payments and all other retail payments a month", `UPI ${F.crore(upiN)} in ${lastMonth}; all other retail systems ${F.crore(mv("retail_total_volume") - upiN)}.`);
  mount("plot-upi", plot);
  addCrosshair(document.getElementById("plot-upi"), plot, [upi, rest], null, monShort, (v) => (v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + " crore"));
  setHTML("pv-upi", F.crore(upiN));
  setHTML("ex-upi-n", F.crore(upiN));
  setHTML("ex-upi-v", F.lakhCrore(upiV));
  setHTML("ex-upi-n0", F.crore(M.upi_volume[0]));
  setHTML("ex-upi-rest", F.crore(mv("retail_total_volume") - upiN));
  setHTML("ex-upi-g", F.growth(upiN, mv("upi_volume", Y)));
  wirePlate("cb-upi", plot, "india-atlas_payments-upi-vs-rest", () => csvRows(["month", "upi_payments", "all_other_retail_payments", "upi_value_inr"], M.dates.map((d, i) => [d, M.upi_volume[i], M.retail_total_volume[i] == null ? null : M.retail_total_volume[i] - M.upi_volume[i], M.upi_value[i]])));
}
{
  const GROUPS = [["UPI", ["upi"]], ["Cards", ["cards"]], ["Wallets and prepaid cards", ["ppi"]], ["IMPS", ["imps"]], ["NEFT", ["neft"]],
    ["Bulk and Aadhaar", ["nach_cr", "nach_dr", "apbs", "aeps_transfer", "bhim_aadhaar_pay", "ecs_cr", "ecs_dr", "netc"]], ["Cheques", ["paper"]], ["RTGS", ["rtgs"]]];
  const sum = (keys, f) => keys.reduce((a, k) => a + (mv(`${k}_${f}`) ?? 0), 0);
  const tot = { volume: mv("total_volume"), value: mv("total_value") };
  const rows = (f) => GROUPS.map(([name, keys]) => ({ name, v: (100 * sum(keys, f)) / tot[f], upi: name === "UPI", rtgs: name === "RTGS" }));
  const grid = document.getElementById("plot-share");
  const plots = [];
  for (const [f, title, sub] of [["volume", "Of every 100 payments", "share of the number of payments"], ["value", "Of every ₹100 paid", "share of the money"]]) {
    const R = rows(f);
    const plot = Plot.plot({
      width: 560, height: 40 + R.length * 34, marginLeft: 250, marginRight: 64, marginTop: 10, marginBottom: 26, style: baseStyle,
      x: { domain: [0, 100], ticks: [0, 50, 100], tickFormat: (v) => v + "%", tickSize: 0, tickPadding: 6, label: null },
      y: { label: null, domain: R.map((r) => r.name), tickSize: 0, tickPadding: 12 },
      marks: [
        Plot.gridX([50, 100], { stroke: GRID }),
        Plot.barX(R, { y: "name", x: "v", fill: (d) => (d.upi || (f === "value" && d.rtgs) ? ACC : G3), insetTop: 9, insetBottom: 9 }),
        Plot.text(R, { y: "name", x: "v", text: (d) => d.v.toFixed(1) + "%", dx: 6, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (d.upi ? 600 : 400) }),
        Plot.ruleX([0], { stroke: BASE }),
      ],
    });
    a11y(plot, title, R.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
    panel(grid, title, `${sub}, ${lastMonth}`, "", plot).querySelector("svg").removeAttribute("aria-hidden");
    plots.push(plot);
  }
  const sh = (k, f) => F.share(mv(`${k}_${f}`), tot[f]);
  setHTML("pv-share", sh("rtgs", "value"));
  setHTML("ex-sh-upi-n", sh("upi", "volume"));
  setHTML("ex-sh-upi-v", sh("upi", "value"));
  setHTML("ex-sh-rtgs-n", sh("rtgs", "volume"));
  setHTML("ex-sh-rtgs-v", sh("rtgs", "value"));
  setHTML("ex-sh-neft-v", sh("neft", "value"));
  wirePlate("cb-share", null, "india-atlas_payments-shares", () => csvRows(["system", "share_of_payments_pct", "share_of_value_pct"], GROUPS.map(([name, keys]) => [name, ((100 * sum(keys, "volume")) / tot.volume).toFixed(2), ((100 * sum(keys, "value")) / tot.value).toFixed(2)])));
}
{
  const LINES = [["RTGS", "rtgs", ACC], ["NEFT", "neft", G1], ["UPI", "upi", "#878D99"], ["IMPS", "imps", G2], ["Cheques", "paper", G3]];
  const S = LINES.map(([label, k, color]) => ({ label, key: k, color, data: ser(M.dates, M[k + "_value"], LC) }));
  const top = niceMax(Math.max(...pub(S[0].data).map((d) => d.value)) * 1.05, 50);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 56, marginRight: 190, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(2020, 2026), tickFormat: yr },
    y: { label: "↑ ₹ lakh crore a month", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...S.slice().reverse().map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.key === "rtgs" ? 2 : 1.5, strokeLinejoin: "round" })),
      ...endLabels(S, top * 0.045, (v) => "₹" + v.toFixed(1)),
    ],
  });
  a11y(plot, "Value of payments a month by system", S.map((s) => `${s.label} ₹${lastPt(s.data).value.toFixed(1)} lakh crore`).join(", ") + ` in ${lastMonth}.`);
  mount("plot-value", plot);
  addCrosshair(document.getElementById("plot-value"), plot, S, null, monShort, (v) => (v == null ? "—" : "₹" + v.toFixed(2) + " lakh cr"));
  setHTML("pv-value", F.lakhCrore(mv("rtgs_value")));
  for (const [id, k] of [["ex-v-rtgs", "rtgs"], ["ex-v-neft", "neft"], ["ex-v-upi", "upi"], ["ex-v-imps", "imps"], ["ex-v-chq", "paper"]]) setHTML(id, F.lakhCrore(mv(k + "_value")));
  wirePlate("cb-value", plot, "india-atlas_payments-value-by-system", () => csvRows(["month", ...LINES.map(([l]) => `${l}_value_inr`)], M.dates.map((d, i) => [d, ...LINES.map(([, k]) => M[k + "_value"][i])])));
}

/* ---------- § 05 cards, cash and the machines ---------- */
const I = P.i, IL = I.dates.length - 1;
{
  const cc = { label: "Credit cards", color: ACC, data: ser(M.dates, M.credit_cards_volume, CR) };
  const dc = { label: "Debit cards", color: G2, data: ser(M.dates, M.debit_cards_volume, CR) };
  const top = niceMax(Math.max(...pub(cc.data).concat(pub(dc.data)).map((d) => d.value)) * 1.08, 10);
  const plot = Plot.plot({
    width: W, height: 430, marginLeft: 56, marginRight: 200, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(2020, 2026), tickFormat: yr },
    y: { label: "↑ crore payments a month", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(dc.data, { x: "date", y: "value", stroke: G2, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.lineY(cc.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
      ...endLabels([cc, dc], top * 0.06, (v) => v.toFixed(1) + " crore"),
    ],
  });
  a11y(plot, "Card payments a month by kind of card", `Credit cards ${F.crore(mv("credit_cards_volume"))} and debit cards ${F.crore(mv("debit_cards_volume"))} in ${lastMonth}.`);
  mount("plot-cards", plot);
  addCrosshair(document.getElementById("plot-cards"), plot, [cc, dc], null, monShort, (v) => (v == null ? "—" : v.toFixed(2) + " crore"));
  setHTML("pv-cards", F.crore(mv("credit_cards_volume")));
  setHTML("ex-cd-cc", F.crore(mv("credit_cards_volume")));
  setHTML("ex-cd-dc", F.crore(mv("debit_cards_volume")));
  setHTML("ex-cd-cc0", F.crore(M.credit_cards_volume[0]));
  setHTML("ex-cd-dc0", F.crore(M.debit_cards_volume[0]));
  setHTML("ex-cd-ncc", F.crore(I.credit_cards[IL]));
  setHTML("ex-cd-ndc", F.crore(I.debit_cards[IL]));
  wirePlate("cb-cards", plot, "india-atlas_payments-cards", () => csvRows(["month", "credit_card_payments", "debit_card_payments", "credit_cards_in_issue", "debit_cards_in_issue"],
    M.dates.map((d, i) => [d, M.credit_cards_volume[i], M.debit_cards_volume[i], I.credit_cards[I.dates.indexOf(d)] ?? null, I.debit_cards[I.dates.indexOf(d)] ?? null])));
}
{
  const grid = document.getElementById("plot-cash");
  const atm = ser(M.dates, M.atm_cash_volume, CR);
  const C = P.cash, cwp = ser(C.dates, C.cwp);
  const p1 = miniLine(atm, { color: ACC, w: 560, h: 220, yMax: Math.max(...pub(atm).map((d) => d.value)) });
  const p2 = miniLine(cwp, { color: ACC, w: 560, h: 220, xTicks: [2016, 2019, 2022, 2025].map((y) => new Date(Date.UTC(y, 0, 1))) });
  const atmL = lastPt(atm), cwpL = lastPt(cwp), cwpNov = pub(cwp).find((d) => d.date >= new Date(Date.UTC(2019, 10, 1)));
  panel(grid, "Cash withdrawals at ATMs", `crore a month, ${firstMonth} ${F.crore(M.atm_cash_volume[0])}`, F.crore(M.atm_cash_volume[L]), p1);
  panel(grid, "Currency with the public", `₹ lakh crore, January 2016 ₹${firstPt(cwp).value.toFixed(1)} lakh crore`, "₹" + cwpL.value.toFixed(1) + " lakh crore", p2);
  setHTML("pv-cash", "₹" + cwpL.value.toFixed(1) + " lakh crore");
  setHTML("ex-cs-n", F.crore(M.atm_cash_volume[L]));
  setHTML("ex-cs-n0", F.crore(M.atm_cash_volume[0]));
  setHTML("ex-cs-v", F.lakhCrore(M.atm_cash_value[L]));
  setHTML("ex-cs-cwp", "₹" + cwpL.value.toFixed(1) + " lakh crore");
  setHTML("ex-cs-cwp0", "₹" + cwpNov.value.toFixed(1) + " lakh crore");
  wirePlate("cb-cash", null, "india-atlas_payments-cash", () => csvRows(["date", "atm_cash_withdrawals", "currency_with_public_inr_lakh_crore"],
    [...new Set([...M.dates, ...C.dates])].sort().map((d) => [d, M.atm_cash_volume[M.dates.indexOf(d)] ?? null, C.cwp[C.dates.indexOf(d)] ?? null])));
}
{
  const grid = document.getElementById("plot-machines");
  const PANELS = [["upi_qr", "UPI QR codes", "stickers at shops and stalls"], ["pos", "Card machines (PoS terminals)", "at shops"], ["bharat_qr", "Bharat QR codes", "the card networks' QR"],
    ["atms", "ATMs", "bank-owned and white-label"], ["micro_atms", "Micro ATMs", "banking correspondents' devices"], ["debit_cards", "Debit cards", "in issue"],
    ["credit_cards", "Credit cards", "in issue"], ["ppi_wallets", "Wallets", "prepaid wallets in issue"]];
  for (const [k, name, sub] of PANELS) {
    const s = ser(I.dates, I[k]);
    panel(grid, name, sub, F.count(lastPt(s).value), miniLine(s, { color: k === "upi_qr" ? ACC : G1 }));
  }
  const at = (k, i = IL) => I[k][i];
  setHTML("h-machines", `${F.count(at("upi_qr"))} UPI QR codes, ${F.count(at("pos"))} card machines, ${F.count(at("atms"))} ATMs`);
  setHTML("pv-machines", F.count(at("upi_qr")));
  setHTML("ex-mc-qr", F.count(at("upi_qr")));
  setHTML("ex-mc-pos", F.count(at("pos")));
  setHTML("ex-mc-atm", F.count(at("atms")));
  setHTML("ex-mc-wl", F.count(at("atms_white_label")));
  setHTML("ex-mc-micro", F.count(at("micro_atms")));
  setHTML("ex-mc-posg", F.growth(at("pos"), at("pos", IL - 12)));
  const keys = Object.keys(I).filter((k) => k !== "dates");
  wirePlate("cb-machines", null, "india-atlas_payments-infrastructure", () => csvRows(["month", ...keys], I.dates.map((d, i) => [d, ...keys.map((k) => I[k][i])])));
}

/* ---------- § 06 every other way money moves ---------- */
{
  const grid = document.getElementById("plot-systems");
  const PANELS = [["nach_dr", "NACH debits", "EMIs, SIPs, premiums, bills"], ["nach_cr", "NACH credits", "salaries, pensions, dividends"], ["apbs", "APBS", "government benefits to Aadhaar-linked accounts"],
    ["microatm_cash", "AePS cash withdrawals", "at banking correspondents"], ["imps", "IMPS", "instant transfers"], ["neft", "NEFT", "bank transfers"],
    ["rtgs", "RTGS", "large transfers"], ["ppi_wallets", "Wallets", "prepaid wallet payments"], ["ppi_cards", "Prepaid cards", "gift, meal and travel cards"],
    ["netc", "FASTag (NETC)", "toll payments from bank accounts"], ["bhim_aadhaar_pay", "BHIM Aadhaar Pay", "paying a shop by thumbprint"], ["upi_ussd", "UPI over USSD", "on a phone without internet"]];
  for (const [k, name, sub] of PANELS) {
    const s = ser(M.dates, M[k + "_volume"]);
    panel(grid, name, sub, F.count(lastPt(s).value), miniLine(s, { color: k === "nach_dr" ? ACC : G1 }));
  }
  setHTML("pv-systems", F.count(mv("nach_dr_volume")));
  for (const [id, k] of [["ex-sy-nachdr", "nach_dr"], ["ex-sy-apbs", "apbs"], ["ex-sy-aeps", "microatm_cash"], ["ex-sy-imps", "imps"], ["ex-sy-neft", "neft"], ["ex-sy-wallets", "ppi_wallets"], ["ex-sy-netc", "netc"]]) setHTML(id, F.count(mv(k + "_volume")));
  setHTML("ex-sy-impsg", F.growth(mv("imps_volume"), mv("imps_volume", Y)));
  wirePlate("cb-systems", null, "india-atlas_payments-every-system", () => csvRows(["month", ...PANELS.map(([k]) => k + "_payments")], M.dates.map((d, i) => [d, ...PANELS.map(([k]) => M[k + "_volume"][i])])));
}
{
  const mob = { label: "Mobile", color: ACC, data: ser(M.dates, M.mobile_value, LC) };
  const net = { label: "Net banking", color: G2, data: ser(M.dates, M.internet_value, LC) };
  const top = niceMax(Math.max(...pub(net.data).concat(pub(mob.data)).map((d) => d.value)) * 1.08, 20);
  const plot = Plot.plot({
    width: W, height: 430, marginLeft: 56, marginRight: 230, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(2020, 2026), tickFormat: yr },
    y: { label: "↑ ₹ lakh crore a month", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(net.data, { x: "date", y: "value", stroke: G2, strokeWidth: 1.75, strokeLinejoin: "round" }),
      Plot.lineY(mob.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round" }),
      ...endLabels([mob, net], top * 0.06, (v) => "₹" + v.toFixed(1) + " lakh cr"),
    ],
  });
  a11y(plot, "Value of payments a month by channel", `Mobile ${F.lakhCrore(mv("mobile_value"))} and internet banking ${F.lakhCrore(mv("internet_value"))} in ${lastMonth}.`);
  mount("plot-channels", plot);
  addCrosshair(document.getElementById("plot-channels"), plot, [mob, net], null, monShort, (v) => (v == null ? "—" : "₹" + v.toFixed(2) + " lakh cr"));
  setHTML("pv-channels", F.lakhCrore(mv("mobile_value")));
  setHTML("ex-ch-mv", F.lakhCrore(mv("mobile_value")));
  setHTML("ex-ch-mn", F.crore(mv("mobile_volume")));
  setHTML("ex-ch-iv", F.lakhCrore(mv("internet_value")));
  setHTML("ex-ch-in", F.crore(mv("internet_volume")));
  wirePlate("cb-channels", plot, "india-atlas_payments-channels", () => csvRows(["month", "mobile_payments", "mobile_value_inr", "internet_payments", "internet_value_inr"], M.dates.map((d, i) => [d, M.mobile_volume[i], M.mobile_value[i], M.internet_volume[i], M.internet_value[i]])));
}

/* ---------- § 07 the long view ---------- */
{
  const A = P.a, n = A.dates.length - 1;
  const rows = A.dates.flatMap((d, i) => [
    { fy: fyOf(d), part: "UPI", v: (A.upi_volume[i] ?? 0) / CR },
    { fy: fyOf(d), part: "Every other payment", v: (A.total_volume[i] - (A.upi_volume[i] ?? 0)) / CR },
  ]);
  const totals = A.dates.map((d, i) => ({ fy: fyOf(d), v: A.total_volume[i] / CR }));
  const top = niceMax(Math.max(...totals.map((r) => r.v)) * 1.1, 5000);
  const order = ["UPI", "Every other payment"];
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 60, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.3, domain: totals.map((r) => r.fy) },
    y: { label: "↑ crore payments a year", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => v.toLocaleString("en-IN") },
    color: { domain: order, range: [ACC, G3] },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.barY(rows, { x: "fy", y: "v", fill: "part", order, insetLeft: 0.5, insetRight: 0.5 }),
      Plot.text(totals, { x: "fy", y: "v", text: (d) => Math.round(d.v).toLocaleString("en-IN"), dy: -9, fill: INK, fontSize: 11.5 }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "Payments in each fiscal year, UPI and the rest", totals.map((r, i) => `${r.fy} ${Math.round(r.v)} crore, UPI ${Math.round((A.upi_volume[i] ?? 0) / CR)} crore`).join("; "));
  mount("plot-annual", plot);
  setHTML("pv-annual", F.crore(A.upi_volume[n]));
  setHTML("ex-an-tot", F.crore(A.total_volume[n]));
  setHTML("ex-an-upi", F.crore(A.upi_volume[n]));
  setHTML("ex-an-tot0", F.crore(A.total_volume[0]));
  wirePlate("cb-annual", plot, "india-atlas_payments-by-fiscal-year", () => csvRows(["fiscal_year", "upi_payments", "all_payments", "digital_payments", "paper_payments"], A.dates.map((d, i) => [fyOf(d), A.upi_volume[i], A.total_volume[i], A.digital_total_volume[i], A.paper_volume[i]])));
}
{
  const O = P.o;
  const sumOf = (a, b) => a.map((v, i) => (v == null || b[i] == null ? null : v + b[i]));
  const neftOld = { label: "NEFT, old table", color: tint(ACC, 0.55), data: ser(O.dates, O.neft_volume, CR) };
  const neftNew = { label: "NEFT", color: ACC, data: ser(M.dates, M.neft_volume, CR) };
  const posOld = { label: "Card payments at shops, old table", color: tint(G1, 0.55), data: ser(O.dates, sumOf(O.credit_cards_pos_volume, O.debit_cards_pos_volume), CR) };
  const posNew = { label: "Cards at shops", color: G1, data: ser(M.dates, sumOf(M.credit_cards_pos_volume, M.debit_cards_pos_volume), CR) };
  const top = niceMax(Math.max(...[neftOld, neftNew, posOld, posNew].flatMap((s) => pub(s.data).map((d) => d.value))) * 1.1, 20);
  const seam = new Date(Date.UTC(2019, 10, 1));
  const plot = Plot.plot({
    width: W, height: 450, marginLeft: 56, marginRight: 210, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(2004, 2026, 2), tickFormat: yr },
    y: { label: "↑ crore payments a month", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("side", [posOld, posNew], false),
      ...seamMarks("side", [neftOld, neftNew], { text: "Table re-organised", at: seam, y: top * 0.95 }),
      ...endLabels([neftNew, posNew], top * 0.06, (v) => v.toFixed(1) + " crore"),
    ],
  });
  a11y(plot, "NEFT and card payments at shops a month since 2004", `NEFT ${F.crore(mv("neft_volume"))} and card payments at shops ${F.crore(lastPt(posNew.data).value * CR)} in ${lastMonth}; NEFT ${F.crore(O.neft_volume[0])} in April 2004. Old and new tables drawn apart.`);
  mount("plot-long", plot);
  setHTML("pv-long", F.crore(mv("neft_volume")));
  setHTML("ex-lg-neft", F.crore(mv("neft_volume")));
  setHTML("ex-lg-neft0", F.count(O.neft_volume[0]));
  setHTML("ex-lg-pos", F.crore(lastPt(posNew.data).value * CR));
  wirePlate("cb-long", plot, "india-atlas_payments-neft-and-cards-since-2004", () => csvRows(["month", "table", "neft_payments", "card_payments_at_pos"],
    [...O.dates.map((d, i) => [d, "old (to Oct 2019)", O.neft_volume[i], posOld.data[i].value == null ? null : Math.round(posOld.data[i].value * CR)]),
     ...M.dates.map((d, i) => [d, "re-organised (from Nov 2019)", M.neft_volume[i], posNew.data[i].value == null ? null : Math.round(posNew.data[i].value * CR)])]));
}
{
  const H = P.h, A = P.a;
  const hb = { label: "Handbook cheque series", color: tint(ACC, 0.55), data: ser(H.dates, H.all_india_number, CR) };
  const pt = { label: "Paper instruments", color: ACC, data: ser(A.dates, A.paper_volume, CR) };
  const all = [...pub(hb.data), ...pub(pt.data)];
  const mx = all.reduce((a, d) => (d.value > a.value ? d : a));
  const top = niceMax(mx.value * 1.12, 20);
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 56, marginRight: 120, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 10, ticks: ticksY(1970, 2026, 5).map((d) => new Date(Date.UTC(d.getUTCFullYear(), 2, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ crore cheques a year", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("side", [hb, pt], { text: "Payment system table", y: top * 0.95, anchor: "end" }),
      Plot.dot([mx], { x: "date", y: "value", r: 3.5, fill: "#fff", stroke: ACC, strokeWidth: 1.5 }),
      Plot.text([mx], { x: "date", y: "value", text: () => `${fyD(mx.date)}: ${mx.value.toFixed(1)} crore`, dy: -14, textAnchor: "middle", fill: INK, fontSize: 12 }),
      Plot.dot([lastPt(pt.data)], { x: "date", y: "value", r: 3.5, fill: ACC, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([lastPt(pt.data)], { x: "date", y: "value", text: (d) => `${d.value.toFixed(1)} crore`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  const e = lastPt(pt.data);
  a11y(plot, "Cheques cleared each fiscal year since 1970-71", `${firstPt(hb.data).value.toFixed(1)} crore in 1970-71, a high of ${mx.value.toFixed(1)} crore in ${fyD(mx.date)}, ${e.value.toFixed(1)} crore in ${fyD(e.date)}.`);
  mount("plot-cheques", plot);
  setHTML("h-cheques", `Cheques peaked in ${fyD(mx.date)} and have been falling since`);
  setHTML("pv-cheques", F.crore(e.value * CR));
  setHTML("ex-cq-now", F.crore(e.value * CR));
  setHTML("ex-cq-max", F.crore(mx.value * CR));
  setHTML("ex-cq-maxy", fyD(mx.date));
  setHTML("ex-cq-0", F.crore(H.all_india_number[0]));
  wirePlate("cb-cheques", plot, "india-atlas_payments-cheques-since-1970", () => csvRows(["fiscal_year", "source", "cheques_cleared", "value_inr"],
    [...H.dates.map((d, i) => [fyOf(d), "Handbook cheque clearances", H.all_india_number[i], H.all_india_amount[i]]), ...A.dates.map((d, i) => [fyOf(d), "Payment system table, paper instruments", A.paper_volume[i], null])]));
}
{
  const CH = P.ch, C = P.c, grid = document.getElementById("plot-clearing");
  const bars = CH.dates.map((d, i) => ({ y: d.slice(0, 4), v: CH.total[i] })).filter((r) => r.v != null);
  const p1 = Plot.plot({
    width: 560, height: 260, marginLeft: 44, marginRight: 10, marginTop: 20, marginBottom: 26, style: { ...baseStyle, fontSize: "11px" },
    x: { type: "band", label: null, tickSize: 0, padding: 0.25, tickFormat: (y) => (+y % 5 === 0 ? y : ""), domain: bars.map((r) => r.y) },
    y: { label: null, domain: [0, niceMax(Math.max(...bars.map((r) => r.v)) * 1.1, 200)], tickSize: 0, tickPadding: 6, tickFormat: (v) => v.toLocaleString("en-IN"), ticks: 4 },
    marks: [
      Plot.gridY({ stroke: GRID, ticks: 4 }),
      Plot.barY(bars, { x: "y", y: "v", fill: (d) => (d === bars.at(-1) ? ACC : G3) }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  const cities = [["Mumbai", "mumbai_number", ACC], ["New Delhi", "new_delhi_number", G1], ["Chennai", "chennai_number", G2]];
  const ls = cities.map(([label, k, color]) => ({ label, color, data: ser(C.dates, C[k], CR) }));
  const grid0 = ser(C.dates, C.national_grid_number, CR);
  const cmax = Math.max(...ls.flatMap((s) => pub(s.data).map((d) => d.value)), ...pub(grid0).map((d) => d.value));
  const p2 = Plot.plot({
    width: 560, height: 260, marginLeft: 36, marginRight: 110, marginTop: 20, marginBottom: 26, style: { ...baseStyle, fontSize: "11px" },
    x: { label: null, tickSize: 0, ticks: [2005, 2010, 2015, 2020, 2025].map((y) => new Date(Date.UTC(y, 2, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: null, domain: [0, niceMax(cmax * 1.1, 10)], tickSize: 0, tickPadding: 6, ticks: 4 },
    marks: [
      Plot.gridY({ stroke: GRID, ticks: 4 }),
      Plot.ruleY([0], { stroke: BASE }),
      ...ls.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 1.5, strokeLinejoin: "round" })),
      Plot.dot(pub(grid0), { x: "date", y: "value", r: 4, fill: INK, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([lastPt(grid0)], { x: "date", y: "value", text: () => "National grid", dx: 9, textAnchor: "start", fill: INK, fontSize: 11.5, fontWeight: 600 }),
      // each centre named at the end of its own line, so no colour has to be decoded
      ...ls.map((s) => Plot.text([lastPt(s.data)], { x: "date", y: "value", text: () => s.label, dx: 7, textAnchor: "start", fill: s.color === ACC ? ACC : G1, fontSize: 11 })),
    ],
  });
  panel(grid, "Clearing houses", "end-March each year", bars.at(-1).v.toLocaleString("en-IN"), p1).querySelector("svg").removeAttribute("aria-hidden");
  panel(grid, "Cheques cleared by centre", "crore a year: Mumbai, New Delhi, Chennai; the national grid (dots)", F.crore(lastPt(grid0).value * CR), p2).querySelector("svg").removeAttribute("aria-hidden");
  a11y(p1, "Cheque clearing houses in India", bars.map((r) => `${r.y} ${r.v}`).join(", "));
  a11y(p2, "Cheques cleared by centre", ls.map((s) => `${s.label} ${firstPt(s.data).value.toFixed(1)} crore in ${fyD(firstPt(s.data).date)}`).join(", ") + `; national grid ${lastPt(grid0).value.toFixed(1)} crore in ${fyD(lastPt(grid0).date)}.`);
  const n0 = bars[0].v, nL = bars.at(-1).v;
  setHTML("h-clearing", `From ${n0.toLocaleString("en-IN")} clearing houses to ${nL === 1 ? "one national grid" : nL.toLocaleString("en-IN")}`);
  setHTML("pv-clearing", nL.toLocaleString("en-IN"));
  setHTML("ex-cl-n", `${nL.toLocaleString("en-IN")} clearing house${nL === 1 ? "" : "s"}`);
  setHTML("ex-cl-n0", n0.toLocaleString("en-IN"));
  setHTML("ex-cl-grid", F.crore(lastPt(grid0).value * CR));
  wirePlate("cb-clearing", null, "india-atlas_payments-clearing", () => csvRows(["year_end_march", "clearing_houses", "micr_clearing_houses", "mumbai_cheques", "new_delhi_cheques", "chennai_cheques", "national_grid_cheques"],
    CH.dates.map((d, i) => { const j = C.dates.indexOf(d); return [d, CH.total[i], CH.micr[i], ...["mumbai_number", "new_delhi_number", "chennai_number", "national_grid_number"].map((k) => (j < 0 ? null : C[k][j]))]; })));
}

/* ---------- § 08 the digital rupee ---------- */
{
  const E = P.e, n = E.dates.length - 1;
  const rows = E.dates.flatMap((d, i) => [{ y: "March " + d.slice(0, 4), part: "Retail", v: (E.retail[i] ?? 0) / CR }, { y: "March " + d.slice(0, 4), part: "Wholesale", v: (E.wholesale?.[i] ?? 0) / CR }]);
  const totals = E.dates.map((d, i) => ({ y: "March " + d.slice(0, 4), v: E.total[i] / CR }));
  const top = niceMax(Math.max(...totals.map((r) => r.v)) * 1.15, 200);
  const order = ["Retail", "Wholesale"];
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 60, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.45, domain: totals.map((r) => r.y) },
    y: { label: "↑ ₹ crore", labelAnchor: "top", labelArrow: false, domain: [0, top], tickSize: 0, tickPadding: 10, tickFormat: (v) => v.toLocaleString("en-IN") },
    color: { domain: order, range: [ACC, G3] },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.barY(rows, { x: "y", y: "v", fill: "part", order }),
      Plot.text(totals, { x: "y", y: "v", text: (d) => "₹" + d.v.toLocaleString("en-IN", { maximumFractionDigits: d.v >= 100 ? 0 : 1 }) + " crore", dy: -10, fill: INK, fontSize: 12 }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "e-rupee in circulation on 31 March", totals.map((r) => `${r.y} ₹${r.v.toFixed(2)} crore`).join(", "));
  mount("plot-erupee", plot);
  // the e-rupee as a share of currency with the public on the reporting date nearest 31 March
  const C = P.cash, eDate = E.dates[n].slice(0, 4) + "-03-31";
  let ci = 0; C.dates.forEach((d, i) => { if (Math.abs(D(d) - D(eDate)) < Math.abs(D(C.dates[ci]) - D(eDate))) ci = i; });
  setHTML("pv-erupee", F.rsCrore(E.total[n]));
  setHTML("ex-er-now", F.rsCrore(E.total[n]));
  setHTML("ex-er-prev", F.rsCrore(E.total[n - 1]));
  setHTML("ex-er-share", (100 * E.total[n] / (C.cwp[ci] * LC)).toFixed(3) + "%");
  setHTML("ex-er-one", F.share(E.retail_1[n], E.retail[n]));
  setHTML("ex-er-500", F.share(E.retail_500[n], E.retail[n]));
  setHTML("ex-er-500p", F.share(E.retail_500[n - 1], E.retail[n - 1]));
  const keys = Object.keys(E).filter((k) => k !== "dates");
  wirePlate("cb-erupee", plot, "india-atlas_payments-e-rupee", () => csvRows(["as_on", ...keys.map((k) => k + "_inr")], E.dates.map((d, i) => [d, ...keys.map((k) => E[k][i])])));
}
