// scripts/lib/products/dbie-trade.mjs: the long view of India's merchandise trade, from the
// RBI's Database on Indian Economy (DBIE), read from the local Data Bank mirror (read-only).
// The RBI republishes DGCI&S customs totals; for commodity and partner detail the source of
// record is TradeStat (scripts/lib/products/tradestat.mjs). These bundles are the long
// rulers TradeStat cannot give (monthly since April 1990, annual since 1970-71, oil and
// non-oil, unit-value and volume indices, crude oil volumes), shown as their own rulers and
// never joined to TradeStat's series.
//
// Reports read (DBIE report id : data provider). Values are stored in actual units in every
// row; each value is repeated once per display unit (ACTUALS, THOUSANDS, LAKHS, ...): we keep
// the ACTUALS rows and convert ourselves. Where a date carries several versions we keep the
// most final one (Final 5 > Revised 4 > Provisional 2 > unlabelled -1) and record it.
//   433:DP0  India's foreign trade, US$, monthly from April 1990 (exports, imports, balance)
//   648:DP0  the same in rupees
//   426:DP0  oil and non-oil exports and imports, US$, monthly from April 1997
//   425:DP0  the same in rupees
//   649:DP0  annual, US$, 1970-71 onward, total, oil and non-oil
//   432:DP0  the same in rupees
//   379:DP0  unit value, quantum and terms-of-trade indices, three bases (1978-79, 1999-2000,
//            2012-13), each its own bundle
//   601:DP0, 552:DP0  export and import unit value and quantum indices by commodity, base 2012-13
//   601:DP3, 552:DP3  the same on base 1999-2000 (1999-2000 to 2018-19)
//   148:DP1  production and imports of crude oil and petroleum products, tonnes
//   676:DP1  direction of trade: exports and imports by partner and group, US$, 2009-10 onward
//   439:DP1, 431:DP1  exports and imports by major commodity group, US$, 2009-10 onward
//   439:DP0, 431:DP0  the same in the older grouping, 1987-88 to 2013-14 (a separate ruler)
//   429:DP1  exports of select commodities to principal countries, US$, 2013-14 onward
//   429:DP0  the same, older grouping, 1990-91 to 2013-14
//
// HAND CHECKS (2026-10-09), against the Department of Commerce's PIB release of 13 August 2026
// and its DGCI&S quick-estimates tables (commerce.gov.in "PIB Release - July 2026"):
//   trade-dbie-monthly  July 2026 exports 44,243.45 / imports 76,223.24 (US$ million, provisional)
//                       = release Table 1: 44.24 / 76.22 US$ billion.
//   trade-dbie-commodities  rice exports 2025-26 11,537.36 = QE table 1 row 9: 11,537.
//   trade-dbie-annual   oil exports 2025-26 53,828.12 = QE "Petroleum Products" 2025-26: 53,828.
//                       (Its total exports 2025-26, 441,730.12, is an earlier print than the
//                       release's 441,452; the RBI annual table lags the latest revision.)

import fs from "node:fs";
import path from "node:path";
import { databankRoot, databankQuery } from "../databank.mjs";
import { dbieProvider, dbieProviders } from "../databank.mjs";
import { writeRaw, writeSeries, readRaw, nullCopiedRuns } from "../util.mjs";

const VERSION_RANK = { Final: 5, Revised: 4, Provisional: 2, Forecast: 1 };
const fyStart = (fy) => `${fy.slice(0, 4)}-04-01`;                       // "2011-12" -> "2011-04-01"
const day1 = (s) => `${s.slice(0, 4)}-${s.slice(5, 7)}-01`;               // "2011/10/01 00:00:00" -> "2011-10-01"
const num = (s) => { const v = parseFloat(String(s ?? "").replace(/,/g, "")); return Number.isFinite(v) ? v : null; };
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const slug = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48);

/** Most-final value per key. rows -> Map(key -> { v, ver, verLabel }). */
function pickFinal(rows, key, val, ver) {
  const out = new Map();
  for (const r of rows) {
    const k = key(r); if (k == null) continue;
    const v = val(r); if (v == null) continue;
    const [rank, label] = ver(r);
    const prev = out.get(k);
    if (!prev || rank > prev.rank) out.set(k, { v, rank, ver: label });
  }
  return out;
}
// the display-unit column is named differently per report ("Unit Description",
// "Derived Unit Desc.Unit Description", ...); rows whose every unit column says ACTUALS are kept
// the commodity code of a unit-value/quantum row: the flow's own code column, else the generic ones
const uviCode = (r, flow) => r[flow === "exports" ? "Export Commodity Code" : "Import Commodity Code"] || r["Commodity Code"] || r["Dim Commodity Dgcis.Commodity Code"];
const actuals = (rows) => {
  const cols = Object.keys(rows[0] ?? {}).filter((h) => /Unit Description$/.test(h));
  return cols.length ? rows.filter((r) => cols.every((c) => r[c] === "ACTUALS")) : rows;
};

export async function buildDbieTrade(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const SPEC = [["433", "DP0"], ["648", "DP0"], ["426", "DP0"], ["425", "DP0"], ["649", "DP0"], ["432", "DP0"], ["379", "DP0"],
    ["601", "DP0"], ["552", "DP0"], ["601", "DP3"], ["552", "DP3"], ["148", "DP1"], ["676", "DP1"], ["439", "DP1"], ["431", "DP1"],
    ["439", "DP0"], ["431", "DP0"], ["429", "DP1"], ["429", "DP0"], ["676", "DP0"]];
  const R = {};
  // provenance as trade has always archived it: databank.mjs's, plus the provider's name
  for (const [id, dp] of SPEC) {
    const r = dbieProvider(db, id, dp);
    const name = dbieProviders(db, id).find((p) => p.id === dp)?.name;
    const { report_id, data_provider, ...rest } = r.provenance;
    R[`${id}:${dp}`] = { ...r, provenance: { report_id, data_provider, provider_name: name, ...rest } };
  }

  // ---------- the audit trail: ACTUALS rows only (every other unit row repeats the same value) ----------
  const rawRel = "data/raw/trade-dbie.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "RBI DBIE merchandise-trade tables, read from the local Data Bank mirror (rbi_dbie_webi_rows). Each report repeats every value once per display unit; only the ACTUALS rows are archived (or every row, where a report carries no unit column). Provenance per report and data provider: DBIE report id, provider, Data Bank fetch time and content sha256.",
    reports: Object.fromEntries(Object.entries(R).map(([k, r]) => {
      return [k, { provenance: r.provenance, header: r.header, rows: actuals(r.rows) }];
    })),
  });
  const V = readRaw(root, rawRel).vintage;

  const meta = (extra) => ({ dossier: "trade-dbie", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", releaseDate: null,
    revisionPolicy: dcfg.revision_policy, ...extra });
  const write = (rel, dates0, series0, extra) => {
    // a continuous axis: a period the table skips becomes an interior null, disclosed below
    const step = { monthly: 1, annual: 12 }[extra.frequency];
    let dates = dates0, series = series0;
    if (step && dates0.length > 1) {
      const full = [];
      for (let d = dates0[0]; d <= dates0.at(-1);) { full.push(d); let [y, m] = d.split("-").map(Number); m += step; while (m > 12) { m -= 12; y++; } d = `${y}-${String(m).padStart(2, "0")}-01`; }
      if (full.length !== dates0.length) {
        const at = new Map(dates0.map((d, i) => [d, i]));
        for (const s of Object.values(series)) s.data = full.map((d) => (at.has(d) ? s.data[at.get(d)] : null));
        dates = full;
      }
    }
    // a line the source prints with no value in any period carries nothing: not baked (the
    // catalogue skips blank lines the same way)
    const empty = Object.keys(series).filter((k) => series[k].data.every((v) => v == null));
    for (const k of empty) delete series[k];
    if (empty.length) console.log(`  ${rel}: ${empty.length} lines blank in every period, not baked`);
    // the axis runs from the first to the last date any series reports (no empty lead or tail)
    const has = (i) => Object.values(series).some((s) => s.data[i] != null);
    let a = 0, b = dates.length - 1;
    while (a < b && !has(a)) a++;
    while (b > a && !has(b)) b--;
    for (const s of Object.values(series)) {
      s.data = s.data.slice(a, b + 1);
      const first = s.data.findIndex((v) => v != null), last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      const gaps = dates.slice(a, b + 1).filter((d, i) => i > first && i < last && s.data[i] == null);
      if (gaps.length) { s.gaps = gaps; s.gapsNote ??= "Not published for these periods in the RBI table."; }
    }
    const D = dates.slice(a, b + 1);
    writeSeries(root, `data/series/${rel}.json`, { meta: meta({ latestPeriod: D.at(-1).slice(0, 7), ...extra }), dates: D, series });
  };
  const axis = (keys) => [...new Set(keys)].sort();

  /* ---------- monthly headline: 433 + 426 (US$), 648 + 425 (₹) ---------- */
  const monthly = (totId, oilId, valCol, div, unitLabel, rel, unit, coverage, note) => {
    const T = pickFinal(actuals(R[totId].rows), (r) => `${day1(r["Time Date"])}|${r["Export/Import"]}`, (r) => num(r[valCol]),
      (r) => [VERSION_RANK[r["Version Desc"]] ?? 0, r["Version Desc"]]);
    const oilVal = Object.keys(R[oilId].rows[0]).find((h) => /^Aggregate Value/.test(h));
    const O = pickFinal(actuals(R[oilId].rows), (r) => `${day1(r["Time Date"])}|${r["Hbs Item Hierarchy Level1"]}|${r["Hbs Item Hierarchy Level2"]}`,
      (r) => num(r[oilVal]), (r) => [VERSION_RANK[r["Version Desc"]] ?? 0, r["Version Desc"]]);
    const dates = axis([...T.keys(), ...O.keys()].map((k) => k.split("|")[0]));
    const get = (m, k) => { const x = m.get(k); return x ? r2(x.v / div) : null; };
    const S = {
      exports: { label: `Exports, ${unitLabel}`, color: "#2E4BD8", data: dates.map((d) => get(T, `${d}|Exports`)) },
      imports: { label: `Imports, ${unitLabel}`, color: "#C47A16", data: dates.map((d) => get(T, `${d}|Imports`)) },
      balance: { label: `Trade balance (exports minus imports), ${unitLabel}`, color: "#5F6675", data: dates.map((d) => get(T, `${d}|Trade Balance`)) },
      exports_oil: { label: `Oil exports (petroleum products), ${unitLabel}`, color: "#5F6675", data: dates.map((d) => get(O, `${d}|Exports|Oil`)) },
      exports_non_oil: { label: `Non-oil exports, ${unitLabel}`, color: "#A3A9B4", data: dates.map((d) => get(O, `${d}|Exports|Non-Oil`)) },
      imports_oil: { label: `Oil imports (crude and petroleum products), ${unitLabel}`, color: "#5F6675", data: dates.map((d) => get(O, `${d}|Imports|Oil`)) },
      imports_non_oil: { label: `Non-oil imports, ${unitLabel}`, color: "#A3A9B4", data: dates.map((d) => get(O, `${d}|Imports|Non-Oil`)) },
    };
    // oil and non-oil balances: exports minus imports of the lines above (derived; the RBI
    // Bulletin's report 18 prints the same balances)
    for (const o of ["oil", "non_oil"]) S[`balance_${o}`] = { label: `Trade balance, ${o === "oil" ? "oil" : "non-oil"} (exports minus imports, derived), ${unitLabel}`, color: "#5F6675",
      data: S[`exports_${o}`].data.map((e, i) => (e == null || S[`imports_${o}`].data[i] == null ? null : r2(e - S[`imports_${o}`].data[i]))) };
    for (const s of Object.values(S)) s.name = s.label;
    const revision = Object.fromEntries(dates.map((d) => [d, T.get(`${d}|Exports`)?.ver ?? null]));
    write(rel, dates, S, { frequency: "monthly", base: "as published", unit, coverage, note, revision });
  };
  monthly("433:DP0", "426:DP0", "Aggregate Value Monthly", 1e6, "US$ million", "trade-dbie-monthly", "usd_million",
    "India's merchandise exports, imports and trade balance each month since April 1990, with oil and non-oil since April 1997, US$ million",
    "RBI DBIE report 433 (totals) and 426 (oil and non-oil), DGCI&S data as republished by the RBI. In February and March 2017 the oil and non-oil exports sum about 1.3% above the total (the split is an earlier print); shown as published. The latest months are provisional (quick estimates); meta.revision names the version of each month. Oil exports are petroleum products; oil imports are crude oil and petroleum products.");
  monthly("648:DP0", "425:DP0", "Aggregate value Monthly", 1e7, "₹ crore", "trade-dbie-monthly-inr", "inr_crore",
    "India's merchandise exports, imports and trade balance each month since April 1990, with oil and non-oil since April 1997, ₹ crore",
    "RBI DBIE report 648 (totals) and 425 (oil and non-oil), DGCI&S data as republished by the RBI, in rupees. In February and March 2017 the oil split is an earlier print than the total and does not add to it, and the June 2001 balance is printed as -1,970 crore against exports minus imports of -1,904; both shown as published. meta.revision names the version of each month.");

  /* ---------- annual since 1970-71: 649 (US$), 432 (₹) ---------- */
  const annual = (id, div, unitLabel, rel, unit, coverage) => {
    // "Month" carries the version code here: 5 final, 2 provisional, -1 unlabelled (equal to final where both exist)
    const A = pickFinal(actuals(R[id].rows), (r) => `${fyStart(r["Fiscal Year"])}|${r["Export/Import"]}|${r["Oil/Non-oil"]}`,
      (r) => num(r["Aggregate Value"]), (r) => [{ 5: 5, 2: 2, "-1": 1 }[r.Month] ?? 0, { 5: "Final", 2: "Provisional", "-1": "Final" }[r.Month] ?? r.Month]);
    const dates = axis([...A.keys()].map((k) => k.split("|")[0]));
    const S = {};
    for (const [flow, fl] of [["Exports", "exports"], ["Imports", "imports"], ["Trade Balance", "balance"]]) for (const [o, ol] of [["Total", ""], ["Oil", "_oil"], ["Non-Oil", "_non_oil"]]) {
      const label = `${{ exports: "Exports", imports: "Imports", balance: "Trade balance" }[fl]}${{ "": "", _oil: ", oil", _non_oil: ", non-oil" }[ol]}, ${unitLabel}`;
      S[fl + ol] = { name: label, label, color: fl === "exports" ? "#2E4BD8" : fl === "imports" ? "#C47A16" : "#5F6675",
        data: dates.map((d) => { const x = A.get(`${d}|${flow}|${o}`); return x ? r2(x.v / div) : null; }) };
    }
    const revision = Object.fromEntries(dates.map((d) => [d, A.get(`${d}|Exports|Total`)?.ver ?? null]));
    write(rel, dates, S, { frequency: "annual", base: "as published", unit, coverage, revision,
      note: `RBI DBIE report ${id}, DGCI&S data as republished by the RBI. Financial years (April to March), dated at April. Oil and non-oil split as published.` });
  };
  annual("649:DP0", 1e6, "US$ million", "trade-dbie-annual", "usd_million", "India's merchandise trade every financial year since 1970-71, total, oil and non-oil, US$ million");
  annual("432:DP0", 1e7, "₹ crore", "trade-dbie-annual-inr", "inr_crore", "India's merchandise trade every financial year since 1970-71, total, oil and non-oil, ₹ crore");

  /* ---------- terms of trade, one bundle per base: 379 ---------- */
  {
    const rows = R["379:DP0"].rows;
    const BASES = [["1978-1979", "1978-79=100", "trade-dbie-tot-1978"], ["1999-2000", "1999-2000=100", "trade-dbie-tot-1999"], ["2012-2013", "2012-13=100", "trade-dbie-tot-2012"]];
    const ITEMS = [["Unit value index Exports", "uvi_exports", "Unit value index, exports", "#2E4BD8"], ["Unit value index Imports", "uvi_imports", "Unit value index, imports", "#C47A16"],
      ["Quantum index Exports", "qi_exports", "Quantum (volume) index, exports", "#2E4BD8"], ["Quantum index Imports", "qi_imports", "Quantum (volume) index, imports", "#C47A16"],
      ["Terms of trade Net", "tot_net", "Net terms of trade (export unit value over import unit value, x100)", "#5F6675"],
      ["Terms of trade Gross", "tot_gross", "Gross terms of trade (import volume over export volume, x100)", "#A3A9B4"],
      ["Terms of trade Income", "tot_income", "Income terms of trade (net terms of trade x export volume, /100)", "#A3A9B4"]];
    for (const [tag, base, rel] of BASES) {
      const mine = rows.filter((r) => r["Data Series"].includes(tag) && r["Imp Exp Commodity Description"] === "General index");
      const dates = axis(mine.map((r) => fyStart(r["Fiscal Year"])));
      const S = {};
      for (const [desc, k, label, color] of ITEMS) {
        const m = new Map(mine.filter((r) => r.item_description === desc).map((r) => [fyStart(r["Fiscal Year"]), num(r.item_value)]));
        if (m.size) S[k] = { name: label, label, color, data: dates.map((d) => (m.has(d) ? Math.round(m.get(d) * 100) / 100 : null)) };
      }
      // WITHHELD POINTS (a general rule, not a hand pick): a quantum index whose implied value
      // growth (unit value x quantum) misses the rupee value growth of the same flow (report 432)
      // by more than 60 points is a broken print, not a measurement. The indices cover only goods
      // with a quantity unit, so a gap of 10 to 30 points is ordinary; 60 is never.
      // 2026-10-09: base 2012-13 exports 2025-26 (quantum 473.58 after 179.21; implied +178%
      // against +5.4% in rupees). Gross and income terms of trade use the quantum index and go too.
      const inrA = R["432:DP0"].rows;
      const inrVal = (fy, flow) => { const r = inrA.find((x) => x["Fiscal Year"] === fy && x["Export/Import"] === flow && x["Oil/Non-oil"] === "Total" && x.Month === "5") ?? inrA.find((x) => x["Fiscal Year"] === fy && x["Export/Import"] === flow && x["Oil/Non-oil"] === "Total"); return r ? num(r["Aggregate Value"]) : null; };
      const fyOf = (d) => `${d.slice(0, 4)}-${String((+d.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
      for (const [fl, flow] of [["exports", "Exports"], ["imports", "Imports"]]) {
        const u = S["uvi_" + fl]?.data, q = S["qi_" + fl]?.data; if (!u || !q) continue;
        dates.forEach((d, i) => {
          if (!i || [u[i], q[i], u[i - 1], q[i - 1]].some((v) => v == null)) return;
          const a = inrVal(fyOf(d), flow), b = inrVal(fyOf(dates[i - 1]), flow); if (a == null || b == null) return;
          const implied = (u[i] * q[i]) / (u[i - 1] * q[i - 1]) - 1, actual = a / b - 1;
          if (Math.abs(implied - actual) * 100 <= 60) return;
          const why = `${fyOf(d)}: withheld. The RBI table prints a quantum index of ${q[i]} after ${q[i - 1]}, which with the unit value index implies ${fl} grew ${(implied * 100).toFixed(0)}% in value; the rupee value grew ${(actual * 100).toFixed(1)}%. A broken print, not a measurement (checked 2026-10-09).`;
          for (const k of ["qi_" + fl, ...(fl === "exports" ? ["tot_gross", "tot_income"] : ["tot_gross"])]) {
            if (!S[k] || S[k].data[i] == null) continue;
            S[k].data[i] = null;
            (S[k].withheld ??= []).push(d);
            S[k].withheldNote = (S[k].withheldNote ? S[k].withheldNote + " " : "") + why;
          }
          console.warn(`  trade-dbie: ${rel} ${fl} ${fyOf(d)} quantum index withheld (${why})`);
        });
      }
      write(rel, dates, S, { frequency: "annual", base, unit: "index", coverage: `Unit value and volume indices of India's exports and imports, and the terms of trade, base ${base}`,
        note: `RBI DBIE report 379 (DGCI&S indices), base ${base}. A different base is a different ruler: never joined to the other bases.`, retired: base !== "2012-13=100" });
    }
  }

  /* ---------- unit value and quantum by commodity: 601 / 552, two bases ---------- */
  for (const [dp, base, rel, from] of [["DP0", "2012-13=100", "trade-dbie-uvi-2012", "2013-14"], ["DP3", "1999-2000=100", "trade-dbie-uvi-1999", "1999-00"]]) {
    const S = {}; const allDates = new Set();
    for (const [id, flow] of [["601", "exports"], ["552", "imports"]]) {
      const rows = R[`${id}:${dp}`].rows;
      const codeCol = flow === "exports" ? "Export Commodity Code" : "Import Commodity Code";
      const by = new Map();
      for (const r of rows) {
        const kind = /Unit value/i.test(r["Item Description"]) ? "uvi" : /Quantum/i.test(r["Item Description"]) ? "qi" : null;
        if (!kind) continue;
        const code = uviCode(r, flow);
        const desc = (r["Imp Exp Commodity Description"] || "").replace(/\s*\|\s*/g, ", ").trim();
        const k = `${flow}_${kind}_${slug(code)}`;
        const d = fyStart(r["Fiscal Year"]); allDates.add(d);
        if (!by.has(k)) by.set(k, { label: `${desc} (code ${code}), ${kind === "uvi" ? "unit value index" : "quantum index"}, ${flow}`, group: `${flow === "exports" ? "Exports" : "Imports"}, ${kind === "uvi" ? "unit value" : "quantum"}`, m: new Map() });
        // an index is never 0: DGCI&S prints 0 where it compiled no index for a group that year
        // (nothing traded, or the group not in the basket); a gap, never a zero (validate NONZERO)
        const v = num(r.item_value);
        by.get(k).m.set(d, v === 0 ? null : v);
        if (v === 0) by.get(k).zeroed = true;
      }
      for (const [k, x] of by) S[k] = x;
    }
    const dates = axis([...allDates]);
    const series = Object.fromEntries([...Object.entries(S)].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => [k, { name: x.label, label: x.label, color: "#A3A9B4", group: x.group,
      data: dates.map((d) => (x.m.has(d) && x.m.get(d) != null ? Math.round(x.m.get(d) * 100) / 100 : null)),
      ...(x.zeroed ? { gapsNote: "No index compiled for these years (the RBI table prints 0)." } : {}) }]));
    write(rel, dates, series, { frequency: "annual", base, unit: "index", coverage: `Unit value and quantum indices of exports and imports by commodity (SITC-based DGCI&S groups), base ${base}, from ${from}`,
      note: `RBI DBIE reports 601 (exports) and 552 (imports), data provider ${dp}, DGCI&S indices on base ${base}. Commodity codes are the DGCI&S index codes. A different base is a different ruler. The table prints 0 where no index was compiled for a group that year; those are left empty, and a group printed as 0 in every year is not baked.`, retired: dp === "DP3" });
  }

  /* ---------- crude oil and petroleum products, tonnes: 148 ---------- */
  {
    const rows = R["148:DP1"].rows.filter((r) => r["Unit Description"] === "ACTUALS");
    const dates = axis(rows.map((r) => fyStart(r["Fiscal Year"])));
    const S = {};
    const ITEMS = [["Production of Crude oil", "crude_production", "Crude oil produced in India, million tonnes", "#5F6675"], ["Imports of Crude oil", "crude_imports", "Crude oil imported, million tonnes", "#C47A16"],
      ["Production of POL products", "products_production", "Petroleum products produced in India's refineries, million tonnes", "#A3A9B4"], ["Imports of POL products", "products_imports", "Petroleum products imported, million tonnes", "#2E4BD8"]];
    ITEMS.forEach(([desc, k, label, color]) => {
      const m = new Map(rows.filter((r) => r["Item Description"] === desc).map((r) => [fyStart(r["Fiscal Year"]), num(r.Amount)]));
      S[k] = { name: label, label, color, data: dates.map((d) => (m.get(d) == null ? null : Math.round(m.get(d) / 1e4) / 100)) };
    });
    // DBIE's export of report 148 (checked 2026-10-10) prints 1998-99 to 2007-08 a second time
    // as 1988-89 to 1997-98 (1988-89 crude imports = 1998-99's 39.8 Mt; India imported about
    // 21 Mt in 1990-91). The general detector (util.findCopiedRuns) blanks the copy.
    nullCopiedRuns(dates, S, "DBIE report 148");
    write("trade-dbie-oil-volumes", dates, S, { frequency: "annual", base: "as published", unit: "million_tonnes",
      coverage: "Crude oil and petroleum products: how much India produces and how much it imports, million tonnes, since 1972-73",
      note: "RBI DBIE report 148 (Handbook of Statistics on the Indian Economy), Ministry of Petroleum and Natural Gas data. Published in tonnes; shown in million tonnes. POL: petroleum, oil and lubricants." });
  }

  /* ---------- direction of trade, 2009-10 on: 676 DP1 ---------- */
  {
    const rows = actuals(R["676:DP1"].rows);
    const P = pickFinal(rows, (r) => `${fyStart(r["Fiscal Year"])}|${r.export_import_indicator}|${r["Hierarchy Level 3"]}`, (r) => num(r.export_import_value),
      (r) => [VERSION_RANK[r["Version Desc"]] ?? 0, r["Version Desc"]]);
    const dates = axis([...P.keys()].map((k) => k.split("|")[0]));
    const names = new Map(rows.map((r) => [r["Hierarchy Level 3"], { name: r["Country Name"], order: +r["C Country Display Order"] }]));
    const S = {};
    for (const [h3, { name, order }] of [...names].sort((a, b) => a[1].order - b[1].order)) for (const [ind, fl] of [["E", "exports"], ["I", "imports"]]) {
      const label = `${name}, ${fl}, US$ million`;
      S[`${fl}_${String(order).padStart(2, "0")}_${slug(name)}`] = { name: label, label, color: "#A3A9B4", group: h3,
        data: dates.map((d) => { const x = P.get(`${d}|${ind}|${h3}`); return x ? r2(x.v / 1e6) : null; }) };
    }
    write("trade-dbie-direction", dates, S, { frequency: "annual", base: "as published", unit: "usd_million",
      coverage: "Direction of India's trade: exports to and imports from 40 partner countries and the RBI's groups (OECD, OPEC, SAARC, EU and others), every year since 2009-10, US$ million",
      note: "RBI DBIE report 676, data provider DP1 (the current grouping, from 2009-10). Groups overlap (a country sits in its region and its economic group); never add groups together. The older grouping (1987-88 to 2013-14) is a different table and is not joined." });
  }

  /* ---------- the older direction table, 1987-88 to 2013-14: 676 DP0 ---------- */
  {
    const rows = actuals(R["676:DP0"].rows);
    const P = pickFinal(rows, (r) => `${fyStart(r["Fiscal Year"])}|${r.Commodity}|${r.Country}`, (r) => num(r["Export Import Value Old"]),
      (r) => [VERSION_RANK[r["Version Desc"]] ?? 0, r["Version Desc"]]);
    const dates = axis([...P.keys()].map((k) => k.split("|")[0]));
    const pairs = [...new Set([...P.keys()].map((k) => k.split("|").slice(1).join("|")))].sort();
    const series = Object.fromEntries(pairs.map((p) => {
      const [c, cty] = p.split("|");
      const label = c === "Export" ? `Exports to ${cty}, US$ million` : c === "Import" ? `Imports from ${cty}, US$ million` : `${c}, ${cty}, US$ million`;
      return [`${slug(c)}__${slug(cty)}`.slice(0, 90), { name: label, label, color: "#A3A9B4", data: dates.map((d) => { const x = P.get(`${d}|${p}`); return x ? r2(x.v / 1e6) : null; }) }];
    }));
    write("trade-dbie-direction-1987", dates, series, { frequency: "annual", base: "RBI grouping to 2013-14", unit: "usd_million",
      coverage: "The older direction-of-trade table: exports to and imports from partners and groups, with commodities by partner, 1987-88 to 2013-14, US$ million",
      note: "RBI DBIE report 676, data provider DP0 (the grouping used until 2013-14). Where a year carries both a forecast and a provisional value, the provisional one is kept. A different ruler from trade-dbie-direction (2009-10 on); never joined. Groups overlap; never add them.", retired: true });
  }

  /* ---------- major commodity groups: 439 / 431, new (DP1) and old (DP0) groupings ---------- */
  {
    const newRows = (id) => actuals(R[`${id}:DP1`].rows);
    const S = {}; const allD = new Set();
    for (const [id, fl] of [["439", "exports"], ["431", "imports"]]) {
      const rows = newRows(id);
      const valCol = rows[0]["Export Import Value"] != null ? "Export Import Value" : Object.keys(rows[0]).find((h) => /Export Import Value/.test(h));
      const descCol = rows[0]["Item Description"] != null ? "Item Description" : "Commodity Hierarchy Level 1";
      const P = pickFinal(rows, (r) => `${fyStart(r["Fiscal Year"])}|${r["Item Serial Code"]}`, (r) => num(r[valCol]), (r) => [VERSION_RANK[r["Version Desc"]] ?? 0, r["Version Desc"]]);
      const items = new Map(rows.map((r) => [r["Item Serial Code"], r[descCol].replace(/^otal/, "Total")]));
      for (const k of P.keys()) allD.add(k.split("|")[0]);
      for (const [code, desc] of [...items].sort((a, b) => +a[0] - +b[0])) {
        const label = `${desc}, ${fl}, US$ million`;
        S[`${fl}_${String(code).padStart(2, "0")}_${slug(desc)}`] = { name: label, label, color: "#A3A9B4", P, code };
      }
    }
    const dates = axis([...allD]);
    const series = Object.fromEntries(Object.entries(S).map(([k, x]) => [k, { name: x.name, label: x.label, color: x.color,
      data: dates.map((d) => { const y = x.P.get(`${d}|${x.code}`); return y ? r2(y.v / 1e6) : null; }) }]));
    write("trade-dbie-commodities", dates, series, { frequency: "annual", base: "as published", unit: "usd_million",
      coverage: "Exports and imports by the RBI's major commodity groups (tea to petroleum, gold to electronic goods), every year since 2009-10, US$ million",
      note: "RBI DBIE reports 439 (exports) and 431 (imports), data provider DP1, the grouping in use since 2009-10 (DGCI&S principal commodities regrouped by the RBI). The older grouping is trade-dbie-commodities-1987, a different ruler." });
  }
  {
    const S = {}; const allD = new Set();
    for (const [id, fl] of [["439", "exports"], ["431", "imports"]]) {
      const rows = actuals(R[`${id}:DP0`].rows);
      const valCol = Object.keys(rows[0]).find((h) => /Export Import Value/.test(h));
      const m = new Map(); const names = new Map();
      for (const r of rows) {
        const d = fyStart(r["Fiscal Year"]); allD.add(d);
        const name = r.Commodity.trim();
        const order = +r["Commodity display order"];
        names.set(name, order);
        m.set(`${d}|${name}`, num(r[valCol]));
      }
      for (const [name, order] of [...names].sort((a, b) => a[1] - b[1])) {
        const item = name.match(/^([IVX]+\.?[A-Z]?\.?|\d+\s*\([a-z]\)|\d+\.?)\s*/);
        const label = `${item ? name.slice(item[0].length) : name}${item ? ` (item ${item[1]})` : ""}, ${fl}, US$ million`;
        S[`${fl}_${String(order).padStart(3, "0")}_${slug(name)}`] = { label, m, name };
      }
    }
    const dates = axis([...allD]);
    const series = Object.fromEntries(Object.entries(S).map(([k, x]) => [k, { name: x.label, label: x.label, color: "#A3A9B4",
      data: dates.map((d) => { const v = x.m.get(`${d}|${x.name}`); return v == null ? null : r2(v / 1e6); }) }]));
    write("trade-dbie-commodities-1987", dates, series, { frequency: "annual", base: "RBI grouping to 2013-14", unit: "usd_million",
      coverage: "Exports and imports by major commodity in the RBI's older grouping, 1987-88 to 2013-14, US$ million",
      note: "RBI DBIE reports 439 (exports) and 431 (imports), data provider DP0: the grouping used until 2013-14, with its own item numbering (sub-items such as 1 (a) sit inside their parent). A different ruler from trade-dbie-commodities; never joined.", retired: true });
  }

  /* ---------- select commodities to principal countries: 429 ---------- */
  for (const [dp, rel, cov] of [["DP1", "trade-dbie-commodity-partners", "2013-14 onward"], ["DP0", "trade-dbie-commodity-partners-1990", "1990-91 to 2013-14"]]) {
    const rows = actuals(R[`429:${dp}`].rows);
    const valCol = Object.keys(rows[0]).find((h) => /Amount/.test(h));
    const descCol = rows[0]["Commodity Description"] != null ? "Commodity Description" : "Description Commodity";
    const verCol = rows[0]["Prov Fin Indicator (old)"] != null ? "Prov Fin Indicator (old)" : null;
    const P = pickFinal(rows, (r) => `${fyStart(r["Fiscal Year"])}|${r[descCol]}|${r["Country Name"] ?? r.Country}`, (r) => num(r[valCol]),
      (r) => (verCol ? [/F/i.test(r[verCol]) ? 5 : 2, r[verCol]] : [5, "as published"]));
    const dates = axis([...P.keys()].map((k) => k.split("|")[0]));
    const pairs = [...new Set([...P.keys()].map((k) => k.split("|").slice(1).join("|")))].sort();
    const series = Object.fromEntries(pairs.map((p) => {
      const [c, cty] = p.split("|"); const label = `${c} exported to ${cty}, US$ million`;
      return [`${slug(c)}__${slug(cty)}`.slice(0, 90), { name: label, label, color: "#A3A9B4",
        data: dates.map((d) => { const x = P.get(`${d}|${p}`); return x ? r2(x.v / 1e6) : null; }) }];
    }));
    write(rel, dates, series, { frequency: "annual", base: dp === "DP0" ? "RBI grouping to 2013-14" : "as published", unit: "usd_million",
      coverage: `Exports of 18 select commodities to India's principal buyers, ${cov}, US$ million`,
      note: `RBI DBIE report 429, data provider ${dp}. Published in US$; shown in US$ million. The two providers use different commodity and country lists: different rulers, never joined.`, retired: dp === "DP0" });
  }

  writeDbieCatalogue(root, db, R);
}

/* ---------- the coverage catalogue (docs/CONTRACT-coverage.md) ----------
 * Every merchandise-trade report in DBIE's own report catalogue (the Data Bank's
 * rbi_dbie_report_catalog), every data provider the mirror holds for it, and, for the
 * providers read above, every line item they carry. Services, the balance of payments,
 * invoicing and bank advances are other families' (services, external, credit). */
function writeDbieCatalogue(root, db, R) {
  const { rows: cat } = databankQuery(db, "rbi_dbie_report_catalog",
    "select distinct report_id, report_name, menu from {table} order by cast(report_id as integer), report_name, menu");
  const TRADE = /\b(foreign trade|merchandise trade|exports? of|imports? of|direction of foreign trade|terms of foreign trade|index numbers of (exports|imports))\b/i;
  const NOT = /services|invisibles|balance of payments|advances|invoicing|settlement|traded volume|banking/i;
  const reports = new Map();
  for (const r of cat) if (TRADE.test(r.report_name) && !NOT.test(r.report_name) && !reports.has(r.report_id)) reports.set(r.report_id, r);
  const items = [];
  const add = (id, label, dims = {}) => items.push({ id, label, dims });
  const sl = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const LINES = {
    "433:DP0": (r) => sl(r["Export/Import"]), "648:DP0": (r) => sl(r["Export/Import"]),
    "426:DP0": (r) => `${sl(r["Hbs Item Hierarchy Level1"])}:${sl(r["Hbs Item Hierarchy Level2"])}`, "425:DP0": (r) => `${sl(r["Hbs Item Hierarchy Level1"])}:${sl(r["Hbs Item Hierarchy Level2"])}`,
    "649:DP0": (r) => `${sl(r["Export/Import"])}:${sl(r["Oil/Non-oil"])}`, "432:DP0": (r) => `${sl(r["Export/Import"])}:${sl(r["Oil/Non-oil"])}`,
    "379:DP0": (r) => `${sl(r["Data Series"].match(/\d{4}-\d{4}/)?.[0] ?? "")}:${sl(r.item_description)}:${sl(r["Imp Exp Commodity Description"])}`,
    "601:DP0": (r) => `${sl(r["Item Description"])}:${sl(uviCode(r, "exports"))}`, "552:DP0": (r) => `${sl(r["Item Description"])}:${sl(uviCode(r, "imports"))}`,
    "601:DP3": (r) => `${sl(r["Item Description"])}:${sl(uviCode(r, "exports"))}`, "552:DP3": (r) => `${sl(r["Item Description"])}:${sl(uviCode(r, "imports"))}`,
    "148:DP1": (r) => sl(r["Item Description"]), "676:DP1": (r) => `${sl(r.export_import_indicator)}:${sl(r["Country Name"])}`,
    "439:DP1": (r) => sl(r["Item Serial Code"]), "431:DP1": (r) => sl(r["Item Serial Code"]),
    "439:DP0": (r) => sl(r.Commodity), "431:DP0": (r) => sl(r.Commodity),
    "676:DP0": (r) => `${sl(r.Commodity)}:${sl(r.Country)}`,
    "429:DP1": (r) => `${sl(r["Commodity Description"])}:${sl(r["Country Name"])}`, "429:DP0": (r) => `${sl(r["Description Commodity"])}:${sl(r.Country)}`,
  };
  for (const [id, r] of [...reports].sort((a, b) => +a[0] - +b[0])) {
    const provs = dbieProviders(db, id);
    if (!provs.length) { add(`dbie:${id}`, `${r.report_name} (${r.menu}): not in the Data Bank mirror`, { report: id }); continue; }
    for (const p of provs) {
      const key = `${id}:${p.id}`;
      if (LINES[key] && R[key]) {
        const seen = new Set();
        const valCols = R[key].header.filter((h) => /value|amount/i.test(h) && !/display|order/i.test(h));
        for (const row of R[key].rows) {
          if (!valCols.some((c) => /\d/.test(row[c] ?? ""))) continue;   // a blank line carries nothing
          const l = LINES[key](row); if (l && !seen.has(l)) { seen.add(l); add(`dbie:${id}:${p.id.toLowerCase()}:${l}`, `${r.report_name}, ${p.name}: ${l}`, { report: id, provider: p.id }); }
        }
      } else add(`dbie:${id}:${p.id.toLowerCase()}`, `${r.report_name} (${r.menu}), data provider ${p.id} "${p.name}"`, { report: id, provider: p.id });
    }
  }
  const out = { family: "trade-dbie", source: "Reserve Bank of India, DBIE (via the local Data Bank mirror): merchandise-trade reports", generator: "scripts/lib/products/dbie-trade.mjs (run by scripts/fetch.mjs only trade-dbie)",
    generated_at: new Date().toISOString().slice(0, 10), items };
  const p = path.join(root, "data/coverage/trade-dbie.catalogue.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p)) { const prev = JSON.parse(fs.readFileSync(p, "utf8")); if (JSON.stringify(prev.items) === JSON.stringify(items)) out.generated_at = prev.generated_at; }
  fs.writeFileSync(p, JSON.stringify(out, null, 0).replace(/},\{"id"/g, '},\n{"id"') + "\n");
  console.log(`wrote data/coverage/trade-dbie.catalogue.json (${items.length} items, ${reports.size} reports)`);
}
