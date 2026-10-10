// scripts/lib/products/industry-dbie.mjs: the industry series that only the RBI carries,
// read from DBIE through the local Data Bank (scripts/lib/databank.mjs, read-only).
//
// 1. The eight core industries (product `core`). DBIE reports 499 (Index Numbers of Core
//    Industries, annual averages) and 989 (the same, growth rates), from the RBI's Handbook
//    of Statistics on the Indian Economy. Coal, crude oil, natural gas, refinery products,
//    fertilisers, steel, cement and electricity, and the composite index, on three bases:
//    1993-94=100 (six industries; "Finished steel", "Crude petroleum"), 2004-05=100 and
//    2011-12=100 (eight). Each base is its own bundle, never spliced (AGENTS.md rule 1).
//    The DBIE tables are annual only: the monthly index the Office of the Economic Adviser
//    releases is not in DBIE or the Data Bank (recorded in docs/status/industry.md).
//    - growth rates run longer than the index on the 1993-94 base (growth to 2010-11, index
//      to 2004-05), so both are baked as published, side by side;
//    - the 1993-94 base carries a second set of seven 2010-11 growth rows flagged "Time Fis
//      End Of Year = N" beside the full-year ("Y") rows: not a complete financial year, so
//      not baked; the raw keeps them;
//    - 120 and 839 are byte-for-byte the same tables as 499 and 989 (302 and 324 rows),
//      archived for the audit trail and not read twice.
//    Hand check (2026-10-09): composite growth 2011-12 base, 2025-26 = 2.7% (DBIE 989). The
//    OEA's release for April 2026 (20 May 2026) revises the cumulative April-March 2025-26
//    growth of the ICI to 2.7% (the March release had 2.6% provisional). Match.
//
// 2. The IIP on base 1980-81=100 (product `iip-1980`), which MoSPI's eSankhyiki API does not
//    serve: DBIE report 638 (monthly, General, mining, manufacturing, electricity Apr 1981 to
//    Mar 1998; 17 manufacturing groups Apr 1981 to Mar 1994; all "Final") and report 219
//    (financial-year averages 1981-82 to 1997-98). The RBI republishes the CSO's index; for
//    this base it is the only machine-readable copy. y/y is computed from the published
//    levels, as for the MoSPI bases. Every other base in these reports is the RBI's copy of
//    MoSPI's series, which the iip adapter bakes from MoSPI itself (the source of record).
//    Hand check (2026-10-09): General index 1986-87 annual average 155.1 (report 219,
//    155.091667); the mean of report 638's twelve 1986-87 months is 155.09. Consistent.
import { databankRoot, dbieReport } from "../databank.mjs";
import { writeSeries, writeRaw, readRaw, yoyFromLevels, monthAxis } from "../util.mjs";
import fs from "node:fs";
import path from "node:path";

const num = (s) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const fyIso = (fy) => `${fy.slice(0, 4)}-04-01`;
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const MON = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

// one key per industry across the three bases (the names drift: "Finished steel" -> "Steel")
const CORE_KEY = {
  "Overall Index": ["composite", "Composite index of the core industries"],
  "Coal": ["coal", "Coal"],
  "Crude Oil": ["crude_oil", "Crude oil"], "Crude petroleum": ["crude_oil", "Crude oil (crude petroleum)"],
  "Natural Gas": ["natural_gas", "Natural gas"],
  "Refinery Products": ["refinery_products", "Refinery products"], "Petroleum refinery products": ["refinery_products", "Refinery products"],
  "Fertilisers": ["fertilisers", "Fertilisers"],
  "Steel": ["steel", "Steel"], "Finished steel": ["steel", "Steel (finished steel)"],
  "Cement": ["cement", "Cement"],
  "Electricity": ["electricity", "Electricity"],
};
export const CORE_BASES = { "HBS - 1993-94": "1993", "HBS - 2004-05": "2004", "HBS - 2011-12": "2011" };

function readCore(db) {
  const idx = dbieReport(db, "499"), gr = dbieReport(db, "989");
  const twin = { 120: dbieReport(db, "120"), 839: dbieReport(db, "839") };
  return { idx, gr, twin };
}

export async function buildCore(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const { idx, gr, twin } = readCore(db);
  const rawRel = "data/raw/core-industries.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "RBI DBIE: Index Numbers of Core Industries (499, annual averages) and their growth rates (989), RBI Handbook of Statistics, read from the local Data Bank mirror. 120 and 839 are the same tables; their provenance is kept to show it.",
    reports: { 499: { provenance: idx.provenance, header: idx.header, rows: idx.rows }, 989: { provenance: gr.provenance, header: gr.header, rows: gr.rows } },
    twins: Object.fromEntries(Object.entries(twin).map(([id, r]) => [id, r.provenance])),
  });
  const V = readRaw(root, rawRel).vintage;
  if (twin[120].rows.length !== idx.rows.length || twin[839].rows.length !== gr.rows.length) console.warn("core: DBIE 120/839 no longer match 499/989 in size; check which is current");

  for (const [hbs, tag] of Object.entries(CORE_BASES)) {
    const level = new Map(), growth = new Map(), weight = new Map(), label = new Map();
    for (const r of idx.rows) if (r["Base Year"] === hbs) {
      const k = CORE_KEY[r["Industry Name"]]; if (!k) { console.warn(`core: unknown industry "${r["Industry Name"]}"`); continue; }
      (level.get(k[0]) ?? level.set(k[0], new Map()).get(k[0])).set(r.Year, num(r["IIP Index Annual"]));
      weight.set(k[0], num(r["Base Year wise Weight"])); label.set(k[0], k[1]);
    }
    for (const r of gr.rows) if (r["Base Year"] === hbs) {
      if (r["Time Fis End Of Year"] !== "Y") continue;   // not a complete financial year: raw only
      const k = CORE_KEY[r["Industry Name"]]; if (!k) { console.warn(`core: unknown industry "${r["Industry Name"]}"`); continue; }
      (growth.get(k[0]) ?? growth.set(k[0], new Map()).get(k[0])).set(r.Year, r2(num(r["Index Value"])));
      weight.set(k[0], weight.get(k[0]) ?? num(r["Base Year wise Weight"])); label.set(k[0], label.get(k[0]) ?? k[1]);
    }
    // A base's first growth year must be measured against its own base year (=100). The RBI's
    // 1994-95 rows on the 1993-94 base are not: index 111.1 at -55.5% implies a year-earlier
    // level near 250, the 1980-81 base's. A growth figure across two rulers is a splice, so it
    // is dropped (raw keeps it) and disclosed; the rule is checked for every base and industry.
    const spliced = [];
    for (const [k, g] of growth) {
      const fy0 = [...g.keys()].sort()[0], lv = level.get(k)?.get(fy0);
      const prevFy = `${+fy0.slice(0, 4) - 1}-${fy0.slice(2, 4)}`;
      if (lv != null && !level.get(k)?.has(prevFy) && Math.abs(lv / (1 + g.get(fy0) / 100) - 100) > 5) { g.delete(fy0); spliced.push(`${label.get(k)} ${fy0}`); }
    }
    if (spliced.length) console.warn(`core ${tag}: first-year growth measured against another base, not baked: ${spliced.join(", ")}`);
    const fys = [...new Set([...level.values(), ...growth.values()].flatMap((m) => [...m.keys()]))].sort();
    if (!fys.length) throw new Error(`core: no rows for base ${hbs}`);
    const axis = []; for (let y = +fys[0].slice(0, 4); y <= +fys.at(-1).slice(0, 4); y++) axis.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
    const order = ["composite", "coal", "crude_oil", "natural_gas", "refinery_products", "fertilisers", "steel", "cement", "electricity"].filter((k) => label.has(k));
    const series = {};
    let gi = 0;
    for (const k of order) {
      const wt = weight.get(k);
      const wl = k === "composite" ? `weight ${wt} in the IIP` : `weight ${wt} in the IIP`;
      if (level.get(k)?.size) series[`${k}_index`] = { name: `core_${k}_index_base${tag}`, label: `${label.get(k)}, index (${wl})`, unit: "index", color: k === "composite" ? "#2E4BD8" : GREYS[gi++ % 4], weight: wt, data: axis.map((fy) => level.get(k).get(fy) ?? null) };
      if (growth.get(k)?.size) series[`${k}_growth`] = { name: `core_${k}_growth_pct_base${tag}`, label: `${label.get(k)}, growth on a year earlier (${wl})`, unit: "pct_yoy", color: k === "composite" ? "#2E4BD8" : GREYS[gi++ % 4], weight: wt, data: axis.map((fy) => growth.get(k).get(fy) ?? null) };
    }
    // interior nulls are disclosed on the series that miss them (none expected)
    for (const s of Object.values(series)) {
      const f = s.data.findIndex((v) => v != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      const g = axis.filter((_, i) => i > f && i < l && s.data[i] == null).map(fyIso);
      if (g.length) { s.gaps = g; s.gapsNote = "Not published for this year in the RBI table."; }
    }
    const base = `${hbs.slice(6)}=100`;
    const n = order.length - 1;
    writeSeries(root, `data/series/core-${tag}.json`, {
      meta: {
        dossier: "core", frequency: "annual", base, unit: "index", source: dcfg.source_agency, product: "Index of Eight Core Industries (RBI Handbook of Statistics, DBIE 499 and 989)",
        vintage: V, mock: false, geo: dcfg.geo ?? "IND", latestPeriod: axis.at(-1).slice(0, 4) + "-04", releaseDate: null, revisionPolicy: dcfg.revision_policy,
        coverage: `The composite index and its ${n} industries on base ${base}: financial-year average index and growth on a year earlier, as published`,
        note: `Base ${base}, a separate ruler from the other core-industry bases (never spliced). Index levels are financial-year averages; growth is the RBI's published growth on a year earlier, not recomputed. Weights are each industry's weight in the IIP of the same base; the composite's weight is the core industries' combined weight in the IIP.`
          + (tag === "1993" ? " The 1993-94 base covers six industries (no natural gas or fertilisers). Its growth rates run to 2010-11, six years past its index (to 2004-05). For 2010-11 the RBI also prints a second set of growth rows flagged as not a complete financial year; only the full-year rows are baked." : "")
          + (tag === "2004" ? " Index to 2015-16, growth to 2013-14, as the RBI publishes them." : "")
          + (spliced.length ? ` The RBI's growth rates for the base's first year (${[...new Set(spliced.map((x) => x.split(" ").at(-1)))].join(", ")}) are measured against the previous base's index (1994-95 on base 1993-94 reads -55.5% for the composite: a year-earlier level near 250, the 1980-81 base's), a splice across rulers; they are not baked, and the raw archive keeps them.` : ""),
      },
      dates: axis.map(fyIso), series,
    });
  }
}

export async function buildIip1980(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const M = dbieReport(db, "638"), A = dbieReport(db, "219");
  const B = "IIP-1980-81";
  const mRows = M.rows.filter((r) => r["Base Year"] === B), aRows = A.rows.filter((r) => r["Base Year"] === B);
  const rawRel = "data/raw/iip-1980.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "RBI DBIE report 638 (monthly IIP, sectoral) and 219 (annual averages), rows on base 1980-81=100 only; the other bases in these reports are the RBI's copy of MoSPI's IIP, baked from MoSPI itself. Read from the local Data Bank mirror.",
    reports: { 638: { provenance: M.provenance, header: M.header, rows: mRows }, 219: { provenance: A.provenance, header: A.header, rows: aRows } },
  });
  const V = readRaw(root, rawRel).vintage;
  if (mRows.length < 3000) throw new Error(`iip-1980: only ${mRows.length} monthly rows on base 1980-81 (expected about 3,468)`);
  const tidy = (s) => String(s).replace(/^S\.[\d.]+\)\s*/, "").replace(/\s*\(1980-81\)\s*$/, "").replace(/^IIP General Index$/, "General").trim();
  const keyOf = (code, name) => (code === "IIPS04" ? "general" : ["IIPS01", "IIPS02", "IIPS03"].includes(code) ? `sector_${{ IIPS01: "mining", IIPS02: "manufacturing", IIPS03: "electricity" }[code]}` : `group_${code.toLowerCase()}`);
  const levels = new Map(), labels = new Map(), versions = new Set();
  for (const r of mRows) {
    const [mon, yr] = r["Time Month"].split("-");
    const ym = `${yr}-${MON[mon]}`;
    const code = r["Iip Industry Code"], k = keyOf(code, r["fact_index_sectoral_monthly.Industry Name"]);
    versions.add(r.Version);
    labels.set(k, `${tidy(r["fact_index_sectoral_monthly.Industry Name"])}${k.startsWith("group_") ? ` (${r["fact_index_sectoral_monthly.Industry Name"].match(/^S\.([\d.]+)\)/)?.[1] ?? ""})` : ""}`);
    const v = num(r["Index Value"]); if (v == null) continue;
    const m = levels.get(k) ?? levels.set(k, new Map()).get(k);
    if (m.has(ym) && m.get(ym) !== v) throw new Error(`iip-1980: two values for ${k} ${ym}`);
    m.set(ym, v);
  }
  if ([...versions].some((v) => v !== "Final")) throw new Error(`iip-1980: unexpected versions ${[...versions]}`);
  const months = [...levels.get("general").keys()].sort();
  const yoys = new Map([...levels].map(([k, m]) => [k, yoyFromLevels(m)]));
  const ax = monthAxis(yoys.get("general").size ? [...yoys.get("general").keys()].sort()[0] : months[0], months.at(-1));
  const meta = (extra) => ({ dossier: "iip", frequency: "monthly", base: "1980-81=100", source: dcfg.source_agency, product: "Index of Industrial Production, base 1980-81 (CSO), as republished by the RBI (DBIE 638 and 219)",
    vintage: V, mock: false, geo: dcfg.geo ?? "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });
  const NOTE = "Base 1980-81=100, the oldest IIP ruler: a separate bundle, never spliced with 1993-94=100 or later (the two overlap from April 1994 to March 1998). MoSPI's eSankhyiki API does not serve this base; the RBI's DBIE copy of the CSO index is the source here. Growth on a year earlier is computed from the published index levels.";
  const mk = (keys) => Object.fromEntries(keys.map((k, i) => [k, { name: `iip_${k}_yoy_pct_base1980`, label: labels.get(k), unit: "pct_yoy", color: k === "general" ? "#2E4BD8" : GREYS[i % 4], data: ax.map((ym) => yoys.get(k).get(ym) ?? null) }]));
  const top = ["general", "sector_mining", "sector_manufacturing", "sector_electricity"];
  writeSeries(root, "data/series/iip-1980.json", { meta: meta({ latestPeriod: ax.at(-1), coverage: "General index and the three sectors (mining, manufacturing, electricity), growth on a year earlier, April 1982 to March 1998", note: NOTE }), dates: ax.map((ym) => `${ym}-01`), series: mk(top) });
  const groups = [...levels.keys()].filter((k) => k.startsWith("group_")).sort((a, b) => labels.get(a).match(/\(([\d.]+)\)$/)[1].localeCompare(labels.get(b).match(/\(([\d.]+)\)$/)[1], "en", { numeric: true }));
  const gLast = groups.map((k) => [...yoys.get(k).keys()].sort().at(-1)).sort().at(-1);
  const gAx = monthAxis(ax[0], gLast);
  const gs = mk(groups); for (const s of Object.values(gs)) s.data = s.data.slice(0, gAx.length);
  writeSeries(root, "data/series/iip-industries-1980.json", { meta: meta({ latestPeriod: gAx.at(-1), coverage: `The ${groups.length} manufacturing groups the RBI publishes on the 1980-81 classification, growth on a year earlier, April 1982 to March 1994 (the RBI's table stops there)`, note: NOTE }), dates: gAx.map((ym) => `${ym}-01`), series: gs });

  // financial-year averages, report 219
  const aLev = new Map(), aLab = new Map(), aWt = new Map();
  for (const r of aRows) {
    const k = keyOf(r["Iip Industry Code1"]);
    aLab.set(k, tidy(r["Industry Name"]).replace(/^S\.\d\)\s*/, ""));
    aWt.set(k, num(r["IIP Industry Weight"]));
    (aLev.get(k) ?? aLev.set(k, new Map()).get(k)).set(r.Year, num(r["IIP Index ( Avg )"]));
  }
  const fys = [...aLev.get("general").keys()].sort();
  const fax = []; for (let y = +fys[0].slice(0, 4); y <= +fys.at(-1).slice(0, 4); y++) fax.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
  const as = {};
  top.filter((k) => aLev.has(k)).forEach((k, i) => {
    const m = aLev.get(k);
    as[`${k}_index`] = { name: `iip_${k}_index_fy_base1980`, label: `${aLab.get(k)}, index (weight ${aWt.get(k)})`, unit: "index", color: k === "general" ? "#2E4BD8" : GREYS[i % 4], data: fax.map((fy) => r2(m.get(fy) ?? null)) };
    as[`${k}_growth`] = { name: `iip_${k}_growth_fy_pct_base1980`, label: `${aLab.get(k)}, growth on a year earlier (computed from the averages)`, unit: "pct_yoy", color: GREYS[(i + 1) % 4],
      data: fax.map((fy) => { const p = m.get(`${+fy.slice(0, 4) - 1}-${fy.slice(2, 4)}`); const v = m.get(fy); return p && v ? r2((v / p - 1) * 100) : null; }) };
  });
  writeSeries(root, "data/series/iip-annual-1980.json", { meta: { ...meta({ latestPeriod: fax.at(-1).slice(0, 4) + "-04", coverage: "General index and the three sectors, financial-year averages and their growth, 1981-82 to 1997-98", note: NOTE + " Financial-year averages as the RBI publishes them (report 219); growth is computed from those averages." }), frequency: "annual" }, dates: fax.map(fyIso), series: as });
}

/* Catalogue (docs/CONTRACT-coverage.md). Family `core`: every row label of DBIE 499 and 989,
 *   core:<base>:<index|growth>:<industry>
 * Family `iip-dbie`: the RBI's IIP tables in DBIE (report catalogue, read-only). The two read
 * here are itemised by base and industry code; the others are listed whole:
 *   iip-dbie:<report>:<base>:<code>   (638 monthly, 219 annual)
 *   iip-dbie:<report>                 (a report not read) */
import { databankQuery } from "../databank.mjs";
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
export async function catalogueIndustryDbie() {
  const { cfg } = sourceCfg("core");
  const db = databankRoot(cfg?.families?.databank);
  const { idx, gr } = readCore(db);
  const items = [];
  for (const [rep, kind] of [[idx, "index"], [gr, "growth"]]) for (const r of rep.rows)
    items.push({ id: `core:${CORE_BASES[r["Base Year"]] ?? idPart(r["Base Year"])}:${kind}:${idPart(r["Industry Name"])}`, label: `${r["Industry Name"]} (${r["Base Year"].replace("HBS - ", "base ")})` });
  // the whole core-industries menu, so a new DBIE table shows up as a new item
  const cat = databankQuery(db, "rbi_dbie_report_catalog", "SELECT DISTINCT report_id, report_name FROM {table} WHERE lower(report_name) LIKE '%core industries%' OR lower(report_name) LIKE '%infrastructure industries%' ORDER BY report_id").rows;
  for (const r of cat) if (!["499", "989"].includes(r.report_id)) items.push({ id: `core:report:${r.report_id}`, label: r.report_name.trim() });
  writeCatalogue("core", { source: "Reserve Bank of India: Index Numbers of Core Industries (DBIE, via the local Data Bank)",
    generator: "scripts/lib/products/industry-dbie.mjs --catalogue",
    note: "Every row label of DBIE 499 (index) and 989 (growth), by base and industry; other DBIE core-industry tables listed whole.", items });

  const items2 = [];
  const ip = databankQuery(db, "rbi_dbie_report_catalog", "SELECT DISTINCT report_id, report_name, frequency FROM {table} WHERE lower(report_name) LIKE '%industrial production%' ORDER BY report_id").rows;
  const seen = new Set();
  for (const r of ip) {
    if (seen.has(r.report_id)) continue; seen.add(r.report_id);
    if (r.report_id === "638") {
      for (const x of dbieReport(db, "638").rows) items2.push({ id: `iip-dbie:638:${idPart(x["Base Year"].replace("IIP-", ""))}:${idPart(x["Iip Industry Code"])}`, label: `${x["fact_index_sectoral_monthly.Industry Name"]}, monthly (${x["Base Year"]})` });
    } else if (r.report_id === "219") {
      for (const x of dbieReport(db, "219").rows) items2.push({ id: `iip-dbie:219:${idPart(x["Base Year"].replace("IIP-", ""))}:${idPart(x["Iip Industry Code1"])}`, label: `${x["Industry Name"]}, financial-year average (${x["Base Year"]})` });
    } else items2.push({ id: `iip-dbie:${r.report_id}`, label: `${r.report_name.trim()} (${r.frequency})` });
  }
  writeCatalogue("iip-dbie", { source: "Reserve Bank of India: the Index of Industrial Production as republished in DBIE (via the local Data Bank)",
    generator: "scripts/lib/products/industry-dbie.mjs --catalogue",
    note: "Every DBIE report on industrial production; 638 (monthly) and 219 (annual) itemised by base and industry code from their own rows.", items: items2 });
}
await catalogueCli(import.meta.url, catalogueIndustryDbie);
