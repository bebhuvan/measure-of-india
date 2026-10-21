// scripts/lib/products/npci.mjs: UPI and the other networks the National Payments Corporation of
// India (NPCI) runs, from NPCI's own statistics. Read-only from the local Data Bank, which captures
// the JSON API behind NPCI's statistics pages (its connector src/databank/connectors/npci.py and
// its notes docs/NPCI_SOURCES.md). Three Data Bank datasets, each read from its latest validated
// warehouse publication (databankWarehouse), so no observation repeats across parse runs:
//
//   npci_product_statistics  each product's monthly table: UPI, BHIM, IMPS, NETC (FASTag), AePS,
//                            NACH credit and debit by sub-product, NACH mandates (MMS), CTS
//                            cheque grids, e-RUPI vouchers
//   npci_upi_ecosystem       UPI by merchant category (MCC), other merchant segments, person-to-
//                            person and person-to-merchant, by app, by state and district
//   npci_daily_statistics    daily volume and value for UPI, IMPS, NETC, AePS (three tabs), CTS,
//                            NFS (the ATM network) and NACH (APBS, credit, debit), from May 2021
//
// Units. NPCI prints volumes in million (CTS in lakh) and values in ₹ crore (CTS in ₹ lakh, NACH
// in rupees and plain counts). Bundles store plain counts and rupees, like the RBI's payments
// bundles, so the two families read on one scale; every conversion is a power of ten applied to
// NPCI's printed figure and rounded to a whole number (NPCI's figures carry at most six decimals
// of a million, so nothing is lost). Percentages are kept as printed.
//
// Rulers kept apart (AGENTS.md rule 1, sources.yml seams):
//   - BHIM: to March 2020 NPCI counted payments started in the BHIM app; from April 2020 payments
//     where BHIM was the payer's app. Two bundles.
//   - CTS: three regional cheque grids (April 2021 to October 2023) and one national grid
//     (November 2023 on). Two bundles; the grids are not summed into a national line.
//   - UPI apps: June to November 2020 the tab served a different table (bank-wise inward volume),
//     so apps start in December 2020.
//   - MCC: the table answers back to July 2016 but every month to November 2016 is a template of
//     zeros with a handful of tiny values; the bundle starts in December 2016, the first month
//     with a non-zero total.
//
// Hand check (one value per bundle family against NPCI's own figure), recorded 2026-10-20 from
// the Data Bank's capture of 11 October 2026:
//   npci-upi        September 2026: 24,068.38 million transactions, ₹29,37,396.67 crore
//                   (product-statistics-upi, year_range 2026-27); the same month's P2P + P2M
//                   total in the ecosystem table is 24,068.38 million and ₹29,37,396.67 crore.
//   npci-upi-states Maharashtra, September 2026: 2,364.509006 million, 9.82% of volume.
// The rest are checked by identity in validate.mjs (parts add to totals, days add to months,
// NPCI's UPI against the RBI's payment system table).
import { databankRoot, databankWarehouse } from "../databank.mjs";
import { writeSeries, writeRaw } from "../util.mjs";
import { APP_NAME } from "./npci-names.mjs";

const ACCENT = "#2E4BD8", GREY = "#878D99";
const month = (iso) => iso.slice(0, 7) + "-01";                    // "2026-09-30" -> "2026-09-01"
const months = (from, to) => { const out = []; let [y, m] = from.split("-").map(Number); for (;;) { const d = `${y}-${String(m).padStart(2, "0")}-01`; if (d > to) break; out.push(d); m++; if (m > 12) { m = 1; y++; } } return out; };
const days = (from, to) => { const out = []; for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
// NPCI's printed unit -> the stored unit, by a power of ten
const SCALE = { million: [1e6, "count"], lakh: [1e5, "count"], count: [1, "count"], inr_crore: [1e7, "inr_amount"], inr_lakh: [1e5, "inr_amount"], inr: [1, "inr_amount"], percent: [1, "percent"] };
const conv = (v, unit) => {
  const s = SCALE[unit]; if (!s) throw new Error(`npci: no conversion for NPCI unit "${unit}"`);
  if (v == null) return null;
  return s[1] === "percent" ? Math.round(v * 100) / 100 : s[1] === "inr_amount" && unit === "inr" ? Math.round(v * 100) / 100 : Math.round(v * s[0]);
};
const slugOf = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const tidy = (s) => String(s ?? "").replace(/\s*#\s*$/, "").replace(/\s+/g, " ").trim();
const title = (s) => tidy(s).toLowerCase().replace(/(^|[\s(/-])([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/\bAnd\b/g, "and").replace(/\bOf\b/g, "of");

// NPCI's state codes (the Data Bank's slugs of NPCI's labels) -> display name and tile-map code
export const NPCI_STATES = {
  andaman_and_nicobar_islands: ["Andaman and Nicobar Islands", "AN"], andhra_pradesh: ["Andhra Pradesh", "AP"], arunachal_pradesh: ["Arunachal Pradesh", "AR"],
  assam: ["Assam", "AS"], bihar: ["Bihar", "BR"], chandigarh: ["Chandigarh", "CH"], chhattisgarh: ["Chhattisgarh", "CG"],
  dnh_and_dd: ["Dadra and Nagar Haveli and Daman and Diu", "DH"], delhi: ["Delhi", "DL"], goa: ["Goa", "GA"], gujarat: ["Gujarat", "GJ"],
  haryana: ["Haryana", "HR"], himachal_pradesh: ["Himachal Pradesh", "HP"], jammu_and_kashmir: ["Jammu and Kashmir", "JK"], jharkhand: ["Jharkhand", "JH"],
  karnataka: ["Karnataka", "KA"], kerala: ["Kerala", "KL"], ladakh: ["Ladakh", "LA"], lakshadweep: ["Lakshadweep", "LD"],
  madhya_pradesh: ["Madhya Pradesh", "MP"], maharashtra: ["Maharashtra", "MH"], manipur: ["Manipur", "MN"], meghalaya: ["Meghalaya", "ML"],
  mizoram: ["Mizoram", "MZ"], nagaland: ["Nagaland", "NL"], odisha: ["Odisha", "OD"], puducherry: ["Puducherry", "PY"], punjab: ["Punjab", "PB"],
  rajasthan: ["Rajasthan", "RJ"], sikkim: ["Sikkim", "SK"], tamil_nadu: ["Tamil Nadu", "TN"], telangana: ["Telangana", "TS"], tripura: ["Tripura", "TR"],
  uttar_pradesh: ["Uttar Pradesh", "UP"], uttarakhand: ["Uttarakhand", "UK"], west_bengal: ["West Bengal", "WB"],
};
// e-RUPI: NPCI spells some issuing banks three ways in different months ("HDFC", "HDFC Bank",
// "HDFC Bank Ltd"). The same bank, never two spellings in one month (asserted below).
const ERUPI_ALIAS = { hdfc: "hdfc_bank", hdfc_bank_ltd: "hdfc_bank", icici_bank_ltd: "icici_bank", yes_bank_ltd: "yes_bank" };
// apps: NPCI printed the Paytm app as "Paytm" in some 2024 months and "Paytm (OCL)" (One97
// Communications, the company behind it) in the others; one app, never both in a month (cellsOf
// fails on a second value for a month)
const APP_ALIAS = { paytmocl: "paytm" };
// segments: NPCI printed "Total" for "Grand Total" in one month (asserted never both)
const SEGMENT_ALIAS = { total: "grand_total" };

export async function buildNpci(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const P = databankWarehouse(db, "npci_product_statistics",
    "SELECT date, product, tab, tab_label, row_code, row_label, metric, metric_label, unit, value, period_label, note, source_url, source_sha, source_retrieved_at FROM {table} ORDER BY product, tab, row_code, metric, date");
  const E = databankWarehouse(db, "npci_upi_ecosystem",
    "SELECT date, table_code, table_label, group_code, group_label, row_code, row_label, row_type, metric, metric_label, unit, value, source_url, source_sha, source_retrieved_at FROM {table} ORDER BY table_code, group_code, row_code, metric, date");
  const DL = databankWarehouse(db, "npci_daily_statistics",
    "SELECT date, frequency, row_type, product, tab, tab_label, metric, metric_label, unit, value, note, source_url, source_sha, source_retrieved_at FROM {table} ORDER BY tab, metric, frequency, date");

  // ---------- the audit trail: every row read, column-wise compact ----------
  const pack = (q) => { const cols = Object.keys(q.rows[0] ?? {}); return { provenance: q.provenance, columns: cols, rows: q.rows.map((r) => cols.map((c) => r[c])) }; };
  const rawRel = "data/raw/npci.json";
  // NPCI prints no revision date and edits rows in place, so the data vintage is declared unknown
  // (CONTRACT-series, unpublished revision dates); the Data Bank's capture date is kept apart as
  // archiveCapturedDate, never borrowed as the vintage (AGENTS.md rule 5)
  const retrieved = [P, E, DL].flatMap((q) => q.rows.map((r) => r.source_retrieved_at)).sort().at(-1).slice(0, 10);
  writeRaw(root, rawRel, {
    vintage: null, archiveCapturedDate: retrieved,
    note: "NPCI product, UPI ecosystem and daily statistics as captured by the local Data Bank from the JSON API behind www.npci.org.in (latest validated warehouse publication of each dataset). Values in NPCI's printed units (column unit); source_url is the exact API request and source_sha the raw response's SHA-256 in the Data Bank.",
    datasets: { npci_product_statistics: pack(P), npci_upi_ecosystem: pack(E), npci_daily_statistics: pack(DL) },
  });
  const meta = (extra) => ({ dossier: "npci", source: dcfg.source_agency, vintage: null, vintageStatus: "unknown",
    vintageNote: "NPCI publishes no revision date for its statistics and edits past rows in place without notice; these are its tables as the Data Bank captured them on the archiveCapturedDate.", mock: false, geo: "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy, archiveCapturedDate: retrieved, ...extra });

  // a bundle: axis trimmed to where any series reports, interior nulls declared on the series
  const bundle = (rel, dates, series, extra, gapsNote = "NPCI's table prints no value for this line in these months; left empty.") => {
    const any = (i) => Object.values(series).some((s) => s.data[i] != null);
    let a = 0; while (a < dates.length && !any(a)) a++;
    let z = dates.length - 1; while (z > a && !any(z)) z--;
    for (const [k, s] of Object.entries(series)) {
      s.data = s.data.slice(a, z + 1);
      if (!s.data.some((v) => v != null)) { delete series[k]; continue; }
      const ds = dates.slice(a, z + 1), f = s.data.findIndex((v) => v != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      const gaps = s.data.map((v, i) => (v == null && i > f && i < l ? ds[i] : null)).filter(Boolean);
      if (gaps.length) { s.gaps = gaps; s.gapsNote ??= gapsNote; } else { delete s.gaps; delete s.gapsNote; }
    }
    const D = dates.slice(a, z + 1);
    const daily = extra.frequency === "daily";
    writeSeries(root, `data/series/${rel}.json`, { meta: meta({ latestPeriod: daily ? D.at(-1) : D.at(-1).slice(0, 7), ...(daily ? { periodLabelMode: "source-date" } : {}), ...extra }), dates: D, series });
    return { dates: D, series };
  };

  // ---------- index ----------
  // product statistics: product|tab|row|metric -> Map(month -> value), with NPCI's unit and label
  const cellsOf = (rows, keyOf, dateOf = (r) => month(r.date)) => {
    const out = new Map();
    for (const r of rows) {
      const k = keyOf(r); let e = out.get(k);
      if (!e) out.set(k, (e = { unit: r.unit, label: r.metric_label, rowLabel: r.row_label, groupLabel: r.group_label, v: new Map() }));
      if (e.unit !== r.unit) throw new Error(`npci: ${k} mixes units (${e.unit}, ${r.unit})`);
      const d = dateOf(r);
      if (e.v.has(d)) throw new Error(`npci: ${k} has two values for ${d} in one warehouse publication`);
      e.v.set(d, r.value);
    }
    return out;
  };
  const prod = cellsOf(P.rows, (r) => `${r.product}|${r.tab}|${r.row_code}|${r.metric}`);
  const get = (k) => { const e = prod.get(k); if (!e) throw new Error(`npci: product statistics have no ${k}`); return e; };
  const span = (cells) => { const ds = [...cells.values()].flatMap((e) => [...e.v.keys()]).sort(); return [ds[0], ds.at(-1)]; };
  const line = (e, axis, name, label, group, color = GREY) => {
    const [, unit] = SCALE[e.unit];
    return { name, label, unit, group, color, sourceLabel: e.label, data: axis.map((d) => conv(e.v.get(d) ?? null, e.unit)) };
  };

  // anchor: the source must have served UPI's latest month, in a plausible range
  const upiVol = get("upi|product-statistics-upi|all|volume_in_mn");
  const lastUpi = [...upiVol.v.keys()].sort().at(-1);
  if (!lastUpi || !(upiVol.v.get(lastUpi) > 5000 && upiVol.v.get(lastUpi) < 200000)) throw new Error(`npci: no data returned: UPI volume for the latest month (${lastUpi}: ${upiVol.v.get(lastUpi)} million)`);

  // every product table read is mapped below; a new tab or metric fails until it is named here
  const READ_TABS = new Set(["upi|product-statistics-upi", "bhim|product-statistics-bhim", "imps|product-statistics-imps", "netc|netc-fas-tag-statistics", "aeps|aeps",
    "nach|nach-credit", "nach|nach-debit", "nach|mms", "cts|national-grid", "cts|northern-grid", "cts|southern-grid", "cts|western-grid", "e-rupi|e-rupi"]);
  for (const k of prod.keys()) if (!READ_TABS.has(k.split("|").slice(0, 2).join("|"))) throw new Error(`npci: product tab ${k} is not mapped`);

  // ---------- UPI, the monthly table ----------
  {
    const M = months("2016-04-01", month(lastUpi));
    const s = {
      volume: line(upiVol, M, "volume", "UPI, number of transactions", "UPI", ACCENT),
      value: line(get("upi|product-statistics-upi|all|value_in_cr"), M, "value", "UPI, value of transactions", "UPI", ACCENT),
      banks_live: line(get("upi|product-statistics-upi|all|no_of_banks_live_on_upi"), M, "banks_live", "Banks live on UPI", "UPI"),
    };
    bundle("npci-upi", M, s, { frequency: "monthly", base: "NPCI UPI product statistics (from April 2016)", unit: "mixed",
      coverage: "UPI each month since it opened in April 2016: number of transactions, their value and the number of banks live on UPI",
      sourceTitle: "NPCI, UPI product statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/product-statistics",
      note: "NPCI's UPI monthly table, as printed in million transactions and ₹ crore, stored here as counts and rupees. April to June 2016 print 0.00 million (a few hundred to a few thousand transactions in the RBI's count). NPCI revises past months in place; this is the table as captured." });
  }

  // ---------- BHIM, two definitions ----------
  {
    const k = (m) => get(`bhim|product-statistics-bhim|all|${m}`);
    const [b0, b1] = span(new Map([["v", k("volume_in_mn")]]));
    const mk = (axis) => ({
      volume: line(k("volume_in_mn"), axis, "volume", "BHIM app, number of transactions", "BHIM", ACCENT),
      value: line(k("value_in_cr"), axis, "value", "BHIM app, value of transactions", "BHIM", ACCENT),
      banks_live: line(k("no_of_banks_live_on_bhim"), axis, "banks_live", "Banks live on BHIM", "BHIM"),
    });
    const OLD = months(month(b0), "2020-03-01"), NEW = months("2020-04-01", month(b1));
    bundle("npci-bhim-2016", OLD, mk(OLD), { frequency: "monthly", base: "BHIM as the app that started the payment (December 2016 to March 2020)", unit: "mixed",
      coverage: "NPCI's own BHIM app, December 2016 to March 2020, counting payments started in BHIM",
      sourceTitle: "NPCI, BHIM product statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/bhim/product-statistics",
      note: "Until March 2020 NPCI counted transactions initiated in the BHIM app; from April 2020 it counts transactions where BHIM is the payer's app. The two are different rulers and are kept apart." });
    bundle("npci-bhim", NEW, mk(NEW), { frequency: "monthly", base: "BHIM as the payer's app (from April 2020)", unit: "mixed",
      coverage: "NPCI's own BHIM app since April 2020, counting payments where BHIM was the payer's app",
      sourceTitle: "NPCI, BHIM product statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/bhim/product-statistics",
      note: "From April 2020 NPCI counts transactions where BHIM is the payer's app; the earlier table counted transactions initiated in BHIM and is a separate bundle (npci-bhim-2016)." });
  }

  // ---------- IMPS ----------
  {
    const k = (m) => get(`imps|product-statistics-imps|all|${m}`);
    const [a, z] = span(new Map([["v", k("volume_in_mn")]]));
    const M = months(month(a), month(z));
    bundle("npci-imps", M, {
      volume: line(k("volume_in_mn"), M, "volume", "IMPS, number of transactions", "IMPS", ACCENT),
      value: line(k("value_in_cr"), M, "value", "IMPS, value of transactions", "IMPS", ACCENT),
      member_banks: line(k("no_of_member_banks"), M, "member_banks", "Member banks on IMPS", "IMPS"),
    }, { frequency: "monthly", base: "NPCI IMPS product statistics", unit: "mixed",
      coverage: "IMPS, the instant bank transfer that predates UPI, each month since September 2013: number, value and member banks",
      sourceTitle: "NPCI, IMPS product statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/imps/product-statistics",
      note: "NPCI's IMPS monthly table, printed in million and ₹ crore, stored as counts and rupees." });
  }

  // ---------- NETC FASTag ----------
  {
    const k = (m) => get(`netc|netc-fas-tag-statistics|all|${m}`);
    const [a, z] = span(new Map([["t", k("tag_issuance_in_nos")]]));
    const M = months(month(a), month(z));
    bundle("npci-netc", M, {
      volume: line(k("volume_in_mn"), M, "volume", "FASTag, toll and parking transactions", "FASTag", ACCENT),
      value: line(k("amount_in_cr"), M, "value", "FASTag, amount paid at tolls and parking", "FASTag", ACCENT),
      annual_pass_volume: line(k("annual_pass_volume_in_mn"), M, "annual_pass_volume", "FASTag, trips on the annual pass (from August 2025)", "FASTag"),
      tags_issued: line(k("tag_issuance_in_nos"), M, "tags_issued", "FASTags issued, cumulative", "FASTag"),
      banks_live: line(k("no_of_banks_live_on_netc"), M, "banks_live", "Banks live on NETC", "FASTag"),
    }, { frequency: "monthly", base: "NPCI NETC FASTag statistics", unit: "mixed",
      coverage: "FASTag (NETC) each month since November 2016: toll and parking transactions and their amount, trips on the annual pass, tags issued and banks live",
      sourceTitle: "NPCI, NETC FASTag statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/netc-fastag/product-statistics",
      note: "Transactions are toll and parking payments. Trips on the annual pass (from 15 August 2025) are printed in their own column and are not in the transaction count; NPCI's note says total trips are the sum. Tags issued are cumulative. Trips exempted for electric vehicles in Maharashtra are excluded throughout." });
  }

  // ---------- AePS ----------
  {
    const A = [["total_approved_transaction_in_mn", "total", "AePS, all approved transactions (off-us, on-us and BHIM Aadhaar Pay)", ACCENT],
      ["approved_offus_transaction_in_mn", "offus_volume", "AePS, approved off-us transactions (customer and agent at different banks)"],
      ["approved_offus_value_in_crores", "offus_value", "AePS, value of approved off-us transactions"],
      ["approved_onus_transaction_in_mn", "onus_volume", "AePS, approved on-us transactions (customer and agent at the same bank)"],
      ["approved_bhim_aadhaar_pay_transaction_in_mn", "bhim_aadhaar_pay_volume", "BHIM Aadhaar Pay, approved transactions (paying a shop by fingerprint)"],
      ["approved_bhim_aadhaar_pay_value_in_crores", "bhim_aadhaar_pay_value", "BHIM Aadhaar Pay, value of approved transactions"],
      ["successful_ekyc_in_mn", "ekyc", "Aadhaar eKYC, successful (identity checks to open accounts and the like)"],
      ["approved_demo_auth_authenticated_in_mn", "demo_auth", "Aadhaar demographic authentication, approved"]];
    const [a, z] = span(new Map([["t", get("aeps|aeps|all|total_approved_transaction_in_mn")]]));
    const M = months(month(a), month(z));
    const s = Object.fromEntries(A.map(([m, key, label, color]) => [key, line(get(`aeps|aeps|all|${m}`), M, key, label, "AePS", color)]));
    bundle("npci-aeps", M, s, { frequency: "monthly", base: "NPCI AePS product statistics", unit: "mixed",
      coverage: "Aadhaar-enabled payments each month since April 2017: cash withdrawals, deposits and transfers at banking agents (off-us and on-us), BHIM Aadhaar Pay at shops, eKYC and demographic checks",
      sourceTitle: "NPCI, AePS product statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/aeps/product-statistics",
      note: "NPCI prints the value only for off-us transactions and BHIM Aadhaar Pay; on-us transactions are counted without a value. Kept as printed: February 2023's total differs from its parts, and in December 2024 and January 2025 NPCI's total leaves BHIM Aadhaar Pay out." });
  }

  // ---------- NACH: credit and debit by sub-product, and mandates ----------
  const NACH_ROWS = {
    apbs__dbt: ["APBS, direct benefit transfers (subsidies and benefits by Aadhaar number)", "Credit: APBS"],
    apbs__dbt_lpg: ["APBS, LPG subsidy (DBTL)", "Credit: APBS"],
    apbs__other_credits: ["APBS, other credits", "Credit: APBS"],
    credit_306__dbt: ["NACH credit, direct benefit transfers by account number", "Credit: NACH"],
    credit_306__dbt_lpg: ["NACH credit, LPG subsidy by account number", "Credit: NACH"],
    credit_306__other_credits: ["NACH credit, other credits (salaries, pensions, dividends, interest)", "Credit: NACH"],
    credit_156__other_credits: ["NACH credit, other credits on NPCI's older (156-character) file format", "Credit: NACH"],
    total_credit: ["NACH and APBS credit, total", "Credit: total"],
    debit_306__recurring_payments: ["NACH debit, recurring payments (EMIs, SIPs, insurance premiums, bills)", "Debit"],
    debit_156__recurring_payments: ["NACH debit, recurring payments on the older (156-character) file format", "Debit"],
    total_debit: ["NACH debit, total", "Debit"],
    total_nach_credit_and_debit: ["NACH and APBS, credit and debit together", "Credit and debit"],
  };
  const NACH_M = { presentation_volume: ["presented", "count"], presentation_value: ["presented_value", "inr"], returns_volume: ["returned", "count"], returns_value: ["returned_value", "inr"],
    sucessful_transactions_volume: ["successful", "count"], sucessful_transactions_value: ["successful_value", "inr"] };
  const nachBundle = (tab, rel, base, coverage, url, note) => {
    const keys = [...prod.keys()].filter((k) => k.startsWith(`nach|${tab}|`));
    const [a, z] = span(new Map(keys.map((k) => [k, prod.get(k)])));
    const M = months(month(a), month(z)), s = {};
    for (const k of keys) {
      const [, , row, metric] = k.split("|");
      if (!NACH_ROWS[row]) throw new Error(`npci: NACH row ${row} is not mapped`);
      if (!NACH_M[metric]) throw new Error(`npci: NACH metric ${metric} is not mapped`);
      const [lab, group] = NACH_ROWS[row], [mk] = NACH_M[metric];
      const what = { presented: "presented (number)", presented_value: "presented (value)", returned: "returned unpaid (number)", returned_value: "returned unpaid (value)", successful: "successful (number)", successful_value: "successful (value)" }[mk];
      s[`${row}__${mk}`] = line(prod.get(k), M, `${row}__${mk}`, `${lab}, ${what}`, group, /^total/.test(row) && mk === "presented" ? ACCENT : GREY);
    }
    return bundle(rel, M, s, { frequency: "monthly", base, unit: "mixed", coverage, sourceUrl: url, sourceTitle: `NPCI, ${tab === "nach-credit" ? "NACH credit" : "NACH debit"} (monthly)`, note });
  };
  nachBundle("nach-credit", "npci-nach-credit", "NPCI NACH product statistics", "Bulk credits through NACH each month since April 2013, by product: subsidies and benefits sent by Aadhaar number (APBS), and salary, pension, dividend and benefit credits sent by account number; presented, returned and successful, number and value",
    "https://www.npci.org.in/what-we-do/nach/product-statistics",
    "NPCI's NACH credit table, by product and sub-product, counts and rupees as printed. Rows NPCI misfiled under mistyped years in 2026 and three rows shifted one column (NACH-306 DBT January 2022, the Total Credit row October 2022) are rejected by the Data Bank and are gaps here. Presented = returned + successful is checked in validate, with NPCI's own arithmetic slips (2013-07, 2014-09, 2016-03, 2020-10, 2022-09) kept as printed.");
  nachBundle("nach-debit", "npci-nach-debit", "NPCI NACH product statistics", "Recurring debits through NACH each month since July 2013 (EMIs, SIPs, insurance premiums, bills paid by mandate): presented, returned unpaid and successful, number and value; with NPCI's total of credit and debit together",
    "https://www.npci.org.in/what-we-do/nach/product-statistics",
    "NPCI's NACH debit table, counts and rupees as printed. The 156-character file format ran beside the 306-character one from April 2015 to July 2019. NPCI's 'Total volume' row for credit and debit together is printed on the debit tab and kept as a line of its own. A debit 'returned' is one the payer's bank sent back unpaid (in most cases for want of balance).");
  {
    const k = (m) => get(`nach|mms|all|${m}`);
    const [a, z] = span(new Map([["t", k("mandates_processed")]]));
    const M = months(month(a), month(z));
    bundle("npci-nach-mandates", M, {
      processed: line(k("mandates_processed"), M, "processed", "NACH mandates processed", "Mandates", ACCENT),
      accepted: line(k("accepted"), M, "accepted", "NACH mandates accepted", "Mandates"),
      rejected: line(k("rejected"), M, "rejected", "NACH mandates rejected", "Mandates"),
    }, { frequency: "monthly", base: "NPCI NACH mandate management (MMS)", unit: "count",
      coverage: "NACH mandates each month since April 2017: the standing instructions that let a lender, fund or insurer debit an account, processed, accepted and rejected",
      sourceTitle: "NPCI, NACH mandate management system (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/nach/product-statistics",
      note: "NPCI's MMS table, counts as printed. February 2021 is not in NPCI's table. February 2023's processed figure is not the sum of accepted and rejected; kept as printed." });
  }

  // ---------- CTS: three grids, then one ----------
  {
    const CTSM = { presentment_cheque_volume_in_lakhs: ["presented", "Cheques presented (number)"], presentment_cheque_value_inr_lakhs: ["presented_value", "Cheques presented (value)"],
      return_cheque_volume_in_lakhs: ["returned", "Cheques returned (number)"], return_cheque_value_inr_lakhs: ["returned_value", "Cheques returned (value)"],
      return_cheques_as_of_total_presentment_cheque_volume: ["return_rate", "Cheques returned, % of cheques presented (as printed)"] };
    const grid = (g) => { const keys = [...prod.keys()].filter((k) => k.startsWith(`cts|${g}|`)); for (const k of keys) if (!CTSM[k.split("|")[3]]) throw new Error(`npci: CTS metric ${k} is not mapped`); return keys; };
    const GR = { northern: "Northern grid (New Delhi)", southern: "Southern grid (Chennai)", western: "Western grid (Mumbai)" };
    const gk = Object.keys(GR).flatMap((g) => grid(`${g}-grid`));
    const [a, z] = span(new Map(gk.map((k) => [k, prod.get(k)])));
    const M = months(month(a), month(z)), s = {};
    for (const k of gk) { const [, tab, , m] = k.split("|"), g = tab.replace("-grid", ""), [mk, lab] = CTSM[m];
      s[`${g}__${mk}`] = line(prod.get(k), M, `${g}__${mk}`, `${GR[g]}: ${lab.toLowerCase()}`, GR[g], mk === "presented" ? ACCENT : GREY); }
    bundle("npci-cts-grids", M, s, { frequency: "monthly", base: "CTS regional grids (April 2021 to October 2023)", unit: "mixed",
      coverage: "Cheques cleared through the Cheque Truncation System's three regional grids, April 2021 to October 2023: presented and returned, number and value, and the share returned",
      sourceTitle: "NPCI, CTS grid statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/cts/product-statistics",
      note: "NPCI printed one table per grid until the grids were merged into a national grid. The northern grid's table ends in June 2023 and misses January to March 2023 at source. The grids are different coverage and are not summed here into a national figure. Volumes printed in lakh and values in ₹ lakh, stored as counts and rupees." });
    const nk = grid("national-grid");
    const [na, nz] = span(new Map(nk.map((k) => [k, prod.get(k)])));
    const NM = months(month(na), month(nz)), ns = {};
    for (const k of nk) { const [mk, lab] = CTSM[k.split("|")[3]]; ns[mk] = line(prod.get(k), NM, mk, `National grid: ${lab.toLowerCase()}`, "National grid", mk === "presented" ? ACCENT : GREY); }
    bundle("npci-cts", NM, ns, { frequency: "monthly", base: "CTS national grid (from November 2023)", unit: "mixed",
      coverage: "Cheques cleared through the Cheque Truncation System's single national grid since November 2023: presented and returned, number and value, and the share returned",
      sourceTitle: "NPCI, CTS national grid statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/cts/product-statistics",
      note: "Volumes printed in lakh and values in ₹ lakh, stored as counts and rupees. The return rate is NPCI's printed percentage." });
  }

  // ---------- e-RUPI vouchers ----------
  {
    const keys = [...prod.keys()].filter((k) => k.startsWith("e-rupi|"));
    const [a, z] = span(new Map(keys.map((k) => [k, prod.get(k)])));
    const M = months(month(a), month(z)), merged = new Map();
    for (const k of keys) {
      const [, , row, metric] = k.split("|"), code = ERUPI_ALIAS[row] ?? row, e = prod.get(k);
      const mk = { voucher_created_volume: "created", voucher_redeemed_volume: "redeemed" }[metric];
      if (!mk) throw new Error(`npci: e-RUPI metric ${metric} is not mapped`);
      const key = `${code}__${mk}`, m = merged.get(key) ?? { e, label: e.rowLabel, rows: [], v: new Map() };
      for (const [d, v] of e.v) { if (m.v.has(d)) throw new Error(`npci: e-RUPI ${code} has two spellings in ${d}`); m.v.set(d, v); }
      m.rows.push(row); merged.set(key, m);
    }
    const bankEra = (code) => /bank|hdfc|icici/.test(code) && !/voucher|program|subsidy|vishwakarma/.test(code);
    const s = {};
    for (const [key, m] of [...merged].sort(([p], [q]) => p.localeCompare(q))) {
      const [code, mk] = key.split("__");
      const group = code === "total" ? "Total (to December 2023)" : bankEra(code) ? "Issuing bank (from January 2024)" : "Use case (to December 2023)";
      s[key] = { name: key, label: `${code === "total" ? "All vouchers" : title(m.label)}, vouchers ${mk}`, unit: "count", group, color: code === "total" ? ACCENT : GREY,
        sourceLabel: m.rows.join(", "), data: M.map((d) => conv(m.v.get(d) ?? null, "count")) };
    }
    bundle("npci-erupi", M, s, { frequency: "monthly", base: "NPCI e-RUPI statistics", unit: "count",
      coverage: "e-RUPI, prepaid single-purpose vouchers redeemed by a QR code or SMS, each month since September 2022: vouchers created and redeemed, by government scheme to December 2023 and by issuing bank from January 2024",
      sourceTitle: "NPCI, e-RUPI statistics (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/e-rupi/product-statistics",
      note: "NPCI's rows change meaning: government voucher schemes and a total to December 2023, issuing banks from January 2024 with no total. Spellings of one bank in different months (HDFC, HDFC Bank, HDFC Bank Ltd; ICICI Bank, ICICI Bank Ltd; Yes Bank, Yes Bank Ltd) are one line here; the original spellings are in sourceLabel. February 2024 repeats January 2024 for every bank but one; kept as printed. One July 2023 cell NPCI's spreadsheet turned into a date is left out by the Data Bank.",
    }, "NPCI's table lists this scheme or bank only in some months; left empty.");
  }

  // ---------- UPI ecosystem ----------
  const eco = (t) => E.rows.filter((r) => r.table_code === t);
  for (const t of new Set(E.rows.map((r) => r.table_code))) if (!["mcc_top", "mcc_other_category", "p2p_p2m", "upi_apps", "statewise"].includes(t)) throw new Error(`npci: ecosystem table ${t} is not mapped`);

  // P2P and P2M
  {
    const c = cellsOf(eco("p2p_p2m"), (r) => r.metric);
    const [a, z] = span(c), M = months(month(a), month(z));
    const L = { total_volume_mn: ["total_volume", "UPI, all transactions (number)", ACCENT], total_value_cr: ["total_value", "UPI, all transactions (value)", ACCENT],
      p_2_p_volume_mn: ["p2p_volume", "Person to person (number)"], p_2_p_value_cr: ["p2p_value", "Person to person (value)"],
      p_2_m_volume_mn: ["p2m_volume", "Person to merchant (number)"], p_2_m_value_cr: ["p2m_value", "Person to merchant (value)"] };
    const s = {};
    for (const [m, e] of c) { if (!L[m]) throw new Error(`npci: P2P/P2M metric ${m} is not mapped`); const [key, label, color] = L[m]; s[key] = line(e, M, key, label, "UPI", color); }
    bundle("npci-upi-p2p-p2m", M, s, { frequency: "monthly", base: "NPCI UPI ecosystem statistics", unit: "mixed",
      coverage: "UPI split into payments between people (P2P) and payments to merchants (P2M), number and value, each month since April 2020",
      sourceTitle: "NPCI, UPI ecosystem statistics: P2P and P2M (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "NPCI's P2P and P2M table, printed in million and ₹ crore, stored as counts and rupees. P2P + P2M = total is checked in validate." });
  }

  // merchant categories (top MCCs, by NPCI's band)
  {
    const rows = eco("mcc_top").filter((r) => r.date >= "2016-12-01");
    const c = cellsOf(rows, (r) => `${r.row_code}|${r.metric}`);
    const [a, z] = span(c), M = months(month(a), month(z)), s = {};
    // a code's band can change; the line is named by its latest band
    const band = new Map(); for (const r of rows) band.set(r.row_code, [r.date, r.group_label || (r.row_code === "total" ? "All merchant categories" : "")]);
    const lab = new Map(); for (const r of rows) if (!lab.has(r.row_code) || r.date > lab.get(r.row_code)[0]) lab.set(r.row_code, [r.date, r.row_label]);
    for (const [k, e] of c) {
      const [code, metric] = k.split("|"); const mk = { volume_in_mn: "volume", value_in_cr: "value" }[metric];
      if (!mk) throw new Error(`npci: MCC metric ${metric} is not mapped`);
      const name = code === "total" ? "All merchant categories" : code === "others" ? "Other merchant categories (NPCI's remainder)" : `${tidy(lab.get(code)[1])} (MCC ${code})`;
      const key = (code === "total" || code === "others" ? code : `mcc_${code}`) + "__" + mk;
      s[key] = line(e, M, key, `${name}, ${mk === "volume" ? "number of transactions" : "value"}`, code === "total" ? "Total" : code === "others" ? "Remainder" : (band.get(code)[1] || "Category"), code === "total" ? ACCENT : GREY);
    }
    bundle("npci-upi-mcc", M, s, { frequency: "monthly", base: "NPCI UPI ecosystem statistics", unit: "mixed",
      coverage: "UPI payments to merchants by merchant category code (MCC) each month since December 2016: the categories NPCI lists that month, NPCI's remainder and the total",
      sourceTitle: "NPCI, UPI ecosystem statistics: merchant category (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "NPCI lists the top merchant categories each month, in three bands by how much they transact, and puts the rest in 'Others'. A category missing from a month was not in that month's list, not zero: its line has a gap. The band is a label NPCI changes; each line is named by its latest band. NPCI's 'Others' is a remainder and is slightly negative in March and October 2017 (-0.01 million), kept as printed. The table begins in July 2016, but every month to November 2016 is a template of zeros with a few tiny values; December 2016 is the first month with a total.",
    }, "NPCI did not list this category in these months (it fell out of the top list); left empty, not zero.");
  }

  // other merchant segments
  {
    const c = cellsOf(eco("mcc_other_category").map((r) => ({ ...r, row_code: SEGMENT_ALIAS[r.row_code] ?? r.row_code })), (r) => `${r.row_code}|${r.metric}`);
    const [a, z] = span(c), M = months(month(a), month(z)), s = {};
    const SEG = { agriculture: "Agriculture and allied services", education: "Education", government_services: "Government payments and services", hospital: "Hospitals and healthcare",
      public_transport: "Public transport (bus, rail, taxi and airline)", utility: "Utilities (water, gas and electricity)", all_other_segments: "All other segments", grand_total: "All segments" };
    for (const [k, e] of c) {
      const [code, metric] = k.split("|"); if (!SEG[code]) throw new Error(`npci: merchant segment ${code} is not mapped`);
      const mk = { volume_in_mn: "volume", value_in_cr: "value" }[metric];
      s[`${code}__${mk}`] = line(e, M, `${code}__${mk}`, `${SEG[code]}, ${mk === "volume" ? "number of transactions" : "value"}`, code === "grand_total" ? "Total" : "Segment", code === "grand_total" ? ACCENT : GREY);
    }
    bundle("npci-upi-segments", M, s, { frequency: "monthly", base: "NPCI UPI ecosystem statistics", unit: "mixed",
      coverage: "UPI payments to merchants in six segments NPCI reports apart from its top-category list (public transport, government, utilities, education, hospitals, agriculture) each month since April 2024",
      sourceTitle: "NPCI, UPI ecosystem statistics: other prominent segments (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "NPCI's 'other MCC' table. Its total row is printed as 'Grand Total' except one month ('Total'); they are one line here. NPCI did not print the utility, transport, other-segments and total rows in two months; those are gaps." });
  }

  // apps
  {
    const spelt = new Map();
    const rows = eco("upi_apps").map((r) => { const code = APP_ALIAS[r.row_code] ?? r.row_code; if (code !== r.row_code) spelt.set(code, [...new Set([...(spelt.get(code) ?? []), tidy(r.row_label)])]); return { ...r, row_code: code }; });
    const c = cellsOf(rows, (r) => `${r.row_code}|${r.metric}`);
    const [a, z] = span(c), M = months(month(a), month(z)), s = {};
    const AM = { total_volume_mn: ["total_volume", "all transactions (number)"], total_value_cr: ["total_value", "all transactions (value)"],
      customer_initiated_transactions_volume_mn: ["customer_volume", "started by customers (number)"], customer_initiated_transactions_value_cr: ["customer_value", "started by customers (value)"],
      b_2_c_transactions_volume_mn: ["b2c_volume", "business to customer (number)"], b_2_c_transactions_value_cr: ["b2c_value", "business to customer (value)"],
      b_2_b_transactions_volume_mn: ["b2b_volume", "business to business (number)"], b_2_b_transactions_value_cr: ["b2b_value", "business to business (value)"],
      onus_transactions_volume_mn: ["onus_volume", "on-us, payer and payee on the same bank's app (number, printed beside the total)"], onus_transactions_value_cr: ["onus_value", "on-us (value, printed beside the total)"] };
    const lab = new Map(); for (const r of rows) if (!lab.has(r.row_code) || r.date > lab.get(r.row_code)[0]) lab.set(r.row_code, [r.date, r.row_label]);
    for (const [k, e] of c) {
      const [code, metric] = k.split("|"); if (!AM[metric]) throw new Error(`npci: app metric ${metric} is not mapped`);
      const [mk, what] = AM[metric], other = /^others/.test(code);
      // a name NPCI printed twice in one month keeps its second row apart, by NPCI's serial number
      const sr = code.includes("__sr") ? code.split("__sr")[1] : null;
      const name = other ? `Other apps${sr ? ` (a second 'Others' row, NPCI serial ${sr})` : ""}` : (APP_NAME[code.split("__sr")[0]] ?? tidy(lab.get(code)[1])) + (sr ? ` (a row NPCI printed twice in one month, serial ${sr})` : "");
      s[`${code}__${mk}`] = line(e, M, `${code}__${mk}`, `${name}, ${what}`, other ? "Other apps" : name, GREY);
      s[`${code}__${mk}`].sourceLabel = (spelt.has(code) ? [tidy(lab.get(code)[1]), ...spelt.get(code)].join(" / ") : tidy(lab.get(code)[1])) + " | " + e.label;
    }
    bundle("npci-upi-apps", M, s, { frequency: "monthly", base: "NPCI UPI ecosystem statistics: apps (from December 2020)", unit: "mixed",
      coverage: "UPI by the app the payment was made from, each month since December 2020: every app NPCI lists, with payments started by customers, business-to-customer and business-to-business payments, number and value",
      sourceTitle: "NPCI, UPI ecosystem statistics: UPI apps (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "NPCI's app table, printed in million and ₹ crore, stored as counts and rupees. An app's total is the sum of customer-initiated, B2C and B2B payments; on-us payments (payer and payee on the same bank's app) are printed beside the total for some apps in some months and are not part of it. Apps enter and leave NPCI's list, and NPCI's labels change spelling; lines are keyed on the app's name with spaces and punctuation removed, and the Paytm app's two 2024 spellings ('Paytm', 'Paytm (OCL)', alternating month by month) are one line. Where NPCI printed the same name twice in one month with different numbers (two 'Others' rows in August 2025 and a few 2023-24 months), both rows are kept, told apart by NPCI's serial number. June to November 2020 the tab served a different table, so apps start in December 2020. The sum of all apps runs a little above or below UPI's monthly total depending on the month.",
    }, "NPCI did not list this app in these months; left empty.");
  }

  // states and districts
  {
    const rows = eco("statewise").map((r) => ({ ...r, group_code: r.group_code === "andaman_and_nicobar" ? "andaman_and_nicobar_islands" : r.group_code }));
    for (const r of rows) if (r.group_code !== "unclassified" && !NPCI_STATES[r.group_code]) throw new Error(`npci: state ${r.group_code} (${r.group_label}) is not mapped`);
    const SM = { volume_in_mn: "volume", value_in_cr: "value", volume_contribution: "volume_share", value_contribution: "value_share" };
    const WHAT = { volume: "number of transactions", value: "value", volume_share: "share of all UPI transactions, % (as printed)", value_share: "share of all UPI value, % (as printed)" };
    const unitOf = (mk, e) => (mk.endsWith("_share") ? "pct_share" : SCALE[e.unit][1]);
    const st = cellsOf(rows.filter((r) => r.row_type !== "detail"), (r) => `${r.group_code}|${r.metric}`);
    const [a, z] = span(st), M = months(month(a), month(z)), s = {};
    for (const [k, e] of st) {
      const [g, metric] = k.split("|"), mk = SM[metric]; if (!mk) throw new Error(`npci: statewise metric ${metric} is not mapped`);
      const name = g === "unclassified" ? "Not assigned to a state (NPCI's 'Unclassified')" : NPCI_STATES[g][0];
      s[`${g}__${mk}`] = { ...line(e, M, `${g}__${mk}`, `${name}, ${WHAT[mk]}`, g === "unclassified" ? "Unclassified" : name, GREY), unit: unitOf(mk, e), ...(g !== "unclassified" ? { tile: NPCI_STATES[g][1] } : {}) };
    }
    // NPCI's printed shares are checked against its own volumes and values (share = row / all
    // states and unclassified, to NPCI's two decimals). A printed share that does not match is a
    // typing slip (March 2026's are printed as fractions, 0.1 for 10%; some of April 2026's are
    // another month's) and is withheld as a gap, never repaired; charts compute shares from the
    // volumes, labelled as computed.
    const groups = [...new Set(Object.keys(s).map((k) => k.split("__")[0]))];
    const total = (m) => M.map((_, i) => groups.reduce((a, g) => a + (s[`${g}__${m}`]?.data[i] ?? 0), 0));
    const TOT = { volume: total("volume"), value: total("value") };
    const withheld = [];
    const withhold = (ser, base, i, d, who) => {
      const p = ser.data[i], x = base.data[i]; if (p == null || x == null) return;
      if (Math.abs(100 * x / TOT[ser.name.endsWith("volume_share") ? "volume" : "value"][i] - p) > 0.0101) { ser.data[i] = null; withheld.push(`${who} ${d.slice(0, 7)}`); }
    };
    for (const g of groups) for (const m of ["volume", "value"]) M.forEach((d, i) => withhold(s[`${g}__${m}_share`], s[`${g}__${m}`], i, d, g));
    if (withheld.length > 120) throw new Error(`npci: ${withheld.length} printed state shares disagree with NPCI's volumes; more than the known slips`);
    const SHARE_NOTE = "NPCI's printed share for this month does not match its own figures (March 2026 is printed as fractions, 0.1 for 10%, and some April 2026 and 2025 cells as another state's or month's); withheld, not repaired. Shares computed from the volumes are on the page.";
    for (const ser of Object.values(s)) if (ser.name.endsWith("_share")) ser.gapsNote = SHARE_NOTE;
    console.log(`npci: ${withheld.length} printed state shares withheld (${[...new Set(withheld.map((w) => w.split(" ")[1]))].join(", ")})`);
    bundle("npci-upi-states", M, s, { frequency: "monthly", base: "NPCI UPI ecosystem statistics: states (from April 2023)", unit: "mixed",
      coverage: "UPI by state and union territory each month since April 2023: number and value of transactions and each state's share, with the transactions NPCI could not assign to a state",
      sourceTitle: "NPCI, UPI ecosystem statistics: state-wise (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "A transaction is assigned to the state of the payer's registered address as banks report it to NPCI. About 40 to 45% of UPI's transactions each month are 'Unclassified' (no state reported), so every state's figure understates its activity, and the shares are of all UPI including the unclassified part. Shares are NPCI's printed percentages, checked against its own volumes and values; a printed share that does not match (all of March 2026, printed as fractions, and a few other cells) is withheld as a gap. States sum to UPI's total within NPCI's rounding, except May 2026 (23,525.76 million against UPI's 23,201.93 million), kept as printed." });
    const di = rows.filter((r) => r.row_type === "detail");
    const dc = cellsOf(di, (r) => `${r.group_code}|${r.row_code}|${r.metric}`);
    const [da, dz] = span(dc), DM = months(month(da), month(dz)), ds = {};
    const dlab = new Map(); for (const r of di) if (!dlab.has(`${r.group_code}|${r.row_code}`) || r.date > dlab.get(`${r.group_code}|${r.row_code}`)[0]) dlab.set(`${r.group_code}|${r.row_code}`, [r.date, r.row_label]);
    for (const [k, e] of dc) {
      const [g, d, metric] = k.split("|"), mk = SM[metric];
      const key = `${g}__${d}__${mk}`, name = `${title(dlab.get(`${g}|${d}`)[1])}, ${NPCI_STATES[g][0]}`;
      ds[key] = { ...line(e, DM, key, `${name}: ${WHAT[mk]}`, NPCI_STATES[g][0], GREY), unit: unitOf(mk, e) };
    }
    const dw = [];
    for (const [key, ser] of Object.entries(ds)) if (key.endsWith("_share")) {
      const base = ds[key.replace(/_share$/, "")];
      DM.forEach((d, i) => { const p = ser.data[i], x = base?.data[i], j = M.indexOf(d); if (p == null || x == null || j < 0) return;
        if (Math.abs(100 * x / TOT[key.endsWith("volume_share") ? "volume" : "value"][j] - p) > 0.0101) { ser.data[i] = null; dw.push(`${key} ${d.slice(0, 7)}`); } });
      ser.gapsNote = SHARE_NOTE;
    }
    console.log(`npci: ${dw.length} printed district shares withheld (${[...new Set(dw.map((w) => w.split(" ")[1]))].join(", ")})`);
    bundle("npci-upi-districts", DM, ds, { frequency: "monthly", base: "NPCI UPI ecosystem statistics: districts (from March 2026)", unit: "mixed",
      coverage: "UPI in every district NPCI lists, each month since March 2026: number and value of transactions and each district's share of all UPI",
      sourceTitle: "NPCI, UPI ecosystem statistics: state-wise, district rows (monthly)", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "District rows NPCI added under each state from March 2026. Districts are named as NPCI prints them, which may differ from the Census or LGD names. The unclassified 40 to 45% of transactions has no district either. Districts sum to their state's total; validate checks it." },
      "NPCI did not print this district in these months; left empty.");
  }

  // ---------- daily ----------
  {
    const D = DL.rows.filter((r) => r.frequency === "daily");
    const TABS = { "upi-daily-statistics": "upi", "imps-daily-statistics": "imps", "netc-daily-statistics": "netc", "aeps-cash-withdrawal": "aeps_cash", "aeps-funds-transfer": "aeps_transfer",
      "aeps-bhim-aadhaar-pay": "bhim_aadhaar_pay", "cts-daily-statistics": "cts", "nfs-daily-statistics": "nfs", "nach-apbs": "nach_apbs", "nach-credit": "nach_credit", "nach-debit": "nach_debit" };
    const NAME = { upi: "UPI", imps: "IMPS", netc: "FASTag (NETC) toll and parking", aeps_cash: "AePS cash withdrawals", aeps_transfer: "AePS fund transfers", bhim_aadhaar_pay: "BHIM Aadhaar Pay",
      cts: "Cheques (CTS)", nfs: "ATM network (NFS) transactions", nach_apbs: "APBS (benefits by Aadhaar number)", nach_credit: "NACH credit (excluding APBS)", nach_debit: "NACH debit" };
    for (const t of new Set(D.map((r) => r.tab))) if (!TABS[t]) throw new Error(`npci: daily tab ${t} is not mapped`);
    const c = cellsOf(D, (r) => `${TABS[r.tab]}|${r.metric}`, (r) => r.date);
    const [a, z] = span(c), AX = days(a, z), s = {};
    for (const [k, e] of c) {
      const [t, m] = k.split("|");
      s[`${t}_${m}`] = line(e, AX, `${t}_${m}`, `${NAME[t]}, ${m === "volume" ? "number of transactions" : "value"}, daily`, NAME[t], t === "upi" ? ACCENT : GREY);
    }
    bundle("npci-daily", AX, s, { frequency: "daily", base: "NPCI daily statistics (from May 2021)", unit: "mixed",
      coverage: "Every day since 1 May 2021: number and value of UPI, IMPS, FASTag, AePS, cheque, ATM-network (NFS) and NACH transactions",
      sourceTitle: "NPCI, daily product statistics", sourceUrl: "https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics",
      note: "NPCI's daily tables, printed in million and ₹ crore to two decimals, stored as counts and rupees; small daily figures are coarse (AePS fund transfers often print 0.00 million). Days are transaction days. Known NPCI slips kept as printed: FASTag 19 November 2022 (103.0 million, about ten times its neighbours), the ATM network (NFS) 1 October 2021 (124.76 million, about eleven times its neighbours), BHIM Aadhaar Pay 1 December 2021 (5.00 million against well under 0.1 million on the days around it), AePS cash withdrawals in December 2021 (one tenth of the usual count) and 5 November 2022 (value ten times), IMPS in February 2023 (several days understated), every NACH tab 0 on 28 February 2025. The cheque table omits some holidays. NPCI's daily NACH credit excludes APBS, which has its own table. The running month is in NPCI's table only to the latest day shown.",
    }, "NPCI's daily table has no row for this day (a holiday or an omission at source); left empty.");
  }

  console.log(`npci: UPI to ${month(lastUpi).slice(0, 7)}; ${(upiVol.v.get(lastUpi) / 10).toFixed(2)} crore transactions; Data Bank capture ${retrieved}`);
}

/* ---------- catalogue (docs/CONTRACT-coverage.md) ----------
 * What NPCI publishes, from the Data Bank's capture of NPCI's own tables, one item per table cell
 * kind (a product tab's row and column, an ecosystem table's group, row and column, a daily tab's
 * measure):
 *   npci:product:<product>:<tab>:<row>:<metric>
 *   npci:ecosystem:<table>:<group>:<row>:<metric>
 *   npci:daily:<tab>:<metric>
 * plus what the capture does not hold, named so the ledger must decide it:
 *   npci:uncaptured:<what>       NPCI tables the Data Bank does not read (its tab catalogue was not
 *                                archived, and npci.org.in refused automated reading on 2026-10-20)
 *   npci:served-not-baked:<what> parts of a captured table set aside at source (template months,
 *                                a different table under the same tab, fiscal-year-to-date totals) */
import { writeCatalogue, catalogueCli, sourceCfg, idPart } from "../catalogue.mjs";
export async function catalogueNpci() {
  const { cfg } = sourceCfg("npci");
  const db = databankRoot(cfg?.families?.databank);
  const id = (...p) => p.map((x) => String(x).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "none").join(":");
  const items = [];
  for (const r of databankWarehouse(db, "npci_product_statistics", "SELECT DISTINCT product, tab, tab_label, row_code, max(row_label) AS row_label, metric, max(metric_label) AS metric_label FROM {table} GROUP BY product, tab, tab_label, row_code, metric ORDER BY 1, 2, 4, 6").rows)
    items.push({ id: id("npci", "product", r.product, r.tab, r.row_code, r.metric), label: `${r.tab_label}${r.row_code !== "all" ? `, ${tidy(r.row_label) || r.row_code}` : ""}: ${r.metric_label}` });
  for (const r of databankWarehouse(db, "npci_upi_ecosystem", "SELECT table_code, max(table_label) AS table_label, group_code, max(group_label) AS group_label, row_code, max(row_label) AS row_label, metric, max(metric_label) AS metric_label FROM {table} GROUP BY table_code, group_code, row_code, metric ORDER BY 1, 3, 5, 7").rows)
    items.push({ id: id("npci", "ecosystem", r.table_code, r.group_code, r.row_code, r.metric), label: `UPI ecosystem, ${r.table_label}: ${[tidy(r.group_label), tidy(r.row_label)].filter(Boolean).join(", ")}: ${r.metric_label}` });
  for (const r of databankWarehouse(db, "npci_daily_statistics", "SELECT DISTINCT tab, max(tab_label) AS tab_label, metric FROM {table} GROUP BY tab, metric ORDER BY 1, 3").rows)
    items.push({ id: id("npci", "daily", r.tab, r.metric), label: `Daily, ${r.tab_label}: ${r.metric}` });
  const UNCAPTURED = [["tab-catalogue", "NPCI's list of statistics tabs (/api/product-statistic/tabs): not archived by the Data Bank, so products beyond those read cannot be itemised"],
    ["ecosystem-archive", "UPI ecosystem tables behind the page's Archive button (/api/ecosystem-statistics/years-for-archive), never probed"],
    ["rupay", "RuPay card statistics"], ["nfs-monthly", "NFS (ATM network) monthly product table"], ["bharat-connect", "Bharat BillPay / Bharat Connect statistics (now published by NPCI Bharat BillPay Ltd)"],
    ["upi-performance", "UPI member-bank performance (approval and technical decline rates by remitter and beneficiary bank)"]];
  for (const [k, label] of UNCAPTURED) items.push({ id: `npci:uncaptured:${k}`, label });
  items.push({ id: "npci:served-not-baked:mcc-template-2016", label: "Merchant category table, July to November 2016: a template of zeros with a few tiny values, before the first month with a total" },
    { id: "npci:served-not-baked:apps-2020-jun-nov", label: "UPI apps tab, June to November 2020: a different table (bank-wise inward volume and response status)" },
    { id: "npci:served-not-baked:nach-fiscal-ytd", label: "NACH credit and debit, excel_type=yearly: fiscal-year-to-date totals of the monthly table" });
  writeCatalogue("npci", { source: "National Payments Corporation of India: product, UPI ecosystem and daily statistics (as captured by the local Data Bank)",
    generator: "scripts/lib/products/npci.mjs --catalogue",
    note: "Items from the Data Bank's latest warehouse publication of npci_product_statistics, npci_upi_ecosystem and npci_daily_statistics (one item per table, row and column NPCI served), and named items for NPCI tables the capture does not hold.", items });
}
await catalogueCli(import.meta.url, catalogueNpci);
