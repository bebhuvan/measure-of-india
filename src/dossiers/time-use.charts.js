// Time use guide: every plate drawn at build time with the chart kit, from the plates of
// time-use.model.js. A plate's shape names its rows by index; this file only turns those rows into
// kit specs. The two intervals in the state chart are the one computed quantity here: estimate ±
// 1.96 × estimate × published RSE ÷ 100, labelled as an approximate range on the page.
import { K, figure, dumbbellDraw } from "./survey-plates.js";
import { timeUseFormat } from "./time-use.format.js";
import { majorShort } from "./time-use.model.js";

const C = K.C;
const SEX = { a: "Males", b: "Females" };
const FMT = {
  pct: (v) => K.num(v, { dp: 1, suffix: "%" }),
  pct_rse: (v) => K.num(v, { dp: 2, suffix: "%" }),
  minutes: (v) => K.num(v, { dp: 0 }),
};
const UNIT = { pct: { suffix: "%" }, pct_rse: { suffix: "%" }, minutes: { suffix: " min" } };
// the day's nine parts: the work the guide is about in indigo, employment in sindoor, the rest in greys
export const DAY = [
  { name: majorShort[0], color: C.comp },
  { name: majorShort[1], color: C.compTint, ink: true },
  { name: majorShort[2], color: C.lead },
  { name: majorShort[3], color: C.leadSoft },
  { name: majorShort[4], color: C.leadTint, ink: true },
  { name: majorShort[5], color: "#8E939B" },
  { name: majorShort[6], color: "#B4B8BE", ink: true },
  { name: majorShort[7], color: "#CFD2D6", ink: true },
  { name: majorShort[8], color: "#E6E7E9", ink: true },
];

const data = (p) => ({
  cols: ["cut", "value", "unit", "survey", "bundle", "series", "source_cell", "source_row", "source_column"],
  rows: p.rows.map((r) => [r.name, r.value, r.unit, p.period, r.bundle, r.series, r.cell, r.sourceRow, r.sourceColumn]),
});

export function timeUseChart(p) {
  const v = (i) => p.rows[i].value, S = p.shape;
  const fig = (draw, desc) => figure({ bare: true, file: `measure-of-india_time-use_${p.id}`, label: `${p.title}. ${desc}`, data: data(p), draw });
  const pairs = (items) => items.map((it) => ({ name: it.name, a: v(it.a), b: v(it.b) }));
  switch (p.kind) {
    case "dayBars":
      return fig((width) => K.dayBars({ width, title: p.title, parts: DAY, rows: S.rows.map((r) => ({ name: r.name, gap: r.gap, sub: r.sub, parts: r.parts.map(v) })) }),
        "Stacked bars of the 24-hour day, one per group, divided into nine kinds of activity.");
    case "rects":
      return fig((width) => K.rects({ width, keys: SEX, panels: S.panels.map((pn) => ({ name: pn.name, ...Object.fromEntries(["a", "b"].map((k) => [k, { share: v(pn[k].share), minutes: v(pn[k].minutes), per: pn[k].per != null ? v(pn[k].per) : undefined }])) })) }),
        "Rectangles whose width is the share who did the activity and whose height is the minutes among them, females and males.");
    case "dumbbell": {
      const keys = S.keys ?? SEX, u = S.unit;
      const ref = S.ref != null ? { value: v(S.ref), label: `All India ${FMT[u](v(S.ref))}` } : undefined;
      return fig(dumbbellDraw(pairs(S.items), keys, { fmt: FMT[u], unit: UNIT[u], sortBy: S.sortBy, ref, short: keys === SEX ? { a: "M", b: "F" } : { a: "Other", b: "Normal" } }),
        `Dumbbells: ${keys.b} against ${keys.a}, one row per category.`);
    }
    case "dumbbellPanels":
      return fig((width) => {
        const fit = K.panelFit(width, S.panels.length, { min: 330 });
        // panels in one unit share one scale
        const max = (pn) => S.unit ? Math.max(...S.panels.flatMap((q) => q.items.flatMap((it) => [v(it.a), v(it.b)]))) : undefined;
        const svgs = S.panels.map((pn) => { const u = pn.unit ?? S.unit; return dumbbellDraw(pairs(pn.items), SEX, { fmt: FMT[u], unit: UNIT[u], sortBy: "none", max: max(pn), short: { a: "M", b: "F" } })(fit.w); });
        return K.panels(svgs, { across: fit.across, gap: fit.gap, titles: S.panels.map((pn) => pn.title) });
      }, "Dumbbells in panels, females against males.");
    case "stackMinutes":
      return fig((width) => K.stackBars({ width, sort: false, absolute: { unit: { suffix: " min" }, dp: 0 },
        parts: [{ name: S.parts[0], color: C.comp }, { name: S.parts[1], color: C.lead }, { name: S.parts[2], color: C.leadTint }],
        rows: S.rows.map((r) => ({ name: r.name, parts: r.parts.map(v), total: v(r.total), highlight: r.name.endsWith("all ages") })) }),
        "Stacked bars of paid and unpaid minutes per person, by sex and age group, with the published total at the end.");
    case "tileMap":
      return fig((width) => K.tileMap({ width, title: p.title, unit: { suffix: "%" }, dp: 1, legendLabel: "Share of the day, females", breaks: [17, 18.5, 20, 21.5, 23],
        values: Object.fromEntries(S.tiles.map((t) => [t.iso, v(t.v)])), names: Object.fromEntries(S.tiles.map((t) => [t.iso, t.name])) }),
        "A tile map of India, one equal tile per state and union territory, shaded by the female share of the day.");
    case "intervals": {
      const rows = S.items.map((it) => { const e = v(it.v), h = 1.96 * e * v(it.rse) / 100; return { name: it.name, m: e, a: Math.round((e - h) * 10) / 10, b: Math.round((e + h) * 10) / 10 }; });
      return fig((width) => K.dumbbell({ width, rows: rows.map((r) => ({ ...r })), mid: true, sortBy: "m", keys: { a: "Approximate 95% range", b: "Estimate" }, unit: { suffix: "%" }, dp: 1, from: 10,
        ref: { value: v(S.india), label: `All India ${FMT.pct(v(S.india))}` }, nameMax: 190 }),
        "Each state's estimate with an approximate 95% range, ranked.");
    }
  }
  throw Error("time-use: no chart for plate " + p.id);
}

export function timeUseNumbers(model) {
  const N = {};
  for (const [id, f] of Object.entries(model.facts)) N["n-" + id] = timeUseFormat(f.value, f.unit);
  for (const p of model.plates) N["pv-" + p.id] = timeUseFormat(p.lead.value, p.lead.unit);
  return N;
}
