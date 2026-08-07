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

import { mospi } from "../mospi.mjs";
import { writeJson, writeRaw, quarterAxis } from "../util.mjs";

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
  for (const code of [...Object.keys(dcfg.fetch.annual_indicators), ...Object.keys(dcfg.fetch.quarterly_indicators)]) {
    byInd[code] = await fetchAll(code);
  }
  writeRaw(root, "data/raw/asuse-records.json", {
    vintage,
    note: "Complete row-sets of the ASUSE indicators used by the baked bundles (annual 1/26/30/32/34, quarterly 40-42/46-50), plus the indicator catalogues.",
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
  const aYears = [...new Set(Object.keys(dcfg.fetch.annual_indicators).flatMap((c) => byInd[c].map((r) => r.year)))].sort();
  const aAxis = [];
  for (let y = Number(aYears[0].slice(0, 4)); y <= Number(aYears.at(-1).slice(0, 4)); y++) aAxis.push(`${y}-04`);
  const aDates = aAxis.map((ym) => `${ym}-01`);
  const metaBase = {
    dossier: "asuse", frequency: "annual", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
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

  writeJson(root, "data/series/asuse-annual.json", annualBundle);
  writeJson(root, "data/series/asuse-sectors.json", sectorsBundle);
  if (quarterlyBundle) writeJson(root, "data/series/asuse-quarterly.json", quarterlyBundle);
  else process.stdout.write("asuse: quarterly indicators returned no usable dated rows — asuse-quarterly.json not written\n");
  return annualBundle;
}
