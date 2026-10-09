// scripts/lib/archive/climate-cckp.mjs: deep-archive export for the climate guide's CCKP
// family. The archive rules hold state-by-season and state-by-month ERA5 and CRU series, and
// the CMIP6 tables the bake summarises (state time series, seasonal series, state percentiles,
// historical anomalies). They are re-read from CCKP's API (scripts/lib/cckp.mjs: cached,
// one request at a time), with the same facet codes the adapter uses
// (scripts/lib/products/cckp.mjs buildCckp): one call per variable and facet set, carrying every
// percentile and scenario the rule asks for.
//
// Long rows: collection, variable (code and label), unit, product, aggregation, scenario,
// percentile, window, geocode and place name, period, value; CCKP's fill code (about 1e20)
// becomes an empty value with flag "fill".
//
// Check: every requested variable, scenario and percentile must come back with data for at
// least one place, and every place asked for must appear somewhere in the table; a facet the
// API answers with nothing is re-asked on its own (one scenario, one percentile, India): if the
// single call returns data, the nested answer was misread and the export fails; if it is empty
// too, CCKP's API does not aggregate that combination (SSP1-1.9 seasonal series, for one: the
// gridded files sit on S3 but the API serves []), and its catalogue items are listed in the
// manifest as `unserved` rather than dropped silently. CCKP publishes no row counts to check against.
import fs from "node:fs";
import { readRaw } from "../util.mjs";
import path from "node:path";
import { cckp, geoNames, isFill } from "../cckp.mjs";
import { discover } from "../products/cckp.mjs";
import { VARS } from "../products/cckp-vars.mjs";

const SOURCE = "World Bank Climate Change Knowledge Portal (CCKP)";
const COLLDIR = { era5: "era5-x0.25", cru: "cru-x0.5", cmip6: "cmip6-x0.25" };
const endYear = (p) => +String(p).split("-")[1];
const latest = (ps) => [...ps].sort((a, b) => endYear(a) - endYear(b) || (a < b ? -1 : 1)).at(-1);

// nested response -> rows; `levels` names the facets given as multi-value lists, in code order
function flatten(data, levels) {
  const out = [];
  (function walk(node, depth, keys) {
    if (depth === levels.length) { for (const [geo, ser] of Object.entries(node ?? {})) if (ser && typeof ser === "object") out.push({ ...keys, geo, ser }); return; }
    if (!node || typeof node !== "object") return;
    for (const [k, child] of Object.entries(node)) walk(child, depth + 1, { ...keys, [levels[depth]]: k });
  })(data, 0, {});
  return out;
}

export async function* tables({ rules, root, log }) {
  const vintage = readRaw(root, "data/raw/climate-cckp.json").vintage ?? null;
  const ref = "era5-x0.25_climatology_tas_climatology_annual_1991-2020_mean_historical_era5_x0.25_mean";
  const glob = await cckp(ref, ["global_countries_subnationals"]);
  const states = Object.keys(glob.data).filter((c) => c.startsWith("IND.")).sort();
  if (states.length < 30) throw new Error(`archive climate: only ${states.length} Indian units served`);
  const names = await geoNames(ref, states);
  names.set("IND", "India");
  let cruVer = null;

  // group the rule's items into API calls: one variable, one facet set, every pct and scenario
  const groups = new Map();
  for (const { rule, items } of rules) for (const it of items) {
    const [, coll, v, product, agg, scen, ...rest] = it.id.split(":");
    const geo = rest.at(-1);
    const pct = coll === "cmip6" ? rest[0] : null;
    if (!["timeseries", "climatology", "anomaly"].includes(product)) throw new Error(`archive climate: ${it.id} is not an API product`);
    const periods = it.dims?.periods ?? [];
    const key = [coll, v, product, agg, geo, product === "timeseries" ? latest(periods) : periods.join(",")].join("|");
    const g = groups.get(key) ?? groups.set(key, { coll, v, product, agg, geo, periods: product === "timeseries" ? [latest(periods)] : periods, pcts: new Set(), scens: new Set(), rule, items: [] }).get(key);
    g.items.push({ id: it.id, scen, pct });
    if (pct) g.pcts.add(pct);
    g.scens.add(scen);
  }
  // tables: one per collection x product x aggregation x geography
  const byTable = new Map();
  for (const g of groups.values()) {
    const t = `${g.coll}-${g.product}-${g.agg}-${g.geo}`;
    (byTable.get(t) ?? byTable.set(t, []).get(t)).push(g);
  }
  const columns = ["collection", "variable", "variable_label", "unit", "product", "aggregation", "scenario", "percentile", "window", "geocode", "place", "period", "value", "flag", "source", "vintage"];
  for (const [table, gs] of [...byTable].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const rows = [];
    const placesSeen = new Set();
    const unserved = [];
    for (const g of gs) {
      const geos = g.geo === "states" ? states : ["IND"];
      const pcts = [...g.pcts].sort(), scens = [...g.scens].sort();
      let code;
      if (g.coll === "cmip6") {
        const cat = g.product === "timeseries" ? "timeseries" : "climatology";
        code = `${COLLDIR.cmip6}_${cat}_${g.v}_${g.product}_${g.agg}_${g.periods.join(",")}_${pcts.join(",")}_${scens.join(",")}_ensemble_all_mean`;
      } else if (g.coll === "era5") {
        code = `${COLLDIR.era5}_timeseries_${g.v}_timeseries_${g.agg}_${g.periods[0]}_mean_historical_era5_x0.25_mean`;
      } else {
        cruVer ??= (await discover("cru")).tas.datasets.filter((d) => /^cru-ts[\d.]+-historical$/.test(d)).map((d) => d.match(/ts([\d.]+)/)[1])
          .sort((a, b) => { const x = a.split(".").map(Number), y = b.split(".").map(Number); return x[0] - y[0] || x[1] - y[1]; }).at(-1);
        code = `${COLLDIR.cru}_timeseries_${g.v}_timeseries_${g.agg}_${g.periods[0]}_mean_historical_cru_ts${cruVer}_mean`;
      }
      const res = await cckp(code, geos);
      const facets = g.coll === "cmip6" ? [["window", g.periods], ["percentile", pcts], ["scenario", scens]] : [];
      const levels = facets.filter(([, l]) => l.length > 1).map(([n]) => n);
      const fixed = Object.fromEntries(facets.filter(([, l]) => l.length === 1).map(([n, l]) => [n, l[0]]));
      const flat = flatten(res.data?.[g.v] ?? res.data, levels).map((r) => ({ ...fixed, ...r }));
      // every requested scenario x percentile must come back with some place; an empty one is
      // re-asked alone to tell a misread answer from a combination the API does not serve
      for (const s of scens) for (const p of (pcts.length ? pcts : [null])) {
        if (flat.some((r) => (r.scenario ?? s) === s && (p == null || (r.percentile ?? p) === p) && Object.keys(r.ser).length)) continue;
        const one = g.coll === "cmip6" ? code.replace(`_${pcts.join(",")}_${scens.join(",")}_`, `_${p}_${s}_`) : code;
        const probe = await cckp(one, ["IND"]);
        if (JSON.stringify(probe.data ?? []).includes('"IND"'))
          throw new Error(`archive climate: ${code} came back without ${s}${p ? " " + p : ""}, which ${one} serves alone: the nested answer was misread`);
        unserved.push(...g.items.filter((it) => it.scen === s && (p == null || it.pct === p)).map((it) => it.id));
        log(`climate ${table}: CCKP's API serves nothing for ${one}; ${g.items.filter((it) => it.scen === s && (p == null || it.pct === p)).length} catalogue item(s) recorded as unserved`);
      }
      const V = VARS[g.v] ?? {};
      for (const r of flat) {
        placesSeen.add(r.geo);
        for (const [period, val] of Object.entries(r.ser)) {
          const fill = isFill(val);
          rows.push([g.coll, g.v, V.label ?? g.v, V.unit ?? "", g.product, g.agg, r.scenario ?? scens[0] ?? "historical", r.percentile ?? (g.coll === "cmip6" ? pcts[0] : "mean"),
            g.coll === "cmip6" && g.product !== "timeseries" ? (r.window ?? g.periods[0]) : "", r.geo, names.get(r.geo) ?? "", period, fill ? "" : val, fill ? "fill" : "", SOURCE, vintage]);
        }
      }
    }
    const wantPlaces = gs[0].geo === "states" ? states : ["IND"];
    const missing = wantPlaces.filter((p) => !placesSeen.has(p));
    if (missing.length) throw new Error(`archive climate: ${table} has no data for ${missing.join(", ")}`);
    log(`climate ${table}: ${gs.length} calls, ${rows.length} rows${unserved.length ? `, ${unserved.length} items unserved by the API` : ""}`);
    const rollsUp = [...new Set(gs.flatMap((g) => [].concat(g.rule.rolls_up_to ?? [])))];
    const rulesHere = [...new Set(gs.map((g) => [].concat(g.rule.match).join(", ")))];
    yield { table, title: `CCKP ${gs[0].coll.toUpperCase()}, ${gs[0].product}, ${gs[0].agg}, ${gs[0].geo === "states" ? "each state and union territory" : "India"}`,
      source: SOURCE, rule: rulesHere.join(" | "), rolls_up_to: rollsUp, vintage, columns,
      rows: (async function* () { yield* rows; })(), expectedRows: rows.length,
      expectedNote: "CCKP publishes no row counts: every requested variable, scenario, percentile and place was checked to come back with data, or listed as unserved",
      ...(unserved.length ? { unserved: unserved.sort(), unservedNote: "catalogue items CCKP's aggregation API returns no data for (checked one call at a time); the gridded NetCDF files on the wbg-cckp S3 bucket are the only published form" } : {}) };
  }
}
