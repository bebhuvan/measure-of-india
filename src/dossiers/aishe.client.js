// Dossier 09 · Higher Education — plate definitions and number wiring.
// Data: data/series/aishe-headline.json + aishe-access.json +
// aishe-composition.json + aishe-states.json, baked at build time by
// scripts/fetch.mjs from the Ministry of Education's AISHE (five survey
// rounds, 2017-18 to 2021-22). Enrolment counts enrolments, not distinct
// students; GER divides by a population projection. Teachers are the
// published total (the 2021-22 "defect" of v1.0 was a corrupted download;
// see the provenance). Wave 2 adds the state plates from the aishe-states-*
// and aishe-ptr bundles.

import * as Plot from "@observablehq/plot";
import headlineBundle from "../../data/series/aishe-headline.json";
import accessBundle from "../../data/series/aishe-access.json";
import compositionBundle from "../../data/series/aishe-composition.json";
import statesBundle from "../../data/series/aishe-states.json";
import teachersBundle from "../../data/series/aishe-teachers.json";
import minorityBundle from "../../data/series/aishe-minority.json";
import ptrBundle from "../../data/series/aishe-ptr.json";
import stTeachersBundle from "../../data/series/aishe-states-teachers.json";
import stEnrolBundle from "../../data/series/aishe-states-enrolment.json";
import stInstBundle from "../../data/series/aishe-states-institutions.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob, stripLabelSide, stripLabelSpot,
} from "../charts/plumbing.js";

const H = hydrate(headlineBundle);
const A = hydrate(accessBundle);
const C = hydrate(compositionBundle);
const S = hydrate(statesBundle);
const T = hydrate(teachersBundle);
const MN = hydrate(minorityBundle);

/* ---------- formatters ---------- */
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtIN = (n) => Math.round(n).toLocaleString("en-IN");
const fy = (d) => d.getUTCFullYear() + "-" + String((d.getUTCFullYear() + 1) % 100).padStart(2, "0");
const croreN = (n, dp = 2) => (n / 1e7).toFixed(dp);              // count -> crore
const lakhOf = (n, dp = 1) => (n / 1e5).toFixed(dp);              // count -> lakh
// a head count in words a reader can hold: "4.33 crore", "18.8 lakh", "88,748"
// a short chart label in the same spirit: "4.8 lakh", "47,000"
const countShort = (n) => (n >= 1e5 ? lakhOf(n) + " lakh" : (Math.round(n / 1000) * 1000).toLocaleString("en-IN"));
const lakhTick = (d, i, arr) => (d === 0 ? "0" : String(+(d / 1e5).toFixed(1)) + (d === arr.at(-1) ? " lakh" : ""));
const countWords = (n) => (n >= 1e7 ? croreN(n) + " crore" : n >= 1e5 ? lakhOf(n) + " lakh" : fmtIN(n));
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const prevV = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const firstV = (s) => s.data.filter((d) => d.value != null)[0].value;
const atV = (s, i) => s.data.filter((d) => d.value != null)[i].value;
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));
const arrowPt = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt";

/* ---------- titleblock numbers ---------- */
setHTML("n-enrol", croreN(last(H.enrolment)) + pc("crore"));
setHTML("d-enrol", `<b>${arrow(last(H.enrolment) - prevV(H.enrolment), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(H.enrolment.data.at(-2).date)}`);
setHTML("n-ger", last(H.ger).toFixed(1) + pc("%"));
setHTML("d-ger", `<b>${arrowPt(last(H.ger) - prevV(H.ger))}</b>`);
setHTML("n-gpi", last(H.gpi).toFixed(2));
setHTML("d-gpi", `<b>${arrow(last(H.gpi) - prevV(H.gpi), (v) => v.toFixed(2))}</b>, 1.0 is parity`);
setHTML("n-ptr", Math.round(last(H.ptr)));
setHTML("d-ptr", `<b>${arrow(last(H.ptr) - prevV(H.ptr), (v) => v.toFixed(1))}</b> students/teacher`);
document.getElementById("nspark-enrol").append(sparkPlot(H.enrolment));

function sparkPlot(s) {
  const plot = Plot.plot({
    width: 190, height: 44, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
    style: { background: "transparent" },
    x: { axis: null }, y: { axis: null, domain: [Math.min(...s.data.map((d) => d.value), 0), Math.max(...s.data.map((d) => d.value))] },
    marks: [Plot.ruleY([0], { stroke: "#ECEEF2" }), Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 1.5, strokeLinejoin: "round" }), Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 })],
  });
  plot.setAttribute("aria-hidden", "true");
  return plot;
}

/* ---------- § 01 current reading ---------- */
setHTML("rb-enrol", croreN(last(H.enrolment)) + pc("crore"));
setHTML("rb-ger", last(H.ger).toFixed(1) + pc("%"));
setTxt("rt-ratio", last(H.ger).toFixed(0));
setTxt("cr-enrol", countWords(last(H.enrolment)));
setTxt("cr-univ", fmtIN(last(H.universities)));
setTxt("cr-coll", fmtIN(last(H.colleges)));
setTxt("cr-teach", countWords(last(H.teachers)));
setHTML("cr-growth", ((last(H.enrolment) / firstV(H.enrolment) - 1) * 100).toFixed(0) + pc("%"));
setHTML("cr-enrol-first", countWords(firstV(H.enrolment)));
setHTML("cr-ger", last(H.ger).toFixed(1) + pc("%"));
setHTML("cr-ger-first", firstV(H.ger).toFixed(1) + pc("%"));
setTxt("cr-gpi", last(H.gpi).toFixed(2));
setHTML("cr-fem-share", (last(A.enrolment_female) / last(H.enrolment) * 100).toFixed(0) + pc("%"));
setHTML("cr-sc-share", (last(C.social_sc) / last(H.enrolment) * 100).toFixed(0) + pc("%"));
setHTML("cr-st-share", (last(C.social_st) / last(H.enrolment) * 100).toFixed(0) + pc("%"));

/* ---------- § 02 register of series ---------- */
H.universities.color = "#5F6675";
H.colleges.color = "#5F6675";
H.enrolment.color = "#2E4BD8";
H.teachers.color = "#5F6675";
H.ger.color = "#5F6675";
H.gpi.color = "#5F6675";
H.ptr.color = "#5F6675";
const regRows = [
  [H.enrolment, "Estimated student enrolment", "AISHE, count, Both, Grand Total", "s-acc", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
  [H.universities, "Universities", "AISHE, count", "s-g1", fmtIN, fmtIN],
  [H.colleges, "Colleges", "AISHE, count", "s-g2", fmtIN, fmtIN],
  [H.teachers, "Teachers", "AISHE, count, all posts", "s-g3", (v) => countWords(v), (v) => countWords(v)],
  [H.ger, "Gross Enrolment Ratio", "AISHE, %, All Categories, Both", "s-acc", (v) => v.toFixed(1) + "%", (v) => v.toFixed(1) + " pt"],
  [H.gpi, "Gender Parity Index", "AISHE, index, All Categories, 1.0 = parity", "s-g1", (v) => v.toFixed(2), (v) => v.toFixed(2)],
  [H.ptr, "Pupil-Teacher Ratio", "AISHE, ratio, all institutions", "s-g4", (v) => String(Math.round(v)), (v) => v.toFixed(1)],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fV, fD], i) => {
  const data = s.data.filter((d) => d.value != null);
  return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${fV(data.at(-1).value)}</td>
    <td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)}, vs ${fy(data.at(-2).date)}</td>
    <td class="yr">${fV(data[0].value)}, ${fy(data[0].date)}</td>
    <td class="spark" id="sp-a${i}"></td>
  </tr>`;
}).join("");
regRows.forEach(([s], i) => spark(`sp-a${i}`, { ...s, color: "#2E4BD8" }));

/* ---------- shared line-panel renderer ---------- */
function linePanel(el, keys, store, geo, opts) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * (opts.gapFrac ?? 0.07));
  const marks = [
    Plot.gridY(opts.yTicks, { stroke: "#EEF0F3", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    geo.d0 <= 0 && geo.d1 >= 0 ? Plot.ruleY([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }) : null,
    ...(opts.preMarks || []),
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: opts.supportWidth ?? 1.75, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: opts.supportDash })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: opts.leadWidth ?? 2, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: opts.leadDash }),
    ...(opts.postMarks || []),
    ...seriesList.map((s) => Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.filter((p) => Math.abs(p.y - p.value) > (geo.d1 - geo.d0) * 0.004).map((p) => Plot.line([{ x: dts.at(-1), y: p.value }, { x: dts.at(-1), y: p.y }], { x: "x", y: "y", stroke: p.s.color, strokeWidth: 1, strokeOpacity: 0.45 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], { x: "date", y: "y", text: () => `${p.s.label.split(" · ")[0]} ${opts.endFmt(p.value)}`, dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start" })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 14, ticks: opts.xTicks, tickFormat: opts.xFmt },
    y: { label: opts.yLabel, labelAnchor: "top", labelArrow: false, tickFormat: opts.yFmt, ticks: opts.yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, opts.a11yTitle, opts.a11yDesc);
  el.append(plot);
  if (opts.crossFmt) addCrosshair(el, plot, seriesList, geo, fy, opts.crossFmt);
  return plot;
}

/* meta-carrying downloads for plates whose CSV is not a date×series matrix */
function wirePlate(blockEl, plot, filename, csvText) {
  const meta = {
    title: blockEl.querySelector(".plate-head h3")?.textContent.trim(),
    sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg" && plot) downloadSVG(plot, filename, meta);
      if (kind === "png" && plot) downloadPNG(plot, filename, meta);
      if (kind === "csv") saveBlob(new Blob([csvText], { type: "text/csv" }), filename + ".csv");
    });
  });
}

const xTicksA = [2017, 2018, 2019, 2020, 2021].map((y) => new Date(Date.UTC(y, 3, 1)));
const parityRule = new Date(Date.UTC(2017, 3, 1)); // unused anchor

/* ---------- § 03 composition : education level + social group baskets ---------- */
{
  const EDU = [
    ["under_graduate", "Under Graduate"], ["post_graduate", "Post Graduate"], ["diploma", "Diploma"],
    ["integrated", "Integrated"], ["pg_diploma", "PG Diploma"], ["phd", "Ph.D."],
    ["certificate", "Certificate"], ["mphil", "M.Phil."],
  ];
  const SOC = [
    ["social_others", "Others (residual)"], ["social_obc", "OBC"], ["social_sc", "Scheduled Caste"], ["social_st", "Scheduled Tribe"],
  ];
  const total = last(H.enrolment);
  const eduSegs = EDU.map(([k, n]) => [n, last(C[k]), total]).filter(([, v]) => v != null && v > 0);
  const socSegs = SOC.map(([k, n]) => [n, last(C[k]), total]).filter(([, v]) => v != null && v > 0);
  const eduColours = { "Under Graduate": "#2E4BD8", "Post Graduate": "#5F6675", "Diploma": "#878D99", "Integrated": "#A3A9B4", "PG Diploma": "#C9CED6", "Ph.D.": "#A3A9B4", "Certificate": "#C9CED6", "M.Phil.": "#C9CED6" };
  const socColours = { "Others (residual)": "#C9CED6", "OBC": "#2E4BD8", "Scheduled Caste": "#5F6675", "Scheduled Tribe": "#878D99" };

  const renderBasket = (barId, labId, segs, colours) => {
    document.getElementById(barId).innerHTML = segs.map(([n, v, t]) =>
      `<div class="seg" style="width:${(v / t * 100).toFixed(2)}%;background:${colours[n] || "#A3A9B4"}" title="${n}: ${(v / t * 100).toFixed(1)}%"></div>`).join("");
    document.getElementById(labId).innerHTML = segs.map(([n, v, t]) =>
      `<div class="blab"><div class="n"><span class="sw" style="background:${colours[n] || "#A3A9B4"}"></span>${n}</div><div class="w">${countWords(v)}, ${(v / t * 100).toFixed(1)}%</div></div>`).join("");
  };
  renderBasket("bar-edu", "lab-edu", eduSegs, eduColours);
  renderBasket("bar-soc", "lab-soc", socSegs, socColours);

  const pct = (k) => (last(C[k]) / total * 100).toFixed(1) + pc("%");
  setHTML("pv-comp", (last(C.under_graduate) / total * 100).toFixed(0) + pc("%"));
  setHTML("ex-c-ug", pct("under_graduate"));
  setHTML("ex-c-pg", pct("post_graduate"));
  setHTML("ex-c-dip", pct("diploma"));
  setHTML("ex-c-phd", pct("phd"));
  setHTML("ex-c-obc", pct("social_obc"));
  setHTML("ex-c-oth", pct("social_others"));
  setHTML("ex-c-sc", pct("social_sc"));
  setHTML("ex-c-st", pct("social_st"));
  setHTML("ex-c-scst", ((last(C.social_sc) + last(C.social_st)) / total * 100).toFixed(1) + pc("%"));

  const csvE = "level,enrolment_2021_22,share_pct\n" + eduSegs.map(([n, v]) => `"${n}",${Math.round(v)},${(v / total * 100).toFixed(2)}`).join("\n");
  const csvS = "social_group,enrolment_2021_22,share_pct\n" + socSegs.map(([n, v]) => `"${n}",${Math.round(v)},${(v / total * 100).toFixed(2)}`).join("\n");
  wirePlate(document.getElementById("cb-comp"), null, "india-atlas_aishe_composition_2021-22", csvE + "\n\n" + csvS);
}

/* ---------- § 04 plate 1 : enrolment by gender ---------- */
{
  const store = {
    female: { ...A.enrolment_female, label: "Female enrolment · crore", color: "#2E4BD8" },
    male: { ...A.enrolment_male, label: "Male enrolment · crore", color: "#5F6675" },
  };
  // display in crore
  store.female = { ...store.female, data: store.female.data.map((d) => ({ date: d.date, value: d.value / 1e7 })) };
  store.male = { ...store.male, data: store.male.data.map((d) => ({ date: d.date, value: d.value / 1e7 })) };

  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 1.6, d1: 2.4 };
  const plot = linePanel(document.getElementById("plot-enrol"), ["female", "male"], store, geo, {
    yTicks: [1.7, 1.9, 2.1, 2.3],
    yLabel: "↑ enrolment, crore",
    yFmt: (d) => String(d.toFixed(1)),
    xTicks: xTicksA, xFmt: fy,
    endFmt: (v) => v.toFixed(2) + " cr",
    crossFmt: (v) => (v == null ? "—" : v.toFixed(2) + " cr"),
    gapFrac: 0.12,
    a11yTitle: "Estimated student enrolment by gender, All India, 2017-18 to 2021-22",
    a11yDesc: "Two rising lines over five survey rounds. Female enrolment (blue) rose from " + croreN(firstV(A.enrolment_female)) + " crore to " + croreN(last(A.enrolment_female)) + " crore; male (grey) from " + croreN(firstV(A.enrolment_male)) + " crore to " + croreN(last(A.enrolment_male)) + " crore. Men outnumber women in every round.",
  });

  const femGain = last(A.enrolment_female) - firstV(A.enrolment_female);
  const totalGain = last(H.enrolment) - firstV(H.enrolment);
  setHTML("pv-enrol", ((last(H.enrolment) / firstV(H.enrolment) - 1) * 100).toFixed(0) + pc("%"));
  setHTML("ex-e-fem", countWords(last(A.enrolment_female)));
  setHTML("ex-e-male", countWords(last(A.enrolment_male)));
  setHTML("ex-e-femshare", (last(A.enrolment_female) / last(H.enrolment) * 100).toFixed(0) + pc("%"));
  setHTML("ex-e-gap1", countWords(last(A.enrolment_male) - last(A.enrolment_female)));
  setHTML("ex-e-gap0", countWords(firstV(A.enrolment_male) - firstV(A.enrolment_female)));
  setTxt("ex-e-gpi0", firstV(H.gpi).toFixed(2));
  setTxt("ex-e-gpi1", last(H.gpi).toFixed(2));
  void femGain; void totalGain;

  wirePlate(document.getElementById("cb-enrol"), plot, "india-atlas_aishe_enrolment-by-gender_2017-2021", "fiscal_year,female_enrolment,male_enrolment\n" + H.enrolment.data.map((d, i) => fy(d.date) + "," + Math.round(A.enrolment_female.data[i].value) + "," + Math.round(A.enrolment_male.data[i].value)).join("\n"));
  wireLegend(document.getElementById("legend-enrol"), plot, ["female", "male"], store);
}

/* ---------- § 06 plate 2 : GER by social group ---------- */
{
  const store = {
    ger_all_both: { ...A.ger_all_both, label: "All Categories", color: "#2E4BD8" },
    ger_sc_both: { ...A.ger_sc_both, label: "Scheduled Caste", color: "#5F6675" },
    ger_st_both: { ...A.ger_st_both, label: "Scheduled Tribe", color: "#A3A9B4" },
  };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 13, d1: 31 };
  const plot = linePanel(document.getElementById("plot-ger"), ["ger_all_both", "ger_sc_both", "ger_st_both"], store, geo, {
    yTicks: [15, 20, 25, 30],
    yLabel: "↑ Gross Enrolment Ratio, %",
    yFmt: (d) => String(d) + "%",
    xTicks: xTicksA, xFmt: fy,
    endFmt: (v) => v.toFixed(1) + "%",
    crossFmt: (v) => (v == null ? "—" : v.toFixed(1) + "%"),
    gapFrac: 0.1,
    a11yTitle: "Gross Enrolment Ratio by social group, All India, 2017-18 to 2021-22",
    a11yDesc: "Three rising lines, ordered All Categories above Scheduled Caste above Scheduled Tribe throughout. All Categories ends at " + last(A.ger_all_both).toFixed(1) + " per cent, SC at " + last(A.ger_sc_both).toFixed(1) + ", ST at " + last(A.ger_st_both).toFixed(1) + ". The gaps narrowed slightly but the ordering held across all five rounds.",
  });

  const stGap = last(A.ger_all_both) - last(A.ger_st_both);
  const scGap = last(A.ger_all_both) - last(A.ger_sc_both);
  setHTML("pv-ger", stGap.toFixed(1) + pc(" pt"));
  setTxt("ex-g-all", last(A.ger_all_both).toFixed(1) + "%");
  setTxt("ex-g-sc", last(A.ger_sc_both).toFixed(1) + "%");
  setTxt("ex-g-st", last(A.ger_st_both).toFixed(1) + "%");
  setTxt("ex-g-stgap", stGap.toFixed(1));
  setTxt("ex-g-scgap", scGap.toFixed(1));

  wirePlate(document.getElementById("cb-ger"), plot, "india-atlas_aishe_ger-by-social-group_2017-2021", "fiscal_year,ger_all_categories,ger_scheduled_caste,ger_scheduled_tribe\n" + H.ger.data.map((d, i) => fy(d.date) + "," + A.ger_all_both.data[i].value + "," + A.ger_sc_both.data[i].value + "," + A.ger_st_both.data[i].value).join("\n"));
  wireLegend(document.getElementById("legend-ger"), plot, ["ger_all_both", "ger_sc_both", "ger_st_both"], store);
}

/* ---------- § 06 plate 3 : state GER dot strip ---------- */
{
  const rename = { "dadra_nagar_haveli_and_daman_diu": "DNH & Daman & Diu" };
  const aiGer = last(H.ger);
  const rows = Object.entries(statesBundle.series)
    .filter(([k]) => k.startsWith("ger_"))
    .map(([k, s]) => {
      const v = s.data.at(-1);
      if (v == null) return null;
      const slug = k.slice(4);
      const name = (rename[slug] || slug.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")).replace("Dnh", "DNH");
      return { state: name, ger: v, slug };
    })
    .filter(Boolean)
    .sort((a, b) => b.ger - a.ger);
  const above = rows.filter((r) => r.ger >= aiGer).length;
  const spread = rows[0].ger - rows.at(-1).ger;

  const geo = { W: 1184, H: 30 + rows.length * 22 + 40, ml: 230, mr: 90, mt: 30, mb: 40 };
  const aiSpot = (v) => stripLabelSpot(geo, 0, 68, v, [aiGer, 0]);
  const xTicks = [0, 10, 20, 30, 40, 50, 60];
  const plot = Plot.plot({
    width: geo.W, height: geo.H,
    marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "Gross Enrolment Ratio, % →", labelAnchor: "right", labelArrow: false, domain: [0, 68], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => (d === 0 ? "0" : String(d) + "%") },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleX([aiGer], { stroke: "#2E4BD8", strokeWidth: 1.5, strokeDasharray: "3,3" }),
      Plot.text([{ ger: aiGer }], { x: "ger", text: ["All-India GER, " + aiGer.toFixed(1)], frameAnchor: "top", dy: -16, dx: 6, fontSize: 11, fill: "#161A22", fontFamily: mono, textAnchor: "start" }),
      Plot.ruleY(rows, { y: "state", x1: 0, x2: "ger", stroke: (d) => (d.ger >= aiGer ? "#E3E6EB" : "#F0F2F5"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "state", x: "ger", fill: (d) => (d.ger >= aiGer ? "#5F6675" : "#A3A9B4"), r: 5.5 }),
      ["start", "end", "middle"].map((a) => Plot.text(rows.filter((d) => aiSpot(d.ger).anchor === a), { y: "state", x: "ger",
        dx: a === "end" ? -12 : a === "start" ? 12 : 0, dy: a === "middle" ? -11 : 0,
        text: (d) => d.ger.toFixed(1) + "%",
        fill: (d) => (d.ger >= aiGer ? "#5F6675" : "#878D99"), fontSize: 12.5, fontFamily: mono, textAnchor: a })),
    ],
  });
  a11y(plot, "Gross Enrolment Ratio by state and union territory, 2021-22",
    "Sorted dot strip of " + rows.length + " states and union territories against the All-India GER of " + aiGer.toFixed(1) + " per cent (blue rule). " + rows[0].state + " is highest at " + rows[0].ger.toFixed(1) + " per cent, " + rows[1].state + " next at " + rows[1].ger.toFixed(1) + "; " + rows.at(-1).state + " is lowest at " + rows.at(-1).ger.toFixed(1) + ". " + above + " of " + rows.length + " sit at or above the national ratio.");
  document.getElementById("plot-states").append(plot);

  /* ---- companion strip: enrolment volume by state ---- */
  const enrRename = { "dadra_nagar_haveli_and_daman_diu": "DNH & Daman & Diu" };
  const enrRows = Object.entries(statesBundle.series)
    .filter(([k]) => k.startsWith("enrolment_"))
    .map(([k, s]) => {
      const v = s.data.at(-1);
      if (v == null) return null;
      const slug = k.slice(10);
      const name = enrRename[slug] || slug.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
      return { state: name.replace("Dnh", "DNH"), enr: v };
    })
    .filter(Boolean)
    .sort((a, b) => b.enr - a.enr);
  const enrTotal = enrRows.reduce((a, r) => a + r.enr, 0);
  const enrTop3Share = enrRows.slice(0, 3).reduce((a, r) => a + r.enr, 0) / enrTotal * 100;
  setHTML("pv-states", spread.toFixed(0) + pc(" pt"));
  setTxt("ex-s-top", rows[0].state + ", " + rows[0].ger.toFixed(1) + "%");
  setTxt("ex-s-bot", rows.at(-1).state + ", " + rows.at(-1).ger.toFixed(1) + "%");
  setTxt("ex-s-above", String(above));
  setTxt("ex-s-n", String(rows.length));
  setTxt("ex-s-spread", spread.toFixed(0));
  setTxt("ex-se-top", enrRows[0].state);
  setHTML("ex-se-topn", croreN(enrRows[0].enr) + pc(" cr"));
  setHTML("ex-se-top3", enrTop3Share.toFixed(0) + pc("%"));

  const geoE = { W: 1184, H: 30 + enrRows.length * 22 + 40, ml: 230, mr: 110, mt: 30, mb: 40 };
  const enrTicks = [0, 2000000, 4000000, 6000000];   // 20, 40, 60 lakh
  const plotEnr = Plot.plot({
    width: geoE.W, height: geoE.H,
    marginLeft: geoE.ml, marginRight: geoE.mr, marginTop: geoE.mt, marginBottom: geoE.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "estimated enrolment, lakh →", labelAnchor: "right", labelArrow: false, domain: [0, enrRows[0].enr * 1.15], ticks: enrTicks, tickSize: 0, tickPadding: 10, tickFormat: lakhTick },
    y: { label: null, domain: enrRows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(enrTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.ruleY(enrRows, { y: "state", x1: 0, x2: "enr", stroke: (d, i) => (i < 3 ? "#B9C3F3" : "#F0F2F5"), strokeWidth: 1.25 }),
      Plot.dot(enrRows, { y: "state", x: "enr", fill: (d, i) => (i < 3 ? "#2E4BD8" : "#5F6675"), r: 4 }),
      Plot.text(enrRows, { y: "state", x: "enr", dx: 12, text: (d) => (d.enr >= 1e5 ? lakhOf(d.enr) + " lakh" : fmtIN(d.enr)), fill: (d, i) => (i < 3 ? "#161A22" : "#878D99"), fontSize: 11.5, fontFamily: mono, fontWeight: (d, i) => (i < 3 ? 500 : 400), textAnchor: "start" }),
    ],
  });
  a11y(plotEnr, "Estimated student enrolment by state and union territory, 2021-22",
    "Sorted dot strip of " + enrRows.length + " states and union territories by enrolment volume. " + enrRows[0].state + " leads at " + croreN(enrRows[0].enr) + " crore, then " + enrRows[1].state + " and " + enrRows[2].state + "; the top three hold " + enrTop3Share.toFixed(0) + " per cent of all India.");
  document.getElementById("plot-states-enr").append(plotEnr);

  const csv = "state,ger_2021_22_pct,enrolment_2021_22\n" + rows.map((r) => {
    const e = enrRows.find((x) => x.state === r.state);
    return `"${r.state}",${r.ger.toFixed(2)},${e ? Math.round(e.enr) : ""}`;
  }).join("\n");
  wirePlate(document.getElementById("cb-states"), plot, "india-atlas_aishe_state-ger-enrolment_2021-22", csv);
}

/* ---------- § 07 plate 3 : GER by gender ---------- */
{
  const store = {
    female: { ...A.ger_all_female, label: "Female GER", color: "#2E4BD8" },
    male: { ...A.ger_all_male, label: "Male GER", color: "#5F6675" },
  };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 23, d1: 30 };
  const plot = linePanel(document.getElementById("plot-gergen"), ["female", "male"], store, geo, {
    yTicks: [24, 26, 28],
    yLabel: "↑ Gross Enrolment Ratio, %",
    yFmt: (d) => String(d) + "%",
    xTicks: xTicksA, xFmt: fy,
    leadWidth: 2.75,
    endFmt: (v) => v.toFixed(1) + "%",
    crossFmt: (v) => (v == null ? "—" : v.toFixed(1) + "%"),
    gapFrac: 0.12,
    preMarks: [Plot.ruleY([last(H.gpi) === 0 ? 0 : -1], { stroke: "transparent" })],
    a11yTitle: "Gross Enrolment Ratio by gender, All Categories, All India, 2017-18 to 2021-22",
    a11yDesc: "Two near-coincident rising lines: female GER (blue) at or above male GER (grey) across the window. Female GER ends at " + last(A.ger_all_female).toFixed(1) + " per cent, male at " + last(A.ger_all_male).toFixed(1) + ". The Gender Parity Index, their ratio, peaked at " + Math.max(...H.gpi.data.map((d) => d.value)).toFixed(2) + " and settled at " + last(H.gpi).toFixed(2) + ".",
  });

  const diff = last(A.ger_all_female) - last(A.ger_all_male);
  const peakGpi = Math.max(...H.gpi.data.map((d) => d.value));
  setHTML("pv-gergen", last(H.gpi).toFixed(2));
  setTxt("ex-gg-fem", last(A.ger_all_female).toFixed(1) + "%");
  setTxt("ex-gg-male", last(A.ger_all_male).toFixed(1) + "%");
  setTxt("ex-gg-diff", Math.abs(diff).toFixed(1));
  setTxt("ex-gg-gpi", last(H.gpi).toFixed(2));
  setTxt("ex-gg-peak", peakGpi.toFixed(2));

  wirePlate(document.getElementById("cb-gergen"), plot, "india-atlas_aishe_ger-by-gender_2017-2021", "fiscal_year,female_ger,male_ger,gender_parity_index\n" + H.gpi.data.map((d, i) => fy(d.date) + "," + A.ger_all_female.data[i].value + "," + A.ger_all_male.data[i].value + "," + H.gpi.data[i].value).join("\n"));
  wireLegend(document.getElementById("legend-gergen"), plot, ["female", "male"], store);
}

/* ---------- § 09 plate 5 : education-level small multiples ---------- */
{
  const LEVELS = [
    ["under_graduate", "Under Graduate"], ["post_graduate", "Post Graduate"], ["diploma", "Diploma"],
    ["integrated", "Integrated"], ["pg_diploma", "PG Diploma"], ["phd", "Ph.D."],
    ["certificate", "Certificate"], ["mphil", "M.Phil."],
  ];
  const dates = compositionBundle.dates.map((d) => new Date(d + "T00:00:00Z"));
  const cells = LEVELS.map(([k, name]) => {
    const s = C[k];
    const latest = last(s);
    const first = firstV(s);
    const growth = ((latest / first - 1) * 100);
    return { key: k, name, latest, first, growth, data: s.data };
  }).sort((a, b) => b.latest - a.latest);

  const intCell = cells.find((c) => c.key === "integrated");
  const mphilCell = cells.find((c) => c.key === "mphil");
  const phdCell = cells.find((c) => c.key === "phd");
  const ugCell = cells.find((c) => c.key === "under_graduate");
  setHTML("pv-edu", (intCell.growth >= 0 ? "+" : "") + intCell.growth.toFixed(0) + pc("%"));
  setHTML("ex-edu-ug", croreN(ugCell.latest) + pc(" cr"));
  setHTML("ex-edu-int-gain", Math.abs(intCell.growth).toFixed(0) + pc("%"));
  setHTML("ex-edu-mphil", Math.abs(mphilCell.growth).toFixed(0) + pc("%"));
  setHTML("ex-edu-phd", Math.abs(phdCell.growth).toFixed(0) + pc("%"));

  const grid = document.getElementById("grid-edu");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  grid.style.gap = "26px 26px";
  grid.setAttribute("role", "img");
  grid.setAttribute("aria-label", "Small-multiple grid of enrolment by education level, " + cells.length + " panels sorted by 2021-22 volume, each on its own scale. Under Graduate dominates at " + croreN(ugCell.latest) + " crore. Integrated grew " + intCell.growth.toFixed(0) + " per cent; M.Phil. fell " + mphilCell.growth.toFixed(0) + " per cent.");
  for (const c of cells) {
    const acc = c === ugCell;
    const color = acc ? "#2E4BD8" : "#878D99";
    const cell = document.createElement("div");
    const lab = document.createElement("div");
    lab.style.cssText = "font-family:var(--sans);font-size:.56rem;color:" + (acc ? "#2E4BD8" : "#878D99") + ";margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
    lab.textContent = c.name;
    const val = document.createElement("div");
    val.style.cssText = "font-family:var(--sans);font-size:.6rem;letter-spacing:.04em;color:#5F6675;margin-top:5px";
    const g = Math.round(c.growth);
    val.textContent = countWords(c.latest) + ", " + (g === 0 ? "no change" : (g > 0 ? "+" : "−") + Math.abs(g) + "%");
    const max = Math.max(...c.data.map((d) => d.value ?? 0));
    const min = Math.min(...c.data.filter((d) => d.value != null).map((d) => d.value));
    const mini = Plot.plot({
      width: 262, height: 70, marginLeft: 2, marginRight: 6, marginTop: 5, marginBottom: 2,
      style: { background: "transparent" },
      x: { axis: null },
      y: { axis: null, domain: [Math.min(min, max) * 0.92, max * 1.05] },
      marks: [
        Plot.ruleY([0], { stroke: "#ECEEF2" }),
        Plot.lineY(c.data, { x: "date", y: "value", stroke: color, strokeWidth: acc ? 1.75 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" }),
        Plot.dot([c.data.at(-1)], { x: "date", y: "value", fill: color, r: 2.2, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    mini.setAttribute("aria-hidden", "true");
    cell.append(lab, mini, val);
    grid.append(cell);
  }
  const csvHead = "fiscal_year," + cells.map((c) => c.key).join(",");
  const csvRows = dates.map((d, i) => fy(d) + "," + cells.map((c) => c.data[i].value ?? "").join(","));
  wirePlate(document.getElementById("cb-edu"), null, "india-atlas_aishe_enrolment-by-level_2017-2021", [csvHead, ...csvRows].join("\n"));
}

/* ---------- § 10 plate 6 : faculty hierarchy + gender ---------- */
{
  const FAC = [
    ["professor", "Professor & Eq."], ["reader_associate", "Reader / Assoc."], ["lecturer_assistant", "Lecturer / Asst."],
    ["temporary", "Temporary"], ["demonstrator", "Demonstrator / Tutor"],
  ];
  const li = teachersBundle.dates.length - 1;
  const rows = FAC.map(([k, label]) => ({
    rank: label,
    male: T[k + "_male"].data[li].value,
    female: T[k + "_female"].data[li].value,
    both: T[k + "_both"].data[li].value,
    fshare: T[k + "_female"].data[li].value / T[k + "_both"].data[li].value,
  }));
  const lecShare = T.lecturer_assistant_both.data[li].value / T.all_both.data[li].value;

  setHTML("pv-fac", (rows[0].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-fac-prof", (rows[0].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-fac-read", (rows[1].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-fac-lec", (rows[2].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-fac-temp", (rows[3].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-fac-dem", (rows[4].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-fac-lecn", (lecShare * 100).toFixed(0) + pc("%"));

  const maxV = Math.max(...rows.flatMap((r) => [r.male, r.female])) * 1.12;
  const flat = rows.flatMap((r) => [{ rank: r.rank, gender: "Male", v: r.male }, { rank: r.rank, gender: "Female", v: r.female }]);
  const plot = Plot.plot({
    width: 1184, height: 280, marginLeft: 180, marginRight: 150, marginTop: 14, marginBottom: 42,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "teachers, lakh →", labelAnchor: "right", labelArrow: false, domain: [0, maxV], ticks: [0, 250000, 500000, 750000, 1000000].filter((t) => t <= maxV), tickSize: 0, tickPadding: 10, tickFormat: lakhTick },   // no tick past the domain: it drew off the plate
    y: { label: null, domain: rows.map((r) => r.rank), tickSize: 0, tickPadding: 14, tickFormat: (s) => String(s), padding: 0.28 },
    marks: [
      Plot.gridX([0, 250000, 500000, 750000, 1000000].filter((t) => t <= maxV), { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.link(rows, { y: "rank", x1: "male", x2: "female", stroke: "#C9CED6", strokeWidth: 2 }),
      Plot.dot(flat.filter((d) => d.gender === "Male"), { y: "rank", x: "v", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot(flat.filter((d) => d.gender === "Female"), { y: "rank", x: "v", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      /* labels point AWAY from the connector: the left dot's label to its
       * left, the right dot's to its right — they can never meet mid-row */
      Plot.text(rows.filter((d) => d.male < d.female), { y: "rank", x: "male", dx: -12, text: (d) => countShort(d.male), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
      Plot.text(rows.filter((d) => d.male >= d.female), { y: "rank", x: "male", dx: 12, text: (d) => countShort(d.male), fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
      ...(() => {
        const pxU = (1184 - 180 - 150) / maxV;
        const fsplit = (d) => (countShort(d.female) + ", " + (d.fshare * 100).toFixed(0) + "% F");
        const crosses = (d) => 180 + d.female * pxU - 12 - fsplit(d).length * 12.5 * 0.6 < 180;
        return [
          Plot.text(rows.filter((d) => d.female <= d.male && !crosses(d)), { y: "rank", x: "female", dx: -12, text: fsplit, fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
          Plot.text(rows.filter((d) => d.female <= d.male && crosses(d)), { y: "rank", x: "female", dy: 17, text: fsplit, fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "middle" }),
        ];
      })(),
      Plot.text(rows.filter((d) => d.female > d.male), { y: "rank", x: "female", dx: 12, text: (d) => countShort(d.female) + ", " + (d.fshare * 100).toFixed(0) + "% F", fill: "#161A22", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Teachers by faculty rank and gender, All India, 2021-22",
    "Dumbbell chart of five faculty ranks, male (grey) and female (blue). Female share rises as rank falls: Professors " + (rows[0].fshare * 100).toFixed(0) + " per cent female, Lecturer/Assistant " + (rows[2].fshare * 100).toFixed(0) + ", Demonstrator/Tutor " + (rows[4].fshare * 100).toFixed(0) + ". The Lecturer/Assistant rank holds " + (lecShare * 100).toFixed(0) + " per cent of all teachers.");
  document.getElementById("plot-fac").append(plot);
  const csv = "faculty_rank,male,female,both,female_share_pct\n" + rows.map((r) => `"${r.rank}",${Math.round(r.male)},${Math.round(r.female)},${Math.round(r.both)},${(r.fshare * 100).toFixed(1)}`).join("\n");
  wirePlate(document.getElementById("cb-fac"), plot, "india-atlas_aishe_teachers-by-rank-gender_2021-22", csv);
}

/* ---------- § 11 plate 7 : PWD & minority enrolment ---------- */
{
  const GRP = [
    ["muslims", "Muslims"], ["other_minority", "Other Minority"], ["ews", "EWS"], ["pwd", "Persons With Disability"],
  ];
  const li = minorityBundle.dates.length - 1;
  const rows = GRP.map(([k, label]) => ({
    group: label,
    male: MN[k + "_male"]?.data[li]?.value ?? null,
    female: MN[k + "_female"]?.data[li]?.value ?? null,
    both: MN[k + "_both"]?.data[li]?.value ?? null,
  })).filter((r) => r.both != null);
  rows.forEach((r) => { r.fshare = r.female != null && r.both ? r.female / r.both : null; });

  setHTML("pv-min", countWords(last(MN.muslims_both)));
  setHTML("ex-min-mus", countWords(rows[0].both));
  setHTML("ex-min-musf", (rows[0].fshare * 100).toFixed(0) + pc("%"));
  setHTML("ex-min-om", countWords(rows[1].both));
  setHTML("ex-min-ews", countWords(rows[2].both));
  const pwdRow = rows.find((r) => r.group.startsWith("Persons"));
  setHTML("ex-min-pwd", fmtIN(pwdRow.both));
  setHTML("ex-min-pwdf", (pwdRow.fshare * 100).toFixed(0) + pc("%"));

  const maxV = Math.max(...rows.map((r) => r.both)) * 1.15;
  const flat = rows.flatMap((r) => [
    { group: r.group, gender: "Male", v: r.male },
    { group: r.group, gender: "Female", v: r.female },
  ].filter((d) => d.v != null));
  /* men and women side by side in each row, never overlaid: men the upper half-band (grey),
   * women the lower (blue), each labelled at its own bar end */
  const H7 = 300, bandPx = (H7 - 14 - 42) / rows.length * (1 - 0.28), half = bandPx / 2;
  const lab = (d) => countWords(d.v) + (d.gender === "Male" ? " men" : " women");
  const plot = Plot.plot({
    width: 1184, height: H7, marginLeft: 210, marginRight: 150, marginTop: 14, marginBottom: 42,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "estimated enrolment, lakh →", labelAnchor: "right", labelArrow: false, domain: [0, maxV], tickSize: 0, tickPadding: 10, tickFormat: lakhTick },
    y: { label: null, domain: rows.map((r) => r.group), tickSize: 0, tickPadding: 14, tickFormat: (s) => String(s), padding: 0.28 },
    marks: [
      Plot.gridX([0, 500000, 1000000, 1500000, 2000000], { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.barX(flat.filter((d) => d.gender === "Male"), { y: "group", x: "v", fill: "#A3A9B4", insetBottom: half + 1 }),
      Plot.barX(flat.filter((d) => d.gender === "Female"), { y: "group", x: "v", fill: "#2E4BD8", insetTop: half + 1 }),
      Plot.text(flat.filter((d) => d.gender === "Male"), { y: "group", x: "v", dx: 8, dy: -half / 2, text: lab, fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
      Plot.text(flat.filter((d) => d.gender === "Female"), { y: "group", x: "v", dx: 8, dy: half / 2, text: lab, fill: "#161A22", fontSize: 12, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Estimated enrolment of PWD and minority communities by gender, All India, 2021-22",
    "Horizontal bars per group, male (grey) and female (blue). Muslims lead at " + fmtIN(rows[0].both) + " enrolled, then Other Minority Communities at " + fmtIN(rows[1].both) + ", EWS at " + fmtIN(rows[2].both) + " (first reported 2020-21), and Persons With Disability at " + fmtIN(pwdRow.both) + ". Female share: Muslims " + (rows[0].fshare * 100).toFixed(0) + " per cent, PWD " + (pwdRow.fshare * 100).toFixed(0) + " per cent. These are counts, not access rates: the denominator for each group is not served.");
  document.getElementById("plot-min").append(plot);
  const csv = "group,male,female,both,female_share_pct\n" + rows.map((r) => `"${r.group}",${r.male ?? ""},${r.female ?? ""},${r.both},${r.fshare != null ? (r.fshare * 100).toFixed(1) : ""}`).join("\n");
  wirePlate(document.getElementById("cb-min"), plot, "india-atlas_aishe_minority-enrolment_2021-22", csv);
}

/* ---------- § 12 plate 8 : PTR ---------- */
{
  const store = { ptr: { ...H.ptr, label: "PTR", color: "#2E4BD8" } };
  const geo = { W: 1184, H: 300, ml: 70, mr: 230, mt: 30, mb: 42, d0: 24, d1: 30 };
  const plot = linePanel(document.getElementById("plot-ptr"), ["ptr"], store, geo, {
    yTicks: [25, 27, 29],
    yLabel: "↑ Pupil-Teacher Ratio, students per teacher",
    yFmt: (d) => String(d),
    xTicks: xTicksA, xFmt: fy,
    leadWidth: 2.75, leadDash: "5 4",
    endFmt: (v) => String(Math.round(v)),
    crossFmt: (v) => (v == null ? "—" : String(Math.round(v))),
    gapFrac: 0.1,
    a11yTitle: "Pupil-Teacher Ratio, all institutions, All India, 2017-18 to 2021-22",
    a11yDesc: "A dashed line from " + Math.round(firstV(H.ptr)) + " to " + Math.round(last(H.ptr)) + " students per teacher. The ratio fell slightly: teachers were added a little faster than students.",
  });

  setHTML("pv-ptr", String(Math.round(last(H.ptr))));
  setTxt("ex-ptr-now", String(Math.round(last(H.ptr))));
  setTxt("ex-ptr-first", String(Math.round(firstV(H.ptr))));
  setHTML("ex-ptr-teach", countWords(last(H.teachers)));

  wirePlate(document.getElementById("cb-ptr"), plot, "india-atlas_aishe_ptr_2017-2021", "fiscal_year,pupil_teacher_ratio\n" + H.ptr.data.map((d) => fy(d.date) + "," + d.value).join("\n"));
  wireLegend(document.getElementById("legend-ptr"), plot, ["ptr"], store);
}


/* ---------- § 13 the states, closer (wave 2) ---------- */
const LI = headlineBundle.dates.length - 1;
const stShort = (s) => ({ "Andaman & Nicobar Islands": "Andaman & Nicobar", "Dadra & Nagar Haveli and Daman & Diu": "DNH and Daman & Diu" })[s] || s;
const stBars = (el, rows, { xMax, xTicks, xLabel, hl, fmtV, dots, refLine }) => {
  const plot = Plot.plot({
    width: 1184, height: 30 + rows.length * 24 + 44, marginLeft: 210, marginRight: 90, marginTop: 30, marginBottom: 44,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: xLabel, labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickSize: 0, tickPadding: 10 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(xTicks.slice(1), { stroke: "#F0F2F5" }),
      ...(refLine ? [Plot.ruleX([refLine.v], { stroke: "#878D99", strokeDasharray: "3 3" }), Plot.text([refLine], { x: "v", frameAnchor: "top", dy: -14, text: (d) => d.label, fill: "#4A5160", fontSize: 11.5, textAnchor: "middle" })] : []),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? "#2E4BD8" : "#C9CED6"), insetTop: 6, insetBottom: 6 }),
      ...(dots ? [Plot.dot(rows, { y: "name", x: "d", r: 4, fill: "#C47A16", stroke: "#fff", strokeWidth: 1.25 })] : []),
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.v, dots ? d.d : 0), dx: 10, text: (d) => fmtV(d), textAnchor: "start", fill: "#161A22", fontSize: 12, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: "#B5BAC4" }),
    ],
  });
  el.append(plot);
  return plot;
};

{
  // pupil-teacher ratio by state, regular students, all institutions
  const ent = Object.entries(ptrBundle.series).filter(([k]) => k.endsWith("__ptr_regular_all") && !k.startsWith("all_india"))
    .map(([, s]) => ({ name: stShort(s.group), v: s.data[LI] })).filter((d) => d.v != null && d.v > 0).sort((a, c) => c.v - a.v);
  const ai = ptrBundle.series.all_india__ptr_regular_all.data[LI];
  const plot = stBars(document.getElementById("plot-stptr"), ent, { xMax: Math.ceil(ent[0].v / 10) * 10 + 4, xTicks: [0, 10, 20, 30, 40, 50, 60, 70].filter((t) => t <= ent[0].v + 6), xLabel: "regular students per teacher →",
    hl: (d) => d.v > ai, fmtV: (d) => String(Math.round(d.v)) });
  a11y(plot, "Pupil-teacher ratio by state, regular students, 2021-22", ent.slice(0, 4).map((d) => `${d.name} ${Math.round(d.v)}`).join(", ") + "; lowest " + ent.at(-1).name + " " + Math.round(ent.at(-1).v));
  setHTML("pv-stptr", String(Math.round(ent[0].v)));
  setHTML("ex-stptr-hi", `${ent[0].name}, ${Math.round(ent[0].v)}`);
  setHTML("ex-stptr-lo", `${ent.at(-1).name}, ${Math.round(ent.at(-1).v)}`);
  setHTML("ex-stptr-ai", String(Math.round(ai)));
  wirePlate(document.getElementById("cb-stptr"), plot, "india-atlas_aishe_ptr-by-state_2021-22", "state,ptr_regular_all_institutions,ptr_regular_and_distance_all_institutions\n" +
    ent.map((d) => { const k = Object.keys(ptrBundle.series).find((k) => stShort(ptrBundle.series[k].group) === d.name && k.endsWith("__ptr_reg_dist_all")); return `"${d.name}",${d.v},${k ? ptrBundle.series[k].data[LI] ?? "" : ""}`; }).join("\n"));
}

{
  // women's share of teachers (bars) and of students (dots), by state
  const share = (b, k, f, t) => { const a = b.series[k.replace(t, f)]?.data[LI], z = b.series[k]?.data[LI]; return a != null && z ? (a / z) * 100 : null; };
  const ent = Object.entries(stTeachersBundle.series).filter(([k]) => k.endsWith("__all_both") && !k.startsWith("all_india")).map(([k, s]) => {
    const st = k.slice(0, -"__all_both".length);
    return { name: stShort(s.group), v: share(stTeachersBundle, k, "__all_female", "__all_both"), d: share(stEnrolBundle, `${st}__grand_total_both`, "__grand_total_female", "__grand_total_both") };
  }).filter((d) => d.v != null && d.d != null).sort((a, c) => a.v - c.v);
  const aiT = share(stTeachersBundle, "all_india__all_both", "__all_female", "__all_both"), aiS = share(stEnrolBundle, "all_india__grand_total_both", "__grand_total_female", "__grand_total_both");
  const plot = stBars(document.getElementById("plot-stwomen"), ent, { xMax: 90, xTicks: [0, 20, 40, 60, 80], xLabel: "per cent →", dots: true,
    hl: (d) => d.v < aiT, fmtV: (d) => `${d.v.toFixed(0)}% / ${d.d.toFixed(0)}%` });
  a11y(plot, "Women's share of college teachers and students, by state, 2021-22", ent.slice(0, 3).map((d) => `${d.name} ${d.v.toFixed(0)}% of teachers, ${d.d.toFixed(0)}% of students`).join("; "));
  setHTML("pv-stwomen", aiT.toFixed(0) + pc("%"));
  setHTML("ex-stw-hi", `${ent.at(-1).name}, ${ent.at(-1).v.toFixed(0)}%`);
  setHTML("ex-stw-lo", `${ent[0].name}, ${ent[0].v.toFixed(0)}%`);
  setHTML("ex-stw-ai", aiT.toFixed(0) + "%");
  setHTML("ex-stw-ais", aiS.toFixed(0) + "%");
  wirePlate(document.getElementById("cb-stwomen"), plot, "india-atlas_aishe_women-teachers-students-by-state_2021-22", "state,women_share_of_teachers_pct,women_share_of_students_pct\n" + ent.map((d) => `"${d.name}",${d.v.toFixed(2)},${d.d.toFixed(2)}`).join("\n"));
}

{
  // colleges by state
  const all = Object.entries(stInstBundle.series).filter(([k]) => k.endsWith("__colleges") && !k.startsWith("all_india"))
    .map(([k, s]) => ({ name: stShort(s.group), v: s.data[LI], u: stInstBundle.series[k.replace("__colleges", "__universities")]?.data[LI] ?? null })).filter((d) => d.v != null).sort((a, c) => c.v - a.v);
  const tot = stInstBundle.series.all_india__colleges.data[LI];
  const rows = all.slice(0, 20);
  const plot = stBars(document.getElementById("plot-stcol"), rows, { xMax: Math.ceil(rows[0].v / 1000) * 1000 + 500, xTicks: [0, 2000, 4000, 6000, 8000], xLabel: "colleges →",
    hl: (d, i) => d === rows[0], fmtV: (d) => d.v.toLocaleString("en-IN") });
  a11y(plot, "Colleges by state, 2021-22", rows.slice(0, 5).map((d) => `${d.name} ${d.v.toLocaleString("en-IN")}`).join(", "));
  setHTML("pv-stcol", tot.toLocaleString("en-IN"));
  setTxt("ex-stc-n1", rows[0].name);
  setHTML("ex-stc-v1", rows[0].v.toLocaleString("en-IN"));
  setHTML("ex-stc-s1", ((rows[0].v / tot) * 100).toFixed(0) + "%");
  setHTML("ex-stc-univ", fmtIN(last(H.universities)));
  setHTML("ex-stc-univ0", fmtIN(firstV(H.universities)));
  wirePlate(document.getElementById("cb-stcol"), plot, "india-atlas_aishe_colleges-by-state_2021-22", "state,colleges,universities\n" + all.map((d) => `"${d.name}",${d.v},${d.u ?? ""}`).join("\n"));
}

/* ---------- provenance ---------- */
setTxt("prov-vintage", headlineBundle.meta.vintage);
setTxt("prov-vintage2", headlineBundle.meta.vintage);
