// Learn № 07 · Inflation targeting: the plate, drawn at build time with the chart kit (src/kit/),
// and every number the page shows (NUM, text by element id, the arithmetic the old client used).
// Rate: data/series/cpi.json (baked y/y bundle), quoted at two decimals as the page always has.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";

const h = pairs(bundle, "headline", { round: false }).filter(([, v]) => v != null);
const ym = (d) => d.slice(0, 7);
const peakBetween = (a, b) => h.filter(([d]) => ym(d) >= a && ym(d) <= b).reduce((m, p) => (p[1] > m[1] ? p : m));
const qAvg = (y, m0) => [0, 1, 2].map((i) => h.find(([d]) => d.startsWith(`${y}-${String(m0 + i).padStart(2, "0")}`))[1]).reduce((a, c) => a + c, 0) / 3;

const pk20 = peakBetween("2019-11", "2020-03");
const pk22 = peakBetween("2022-01", "2022-09");
const pk23 = peakBetween("2023-06", "2023-12");
const low25 = h.filter(([d]) => d >= "2025-01").reduce((m, p) => (p[1] < m[1] ? p : m));
const pNow = h.at(-1);
const p2 = (v) => v.toFixed(2) + "%";

export const NUM = {
  "pv-it": p2(pNow[1]),
  "pf-it": bundle.meta.vintage,
  "it-m-above": String(h.filter(([, v]) => v > 6).length),
  "it-m-below": String(h.filter(([, v]) => v < 2).length),
  "it-pk20": p2(pk20[1]),
  "it-pk22": p2(pk22[1]),
  "it-pk23": p2(pk23[1]),
  "it-low25": p2(low25[1]),
  "it-c-q1": qAvg(2022, 1).toFixed(1) + " per cent",
  "it-c-q2": qAvg(2022, 4).toFixed(1) + " per cent",
  "it-c-q3": qAvg(2022, 7).toFixed(1) + " per cent",
};

/** Ten years against the band: the four excursions named, the 2022 letter's three quarters shaded. */
export function band() {
  return figure({
    bare: true, file: "india-atlas_learn_inflation-targeting_band_2016-2025",
    label: `Headline CPI inflation against the RBI tolerance band of 2 to 6%, ${monthShort(h[0][0])} to ${monthShort(pNow[0])}: excursions at ${p2(pk20[1])} in ${monthShort(pk20[0])}, ${p2(pk22[1])} in ${monthShort(pk22[0])}, ${p2(pk23[1])} in ${monthShort(pk23[0])}, and ${p2(low25[1])} in ${monthShort(low25[0])}, below the floor; the rate ends at ${p2(pNow[1])}`,
    draw: (width) => {
      const phone = width < 520;
      const note = (p, why, extra = {}) => ({ d: p[0], v: p[1], text: phone ? `${monthShort(p[0])}\n${p2(p[1])}` : `${monthShort(p[0])}, ${p2(p[1])}\n${why}`, ...extra });
      return K.line({
        width, height: phone ? 320 : 420, freq: "month", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, yDomain: [0, 9], yCount: 5, noteAvoid: true, inside: false,
        series: [{ name: "Inflation, y/y", data: h, role: "lead" }],
        band: { from: 2, to: 6, label: "Tolerance band, 2–6%" },
        refs: [{ y: 4, label: "Target 4%" }],
        shade: [{ from: "2022-01-01", to: "2022-10-01" }],
        // a phone has room for two: the 2020 food spike and the 2022 letter (the floor shows beside the end label)
        notes: phone ? [
          note(pk20, "", { side: "left" }),
          note(pk22, "", { side: "right" }),
        ] : [
          note(pk20, "food above the ceiling", { side: "left" }),
          note(pk22, "the letter year", { side: "left" }),
          note(pk23, "vegetables", { side: "right" }),
          note(low25, "through the floor", { side: "left", below: true }),
        ],
      });
    },
  });
}
