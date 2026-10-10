// src/dossiers/profiles.js: the state profiles (/states/<state>/), built at build time from
// the baked bundles. One template (src/pages/states/[state].astro) renders what this returns;
// nothing here is typed per state. The state key (states-key.js) places every label.
//
// Rules this file holds to (docs/briefs/state-profiles.md):
//  - every figure is one bundle cell, or a labelled computation of bundle cells (growth, a
//    share, an average), and carries its own period; scripts/qc.mjs re-reads each one;
//  - a rank counts only states and UTs with a figure for the same period, and says how many;
//  - nothing crosses a seam: no ranking across bundles, bases or survey designs, and a figure
//    a source labels "Andhra Pradesh" or "Jammu and Kashmir" for a period before the split is
//    the undivided unit's (states-key sameTerritory), never the present unit's;
//  - a state a source does not cover gets "the source has no figure", never a fill.
import fs from "node:fs";
import path from "node:path";
import { STATES, BY_SLUG, FORMER_BY_SLUG, placeAll, placeFirst, normalise, sameTerritory, successorOf } from "./states-key.js";
import * as F from "../charts/format.js";
import { periodLabel, rowAnchor, everyCutPlan, rowsOf } from "./everycut.js";
import { DOSSIERS } from "./registry.js";

const ROOT = process.cwd();
const MINUS = "−";
const bcache = new Map();
export function load(slug) {
  if (!bcache.has(slug)) {
    const f = path.join(ROOT, "data/series", slug + ".json");
    if (!fs.existsSync(f)) throw new Error(`profiles: bundle ${slug} is not baked`);
    bcache.set(slug, JSON.parse(fs.readFileSync(f, "utf8")));
  }
  return bcache.get(slug);
}

import { FMT } from "./profiles.fmt.js";
export { FMT };

/* ---------- reading bundles through the key ---------- */
const textOf = (k, s) => s.state ?? s.geo ?? s.label ?? k;
const isIndia = (k, s) => /^all_india|^all india/i.test(k) || /^all india\b/i.test(String(textOf(k, s)));

// every series of a bundle a measure picks, placed: Map(state slug -> key), plus the former
// units the source still names (undivided Andhra Pradesh, the J&K state with Ladakh, the two
// UTs that merged in 2020) in a separate map. Two picked series placing to one unit fail loudly.
const cellMemo = new Map();
export function cells(m) {
  const id = m.bundle + "|" + m.id;
  if (cellMemo.has(id)) return cellMemo.get(id);
  const b = load(m.bundle);
  const cur = new Map(), former = new Map();
  for (const [k, s] of Object.entries(b.series)) {
    if (!m.pick(k, s) || isIndia(k, s)) continue;
    const hits = [...new Set(placeAll(textOf(k, s)).map((h) => h.slug))];
    if (hits.length !== 1) continue;
    const slug = hits[0];
    const into = FORMER_BY_SLUG.has(slug) ? former : cur;
    if (into.has(slug)) throw new Error(`profiles: ${m.id} picks two series of ${m.bundle} for ${slug} (${into.get(slug)}, ${k}); tighten its pick`);
    into.set(slug, k);
  }
  if (!cur.size) throw new Error(`profiles: ${m.id} picks no state series in ${m.bundle}`);
  const out = { cur, former };
  cellMemo.set(id, out);
  return out;
}

// the last day of the period a date stands for
function periodEnd(b, iso) {
  const f = b.meta?.frequency, y = +iso.slice(0, 4), mo = +iso.slice(5, 7);
  const add = f === "monthly" ? 1 : f === "quarterly" ? (mo % 3 === 0 ? 1 : 3) : f === "annual" ? 12 : 1;
  const d = new Date(Date.UTC(y, mo - 1 + add, 0));
  return d.toISOString().slice(0, 10);
}

const idx = (b, iso) => b.dates.indexOf(iso);
// a state's value at a date, or null when the source has none or the figure is the undivided unit's
export function valueAt(m, slug, iso) {
  const b = load(m.bundle), c = cells(m), k = c.cur.get(slug);
  const i = idx(b, iso);
  if (!k || i < 0) return null;
  const v = b.series[k].data[i];
  if (v == null) return null;
  const succ = successorOf(slug);
  const sk = succ ? c.cur.get(succ) : null;
  if (!sameTerritory(slug, periodEnd(b, iso), { successorHasValue: sk ? b.series[sk].data[i] != null : false })) return null;
  return v;
}
export function latestDate(m, slug) {
  const b = load(m.bundle);
  for (let i = b.dates.length - 1; i >= 0; i--) if (valueAt(m, slug, b.dates[i]) != null) return b.dates[i];
  return null;
}
// rank among present units with a figure for the same date: { r, n, dir } (r = 1 is highest)
export function rankAt(m, slug, iso) {
  const vals = [];
  for (const u of STATES) { const v = valueAt(m, u.slug, iso); if (v != null) vals.push([u.slug, v]); }
  const mine = vals.find(([s]) => s === slug);
  if (!mine || vals.length < 3) return null;
  const r = 1 + vals.filter(([, v]) => v > mine[1]).length;
  return { r, n: vals.length };
}
export function allAt(m, iso) {
  const out = [];
  for (const u of STATES) { const v = valueAt(m, u.slug, iso); if (v != null) out.push({ slug: u.slug, name: u.name, short: u.short ?? u.name, v }); }
  return out;
}

/* ---------- comparators (all-India and other references) ---------- */
// A comparator is one cell of a national bundle on the same ruler, or a labelled computation.
// Returns { value, iso, period, src } or null. `src` is what qc re-reads.
const cellOf = (bundle, key, iso) => { const b = load(bundle), i = idx(b, iso); return i < 0 ? null : (b.series[key]?.data[i] ?? null); };
const lastCell = (bundle, key) => { const b = load(bundle), s = b.series[key]; if (!s) throw new Error(`profiles: ${bundle} has no series ${key}`); for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return b.dates[i]; return null; };
const monthsBack = (iso, n) => { const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 - n, 1)); return d.toISOString().slice(0, 10); };
export const COMPUTE = {
  // change on the same month a year earlier, per cent, from an index's own levels
  yoy12: ([[b, k]], iso) => { const a = cellOf(b, k, iso), p = cellOf(b, k, monthsBack(iso, 12)); return a == null || p == null ? null : (a / p - 1) * 100; },
  // a cell as published
  cell: ([[b, k]], iso) => cellOf(b, k, iso),
  // the sum of several cells (an all-India share from its parts)
  sum: (args, iso) => { const xs = args.map(([b, k]) => cellOf(b, k, iso)); return xs.some((x) => x == null) ? null : xs.reduce((a, x) => a + x, 0); },
  // growth on the previous period of the same series, per cent
  growth: ([[b, k]], iso) => { const B = load(b), i = idx(B, iso); if (i < 1) return null; const a = B.series[k].data[i], p = B.series[k].data[i - 1]; return a == null || p == null ? null : (a / p - 1) * 100; },
  // a over b, per cent; an optional third argument scales b (units differ between tables)
  ratio: ([[b1, k1], [b2, k2, scale = 1]], iso) => { const a = cellOf(b1, k1, iso), d = cellOf(b2, k2, iso); return a == null || !d ? null : (a / (d * scale)) * 100; },
  // a series' own average over a span of dates (climate normals)
  mean: ([[b, k, from, to]]) => { const B = load(b), s = B.series[k]; const xs = B.dates.map((d, i) => (d >= from && d <= to ? s.data[i] : null)).filter((v) => v != null); return xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null; },
};
function compute(op, args, iso) { const f = COMPUTE[op]; if (!f) throw new Error(`profiles: unknown computation ${op}`); return f(args, iso); }

/* ---------- the measures ---------- */
// id, section, label (short, for tables), what (the noun phrase in a sentence), bundle, pick,
// fmt, india (comparator: { op, args } on the same ruler, or null with indiaNote saying why),
// period (an override of the period label, where the source's own name for it differs).
const has = (re) => (k) => re.test(k);
const endsKey = (suffix) => (k) => k.endsWith(suffix);
const startsKey = (prefix) => (k) => k.startsWith(prefix);
const notAgg = (k) => !/^all_/.test(k);
const nfhs = (table, re, extra = {}) => ({ bundle: `nfhs-5-${table}`, pick: (k, s) => s.sector === "total" && re.test(s.group ?? ""), india: { op: "nfhsIndia", args: [[`nfhs-5-${table}`, re.source]] }, round4: { bundle: `nfhs-4-${table}`, re }, fmt: "pct1", ...extra });
// NFHS-6 (2023-24) from the IIPS fact sheets (scripts/lib/products/profiles-nfhs6.mjs): the
// round's own value, ranked among NFHS-6 units, with the NFHS-5 figure the same fact sheets print
// on the same definitions as the earlier round (a separate bundle, never joined)
const n6 = (no, extra = {}) => { const i = String(no).padStart(3, "0"); return { bundle: "profiles-nfhs6", pick: endsKey(`__i${i}__total`), india: { op: "cell", args: [["profiles-nfhs6", `all_india__i${i}__total`]] }, earlierIn: "profiles-nfhs6-nfhs5", fmt: "pct1", guide: "nfhs", ...extra }; };
const MPI_PERIODS = { "2015-04-01": "2015-16", "2020-04-01": "2019-21" };   // the NITI Aayog rounds (NFHS-4 and NFHS-5): All India 24.85% and 14.96%, as baked
const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// a stock dated by the last month of its quarter (bank deposits, credit, offices)
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const endMonth = (iso) => `end ${M3[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
// a period as a sentence names it: "in 2024-25", "in August 2026", "at the end of June 2026"
export function inPeriod(p) {
  const m = /^(end )?([A-Z][a-z]{2}) (\d{4})$/.exec(p);
  if (m) { const full = MONTHS[M3.indexOf(m[2])]; return m[1] ? `at the end of ${full} ${m[3]}` : `in ${full} ${m[3]}`; }
  return `in ${p}`;
}
const forPeriod = (p) => inPeriod(p.replace(/^NFHS-\d, /, "")).replace(/^in /, "").replace(/^at the /, "the ");

// the last complete financial year of state borrowing: the newest year on the axis is the year
// in progress (auctions run to March), so the profile reads the one before it
const SDL_FULL_YEAR = load("rates-sdl-states").dates.at(-2);

export const SECTIONS = [
  { id: "income", title: "Income and growth" },
  { id: "structure", title: "What the economy runs on" },
  { id: "prices", title: "Prices" },
  { id: "work", title: "Work and pay" },
  { id: "households", title: "How households live" },
  { id: "health", title: "Health" },
  { id: "money", title: "Money" },
  { id: "industry", title: "Industry, energy and exports" },
  { id: "farms", title: "Farms" },
  { id: "education", title: "Education" },
  { id: "climate", title: "Climate" },
  { id: "finances", title: "State finances" },
];

export const MEASURES = [
  // income and growth: MoSPI regional accounts, base 2011-12 (the states guide's bundles)
  { id: "pc", section: "income", label: "Income per person", what: "income per person", bundle: "states-pcnsdp-current", pick: () => true, fmt: "inr", glance: true,
    india: null, indiaNote: "MoSPI publishes no all-India figure beside the states on this base", guide: "states" },
  { id: "pcReal", section: "income", label: "Income per person, 2011-12 prices", what: "income per person at constant 2011-12 prices", bundle: "states-pcnsdp-constant", pick: () => true, fmt: "inr", india: null, guide: "states" },
  { id: "gsdp", section: "income", label: "Size of the economy (GSDP)", what: "gross state domestic product (GSDP), the size of the economy", bundle: "states-gsdp-current", pick: () => true, fmt: "lakhcrFromCrore", india: null, guide: "states" },
  { id: "growth", section: "income", label: "Real growth of GSDP", what: "the economy's real growth (GSDP at constant prices)", bundle: "states-growth-real", pick: endsKey("__gsdp"), fmt: "pct1", glance: true,
    india: { op: "growth", args: [["gdp-annual-levels", "gdp_constant"]], label: "India's GDP, same 2011-12 base, computed from MoSPI's constant-price levels" }, guide: "states" },
  { id: "pcGrowth", section: "income", label: "Real growth of income per person", what: "the real growth of income per person", bundle: "states-growth-real", pick: endsKey("__pcnsdp"), fmt: "pct1", india: null, guide: "states" },
  // structure
  { id: "agri", section: "structure", label: "Farming's share of output", what: "farming's share of the state's output (GSVA)", bundle: "states-structure", pick: endsKey("__agriculture"), fmt: "pct1",
    india: { op: "sum", args: [["gdp-annual-industries", "agriculture_share"]], label: "India, base 2011-12" }, guide: "states" },
  { id: "industry", section: "structure", label: "Industry's share of output", what: "industry's share (mining, manufacturing, utilities and construction)", bundle: "states-structure", pick: endsKey("__industry"), fmt: "pct1",
    india: { op: "sum", args: [["gdp-annual-industries", "mining_share"], ["gdp-annual-industries", "manufacturing_share"], ["gdp-annual-industries", "utilities_share"], ["gdp-annual-industries", "construction_share"]], label: "India, base 2011-12, the sum of four industries' shares" }, guide: "states" },
  { id: "services", section: "structure", label: "Services' share of output", what: "services' share", bundle: "states-structure", pick: endsKey("__services"), fmt: "pct1",
    india: { op: "sum", args: [["gdp-annual-industries", "trade_transport_share"], ["gdp-annual-industries", "finance_realty_share"], ["gdp-annual-industries", "public_admin_other_share"]], label: "India, base 2011-12, the sum of three service industries' shares" }, guide: "states" },
  { id: "manuf", section: "structure", label: "Manufacturing's share of output", what: "manufacturing's share", bundle: "states-industry-shares", pick: endsKey("__manufacturing"), fmt: "pct1",
    india: { op: "sum", args: [["gdp-annual-industries", "manufacturing_share"]], label: "India, base 2011-12" }, guide: "states" },
  // prices: CPI base 2024 (current ruler)
  { id: "cpi", section: "prices", label: "Retail inflation (CPI)", what: "retail inflation (prices against a year earlier)", bundle: "cpi-2024-states", pick: () => true, fmt: "pct2", glance: true,
    india: { op: "cell", args: [["cpi-2024", "headline"]], label: "All India, CPI base 2024" }, guide: "cpi" },
  { id: "cpiAl", section: "prices", label: "Inflation for farm labourers (CPI-AL)", what: "inflation for farm labourers' households (CPI-AL, prices against a year earlier, computed from the index)", bundle: "cpialrl-states-2019", pick: () => true, fmt: "pct2", derive: { op: "yoy12" },
    india: { op: "yoy12", args: [["cpialrl-2019", "al"]], label: "All India, computed from the index" }, guide: "cpi" },
  { id: "cpiFood", section: "prices", label: "Food and drink inflation", what: "inflation in food and drink", bundle: "cpi-2024-states-divisions", pick: endsKey("__01"), fmt: "pct2",
    india: { op: "cell", args: [["cpi-2024", "food_and_beverages"]], label: "All India" }, guide: "cpi" },
  // work and pay: PLFS revamped design, calendar year (usual status, age 15 and above)
  { id: "ur", section: "work", label: "Unemployment rate", what: "the unemployment rate (age 15 and above, usual status)", bundle: "plfs-cy25-states-ur", pick: endsKey("__ur_psss__person_all__a15plus"), fmt: "pct1", glance: true,
    india: { op: "cell", args: [["plfs-cy25-india", "ur_psss__person_all__a15plus"]], label: "All India" }, guide: "jobs" },
  { id: "urYouth", section: "work", label: "Unemployment, age 15 to 29", what: "the unemployment rate among 15 to 29 year olds", bundle: "plfs-cy25-states-ur", pick: endsKey("__ur_psss__person_all__a15_29"), fmt: "pct1",
    india: { op: "cell", args: [["plfs-cy25-india", "ur_psss__person_all__a15_29"]], label: "All India" }, guide: "jobs" },
  { id: "urGrad", section: "work", label: "Unemployment among graduates", what: "the unemployment rate among graduates (usual status)", bundle: "plfs-cy25-states-ur", pick: endsKey("__ur_psss__person_all__all_ages__edu_graduate"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "ur_psss__person_all__all_ages__edu_graduate"]] }, guide: "jobs" },
  { id: "urW", section: "work", label: "Unemployment, women", what: "the unemployment rate among women", bundle: "plfs-cy25-states-ur", pick: endsKey("__ur_psss__female_all__a15plus"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "ur_psss__female_all__a15plus"]] }, guide: "jobs" },
  { id: "urM", section: "work", label: "Unemployment, men", what: "the unemployment rate among men", bundle: "plfs-cy25-states-ur", pick: endsKey("__ur_psss__male_all__a15plus"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "ur_psss__male_all__a15plus"]] }, guide: "jobs" },
  { id: "lfprW", where: true, section: "work", label: "Women in the labour force", what: "the share of women working or looking for work", bundle: "plfs-cy25-states-lfpr", pick: endsKey("__lfpr_psss__female_all__a15plus"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "lfpr_psss__female_all__a15plus"]] }, guide: "jobs" },
  { id: "lfprM", section: "work", label: "Men in the labour force", what: "the share of men working or looking for work", bundle: "plfs-cy25-states-lfpr", pick: endsKey("__lfpr_psss__male_all__a15plus"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "lfpr_psss__male_all__a15plus"]] }, guide: "jobs" },
  { id: "wprW", section: "work", label: "Women in work", what: "the share of women in work", bundle: "plfs-cy25-states-wpr", pick: endsKey("__wpr_psss__female_all__a15plus"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "wpr_psss__female_all__a15plus"]] }, guide: "jobs" },
  { id: "wprM", section: "work", label: "Men in work", what: "the share of men in work", bundle: "plfs-cy25-states-wpr", pick: endsKey("__wpr_psss__male_all__a15plus"), fmt: "pct1", india: { op: "cell", args: [["plfs-cy25-india", "wpr_psss__male_all__a15plus"]] }, guide: "jobs" },
  { id: "wageFarm", section: "work", label: "Daily wage, farm labour (men)", what: "the daily wage of a man doing general farm work", bundle: "states-hbs-t113", pick: notAgg, fmt: "inrDay", india: { op: "cell", args: [["states-hbs-t113", "all_india"]], label: "All India" }, guide: "states" },
  { id: "wageNonFarm", section: "work", label: "Daily wage, non-farm labour (men)", what: "the daily wage of a man doing non-farm labour", bundle: "states-hbs-t115", pick: notAgg, fmt: "inrDay", india: { op: "cell", args: [["states-hbs-t115", "all_india"]] }, guide: "states" },
  { id: "wageBuild", section: "work", label: "Daily wage, construction (men)", what: "the daily wage of a man in construction", bundle: "states-hbs-t112", pick: notAgg, fmt: "inrDay", india: { op: "cell", args: [["states-hbs-t112", "all_india"]] }, guide: "states" },
  // households
  { id: "mpceR", section: "households", label: "Monthly spending per person, rural", what: "monthly spending per person in villages", bundle: "hces-states", pick: endsKey("_rural"), fmt: "inr", glance: true,
    india: { op: "cell", args: [["hces-mpce", "rural"]], label: "All India, rural" }, guide: "consumption" },
  { id: "mpceU", section: "households", label: "Monthly spending per person, urban", what: "monthly spending per person in towns and cities", bundle: "hces-states", pick: endsKey("_urban"), fmt: "inr",
    india: { op: "cell", args: [["hces-mpce", "urban"]], label: "All India, urban" }, guide: "consumption" },
  { id: "foodR", section: "households", label: "Food's share of spending, rural", what: "food's share of what village households spend", bundle: "hces-categories-states", pick: (k) => /_rural$/.test(k) && !k.includes("__"), fmt: "pct1", india: { op: "cell", args: [["hces-categories", "food_total_rural"]] }, guide: "consumption" },
  { id: "foodU", section: "households", label: "Food's share of spending, urban", what: "food's share of what urban households spend", bundle: "hces-categories-states", pick: (k) => /_urban$/.test(k) && !k.includes("__"), fmt: "pct1", india: { op: "cell", args: [["hces-categories", "food_total_urban"]] }, guide: "consumption" },
  { id: "poorest5R", section: "households", label: "Spending of the poorest 5%, rural", what: "monthly spending per person of the poorest 5% of village households", bundle: "hces-fractiles-states", pick: endsKey("_rural__f0_5"), fmt: "inr", india: { op: "cell", args: [["hces-fractiles-states", "all_india_rural__f0_5"]] }, guide: "consumption" },
  { id: "richest5R", section: "households", label: "Spending of the richest 5%, rural", what: "monthly spending per person of the richest 5% of village households", bundle: "hces-fractiles-states", pick: endsKey("_rural__f95_100"), fmt: "inr", india: { op: "cell", args: [["hces-fractiles-states", "all_india_rural__f95_100"]] }, guide: "consumption" },
  { id: "giniR", section: "households", label: "Inequality of spending (Gini), rural", what: "the Gini coefficient of spending in villages (0 is equal, 1 is one household spending everything)", bundle: "hces-gini-states", pick: (k) => /_rural$/.test(k), fmt: "gini", india: { op: "cell", args: [["hces-gini", "rural"]] }, guide: "consumption" },
  { id: "giniU", section: "households", label: "Inequality of spending (Gini), urban", what: "the Gini coefficient of spending in towns and cities", bundle: "hces-gini-states", pick: (k) => /_urban$/.test(k), fmt: "gini", india: { op: "cell", args: [["hces-gini", "urban"]] }, guide: "consumption" },
  { id: "mpceScR", section: "households", label: "Monthly spending per person, Scheduled Caste households, rural", what: "monthly spending per person in Scheduled Caste households in villages", bundle: "hces-social-states", pick: endsKey("_rural__scheduled_caste"), fmt: "inr", india: { op: "cell", args: [["hces-social-states", "all_india_rural__scheduled_caste"]] }, guide: "consumption" },
  { id: "mpi", section: "households", label: "Multidimensionally poor", what: "the share of people who are multidimensionally poor (NITI Aayog)", bundle: "states-hbs-t010", pick: endsKey("__headcount_ratio"), fmt: "pct1",
    india: { op: "cell", args: [["states-hbs-t010", "all_india__headcount_ratio"]], label: "All India" }, period: (iso) => MPI_PERIODS[iso], guide: "states" },
  { id: "sanitation", where: true, section: "households", label: "Improved toilet at home", what: "the share of people in homes with an improved toilet", ...nfhs("household", /^Population living in households that use an improved sanitation/), guide: "nfhs" },
  { id: "cooking", section: "households", label: "Clean cooking fuel", what: "the share of households cooking with clean fuel", ...nfhs("household", /^Households using clean fuel for cooking/), guide: "nfhs" },
  { id: "water", section: "households", label: "Improved drinking water", what: "the share of people with an improved source of drinking water", ...n6(5) },
  { id: "electricity", section: "households", label: "Electricity at home", what: "the share of people in homes with electricity", ...n6(4) },
  { id: "insurance", section: "households", label: "Health insurance", what: "the share of households with a member covered by health insurance or a health scheme", ...n6(7) },
  { id: "bankW", section: "households", label: "Women with a bank account", what: "the share of women with a bank or savings account they use", ...n6(92) },
  { id: "phoneW", section: "households", label: "Women with a mobile phone", what: "the share of women with a mobile phone they use", ...n6(93) },
  { id: "internetW", section: "households", label: "Women who have used the internet", what: "the share of women who have ever used the internet", ...n6(14) },
  { id: "schoolW", section: "households", label: "Women with 10 years of school", what: "the share of women with ten or more years of schooling", ...n6(12) },
  { id: "childMarriage", section: "households", label: "Women married before 18", what: "the share of women aged 20 to 24 who married before 18", ...n6(16) },
  { id: "sexRatioBirth", section: "households", label: "Sex ratio at birth", what: "the number of girls born for every 1,000 boys (births in the last five years)", ...nfhs("household", /^Sex ratio at birth/), fmt: "count", guide: "nfhs" },
  { id: "bankHh", section: "households", label: "Households with a bank account", what: "the share of households with a member who has a bank or post office account", ...n6(8) },
  { id: "landW", section: "households", label: "Women who own a house or land", what: "the share of households where a woman owns a house or land, alone or jointly", ...n6(10) },
  { id: "preschool", section: "households", label: "Children aged 2 to 4 in pre-school", what: "the share of children aged 2 to 4 who attended pre-school", ...n6(11) },
  { id: "violence", section: "households", label: "Women who faced spousal violence", what: "the share of ever-married women aged 18 to 49 who have ever faced violence from a husband", ...n6(95) },
  // health
  { id: "stunting", section: "health", label: "Children stunted", what: "the share of children under five who are too short for their age", ...n6(69), where: true },
  { id: "wasting", section: "health", label: "Children wasted", what: "the share of children under five who are too thin for their height", ...n6(70) },
  { id: "anaemiaW", section: "health", label: "Women anaemic", what: "the share of women aged 15 to 49 who are anaemic", ...nfhs("anaemia", /^All women age 15-49 years who are anaemic/), guide: "nfhs" },
  { id: "anaemiaC", section: "health", label: "Children anaemic", what: "the share of children aged 6 to 59 months who are anaemic", ...nfhs("anaemia", /^Children age 6-59 months who are anaemic/), guide: "nfhs" },
  { id: "institutional", section: "health", label: "Births in a hospital or clinic", what: "the share of births in a hospital or health centre", ...n6(35) },
  { id: "vaccinated", section: "health", label: "Children fully vaccinated", what: "the share of children aged 12 to 23 months fully vaccinated (card or mother's report)", ...n6(44) },
  { id: "tfr", section: "health", label: "Children per woman", what: "the number of children a woman would have at today's rates", ...n6(18, { fmt: "births" }) },
  { id: "mlaW", section: "households", label: "Women among MLAs", what: "the share of women among members elected to the state assembly", bundle: "gender-t126-states", pick: startsKey("female__"), fmt: "pct1", derive: { op: "ratio", mapKey: (k) => k.replace(/^female__/, "total__") }, india: null, guide: "gender" },
  { id: "overweightW", section: "health", label: "Women overweight or obese", what: "the share of women aged 15 to 49 who are overweight or obese", ...n6(76) },
  { id: "bpW", section: "health", label: "Women with high blood pressure", what: "the share of women aged 15 and above with high blood pressure, or on medicine for it", ...n6(86) },
  { id: "bpM", section: "health", label: "Men with high blood pressure", what: "the share of men aged 15 and above with high blood pressure, or on medicine for it", ...n6(89) },
  { id: "sugarW", section: "health", label: "Women with high blood sugar", what: "the share of women aged 15 and above with high blood sugar, or on medicine for it", ...n6(80) },
  { id: "sugarM", section: "health", label: "Men with high blood sugar", what: "the share of men aged 15 and above with high blood sugar, or on medicine for it", ...n6(83) },
  { id: "tobaccoM", section: "health", label: "Men who use tobacco", what: "the share of men aged 15 and above who use any kind of tobacco", ...n6(99) },
  { id: "imr", section: "health", label: "Infant deaths per 1,000 births", what: "the number of infant deaths for every 1,000 live births (Sample Registration System)", bundle: "states-hbs-t004", pick: notAgg, fmt: "count", india: { op: "cell", args: [["states-hbs-t004", "all_india"]] }, guide: "states" },
  { id: "life", section: "health", label: "Life expectancy at birth", what: "life expectancy at birth", bundle: "states-hbs-t007", pick: endsKey("__total"), fmt: "years", india: { op: "cell", args: [["states-hbs-t007", "all_india__total"]] }, guide: "states" },
  { id: "beds", section: "health", label: "Government hospital beds", what: "the number of beds in government hospitals", bundle: "states-hbs-t017", pick: endsKey("__number_of_beds__total"), fmt: "count", india: { op: "cell", args: [["states-hbs-t017", "all_india__number_of_beds__total"]] }, guide: "states" },
  // money
  { id: "cd", section: "money", label: "Credit-deposit ratio", what: "the credit-deposit ratio (bank loans booked in the state for every ₹100 deposited there)", bundle: "credit-states-cd", pick: () => true, fmt: "pct1", glance: true,
    india: { op: "cell", args: [["credit-states-cd", "all_india"]], label: "All India" }, period: endMonth, guide: "credit" },
  { id: "deposits", section: "money", label: "Bank deposits", what: "the total of bank deposits", bundle: "credit-states", pick: endsKey("_deposits"), fmt: "lakhcr", india: { op: "cell", args: [["credit-states", "all_india_deposits"]] }, period: endMonth, guide: "credit" },
  { id: "credit", section: "money", label: "Bank credit", what: "the total of bank credit", bundle: "credit-states", pick: endsKey("_credit"), fmt: "lakhcr", india: { op: "cell", args: [["credit-states", "all_india_credit"]] }, period: endMonth, guide: "credit" },
  { id: "creditFarm", section: "money", label: "Farm loans, share of bank credit", what: "farm loans' share of bank credit booked in the state", bundle: "credit-states-occupation", pick: endsKey("__agriculture"), fmt: "pct1", derive: { op: "ratio", mapKey: (k) => k.replace(/__agriculture$/, "__total_credit") },
    india: { op: "ratio", args: [["credit-states-occupation", "all_india__agriculture"], ["credit-states-occupation", "all_india__total_credit"]] }, period: endMonth, guide: "credit" },
  { id: "creditPersonal", section: "money", label: "Personal loans, share of bank credit", what: "personal loans' share of bank credit (homes, vehicles, education, cards and others)", bundle: "credit-states-occupation", pick: endsKey("__personal_loans"), fmt: "pct1", derive: { op: "ratio", mapKey: (k) => k.replace(/__personal_loans$/, "__total_credit") },
    india: { op: "ratio", args: [["credit-states-occupation", "all_india__personal_loans"], ["credit-states-occupation", "all_india__total_credit"]] }, period: endMonth, guide: "credit" },
  { id: "branches", section: "money", label: "Bank branches", what: "the number of bank branches", bundle: "credit-deep-offices-states", pick: endsKey("__branch"), fmt: "count", india: null, period: endMonth, guide: "credit" },
  // industry and energy
  { id: "factories", section: "industry", label: "Factories in operation", what: "the number of factories in operation", bundle: "asi-states", pick: startsKey("factories_in_operation_"), fmt: "count", india: { op: "cell", args: [["asi-headline", "factories_in_operation"]] }, guide: "factories" },
  { id: "factoryJobs", section: "industry", label: "People working in factories", what: "the number of people working in factories", bundle: "asi-states", pick: startsKey("persons_engaged_"), fmt: "count", india: { op: "cell", args: [["asi-headline", "persons_engaged"]] }, guide: "factories" },
  { id: "factoryGva", section: "industry", label: "Value added by factories", what: "the value added by factories", bundle: "asi-states", pick: startsKey("gva_"), fmt: "croreFromLakh", india: { op: "cell", args: [["asi-headline", "gva"]] }, guide: "factories" },
  { id: "estab", section: "industry", label: "Informal enterprises", what: "the number of unincorporated enterprises outside farming (ASUSE)", bundle: "asuse-states", pick: startsKey("est_"), fmt: "count", india: { op: "cell", args: [["asuse-annual", "establishments_all"]] }, guide: "factories" },
  { id: "estabWorkers", section: "industry", label: "Workers in informal enterprises", what: "the number of workers in unincorporated enterprises", bundle: "asuse-states", pick: startsKey("wrk_"), fmt: "count", india: { op: "cell", args: [["asuse-annual", "workers_all"]] }, guide: "factories" },
  { id: "re", section: "industry", label: "Renewable power capacity", what: "the renewable power capacity installed", bundle: "mnre-states", pick: () => true, fmt: "mw", india: { op: "cell", args: [["mnre-sources", "grand_total"]], label: "All India" }, guide: "mnre" },
  { id: "solar", section: "industry", label: "Solar power capacity", what: "the solar power capacity installed", bundle: "mnre-states-solar", pick: (k) => !k.includes("__"), fmt: "mw", india: { op: "cell", args: [["mnre-sources", "solar"]] }, guide: "mnre" },
  { id: "wind", section: "industry", label: "Wind power capacity", what: "the wind power capacity installed", bundle: "mnre-states-wind", pick: (k) => !k.includes("__"), fmt: "mw", india: { op: "cell", args: [["mnre-sources", "wind"]] }, guide: "mnre" },
  { id: "power", where: true, section: "industry", label: "Electricity available per person", what: "the electricity available per person in a year", bundle: "states-hbs-t138", pick: notAgg, fmt: "kwh", india: { op: "cell", args: [["states-hbs-t138", "all_india"]] }, guide: "states" },
  { id: "tdLoss", section: "industry", label: "Power lost in transmission", what: "the share of power lost between plant and consumer", bundle: "states-hbs-t148", pick: notAgg, fmt: "pct1", india: { op: "cell", args: [["states-hbs-t148", "all_india"]] }, guide: "states" },
  { id: "exports", section: "industry", label: "Goods exported", what: "the value of goods exported from the state", bundle: "states-hbs-t181", pick: notAgg, fmt: "usd", india: { op: "cell", args: [["states-hbs-t181", "all_india"]] }, guide: "states" },
  // farms (RBI Handbook)
  { id: "grain", section: "farms", label: "Foodgrains grown", what: "the foodgrain harvest", bundle: "states-hbs-t062", pick: notAgg, fmt: "lakhTonnesFromThousand", india: { op: "cell", args: [["states-hbs-t062", "all_india"]] }, guide: "states" },
  { id: "yield", section: "farms", label: "Foodgrain yield", what: "the foodgrain yield", bundle: "states-hbs-t084", pick: notAgg, fmt: "kgha", india: { op: "cell", args: [["states-hbs-t084", "all_india"]] }, guide: "states" },
  { id: "irrigated", section: "farms", label: "Cropped area irrigated", what: "the share of the cropped area that is irrigated (gross irrigated over gross sown area)", bundle: "states-hbs-t055", pick: notAgg, fmt: "pct1",
    derive: { op: "ratio", other: "states-hbs-t053" }, india: { op: "ratio", args: [["states-hbs-t055", "all_india"], ["states-hbs-t053", "all_india"]] }, guide: "states" },
  { id: "intensity", section: "farms", label: "Cropping intensity", what: "cropping intensity (gross sown area for every 100 hectares of net sown area)", bundle: "states-hbs-t057", pick: notAgg, fmt: "ratio", india: { op: "cell", args: [["states-hbs-t057", "all_india"]] }, guide: "states" },
  { id: "milk", section: "farms", label: "Milk produced", what: "milk output", bundle: "states-hbs-t091", pick: notAgg, fmt: "lakhTonnesFromThousand", india: { op: "cell", args: [["states-hbs-t091", "all_india"]] }, guide: "states" },
  // education
  { id: "ger", where: true, section: "education", label: "College enrolment ratio", what: "the gross enrolment ratio in higher education (18 to 23 year olds)", bundle: "aishe-states-ger", pick: endsKey("__ger_all_both"), fmt: "pct1", india: { op: "cell", args: [["aishe-states-ger", "all_india__ger_all_both"]] }, guide: "aishe" },
  { id: "gerW", section: "education", label: "College enrolment ratio, women", what: "the gross enrolment ratio in higher education for women", bundle: "aishe-states-ger", pick: endsKey("__ger_all_female"), fmt: "pct1", india: { op: "cell", args: [["aishe-states-ger", "all_india__ger_all_female"]] }, guide: "aishe" },
  { id: "gerSec", section: "education", label: "Secondary school enrolment ratio", what: "the gross enrolment ratio in classes 9 to 12", bundle: "states-hbs-t001", pick: endsKey("__secondary_class_ix_to_xii__total"), fmt: "pct1", india: { op: "cell", args: [["states-hbs-t001", "all_india__secondary_class_ix_to_xii__total"]] }, guide: "states" },
  // climate (CCKP, ERA5): against the state's own 1951-1980 average
  { id: "temp", section: "climate", label: "Average temperature", what: "the average air temperature over the year", bundle: "climate-era5-states-temp", pick: startsKey("tas__"), fmt: "degC", normal: ["1951-01-01", "1980-01-01"], india: null, guide: "climate" },
  { id: "hot35", section: "climate", label: "Days of 35°C or more", what: "the number of days that reached 35°C or more", bundle: "climate-era5-states-hotdays", pick: startsKey("hd35__"), fmt: "days", normal: ["1951-01-01", "1980-01-01"], india: null, guide: "climate" },
  { id: "hot35Future", section: "climate", label: "Extra hot days by 2040-59 (middle path)", what: "the change in days of 35°C or more by 2040 to 2059 against 1995 to 2014, on a middle emissions path (SSP2-4.5, median of the models)", bundle: "climate-cmip6-states-hotdays", pick: startsKey("hd35__ssp245__"), fmt: "daysPlus", at: "2040-01-01", india: null, guide: "climate" },
  { id: "hot35FutureHigh", section: "climate", label: "Extra hot days by 2040-59 (high path)", what: "the same change on a high emissions path (SSP5-8.5)", bundle: "climate-cmip6-states-hotdays", pick: startsKey("hd35__ssp585__"), fmt: "daysPlus", at: "2040-01-01", india: null, guide: "climate" },
  { id: "rain", section: "climate", label: "Rainfall in the year", what: "the rain over the year", bundle: "climate-era5-states-rain", pick: startsKey("pr__"), fmt: "mm", normal: ["1951-01-01", "1980-01-01"], india: null, guide: "climate" },
  // state finances (RBI Handbook actuals over MoSPI GSDP, as the states guide computes them)
  { id: "gfd", section: "finances", label: "Fiscal deficit, % of GSDP", what: "the gross fiscal deficit, as a share of the state's GSDP", bundle: "states-finances", pick: endsKey("__gfd"), fmt: "pct1", india: null, guide: "states" },
  { id: "debt", section: "finances", label: "Debt, % of GSDP", what: "outstanding liabilities at the end of March, as a share of GSDP", bundle: "states-finances", pick: endsKey("__debt"), fmt: "pct1", india: null, guide: "states" },
  { id: "ownTax", section: "finances", label: "Own tax revenue, % of GSDP", what: "the state's own tax revenue, as a share of GSDP", bundle: "states-finances", pick: endsKey("__own_tax"), fmt: "pct1", india: null, guide: "states" },
  { id: "sdl", section: "finances", label: "What the state pays to borrow", what: "the cut-off yield on the state's market loans, weighted by amount raised", bundle: "rates-sdl-states", pick: (k) => /_yield$/.test(k) && !/wavg/.test(k), fmt: "pct2pa", at: SDL_FULL_YEAR, india: { op: "cell", args: [["rates-sdl-states", "all_yield"]], label: "all states together" }, guide: "rates" },
  { id: "interest", section: "finances", label: "Interest, % of revenue spending", what: "interest payments as a share of revenue spending", bundle: "states-hbs-t170", pick: endsKey("__actual"), fmt: "pct1",
    derive: { op: "ratio", other: "states-hbs-t166", scale: 1e7, otherKey: (k) => k }, india: { op: "ratio", args: [["states-hbs-t170", "all_states_and_uts__actual"], ["states-hbs-t166", "all_states_and_uts__actual", 1e7]], label: "all states and UTs together" }, guide: "states" },
];
export const BY_ID = Object.fromEntries(MEASURES.map((m) => [m.id, m]));
for (const m of MEASURES) {
  if (!FMT[m.fmt]) throw new Error(`profiles: ${m.id} has unknown format ${m.fmt}`);
  if (!SECTIONS.some((s) => s.id === m.section)) throw new Error(`profiles: ${m.id} has unknown section ${m.section}`);
}

// a derived measure (a ratio of two tables): the state's value is computed from its two cells
// the other operand of a ratio: the same unit's series in another bundle, or a sibling key
const otherKey = (m, slug) => {
  const k = cells(m).cur.get(slug);
  if (!k) return null;
  if (m.derive.mapKey) return m.derive.mapKey(k);
  return cells({ ...m, id: m.id + ":other", bundle: m.derive.other }).cur.get(slug) ?? null;
};
function derivedAt(m, slug, iso) {
  if (m.derive.op === "yoy12") {
    if (valueAt(m, slug, iso) == null) return null;
    return COMPUTE.yoy12([[m.bundle, cells(m).cur.get(slug)]], iso);
  }
  const a = valueAt(m, slug, iso);
  if (a == null) return null;
  const ob = m.derive.other ?? m.bundle, other = load(ob), k2 = otherKey(m, slug), i = idx(other, iso);
  if (!k2 || i < 0 || !other.series[k2]) return null;
  const d = other.series[k2].data[i];
  return d ? (a / (d * (m.derive.scale ?? 1))) * 100 : null;
}
const measureAt = (m, slug, iso) => (m.derive ? derivedAt(m, slug, iso) : valueAt(m, slug, iso));
function measureLatest(m, slug) {
  const b = load(m.bundle);
  for (let i = b.dates.length - 1; i >= 0; i--) if (measureAt(m, slug, b.dates[i]) != null) return b.dates[i];
  return null;
}
function measureRank(m, slug, iso) {
  const vals = STATES.map((u) => [u.slug, measureAt(m, u.slug, iso)]).filter(([, v]) => v != null);
  const mine = vals.find(([s]) => s === slug);
  if (!mine || vals.length < 3) return null;
  const tied = vals.filter(([, v]) => v === mine[1]).length;
  // a value many units share (no wind capacity at all) is not a rank
  if (tied > 2 && mine[1] === 0) return null;
  return { r: 1 + vals.filter(([, v]) => v > mine[1]).length, n: vals.length, tied };
}
// the comparison period of a measure: the latest date at least three in four of the units the
// source ever covers report. Sources publish at different lags (MoSPI's newest year comes from
// a few states first), so ranks are drawn there, and a state's newer figure is shown beside it.
const commonMemo = new Map();
export function commonDate(m) {
  if (commonMemo.has(m.id)) return commonMemo.get(m.id);
  const b = load(m.bundle);
  const counts = b.dates.map((d) => STATES.filter((u) => measureAt(m, u.slug, d) != null).length);
  const most = Math.max(...counts);
  let out = null;
  for (let i = b.dates.length - 1; i >= 0; i--) if (counts[i] >= 0.75 * most) { out = b.dates[i]; break; }
  commonMemo.set(m.id, out);
  return out;
}
export const measureAll = (m, iso) => STATES.map((u) => ({ slug: u.slug, name: u.name, short: u.short ?? u.name, v: measureAt(m, u.slug, iso) })).filter((x) => x.v != null);

// NFHS All India: the bundle's own All India row for the sub-indicator, total
COMPUTE.nfhsIndia = ([[bundle, src]]) => {
  const re = new RegExp(src), b = load(bundle);
  const s = Object.values(b.series).find((x) => x.geo === "All India" && x.sector === "total" && re.test(x.group ?? ""));
  return s ? s.data[0] : null;
};
function nfhs4(m, slug) {
  if (!m.round4) return null;
  const f = path.join(ROOT, "data/series", m.round4.bundle + ".json");
  if (!fs.existsSync(f)) return null;
  const b = load(m.round4.bundle);
  for (const [k, s] of Object.entries(b.series)) {
    if (s.sector !== "total" || !m.round4.re.test(s.group ?? "")) continue;
    const hits = [...new Set(placeAll(textOf(k, s)).map((h) => h.slug))];
    if (hits.length === 1 && hits[0] === slug && s.data[0] != null) {
      // NFHS-4 (2015-16) predates both boundary changes: J&K then included Ladakh, and
      // Dadra and Nagar Haveli and Daman and Diu were two UTs; those are not compared
      const succ = successorOf(slug);
      const succHas = succ ? Object.entries(b.series).some(([k2, s2]) => s2.sector === "total" && m.round4.re.test(s2.group ?? "") && placeAll(textOf(k2, s2))[0]?.slug === succ) : false;
      if (!sameTerritory(slug, "2016-12-31", { successorHasValue: succHas })) return null;
      return { value: s.data[0], bundle: m.round4.bundle, key: k, iso: b.dates[0], period: periodLabel(m.round4.bundle, b, b.dates[0]) };
    }
  }
  return null;
}

// the previous round as the same source prints it, on the same definitions (same key)
function earlierIn(m, slug) {
  const k = cells(m).cur.get(slug), b = load(m.earlierIn);
  const s = k && b.series[k];
  if (!s || s.data[0] == null) return null;
  return { value: s.data[0], bundle: m.earlierIn, key: k, iso: b.dates[0], period: periodLabel(m.earlierIn, b, b.dates[0]) };
}

/* ---------- one figure ---------- */
export function periodOf(m, iso) {
  const b = load(m.bundle);
  return m.period?.(iso) ?? periodLabel(m.bundle, b, iso);
}
// src: what qc re-reads. { op: "cell", args: [[bundle, key, iso]] } or a computation.
function srcOf(m, slug, iso) {
  const k = cells(m).cur.get(slug);
  if (m.derive?.op === "yoy12") return { op: "yoy12", args: [[m.bundle, k]], iso };
  if (m.derive) return { op: "ratio", args: [[m.bundle, k], [m.derive.other ?? m.bundle, otherKey(m, slug), m.derive.scale ?? 1]], iso };
  return { op: "cell", args: [[m.bundle, k]], iso };
}
export function figure(m, slug, { at = m.at } = {}) {
  const last = at ?? measureLatest(m, slug);
  if (!last) return null;
  // lead with the comparison period where the state has it; its newer figure follows
  const cd = at ? null : commonDate(m);
  const iso = cd && cd < last && measureAt(m, slug, cd) != null ? cd : last;
  if (measureAt(m, slug, iso) == null) return null;
  const value = measureAt(m, slug, iso);
  if (value == null) return null;
  const f = { id: m.id, label: m.label, what: m.what, value, text: FMT[m.fmt](value), fmt: m.fmt, iso, period: periodOf(m, iso), bundle: m.bundle, key: cells(m).cur.get(slug),
    src: srcOf(m, slug, iso), rank: measureRank(m, slug, iso), guide: m.guide };
  if (iso !== last) {
    const nv = measureAt(m, slug, last);
    f.newer = { value: nv, text: FMT[m.fmt](nv), iso: last, period: periodOf(m, last), n: measureAll(m, last).length, src: srcOf(m, slug, last) };
  }
  if (m.india) {
    let iiso = iso;
    let iv = compute(m.india.op, m.india.args, iiso);
    if (iv == null && m.india.op !== "nfhsIndia") {
      // the all-India figure may stop earlier or later: show its own latest, never another date's as this one's
      const b0 = m.india.args[0][0], k0 = m.india.args[0][1];
      iiso = lastCell(b0, k0);
      iv = iiso ? compute(m.india.op, m.india.args, iiso) : null;
    }
    if (iv != null) f.india = { value: iv, text: FMT[m.fmt](iv), iso: iiso, period: periodOf(m, iiso), same: iiso === iso, src: { op: m.india.op, args: m.india.args, iso: iiso }, label: m.india.label ?? "All India" };
  }
  if (m.normal) {
    const k = f.key;
    const nv = compute("mean", [[m.bundle, k, m.normal[0], m.normal[1]]]);
    if (nv != null) f.normal = { value: nv, text: FMT[m.fmt](nv), src: { op: "mean", args: [[m.bundle, k, m.normal[0], m.normal[1]]] }, span: `${m.normal[0].slice(0, 4)} to ${m.normal[1].slice(0, 4)}` };
  }
  const r4 = m.earlierIn ? earlierIn(m, slug) : nfhs4(m, slug);
  if (r4) f.earlier = { ...r4, text: FMT[m.fmt](r4.value), src: { op: "cell", args: [[r4.bundle, r4.key]], iso: r4.iso } };
  return f;
}
// the former units a source names, for a unit with a predecessor (the J&K state's figures
// on the J&K and Ladakh profiles; the two pre-merger UTs on the merged UT's)
export function formerFigures(m, slug) {
  const out = [];
  if (m.derive) return out;   // a ratio of two tables: not drawn for a unit that no longer exists
  const b = load(m.bundle), c = cells(m);
  for (const [fs_, k] of c.former) {
    const fu = FORMER_BY_SLUG.get(fs_);
    if (!fu.successors.includes(slug)) continue;
    const s = b.series[k];
    let i = s.data.length - 1;
    while (i >= 0 && s.data[i] == null) i--;
    if (i < 0) continue;
    out.push({ unit: fu, value: s.data[i], text: FMT[m.fmt](s.data[i]), iso: b.dates[i], period: periodOf(m, b.dates[i]), bundle: m.bundle, key: k, src: { op: "cell", args: [[m.bundle, k]], iso: b.dates[i] } });
  }
  return out;
}

/* ---------- words ---------- */
const ORD = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export function rankPhrase(rank) {
  if (!rank) return null;
  const { r, n, tied = 1 } = rank;
  const j = tied > 1 ? "joint " : "";
  if (r === 1) return `${j ? "joint highest" : "the highest"} of ${n}`;
  if (r + tied - 1 === n) return `${j ? "joint lowest" : "the lowest"} of ${n}`;
  return r <= n / 2 ? `${j}${ORD(r)} highest of ${n}` : `${j}${ORD(n - (r + tied - 1) + 1)} lowest of ${n}`;
}
export const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
export const withThe = (u) => (/Islands$/.test(u.name) ? `the ${u.name}` : u.name);

/* ---------- where each series lives (Go deeper) ---------- */
let rowIndex = null;
// bundle -> { guide, href(key) } for every bundle any guide's every-cut table carries
function buildRowIndex() {
  const idxm = new Map();
  for (const d of DOSSIERS) {
    const plan = everyCutPlan(d);
    for (const b of plan.inline) if (!idxm.has(b)) idxm.set(b, { guide: d.slug, page: () => `/guides/${d.slug}/` });
    for (const t of plan.tails) {
      const pageOf = new Map();
      t.pages.forEach((rows, i) => { for (const r of rows) pageOf.set(r.bundle + "|" + r.key, i); });
      for (const b of t.bundles) if (!idxm.has(b)) idxm.set(b, { guide: d.slug, page: (key) => { const i = pageOf.get(b + "|" + key) ?? 0; return `/guides/${d.slug}/every-cut/${t.id}/${i ? i + 1 + "/" : ""}`; } });
    }
  }
  return idxm;
}
export function rowHref(bundle, key) {
  rowIndex ??= buildRowIndex();
  const e = rowIndex.get(bundle);
  return e ? `${e.page(key)}#${rowAnchor(bundle, key)}` : null;
}
// every series in every guide's every-cut table that names this unit (and its former units,
// labelled as such): the "Go deeper" index and the state's download
let stateRows = null;
export function rowsForState(slug) {
  if (!stateRows) {
    rowIndex ??= buildRowIndex();
    stateRows = new Map();
    for (const [bundle, e] of rowIndex) {
      const b = load(bundle);
      let rows;
      try { rows = rowsOf(bundle); } catch { continue; }
      const byKey = new Map(rows.map((r) => [r.key, r]));
      for (const [k, s] of Object.entries(b.series)) {
        const hits = placeAll(textOf(k, s));
        if (!hits.length) continue;
        const first = hits[0].slug;
        const units = FORMER_BY_SLUG.has(first) ? FORMER_BY_SLUG.get(first).successors : [first];
        const r = byKey.get(k);
        if (!r) continue;
        for (const u of units) {
          if (!stateRows.has(u)) stateRows.set(u, []);
          stateRows.get(u).push({ guide: e.guide, bundle, key: k, label: r.label, latest: r.latestText, period: r.period, unit: r.unit, former: FORMER_BY_SLUG.has(first) ? FORMER_BY_SLUG.get(first).name : null, href: `${e.page(k)}#${r.id}` });
        }
      }
    }
  }
  return stateRows.get(slug) ?? [];
}

/* ---------- the profile ---------- */
const nearest = (list, v, n, skip) => list.filter((x) => !skip.has(x.slug)).sort((a, b) => Math.abs(a.v - v) - Math.abs(b.v - v)).slice(0, n);
export function profile(slug) {
  const u = BY_SLUG.get(slug);
  if (!u) throw new Error(`profiles: no unit ${slug}`);
  const figs = Object.fromEntries(MEASURES.map((m) => [m.id, figure(m, slug)]));
  const sections = SECTIONS.map((s) => {
    const ms = MEASURES.filter((m) => m.section === s.id);
    const present = ms.map((m) => figs[m.id]).filter(Boolean);
    const former = ms.flatMap((m) => formerFigures(m, slug).map((f) => ({ ...f, measure: m })));
    const missing = ms.filter((m) => !figs[m.id]);
    return { ...s, figures: present, former, missing, bundles: [...new Set(ms.map((m) => m.bundle))] };
  });
  // peers: the three units nearest in income per person, the same year, that are not neighbours
  const pcF = figs.pc;
  let peers = [];
  if (pcF) {
    const all = measureAll(BY_ID.pc, pcF.iso);
    peers = nearest(all, pcF.value, 3, new Set([slug, ...u.neighbours])).map((x) => x.slug);
  }
  return { unit: u, figs, sections, neighbours: u.neighbours, peers };
}
export const glanceMeasures = () => MEASURES.filter((m) => m.glance);

// one unit's row for the neighbours-and-peers table: the glance measures, each with its period
export function compareRow(slug) {
  const u = BY_SLUG.get(slug);
  return { slug, name: u.name, short: u.short ?? u.name, cells: glanceMeasures().map((m) => figure(m, slug)) };
}

/* ---------- the page model: templated sentences, tables, charts ---------- */
// A figure on the page is <b class="fig" data-f="<format>" data-src="<json>">text</b>: qc
// (scripts/qc.mjs, profiles block) re-reads data-src from the bundles and renders it through
// FMT[data-f]; a mismatch fails the build. Every figure sits beside its period.
COMPUTE.scale = ([[b, k], factor], iso) => { const v = cellOf(b, k, iso); return v == null ? null : v * factor; };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const figHTML = (text, fmt, src) => `<b class="fig" data-f="${fmt}" data-src="${esc(JSON.stringify(src))}">${esc(text)}</b>`;
const F_ = (f) => figHTML(f.text, f.fmt, f.src);
const I_ = (f) => figHTML(f.india.text, f.fmt, f.india.src);
const scaled = (f, factor, fmt) => {
  if (f.src.op !== "cell") return null;
  const v = f.value * factor;
  return figHTML(FMT[fmt](v), fmt, { op: "scale", args: [[...f.src.args[0], factor]], iso: f.src.iso });
};
const KIND = { state: "State", "ut-legislature": "Union territory with a legislature", ut: "Union territory" };

// one sentence for a figure: value, period, rank among those with the same period, India
export function sentence(u, f, { lead = "" } = {}) {
  let s = `${lead || `In ${withThe(u)}, `}${f.what} was ${F_(f)} ${inPeriod(f.period)}`;
  const rp = rankPhrase(f.rank);
  if (rp) s += `, ${rp} states and union territories with figures for ${forPeriod(f.period)}`;
  if (f.india) s += f.india.same ? `. The all-India figure was ${I_(f)}` : `. The latest all-India figure is ${I_(f)}, for ${forPeriod(f.india.period)}`;
  s += ".";
  if (f.newer) s += ` ${u.name}'s estimate for ${forPeriod(f.newer.period)}, which ${f.newer.n} states and union territories have published so far, is ${figHTML(f.newer.text, f.fmt, f.newer.src)}.`;
  if (f.earlier) s += ` In the previous round, ${f.earlier.period}, it was ${figHTML(f.earlier.text, f.fmt, f.earlier.src)}.`;
  if (f.normal) s += ` Its average over ${f.normal.span} was ${figHTML(f.normal.text, f.fmt, f.normal.src)}.`;
  return s;
}

// the lived-reality line a few measures carry, from the figure itself
function translate(u, f) {
  const N = withThe(u);
  switch (f.id) {
    case "pc": { const d = scaled(f, 1 / 365, "inr"); return d && `That is about ${d} a day for each person, before anyone pays for food, rent or school, and before it is split, very unequally, between wages, profits and taxes.`; }
    case "mpceR": case "mpceU": { const d = scaled(f, 1 / 30, "inr"); return d && `A month's ${F_(f)} is about ${d} a day for each person in the household, for food, fuel, rent, travel, school and everything else.`; }
    case "cd": { const d = scaled(f, 1, "count"); return d && (f.value < 100 ? `For every ₹100 deposited with banks in ${N}, they have lent about ₹${d} in ${N}. The rest is lent elsewhere.` : `For every ₹100 deposited with banks in ${N}, they have lent about ₹${d} in ${N}: more than its own deposits, drawn from savings elsewhere.`); }
    case "cpi": return `Something that cost ₹100 a year earlier cost about ₹${figHTML((100 + f.value).toFixed(2), "num2", { op: "plus100", args: f.src.args, iso: f.src.iso })} ${inPeriod(f.period)}, on the average shopping basket of ${N}.`;
    case "stunting": return `That is about ${figHTML(String(Math.round(f.value)), "round", f.src)} in every 100 children under five, a sign of poor nutrition in the years when it matters most.`;
    default: return null;
  }
}
COMPUTE.plus100 = ([[b, k]], iso) => { const v = cellOf(b, k, iso); return v == null ? null : 100 + v; };

const SECTION_TEXT = {
  income: "State domestic product is everything produced inside the state in a year. Divided by the people who live there, it is the nearest thing to an average income each state publishes, though it measures production, not what people take home. Every figure here is on MoSPI's 2011-12 base.",
  structure: "What the state's output is made of: farms, forests and fishing; industry, which is mining, manufacturing, power and water, and construction; and services, from shops and transport to banks, schools, hospitals and government.",
  prices: "Retail inflation on the 2024 base of the Consumer Price Index, which began in January 2026: how much more the same basket of goods and services cost than a year earlier. Each state has its own basket, so a state's index and the all-India index weigh items differently.",
  work: "From the Periodic Labour Force Survey's calendar-year estimates for 2025, the survey's new design. Usual status counts what a person did for most of the year. Wages are the Labour Bureau's daily rates for men in rural India, as the RBI's Handbook reprints them.",
  households: "Spending from the Household Consumption Expenditure Survey 2023-24; poverty from NITI Aayog's multidimensional index; homes, women's lives and families from the sixth National Family Health Survey (2023-24), with the fifth round (2019-21) beside each figure as the NFHS-6 fact sheets print it. Toilets and cooking fuel are not in the NFHS-6 fact sheets, so they come from NFHS-5.",
  health: "Nutrition, births, vaccination, blood pressure and blood sugar from the sixth National Family Health Survey (2023-24); anaemia, which its fact sheets do not print, from the fifth (2019-21); infant deaths and life expectancy from the Sample Registration System; government hospital beds from the Ministry of Health, as the RBI's Handbook reprints them.",
  money: "Bank deposits and credit booked at branches in the state, from the RBI's quarterly statistics, and the number of bank branches. Credit is counted where a loan is sanctioned, which is not always where the money is spent.",
  industry: "Registered factories from the Annual Survey of Industries; small unincorporated businesses outside farming, from the Annual Survey of Unincorporated Sector Enterprises; renewable power from the Ministry of New and Renewable Energy; electricity supply from the Central Electricity Authority and goods exports by state of origin from the commerce ministry, as the RBI's Handbook reprints them.",
  farms: "Crop output, yield, irrigation and milk from the Ministry of Agriculture and Farmers Welfare and the Department of Animal Husbandry, as the RBI's Handbook of Statistics on Indian States reprints them.",
  education: "College enrolment from the All India Survey on Higher Education (2021-22), and school enrolment in classes 9 to 12 from UDISE+, as the RBI's Handbook reprints it. A gross enrolment ratio counts every enrolled student, of any age, against the population of the official age group.",
  climate: "Temperature and rain over the whole state, from ERA5, a reconstruction of past weather that the World Bank's Climate Change Knowledge Portal averages over each state's area. Each year is set against the state's own average for 1951 to 1980.",
  finances: "The state government's own accounts, from the RBI's Handbook, set against the state's GSDP as the states guide computes it. Actual figures run two years behind; budget and revised estimates are left out.",
};
// a section's lead figures (its sentences); the rest go in the section's table
const LEADS = {
  income: ["pc", "growth", "gsdp"], structure: ["services", "agri"], prices: ["cpi", "cpiFood"], work: ["ur", "urGrad", "lfprW", "wageFarm"],
  households: ["mpceR", "mpceU", "poorest5R", "foodR", "mpi", "sanitation"], health: ["stunting", "institutional", "bpW", "anaemiaW", "imr"], money: ["cd", "deposits", "creditFarm"],
  industry: ["factories", "estab", "re"], farms: ["grain", "yield"], education: ["ger", "gerSec"], climate: ["temp", "rain", "hot35Future"], finances: ["debt", "gfd", "interest", "sdl"],
};
const WHY_NONE = {
  income: "MoSPI's state accounts do not cover this union territory: it has no legislature, and its output is counted within the all-India figures.",
  structure: "MoSPI's state accounts do not cover this union territory, so the shares of its output are not published.",
  finances: "This union territory has no state budget of its own in the RBI's Handbook: its accounts are part of the Union government's.",
  climate: "The World Bank's climate portal draws no area for this unit, so it publishes no state average.",
  farms: "The RBI's Handbook publishes no crop or milk figures for this unit.",
};

export function page(slug) {
  const p = profile(slug), u = p.unit, N = withThe(u);
  const nameOf = (s) => BY_SLUG.get(s).name;
  // glance numbers: value, period, rank, India
  const glance = glanceMeasures().map((m) => p.figs[m.id] && { m, f: p.figs[m.id] }).filter(Boolean);
  const sections = p.sections.map((s, i) => {
    const leads = (LEADS[s.id] ?? []).map((id) => s.figures.find((f) => f.id === id)).filter(Boolean);
    const rest = s.figures.filter((f) => !leads.includes(f));
    const sentences = leads.map((f) => [sentence(u, f), translate(u, f)].filter(Boolean).join(" "));
    // figures for a former unit, one note per unit: a different territory, never compared
    const former = [...new Set(s.former.map((f) => f.unit.slug))].map((fs_) => {
      const list = s.former.filter((f) => f.unit.slug === fs_), fu = list[0].unit;
      return `Before ${SEAM_TEXT(fu)}, the sources published figures for ${fu.name}, a different territory, so they are not compared with ${N}'s: ${list.map((f) => `${lowerFirst(f.measure.label)} ${figHTML(f.text, f.measure.fmt, f.src)} (${f.period})`).join("; ")}.`;
    });
    const none = !s.figures.length ? (WHY_NONE[s.id] && u.kind !== "state" ? WHY_NONE[s.id] : "The sources behind this section publish no figure for " + N + ".") : null;
    const missing = s.figures.length && s.missing.length ? `No figure for ${N}: ${s.missing.map((m) => lowerFirst(m.label)).join("; ")}. The source does not publish ${s.missing.length === 1 ? "it" : "them"} for this unit.` : null;
    return { ...s, no: String(i + 2).padStart(2, "0"), intro: SECTION_TEXT[s.id], sentences, rest, former, none, missing };
  });
  // neighbours and peers: the glance measures, each with its own period
  const compare = [slug, ...p.neighbours, ...p.peers.filter((x) => !p.neighbours.includes(x))].map((s) => ({ ...compareRow(s), self: s === slug, peer: p.peers.includes(s) }));
  // go deeper: every guide whose every-cut table holds a series naming this unit
  const rows = rowsForState(slug);
  const byGuide = new Map();
  for (const r of rows) { if (!byGuide.has(r.guide)) byGuide.set(r.guide, 0); byGuide.set(r.guide, byGuide.get(r.guide) + 1); }
  const deeper = DOSSIERS.filter((d) => byGuide.has(d.slug)).map((d) => ({ slug: d.slug, title: d.title, n: byGuide.get(d.slug) })).sort((a, b) => b.n - a.n);
  const sources = [...new Set(MEASURES.map((m) => m.bundle))].filter((b) => p.sections.some((s) => s.figures.some((f) => f.bundle === b))).map((b) => ({ bundle: b, source: load(b).meta?.source ?? "", vintage: load(b).meta?.vintage ?? "" }));
  const nFigs = p.sections.reduce((a, s) => a + s.figures.length, 0);
  const lede = p.figs.pc
    ? `How ${N} earns, spends, works, borrows, learns, falls ill and warms, set against India and its neighbours, in ${nFigs} figures from ${sources.length} official tables. Each figure carries its own year: states publish on different timetables.`
    : `How ${N} spends, works, borrows, learns and falls ill, set against India and its neighbours, in ${nFigs} figures from ${sources.length} official tables. MoSPI's state accounts do not cover it, so there is no income figure.`;
  return { p, u, N, kind: KIND[u.kind], glance, sections, compare, deeper, rows, sources, nFigs, lede, charts: charts(p), nameOf, industries: industriesOf(slug), districts: districtsOf(slug) };
}
const SEAM_TEXT = (fu) => ({ "ap-2014": "June 2014", "jk-2019": "October 2019", "dnhdd-2020": "January 2020" }[fu.seam]);

/* ---------- chart data (drawn by src/dossiers/profiles.client.js) ---------- */
const series = (bundle, key, { from, filter } = {}) => {
  const b = load(bundle), s = b.series[key];
  return b.dates.map((d, i) => [d, s.data[i]]).filter(([d, v]) => v != null && (!from || d >= from) && (!filter || filter(d)));
};
function charts(p) {
  const u = p.unit, slug = u.slug, out = { short: u.short ?? u.name };
  // where the state stands: every unit's value of each glance measure at the comparison period
  out.where = MEASURES.filter((m) => m.glance || m.where).map((m) => {
    const f = p.figs[m.id];
    if (!f) return null;
    const all = measureAll(m, f.iso);
    return { id: m.id, label: m.label, period: f.period, fmt: m.fmt, me: f.value, india: f.india?.same ? f.india.value : null,
      rows: all.map((x) => ({ s: x.short, v: x.v, me: x.slug === slug })) };
  }).filter(Boolean);
  // income per person over time, with the middle state of the fixed panel; the J&K state, a
  // different territory, as its own ruler
  if (p.figs.pc) {
    const m = BY_ID.pc, b = load(m.bundle);
    const mine = b.dates.map((d) => [d, valueAt(m, slug, d)]).filter(([, v]) => v != null);
    const former = [...cells(m).former].filter(([fs_]) => FORMER_BY_SLUG.get(fs_).successors.includes(slug)).map(([fs_, k]) => ({ label: FORMER_BY_SLUG.get(fs_).name, data: series(m.bundle, k) }));
    out.income = { mine: { label: u.name, data: mine }, median: { label: "The middle state of a fixed panel of 31", data: series("states-spread", "median_current") }, former };
  }
  // real growth each year, with India's GDP on the same base
  if (p.figs.growth) {
    const m = BY_ID.growth, b = load(m.bundle);
    const mine = b.dates.map((d) => [d, valueAt(m, slug, d)]).filter(([, v]) => v != null);
    const ind = load("gdp-annual-levels").dates.map((d) => [d, COMPUTE.growth([["gdp-annual-levels", "gdp_constant"]], d)]).filter(([, v]) => v != null);
    out.growth = { mine: { label: u.name, data: mine }, india: { label: "India's GDP", data: ind } };
  }
  // farm, industry, services against India, the same year
  const st = ["agri", "industry", "services"].map((id) => p.figs[id]).filter(Boolean);
  if (st.length === 3 && st.every((f) => f.india?.same)) out.structure = { period: st[0].period, rows: st.map((f) => ({ label: f.label.replace(/'s share of output$/, "").replace(/' share of output$/, ""), me: f.value, india: f.india.value })) };
  // prices on two rulers: CPI base 2012 to December 2025, base 2024 from January 2026
  {
    const m24 = BY_ID.cpi, k24 = cells(m24).cur.get(slug);
    const m12 = { id: "cpi2012", bundle: "cpi-states", pick: () => true };
    const k12 = cells(m12).cur.get(slug);
    if (k24 || k12) out.prices = {
      rulers: [
        k12 && { label: `${u.name}, base 2012`, data: series("cpi-states", k12) },
        k24 && { label: `${u.name}, base 2024`, data: series("cpi-2024-states", k24) },
      ].filter(Boolean),
      india: [{ label: "All India, base 2012", data: series("cpi", "headline", { from: "2016-01-01" }) }, { label: "All India, base 2024", data: series("cpi-2024", "headline") }],
    };
  }
  // work: unemployment, participation and work by gender, against India
  const wk = [["urW", "urM", "Unemployment rate"], ["lfprW", "lfprM", "In the labour force"], ["wprW", "wprM", "In work"]]
    .map(([w, mn, label]) => ({ label, w: p.figs[w], m: p.figs[mn] })).filter((r) => r.w && r.m);
  if (wk.length) out.work = { period: wk[0].w.period, rows: wk.flatMap((r) => [
    { label: r.label, who: "Women", me: r.w.value, india: r.w.india?.value ?? null },
    { label: r.label, who: "Men", me: r.m.value, india: r.m.india?.value ?? null }]) };
  // climate: the year's average temperature since 1950, against the state's 1951-1980 average
  if (p.figs.temp) {
    const m = BY_ID.temp;
    out.climate = { label: u.name, data: series(m.bundle, cells(m).cur.get(slug)), normal: p.figs.temp.normal?.value ?? null, span: p.figs.temp.normal?.span };
  }
  return out;
}

/* ---------- two tables: what the factories make, and the districts ---------- */
COMPUTE.ratioSum = ([num, den], iso) => {
  const s = (xs) => xs.reduce((a, [b, k]) => { const v = cellOf(b, k, iso); return a == null || v == null ? null : a + v; }, 0);
  const a = s(num), d = s(den);
  return a == null || !d ? null : (a / d) * 100;
};
const asiBundles = fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.startsWith("asi-state-nic2-")).map((f) => f.slice(0, -5));
// ASI by two-digit industry for one unit: the divisions' value added as a share of the
// state's factory value added (asi-states, the same survey and year), and persons engaged
export function industriesOf(slug, top = 8) {
  const b0 = asiBundles.find((b) => placeAll(b.slice(15).replace(/-/g, " "))[0]?.slug === slug);
  const tot = BY_ID.factoryGva, totKey = cells(tot).cur.get(slug);
  if (!b0 || !totKey) return null;
  const b = load(b0), T = load(tot.bundle);
  const code = (re) => Object.keys(b.series).map((k) => /^(i\d+)_/.exec(k)?.[1]).find((c) => c && re.test(b.series[Object.keys(b.series).find((k) => k.startsWith(c + "_"))].label));
  const gvaC = code(/^Gross Value Added ·/), pplC = code(/^Total Number of Persons Engaged ·/);
  const iso = T.dates.filter((d) => b.dates.includes(d) && cellOf(tot.bundle, totKey, d)).at(-1);
  if (!iso) return null;
  const total = cellOf(tot.bundle, totKey, iso);
  const rows = Object.entries(b.series).filter(([k]) => k.startsWith(gvaC + "_") && !/_9999[89]$/.test(k)).map(([k, s]) => {
    const v = cellOf(b0, k, iso);
    if (v == null || v <= 0) return null;
    const div = k.slice(gvaC.length + 1), pk = `${pplC}_${div}`;
    const name = s.label.split(" · ").at(-1).replace(/^\d+\s+/, "").replace(/^Manufacture of /, "");
    return { div, name, gva: { text: FMT.croreFromLakh(v), src: { op: "cell", args: [[b0, k]], iso }, fmt: "croreFromLakh" },
      share: { value: (v / total) * 100, text: FMT.pct1((v / total) * 100), src: { op: "ratio", args: [[b0, k], [tot.bundle, totKey]], iso }, fmt: "pct1" },
      people: b.series[pk] && cellOf(b0, pk, iso) != null ? { text: FMT.count(cellOf(b0, pk, iso)), src: { op: "cell", args: [[b0, pk]], iso }, fmt: "count" } : null, v };
  }).filter(Boolean).sort((x, y) => y.v - x.v);
  return { bundle: b0, period: periodLabel(b0, b, iso), rows: rows.slice(0, top), n: rows.length };
}
// every district of the unit, as on the latest 31 March both RBI tables have: deposits and
// credit (the sums of the rural, semi-urban, urban and metropolitan figures as published), the
// credit-deposit ratio of those sums, and women's share of bank credit to individuals
export function districtsOf(slug) {
  const D = load("deposits-districts"), C = load("credit-deep-bsr1a-districts"), Wm = load("credit-women-districts");
  const iso = D.dates.filter((d) => C.dates.includes(d)).at(-1);
  if (!iso) return null;
  const nk = (t) => normalise(t).replace(/ /g, "");
  const rows = new Map();
  const add = (name, field, b, k) => { const id = nk(name); if (!rows.has(id)) rows.set(id, { name, dep: [], cred: [], women: null }); rows.get(id)[field].push([b, k]); };
  for (const [k, s] of Object.entries(D.series)) {
    if (!k.endsWith("__amount")) continue;
    const parts = s.label.split(" · ");   // Deposits · State · District · Population group
    if (parts.length < 4 || placeFirst(parts[1]) !== slug || cellOf("deposits-districts", k, iso) == null) continue;
    add(parts[2], "dep", "deposits-districts", k);
  }
  for (const [k, s] of Object.entries(C.series)) {
    if (!k.endsWith("__amount")) continue;
    const parts = s.label.split(", ");   // State, District, Population group, credit outstanding
    if (parts.length < 4 || placeFirst(parts[0]) !== slug || cellOf("credit-deep-bsr1a-districts", k, iso) == null) continue;
    if (rows.has(nk(parts[1]))) add(parts[1], "cred", "credit-deep-bsr1a-districts", k);
  }
  const wIso = Wm.dates.includes(iso) ? iso : null;
  if (wIso) for (const [k, s] of Object.entries(Wm.series)) {
    if (!k.endsWith("__women_share")) continue;
    const m = /^([^:]+): (.+), women's share/.exec(s.label);
    if (!m || placeFirst(m[1]) !== slug) continue;
    const r = rows.get(nk(m[2]));
    if (r && cellOf("credit-women-districts", k, wIso) != null) r.women = { text: FMT.pct1(cellOf("credit-women-districts", k, wIso)), src: { op: "cell", args: [["credit-women-districts", k]], iso: wIso }, fmt: "pct1" };
  }
  const sum = (xs) => xs.reduce((a, [b, k]) => a + cellOf(b, k, iso), 0);
  const out = [...rows.values()].filter((r) => r.dep.length).map((r) => {
    const dep = sum(r.dep), cred = r.cred.length ? sum(r.cred) : null;
    const name = r.name.replace(/&/g, " and ").replace(/\s+/g, " ").trim().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(And|Of)\b/g, (w) => w.toLowerCase());
    return { name, depV: dep,
      dep: { text: FMT.lakhcrFromCrore(dep), src: { op: "sum", args: r.dep, iso }, fmt: "lakhcrFromCrore" },
      cred: cred != null ? { text: FMT.lakhcrFromCrore(cred), src: { op: "sum", args: r.cred, iso }, fmt: "lakhcrFromCrore" } : null,
      cd: cred != null && dep ? { text: FMT.pct1((cred / dep) * 100), src: { op: "ratioSum", args: [r.cred, r.dep], iso }, fmt: "pct1" } : null,
      women: r.women };
  }).sort((a, b) => b.depV - a.depV);
  return out.length ? { period: `31 March ${iso.slice(0, 4)}`, rows: out } : null;
}
