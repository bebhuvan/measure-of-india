// Pensions guide: each plate (one reviewed PFRDA record, pensions.model.js) drawn at build time with
// the chart kit. The governed CSV guard (pensionClientCSV) still runs first for every plate. The plate's
// download is the record's source periods and values (the full governed CSV, with its review and
// fingerprint columns repeated on every row, would be ten times the old page payload; it stays in
// the guide's Data and downloads). Expected schedules are dashed with hollow dots, never solid.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pensionClientCSV } from "./pensions.client-record.js";
import { parseCsv } from "../../scripts/lib/tabular.mjs";

// Reader figures in Indian scale words, as the page's prose writes them (PensionsGuide.astro say())
export const pensionSay = (v, unit) => unit === "inr_crore"
  ? (v >= 1e5 ? `₹${(v / 1e5).toFixed(2)} lakh crore` : `₹${Math.round(v).toLocaleString("en-IN")} crore`)
  : v >= 1e7 ? `${(v / 1e7).toFixed(2)} crore` : v >= 1e5 ? `${(v / 1e5).toFixed(1)} lakh` : Math.round(v).toLocaleString("en-IN");

function scale(max, unit) {
  if (unit === "inr_crore") return max >= 2e5 ? { k: 1e5, unit: { prefix: "₹", suffix: " lakh crore" } } : { k: 1, unit: { prefix: "₹", suffix: " crore" } };
  return max >= 2e7 ? { k: 1e7, unit: { suffix: " crore" } } : max >= 2e5 ? { k: 1e5, unit: { suffix: " lakh" } } : { k: 1, unit: {} };
}

export function pensionChart(p) {
  const [head, ...body] = parseCsv(pensionClientCSV(p), ","); // the governed one-record guard precedes drawing
  const at = (k) => head.indexOf(k), keep = ["date", "reference_period", "value", ...(p.observationKind === "expected-schedule" ? ["expected"] : [])];
  if (keep.some((k) => at(k) < 0)) throw Error("pensions: governed CSV lacks " + keep.filter((k) => at(k) < 0).join(", "));
  const valueCol = p.unit === "inr_crore" ? "rupees_crore" : "accounts";
  const cols = keep.map((k) => k === "value" ? valueCol : k), rows = body.map((r) => keep.map((k) => k === "value" ? (r[at(k)] === "" ? null : +r[at(k)]) : r[at(k)]));
  const pts = p.lines[0].points, a = pts.findIndex((r) => r.value != null), z = pts.findLastIndex((r) => r.value != null);
  const run = pts.slice(a, z + 1), max = Math.max(...run.filter((r) => r.value != null).map((r) => r.value));
  const S = scale(max, p.unit), expected = p.observationKind === "expected-schedule", annual = p.meta.frequency === "annual";
  const series = [{ name: expected ? "Expected" : p.title, role: "lead", data: run.map((r) => [r.date, r.value == null ? null : r.value / S.k]),
    ...(expected ? { dash: "5 4", dots: "open", est: run[0].date } : run.length <= 14 ? { dots: true } : {}) }];
  const endW = Math.max(K.tw(pensionSay(run.filter((r) => r.value != null).at(-1).value, p.unit), 13, 600), expected ? K.tw("expected", 12) : 0);
  // the unit rides on the top tick, which sits above its gridline: the gutter need only clear the
  // other tick labels, so "₹10 lakh crore" does not narrow a phone's plot by its whole width
  const vals = run.filter((r) => r.value != null).map((r) => r.value / S.k), lo = Math.min(...vals), hi = Math.max(...vals);
  const gutter = (width) => { const N = K.nice(lo > 0 && lo < (hi - lo) * 0.6 ? 0 : lo, hi, width < 520 ? 4 : 5), dp = String(+N.step.toFixed(10)).split(".")[1]?.length ?? 0;
    return Math.ceil(Math.max(...N.ticks.slice(0, -1).map((v) => K.tw(K.num(v, { dp }), 12)))) + 10; };
  const what = p.unit === "inr_crore" ? "Assets under management, rupees" : expected ? "Expected subscribers reaching retirement age" : "Accounts";
  return figure({
    bare: true, file: `india-atlas_${p.id}`, data: { cols, rows },
    label: `${p.title}. ${what}, ${annual ? "each financial year" : "end of each month"}, ${p.meta.periodLabels[run[0].date]} to ${p.meta.periodLabels[run.at(-1).date]}${expected ? "; expected values, dashed" : ""}.`,
    // the end label stays in the right margin, wide enough for the whole figure ("₹4.61 lakh crore")
    draw: (width) => K.line({ width, series, freq: annual ? "fy" : "month", unit: S.unit, hoverDp: S.k === 1 ? 0 : 2,
      endFormat: (v) => pensionSay(v * S.k, p.unit), nameOnEnd: false, inside: false, right: Math.ceil(endW) + 14, gutter: gutter(width), ...(expected ? { endSub: "expected" } : {}) }),
  });
}
