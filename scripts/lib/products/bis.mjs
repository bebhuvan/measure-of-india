// scripts/lib/products/bis.mjs: India in the statistics of the Bank for International Settlements.
//
// What BIS adds that RBI does not publish in this form: credit to households, companies and
// government as a share of GDP on one international definition (WS_TC), the credit-to-GDP gap
// (WS_CREDIT_GAP), the debt service ratio (WS_DSR), residential property prices on a common
// footing (WS_SPP, WS_DPP), foreign-currency credit to Indian borrowers (WS_GLI), and copies of
// the policy rate, effective exchange rates, the rupee-dollar rate and a long CPI that the
// rates and external guides use as cross-checks (RBI stays the source of record for those).
//
// Values: the owner's Data Bank (datasets bis_series, bis_daily), read through
// databankQuery(). The view can hold one observation per parse run; the SQL keeps the latest
// retrieval of each (dataflow, series_key, date). Catalogue: BIS's own series-key listing
// (scripts/lib/bis.mjs), run with `node scripts/lib/products/bis.mjs --catalogue`.
//
// Bundles (one geography each, CONTRACT-series rule 8):
//   bis-credit            India credit by borrower, % of GDP (quarterly, from 1951)
//   bis-credit-inr        the same in INR billions, break-adjusted and unadjusted
//   bis-credit-usd        the same in US$ billions
//   bis-credit-gap        credit-to-GDP ratio, its HP-filter trend and the gap
//   bis-dsr               debt service ratio, private non-financial sector
//   bis-property          residential property prices, nominal and real, index and y/y (BIS selected)
//   bis-property-cities   RBI's house price indices relayed by BIS, 2022-23 base: Delhi, Mumbai, 18 cities
//   bis-property-10cities RBI's 10-city index on the 2010-11 base (discontinued)
//   bis-gli               foreign-currency credit to Indian non-bank borrowers, levels and y/y
//   bis-eer, bis-eer-daily            nominal and real effective exchange rates (2020=100)
//   bis-policy-rate, bis-policy-rate-daily
//   bis-xru-monthly, bis-xru-quarterly, bis-xru-annual   rupees per US dollar
//   bis-cpi-long, bis-cpi-long-annual                     BIS long consumer price series
//   bis-peer-<iso3>       13 comparison economies: the same debt and house-price measures
//
// Hand check (2026-10-09): India private non-financial credit, Q1 2026, 105.1% of GDP
// (households 49.1, companies 56.0), government 83.5 (nominal value), total 188.6, as in the
// Data Bank's validation against the BIS bulk files (docs/BIS_SOURCES.md there) and on the BIS
// Data Portal page for WS_TC Q.IN.P.A.M.770.A. Credit gap Q1 2026: ratio 105.1, trend 100.8,
// gap 4.3 pp. See docs/reference/bis.md for the checks on each bundle.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";
import { databankRoot, databankQuery } from "../databank.mjs";
import { bisSeriesKeys } from "../bis.mjs";
import { writeSeries, writeRaw, writeJson } from "../util.mjs";

// The comparison set: the Data Bank's BIS peer list. BIS area code -> ISO3 (euro area: the
// World Bank's EMU aggregate code).
export const PEERS = { US: ["USA", "United States"], XM: ["EMU", "Euro area"], GB: ["GBR", "United Kingdom"], JP: ["JPN", "Japan"],
  CN: ["CHN", "China"], KR: ["KOR", "Korea"], ID: ["IDN", "Indonesia"], BR: ["BRA", "Brazil"], ZA: ["ZAF", "South Africa"],
  MX: ["MEX", "Mexico"], TR: ["TUR", "Türkiye"], AU: ["AUS", "Australia"], CA: ["CAN", "Canada"] };
// what each peer bundle carries: key -> [dataflow, key pattern with {A} for the area, label]
const PEER_SERIES = [
  ["households", "BIS:WS_TC", "Q.{A}.H.A.M.770.A", "Households, credit as % of GDP"],
  ["companies", "BIS:WS_TC", "Q.{A}.N.A.M.770.A", "Non-financial companies, credit as % of GDP"],
  ["government", "BIS:WS_TC", "Q.{A}.G.A.N.770.A", "Government, debt at nominal value as % of GDP"],
  ["private", "BIS:WS_TC", "Q.{A}.P.A.M.770.A", "Private non-financial sector, credit as % of GDP"],
  ["total", "BIS:WS_TC", "Q.{A}.C.A.M.770.A", "All non-financial borrowers, credit as % of GDP"],
  ["credit_gap", "BIS:WS_CREDIT_GAP", "Q.{A}.P.A.C", "Credit-to-GDP gap, percentage points"],
  ["dsr", "BIS:WS_DSR", "Q.{A}.P", "Debt service ratio, private non-financial sector, % of income"],
  ["real_house_prices_yoy", "BIS:WS_SPP", "Q.{A}.R.771", "Real residential property prices, % change on a year ago"],
];

const r = (v, d = 3) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);
const latestSql = (table, where) =>
  `select dataflow, series_key, date, period, value, obs_status, title, unit_measure, unit_label, unit_mult, source_retrieved_at from (select *, row_number() over (partition by dataflow, series_key, date order by source_retrieved_at desc) rn from ${table} where ${where}) where rn=1 order by dataflow, series_key, date`;

function readDatabank(db) {
  const india = databankQuery(db, "bis_series", latestSql("{table}", "ref_area='IN'"));
  const daily = databankQuery(db, "bis_daily", latestSql("{table}", "ref_area='IN'"));
  const peerKeys = Object.keys(PEERS).flatMap((a) => PEER_SERIES.map(([, flow, k]) => `'${flow}|${k.replace("{A}", a)}'`));
  const peers = databankQuery(db, "bis_series", latestSql("{table}", `dataflow || '|' || series_key in (${peerKeys.join(",")})`));
  return { india, daily, peers };
}

/** Map "flow|key" -> { meta, obs: Map(date -> value), status: Map(date -> obs_status) } */
function index(rows) {
  const m = new Map();
  for (const x of rows) {
    const k = `${x.dataflow}|${x.series_key}`;
    if (!m.has(k)) m.set(k, { title: x.title, unit: x.unit_measure, unitLabel: x.unit_label, mult: x.unit_mult, obs: new Map(), status: new Map() });
    const s = m.get(k);
    if (x.value != null && Number.isFinite(x.value)) s.obs.set(x.date, x.value);
    if (x.obs_status && x.obs_status !== "A") s.status.set(x.date, x.obs_status);
  }
  return m;
}

/** Axis from the union of the series' dates, stepping `step` months; nulls inside each series' span become gaps. */
function assemble(defs, S, { step, scale = 1, dp = 3 }) {
  const got = defs.map(([key, ref, label, extra]) => {
    const s = S.get(ref);
    if (!s || !s.obs.size) throw new Error(`bis: no data returned for ${ref} (${label})`);
    return { key, ref, label, extra, s };
  });
  const all = new Set(got.flatMap((g) => [...g.s.obs.keys()]));
  const sorted = [...all].sort();
  const dates = [];
  if (step) {
    let [y, m] = sorted[0].split("-").map(Number);
    const end = sorted.at(-1);
    for (;;) {
      const iso = `${y}-${String(m).padStart(2, "0")}-01`;
      dates.push(iso);
      if (iso >= end) break;
      m += step; while (m > 12) { m -= 12; y++; }
    }
  } else dates.push(...sorted);
  const series = {};
  for (const g of got) {
    const data = dates.map((d) => (g.s.obs.has(d) ? r(g.s.obs.get(d) * (g.extra?.scale ?? scale), g.extra?.dp ?? dp) : null));
    const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
    const breaks = [...g.s.status.entries()].filter(([, st]) => st === "B").map(([d]) => d);
    series[g.key] = { name: g.key, label: g.label, bis_key: g.ref.split("|")[1], ...(g.extra?.unit ? { unit: g.extra.unit } : {}), data,
      ...(gaps.length ? { gaps, gapsNote: "BIS publishes no value for these periods." } : {}),
      ...(breaks.length ? { breaks, breaksNote: "BIS flags a break in the series at these dates (OBS_STATUS B)." } : {}) };
  }
  return { dates, series };
}

export async function buildBis(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const { india, daily, peers } = readDatabank(db);
  if (india.rows.length < 5000) throw new Error(`bis: no data returned: only ${india.rows.length} India rows from bis_series (expected ~12,000)`);

  // ---------- the audit trail: every observation we read, compact ----------
  const compact = (res) => {
    const series = {}, obs = {};
    for (const x of res.rows) {
      const k = `${x.dataflow}|${x.series_key}`;
      series[k] ??= { title: x.title, unit_measure: x.unit_measure, unit_label: x.unit_label, unit_mult: x.unit_mult };
      (obs[k] ??= []).push([x.date, x.value, x.obs_status || "", x.source_retrieved_at]);
    }
    return { provenance: { dataset: res.provenance.dataset, sql: res.provenance.sql, rows: res.provenance.rows, sha256: res.provenance.sha256 }, series, obs };
  };
  const rawRel = "data/raw/bis-india.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "BIS statistics for India and 13 comparison economies, read from the owner's Data Bank (bis_series, bis_daily) with the latest retrieval of each observation. Rows: [date, value, obs_status, Data Bank retrieval time].",
    india: compact(india), daily: compact(daily), peers: compact(peers),
  });
  const V = JSON.parse(fs.readFileSync(path.join(root, rawRel), "utf8")).vintage;

  const I = index(india.rows), D = index(daily.rows), P = index(peers.rows);
  const meta = (extra) => ({ dossier: "bis", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", releaseDate: null,
    revisionPolicy: dcfg.revision_policy, ...extra });
  const write = (slug, assembled, extra) => {
    const { dates, series } = assembled;
    const lp = extra.frequency === "daily" ? dates.at(-1) : dates.at(-1).slice(0, extra.frequency === "annual" ? 4 : 7);
    writeSeries(root, `data/series/${slug}.json`, { meta: meta({ latestPeriod: lp, ...extra }), dates, series });
  };
  const TC = (k) => `BIS:WS_TC|Q.IN.${k}`;

  // ---------- total credit (WS_TC) ----------
  const SECT = [["total", "C.A.M", "All non-financial borrowers (households, companies, government)"],
    ["private", "P.A.M", "Private non-financial sector (households and companies)"],
    ["households", "H.A.M", "Households and non-profits serving them"],
    ["companies", "N.A.M", "Non-financial companies"],
    ["government", "G.A.N", "General government (debt at nominal value)"],
    ["private_banks", "P.B.M", "Private non-financial sector, credit from banks only"]];
  const notesTC = "BIS total credit statistics (WS_TC). Credit covers loans and debt securities from all lenders (domestic and foreign, banks and non-banks), break-adjusted by BIS; government debt is at nominal value, other borrowers at market value. Shares of GDP use BIS's four-quarter GDP.";
  write("bis-credit", assemble(SECT.map(([k, c, l]) => [k, TC(`${c}.770.A`), `${l}, % of GDP`]), I, { step: 3, dp: 1 }),
    { frequency: "quarterly", base: "% of GDP", unit: "pct_gdp", coverage: "Credit to India's non-financial borrowers by sector, % of GDP", note: notesTC });
  write("bis-credit-inr", assemble([
    ...SECT.map(([k, c, l]) => [k, TC(`${c}.XDC.A`), `${l}, ₹ billion`]),
    ...SECT.filter(([k]) => ["private", "households", "companies", "private_banks"].includes(k)).map(([k, c, l]) => [`${k}_unadjusted`, TC(`${c}.XDC.U`), `${l}, ₹ billion, not adjusted for breaks`]),
  ], I, { step: 3, dp: 3 }), { frequency: "quarterly", base: "INR billion, current prices", unit: "inr_bn", coverage: "Credit to India's non-financial borrowers by sector, ₹ billion, with and without BIS's break adjustment", note: notesTC + " Unadjusted series are as reported; BIS flags a break in households' unadjusted credit in Q1 2024." });
  write("bis-credit-usd", assemble(SECT.map(([k, c, l]) => [k, TC(`${c}.USD.A`), `${l}, US$ billion`]), I, { step: 3, dp: 3 }),
    { frequency: "quarterly", base: "USD billion, current prices", unit: "usd_bn", coverage: "Credit to India's non-financial borrowers by sector, US$ billion", note: notesTC + " Converted to US dollars by BIS at end-quarter exchange rates." });

  // ---------- credit gap, debt service ----------
  write("bis-credit-gap", assemble([
    ["ratio", "BIS:WS_CREDIT_GAP|Q.IN.P.A.A", "Credit to the private non-financial sector, % of GDP"],
    ["trend", "BIS:WS_CREDIT_GAP|Q.IN.P.A.B", "Long-run trend of the ratio (one-sided HP filter), % of GDP"],
    ["gap", "BIS:WS_CREDIT_GAP|Q.IN.P.A.C", "Credit-to-GDP gap: ratio minus trend, percentage points"],
  ], I, { step: 3, dp: 1 }), { frequency: "quarterly", base: "% of GDP", unit: "pct_gdp", coverage: "India's credit-to-GDP ratio, its trend and the gap", note: "BIS credit-to-GDP gaps (WS_CREDIT_GAP): the trend is a one-sided Hodrick-Prescott filter with a large smoothing parameter (400,000), so each quarter's trend uses only data up to that quarter. Gap = ratio minus trend (checked)." });
  write("bis-dsr", assemble([["private", "BIS:WS_DSR|Q.IN.P", "Debt service ratio, private non-financial sector, % of income"]], I, { step: 3, dp: 1 }),
    { frequency: "quarterly", base: "% of income", unit: "pct", coverage: "Share of income India's households and companies spend on interest and principal", note: "BIS debt service ratios (WS_DSR): interest payments plus amortisation divided by income, for the private non-financial sector as a whole. BIS publishes no household or company split for India." });

  // ---------- property prices ----------
  write("bis-property", assemble([
    ["nominal", "BIS:WS_SPP|Q.IN.N.628", "Residential property prices, nominal, index 2010 = 100"],
    ["real", "BIS:WS_SPP|Q.IN.R.628", "Residential property prices, real (deflated by CPI), index 2010 = 100"],
    ["nominal_yoy", "BIS:WS_SPP|Q.IN.N.771", "Residential property prices, nominal, % change on a year ago", { unit: "pct_yoy", dp: 2 }],
    ["real_yoy", "BIS:WS_SPP|Q.IN.R.771", "Residential property prices, real, % change on a year ago", { unit: "pct_yoy", dp: 2 }],
  ], I, { step: 3, dp: 2 }), { frequency: "quarterly", base: "2010=100", unit: "index", coverage: "India's residential property prices, nominal and real, BIS selected series", note: "BIS selected residential property price series (WS_SPP), compiled from the RBI's house price index and rebased by BIS to 2010 = 100; the real series is deflated by consumer prices. BIS links the RBI's successive city indices into this one series; that link is BIS's, not ours." });
  write("bis-property-cities", assemble([
    ["delhi", "BIS:WS_DPP|Q.IN.3.1.0.0.6.0", "Delhi, residential property price index"],
    ["mumbai", "BIS:WS_DPP|Q.IN.5.1.0.0.6.0", "Mumbai, residential property price index"],
    ["cities_18", "BIS:WS_DPP|Q.IN.6.1.0.0.6.0", "18 cities, residential property price index"],
  ], I, { step: 3, dp: 2 }), { frequency: "quarterly", base: "2022-23=100", unit: "index", coverage: "RBI house price indices for Delhi, Mumbai and the 18-city all-India composite, as relayed by BIS", note: "BIS detailed property prices (WS_DPP), compiler: Reserve Bank of India. Index 2022 Q2 to 2023 Q1 = 100. Delhi and Mumbai are carried back to 2010 on this base by the compiler; the 18-city composite starts in 2022." });
  write("bis-property-10cities", assemble([
    ["cities_10", "BIS:WS_DPP|Q.IN.4.1.0.0.6.0", "10 cities, residential property price index (discontinued)"],
  ], I, { step: 3, dp: 2 }), { frequency: "quarterly", base: "2010-11=100", unit: "index", coverage: "RBI's 10-city all-India house price index on the 2010-11 base, as relayed by BIS; discontinued", note: "BIS detailed property prices (WS_DPP), compiler: Reserve Bank of India. Index 2010 Q2 to 2011 Q1 = 100. Replaced by the 18-city index on the 2022-23 base; never joined to it." });

  // ---------- foreign-currency credit (global liquidity) ----------
  write("bis-gli", assemble([
    ["usd", "BIS:WS_GLI|Q.USD.IN.N.A.I.B.USD", "US dollar credit (bank loans and bonds) to Indian non-bank borrowers, US$ billion", { scale: 1e-3, unit: "usd_bn" }],
    ["usd_bank_loans", "BIS:WS_GLI|Q.USD.IN.N.B.I.G.USD", "US dollar bank loans to Indian non-bank borrowers, US$ billion", { scale: 1e-3, unit: "usd_bn" }],
    ["eur", "BIS:WS_GLI|Q.EUR.IN.N.A.I.B.EUR", "Euro credit to Indian non-bank borrowers, € billion", { scale: 1e-3, unit: "eur_bn" }],
    ["jpy", "BIS:WS_GLI|Q.JPY.IN.N.A.I.B.JPY", "Yen credit to Indian non-bank borrowers, ¥ billion", { scale: 1e-3, unit: "jpy_bn" }],
    ["usd_yoy", "BIS:WS_GLI|Q.USD.IN.N.A.I.B.771", "US dollar credit, % change on a year ago", { unit: "pct_yoy", dp: 2 }],
    ["eur_yoy", "BIS:WS_GLI|Q.EUR.IN.N.A.I.B.771", "Euro credit, % change on a year ago", { unit: "pct_yoy", dp: 2 }],
    ["jpy_yoy", "BIS:WS_GLI|Q.JPY.IN.N.A.I.B.771", "Yen credit, % change on a year ago", { unit: "pct_yoy", dp: 2 }],
  ], I, { step: 3, dp: 3 }), { frequency: "quarterly", base: "billions of the currency of denomination", unit: "mixed", coverage: "Foreign-currency credit to Indian non-bank borrowers: dollar, euro and yen", note: "BIS global liquidity indicators (WS_GLI): credit denominated in each currency, extended to non-banks located in India by banks anywhere and through international bonds. Levels converted from millions to billions." });

  // ---------- cross-check copies for other guides ----------
  write("bis-eer", assemble([
    ["neer", "BIS:WS_EER|M.N.B.IN", "Nominal effective exchange rate, broad basket (64 economies), 2020 = 100"],
    ["reer", "BIS:WS_EER|M.R.B.IN", "Real effective exchange rate, broad basket (64 economies), 2020 = 100"],
  ], I, { step: 1, dp: 2 }), { frequency: "monthly", base: "2020=100", unit: "index", coverage: "The rupee's nominal and real effective exchange rates, BIS broad basket", note: "BIS effective exchange rates (WS_EER), monthly averages. A rise means the rupee strengthened against the basket. RBI's 40-currency REER is the source of record; this is a cross-check." });
  write("bis-eer-daily", assemble([["neer", "BIS:WS_EER|D.N.B.IN", "Nominal effective exchange rate, broad basket, daily, 2020 = 100"]], D, { step: 0, dp: 2 }),
    { frequency: "daily", base: "2020=100", unit: "index", coverage: "The rupee's nominal effective exchange rate, daily", note: "BIS effective exchange rates (WS_EER), business days only. BIS publishes the daily series in nominal terms only." });
  write("bis-policy-rate", assemble([["policy_rate", "BIS:WS_CBPOL|M.IN", "RBI policy rate, end of month, per cent a year"]], I, { step: 1, dp: 2 }),
    { frequency: "monthly", base: "per cent a year", unit: "pct", coverage: "India's central bank policy rate, end of month, since 1946", note: "BIS central bank policy rates (WS_CBPOL). The series follows whichever rate the RBI used as its policy rate at the time (the bank rate in early decades, the repo rate later). BIS posts India with a lag. RBI is the source of record." });
  write("bis-policy-rate-daily", assemble([["policy_rate", "BIS:WS_CBPOL|D.IN", "RBI policy rate, rate in force each day, per cent a year"]], D, { step: 0, dp: 2 }),
    { frequency: "daily", base: "per cent a year", unit: "pct", coverage: "India's central bank policy rate, each day, since 1946", note: "BIS central bank policy rates (WS_CBPOL), the rate in force on each calendar day. RBI is the source of record." });
  for (const [f, freq, step] of [["M", "monthly", 1], ["Q", "quarterly", 3], ["A", "annual", 12]]) {
    write(`bis-xru-${freq}`, assemble([
      ["average", `BIS:WS_XRU|${f}.IN.INR.A`, `Rupees per US dollar, ${freq} average`],
      ["end_of_period", `BIS:WS_XRU|${f}.IN.INR.E`, `Rupees per US dollar, end of ${freq === "monthly" ? "month" : freq === "quarterly" ? "quarter" : "year"}`],
    ], I, { step, dp: 4 }), { frequency: freq, base: "INR per USD", unit: "inr_per_usd", coverage: `The rupee-dollar exchange rate, ${freq}, since 1957`, note: "BIS US dollar exchange rates (WS_XRU). RBI's reference rate is the source of record." });
  }
  write("bis-cpi-long", assemble([
    ["index", "BIS:WS_LONG_CPI|M.IN.628", "Consumer prices, BIS long series, index 2010 = 100"],
    ["yoy", "BIS:WS_LONG_CPI|M.IN.771", "Consumer prices, BIS long series, % change on a year ago", { unit: "pct_yoy" }],
  ], I, { step: 1, dp: 3 }), { frequency: "monthly", base: "2010=100", unit: "index", coverage: "A consumer price series for India since 1953, linked by BIS", note: "BIS long consumer price series (WS_LONG_CPI). BIS links India's successive consumer price indices into one series; the link is BIS's. MoSPI's CPI is the source of record for inflation." });
  write("bis-cpi-long-annual", assemble([
    ["index", "BIS:WS_LONG_CPI|A.IN.628", "Consumer prices, BIS long series, annual, index 2010 = 100"],
    ["yoy", "BIS:WS_LONG_CPI|A.IN.771", "Consumer prices, BIS long series, annual % change", { unit: "pct_yoy" }],
  ], I, { step: 12, dp: 3 }), { frequency: "annual", base: "2010=100", unit: "index", coverage: "A consumer price series for India since 1953, annual, linked by BIS", note: "BIS long consumer price series (WS_LONG_CPI), calendar-year values." });

  // ---------- peers: one bundle per economy ----------
  for (const [a, [iso3, name]] of Object.entries(PEERS)) {
    const defs = PEER_SERIES.map(([k, flow, pat, label]) => [k, `${flow}|${pat.replace("{A}", a)}`, label]).filter(([, ref]) => P.get(ref)?.obs.size);
    const missing = PEER_SERIES.filter(([k]) => !defs.some((d) => d[0] === k)).map(([k]) => k);
    const asm = assemble(defs, P, { step: 3, dp: 2 });
    writeSeries(root, `data/series/bis-peer-${iso3.toLowerCase()}.json`, {
      meta: meta({ geo: iso3, frequency: "quarterly", base: "% of GDP", unit: "mixed", latestPeriod: asm.dates.at(-1).slice(0, 7),
        coverage: `${name}: credit by borrower as % of GDP, credit gap, debt service ratio and real house prices, for comparison with India`,
        note: `BIS statistics for ${name} (${a}), the same definitions as India's bis-* bundles.${missing.length ? " Not published by BIS for this economy: " + missing.join(", ") + "." : ""}` }),
      dates: asm.dates, series: asm.series,
    });
  }
}

// ---------- the coverage catalogue: what BIS publishes for India ----------
const FLOWS = ["WS_TC", "WS_CREDIT_GAP", "WS_DSR", "WS_SPP", "WS_DPP", "WS_CPP", "WS_GLI", "WS_EER", "WS_CBPOL", "WS_XRU", "WS_LONG_CPI"];
const AREA = { WS_TC: "BORROWERS_CTY", WS_CREDIT_GAP: "BORROWERS_CTY", WS_DSR: "BORROWERS_CTY", WS_GLI: "BORROWERS_CTY" };
export async function catalogue(root, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const titles = new Map(databankQuery(db, "bis_series", "select distinct dataflow, series_key, title from {table} where ref_area='IN' order by 1,2").rows
    .map((x) => [`${x.dataflow.replace("BIS:", "")}|${x.series_key}`, x.title]));
  const items = [];
  for (const flow of FLOWS) {
    const { dims, keys } = await bisSeriesKeys(flow);
    const areaDim = AREA[flow] ?? "REF_AREA";
    const keyOf = (row) => dims.filter((d) => d !== "DATAFLOW").map((d) => row[d]).join(".");
    for (const row of keys) {
      const area = row[areaDim];
      const key = keyOf(row);
      const short = flow.replace(/^WS_/, "").toLowerCase();
      if (area === "IN") {
        items.push({ id: `bis:${short}:${key.toLowerCase().replace(/\./g, ":")}`, label: titles.get(`${flow}|${key}`) || `${flow} ${key}`, dims: { flow, key, freq: row.FREQ } });
      } else if (PEERS[area]) {
        // the comparison series we bake for each peer (PEER_SERIES); the rest of the world is not India's to list
        const hit = PEER_SERIES.find(([, f, pat]) => f === `BIS:${flow}` && pat.replace("{A}", area) === key);
        if (hit) items.push({ id: `bis:peer:${PEERS[area][0].toLowerCase()}:${hit[0]}`, label: `${PEERS[area][1]}: ${hit[3]}`, dims: { flow, key, freq: row.FREQ, geo: PEERS[area][0] } });
      }
    }
  }
  items.sort((a, b) => (a.id < b.id ? -1 : 1));
  writeJson(root, "data/coverage/bis.catalogue.json", {
    family: "bis",
    source: "Bank for International Settlements, statistics API (stats.bis.org), series-key listings",
    generator: "node scripts/lib/products/bis.mjs --catalogue",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "Every series BIS lists for India (area IN) in the eleven dataflows the Data Bank mirrors, plus the comparison series baked for 13 peer economies.",
    items,
  });
  console.log(`bis catalogue: ${items.length} items`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes("--catalogue")) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
  await catalogue(ROOT, cfg);
}
