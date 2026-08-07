// scripts/lib/products/plfs.mjs — Periodic Labour Force Survey.
// Values are levels in per cent (UR/LFPR/WPR), not growth rates.
// Bundles, never joined across design changes:
//   plfs-monthly.json    — monthly bulletin (rural+urban, CWS, from Apr 2025)
//   plfs-quarterly.json  — quarterly bulletin (urban, CWS, from 2018)
//   plfs-cuts.json       — monthly bulletin by gender × sector
//   plfs-annual.json     — agriculture-year annual (PS+SS and CWS, from 2017-18)
// Rows carry weekly_status null in both bulletins (CWS by definition), so the
// weekly_status_code param is never sent; annual rows do carry it.

import { mospi } from "../mospi.mjs";
import { MONTHS, writeJson, writeRaw, monthAxis, quarterAxis } from "../util.mjs";

// PLFS quarterly rows label calendar quarters by the calendar year they occur
// in: "Jan-Mar" + year 2026 means 2026-01, not 2027-01.
const QUARTER_START = { "Apr-Jun": "04", "Jul-Sep": "07", "Oct-Dec": "10", "Jan-Mar": "01" };
const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];

async function fetchYear(dcfg, freqCfg, indicatorCode, year, extra = {}) {
  const res = await mospi(dcfg.fetch.endpoint, {
    ...freqCfg, ...extra, indicator_code: indicatorCode, year, page: 1, limit: 500,
  });
  return res.data ?? [];
}

// annual rows carry religion / socialGroup / General_Education /
// employee_contract breakdowns alongside the "all" rows — without this
// filter a breakdown row can overwrite the headline value in the Maps
const ALL_DIMS = (r) =>
  (r.religion ?? "all") === "all" && (r.socialGroup ?? "all") === "all" &&
  (r.General_Education ?? "all") === "all" && (r.employee_contract ?? "all") === "all";

export async function buildPlfs(root, dcfg, vintage) {
  const raw = { vintage, unit: "per cent", frequencies: {} };
  const endYear = new Date().getUTCFullYear();
  const dims = dcfg.fetch.dims; // age 15+, person, All India — gender/sector sliced client-side for cuts
  const baseDims = { age_code: dims.age_code, state_code: dims.state_code };

  const IND = dcfg.fetch.indicators; // code -> key (lfpr, wpr, ur)

  /* ---- monthly bulletin (from Apr 2025): full gender × sector grid ----
     (the API defaults to sector "rural + urban" unless sector_code is sent,
     so the grid is fetched per gender_code × sector_code) */
  const monthlyRows = {}; // key -> rows
  const GENDERS = { male: 1, female: 2, person: 3 };
  const SECTOR_CODES = { rural: 1, urban: 2, "rural + urban": 3 };
  for (const [code, key] of Object.entries(IND)) {
    const rows = [];
    for (const g of Object.values(GENDERS)) {
      for (const s of Object.values(SECTOR_CODES)) {
        for (let year = 2025; year <= endYear; year++) {
          rows.push(...await fetchYear(dcfg, dcfg.fetch.monthly, code, year, { ...baseDims, gender_code: g, sector_code: s }));
        }
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    monthlyRows[key] = rows;
    raw.frequencies[`monthly_${key}`] = rows;
  }
  const mIndex = {}; // "key|gender|sector" -> Map
  for (const [key, rows] of Object.entries(monthlyRows)) {
    for (const r of rows) {
      if (r.AgeGroup !== "15 years and above") continue;
      const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
      if (m === "00") continue;
      const v = parseFloat(r.value);
      if (!Number.isFinite(v)) continue;
      (mIndex[`${key}|${r.gender}|${r.sector}`] ??= new Map()).set(`${r.year}-${m}`, v);
    }
  }
  const mAnchor = mIndex["ur|person|rural + urban"];
  if (!mAnchor?.size) throw new Error("PLFS: no monthly data returned");
  const mMonths = [...mAnchor.keys()].sort();
  const mAxis = monthAxis(mMonths[0], mMonths.at(-1));
  const mDates = mAxis.map((ym) => `${ym}-01`);
  const metaM = {
    dossier: "plfs", frequency: "monthly", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    latestPeriod: mMonths.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  const pick = (key, gender, sector) => mAxis.map((ym) => mIndex[`${key}|${gender}|${sector}`]?.get(ym) ?? null);
  const monthlyBundle = {
    meta: { ...metaM, coverage: "All India, 15 years and above, person, rural + urban, CWS" },
    dates: mDates,
    series: {
      ur: { name: "unemployment_rate_pct", label: "Unemployment", color: "#BE3E26", data: pick("ur", "person", "rural + urban") },
      lfpr: { name: "lfpr_pct", label: "Participation", color: "#5B564B", data: pick("lfpr", "person", "rural + urban") },
      wpr: { name: "wpr_pct", label: "Workers", color: "#A8A293", data: pick("wpr", "person", "rural + urban") },
    },
  };
  const cutCombos = [];
  for (const g of ["male", "female"]) for (const s of ["rural", "urban"]) cutCombos.push([g, s]);
  const cutsSeries = {};
  cutCombos.forEach(([g, s], i) => {
    for (const key of Object.values(IND)) {
      cutsSeries[`${key}_${g}_${s}`] = {
        name: `plfs_${key}_${g}_${s}_pct`, label: `${key.toUpperCase()} · ${g} · ${s}`, color: GREYS[i % GREYS.length],
        data: pick(key, g, s),
      };
    }
  });
  const cutsBundle = {
    meta: { ...metaM, coverage: "All India, 15 years and above, CWS; gender × sector cuts of the monthly bulletin" },
    dates: mDates, series: cutsSeries,
  };

  /* ---- quarterly bulletin: urban, CWS, from 2018 ---- */
  const quarterly = {};
  for (const [code, key] of Object.entries(IND)) {
    quarterly[key] = new Map();
    const rows = [];
    for (let year = 2018; year <= endYear; year++) {
      rows.push(...await fetchYear(dcfg, dcfg.fetch.quarterly, code, year, { ...baseDims, gender_code: dims.gender_code }));
      if (year < endYear) await new Promise((r) => setTimeout(r, 200));
    }
    raw.frequencies[`quarterly_${key}`] = rows;
    for (const r of rows) {
      if (r.sector !== "urban" || r.AgeGroup !== "15 years and above") continue;
      const qs = QUARTER_START[r.quarter];
      if (!qs) continue;
      const v = parseFloat(r.value);
      if (Number.isFinite(v)) quarterly[key].set(`${r.year}-${qs}`, v);
    }
    process.stdout.write(`plfs quarterly ${key}: ${quarterly[key].size} quarters\n`);
  }
  const qMonths = [...quarterly.ur.keys()].sort();
  if (!qMonths.length) throw new Error("PLFS: no quarterly data returned");
  // eSankhyiki carries a stray duplicate of the COVID quarter mislabeled
  // Apr-Jun 2019: urban UR 21.6 where the published figure is 8.9. The
  // sibling series expose it — UR ≡ 1 − WPR/LFPR, and the quarter's own
  // WPR/LFPR imply 8.8. Quarantine any UR cell that contradicts its own
  // WPR/LFPR by more than rounding error; rows stay in raw.
  for (const ym of [...quarterly.ur.keys()]) {
    const lf = quarterly.lfpr.get(ym), wp = quarterly.wpr.get(ym), ur = quarterly.ur.get(ym);
    if (lf == null || wp == null || ur == null) continue;
    const implied = 100 * (1 - wp / lf);
    if (Math.abs(ur - implied) > 2) {
      quarterly.ur.delete(ym);
      process.stdout.write(`plfs quarterly ur: quarantined ${ym} (published ${ur}, identity implies ${implied.toFixed(1)})\n`);
    }
  }
  const qMonthsClean = [...quarterly.ur.keys()].sort();
  const qAxis = quarterAxis(qMonthsClean[0], qMonthsClean[qMonthsClean.length - 1]);
  // interior nulls are real publication gaps (e.g. Jan–Mar 2025, the design
  // transition quarter, was never published) — disclose them in meta.gaps;
  // validate.mjs allows nulls only at these dates.
  const gaps = qAxis.filter((ym) =>
    Object.values(quarterly).some((m) => m.get(ym) == null));
  const quarterlyBundle = {
    meta: {
      dossier: "plfs", frequency: "quarterly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      latestPeriod: qMonths[qMonths.length - 1],
      releaseDate: null,
      coverage: "All India, 15 years and above, person, urban, CWS",
      gaps: gaps.map((ym) => `${ym}-01`),
      gapsNote: gaps.length ? "Quarters never published in this bulletin (Jan–Mar 2025: PLFS design transition), plus one quarantined source cell (Apr–Jun 2019 — a mislabeled duplicate of the COVID quarter; the published figure is 8.9)." : undefined,
      revisionPolicy: dcfg.revision_policy,
    },
    dates: qAxis.map((ym) => `${ym}-01`),
    series: {
      ur: { name: "unemployment_rate_urban_pct", label: "Unemployment", color: "#BE3E26", data: qAxis.map((ym) => quarterly.ur.get(ym) ?? null) },
      lfpr: { name: "lfpr_urban_pct", label: "Participation", color: "#5B564B", data: qAxis.map((ym) => quarterly.lfpr.get(ym) ?? null) },
      wpr: { name: "wpr_urban_pct", label: "Workers", color: "#A8A293", data: qAxis.map((ym) => quarterly.wpr.get(ym) ?? null) },
    },
  };

  /* ---- annual: agriculture years (Jul–Jun), PS+SS and CWS ---- */
  const annual = {}; // "key|weekly_status" -> Map("YYYY-07" -> value)
  const agriYears = [];
  for (let y = 2017; y < endYear; y++) agriYears.push(`${y}-${String(y + 1).slice(2)}`);
  for (const [code, key] of Object.entries(IND)) {
    const rows = [];
    for (const y of agriYears) {
      rows.push(...await fetchYear(dcfg, { frequency_code: 1 }, code, y, { ...baseDims, gender_code: dims.gender_code, year_type_code: 1 }));
      await new Promise((r) => setTimeout(r, 150));
    }
    raw.frequencies[`annual_${key}`] = rows;
    for (const r of rows) {
      if (r.sector !== "rural + urban" || r.AgeGroup !== "15 years and above" || r.gender !== "person") continue;
      if (!r.weekly_status || !ALL_DIMS(r)) continue;
      const v = parseFloat(r.value);
      if (!Number.isFinite(v)) continue;
      const y1 = String(r.year).slice(0, 4);
      (annual[`${key}|${r.weekly_status}`] ??= new Map()).set(`${y1}-07`, v);
    }
  }
  const aAnchor = annual["ur|CWS"];
  if (!aAnchor?.size) throw new Error("PLFS: no annual data returned");
  const aMonths = [...aAnchor.keys()].sort();
  const aAxis = [];
  for (let y = Number(aMonths[0].slice(0, 4)); y <= Number(aMonths.at(-1).slice(0, 4)); y++) aAxis.push(`${y}-07`);
  const aSeries = {};
  ["CWS", "PS+SS"].forEach((ws, wi) => {
    for (const key of Object.values(IND)) {
      if (!annual[`${key}|${ws}`]?.size) continue;
      aSeries[`${key}_${ws === "CWS" ? "cws" : "psss"}`] = {
        name: `plfs_${key}_annual_${ws === "CWS" ? "cws" : "psss"}_pct`, label: `${key.toUpperCase()} · ${ws}`, color: wi === 0 ? "#BE3E26" : "#5B564B",
        data: aAxis.map((ym) => annual[`${key}|${ws}`].get(ym) ?? null),
      };
    }
  });
  const annualBundle = {
    meta: {
      dossier: "plfs", frequency: "annual", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      latestPeriod: aMonths.at(-1), releaseDate: null,
      coverage: "All India, 15 years and above, person, rural + urban; agriculture years (Jul–Jun) plotted at July",
      revisionPolicy: dcfg.revision_policy,
    },
    dates: aAxis.map((ym) => `${ym}-01`),
    series: aSeries,
  };

  /* ---- annual, states: the same stream without state_code carries every
     state/UT — full grid archived to raw; the curated bundle is UR by state
     (the comparison the annual bulletin is used for) ---- */
  const stAnnual = {}; // "key|weekly_status|state" -> Map("YYYY-07" -> value)
  for (const [code, key] of Object.entries(IND)) {
    const rows = [];
    for (const y of agriYears) {
      let page = 1;
      for (;;) {
        const res = await mospi(dcfg.fetch.endpoint, {
          frequency_code: 1, indicator_code: code, year: y,
          age_code: dims.age_code, gender_code: dims.gender_code, year_type_code: 1, page, limit: 500,
        });
        const batch = res.data ?? [];
        rows.push(...batch);
        if (page >= (res.meta_data?.totalPages ?? 1)) break;
        page++;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    raw.frequencies[`annual_states_${key}`] = rows;
    for (const r of rows) {
      if (r.state === "All India" || r.sector !== "rural + urban" || r.AgeGroup !== "15 years and above" || r.gender !== "person") continue;
      if (!r.weekly_status || r.weekly_status === "all" || !ALL_DIMS(r)) continue;
      const v = parseFloat(r.value);
      if (!Number.isFinite(v)) continue;
      const sk = String(r.state).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const y1 = String(r.year).slice(0, 4);
      (stAnnual[`${key}|${r.weekly_status}|${sk}`] ??= new Map()).set(`${y1}-07`, v);
    }
  }
  const stUrKeys = Object.keys(stAnnual).filter((k) => k.startsWith("ur|"));
  const stMonths = [...new Set(stUrKeys.flatMap((k) => [...stAnnual[k].keys()]))].sort();
  let statesBundle = null;
  if (stMonths.length) {
    const stAxis = [];
    for (let y = Number(stMonths[0].slice(0, 4)); y <= Number(stMonths.at(-1).slice(0, 4)); y++) stAxis.push(`${y}-07`);
    const stSeries = {};
    stUrKeys.sort().forEach((k, i) => {
      const [, ws, sk] = k.split("|");
      const sfx = ws === "CWS" ? "cws" : "psss";
      stSeries[`${sk}_${sfx}`] = {
        name: `plfs_ur_${sk}_annual_${sfx}_pct`, label: `${sk.replace(/_/g, " ")} · ${ws}`,
        color: GREYS[i % GREYS.length],
        data: stAxis.map((ym) => stAnnual[k].get(ym) ?? null),
      };
    });
    const stGaps = stAxis.filter((ym) => stUrKeys.some((k) => {
      const m = stAnnual[k];
      const months = [...m.keys()].sort();
      return ym > months[0] && ym < months.at(-1) && m.get(ym) == null;
    }));
    statesBundle = {
      meta: {
        dossier: "plfs", frequency: "annual", base: dcfg.base,
        source: dcfg.source_agency, vintage, mock: false,
        latestPeriod: stMonths.at(-1), releaseDate: null,
        coverage: "States/UTs, 15 years and above, person, rural + urban; unemployment rate, agriculture years plotted at July",
        gaps: stGaps.length ? stGaps.map((ym) => `${ym}-01`) : undefined,
        revisionPolicy: dcfg.revision_policy,
      },
      dates: stAxis.map((ym) => `${ym}-01`),
      series: stSeries,
    };
  }

  writeRaw(root, "data/raw/plfs-levels.json", raw);
  writeJson(root, "data/series/plfs-monthly.json", monthlyBundle);
  writeJson(root, "data/series/plfs-quarterly.json", quarterlyBundle);
  writeJson(root, "data/series/plfs-cuts.json", cutsBundle);
  writeJson(root, "data/series/plfs-annual.json", annualBundle);
  if (statesBundle) writeJson(root, "data/series/plfs-states.json", statesBundle);
  return monthlyBundle;
}
