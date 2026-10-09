// Dossier 10 · Women and Men in India — plate definitions and number wiring.
// Data: data/series/gender-*.json (8 bundles), baked at build time by
// scripts/fetch.mjs from the MoSPI "Women and Men in India" multi-source
// compendium. Each indicator draws on a different source (Census, SRS, NFHS,
// PLFS, NCRB); none is spliced with another. The varying cadences make a
// shared date axis impossible — each bundle carries its own.

import * as Plot from "@observablehq/plot";
import sexratioBundle from "../../data/series/gender-sexratio.json";
import imrBundle from "../../data/series/gender-imr.json";
import lifeexpBundle from "../../data/series/gender-lifeexp.json";
import mmrBundle from "../../data/series/gender-mmr.json";
import fertilityBundle from "../../data/series/gender-fertility.json";
import literacyBundle from "../../data/series/gender-literacy.json";
import workBundle from "../../data/series/gender-work.json";
import statesBundle from "../../data/series/gender-states.json";
import {
  MONO as mono, hydrate, wireTools, a11y, addCrosshair, wireLegend,
  dodgeEndLabels, spark, downloadSVG, downloadPNG, saveBlob,
} from "../charts/plumbing.js";

const SR = hydrate(sexratioBundle);
const IMR = hydrate(imrBundle);
const LE = hydrate(lifeexpBundle);
const MMR = hydrate(mmrBundle);
const TFR = hydrate(fertilityBundle);
const LIT = hydrate(literacyBundle);
const WK = hydrate(workBundle);
const ST = hydrate(statesBundle);

/* ---------- formatters ---------- */
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = (u) => `<span class="pc">${u}</span>`;
const yr = (d) => String(d.getUTCFullYear());
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const prevV = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const firstV = (s) => s.data.filter((d) => d.value != null)[0].value;
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));

/* ---------- titleblock ---------- */
setHTML("n-sr", String(last(SR.sex_ratio)) + pc("♀/1000♂"));
setHTML("d-sr", `<b>${arrow(last(SR.sex_ratio) - prevV(SR.sex_ratio), (v) => String(Math.round(v)))}</b> vs ${yr(SR.sex_ratio.data.at(-2).date)} census`);
setHTML("n-lfpr", last(WK.lfpr_female).toFixed(1) + pc("%"));
setHTML("d-lfpr", `<b>${arrow(last(WK.lfpr_female) - prevV(WK.lfpr_female), (v) => v.toFixed(1) + " pt")}</b> vs ${yr(WK.lfpr_female.data.at(-2).date)}`);
setHTML("n-mmr", String(Math.round(last(MMR.mmr))));
setHTML("d-mmr", `<b>▼ −${Math.round(last(MMR.mmr) - prevV(MMR.mmr))}</b> vs ${prevV(MMR.mmr)}, 2017-19`);
{
  const fObs = LE.life_exp_female.data.filter((d) => d.value != null);
  const mObs = LE.life_exp_male.data.filter((d) => d.value != null);
  // latest observed = the last point before projections (before 2021)
  const fLatest = fObs.filter((d) => d.date.getUTCFullYear() <= 2020).at(-1);
  const mLatest = mObs.filter((d) => d.date.getUTCFullYear() <= 2020).at(-1);
  const gap = (fLatest.value - mLatest.value);
  setHTML("n-le", "+" + gap.toFixed(1) + pc("yr"));
  setHTML("d-le", `<b>♀ ${fLatest.value.toFixed(1)}, ♂ ${mLatest.value.toFixed(1)}</b>, latest observed`);
}
// titleblock sparkline for sex ratio
{
  const vs = SR.sex_ratio.data.map((d) => d.value);
  const plot = Plot.plot({ width: 190, height: 44, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4, style: { background: "transparent" }, x: { axis: null }, y: { axis: null, domain: [Math.min(...vs) - 5, Math.max(...vs) + 5] }, marks: [Plot.ruleY([927], { stroke: "#ECEEF2" }), Plot.lineY(SR.sex_ratio.data, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 1.5, strokeLinejoin: "round" }), Plot.dot([SR.sex_ratio.data.at(-1)], { x: "date", y: "value", fill: "#2E4BD8", r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 })] });
  plot.setAttribute("aria-hidden", "true");
  document.getElementById("nspark-sr").append(plot);
}

/* ---------- § 01 current reading ---------- */
setHTML("rb-sr", String(last(SR.sex_ratio)) + pc("/1000"));
setHTML("rb-mmr", String(Math.round(last(MMR.mmr))));
setTxt("rt-mmr0", String(firstV(MMR.mmr)));
setTxt("rt-mmr1", String(Math.round(last(MMR.mmr))));
setTxt("cr-sr", String(last(SR.sex_ratio)));
setTxt("cr-sr-nadir", String(Math.min(...SR.sex_ratio.data.map((d) => d.value))));
setTxt("cr-imr", String(last(IMR.imr_person)));
{
  const fO = LE.life_exp_female.data.filter((d) => d.value != null && d.date.getUTCFullYear() <= 2020).at(-1);
  const mO = LE.life_exp_male.data.filter((d) => d.value != null && d.date.getUTCFullYear() <= 2020).at(-1);
  setHTML("cr-le-gap", (fO.value - mO.value).toFixed(1) + pc(" yr"));
}
setHTML("cr-mmr", String(Math.round(last(MMR.mmr))) + pc("/100k"));
setHTML("cr-mmr-drop", Math.round((1 - last(MMR.mmr) / firstV(MMR.mmr)) * 100) + pc("%"));
setHTML("cr-lit-f", last(LIT.literacy_female).toFixed(1) + pc("%"));
setHTML("cr-lit-m", last(LIT.literacy_male).toFixed(1) + pc("%"));
setHTML("cr-lfpr-f", last(WK.lfpr_female).toFixed(1) + pc("%"));
setHTML("cr-lfpr-m", last(WK.lfpr_male).toFixed(1) + pc("%"));

/* ---------- § 02 register ---------- */
const regRows = [
  [SR.sex_ratio, "Sex ratio", "Census, females per 1,000 males", "s-acc", (v) => String(v), (v) => String(v)],
  [MMR.mmr, "Maternal Mortality Ratio", "SRS, per 100,000 live births", "s-g1", (v) => String(Math.round(v)), (v) => String(Math.round(v))],
  [IMR.imr_female, "Infant Mortality, Female", "SRS, per 1,000 live births", "s-g2", (v) => String(Math.round(v)), (v) => String(Math.round(v))],
  [LE.life_exp_female, "Life expectancy, Female", "SRS, years at birth", "s-g3", (v) => v.toFixed(1), (v) => v.toFixed(1)],
  [LIT.literacy_female, "Literacy, Female", "Census/NSO, age 7+, per cent", "s-g4", (v) => v.toFixed(1) + "%", (v) => v.toFixed(1)],
  [WK.lfpr_female, "LFPR, Female", "PLFS, 15+, usual status, per cent", "s-acc", (v) => v.toFixed(1) + "%", (v) => v.toFixed(1)],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sub, sw, fV, fD], i) => {
  const data = s.data.filter((d) => d.value != null);
  return `<tr><td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td><td class="val">${fV(data.at(-1).value)}</td><td class="chg">${data.length > 1 ? arrow(data.at(-1).value - data.at(-2).value, fD) + " · vs " + yr(data.at(-2).date) : "—"}</td><td class="yr">${fV(data[0].value)}, ${yr(data[0].date)}</td><td class="spark" id="sp-g${i}"></td></tr>`;
}).join("");
regRows.forEach(([s], i) => spark(`sp-g${i}`, { ...s, color: "#2E4BD8" }));

/* ---------- shared line-panel renderer ---------- */
function linePanel(el, keys, store, geo, opts) {
  const seriesList = keys.map((k) => store[k]);
  const dts = seriesList[0].data.map((d) => d.date);
  const dodged = dodgeEndLabels(seriesList, (geo.d1 - geo.d0) * (opts.gapFrac ?? 0.07));
  const marks = [
    Plot.gridY(opts.yTicks, { stroke: "#EEF0F3", strokeWidth: 1 }),
    Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    ...(opts.preMarks || []),
    ...keys.slice(1).map((k) => Plot.lineY(store[k].data, { x: "date", y: "value", stroke: store[k].color, strokeWidth: opts.supportWidth ?? 1.75, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: opts.supportDash })),
    Plot.lineY(store[keys[0]].data, { x: "date", y: "value", stroke: store[keys[0]].color, strokeWidth: opts.leadWidth ?? 2, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: opts.leadDash }),
    ...(opts.postMarks || []),
    ...seriesList.map((s) => Plot.dot([s.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: s.color, r: s === seriesList[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodged.map((p) => Plot.text([{ date: dts.at(-1), y: p.y }], { x: "date", y: "y", text: () => `${p.s.label.split(" · ")[0]} ${opts.endFmt(p.value)}`, dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: p.s === seriesList[0] ? 500 : 400, textAnchor: "start" })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 14, ticks: opts.xTicks, tickFormat: opts.xFmt },
    y: { label: opts.yLabel, labelAnchor: "top", labelArrow: false, tickFormat: opts.yFmt, ticks: opts.yTicks, domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks,
  });
  a11y(plot, opts.a11yTitle, opts.a11yDesc);
  el.append(plot);
  if (opts.crossFmt) addCrosshair(el, plot, seriesList, geo, opts.xFmt, opts.crossFmt);
  return plot;
}
function wirePlate(blockEl, plot, filename, csvText) {
  const meta = { title: blockEl.querySelector(".plate-head h3")?.textContent.trim(), sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(), foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => { btn.addEventListener("click", () => { const kind = btn.dataset.dl; if (kind === "svg" && plot) downloadSVG(plot, filename, meta); if (kind === "png" && plot) downloadPNG(plot, filename, meta); if (kind === "csv") saveBlob(new Blob([csvText], { type: "text/csv" }), filename + ".csv"); }); });
}

/* ---------- § 03 balance sheet : dumbbell ---------- */
{
  const fO = LE.life_exp_female.data.filter((d) => d.value != null && d.date.getUTCFullYear() <= 2020).at(-1);
  const mO = LE.life_exp_male.data.filter((d) => d.value != null && d.date.getUTCFullYear() <= 2020).at(-1);
  const metrics = [
    { name: "Life expectancy, years", male: mO.value, female: fO.value, fmt: (v) => v.toFixed(1) },
    { name: "IMR, per 1,000", male: last(IMR.imr_male), female: last(IMR.imr_female), fmt: (v) => String(Math.round(v)) },
    { name: "Literacy, per cent", male: last(LIT.literacy_male), female: last(LIT.literacy_female), fmt: (v) => v.toFixed(1) + "%" },
    { name: "LFPR, per cent", male: last(WK.lfpr_male), female: last(WK.lfpr_female), fmt: (v) => v.toFixed(1) + "%" },
  ];
  setHTML("pv-balance", "+" + (fO.value - mO.value).toFixed(1) + pc("yr"));
  setHTML("ex-b-le", "+" + (fO.value - mO.value).toFixed(1));
  setHTML("ex-b-lit", (last(LIT.literacy_male) - last(LIT.literacy_female)).toFixed(0));
  setHTML("ex-b-lfpr", (last(WK.lfpr_male) - last(WK.lfpr_female)).toFixed(0));
  setTxt("ex-b-imr", "♀ " + Math.round(last(IMR.imr_female)) + ", ♂ " + Math.round(last(IMR.imr_male)));

  // normalise each metric to 0-1 for the dumbbell (own scale per row); guard
  // the equal-M/F case (IMR 28 vs 28) where the range is zero
  const rows = metrics.flatMap((m) => [{ name: m.name, gender: "Male", v: m.male, raw: m.fmt(m.male) }, { name: m.name, gender: "Female", v: m.female, raw: m.fmt(m.female) }]);
  metrics.forEach((m) => { const lo = Math.min(m.male, m.female), hi = Math.max(m.male, m.female); const span = hi - lo || hi * 0.1 || 1; m.lo = lo - span * 0.15; m.hi = hi + span * 0.15; });
  const norm = (m, v) => m.hi > m.lo ? (v - m.lo) / (m.hi - m.lo) : 0.5;
  const plot = Plot.plot({
    width: 1184, height: 260, marginLeft: 200, marginRight: 200, marginTop: 14, marginBottom: 42,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: "← male · normalised scale · female →", labelAnchor: "right", labelArrow: false, domain: [0, 1], ticks: [0, 0.5, 1], tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d === 0 ? "low" : d === 1 ? "high" : "") },
    y: { label: null, domain: metrics.map((m) => m.name).reverse(), tickSize: 0, tickPadding: 14, tickFormat: (s) => String(s), padding: 0.32 },
    marks: [
      Plot.gridX([0.5], { stroke: "#F0F2F5", strokeWidth: 1 }),
      metrics.map((m) => Plot.link([m], { y: "name", x1: (d) => norm(d, d.male), x2: (d) => norm(d, d.female), stroke: "#C9CED6", strokeWidth: 2 })),
      metrics.map((m) => Plot.dot([{ name: m.name, g: "Male", x: norm(m, m.male) }], { y: "name", x: "x", fill: "#5F6675", r: 7, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      metrics.map((m) => Plot.dot([{ name: m.name, g: "Female", x: norm(m, m.female) }], { y: "name", x: "x", fill: "#2E4BD8", r: 7, stroke: "#FFFFFF", strokeWidth: 1.5 })),
      metrics.map((m) => Plot.text([{ name: m.name, x: norm(m, m.male) }], { y: "name", x: "x", dx: -14, text: () => m.fmt(m.male), fill: "#5F6675", fontSize: 12, fontFamily: mono, textAnchor: "end" })),
      metrics.map((m) => Plot.text([{ name: m.name, x: norm(m, m.female) }], { y: "name", x: "x", dx: 14, text: () => m.fmt(m.female), fill: "#161A22", fontSize: 12, fontFamily: mono, fontWeight: 500, textAnchor: "start" })),
    ].flat(),
  });
  a11y(plot, "Women and men compared on survival, education and work, latest available",
    "Four dumbbells, male (grey) and female (blue), each on its own scale. Life expectancy favours women by " + (fO.value - mO.value).toFixed(1) + " years; IMR is equal; literacy and LFPR favour men: the LFPR gap of " + (last(WK.lfpr_male) - last(WK.lfpr_female)).toFixed(0) + " points is the widest.");
  document.getElementById("plot-balance").append(plot);
  const csv = "metric,male,female\n" + metrics.map((m) => `"${m.name}",${m.male},${m.female}`).join("\n");
  wirePlate(document.getElementById("cb-balance"), plot, "india-atlas_gender_balance-sheet_latest", csv);
}

/* ---------- § 04 sex ratio headline ---------- */
{
  const store = { sex_ratio: { ...SR.sex_ratio, label: "Sex ratio", color: "#2E4BD8" } };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 920, d1: 950 };
  const xTicks = [1951, 1961, 1971, 1981, 1991, 2001, 2011].map((y) => new Date(Date.UTC(y, 0, 1)));
  const nadir = Math.min(...SR.sex_ratio.data.map((d) => d.value));
  const nadirPt = SR.sex_ratio.data.find((d) => d.value === nadir);
  const plot = linePanel(document.getElementById("plot-sr"), ["sex_ratio"], store, geo, {
    yTicks: [925, 935, 945],
    yLabel: "↑ females per 1,000 males",
    yFmt: (d) => String(d),
    xTicks, xFmt: yr,
    leadWidth: 3,
    endFmt: (v) => String(v),
    crossFmt: (v) => (v == null ? "—" : String(v)),
    gapFrac: 0.1,
    postMarks: [
      Plot.dot([nadirPt], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([nadirPt], { x: "date", y: "value", text: () => "1991 nadir, " + nadir, dx: 0, dy: 28, fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "middle" }),
    ],
    a11yTitle: "Sex ratio, All India, Census 1951-2011",
    a11yDesc: "Seven census points: 946 (1951) falling to 927 (1991), the nadir, then recovering to 943 (2011): still below the 1951 level.",
  });
  setHTML("pv-sr", firstV(SR.sex_ratio) + " → " + last(SR.sex_ratio));
  setTxt("ex-sr-now", String(last(SR.sex_ratio)));
  setTxt("ex-sr-nadir", String(nadir));
  setTxt("ex-sr-swing", "+" + (last(SR.sex_ratio) - nadir));
  setTxt("ex-sr-gap", String(firstV(SR.sex_ratio) - last(SR.sex_ratio)));
  wirePlate(document.getElementById("cb-sr"), plot, "india-atlas_gender_sex-ratio_1951-2011", "census_year,sex_ratio\n" + SR.sex_ratio.data.map((d) => yr(d.date) + "," + d.value).join("\n"));
}

/* ---------- § 06 MMR ---------- */
{
  const store = { mmr: { ...MMR.mmr, label: "MMR", color: "#2E4BD8" } };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 80, d1: 270 };
  const xTicks = [2004, 2007, 2010, 2014, 2018].map((y) => new Date(Date.UTC(y, 0, 1)));
  const plot = linePanel(document.getElementById("plot-mmr"), ["mmr"], store, geo, {
    yTicks: [100, 150, 200, 250],
    yLabel: "↑ maternal deaths per 100,000 live births",
    yFmt: (d) => String(d),
    xTicks, xFmt: yr,
    leadWidth: 3,
    endFmt: (v) => String(Math.round(v)),
    crossFmt: (v) => (v == null ? "—" : String(Math.round(v))),
    gapFrac: 0.1,
    postMarks: [Plot.ruleY([97], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }), Plot.text([{ date: new Date(Date.UTC(2004, 0, 1)), value: 102 }], { x: "date", y: "value", text: ["latest, 97"], dx: 0, fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" })],
    a11yTitle: "Maternal Mortality Ratio, All India, 2004-06 to 2018-20",
    a11yDesc: "A steeply falling line from 254 (2004-06) to 97 (2018-20): a 62 per cent decline in 14 years.",
  });
  setHTML("pv-mmr", firstV(MMR.mmr) + " → " + Math.round(last(MMR.mmr)));
  setTxt("ex-mmr-now", String(Math.round(last(MMR.mmr))));
  setTxt("ex-mmr-first", String(firstV(MMR.mmr)));
  setHTML("ex-mmr-drop", Math.round((1 - last(MMR.mmr) / firstV(MMR.mmr)) * 100) + pc("%"));
  wirePlate(document.getElementById("cb-mmr"), plot, "india-atlas_gender_mmr_2004-2020", "period_start_year,mmr\n" + MMR.mmr.data.map((d) => yr(d.date) + "," + d.value).join("\n"));
}

/* ---------- § 06 IMR by gender ---------- */
{
  const store = { female: { ...IMR.imr_female, label: "Female IMR", color: "#2E4BD8" }, male: { ...IMR.imr_male, label: "Male IMR", color: "#5F6675" } };
  const geo = { W: 1184, H: 380, ml: 70, mr: 230, mt: 30, mb: 42, d0: 24, d1: 58 };
  const xTicks = [2008, 2011, 2014, 2017, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const plot = linePanel(document.getElementById("plot-imr"), ["female", "male"], store, geo, {
    yTicks: [30, 40, 50],
    yLabel: "↑ infant deaths per 1,000 live births",
    yFmt: (d) => String(d),
    xTicks, xFmt: yr,
    gapFrac: 0.1,
    endFmt: (v) => String(Math.round(v)),
    crossFmt: (v) => (v == null ? "—" : String(Math.round(v))),
    a11yTitle: "Infant Mortality Rate by gender, All India, SRS 2008-2020",
    a11yDesc: "Two falling lines. Female IMR (blue) started above male (55 vs 52), the reverse of biology, and converged to equality (28 vs 28) by 2020.",
  });
  setTxt("pv-imr", String(last(IMR.imr_female)));
  setTxt("ex-imr-m", String(last(IMR.imr_male)));
  setTxt("ex-imr-f", String(last(IMR.imr_female)));
  setTxt("ex-imr-gap0", String(firstV(IMR.imr_female) - firstV(IMR.imr_male)) + " (♀ higher)");
  setTxt("ex-imr-now", String(last(IMR.imr_person)));
  wirePlate(document.getElementById("cb-imr"), plot, "india-atlas_gender_imr-by-gender_2008-2020", "year,imr_male,imr_female,imr_person\n" + IMR.imr_male.data.map((d, i) => yr(d.date) + "," + d.value + "," + IMR.imr_female.data[i].value + "," + IMR.imr_person.data[i].value).join("\n"));
  wireLegend(document.getElementById("legend-imr"), plot, ["female", "male"], store);
}

/* ---------- § 07 life expectancy ---------- */
{
  const store = { female: { ...LE.life_exp_female, label: "Female", color: "#2E4BD8" }, male: { ...LE.life_exp_male, label: "Male", color: "#5F6675" } };
  const projStart = new Date(Date.UTC(2021, 0, 1));
  const splitAt = (s) => { const obs = s.data.filter((d) => d.value != null && d.date < projStart); const proj = s.data.filter((d) => d.value != null && d.date >= projStart); return { obs, proj, bridge: obs.length ? [obs.at(-1), proj[0]].filter(Boolean) : [] }; };
  const fS = splitAt(store.female), mS = splitAt(store.male);
  const xTicks = [1990, 2000, 2010, 2020, 2030].map((y) => new Date(Date.UTC(y, 0, 1)));
  const geo = { W: 1184, H: 460, ml: 70, mr: 230, mt: 30, mb: 42, d0: 57, d1: 77 };
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: null, tickSize: 0, tickPadding: 14, ticks: xTicks, tickFormat: yr },
    y: { label: "↑ life expectancy at birth, years", labelAnchor: "top", labelArrow: false, tickFormat: (d) => String(d), ticks: [60, 65, 70, 75], domain: [geo.d0, geo.d1], tickSize: 0, tickPadding: 11 },
    marks: [
      Plot.gridY([60, 65, 70, 75], { stroke: "#EEF0F3", strokeWidth: 1 }),
      Plot.ruleY([geo.d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
      Plot.ruleX([projStart], { stroke: "#DADDE3", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: projStart, value: 58.5 }], { x: "date", y: "value", text: ["projected →"], dx: 6, fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      // observed: solid lines
      Plot.lineY(mS.obs, { x: "date", y: "value", stroke: "#5F6675", strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(fS.obs, { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      // projected: dashed, with a bridge segment connecting observed last to projected first
      Plot.lineY([...fS.bridge, ...fS.proj], { x: "date", y: "value", stroke: "#2E4BD8", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: "5 4" }),
      Plot.lineY([...mS.bridge, ...mS.proj], { x: "date", y: "value", stroke: "#5F6675", strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round", strokeDasharray: "5 4" }),
      // end dots + labels
      Plot.dot([store.female.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot([store.male.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([store.female.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", text: (d) => "Female " + d.value.toFixed(1), dx: 16, fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text([store.male.data.filter((d) => d.value != null).at(-1)], { x: "date", y: "value", text: (d) => "Male " + d.value.toFixed(1), dx: 16, fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "start" }),
    ],
  });
  a11y(plot, "Life expectancy at birth by gender, All India, 1990-94 to 2031-36",
    "Two rising lines, female (blue) above male (grey) throughout. Observed to 2016-20, projected (dashed) after. Female ends at " + last(LE.life_exp_female).toFixed(1) + ", male at " + last(LE.life_exp_male).toFixed(1) + ".");
  document.getElementById("plot-le").append(plot);
  const fO = LE.life_exp_female.data.filter((d) => d.value != null && d.date.getUTCFullYear() <= 2020).at(-1);
  const mO = LE.life_exp_male.data.filter((d) => d.value != null && d.date.getUTCFullYear() <= 2020).at(-1);
  const gap0 = LE.life_exp_female.data[0].value - LE.life_exp_male.data[0].value;
  setHTML("pv-le", "+" + (fO.value - mO.value).toFixed(1) + pc("yr"));
  setTxt("ex-le-m", mO.value.toFixed(1));
  setTxt("ex-le-f", fO.value.toFixed(1));
  setTxt("ex-le-gap", (fO.value - mO.value).toFixed(1));
  setTxt("ex-le-gap0", gap0.toFixed(1));
  setTxt("ex-le-proj", last(LE.life_exp_female).toFixed(1));
  setTxt("ex-le-projm", last(LE.life_exp_male).toFixed(1));
  wirePlate(document.getElementById("cb-le"), plot, "india-atlas_gender_life-expectancy_1990-2036", "period_start_year,life_exp_male,life_exp_female\n" + LE.life_exp_male.data.map((d, i) => yr(d.date) + "," + d.value + "," + LE.life_exp_female.data[i].value).join("\n"));
  wireLegend(document.getElementById("legend-le"), plot, ["female", "male"], store);
}

/* ---------- § 08 TFR by education ---------- */
{
  const EDU = [
    ["tfr_graduate_and_above", "Graduate+"], ["tfr_class_xii", "Class XII"], ["tfr_class_x", "Class X"],
    ["tfr_middle", "Middle"], ["tfr_primary", "Primary"], ["tfr_literate", "Literate"], ["tfr_illiterate", "Illiterate"],
  ];
  const GREYS = ["#A3A9B4", "#A3A9B4", "#A3A9B4", "#878D99", "#878D99", "#5F6675", "#5F6675"];
  const store = {};
  EDU.forEach(([k, lab], i) => { store[k] = { ...TFR[k], label: lab, color: k === "tfr_graduate_and_above" ? "#2E4BD8" : GREYS[i] }; });
  const keys = EDU.map(([k]) => k);
  const geo = { W: 1184, H: 440, ml: 70, mr: 230, mt: 30, mb: 42, d0: 1, d1: 4 };
  const xTicks = [2016, 2017, 2018, 2019, 2020].map((y) => new Date(Date.UTC(y, 0, 1)));
  const plot = linePanel(document.getElementById("plot-tfr"), keys, store, geo, {
    yTicks: [1.5, 2.5, 3.5],
    yLabel: "↑ Total Fertility Rate, births per woman",
    yFmt: (d) => String(d.toFixed(1)),
    xTicks, xFmt: yr,
    leadWidth: 2.75, supportWidth: 1.5,
    endFmt: (v) => v.toFixed(2),
    crossFmt: (v) => (v == null ? "—" : v.toFixed(2)),
    gapFrac: 0.05,
    preMarks: [Plot.ruleY([2.1], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }), Plot.text([{ date: new Date(Date.UTC(2018, 6, 1)), value: 2.3 }], { x: "date", y: "value", text: ["replacement, 2.1"], dx: 4, fontSize: 12, fill: "#878D99", fontFamily: mono, textAnchor: "start" })],
    a11yTitle: "Total Fertility Rate by education level of woman, All India, 2016-2020",
    a11yDesc: "Seven lines, ordered by education. Graduate women at " + last(TFR.tfr_graduate_and_above).toFixed(2) + ", illiterate at " + last(TFR.tfr_illiterate).toFixed(2) + ": the gradient is unbroken at every step.",
  });
  setHTML("pv-tfr", last(TFR.tfr_graduate_and_above).toFixed(2));
  setTxt("ex-tfr-grad", last(TFR.tfr_graduate_and_above).toFixed(2));
  setTxt("ex-tfr-ill", last(TFR.tfr_illiterate).toFixed(2));
  setTxt("ex-tfr-gap", (last(TFR.tfr_illiterate) - last(TFR.tfr_graduate_and_above)).toFixed(2));
  wirePlate(document.getElementById("cb-tfr"), plot, "india-atlas_gender_tfr-by-education_2016-2020", "year," + keys.join(",") + "\n" + TFR[keys[0]].data.map((d, i) => yr(d.date) + "," + keys.map((k) => TFR[k].data[i].value).join(",")).join("\n"));
}

/* ---------- § 09 literacy ---------- */
{
  const store = { female: { ...LIT.literacy_female, label: "Female", color: "#2E4BD8" }, male: { ...LIT.literacy_male, label: "Male", color: "#5F6675" } };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 25, d1: 90 };
  const xTicks = [1981, 1991, 2001, 2011, 2017].map((y) => new Date(Date.UTC(y, 0, 1)));
  const plot = linePanel(document.getElementById("plot-lit"), ["female", "male"], store, geo, {
    yTicks: [30, 50, 70, 85],
    yLabel: "↑ literacy rate (age 7+), per cent",
    yFmt: (d) => String(d) + "%",
    xTicks, xFmt: (d) => String(d.getUTCFullYear()) + (d.getUTCFullYear() === 2017 ? "*" : ""),
    gapFrac: 0.08,
    endFmt: (v) => v.toFixed(1) + "%",
    crossFmt: (v) => (v == null ? "—" : v.toFixed(1) + "%"),
    a11yTitle: "Literacy rate by gender, All India, 1981-2017",
    a11yDesc: "Two rising lines, female (blue) below male (grey) but rising faster. Female literacy ends at " + last(LIT.literacy_female).toFixed(1) + ", male at " + last(LIT.literacy_male).toFixed(1) + ": a gap of " + (last(LIT.literacy_male) - last(LIT.literacy_female)).toFixed(0) + " points.",
  });
  const gapNow = last(LIT.literacy_male) - last(LIT.literacy_female);
  const gap0 = firstV(LIT.literacy_male) - firstV(LIT.literacy_female);
  // crude ETA: linear extrapolation of gap closure
  const years = [1981, 1991, 2001, 2011, 2017];
  const gaps = years.map((_, i) => LIT.literacy_male.data[i].value - LIT.literacy_female.data[i].value);
  const slope = (gaps.at(-1) - gaps[0]) / (years.at(-1) - years[0]);
  const eta = slope < 0 ? Math.round(years.at(-1) + gaps.at(-1) / -slope) : null;
  setHTML("pv-lit", gapNow.toFixed(0) + pc(" pt"));
  setTxt("ex-lit-m", last(LIT.literacy_male).toFixed(1) + "%");
  setTxt("ex-lit-f", last(LIT.literacy_female).toFixed(1) + "%");
  setTxt("ex-lit-gap", gapNow.toFixed(0));
  setTxt("ex-lit-gap0", gap0.toFixed(0));
  setTxt("ex-lit-eta", eta ? String(eta) : "—");
  wirePlate(document.getElementById("cb-lit"), plot, "india-atlas_gender_literacy-by-gender_1981-2017", "year,literacy_male,literacy_female\n" + LIT.literacy_male.data.map((d, i) => yr(d.date) + "," + d.value + "," + LIT.literacy_female.data[i].value).join("\n"));
  wireLegend(document.getElementById("legend-lit"), plot, ["female", "male"], store);
}

/* ---------- § 10 LFPR ---------- */
{
  const store = { female: { ...WK.lfpr_female, label: "Female LFPR", color: "#2E4BD8" }, male: { ...WK.lfpr_male, label: "Male LFPR", color: "#5F6675" } };
  const geo = { W: 1184, H: 420, ml: 70, mr: 230, mt: 30, mb: 42, d0: 15, d1: 85 };
  const xTicks = WK.lfpr_female.data.map((d) => d.date);
  const plot = linePanel(document.getElementById("plot-lfpr"), ["female", "male"], store, geo, {
    yTicks: [25, 45, 65, 80],
    yLabel: "↑ LFPR (15+, usual status), per cent",
    yFmt: (d) => String(d) + "%",
    xTicks, xFmt: yr,
    gapFrac: 0.08,
    endFmt: (v) => v.toFixed(1) + "%",
    crossFmt: (v) => (v == null ? "—" : v.toFixed(1) + "%"),
    a11yTitle: "Labour Force Participation Rate by gender, All India, PLFS 2017-18 to 2023-24",
    a11yDesc: "The widest gap on the page. Male LFPR flat near 78; female LFPR rising from " + firstV(WK.lfpr_female).toFixed(1) + " to " + last(WK.lfpr_female).toFixed(1) + ": partly real, partly a measurement-frame effect.",
  });
  setHTML("pv-lfpr", last(WK.lfpr_female).toFixed(1) + pc("%"));
  setTxt("ex-lfpr-f", last(WK.lfpr_female).toFixed(1) + "%");
  setTxt("ex-lfpr-m", last(WK.lfpr_male).toFixed(1) + "%");
  setTxt("ex-lfpr-gap", (last(WK.lfpr_male) - last(WK.lfpr_female)).toFixed(0));
  setTxt("ex-lfpr-gap0", (firstV(WK.lfpr_male) - firstV(WK.lfpr_female)).toFixed(0));
  wirePlate(document.getElementById("cb-lfpr"), plot, "india-atlas_gender_lfpr-by-gender_2017-2024", "year,lfpr_male,lfpr_female\n" + WK.lfpr_male.data.map((d, i) => yr(d.date) + "," + d.value + "," + WK.lfpr_female.data[i].value).join("\n"));
  wireLegend(document.getElementById("legend-lfpr"), plot, ["female", "male"], store);
}

/* ---------- § 11 state sex ratio strip ---------- */
{
  const rename = { "andaman_nicobar_islands": "A&N Islands", "dadra_nagar_haveli_and_daman_diu": "DNH & Daman & Diu", "jammu_kashmir": "Jammu & Kashmir" };
  const rows = Object.entries(statesBundle.series)
    .filter(([k]) => k.startsWith("sex_ratio_"))
    .map(([k, s]) => { const v = s.data[0]; if (v == null) return null; const slug = k.slice(10); const name = rename[slug] || slug.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "); return { state: name, sr: v }; })
    .filter(Boolean)
    .sort((a, b) => a.sr - b.sr);
  const aiSr = last(SR.sex_ratio);
  const above = rows.filter((r) => r.sr >= aiSr).length;
  const spread = rows.at(-1).sr - rows[0].sr;
  setHTML("pv-stsr", spread + pc(" pt"));
  setTxt("ex-stsr-bot", rows[0].state + ", " + rows[0].sr);
  setTxt("ex-stsr-top", rows.at(-1).state + ", " + rows.at(-1).sr);
  setTxt("ex-stsr-spread", String(spread));
  setTxt("ex-stsr-above", String(above));
  const geo = { W: 1184, H: 30 + rows.length * 22 + 40, ml: 200, mr: 90, mt: 30, mb: 40 };
  const xTicks = [850, 900, 950, 1000, 1050];
  const isBelow = (d) => d.sr < aiSr;
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "females per 1,000 males →", labelAnchor: "right", labelArrow: false, domain: [rows[0].sr - 10, rows.at(-1).sr + 15], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([1000], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }),
      Plot.text([{ state: rows.at(-1).state, sr: 1000 }], { x: "sr", y: "state", text: ["parity, 1000"], dx: 8, dy: -11, fontSize: 11, fill: "#878D99", fontFamily: mono, textAnchor: "start" }),
      Plot.ruleX([aiSr], { stroke: "#2E4BD8", strokeWidth: 1.5, strokeDasharray: "3,3" }),
      Plot.ruleY(rows, { y: "state", x1: rows[0].sr - 10, x2: "sr", stroke: (d) => (isBelow(d) ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "state", x: "sr", fill: (d) => (isBelow(d) ? "#2E4BD8" : "#5F6675"), r: 4 }),
      Plot.text(rows, { y: "state", x: "sr", dx: 12, text: (d) => String(d.sr), fill: (d) => (isBelow(d) ? "#161A22" : "#5F6675"), fontSize: 11.5, fontFamily: mono, fontWeight: (d) => (isBelow(d) ? 500 : 400), textAnchor: "start" }),
    ],
  });
  a11y(plot, "Sex ratio by state and union territory, SRS latest",
    "Sorted dot strip of " + rows.length + " states/UTs. " + rows[0].state + " is lowest at " + rows[0].sr + ", " + rows.at(-1).state + " highest at " + rows.at(-1).sr + ". The north-western deficit (Haryana, Delhi, Punjab) sits far below the All-India rule of " + aiSr + ".");
  document.getElementById("plot-stsr").append(plot);
  wirePlate(document.getElementById("cb-stsr"), plot, "india-atlas_gender_state-sex-ratio_latest", "state,sex_ratio\n" + rows.map((r) => `"${r.state}",${r.sr}`).join("\n"));
}

/* ---------- provenance ---------- */
setTxt("prov-vintage", sexratioBundle.meta.vintage);
setTxt("prov-vintage2", sexratioBundle.meta.vintage);
