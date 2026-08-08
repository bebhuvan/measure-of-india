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
      color: code === 19 ? "#BE3E26" : GREYS[ai++ % GREYS.length],
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
  const legacyRaw = {};
  for (const [cyStr, bcfg] of Object.entries(LB)) {
    const lcy = Number(cyStr);
    const filter = (await mospi("asi/getAsiFilter", { classification_year: lcy })).data;
    const blockRows = {};
    for (const { indicator_code: code } of filter.indicator) {
      blockRows[code] = await fetchFiltered(lcy, { indicator_code: code, state_code: 99, nic_code: "99999" }, `legacy${lcy} ${code}`);
    }
    process.stdout.write(`asi legacy ${lcy}: ${filter.indicator.length} indicators fetched\n`);
    legacyRaw[cyStr] = { filter, indicators: blockRows };

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
        color: key === "gva" || key === "net_value_added" ? "#BE3E26" : GREYS[gi2++ % GREYS.length],
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
  if (Object.keys(legacyRaw).length) {
    writeRaw(root, "data/raw/asi-legacy.json", {
      vintage,
      note: "Older ASI classification blocks (2004/1998/1987): All-India × NIC 99999 × every indicator each block's getAsiFilter advertises, plus the filter payloads. Rows arrive once per nic_type with identical values. 1987 block: 1993-94 not served.",
      blocks: legacyRaw,
    });
  }

  writeJson(root, "data/series/asi-headline.json", headlineBundle);
  writeJson(root, "data/series/asi-accounts.json", accountsBundle);
  writeJson(root, "data/series/asi-industries.json", industriesBundle);
  writeJson(root, "data/series/asi-states.json", statesBundle);
  for (const [cyStr, b] of Object.entries(legacyBundles)) {
    writeJson(root, `data/series/asi-headline-${cyStr}.json`, b);
  }
  return headlineBundle;
}
