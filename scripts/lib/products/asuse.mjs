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

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw, quarterAxis } from "../util.mjs";

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`;
const Q_START = { "JAN-MAR": "01", "APR-JUN": "04", "JUL-SEP": "07", "OCT-DEC": "10" };
const ET = { "Hired Worker Establishments(HWE)": "hwe", "Own Account Establishments(OAE)": "oae", "All Establishments(All)": "all" };

async function fetchAll(code) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("asuse/getAsuseRecords", { indicator_code: code, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page % 5 === 0 || page >= tp) process.stdout.write(`asuse ind ${code}: page ${page}/${tp} (${rows.length} rows)\n`);
    if (page >= tp) break;
    page++;
  }
  return rows;
}

export async function buildAsuse(root, dcfg, vintage) {
  // indicator catalogues (archived to raw for the audit trail)
  const freqs = (await mospi("asuse/getAsuseFrequencyList", {})).data ?? [];
  const listAnnual = (await mospi("asuse/getAsuseIndicatorListByFrequency", { frequency_code: 1 })).data ?? [];
  const listQuarterly = (await mospi("asuse/getAsuseIndicatorListByFrequency", { frequency_code: 2 })).data ?? [];

  const byInd = {};
  for (const code of [
    ...Object.keys(dcfg.fetch.annual_indicators),
    ...Object.keys(dcfg.fetch.quarterly_indicators),
    ...Object.keys(dcfg.fetch.portrait_indicators ?? {}),
    ...Object.keys(dcfg.fetch.state_indicators ?? {}),
  ]) {
    byInd[code] ??= await fetchAll(code);
  }
  writeRaw(root, "data/raw/asuse-records.json", {
    vintage,
    note: "Complete row-sets of the ASUSE indicators used by the baked bundles (annual 1/26/30/32/34, portrait 3/5/6/9/10/12/14/16/19/20/22/25, state cuts 2/27/33, quarterly 40-42/46-50), plus the indicator catalogues. State-wise duplicates of the distribution tables (4/7/11/13/15/17/21/23/29/31/35) are consciously not ingested.",
    frequencies: freqs, indicators_annual: listAnnual, indicators_quarterly: listQuarterly,
    records: byInd,
  });

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
        color: accent ? "#BE3E26" : GREYS[gi++ % GREYS.length],
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
        name: `asuse_q_${sk}`, label: e.label, color: accent ? "#BE3E26" : GREYS[i % GREYS.length],
        data: qAxis.map((ym) => e.map.get(ym) ?? null), unit: e.unit,
      };
    });
    quarterlyBundle = {
      meta: {
        ...metaBase, frequency: "quarterly",
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
    if (oSeries.social_obc_combined) oSeries.social_obc_combined.color = "#BE3E26";
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
  const HOLDER = { "Maintaining Bank/PO Savings Account": "any_account", "Account in the Name of Owner": "owner_account", "Account in the Name of Establishments": "estab_account" };
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
        (r) => `Bank/PO account · ${r.account_holder} · ${sec}`,
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
    if (mSeries.internet_all_combined) mSeries.internet_all_combined.color = "#BE3E26";
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
    if (stSeries.own_proprietary_female_combined) stSeries.own_proprietary_female_combined.color = "#BE3E26";
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
  return annualBundle;
}
