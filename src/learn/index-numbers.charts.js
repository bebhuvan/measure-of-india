// Learn № 08 · Index numbers: the published level beside the same series rebased, drawn at build
// time with the chart kit (src/kit/), and every number the page shows (NUM, by element id).
// Levels: data/raw/cpi-indices.json (published combined index, 2012=100).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

const P = levels.levels["combined:general"];
const pub = bundle.dates.map((d) => [d, P[d.slice(0, 7)] ?? null]).filter(([, v]) => v != null);
const baseVal = pub[0][1];                       // Jan 2016
const reb = pub.map(([d, v]) => [d, (v / baseVal) * 100]);
const pubEnd = pub.at(-1)[1], rebEnd = reb.at(-1)[1];
const rise = (pubEnd / baseVal - 1) * 100;

export const NUM = {
  "pv-in": pubEnd.toFixed(1),
  "pf-in": bundle.meta.vintage,
  "in-def-lvl": pubEnd.toFixed(1),
  "in-def-pc": (pubEnd - 100).toFixed(1) + " per cent",
  "in-mn-pub": pubEnd.toFixed(1),
  "in-mn-reb": rebEnd.toFixed(1),
  "in-end-pub": pubEnd.toFixed(1),
  "in-end-reb": rebEnd.toFixed(1),
  "in-rise": rise.toFixed(1) + " per cent",
  "in-n-pub0": baseVal.toFixed(1),
  "in-n-reb0": "100.0",
  "in-n-pub1": pubEnd.toFixed(1),
  "in-n-reb1": rebEnd.toFixed(1),
  "in-base": baseVal.toFixed(1),
  "in-mis-pub": pubEnd.toFixed(1),
  "in-mis-reb": rebEnd.toFixed(1),
};

/** Two rulers, one decade: the published index and the same numbers rebased to Jan 2016 = 100. */
export function rulers() {
  const d0 = pub[0][0];
  return figure({
    bare: true, file: "india-atlas_learn_index-numbers_two-rulers_2016-2025",
    label: `CPI level on two bases, ${monthShort(d0)} to ${monthShort(pub.at(-1)[0])}: published (2012=100) rises from ${baseVal.toFixed(1)} to ${pubEnd.toFixed(1)}; rebased to ${monthShort(d0)}=100 the same data rises from 100.0 to ${rebEnd.toFixed(1)}; both report the same ${rise.toFixed(1)} per cent rise`,
    data: { cols: ["Month", "Published, 2012=100", `Rebased, ${monthShort(d0)}=100`], rows: pub.map(([d, v], i) => [d.slice(0, 7), v, +reb[i][1].toFixed(3)]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 280 : 400, freq: "month", zero: false, dp: 0, endDp: 1, hoverDp: 1,
      unit: { suffix: "" }, yDomain: [90, 210], yCount: 6,
      refs: [{ y: 100, label: "100: where each ruler starts" }],
      series: [
        { name: `Rebased, ${monthShort(d0)} = 100`, short: "Rebased", data: reb, role: "ctx" },
        { name: "Published, 2012 = 100", short: "Published", data: pub, role: "lead" },
      ],
      notes: width < 520
        ? [] // a phone has no room beside the start; the dotted 100 line and the end labels carry it
        : [
          { d: d0, v: baseVal, text: `${monthShort(d0)}: published\n${baseVal.toFixed(1)}`, side: "right" },
          { d: d0, v: 100, text: `rebased\n100.0`, side: "right", below: true },
        ],
    }),
  });
}
