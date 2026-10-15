// src/dossiers/units.js: the unit a series is measured in. Pure, no node imports, so the
// page scripts (src/dossiers/precision.js) and the build tools share one definition.

// series.unit, then what the series name says, then the bundle's meta.unit: a bundle-level
// unit is the weakest claim (a deposits bundle in ₹ lakh crore also carries account counts)
const NAME_UNITS = [
  [/yoy_pct|_yoy(_|$)/, "pct_yoy"],
  [/_pct_of_|pct_of_nominal_gdp/, "pct"],
  [/_pct(_|$)/, "pct"],
  [/_inr_lakh_crore$/, "inr_lakh_crore"],
  [/_accounts$/, "count"],
  [/_inr$/, "inr"],
  [/_index(_|$)/, "index"],
  [/_usd_millions$/, "usd_millions"],
];
// a label that names its own unit outranks a generic "percent" (NFHS mortality rates), but never a
// specific unit the adapter set: a label carries its table's title, and a rupee column under a
// "Persons (per 1,000) ... and average expenditure" title is still rupees
const LABEL_UNITS = [[/\(per 1,?000\b/i, "per_1000"]];
const GENERIC = new Set([undefined, null, "", "percent", "pct", "rate"]);
export function unitOf(bundle, s) {
  if (GENERIC.has(s.unit == null ? s.unit : String(s.unit).toLowerCase())) for (const [re, u] of LABEL_UNITS) if (re.test(s.label || "")) return u;
  if (s.unit) return String(s.unit).toLowerCase();
  for (const [re, u] of NAME_UNITS) if (re.test(s.name || "")) return u;
  if (bundle.meta?.unit) return String(bundle.meta.unit).toLowerCase();
  return null;
}
