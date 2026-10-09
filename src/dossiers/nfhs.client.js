// Dossier 12 · Health (NFHS) — plate definitions and number wiring.
// Data: 7 thematic bundles (nfhs-child, -maternal, -anaemia, -adult,
// -fertility, -household, -states), each carrying All India Combined
// sub-indicators with NFHS-4 and NFHS-5 values on a 2-point axis.
// The central story: anaemia WORSENED between rounds while most else improved.
// Every comparison plate uses dumbbells (NFHS-4 grey → NFHS-5 blue).

import * as Plot from "@observablehq/plot";
import childBundle from "../../data/series/nfhs-child.json";
import maternalBundle from "../../data/series/nfhs-maternal.json";
import anaemiaBundle from "../../data/series/nfhs-anaemia.json";
import adultBundle from "../../data/series/nfhs-adult.json";
import fertilityBundle from "../../data/series/nfhs-fertility.json";
import householdBundle from "../../data/series/nfhs-household.json";
import statesBundle from "../../data/series/nfhs-states.json";
import { MONO as mono, a11y, downloadSVG, downloadPNG, saveBlob, stripLabelSide, stripLabelSpot } from "../charts/plumbing.js";

/* ---------- helpers ---------- */
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
const setTxt = (id, t) => (document.getElementById(id).textContent = t);
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtPct = (v) => v.toFixed(1) + pc("%");
const fmtInt = (v) => String(Math.round(v));
// find a series by partial label match within a bundle's series object
const find = (bundle, needle) => {
  const lower = needle.toLowerCase();
  const found = Object.values(bundle.series).find((s) => s.label.toLowerCase().includes(lower));
  return found ?? null;
};
const v4 = (s) => (s ? s.data[0] : null);
const v5 = (s) => (s ? s.data[1] : null);
const change = (s) => (s && s.data[0] != null && s.data[1] != null ? s.data[1] - s.data[0] : null);

function wirePlate(blockEl, plot, filename, csvText) {
  const meta = { title: blockEl.querySelector(".plate-head h3")?.textContent.trim(), sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(), foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => { btn.addEventListener("click", () => { const kind = btn.dataset.dl; if (kind === "svg" && plot) downloadSVG(plot, filename, meta); if (kind === "png" && plot) downloadPNG(plot, filename, meta); if (kind === "csv") saveBlob(new Blob([csvText], { type: "text/csv" }), filename + ".csv"); }); });
}

/* ---------- reusable dumbbell renderer ---------- */
function dumbbell(el, items, opts) {
  // items: [{label, v4, v5}] — v4 = NFHS-4, v5 = NFHS-5
  const rows = items.filter((d) => d.v5 != null);
  const flat = rows.flatMap((r) => [{ label: r.label, round: "NFHS-4", v: r.v4 }, { label: r.label, round: "NFHS-5", v: r.v5 }]);
  const vals = flat.map((d) => d.v).filter((v) => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.12 || 1;
  const W = opts.w ?? 1184;
  const H = opts.h ?? 40 + rows.length * 42 + 40;
  const ml = opts.ml ?? 320;
  const mr = opts.mr ?? 140;
  const xTicks = opts.xTicks ?? [Math.floor(lo), Math.round((lo + hi) / 2), Math.ceil(hi)];
  const plot = Plot.plot({
    width: W, height: H, marginLeft: ml, marginRight: mr, marginTop: 14, marginBottom: 44,
    style: { background: "transparent", fontFamily: mono, fontSize: "12px", color: "#878D99", overflow: "visible" },
    x: { label: opts.xLabel, labelAnchor: "right", labelArrow: false, domain: [lo - pad, hi + pad], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => String(opts.xFmt ? opts.xFmt(d) : Math.round(d)) },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#B5BAC4", strokeWidth: 1.25 }),
      Plot.link(rows, { y: "label", x1: "v4", x2: "v5", stroke: "#C9CED6", strokeWidth: 2 }),
      Plot.dot(flat.filter((d) => d.round === "NFHS-4" && d.v != null), { y: "label", x: "v", fill: "#5F6675", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.dot(flat.filter((d) => d.round === "NFHS-5"), { y: "label", x: "v", fill: "#2E4BD8", r: 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      /* labels go OUTSIDE the dumbbell: the left dot's label to its left, the
       * right dot's to its right — never into the connector's path.
       * Plot ignores function-valued dx/textAnchor, so one mark per side.
       * Exception: when a left label would cross the zero rule, it tucks
       * under its dot instead — on either side of a decrease. */
      ...(() => {
        const pxU = (W - ml - mr) / (hi - lo + 2 * pad);
        const zeroPx = ml + (0 - (lo - pad)) * pxU;
        const lbl = (v) => (opts.xFmt ? opts.xFmt(v) : String(Math.round(v)));
        const crossesZero = (v, txt) => (lo - pad < 0) && (ml + (v - (lo - pad)) * pxU - 14 - txt.length * 12.5 * 0.6) < zeroPx;
        const v4left = rows.filter((d) => d.v4 != null && (d.v5 == null || d.v4 <= d.v5));
        const tuck4 = v4left.filter((d) => crossesZero(d.v4, lbl(d.v4)));
        const v5left = rows.filter((d) => d.v4 != null && d.v4 > d.v5);
        const tuck5 = v5left.filter((d) => crossesZero(d.v5, lbl(d.v5)));
        return [
          Plot.text(v4left.filter((d) => !tuck4.includes(d)), { y: "label", x: "v4",
            dx: -14, text: (d) => lbl(d.v4),
            fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "end" }),
          Plot.text(tuck4, { y: "label", x: "v4",
            dy: 17, text: (d) => lbl(d.v4),
            fill: "#5F6675", fontSize: 12.5, fontFamily: mono, textAnchor: "middle" }),
          Plot.text(v5left.filter((d) => !tuck5.includes(d)), { y: "label", x: "v5",
            dx: -14, text: (d) => lbl(d.v5),
            fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
          Plot.text(tuck5, { y: "label", x: "v5",
            dy: 17, text: (d) => lbl(d.v5),
            fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "middle" }),
        ];
      })(),
      Plot.text(rows.filter((d) => d.v4 == null || d.v4 <= d.v5), { y: "label", x: "v5",
        dx: 14, text: (d) => opts.xFmt ? opts.xFmt(d.v5) : String(Math.round(d.v5)),
        fill: "#161A22", fontSize: 12.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
    ],
  });
  a11y(plot, opts.a11yTitle, opts.a11yDesc);
  el.append(plot);
  return plot;
}

/* ---------- key series lookups ---------- */
const CHILD_ANAEMIA = find(anaemiaBundle, "children age 6-59");
const WOMEN_ANAEMIA = find(anaemiaBundle, "all women age 15-49");
const PREG_ANAEMIA = find(anaemiaBundle, "pregnant women");
const NONPREG_ANAEMIA = find(anaemiaBundle, "non-pregnant women");
const MEN_ANAEMIA = find(anaemiaBundle, "men age 15-49");
const IMR = find(childBundle, "infant mortality");
const U5MR = find(childBundle, "under-five mortality");
const STUNTING = find(childBundle, "stunted");
const WASTING = find(childBundle, "wasted (weight");
const UNDERWEIGHT = find(childBundle, "underweight");
const EXCL_BF = find(childBundle, "exclusively breastfed");
const INST = find(maternalBundle, "Institutional births (in the 5 years");
const SKILLED = find(maternalBundle, "skilled health personnel");
const CSECT = find(maternalBundle, "caesarean section (in the 5");
const CSECT_PRIV = find(maternalBundle, "private health facility that were delivered by caesarean");
const CSECT_PUB = find(maternalBundle, "public health facility that were delivered by caesarean");
const ANC4 = find(maternalBundle, "at least 4 antenatal");
const IFA = find(maternalBundle, "iron folic acid for 100");
const TFR = find(fertilityBundle, "total fertility rate");
const CHILD_MARRIAGE = find(fertilityBundle, "married before age 18");
const BANK = find(fertilityBundle, "bank or savings account");
const MOBILE = find(fertilityBundle, "mobile phone that they themselves");
const VIOLENCE = find(fertilityBundle, "spousal violence");
const SANITATION = find(householdBundle, "improved sanitation");
const ELECTRICITY = find(householdBundle, "electricity");
const WATER = find(householdBundle, "improved drinking-water");
const FUEL = find(householdBundle, "clean fuel for cooking");
const INSURANCE = find(householdBundle, "health insurance");
const W_THIN = find(adultBundle, "women (age 15-49 years) whose body mass");
const M_THIN = find(adultBundle, "men (age 15-49 years) whose body mass");
const W_OV = find(adultBundle, "women (age 15-49 years) who are overweight");
const M_OV = find(adultBundle, "men (age 15-49 years) who are overweight");
const M_TOB = find(adultBundle, "men age 15 years and above who use any kind of tob");
const W_TOB = find(adultBundle, "women age 15 years and above who use any kind of tob");
const M_ALC = find(adultBundle, "men age 15 years and above who consume alc");

/* ---------- titleblock ---------- */
setHTML("n-anaemia", v5(CHILD_ANAEMIA).toFixed(1) + pc("%"));
setHTML("d-anaemia", `<b>▲ +${(v5(CHILD_ANAEMIA) - v4(CHILD_ANAEMIA)).toFixed(1)} pt</b> vs NFHS-4, worsened`);
setHTML("n-imr", fmtInt(v5(IMR)) + pc("/1000"));
setHTML("d-imr", `<b>▼ −${(v4(IMR) - v5(IMR)).toFixed(1)}</b> vs NFHS-4, improved`);
setHTML("n-institutional", v5(INST).toFixed(1) + pc("%"));
setHTML("d-institutional", `<b>▲ +${(v5(INST) - v4(INST)).toFixed(1)} pt</b> vs NFHS-4`);
setHTML("n-tfr", v5(TFR).toFixed(2));
setHTML("d-tfr", `<b>▼ −${(v4(TFR) - v5(TFR)).toFixed(2)}</b>, below replacement (2.1)`);

/* ---------- § 01 ---------- */
setHTML("rb-anaemia", v5(CHILD_ANAEMIA).toFixed(1) + pc("%"));
setHTML("rb-anaemia-prev", v4(CHILD_ANAEMIA).toFixed(1) + pc("%"));
setHTML("rt-anaemia-prev", v4(CHILD_ANAEMIA).toFixed(1) + pc("%"));
setHTML("cr-anaemia", v5(CHILD_ANAEMIA).toFixed(1) + pc("%"));
setHTML("cr-anaemia-prev", v4(CHILD_ANAEMIA).toFixed(1) + pc("%"));
setHTML("cr-imr", fmtInt(v5(IMR)) + pc("/1000"));
setHTML("cr-imr-prev", fmtInt(v4(IMR)) + pc("/1000"));
setHTML("cr-institutional", v5(INST).toFixed(1) + pc("%"));
setHTML("cr-institutional-prev", v4(INST).toFixed(1) + pc("%"));
setHTML("cr-tfr", v5(TFR).toFixed(2));
setHTML("cr-stunting", v5(STUNTING).toFixed(1) + pc("%"));
setHTML("cr-wasting", v5(WASTING).toFixed(1) + pc("%"));
setHTML("cr-underweight", v5(UNDERWEIGHT).toFixed(1) + pc("%"));
setHTML("cr-bank-prev", v4(BANK).toFixed(0) + pc("%"));
setHTML("cr-bank", v5(BANK).toFixed(0) + pc("%"));
setHTML("cr-violence-prev", v4(VIOLENCE).toFixed(0) + pc("%"));
setHTML("cr-violence", v5(VIOLENCE).toFixed(0) + pc("%"));

/* ---------- § 02 register ---------- */
const regRows = [
  [CHILD_ANAEMIA, "Child anaemia (6-59 months)", "s-acc", true],
  [IMR, "Infant mortality rate", "s-g1", true],
  [INST, "Institutional births", "s-g2", false],
  [STUNTING, "Stunting (under-5)", "s-g3", true],
  [TFR, "Total Fertility Rate", "s-g4", true],
  [BANK, "Women's bank account", "s-acc", false],
  [VIOLENCE, "Spousal violence", "s-g1", true],
  [SANITATION, "Improved sanitation", "s-g2", false],
];
document.getElementById("ledger-body").innerHTML = regRows.map(([s, nm, sw, lowerIsBetter]) => {
  const a = v4(s), b = v5(s);
  if (b == null) return "";
  const d = a != null ? b - a : null;
  const goodDir = d != null ? (lowerIsBetter ? d < 0 : d > 0) : null;
  const arrow = d != null ? (d > 0 ? "▲ +" : d < 0 ? "▼ −" : "→ ") + Math.abs(d).toFixed(1) : "new";
  return `<tr><td class="name"><span class="sw ${sw}"></span>${nm}</td><td class="val">${b.toFixed(b < 5 ? 2 : 1)}${b < 5 ? "" : pc("%")}</td><td class="chg">${goodDir != null ? `<b style="color:${goodDir ? "#5F6675" : "#2E4BD8"}">${arrow}</b>` : `<b>${arrow}</b>`}, ${a != null ? a.toFixed(a < 5 ? 2 : 1) : "—"}</td><td class="yr">${a != null ? a.toFixed(a < 5 ? 2 : 1) : "—"}</td></tr>`;
}).join("");

/* ---------- § 03 direction of change ---------- */
{
  // [series, shortLabel, lowerIsBetter] — lowerIsBetter tags the favourable direction
  const DIR = [
    [IMR, "Infant mortality", true], [U5MR, "Under-5 mortality", true],
    [STUNTING, "Stunting", true], [WASTING, "Wasting", true], [UNDERWEIGHT, "Underweight", true],
    [CHILD_ANAEMIA, "Child anaemia", true], [WOMEN_ANAEMIA, "Women anaemic", true],
    [W_OV, "Women overweight", true], [M_OV, "Men overweight", true],
    [INST, "Institutional births", false], [SKILLED, "Skilled birth attendance", false],
    [ANC4, "4+ ANC visits", false], [IFA, "IFA 100+ days", false],
    [BANK, "Women's bank account", false], [MOBILE, "Women's mobile phone", false],
    [VIOLENCE, "Spousal violence", true], [CHILD_MARRIAGE, "Child marriage", true],
    [SANITATION, "Improved sanitation", false], [CSECT, "C-section rate", true],
  ];
  const items = DIR.map(([s, label, lowerIsBetter]) => {
    const d = change(s);
    if (d == null) return null;
    const worsened = lowerIsBetter ? d > 0 : d < 0;
    return { label, change: d, worsened, lowerIsBetter };
  }).filter(Boolean).sort((a, b) => b.change - a.change);

  setHTML("pv-direction", "+" + change(CHILD_ANAEMIA).toFixed(1) + pc(" pt"));

  const geo = { W: 1184, H: 40 + items.length * 28 + 40 };
  const maxAbs = Math.max(...items.map((d) => Math.abs(d.change)));
  const xTicks = [-Math.ceil(maxAbs), 0, Math.ceil(maxAbs)];
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: 230, marginRight: 140, marginTop: 14, marginBottom: 44,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "← favourable · change (percentage points) · unfavourable →", labelAnchor: "center", labelArrow: false, domain: [-maxAbs * 1.15, maxAbs * 1.15], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => String(Math.round(d)) },
    y: { label: null, domain: items.map((d) => d.label), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([0], { stroke: "#161A22", strokeWidth: 1.5 }),
      Plot.barX(items, { y: "label", x: "change", fill: (d) => (d.worsened ? "#2E4BD8" : "#A3A9B4"), strokeWidth: 0.5 }),
      Plot.text(items.filter((d) => !d.worsened && d.change > 0), { y: "label", x: "change", dx: 8, text: (d) => "+" + d.change.toFixed(1), fill: "#5F6675", fontSize: 11.5, fontFamily: mono, textAnchor: "start" }),
      Plot.text(items.filter((d) => !d.worsened && d.change <= 0), { y: "label", x: "change", dx: -8, text: (d) => d.change.toFixed(1), fill: "#5F6675", fontSize: 11.5, fontFamily: mono, textAnchor: "end" }),
      Plot.text(items.filter((d) => d.worsened && d.change > 0), { y: "label", x: "change", dx: 8, text: (d) => "+" + d.change.toFixed(1), fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500, textAnchor: "start" }),
      Plot.text(items.filter((d) => d.worsened && d.change <= 0), { y: "label", x: "change", dx: -8, text: (d) => d.change.toFixed(1), fill: "#161A22", fontSize: 11.5, fontFamily: mono, fontWeight: 500, textAnchor: "end" }),
    ],
  });
  a11y(plot, "Direction of change between NFHS-4 and NFHS-5, key health indicators",
    "Horizontal bars showing percentage-point change. Blue = unfavourable direction (anaemia up, obesity up, C-section up); grey = favourable. " + items.filter((d) => d.worsened).length + " of " + items.length + " indicators worsened.");
  document.getElementById("plot-direction").append(plot);
  const csv = "indicator,change_pct_pt,direction\n" + items.map((d) => `"${d.label}",${d.change.toFixed(2)},${d.worsened ? "unfavourable" : "favourable"}`).join("\n");
  wirePlate(document.getElementById("cb-direction"), plot, "india-atlas_nfhs_direction-of-change_nfhs4-to-nfhs5", csv);
}

/* ---------- § 04 anaemia dumbbell ---------- */
{
  const items = [
    { label: "Children 6-59 months", v4: v4(CHILD_ANAEMIA), v5: v5(CHILD_ANAEMIA) },
    { label: "Women 15-49 (non-pregnant)", v4: v4(NONPREG_ANAEMIA), v5: v5(NONPREG_ANAEMIA) },
    { label: "Women 15-49 (all)", v4: v4(WOMEN_ANAEMIA), v5: v5(WOMEN_ANAEMIA) },
    { label: "Pregnant women 15-49", v4: v4(PREG_ANAEMIA), v5: v5(PREG_ANAEMIA) },
    { label: "Men 15-49 (NFHS-5 only)", v4: null, v5: v5(MEN_ANAEMIA) },
  ];
  setHTML("pv-anaemia", "+" + change(CHILD_ANAEMIA).toFixed(1) + pc(" pt"));
  setHTML("ex-anaemia-rise", "+" + change(CHILD_ANAEMIA).toFixed(1));
  setHTML("ex-an-children", v5(CHILD_ANAEMIA).toFixed(1) + pc("%"));
  setHTML("ex-an-women", v5(NONPREG_ANAEMIA).toFixed(1) + pc("%"));
  setHTML("ex-an-pregnant", v5(PREG_ANAEMIA).toFixed(1) + pc("%"));
  setHTML("ex-an-men", v5(MEN_ANAEMIA).toFixed(1) + pc("%"));
  setHTML("ex-an-rise-children", "+" + change(CHILD_ANAEMIA).toFixed(1) + pc(" pt"));
  setHTML("ex-an-rise-women", "+" + change(WOMEN_ANAEMIA).toFixed(1) + pc(" pt"));
  const plot = dumbbell(document.getElementById("plot-anaemia"), items, { xLabel: "anaemic, per cent →", xFmt: (d) => d.toFixed(0) + "%", a11yTitle: "Anaemia by demographic, NFHS-4 to NFHS-5", a11yDesc: "Five dumbbells, all shifting right (worsening). Children: " + v4(CHILD_ANAEMIA) + "→" + v5(CHILD_ANAEMIA) + "%. Men NFHS-5 only: " + v5(MEN_ANAEMIA) + "%." });
  wirePlate(document.getElementById("cb-anaemia"), plot, "india-atlas_nfhs_anaemia-by-demographic_nfhs4-nfhs5", "demographic,nfhs_4_pct,nfhs_5_pct\n" + items.map((d) => `"${d.label}",${d.v4 ?? ""},${d.v5}`).join("\n"));
}

/* ---------- § 06 child health ---------- */
{
  const items = [
    { label: "Infant mortality (/1,000)", v4: v4(IMR), v5: v5(IMR) },
    { label: "Under-5 mortality (/1,000)", v4: v4(U5MR), v5: v5(U5MR) },
    { label: "Stunting (under-5)", v4: v4(STUNTING), v5: v5(STUNTING) },
    { label: "Wasting (under-5)", v4: v4(WASTING), v5: v5(WASTING) },
    { label: "Underweight (under-5)", v4: v4(UNDERWEIGHT), v5: v5(UNDERWEIGHT) },
    { label: "Exclusive breastfeeding (6mo)", v4: v4(EXCL_BF), v5: v5(EXCL_BF) },
  ];
  setHTML("pv-child", v5(STUNTING).toFixed(0) + pc("%"));
  setHTML("ex-ch-imr", fmtInt(v5(IMR)));
  setHTML("ex-ch-stunt", v5(STUNTING).toFixed(1) + pc("%"));
  setHTML("ex-ch-waste", v5(WASTING).toFixed(1) + pc("%"));
  setHTML("ex-ch-uw", v5(UNDERWEIGHT).toFixed(1) + pc("%"));
  setHTML("ex-ch-bf", v5(EXCL_BF).toFixed(1) + pc("%"));
  setHTML("ex-ch-stunt-drop", "−" + (-change(STUNTING)).toFixed(1));
  setHTML("ex-ch-imr-drop", "−" + (-change(IMR)).toFixed(1));
  const plot = dumbbell(document.getElementById("plot-child"), items, { xLabel: "rate / per cent →", xFmt: (d) => String(Math.round(d)), a11yTitle: "Child mortality and nutrition, NFHS-4 to NFHS-5", a11yDesc: "Six dumbbells, all shifting favourably. IMR: " + v4(IMR) + "→" + v5(IMR) + ". Stunting: " + v4(STUNTING) + "→" + v5(STUNTING) + "." });
  wirePlate(document.getElementById("cb-child"), plot, "india-atlas_nfhs_child-health_nfhs4-nfhs5", "indicator,nfhs_4,nfhs_5\n" + items.map((d) => `"${d.label}",${d.v4},${d.v5}`).join("\n"));
}

/* ---------- § 07 maternal care ---------- */
{
  const items = [
    { label: "Institutional births", v4: v4(INST), v5: v5(INST) },
    { label: "Skilled birth attendance", v4: v4(SKILLED), v5: v5(SKILLED) },
    { label: "4+ ANC visits", v4: v4(ANC4), v5: v5(ANC4) },
    { label: "IFA 100+ days", v4: v4(IFA), v5: v5(IFA) },
    { label: "C-section (overall)", v4: v4(CSECT), v5: v5(CSECT) },
    { label: "C-section (private)", v4: v4(CSECT_PRIV), v5: v5(CSECT_PRIV) },
    { label: "C-section (public)", v4: v4(CSECT_PUB), v5: v5(CSECT_PUB) },
  ];
  setHTML("pv-maternal", v5(CSECT_PRIV).toFixed(0) + pc("%"));
  setHTML("ex-ma-inst", v5(INST).toFixed(1) + pc("%"));
  setHTML("ex-ma-skilled", v5(SKILLED).toFixed(1) + pc("%"));
  setHTML("ex-ma-cs", v5(CSECT).toFixed(1) + pc("%"));
  setHTML("ex-ma-csp", v5(CSECT_PRIV).toFixed(1) + pc("%"));
  setHTML("ex-ma-csu", v5(CSECT_PUB).toFixed(1) + pc("%"));
  setHTML("ex-ma-anc", v5(ANC4).toFixed(1) + pc("%"));
  const plot = dumbbell(document.getElementById("plot-maternal"), items, { xLabel: "per cent →", xFmt: (d) => String(Math.round(d)) + "%", a11yTitle: "Delivery care, NFHS-4 to NFHS-5", a11yDesc: "Seven dumbbells. Institutional births: " + v4(INST) + "→" + v5(INST) + "%. C-section private: " + v4(CSECT_PRIV) + "→" + v5(CSECT_PRIV) + "%." });
  wirePlate(document.getElementById("cb-maternal"), plot, "india-atlas_nfhs_maternal-care_nfhs4-nfhs5", "indicator,nfhs_4_pct,nfhs_5_pct\n" + items.map((d) => `"${d.label}",${d.v4},${d.v5}`).join("\n"));
}

/* ---------- § 08 adult NCDs ---------- */
{
  const items = [
    { label: "Women: BMI below normal", v4: v4(W_THIN), v5: v5(W_THIN) },
    { label: "Men: BMI below normal", v4: v4(M_THIN), v5: v5(M_THIN) },
    { label: "Women: overweight/obese", v4: v4(W_OV), v5: v5(W_OV) },
    { label: "Men: overweight/obese", v4: v4(M_OV), v5: v5(M_OV) },
    { label: "Men: tobacco use", v4: v4(M_TOB), v5: v5(M_TOB) },
    { label: "Women: tobacco use", v4: v4(W_TOB), v5: v5(W_TOB) },
    { label: "Men: alcohol consumption", v4: v4(M_ALC), v5: v5(M_ALC) },
  ];
  setHTML("pv-adult", v5(W_OV).toFixed(1) + pc("%"));
  setHTML("ex-ad-wov", v5(W_OV).toFixed(1) + pc("%"));
  setHTML("ex-ad-mov", v5(M_OV).toFixed(1) + pc("%"));
  setHTML("ex-ad-wth", v5(W_THIN).toFixed(1) + pc("%"));
  setHTML("ex-ad-mth", v5(M_THIN).toFixed(1) + pc("%"));
  setHTML("ex-ad-mto", v5(M_TOB).toFixed(1) + pc("%"));
  setHTML("ex-ad-wto", v5(W_TOB).toFixed(1) + pc("%"));
  setHTML("ex-ad-mal", v5(M_ALC).toFixed(1) + pc("%"));
  const plot = dumbbell(document.getElementById("plot-adult"), items, { xLabel: "per cent →", xFmt: (d) => String(Math.round(d)) + "%", a11yTitle: "Adult nutritional status and risk factors, NFHS-4 to NFHS-5", a11yDesc: "Seven dumbbells. Underweight fell for both sexes; overweight rose. Men's tobacco fell from " + v4(M_TOB) + " to " + v5(M_TOB) + "." });
  wirePlate(document.getElementById("cb-adult"), plot, "india-atlas_nfhs_adult-ncds_nfhs4-nfhs5", "indicator,nfhs_4_pct,nfhs_5_pct\n" + items.map((d) => `"${d.label}",${d.v4},${d.v5}`).join("\n"));
}

/* ---------- § 09 empowerment ---------- */
{
  const items = [
    { label: "Total Fertility Rate", v4: v4(TFR), v5: v5(TFR) },
    { label: "Child marriage (women <18)", v4: v4(CHILD_MARRIAGE), v5: v5(CHILD_MARRIAGE) },
    { label: "Women's bank account", v4: v4(BANK), v5: v5(BANK) },
    { label: "Women's mobile phone", v4: v4(MOBILE), v5: v5(MOBILE) },
    { label: "Spousal violence", v4: v4(VIOLENCE), v5: v5(VIOLENCE) },
  ];
  setHTML("pv-empower", v5(BANK).toFixed(0) + pc("%"));
  setHTML("ex-em-tfr", v5(TFR).toFixed(2));
  setHTML("ex-em-cm", v5(CHILD_MARRIAGE).toFixed(1) + pc("%"));
  setHTML("ex-em-bank", v5(BANK).toFixed(0) + pc("%"));
  setHTML("ex-em-mobile", v5(MOBILE).toFixed(0) + pc("%"));
  setHTML("ex-em-violence", v5(VIOLENCE).toFixed(0) + pc("%"));
  const plot = dumbbell(document.getElementById("plot-empower"), items, { xLabel: "per cent / rate →", xFmt: (d) => d.toFixed(d < 5 ? 2 : 0), ml: 250, a11yTitle: "Fertility, empowerment and safety, NFHS-4 to NFHS-5", a11yDesc: "Five dumbbells. Bank accounts: " + v4(BANK) + "→" + v5(BANK) + "%. TFR: " + v4(TFR) + "→" + v5(TFR) + "." });
  wirePlate(document.getElementById("cb-empower"), plot, "india-atlas_nfhs_empowerment-fertility_nfhs4-nfhs5", "indicator,nfhs_4,nfhs_5\n" + items.map((d) => `"${d.label}",${d.v4},${d.v5}`).join("\n"));
}

/* ---------- § 10 household ---------- */
{
  const items = [
    { label: "Electricity", v4: v4(ELECTRICITY), v5: v5(ELECTRICITY) },
    { label: "Improved drinking water", v4: v4(WATER), v5: v5(WATER) },
    { label: "Improved sanitation", v4: v4(SANITATION), v5: v5(SANITATION) },
    { label: "Clean cooking fuel", v4: v4(FUEL), v5: v5(FUEL) },
    { label: "Health insurance coverage", v4: v4(INSURANCE), v5: v5(INSURANCE) },
  ];
  setHTML("pv-household", v5(SANITATION).toFixed(0) + pc("%"));
  setHTML("ex-hh-elec", v5(ELECTRICITY).toFixed(0) + pc("%"));
  setHTML("ex-hh-sani", v5(SANITATION).toFixed(0) + pc("%"));
  setHTML("ex-hh-water", v5(WATER).toFixed(0) + pc("%"));
  setHTML("ex-hh-fuel", v5(FUEL).toFixed(0) + pc("%"));
  setHTML("ex-hh-insurance", v5(INSURANCE).toFixed(0) + pc("%"));
  const plot = dumbbell(document.getElementById("plot-household"), items, { xLabel: "per cent of population / households →", xFmt: (d) => String(Math.round(d)) + "%", a11yTitle: "Household infrastructure, NFHS-4 to NFHS-5", a11yDesc: "Five dumbbells. Sanitation: " + v4(SANITATION) + "→" + v5(SANITATION) + "%. Electricity: " + v4(ELECTRICITY) + "→" + v5(ELECTRICITY) + "%." });
  wirePlate(document.getElementById("cb-household"), plot, "india-atlas_nfhs_household-infrastructure_nfhs4-nfhs5", "indicator,nfhs_4_pct,nfhs_5_pct\n" + items.map((d) => `"${d.label}",${d.v4},${d.v5}`).join("\n"));
}

/* ---------- § 11 state strip ---------- */
{
  const SHORT = {
    "Dadra & Nagar Haveli and Daman & Diu": "DNH & Daman & Diu",
    "Andaman & Nicobar Islands": "Andaman & N. Islands",
    "Jammu & Kashmir": "Jammu & Kashmir",
  };
  const rows = Object.entries(statesBundle.series)
    .filter(([k]) => k.startsWith("i14_child_anaemia__"))
    .map(([k, s]) => ({ state: SHORT[s.label.split(" · ")[1]] || s.label.split(" · ")[1] || k, v: s.data[0] }))
    .filter((d) => d.v != null)
    .sort((a, b) => a.v - b.v);
  const aiAvg = v5(CHILD_ANAEMIA);
  const above = rows.filter((r) => r.v >= aiAvg).length;
  const spread = rows.at(-1).v - rows[0].v;
  setHTML("pv-states", spread.toFixed(0) + pc(" pt"));
  setHTML("ex-st-best", rows[0].state + ", " + rows[0].v.toFixed(0) + pc("%"));
  setHTML("ex-st-worst", rows.at(-1).state + ", " + rows.at(-1).v.toFixed(0) + pc("%"));
  setHTML("ex-st-spread", spread.toFixed(0));
  setHTML("ex-st-above", String(above));
  setHTML("ex-st-n", String(rows.length));
  const geo = { W: 1184, H: 30 + rows.length * 22 + 40, ml: 200, mr: 90, mt: 30, mb: 40 };
  const aiSpot = (v) => stripLabelSpot(geo, 30, rows.at(-1).v * 1.05, v, aiAvg);
  const xTicks = [30, 50, 70, 90];
  const isWorst = (d, i) => i >= rows.length - 3;
  const plot = Plot.plot({
    width: geo.W, height: geo.H, marginLeft: geo.ml, marginRight: geo.mr, marginTop: geo.mt, marginBottom: geo.mb,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#878D99", overflow: "visible" },
    x: { label: "children anaemic, per cent →", labelAnchor: "right", labelArrow: false, domain: [30, rows.at(-1).v * 1.05], ticks: xTicks, tickSize: 0, tickPadding: 10, tickFormat: (d) => String(d) + "%" },
    y: { label: null, domain: rows.map((r) => r.state), tickSize: 0, tickPadding: 12, tickFormat: (s) => String(s) },
    marks: [
      Plot.gridX(xTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
      Plot.ruleX([aiAvg], { stroke: "#2E4BD8", strokeWidth: 1.5, strokeDasharray: "3,3" }),
      Plot.ruleY(rows, { y: "state", x1: 30, x2: "v", stroke: (d, i) => (isWorst(d, i) ? "#B9C3F3" : "#E3E6EB"), strokeWidth: 1.25 }),
      Plot.dot(rows, { y: "state", x: "v", fill: (d, i) => (isWorst(d, i) ? "#2E4BD8" : "#5F6675"), r: 5.5 }),
      ["start", "end", "middle"].map((a) => Plot.text(rows.filter((d) => aiSpot(d.v).anchor === a), { y: "state", x: "v",
        dx: a === "end" ? -12 : a === "start" ? 12 : 0, dy: a === "middle" ? -11 : 0,
        text: (d) => d.v.toFixed(0) + "%",
        fill: (d, i) => (isWorst(d, i) ? "#161A22" : "#878D99"), fontSize: 12.5, fontFamily: mono,
        fontWeight: (d, i) => (isWorst(d, i) ? 500 : 400), textAnchor: a })),
    ],
  });
  a11y(plot, "Child anaemia by state, NFHS-5", "Sorted dot strip of " + rows.length + " states/UTs. " + rows[0].state + " lowest at " + rows[0].v.toFixed(0) + "%, " + rows.at(-1).state + " highest at " + rows.at(-1).v.toFixed(0) + "%. Spread: " + spread.toFixed(0) + " points.");
  document.getElementById("plot-states").append(plot);
  wirePlate(document.getElementById("cb-states"), plot, "india-atlas_nfhs_state-child-anaemia_nfhs5", "state,child_anaemia_pct\n" + rows.map((r) => `"${r.state}",${r.v.toFixed(1)}`).join("\n"));
}

/* ---------- provenance ---------- */
setTxt("prov-vintage", anaemiaBundle.meta.vintage);
setTxt("prov-vintage2", anaemiaBundle.meta.vintage);
