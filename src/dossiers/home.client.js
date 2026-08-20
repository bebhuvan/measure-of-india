// Homepage — latest-prints strip, frontispiece plate, dossier-row sparklines.
// Data comes from the same baked bundles the dossiers use.

import * as Plot from "@observablehq/plot";
import cpiBundle from "../../data/series/cpi.json";
import cpi2024Bundle from "../../data/series/cpi-2024.json";
import gdpBundle from "../../data/series/gdp.json";
import gdp2022Bundle from "../../data/series/gdp-2022.json";
import wpiBundle from "../../data/series/wpi.json";
import iipBundle from "../../data/series/iip-2022.json";
import forexBundle from "../../data/series/rbi-forex.json";
import plfsBundle from "../../data/series/plfs-monthly.json";
import fractilesBundle from "../../data/series/hces-fractiles.json";
import asiBundle from "../../data/series/asi-headline.json";
import aisheBundle from "../../data/series/aishe-headline.json";
import genderBundle from "../../data/series/gender-sexratio.json";
import mnreBundle from "../../data/series/mnre-sources.json";
import nfhsBundle from "../../data/series/nfhs-anaemia.json";
import { hydrate } from "../charts/plumbing.js";
import { DOSSIERS } from "./registry.js";

const C = hydrate(cpiBundle);
const C24 = hydrate(cpi2024Bundle);   // base 2024=100 — separate series, never spliced with C
const G = hydrate(gdpBundle);
const G22 = hydrate(gdp2022Bundle);   // base 2022-23 — the two newest prints live only here
const W = hydrate(wpiBundle);
const I = hydrate(iipBundle);
const FX = hydrate(forexBundle);
const PLFS = hydrate(plfsBundle);
// the CPI print now lives on the 2024 base; core cannot be computed there
// (no weights served yet), so it stays on the 2012 base, labelled to Dec 2025
// the GDP print now lives on the 2022-23 base (old base ends Q2 FY26)
const head = C.headline.data, head24 = C24.headline.data, core = C.core.data, gdp = G.gdp.data, gdp22 = G22.gdp.data, wpi = W.headline.data, iip = I.general.data.filter((d) => d.value != null);

const pc = '<span class="pc">%</span>';
const arrow = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt";
const setHTML = (id, h) => (document.getElementById(id).innerHTML = h);
setHTML("v-cpi", head24.at(-1).value.toFixed(2) + pc);
setHTML("d-cpi", arrow(head24.at(-1).value - head24.at(-2).value));
setHTML("v-gdp", gdp22.at(-1).value.toFixed(2) + pc);
setHTML("d-gdp", arrow(gdp22.at(-1).value - gdp22.at(-2).value));
setHTML("v-core", core.at(-1).value.toFixed(2) + pc);
setHTML("d-core", arrow(core.at(-1).value - core.at(-2).value));

function sparkline(id, data, color, dashed, w = 200, h = 40) {
  const vs = data.map((d) => d.value);
  const plot = Plot.plot({
    width: w, height: h, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
    style: { background: "transparent" },
    x: { axis: null },
    y: { axis: null, domain: [Math.min(...vs, 0), Math.max(...vs)] },
    marks: [
      Plot.ruleY([0], { stroke: "#E6E2D6" }),
      Plot.lineY(data, { x: "date", y: "value", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round",
        ...(dashed ? { strokeDasharray: "3 2" } : {}) }),
      Plot.dot([data.at(-1)], { x: "date", y: "value", fill: color, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
    ],
  });
  plot.setAttribute("aria-hidden", "true");
  document.getElementById(id).append(plot);
}
sparkline("sp-cpi", head24, "#BE3E26", false);
sparkline("sp-gdp", gdp22, "#BE3E26", false);
sparkline("sp-core", core, "#C6C0B0", true);

/* ---------- frontispiece : the decade + the rebased stub, never joined ---------- */
{
  const seam = head24[0].date;
  const plot = Plot.plot({
    width: 1184, height: 240, marginLeft: 0, marginRight: 120, marginTop: 14, marginBottom: 10,
    style: { background: "transparent", fontFamily: "'IBM Plex Mono',monospace" },
    x: { axis: null },
    y: { axis: null, domain: [-1, 9] },
    marks: [
      Plot.rectY([{ y1: 2, y2: 6 }], { y1: "y1", y2: "y2", x1: head[0].date, x2: head24.at(-1).date, fill: "#F8F6F1" }),
      Plot.ruleY([0], { stroke: "#E0DACA", strokeWidth: 1 }),
      Plot.text([{ date: head[0].date, value: 6.7 }], { x: "date", y: "value", text: ["RBI tolerance band · 2–6%"],
        fontSize: 11, fill: "#B4AFA2", fontFamily: "'IBM Plex Mono',monospace", textAnchor: "start" }),
      // the retired 2012 base to Dec 2025, then the 2024 base from Jan 2026 —
      // two lines with a drawn seam, never one array
      Plot.lineY(head, { x: "date", y: "value", stroke: "#8A857A", strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.ruleX([seam], { stroke: "#C9C3B2", strokeWidth: 1, strokeDasharray: "2,3" }),
      Plot.text([{ date: seam, value: 8.5 }], { x: "date", y: "value", text: ["base revised · 2012 → 2024"],
        fontSize: 11, fill: "#8A857A", fontFamily: "'IBM Plex Mono',monospace", textAnchor: "end", dx: -6 }),
      Plot.lineY(head24, { x: "date", y: "value", stroke: "#BE3E26", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" }),
      Plot.dot([head24.at(-1)], { x: "date", y: "value", fill: "#BE3E26", r: 4.5, stroke: "#FFFFFF", strokeWidth: 1.5 }),
      Plot.text([head24.at(-1)], { x: "date", y: "value", text: (d) => d.value.toFixed(2) + "%", dx: 14,
        fontSize: 14, fill: "#BE3E26", fontFamily: "'IBM Plex Mono',monospace", fontWeight: 500, textAnchor: "start" }),
    ],
  });
  plot.setAttribute("role", "img");
  const MNL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const when = (d) => MNL[d.getUTCMonth()] + " " + d.getUTCFullYear();
  plot.setAttribute("aria-label", "Line chart of headline CPI inflation from " + when(head[0].date) + " to " + when(head24.at(-1).date) + " in two segments that never join: the retired 2012 base to " + when(head.at(-1).date) + ", and the rebased 2024 series from " + when(head24[0].date) + ", ending at " + head24.at(-1).value.toFixed(2) + " per cent, inside the RBI tolerance band of 2 to 6 per cent.");
  document.getElementById("frontis-plot").append(plot);
}

/* ---------- dossier-row sparklines (driven by the registry) ---------- */
// Vite needs static imports, so bundles are imported above and mapped here;
// the registry says which bundle+series each dossier's row sparkline draws.
// Element ids are `ds-<slug>` — the homepage generates them the same way.
const SPARK_BUNDLES = {
  "cpi": cpiBundle, "gdp": gdpBundle, "wpi": wpiBundle, "iip-2022": iipBundle,
  "rbi-forex": forexBundle, "plfs-monthly": plfsBundle, "hces-fractiles": fractilesBundle,
  "asi-headline": asiBundle, "aishe-headline": aisheBundle, "gender-sexratio": genderBundle,
  "mnre-sources": mnreBundle, "nfhs-anaemia": nfhsBundle,
};
for (const d of DOSSIERS) {
  if (!d.spark.series) continue;   // custom shapes handled below
  const H = hydrate(SPARK_BUNDLES[d.spark.bundle]);
  sparkline(`ds-${d.slug}`, H[d.spark.series].data.filter((p) => p.value != null), "#BE3E26", false, 120, 32);
}
// № 07 is cross-sectional — two rounds, no time axis. The card mark is the
// 12-class fractile ladder (rural, 2023-24): a real ordering, drawn as a line.
{
  const F = hydrate(fractilesBundle);
  const FRACS = ["f0_5", "f5_10", "f10_20", "f20_30", "f30_40", "f40_50",
    "f50_60", "f60_70", "f70_80", "f80_90", "f90_95", "f95_100"];
  const ladder = FRACS.map((k, i) => ({ date: i, value: F[k + "_rural"].data[1].value }));
  sparkline("ds-consumption", ladder, "#BE3E26", false, 120, 32);
}
// № 12's mark is child anaemia NFHS-4 → NFHS-5 (the worsening).
{
  const s = Object.values(nfhsBundle.series).find((x) => x.label.toLowerCase().includes("children age 6-59"));
  if (s) {
    const data = s.data.map((v, i) => ({ date: i, value: v }));
    sparkline("ds-nfhs", data, "#BE3E26", false, 120, 32);
  }
}
