// Shared by the national-accounts explainers (gdp, gdp-vs-gva, investment-gfcf, consumption-pfce):
// the quarterly bundle as kit pairs at the page's own precision, and the "Q2 FY26" quarter name.
import { pairs } from "../kit/data.js";
import bundle from "../../data/series/gdp.json";
export { bundle };
/** [[date, value]] for one series, unrounded: the pages quote these at two decimals. */
export const series = (key) => pairs(bundle, key, { round: false });
/** "2025-07-01" -> "Q2 FY26" (Indian financial year, April start) */
export function fmtQ(d) {
  const m = +d.slice(5, 7), y = +d.slice(0, 4);
  const q = m === 4 ? 1 : m === 7 ? 2 : m === 10 ? 3 : 4;
  return "Q" + q + " FY" + String(q === 4 ? y : y + 1).slice(2);
}
export const trough = (P) => P.reduce((a, p) => (p[1] != null && (!a || p[1] < a[1]) ? p : a), null);
export const peak = (P) => P.reduce((a, p) => (p[1] != null && (!a || p[1] > a[1]) ? p : a), null);
export const pc = '<span class="pc">%</span>';
