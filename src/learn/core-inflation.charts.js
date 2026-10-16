// Learn № 04 · Core inflation: the plate, drawn at build time with the chart kit (src/kit/), and
// every number the page shows (NUM, text by element id, the arithmetic the old client used).
// Rate: data/series/cpi.json (baked y/y bundle; core computed upstream from group indices),
// quoted at two decimals as the page always has.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";

const RAW = { round: false };
const h = pairs(bundle, "headline", RAW), c = pairs(bundle, "core", RAW);
const hNow = h.at(-1), cNow = c.at(-1);
const valid = c.filter((p) => p[1] != null);
const cMin = valid.reduce((a, d) => (d[1] < a[1] ? d : a));
const cMax = valid.reduce((a, d) => (d[1] > a[1] ? d : a));
const gap = cNow[1] - hNow[1];

export const NUM = {
  "pv-core": cNow[1].toFixed(2) + "%",
  "pf-core": bundle.meta.vintage,
  "ev-cmin": cMin[1].toFixed(1) + " per cent",
  "ev-cmax": cMax[1].toFixed(1) + " per cent",
  "ex-hdec": hNow[1].toFixed(2) + "%",
  "ex-cdec": cNow[1].toFixed(2) + "%",
  "ex-gap": gap.toFixed(1) + " points",
  "mr3-h": hNow[1].toFixed(2) + "%",
  "mr3-c": cNow[1].toFixed(2) + "%",
  "mr3-gap": gap.toFixed(1) + " points",
};

/** Core (the signal, lead) against the headline (the noisy average, grey), with the RBI band. */
export function core() {
  return figure({
    bare: true, file: "india-atlas_learn_core-inflation_2016-2025",
    label: `Core and headline CPI inflation, year-on-year, ${monthShort(h[0][0])} to ${monthShort(hNow[0])}: core ends at ${cNow[1].toFixed(2)}% while the headline ends at ${hNow[1].toFixed(2)}%, a wedge of ${gap.toFixed(1)} points; core ranged between ${cMin[1].toFixed(1)} and ${cMax[1].toFixed(1)}% across the decade`,
    draw: (width) => K.line({
      width, height: width < 520 ? 280 : 400, freq: "month", unit: { suffix: "%" }, endDp: 2, hoverDp: 2, yDomain: [0, 8],
      series: [
        { name: "Headline", data: h, role: "ctx" },
        { name: "Core", data: c, role: "lead" },
      ],
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
      refs: [{ y: 4, label: "Target 4%" }],
    }),
  });
}
