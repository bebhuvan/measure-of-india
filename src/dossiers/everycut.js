// src/dossiers/everycut.js: the rows of the "Every cut" table (src/components/EveryCut.astro),
// built at render time from the baked bundles. Pure node: no DOM, no client fetch.
//
// One row per series of every bundle a guide uses: the plain label, its cut (state, item,
// sector...), the latest published value with its period, the change on a year earlier
// where the bundle's frequency makes that meaningful, a sparkline path, and the bundle's CSV.
//
// Three things are declared here rather than guessed, because the bundles do not all say
// them the same way:
//   UNITS          how a unit is shown and how its change is measured (points or per cent)
//   CUT_BY_BUNDLE  what kind of cut a bundle is (bundles not listed fall back to CUT_RULES)
//   PERIOD_LABELS  periods a date cannot name (survey rounds dated by a single year)
// A series whose unit resolves to nothing in UNITS throws at build: a table that silently
// prints a bare number with no unit is the failure this file exists to stop. Family
// sessions add their units and cuts here, one contiguous block per family.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();   // builds run from the repository root (see periods.js)
const MINUS = "−";
const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ---------- units ----------
 * kind "pt": a rate or share; its change is a difference in points.
 * kind "pct": a level; its change is a per cent change.
 * kind "diff": a level whose per cent change means little (a ratio, a coefficient); the
 *   change is the plain difference, in the unit. */
const grp = (v, d = 0) => v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, s) => (v < 0 ? MINUS : v > 0 ? "+" : "") + s(Math.abs(v));
const big = (v, unit) => {   // levels in a base unit, shown at a readable scale
  const a = Math.abs(v);
  if (a >= 1e7) return grp(v / 1e7, 2) + " crore" + unit;
  if (a >= 1e5) return grp(v / 1e5, 2) + " lakh" + unit;
  return grp(v) + unit;
};
export const UNITS = {
  pct_yoy: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "year-on-year" },
  pct: { kind: "pt", fmt: (v) => v.toFixed(1) + "%" },
  percent: { kind: "pt", fmt: (v) => v.toFixed(1) + "%" },
  pct_gdp: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of GDP" },
  pct_of_gdp: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of GDP" },
  pct_of_mpce: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of spending" },
  pct_of_mva: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of manufacturing value added" },
  pct_of_exports: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of exports" },
  pct_per_annum: { kind: "pt", fmt: (v) => v.toFixed(2) + "%", note: "a year" },
  per_1000: { kind: "diff", fmt: (v) => grp(v, 1), note: "per 1,000" },
  per_100k_live_births: { kind: "diff", fmt: (v) => grp(v), note: "per 1,00,000 live births" },
  births_per_woman: { kind: "diff", fmt: (v) => v.toFixed(2), note: "births per woman" },
  gini: { kind: "diff", fmt: (v) => v.toFixed(3), note: "Gini coefficient" },
  ratio: { kind: "diff", fmt: (v) => grp(v), note: "females per 1,000 males" },
  years: { kind: "diff", fmt: (v) => v.toFixed(1) + " yrs" },
  months: { kind: "diff", fmt: (v) => v.toFixed(1) + " months" },
  index: { kind: "pct", fmt: (v) => grp(v, 1), note: "index" },
  count: { kind: "pct", fmt: (v) => big(v, "") },
  thousand: { kind: "pct", fmt: (v) => big(v * 1000, ""), note: "published in thousands" },
  hundreds: { kind: "pct", fmt: (v) => big(v * 100, ""), note: "published in hundreds" },
  inr: { kind: "pct", fmt: (v) => "₹" + grp(v) },
  inr_per_year: { kind: "pct", fmt: (v) => "₹" + big(v, ""), note: "a year" },
  inr_lakh: { kind: "pct", fmt: (v) => (Math.abs(v) >= 1e7 ? "₹" + grp(v / 1e7, 2) + " lakh crore" : "₹" + grp(v / 100) + " crore"), note: "published in ₹ lakh" },
  inr_crore: { kind: "pct", fmt: (v) => "₹" + grp(v) + " crore" },
  inr_lakh_crore: { kind: "pct", fmt: (v) => "₹" + grp(v, 2) + " lakh crore" },
  usd_millions: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + grp(Math.abs(v) / 1e3, 1) + " bn" },
  usd_constant_2015: { kind: "pct", fmt: (v) => "$" + grp(v / 1e9, 1) + " bn", note: "constant 2015 US$" },
  inr_per_usd: { kind: "pct", fmt: (v) => "₹" + v.toFixed(2), note: "per US$" },
  inr_per_eur: { kind: "pct", fmt: (v) => "₹" + v.toFixed(2), note: "per euro" },
  inr_per_gbp: { kind: "pct", fmt: (v) => "₹" + v.toFixed(2), note: "per pound" },
  inr_per_jpy: { kind: "pct", fmt: (v) => "₹" + v.toFixed(2), note: "per yen" },   // rbi-exchange-rates stores ₹ per single yen (its meta.note)
  mw: { kind: "pct", fmt: (v) => grp(v) + " MW" },
  thousand_tonne: { kind: "pct", fmt: (v) => big(v * 1000, " tonnes") },
  thousand_kwh: { kind: "pct", fmt: (v) => grp(v / 1e6, 2) + " billion kWh", note: "published in thousand kWh" },
  kg_per_month: { kind: "pct", fmt: (v) => v.toFixed(2) + " kg", note: "a month" },
  // ---- bis family session ----
  inr_bn: { kind: "pct", fmt: (v) => "₹" + grp(v / 1000, 2) + " lakh crore", note: "published in ₹ billion" },
  usd_bn: { kind: "pct", fmt: (v) => "$" + grp(v, 1) + " bn" },
  eur_bn: { kind: "pct", fmt: (v) => "€" + grp(v, 1) + " bn" },
  jpy_bn: { kind: "pct", fmt: (v) => "¥" + grp(v) + " bn" },
  pp: { kind: "diff", fmt: (v) => (v < 0 ? MINUS : v > 0 ? "+" : "") + Math.abs(v).toFixed(1) + " pt", note: "percentage points" },
  inr_per_sqft: { kind: "pct", fmt: (v) => "₹" + grp(v), note: "per sq ft" },
  // ---- end bis family ----
  // ---- services ----
  pct_of_gva: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of GVA" },
  pct_of_workers: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of workers" },
  usd_mn: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + grp(Math.abs(v) / 1e3, 1) + " bn", note: "published in US$ million" },
  usd_bn: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + grp(Math.abs(v), 1) + " bn" },
  // ---- end services ----
  // ---- jobs (PLFS) ----
  pct_of_employees: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of regular employees" },
  inr_per_month: { kind: "pct", fmt: (v) => "₹" + grp(v), note: "a month" },
  inr_per_30_days: { kind: "pct", fmt: (v) => "₹" + grp(v), note: "per 30 days" },
  // ---- end jobs ----
  // --- states (state economies: MoSPI regional accounts and every RBI Handbook of States table) ---
  inr_amount: { kind: "pct", fmt: (v) => (Math.abs(v) >= 1e12 ? "₹" + grp(v / 1e12, 2) + " lakh crore" : "₹" + grp(v / 1e7, Math.abs(v) >= 1e9 ? 0 : 2) + " crore")},
  inr_per_day: { kind: "pct", fmt: (v) => "₹" + grp(v, 1), note: "a day" },
  pct_share: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "share" },
  pct_of_gsdp: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "of GSDP" },
  multiple: { kind: "diff", fmt: (v) => v.toFixed(2) + "×" },
  mpi_index: { kind: "diff", fmt: (v) => v.toFixed(3), note: "multidimensional poverty index, 0 to 1" },
  gpi: { kind: "diff", fmt: (v) => v.toFixed(2), note: "gender parity index, 1 = parity" },
  score: { kind: "diff", fmt: (v) => grp(v), note: "score out of 100" },
  thousand_hectares: { kind: "pct", fmt: (v) => grp(v, 1) + " thousand ha" },
  thousand_bales: { kind: "pct", fmt: (v) => grp(v, 1) + " thousand bales" },
  kg_per_hectare: { kind: "pct", fmt: (v) => grp(v) + " kg per ha" },
  lakh_count: { kind: "pct", fmt: (v) => big(v * 1e5, ""), note: "published in lakh" },
  lakh_tonnes: { kind: "pct", fmt: (v) => grp(v, 2) + " lakh tonnes" },
  thousand_kg: { kind: "pct", fmt: (v) => grp(v, 1) + " thousand kg" },
  count_x1e7: { kind: "pct", fmt: (v) => grp(v / 1e7), note: "count; DBIE stores it times 10^7" },
  tonnes: { kind: "pct", fmt: (v) => big(v, " tonnes") },
  sq_km: { kind: "pct", fmt: (v) => grp(v) + " sq km" },
  mm: { kind: "pct", fmt: (v) => grp(v, 1) + " mm" },
  days: { kind: "diff", fmt: (v) => grp(v, 1) + " days" },
  bcm: { kind: "pct", fmt: (v) => grp(v, 2) + " bn cubic m" },
  kwh: { kind: "pct", fmt: (v) => grp(v, 1) + " kWh", note: "per person" },
  crore_kwh: { kind: "pct", fmt: (v) => grp(v) + " crore kWh" },
  km: { kind: "pct", fmt: (v) => grp(v) + " km" },
  per_100_people: { kind: "diff", fmt: (v) => grp(v, 1), note: "per 100 people" },
  usd: { kind: "pct", fmt: (v) => (Math.abs(v) >= 1e9 ? "$" + grp(v / 1e9, 2) + " bn" : "$" + grp(v / 1e6, 1) + " mn") },
  // worldbank (2026-10-09): WDI unit classes (scripts/lib/products/wdi-india.mjs unitClass), UN WPP, PIP
  pct_change: { kind: "pt", fmt: (v) => v.toFixed(1) + "%", note: "change" },
  usd: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + (Math.abs(v) >= 1e9 ? grp(Math.abs(v) / 1e9, 1) + " bn" : Math.abs(v) >= 1e6 ? grp(Math.abs(v) / 1e6, 1) + " mn" : grp(Math.abs(v), 2)), note: "US$" },
  lcu: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "₹" + big(Math.abs(v), ""), note: "rupees" },
  ppp_usd: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + (Math.abs(v) >= 1e9 ? grp(Math.abs(v) / 1e9, 1) + " bn" : grp(Math.abs(v), 2)), note: "PPP dollars" },
  rate: { kind: "diff", fmt: (v) => grp(v, 1), note: "rate, per the unit in its name" },
  level: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + big(Math.abs(v), "") },
  billion: { kind: "pct", fmt: (v) => v.toFixed(3) + " billion" },
  crore: { kind: "pct", fmt: (v) => grp(v, 2) + " crore" },
  per_sq_km: { kind: "pct", fmt: (v) => grp(v, 1), note: "people per sq km" },
  per_woman: { kind: "diff", fmt: (v) => v.toFixed(2), note: "per woman" },
  per_100: { kind: "diff", fmt: (v) => grp(v, 1), note: "per 100 aged 15 to 64" },
  doubling_years: { kind: "diff", fmt: (v) => grp(v, 1) + " yrs" },
  males_per_100_females: { kind: "diff", fmt: (v) => v.toFixed(1), note: "males per 100 females" },
  ppp_usd_day: { kind: "pct", fmt: (v) => "$" + v.toFixed(2), note: "a day, 2021 PPP" },
  gini_index: { kind: "diff", fmt: (v) => v.toFixed(1), note: "Gini index, 0 to 100" },
  coefficient: { kind: "diff", fmt: (v) => v.toFixed(4) },
  multiple: { kind: "diff", fmt: (v) => v.toFixed(2), note: "times" },
  inr_per_ppp_usd: { kind: "diff", fmt: (v) => "₹" + v.toFixed(2), note: "per 2021 PPP dollar" },
  million_persons: { kind: "pct", fmt: (v) => grp(v, 1) + " million" },
  inr_day: { kind: "pct", fmt: (v) => "₹" + v.toFixed(2), note: "a day" },
  // climate (lb/climate): CCKP climate indices and OWID emissions and energy
  degc: { kind: "diff", fmt: (v) => v.toFixed(2) + "°C" },   // bundles write degC; unitOf lowercases
  days: { kind: "diff", fmt: (v) => grp(v, 1) + " days", note: "days a year (or in the period)" },
  mm: { kind: "pct", fmt: (v) => grp(v, 1) + " mm" },
  mm_day: { kind: "diff", fmt: (v) => v.toFixed(2) + " mm", note: "per wet day" },
  wm2: { kind: "diff", fmt: (v) => grp(v, 1) + " W/m²" },
  ms: { kind: "diff", fmt: (v) => v.toFixed(2) + " m/s" },
  degday_c: { kind: "pct", fmt: (v) => grp(v) + " °C-days", note: "degree days" },
  degday_f: { kind: "pct", fmt: (v) => grp(v) + " °F-days", note: "degree days" },
  doy: { kind: "diff", fmt: (v) => grp(v, 1), note: "day of the year" },
  risk_ratio: { kind: "diff", fmt: (v) => v.toFixed(2), note: "risk ratio" },
  person_days: { kind: "diff", fmt: (v) => big(v, ""), note: "person-days" },
  mt: { kind: "pct", fmt: (v) => grp(v, 1) + " Mt" },
  mt_co2e: { kind: "pct", fmt: (v) => grp(v, 1) + " Mt", note: "CO₂-equivalent" },
  t_per_person: { kind: "diff", fmt: (v) => v.toFixed(2) + " t", note: "per person" },
  t_co2e_per_person: { kind: "diff", fmt: (v) => v.toFixed(2) + " t", note: "CO₂-equivalent per person" },
  intl_usd_2011: { kind: "pct", fmt: (v) => "$" + grp(v / 1e9, 1) + " bn", note: "international-$, 2011 prices" },
  kg_per_intl_usd: { kind: "diff", fmt: (v) => v.toFixed(3) + " kg", note: "per international-$" },
  g_per_kwh: { kind: "diff", fmt: (v) => grp(v) + " g", note: "per kWh" },
  g_co2e_per_kwh: { kind: "diff", fmt: (v) => grp(v) + " g", note: "CO₂-equivalent per kWh" },
  kwh_per_person: { kind: "pct", fmt: (v) => grp(v) + " kWh", note: "per person" },
  kwh_per_intl_usd: { kind: "diff", fmt: (v) => v.toFixed(2) + " kWh", note: "per international-$" },
  twh: { kind: "pct", fmt: (v) => grp(v, 1) + " TWh" },
  hectares: { kind: "pct", fmt: (v) => big(v, " ha") },
  tonnes: { kind: "pct", fmt: (v) => big(v, " tonnes") },
  per_100k: { kind: "diff", fmt: (v) => v.toFixed(1), note: "per 1,00,000 people" },
  // end climate
  // ilo (ILOSTAT)
  cases: { kind: "pct", fmt: (v) => big(v, "") , note: "cases" },
  days: { kind: "pct", fmt: (v) => big(v, " days") },
  hours: { kind: "diff", fmt: (v) => v.toFixed(1) + " h", note: "a week" },
  hours_thousand: { kind: "pct", fmt: (v) => grp(v / 1e6, 2) + " billion h", note: "a week, published in thousand hours" },
  usd_2015: { kind: "pct", fmt: (v) => "$" + grp(v), note: "constant 2015 US$" },
  usd_ppp_2021: { kind: "pct", fmt: (v) => "$" + grp(v), note: "constant 2021 PPP dollars" },
  usd_ppp_2021_million: { kind: "pct", fmt: (v) => "$" + grp(v / 1e6, 2) + " trillion", note: "constant 2021 PPP dollars" },
  per_100k_workers: { kind: "diff", fmt: (v) => grp(v, 1), note: "per 1,00,000 workers" },
  dependency_ratio: { kind: "diff", fmt: (v) => v.toFixed(2), note: "people per worker" },
  score: { kind: "diff", fmt: (v) => grp(v, 1), note: "ILO score" },
  // --- rates (atlas-rates) ---
  pct_points: { kind: "diff", fmt: (v) => (v < 0 ? MINUS : "") + Math.abs(v).toFixed(2) + " pt", note: "percentage points" },
  bps: { kind: "diff", fmt: (v) => (v < 0 ? MINUS : v > 0 ? "+" : "") + Math.abs(v) + " bp", note: "basis points" },
  days: { kind: "diff", fmt: (v) => grp(v) + " days" },
  times: { kind: "diff", fmt: (v) => v.toFixed(2) + "×", note: "bids per rupee offered" },
  vote: { kind: "diff", fmt: (v) => (v === 1 ? "with" : v === 0 ? "against" : String(v)), note: "1 = voted with the decision, 0 = against" },
  inr_per_100: { kind: "diff", fmt: (v) => "₹" + v.toFixed(4), note: "per ₹100 of face value" },
  // ---- external (lb/external): RBI DBIE external-sector units ----
  usd_million: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + grp(Math.abs(v) / 1e3, 1) + " bn", note: "published in US$ million" },
  sdr_million: { kind: "pct", fmt: (v) => "SDR " + grp(v / 1e3, 1) + " bn", note: "published in SDR million" },
  inr_per_unit: { kind: "pct", fmt: (v) => "₹" + (Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(3)), note: "per unit of the currency named" },
  paise: { kind: "diff", fmt: (v) => v.toFixed(1) + " paise", note: "per US$" },
  tonnes: { kind: "pct", fmt: (v) => grp(v, 1) + " tonnes" },
  // ---- end external ----
  // credit (lb/credit)
  lakh_count: { kind: "pct", fmt: (v) => grp(v, 1) + " lakh" },
  times: { kind: "diff", fmt: (v) => v.toFixed(2) + "×", note: "times" },
  // --- trade (lb/trade) ---
  usd_million: { kind: "pct", fmt: (v) => (v < 0 ? MINUS : "") + "$" + grp(Math.abs(v) / 1e3, 2) + " bn" },
  million_tonnes: { kind: "pct", fmt: (v) => grp(v, 1) + " million tonnes" },
  // quantities, in the unit DGCI&S prints beside each line (never added across lines)
  ...Object.fromEntries([["kgs", "kg"], ["kg", "kg"], ["ton", "tonnes"], ["mts", "MTS"], ["nos", "pieces"], ["sqm", "sq m"], ["prs", "pairs"], ["cbm", "cu m"],
    ["ltr", "litres"], ["mtr", "metres"], ["cum", "CUM"], ["thn", "THN"], ["ctm", "CTM"], ["crt", "CRT"], ["thd", "THD"], ["tkw", "TKW"], ["gif", "GIF"], ["c_k", "C/K"], ["none", "no unit printed"]]
    .map(([k, w]) => [`qty_${k}`, { kind: "pct", fmt: (v) => grp(v) + (k === "none" ? "" : " " + w), note: k === "none" ? "quantity, no unit printed" : `quantity, unit as printed (${k.toUpperCase().replace("_", "/")})` }])),
  // --- end trade ---
  // --- health-gender (nfhs, gender) ---
  per_1000_women: { kind: "diff", fmt: (v) => grp(v, 1), note: "per 1,000 women" },
  per_lakh_women: { kind: "diff", fmt: (v) => grp(v, 1), note: "per 1,00,000 women" },
  per_100_males: { kind: "diff", fmt: (v) => grp(v), note: "women per 100 men" },
  minutes: { kind: "diff", fmt: (v) => grp(v) + " min", note: "a day" },
  unstated: { kind: "pct", fmt: (v) => grp(v, 1), note: "the source does not state the unit" },
  // --- end health-gender ---
  // --- nas (gdp guide, wave 2) ---
  ...Object.fromEntries(["gdp", "gdp-2022"].flatMap((b) => Object.entries({ "annual-levels": "Indicator", "annual-growth": "Indicator", "annual-shares": "Component of GDP", "annual-industries": "Industry", "annual-subindustries": "Sub-industry", "annual-gcf-industries": "Industry of use", "sectors": "Institutional sector", "revisions": "Estimate stage", "quarterly-levels": "Indicator", "quarterly-shares": "Component of GDP", "quarterly-industry-levels": "Industry" }).map(([k, c]) => [`${b}-${k}`, c]))),
  "gdp-back-levels": "Indicator", "gdp-back-growth": "Indicator", "gdp-back-shares": "Component of GDP", "gdp-back-industries": "Industry", "gdp-back-subindustries": "Sub-industry",
  // --- end nas ---
};

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
// a label that names its own unit outranks a bundle-wide "percent" (NFHS mortality rates)
const LABEL_UNITS = [[/\(per 1,?000\b/i, "per_1000"]];
export function unitOf(bundle, s) {
  for (const [re, u] of LABEL_UNITS) if (re.test(s.label || "")) return u;
  if (s.unit) return String(s.unit).toLowerCase();
  for (const [re, u] of NAME_UNITS) if (re.test(s.name || "")) return u;
  if (bundle.meta?.unit) return String(bundle.meta.unit).toLowerCase();
  return null;
}

/* ---------- cuts ---------- */
// what kind of cut each bundle is; the first matching rule wins, CUT_BY_BUNDLE first
export const CUT_BY_BUNDLE = {
  // ---- bis family session ----
  "bis-credit": "Borrower", "bis-credit-inr": "Borrower", "bis-credit-usd": "Borrower", "bis-credit-gap": "Measure",
  "bis-dsr": "All India", "bis-property": "All India", "bis-property-cities": "City", "bis-property-10cities": "All India",
  "bis-gli": "Currency", "bis-eer": "Measure", "bis-eer-daily": "Measure", "bis-policy-rate": "All India",
  "bis-policy-rate-daily": "All India", "bis-xru-monthly": "Measure", "bis-xru-quarterly": "Measure", "bis-xru-annual": "Measure",
  "bis-cpi-long": "All India", "bis-cpi-long-annual": "All India",
  "bis-peer-usa": "United States", "bis-peer-chn": "China", "bis-peer-emu": "Euro area", "bis-peer-gbr": "United Kingdom",
  "bis-peer-jpn": "Japan", "bis-peer-kor": "Korea", "bis-peer-idn": "Indonesia", "bis-peer-bra": "Brazil",
  "bis-peer-zaf": "South Africa", "bis-peer-mex": "Mexico", "bis-peer-tur": "Türkiye", "bis-peer-aus": "Australia", "bis-peer-can": "Canada",
  "housing-rbi-2009": "City", "housing-rbi-2010": "City", "housing-rbi-2010-yoy": "City", "housing-rbi-2022": "City", "housing-rbi-2022-yoy": "City",
  "housing-residex-2013": "City", "housing-residex-2018": "City", "housing-residex-2025": "City",
  "housing-residex-prices-2013": "City and home size", "housing-residex-prices-2018": "City and home size", "housing-residex-prices-2025": "City and home size",
  // ---- end bis family ----
  // cpi
  "cpi": "All India", "cpi-rural": "Rural", "cpi-urban": "Urban", "cpi-subgroups": "Sub-group",
  "cpi-2024": "Division", "cpi-2024-back": "All India", "cpi-2024-linked": "All India",
  "cpialrl-1986": "All India", "cpialrl-2019": "All India", "cpialrl-groups-2019": "Group",
  // gdp
  "gdp": "All India", "gdp-2022": "All India", "gdp-nominal": "All India", "gdp-2022-nominal": "All India",
  "gdp-expenditure": "Expenditure", "gdp-2022-expenditure": "Expenditure",
  "gdp-accounts": "Account", "gdp-2022-accounts": "Account", "gdp-back": "All India",
  // wpi
  "wpi": "Major group", "wpi-2022": "Major group",
  // iip
  "iip-2022": "Sector and use", "iip-2011": "Sector and use", "iip-2004": "Sector and use", "iip-1993": "Sector and use",
  "isp": "Services sub-sector",
  // external
  "rbi-trade": "All India", "rbi-trade-oil": "Oil and non-oil", "rbi-forex": "All India", "rbi-bop": "Account",
  "rbi-bop-ratios": "Ratio", "rbi-debt": "Component", "rbi-debt-quarterly": "Component", "rbi-nri": "Deposit scheme",
  "rbi-invisibles": "Component", "rbi-exchange-rates": "Currency", "rbi-intervention": "Component",
  "rbi-forward-premia": "Tenor", "rbi-fx-turnover": "Market segment",
  // jobs
  "plfs-monthly": "All India", "plfs-quarterly": "Urban", "plfs-annual": "All India", "plfs-cuts": "Gender and sector",
  "plfs-status": "Employment status", "plfs-earnings": "Employment type and gender", "plfs-education": "Education",
  "plfs-monthly-age": "Age, gender and sector", "plfs-quarterly-cuts": "Gender and age, urban", "plfs-q25": "Gender, sector and age",
  "plfs-ay-india": "Gender, sector, age, education, religion, social group", "plfs-cy-india": "Gender, sector, age, education, religion, social group",
  "plfs-cy25-india": "Gender, sector, age, education, religion, social group",
  ...Object.fromEntries(["ay", "cy", "cy25", "quarterly", "q25"].flatMap((t) => ["lfpr", "wpr", "ur"].map((i) => [`plfs-${t}-states-${i}`, "State, gender, sector, age, education"]))),
  "plfs-quarterly-industry": "State, industry, gender", "plfs-q25-industry": "State, industry, gender and sector",
  "plfs-ay-workers-states": "State, kind of work, gender and sector", "plfs-cy-workers-states": "State, kind of work, gender and sector",
  "plfs-cy25-workers-states": "State, kind of work, gender and sector", "plfs-conditions": "State, condition, gender and sector",
  "plfs-earnings-cuts": "State, kind of work, gender and sector", "plfs-cy-earnings": "State, kind of work, gender and sector",
  "plfs-cy25-earnings": "State, kind of work, gender and sector",
  // consumption
  "hces-mpce": "Rural or urban", "hces-gini": "Rural or urban", "hces-fractiles": "Spending class",
  "hces-categories": "Spending category", "hces-categories-states": "State and category", "hces-social": "Social group",
  "hces-household-type": "Household type", "hces-quantities": "Item", "hces-item-values": "Item",
  // factories
  "asi-headline": "All India", "asi-headline-1987": "All India", "asi-headline-1998": "All India",
  "asi-headline-2004": "All India", "asi-accounts": "Account", "asuse-annual": "Enterprise type",
  "asuse-quarterly": "Activity", "asuse-sectors": "Activity", "asuse-owners": "Owner",
  "asuse-modernity": "Practice", "asuse-structure": "Structure",
  // aishe
  "aishe-headline": "All India", "aishe-access": "Social group and gender", "aishe-composition": "Level",
  "aishe-teachers": "Post and gender", "aishe-minority": "Community and gender",
  // health-gender: every NFHS and gender-compendium bundle names its own cut (meta.cut)
  ...healthGenderMeta("cut"),
  // mnre
  "mnre-sources": "Energy source", "mnre-solar-categories": "Solar category",
  // manufacturing
  "wdi-manufacturing": "All India", "wdi-manufacturing-composition": "Industry", "wdi-manufacturing-tech": "Technology",
  "wdi-manufacturing-exports": "All India",
  // deposits
  "deposits-owners": "Owner and account", "deposits-owners-2005": "Owner and account", "deposits-population": "Population group",
  "deposits-term-rates": "Interest rate band", "deposits-term-maturity": "Maturity", "deposits-term-size": "Deposit size",
  "deposits-term-size-2026": "Deposit size",
  // services
  "services-gva-2022-share": "Industry", "services-gva-2022-growth": "Industry", "services-gva-2022-level": "Industry",
  "services-gva-2011-share": "Industry", "services-gva-2011-growth": "Industry", "services-gva-2011-level": "Industry",
  "services-isp-growth": "Sub-sector", "services-isp-annual": "Sub-sector", "services-trade-monthly": "Flow",
  "services-bop-quarterly": "Category and flow", "services-invisibles-quarterly": "Purpose code", "services-bop-annual": "Category and flow",
  "services-jobs-ay": "Industry, status, sex and place", "services-jobs-cy": "Industry, status, sex and place",
  "services-asuse": "Activity, sex and place", "services-asuse-profile": "Activity and profile", "services-asuse-2025": "Activity, sex and place", "services-asuse-profile-2025": "Activity and profile",
  // --- states (state economies) ---
  "states-spread": "Fixed panel of states", "states-structure": "State and sector", "states-industry-shares": "State and industry",
  "states-gsva-current": "State and industry", "states-gsva-constant": "State and industry", "states-nsva-current": "State and industry",
  "states-nsva-constant": "State and industry", "states-taxes-current": "State", "states-taxes-constant": "State",
  "states-growth-real": "State", "states-growth-nominal": "State", "states-finances": "State",
  // worldbank (2026-10-09)
  "population-wpp": "Indicator, estimate", "population-wpp-projection": "Indicator, projection",
  "population-wpp-variants": "Indicator and variant", "population-wpp-age": "Age and sex", "population-wpp-age-projection": "Age and sex, projection",
  "population-wdi": "Age and sex", "population-wdi-vital": "Indicator", "population-wdi-urban": "Urban or rural", "population-wdi-migration": "Indicator",
  "poverty-pip-1977": "Measure and line", "poverty-pip-1983": "Measure and line", "poverty-pip-1987": "Measure and line",
  "poverty-pip-1993": "Measure and line", "poverty-pip-2011": "Measure and line", "poverty-pip-2022": "Measure and line",
  "poverty-pip-lineup": "Line", "poverty-wdi": "Measure",
  // climate (lb/climate); state bundles fall to the "-states" rule
  ...Object.fromEntries([
    ...["co2", "energy"].flatMap((d) => [[`climate-${d}-chn`, "China"], [`climate-${d}-usa`, "United States"], [`climate-${d}-world`, "World"]]),
    ...["temp", "hotdays", "heatstress", "rain", "energy"].flatMap((t) => [
      [`climate-seasons-era5-${t}`, "Season"], [`climate-cmip6-${t}`, "Scenario and model spread"],
      [`climate-cmip6-${t}-hist`, "Model historical runs"], [`climate-cmip6-windows-${t}`, "Scenario, 20-year window"],
      [`climate-cmip6-states-${t}`, "State and scenario, 20-year window"]]),
    ["climate-seasons-cru", "Season"], ["climate-burned-area", "Land type"], ["climate-warming-contrib", "Gas and source"],
    ["climate-opinion-youth", "Survey question"], ["climate-heat-deaths", "Projection year"],
  ]),
  // --- rates (atlas-rates) ---
  "rates-monthly": "Policy rate", "rates-policy": "Policy rate", "rates-mpc": "Decision", "rates-mpc-votes": "Member",
  "rates-lending": "Rate and bank group", "rates-mclr": "Bank group", "rates-mclr-banks": "Bank", "rates-walr-sectors": "Loan purpose",
  "rates-walr-occupation": "Borrower occupation", "rates-benchmarks": "Benchmark and bank group", "rates-wss": "Rate",
  "rates-real": "Rate", "rates-real-cpi2012": "Rate", "rates-call-daily": "Measure", "rates-call-daily-detail": "Measure",
  "rates-call-monthly": "Measure", "rates-money-market": "Market segment", "rates-mibor": "Tenor", "rates-liquidity": "Operation",
  "rates-laf": "Operation", "rates-omo": "Operation", "rates-market-repo": "Security", "rates-cd": "Measure", "rates-cp": "Measure",
  "rates-tbill-91": "Auction measure", "rates-tbill-182": "Auction measure", "rates-tbill-364": "Auction measure",
  "rates-tbill-cmb": "Auction measure", "rates-tbill-14": "Auction measure", "rates-tbill-sgl": "Residual maturity",
  "rates-gsec-curve": "Years to maturity", "rates-gsec-annual": "Government", "rates-gsec-auctions": "Auction measure",
  "rates-gsec-auctions-fy": "Auction measure", "rates-sdl-states": "State", "rates-borrowing": "Government",
  "rates-borrowing-weekly": "Government", "rates-state-borrowing": "State", "rates-state-borrowing-monthly": "State",
  "rates-structure": "Rate", "rates-walr-1992": "Loan type", "rates-walr-groups-2005": "Occupation and bank group",
  // credit (lb/credit)
  "credit-growth": "Sector", "credit-sectors": "Sector", "credit-sectors-ex-merger": "Sector", "credit-sectors-2007": "Sector", "credit-industry": "Industry", "credit-industry-2007": "Industry",
  "credit-scb": "Balance sheet item", "credit-scb-ratios": "All India", "credit-food": "All India",
  "credit-money": "Component and source", "credit-money-growth": "Component", "credit-money-monthly": "Component and source", "credit-money-annual": "Component and source",
  "credit-money-ratios": "Ratio", "credit-reserve-money": "Component and source", "credit-reserve-money-weekly": "Component and source", "credit-bank-survey": "Component and source",
  "credit-rbi-balance-sheet": "Asset or liability", "credit-depth": "Ratio",
  "credit-npa": "Bank group", "credit-npa-amounts": "Bank group", "credit-npa-movement": "Bank group and flow", "credit-npa-banks": "Bank", "credit-loan-quality": "Asset class",
  "credit-crar": "Bank group and capital band", "credit-frauds": "Banking operation", "credit-frauds-half-year": "Banking operation",
  "credit-states": "State", "credit-states-cd": "State", "credit-offices": "State", "credit-places": "Population and bank group",
  "credit-states-2017": "State", "credit-states-cd-2017": "State", "credit-offices-2017": "State", "credit-places-2017": "Population and bank group",
  "credit-states-2004": "State", "credit-states-cd-2004": "State", "credit-offices-2004": "State", "credit-places-2004": "Population and bank group",
  "credit-states-annual": "State", "credit-states-cd-annual": "State", "credit-offices-annual": "State", "credit-places-annual": "Population and bank group",
  "credit-utilisation": "State", "credit-women": "State", "credit-occupation": "Occupation", "credit-organisation": "Borrower",
  "credit-size": "Loan size", "credit-interest-rates": "Interest rate band", "credit-lending-rates": "Occupation", "credit-population-group": "Population group",
  "credit-bank-groups": "Bank group", "credit-account-type": "Type of account", "credit-states-bsr1": "State", "credit-states-occupation": "State and occupation",
  "credit-nbfc": "Sector",
  // credit deep tables (credit-deep.mjs)
  "credit-deep-cash-balances": "All India", "credit-deep-standing-facilities": "Facility", "credit-deep-liquidity-aggregates": "Component",
  "credit-deep-monetary-survey": "Component and source", "credit-deep-rbi-survey": "Component and source", "credit-deep-flow-of-resources": "Source of funds",
  "credit-deep-credit-to-commercial-sector": "Source of funds", "credit-deep-money-components-annual": "Component", "credit-deep-money-sources-annual": "Source",
  "credit-deep-average-money": "Aggregate", "credit-deep-reserve-money-annual": "Component and source", "credit-deep-rbi-accounts-annual": "Asset or liability",
  "credit-deep-money-growth-annual": "Aggregate", "credit-deep-monetary-ratios": "Ratio", "credit-deep-sectoral-annual-old": "Sector",
  "credit-deep-sectoral-annual": "Sector", "credit-deep-sectoral-annual-long": "Sector", "credit-deep-industry-annual-long": "Industry",
  "credit-deep-industry-annual": "Industry", "credit-deep-savings-deposits": "Bank group", "credit-deep-rrb-indicators": "Indicator",
  "credit-deep-credit-population-annual": "Population group", "credit-deep-deposits-population-annual": "Population group", "credit-deep-branches-population": "Population group",
  "credit-deep-bank-balance-sheet": "Balance sheet item", "credit-deep-cooperative-npa": "Co-operative tier", "credit-deep-bank-employees": "Bank group",
  "credit-deep-shg": "Indicator", "credit-deep-pacs": "Lender and measure", "credit-deep-state-cooperative-banks": "Balance sheet item",
  "credit-deep-term-deposit-maturity": "Original maturity", "credit-deep-agri-institutional": "Lender", "credit-deep-agri-short-term": "Lender",
  "credit-deep-agri-long-term": "Lender", "credit-deep-agri-indirect": "Lender", "credit-deep-agri-scb": "Kind of advance",
  "credit-deep-farmers-landholding-short": "Size of land holding", "credit-deep-farmers-landholding-long": "Size of land holding", "credit-deep-small-industries": "Indicator",
  "credit-deep-sick-units": "Indicator", "credit-deep-food-procurement": "Bank group", "credit-deep-exporters": "Bank group",
  "credit-deep-notes-coins": "Denomination", "credit-deep-nbfc-deposits": "Non-banking finance companies", "credit-deep-nbfc-financials": "Balance sheet item",
  "credit-deep-nbfc-sectors-2016": "Sector", "credit-deep-bsr1-pop-bankgroup": "Population group and bank group", "credit-deep-bsr1-state-pop": "State and population group",
  "credit-deep-bsr1-state-bankgroup": "State and bank group", "credit-deep-bsr1-bankgroup-size": "Bank group and size of credit limit", "credit-deep-bsr1-size-rate": "Size of credit limit and interest rate band",
  "credit-deep-bsr1-account-rate": "Type of account and interest rate band", "credit-deep-bsr1-bankgroup-rate": "Bank group and interest rate band", "credit-deep-bsr1-account-occupation": "Type of account and occupation",
  "credit-deep-bsr1-organisation-occupation": "Kind of borrower and occupation", "credit-deep-bsr1-rate-occupation": "Interest rate band and occupation", "credit-deep-bsr1-size-occupation": "Size of credit limit and occupation",
  "credit-deep-bsr1-size-rate-2014": "Size of credit limit and interest rate band", "credit-deep-bsr1-bankgroup-rate-2017": "Bank group and interest rate band", "credit-deep-bsr1-rate-occupation-2014": "Interest rate band and occupation",
  "credit-deep-bsr1-account-rate-2014": "Type of account and interest rate band", "credit-deep-bsr1-pop-bankgroup-2014": "Population group and the bank groups", "credit-deep-bsr1-bankgroup-size-2014": "Bank groups and size of credit limit",
  "credit-deep-bsr1-bankgroup-rate-2014": "Bank groups and interest rate band", "credit-deep-bsr1-state-bankgroup-2014": "State and the bank groups", "credit-deep-bsr1-pop-occupation": "Population group and occupation",
  "credit-deep-bsr1-pop-occupation-small": "Population group and occupation", "credit-deep-bsr1-state-occupation-small": "State and occupation", "credit-deep-bsr1-bankgroup-occupation": "Bank group and occupation",
  "credit-deep-bsr1-rate-2014": "Interest rate band", "credit-deep-bsr1-bankgroup-2014": "Bank groups", "credit-deep-asset-classification": "Bank group",
  "credit-deep-npa-by-sector": "Sector", "credit-deep-crar-banks": "Bank", "credit-deep-bank-ratios": "Bank and ratio",
  "credit-deep-scheduled-banks": "Balance sheet item", "credit-deep-rbi-weekly-statement": "Asset or liability", "credit-deep-rbi-liabilities-assets": "Asset or liability",
  "credit-deep-money-stock-fortnightly": "Component and source", "credit-deep-spatial-glance": "Bank group and population group", "credit-deep-spatial-centres": "State and population group",
  "credit-deep-spatial-deposit-types": "State, bank group and population group", "credit-deep-spatial-office-size": "Size class", "credit-deep-spatial-glance-2017": "Bank group and population group",
  "credit-deep-spatial-centres-2017": "State and population group", "credit-deep-spatial-deposit-types-2017": "State, bank group and population group", "credit-deep-spatial-office-size-2017": "Size class",
  "credit-deep-spatial-glance-2004": "Bank group and population group", "credit-deep-spatial-centres-2004": "State and population group", "credit-deep-spatial-deposit-types-2004": "State, bank group and population group",
  "credit-deep-spatial-office-size-2004": "Size class", "credit-deep-spatial-glance-annual": "Bank group and population group", "credit-deep-spatial-centres-annual": "State and population group",
  "credit-deep-spatial-deposit-types-annual": "State, bank group and population group", "credit-deep-spatial-office-size-annual": "Size class", "credit-deep-bsr1a-occupation": "Occupation",
  "credit-deep-bsr1a-size": "Size of credit limit", "credit-deep-bsr1a-account-type": "Type of account", "credit-deep-bsr1a-pop-occupation-small": "Population group and occupation",
  "credit-deep-bsr1a-pop-occupation": "Population group and occupation", "credit-deep-bsr1a-occupation-account": "Occupation and type of account", "credit-deep-bsr1a-occupation-account-small": "Occupation and type of account",
  "credit-deep-bsr1a-occupation-organisation": "Occupation and kind of borrower", "credit-deep-bsr1a-occupation-organisation-small": "Occupation and kind of borrower", "credit-deep-bsr1a-account-organisation": "Type of account and kind of borrower",
  "credit-deep-bsr1a-account-organisation-small": "Type of account and kind of borrower", "credit-deep-bsr1a-size-organisation": "Size of credit limit and kind of borrower", "credit-deep-bsr1a-size-account": "Size of credit limit and type of account",
  "credit-deep-bsr1a-small-borrowers": "Population group and broad category of borrower", "credit-deep-bsr1a-occupation-size": "Occupation and size of credit limit", "credit-deep-bsr1a-rate-organisation": "Interest rate band and kind of borrower",
  "credit-deep-bsr1a-size-rate": "Size of credit limit and interest rate band", "credit-deep-bsr1a-rate-organisation-small": "Interest rate band and kind of borrower", "credit-deep-bsr1a-rate-account": "Interest rate band and type of account",
  "credit-deep-bsr1a-rate-account-small": "Interest rate band and type of account", "credit-deep-bsr1a-occupation-rate": "Occupation and interest rate band", "credit-deep-bsr1a-occupation-rate-small": "Occupation and interest rate band",
  "credit-deep-bsr1a-rate-size-account": "Rate band, size and type of account", "credit-deep-bsr1a-bank-groups": "Bank group", "credit-deep-bsr1a-pop-sanction-use": "Population group",
  "credit-deep-bsr1a-pop-sanction-use-ex-food": "Population group", "credit-deep-bsr1a-state-pop-sanction-use": "State and population group", "credit-deep-bsr1a-pop-occupation-share": "Population group and occupation",
  "credit-deep-bsr1a-organisation": "Kind of borrower", "credit-deep-bsr1a-size-bankgroup": "Size of credit limit and bank group", "credit-deep-bsr1a-bankgroup-pop-size": "Bank group, population group and size",
  "credit-deep-bsr1a-state-pop": "State and population group", "credit-deep-bsr1a-state-bankgroup": "State and bank group", "credit-deep-bsr1a-pop-bankgroup-small": "Population group and bank group",
  "credit-deep-bsr1a-state-bankgroup-size": "Bank group, state and size", "credit-deep-bsr1a-state-pop-small": "State and population group", "credit-deep-bsr1a-districts": "District and population group",
  "credit-deep-bsr1a-pop-occupation-bankgroup": "Population group, occupation and bank group", "credit-deep-bsr1a-state-occupation-pop-small": "State, occupation and population group", "credit-deep-bsr1a-district-gender": "District and gender",
  "credit-deep-tp-international-liabilities": "Type of instrument", "credit-deep-tp-international-assets": "Type of instrument", "credit-deep-tp-international-claims": "Residual maturity and sector",
  "credit-deep-tp-claims-by-country": "Country", "credit-deep-tp-off-balance-sheet": "Bank group and exposure", "credit-deep-tp-sensitive-sectors": "Bank group and sector",
  "credit-deep-tp-overseas-operations": "Bank", "credit-deep-tp-shareholding": "Bank and shareholder", "credit-deep-tp-banking-glance": "Indicator",
  "credit-deep-tp-branches-atms": "Bank and population group", "credit-deep-tp-microfinance": "Programme", "credit-deep-tp-rrb-states": "State",
  "credit-deep-tp-rrb-psl": "Target", "credit-deep-tp-ucb-performance": "Bank", "credit-deep-tp-ucb-parameters": "Bank",
  "credit-deep-tp-dccb-health": "State", "credit-deep-tp-pacs-members": "Social group", "credit-deep-tp-pacs": "Balance sheet item",
  "credit-deep-tp-scb-coop-health": "State", "credit-deep-tp-pacs-states": "State", "credit-deep-tp-scardb-balance-sheet": "Balance sheet item",
  "credit-deep-tp-scardb-performance": "Income and expenditure", "credit-deep-tp-scardb-asset-quality": "Indicator", "credit-deep-tp-pcardb-performance": "Income and expenditure",
  "credit-deep-tp-pcardb-asset-quality": "Indicator", "credit-deep-tp-nbfc-balance-sheet": "Balance sheet item", "credit-deep-tp-nbfc-d-balance-sheet": "Balance sheet item",
  "credit-deep-tp-pcardb-balance-sheet": "Balance sheet item", "credit-deep-tp-kcc-states": "State and lender", "credit-deep-tp-kcc": "Lender",
  "credit-deep-tp-scardb-regions": "Region", "credit-deep-tp-pcardb-regions": "Region", "credit-deep-tp-nbfc-ul-balance-sheet": "Balance sheet item",
  "credit-deep-tp-nbfc-ml-balance-sheet": "Balance sheet item", "credit-deep-tp-nbfc-credit": "Sector", "credit-deep-tp-nbfc-ul-performance": "Income and expenditure",
  "credit-deep-tp-nbfc-ml-performance": "Income and expenditure", "credit-deep-tp-fi-assistance": "Institution", "credit-deep-tp-primary-dealers": "Dealer",
  "credit-deep-tp-primary-dealer-indicators": "Dealer", "credit-deep-reserve-money-weekly": "Component and source", "credit-deep-commercial-bank-survey": "Component and source",
  "credit-deep-scheduled-banks-annual": "Bank group", "credit-deep-bank-group-business": "Bank group", "credit-deep-derivatives": "Bank group and instrument",
  "credit-deep-state-investments": "State", "credit-deep-state-coop-banks-states": "State", "credit-deep-dccb-states": "State",
  "credit-deep-banks-abroad": "Asset or liability", "credit-deep-insured-deposits": "Bank group", "credit-deep-unclaimed-deposits": "Bank",
  "credit-deep-coop-balance-sheets": "Tier", "credit-deep-scb-annual-aggregates": "Balance sheet item", "credit-deep-money-stock-wss": "Item",
  "credit-deep-money-stock-measures": "Item", "credit-deep-money-stock-measures-annual": "Item", "credit-deep-money-sources-bulletin": "Item",
  "credit-deep-money-components-handbook": "Item", "credit-deep-money-components-handbook-annual": "Item", "credit-deep-money-sources-handbook": "Item",
  "credit-deep-monetary-survey-monthly": "Item", "credit-deep-industry-monthly-2007": "Industry", "credit-deep-industry-monthly": "Industry",
  "credit-deep-scb-section42-full": "Item", "credit-deep-select-aggregates": "Item", "credit-deep-select-aggregates-handbook": "Item",
  "credit-deep-scb-resources": "Item", "credit-deep-state-coop-banks-monthly": "Item", "credit-deep-reserve-money-monthly": "Item",
  "credit-deep-walr-bank-groups": "Bank group and by occupation", "credit-deep-offices-banks": "Population group", "credit-deep-offices-states": "State",
  "credit-deep-offices-bank-groups": "Bank group", "credit-deep-coop-offices-districts": "District and population group", "credit-deep-coop-branches-states": "State",
  "credit-deep-offices-abroad": "Country", "credit-deep-offices-abroad-banks": "Bank and country by country", "credit-deep-cheque-clearances": "Type of clearing centre",
  "credit-deep-clearing-houses": "Bank that manages them", "credit-deep-scb-investments-old": "Kind of security", "credit-deep-scb-investments-offices": "Offices in India and abroad",
  "credit-deep-scb-growth-annual": "Item", "credit-deep-priority-sector-banks": "Sector", "credit-deep-priority-sector-states": "State and sector",
  "credit-deep-bank-group-ratios": "Bank group", "credit-deep-employees-banks": "Category", "credit-deep-restructured-loans": "Bank",
  "credit-deep-contingent-liabilities": "Item", "credit-deep-sensitive-sectors-banks": "Item", "credit-deep-bank-earnings": "Item",
  "credit-deep-bank-provisions": "Item", "credit-deep-bank-profit-appropriation": "Item", "credit-deep-abridged-balance-sheets": "Item",
  "credit-npa-movement-banks": "Bank", "credit-loan-quality-banks": "Bank and asset class", "credit-women-districts": "District",
  "credit-places-states": "State, bank group and population group", "credit-places-states-2017": "State, bank group and population group", "credit-places-states-2004": "State, bank group and population group",
  "credit-places-states-annual": "State, bank group and population group",
  // credit deep tables (credit-deep.mjs) end
  // --- trade (lb/trade) ---
  "trade-total": "All India", "trade-total-inr": "All India", "trade-dbie-monthly": "Total, oil and non-oil", "trade-dbie-monthly-inr": "Total, oil and non-oil",
  "trade-dbie-annual": "Total, oil and non-oil", "trade-dbie-annual-inr": "Total, oil and non-oil", "trade-dbie-tot-2012": "Index", "trade-dbie-tot-1999": "Index", "trade-dbie-tot-1978": "Index",
  "trade-dbie-uvi-2012": "Commodity index", "trade-dbie-uvi-1999": "Commodity index", "trade-dbie-oil-volumes": "Crude and products",
  "trade-dbie-direction": "Partner or group", "trade-dbie-direction-1987": "Partner and commodity", "trade-dbie-commodities": "Commodity group", "trade-dbie-commodities-1987": "Commodity group",
  "trade-dbie-commodity-partners": "Commodity and partner", "trade-dbie-commodity-partners-1990": "Commodity and partner",
  "trade-partners-balance": "Partner", "trade-partners-balance-fy": "Partner", "trade-partners-long": "Partner", "trade-partners-long-inr": "Partner",
  ...Object.fromEntries(["", "-fy", "-ytd"].flatMap((t) => ["", "-inr"].flatMap((c) => ["exports", "imports"].flatMap((f) => [[`trade-regions-${f}${t}${c}`, "Region"], [`trade-principal-${f}${t}${c}`, "Principal commodity"]])))),
  "trade-principal-quantity-exports": "Principal commodity", "trade-principal-quantity-imports": "Principal commodity",
  ...Object.fromEntries(["hs2", "hs4"].flatMap((l) => ["exports", "imports"].flatMap((f) => ["", "-ytd"].map((t) => [`trade-partner-${l}-${f}${t}`, `Partner and HS ${l.slice(2)}-digit product`])))),
  // --- end trade ---
  // --- nas (gdp guide, wave 2) ---
  ...Object.fromEntries(["gdp", "gdp-2022"].flatMap((b) => Object.entries({ "annual-levels": "Indicator", "annual-growth": "Indicator", "annual-shares": "Component of GDP", "annual-industries": "Industry", "annual-subindustries": "Sub-industry", "annual-gcf-industries": "Industry of use", "sectors": "Institutional sector", "revisions": "Estimate stage", "quarterly-levels": "Indicator", "quarterly-shares": "Component of GDP", "quarterly-industry-levels": "Industry" }).map(([k, c]) => [`${b}-${k}`, c]))),
  "gdp-back-levels": "Indicator", "gdp-back-growth": "Indicator", "gdp-back-shares": "Component of GDP", "gdp-back-industries": "Industry", "gdp-back-subindustries": "Sub-industry",
  // --- end nas ---
};
// the fallback, by what a bundle's slug says it is
export const CUT_RULES = [
  [/states?-sectors/, "State and sector"],
  [/-states?(-|$)/, "State"],
  [/-items?(-|$)/, "Item"],
  [/-subgroups?(-|$)/, "Sub-group"],
  [/-groups?(-|$)/, "Group"],
  [/-industr(y|ies)(-|$)/, "Industry"],
  [/-sectors?(-|$)/, "Sector"],
  [/-partners?(-|$)/, "Partner"],
  [/-commodit(y|ies)(-|$)/, "Commodity"],
  [/-(hs\d|chapters?)(-|$)/, "Product"],
  [/-countr(y|ies)(-|$)/, "Country"],
  // --- states: every other states-* bundle (MoSPI levels, all RBI Handbook tables) is by state
  [/^states-/, "State"],
];
export function cutOf(slug) {
  if (CUT_BY_BUNDLE[slug]) return CUT_BY_BUNDLE[slug];
  for (const [re, c] of CUT_RULES) if (re.test(slug)) return c;
  return "All India";
}
// the parent within a long cut, when the bundle carries one (CPI items' division, a WPI
// item's lineage below the major group, an explicit series.group)
function groupOf(s) {
  if (s.group) return String(s.group);
  if (s.division) return String(s.division);
  if (s.lineage) { const p = String(s.lineage).split(" › "); return tidy(p[1] ?? p[0]); }
  return "";
}

/* ---------- periods ---------- */
// survey rounds dated by one year on the axis, named as the source names them
export const PERIOD_LABELS = {
  "nfhs-": { "2016-01-01": "NFHS-4, 2015-16", "2020-01-01": "NFHS-5, 2019-21" },
  // health-gender: the compendium's periods as each table names them (meta.periodLabels)
  ...healthGenderMeta("periodLabels", /^gender-t/),
  // worldbank (2026-10-09): PIP survey rounds, dated by reporting year
  "poverty-pip-1977": { "1977-01-01": "NSS 1977-78" }, "poverty-pip-1983": { "1983-01-01": "NSS 1983" },
  "poverty-pip-1987": { "1987-01-01": "NSS 1987-88" },
  "poverty-pip-1993": { "1993-01-01": "NSS 1993-94", "2004-01-01": "NSS 2004-05", "2009-01-01": "NSS 2009-10" },
  "poverty-pip-2011": { "2011-01-01": "NSS 2011-12" }, "poverty-pip-2022": { "2022-01-01": "HCES 2022-23", "2023-01-01": "HCES 2023-24" },
  // climate (lb/climate): seasons dated by their first month (December by the later year),
  // CMIP6 20-year windows dated by their first year, OWID decades by their first year
  "climate-seasons-": Object.fromEntries(Array.from({ length: 130 }, (_, i) => 1900 + i).flatMap((y) => [
    [`${y}-01-01`, `Dec ${y - 1} to Feb ${y}`], [`${y}-04-01`, `Mar to May ${y}`], [`${y}-07-01`, `Jun to Aug ${y}`], [`${y}-10-01`, `Sep to Nov ${y}`]])),
  "climate-cmip6-windows-": { "1995-01-01": "1995-2014", "2020-01-01": "2020-2039", "2040-01-01": "2040-2059", "2060-01-01": "2060-2079", "2080-01-01": "2080-2099" },
  "climate-cmip6-states-": { "2020-01-01": "2020-2039", "2040-01-01": "2040-2059", "2060-01-01": "2060-2079", "2080-01-01": "2080-2099" },
  "climate-temp-decadal": Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`${1940 + 10 * i}-01-01`, `${1940 + 10 * i}s`])),
  // ilo: the ILO dates each NSS round by the year it ends
  "ilo-nss-": { "1994-01-01": "NSS 1993-94", "2000-01-01": "NSS 1999-2000", "2005-01-01": "NSS 2004-05", "2010-01-01": "NSS 2009-10", "2012-01-01": "NSS 2011-12" },
};
export function periodLabel(slug, bundle, iso) {
  for (const [pre, map] of Object.entries(PERIOD_LABELS)) if (slug.startsWith(pre) && map[iso]) return map[iso];
  const f = bundle.meta?.frequency, y = +iso.slice(0, 4), m = +iso.slice(5, 7);
  if (f === "monthly") return `${M3[m - 1]} ${y}`;
  if (f === "quarterly") return m % 3 === 1 ? `${M3[m - 1]} to ${M3[m + 1]} ${y}` : `${M3[(m + 9) % 12]} to ${M3[m - 1]} ${y}`;   // dated by the quarter's first month, or its last
  if (bundle.dates.length === 1 && bundle.meta?.latestPeriod && !/^\d{4}-\d{2}$/.test(bundle.meta.latestPeriod)) return String(bundle.meta.latestPeriod);
  if (m === 1) return String(y);
  if (m === 3) return `Mar ${y}`;                                 // stocks as on 31 March
  if (m === 4 || m === 7) return `${y}-${String(y + 1).slice(2)}`;  // fiscal or agricultural year
  return `${M3[m - 1]} ${y}`;
}

/* ---------- sparkline ----------
 * A path in a 72x20 box: every published point, thinned by stride to at most 48 (the last
 * point always kept), y-domain [min(0, min), max] as the site's sparklines are (DESIGN.md §5).
 * Unpublished points break the line; nothing is drawn across a gap. */
export const SPARK_W = 72, SPARK_H = 20;
export function sparkPath(data, maxPts = 36) {
  const idx = data.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0);
  if (!idx.length) return null;
  const stride = Math.max(1, Math.ceil(idx.length / maxPts));
  const keep = new Set(idx.filter((_, k) => k % stride === 0));
  keep.add(idx.at(-1));
  const vs = idx.map((i) => data[i]);
  const lo = Math.min(0, ...vs), hi = Math.max(...vs);
  const i0 = idx[0], i1 = idx.at(-1);
  const X = (i) => (i1 === i0 ? SPARK_W / 2 : 1 + ((i - i0) / (i1 - i0)) * (SPARK_W - 4));
  const Y = (v) => (hi === lo ? SPARK_H / 2 : 2 + (1 - (v - lo) / (hi - lo)) * (SPARK_H - 4));
  const r = (n) => Math.round(n * 10) / 10;
  // "M x y L x y x y ...": one L per run keeps the path short on long tails
  let d = "", run = 0;
  for (let i = i0; i <= i1; i++) {
    if (data[i] == null) { run = 0; continue; }
    if (!keep.has(i)) continue;
    d += (run === 0 ? "M" : run === 1 ? "L" : " ") + r(X(i)) + " " + r(Y(data[i]));
    run++;
  }
  return { d, end: [r(X(i1)), r(Y(data[i1]))], zero: lo < 0 ? r(Y(0)) : null };
}

/* ---------- rows ---------- */
const minus = (t) => t.replace(/-(?=[\d₹$])/, MINUS);
const tidy = (t) => {
  const s = String(t ?? "").replace(/ · /g, ", ").replace(/ — /g, ": ").replace(/\s+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};
const bundleCache = new Map();
export function loadBundle(slug) {
  if (!bundleCache.has(slug)) bundleCache.set(slug, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8")));
  return bundleCache.get(slug);
}
// a plain name for a bundle: its base and coverage, as GuideData names it
export function bundleTitle(slug, b = loadBundle(slug)) {
  const m = b.meta || {};
  const base = m.base && m.base !== "null" && !/^n\/a/.test(m.base) ? String(m.base) : "";
  return [tidy(m.coverage || m.product || slug).replace(/\.$/, ""), base && /\d/.test(base) ? `base ${base}` : ""].filter(Boolean).join(", ");
}

// the ruler a row is measured on, short enough to sit under every row ("base 2024=100")
export function bundleBase(slug, b = loadBundle(slug)) {
  const base = String(b.meta?.base ?? "");
  return base && base !== "null" && /\d/.test(base) && !/^n\/a/.test(base) && base.length <= 28 ? `base ${base}` : "";
}

const yearEarlier = (iso) => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`;
const TIMED = new Set(["monthly", "quarterly", "annual"]);

/** Every series of one bundle as table rows. Throws on a unit it cannot show. */
const rowsMemo = new Map();
export function rowsOf(slug, opts = {}) {
  const mk = slug + "|" + (opts.cut ?? "");
  if (!rowsMemo.has(mk)) rowsMemo.set(mk, rowsOfUncached(slug, opts));
  return rowsMemo.get(mk);
}
function rowsOfUncached(slug, opts = {}) {
  const b = loadBundle(slug);
  const cut = opts.cut ?? cutOf(slug);
  const rows = [];
  for (const [key, s] of Object.entries(b.series)) {
    const u = unitOf(b, s);
    const U = u && UNITS[u];
    if (!U) throw new Error(`everycut: ${slug}.${key} has unit "${u}", which src/dossiers/everycut.js UNITS cannot show; add it there or set series.unit`);
    let li = -1;
    for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) { li = i; break; }
    const row = {
      bundle: slug, key, label: tidy(s.label || key), cut, group: groupOf(s), unit: u, unitNote: U.note || "", base: bundleBase(slug, b),
      latest: null, latestText: "—", period: "", change: null, changeText: "—", spark: sparkPath(s.data),
      estimated: false, changeEstimated: false, estimatedNote: s.estimatedNote || "",
    };
    // CONTRACT-series 2b: a value listed in series.estimated is never shown as if measured
    const est = new Set(s.estimated ?? []);
    if (li >= 0) {
      const v = s.data[li], iso = b.dates[li];
      row.latest = v; row.latestText = minus(U.fmt(v)); row.period = periodLabel(slug, b, iso);
      row.estimated = est.has(iso);
      // health-gender: an estimated latest value marks its change as estimated too, even where the
      // frequency gives no change to show (census-year projections)
      row.changeEstimated = row.estimated;
      if (TIMED.has(b.meta?.frequency)) {
        const j = b.dates.indexOf(yearEarlier(iso));
        const p = j >= 0 ? s.data[j] : null;
        if (p != null) {
          row.changeEstimated = row.estimated || est.has(b.dates[j]);
          if (U.kind === "pt") { row.change = v - p; row.changeText = signed(row.change, (x) => x.toFixed(1) + " pt"); }
          else if (U.kind === "diff") { row.change = v - p; row.changeText = signed(row.change, (x) => U.fmt(x).replace(/^[₹$]/, "")); }
          else if (p > 0 && v >= 0) { row.change = (v / p - 1) * 100; row.changeText = signed(row.change, (x) => x.toFixed(1) + "%"); }
        }
      }
    }
    rows.push(row);
  }
  return rows;
}

// a bundle with more series than this gets its own page; the guide's table links to it
export const LONG_TAIL = 150;
// rows per long-tail page; longer bundles are split, packing whole groups where they exist
export const PAGE_ROWS = 1000;

// the guide page inlines at most this many rows (about 450 KB of HTML); the bundles after the
// cap, in registry order, go to a paged long-tail view. A registry entry may set
// `everyCutInline` to change it for one guide.
export const INLINE_CAP = 600;

const onDisk = (b) => fs.existsSync(path.join(ROOT, "data/series", b + ".json"));
const familyMatch = (f) => { const ps = [].concat(f.match ?? []); return (b) => ps.some((p) => b.startsWith(p)); };
let diskList = null;
const diskBundles = () => (diskList ??= fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort());

/** The guide's bundles, current first, in registry order, deduplicated and present on disk, then
 *  every bundle on disk that one of its `everyCutFamilies` claims (a family's `match` is a
 *  slug prefix, or a list of them), so a family can hold bundles the registry does not list. */
export function guideBundles(d) {
  const out = [d.currentBundle, ...(d.bundles || [])].filter((b, i, a) => b && a.indexOf(b) === i && onDisk(b));
  for (const f of d.everyCutFamilies ?? []) {
    const m = familyMatch(f);
    for (const b of diskBundles()) if (m(b) && !out.includes(b)) out.push(b);
  }
  return out;
}

/** Where every series of a guide appears, exactly once: inline on the guide page, or in one
 *  long-tail view. Views: a bundle over LONG_TAIL series ("bundle"), a registry family of small
 *  bundles ("family"), and the bundles past the inline cap ("more"). */
export function everyCutPlan(d, { cuts = {} } = {}) {
  const names = guideBundles(d);
  const fams = (d.everyCutFamilies ?? []).map((f) => ({ ...f, m: familyMatch(f), bundles: [] }));
  const ids = new Set(names);
  const tails = [], inline = [];
  let free = [];
  for (const b of names) {
    const f = fams.find((x) => x.m(b));
    if (f) f.bundles.push(b); else free.push(b);
  }
  for (const f of fams) {
    if (ids.has(f.id)) throw new Error(`everyCutFamilies: family id "${f.id}" is also a bundle slug`);
    if (f.bundles.length) tails.push({ kind: "family", id: f.id, label: f.label, bundles: f.bundles });
  }
  const cap = d.everyCutInline ?? INLINE_CAP;
  let used = 0;
  const over = [];
  for (const b of free) {
    const rows = rowsOf(b, { cut: cuts[b] });
    if (rows.length > LONG_TAIL) tails.push({ kind: "bundle", id: b, label: bundleTitle(b), bundles: [b] });
    else if (used + rows.length <= cap && !over.length) { inline.push(b); used += rows.length; }
    else over.push(b);
  }
  if (over.length) tails.push({ kind: "more", id: "more", label: "The remaining files", bundles: over });
  for (const t of tails) {
    t.rows = t.bundles.flatMap((b) => rowsOf(b, { cut: cuts[b] }));
    t.pages = t.kind === "bundle" ? paginate(t.rows) : paginateBy(t.rows, (r) => r.bundle);
  }
  return { inline, inlineRows: inline.flatMap((b) => rowsOf(b, { cut: cuts[b] })), tails };
}

/** Split rows into pages of at most `size`, keeping each key's rows together where they fit. */
export function paginateBy(rows, keyFn, size = PAGE_ROWS) {
  const groups = new Map();
  for (const r of rows) { const k = keyFn(r); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const pages = [];
  let cur = [];
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i += size) {
      const chunk = g.slice(i, i + size);
      if (cur.length && cur.length + chunk.length > size) { pages.push(cur); cur = []; }
      cur = cur.concat(chunk);
    }
  }
  if (cur.length) pages.push(cur);
  return pages.length ? pages : [[]];
}

/** Split one long bundle's rows into pages of at most PAGE_ROWS, keeping groups whole. */
export function paginate(rows, size = PAGE_ROWS) {
  if (rows.length <= size) return [rows];
  return paginateBy(rows, (r) => r.group || "", size);
}

// --- health-gender: per-bundle cut names and period labels, read once from bundle meta ---
function healthGenderMeta(field, re = /^(nfhs-[45]-|gender-t)/) {
  const dir = path.join(ROOT, "data/series");
  if (!fs.existsSync(dir)) return {};
  const out = {};
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json") || !re.test(f)) continue;
    const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).meta ?? {};
    if (m[field]) out[f.slice(0, -5)] = m[field];
  }
  return out;
}
