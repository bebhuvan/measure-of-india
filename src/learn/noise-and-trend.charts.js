// Learn № 19 · Noise and trend: the plate, drawn at build time with the chart kit (src/kit/), and
// every number the page shows (NUM, text by element id, the arithmetic the old client used).
// Data: data/series/cpi.json (baked y/y, two decimals as the page always quoted) + data/raw/cpi-indices.json
// (published levels; month-on-month computed from them).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

/* window: Jan 2021 to Dec 2025 */
const yoy = pairs(bundle, "headline", { round: false, from: "2021-01-01", to: "2025-12-01" });
const lv = levels.levels["combined:general"];
const keys = Object.keys(lv).sort();
/* m/m from published levels, one step back for the first window month */
const mom = yoy.map(([d]) => { const k = d.slice(0, 7), prev = keys[keys.indexOf(k) - 1]; return [d, (lv[k] / lv[prev] - 1) * 100]; });

/* the spike that reversed: the largest m/m in the window, and the two months after it */
let si = 0; mom.forEach((p, i) => { if (p[1] > mom[si][1]) si = i; });
const spike = mom[si], rev1 = mom[si + 1], rev2 = mom[si + 2];
const yAt = (d) => yoy.find((p) => p[0] === d);
const y0 = yAt("2023-06-01"), y1 = yAt(spike[0]), y2 = yAt(rev2[0]);
const lastY = yoy.at(-1);

const pc = '<span class="pc">%</span>';
const sgn = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1);
export const NUM = {
  "pv-nt": lastY[1].toFixed(2) + "%",
  "pf-nt": bundle.meta.vintage,
  "n-spike": "+" + spike[1].toFixed(1) + pc,
  "n-rev1": sgn(rev1[1]) + pc,
  "n-rev2": sgn(rev2[1]) + pc,
  "n-yoy": "+" + lastY[1].toFixed(2) + pc,
  "c-spike": spike[1].toFixed(1) + " per cent",
  "c-rev1": sgn(rev1[1]) + " per cent",
  "c-rev2": sgn(rev2[1]) + " per cent",
  "c-y0": y0[1].toFixed(1),
  "c-y1": y1[1].toFixed(1),
  "c-y2": y2[1].toFixed(1),
};

/** The trend (y/y, lead) against the noise (m/m, grey); the July 2023 spike and its reversal named. */
export function nt() {
  const mins = (P) => Math.min(...P.map((p) => p[1])), maxs = (P) => Math.max(...P.map((p) => p[1]));
  return figure({
    bare: true, file: "india-atlas_learn_noise-and-trend_cpi-mom-yoy_2021-2025",
    label: `CPI inflation, month-on-month and year-on-year, ${monthShort(yoy[0][0])} to ${monthShort(lastY[0])}: the grey month-on-month line swings between ${mins(mom).toFixed(1)} and +${spike[1].toFixed(1)} per cent; the year-on-year line moves slowly between ${mins(yoy).toFixed(1)} and ${maxs(yoy).toFixed(1)}; the ${monthShort(spike[0])} monthly spike reversed within two months`,
    data: { cols: ["Month", "Inflation, y/y %", "Month-on-month %"], rows: yoy.map(([d, v], i) => [d.slice(0, 7), v, +mom[i][1].toFixed(4)]) },
    draw: (width) => {
      const phone = width < 520;
      return K.line({
        width, height: phone ? 320 : 440, freq: "month", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, noteAvoid: true, yDomain: [-4, 8], yCount: 6,
        series: [
          { name: "Month-on-month", short: "m/m", data: mom, role: "ctx" },
          { name: "Year-on-year", short: "y/y", data: yoy, role: "lead" },
        ],
        notes: [
          { d: spike[0], v: spike[1], text: phone ? `${monthShort(spike[0])}\n${K.num(spike[1], { dp: 1, sign: true, suffix: "%" })}` : `${monthShort(spike[0])}, ${K.num(spike[1], { dp: 1, sign: true, suffix: "%" })} m/m\nweather, not climate`, side: "right" },
          ...(phone ? [] : [{ d: rev2[0], v: rev2[1], text: `${monthShort(rev2[0])}, ${K.num(rev2[1], { dp: 1, sign: true, suffix: "%" })}\nreversed within two months`, side: "right", below: true }]),
        ],
      });
    },
  });
}
