// scripts/lib/products/cckp.mjs: World Bank Climate Change Knowledge Portal, for the
// climate guide. Three instruments, never joined (docs/reference/cckp.md):
//   - CRU TS (Climatic Research Unit, University of East Anglia): weather-station readings
//     interpolated to a 0.5° grid, monthly from 1901. The long, station-based record.
//   - ERA5 (Copernicus / ECMWF reanalysis), downscaled by CCKP to 0.25°, from 1950: a
//     weather model run over the observations. It reaches places and indices stations
//     do not (hot days, wet-bulb temperature, heat index, rain extremes).
//   - CMIP6 (about 30 climate models), downscaled and bias-corrected by CCKP: projections
//     under shared socio-economic pathways (SSPs), summarised as the ensemble median and
//     the 10th and 90th percentiles. Model output, not data: drawn dashed, never joined.
// Every value is CCKP's area average over India's land, or over each state or union
// territory (CCKP's first-level boundaries: 35 units; Telangana and Ladakh are not
// separate units in its boundary set, see the reference note).
//
// Catalogue: `node scripts/lib/products/cckp.mjs --catalogue` walks CCKP's public S3
// bucket (collections, variables, datasets, product files) and writes one item per
// variable x product x aggregation x scenario (x percentile for CMIP6) x geography level
// to data/coverage/climate-cckp.catalogue.json. Generated, never typed.
//
// Quirks (disclosed on the bundles):
//   - Missing values are served as a float fill of about 1e20. They become null.
//   - The seasonal series label December-January-February by January of the later year;
//     its first season (Dec 1949 to Feb 1950) is a fill value.
//   - The simplified wet-bulb globe temperature family (swbgt*) in ERA5 serves fill-like
//     numbers (about 1e18) as values for 2024 and 2025, and readings below the wet-bulb
//     temperature they should exceed. CMIP6 serves no swbgt for India, and its wet-bulb
//     family (wbt*) is corrupt: an India mean of about 8°C against ERA5's 19°C, zero days
//     above every threshold. None of these is baked: recorded `blocked` in the ledger.
//   - An unknown facet combination returns status "success" with empty data, so every
//     call asserts the variables it asked for.
//
// Hand checks (2026-10-09):
//   - CRU TS: CRU's own country file (crucy.v4.10.1901.2025.India.tmp.per) gives India's
//     2016-2025 mean minus 1901-1930 as +0.91°C and 1996-2025 minus 1951-1980 as +0.57°C;
//     from CCKP's aggregation of the same grid, +0.87 and +0.56. Levels differ by ~0.7°C
//     (2024: 24.7 against 25.43), consistent with different India masks (CCKP has no unit
//     for Jammu and Kashmir or Ladakh); 2024 rain agrees (1,256.1 against 1,253.48 mm).
//   - ERA5: CCKP's published 1991-2020 climatology for India (tas 24.21°C, pr 1,189.73 mm,
//     hd35 78.89 days) equals the mean of the annual series baked (validate.mjs checks it).
//   - CMIP6: CCKP is the publisher; climate-cmip6-windows-temp tas SSP2-4.5 2040-2059 median
//     +1.18°C re-read from the API by hand (cmip6-x0.25_climatology_tas_anomaly_annual_...).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { cckp, s3List, geoNames, isFill } from "../cckp.mjs";
import { VARS, THEMES, MAP_ONLY, UNIT_LABEL } from "./cckp-vars.mjs";
import { writeRaw, writeSeries, writeJson } from "../util.mjs";

const COLL = { era5: "era5-x0.25", cru: "cru-x0.5", cmip6: "cmip6-x0.25" };
const SSP_LABEL = { ssp119: "SSP1-1.9", ssp126: "SSP1-2.6", ssp245: "SSP2-4.5", ssp370: "SSP3-7.0", ssp585: "SSP5-8.5", historical: "historical runs" };
const PCT_LABEL = { median: "median", p10: "10th percentile", p90: "90th percentile", mean: "mean" };
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const skey = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/* ---------- S3 discovery ---------- */

// "timeseries-tas-annual-mean_era5-x0.25_era5-x0.25-historical_timeseries_mean_1950-2025.nc"
export function parseFile(name) {
  const base = name.replace(/\.nc$/, "");
  const [head, coll, dataset, category, pct, period] = base.split("_");
  if (!period) return null;
  const [product, variable, agg, stat] = head.split("-");
  // a handful of files break CCKP's own naming pattern: keep them, named as such
  if (!/^[a-z]/.test(product ?? "") || !agg) return { product: "nonstandard-name", variable, agg: "file", stat: null, coll, dataset, category: "file", pct: "file", period: base };
  return { product, variable, agg, stat, coll, dataset, category, pct, period };
}

async function subdirs(prefix) {
  const { prefixes } = await s3List(prefix);
  return prefixes.map((p) => p.slice(prefix.length).replace(/\/$/, "")).filter(Boolean);
}
async function fileList(prefix) {
  const { keys } = await s3List(prefix);
  return keys.map((k) => k.slice(prefix.length)).filter((k) => k.endsWith(".nc")).map(parseFile).filter(Boolean);
}

/** For one collection: { var -> { datasets: [dir], files: { dir -> [parsed] } } } */
export async function discover(coll) {
  const root = `data/${COLL[coll]}/`;
  const out = {};
  for (const v of await subdirs(root)) {
    const dirs = await subdirs(`${root}${v}/`);
    const entry = { datasets: dirs, files: {} };
    const wanted = coll === "cmip6" ? dirs.filter((d) => d.startsWith("ensemble-all-")) : dirs;
    for (const d of wanted) entry.files[d] = await fileList(`${root}${v}/${d}/`);
    out[v] = entry;
  }
  return out;
}

const endYear = (p) => +String(p).split("-")[1];
const latestPeriod = (files, pred) => files.filter(pred).map((f) => f.period).sort((a, b) => endYear(a) - endYear(b) || (a < b ? -1 : 1)).at(-1) ?? null;
const cruVersion = (dirs) => dirs.filter((d) => /^cru-ts[\d.]+-historical$/.test(d)).sort((a, b) => {
  const va = a.match(/ts([\d.]+)/)[1].split(".").map(Number), vb = b.match(/ts([\d.]+)/)[1].split(".").map(Number);
  return va[0] - vb[0] || va[1] - vb[1];
}).at(-1);

/* ---------- catalogue ---------- */

const API_PRODUCTS = new Set(["timeseries", "climatology", "anomaly", "trend"]);

export async function catalogue(root) {
  const items = [];
  const add = (id, label, dims) => items.push({ id, label, dims });
  for (const coll of ["era5", "cru", "cmip6"]) {
    const disc = await discover(coll);
    for (const [v, e] of Object.entries(disc).sort()) {
      const vl = VARS[v]?.label ?? v;
      if (MAP_ONLY.has(v) || !Object.values(e.files).some((f) => f.length)) {
        add(`cckp:${coll}:${v}:map-only`, `${vl}: CCKP map layer (${v})`, { datasets: e.datasets });
        continue;
      }
      let useDirs = Object.keys(e.files);
      if (coll === "cru") {
        const latest = cruVersion(e.datasets);
        const older = e.datasets.filter((d) => d !== latest);
        if (older.length) add(`cckp:cru:${v}:earlier-versions`, `${vl}: earlier CRU TS versions (${older.join(", ")})`, { datasets: older });
        useDirs = [latest];
      }
      if (coll === "cmip6") {
        const single = e.datasets.filter((d) => !d.startsWith("ensemble-all-"));
        if (single.length) add(`cckp:cmip6:${v}:single-models`, `${vl}: ${new Set(single.map((d) => d.replace(/-(historical|ssp\d+)$/, ""))).size} individual model runs`, { runs: single.length });
      }
      const groups = new Map();
      for (const d of useDirs) {
        const scen = coll === "cmip6" ? d.replace("ensemble-all-", "") : "historical";
        for (const f of e.files[d] ?? []) {
          const product = f.category === "timeseries-smooth" ? "timeseries-smooth" : f.product;
          const pct = coll === "cmip6" ? `:${f.pct}` : "";
          const k = `${product}:${f.agg}:${scen}${pct}`;
          if (!groups.has(k)) groups.set(k, { product, agg: f.agg, scen, pct: f.pct, stat: f.stat, periods: new Set(), dataset: d });
          groups.get(k).periods.add(f.period);
        }
      }
      for (const [k, g] of [...groups].sort()) {
        const periods = [...g.periods].sort();
        const what = `${vl}, ${g.product}, ${g.agg}, ${SSP_LABEL[g.scen] ?? g.scen}${coll === "cmip6" ? `, ${PCT_LABEL[g.pct] ?? g.pct}` : ""}`;
        const dims = { product: g.product, agg: g.agg, scenario: g.scen, ...(coll === "cmip6" ? { percentile: g.pct } : {}), periods };
        if (API_PRODUCTS.has(g.product)) {
          add(`cckp:${coll}:${v}:${k}:ind`, `${what}, India`, { ...dims, geo: "IND" });
          add(`cckp:${coll}:${v}:${k}:states`, `${what}, each state and union territory`, { ...dims, geo: "ADM1" });
        } else add(`cckp:${coll}:${v}:${k}:grid`, `${what} (gridded map product)`, dims);
      }
    }
  }
  const out = { family: "climate-cckp", source: "World Bank Climate Change Knowledge Portal (CCKP): ERA5, CRU TS and CMIP6 collections", generator: "scripts/lib/products/cckp.mjs --catalogue",
    generated_at: new Date().toISOString().slice(0, 10), items };
  // compact on purpose: ~24,000 items; one item per line keeps git diffs readable
  fs.writeFileSync(path.join(root, "data/coverage/climate-cckp.catalogue.json"),
    JSON.stringify({ ...out, items: undefined }).replace(/}$/, ',"items":[\n') + out.items.map((i) => JSON.stringify(i)).join(",\n") + "\n]}\n");
  return out;
}

/* ---------- response flattening ---------- */

// The API nests one level per facet given as a list (in facet order), then geocode, then
// "YYYY-MM": value. `levels` names the list facets in that order.
function flatten(data, levels) {
  const out = [];
  (function walk(node, depth, keys) {
    if (depth === levels.length) {
      // a geography the API lists with no values (null) carries nothing to bake
      for (const [geo, ser] of Object.entries(node ?? {})) if (ser && typeof ser === "object") out.push({ ...keys, geo, ser });
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [k, child] of Object.entries(node)) walk(child, depth + 1, { ...keys, [levels[depth]]: k });
  })(data, 0, {});
  return out;
}

// periods are "YYYY-MM" (annual values carry month 07, a mid-year stamp)
const toIso = (p, freq) => (freq === "annual" || freq === "windows" ? `${p.slice(0, 4)}-01-01` : `${p.slice(0, 7)}-01`);

// flatten a CMIP6 response: `facets` is [[name, list]...] in facet order; a facet given as a
// one-item list adds no nesting level, so its single value is filled in afterwards
function flat6(data, v, facets) {
  const node = data?.[v] ?? data;
  const levels = facets.filter(([, l]) => l.length > 1).map(([n]) => n);
  const fixed = Object.fromEntries(facets.filter(([, l]) => l.length === 1).map(([n, l]) => [n, l[0]]));
  return flatten(node, levels).map((r) => ({ ...fixed, ...r, variable: v }));
}

function assemble(rows, keyOf, labelOf, freq, meta) {
  // rows: [{..., ser: {period: value}}]; returns a bundle with a continuous axis trimmed to
  // the published span (fill values -> null before trimming)
  // rows sharing a key (one per 20-year window) merge into one series; a date served twice
  // with different values is a conflict and fails
  const byKey = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    const cell = byKey.get(k) ?? byKey.set(k, { r, vals: new Map() }).get(k);
    for (const [p, v] of Object.entries(r.ser)) {
      const d = toIso(p, freq), val = isFill(v) ? null : v;
      if (cell.vals.has(d) && cell.vals.get(d) !== val) throw new Error(`cckp: ${k} served twice for ${d} (${cell.vals.get(d)} and ${val})`);
      cell.vals.set(d, val);
    }
  }
  const cells = [...byKey.values()];
  const all = [...new Set(cells.flatMap((c) => [...c.vals].filter(([, v]) => v != null).map(([d]) => d)))].sort();
  if (!all.length) return null;
  const step = freq === "monthly" ? 1 : freq === "seasonal" ? 3 : freq === "annual" ? 12 : null;
  let dates;
  if (step) {
    dates = [];
    let [y, m] = all[0].split("-").map(Number);
    const [ly, lm] = all.at(-1).split("-").map(Number);
    while (y < ly || (y === ly && m <= lm)) { dates.push(`${y}-${String(m).padStart(2, "0")}-01`); m += step; while (m > 12) { m -= 12; y++; } }
  } else dates = all;
  const series = {};
  let gi = 0;
  for (const { r, vals } of cells) {
    const data = dates.map((d) => (vals.has(d) ? vals.get(d) : null));
    if (!data.some((v) => v != null)) continue;
    const k = keyOf(r);
    const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
    const v = VARS[r.variable];
    // monthly and seasonal levels follow the calendar (pipeline/facts.mjs honours the flag)
    series[k] = { name: `cckp_${k}`, label: labelOf(r), unit: v.unit, group: v.label, ...(freq === "monthly" || freq === "seasonal" ? { seasonal: true } : {}), color: GREYS[gi++ % GREYS.length], data,
      ...(gaps.length ? { gaps, gapsNote: "CCKP serves no valid value for these periods (a missing value or its fill code)." } : {}) };
  }
  return { meta: { ...meta, latestPeriod: freq === "annual" ? dates.at(-1).slice(0, 4) : dates.at(-1).slice(0, 7) }, dates, series };
}

/* ---------- the build ---------- */

export async function buildCckp(root, dcfg, vintage) {
  const F = dcfg.fetch;
  const raw = {};
  const bundles = {};
  const skip = (coll, v) => (F.skip_vars?.[coll] ?? []).includes(v);
  const metaBase = (base, freq, coverage, note) => ({
    dossier: "climate", source: "World Bank Climate Change Knowledge Portal", product: "cckp", base, frequency: freq,
    unit: "see each series", vintage, geo: "IND", releaseDate: null, mock: false, coverage, note,
  });

  // geocodes and names of India's first-level units, from CCKP itself
  const glob = await cckp(`era5-x0.25_climatology_tas_climatology_annual_1991-2020_mean_historical_era5_x0.25_mean`, ["global_countries_subnationals"]);
  const stateCodes = Object.keys(glob.data).filter((c) => c.startsWith("IND.")).sort();
  if (stateCodes.length < 30) throw new Error(`cckp: only ${stateCodes.length} Indian subnational units served (anchor assertion)`);
  const names = await geoNames(`era5-x0.25_climatology_tas_climatology_annual_1991-2020_mean_historical_era5_x0.25_mean`, stateCodes);
  for (const c of stateCodes) if (!names.get(c)) throw new Error(`cckp: no name for geocode ${c}`);
  const stateKey = (c) => skey(names.get(c));
  raw.geocodes = Object.fromEntries(stateCodes.map((c) => [c, names.get(c)]));

  const disc = { era5: await discover("era5"), cru: await discover("cru"), cmip6: await discover("cmip6") };
  const varsIn = (coll, theme) => Object.keys(disc[coll]).filter((v) => !MAP_ONLY.has(v) && !skip(coll, v) && VARS[v]?.theme === theme).sort();
  for (const coll of Object.keys(disc)) for (const v of Object.keys(disc[coll])) if (!MAP_ONLY.has(v) && !VARS[v]) throw new Error(`cckp: variable "${v}" in ${coll} has no display metadata (scripts/lib/products/cckp-vars.mjs)`);

  // ERA5 timeseries period, per aggregation: the newest period CCKP has published
  const era5Period = (v, agg) => latestPeriod(disc.era5[v]?.files["era5-x0.25-historical"] ?? [], (f) => f.product === "timeseries" && f.agg === agg && f.category === "timeseries");
  const seasonNote = "Seasons: December to February (dated January of the later year), March to May, June to August, September to November.";

  /* --- ERA5, India: annual, seasonal, monthly; states: annual --- */
  for (const theme of Object.keys(THEMES)) {
    const vars = varsIn("era5", theme);
    if (!vars.length) continue;
    for (const agg of ["annual", "seasonal", "monthly"]) {
      const byPeriod = new Map();
      for (const v of vars) { const p = era5Period(v, agg); if (p) (byPeriod.get(p) ?? byPeriod.set(p, []).get(p)).push(v); }
      const rows = [];
      for (const [period, vs] of byPeriod) {
        const res = await cckp(`era5-x0.25_timeseries_${vs.join(",")}_timeseries_${agg}_${period}_mean_historical_era5_x0.25_mean`, ["IND"]);
        raw[`era5:${theme}:${agg}:${period}:IND`] = res.data;
        rows.push(...flatten(res.data, vs.length > 1 ? ["variable"] : []).map((r) => ({ ...r, variable: r.variable ?? vs[0] })));
        const missing = vs.filter((v) => !rows.some((r) => r.variable === v));
        if (missing.length) console.warn(`cckp: ERA5 ${agg} served nothing for ${missing.join(", ")}`);
      }
      const slug = agg === "seasonal" ? `climate-seasons-era5-${theme}` : `climate-era5-${theme}${agg === "annual" ? "" : "-" + agg}`;
      const b = assemble(rows, (r) => r.variable, (r) => VARS[r.variable].label, agg, metaBase(dcfg.bases.era5, agg === "seasonal" ? "seasonal" : agg,
        `India, ${THEMES[theme].toLowerCase()}: ${vars.length} ERA5 indices, ${agg}, CCKP area average over India's land.`,
        `ERA5 reanalysis (Copernicus Climate Change Service, ECMWF), aggregated by the World Bank CCKP. ${agg === "seasonal" ? seasonNote + " " : ""}Missing values (a fill code) are left empty.`));
      if (b) bundles[slug] = b;
    }
    // states, annual
    const byPeriod = new Map();
    for (const v of vars) { const p = era5Period(v, "annual"); if (p) (byPeriod.get(p) ?? byPeriod.set(p, []).get(p)).push(v); }
    const rows = [];
    for (const [period, vs] of byPeriod) {
      const res = await cckp(`era5-x0.25_timeseries_${vs.join(",")}_timeseries_annual_${period}_mean_historical_era5_x0.25_mean`, stateCodes);
      raw[`era5:${theme}:annual:${period}:states`] = res.data;
      rows.push(...flatten(res.data, vs.length > 1 ? ["variable"] : []).map((r) => ({ ...r, variable: r.variable ?? vs[0] })));
    }
    const sb = assemble(rows, (r) => `${r.variable}__${stateKey(r.geo)}`, (r) => `${VARS[r.variable].label}, ${names.get(r.geo)}`, "annual",
      metaBase(dcfg.bases.era5, "annual", `States and union territories (${stateCodes.length} CCKP units), ${THEMES[theme].toLowerCase()}: ${vars.length} ERA5 indices, annual.`,
        "ERA5 reanalysis aggregated by CCKP to its first-level boundaries. Series keys end in the place name."));
    if (sb) bundles[`climate-era5-states-${theme}`] = sb;
  }

  /* --- the published 1991-2020 ERA5 climatology: a cross-check on our annual series --- */
  {
    const res = await cckp(`era5-x0.25_climatology_tas,pr,hd35_climatology_annual_1991-2020_mean_historical_era5_x0.25_mean`, ["IND", ...stateCodes]);
    raw["era5:climatology:annual:1991-2020"] = res.data;
    const pick = (v) => Object.fromEntries(Object.entries(res.data[v] ?? {}).map(([g, s]) => [g === "IND" ? "IND" : stateKey(g), Object.values(s)[0]]));
    for (const [slug, v] of [["climate-era5-temp", "tas"], ["climate-era5-rain", "pr"], ["climate-era5-hotdays", "hd35"]]) if (bundles[slug]) bundles[slug].crosscheck = { [`${v}_climatology_1991_2020`]: pick(v) };
    for (const [slug, v] of [["climate-era5-states-temp", "tas"], ["climate-era5-states-rain", "pr"], ["climate-era5-states-hotdays", "hd35"]]) if (bundles[slug]) bundles[slug].crosscheck = { [`${v}_climatology_1991_2020`]: pick(v) };
  }

  /* --- CRU TS: India annual, seasonal, monthly; states annual --- */
  {
    const vars = Object.keys(disc.cru).filter((v) => !MAP_ONLY.has(v) && VARS[v]).sort();
    const ver = cruVersion(disc.cru.tas.datasets).match(/ts([\d.]+)/)[1];
    const files = disc.cru.tas.files[`cru-ts${ver}-historical`] ?? [];
    for (const agg of ["annual", "seasonal", "monthly"]) {
      const period = latestPeriod(files, (f) => f.product === "timeseries" && f.agg === agg && f.category === "timeseries");
      if (!period) { console.warn(`cckp: no CRU ${agg} timeseries`); continue; }
      const res = await cckp(`cru-x0.5_timeseries_${vars.join(",")}_timeseries_${agg}_${period}_mean_historical_cru_ts${ver}_mean`, ["IND"]);
      raw[`cru:${agg}:${period}:IND`] = res.data;
      const rows = flatten(res.data, ["variable"]);
      const b = assemble(rows, (r) => r.variable, (r) => VARS[r.variable].label, agg, metaBase(dcfg.bases.cru, agg,
        `India: ${vars.length} CRU TS ${ver} variables, ${agg}, ${period}, CCKP area average.`,
        `CRU TS ${ver}, Climatic Research Unit, University of East Anglia: monthly station readings interpolated to a 0.5° grid, aggregated by CCKP. ${agg === "seasonal" ? seasonNote : ""}`));
      if (b) bundles[agg === "seasonal" ? "climate-seasons-cru" : `climate-cru${agg === "annual" ? "" : "-" + agg}`] = b;
      if (agg === "annual") {
        const rs = await cckp(`cru-x0.5_timeseries_${vars.join(",")}_timeseries_annual_${period}_mean_historical_cru_ts${ver}_mean`, stateCodes);
        raw[`cru:annual:${period}:states`] = rs.data;
        const sb = assemble(flatten(rs.data, ["variable"]), (r) => `${r.variable}__${stateKey(r.geo)}`, (r) => `${VARS[r.variable].label}, ${names.get(r.geo)}`, "annual",
          metaBase(dcfg.bases.cru, "annual", `States and union territories (${stateCodes.length} CCKP units): ${vars.length} CRU TS ${ver} variables, annual, ${period}.`,
            `CRU TS ${ver}, aggregated by CCKP to its first-level boundaries. Small units (islands, city territories) sit on few 0.5° cells; read them with care.`));
        if (sb) bundles["climate-cru-states"] = sb;
      }
    }
  }

  /* --- CMIP6 projections --- */
  const ens = (v, scen) => disc.cmip6[v]?.files[`ensemble-all-${scen}`] ?? [];
  const sspsOf = (v) => Object.keys(disc.cmip6[v]?.files ?? {}).map((d) => d.replace("ensemble-all-", "")).filter((s) => s.startsWith("ssp")).sort();
  const PCTS = ["median", "p10", "p90"];
  const WINDOWS = F.cmip6_windows;   // ["2020-2039", "2040-2059", "2060-2079", "2080-2099"]
  const projNote = "CMIP6 multi-model ensemble (about 30 models), downscaled and bias-corrected to 0.25° by CCKP. Projections are model output under a stated scenario, not observations; the 10th to 90th percentile is the spread across models.";
  for (const theme of Object.keys(THEMES)) {
    const vars = varsIn("cmip6", theme);
    if (!vars.length) continue;
    // annual time series, 2015-2100, every scenario the variable has, three percentiles
    const tsRows = [], histRows = [], winRows = [], stRows = [];
    for (const v of vars) {
      const ssps = sspsOf(v);
      const tsPeriod = latestPeriod(ens(v, "ssp245"), (f) => f.product === "timeseries" && f.agg === "annual" && f.category === "timeseries");
      if (tsPeriod && ssps.length) {
        const res = await cckp(`cmip6-x0.25_timeseries_${v}_timeseries_annual_${tsPeriod}_${PCTS.join(",")}_${ssps.join(",")}_ensemble_all_mean`, ["IND"]);
        raw[`cmip6:${v}:timeseries:${tsPeriod}:IND`] = res.data;
        tsRows.push(...flat6(res.data, v, [["percentile", PCTS], ["scenario", ssps]]));
      }
      const hPeriod = latestPeriod(ens(v, "historical"), (f) => f.product === "timeseries" && f.agg === "annual" && f.category === "timeseries");
      if (hPeriod) {
        const res = await cckp(`cmip6-x0.25_timeseries_${v}_timeseries_annual_${hPeriod}_${PCTS.join(",")}_historical_ensemble_all_mean`, ["IND"]);
        raw[`cmip6:${v}:timeseries:${hPeriod}:historical:IND`] = res.data;
        histRows.push(...flat6(res.data, v, [["percentile", PCTS], ["scenario", ["historical"]]]));
      }
      // 20-year windows: climatology (the level) and anomaly (change from 1995-2014), India
      const wins = WINDOWS.filter((w) => ens(v, "ssp245").some((f) => f.period === w));
      for (const product of ["climatology", "anomaly"]) {
        if (!wins.length || !ssps.length || !ens(v, "ssp245").some((f) => f.product === product && f.agg === "annual")) continue;
        const res = await cckp(`cmip6-x0.25_climatology_${v}_${product}_annual_${wins.join(",")}_${PCTS.join(",")}_${ssps.join(",")}_ensemble_all_mean`, ["IND"]);
        raw[`cmip6:${v}:${product}:windows:IND`] = res.data;
        winRows.push(...flat6(res.data, v, [["period", wins], ["percentile", PCTS], ["scenario", ssps]]).map((r) => ({ ...r, product })));
        if (product === "anomaly") {
          const rs = await cckp(`cmip6-x0.25_climatology_${v}_anomaly_annual_${wins.join(",")}_median_${ssps.join(",")}_ensemble_all_mean`, stateCodes);
          raw[`cmip6:${v}:anomaly:windows:median:states`] = rs.data;
          stRows.push(...flat6(rs.data, v, [["period", wins], ["percentile", ["median"]], ["scenario", ssps]]));
        }
      }
      const refP = latestPeriod(ens(v, "historical"), (f) => f.product === "climatology" && f.agg === "annual");
      if (refP) {
        const res = await cckp(`cmip6-x0.25_climatology_${v}_climatology_annual_${refP}_${PCTS.join(",")}_historical_ensemble_all_mean`, ["IND"]);
        raw[`cmip6:${v}:climatology:${refP}:historical:IND`] = res.data;
        winRows.push(...flat6(res.data, v, [["period", [refP]], ["percentile", PCTS], ["scenario", ["historical"]]]).map((r) => ({ ...r, product: "climatology" })));
      }
    }
    // windows rows carry their period in a key, not in the series' dates: move it there
    const reDate = (rows) => rows.map((r) => ({ ...r, ser: r.period ? Object.fromEntries(Object.values(r.ser).map((v) => [`${r.period.slice(0, 4)}-07`, v])) : r.ser }));
    const lab = (r) => `${VARS[r.variable].label}, ${SSP_LABEL[r.scenario]}, ${PCT_LABEL[r.percentile] ?? "median"}`;
    const ts = assemble(tsRows, (r) => `${r.variable}__${r.scenario}__${r.percentile}`, lab, "annual",
      metaBase(dcfg.bases.cmip6, "annual", `India, ${THEMES[theme].toLowerCase()}: CMIP6 projections, annual, by scenario, median and 10th/90th percentiles.`, projNote));
    if (ts) bundles[`climate-cmip6-${theme}`] = ts;
    const hs = assemble(histRows, (r) => `${r.variable}__historical__${r.percentile}`, lab, "annual",
      metaBase(dcfg.bases.cmip6, "annual", `India, ${THEMES[theme].toLowerCase()}: CMIP6 historical runs (the models' own past), annual.`, projNote + " Historical runs are the models' reproduction of the past, for comparing like with like; they are not observations."));
    if (hs) bundles[`climate-cmip6-${theme}-hist`] = hs;
    const ws = assemble(reDate(winRows), (r) => `${r.variable}__${r.product === "anomaly" ? "change" : "level"}__${r.scenario}__${r.percentile}`,
      (r) => `${VARS[r.variable].label}, ${r.product === "anomaly" ? "change from 1995-2014" : "20-year average"}, ${SSP_LABEL[r.scenario]}, ${PCT_LABEL[r.percentile]}`, "windows",
      metaBase(dcfg.bases.cmip6, "irregular", `India, ${THEMES[theme].toLowerCase()}: CMIP6 20-year averages and changes from 1995-2014, for ${WINDOWS.join(", ")} (each dated by its first year; 1995 is the 1995-2014 reference).`, projNote));
    if (ws) bundles[`climate-cmip6-windows-${theme}`] = ws;
    const st = assemble(reDate(stRows), (r) => `${r.variable}__${r.scenario}__${stateKey(r.geo)}`,
      (r) => `${VARS[r.variable].label}, change from 1995-2014, ${SSP_LABEL[r.scenario]}, median, ${names.get(r.geo)}`, "windows",
      metaBase(dcfg.bases.cmip6, "irregular", `States and union territories: CMIP6 change from 1995-2014 by 20-year window (dated by first year), ensemble median, ${THEMES[theme].toLowerCase()}.`, projNote));
    if (st) bundles[`climate-cmip6-states-${theme}`] = st;
  }

  // CMIP6 percentile order: the 10th percentile can never sit above the median, nor the
  // 90th below it. Where CCKP serves one that does, that percentile series is withheld (not
  // repaired) and the bundle says so; the ledger records it as blocked.
  const withheld = [];
  for (const [slug, b] of Object.entries(bundles)) {
    if (!slug.startsWith("climate-cmip6-") || slug.startsWith("climate-cmip6-states")) continue;
    for (const k of Object.keys(b.series).filter((x) => x.endsWith("__median"))) {
      const st = k.slice(0, -"__median".length), med = b.series[k].data;
      for (const [p, bad] of [["p10", (v, m) => v > m + 0.05], ["p90", (v, m) => v < m - 0.05]]) {
        const s2 = b.series[`${st}__${p}`];
        if (s2 && s2.data.some((v, i) => v != null && med[i] != null && bad(v, med[i]))) { delete b.series[`${st}__${p}`]; withheld.push(`${slug}: ${st}__${p}`); }
      }
    }
    const mine = withheld.filter((w) => w.startsWith(slug + ":")).map((w) => w.split(": ")[1]);
    if (mine.length) b.meta.note += ` Withheld because CCKP serves them on the wrong side of the median: ${mine.join(", ")}.`;
  }
  if (withheld.length) console.warn(`cckp: percentile series withheld (out of order at source): ${withheld.join("; ")}`);
  raw.withheld = withheld;

  // anchor assertions: the guide's long record and its observed heat must be there
  const tas = bundles["climate-cru"]?.series?.tas?.data ?? [];
  if (tas.filter((v) => v != null).length < 100) throw new Error("cckp: CRU India annual temperature missing or short (anchor assertion)");
  const hd = bundles["climate-era5-hotdays"]?.series?.hd35?.data ?? [];
  if (!hd.some((v) => v != null && v > 10)) throw new Error("cckp: ERA5 India hot days (35°C) missing (anchor assertion)");

  writeRaw(root, "data/raw/climate-cckp.json", { vintage, note: "World Bank CCKP API responses as served, keyed by collection:theme-or-variable:product:period:geography. Values include CCKP's fill code (about 1e20) where it serves one; the bundles null those.", responses: raw });
  for (const [slug, b] of Object.entries(bundles)) writeSeries(root, `data/series/${slug}.json`, b);
  return bundles;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--catalogue")) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const out = await catalogue(root);
  console.log(`climate-cckp catalogue: ${out.items.length} items`);
}
