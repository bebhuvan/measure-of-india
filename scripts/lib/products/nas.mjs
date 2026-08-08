// scripts/lib/products/nas.mjs — National Accounts Statistics.
// Growth is computed from constant-price LEVELS — the API's growth-rate
// indicator is rounded to whole numbers and is unusable (kept only as a
// cross-check). Change in stocks and valuables swing sign, so their y/y is
// meaningless: they stay raw-only.
//
// Coverage notes from the API audit (2026-08):
//  - ic1 (GVA) and ic21 (GVA growth) carry an industry dimension quarterly:
//    8 industry groups + a Total row. Totals are pinned via industry_code
//    (15 = Total GVA, 17 = Total GVA growth) — never trusted to row order.
//  - Annual rows carry the full REVISION HISTORY (First Advance … Final);
//    the standing estimate per year is selected by explicit maturity rank,
//    matching the published tables.
//  - GNDI (19), other current transfers (18) and gross saving (20) are
//    published at CURRENT prices only (constant_price is "nan") — they are
//    nominal concepts. Saving is baked as a ratio to nominal GDP; the rest
//    stay raw-only in nas-nominal.json.
//  - The quarterly 2011-12-base series ends at Q2 FY26; from the Feb 2026
//    release quarters are published on base 2022-23 only. The new base is
//    baked as its OWN bundle (gdp-2022.json) — bases are never spliced.
//  - Per-capita product: served only state-wise (Regional account); there is
//    no national per-capita indicator — disclosed, not fabricated.

import { mospi } from "../mospi.mjs";
import { writeJson, writeRaw, yoyFromLevels, quarterAxis, round2 } from "../util.mjs";

// NAS revision labels by maturity; higher = more settled estimate.
const REVISION_RANK = {
  "First Advance Estimates": 1, "Second Advance Estimates": 2,
  "Provisional Estimates": 3, "First Revised Estimates": 4,
  "Second Revised Estimates": 5, "Third Revised Estimates": 6,
  "Final Estimates": 7, "Additional Revision": 8,
};

async function paged(endpoint, params) {
  const rows = [];
  for (let page = 1; ; page++) {
    const res = await mospi(endpoint, { ...params, page, limit: 500 });
    const batch = res.data ?? [];
    rows.push(...batch);
    if (batch.length < 500) break;
  }
  return rows;
}

const qKey = (r) => {
  const y0 = Number(r.year.slice(0, 4));
  const q = Number(String(r.quarter).replace("Q", ""));
  const month = ["04", "07", "10", "01"][q - 1];
  return `${q === 4 ? y0 + 1 : y0}-${month}`;
};

// Parse rows into quarterly/annual level maps for one price basis.
// Annual rows keep only the most mature revision per year.
function collect(rows, field) {
  const q = new Map(), a = new Map(), aRank = new Map();
  for (const r of rows) {
    const v = parseFloat(r[field]);
    if (!Number.isFinite(v)) continue;
    if (r.frequency === "Quarterly") q.set(qKey(r), v);
    else if (r.frequency === "Annual") {
      const ym = `${Number(r.year.slice(0, 4))}-04`;
      const rank = REVISION_RANK[r.revision] ?? 0;
      if (rank >= (aRank.get(ym) ?? -1)) { a.set(ym, v); aRank.set(ym, rank); }
    }
  }
  return { q, a };
}

export async function buildNas(root, dcfg, vintage) {
  const { params, indicators, industries, industry_totals, fetch2022 } = dcfg.fetch;
  const levels = {}; // key -> Map("YYYY-MM" quarter-start -> constant-price level)
  const annualLevels = {}; // key -> Map("YYYY-04" fiscal-year-start -> level)
  const curLevels = {}, curAnnual = {}; // current-price (nominal) mirrors
  for (const [code, key] of Object.entries(indicators)) {
    levels[key] = new Map(); annualLevels[key] = new Map();
    curLevels[key] = new Map(); curAnnual[key] = new Map();
    // ic1/ic21 have an industry dimension quarterly — pin the Total row
    const pin = industry_totals?.[code] != null ? { industry_code: industry_totals[code] } : {};
    // income-side indicators (GNI, NDP, saving, taxes…) are annual-only;
    // fetch quarterly first, fall back to annual
    for (const fc of [2, 1]) {
      const rows = await paged(dcfg.fetch.endpoint, { ...params, ...pin, frequency_code: fc, indicator_code: code });
      const con = collect(rows, "constant_price");
      const cur = collect(rows, "current_price");
      if (fc === 2) { levels[key] = con.q; curLevels[key] = cur.q; }
      else { annualLevels[key] = con.a; curAnnual[key] = cur.a; }
      // found this indicator's frequency (nominal-only indicators count too)
      if (con.q.size || con.a.size || cur.q.size || cur.a.size) break;
    }
    process.stdout.write(`nas indicator ${code} (${key}): ${levels[key].size} quarterly, ${annualLevels[key].size} annual (nominal ${curLevels[key].size}/${curAnnual[key].size})\n`);
  }
  // annual nominal GDP — needed for the saving rate; the quarterly fetch
  // satisfied ic5 above, so pull the annual rows explicitly
  const gdpAnnualRows = await paged(dcfg.fetch.endpoint, { ...params, frequency_code: 1, indicator_code: 5 });
  const gdpAnnualCur = collect(gdpAnnualRows, "current_price").a;
  const gdpAnnualCon = collect(gdpAnnualRows, "constant_price").a;

  const g = Object.fromEntries(Object.entries(levels).map(([k, m]) => [k, yoyFromLevels(m)]));

  const gdpMonths = [...g.gdp.keys()].sort();
  if (!gdpMonths.length) throw new Error("NAS: no data returned");
  const lastQ = gdpMonths[gdpMonths.length - 1];
  const axis = quarterAxis("2016-04", lastQ);
  const dates = axis.map((ym) => `${ym}-01`);
  const metaBase = {
    frequency: "quarterly", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    latestPeriod: lastQ,
    releaseDate: null, // recorded per-release in the dossier frontmatter
    revisionPolicy: dcfg.revision_policy,
  };
  const bundle = {
    meta: { dossier: "gdp", ...metaBase },
    dates,
    series: {
      gdp: { name: "gdp_real_yoy_pct", label: "GDP", color: "#BE3E26", data: axis.map((ym) => g.gdp.get(ym) ?? null) },
      gva: { name: "gva_real_yoy_pct", label: "GVA", color: "#5B564B", data: axis.map((ym) => g.gva.get(ym) ?? null) },
      pfce: { name: "pfce_real_yoy_pct", label: "Consumption", color: "#A8A293", data: axis.map((ym) => g.pfce.get(ym) ?? null) },
      gfcf: { name: "gfcf_real_yoy_pct", label: "Investment", color: "#8A857A", data: axis.map((ym) => g.gfcf.get(ym) ?? null) },
    },
  };
  // expenditure-side detail, same axis; stocks/valuables stay raw-only
  const exp = {
    meta: { dossier: "gdp", ...metaBase },
    dates,
    series: {
      gfce: { name: "gfce_real_yoy_pct", label: "Govt consumption", color: "#5B564B", data: axis.map((ym) => g.gfce.get(ym) ?? null) },
      exports: { name: "exports_real_yoy_pct", label: "Exports", color: "#A8A293", data: axis.map((ym) => g.exports.get(ym) ?? null) },
      imports: { name: "imports_real_yoy_pct", label: "Imports", color: "#C6C0B0", data: axis.map((ym) => g.imports.get(ym) ?? null) },
    },
  };
  // the wider accounts: income, saving and the tax wedge. These indicators
  // are published ANNUALLY (fiscal years, plotted at April of the first
  // year). Net RoW flows swing sign — raw-only like stocks.
  const ag = Object.fromEntries(Object.entries(annualLevels).map(([k, m]) => [k, yoyFromLevels(m)]));
  const aMonths = [...ag.gni.keys()].sort();
  const aAxis = [];
  if (aMonths.length) {
    for (let y = Number(aMonths[0].slice(0, 4)); y <= Number(aMonths.at(-1).slice(0, 4)); y++) aAxis.push(`${y}-04`);
  }
  const aSeries = {};
  const ACCOUNT_KEYS = [["ndp", "NDP", "#5B564B"], ["gni", "GNI", "#8A857A"], ["gndi", "GNDI", "#A8A293"], ["gross_saving", "Gross saving", "#C6C0B0"], ["taxes", "Taxes on products", "#5B564B"], ["subsidies", "Subsidies", "#8A857A"], ["cfc", "Capital consumption", "#A8A293"], ["gcf_industry", "Capital formation", "#C6C0B0"]];
  ACCOUNT_KEYS.forEach(([k, label, color]) => {
    if (!ag[k]?.size) return;
    aSeries[k] = { name: `${k}_real_yoy_pct`, label, color, data: aAxis.map((ym) => ag[k].get(ym) ?? null) };
  });
  // gross saving is published at current prices only — bake it as a share of
  // nominal GDP (a nominal-over-nominal ratio; the only honest form)
  {
    const sav = curAnnual.gross_saving ?? new Map();
    if (sav.size && gdpAnnualCur.size) {
      aSeries.saving_rate = {
        name: "gross_saving_pct_of_nominal_gdp", label: "Gross saving rate",
        color: "#C6C0B0", nominal: true,
        data: aAxis.map((ym) => {
          const s = sav.get(ym), y = gdpAnnualCur.get(ym);
          return s != null && y != null ? round2((s / y) * 100) : null;
        }),
      };
    }
  }
  const accounts = {
    meta: { dossier: "gdp", ...metaBase, frequency: "annual", latestPeriod: aMonths.at(-1) ?? null, coverage: "Annual (fiscal years); the income-side accounts are not published quarterly. saving_rate is gross saving over nominal GDP — saving is published at current prices only." },
    dates: aAxis.map((ym) => `${ym}-01`),
    series: aSeries,
  };
  // cross-checks: computed real y/y vs the API's whole-number growth indicators
  const nearest = (map, ym) => map.get(ym) ?? null;
  bundle.crosscheck = {
    gdp_growth_published: axis.map((ym) => nearest(levels.gdp_growth_published, ym)),
    gva_growth_published: axis.map((ym) => nearest(levels.gva_growth_published, ym)),
  };

  /* ---- industry-wise quarterly GVA (the release's 8-sector table) ---- */
  const SECTOR_META = {
    agriculture: ["Agriculture", "#5B564B"],
    mining: ["Mining & quarrying", "#8A857A"],
    manufacturing: ["Manufacturing", "#5B564B"],
    utilities: ["Utilities", "#8A857A"],
    construction: ["Construction", "#5B564B"],
    trade_transport: ["Trade, hotels & transport", "#8A857A"],
    finance_realty: ["Finance & real estate", "#5B564B"],
    public_admin: ["Public administration", "#8A857A"],
  };
  const indConst = {}, indCur = {}, indPub = {};
  for (const [code, key] of Object.entries(industries)) {
    const rows = await paged(dcfg.fetch.endpoint, { ...params, frequency_code: 2, indicator_code: 1, industry_code: code });
    indConst[key] = collect(rows, "constant_price").q;
    indCur[key] = collect(rows, "current_price").q;
    const pub = await paged(dcfg.fetch.endpoint, { ...params, frequency_code: 2, indicator_code: 21, industry_code: code });
    indPub[key] = collect(pub, "constant_price").q; // rounded whole-number y/y
    process.stdout.write(`nas industry ${code} (${key}): ${indConst[key].size} quarterly levels\n`);
  }
  const indG = Object.fromEntries(Object.entries(indConst).map(([k, m]) => [k, yoyFromLevels(m)]));
  // sector shares of nominal GVA over the last four published quarters —
  // shares are a current-price concept; labelled as such in meta
  const last4 = quarterAxis("2016-04", lastQ).slice(-4);
  const shareDen = last4.reduce((a, ym) => a + (curLevels.gva.get(ym) ?? 0), 0);
  const shares = {};
  for (const key of Object.keys(industries).map((c) => industries[c])) {
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
      return [key, { name: `gva_${key}_real_yoy_pct`, label, color, data: axis.map((ym) => indG[key].get(ym) ?? null) }];
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
      gdp_nominal: { name: "gdp_nominal_yoy_pct", label: "Nominal GDP", color: "#BE3E26", nominal: true, data: axis.map((ym) => gdpNomG.get(ym) ?? null) },
      gdp_real: { name: "gdp_real_yoy_pct", label: "Real GDP", color: "#5B564B", data: axis.map((ym) => g.gdp.get(ym) ?? null) },
      deflator: { name: "gdp_deflator_yoy_pct", label: "Deflator", color: "#A8A293", data: axis.map((ym) => deflG.get(ym) ?? null) },
    },
    // ic22's current_price field carries the published NOMINAL growth rate,
    // rounded to whole numbers — kept as the nominal cross-check
    crosscheck: { nominal_growth_published: axis.map((ym) => nearest(curLevels.gdp_growth_published, ym)) },
  };

  /* ---- the 2022-23 base: where the quarterly series continues ---- */
  const b22Const = {}, b22Cur = {}, b22Pub = {};
  for (const [code, key] of Object.entries(fetch2022.indicators)) {
    const totals22 = fetch2022.industry_totals ?? industry_totals;
    const pin = totals22?.[code] != null ? { industry_code: totals22[code] } : {};
    const rows = await paged(dcfg.fetch.endpoint, { ...params, ...pin, base_year: fetch2022.base_year, frequency_code: 2, indicator_code: code });
    b22Const[key] = collect(rows, "constant_price").q;
    b22Cur[key] = collect(rows, "current_price").q;
    process.stdout.write(`nas 2022-23 base ${code} (${key}): ${b22Const[key].size} quarterly levels\n`);
  }
  const g22 = Object.fromEntries(Object.entries(b22Const).map(([k, m]) => [k, yoyFromLevels(m)]));
  const months22 = [...(g22.gdp ?? new Map()).keys()].sort();
  if (!months22.length) throw new Error("NAS: 2022-23 base returned no growth quarters");
  const axis22 = quarterAxis(months22[0], months22.at(-1));
  const B22_KEYS = [["gdp", "GDP", "#BE3E26"], ["gva", "GVA", "#5B564B"], ["pfce", "Consumption", "#A8A293"], ["gfcf", "Investment", "#8A857A"]];
  const bundle22 = {
    meta: {
      dossier: "gdp", ...metaBase, base: fetch2022.base_year,
      latestPeriod: months22.at(-1),
      coverage: "The new 2022-23 base year. The 2011-12-base quarterly series ends at Q2 FY26; later quarters exist only here. Separate bundle — bases are never spliced.",
    },
    dates: axis22.map((ym) => `${ym}-01`),
    series: Object.fromEntries(B22_KEYS.map(([k, label, color]) => [
      k, { name: `${k}_real_yoy_pct_base2022`, label, color, data: axis22.map((ym) => g22[k].get(ym) ?? null) },
    ])),
    crosscheck: {
      gdp_growth_published: axis22.map((ym) => b22Const.gdp_growth_published?.get(ym) ?? null),
      gva_growth_published: axis22.map((ym) => b22Const.gva_growth_published?.get(ym) ?? null),
    },
  };

  /* ---- raw dumps: the audit trail ---- */
  const raw = { vintage, unit: "₹ crore, constant 2011-12 prices (growth indicators in per cent)", levels: {}, annual: {} };
  for (const [k, map] of Object.entries(levels)) raw.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(annualLevels)) raw.annual[k] = Object.fromEntries([...map.entries()].sort());
  writeRaw(root, "data/raw/nas-levels.json", raw);
  const rawNom = { vintage, unit: "₹ crore, current prices (growth indicators in per cent)", note: "NOMINAL mirror of nas-levels.json; GNDI, transfers and gross saving are published at current prices only", levels: {}, annual: {} };
  for (const [k, map] of Object.entries(curLevels)) if (map.size) rawNom.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(curAnnual)) if (map.size) rawNom.annual[k] = Object.fromEntries([...map.entries()].sort());
  rawNom.annual.gdp = Object.fromEntries([...gdpAnnualCur.entries()].sort());
  rawNom.annual_constant_gdp = Object.fromEntries([...gdpAnnualCon.entries()].sort());
  writeRaw(root, "data/raw/nas-nominal.json", rawNom);
  const rawInd = { vintage, base: dcfg.base, unit: "₹ crore (published growth in per cent)", constant: {}, current: {}, published_growth: {} };
  for (const [k, map] of Object.entries(indConst)) rawInd.constant[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(indCur)) rawInd.current[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(indPub)) rawInd.published_growth[k] = Object.fromEntries([...map.entries()].sort());
  writeRaw(root, "data/raw/nas-industries.json", rawInd);
  const raw22 = { vintage, base: fetch2022.base_year, unit: "₹ crore (published growth in per cent)", constant: {}, current: {} };
  for (const [k, map] of Object.entries(b22Const)) raw22.constant[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(b22Cur)) if (map.size) raw22.current[k] = Object.fromEntries([...map.entries()].sort());
  writeRaw(root, "data/raw/nas-2022-levels.json", raw22);

  writeJson(root, "data/series/gdp.json", bundle);
  writeJson(root, "data/series/gdp-expenditure.json", exp);
  writeJson(root, "data/series/gdp-accounts.json", accounts);
  writeJson(root, "data/series/gdp-industries.json", industriesBundle);
  writeJson(root, "data/series/gdp-nominal.json", nominalBundle);
  writeJson(root, "data/series/gdp-2022.json", bundle22);
  return bundle;
}
