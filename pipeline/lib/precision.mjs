// pipeline/lib/precision.mjs: the site-wide precision rule for prose (review-a, 2026-10).
//
// Growth, rates and shares are written at the precision the agency publishes: one decimal
// (MoSPI's GDP growth, IIP and PLFS rates; the RBI's ratios; the World Bank and ILO shares),
// two only where the agency itself prints two and the second decimal carries meaning
// (the Office of the Economic Adviser's WPI; interest rates and yields, where a basis point
// is a real move). Counts and money in readable units: "about 2,366 crore payments", never
// "2,365.84 crore"; at most one decimal on a lakh, crore, million or billion figure, none
// once the figure reaches a thousand.
//
// Three places use it, so the rule is one rule:
//  - facts.mjs rounds every rate series to the dossier's precision BEFORE computing anything,
//    so a delta is the difference a reader computes from the published figures
//    (7.8% against 8.6% is 0.8 points, never the 0.7 the unrounded 7.82 and 8.56 give);
//  - generate.mjs tells the writer the precision;
//  - verify.mjs rejects a rate or a scaled amount written finer than the rule allows.
//
// CPI: MoSPI's press release prints CPI inflation to two decimals; the site writes it to one,
// as the RBI's policy statements do (launch brief, docs/briefs/review.md item 3). Flip it here.

import { extractFigures } from "./figures.mjs";

// units whose values are percentages: growth, rates, shares (see src/dossiers/everycut.js unitOf)
export const RATE_UNITS = new Set(["pct", "pct_yoy", "percent", "pct_gdp", "pct_of_gdp", "pct_of_gva", "pct_per_annum"]);

// decimals for rates, by dossier; anything not listed writes one
const TWO = { wpi: "the Office of the Economic Adviser prints WPI inflation to two decimals", rates: "interest rates and yields move in basis points" };
export const ratePrecision = (slug) => (TWO[slug] ? 2 : 1);

export function precisionNote(slug) {
  const p = ratePrecision(slug);
  return p === 2
    ? `Write rates, growth and shares to two decimals (${TWO[slug]}), deltas to two as well. Counts and money in readable units: at most one decimal on a lakh, crore, million or billion figure, none once it reaches a thousand.`
    : "Write every rate, growth figure and share to ONE decimal (\"7.8%\", \"rose 0.6 points\"), the precision the agency publishes; the sheet's rate series are already rounded to it. Counts and money in readable units: at most one decimal on a lakh, crore, million or billion figure, none once it reaches a thousand (\"about 2,366 crore payments\").";
}

const roundTo = (v, d) => (v == null ? v : Math.round(v * 10 ** d + (v >= 0 ? 1e-9 : -1e-9)) / 10 ** d);

/** A copy of a bundle with every rate series rounded to `d` decimals (levels untouched). */
export function roundBundle(bundle, d, unitOf) {
  const series = {};
  for (const [k, s] of Object.entries(bundle.series ?? {})) {
    series[k] = RATE_UNITS.has(unitOf(bundle, s)) ? { ...s, data: s.data.map((v) => roundTo(v, d)) } : s;
  }
  return { ...bundle, series };
}

const RATE_WORD = /^(%|per ?cent|percentage points?|pt|points?)$/i;
/** Figures written finer than the rule: [message]. A rate that would round to zero keeps one
 *  more decimal (a 0.05-point move is the point of the sentence). */
export function overPrecise(prose, slug) {
  const p = ratePrecision(slug), out = [];
  for (const f of extractFigures(prose)) {
    const dec = (f.str.split(".")[1] ?? "").length, v = Math.abs(parseFloat(f.str));
    if (f.unit && RATE_WORD.test(f.unit) && dec > p && !(roundTo(v, p) === 0 && dec <= p + 1)) {
      out.push(`over-precise figure: "${f.raw}" (rates, growth and shares on this guide are written to ${p === 1 ? "one decimal" : "two decimals"}; pipeline/lib/precision.mjs)`);
    } else if (f.scale && (dec > 1 || (dec > 0 && v >= 1000))) {
      out.push(`over-precise amount: "${f.raw}" (a ${f.scale} figure takes at most one decimal, none from a thousand up; pipeline/lib/precision.mjs)`);
    }
  }
  return out;
}
