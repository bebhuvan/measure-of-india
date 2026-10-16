// Shared build-time helpers for the model-driven survey guides (households, schools, digital access,
// energy, farm households): each plate's rows come from the guide's model (<slug>.model.js), the single
// source of numbers; these helpers only shape those rows into kit specs (src/kit/kit.js) and figures.
// Nothing here rounds, averages or fills a value: a label shows the published figure, a missing cell
// is left out of the drawing, never drawn as zero.
import * as K from "../kit/kit.js";
import { figure, WIDTHS } from "../kit/figure.js";

export { K, figure, WIDTHS };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Pair a plate's rows into dumbbell rows. `a` and `b` name the two cuts as they appear in the row
 * names: a suffix such as ", rural" (the row is "<item>, rural") or, with prefix:true, a prefix such
 * as "Rural, " (the row is "Rural, <item>"). Items keep the order they first appear in. Every row
 * must be used, so a cut can never be dropped silently.
 */
export function pairRows(rows, a, b, { prefix = false, name = (k) => cap(k) } = {}) {
  const key = (r, tag) => prefix ? (r.name.startsWith(tag) ? r.name.slice(tag.length) : null) : (r.name.endsWith(tag) ? r.name.slice(0, -tag.length) : null);
  const out = new Map(); let used = 0;
  for (const r of rows) {
    for (const [side, tag] of [["a", a], ["b", b]]) {
      const k = key(r, tag); if (k == null) continue;
      const o = out.get(k) ?? { name: name(k), a: null, b: null }; o[side] = r.value; out.set(k, o); used++; break;
    }
  }
  if (used !== rows.length) throw Error(`pairRows: ${rows.length - used} rows match neither "${a}" nor "${b}"`);
  return [...out.values()];
}

/** Split a plate's rows into named groups by a suffix or prefix tag, for side-by-side panels. */
export function groupRows(rows, tags, { prefix = false, name = (k) => cap(k) } = {}) {
  const groups = tags.map((t) => ({ tag: t, rows: [] })); let used = 0;
  for (const r of rows) for (const g of groups) {
    const ok = prefix ? r.name.startsWith(g.tag) : r.name.endsWith(g.tag); if (!ok) continue;
    g.rows.push({ ...r, name: name(prefix ? r.name.slice(g.tag.length) : r.name.slice(0, -g.tag.length)) }); used++; break;
  }
  if (used !== rows.length) throw Error(`groupRows: ${rows.length - used} rows match no tag`);
  return groups;
}

// ------------------------------------------------------------------ number formats (Indian)
const g = (v, dp = 0) => K.num(v, { dp });
/** Rupees for a label: ₹40,639; ₹17.4 lakh; ₹1.66 crore. */
export const inr = (v) => v == null ? "–" : Math.abs(v) >= 1e7 ? `₹${g(v / 1e7, 2)} crore` : Math.abs(v) >= 1e5 ? `₹${g(v / 1e5, 1)} lakh` : (v < 0 ? "−₹" : "₹") + K.inGroup(Math.abs(Math.round(v)));
/** A count for a label: 5,703; 3.2 lakh; 26.03 crore. */
export const count = (v) => v == null ? "–" : v >= 1e7 ? `${g(v / 1e7, 2)} crore` : v >= 1e5 ? `${g(v / 1e5, v >= 1e6 ? 1 : 2)} lakh` : K.inGroup(Math.round(v));
/** A count on a scale tick: 5 lakh, 10 crore. */
export const countTick = (v) => v >= 1e7 ? `${K.num(v / 1e7, { dp: v % 1e7 ? 1 : 0 })} crore` : v >= 1e5 ? `${K.num(v / 1e5, { dp: v % 1e5 ? 1 : 0 })} lakh` : K.inGroup(v);

/**
 * A scale for a plate's axis: values drawn in rupees, lakh or crore so the tick labels stay short.
 * Returns { k, suffix, prefix } where a drawn value is v / k.
 */
export function scaleFor(max, unit) {
  const cur = unit === "inr" ? "₹" : "";
  if (max >= 2e7) return { k: 1e7, suffix: " crore", prefix: cur };
  if (max >= 2e5) return { k: 1e5, suffix: " lakh", prefix: cur };
  return { k: 1, suffix: "", prefix: cur };
}

/** CSV data for a plate: its rows exactly as published, with unit and period. */
export const plateData = (p, extra = []) => ({
  cols: ["measure", "value", "unit", "period", ...extra.map((e) => e[0])],
  rows: p.rows.map((r) => [r.name, r.value, r.unit ?? p.unit, p.period, ...extra.map((e) => e[1](r))]),
});

// ------------------------------------------------------------------ forms
// A ranked or ordered bar chart of a plate's rows. o.fmt labels a value in the plate's unit; o.unit
// is { suffix } for the scale; o.sort false keeps the model's order (stages, land classes).
export function barsDraw(rows, o = {}) {
  return (width) => {
    const phone = width < 560, longest = Math.max(...rows.map((r) => K.tw(r.name, 13, 600)));
    return K.bars({ width, rows, sort: o.sort ?? true, fmt: o.fmt, unit: o.unit ?? {}, ref: o.ref, max: o.max, refFill: o.refFill,
      nameMax: phone ? undefined : Math.min(Math.round(width * 0.42), Math.ceil(longest) + 16), tickFmt: o.tickFmt });
  };
}

/** Two cuts per item (rural and urban, men and women): a dumbbell with every value labelled. */
export function dumbbellDraw(rows, keys, o = {}) {
  // the right-hand value label sits past the outer dot: keep room for the widest one
  const fmt = o.fmt ?? ((v) => K.num(v, { dp: 1 }));
  const room = Math.ceil(Math.max(...rows.flatMap((r) => [r.a, r.b]).filter((v) => v != null).map((v) => K.tw(fmt(v), 12, 600)))) + 14;
  const longest = Math.ceil(Math.max(...rows.map((r) => K.tw(r.name, 13, 600)))) + 14;
  // on a phone the pair's labels crowd the dots: both values go on the name line, named by their key,
  // when every row has room for it (o.short: shorter key words for that line)
  const sk = o.short ?? keys, both = (r) => [r.a != null ? `${sk.a} ${fmt(r.a)}` : null, r.b != null ? `${sk.b} ${fmt(r.b)}` : null].filter(Boolean).join(" · ");
  return (width) => {
    const phoneText = width < 560 && rows.every((r) => K.tw(r.name, 12.5) + 14 + K.tw(both(r), 12) <= width);
    return K.dumbbell({ width, rows, keys, fmt, unit: o.unit ?? {}, sortBy: o.sortBy ?? "none", labelAll: o.labelAll ?? true,
      from: o.from, ref: o.ref, refs: o.refs, aColor: o.aColor, room: phoneText ? 12 : Math.max(40, room), nameMax: Math.min(Math.round(width * 0.36), Math.max(190, longest)),
      ...(phoneText ? { endText: both } : {}) });
  };
}

/** Several bar panels on one scale (o.own: each on its own, for panels in different units): side
 *  by side when each keeps 340 px, stacked on a phone. */
export function barPanelsDraw(groups, o = {}) {
  return (width) => {
    const n = groups.length, fit = K.panelFit(width, n, { min: o.min ?? 340 });
    const max = o.own ? undefined : o.max ?? Math.max(0, ...groups.flatMap((gr) => gr.rows.map((r) => r.value)));
    const svgs = groups.map((gr) => barsDraw(gr.rows, { ...o, max, sort: o.sort ?? false })(fit.w));
    return K.panels(svgs, { across: fit.across, gap: fit.gap, titles: groups.map((gr) => gr.title) });
  };
}
