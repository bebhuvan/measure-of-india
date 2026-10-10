// scripts/lib/products/payments.mjs: how Indians pay. The RBI's payment system statistics as
// served by DBIE and mirrored in the local Data Bank (scripts/lib/databank.mjs), read-only.
//
// Reports read (DBIE report ids; the same tables appear under several DBIE menus, and the
// catalogue lists every copy):
//   612  Payment System Indicators, monthly (RBI Bulletin Table 45; same document as 61, 778).
//        Two layouts of one table, never spliced (AGENTS.md rule 1):
//          old layout, April 2004 to October 2019: RTGS, CCIL, paper clearing, retail electronic
//            clearing (ECS, NEFT, IMPS, NACH), cards (credit and debit, at ATMs and at PoS),
//            PPIs, mobile banking, cards outstanding, ATMs and PoS terminals;
//          re-organised layout, November 2019 on: settlement systems (CCIL), payment systems
//            (RTGS; retail credit transfers AePS, APBS, ECS, IMPS, NACH, NEFT, UPI; debit
//            transfers; card payments without cash withdrawals; PPIs; paper), other channels
//            (mobile, internet), cash withdrawals (ATMs, PoS, micro ATMs) and infrastructure
//            (cards, PPIs, ATMs, micro ATMs, PoS terminals, Bharat QR, UPI QR).
//        The redefinition matters: from November 2019 a debit card's "card payments" exclude cash
//        drawn at ATMs (a separate line), where the old "debit cards" line included it.
//   907  Payment System Indicators, annual (Handbook; same document as 824). Four providers:
//          DP5/DP4 volume and value by fiscal year: the re-organised layout from 2015-16
//            (baked; 2020-21 to 2025-26 equal the sums of report 612's months exactly, checked
//            in validate) and the old layout for 2012-13 to 2017-18 (NOT baked: its values are
//            one-hundredth and its volumes one-tenth of the monthly table's sums, a unit defect
//            in the DBIE export; the monthly table carries the same years correctly);
//          DP6/DP3 cheque clearances, number and amount, all India and the four RBI centres,
//            1970-71 to 2015-16.
//   678  Cheque clearances by clearing centre, STRBI Table 22 (same as 662): DP0 amount (₹),
//        DP1 number of cheques. The "Num Chq" column is a display-order code, not a count.
//        (The credit guide's credit-deep-cheque-clearances read 662 DP0 only and took that code
//        for the count: reported to the coordinator.)
//   936  Number of clearing houses, STRBI Table 27 (same as 743): DP4 the total, with the MICR
//        count in brackets; DP3 non-MICR houses by managing bank; DP2 MICR houses by managing
//        bank, in brackets. Footnote marks (*, $, #) are kept in the raw archive and dropped
//        from the numbers.
//   1404 e₹ in circulation (Handbook, CURRENCY AND COINAGE): retail e₹ by denomination,
//        wholesale e₹, total, end-March 2023 to 2026.
//   RBIB43 (Data Bank parsed dataset rbi_dbie_payment_system_indicators, WSS): RBI's printed
//        year-on-year growth of IMPS, NACH Cr, NEFT and UPI, volume and value, May 2022 on.
//        Baked as published; validate checks it against growth computed from report 612.
//
// Display units: every DBIE value repeats once per display unit (14 units); the ACTUALS row is
// kept. Volumes are counts of transactions, values are rupees, both as DBIE stores them. Two
// export defects are corrected here, each asserted and disclosed in the bundle note:
//   - old-layout "Number of ATMs (in actuals)" and "Number of POS (in actuals)" are stored
//     multiplied by 10^6 (Oct 2019: 229,374,000,000 ATMs); divided back, they meet the new
//     layout's first month (229,374 ATMs in October 2019, 231,955 in November 2019);
//   - report 907's partial current fiscal year (2026-27, April to July) is dropped: an annual
//     series holds whole years only.
//
// Hand check (CONTRACT, one value per bundle against an RBI publication), recorded 2026-10-10:
//   payments-monthly  UPI, July 2026: 2,365.84 crore transactions worth ₹29,87,880 crore. RBI
//                     Bulletin Table 45 prints volume in lakh and value in ₹ crore; the WSS growth
//                     (RBIB43) of 21.52% on July 2025 matches this level against July 2025's.
//   payments-annual   UPI, 2024-25: 18,586.60 crore transactions, ₹2,60,56,955 crore (RBI Annual
//                     Report 2024-25, Table: payment system indicators: 18,587 crore, ₹261 lakh crore).
//   payments-erupee   total e₹, end-March 2025: ₹1,016.50 crore (RBI Annual Report 2024-25:
//                     "e₹ in circulation ... ₹1,016 crore").
//   payments-cheques-1970  all-India cheques cleared 2015-16: 109.6 crore (Handbook Table).
//   The rest are checked by identity in validate (parts add to totals, annual = sum of months).
import { databankRoot, dbieReport, dbieProvider, dbieProviders, databankQuery } from "../databank.mjs";
import { writeSeries, writeRaw, readRaw } from "../util.mjs";

const num = (s) => { const t = String(s ?? "").replace(/,/g, "").trim(); if (t === "") return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const ym = (s) => `${s.slice(0, 4)}-${s.slice(5, 7)}-01`;                 // "2026/07/31 00:00:00" -> "2026-07-01"
const marchOf = (fy) => `${+fy.slice(0, 4) + 1}-03-01`;                    // "2024-25" -> "2025-03-01"
const fyOf = (d) => { const y = +d.slice(0, 4), m = +d.slice(5, 7); return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`; };
const r2 = (v) => v == null ? null : Math.round(v * 100) / 100;
const ACCENT = "#2E4BD8", GREY = "#878D99";

/* ---------- report 612, the re-organised layout (November 2019 on) ----------
 * [Item Sk, key, label, group, expected Item Description (asserted)]. Groups follow the RBI's
 * own sections. Keys are stable names; a DBIE label that stops matching fails the build. */
const NEW = [
  [45, "ccil", "CCIL-operated systems (government securities, forex, rupee derivatives)", "Settlement systems", /^1\s+CCIL Operated Systems/],
  [46, "ccil_gsec", "CCIL, government securities clearing", "Settlement systems", /^1\.1 Govt\. Securities Clearing/],
  [47, "ccil_gsec_outright", "CCIL, government securities, outright trades", "Settlement systems", /^1\.1\.1 Outright/],
  [48, "ccil_gsec_repo", "CCIL, government securities, repo", "Settlement systems", /^1\.1\.2 Repo/],
  [49, "ccil_gsec_triparty", "CCIL, government securities, tri-party repo", "Settlement systems", /^1\.1\.3 Tri-party Repo/],
  [50, "ccil_forex", "CCIL, foreign exchange clearing", "Settlement systems", /^1\.2 Forex Clearing/],
  [51, "ccil_rupee_derivatives", "CCIL, rupee derivatives", "Settlement systems", /^1\.3 Rupee Derivatives/],
  [54, "rtgs", "RTGS, all (large-value transfers)", "Large-value transfers", /^1 Credit Transfers - FMIs/],
  [55, "rtgs_customer", "RTGS, customer transactions", "Large-value transfers", /^1\.1 RTGS-Customer/],
  [56, "rtgs_interbank", "RTGS, interbank transactions", "Large-value transfers", /^1\.2 RTGS-Interbank/],
  [58, "retail_credit", "Retail credit transfers, all (AePS, APBS, ECS, IMPS, NACH, NEFT, UPI)", "Credit transfers", /^2 Credit Transfers - Retail/],
  [59, "aeps_transfer", "AePS fund transfers (Aadhaar-enabled)", "Credit transfers", /^2\.1 AePS \(Fund transfers\)/],
  [60, "apbs", "APBS (Aadhaar payment bridge: subsidies and benefits)", "Credit transfers", /^2\.2 APBS/],
  [61, "ecs_cr", "ECS credit", "Credit transfers", /^2\.3 ECS Cr/],
  [62, "imps", "IMPS (immediate payment service)", "Credit transfers", /^2\.4 IMPS/],
  [63, "nach_cr", "NACH credit (bulk payouts: salaries, dividends, pensions)", "Credit transfers", /^2\.5 NACH Cr/],
  [64, "neft", "NEFT", "Credit transfers", /^2\.6 NEFT/],
  [65, "upi", "UPI", "Credit transfers", /^2\.7 UPI$/],
  [66, "upi_ussd", "UPI over USSD (feature phones, no internet)", "Credit transfers", /^2\.7\.1 of which USSD/],
  [67, "debits", "Debit transfers and direct debits, all", "Debits", /^3 Debit Transfers and Direct Debits/],
  [68, "bhim_aadhaar_pay", "BHIM Aadhaar Pay", "Debits", /^3\.1 BHIM Aadhaar Pay/],
  [69, "ecs_dr", "ECS debit", "Debits", /^3\.2 ECS Dr/],
  [70, "nach_dr", "NACH debit (EMIs, SIPs, bills paid by mandate)", "Debits", /^3\.3 NACH Dr/],
  [71, "netc", "NETC (FASTag tolls, linked to a bank account)", "Debits", /^3\.4 NETC/],
  [72, "cards", "Card payments, all (excluding cash withdrawals)", "Cards", /^4 Card Payments/],
  [73, "credit_cards", "Credit card payments", "Cards", /^4\.1 Credit Cards/],
  [74, "credit_cards_pos", "Credit card payments at PoS terminals", "Cards", /^4\.1\.1 PoS based/],
  [75, "credit_cards_other", "Credit card payments, other (online and elsewhere)", "Cards", /^4\.1\.2 Others/],
  [76, "debit_cards", "Debit card payments", "Cards", /^4\.2 Debit Cards/],
  [77, "debit_cards_pos", "Debit card payments at PoS terminals", "Cards", /^4\.2\.1 PoS based/],
  [78, "debit_cards_other", "Debit card payments, other (online and elsewhere)", "Cards", /^4\.2\.2 Others/],
  [79, "ppi", "Prepaid payment instruments (wallets and prepaid cards), all", "Prepaid instruments", /^5 Prepaid Payment Instruments/],
  [80, "ppi_wallets", "PPI wallets", "Prepaid instruments", /^5\.1 Wallets/],
  [81, "ppi_cards", "PPI cards", "Prepaid instruments", /^5\.2 Cards/],
  [82, "ppi_cards_pos", "PPI cards at PoS terminals", "Prepaid instruments", /^5\.2\.1 PoS based/],
  [83, "ppi_cards_other", "PPI cards, other", "Prepaid instruments", /^5\.2\.2 Others/],
  [84, "paper", "Paper instruments (cheques and drafts), all", "Paper", /^6 Paper based Instruments/],
  [85, "cts", "Cheque Truncation System (CTS, NPCI-managed)", "Paper", /^6\.1 CTS/],
  [86, "paper_other", "Paper instruments, other", "Paper", /^6\.2 Others/],
  [87, "retail_total", "Total retail payments (credit transfers, debits, cards, PPIs, paper)", "Totals", /^Total - Retail Payments/],
  [88, "total", "Total payments (RTGS and retail)", "Totals", /^Total Payments/],
  [89, "digital_total", "Total digital payments (everything but paper)", "Totals", /^Total Digital Payments/],
  [91, "mobile", "Mobile payments (mobile app based)", "Channels", /^1 Mobile Payments/],
  [92, "mobile_intra", "Mobile payments, within the same bank", "Channels", /^1\.1 Intra-bank/],
  [93, "mobile_inter", "Mobile payments, between banks", "Channels", /^1\.2 Inter-bank/],
  [94, "internet", "Internet payments (net banking, browser based)", "Channels", /^2 Internet Payments/],
  [95, "internet_intra", "Internet payments, within the same bank", "Channels", /^2\.1 Intra-bank/],
  [96, "internet_inter", "Internet payments, between banks", "Channels", /^2\.2 Inter-bank/],
  [98, "atm_cash", "Cash withdrawals at ATMs, all", "Cash withdrawals", /^3\s+Cash Withrawal at ATMs/],
  [99, "atm_cash_credit", "Cash withdrawals at ATMs, using credit cards", "Cash withdrawals", /^3\.1 Using Credit Cards/],
  [100, "atm_cash_debit", "Cash withdrawals at ATMs, using debit cards", "Cash withdrawals", /^3\.2 Using Debit Cards/],
  [101, "atm_cash_prepaid", "Cash withdrawals at ATMs, using prepaid cards", "Cash withdrawals", /^3\.3 Using Pre-paid Cards/],
  [102, "pos_cash", "Cash withdrawals at PoS terminals, all", "Cash withdrawals", /^4\. Cash Withrawal at PoS/],
  [103, "pos_cash_debit", "Cash withdrawals at PoS terminals, using debit cards", "Cash withdrawals", /^4\.1 Using Debit Cards/],
  [104, "pos_cash_prepaid", "Cash withdrawals at PoS terminals, using prepaid cards", "Cash withdrawals", /^4\.2 Using Pre-paid Cards/],
  [105, "microatm_cash", "Cash withdrawals at micro ATMs (banking correspondents)", "Cash withdrawals", /^5\s+Cash Withrawal at Micro ATMs/],
  [106, "microatm_cash_aeps", "Cash withdrawals at micro ATMs, using AePS", "Cash withdrawals", /^5\.1 AePS/],
];
// infrastructure: stocks at the end of the month (volume column only)
const NEW_INFRA = [
  [108, "cards", "Cards, all (credit and debit)", "Cards", /^1 Number of Cards/],
  [109, "credit_cards", "Credit cards", "Cards", /^1\.1 Credit Cards/],
  [110, "debit_cards", "Debit cards", "Cards", /^1\.2 Debit Cards/],
  [111, "ppi", "Prepaid payment instruments, all", "Prepaid instruments", /^2 Number of PPIs/],
  [112, "ppi_wallets", "PPI wallets", "Prepaid instruments", /^2\.1 Wallets/],
  [113, "ppi_cards", "PPI cards", "Prepaid instruments", /^2\.2 Cards/],
  [114, "atms", "ATMs, all", "Machines", /^3 Number of ATMs/],
  [115, "atms_bank", "ATMs owned by banks", "Machines", /^3\.1 Bank owned ATMs/],
  [116, "atms_white_label", "White-label ATMs (run by non-banks)", "Machines", /^3\.2 White Label ATMs/],
  [117, "micro_atms", "Micro ATMs (banking correspondents' devices)", "Machines", /^4\s+Number of Micro ATMs/],
  [118, "pos", "PoS terminals (card machines)", "Machines", /^5\s+Number of PoS Terminals/],
  [119, "bharat_qr", "Bharat QR codes", "QR codes", /^6\s+Bharat QR/],
  [146, "upi_qr", "UPI QR codes", "QR codes", /^7 UPI QR/],
];
// header and empty rows of the new layout: section titles that carry no values, and the "B. ATMs"
// title row, which carries zeros for April 2022 to May 2023 (a header, not data)
const NEW_HEADERS = new Set([97]);

/* ---------- report 612, the old layout (April 2004 to October 2019) ---------- */
const OLD = [
  [1, "rtgs", "RTGS, all", "RTGS", /^1 Total RTGS/],
  [2, "rtgs_customer", "RTGS, customer transactions", "RTGS", /^1\.1 Customer Transactions/],
  [3, "rtgs_interbank", "RTGS, interbank transactions", "RTGS", /^1\.2 Interbank Transactions/],
  [4, "rtgs_interbank_clearing", "RTGS, interbank clearing (settlement of other systems)", "RTGS", /^1\.3 Interbank Clearing/],
  [5, "ccil", "CCIL-operated systems, all", "CCIL", /^2 Total CCIL/],
  [6, "ccil_cblo", "CCIL, CBLO (collateralised borrowing and lending)", "CCIL", /^2\.1 CBLO/],
  [7, "ccil_gsec", "CCIL, government securities clearing", "CCIL", /^2\.2 Govt\. Securities Clearing/],
  [8, "ccil_gsec_outright", "CCIL, government securities, outright", "CCIL", /^2\.2\.1 Outright/],
  [9, "ccil_gsec_repo", "CCIL, government securities, repo", "CCIL", /^2\.2\.2 Repo/],
  [42, "ccil_gsec_triparty", "CCIL, government securities, tri-party repo", "CCIL", /^2\.2\.3 Tri-party Repo/],
  [10, "ccil_forex", "CCIL, foreign exchange clearing", "CCIL", /^2\.3 Forex Clearing/],
  [11, "paper", "Paper clearing, all", "Paper", /^3 Total Paper Clearing/],
  [12, "cts", "Cheque Truncation System (CTS)", "Paper", /^3\.1 Cheque Truncation System/],
  [13, "micr", "MICR clearing", "Paper", /^3\.2 MICR Clearing/],
  [14, "micr_rbi", "MICR clearing, RBI centres", "Paper", /^3\.2\.1 RBI Centres/],
  [15, "micr_other", "MICR clearing, other centres", "Paper", /^3\.2\.2 Other Centres/],
  [16, "non_micr", "Non-MICR clearing", "Paper", /^3\.3 Non-MICR Clearing/],
  [17, "retail_electronic", "Retail electronic clearing, all", "Retail electronic", /^4 Total Retail Electronic Clearing/],
  [18, "ecs_dr", "ECS debit", "Retail electronic", /^4\.1 ECS DR/],
  [19, "ecs_cr", "ECS credit (including NECS)", "Retail electronic", /^4\.2 ECS CR/],
  [20, "neft", "EFT and NEFT", "Retail electronic", /^4\.3 EFT\/NEFT/],
  [21, "imps", "IMPS (immediate payment service)", "Retail electronic", /^4\.4 Immediate Payment Service/],
  [40, "nach", "NACH (national automated clearing house)", "Retail electronic", /^4\.6 National Automated Clearing House/],
  [22, "cards", "Card transactions, all", "Cards", /^5 Total Cards Transactions/],
  [23, "credit_cards", "Credit cards, all usage", "Cards", /^5\.1 Credit Cards/],
  [24, "credit_cards_atm", "Credit cards, used at ATMs", "Cards", /^5\.1\.1 CC_Usage at ATMs/],
  [25, "credit_cards_pos", "Credit cards, used at PoS terminals", "Cards", /^5\.1\.2 CC_Usage at POS/],
  [26, "debit_cards", "Debit cards, all usage (including cash at ATMs)", "Cards", /^5\.2 Debit Cards/],
  [27, "debit_cards_atm", "Debit cards, used at ATMs", "Cards", /^5\.2\.1 DC_Usage at ATMs/],
  [28, "debit_cards_pos", "Debit cards, used at PoS terminals", "Cards", /^5\.2\.2 DC_Usage at POS/],
  [29, "ppi", "Prepaid payment instruments, all", "Prepaid instruments", /^6 Total PPIs/],
  [30, "ppi_wallets", "PPI, mobile wallets", "Prepaid instruments", /^6\.1 m-Wallet/],
  [31, "ppi_cards", "PPI cards", "Prepaid instruments", /^6\.2 PPI Cards/],
  [32, "ppi_vouchers", "PPI paper vouchers", "Prepaid instruments", /^6\.3 Paper Vouchers/],
  [33, "mobile_banking", "Mobile banking", "Mobile banking", /^7 Mobile Banking/],
  [39, "total", "Grand total (RTGS customer and interbank, CCIL, paper, retail electronic, cards, PPIs)", "Totals", /Grand Total/],
];
const OLD_INFRA = [
  [34, "cards", "Cards outstanding, all", "Cards", /^8 Total Cards Outstanding/, 1],
  [35, "credit_cards", "Credit cards outstanding", "Cards", /^8\.1 Credit Card/, 1],
  [36, "debit_cards", "Debit cards outstanding", "Cards", /^8\.2 Debit Card/, 1],
  [37, "atms", "ATMs", "Machines", /^9 Number of ATMs/, 1e6],     // stored x 10^6 (see header)
  [38, "pos", "PoS terminals", "Machines", /^10 Number of POS/, 1e6],
];

export async function buildPayments(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const A = (rows) => rows.filter((r) => (r["Unit Description"] ?? "ACTUALS") === "ACTUALS");

  // ---------- read ----------
  const r612 = dbieReport(db, "612");
  const p907 = Object.fromEntries(["DP3", "DP4", "DP5", "DP6"].map((p) => [p, dbieProvider(db, "907", p)]));
  const p678 = Object.fromEntries(["DP0", "DP1"].map((p) => [p, dbieProvider(db, "678", p)]));
  const p936 = Object.fromEntries(["DP2", "DP3", "DP4"].map((p) => [p, dbieProvider(db, "936", p)]));
  const r1404 = dbieReport(db, "1404");
  const wss = databankQuery(db, "rbi_dbie_payment_system_indicators",
    "SELECT observation_date, item_sk, series_description, requested_measure_type, amount_source, max(source_retrieved_at) AS retrieved FROM {table} GROUP BY ALL ORDER BY observation_date, item_sk, requested_measure_type, amount_source");

  // ---------- the audit trail: every row we read, ACTUALS only where DBIE repeats display units ----------
  const strip = (r) => ({ provenance: r.provenance, header: r.header, rows: A(r.rows) });
  const rawRel = "data/raw/payments-dbie.json";
  writeRaw(root, rawRel, {
    vintage,
    note: "RBI DBIE payment system tables, read from the local Data Bank mirror (rbi_dbie_webi_rows) and its parsed WSS dataset. Where DBIE repeats every value once per display unit, only the ACTUALS rows are archived (the others are the same number); provenance gives each report's DBIE id, SAP data provider, Data Bank fetch time and content sha256.",
    reports: {
      "612": strip(r612),
      ...Object.fromEntries(Object.entries(p907).map(([p, r]) => [`907:${p}`, strip(r)])),
      ...Object.fromEntries(Object.entries(p678).map(([p, r]) => [`678:${p}`, strip(r)])),
      ...Object.fromEntries(Object.entries(p936).map(([p, r]) => [`936:${p}`, { provenance: r.provenance, header: r.header, rows: r.rows }])),
      "1404": strip(r1404),
      "rbib43": { provenance: wss.provenance, rows: wss.rows },
    },
  });
  const V = readRaw(root, rawRel).vintage;
  const meta = (extra) => ({ dossier: "payments", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND",
    releaseDate: null, revisionPolicy: dcfg.revision_policy, ...extra });

  // a bundle: axis trimmed to where any series reports, interior nulls declared on the series
  const bundle = (rel, dates, series, extra, gapsNote = "The RBI's table prints no value for this line in these months; left empty.") => {
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
    writeSeries(root, `data/series/${rel}.json`, { meta: meta({ latestPeriod: D.at(-1).slice(0, 7), ...extra }), dates: D, series });
    return { dates: D, series };
  };

  // ---------- 612: index the ACTUALS rows ----------
  const cell = new Map();   // sk|Volume|YYYY-MM-01 -> number
  const desc = new Map();   // sk -> Item Description
  const span = new Map();   // sk -> [first, last] date with a value
  for (const r of A(r612.rows)) {
    const sk = +r["Item Sk"]; desc.set(sk, String(r["Item Description"]).trim());
    const v = num(r.Value); if (v == null) continue;
    const d = ym(r.Date), k = `${sk}|${r["Vv Description"]}|${d}`;
    if (cell.has(k) && cell.get(k) !== v) throw new Error(`payments: report 612 item ${sk} ${r["Vv Description"]} ${d} has two values (${cell.get(k)}, ${v})`);
    cell.set(k, v);
    const s = span.get(sk) ?? [d, d]; if (d < s[0]) s[0] = d; if (d > s[1]) s[1] = d; span.set(sk, s);
  }
  // anchor: the source must have served the headline (UPI volume in the latest month, in a plausible range)
  const lastMonth = [...cell.keys()].filter((k) => k.startsWith("65|Volume|")).map((k) => k.split("|")[2]).sort().at(-1);
  const upiNow = cell.get(`65|Volume|${lastMonth}`);
  if (!lastMonth || !(upiNow > 5e9 && upiNow < 2e11)) throw new Error(`payments: no data returned: UPI volume for the latest month (${lastMonth}: ${upiNow})`);
  // every item with values is mapped (a new RBI line fails until it is named here)
  const mapped = new Set([...NEW, ...NEW_INFRA, ...OLD, ...OLD_INFRA].map((x) => x[0]));
  for (const sk of span.keys()) if (!mapped.has(sk) && !NEW_HEADERS.has(sk)) throw new Error(`payments: report 612 item ${sk} ("${desc.get(sk)}") carries values but is not mapped`);
  for (const [sk, , , , re] of [...NEW, ...NEW_INFRA, ...OLD, ...OLD_INFRA]) {
    if (!desc.has(sk)) throw new Error(`payments: report 612 has no item ${sk} any more`);
    if (!re.test(desc.get(sk))) throw new Error(`payments: report 612 item ${sk} is now "${desc.get(sk)}", expected ${re}`);
  }
  const SEAM = "2019-11-01";
  for (const [sk] of [...OLD, ...OLD_INFRA]) if (span.has(sk) && span.get(sk)[1] >= SEAM) throw new Error(`payments: old-layout item ${sk} has values from ${SEAM}`);
  for (const [sk] of [...NEW, ...NEW_INFRA]) if (span.has(sk) && span.get(sk)[0] < SEAM) throw new Error(`payments: new-layout item ${sk} has values before ${SEAM}`);

  const months = (from, to) => { const out = []; let [y, m] = from.split("-").map(Number); for (;;) { const d = `${y}-${String(m).padStart(2, "0")}-01`; if (d > to) break; out.push(d); m++; if (m > 12) { m = 1; y++; } } return out;};
  const NEWM = months(SEAM, lastMonth), OLDM = months("2004-04-01", "2019-10-01");

  // transactions: <key>_volume (count) and <key>_value (rupees)
  const txSeries = (items, axis) => {
    const out = {};
    for (const [sk, key, label, group] of items) {
      const vol = axis.map((d) => { const v = cell.get(`${sk}|Volume|${d}`); return v == null ? null : Math.round(v); });
      const val = axis.map((d) => { const v = cell.get(`${sk}|Value|${d}`); return v == null ? null : r2(v); });
      out[`${key}_volume`] = { name: `${key}_volume`, label: `${label}, number of transactions`, unit: "count", group, color: key === "upi" ? ACCENT : GREY, data: vol };
      out[`${key}_value`] = { name: `${key}_value`, label: `${label}, value`, unit: "inr_amount", group, color: key === "upi" ? ACCENT : GREY, data: val };
    }
    return out;
  };
  const infraSeries = (items, axis) => Object.fromEntries(items.map(([sk, key, label, group, , scale = 1]) => {
    const data = axis.map((d) => {
      const v = cell.get(`${sk}|Volume|${d}`); if (v == null) return null;
      if (scale !== 1 && v % scale !== 0) throw new Error(`payments: item ${sk} ${d} = ${v} is not a multiple of ${scale}; the x10^6 storage defect has changed`);
      return Math.round(v / scale);
    });
    return [key, { name: key, label, unit: "count", group, color: GREY, data }];
  }));

  const NOTE_SEAM = "The RBI re-organised this table from November 2019; the old layout (April 2004 to October 2019) is a different ruler, baked apart and never joined.";
  bundle("payments-monthly", NEWM, txSeries(NEW, NEWM), {
    frequency: "monthly", base: "re-organised table (from November 2019)", unit: "mixed",
    coverage: "Every payment system the RBI counts, month by month since November 2019: number and value of RTGS, NEFT, IMPS, UPI, NACH, AePS, card, prepaid and cheque payments, mobile and internet channels, and cash withdrawals at ATMs, PoS and micro ATMs",
    note: `RBI Bulletin Table 45, Payment System Indicators, via DBIE report 612 (ACTUALS display unit). Volumes are numbers of transactions; values are rupees. Card payments exclude cash withdrawals, which are their own lines. ${NOTE_SEAM}` });
  bundle("payments-infra", NEWM, infraSeries(NEW_INFRA, NEWM), {
    frequency: "monthly", base: "re-organised table (from November 2019)", unit: "count",
    coverage: "Payment infrastructure at the end of each month since November 2019: credit and debit cards, wallets and prepaid cards, ATMs (bank-owned and white-label), micro ATMs, PoS terminals, Bharat QR and UPI QR codes",
    note: `RBI Bulletin Table 45 via DBIE report 612. Counts of instruments and devices outstanding at the end of the month. ${NOTE_SEAM}` });
  bundle("payments-monthly-2004", OLDM, txSeries(OLD, OLDM), {
    frequency: "monthly", base: "old table (April 2004 to October 2019)", unit: "mixed",
    coverage: "The RBI's payment system table in its old layout, April 2004 to October 2019: RTGS, CCIL, paper clearing, ECS, NEFT, IMPS, NACH, card usage at ATMs and PoS, prepaid instruments and mobile banking, number and value",
    note: "RBI Bulletin Table 45 (old layout) via DBIE report 612 (ACTUALS display unit). Debit and credit card lines include cash drawn at ATMs. UPI is not a line of this layout. Retired in November 2019; never joined to the re-organised table." });
  bundle("payments-infra-2004", OLDM, infraSeries(OLD_INFRA, OLDM), {
    frequency: "monthly", base: "old table (April 2004 to October 2019)", unit: "count",
    coverage: "Cards outstanding (credit, debit), ATMs and PoS terminals, old layout of the RBI's table, to October 2019",
    note: "RBI Bulletin Table 45 (old layout) via DBIE report 612. DBIE stores this layout's ATM and PoS counts multiplied by 10^6; they are divided back here (every stored value is an exact multiple). Retired in November 2019; never joined to the re-organised table." });

  // average size of a payment: value / volume of the same line in the same month (same coverage)
  const avg = {};
  for (const [sk, key, label, group] of NEW) {
    if (["ccil", "ccil_gsec", "ccil_gsec_outright", "ccil_gsec_repo", "ccil_gsec_triparty", "ccil_forex", "ccil_rupee_derivatives"].includes(key)) continue;
    const data = NEWM.map((d) => { const n = cell.get(`${sk}|Volume|${d}`), v = cell.get(`${sk}|Value|${d}`); return n > 0 && v != null ? r2(v / n) : null; });
    avg[key] = { name: `${key}_avg_inr`, label: `${label}, average value of one transaction (derived: value ÷ number)`, unit: "inr", group, color: key === "upi" ? ACCENT : GREY, data };
  }
  bundle("payments-ticket", NEWM, avg, {
    frequency: "monthly", base: "re-organised table (from November 2019)", unit: "inr",
    coverage: "The average size of one payment, month by month, for every retail payment system and cash withdrawal line: UPI, IMPS, NEFT, RTGS, cards, wallets, cheques, ATMs",
    note: "Derived: the value of a line divided by its number of transactions, both from RBI Bulletin Table 45 (DBIE report 612), same line and month. A mean, pulled up by a few large payments; not the typical payment." });

  // ---------- 907: annual, re-organised layout from 2015-16 ----------
  const ANNUAL = [   // [Item Sk in 907, key, the 612 item it should equal when months are summed]
    [123, "rtgs", 54], [125, "retail_credit", 58], [126, "aeps_transfer", 59], [127, "apbs", 60], [128, "ecs_cr", 61], [129, "imps", 62],
    [130, "nach_cr", 63], [131, "neft", 64], [132, "upi", 65], [133, "debits", 67], [134, "bhim_aadhaar_pay", 68], [135, "ecs_dr", 69],
    [136, "nach_dr", 70], [137, "netc", 71], [138, "cards", 72], [139, "credit_cards", 73], [140, "debit_cards", 76], [141, "ppi", 79],
    [142, "paper", 84], [143, "retail_total", 87], [144, "total", 88], [145, "digital_total", 89], [121, "ccil", 45],
  ];
  const ann = new Map(); const annFy = new Set(); const annDesc = new Map();
  for (const [p, vv] of [["DP5", "Volume"], ["DP4", "Value"]]) for (const r of A(p907[p].rows)) {
    const sk = +r["Item Sk"]; annDesc.set(sk, String(r["Item Description"]).trim());
    const v = num(r["Item Value"]); if (v == null) continue;
    ann.set(`${sk}|${vv}|${r["Time Fis Year"]}`, v); if (sk >= 120) annFy.add(r["Time Fis Year"]);
  }
  // whole fiscal years only: the year in progress (its March not yet in report 612) is dropped
  const lastMarch = +lastMonth.slice(5, 7) >= 3 ? +lastMonth.slice(0, 4) : +lastMonth.slice(0, 4) - 1;
  const lastFull = `${lastMarch - 1}-${String(lastMarch).slice(2)}`;   // the fiscal year whose March report 612 has
  const FYS = [...annFy].sort().filter((fy) => fy <= lastFull);
  const newLabel = new Map(NEW.map(([sk, key, label, group]) => [key, [label, group]]));
  const annSeries = {};
  for (const [sk, key] of ANNUAL) {
    const [label, group] = newLabel.get(key);
    annSeries[`${key}_volume`] = { name: `${key}_volume`, label: `${label}, number of transactions`, unit: "count", group, color: key === "upi" ? ACCENT : GREY, data: FYS.map((fy) => { const v = ann.get(`${sk}|Volume|${fy}`); return v == null ? null : Math.round(v); }) };
    annSeries[`${key}_value`] = { name: `${key}_value`, label: `${label}, value`, unit: "inr_amount", group, color: key === "upi" ? ACCENT : GREY, data: FYS.map((fy) => r2(ann.get(`${sk}|Value|${fy}`) ?? null)) };
  }
  bundle("payments-annual", FYS.map(marchOf), annSeries, {
    frequency: "annual", base: "re-organised classification, annual (restated by the RBI from 2015-16)", unit: "mixed",
    coverage: "Every payment system, number and value of transactions in each fiscal year since 2015-16, in the RBI's re-organised classification",
    note: "RBI Handbook of Statistics, Payment System Indicators, via DBIE report 907 (data providers DP5 volume, DP4 value). The RBI restated the years before November 2019 in the re-organised classification; from 2020-21 each year equals the sum of report 612's months (checked in validate), with two exceptions as published: prepaid instruments in 2022-23 are 1.76 crore transactions (₹1,017 crore) below the months' sum, which carries into the totals, and CCIL's 2025-26 volume is 84 trades above it. The year in progress is left out. The RBI's annual table in the old layout (2012-13 to 2017-18) is not used: DBIE stores it at one-hundredth (values) and one-tenth (volumes) of the monthly sums.",
  }, "The RBI's annual table prints no value for this line in these years; left empty.");

  // ---------- 907 DP6/DP3: cheque clearances since 1970-71 ----------
  const CHQ = [[7, 8, "all_india", "All India"], [9, 10, "rbi_centres", "All RBI-managed centres"], [11, 12, "mumbai", "RBI centre, Mumbai"],
    [13, 14, "kolkata", "RBI centre, Kolkata"], [15, 16, "new_delhi", "RBI centre, New Delhi"], [17, 18, "chennai", "RBI centre, Chennai"]];
  const chq = new Map(), chqFy = new Set();
  for (const [p, m] of [["DP6", "number"], ["DP3", "amount"]]) for (const r of A(p907[p].rows)) {
    const v = num(r["Item Value"]); if (v == null) continue; chq.set(`${+r["Item Sk"]}|${r["Time Fis Year"]}`, v); chqFy.add(r["Time Fis Year"]);
  }
  const CF = [...chqFy].sort();
  const chqSeries = {};
  for (const [nsk, ask, key, label] of CHQ) {
    chqSeries[`${key}_number`] = { name: `${key}_number`, label: `${label}, cheques cleared (number)`, unit: "count", group: label, color: key === "all_india" ? ACCENT : GREY, data: CF.map((fy) => chq.has(`${nsk}|${fy}`) ? Math.round(chq.get(`${nsk}|${fy}`)) : null) };
    chqSeries[`${key}_amount`] = { name: `${key}_amount`, label: `${label}, value of cheques cleared`, unit: "inr_amount", group: label, color: key === "all_india" ? ACCENT : GREY, data: CF.map((fy) => r2(chq.get(`${ask}|${fy}`) ?? null)) };
  }
  if (!(chqSeries.all_india_number.data.at(-1) > 1e8)) throw new Error("payments: no data returned: all-India cheque clearances (907 DP6)");
  bundle("payments-cheques-1970", CF.map(marchOf), chqSeries, {
    frequency: "annual", base: "Handbook cheque clearance series (1970-71 to 2015-16)", unit: "mixed",
    coverage: "Cheques cleared in India each year from 1970-71 to 2015-16, number and value, all India and at the four RBI-managed clearing houses (Mumbai, Kolkata, New Delhi, Chennai)",
    note: "RBI Handbook of Statistics, Payment System Indicators (cheque clearances), via DBIE report 907, data providers DP6 (number) and DP3 (amount). The series ends in 2015-16; later cheque volumes are in the monthly payment system table (CTS and paper lines).",
  }, "The RBI's table prints no value for this centre in these years; left empty.");

  // ---------- 678: cheque clearances by clearing centre (STRBI Table 22) ----------
  const ctr = new Map(), ctrFy = new Set(), ctrLab = new Map();
  for (const [p, m] of [["DP1", "number"], ["DP0", "amount"]]) for (const r of A(p678[p].rows)) {
    const v = num(r.Amount); if (v == null) continue;
    const lab = String(r["Item Desc Level2"]).trim(); const fy = r["V T ime D Fis Year"];
    ctr.set(`${lab}|${m}|${fy}`, v); ctrFy.add(fy); ctrLab.set(lab, String(r["Num Chq"]).trim());
  }
  const TF = [...ctrFy].sort();
  const ctrName = (lab) => lab.replace(/^[\d.]+\s+/, "");
  const ctrKey = (lab) => ctrName(lab).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const ctrSeries = {};
  for (const lab of [...ctrLab.keys()].sort((a, b) => +ctrLab.get(a) - +ctrLab.get(b) || a.localeCompare(b))) {
    const group = /^1\.1\.1\.\d/.test(lab) ? "RBI-managed MICR centres" : ctrName(lab);
    for (const [m, unit, what] of [["number", "count", "cheques cleared (number)"], ["amount", "inr_amount", "value of cheques cleared"]])
      ctrSeries[`${ctrKey(lab)}_${m}`] = { name: `${ctrKey(lab)}_${m}`, label: `${ctrName(lab)}, ${what}`, unit, group, color: GREY,
        data: TF.map((fy) => { const v = ctr.get(`${lab}|${m}|${fy}`); return v == null ? null : m === "number" ? Math.round(v) : r2(v); }) };
  }
  bundle("payments-cheques-centres", TF.map(marchOf), ctrSeries, {
    frequency: "annual", base: "STRBI Table 22 (2004-05 on)", unit: "mixed",
    coverage: "Cheques cleared each year by clearing centre, 2004-05 to 2025-26: the RBI-managed centres city by city, other MICR centres, non-MICR centres, and the single national grid from 2024-25",
    note: "RBI Statistical Tables Relating to Banks in India, Table 22, via DBIE report 678 (data providers DP1 number, DP0 amount). The table's centres change: city centres were folded into the three CTS grids (Mumbai, New Delhi, Chennai) by 2019-20 and into one national grid from 2024-25, so no line runs the whole span and the centres do not add to one national total.",
  }, "The RBI's table prints no value for this centre in these years (the centre was merged or not reported); left empty.");

  // ---------- 936: number of clearing houses (STRBI Table 27) ----------
  const intOf = (s) => { const m = /^\s*\(?\s*(\d+)/.exec(String(s ?? "")); return m ? +m[1] : null; };
  const bracket = (s) => { const m = /\(([^)]*)\)/.exec(String(s ?? "")); if (!m) return null; const parts = m[1].match(/\d+/g); return parts ? parts.reduce((a, b) => a + +b, 0) : null; };
  const chYears = new Set(), chTot = new Map(), chMicr = new Map(), chNon = new Map(), chMicrBy = new Map();
  for (const r of p936.DP4.rows) { const y = r["Reporting Year"]; chYears.add(y); chTot.set(y, intOf(r["Micr_Values Str"])); chMicr.set(y, bracket(r["Micr_Values Str"])); }
  for (const r of p936.DP3.rows) { if (r["Micr Description"] === "Total") continue; const v = num(r.clearance_value); if (v != null) chNon.set(`${r["Micr Description"]}|${r["Reporting Year"]}`, v); }
  for (const r of p936.DP2.rows) { const v = bracket(r["Micr_Values Str"]); if (v != null) chMicrBy.set(`${r["Micr Description"]}|${r["Reporting Year"]}`, v); }
  const CY = [...chYears].sort();
  const MGR = ["Reserve Bank of India", "State Bank of India", "Associates of State Bank of India", "Nationalized Banks", "Other"];
  const mk = (s) => s.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, "");
  const chSeries = {
    total: { name: "total", label: "Clearing houses, all", unit: "count", group: "All", color: ACCENT, data: CY.map((y) => chTot.get(y) ?? null) },
    micr: { name: "micr", label: "Clearing houses, of which MICR (machine-read cheques)", unit: "count", group: "All", color: GREY, data: CY.map((y) => chMicr.get(y) ?? null) },
    ...Object.fromEntries(MGR.flatMap((g) => [
      [`${mk(g)}_non_micr`, { name: `${mk(g)}_non_micr`, label: `Clearing houses managed by ${g === "Other" ? "other banks" : g}, non-MICR`, unit: "count", group: g, color: GREY, data: CY.map((y) => chNon.get(`${g}|${y}`) ?? null) }],
      [`${mk(g)}_micr`, { name: `${mk(g)}_micr`, label: `Clearing houses managed by ${g === "Other" ? "other banks" : g}, MICR`, unit: "count", group: g, color: GREY, data: CY.map((y) => chMicrBy.get(`${g}|${y}`) ?? null) }],
    ])),
  };
  if (!(chSeries.total.data[0] > 500)) throw new Error("payments: no data returned: clearing houses (936 DP4)");
  bundle("payments-clearing-houses", CY.map((y) => `${y}-03-01`), chSeries, {
    frequency: "annual", base: "STRBI Table 27 (2005 on)", unit: "count",
    coverage: "How many cheque clearing houses India had each year, 2005 to 2026, MICR and non-MICR, by the bank that managed them",
    note: "RBI Statistical Tables Relating to Banks in India, Table 27, via DBIE report 936 (data providers DP4 total, DP3 non-MICR by manager, DP2 MICR by manager, printed in brackets). Footnote marks in the source (*, $, #) are dropped; where a bracket reads 15+2*, the two are added. The managers' split stops after 2020; the table's 'Total' row in DP3 prints 0 and is not used. Years as the RBI labels them, end-March.",
  }, "The RBI's table prints no value for this line in these years; left empty.");

  // ---------- 1404: e₹ in circulation ----------
  const er = new Map(), erY = new Set(), erLab = new Map();
  for (const r of A(r1404.rows)) { const v = num(r["Cbdc Circ Value"]); const code = +r["Cbdc Circ Code"]; erLab.set(code, String(r["Cbdc Circ Description"]).trim()); if (v == null) continue; er.set(`${code}|${r["Time Fis Year"]}`, v); erY.add(r["Time Fis Year"]); }
  const EY = [...erY].sort();
  const erKey = (code) => ({ 12: "retail", 13: "wholesale", 14: "total" }[code] ?? "retail_" + erLab.get(code).replace(/^₹\s*/, "").replace(/0\.50 paise/, "50_paise").replace(/\s*Notes?$/i, "").replace(/[^0-9a-z_]+/gi, "_").toLowerCase());
  const erSeries = {};
  for (const code of [...erLab.keys()].sort((a, b) => a - b)) {
    const lab = erLab.get(code);
    const label = code === 14 ? "e₹ in circulation, total" : code === 12 ? "e₹ in circulation, retail" : code === 13 ? "e₹ in circulation, wholesale" : `Retail e₹ in ${lab.replace(/ Notes?$/i, "").replace("₹ 0.50 paise", "50 paise").replace(/₹ /, "₹")} tokens`;
    erSeries[erKey(code)] = { name: erKey(code), label, unit: "inr_amount", group: code >= 12 ? "Totals" : "Retail e₹ by denomination", color: code === 14 ? ACCENT : GREY, data: EY.map((fy) => r2(er.get(`${code}|${fy}`) ?? null)) };
  }
  if (!(erSeries.total?.data.at(-1) > 1e8)) throw new Error("payments: no data returned: e₹ in circulation (1404)");
  bundle("payments-erupee", EY.map(marchOf), erSeries, {
    frequency: "annual", base: "e₹ pilots (from December 2022)", unit: "inr_amount",
    coverage: "The RBI's digital rupee (e₹, a central bank digital currency) in circulation at the end of March, 2023 to 2026: retail e₹ by denomination and wholesale e₹",
    note: "RBI Handbook of Statistics, e₹ in Circulation, via DBIE report 1404 (ACTUALS display unit). Values in rupees as on 31 March. Retail e₹ is issued in token denominations like notes. The table counts e₹ held, not how often it is spent.",
  }, "The RBI's table prints no value for this line in this year; left empty.");

  // ---------- RBIB43: the RBI's printed year-on-year growth (WSS) ----------
  const WSSK = { 62: "imps", 63: "nach_cr", 64: "neft", 65: "upi" };
  const wv = new Map(), wd = new Set();
  for (const r of wss.rows) {
    const key = WSSK[r.item_sk]; if (!key) throw new Error(`payments: RBIB43 item ${r.item_sk} (${r.series_description}) is not mapped`);
    const d = r.observation_date.slice(0, 7) + "-01"; const k = `${key}|${r.requested_measure_type}|${d}`;
    const prev = wv.get(k); if (prev && prev.retrieved > r.retrieved) continue;   // the latest retrieval of a date wins
    wv.set(k, { v: r.amount_source, retrieved: r.retrieved }); wd.add(d);
  }
  const WD = months([...wd].sort()[0], [...wd].sort().at(-1));
  const wssSeries = {};
  for (const key of Object.values(WSSK)) for (const [mt, m] of [["Volume", "volume"], ["Value", "value"]])
    wssSeries[`${key}_${m}_yoy`] = { name: `${key}_${m}_yoy_pct`, label: `${newLabel.get(key)[0]}, ${m === "volume" ? "number of transactions" : "value"}, growth on a year earlier (as printed by the RBI)`, unit: "pct_yoy", group: newLabel.get(key)[1], color: key === "upi" ? ACCENT : GREY,
      data: WD.map((d) => { const x = wv.get(`${key}|${mt}|${d}`); return x == null ? null : Math.round(x.v * 100) / 100; }) };
  bundle("payments-growth-wss", WD, wssSeries, {
    frequency: "monthly", base: "re-organised table (from November 2019)", unit: "pct_yoy",
    coverage: "The RBI's own printed year-on-year growth of IMPS, NACH credit, NEFT and UPI, number and value, each month since May 2022",
    note: "RBI Weekly Statistical Supplement, payment systems (DBIE RBIB43), from the Data Bank's parsed dataset rbi_dbie_payment_system_indicators, the latest retrieval of each month. Published growth rates, kept as printed; validate checks them against growth computed from report 612's levels.",
  }, "The RBI's weekly supplement prints no growth for this line in these months; left empty.");
  console.log(`payments: report 612 to ${lastMonth}; UPI ${(upiNow / 1e7).toFixed(2)} crore transactions`);
}

/* ---------- catalogue (docs/CONTRACT-coverage.md) ----------
 * Every DBIE report in the Data Bank's catalogue under the "Payment Systems" menus, the Bulletin
 * and Handbook payment tables and the e₹ table, plus the parsed WSS dataset. Reports this guide
 * reads are itemised from their own rows:
 *   payments:612:<new|old>:<item sk>-<slug>:<volume|value>   transactions
 *   payments:612:<new|old>:infra:<item sk>-<slug>             stocks (cards, ATMs, PoS, QR)
 *   payments:612:header:<item sk>-<slug>                      a title row that carries values
 *   payments:907:<new|old>:<item sk>-<slug>:<volume|value>    annual, by layout
 *   payments:907:cheques:<item sk>-<slug>:<number|amount>     cheques since 1970-71
 *   payments:678:<centre>:<number|amount>
 *   payments:936:<total|micr|manager>:<micr|non-micr>
 *   payments:1404:<code>-<slug>
 *   payments:rbib43:<item>:<volume|value>
 *   payments:report:<id>                                      a copy of a table read under another id
 * plus the international comparison the RBI does not publish (bis:cpmi). */
import { writeCatalogue, idPart, catalogueCli, sourceCfg } from "../catalogue.mjs";
import { bisSeriesKeys } from "../bis.mjs";
export async function cataloguePayments() {
  const { cfg } = sourceCfg("payments");
  const db = databankRoot(cfg?.families?.databank);
  const cat = databankQuery(db, "rbi_dbie_report_catalog",
    "SELECT DISTINCT report_id, report_name, menu FROM {table} WHERE menu LIKE '%Payment System%' OR report_id IN ('61','612','778','824','907','662','678','743','936','1404') ORDER BY report_id").rows;
  const items = [];
  const slug = (s) => idPart(String(s).replace(/[@$*#]/g, "").trim()).slice(0, 48).replace(/-+$/, "");
  const READ = new Set(["612", "907", "678", "936", "1404"]);
  const seen = new Set();
  for (const r of cat) {
    if (seen.has(r.report_id)) continue; seen.add(r.report_id);
    if (!READ.has(r.report_id)) { items.push({ id: `payments:report:${r.report_id}`, label: `${r.report_name.trim()} (${r.menu})` }); continue; }
    if (r.report_id === "612") {
      const span = new Map(), vv = new Map(), desc = new Map();
      for (const x of dbieReport(db, "612").rows) {
        if (x["Unit Description"] !== "ACTUALS") continue;
        const sk = +x["Item Sk"]; desc.set(sk, x["Item Description"]);
        if (x.Value === "") continue;
        const d = x.Date.slice(0, 10); const s = span.get(sk) ?? [d, d]; if (d < s[0]) s[0] = d; if (d > s[1]) s[1] = d; span.set(sk, s);
        (vv.get(sk) ?? vv.set(sk, new Set()).get(sk)).add(x["Vv Description"]);
      }
      const infra = new Set([...NEW_INFRA, ...OLD_INFRA].map((x) => x[0]));
      for (const [sk, s] of span) {
        const lay = s[1] < "2019/11" ? "old" : "new";
        const base = `payments:612:${NEW_HEADERS.has(sk) ? "header" : lay}:${infra.has(sk) ? "infra:" : ""}${sk}-${slug(desc.get(sk))}`;
        if (infra.has(sk) || NEW_HEADERS.has(sk)) items.push({ id: base, label: desc.get(sk).trim() });
        else for (const m of vv.get(sk)) items.push({ id: `${base}:${m.toLowerCase()}`, label: `${desc.get(sk).trim()}, ${m.toLowerCase()}` });
      }
    } else if (r.report_id === "907") {
      for (const [p, m] of [["DP5", "volume"], ["DP4", "value"]]) for (const x of dbieProvider(db, "907", p).rows) {
        if (x["Unit Description"] !== "ACTUALS" || x["Item Value"] === "") continue;
        const sk = +x["Item Sk"];
        items.push({ id: `payments:907:${sk >= 120 ? "new" : "old"}:${sk}-${slug(x["Item Description"])}:${m}`, label: `${x["Item Description"].trim()}, ${m}, annual` });
      }
      for (const [p, m] of [["DP6", "number"], ["DP3", "amount"]]) for (const x of dbieProvider(db, "907", p).rows)
        if (x["Unit Description"] === "ACTUALS") items.push({ id: `payments:907:cheques:${x["Item Sk"]}-${slug(x["Item Hierarchy Level 2"])}:${m}`, label: `Cheque clearances, ${x["Item Hierarchy Level 2"]}, ${m}` });
    } else if (r.report_id === "678") {
      for (const [p, m] of [["DP1", "number"], ["DP0", "amount"]]) for (const x of dbieProvider(db, "678", p).rows)
        if ((x["Unit Description"] ?? "ACTUALS") === "ACTUALS") items.push({ id: `payments:678:${slug(x["Item Desc Level2"])}:${m}`, label: `Cheque clearances, ${x["Item Desc Level2"].trim()}, ${m}` });
    } else if (r.report_id === "936") {
      items.push({ id: "payments:936:total", label: "Clearing houses, total" }, { id: "payments:936:total:micr", label: "Clearing houses, MICR (bracketed in the total)" });
      for (const [p, m] of [["DP3", "non-micr"], ["DP2", "micr"]]) for (const x of dbieProvider(db, "936", p).rows)
        items.push({ id: `payments:936:${slug(x["Micr Description"])}:${m}`, label: `Clearing houses managed by ${x["Micr Description"]}, ${m}` });
    } else if (r.report_id === "1404") {
      for (const x of dbieReport(db, "1404").rows) if (x["Unit Description"] === "ACTUALS") items.push({ id: `payments:1404:${x["Cbdc Circ Code"]}-${slug(x["Cbdc Circ Description"])}`, label: `e₹ in circulation, ${x["Cbdc Circ Description"].trim()}` });
    }
  }
  for (const x of databankQuery(db, "rbi_dbie_payment_system_indicators", "SELECT DISTINCT item_sk, series_description, requested_measure_type FROM {table} ORDER BY item_sk, requested_measure_type").rows)
    items.push({ id: `payments:rbib43:${x.item_sk}-${slug(x.series_description)}:${x.requested_measure_type.toLowerCase()}`, label: `RBI WSS growth, ${x.series_description}, ${x.requested_measure_type.toLowerCase()}` });
  // international comparison: the BIS CPMI payment statistics for India (the official
  // cross-country source; the RBI reports to it). Listed from BIS itself; values would come
  // from the Data Bank, which does not mirror these dataflows yet.
  for (const flow of ["WS_CPMI_CASHLESS", "WS_CPMI_DEVICES", "WS_CPMI_INSTITUT", "WS_CPMI_PARTICIP", "WS_CPMI_SYSTEMS", "WS_CPMI_MACRO", "WS_CPMI_CT1", "WS_CPMI_CT2"]) {
    let keys;
    try { keys = (await bisSeriesKeys(flow)).keys; } catch (e) { items.push({ id: `bis:cpmi:${idPart(flow)}:unlisted`, label: `BIS CPMI ${flow}: key listing failed (${e.message.slice(0, 80)})` }); continue; }
    const india = keys.filter((k) => k.REP_CTY === "IN" || k.REF_AREA === "IN" || Object.values(k).includes("IN"));
    for (const k of india) items.push({ id: `bis:cpmi:${idPart(flow)}:${Object.entries(k).filter(([d]) => !["FREQ"].includes(d)).map(([, v]) => idPart(v)).join("-")}`, label: `BIS CPMI ${flow}, India, ${Object.values(k).join(".")}` });
  }
  writeCatalogue("payments", { source: "Reserve Bank of India: payment system statistics (DBIE, via the local Data Bank); BIS CPMI key listings for the international comparison",
    generator: "scripts/lib/products/payments.mjs --catalogue",
    note: "Reports from the Data Bank's rbi_dbie_report_catalog (every Payment Systems menu, the Bulletin and Handbook payment tables, cheque and clearing-house tables, e₹); the five reports read are itemised from their own rows (ACTUALS display unit). BIS CPMI series keys for India from stats.bis.org.", items });
}
await catalogueCli(import.meta.url, cataloguePayments);
