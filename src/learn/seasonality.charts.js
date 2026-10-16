// Learn № 06 · Seasonality: the food level with every November to February shaded, drawn at build
// time with the chart kit (src/kit/), and every number the page shows (NUM, by element id).
// Levels: data/raw/cpi-indices.json (published food group index, 2012=100).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { monthShort } from "../kit/data.js";
import bundle from "../../data/series/cpi.json";
import levels from "../../data/raw/cpi-indices.json.gz";

const F = levels.levels["combined:food_and_beverages"];
const fdata = bundle.dates.map((d) => [d, F[d.slice(0, 7)] ?? null]).filter(([, v]) => v != null);

// winter windows: November y to February y+1
const winters = [];
for (let y = 2016; y <= 2024; y++) {
  const v1 = F[y + "-11"], v2 = F[y + 1 + "-02"];
  winters.push({ y, from: `${y}-11-01`, to: `${y + 1}-03-01`, v1, v2, chg: (v2 / v1 - 1) * 100 });
}
const fell = winters.filter((w) => w.chg < 0).length;
const deep = winters.reduce((a, w) => (w.chg < a.chg ? w : a));
const onion = ["2019-12-01", F["2019-12"]];
const now = fdata.at(-1);

export const NUM = {
  "pv-seas": now[1].toFixed(1),
  "pf-seas": bundle.meta.vintage,
  "se-fell": fell === winters.length ? "every one" : fell + " out of " + winters.length,
  "se-rise": ((now[1] / fdata[0][1] - 1) * 100).toFixed(1) + " per cent",
  "se-c-nov": deep.v1.toFixed(1),
  "se-c-feb": deep.v2.toFixed(1),
  "se-c-drop": Math.abs(deep.chg).toFixed(1) + " per cent",
};

/** The calendar drawn ten times: the food level, every winter window shaded, the deepest winter marked. */
export function seas() {
  const dFeb = `${deep.y + 1}-02-01`, dNov = deep.from;
  return figure({
    bare: true, file: "india-atlas_learn_seasonality_food-level_2016-2025",
    label: `Food price level with November to February shaded, ${monthShort(fdata[0][0])} to ${monthShort(now[0])}: the food index rises from ${fdata[0][1].toFixed(1)} to ${now[1].toFixed(1)}; it ends ${fell} of ${winters.length} winter windows lower than it began, most deeply in ${deep.y}-${String(deep.y + 1).slice(2)}, from ${deep.v1.toFixed(1)} to ${deep.v2.toFixed(1)}`,
    data: { cols: ["Month", "Food price level, 2012=100"], rows: fdata.map(([d, v]) => [d.slice(0, 7), v]) },
    draw: (width) => K.line({
      width, height: width < 520 ? 280 : 400, freq: "month", zero: false, dp: 0, endDp: 1, inside: false,
      unit: { suffix: "" }, yDomain: [120, 220], yCount: 5,
      shade: winters.map((w, i) => ({ from: w.from, to: w.to, label: i === 0 && width >= 520 ? "Nov–Feb" : "" })),
      series: [{ name: "Food price level", data: fdata, role: "lead" }],
      notes: [
        { d: onion[0], v: onion[1], text: `Onion spike, ${monthShort(onion[0])}\n${onion[1].toFixed(1)}`, side: "left" },
        { d: dFeb, v: deep.v2, text: `Winter ${deep.y}-${String(deep.y + 1).slice(2)}\n${deep.v1.toFixed(1)} to ${deep.v2.toFixed(1)}`, side: "left", below: true },
      ],
    }),
  });
}
