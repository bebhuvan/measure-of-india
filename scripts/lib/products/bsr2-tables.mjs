// scripts/lib/products/bsr2-tables.mjs: every other BSR-2 deposit table (wave 2, 2026-10-10),
// called from bsr2.mjs. Read from the Data Bank's DBIE mirror (read-only, scripts/lib/databank.mjs).
//
// WHAT THE COLUMNS MEAN. DBIE exports these tables as "Dimension 1..4" and "Measure 1..15"
// with no column titles. Each table's measures are named below from RBI's published table
// layout AND proved by identities that must hold in every row, or the bake fails:
//   by type of deposit (tables 2.1-2.3, 2.7-2.10, 2.12): offices; current, savings, term and
//     total deposits, each as accounts and amount. current + savings + term = total.
//   by broad ownership (2.4-2.6, 3.1, 3.4-3.7): individuals (including HUF), of which
//     women, and others. individuals + others = total; women sit INSIDE individuals, which
//     is why these tables "do not partition" if women are read as a third group.
//   by owning sector (1.1, 1.3-1.5): general government, non-financial corporations,
//     financial corporations (deposit-taking, of which banks; other financial), households,
//     rest of the world. Table 1.3/1.4 columns: government, NFC, deposit-taking FC, of which
//     banks, other FC, households, rest of world, total; total = the six without "banks".
//   tables 1.x print a total INCLUDING deposits of banks with banks (interbank), tables 2.x
//     and 3.x EXCLUDE them: 2026 all-India 266.55 (1.x) less 5.78 (banks) = 260.76 (2.x).
//   by bank group (1.5, 2.2, 2.5, 3.3, 4.2): public sector, foreign, regional rural, private,
//     small finance, payments banks; their sum is the all-banks total.
//   maturity tables (3.x) are ORIGINAL maturity, except 3.4 (residual maturity, in bsr2.mjs).
//   employees (4.1, 4.2): officers, clerks, subordinates, total; then the same for women.
// THE SIGNED VALUES. Rows with an empty first dimension, printed under each data row, carry
// negative numbers: they are each cell's per cent share of its column, printed with a minus
// sign (Grand Total = -100; checked: 1.596986/73.327313 = 2.1779% = the printed -2.1779).
// They are derived, so they are skipped; shares are recomputed on the page where drawn.
// DUPLICATES. District tables print every cell twice (WebI fan-out); identical repeats are
// collapsed, a repeat with a different value is left out and counted in the bundle note.
// QUARTERLY BSR-2 (from March 2023) covers scheduled commercial banks EXCLUDING regional
// rural banks (RBI, release of 29 May 2026), so it is a different instrument from the annual
// return: its own bundles (deposits-q-*), never joined to the annual ones.
//
// Hand checks against RBI's own release (press release 2026-2027/..., 29 May 2026, "Annual
// BSR-2: Deposits with SCBs, March 2026"):
//   households 59.3% of deposits      -> table 1.1: 158,096,146,025,000 / 266,546,061,626,000 = 59.31%
//   savings 28.7%, term 61.6% of deposits -> table 1.1 grand total row: 28.73%, 61.60%
//   term deposits of 1-3 years' original maturity 69.8% -> table 3.1: 69.78%
//   senior citizens (60 and above) 20.0% of deposits -> table 2.11: (28,457,978,085,000 +
//     24,858,661,224,000) / 266,546,061,626,000 = 20.00%
//   payments banks hold no term deposits -> table 3.3 last column pair is 0 in every row.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { dbieReport } from "../databank.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const num = (s) => { const t = String(s ?? "").replace(/,/g, "").trim(); if (t === "") return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const slug = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48);
const crore = (v) => (v == null ? null : Math.round(v / 1e5) / 100);   // rupees -> ₹ crore, 2 dp
const dateOf = (q) => `${q.slice(0, 4)}-${q.slice(5, 7)}-01`;           // "2026/03/31 00:00:00" -> "2026-03-01"

/* ---------- normalisers: one label per thing, whatever case the table prints ---------- */
const SMALL = new Set(["and", "of", "the"]);
const title = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ").split(" ").map((w, i) => (i && SMALL.has(w) ? w : w.replace(/(^|[(\-/])([a-z])/g, (m, a, b) => a + b.toUpperCase()))).join(" ");
const isAll = (s) => /^(all[- ]?india|grand total|total|all-india scb's|all india scb's)$/i.test(String(s).trim());
const POP = { rural: ["rural", "Rural", 0], "semi-urban": ["semi_urban", "Semi-urban", 1], urban: ["urban", "Urban", 2], metropolitan: ["metro", "Metropolitan", 3] };
const pop = (s) => { const t = String(s).trim().toLowerCase(); if (isAll(t)) return { key: "all_india", label: "All India", order: 9 }; const p = POP[t]; return p ? { key: p[0], label: p[1], order: p[2] } : null; };
const BG = [[/public sector/i, "psb", "Public sector banks"], [/foreign/i, "foreign", "Foreign banks"], [/regional rural/i, "rrb", "Regional rural banks"],
  [/private sector/i, "private", "Private sector banks"], [/small finance/i, "sfb", "Small finance banks"], [/payments? bank/i, "payments", "Payments banks"]];
const bg = (s) => { if (isAll(s)) return { key: "all_banks", label: "All banks", order: 9 }; const i = BG.findIndex(([re]) => re.test(s)); return i < 0 ? null : { key: BG[i][1], label: BG[i][2], order: i }; };
const MAT = ["Less than 91 days", "91 days & above but less than 6 months", "6 months & above but less than 1 year", "1 year & above but less than 3 years", "3 years & above but less than 5 years", "5 years & above"];
const MATL = ["Less than 91 days", "91 days to 6 months", "6 months to 1 year", "1 to 3 years", "3 to 5 years", "5 years and above"];
const mat = (s) => { if (isAll(s)) return { key: "all", label: "All maturities", order: 9 }; const i = MAT.findIndex((m) => m.toLowerCase() === String(s).trim().toLowerCase()); return i < 0 ? null : { key: `m${i + 1}_${slug(MATL[i])}`, label: MATL[i], order: i }; };
const REGION = /REGION$/i;
const place = (s) => { const t = String(s).trim(); if (isAll(t)) return { key: "all_india", label: "All India", order: 0, group: "All India" };
  return { key: slug(t), label: title(t).replace(/^Nct of Delhi$/, "Delhi"), order: REGION.test(t) ? 1 : 2, group: REGION.test(t) ? "Region" : "State" }; };
const sector = (s) => { const t = String(s).trim().replace(/\s+/g, " "); if (isAll(t)) return { key: "total", label: "All sectors", order: 999 };
  // keyed by the sector's code alone: the wording drifts between returns ("1 General Government
  // Sector" in 2019, "1 General Government" later) while the code does not
  const m = /^(\d+(?:\.\d+)*)\s+(.*)$/.exec(t); if (!m) return null;
  const name = m[2].replace(/\s+Sector$/i, "").replace(/of which\s+Female/i, "of which women").replace(/Non -Government/, "Non-government");
  return { key: `s${m[1].replace(/\./g, "_")}`, label: `${m[1]} ${name}`, order: m[1].split(".").reduce((a, x, i) => a + Number(x) * 100 ** (3 - i), 0) }; };
const age = (s) => { const t = String(s).trim(); const AG = ["Less Than 10 years", "10 years and above but less than 15 years", "15 years and above but less than 18 years", "18 years and above but less than 25 years", "25 years and above but less than 40 years", "40 years and above but less than 60 years", "60 years and above but less than 70 years", "70 years and above"];
  const AL = ["Under 10", "10 to 14", "15 to 17", "18 to 24", "25 to 39", "40 to 59", "60 to 69", "70 and above"];
  const i = AG.findIndex((a) => a.toLowerCase() === t.toLowerCase()); return i < 0 ? null : { key: `a${i + 1}_${slug(AL[i])}`, label: `Aged ${AL[i].toLowerCase()}`, order: i }; };
const who = (s) => ({ INDIVIDUALS: { key: "individuals", label: "Individuals", order: 0 }, FEMALE: { key: "women", label: "Women", order: 1 }, 410: { key: "individuals", label: "Individuals", order: 0 }, 411: { key: "women", label: "Women", order: 1 } })[String(s).trim()] ?? null;
const keep = (s) => (String(s).trim() ? { key: slug(s), label: title(s), order: 0 } : null);

/* ---------- measure sets ---------- */
const A = (key, label) => ({ key, label, kind: "amount" });
const C = (key, label) => ({ key, label, kind: "count" });
const TYPE9 = [C("offices", "Bank offices"), C("current_accounts", "Current accounts"), A("current", "Current deposits"), C("savings_accounts", "Savings accounts"), A("savings", "Savings deposits"),
  C("term_accounts", "Term deposit accounts"), A("term", "Term deposits"), C("total_accounts", "All deposit accounts"), A("total", "All deposits")];
const TYPE8 = TYPE9.slice(1);
const BROAD8 = [C("individuals_accounts", "Accounts of individuals"), A("individuals", "Deposits of individuals"), C("women_accounts", "Accounts of women"), A("women", "Deposits of women"),
  C("others_accounts", "Accounts of others"), A("others", "Deposits of others"), C("total_accounts", "All accounts"), A("total", "All deposits")];
const OWN6 = [C("individuals_accounts", "Term accounts of individuals"), A("individuals", "Term deposits of individuals"), C("others_accounts", "Term accounts of others"), A("others", "Term deposits of others"),
  C("total_accounts", "All term accounts"), A("total", "All term deposits")];
const OWN4 = [A("current", "Current deposits"), A("savings", "Savings deposits"), A("term", "Term deposits"), A("total", "All deposits")];
const SECT8 = [A("government", "General government"), A("nfc", "Non-financial corporations"), A("deposit_taking", "Deposit-taking financial corporations"), A("banks", "of which banks"),
  A("other_fc", "Other financial corporations"), A("households", "Households"), A("rest_of_world", "Rest of the world"), A("total", "All sectors")];
const BG7 = [A("psb", "Public sector banks"), A("foreign", "Foreign banks"), A("rrb", "Regional rural banks"), A("private", "Private sector banks"), A("sfb", "Small finance banks"), A("all_banks", "All banks"), A("payments", "Payments banks")];
const POP5 = [A("rural", "Rural"), A("semi_urban", "Semi-urban"), A("urban", "Urban"), A("metro", "Metropolitan"), A("all_india", "All India")];
const pairs = (list) => list.flatMap(([k, l]) => [C(`${k}_accounts`, `${l}, term accounts`), A(k, `${l}, term deposits`)]);
const MATPOP10 = pairs([["rural", "Rural"], ["semi_urban", "Semi-urban"], ["urban", "Urban"], ["metro", "Metropolitan"], ["all_india", "All India"]]);
const MATBG14 = pairs([["psb", "Public sector banks"], ["foreign", "Foreign banks"], ["rrb", "Regional rural banks"], ["private", "Private sector banks"], ["sfb", "Small finance banks"], ["all_banks", "All banks"], ["payments", "Payments banks"]]);
const MAT2 = [C("accounts", "Term deposit accounts"), A("amount", "Term deposits")];
const EMP8 = [C("officers", "Officers"), C("clerks", "Clerks"), C("subordinates", "Subordinate staff"), C("total", "All employees"),
  C("women_officers", "Women officers"), C("women_clerks", "Women clerks"), C("women_subordinates", "Women subordinate staff"), C("women_total", "All women employees")];
const AGE6 = [C("current_accounts", "Current accounts"), A("current", "Current deposits"), C("savings_accounts", "Savings accounts"), A("savings", "Savings deposits"), A("term", "Term deposits"), A("total", "All deposits")];
const DIST3 = [C("offices", "Bank offices"), C("accounts", "Deposit accounts"), A("amount", "Deposits")];

/* ---------- identities (raw rupees and counts, per row) ---------- */
// counts must add to within 2; amounts to within ₹3 crore (the March 2019 rows were migrated
// at crore precision, so three rounded parts can miss their rounded total by up to 1.5 crore)
const closeC = (a, b) => a == null || b == null || Math.abs(a - b) <= Math.max(2, Math.abs(b) * 1e-9);
const close = (a, b) => a == null || b == null || Math.abs(a - b) <= Math.max(3e7, Math.abs(b) * 1e-9);
const sum = (o, ks) => ks.every((k) => o[k] != null) ? ks.reduce((a, k) => a + o[k], 0) : null;
const ID = {
  type: (o) => closeC(sum(o, ["current_accounts", "savings_accounts", "term_accounts"]), o.total_accounts) && close(sum(o, ["current", "savings", "term"]), o.total),
  broad: (o) => closeC(sum(o, ["individuals_accounts", "others_accounts"]), o.total_accounts) && close(sum(o, ["individuals", "others"]), o.total) && (o.women == null || o.women <= o.individuals + 2),
  own6: (o) => closeC(sum(o, ["individuals_accounts", "others_accounts"]), o.total_accounts) && close(sum(o, ["individuals", "others"]), o.total),
  own4: (o) => close(sum(o, ["current", "savings", "term"]), o.total),
  sect8: (o) => close(sum(o, ["government", "nfc", "deposit_taking", "other_fc", "households", "rest_of_world"]), o.total) && (o.banks == null || o.banks <= o.deposit_taking + 2),
  bg7: (o) => close(sum(o, ["psb", "foreign", "rrb", "private", "sfb", "payments"]), o.all_banks),
  pop5: (o) => close(sum(o, ["rural", "semi_urban", "urban", "metro"]), o.all_india),
  matpop: (o) => close(sum(o, ["rural", "semi_urban", "urban", "metro"]), o.all_india) && closeC(sum(o, ["rural_accounts", "semi_urban_accounts", "urban_accounts", "metro_accounts"]), o.all_india_accounts),
  matbg: (o) => close(sum(o, ["psb", "foreign", "rrb", "private", "sfb", "payments"]), o.all_banks) && closeC(sum(o, ["psb_accounts", "foreign_accounts", "rrb_accounts", "private_accounts", "sfb_accounts", "payments_accounts"]), o.all_banks_accounts),
  emp: (o) => closeC(sum(o, ["officers", "clerks", "subordinates"]), o.total) && closeC(sum(o, ["women_officers", "women_clerks", "women_subordinates"]), o.women_total) && o.women_total <= o.total,
  age6: (o) => close(sum(o, ["current", "savings", "term"]), o.total),
  age8: (o) => closeC(sum(o, ["current_accounts", "savings_accounts", "term_accounts"]), o.total_accounts) && close(sum(o, ["current", "savings", "term"]), o.total),
  none: () => true,
};

/* ---------- the tables ---------- */
// dims: [column, normaliser]; the first dimension empty marks a percentage-share row (skipped).
// measures: the Measure columns in order (null skips one). freq: annual (as on 31 March) or quarterly.
const T = (id, slug, table, title, dims, measures, id_, extra = {}) => ({ id, slug, table, title, dims, measures, ident: id_, ...extra });
const D1 = "Dimension 1", D2 = "Dimension 2", D3 = "Dimension 3", D4 = "Dimension 4";
const ANNUAL = [
  T("1200", "deposits-sectors", "1.1", "Deposits by owning sector and type of account", [[D1, sector]], OWN4, "own4"),
  T("848", "deposits-states-sectors", "1.3", "Deposits by state and owning sector", [[D1, place]], SECT8, "sect8"),
  T("849", "deposits-metros-sectors", "1.4", "Deposits in metropolitan centres by owning sector", [[D1, (s) => (isAll(s) ? place(s) : { ...keep(s), group: "Metropolitan centre" })]], SECT8, "sect8"),
  T("850", "deposits-bankgroups-sectors", "1.5", "Deposits by owning sector and bank group", [[D1, sector]], BG7, "bg7"),
  T("851", "deposits-population-type", "2.1", "Deposits by population group and type of account", [[D1, pop]], TYPE9, "type"),
  T("852", "deposits-bankgroups-type", "2.2", "Deposits by bank group and type of account", [[D1, bg]], TYPE9, "type"),
  T("853", "deposits-states-type", "2.3", "Deposits by state and type of account", [[D1, place]], TYPE9, "type"),
  T("854", "deposits-population-owners", "2.4", "Deposits of individuals, women and others by population group", [[D1, pop]], BROAD8, "broad"),
  T("855", "deposits-bankgroups-owners", "2.5", "Deposits of individuals, women and others by bank group", [[D1, bg]], BROAD8, "broad"),
  T("856", "deposits-states-owners", "2.6", "Deposits of individuals, women and others by state", [[D1, place]], BROAD8, "broad"),
  T("857", "deposits-districts", "2.7", "Deposits by district and population group", [[D2, place], [D3, keep], [D4, pop]], DIST3, "none", { group: 0, district: true }),
  T("858", "deposits-states-population-type", "2.8", "Deposits by state, population group and type of account", [[D2, place], [D3, pop]], TYPE9, "type", { group: 0 }),
  T("859", "deposits-states-bankgroups-type", "2.9", "Deposits by state, bank group and type of account", [[D2, place], [D3, bg]], TYPE9, "type", { group: 0 }),
  T("860", "deposits-bankgroups-population-type", "2.10", "Deposits by bank group, population group and type of account", [[D1, bg], [D2, pop]], TYPE9, "type", { group: 0 }),
  T("1554", "deposits-districts-gender", "2.12", "Deposits of individuals and of women by district", [[D2, place], [D3, keep], [D4, who]], TYPE8, "type", { group: 0, district: true, bakeOnly: ["total_accounts", "total"] }),
  T("861", "deposits-maturity-owners", "3.1", "Term deposits by original maturity, individuals and others", [[D1, mat]], OWN6, "own6"),
  T("862", "deposits-maturity-population", "3.2", "Term deposits by original maturity and population group", [[D1, mat]], MATPOP10, "matpop"),
  T("863", "deposits-maturity-bankgroups", "3.3", "Term deposits by original maturity and bank group", [[D1, mat]], MATBG14, "matbg"),
  T("867", "deposits-maturity-population-owners", "3.7", "Term deposits by population group, original maturity, individuals and others", [[D1, pop], [D2, mat, "all"]], OWN6, "own6", { group: 0 }),
  T("868", "deposits-maturity-states", "3.8", "Term deposits by state and original maturity", [[D2, place], [D1, mat]], MAT2, "none", { group: 0 }),
  T("869", "deposits-employees-states", "4.1", "Bank employees by state, post and gender", [[D1, place]], EMP8, "emp"),
  T("870", "deposits-employees-bankgroups", "4.2", "Bank employees by population group, bank group, post and gender", [[D1, pop], [D2, bg]], EMP8, "emp", { group: 0 }),
  T("1260", "deposits-age", "2.11", "Deposits of individuals and of women by age", [[D2, who], [D1, age]], AGE6, "age6", { group: 0, layout2023: true }),
];
const QUARTERLY = [
  T("1302", "deposits-q-sectors", "1.1", "Deposits by owning sector and type of account", [[D1, sector]], OWN4, "own4"),
  T("1304", "deposits-q-states-sectors", "1.3", "Deposits by state and owning sector", [[D1, place]], SECT8, "sect8"),
  T("1305", "deposits-q-metros-sectors", "1.4", "Deposits in metropolitan centres by owning sector", [[D1, (s) => (isAll(s) ? place(s) : { ...keep(s), group: "Metropolitan centre" })]], SECT8, "sect8"),
  T("1306", "deposits-q-bankgroups-sectors", "1.5", "Deposits by owning sector and bank group", [[D1, sector]], BG7, "bg7"),
  T("1307", "deposits-q-population-type", "2.1", "Deposits by population group and type of account", [[D1, pop]], TYPE9, "type"),
  T("1308", "deposits-q-bankgroups-type", "2.2", "Deposits by bank group and type of account", [[D1, bg]], TYPE9, "type"),
  T("1309", "deposits-q-states-type", "2.3", "Deposits by state and type of account", [[D1, place]], TYPE9, "type"),
  T("1310", "deposits-q-population-owners", "2.4", "Deposits of individuals, women and others by population group", [[D1, pop]], BROAD8, "broad"),
  T("1311", "deposits-q-bankgroups-owners", "2.5", "Deposits of individuals, women and others by bank group", [[D1, bg]], BROAD8, "broad"),
  T("1312", "deposits-q-states-owners", "2.6", "Deposits of individuals, women and others by state", [[D1, place]], BROAD8, "broad"),
  T("1314", "deposits-q-states-population-type", "2.8", "Deposits by state, population group and type of account", [[D2, place], [D3, pop]], TYPE9, "type", { group: 0 }),
  T("1315", "deposits-q-states-bankgroups-type", "2.9", "Deposits by state, bank group and type of account", [[D2, place], [D3, bg]], TYPE9, "type", { group: 0 }),
  T("1316", "deposits-q-bankgroups-population-type", "2.10", "Deposits by bank group, population group and type of account", [[D1, bg], [D2, pop]], TYPE9, "type", { group: 0 }),
  T("1317", "deposits-q-maturity-owners", "3.1", "Term deposits by original maturity, individuals and others", [[D1, mat]], OWN6, "own6"),
  T("1318", "deposits-q-maturity-population", "3.2", "Term deposits by original maturity and population group", [[D1, mat]], MATPOP10, "matpop"),
  T("1319", "deposits-q-maturity-bankgroups", "3.3", "Term deposits by original maturity and bank group", [[D1, mat]], MATBG14, "matbg"),
  T("1320", "deposits-q-term-maturity", "3.4", "Term deposits by residual maturity, individuals and others", [[D1, mat]], OWN6, "own6"),
  T("1321", "deposits-q-term-rates", "3.5", "Term deposits by interest rate, individuals and others", [[D1, keep]], OWN6, "own6"),
  T("1322", "deposits-q-term-size", "3.6", "Term deposits by size of deposit, individuals and others", [[D1, keep]], OWN6, "own6"),
  T("1323", "deposits-q-maturity-population-owners", "3.7", "Term deposits by population group, original maturity, individuals and others", [[D1, pop], [D2, mat, "all"]], OWN6, "own6", { group: 0 }),
  T("1324", "deposits-q-maturity-states", "3.8", "Term deposits by state and original maturity", [[D2, place], [D1, mat]], MAT2, "none", { group: 0 }),
  T("1325", "deposits-q-employees-states", "4.1", "Bank employees by state, post and gender", [[D1, place]], EMP8, "emp"),
  T("1326", "deposits-q-employees-bankgroups", "4.2", "Bank employees by population group, bank group, post and gender", [[D1, pop], [D2, bg]], EMP8, "emp", { group: 0 }),
  T("1346", "deposits-q-age", "2.11", "Deposits of individuals and of women by age", [[D2, who], [D1, age]], [...TYPE8.slice(0, 4), C("term_accounts", "Term deposit accounts"), A("term", "Term deposits"), C("total_accounts", "All deposit accounts"), A("total", "All deposits")], "age8", { group: 0, layout2023: true }),
];
// archive-only (deep-archive tier): quarterly district tables
const ARCHIVE_ONLY = [
  T("1313", "deposits-q-districts", "2.7", "Deposits by district and population group, quarterly", [[D2, place], [D3, keep], [D4, pop]], DIST3, "none", { district: true }),
  T("1556", "deposits-q-districts-gender", "2.12", "Deposits of individuals and of women by district, quarterly", [[D2, place], [D3, keep], [D4, who]], TYPE8, "type", { district: true }),
];

/* ---------- reading one table into cells ---------- */
function readTable(rep, t) {
  const mCols = rep.header.filter((h) => /^Measure \d+$/.test(h));
  const cells = new Map();        // rowKey|date -> { dims, date, vals: {measureKey: number} }
  let conflicts = 0, dup = 0;
  for (const r of rep.rows) {
    if (!String(r[t.dims[0][0]] ?? "").trim()) continue;                // a percentage-share row
    const q = r["Quarter Date"]; if (!q) continue;
    if (t.layout2023 && /^\d+$/.test(String(r[D2]).trim())) continue;    // read by readCodedAge
    const dims = [];
    let skip = false;
    for (const [col, norm, dflt] of t.dims) {
      const v = String(r[col] ?? "").trim();
      const d = v ? norm(v) : dflt === "all" ? { key: "all", label: "All maturities", order: 9 } : null;
      if (!d) { skip = true; break; }
      dims.push(d);
    }
    if (skip) { if (!t.lenient) throw new Error(`BSR-2 ${t.id} (table ${t.table}): unrecognised row ${t.dims.map(([c]) => r[c]).join(" / ")}`); continue; }
    const date = dateOf(q);
    // the 2023 age table (report 1260) codes its groups and prints a different layout
    const measures = t.measures;
    const vals = {};
    measures.forEach((m, i) => { if (m) vals[m.key] = num(r[mCols[i]]); });
    const k = dims.map((d) => d.key).join("|") + "|" + date;
    const prev = cells.get(k);
    if (prev) {
      const same = measures.every((m) => !m || prev.vals[m.key] === vals[m.key]);
      if (same) { dup++; continue; }
      conflicts++; prev.conflict = true; continue;
    }
    cells.set(k, { dims, date, vals });
  }
  for (const [k, c] of cells) if (c.conflict) cells.delete(k);
  return { cells, conflicts, dup };
}

/* ---------- cells -> a bundle ---------- */
function toBundle(t, cells, freq, metaBase) {
  const dates = [...new Set([...cells.values()].map((c) => c.date))].sort();
  const series = {};
  const order = [];
  let bad = 0; const badRows = [];
  for (const c of cells.values()) {
    if (!ID[t.ident](c.vals)) { bad++; if (badRows.length < 5) badRows.push(`${c.dims.map((d) => d.label).join(" / ")} ${c.date}: ${JSON.stringify(c.vals)}`); }
    const rowKey = c.dims.map((d) => d.key).join("__");
    for (const m of t.measures) {
      if (!m || (t.bakeOnly && !t.bakeOnly.includes(m.key))) continue;
      const key = `${rowKey}__${m.key}`.slice(0, 120);
      if (!series[key]) {
        const g = c.dims[t.group ?? 0];
        series[key] = { name: key, label: `${m.label} · ${c.dims.map((d) => d.label).join(" · ")}`, group: g.group ?? g.label, unit: m.kind === "amount" ? "inr_crore" : "count",
          color: GREYS[order.length % GREYS.length], data: new Array(dates.length).fill(null), _o: [...c.dims.map((d) => d.order), t.measures.indexOf(m)] };
        order.push(key);
      }
      const v = c.vals[m.key];
      series[key].data[dates.indexOf(c.date)] = v == null ? null : m.kind === "amount" ? crore(v) : v;
    }
  }
  if (bad) throw new Error(`BSR-2 ${t.id} (table ${t.table}): ${bad} rows break the "${t.ident}" identity that names its columns, e.g.\n  ${badRows.join("\n  ")}`);
  // ordered by the table's own order: first dimension, then the others, then the measure
  const keys = Object.keys(series).sort((a, b) => { const x = series[a]._o, y = series[b]._o; for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return a < b ? -1 : 1; });
  const out = {};
  for (const k of keys) {
    const s = series[k]; delete s._o;
    // drop a series the table prints as all zero or empty: there is nothing to read
    if (!s.data.some((v) => v != null)) continue;
    const first = s.data.findIndex((v) => v != null), last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = s.data.map((v, i) => (v == null && i > first && i < last ? dates[i] : null)).filter(Boolean);
    if (gaps.length) { s.gaps = gaps; s.gapsNote = t.district ? "RBI's table has no row for this place in these years (district boundaries and names change between returns); left empty." : "RBI's table prints no value here for these years; left empty."; }
    out[k] = s;
  }
  return { meta: { ...metaBase, frequency: freq, latestPeriod: dates.at(-1).slice(0, 7) }, dates, series: out };
}

/* ---------- table 2.11 in 2023: groups coded 441-448 and 451-458 ---------- */
// In the 2023 returns (annual March 2023; quarterly March and June 2023) the export codes the
// eight age groups as numbers instead of INDIVIDUALS / FEMALE. 441-448 are individuals and
// 451-458 women, each in age order: fixed by matching each block's all-India sum to table
// 2.6 (women 39,005.96 against 39,005.93 thousand crore; individuals 99,797 against 1,00,519,
// the age table running about 1% short of table 2.6 in every year, 2026 included). In those
// rows the ACCOUNT COUNTS are stored multiplied by 1,000: every one is a whole multiple of
// 1,000, and divided back they run on into the next quarter's uncoded counts (70 and above,
// current accounts: 6,435,778 in March 2023, 6,434,655 in September). They are divided back.
// The annual export carries Measures 1, 2, 3, 4, 6, 8 (no term or total accounts); the
// quarterly one all eight.
function readCodedAge(rep, t, ai856) {
  const rows = rep.rows.filter((r) => /^\d+$/.test(String(r[D2]).trim()) && String(r[D1]).trim());
  if (!rows.length) return [];
  const mCols = rep.header.filter((h) => /^Measure \d+$/.test(h));
  const byName = (r, m) => num(r[m]);
  const ACC = ["current_accounts", "savings_accounts", "term_accounts", "total_accounts"];
  const out = [];
  for (const r of rows) {
    const code = +String(r[D2]).trim();
    const w = code >= 441 && code <= 448 ? who("INDIVIDUALS") : code >= 451 && code <= 458 ? who("FEMALE") : null;
    const a = age(r[D1]);
    if (!w || !a) throw new Error(`BSR-2 ${t.id}: unknown coded row ${r[D2]} / ${r[D1]}`);
    if ((code % 10) - 1 !== a.order) throw new Error(`BSR-2 ${t.id}: code ${code} is not age group ${a.label}`);
    const vals = {};
    t.measures.forEach((m, i) => { if (m) vals[m.key] = byName(r, mCols[i]); });
    for (const k of ACC) if (vals[k] != null) {
      if (vals[k] % 1000 !== 0) throw new Error(`BSR-2 ${t.id}: coded ${code} ${k} = ${vals[k]} is not a multiple of 1,000; the x1000 storage no longer holds`);
      vals[k] /= 1000;
    }
    out.push({ dims: [w, a], date: dateOf(r["Quarter Date"]), vals });
  }
  if (ai856) {
    const date = out[0].date, sumOf = (k) => out.filter((c) => c.date === date && c.dims[0].key === k).reduce((x, c) => x + (c.vals.total ?? 0), 0);
    const near = (x, y) => Math.abs(x - y) / y < 0.015;
    if (!near(sumOf("individuals"), ai856.vals.individuals) || !near(sumOf("women"), ai856.vals.women))
      throw new Error(`BSR-2 ${t.id}: coded blocks (${sumOf("individuals")}, ${sumOf("women")}) do not match table 2.6 (${ai856.vals.individuals}, ${ai856.vals.women})`);
  }
  return out;
}

/* ---------- archive staging (deep-archive tier, PLAN-launch §2b) ---------- */
const STAGE = "data/archive/staging/deposits";
const csvCell = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
function stageLong(root, file, header, rows) {
  fs.mkdirSync(path.join(root, STAGE), { recursive: true });
  const lines = [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))];
  fs.writeFileSync(path.join(root, STAGE, file), zlib.gzipSync(lines.join("\n") + "\n", { level: 9, mtime: 0 }));
  return { file: `${STAGE}/${file}`, rows: rows.length };
}

/* ---------- 1199: the old district table, 2009-10 to 2017-18 ---------- */
// District x population group x bank group, accounts and amount, nine years, under the old
// bank groups (SBI and its associates apart from nationalised banks). Too fine for a bundle
// (53,236 rows): the full table goes to the deep archive, and the state totals it adds up to
// are baked as deposits-states-2010 (sums of the district rows, labelled as such).
function bake1199(root, rep, metaBase, V) {
  const rows = rep.rows.map((r) => ({ fy: r["Time Fis Year"], region: r["Region Name"], state: r["State Name"], district: r["District Name"], pop: r["Population Group Name"], bg: r["Bank Group Name"], acc: num(r["Number Of Accounts"]), amt: num(r["Amount Outstanding"]) }));
  const marchOf = (fy) => `20${fy.slice(5, 7)}-03-01`;
  const staged = stageLong(root, "bsr2-1199-district-popgroup-bankgroup-2010-2018.csv.gz",
    ["date", "financial_year", "region", "state", "district", "population_group", "bank_group", "accounts", "amount_rupees", "source", "vintage"],
    rows.map((r) => [marchOf(r.fy), r.fy, r.region, r.state, r.district, r.pop, r.bg, r.acc, r.amt, "RBI DBIE report 1199 (BSR-2), via the Data Bank", V]).sort((a, b) => (a[0] + a[3] + a[4] + a[5] + a[6] < b[0] + b[3] + b[4] + b[5] + b[6] ? -1 : 1)));
  const dates = [...new Set(rows.map((r) => marchOf(r.fy)))].sort();
  const agg = new Map();
  const add = (k, lab, grp, d, r) => { const o = agg.get(k) ?? agg.set(k, { lab, grp, acc: new Map(), amt: new Map() }).get(k); o.acc.set(d, (o.acc.get(d) ?? 0) + (r.acc ?? 0)); o.amt.set(d, (o.amt.get(d) ?? 0) + (r.amt ?? 0)); };
  for (const r of rows) {
    const d = marchOf(r.fy), st = place(r.state);
    add(`${st.key}`, st.label, "State", d, r);
    add(`all_india`, "All India", "All India", d, r);
    const p = pop(r.pop); if (p) add(`all_india__${p.key}`, `All India · ${p.label}`, "Population group", d, r);
    add(`all_india__${slug(r.bg)}`, `All India · ${title(r.bg)}`, "Bank group", d, r);
  }
  const series = {};
  let i = 0;
  for (const [k, o] of [...agg].sort((a, b) => (a[1].grp === "All India" ? -1 : b[1].grp === "All India" ? 1 : a[0] < b[0] ? -1 : 1))) {
    for (const [m, lab, unit, map] of [["accounts", "Deposit accounts", "count", o.acc], ["amount", "Deposits", "inr_crore", o.amt]]) {
      const data = dates.map((d) => (map.has(d) ? (unit === "inr_crore" ? crore(map.get(d)) : map.get(d)) : null));
      const s = { name: `${k}__${m}`, label: `${lab} · ${o.lab}`, group: o.grp, unit, color: GREYS[i++ % GREYS.length], data };
      const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
      const gaps = data.map((v, j) => (v == null && j > first && j < last ? dates[j] : null)).filter(Boolean);
      if (gaps.length) { s.gaps = gaps; s.gapsNote = "No district rows for this state in these years."; }
      series[`${k}__${m}`] = s;
    }
  }
  return { staged, bundle: { meta: { ...metaBase, frequency: "annual", latestPeriod: dates.at(-1).slice(0, 7),
    coverage: "Deposits and deposit accounts by state, by population group and by bank group (old bank groups: SBI and its associates, nationalised, regional rural, private, foreign, small finance), as on 31 March 2010 to 2018",
    note: "RBI DBIE report 1199 (BSR-2, district x population group x bank group). DERIVED: each series is the sum of the report's district rows (the report prints no state or all-India rows); the full district table is in the deep archive. A different classification and population-group basis from the tables that start in March 2019; never joined to them." },
    dates, series } };
}

/* ---------- the run ---------- */
export function buildBsr2Tables(root, db, dcfg, V) {
  const metaBase = { dossier: "deposits", base: "as on 31 March", unit: "mixed", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy };
  const raw = {}, rawBig = [];
  const report = (id) => { const r = dbieReport(db, id); return r; };
  const written = [];
  const notes = {};
  const cellsOf = {};
  for (const [list, freq] of [[ANNUAL, "annual"], [QUARTERLY, "quarterly"], [ARCHIVE_ONLY, "quarterly"]]) for (const t of list) {
    const rep = report(t.id);
    // raw audit trail: small reports in one committed dump; district-sized ones staged for the archive
    if (rep.rows.length > 5000) rawBig.push({ t, rep });
    else raw[t.id] = { table: t.table, title: t.title, provenance: rep.provenance, header: rep.header, rows: rep.rows.map((r) => rep.header.map((h) => r[h])) };
    const { cells, conflicts, dup } = readTable(rep, t);
    if (t.layout2023) {
      const ai = t.id === "1260" ? [...cellsOf["856"].values()].find((c) => c.dims[0].key === "all_india" && c.date === "2023-03-01") : null;
      for (const c of readCodedAge(rep, t, ai)) cells.set(c.dims.map((d) => d.key).join("|") + "|" + c.date, c);
    }
    cellsOf[t.id] = cells;
    if (!cells.size) throw new Error(`BSR-2 ${t.id} (table ${t.table}): no data rows read`);
    const b = toBundle(t, cells, freq, metaBase);
    const isQ = list !== ANNUAL;
    b.meta.base = isQ ? "end of quarter" : "as on 31 March";
    b.meta.coverage = `${t.title}${isQ ? ", quarterly (scheduled commercial banks excluding regional rural banks)" : ", as on 31 March"}. Amounts in ₹ crore; accounts, offices and employees as counts.`;
    b.meta.note = `RBI BSR-2 Table ${t.table}${isQ ? " (quarterly)" : ""} via DBIE report ${t.id}, read from the Data Bank mirror. Column meanings are fixed by identities checked on every row (scripts/lib/products/bsr2-tables.mjs).` +
      (isQ ? " The quarterly return leaves out regional rural banks, so it is a different total from the annual return; never joined to it." : "") +
      (/^(1\.[0-9])$/.test(t.table) ? " Tables 1.x include deposits of banks with other banks; tables 2.x and 3.x leave them out." : "") +
      (t.layout2023 ? " The 2023 returns code the age groups as numbers and store account counts multiplied by 1,000; both are undone here (see the adapter header)." : "") +
      (conflicts ? ` ${conflicts} cells printed twice with different values were left out.` : "") + (dup ? ` The export prints ${dup} cells twice; the repeats are identical and were collapsed.` : "");
    if (t.bakeOnly) b.meta.note += " Baked here: all-deposit accounts and amount for individuals and for women; the split by type of account is in the deep archive.";
    if (list === ARCHIVE_ONLY || t.bakeOnly) {
      // the full long table, every measure, staged for the archive
      const long = [];
      for (const c of cells.values()) for (const m of t.measures) if (m && c.vals[m.key] != null) long.push([c.date, ...c.dims.map((d) => d.label), m.key, m.kind === "amount" ? "rupees" : "count", c.vals[m.key], `RBI DBIE report ${t.id} (BSR-2 table ${t.table})`, V]);
      long.sort((a, b) => (a.slice(0, -4).join("|") < b.slice(0, -4).join("|") ? -1 : 1));
      notes[t.id] = stageLong(root, `bsr2-${t.id}-${t.slug.replace(/^deposits-/, "")}.csv.gz`, ["date", ...t.dims.map(([c], i) => ["state", "district", "population_group"][i] ?? c), "measure", "unit", "value", "source", "vintage"], long);
      if (list === ARCHIVE_ONLY) continue;
    }
    writeSeries(root, `data/series/${t.slug}.json`, b);
    written.push({ slug: t.slug, series: Object.keys(b.series).length, dates: b.dates.length });
  }
  // the 2010-2018 district table
  const r1199 = report("1199");
  rawBig.push({ t: { id: "1199", table: "district", title: "Bank deposits by region, state, district, bank group and population group" }, rep: r1199 });
  const { staged, bundle } = bake1199(root, r1199, metaBase, V);
  notes["1199"] = staged;
  writeSeries(root, "data/series/deposits-states-2010.json", bundle);
  written.push({ slug: "deposits-states-2010", series: Object.keys(bundle.series).length, dates: bundle.dates.length });

  // audit trail: the small reports committed; the large ones staged (gzipped JSON) with a committed index
  writeRaw(root, "data/raw/bsr2-tables.json", { vintage: V, note: "RBI DBIE BSR-2 tables (wave 2), read from the local Data Bank mirror: header and rows as read, per report, with Data Bank provenance. District-sized reports are staged in data/archive/staging/deposits/ and indexed in data/raw/bsr2-tables-index.json.", reports: raw });
  const index = [];
  for (const { t, rep } of rawBig) {
    const file = `bsr2-raw-${t.id}.json.gz`;
    const body = JSON.stringify({ report: t.id, title: t.title, provenance: rep.provenance, header: rep.header, rows: rep.rows.map((r) => rep.header.map((h) => r[h])) });
    fs.mkdirSync(path.join(root, STAGE), { recursive: true });
    const gz = zlib.gzipSync(body, { level: 9, mtime: 0 });
    fs.writeFileSync(path.join(root, STAGE, file), gz);
    const sha = (await_sha(gz));
    index.push({ report: t.id, table: t.table, file: `${STAGE}/${file}`, rows: rep.rows.length, sha256: sha, retrieved_at: rep.provenance.retrieved_at, databank_sha256: rep.provenance.sha256 });
  }
  // archive indexes stay plain JSON (test/raw-gzip.test.mjs exempts *-index.json; trade's is plain):
  // writeRaw gzips, so the index is written directly, stable and diffable
  fs.writeFileSync(path.join(root, "data/raw/bsr2-tables-index.json"), JSON.stringify({ vintage: V, note: "Index of the district-sized BSR-2 reports held in the deep-archive staging folder (gzipped JSON, header and rows as read). sha256 is of the stored .json.gz file.", files: index, archive: Object.values(notes) }, null, 1) + "\n");
  console.log(`bsr2 tables: ${written.length} bundles, ${written.reduce((a, w) => a + w.series, 0).toLocaleString("en-IN")} series; ${Object.keys(notes).length} archive files staged`);
  return written;
}
import crypto from "node:crypto";
const await_sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
export { ANNUAL, QUARTERLY, ARCHIVE_ONLY };
