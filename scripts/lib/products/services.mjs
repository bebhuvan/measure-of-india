// scripts/lib/products/services.mjs: the services guide (output, trade, enterprises, jobs).
// One adapter, five products, each registered as its own dossier key in data/sources.yml so
// that every bundle is checked against its own base and window:
//
//   services-isp    MoSPI Index of Services Production (trial, base 2024-25=100):
//                   the annual 2025-26 index and the monthly y/y that became computable in
//                   April 2026. The monthly LEVELS stay in `isp.json` (the iip guide's bundle);
//                   this adapter re-reads the same endpoint for the published growth rates.
//   services-nas    MoSPI National Accounts, annual GVA by industry and sub-industry, both bases
//                   (2011-12 and 2022-23), never joined: share of nominal GVA, real y/y, level.
//   services-trade  RBI DBIE via the local Data Bank: monthly services trade (report 1501), the
//                   BPM6 services categories quarterly (1076, BPM6 block), the purpose-code detail
//                   quarterly (1076, invisibles block) and the long annual table (807, 1950-51 on).
//   services-jobs   MoSPI PLFS indicator 4: share of workers by NIC section, gender, rural/urban,
//                   usual status and CWS. Agriculture years and calendar years are two designs.
//   services-asuse  MoSPI ASUSE: unincorporated service enterprises by activity: establishments,
//                   workers, GVA, emoluments, and their profile (ownership, location, hours...).
//                   The fiscal-year rounds (2021-22 to 2023-24) and the calendar-year 2025 round
//                   are different reference periods: separate bundles.
//
// Hand checks (one value per bundle against the agency's own publication) are recorded at the
// head of each build function below.
//
// Usage: node scripts/fetch.mjs only services-isp services-nas ...   (bundles)
//        node scripts/lib/products/services.mjs --catalogue           (coverage catalogue)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { mospi, mospiAll } from "../mospi.mjs";
import { databankRoot, dbieReport } from "../databank.mjs";
import { writeSeries, writeRaw, monthAxis, quarterAxis, round2 } from "../util.mjs";

const ACC = "#2E4BD8";
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const num = (s) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const tidy = (s) => String(s).replace(/\s+/g, " ").trim();
const yearAxis = (y0, y1, mm = "04") => { const a = []; for (let y = y0; y <= y1; y++) a.push(`${y}-${mm}-01`); return a; };

// interior nulls are disclosed on the series that misses them (CONTRACT-series rule 2)
function discloseGaps(dates, series, note) {
  for (const s of Object.values(series)) {
    const first = s.data.findIndex((v) => v != null);
    if (first < 0) continue;
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && s.data[i] == null);
    if (gaps.length) { s.gaps = gaps; if (note) s.gapsNote = note; }
  }
  return series;
}
// drop series that are entirely empty and trim the axis to the bundle's published span
function trimBundle(dates, series) {
  for (const [k, s] of Object.entries(series)) if (!s.data.some((v) => v != null)) delete series[k];
  const any = (i) => Object.values(series).some((s) => s.data[i] != null);
  let a = 0, b = dates.length - 1;
  while (a < b && !any(a)) a++;
  while (b > a && !any(b)) b--;
  for (const s of Object.values(series)) { s.data = s.data.slice(a, b + 1); if (s.revisions) s.revisions = s.revisions.slice(a, b + 1); }
  return dates.slice(a, b + 1);
}
const colorFor = (i) => (i === 0 ? ACC : GREYS[(i - 1) % GREYS.length]);

/* =====================================================================================
 * 1. ISP: Index of Services Production (MoSPI, trial, base 2024-25=100)
 * Hand check (2026-10-09) against MoSPI's first ISP press release, 14 July 2026, Annexure 1:
 * 2025-26 annual index Retail Trade 130.5, Accommodation and food 135.6; April 2026 Retail
 * Trade 137.50, up 30.8%. Both bundles reproduce them (computed April y/y 30.83). MoSPI's
 * 29 July release: Retail Trade May 2026 up 13.3% (computed 13.29).
 * ===================================================================================== */
const ISP_MONTH = (fy, mc) => {
  const y1 = Number(String(fy).slice(0, 4));
  if (mc >= 1 && mc <= 9) return `${y1}-${String(mc + 3).padStart(2, "0")}`;
  if (mc >= 10 && mc <= 12) return `${y1 + 1}-${String(mc - 9).padStart(2, "0")}`;
  return null;
};

export async function buildServicesIsp(root, dcfg, vintage) {
  const ep = dcfg.fetch.endpoint;
  const monthly = [];
  for (let mc = 1; mc <= 12; mc++) {
    const rows = (await mospiAll(ep, { month_code: mc })).filter((r) => r.frequency === "Monthly");
    for (const r of rows) monthly.push({ ...r, month_code: mc });
  }
  const annual = (await mospiAll(ep, { frequency_code: 1 })).filter((r) => r.frequency === "Yearly");
  if (!annual.length || !monthly.length) throw new Error("services-isp: no data returned (annual or monthly ISP rows empty)");
  writeRaw(root, "data/raw/services-isp.json", { vintage, unit: "index, base 2024-25=100; growth_rate in per cent as published", annual, monthly });

  const lev = {}, pub = {}, label = {};
  for (const r of monthly) {
    const ym = ISP_MONTH(r.year, r.month_code); const v = num(r.index); if (!ym || v == null) continue;
    const k = slugify(r.broad_sub_sector); label[k] = tidy(r.broad_sub_sector);
    (lev[k] ??= new Map()).set(ym, v);
    const g = num(r.growth_rate); if (g != null) (pub[k] ??= new Map()).set(ym, g);
  }
  const keys = Object.keys(lev).sort();
  // y/y from levels, only where a same-base year-ago month exists
  const yoy = {}; const months = new Set();
  for (const k of keys) {
    yoy[k] = new Map();
    for (const [ym, v] of lev[k]) {
      const [y, m] = ym.split("-").map(Number); const p = lev[k].get(`${y - 1}-${String(m).padStart(2, "0")}`);
      if (p) { yoy[k].set(ym, round2((v / p - 1) * 100)); months.add(ym); }
    }
  }
  const ms = [...months].sort();
  if (!ms.length) throw new Error("services-isp: no month has a year-ago level yet");
  const axis = monthAxis(ms[0], ms.at(-1));
  const order = keys.sort((a, b) => (yoy[b].get(ms.at(-1)) ?? -1e9) - (yoy[a].get(ms.at(-1)) ?? -1e9));
  const series = {}, cross = {};
  order.forEach((k, i) => {
    series[k] = { name: `isp_${k}_yoy_pct`, label: label[k], color: colorFor(i), unit: "pct_yoy", data: axis.map((ym) => yoy[k].get(ym) ?? null) };
    cross[k] = axis.map((ym) => pub[k]?.get(ym) ?? null);
  });
  const meta = (extra) => ({ dossier: "services-isp", base: dcfg.base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });
  writeSeries(root, "data/series/services-isp-growth.json", {
    meta: meta({ frequency: "monthly", unit: "pct_yoy", latestPeriod: axis.at(-1),
      coverage: "All India, 19 service sub-sectors of the trial Index of Services Production; year-on-year change of the index, computed from index levels",
      note: "TRIAL SERIES. Year-on-year change computed from the published index levels (base 2024-25=100): the series opened in April 2025, so the first month with a year-ago level is April 2026. MoSPI's own published growth rate is kept per series as a crosscheck. ISP publishes no all-services aggregate: there is no headline, only the 19 sub-sectors." }),
    dates: axis.map((ym) => `${ym}-01`),
    series, crosscheck: cross,
  });

  // the one annual year (2025-26 against the 2024-25 base year = 100)
  const aYears = [...new Set(annual.map((r) => r.year))].sort();
  const aDates = aYears.map((fy) => `${fy.slice(0, 4)}-04-01`);
  const aKeys = [...new Set(annual.map((r) => slugify(r.broad_sub_sector)))];
  const aVal = (k, fy) => num(annual.find((r) => slugify(r.broad_sub_sector) === k && r.year === fy)?.index);
  const aOrder = aKeys.sort((a, b) => (aVal(b, aYears.at(-1)) ?? 0) - (aVal(a, aYears.at(-1)) ?? 0));
  const aSeries = {}, aCross = {};
  aOrder.forEach((k, i) => {
    const lab = tidy(annual.find((r) => slugify(r.broad_sub_sector) === k).broad_sub_sector);
    aSeries[k] = { name: `isp_${k}_annual_index`, label: lab, color: colorFor(i), unit: "index", data: aYears.map((fy) => aVal(k, fy)) };
    aCross[k] = aYears.map((fy) => num(annual.find((r) => slugify(r.broad_sub_sector) === k && r.year === fy)?.growth_rate));
  });
  writeSeries(root, "data/series/services-isp-annual.json", {
    meta: meta({ frequency: "annual", unit: "index", latestPeriod: aDates.at(-1).slice(0, 7),
      coverage: "All India, 19 service sub-sectors; annual (financial-year) index, base 2024-25=100",
      note: "TRIAL SERIES. One published year so far: 2025-26 against the base year 2024-25 = 100, so each value minus 100 is the year's growth. The published growth rate is kept as a crosscheck. Plotted at April of the financial year." }),
    dates: aDates, series: aSeries, crosscheck: aCross,
  });
}

/* =====================================================================================
 * 2. NAS: services GVA by industry and sub-industry, annual, both bases
 * Hand check (2026-10-09): 2022-23 base, Road Transport GVA 2024-25 (First Revised Estimates)
 * ₹6,75,415 crore current, ₹6,59,557 crore constant, as served on eSankhyiki; the identity
 * check in validate.mjs (groups = sum of parts within 0.02%) holds on both bases.
 * ===================================================================================== */
const REVISION_RANK = { "First Advance Estimates": 1, "Second Advance Estimates": 2, "Provisional Estimates": 3, "First Revised Estimates": 4,
  "Second Revised Estimates": 5, "Third Revised Estimates": 6, "Final Estimates": 7, "Additional Revision": 8 };
export const NAS_INDUSTRIES = {
  1: ["agriculture", "Agriculture, forestry and fishing", false], 2: ["mining", "Mining and quarrying", false], 3: ["manufacturing", "Manufacturing", false],
  4: ["utilities", "Electricity, gas, water and other utilities", false], 5: ["construction", "Construction", false],
  6: ["trade_transport_comm", "Trade, hotels, transport and communication", true], 7: ["trade_hotels", "Trade, repair, hotels and restaurants", true],
  8: ["transport_comm", "Transport, storage and communication", true], 9: ["finance_realty_prof", "Finance, real estate and professional services", true],
  10: ["finance", "Financial services", true], 11: ["realty_prof", "Real estate, ownership of dwellings and professional services", true],
  12: ["public_admin_other", "Public administration, defence and other services", true], 13: ["public_admin", "Public administration and defence", true],
  14: ["other_services", "Other services (education, health, personal)", true], 15: ["total_gva", "Total gross value added", false],
};
export const NAS_SUBINDUSTRIES = { // services sub-industries only (1-9 are farm and factory, the GDP guide's)
  10: [7, "trade_repair", "Trade and repair services"], 11: [7, "hotels_restaurants", "Hotels and restaurants"],
  12: [8, "railways", "Railways"], 13: [8, "road_transport", "Road transport"], 14: [8, "water_transport", "Water transport"],
  15: [8, "air_transport", "Air transport"], 16: [8, "transport_services", "Services incidental to transport"],
  17: [8, "storage", "Storage"], 18: [8, "communication", "Communication and broadcasting"],
};

function nasCollect(rows) {
  const cur = new Map(), con = new Map(), rank = new Map(), rev = new Map();
  for (const r of rows) {
    if (r.frequency !== "Annual") continue;
    const fy = String(r.year).match(/^(\d{4})-(\d{2})$/); if (!fy) continue;
    const d = `${fy[1]}-04-01`; const k = REVISION_RANK[r.revision] ?? 0;
    if (k < (rank.get(d) ?? -1)) continue;
    rank.set(d, k); rev.set(d, r.revision);
    const c = num(r.current_price), k2 = num(r.constant_price);
    if (c != null) cur.set(d, c); else cur.delete(d);
    if (k2 != null) con.set(d, k2); else con.delete(d);
  }
  return { cur, con, rev };
}

export async function buildServicesNas(root, dcfg, vintage) {
  for (const b of dcfg.fetch.bases) {
    const P = { ...dcfg.fetch.params, base_year: b.base_year, frequency_code: 1, indicator_code: 1 };
    const got = {}; const raw = { industries: {}, subindustries: {} };
    for (const [code, [key]] of Object.entries(NAS_INDUSTRIES)) {
      const rows = (await mospiAll(dcfg.fetch.endpoint, { ...P, industry_code: code })).filter((r) => r.subindustry == null && r.institutional_sector == null);
      raw.industries[key] = rows; got[key] = nasCollect(rows);
    }
    for (const [code, [parent, key]] of Object.entries(NAS_SUBINDUSTRIES)) {
      const rows = (await mospiAll(dcfg.fetch.endpoint, { ...P, industry_code: parent, subindustry_code: code })).filter((r) => r.subindustry != null);
      raw.subindustries[key] = rows; got[key] = nasCollect(rows);
    }
    if (!got.total_gva?.cur.size || !got.trade_hotels?.cur.size) throw new Error(`services-nas ${b.base_year}: no GVA returned (total or trade)`);
    writeRaw(root, `data/raw/services-nas-${b.slug}.json`, { vintage, base: b.base_year, unit: "₹ crore (current_price, constant_price as served)", ...raw });

    // the derived services aggregate: the three combined NAS service groups (6 + 9 + 12)
    const sum = (m, keys) => { const out = new Map(); for (const d of m[keys[0]].keys()) { const vs = keys.map((k) => m[k].get(d)); if (vs.every((v) => v != null)) out.set(d, vs.reduce((a, c) => a + c, 0)); } return out; };
    const curM = Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.cur]));
    const conM = Object.fromEntries(Object.entries(got).map(([k, v]) => [k, v.con]));
    // services = the three combined groups (6 + 9 + 12); where the NSO serves only the six finer
    // groups (7 + 8, 10 + 11, 13 + 14: the 2011-12 base before 2014-15) their sum stands in.
    // Both are sums of published parts with the same definition; validate.mjs checks they agree
    // wherever both exist, so this is never a join of two different measures.
    const G3 = ["trade_transport_comm", "finance_realty_prof", "public_admin_other"], G6 = ["trade_hotels", "transport_comm", "finance", "realty_prof", "public_admin", "other_services"];
    // per year the six finer groups win when all are published: on the 2011-12 base the NSO serves
    // the three combined groups only at advance and provisional stages, while the finer groups carry
    // the later revised estimates (checked 2026-10-09), so the parts are the more mature figure
    const basis = new Map();
    const both = (m, track) => { const a = sum(m, G3), c = sum(m, G6); for (const [d, v] of c) { a.set(d, v); if (track) basis.set(d, "six groups"); } if (track) for (const d of a.keys()) if (!basis.has(d)) basis.set(d, "three groups"); return a; };
    curM.services = both(curM, true);
    conM.services = both(conM, false);
    curM.services6 = sum(curM, G6);
    curM.goods = sum(curM, ["agriculture", "mining", "manufacturing", "utilities", "construction"]);
    const allD = [...curM.total_gva.keys()].sort();
    const dates = yearAxis(+allD[0].slice(0, 4), +allD.at(-1).slice(0, 4));
    const LAB = { services: "Services, all (derived from the published service groups)", goods: "Farms, mines, factories, utilities and construction (derived)" };
    for (const [, [k, l]] of Object.entries(NAS_INDUSTRIES)) LAB[k] = l;
    for (const [, [, k, l]] of Object.entries(NAS_SUBINDUSTRIES)) LAB[k] = l;
    const ORDER = ["services", "trade_transport_comm", "trade_hotels", "trade_repair", "hotels_restaurants", "transport_comm", "railways", "road_transport", "water_transport", "air_transport", "transport_services", "storage", "communication",
      "finance_realty_prof", "finance", "realty_prof", "public_admin_other", "public_admin", "other_services", "goods", "agriculture", "mining", "manufacturing", "utilities", "construction", "total_gva"];
    const subKeys = new Set(Object.values(NAS_SUBINDUSTRIES).map((x) => x[1]));
    const tag = (k) => (subKeys.has(k) ? "sub-industry" : k === "services" || k === "goods" ? "derived" : "industry");
    const mk = (fn, unit, nameSfx) => {
      const series = {};
      ORDER.forEach((k, i) => {
        if (!curM[k]) return;
        series[k] = { name: `gva_${k}_${nameSfx}${b.nameSuffix}`, label: LAB[k], color: k === "services" ? ACC : GREYS[i % 4], unit, level: tag(k), data: dates.map((d) => fn(k, d)),
          // which NSO estimate each year's figure is (derived totals: built from which groups)
          revisions: dates.map((d) => (k === "services" ? basis.get(d) ?? null : k === "goods" ? "sum of five industries" : got[k]?.rev.get(d) ?? null)) };
      });
      return series;
    };
    const share = mk((k, d) => { const v = curM[k].get(d), t = curM.total_gva.get(d); return v != null && t ? round2((v / t) * 100) : null; }, "pct_of_gva", "share_pct");
    delete share.total_gva;
    const growth = mk((k, d) => { const y = +d.slice(0, 4); const v = conM[k]?.get(d), p = conM[k]?.get(`${y - 1}-04-01`); return v != null && p ? round2((v / p - 1) * 100) : null; }, "pct_yoy", "real_yoy_pct");
    // services only, with total GVA as the yardstick: farm and factory growth is the GDP guide's
    for (const k of ["goods", "agriculture", "mining", "manufacturing", "utilities", "construction"]) delete growth[k];
    const level = mk((k, d) => r3(curM[k].get(d) != null ? curM[k].get(d) / 1e5 : null), "inr_lakh_crore", "current_inr_lakh_crore");
    // the identity behind the derived total: sum of the six finer groups, kept as a crosscheck
    const levelCross = { services_from_six_groups: dates.map((d) => r3(curM.services6.get(d) != null ? curM.services6.get(d) / 1e5 : null)) };
    // which estimate each year is: the latest year is usually provisional or an advance estimate
    const revNote = dates.map((d) => `${d.slice(0, 4)}-${String((+d.slice(2, 4) + 1) % 100).padStart(2, "0")}: ${got.total_gva.rev.get(d) ?? "n/a"}`).join("; ");
    const meta = (extra) => ({ dossier: "services-nas", frequency: "annual", base: b.base_year, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
      releaseDate: null, revisionPolicy: dcfg.revision_policy, estimates: revNote, ...extra });
    const out = (suffix, series, extra) => {
      const d2 = trimBundle(dates, series);
      discloseGaps(d2, series, "The NSO publishes this cut for fewer years than the industry totals.");
      const cross = suffix === "level" ? { services_from_six_groups: levelCross.services_from_six_groups.slice(dates.indexOf(d2[0]), dates.indexOf(d2.at(-1)) + 1) } : undefined;
      writeSeries(root, `data/series/services-gva-${b.slug}-${suffix}.json`, { meta: meta({ latestPeriod: d2.at(-1).slice(0, 7), ...extra }), dates: d2, series, ...(cross ? { crosscheck: cross } : {}) });
    };
    out("share", share, { unit: "pct_of_gva", coverage: `All India, annual, base ${b.base_year}: each industry's and sub-industry's share of total GVA at current prices`, note: `Shares of nominal (current-price) GVA, computed from the published levels. "Services, all" is the sum of the NSO's three service groups (trade, hotels, transport and communication; finance, real estate and professional services; public administration, defence and other services), built per year from the six finer groups when all six are published (they carry the NSO's later revised estimates; the combined groups on the 2011-12 base are served only at advance and provisional stages) and from the three groups otherwise; the series' "revisions" field names which. It is derived, not published. Base ${b.base_year} only; never joined to the other base.` });
    out("growth", growth, { unit: "pct_yoy", coverage: `All India, annual, base ${b.base_year}: real growth of GVA, service industries and sub-industries, and total GVA`, note: `Real growth computed from constant-price levels (base ${b.base_year} prices). Each year uses the NSO's most mature estimate for that year; the latest years are provisional or advance estimates and will be revised.` });
    out("level", level, { unit: "inr_lakh_crore", coverage: `All India, annual, base ${b.base_year}: GVA at current prices, ₹ lakh crore`, note: "GVA at current prices, converted from ₹ crore to ₹ lakh crore. The derived service and goods totals are sums of published groups." });
  }
}

/* =====================================================================================
 * 3. Services trade: RBI DBIE via the local Data Bank (read-only)
 *   1501  India's International Trade in Services, monthly: receipts, payments, net (US$).
 *   1076  Invisibles by Category of Transactions, quarterly, two blocks in one report:
 *         "BPM6" (the standard presentation: services 1.A.b and its 13 categories with
 *         sub-items, credit/debit/net) and the purpose-code tables "Invisibles Receipts" /
 *         "Invisible Payments" (software, R&D, legal, accounting, consultancy...).
 *   807   Invisibles by Category of Transactions, annual, US$, 1950-51 on, in the older
 *         presentation (travel, transportation, insurance, G.n.i.e., miscellaneous; software,
 *         business, financial and communication services from 1992-93).
 * The DBIE extracts repeat each value once per display unit (NUMBER, CRORES, ...): one row is
 * kept per (item, flow, period, version). Versions: the most mature per period is kept
 * (Final > Partially Revised > Provisional > Preliminary Estimates). Amounts are US dollars.
 * The BPM6 quarterly block and the annual BPM5-style table are different presentations:
 * separate bundles, never joined.
 * Hand checks (2026-10-09): RBI press release of 27 June 2025 (BoP, Q4 2024-25): net services
 * US$ 53.3 bn in Jan-Mar 2025 and 42.7 bn a year earlier; here 53,314 and 42,684 (US$ mn).
 * RBI's Q2 2024-25 release: 44.5 bn; here 44,461. RBI's 30 June 2026 release on monthly
 * services trade: May 2026 receipts 33,355 and payments 17,637 (US$ mn); here 33.355 and
 * 17.637 bn. (RBI revised May on 30 September 2026; DBIE had not picked that up.)
 * ===================================================================================== */
const VRANK = { "Final": 4, "Partially Revised": 3, "Revised": 3, "Provisional": 2, "Preliminary Estimates": 1 };
const qStart = (td) => { const y = +td.slice(0, 4), m = +td.slice(5, 7); const sm = m - 2; return `${y}-${String(sm).padStart(2, "0")}-01`; };
const usdMn = (v) => (v == null ? null : Math.round(v / 1e5) / 10);   // US$ -> US$ million, 1 decimal

// keep the most mature version per key; returns Map(key -> {v, version})
function bestVersion(rows, keyOf, valOf, verOf) {
  const out = new Map();
  for (const r of rows) {
    const k = keyOf(r); if (k == null) continue;
    const v = valOf(r); if (v == null) continue;
    const rk = VRANK[verOf(r)] ?? 0; const prev = out.get(k);
    if (!prev || rk > prev.rank) out.set(k, { v, rank: rk, version: verOf(r) });
  }
  return out;
}

export async function buildServicesTrade(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const R1501 = dbieReport(db, "1501"), R1076 = dbieReport(db, "1076"), R807 = dbieReport(db, "807");
  const aligned = (r) => /^\d{4}\/\d\d\/\d\d/.test(r["Time Date"] ?? "");
  // what we read, one unit per value (the unit repeats carry no information)
  const oneUnit = (rows, uCol) => { const seen = new Set(); return rows.filter((r) => { const k = JSON.stringify({ ...r, [uCol]: "", Unit: "" }); if (seen.has(k)) return false; seen.add(k); return true; }); };
  const svc1076 = oneUnit(R1076.rows.filter((r) => aligned(r) && (
    (r["System Type"] === "BPM6" && /^1\.A(\.b(\.|$)|$|\.a$)/.test(r["Item Display Order"])) ||
    (r["System Type"] === "Invisibles Receipts" && +r["Item Display Order"] >= 6 && +r["Item Display Order"] <= 95) ||
    (r["System Type"] === "Invisible Payments" && +r["Item Display Order"] >= 125 && +r["Item Display Order"] <= 223))), "Unit Description");
  const svc807 = oneUnit(R807.rows.filter((r) => /^1\.(1|2|2\.1(\.\d)*) /.test(r["Item Desc"] ?? "")), "Unit Description");
  if (!R1501.rows.length || !svc1076.length || !svc807.length) throw new Error("services-trade: no data returned (DBIE 1501, 1076 or 807 empty in the Data Bank)");
  const misaligned = R1076.rows.length - R1076.rows.filter(aligned).length;
  writeRaw(root, "data/raw/services-trade.json", {
    vintage,
    note: "RBI DBIE reports 1501 (monthly services trade), 1076 (invisibles by category, quarterly: the BPM6 rows under 1.A and every row of the services part of the purpose-code tables) and 807 (invisibles by category, annual: services, merchandise and invisibles rows), read from the local Data Bank mirror. One row per value: DBIE repeats each value once per display unit and the copies are dropped. Amounts in US dollars.",
    misaligned_rows_1076: misaligned,
    reports: {
      1501: { provenance: R1501.provenance, header: R1501.header, rows: R1501.rows },
      1076: { provenance: R1076.provenance, header: R1076.header, rows: svc1076 },
      807: { provenance: R807.provenance, header: R807.header, rows: svc807 },
    },
  });
  const meta = (extra) => ({ dossier: "services-trade", base: dcfg.base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });

  /* ---- 1501: monthly ---- */
  {
    const m = new Map(); const KEY = { "1": "exports", "2": "imports", "3": "net" };
    for (const r of R1501.rows) { const k = KEY[r["Item Code"]]; const v = num(r["Item Value"]); if (!k || v == null) continue; m.set(`${k}|${r["Time Date"].slice(0, 7).replace("/", "-")}`, v); }
    const ms = [...new Set([...m.keys()].map((k) => k.split("|")[1]))].sort();
    const axis = monthAxis(ms[0], ms.at(-1));
    const L = { exports: ["Services exports (receipts)", ACC], imports: ["Services imports (payments)", "#C47A16"], net: ["Net services (surplus)", "#878D99"] };
    const series = Object.fromEntries(Object.entries(L).map(([k, [l, c]]) => [k, { name: `services_${k}_usd_bn`, label: l, color: c, unit: "usd_bn", data: axis.map((ym) => r3(m.has(`${k}|${ym}`) ? m.get(`${k}|${ym}`) / 1e9 : null)) }]));
    discloseGaps(axis.map((ym) => `${ym}-01`), series, "The RBI's monthly table skips this month.");
    writeSeries(root, "data/series/services-trade-monthly.json", { meta: meta({ frequency: "monthly", unit: "usd_bn", latestPeriod: axis.at(-1),
      coverage: "All India, monthly receipts and payments for services, US$ billion",
      note: "RBI DBIE report 1501, the monthly data on India's international trade in services released about 45 days after the month. Provisional: revised when the quarterly balance of payments is compiled, so the three months of a quarter need not add to the BoP quarter." }),
      dates: axis.map((ym) => `${ym}-01`), series });
  }

  /* ---- 1076 BPM6 block: quarterly, by category ---- */
  {
    const rows = svc1076.filter((r) => r["System Type"] === "BPM6");
    const FLOW = { Credit: "credit", Debit: "debit", Net: "net" };
    const best = bestVersion(rows, (r) => FLOW[r["Cdn Description"]] ? `${r["Item Display Order"]}|${FLOW[r["Cdn Description"]]}|${qStart(r["Time Date"])}` : null, (r) => num(r.Amount), (r) => r["Version Desc"]);
    const items = new Map(); for (const r of rows) items.set(r["Item Display Order"], tidy(r["Item Description"].replace(/^[\d.A-Za-z]+\s+/, "").replace(/\s*\([^)]*\)\s*$/, "")));
    const qs = [...new Set([...best.keys()].map((k) => k.split("|")[2]))].sort();
    const axis = quarterAxis(qs[0].slice(0, 7), qs.at(-1).slice(0, 7)).map((ym) => `${ym}-01`);
    const order = [...items.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
    const series = {}; const versions = {};
    order.forEach((code) => {
      for (const fl of ["credit", "debit", "net"]) {
        const key = `${code.toLowerCase().replace(/\./g, "_")}_${fl}`;
        const data = axis.map((d) => usdMn(best.get(`${code}|${fl}|${d}`)?.v ?? null));
        if (!data.some((v) => v != null)) continue;
        const what = code === "1.A" ? "Goods and services" : code === "1.A.a" ? "Goods" : code === "1.A.b" ? "Services, all" : items.get(code);
        const top = code.split(".").slice(0, 4).join(".");
        series[key] = { name: `bop_${key}_usd_mn`, label: `${what}, ${fl === "credit" ? "exports (credit)" : fl === "debit" ? "imports (debit)" : "net"}`, code, flow: fl,
          group: top === code && code.split(".").length < 4 ? (code === "1.A.b" ? "Services, all" : "Goods, for context") : `${top} ${items.get(top) ?? ""}`.trim(),
          color: code === "1.A.b" && fl === "credit" ? ACC : "#A3A9B4", unit: "usd_mn", data };
      }
    });
    for (const d of axis) versions[d] = best.get(`1.A.b|credit|${d}`)?.version ?? null;
    discloseGaps(axis, series, "The RBI publishes this sub-item only from a later quarter of the BPM6 tables, or not for this quarter.");
    writeSeries(root, "data/series/services-bop-quarterly.json", { meta: meta({ frequency: "quarterly", unit: "usd_mn", latestPeriod: axis.at(-1).slice(0, 7),
      coverage: "All India, services trade by BPM6 category and sub-item, credit (exports), debit (imports) and net, quarterly, US$ million; goods and the goods-and-services total for context",
      note: "RBI DBIE report 1076, standard presentation of the balance of payments (BPM6). Quarters dated at their first month (Q1 = April). For each quarter the most mature version is kept; meta.versions names it for the services total. The external guide owns the balance of payments as a whole; this bundle is its services detail.",
      versions }), dates: axis, series });
  }

  /* ---- 1076 purpose-code block: quarterly detail ---- */
  {
    const rows = svc1076.filter((r) => r["System Type"] !== "BPM6");
    const flowOf = (r) => (r["System Type"] === "Invisibles Receipts" ? "receipts" : "payments");
    const best = bestVersion(rows, (r) => `${flowOf(r)}|${r["Item Display Order"]}|${qStart(r["Time Date"])}`, (r) => num(r.Amount), (r) => r["Version Desc"]);
    const items = new Map(); for (const r of rows) items.set(`${flowOf(r)}|${r["Item Display Order"]}`, tidy(r["Item Description"]));
    const qs = [...new Set([...best.keys()].map((k) => k.split("|")[2]))].sort();
    const axis = quarterAxis(qs[0].slice(0, 7), qs.at(-1).slice(0, 7)).map((ym) => `${ym}-01`);
    const series = {};
    [...items.keys()].sort((a, b) => { const [fa, xa] = a.split("|"), [fb, xb] = b.split("|"); return fa === fb ? +xa - +xb : fa < fb ? 1 : -1; }).forEach((ik) => {
      const [fl, ord] = ik.split("|");
      const data = axis.map((d) => usdMn(best.get(`${fl}|${ord}|${d}`)?.v ?? null));
      if (!data.some((v) => v != null)) return;
      series[`${fl === "receipts" ? "r" : "p"}${ord}`] = { name: `invisibles_${fl}_${ord}_usd_mn`, label: `${items.get(ik)} (${fl})`, flow: fl, order: +ord, group: fl === "receipts" ? "Receipts" : "Payments",
        color: "#A3A9B4", unit: "usd_mn", data };
    });
    // quarantine: a quarter whose services total runs > 2.5x the mean of its neighbours holds a
    // year's figures, not a quarter's (seen 2026-10-09: Jan-Mar 2013 carries 2012-13 in full,
    // receipts 145.7 bn against ~37 bn either side, in every item). Nulled here, kept in raw.
    const quarantined = [];
    for (const tot of ["r6", "p125"]) {
      const d = series[tot]?.data; if (!d) continue;
      for (let i = 1; i < d.length - 1; i++) {
        const nb = [d[i - 1], d[i + 1]].filter((v) => v != null);
        if (d[i] != null && nb.length && d[i] > 2.5 * (nb.reduce((a, c) => a + c, 0) / nb.length)) quarantined.push(`${tot[0]}|${axis[i]}`);
      }
    }
    for (const q of quarantined) {
      const [fl, d] = q.split("|"); const i = axis.indexOf(d);
      for (const s of Object.values(series)) if (s.flow[0] === fl) s.data[i] = null;
    }
    const qDates = [...new Set(quarantined.map((q) => q.split("|")[1]))];
    discloseGaps(axis, series, "The RBI's purpose-code table has no entry for this item in this quarter.");
    for (const s of Object.values(series)) if (s.gaps?.some((g) => qDates.includes(g))) s.gapsNote = `Quarantined: the RBI's table carries a full year's figures under ${qDates.map((d) => d.slice(0, 7)).join(", ")} (about four times either neighbour, in every item); kept as served in the raw archive. Other gaps: the table has no entry for this item in this quarter.`;
    writeSeries(root, "data/series/services-invisibles-quarterly.json", { meta: meta({ frequency: "quarterly", unit: "usd_mn", latestPeriod: axis.at(-1).slice(0, 7),
      coverage: "All India, services receipts and payments by purpose code (software, R&D, legal, accounting, consulting, health, education and the rest), quarterly, US$ million",
      note: "RBI DBIE report 1076, the invisibles-by-category tables under 'A) Services', built from banks' purpose-code reporting. The labels and their nesting are the RBI's own (series 'order' is its display order). This block runs a few quarters behind the BPM6 block and does not reconcile exactly with it. Quarantined quarters (a year's figures filed under one quarter) are null and named in each series' gapsNote; the rows stay in the raw archive.", quarantined: [...new Set(quarantined)] }),
      dates: axis, series });
  }

  /* ---- 807: annual, 1950-51 on (older presentation) ---- */
  {
    const FLOW = { Credit: "credit", Debit: "debit", Net: "net" };
    const best = bestVersion(svc807, (r) => FLOW[r["cdn_description"]] ? `${r["Item Desc"].split(" ")[0]}|${FLOW[r["cdn_description"]]}|${r["Year"].slice(0, 4)}-04-01` : null, (r) => num(r.amount), (r) => r["Version Desc"]);
    const items = new Map(); for (const r of svc807) items.set(r["Item Desc"].split(" ")[0], tidy(r["Item Desc"].replace(/^[\d.]+\s+/, "")));
    const ys = [...new Set([...best.keys()].map((k) => k.split("|")[2]))].sort();
    const axis = yearAxis(+ys[0].slice(0, 4), +ys.at(-1).slice(0, 4));
    const NICE = { "1.1": "Merchandise (goods)", "1.2": "Invisibles, all", "1.2.1": "Services, all", "1.2.1.1": "Travel", "1.2.1.2": "Transportation", "1.2.1.3": "Insurance",
      "1.2.1.4": "Government, not included elsewhere", "1.2.1.5": "Miscellaneous", "1.2.1.5.1": "Software services", "1.2.1.5.2": "Business services", "1.2.1.5.3": "Financial services", "1.2.1.5.4": "Communication services" };
    const series = {};
    for (const code of Object.keys(NICE)) for (const fl of ["credit", "debit", "net"]) {
      if (!items.has(code)) continue;
      const data = axis.map((d) => usdMn(best.get(`${code}|${fl}|${d}`)?.v ?? null));
      if (!data.some((v) => v != null)) continue;
      const key = `s${code.replace(/\./g, "_")}_${fl}`;
      series[key] = { name: `invisibles_${code.replace(/\./g, "_")}_${fl}_usd_mn`, label: `${NICE[code]}, ${fl === "credit" ? "receipts" : fl === "debit" ? "payments" : "net"}`, code, flow: fl,
        color: code === "1.2.1" && fl === "credit" ? ACC : "#A3A9B4", unit: "usd_mn", data };
    }
    discloseGaps(axis, series, "The RBI's annual table has no entry for this item in this year.");
    const d2 = trimBundle(axis, series);
    writeSeries(root, "data/series/services-bop-annual.json", { meta: meta({ frequency: "annual", unit: "usd_mn", latestPeriod: d2.at(-1).slice(0, 7),
      coverage: "All India, services receipts and payments by the older RBI categories, financial years from 1950-51, US$ million; merchandise and all invisibles for context",
      note: "RBI DBIE report 807 (Handbook of Statistics on the Indian Economy, invisibles by category of transactions). An older presentation than BPM6: 'Miscellaneous' holds software, business, financial and communication services, split out from 1992-93. Plotted at April of the financial year. Never joined to the BPM6 quarterly bundle. As published, the 1985-86 services row does not add up: receipts 3,316 less payments 2,124 is 1,192, but the net printed is 1,187 (US$ million); kept as published." }),
      dates: d2, series });
  }
}

/* =====================================================================================
 * 4. Services jobs: PLFS indicator 4, the percentage distribution of workers
 * Every cut the indicator serves is kept: NIC section (21), NIC group (trade, transport,
 * accommodation and food, other services), worker status within each group, enterprise type
 * and size within each group, and the broad sector under CWS; by gender and rural/urban.
 * Values are per cent of workers as published (the cells of each table add to 100).
 * The server rejects age/gender/sector params for this indicator: rows are fetched per year,
 * unfiltered (as plfs.mjs does), and every row kept.
 * Hand check (2026-10-09): agriculture year 2023-24, all persons, rural + urban, CWS: services
 * 31.6% of workers, matching the plfs guide's plfs-status bundle (industry_tertiary_person,
 * 31.6), itself checked against the PLFS annual report. The NIC sections add to 100 in every
 * cell (validate.mjs).
 * ===================================================================================== */
const JOB_DIMS = ["broad_industry_work", "broad_status_employment", "enterprise_size", "enterprise_type", "industry_section", "nco_division", "nic_group"];
const isAll = (v) => v == null || v === "all" || v === "All";
const SHORT = {
  broad_industry_work: { "primary sector (Div. 01-03 of NIC 2008)": ["primary", "Farming (NIC 01-03)"], "secondary sector (Div. 05-43 of NIC 2008)": ["secondary", "Industry and construction (NIC 05-43)"], "tertiary sector (Div. 45-99 of NIC 2008)": ["tertiary", "Services (NIC 45-99)"] },
  broad_status_employment: { "1.self-employed: own account worker, employer": ["own_account", "own-account workers and employers"], "2.self-employed: helper in household enterprise": ["helper", "unpaid helpers in family enterprises"], "3.all self employed": ["self_employed", "all self-employed"], "4.regular wage/salary": ["regular", "regular wage or salary"], "5.casual labour": ["casual", "casual labour"] },
};
const jobKey = (dim, v) => {
  const m = SHORT[dim]?.[v]; if (m) return m;
  if (dim === "industry_section") { const [code, ...rest] = v.split("_"); return [`sec_${code.toLowerCase()}`, `${code}: ${rest.join("_").replace(/hhds/g, "households").replace(/actvs/g, "activities").replace(/undiff/g, "undifferentiated").replace(/prod /, "producing ")}`]; }
  if (dim === "nic_group") { const g = { "45-47 (trade)": "trade", "49-53( transport)": "transport", "55-56 (accommodation & food services": "accommodation_food", "58-99 (other services)": "other_services", "45-99 (tertiary)": "tertiary",
    "01-03 (agriculture)": "agriculture", "05-09 (mining & quarrying)": "mining", "10-33 (manufacturing)": "manufacturing", "35-39 (electricity and water supply)": "utilities", "41-43 (construction)": "construction", "05-43 (secondary)": "secondary",
    "industry: (05-99)": "nonfarm", "industry: (014, 016, 017 , 02-99)": "nonfarm_wide" }[v]; const L = { trade: "Trade (NIC 45-47)", transport: "Transport (NIC 49-53)", accommodation_food: "Accommodation and food (NIC 55-56)", other_services: "Other services (NIC 58-99)", tertiary: "Services (NIC 45-99)",
      agriculture: "Farming (NIC 01-03)", mining: "Mining (NIC 05-09)", manufacturing: "Manufacturing (NIC 10-33)", utilities: "Electricity and water (NIC 35-39)", construction: "Construction (NIC 41-43)", secondary: "Industry (NIC 05-43)",
      nonfarm: "Non-farm (NIC 05-99)", nonfarm_wide: "Non-farm, wide (NIC 014, 016, 017, 02-99)" }; return [g ?? slugify(v), L[g] ?? v]; }
  if (dim === "enterprise_type") return [`ent_${slugify(v.replace(/^\d+\./, ""))}`, `enterprise: ${v.replace(/^\d+\./, "")}`];
  if (dim === "enterprise_size") return [`size_${slugify(v).replace(/^_*/, "") || "x"}`.replace("size_20", "size_20plus"), `enterprise size ${v} workers`];
  if (dim === "nco_division") return [`nco_${slugify(v.split(":")[0])}`, v];
  return [slugify(v), v];
};

export async function buildServicesJobs(root, dcfg, vintage) {
  const ep = dcfg.fetch.endpoint, ic = dcfg.fetch.indicator_code;
  const fetchYears = async (years, type) => { const out = []; for (const y of years) out.push(...await mospiAll(ep, { indicator_code: ic, frequency_code: 1, year: y, year_type_code: type, state_code: 99 })); return out; };
  const ay = await fetchYears(dcfg.fetch.agriculture_years, 1);
  const cy = await fetchYears(dcfg.fetch.calendar_years, 2);
  if (!ay.length || !cy.length) throw new Error("services-jobs: no PLFS indicator-4 rows returned (agriculture or calendar years)");
  writeRaw(root, "data/raw/services-jobs.json", { vintage, unit: "per cent of workers", note: "PLFS indicator 4 (percentage distribution of workers), All India, every row served for each agriculture year and calendar year, unfiltered.", agriculture_years: ay, calendar_years: cy });
  bakeServicesJobs(root, dcfg, vintage, ay, cy);
}

/* The bake, from the archived rows (data/raw/services-jobs.json); runnable without the network.
 * The calendar-year estimates span two PLFS survey designs (MoSPI, "Changes in Periodic Labour
 * Force Survey from 2025"): 2023 and 2024 come from the original design, 2025 on from the
 * revamped one. Two rulers, two bundles (AGENTS.md rule 1; sources.yml seams: services-jobs,
 * the same split as seams: plfs). Fixed 2026-10-10 by atlas-jobs-deep: the bundle used to join
 * them. */
export function bakeServicesJobs(root, dcfg, vintage, ay, cy) {
  const build = (rows, dateOf, slug, extra) => {
    const cells = new Map(); const labels = new Map(); const order = [];
    for (const r of rows) {
      if (r.state !== "All India") continue;
      const v = num(r.value); if (v == null) continue;
      const parts = JOB_DIMS.filter((d) => !isAll(r[d])).map((d) => jobKey(d, r[d]));
      if (!parts.length) continue;   // the all-workers total (100) carries nothing
      const g = r.gender === "person" ? "person" : r.gender, sec = r.sector === "rural + urban" ? "all" : r.sector, ws = r.weekly_status === "CWS" ? "cws" : "ps";
      const key = `${parts.map((p) => p[0]).join("__")}__${g}_${sec}_${ws}`;
      // a lone NIC group (or the non-farm block) is the 100% total of a within-group table, or an
      // undocumented row; it carries no information and is left out (coverage ledger: excluded)
      if (parts.length === 1 && JOB_DIMS.filter((d) => !isAll(r[d]))[0] === "nic_group") continue;
      if (!labels.has(key)) {
        const dims = JOB_DIMS.filter((d) => !isAll(r[d]));
        const grp = dims.includes("nic_group") ? parts[dims.indexOf("nic_group")][1] : null;
        const rest = parts.filter((_, i) => dims[i] !== "nic_group").map((p) => p[1]).join(", ");
        const what = grp ? `${grp} workers: share ${dims.includes("broad_status_employment") ? "who are " : "in "}${rest}` : dims[0] === "industry_section" || dims[0] === "broad_industry_work" ? `Share of all workers in ${rest}` : `Share of all workers: ${rest}`;
        labels.set(key, `${what}; ${g === "person" ? "all persons" : g === "male" ? "men" : "women"}, ${sec === "all" ? "rural and urban" : sec}, ${ws === "cws" ? "current weekly status" : "usual status"}`); order.push(key);
      }
      const d = dateOf(r.year); const k2 = `${key}|${d}`;
      if (cells.has(k2) && cells.get(k2) !== v) process.stdout.write(`services-jobs WARN ${key} ${d}: ${cells.get(k2)} vs ${v}, kept first\n`);
      else cells.set(k2, v);
    }
    const ds = [...new Set([...cells.keys()].map((k) => k.split("|")[1]))].sort();
    const dates = yearAxis(+ds[0].slice(0, 4), +ds.at(-1).slice(0, 4), ds[0].slice(5, 7));
    const series = {};
    const fam = (key) => key.startsWith("sec_") ? "Industry (NIC section)" : key.startsWith("nco_") ? "Occupation (NCO division)" : /^(ent_|size_)/.test(key) ? "Non-farm workers by enterprise type and size"
      : /^(primary|secondary|tertiary)__.*_cws$/.test(key) ? "Broad industry (current weekly status)" : key.split("__").length > 2 ? "Status within each industry group" : "Status of all workers";
    for (const key of order) series[key] = { name: `plfs_workers_${key}_pct`, label: labels.get(key), group: fam(key), color: /^sec_[g-u]__|^tertiary__|^trade__|^transport__|^accommodation_food__|^other_services__/.test(key) ? ACC : "#A3A9B4", unit: "pct_of_workers", data: dates.map((d) => cells.get(`${key}|${d}`) ?? null) };
    discloseGaps(dates, series, "The PLFS report did not publish this cell for this year.");
    writeSeries(root, `data/series/${slug}.json`, { meta: { dossier: "services-jobs", frequency: "annual", unit: "pct_of_workers", source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
      releaseDate: null, revisionPolicy: dcfg.revision_policy, latestPeriod: dates.at(-1).slice(0, 7), ...extra }, dates, series });
  };
  build(ay, (y) => `${String(y).slice(0, 4)}-07-01`, "services-jobs-ay", { base: "agriculture year (PLFS 2017-18 to 2023-24)",
    coverage: "All India, workers aged 15 and above; percentage distribution by industry (NIC 2008 section and group), by status within each industry group, by enterprise type and size within each group; men, women and all; rural, urban and both; usual status (PS+SS) and current weekly status",
    note: "PLFS annual reports, agriculture years (July to June) plotted at July. Each key names its cut: sec_<letter> is a NIC section, trade/transport/accommodation_food/other_services/tertiary are NIC groups, and a status, enterprise type or size before the group is a distribution of that group's workers. Separate from the calendar-year estimates (services-jobs-cy): a different survey design." });
  const NEW_FROM = 2025;   // the revamped PLFS design's first calendar year
  build(cy.filter((r) => +String(r.year).slice(0, 4) < NEW_FROM), (y) => `${String(y).slice(0, 4)}-01-01`, "services-jobs-cy", { base: "calendar year (PLFS original design, to 2024)",
    coverage: "All India, workers aged 15 and above; percentage distribution by NIC section and the other cuts the calendar-year estimates publish; men, women and all; rural, urban and both; calendar years on the survey's original design",
    note: "PLFS calendar-year estimates from the survey's original design (MoSPI released calendar-year results for 2022, 2023 and 2024 from it), plotted at January. Never joined to the revamped design's calendar years (services-jobs-cy25) or to the agriculture-year reports (services-jobs-ay)." });
  build(cy.filter((r) => +String(r.year).slice(0, 4) >= NEW_FROM), (y) => `${String(y).slice(0, 4)}-01-01`, "services-jobs-cy25", { base: dcfg.base,
    coverage: "All India, workers aged 15 and above; percentage distribution by NIC section and the other cuts the calendar-year estimates publish; men, women and all; rural, urban and both; calendar years on the survey's revamped design (from January 2025)",
    note: "PLFS calendar-year estimates from the revamped design (from January 2025: a rotational panel in rural and urban areas, households visited four months running), plotted at January. MoSPI publishes no link to the original design's years (services-jobs-cy): two rulers, never joined." });
}

/* =====================================================================================
 * 5. Informal service enterprises: ASUSE (MoSPI), by service activity
 * The factories guide bakes ASUSE at the broad level (manufacturing, trading, other services);
 * this adds every service ACTIVITY the survey publishes, for every indicator that carries the
 * activity dimension. Quarantine carried over from asuse.mjs: GVA per establishment (34) is
 * baked for all establishments only, because the source's HWE and OAE rows are mislabelled.
 * Hand check (2026-10-09): ASUSE 2023-24, Other Services, rural, all establishments:
 * 1,62,12,760 establishments, identical to the factories guide's asuse-sectors bundle; this
 * agreement is asserted in validate.mjs for three aggregates.
 * ===================================================================================== */
export const ASUSE_SERVICE_ACTIVITIES = [
  "Wholesale and Retail Trade of Motor Vehicles and Motor Cycles", "Maintenance and Repair of Motor Vehicles and Motor Cycles", "Wholesale on a Fee or Contract Basis",
  "Other Wholesale Trade", "Other Retail Trade", "Trading Activities", "Accommodation", "Food and Accommodation Service Activities", "Land Transport", "Water Transport",
  "Warehousing and Storage", "Support Activities for Transportation, Postal and Courier Activities", "Information and Communication",
  "Financial Service Activities Except Insurance and Pension Funding", "Other Financial Activities", "Real Estate Activities", "Professional, Scientific and Technical Activities",
  "Administrative and Support Service Activities", "Education", "Human Health and Social Work Activities", "Other Community, Social and Personal Service Activities", "Other Services", "All",
];
const ASUSE_IND = { 1: "establishments", 3: "ownership", 6: "owner_social_group", 10: "location", 12: "operation", 14: "months_operated", 16: "hours", 22: "registration",
  26: "workers", 30: "emoluments", 32: "gva_per_worker", 34: "gva_per_establishment" };
const ASUSE_CORE = new Set([1, 26, 30, 32, 34]);
const ASUSE_FIXED = new Set(["indicator", "frequency", "year", "state/UT", "sector", "activity_category", "establishment_type", "value"]);
const ET_KEY = { "Hired Worker Establishments(HWE)": "hwe", "Own Account Establishments(OAE)": "oae", "All Establishments(All)": "all" };
const ACT_KEY = (a) => ({ "Trading Activities": "trading", "Other Services": "other_services_group", "All": "all_activities",
  // spelled short: the full slug ends in a word the render gate reserves for smoothing curves
  "Wholesale on a Fee or Contract Basis": "wholesale_on_fee_or_contract" }[a] ?? slugify(a));

export async function buildServicesAsuse(root, dcfg, vintage) {
  const keep = new Set(ASUSE_SERVICE_ACTIVITIES);
  const byInd = {}; let total = 0;
  for (const code of dcfg.fetch.indicators) {
    byInd[code] = [];
    for (const y of dcfg.fetch.years) {
      const rows = await mospiAll(dcfg.fetch.endpoint, { indicator_code: code, year: y });
      total += rows.length;
      byInd[code].push(...rows.filter((r) => keep.has(tidy(r.activity_category ?? "")) && (r["state/UT"] ?? "All India") === "All India"));
    }
    process.stdout.write(`services-asuse: indicator ${code}, ${byInd[code].length} service rows kept\n`);
  }
  if (!byInd[1]?.length || !byInd[26]?.length) throw new Error("services-asuse: no establishment or worker rows returned for service activities");
  writeRaw(root, "data/raw/services-asuse.json", { vintage, note: `ASUSE rows for service activities (and the All, Trading Activities and Other Services aggregates), All India, every indicator that carries the activity dimension; ${total} rows read in all, manufacturing activities left to the factories guide's raw dump.`, records: byInd });

  const fiscal = (y) => /^\d{4}-\d{2}$/.test(y);
  for (const [round, pick, dateOf, base, sfx] of [
    ["fiscal", fiscal, (y) => `${y.slice(0, 4)}-04-01`, dcfg.base, ""],
    ["2025", (y) => /^\d{4}$/.test(y), (y) => `${y}-01-01`, "calendar-year round (ASUSE 2025)", "-2025"],
  ]) {
    for (const part of ["core", "profile"]) {
      const cells = new Map(), labels = new Map(), units = new Map(), groups = new Map(), order = [];
      for (const [code, rows] of Object.entries(byInd)) {
        if ((part === "core") !== ASUSE_CORE.has(+code)) continue;
        for (const r of rows) {
          if (!pick(String(r.year))) continue;
          const et = ET_KEY[r.establishment_type] ?? slugify(r.establishment_type);
          if (+code === 34 && et !== "all") continue;   // mislabelled HWE/OAE rows (asuse.mjs)
          const v = num(r.value); if (v == null) continue;
          const extra = Object.keys(r).filter((k) => !ASUSE_FIXED.has(k) && r[k] != null && r[k] !== "").sort();
          const act = tidy(r.activity_category), sector = slugify(r.sector);
          const key = [ASUSE_IND[code], ...extra.map((k) => slugify(r[k])), ACT_KEY(act), sector, et].join("__");
          if (!labels.has(key)) {
            const ind = tidy(String(r.indicator).replace(/^State\/UT-wise /, ""));
            labels.set(key, `${ind}${extra.length ? ": " + extra.map((k) => tidy(r[k])).join(", ") : ""}; ${act === "All" ? "all activities" : act}; ${tidy(r.sector)}; ${{ hwe: "hired-worker establishments", oae: "own-account establishments", all: "all establishments" }[et] ?? et}`);
            units.set(key, +code === 1 || +code === 26 ? "count" : [30, 32, 34].includes(+code) ? (/number/i.test(extra.map((k) => r[k]).join(" ")) ? "count" : "inr_per_year") : "per_1000");
            groups.set(key, act === "All" ? "All activities" : act);
            order.push(key);
          }
          const d = dateOf(String(r.year)); const ck = `${key}|${d}`;
          if (cells.has(ck) && cells.get(ck) !== v) process.stdout.write(`services-asuse WARN ${key} ${d}: ${cells.get(ck)} vs ${v}, kept first\n`);
          else cells.set(ck, v);
        }
      }
      if (!order.length) continue;
      const ds = [...new Set([...cells.keys()].map((k) => k.split("|")[1]))].sort();
      const dates = yearAxis(+ds[0].slice(0, 4), +ds.at(-1).slice(0, 4), ds[0].slice(5, 7));
      const series = {};
      for (const key of order) series[key] = { name: `asuse_${key}`, label: labels.get(key), group: groups.get(key), color: /__all_activities__/.test(key) ? "#A3A9B4" : ACC, unit: units.get(key), data: dates.map((d) => cells.get(`${key}|${d}`) ?? null) };
      discloseGaps(dates, series, "ASUSE did not publish this cell in this round.");
      const slug = `services-asuse${part === "profile" ? "-profile" : ""}${sfx}`;
      writeSeries(root, `data/series/${slug}.json`, { meta: { dossier: "services-asuse", frequency: "annual", base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
        releaseDate: null, revisionPolicy: dcfg.revision_policy, latestPeriod: dates.at(-1).slice(0, 7),
        coverage: part === "core"
          ? `All India, unincorporated non-farm enterprises in service activities: establishments, workers, GVA per worker and per establishment, emoluments; rural, urban and combined; by establishment type${round === "2025" ? "; the calendar-year 2025 round" : "; financial-year rounds"}`
          : `All India, unincorporated service enterprises by activity, per 1,000 establishments: type of ownership, owner's social group, location, nature of operation, months operated, hours worked, registration${round === "2025" ? "; the calendar-year 2025 round" : "; financial-year rounds"}`,
        note: `MoSPI ASUSE, as published: counts are estimated numbers, money is ₹ per year, distributions are per 1,000 establishments. Keys read indicator__dimension__activity__sector__establishment type. ${round === "2025" ? "The 2025 round covers January to December 2025, a calendar year, and is never joined to the financial-year rounds." : "Financial-year rounds plotted at April of the first year."} GVA per establishment is baked for all establishments only (the source's HWE and OAE rows are mislabelled).` },
        dates, series });
    }
  }
}

/* =====================================================================================
 * The coverage catalogue (docs/CONTRACT-coverage.md): everything the sources publish in
 * the services scope, enumerated from the sources' own listings, never typed:
 *   ISP      isp/getISPFilter: every sub-sector at each frequency;
 *   NAS      nas/getNasFilterByIndicatorId (GVA, each base, annual and quarterly): every
 *            industry, and the service sub-industries (codes 10-18) of the annual listing;
 *   DBIE     the Data Bank's DBIE report inventory: every report whose name is about services
 *            or invisibles; for the three baked reports, every services item and flow;
 *   PLFS     every cell table of indicator 4 as served (distinct cut, gender, sector, status);
 *   ASUSE    asuse/getAsuseFilterByIndicatorId for every activity-carrying indicator: every
 *            service activity in every round the filter lists.
 * Scope: services. Farm and factory sub-industries, manufacturing activities and the
 * balance of payments outside services belong to other guides' ledgers.
 * ===================================================================================== */
export async function buildCatalogue(root) {
  const cfg = YAML.parse(fs.readFileSync(path.join(root, "data/sources.yml"), "utf8"));
  const items = []; const add = (id, label, dims) => items.push({ id, label, dims });

  // ISP
  const f = (await mospi("isp/getISPFilter", {})).data[0];
  for (const fr of f.frequency) for (const s of f.broad_sub_sector) add(`isp:${fr.description === "Yearly" ? "annual" : "monthly"}:${slugify(s.description)}`, `ISP, ${tidy(s.description)}, ${fr.description.toLowerCase()}`, { freq: fr.description.toLowerCase(), sub_sector: tidy(s.description) });

  // NAS
  const nc = cfg.dossiers["services-nas"].fetch;
  for (const b of nc.bases) for (const fc of [1, 2]) {
    const d = (await mospi("nas/getNasFilterByIndicatorId", { indicator_code: 1, account_code: 1, base_year: b.base_year, series: "Current", frequency_code: fc })).data;
    const fq = fc === 1 ? "annual" : "quarterly";
    for (const i of d.industry ?? []) add(`nas:${b.slug}:${fq}:ind:${i.industry_code}`, `GVA, ${tidy(i.industry_name)}, ${fq}, base ${b.base_year}`, { base: b.base_year, freq: fq, industry: i.industry_code });
    for (const s of d.subindustry ?? []) if (s.subindustry_code >= 10) add(`nas:${b.slug}:${fq}:sub:${s.subindustry_code}`, `GVA, ${tidy(s.subindustry_name)}, ${fq}, base ${b.base_year}`, { base: b.base_year, freq: fq, subindustry: s.subindustry_code });
  }

  // DBIE: the report inventory, then the items of the three reports we read
  const db = databankRoot(cfg.families.databank);
  const inv = fs.readFileSync(path.join(db, "data/derived/rbi_dbie_webi_inventory.csv"), "utf8").split(/\r?\n/).slice(1);
  for (const line of inv) {
    const m = line.match(/^(\d+),("([^"]*)"|[^,]*),/); if (!m) continue;
    const name = m[3] ?? m[2];
    if (/servic|invisib/i.test(name) && !/Small[- ]Scale Industries and Allied Services/i.test(name)) add(`dbie:${m[1]}:report`, `DBIE report ${m[1]}: ${tidy(name)}`, { report: m[1] });
  }
  const R1501 = dbieReport(db, "1501"), R1076 = dbieReport(db, "1076"), R807 = dbieReport(db, "807");
  for (const it of new Set(R1501.rows.map((r) => r["Item Hierarchy Level1"]))) add(`dbie:1501:item:${slugify(it)}`, `Monthly services trade: ${it}`, { report: "1501", freq: "monthly" });
  const seen = new Set();
  for (const r of R1076.rows) {
    if (!/^\d{4}\//.test(r["Time Date"] ?? "")) continue;
    let id, label;
    if (r["System Type"] === "BPM6" && /^1\.A\.b(\.|$)/.test(r["Item Display Order"]) && ["Credit", "Debit", "Net"].includes(r["Cdn Description"])) { id = `dbie:1076:bpm6:${r["Item Display Order"].toLowerCase()}:${r["Cdn Description"].toLowerCase()}`; label = `BPM6 ${tidy(r["Item Description"])}, ${r["Cdn Description"].toLowerCase()}, quarterly`; }
    else if (r["System Type"] === "Invisibles Receipts" && +r["Item Display Order"] >= 6 && +r["Item Display Order"] <= 95) { id = `dbie:1076:purpose:receipts:${r["Item Display Order"]}`; label = `Purpose code, receipts: ${tidy(r["Item Description"])}, quarterly`; }
    else if (r["System Type"] === "Invisible Payments" && +r["Item Display Order"] >= 125 && +r["Item Display Order"] <= 223) { id = `dbie:1076:purpose:payments:${r["Item Display Order"]}`; label = `Purpose code, payments: ${tidy(r["Item Description"])}, quarterly`; }
    if (id && !seen.has(id)) { seen.add(id); add(id, label, { report: "1076", freq: "quarterly" }); }
  }
  for (const r of R807.rows) {
    if (!/^1\.2\.1(\.\d)* /.test(r["Item Desc"] ?? "") || !["Credit", "Debit", "Net"].includes(r.cdn_description)) continue;
    const id = `dbie:807:${r["Item Desc"].split(" ")[0]}:${r.cdn_description.toLowerCase()}`;
    if (!seen.has(id)) { seen.add(id); add(id, `Annual invisibles table: ${tidy(r["Item Desc"])}, ${r.cdn_description.toLowerCase()}`, { report: "807", freq: "annual" }); }
  }

  // PLFS indicator 4: every cell table served
  const jobs = JSON.parse(fs.readFileSync(path.join(root, "data/raw/services-jobs.json"), "utf8"));
  for (const [design, rows] of [["ay", jobs.agriculture_years], ["cy", jobs.calendar_years]]) {
    const s2 = new Set();
    for (const r of rows) {
      const dims = JOB_DIMS.filter((d) => !isAll(r[d])); if (!dims.length) continue;
      const cut = dims.map((d) => `${d}=${jobKey(d, r[d])[0]}`).join(",");
      const id = `plfs:${design}:${dims.map((d) => jobKey(d, r[d])[0]).join(":")}:${r.gender}:${slugify(r.sector)}:${r.weekly_status === "CWS" ? "cws" : "ps"}`;
      if (s2.has(id)) continue; s2.add(id);
      add(id, `PLFS share of workers (${design === "ay" ? "agriculture years" : "calendar years"}): ${cut}; ${r.gender}, ${r.sector}, ${r.weekly_status}`, { design, table: dims.join("+"), gender: r.gender, sector: r.sector, status: r.weekly_status });
    }
  }

  // ASUSE: every service activity of every activity-carrying indicator, per round
  const ac = cfg.dossiers["services-asuse"].fetch;
  const keep = new Set(ASUSE_SERVICE_ACTIVITIES);
  for (const code of ac.indicators) {
    const d = (await mospi("asuse/getAsuseFilterByIndicatorId", { indicator_code: code })).data;
    for (const y of d.year ?? []) for (const a of d.activity_category ?? []) {
      if (!keep.has(tidy(a.description))) continue;
      add(`asuse:${ASUSE_IND[code]}:${/^\d{4}$/.test(y.year) ? "cy" : "fy"}:${y.year}:${ACT_KEY(tidy(a.description))}`, `ASUSE ${ASUSE_IND[code].replace(/_/g, " ")}, ${tidy(a.description)}, ${y.year}`, { indicator: code, activity: tidy(a.description), year: y.year });
    }
  }

  const out = { family: "services", source: "MoSPI (ISP, NAS, PLFS, ASUSE) and RBI DBIE via the local Data Bank", generator: "node scripts/lib/products/services.mjs --catalogue",
    generated_at: new Date().toISOString().slice(0, 10), scope: "Services: what the sources publish about service industries, services trade, service jobs and service enterprises. Farm and factory sub-industries, manufacturing activities and the non-services balance of payments are other guides' ledgers.",
    items: items.sort((a, b) => (a.id < b.id ? -1 : 1)) };
  fs.mkdirSync(path.join(root, "data/coverage"), { recursive: true });
  fs.writeFileSync(path.join(root, "data/coverage/services.catalogue.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`services catalogue: ${items.length} items`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && process.argv.includes("--catalogue")) {
  await buildCatalogue(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."));
}
