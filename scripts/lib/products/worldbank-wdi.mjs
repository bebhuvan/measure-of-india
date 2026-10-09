// scripts/lib/products/worldbank-wdi.mjs — World Bank, World Development
// Indicators (API v2). The first non-MoSPI adapter: calendar years, ISO3
// geography, history that WDI revises freely.
//
// Config (data/sources.yml): dcfg.fetch.bundles is a map of
//   <bundle-slug>: { note, indicators: { <WDI code>: <series key> } }
// Each bundle gets ONE continuous annual axis ("YYYY-01-01") spanning the
// bundle's indicators, which must share the axis's last year (a bundle whose
// members end in different years is a config error — split it; trailing
// nulls are forbidden by CONTRACT-series rule 2).
//
// meta.vintage is the WDI database's own lastupdated stamp (from
// sources/2), not the fetch date — WDI revises history, and the vintage
// must move when the data does.

import { wb } from "../worldbank.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

// display metadata per series key — the page palette, assigned at bake time
// (CONTRACT-series). Accent is reserved for the primary series of a bundle.
const SERIES_META = {
  mva_pct_gdp: { label: "Manufacturing value added", unit: "pct_gdp", color: "#2E4BD8" },
  industry_pct_gdp: { label: "Industry, including construction", unit: "pct_gdp", color: "#878D99" },
  mva_constant_usd: { label: "Manufacturing value added, constant 2015 US$", unit: "usd_constant_2015", color: "#5F6675" },
  mva_growth: { label: "Manufacturing value added, annual growth", unit: "pct_yoy", color: "#A3A9B4" },
  machinery_transport: { label: "Machinery & transport equipment", unit: "pct_of_mva", color: "#2E4BD8" },
  chemicals: { label: "Chemicals", unit: "pct_of_mva", color: "#5F6675" },
  food_beverages_tobacco: { label: "Food, beverages & tobacco", unit: "pct_of_mva", color: "#878D99" },
  textiles_clothing: { label: "Textiles & clothing", unit: "pct_of_mva", color: "#A3A9B4" },
  other: { label: "Other manufacturing", unit: "pct_of_mva", color: "#C9CED6" },
  medhi_tech_share: { label: "Medium- & high-tech share of manufacturing", unit: "pct_of_mva", color: "#2E4BD8" },
  manufactures_share_of_exports: { label: "Manufactures' share of merchandise exports", unit: "pct_of_exports", color: "#2E4BD8" },
};

export async function buildWorldbankWdi(root, dcfg, vintage) {
  // the WDI database's own stamp — the data vintage, not the fetch date
  const src = await wb("sources/2");
  const wdiVintage = src[0]?.lastupdated ?? vintage;

  let newest = "";
  const raw = { vintage: wdiVintage, note: "World Development Indicators via World Bank API v2, country IND. One array per indicator code, as served (newest first).", indicators: {} };
  const bundles = {};

  for (const [bundleSlug, bcfg] of Object.entries(dcfg.fetch.bundles)) {
    const perSeries = {};   // seriesKey -> Map(year -> value)
    let firstYear = Infinity, lastYear = -Infinity;

    for (const [code, key] of Object.entries(bcfg.indicators)) {
      const rows = await wb(`country/IND/indicator/${code}`);
      raw.indicators[code] = rows;
      // each indicator's envelope carries its own lastupdated; the source-level stamp
      // (sources/2) lags indicator updates (2026-10-09: 07-13 vs 10-08), so the newest wins
      if (rows.lastupdated && rows.lastupdated > newest) newest = rows.lastupdated;
      const m = new Map();
      for (const r of rows) {
        if (r.value == null) continue;
        m.set(Number(r.date), r.value);
      }
      // anchor assertion (mandatory): a 200-OK-but-empty response never bakes
      if (!m.size) throw new Error(`worldbank-wdi: no data returned for ${code} (${key}) — anchor assertion failed`);
      perSeries[key] = m;
      firstYear = Math.min(firstYear, ...m.keys());
      lastYear = Math.max(lastYear, ...m.keys());
    }

    // every indicator in a bundle must end on the axis's last year — a ragged
    // bundle would carry trailing nulls, which the contract forbids
    for (const [key, m] of Object.entries(perSeries)) {
      const last = Math.max(...m.keys());
      if (last !== lastYear) {
        throw new Error(`worldbank-wdi: ${bundleSlug}.${key} ends ${last}, bundle axis ends ${lastYear} — split the bundle (trailing nulls are forbidden)`);
      }
    }

    const years = [];
    for (let y = firstYear; y <= lastYear; y++) years.push(y);
    const dates = years.map((y) => `${y}-01-01`);

    const series = {};
    const gaps = [];   // flat array of dates — the house convention (validate.mjs reads a Set of dates)
    for (const [key, m] of Object.entries(perSeries)) {
      const data = years.map((y) => m.get(y) ?? null);
      // interior nulls (between a series' own first and last observation)
      // are real absences and must be declared (CONTRACT-series rule 2)
      const first = data.findIndex((v) => v != null);
      const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
      for (let i = 0; i < data.length; i++) if (data[i] === null && i > first && i < last) gaps.push(dates[i]);
      const meta = SERIES_META[key];
      if (!meta) throw new Error(`worldbank-wdi: no display metadata for series key "${key}" (SERIES_META)`);
      series[key] = { name: `wdi_${key}`, ...meta, data };
    }

    bundles[bundleSlug] = {
      meta: {
        dossier: "manufacturing",
        frequency: "annual",
        base: dcfg.base ?? null,
        source: dcfg.source_agency,
        vintage: wdiVintage,
        mock: false,
        geo: dcfg.geo ?? "IND",
        latestPeriod: String(lastYear),          // calendar axis — never FY
        releaseDate: null,
        revisionPolicy: dcfg.revision_policy,
        coverage: bcfg.note,
        ...(gaps.length ? { gaps: [...new Set(gaps)].sort() } : {}),
      },
      dates,
      series,
    };
  }

  if (newest > raw.vintage) {
    raw.vintage = newest;
    for (const b of Object.values(bundles)) b.meta.vintage = newest;
  }
  writeRaw(root, "data/raw/wdi-ind-manufacturing.json", raw);
  for (const [slug, bundle] of Object.entries(bundles)) writeSeries(root, `data/series/${slug}.json`, bundle);
  return bundles;
}

/* Catalogue (docs/CONTRACT-coverage.md) for the manufacturing guide: every indicator in the
 * World Bank's own WDI listing (source/2/indicator) on manufacturing and its industry
 * context, for India: codes NV.IND.* (industry and manufacturing value added),
 * NV.MNF.* (manufacturing composition and technology) and T?.VAL.MANF.* (manufactures in
 * trade). The rest of WDI is the World Bank family's catalogue, not this guide's.
 *   wdi:ind:<indicator code, lower case> */
import { writeCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueWdiManufacturing() {
  const all = await wb("source/2/indicator", { per_page: 1000 });
  const items = all.filter((i) => /^(NV\.IND\.|NV\.MNF\.|TX\.VAL\.MANF|TM\.VAL\.MANF)/.test(i.id))
    .map((i) => ({ id: `wdi:ind:${i.id.toLowerCase()}`, label: i.name }));
  writeCatalogue("manufacturing", { source: "World Bank: World Development Indicators, India (API v2)",
    generator: "scripts/lib/products/worldbank-wdi.mjs --catalogue",
    note: "From source/2/indicator, filtered to NV.IND.*, NV.MNF.*, TX.VAL.MANF.* and TM.VAL.MANF.*: manufacturing and its industry context. Country IND.", items });
}
await catalogueCli(import.meta.url, catalogueWdiManufacturing);
