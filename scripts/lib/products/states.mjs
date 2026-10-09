// scripts/lib/products/states.mjs: state economies. Two sources, one guide (`states`).
//
// 1. MoSPI, National Accounts, regional account (eSankhyiki `nas/getNASData`, account_code 2,
//    base 2011-12, series Current, annual). The source of record. Indicators:
//      23 GSDP, 24 NSDP (₹ crore); 25 per-capita NSDP (₹); 26 to 28 their growth rates (%, one
//      decimal); 29 GSVA and 30 NSVA by industry and sub-industry (₹ lakh); 31 per-capita GSDP,
//      32 per-capita NSDP (₹; 32 is served but missing from the indicator list); 33 taxes and
//      34 subsidies on products (₹ lakh). Current and constant (2011-12) prices on every row.
//    Quirks found live (2026-10-09):
//      - 23 to 28 serve 30 states; Assam, Haryana, Nagaland and Ladakh are absent, though 29 to
//        34 serve all 34. GSDP = GSVA + taxes - subsidies holds to rounding for every one of
//        the 30 (validate checks it), so for the four we bake GSDP (and NSDP from NSVA) from
//        those published parts, flagged `derived` on the series. Never estimated otherwise.
//      - 32 equals 25 wherever both exist (validate checks it) and covers the four too.
//      - No revision field: each year is the state's latest estimate. Which years are advance
//        or provisional for which state, the API does not say.
//      - Jammu & Kashmir: one row name for two territories. The RBI Handbook's footnote to
//        Table 19 (same NSO figures): 2011-12 to 2018-19 cover J&K and Ladakh; 2019-20 on, the
//        UT of J&K only. Split into two series here, never joined; growth is never computed
//        across 2018-19 to 2019-20. Ladakh is served only from 2022-23 (current prices).
//      - Andhra Pradesh and Telangana are served separately from 2011-12: the states' own
//        figures for today's territories. Undivided Andhra Pradesh is not in this series.
//    Growth is computed from constant-price (real) or current-price (nominal) LEVELS; the
//    API's one-decimal growth indicators ride along as a cross-check (validate.mjs).
//
// 2. RBI, Handbook of Statistics on Indian States, every table, read from the local Data Bank
//    mirror of DBIE (182 reports, menu "Handbook of Statistics on Indian States"). The second
//    view: the SDP tables cross-check MoSPI (and carry the retired 2004-05 base as its own
//    ruler), and the rest (state finances, farms, power, roads, banking, health, prices)
//    give each state's economy its shape. Every table is baked generically into its own
//    bundle `states-hbs-t<table>` (the 2004-05 SDP base apart, `...-2004`): one series per
//    state x the table's own dimensions x measure, values exactly as DBIE serves them.
//    Splits handled the same way as above: undivided Andhra Pradesh (the code before
//    Telangana appears in a table) and J&K before and after 2019-20 are separate series.
//
// Hand checks (one value per bundle family, against the agencies' own publications):
//   - RBI Handbook 2024-25, Table 19 (rbi.org.in PublicationsView id=23468), per-capita NSDP
//     at current prices, Bihar 2024-25: ₹69,321. Our states-hbs-t019 bihar 2024-25 = 69321.
//     MoSPI's newer vintage gives ₹69,211 for the same year (states-pcnsdp-current): the
//     Handbook lags MoSPI by one revision round; both are as published.
//   - MoSPI eSankhyiki, GSDP current prices, Andhra Pradesh 2025-26: ₹17,62,357 crore
//     (the first row the API serves; states-gsdp-current andhra_pradesh 2025-26 = 1762357).
//
// Usage: node scripts/fetch.mjs only states        (both sources, bundles and catalogue)
//        node scripts/lib/products/states.mjs --catalogue   (catalogue only, from the raw dumps)

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { mospi, mospiAll } from "../mospi.mjs";
import { databankRoot } from "../databank.mjs";
import { parseCsv, parseNumber } from "../tabular.mjs";
import { writeSeries, writeRaw, writeJson, round2 } from "../util.mjs";

const NAS_RAW = "data/raw/states-nas.json";
const HBS_RAW = "data/raw/states-hbs.json";
const CATALOGUE = "data/coverage/states.catalogue.json";
const HBS_MENU = "Handbook of Statistics on Indian States";

/* ------------------------------------------------------------------ states */

export const slug = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
// one key per state across both sources (labels stay as each source serves them)
const ALIAS = { keralam: "kerala" };
const stateSlug = (s) => { const k = slug(s); return ALIAS[k] ?? k; };
const fyStart = (fy) => Number(String(fy).slice(0, 4));
const fyDate = (fy) => `${fyStart(fy)}-04-01`;
const fyLabel = (y) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
const JK_UT_FROM = 2019;          // FY 2019-20: the first year of the UT of Jammu & Kashmir

/** The series identity of one (state, year): J&K before and after 2019-20 are different
 *  territories; undivided Andhra Pradesh (years before `apSplit`) is not today's state. */
function stateId(name, year, apSplit) {
  const s = stateSlug(name);
  if (s === "jammu_and_kashmir") {
    return year < JK_UT_FROM
      ? { key: "jammu_and_kashmir_state", label: "Jammu & Kashmir (state, with Ladakh, to 2018-19)" }
      : { key: "jammu_and_kashmir_ut", label: "Jammu & Kashmir (UT, from 2019-20)" };
  }
  if (s === "andhra_pradesh" && apSplit != null && year < apSplit) return { key: "andhra_pradesh_undivided", label: "Andhra Pradesh (undivided, to " + fyLabel(apSplit - 1) + ")" };
  return { key: s, label: String(name).trim() };
}

/* ------------------------------------------------------------------ bundles */

/** Assemble a bundle from Map(key -> { label, values: Map(dateIso -> number), ...extra }).
 *  The axis runs continuously over the dates any series reports (or exactly those dates when
 *  `sparse`); interior nulls are declared in the series' own gaps. */
function assemble(entries, { sparse = false, stepMonths = 12, gapsNote } = {}) {
  const all = new Set();
  for (const e of entries.values()) for (const [d, v] of e.values) if (v != null) all.add(d);
  const sorted = [...all].sort();
  if (!sorted.length) return null;
  let dates = sorted;
  if (!sparse) {
    dates = [];
    const [y0, m0] = sorted[0].split("-").map(Number);
    for (let t = new Date(Date.UTC(y0, m0 - 1, 1)); t.toISOString().slice(0, 10) <= sorted.at(-1); t = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + stepMonths, 1))) dates.push(t.toISOString().slice(0, 10));
  }
  const series = {};
  for (const [k, e] of entries) {
    const { values, label, ...extra } = e;
    const data = dates.map((d) => values.get(d) ?? null);
    const first = data.findIndex((v) => v != null);
    if (first < 0) continue;
    const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
    series[k] = { name: k, label, ...extra, data, ...(gaps.length ? { gaps, gapsNote: gapsNote ?? "Not published for these years." } : {}) };
  }
  return { dates, series };
}

/* ------------------------------------------------------------------ MoSPI */

const NAS_P = { base_year: "2011-12", series: "Current", frequency_code: 1, account_code: 2 };

async function fetchNas(root, vintage) {
  const list = await mospi("nas/getNasIndicatorList", { account_code: 2 });
  const listed = (list.data?.indicator ?? []).map((x) => ({ code: Number(x.indicator_code), name: x.description }));
  if (!listed.length) throw new Error("states: NAS regional indicator list came back empty");
  // the list omits codes the endpoint serves (32 on 2026-10-09): probe the regional block
  const codes = new Set(listed.map((x) => x.code));
  // probe the documented regional block, 23 to 34 (35 and up answer HTTP 500, checked 2026-10-09)
  for (let c = 23; c <= 34; c++) codes.add(c);
  const indicators = {};
  for (const code of [...codes].sort((a, b) => a - b)) {
    let rows;
    try { rows = await mospiAll("nas/getNASData", { ...NAS_P, indicator_code: code }); }
    catch (e) { console.warn(`states: NAS indicator ${code}: ${e.message.slice(0, 120)}`); continue; }
    if (!rows.length) continue;
    indicators[code] = rows;
    console.log(`states: NAS indicator ${code} (${rows[0].indicator}): ${rows.length} rows`);
  }
  // anchor: the GSDP indicator must serve Andhra Pradesh's 2011-12 GSDP near ₹3.8 lakh crore
  const ap = (indicators[23] ?? []).find((r) => r.state === "Andhra Pradesh" && r.year === "2011-12");
  if (!ap || !(Number(ap.current_price) > 3e5 && Number(ap.current_price) < 4.5e5)) throw new Error("states: no data returned: NAS 23 Andhra Pradesh 2011-12 GSDP missing or out of range");
  writeRaw(root, NAS_RAW, {
    vintage,
    note: "MoSPI eSankhyiki nas/getNASData, account_code 2 (regional), base 2011-12, series Current, annual. Every row of every regional indicator served, as served. `listed` is the indicator list endpoint's own reply.",
    params: NAS_P, listed, indicators,
  });
  return JSON.parse(fs.readFileSync(path.join(root, NAS_RAW), "utf8"));
}

// GSVA/NSVA industry labels as served -> stable keys. An unknown label fails the build:
// a new industry must be read and placed, never guessed.
const IND = {
  "Agriculture, Livestock, Forestry and Fishing": ["agriculture", "Agriculture, forestry and fishing", "agriculture"],
  "Mining and Quarrying": ["mining", "Mining and quarrying", "industry"],
  "Manufacturing": ["manufacturing", "Manufacturing", "industry"],
  "Electricity, Gas, Water Supply & Other Utility Services": ["utilities", "Electricity, gas, water and utilities", "industry"],
  "Construction": ["construction", "Construction", "industry"],
  "Trade, Repair, Hotels and Restaurants": ["trade_hotels", "Trade, repair, hotels and restaurants", "services"],
  "Transport, Storage, Communication & Services Related to Broadcasting": ["transport_comm", "Transport, storage and communication", "services"],
  "Financial Services": ["financial", "Financial services", "services"],
  "Real Estate, Ownership of Dwelling & Professional Services": ["real_estate", "Real estate, dwellings and professional services", "services"],
  "Public Administration": ["public_admin", "Public administration", "services"],
  "Other Services": ["other_services", "Other services", "services"],
  "Total Gross State Value Added": ["total", "Total GSVA", null],
  "Total Net State Value Added": ["total", "Total NSVA", null],
};
const SUB = {
  "Crops": ["crops", "Crops"], "Livestock": ["livestock", "Livestock"], "Forestry and Logging": ["forestry", "Forestry and logging"],
  "Fishing and Aquaculture": ["fishing", "Fishing and aquaculture"], "Trade & Repair Services": ["trade_repair", "Trade and repair"],
  "Hotels & Restaurants": ["hotels", "Hotels and restaurants"], "Railways": ["railways", "Railways"], "Road Transport": ["road", "Road transport"],
  "Water Transport": ["water", "Water transport"], "Air Transport": ["air", "Air transport"], "Services Incidental to Transport": ["transport_services", "Services incidental to transport"],
  "Storage": ["storage", "Storage"], "Communication & Services Related to Broadcasting": ["communication", "Communication and broadcasting"],
};
export const industryKey = (r) => {
  const i = IND[r.industry];
  if (!i) throw new Error(`states: unknown industry label "${r.industry}" in NAS ${r.indicator}`);
  if (r.subindustry == null || r.subindustry === "") return { key: i[0], label: i[1], group: i[2], parent: null };
  const s = SUB[r.subindustry];
  if (!s) throw new Error(`states: unknown sub-industry label "${r.subindustry}" under "${r.industry}"`);
  return { key: `${i[0]}__${s[0]}`, label: `${i[1]}: ${s[1]}`, group: i[2], parent: i[0] };
};

function buildNas(root, raw, vintage, dcfg) {
  const I = raw.indicators;
  const meta = (extra) => ({ dossier: "states", frequency: "annual", base: "2011-12", source: dcfg.source_agency, vintage, mock: false, geo: "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });
  const put = (rel, b, extra) => {
    if (!b) throw new Error(`states: ${rel} came out empty`);
    const obj = { meta: meta({ latestPeriod: b.dates.at(-1).slice(0, 7), ...extra }), dates: b.dates, series: b.series, ...(b.crosscheck ? { crosscheck: b.crosscheck } : {}) };
    writeSeries(root, `data/series/${rel}.json`, obj);
    return obj;
  };
  // level maps: field -> stateKey -> { label, values }
  const levels = (code, field, scale = 1, pick = () => true) => {
    const out = new Map();
    for (const r of I[code] ?? []) {
      if (!pick(r)) continue;
      const v = parseNumber(r[field]);
      const id = stateId(r.state, fyStart(r.year));
      const e = out.get(id.key) ?? { label: id.label, values: new Map() };
      if (v != null) e.values.set(fyDate(r.year), scale === 1 ? v : round2(v * scale));
      out.set(id.key, e);
    }
    for (const [k, e] of out) if (![...e.values.values()].length) out.delete(k);
    return out;
  };
  const totalOnly = (r) => /^Total /.test(r.industry) && (r.subindustry == null || r.subindustry === "");
  const PRICES = [["current", "current_price", "current prices"], ["constant", "constant_price", "constant 2011-12 prices"]];
  const served23 = new Set((I[23] ?? []).map((r) => r.state));
  const missing23 = [...new Set((I[29] ?? []).map((r) => r.state))].filter((s) => !served23.has(s)).sort();
  const missingKeys = new Set(missing23.map((s) => slug(s)));
  // Copied blocks: a state whose rows for one indicator repeat another indicator's
  // current-price values in every year is a server defect, not data. Seen 2026-10-09:
  // Karnataka's NSVA (30) is its GSVA at current prices (the "total" equals GSVA's, current
  // equals constant on all 350 rows); its per-capita NSDP under 32 is its per-capita GSDP (31).
  // Such a block is excluded, never baked, and disclosed in the bundle note.
  const copied = (codeA, codeB, pick = () => true) => {
    const b = new Map((I[codeB] ?? []).filter(pick).map((r) => [`${r.state}|${r.year}`, r.current_price]));
    const byState = new Map();
    for (const r of (I[codeA] ?? []).filter(pick)) {
      if (r.current_price == null) continue;
      const o = byState.get(r.state) ?? { n: 0, same: 0 }; o.n++;
      if (r.current_price === b.get(`${r.state}|${r.year}`) && (r.year === "2011-12" || r.constant_price === r.current_price)) o.same++;
      byState.set(r.state, o);
    }
    return new Set([...byState].filter(([, o]) => o.n >= 3 && o.same === o.n).map(([s]) => s));
  };
  const nsvaCopied = copied(30, 29, totalOnly), pc32Copied = copied(32, 31);
  for (const s of nsvaCopied) console.warn(`states: NAS 30 (NSVA) for ${s} repeats its GSVA at current prices: excluded`);
  for (const s of pc32Copied) console.warn(`states: NAS 32 (per-capita NSDP) for ${s} repeats its per-capita GSDP: excluded`);
  const served25 = new Set((I[25] ?? []).map((r) => r.state));
  const COPY_NOTE = (code, states, of) => states.size ? ` Excluded as a server defect: ${[...states].join(", ")}, whose indicator ${code} rows repeat ${of} (current equals constant in every year).` : "";
  const DERIVED_NOTE = "MoSPI's GSDP and NSDP indicators (23, 24) do not serve this state; the value is MoSPI's own published GSVA (NSVA) plus taxes on products less subsidies on products, the identity that reproduces the published GSDP of every state that is served.";

  const out = {};
  for (const [pk, field, words] of PRICES) {
    for (const [what, code, vaCode, name, note] of [["gsdp", 23, 29, "Gross state domestic product", "GSDP"], ["nsdp", 24, 30, "Net state domestic product", "NSDP"]]) {
      const pub = levels(code, field);
      const va = levels(vaCode, field, 0.01, (r) => totalOnly(r) && !(vaCode === 30 && nsvaCopied.has(r.state))), tax = levels(33, field, 0.01), sub = levels(34, field, 0.01);
      for (const k of missingKeys) {
        const v = va.get(k); if (!v) continue;
        const values = new Map();
        for (const [d, x] of v.values) {
          const t = tax.get(k)?.values.get(d), s = sub.get(k)?.values.get(d);
          if (t != null && s != null) values.set(d, round2(x + t - s));
        }
        if (values.size) pub.set(k, { label: `${v.label} (derived: ${what === "gsdp" ? "GSVA" : "NSVA"} + taxes - subsidies)`, derived: true, derivedNote: DERIVED_NOTE, values });
      }
      out[`${what}_${pk}`] = put(`states-${what}-${pk}`, assemble(pub), { unit: "inr_crore",
        coverage: `${name} (${note}) by state, ₹ crore at ${words}, 2011-12 base`,
        note: `MoSPI NAS regional account, indicator ${code}. ${missing23.join(", ")}: not served by indicator ${code}; derived from MoSPI's published value added, taxes and subsidies (series flagged derived). J&K split at 2019-20 (territory change). Each year is the state's latest estimate.` });
    }
    {
      // per-capita NSDP: indicator 25 where it serves the state, 32 for the four it does not
      const pc = levels(25, field);
      for (const [k, e] of levels(32, field, 1, (r) => !served25.has(r.state) && !pc32Copied.has(r.state))) pc.set(k, e);
      out[`pcnsdp_${pk}`] = put(`states-pcnsdp-${pk}`, assemble(pc), { unit: "inr",
        coverage: `Per-capita net state domestic product (income per person) by state, ₹ at ${words}, 2011-12 base`,
        note: `MoSPI NAS regional account, indicator 25 (30 states); indicator 32 for the states 25 does not serve (${[...new Set((I[32] ?? []).map((r) => r.state))].filter((x) => !served25.has(x)).join(", ")}). 32 equals 25 wherever both are served and 32 is not a copied block.${COPY_NOTE(32, pc32Copied, "indicator 31, per-capita GSDP")} Per-capita figures use each state's own population estimate, as published; we never divide by a population of our own. J&K split at 2019-20.` });
      out[`pcgsdp_${pk}`] = put(`states-pcgsdp-${pk}`, assemble(levels(31, field)), { unit: "inr",
        coverage: `Per-capita gross state domestic product by state, ₹ at ${words}, 2011-12 base`,
        note: "MoSPI NAS regional account, indicator 31. Per-capita figures use each state's own population estimate, as published. J&K split at 2019-20." });
    }
    // GSVA / NSVA by industry and sub-industry, ₹ crore (served in ₹ lakh)
    for (const [what, code, name] of [["gsva", 29, "Gross state value added"], ["nsva", 30, "Net state value added"]]) {
      const ent = new Map(); const inds = new Map();
      for (const r of I[code] ?? []) {
        if (code === 30 && nsvaCopied.has(r.state)) continue;
        const v = parseNumber(r[field]); const ik = { ...industryKey(r) }; const id = stateId(r.state, fyStart(r.year));
        if (code === 30 && ik.key === "total") ik.label = "Total NSVA";   // served as "Total Gross State Value Added" under 30 too
        inds.set(ik.key, { key: ik.key, label: ik.label, group: ik.group, parent: ik.parent });
        const k = `${id.key}__${ik.key}`;
        const e = ent.get(k) ?? { label: `${id.label}: ${ik.label}`, values: new Map() };
        if (v != null) e.values.set(fyDate(r.year), round2(v / 100));
        ent.set(k, e);
      }
      out[`${what}_${pk}`] = put(`states-${what}-${pk}`, assemble(ent), { unit: "inr_crore",
        coverage: `${name} by state, industry and sub-industry, ₹ crore at ${words}, 2011-12 base`,
        note: `MoSPI NAS regional account, indicator ${code}, served in ₹ lakh and converted to ₹ crore (two decimals). Series keys are <state>__<industry>[__<sub-industry>]. J&K split at 2019-20.${code === 30 ? " MoSPI labels the NSVA total row \"Total Gross State Value Added\"; it is the NSVA total." + COPY_NOTE(30, nsvaCopied, "the state's GSVA at current prices") : ""}`,
        industries: [...inds.values()] });
    }
    // taxes and subsidies on products
    {
      const ent = new Map();
      for (const [w, code] of [["taxes", 33], ["subsidies", 34]]) for (const [k, e] of levels(code, field, 0.01)) ent.set(`${k}__${w}`, { ...e, label: `${e.label}: ${w === "taxes" ? "taxes on products" : "subsidies on products"}` });
      out[`taxes_${pk}`] = put(`states-taxes-${pk}`, assemble(ent), { unit: "inr_crore",
        coverage: `Taxes and subsidies on products by state, ₹ crore at ${words}, 2011-12 base`,
        note: "MoSPI NAS regional account, indicators 33 and 34, served in ₹ lakh and converted to ₹ crore. GSDP = GSVA + taxes - subsidies. J&K split at 2019-20." });
    }
  }

  // growth from levels: real (constant) and nominal (current), GSDP, NSDP and per-capita NSDP
  const pubGrowth = (code, field) => { const m = new Map(); for (const [k, e] of levels(code, field)) m.set(k, e.values); return m; };
  for (const [pk, field, words] of [["real", "constant_price", "constant 2011-12 prices"], ["nominal", "current_price", "current prices"]]) {
    const ent = new Map(); const cross = new Map();
    for (const [what, lv, gcode] of [["gsdp", `gsdp_${pk === "real" ? "constant" : "current"}`, 26], ["nsdp", `nsdp_${pk === "real" ? "constant" : "current"}`, 27], ["pcnsdp", `pcnsdp_${pk === "real" ? "constant" : "current"}`, 28]]) {
      const b = out[lv]; const pg = pubGrowth(gcode, field);
      for (const [k, s] of Object.entries(b.series)) {
        const values = new Map();
        s.data.forEach((v, i) => {
          const p = s.data[i - 1];
          if (i > 0 && v != null && p != null && p !== 0) values.set(b.dates[i], round2((v / p - 1) * 100));
        });
        if (!values.size) continue;
        ent.set(`${k}__${what}`, { label: `${s.label.replace(/ \(derived.*\)$/, "")}: ${what === "gsdp" ? "GSDP" : what === "nsdp" ? "NSDP" : "per-capita NSDP"} growth`, ...(s.derived ? { derived: true } : {}), values });
        if (pg.has(k)) cross.set(`${k}__${what}`, pg.get(k));
      }
    }
    const b = assemble(ent, { gapsNote: "No level for the year before, so no growth." });
    b.crosscheck = { published_growth: Object.fromEntries([...cross].map(([k, m]) => [k, b.dates.map((d) => m.get(d) ?? null)])) };
    out[`growth_${pk}`] = put(`states-growth-${pk}`, b, { unit: "pct_yoy",
      coverage: `${pk === "real" ? "Real" : "Nominal"} growth of GSDP, NSDP and per-capita NSDP by state, per cent a year, at ${words}`,
      note: `Computed from the MoSPI levels in states-${"{gsdp,nsdp,pcnsdp}"}-${pk === "real" ? "constant" : "current"} (two decimals). MoSPI's own one-decimal growth indicators (26, 27, 28) are in crosscheck.published_growth. Growth is never computed across the J&K split, and the J&K UT series starts in 2020-21.` });
  }

  // what each state's economy runs on: farm, industry, services shares of GSVA (current prices)
  {
    const g = out.gsva_current; const ent = new Map();
    const states = new Set(Object.keys(g.series).map((k) => k.split("__")[0]));
    for (const st of states) {
      const tot = g.series[`${st}__total`]; if (!tot) continue;
      const parts = { agriculture: [], industry: [], services: [] };
      for (const ind of g.meta.industries) if (ind.group && !ind.parent) parts[ind.group].push(`${st}__${ind.key}`);
      for (const [grp, keys] of Object.entries(parts)) {
        const values = new Map();
        g.dates.forEach((d, i) => {
          const t = tot.data[i]; const xs = keys.map((k) => g.series[k]?.data[i]);
          if (t != null && t > 0 && xs.every((x) => x != null)) values.set(d, round2((xs.reduce((a, b) => a + b, 0) / t) * 100));
        });
        ent.set(`${st}__${grp}`, { label: `${tot.label.replace(/: Total GSVA$/, "")}: ${grp} share of GSVA`, values });
      }
    }
    put("states-structure", assemble(ent), { unit: "pct_share", coverage: "Agriculture, industry and services as a share of each state's GSVA, per cent, current prices",
      note: "Derived from states-gsva-current: agriculture = agriculture, forestry and fishing; industry = mining, manufacturing, utilities and construction; services = the other six. Shares of total GSVA at current prices, two decimals. The usual RBI Handbook grouping (its 'Industry' tables)." });
  }
  // the eleven industries' shares of each state's GSVA (current prices): the finer shape
  {
    const g = out.gsva_current; const ent = new Map();
    for (const [k, s] of Object.entries(g.series)) {
      const [st, ind, sub] = k.split("__");
      if (sub || ind === "total") continue;
      const tot = g.series[`${st}__total`]; if (!tot) continue;
      const values = new Map();
      g.dates.forEach((d, i) => { if (s.data[i] != null && tot.data[i] > 0) values.set(d, round2((s.data[i] / tot.data[i]) * 100)); });
      ent.set(k, { label: `${s.label}, share of GSVA`, values });
    }
    out.industry_shares = put("states-industry-shares", assemble(ent), { unit: "pct_share",
      coverage: "Each of eleven industries as a share of each state's GSVA, per cent, current prices",
      note: "Derived from states-gsva-current: industry GSVA over total GSVA at current prices, two decimals. Keys are <state>__<industry>.",
      industries: g.meta.industries.filter((x) => !x.parent && x.key !== "total") });
  }
  out.spread = buildSpread(out, put);
  return { out, missing23 };
}

/** State finances against the size of each state's economy: the RBI Handbook's deficits, own
 *  tax revenue and outstanding liabilities (actuals, in rupees) over MoSPI's GSDP at current
 *  prices for the same fiscal year. Budget and revised estimates are never used. Liabilities
 *  (Table 176) carry no actual/estimate label, so they are used only for years in which the
 *  same state's deficit is an actual. */
function buildFinances(root, gsdp, vintage, dcfg) {
  const L = (rel) => JSON.parse(fs.readFileSync(path.join(root, `data/series/${rel}.json`), "utf8"));
  const T = { gfd: [L("states-hbs-t164"), "__actual", "Gross fiscal deficit"], rd: [L("states-hbs-t165"), "__actual", "Revenue deficit"],
    own_tax: [L("states-hbs-t168"), "__actual", "Own tax revenue"], debt: [L("states-hbs-t176"), "__outstanding_liabilities", "Outstanding liabilities, end of March"] };
  const ent = new Map(); const spikes = [];
  for (const st of Object.keys(gsdp.series)) {
    const g = gsdp.series[st];
    const actualYears = new Set();
    const gf = T.gfd[0]; const gs = gf.series[`${st}__actual`];
    if (gs) gf.dates.forEach((d, i) => { if (gs.data[i] != null) actualYears.add(d); });
    for (const [k, [B, suffix, name]] of Object.entries(T)) {
      const s = B.series[`${st}${suffix}`]; if (!s) continue;
      const values = new Map();
      gsdp.dates.forEach((d, i) => {
        const j = B.dates.indexOf(d); const v = j >= 0 ? s.data[j] : null; const y = g.data[i];
        if (v == null || y == null || y <= 0) return;
        if (k === "debt" && !actualYears.has(d)) return;
        // a stock more than four times both its neighbours is a source error (Table 176 at
        // end-March 2015: Delhi, Puducherry, Tripura, Uttarakhand, 5 to 10 times): left out
        const a = s.data[j - 1], c = s.data[j + 1];
        if (k === "debt" && a > 0 && c > 0 && v > 4 * Math.max(a, c)) { spikes.push(`${st} ${d.slice(0, 4)}`); return; }
        values.set(d, round2((v / 1e7 / y) * 100));
      });
      if (values.size) ent.set(`${st}__${k}`, { label: `${g.label.replace(/ \(derived.*\)$/, "")}: ${name.toLowerCase()}, per cent of GSDP`, values });
    }
  }
  const b = assemble(ent, { gapsNote: "No actual in the Handbook for these years." });
  for (const sp of spikes) { const [st, y] = sp.split(" "); const se = b.series[`${st}__debt`]; if (se?.gaps?.includes(`${y}-04-01`)) se.gapsNote = `The Handbook's end-March ${+y + 1} liabilities for this state are several times the years either side, a source error; that year is left out. Other gaps: no actual deficit that year.`; }
  const obj = { meta: { dossier: "states", frequency: "annual", base: "2011-12", source: "RBI Handbook of Statistics on Indian States (state finances) over MoSPI GSDP", vintage, mock: false, geo: "IND",
    releaseDate: null, latestPeriod: b.dates.at(-1).slice(0, 7), unit: "pct_of_gsdp",
    coverage: "State finances as a share of each state's economy: gross fiscal deficit, revenue deficit, own tax revenue and outstanding liabilities, per cent of GSDP",
    note: "Computed: RBI Handbook Tables 164, 165, 168 (actuals only; budget and revised estimates are left out) and 176 (outstanding liabilities, end of March, used only in years with an actual deficit for that state), in rupees, over MoSPI GSDP at current prices (states-gsdp-current) for the same fiscal year. The RBI's own ratios use the GSDP vintage of its day, so they can differ slightly. A negative revenue deficit is a surplus." + (spikes.length ? ` Left out as a source error (liabilities several times both neighbouring years): ${spikes.join(", ")}.` : "") },
    dates: b.dates, series: b.series };
  writeSeries(root, "data/series/states-finances.json", obj);
}

/** The gap between states, on one fixed panel so a year-to-year change is never a change in
 *  who is counted. Panel: every state and UT with per-capita NSDP in every year from 2011-12
 *  to the latest year that at least three-quarters of states report. Excluded by
 *  construction: Jammu & Kashmir (its territory changed in 2019-20), Ladakh (from 2022-23
 *  only), and any state missing a year. Unweighted: each state counts once, whatever its size. */
function buildSpread(out, put) {
  const cur = out.pcnsdp_current, con = out.pcnsdp_constant, gr = out.growth_real;
  const counts = cur.dates.map((_, i) => Object.values(cur.series).filter((s) => s.data[i] != null).length);
  const nStates = Object.keys(cur.series).length;
  let yi = counts.length - 1; while (yi > 0 && counts[yi] < 0.75 * nStates) yi--;
  const dates = cur.dates.slice(0, yi + 1);
  const panel = Object.keys(cur.series).filter((k) => !/^jammu_and_kashmir|^ladakh$/.test(k)
    && dates.every((_, i) => cur.series[k].data[i] != null && con.series[k]?.data[i] != null));
  const excluded = Object.keys(cur.series).filter((k) => !panel.includes(k));
  const lab = (k) => cur.series[k].label;
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const S = { gap_current: [], gap_constant: [], cv_constant: [], richest_current: [], poorest_current: [], median_current: [], median_real_growth: [] };
  const richest = [], poorest = [];
  dates.forEach((d, i) => {
    const xs = panel.map((k) => [k, cur.series[k].data[i]]).sort((a, b) => b[1] - a[1]);
    const cs = panel.map((k) => con.series[k].data[i]);
    const ks = panel.map((k) => [k, con.series[k].data[i]]).sort((a, b) => b[1] - a[1]);
    S.gap_current.push(round2(xs[0][1] / xs.at(-1)[1]));
    S.gap_constant.push(round2(ks[0][1] / ks.at(-1)[1]));
    const mean = cs.reduce((a, b) => a + b, 0) / cs.length;
    S.cv_constant.push(round2((Math.sqrt(cs.reduce((a, b) => a + (b - mean) ** 2, 0) / cs.length) / mean) * 100));
    S.richest_current.push(xs[0][1]); S.poorest_current.push(xs.at(-1)[1]);
    S.median_current.push(round2(median(xs.map((x) => x[1]))));
    const g = panel.map((k) => gr.series[`${k}__gsdp`]?.data[gr.dates.indexOf(d)]).filter((v) => v != null);
    S.median_real_growth.push(i === 0 || !g.length ? null : round2(median(g)));
    richest.push({ date: d, key: xs[0][0], label: lab(xs[0][0]) }); poorest.push({ date: d, key: xs.at(-1)[0], label: lab(xs.at(-1)[0]) });
  });
  const L = {
    gap_current: "Richest state's income per person as a multiple of the poorest's, current prices",
    gap_constant: "Richest state's income per person as a multiple of the poorest's, constant prices",
    cv_constant: "Spread of income per person across states (coefficient of variation, per cent), constant prices",
    richest_current: "Income per person in the richest state, ₹, current prices",
    poorest_current: "Income per person in the poorest state, ₹, current prices",
    median_current: "Income per person in the middle state (median), ₹, current prices",
    median_real_growth: "Real GSDP growth of the middle state (median), per cent",
  };
  const series = Object.fromEntries(Object.entries(S).map(([k, data]) => [k, { name: k, label: L[k], derived: true, data }]));
  return put("states-spread", { dates, series }, { unit: "mixed: see series labels",
    coverage: `The gap between states: richest against poorest, spread and middle state, a fixed panel of ${panel.length} states and UTs, ${fyLabel(Number(dates[0].slice(0, 4)))} to ${fyLabel(Number(dates.at(-1).slice(0, 4)))}`,
    note: `Derived from states-pcnsdp-current, states-pcnsdp-constant and states-growth-real (MoSPI per-capita NSDP, indicator 32; GSDP levels). Panel: every state and UT with per-capita NSDP at both prices in every year to the latest year at least three-quarters of states report. Unweighted: each state counts once. Not in the panel: ${excluded.map(lab).join(", ")}. Income per person is per-capita NSDP.`,
    panel: panel.map((k) => ({ key: k, label: lab(k) })), excluded: excluded.map((k) => ({ key: k, label: lab(k) })), richest, poorest });
}

/* ------------------------------------------------------------------ RBI Handbook */

/** Every Handbook report in the Data Bank mirror: { id, catalog, provider, header, rows, provenance }.
 *  The data provider is the one named Main / Query 1 (the others are SAP's unit and display
 *  pickers); a report without one fails loudly. */
function readHandbook(root) {
  const base = path.join(root, "data/raw/metadata/rbi_dbie/rbi_dbie_webi_rows");
  const flows = new Map(), manifests = new Map();
  for (const run of fs.readdirSync(base)) {
    const dir = path.join(base, run);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const m = j.metadata || {};
      if (!m.report_id) continue;
      if (m.webi_role === "manifest") {
        const prev = manifests.get(m.report_id);
        if (!prev || j.retrieved_at > prev.retrieved) manifests.set(m.report_id, { content: j.content_path, retrieved: j.retrieved_at });
      } else if (m.webi_role === "flow" && m.dataprovider?.id) {
        const k = `${m.report_id}|${m.dataprovider.id}`;
        const prev = flows.get(k);
        if (!prev || j.retrieved_at > prev.retrieved) flows.set(k, { content: j.content_path, meta: m, retrieved: j.retrieved_at, sha256: j.sha256 });
      }
    }
  }
  const reports = [];
  for (const [id, man] of manifests) {
    const body = JSON.parse(fs.readFileSync(man.content, "utf8"));
    const cat = body.catalog_row ?? {};
    if (cat.menu !== HBS_MENU) continue;
    const provs = [...flows.entries()].filter(([k]) => k.startsWith(id + "|")).map(([, v]) => v);
    const main = provs.filter((p) => /^(main|query 1)$/i.test(p.meta.dataprovider.name ?? ""));
    if (main.length !== 1) throw new Error(`states: Handbook report ${id} has ${main.length} data providers named Main/Query 1`);
    const p = main[0];
    let buf = fs.readFileSync(p.content);
    if (p.meta.stored_encoding === "gzip") buf = zlib.gunzipSync(buf);
    const table = parseCsv(buf.toString("utf8"), ";");
    reports.push({ id, catalog: cat, document: body.document?.name ?? null, provider: p.meta.dataprovider.name, header: table[0].map((h) => h.trim()), rows: table.slice(1).map((r) => r.map((c) => c.trim())),
      provenance: { report_id: id, data_provider: p.meta.dataprovider.id, retrieved_at: p.retrieved, sha256: p.sha256, document_id: p.meta.document_id } });
  }
  reports.sort((a, b) => Number(a.id) - Number(b.id));
  return reports;
}

// generic table reading. A column is a measure, a dimension, the state, the period, or noise.
const MEASURE = /^(dec\w*value\w*|decitemvalue\w*|value|actual|budget|budget estimate|revised|revised estimate|datavalue\d*|noofprojsanc|amountsanc|cumulativedis)$/i;
const DIMS = ["Dseries Description", "Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Hierarchy Level 3", "Item Description", "Vunitdescription"];
const MEASURE_LABEL = (h) => ({ actual: "actual", budget: "budget estimate", "budget estimate": "budget estimate", revised: "revised estimate", "revised estimate": "revised estimate",
  decitemvaluemale: "male", decitemvaluefemale: "female", decitemvalueoverall: "overall", decitemvaluetotal: "total", decitemvaluerural: "rural", decitemvalueurban: "urban",
  decreqitemvalue: "required", decsancitemvalue: "sanctioned", decinpositemvalue: "in position", decvacantitemvalue: "vacant", decshortfallitemvalue: "shortfall",
  decitemvalue1tc: "total capacity", decitemvalue2sh: "utilisation", decitemvalue3up: "utilisation per cent", noofprojsanc: "projects sanctioned", amountsanc: "amount sanctioned",
  cumulativedis: "cumulative disbursement", decitemvalue1state: "state", decitemvalue2region: "region" }[h.toLowerCase()] ?? h.toLowerCase().replace(/^dec|^data/, "").replace(/itemvalue/, "value "));

/** One Handbook report -> [{ suffix, base, periodKind, entries, dims, measures, units }]: one per
 *  base ("Base: 2004-05" / "Base: 2011-12") where a table carries two. */
export function parseHandbookTable(rep) {
  const H = rep.header; const col = (n) => H.indexOf(n);
  const iState = col("State Name"), iFis = col("Time Fis Year"), iDate = col("Time Date"), iCal = col("Time Cal Year"), iRegion = col("Region Name");
  if (iState < 0) return { error: "no State Name column" };
  const measures = H.map((h, i) => [h, i]).filter(([h]) => MEASURE.test(h));
  if (!measures.length) return { error: "no measure column" };
  const periodKind = iFis >= 0 ? "fy" : iDate >= 0 ? "asOn" : iCal >= 0 ? "calendar" : null;
  if (!periodKind) return { error: "no period column" };
  const periodOf = (r) => {
    if (periodKind === "fy") { const fy = r[iFis]; return /^\d{4}-\d{2}$/.test(fy) ? { date: fyDate(fy), year: fyStart(fy) } : null; }
    if (periodKind === "asOn") { const m = /^(\d{4})\/(\d{2})\//.exec(r[iDate]); return m ? { date: `${m[1]}-${m[2]}-01`, year: Number(m[2]) >= 4 ? Number(m[1]) : Number(m[1]) - 1 } : null; }
    const y = r[iCal]; return /^\d{4}$/.test(y) ? { date: `${y}-01-01`, year: Number(y) } : null;
  };
  // dimensions: whitelisted label columns that split rows beyond (state, period), deduplicated
  const rowsOk = rep.rows.filter((r) => r[iState] && periodOf(r));
  let dimCols = DIMS.map((n) => col(n)).filter((i) => i >= 0 && new Set(rowsOk.map((r) => r[i])).size > 1);
  const keyOf = (r, cols) => [r[iState], periodOf(r).date, ...cols.map((i) => r[i])].join("|");
  const nKeys = (cols) => new Set(rowsOk.map((r) => keyOf(r, cols))).size;
  // drop a dimension that adds no split given the others (Item Description duplicating Level 2, units)
  for (let changed = true; changed;) {
    changed = false;
    for (const i of dimCols) { const rest = dimCols.filter((j) => j !== i); if (nKeys(rest) === nKeys(dimCols)) { dimCols = rest; changed = true; break; } }
  }
  const baseCol = col("Dseries Description");
  const baseOf = (r) => { const m = baseCol >= 0 ? /(\d{4}-\d{2})/.exec(r[baseCol]) : null; return m ? m[1] : null; };
  const bases = [...new Set(rowsOk.map(baseOf))];
  const splitBases = bases.filter(Boolean).length > 1;
  // Andhra Pradesh: Telangana was formed on 2 June 2014. A table that carries Andhra Pradesh
  // before 2014-15 with no Telangana beside it is reporting the undivided state for those
  // years; a table with Telangana from its start (the SDP tables, back-cast by the states)
  // or one that starts after the split has no undivided years.
  const hasVal = (r) => measures.some(([, i]) => parseNumber(r[i]) != null);
  const pre = (name) => rowsOk.some((r) => slug(r[iState]) === name && periodOf(r).year < 2014 && hasVal(r));
  const apSplitUsed = pre("andhra_pradesh") && !pre("telangana") ? 2014 : null;

  const groups = new Map();
  const collisions = [];
  for (const r of rowsOk) {
    const b = splitBases ? baseOf(r) : null;
    const g = groups.get(b) ?? { entries: new Map(), seen: new Map() }; groups.set(b, g);
    const p = periodOf(r);
    const dimVals = dimCols.filter((i) => !(splitBases && i === baseCol)).map((i) => r[i]).filter((x) => x !== "");
    for (const [h, i] of measures) {
      const isRegion = /region$/i.test(h);
      if (isRegion && (iRegion < 0 || !r[iRegion])) continue;
      const who = isRegion ? { key: "region_" + slug(r[iRegion]), label: r[iRegion].replace(/\b\w+/g, (w) => w[0] + w.slice(1).toLowerCase()) } : stateId(r[iState], p.year, apSplitUsed);
      const parts = [who.key, ...dimVals.map(slug), ...(measures.length > 1 ? [slug(MEASURE_LABEL(h))] : [])];
      const key = parts.join("__");
      const label = [who.label, ...dimVals, ...(measures.length > 1 ? [MEASURE_LABEL(h)] : [])].join(": ");
      const v = parseNumber(r[i]);
      const ck = `${key}|${p.date}`;
      if (g.seen.has(ck)) {
        const prev = g.seen.get(ck);
        if (prev !== v && !(isRegion)) collisions.push(`${key} ${p.date}: ${prev} vs ${v}`);
        if (prev != null || v == null) continue;
      }
      g.seen.set(ck, v);
      const e = g.entries.get(key) ?? { label, values: new Map() };
      if (v != null) e.values.set(p.date, v);
      g.entries.set(key, e);
    }
  }
  const units = col("Vunitdescription") >= 0 ? [...new Set(rowsOk.map((r) => r[col("Vunitdescription")]).filter(Boolean))] : [];
  return {
    periodKind, apSplit: apSplitUsed, dims: dimCols.map((i) => H[i]), measures: measures.map(([h]) => h), units, collisions,
    parts: [...groups].map(([b, g]) => ({ base: b, entries: g.entries })),
  };
}

const hbsSlug = (cat, base) => `states-hbs-t${String(cat.table_no).padStart(3, "0")}${base === "2004-05" ? "-2004" : ""}`;

function buildHandbook(root, reports, vintage, dcfg) {
  const made = [], problems = [], byTable = new Map();
  for (const rep of reports) {
    const t = String(rep.catalog.table_no ?? "").trim();
    if (!t) { problems.push(`${rep.id}: no table number`); continue; }
    (byTable.get(t) ?? byTable.set(t, []).get(t)).push(rep);
  }
  for (const [t, reps] of [...byTable].sort((a, b) => Number(a[0]) - Number(b[0]))) {
    // a table published under two report ids: bake the first, record the other as its duplicate
    const rep = reps[0];
    const P = parseHandbookTable(rep);
    if (P.error) { problems.push(`${rep.id} (table ${t}): ${P.error}`); made.push({ report: rep.id, table: t, error: P.error, duplicates: reps.slice(1).map((r) => r.id) }); continue; }
    if (P.collisions.length) { problems.push(`${rep.id} (table ${t}): ${P.collisions.length} conflicting duplicate cells, e.g. ${P.collisions[0]}`); made.push({ report: rep.id, table: t, error: `conflicting duplicate cells (${P.collisions.length})`, duplicates: reps.slice(1).map((r) => r.id) }); continue; }
    for (const part of P.parts) {
      const sparse = P.periodKind !== "fy" || false;
      let b = assemble(part.entries, { gapsNote: "Not in the Handbook table for these years." });
      if (b && b.dates.length > 2 * new Set([...part.entries.values()].flatMap((e) => [...e.values.keys()])).size) b = assemble(part.entries, { sparse: true, gapsNote: "Not in the Handbook table for these years." });
      if (!b) continue;
      const isSparse = b.dates.some((d, i) => i > 0 && (Number(d.slice(0, 4)) - Number(b.dates[i - 1].slice(0, 4)) !== 1 || d.slice(5) !== b.dates[i - 1].slice(5)));
      const rel = hbsSlug(rep.catalog, part.base);
      const isSdp = /STATE DOMESTIC PRODUCT/i.test(rep.catalog.section ?? "");
      writeSeries(root, `data/series/${rel}.json`, {
        meta: { dossier: isSdp ? "states" : "states-hbs", frequency: "annual", base: isSdp ? (part.base ?? "2011-12") : "as published",
          source: "Reserve Bank of India, Handbook of Statistics on Indian States (via DBIE)", vintage, mock: false, geo: "IND", releaseDate: null,
          latestPeriod: b.dates.at(-1).slice(0, 7), unit: P.units.length === 1 ? P.units[0] : "as served by DBIE",
          periodKind: P.periodKind, sparse: isSparse, hbs: { table: t, report: rep.id, section: rep.catalog.section, title: rep.catalog.report_name, duplicates: reps.slice(1).map((r) => r.id) },
          coverage: `${rep.catalog.report_name}${part.base ? ` (base ${part.base})` : ""}: RBI Handbook of Statistics on Indian States, Table ${t}`,
          note: `DBIE report ${rep.id}${reps.length > 1 ? ` (also published as ${reps.slice(1).map((r) => r.id).join(", ")})` : ""}, data provider "${rep.provider}". Values exactly as DBIE serves them${P.units.length ? `; DBIE's unit label: ${P.units.join(", ")}` : ""}${/inr|rupee|crore|lakh/i.test(P.units.join(" ")) || P.measures.some((m) => /actual|budget|revised|amount/i.test(m)) ? " (rupee amounts are served in rupees)" : ""}. Periods: ${P.periodKind === "fy" ? "fiscal years, dated at April" : P.periodKind === "asOn" ? "as on the date served" : "calendar years"}. Dimensions: ${P.dims.join(", ") || "none"}; measures: ${P.measures.map(MEASURE_LABEL).join(", ")}.${P.apSplit ? " Andhra Pradesh before 2014-15 is the undivided state, a separate series (Telangana was formed on 2 June 2014; 2014-15 straddles the split)." : ""}${Object.keys(b.series).some((k) => k.startsWith("jammu_and_kashmir_state")) && Object.keys(b.series).some((k) => k.startsWith("jammu_and_kashmir_ut")) ? " Jammu & Kashmir to 2018-19 (with Ladakh) and from 2019-20 (the UT) are separate series; 2019-20 straddles the change of 31 October 2019." : ""}` },
        dates: b.dates, series: b.series,
      });
      made.push({ report: rep.id, table: t, bundle: rel, base: part.base, series: Object.keys(b.series).length, sdp: isSdp, duplicates: reps.slice(1).map((r) => r.id) });
    }
  }
  return { made, problems };
}

/* ------------------------------------------------------------------ catalogue */

/** The coverage catalogue, generated from the two sources' own listings (the NAS regional
 *  indicator list plus the codes it serves, with every state and industry they return; the
 *  Data Bank's catalogue of Handbook reports). Never typed. */
export function writeCatalogue(root) {
  const nas = JSON.parse(fs.readFileSync(path.join(root, NAS_RAW), "utf8"));
  const hbs = JSON.parse(fs.readFileSync(path.join(root, HBS_RAW), "utf8"));
  const items = [];
  const listed = new Set(nas.listed.map((x) => x.code));
  for (const [code, rows] of Object.entries(nas.indicators).sort((a, b) => a[0] - b[0])) {
    const name = rows[0].indicator;
    for (const price of ["current", "constant"]) {
      const field = price + "_price";
      const cut = new Map();
      for (const r of rows) {
        const st = slug(r.state);
        const ind = r.industry != null ? industryKey(r) : null;
        const id = `nas:${code}:${price}:${st}${ind ? ":" + ind.key.replace("__", ":") : ""}`;
        const c = cut.get(id) ?? { id, label: `${name}, ${r.state}${ind ? ", " + ind.label : ""}, ${price} prices`, dims: { indicator: Number(code), price, state: r.state, ...(ind ? { industry: ind.key } : {}), listed: listed.has(Number(code)) }, n: 0 };
        if (parseNumber(r[field]) != null) c.n++;
        cut.set(id, c);
      }
      for (const c of cut.values()) { c.dims.values = c.n; delete c.n; items.push(c); }
    }
  }
  for (const [id, rep] of Object.entries(hbs.reports)) {
    const c = rep.catalog;
    items.push({ id: `hbs:${id}`, label: `Handbook of Statistics on Indian States, Table ${c.table_no}: ${c.report_name}`,
      dims: { report: id, table: c.table_no, section: c.section, frequency: c.frequency, to: c.to_date_raw } });
  }
  items.sort((a, b) => (a.id < b.id ? -1 : 1));
  writeJson(root, CATALOGUE, {
    family: "states",
    source: "MoSPI NAS regional account (eSankhyiki, account_code 2) and RBI Handbook of Statistics on Indian States (DBIE, via the Data Bank)",
    generator: "scripts/lib/products/states.mjs --catalogue",
    generated_at: (nas.vintage > hbs.vintage ? nas.vintage : hbs.vintage),
    items,
  });
  return items.length;
}

/* ------------------------------------------------------------------ entry */

export async function buildStates(root, dcfg, vintage, cfg) {
  // MoSPI first: the source of record
  const nasRaw = await fetchNas(root, vintage);
  const { missing23 } = buildNas(root, nasRaw, nasRaw.vintage, dcfg);
  console.log(`states: MoSPI GSDP not served for ${missing23.join(", ")} (derived from published parts)`);

  // the RBI Handbook, every table
  const db = databankRoot(cfg?.families?.databank);
  const reports = readHandbook(db);
  if (reports.length < 150) throw new Error(`states: only ${reports.length} Handbook reports in the Data Bank mirror (expected about 182)`);
  // anchor: Table 21 (GSDP, current prices) must carry Bihar 2011-12 on the 2011-12 base
  writeRaw(root, HBS_RAW, {
    vintage,
    note: "RBI DBIE, Handbook of Statistics on Indian States: every report in the menu, read from the local Data Bank mirror (rbi_dbie_webi_rows). Per report: the DBIE catalogue row, the data provider read (Main / Query 1), its provenance (Data Bank fetch time and content sha256), the header and every row as served.",
    reports: Object.fromEntries(reports.map((r) => [r.id, { catalog: r.catalog, document: r.document, provider: r.provider, provenance: r.provenance, header: r.header, rows: r.rows }])),
  });
  const hbsRaw = JSON.parse(fs.readFileSync(path.join(root, HBS_RAW), "utf8"));
  const { made, problems } = buildHandbook(root, reports, hbsRaw.vintage, dcfg);
  buildFinances(root, JSON.parse(fs.readFileSync(path.join(root, "data/series/states-gsdp-current.json"), "utf8")), hbsRaw.vintage > nasRaw.vintage ? hbsRaw.vintage : nasRaw.vintage, dcfg);
  const t21 = made.find((m) => m.table === "21" && m.base === "2011-12");
  if (!t21) throw new Error("states: no data returned: Handbook Table 21 (GSDP, current prices, base 2011-12) did not bake");
  writeJson(root, "data/coverage/states.hbs-index.json", { generated_from: HBS_RAW, vintage: hbsRaw.vintage, tables: made, problems });
  for (const p of problems) console.warn("states: Handbook:", p);
  console.log(`states: Handbook ${reports.length} reports -> ${made.filter((m) => m.bundle).length} bundles, ${problems.length} problem(s)`);
  const n = writeCatalogue(root);
  console.log(`states: catalogue ${n} items`);
}

// standalone: regenerate the catalogue from the archived raw dumps
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes("--catalogue")) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  console.log(`catalogue: ${writeCatalogue(ROOT)} items`);
}
