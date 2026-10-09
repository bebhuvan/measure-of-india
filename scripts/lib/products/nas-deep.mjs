// scripts/lib/products/nas-deep.mjs — the national accounts, every row the API serves.
//
// nas.mjs builds the headline bundles from pinned queries. This module takes the rest:
// for every base x series x frequency x indicator that the coverage catalogue
// (data/coverage/gdp.catalogue.json, generated from the API's own listing) names, it
// pulls getNASData UNFILTERED and keeps every row. One unfiltered query returns every
// cut of an indicator at once: industry, sub-industry, institutional sector and, on
// annual rows, every revision stage (checked 2026-10-09: ic1 annual base 2011-12 is
// 1,546 rows = years x stages x cuts; ic1 quarterly is 522 = 58 quarters x 9 industry rows).
//
// Source quirks found here (2026-10-09):
//  - The filter lists an `approach` cut (Expenditure, Production, Income) for GDP, GVA,
//    NDP, GNI, GNDI and the growth rates, but getNASData ignores approach_code: the
//    same 66 GDP rows come back for every code. There is no approach-wise row to read.
//    The discrepancy between the production and expenditure sides is computed instead,
//    from published levels (GDP less the sum of its expenditure components).
//  - Annual rows carry no quarter; quarterly rows carry no revision (the latest only).
//  - Revision labels: First Advance, Second Advance, Provisional, First/Second/Third
//    Revised, Final, Additional Revision. "Additional Revision" appears only for
//    2011-12 to 2013-14 on base 2011-12: the restatement made after the base launched.
//  - Base 2022-23 carries only three stages so far (Provisional, First Revised, Final).
//
// Raw dumps: data/raw/nas-deep-<base>-<series>-<freq>.json, one per combination, rows
// grouped by indicator code, written by writeRaw (a revision archives the old vintage).
// Hand check (2026-10-09): GDP 2024-25, base 2022-23, First Revised Estimates, constant
// prices: see the header of buildNasDeep in nas-deep-build.mjs.

import fs from "node:fs";
import path from "node:path";
import { mospiAll } from "../mospi.mjs";
import { writeRaw } from "../util.mjs";

const HEAD = /^nas:([^:]+):([^:]+):(annual|quarterly):(\d+)-[^:]+$/;
const KEEP_OUT = new Set(["base_year", "series", "indicator", "frequency"]);

// every (base, series, freq, indicator) the catalogue lists as a total
export function deepCombos(root) {
  const cat = JSON.parse(fs.readFileSync(path.join(root, "data/coverage/gdp.catalogue.json"), "utf8"));
  const out = new Map();
  for (const it of cat.items) {
    const m = it.id.match(HEAD);
    if (!m) continue;
    const [, base, series, freq, code] = m;
    const k = `${base}|${series}|${freq}`;
    if (!out.has(k)) out.set(k, { base, series, freq, indicators: [] });
    out.get(k).indicators.push({ code: Number(code), label: it.label });
  }
  for (const c of out.values()) c.indicators.sort((a, b) => a.code - b.code);
  return [...out.values()];
}

export const rawName = (c) => `data/raw/nas-deep-${c.base.slice(0, 4)}-${c.series}-${c.freq}.json`.toLowerCase();

export async function fetchNasDeep(root, dcfg, vintage) {
  const written = [];
  for (const c of deepCombos(root)) {
    const dump = { vintage, base_year: c.base, series: c.series === "back" ? "Back" : "Current", frequency: c.freq, unit: "₹ crore (growth-rate indicators 21 and 22: per cent)", indicators: {} };
    for (const ind of c.indicators) {
      const rows = await mospiAll(dcfg.fetch.endpoint, {
        base_year: c.base, series: dump.series, account_code: 1,
        frequency_code: c.freq === "quarterly" ? 2 : 1, indicator_code: ind.code,
      });
      const keep = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => !KEEP_OUT.has(k) && v != null && v !== "")));
      dump.indicators[ind.code] = { label: ind.label, rows: keep };
      process.stdout.write(`nas-deep ${c.base} ${dump.series} ${c.freq} ic${ind.code}: ${rows.length} rows\n`);
    }
    writeRaw(root, rawName(c), dump);
    written.push(rawName(c));
  }
  return written;
}
