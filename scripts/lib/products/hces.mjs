// scripts/lib/products/hces.mjs — Household Consumption Expenditure Survey.
//
// Two survey rounds only (2022-23 and 2023-24) — the API does not serve the
// 2011-12 or earlier NSS CES rounds, and they would not be comparable anyway
// (methodology changed); nothing here is ever spliced with older rounds.
// Fiscal-year survey labels plot at April of the first year ("2023-24" ->
// 2023-04). All 9 indicators are small (~25k rows in total), so each is
// ingested IN FULL (paged, limit=500, keyed by indicator_code only) and
// sliced client-side. Bundles:
//   hces-mpce.json       — All-India MPCE, rural/urban × with/without imputation
//   hces-states.json     — state × sector MPCE (without imputation)
//   hces-fractiles.json  — MPCE over 12 fractile classes, All-India
//   hces-categories.json — %-share of MPCE over broad item categories
//   hces-gini.json       — Gini coefficient of PCE by sector
// "Without Imputation" is the headline convention; "With Imputation" adds the
// imputed value of items received free through social welfare programmes.

import { mospi } from "../mospi.mjs";
import { writeJson, writeRaw } from "../util.mjs";

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`; // "2023-24" -> "2023-04"

async function fetchAll(code) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("hces/getHcesRecords", { indicator_code: code, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page % 5 === 0 || page >= tp) process.stdout.write(`hces ind ${code}: page ${page}/${tp} (${rows.length} rows)\n`);
    if (page >= tp) break;
    page++;
  }
  return rows;
}

export async function buildHces(root, dcfg, vintage) {
  const byInd = {}; // code -> rows
  for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await fetchAll(code);
  writeRaw(root, "data/raw/hces-records.json", {
    vintage,
    note: "Complete row-sets of all 9 HCES indicators from hces/getHcesRecords (both survey rounds).",
    indicators: byInd,
  });

  // the two survey rounds present in the rows, oldest first
  const years = [...new Set(Object.values(byInd).flat().map((r) => r.year))].sort();
  const axis = years.map(fyStart);
  const dates = axis.map((ym) => `${ym}-01`);
  const val = (r) => {
    const v = parseFloat(r.value);
    return Number.isFinite(v) ? v : null;
  };
  const metaBase = {
    dossier: "hces", frequency: "annual", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    latestPeriod: axis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  // rows -> Map("YYYY-MM" -> value) over the two survey rounds
  const toMap = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const v = val(r);
      if (v != null) m.set(fyStart(r.year), v);
    }
    return m;
  };
  const data = (m) => axis.map((ym) => m.get(ym) ?? null);

  /* ---- hces-mpce: All-India, rural/urban × imputation variants ---- */
  const ai1 = byInd["1"].filter((r) => r.state === "All India");
  const mpceOf = (sector, imput) => toMap(ai1.filter((r) => r.sector === sector && r.imputation_type === imput));
  const imputNote = "\"Without imputation\" is the headline MPCE convention (comparable across the two rounds); \"with imputation\" adds the imputed value of items received free of cost through social welfare programmes. Only the 2022-23 and 2023-24 HCES rounds exist in the eSankhyiki API — the 2011-12 and earlier NSS CES rounds are not served and are methodologically different; these series must never be spliced with them.";
  const mpceBundle = {
    meta: { ...metaBase, coverage: "All India, rural and urban; average MPCE in ₹", note: imputNote },
    dates,
    series: {
      rural: { name: "hces_mpce_rural_inr", label: "Rural (without imputation)", color: "#BE3E26", data: data(mpceOf("Rural", "Without Imputation")), unit: "inr" },
      urban: { name: "hces_mpce_urban_inr", label: "Urban (without imputation)", color: "#5B564B", data: data(mpceOf("Urban", "Without Imputation")), unit: "inr" },
      rural_imputed: { name: "hces_mpce_rural_imputed_inr", label: "Rural (with imputation)", color: "#8A857A", data: data(mpceOf("Rural", "With Imputation")), unit: "inr" },
      urban_imputed: { name: "hces_mpce_urban_imputed_inr", label: "Urban (with imputation)", color: "#A8A293", data: data(mpceOf("Urban", "With Imputation")), unit: "inr" },
    },
  };

  /* ---- hces-states: state × sector MPCE, without imputation ---- */
  const stSeries = {};
  const stRows = byInd["1"].filter((r) => r.state !== "All India" && r.imputation_type === "Without Imputation");
  const stKeys = [...new Set(stRows.map((r) => `${r.state}|${r.sector}`))].sort();
  stKeys.forEach((k, i) => {
    const [state, sector] = k.split("|");
    const key = `${slugify(state)}_${slugify(sector)}`;
    stSeries[key] = {
      name: `hces_mpce_${key}_inr`, label: `${state} · ${sector}`, color: GREYS[i % GREYS.length],
      data: data(toMap(stRows.filter((r) => r.state === state && r.sector === sector))), unit: "inr",
    };
  });
  const statesBundle = {
    meta: { ...metaBase, coverage: "States/UTs × rural/urban; average MPCE in ₹, without imputation" },
    dates, series: stSeries,
  };

  /* ---- hces-fractiles: 12 fractile classes, All-India, without imputation ----
     (the rows also carry an "All" class — omitted, it duplicates hces-mpce) */
  const frRows = byInd["2"].filter((r) =>
    r.state === "All India" && r.imputation_type === "Without Imputation" && String(r.mpce_fractile_classes).trim() !== "All");
  const frSeries = {};
  // preserve the natural fractile order (source labels have stray spaces, e.g. " 5-10")
  const FR_ORDER = ["0-5", "5-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-95", "95-100"];
  let fi = 0;
  for (const fc of FR_ORDER) {
    for (const sector of ["Rural", "Urban"]) {
      const rows = frRows.filter((r) => String(r.mpce_fractile_classes).trim() === fc && r.sector === sector);
      if (!rows.length) continue;
      const key = `f${slugify(fc)}_${slugify(sector)}`;
      frSeries[key] = {
        name: `hces_mpce_fractile_${key}_inr`, label: `${fc}% · ${sector}`, color: GREYS[fi++ % GREYS.length],
        data: data(toMap(rows)), unit: "inr",
      };
    }
  }
  const fractilesBundle = {
    meta: { ...metaBase, coverage: "All India, rural/urban; average MPCE within each of the 12 fractile classes of the MPCE distribution, ₹, without imputation" },
    dates, series: frSeries,
  };

  /* ---- hces-categories: %-share of MPCE over broad item categories (ind 4) ---- */
  const catRows = byInd["4"].filter((r) => r.state === "All India" && r.imputation_type === "Without Imputation");
  const catNames = [...new Set(catRows.map((r) => r.item_category))].sort();
  const catSeries = {};
  let ci = 0;
  for (const cat of catNames) {
    for (const sector of ["Rural", "Urban"]) {
      const rows = catRows.filter((r) => r.item_category === cat && r.sector === sector);
      if (!rows.length) continue;
      const key = `${slugify(cat)}_${slugify(sector)}`;
      const accent = cat === "Food Total" && sector === "Rural";
      catSeries[key] = {
        name: `hces_share_${key}_pct`, label: `${cat} · ${sector}`,
        color: accent ? "#BE3E26" : GREYS[ci++ % GREYS.length],
        data: data(toMap(rows)), unit: "pct_of_mpce",
      };
    }
  }
  const categoriesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban; percentage share of MPCE by broad item category (30-day recall), without imputation",
      note: "Shares include the Food Total and Non-Food Total aggregate rows alongside the detailed categories; detail categories sum to their aggregate, and Food Total + Non-Food Total = 100.",
    },
    dates, series: catSeries,
  };

  /* ---- hces-gini: Gini coefficient by sector, both imputation variants ---- */
  const giniRows = byInd["9"].filter((r) => r.state === "All India");
  const giniOf = (sector, imput) => toMap(giniRows.filter((r) => r.sector === sector && r.imputation_type === imput));
  const giniBundle = {
    meta: { ...metaBase, coverage: "All India, rural and urban; Gini coefficient of per-capita consumption expenditure", note: imputNote },
    dates,
    series: {
      rural: { name: "hces_gini_rural", label: "Rural (without imputation)", color: "#BE3E26", data: data(giniOf("Rural", "Without Imputation")), unit: "gini" },
      urban: { name: "hces_gini_urban", label: "Urban (without imputation)", color: "#5B564B", data: data(giniOf("Urban", "Without Imputation")), unit: "gini" },
      rural_imputed: { name: "hces_gini_rural_imputed", label: "Rural (with imputation)", color: "#8A857A", data: data(giniOf("Rural", "With Imputation")), unit: "gini" },
      urban_imputed: { name: "hces_gini_urban_imputed", label: "Urban (with imputation)", color: "#A8A293", data: data(giniOf("Urban", "With Imputation")), unit: "gini" },
    },
  };

  if (!mpceBundle.series.rural.data.some((v) => v != null)) throw new Error("HCES: no MPCE data returned");
  writeJson(root, "data/series/hces-mpce.json", mpceBundle);
  writeJson(root, "data/series/hces-states.json", statesBundle);
  writeJson(root, "data/series/hces-fractiles.json", fractilesBundle);
  writeJson(root, "data/series/hces-categories.json", categoriesBundle);
  writeJson(root, "data/series/hces-gini.json", giniBundle);
  return mpceBundle;
}
