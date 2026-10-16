// Learn № 20 · The monsoon and food prices: the plate, drawn at build time with the chart kit
// (src/kit/), and every number the page shows (NUM, text by element id, the old client's arithmetic).
// Rate: data/series/cpi.json (baked y/y bundle), quoted at two decimals as the page always has.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";

const f = pairs(bundle, "food", { round: false }).filter(([, v]) => v != null);
const at = (ym) => f.find(([d]) => d.startsWith(ym));
const onion = at("2019-12");                                     // the onion spike
const veg23 = at("2023-07");                                     // the vegetable spike
const defl25 = f.filter(([d]) => d >= "2025-01").reduce((m, p) => (p[1] < m[1] ? p : m)); // the 2025 low
const pNow = f.at(-1);
const p2 = (v) => v.toFixed(2) + "%";
const k2 = (v) => K.num(v, { dp: 2, suffix: "%" }); // on the chart: a true minus

export const NUM = {
  "pv-mo": p2(pNow[1]),
  "pf-mo": bundle.meta.vintage,
  "mo-onion": p2(onion[1]),
  "mo-defl": p2(defl25[1]),
  "mo-dec25": p2(pNow[1]),
};

/** Food inflation with the 2019 monsoon shaded and the three episodes it teaches named. */
export function monsoon() {
  return figure({
    bare: true, file: "india-atlas_learn_monsoon_food-yoy_2016-2025",
    label: `Food inflation, year-on-year, ${monthShort(f[0][0])} to ${monthShort(pNow[0])}, the 2019 monsoon months shaded: the onion spike of ${p2(onion[1])} in ${monthShort(onion[0])}, the vegetable spike of ${p2(veg23[1])} in ${monthShort(veg23[0])}, and the 2025 deflation bottoming at ${p2(defl25[1])} in ${monthShort(defl25[0])}; it ends at ${p2(pNow[1])}`,
    draw: (width) => {
      const phone = width < 520;
      const note = (p, why, o = {}) => ({ d: p[0], v: p[1], text: phone ? `${monthShort(p[0])}\n${k2(p[1])}` : `${monthShort(p[0])}, ${k2(p[1])}\n${why}`, ...o });
      return K.line({
        width, height: phone ? 300 : 420, freq: "month", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, inside: false, noteAvoid: true,
        endFormat: k2,
        series: [{ name: "Food inflation, y/y", data: f, role: "lead" }],
        shade: [{ from: "2019-06-01", to: "2019-10-01", label: phone ? "" : "2019 monsoon" }],
        notes: [
          note(onion, "its harvest: onions", { side: "right" }),
          note(veg23, "vegetables", { side: "right" }),
          // a phone leaves the 2025 low to the end label beside it
          ...(phone ? [] : [note(defl25, "a good harvest, one winter late", { side: "left", below: true })]),
        ],
      });
    },
  });
}
