// scripts/lib/products/nas.mjs — National Accounts Statistics.
// Growth is computed from constant-price LEVELS — the API's growth-rate
// indicator was rounded to whole numbers (one decimal since the 2026-10
// revision, seen 2026-10-09) and is kept only as a cross-check. Change in stocks and valuables swing sign, so their y/y is
// meaningless: they stay raw-only.
//
// Coverage notes from the API audit (2026-08, re-checked 2026-10-09):
//  - ic1 (GVA) and ic21 (GVA growth) carry an industry dimension quarterly:
//    8 industry groups + a Total row. Totals are pinned via industry_code
//    (15 = Total GVA; ic21's Total is 17 on base 2011-12, 15 on 2022-23) —
//    never trusted to row order. Industry codes 1-15 are the same on both bases.
//  - Annual rows carry the full REVISION HISTORY (First Advance … Final);
//    the standing estimate per year is selected by explicit maturity rank,
//    matching the published tables.
//  - GNDI (19), other current transfers (18) and gross saving (20) are
//    published at CURRENT prices only (constant_price is "nan") — they are
//    nominal concepts. Saving is baked as a ratio to nominal GDP; the rest
//    stay raw-only in the nominal raw dump.
//  - THE TWO BASES are built by the same function (buildBase) into separate
//    bundle sets: gdp*.json on 2011-12 (quarterly to Q2 FY26, then frozen) and
//    gdp-2022*.json on 2022-23 (the live series). Bases are never spliced.
//  - THE BACK SERIES (series=Back, base 2011-12, annual 1950-51 to 2011-12) is
//    the NSO's own back-cast. It is baked as its own bundle (gdp-back.json) and
//    registered as an agency bridge in sources.yml `seams`; it is never joined
//    to the current series. It serves no taxes, subsidies or growth indicators.
//  - Per-capita product: served only state-wise (Regional account); there is
//    no national per-capita indicator — disclosed, not fabricated.

import { mospiAll } from "../mospi.mjs";
import { writeSeries, writeRaw, yoyFromLevels, quarterAxis, round2 } from "../util.mjs";

// NAS revision labels by maturity; higher = more settled estimate.
const REVISION_RANK = {
  "First Advance Estimates": 1, "Second Advance Estimates": 2,
  "Provisional Estimates": 3, "First Revised Estimates": 4,
  "Second Revised Estimates": 5, "Third Revised Estimates": 6,
  "Final Estimates": 7, "Additional Revision": 8,
};

const paged = (endpoint, params) => mospiAll(endpoint, params);

const qKey = (r) => {
  const y0 = Number(r.year.slice(0, 4));
  const q = Number(String(r.quarter).replace("Q", ""));
  const month = ["04", "07", "10", "01"][q - 1];
  return `${q === 4 ? y0 + 1 : y0}-${month}`;
};

// Parse rows into quarterly/annual level maps for one price basis.
// Annual rows keep only the most mature revision per year (Back-series rows
// carry no revision: rank 0, one row per year).
function collect(rows, field) {
  const q = new Map(), a = new Map(), aRank = new Map();
  for (const r of rows) {
    const v = parseFloat(r[field]);
    if (!Number.isFinite(v)) continue;
    if (r.frequency === "Quarterly") q.set(qKey(r), v);
    else if (r.frequency === "Annual") {
      // financial-year labels only: "2011-12" or "1999-2000", consecutive years.
      // Anything else is a source defect (a GNDI row labelled "1999" carries a
      // 2025-26-sized value) and is skipped, never filed under a wrong year.
      const fy = String(r.year).match(/^(\d{4})-(\d{2}|\d{4})$/);
      if (!fy || (Number(fy[1]) + 1) % (fy[2].length === 2 ? 100 : 10000) !== Number(fy[2])) continue;
      const ym = `${Number(r.year.slice(0, 4))}-04`;
      const rank = REVISION_RANK[r.revision] ?? 0;
      if (rank >= (aRank.get(ym) ?? -1)) { a.set(ym, v); aRank.set(ym, rank); }
    }
  }
  return { q, a };
}

const SECTOR_META = {
  agriculture: ["Agriculture", "#5F6675"],
  mining: ["Mining & quarrying", "#878D99"],
  manufacturing: ["Manufacturing", "#5F6675"],
  utilities: ["Utilities", "#878D99"],
  construction: ["Construction", "#5F6675"],
  trade_transport: ["Trade, hotels & transport", "#878D99"],
  finance_realty: ["Finance & real estate", "#5F6675"],
  public_admin: ["Public administration", "#878D99"],
};
const ACCOUNT_KEYS = [["ndp", "NDP", "#5F6675"], ["gni", "GNI", "#878D99"], ["gndi", "GNDI", "#A3A9B4"], ["gross_saving", "Gross saving", "#C9CED6"], ["taxes", "Taxes on products", "#5F6675"], ["subsidies", "Subsidies", "#878D99"], ["cfc", "Capital consumption", "#A3A9B4"], ["gcf_industry", "Capital formation", "#C9CED6"]];

// One base, the full bundle set. `b` describes the base:
//   { base_year, base, indicators, industry_totals, axisStart (quarter "YYYY-MM"
//     or null = first quarter with a same-base year-ago level), nameSuffix,
//     slug: (name) -> bundle slug, rawPrefix, headCoverage }
async function buildBase(root, dcfg, vintage, b) {
  const { params, industries } = dcfg.fetch;
  const P = { ...params, base_year: b.base_year };
  const levels = {}, annualLevels = {}, curLevels = {}, curAnnual = {};
  for (const [code, key] of Object.entries(b.indicators)) {
    levels[key] = new Map(); annualLevels[key] = new Map();
    curLevels[key] = new Map(); curAnnual[key] = new Map();
    // ic1/ic21 have an industry dimension quarterly — pin the Total row
    const pin = b.industry_totals?.[code] != null ? { industry_code: b.industry_totals[code] } : {};
    // income-side indicators (GNI, NDP, saving, taxes…) are annual-only;
    // fetch quarterly first, fall back to annual
    for (const fc of [2, 1]) {
      const rows = await paged(dcfg.fetch.endpoint, { ...P, ...pin, frequency_code: fc, indicator_code: code });
      const con = collect(rows, "constant_price");
      const cur = collect(rows, "current_price");
      if (fc === 2) { levels[key] = con.q; curLevels[key] = cur.q; }
      else { annualLevels[key] = con.a; curAnnual[key] = cur.a; }
      // found this indicator's frequency (nominal-only indicators count too)
      if (con.q.size || con.a.size || cur.q.size || cur.a.size) break;
    }
    process.stdout.write(`nas ${b.base_year} indicator ${code} (${key}): ${levels[key].size} quarterly, ${annualLevels[key].size} annual (nominal ${curLevels[key].size}/${curAnnual[key].size})\n`);
  }
  // annual nominal GDP — needed for the saving rate; the quarterly fetch
  // satisfied ic5 above, so pull the annual rows explicitly
  const gdpAnnualRows = await paged(dcfg.fetch.endpoint, { ...P, frequency_code: 1, indicator_code: 5 });
  const gdpAnnualCur = collect(gdpAnnualRows, "current_price").a;
  const gdpAnnualCon = collect(gdpAnnualRows, "constant_price").a;

  const g = Object.fromEntries(Object.entries(levels).map(([k, m]) => [k, yoyFromLevels(m)]));
  const gdpMonths = [...g.gdp.keys()].sort();
  if (!gdpMonths.length) throw new Error(`NAS ${b.base_year}: no GDP growth quarters returned`);
  const lastQ = gdpMonths.at(-1);
  const axis = quarterAxis(b.axisStart ?? gdpMonths[0], lastQ);
  const dates = axis.map((ym) => `${ym}-01`);
  const at = (map, ym) => map?.get(ym) ?? null;
  const metaBase = {
    frequency: "quarterly", base: b.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: lastQ,
    releaseDate: null, // recorded per-release in the dossier frontmatter
    revisionPolicy: dcfg.revision_policy,
  };
  const S = (k, label, color, map, extra = {}) => ({ name: `${k}_real_yoy_pct${b.nameSuffix}`, label, color, ...extra, data: axis.map((ym) => at(map, ym)) });

  const bundle = {
    meta: { dossier: "gdp", ...metaBase, ...(b.headCoverage ? { coverage: b.headCoverage } : {}) },
    dates,
    series: {
      gdp: S("gdp", "GDP", "#2E4BD8", g.gdp),
      gva: S("gva", "GVA", "#5F6675", g.gva),
      pfce: S("pfce", "Consumption", "#A3A9B4", g.pfce),
      gfcf: S("gfcf", "Investment", "#878D99", g.gfcf),
    },
    // cross-checks: computed real y/y vs the API's whole-number growth indicators
    crosscheck: {
      gdp_growth_published: axis.map((ym) => at(levels.gdp_growth_published, ym)),
      gva_growth_published: axis.map((ym) => at(levels.gva_growth_published, ym)),
    },
  };
  // expenditure-side detail, same axis; stocks/valuables stay raw-only
  const exp = {
    meta: { dossier: "gdp", ...metaBase },
    dates,
    series: {
      gfce: S("gfce", "Govt consumption", "#5F6675", g.gfce),
      exports: S("exports", "Exports", "#A3A9B4", g.exports),
      imports: S("imports", "Imports", "#C9CED6", g.imports),
    },
  };

  // the wider accounts: income, saving and the tax wedge. These indicators
  // are published ANNUALLY (fiscal years, plotted at April of the first
  // year). Net RoW flows swing sign — raw-only like stocks.
  const ag = Object.fromEntries(Object.entries(annualLevels).map(([k, m]) => [k, yoyFromLevels(m)]));
  const aMonths = [...(ag.gni?.keys() ?? [])].sort();
  const aAxis = [];
  if (aMonths.length) for (let y = Number(aMonths[0].slice(0, 4)); y <= Number(aMonths.at(-1).slice(0, 4)); y++) aAxis.push(`${y}-04`);
  const aSeries = {};
  // annual real GDP growth (fiscal years), from the annual constant-price
  // levels: the yardstick the back series is read against
  {
    const gA = yoyFromLevels(gdpAnnualCon);
    if (gA.size) aSeries.gdp = { name: `gdp_annual_real_yoy_pct${b.nameSuffix}`, label: "GDP, fiscal year", color: "#2E4BD8", data: aAxis.map((ym) => gA.get(ym) ?? null) };
  }
  ACCOUNT_KEYS.forEach(([k, label, color]) => {
    if (!ag[k]?.size) return;
    aSeries[k] = { name: `${k}_real_yoy_pct${b.nameSuffix}`, label, color, data: aAxis.map((ym) => ag[k].get(ym) ?? null) };
  });
  // gross saving is published at current prices only — bake it as a share of
  // nominal GDP (a nominal-over-nominal ratio; the only honest form)
  const sav = curAnnual.gross_saving ?? new Map();
  if (sav.size && gdpAnnualCur.size) {
    aSeries.saving_rate = {
      name: `gross_saving_pct_of_nominal_gdp${b.nameSuffix}`, label: "Gross saving rate",
      color: "#C9CED6", nominal: true,
      data: aAxis.map((ym) => {
        const s = sav.get(ym), y = gdpAnnualCur.get(ym);
        return s != null && y != null ? round2((s / y) * 100) : null;
      }),
    };
  }
  const accounts = {
    meta: { dossier: "gdp", ...metaBase, frequency: "annual", latestPeriod: aMonths.at(-1) ?? null, coverage: "Annual (fiscal years); the income-side accounts are not published quarterly. saving_rate is gross saving over nominal GDP — saving is published at current prices only." },
    dates: aAxis.map((ym) => `${ym}-01`),
    series: aSeries,
  };

  /* ---- industry-wise quarterly GVA (the release's 8-sector table) ---- */
  const indConst = {}, indCur = {}, indPub = {};
  for (const [code, key] of Object.entries(industries)) {
    const rows = await paged(dcfg.fetch.endpoint, { ...P, frequency_code: 2, indicator_code: 1, industry_code: code });
    indConst[key] = collect(rows, "constant_price").q;
    indCur[key] = collect(rows, "current_price").q;
    const pub = await paged(dcfg.fetch.endpoint, { ...P, frequency_code: 2, indicator_code: 21, industry_code: code });
    indPub[key] = collect(pub, "constant_price").q; // rounded whole-number y/y
    process.stdout.write(`nas ${b.base_year} industry ${code} (${key}): ${indConst[key].size} quarterly levels\n`);
  }
  const indG = Object.fromEntries(Object.entries(indConst).map(([k, m]) => [k, yoyFromLevels(m)]));
  // sector shares of nominal GVA over the last four published quarters —
  // shares are a current-price concept; labelled as such in meta
  const last4 = axis.slice(-4);
  const shareDen = last4.reduce((a, ym) => a + (curLevels.gva.get(ym) ?? 0), 0);
  const shares = {};
  for (const key of Object.values(industries)) {
    const num = last4.reduce((a, ym) => a + (indCur[key].get(ym) ?? 0), 0);
    shares[key] = shareDen ? round2((num / shareDen) * 100) : null;
  }
  const industriesBundle = {
    meta: {
      dossier: "gdp", ...metaBase,
      coverage: "All-India, real GVA by the 8 NAS industry groups; shares are of NOMINAL GVA, summed over the last four published quarters",
      sharesBasis: `nominal GVA, ${last4[0]}..${last4.at(-1)}`,
    },
    dates,
    series: Object.fromEntries(Object.values(industries).map((key) => {
      const [label, color] = SECTOR_META[key];
      return [key, { name: `gva_${key}_real_yoy_pct${b.nameSuffix}`, label, color, data: axis.map((ym) => indG[key].get(ym) ?? null) }];
    })),
    shares,
    crosscheck: Object.fromEntries(Object.values(industries).map((key) => [
      `${key}_growth_published`, axis.map((ym) => indPub[key].get(ym) ?? null),
    ])),
  };

  /* ---- the deflator wedge: nominal vs real GDP, implied deflator ---- */
  const gdpNomG = yoyFromLevels(curLevels.gdp);
  const deflLevels = new Map();
  for (const [ym, cur] of curLevels.gdp) {
    const con = levels.gdp.get(ym);
    if (con) deflLevels.set(ym, cur / con);
  }
  const deflG = yoyFromLevels(deflLevels);
  const nominalBundle = {
    meta: {
      dossier: "gdp", ...metaBase,
      coverage: "Nominal (current-price) GDP against real; the deflator is implied — current-price level over constant-price level",
      note: "gdp_nominal is a NOMINAL series. The deflator is not an independent index: it is the ratio of the two GDP levels.",
    },
    dates,
    series: {
      gdp_nominal: { name: `gdp_nominal_yoy_pct${b.nameSuffix}`, label: "Nominal GDP", color: "#2E4BD8", nominal: true, data: axis.map((ym) => gdpNomG.get(ym) ?? null) },
      gdp_real: { name: `gdp_real_yoy_pct${b.nameSuffix}`, label: "Real GDP", color: "#5F6675", data: axis.map((ym) => g.gdp.get(ym) ?? null) },
      deflator: { name: `gdp_deflator_yoy_pct${b.nameSuffix}`, label: "Deflator", color: "#A3A9B4", data: axis.map((ym) => deflG.get(ym) ?? null) },
    },
    // ic22's current_price field carries the published NOMINAL growth rate,
    // rounded to whole numbers — kept as the nominal cross-check
    crosscheck: { nominal_growth_published: axis.map((ym) => at(curLevels.gdp_growth_published, ym)) },
  };

  /* ---- raw dumps: the audit trail ---- */
  const raw = { vintage, unit: `₹ crore, constant ${b.base_year} prices (growth indicators in per cent)`, levels: {}, annual: {} };
  for (const [k, map] of Object.entries(levels)) raw.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(annualLevels)) raw.annual[k] = Object.fromEntries([...map.entries()].sort());
  writeRaw(root, `data/raw/${b.rawPrefix}-levels.json`, raw);
  const rawNom = { vintage, unit: "₹ crore, current prices (growth indicators in per cent)", note: `NOMINAL mirror of ${b.rawPrefix}-levels.json; GNDI, transfers and gross saving are published at current prices only`, levels: {}, annual: {} };
  for (const [k, map] of Object.entries(curLevels)) if (map.size) rawNom.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(curAnnual)) if (map.size) rawNom.annual[k] = Object.fromEntries([...map.entries()].sort());
  rawNom.annual.gdp = Object.fromEntries([...gdpAnnualCur.entries()].sort());
  rawNom.annual_constant_gdp = Object.fromEntries([...gdpAnnualCon.entries()].sort());
  writeRaw(root, `data/raw/${b.rawPrefix}-nominal.json`, rawNom);
  const rawInd = { vintage, base: b.base, unit: "₹ crore (published growth in per cent)", constant: {}, current: {}, published_growth: {} };
  for (const [k, map] of Object.entries(indConst)) rawInd.constant[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(indCur)) rawInd.current[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(indPub)) rawInd.published_growth[k] = Object.fromEntries([...map.entries()].sort());
  writeRaw(root, `data/raw/${b.rawPrefix}-industries.json`, rawInd);

  writeSeries(root, `data/series/${b.slug("")}.json`, bundle);
  writeSeries(root, `data/series/${b.slug("expenditure")}.json`, exp);
  writeSeries(root, `data/series/${b.slug("accounts")}.json`, accounts);
  writeSeries(root, `data/series/${b.slug("industries")}.json`, industriesBundle);
  writeSeries(root, `data/series/${b.slug("nominal")}.json`, nominalBundle);
  return bundle;
}

/* ---- the NSO back series, 1950-51 to 2011-12, at 2011-12 prices ----
 * Annual only. Growth from constant-price levels; the saving rate as a share
 * of nominal GDP. The NSO publishes this back-cast itself: it is a bridge,
 * not a base, and never enters the current series. */
async function buildBack(root, dcfg, vintage) {
  const bk = dcfg.fetch.back;
  const P = { ...dcfg.fetch.params, base_year: bk.base_year, series: "Back", frequency_code: 1 };
  const con = {}, cur = {};
  for (const [code, key] of Object.entries(bk.indicators)) {
    const pin = bk.industry_totals?.[code] != null ? { industry_code: bk.industry_totals[code] } : {};
    const rows = await paged(dcfg.fetch.endpoint, { ...P, ...pin, indicator_code: code });
    con[key] = collect(rows, "constant_price").a;
    cur[key] = collect(rows, "current_price").a;
    process.stdout.write(`nas back ${code} (${key}): ${con[key].size} constant, ${cur[key].size} current years\n`);
  }
  const indCon = {};
  for (const [code, key] of Object.entries(bk.industries ?? {})) {
    const rows = await paged(dcfg.fetch.endpoint, { ...P, indicator_code: 1, industry_code: code });
    indCon[key] = collect(rows, "constant_price").a;
    process.stdout.write(`nas back industry ${code} (${key}): ${indCon[key].size} years\n`);
  }
  const years = [...con.gdp.keys()].sort();
  if (!years.length) throw new Error("NAS back series: no GDP years returned");
  const aAxis = []; for (let y = Number(years[0].slice(0, 4)) + 1; y <= Number(years.at(-1).slice(0, 4)); y++) aAxis.push(`${y}-04`);
  const yy = (m) => { const g = yoyFromLevels(m); return aAxis.map((ym) => g.get(ym) ?? null); };
  const series = {
    gdp: { name: "gdp_real_yoy_pct_back", label: "GDP", color: "#2E4BD8", data: yy(con.gdp) },
    gva: { name: "gva_real_yoy_pct_back", label: "GVA", color: "#5F6675", data: yy(con.gva) },
    pfce: { name: "pfce_real_yoy_pct_back", label: "Consumption", color: "#A3A9B4", data: yy(con.pfce) },
    gfcf: { name: "gfcf_real_yoy_pct_back", label: "Investment", color: "#878D99", data: yy(con.gfcf) },
    gfce: { name: "gfce_real_yoy_pct_back", label: "Govt consumption", color: "#C9CED6", data: yy(con.gfce) },
  };
  // shares of nominal GDP: investment and saving rates, the structural story
  const ratio = (num) => aAxis.map((ym) => { const n = cur[num]?.get(ym), d = cur.gdp.get(ym); return n != null && d ? round2((n / d) * 100) : null; });
  if (cur.gross_saving?.size) series.saving_rate = { name: "gross_saving_pct_of_nominal_gdp_back", label: "Gross saving rate", color: "#C9CED6", nominal: true, data: ratio("gross_saving") };
  if (cur.gfcf?.size) series.gfcf_rate = { name: "gfcf_pct_of_nominal_gdp_back", label: "Investment rate", color: "#878D99", nominal: true, data: ratio("gfcf") };
  // the economy's make-up: sector shares of nominal GVA would need current
  // prices by industry; constant-price shares are not a share of anything,
  // so the industry detail is baked as real growth
  const IND_LABEL = {
    agriculture: "Agriculture", mining: "Mining & quarrying", manufacturing: "Manufacturing",
    utilities: "Utilities", construction: "Construction", trade_hotels: "Trade, hotels & restaurants",
    transport: "Transport & communication", finance: "Financial services",
    realty: "Real estate & professional services", public_admin: "Public administration & defence",
    other_services: "Other services",
  };
  for (const [key, m] of Object.entries(indCon)) series[`gva_${key}`] = { name: `gva_${key}_real_yoy_pct_back`, label: IND_LABEL[key] ?? key, color: "#A3A9B4", data: yy(m) };
  // interior nulls disclosed per series (CONTRACT-series rule 2)
  const dates = aAxis.map((ym) => `${ym}-01`);
  for (const s of Object.values(series)) {
    const first = s.data.findIndex((v) => v != null);
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = first < 0 ? [] : dates.filter((d, j) => j > first && j < last && s.data[j] == null);
    if (gaps.length) s.gaps = gaps;
  }
  const bundle = {
    meta: {
      dossier: "gdp", frequency: "annual", base: bk.base,
      source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
      latestPeriod: aAxis.at(-1), releaseDate: null,
      coverage: "The NSO's back series: All India, annual, fiscal years 1951-52 to 2011-12 (growth needs the year before, so 1950-51 is a level only), at 2011-12 prices",
      note: "The NSO's own back-cast of the national accounts onto the 2011-12 base. Real growth is computed from constant-price levels; saving and investment rates are shares of nominal GDP. A separate bundle: it is never joined to the current 2011-12 or 2022-23 series.",
      revisionPolicy: "Back series as published by the NSO; it may be restated.",
    },
    dates,
    series,
  };
  const raw = { vintage, unit: "₹ crore", series: "Back", base: bk.base_year, constant: {}, current: {}, industries_constant: {} };
  for (const [k, m] of Object.entries(con)) raw.constant[k] = Object.fromEntries([...m.entries()].sort());
  for (const [k, m] of Object.entries(cur)) if (m.size) raw.current[k] = Object.fromEntries([...m.entries()].sort());
  for (const [k, m] of Object.entries(indCon)) raw.industries_constant[k] = Object.fromEntries([...m.entries()].sort());
  writeRaw(root, "data/raw/nas-back-levels.json", raw);
  writeSeries(root, "data/series/gdp-back.json", bundle);
}

export async function buildNas(root, dcfg, vintage) {
  const { fetch2022 } = dcfg.fetch;
  // base 2011-12: the retired quarterly series (to Q2 FY26), from Apr 2016
  const bundle = await buildBase(root, dcfg, vintage, {
    base_year: dcfg.fetch.params.base_year, base: dcfg.base,
    indicators: dcfg.fetch.indicators, industry_totals: dcfg.fetch.industry_totals,
    axisStart: "2016-04", nameSuffix: "", rawPrefix: "nas",
    slug: (n) => (n ? `gdp-${n}` : "gdp"),
  });
  // base 2022-23: the live series, the full set from its first growth quarter
  await buildBase(root, dcfg, vintage, {
    base_year: fetch2022.base_year, base: fetch2022.base_year,
    indicators: fetch2022.indicators, industry_totals: fetch2022.industry_totals ?? dcfg.fetch.industry_totals,
    axisStart: null, nameSuffix: "_base2022", rawPrefix: "nas-2022",
    slug: (n) => (n ? `gdp-2022-${n}` : "gdp-2022"),
    headCoverage: "The new 2022-23 base year. The 2011-12-base quarterly series ends at Q2 FY26; later quarters exist only here. Separate bundle — bases are never spliced.",
  });
  if (dcfg.fetch.back) await buildBack(root, dcfg, vintage);
  return bundle;
}
