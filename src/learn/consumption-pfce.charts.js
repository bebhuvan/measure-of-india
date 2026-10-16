// Learn № 13 · Consumption / PFCE: the plate, drawn at build time with the chart kit, and every number.
// Data: data/series/gdp.json (y/y bundle) + data/raw/nas-levels.json (levels, for the share).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import levels from "../../data/raw/nas-levels.json.gz";
import { bundle, series, fmtQ, trough, peak, pc } from "./nas-quarters.js";

const p = series("pfce");
const last = p.at(-1), low = trough(p), high = peak(p);
const trendAvg = p.slice(0, 16).reduce((a, q) => a + q[1], 0) / 16;
const last4 = p.slice(-4);
const lastKey = bundle.meta.latestPeriod;
const share = levels.levels.pfce[lastKey] / levels.levels.gdp[lastKey] * 100;
// the FY23 idle: Q3 and Q4 FY23
const fy23 = p.filter(([d]) => ["Q3 FY23", "Q4 FY23"].includes(fmtQ(d)));

export const NUM = {
  "pv-pfce": last[1].toFixed(2) + "%",
  "pf-pfce": bundle.meta.vintage,
  "n-last": "+" + last[1].toFixed(2) + pc,
  "n-share": share.toFixed(1) + "%",
  "n-trough": "−" + Math.abs(low[1]).toFixed(2) + pc,
  "n-trend": trendAvg.toFixed(1) + "%",
  "ht-peak": high[1].toFixed(1) + " per cent",
  "fy23-run": fy23.map((q) => q[1].toFixed(1)).join(" and "),
  "rec-run": last4.map((q) => q[1].toFixed(1)).join(", "),
};

/** Real PFCE growth by quarter: steady before 2020, the lockdown crash, the base effect, the FY23 idle. */
export function pfce() {
  return figure({
    bare: true, file: "india-atlas_learn_consumption-pfce_fy17-fy26",
    label: `Real PFCE growth, year-on-year, ${fmtQ(p[0][0])} to ${fmtQ(last[0])}: household spending growth holds near ${trendAvg.toFixed(1)} per cent before 2020, crashes to ${low[1].toFixed(1)} per cent in the lockdown, peaks at ${high[1].toFixed(1)} on the base effect, idles in FY23, and ends at ${last[1].toFixed(2)} per cent`,
    data: { cols: ["Quarter", "Quarter starting", "Real PFCE, y/y %"], rows: p.map(([d, v]) => [fmtQ(d), d.slice(0, 7), v]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 300 : 440, freq: "quarter", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, inside: false,
      endSub: width < 520 ? null : fmtQ(last[0]),
      series: [
        { name: "Real PFCE, y/y", data: p, role: "lead" },
        { name: "FY23 idle", data: fy23, role: "comp", dots: true, label: false, hover: false },
        { name: "Last four quarters", data: last4, role: "lead", dots: true, label: false, hover: false },
      ],
      events: [{ t: low[0], label: "COVID-19" }],
      notes: [
        { d: fy23[0][0], v: fy23[0][1], text: "The engine idles\nH2 FY23", side: "left", below: true },
        { d: low[0], v: low[1], text: `${fmtQ(low[0])}${width < 520 ? "" : ", the shops closed"}\n${K.num(low[1], { dp: 1, suffix: "%" })}`, side: "right" },
        { d: high[0], v: high[1], text: `${fmtQ(high[0])}, base effect\n${K.num(high[1], { dp: 1, suffix: "%" })}`, side: "right" },
      ],
    }),
  });
}
