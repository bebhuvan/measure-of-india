// src/dossiers/precision.js: the site's precision rule, shared by the pages and the prose
// pipeline (pipeline/lib/precision.mjs). Growth, rates and shares are shown at the precision
// the agency publishes: one decimal unless a guide is listed as two (review-a, 2026-10).
//
// A page rounds its rate bundles ONCE, as they load (roundRates), so every figure drawn from
// them, and every delta or spread computed between them, is the arithmetic a reader can redo
// from what is on screen: 4.8% against 4.5% is 0.3 points, never the 0.4 that 4.82 and 4.45
// give. Index levels, rupees and counts pass through untouched (a y/y computed from levels
// must use the unrounded levels).
import { unitOf } from "./everycut.js";

export const RATE_UNITS = new Set(["pct", "pct_yoy", "percent", "pct_gdp", "pct_of_gdp", "pct_of_gva", "pct_per_annum"]);
export const round = (v, d = 1) => (v == null ? v : Math.round(v * 10 ** d + (v >= 0 ? 1e-9 : -1e-9)) / 10 ** d);

/** A copy of a bundle with every rate series rounded to `d` decimals. */
export function roundRates(bundle, d = 1) {
  const series = {};
  for (const [k, s] of Object.entries(bundle.series ?? {})) {
    series[k] = RATE_UNITS.has(unitOf(bundle, s)) ? { ...s, data: s.data.map((v) => round(v, d)) } : s;
  }
  return { ...bundle, series };
}

// counts in running prose (review-a, 2026-10): a sentence never opens with a numeral, and a
// zero reads "none". numWord(24, true) -> "Twenty-four"; numWord(0) -> "none".
const ONES = ["none", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
export function numWord(n, cap = false) {
  const w = n < 20 ? ONES[n] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : "") : String(n);
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}
