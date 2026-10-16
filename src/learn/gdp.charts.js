// Learn № 09 · GDP: the plate, drawn at build time with the chart kit, and every number on the page.
// Data: data/series/gdp.json (y/y bundle, constant 2011-12 prices; one base, never spliced).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { bundle, series, fmtQ, trough, peak, pc } from "./nas-quarters.js";

const g = series("gdp");
const last = g.at(-1), prev = g.at(-2);
const crash = trough(g);
const rebound = peak(g.filter(([d]) => d.startsWith("2021-")));
const trendAvg = g.slice(0, 16).reduce((a, p) => a + p[1], 0) / 16;
const last4 = g.slice(-4);

export const NUM = {
  "pv-gdp": last[1].toFixed(2) + "%",
  "pf-gdp": bundle.meta.vintage,
  "n-last": "+" + last[1].toFixed(2) + pc,
  "n-prev": "+" + prev[1].toFixed(2) + pc,
  "n-trend": trendAvg.toFixed(1) + "%",
  "n-crash": "−" + Math.abs(crash[1]).toFixed(2) + pc,
  "fy26-run": last4.map((p) => p[1].toFixed(1)).join(", "),
  "fy26-last": last[1].toFixed(2) + "%",
};

/** Real GDP growth by quarter: the 6% trend, the lockdown quarter, the rebound, the recent run. */
export function gdp() {
  return figure({
    bare: true, file: "india-atlas_learn_gdp_real-gdp-yoy_fy17-fy26",
    label: `Real GDP growth, year-on-year, ${fmtQ(g[0][0])} to ${fmtQ(last[0])}: growth holds near a 6 per cent trend before 2020, crashes to ${crash[1].toFixed(1)} per cent in the lockdown quarter, rebounds to ${rebound[1].toFixed(1)} on the base effect, and ends at ${last[1].toFixed(2)} per cent in ${fmtQ(last[0])}`,
    data: { cols: ["Quarter", "Quarter starting", "Real GDP, y/y %"], rows: g.map(([d, v]) => [fmtQ(d), d.slice(0, 7), v]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 300 : 440, freq: "quarter", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, inside: false,
      endSub: width < 520 ? null : fmtQ(last[0]),
      series: [
        { name: "Real GDP, y/y", data: g, role: "lead" },
        { name: "Last four quarters", data: last4, role: "lead", dots: true, label: false, hover: false },
      ],
      refs: [{ y: 6, label: "Rough pre-pandemic trend, 6%" }],
      events: [{ t: crash[0], label: "COVID-19" }],
      notes: [
        { d: crash[0], v: crash[1], text: `${fmtQ(crash[0])}, lockdown\n${K.num(crash[1], { dp: 1, suffix: "%" })}`, side: "right" },
        { d: rebound[0], v: rebound[1], text: `${fmtQ(rebound[0])}, base effect\n${K.num(rebound[1], { dp: 1, suffix: "%" })}`, side: "right" },
      ],
    }),
  });
}
