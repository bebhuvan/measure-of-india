// Learn № 05 · y/y and m/m: one index, two speeds, drawn at build time with the chart kit
// (src/kit/), and every number the page shows (NUM, by element id).
// y/y: data/series/cpi.json (baked bundle, quoted at two decimals as the page always has).
// m/m: computed from data/raw/cpi-indices.json (published combined levels).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

const yy = pairs(bundle, "headline", { round: false, from: "2021-01-01" });
const ph = levels.levels["combined:general"];
const ks = Object.keys(ph).filter((k) => k >= "2020-12" && k <= "2025-12").sort();
const mm = [];
for (let i = 1; i < ks.length; i++) mm.push([ks[i] + "-01", (ph[ks[i]] / ph[ks[i - 1]] - 1) * 100]);
const mNow = mm.at(-1), yNow = yy.at(-1);
const mMax = mm.reduce((a, d) => (d[1] > a[1] ? d : a));
const negMonths = mm.filter((d) => d[1] < 0).length;
let flips = 0;
for (let i = 1; i < mm.length; i++) if ((mm[i][1] > 0) !== (mm[i - 1][1] > 0)) flips++;
const yJul23 = yy.find(([d]) => d.startsWith("2023-07"));
const pc = '<span class="pc">%</span>';

export const NUM = {
  "pv-ym": yNow[1].toFixed(2) + "%",
  "pf-ym": bundle.meta.vintage,
  "ev-flips": String(flips),
  "ex-mjump": "+" + mMax[1].toFixed(1) + " per cent",
  "ex-yjul": yJul23[1].toFixed(2) + "%",
  "n-ym-mom": "+" + mNow[1].toFixed(1) + pc,
  "n-ym-yoy": yNow[1].toFixed(2) + pc,
  "n-ym-max": "+" + mMax[1].toFixed(1) + pc,
  "n-ym-flips": String(flips),
  "ar-flips": String(flips),
  "mr1-neg": String(negMonths),
};

/** The signal and the noise: y/y in the lead colour, m/m as the grey context it smooths. */
export function ym() {
  const mins = Math.min(...mm.map((d) => d[1])), maxs = mMax[1];
  return figure({
    bare: true, file: "india-atlas_learn_yoy-and-mom_2021-2025",
    label: `Headline CPI inflation, year-on-year and month-on-month, ${monthShort(yy[0][0])} to ${monthShort(yNow[0])}: year-on-year ends at ${yNow[1].toFixed(2)}%; month-on-month swings between ${K.num(mins, { dp: 1 })} and +${maxs.toFixed(1)}%, changing sign ${flips} times`,
    draw: (width) => K.line({
      width, height: width < 520 ? 280 : 420, freq: "month", endDp: 2, hoverDp: 2,
      unit: { suffix: "%" },
      // each end label at the precision the page quotes it: m/m to one decimal, y/y to two
      endFormat: (v) => K.num(v, { dp: v === mNow[1] ? 1 : 2, sign: true, suffix: "%" }),
      series: [
        { name: "Month-on-month", data: mm, role: "ctx" },
        { name: "Year-on-year", data: yy, role: "lead" },
      ],
      yDomain: [-2, 8],
      // a phone has no clear room beside the spike (the y/y line runs just above it); the prose names it
      notes: width < 520 ? [] : [{ d: mMax[0], v: mMax[1], text: `${monthShort(mMax[0])}\n+${mMax[1].toFixed(1)}% in one month`, side: "right" }],
    }),
  });
}
