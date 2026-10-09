// scripts/lib/products/plfs.mjs — Periodic Labour Force Survey.
// Values are levels in per cent (UR/LFPR/WPR), not growth rates.
// Bundles, never joined across design changes:
//   plfs-monthly.json    — monthly bulletin (rural+urban, CWS, from Apr 2025)
//   plfs-quarterly.json  — quarterly bulletin (urban, CWS, from 2018)
//   plfs-cuts.json       — monthly bulletin by gender × sector
//   plfs-annual.json     — agriculture-year annual (PS+SS and CWS, from 2017-18)
//   plfs-status.json     — annual reports: distribution of workers by broad
//                          status in employment and by broad industry
//   plfs-earnings.json   — annual reports: earnings by worker status
//                          (regular ₹/month, casual ₹/day, self-emp ₹/30 days),
//                          quarterly grain inside each agriculture year
//   plfs-education.json  — annual reports: UR by general education level,
//                          plus the 15–29 age cut
// Rows carry weekly_status null in both bulletins (CWS by definition), so the
// weekly_status_code param is never sent; annual rows do carry it.

import { mospi, mospiAll } from "../mospi.mjs";
import { MONTHS, writeSeries, writeRaw, monthAxis, quarterAxis } from "../util.mjs";

// PLFS quarterly rows label calendar quarters by the calendar year they occur
// in: "Jan-Mar" + year 2026 means 2026-01, not 2027-01.
const QUARTER_START = { "Apr-Jun": "04", "Jul-Sep": "07", "Oct-Dec": "10", "Jan-Mar": "01" };
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];

async function fetchYear(dcfg, freqCfg, indicatorCode, year, extra = {}) {
  return mospiAll(dcfg.fetch.endpoint, { ...freqCfg, ...extra, indicator_code: indicatorCode, year });
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
    geo: dcfg.geo ?? "IND",
    latestPeriod: mMonths.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  const pick = (key, gender, sector) => mAxis.map((ym) => mIndex[`${key}|${gender}|${sector}`]?.get(ym) ?? null);
  const monthlyBundle = {
    meta: { ...metaM, coverage: "All India, 15 years and above, person, rural + urban, CWS" },
    dates: mDates,
    series: {
      ur: { name: "unemployment_rate_pct", label: "Unemployment", color: "#2E4BD8", data: pick("ur", "person", "rural + urban") },
      lfpr: { name: "lfpr_pct", label: "Participation", color: "#5F6675", data: pick("lfpr", "person", "rural + urban") },
      wpr: { name: "wpr_pct", label: "Workers", color: "#A3A9B4", data: pick("wpr", "person", "rural + urban") },
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
  // transition quarter, was never published) — disclose them per series in gaps;
  // validate.mjs allows nulls only at these dates. writeSeries moves the
  // bundle-level union onto the series automatically.
  const gaps = qAxis.filter((ym) =>
    Object.values(quarterly).some((m) => m.get(ym) == null));
  const quarterlyBundle = {
    meta: {
      dossier: "plfs", frequency: "quarterly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: qMonths[qMonths.length - 1],
      releaseDate: null,
      coverage: "All India, 15 years and above, person, urban, CWS",
      gaps: gaps.map((ym) => `${ym}-01`),
      gapsNote: gaps.length ? "Quarters never published in this bulletin (Jan–Mar 2025: PLFS design transition), plus one quarantined source cell (Apr–Jun 2019 — a mislabeled duplicate of the COVID quarter; the published figure is 8.9)." : undefined,
      revisionPolicy: dcfg.revision_policy,
    },
    dates: qAxis.map((ym) => `${ym}-01`),
    series: {
      ur: { name: "unemployment_rate_urban_pct", label: "Unemployment", color: "#2E4BD8", data: qAxis.map((ym) => quarterly.ur.get(ym) ?? null) },
      lfpr: { name: "lfpr_urban_pct", label: "Participation", color: "#5F6675", data: qAxis.map((ym) => quarterly.lfpr.get(ym) ?? null) },
      wpr: { name: "wpr_urban_pct", label: "Workers", color: "#A3A9B4", data: qAxis.map((ym) => quarterly.wpr.get(ym) ?? null) },
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
        name: `plfs_${key}_annual_${ws === "CWS" ? "cws" : "psss"}_pct`, label: `${key.toUpperCase()} · ${ws}`, color: wi === 0 ? "#2E4BD8" : "#5F6675",
        data: aAxis.map((ym) => annual[`${key}|${ws}`].get(ym) ?? null),
      };
    }
  });
  const annualBundle = {
    meta: {
      dossier: "plfs", frequency: "annual", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
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
        geo: dcfg.geo ?? "IND",
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
  writeSeries(root, "data/series/plfs-monthly.json", monthlyBundle);
  writeSeries(root, "data/series/plfs-quarterly.json", quarterlyBundle);
  writeSeries(root, "data/series/plfs-cuts.json", cutsBundle);
  writeSeries(root, "data/series/plfs-annual.json", annualBundle);
  if (statesBundle) writeSeries(root, "data/series/plfs-states.json", statesBundle);
  await buildPlfsExtras(root, dcfg, vintage, agriYears);
  return monthlyBundle;
}

/* =========================================================================
 * Annual-report extras: worker distribution (indicator 4), earnings by
 * worker status (indicators 6/7/8) and UR by education / youth age cut
 * (indicator 3 with education_code / age_code 2). All from the annual PLFS
 * reports (agriculture years) — one instrument, never spliced with the
 * bulletins. Raw rows land in data/raw/plfs-extras.json.
 *
 * Server quirks found by probing (kept out of the request params):
 *  - indicator 4 rejects age_code / gender_code / sector_code (0 rows);
 *    fetched unfiltered per year and filtered client-side. It serves a
 *    single population per cell (no duplicate cells), matching the
 *    published 15+ figures (58.4 / 21.7 / 19.8 in 2023-24).
 *  - indicator 5 (employment conditions) 500s on every getData combination
 *    tried — listed by getIndicatorList but not fetchable; skipped.
 *  - indicators 6/8: the 2017-18 "rural + urban" cells contradict their own
 *    rural/urban siblings — the implied urban worker weight is 0.85 (regular)
 *    and 0.55 (self-emp) against a stable 0.53-0.62 / 0.19-0.25 in every
 *    later year. Those cells are quarantined from the curated bundle
 *    (kept in raw), same discipline as the Apr–Jun 2019 quarterly UR cell.
 * ========================================================================= */

const STATUS_KEYS = {
  "1.self-employed: own account worker, employer": "se_own_account",
  "2.self-employed: helper in household enterprise": "se_helper",
  "3.all self employed": "self_employed",
  "4.regular wage/salary": "regular",
  "5.casual labour": "casual",
};
const INDUSTRY_KEYS = {
  "primary sector (Div. 01-03 of NIC 2008)": "primary",
  "secondary sector (Div. 05-43 of NIC 2008)": "secondary",
  "tertiary sector (Div. 45-99 of NIC 2008)": "tertiary",
};
const EDU_KEYS = {
  "1.not literate": "not_literate",
  "2.literate & upto primary": "up_to_primary",
  "3.middle": "middle",
  "4.secondary": "secondary",
  "5.higher secondary": "higher_secondary",
  "6.diploma/ certificate course": "diploma",
  "7.graduate": "graduate",
  "8.post graduate & above": "postgraduate",
  "9.secondary & above": "secondary_above",
};
const QTR_START_IN_AGRI = { "Jul-Sep": [0, "07"], "Oct-Dec": [0, "10"], "Jan-Mar": [1, "01"], "Apr-Jun": [1, "04"] };
const XGREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];

async function pageAll(endpoint, params) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi(endpoint, { ...params, page, limit: 500 });
    rows.push(...(res.data ?? []));
    if (page >= (res.meta_data?.totalPages ?? 1)) break;
    page++;
    await new Promise((r) => setTimeout(r, 150));
  }
  return rows;
}

export async function buildPlfsExtras(root, dcfg, vintage, agriYears) {
  const ep = dcfg.fetch.endpoint;
  const raw = { vintage, indicators: {} };
  const meta0 = (frequency, coverage, extra = {}) => ({
    dossier: "plfs", frequency, base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    releaseDate: null, coverage, revisionPolicy: dcfg.revision_policy, ...extra,
  });

  /* ---- indicator 4: percentage distribution of workers ---- */
  const distRows = [];
  for (const y of agriYears) {
    distRows.push(...await pageAll(ep, { indicator_code: 4, frequency_code: 1, year: y, year_type_code: 1, state_code: 99 }));
    await new Promise((r) => setTimeout(r, 150));
  }
  raw.indicators.distribution = distRows;
  // an ABSENT dimension counts as "all": the API dropped employee_contract
  // from indicator 4 rows by 2026-10 (checked live 2026-10-09), and a strict
  // === "all" then rejected every row
  const isAll = (v, all = "all") => v == null || v === all;
  const allDims4 = (r) =>
    isAll(r.enterprise_size) && isAll(r.enterprise_type) &&
    isAll(r.industry_section, "All") && isAll(r.nco_division) &&
    isAll(r.nic_group) && isAll(r.employee_contract) &&
    isAll(r.quarter) && r.state === "All India";
  const stMaps = {}; // "statusKey|ws|gender|sector" -> Map("YYYY-07" -> v)
  const indMaps = {}; // "industryKey|ws|gender|sector" -> Map
  for (const r of distRows) {
    if (!allDims4(r)) continue;
    const v = parseFloat(r.value);
    if (!Number.isFinite(v)) continue;
    const y1 = String(r.year).slice(0, 4);
    const sKey = STATUS_KEYS[r.broad_status_employment];
    if (sKey && r.broad_industry_work === "all")
      (stMaps[`${sKey}|${r.weekly_status}|${r.gender}|${r.sector}`] ??= new Map()).set(`${y1}-07`, v);
    const iKey = INDUSTRY_KEYS[r.broad_industry_work];
    if (iKey && r.broad_status_employment === "all")
      (indMaps[`${iKey}|${r.weekly_status}|${r.gender}|${r.sector}`] ??= new Map()).set(`${y1}-07`, v);
  }
  const sAnchor = stMaps["self_employed|PS+SS|person|rural + urban"];
  if (!sAnchor?.size) throw new Error("PLFS extras: no status-distribution data returned");
  const stYears = [...sAnchor.keys()].sort();
  const stAxis = [];
  for (let y = Number(stYears[0].slice(0, 4)); y <= Number(stYears.at(-1).slice(0, 4)); y++) stAxis.push(`${y}-07`);
  // industry shares at person/rural+urban are served on one weekly status
  // only — prefer PS+SS if complete, else CWS (2023-24 probe: CWS only)
  const indWs = ["PS+SS", "CWS"].find((ws) =>
    Object.values(INDUSTRY_KEYS).every((k) => stAxis.every((ym) => indMaps[`${k}|${ws}|person|rural + urban`]?.get(ym) != null)));
  if (!indWs) throw new Error("PLFS extras: no complete industry-shares status found");
  const statusSeries = {};
  const addStatus = (id, mapKey, label, color) => {
    const m = stMaps[mapKey];
    if (!m?.size) throw new Error(`PLFS extras: missing status series ${mapKey}`);
    statusSeries[id] = { name: `plfs_workers_share_${id}_pct`, label, color, data: stAxis.map((ym) => m.get(ym) ?? null) };
  };
  addStatus("self_employed_person", "self_employed|PS+SS|person|rural + urban", "Self-employed", "#2E4BD8");
  addStatus("regular_person", "regular|PS+SS|person|rural + urban", "Regular wage/salary", "#5F6675");
  addStatus("casual_person", "casual|PS+SS|person|rural + urban", "Casual labour", "#A3A9B4");
  addStatus("se_own_account_person", "se_own_account|PS+SS|person|rural + urban", "Own-account & employers", "#878D99");
  addStatus("se_helper_person", "se_helper|PS+SS|person|rural + urban", "Household-enterprise helpers", "#C9CED6");
  ["male", "female"].forEach((g, gi) => {
    for (const k of ["self_employed", "regular", "casual"])
      addStatus(`${k}_${g}`, `${k}|PS+SS|${g}|rural + urban`, `${k.replace(/_/g, " ")} · ${g}`, XGREYS[gi * 2]);
  });
  Object.entries(INDUSTRY_KEYS).forEach(([, k], i) => {
    const m = indMaps[`${k}|${indWs}|person|rural + urban`];
    statusSeries[`industry_${k}_person`] = {
      name: `plfs_workers_share_industry_${k}_pct`,
      label: { primary: "Agriculture & allied", secondary: "Industry & construction", tertiary: "Services" }[k] + ` · ${indWs}`,
      color: ["#2E4BD8", "#5F6675", "#A3A9B4"][i],
      data: stAxis.map((ym) => m.get(ym) ?? null),
    };
  });
  const statusBundle = {
    meta: meta0("annual",
      "All India, 15 years and above, rural + urban; share of workers by broad status in employment (usual status, PS+SS) and by broad industry (" + indWs + "); annual PLFS reports, agriculture years (Jul–Jun) plotted at July",
      {
        latestPeriod: stYears.at(-1),
        note: "Composition identities hold as published: self-employed + regular + casual = 100 per gender; own-account + helpers = self-employed; primary + secondary + tertiary = 100. The API serves a single population for this indicator (its age filter returns no rows); values match the published 15+ statements.",
      }),
    dates: stAxis.map((ym) => `${ym}-01`),
    series: statusSeries,
  };

  /* ---- indicators 6/7/8: earnings by worker status ---- */
  const EARN = { regular: 6, casual: 7, self_employed: 8 };
  const earnMaps = {}; // "key|gender" -> Map("YYYY-MM" -> v), rural+urban only
  for (const [key, code] of Object.entries(EARN)) {
    const rows = [];
    for (const y of agriYears) {
      rows.push(...await pageAll(ep, { indicator_code: code, frequency_code: 1, year: y, year_type_code: 1, state_code: 99 }));
      await new Promise((r) => setTimeout(r, 150));
    }
    // calendar-year rows (new-design annual averages) archived raw, not curated
    const calRows = [];
    for (const cy of [2022, 2023, 2024, 2025, 2026]) {
      calRows.push(...await pageAll(ep, { indicator_code: code, frequency_code: 1, year: cy, year_type_code: 2, state_code: 99 }));
    }
    raw.indicators[`earnings_${key}`] = rows;
    raw.indicators[`earnings_${key}_calendar`] = calRows;
    for (const r of rows) {
      if (r.state !== "All India" || r.sector !== "rural + urban") continue;
      // quarantine: 2017-18 rural+urban aggregates for regular & self-employed
      // contradict their own rural/urban siblings (see header note)
      if (key !== "casual" && String(r.year) === "2017-18") continue;
      const q = QTR_START_IN_AGRI[r.quarter];
      if (!q) continue;
      const v = parseFloat(r.value);
      if (!Number.isFinite(v)) continue;
      const y1 = Number(String(r.year).slice(0, 4)) + q[0];
      (earnMaps[`${key}|${r.gender}`] ??= new Map()).set(`${y1}-${q[1]}`, v);
    }
  }
  const eAnchor = earnMaps["casual|person"];
  if (!eAnchor?.size) throw new Error("PLFS extras: no earnings data returned");
  const eMonths = [...new Set(Object.values(earnMaps).flatMap((m) => [...m.keys()]))].sort();
  const eAxis = quarterAxis(eMonths[0], eMonths.at(-1));
  const UNIT = { regular: "₹/month", casual: "₹/day", self_employed: "₹/30 days" };
  const earnSeries = {};
  Object.keys(EARN).forEach((key, ki) => {
    ["person", "male", "female"].forEach((g, gi) => {
      const m = earnMaps[`${key}|${g}`];
      if (!m?.size) throw new Error(`PLFS extras: missing earnings series ${key}|${g}`);
      earnSeries[`${key}_${g}`] = {
        name: `plfs_earnings_${key}_${g}_inr`,
        label: `${key === "self_employed" ? "Self-employed" : key === "regular" ? "Regular wage" : "Casual"} · ${g} (${UNIT[key]})`,
        color: g === "person" ? ["#2E4BD8", "#5F6675", "#A3A9B4"][ki] : XGREYS[(ki + gi) % XGREYS.length],
        data: eAxis.map((ym) => m.get(ym) ?? null),
      };
    });
  });
  const earningsBundle = {
    meta: meta0("quarterly",
      "All India, rural + urban; average earnings by worker status from the annual PLFS reports (agriculture years, quarterly grain): regular wage ₹/month, casual labour ₹/day (non-public works), self-employment gross ₹/30 days — three different denominators, never one axis",
      {
        latestPeriod: eMonths.at(-1),
        note: "2017-18 rural+urban cells for regular-wage and self-employment earnings are quarantined: their implied urban worker weight (0.85 / 0.55) contradicts the stable structure of every later year (0.53-0.62 / 0.19-0.25). Rural and urban sector cells for that year match the published report and stay in the raw archive. Casual earnings carry the full span.",
      }),
    dates: eAxis.map((ym) => `${ym}-01`),
    series: earnSeries,
  };

  /* ---- indicator 3 by education level + the 15–29 age cut ---- */
  const eduRows = [];
  for (const y of agriYears) {
    for (let code = 1; code <= 9; code++) {
      eduRows.push(...await pageAll(ep, {
        indicator_code: 3, frequency_code: 1, year: y, year_type_code: 1,
        age_code: 1, gender_code: 3, sector_code: 3, state_code: 99, education_code: code,
      }));
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  const youthRows = [];
  for (const y of agriYears) {
    youthRows.push(...await pageAll(ep, {
      indicator_code: 3, frequency_code: 1, year: y, year_type_code: 1,
      age_code: 2, gender_code: 3, sector_code: 3, state_code: 99,
    }));
  }
  raw.indicators.ur_education = eduRows;
  raw.indicators.ur_youth = youthRows;
  const eduMaps = {}; // key -> Map("YYYY-07" -> v), PS+SS
  for (const r of eduRows) {
    if (r.weekly_status !== "PS+SS" || !ALL_DIMS_EDU(r)) continue;
    const k = EDU_KEYS[r.General_Education];
    if (!k) continue;
    const v = parseFloat(r.value);
    if (Number.isFinite(v)) (eduMaps[k] ??= new Map()).set(`${String(r.year).slice(0, 4)}-07`, v);
  }
  for (const r of youthRows) {
    if (r.weekly_status !== "PS+SS" || r.AgeGroup !== "15-29 years") continue;
    if ((r.General_Education ?? "all") !== "all" || !ALL_DIMS_EDU(r)) continue;
    const v = parseFloat(r.value);
    if (Number.isFinite(v)) (eduMaps.youth_15_29 ??= new Map()).set(`${String(r.year).slice(0, 4)}-07`, v);
  }
  const gAnchor = eduMaps.graduate;
  if (!gAnchor?.size) throw new Error("PLFS extras: no education UR data returned");
  const eduYears = [...gAnchor.keys()].sort();
  const eduAxis = [];
  for (let y = Number(eduYears[0].slice(0, 4)); y <= Number(eduYears.at(-1).slice(0, 4)); y++) eduAxis.push(`${y}-07`);
  const EDU_LABELS = {
    not_literate: "Not literate", up_to_primary: "Up to primary", middle: "Middle",
    secondary: "Secondary", higher_secondary: "Higher secondary", diploma: "Diploma/certificate",
    graduate: "Graduate", postgraduate: "Postgraduate & above", secondary_above: "Secondary & above",
    youth_15_29: "Age 15–29 · all education",
  };
  const eduSeries = {};
  Object.entries(EDU_LABELS).forEach(([k, label], i) => {
    const m = eduMaps[k];
    if (!m?.size) throw new Error(`PLFS extras: missing education series ${k}`);
    eduSeries[k] = {
      name: `plfs_ur_${k}_psss_pct`, label: `UR · ${label}`,
      color: k === "graduate" ? "#2E4BD8" : XGREYS[i % XGREYS.length],
      data: eduAxis.map((ym) => m.get(ym) ?? null),
    };
  });
  const educationBundle = {
    meta: meta0("annual",
      "All India, person, rural + urban, usual status (PS+SS); unemployment rate by general education level (15+), plus the 15–29 age cut; annual PLFS reports, agriculture years plotted at July",
      { latestPeriod: eduYears.at(-1) }),
    dates: eduAxis.map((ym) => `${ym}-01`),
    series: eduSeries,
  };

  writeRaw(root, "data/raw/plfs-extras.json", raw);
  writeSeries(root, "data/series/plfs-status.json", statusBundle);
  writeSeries(root, "data/series/plfs-earnings.json", earningsBundle);
  writeSeries(root, "data/series/plfs-education.json", educationBundle);
}

// education/youth rows also carry religion / social-group / contract axes
const ALL_DIMS_EDU = (r) =>
  (r.religion ?? "all") === "all" && (r.socialGroup ?? "all") === "all" &&
  (r.employee_contract ?? "all") === "all" && (r.quarter ?? "all") === "all" &&
  r.state === "All India" && r.gender === "person" && r.sector === "rural + urban";

/* Catalogue (docs/CONTRACT-coverage.md): what MoSPI publishes from the PLFS, from
 * plfs/getFrequency, plfs/getIndicatorListByFrequency and plfs/getFilterByIndicatorId.
 * One item per indicator x weekly status (CWS or PS+SS, different measures) x one cut, the
 * other dimensions at their headline (All India, person, rural + urban, 15 years and above):
 *   plfs:<monthly|quarterly|annual-agri|annual-calendar>:<indicator>:<cws|ps-ss>:all
 *   ...:gs:<gender>-<sector>     the gender x sector grid (the bulletins' own cut)
 *   ...:state:<state>   ...:age:<band>   ...:<dimension>:<value>   every other listed cut */
import { writeCatalogue, idPart, catalogueCli } from "../catalogue.mjs";
export async function cataloguePlfs() {
  const items = [];
  const freqs = (await mospi("plfs/getFrequency", {})).data ?? [];
  const SKIP = new Set(["year", "year_type", "quarter", "month", "weekly_status", "gender", "sector"]);
  const DEFAULT = /^(all|all india|15 years and above|person|rural \+ urban)$/i;
  for (const fr of freqs) {
    const freq = { 1: "annual", 2: "quarterly", 3: "monthly" }[fr.frequency_code];
    const inds = (await mospi("plfs/getIndicatorListByFrequency", { frequency_code: fr.frequency_code })).data ?? [];
    for (const ind of inds) {
      const f = (await mospi("plfs/getFilterByIndicatorId", { indicator_code: ind.indicator_code, frequency_code: fr.frequency_code })).data ?? {};
      const yts = freq === "annual" ? (f.year_type ?? []).map((y) => (y.year_type_code === 2 ? "annual-calendar" : "annual-agri")) : [freq];
      const wss = (f.weekly_status ?? [{ description: "CWS" }]).map((w) => idPart(w.description.replace("+", "-")));
      const genders = (f.gender ?? []).map((g) => idPart(g.description)), sectors = (f.sector ?? []).map((s) => idPart(s.description.replace("+", "plus")));
      for (const yt of yts) for (const ws of wss) {
        const head = `plfs:${yt}:${ind.indicator_code}:${ws}`;
        items.push({ id: `${head}:all`, label: `${ind.description}, ${ws.toUpperCase()}` });
        for (const g of genders) for (const s of sectors) if (!(g === "person" && s === "rural-plus-urban")) items.push({ id: `${head}:gs:${g}-${s}` });
        for (const [dim, vals] of Object.entries(f)) {
          if (SKIP.has(dim) || !Array.isArray(vals)) continue;
          for (const v of vals) {
            const name = v.description ?? v[Object.keys(v).find((k) => /name$/.test(k))];
            if (DEFAULT.test(String(name).trim())) continue;
            items.push({ id: `${head}:${idPart(dim)}:${idPart(name)}` });
          }
        }
      }
    }
  }
  writeCatalogue("plfs", {
    source: "MoSPI, NSO: Periodic Labour Force Survey (eSankhyiki API)",
    generator: "scripts/lib/products/plfs.mjs --catalogue",
    note: "From getFrequency, getIndicatorListByFrequency and getFilterByIndicatorId. One cut at a time over the headline (All India, person, rural + urban, 15+), plus the gender x sector grid. The listing offers every weekly status and year type for every indicator; not every pair is served.",
    items,
  });
}
await catalogueCli(import.meta.url, cataloguePlfs);
