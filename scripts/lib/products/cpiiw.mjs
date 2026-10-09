// scripts/lib/products/cpiiw.mjs: Consumer Price Index for Industrial Workers (CPI-IW),
// Labour Bureau, as served by RBI DBIE and mirrored in the local Data Bank
// (scripts/lib/databank.mjs; read-only, no network). The index that sets dearness allowance
// for central government staff and many industrial wage agreements.
//
// Reports read (DBIE report ids):
//   699   All India, General Index and the six groups (Food; Pan, supari, tobacco and
//         intoxicants; Fuel and light; Housing; Clothing, bedding and footwear;
//         Miscellaneous), monthly, every base the Bureau has used:
//           CPI-1960 (1960=100)   General Aug 1968 to Sep 1988; Food Apr 1970 to Mar 1984
//           CPI-1982 (1982=100)   General Oct 1988 to Dec 2005; groups from Jan 1995
//           CPI-2001 (2001=100)   Jan 2006 to Sep 2020 (General), Aug 2020 (groups)
//           CPI-2016 = 100        Sep 2020 onward
//         Two value columns: "Index Current Month" carries the published decimals,
//         "Index Current Month (Industrial Workers)" the same index rounded to a whole number
//         (they differ only by rounding: checked on every row). We bake the first.
//   1168  The centre-wise General Index (data provider DP0, which names the centres): 88
//         centres plus All India on base 2016, 78 on 2001, 77 on 1982.
//
// FOUR RULERS, NEVER JOINED (AGENTS.md rule 1). Each base is its own bundle; y/y is computed
// from levels inside each base, so the first year of every base has no y/y. The Bureau
// publishes linking factors between bases (used to carry dearness allowance across a
// rebase), but the DBIE reports do not carry them, so no linked line is drawn here.
//
// Source quirks (all disclosed in the bundles or the ledger):
//   - 699 carries 28 rows labelled "CPI-1986-87" (scattered months, 2016 to 2020, values
//     such as 1,340 for pan): that is the CPI-AL/RL base, not a CPI-IW one. A labelling
//     defect in the report; dropped and listed in the ledger as excluded.
//   - 1168 lists a handful of centre rows on the 2001 base before Jan 2006 (Kanpur and a few
//     others from 1991): before the base existed. Dropped; counted in meta.note.
//   - 1168's All India row for September 2023 repeats August's 139.2; report 699 has 137.5.
//     All India is baked from 699 only; the adapter tolerates this one stale month.
//   - DBIE dates months at their last day; baked at the month's first day.
//
//   - Early 1982-base Food rows (1983 to 1988) repeat one figure through each fiscal year:
//     annual values, not monthly indices; such years are dropped (dropAnnualRepeats).
//   - Single-month keying slips (Ranchi-Hatia, August 2012: 141 among 249 to 272) are set
//     aside by quarantine(), listed on the series, never corrected.
//
// Hand check (2026-10-09): All India General Index, August 2026, base 2016: 154.4 in report
// 699 (and 154.4 for ALL INDIA in report 1168). See docs/status/cpi.md for the press-release
// comparison.
import { databankRoot, dbieReport, dbieProvider } from "../databank.mjs";
import { writeSeries, writeRaw, readRaw, yoyFromLevels, monthAxis } from "../util.mjs";
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
import fs from "node:fs";
import path from "node:path";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const ym = (d) => d.slice(0, 7).replace("/", "-");               // "2026/08/31 00:00:00" -> "2026-08"
const num = (s) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return Number.isFinite(v) && v !== 0 ? v : null; };

// DBIE base label -> our base string, bundle suffix, and the base's own window
export const BASES = {
  "CPI-1960": { base: "1960=100", tag: "1960", from: "1968-08", to: "1988-09" },
  "CPI-1982": { base: "1982=100", tag: "1982", from: "1988-10", to: "2005-12" },
  "CPI-2001": { base: "2001=100", tag: "2001", from: "2006-01", to: "2020-09" },
  "CPI-2016 = 100": { base: "2016=100", tag: "2016", from: "2020-09", to: null },
};
export const GROUPS = {
  "GENERAL INDEX": { key: "general", label: "General index" },
  "FOOD GROUP": { key: "food", label: "Food" },
  "PAN. SUPARI, TOBACCO & INTOXICANTS": { key: "pan", label: "Pan, supari, tobacco and intoxicants" },
  "FUEL & LIGHT": { key: "fuel", label: "Fuel and light" },
  "HOUSING": { key: "housing", label: "Housing" },
  "CLOTHING, BEDDING & FOOTWEAR": { key: "clothing", label: "Clothing, bedding and footwear" },
  "MISCELLANEOUS GROUP": { key: "misc", label: "Miscellaneous" },
};
// A keying slip: a value far from both its nearest published neighbours (within three months
// either side) while those two neighbours agree with each other (within 30%). That shape is a
// typo (108.8, 5108.8, 108.8), not a price move: a genuine spike or a level step has
// neighbours that disagree, or none. Slips are set aside (null, listed per series), never
// corrected or filled. lo/hi bound the slip against the neighbours' mean.
export function quarantine(map, lo, hi) {
  const keys = [...map.keys()].sort();
  const mi = (k) => +k.slice(0, 4) * 12 + +k.slice(5, 7);
  const out = [];
  keys.forEach((k, i) => {
    const a = keys[i - 1], b = keys[i + 1];
    if (!a || !b || mi(k) - mi(a) > 3 || mi(b) - mi(k) > 3) return;
    const va = map.get(a), vb = map.get(b), v = map.get(k);
    if (Math.max(va, vb) / Math.min(va, vb) > 1.3) return;
    const m = (va + vb) / 2;
    if (v < lo * m || v > hi * m) out.push(k);
  });
  for (const k of out) map.delete(k);
  return out;
}
// a fiscal year (April to March) whose twelve months all carry one figure is an annual value
// repeated, not a monthly index (the 1982 base's early Food rows): those years are dropped
function dropAnnualRepeats(map) {
  const fy = (k) => (+k.slice(5) >= 4 ? +k.slice(0, 4) : +k.slice(0, 4) - 1);
  const by = new Map();
  for (const [k, v] of map) (by.get(fy(k)) ?? by.set(fy(k), []).get(fy(k))).push([k, v]);
  const dropped = [];
  for (const [y, kv] of by) if (kv.length === 12 && new Set(kv.map((x) => x[1])).size === 1) { for (const [k] of kv) map.delete(k); dropped.push(y); }
  return dropped.sort((a, b) => a - b);
}
const titleCase = (s) => String(s).toLowerCase().replace(/(^|[\s(/&-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

function read(root, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  return { r699: dbieReport(db, "699"), r1168: dbieProvider(db, "1168", "DP0") };
}

export async function buildCpiiw(root, dcfg, vintage, cfg) {
  const { r699, r1168 } = read(root, cfg);

  // ---------- the audit trail: every row read, as read ----------
  const rawRel = "data/raw/cpiiw-dbie.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "Rows are the report's cells joined by \";\" in header order. Labour Bureau CPI-IW from RBI DBIE, read from the local Data Bank mirror (rbi_dbie_webi_rows): report 699 (All India, General and groups, every base) and report 1168 data provider DP0 (centre-wise General Index). Provenance per report: DBIE report id, SAP data provider, Data Bank fetch time and content sha256.",
    reports: {
      699: { provenance: r699.provenance, header: r699.header, rows: r699.rows.map((r) => r699.header.map((h) => r[h]).join(";")) },
      1168: { provenance: r1168.provenance, header: r1168.header, rows: r1168.rows.map((r) => r1168.header.map((h) => r[h]).join(";")) },
    },
  });
  const V = readRaw(root, rawRel).vintage;

  // ---------- 699: All India, base x group -> Map(ym -> level) ----------
  const ai = {};   // tag -> gkey -> Map
  let mislabelled = 0, roundingOnly = true;
  for (const r of r699.rows) {
    const B = BASES[r["Dseries Description"]];
    if (!B) { mislabelled++; continue; }
    const G = GROUPS[r["Commodity Stats Desc"]];
    if (!G) throw new Error(`cpiiw: unknown group "${r["Commodity Stats Desc"]}" in report 699`);
    const v = num(r["Index Current Month"]);
    const w = num(r["Index Current Month (Industrial Workers)"]);
    if (v != null && w != null && Math.abs(Math.round(v) - w) > 0.5 && Math.abs(v - w) > 0.05) roundingOnly = false;
    if (v == null) continue;
    ((ai[B.tag] ??= {})[G.key] ??= new Map()).set(ym(r["Time Date"]), v);
  }
  if (!roundingOnly) throw new Error("cpiiw: report 699's two value columns differ by more than rounding; re-read the report before baking");
  // set aside annual-repeat years and keying slips, per series, and say so on the series
  const setAside = {};   // "tag|gkey" -> { annual: [fiscal years], slips: [months] }
  for (const [tag, groups] of Object.entries(ai)) for (const [g, map] of Object.entries(groups)) {
    const annual = dropAnnualRepeats(map), slips = quarantine(map, 0.75, 1.33);
    if (annual.length || slips.length) setAside[`${tag}|${g}`] = { annual, slips };
  }
  const latest16 = ai["2016"]?.general;
  if (!latest16?.size) throw new Error("cpiiw: no data returned: report 699 has no base-2016 General Index");
  const last = [...latest16.keys()].sort().at(-1);
  const lastV = latest16.get(last);
  if (!(lastV > 100 && lastV < 400)) throw new Error(`cpiiw: base-2016 General Index ${lastV} in ${last} outside 100 to 400`);

  const meta = (B, extra) => ({
    dossier: "cpiiw", frequency: "monthly", base: B.base,
    source: dcfg.source_agency, vintage: V, mock: false, geo: dcfg.geo ?? "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra,
  });
  // y/y within one base, on that base's own axis (first y/y month to the last level)
  const yoyBundle = (B, maps, order, labelOf, nameOf, extra) => {
    const yy = Object.fromEntries(order.filter((k) => maps[k]?.size).map((k) => [k, yoyFromLevels(maps[k])]));
    const all = Object.values(yy).flatMap((m) => [...m.keys()]).sort();
    if (!all.length) return null;
    const axis = monthAxis(all[0], all.at(-1));
    const dates = axis.map((m) => `${m}-01`);
    const series = {};
    Object.keys(yy).forEach((k, i) => {
      const data = axis.map((m) => yy[k].get(m) ?? null);
      const first = data.findIndex((v) => v != null);
      const lastI = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
      const gaps = dates.filter((d, j) => j > first && j < lastI && data[j] == null);
      series[k] = { name: nameOf(k), label: labelOf(k), color: k === "general" ? "#2E4BD8" : GREYS[i % GREYS.length], unit: "pct_yoy", data, ...(gaps.length ? { gaps, gapsNote: "The Bureau's series has no index for these months, or none a year earlier." } : {}) };
    });
    return { meta: meta(B, { latestPeriod: axis.at(-1), ...extra }), dates, series };
  };
  const ORDER = ["general", "food", "pan", "fuel", "housing", "clothing", "misc"];
  const groupLabel = Object.fromEntries(Object.values(GROUPS).map((g) => [g.key, g.label]));
  for (const B of Object.values(BASES)) {
    const maps = ai[B.tag] ?? {};
    const b = yoyBundle(B, maps, ORDER, (k) => `${groupLabel[k]}, base ${B.tag}`, (k) => `cpiiw_${k}_yoy_pct_base${B.tag}`, {
      coverage: `All India, CPI for industrial workers, General Index and groups, base ${B.base}`,
      note: `Labour Bureau CPI-IW on base ${B.base}, from RBI DBIE report 699. Year-on-year computed from published index levels inside this base only; never joined to another base.` +
        (B.tag === "1960" ? " The 1960 base carries the General Index and the Food group only." : "") +
        (B.tag === "1982" ? " Group indices begin in January 1995 in the report; the General Index in October 1988." : ""),
    });
    if (!b) throw new Error(`cpiiw: base ${B.tag} produced no y/y`);
    for (const [k, s] of Object.entries(b.series)) {
      const a = setAside[`${B.tag}|${k}`];
      if (!a) continue;
      s.setAsideNote = [a.annual.length ? `Fiscal years ${a.annual.map((y) => `${y}-${String(y + 1).slice(2)}`).join(", ")} carry one figure repeated in all twelve months in report 699 (an annual value, not a monthly index): left out.` : "",
        a.slips.length ? `Index levels for ${a.slips.join(", ")} sit far from their neighbouring months in report 699 (a keying slip): set aside, not corrected.` : ""].filter(Boolean).join(" ");
    }
    // the current base also carries the index level: the number dearness allowance is set from
    if (B.tag === "2016") {
      const ax = b.dates.map((d) => d.slice(0, 7));
      b.series.general_index = { name: "cpiiw_general_index_base2016", label: "General index, level, base 2016", color: "#878D99", unit: "index", data: ax.map((m) => maps.general.get(m) ?? null) };
    }
    writeSeries(root, `data/series/cpiiw-${B.tag}.json`, b);
  }

  // ---------- 1168: centres ----------
  const cen = {};   // tag -> code -> {label, state, map}
  let outside = 0, allIndiaMismatch = 0;
  for (const r of r1168.rows) {
    const B = BASES[r["Dseries Description"]];
    if (!B) continue;   // the stray "CPI-1986-87" All India rows (2), as in 699
    const m = ym(r["Time Date"]);
    if (m < B.from || (B.to && m > B.to)) { outside++; continue; }
    const v = num(r["Index Value"]);
    if (v == null) continue;
    const name = r["Centre Description"];
    if (/^all india$/i.test(name)) {
      const ref = ai[B.tag]?.general?.get(m);
      if (ref != null && Math.abs(ref - v) > 0.5) allIndiaMismatch++;
      continue;   // All India lives in cpiiw-<base>.json
    }
    const code = r["Centre Code"];
    (((cen[B.tag] ??= {})[code]) ??= { label: titleCase(name), state: titleCase(r["Centre State Details"]), map: new Map() }).map.set(m, v);
  }
  // report 1168's All India row repeats August's 139.2 for September 2023, where report 699
  // and the Bureau's press release give 137.5 (checked 2026-10-09; the centres' September
  // rows are their own). The All India row is not baked from 1168, so one stale month is
  // disclosed, not fatal; more than that means the reports have drifted apart.
  const centreSlips = {};
  for (const [tag, cs] of Object.entries(cen)) for (const [code, c] of Object.entries(cs)) { const sl = quarantine(c.map, 0.75, 1.33); if (sl.length) centreSlips[`${tag}|${code}`] = sl; }
  if (allIndiaMismatch > 1) throw new Error(`cpiiw: report 1168's All India row differs from report 699 in ${allIndiaMismatch} months`);
  for (const B of Object.values(BASES)) {
    const centres = cen[B.tag];
    if (!centres) continue;
    const codes = Object.keys(centres).sort((a, b) => centres[a].label.localeCompare(centres[b].label));
    const maps = Object.fromEntries(codes.map((c) => [`c${c}`, centres[c].map]));
    const b = yoyBundle(B, maps, codes.map((c) => `c${c}`), (k) => `${centres[k.slice(1)].label} (${centres[k.slice(1)].state})`, (k) => `cpiiw_centre_${k.slice(1)}_yoy_pct_base${B.tag}`, {
      coverage: `${codes.length} centres, CPI for industrial workers, General Index, base ${B.base}`,
      note: `Labour Bureau centre-wise CPI-IW on base ${B.base}, from RBI DBIE report 1168 (data provider DP0). Year-on-year from published levels inside this base. Centres are industrial towns, not states: a state can hold several.` +
        (outside && B.tag === "2001" ? ` Rows dated before the base began (January 2006) are dropped: ${outside} in all across the report.` : ""),
    });
    if (!b) continue;
    for (const [k, s] of Object.entries(b.series)) {
      s.state = centres[k.slice(1)].state; s.group = centres[k.slice(1)].state;
      const sl = centreSlips[`${B.tag}|${k.slice(1)}`];
      if (sl) s.setAsideNote = `Index levels for ${sl.join(", ")} sit far from their neighbouring months in report 1168 (a keying slip, such as Ranchi-Hatia's 141 in August 2012 among readings of 249 to 272): set aside, not corrected.`;
    }
    writeSeries(root, `data/series/cpiiw-centres-${B.tag}.json`, b);
  }
  console.log(`cpiiw: bases ${Object.keys(ai).join(", ")}; centres ${Object.entries(cen).map(([t, c]) => `${t}:${Object.keys(c).length}`).join(", ")}; ${mislabelled} mislabelled 1986-87 rows dropped; ${outside} centre rows outside their base window dropped; latest ${last} = ${lastV}`);
}

/* Catalogue (docs/CONTRACT-coverage.md): every (base, group) the Bureau publishes for All
 * India in report 699, and every (base, centre) in report 1168, read from the reports
 * themselves (the DBIE report is the listing).
 *   cpiiw:<base>:all-india:<group>
 *   cpiiw:<base>:centre:<code>-<name>                 */
export async function catalogueCpiiw() {
  const { cfg } = sourceCfg("cpiiw");
  const { r699, r1168 } = read(null, cfg);
  const items = [];
  for (const r of r699.rows) {
    const tag = BASES[r["Dseries Description"]]?.tag ?? idPart(r["Dseries Description"].replace(/^CPI-/, ""));
    items.push({ id: `cpiiw:${tag}:all-india:${idPart(r["Commodity Stats Desc"])}`, label: `CPI-IW ${r["Dseries Description"]}, ${r["Commodity Stats Desc"]}` });
  }
  for (const r of r1168.rows) {
    const tag = BASES[r["Dseries Description"]]?.tag ?? idPart(r["Dseries Description"].replace(/^CPI-/, ""));
    if (/^all india$/i.test(r["Centre Description"])) { items.push({ id: `cpiiw:${tag}:centre:all-india`, label: `CPI-IW ${r["Dseries Description"]}, All India (centre table)` }); continue; }
    items.push({ id: `cpiiw:${tag}:centre:${r["Centre Code"]}-${idPart(r["Centre Description"])}`, label: `CPI-IW ${r["Dseries Description"]}, ${r["Centre Description"]}` });
  }
  writeCatalogue("cpiiw", {
    source: "Labour Bureau: CPI for Industrial Workers (RBI DBIE reports 699 and 1168, via the Data Bank)",
    generator: "scripts/lib/products/cpiiw.mjs --catalogue",
    note: "Read from the reports' own rows. Ids: cpiiw:<base>:all-india:<group> (report 699) and cpiiw:<base>:centre:<code>-<name> (report 1168, data provider DP0).",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueCpiiw);
