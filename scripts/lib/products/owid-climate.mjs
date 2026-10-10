// scripts/lib/products/owid-climate.mjs: Our World in Data, for the climate guide.
//
// Two kinds of OWID product enter here (docs/reference/owid.md):
//   1. The CO2 and greenhouse-gas dataset and the energy dataset: one CSV each, every
//      country and year, documented column by column in a codebook. Producers: Global
//      Carbon Project (CO2), Jones et al. (other gases, warming), Energy Institute
//      Statistical Review and Ember (energy, electricity). One bundle per geography
//      (CONTRACT-series rule 8): India, and the comparators China, the United States and
//      the world.
//   2. OWID's own climate indicators (ETL namespace `climate`, `emissions`, and the heat-
//      death datasets): ERA5 surface temperature and precipitation by country (Copernicus,
//      processed by OWID), wildfires (GWIS), national contributions to warming (Jones et
//      al.), heat-related deaths (Climate Impact Lab and UNDP), opinion surveys. Discovered
//      from the grapher charts in OWID's site map; one bundle per OWID dataset, India only.
//
// Catalogue: `node scripts/lib/products/owid-climate.mjs --catalogue` enumerates every
// codebook column for each geography and every in-scope OWID indicator that covers India,
// and writes data/coverage/climate-owid.catalogue.json. It is generated, never typed.
//
// Quirks (each disclosed on the bundle it touches):
//   - OWID's annual temperature series include the current, unfinished year, averaged over
//     the months published so far. An average of January to August is not a year: the
//     incomplete year is dropped from the annual bundles and named in meta.note.
//   - World rows carry no ISO code in the CSVs (iso_code is empty); they are matched by
//     the country name "World" and stamped geo "WLD".
//   - Several codebook columns are OWID's own arithmetic (growth, per capita, shares,
//     cumulative sums); the codebook says so and so does each series label.
//
// Hand checks (2026-10-09): India's 2024 fossil CO2 is 3,193.48 Mt here; the Global Carbon
// Budget 2025 gives 3.2 GtCO2 and 8% of the world (here 8.27%). Electricity 2025: solar
// 9.4%, wind and solar 14.4%, low-carbon 26.7% here; Ember's India page gives 9.4%, 14% and
// 27% clean. ERA5 country averages are OWID's processing (Copernicus publishes no country
// series): August 2026 +0.6252°C matches OWID's grapher CSV for India.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { owidText, owidJson, sitemap, chartConfig, indicatorMeta } from "../owid.mjs";
import { parseCsv, parseNumber } from "../tabular.mjs";
import { writeRaw, writeSeries, writeJson } from "../util.mjs";

export const DATASETS = {
  co2: { url: "https://owid-public.owid.io/data/co2/owid-co2-data.csv", codebook: "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-codebook.csv" },
  energy: { url: "https://owid-public.owid.io/data/energy/owid-energy-data.csv", codebook: "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-codebook.csv" },
};
export const GEOS = { IND: { name: "India", iso: "IND" }, CHN: { name: "China", iso: "CHN" }, USA: { name: "United States", iso: "USA" }, WLD: { name: "World", iso: "" } };
const SKIP_COLS = new Set(["country", "year", "iso_code"]);
// OWID writes units in words; bundles carry a short code the every-cut table and validate
// know (src/dossiers/everycut.js UNITS, climate block). An unknown unit fails the bake.
export const OWID_UNITS = {
  "%": "pct", "°C": "degC", "people": "count", "": "count",
  "international-$ in 2011 prices ($)": "intl_usd_2011", "million tonnes (Mt)": "mt", "million tonnes CO₂ equivalents (Mt)": "mt_co2e",
  "tonnes per person (t/person)": "t_per_person", "tonnes of CO₂ equivalents per person (t/person)": "t_co2e_per_person",
  "kilograms per international-$ (kg/$)": "kg_per_intl_usd", "grams per kilowatt-hour (g/kWh)": "g_per_kwh",
  "grams of CO₂ equivalents per kilowatt-hour (gCO₂)": "g_co2e_per_kwh", "kilowatt-hours per person (kWh)": "kwh_per_person",
  "kilowatt-hours (kWh)": "kwh_per_person",   // the energy codebook's per-capita columns ("Measured in kilowatt-hours per person")
  "kilowatt-hours per $ (kWh)": "kwh_per_intl_usd", "terawatt-hours (TWh)": "twh",
  "ha": "hectares", "hectares": "hectares", "t": "tonnes", "tonnes": "tonnes", "per 100,000": "per_100k", "millimeters": "mm", "mm": "mm",
};
const unitCode = (u, where) => {
  const c = OWID_UNITS[u ?? ""];
  if (!c) throw new Error(`owid-climate: unit "${u}" (${where}) has no code in OWID_UNITS`);
  return c;
};
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/* ---------- 1. the two CSV datasets ---------- */

async function codebook(name) {
  const rows = parseCsv(await owidText(DATASETS[name].codebook));
  const [h, ...body] = rows;
  const col = (n) => h.indexOf(n);
  return body.map((r) => ({ column: r[col("column")], title: r[col("title")], description: r[col("description")], unit: r[col("unit")], source: r[col("source")] }))
    .filter((c) => c.column && !SKIP_COLS.has(c.column));
}

async function datasetRows(name) {
  const rows = parseCsv(await owidText(DATASETS[name].url));
  const [h, ...body] = rows;
  return { header: h, body };
}

/* ---------- 2. OWID indicators, discovered through the grapher charts ---------- */

// In scope: OWID's own climate datasets and the warming/heat-death datasets. Charts are
// pre-filtered by slug keywords (a full sweep of ~4,400 chart configs is not polite); the
// keyword list is broad on purpose, and the namespace test below does the real selection.
export const CHART_KEYWORDS = /temperat|precip|rain|heat|warm|climat|monsoon|drought|flood|cooling|hot-day|sea-level|glacier|wildfire|burnt|burned|fire|extreme/;
export const inScope = (catalogPath = "") => {
  const [, ns, , ds] = catalogPath.split("/");
  return ns === "climate" || ns === "emissions" || /heat_deaths|temperate_deaths/.test(ds ?? "");
};

export async function discoverIndicators() {
  const xml = await sitemap();
  const slugs = [...new Set([...xml.matchAll(/\/grapher\/([^<?#]+)</g)].map((m) => m[1]))].filter((s) => CHART_KEYWORDS.test(s)).sort();
  const byId = new Map();
  for (const slug of slugs) {
    let cfg;
    try { cfg = await chartConfig(slug); } catch (e) { console.warn(`owid: chart ${slug} config failed: ${e.message}`); continue; }
    for (const d of cfg.dimensions ?? []) {
      const id = d.variableId;
      if (byId.has(id)) { byId.get(id).charts.push(slug); continue; }
      let m;
      try { m = await indicatorMeta(id); } catch (e) { console.warn(`owid: indicator ${id} metadata failed: ${e.message}`); continue; }
      if (!inScope(m.catalogPath)) continue;
      const india = (m.dimensions?.entities?.values ?? []).find((e) => e.code === "IND");
      const [, ns, version, dataset] = m.catalogPath.split("/");
      byId.set(id, {
        id, catalogPath: m.catalogPath, ns, version, dataset, short: m.catalogPath.split("#")[1],
        name: m.name, unit: m.unit ?? m.display?.unit ?? null, shortUnit: m.shortUnit ?? m.display?.shortUnit ?? null,
        timeInterval: m.display?.timeInterval ?? "year", zeroDay: m.display?.zeroDay ?? null, yearIsDay: !!m.display?.zeroDay,
        producer: (m.origins ?? []).map((o) => o.producer).filter(Boolean).join("; "),
        citation: (m.origins ?? []).map((o) => o.citationFull).filter(Boolean)[0] ?? null,
        description: m.descriptionShort ?? null,
        indiaEntityId: india?.id ?? null, charts: [slug],
        // the data vintage: the ETL version when it is a date, else the indicator's last update
        updated: /^\d{4}-\d{2}-\d{2}$/.test(version) ? version : String(m.updatedAt ?? m.origins?.[0]?.dateAccessed ?? "").slice(0, 10) || null,
      });
    }
  }
  return [...byId.values()].sort((a, b) => (a.catalogPath < b.catalogPath ? -1 : 1));
}

// catalogue id for an OWID indicator: stable across OWID's ETL versions (the version is
// dropped; the dataset and indicator short name stay)
export const indicatorItemId = (ind) => `owid:${ind.ns}:${ind.dataset}:${key(ind.short)}:ind`;

/* ---------- catalogue ---------- */

export async function catalogue(root) {
  const items = [];
  for (const name of Object.keys(DATASETS)) {
    for (const c of await codebook(name)) {
      for (const g of Object.keys(GEOS)) {
        items.push({ id: `owid:${name}:${c.column}:${g.toLowerCase()}`, label: `${c.title} (${c.unit || "no unit"}), ${GEOS[g].name}, annual`,
          dims: { dataset: `owid-${name}-data`, column: c.column, geo: g, freq: "annual", source: c.source } });
      }
    }
  }
  for (const ind of await discoverIndicators()) {
    if (ind.indiaEntityId == null) continue;   // the catalogue is India's: an indicator with no India row is not published for India
    items.push({ id: indicatorItemId(ind), label: `${ind.name} (${ind.unit ?? "no unit"}), India, ${ind.timeInterval}`,
      dims: { dataset: ind.dataset, indicator: ind.short, owidId: ind.id, freq: ind.timeInterval, producer: ind.producer, charts: ind.charts } });
  }
  const out = { family: "climate-owid", source: "Our World in Data: CO2 and energy datasets, and OWID climate indicators", generator: "scripts/lib/products/owid-climate.mjs --catalogue",
    generated_at: new Date().toISOString().slice(0, 10), items };
  writeJson(root, "data/coverage/climate-owid.catalogue.json", out);
  return out;
}

/* ---------- bundles ---------- */

function axisYears(first, last) { const a = []; for (let y = first; y <= last; y++) a.push(y); return a; }

// interior nulls of one series, as the contract wants them declared
function gapsOf(dates, data) {
  const first = data.findIndex((v) => v != null);
  const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
  const g = [];
  for (let i = first + 1; i < last; i++) if (data[i] == null) g.push(dates[i]);
  return g;
}

function csvBundles(name, cb, rows, dcfg, vintage) {
  const h = rows.header, col = Object.fromEntries(h.map((c, i) => [c, i]));
  const bundles = {};
  const raw = {};
  for (const [g, geo] of Object.entries(GEOS)) {
    const mine = rows.body.filter((r) => (geo.iso ? r[col.iso_code] === geo.iso : r[col.country] === geo.name && !r[col.iso_code]));
    if (!mine.length) throw new Error(`owid-climate: ${name} has no rows for ${geo.name} (anchor assertion)`);
    raw[g] = [h, ...mine];
    const perCol = {};
    let first = Infinity, last = -Infinity;
    for (const c of cb) {
      if (!(c.column in col)) { console.warn(`owid-climate: codebook column ${c.column} not in ${name} CSV`); continue; }
      const m = new Map();
      for (const r of mine) { const v = parseNumber(r[col[c.column]]); if (v != null) m.set(+r[col.year], v); }
      if (!m.size) continue;   // a column with no value for this geography: nothing published, nothing baked
      perCol[c.column] = m;
      first = Math.min(first, ...m.keys()); last = Math.max(last, ...m.keys());
    }
    const years = axisYears(first, last), dates = years.map((y) => `${y}-01-01`);
    const series = {};
    let gi = 0;
    for (const c of cb) {
      const m = perCol[c.column];
      if (!m) continue;
      const data = years.map((y) => m.get(y) ?? null);
      const gaps = gapsOf(dates, data);
      series[c.column] = { name: `owid_${name}_${c.column}`, label: c.title, unit: unitCode(c.unit, `${name}.${c.column}`), color: GREYS[gi++ % GREYS.length], data,
        ...(gaps.length ? { gaps, gapsNote: "Not published by OWID for these years." } : {}) };
    }
    const slug = dcfg.fetch.csv_bundles[name][g];
    bundles[slug] = {
      meta: {
        dossier: "climate", source: `Our World in Data, ${name === "co2" ? "CO2 and Greenhouse Gas Emissions dataset" : "Energy dataset"}`,
        product: `owid-${name}-data`, base: dcfg.bases[`owid-${name}`], frequency: "annual", unit: "mixed (see each series)",
        vintage, geo: g, latestPeriod: String(last), releaseDate: null, mock: false,
        coverage: `${geo.name}: every column of OWID's ${name === "co2" ? "CO2 and greenhouse-gas" : "energy"} dataset with a value, ${first} to ${last}, annual. ${Object.keys(series).length} series.`,
        note: `Values as published by OWID (licence CC BY 4.0). Producers per column are named in OWID's codebook: ${[...new Set(cb.map((c) => c.source.replace(/\s*\[[^\]]*\]/g, "")))].slice(0, 6).join("; ")}. Growth rates, per-capita figures, shares and cumulative sums are OWID's own arithmetic on those inputs.`,
      },
      dates, series,
    };
  }
  return { bundles, raw };
}

async function indicatorData(id) {
  return owidJson(`https://api.ourworldindata.org/v1/indicators/${id}.data.json`);
}

const isoDay = (zero, days) => new Date(Date.parse(zero + "T00:00:00Z") + days * 86400_000).toISOString().slice(0, 10);

// Reader text (datafix 2026-10-10): OWID's dataset and indicator ids ("surface_temperature_annual_average",
// "failed_care_planet") are slugs, not titles; titles and labels carry them as words. The ids stay
// in meta.product and series.name. scripts/migrations/2026-10-datafix-reader-text.mjs applies the
// same two functions to the baked bundles.
export const datasetWords = (ds) => {
  const w = String(ds).replace(/__/g, ", ").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  return w.replace(/^./, (c) => c.toUpperCase()).replace(/\bet al\b/g, "et al.").replace(/\b([a-z])([a-z]+) et al\./g, (m, a, b) => a.toUpperCase() + b + " et al.");
};
export const labelWords = (name) => (/^[a-z0-9]+(_[a-z0-9]+)+$/.test(String(name)) ? String(name).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : name);

export async function buildOwidClimate(root, dcfg, vintage) {
  /* -- the CSV datasets -- */
  const all = {};
  const rawCsv = {};
  for (const name of Object.keys(DATASETS)) {
    const cb = await codebook(name);
    const rows = await datasetRows(name);
    const { bundles, raw } = csvBundles(name, cb, rows, dcfg, vintage);
    Object.assign(all, bundles);
    rawCsv[name] = { url: DATASETS[name].url, codebook: cb, rows: raw };
  }
  writeRaw(root, "data/raw/climate-owid-co2-energy.json", { vintage, note: "OWID CO2 and energy datasets: the codebooks and every row for India, China, the United States and the World, exactly as served (CSV rows as arrays of strings, header first).", ...rawCsv });

  /* -- OWID climate indicators, India -- */
  const inds = (await discoverIndicators()).filter((i) => i.indiaEntityId != null);
  const groups = new Map();
  const warned = new Set();
  for (const ind of inds) {
    const slug = dcfg.fetch.indicators?.[ind.short] ?? dcfg.fetch.datasets[ind.dataset];
    if (!slug) { if (!warned.has(ind.dataset)) warned.add(ind.dataset); else continue; console.warn(`owid-climate: dataset ${ind.dataset} is in scope but not mapped to a bundle (sources.yml fetch.datasets); the coverage ledger decides it`); continue; }
    if (!groups.has(slug)) groups.set(slug, []);
    groups.get(slug).push(ind);
  }
  const rawInd = {};
  const today = new Date().toISOString().slice(0, 7);
  for (const [slug, list] of groups) {
    const perKey = {};
    let interval = null;
    let lastVersion = "";
    for (const ind of list) {
      const d = await indicatorData(ind.id);
      const vals = new Map();
      d.entities.forEach((e, i) => {
        if (e !== ind.indiaEntityId) return;
        const v = d.values[i];
        if (typeof v !== "number" || !Number.isFinite(v)) return;
        // monthly series are dated by their month; weekly ones keep the exact day OWID serves
        const t = !ind.yearIsDay ? `${d.years[i]}-01-01` : ind.timeInterval === "month" ? isoDay(ind.zeroDay, d.years[i]).slice(0, 7) + "-01" : isoDay(ind.zeroDay, d.years[i]);
        vals.set(t, v);
      });
      rawInd[ind.id] = { catalogPath: ind.catalogPath, name: ind.name, unit: ind.unit, india: [...vals.entries()] };
      if (!vals.size) { console.warn(`owid-climate: ${ind.catalogPath} lists India but serves no India value`); continue; }
      const iv = !ind.yearIsDay ? "year" : ind.timeInterval === "month" ? "month" : "week";
      if (interval && interval !== iv) throw new Error(`owid-climate: ${slug} mixes ${interval} and ${iv} indicators: split the bundle`);
      interval = iv;
      perKey[key(ind.short)] = { ind, vals };
      if ((ind.updated ?? "") > lastVersion) lastVersion = ind.updated;
    }
    if (!Object.keys(perKey).length) continue;
    // the date axis: every published period for the bundle, continuous where the cadence
    // is regular (months, years); decadal and projection-year datasets keep their own points
    let dates = [...new Set(Object.values(perKey).flatMap((p) => [...p.vals.keys()]))].sort();
    const regular = interval !== "week" && !dcfg.fetch.irregular?.includes(slug);
    let dropped = null;
    // an annual series' current year is a part-year average: drop it (see header)
    if (interval === "year" && dcfg.fetch.drop_partial_year?.includes(slug)) {
      const lastY = dates.at(-1).slice(0, 4);
      if (lastY >= today.slice(0, 4)) { dropped = lastY; dates = dates.filter((d) => d.slice(0, 4) < lastY); }
    }
    if (regular) {
      const out = [];
      if (interval === "month") {
        let [y, m] = dates[0].split("-").map(Number); const [ly, lm] = dates.at(-1).split("-").map(Number);
        while (y < ly || (y === ly && m <= lm)) { out.push(`${y}-${String(m).padStart(2, "0")}-01`); m++; if (m > 12) { m = 1; y++; } }
      } else for (let y = +dates[0].slice(0, 4); y <= +dates.at(-1).slice(0, 4); y++) out.push(`${y}-01-01`);
      dates = out;
    }
    const series = {};
    let gi = 0;
    for (const [k, { ind, vals }] of Object.entries(perKey)) {
      const data = dates.map((t) => vals.get(t) ?? null);
      if (!data.some((v) => v != null)) continue;
      const gaps = gapsOf(dates, data);
      // a monthly or weekly level of temperature or rain follows the calendar: flagged so the
      // facts sheet never offers a month-on-month move of it (pipeline/facts.mjs)
      const seasonal = interval !== "year" && !/anomal/i.test(k) && ["degC", "mm", "hectares"].includes(unitCode(ind.shortUnit ?? ind.unit ?? "", ind.catalogPath));
      series[k] = { name: `owid_${ind.dataset}_${k}`, label: labelWords(ind.name), unit: unitCode(ind.shortUnit ?? ind.unit ?? "", ind.catalogPath), ...(seasonal ? { seasonal: true } : {}), color: GREYS[gi++ % GREYS.length], data,
        source: ind.producer, catalogPath: ind.catalogPath.replace(/\/\d{4}-\d{2}-\d{2}\//, "/"),
        ...(gaps.length ? { gaps, gapsNote: "Not published by OWID for these periods." } : {}) };
    }
    const producers = [...new Set(list.map((i) => i.producer).filter(Boolean))].join("; ");
    const d1 = dates.at(-1);
    all[slug] = {
      meta: {
        dossier: "climate", source: `Our World in Data, processing ${producers}`, product: `owid:${list[0].ns}/${list[0].dataset}`,
        base: dcfg.bases[slug] ?? dcfg.bases.default, frequency: interval === "month" ? "monthly" : interval === "week" ? "weekly" : regular ? "annual" : "irregular",
        unit: "see each series", vintage: lastVersion || vintage, geo: "IND",
        latestPeriod: interval === "month" ? d1.slice(0, 7) : interval === "week" ? d1 : d1.slice(0, 4), releaseDate: lastVersion || null, mock: false,
        coverage: `India: ${datasetWords(list[0].dataset)}, Our World in Data (${Object.keys(series).length} series), ${dates[0].slice(0, interval === "year" ? 4 : interval === "month" ? 7 : 10)} to ${d1.slice(0, interval === "year" ? 4 : interval === "month" ? 7 : 10)}.`,
        note: [`OWID dataset ${list[0].ns}/${list[0].dataset}, version ${list[0].version} (updated ${lastVersion}); licence CC BY 4.0; underlying producers: ${producers}.`,
          dropped ? `The year ${dropped} is not shown: OWID's figure for it averages only the months published so far.` : null,
          dcfg.fetch.notes?.[slug] ?? null].filter(Boolean).join(" "),
      },
      dates, series,
    };
  }
  writeRaw(root, "data/raw/climate-owid-indicators.json", { vintage, note: "OWID climate indicators: for each indicator id, its catalog path, name, unit and every India value as served ([period, value]).", indicators: rawInd });

  // anchor assertion: the guide's current series must be there and recent
  const cur = all[dcfg.fetch.anchor.bundle]?.series?.[dcfg.fetch.anchor.series];
  if (!cur?.data?.some((v) => v != null)) throw new Error(`owid-climate: no data for anchor ${dcfg.fetch.anchor.bundle}.${dcfg.fetch.anchor.series}`);
  for (const [slug, b] of Object.entries(all)) writeSeries(root, `data/series/${slug}.json`, b);
  return all;
}

// CLI: --catalogue writes the coverage catalogue
if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--catalogue")) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const out = await catalogue(root);
  console.log(`climate-owid catalogue: ${out.items.length} items`);
}
