// scripts/lib/products/asuse.mjs — Annual Survey of Unincorporated Sector
// Enterprises (informal / unincorporated non-agricultural enterprises).
//
// API quirks encoded here:
//  - asuse/getAsuseIndicatorList WITHOUT params hangs forever — indicator
//    lists come from getAsuseFrequencyList + getAsuseIndicatorListByFrequency;
//  - getAsuseRecords DOES honour year/sector_code/activity_code server-side
//    (verified by totalPages), but streams are modest (largest ~12k rows), so
//    each needed indicator is ingested IN FULL keyed by indicator_code only
//    and sliced client-side (the rbi.mjs approach) — the raw dump is then the
//    complete published table;
//  - the activity dimension carries PUBLISHED aggregates: code 50 = "All",
//    plus broad groups "Manufacturing Activities" / "Trading Activities" /
//    "Other Services" — no aggregate is computed here;
//  - annual rows use fiscal-year labels ("2023-24", 3 rounds from 2021-22),
//    plotted at April of the first year; quarterly rows use CALENDAR years
//    with quarter labels (JAN-MAR, ...), from Jan–Mar 2025.
// Bundles:
//   asuse-annual.json    — All-India headline metrics × HWE/OAE/All
//   asuse-sectors.json   — same metrics, rural/urban × broad activity
//   asuse-quarterly.json — the 8 quarterly-bulletin indicators
//   asuse-owners.json    — who owns the informal firm: social group (6) and
//                          education (5) of the owner/major partner, per 1000
//   asuse-modernity.json — bank accounts (9), computers & internet (20),
//                          registration under acts (22), franchise count (25)
//   asuse-structure.json — ownership type (3), location (10), nature of
//                          operation (12), months operated (14), working
//                          hours (16), NPI status (19), per 1000
//   asuse-states.json    — lean state cuts: establishments (2), workers (27),
//                          GVA per worker (33); Combined × activity All ×
//                          all establishment types. State-wise duplicates of
//                          the distribution tables (4/7/11/13/15/17/21/23/
//                          29/31/35) are consciously NOT ingested.

import { mospi, mospiAll } from "../mospi.mjs";
import { writeSeries, quarterAxis } from "../util.mjs";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";

// Raw archive (PLAN-launch §2b): every indicator's complete table, as served, gzipped JSON in
// the git-ignored deep-archive staging folder; data/raw/asuse-index.json (committed) lists each
// file with its rows, the endpoint's own row count (mospiAll fails on a short read) and sha256.
// The single 65 MB data/raw/asuse-records.json it replaces is in git history.
const STAGE = "data/archive/staging/asuse-raw";
const INDEX = "data/raw/asuse-index.json";
async function stageAll(root, lists, vintage) {
  const all = {}, files = [];
  for (const [fr, list] of lists) for (const ind of list) {
    const code = String(ind.indicator_code);
    const rows = await mospiAll("asuse/getAsuseRecords", { indicator_code: code });
    all[code] = rows;
    const gz = zlib.gzipSync(JSON.stringify(rows), { level: 9 });
    const rel = `${fr}-${code.padStart(2, "0")}.json.gz`;
    fs.mkdirSync(path.join(root, STAGE), { recursive: true });
    fs.writeFileSync(path.join(root, STAGE, rel), gz);
    files.push({ file: rel, frequency: fr, indicator: +code, name: String(ind.description).trim(), rows: rows.length, sha256: crypto.createHash("sha256").update(gz).digest("hex") });
    process.stdout.write(`asuse ${fr} ${code}: ${rows.length} rows\n`);
  }
  // the index keeps its vintage while no table changed (data vintage, AGENTS.md rule 5)
  const p = path.join(root, INDEX);
  const prev = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  const same = prev && JSON.stringify(prev.files.map((f) => [f.file, f.rows, f.sha256])) === JSON.stringify(files.map((f) => [f.file, f.rows, f.sha256]));
  const body = { vintage: same ? prev.vintage : vintage, note: "Index of the ASUSE raw archive: every annual and quarterly indicator's complete table as served by asuse/getAsuseRecords (all pages, keyed by indicator_code only), gzipped JSON in the deep-archive staging folder. sha256 is of the stored .json.gz file.", root: STAGE, tables: files.length, rows: files.reduce((a, f) => a + f.rows, 0), files };
  fs.writeFileSync(p, JSON.stringify(body, null, 1) + "\n");
  return { all, vintage: body.vintage };
}

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`;
const Q_START = { "JAN-MAR": "01", "APR-JUN": "04", "JUL-SEP": "07", "OCT-DEC": "10" };
const ET = { "Hired Worker Establishments(HWE)": "hwe", "Own Account Establishments(OAE)": "oae", "All Establishments(All)": "all" };

export async function buildAsuse(root, dcfg, vintage) {
  // indicator catalogues (archived to raw for the audit trail)
  const freqs = (await mospi("asuse/getAsuseFrequencyList", {})).data ?? [];
  const listAnnual = (await mospi("asuse/getAsuseIndicatorListByFrequency", { frequency_code: 1 })).data ?? [];
  const listQuarterly = (await mospi("asuse/getAsuseIndicatorListByFrequency", { frequency_code: 2 })).data ?? [];

  // every indicator, in full; the curated bundles below read the financial-year rounds only
  // (2021-22 to 2023-24). The 2025 round is a calendar year, a different ruler: it lives in
  // the asuse-2025-* bundles, never on the same axis.
  const staged = await stageAll(root, [["annual", listAnnual], ["quarterly", listQuarterly]], vintage);
  vintage = staged.vintage;
  const isFy = (r) => /^\d{4}-\d{2}$/.test(String(r.year));
  const qCodes = new Set(listQuarterly.map((i) => String(i.indicator_code)));
  // tables 1 and 2 now carry two measures (a count and a percentage of establishments); the
  // curated bundles were built on the count
  const isCount = (r) => r.establishments == null || /estimated/i.test(r.establishments);
  const byInd = Object.fromEntries(Object.entries(staged.all).map(([c, rows]) => [c, qCodes.has(c) ? rows : rows.filter((r) => isFy(r) && isCount(r))]));
  for (const code of [...Object.keys(dcfg.fetch.annual_indicators), ...Object.keys(dcfg.fetch.quarterly_indicators), ...Object.keys(dcfg.fetch.portrait_indicators ?? {}), ...Object.keys(dcfg.fetch.state_indicators ?? {})])
    if (!byInd[code]?.length) throw new Error(`ASUSE: indicator ${code} returned no rows`);

  const val = (r) => {
    const v = parseFloat(r.value);
    return Number.isFinite(v) ? v : null;
  };
  const AI = (r) => r["state/UT"] === "All India";

  /* ================= annual bundles ================= */
  // continuous fiscal-year axis (3 consecutive rounds today; future-proof)
  const aYears = [...new Set([
    ...Object.keys(dcfg.fetch.annual_indicators),
    ...Object.keys(dcfg.fetch.portrait_indicators ?? {}),
    ...Object.keys(dcfg.fetch.state_indicators ?? {}),
  ].flatMap((c) => byInd[c].map((r) => r.year)))].sort();
  const aAxis = [];
  for (let y = Number(aYears[0].slice(0, 4)); y <= Number(aYears.at(-1).slice(0, 4)); y++) aAxis.push(`${y}-04`);
  const aDates = aAxis.map((ym) => `${ym}-01`);
  const metaBase = {
    dossier: "asuse", frequency: "annual", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: aAxis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  // rows -> Map("YYYY-MM" -> value); collisions (unexpected extra dims) keep
  // the first value and are logged rather than silently overwritten
  const toMap = (rows, tag) => {
    const m = new Map();
    for (const r of rows) {
      const ym = fyStart(r.year);
      const v = val(r);
      if (v == null) continue;
      if (m.has(ym) && m.get(ym) !== v) {
        process.stdout.write(`asuse WARN ${tag}: conflicting values at ${ym} (${m.get(ym)} vs ${v}) — kept first\n`);
        continue;
      }
      m.set(ym, v);
    }
    return m;
  };
  const aData = (m) => aAxis.map((ym) => m.get(ym) ?? null);

  // annual metric extractors: rows already restricted to All-India;
  // sector/activity/establishment-type applied per call
  const pickAnnual = (code, sector, activity, et, extra = () => true) =>
    byInd[code].filter((r) => AI(r) && r.sector === sector && r.activity_category === activity && ET[r.establishment_type] === et && extra(r));
  // ind 26 (workers) also has gender × working_time; ind 30 has sub_indicator × hired_worker
  const workersAll = (r) => r.gender === "All" && r.working_time === "All";
  const emolPerHired = (r) => r.sub_indicator === "Annual Emoluments (Rs.) Per Hired Worker" && r.hired_worker === "All";
  const hiredCount = (r) => r.sub_indicator === "Estimated Number of Hired Workers" && r.hired_worker === "All";

  /* ---- asuse-annual: All-India, sector Combined, activity "All" ---- */
  const METRICS = [
    ["establishments", "1", "Establishments", "count", () => true],
    ["workers", "26", "Workers", "count", workersAll],
    ["gva_per_worker", "32", "GVA per worker (market establishments)", "inr_per_year", () => true],
    ["gva_per_establishment", "34", "GVA per establishment (market establishments)", "inr_per_year", () => true],
    ["emoluments_per_hired_worker", "30", "Emoluments per hired worker", "inr_per_year", emolPerHired],
    ["hired_workers", "30", "Hired workers", "count", hiredCount],
  ];
  const aSeries = {};
  let gi = 0;
  for (const [key, code, label, unit, extra] of METRICS) {
    for (const et of ["hwe", "oae", "all"]) {
      // per-hired-worker metrics are meaningless for OAE (no hired workers;
      // the source serves 0 there) — not baked
      if ((key === "emoluments_per_hired_worker" || key === "hired_workers") && et === "oae") continue;
      // QUARANTINE: indicator 34's HWE/OAE rows are mislabeled at source —
      // the published "All" (225,362 for 2021-22) reconciles only with the
      // labels inverted (0.86×118,415 + 0.14×886,112 ≈ 225,745; face value
      // gives ≈ 780k). Only the internally consistent All row is baked; the
      // raw archive keeps the source rows as served. Disclosed in meta.note.
      if (key === "gva_per_establishment" && et !== "all") continue;
      const m = toMap(pickAnnual(code, "Combined", "All", et, extra), `${key}_${et}`);
      if (!m.size) continue;
      const accent = key === "gva_per_worker" && et === "all";
      aSeries[`${key}_${et}`] = {
        name: `asuse_${key}_${et}`, label: `${label} · ${et.toUpperCase()}`,
        color: accent ? "#2E4BD8" : GREYS[gi++ % GREYS.length],
        data: aData(m), unit,
      };
    }
  }
  if (!Object.keys(aSeries).length) throw new Error("ASUSE: no annual data returned");
  const annualBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural + urban combined, all activities; by establishment type (HWE = hired-worker establishments, OAE = own-account establishments)",
      note: "Levels as published: establishment and worker counts are estimated absolute numbers; GVA per worker / per establishment and emoluments per hired worker are ₹ per year. The activity aggregate (\"All\") and establishment-type totals are PUBLISHED source rows, not computed here. GVA-per-worker refers to market establishments as titled in the source. Per-hired-worker metrics are not baked for OAE (own-account establishments have no hired workers), and the 2023-24 round publishes them for HWE only — the *_all variants end at 2022-23 (trailing null is a source publication change, not a fetch gap). GVA-per-establishment is baked for All only: the source's HWE and OAE rows for that indicator are mislabeled (the published All reconciles as a weighted mean only with the two labels inverted); the mislabeled rows are quarantined here and retained as served in the raw archive. Survey years are fiscal, plotted at April of the first year; only three rounds exist (2021-22 to 2023-24).",
    },
    dates: aDates, series: aSeries,
  };

  /* ---- asuse-sectors: rural/urban × broad activity, establishment type All ---- */
  const BROAD = [["Manufacturing Activities", "manufacturing"], ["Trading Activities", "trading"], ["Other Services", "other_services"], ["All", "all"]];
  const SECT = [["Rural", "rural"], ["Urban", "urban"]];
  const sSeries = {};
  let si = 0;
  for (const [key, code, label, unit, extra] of METRICS) {
    if (key === "hired_workers" || key === "gva_per_establishment") continue; // keep the sector cut focused
    for (const [act, actKey] of BROAD) {
      for (const [sec, secKey] of SECT) {
        const m = toMap(pickAnnual(code, sec, act, "all", extra), `${key}_${secKey}_${actKey}`);
        if (!m.size) continue;
        sSeries[`${key}_${secKey}_${actKey}`] = {
          name: `asuse_${key}_${secKey}_${actKey}`, label: `${label} · ${sec} · ${act === "All" ? "All activities" : act}`,
          color: GREYS[si++ % GREYS.length], data: aData(m), unit,
        };
      }
    }
  }
  const sectorsBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban × broad activity groups (published aggregates: Manufacturing Activities, Trading Activities, Other Services, All); all establishment types",
      note: "Same conventions as asuse-annual. Broad activity groups are the source's own aggregate rows — the three groups plus the published \"All\" total; nothing is summed here.",
    },
    dates: aDates, series: sSeries,
  };

  /* ================= quarterly bundle ================= */
  // rows use calendar years + quarter labels; state is All India throughout
  // the bulletin. Two row families exist per indicator: sector rows
  // (broad_activity null) and broad-activity rows (sector null).
  const QI = dcfg.fetch.quarterly_indicators; // code -> key
  const qMaps = {}; // seriesKey -> {map, label, unit}
  for (const [code, mKey] of Object.entries(QI)) {
    const isCount = mKey.endsWith("_00");
    const unit = isCount ? "hundreds" : "pct";
    for (const r of byInd[code]) {
      if (!AI(r)) continue;
      const mm = Q_START[String(r.quarter).trim()];
      if (!mm || !/^\d{4}$/.test(String(r.year))) continue;
      const ym = `${r.year}-${mm}`;
      const v = val(r);
      if (v == null) continue;
      let dim = null, dimLabel = null;
      if (r.broad_activity_category != null) { dim = slugify(r.broad_activity_category); dimLabel = r.broad_activity_category; }
      else if (r.sector != null) { dim = slugify(r.sector); dimLabel = r.sector; }
      else continue;
      const sk = `${mKey}_${dim}`;
      const e = (qMaps[sk] ??= { map: new Map(), label: `${r.indicator} · ${dimLabel}`, unit });
      if (e.map.has(ym) && e.map.get(ym) !== v) {
        process.stdout.write(`asuse WARN quarterly ${sk}: conflicting values at ${ym} — kept first\n`);
        continue;
      }
      e.map.set(ym, v);
    }
  }
  let quarterlyBundle = null;
  const qMonths = [...new Set(Object.values(qMaps).flatMap((e) => [...e.map.keys()]))].sort();
  if (qMonths.length) {
    const qAxis = quarterAxis(qMonths[0], qMonths.at(-1));
    const qGaps = new Set();
    for (const e of Object.values(qMaps)) {
      const ks = [...e.map.keys()].sort();
      for (const ym of qAxis) if (ym > ks[0] && ym < ks.at(-1) && !e.map.has(ym)) qGaps.add(`${ym}-01`);
    }
    const qSeries = {};
    Object.keys(qMaps).sort().forEach((sk, i) => {
      const e = qMaps[sk];
      const accent = sk === "establishments_00_all_activities";
      qSeries[sk] = {
        name: `asuse_q_${sk}`, label: e.label, color: accent ? "#2E4BD8" : GREYS[i % GREYS.length],
        data: qAxis.map((ym) => e.map.get(ym) ?? null), unit: e.unit,
      };
    });
    quarterlyBundle = {
      meta: {
        ...metaBase, frequency: "quarterly", base: "quarterly bulletin (calendar quarters, from Jan-Mar 2025)",
        latestPeriod: qMonths.at(-1),
        coverage: "All India; quarterly ASUSE bulletin (from Jan–Mar 2025), by sector and by broad activity as published",
        note: "Calendar quarters plotted at quarter start. Establishment/worker counts are in hundreds ('00) as published; the rest are percentages. The quarterly bulletin is a separate short series and is never joined to the annual rounds.",
        gaps: [...qGaps].sort(),
        gapsNote: qGaps.size ? "Quarters where a source table was not published — the sector-wise worker-composition shares (working owner / hired / other) are missing for Oct–Dec 2025 in the API." : undefined,
      },
      dates: qAxis.map((ym) => `${ym}-01`),
      series: qSeries,
    };
  }

  /* ================= the informal-firm portrait ================= */
  // Per-1000 distributions and rates, All-India grain. Category strings are
  // matched EXACTLY as served (incl. the double space in "Permanent
  // Structure"); an unmapped category logs a WARN and is skipped — new
  // source categories surface in the fetch log, never silently.
  const SEC3 = [["Rural", "rural"], ["Urban", "urban"], ["Combined", "combined"]];
  const mapDim = (maps, tag) => (v) => {
    if (v == null || v === "All") return null;
    if (v in maps) return maps[v];
    process.stdout.write(`asuse WARN ${tag}: unmapped category "${v}" skipped\n`);
    return null;
  };
  // build series over the annual axis from a filtered row-set, keyed by fn
  const seriesFrom = (rows, keyOf, labelOf, unit, out, colorIdx) => {
    const groups = new Map();
    for (const r of rows) {
      const k = keyOf(r);
      if (k == null) continue;
      if (!groups.has(k)) groups.set(k, { rows: [], label: labelOf(r) });
      groups.get(k).rows.push(r);
    }
    for (const [k, g] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const m = toMap(g.rows, k);
      if (!m.size) continue;
      out[k] = {
        name: `asuse_${k}`, label: g.label,
        color: GREYS[colorIdx.i++ % GREYS.length],
        data: aData(m), unit,
      };
    }
  };

  /* ---- asuse-owners: social group (6) + education (5) of the owner ---- */
  const SOCIAL = { "Scheduled Tribe": "st", "Scheduled Caste": "sc", "Other Backward Classes": "obc", "Others": "others", "Not Known": "not_known" };
  const EDU = {
    "Not Literate": "not_literate", "Literate Below Primary": "below_primary",
    "Literate Primary and Above but Below Secondary": "primary_to_secondary",
    "Literate Secondary and Above but Below Higher Secondary.": "secondary_to_hs",
    "Literate Higher Secondary and Above but Below Graduate": "hs_to_graduate",
    "Literate Graduate and Above": "graduate_and_above",
  };
  const oSeries = {};
  const oIdx = { i: 0 };
  {
    const g6 = mapDim(SOCIAL, "owners.social");
    for (const [sec, secKey] of SEC3) {
      seriesFrom(
        byInd["6"].filter((r) => AI(r) && r.sector === sec && r.activity_category === "All" && ET[r.establishment_type] === "all" && g6(r["social_group_of_owner/Major_partner"]) != null),
        (r) => `social_${g6(r["social_group_of_owner/Major_partner"])}_${secKey}`,
        (r) => `Owner social group · ${r["social_group_of_owner/Major_partner"]} · ${sec}`,
        "per_1000", oSeries, oIdx);
      const g5 = mapDim(EDU, "owners.edu");
      seriesFrom(
        byInd["5"].filter((r) => AI(r) && r.sector === sec && g5(r.general_education_level) != null),
        (r) => `edu_${g5(r.general_education_level)}_${secKey}`,
        (r) => `Owner education · ${r.general_education_level.replace(/\.$/, "")} · ${sec}`,
        "per_1000", oSeries, oIdx);
    }
    if (oSeries.social_obc_combined) oSeries.social_obc_combined.color = "#2E4BD8";
  }
  const ownersBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban/combined; proprietary & partnership establishments — per-1000 distribution of owners/major partners by social group (indicator 6, activity All, all establishment types) and by general education (indicator 5)",
      note: "Per-1000 distributions as published (integers; components can miss 1000 by a few parts from rounding). Both tables describe the owner or major partner of proprietary and partnership establishments only — corporate forms have no single owner to classify. The published \"All\" rows (=1000) are not baked; group shares are served rows, nothing is computed here.",
    },
    dates: aDates, series: oSeries,
  };

  /* ---- asuse-modernity: bank accounts (9), computer/internet (20), registration (22), franchise (25) ---- */
  // MoSPI relabelled the headline row in 2026 ("Maintaining any kind of  Account in Financial
  // Institutions", double space as served); the values are unchanged (666, 710, 761 per 1,000)
  const HOLDER = { "Maintaining Bank/PO Savings Account": "any_account", "Maintaining any kind of  Account in Financial Institutions": "any_account", "Account in the Name of Owner": "owner_account", "Account in the Name of Establishments": "estab_account" };
  const SUB20 = { "Using Computer": "computer", "Using Internet": "internet" };
  const ACTS = {
    "Shops & Estb. Act": "shops_estb_act", "Indian Trust Act,1882": "trust_act",
    "Societies Reg.Act, 1860": "societies_act", "Co-operative Soc. Act,1912": "coop_act",
    "Club/Associations etc.": "club_assoc", "CGST Act": "cgst_act",
    "EPFO/ESIC": "epfo_esic", "Others": "other_acts",
    "State Specefic License/registration": "state_licence", // sic, as served
    "Regional Transport Office (RTO)": "rto",
  };
  const mSeries = {};
  const mIdx = { i: 0 };
  {
    const gH = mapDim(HOLDER, "modernity.bank");
    const g20 = mapDim(SUB20, "modernity.digital");
    const gA = mapDim(ACTS, "modernity.acts");
    for (const [sec, secKey] of SEC3) {
      seriesFrom(
        byInd["9"].filter((r) => AI(r) && r.sector === sec && r.broad_activity_category === "All" && ET[r.establishment_type] === "all" && gH(r.account_holder) != null),
        (r) => `bank_${gH(r.account_holder)}_${secKey}`,
        (r) => `Bank/PO account · ${r.account_holder.replace(/\s+/g, " ")} · ${sec}`,
        "per_1000", mSeries, mIdx);
      for (const et of ["hwe", "oae", "all"]) {
        seriesFrom(
          byInd["20"].filter((r) => AI(r) && r.sector === sec && r.broad_activity_category === "All" && ET[r.establishment_type] === et && g20(r.sub_indicator) != null),
          (r) => `${g20(r.sub_indicator)}_${et}_${secKey}`,
          (r) => `${r.sub_indicator} · ${et.toUpperCase()} · ${sec}`,
          "per_1000", mSeries, mIdx);
      }
      seriesFrom(
        byInd["22"].filter((r) => AI(r) && r.sector === sec && r.activity_category === "All" && ET[r.establishment_type] === "all" && r.sub_indicator === "Not Registered"),
        () => `reg_not_registered_${secKey}`,
        () => `Not registered under any act · ${sec}`,
        "per_1000", mSeries, mIdx);
      seriesFrom(
        byInd["22"].filter((r) => AI(r) && r.sector === sec && r.activity_category === "All" && ET[r.establishment_type] === "all" && r.sub_indicator !== "Not Registered" && gA(r["Acts/Agency_of_registration"]) != null),
        (r) => `reg_${gA(r["Acts/Agency_of_registration"])}_${secKey}`,
        (r) => `Registered · ${r["Acts/Agency_of_registration"]} · ${sec}`,
        "per_1000", mSeries, mIdx);
    }
    seriesFrom(
      byInd["25"].filter((r) => AI(r)),
      () => "franchise_count",
      () => "Establishments serving as franchisee outlets · All India",
      "count", mSeries, mIdx);
    if (mSeries.internet_all_combined) mSeries.internet_all_combined.color = "#2E4BD8";
  }
  const modernityBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; per-1000 rates — establishments maintaining bank/post-office accounts (indicator 9), using computers/internet (20), registered under acts (22, act-wise, all establishment types) — plus the absolute count of franchisee outlets (25)",
      note: "Per-1000 rates as published. Act-wise registration rates are NOT exclusive (one establishment can register under several acts) and do not sum to anything; \"Not registered\" is the clean complement of registered-under-at-least-one. Bank-account rows: \"maintaining any\" is the headline rate; owner-name and establishment-name accounts are its published components. The franchise series is an absolute count, not a rate.",
    },
    dates: aDates, series: mSeries,
  };

  /* ---- asuse-structure: ownership (3), location (10), operation (12), months (14), hours (16), NPI (19) ---- */
  const OWN = {
    "Proprietary-Male": "proprietary_male", "Proprietary-Female": "proprietary_female",
    "Proprietary-All": "proprietary_all",
    "Partnership with Members of Same Household": "partnership_same_hh",
    "Partnership with Members of Different Households": "partnership_diff_hh",
    "SHG": "shg", "Society/Trusts/Club/Association/Body of Individuals": "society_trust",
    "Co-operatives": "cooperatives", "Others": "others",
  };
  const LOC = {
    "Within Household Premises": "within_household",
    "Outside Household Premises with Fixed Premises of Permanent  Structure": "fixed_permanent",
    "Outside Household Premises with Fixed Premises of Temporary Structure / Kiosk / Stall": "fixed_temporary",
    "Outside Household Premises with Fixed Premises but Without any Structure": "fixed_no_structure",
    "Outside Household Premises Without Fixed Premises like Mobile Market": "mobile_market",
    "Outside Household Premises Without Fixed Premises like Street Vendors etc.": "street_vendor",
  };
  const NATURE = { "Perennial": "perennial", "Seasonal": "seasonal", "Casual": "casual" };
  const MONTHS_D = { "<= 3 Months": "months_le3", "4 to 6 Months": "months_4_6", "7 to 9 Months": "months_7_9", "> 9 Months": "months_gt9", "Average no. of Months Operated": "months_avg" };
  const HOURS = { "<4": "hours_lt4", "4-7": "hours_4_7", "8-11": "hours_8_11", ">11": "hours_gt11" };
  const NPI = { "NPI with Major Receipts from Donation/Grants": "npi_donation", "NPI with Major Receipts from Other Sources": "npi_other", "Non-NPI": "non_npi" };
  const stSeries = {};
  const stIdx = { i: 0 };
  {
    const gO = mapDim(OWN, "structure.ownership"), gL = mapDim(LOC, "structure.location"),
      gN = mapDim(NATURE, "structure.nature"), gM = mapDim(MONTHS_D, "structure.months"),
      gHr = mapDim(HOURS, "structure.hours"), gNpi = mapDim(NPI, "structure.npi");
    for (const [sec, secKey] of SEC3) {
      const inAct = (r) => AI(r) && r.sector === sec && r.activity_category === "All" && ET[r.establishment_type] === "all";
      seriesFrom(byInd["3"].filter((r) => inAct(r) && gO(r.ownership_type) != null),
        (r) => `own_${gO(r.ownership_type)}_${secKey}`, (r) => `Ownership · ${r.ownership_type} · ${sec}`, "per_1000", stSeries, stIdx);
      seriesFrom(byInd["10"].filter((r) => inAct(r) && gL(r.location_of_establishment) != null),
        (r) => `loc_${gL(r.location_of_establishment)}_${secKey}`, (r) => `Location · ${r.location_of_establishment.replace(/\s+/g, " ")} · ${sec}`, "per_1000", stSeries, stIdx);
      seriesFrom(byInd["12"].filter((r) => inAct(r) && gN(r.nature_of_operation) != null),
        (r) => `op_${gN(r.nature_of_operation)}_${secKey}`, (r) => `Operation · ${r.nature_of_operation} · ${sec}`, "per_1000", stSeries, stIdx);
      seriesFrom(byInd["14"].filter((r) => inAct(r) && gM(r.no_of_months_operated) != null),
        (r) => `${gM(r.no_of_months_operated)}_${secKey}`,
        (r) => `Months operated · ${r.no_of_months_operated} · ${sec}`,
        "per_1000", stSeries, stIdx);
      seriesFrom(byInd["16"].filter((r) => inAct(r) && gHr(r.no_of_working_hours) != null),
        (r) => `${gHr(r.no_of_working_hours)}_${secKey}`, (r) => `Hours per day · ${r.no_of_working_hours} · ${sec}`, "per_1000", stSeries, stIdx);
      seriesFrom(byInd["19"].filter((r) => AI(r) && r.sector === sec && r.broad_activity_category === "All" && ET[r.establishment_type] === "all" && gNpi(r.NPI_status) != null),
        (r) => `npi_${gNpi(r.NPI_status)}_${secKey}`, (r) => `NPI status · ${r.NPI_status} · ${sec}`, "per_1000", stSeries, stIdx);
    }
    // the average-months rows are month counts, not per-1000 shares
    for (const k of Object.keys(stSeries)) if (k.startsWith("months_avg_")) stSeries[k].unit = "months";
    if (stSeries.own_proprietary_female_combined) stSeries.own_proprietary_female_combined.color = "#2E4BD8";
  }
  const structureBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban/combined, activity All, all establishment types; per-1000 distributions — ownership type (indicator 3), location (10), nature of operation (12), months operated (14, plus average months), working hours per day (16), NPI status (19)",
      note: "Per-1000 distributions as published (integer rounding; components can miss 1000 by a few parts). Proprietary-All is the source's own male+female aggregate and overlaps the two proprietary rows — the exclusive ownership set is Proprietary-All + the two partnership rows + SHG + society/trust + co-operatives + others. months_avg_* series are average months operated (a count of months, not per-1000). The published \"All\" rows (=1000) are not baked.",
    },
    dates: aDates, series: stSeries,
  };

  /* ---- asuse-states: lean state cuts (2 establishments, 27 workers, 33 GVA/worker) ---- */
  const slSeries = {};
  const slIdx = { i: 0 };
  {
    const base = (r) => !AI(r) && r.sector === "Combined" && r.broad_activity_category === "All" && ET[r.establishment_type] === "all";
    seriesFrom(byInd["2"].filter(base),
      (r) => `est_${slugify(r["state/UT"])}`, (r) => `Establishments · ${r["state/UT"]}`, "count", slSeries, slIdx);
    seriesFrom(byInd["27"].filter((r) => base(r) && r.gender === "All" && r.working_time === "All"),
      (r) => `wrk_${slugify(r["state/UT"])}`, (r) => `Workers · ${r["state/UT"]}`, "count", slSeries, slIdx);
    seriesFrom(byInd["33"].filter(base),
      (r) => `gvapw_${slugify(r["state/UT"])}`, (r) => `GVA per worker · ${r["state/UT"]}`, "inr_per_year", slSeries, slIdx);
  }
  const statesBundle = {
    meta: {
      ...metaBase,
      coverage: "States/UTs; estimated establishments (indicator 2), workers (27, all genders and working time), and annual GVA per worker (33, market establishments) — Combined sector, activity All, all establishment types",
      note: "Lean state cut: levels as published, All-India rows excluded (they live in asuse-annual). GVA per worker refers to market establishments as titled in the source. The state-wise variants of every distribution table (indicators 4/7/11/13/15/17/21/23/29/31/35) are consciously not baked — they duplicate the All-India distributions at ~37× the volume.",
    },
    dates: aDates, series: slSeries,
  };

  writeSeries(root, "data/series/asuse-annual.json", annualBundle);
  writeSeries(root, "data/series/asuse-sectors.json", sectorsBundle);
  writeSeries(root, "data/series/asuse-owners.json", ownersBundle);
  writeSeries(root, "data/series/asuse-modernity.json", modernityBundle);
  writeSeries(root, "data/series/asuse-structure.json", structureBundle);
  writeSeries(root, "data/series/asuse-states.json", statesBundle);
  if (quarterlyBundle) writeSeries(root, "data/series/asuse-quarterly.json", quarterlyBundle);
  else process.stdout.write("asuse: quarterly indicators returned no usable dated rows — asuse-quarterly.json not written\n");
  bakeTables(root, staged.all, listAnnual, { ...metaBase, vintage }, dcfg);
  return annualBundle;
}

/* ================= every annual table, complete (wave 2) =================
 * One bundle per indicator per ruler: asuse-tNN (the financial-year rounds 2021-22 to 2023-24,
 * dated at April) and asuse-2025-tNN (the calendar-year 2025 round). A table's own categories
 * (ownership type, gender, months operated...) are always kept; of the five cutting
 * dimensions (state, sector, activity, broad activity, establishment type) a baked series
 * varies at most one from its headline ("All India", "Combined", "All", all establishments),
 * which is exactly what a catalogue item is (an indicator x one cut). The full cross of the
 * cuts (state x sector x activity x establishment type: about 370,000 series across the
 * tables) is the deep-archive tier: long-format csv.gz per table and round, staged in
 * data/archive/staging/asuse/, rolling up to the baked bundle. Nothing is computed.
 * Units come from the table, row by row (UNIT below); a row whose unit cannot be told fails. */
const UNIT = (code, r) => {
  const c = +code;
  if (c === 1 || c === 2) return /percentage/i.test(r.establishments ?? "") ? "pct" : "count";
  if (c === 14 || c === 15) return /average/i.test(r.no_of_months_operated ?? "") ? "months" : "per_1000";
  if ((c >= 3 && c <= 24) || c === 38) return "per_1000";
  if ([25, 26, 27, 28, 29, 56, 60].includes(c)) return "count";
  if (c === 30 || c === 31) return /number/i.test(r.sub_indicator ?? "") ? "count" : "inr_per_year";
  if (c >= 32 && c <= 35) return "inr_per_year";
  if (c === 36 || c === 37) return "inr";
  if (c === 59) return "pct";
  if (c === 39) return UNIT39(r);
  return null;
};
// indicator 39 mixes measures in one table: its "worker characteristics" name each one
const UNIT39 = (r) => {
  const w = String(r.worker_characteristics ?? r["worker characteristics"] ?? "");
  if (/per 1000|per thousand/i.test(w)) return "per_1000";
  if (/percentage|%/i.test(w)) return "pct";
  if (/rs\.?|value|gva|emolument/i.test(w)) return "inr_per_year";
  if (/number|no\./i.test(w)) return "count";
  return null;
};
const SKIP = new Set(["indicator", "frequency", "year", "value", "quarter"]);
const CUTS = ["state/UT", "sector", "activity_category", "broad_activity_category", "establishment_type"];
const HEADLINE = new Set(["All India", "Combined", "All", "All Establishments(All)"]);
const isHead = (k, v) => v == null || v === "" || HEADLINE.has(String(v).trim());
const ORDER = ["state/UT", "sector", "activity_category", "broad_activity_category", "establishment_type"];
const ET_SHORT = { "Hired Worker Establishments(HWE)": "HWE", "Own Account Establishments(OAE)": "OAE", "All Establishments(All)": "All establishments" };
const tidyV = (k, v) => (k === "establishment_type" ? ET_SHORT[v] ?? v : String(v).replace(/\s+/g, " ").trim());
// a long value is cut to 30 characters plus a short hash of the whole, so two categories that
// share a long prefix ("Outside Household Premises with Fixed Premises of ...") stay distinct
const slugV = (v) => {
  const full = String(v).toLowerCase().replace(/\+/g, "_plus").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").replace(/basis/g, "terms");
  return full.length <= 36 ? full : full.slice(0, 30).replace(/_$/, "") + "_" + crypto.createHash("sha1").update(full).digest("hex").slice(0, 5);
};

function bakeTables(root, all, listAnnual, metaBase, dcfg) {
  const names = Object.fromEntries(listAnnual.map((i) => [String(i.indicator_code), String(i.description).trim()]));
  let nB = 0, nS = 0;
  const archived = [];
  for (const code of Object.keys(names).sort((a, b) => a - b)) {
    const rows = all[code] ?? [];
    for (const [ruler, keep, slug] of [["fy", (r) => /^\d{4}-\d{2}$/.test(String(r.year)), `asuse-t${code.padStart(2, "0")}`], ["cy", (r) => String(r.year) === "2025", `asuse-2025-t${code.padStart(2, "0")}`]]) {
      const rs = rows.filter(keep);
      const extra = rows.filter((r) => !/^\d{4}-\d{2}$/.test(String(r.year)) && String(r.year) !== "2025");
      if (extra.length && ruler === "fy") throw new Error(`asuse t${code}: rows for a round this adapter does not know (${[...new Set(extra.map((r) => r.year))]})`);
      if (!rs.length) continue;
      const years = [...new Set(rs.map((r) => String(r.year)))].sort();
      const axis = ruler === "fy" ? (() => { const a = []; for (let y = +years[0].slice(0, 4); y <= +years.at(-1).slice(0, 4); y++) a.push(`${y}-04-01`); return a; })() : ["2025-01-01"];
      const dateOf = (r) => (ruler === "fy" ? `${String(r.year).slice(0, 4)}-04-01` : "2025-01-01");
      const dimKeys = [...new Set(rs.flatMap((r) => Object.keys(r)))].filter((k) => !SKIP.has(k)).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
      const series = new Map();
      const deepRows = [];
      for (const r of rs) {
        const v = parseFloat(r.value);
        if (!Number.isFinite(v)) continue;
        const cutsOff = CUTS.filter((k) => k in r && !isHead(k, r[k]));
        if (cutsOff.length > 1) { deepRows.push(r); continue; }
        // a series is named by its one cut (if any) and the table's own categories
        const dims = dimKeys.filter((k) => r[k] != null && r[k] !== "" && !(CUTS.includes(k) && isHead(k, r[k])));
        const key = dims.map((k) => slugV(tidyV(k, r[k]))).join("__") || "all_india";
        const unit = UNIT(code, r);
        if (!unit) throw new Error(`asuse t${code}: no unit for row ${JSON.stringify(r)}`);
        const label = (dims.some((k) => CUTS.includes(k)) ? "" : "All India · ") + dims.map((k) => tidyV(k, r[k])).join(" · ");
        let e = series.get(key);
        if (!e) series.set(key, e = { label, unit, cells: new Map(), group: r["state/UT"] && r["state/UT"] !== "All India" ? r["state/UT"] : tidyV("a", r.activity_category ?? r.broad_activity_category ?? "All") });
        if (e.label !== label) throw new Error(`asuse t${code}: key collision ${key}: "${e.label}" vs "${label}"`);
        const d = dateOf(r);
        if (e.cells.has(d) && e.cells.get(d) !== v) { process.stdout.write(`asuse WARN t${code} ${key} ${d}: ${e.cells.get(d)} vs ${v}, kept first\n`); continue; }
        e.cells.set(d, v);
      }
      const out = {};
      for (const [key, e] of [...series].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
        const data = axis.map((d) => e.cells.get(d) ?? null);
        const f = data.findIndex((x) => x != null), l = data.length - 1 - [...data].reverse().findIndex((x) => x != null);
        const gaps = axis.filter((_, i) => i > f && i < l && data[i] == null);
        out[key] = { name: `asuse_t${code}_${key}`, label: e.label, unit: e.unit, group: e.group, color: "#A3A9B4", data, ...(gaps.length ? { gaps, gapsNote: "Not published for this round." } : {}) };
      }
      // the axis ends where the bundle's data ends (no trailing empty round)
      let last = axis.length - 1; while (last > 0 && !Object.values(out).some((s) => s.data[last] != null)) last--;
      if (last < axis.length - 1) { axis.length = last + 1; for (const s of Object.values(out)) s.data.length = last + 1; }
      const base = ruler === "fy" ? metaBase.base : "calendar-year round (ASUSE 2025)";
      writeSeries(root, `data/series/${slug}.json`, {
        meta: { ...metaBase, base, frequency: "annual", latestPeriod: axis.at(-1).slice(0, 7), product: `ASUSE table ${code}: ${names[code]}`,
          coverage: `${names[code]}: every published row, ${ruler === "fy" ? `financial-year rounds ${years.join(", ")}` : "the calendar-year 2025 round"}`,
          note: (ruler === "fy" ? "Financial-year rounds (April to March), dated at April of the first year." : "The 2025 round covers calendar year 2025 (January to December): a different reference period from the financial-year rounds, so a separate bundle, never joined to them.")
            + " Every row MoSPI publishes for this table, values as served, including its published \"All\" totals; each series is named by all of its dimensions. Per-1000 distributions are integers and can miss 1,000 by a few parts from rounding. Rupee values are nominal." + (+code === 34 || +code === 35 ? " The source's HWE and OAE rows of GVA per establishment are mislabelled at All India (the published All reconciles only with the two inverted; see asuse-annual): they are baked here as served, and the curated bundles use the All row only." : "") },
        dates: axis, series: out,
      });
      nB++; nS += Object.keys(out).length;
      if (deepRows.length) {
        const cell = (x) => (x == null ? "" : /[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x));
        const other = dimKeys.filter((k) => !CUTS.includes(k));
        const head = ["round", "indicator_code", "indicator", "state", "sector", "activity", "establishment_type", ...other.map((k) => k.toLowerCase().replace(/[^a-z0-9]+/g, "_")), "value", "unit", "source", "vintage"];
        const lines = [head.join(","), ...deepRows.map((r) => [r.year, code, names[code], r["state/UT"], r.sector, r.activity_category ?? r.broad_activity_category, tidyV("establishment_type", r.establishment_type), ...other.map((k) => r[k]), parseFloat(r.value), UNIT(code, r), "MoSPI, NSO: ASUSE (eSankhyiki)", metaBase.vintage].map(cell).join(","))];
        const file = `data/archive/staging/asuse/${slug}.csv.gz`;
        fs.mkdirSync(path.join(root, "data/archive/staging/asuse"), { recursive: true });
        fs.writeFileSync(path.join(root, file), zlib.gzipSync(lines.join("\n") + "\n", { level: 9 }));
        archived.push({ file, rows: deepRows.length, indicator: +code, round: ruler === "fy" ? years.join(", ") : "2025", rolls_up_to: slug });
      }
    }
  }
  if (archived.length) fs.writeFileSync(path.join(root, "data/archive/staging/asuse/files.json"), JSON.stringify({ note: "Staged ASUSE full crosses (state x sector x activity x establishment type) for the deep archive (PLAN-launch §2b); each rolls up to the baked bundle named.", files: archived }, null, 1) + "\n");
  process.stdout.write(`asuse tables: ${nB} bundles, ${nS} series; ${archived.length} archive files, ${archived.reduce((a, f) => a + f.rows, 0)} rows\n`);
}

/* Catalogue (docs/CONTRACT-coverage.md): asuse/getAsuseIndicatorListByFrequency (annual and
 * quarterly) and asuse/getAsuseFilterByIndicatorId, one cut at a time. The "establishments"
 * dimension (a count or a percentage) is a measure, not a cut, so it is crossed:
 *   asuse:<annual|quarterly>:<indicator>[:<measure>]:all | :<dimension>:<value> */
import { writeCatalogue, indicatorCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueAsuse() {
  const items = [];
  for (const [fc, fr] of [[1, "annual"], [2, "quarterly"]]) {
    const inds = (await mospi("asuse/getAsuseIndicatorListByFrequency", { frequency_code: fc })).data ?? [];
    items.push(...await indicatorCatalogue({ mospi, prefix: `asuse:${fr}`, indicators: inds, cross: ["establishments"], skip: ["year", "quarter"],
      filter: (ind) => ["asuse/getAsuseFilterByIndicatorId", { indicator_code: ind.indicator_code, frequency_code: fc }] }));
  }
  writeCatalogue("asuse", { source: "MoSPI, NSO: Annual Survey of Unincorporated Sector Enterprises (eSankhyiki API)",
    generator: "scripts/lib/products/asuse.mjs --catalogue",
    note: "From getAsuseIndicatorListByFrequency and getAsuseFilterByIndicatorId: one cut at a time; rounds 2021-22 to 2025 sit inside every annual item.", items });
}
await catalogueCli(import.meta.url, catalogueAsuse);
