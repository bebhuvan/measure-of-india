// scripts/lib/products/tradestat.mjs: India's merchandise trade by commodity and partner, from
// TradeStat (Department of Commerce, DGCI&S customs data). Client: scripts/lib/tradestat.mjs.
// Reference notes and every trap: docs/reference/tradestat.md.
//
// Two phases, so the slow one never has to run twice:
//   FETCH  one archived raw file per TradeStat call, data/raw/trade/<view>/<call>.json.gz,
//          cells exactly as printed (strings), plus the page's own footnotes. A call older
//          than its product's revision window is never fetched again unless TRADESTAT_FULL=1;
//          a re-fetched call whose cells changed archives the old file under
//          data/raw/trade/vintages/ first (the writeRaw semantics, gzip). TRADESTAT_OFFLINE=1
//          skips the fetch phase entirely and bakes from the archive.
//   BAKE   data/series/trade-*.json from the archive alone (see bake.mjs alongside).
//
// Source of record: the MONTHLY bank (MEIDB). Every annual figure is the March call's
// April-to-March cumulative. The annual bank (EIDB) is fetched only as a cross-check: on
// 2026-10-09 every 2023-24 commodity value in EIDB was exactly twice the MEIDB figure (its
// chapter sum is 874,144 against a printed total of 437,072), so EIDB never feeds a bundle.
//
// HAND CHECKS (2026-10-09) against the DGCI&S quick-estimates tables released with the
// Department of Commerce's PIB release of 13 August 2026 (US$ million):
//   gold, HS 7108, imports July 2025 (R)        3,973.90  vs QE "Gold" 3,974
//   coal, coke and briquettes, HS 2701-2704, imports July 2025   2,361.34 vs QE 2,361
//   rice, HS 1006, exports July 2025 (R)          921.15  vs QE "Rice" 921; July 2026 860.37 vs 860
//   vegetable oils, HS 1507-1515, imports July 2025  1,931.99 vs QE "Vegetable Oil" 1,935
//     (the QE group takes a few more lines; within 0.2%)
//   total exports 2025-26 (March 2026 cumulative)   441,452.14 vs QE total 441,452
// The 2023-24 column of the 2024-25 call against the 2023-24 call: in MEIDB the two agree to
// the cent at chapter level (FY 2023-24 exports 437,072.05 in both); the "fish at 12,248"
// the first probe saw is EIDB's double count, not a revision.
//
// Revision flags: each MEIDB call prints the same month a year earlier flagged (R) "Revised
// Final" and the month itself flagged (F) "Final"; FTPA prints (P) "Provisional". A month's
// value is taken from the call a year later (R) when that call exists, else from its own
// call (F); the flag is stored per date in the bundle's meta.revision.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { tsQuery, stats, allZero } from "../tradestat.mjs";

/* ---------------- the views, with each form's own field names and unit codes ---------------- */
// unit codes differ by form (MEIDB commodity: 1 US$, 3 ₹, 2 quantity; FTPA: 2 US$, 1 ₹;
// the import region form uses 2 for ₹ where the export one uses 3). Mapped from the live
// forms on 2026-10-09 (docs/reference/tradestat.md, "Fields").
export const VIEWS = {
  cw: {
    export: { view: "meidb/commoditywise_export", f: (m, y, lvl, u) => ({ ddMonth: m, ddYear: y, comlev: "all", ddCommodityLevel: lvl, ddReportVal: u, ddReportYear: 1 }) },
    import: { view: "meidb/commoditywise_import", f: (m, y, lvl, u) => ({ imddMonth: m, imddYear: y, comlev: "all", imddCommodityLevel: lvl, imddReportVal: u, imddReportYear: 1 }) },
    units: { usd: 1, inr: 3, qty: 2 },
  },
  region: {
    export: { view: "meidb/region_wise_all_countries_export", f: (m, y, u) => ({ rwacexddMonth: m, rwacexddYear: y, rwacexddReportVal: u, rwacexddReportYear: 1 }), units: { usd: 1, inr: 3 } },
    import: { view: "meidb/region_wise_all_countries_import", f: (m, y, u) => ({ rwacimddMonth: m, rwacimddYear: y, rwacimddReportVal: u, rwacimddReportYear: 1 }), units: { usd: 1, inr: 2 } },
  },
  cxc: {
    export: { view: "meidb/country_wise_all_commodities_export", f: (m, y, c, lvl) => ({ cwcexddMonth: m, cwcexddYear: y, cwcexallcount: c, cwcexddCommodityLevel: lvl, cwcexddReportVal: 1, cwcexddReportYear: 1 }) },
    import: { view: "meidb/country_wise_all_commodities_import", f: (m, y, c, lvl) => ({ cwcimMonth: m, cwcimYear: y, cwcimallcount: c, cwcimCommodityLevel: lvl, cwcimReportVal: 1, cwcimReportYear: 1 }) },
  },
  ftpa: {
    export: { view: "ftpa/export_commodity_group_new", f: (m, y, u) => ({ ReportType: 2, Month: m, Year: y, Report: u }) },
    import: { view: "ftpa/import_commodity_group_new", f: (m, y, u) => ({ IReportType: 2, IMonth: m, IYear: y, IReport: u }) },
    units: { usd: 2, inr: 1 },
  },
  // FTSPCC: principal commodities with quantities (monthly, 2018 on) and total trade by partner
  // (the March table is the full financial year, back to 2009-10)
  ftspccQty: {
    export: { view: "ftspcc/export_commodity_wise", f: (m, y) => ({ ddMonthEx: m, ddYearEx: y, PCommodityEx: "all", ddReportValEx: 3 }) },
    import: { view: "ftspcc/import_commodity_wise", f: (m, y) => ({ ddMonth: m, ddYear: y, PCommodity: "all", ddReportVal: 3 }) },
  },
  ttrade: { view: "ftspcc/ttrade_country_wise", f: (m, y, u) => ({ MonthCwTt: m, YearCwTt: y, countryCwTt: "all", ReportValCwTt: u }), units: { usd: 2, inr: 1 } },
  eidb: {
    export: { view: "eidb/commodity_wise_export", f: (fy) => ({ EidbYearCwe: fy, comType: "all", EidbComLevelCwe: 2, Eidb_ReportCwe: 2 }) },
    import: { view: "eidb/commodity_wise_import", f: (fy) => ({ Eidb_YearCwi: fy, commodityType: "all", Eidb_ComLevelCwi: 2, Eidb_ReportCwi: 2 }) },
  },
};

export const FIRST_MONTH = "2018-01";        // MEIDB's picker starts January 2018
export const FIRST_FTPA = "2010-04";         // FTPA's picker starts 2010
export const RAW = "data/raw/trade";
const FULL = process.env.TRADESTAT_FULL === "1";
// TRADESTAT_RESUME=1: a restarted long run skips every call already archived, even inside
// the revision window (the window is for the next release, not for the same day)
const RESUME = process.env.TRADESTAT_RESUME === "1";

const pad = (n) => String(n).padStart(2, "0");
export const ym = (y, m) => `${y}-${pad(m)}`;
export function addMonths(s, n) { let [y, m] = s.split("-").map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return ym(y, m); }
export function months(a, b) { const out = []; for (let s = a; s <= b; s = addMonths(s, 1)) out.push(s); return out; }

/* ---------------- the archive ---------------- */
const comparable = (o) => JSON.stringify({ header: o.header, rows: o.rows, values: o.notes?.values ?? null, flags: o.notes?.flags ?? null, hsNotes: o.notes?.hsNotes ?? null });
export function readRaw(root, rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString("utf8"));
}
function writeRawGz(root, rel, obj, vintage) {
  const p = path.join(root, rel);
  const prev = readRaw(root, rel);
  if (prev && comparable(prev) === comparable(obj)) return "unchanged";
  if (prev) {
    const arch = path.join(root, RAW, "vintages", rel.slice(RAW.length + 1).replace(/\.json\.gz$/, `.${prev.vintage}.json.gz`));
    if (!fs.existsSync(arch)) { fs.mkdirSync(path.dirname(arch), { recursive: true }); fs.copyFileSync(p, arch); }
    console.log(`  revision detected in ${rel}: vintage ${prev.vintage} archived`);
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // gzip with a fixed mtime-free header: identical content gives identical bytes in git
  fs.writeFileSync(p + ".tmp", zlib.gzipSync(JSON.stringify({ vintage, ...obj }), { level: 9 }));
  fs.renameSync(p + ".tmp", p);
  return prev ? "revised" : "new";
}

/* ---------------- calls ---------------- */
export const rel = {
  cw: (flow, lvl, unit, mo) => `${RAW}/meidb-commodity/${flow}-hs${lvl}-${unit}-${mo}.json.gz`,
  region: (flow, unit, mo) => `${RAW}/meidb-region/${flow}-${unit}-${mo}.json.gz`,
  cxc: (flow, lvl, cty, mo) => `${RAW}/meidb-country-commodity/hs${lvl}/${flow}-${cty}-${mo}.json.gz`,
  ftpa: (flow, unit, mo) => `${RAW}/ftpa/${flow}-${unit}-${mo}.json.gz`,
  eidb: (flow, fy) => `${RAW}/eidb-check/${flow}-hs2-usd-${fy}.json.gz`,
  ftspccQty: (flow, mo) => `${RAW}/ftspcc-quantity/${flow}-${mo}.json.gz`,
  ttrade: (unit, mo) => `${RAW}/ftspcc-partners/total-trade-${unit}-${mo}.json.gz`,
  evidence: (name) => `${RAW}/evidence/${name}.json.gz`,
  pickers: () => `${RAW}/pickers.json.gz`,
};

/** Value columns of a MEIDB/FTPA header, in print order, with their period label and flag. */
export function valueColumns(headerRows) {
  const h = headerRows.at(-1) ?? [];
  return h.map((c, i) => ({ i, c })).filter(({ c }) => /\d{4}/.test(c) && !/growth|share/i.test(c))
    .map(({ i, c }) => ({ i, label: c.replace(/\s*\([A-Z]\)\s*$/, "").trim(), flag: (c.match(/\(([A-Z])\)\s*$/) ?? [])[1] ?? null }));
}

async function probeLatest(kind) {
  // the newest month whose own column is published (an unpublished month prints all zeros)
  const now = new Date();
  for (let k = 0; k < 6; k++) {
    const mo = addMonths(ym(now.getUTCFullYear(), now.getUTCMonth() + 1), -k);
    const [y, m] = mo.split("-").map(Number);
    const r = kind === "ftpa"
      ? await tsQuery(VIEWS.ftpa.export.view, VIEWS.ftpa.export.f(m, y, VIEWS.ftpa.units.usd))
      : await tsQuery(VIEWS.cw.export.view, VIEWS.cw.export.f(m, y, 2, VIEWS.cw.units.usd));
    const cols = valueColumns(r.header);
    const cur = kind === "ftpa" ? cols[1] : cols[1];
    if (r.rows.length && cur && !allZero(r.rows, cur.i)) return { latest: mo, result: r };
  }
  throw new Error(`tradestat: no published ${kind} month in the last six months: the source served nothing`);
}

/** The fetch phase. Returns { latest, latestFtpa, counts }. */
export async function fetchAll(root, vintage, { only = null, log = console.log } = {}) {
  const counts = { new: 0, revised: 0, unchanged: 0, skipped: 0, failed: 0 };
  const failures = [];
  const { latest } = await probeLatest("meidb");
  const { latest: latestFtpa } = await probeLatest("ftpa");
  log(`tradestat: latest MEIDB month ${latest}, latest FTPA month ${latestFtpa}`);

  // pickers: the country list and principal-commodity list, as the forms serve them
  {
    const html = await (await import("../tradestat.mjs")).requestRaw("https://tradestat.commerce.gov.in/" + VIEWS.cxc.export.view, { headers: { "User-Agent": "IndiaAtlas/1.0" } });
    const opts = (name) => [...(html.body.match(new RegExp(`<select[^>]*name="${name}"[\\s\\S]*?</select>`))?.[0] ?? "").matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)]
      .map((o) => [o[1].trim(), o[2].trim()]).filter(([v]) => v && v !== "all");
    const countries = opts("cwcexallcount");
    if (countries.length < 200) throw new Error(`tradestat: country picker has ${countries.length} entries (expected about 250)`);
    writeRawGz(root, rel.pickers(), { view: VIEWS.cxc.export.view, header: [], rows: countries, notes: { values: "country picker cwcexallcount" } }, vintage);
  }
  const countries = readRaw(root, rel.pickers()).rows;

  const within = (mo, w) => FULL || mo >= addMonths(latest, -w);
  const jobs = [];
  const add = (group, file, view, fields, windowMonths, mo) => jobs.push({ group, file, view, fields, windowMonths, mo });
  const M = months(FIRST_MONTH, latest).reverse();     // newest first: a partial run has the recent past
  const FY_ENDS = months(FIRST_MONTH, latest).filter((m) => m.endsWith("-03"));
  const cxcCalls = [...FY_ENDS, ...(latest.endsWith("-03") ? [] : [latest])];

  for (const flow of ["export", "import"]) for (const mo of M) {
    const [y, m] = mo.split("-").map(Number);
    for (const lvl of [2, 4]) for (const unit of ["usd", "inr"]) add("cw", rel.cw(flow, lvl, unit, mo), VIEWS.cw[flow].view, VIEWS.cw[flow].f(m, y, lvl, VIEWS.cw.units[unit]), 13, mo);
    for (const unit of ["usd", "inr"]) add("region", rel.region(flow, unit, mo), VIEWS.region[flow].view, VIEWS.region[flow].f(m, y, VIEWS.region[flow].units[unit]), 13, mo);
  }
  for (const flow of ["export", "import"]) for (const mo of months(FIRST_FTPA, latestFtpa).reverse()) {
    const [y, m] = mo.split("-").map(Number);
    for (const unit of ["usd", "inr"]) add("ftpa", rel.ftpa(flow, unit, mo), VIEWS.ftpa[flow].view, VIEWS.ftpa[flow].f(m, y, VIEWS.ftpa.units[unit]), 13, mo);
  }
  for (const flow of ["export", "import"]) for (const fy of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025])
    add("eidb", rel.eidb(flow, fy), VIEWS.eidb[flow].view, VIEWS.eidb[flow].f(fy), 13, `${fy + 1}-03`);
  // evidence for the ledger: quantity at HS 2, 4 and 6 prints no unit (mixed units, never summed)
  for (const flow of ["export", "import"]) for (const lvl of [2, 4, 6]) {
    const [y, m] = latest.split("-").map(Number);
    add("cwq", rel.cw(flow, lvl, "qty", latest), VIEWS.cw[flow].view, VIEWS.cw[flow].f(m, y, lvl, VIEWS.cw.units.qty), 13, latest);
  }
  for (const flow of ["export", "import"]) for (const mo of M) {
    const [y, m] = mo.split("-").map(Number);
    add("cw6", rel.cw(flow, 6, "usd", mo), VIEWS.cw[flow].view, VIEWS.cw[flow].f(m, y, 6, VIEWS.cw.units.usd), 13, mo);
    add("cw8", rel.cw(flow, 8, "usd", mo), VIEWS.cw[flow].view, VIEWS.cw[flow].f(m, y, 8, VIEWS.cw.units.usd), 13, mo);
    add("cw8q", rel.cw(flow, 8, "qty", mo), VIEWS.cw[flow].view, VIEWS.cw[flow].f(m, y, 8, VIEWS.cw.units.qty), 13, mo);
  }
  for (const flow of ["export", "import"]) for (const mo of M) {
    const [y, m] = mo.split("-").map(Number);
    add("ftspccQty", rel.ftspccQty(flow, mo), VIEWS.ftspccQty[flow].view, VIEWS.ftspccQty[flow].f(m, y), 13, mo);
  }
  for (const mo of months(FIRST_FTPA, latestFtpa).filter((x) => x.endsWith("-03")).slice(1)) for (const unit of ["usd", "inr"]) {
    const [y, m] = mo.split("-").map(Number);
    add("ttrade", rel.ttrade(unit, mo), VIEWS.ttrade.view, VIEWS.ttrade.f(m, y, VIEWS.ttrade.units[unit]), 13, mo);
  }
  // evidence the coverage ledger's reasons rest on (one call each, latest period)
  {
    const [y, m] = latest.split("-").map(Number);
    const mar = months(FIRST_MONTH, latest).filter((x) => x.endsWith("-03")).at(-1);
    const [ym_, mm_] = mar.split("-").map(Number);
    for (const flow of ["export", "import"]) {
      add("evidence", rel.evidence(`${flow}-hs8-inr-${latest}`), VIEWS.cw[flow].view, VIEWS.cw[flow].f(m, y, 8, VIEWS.cw.units.inr), 13, latest);
      for (const cty of ["423", "77"]) add("evidence", rel.evidence(`${flow}-country-${cty}-hs8-${mar}`), VIEWS.cxc[flow].view, VIEWS.cxc[flow].f(mm_, ym_, cty, 8), 13, latest);
    }
  }
  for (const lvl of [2, 4]) for (const flow of ["export", "import"]) for (const mo of cxcCalls.slice().reverse()) for (const [code] of countries) {
    const [y, m] = mo.split("-").map(Number);
    add(`cxc${lvl}`, rel.cxc(flow, lvl, code, mo), VIEWS.cxc[flow].view, VIEWS.cxc[flow].f(m, y, code, lvl), 2, mo);
  }

  const todo = jobs.filter((j) => (!only || only.includes(j.group)) && (!fs.existsSync(path.join(root, j.file)) || (!RESUME && within(j.mo, j.windowMonths))));
  counts.skipped = jobs.length - todo.length;
  log(`tradestat: ${jobs.length} calls in the plan, ${todo.length} to fetch now, ${counts.skipped} already archived and settled`);
  let n = 0;
  const t0 = Date.now();
  for (const j of todo) {
    try {
      const r = await tsQuery(j.view, j.fields);
      if (!r.rows.length) throw new Error("no data rows");
      const st = writeRawGz(root, j.file, { view: j.view, fields: j.fields, header: r.header, rows: r.rows, notes: r.notes }, vintage);
      counts[st]++;
    } catch (e) {
      counts.failed++;
      failures.push(`${j.file}: ${e.message}`);
      console.warn(`  FAILED ${j.file}: ${e.message}`);
    }
    if (++n % 50 === 0) {
      const el = (Date.now() - t0) / 1000;
      log(`  ${n}/${todo.length} calls, ${Math.round(stats.bytes / 1e6)} MB, ${Math.round(el / 60)} min, about ${Math.round(((todo.length - n) * el) / n / 60)} min left`);
    }
  }
  log(`tradestat fetch: ${JSON.stringify(counts)}, ${stats.requests} requests, ${stats.retries} retries`);
  if (failures.length) { fs.mkdirSync(path.join(root, "logs"), { recursive: true }); fs.writeFileSync(path.join(root, "logs/tradestat-failures.txt"), failures.join("\n") + "\n"); }
  return { latest, latestFtpa, counts, failures };
}
