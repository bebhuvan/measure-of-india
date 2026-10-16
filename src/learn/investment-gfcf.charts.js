// Learn № 12 · Investment / GFCF: the plate, drawn at build time with the chart kit, and every number.
// Data: data/series/gdp.json (y/y bundle) + data/raw/nas-levels.json (levels, for the share).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import levels from "../../data/raw/nas-levels.json.gz";
import { bundle, series, fmtQ, trough, peak, pc } from "./nas-quarters.js";

const f = series("gfcf");
const last = f.at(-1), low = trough(f), high = peak(f);
const trendAvg = f.slice(0, 16).reduce((a, p) => a + p[1], 0) / 16;
const last4 = f.slice(-4);
const lastKey = bundle.meta.latestPeriod;
const share = levels.levels.gfcf[lastKey] / levels.levels.gdp[lastKey] * 100;
// the FY20 pre-pandemic slump: three straight quarters below zero
const fy20run = f.filter(([d]) => d >= "2019-07-01" && d <= "2020-01-01");
const fy20gdp = series("gdp").find(([d]) => fmtQ(d) === "Q4 FY20");

export const NUM = {
  "pv-gfcf": last[1].toFixed(2) + "%",
  "pf-gfcf": bundle.meta.vintage,
  "n-last": "+" + last[1].toFixed(2) + pc,
  "n-trough": "−" + Math.abs(low[1]).toFixed(2) + pc,
  "n-peak": "+" + high[1].toFixed(2) + pc,
  "n-share": share.toFixed(1) + "%",
  "ht-peak": high[1].toFixed(1) + " per cent",
  "fy20-run": fy20run.map((p) => p[1].toFixed(1)).join(", "),
  "fy20-gdp": fy20gdp[1].toFixed(2) + "%",
  "rec-run": last4.map((p) => p[1].toFixed(1)).join(", "),
  "rec-avg": trendAvg.toFixed(1) + " per cent",
};

/** Real GFCF growth by quarter: the FY20 warning, the lockdown plunge, the base-effect spike, the recovery. */
export function gfcf() {
  return figure({
    bare: true, file: "india-atlas_learn_investment-gfcf_fy17-fy26",
    label: `Real GFCF growth, year-on-year, ${fmtQ(f[0][0])} to ${fmtQ(last[0])}: investment growth turns negative for three quarters in FY20, crashes to ${low[1].toFixed(1)} per cent in the lockdown, spikes to ${high[1].toFixed(1)} on the base effect, and ends at ${last[1].toFixed(2)} per cent`,
    data: { cols: ["Quarter", "Quarter starting", "Real GFCF, y/y %"], rows: f.map(([d, v]) => [fmtQ(d), d.slice(0, 7), v]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 300 : 440, freq: "quarter", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, inside: false,
      endSub: width < 520 ? null : fmtQ(last[0]),
      series: [
        { name: "Real GFCF, y/y", data: f, role: "lead" },
        { name: "FY20, below zero", data: fy20run, role: "comp", dots: true, label: false, hover: false },
        { name: "Last four quarters", data: last4, role: "lead", dots: true, label: false, hover: false },
      ],
      events: [{ t: low[0], label: "COVID-19" }],
      notes: [
        { d: fy20run[1][0], v: fy20run[1][1], text: width < 520 ? "FY20\nbelow zero" : "FY20: three quarters below zero\nbefore the pandemic", side: "left", below: true },
        { d: low[0], v: low[1], text: `${fmtQ(low[0])}${width < 520 ? "" : ", building stopped"}\n${K.num(low[1], { dp: 1, suffix: "%" })}`, side: "right" },
        { d: high[0], v: high[1], text: `${fmtQ(high[0])}, base effect\n${K.num(high[1], { dp: 1, suffix: "%" })}`, side: "right" },
      ],
    }),
  });
}
