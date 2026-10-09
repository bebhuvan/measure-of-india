// scripts/lib/products/residex.mjs: NHB RESIDEX, the National Housing Bank's housing price index.
//
// RESIDEX is built from the valuations banks and housing finance companies make when they lend
// against a home ("HPI at assessment prices", lookup HFC) and, until 2024, from developers'
// asking prices for flats under construction ("HPI at market prices for under-construction
// properties", lookup UC). It covers about 50 cities. Source: the public RESIDEX dashboards
// (scripts/lib/nhb.mjs); reverse-engineering notes in docs/reference/residex.md.
//
// THREE BASES, never joined (AGENTS.md rule 1); each is its own dashboard controller:
//   DashboardBY2013  base 2012-13 = 100   Apr-Jun 2013 to Jan-Mar 2018
//   DashboardBY2018  base 2017-18 = 100   Apr-Jun 2018 to Oct-Dec 2025 (UC to Jul-Sep 2024)
//   Dashboard        base 2024-25 = 100   Apr-Jun 2025 onward (assessment prices only)
// NHB also serves each newer base carried back before its start ("chkbefore1718"); those
// back-casts are NHB's bridges and are not baked: each period is shown on the base that was
// live for it.
//
// TWO METHODS, both baked: pricemtdid 2 = four-quarter moving average (the dashboards' default
// for every base; series keys without suffix) and pricemtdid 1 = the current quarter alone
// (suffix _q). The moving average is smoother and lags turns by up to a year.
//
// QUIRKS: NHB writes 0.0 where it has no value (UC after Sep 2024 on the 2017-18 base); a zero
// is never a price or an index here, so 0 becomes null. Prices per square metre and per square
// yard on the 2012-13 base are not ten times the per-square-foot price as they should be, so
// only ₹ per square foot is baked. Prices are weighted averages of carpet-area prices.
//
// Hand check: India, HPI at assessment prices, Apr-Jun 2026, 2024-25 base: 107.16 against 100.17 a
// year earlier, +7.0%, as in NHB's April-June 2026 press release (eight cities checked too; see
// docs/reference/residex.md).
import fs from "node:fs";
import path from "node:path";
import { nhbPost, nhbGet } from "../nhb.mjs";
import { writeSeries, writeRaw, writeJson } from "../util.mjs";

const BASES = [
  { ctl: "DashboardBY2013", base: "2012-13=100", tag: "2013", label: "base 2012-13 = 100" },
  { ctl: "DashboardBY2018", base: "2017-18=100", tag: "2018", label: "base 2017-18 = 100" },
  { ctl: "Dashboard", base: "2024-25=100", tag: "2025", label: "base 2024-25 = 100" },
];
const LOOKUPS = { HFC: "assessment prices", UC: "under-construction market prices" };
const METHODS = { 2: { suffix: "", label: "four-quarter moving average" }, 1: { suffix: "_q", label: "current quarter" } };
const PRICE = [["price", "WTAVG_COMPOSITE", "all sizes"], ["small", "WTAVG_LESSTHAN60", "homes up to 60 sq m (646 sq ft)"],
  ["mid", "WTAVG_60TO110", "homes of 60 to 110 sq m (646 to 1,184 sq ft)"], ["large", "WTAVG_GREATER110", "homes over 110 sq m (1,184 sq ft)"]];
const MOE = [["moe", "COMPOSITE_MARGIN_ERROR", "all sizes"], ["moe_small", "PRO_1_MARGIN_ERROR", "up to 60 sq m"],
  ["moe_mid", "PRO_2_MARGIN_ERROR", "60 to 110 sq m"], ["moe_large", "PRO_3_MARGIN_ERROR", "over 110 sq m"]];
export const citySlug = (c) => c.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const num = (v) => { const x = typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : v; return Number.isFinite(x) && x !== 0 ? x : null; };
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
// "Jun 2013" (quarter-end month) -> "2013-04-01"; cross-checked against QTR "13-14 Q1"
function qDate(row) {
  const m = String(row.QTR_YEAR).trim().match(/^([A-Za-z]{3})[a-z]*[\s-]+(\d{4})$/);
  if (!m) throw new Error(`residex: unreadable quarter "${row.QTR_YEAR}"`);
  const end = MON[m[1].toLowerCase()], y = +m[2];
  if (![3, 6, 9, 12].includes(end)) throw new Error(`residex: "${row.QTR_YEAR}" is not a quarter end`);
  const iso = `${y}-${String(end - 2).padStart(2, "0")}-01`;
  const q = String(row.QTR ?? "").match(/^(\d{2})-(\d{2}) Q([1-4])$/);
  if (q) {
    const y1 = 2000 + +q[1], want = { 1: `${y1}-04-01`, 2: `${y1}-07-01`, 3: `${y1}-10-01`, 4: `${y1 + 1}-01-01` }[q[3]];
    if (want !== iso) throw new Error(`residex: QTR "${row.QTR}" and QTR_YEAR "${row.QTR_YEAR}" disagree`);
  }
  return iso;
}

// residex:<base>:<place>:<hfc|uc>:<index|price|small|mid|large|records|moe...>:<ma4|q>
function catalogueId(tag, key) {
  const q = /_q$/.test(key), k = key.replace(/_q$/, "");
  const m = k.match(/^(.+?)_(hfc|uc)(?:_(.+))?$/);
  if (!m) throw new Error(`residex: unexpected series key ${key}`);
  return `residex:${tag}:${m[1].replace(/_/g, "-")}:${m[2]}:${m[3] ?? "index"}:${q ? "q" : "ma4"}`;
}

export async function buildResidex(root, dcfg, vintage) {
  const cities = await nhbGet("ApplicationUtilities/GetAllCity");
  if (!Array.isArray(cities) || cities.length < 30) throw new Error(`residex: no data returned: city list has ${cities?.length} entries (expected ~50)`);
  const raw = { cities, bases: {} };
  const catalogue = [];

  for (const B of BASES) {
    const R = (raw.bases[B.tag] = { country: {}, city: {} });
    for (const pm of [2, 1]) {
      R.country[pm] = await nhbPost(`${B.ctl}/Get_NHBResiCersai_PriceTrend`, { reporttype: "COUNTRY", lookup: "BOTH_INDEX", cityid: 0, pincode: 0, wardid: 0, pricemtdid: pm, locid: 0, chkbefore1718: 0 });
    }
    if (!R.country[2].length) throw new Error(`residex: no data returned for the all-India index on ${B.label}`);
    let ucLive = true;
    for (const c of cities) {
      for (const lk of ["HFC", "UC"]) {
        if (lk === "UC" && !ucLive) continue;
        for (const pm of [2, 1]) {
          const rows = await nhbPost(`${B.ctl}/Get_NHBResiCersai_PriceTrend`, { reporttype: "CITY", lookup: lk, cityid: c.value, pincode: 0, wardid: 0, pricemtdid: pm, locid: "0", chkbefore1718: 0 });
          ((R.city[c.value] ??= {})[lk] ??= {})[pm] = rows;
          // the 2024-25 base publishes no under-construction index: stop asking after the first city says so
          if (lk === "UC" && !rows.length && c === cities[0]) ucLive = false;
        }
      }
    }
    R.ucPublished = ucLive;
  }

  const rawRel = "data/raw/housing-residex.json";
  writeRaw(root, rawRel, { vintage, note: "NHB RESIDEX dashboard responses, as served: the city list, then per base (2013, 2018, 2025) the all-India index (COUNTRY, BOTH_INDEX) and each city's HFC and UC series, by method (2 = four-quarter moving average, 1 = current quarter).", ...raw });
  const V = JSON.parse(fs.readFileSync(path.join(root, rawRel), "utf8")).vintage;

  for (const B of BASES) {
    const R = raw.bases[B.tag];
    const idx = new Map(), prc = new Map();   // key -> { label, obs: Map(date -> v) }
    const put = (M, key, label, d, v) => { if (!M.has(key)) M.set(key, { label, obs: new Map() }); if (v != null) M.get(key).obs.set(d, v); };
    for (const pm of [2, 1]) for (const row of R.country[pm]) {
      const d = qDate(row), m = METHODS[pm];
      put(idx, `india_hfc${m.suffix}`, `India, HPI at assessment prices (${m.label})`, d, num(row.HFC_COUNTRY_INDEX));
      put(idx, `india_uc${m.suffix}`, `India, HPI at under-construction market prices (${m.label})`, d, num(row.UC_COUNTRY_INDEX));
    }
    for (const c of cities) {
      const k = citySlug(c.text);
      for (const lk of ["HFC", "UC"]) for (const pm of [2, 1]) {
        const m = METHODS[pm], L = lk.toLowerCase();
        for (const row of R.city[c.value]?.[lk]?.[pm] ?? []) {
          const d = qDate(row);
          put(idx, `${k}_${L}${m.suffix}`, `${c.text}, HPI at ${LOOKUPS[lk]} (${m.label})`, d, num(row[`${lk}_INDEX`]));
          for (const [mk, f, what] of PRICE) put(prc, `${k}_${L}_${mk}${m.suffix}`, `${c.text}, ${LOOKUPS[lk]}, ₹ per sq ft, ${what} (${m.label})`, d, num(row[f]));
          if (pm === 2) {
            put(prc, `${k}_${L}_records`, `${c.text}, ${LOOKUPS[lk]}, usable records behind the index`, d, num(row.REC_COUNT));
            for (const [mk, f, what] of MOE) if (f in row) put(prc, `${k}_${L}_${mk}`, `${c.text}, ${LOOKUPS[lk]}, margin of error, per cent, ${what}`, d, num(row[f]));
          }
        }
      }
    }
    const toBundle = (M) => {
      const live = [...M.entries()].filter(([, s]) => s.obs.size);
      const ds = [...new Set(live.flatMap(([, s]) => [...s.obs.keys()]))].sort();
      const dates = [];
      for (let [y, mo] = ds[0].split("-").map(Number); ; ) { const iso = `${y}-${String(mo).padStart(2, "0")}-01`; dates.push(iso); if (iso >= ds.at(-1)) break; mo += 3; if (mo > 12) { mo -= 12; y++; } }
      const series = {};
      for (const [key, s] of live) {
        const data = dates.map((d) => s.obs.get(d) ?? null);
        const f = data.findIndex((v) => v != null), l = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
        const gaps = dates.filter((d, i) => i > f && i < l && data[i] == null);
        series[key] = { name: key, label: s.label, data, ...(gaps.length ? { gaps, gapsNote: "NHB serves no value (or a zero placeholder) for these quarters." } : {}) };
      }
      return { dates, series };
    };
    const I = toBundle(idx), P = toBundle(prc);
    if (!I.series.india_hfc) throw new Error(`residex: no data returned: no all-India HFC index on ${B.label}`);
    const meta = (extra) => ({ dossier: "residex", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", frequency: "quarterly", base: B.base,
      releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });
    const nCity = new Set(Object.keys(I.series).map((k) => k.replace(/_(hfc|uc)(_q)?$/, "")).filter((k) => k !== "india")).size;
    writeSeries(root, `data/series/housing-residex-${B.tag}.json`, {
      meta: meta({ unit: "index", latestPeriod: I.dates.at(-1).slice(0, 7), coverage: `NHB RESIDEX house price indices, India and ${nCity} cities, ${B.label}`,
        note: `NHB RESIDEX (${B.ctl}). HFC = valuations at which banks and housing finance companies lent; UC = developers' prices for flats under construction${R.ucPublished ? "" : " (not published on this base)"}. Keys without suffix are four-quarter moving averages; _q is the quarter alone. Zeros served by NHB are treated as missing.` }),
      dates: I.dates, series: I.series,
    });
    writeSeries(root, `data/series/housing-residex-prices-${B.tag}.json`, {
      meta: meta({ unit: "inr_per_sqft", latestPeriod: P.dates.at(-1).slice(0, 7), coverage: `NHB RESIDEX house prices in ₹ per sq ft of carpet area, by city and home size, ${B.label} sample`,
        note: `NHB RESIDEX (${B.ctl}): weighted average carpet-area prices, ₹ per square foot, overall and by home size; usable record counts and published margins of error. The base names the sample and method the prices belong to.` }),
      dates: P.dates, series: P.series,
    });
    for (const [key, s] of [...Object.entries(I.series), ...Object.entries(P.series)])
      catalogue.push({ id: catalogueId(B.tag, key), label: `${s.label}, ${B.label}`, dims: { base: B.base, key } });
  }
  writeJson(root, "data/coverage/bis-residex.catalogue.json", {
    family: "bis-residex", source: "National Housing Bank, RESIDEX dashboards (residex.nhbonline.org.in)",
    generator: "scripts/lib/products/residex.mjs (runs with node scripts/fetch.mjs only residex)", generated_at: vintage,
    note: "Every series the three RESIDEX dashboards serve for India and each city in NHB's city list: index by lookup and method, prices by home size, records and margins of error.",
    items: catalogue.sort((a, b) => (a.id < b.id ? -1 : 1)),
  });
}
