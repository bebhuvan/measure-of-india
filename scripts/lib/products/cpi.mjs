// scripts/lib/products/cpi.mjs — CPI, MoSPI NSO. Full grid ingest:
// All India × {Rural, Urban, Combined} × all 28 subgroups, plus the published
// General index for every state/UT × all three sectors. Headline and core are
// computed from group indices via real weights; published aggregates are
// cross-checks, never substitutes. Bundles:
//   cpi.json            — combined, six groups + computed headline/core
//   cpi-rural.json      — same anatomy, rural weights (no housing group)
//   cpi-urban.json      — same anatomy, urban weights
//   cpi-subgroups.json  — the 21 sub-groups below the six groups (combined)
//   cpi-states.json     — published General index y/y per state/UT (combined)
//   cpi-states-sectors.json — published General index y/y per state/UT, rural + urban

import { mospi, mospiAll } from "../mospi.mjs";
import { MONTHS, round2, writeSeries, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];

const SECTORS = { combined: 3, rural: 1, urban: 2 };

// name -> key map from the filter endpoint (rows identify subgroups by NAME)
async function cpiMeta(dcfg) {
  const res = await mospi("cpi/getCpiFilterByLevelAndBaseYear", {
    base_year: dcfg.fetch.params.base_year, level: "Group", series: "Current",
  });
  const subByCode = {}; // code -> {name, key}
  for (const sg of res.data.subgroup) subByCode[sg.subgroup_code] = { name: sg.subgroup_name, key: slugify(sg.subgroup_name.replace(/-Overall$/, "")) };
  const states = {}; // name -> code
  for (const st of res.data.state) states[st.description ?? st.state_name] = st.state_code;
  return { subByCode, states };
}

async function fetchSectorYear(dcfg, sectorCode, codes, year) {
  // the API's pagination overlaps one row at page boundaries — dedupe globally
  const seen = new Set();
  const rows = [];
  for (let page = 1; page <= 8; page++) {
    const res = await mospi(dcfg.fetch.endpoint, {
      ...dcfg.fetch.params, sector_code: sectorCode, subgroup_code: codes, year, page, limit: 100,
    });
    const batch = res.data ?? [];
    let added = 0;
    for (const r of batch) {
      const k = JSON.stringify(r);
      if (!seen.has(k)) { seen.add(k); rows.push(r); added++; }
    }
    if (batch.length < 100 || added === 0) break;
  }
  return rows;
}

function rowsToLevels(rows, nameToKey) {
  const levels = {}; // key -> Map("YYYY-MM" -> index)
  for (const r of rows) {
    const key = nameToKey(r.subgroup);
    if (!key) continue;
    const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
    if (m === "00") continue;
    const v = parseFloat(r.index);
    if (!Number.isFinite(v) || v === 0) continue; // unpublished months arrive as "" or 0
    (levels[key] ??= new Map()).set(`${r.year}-${m}`, v);
  }
  return levels;
}

// linear interpolation of unpublished interior months, disclosed in meta
function fillGaps(levels, months) {
  const estimated = {};
  for (const [key, map] of Object.entries(levels)) {
    const missing = months.filter((ym) => !map.has(ym));
    if (!missing.length) continue;
    estimated[key] = missing;
    for (const ym of missing) {
      const i = months.indexOf(ym);
      let ai = -1, bi = -1;
      for (let j = i - 1; j >= 0; j--) if (map.has(months[j])) { ai = j; break; }
      for (let j = i + 1; j < months.length; j++) if (map.has(months[j])) { bi = j; break; }
      if (ai < 0 || bi < 0) continue; // edge gap: leave missing (axis is clipped to published range anyway)
      const a = map.get(months[ai]), b = map.get(months[bi]);
      map.set(ym, round2(a + ((b - a) * (i - ai)) / (bi - ai)));
    }
  }
  return estimated;
}

function weightedIndex(levels, keys, W, months) {
  const out = new Map();
  const wSum = keys.reduce((a, k) => a + W[k], 0);
  for (const ym of months) {
    let h = 0, ok = true;
    for (const k of keys) {
      const v = levels[k]?.get(ym);
      if (v == null) { ok = false; break; }
      h += W[k] * v;
    }
    if (ok) out.set(ym, h / wSum);
  }
  return out;
}

export async function buildCpi(root, dcfg, vintage) {
  const { subByCode, states } = await cpiMeta(dcfg);
  // The 2012 base stopped at December 2025, and a CPI month is final once the next release prints it: with `retired: true`
  // its six baked bundles are not fetched again (about 2,700 calls); the wave-2 deep bake
  // and the 2024 base run as usual, on the baked axis.
  if (dcfg.fetch.retired) {
    const b = JSON.parse(fs.readFileSync(path.join(root, "data/series/cpi.json"), "utf8"));
    if (dcfg.deep2012) await buildCpi2012Deep(root, dcfg, vintage, { states, axis: b.dates.map((d) => d.slice(0, 7)), releaseDate: b.meta.releaseDate, endYear: 2025 });
    if (dcfg.fetch2024) await buildCpi2024(root, dcfg, vintage);
    if (dcfg.archive2010) await buildCpi2010Archive(root, dcfg, vintage);
    return b;
  }
  const allCodes = Object.keys(subByCode);
  const nameToKey = (name) => {
    for (const c of allCodes) if (subByCode[c].name === name) return subByCode[c].key;
    return null;
  };
  const startYear = 2014;
  const endYear = new Date().getUTCFullYear();

  // canonical keys for the six groups + published headline
  const GROUP_KEYS = { food: "food_and_beverages", pan: "pan_tobacco_and_intoxicants", clothing: "clothing_and_footwear", housing: "housing", fuel: "fuel_and_light", misc: "miscellaneous" };
  const HEADLINE_KEY = "general";

  /* ---- All India × three sectors ----
     fetch per (sector, year, single subgroup code): the API's pagination is
     LOSSY for large code sets (rows repeat and vanish at page boundaries),
     so every series is fetched as one request with no paging at all. */
  const bySector = {}; // sector -> levels
  for (const [sector, code] of Object.entries(SECTORS)) {
    const all = [];
    for (let year = startYear; year <= endYear; year++) {
      let n = 0;
      for (const sg of allCodes) {
        const rows = await fetchSectorYear(dcfg, code, sg, year);
        all.push(...rows);
        n += rows.length;
      }
      process.stdout.write(`cpi ${sector} ${year}: ${n} rows\n`);
      await new Promise((r) => setTimeout(r, 250));
    }
    bySector[sector] = rowsToLevels(all, nameToKey);
  }

  /* ---- states: published General index per state, all three sectors ---- */
  const stateLevels = { combined: {}, rural: {}, urban: {} }; // sector -> stateKey -> Map
  for (const [stateName, stateCode] of Object.entries(states)) {
    if (String(stateCode) === "99") continue;
    const sKey = slugify(stateName);
    for (const [sector, sectorCode] of Object.entries(SECTORS)) {
      for (let year = startYear; year <= endYear; year++) {
        const res = await mospi(dcfg.fetch.endpoint, {
          ...dcfg.fetch.params, sector_code: sectorCode, state_code: stateCode, subgroup_code: "0.99", year, limit: 100,
        });
        for (const r of res.data ?? []) {
          const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
          if (m === "00") continue;
          const v = parseFloat(r.index);
          if (Number.isFinite(v) && v !== 0) (stateLevels[sector][sKey] ??= new Map()).set(`${r.year}-${m}`, v);
        }
        if (year < endYear) await new Promise((r) => setTimeout(r, 200));
      }
      process.stdout.write(`cpi states ${sector} ${sKey}: ${stateLevels[sector][sKey]?.size ?? 0} months\n`);
    }
  }

  const combined = bySector.combined;
  const pub = combined[HEADLINE_KEY];
  if (!pub?.size) throw new Error("CPI: no data returned");
  const months = [...pub.keys()].sort();
  const lastMonth = months[months.length - 1];

  // interpolate unpublished interior months (Housing, Dec 2018 – Sep 2019), disclosed
  const estimated = {};
  for (const sector of Object.keys(bySector)) {
    estimated[sector] = fillGaps(bySector[sector], months);
  }

  const axis = monthAxis(dcfg.window.start, lastMonth);
  const dates = axis.map((ym) => `${ym}-01`);
  const [ly, lm] = lastMonth.split("-").map(Number);
  const releaseDate = `${lm === 12 ? ly + 1 : ly}-${String(lm === 12 ? 1 : lm + 1).padStart(2, "0")}-12`;

  // per-sector bundle with computed headline/core + published cross-check
  // groupKeys are gated on the sector's WEIGHTS, not just on returned rows:
  // the API emits phantom rows for groups a sector doesn't compile (e.g.
  // rural housing) — including them would poison the weighted index
  const sectorBundle = (sector, W) => {
    const lv = bySector[sector];
    const groupKeys = Object.keys(GROUP_KEYS).filter((k) => W[k] != null && lv[GROUP_KEYS[k]]?.size);
    const wSum = groupKeys.reduce((a, k) => a + W[k], 0);
    const headlineIdx = weightedIndex(lv, groupKeys.map((k) => GROUP_KEYS[k]), Object.fromEntries(groupKeys.map((k) => [GROUP_KEYS[k], W[k]])), months);
    const coreKeys = ["pan", "clothing", "housing", "misc"].filter((k) => groupKeys.includes(k));
    const coreIdx = weightedIndex(lv, coreKeys.map((k) => GROUP_KEYS[k]), Object.fromEntries(coreKeys.map((k) => [GROUP_KEYS[k], W[k]])), months);
    const yoy = {
      headline: yoyFromLevels(headlineIdx),
      food: yoyFromLevels(lv[GROUP_KEYS.food]),
      fuel: yoyFromLevels(lv[GROUP_KEYS.fuel]),
      core: yoyFromLevels(coreIdx),
      published_headline: yoyFromLevels(lv[HEADLINE_KEY]),
    };
    const sfx = sector === "combined" ? "" : `_${sector}`; // cpi.json keeps its original series names
    // interpolated months are disclosed ON the series their estimates feed
    // (CONTRACT-series rule 2): the headline aggregates every weighted group,
    // core aggregates pan + clothing + housing + misc — nothing else carries
    // an interpolated point
    const estFor = (groupNames) =>
      [...new Set(groupNames.flatMap((n) => estimated[sector]?.[GROUP_KEYS[n]] ?? []))].sort().map((ym) => `${ym}-01`);
    const headEst = estFor(groupKeys), coreEst = estFor(coreKeys);
    return {
      meta: {
        dossier: "cpi", frequency: "monthly", base: dcfg.base,
        source: dcfg.source_agency, vintage, mock: false,
        geo: dcfg.geo ?? "IND",
        latestPeriod: lastMonth, releaseDate,
        coverage: `All India, ${sector}`,
        revisionPolicy: dcfg.revision_policy,
      },
      dates,
      series: {
        headline: { name: `headline_cpi${sfx}_yoy_pct`, label: "Headline", color: "#2E4BD8", data: axis.map((ym) => yoy.headline.get(ym) ?? null), ...(headEst.length ? { estimated: headEst } : {}) },
        food: { name: `food_beverages${sfx}_yoy_pct`, label: "Food", color: "#5F6675", data: axis.map((ym) => yoy.food.get(ym) ?? null) },
        fuel: { name: `fuel_light${sfx}_yoy_pct`, label: "Fuel", color: "#A3A9B4", data: axis.map((ym) => yoy.fuel.get(ym) ?? null) },
        core: { name: `core${sfx}_yoy_pct`, label: "Core", color: "#C9CED6", data: axis.map((ym) => yoy.core.get(ym) ?? null), ...(coreEst.length ? { estimated: coreEst } : {}) },
      },
      crosscheck: { published_headline: axis.map((ym) => yoy.published_headline.get(ym) ?? null) },
    };
  };

  const bundleCombined = sectorBundle("combined", dcfg.weights);
  const bundleRural = sectorBundle("rural", dcfg.weights_rural);
  const bundleUrban = sectorBundle("urban", dcfg.weights_urban);

  /* ---- subgroups bundle (combined, the 21 sub-groups) ---- */
  const overallKeys = new Set([HEADLINE_KEY, ...Object.values(GROUP_KEYS)]);
  const subKeys = [...new Set(Object.values(subByCode).map((x) => x.key))].filter((k) => !overallKeys.has(k) && combined[k]?.size);
  const subSeries = {};
  subKeys.forEach((k, i) => {
    const yoy = yoyFromLevels(combined[k]);
    const label = Object.values(subByCode).find((x) => x.key === k)?.name ?? k;
    subSeries[k] = {
      name: `cpi_${k}_yoy_pct`, label, color: GREYS[i % GREYS.length],
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
  });
  const bundleSubgroups = {
    meta: {
      dossier: "cpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth, releaseDate,
      coverage: "All India, Combined; the 21 sub-groups below the six groups",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: subSeries,
  };

  /* ---- states bundles (published headline y/y per state) ----
     interior nulls are real non-publication months (CPI was not compiled for
     most states in Apr–May 2020 and Apr–May 2021; the y/y nulls knock on into
     2021) — disclosed per series in gaps, computed on the emitted y/y series */
  const seriesGaps = (yoyMaps) => {
    const set = new Set();
    for (const m of yoyMaps) {
      const months = [...m.keys()].sort();
      for (const ym of axis) {
        if (ym > months[0] && ym < months.at(-1) && !m.has(ym)) set.add(ym);
      }
    }
    return [...set].sort();
  };
  const stateYoy = {}; // sKey -> yoy map (combined)
  const stateSeries = {};
  Object.keys(stateLevels.combined).sort().forEach((sKey, i) => {
    const yoy = yoyFromLevels(stateLevels.combined[sKey]);
    if (!yoy.size) return;
    stateYoy[sKey] = yoy;
    stateSeries[sKey] = {
      name: `cpi_${sKey}_yoy_pct`, label: sKey.replace(/_/g, " "), color: GREYS[i % GREYS.length],
      data: axis.map((ym) => yoy.get(ym) ?? null),
      published: true,
    };
  });
  const bundleStates = {
    meta: {
      dossier: "cpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth, releaseDate,
      coverage: "States/UTs, Combined; published General index (state baskets differ — no all-India weights applied)",
      gaps: seriesGaps(Object.values(stateYoy)).map((ym) => `${ym}-01`),
      gapsNote: "Months when a state index was not published (chiefly Apr–May 2020 and Apr–May 2021), plus the y/y knock-on a year later.",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: stateSeries,
  };

  // state × sector: rural and urban published General index y/y per state
  const sectorStateYoy = [];
  const sectorStateSeries = {};
  for (const sector of ["rural", "urban"]) {
    Object.keys(stateLevels[sector]).sort().forEach((sKey, i) => {
      const yoy = yoyFromLevels(stateLevels[sector][sKey]);
      if (!yoy.size) return;
      sectorStateYoy.push(yoy);
      sectorStateSeries[`${sKey}_${sector}`] = {
        name: `cpi_${sKey}_${sector}_yoy_pct`, label: `${sKey.replace(/_/g, " ")} · ${sector}`, color: GREYS[i % GREYS.length],
        data: axis.map((ym) => yoy.get(ym) ?? null),
        published: true,
      };
    });
  }
  const bundleStatesSectors = {
    meta: {
      dossier: "cpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth, releaseDate,
      coverage: "States/UTs, Rural and Urban; published General index",
      gaps: seriesGaps(sectorStateYoy).map((ym) => `${ym}-01`),
      gapsNote: "Months when a state index was not published (chiefly Apr–May 2020 and Apr–May 2021), plus the y/y knock-on a year later.",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: sectorStateSeries,
  };

  /* ---- raw ---- */
  const raw = { vintage, unit: "index, base 2012=100", levels: {} };
  for (const [sector, lv] of Object.entries(bySector)) {
    for (const [k, map] of Object.entries(lv)) raw.levels[`${sector}:${k}`] = Object.fromEntries([...map.entries()].sort());
  }
  writeRaw(root, "data/raw/cpi-indices.json", raw);
  const rawStates = { vintage, unit: "index, base 2012=100, published General index", levels: {} };
  for (const [sector, lv] of Object.entries(stateLevels)) {
    for (const [k, map] of Object.entries(lv)) rawStates.levels[`${sector}:${k}`] = Object.fromEntries([...map.entries()].sort());
  }
  writeRaw(root, "data/raw/cpi-states-indices.json", rawStates);

  writeSeries(root, "data/series/cpi.json", bundleCombined);
  writeSeries(root, "data/series/cpi-rural.json", bundleRural);
  writeSeries(root, "data/series/cpi-urban.json", bundleUrban);
  writeSeries(root, "data/series/cpi-subgroups.json", bundleSubgroups);
  writeSeries(root, "data/series/cpi-states.json", bundleStates);
  writeSeries(root, "data/series/cpi-states-sectors.json", bundleStatesSectors);

  if (dcfg.deep2012) await buildCpi2012Deep(root, dcfg, vintage, { states, axis, releaseDate, endYear });
  if (dcfg.fetch2024) await buildCpi2024(root, dcfg, vintage);
  if (dcfg.archive2010) await buildCpi2010Archive(root, dcfg, vintage);
  return bundleCombined;
}

/* =========================================================================
 * CPI on base 2024=100 — a NEW series, never spliced with the 2012 base.
 * The hierarchy is COICOP-2018-style: 13 divisions (0 = CPI General) replace
 * the six groups. The API serves no weights for this base (filter payload,
 * record rows and getCpiBaseYear were all checked), so the headline here is
 * the PUBLISHED all-groups index — the computed-from-weights cross-check the
 * 2012-base bundles get is not yet possible. Disclosed in meta.note.
 * Bundles:
 *   cpi-2024.json         — All India combined: headline + 12 divisions, y/y
 *                           computed from index levels (first same-base
 *                           year-ago is Jan 2026); published inflation rows
 *                           kept as crosscheck
 *   cpi-2024-sectors.json — rural / urban published General index, y/y
 *   cpi-2024-back.json    — the NSO's own back-cast of the General index on
 *                           this base, 2013–2024 (series=Back), own bundle
 *
 * DEPTH (audited live 2026-08-08). One getCPIData stream carries EVERY level
 * of the COICOP hierarchy — the level param is ignored; division_code /
 * group_code / class_code / item_code / month_code / state_code /
 * sector_code / year are honoured server-side. All India × Combined is
 * exactly 668 rows per month: 1 General + 12 divisions + 43 groups +
 * 92 classes + 162 sub-classes + 358 items, every month Jan 2025 onward.
 * The imputation dimension is a per-row Y/N flag on ITEM rows only (Y = the
 * item's index that month was imputed rather than directly priced); every
 * All-India Combined item row is N in every month served so far — asserted
 * at bake, disclosed in meta. Depth bundles from that audit:
 *   cpi-2024-groups.json         — the 43 groups, All India combined, y/y
 *   cpi-2024-items.json          — all 358 items, All India combined, y/y +
 *                                  per-item code/division/latest level
 *   cpi-2024-states.json         — General index (division 0) per state/UT,
 *                                  combined, y/y from levels
 *   cpi-2024-states-sectors.json — same, rural and urban
 * Classes and sub-classes are archived to data/raw/cpi-2024-grid.json only:
 * intermediate aggregates between the baked group and item levels.
 * Base 2010=100 is also probed by buildCpi2010Archive below — a 48-month
 * fragment (Jan 2011 – Dec 2014), archived raw, never baked.
 * ========================================================================= */

// paginated fetch of one (sector, division, year); a division_code query
// returns the aggregate row plus child group/class rows — keep group == null.
// Food & beverages carries ~190 child rows per month, so its aggregates sit
// ~23 pages deep (limit is capped at 100 by the API; larger values are 400).
// The loop pages until the year's 12 aggregate months are in hand or the
// stream ends.
async function fetch2024DivisionYear(dcfg, sectorCode, divisionCode, year, series) {
  const seen = new Set();
  const agg = [];
  for (let page = 1; page <= 40; page++) {
    const res = await mospi(dcfg.fetch2024.endpoint, {
      ...dcfg.fetch2024.params, series, sector_code: sectorCode,
      division_code: divisionCode, year, page, limit: 100,
    });
    const batch = res.data ?? [];
    let added = 0;
    for (const r of batch) {
      const k = JSON.stringify(r);
      if (!seen.has(k)) { seen.add(k); added++; if (r.group == null) agg.push(r); }
    }
    if (batch.length < 100 || added === 0 || agg.length >= 12) break;
  }
  return agg;
}

// paged fetch of ONE month of the full All-India hierarchy (every level in
// one stream, month_code honoured server-side): 668 rows = 7 pages at the
// API's 100-row cap. Dedupe guards the pagination overlap.
async function fetch2024GridMonth(dcfg, year, monthCode) {
  const seen = new Set();
  const rows = [];
  for (let page = 1; page <= 12; page++) {
    const res = await mospi(dcfg.fetch2024.endpoint, {
      ...dcfg.fetch2024.params, series: "Current", sector_code: 3,
      year, month_code: monthCode, page, limit: 100,
    });
    const batch = res.data ?? [];
    let added = 0;
    for (const r of batch) {
      const k = JSON.stringify(r);
      if (!seen.has(k)) { seen.add(k); rows.push(r); added++; }
    }
    if (batch.length < 100 || added === 0) break;
  }
  return rows;
}

// One (state, sector, month) slice of the whole base-2024 hierarchy: General, divisions,
// groups, classes, sub-classes and items in one stream (about 540 to 669 rows, 6 or 7
// pages). mospiAll fails unless the rows collected equal the endpoint's totalRecords; the
// caller also checks each node appears once. The parameter set is fixed so a re-run replays
// the resume cache exactly.
export async function fetch2024Slice(dcfg, stateCode, sectorCode, year, monthCode) {
  return mospiAll(dcfg.fetch2024.endpoint, {
    ...dcfg.fetch2024.params, series: "Current", state_code: stateCode,
    sector_code: sectorCode, year, month_code: monthCode,
  });
}

// General index (division 0) for one (state, sector, year): 12 rows max
async function fetch2024StateGeneralYear(dcfg, stateCode, sectorCode, year) {
  const seen = new Set();
  const rows = [];
  for (let page = 1; page <= 2; page++) {
    const res = await mospi(dcfg.fetch2024.endpoint, {
      ...dcfg.fetch2024.params, series: "Current", state_code: stateCode,
      sector_code: sectorCode, division_code: 0, year, page, limit: 100,
    });
    const batch = res.data ?? [];
    let added = 0;
    for (const r of batch) {
      const k = JSON.stringify(r);
      if (!seen.has(k)) { seen.add(k); if (r.group == null) { rows.push(r); added++; } }
    }
    if (batch.length < 100 || added === 0) break;
  }
  return rows;
}

// rows -> { levels: Map(ym -> index), published: Map(ym -> inflation) }
function rows2024ToMaps(rows) {
  const levels = new Map(), published = new Map();
  for (const r of rows) {
    const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
    if (m === "00") continue;
    const ym = `${r.year}-${m}`;
    const v = parseFloat(r.index);
    if (Number.isFinite(v) && v !== 0) levels.set(ym, v);
    const inf = parseFloat(r.inflation);
    if (Number.isFinite(inf)) published.set(ym, inf);
  }
  return { levels, published };
}

export async function buildCpi2024(root, dcfg, vintage) {
  const base = dcfg.fetch2024.base; // "2024=100"
  // divisions and Current years come from the filter payload, not hardcoded
  const filt = await mospi("cpi/getCpiFilterByLevelAndBaseYear", {
    base_year: dcfg.fetch2024.params.base_year, level: "Group", series: "Current",
  });
  const fd = (filt.data ?? filt)[0];
  const divisions = fd.division; // [{division_code, division_name}]
  const years = fd.year.filter((y) => y.series === "Current").map((y) => y.year).sort();
  const backYears = ((await mospi("cpi/getCpiFilterByLevelAndBaseYear", {
    base_year: dcfg.fetch2024.params.base_year, level: "Group", series: "Back",
  })).data ?? [])[0]?.year?.map((y) => y.year).sort() ?? [];

  const HEADLINE_CODE = 0; // division 0 = "CPI (General)"
  const keyOf = (d) => (d.division_code === HEADLINE_CODE ? "headline" : slugify(d.division_name));

  /* ---- Current: three sectors × all divisions × all served years ---- */
  const SEC = { combined: 3, rural: 1, urban: 2 };
  const cur = {}; // sector -> key -> {levels, published}
  for (const [sector, sectorCode] of Object.entries(SEC)) {
    cur[sector] = {};
    for (const d of divisions) {
      const rows = [];
      for (const year of years) rows.push(...await fetch2024DivisionYear(dcfg, sectorCode, d.division_code, year, "Current"));
      cur[sector][keyOf(d)] = rows2024ToMaps(rows);
      process.stdout.write(`cpi-2024 ${sector} div ${d.division_code}: ${rows.length} months\n`);
    }
  }

  /* ---- Back: the NSO's own back-cast, General index, combined only ---- */
  const backRows = [];
  for (const year of backYears) backRows.push(...await fetch2024DivisionYear(dcfg, SEC.combined, HEADLINE_CODE, year, "Back"));
  const back = rows2024ToMaps(backRows);
  process.stdout.write(`cpi-2024 back (combined, General): ${backRows.length} months\n`);

  /* ---- full grid: All India combined, every level below the divisions ----
     one paged fetch per month; 668 rows each = 43 groups + 92 classes +
     162 sub-classes + 358 items below the 13 division aggregates. Row counts
     are checked against that audited total before anything is baked. */
  const levelOfRow = (r) => r.item != null ? "item" : r.sub_class != null ? "sub_class" : r.class != null ? "class" : r.group != null ? "group" : "division";
  const grid = { group: {}, class: {}, sub_class: {}, item: {} }; // level -> code -> store
  let gridMonths = 0;
  for (const year of years) {
    for (let mc = 1; mc <= 12; mc++) {
      const rows = await fetch2024GridMonth(dcfg, year, mc);
      if (!rows.length) continue; // months not yet published
      gridMonths++;
      if (rows.length !== 668) process.stdout.write(`cpi-2024 grid ${year}-${String(mc).padStart(2, "0")}: ${rows.length} rows, expected 668\n`);
      for (const r of rows) {
        const lv = levelOfRow(r);
        if (lv === "division") continue; // divisions already ingested above
        const store = (grid[lv][r.code] ??= { code: r.code, name: r[lv], division: r.division, levels: new Map(), published: new Map(), imputedMonths: [] });
        const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
        if (m === "00") continue;
        const ym = `${r.year}-${m}`;
        const v = parseFloat(r.index);
        if (Number.isFinite(v) && v !== 0) store.levels.set(ym, v);
        const inf = parseFloat(r.inflation);
        if (Number.isFinite(inf)) store.published.set(ym, inf);
        if (lv === "item" && r.imputation === "Y") store.imputedMonths.push(ym);
      }
    }
  }
  const nGrid = Object.fromEntries(Object.entries(grid).map(([lv, o]) => [lv, Object.keys(o).length]));
  process.stdout.write(`cpi-2024 grid: ${gridMonths} months; groups ${nGrid.group}, classes ${nGrid.class}, sub-classes ${nGrid.sub_class}, items ${nGrid.item}\n`);
  const imputedItems = Object.values(grid.item).filter((x) => x.imputedMonths.length);
  process.stdout.write(`cpi-2024 grid: ${imputedItems.length} of ${nGrid.item} items carry an imputed (Y) month at All-India combined\n`);

  /* ---- states: published General index (division 0) per state/UT ---- */
  const stateLevels24 = { combined: {}, rural: {}, urban: {} }; // sector -> sKey -> {label, levels, published}
  for (const st of fd.state ?? []) {
    if (st.state_code === 1) continue; // All India lives in cpi-2024.json
    const sKey = slugify(st.state_name);
    for (const [sector, sectorCode] of Object.entries(SEC)) {
      const store = { label: st.state_name, levels: new Map(), published: new Map() };
      for (const year of years) {
        const rows = await fetch2024StateGeneralYear(dcfg, st.state_code, sectorCode, year);
        const maps = rows2024ToMaps(rows);
        for (const [ym, v] of maps.levels) store.levels.set(ym, v);
        for (const [ym, v] of maps.published) store.published.set(ym, v);
      }
      if (store.levels.size) stateLevels24[sector][sKey] = store;
    }
    process.stdout.write(`cpi-2024 states ${sKey}: ${stateLevels24.combined[sKey]?.levels.size ?? 0} months (combined)\n`);
  }

  const pub = cur.combined.headline.levels;
  if (!pub.size) throw new Error("CPI 2024-base: no data returned");
  const lastMonth = [...pub.keys()].sort().at(-1);
  const [ly, lm] = lastMonth.split("-").map(Number);
  const releaseDate = `${lm === 12 ? ly + 1 : ly}-${String(lm === 12 ? 1 : lm + 1).padStart(2, "0")}-12`;

  // y/y from levels exists only where a same-base year-ago level exists; the
  // axis is clipped to those months (window2024.start), so the bundle carries
  // no dead leading year
  const axis = monthAxis(dcfg.window2024.start, lastMonth);
  const dates = axis.map((ym) => `${ym}-01`);
  const meta = (coverage, extra = {}) => ({
    dossier: "cpi", frequency: "monthly", base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: lastMonth, releaseDate, coverage,
    note: "Base 2024=100, a separate series from the 2012 base — never spliced. " +
      "Headline is the published all-groups index (CPI General): the API serves no component weights for this base yet, " +
      "so the computed-from-weights cross-check the 2012-base bundles get is not possible here. " +
      "y/y is computed from published index levels; the API's own published inflation rate is kept as a crosscheck.",
    revisionPolicy: dcfg.revision_policy,
    ...extra,
  });

  /* ---- combined bundle: headline + 12 divisions ---- */
  const series = {};
  const pubCross = {};
  divisions.forEach((d, i) => {
    const k = keyOf(d);
    const yoy = yoyFromLevels(cur.combined[k].levels);
    series[k] = {
      name: `cpi2024_${k}_yoy_pct`,
      label: d.division_code === HEADLINE_CODE ? "Headline · base 2024" : d.division_name,
      color: d.division_code === HEADLINE_CODE ? "#2E4BD8" : GREYS[(i - 1) % GREYS.length],
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
    pubCross[k] = axis.map((ym) => cur.combined[k].published.get(ym) ?? null);
  });
  const bundle2024 = {
    meta: meta("All India, Combined; CPI General + the 12 COICOP-2018-style divisions"),
    dates, series,
    crosscheck: { published_headline: pubCross.headline, published_inflation: pubCross },
  };

  /* ---- sectors bundle: rural / urban published General index ---- */
  const secSeries = {}, secCross = {};
  for (const [sector, color] of [["rural", "#5F6675"], ["urban", "#A3A9B4"]]) {
    const yoy = yoyFromLevels(cur[sector].headline.levels);
    secSeries[sector] = {
      name: `cpi2024_headline_${sector}_yoy_pct`, label: `Headline · ${sector} · base 2024`, color,
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
    secCross[sector] = axis.map((ym) => cur[sector].headline.published.get(ym) ?? null);
  }
  const bundleSectors2024 = {
    meta: meta("All India, Rural and Urban; published General index"),
    dates, series: secSeries,
    crosscheck: { published_inflation: secCross },
  };

  /* ---- groups bundle: the 43 groups below the divisions, combined ---- */
  const groupSeries = {}, groupCross = {};
  Object.values(grid.group).sort((a, b) => (a.code < b.code ? -1 : 1)).forEach((g, i) => {
    const k = slugify(g.name);
    const yoy = yoyFromLevels(g.levels);
    groupSeries[k] = {
      name: `cpi2024_grp_${k}_yoy_pct`, label: g.name, color: GREYS[i % GREYS.length],
      code: g.code, division: g.division,
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
    groupCross[k] = axis.map((ym) => g.published.get(ym) ?? null);
  });
  const bundleGroups2024 = {
    meta: meta(`All India, Combined; the ${Object.keys(groupSeries).length} groups below the 13 divisions`, {
      hierarchyNote: "Group level of the COICOP-2018-style hierarchy (13 divisions → 43 groups → 92 classes → 162 sub-classes → 358 items). Classes and sub-classes are archived raw, not baked.",
    }),
    dates, series: groupSeries,
    crosscheck: { published_inflation: groupCross },
  };

  /* ---- items bundle: the full 358-item basket, combined ----
     y/y from levels, only where a same-base year-ago level exists (2026
     months); each series carries its code, division, latest level and any
     imputed months. All rows to date are imputation = N — directly priced. */
  const itemSeries = {}, itemCross = {};
  Object.values(grid.item).sort((a, b) => (a.code < b.code ? -1 : 1)).forEach((it, i) => {
    const k = slugify(it.name);
    const yoy = yoyFromLevels(it.levels);
    const own = [...it.levels.keys()].sort();
    itemSeries[k] = {
      name: `cpi2024_item_${k}_yoy_pct`, label: it.name, color: GREYS[i % GREYS.length],
      code: it.code, division: it.division,
      latest_level: it.levels.get(own.at(-1)) ?? null, latest_level_month: own.at(-1) ?? null,
      imputed_months: it.imputedMonths.sort(),
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
    itemCross[k] = axis.map((ym) => it.published.get(ym) ?? null);
  });
  const bundleItems2024 = {
    meta: meta(`All India, Combined; all ${Object.keys(itemSeries).length} items of the 2024 basket`, {
      imputationNote: imputedItems.length
        ? `${imputedItems.length} items carry at least one imputed (Y) month; those months are listed per series in imputed_months.`
        : "Every All-India combined item row served so far is flagged N — the index was compiled from collected prices, not imputed. Items with imputed months would list them in imputed_months.",
    }),
    dates, series: itemSeries,
    crosscheck: { published_inflation: itemCross },
  };

  /* ---- states bundles: published General index per state/UT ---- */
  const stateBundle24 = (sectors) => {
    const series = {}, cross = {};
    for (const sector of sectors) {
      const sfx = sectors.length > 1 ? `_${sector}` : "";
      Object.keys(stateLevels24[sector]).sort().forEach((sKey, i) => {
        const st = stateLevels24[sector][sKey];
        const yoy = yoyFromLevels(st.levels);
        if (!yoy.size) return;
        series[`${sKey}${sfx}`] = {
          name: `cpi2024_${sKey}${sfx}_yoy_pct`,
          label: sectors.length > 1 ? `${st.label} · ${sector}` : st.label,
          color: GREYS[i % GREYS.length],
          data: axis.map((ym) => yoy.get(ym) ?? null),
          published: true,
        };
        cross[`${sKey}${sfx}`] = axis.map((ym) => st.published.get(ym) ?? null);
      });
    }
    return { series, cross };
  };
  const stC = stateBundle24(["combined"]);
  const bundleStates2024 = {
    meta: meta("States/UTs, Combined; published General index (state baskets differ — no all-India weights applied)"),
    dates, series: stC.series,
    crosscheck: { published_inflation: stC.cross },
  };
  const stRU = stateBundle24(["rural", "urban"]);
  const bundleStatesSectors2024 = {
    meta: meta("States/UTs, Rural and Urban; published General index"),
    dates, series: stRU.series,
    crosscheck: { published_inflation: stRU.cross },
  };

  /* ---- back-series bundle: the NSO's own back-cast, 2013–2024 ---- */
  const backMonths = [...back.levels.keys()].sort();
  const backAxis = monthAxis(backMonths[0], backMonths.at(-1));
  const backYoy = yoyFromLevels(back.levels);
  const bundleBack2024 = {
    meta: {
      dossier: "cpi", frequency: "monthly", base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: backMonths.at(-1), releaseDate: null,
      coverage: "All India, Combined; General index only",
      note: "The NSO's own back-cast of the 2024-base General index (series=Back), 2013–2024 — " +
        "a linking series published by the Bureau, not by India Atlas. Its own bundle: " +
        "never merged with the 2012-base series or with the 2024-base Current series.",
      revisionPolicy: dcfg.revision_policy,
    },
    dates: backAxis.map((ym) => `${ym}-01`),
    series: {
      headline: {
        name: "cpi2024_back_headline_yoy_pct", label: "Headline · base 2024 · NSO back-cast", color: "#C9CED6",
        data: backAxis.map((ym) => backYoy.get(ym) ?? null),
      },
    },
    crosscheck: { published_headline: backAxis.map((ym) => back.published.get(ym) ?? null) },
  };

  /* ---- raw ---- */
  const raw = { vintage, unit: `index, base ${base}`, levels: {}, published_inflation: {} };
  for (const [sector, byKey] of Object.entries(cur)) {
    for (const [k, maps] of Object.entries(byKey)) {
      raw.levels[`${sector}:${k}`] = Object.fromEntries([...maps.levels.entries()].sort());
      if (maps.published.size) raw.published_inflation[`${sector}:${k}`] = Object.fromEntries([...maps.published.entries()].sort());
    }
  }
  raw.levels["back:combined:headline"] = Object.fromEntries([...back.levels.entries()].sort());
  raw.published_inflation["back:combined:headline"] = Object.fromEntries([...back.published.entries()].sort());
  writeRaw(root, "data/raw/cpi-2024-indices.json", raw);

  // the full hierarchy below the divisions (groups/classes/sub-classes/items)
  const rawGrid = {
    vintage, unit: `index, base ${base}`,
    note: "All India, Combined; every level of the COICOP-2018-style hierarchy below the 13 divisions, keyed sector:code:name. " +
      "Classes and sub-classes are archived here only — baked bundles carry the group and item levels. " +
      "imputed_months lists item-months flagged imputation=Y at source (none so far: every row served is N).",
    levels: {}, published_inflation: {}, imputed_months: {},
  };
  for (const lv of ["group", "class", "sub_class", "item"]) {
    for (const s of Object.values(grid[lv])) {
      const key = `combined:${s.code}:${slugify(s.name)}`;
      rawGrid.levels[key] = Object.fromEntries([...s.levels.entries()].sort());
      if (s.published.size) rawGrid.published_inflation[key] = Object.fromEntries([...s.published.entries()].sort());
      if (s.imputedMonths.length) rawGrid.imputed_months[key] = s.imputedMonths.sort();
    }
  }
  writeRaw(root, "data/raw/cpi-2024-grid.json", rawGrid);

  const rawStates24 = { vintage, unit: `index, base ${base}, published General index`, levels: {}, published_inflation: {} };
  for (const [sector, byKey] of Object.entries(stateLevels24)) {
    for (const [k, s] of Object.entries(byKey)) {
      rawStates24.levels[`${sector}:${k}`] = Object.fromEntries([...s.levels.entries()].sort());
      if (s.published.size) rawStates24.published_inflation[`${sector}:${k}`] = Object.fromEntries([...s.published.entries()].sort());
    }
  }
  writeRaw(root, "data/raw/cpi-2024-states-indices.json", rawStates24);

  /* ---- the continuous 2024-base headline (NSO back-cast + live, one ruler) ----
   * Not a cross-base splice: the back-cast and the live levels are both base
   * 2024=100. The 2025 y/y is computed at the handoff from back-cast 2024
   * levels to live 2025 levels. Headline only — the NSO back-casts no components. */
  const curHeadLv = cur.combined.headline.levels;   // Map ym→level, live (2025–2026)
  {
    const dates = [...bundleBack2024.dates], vals = [...bundleBack2024.series.headline.data];
    for (let m = 1; m <= 12; m++) {
      const mm = String(m).padStart(2, "0");
      const a = curHeadLv.get(`2025-${mm}`), b = back.levels.get(`2024-${mm}`);
      if (a != null && b != null) { dates.push(`2025-${mm}-01`); vals.push(Math.round((a / b - 1) * 10000) / 100); }
    }
    for (let i = 0; i < bundle2024.dates.length; i++) {
      if (bundle2024.dates[i] >= "2026-01-01") { dates.push(bundle2024.dates[i]); vals.push(bundle2024.series.headline.data[i]); }
    }
    const bundleLinked2024 = {
      // the back-cast's meta, but the period and release are the LIVE print's:
      // the linked line ends where the current series ends, not in 2024
      meta: { ...bundleBack2024.meta,
        latestPeriod: bundle2024.meta.latestPeriod,
        releaseDate: bundle2024.meta.releaseDate,
        revisionPolicy: bundle2024.meta.revisionPolicy,
        coverage: "All India, Combined; continuous General index on base 2024=100 — NSO back-cast (2013–2024) bridged to live levels (2025) and the current print (2026), one ruler throughout",
        note: "A single continuous headline on the 2024 base. The NSO publishes its own back-cast to 2013 (series=Back) and live levels from 2025 (series=Current); the 2025 year-on-year is computed at the handoff from back-cast 2024 levels to current 2025 levels. No 2012-base figure enters this series — it is not a cross-base splice. Headline only; the NSO back-casts no components." },
      dates,
      series: { headline: { name: "cpi2024_linked_headline_yoy_pct", label: "Headline · base 2024 (linked)", color: "#2E4BD8", data: vals } },
    };
    writeSeries(root, "data/series/cpi-2024-linked.json", bundleLinked2024);
  }

  writeSeries(root, "data/series/cpi-2024.json", bundle2024);
  writeSeries(root, "data/series/cpi-2024-sectors.json", bundleSectors2024);
  writeSeries(root, "data/series/cpi-2024-back.json", bundleBack2024);
  writeSeries(root, "data/series/cpi-2024-groups.json", bundleGroups2024);
  writeSeries(root, "data/series/cpi-2024-items.json", bundleItems2024);
  writeSeries(root, "data/series/cpi-2024-states.json", bundleStates2024);
  writeSeries(root, "data/series/cpi-2024-states-sectors.json", bundleStatesSectors2024);
  if (dcfg.deep2024) await buildCpi2024Deep(root, dcfg, vintage, { fd, years, divisions, backYears, releaseDate, meta, cur, grid, stateLevels24, keyOf });
  return bundle2024;
}

/* =========================================================================
 * Base 2012, deep (wave 2, lb/prices). The bundles above carry the headline, food, fuel,
 * core, the 21 combined sub-groups and the General index by state. This adds the rest of
 * what the NSO serves on the 2012 base:
 *   cpi-groups                         All India combined: pan, clothing, housing, misc
 *   cpi-rural-detail, cpi-urban-detail All India by sector: the groups not in cpi-rural /
 *                                      cpi-urban, the Consumer Food Price index, every sub-group
 *   cpi-states-groups[-rural|-urban]   state x every group (General is in cpi-states)
 *   cpi-states-subgroups[-rural|-urban] state x every sub-group
 *   cpi-items-2012                     the 299 items, All India combined (served from 2014)
 *   cpi-2012-early, cpi-2012-early-states  2012 to 2015, the years before the main bundles'
 *                                      window: 2012 from the NSO back series (series=Back, levels
 *                                      for 2011 and 2012), 2013 at the handoff (Current 2013 over
 *                                      Back 2012), 2014-15 Current over Current. One 2012=100
 *                                      ruler; an agency bridge in sources.yml seams.
 *
 * Fetching. One call per (state, sector, year) carries every group and sub-group (about 336
 * rows, 4 pages). The API's pagination on this base is LOSSY: a page boundary can repeat
 * some rows and drop others while the total still matches (All India combined 2020: 336
 * rows, 331 distinct). So each year's rows are grouped by month, and any month with a
 * repeated node or fewer nodes than the year's fullest month is fetched again on its own
 * (month_code is honoured: 28 rows, one page, no boundary).
 * ========================================================================= */
async function fetch2012Year(dcfg, params, keyOf) {
  const rows = await mospiAll(dcfg.fetch.endpoint, { base_year: 2012, level: params.level ?? "Group", series: params.series, state_code: params.state_code, sector_code: params.sector_code, year: params.year });
  const byMonth = new Map();
  for (const r of rows) (byMonth.get(r.month) ?? byMonth.set(r.month, []).get(r.month)).push(r);
  const full = Math.max(0, ...[...byMonth.values()].map((rs) => new Set(rs.map(keyOf)).size));
  const out = [];
  let refetched = 0;
  for (const [month, rs] of byMonth) {
    const distinct = new Set(rs.map(keyOf)).size;
    if (distinct === rs.length && distinct === full) { out.push(...rs); continue; }
    const mc = MONTHS.indexOf(month) + 1;
    const again = await mospiAll(dcfg.fetch.endpoint, { base_year: 2012, level: params.level ?? "Group", series: params.series, state_code: params.state_code, sector_code: params.sector_code, year: params.year, month_code: mc });
    if (new Set(again.map(keyOf)).size !== again.length) throw new Error(`cpi 2012: ${JSON.stringify(params)} ${month} repeats a node even alone`);
    out.push(...again);
    refetched++;
  }
  return { rows: out, refetched };
}

async function buildCpi2012Deep(root, dcfg, vintage, { states, axis, releaseDate, endYear }) {
  const startYear = 2013;   // the Current series serves levels from January 2013
  const SEC = { combined: 3, rural: 1, urban: 2 };
  const nodeKey = (r) => (/-overall$/i.test(r.subgroup ?? "") || r.subgroup == null ? `g:${r.group}` : `s:${r.group}|${r.subgroup}`);
  const nodeLabel = (k) => (k.startsWith("g:") ? k.slice(2) : k.split("|")[1]);
  const stList = Object.entries(states).map(([name, code]) => ({ name: String(code) === "99" ? "All India" : name, code, key: String(code) === "99" ? "all_india" : slugify(name) }));
  // lv[series][sector][stateKey][node] = Map(ym -> level)
  const lv = { Current: {}, Back: {} };
  let refetched = 0;
  for (const st of stList) for (const [sector, sc] of Object.entries(SEC)) {
    for (const [series, years] of [["Current", Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i)], ["Back", [2011, 2012]]]) for (const year of years) {
      const { rows, refetched: n } = await fetch2012Year(dcfg, { series, state_code: st.code, sector_code: sc, year }, (r) => `${nodeKey(r)}|${r.month}`);
      refetched += n;
      for (const r of rows) {
        const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
        const v = parseFloat(r.index);
        if (m === "00" || !Number.isFinite(v) || v === 0) continue;
        ((((lv[series][sector] ??= {})[st.key] ??= {})[nodeKey(r)]) ??= new Map()).set(`${r.year}-${m}`, v);
      }
    }
  }
  process.stdout.write(`cpi 2012 deep: ${stList.length} states x 3 sectors fetched; ${refetched} month(s) re-read alone after a lossy page\n`);
  if (!lv.Current.combined?.all_india?.["g:General Index"]?.size && !Object.keys(lv.Current.combined?.all_india ?? {}).length) throw new Error("cpi 2012 deep: no data returned");

  /* the 299 items, All India combined; the item level carries no codes, only names */
  const itemLv = {};
  for (let year = 2014; year <= endYear; year++) {
    const { rows } = await fetch2012Year(dcfg, { level: "Item", series: "Current", state_code: 99, sector_code: 3, year }, (r) => `${r.item}|${r.month}`);
    for (const r of rows) {
      const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
      const v = parseFloat(r.index);
      if (m === "00" || !Number.isFinite(v) || v === 0) continue;
      (itemLv[r.item] ??= new Map()).set(`${r.year}-${m}`, v);
    }
  }
  if (Object.keys(itemLv).length < 290) throw new Error(`cpi 2012 items: ${Object.keys(itemLv).length} items, expected 299`);

  const dates = axis.map((m) => `${m}-01`);
  const lastMonth = axis.at(-1);
  const meta = (coverage, extra = {}) => ({
    dossier: "cpi", frequency: "monthly", base: dcfg.base, source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND", latestPeriod: lastMonth, releaseDate, coverage, revisionPolicy: dcfg.revision_policy, ...extra,
  });
  const ser = (map, ax, extra) => {
    const yy = yoyFromLevels(map);
    const ds = ax.map((m) => `${m}-01`);
    const data = ax.map((m) => yy.get(m) ?? null);
    const first = data.findIndex((v) => v != null);
    const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = first < 0 ? [] : ds.filter((d, j) => j > first && j < last && data[j] == null);
    return { color: GREYS[0], unit: "pct_yoy", ...extra, data, ...(gaps.length ? { gaps, gapsNote: "The NSO published no index for these months (chiefly April and May 2020 and 2021, when price collection stopped), or none a year earlier." } : {}) };
  };
  const out = {};
  const keyName = (k) => slugify(nodeLabel(k));
  const isGroup = (k) => k.startsWith("g:");
  const GENERAL = (k) => /^g:general/i.test(k);
  const BAKED_GROUPS = /^g:(general|food and beverages|fuel and light)/i;   // already in cpi / cpi-rural / cpi-urban
  // All India
  {
    const ai = lv.Current.combined.all_india;
    const series = {};
    for (const k of Object.keys(ai).filter((k) => isGroup(k) && !BAKED_GROUPS.test(k) && !/consumer food/i.test(k)).sort())
      series[keyName(k)] = ser(ai[k], axis, { name: `cpi_${keyName(k)}_yoy_pct`, label: nodeLabel(k) });
    out["cpi-groups"] = { meta: meta("All India, Combined; the four groups beyond food and fuel (pan, clothing, housing, miscellaneous)"), dates, series };
    for (const sector of ["rural", "urban"]) {
      const a = lv.Current[sector].all_india;
      const series = {};
      for (const k of Object.keys(a).filter((k) => !BAKED_GROUPS.test(k)).sort())
        series[keyName(k)] = ser(a[k], axis, { name: `cpi_${sector}_${keyName(k)}_yoy_pct`, label: `${nodeLabel(k)}, ${sector}`, group: isGroup(k) ? "Groups" : k.slice(2).split("|")[0] });
      out[`cpi-${sector}-detail`] = { meta: meta(`All India, ${sector[0].toUpperCase() + sector.slice(1)}; the groups not in cpi-${sector}, the Consumer Food Price index and every sub-group`), dates, series };
    }
  }
  // states x groups, states x sub-groups
  for (const sector of ["combined", "rural", "urban"]) for (const kind of ["groups", "subgroups"]) {
    const series = {};
    for (const st of stList) {
      if (st.key === "all_india") continue;
      const nodes = lv.Current[sector]?.[st.key] ?? {};
      for (const k of Object.keys(nodes).filter((k) => (kind === "groups" ? isGroup(k) && !GENERAL(k) : !isGroup(k))).sort())
        series[`${st.key}__${keyName(k)}`] = ser(nodes[k], axis, { name: `cpi_${st.key}_${sector}_${keyName(k)}_yoy_pct`, label: `${st.name}: ${nodeLabel(k)}${sector === "combined" ? "" : ", " + sector}`, group: st.name, state: st.name });
    }
    for (const [k, s] of Object.entries(series)) if (s.data.every((v) => v == null)) delete series[k];
    out[`cpi-states-${kind}${sector === "combined" ? "" : "-" + sector}`] = { meta: meta(`States/UTs x ${kind === "groups" ? "group" : "sub-group"}, ${sector[0].toUpperCase() + sector.slice(1)}; published indices`), dates, series };
  }
  // items
  {
    const itAxis = monthAxis("2015-01", lastMonth);
    const series = {};
    for (const name of Object.keys(itemLv).sort()) {
      const own = [...itemLv[name].keys()].sort();
      series[slugify(name)] = ser(itemLv[name], itAxis, { name: `cpi_item_${slugify(name)}_yoy_pct`, label: name, latest_level: itemLv[name].get(own.at(-1)) ?? null, latest_level_month: own.at(-1) });
    }
    out["cpi-items-2012"] = { meta: { ...meta(`All India, Combined; the ${Object.keys(series).length} items of the 2012 basket (served from January 2014, so y/y from January 2015)`), note: "Item indices carry no weights in the API, so no recomposition is asserted. latest_level is each item's index (2012=100) at its last published month." }, dates: itAxis.map((m) => `${m}-01`), series };
  }
  // the early years, 2012 to 2015: before the main bundles' window opens (January 2016).
  // y/y for 2012 is Back over Back, for 2013 Current over Back (the handoff), for 2014 and
  // 2015 Current over Current: one 2012=100 ruler throughout, the first two years resting on
  // the NSO's own back series (an agency bridge in sources.yml seams).
  {
    const eax = monthAxis("2012-01", "2015-12");
    const joined = (sector, stKey, k) => {
      const m = new Map();
      for (const [ym, v] of lv.Back[sector]?.[stKey]?.[k] ?? []) if (ym <= "2012-12") m.set(ym, v);
      for (const [ym, v] of lv.Current[sector]?.[stKey]?.[k] ?? []) if (ym >= "2013-01" && ym <= "2015-12") m.set(ym, v);
      return m;
    };
    const mk = (stFilter) => {
      const series = {};
      for (const st of stList.filter(stFilter)) for (const sector of ["combined", "rural", "urban"]) {
        const nodes = new Set([...Object.keys(lv.Back[sector]?.[st.key] ?? {}), ...Object.keys(lv.Current[sector]?.[st.key] ?? {})]);
        for (const k of [...nodes].sort()) {
          const s = ser(joined(sector, st.key, k), eax, { name: `cpi_early_${st.key}_${sector}_${keyName(k)}_yoy_pct`, label: `${st.key === "all_india" ? "" : st.name + ": "}${nodeLabel(k)}, ${sector}`, group: st.key === "all_india" ? sector : st.name });
          if (s.data.some((v) => v != null)) series[`${st.key === "all_india" ? "" : st.key + "__"}${sector}__${keyName(k)}`] = s;
        }
      }
      return series;
    };
    const note = "The 2012 base's early years, January 2012 to December 2015, before this guide's main 2012-base bundles open (January 2016). One 2012=100 ruler: y/y for 2012 is the NSO back series (series=Back) over itself, for 2013 the Current level over the Back level a year earlier, for 2014 and 2015 Current over Current.";
    out["cpi-2012-early"] = { meta: { ...meta("All India, three sectors; every group and sub-group, 2012 to 2015"), latestPeriod: "2015-12", releaseDate: null, note }, dates: eax.map((m) => `${m}-01`), series: mk((st) => st.key === "all_india") };
    out["cpi-2012-early-states"] = { meta: { ...meta("States/UTs, three sectors; every group and sub-group, 2012 to 2015"), latestPeriod: "2015-12", releaseDate: null, note }, dates: eax.map((m) => `${m}-01`), series: mk((st) => st.key !== "all_india") };
  }

  // raw: every level read, one row string per (series, sector, state, node)
  {
    const rows = [];
    for (const [series, bySec] of Object.entries(lv)) for (const [sector, bySt] of Object.entries(bySec)) for (const stKey of Object.keys(bySt).sort()) for (const k of Object.keys(bySt[stKey]).sort())
      rows.push([series, sector, stKey, k.slice(2), ...[...bySt[stKey][k].entries()].sort().map(([m, v]) => `${m}=${v}`)].join(";"));
    for (const name of Object.keys(itemLv).sort()) rows.push(["Item", "combined", "all_india", name, ...[...itemLv[name].entries()].sort().map(([m, v]) => `${m}=${v}`)].join(";"));
    writeRaw(root, "data/raw/cpi-2012-grid.json", {
      vintage, unit: "index, base 2012=100",
      note: "Every group and sub-group the NSO serves on the 2012 base for every state/UT and All India x sector (series Current and Back), and the 299 All-India items. Each row: series;sector;state;node (group, or group|sub-group);then month=level pairs.",
      rows,
    });
  }
  for (const [slug, b] of Object.entries(out)) writeSeries(root, `data/series/${slug}.json`, b);
}

/* =========================================================================
 * Base 2024, deep (wave 2, lb/prices): every node of the hierarchy for every state and
 * sector the NSO publishes, plus the NSO back series for rural and urban.
 *
 * One fetch2024Slice per (state, sector, month): 36 states/UTs and All India x combined,
 * rural, urban x every Current month = about 2,300 slices of 6 or 7 pages. Every slice must
 * hold each node once (checked), and its row count must equal totalRecords (mospiAll).
 *
 * Baked (y/y from levels, on the window2024 axis, the first month with a same-base
 * year-ago level):
 *   cpi-2024-classes, cpi-2024-subclasses           All India combined, 92 and 162
 *   cpi-2024-<rural|urban>-<divisions|groups|classes|subclasses|items>   All India by sector
 *   cpi-2024-states-divisions[-rural|-urban]        36 states x 12 divisions
 *   cpi-2024-states-groups[-rural|-urban]           36 states x 43 groups
 *   cpi-2024-back-sectors                           NSO back series, rural and urban General
 * Archived (deep-archive tier, PLAN-launch §2b; git-ignored staging, long csv.gz):
 *   data/archive/staging/cpi/cpi-2024-states-<class|subclass|item>.csv.gz  state x sector x
 *   node x month: index level, y/y, the NSO's published inflation, imputation flag.
 * Raw (the audit trail): data/raw/cpi-2024-states-grid.json, every level of every slice,
 * one row string per node.
 * ========================================================================= */
const LEVEL_OF = (r) => r.item != null ? "item" : r.sub_class != null ? "subclass" : r.class != null ? "class" : r.group != null ? "group" : r.code == null ? "general" : "division";
const NAME_OF = (r, lv) => ({ item: r.item, subclass: r.sub_class, class: r.class, group: r.group, division: r.division, general: "CPI (General)" }[lv]);

async function buildCpi2024Deep(root, dcfg, vintage, { fd, years, divisions, backYears, meta, cur, grid, stateLevels24, keyOf }) {
  const SEC = { combined: 3, rural: 1, urban: 2 };
  const states = fd.state.map((s) => ({ code: s.state_code, name: s.state_name, key: s.state_code === 1 ? "all_india" : slugify(s.state_name) }));
  // store[sector][stateKey][code] = { level, name, division, levels, published, imputed }
  const store = { combined: {}, rural: {}, urban: {} };
  let slices = 0, emptySlices = 0;
  const thisMonth = new Date().toISOString().slice(0, 7);
  for (const st of states) for (const [sector, sc] of Object.entries(SEC)) for (const year of years) for (let mc = 1; mc <= 12; mc++) {
    const ymm = `${year}-${String(mc).padStart(2, "0")}`;
    if (ymm >= thisMonth) continue;   // a month's CPI is released on the 12th of the next month at the earliest
    const rows = await fetch2024Slice(dcfg, st.code, sc, year, mc);
    if (!rows.length) { emptySlices++; continue; }
    slices++;
    const seen = new Set();
    for (const r of rows) {
      const lv = LEVEL_OF(r), code = r.code ?? "0";
      if (seen.has(code)) throw new Error(`cpi-2024 deep: node ${code} twice in ${st.name} ${sector} ${ymm}`);
      seen.add(code);
      const v = parseFloat(r.index);
      const node = ((store[sector][st.key] ??= {})[code] ??= { level: lv, name: NAME_OF(r, lv), division: r.division, levels: new Map(), published: new Map(), imputed: [] });
      if (Number.isFinite(v) && v !== 0) node.levels.set(ymm, v);
      const inf = parseFloat(r.inflation);
      if (Number.isFinite(inf)) node.published.set(ymm, inf);
      if (r.imputation === "Y") node.imputed.push(ymm);
    }
  }
  process.stdout.write(`cpi-2024 deep: ${slices} slices with data, ${emptySlices} empty (months not yet released, or a sector a state does not have)\n`);
  const ai = store.combined.all_india;
  if (!ai || Object.keys(ai).length < 600) throw new Error("cpi-2024 deep: no data returned for All India combined");

  // The headline, grid and state-General fetches above page by hand (a division's aggregate
  // sits ~23 pages deep, so they cannot use mospiAll). Every value they produced must equal
  // the same node in these slices, which mospiAll audits for slipped pages: a mismatch
  // means one of the two reads lost or repeated a row, and nothing is baked.
  {
    const bad = [];
    const cmp = (label, a, b) => { for (const [ym, v] of a ?? []) { const w = b?.get(ym); if (w != null && Math.abs(w - v) > 1e-9) bad.push(`${label} ${ym}: ${v} vs ${w}`); } };
    const divCode = (d) => (d.division_code === 0 ? "0" : String(d.division_code).padStart(2, "0"));
    for (const sector of ["combined", "rural", "urban"]) for (const d of divisions) cmp(`${sector} ${d.division_name}`, cur[sector][keyOf(d)].levels, store[sector].all_india?.[divCode(d)]?.levels);
    for (const lv of Object.keys(grid)) for (const [code, g] of Object.entries(grid[lv])) cmp(`grid ${code}`, g.levels, ai[code]?.levels);
    const stKeyOf = Object.fromEntries(fd.state.map((x) => [slugify(x.state_name), x.state_code === 1 ? "all_india" : slugify(x.state_name)]));
    for (const sector of ["combined", "rural", "urban"]) for (const [k, st] of Object.entries(stateLevels24[sector])) cmp(`${k} ${sector} General`, st.levels, store[sector][stKeyOf[k]]?.["0"]?.levels);
    if (bad.length) throw new Error(`cpi-2024: ${bad.length} values differ between the hand-paged fetches and the audited slices, e.g. ${bad.slice(0, 3).join("; ")}`);
    process.stdout.write("cpi-2024: every headline, grid and state-General value equals the audited state x sector slices\n");
  }

  const months = [...ai["0"].levels.keys()].sort();
  const lastMonth = months.at(-1);
  const axis = monthAxis(dcfg.window2024.start, lastMonth);
  const dates = axis.map((m) => `${m}-01`);
  const yoyData = (node) => { const yy = yoyFromLevels(node.levels); return axis.map((m) => yy.get(m) ?? null); };
  const withGaps = (s) => {
    const first = s.data.findIndex((v) => v != null);
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = first < 0 ? [] : dates.filter((d, j) => j > first && j < last && s.data[j] == null);
    return gaps.length ? { ...s, gaps, gapsNote: "The NSO published no index for this cut in these months, or none a year earlier." } : s;
  };
  const stName = Object.fromEntries(states.map((s) => [s.key, s.name]));
  const LVL = { division: "divisions", group: "groups", class: "classes", subclass: "subclasses", item: "items" };
  const LVLN = { division: "division", group: "group", class: "class", subclass: "sub-class", item: "item" };
  const nodesOf = (sector, stKey, lv) => Object.entries(store[sector][stKey] ?? {}).filter(([, n]) => n.level === lv).sort(([a], [b]) => (a < b ? -1 : 1));
  const out = {};
  const put = (slug, coverage, series, extra = {}) => {
    const cross = {};
    for (const [k, s] of Object.entries(series)) { cross[k] = s._pub; delete s._pub; }
    for (const [k, s] of Object.entries(series)) if (s.data.every((v) => v == null)) { delete series[k]; delete cross[k]; }
    out[slug] = { meta: meta(coverage, extra), dates, series, crosscheck: { published_inflation: cross } };
  };
  const seriesOf = (node, code, key, label, name, extra = {}) => withGaps({
    name, label, color: GREYS[0], code: code === "0" ? null : code, division: node.division, unit: "pct_yoy", ...extra,
    data: yoyData(node), _pub: axis.map((m) => node.published.get(m) ?? null),
    ...(node.imputed.length ? { imputed_months: [...node.imputed].sort() } : {}),
  });
  // All India: classes and sub-classes (combined); every level by sector
  for (const lv of ["class", "subclass"]) {
    const series = {};
    for (const [code, n] of nodesOf("combined", "all_india", lv)) series[`${slugify(n.name)}_${code.replace(/\./g, "_")}`] = seriesOf(n, code, null, n.name, `cpi2024_${lv}_${code.replace(/\./g, "_")}_yoy_pct`);
    put(`cpi-2024-${LVL[lv]}`, `All India, Combined; the ${Object.keys(series).length} ${LVLN[lv]}${lv === "class" ? "es" : "es"} of the 2024 basket`, series);
  }
  for (const sector of ["rural", "urban"]) for (const lv of ["division", "group", "class", "subclass", "item"]) {
    const series = {};
    for (const [code, n] of nodesOf(sector, "all_india", lv)) series[`${slugify(n.name)}_${code.replace(/\./g, "_")}`] = seriesOf(n, code, null, `${n.name}, ${sector}`, `cpi2024_${sector}_${lv}_${code.replace(/\./g, "_")}_yoy_pct`, { group: n.division });
    put(`cpi-2024-${sector}-${LVL[lv]}`, `All India, ${sector[0].toUpperCase() + sector.slice(1)}; the ${Object.keys(series).length} ${LVL[lv].replace("subclasses", "sub-classes")} of the 2024 basket`, series);
  }
  // states x divisions and groups, each sector
  for (const lv of ["division", "group"]) for (const sector of ["combined", "rural", "urban"]) {
    const series = {};
    for (const st of states) {
      if (st.key === "all_india") continue;
      for (const [code, n] of nodesOf(sector, st.key, lv)) series[`${st.key}__${code.replace(/\./g, "_")}`] = seriesOf(n, code, null, `${st.name}: ${n.name}${sector === "combined" ? "" : ", " + sector}`, `cpi2024_${st.key}_${sector}_${lv}_${code.replace(/\./g, "_")}_yoy_pct`, { group: st.name, state: st.name, node: n.name });
    }
    put(`cpi-2024-states-${LVL[lv]}${sector === "combined" ? "" : "-" + sector}`, `States/UTs x ${LVL[lv]}, ${sector[0].toUpperCase() + sector.slice(1)}; published indices (state baskets differ, no all-India weights applied)`, series);
  }

  // back series, rural and urban General (the NSO's own back-cast on this base)
  {
    const back = {};
    for (const [sector, sc] of [["rural", 1], ["urban", 2]]) {
      const rows = [];
      for (const year of backYears) rows.push(...await fetch2024DivisionYear(dcfg, sc, 0, year, "Back"));
      back[sector] = rows2024ToMaps(rows);
    }
    const bm = [...new Set([...back.rural.levels.keys(), ...back.urban.levels.keys()])].sort();
    const yy = { rural: yoyFromLevels(back.rural.levels), urban: yoyFromLevels(back.urban.levels) };
    const ym = [...new Set([...yy.rural.keys(), ...yy.urban.keys()])].sort();
    if (!ym.length) throw new Error("cpi-2024 back sectors: no data returned");
    const bax = monthAxis(ym[0], ym.at(-1));
    out["cpi-2024-back-sectors"] = {
      meta: { ...meta("All India, Rural and Urban; General index only, NSO back series"), latestPeriod: bax.at(-1), releaseDate: null,
        note: "The NSO's own back-cast of the 2024-base General index for rural and urban India (series=Back), " + bm[0].slice(0, 4) + " to " + bm.at(-1).slice(0, 4) + ". A linking series published by the NSO, not by India Atlas; never merged with the 2012-base series or with the Current series." },
      dates: bax.map((m) => `${m}-01`),
      series: Object.fromEntries(["rural", "urban"].map((sector, i) => [sector, { name: `cpi2024_back_${sector}_yoy_pct`, label: `Headline, ${sector}, base 2024, NSO back-cast`, color: GREYS[i], unit: "pct_yoy", data: bax.map((m) => yy[sector].get(m) ?? null) }])),
      crosscheck: { published_inflation: Object.fromEntries(["rural", "urban"].map((sector) => [sector, bax.map((m) => back[sector].published.get(m) ?? null)])) },
    };
    writeRaw(root, "data/raw/cpi-2024-back-sectors.json", { vintage, unit: "index, base 2024=100", levels: Object.fromEntries(["rural", "urban"].map((s) => [s, Object.fromEntries([...back[s].levels.entries()].sort())])), published_inflation: Object.fromEntries(["rural", "urban"].map((s) => [s, Object.fromEntries([...back[s].published.entries()].sort())])) });
  }

  // raw: every node of every slice, one row string per (sector, state, code)
  {
    const allMonths = [...new Set(Object.values(store).flatMap((bySt) => Object.values(bySt).flatMap((nodes) => Object.values(nodes).flatMap((n) => [...n.levels.keys()]))))].sort();
    const rows = [];
    for (const [sector, bySt] of Object.entries(store)) for (const stKey of Object.keys(bySt).sort()) for (const [code, n] of Object.entries(bySt[stKey]).sort(([a], [b]) => (a < b ? -1 : 1)))
      rows.push([sector, stKey, n.level, code, n.name, ...allMonths.map((m) => n.levels.get(m) ?? ""), ...allMonths.map((m) => n.published.get(m) ?? ""), n.imputed.sort().join(" ")].join(";"));
    writeRaw(root, "data/raw/cpi-2024-states-grid.json", {
      vintage, unit: "index, base 2024=100",
      note: "Every node of the base-2024 hierarchy for every state/UT (and All India) x sector x month the NSO serves (getCPIData, series=Current, one call per state x sector x month). " +
        "Each row: sector;state;level;code;name; then the index level for each month in `months`; then the NSO's published inflation for each month; then the months the item's index was imputed (flag Y). Empty cell = not served.",
      states: stName, months: allMonths, rows,
    });
  }

  // deep archive: state x sector x (class, sub-class, item), long csv.gz
  {
    const STAGE = "data/archive/staging/cpi";
    fs.mkdirSync(path.join(root, STAGE), { recursive: true });
    const csvCell = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const files = [];
    for (const lv of ["class", "subclass", "item"]) {
      const lines = [["state", "sector", "level", "code", "name", "division", "date", "index", "yoy_pct", "published_inflation_pct", "imputed", "unit", "base", "source", "vintage"].join(",")];
      let n = 0;
      for (const sector of ["combined", "rural", "urban"]) for (const st of states) {
        if (st.key === "all_india") continue;
        for (const [code, node] of nodesOf(sector, st.key, lv)) {
          const yy = yoyFromLevels(node.levels);
          for (const m of [...node.levels.keys()].sort()) {
            lines.push([st.name, sector, LVLN[lv], code, node.name, node.division, `${m}-01`, node.levels.get(m), yy.get(m) ?? "", node.published.get(m) ?? "", node.imputed.includes(m) ? "Y" : "N", "index", "2024=100", "MoSPI, NSO", vintage].map(csvCell).join(","));
            n++;
          }
        }
      }
      const file = `${STAGE}/cpi-2024-states-${LVL[lv]}.csv.gz`;
      fs.writeFileSync(path.join(root, file), zlib.gzipSync(lines.join("\n") + "\n", { level: 9 }));
      files.push({ file, rows: n, level: LVLN[lv], rolls_up_to: ["cpi-2024-states-groups", "cpi-2024-states-groups-rural", "cpi-2024-states-groups-urban"] });
    }
    fs.writeFileSync(path.join(root, STAGE, "files.json"), JSON.stringify({ note: "Staged base-2024 CPI state x sector x class, sub-class and item tables for the deep archive (long format, one row per state, sector, node and month).", files }, null, 1) + "\n");
    process.stdout.write(`cpi-2024 deep: archive ${files.map((f) => `${f.level} ${f.rows}`).join(", ")} rows in ${STAGE}\n`);
  }

  for (const [slug, b] of Object.entries(out)) writeSeries(root, `data/series/${slug}.json`, b);
}

/* =========================================================================
 * CPI on base 2010=100 — ARCHIVED, NOT BAKED. Probed live 2026-08-08: the
 * API serves a 48-month fragment, Jan 2011 – Dec 2014, on the pre-2012
 * scheme (7 groups / 28 subgroups, state_code 99 = All India). Its entire
 * span predates the dossier's 2016 window and overlaps the retired 2012
 * base for 2013–14; baking it would put a third ruler on the seam plate for
 * 48 months of superseded readings. The All-India combined table is
 * archived raw as the audit trail; the decision is documented in
 * data/sources.yml. First-year rows carry inflation=null (no 2010 monthly
 * levels exist to divide by), which is preserved as-is.
 * ========================================================================= */
export async function buildCpi2010Archive(root, dcfg, vintage) {
  const filt = await mospi("cpi/getCpiFilterByLevelAndBaseYear", {
    base_year: 2010, level: "Group", series: "Current",
  });
  // this base's filter payload wraps the object directly in data (the 2024
  // base wraps it in a one-element array) — handle both shapes
  const fd = (Array.isArray(filt.data) ? filt.data[0] : filt.data) ?? {};
  const years = (fd.year ?? []).map((y) => y.year).sort();
  if (!years.length) throw new Error("CPI 2010 archive: filter served no years");
  const seen = new Set();
  const rows = [];
  for (const year of years) {
    for (let page = 1; page <= 8; page++) {
      const res = await mospi("cpi/getCPIData", {
        base_year: 2010, level: "Group", series: "Current",
        state_code: 99, sector_code: 3, year, page, limit: 100,
      });
      const batch = res.data ?? [];
      let added = 0;
      for (const r of batch) {
        const k = JSON.stringify(r);
        if (!seen.has(k)) { seen.add(k); rows.push(r); added++; }
      }
      if (batch.length < 100 || added === 0) break;
    }
  }
  const levels = {}, published = {};
  for (const r of rows) {
    const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
    if (m === "00") continue;
    const ym = `${r.year}-${m}`;
    const key = `combined:${slugify(r.subgroup)}`;
    const v = parseFloat(r.index);
    if (Number.isFinite(v) && v !== 0) (levels[key] ??= {})[ym] = v;
    const inf = parseFloat(r.inflation);
    if (Number.isFinite(inf)) (published[key] ??= {})[ym] = inf;
  }
  process.stdout.write(`cpi-2010 archive: ${rows.length} rows, ${Object.keys(levels).length} subgroups, years ${years.join(", ")}\n`);
  writeRaw(root, "data/raw/cpi-2010-indices.json", {
    vintage, unit: "index, base 2010=100",
    note: "ARCHIVE ONLY, never baked. The API's base-2010 CPI is a 48-month fragment (Jan 2011 – Dec 2014) on the pre-2012 " +
      "group/subgroup scheme; its span predates the dossier window and is superseded by the 2012 base. All India, Combined, " +
      "all 28 subgroups. 2011 rows carry no published inflation (no 2010 monthly levels).",
    levels, published_inflation: published,
  });
}

/* =========================================================================
 * Catalogue (docs/CONTRACT-coverage.md): what MoSPI publishes for the CPI, from the
 * filter listings (cpi/getCpiFilterByLevelAndBaseYear), one call per base and series.
 *   cpi:2024:<state>:<sector>:<level>:<code-name>   base 2024, Current: every node of the
 *       hierarchy (general, 13 divisions, 43 groups, 92 classes, 162 sub-classes, 358 items)
 *       for every state and sector the listing offers. A probe of Andhra Pradesh, rural,
 *       Aug 2026 served 649 of the 669 nodes: the listing offers the cross, a slice may
 *       leave a few nodes empty.
 *   cpi:2024-back:<state>:<sector>:general        the NSO back series (All India only)
 *   cpi:2012:<state>:<sector>:group|subgroup:<code-name>   base 2012, Current and Back
 *   cpi:2012:all-india:combined:item:<code-name>  the 299 items (All India only)
 *   cpi:2010:<state>:<sector>:group|subgroup:<code-name>   the archived 2010 fragment
 * ========================================================================= */
import { writeCatalogue, idPart, catalogueCli } from "../catalogue.mjs";
export async function catalogueCpi() {
  const items = [];
  const filt = async (base_year, level, series) => {
    const r = await mospi("cpi/getCpiFilterByLevelAndBaseYear", { base_year, level, series });
    return Array.isArray(r.data) ? r.data[0] : r.data;
  };
  const SECT = (f) => (f.sector ?? []).map((s) => idPart(s.sector_name));
  // base 2024, Current
  const f24 = await filt("2024", "Item", "Current");
  const nodes = [{ level: "general", code: "0-general", name: "CPI (General)" }];
  for (const d of f24.division) if (d.division_code !== 0) nodes.push({ level: "division", code: `${d.division_code}-${idPart(d.division_name)}`, name: d.division_name });
  for (const g of f24.group) nodes.push({ level: "group", code: `${g.group_code}-${idPart(g.group_name)}`, name: g.group_name });
  for (const c of f24.Class) nodes.push({ level: "class", code: `${c.class_code}-${idPart(c.class_name)}`, name: c.class_name });
  for (const s of f24.sub_class) nodes.push({ level: "subclass", code: `${s.sub_class_code}-${idPart(s.sub_class_name)}`, name: s.sub_class_name });
  for (const it of f24.item) nodes.push({ level: "item", code: `${it.item_code}-${idPart(it.item_name)}`, name: it.item_name });
  for (const st of f24.state) for (const sec of SECT(f24)) for (const n of nodes)
    items.push({ id: `cpi:2024:${idPart(st.state_name)}:${sec}:${n.level}:${n.code}`, ...(st.state_code === 1 ? { label: n.name } : {}) });   // labels once, on All India: the tail repeats them
  // base 2024, Back (the NSO back-cast)
  const b24 = await filt("2024", "Group", "Back");
  for (const st of b24.state) for (const sec of SECT(b24)) items.push({ id: `cpi:2024-back:${idPart(st.state_name)}:${sec}:general`, label: "CPI (General), NSO back series" });
  // base 2012 and the archived 2010 fragment, group level, every series the listing names
  for (const base of ["2012", "2010"]) {
    const fg = await filt(base, "Group", "Current");
    const series = (fg.series ?? [{ series: "Current" }]).map((s) => s.series);
    for (const ser of series) {
      const f = ser === "Current" ? fg : await filt(base, "Group", ser);
      if (!f?.state) continue;
      const tag = ser === "Current" ? base : `${base}-${idPart(ser)}`;
      for (const st of f.state) for (const sec of SECT(f)) {
        for (const g of f.group ?? []) items.push({ id: `cpi:${tag}:${idPart(st.state_name)}:${sec}:group:${idPart(g.group_code)}-${idPart(g.group_name)}`, label: g.group_name });
        for (const s of f.subgroup ?? []) if (!/-overall$/i.test(s.subgroup_name)) items.push({ id: `cpi:${tag}:${idPart(st.state_name)}:${sec}:subgroup:${idPart(s.subgroup_code)}-${idPart(s.subgroup_name)}`, label: s.subgroup_name });
      }
    }
  }
  // base 2012 items: All India, combined only
  const fi = await filt("2012", "Item", "Current");
  for (const it of fi.item) items.push({ id: `cpi:2012:all-india:combined:item:${idPart(it.item_code)}-${idPart(it.item_name)}`, label: it.item_name });
  writeCatalogue("cpi", {
    source: "MoSPI, NSO: Consumer Price Index (eSankhyiki API)",
    generator: "scripts/lib/products/cpi.mjs --catalogue",
    note: "From the filter listings, one call per base and series. Ids: cpi:<base>:<state>:<sector>:<level>:<code-name>. The listing offers every state x sector x node; a slice can leave a few nodes empty (Andhra Pradesh rural, Aug 2026: 649 of 669 on base 2024).",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueCpi);
