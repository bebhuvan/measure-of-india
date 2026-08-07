// scripts/lib/products/nas.mjs — National Accounts Statistics, quarterly.
// Growth is computed from constant-price LEVELS — the API's growth-rate
// indicator is rounded to whole numbers and is unusable. Change in stocks and
// valuables swing sign, so their y/y is meaningless: they stay raw-only.

import { mospi } from "../mospi.mjs";
import { writeJson, writeRaw, yoyFromLevels, quarterAxis } from "../util.mjs";

export async function buildNas(root, dcfg, vintage) {
  const { params, indicators } = dcfg.fetch;
  const levels = {}; // key -> Map("YYYY-MM" quarter-start -> constant-price level)
  const annualLevels = {}; // key -> Map("YYYY-04" fiscal-year-start -> level)
  for (const [code, key] of Object.entries(indicators)) {
    levels[key] = new Map();
    annualLevels[key] = new Map();
    // income-side indicators (GNI, NDP, saving, taxes…) are annual-only;
    // fetch quarterly first, fall back to annual
    for (const fc of [2, 1]) {
      let page = 1;
      for (;;) {
        const res = await mospi(dcfg.fetch.endpoint, {
          ...params, frequency_code: fc, indicator_code: code, page, limit: 500,
        });
        const rows = res.data ?? [];
        for (const r of rows) {
          const v = parseFloat(r.constant_price);
          if (!Number.isFinite(v)) continue;
          if (r.frequency === "Quarterly") {
            const y0 = Number(r.year.slice(0, 4));
            const q = Number(String(r.quarter).replace("Q", ""));
            const month = ["04", "07", "10", "01"][q - 1];
            const yr = q === 4 ? y0 + 1 : y0;
            levels[key].set(`${yr}-${month}`, v);
          } else if (r.frequency === "Annual") {
            annualLevels[key].set(`${Number(r.year.slice(0, 4))}-04`, v);
          }
        }
        if (rows.length < 500) break;
        page++;
      }
      if (levels[key].size || annualLevels[key].size) break; // found this indicator's frequency
    }
    process.stdout.write(`nas indicator ${code} (${key}): ${levels[key].size} quarterly, ${annualLevels[key].size} annual\n`);
  }

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
  const accounts = {
    meta: { dossier: "gdp", ...metaBase, frequency: "annual", latestPeriod: aMonths.at(-1) ?? null, coverage: "Annual (fiscal years); the income-side accounts are not published quarterly" },
    dates: aAxis.map((ym) => `${ym}-01`),
    series: aSeries,
  };
  // cross-checks: computed real y/y vs the API's whole-number growth indicators
  const nearest = (map, ym) => map.get(ym) ?? null;
  bundle.crosscheck = {
    gdp_growth_published: axis.map((ym) => nearest(levels.gdp_growth_published, ym)),
    gva_growth_published: axis.map((ym) => nearest(levels.gva_growth_published, ym)),
  };
  const raw = { vintage, unit: "₹ crore, constant 2011-12 prices (growth indicators in per cent)", levels: {}, annual: {} };
  for (const [k, map] of Object.entries(levels)) raw.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, map] of Object.entries(annualLevels)) raw.annual[k] = Object.fromEntries([...map.entries()].sort());
  writeRaw(root, "data/raw/nas-levels.json", raw);
  writeJson(root, "data/series/gdp.json", bundle);
  writeJson(root, "data/series/gdp-expenditure.json", exp);
  writeJson(root, "data/series/gdp-accounts.json", accounts);
  return bundle;
}
