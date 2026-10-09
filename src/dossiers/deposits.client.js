// Guide 14, where Indians keep their money: plates and number wiring.
// Data: data/series/deposits-*.json, baked by scripts/lib/products/bsr2.mjs from the RBI's
// BSR-2 tables (via the local Data Bank's DBIE mirror). Values are ₹ lakh crore, as on 31 March.
// Two disclosed breaks: the sector classification (old to March 2018, new from March 2019) and
// the deposit-size bands (finer from March 2026). Neither is ever joined across.

import * as Plot from "@observablehq/plot";
import ownersBundle from "../../data/series/deposits-owners.json";
import owners05Bundle from "../../data/series/deposits-owners-2005.json";
import popBundle from "../../data/series/deposits-population.json";
import ratesBundle from "../../data/series/deposits-term-rates.json";
import maturityBundle from "../../data/series/deposits-term-maturity.json";
import size26Bundle from "../../data/series/deposits-term-size-2026.json";
import { MONO as sans, hydrate, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

const O = hydrate(ownersBundle), O5 = hydrate(owners05Bundle);
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const first = (s) => s.data.filter((d) => d.value != null)[0].value;
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const pct = (a, b) => (100 * a) / b;
const lastYear = ownersBundle.dates.at(-1).slice(0, 4), firstYear = ownersBundle.dates[0].slice(0, 4);
const at = (bundle, key, iso) => bundle.series[key].data[bundle.dates.indexOf(iso)];
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";

/* ---------- title block ---------- */
const hh = last(O.household_total), term = last(O.household_term);
setHTML("m-latest", `March ${lastYear}`);
setHTML("u-reading", `RBI BSR-2, as on 31 March ${lastYear}`);
setHTML("n-hh", "₹" + hh.toFixed(1) + pc(" lakh crore"));
setHTML("d-hh", `<b>${fmt.pct1Plus(pct(hh, O.household_total.data.at(-2).value) - 100)}</b> on March ${+lastYear - 1}`);
setHTML("n-term", pct(term, hh).toFixed(1) + pc("%"));
setHTML("d-term", `<b>${fmt.lc1(term)}</b> in fixed deposits`);
{
  const R = ratesBundle, B = R.meta.bands, below6 = B.slice(0, 4).map((b) => b.key);
  const share = (iso) => pct(below6.reduce((s, k) => s + at(R, "ind_" + k, iso), 0), at(R, "ind_total", iso));
  const L = R.dates.at(-1);
  setHTML("n-low", share(L).toFixed(1) + pc("%"));
  setHTML("d-low", `<b>${share("2022-03-01").toFixed(1)}%</b> in March 2022`);
  setHTML("cr-low", share(L).toFixed(1) + "%");
  setHTML("cr-low22", share("2022-03-01").toFixed(1) + "%");
  setHTML("cr-lastyr", `March ${L.slice(0, 4)}`);
}
const women = pct(last(O.female_total), last(O.all_total));
setHTML("n-women", women.toFixed(1) + pc("%"));
setHTML("d-women", `<b>${fmt.lc1(last(O.female_total))}</b> in women's names`);
spark("nspark-hh", { ...O.household_total, color: "#2E4BD8" });

/* ---------- § 01 ---------- */
setHTML("rb-hh", "₹" + hh.toFixed(1) + pc(" lakh crore"));
setHTML("rb-term", "₹" + term.toFixed(1) + pc(" lakh crore"));
setHTML("cr-hh", fmt.lc1(hh));
setHTML("cr-hh-share", pct(hh, last(O.all_total)).toFixed(1) + "%");
setHTML("cr-term", pct(term, hh).toFixed(1) + "%");
setHTML("cr-sav", pct(last(O.household_savings), hh).toFixed(1) + "%");
setHTML("cr-cur", pct(last(O.household_current), hh).toFixed(1) + "%");

/* ---------- shared plate wiring ---------- */
function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const W = 1184;

/* ---------- § 02 savings accounts and fixed deposits ---------- */
{
  const KEYS = [["household_term", "#2E4BD8", "Fixed deposits"], ["household_savings", "#5F6675", "Savings"], ["household_current", "#A3A9B4", "Current"]];
  const TINT = { "#2E4BD8": "#AFBBF0", "#5F6675": "#B5BAC4", "#A3A9B4": "#D5D9E0" };
  const lines = [], ends = [];
  for (const [k, c, name] of KEYS) {
    lines.push(Plot.lineY(O5[k].data, { x: "date", y: "value", stroke: TINT[c], strokeWidth: 1.25, strokeLinejoin: "round" }));
    lines.push(Plot.lineY(O[k].data, { x: "date", y: "value", stroke: c, strokeWidth: k === "household_term" ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" }));
    const e = O[k].data.at(-1);
    ends.push(Plot.dot([e], { x: "date", y: "value", fill: c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
    ends.push(Plot.text([e], { x: "date", y: "value", text: (d) => `${name} ₹${d.value.toFixed(1)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: k === "household_term" ? 600 : 400 }));
  }
  const seam = new Date(Date.UTC(2018, 8, 1));
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 44, marginRight: 190, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: [2005, 2010, 2015, 2020, 2026].map((y) => new Date(Date.UTC(y, 2, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "₹ lakh crore", labelAnchor: "top", labelArrow: false, domain: [0, 100], ticks: [0, 20, 40, 60, 80, 100], tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY([20, 40, 60, 80, 100], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleX([seam], { stroke: "#B5BAC4", strokeDasharray: "1 3" }),
      Plot.text([{ x: seam, y: 96 }], { x: "x", y: "y", text: () => "Household redefined", dx: -8, textAnchor: "end", fill: MUTED, fontSize: 11.5 }),
      Plot.text([{ x: new Date(Date.UTC(2006, 2, 1)), y: 28 }], { x: "x", y: "y", text: () => "Old definition", textAnchor: "start", fill: MUTED, fontSize: 11.5 }),
      ...lines, ...ends,
    ],
  });
  a11y(plot, "Household bank deposits by type", `Fixed deposits rose from ₹${first(O5.household_term).toFixed(1)} lakh crore in March 2005 to ₹${last(O.household_term).toFixed(1)} lakh crore in March ${lastYear}; savings accounts to ₹${last(O.household_savings).toFixed(1)} lakh crore.`);
  document.getElementById("plot-types").append(plot);
  const xf = (d) => "March " + d.getUTCFullYear();
  addCrosshair(document.getElementById("plot-types"), plot, KEYS.map(([k, c, name]) => ({ ...O[k], label: name, color: c })), null, xf, (v) => (v == null ? "—" : "₹" + v.toFixed(1) + " lakh cr"));
  setHTML("pv-types", fmt.lc1(term));
  setHTML("ex-ty-term", fmt.lc1(term));
  setHTML("ex-ty-sav", fmt.lc1(last(O.household_savings)));
  setHTML("ex-ty-cur", fmt.lc1(last(O.household_current)));
  setHTML("ex-ty-share", pct(term, hh).toFixed(1) + "%");
  setHTML("ex-ty-share19", pct(first(O.household_term), first(O.household_total)).toFixed(1) + "%");
  const rows = [...owners05Bundle.dates.map((d, i) => [d, "old", ...["household_term", "household_savings", "household_current", "household_total"].map((k) => owners05Bundle.series[k].data[i] ?? "")]),
    ...ownersBundle.dates.map((d, i) => [d, "new", ...["household_term", "household_savings", "household_current", "household_total"].map((k) => ownersBundle.series[k].data[i] ?? "")])];
  wirePlate("cb-types", plot, "india-atlas_household-deposits-by-type", "as_on,classification,term_inr_lakh_crore,savings_inr_lakh_crore,current_inr_lakh_crore,total_inr_lakh_crore\n" + rows.map((r) => r.join(",")).join("\n"));
}

/* ---------- § 03 at what interest rate ---------- */
{
  const R = ratesBundle, B = R.meta.bands;
  const GROUPS = [
    ["Below 5%", B.slice(0, 3).map((b) => b.key), "#E7EBFC"],
    ["5 to 6%", [B[3].key], "#C3CDF7"],
    ["6 to 7%", [B[4].key], "#8F9FEC"],
    ["7 to 8%", [B[5].key], "#5A72E0"],
    ["8% and above", B.slice(6).map((b) => b.key), "#2238A8"],
  ];
  const rows = [];
  R.dates.forEach((iso, i) => {
    const tot = R.series.ind_total.data[i];
    for (const [g, keys] of GROUPS) rows.push({ year: iso.slice(0, 4), group: g, share: pct(keys.reduce((s, k) => s + R.series["ind_" + k].data[i], 0), tot) });
  });
  const order = GROUPS.map((g) => g[0]);
  document.getElementById("legend-rates").innerHTML = GROUPS.map(([g, , c]) => `<span class="chip"><i class="sq" style="background:${c};width:10px;height:10px"></i>${g}</span>`).join("");
  const plot = Plot.plot({
    width: W, height: 400, marginLeft: 44, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.32, tickFormat: (y) => "March " + y },
    y: { label: "share of the money, per cent", labelAnchor: "top", labelArrow: false, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickSize: 0, tickPadding: 10, tickFormat: (v) => v + (v === 100 ? "%" : "") },
    color: { domain: order, range: GROUPS.map((g) => g[2]) },
    marks: [
      Plot.gridY([25, 50, 75, 100], { stroke: GRID }),
      Plot.barY(rows, { x: "year", y: "share", fill: "group", order, insetLeft: 0.5, insetRight: 0.5 }),
      // labels inside the bars: no halo (the site's white text halo would smear white-on-blue text)
      Plot.text(rows.filter((r) => r.share >= 9), Plot.stackY({ x: "year", y: "share", order, text: (d) => d.share.toFixed(0) + "%", fill: (d) => (order.indexOf(d.group) >= 2 ? "#fff" : INK), fontSize: 11.5, className: "inbar" })),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "Individuals' fixed deposits by interest rate", rows.filter((r) => r.group === "Below 5%" || r.group === "5 to 6%").map((r) => `${r.year} ${r.group} ${r.share.toFixed(0)}%`).join(", "));
  document.getElementById("plot-rates").append(plot);
  const L = R.dates.length - 1, share = (keys, i) => pct(keys.reduce((s, k) => s + R.series["ind_" + k].data[i], 0), R.series.ind_total.data[i]);
  const below6 = B.slice(0, 4).map((b) => b.key), i22 = R.dates.indexOf("2022-03-01");
  setHTML("pv-rates", share(below6, L).toFixed(1) + "%");
  setHTML("ex-r-low", share(below6, L).toFixed(1) + "%");
  setHTML("ex-r-67", share([B[4].key], L).toFixed(1) + "%");
  setHTML("ex-r-78", share([B[5].key], L).toFixed(1) + "%");
  setHTML("ex-r-8", share(B.slice(6).map((b) => b.key), L).toFixed(1) + "%");
  setHTML("ex-r-low22", share(below6, i22).toFixed(1) + "%");
  wirePlate("cb-rates", plot, "india-atlas_fixed-deposits-by-interest-rate",
    "as_on," + B.map((b) => `"${b.label}"`).join(",") + ",total_inr_lakh_crore\n" + R.dates.map((d, i) => [d, ...B.map((b) => R.series["ind_" + b.key].data[i]), R.series.ind_total.data[i]].join(",")).join("\n"));
}

/* ---------- horizontal bars, one highlighted group ---------- */
function hbars(id, rows, { valueFmt, hl, xMax, xTicks, xFmt, label }) {
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 40, marginLeft: 250, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks.slice(1), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? "#2E4BD8" : "#C9CED6"), insetTop: 11, insetBottom: 11 }),
      Plot.text(rows, { y: "name", x: "v", text: (d) => valueFmt(d.v), dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  document.getElementById(id).append(plot);
  return plot;
}

/* ---------- § 04 maturity ---------- */
{
  const M = maturityBundle, L = M.dates.length - 1, tot = M.series.ind_grand_total.data[L];
  const NAMES = ["Less than 3 months", "3 to 6 months", "6 months to a year", "1 to 3 years", "3 to 5 years", "5 years or more"];
  const rows = M.meta.bands.map((b, i) => ({ name: NAMES[i], v: pct(M.series["ind_" + b.key].data[L], tot), i }));
  const plot = hbars("plot-maturity", rows, { valueFmt: (v) => v.toFixed(1) + "%", hl: (d) => d.i < 3, xMax: 40, xTicks: [0, 10, 20, 30, 40], xFmt: (v) => v + (v === 40 ? "%" : ""), label: "share of the money" });
  a11y(plot, "Individuals' fixed deposits by time left to maturity", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  const within = rows.slice(0, 3).reduce((s, r) => s + r.v, 0);
  setHTML("pv-maturity", within.toFixed(1) + "%");
  setHTML("ex-m-1y", within.toFixed(1) + "%");
  setHTML("ex-m-3y", rows[3].v.toFixed(1) + "%");
  setHTML("ex-m-long", (rows[4].v + rows[5].v).toFixed(1) + "%");
  wirePlate("cb-maturity", plot, "india-atlas_fixed-deposits-by-maturity",
    "as_on,time_to_maturity,individuals_inr_lakh_crore\n" + M.dates.flatMap((d, i) => M.meta.bands.map((b, j) => `${d},"${NAMES[j]}",${M.series["ind_" + b.key].data[i]}`)).join("\n"));
}

/* ---------- § 04 size ---------- */
{
  const Z = size26Bundle, B = Z.meta.bands;
  const NAMES = { less_than_1_lakh: "Under ₹1 lakh", "1_lakh_above_but_less_than_5_lakh": "₹1 to 5 lakh", "5_lakh_above_but_less_than_10_lakh": "₹5 to 10 lakh",
    "10_lakh_above_but_less_than_15_lakh": "₹10 to 15 lakh", "15_lakh_above_but_less_than_1_crore": "₹15 lakh to ₹1 crore", "1_crore_above_but_less_than_3_crore": "₹1 to 3 crore",
    "3_crore_above_but_less_than_5_crore": "₹3 to 5 crore", "5_crore_above": "₹5 crore or more" };
  const MID = ["1_lakh_above_but_less_than_5_lakh", "5_lakh_above_but_less_than_10_lakh", "10_lakh_above_but_less_than_15_lakh"];
  const rows = B.map((b) => ({ key: b.key, name: NAMES[b.key] ?? b.label, v: Z.series["ind_" + b.key].data[0] }));
  const tot = rows.reduce((s, r) => s + r.v, 0);
  const plot = hbars("plot-size", rows, { valueFmt: (v) => "₹" + v.toFixed(1) + " lakh cr", hl: (d) => MID.includes(d.key), xMax: 25, xTicks: [0, 5, 10, 15, 20, 25], xFmt: (v) => String(v), label: "₹ lakh crore" });
  a11y(plot, "Individuals' fixed deposits by size of deposit", rows.map((r) => `${r.name} ₹${r.v.toFixed(1)} lakh crore`).join(", "));
  const mid = rows.filter((r) => MID.includes(r.key)).reduce((s, r) => s + r.v, 0);
  const big = rows.filter((r) => /crore/.test(r.key) && !/15_lakh/.test(r.key)).reduce((s, r) => s + r.v, 0);
  setHTML("pv-size", pct(mid, tot).toFixed(1) + "%");
  setHTML("ex-s-mid", pct(mid, tot).toFixed(1) + "%");
  setHTML("ex-s-small", pct(rows[0].v, tot).toFixed(1) + "%");
  setHTML("ex-s-big", pct(big, tot).toFixed(1) + "%");
  wirePlate("cb-size", plot, "india-atlas_fixed-deposits-by-size-2026", "deposit_size,individuals_inr_lakh_crore\n" + rows.map((r) => `"${r.name}",${r.v}`).join("\n"));
}

/* ---------- § 05 place ---------- */
{
  const P = popBundle, L = P.dates.length - 1;
  const GRPS = [["rural", "Rural"], ["semi_urban", "Semi-urban"], ["urban", "Urban"], ["metro", "Metropolitan"]];
  const rows = GRPS.map(([k, n]) => ({ name: n, a: P.series["household_" + k].data[0], b: P.series["household_" + k].data[L], k }));
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 48, marginLeft: 250, marginRight: 110, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "₹ lakh crore", labelAnchor: "right", labelArrow: false, domain: [0, 70], ticks: [0, 10, 20, 30, 40, 50, 60, 70], tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX([10, 20, 30, 40, 50, 60, 70], { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "b", fill: (d) => (d.k === "metro" ? "#2E4BD8" : "#AAB8F2"), insetTop: 13, insetBottom: 13 }),
      Plot.dot(rows, { y: "name", x: "a", r: 4, fill: "#fff", stroke: "#878D99", strokeWidth: 1.5 }),
      Plot.text(rows, { y: "name", x: "b", text: (d) => "₹" + d.b.toFixed(1), dx: 8, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: (d) => (d.k === "metro" ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "Household deposits by population group", rows.map((r) => `${r.name}: ₹${r.a.toFixed(1)} lakh crore in March ${P.dates[0].slice(0, 4)}, ₹${r.b.toFixed(1)} lakh crore in March ${P.dates[L].slice(0, 4)}`).join("; "));
  document.getElementById("plot-place").append(plot);
  const all = P.series.household_all_india.data[L];
  setHTML("lg-place", `March ${P.dates[L].slice(0, 4)}`);
  setHTML("pv-place", pct(rows[3].b, all).toFixed(1) + "%");
  setHTML("ex-p-metro", pct(rows[3].b, all).toFixed(1) + "%");
  setHTML("ex-p-rural", pct(rows[0].b, all).toFixed(1) + "%");
  setHTML("ex-p-women", women.toFixed(1) + "%");
  setHTML("ex-p-women19", pct(first(O.female_total), first(O.all_total)).toFixed(1) + "%");
  wirePlate("cb-place", plot, "india-atlas_household-deposits-by-place",
    "as_on," + GRPS.map(([, n]) => n).join(",") + ",all_india\n" + P.dates.map((d, i) => [d, ...GRPS.map(([k]) => P.series["household_" + k].data[i]), P.series.household_all_india.data[i]].join(",")).join("\n"));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", ownersBundle.meta.vintage);
setHTML("prov-vintage2", ownersBundle.meta.vintage);
