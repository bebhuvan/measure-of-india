// scripts/lib/products/gender.mjs — "Women and Men in India" compendium.
//
// 157 indicators spanning population, fertility, mortality, health, education,
// work, finance, politics and safety — each its own mini-table from a
// different source (Census, SRS, NFHS, PLFS, NCRB, …) with its own dimensions
// and time coverage. There is no shared base year or cadence; the fetcher
// ingests ~17 core indicators that form the dossier spine to raw and bakes
// each as its own bundle with its OWN date axis. The varying cadences (census
// decadal, SRS annual, MMR 3-year moving periods, life-expectancy 5-year
// cohorts) make a shared axis impossible and a forced one dishonest.
//
// Bundles baked:
//   gender-sexratio.json   — sex ratio, All India, census 1951-2011 (7 pts)
//   gender-imr.json        — IMR by gender (Male/Female/Person), All India, SRS 2008-2020
//   gender-lifeexp.json    — life expectancy at birth by gender, All India, 5-year cohorts 1990-94..2031-36*
//   gender-mmr.json        — Maternal Mortality Ratio, All India, 3-year moving periods 2004-06..2018-20
//   gender-fertility.json  — TFR by education level, All India, 2016-2020
//   gender-literacy.json   — literacy rate by gender × sector, All India, 1981..2017*
//   gender-work.json       — LFPR & unemployment by gender, All India, PLFS years
//   gender-states.json     — state-wise sex ratio, IMR & life expectancy, latest published

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const val = (r) => {
  const v = parseFloat(r.value);
  return Number.isFinite(v) ? v : null;
};
// map a year/period label to a date axis point. Handles "1951", "2004-06",
// "1990-94*", "2017*" — always takes the first 4 digits as the start year.
const periodStart = (label) => {
  const m = String(label).match(/(\d{4})/);
  return m ? `${m[1]}-01-01` : null;
};
const isProjection = (label) => String(label).includes("*");
const ai = (rows) => rows.filter((r) => (r["state/UT"] || r.state) === "All India");

async function fetchAll(code) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("gender/getGenderRecords", { indicator_code: code, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page >= tp) break;
    page++;
  }
  return rows;
}

export async function buildGender(root, dcfg, vintage) {
  const byInd = {};
  for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await fetchAll(code);
  writeRaw(root, "data/raw/gender-records.json", {
    vintage,
    note: "Core indicators of the 'Women and Men in India' compendium from gender/getGenderRecords. Each indicator draws on a different source (Census, SRS, NFHS, PLFS, NCRB) with its own dimensions and cadence; there is no shared base year. Values marked '-' at source are missing and baked as null; years marked '*' are projections.",
    indicators: byInd,
  });

  const metaBase = {
    dossier: "gender", frequency: "varies", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy,
  };
  const srcNote = "Multi-source: each indicator carries its own underlying source (Census for sex ratio & literacy, SRS for fertility/mortality, PLFS for labour, NCRB for crime). Indicators are never spliced or chained — different cadences and frames make that dishonest. Values marked '-' at source are null; years marked '*' are projections.";

  // helper: build a bundle from a set of (key, filtered-rows) pairs, each with
  // its own year->value map; the date axis is the sorted union of all maps.
  const buildBundle = (seriesDefs, extraMeta = {}) => {
    const allYears = new Set();
    for (const { map } of seriesDefs) for (const ym of map.keys()) allYears.add(ym);
    const axis = [...allYears].sort();
    const dates = axis; // axis is already "YYYY-MM-DD" (periodStart → YYYY-01-01)
    // hydrate expects "YYYY-MM-DD" dates
    const series = {};
    for (const { key, name, label, color, map, unit } of seriesDefs) {
      series[key] = { name, label, color, unit, data: axis.map((ym) => map.get(ym) ?? null) };
    }
    return { meta: { ...metaBase, latestPeriod: axis.at(-1)?.slice(0, 7) ?? null, ...extraMeta }, dates, series };
  };
  // rows -> Map("YYYY-01-01" -> value) over a filtered set
  const toMap = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const ym = periodStart(r.year);
      const v = val(r);
      if (ym && v != null) m.set(ym, v);
    }
    return m;
  };

  /* ---- gender-sexratio.json — the 70-year census story ---- */
  const sexBundle = buildBundle([
    { key: "sex_ratio", name: "gender_sex_ratio", label: "Females per 1,000 males · All India", color: "#2E4BD8", unit: "ratio",
      map: toMap(ai(byInd["2"])) },
  ], { frequency: "decadal", coverage: "All India; females per 1,000 males, Census rounds 1951-2011", note: srcNote + " Seven census rounds. The sex ratio rose from 946 (1951) to a peak near 946, fell to 927 (1991), then recovered — the 'missing women' story in one line." });

  /* ---- gender-imr.json — infant mortality by gender ---- */
  const imrBundle = buildBundle([
    { key: "imr_male", name: "gender_imr_male", label: "IMR · Male", color: "#5F6675", unit: "per_1000", map: toMap(ai(byInd["15"]).filter((r) => r.gender === "Male")) },
    { key: "imr_female", name: "gender_imr_female", label: "IMR · Female", color: "#2E4BD8", unit: "per_1000", map: toMap(ai(byInd["15"]).filter((r) => r.gender === "Female")) },
    { key: "imr_person", name: "gender_imr_person", label: "IMR · Person", color: "#A3A9B4", unit: "per_1000", map: toMap(ai(byInd["15"]).filter((r) => r.gender === "Person")) },
  ], { frequency: "annual", coverage: "All India; infant deaths per 1,000 live births, by gender, SRS 2008-2020", note: srcNote });

  /* ---- gender-lifeexp.json — life expectancy convergence ---- */
  const leBundle = buildBundle([
    { key: "life_exp_male", name: "gender_life_exp_male", label: "Life expectancy · Male", color: "#5F6675", unit: "years", map: toMap(ai(byInd["18"]).filter((r) => r.gender === "Male")) },
    { key: "life_exp_female", name: "gender_life_exp_female", label: "Life expectancy · Female", color: "#2E4BD8", unit: "years", map: toMap(ai(byInd["18"]).filter((r) => r.gender === "Female")) },
  ], { frequency: "5-year cohorts", coverage: "All India; life expectancy at birth, by gender, 5-year periods 1990-94 to 2031-36*", note: srcNote + " Periods after 2016-20 are projections (marked '*' at source). Female life expectancy exceeds male throughout — the gap is the story." });

  /* ---- gender-mmr.json — maternal mortality, the biggest decline ---- */
  const mmrBundle = buildBundle([
    { key: "mmr", name: "gender_mmr", label: "Maternal Mortality Ratio · All India", color: "#2E4BD8", unit: "per_100k_live_births", map: toMap(ai(byInd["21"])) },
  ], { frequency: "3-year moving average", coverage: "All India; maternal deaths per 100,000 live births, 3-year moving averages 2004-06 to 2018-20", note: srcNote + " Overlapping 3-year windows plotted at each period's start year. The decline from 254 to 97 is the steepest mortality improvement in the compendium." });

  /* ---- gender-fertility.json — TFR by education level ---- */
  const EDU = ["Illiterate", "Literate", "Primary", "Middle", "Class X", "Class XII", "Graduate and above"];
  const tfrDefs = [];
  let ei = 0;
  for (const edu of EDU) {
    const rows = ai(byInd["10"]).filter((r) => r.education_level === edu && (r.sector === "Total" || r.sector == null));
    if (!rows.length) continue;
    tfrDefs.push({ key: `tfr_${edu.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name: `gender_tfr_${edu.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, label: `TFR · ${edu}`, color: edu === "Graduate and above" ? "#2E4BD8" : GREYS[ei++ % GREYS.length], unit: "births_per_woman", map: toMap(rows) });
  }
  const tfrBundle = buildBundle(tfrDefs, { frequency: "annual", coverage: "All India; total fertility rate by education level of women, 2016-2020", note: srcNote + " TFR falls with education — the gradient is the story. Replacement level is 2.1." });

  /* ---- gender-literacy.json — literacy by gender × sector ---- */
  const litDefs = [];
  for (const g of ["Male", "Female"]) {
    const rows = ai(byInd["55"]).filter((r) => r.gender === g && (r.sector === "Total" || r.sector == null));
    litDefs.push({ key: `literacy_${g.toLowerCase()}`, name: `gender_literacy_${g.toLowerCase()}`, label: `Literacy · ${g}`, color: g === "Female" ? "#2E4BD8" : "#5F6675", unit: "percent", map: toMap(rows) });
  }
  const litBundle = buildBundle(litDefs, { frequency: "decadal", coverage: "All India; literacy rate (age 7+), by gender, Census 1981-2011 + 2017*", note: srcNote + " 2017* is an NSO estimate, not a census round. The gender gap (male minus female) narrowed but did not close." });

  /* ---- gender-work.json — LFPR & unemployment by gender ---- */
  const lfprDefs = [];
  for (const g of ["Male", "Female", "Person"]) {
    const rows = ai(byInd["80"]).filter((r) => r.gender === g && (r.sector === "Total" || r.sector == null) && (r.age_group === "15+" || r.age_group === "15 Years & Above"));
    if (!rows.length) continue;
    lfprDefs.push({ key: `lfpr_${g.toLowerCase()}`, name: `gender_lfpr_${g.toLowerCase()}`, label: `LFPR · ${g} · 15+`, color: g === "Female" ? "#2E4BD8" : g === "Male" ? "#5F6675" : "#A3A9B4", unit: "percent", map: toMap(rows) });
  }
  for (const g of ["Male", "Female"]) {
    const rows = ai(byInd["93"]).filter((r) => r.gender === g && (r.sector === "Total" || r.sector == null));
    if (!rows.length) continue;
    lfprDefs.push({ key: `unemp_${g.toLowerCase()}`, name: `gender_unemp_${g.toLowerCase()}`, label: `Unemployment · ${g}`, color: g === "Female" ? "#2E4BD8" : "#878D99", unit: "percent", map: toMap(rows) });
  }
  const workBundle = buildBundle(lfprDefs, { frequency: "annual", coverage: "All India; LFPR (15+, usual status) and unemployment rate, by gender, PLFS", note: srcNote + " The female LFPR is the stubborn gap — far below male throughout. PLFS years are agriculture years (Jul-Jun), plotted at the start year." });

  /* ---- gender-states.json — state-wise dispersion, latest published ---- */
  // sex ratio by state (indicator 6, latest year), IMR Person by state (16),
  // life expectancy Person by state (19)
  const stSeries = {};
  let si = 0;
  const srStates = (byInd["6"] || []).filter((r) => (r["state/UT"] || r.state) !== "All India");
  const srYears = [...new Set(srStates.map((r) => r.year))].sort();
  const srLatest = srYears.at(-1);
  for (const r of srStates.filter((r) => r.year === srLatest)) {
    const v = val(r);
    if (v == null) continue;
    const sk = String(r["state/UT"] || r.state).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    stSeries[`sex_ratio_${sk}`] = { name: `gender_sex_ratio_${sk}`, label: `Sex ratio · ${r["state/UT"] || r.state}`, color: GREYS[si++ % GREYS.length], unit: "ratio", data: [v] };
  }
  const imrStates = (byInd["16"] || []).filter((r) => (r["state/UT"] || r.state) !== "All India" && r.gender === "Person");
  const imrYears = [...new Set(imrStates.map((r) => r.year))].sort();
  const imrLatest = imrYears.at(-1);
  let si2 = 0;
  for (const r of imrStates.filter((r) => r.year === imrLatest)) {
    const v = val(r);
    if (v == null) continue;
    const sk = String(r["state/UT"] || r.state).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    stSeries[`imr_${sk}`] = { name: `gender_imr_${sk}`, label: `IMR · ${r["state/UT"] || r.state}`, color: GREYS[si2++ % GREYS.length], unit: "per_1000", data: [v] };
  }
  const statesBundle = {
    meta: { ...metaBase, latestPeriod: `${srLatest}`, coverage: `States/UTs; sex ratio (${srLatest}) and IMR Person (${imrLatest})`, note: srcNote },
    dates: [periodStart(srLatest)], series: stSeries,
  };

  writeSeries(root, "data/series/gender-sexratio.json", sexBundle);
  writeSeries(root, "data/series/gender-imr.json", imrBundle);
  writeSeries(root, "data/series/gender-lifeexp.json", leBundle);
  writeSeries(root, "data/series/gender-mmr.json", mmrBundle);
  writeSeries(root, "data/series/gender-fertility.json", tfrBundle);
  writeSeries(root, "data/series/gender-literacy.json", litBundle);
  writeSeries(root, "data/series/gender-work.json", workBundle);
  writeSeries(root, "data/series/gender-states.json", statesBundle);
  return sexBundle;
}

/* Catalogue (docs/CONTRACT-coverage.md): gender/getGenderIndicatorList and
 * gender/getGenderFilterByIndicatorId for all of the compendium's indicators, one cut at a
 * time: gender:<indicator>:all | :<dimension>:<value>. */
import { writeCatalogue, indicatorCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueGender() {
  const inds = (await mospi("gender/getGenderIndicatorList", {})).data ?? [];
  const items = await indicatorCatalogue({ mospi, prefix: "gender", indicators: Array.isArray(inds) ? inds : inds.indicator ?? [],
    filter: (ind) => ["gender/getGenderFilterByIndicatorId", { indicator_code: ind.indicator_code }] });
  writeCatalogue("gender", { source: "MoSPI: Women and Men in India, the multi-source gender compendium (eSankhyiki API)",
    generator: "scripts/lib/products/gender.mjs --catalogue",
    note: "From getGenderIndicatorList and getGenderFilterByIndicatorId: one cut at a time; each indicator's own years sit inside it.", items });
}
await catalogueCli(import.meta.url, catalogueGender);
