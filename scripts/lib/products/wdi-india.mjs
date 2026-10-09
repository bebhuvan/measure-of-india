// scripts/lib/products/wdi-india.mjs: the whole World Development Indicators
// catalogue for India, baked into topic bundles. The worldbank family's second
// WDI adapter (the first, worldbank-wdi.mjs, serves the manufacturing guide and
// is left as it is).
//
// What it does, in order:
//   1. Lists every WDI indicator (/sources/2/indicators, about 1,500 codes,
//      two API calls), for the topic tags and as the completeness check.
//   2. Reads India's values for all of them from the World Bank's per-country
//      bulk file (one 600 KB zip; wbCountryZip in scripts/lib/worldbank.mjs).
//      Per-indicator API calls were tried first and abandoned: the host's
//      firewall blocks bursts, and on 2026-10-09 each call took about 20 s.
//      The bulk file must hold exactly the indicators the list names.
//   3. Archives the raw values to data/raw/worldbank-wdi-india.json (compact
//      but lossless: {year: value} as written in the file, the file's own
//      Last Updated Date as the vintage, and the zip's sha256), FIRST.
//   4. Writes the coverage catalogue, data/coverage/worldbank.catalogue.json:
//      every indicator with at least one India value, id "wdi:" + the code in
//      lower case with dots as colons (WDI codes run coarse to fine already).
//      Indicators with no India value are listed in the catalogue's
//      `no_india_data`, so the gap is visible without being an item.
//   5. Groups indicators into topic bundles by code prefix, using the ordered
//      rules in data/sources.yml (dossiers.worldbank.fetch.groups). A code no
//      rule matches fails the bake: a new WDI indicator cannot slip in or out
//      unnoticed.
//
// Usage: node scripts/fetch.mjs only worldbank      (bake)
//        node scripts/lib/products/wdi-india.mjs --catalogue   (catalogue only,
//        from the archived raw dump, no network)
//
// Bundles: one annual axis per bundle, "YYYY-01-01", from the earliest to the
// latest year any member serves. Members may start late or end early (WDI
// series are ragged); interior nulls are declared in each series' gaps. Values
// are stored as served, never rounded. Each series carries its WDI code as
// `name` (the CSV header) and the indicator name as `label`, and a `unit`
// class inferred from WDI's own naming convention ("(% of GDP)", "(annual %)",
// "(current US$)"): validate.mjs reads unit_ranges for each class.
//
// meta.vintage is the bulk file's "Last Updated Date" (the WDI database
// stamp): the data vintage, not the fetch date.
//
// Hand check (2026-10-09): SP.POP.TOTL for India, 2024, is 1,450,935,791 in
// the WDI DataBank web table and in this bake; it equals UN WPP 2024's
// 1 July 2024 estimate (1,450,935.791 thousand), which WDI cites as its
// source. validate.mjs checks the two agree every year (0.5% tolerance).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { wb, wbCountryZip } from "../worldbank.mjs";
import { parseCsv } from "../tabular.mjs";
import { writeSeries, writeRaw, writeJson } from "../util.mjs";

const toRegex = (g) => new RegExp("^" + g.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
export const keyOf = (code) => code.toLowerCase().replace(/[^a-z0-9]+/g, "_");
export const itemId = (code) => "wdi:" + code.toLowerCase().replace(/\./g, ":");

// WDI's naming convention carries the unit in the last parenthesis. The class
// decides the plausibility range (sources.yml unit_ranges), nothing else.
export function unitClass(name) {
  const n = name.toLowerCase();
  if (/annual %|annual growth|% change|growth \(%|, growth/.test(n)) return "pct_change";
  if (/\(% of gdp\)|% gdp\)|\(% of gdp,/.test(n)) return "pct_gdp";
  if (/\(%[^)]*\)|\(%\)| %\)|percent|\(% /.test(n)) return "pct";
  if (/index|score|rating|scale/.test(n)) return "index";
  if (/lcu/.test(n)) return "lcu";
  if (/ppp|international \$/.test(n)) return "ppp_usd";
  if (/us\$|\$/.test(n)) return "usd";
  if (/per 1,000|per 100,000|per 100 |per 1,000,000|per million/.test(n)) return "rate";
  return "level";
}

function groupOf(code, groups) {
  for (const g of groups) if (g.res.some((re) => re.test(code))) return g;
  return null;
}

/** Turn the raw dump into catalogue + bundles. Pure: no network. */
export function bake(root, dcfg, raw, { write = true } = {}) {
  const groups = dcfg.fetch.groups.map((g) => ({ ...g, res: g.match.map(toRegex) }));
  const withData = [], noData = [];
  const vals = (ind) => Object.entries(ind.values).map(([y, v]) => [Number(y), v]).sort((a, b) => a[0] - b[0]);
  for (const [code, ind] of Object.entries(raw.indicators)) (Object.keys(ind.values).length ? withData : noData).push(code);
  withData.sort(); noData.sort();

  // 1. catalogue
  const items = withData.map((code) => {
    const ind = raw.indicators[code], years = vals(ind).map((v) => v[0]);
    const g = groupOf(code, groups);
    if (!g) throw new Error(`wdi-india: no group in sources.yml (dossiers.worldbank.fetch.groups) matches ${code} "${ind.name}": give it a topic`);
    return { id: itemId(code), label: ind.name, dims: { code, topic: g.bundle, wb_topics: ind.topics, unit: unitClass(ind.name), first: Math.min(...years), last: Math.max(...years), n: years.length, source_org: ind.sourceOrganization || null } };
  });
  const catalogue = {
    family: "worldbank",
    source: "World Bank, World Development Indicators (API v2, source 2), country IND",
    generator: "scripts/lib/products/wdi-india.mjs --catalogue",
    generated_at: raw.vintage,
    note: "One item per WDI indicator with at least one India value. Indicators WDI lists but serves no India value for are named in no_india_data and are not items.",
    indicators_listed: Object.keys(raw.indicators).length,
    no_india_data: noData,
    items,
  };

  // 2. bundles
  const bundles = {};
  for (const g of groups) {
    const codes = withData.filter((c) => groupOf(c, groups) === g);
    if (!codes.length) continue;
    let y0 = Infinity, y1 = -Infinity, vintage = "";
    for (const c of codes) for (const [y] of vals(raw.indicators[c])) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    for (const c of codes) if ((raw.indicators[c].lastupdated ?? "") > vintage) vintage = raw.indicators[c].lastupdated;
    const years = []; for (let y = y0; y <= y1; y++) years.push(y);
    const dates = years.map((y) => `${y}-01-01`);
    const series = {};
    for (const c of codes) {
      const ind = raw.indicators[c], m = new Map(vals(ind));
      const data = years.map((y) => (m.has(y) ? m.get(y) : null));
      const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
      const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
      series[keyOf(c)] = { name: c, label: ind.name, unit: unitClass(ind.name), color: "#878D99", data, ...(gaps.length ? { gaps, gapsNote: "WDI serves no value for India in these years." } : {}) };
    }
    bundles[g.bundle] = {
      meta: {
        dossier: g.dossier, product: "wdi-india", frequency: "annual", base: dcfg.base, source: dcfg.source_agency,
        vintage, mock: false, geo: dcfg.geo ?? "IND", latestPeriod: String(y1), releaseDate: null,
        revisionPolicy: dcfg.revision_policy, coverage: g.coverage,
        note: "Values as published in WDI for India, unrounded. Each series is one WDI indicator; its code is the series name. Series start and end in different years; the axis spans the widest." + (g.caution ? " " + g.caution : ""),
      },
      dates, series,
    };
  }
  if (write) {
    writeJson(root, "data/coverage/worldbank.catalogue.json", catalogue);
    for (const [slug, b] of Object.entries(bundles)) writeSeries(root, `data/series/${slug}.json`, b);
  }
  return { catalogue, bundles };
}

export async function buildWdiIndia(root, dcfg) {
  const zip = await wbCountryZip(dcfg.geo ?? "IND");
  const dataName = Object.keys(zip.files).find((f) => /^API_[A-Z]{3}_DS2_.*\.csv$/.test(f));
  const metaName = Object.keys(zip.files).find((f) => /^Metadata_Indicator_.*\.csv$/.test(f));
  if (!dataName || !metaName) throw new Error(`wdi-india: bulk zip holds ${Object.keys(zip.files).join(", ")}, not the WDI data and indicator metadata`);
  const strip = (t) => t.replace(/^\uFEFF/, "");
  const rows = parseCsv(strip(zip.files[dataName]), ",");
  // the file opens with "Data Source" and "Last Updated Date" lines, then the header
  const updated = rows.find((r) => r[0] === "Last Updated Date")?.[1];
  const source = rows.find((r) => r[0] === "Data Source")?.[1];
  if (source !== "World Development Indicators") throw new Error(`wdi-india: bulk file is "${source}", not WDI`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated ?? "")) throw new Error(`wdi-india: bulk file has no Last Updated Date`);
  const hi = rows.findIndex((r) => r[0] === "Country Name" && r[3] === "Indicator Code");
  const header = rows[hi];
  const yearCols = header.map((h, i) => [h, i]).filter(([h]) => /^\d{4}$/.test(h));
  const metaRows = parseCsv(strip(zip.files[metaName]), ",");
  const mh = metaRows[0];
  const meta = new Map(metaRows.slice(1).filter((r) => r.length > 3).map((r) => [r[mh.indexOf("INDICATOR_CODE")], { org: r[mh.indexOf("SOURCE_ORGANIZATION")] }]));

  const raw = { vintage: updated, note: "World Development Indicators for India, from the World Bank's per-country bulk file (one zip, every WDI indicator). values: {year: value} as written in the file (empty cells dropped). zip_sha256 identifies the exact file.", url: zip.url, zip_sha256: zip.sha256, zip_bytes: zip.bytes, file: dataName, indicators: {} };
  for (const r of rows.slice(hi + 1)) {
    if (r.length < 4 || !r[3]) continue;
    if (r[1] !== (dcfg.geo ?? "IND")) throw new Error(`wdi-india: row for ${r[1]} in the India file`);
    const values = {};
    for (const [y, i] of yearCols) {
      const c = (r[i] ?? "").trim();
      if (c === "") continue;
      const v = Number(c);
      if (!Number.isFinite(v)) throw new Error(`wdi-india: ${r[3]} ${y} is "${c}", not a number`);
      values[y] = v;
    }
    raw.indicators[r[3]] = { name: r[2].trim(), sourceOrganization: (meta.get(r[3])?.org ?? "").trim().slice(0, 300), lastupdated: updated, values };
  }
  // completeness: the file must hold every indicator WDI lists, and nothing else
  const list = await wb("sources/2/indicators", { per_page: 1000 });
  const listed = new Set(list.map((i) => i.id)), inFile = new Set(Object.keys(raw.indicators));
  const missing = [...listed].filter((c) => !inFile.has(c)), extra = [...inFile].filter((c) => !listed.has(c));
  if (list.length < 1000 || missing.length || extra.length) throw new Error(`wdi-india: WDI lists ${list.length} indicators; the bulk file misses ${missing.length} (${missing.slice(0, 5).join(", ")}) and adds ${extra.length} (${extra.slice(0, 5).join(", ")})`);
  for (const i of list) raw.indicators[i.id].topics = (i.topics ?? []).map((t) => (t.value ?? "").trim()).filter(Boolean);
  // anchor: India's population must be there and plausible
  const pv = raw.indicators["SP.POP.TOTL"]?.values ?? {}, pop = pv[Math.max(...Object.keys(pv).map(Number))];
  if (!(pop > 1.3e9 && pop < 1.7e9)) throw new Error(`wdi-india: SP.POP.TOTL latest ${pop} implausible: anchor assertion failed`);
  writeRaw(root, "data/raw/worldbank-wdi-india.json", raw);
  const { catalogue, bundles } = bake(root, dcfg, raw);
  console.log(`  wdi-india: ${catalogue.items.length} indicators with India data, ${catalogue.no_india_data.length} without; ${Object.keys(bundles).length} bundles`);
  return bundles;
}

// --catalogue: regenerate catalogue and bundles from the archived raw dump
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && process.argv.includes("--catalogue")) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/worldbank-wdi-india.json"), "utf8"));
  const { catalogue } = bake(ROOT, cfg.dossiers.worldbank, raw);
  console.log(`catalogue: ${catalogue.items.length} items`);
}
