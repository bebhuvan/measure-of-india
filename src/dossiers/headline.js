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
  external:      { value: (b) => `$${Math.round(last(b, "reserves") / 1000)} bn`, what: "foreign exchange reserves", period: month },
  jobs:          { value: (b) => `${last(b, "ur").toFixed(1)}%`, what: "unemployment rate, age 15 and over", period: month },
  consumption:   { value: (b) => `₹${inr(last(b, "rural"))}`, what: "rural spending per person per month", period: fy },
  factories:     { value: (b) => `${(last(b, "factories_in_operation") / 1e5).toFixed(2)} lakh`, what: "factories in operation", period: fy },
  aishe:         { value: (b) => `${(last(b, "enrolment") / 1e7).toFixed(2)} crore`, what: "students enrolled in higher education", period: fy },
  gender:        { value: (b) => `${last(b, "sex_ratio")}`, what: "women per 1,000 men", period: (b) => `Census ${lastDate(b).slice(0, 4)}` },
  mnre:          { value: (b) => `${(last(b, "grand_total") / 1000).toFixed(1)} GW`, what: "renewable power capacity installed", period: month },
  nfhs:          { value: (b) => { const s = Object.values(b.series).find((x) => x.label.includes("Children age 6-59")); return `${s.data.at(-1).toFixed(1)}%`; },
                   what: "children aged 6 to 59 months with anaemia", period: () => "NFHS-5, 2019-21" },
  manufacturing: { value: (b) => `${last(b, "mva_pct_gdp").toFixed(1)}%`, what: "manufacturing's share of GDP", period: (b) => lastDate(b).slice(0, 4) },
  deposits:      { value: (b) => `₹${last(b, "household_total").toFixed(1)} lakh crore`, what: "households' bank deposits", period: (b) => `March ${lastDate(b).slice(0, 4)}` },
  // bis family session
  debt:          { value: (b) => `${last(b, "total").toFixed(1)}%`, what: "debt of households, companies and government, % of GDP (BIS estimate)", period: quarter },
  housing:       { value: (b) => `${last(b, "real_yoy").toFixed(1)}%`, what: "real house prices, change on a year ago", period: quarter },
  // services
  services:      { value: (b) => `${last(b, "services").toFixed(1)}%`, what: "services' share of gross value added", period: fy },
};

// The small chart beside each guide's figure: always on the current ruler, so a chart never
// sits beside a figure from a different base. `n` keeps the most recent points; `slope` marks
// two-round surveys drawn as a before-and-after.
export const SPARK = {
  cpi:           { bundle: "cpi-2024-linked", series: "headline", n: 36 },
  gdp:           { bundle: "gdp-2022", series: "gdp" },
  wpi:           { bundle: "wpi-2022", series: "headline" },
  iip:           { bundle: "iip-2022", series: "general" },
  external:      { bundle: "rbi-forex", series: "reserves", n: 120 },
  jobs:          { bundle: "plfs-monthly", series: "ur" },
  consumption:   { bundle: "hces-mpce", series: "rural", slope: true },
  factories:     { bundle: "asi-headline", series: "factories_in_operation" },
  aishe:         { bundle: "aishe-headline", series: "enrolment" },
  gender:        { bundle: "gender-sexratio", series: "sex_ratio" },
  mnre:          { bundle: "mnre-sources", series: "grand_total" },
  nfhs:          { bundle: "nfhs-anaemia", label: "Children age 6-59", slope: true },
  manufacturing: { bundle: "wdi-manufacturing", series: "mva_pct_gdp" },
  deposits:      { bundle: "deposits-owners", series: "household_total" },
  // bis family session
  debt:          { bundle: "bis-credit", series: "total", n: 120 },
  housing:       { bundle: "bis-property", series: "real" },
  // services
  services:      { bundle: "services-gva-2022-share", series: "services" },
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
  const b = bundle(sp.bundle);
  const s = sp.series ? b.series[sp.series] : Object.values(b.series).find((x) => x.label.includes(sp.label));
  let dates = b.dates, values = s.data;
  const first = values.findIndex((v) => v != null);
  dates = dates.slice(first); values = values.slice(first);
  if (sp.n) { dates = dates.slice(-sp.n); values = values.slice(-sp.n); }
  return { dates, values, slope: !!sp.slope };
}
