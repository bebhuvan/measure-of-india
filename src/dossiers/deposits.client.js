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
import sectorsBundle from "../../data/series/deposits-sectors.json";
import ageBundle from "../../data/series/deposits-age.json";
import stOwnersBundle from "../../data/series/deposits-states-owners.json";
import stTypeBundle from "../../data/series/deposits-states-type.json";
import districtsBundle from "../../data/series/deposits-districts.json";
import bgSectorsBundle from "../../data/series/deposits-bankgroups-sectors.json";
import staffBundle from "../../data/series/deposits-employees-bankgroups.json";
import staffStBundle from "../../data/series/deposits-employees-states.json";
import origMatBundle from "../../data/series/deposits-maturity-owners.json";
import qSectorsBundle from "../../data/series/deposits-q-sectors.json";
import { MONO as sans, hydrate, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, fmt, dodgeEndLabels } from "../charts/plumbing.js";
const setTxt = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };

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
      // every band is stacked (a filtered stack would misplace the labels); small bands get no text
      Plot.text(rows, Plot.stackY({ x: "year", y: "share", order, text: (d) => (d.share >= 9 ? d.share.toFixed(0) + "%" : ""), fill: (d) => (order.indexOf(d.group) >= 2 ? "#fff" : INK), fontSize: 11.5, className: "inbar" })),
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


/* ================= wave 2 (October 2026): every other BSR-2 table ================= */
const lastI = (b) => b.dates.length - 1;
const v = (b, k, i = lastI(b)) => b.series[k]?.data[i] ?? null;
const csvOf = (head, rows) => head + "\n" + rows.map((r) => r.map((x) => (typeof x === "string" && /[",]/.test(x) ? `"${x}"` : x ?? "")).join(",")).join("\n");
const tcase = (s) => s;   // labels arrive in title case from the adapter
function bars(id, rows, { valueFmt, hl, xMax, xTicks, xFmt, label, dots, rowH = 30, ml = 300, dotFmt, leftLabels }) {
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * rowH, marginLeft: ml, marginRight: 110, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickFormat: xFmt, tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14, axis: leftLabels ? null : "left" },
    marks: [
      // left-aligned row names, so an indented sub-group reads as one (no-break spaces survive in SVG)
      ...(leftLabels ? [Plot.text(rows, { y: "name", frameAnchor: "left", dx: -ml + 4, text: "name", textAnchor: "start", fill: (d) => (hl(d) ? INK : "#4A5160"), fontSize: 12, fontWeight: (d) => (hl(d) ? 600 : 400) })] : []),
      Plot.gridX(xTicks.slice(1), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? "#2E4BD8" : "#C9CED6"), insetTop: rowH > 26 ? 8 : 5, insetBottom: rowH > 26 ? 8 : 5 }),
      ...(dots ? [Plot.dot(rows.filter((d) => d.d != null), { y: "name", x: "d", r: 4, fill: "#fff", stroke: "#878D99", strokeWidth: 1.5 })] : []),
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.v, d.d ?? 0), text: (d) => valueFmt(d), dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  document.getElementById(id).append(plot);
  return plot;
}

/* ---------- § 06 who else keeps money in banks ---------- */
{
  const B = sectorsBundle, I = lastI(B), T = v(B, "total__total"), T0 = v(B, "total__total", 0);
  const keys = Object.keys(B.series).filter((k) => k.endsWith("__total") && k !== "total__total");
  // plain names for RBI's sector codes; sub-sectors indented with no-break spaces (SVG keeps them)
  const NAME = { s1: "General government", s1_1: "Central government", s1_2: "State governments", s1_3: "Local government", s2: "Non-financial companies",
    s2_1: "Government-owned companies", s2_2: "Private companies", s3: "Financial firms", s3_1: "Deposit-taking firms", s3_2: "Mutual funds", s3_3: "Insurance companies",
    s3_4: "Provident and pension funds", s3_5: "Other financial firms", s4: "Households", s4_1: "Individuals", s4_2: "Unincorporated businesses",
    s4_3: "Non-profits serving households", s5: "Rest of the world", s5_1: "Non-residents", s5_2: "All others abroad" };
  const rows = keys.map((k) => { const code = k.split("__")[0]; const depth = code.split("_").length;
    return { k, name: (depth > 1 ? "\u00A0".repeat(5) : "") + (NAME[code] ?? B.series[k].label.split(" · ").at(-1)), depth, v: (v(B, k) / T) * 100, d: v(B, k, 0) != null ? (v(B, k, 0) / T0) * 100 : null }; })
    .filter((r) => r.depth <= 2);
  const plot = bars("plot-sectors", rows, { valueFmt: (d) => d.v.toFixed(1) + "%", hl: (d) => d.depth === 1, xMax: 70, xTicks: [0, 10, 20, 30, 40, 50, 60, 70], xFmt: (x) => x + (x === 70 ? "%" : ""), label: "share of all deposits", dots: true, rowH: 26, ml: 260, leftLabels: true });
  a11y(plot, "Deposits by owning sector, March 2026 and March 2019", rows.filter((r) => r.depth === 1).map((r) => `${r.name} ${r.v.toFixed(1)}% (2019: ${r.d?.toFixed(1)}%)`).join("; "));
  const sh = (k, i) => ((v(B, k, i) / v(B, "total__total", i)) * 100).toFixed(1) + "%";
  setHTML("pv-sectors", sh("s4__total"));
  setHTML("ex-sc-hh", sh("s4__total")); setHTML("ex-sc-hh19", sh("s4__total", 0));
  setHTML("ex-sc-nfc", sh("s2__total")); setHTML("ex-sc-nfc19", sh("s2__total", 0));
  setHTML("ex-sc-gov", sh("s1__total")); setHTML("ex-sc-nri", sh("s5_1_1__total")); setHTML("ex-sc-shg", sh("s4_3_1__total"));
  wirePlate("cb-sectors", plot, "india-atlas_deposits-by-owner", csvOf("as_on,owner,current_inr_crore,savings_inr_crore,term_inr_crore,total_inr_crore",
    B.dates.flatMap((d, i) => keys.concat(["total__total"]).map((k) => { const p = k.slice(0, -7); return [d, B.series[k].label.split(" · ").at(-1), v(B, p + "__current", i), v(B, p + "__savings", i), v(B, p + "__term", i), v(B, k, i)]; }))));
}

/* ---------- § 07 how old the savers are ---------- */
{
  const B = ageBundle, I = lastI(B);
  const AG = Object.keys(B.series).filter((k) => k.startsWith("individuals__") && k.endsWith("__total")).map((k) => k.split("__")[1]);
  const name = (g) => B.series[`individuals__${g}__total`].label.split(" · ").at(-1);
  const rows = AG.flatMap((g) => { const term = v(B, `individuals__${g}__term`) / 1e5, tot = v(B, `individuals__${g}__total`) / 1e5;
    return [{ g, name: name(g), part: "Fixed deposits", x1: 0, x2: term }, { g, name: name(g), part: "Savings and current", x1: term, x2: tot }]; });
  const tot = (i) => AG.reduce((a, g) => a + v(B, `individuals__${g}__total`, i), 0);
  const sen = (i) => ["a7_60_to_69", "a8_70_and_above"].reduce((a, g) => a + v(B, `individuals__${g}__total`, i), 0);
  const plot = Plot.plot({
    width: W, height: 44 + AG.length * 40, marginLeft: 250, marginRight: 120, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: "₹ lakh crore", labelAnchor: "right", labelArrow: false, domain: [0, 55], ticks: [0, 10, 20, 30, 40, 50], tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: AG.map(name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX([10, 20, 30, 40, 50], { stroke: GRID }),
      Plot.barX(rows, { y: "name", x1: "x1", x2: "x2", fill: (d) => (d.part === "Fixed deposits" ? "#2E4BD8" : "#B9C3F3"), insetTop: 10, insetBottom: 10 }),
      Plot.text(AG.map((g) => ({ name: name(g), t: v(B, `individuals__${g}__total`) / 1e5, sh: (v(B, `individuals__${g}__total`) / tot(I)) * 100 })), { y: "name", x: "t", text: (d) => `₹${d.t.toFixed(1)}  ${d.sh.toFixed(1)}%`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "Deposits of individuals by age, March 2026", AG.map((g) => `${name(g)} ₹${(v(B, `individuals__${g}__total`) / 1e5).toFixed(1)} lakh crore`).join(", "));
  document.getElementById("plot-age").append(plot);
  const sh = (x, y) => ((x / y) * 100).toFixed(1) + "%";
  setHTML("pv-age", sh(sen(I), tot(I)));
  setHTML("ex-age-60", sh(sen(I), tot(I)));
  setHTML("ex-age-60-23", sh(sen(0), tot(0)));
  setHTML("ex-age-60-term", sh(["a7_60_to_69", "a8_70_and_above"].reduce((a, g) => a + v(B, `individuals__${g}__term`), 0), sen(I)));
  setHTML("ex-age-25", sh(v(B, "individuals__a5_25_to_39__total"), tot(I)));
  setHTML("ex-age-minor", sh(["a1_under_10", "a2_10_to_14", "a3_15_to_17"].reduce((a, g) => a + v(B, `individuals__${g}__total`), 0), tot(I)));
  wirePlate("cb-age", plot, "india-atlas_deposits-by-age", csvOf("as_on,holder,age,current_inr_crore,savings_inr_crore,term_inr_crore,total_inr_crore",
    B.dates.flatMap((d, i) => ["individuals", "women"].flatMap((w) => AG.map((g) => [d, w, name(g), v(B, `${w}__${g}__current`, i), v(B, `${w}__${g}__savings`, i), v(B, `${w}__${g}__term`, i), v(B, `${w}__${g}__total`, i)])))));
}
{
  const B = stOwnersBundle, I = lastI(B);
  const st = Object.keys(B.series).filter((k) => k.endsWith("__women") && B.series[k].group === "State").map((k) => { const p = k.slice(0, -7);
    return { p, name: B.series[k].label.split(" · ").at(-1), v: v(B, k) == null || !v(B, p + "__individuals") ? null : (v(B, k) / v(B, p + "__individuals")) * 100 }; })
    .filter((r) => r.v != null).sort((a, b) => b.v - a.v);   // retired units (Daman & Diu, Dadra & Nagar Haveli before 2020) have no figure: left out, not drawn as zero
  const ai = (v(B, "all_india__women") / v(B, "all_india__individuals")) * 100, ai0 = (v(B, "all_india__women", 0) / v(B, "all_india__individuals", 0)) * 100;
  const plot = bars("plot-womenst", st, { valueFmt: (d) => d.v.toFixed(1) + "%", hl: (d) => d.v >= ai, xMax: 55, xTicks: [0, 10, 20, 30, 40, 50], xFmt: (x) => x + (x === 50 ? "%" : ""), label: "women's share of individuals' deposits", rowH: 22, ml: 240 });
  a11y(plot, "Women's share of individuals' deposits by state, March 2026", `${st[0].name} ${st[0].v.toFixed(1)}%, ${st.at(-1).name} ${st.at(-1).v.toFixed(1)}%, All India ${ai.toFixed(1)}%`);
  setHTML("pv-womenst", ai.toFixed(1) + "%");
  setHTML("ex-ws-hi", `${st[0].name}, ${st[0].v.toFixed(1)}%`);
  setHTML("ex-ws-lo", `${st.at(-1).name}, ${st.at(-1).v.toFixed(1)}%`);
  setHTML("ex-ws-ai", ai.toFixed(1) + "%"); setHTML("ex-ws-ai19", ai0.toFixed(1) + "%");
  wirePlate("cb-womenst", plot, "india-atlas_deposits-women-by-state", csvOf("as_on,state,individuals_inr_crore,women_inr_crore,women_share_pct",
    B.dates.flatMap((d, i) => st.map((r) => [d, r.name, v(B, r.p + "__individuals", i), v(B, r.p + "__women", i), v(B, r.p + "__individuals", i) ? ((v(B, r.p + "__women", i) / v(B, r.p + "__individuals", i)) * 100).toFixed(2) : ""]))));
}

/* ---------- § 08 where the money sits ---------- */
{
  const B = stTypeBundle, I = lastI(B), T = v(B, "all_india__total");
  const st = Object.keys(B.series).filter((k) => k.endsWith("__total") && B.series[k].group === "State").map((k) => ({ k, name: B.series[k].label.split(" · ").at(-1), v: v(B, k) == null ? null : (v(B, k) / T) * 100 }))
    .filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const plot = bars("plot-states", st, { valueFmt: (d) => d.v.toFixed(1) + "%", hl: (d) => st.indexOf(d) < 3, xMax: 25, xTicks: [0, 5, 10, 15, 20, 25], xFmt: (x) => x + (x === 25 ? "%" : ""), label: "share of all deposits", rowH: 22, ml: 240 });
  a11y(plot, "Deposits by state, March 2026", st.slice(0, 5).map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  setHTML("pv-states", st[0].v.toFixed(1) + "%");
  setTxt("ex-st-n1", st[0].name); setHTML("ex-st-mh", st[0].v.toFixed(1) + "%");
  setTxt("ex-st-n23", st[1].name + " and " + st[2].name); setHTML("ex-st-next", (st[1].v + st[2].v).toFixed(1) + "%");
  setHTML("ex-st-small", String(st.filter((r) => r.v < 1).length));
  wirePlate("cb-states", plot, "india-atlas_deposits-by-state", csvOf("as_on,state,offices,accounts,current_inr_crore,savings_inr_crore,term_inr_crore,total_inr_crore",
    B.dates.flatMap((d, i) => st.map((r) => { const p = r.k.slice(0, -7); return [d, r.name, v(B, p + "__offices", i), v(B, p + "__total_accounts", i), v(B, p + "__current", i), v(B, p + "__savings", i), v(B, p + "__term", i), v(B, r.k, i)]; }))));
}
{
  const B = districtsBundle, I = lastI(B);
  // a district's total = the sum of its population-group rows (the table prints no district total)
  const by = new Map();
  for (const [k, s] of Object.entries(B.series)) {
    if (!k.endsWith("__amount") || k.startsWith("all_india")) continue;
    const [st, di] = k.split("__"); const key = st + "__" + di;
    const o = by.get(key) ?? { name: `${s.label.split(" · ")[2]}, ${s.label.split(" · ")[1]}`, v: 0, acc: 0, off: 0 };
    o.v += s.data[I] ?? 0; o.acc += v(B, k.replace("__amount", "__accounts")) ?? 0; o.off += v(B, k.replace("__amount", "__offices")) ?? 0;
    by.set(key, o);
  }
  const all = [...by.values()].filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
  const T = all.reduce((a, d) => a + d.v, 0);
  let c = 0, half = 0; for (const d of all) { c += d.v; half++; if (c >= T / 2) break; }
  const rows = all.slice(0, 30).map((d) => ({ ...d, name: d.name, v: (d.v / T) * 100 }));
  const plot = bars("plot-districts", rows, { valueFmt: (d) => d.v.toFixed(1) + "%", hl: (d) => rows.indexOf(d) < 3, xMax: 10, xTicks: [0, 2, 4, 6, 8, 10], xFmt: (x) => x + (x === 10 ? "%" : ""), label: "share of all deposits", rowH: 22, ml: 300 });
  a11y(plot, "The 30 districts with the most bank deposits, March 2026", rows.slice(0, 5).map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", ") + `; ${half} districts hold half of all deposits`);
  setHTML("pv-districts", String(half));
  setHTML("ex-di-1", rows.filter((r) => /^Mumbai/.test(r.name)).reduce((a, r) => a + r.v, 0).toFixed(1) + "% (two districts)");
  setHTML("ex-di-2", (rows.find((r) => /^Bengaluru Urban/.test(r.name))?.v ?? 0).toFixed(1) + "%");
  setHTML("ex-di-half", String(half)); setHTML("ex-di-n", String(all.length));
  wirePlate("cb-districts", plot, "india-atlas_deposits-by-district", csvOf("as_on,district_state,offices,accounts,amount_inr_crore,share_pct", all.map((d) => [B.dates[I], d.name, d.off, d.acc, Math.round(d.v * 100) / 100, ((d.v / T) * 100).toFixed(3)])));
}

/* ---------- § 09 which banks, and who works in them ---------- */
{
  const B = bgSectorsBundle, X = hydrate(bgSectorsBundle);
  const G = [["psb", "Public sector banks", "#2E4BD8"], ["private", "Private sector banks", "#C47A16"], ["foreign", "Foreign banks", "#878D99"], ["rrb", "Regional rural banks", "#A3A9B4"], ["sfb", "Small finance banks", "#C9CED6"]];
  const share = (g) => ({ ...X["total__" + g], data: X["total__" + g].data.map((d, i) => ({ date: d.date, value: d.value == null ? null : (d.value / B.series.total__all_banks.data[i]) * 100 })) });
  const S = Object.fromEntries(G.map(([g]) => [g, share(g)]));
  const marks = [Plot.gridY([10, 20, 30, 40, 50, 60, 70], { stroke: GRID }), Plot.ruleY([0], { stroke: BASE })];
  for (const [g, name, c] of G) {
    marks.push(Plot.lineY(S[g].data, { x: "date", y: "value", stroke: c, strokeWidth: g === "psb" || g === "private" ? 2 : 1.25, strokeLinejoin: "round", strokeLinecap: "round" }));
    marks.push(Plot.dot([S[g].data.at(-1)], { x: "date", y: "value", fill: c, r: 3, stroke: "#fff", strokeWidth: 1.5 }));
  }
  // end labels dodged apart: the three small groups sit within two points of each other
  const xEnd = S.psb.data.at(-1).date;
  // dodging pushes labels down only, so the smallest group's label can fall onto the year axis: lift the small
  // groups' labels together until the lowest clears it
  const ends = dodgeEndLabels(G.map(([g, name, c]) => ({ ...S[g], label: name })), 3.2);
  const lift = Math.max(0, 1.8 - Math.min(...ends.map((p) => p.y)));
  for (const p of ends) if (p.value < 20) p.y += lift;
  for (const p of ends)
    marks.push(Plot.text([{ x: xEnd, y: p.y }], { x: "x", y: "y", text: () => `${p.key} ${p.value.toFixed(1)}%`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: p.key.startsWith("Private") ? 600 : 400 }));
  const plot = Plot.plot({ width: W, height: 400, marginLeft: 44, marginRight: 230, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: B.dates.map((d) => new Date(d + "T00:00:00Z")), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "share of all deposits, per cent", labelAnchor: "top", labelArrow: false, domain: [0, 70], ticks: [0, 10, 20, 30, 40, 50, 60, 70], tickSize: 0, tickPadding: 10 }, marks });
  a11y(plot, "Share of deposits by bank group, 2019 to 2026", G.map(([g, n]) => `${n} ${S[g].data[0].value.toFixed(1)}% to ${S[g].data.at(-1).value.toFixed(1)}%`).join("; "));
  document.getElementById("plot-banks").append(plot);
  addCrosshair(document.getElementById("plot-banks"), plot, G.map(([g, n, c]) => ({ ...S[g], label: n, color: c })), null, (d) => "March " + d.getUTCFullYear(), (x) => (x == null ? "—" : x.toFixed(1) + "%"));
  const f = (g, i) => S[g].data.at(i).value.toFixed(1) + "%";
  setHTML("pv-banks", f("private", -1));
  setHTML("ex-bk-psb", f("psb", -1)); setHTML("ex-bk-psb19", f("psb", 0)); setHTML("ex-bk-pvt", f("private", -1)); setHTML("ex-bk-pvt19", f("private", 0));
  setHTML("ex-bk-for", f("foreign", -1)); setHTML("ex-bk-rrb", f("rrb", -1)); setHTML("ex-bk-sfb", f("sfb", -1));
  wirePlate("cb-banks", plot, "india-atlas_deposits-by-bank-group", csvOf("as_on," + [...G.map((g) => g[0]), "payments", "all_banks"].map((g) => g + "_inr_crore").join(","),
    B.dates.map((d, i) => [d, ...[...G.map((g) => g[0]), "payments", "all_banks"].map((g) => B.series["total__" + g]?.data[i])])));
}
{
  const B = staffBundle, I = lastI(B);
  const G = ["psb", "private", "rrb", "foreign", "sfb", "payments"];
  const rows = G.map((g) => ({ g, name: B.series[`all_india__${g}__total`].label.split(" · ").at(-1), n: v(B, `all_india__${g}__total`), v: (v(B, `all_india__${g}__women_total`) / v(B, `all_india__${g}__total`)) * 100 })).sort((a, b) => b.v - a.v);
  const S2 = staffStBundle, ai = (v(S2, "all_india__women_total") / v(S2, "all_india__total")) * 100;
  const plot = bars("plot-staff", rows, { valueFmt: (d) => `${d.v.toFixed(1)}%  of ${d.n.toLocaleString("en-IN")}`, hl: (d) => d.v >= ai, xMax: 40, xTicks: [0, 10, 20, 30, 40], xFmt: (x) => x + (x === 40 ? "%" : ""), label: "women's share of employees", rowH: 34 });
  a11y(plot, "Women's share of bank employees by bank group, March 2026", rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "));
  setHTML("pv-staff", ai.toFixed(1) + "%");
  setHTML("ex-sf-n", v(S2, "all_india__total").toLocaleString("en-IN")); setHTML("ex-sf-w", ai.toFixed(1) + "%");
  setHTML("ex-sf-hi", `${rows[0].name}, ${rows[0].v.toFixed(1)}%`); setHTML("ex-sf-lo", `${rows.at(-1).name}, ${rows.at(-1).v.toFixed(1)}%`);
  wirePlate("cb-staff", plot, "india-atlas_bank-employees-by-bank-group", csvOf("as_on,bank_group,employees,women,women_share_pct", rows.map((r) => [B.dates[I], r.name, r.n, v(B, `all_india__${r.g}__women_total`), r.v.toFixed(2)])));
}

/* ---------- § 10 booked for how long, and the quarterly return ---------- */
{
  const B = origMatBundle;
  const M = Object.keys(B.series).filter((k) => /^m\d/.test(k) && k.endsWith("__total")).map((k) => k.slice(0, -7));
  const SH = ["#E7EBFC", "#C3CDF7", "#8F9FEC", "#2E4BD8", "#5A72E0", "#2238A8"];
  const rows = B.dates.flatMap((d, i) => M.map((m, j) => ({ year: d.slice(0, 4), band: B.series[m + "__total"].label.split(" · ").at(-1), j, share: (B.series[m + "__total"].data[i] / B.series["all__total"].data[i]) * 100 })));
  const order = M.map((m) => B.series[m + "__total"].label.split(" · ").at(-1));
  const plot = Plot.plot({ width: W, height: 400, marginLeft: 44, marginRight: 20, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 10, padding: 0.32, tickFormat: (y) => "March " + y },
    y: { label: "share of term deposits, per cent", labelAnchor: "top", labelArrow: false, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickSize: 0, tickPadding: 10 },
    color: { domain: order, range: SH },
    marks: [Plot.gridY([25, 50, 75, 100], { stroke: GRID }), Plot.barY(rows, { x: "year", y: "share", fill: "band", order, insetLeft: 0.5, insetRight: 0.5 }),
      Plot.text(rows, Plot.stackY({ x: "year", y: "share", order, text: (d) => (d.share >= 7 ? d.share.toFixed(0) + "%" : ""), fill: (d) => (d.j >= 3 ? "#fff" : INK), fontSize: 11.5, className: "inbar" })),
      Plot.ruleY([0], { stroke: BASE })] });
  a11y(plot, "Term deposits by original maturity, 2019 to 2026", rows.filter((r) => r.j === 3).map((r) => `${r.year} one to three years ${r.share.toFixed(0)}%`).join(", "));
  document.getElementById("plot-origmat").append(plot);
  const at = (m, i) => (B.series[m + "__total"].data.at(i) / B.series["all__total"].data.at(i)) * 100;
  setHTML("pv-origmat", at(M[3], -1).toFixed(1) + "%");
  setHTML("ex-om-13", at(M[3], -1).toFixed(1) + "%");
  setHTML("ex-om-1", (at(M[0], -1) + at(M[1], -1) + at(M[2], -1)).toFixed(1) + "%");
  setHTML("ex-om-5", at(M[5], -1).toFixed(1) + "%"); setHTML("ex-om-519", at(M[5], 0).toFixed(1) + "%");
  const leg = document.createElement("div"); leg.className = "legend"; leg.innerHTML = order.map((o, i) => `<span class="chip"><i class="sq" style="background:${SH[i]};width:10px;height:10px"></i>${o}</span>`).join("");
  document.getElementById("plot-origmat").before(leg);
  wirePlate("cb-origmat", plot, "india-atlas_term-deposits-by-original-maturity", csvOf("as_on,original_maturity,individuals_inr_crore,others_inr_crore,total_inr_crore,total_accounts",
    B.dates.flatMap((d, i) => M.concat(["all"]).map((m) => [d, B.series[m + "__total"].label.split(" · ").at(-1), B.series[m + "__individuals"]?.data[i], B.series[m + "__others"]?.data[i], B.series[m + "__total"].data[i], B.series[m + "__total_accounts"]?.data[i]]))));
}
{
  const B = qSectorsBundle, X = hydrate(qSectorsBundle);
  const tot = { ...X.total__total, data: X.total__total.data.map((d) => ({ date: d.date, value: d.value / 1e5 })) };
  const hh = X.s4__total.data.map((d, i) => ({ date: d.date, sh: (d.value / B.series.total__total.data[i]) * 100, value: tot.data[i].value }));
  const plot = Plot.plot({ width: W, height: 380, marginLeft: 44, marginRight: 170, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: B.dates.filter((d) => d.slice(5, 7) === "03").map((d) => new Date(d + "T00:00:00Z")), tickFormat: (d) => "March " + d.getUTCFullYear() },
    y: { label: "₹ lakh crore", labelAnchor: "top", labelArrow: false, domain: [150, 280], ticks: [150, 175, 200, 225, 250, 275], tickSize: 0, tickPadding: 10 },
    marks: [Plot.gridY([175, 200, 225, 250, 275], { stroke: GRID }),
      Plot.lineY(tot.data, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot(tot.data, { x: "date", y: "value", fill: (d) => (d.date.getUTCMonth() === 2 ? "#2E4BD8" : "#fff"), stroke: "#2E4BD8", strokeWidth: 1.5, r: 3.5 }),
      // the first label sits right of its dot, clear of the y-axis ticks
      Plot.text(hh.filter((d, i) => i > 0 && (d.date.getUTCMonth() === 2 || d === hh.at(-1))), { x: "date", y: "value", text: (d) => `${d.sh.toFixed(1)}%`, dy: 16, fill: "#4A5160", fontSize: 11 }),
      Plot.text([hh[0]], { x: "date", y: "value", text: (d) => `${d.sh.toFixed(1)}%`, dx: 10, dy: 12, textAnchor: "start", fill: "#4A5160", fontSize: 11 }),
      Plot.text([tot.data.at(-1)], { x: "date", y: "value", text: (d) => `₹${d.value.toFixed(1)} lakh crore`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 })] });
  a11y(plot, "Deposits by quarter, excluding regional rural banks, March 2023 to June 2026", `From ₹${tot.data[0].value.toFixed(1)} to ₹${tot.data.at(-1).value.toFixed(1)} lakh crore; household share labelled each March.`);
  document.getElementById("plot-quarterly").append(plot);
  addCrosshair(document.getElementById("plot-quarterly"), plot, [{ ...tot, label: "Deposits", color: "#2E4BD8" }], null, (d) => ["Mar", "Jun", "Sep", "Dec"][Math.floor(d.getUTCMonth() / 3)] + " " + d.getUTCFullYear(), (x) => (x == null ? "—" : "₹" + x.toFixed(1) + " lakh cr"));
  const L = tot.data.length - 1;
  setHTML("pv-quarterly", "₹" + tot.data[L].value.toFixed(1) + pc(" lakh crore"));
  setHTML("ex-q-tot", "₹" + tot.data[L].value.toFixed(1) + " lakh crore");
  setHTML("ex-q-yoy", fmt.pct1Plus((tot.data[L].value / tot.data[L - 4].value - 1) * 100));
  setHTML("ex-q-hh", hh[L].sh.toFixed(1) + "%");
  wirePlate("cb-quarterly", plot, "india-atlas_deposits-quarterly", csvOf("quarter_end,total_inr_crore,households_inr_crore,households_share_pct", B.dates.map((d, i) => [d, B.series.total__total.data[i], B.series.s4__total.data[i], hh[i].sh.toFixed(2)])));
}

/* ---------- provenance ---------- */
setHTML("prov-vintage", ownersBundle.meta.vintage);
setHTML("prov-vintage2", ownersBundle.meta.vintage);
