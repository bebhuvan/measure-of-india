// scripts/lib/products/wagesrural.mjs: daily wage rates in rural India, by occupation and
// state, Labour Bureau, as served by RBI DBIE (report 664) and mirrored in the local Data Bank
// (scripts/lib/databank.mjs; read-only, no network). What a day's work pays a ploughman, a
// mason or a general farm labourer: the other half of what prices mean for a wage earner.
//
// TWO OCCUPATION SCHEMES, NEVER JOINED (AGENTS.md rule 1). The Bureau revised its list in
// November 2013:
//   old scheme, codes 10 to 180 (18 occupations: ploughing, sowing, ... unskilled labourers),
//     April 1998 to October 2013;
//   new scheme, codes 1110 to 1350 (25 occupations: 12 agricultural, 13 non-agricultural),
//     November 2013 onward.
// A "carpenter" exists in both, but the occupations were redefined and the centres resampled,
// so each scheme is its own pair of bundles (All India and states).
//
// Source quirks:
//   - From April 2023 DBIE dates each month on its 23rd ("2023/04/23"); earlier months on the
//     last day. Both are baked at the month's first day.
//   - 43 rows repeat in report 664 (Odisha, March 2009) with the same value: deduplicated.
//   - The state is named "ORISSA" in some rows and "ODISHA" in others; one state, baked as
//     Odisha (the catalogue keeps both spellings, as the report prints them).
//   - Two single-month keying slips (Assam sowing Nov 1998: 4.08; Bihar winnowing Jun 2001:
//     4.46, both among values near 43) are set aside by quarantine() and named in the gap note.
//   - Values are rupees per day, two decimals. A state does not report every occupation every
//     month; the Bureau publishes no figure then (null here, interior gaps declared).
//
// Men's wages: RBI's Handbook of Statistics on Indian States reproduces this series as
// "Average daily wage rates in rural India (men)", tables 112 to 115.
//
// Hand check (2026-10-10): the 2024-25 average of the monthly general agricultural labourer
// wage (code 1210) is Rs 868.7 for Kerala, 454.3 Karnataka, 384.8 Assam, 362.8 Bihar and
// 280.8 Gujarat; RBI Handbook 2024-25, table 113 (men, general agricultural labourers),
// prints the same five figures.
import { databankRoot, dbieReport } from "../databank.mjs";
import { writeSeries, writeRaw, readRaw, monthAxis } from "../util.mjs";
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
import fs from "node:fs";
import path from "node:path";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const ym = (d) => d.slice(0, 7).replace("/", "-");
import { quarantine } from "./cpiiw.mjs";
const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const scheme = (code) => (Number(code) >= 1000 ? "2013" : "1998");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
// tidy the Bureau's labels for display (the raw label is kept in `source_label`)
const OCC_FIX = { "Blacksmit": "Blacksmith", "Unskilled Labourers": "Unskilled labourers" };

export async function buildWagesRural(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const R = dbieReport(db, "664");
  const rawRel = "data/raw/wages-rural-dbie.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "Rows are the report's cells joined by \";\" in header order. Labour Bureau rural wage rates by occupation and state from RBI DBIE report 664, read from the local Data Bank mirror (rbi_dbie_webi_rows). Rupees per day.",
    reports: { 664: { provenance: R.provenance, header: R.header, rows: R.rows.map((r) => R.header.map((h) => r[h]).join(";")) } },
  });
  const V = readRaw(root, rawRel).vintage;

  // scheme -> state -> occ code -> Map(ym -> rupees)
  const W = { 1998: {}, 2013: {} };
  const occName = {}, stName = {};
  let conflicts = 0;
  for (const r of R.rows) {
    const v = parseFloat(r["Wages In Rupees"]);
    if (!Number.isFinite(v) || v <= 0) continue;
    const s = scheme(r["Occ Code"]);
    // keyed by the state's code: DBIE renamed Orissa to Odisha under the same code 16
    const st = r["State Code"] === "ALL_IND" ? "all_india" : slug(titleCase(r["State Name"]).replace(/^Orissa$/, "Odisha"));
    stName[st] = r["State Code"] === "ALL_IND" ? "All India" : titleCase(r["State Name"]).replace(/^Orissa$/, "Odisha");
    occName[r["Occ Code"]] = r["Occ Description"].trim();
    const map = (((W[s][st] ??= {})[r["Occ Code"]]) ??= new Map());
    const m = ym(r["Time Date"]);
    if (map.has(m) && map.get(m) !== v) conflicts++;
    map.set(m, v);
  }
  // keying slips (Assam, sowing, November 1998: 4.08 between 43.67 and 42.18): set aside
  const slips = {};
  for (const s of Object.keys(W)) for (const [st, occs] of Object.entries(W[s])) for (const [code, map] of Object.entries(occs)) { const sl = quarantine(map, 0.4, 2.5); if (sl.length) slips[`${s}|${st}|${code}`] = sl; }
  if (conflicts) throw new Error(`wages-rural: ${conflicts} repeated rows in report 664 carry different values`);
  const gal = W[2013].all_india?.["1210"];
  if (!gal?.size) throw new Error("wages-rural: no data returned: no All India general agricultural labourer wage (code 1210)");
  const galLast = [...gal.keys()].sort().at(-1);
  if (!(gal.get(galLast) > 100 && gal.get(galLast) < 2000)) throw new Error(`wages-rural: general agricultural wage ${gal.get(galLast)} in ${galLast} outside 100 to 2,000 rupees`);

  const label = (code) => OCC_FIX[occName[code]] ?? occName[code].replace(/\s+\(/g, " (").replace(/\s+/g, " ");
  const bundle = (s, states, coverage) => {
    const all = [];
    for (const st of states) for (const map of Object.values(W[s][st] ?? {})) all.push(...map.keys());
    all.sort();
    const axis = monthAxis(all[0], all.at(-1));
    const dates = axis.map((m) => `${m}-01`);
    const series = {};
    let i = 0;
    for (const st of states) {
      const occs = Object.keys(W[s][st] ?? {}).sort((a, b) => a - b);
      for (const code of occs) {
        const map = W[s][st][code];
        const data = axis.map((m) => map.get(m) ?? null);
        const first = data.findIndex((v) => v != null);
        const lastI = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
        const gaps = dates.filter((d, j) => j > first && j < lastI && data[j] == null);
        const key = states.length > 1 ? `${st}_${code}` : `o${code}`;
        series[key] = {
          name: `wage_rural_${st}_${code}_inr`, unit: "inr",
          label: states.length > 1 ? `${stName[st]}: ${label(code)}` : label(code),
          source_label: occName[code], occupation_code: Number(code), state: stName[st],
          group: states.length > 1 ? stName[st] : (Number(code) >= 1230 || (Number(code) >= 120 && Number(code) < 1000) ? "Non-agricultural" : "Agricultural"),
          color: GREYS[i++ % GREYS.length], data,
          ...(gaps.length ? { gaps, gapsNote: "The Bureau published no wage for this occupation in this state in these months" + (slips[`${s}|${st}|${code}`] ? `, or (${slips[`${s}|${st}|${code}`].join(", ")}) printed one about a tenth of its neighbours, a keying slip set aside rather than corrected` : "") + "." } : {}),
        };
      }
    }
    return {
      meta: {
        dossier: "wages-rural", frequency: "monthly", base: s === "1998" ? "occupations 1998 (18)" : "occupations 2013 (25)",
        unit: "inr", source: dcfg.source_agency, vintage: V, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: axis.at(-1), releaseDate: null, revisionPolicy: dcfg.revision_policy, coverage,
        note: `Average daily wage rate for men, rupees per day, from the Labour Bureau's Wage Rates in Rural India (RBI DBIE report 664). ${s === "1998" ? "Old occupation scheme (18 occupations), April 1998 to October 2013." : "New occupation scheme (25 occupations), from November 2013."} Never joined to the other scheme.`,
      },
      dates, series,
    };
  };
  for (const s of ["1998", "2013"]) {
    const states = Object.keys(W[s]).filter((st) => st !== "all_india").sort();
    writeSeries(root, `data/series/wages-rural-${s}.json`, bundle(s, ["all_india"], `All India, ${s === "1998" ? 18 : 25} rural occupations, daily wage in rupees`));
    writeSeries(root, `data/series/wages-rural-states-${s}.json`, bundle(s, states, `${states.length} states x occupation, daily wage in rupees`));
  }
  console.log(`wages-rural: general agricultural labourer, All India, ${galLast}: Rs ${gal.get(galLast)}`);
}

/* Catalogue: every (scheme, state, occupation) report 664 carries, read from its rows.
 *   wages-rural:<1998|2013>:<state>:<code>-<occupation> */
export async function catalogueWagesRural() {
  const { cfg } = sourceCfg("wages-rural");
  const R = dbieReport(databankRoot(cfg?.families?.databank), "664");
  const items = R.rows.map((r) => ({
    id: `wages-rural:${scheme(r["Occ Code"])}:${r["State Code"] === "ALL_IND" ? "all-india" : idPart(r["State Name"])}:${r["Occ Code"]}-${idPart(r["Occ Description"]).slice(0, 40)}`,
    ...(r["State Code"] === "ALL_IND" ? { label: `Rural daily wage, ${r["Occ Description"].trim()}` } : {}),
  }));
  writeCatalogue("wages-rural", {
    source: "Labour Bureau: Wage Rates in Rural India (RBI DBIE report 664, via the Data Bank)",
    generator: "scripts/lib/products/wagesrural.mjs --catalogue",
    note: "Read from the report's own rows. Ids: wages-rural:<scheme>:<state>:<code>-<occupation>; scheme 1998 = the 18 occupations to Oct 2013, 2013 = the 25 from Nov 2013.",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueWagesRural);
