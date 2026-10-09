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
  // gender
  "gender-sexratio": "All India", "gender-imr": "Gender", "gender-lifeexp": "Gender", "gender-mmr": "All India",
  "gender-fertility": "Education", "gender-literacy": "Gender", "gender-work": "Gender",
  // mnre
  "mnre-sources": "Energy source", "mnre-solar-categories": "Solar category",
  // nfhs
  "nfhs-child": "Indicator", "nfhs-maternal": "Indicator", "nfhs-anaemia": "Indicator", "nfhs-adult": "Indicator",
  "nfhs-fertility": "Indicator", "nfhs-household": "Indicator",
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
export function rowsOf(slug, opts = {}) {
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

/** The guide's bundles, current first, in registry order, deduplicated and present on disk. */
export function guideBundles(d) {
  return [d.currentBundle, ...(d.bundles || [])].filter((b, i, a) => b && a.indexOf(b) === i && fs.existsSync(path.join(ROOT, "data/series", b + ".json")));
}

/** Split one long bundle's rows into pages of at most PAGE_ROWS, keeping groups whole. */
export function paginate(rows, size = PAGE_ROWS) {
  if (rows.length <= size) return [rows];
  const byGroup = new Map();
  for (const r of rows) { const g = r.group || ""; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(r); }
  const pages = [];
  let cur = [];
  for (const g of byGroup.values()) {
    for (let i = 0; i < g.length; i += size) {
      const chunk = g.slice(i, i + size);
      if (cur.length && cur.length + chunk.length > size) { pages.push(cur); cur = []; }
      cur = cur.concat(chunk);
    }
  }
  if (cur.length) pages.push(cur);
  return pages;
}
