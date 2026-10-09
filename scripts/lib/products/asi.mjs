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
// Ingest (classification_year 2008; older NIC blocks baked separately below):
//  (a) All-India × nic 99999 × ALL 57 indicators × all years  -> raw + headline
//      + asi-accounts.json (the complete 57-indicator ledger)
//  (b) All-India × 2-digit NIC × 6 core indicators × all years -> asi-industries
//  (c) all states × nic 99999 × 6 core indicators × all years  -> asi-states
//  (d) legacy blocks 2004/1998/1987 (VERIFIED 2026-08-06: same param scheme,
//      nic_code=99999 = "All" in every block; duplicate rows once per
//      nic_type — 2004 ×3, 1998/1987 ×2 — identical values, deduped):
//      All-India × 99999 × every indicator the block's getAsiFilter lists
//      -> data/raw/asi-legacy.json + asi-headline-<block>.json (core set).
//      Year ranges as served: 2004: 2004-05..2007-08; 1998: 1998-99..2003-04;
//      1987: 1992-93..1997-98 with 1993-94 NOT SERVED (disclosed gap).
//      Blocks are NEVER spliced with each other or with the 2008 bundle.
// Monetary values are as published: ₹ lakh (unit field "₹ lakhs"); counts
// carry unit "-" in the source and are baked with unit "count". EXCEPTION:
// the 1987 block serves its monetary indicators (e.g. 59 Total Emoluments)
// with unit "-" — overridden to inr_lakh per UNIT_FIX, disclosed in meta.

// Hand check (2026-10-10): All India 2023-24 GVA 245,833,606 ₹ lakh (₹24,58,336 crore) and
// persons engaged 1,95,89,131, as in MoSPI's ASI 2023-24 results (reported 28 Aug 2025) and the
// later ASI factsheet; the top five industries by GVA there (basic metals, motor vehicles,
// chemicals, food products, pharmaceuticals) are asi-nic2's top five. Every 2-digit division's
// GVA sums to the All-India figure exactly (validate). MoSPI has since released ASI 2024-25 as
// a factsheet; eSankhyiki still ends at 2023-24 (checked 2026-10-10), so the bundles do too.
import { mospi } from "../mospi.mjs";
import { writeSeries } from "../util.mjs";
import { ensureAsiRaw, readAsiRaw } from "./asi-raw.mjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`; // "2023-24" -> "2023-04"

// unit as baked: monetary rows are published in ₹ lakh; "-" marks pure counts
const normUnit = (u) => (u === "₹ lakhs" ? "inr_lakh" : u === "-" || u == null ? "count" : slugify(u));

export async function buildAsi(root, dcfg, vintage) {
  const cy = dcfg.fetch.classification_year;
  const HEAD = dcfg.fetch.headline_indicators; // code -> key (11 baked; all 57 ingested to raw)
  const CORE = dcfg.fetch.core_indicators;     // code -> key

  /* Since wave 2 (2026-10-10) every table comes from the complete raw archive (asi-raw.mjs:
   * every indicator of every block, all pages), and the curated cuts are sliced from it:
   *  (a) All-India x NIC 99999, all 57 indicators; (b) All-India x 2-digit NIC, core;
   *  (c) every state x NIC 99999, core. The old per-cut raw dumps (asi-headline.json,
   *  asi-industries.json, asi-states.json, asi-legacy.json) are replaced by data/raw/asi-index.json. */
  await ensureAsiRaw(root);
  const T = (cy0, code) => {
    const rows = readAsiRaw(root, cy0, code);
    if (!rows) throw new Error(`ASI: raw table ${cy0}-${code} is not staged`);
    return rows;
  };
  const headlineRows = {};
  for (let code = 1; code <= 57; code++) headlineRows[code] = T(cy, code).filter((r) => r.state === "All India" && r.nic_code === "99999");
  const industryRows = {};
  for (const code of Object.keys(CORE)) industryRows[code] = T(cy, code).filter((r) => r.state === "All India" && r.nic_type === "2-digit");
  const stateRows = {};
  for (const code of Object.keys(CORE)) stateRows[code] = T(cy, code).filter((r) => r.nic_code === "99999");

  // resolve the 99999 duplicates + index: key -> Map("YYYY-MM" -> value).
  // The per-nic_type copies are NOT always identical: for 2023-24 the
  // 4-digit rows of indicators 36-49 are SHIFTED one indicator down (each
  // carries the next code's value; ind 50's 4-digit row is missing), and
  // the legacy blocks have a few cells whose copies differ slightly.
  // Resolution: majority value across the copies; tie -> prefer 2-digit,
  // then 3-digit, then 4-digit. Every disagreement is logged.
  const val = (r) => {
    const v = parseFloat(r.value);
    return Number.isFinite(v) ? v : null;
  };
  const NIC_PREF = { "2-digit": 0, "3-digit": 1, "4-digit": 2 };
  const indexRows = (rows, keyOf) => {
    const maps = {}; // key -> {map, unit, cand}
    for (const r of rows) {
      // every probed ASI row carries sector "Combined"; drop any stray split
      // rather than let it collide with the combined figure
      if (r.sector != null && r.sector !== "Combined") continue;
      const k = keyOf(r);
      if (k == null) continue;
      const v = val(r);
      if (v == null) continue;
      const e = (maps[k] ??= { map: new Map(), unit: normUnit(r.unit), cand: new Map() });
      const ym = fyStart(r.year);
      if (!e.cand.has(ym)) e.cand.set(ym, []);
      e.cand.get(ym).push({ v, pref: NIC_PREF[r.nic_type] ?? 9 });
    }
    for (const e of Object.values(maps)) {
      for (const [ym, cands] of e.cand) {
        const tally = new Map();
        for (const c of cands) {
          const t = tally.get(c.v) ?? { n: 0, pref: 9 };
          t.n++; t.pref = Math.min(t.pref, c.pref);
          tally.set(c.v, t);
        }
        const ranked = [...tally.entries()].sort((a, b) => b[1].n - a[1].n || a[1].pref - b[1].pref);
        if (tally.size > 1) process.stdout.write(`asi RESOLVE ${ym}: copies disagree (${[...tally.keys()].join(" / ")}) — kept ${ranked[0][0]} (majority, then coarsest nic_type)\n`);
        e.map.set(ym, ranked[0][0]);
      }
      delete e.cand;
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
    geo: dcfg.geo ?? "IND",
    latestPeriod: axis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  const unitNote = "Monetary series are as published in the source: ₹ lakh (1 lakh = 100,000; 1 crore = 100 lakh). Count series (factories, persons) are plain counts. Survey years are fiscal (Apr–Mar), plotted at April of the first year.";
  // interior nulls (a series missing a middle year) must be disclosed;
  // the axis is a parameter so legacy blocks disclose against THEIR axis
  const gapsInside = (maps, ax = axis) => {
    const set = new Set();
    for (const { map } of maps) {
      const ks = [...map.keys()].sort();
      for (const ym of ax) if (ym > ks[0] && ym < ks.at(-1) && !map.has(ym)) set.add(ym);
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
      color: key === "gva" ? "#2E4BD8" : GREYS[gi++ % GREYS.length],
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

  /* ---- asi-accounts.json: the complete 57-indicator ledger ---- */
  // Every indicator the 2008 block serves, keyed i01..i57, units as
  // published. This is the reference ledger behind "The factory accounts,
  // complete" — no selection, no derivation.
  const acctSeries = {};
  const acctMaps = [];
  let ai = 0;
  for (let code = 1; code <= 57; code++) {
    // QUARANTINE: indicator 36 (directly employed children workers) is
    // served as a single 2023-24 4-digit row whose value equals indicator
    // 37's contract-worker count — part of the shifted-copy defect above,
    // with no clean copy to fall back on. Not baked; kept in raw as served.
    if (code === 36) continue;
    const rows = headlineRows[code];
    if (!rows?.length) continue;
    const label = rows[0].indicator;
    const key = `i${String(code).padStart(2, "0")}`;
    const idx = indexRows(rows, () => key)[key];
    if (!idx?.map.size) continue;
    acctMaps.push(idx);
    acctSeries[key] = {
      name: `asi_acct_${code}_${slugify(label)}`, label,
      color: code === 19 ? "#2E4BD8" : GREYS[ai++ % GREYS.length],
      data: data(idx.map), unit: idx.unit,
    };
  }
  const accountsBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, all industries (NIC 99999); every indicator the ASI 2008 block publishes — the complete factory accounts, " + Object.keys(acctSeries).length + " of 57 served with data",
      note: unitNote + " Nothing is selected or derived here: every published indicator, keyed i01–i57 in the source's own order, units as served (₹ lakh for money, counts and mandays plain, kWh and tonnes where marked). Stock-change indicators (24–27) and Net Profit (30) can be legitimately negative. Two source defects are handled and disclosed: the 2023-24 4-digit copies of indicators 36–49 arrive shifted one indicator down and are outvoted by the clean 2- and 3-digit copies; indicator 36 (children workers) exists ONLY as one such corrupt row and is quarantined — 56 of 57 indicators are baked.",
      gaps: gapsInside(acctMaps),
    },
    dates, series: acctSeries,
  };

  /* ================= legacy classification blocks ================= */
  // Older blocks are separate rulers: fetched All-India × 99999 across the
  // FULL indicator list each block advertises (raw audit trail), baked as
  // asi-headline-<block>.json with the block's core comparable set only.
  const UNIT_FIX = { 1987: { 59: "inr_lakh", 60: "inr_lakh" } }; // monetary rows served with unit "-"
  const LEGACY_LABELS = {
    number_of_factories: "Number of factories", factories_in_operation: "Factories in operation",
    fixed_capital: "Fixed capital", invested_capital: "Invested capital",
    total_output: "Gross output", total_inputs: "Total inputs", gva: "Gross value added",
    net_value_added: "Net value added", persons_engaged: "Total persons engaged",
    workers: "Total workers", emoluments: "Total emoluments (wages & salaries incl. employer's contribution)",
    wages_incl_bonus: "Wages & salaries incl. bonus", total_emoluments: "Total emoluments",
  };
  const legacyBundles = {};
  const LB = dcfg.fetch.legacy_blocks ?? {};
  for (const [cyStr, bcfg] of Object.entries(LB)) {
    const lcy = Number(cyStr);
    const filter = (await mospi("asi/getAsiFilter", { classification_year: lcy })).data;
    const blockRows = {};
    for (const { indicator_code: code } of filter.indicator) blockRows[code] = T(lcy, code).filter((r) => r.state === "All India" && r.nic_code === "99999");

    // block-local fiscal axis from the block's own served years
    const yrs = filter.year.map((y) => Number(y.year.slice(0, 4))).sort((a, b) => a - b);
    const lAxis = [];
    for (let y = yrs[0]; y <= yrs.at(-1); y++) lAxis.push(`${y}-04`);
    const lDates = lAxis.map((ym) => `${ym}-01`);
    const lData = (map) => lAxis.map((ym) => map.get(ym) ?? null);
    const lSeries = {};
    const lMaps = [];
    let gi2 = 0;
    for (const [code, key] of Object.entries(bcfg.core)) {
      const idx = indexRows(blockRows[code], () => key)[key];
      if (!idx?.map.size) { process.stdout.write(`asi legacy ${lcy}: core indicator ${code} (${key}) returned nothing\n`); continue; }
      if (UNIT_FIX[lcy]?.[code]) idx.unit = UNIT_FIX[lcy][code];
      lMaps.push(idx);
      lSeries[key] = {
        name: `asi${lcy}_${key}`, label: LEGACY_LABELS[key] ?? key,
        color: key === "gva" || key === "net_value_added" ? "#2E4BD8" : GREYS[gi2++ % GREYS.length],
        data: lData(idx.map), unit: idx.unit,
      };
    }
    if (!lSeries.number_of_factories?.data.some((v) => v != null)) throw new Error(`ASI legacy ${lcy}: no factory counts returned`);
    legacyBundles[cyStr] = {
      meta: {
        ...metaBase,
        base: bcfg.base,
        coverage: `All India, all industries (NIC 99999), classification block ${lcy}; core comparable indicators`,
        latestPeriod: lAxis.at(-1),
        note: unitNote
          + ` This is the NIC-${lcy} classification block, a separate ruler from the 2008 block — never spliced.`
          + (lcy === 1998 ? " The block publishes no GVA, no factories-in-operation and no employer's-contribution wage aggregate; wages incl. bonus is the closest served wage line." : "")
          + (lcy === 1987 ? " The block publishes no GVA; 1993-94 is not served by the API at all (disclosed gap, not a fetch failure). Total Emoluments is served with unit \"-\" but is ₹ lakh — unit corrected here, disclosed." : ""),
        gaps: gapsInside(lMaps, lAxis),
      },
      dates: lDates, series: lSeries,
    };
  }
  writeSeries(root, "data/series/asi-headline.json", headlineBundle);
  writeSeries(root, "data/series/asi-accounts.json", accountsBundle);
  writeSeries(root, "data/series/asi-industries.json", industriesBundle);
  writeSeries(root, "data/series/asi-states.json", statesBundle);
  for (const [cyStr, b] of Object.entries(legacyBundles)) {
    writeSeries(root, `data/series/asi-headline-${cyStr}.json`, b);
  }
  await bakeAsiTables(root, dcfg, vintage, T);
  return headlineBundle;
}

/* ================= the complete tables (wave 2, 2026-10-10) =================
 * Every indicator of every NIC block at every grain the survey serves, from the raw archive:
 *   asi[-<block>]-nic2|nic3|nic4   All India x every NIC class at that level x every indicator
 *   asi-states-all | asi-<block>-states   every state x all industries x every indicator
 *   asi[-<block>]-state-nic2-<state>  one state x every 2-digit division x every indicator
 *   asi-<block>-accounts           All India x all industries x every indicator (older blocks;
 *                                  the 2008 block's is asi-accounts, above)
 *   asi-<block>-sectors            rural / urban rows, where a block serves them
 * The state x 3-digit tables, and the older blocks' state x 2-digit tables, are the deep-archive
 * tier: long-format csv.gz staged in data/archive/staging/asi/ (one file per block and level),
 * rolling up to the state x 2-digit bundles (NIC 2008) or the states and divisions bundles. Blocks are never joined; each is its own ruler (sources.yml seams).
 * Values as served. Where a cell arrives more than once (the NIC 99999 "All" rows, once per
 * nic_type), the majority value is kept, then the coarsest copy; disagreements are counted. */
const BLOCK_TAG = { 2008: "", 2004: "-2004", 1998: "-1998", 1987: "-1987" };
const UNIT_OF = (u, cy, code) => {
  if (cy === 1987 && (code === 59 || code === 60) && (u === "-" || u == null)) return "inr_lakh";   // served with "-", it is ₹ lakh
  const k = String(u ?? "-").trim();
  const M = { "₹ lakhs": "inr_lakh", "-": "count", "": "count" };
  if (k in M) return M[k];
  if (/thousand/i.test(k) && /kwh/i.test(k)) return "thousand_kwh";
  if (/thousand/i.test(k) && /tonne/i.test(k)) return "thousand_tonne";
  if (/thousand/i.test(k) && /₹|rs/i.test(k)) return "inr_thousand";
  if (/^thousands?$/i.test(k) || /'000|000/.test(k)) return "thousand";
  return null;
};
export async function bakeAsiTables(root, dcfg, vintage, T) {
  const STAGE = "data/archive/staging/asi";
  const slug = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const staged = [];
  let disagree = 0;
  for (const cy of [2008, 2004, 1998, 1987]) {
    const f = (await mospi("asi/getAsiFilter", { classification_year: cy })).data;
    const tag = BLOCK_TAG[cy];
    const base = cy === 2008 ? dcfg.base : `NIC ${cy}`;
    const inds = f.indicator.map((i) => ({ code: +i.indicator_code, name: String(i.indicator_name).replace(/\s+/g, " ").trim() }));
    // cells: grain -> key -> { label, unit, group, years: Map(fy -> [{v, pref}]) }
    const G = { all: new Map(), nic2: new Map(), nic3: new Map(), nic4: new Map(), states: new Map(), sectors: new Map() };   // + "sn2:<state>", one per state
    const deep = { sn2: [], sn3: [], sn4: [] };
    const units = new Set();
    for (const ind of inds) {
      const rows = T(cy, ind.code);
      for (const r of rows) {
        const v = parseFloat(r.value);
        if (!Number.isFinite(v)) continue;
        const unit = UNIT_OF(r.unit, cy, ind.code);
        if (!unit) throw new Error(`ASI ${cy}-${ind.code}: unknown unit "${r.unit}"`);
        units.add(`${r.unit} -> ${unit}`);
        const ik = `i${String(ind.code).padStart(2, "0")}`;
        const ai = r.state === "All India", all = r.nic_code === "99999";
        const lvl = { "2-digit": 2, "3-digit": 3, "4-digit": 4 }[r.nic_type];
        const nicLab = `${r.nic_code} ${String(r.nic_description ?? "").replace(/\s+/g, " ").trim()}`;
        const div = String(r.nic_code).slice(0, 2);
        let g, key, label, group;
        if (r.sector && r.sector !== "Combined") {
          if (!ai || !all) continue;   // rural/urban rows are read at All India x all industries only
          g = "sectors"; key = `${ik}_${slug(r.sector)}`; label = `${ind.name} · ${r.sector}`; group = r.sector;
        } else if (ai && all) { g = "all"; key = ik; label = ind.name; group = ind.name; }
        else if (ai) { g = `nic${lvl}`; key = `${ik}_${r.nic_code}`; label = `${ind.name} · ${nicLab}`; group = `NIC ${div}`; }
        else if (all) { g = "states"; key = `${ik}_${slug(r.state)}`; label = `${ind.name} · ${r.state}`; group = r.state; }
        // older blocks' state x division tables (69,000 series) are the archive tier, like
        // every state x 3-digit table; the current block's state x division is baked per state
        else if (lvl === 2 && cy === 2008) { g = `sn2:${r.state}`; key = `${ik}_${r.nic_code}`; label = `${ind.name} · ${r.state} · ${nicLab}`; group = nicLab; }
        else { deep[`sn${lvl}`].push([r.state, r.nic_type, r.nic_code, nicLab.slice(r.nic_code.length + 1), ind.code, ind.name, r.year, v, unit]); continue; }
        if (g.startsWith("sn2:")) G[g] ??= new Map();
        if (!G[g]) throw new Error(`ASI ${cy}: unexpected grain for ${JSON.stringify(r)}`);
        let e = G[g].get(key);
        if (!e) G[g].set(key, e = { label, unit, group, years: new Map() });
        const fy = String(r.year);
        if (!e.years.has(fy)) e.years.set(fy, []);
        e.years.get(fy).push({ v, pref: lvl ?? 9 });
      }
    }
    process.stdout.write(`asi tables ${cy}: units ${[...units].join("; ")}\n`);
    // Shifted copies: in some (grain, year) tables MoSPI serves indicators 36-49 one code
    // down (each code carries the next code's value; 50 is missing). Found 2026-10-10 at NIC
    // 2008, 4-digit, 2023-24: persons engaged (31) no longer equals workers (32) + other
    // employees (38) + unpaid members (41) in 149 of 151 classes, and does once read a code
    // up. Detected here by that identity, per grain and year: where most cells fail, the
    // cells of indicators 36-50 for that year are quarantined (not baked; the raw keeps them).
    const quarantine = new Map();   // grain -> Set(fy)
    for (const [g, map] of Object.entries(G)) {
      const byFy = new Map();
      for (const [key, e] of map) {
        if (!key.startsWith("i31")) continue;
        const sfx = key.slice(3), w = map.get("i32" + sfx), o = map.get("i38" + sfx), u = map.get("i41" + sfx);
        if (!w || !o) continue;
        for (const [fy, c] of e.years) {
          const v = (x) => x?.years.get(fy)?.[0]?.v;
          if (v(w) == null || v(o) == null) continue;
          const t = byFy.get(fy) ?? { n: 0, bad: 0 }; t.n++;
          if (Math.abs(v(w) + v(o) + (v(u) ?? 0) - c[0].v) > Math.max(2, c[0].v * 0.002)) t.bad++;
          byFy.set(fy, t);
        }
      }
      for (const [fy, t] of byFy) if (t.n >= 5 && t.bad / t.n > 0.5) {
        (quarantine.get(g) ?? quarantine.set(g, new Set()).get(g)).add(fy);
        process.stdout.write(`asi QUARANTINE ${cy} ${g} ${fy}: identity fails in ${t.bad} of ${t.n} cells; indicators 36-50 not baked for that year\n`);
        for (const [key, e] of map) { const c = +key.slice(1, 3); if (c >= 36 && c <= 50) e.years.delete(fy); }
      }
    }
    // fiscal axis of the block from every year it serves
    const fys = [...new Set(inds.flatMap((i) => T(cy, i.code).map((r) => String(r.year))))].sort();
    if (!fys.length) throw new Error(`ASI ${cy}: no rows in any table`);
    const axis = []; for (let y = +fys[0].slice(0, 4); y <= +fys.at(-1).slice(0, 4); y++) axis.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
    const dates = axis.map((fy) => `${fy.slice(0, 4)}-04-01`);
    const NAMES = {
      all: ["accounts", "All India, all industries: every indicator the block publishes"],
      nic2: ["nic2", "All India, every 2-digit NIC division, every indicator"],
      nic3: ["nic3", "All India, every 3-digit NIC group, every indicator"],
      nic4: ["nic4", "All India, every 4-digit NIC class, every indicator"],
      states: [cy === 2008 ? "states-all" : "states", "Every state and UT, all industries, every indicator"],
      sectors: ["sectors", "All India, all industries, rural and urban, every indicator served that way"],
    };
    for (const [g, map] of Object.entries(G)) {
      if (!map.size) continue;
      if (g === "all" && cy === 2008) continue;   // asi-accounts carries it (with the indicator-36 quarantine)
      const series = {};
      for (const [key, e] of [...map].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const data = axis.map((fy) => {
          const c = e.years.get(fy); if (!c) return null;
          const tally = new Map(); for (const x of c) { const t = tally.get(x.v) ?? { n: 0, pref: 9 }; t.n++; t.pref = Math.min(t.pref, x.pref); tally.set(x.v, t); }
          if (tally.size > 1) disagree++;
          return [...tally].sort((a, b) => b[1].n - a[1].n || a[1].pref - b[1].pref)[0][0];
        });
        if (data.every((v) => v == null)) continue;
        const fi = data.findIndex((v) => v != null), li = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
        const gaps = dates.filter((_, i) => i > fi && i < li && data[i] == null);
        series[key] = { name: `asi${cy}_${g}_${key}`, label: e.label, unit: e.unit, group: e.group, color: "#A3A9B4", data, ...(gaps.length ? { gaps, gapsNote: "Not published for this year at this grain (a small industry or state the survey did not report separately)." } : {}) };
      }
      const st = g.startsWith("sn2:") ? g.slice(4) : null;
      const [part, cov] = st ? [`state-nic2-${slug(st).replace(/_/g, "-")}`, `${st} by 2-digit NIC division, every indicator`] : NAMES[g];
      writeSeries(root, `data/series/asi${tag}-${part}.json`, {
        meta: { dossier: "asi", frequency: "annual", base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
          latestPeriod: dates.at(-1).slice(0, 7), releaseDate: null, revisionPolicy: dcfg.revision_policy,
          product: `Annual Survey of Industries, NIC ${cy} block`,
          coverage: `${cov}, ${axis[0]} to ${axis.at(-1)} (NIC ${cy} block)`,
          note: `The NIC-${cy} classification block, a separate ruler from every other block (never joined). Values as published: money in ₹ lakh (nominal; fuel values in ₹ thousand where the source says so), counts plain, mandays in thousands. Survey years are financial years, dated at April of the first. A class missing in a year was not reported separately that year.`
            + (cy === 2008 ? " The 2023-24 four-digit copies of the All-industries rows of indicators 36 to 49 arrive shifted by one indicator; at All India they are outvoted by the clean 2- and 3-digit copies (see asi-accounts)." : "")
            + (quarantine.get(g)?.size ? ` Quarantined: in ${[...quarantine.get(g)].join(", ")} the source serves indicators 36 to 49 of this table shifted one code down (persons engaged stops adding up from workers, other employees and unpaid members, and adds up again read one code up); those cells of indicators 36 to 50 are left out, and the raw archive keeps them as served.` : "") },
        dates, series,
      });
    }
    // the deep-archive tier: state x 3- and 4-digit, long format
    for (const [lv, rows] of Object.entries(deep)) {
      if (!rows.length) continue;
      const head = ["block", "state", "nic_level", "nic_code", "nic_description", "indicator_code", "indicator", "year", "value", "unit", "source", "vintage"];
      const cell = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      rows.sort((a, b) => (a[0] + a[2] + String(a[4]).padStart(2, "0") + a[6] < b[0] + b[2] + String(b[4]).padStart(2, "0") + b[6] ? -1 : 1));
      const lines = [head.join(","), ...rows.map((r) => [cy, r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], "MoSPI, NSO: Annual Survey of Industries (eSankhyiki)", vintage].map(cell).join(","))];
      const file = `${STAGE}/asi-${cy}-state-${lv.replace("sn", "nic")}.csv.gz`;
      fs.mkdirSync(path.join(root, STAGE), { recursive: true });
      fs.writeFileSync(path.join(root, file), zlib.gzipSync(lines.join("\n") + "\n", { level: 9 }));
      staged.push({ file, block: cy, level: lv.replace("sn", "nic"), rows: rows.length, rolls_up_to: cy === 2008 ? "asi-state-nic2-<state>" : `asi${tag}-states, asi${tag}-nic2` });
    }
  }
  if (staged.length) fs.writeFileSync(path.join(root, STAGE, "files.json"), JSON.stringify({ note: "Staged ASI state x 3- and 4-digit tables for the deep archive (PLAN-launch §2b); each rolls up to its block's state x 2-digit bundle.", files: staged }, null, 1) + "\n");
  process.stdout.write(`asi tables: ${staged.length} archive files (${staged.reduce((a, f) => a + f.rows, 0)} rows); ${disagree} cells whose copies disagreed (majority kept)\n`);
}

/* Catalogue (docs/CONTRACT-coverage.md): what MoSPI publishes from the ASI, from
 * asi/getNicClassificationYear and each block's asi/getAsiFilter (which lists the block's
 * indicators, states, NIC codes at every digit level, and for the older blocks a sector).
 * One item per indicator x one cut, the others at All India, all industries:
 *   asi:<block>:<indicator>:all | :state:<state> | :nic2|nic3|nic4:<code> | :sector:<sector>
 * plus the state x industry tables (wave 2), one item per indicator x state x NIC digit level
 * (the whole industry table of that state at that level):
 *   asi:<block>:<indicator>:statenic2|statenic3|statenic4:<state> */
import { writeCatalogue, idPart, catalogueCli } from "../catalogue.mjs";
export async function catalogueAsi() {
  const items = [];
  const blocks = ((await mospi("asi/getNicClassificationYear", {})).data ?? []).map((b) => b.classification_year);
  for (const cy of blocks) {
    const f = (await mospi("asi/getAsiFilter", { classification_year: cy })).data ?? {};
    const cuts = [];
    for (const s of f.state ?? []) if (s.state_code !== 99) cuts.push(`state:${idPart(s.state_name)}`);
    // NIC 99999 is "All", the :all item itself, listed again at every digit level
    for (const d of [2, 3, 4]) for (const n of f[`nic_${d}_digit`] ?? []) if (n.nic_code !== "99999") cuts.push(`nic${d}:${idPart(n.nic_code)}`);
    for (const s of f.sector ?? []) if (!/combined/i.test(s.sector_name)) cuts.push(`sector:${idPart(s.sector_name)}`);
    const levels = [2, 3, 4].filter((d) => (f[`nic_${d}_digit`] ?? []).length);
    for (const ind of f.indicator ?? []) {
      items.push({ id: `asi:${cy}:${ind.indicator_code}:all`, label: ind.indicator_name });
      for (const c of cuts) items.push({ id: `asi:${cy}:${ind.indicator_code}:${c}` });
      for (const st of f.state ?? []) if (st.state_code !== 99) for (const d of levels) items.push({ id: `asi:${cy}:${ind.indicator_code}:statenic${d}:${idPart(st.state_name)}` });
    }
  }
  writeCatalogue("asi", { source: "MoSPI, NSO: Annual Survey of Industries (eSankhyiki API)",
    generator: "scripts/lib/products/asi.mjs --catalogue",
    note: "From getNicClassificationYear and getAsiFilter per NIC block (2008, 2004, 1998, 1987): every indicator x one cut (a state, a NIC code at 2, 3 or 4 digits, a sector), and every indicator x state x NIC digit level (that state's industry table).", items });
}
await catalogueCli(import.meta.url, catalogueAsi);
