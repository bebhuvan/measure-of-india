// scripts/lib/products/mnre.mjs — Ministry of New and Renewable Energy.
//
// Five renewable energy types, each a cumulative INSTALLED CAPACITY stock in
// MW (not generation): Solar (1), Wind (2), Hydro (3), Bio (4), Total (5).
// Monthly from Jan 2020 to the latest month served. state_code 36 = All India.
//
// CLASSIFICATION BREAK (Dec 2023): Large Hydro reads 0 MW through Nov 2023,
// then jumps to ~46,910 MW in Dec 2023 — a definitional change, not capacity.
// The published Grand Total carries the step. The dossier annotates the break
// as a seam; growth is never computed across it. Individual sources are clean.
//
// Bundles baked:
//   mnre-sources.json          — All-India monthly 2020-2026: Solar Total,
//                                Wind, Small Hydro, Large Hydro, Bio Total,
//                                Grand Total (published, carries the break)
//   mnre-solar-categories.json — All-India monthly: Ground Mounted, Rooftop
//                                (PM Surya Ghar), Hybrid, Off-Grid/KUSUM
//   mnre-states.json           — state-wise Grand Total, latest month + the
//                                top-5 states' full monthly history

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw, monthAxis } from "../util.mjs";

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];
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
  return rows;
}

export async function buildMnre(root, dcfg, vintage) {
  const aiState = dcfg.fetch.state_all_india;
  const byType = {};
  for (const code of Object.keys(dcfg.fetch.types)) byType[code] = await fetchType(code, aiState, dcfg.fetch.types[code]);
  writeRaw(root, "data/raw/mnre-records.json", {
    vintage,
    note: "All 5 MNRE renewable-energy types, All India (state_code 36), all months and categories served by mnre/getDataByEnergy. Values are cumulative installed capacity in MW. Large Hydro reads 0 through Dec 2022, then ~46,910 from Jan 2023 — a classification change, disclosed in sources.yml.",
    types: byType,
  });

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

  /* ---- mnre-sources.json ---- */
  const breakNote = "CLASSIFICATION BREAK (Dec 2023): Large Hydro Power (>25 MW) was folded into the renewable-energy total starting Dec 2023. Before that it reads 0 MW; after, ~46,910 MW — a definitional change, not a capacity addition. The Grand Total carries the step (+48 GW in one month: 132.7 → 180.8 GW). Growth rates are never computed across this seam. Individual sources (Solar, Wind, Small Hydro, Bio) are unaffected.";
  const sourcesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; cumulative installed capacity (MW) by source, monthly Jan 2020 to latest. Grand Total is the published type-5 series; Large Hydro is shown separately to expose the 2023 classification break.",
      note: breakNote + " Values are as published (MW). The Grand Total from Jan 2023 onward includes Large Hydro; before that it does not.",
    },
    dates,
    series: {
      solar: { name: "mnre_solar_total", label: "Solar Power", color: "#BE3E26", data: data(toMap(byType["1"], "Solar Power Total")), unit: "mw" },
      wind: { name: "mnre_wind", label: "Wind Power", color: "#5B564B", data: data(toMap(byType["2"])), unit: "mw" },
      small_hydro: { name: "mnre_small_hydro", label: "Small Hydro Power", color: "#8A857A", data: data(toMap(byType["3"], "Small Hydro Power")), unit: "mw" },
      large_hydro: { name: "mnre_large_hydro", label: "Large Hydro Power (from 2023)", color: "#A8A293", data: data(toMap(byType["3"], "Large Hydro Power")), unit: "mw" },
      bio: { name: "mnre_bio_total", label: "Bio Power", color: "#C6C0B0", data: data(toMap(byType["4"], "Bio Power Total")), unit: "mw" },
      grand_total: { name: "mnre_grand_total", label: "Grand Total (published)", color: "#BE3E26", data: data(toMap(byType["5"])), unit: "mw" },
    },
  };

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
      color: key === "ground_mounted" ? "#BE3E26" : GREYS[i % GREYS.length],
      data: data(toMap(byType["1"], cat.trim())), unit: "mw",
    };
  });
  const solarBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; cumulative installed solar capacity (MW) by sub-category, monthly. Ground Mounted is utility-scale; Rooftop includes the PM Surya Ghar residential scheme; Hybrid combines solar with other sources; Off-Grid covers KUSUM and standalone pumps.",
      note: breakNote,
    },
    dates, series: solSeries,
  };

  /* ---- mnre-states.json ---- */
  // state-wise Grand Total: fetch per year for all states, keep latest month
  const stByType = {};
  for (const yr of [...new Set(totalRows.map((r) => r.year))].sort()) {
    const rows = await fetchType(5, null, `states-${yr}`);
    stByType[yr] = rows.filter((r) => r.state !== "All India");
  }
  // latest month overall
  const latestYM = axis.at(-1);
  const latestYear = Number(latestYM.slice(0, 4));
  // for each state, build the full monthly history of Grand Total
  const stSeries = {};
  let si = 0;
  const allStateRows = Object.values(stByType).flat();
  const stateNames = [...new Set(allStateRows.map((r) => r.state))].sort();
  for (const st of stateNames) {
    const m = new Map();
    for (const r of allStateRows.filter((r) => r.state === st)) {
      const v = val(r);
      if (v != null) m.set(ym(r), v);
    }
    if (!m.size) continue;
    const sk = st.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    stSeries[sk] = {
      name: `mnre_total_${sk}`, label: `Total RE · ${st}`,
      color: GREYS[si++ % GREYS.length], data: data(m), unit: "mw",
    };
  }
  const statesBundle = {
    meta: {
      ...metaBase,
      coverage: "States/UTs; Grand Total renewable capacity (MW), monthly. Some UTs have negligible or zero RE capacity; interior nulls are disclosed in gaps.",
      note: breakNote,
      gaps: [...new Set(Object.values(stSeries).flatMap((s) => {
        const first = s.data.findIndex((v) => v != null), last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
        return s.data.map((v, i) => (v === null && i > first && i < last ? dates[i] : null)).filter(Boolean);
      }))].sort(),
    },
    dates, series: stSeries,
  };

  // ---- state-wise solar (type 1, "Solar Power Total") for all states ----
  const stSolarByYear = {};
  for (const yr of [...new Set(totalRows.map((r) => r.year))].sort()) {
    const rows = await fetchType(1, null, `solar-states-${yr}`);
    stSolarByYear[yr] = rows.filter((r) => r.state !== "All India" && r.category && r.category.trim() === "Solar Power Total");
  }
  const allSolarStateRows = Object.values(stSolarByYear).flat();
  const stSolarSeries = {};
  let ssi = 0;
  for (const st of [...new Set(allSolarStateRows.map((r) => r.state))].sort()) {
    const m = new Map();
    for (const r of allSolarStateRows.filter((r) => r.state === st)) {
      const v = val(r);
      if (v != null) m.set(ym(r), v);
    }
    if (!m.size) continue;
    const sk = st.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    stSolarSeries[sk] = {
      name: `mnre_solar_${sk}`, label: `Solar · ${st}`,
      color: GREYS[ssi++ % GREYS.length], data: data(m), unit: "mw",
    };
  }
  const stSolarBundle = {
    meta: {
      ...metaBase,
      coverage: "States/UTs; Solar Power Total installed capacity (MW), monthly. Interior nulls disclosed in gaps.",
      note: breakNote,
      gaps: [...new Set(Object.values(stSolarSeries).flatMap((s) => {
        const first = s.data.findIndex((v) => v != null), last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
        return s.data.map((v, i) => (v === null && i > first && i < last ? dates[i] : null)).filter(Boolean);
      }))].sort(),
    },
    dates, series: stSolarSeries,
  };

  if (!sourcesBundle.series.grand_total.data.some((v) => v != null)) throw new Error("MNRE: no grand total data returned");
  writeSeries(root, "data/series/mnre-sources.json", sourcesBundle);
  writeSeries(root, "data/series/mnre-solar-categories.json", solarBundle);
  writeSeries(root, "data/series/mnre-states.json", statesBundle);
  writeSeries(root, "data/series/mnre-states-solar.json", stSolarBundle);
  return sourcesBundle;
}
