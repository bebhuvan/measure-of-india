// Learn № 10 · GDP versus GVA: the plate, drawn at build time with the chart kit, and every number.
// Data: data/series/gdp.json (y/y bundle) + data/raw/nas-levels.json (levels, for the wedge share).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import levels from "../../data/raw/nas-levels.json.gz";
import { bundle, series, fmtQ, pc } from "./nas-quarters.js";

const g = series("gdp"), v = series("gva");
const lastG = g.at(-1), lastV = v.at(-1);
const lastKey = bundle.meta.latestPeriod;
const wedgeShare = (levels.levels.gdp[lastKey] - levels.levels.gva[lastKey]) / levels.levels.gdp[lastKey] * 100;
// the widest pre-2020 gap between the lines: the wedge, annotated once
let wp = null;
g.forEach(([d, gv], i) => {
  if (d >= "2020-01-01") return;
  const gap = gv - v[i][1];
  if (!wp || Math.abs(gap) > Math.abs(wp.gap)) wp = { d, gdp: gv, gva: v[i][1], gap };
});
// the FY21 inversion: GVA above GDP
const i21 = g.findIndex(([d]) => fmtQ(d) === "Q4 FY21");
const fy21 = { d: g[i21][0], gdp: g[i21][1], gva: v[i21][1] };
const gap = lastG[1] - lastV[1];

export const NUM = {
  "pv-gg": lastG[1].toFixed(2) + "%",
  "pf-gg": bundle.meta.vintage,
  "n-gdp": "+" + lastG[1].toFixed(2) + pc,
  "n-gva": "+" + lastV[1].toFixed(2) + pc,
  "n-gap": (gap >= 0 ? "+" : "−") + Math.abs(gap).toFixed(1) + " pt",
  "n-wedge": wedgeShare.toFixed(1) + "%",
  "fy21-gdp": fy21.gdp.toFixed(2) + "%",
  "fy21-gva": fy21.gva.toFixed(2) + "%",
};

/** Real GDP and GVA growth on one axis: the gap between them is taxes net of subsidies. */
export function gg() {
  return figure({
    bare: true, file: "india-atlas_learn_gdp-vs-gva_fy17-fy26",
    label: `Real GDP and real GVA growth, year-on-year, ${fmtQ(g[0][0])} to ${fmtQ(lastG[0])}: GDP ends at ${lastG[1].toFixed(2)} per cent and GVA at ${lastV[1].toFixed(2)}; the gap between the lines is net taxes, widest before 2020 in ${fmtQ(wp.d)}, and inverted in Q4 FY21, when GVA grew faster than GDP`,
    data: { cols: ["Quarter", "Quarter starting", "Real GDP, y/y %", "Real GVA, y/y %"], rows: g.map(([d, x], i) => [fmtQ(d), d.slice(0, 7), x, v[i][1]]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 300 : 440, freq: "quarter", unit: { suffix: "%" }, endDp: 2, hoverDp: 2,
      series: [
        { name: "GVA, basic prices", short: "GVA", data: v, role: "comp" },
        { name: "GDP, market prices", short: "GDP", data: g, role: "lead" },
      ],
      // the wedge itself, filled between the two lines
      ranges: [{ data: g.map(([d, x], i) => [d, Math.min(x, v[i][1]), Math.max(x, v[i][1])]), color: "#D9DEF2" }],
      events: [{ t: "2020-04-01", label: "COVID-19" }],
      notes: [
        { d: wp.d, v: Math.max(wp.gdp, wp.gva), text: width < 520 ? `${fmtQ(wp.d)}\nwidest gap` : `${fmtQ(wp.d)}: the widest gap\nbefore 2020 is net taxes`, side: "right", dy: 24 },
        { d: fy21.d, v: fy21.gva, text: width < 520 ? `${fmtQ(fy21.d)}\nGVA above GDP` : `${fmtQ(fy21.d)}: GVA above GDP\nsubsidies surged`, side: "right", below: true, dy: 40 },
      ],
    }),
  });
}
