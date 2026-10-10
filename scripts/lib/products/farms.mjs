// scripts/lib/products/farms.mjs: what India grows, where, how much per hectare, and what the
// state pays for it. The agriculture ministry's crop statistics and the food ministry's
// procurement, off-take and stocks, as RBI reproduces them in DBIE (Statistics > Real Sector >
// Agriculture, and the Handbook of Statistics on the Indian Economy, Part I).
//
// SOURCES, in order of precedence (docs/briefs/dbie-wave.md):
//   the local Data Bank (read-only, scripts/lib/databank.mjs) for every report it holds:
//     623 foodgrain output, 624 commercial-crop output, 625 foodgrain area, 886 and 887 yield,
//     459 and 460 index numbers, 461 and 462 minimum support prices, 463 land use and inputs,
//     464 procurement, off-take and stocks, 465 state-wise output;
//   the RBI Innovation Hub's DBIE service (scripts/lib/rbihub.mjs) for what the Data Bank lacks:
//     report 190 (area under commercial crops since 1951; the Data Bank's fetch failed), the
//     SDMX dataset AGG_STAT_IS_RN (fertiliser used per hectare, by state), and the Handbook's
//     own printed grids of every report above (164-169, 189-195, 278, 465), read for their
//     footnotes (which year is an advance estimate, what a stock date is) and cross-checked
//     cell by cell against the Data Bank (cross-check summary in data/raw/farms-dbie.json).
//
// RULERS (AGENTS.md rule 1), each its own bundle:
//   the ministry's final estimates against its latest advance estimate: the year the
//     Handbook's footnote names ("Data for 2025-26 are based on Third Advance Estimates") goes
//     to farms-advance (states: farms-states-production-advance), every other year to the
//     final bundles. The stage is read from the footnote each run; a year the Data Bank holds
//     beyond the footnote's year fails the build (its stage would be unknown).
//   index numbers of agricultural production on three bases (triennium ending 1981-82,
//     1993-94 and 2007-08 = 100): three bundles, never linked.
//   state reorganisations (src/dossiers/states-key.js): undivided Madhya Pradesh, Bihar and
//     Uttar Pradesh to 1999-2000, undivided Andhra Pradesh to 2014-15, Jammu and Kashmir with
//     Ladakh to 2018-19: separate series from their successors, never joined.
//
// DBIE VALUE TRAPS handled here:
//   - 623, 624, 625, 886, 463, 464 and 465 repeat every value once per display unit
//     (ACTUALS, THOUSANDS, LAKHS, ...) with the same stored number: the ACTUALS row is read
//     and scaled here. 463 and 464 are printed in lakh units, so they are read as ACTUALS
//     divided by 100,000. 463's pesticide row shows why the scale must be checked against the
//     print: its ACTUALS (6,796,000 for 2023-24) is the printed '000 tonnes (68.0) times
//     100,000, not tonnes.
//   - "Pub Unit Desc" says TONNES for every crop in 624, but RBI's own table prints cotton in
//     bales of 170 kg, jute and mesta in bales of 180 kg, and tea and coffee in kg (the
//     Handbook's footnotes; asserted below). Stored: thousand tonnes (tea and coffee: million
//     kg = thousand tonnes), thousand bales for cotton and jute.
//   - 464 lists "stocks" for 1950-51 to 1970-71 at 6,680 lakh tonnes of rice and the like:
//     more than four times India's whole harvest, printed the same way in the Handbook. Their
//     unit cannot be read; they are left out (ledger: excluded), and the bundle starts 1972-73.
//   - 464's latest year (2026-27) is a part year (stocks on 31 May 2026; off-take April-May):
//     baked apart in farms-pds-latest at the date the footnote names.
//   - The MSP for "coarse cereals" in 461 is the maize price (the Handbook heads the column
//     "Maize"); 462 repeats 461's non-foodgrain rows (checked equal, then 461 is read).
//
// DATES: crop years (July to June), marketing years and fiscal years are all dated at 1 April
// of their first year, so "2024-25" is 2024-04-01, as every fiscal-year bundle on the site is.
//
// Hand check (2026-10-10), one value per bundle against RBI's own publication (the Handbook's
// printed grid on the RBI Innovation Hub service, document ids in the raw dump) and, where
// known, the ministries' releases:
//   farms-production: rice 2024-25, 150,184 thousand tonnes; Handbook table (report 189)
//     prints 1,502 lakh tonnes. Cotton 2023-24, 32,522 thousand bales = 325.22 lakh bales, the
//     ministry's 2023-24 final figure.
//   farms-area: foodgrains 2024-25, 137,546 thousand ha; report 167 prints 1,375 lakh ha.
//   farms-yield: wheat 2024-25, 3,595 kg/ha; report 191 prints 3,595.
//   farms-advance: foodgrains 2025-26 (third advance estimates), 376,563 thousand tonnes;
//     report 189 prints 3,766 lakh tonnes for 2025-26.
//   farms-msp: paddy (common) 2024-25 Rs 2,300 a quintal and wheat 2025-26 Rs 2,585, the
//     government's announced MSPs for kharif 2024-25 and rabi marketing season 2026-27;
//     report 194 prints both.
//   farms-landuse: net sown area 2024-25, 141,370 thousand ha; report 278 prints 1,413.7 lakh ha.
//   farms-pds: wheat stocks 2024-25, 117.9 lakh tonnes (central pool on 1 April 2025, 11.8
//     million tonnes, as the food ministry reported); report 169 prints 117.9.
//   farms-pds-latest: total stocks on 31 May 2026, 1,226.5 lakh tonnes; report 169 prints it.
//   farms-index-2008, -1994, -1982: the all-crops production index, as reports 164 and 165
//     print it on each base (the cross-check compares every printed cell, 1,759 of them).
//   farms-states-production: Punjab wheat 2021-22, 14,861.4 thousand tonnes; report 465's grid
//     prints 14,861.4.
//   farms-states-fertiliser: All India 2004-05, 94.5 kg per hectare, as the SDMX dataset and
//     the Handbook of Statistics on Indian States table 94 give it.
import { databankRoot, dbieReport } from "../databank.mjs";
import { rbihubCatalogue, rbihubCsv, rbihubTable, rbihubCodelist } from "../rbihub.mjs";
import { parseCsv, parseNumber } from "../tabular.mjs";
import { writeSeries, writeRaw, readRaw } from "../util.mjs";
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
import { placeStrict } from "../../../src/dossiers/states-key.js";

const ACC = "#2E4BD8", GOLD = "#C47A16";
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const RAW = "data/raw/farms-dbie.json";
const HUB_SOURCE = "Reserve Bank of India, DBIE, via the Reserve Bank Innovation Hub's data service";

// the Data Bank reports this adapter reads, and the Handbook twin printed on the RBI Hub
const DB_REPORTS = ["459", "460", "461", "462", "463", "464", "465", "623", "624", "625", "886", "887"];
const TWIN = { 623: 189, 624: 166, 625: 167, 886: 191, 887: 192, 459: 165, 460: 164, 461: 194, 462: 195, 463: 278, 464: 169, 465: 465 };
const HUB_REPORTS = [190, 164, 165, 166, 167, 169, 189, 191, 192, 194, 195, 278, 465];
const HUB_SDMX = ["agg_stat_is_rn", "area_under_cult_rn"];

/* ---------------- crops ---------------- */
// key, the label a reader sees, the group, and the stored unit with the divisor from DBIE's
// ACTUALS (tonnes; bales; kg)
const CROPS = {
  rice: { label: "Rice", group: "Cereals" },
  wheat: { label: "Wheat", group: "Cereals" },
  coarse_cereals: { label: "Coarse cereals", group: "Cereals" },
  cereals: { label: "Cereals", group: "Cereals" },
  pulses: { label: "Pulses", group: "Pulses" },
  foodgrains: { label: "Foodgrains", group: "Foodgrains" },
  groundnut: { label: "Groundnut", group: "Oilseeds" },
  rapeseed_mustard: { label: "Rapeseed and mustard", group: "Oilseeds" },
  soyabean: { label: "Soyabean", group: "Oilseeds" },
  oilseeds: { label: "Oilseeds (nine)", group: "Oilseeds" },
  sugarcane: { label: "Sugarcane", group: "Commercial crops" },
  cotton: { label: "Cotton (lint)", group: "Fibres" },
  jute_mesta: { label: "Raw jute and mesta", group: "Fibres" },
  tea: { label: "Tea", group: "Plantation crops" },
  coffee: { label: "Coffee", group: "Plantation crops" },
  tobacco: { label: "Tobacco", group: "Commercial crops" },
  other_oilseeds: { label: "Other oilseeds (the seven besides groundnut and mustard)", group: "Oilseeds" },
  major_commercial: { label: "All major commercial crops (oilseeds, fibres, sugarcane, tea, coffee, tobacco)", group: "Commercial crops" },
};
const CROP_ORDER = Object.keys(CROPS);
const norm = (s) => String(s ?? "").toLowerCase().replace(/&/g, "and").replace(/[^a-z]+/g, "");
const CROP_BY_NAME = {
  rice: "rice", wheat: "wheat", coarsecereals: "coarse_cereals", cereals: "cereals", pulses: "pulses",
  foodgrains: "foodgrains", groundnut: "groundnut", rapeseedandmustard: "rapeseed_mustard", soyabean: "soyabean",
  oilseeds: "oilseeds", sugarcane: "sugarcane", cottonlint: "cotton", rawjuteandmesta: "jute_mesta", tea: "tea",
  coffee: "coffee", tobacco: "tobacco",
};
const cropKey = (name) => {
  const k = CROP_BY_NAME[norm(name)];
  if (!k) throw new Error(`farms: unknown crop "${name}"`);
  return k;
};
// output: DBIE ACTUALS -> stored unit. Cotton and jute are counted in bales, tea and coffee in kg
const OUTPUT_UNIT = (k) => (k === "cotton" ? { unit: "thousand_bales", div: 1e3, note: "thousand bales of 170 kg" }
  : k === "jute_mesta" ? { unit: "thousand_bales", div: 1e3, note: "thousand bales of 180 kg" }
  : k === "tea" || k === "coffee" ? { unit: "thousand_tonne", div: 1e6, note: "million kg (thousand tonnes)" }
  : { unit: "thousand_tonne", div: 1e3, note: "thousand tonnes" });

/* ---------------- helpers ---------------- */
// "2024-25" -> "2024-04-01"
const fyDate = (y) => {
  const m = /^(\d{4})-\d{2}/.exec(String(y).trim());
  if (!m) throw new Error(`farms: cannot read the year "${y}"`);
  return `${m[1]}-04-01`;
};
const fyLabel = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const yearAxis = (first, last) => {
  const out = [];
  for (let y = +first.slice(0, 4); y <= +last.slice(0, 4); y++) out.push(`${y}-04-01`);
  return out;
};
const round = (v, dp = 3) => (v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp);
/** A series from a Map(date -> value) on an axis, with interior gaps declared. */
function mkSeries(axis, map, props, gapsNote) {
  const data = axis.map((d) => (map.has(d) ? map.get(d) : null));
  const first = data.findIndex((v) => v != null);
  const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
  const gaps = first < 0 ? [] : axis.filter((d, i) => i > first && i < last && data[i] == null);
  return { ...props, data, ...(gaps.length ? { gaps, gapsNote: gapsNote ?? "RBI's table prints no figure for these years (a dash: not available)." } : {}) };
}
function axisOf(maps) {
  const all = [];
  for (const m of maps) all.push(...m.keys());
  all.sort();
  return yearAxis(all[0], all.at(-1));
}

/* ---------------- the RBI Hub: Handbook grids ---------------- */
// A Handbook report as the Hub stores it: rows of (src_file, tab, period, row_no, c1..cN), the
// printed grid with its title, unit line, header, column numbers, data and footnotes. Parsed
// per tab into { unit, cols: [{parent, child}], rows: [{ lead, year, cells }], weights, notes }.
export function parseGrid(csvText) {
  const table = parseCsv(csvText, ",");
  const head = table[0];
  const ci = (n) => head.indexOf(n);
  const cIdx = head.map((h, i) => (/^c\d+$/.test(h) ? i : -1)).filter((i) => i >= 0);
  const tabs = new Map();
  for (const r of table.slice(1)) {
    if (!r.length || r.every((c) => String(c).trim() === "")) continue;
    const tab = r[ci("tab")];
    if (!tabs.has(tab)) tabs.set(tab, []);
    tabs.get(tab).push({ n: +r[ci("row_no")], c: cIdx.map((i) => String(r[i] ?? "")) });
  }
  const out = [];
  const isUnit = (c) => /^\(.*\)$|kg\s*\/\s*hectare/i.test(c[0].trim());
  for (const [tab, rowsRaw] of tabs) {
    const rows = rowsRaw.sort((a, b) => a.n - b.n).map((r) => r.c);
    const width = Math.max(...rows.map((c) => c.length));
    // a tab can stack several printed tables (index numbers on three bases): one block per
    // column-number row ("1, 2, 3 ..."), its header above it, its unit line above that
    const nums = rows.map((c, i) => (c[0].trim() === "1" && c[1]?.trim() === "2" ? i : -1)).filter((i) => i >= 0);
    const blocks = nums.map((numRow) => {
      let h0 = numRow - 1;
      while (h0 > 0 && rows[h0 - 1].some((x) => x.trim() !== "") && !isUnit(rows[h0 - 1])) h0--;
      let u = h0 - 1;
      while (u >= 0 && !isUnit(rows[u]) && rows[u].every((x) => x.trim() === "")) u--;
      return { numRow, h0, unitIdx: u >= 0 && isUnit(rows[u]) ? u : null };
    });
    blocks.forEach((bl, bi) => {
      const end = bi + 1 < blocks.length ? (blocks[bi + 1].unitIdx ?? blocks[bi + 1].h0) : rows.length;
      const block = rows.slice(bl.h0, bl.numRow);
      const cols = [];
      for (let j = 0; j < width; j++) {
        const child = [...block].reverse().map((c) => (c[j] ?? "").trim()).find((x) => x) ?? "";
        let parent = "";
        for (let k = j; k >= 0 && !parent; k--) parent = (block[0][k] ?? "").trim();
        cols.push({ parent: parent === child ? "" : parent, child });
      }
      const yearCol = cols.findIndex((c) => /^year$/i.test(c.child));
      const data = [], notes = [];
      let lead = "", weights = null;
      for (const c of rows.slice(bl.numRow + 1, end)) {
        const t0 = c[0].trim();
        if (/^notes?\s*:/i.test(t0) || /^source\s*:/i.test(t0)) { notes.push(t0); continue; }
        if (/^weights?$/i.test(t0)) { weights = c.map((x) => parseNumber(x)); continue; }
        const yc = yearCol >= 0 ? yearCol : 0;
        const ytxt = (c[yc] ?? "").trim();
        if (!/^\d{4}-\d{2}/.test(ytxt)) continue;
        if (yearCol > 0 && t0) lead = t0;
        data.push({ lead, year: ytxt.slice(0, 7), cells: c.map((x) => x.trim()) });
      }
      // footnotes sit after the last block; every block of the tab carries them
      const tail = rows.slice(blocks.at(-1).numRow + 1).map((c) => c[0].trim()).filter((t) => /^notes?\s*:|^source\s*:/i.test(t));
      out.push({ tab, block: bi, unit: bl.unitIdx != null ? rows[bl.unitIdx][0].trim() : null, cols, yearCol, rows: data, weights, notes: [...new Set([...notes, ...tail])].join("\n") });
    });
  }
  return out;
}
/** "Data for 2025-26 are based on Third Advance Estimates" -> { year, stage } or null. */
export function advanceOf(notes) {
  const m = /data for (\d{4}-\d{2}) (?:are|is) based on ([a-z ]*?advance estimates?)/i.exec(notes || "");
  return m ? { year: m[1], stage: m[2].replace(/\s+/g, " ").trim().replace(/^\w/, (c) => c.toUpperCase()).replace(/ \w/g, (w) => w.toLowerCase()) } : null;
}
const decimals = (s) => { const m = /\.(\d+)/.exec(String(s)); return m ? m[1].length : 0; };

/* Cross-check: Data Bank values against the Handbook's printed cells, at the printed precision.
 * pairs: [{ label, db, hub }] with db already scaled to the printed unit; hub the printed text. */
function compare(name, pairs, tolerance = 0) {
  let match = 0, off = [];
  for (const p of pairs) {
    const hv = parseNumber(p.hub);
    if (hv == null || p.db == null) continue;
    const dp = decimals(p.hub);
    const step = 10 ** -dp;
    // the printed figure is the Data Bank's rounded at the printed precision (allow one step
    // for half-way rounding)
    if (Math.abs(p.db - hv) <= step * 1.01 + tolerance) match++;
    else off.push(`${p.label}: Data Bank ${round(p.db, 3)}, printed ${p.hub}`);
  }
  return { name, compared: match + off.length, match, mismatches: off.slice(0, 40), mismatchCount: off.length };
}

/* ---------------- read everything once ---------------- */
async function readSources(root, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const R = {};
  for (const id of DB_REPORTS) R[id] = dbieReport(db, id);
  const cat = await rbihubCatalogue();
  const H = {};
  for (const id of HUB_REPORTS) {
    // the Handbook copy of a report (publications) where the Hub holds both menus' copies
    const ents = cat.filter((e) => e.report_id === id && e.status === "loaded");
    const e = ents.find((x) => x.source === "publications") ?? ents[0];
    if (!e) throw new Error(`farms: the RBI Hub has no loaded table for report ${id}`);
    const meta = await rbihubTable(e.schema_name, e.table_name);
    H[id] = { entry: { report_id: id, title: e.title, menu_path: e.menu_path, schema: e.schema_name, table: e.table_name, row_count: e.row_count },
      loaded_at: meta?.data?.loaded_at ?? null, provenance: meta?.provenance ?? null, csv: await rbihubCsv(e.schema_name, e.table_name) };
  }
  const SD = {};
  for (const t of HUB_SDMX) {
    const e = cat.find((x) => x.table_name === t && x.status === "loaded");
    if (!e) throw new Error(`farms: the RBI Hub has no loaded SDMX dataset ${t}`);
    const meta = await rbihubTable(e.schema_name, e.table_name);
    SD[t] = { entry: { title: e.title, menu_path: e.menu_path, schema: e.schema_name, table: e.table_name, dsd_code: e.dsd_code, row_count: e.row_count },
      loaded_at: meta?.data?.loaded_at ?? null, csv: await rbihubCsv(e.schema_name, e.table_name), codelist: await rbihubCodelist(e.dsd_code) };
  }
  return { R, H, SD, cat };
}

/* ---------------- the build ---------------- */
export async function buildFarms(root, dcfg, vintage, cfg) {
  const { R, H, SD } = await readSources(root, cfg);
  const grids = Object.fromEntries(Object.entries(H).map(([id, h]) => [id, parseGrid(h.csv)]));
  const gridOf = (id) => {
    const g = grids[id];
    if (!g?.length) throw new Error(`farms: could not read the Handbook grid of report ${id}`);
    return g;
  };
  const notesOf = (id) => gridOf(id).map((t) => t.notes).join("\n");

  // the stage of the latest year, from each report's Handbook footnote
  const stage = {};
  for (const id of ["623", "624", "625", "886", "887", "459", "460", "465"]) stage[id] = advanceOf(notesOf(TWIN[id]));
  stage["190"] = advanceOf(notesOf(190));
  for (const [id, s] of Object.entries(stage)) if (!s) throw new Error(`farms: report ${id}'s Handbook footnote names no advance-estimate year; the latest year's stage is unknown`);

  // unit footnotes the crop units rest on
  const n166 = notesOf(166);
  for (const re of [/coffee and tea data measured in lacs kg/i, /cotton data measured in lacs bales of 170 kg/i, /jute and the mesta data measured in lacs bales of 180 kg/i]) {
    if (!re.test(n166)) throw new Error(`farms: report 166's footnotes no longer say ${re}: re-read the commercial-crop units before baking`);
  }

  const cross = [];
  const bundles = {};

  /* ---- output, area, yield (national) ---- */
  const crop = { production: new Map(), area: new Map(), yield: new Map() };   // key -> Map(date -> value)
  const put = (measure, k, d, v) => { if (v == null) return; if (!crop[measure].has(k)) crop[measure].set(k, new Map()); crop[measure].get(k).set(d, v); };
  const actuals = (rows, unitCol) => rows.filter((r) => r[unitCol] === "ACTUALS");
  // 623 foodgrain output (tonnes), 624 commercial output (tonnes, bales, kg)
  for (const r of actuals(R["623"].rows, "Unit Description")) { const k = cropKey(r.Crops); const v = parseNumber(r.crop_agri_value); put("production", k, fyDate(r.Year), v == null ? null : v / OUTPUT_UNIT(k).div); }
  for (const r of actuals(R["624"].rows, "Unit Description fact_agri_production")) { const k = cropKey(r.Crops); const v = parseNumber(r.crop_agri_value); put("production", k, fyDate(r.Year), v == null ? null : v / OUTPUT_UNIT(k).div); }
  // 625 foodgrain area (hectares) -> thousand ha
  for (const r of actuals(R["625"].rows, "Unit Desc for unit change")) { const k = cropKey(r.Crops); const v = parseNumber(r.Value); put("area", k, fyDate(r.Year), v == null ? null : v / 1e3); }
  // 886, 887 yield (kg per hectare)
  for (const r of actuals(R["886"].rows, "Unit Description")) put("yield", cropKey(r.Crops), fyDate(r.Year), parseNumber(r["Value  (HBS Table No. 22)"]));
  for (const r of R["887"].rows) put("yield", cropKey(r.Crops), fyDate(r.Year), parseNumber(r["Value  (HBS Table No. 22)"]));
  // commercial-crop area: the SDMX dataset AREA_UNDER_CULT_RN (hectares, full precision), which
  // is report 190's figures before RBI rounds them to whole lakh hectares for print; the
  // foodgrain rows repeat report 625 and are checked against it, the commercial rows against
  // report 190's printed grid
  const SDMX_CROP = { CC: "coarse_cereals", CERLS: "cereals", CFF: "coffee", COTTON: "cotton", FDGRNS: "foodgrains", GRDNT: "groundnut", MJR_COM_CRPS: "major_commercial",
    OILSDS: "oilseeds", OTH: "other_oilseeds", PUL: "pulses", RI: "rice", RJNM: "jute_mesta", RNM: "rapeseed_mustard", SGRCN: "sugarcane", SOY: "soyabean", TEA: "tea", TOBB: "tobacco", WH: "wheat" };
  const FOODGRAIN_KEYS = new Set(["coarse_cereals", "cereals", "foodgrains", "pulses", "rice", "wheat"]);
  {
    const rows = parseCsv(SD.area_under_cult_rn.csv, ",");
    const h = rows[0], col = (n) => h.indexOf(n);
    const pairs625 = [];
    let n = 0;
    for (const r of rows.slice(1).filter((r) => r.length > 3)) {
      const k = SDMX_CROP[r[col("cls_of_crps")]];
      if (!k) throw new Error(`farms: AREA_UNDER_CULT_RN crop code "${r[col("cls_of_crps")]}" is new`);
      if (r[col("unit_measure")] !== "HA" || r[col("unit_mult")] !== "0") throw new Error(`farms: AREA_UNDER_CULT_RN unit ${r[col("unit_measure")]} x10^${r[col("unit_mult")]}`);
      const v = parseNumber(r[col("obs_value")]);
      if (v == null) continue;
      const d = `${r[col("repyearstart")]}-04-01`;
      if (FOODGRAIN_KEYS.has(k)) { pairs625.push({ label: `${k} ${d}`, db: crop.area.get(k)?.get(d) ?? null, hub: String(round(v / 1e3, 3)) }); continue; }
      put("area", k, d, round(v / 1e3, 3)); n++;
    }
    if (n < 500) throw new Error(`farms: no data returned: AREA_UNDER_CULT_RN gave ${n} commercial-crop areas`);
    cross.push(compare("RBI Hub SDMX AREA_UNDER_CULT_RN vs Data Bank 625 (foodgrain area)", pairs625, 0.001));
    // report 190 (lakh hectares, whole numbers) against the SDMX areas
    const g = gridOf(190)[0];
    if (!/lakhs? hectares/i.test(g.unit || "")) throw new Error(`farms: report 190's unit line is "${g.unit}", not lakh hectares`);
    const pairs = [];
    for (const row of g.rows) g.cols.forEach((c, j) => {
      if (j === g.yearCol || !c.child) return;
      const k = cropKey(c.child);
      const v = crop.area.get(k)?.get(fyDate(row.year));
      pairs.push({ label: `${k} ${row.year}`, db: v == null ? null : v / 100, hub: row.cells[j] });
    });
    cross.push(compare("RBI Hub SDMX AREA_UNDER_CULT_RN vs Handbook 190 (commercial-crop area, whole lakh ha)", pairs));
  }
  // anchors: rice output and wheat yield must exist and be plausible
  {
    const rice = crop.production.get("rice"), wy = crop.yield.get("wheat");
    const last = [...(rice?.keys() ?? [])].sort().at(-1);
    if (!last || !(rice.get(last) > 80000 && rice.get(last) < 250000)) throw new Error(`farms: no data returned: rice output ${rice?.get(last)} thousand tonnes in ${last}`);
    if (!(wy?.get(last) > 2000 && wy.get(last) < 6000)) throw new Error(`farms: wheat yield ${wy?.get(last)} kg/ha in ${last} is implausible`);
  }

  // cross-checks against the Handbook grids, at the printed precision
  const cropCols = (id) => { const g = gridOf(id)[0]; return { g, cols: g.cols.map((c, j) => ({ j, k: j === g.yearCol || !c.child ? null : CROP_BY_NAME[norm(c.child)] ?? null })).filter((c) => c.k) }; };
  for (const [id, measure, scale] of [["189", "production", 1e5 / 1e3], ["166", "production", null], ["167", "area", 1e5 / 1e3], ["191", "yield", 1], ["192", "yield", 1]]) {
    const { g, cols } = cropCols(+id);
    const pairs = [];
    for (const row of g.rows) for (const c of cols) {
      const v = crop[measure].get(c.k)?.get(fyDate(row.year));
      // printed in lakh units: thousand tonnes / 100; tea and coffee lakh kg = thousand tonnes * 10
      const s = scale ?? (c.k === "tea" || c.k === "coffee" ? 1 / 10 : 100);
      pairs.push({ label: `${c.k} ${row.year}`, db: v == null ? null : v / s, hub: row.cells[c.j] });
    }
    cross.push(compare(`Data Bank ${Object.keys(TWIN).find((k) => TWIN[k] === +id)} vs Handbook ${id} (${measure})`, pairs));
  }

  const lastFinal = (id) => { const s = stage[id]; return fyDate(s.year); };
  // every crop table's advance year must be the latest year it holds
  const latestOf = (rows, col) => rows.map((r) => r[col]).filter((y) => /^\d{4}-\d{2}/.test(y)).sort().at(-1);
  for (const [id, col] of [["623", "Year"], ["624", "Year"], ["625", "Year"], ["886", "Year"], ["887", "Year"], ["459", "Year"], ["460", "Year"], ["465", "Year"]]) {
    const latest = latestOf(R[id].rows, col);
    if (latest !== stage[id].year) throw new Error(`farms: report ${id} runs to ${latest} but its footnote names ${stage[id].year} as the advance-estimate year; the stage of ${latest} is unknown`);
  }
  if (gridOf(190)[0].rows.map((r) => r.year).sort().at(-1) !== stage["190"].year) throw new Error("farms: report 190 runs past its footnote's advance year");
  const AE_YEAR = stage["623"].year, AE_STAGE = stage["623"].stage;
  for (const id of ["624", "625", "886", "887", "190"]) if (stage[id].year !== AE_YEAR || stage[id].stage !== AE_STAGE) throw new Error(`farms: report ${id} names ${stage[id].stage} for ${stage[id].year}, the foodgrain tables ${AE_STAGE} for ${AE_YEAR}`);
  const AE_DATE = fyDate(AE_YEAR);
  for (const [measure, maps] of Object.entries(crop)) for (const [k, m] of maps) {
    const last = [...m.keys()].sort().at(-1);
    if (last > AE_DATE) throw new Error(`farms: ${measure} of ${k} runs to ${last}, past the advance-estimate year ${AE_YEAR}; its stage is unknown`);
  }

  const MEASURE = {
    production: { name: "Production", unitOf: (k) => OUTPUT_UNIT(k) },
    area: { name: "Area", unitOf: () => ({ unit: "thousand_hectares", note: "thousand hectares" }) },
    yield: { name: "Yield", unitOf: () => ({ unit: "kg_per_hectare", note: "kg per hectare" }) },
  };
  const finalBundle = (measure, coverage, note) => {
    const maps = [...crop[measure].values()].map((m) => new Map([...m].filter(([d]) => d !== AE_DATE)));
    const axis = axisOf(maps);
    const series = {};
    let i = 0;
    for (const k of CROP_ORDER) {
      const m = crop[measure].get(k);
      if (!m) continue;
      const u = MEASURE[measure].unitOf(k);
      series[k] = mkSeries(axis, new Map([...m].filter(([d]) => d !== AE_DATE)), {
        name: `${measure}_${k}`, label: `${CROPS[k].label}`, unit: u.unit, unitNote: u.note, group: CROPS[k].group, crop: k,
        color: k === "foodgrains" ? ACC : GREYS[i++ % GREYS.length],
      });
    }
    return {
      meta: {
        dossier: "farms", frequency: "annual", base: "ministry final estimates", unit: "per series", source: dcfg.source_agency, vintage: null,
        mock: false, geo: dcfg.geo ?? "IND", latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy",
        coverage, stage: "final estimates (every year the Handbook does not flag as an advance estimate)",
        note: `${note} Crop years (July to June), dated at April of their first year. ${AE_YEAR}, the ${AE_STAGE.toLowerCase()}, is a different ruler and lives in farms-advance; it is never joined to these years.`,
      },
      dates: axis, series,
    };
  };
  bundles["farms-production"] = finalBundle("production", "All India, 16 crops and crop groups, production, 1950-51 on",
    "Production of foodgrains (DBIE report 623) and major commercial crops (report 624), as the agriculture ministry estimates it. Units as RBI prints them: thousand tonnes; cotton in thousand bales of 170 kg and raw jute and mesta in thousand bales of 180 kg; tea and coffee in million kg (= thousand tonnes). Oilseeds are nine of the eleven oilseeds; 1969-70 oilseeds are five major oilseeds only (RBI's note).");
  bundles["farms-area"] = finalBundle("area", "All India, 16 crops and crop groups, area under cultivation, 1950-51 on",
    "Area under foodgrains (DBIE report 625, hectares) and under major commercial crops (DBIE's SDMX dataset AREA_UNDER_CULT_RN, hectares, read from the RBI Innovation Hub service because the Data Bank's copy of report 190 failed; report 190 prints the same areas rounded to whole lakh hectares and is checked against them). Thousand hectares. \"All major commercial crops\" is RBI's own total of the commercial crops' area (oilseeds, cotton, jute and mesta, sugarcane, tea, coffee, tobacco); \"other oilseeds\" is the seven of the nine oilseeds besides groundnut and rapeseed-mustard. Tea and coffee areas are provisional (RBI's note).");
  bundles["farms-yield"] = finalBundle("yield", "All India, 16 crops and crop groups, yield per hectare, 1950-51 on",
    "Yield per hectare (DBIE reports 886 and 887), kg per hectare, as RBI prints it (production over area, computed by the ministry). Cotton yield is kg of lint per hectare.");

  /* ---- index numbers: three bases ---- */
  const IDX_BASE = { "Triennium Ending 1981-82=100": "1982", "Triennium Ending 1993-94=100": "1994", "Triennium Ending 2007-08=100": "2008" };
  const IDX_LABEL = { 1982: "TE 1981-82=100", 1994: "TE 1993-94=100", 2008: "TE 2007-08=100" };
  const idx = { 1982: new Map(), 1994: new Map(), 2008: new Map() };   // key -> { props, map }
  const idxPut = (b, key, props, d, v) => { if (!idx[b].has(key)) idx[b].set(key, { props, map: new Map() }); if (v != null) idx[b].get(key).map.set(d, v); };
  const IDX_CROP = (name) => {
    const n = norm(name);
    const extra = { allcrops: "all_crops", nonfoodgrains: "non_foodgrains", sesamum: "sesamum", coconut: "coconut", fibres: "fibres", jute: "jute",
      rubber: "rubber", fruitsandvegetables: "fruits_vegetables", guarseed: "guarseed", condimentsandspices: "condiments_spices", plantationcrops: "plantation_crops" };
    return extra[n] ?? cropKey(name);
  };
  const IDX_NAME = { all_crops: "All crops", non_foodgrains: "Non-foodgrains", sesamum: "Sesamum", coconut: "Coconut", fibres: "Fibres", jute: "Jute", rubber: "Rubber",
    fruits_vegetables: "Fruits and vegetables", guarseed: "Guarseed", condiments_spices: "Condiments and spices", plantation_crops: "Plantation crops" };
  const idxLabel = (k) => IDX_NAME[k] ?? CROPS[k]?.label ?? k;
  for (const r of R["459"].rows) {
    const b = IDX_BASE[r.Base]; if (!b) throw new Error(`farms: report 459 base "${r.Base}" is new`);
    const k = IDX_CROP(r.Crops);
    idxPut(b, `production_${k}`, { label: `${idxLabel(k)}, production`, measure: "production", crop: k, weight: parseNumber(r["Crop Weight"]) }, fyDate(r.Year), parseNumber(r.Value));
  }
  const APY = { "Index on area under agricltural production": "area", "Index on Agricultural Productions": "production", "Index on Yields per hectare on Agricultural productions": "yield" };
  const dup460 = { same: 0, differ: [] };
  for (const r of R["460"].rows) {
    const b = IDX_BASE[r.Base]; const m = APY[r.Indices];
    if (!b || !m) throw new Error(`farms: report 460 row "${r.Base}" / "${r.Indices}" is new`);
    const k = IDX_CROP(r.Crops), d = fyDate(r.Year), v = parseNumber(r.Value);
    if (m === "production" && idx[b].has(`production_${k}`) && idx[b].get(`production_${k}`).map.has(d)) {
      const prev = idx[b].get(`production_${k}`).map.get(d);
      if (v != null && Math.abs(prev - v) > 1e-9) dup460.differ.push(`${k} ${r.Year} TE${b}: 459 ${prev}, 460 ${v}`); else dup460.same++;
      continue;
    }
    idxPut(b, `${m}_${k}`, { label: `${idxLabel(k)}, ${m}`, measure: m, crop: k, weight: parseNumber(r.Weight) }, d, v);
  }
  // check the index cells against the Handbook grids (report 165: production by crop; 164: A/P/Y)
  {
    const pairs = [];
    for (const t of gridOf(165)) {
      const m = /Triennium Ending (\d{4})-(\d{2})\s*=\s*100/i.exec(t.unit || "");
      if (!m) continue;
      const b = { "1981": "1982", "1993": "1994", "2007": "2008" }[m[1]];
      for (const row of t.rows) t.cols.forEach((c, j) => {
        if (j === t.yearCol || !c.child) return;
        let k; try { k = IDX_CROP(c.child); } catch { return; }
        const v = idx[b].get(`production_${k}`)?.map.get(fyDate(row.year));
        pairs.push({ label: `TE${b} ${k} ${row.year}`, db: v ?? null, hub: row.cells[j] });
      });
    }
    for (const t of gridOf(164)) {
      const m = /Triennium Ending (\d{4})-(\d{2})\s*=\s*100/i.exec(t.unit || "");
      if (!m) continue;
      const b = { "1981": "1982", "1993": "1994", "2007": "2008" }[m[1]];
      const MM = { a: "area", pr: "production", y: "yield" };
      for (const row of t.rows) t.cols.forEach((c, j) => {
        if (j === t.yearCol || !MM[norm(c.child)]) return;
        const k = IDX_CROP(c.parent);
        const v = idx[b].get(`${MM[norm(c.child)]}_${k}`)?.map.get(fyDate(row.year));
        pairs.push({ label: `TE${b} ${MM[norm(c.child)]} ${k} ${row.year}`, db: v ?? null, hub: row.cells[j] });
      });
    }
    cross.push(compare("Data Bank 459/460 vs Handbook 165/164 (index numbers)", pairs));
  }
  if (dup460.differ.length) throw new Error(`farms: reports 459 and 460 disagree on the production index: ${dup460.differ.slice(0, 5).join("; ")}`);
  for (const b of ["1982", "1994", "2008"]) {
    const keys = [...idx[b].keys()].sort((p, q) => {
      const o = (s) => ["production", "area", "yield"].indexOf(idx[b].get(s).props.measure) * 100 + (idx[b].get(s).props.crop === "all_crops" ? 0 : 1);
      return o(p) - o(q) || (p < q ? -1 : 1);
    });
    const maps = keys.map((k) => new Map([...idx[b].get(k).map].filter(([d]) => !(b === "2008" && d === AE_DATE))));
    const axis = axisOf(maps.filter((m) => m.size));
    const series = {};
    let i = 0;
    keys.forEach((k, j) => {
      if (!maps[j].size) return;
      const p = idx[b].get(k).props;
      series[k] = mkSeries(axis, maps[j], { name: `index_${k}`, label: p.label, unit: "index", group: p.measure[0].toUpperCase() + p.measure.slice(1), crop: p.crop, weight: p.weight,
        color: k === "production_all_crops" ? ACC : GREYS[i++ % GREYS.length] });
    });
    bundles[`farms-index-${b}`] = {
      meta: {
        dossier: "farms", frequency: "annual", base: IDX_LABEL[b], unit: "index", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy",
        coverage: `Index numbers of area, production and yield, base triennium ending ${{ 1982: "1981-82", 1994: "1993-94", 2008: "2007-08" }[b]} = 100`,
        note: `Index numbers of agricultural production by crop (DBIE report 459) and of area, production and yield of foodgrains, non-foodgrains and all crops (report 460), on the base ${IDX_LABEL[b]}. Each crop's weight in the all-crops index is on its series. One base, one ruler: the three bases are never linked here (the ministry publishes no linking factor in these tables).${b === "2008" ? ` ${AE_YEAR} (${AE_STAGE.toLowerCase()}) is in farms-advance.` : ""}`,
      },
      dates: axis, series,
    };
  }

  /* ---- the advance estimate: one year, every crop table ---- */
  {
    const series = {};
    let i = 0;
    for (const measure of ["production", "area", "yield"]) for (const k of CROP_ORDER) {
      const v = crop[measure].get(k)?.get(AE_DATE);
      if (v == null) continue;
      const u = MEASURE[measure].unitOf(k);
      series[`${measure}_${k}`] = { name: `${measure}_${k}`, label: `${CROPS[k].label}, ${measure}`, unit: u.unit, unitNote: u.note, group: MEASURE[measure].name, crop: k, measure,
        color: measure === "production" && k === "foodgrains" ? ACC : GREYS[i++ % GREYS.length], data: [v] };
    }
    for (const [key, { props, map }] of idx["2008"]) {
      const v = map.get(AE_DATE);
      if (v == null) continue;
      series[`index_${key}`] = { name: `index_${key}`, label: `Index (${IDX_LABEL["2008"]}): ${props.label}`, unit: "index", group: "Index numbers", crop: props.crop, measure: props.measure, weight: props.weight, color: GREYS[i++ % GREYS.length], data: [v] };
    }
    if (!series.production_foodgrains) throw new Error(`farms: no foodgrain output for the advance year ${AE_YEAR}`);
    bundles["farms-advance"] = {
      meta: {
        dossier: "farms", frequency: "annual", base: "ministry advance estimates", unit: "per series", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: AE_YEAR, releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy", stage: AE_STAGE,
        coverage: `${AE_YEAR}, ${AE_STAGE.toLowerCase()}: production, area, yield and index numbers`,
        note: `${AE_YEAR} as the agriculture ministry's ${AE_STAGE.toLowerCase()} give it (the Handbook's footnote to reports 164 to 192; horticulture in the index is on the second advance estimates). Advance estimates are revised, sometimes by several million tonnes, until the final estimates a year or so later: a different ruler from the final years in farms-production, farms-area, farms-yield and farms-index-2008, never joined to them.`,
      },
      dates: [AE_DATE], series,
    };
  }

  /* ---- minimum support prices ---- */
  {
    const MSP = {
      paddycommon: ["paddy_common", "Paddy (common)", "Kharif"], coarsecereals: ["maize", "Maize", "Kharif"], wheat: ["wheat", "Wheat", "Rabi"],
      gram: ["gram", "Gram", "Rabi"], arhartur: ["arhar", "Arhar (tur)", "Kharif"], moong: ["moong", "Moong", "Kharif"], urad: ["urad", "Urad", "Kharif"],
      cotton: ["cotton", "Cotton", "Kharif"], groundnutinshell: ["groundnut", "Groundnut (in shell)", "Kharif"], rapeseedmustard: ["rapeseed_mustard", "Rapeseed and mustard", "Rabi"],
      safflower: ["safflower", "Safflower", "Rabi"], soyabeanblack: ["soyabean_black", "Soyabean (black)", "Kharif"], soyabeanyellow: ["soyabean_yellow", "Soyabean (yellow)", "Kharif"],
      sugarcane: ["sugarcane", "Sugarcane", "Annual"], sunflowerseed: ["sunflower", "Sunflower seed", "Kharif"], jute: ["jute", "Jute", "Kharif"],
    };
    const m = new Map();
    for (const r of R["461"].rows) {
      const def = MSP[norm(r["Grain Description"])];
      if (!def) throw new Error(`farms: MSP crop "${r["Grain Description"]}" is new`);
      if (r["Pub Unit Desc"] !== "QUINTAL") throw new Error(`farms: MSP unit "${r["Pub Unit Desc"]}"`);
      if (!m.has(def[0])) m.set(def[0], new Map());
      const v = parseNumber(r["Grain Value"]);
      if (v != null) m.get(def[0]).set(fyDate(r["Time Fis Year"]), v);
    }
    // 462 is 461's non-foodgrain rows: check, then rely on 461
    let same = 0; const differ = [];
    for (const r of R["462"].rows) {
      const def = MSP[norm(r["Grain Description"])]; const v = parseNumber(r["Grain Value"]);
      const w = m.get(def[0])?.get(fyDate(r["Time Fis Year"])) ?? null;
      if (v === w) same++; else differ.push(`${def[0]} ${r["Time Fis Year"]}: 462 ${v}, 461 ${w}`);
    }
    if (differ.length) throw new Error(`farms: MSP reports 461 and 462 differ: ${differ.slice(0, 5).join("; ")}`);
    cross.push({ name: "Data Bank 462 vs 461 (MSP, non-foodgrains)", compared: same, match: same, mismatchCount: 0, mismatches: [] });
    const pairs = [];
    for (const id of [194, 195]) for (const t of gridOf(id)) for (const row of t.rows) t.cols.forEach((c, j) => {
      if (j === t.yearCol || !c.child) return;
      const n = norm(c.child) === "maize" ? "coarsecereals" : norm(c.child);
      const def = MSP[n] ?? Object.entries(MSP).find(([kk]) => kk.startsWith(n) || n.startsWith(kk))?.[1];
      if (!def) return;
      pairs.push({ label: `${def[0]} ${row.year}`, db: m.get(def[0])?.get(fyDate(row.year)) ?? null, hub: row.cells[j] });
    });
    cross.push(compare("Data Bank 461 vs Handbook 194/195 (MSP)", pairs));
    const paddy = m.get("paddy_common");
    if (!paddy?.size || !([...paddy.values()].at(-1) > 1000)) throw new Error("farms: no data returned: no paddy MSP");
    const axis = axisOf([...m.values()]);
    const series = {};
    let i = 0;
    for (const def of Object.values(MSP)) {
      if (!m.get(def[0])?.size) continue;
      series[def[0]] = mkSeries(axis, m.get(def[0]), { name: `msp_${def[0]}_inr_per_quintal`, label: def[1], unit: "inr_per_quintal", group: def[2], crop: def[0],
        color: def[0] === "paddy_common" ? ACC : def[0] === "wheat" ? GOLD : GREYS[i++ % GREYS.length] },
      "RBI's table prints no price for this crop in these years (a dash): no MSP was announced, or the variety was not priced.");
    }
    const n194 = notesOf(194), n195 = notesOf(195);
    bundles["farms-msp"] = {
      meta: {
        dossier: "farms", frequency: "annual", base: "as published", unit: "inr_per_quintal", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy",
        coverage: "Minimum support price, 16 crops, fair average quality, rupees per quintal, crop years from 1975-76",
        note: `Minimum support prices announced by the government on the recommendation of the Commission for Agricultural Costs and Prices, by crop year (DBIE reports 461 and 462; the Handbook's tables 194 and 195). A crop year's MSP is announced before sowing: kharif crops in about June of the crop year's first year, rabi crops (wheat, gram, mustard, safflower) in about October, for the harvest marketed the following spring, so "wheat 2025-26" is the price for wheat sown in 2025 and sold from April 2026. "Coarse cereals" in DBIE is the maize price (the Handbook heads it Maize). Cotton is medium staple to 2005-06 and long staple from 2006-07 (H-4). Sugarcane is the statutory minimum price, later the fair and remunerative price, per quintal of cane. RBI's notes, verbatim: ${(n194 + " " + n195).replace(/\s+/g, " ").replace(/Also see Notes on Tables\.?/gi, "").replace(/Source\s*:.*$/i, "").trim()}`,
      },
      dates: axis, series,
    };
  }

  /* ---- land use and inputs ---- */
  {
    const LU = {
      NET_SOWN_AREA: ["net_sown_area", "Net sown area", "thousand_hectares", 100],
      GROSS_SOWN_AREA: ["gross_sown_area", "Gross sown area (counting each season's crop)", "thousand_hectares", 100],
      NET_IRRIGATED_AREA: ["net_irrigated_area", "Net irrigated area", "thousand_hectares", 100],
      GROSS_IRRIGATED_AREA: ["gross_irrigated_area", "Gross irrigated area", "thousand_hectares", 100],
      AREA_UNDER_HIGH_YIELD_VARIETIES: ["hyv_area", "Area under high-yielding varieties", "thousand_hectares", 100],
      CONSUMPTION_OF_FERTILIZER: ["fertiliser_npk", "Fertiliser used (N+P+K)", "lakh_tonnes", 1],
      CONSUMPTION_OF_PESTICIDES: ["pesticides", "Pesticides used (technical grade)", "thousand_tonne", 1],
    };
    const m = new Map();
    for (const r of R["463"].rows.filter((r) => r["Unit Description"] === "ACTUALS")) {
      const def = LU[r["Agri Area Code"]];
      if (!def) throw new Error(`farms: land-use item "${r["Agri Area Code"]}" is new`);
      const v = parseNumber(r.Values);
      if (!m.has(def[0])) m.set(def[0], new Map());
      if (v != null) m.get(def[0]).set(fyDate(r.Year), round((v / 1e5) * def[3], 4));
    }
    const t = gridOf(278)[0];
    const pairs = [];
    const LUC = { netsownarea: "net_sown_area", grosssownarea: "gross_sown_area", netirrigatedarea: "net_irrigated_area", grossirrigatedarea: "gross_irrigated_area", areaunderhighyieldingvarieties: "hyv_area" };
    for (const row of t.rows) t.cols.forEach((c, j) => {
      if (j === t.yearCol) return;
      const n = norm(c.child);
      const k = LUC[n] ?? (n.startsWith("consumptionoffertilisers") ? "fertiliser_npk" : n.startsWith("consumptionofpesticides") ? "pesticides" : null);
      if (!k) return;
      const v = m.get(k)?.get(fyDate(row.year));
      pairs.push({ label: `${k} ${row.year}`, db: v == null ? null : (k.endsWith("area") ? v / 100 : v), hub: row.cells[j] });
    });
    cross.push(compare("Data Bank 463 vs Handbook 278 (land use and inputs)", pairs));
    const ns = m.get("net_sown_area");
    if (!ns?.size || !([...ns.values()].at(-1) > 120000)) throw new Error("farms: no data returned: net sown area");
    // derived, labelled: cropping intensity, irrigated share, fertiliser per hectare
    const derive = (a, b, f) => { const out = new Map(); for (const [d, x] of m.get(a) ?? []) { const y = m.get(b)?.get(d); if (x != null && y) out.set(d, f(x, y)); } return out; };
    const D = {
      cropping_intensity: [derive("gross_sown_area", "net_sown_area", (g, n) => round((g / n) * 100, 1)), "Cropping intensity: gross over net sown area, per cent (computed)", "pct"],
      irrigated_share: [derive("gross_irrigated_area", "gross_sown_area", (i, g) => round((i / g) * 100, 1)), "Share of gross sown area irrigated, per cent (computed)", "pct"],
      net_irrigated_share: [derive("net_irrigated_area", "net_sown_area", (i, n) => round((i / n) * 100, 1)), "Share of net sown area irrigated, per cent (computed)", "pct"],
      fertiliser_per_ha: [derive("fertiliser_npk", "gross_sown_area", (f, g) => round((f * 1e5 * 1000) / (g * 1000), 1)), "Fertiliser per hectare of gross sown area, kg (computed)", "kg_per_hectare"],
    };
    const maps = [...m.values()].filter((x) => x.size);
    const axis = axisOf(maps);
    const series = {};
    let i = 0;
    for (const def of Object.values(LU)) {
      if (!m.get(def[0])?.size) continue;
      series[def[0]] = mkSeries(axis, m.get(def[0]), { name: def[0], label: def[1], unit: def[2], group: def[2] === "thousand_hectares" ? "Land use" : "Inputs", color: def[0] === "net_sown_area" ? ACC : GREYS[i++ % GREYS.length] });
    }
    for (const [k, [map, label, unit]] of Object.entries(D)) series[k] = mkSeries(axis, map, { name: k, label, unit, group: "Computed", derived: true, color: GREYS[i++ % GREYS.length] });
    bundles["farms-landuse"] = {
      meta: {
        dossier: "farms", frequency: "annual", base: "as published", unit: "per series", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy",
        coverage: "All India land use, irrigation, fertiliser and pesticide use, 1950-51 on",
        note: "Pattern of land use and select inputs (DBIE report 463; Handbook table 278), read in the unit RBI prints: areas in lakh hectares (stored as thousand hectares), fertiliser in lakh tonnes of nutrients (N+P+K), pesticides in thousand tonnes of technical-grade material. Fertiliser years are February to January up to 1982-83 and April to March from 1983-84 (RBI's note). The area under high-yielding varieties is printed as not available in recent years. Cropping intensity, the irrigated shares and fertiliser per hectare are computed by India Atlas from the published levels.",
      },
      dates: axis, series,
    };
  }

  /* ---- procurement, off-take and stocks ---- */
  {
    const n169 = notesOf(169);
    const stockAt = /stock for (\d{4}-\d{2}) relates to position as on ([a-z]+ \d{1,2}, \d{4})/i.exec(n169);
    const offAt = /off-?take (\d{4}-\d{2}) relates to ([a-z]+)\s*-\s*([a-z]+) (\d{4})/i.exec(n169);
    const procAt = /procurement for (\d{4}-\d{2}) relates? to position as on ([a-z]+ \d{1,2}, \d{4})/i.exec(n169);
    const P = new Map();   // key -> Map(date -> lakh tonnes)
    const KEY = { Procurement: "procurement", "Off-take": "offtake", Stocks: "stocks" };
    const CR = { Rice: "rice", Wheat: "wheat", Total: "total" };
    let excludedEarly = 0;
    for (const r of R["464"].rows.filter((r) => r["Unit Desc for unit change"] === "ACTUALS")) {
      const k = `${KEY[r["Agri Description"]]}_${CR[r.Crops]}`;
      if (!KEY[r["Agri Description"]] || !CR[r.Crops]) throw new Error(`farms: PDS row "${r["Agri Description"]}" / "${r.Crops}" is new`);
      const raw = parseNumber(r["Value (HBS Table no 27)"]);
      const v = raw == null ? null : round(raw / 1e5, 4);
      // 1950-51 to 1970-71: "stocks" printed at hundreds of times any later year (see header)
      if (+r.Year.slice(0, 4) < 1972) { if (v != null) excludedEarly++; continue; }
      if (!P.has(k)) P.set(k, new Map());
      if (v != null) P.get(k).set(fyDate(r.Year), v);
    }
    if (excludedEarly < 20) throw new Error(`farms: expected the 1950-51 to 1970-71 stock rows that are set aside, found ${excludedEarly}: re-read report 464`);
    const latestYear = latestOf(R["464"].rows, "Year");
    const partial = stockAt && stockAt[1] === latestYear;
    if (!partial) throw new Error(`farms: report 169's footnote does not date the part year ${latestYear} (stocks), so the year cannot be told from a complete one`);
    const partDate = new Date(stockAt[2] + " UTC");
    const partIso = `${partDate.getUTCFullYear()}-${String(partDate.getUTCMonth() + 1).padStart(2, "0")}-${String(partDate.getUTCDate()).padStart(2, "0")}`;
    // "May 31, 2026" -> "31 May 2026"
    const dmy = (t) => { const d = new Date(t + " UTC"); return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()}`; };
    const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
    const t = gridOf(169)[0];
    const pairs = [];
    for (const row of t.rows) t.cols.forEach((c, j) => {
      if (j === t.yearCol || !KEY[c.parent] && !KEY[c.parent.replace(/\s+/g, "")]) return;
      const k = `${KEY[c.parent]}_${CR[c.child]}`;
      const v = P.get(k)?.get(fyDate(row.year));
      pairs.push({ label: `${k} ${row.year}`, db: v ?? null, hub: row.cells[j] });
    });
    cross.push(compare("Data Bank 464 vs Handbook 169 (procurement, off-take, stocks)", pairs));
    const partD = fyDate(latestYear);
    const full = new Map([...P].map(([k, mm]) => [k, new Map([...mm].filter(([d]) => d !== partD))]));
    const axis = axisOf([...full.values()].filter((x) => x.size));
    const LAB = { procurement: "Procured", offtake: "Off-take (issued)", stocks: "Stocks at year end" };
    const series = {};
    let i = 0;
    for (const what of ["procurement", "offtake", "stocks"]) for (const c of ["total", "rice", "wheat"]) {
      const k = `${what}_${c}`;
      if (!full.get(k)?.size) continue;
      series[k] = mkSeries(axis, full.get(k), { name: `${k}_lakh_tonnes`, label: `${LAB[what]}, ${c === "total" ? "total" : c}${what === "stocks" && c === "total" ? " (with coarse grains)" : ""}`, unit: "lakh_tonnes", group: LAB[what], crop: c,
        color: k === "stocks_total" ? ACC : GREYS[i++ % GREYS.length] });
    }
    const st = series.stocks_total?.data.filter((v) => v != null).at(-1);
    if (!(st > 100 && st < 2000)) throw new Error(`farms: total stocks ${st} lakh tonnes are implausible`);
    bundles["farms-pds"] = {
      meta: {
        dossier: "farms", frequency: "annual", base: "as published", unit: "lakh_tonnes", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy",
        coverage: "Central procurement, off-take and stocks of rice and wheat, lakh tonnes, 1972-73 on",
        note: "Public distribution system: foodgrains procured by the Food Corporation of India and state agencies, issued from the central pool (off-take), and held in it (stocks, at the end of the year: the central pool on 1 April), DBIE report 464 and the Handbook's table 169, lakh tonnes. Total stocks include coarse grains, so they can exceed rice plus wheat. Off-take in 2020-21 to 2022-23 includes the free grain under PMGKAY, ANBP (migrants) and non-NFSA Covid allocations (RBI's note). RBI's table also prints stock figures for 1950-51 to 1970-71, at 6,680 lakh tonnes of rice in 1950-51 and similar: hundreds of times every later year and more than India's whole harvest, so their unit cannot be read and they are left out. 1971-72 is not printed. The part year after the last full year is in farms-pds-latest.",
      },
      dates: axis, series,
    };
    // the part year: stocks on the footnote's date, procurement and off-take to that date
    const pseries = {};
    for (const what of ["stocks", "procurement", "offtake"]) for (const c of ["total", "rice", "wheat"]) {
      const v = P.get(`${what}_${c}`)?.get(partD);
      if (v == null) continue;
      const span = what === "stocks" ? `on ${dmy(stockAt[2])}` : what === "offtake" && offAt ? `${cap(offAt[2])} to ${cap(offAt[3])} ${offAt[4]}` : procAt ? `to ${dmy(procAt[2])}` : `${latestYear} so far`;
      const lab = LAB[what].replace(" at year end", "");
      pseries[`${what}_${c}`] = { name: `${what}_${c}_lakh_tonnes`, label: `${lab}, ${c}, ${span}`, unit: "lakh_tonnes", group: lab, crop: c, color: what === "stocks" && c === "total" ? ACC : GREYS[0], data: [v] };
    }
    bundles["farms-pds-latest"] = {
      meta: {
        dossier: "farms", frequency: "irregular", base: "as published", unit: "lakh_tonnes", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: partIso, releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "date",
        coverage: `${latestYear} so far: stocks on ${dmy(stockAt[2])}, procurement and off-take to date`,
        note: `The part year ${latestYear} as report 464 prints it: stocks are the position on ${dmy(stockAt[2])}${offAt ? `, off-take is ${cap(offAt[2])} to ${cap(offAt[3])} ${offAt[4]}` : ""}${procAt ? `, procurement the position on ${dmy(procAt[2])}` : ""} (RBI's notes). Not comparable with a full year's procurement or off-take, or with a 1 April stock: a stock just after the wheat harvest is near its peak for the year.`,
      },
      dates: [partIso], series: pseries,
    };
  }

  /* ---- state-wise output (465) ---- */
  {
    const V = "Agricutural Production( '000 ton)";
    const cell = new Map();   // seriesKey -> { props, map }
    const AE465 = fyDate(stage["465"].year);
    const SPLIT = {
      "madhya-pradesh": { before: 2000, old: "Madhya Pradesh (undivided, to 1999-2000)" },
      bihar: { before: 2000, old: "Bihar (undivided, to 1999-2000)" },
      "uttar-pradesh": { before: 2000, old: "Uttar Pradesh (undivided, to 1999-2000)" },
      "andhra-pradesh": { before: 2015, old: "Andhra Pradesh (undivided, to 2014-15)" },
    };
    const stateName = (s) => s.toLowerCase().replace(/(^|\s|&\s)([a-z])/g, (m) => m.toUpperCase()).replace(/\bAnd\b/g, "and");
    for (const r of R["465"].rows.filter((x) => x["Unit Description"] === "ACTUALS")) {
      const v = parseNumber(r[V]);
      if (v == null) continue;
      const k = cropKey(r.Crop);
      const y = +r.Year.slice(0, 4);
      let geo, geoLabel;
      if (r.State === "ALL INDIA") { geo = "all_india"; geoLabel = "All India"; }
      else if (r.State === "ALL STATES") { geo = "all_states"; geoLabel = "All states"; }
      else if (r.State === "UNION TERRITORIES") { geo = "union_territories"; geoLabel = "Union territories"; }
      else {
        const p = placeStrict(r.State, "DBIE report 465");
        if (p.startsWith("former:") || p.startsWith("aggregate:")) throw new Error(`farms: report 465 state "${r.State}" is not a present state`);
        geo = p.replace(/-/g, "_"); geoLabel = stateName(r.State).replace("Jammu & Kashmir", "Jammu and Kashmir");
        if (SPLIT[p] && y < SPLIT[p].before) { geo = `${geo}_undivided`; geoLabel = SPLIT[p].old; }
        // Jammu and Kashmir: DBIE keys the state with Ladakh (to 2018-19) and the UT apart
        if (p === "jammu-kashmir") { if (r["State Sk"] === "83") { geo = "jammu_kashmir_state"; geoLabel = "Jammu and Kashmir (state, with Ladakh, to 2018-19)"; } else { geo = "jammu_kashmir"; geoLabel = "Jammu and Kashmir (UT, from 2019-20)"; } }
      }
      const key = `${geo}__${k}`;
      if (!cell.has(key)) cell.set(key, { props: { geo, geoLabel, crop: k }, map: new Map() });
      const d = fyDate(r.Year), val = v / OUTPUT_UNIT(k).div;
      const prev = cell.get(key).map.get(d);
      if (prev != null && Math.abs(prev - val) > 1e-6) throw new Error(`farms: report 465 repeats ${key} ${r.Year} with different values`);
      cell.get(key).map.set(d, val);
    }
    // cross-check against the printed grid (thousand tonnes; bales in thousands)
    {
      const t = gridOf(465)[0];
      const pairs = [];
      for (const row of t.rows) {
        const lead = row.lead.replace(/^\d+\.\s*/, "").trim();
        let geo;
        if (/^all india/i.test(lead)) geo = "all_india"; else if (/^all states/i.test(lead)) geo = "all_states"; else if (/union territor/i.test(lead)) geo = "union_territories";
        else { try { const p = placeStrict(lead, "report 465 grid"); geo = p.replace(/^former:/, "").replace(/-/g, "_"); } catch { continue; } }
        const y = +row.year.slice(0, 4);
        t.cols.forEach((c, j) => {
          if (j <= t.yearCol || !c.child) return;
          const k = CROP_BY_NAME[norm(c.child)]; if (!k) return;
          let g = geo;
          const p = geo.replace(/_/g, "-");
          if (SPLIT[p] && y < SPLIT[p].before) g = `${geo}_undivided`;
          if (geo === "jammu_kashmir" || geo === "jammu_kashmir_state") g = y <= 2018 ? "jammu_kashmir_state" : "jammu_kashmir";
          const v = cell.get(`${g}__${k}`)?.map.get(fyDate(row.year));
          pairs.push({ label: `${g} ${k} ${row.year}`, db: v ?? null, hub: row.cells[j] });
        });
      }
      cross.push(compare("Data Bank 465 vs Handbook 465 grid (state output)", pairs));
    }
    const STATE_ORDER = (a, b) => (a.geo === "all_india" ? -1 : b.geo === "all_india" ? 1 : a.geoLabel < b.geoLabel ? -1 : 1);
    const mk = (pred, slug, base, coverage, note) => {
      const ents = [...cell.entries()].map(([key, v]) => [key, v.props, new Map([...v.map].filter(([d]) => pred(d)))]).filter(([, , m]) => m.size);
      const axis = axisOf(ents.map(([, , m]) => m));
      const series = {};
      let i = 0;
      for (const [key, p, m] of ents.sort(([, a], [, b]) => STATE_ORDER(a, b) || CROP_ORDER.indexOf(a.crop) - CROP_ORDER.indexOf(b.crop))) {
        const u = OUTPUT_UNIT(p.crop);
        series[key] = mkSeries(axis, m, { name: `production_${key}`, label: `${p.geoLabel}: ${CROPS[p.crop].label}`, unit: u.unit, unitNote: u.note, group: CROPS[p.crop].label, crop: p.crop, state: p.geoLabel,
          color: key === "all_india__foodgrains" ? ACC : GREYS[i++ % GREYS.length] },
        "RBI's table prints no figure for this state and crop in these years (a dash, or a year the state's estimate is missing from the table).");
      }
      bundles[slug] = {
        meta: {
          dossier: "farms", frequency: "annual", base, unit: "per series", source: dcfg.source_agency, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
          latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy", coverage, note,
        },
        dates: axis, series,
      };
    };
    const common = "State-wise production of foodgrains and major non-foodgrain crops (DBIE report 465; RBI Handbook table 16D), thousand tonnes; cotton in thousand bales of 170 kg, raw jute and mesta in thousand bales of 180 kg. All India includes the union territories. Boundary changes are separate series, never joined: Madhya Pradesh, Bihar and Uttar Pradesh are the undivided states to 1999-2000 (Chhattisgarh, Jharkhand and Uttarakhand from 2000-01); Andhra Pradesh is the undivided state to 2014-15 (Telangana from 2015-16, as the table prints it); Jammu and Kashmir is the state with Ladakh to 2018-19 and the union territory from 2019-20 (RBI's note 8 says 2019-20 still covers the undivided state; the table keys it with the union territory). Before 1980-81 the table carries All India only.";
    mk((d) => d !== AE465, "farms-states-production", "ministry final estimates", "States and union territories x 9 crops, production, 1980-81 on (All India from 1950-51)", `${common} ${stage["465"].year} (${stage["465"].stage.toLowerCase()}) is in farms-states-production-advance.`);
    mk((d) => d === AE465, "farms-states-production-advance", "ministry advance estimates", `States x 9 crops, production, ${stage["465"].year} (${stage["465"].stage.toLowerCase()})`, `${common} This bundle is ${stage["465"].year} alone, on the ministry's ${stage["465"].stage.toLowerCase()}: a different ruler from the final years, never joined. RBI's Handbook of Statistics on Indian States carries later years for each state (the states guide's bundles states-hbs-t058 to t066).`);
  }

  /* ---- fertiliser per hectare, by state (SDMX AGG_STAT_IS_RN) ---- */
  {
    const rows = parseCsv(SD.agg_stat_is_rn.csv, ",");
    const h = rows[0];
    const o = rows.slice(1).filter((r) => r.length > 3).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
    // state codes and their names: the dataset's own SDMX code list
    const CODES = Object.fromEntries((SD.agg_stat_is_rn.codelist?.dimensions ?? []).find((d) => d.dim_code === "STATE_CODE")?.values.map((v) => [v.code, v.label]) ?? []);
    const unknown = new Set();
    const m = new Map();
    for (const r of o) {
      if (!/FERT/.test(r.agg_stats)) continue;
      if (r.unit_measure !== "KG_HCT") throw new Error(`farms: fertiliser per hectare unit "${r.unit_measure}"`);
      const name = CODES[r.state_code];
      if (!name) { unknown.add(r.state_code); continue; }
      const avg = r.agg_stats === "AVG_CONSPT_FERT_PR_HEC";
      const key = (avg ? "avg_" : "") + (r.state_code === "ALL_INDIA" ? "all_india" : placeStrict(name, "AGG_STAT_IS_RN").replace(/^former:/, "former_").replace(/-/g, "_"));
      if (!m.has(key)) m.set(key, { label: avg ? `${name} (average)` : name, map: new Map() });
      const d = `${r.repyearstart}-04-01`, v = parseNumber(r.obs_value);
      if (v == null) continue;
      const prev = m.get(key).map.get(d);
      if (prev != null && Math.abs(prev - v) > 1e-9) throw new Error(`farms: AGG_STAT_IS_RN gives two fertiliser values for ${name} ${d}`);
      m.get(key).map.set(d, v);
    }
    if (unknown.size) throw new Error(`farms: AGG_STAT_IS_RN state codes not mapped: ${[...unknown].join(", ")}`);
    const ai = m.get("avg_all_india") ?? m.get("all_india");
    if (!ai?.map.size || !(ai.map.get("2004-04-01") > 50 && ai.map.get("2004-04-01") < 200)) throw new Error("farms: no data returned: All India fertiliser per hectare");
    const axis = axisOf([...m.values()].map((x) => x.map));
    const series = {};
    let i = 0;
    for (const [key, v] of [...m].sort(([a, x], [b, y]) => (/all_india/.test(a) ? -1 : /all_india/.test(b) ? 1 : x.label < y.label ? -1 : 1))) {
      series[key] = mkSeries(axis, v.map, { name: `fertiliser_per_ha_${key}`, label: `${v.label}: fertiliser per hectare (N+P+K)`, unit: "kg_per_hectare", state: v.label, color: /all_india/.test(key) ? ACC : GREYS[i++ % GREYS.length] },
        "The dataset gives no figure for this state in these years.");
    }
    const foot = [...new Set(o.filter((r) => /FERT/.test(r.agg_stats)).map((r) => r.footnote))].join(" ");
    bundles["farms-states-fertiliser"] = {
      meta: {
        dossier: "farms", frequency: "annual", base: "as published", unit: "kg_per_hectare", source: HUB_SOURCE, vintage: null, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: fyLabel(axis.at(-1)), releaseDate: null, revisionPolicy: dcfg.revision_policy, periodKind: "fy",
        coverage: "Fertiliser (N+P+K) used per hectare, by state, 2004-05 to 2020-21",
        note: `RBI DBIE SDMX dataset AGG_STAT_IS_RN ("Agricultural Statistics - Indian State"), read from the RBI Innovation Hub service: kg of nitrogen, phosphate and potash per hectare, from RBI's Handbook of Statistics on Indian States table 94 (original source: Agricultural Statistics at a Glance, agriculture ministry). The dataset's footnote, without its spaces as served: ${foot.slice(0, 400)}`,
      },
      dates: axis, series,
    };
  }

  /* ---- archive, then canonicalise ---- */
  const hubDump = Object.fromEntries(Object.entries(H).map(([id, h]) => [id, { entry: h.entry, loaded_at: h.loaded_at, provenance: h.provenance, csv: h.csv }]));
  const sdDump = Object.fromEntries(Object.entries(SD).map(([k, h]) => [k, { entry: h.entry, loaded_at: h.loaded_at, codelist: h.codelist, csv: h.csv }]));
  const bad = cross.filter((c) => c.mismatchCount > Math.max(2, 0.002 * c.compared));
  writeRaw(root, RAW, {
    vintage,
    note: "Data Bank rows are the report's cells joined by \";\" in header order (every display unit, as served). Hub tables are the RBI Innovation Hub service's CSV exports of the Handbook's printed grids and one SDMX dataset. crosscheck: Data Bank values against the printed cells at the printed precision.",
    databank: Object.fromEntries(DB_REPORTS.map((id) => [id, { provenance: R[id].provenance, header: R[id].header, rows: R[id].rows.map((r) => R[id].header.map((h) => r[h]).join(";")) }])),
    rbihub: hubDump, sdmx: sdDump,
    stages: Object.fromEntries(Object.entries(stage).map(([k, v]) => [k, v])),
    crosscheck: cross,
  });
  const V = readRaw(root, RAW).vintage;
  for (const c of cross) console.log(`farms crosscheck: ${c.name}: ${c.match} of ${c.compared} cells agree${c.mismatchCount ? `; ${c.mismatchCount} differ, e.g. ${c.mismatches.slice(0, 3).join("; ")}` : ""}`);
  if (bad.length) throw new Error(`farms: the Data Bank and the Handbook disagree: ${bad.map((c) => `${c.name} (${c.mismatchCount} of ${c.compared})`).join("; ")}`);
  for (const [slug, b] of Object.entries(bundles)) {
    b.meta.vintage = V;
    writeSeries(root, `data/series/${slug}.json`, b);
  }
  console.log(`farms: foodgrains ${fyLabel(bundles["farms-production"].dates.at(-1))} ${round(bundles["farms-production"].series.foodgrains.data.at(-1), 1)} thousand tonnes; ${AE_YEAR} (${AE_STAGE}) ${round(bundles["farms-advance"].series.production_foodgrains.data[0], 1)}`);
}

/* ---------------- catalogue ----------------
 * Everything DBIE publishes on agriculture that this family owns, read from the two listings:
 * the Data Bank's DBIE inventory (the Agriculture menu and the Handbook's agricultural tables)
 * and the RBI Hub catalogue (report 190, which the Data Bank lacks, and the SDMX agriculture
 * datasets). Ids, coarse to fine:
 *   farms:<report>:<measure>:<crop>                 crop tables (production, area, yield)
 *   farms:<report>:<base>:<measure>:<crop>          index numbers
 *   farms:<report>:msp:<crop>                       minimum support prices
 *   farms:<report>:landuse:<item>                   land use and inputs
 *   farms:<report>:<procurement|offtake|stocks>:<crop>[:early]
 *   farms:465:<state>:<crop>                        state-wise output
 *   farms:sdmx:<dataset>[:<measure>][:<base>]:<code>[:<state>]   SDMX datasets
 *   farms:handbook:<report>                         the Handbook's copy of a report read elsewhere
 * The agricultural tables of the Handbook of Statistics on Indian States (state land use, area,
 * output and yield, livestock, storage, rainfall, fertiliser) are the states family's ledger. */
export async function catalogueFarms() {
  const { cfg } = sourceCfg("farms");
  const { R, H, cat } = await readSources(null, cfg);
  const items = [];
  const add = (id, label) => items.push({ id, ...(label ? { label } : {}) });
  for (const [id, measure] of [["623", "production"], ["624", "production"], ["625", "area"], ["886", "yield"], ["887", "yield"]]) {
    const crops = new Set(R[id].rows.map((r) => r.Crops));
    for (const c of crops) add(`farms:${id}:${measure}:${idPart(c)}`, `${c}, ${measure} (DBIE ${id})`);
  }
  for (const c of parseGrid(H[190].csv)[0].cols.filter((c, j) => j > 0 && c.child)) add(`farms:190:area:${idPart(c.child)}`, `${c.child}, area (DBIE 190, RBI Hub)`);
  for (const r of R["459"].rows) add(`farms:459:${idPart(r.Base)}:production:${idPart(r.Crops)}`);
  for (const r of R["460"].rows) add(`farms:460:${idPart(r.Base)}:${idPart(r.Indices)}:${idPart(r.Crops)}`);
  for (const id of ["461", "462"]) for (const r of R[id].rows) add(`farms:${id}:msp:${idPart(r["Grain Description"])}`);
  for (const r of R["463"].rows) add(`farms:463:landuse:${idPart(r["Agri Area Code"])}`);
  for (const r of R["464"].rows) add(`farms:464:${idPart(r["Agri Description"])}:${idPart(r.Crops)}${+r.Year.slice(0, 4) < 1972 && r["Value (HBS Table no 27)"] !== "" ? ":early" : ""}`);
  for (const r of R["465"].rows) add(`farms:465:${idPart(r.State)}:${idPart(r.Crop)}`);
  // the Handbook's own copies (reports 164-195, 278) of the reports above, and 458 (the
  // Agriculture-menu copy of 190), read for footnotes and cross-checks
  for (const e of cat.filter((x) => [164, 165, 166, 167, 169, 189, 191, 192, 193, 194, 195, 278, 458].includes(x.report_id))) add(`farms:handbook:${e.report_id}`, `${e.title} (${e.menu_path?.split(" > ")[0]}; ${e.status})`);
  // SDMX agriculture datasets on the Hub (Data Query > Real Sector > Agriculture): one item per
  // dataset x its indicator or crop code (x state where the dataset is state-wise)
  for (const e of cat.filter((x) => x.source === "sdmx" && /Real Sector > Agriculture/.test(x.menu_path ?? "") && x.status === "loaded")) {
    const rows = parseCsv(await rbihubCsv(e.schema_name, e.table_name), ",");
    const h = rows[0];
    const dim = ["agg_stats", "cls_of_crps", "class_prod_rn"].find((d) => h.includes(d));
    const sub = h.includes("agi_obs_typ_rn") ? "agi_obs_typ_rn" : null;
    for (const r of rows.slice(1).filter((r) => r.length > 3)) {
      const o = Object.fromEntries(h.map((k, i) => [k, r[i]]));
      const parts = [`farms:sdmx:${idPart(e.table_name)}`, ...(sub ? [idPart(o[sub])] : []), ...(o.base_per ? [idPart(o.base_per)] : []), idPart(o[dim]), ...(h.includes("state_code") ? [idPart(o.state_code)] : [])];
      add(parts.join(":"));
    }
  }
  writeCatalogue("farms", {
    source: "Reserve Bank of India, DBIE agriculture reports (via the local Data Bank) and the RBI Innovation Hub's DBIE service (report 190, the Handbook grids, the SDMX agriculture datasets)",
    generator: "scripts/lib/products/farms.mjs --catalogue",
    note: "Crop tables: one item per report x measure x crop; index numbers per base x index x crop; MSP per crop; land use per item; PDS per measure x crop (':early' marks the 1950-51 to 1970-71 stock rows); state output per state x crop; the Handbook's twin copies; the SDMX agriculture datasets per measure, base, crop or indicator code and state.",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueFarms);
