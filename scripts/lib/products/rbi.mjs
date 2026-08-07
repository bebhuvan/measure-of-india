// scripts/lib/products/rbi.mjs — RBI external-sector data via eSankhyiki.
//
// TWO layers:
//  1. FULL INGEST — every sub-indicator in the RBI product is paged through
//     in full and archived to data/raw/rbi/<code>-<slug>.json (vintage-safe).
//  2. CURATED BUNDLES — the page-ready monthly series (trade, reserves,
//     USD/INR) are built from the ingested rows.
//
// API quirks encoded here:
//  - records are keyed by sub_indicator_code; other dimension params (trade,
//    currency, month…) are unreliable — page unfiltered, filter client-side;
//  - trade rows use FISCAL-year labels ("2025-26" = Apr 2025–Mar 2026),
//    reserves and exchange rates use calendar-year labels;
//  - the trade balance is computed as exports − imports and cross-checked
//    against the published Trade Balance rows.

import fs from "node:fs";
import path from "node:path";
import { mospi } from "../mospi.mjs";
import { MONTHS, round2, writeJson, writeRaw, monthAxis, quarterAxis } from "../util.mjs";

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];

const MONTH_NUM = (name) => MONTHS.indexOf(name) + 1;
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// fiscal-year label + month name -> "YYYY-MM" (Apr–Dec -> first year)
function fyMonth(fy, monthName) {
  const mi = MONTH_NUM(monthName);
  if (!mi) return null;
  const y1 = Number(String(fy).slice(0, 4));
  return `${mi >= 4 ? y1 : y1 + 1}-${String(mi).padStart(2, "0")}`;
}
const calMonth = (year, monthName) => {
  const mi = MONTH_NUM(monthName);
  return mi ? `${year}-${String(mi).padStart(2, "0")}` : null;
};

async function fetchAllRows(subCode) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("rbi/getRbiRecords", { sub_indicator_code: subCode, page, limit: 500 });
    rows.push(...(res.data ?? []));
    if (page >= (res.meta_data?.totalPages ?? 1)) break;
    page++;
  }
  return rows;
}

export async function buildRbi(root, dcfg, vintage) {
  const byCode = {}; // code -> rows (feeds the curated bundles)

  /* ---- 1. full ingest (or offline reload) ---- */
  if (process.env.RBI_FROM_RAW === "1") {
    // rebuild the bundles from the archived ingest, no network: every
    // data/raw/rbi/<code>-<slug>.json is { vintage, label, dimensions, rows };
    // the code is the number before the first "-" in the filename.
    const dir = path.join(root, "data/raw/rbi");
    for (const f of fs.readdirSync(dir)) {
      const m = f.match(/^(\d+)-.*\.json$/);
      if (m) byCode[m[1]] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).rows;
    }
    process.stdout.write(`rbi: RBI_FROM_RAW — loaded ${Object.keys(byCode).length} archived tables from disk\n`);
    return buildBundles(root, dcfg, vintage, byCode);
  }

  const il = await mospi("rbi/getRbiIndicatorList", { viz_status: 1 });
  const indicators = il.data ?? [];
  for (const ind of indicators) {
    const code = ind.indicator_code ?? ind.sub_indicator_code;
    const md = await mospi("rbi/getRbiMetaData", { sub_indicator_code: code });
    const meta = (md.data ?? [])[0] ?? {};
    const rows = await fetchAllRows(code);
    byCode[String(code)] = rows;
    const label = (meta.label ?? ind.description ?? `sub-${code}`).trim();
    writeRaw(root, `data/raw/rbi/${code}-${slugify(label)}.json`, {
      vintage,
      label,
      dimensions: Object.fromEntries(Object.entries(meta.dimensions ?? {}).map(([k, v]) => [k, v.map((x) => x.label)])),
      rows,
    });
    process.stdout.write(`rbi sub ${code}: ${rows.length} rows (${label.slice(0, 50)})\n`);
    await new Promise((r) => setTimeout(r, 200));
  }

  return buildBundles(root, dcfg, vintage, byCode);
}

/* ---- 2. curated bundles (pure: byCode rows in, series files out) ---- */
function buildBundles(root, dcfg, vintage, byCode) {
  const tradeRows = byCode[dcfg.fetch.sub_indicators.trade] ?? [];
  const forexRows = byCode[dcfg.fetch.sub_indicators.forex] ?? [];
  const fxRows = byCode[dcfg.fetch.sub_indicators.usdinr] ?? [];

  const trade = { exports: new Map(), imports: new Map(), balance_published: new Map() };
  for (const r of tradeRows) {
    const ym = fyMonth(r.year, r.month);
    const v = parseFloat(r.value);
    if (!ym || !Number.isFinite(v)) continue;
    if (r.trade === "Exports") trade.exports.set(ym, v);
    else if (r.trade === "Imports") trade.imports.set(ym, v);
    else if (r.trade === "Trade Balance") trade.balance_published.set(ym, v);
  }
  const forex = new Map();
  for (const r of forexRows) {
    if (r.foreign_exchange_reserve_type !== "Total" || r.foreign_exchange_reserve_currency !== "US $ Millions") continue;
    const ym = calMonth(r.year, r.month);
    const v = parseFloat(r.value);
    if (ym && Number.isFinite(v)) forex.set(ym, v);
  }
  const usdinr = new Map();
  for (const r of fxRows) {
    if (r.currency !== "US Dollar") continue;
    const ym = calMonth(r.year, r.month);
    const v = parseFloat(r.value);
    if (ym && Number.isFinite(v)) usdinr.set(ym, v);
  }
  process.stdout.write(`rbi curated: trade ${trade.exports.size}m, forex ${forex.size}m, usdinr ${usdinr.size}m\n`);
  if (!trade.exports.size || !forex.size || !usdinr.size) throw new Error("RBI: incomplete curated data");

  const metaBase = { dossier: "rbi", source: dcfg.source_agency, vintage, mock: false, releaseDate: null, revisionPolicy: dcfg.revision_policy };

  // interior nulls are real gaps in eSankhyiki (e.g. USD/INR May 2024 is
  // absent for all currencies) — disclose in meta.gaps; validate.mjs allows
  // nulls only at these dates.
  const gapsOn = (axis, maps) =>
    axis.filter((ym) => maps.some((m) => m.get(ym) == null)).map((ym) => `${ym}-01`);

  // like gapsOn, but a series that starts late / ends early (e.g. the Euro
  // before 1999) is not "gapped" outside its own published span — only
  // interior nulls are disclosed (matches what validate.mjs enforces).
  const gapsInside = (axis, maps) => {
    const spans = maps.map((m) => { const ks = [...m.keys()].sort(); return [ks[0], ks.at(-1)]; });
    return axis.filter((ym) => maps.some((m, i) => m.get(ym) == null && ym > spans[i][0] && ym < spans[i][1])).map((ym) => `${ym}-01`);
  };

  const tMonths = [...trade.exports.keys()].sort();
  const tAxis = monthAxis(tMonths[0], tMonths.at(-1));
  const tradeBundle = {
    meta: {
      ...metaBase, frequency: "monthly", base: dcfg.base,
      latestPeriod: tMonths.at(-1),
      note: "Levels, US$ Millions. Balance is computed (exports − imports) and cross-checked against the published Trade Balance.",
      gaps: gapsOn(tAxis, [trade.exports, trade.imports]),
    },
    dates: tAxis.map((ym) => `${ym}-01`),
    series: {
      exports: { name: "exports_usd_millions", label: "Exports", color: "#5B564B", data: tAxis.map((ym) => trade.exports.get(ym) ?? null), unit: "USD_millions" },
      imports: { name: "imports_usd_millions", label: "Imports", color: "#A8A293", data: tAxis.map((ym) => trade.imports.get(ym) ?? null), unit: "USD_millions" },
      balance: { name: "trade_balance_usd_millions", label: "Balance", color: "#BE3E26", data: tAxis.map((ym) => {
        const e = trade.exports.get(ym), i = trade.imports.get(ym);
        return e != null && i != null ? round2(e - i) : null;
      }), unit: "USD_millions" },
    },
    crosscheck: { balance_published: tAxis.map((ym) => trade.balance_published.get(ym) ?? null) },
  };

  const fMonths = [...forex.keys()].sort();
  const fAxis = monthAxis(fMonths[0], fMonths.at(-1));
  const forexBundle = {
    meta: {
      ...metaBase, frequency: "monthly", base: dcfg.base,
      latestPeriod: fMonths.at(-1),
      note: "Reserves are total foreign exchange reserves, US$ Millions. USD/INR is the monthly average rate, ₹ per US$.",
      gaps: gapsOn(fAxis, [forex, usdinr]),
    },
    dates: fAxis.map((ym) => `${ym}-01`),
    series: {
      reserves: { name: "forex_reserves_usd_millions", label: "Reserves", color: "#BE3E26", data: fAxis.map((ym) => forex.get(ym) ?? null), unit: "USD_millions" },
      usdinr: { name: "usdinr_monthly_avg", label: "USD/INR", color: "#5B564B", data: fAxis.map((ym) => usdinr.get(ym) ?? null), unit: "inr_per_usd" },
    },
  };

  writeJson(root, "data/series/rbi-trade.json", tradeBundle);
  writeJson(root, "data/series/rbi-forex.json", forexBundle);

  /* ---- wider curated bundles from the full ingest ----
     same conventions: levels as published, fiscal labels mapped to calendar
     months, units carried per series */

  // oil / non-oil merchandise trade (sub 42, US$M, monthly, fiscal labels)
  const oilRows = byCode["42"] ?? [];
  const oil = { oil_exports: new Map(), non_oil_exports: new Map(), oil_imports: new Map(), non_oil_imports: new Map() };
  for (const r of oilRows) {
    const ym = fyMonth(r.year, r.month);
    const v = parseFloat(r.value);
    if (!ym || !Number.isFinite(v)) continue;
    const k = `${r.category === "Oil" ? "oil" : "non_oil"}_${r.trade === "Export" ? "exports" : "imports"}`;
    oil[k]?.set(ym, v);
  }
  const oMonths = [...new Set(Object.values(oil).flatMap((m) => [...m.keys()]))].sort();
  if (oMonths.length) {
    const oAxis = monthAxis(oMonths[0], oMonths.at(-1));
    writeJson(root, "data/series/rbi-trade-oil.json", {
      meta: { ...metaBase, frequency: "monthly", base: dcfg.base, latestPeriod: oMonths.at(-1),
        note: "Levels, US$ Millions. Broad commodity composition of merchandise trade.",
        gaps: gapsOn(oAxis, Object.values(oil)) },
      dates: oAxis.map((ym) => `${ym}-01`),
      series: {
        oil_exports: { name: "oil_exports_usd_millions", label: "Oil exports", color: "#A8A293", data: oAxis.map((ym) => oil.oil_exports.get(ym) ?? null), unit: "USD_millions" },
        non_oil_exports: { name: "non_oil_exports_usd_millions", label: "Non-oil exports", color: "#5B564B", data: oAxis.map((ym) => oil.non_oil_exports.get(ym) ?? null), unit: "USD_millions" },
        oil_imports: { name: "oil_imports_usd_millions", label: "Oil imports", color: "#C6C0B0", data: oAxis.map((ym) => oil.oil_imports.get(ym) ?? null), unit: "USD_millions" },
        non_oil_imports: { name: "non_oil_imports_usd_millions", label: "Non-oil imports", color: "#8A857A", data: oAxis.map((ym) => oil.non_oil_imports.get(ym) ?? null), unit: "USD_millions" },
      },
    });
  }

  // overall balance of payments (sub 4, US$M, quarterly, fiscal quarters)
  const FQ = { Q1: "04", Q2: "07", Q3: "10", Q4: "01" };
  const bopRows = byCode["4"] ?? [];
  const bop = { current_account: new Map(), capital_account: new Map(), errors_omissions: new Map(), overall: new Map() };
  const BOP_KEY = { "Current Account": "current_account", "Capital Account": "capital_account", "Errors & Omissions": "errors_omissions", "Overall Balance of Payments": "overall" };
  for (const r of bopRows) {
    if (String(r.transaction_type).trim() !== "Net") continue;
    const k = BOP_KEY[String(r.bop_overall).trim()];
    const mm = FQ[String(r.quarter).trim()];
    if (!k || !mm) continue;
    const y1 = Number(String(r.year).slice(0, 4));
    const ym = `${mm === "01" ? y1 + 1 : y1}-${mm}`;
    const v = parseFloat(r.value);
    if (Number.isFinite(v)) bop[k].set(ym, v);
  }
  const bMonths = [...new Set(Object.values(bop).flatMap((m) => [...m.keys()]))].sort();
  if (bMonths.length) {
    const bAxis = quarterAxis(bMonths[0], bMonths.at(-1));
    writeJson(root, "data/series/rbi-bop.json", {
      meta: { ...metaBase, frequency: "quarterly", base: dcfg.base, latestPeriod: bMonths.at(-1),
        note: "Net transactions, US$ Millions. Fiscal quarters plotted at quarter start (Q1 = Apr–Jun).",
        gaps: gapsOn(bAxis, Object.values(bop)) },
      dates: bAxis.map((ym) => `${ym}-01`),
      series: {
        current_account: { name: "current_account_net_usd_millions", label: "Current account", color: "#BE3E26", data: bAxis.map((ym) => bop.current_account.get(ym) ?? null), unit: "USD_millions" },
        capital_account: { name: "capital_account_net_usd_millions", label: "Capital account", color: "#5B564B", data: bAxis.map((ym) => bop.capital_account.get(ym) ?? null), unit: "USD_millions" },
        errors_omissions: { name: "errors_omissions_net_usd_millions", label: "Errors & omissions", color: "#A8A293", data: bAxis.map((ym) => bop.errors_omissions.get(ym) ?? null), unit: "USD_millions" },
        overall: { name: "overall_bop_net_usd_millions", label: "Overall balance", color: "#8A857A", data: bAxis.map((ym) => bop.overall.get(ym) ?? null), unit: "USD_millions" },
      },
    });
  }

  // BoP ratios (sub 22, annual fiscal years, % of GDP; import cover in months)
  const ratioRows = byCode["22"] ?? [];
  const RATIO_KEY = {
    "Trade::Exports/ GDP": "exports_gdp", "Trade::Imports/ GDP": "imports_gdp",
    "Invisibles::Net/ GDP": "invisibles_net_gdp", "Current account::CAD/ GDP": "cad_gdp",
    "Capital account::Foreign Investment/ GDP": "foreign_investment_gdp",
  };
  const ratios = {}; // key -> Map("YYYY-04" -> pct)
  const importCover = new Map();
  for (const r of ratioRows) {
    const y1 = String(r.year).slice(0, 4);
    const v = parseFloat(r.value);
    if (!/^\d{4}/.test(r.year ?? "") || !Number.isFinite(v)) continue;
    if (r.balance_of_payments === "Import cover of Reserves (in months)") importCover.set(`${y1}-04`, v);
    else {
      const k = RATIO_KEY[`${r.balance_of_payments}::${r.trade_category}`];
      if (k) (ratios[k] ??= new Map()).set(`${y1}-04`, v);
    }
  }
  const rMonths = [...new Set([...Object.values(ratios).flatMap((m) => [...m.keys()]), ...importCover.keys()])].sort();
  if (rMonths.length) {
    const rAxis = [];
    for (let y = Number(rMonths[0].slice(0, 4)); y <= Number(rMonths.at(-1).slice(0, 4)); y++) rAxis.push(`${y}-04`);
    const RS = [["exports_gdp", "Exports / GDP", "#5B564B"], ["imports_gdp", "Imports / GDP", "#A8A293"], ["invisibles_net_gdp", "Invisibles net / GDP", "#8A857A"], ["cad_gdp", "CAD / GDP", "#BE3E26"], ["foreign_investment_gdp", "Foreign investment / GDP", "#C6C0B0"]];
    const rSeries = {};
    for (const [k, label, color] of RS) {
      if (!ratios[k]?.size) continue;
      rSeries[k] = { name: `bop_${k}_pct`, label, color, data: rAxis.map((ym) => ratios[k].get(ym) ?? null), unit: "pct_of_gdp" };
    }
    rSeries.import_cover = { name: "import_cover_months", label: "Import cover of reserves", color: "#5B564B", data: rAxis.map((ym) => importCover.get(ym) ?? null), unit: "months" };
    writeJson(root, "data/series/rbi-bop-ratios.json", {
      meta: { ...metaBase, frequency: "annual", base: dcfg.base, latestPeriod: rMonths.at(-1),
        note: "Fiscal years plotted at April of the first year. Ratios as published; import cover is in months.",
        gaps: gapsOn(rAxis, [...Object.values(ratios), importCover]) },
      dates: rAxis.map((ym) => `${ym}-01`),
      series: rSeries,
    });
  }

  // external debt, end-March (sub 25, US$M levels + published ratios, annual)
  const debtRows = byCode["25"] ?? [];
  const DEBT_KEY = {
    "Gross External Debt Position": "gross_external_debt", "Multilateral": "multilateral", "Bilateral": "bilateral",
    "International Monetary Fund": "imf", "Trade Credit": "trade_credit", "Commercial Borrowing": "commercial_borrowing",
    "Non-resident Deposits": "nri_deposits", "Rupee Debt": "rupee_debt",
  };
  const DEBT_RATIO_KEY = { "Debt Service Ratio (%)": "debt_service_ratio", "Debt to GDP Ratio (%)": "debt_to_gdp", "Short-term Debt as % of Total Debt": "short_term_pct", "Concessional Debt as % of Total Debt": "concessional_pct" };
  const debt = {}; const debtRatios = {};
  for (const r of debtRows) {
    const y = String(r.year);
    if (!/^\d{4}$/.test(y)) continue;
    const ym = `${y}-03`; // end-March stocks plotted at March
    const v = parseFloat(r.value);
    if (!Number.isFinite(v)) continue;
    const lk = DEBT_KEY[r.external_debt_agreement];
    const rk = DEBT_RATIO_KEY[r.external_debt_agreement];
    if (lk) (debt[lk] ??= new Map()).set(ym, v);
    else if (rk) (debtRatios[rk] ??= new Map()).set(ym, v);
  }
  const dMonths = [...new Set([...Object.values(debt).flatMap((m) => [...m.keys()]), ...Object.values(debtRatios).flatMap((m) => [...m.keys()])])].sort();
  if (dMonths.length) {
    const dAxis = [];
    for (let y = Number(dMonths[0].slice(0, 4)); y <= Number(dMonths.at(-1).slice(0, 4)); y++) dAxis.push(`${y}-03`);
    const dSeries = {};
    const DS = [["gross_external_debt", "Gross external debt", "#BE3E26"], ["commercial_borrowing", "Commercial borrowing", "#5B564B"], ["nri_deposits", "NRI deposits", "#8A857A"], ["trade_credit", "Trade credit", "#A8A293"], ["multilateral", "Multilateral", "#C6C0B0"], ["bilateral", "Bilateral", "#5B564B"], ["imf", "IMF", "#8A857A"], ["rupee_debt", "Rupee debt", "#A8A293"]];
    for (const [k, label, color] of DS) {
      if (!debt[k]?.size) continue;
      dSeries[k] = { name: `external_debt_${k}_usd_millions`, label, color, data: dAxis.map((ym) => debt[k].get(ym) ?? null), unit: "USD_millions" };
    }
    const DRS = [["debt_service_ratio", "Debt service ratio"], ["debt_to_gdp", "Debt / GDP"], ["short_term_pct", "Short-term share"], ["concessional_pct", "Concessional share"]];
    DRS.forEach(([k, label], i) => {
      if (!debtRatios[k]?.size) return;
      dSeries[k] = { name: `external_debt_${k}_pct`, label, color: GREYS[i % GREYS.length], data: dAxis.map((ym) => debtRatios[k].get(ym) ?? null), unit: "pct" };
    });
    writeJson(root, "data/series/rbi-debt.json", {
      meta: { ...metaBase, frequency: "annual", base: dcfg.base, latestPeriod: dMonths.at(-1),
        note: "End-March stocks plotted at March. Composition by source in US$ Millions; ratios as published.",
        gaps: gapsOn(dAxis, [...Object.values(debt), ...Object.values(debtRatios)]) },
      dates: dAxis.map((ym) => `${ym}-01`),
      series: dSeries,
    });
  }

  // NRI deposits (sub 40, US$M, monthly, fiscal labels): outstandings + net flows by scheme
  const nriRows = byCode["40"] ?? [];
  const NRI_CAT = (c) => c === "NRI Deposits" ? "total" : c?.includes("FCNR") ? "fcnrb" : c?.includes("NR(E) RA") ? "nre_ra" : c?.includes("NRO") ? "nro" : null;
  const nri = { outstanding: {}, flows: {} };
  for (const r of nriRows) {
    const ym = fyMonth(r.year, r.month);
    const v = parseFloat(r.value);
    const cat = NRI_CAT(r.NRI_deposits_category);
    if (!ym || !Number.isFinite(v) || !cat) continue;
    const kind = r.NRI_deposits_sub_indicator === "Outstanding" ? "outstanding" : "flows";
    (nri[kind][cat] ??= new Map()).set(ym, v);
  }
  const nMonths = [...new Set([...Object.values(nri.outstanding), ...Object.values(nri.flows)].flatMap((m) => [...m.keys()]))].sort();
  if (nMonths.length) {
    const nAxis = monthAxis(nMonths[0], nMonths.at(-1));
    const nSeries = {};
    const NS = [["total", "Total", "#BE3E26"], ["fcnrb", "FCNR(B)", "#5B564B"], ["nre_ra", "NR(E)RA", "#8A857A"], ["nro", "NRO", "#A8A293"]];
    for (const [k, label, color] of NS) {
      if (nri.outstanding[k]?.size) nSeries[`outstanding_${k}`] = { name: `nri_deposits_outstanding_${k}_usd_millions`, label: `Outstanding · ${label}`, color, data: nAxis.map((ym) => nri.outstanding[k].get(ym) ?? null), unit: "USD_millions" };
      if (nri.flows[k]?.size) nSeries[`flows_${k}`] = { name: `nri_deposits_flows_${k}_usd_millions`, label: `Net flows · ${label}`, color: "#C6C0B0", data: nAxis.map((ym) => nri.flows[k].get(ym) ?? null), unit: "USD_millions" };
    }
    writeJson(root, "data/series/rbi-nri.json", {
      meta: { ...metaBase, frequency: "monthly", base: dcfg.base, latestPeriod: nMonths.at(-1),
        note: "US$ Millions. Outstandings are stocks; flows are net inflows(+) / outflows(-) in the month.",
        gaps: gapsOn(nAxis, [...Object.values(nri.outstanding), ...Object.values(nri.flows)]) },
      dates: nAxis.map((ym) => `${ym}-01`),
      series: nSeries,
    });
  }

  // monthly average exchange rates (sub 36, calendar labels): ₹ per unit of
  // USD/EUR/GBP/JPY. The rows' unit field is null throughout; the JPY values
  // (~0.59 in mid-2025) show the ingest quotes ₹ per SINGLE yen, not the
  // RBI's per-100-yen table convention. Euro starts Jan 1999 (its launch).
  const XR = [["usd", "US Dollar", "US Dollar", "#BE3E26", "inr_per_usd"], ["euro", "Euro", "Euro", "#5B564B", "inr_per_eur"], ["gbp", "Pound Sterling", "Pound Sterling", "#8A857A", "inr_per_gbp"], ["jpy", "Japanese Yen", "Japanese Yen", "#A8A293", "inr_per_jpy"]];
  const xr = {}; // key -> Map("YYYY-MM" -> rate)
  for (const r of byCode["36"] ?? []) {
    const k = XR.find(([, cur]) => cur === r.currency)?.[0];
    const ym = calMonth(r.year, r.month);
    const v = parseFloat(r.value); // "NA" -> NaN, skipped
    if (k && ym && Number.isFinite(v)) (xr[k] ??= new Map()).set(ym, v);
  }
  const xMonths = [...new Set(Object.values(xr).flatMap((m) => [...m.keys()]))].sort();
  if (xMonths.length) {
    const xAxis = monthAxis(xMonths[0], xMonths.at(-1));
    writeJson(root, "data/series/rbi-exchange-rates.json", {
      meta: { ...metaBase, frequency: "monthly", base: dcfg.base, latestPeriod: xMonths.at(-1),
        note: "Monthly average exchange rates, ₹ per unit of foreign currency. Yen is ₹ per single yen in this ingest (the source's unit field is empty; the RBI's usual per-100-yen convention would read ~100× higher). Euro begins Jan 1999.",
        gaps: gapsInside(xAxis, Object.values(xr)) },
      dates: xAxis.map((ym) => `${ym}-01`),
      series: Object.fromEntries(XR.filter(([k]) => xr[k]?.size).map(([k, , label, color, unit]) =>
        [k, { name: `${k}_inr_monthly_avg`, label, color, data: xAxis.map((ym) => xr[k].get(ym) ?? null), unit }])),
    });
  }

  // forward premia, inter-bank monthly average (sub 34, calendar labels):
  // % per annum by tenor; source uses "-" for unavailable months.
  const FP = [["m1", "1-month", "#5B564B"], ["m3", "3-month", "#BE3E26"], ["m6", "6-month", "#8A857A"]];
  const fp = {}; // key -> Map("YYYY-MM" -> pct)
  for (const r of byCode["34"] ?? []) {
    const k = FP.find(([, p]) => p === r.period)?.[0];
    const ym = calMonth(r.year, r.month);
    const v = parseFloat(r.value);
    if (k && ym && Number.isFinite(v)) (fp[k] ??= new Map()).set(ym, v);
  }
  const pMonths = [...new Set(Object.values(fp).flatMap((m) => [...m.keys()]))].sort();
  if (pMonths.length) {
    const pAxis = monthAxis(pMonths[0], pMonths.at(-1));
    writeJson(root, "data/series/rbi-forward-premia.json", {
      meta: { ...metaBase, frequency: "monthly", base: dcfg.base, latestPeriod: pMonths.at(-1),
        note: "USD/INR forward premia (inter-bank, monthly average), per cent per annum by tenor. Negative values (dollar at a forward discount) occur briefly, e.g. late 2003. 1-month begins Jun 1995 (3/6-month in Mar 1993); missing months are as published.",
        gaps: gapsInside(pAxis, Object.values(fp)) },
      dates: pAxis.map((ym) => `${ym}-01`),
      series: Object.fromEntries(FP.filter(([k]) => fp[k]?.size).map(([k, label, color]) =>
        [k, { name: `forward_premia_${label.replace("-", "_")}_pct_pa`, label, color, data: pAxis.map((ym) => fp[k].get(ym) ?? null), unit: "pct_per_annum" }])),
    });
  }

  // RBI intervention in the USD market (sub 28, calendar labels, US$M):
  // gross purchases/sales, net, and the outstanding forward book. The
  // "Outstanding Net Forward Sales (–)…" label carries an EN DASH — matched
  // by prefix. "-" months (no operations reported) stay null, not zero.
  const IV = [["purchases", "Purchase of Foreign Currency (US $ Millions)", "Gross purchases", "#5B564B"], ["sales", "Sale of Foreign Currency (US $ Millions)", "Gross sales", "#A8A293"], ["net", "Net Purchase/ Sale of Foreign Currency (US $ Millions)", "Net purchase(+)/sale(−)", "#BE3E26"], ["forward_outstanding", "Outstanding", "Outstanding forward sales(−)/purchases(+)", "#8A857A"]];
  const iv = {}; // key -> Map("YYYY-MM" -> US$M)
  for (const r of byCode["28"] ?? []) {
    const k = IV.find(([, t]) => t === "Outstanding" ? String(r.transaction).startsWith("Outstanding") : r.transaction === t)?.[0];
    const ym = calMonth(r.year, r.month);
    const v = parseFloat(r.value);
    if (k && ym && Number.isFinite(v)) (iv[k] ??= new Map()).set(ym, v);
  }
  const iMonths = [...new Set(Object.values(iv).flatMap((m) => [...m.keys()]))].sort();
  if (iMonths.length) {
    const iAxis = monthAxis(iMonths[0], iMonths.at(-1));
    writeJson(root, "data/series/rbi-intervention.json", {
      meta: { ...metaBase, frequency: "monthly", base: dcfg.base, latestPeriod: iMonths.at(-1),
        note: "RBI sale/purchase of US dollars, US$ Millions. Gross legs are positive; net is purchases minus sales; the forward book is the end-of-month outstanding position, sales negative. Months the source leaves blank (\"-\", typically no operations) are nulls, not zeros.",
        gaps: gapsInside(iAxis, Object.values(iv)) },
      dates: iAxis.map((ym) => `${ym}-01`),
      series: Object.fromEntries(IV.filter(([k]) => iv[k]?.size).map(([k, , label, color]) =>
        [k, { name: `rbi_usd_${k}_usd_millions`, label, color, data: iAxis.map((ym) => iv[k].get(ym) ?? null), unit: "USD_millions" }])),
    });
  }

  // invisibles by category, net (sub 9, ANNUAL fiscal years, US$M). Net rows
  // are the ones with trade_category null: the "Receipts/GDP" / "Payments/GDP"
  // rows are mislabelled gross LEVELS (receipts − payments = the net rows),
  // not GDP ratios — neither is baked. There is no separate software
  // sub-category in this table; software exports sit inside "Miscellaneous"
  // services, kept here as the software/business-services proxy.
  const INV = [["invisibles", "Invisibles, Net", null, "Invisibles, net", "#5B564B"], ["services", "Non-factor Services", null, "Non-factor services, net", "#8A857A"], ["misc_services", "Non-factor Services", "Miscellaneous, Net", "Misc. services (incl. software), net", "#A8A293"], ["income", "Income, Net", null, "Income, net", "#C6C0B0"], ["private_transfers", "Private Transfers, Net", null, "Private transfers (remittances), net", "#BE3E26"]];
  const inv = {}; // key -> Map("YYYY-04" -> US$M)
  for (const r of byCode["9"] ?? []) {
    if (r.trade_category != null || !/^\d{4}/.test(r.year ?? "")) continue;
    const k = INV.find(([, cat, sub]) => r.category === cat && (r.sub_category ?? null) === sub)?.[0];
    const v = parseFloat(r.value); // "." -> NaN, skipped
    if (k && Number.isFinite(v)) (inv[k] ??= new Map()).set(`${String(r.year).slice(0, 4)}-04`, v);
  }
  const vMonths = [...new Set(Object.values(inv).flatMap((m) => [...m.keys()]))].sort();
  if (vMonths.length) {
    const vAxis = [];
    for (let y = Number(vMonths[0].slice(0, 4)); y <= Number(vMonths.at(-1).slice(0, 4)); y++) vAxis.push(`${y}-04`);
    writeJson(root, "data/series/rbi-invisibles.json", {
      meta: { ...metaBase, frequency: "annual", base: dcfg.base, latestPeriod: vMonths.at(-1),
        note: "Net invisibles by category, US$ Millions; fiscal years plotted at April of the first year. Chosen to tell the services/remittances story: total invisibles, non-factor services, miscellaneous services (the software/business-services carrier — no separate software line exists in this table), income (persistently negative), and private transfers i.e. remittances. The source's Receipts/GDP and Payments/GDP rows are mislabelled gross levels and are not baked.",
        gaps: gapsInside(vAxis, Object.values(inv)) },
      dates: vAxis.map((ym) => `${ym}-01`),
      series: Object.fromEntries(INV.filter(([k]) => inv[k]?.size).map(([k, , , label, color]) =>
        [k, { name: `invisibles_${k}_net_usd_millions`, label, color, data: vAxis.map((ym) => inv[k].get(ym) ?? null), unit: "USD_millions" }])),
    });
  }

  // external debt, quarterly since 2021 (sub 27): sector totals are the rows
  // where the finer dims (term / items / other_sector) are all null. The
  // table is published in ₹ Crore ONLY — no US$ variant exists in the unit
  // field or any dimension — so levels stay in ₹ Crore here (gross ≈
  // ₹63.0 lakh crore end-Mar 2025 ≈ US$ ~737bn, sanity-checked).
  const QM = { March: "03", June: "06", September: "09", December: "12" };
  const DQ = [["gross", "Gross External Debt Position", "Gross external debt", "#BE3E26"], ["general_government", "General Government", "General government", "#5B564B"], ["central_bank", "Central Bank", "Central bank", "#C6C0B0"], ["deposit_corps", "Deposit-taking Corporations except the Central Bank", "Deposit-taking corporations", "#8A857A"], ["other_sectors", "Other Sectors", "Other sectors", "#A8A293"], ["intercompany", "Direct Investment: Intercompany Lending", "Intercompany lending (FDI)", "#5B564B"]];
  const dq = {}; // key -> Map("YYYY-03|06|09|12" -> ₹ Crore)
  for (const r of byCode["27"] ?? []) {
    if (r.external_debt_term != null || r.external_debt_items != null || r.external_debt_other_sector != null) continue;
    const k = DQ.find(([, s]) => s === r.external_debt_sector)?.[0];
    const mm = QM[r.month];
    const v = parseFloat(r.value);
    if (k && mm && Number.isFinite(v)) (dq[k] ??= new Map()).set(`${r.year}-${mm}`, v);
  }
  const qMonths = [...new Set(Object.values(dq).flatMap((m) => [...m.keys()]))].sort();
  if (qMonths.length) {
    // quarterAxis cycles fiscal quarter-STARTS (…10 -> 01); this table is on
    // calendar quarter-ENDS (…12 -> next 03), so the axis is built inline.
    const qAxis = [];
    for (let [y, m] = qMonths[0].split("-").map(Number); `${y}-${String(m).padStart(2, "0")}` <= qMonths.at(-1); m += 3, m > 12 && (m -= 12, y++))
      qAxis.push(`${y}-${String(m).padStart(2, "0")}`);
    writeJson(root, "data/series/rbi-debt-quarterly.json", {
      meta: { ...metaBase, frequency: "quarterly", base: dcfg.base, latestPeriod: qMonths.at(-1),
        note: "End-of-quarter external debt stocks by sector, ₹ Crore (this table is published in rupees only; the annual end-March US$ series is rbi-debt). Calendar quarter-ends plotted at March/June/September/December.",
        gaps: gapsInside(qAxis, Object.values(dq)) },
      dates: qAxis.map((ym) => `${ym}-01`),
      series: Object.fromEntries(DQ.filter(([k]) => dq[k]?.size).map(([k, , label, color]) =>
        [k, { name: `external_debt_q_${k}_inr_crore`, label, color, data: qAxis.map((ym) => dq[k].get(ym) ?? null), unit: "INR_crore" }])),
    });
  }

  return tradeBundle;
}
