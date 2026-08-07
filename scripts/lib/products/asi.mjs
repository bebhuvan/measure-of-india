// scripts/lib/products/asi.mjs — Annual Survey of Industries (NIC 2008 block).
//
// The unfiltered asi/getASIData stream for classification_year=2008 is
// ~2.27M rows (226,635 pages at limit=10) — never paged through. Server-side
// filtering was VERIFIED live (2026-08-06) by comparing meta_data.totalPages
// AND inspecting returned rows:
//   unfiltered                          226,635 pages (limit=10)
//   + indicator_code=19                   4,048  (rows all "Gross Value Added")
//   + state_code=99                         414  (rows all "All India")
//   + nic_code=99999                          5  (rows all nic "All")
//   + nic_type=2-digit (instead of nic)      48  (rows all 2-digit)
//   + year=2023-24                           26  (rows all 2023-24)
// nic_id is IGNORED (identical totals with/without) — nic_code/nic_type are
// the working params. asi/getDownloadASIRecords returns an empty body.
// QUIRK: nic_code=99999 (All industries) rows arrive in TRIPLICATE — one per
// nic_type (2/3/4-digit) with identical values — deduped on (indicator, year,
// state) keeping the first.
//
// Ingest (classification_year 2008 only; older NIC blocks are never spliced):
//  (a) All-India × nic 99999 × ALL 57 indicators × all years  -> raw + headline
//  (b) All-India × 2-digit NIC × 6 core indicators × all years -> asi-industries
//  (c) all states × nic 99999 × 6 core indicators × all years  -> asi-states
// Monetary values are as published: ₹ lakh (unit field "₹ lakhs"); counts
// carry unit "-" in the source and are baked with unit "count".

import { mospi } from "../mospi.mjs";
import { writeJson, writeRaw } from "../util.mjs";

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`; // "2023-24" -> "2023-04"

async function fetchFiltered(cy, params, tag) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("asi/getASIData", { classification_year: cy, ...params, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page >= tp) break;
    page++;
    if (page % 5 === 0) process.stdout.write(`asi ${tag}: page ${page}/${tp} (${rows.length} rows)\n`);
  }
  return rows;
}

// unit as baked: monetary rows are published in ₹ lakh; "-" marks pure counts
const normUnit = (u) => (u === "₹ lakhs" ? "inr_lakh" : u === "-" || u == null ? "count" : slugify(u));

export async function buildAsi(root, dcfg, vintage) {
  const cy = dcfg.fetch.classification_year;
  const HEAD = dcfg.fetch.headline_indicators; // code -> key (11 baked; all 57 ingested to raw)
  const CORE = dcfg.fetch.core_indicators;     // code -> key

  /* ---- (a) All-India, all-industries: ALL 57 indicators ---- */
  const headlineRows = {};
  for (let code = 1; code <= 57; code++) {
    headlineRows[code] = await fetchFiltered(cy, { indicator_code: code, state_code: 99, nic_code: "99999" }, `headline ${code}`);
    if (code % 10 === 0) process.stdout.write(`asi headline: indicator ${code}/57 done\n`);
  }

  /* ---- (b) All-India × 2-digit NIC, core indicators ---- */
  const industryRows = {};
  for (const code of Object.keys(CORE)) {
    industryRows[code] = await fetchFiltered(cy, { indicator_code: code, state_code: 99, nic_type: "2-digit" }, `industries ${code}`);
    process.stdout.write(`asi industries ind ${code}: ${industryRows[code].length} rows\n`);
  }

  /* ---- (c) state-wise, all-industries, core indicators ---- */
  const stateRows = {};
  for (const code of Object.keys(CORE)) {
    stateRows[code] = await fetchFiltered(cy, { indicator_code: code, nic_code: "99999" }, `states ${code}`);
    process.stdout.write(`asi states ind ${code}: ${stateRows[code].length} rows\n`);
  }

  writeRaw(root, "data/raw/asi-headline.json", {
    vintage, note: "All-India × NIC 99999 (All) × all 57 ASI indicators, classification_year 2008. Rows arrive once per nic_type with identical values.",
    indicators: headlineRows,
  });
  writeRaw(root, "data/raw/asi-industries.json", {
    vintage, note: "All-India × 2-digit NIC × core indicators, classification_year 2008.",
    indicators: industryRows,
  });
  writeRaw(root, "data/raw/asi-states.json", {
    vintage, note: "All states/UTs × NIC 99999 (All) × core indicators, classification_year 2008. Rows arrive once per nic_type with identical values.",
    indicators: stateRows,
  });

  // dedupe the 99999 triplicates + index: key -> Map("YYYY-MM" -> value)
  const val = (r) => {
    const v = parseFloat(r.value);
    return Number.isFinite(v) ? v : null;
  };
  const indexRows = (rows, keyOf) => {
    const maps = {}; // key -> {map, unit, seen}
    for (const r of rows) {
      // every probed ASI row carries sector "Combined"; drop any stray split
      // rather than let it collide with the combined figure
      if (r.sector != null && r.sector !== "Combined") continue;
      const k = keyOf(r);
      if (k == null) continue;
      const ym = fyStart(r.year);
      const e = (maps[k] ??= { map: new Map(), unit: normUnit(r.unit), seen: new Set() });
      const dupKey = `${r.year}`; // triplicate rows differ only in nic_type
      if (e.seen.has(dupKey)) continue;
      e.seen.add(dupKey);
      const v = val(r);
      if (v != null) e.map.set(ym, v);
    }
    return maps;
  };

  // continuous fiscal-year axis from first to last observed survey year —
  // a wholly-unpublished middle year would surface as a disclosed gap, not
  // as a silently skipped axis point
  const allYears = [...new Set(Object.values(headlineRows).flat().map((r) => r.year))].sort();
  const axis = [];
  for (let y = Number(allYears[0].slice(0, 4)); y <= Number(allYears.at(-1).slice(0, 4)); y++) axis.push(`${y}-04`);
  const dates = axis.map((ym) => `${ym}-01`);
  const metaBase = {
    dossier: "asi", frequency: "annual", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    latestPeriod: axis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  const unitNote = "Monetary series are as published in the source: ₹ lakh (1 lakh = 100,000; 1 crore = 100 lakh). Count series (factories, persons) are plain counts. Survey years are fiscal (Apr–Mar), plotted at April of the first year.";
  // interior nulls (a series missing a middle year) must be disclosed
  const gapsInside = (maps) => {
    const set = new Set();
    for (const { map } of maps) {
      const ks = [...map.keys()].sort();
      for (const ym of axis) if (ym > ks[0] && ym < ks.at(-1) && !map.has(ym)) set.add(ym);
    }
    return [...set].sort().map((ym) => `${ym}-01`);
  };
  const data = (map) => axis.map((ym) => map.get(ym) ?? null);

  /* ---- asi-headline.json ---- */
  const LABELS = {
    number_of_factories: "Number of factories", factories_in_operation: "Factories in operation",
    fixed_capital: "Fixed capital", invested_capital: "Invested capital",
    total_output: "Gross output", total_inputs: "Total inputs", gva: "Gross value added",
    net_value_added: "Net value added", persons_engaged: "Total persons engaged",
    workers: "Total workers", emoluments: "Total emoluments (wages & salaries incl. employer's contribution)",
  };
  const hSeries = {};
  const hMaps = [];
  let gi = 0;
  for (const [code, key] of Object.entries(HEAD)) {
    const idx = indexRows(headlineRows[code], () => key)[key];
    if (!idx?.map.size) continue;
    hMaps.push(idx);
    hSeries[key] = {
      name: `asi_${key}`, label: LABELS[key] ?? key,
      color: key === "gva" ? "#BE3E26" : GREYS[gi++ % GREYS.length],
      data: data(idx.map), unit: idx.unit,
    };
  }
  if (!hSeries.gva?.data.some((v) => v != null)) throw new Error("ASI: no headline GVA data returned");
  const headlineBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, all registered factories (NIC 2008, all industries); headline indicators",
      note: unitNote + " Factory counts step up sharply in 2010-11 (155-159k -> ~212k): the ASI sampling frame was revised that year — a coverage change as published, not a data error; treat pre/post-2010-11 count comparisons with care.",
      gaps: gapsInside(hMaps),
    },
    dates, series: hSeries,
  };

  /* ---- asi-industries.json: 2-digit NIC × core indicators ---- */
  const iSeries = {};
  const iMaps = [];
  let ii = 0;
  for (const [code, key] of Object.entries(CORE)) {
    const byNic = indexRows(industryRows[code], (r) => (r.nic_code === "99999" ? null : `${r.nic_code}|${r.nic_description}`));
    for (const k of Object.keys(byNic).sort()) {
      const [nic, desc] = k.split("|");
      const e = byNic[k];
      if (!e.map.size) continue;
      iMaps.push(e);
      iSeries[`${key}_${nic}`] = {
        name: `asi_${key}_nic${nic}`, label: `${LABELS[key] ?? key} · ${nic} ${desc}`,
        color: GREYS[ii++ % GREYS.length], data: data(e.map), unit: e.unit,
      };
    }
  }
  const industriesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India × 2-digit NIC 2008 divisions; core indicators (factories in operation, fixed capital, gross output, GVA, persons engaged, emoluments)",
      note: unitNote + " Divisions absent in a given year (small industries not surveyed separately) appear as disclosed gaps or shorter spans.",
      gaps: gapsInside(iMaps),
    },
    dates, series: iSeries,
  };

  /* ---- asi-states.json: state-wise, all industries, core indicators ---- */
  const sSeries = {};
  const sMaps = [];
  let si = 0;
  for (const [code, key] of Object.entries(CORE)) {
    const byState = indexRows(stateRows[code], (r) => (r.state === "All India" ? null : r.state));
    for (const st of Object.keys(byState).sort()) {
      const e = byState[st];
      if (!e.map.size) continue;
      sMaps.push(e);
      const sk = slugify(st);
      sSeries[`${key}_${sk}`] = {
        name: `asi_${key}_${sk}`, label: `${LABELS[key] ?? key} · ${st}`,
        color: GREYS[si++ % GREYS.length], data: data(e.map), unit: e.unit,
      };
    }
  }
  const statesBundle = {
    meta: {
      ...metaBase,
      coverage: "States/UTs, all industries (NIC 99999); core indicators",
      note: unitNote + " Newer UTs (e.g. Ladakh) and reorganised states have shorter spans; interior missing years are disclosed in gaps.",
      gaps: gapsInside(sMaps),
    },
    dates, series: sSeries,
  };

  writeJson(root, "data/series/asi-headline.json", headlineBundle);
  writeJson(root, "data/series/asi-industries.json", industriesBundle);
  writeJson(root, "data/series/asi-states.json", statesBundle);
  return headlineBundle;
}
