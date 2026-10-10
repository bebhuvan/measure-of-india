// scripts/lib/products/mnre.mjs — Ministry of New and Renewable Energy.
//
// Five renewable energy types, each a cumulative INSTALLED CAPACITY stock in
// MW (not generation): Solar (1), Wind (2), Hydro (3), Bio (4), Total (5).
// Monthly from Jan 2020 to the latest month served. state_code 36 = All India.
//
// CLASSIFICATION BREAK (Dec 2023): Large Hydro reads 0 MW through Nov 2023 (baked as empty:
// not counted), then ~46,910 MW from Dec 2023 — a definitional change, not capacity. Other
// zeros that are not capacity (categories before they enter, unreported months) are gaps too;
// see notCounted below.
// The published Grand Total carries the step. The dossier annotates the break
// as a seam; growth is never computed across it. Individual sources are clean.
//
// Bundles baked:
//   mnre-sources.json          — All-India monthly 2020-2026: Solar Total,
//                                Wind, Small Hydro, Large Hydro, Bio Total,
//                                Grand Total (published, carries the break)
//   mnre-solar-categories.json — All-India monthly: Ground Mounted, Rooftop
//                                (PM Surya Ghar), Hybrid, Off-Grid/KUSUM
//   mnre-bio-categories.json   — All-India bio power by kind (bagasse, non-bagasse,
//                                waste to energy on and off grid) + the published total
//   mnre-states.json           — state-wise Grand Total, monthly
//   mnre-states-solar.json     — state-wise solar: total and its four sub-categories
//   mnre-states-wind.json      — state-wise wind
//   mnre-states-hydro.json     — state-wise small and large hydro
//   mnre-states-bio.json       — state-wise bio power: total and its four kinds
//
// Hand check (wave 2, 2026-10-10): All India bio power total, July 2026 = sum of the four
// kinds as served (9,821.32 bagasse + 1,047.85 non-bagasse + 324.24 waste to energy + the
// off-grid row); see scripts/validate.mjs for the identity across every month.

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw, readRaw, monthAxis } from "../util.mjs";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthNameToNum = (name) => String(MONTHS.indexOf(name) + 1).padStart(2, "0");
const val = (r) => {
  const v = parseFloat(r.value);
  return Number.isFinite(v) ? v : null;
};
// (year, month_name) -> "YYYY-MM"
const ym = (r) => `${r.year}-${monthNameToNum(r.month)}`;

async function fetchType(typeCode, stateCode, tag) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("mnre/getDataByEnergy", { type_of_renewable_energy_code: typeCode, state_code: stateCode, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page >= tp) break;
    page++;
  }
  // unstable paging shows up as the same row twice (and another missing): never bake that
  const seen = new Set();
  for (const r of rows) {
    const { value, ...dims } = r;
    const k = JSON.stringify(dims);
    if (seen.has(k)) throw new Error(`MNRE type ${typeCode} state ${stateCode}: duplicate row ${k}: the API paged unstably; refetch with MOSPI_NO_CACHE=1`);
    seen.add(k);
  }
  return rows;
}

export async function buildMnre(root, dcfg, vintage) {
  // One call set per type with no state filter: every state, every category, every month.
  // The All India rows (state "All India") are the national series; the rest are the states.
  // MNRE_FROM_RAW=1 re-bakes from the archived dump without calling the API
  const fromRaw = Boolean(process.env.MNRE_FROM_RAW);
  let allByType = {};
  if (fromRaw) ({ types: allByType, vintage } = readRaw(root, "data/raw/mnre-records.json"));
  else for (const code of Object.keys(dcfg.fetch.types)) allByType[code] = await fetchType(code, null, dcfg.fetch.types[code]);
  const isAI = (r) => String(r.state).trim() === "All India";
  const byType = Object.fromEntries(Object.entries(allByType).map(([k, rows]) => [k, rows.filter(isAI)]));
  if (!fromRaw) writeRaw(root, "data/raw/mnre-records.json", {
    vintage,
    note: "All 5 MNRE renewable-energy types for every state and All India, every month and category served by mnre/getDataByEnergy (no state filter). Values are cumulative installed capacity in MW. Large Hydro reads 0 through Nov 2023, then ~46,910 from Dec 2023: a classification change, disclosed in sources.yml.",
    types: allByType,
  });

  // the data's vintage (writeRaw keeps the old stamp while the body is unchanged), never the run date
  vintage = readRaw(root, "data/raw/mnre-records.json").vintage;

  // continuous monthly axis from the Grand Total (type 5) data
  const totalRows = byType["5"];
  const ymSet = [...new Set(totalRows.map(ym))].sort();
  const axis = monthAxis(ymSet[0], ymSet.at(-1));
  const dates = axis.map((m) => `${m}-01`);
  const metaBase = {
    dossier: "mnre", frequency: "monthly", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: axis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  const data = (m) => axis.map((ymStr) => m.get(ymStr) ?? null);
  // rows -> Map("YYYY-MM" -> value) with a category filter
  const toMap = (rows, catFilter) => {
    const m = new Map();
    for (const r of rows) {
      if (catFilter && r.category && r.category.trim() !== catFilter) continue;
      const v = val(r);
      if (v != null) m.set(ym(r), v);
    }
    return m;
  };
  // interior nulls of each series, declared on the series (CONTRACT-series rule 2)
  const withGaps = (s, note) => {
    const first = s.data.findIndex((v) => v != null);
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = s.data.map((v, i) => (v == null && i > first && i < last ? dates[i] : null)).filter(Boolean);
    if (gaps.length) { s.gaps = gaps; s.gapsNote = note; }
    return s;
  };
  const GAP_NOTE = "MNRE's state table skips this state in these months; the capacity is not published for them, so the months are left empty rather than filled.";
  const mon = (d) => { const [y, m] = d.split("-"); return `${MONTHS[+m - 1]} ${y}`; };
  // ZEROS THAT ARE NOT CAPACITY (datafix, 2026-10-10). Every series here is a cumulative stock:
  // installed capacity never falls to 0 and comes back. MNRE prints 0 for a category it did not
  // report that month (off-grid solar: 1,150.64 MW in March 2021, 0 in April and May, 1,272.49 MW
  // in June, and the published solar total drops by the same amount), and for a category before
  // it entered the All-India table (large hydro until it was counted, off-grid until March 2021,
  // hybrid until April 2022). Both are gaps, never zeros (AGENTS.md rule 2). The entry month is
  // read from the data. A state's leading zeros are kept: a state can have had no capacity yet.
  const notCounted = (s, { leading }) => {
    const nz = s.data.map((v, i) => (v != null && v !== 0 ? i : -1)).filter((i) => i >= 0);
    if (!nz.length) return s;
    const first = nz[0], last = nz.at(-1);
    const interior = s.data.map((v, i) => (v === 0 && i > first && i < last ? i : -1)).filter((i) => i >= 0);
    const lead = leading ? s.data.map((v, i) => (v === 0 && i < first ? i : -1)).filter((i) => i >= 0) : [];
    for (const i of [...interior, ...lead]) s.data[i] = null;
    if (lead.length) s.entersNote = `Not counted in MNRE's table before ${mon(dates[first])}: it prints 0 for those months, which is not a capacity of zero. The series starts when the category enters the table.`;
    if (interior.length) { s.gaps = [...new Set([...(s.gaps ?? []), ...interior.map((i) => dates[i])])].sort(); s.gapsNote = `MNRE prints 0 for ${interior.map((i) => mon(dates[i])).join(", ")} between months with capacity: a cumulative capacity does not vanish and return, so these months were not reported and are left empty.`; }
    return s;
  };
  const stateKey = (st) => st.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  /* ---- mnre-sources.json ---- */
  const breakNote = "CLASSIFICATION BREAK ({LH_ENTRY}): Large Hydro Power (above 25 MW) enters MNRE's table and its Grand Total in {LH_ENTRY}. Before that MNRE prints 0 for it, which means not counted, so the series is empty before then; the entry is a definitional change, not a capacity addition. The Grand Total carries the step. Growth rates are never computed across this seam. Individual sources (Solar, Wind, Small Hydro, Bio) are unaffected by it.";
  const sourcesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; cumulative installed capacity (MW) by source, monthly Jan 2020 to latest. Grand Total is the published type-5 series; Large Hydro is shown separately to expose the 2023 classification break.",
      note: breakNote + " Values are as published (MW). The Grand Total from {LH_ENTRY} onward includes Large Hydro; before that it does not.",
    },
    dates,
    series: {
      solar: { name: "mnre_solar_total", label: "Solar Power", color: "#2E4BD8", data: data(toMap(byType["1"], "Solar Power Total")), unit: "mw" },
      wind: { name: "mnre_wind", label: "Wind Power", color: "#5F6675", data: data(toMap(byType["2"])), unit: "mw" },
      small_hydro: { name: "mnre_small_hydro", label: "Small Hydro Power", color: "#878D99", data: data(toMap(byType["3"], "Small Hydro Power")), unit: "mw" },
      large_hydro: { name: "mnre_large_hydro", label: "Large Hydro Power (from 2023)", color: "#A3A9B4", data: data(toMap(byType["3"], "Large Hydro Power")), unit: "mw" },
      bio: { name: "mnre_bio_total", label: "Bio Power", color: "#C9CED6", data: data(toMap(byType["4"], "Bio Power Total")), unit: "mw" },
      grand_total: { name: "mnre_grand_total", label: "Grand Total (published)", color: "#2E4BD8", data: data(toMap(byType["5"])), unit: "mw" },
    },
  };

  for (const s of Object.values(sourcesBundle.series)) notCounted(s, { leading: true });
  const lhEntry = dates[sourcesBundle.series.large_hydro.data.findIndex((v) => v != null)];
  if (!lhEntry) throw new Error("MNRE: large hydro never enters the table");
  sourcesBundle.series.large_hydro.label = `Large Hydro Power (counted from ${mon(lhEntry)})`;
  delete sourcesBundle.series.large_hydro.entersNote;   // the break note says it
  // The published Grand Total steps up in the month large hydro enters MNRE's table (a change
  // in what the total counts, not growth). Kept as published, with the seam named on the
  // series; beside it a like-for-like series over the whole span, computed by India Atlas:
  // the Grand Total less large hydro (before the entry month the two are the same).
  {
    const G = sourcesBundle.series.grand_total, L = sourcesBundle.series.large_hydro;
    G.label = `Grand Total (published; includes large hydro from ${mon(lhEntry)})`;
    G.seamNote = `MNRE's Grand Total counts large hydro from ${mon(lhEntry)}; the step that month is the change in coverage, not new capacity. For a like-for-like comparison across it, use the Grand Total excluding large hydro.`;
    sourcesBundle.series.grand_total_excl_large_hydro = {
      name: "mnre_grand_total_excl_large_hydro", label: "Grand Total excluding large hydro (like for like across the change)", color: "#5F6675", unit: "mw",
      derived: true, derivedNote: "Computed by India Atlas: MNRE's published Grand Total less its Large Hydro line, so every month counts the same sources.",
      data: G.data.map((v, i) => (v == null ? null : Math.round((v - (L.data[i] ?? 0)) * 100) / 100)),
    };
  }

  /* ---- mnre-solar-categories.json ---- */
  const SOLAR_CATS = [
    ["Ground Mounted Solar Power", "ground_mounted", "Ground Mounted"],
    ["Rooftop Solar Power (including PM Surya Ghar Yojna)", "rooftop", "Rooftop (PM Surya Ghar)"],
    ["Hybrid Solar Component", "hybrid", "Hybrid"],
    ["Off-Grid Solar Power/KUSUM", "off_grid", "Off-Grid / KUSUM"],
  ];
  const solSeries = {};
  SOLAR_CATS.forEach(([cat, key, label], i) => {
    solSeries[key] = {
      name: `mnre_solar_${key}`, label,
      color: key === "ground_mounted" ? "#2E4BD8" : GREYS[i % GREYS.length],
      data: data(toMap(byType["1"], cat.trim())), unit: "mw",
    };
  });
  for (const s of Object.values(solSeries)) notCounted(s, { leading: true });
  const solarBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; cumulative installed solar capacity (MW) by sub-category, monthly. Ground Mounted is utility-scale; Rooftop includes the PM Surya Ghar residential scheme; Hybrid combines solar with other sources; Off-Grid covers KUSUM and standalone pumps.",
      note: breakNote,
    },
    dates, series: solSeries,
  };

  /* ---- mnre-bio-categories.json: All India bio-power by kind (wave 2) ---- */
  const BIO_CATS = [
    ["Biomass Power/Bagasse Cogeneration", "bagasse", "Bagasse cogeneration (sugar mills)"],
    ["Biomass Cogeneration (Non-Bagasse)", "non_bagasse", "Biomass cogeneration, not bagasse"],
    ["Waste to Energy", "waste_to_energy", "Waste to energy, grid-connected"],
    ["Waste to Energy Off-Grid", "waste_to_energy_off_grid", "Waste to energy, off-grid"],
    ["Bio Power Total", "total", "Bio power, total (published)"],
  ];
  const bioSeries = {};
  BIO_CATS.forEach(([cat, key, label], i) => {
    bioSeries[key] = { name: `mnre_bio_${key}`, label, color: key === "bagasse" ? "#2E4BD8" : GREYS[i % GREYS.length],
      data: data(toMap(byType["4"], cat)), unit: "mw" };
  });
  for (const s of Object.values(bioSeries)) notCounted(s, { leading: true });
  const bioBundle = {
    meta: { ...metaBase,
      coverage: "All India; cumulative installed bio-power capacity (MW) by kind, monthly. Bagasse cogeneration burns sugar-cane residue at sugar mills; non-bagasse cogeneration burns other farm and forest residue; waste to energy burns or digests urban and industrial waste.",
      note: "The four kinds sum to the published Bio Power Total (checked in scripts/validate.mjs)." },
    dates, series: bioSeries,
  };

  /* ---- states: one bundle per energy type, a series per state x category ---- */
  // Each table lists every state that MNRE carries in the type's rows (old and new UT names
  // both appear: Dadra and Nagar Haveli and Daman and Diu were merged in January 2020, and
  // MNRE keeps the old names on the rows it published before the merger, plus an "Others"
  // row). Nothing is merged or renamed here.
  const stateBundle = (code, cats, cov, labelOf) => {
    const rows = allByType[code].filter((r) => !isAI(r));
    const states = [...new Set(rows.map((r) => r.state.trim()))].sort();
    const series = {};
    let i = 0;
    for (const st of states) {
      const sr = rows.filter((r) => r.state.trim() === st);
      for (const [cat, ck] of cats) {
        const m = toMap(sr, cat);
        if (!m.size) continue;
        const key = ck ? `${stateKey(st)}__${ck}` : stateKey(st);
        const ser = withGaps({ name: `mnre_${{ 1: "solar", 2: "wind", 3: "hydro", 4: "bio", 5: "total" }[code]}_${key}`, label: labelOf(st, cat), group: st,
          color: GREYS[i++ % GREYS.length], data: data(m), unit: "mw" }, GAP_NOTE);
        // large hydro: a state's 0 before the category entered the table is "not counted"
        if (cat === "Large Hydro Power") ser.data = ser.data.map((v, j) => (v === 0 && dates[j] < lhEntry ? null : v));
        notCounted(ser, { leading: false });
        if (ser.data.every((v) => v == null)) continue;
        series[key] = ser;
      }
    }
    return { meta: { ...metaBase, coverage: cov, note: breakNote }, dates, series };
  };
  const statesBundle = stateBundle("5", [[null, null]], "States/UTs; Grand Total renewable capacity (MW), monthly. Some UTs have negligible or zero RE capacity; interior nulls are disclosed in gaps.", (st) => `Total RE · ${st}`);
  // the state solar bundle keeps its old keys for Solar Power Total (state key alone)
  const stSolarBundle = stateBundle("1", [["Solar Power Total", null], ...SOLAR_CATS.map(([c, k]) => [c, k])],
    "States/UTs; installed solar capacity (MW), monthly: Solar Power Total and its four sub-categories (ground-mounted, rooftop, hybrid, off-grid and KUSUM). Interior nulls disclosed in gaps.",
    (st, cat) => cat === "Solar Power Total" ? `Solar · ${st}` : `Solar, ${SOLAR_CATS.find(([c]) => c === cat)[2].toLowerCase()} · ${st}`);
  const stWindBundle = stateBundle("2", [[null, null]], "States/UTs; installed wind capacity (MW), monthly.", (st) => `Wind · ${st}`);
  const stHydroBundle = stateBundle("3", [["Small Hydro Power", "small_hydro"], ["Large Hydro Power", "large_hydro"]],
    "States/UTs; installed hydro capacity (MW), monthly: small hydro (up to 25 MW a plant) and large hydro (above 25 MW). Large hydro starts in {LH_ENTRY}, when MNRE first counted it (it printed 0 before, which is not a capacity of zero); that is a classification change, not new capacity.",
    (st, cat) => `${cat === "Small Hydro Power" ? "Small hydro" : "Large hydro"} · ${st}`);
  const stBioBundle = stateBundle("4", BIO_CATS.map(([c, k]) => [c, k]),
    "States/UTs; installed bio-power capacity (MW), monthly: the published total and its four kinds (bagasse cogeneration, non-bagasse cogeneration, waste to energy on and off the grid).",
    (st, cat) => `${BIO_CATS.find(([c]) => c === cat)[2]} · ${st}`);

  // the large-hydro entry month and each category's own entry, read from the data, into the notes
  for (const b of [sourcesBundle, solarBundle, bioBundle, statesBundle, stSolarBundle, stWindBundle, stHydroBundle, stBioBundle]) {
    const enters = Object.values(b.series).filter((x) => x.entersNote).map((x) => `${x.label}: ${x.entersNote}`);
    for (const x of Object.values(b.series)) delete x.entersNote;
    b.meta.note = (b.meta.note + (enters.length ? " " + enters.join(" ") : "")).replaceAll("{LH_ENTRY}", mon(lhEntry));
    b.meta.coverage = b.meta.coverage.replaceAll("{LH_ENTRY}", mon(lhEntry));
  }
  if (!sourcesBundle.series.grand_total.data.some((v) => v != null)) throw new Error("MNRE: no grand total data returned");
  for (const [b, n] of [[stWindBundle, 20], [stHydroBundle, 30], [stBioBundle, 60], [stSolarBundle, 100]])
    if (Object.keys(b.series).length < n) throw new Error(`MNRE: state table too small (${Object.keys(b.series).length} series, expected at least ${n})`);
  writeSeries(root, "data/series/mnre-sources.json", sourcesBundle);
  writeSeries(root, "data/series/mnre-solar-categories.json", solarBundle);
  writeSeries(root, "data/series/mnre-bio-categories.json", bioBundle);
  writeSeries(root, "data/series/mnre-states.json", statesBundle);
  writeSeries(root, "data/series/mnre-states-solar.json", stSolarBundle);
  writeSeries(root, "data/series/mnre-states-wind.json", stWindBundle);
  writeSeries(root, "data/series/mnre-states-hydro.json", stHydroBundle);
  writeSeries(root, "data/series/mnre-states-bio.json", stBioBundle);
  return sourcesBundle;
}

/* Catalogue (docs/CONTRACT-coverage.md): mnre/getTypeOfRenewableEnergy and
 * mnre/getFilterByEnergy per type, one cut at a time (a capacity category, or a state):
 *   mnre:<type>:all | :category:<category> | :state:<state> */
import { writeCatalogue, indicatorCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueMnre() {
  const types = ((await mospi("mnre/getTypeOfRenewableEnergy", {})).data ?? []).map((t) => ({ indicator_code: t.type_of_renewable_energy_code, label: t.label }));
  const items = await indicatorCatalogue({ mospi, prefix: "mnre", indicators: types,
    filter: (t) => ["mnre/getFilterByEnergy", { type_of_renewable_energy_code: t.indicator_code }] });
  writeCatalogue("mnre", { source: "Ministry of New and Renewable Energy: installed renewable capacity (via MoSPI eSankhyiki)",
    generator: "scripts/lib/products/mnre.mjs --catalogue",
    note: "From getTypeOfRenewableEnergy and getFilterByEnergy: each energy type x one cut (a capacity category, or a state); monthly from Jan 2020.", items });
}
await catalogueCli(import.meta.url, catalogueMnre);
