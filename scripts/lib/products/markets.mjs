// scripts/lib/products/markets.mjs: where Indian savings go outside the bank, and how companies
// raise money from the market. RBI DBIE reports read from the local Data Bank mirror
// (scripts/lib/databank.mjs, read-only). One adapter, eleven reports; the company finance
// studies are markets-companies.mjs and the RBI Innovation Hub tables are markets-hub.mjs.
//
// Reports read (DBIE report ids), each filtered to ONE display unit (the reports repeat every
// value once per unit, ACTUALS to BILLIONS; the value is the same rupee figure in every copy):
//   1355  New capital issues by non-government public limited companies, monthly, Apr 1990 on.
//         TWO LAYOUTS in one report, never mixed: the current table (items 5, 6, 53 to 60: equity
//         through prospectus and rights, public issues of bonds, total) runs over the whole span;
//         the old detailed table (items 1 to 52: premium, preference shares, debentures by
//         convertibility and mode, totals by mode) stops in November 2024. Item codes are mapped
//         by number and the source's own label is asserted for each. Identities checked on the
//         raw cells (2026-10-10): convertible = 3.1.1 + 3.1.2 and non-convertible = a + b in every
//         month; debentures = convertible + non-convertible except November 2024 (one month the
//         source does not add up, disclosed). Items 61 to 64 ("a) Prospectus", "b) Rights" after
//         the new total) are zero in every month from April 2011 to December 2022, including
//         months with issues: a placeholder, excluded in the ledger.
//   277   The same, annual. Calendar years 1970 to 1980, then fiscal years from 1981-82: two
//         rulers, two bundles (markets-issues-annual-cy, markets-issues-annual).
//   1356  Euro issues (ADRs and GDRs), monthly.
//   1360  Net resources mobilised by mutual funds, by sponsor (UTI, bank, FI, private), annual.
//   1359  The same for bank- and FI-sponsored funds, fund by fund.
//   1361  The same for every fund house (the inventory titles it "private sector"; it carries UTI
//         and SBI too, so it is named by fund house here), annual, 1996-97 on.
//   126   Assets under management of mutual funds, end-March.
//   17    Gold and silver prices, monthly averages. The source's Item Code column is misaligned
//         with its Description (GOLD_LON_TROY carries "Gold London (Rupees per 10 gms)", whose
//         values ~₹28,000 are rupees per 10 grams): series are keyed by Description, which the
//         values confirm. 108 is the annual table (fiscal-year averages).
//   1225  Flow of financial assets and liabilities of households, instrument-wise, quarterly
//         (provider DP0) and fiscal-year totals (DP1). 1226: the stocks, quarterly. 246: the
//         annual flows since 1970-71 (the RBI labels the whole table "NAS-1999-2000").
//   1350, 1351  Market capitalisation, monthly (BSE and all-India; NSE).
//   990, 1352   Turnover in the cash market, monthly (BSE; NSE) and fiscal-year totals.
//   1357  Turnover in equity derivatives, monthly, by exchange and instrument.
//   658, 680  Daily equity turnover, market capitalisation and traded volume (BSE; NSE).
// Exchange index LEVELS (693, 728, 802, 898, 1353, 477, 478, 726, 1358) are excluded in the
// ledger: index values are licensed products of their owners. Market capitalisation and
// turnover are exchange statistics, not index products: baked (decision recorded in
// docs/status/markets.md for the owner to overturn).
//
// Units: rupee amounts are baked as ₹ crore (rupees / 1e7, two decimals); counts as counts.
//
// Hand checks (2026-10-10), against the RBI's own publications:
//   markets-issues       April 2024 equity ₹25,370.57 crore in 35 issues, rights ₹1,643.19 crore in 8
//                        = RBI Bulletin table "New capital issues": 25,371 (35) and 1,643 (8).
//   markets-gold-annual  2025-26 Mumbai standard gold ₹1,18,420.9 per 10 g, London $3,937.86 per oz,
//                        spread ₹6,039.04 = Handbook table 35 (published 31 July 2026).
//   markets-gold         May 2026 Mumbai gold ₹1,54,756.37 = Handbook table (monthly), ₹1,54,756.
//   markets-mf-aum       end-March 2026 ₹73,73,376.97 crore = AMFI's March 2026 note, ₹73.73 lakh crore
//                        (the RBI's Handbook table reproduces AMFI's figure).
//   markets-hh-flows     October-December 2025 net financial assets ₹4,22,796.83 crore (4.64% of GDP),
//                        gross ₹10,13,336.21 crore, deposits ₹3,35,669.51 crore = RBI Bulletin table 52
//                        (BS_ViewBulletin Id=24362): 4,22,796.8, 4.6%, 10,13,336.2, 3,35,669.5. A later
//                        Bulletin (Id=24505) revises the quarter to ₹4,31,039.9 crore; the Data Bank
//                        mirror holds the earlier print (rebake after the mirror refreshes).
//   markets-hh-flows-annual  2025-26 net financial assets ₹21,45,052.98 crore = the same table, 21,45,053.0.
import { databankRoot, dbieReport, dbieProvider } from "../databank.mjs";
import { writeRaw, readRaw } from "../util.mjs";
import { num, crore, r2, r4, monthOfStamp, monthOfMon, fyStart, quarterStartOfEnd, slug, tidy, oneUnit, assemble, emit, ser } from "./markets-lib.mjs";

const SRC = "Reserve Bank of India, DBIE (via the local Data Bank)";

// ---------------------------------------------------------------- 1355: new capital issues
// [item sk, key, label, expected source label] for the current layout (whole span)
const ISSUES_NEW = [
  [5, "equity_n", "Equity shares: number of issues", "1) Equity Shares (a+b)"],
  [6, "equity", "Equity shares: amount raised", "1) Equity Shares (a+b)"],
  [53, "equity_prospectus_n", "Equity through a prospectus (public issues): number", "a) Prospectus"],
  [54, "equity_prospectus", "Equity through a prospectus (public issues): amount", "a) Prospectus"],
  [55, "equity_rights_n", "Equity through rights issues: number", "b) Rights"],
  [56, "equity_rights", "Equity through rights issues: amount", "b) Rights"],
  [57, "bonds_n", "Public issues of bonds and debentures: number", "2 Public Issue of Bonds/ Debentures"],
  [58, "bonds", "Public issues of bonds and debentures: amount", "2 Public Issue of Bonds/ Debentures"],
  [59, "total_n", "All public and rights issues (equity + bonds): number", "3 Total (1+2)"],
  [60, "total", "All public and rights issues (equity + bonds): amount", "3 Total (1+2)"],
];
// the old detailed layout (to November 2024)
const ISSUES_OLD = [
  [1, "equity_prospectus_n", "Equity: prospectus, number", "a) Prospectus"],
  [2, "equity_prospectus", "Equity: prospectus, amount", "a) Prospectus"],
  [3, "equity_rights_n", "Equity: rights, number", "b) Rights"],
  [4, "equity_rights", "Equity: rights, amount", "b) Rights"],
  [47, "equity_premium_n", "Equity issued at a premium: number", "1) Equity Shares (Premium)"],
  [48, "equity_premium", "Equity issued at a premium: amount", "1) Equity Shares (Premium)"],
  [49, "equity_premium_prospectus_n", "Equity at a premium, prospectus: number", "1.1 Prospectus (Premium)"],
  [50, "equity_premium_prospectus", "Equity at a premium, prospectus: amount", "1.1 Prospectus (Premium)"],
  [51, "equity_premium_rights_n", "Equity at a premium, rights: number", "1.2 Rights (Premium)"],
  [52, "equity_premium_rights", "Equity at a premium, rights: amount", "1.2 Rights (Premium)"],
  [11, "preference_n", "Preference shares: number", "2) Preference Shares (a+b)"],
  [12, "preference", "Preference shares: amount", "2) Preference Shares (a+b)"],
  [7, "preference_prospectus_n", "Preference shares: prospectus, number", "a) Prospectus"],
  [8, "preference_prospectus", "Preference shares: prospectus, amount", "a) Prospectus"],
  [9, "preference_rights_n", "Preference shares: rights, number", "b) Rights"],
  [10, "preference_rights", "Preference shares: rights, amount", "b) Rights"],
  [17, "debentures_n", "Debentures and bonds: number", "3) Debentures/Bonds (i+ii)"],
  [18, "debentures", "Debentures and bonds: amount", "3) Debentures/Bonds (i+ii)"],
  [13, "debentures_prospectus_n", "Debentures and bonds: prospectus, number (as printed under the debentures heading)", "a) Prospectus"],
  [14, "debentures_prospectus", "Debentures and bonds: prospectus, amount (as printed under the debentures heading)", "a) Prospectus"],
  [15, "debentures_rights_n", "Debentures and bonds: rights, number (as printed under the debentures heading)", "b) Rights"],
  [16, "debentures_rights", "Debentures and bonds: rights, amount (as printed under the debentures heading)", "b) Rights"],
  [23, "convertible_n", "Convertible debentures: number", "i) Convertible (a+b)"],
  [24, "convertible", "Convertible debentures: amount", "i) Convertible (a+b)"],
  [19, "convertible_prospectus_n", "Convertible debentures: prospectus, number", "3.1.1 Prospectus"],
  [20, "convertible_prospectus", "Convertible debentures: prospectus, amount", "3.1.1 Prospectus"],
  [21, "convertible_rights_n", "Convertible debentures: rights, number", "3.1.2 Rights"],
  [22, "convertible_rights", "Convertible debentures: rights, amount", "3.1.2 Rights"],
  [29, "nonconvertible_n", "Non-convertible debentures: number", "ii) Non-convertible (a+b)"],
  [30, "nonconvertible", "Non-convertible debentures: amount", "ii) Non-convertible (a+b)"],
  [25, "nonconvertible_prospectus_n", "Non-convertible debentures: prospectus, number", "a) Prospectus"],
  [26, "nonconvertible_prospectus", "Non-convertible debentures: prospectus, amount", "a) Prospectus"],
  [27, "nonconvertible_rights_n", "Non-convertible debentures: rights, number", "b) Rights"],
  [28, "nonconvertible_rights", "Non-convertible debentures: rights, amount", "b) Rights"],
  [41, "bonds_n", "Bonds: number", "4) Bonds"],
  [42, "bonds", "Bonds: amount", "4) Bonds"],
  [43, "bonds_prospectus_n", "Bonds: prospectus, number", "4.1 Prospectus"],
  [44, "bonds_prospectus", "Bonds: prospectus, amount", "4.1 Prospectus"],
  [45, "bonds_rights_n", "Bonds: rights, number", "4.2 Rights"],
  [46, "bonds_rights", "Bonds: rights, amount", "4.2 Rights"],
  [39, "total_n", "Total (equity + preference + debentures): number", "4) Total (1+2+3)"],
  [40, "total", "Total (equity + preference + debentures): amount", "4) Total (1+2+3)"],
  [31, "total_prospectus_n", "Total through a prospectus: number", "a) Prospectus"],
  [32, "total_prospectus", "Total through a prospectus: amount", "a) Prospectus"],
  [33, "total_rights_n", "Total through rights: number", "b) Rights"],
  [34, "total_rights", "Total through rights: amount", "b) Rights"],
];
export const ISSUES_PLACEHOLDER_SK = [61, 62, 63, 64];

function issuesSeries(rows, table, { dateOf, labelCol, skCol, valCol }) {
  const map = new Map();
  const want = new Map(table.map(([sk, key, label, src]) => [String(sk), { key, label, src }]));
  const seenLabel = new Map();
  for (const r of rows) {
    const t = want.get(r[skCol]);
    if (!t) continue;
    if (tidy(r[labelCol]) !== tidy(t.src)) seenLabel.set(r[skCol], r[labelCol]);
    const d = dateOf(r);
    if (!d) continue;
    const isCount = t.key.endsWith("_n");
    const v = num(r[valCol]);
    ser(map, t.key, { label: t.label, unit: isCount ? "count" : "inr_crore" }).values.set(d, isCount ? v : crore(v));
  }
  for (const [sk, got] of seenLabel) throw new Error(`markets 1355/277: item ${sk} is labelled "${got}", expected "${want.get(sk).src}" (the table changed; remap)`);
  return map;
}

// ---------------------------------------------------------------- the build
function reader(db) {
  return (id, dp, unitCol, unit = "ACTUALS") => {
    const r = dp ? dbieProvider(db, id, dp) : dbieReport(db, id);
    return { ...r, rows: unitCol ? oneUnit(r.rows, unitCol, unit) : r.rows };
  };
}
function archive(root, rawRel, R, VINTAGE, what) {
  // anchor: the Data Bank must serve something for every report
  for (const [id, r] of Object.entries(R)) if (!r.rows.length) throw new Error(`markets: DBIE report ${id} returned no rows (one-unit filter)`);
  // the audit trail: every row we read, one unit, as read
  writeRaw(root, rawRel, {
    vintage: VINTAGE,
    note: `RBI DBIE reports for the markets guide (${what}), read from the local Data Bank mirror (rbi_dbie_webi_rows). Each report repeats every value once per display unit; one unit is kept (ACTUALS, the rupee figure). Provenance per report: DBIE report id, SAP data provider, Data Bank fetch time and the content sha256 of the full file.`,
    reports: Object.fromEntries(Object.entries(R).map(([id, r]) => [id, { provenance: r.provenance, header: r.header, rows: r.rows }])),
  });
  return readRaw(root, rawRel).vintage;
}

/** New capital issues (1355 monthly, 277 annual): dossier markets-issues. */
export async function buildMarketsIssues(root, dcfg, VINTAGE, cfg) {
  const read = reader(databankRoot(cfg?.families?.databank));
  const R = { 1355: read("1355", null, "Unit Desc"), 277: read("277", null, "Unit Desc") };
  const V = archive(root, "data/raw/markets-issues.json", R, VINTAGE, "new capital issues");
  const META = { dossier: "markets-issues", source: SRC, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy };
  const out = [];
  const put = (s, extra, built) => out.push(emit(root, s, META, extra, built));
  // ---------- new capital issues, monthly ----------
  {
    const opt = { dateOf: (r) => monthOfStamp(r["Time Date"]), labelCol: "Hbs Hierarchy Level 1", skCol: "Item Sk", valCol: "Amount monthly" };
    const rows = R[1355].rows;
    put("markets-issues", { frequency: "monthly", base: "current layout", unit: "inr_crore", product: "DBIE report 1355 (RBI Bulletin table: new capital issues by non-government public limited companies)",
      coverage: "Money raised from the public by non-government public limited companies: equity through public (prospectus) and rights issues, and public issues of bonds, every month since April 1990",
      note: "Current layout of RBI's table. Amounts in ₹ crore (rupees divided by 1e7). The published total (equity + bonds) stops in March 2024; after that the RBI prints only its parts. Private placements of debt and equity, and preferential allotments, are not new issues to the public and are not in this table. Months the RBI leaves empty are gaps, never filled." },
      assemble(issuesSeries(rows, ISSUES_NEW, opt), { gapsNote: "The RBI's table prints nothing for these months (it also skips some whole months); left empty." }));
    put("markets-issues-detail", { frequency: "monthly", base: "old detailed layout", unit: "inr_crore", product: "DBIE report 1355, old detailed layout",
      coverage: "The RBI's older, fuller table of new capital issues, April 1990 to November 2024: equity at a premium, preference shares, debentures by convertibility and by mode",
      note: "The detailed layout the RBI ran beside the current one until November 2024; a different table, never joined to markets-issues. In November 2024 debentures (4 issues, ₹380.3 crore) do not equal convertible plus non-convertible (0 + 2 issues, ₹217.77 crore) as printed. Items printed under the debentures heading as 'a) Prospectus' and 'b) Rights' are zero in some months with debenture issues (from July 2022): as printed." },
      assemble(issuesSeries(rows, ISSUES_OLD, opt)));
    // annual: calendar years to 1980, fiscal years from 1981-82
    const ann = R[277].rows;
    const cy = ann.filter((r) => /^\d{4}$/.test(r.Year)), fy = ann.filter((r) => /^\d{4}-\d{2}$/.test(r.Year));
    if (cy.length + fy.length !== ann.length) throw new Error("markets 277: a Year is neither a calendar year nor a fiscal year");
    const lab277 = "Hbs Hierarchy Level 1";
    const T277 = [...ISSUES_NEW.filter(([sk]) => ![59, 60].includes(sk)), ...ISSUES_OLD,
      [35, "new_companies_n", "Issues by new companies: number", "5.3 New"], [36, "new_companies", "Issues by new companies: amount", "5.3 New"],
      [37, "existing_companies_n", "Issues by existing companies: number", "5.4 Existing"], [38, "existing_companies", "Issues by existing companies: amount", "5.4 Existing"]];
    const annNote = "Annual table of RBI's Handbook (DBIE report 277). It carries both of the monthly report's layouts and adds issues by new and by existing companies. Where both carry a year the annual figure is the RBI's own and is not recomputed from months: they differ in some years (2016-17 and 2017-18 equity, years where months are missing), and the 2023-24 'prospectus' line (₹3,856 crore) equals March 2024's monthly figure, not the year's (the months add to ₹65,832 crore): as printed.";
    put("markets-issues-annual", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE report 277 (RBI Handbook table)", coverage: "New capital issues by non-government public limited companies, fiscal years 1981-82 on", note: annNote },
      assemble(issuesSeries(fy, T277, { dateOf: (r) => fyStart(r.Year), labelCol: lab277, skCol: "Item Sk", valCol: "Amount" })));
    put("markets-issues-annual-cy", { frequency: "annual", base: "calendar year", unit: "inr_crore", product: "DBIE report 277 (RBI Handbook table), calendar years", coverage: "New capital issues, calendar years 1970 to 1980, before the RBI moved the table to fiscal years", note: "Calendar years: a different ruler from the fiscal years that follow (1981-82 on), never joined. " + annNote },
      assemble(issuesSeries(cy, T277, { dateOf: (r) => `${r.Year}-01-01`, labelCol: lab277, skCol: "Item Sk", valCol: "Amount" })));
  }

  return out;
}

/** Everything else in the family from the Data Bank: dossier markets. */
export async function buildMarkets(root, dcfg, VINTAGE, cfg) {
  const read = reader(databankRoot(cfg?.families?.databank));
  const R = {
    1356: read("1356", "DP1", "Unit Description"),
    1360: read("1360", null, "Unit Description"),
    1359: read("1359", null, "Unit Description"),
    1361: read("1361", null, "Unit Description"),
    126: read("126", null, "Unit Description"),
    17: read("17", null),
    108: read("108", null),
    "1225": read("1225", "DP0", "Unit Description"),
    "1225a": read("1225", "DP1", "Unit Description"),
    1226: read("1226", "DP0", "Unit Description"),
    246: read("246", null, "Unit Description"),
    1350: read("1350", null, "Unit Description"),
    1351: read("1351", "DP1", "Unit Description"),
    990: read("990", null, "Unit Description"),
    "1352": read("1352", "DP3", "Unit Description"),
    "1352a": read("1352", "DP5", "Unit Description"),
    1357: read("1357", null, "Derived Unit Desc.Unit Description"),
    658: read("658", "DP2", "Unit Description"),
    680: read("680", "DP2", "Unit Description"),
  };
  const V = archive(root, "data/raw/markets-dbie.json", R, VINTAGE, "savings, mutual funds, gold, market size");
  const META = { dossier: "markets", source: SRC, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy };
  const out = [];
  const put = (s, extra, built) => out.push(emit(root, s, META, extra, built));

  // ---------- Euro issues (ADRs, GDRs), monthly ----------
  {
    const m = new Map();
    for (const r of R[1356].rows) {
      const d = monthOfStamp(r.Date);
      ser(m, "amount", { label: "Euro issues (ADRs and GDRs): amount raised", unit: "inr_crore" }).values.set(d, crore(num(r["Euro Issue Amt. Mobilised (Rs. Cr)"])));
      ser(m, "number", { label: "Euro issues: number", unit: "count" }).values.set(d, num(r["No Of Euro Issues"]));
    }
    put("markets-euro-issues", { frequency: "monthly", base: "as published", unit: "inr_crore", product: "DBIE report 1356 (number and quantum of Euro issues)", coverage: "Money raised abroad by Indian companies through American and Global Depositary Receipts, monthly",
      note: "Amounts in ₹ crore. Months where the RBI prints the amount but leaves the count empty are left empty." }, assemble(m));
  }

  // ---------- mutual funds ----------
  {
    const m = new Map();
    for (const r of R[1360].rows) {
      const k = { 1: "uti", 2: "bank", 3: "fi", 4: "private", 5: "total" }[r["Item Code"]];
      if (!k) throw new Error(`markets 1360: unknown item ${r["Item Code"]} ${r["Item Description"]}`);
      const label = k === "total" ? "All mutual funds" : tidy(r["Item Description"]);
      ser(m, k, { label: `Net resources mobilised: ${label}`, unit: "inr_crore" }).values.set(fyStart(r.Year), crore(num(r["Item Value"])));
    }
    put("markets-mf-sponsor", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE report 1360 (Handbook table 18D)", coverage: "Net money put into mutual funds (sales less redemptions), by who sponsors the fund: UTI, banks, financial institutions, private companies",
      note: "Net resources mobilised = money invested in a year less money withdrawn, ₹ crore; negative when more was withdrawn. The RBI's 'Total (2 to 5)' line is named 'All mutual funds'. The table ends in 2023-24." }, assemble(m));

    const b = new Map();
    for (const r of R[1359].rows) {
      const grp = /^bank/i.test(r.fin_system_level1) ? "Bank-sponsored" : "FI-sponsored";
      const name = tidy(r.fin_system_level2);
      ser(b, slug(name), { label: `${name} (${grp.toLowerCase()})`, unit: "inr_crore", group: grp }).values.set(fyStart(r.Year), crore(num(r["MF Sales with Premium (Rs. Crore)"])));
    }
    put("markets-mf-bank-fi", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE report 1359 (Handbook table 17D)", coverage: "Net resources mobilised by each bank- and financial-institution-sponsored mutual fund",
      note: "Net inflow (sales less redemptions), ₹ crore, fund by fund. Funds appear and disappear as they were set up, merged or sold." }, assemble(b, { gapsNote: "No figure for this fund in these years (not yet set up, renamed or merged); left empty." }));

    const p = new Map();
    for (const r of R[1361].rows) {
      const name = tidy(r["Mutual Fund Description"]);
      const k = /^total$/i.test(name) ? "total" : slug(name);
      ser(p, k, { label: k === "total" ? "All fund houses" : name, unit: "inr_crore", ...(k === "total" ? {} : { group: "Fund house" }) }).values.set(fyStart(r.Year), crore(num(r.Value)));
    }
    put("markets-mf-houses", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE report 1361 (net resources mobilised by mutual funds, entity-wise)", coverage: "Net money put into each mutual fund house, every year since 1996-97",
      note: "Net inflow (sales less redemptions), ₹ crore, fund house by fund house, as the RBI names them in each year. Houses renamed after a takeover appear as separate names." }, assemble(p, { gapsNote: "No figure for this fund house in these years (not in business, or renamed); left empty." }));

    const a = new Map();
    for (const r of R[126].rows) ser(a, "aum", { label: "Assets under management of mutual funds, end-March", unit: "inr_crore" }).values.set(`${r["Calendar Year"]}-03-01`, crore(num(r["Aggregate Value"])));
    put("markets-mf-aum", { frequency: "annual", base: "as on 31 March", unit: "inr_crore", product: "DBIE report 126 (Handbook table: assets under management of mutual funds)", coverage: "What all of India's mutual funds hold for their investors, at the end of each March",
      note: "₹ crore, as on the last day of March of the year named." }, assemble(a));
  }

  // ---------- gold and silver ----------
  {
    const G = {
      "1 Standard Gold (Rupees per 10 grams)": ["gold_mumbai", "Standard gold, Mumbai (₹ per 10 grams)", "inr_per_10g"],
      "Gold London ($ per troy oz)": ["gold_london_usd", "Gold, London (US$ per troy ounce)", "usd_per_troy_oz"],
      "Gold London (Rupees per 10 gms)": ["gold_london_inr", "Gold, London, in rupees (₹ per 10 grams)", "inr_per_10g"],
      "Spread in Rupees (2-4)": ["gold_spread", "Gold: Mumbai price less London price in rupees (₹ per 10 grams)", "inr_per_10g"],
      "2 Silver (Rupees per kilogram)": ["silver_mumbai", "Silver, Mumbai (₹ per kilogram)", "inr_per_kg"],
      "Silver New York Cents per troy oz.": ["silver_ny_cents", "Silver, New York (US cents per troy ounce)", "usc_per_troy_oz"],
      "Silver New York Rupees per kg.": ["silver_ny_inr", "Silver, New York, in rupees (₹ per kilogram)", "inr_per_kg"],
      "Spread in Rupees (6-8)": ["silver_spread", "Silver: Mumbai price less New York price in rupees (₹ per kilogram)", "inr_per_kg"],
    };
    const mk = (rows, dateOf, val) => {
      const m = new Map();
      for (const r of rows) {
        const g = G[tidy(r.Description ?? r["Item Description"])];
        if (!g) throw new Error(`markets 17/108: unknown gold item "${r.Description ?? r["Item Description"]}"`);
        ser(m, g[0], { label: g[1], unit: g[2] }).values.set(dateOf(r), r2(num(r[val])));
      }
      return m;
    };
    put("markets-gold", { frequency: "monthly", base: "as published", unit: "inr_per_10g", product: "DBIE report 17 (RBI Bulletin table 21: monthly average price of gold and silver)", coverage: "The price of gold and silver in Mumbai and abroad, monthly averages since April 1990",
      note: "Monthly averages. The spread is the Mumbai price less the overseas price converted to rupees: what import duty, taxes and local demand add. The source's Item Code column is misaligned with its descriptions; series follow the descriptions, which the values confirm." },
      assemble(mk(R[17].rows, (r) => monthOfStamp(r["Month Date"]), "Rupees per kg.")));
    put("markets-gold-annual", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_per_10g", product: "DBIE report 108 (Handbook table: average price of gold and silver)", coverage: "Fiscal-year average prices of gold and silver since 1970-71",
      note: "Fiscal-year averages as the RBI publishes them; not recomputed from months." },
      assemble(mk(R[108].rows, (r) => fyStart(r["Fiscal Year (Bulletin)(annual)"]), "Amount - Annual")));
  }

  // ---------- household financial savings ----------
  {
    // the item path, from the hierarchy columns, without heading noise
    const pathOf = (r, cols) => {
      const parts = cols.map((c) => tidy(r[c])).filter((x) => x && !/^of which$/i.test(x));
      const out = [];
      for (const p of parts) if (out.at(-1) !== p) out.push(p);
      return out;
    };
    const hh = (rows, dateOf, valCol, kind) => {
      const m = new Map();
      for (const r of rows) {
        const desc = tidy(r["Item Description"]);
        if (/^of which$/i.test(desc) || desc === "") continue;
        const v = num(r[valCol]);
        const p = pathOf(r, ["Item Hierarchy Level 1", "Item Hierarchy Level 2", "Item Hierarchy Level 3", "Item Hierarchy Level 4"]);
        if (!p.length || p.at(-1) !== desc) p.push(desc);
        const isPct = /per cent/i.test(desc) || p.some((x) => /^Per cent of GDP$/i.test(x));
        // the bare headings ("Financial Liabilities" without a value, "Loans (Borrowings) from") carry no figures
        const key = slug(p.join(" "), 200);
        const label = p.filter((x, i) => i === 0 || !/^(I\. |II\. )?(Gross )?Financial (Assets|Liabilities)$/i.test(x) || i === p.length - 1).join(": ");
        const s = ser(m, key, { label: `${kind}: ${label}`, unit: isPct ? "pct_of_gdp" : "inr_crore" });
        const d = dateOf(r);
        if (s.values.has(d) && s.values.get(d) != null && v != null) throw new Error(`markets household ${key} ${d}: two values`);
        if (!s.values.has(d) || v != null) s.values.set(d, isPct ? r4(v) : crore(v));
      }
      return m;
    };
    const qOf = (r) => quarterStartOfEnd(monthOfMon(r["Time Month"]));
    put("markets-hh-flows", { frequency: "quarterly", base: "as published", unit: "inr_crore", product: "DBIE report 1225 (RBI Bulletin table 52: flow of financial assets and liabilities of households, instrument-wise)",
      coverage: "Where households put their money each quarter (bank deposits, insurance, pension and provident funds, mutual funds, shares, currency, small savings) and what they borrowed",
      note: "Flows in a quarter (net additions), ₹ crore; per cent of GDP where named. Preliminary estimates, revised as the RBI compiles more data; the latest print of each quarter is kept. The instrument list grew in December 2021 (non-bank deposits split, PPF and pension funds separated): earlier quarters of the finer lines are empty, not zero." },
      assemble(hh(R["1225"].rows, qOf, "Amount", "Flow"), { gapsNote: "The RBI prints no figure for this line in these quarters; left empty." }));
    put("markets-hh-flows-annual", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE report 1225, fiscal-year totals", coverage: "Household financial flows by instrument, fiscal years since 2018-19",
      note: "The RBI's own fiscal-year totals of the quarterly table, not recomputed. ₹ crore; per cent of GDP where named." },
      assemble(hh(R["1225a"].rows, (r) => fyStart(r["Time Fis Year"]), "Amount", "Flow")));
    put("markets-hh-stocks", { frequency: "quarterly", base: "as published", unit: "inr_crore", product: "DBIE report 1226 (RBI Bulletin table 53: stocks of financial assets and liabilities of households)",
      coverage: "What households own in financial assets and owe, at the end of each quarter",
      note: "Stocks at the end of the quarter, ₹ crore; per cent of GDP where named. Equity holdings are published from December 2022 and the finer deposit and pension lines from December 2021: earlier quarters are empty, not zero." },
      assemble(hh(R[1226].rows, qOf, "Amount", "Stock"), { gapsNote: "The RBI prints no figure for this line in these quarters; left empty." }));
    const a = new Map();
    for (const r of R[246].rows) {
      const item = tidy(r.Item);
      const ord = Math.round(num(r["Display order"]));
      ser(a, slug(`${String(ord).padStart(2, "0")} ${item}`), { label: `Change in ${ord >= 11 && ord <= 15 ? "liabilities" : "assets"}: ${item}`, unit: "inr_crore", order: ord }).values.set(fyStart(r["Fiscal year"]), crore(num(r["Aggregrate value"])));
    }
    put("markets-hh-annual", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE report 246 (Handbook table: changes in financial assets and liabilities of the household sector)",
      coverage: "Household financial saving by instrument, every year since 1970-71",
      note: "₹ crore at current prices. The RBI labels every row of this table 'NAS-1999-2000'; the years run to 2024-25 and later years follow later national-accounts bases, so ratios to GDP are not computed here. 'Units of UTI' is a historical line." }, assemble(a));
  }

  // ---------- market capitalisation, turnover, derivatives ----------
  {
    const mc = new Map();
    for (const r of [...R[1350].rows, ...R[1351].rows]) {
      const ex = /ALL-INDIA/.test(r["Item Description_NSE_BSE"]) ? "all_india" : /NSE/.test(r["Item Description_NSE_BSE"]) ? "nse" : /BSE/.test(r["Item Description_NSE_BSE"]) ? "bse" : null;
      if (!ex) throw new Error(`markets 1350/1351: unknown item ${r["Item Description_NSE_BSE"]}`);
      const lab = { all_india: "Market capitalisation, all India", nse: "Market capitalisation, NSE", bse: "Market capitalisation, BSE" }[ex];
      const d = monthOfStamp(r["Time Date"]);
      // the month in progress carries a month-to-date figure (its latest trading day); a month's
      // figure is its last trading day, so an unfinished month is held back (the daily bundle has it)
      if (d.slice(0, 7) >= VINTAGE.slice(0, 7)) continue;
      ser(mc, ex, { label: lab, unit: "inr_crore" }).values.set(d, crore(num(r["Market Capitalisation Value"])));
    }
    put("markets-mcap", { frequency: "monthly", base: "as published", unit: "inr_crore", product: "DBIE reports 1350 and 1351 (market capitalisation, BSE, all-India and NSE)", coverage: "The market value of all listed shares, month by month",
      note: "₹ crore, on the last trading day of the month (checked against the daily table). The month in progress, which the RBI's table carries as a month-to-date figure, is left out until it closes; markets-exchanges-daily has it. Exchange statistics reproduced by the RBI. A company listed on both exchanges counts in each exchange's figure." }, assemble(mc));

    const to = new Map(), ta = new Map();
    for (const r of R[990].rows) {
      const v = crore(num(r["Turnover Value"]));
      if (r["Time Fis End Of Year"] === "Y") ser(ta, "bse", { label: "Cash-market turnover, BSE, fiscal year", unit: "inr_crore" }).values.set(fyStart(r["Fiscal Year"]), v);
      else ser(to, "bse", { label: "Cash-market turnover, BSE", unit: "inr_crore" }).values.set(monthOfStamp(r["Time Date"]), v);
    }
    for (const r of R["1352"].rows) ser(to, "nse", { label: "Cash-market turnover, NSE", unit: "inr_crore" }).values.set(monthOfMon(r.Month), crore(num(r["Turnover (in Rupees crore) (Monthly)"])));
    for (const r of R["1352a"].rows) ser(ta, "nse", { label: "Cash-market turnover, NSE, fiscal year", unit: "inr_crore" }).values.set(fyStart(r["Fiscal Year"]), crore(num(r["Item Value"])));
    put("markets-turnover", { frequency: "monthly", base: "as published", unit: "inr_crore", product: "DBIE reports 990 and 1352 (monthly turnover at BSE and NSE)", coverage: "The value of shares traded in the cash market, monthly", note: "₹ crore. Exchange statistics reproduced by the RBI." }, assemble(to));
    put("markets-turnover-annual", { frequency: "annual", base: "fiscal year (April to March)", unit: "inr_crore", product: "DBIE reports 990 and 1352, fiscal-year totals", coverage: "Cash-market turnover by fiscal year, as the RBI prints the totals",
      note: "The RBI prints fiscal-year totals for BSE in only a few years (rows flagged as year-ends) and for NSE from 1994-95; not recomputed from months." }, assemble(ta, { gapsNote: "The RBI prints no year total for these years; left empty, not summed from months." }));

    const dv = new Map();
    for (const r of R[1357].rows) {
      const ex = /BSE/.test(r["Stock Exchange"]) ? "bse" : /NSE|National/.test(r["Stock Exchange"]) ? "nse" : /MCX/.test(r["Stock Exchange"]) ? "mcx_sx" : null;
      if (!ex) throw new Error(`markets 1357: unknown exchange ${r["Stock Exchange"]}`);
      const inst = tidy(String(r["Instrument Type"]).replace(/\$/g, ""));
      const exn = { bse: "BSE", nse: "NSE", mcx_sx: "MCX-SX" }[ex];
      ser(dv, `${ex}__${slug(inst)}`, { label: `${exn}: ${inst}`, unit: "inr_crore", group: exn }).values.set(monthOfStamp(r["Time Date"]), crore(num(r["Amount ( Rs Crore )"])));
    }
    put("markets-derivatives", { frequency: "monthly", base: "as published", unit: "inr_crore", product: "DBIE report 1357 (turnover in the equity derivatives market)", coverage: "The value of futures and options traded, by exchange and instrument, monthly",
      note: "₹ crore. For options the RBI's table marks the figures with '$' (notional turnover: the value of the shares the contracts cover, not the premium paid). MCX-SX traded from 2013 and its later form is not in the table." },
      assemble(dv, { gapsNote: "The exchange prints nothing for this instrument in these months; left empty." }));

    const dd = new Map();
    for (const [rid, ex] of [[658, "bse"], [680, "nse"]]) {
      const E = ex.toUpperCase();
      for (const r of R[rid].rows) {
        const d = r["Time Date"].slice(0, 10).replace(/\//g, "-");
        ser(dd, `${ex}_turnover`, { label: `${E}: equity turnover, the day`, unit: "inr_crore" }).values.set(d, crore(num(r["Equity Turnover"])));
        ser(dd, `${ex}_mcap`, { label: `${E}: market capitalisation, end of day`, unit: "inr_crore" }).values.set(d, crore(num(r["Market Capitalization"])));
        ser(dd, `${ex}_volume`, { label: `${E}: shares traded, the day`, unit: "count" }).values.set(d, num(r["Total Traded Volume"]));
      }
    }
    put("markets-exchanges-daily", { frequency: "daily", base: "as published", unit: "inr_crore", product: "DBIE reports 658 and 680 (daily turnover, market capitalisation and traded volume at BSE and NSE)",
      coverage: "Each trading day at the two big exchanges since March 2003: value traded, market value of listed shares, shares traded",
      note: "₹ crore; volume in number of shares. The axis is every date either exchange reports; a date one exchange reports and the other does not is a gap in the other's series." },
      assemble(dd, { gapsNote: "The exchange reports nothing for these dates (a holiday on one exchange, or a missing day in the RBI's table); left empty." }));
  }
  return out;
}

// ---------------------------------------------------------------- the catalogue
// Kept in markets-catalogue.mjs (one catalogue for the family's three adapters).
