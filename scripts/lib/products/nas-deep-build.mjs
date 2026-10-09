// scripts/lib/products/nas-deep-build.mjs — the deep national-accounts bundles, from the
// raw dumps nas-deep.mjs writes. No network here: every number comes from
// data/raw/nas-deep-*.json, so a bundle can always be rebuilt from the audit trail.
//
// What it bakes, per base (suffix "" = 2011-12, "-2022" = 2022-23; never spliced):
//   gdp{B}-annual-levels       every annual indicator in ₹ crore, constant and current prices,
//                              standing estimate per year, plus NNI and the discrepancy (computed)
//   gdp{B}-annual-growth       real (and, where only current prices exist, nominal) y/y of the
//                              indicators gdp{B}-accounts does not already carry
//   gdp{B}-annual-shares       every component as a share of nominal GDP
//   gdp{B}-annual-industries   GVA by the 15 industry rows: levels, real y/y, share of nominal GVA
//   gdp{B}-annual-subindustries GVA by the 18 sub-industries: the same four measures
//   gdp{B}-annual-gcf-industries capital formation by industry of use (11 industries, 13 sub-industries)
//   gdp{B}-sectors             institutional sectors: GVA, saving, fixed investment, depreciation
//   gdp{B}-revisions           every estimate stage of every year: levels and MoSPI's own growth rates
//   gdp{B}-quarterly-levels    quarterly levels of GDP, GVA, net taxes and every expenditure line
//   gdp{B}-quarterly-shares    quarterly shares of nominal GDP, with the discrepancy
//   gdp{B}-quarterly-industry-levels  quarterly GVA levels by the 8 industry groups
// and for the NSO back series (1950-51 to 2011-12, 2011-12 prices):
//   gdp-back-levels, gdp-back-growth, gdp-back-shares, gdp-back-industries, gdp-back-subindustries
//
// The standing estimate of a year is its most mature published stage (the rank below); that
// is how MoSPI's own time-series tables are built: older years at their revised estimate,
// the latest years at provisional or advance estimates.
//
// Industry detail by stage: revised stages publish 11 industries, 18 sub-industries and 7
// institutional sectors; advance and provisional stages publish only the 8 industry groups.
// So a year standing at a revised estimate has no published 8-group row, and a year standing
// at an advance estimate has no 11-industry row. The 8 groups are each a sum of published
// industries (trade and transport = trade, hotels + transport, storage, communication;
// finance and realty = financial + real estate; public administration and other services =
// public administration and defence + other services), so for revised years the group is
// computed as that sum (constant prices add up: India's accounts are fixed-base, checked in
// validate). Those dates are listed in the series' `derived`. Nothing is computed the other
// way: an 11-industry row is never split out of a group.
//
// Source quirk: taxes and subsidies on products (ic3, ic4) carry unit "₹ Lakh" in the API,
// but net taxes (ic2, ₹ crore) equal taxes less subsidies to the rupee (2022-23 Final: 29,91,013
// less 7,47,239 = 22,43,774), so the label is wrong and the values are ₹ crore. validate.mjs
// re-checks the identity on every bake.
//
// Hand check (2026-10-10, against MoSPI's press release "National Accounts Statistics - 2026
// Publication", 31 August 2026, para 10, base 2022-23): real GDP 2024-25 (First Revised)
// Rs 3,01,15,428 crore and 2025-26 (Provisional) Rs 3,24,70,100 crore; 2022-23 Rs 2,61,77,001
// crore at both prices. gdp-2022-annual-levels.gdp_constant carries 30115428 at 2024-04-01,
// 32470100 at 2025-04-01 and 26177001 at 2022-04-01: exact.
//
// Stage labels are not vintages. That release revised every new-base year (new PPI and IIP
// series) and the API now serves the updated figure under the old label: 2025-26
// "Provisional" is 3,24,70,100 here, where the June 2026 provisional estimate was
// 3,23,12,034. The revisions bundle is the path through the stages as the API holds them
// today, never a record of every figure ever printed.
// See docs/status/nas.md for the full list of hand-checked values.

import fs from "node:fs";
import path from "node:path";
import { writeSeries, round2 } from "../util.mjs";

export const STAGES = [
  // [key, API label, rank (maturity), short label]
  ["fae", "First Advance Estimates", 1, "First advance"],
  ["sae", "Second Advance Estimates", 2, "Second advance"],
  ["pe", "Provisional Estimates", 3, "Provisional"],
  ["fre", "First Revised Estimates", 4, "First revised"],
  ["sre", "Second Revised Estimates", 5, "Second revised"],
  ["tre", "Third Revised Estimates", 6, "Third revised"],
  ["final", "Final Estimates", 7, "Final"],
  ["addl", "Additional Revision", 8, "Additional revision"],
];
const STAGE_BY_LABEL = Object.fromEntries(STAGES.map(([k, l, r, s]) => [l, { key: k, rank: r, short: s }]));
const STAGE_BY_KEY = Object.fromEntries(STAGES.map(([k, l, r, s]) => [k, { label: l, rank: r, short: s }]));
const STAGE_GAPS = "Not every year passes through every stage (the advance estimates began in their present form with 2014-15; years already settled when the base was introduced carry only their later revisions).";

export const IND = {
  1: ["gva", "Gross value added"], 2: ["net_taxes", "Net taxes on products"], 3: ["taxes", "Taxes on products"],
  4: ["subsidies", "Subsidies on products"], 5: ["gdp", "Gross domestic product"], 6: ["cfc", "Consumption of fixed capital"],
  7: ["ndp", "Net domestic product"], 8: ["gcf", "Gross capital formation"], 9: ["gfcf", "Gross fixed capital formation"],
  10: ["pfce", "Private final consumption"], 11: ["gfce", "Government final consumption"], 12: ["stocks", "Change in stocks"],
  13: ["valuables", "Valuables"], 14: ["exports", "Exports of goods and services"], 15: ["imports", "Imports of goods and services"],
  16: ["primary_income_row", "Net primary income from abroad"], 17: ["gni", "Gross national income"],
  18: ["transfers_row", "Net current transfers from abroad"], 19: ["gndi", "Gross national disposable income"],
  20: ["gross_saving", "Gross saving"], 21: ["gva_growth", "GVA growth rate"], 22: ["gdp_growth", "GDP growth rate"],
};

// industries: the 15 rows the API serves, by name (the same names on both bases and the back series)
export const INDUSTRY = {
  "Agriculture, Livestock, Forestry and Fishing": ["agriculture", "Agriculture, forestry and fishing"],
  "Mining and Quarrying": ["mining", "Mining and quarrying"],
  "Manufacturing": ["manufacturing", "Manufacturing"],
  "Electricity, Gas, Water Supply & Other Utility Services": ["utilities", "Electricity, gas, water and utilities"],
  "Construction": ["construction", "Construction"],
  "Trade, Hotels, Transport, Communication & Services Related to Broadcasting": ["trade_transport", "Trade, hotels, transport and communication"],
  "Trade, Repair, Hotels and Restaurants": ["trade_hotels", "Trade, repair, hotels and restaurants"],
  "Transport, Storage, Communication & Services Related to Broadcasting": ["transport", "Transport, storage and communication"],
  "Financial, Real Estate & Professional Services": ["finance_realty", "Finance, real estate and professional services"],
  "Financial Services": ["finance", "Financial services"],
  "Real Estate, Ownership of Dwelling & Professional Services": ["realty", "Real estate, dwellings and professional services"],
  "Public Administration, Defence & Other Services": ["public_admin_other", "Public administration, defence and other services"],
  "Public Administration and Defence": ["public_admin", "Public administration and defence"],
  "Other Services": ["other_services", "Other services"],
  "Total Gross Value Added": ["total", "Total GVA"],
  "Total Gross Capital Formation": ["total", "Total capital formation"],
};
// the three groups and the industries they sum
export const GROUPS = {
  trade_transport: ["trade_hotels", "transport"],
  finance_realty: ["finance", "realty"],
  public_admin_other: ["public_admin", "other_services"],
};
export const SUBINDUSTRY = {
  "Crops": ["crops", "Crops", "agriculture"],
  "Livestock": ["livestock", "Livestock", "agriculture"],
  "Forestry and Logging": ["forestry", "Forestry and logging", "agriculture"],
  "Fishing and Aquaculture": ["fishing", "Fishing and aquaculture", "agriculture"],
  "Food Products, Beverages and Tobacco": ["food_products", "Food, beverages and tobacco", "manufacturing"],
  "Textiles, Apparel and Leather Products": ["textiles", "Textiles, apparel and leather", "manufacturing"],
  "Metal Products": ["metal_products", "Metal products", "manufacturing"],
  "Machinery and Equipment": ["machinery", "Machinery and equipment", "manufacturing"],
  "Other Manufactured Goods": ["other_manufacturing", "Other manufactured goods", "manufacturing"],
  "Trade & Repair Services": ["trade_repair", "Trade and repair", "trade_hotels"],
  "Hotels & Restaurants": ["hotels", "Hotels and restaurants", "trade_hotels"],
  "Railways": ["railways", "Railways", "transport"],
  "Road Transport": ["road_transport", "Road transport", "transport"],
  "Water Transport": ["water_transport", "Water transport", "transport"],
  "Air Transport": ["air_transport", "Air transport", "transport"],
  "Services Incidental to Transport": ["transport_services", "Services incidental to transport", "transport"],
  "Storage": ["storage", "Storage", "transport"],
  "Communication & Services Related to Broadcasting": ["communication", "Communication and broadcasting", "transport"],
  // back series only: transport other than rail, road, water and air (pipelines and the like)
  "Transport by Other Means": ["other_transport", "Transport by other means", "transport"],
};
export const SECTOR = {
  "Public Non-Financial Corporations": ["public_nfc", "Public non-financial companies"],
  "Private Non-Financial Corporations": ["private_nfc", "Private non-financial companies"],
  "Public Financial Corporations": ["public_fc", "Public financial companies"],
  "Private Financial Corporations": ["private_fc", "Private financial companies"],
  "General Government": ["government", "General government"],
  "Households Including NPISH": ["households", "Households"],
  "Household Sector": ["households", "Households"],
};
const isTotalName = (s) => /^Total /.test(s);

const fyDate = (label) => {
  const m = String(label).match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!m || (Number(m[1]) + 1) % (m[2].length === 2 ? 100 : 10000) !== Number(m[2])) return null;
  return `${m[1]}-04-01`;
};
const qDate = (year, quarter) => {
  const y0 = Number(String(year).slice(0, 4)), q = Number(String(quarter).replace("Q", ""));
  return `${q === 4 ? y0 + 1 : y0}-${["04", "07", "10", "01"][q - 1]}-01`;
};
const num = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };

// one row -> its cut: ["total"] | ["industry", key] | ["sub", key] | ["sector", key]
function cutOf(r, code) {
  if (r.subindustry) {
    const s = SUBINDUSTRY[r.subindustry];
    if (!s) throw new Error(`nas-deep: unknown sub-industry "${r.subindustry}" (ic${code})`);
    return ["sub", s[0]];
  }
  if (r.industry) {
    if (isTotalName(r.industry)) return ["total"];
    const s = INDUSTRY[r.industry];
    if (!s) throw new Error(`nas-deep: unknown industry "${r.industry}" (ic${code})`);
    return ["industry", s[0]];
  }
  if (r.institutional_sector) {
    if (isTotalName(r.institutional_sector)) return ["total"];
    const s = SECTOR[r.institutional_sector];
    if (!s) throw new Error(`nas-deep: unknown institutional sector "${r.institutional_sector}" (ic${code})`);
    return ["sector", s[0]];
  }
  return ["total"];
}

/* Parse one raw dump into
 *   standing: Map("<code>|<cut>|<price>") -> Map(date -> { v, stage })
 *   stages:   Map("<code>|total|<price>") -> Map(stageKey -> Map(date -> v))   (annual only)
 * A total can arrive twice (industry "Total GVA" and sector "Total GVA"): the values must agree. */
export function parseDump(dump) {
  const standing = new Map(), stages = new Map(), rank = new Map();
  const put = (m, k) => (m.get(k) ?? m.set(k, new Map()).get(k));
  for (const [code, { rows }] of Object.entries(dump.indicators)) {
    for (const r of rows) {
      const date = dump.frequency === "quarterly" ? qDate(r.year, r.quarter) : fyDate(r.year);
      // a label that is not a financial year (one GNDI row is labelled "1999" with a
      // 2025-26-sized value) is a source defect: skipped, never filed under a wrong year
      if (!date || (dump.frequency === "quarterly" && !r.quarter)) continue;
      const cut = cutOf(r, code).join(":");
      // the growth-rate indicators' industry and sub-industry rows are not used (growth is
      // computed from levels) and are defective: ic21 serves the same cell up to three
      // times with different values (forestry, 2013-14: -1.5, 5.9 and 5.8)
      if (Number(code) >= 21 && cut !== "total") continue;
      const st = r.revision ? STAGE_BY_LABEL[r.revision] : null;
      if (r.revision && !st) throw new Error(`nas-deep: unknown revision label "${r.revision}"`);
      for (const price of ["constant", "current"]) {
        const v = num(r[`${price}_price`]);
        if (v == null) continue;
        const key = `${code}|${cut}|${price}`;
        const rk = st?.rank ?? 0;
        const sm = put(standing, key), rm = put(rank, key);
        const prev = sm.get(date);
        // a total printed in two tables (GVA by industry and by institutional sector) can
        // differ by rounding (Rs 2 crore in 2018-19): the production-side table wins, and
        // anything wider than rounding is a defect
        const fromSector = !r.industry && !!r.institutional_sector;
        if (prev && (rm.get(date) ?? -1) === rk) {
          if (Math.abs(prev.v - v) > Math.max(5, Math.abs(v) * 1e-6)) throw new Error(`nas-deep: ${key} ${date} ${r.revision ?? ""} published twice with different values (${prev.v}, ${v})`);
          if (fromSector) continue;
        }
        if (rk >= (rm.get(date) ?? -1)) { sm.set(date, { v, stage: st?.short ?? null }); rm.set(date, rk); }
        if (st && cut === "total") put(put(stages, key), st.key).set(date, v);
      }
    }
  }
  return { standing, stages };
}

const yoy = (m, lagMonths = 12) => {
  const out = new Map();
  for (const [d, v] of m) {
    const y = Number(d.slice(0, 4)), mo = Number(d.slice(5, 7));
    const tot = y * 12 + (mo - 1) - lagMonths;
    const pd = `${Math.floor(tot / 12)}-${String((tot % 12) + 1).padStart(2, "0")}-01`;
    const p = m.get(pd);
    if (p != null && p > 0 && v != null) out.set(d, round2((v / p - 1) * 100));
  }
  return out;
};
const values = (m) => new Map([...(m ?? new Map())].map(([d, o]) => [d, o.v]));

// a series on the axis, with interior nulls disclosed (CONTRACT-series rule 2)
function series(axis, map, o) {
  const data = axis.map((d) => (map?.has(d) ? map.get(d) : null));
  const s = { name: o.name, label: o.label, color: o.color ?? "#878D99", unit: o.unit, data };
  if (o.nominal) s.nominal = true;
  if (o.group) s.group = o.group;
  const first = data.findIndex((v) => v != null);
  if (first < 0) return null;
  const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
  const gaps = axis.filter((d, j) => j > first && j < last && data[j] == null);
  if (gaps.length) { s.gaps = gaps; if (o.gapsNote) s.gapsNote = o.gapsNote; }
  if (o.derived?.length) { s.derived = o.derived.filter((d) => map?.has(d)); if (s.derived.length) s.derivedNote = o.derivedNote; else delete s.derived; }
  return s;
}
// trim the axis so the bundle ends at its last published period and starts at its first
function bundleOf(meta, axis, entries) {
  const ser = Object.fromEntries(entries.filter(([, s]) => s));
  let lo = axis.length, hi = -1;
  for (const s of Object.values(ser)) s.data.forEach((v, i) => { if (v != null) { lo = Math.min(lo, i); hi = Math.max(hi, i); } });
  if (hi < 0) throw new Error(`nas-deep: bundle with no data (${meta.coverage})`);
  for (const s of Object.values(ser)) {
    s.data = s.data.slice(lo, hi + 1);
    if (s.gaps) s.gaps = s.gaps.filter((d) => d >= axis[lo] && d <= axis[hi]);
  }
  return { meta: { ...meta, latestPeriod: axis[hi].slice(0, 7) }, dates: axis.slice(lo, hi + 1), series: ser };
}
const fyAxis = (dates) => { const ys = [...dates].map((d) => +d.slice(0, 4)); const out = []; for (let y = Math.min(...ys); y <= Math.max(...ys); y++) out.push(`${y}-04-01`); return out; };
const qAxis = (dates) => {
  const ds = [...dates].sort(); const out = [];
  let [y, m] = ds[0].split("-").map(Number); const [ly, lm] = ds.at(-1).split("-").map(Number);
  while (y * 12 + m <= ly * 12 + lm) { out.push(`${y}-${String(m).padStart(2, "0")}-01`); m += 3; if (m > 12) { m -= 12; y++; } }
  return out;
};
const ratio = (num, den, scale = 100) => {
  const out = new Map();
  for (const [d, v] of num ?? new Map()) { const x = den?.get(d); if (x) out.set(d, round2((v / x) * scale)); }
  return out;
};
const comb = (maps, signs) => {
  // sum of maps (with signs) on dates where every term is present
  const out = new Map();
  for (const d of maps[0].keys()) {
    let s = 0, ok = true;
    maps.forEach((m, i) => { const v = m.get(d); if (v == null) ok = false; else s += signs[i] * v; });
    if (ok) out.set(d, s);
  }
  return out;
};

// levels with each group computed from its parts wherever the parts are published
function withGroups(get, keys, price) {
  const out = {}, derived = {};
  for (const k of keys) out[k] = values(get(k, price));
  for (const [g, parts] of Object.entries(GROUPS)) {
    if (!keys.includes(g)) continue;
    const pm = parts.map((p) => values(get(p, price)));
    const sum = comb(pm, pm.map(() => 1));
    derived[g] = [];
    // where both parts are published the year stands at a revised estimate, and the group's
    // own row (published only at advance and provisional stages) is an older vintage: the
    // sum of the revised parts is the year's standing figure
    for (const [d, v] of sum) { out[g].set(d, v); derived[g].push(d); }
  }
  return { out, derived };
}

const DERIVED_NOTE = "MoSPI publishes years standing at a revised estimate by the finer industries only; for those years this group is the sum of its two published industries (listed in derived).";

function buildCurrent(dumpA, dumpQ, o) {
  const A = parseDump(dumpA), Q = parseDump(dumpQ);
  const get = (P) => (code, cut, price) => P.standing.get(`${code}|${cut}|${price}`);
  const ga = get(A), gq = get(Q);
  const metaA = { ...o.meta, frequency: "annual" }, metaQ = { ...o.meta, frequency: "quarterly" };
  const sfx = o.nameSuffix;
  const out = {};

  /* ---------- annual levels ---------- */
  const aAxis = fyAxis(ga(5, "total", "constant").keys());
  const lv = (code, price) => values(ga(code, "total", price));
  const nni = { constant: comb([lv(17, "constant"), lv(6, "constant")], [1, -1]), current: comb([lv(17, "current"), lv(6, "current")], [1, -1]) };
  const expSum = (price) => comb([10, 11, 9, 12, 13, 14, 15].map((c) => lv(c, price)), [1, 1, 1, 1, 1, 1, -1]);
  const disc = { constant: comb([lv(5, "constant"), expSum("constant")], [1, -1]), current: comb([lv(5, "current"), expSum("current")], [1, -1]) };
  const levelEntries = [];
  for (let c = 1; c <= 20; c++) {
    const [k, label] = IND[c];
    for (const price of ["constant", "current"]) {
      levelEntries.push([`${k}_${price}`, series(aAxis, lv(c, price), { name: `${k}_${price}_inr_crore${sfx}`, label: `${label}, ${price} prices`, unit: "inr_crore", nominal: price === "current" })]);
    }
  }
  for (const price of ["constant", "current"]) {
    levelEntries.push([`nni_${price}`, series(aAxis, nni[price], { name: `nni_${price}_inr_crore${sfx}`, label: `Net national income, ${price} prices (GNI less depreciation, computed)`, unit: "inr_crore", nominal: price === "current" })]);
    levelEntries.push([`discrepancy_${price}`, series(aAxis, disc[price], { name: `discrepancy_${price}_inr_crore${sfx}`, label: `Discrepancy, ${price} prices (GDP less its expenditure components, computed)`, unit: "inr_crore", nominal: price === "current" })]);
  }
  const standingStage = Object.fromEntries([...(ga(5, "total", "constant") ?? [])].sort().map(([d, x]) => [d, x.stage]));
  out[`${o.slug}-annual-levels`] = bundleOf({ ...metaA, unit: "inr_crore", standingStage,
    coverage: `All-India, annual (fiscal years), every national-accounts indicator in ₹ crore at constant ${o.baseYear} and current prices, the standing estimate of each year`,
    note: "Each year is shown at its most mature published estimate (standingStage names the stage behind GDP for each year). Taxes and subsidies are labelled ₹ lakh by the API but are ₹ crore (net taxes equal taxes less subsidies). Net national income is GNI less consumption of fixed capital; the discrepancy is GDP less the sum of consumption, investment, stocks, valuables and net exports. Both are computed here. Some income lines (taxes, subsidies, depreciation, primary income, transfers, saving) are published only from the first revised estimate, so they end a year or two before GDP." }, aAxis, levelEntries);

  /* ---------- annual growth: the indicators gdp{B}-accounts does not carry ---------- */
  const growthEntries = [];
  for (const c of [1, 2, 9, 10, 11, 14, 15]) {
    const [k, label] = IND[c];
    growthEntries.push([k, series(aAxis, yoy(lv(c, "constant")), { name: `${k}_annual_real_yoy_pct${sfx}`, label: `${label}, real growth`, unit: "pct_yoy" })]);
  }
  growthEntries.push(["nni", series(aAxis, yoy(nni.constant), { name: `nni_annual_real_yoy_pct${sfx}`, label: "Net national income, real growth (computed)", unit: "pct_yoy" })]);
  for (const c of [5, 17, 19, 20, 10]) {
    const [k, label] = IND[c];
    growthEntries.push([`${k}_nominal`, series(aAxis, yoy(lv(c, "current")), { name: `${k}_annual_nominal_yoy_pct${sfx}`, label: `${label}, nominal growth`, unit: "pct_yoy", nominal: true })]);
  }
  growthEntries.push(["nni_nominal", series(aAxis, yoy(nni.current), { name: `nni_annual_nominal_yoy_pct${sfx}`, label: "Net national income, nominal growth (computed)", unit: "pct_yoy", nominal: true })]);
  out[`${o.slug}-annual-growth`] = bundleOf({ ...metaA, unit: "pct_yoy",
    coverage: "All-India, annual, year-on-year growth computed from published levels: real growth from constant prices, nominal growth from current prices",
    note: `Growth of each year's standing estimate over the previous year's standing estimate, the convention of MoSPI's own tables. GDP, NDP, GNI, taxes, subsidies, depreciation and capital formation real growth live in ${o.slug}-accounts and are not repeated here.` }, aAxis, growthEntries.filter(([, s]) => s));

  /* ---------- annual shares of nominal GDP ---------- */
  const gdpCur = lv(5, "current");
  const shareEntries = [];
  for (const c of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) {
    const [k, label] = IND[c];
    shareEntries.push([k, series(aAxis, ratio(lv(c, "current"), gdpCur), { name: `${k}_pct_of_nominal_gdp${sfx}`, label: `${label}, share of GDP`, unit: "pct_of_gdp", nominal: true })]);
  }
  shareEntries.push(["net_exports", series(aAxis, ratio(comb([lv(14, "current"), lv(15, "current")], [1, -1]), gdpCur), { name: `net_exports_pct_of_nominal_gdp${sfx}`, label: "Net exports, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  shareEntries.push(["discrepancy", series(aAxis, ratio(disc.current, gdpCur), { name: `discrepancy_pct_of_nominal_gdp${sfx}`, label: "Discrepancy, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  shareEntries.push(["nni", series(aAxis, ratio(nni.current, gdpCur), { name: `nni_pct_of_nominal_gdp${sfx}`, label: "Net national income, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  out[`${o.slug}-annual-shares`] = bundleOf({ ...metaA, unit: "pct_of_gdp",
    coverage: "All-India, annual, each national-accounts line as a share of nominal GDP (current prices over current prices)",
    note: `Shares are nominal over nominal, the only honest form. Gross saving as a share of GDP lives in ${o.slug}-accounts (saving_rate) and is not repeated.` }, aAxis, shareEntries);

  /* ---------- annual GVA by industry ---------- */
  const indKeys = [...new Set(Object.values(INDUSTRY).map(([k]) => k))].filter((k) => k !== "total");
  const lab = Object.fromEntries(Object.values(INDUSTRY).map(([k, l]) => [k, l]));
  const indGet = (k, price) => ga(1, `industry:${k}`, price);
  const cons = withGroups(indGet, indKeys, "constant"), curs = withGroups(indGet, indKeys, "current");
  const gvaCur = lv(1, "current");
  const indEntries = [];
  for (const k of [...indKeys, "total"]) {
    const isG = GROUPS[k];
    const common = { group: isG ? "Industry group (8-group table)" : "Industry", derived: cons.derived[k], derivedNote: DERIVED_NOTE };
    const con = k === "total" ? lv(1, "constant") : cons.out[k], cur = k === "total" ? gvaCur : curs.out[k];
    const L = k === "total" ? "Total GVA" : lab[k];
    indEntries.push([`${k}_constant`, series(aAxis, con, { ...common, name: `gva_${k}_constant_inr_crore${sfx}`, label: `${L}, GVA at constant prices`, unit: "inr_crore" })]);
    indEntries.push([`${k}_current`, series(aAxis, cur, { ...common, name: `gva_${k}_current_inr_crore${sfx}`, label: `${L}, GVA at current prices`, unit: "inr_crore", nominal: true })]);
    indEntries.push([`${k}_real_yoy`, series(aAxis, yoy(con), { ...common, derived: null, name: `gva_${k}_annual_real_yoy_pct${sfx}`, label: `${L}, real GVA growth`, unit: "pct_yoy" })]);
    if (k !== "total") indEntries.push([`${k}_share`, series(aAxis, ratio(cur, gvaCur), { ...common, derived: null, name: `gva_${k}_pct_of_nominal_gva${sfx}`, label: `${L}, share of GVA`, unit: "pct_of_gva", nominal: true })]);
  }
  out[`${o.slug}-annual-industries`] = bundleOf({ ...metaA, unit: "inr_crore",
    coverage: "All-India, annual GVA by industry: the 11 industries of the revised estimates and the 8 groups of the advance estimates, levels, real growth and share of nominal GVA",
    note: `${DERIVED_NOTE} The 11 finer industries end at the last year standing at a revised estimate; advance and provisional estimates publish only the 8 groups. Real growth is computed from constant-price levels; shares are of nominal total GVA.` }, aAxis, indEntries);

  /* ---------- annual GVA by sub-industry ---------- */
  const subEntries = [];
  const subLab = Object.fromEntries(Object.values(SUBINDUSTRY).map(([k, l, p]) => [k, [l, p]]));
  for (const [k, [L, parent]] of Object.entries(subLab)) {
    const con = values(ga(1, `sub:${k}`, "constant")), cur = values(ga(1, `sub:${k}`, "current"));
    if (!con.size && !cur.size) continue;
    const common = { group: lab[parent] };
    subEntries.push([`${k}_constant`, series(aAxis, con, { ...common, name: `gva_${k}_constant_inr_crore${sfx}`, label: `${L}, GVA at constant prices`, unit: "inr_crore" })]);
    subEntries.push([`${k}_current`, series(aAxis, cur, { ...common, name: `gva_${k}_current_inr_crore${sfx}`, label: `${L}, GVA at current prices`, unit: "inr_crore", nominal: true })]);
    subEntries.push([`${k}_real_yoy`, series(aAxis, yoy(con), { ...common, name: `gva_${k}_annual_real_yoy_pct${sfx}`, label: `${L}, real GVA growth`, unit: "pct_yoy" })]);
    subEntries.push([`${k}_share`, series(aAxis, ratio(cur, gvaCur), { ...common, name: `gva_${k}_pct_of_nominal_gva${sfx}`, label: `${L}, share of GVA`, unit: "pct_of_gva", nominal: true })]);
  }
  out[`${o.slug}-annual-subindustries`] = bundleOf({ ...metaA, unit: "inr_crore",
    coverage: "All-India, annual GVA by the 18 sub-industries MoSPI publishes (inside agriculture, manufacturing, trade and hotels, and transport), levels, real growth and share of nominal GVA",
    note: "Sub-industries are published with the revised estimates only, so they end at the last year standing at a revised estimate. Each sub-industry's group names its parent industry." }, aAxis, subEntries);

  /* ---------- annual capital formation by industry of use ---------- */
  const gcfEntries = [];
  const gcfTot = lv(8, "current");
  for (const k of [...indKeys.filter((k) => !GROUPS[k]), "total"]) {
    const con = k === "total" ? lv(8, "constant") : values(ga(8, `industry:${k}`, "constant"));
    const cur = k === "total" ? gcfTot : values(ga(8, `industry:${k}`, "current"));
    if (!con.size && !cur.size) continue;
    const L = k === "total" ? "Total capital formation" : lab[k];
    gcfEntries.push([`${k}_constant`, series(aAxis, con, { group: "Industry", name: `gcf_${k}_constant_inr_crore${sfx}`, label: `${L}, capital formation at constant prices`, unit: "inr_crore" })]);
    gcfEntries.push([`${k}_current`, series(aAxis, cur, { group: "Industry", name: `gcf_${k}_current_inr_crore${sfx}`, label: `${L}, capital formation at current prices`, unit: "inr_crore", nominal: true })]);
    if (k !== "total") gcfEntries.push([`${k}_share`, series(aAxis, ratio(cur, gcfTot), { group: "Industry", name: `gcf_${k}_pct_of_total_gcf${sfx}`, label: `${L}, share of all capital formation`, unit: "pct_share", nominal: true })]);
  }
  for (const [k, [L, parent]] of Object.entries(subLab)) {
    const con = values(ga(8, `sub:${k}`, "constant")), cur = values(ga(8, `sub:${k}`, "current"));
    if (!con.size && !cur.size) continue;
    gcfEntries.push([`${k}_constant`, series(aAxis, con, { group: lab[parent], name: `gcf_${k}_constant_inr_crore${sfx}`, label: `${L}, capital formation at constant prices`, unit: "inr_crore" })]);
    gcfEntries.push([`${k}_current`, series(aAxis, cur, { group: lab[parent], name: `gcf_${k}_current_inr_crore${sfx}`, label: `${L}, capital formation at current prices`, unit: "inr_crore", nominal: true })]);
  }
  out[`${o.slug}-annual-gcf-industries`] = bundleOf({ ...metaA, unit: "inr_crore",
    coverage: "All-India, annual gross capital formation by the industry that uses the asset: 11 industries and 13 sub-industries, constant and current prices, and each industry's share of the total",
    note: "Capital formation by industry of use is published with the revised estimates only. It includes fixed investment, change in stocks and valuables, so the total differs from GFCF. Shares are current prices over the current-price total." }, aAxis, gcfEntries);

  /* ---------- institutional sectors ---------- */
  const secKeys = [...new Set(Object.values(SECTOR).map(([k]) => k))];
  const secLab = Object.fromEntries(Object.values(SECTOR).map(([k, l]) => [k, l]));
  const secEntries = [];
  const sec = (code, k, price) => (k === "total" ? lv(code, price) : values(ga(code, `sector:${k}`, price)));
  for (const k of [...secKeys, "total"]) {
    const L = k === "total" ? "All sectors" : secLab[k];
    const g = { group: L };
    const sav = sec(20, k, "current"), gf = sec(9, k, "current");
    secEntries.push([`saving_${k}`, series(aAxis, sav, { ...g, name: `gross_saving_${k}_current_inr_crore${sfx}`, label: `${L}, gross saving`, unit: "inr_crore", nominal: true })]);
    secEntries.push([`saving_${k}_pct_gdp`, series(aAxis, ratio(sav, gdpCur), { ...g, name: `gross_saving_${k}_pct_of_nominal_gdp${sfx}`, label: `${L}, gross saving, share of GDP`, unit: "pct_of_gdp", nominal: true })]);
    secEntries.push([`gfcf_${k}`, series(aAxis, gf, { ...g, name: `gfcf_${k}_current_inr_crore${sfx}`, label: `${L}, fixed investment, current prices`, unit: "inr_crore", nominal: true })]);
    secEntries.push([`gfcf_${k}_constant`, series(aAxis, sec(9, k, "constant"), { ...g, name: `gfcf_${k}_constant_inr_crore${sfx}`, label: `${L}, fixed investment, constant prices`, unit: "inr_crore" })]);
    secEntries.push([`gfcf_${k}_pct_gdp`, series(aAxis, ratio(gf, gdpCur), { ...g, name: `gfcf_${k}_pct_of_nominal_gdp${sfx}`, label: `${L}, fixed investment, share of GDP`, unit: "pct_of_gdp", nominal: true })]);
    secEntries.push([`gap_${k}_pct_gdp`, series(aAxis, ratio(comb([sav, gf], [1, -1]), gdpCur), { ...g, name: `saving_less_gfcf_${k}_pct_of_nominal_gdp${sfx}`, label: `${L}, saving less fixed investment, share of GDP (computed)`, unit: "pct_of_gdp", nominal: true })]);
    const gv = sec(1, k, "current");
    secEntries.push([`gva_${k}`, series(aAxis, gv, { ...g, name: `gva_${k}_current_inr_crore${sfx}`, label: `${L}, GVA, current prices`, unit: "inr_crore", nominal: true })]);
    if (k !== "total") secEntries.push([`gva_${k}_share`, series(aAxis, ratio(gv, gvaCur), { ...g, name: `gva_${k}_pct_of_nominal_gva${sfx}`, label: `${L}, share of GVA`, unit: "pct_of_gva", nominal: true })]);
    secEntries.push([`cfc_${k}`, series(aAxis, sec(6, k, "current"), { ...g, name: `cfc_${k}_current_inr_crore${sfx}`, label: `${L}, consumption of fixed capital`, unit: "inr_crore", nominal: true })]);
  }
  out[`${o.slug}-sectors`] = bundleOf({ ...metaA, unit: "inr_crore",
    coverage: "All-India, annual, by institutional sector (households, private and public non-financial and financial companies, general government): gross saving, fixed investment, GVA and depreciation, levels and shares of nominal GDP",
    note: "Institutional-sector accounts are published with the revised estimates only. Saving, GVA and depreciation by sector are at current prices only. 'Saving less fixed investment' is computed here: a sector with a positive figure lends its surplus to the others; it ignores stocks and valuables, which are not published by sector. Households include non-profit institutions serving households (NPISH)." }, aAxis, secEntries);

  /* ---------- revision stages ---------- */
  const revEntries = [];
  for (let c = 1; c <= 20; c++) {
    const [k, label] = IND[c];
    for (const price of ["constant", "current"]) {
      const m = A.stages.get(`${c}|total|${price}`);
      if (!m) continue;
      for (const [sk, , , short] of STAGES) {
        const sm = m.get(sk);
        if (!sm?.size) continue;
        revEntries.push([`${k}_${sk}_${price}`, series(aAxis, sm, {
          group: label, name: `${k}_${sk}_${price}_inr_crore${sfx}`, label: `${label}, ${short} estimate, ${price} prices`,
          unit: "inr_crore", nominal: price === "current", gapsNote: STAGE_GAPS,
        })]);
      }
    }
  }
  /* Growth at each stage. MoSPI's growth for year t at a stage compares that stage's level
   * with year t-1's level as it stood in the same release. The API's own rate (ic22, ic21) is
   * to one decimal and sometimes truncated rather than rounded (2023-24 first revised: 9.1
   * in the API, 9.2 in the press note of 28 Feb 2025, 9.19 from the levels). So growth is
   * computed from levels, against the stage of t-1 that reproduces the published rate within
   * 0.1 point; the usual calendar pairing is tried first (first advance with the provisional
   * estimate of t-1, second advance and provisional with its first revised, first revised
   * with its second revised or final, second revised with its third revised). The release
   * calendar moved over the decade, so other stages are tried when the usual one does not
   * reproduce the rate. Where no level of t-1 reproduces it, the published rate is kept and
   * the date is listed in the series' `published`. The published rates are kept beside as
   * *_published, the cross-check. */
  const PAIR = { fae: ["pe", "fre"], sae: ["fre", "sre"], pe: ["fre", "sre"], fre: ["sre", "final", "tre"], sre: ["tre", "sre"], tre: ["tre", "addl"], final: ["tre", "sre"], addl: ["addl"] };
  const pairs = {};
  for (const [rc, lc, k] of [[22, 5, "gdp_growth"], [21, 1, "gva_growth"]]) {
    const L = IND[rc][1];
    const firstM = new Map(), latestM = new Map(), revM = new Map();
    for (const [price, pk, pl] of [["constant", "real", "real"], ["current", "nominal", "nominal"]]) {
      const lev = A.stages.get(`${lc}|total|${price}`), pub = A.stages.get(`${rc}|total|${price}`);
      if (!lev) continue;
      for (const [sk, , , short] of STAGES) {
        const cur = lev.get(sk), pubS = pub?.get(sk);
        if (!cur?.size && !pubS?.size) continue;
        const out = new Map(), onlyPub = [], unconfirmed = [];
        for (const d of aAxis) {
          const v = cur?.get(d), p = pubS?.get(d);
          const pd = `${Number(d.slice(0, 4)) - 1}-04-01`;
          const cand = [...PAIR[sk], ...STAGES.map(([x]) => x).filter((x) => !PAIR[sk].includes(x))]
            .map((x) => [x, lev.get(x)?.get(pd)]).filter(([, pv]) => pv != null && v != null)
            .map(([x, pv]) => [x, (v / pv - 1) * 100]);
          let pick = null;
          if (p != null) pick = cand.find(([, g], i) => i < PAIR[sk].length && Math.abs(g - p) <= 0.1) ?? cand.filter(([, g]) => Math.abs(g - p) <= 0.1).sort((a, b) => Math.abs(a[1] - p) - Math.abs(b[1] - p))[0];
          else if (cand.length && PAIR[sk].includes(cand[0][0])) pick = cand[0];
          // published rate present but no level pairing within 0.1 point: the usual pairing is
          // used and the date flagged (GVA 2019-20 second advance, nominal: the API says 3.3,
          // the levels 7.9; an API defect)
          if (!pick && p != null && cand.length && PAIR[sk].includes(cand[0][0])) { pick = cand[0]; unconfirmed.push(d); }
          if (pick) { out.set(d, round2(pick[1])); (pairs[`${k}_${sk}_${pk}`] ??= {})[d] = pick[0]; }
          else if (p != null) { out.set(d, p); onlyPub.push(d); }
        }
        const sr = series(aAxis, out, { group: L, name: `${k}_${sk}_${pk}_pct${sfx}`, label: `${L}, ${short} estimate, ${pl} (computed from levels)`, unit: "pct_yoy", nominal: price === "current", gapsNote: STAGE_GAPS });
        if (sr && unconfirmed.length) { sr.unconfirmed = unconfirmed; sr.unconfirmedNote = "MoSPI's published rate for these dates matches no level of the previous year; growth is computed against the usual stage and the published rate is in the *_published series."; }
        if (sr && onlyPub.length) { sr.published = onlyPub; sr.publishedNote = "No level of the previous year reproduces MoSPI's published rate for these dates; the published rate (one decimal) is shown."; }
        revEntries.push([`${k}_${sk}_${pk}`, sr]);
        if (pubS?.size) revEntries.push([`${k}_${sk}_${pk}_published`, series(aAxis, pubS, { group: L, name: `${k}_${sk}_${pk}_published_pct${sfx}`, label: `${L}, ${short} estimate, ${pl}, as the API publishes it (one decimal, cross-check)`, unit: "pct_yoy", nominal: price === "current", gapsNote: STAGE_GAPS })]);
        if (price === "constant") for (const [d, g] of out) (firstM.get(d) ?? firstM.set(d, []).get(d)).push([STAGE_BY_KEY[sk].rank, g, sk]);
      }
    }
    // each year's first print (first advance) and its latest, real; years settled before the
    // base was introduced (2011-12 to 2013-14) never had a first advance estimate
    for (const [d, arr] of firstM) {
      arr.sort((a, b) => a[0] - b[0]);
      if (arr[0][2] !== "fae") continue;
      latestM.set(d, arr.at(-1)[1]);
      if (arr.length > 1) revM.set(d, round2(arr.at(-1)[1] - arr[0][1]));
    }
    const fae = new Map([...firstM].filter(([, a]) => a.some((x) => x[2] === "fae")).map(([d, a]) => [d, a.find((x) => x[2] === "fae")[1]]));
    revEntries.push([`${k}_first`, series(aAxis, fae, { group: L, name: `${k}_first_print_real_pct${sfx}`, label: `${L}, first advance estimate, real (computed from levels)`, unit: "pct_yoy" })]);
    revEntries.push([`${k}_latest`, series(aAxis, latestM, { group: L, name: `${k}_latest_print_real_pct${sfx}`, label: `${L}, latest estimate, real (computed from levels)`, unit: "pct_yoy" })]);
    revEntries.push([`${k}_revision`, series(aAxis, revM, { group: L, name: `${k}_revision_first_to_latest_pp${sfx}`, label: `${L}, revision from first advance to latest estimate, percentage points (computed)`, unit: "pct_points" })]);
  }
  out[`${o.slug}-revisions`] = bundleOf({ ...metaA, unit: "inr_crore",
    stages: STAGES.map(([k, l, r, s]) => ({ key: k, label: l, rank: r, short: s })),
    pairs,
    coverage: "All-India, annual: every published estimate stage of every year (first and second advance, provisional, first, second and third revised, final, additional revision), levels of each national-accounts total and MoSPI's own growth rate at each stage",
    note: "Levels as the API holds each stage today: a later release can restate a stage under its old label (on 31 Aug 2026 MoSPI updated every 2022-23-base year for the new PPI and IIP; 2025-26 Provisional moved from Rs 3,23,12,034 to 3,24,70,100 crore at constant prices), so a stage here is the latest figure carrying that label, not every figure ever printed. Growth at each stage (gdp_growth_*, gva_growth_*) is computed from levels against the previous year's stage that reproduces MoSPI's published rate within 0.1 point (meta.pairs names it for every date); MoSPI's own one-decimal rates, which are sometimes truncated rather than rounded, are kept as *_published. First, latest and revision are computed from the growth series. The industry-by-stage detail is in the raw dump (data/raw/nas-deep-*-current-annual.json) and the deep archive." }, aAxis, revEntries);

  /* ---------- quarterly levels, shares, industry levels ---------- */
  const qlv = (code, price) => values(gq(code, "total", price));
  const qAx = qAxis(qlv(5, "constant").keys());
  const qExp = (price) => comb([10, 11, 9, 12, 13, 14, 15].map((c) => qlv(c, price)), [1, 1, 1, 1, 1, 1, -1]);
  const qDisc = { constant: comb([qlv(5, "constant"), qExp("constant")], [1, -1]), current: comb([qlv(5, "current"), qExp("current")], [1, -1]) };
  const qEntries = [];
  for (const c of [5, 1, 2, 10, 11, 9, 12, 13, 14, 15]) {
    const [k, label] = IND[c];
    for (const price of ["constant", "current"]) qEntries.push([`${k}_${price}`, series(qAx, qlv(c, price), { name: `${k}_quarterly_${price}_inr_crore${sfx}`, label: `${label}, ${price} prices`, unit: "inr_crore", nominal: price === "current" })]);
  }
  for (const price of ["constant", "current"]) qEntries.push([`discrepancy_${price}`, series(qAx, qDisc[price], { name: `discrepancy_quarterly_${price}_inr_crore${sfx}`, label: `Discrepancy, ${price} prices (GDP less its expenditure components, computed)`, unit: "inr_crore", nominal: price === "current" })]);
  out[`${o.slug}-quarterly-levels`] = bundleOf({ ...metaQ, unit: "inr_crore",
    coverage: "All-India, quarterly levels in ₹ crore, constant and current prices: GDP, GVA, net taxes and every expenditure component, with the discrepancy",
    note: "Quarterly rows carry the latest estimate only (the API serves no quarterly revision history). The discrepancy is computed: GDP less consumption, investment, stocks, valuables and net exports." }, qAx, qEntries);
  const qGdpCur = qlv(5, "current");
  const qsEntries = [];
  for (const c of [1, 2, 10, 11, 9, 12, 13, 14, 15]) {
    const [k, label] = IND[c];
    qsEntries.push([k, series(qAx, ratio(qlv(c, "current"), qGdpCur), { name: `${k}_quarterly_pct_of_nominal_gdp${sfx}`, label: `${label}, share of GDP`, unit: "pct_of_gdp", nominal: true })]);
  }
  qsEntries.push(["net_exports", series(qAx, ratio(comb([qlv(14, "current"), qlv(15, "current")], [1, -1]), qGdpCur), { name: `net_exports_quarterly_pct_of_nominal_gdp${sfx}`, label: "Net exports, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  qsEntries.push(["discrepancy", series(qAx, ratio(qDisc.current, qGdpCur), { name: `discrepancy_quarterly_pct_of_nominal_gdp${sfx}`, label: "Discrepancy, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  out[`${o.slug}-quarterly-shares`] = bundleOf({ ...metaQ, unit: "pct_of_gdp",
    coverage: "All-India, quarterly, each expenditure component, net taxes and the discrepancy as a share of nominal GDP",
    note: "Nominal over nominal. Quarterly shares move with the seasons (the March quarter is the largest for investment), so compare a quarter with the same quarter a year earlier." }, qAx, qsEntries);
  const qiEntries = [];
  for (const k of ["agriculture", "mining", "manufacturing", "utilities", "construction", "trade_transport", "finance_realty", "public_admin_other", "total"]) {
    const L = k === "total" ? "Total GVA" : lab[k];
    for (const price of ["constant", "current"]) qiEntries.push([`${k}_${price}`, series(qAx, values(k === "total" ? gq(1, "total", price) : gq(1, `industry:${k}`, price)), { group: "Industry group (8-group table)", name: `gva_${k}_quarterly_${price}_inr_crore${sfx}`, label: `${L}, GVA at ${price} prices`, unit: "inr_crore", nominal: price === "current" })]);
  }
  out[`${o.slug}-quarterly-industry-levels`] = bundleOf({ ...metaQ, unit: "inr_crore",
    coverage: "All-India, quarterly GVA levels by the 8 industry groups and the total, constant and current prices",
    note: `Real growth and shares of these levels are in ${o.slug}-industries.` }, qAx, qiEntries);

  return out;
}

function buildBack(dump, o) {
  const B = parseDump(dump);
  const g = (code, cut, price) => values(B.standing.get(`${code}|${cut}|${price}`));
  const lv = (c, p) => g(c, "total", p);
  const ax = fyAxis(lv(5, "constant").keys());
  const meta = { ...o.meta, frequency: "annual" };
  const out = {};
  const nni = { constant: comb([lv(17, "constant"), lv(6, "constant")], [1, -1]), current: comb([lv(17, "current"), lv(6, "current")], [1, -1]) };
  const expSum = (p) => comb([10, 11, 9, 12, 14, 15].map((c) => lv(c, p)), [1, 1, 1, 1, 1, -1]);
  // valuables start in 1998-99 (14 rows): before it the identity runs without them
  const disc = (p) => {
    const base = comb([lv(5, p), expSum(p)], [1, -1]), val = lv(13, p);
    return new Map([...base].map(([d, v]) => [d, v - (val.get(d) ?? 0)]));
  };
  const D = { constant: disc("constant"), current: disc("current") };
  const le = [];
  for (const c of [1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
    const [k, label] = IND[c];
    for (const p of ["constant", "current"]) le.push([`${k}_${p}`, series(ax, lv(c, p), { name: `${k}_${p}_inr_crore_back`, label: `${label}, ${p} prices`, unit: "inr_crore", nominal: p === "current" })]);
  }
  for (const p of ["constant", "current"]) {
    le.push([`nni_${p}`, series(ax, nni[p], { name: `nni_${p}_inr_crore_back`, label: `Net national income, ${p} prices (GNI less depreciation, computed)`, unit: "inr_crore", nominal: p === "current" })]);
    le.push([`discrepancy_${p}`, series(ax, D[p], { name: `discrepancy_${p}_inr_crore_back`, label: `Discrepancy, ${p} prices (GDP less its expenditure components, computed)`, unit: "inr_crore", nominal: p === "current" })]);
  }
  out["gdp-back-levels"] = bundleOf({ ...meta, unit: "inr_crore",
    coverage: "The NSO back series, All-India, annual 1950-51 to 2011-12, every indicator served in ₹ crore at 2011-12 and current prices",
    note: "The NSO's own back-cast onto the 2011-12 base; never joined to the current series. Valuables are published only from 1998-99 (the discrepancy before then is computed without them). The back series serves no taxes or subsidies separately, only net taxes. NNI and the discrepancy are computed here." }, ax, le);
  const ge = [];
  for (const c of [2, 7, 17, 6, 8, 14, 15]) {
    const [k, label] = IND[c];
    ge.push([k, series(ax, yoy(lv(c, "constant")), { name: `${k}_real_yoy_pct_back`, label: `${label}, real growth`, unit: "pct_yoy" })]);
  }
  ge.push(["nni", series(ax, yoy(nni.constant), { name: "nni_real_yoy_pct_back", label: "Net national income, real growth (computed)", unit: "pct_yoy" })]);
  for (const c of [5, 17, 19, 20]) {
    const [k, label] = IND[c];
    ge.push([`${k}_nominal`, series(ax, yoy(lv(c, "current")), { name: `${k}_nominal_yoy_pct_back`, label: `${label}, nominal growth`, unit: "pct_yoy", nominal: true })]);
  }
  out["gdp-back-growth"] = bundleOf({ ...meta, unit: "pct_yoy",
    coverage: "The NSO back series, annual real and nominal growth of the indicators gdp-back does not carry",
    note: "Computed from the back series' constant-price (real) and current-price (nominal) levels. GDP, GVA, consumption, investment and government consumption growth are in gdp-back." }, ax, ge);
  const gdpCur = lv(5, "current");
  const se = [];
  for (const c of [1, 2, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]) {
    const [k, label] = IND[c];
    se.push([k, series(ax, ratio(lv(c, "current"), gdpCur), { name: `${k}_pct_of_nominal_gdp_back`, label: `${label}, share of GDP`, unit: "pct_of_gdp", nominal: true })]);
  }
  se.push(["net_exports", series(ax, ratio(comb([lv(14, "current"), lv(15, "current")], [1, -1]), gdpCur), { name: "net_exports_pct_of_nominal_gdp_back", label: "Net exports, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  se.push(["discrepancy", series(ax, ratio(D.current, gdpCur), { name: "discrepancy_pct_of_nominal_gdp_back", label: "Discrepancy, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  se.push(["nni", series(ax, ratio(nni.current, gdpCur), { name: "nni_pct_of_nominal_gdp_back", label: "Net national income, share of GDP (computed)", unit: "pct_of_gdp", nominal: true })]);
  out["gdp-back-shares"] = bundleOf({ ...meta, unit: "pct_of_gdp",
    coverage: "The NSO back series, each line as a share of nominal GDP, 1950-51 to 2011-12",
    note: "Gross saving and fixed investment as shares of GDP are in gdp-back (saving_rate, gfcf_rate)." }, ax, se);
  const lab = Object.fromEntries(Object.values(INDUSTRY).map(([k, l]) => [k, l]));
  const gvaCur = lv(1, "current");
  const ie = [];
  for (const k of ["agriculture", "mining", "manufacturing", "utilities", "construction", "trade_hotels", "transport", "finance", "realty", "public_admin", "other_services", "total"]) {
    const con = k === "total" ? lv(1, "constant") : g(1, `industry:${k}`, "constant"), cur = k === "total" ? gvaCur : g(1, `industry:${k}`, "current");
    const L = k === "total" ? "Total GVA" : lab[k];
    ie.push([`${k}_constant`, series(ax, con, { group: "Industry", name: `gva_${k}_constant_inr_crore_back`, label: `${L}, GVA at 2011-12 prices`, unit: "inr_crore" })]);
    ie.push([`${k}_current`, series(ax, cur, { group: "Industry", name: `gva_${k}_current_inr_crore_back`, label: `${L}, GVA at current prices`, unit: "inr_crore", nominal: true })]);
    if (k !== "total") ie.push([`${k}_share`, series(ax, ratio(cur, gvaCur), { group: "Industry", name: `gva_${k}_pct_of_nominal_gva_back`, label: `${L}, share of GVA`, unit: "pct_of_gva", nominal: true })]);
  }
  out["gdp-back-industries"] = bundleOf({ ...meta, unit: "inr_crore",
    coverage: "The NSO back series, GVA by the 11 industries, 1950-51 to 2011-12: levels at 2011-12 and current prices and each industry's share of nominal GVA",
    note: "Real growth by industry is in gdp-back. Shares are current prices over current prices. The 11 industries add up to total GVA only from 2004-05: before that their sum runs above the published total in most years (by Rs 471 crore of Rs 9,809 crore in 1950-51, at current prices) and below it in a few (1996-97 to 1998-99, 2003-04), as published by the NSO. Shares are of the published total, so before 2004-05 they need not sum to 100." }, ax, ie);
  const sb = [];
  for (const [, [k, L, parent]] of Object.entries(SUBINDUSTRY)) {
    const con = g(1, `sub:${k}`, "constant"), cur = g(1, `sub:${k}`, "current");
    if (!con.size && !cur.size) continue;
    const gr = { group: lab[parent] };
    sb.push([`${k}_constant`, series(ax, con, { ...gr, name: `gva_${k}_constant_inr_crore_back`, label: `${L}, GVA at 2011-12 prices`, unit: "inr_crore" })]);
    sb.push([`${k}_current`, series(ax, cur, { ...gr, name: `gva_${k}_current_inr_crore_back`, label: `${L}, GVA at current prices`, unit: "inr_crore", nominal: true })]);
    sb.push([`${k}_real_yoy`, series(ax, yoy(con), { ...gr, name: `gva_${k}_real_yoy_pct_back`, label: `${L}, real GVA growth`, unit: "pct_yoy" })]);
    sb.push([`${k}_share`, series(ax, ratio(cur, gvaCur), { ...gr, name: `gva_${k}_pct_of_nominal_gva_back`, label: `${L}, share of GVA`, unit: "pct_of_gva", nominal: true })]);
  }
  out["gdp-back-subindustries"] = bundleOf({ ...meta, unit: "inr_crore",
    coverage: "The NSO back series, GVA by the 19 sub-industries, 1950-51 to 2011-12: levels, real growth and share of nominal GVA",
    note: "The back series adds a nineteenth sub-industry, transport by other means, that the current series folds into the others." }, ax, sb);
  return out;
}

export function buildNasDeep(root, dcfg, vintage) {
  const rd = (n) => JSON.parse(fs.readFileSync(path.join(root, "data/raw", n), "utf8"));
  const metaOf = (base) => ({ dossier: "gdp", base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy });
  const written = {
    ...buildCurrent(rd("nas-deep-2011-current-annual.json"), rd("nas-deep-2011-current-quarterly.json"), { slug: "gdp", nameSuffix: "", baseYear: "2011-12", meta: metaOf(dcfg.base) }),
    ...buildCurrent(rd("nas-deep-2022-current-annual.json"), rd("nas-deep-2022-current-quarterly.json"), { slug: "gdp-2022", nameSuffix: "_base2022", baseYear: "2022-23", meta: metaOf(dcfg.fetch.fetch2022.base_year) }),
    ...buildBack(rd("nas-deep-2011-back-annual.json"), { meta: metaOf(dcfg.fetch.back.base) }),
  };
  for (const [slug, b] of Object.entries(written)) writeSeries(root, `data/series/${slug}.json`, b);
  return Object.keys(written);
}
