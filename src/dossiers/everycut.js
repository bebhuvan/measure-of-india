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
    };
    if (li >= 0) {
      const v = s.data[li], iso = b.dates[li];
      row.latest = v; row.latestText = minus(U.fmt(v)); row.period = periodLabel(slug, b, iso);
      if (TIMED.has(b.meta?.frequency)) {
        const j = b.dates.indexOf(yearEarlier(iso));
        const p = j >= 0 ? s.data[j] : null;
        if (p != null) {
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
