// src/dossiers/headline.js: each guide's headline figure, in one place.
// The RSS feed, the home page's latest releases and the guides index all quote from here,
// so no two surfaces can disagree about a figure. Every value is read from the guide's
// current bundle (registry `currentBundle`, never a retired base) at build time.
//
// Each entry: value(bundle) -> the figure as printed; what -> what it measures, in plain
// words; period(bundle) -> the period it describes, named the way a reader would say it.
// A guide without an entry fails the build (see headlineOf).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));
const last = (b, k) => b.series[k].data.at(-1);
const lastDate = (b) => b.dates.at(-1);
const month = (b) => { const d = lastDate(b); return `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`; };
const quarter = (b) => { const d = lastDate(b), m = +d.slice(5, 7) - 1; return `${M3[m]} to ${M3[m + 2]} ${d.slice(0, 4)}`; };
const fy = (b) => { const y = +lastDate(b).slice(0, 4), m = +lastDate(b).slice(5, 7), s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };
const inr = (v) => Math.round(v).toLocaleString("en-IN");

export const HEADLINE = {
  cpi:           { value: (b) => `${last(b, "headline").toFixed(2)}%`, what: "consumer price inflation, year on year", period: month },
  gdp:           { value: (b) => `${last(b, "gdp").toFixed(2)}%`, what: "real GDP growth, year on year", period: quarter },
  wpi:           { value: (b) => `${last(b, "headline").toFixed(2)}%`, what: "wholesale price inflation, year on year", period: month },
  iip:           { value: (b) => `${last(b, "general").toFixed(2)}%`, what: "industrial output growth, year on year", period: month },
  external:      { value: (b) => { const v = last(b, "current_account") / 1000; return `${v < 0 ? "−" : "+"}$${Math.abs(v).toFixed(1)} bn`; }, what: "current account balance, the quarter's surplus (+) or deficit (−)", period: quarter },
  jobs:          { value: (b) => `${last(b, "ur").toFixed(1)}%`, what: "unemployment rate, age 15 and over", period: month },
  consumption:   { value: (b) => `₹${inr(last(b, "rural"))}`, what: "rural spending per person per month", period: fy },
  factories:     { value: (b) => `${(last(b, "factories_in_operation") / 1e5).toFixed(2)} lakh`, what: "factories in operation", period: fy },
  aishe:         { value: (b) => `${(last(b, "enrolment") / 1e7).toFixed(2)} crore`, what: "students enrolled in higher education", period: fy },
  gender:        { value: (b) => `${Math.round(last(b, "total__all_india"))}`, what: "girls born for every 1,000 boys (Sample Registration System)", period: (b) => b.meta.latestPeriod },
  mnre:          { value: (b) => `${(last(b, "grand_total") / 1000).toFixed(1)} GW`, what: "renewable power capacity installed", period: month },
  nfhs:          { value: (b) => `${last(b, "children_age_6_59_months_who_are_anaemic_11__all_india__total").toFixed(1)}%`,
                   what: "children aged 6 to 59 months with anaemia", period: (b) => `NFHS-5, ${b.meta.latestPeriod}` },
  manufacturing: { value: (b) => `${last(b, "mva_pct_gdp").toFixed(1)}%`, what: "manufacturing's share of GDP", period: (b) => lastDate(b).slice(0, 4) },
  deposits:      { value: (b) => `₹${last(b, "household_total").toFixed(1)} lakh crore`, what: "households' bank deposits", period: (b) => `March ${lastDate(b).slice(0, 4)}` },
  // bis family session
  debt:          { value: (b) => `${last(b, "total").toFixed(1)}%`, what: "debt of households, companies and government, % of GDP (BIS estimate)", period: quarter },
  housing:       { value: (b) => `${last(b, "real_yoy").toFixed(1)}%`, what: "real house prices, change on a year ago", period: quarter },
  // services
  services:      { value: (b) => `${last(b, "services").toFixed(1)}%`, what: "services' share of gross value added", period: fy },
  // states: the richest state's income per person as a multiple of the poorest's (fixed panel)
  states:        { value: (b) => `${last(b, "gap_current").toFixed(1)} times`, what: "income per person, richest state against poorest", period: fy },
  // worldbank family (2026-10-09)
  poverty:       { value: (b) => `${last(b, "headcount_3_00").toFixed(1)}%`, what: "of Indians below $3.00 a day (2021 PPP)", period: (b) => `HCES ${lastDate(b).slice(0, 4)}-${String(+lastDate(b).slice(0, 4) + 1).slice(2)}` },
  population:    { value: (b) => `${(last(b, "tpopulation1july") / 1e6).toFixed(3)} billion`, what: "people in India, UN estimate", period: (b) => lastDate(b).slice(0, 4) },
  // climate: the month's departure from its own 1991-2020 average (ERA5, OWID)
  climate:       { value: (b) => `${last(b, "temperature_anomaly") < 0 ? "−" : "+"}${Math.abs(last(b, "temperature_anomaly")).toFixed(2)}°C`, what: "India's temperature against the 1991-2020 average for the month", period: month },
  // ilo
  ilo:           { value: (b) => `${last(b, "eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15").toFixed(1)}%`, what: "women aged 15+ in the labour force, ILO estimate", period: (b) => lastDate(b).slice(0, 4) },
  // --- rates (atlas-rates) ---
  rates:         { value: (b) => `${last(b, "repo").toFixed(2)}%`, what: "the RBI's policy repo rate", period: (b) => `from ${b.meta.vintage.slice(8, 10).replace(/^0/, "")} ${MONTHS[+b.meta.vintage.slice(5, 7) - 1]} ${b.meta.vintage.slice(0, 4)}` },
  // credit (lb/credit)
  credit:        { value: (b) => `${last(b, "headline").toFixed(1)}%`, what: "growth of bank credit, year on year", period: month },
  // trade (lb/trade): the month's merchandise trade balance, US$ billion, signed (a deficit is negative)
  trade:         { value: (b) => `${last(b, "balance") < 0 ? "−" : ""}$${Math.abs(last(b, "balance") / 1000).toFixed(1)} bn`, what: "merchandise trade balance (exports minus imports)", period: month },
  // --- public-finance (lb/public-finance): the Centre's deficit so far this year, against the year's budget
  "public-finance": { value: (b) => `${last(b, "fiscal_deficit_pct_be").toFixed(1)}%`, what: "the Centre's fiscal deficit so far this year, as a share of the year's budget estimate", period: (b) => { const d = lastDate(b), m = +d.slice(5, 7) - 1; return `April to ${MONTHS[m]} ${d.slice(0, 4)}`; } },
};

// The small chart beside each guide's figure: always on the current ruler, so a chart never
// sits beside a figure from a different base. `n` keeps the most recent points; `slope` marks
// two-round surveys drawn as a before-and-after.
export const SPARK = {
  cpi:           { bundle: "cpi-2024-linked", series: "headline", n: 36 },
  gdp:           { bundle: "gdp-2022", series: "gdp" },
  wpi:           { bundle: "wpi-2022", series: "headline" },
  iip:           { bundle: "iip-2022", series: "general" },
  external:      { bundle: "external-bop", series: "current_account", n: 40 },
  jobs:          { bundle: "plfs-monthly", series: "ur" },
  consumption:   { bundle: "hces-mpce", series: "rural", slope: true },
  factories:     { bundle: "asi-headline", series: "factories_in_operation" },
  aishe:         { bundle: "aishe-headline", series: "enrolment" },
  gender:        { bundle: "gender-t007", series: "total__all_india" },
  mnre:          { bundle: "mnre-sources", series: "grand_total" },
  // health-gender: two survey rounds, two bundles; the spark is a before-and-after of one series
  nfhs:          { rounds: ["nfhs-4-anaemia", "nfhs-5-anaemia"], series: "children_age_6_59_months_who_are_anaemic_11__all_india__total", slope: true },
  manufacturing: { bundle: "wdi-manufacturing", series: "mva_pct_gdp" },
  deposits:      { bundle: "deposits-owners", series: "household_total" },
  // bis family session
  debt:          { bundle: "bis-credit", series: "total", n: 120 },
  housing:       { bundle: "bis-property", series: "real" },
  // services
  services:      { bundle: "services-gva-2022-share", series: "services" },
  states:        { bundle: "states-spread", series: "gap_current" },
  // worldbank family (2026-10-09): the lineup (model estimates) gives the poverty spark a shape; surveys alone are 2 points
  poverty:       { bundle: "poverty-pip-lineup", series: "headcount_3_00" },
  population:    { bundle: "population-wpp", series: "tpopulation1july" },
  climate:       { bundle: "climate-temp-annual", series: "temperature_anomaly" },   // climate: annual, 1940 on
  // ilo
  ilo:           { bundle: "ilo-est-eap-2wap", series: "eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15" },
  // --- rates (atlas-rates): the repo rate at each month-end since the MPC began
  rates:         { bundle: "rates-monthly", series: "repo", n: 121 },
  // credit (lb/credit)
  credit:        { bundle: "credit-growth", series: "headline" },
  trade:         { bundle: "trade-total", series: "exports", n: 60 },   // trade (lb/trade)
  // public-finance (lb/public-finance): the Centre's deficit, April to each month
  "public-finance": { bundle: "public-finance-centre-gfd-monthly", series: "gfd_fytd", n: 87 },
};

const cache = {};
export const bundle = (slug) => (cache[slug] ??= JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8")));

/** { value, what, period, released, bundle } for a registry entry. */
export function headlineOf(d) {
  const h = HEADLINE[d.slug];
  if (!h) throw new Error(`headline: no entry for guide "${d.slug}" (src/dossiers/headline.js)`);
  const b = bundle(d.currentBundle);
  // asOf: the last period the data describes; lists sort on this, never on fetch or vintage dates
  return { value: h.value(b), what: h.what, period: h.period(b), asOf: lastDate(b), released: b.meta.releaseDate ?? null, vintage: b.meta.vintage, bundle: b };
}

/** { dates, values, slope } for the guide's small chart. */
export function sparkOf(d) {
  const sp = SPARK[d.slug];
  if (!sp) throw new Error(`headline: no spark for guide "${d.slug}"`);
  // health-gender: a survey whose rounds are separate bundles (two rulers): one point from each
  if (sp.rounds) {
    const bs = sp.rounds.map(bundle);
    return { dates: bs.map((x) => x.dates.at(-1)), values: bs.map((x) => x.series[sp.series].data.at(-1)), slope: true };
  }
  const b = bundle(sp.bundle);
  const s = sp.series ? b.series[sp.series] : Object.values(b.series).find((x) => x.label.includes(sp.label));
  let dates = b.dates, values = s.data;
  const first = values.findIndex((v) => v != null);
  dates = dates.slice(first); values = values.slice(first);
  if (sp.n) { dates = dates.slice(-sp.n); values = values.slice(-sp.n); }
  return { dates, values, slope: !!sp.slope };
}
