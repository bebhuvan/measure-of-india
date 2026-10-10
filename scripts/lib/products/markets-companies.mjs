// scripts/lib/products/markets-companies.mjs: how Indian companies are doing, from the RBI's
// annual studies of company finances (DBIE "Corporate Sector": non-government non-financial
// public and private limited companies, foreign direct investment companies, non-banking
// financial and investment companies), read from the local Data Bank mirror (read-only).
//
// HOW A STUDY WORKS (and why the bundles look the way they do). Each year the RBI takes the
// audited accounts of a sample of companies that filed for two (sometimes three) consecutive
// years and publishes, for that one sample: growth rates of items (this year on last year),
// ratios, and the rupee levels of the income account, balance sheet and sources and uses of
// funds. The next year's study is a different sample. So:
//   - a growth rate or ratio for year t is read from the study of year t (the study whose latest
//     year is t): one comparable, same-companies figure per year. These are the `-*` bundles
//     with no suffix; the same study's figure for the year before (a different sample's view of
//     year t-1) goes to `-prior` bundles, never mixed with the first;
//   - rupee LEVELS are never chained across studies (two samples are two rulers): level bundles
//     hold one series per item per study, `<item>__s<study>`, each covering only that study's own
//     years.
// THE FORMAT SEAM. Studies up to 2018-19 use the old reporting format ("Historical" in DBIE);
// from the 2020-21 study the RBI moved to the Ind AS format ("Latest": other equity, comprehensive
// income, non-current/current split). There is no 2019-20 study. The two formats are two rulers:
// separate bundles (`-2011` for the old), registered in sources.yml seams (markets-companies).
//
// Values: rates and ratios in per cent, except items the RBI marks "*" (current ratio, interest
// coverage), which are times. Levels are rupees in the source, baked as ₹ crore. Every report
// repeats rupee levels once per display unit: one unit (ACTUALS) is kept. The DBIE "Special
// Character" marks footnotes; empty cells (and "#", "-" special values) are left empty.
//
// Hand checks (2026-10-10), against the RBI's press release of 30 March 2026 on the finances of
// non-government non-financial public limited companies, 2024-25 (prid 62475, 7,992 companies):
//   markets-co-public-growth   2024-25 net sales 7.8, operating expenses 8.4, operating profit 8.4,
//                              companies 7,992 = release 7.8 / 8.4 / 8.4 / 7,992.
//   markets-co-public-growth-industry  manufacturing 6.3, services 10.1 = release 6.3 / 10.1.
// Company counts: report 1173's count table holds one unlabelled row per size class; their sum per
// study (7,992 for 2024-25) is the release's total, so unlabelled count rows are summed.
import { databankRoot, dbieProvider, dbieProviders } from "../databank.mjs";
import { writeRaw, readRaw } from "../util.mjs";
import { num, crore, r2, fyStart, slug, tidy, oneUnit, assemble, emit, ser } from "./markets-lib.mjs";

const SRC = "Reserve Bank of India, studies of company finances (DBIE, via the local Data Bank)";
// [report, company type, statement key, kind, cut]
export const CFD = [
  // non-government non-financial PUBLIC limited companies
  ["1173", "public", "growth", "rate", null], ["1182", "public", "ratios", "rate", null],
  ["1178", "public", "income", "level", null], ["1189", "public", "liabilities", "level", null],
  ["1195", "public", "assets", "level", null], ["1172", "public", "sources", "level", null],
  ["1197", "public", "uses", "level", null], ["1186", "public", "forex", "level", null],
  ["1201", "public", "growth", "rate", "sales"], ["1194", "public", "ratios", "rate", "sales"],
  ["1177", "public", "growth", "rate", "puc"], ["1206", "public", "ratios", "rate", "puc"],
  ["1183", "public", "growth", "rate", "industry"], ["1208", "public", "ratios", "rate", "industry"],
  // PRIVATE limited companies
  ["1179", "private", "growth", "rate", null], ["1187", "private", "ratios", "rate", null],
  ["1175", "private", "income", "level", null], ["1176", "private", "liabilities", "level", null],
  ["1188", "private", "assets", "level", null], ["1184", "private", "sources", "level", null],
  ["1203", "private", "uses", "level", null], ["1181", "private", "forex", "level", null],
  ["1204", "private", "growth", "rate", "industry"], ["1202", "private", "ratios", "rate", "industry"],
  // FOREIGN DIRECT INVESTMENT companies (10% or more held by one foreign investor)
  ["1170", "fdi", "growth", "rate", null], ["1166", "fdi", "ratios", "rate", null],
  ["1191", "fdi", "income", "level", null], ["1148", "fdi", "liabilities", "level", null],
  ["1146", "fdi", "assets", "level", null], ["1171", "fdi", "sources", "level", null],
  ["1147", "fdi", "uses", "level", null], ["1192", "fdi", "forex", "level", null],
  ["1167", "fdi", "growth", "rate", "industry"], ["1193", "fdi", "ratios", "rate", "industry"],
  ["1185", "fdi", "growth", "rate", "country"], ["1196", "fdi", "ratios", "rate", "country"],
  ["1180", "fdi", "growth", "rate", "ownership"],
  ["1190", "fdi", "distribution", "count", "country"],
  // non-government NON-BANKING FINANCIAL and investment companies, by activity (to 2018-19)
  ["731", "nbfc", "growth", "rate", "activity"], ["732", "nbfc", "ratios", "rate", "activity"],
  ["738", "nbfc", "income", "level", "activity"], ["739", "nbfc", "liabilities", "level", "activity"],
  ["742", "nbfc", "assets", "level", "activity"], ["753", "nbfc", "sources", "level", "activity"],
  ["754", "nbfc", "uses", "level", "activity"],
];
export const TYPE_LABEL = { public: "Public limited companies", private: "Private limited companies", fdi: "Foreign direct investment companies", nbfc: "Non-bank financial and investment companies" };
export const STMT_LABEL = { growth: "Growth rates", ratios: "Financial ratios", income: "Income and appropriation account", liabilities: "Balance sheet: equity and liabilities", assets: "Balance sheet: assets", sources: "Sources of funds", uses: "Uses of funds", forex: "Earnings and spending in foreign currency", distribution: "Number of companies by industry and country of origin" };
export const CUT_LABEL = { sales: "Size of sales", puc: "Size of paid-up capital", industry: "Industry", country: "Country of origin", ownership: "Public or private limited", activity: "Activity" };
const CUT_COL = { sales: ["Puc Description"], puc: ["Puc Description"], industry: ["Cfd Industry Name"], country: ["Country Name"], ownership: ["Cfd Industry Name"], activity: ["Investement Type Description"] };
const FMT_BASE = { latest: "Ind AS format (studies 2020-21 on)", historical: "Old reporting format (studies 2011-12 to 2018-19)", nbfc: "NBFC study format (studies 2013-14 to 2018-19)" };

// column access, CFD and NBFC layouts differ
const studyOf = (r) => r["Time Fis Year"] ?? r["Actual Year"];
const yearOf = (r) => r["Year"] ?? r["Financial Year"];
// the format column names the format; a report without one (the foreign-currency statements,
// discontinued after the 2018-19 study) takes it from the study year
const fmtOf = (r, type) => (type === "nbfc" ? "nbfc" : /^latest/i.test(r["Report Tab Format"] ?? "") ? "latest" : /^histor/i.test(r["Report Tab Format"] ?? "") ? "historical"
  : r["Report Tab Format"] == null && studyOf(r) ? (+studyOf(r).slice(0, 4) >= 2020 ? "latest" : "historical") : null);
// a provider that only counts the companies in each study (by cut where given): a "no of companies"
// column, an item named as such, or a value with no item at all
const COUNT_ITEM = /no_of_companies|number of compan/i;
const isCountProvider = (p, rows) => rows.length > 0 && ("no of companies" in rows[0]
  || ("Item Description" in rows[0] ? rows.every((r) => COUNT_ITEM.test(r["Item Description"] ?? "")) : ("Item Value" in rows[0] || "Item Value_distinct" in rows[0])));

/** The item outline of one report in one format: a stable key and a readable label for every
 *  item, disambiguating repeated descriptions ("Rent" as income and as expense, "Others" under
 *  several headings) by their parent heading. Levels from the item's own code: a letter heading,
 *  a number, "(a)", a roman numeral; an item with no code hangs under the item before it. */
function outline(rows) {
  const items = new Map();
  for (const r of rows) {
    const code = r["Item Sk"] ?? r["Item Code"] ?? r["Item Display Order"];
    const k = `${code}|${tidy(r["Item Description"])}`;
    if (!items.has(k)) items.set(k, { k, code, order: Number(r["Item Display Order"]) || 0, desc: tidy(r["Item Description"]).replace(/^\d+\.\s*/, ""),
      rc: String(r["Report Code"] ?? r["Item Code Level2"] ?? "").trim() || String(r["Item Code Level1"] ?? "").trim() });
  }
  const list = [...items.values()].sort((a, b) => a.order - b.order || String(a.code).localeCompare(String(b.code)));
  const lvl = (rc) => (/^[A-F]$/.test(rc) ? 0 : /^[IVX]+\.?$/.test(rc) ? 0 : /^\d+$/.test(rc) ? 1 : /^\([a-z]\)$/.test(rc) ? 2 : /^\(?[ivx]+\)?$/.test(rc) ? 3 : null);
  const stack = [];
  for (const it of list) {
    let L = lvl(it.rc);
    if (L == null) L = (stack.at(-1)?.L ?? 0) + 1;
    else while (stack.length && stack.at(-1).L >= L) stack.pop();
    it.parent = stack.length ? stack.at(-1).it : null;
    if (lvl(it.rc) != null) stack.push({ L, it });
  }
  const count = new Map();
  for (const it of list) count.set(it.desc.toLowerCase(), (count.get(it.desc.toLowerCase()) ?? 0) + 1);
  const used = new Set();
  for (const it of list) {
    const dup = count.get(it.desc.toLowerCase()) > 1;
    it.label = dup && it.parent ? `${it.parent.desc}: ${it.desc}` : it.desc;
    let key = slug(it.label, 70);
    if (used.has(key)) key = `${key}_${slug(String(it.code))}`;
    used.add(key);
    it.key = key;
  }
  return new Map(list.map((it) => [it.k, it]));
}

export async function buildMarketsCompanies(root, dcfg, VINTAGE, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  // read every report: the data provider (largest non-count provider) and the company counts
  const R = {};
  for (const [id, type] of CFD) {
    const provs = dbieProviders(db, id).map((p) => ({ ...p, r: dbieProvider(db, id, p.id) }));
    const counts = provs.filter((p) => isCountProvider(p, p.r.rows));
    const data = provs.filter((p) => !counts.includes(p)).sort((a, b) => b.r.rows.length - a.r.rows.length)[0];
    if (!data || !data.r.rows.length) throw new Error(`markets-companies: report ${id} has no data provider with rows`);
    const unitCol = ["Unit Description"].find((c) => c in data.r.rows[0]);
    const rows = unitCol ? oneUnit(data.r.rows, unitCol) : data.r.rows;
    R[id] = { type, provenance: data.r.provenance, header: data.r.header, rows,
      counts: counts.map((p) => ({ provenance: p.r.provenance, header: p.r.header, rows: p.r.rows })) };
  }
  // the listed private manufacturing companies' half-yearly sources and uses (discontinued 2019)
  const H = dbieProvider(db, "1075", "DP0");

  // ---------- the audit trail ----------
  const pack = (header, rows) => ({ header, rows: rows.map((r) => header.map((h) => r[h] ?? "")) });
  const rawRel = "data/raw/markets-companies.json";
  writeRaw(root, rawRel, {
    vintage: VINTAGE,
    note: "RBI company finance studies (DBIE Corporate Sector reports), read from the local Data Bank mirror. Rows are stored as arrays under each report's header; rupee reports keep one display unit (ACTUALS). counts: the report's number-of-companies providers. Provenance: DBIE report id, SAP data provider, Data Bank fetch time and content sha256 of the full file.",
    reports: Object.fromEntries(Object.entries(R).map(([id, x]) => [id, { provenance: x.provenance, ...pack(x.header, x.rows), counts: x.counts.map((c) => ({ provenance: c.provenance, ...pack(c.header, c.rows) })) }])),
    "1075": { provenance: H.provenance, ...pack(H.header, H.rows) },
  });
  const V = readRaw(root, rawRel).vintage;
  const META = { dossier: "markets-companies", source: SRC, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy, frequency: "annual" };
  const out = [];
  const put = (s, extra, built) => out.push(emit(root, s, META, extra, built));

  for (const [id, type, stmt, kind, cut] of CFD) {
    const { rows, counts } = R[id];
    const byFmt = new Map();
    for (const r of rows) {
      const f = fmtOf(r, type);
      if (!f) throw new Error(`markets-companies ${id}: row with no report format: ${JSON.stringify(r).slice(0, 200)}`);
      if (!byFmt.has(f)) byFmt.set(f, []);
      byFmt.get(f).push(r);
    }
    for (const [fmt, frows] of byFmt) {
      const items = outline(frows);
      const name = `markets-co-${type}-${stmt}${cut ? "-" + cut : ""}${fmt === "historical" ? "-2011" : ""}`;
      const cutOf = (r) => (cut ? tidy(CUT_COL[cut].map((c) => r[c]).find((x) => x != null && String(x).trim() !== "")) : null);
      const studies = [...new Set(frows.map(studyOf))].sort();
      const common = {
        base: FMT_BASE[fmt], product: `DBIE report ${id}`, companyType: TYPE_LABEL[type], statement: STMT_LABEL[stmt], cut: cut ? CUT_LABEL[cut] : null,
        studies, coverage: `${TYPE_LABEL[type]}: ${STMT_LABEL[stmt].toLowerCase()}${cut ? ", by " + CUT_LABEL[cut].toLowerCase() : ""}, from the RBI's annual studies (${studies[0]} to ${studies.at(-1)} studies)`,
      };
      const unitOfItem = (it, r) => (kind === "count" || COUNT_ITEM.test(it.desc) ? "count" : kind === "level" ? "inr_crore" : String(r["Special Character"] ?? "").trim() === "*" ? "times" : "pct");
      const valOf = (r) => { const v = num(r["Item Value"]); return COUNT_ITEM.test(r["Item Description"] ?? "") || kind === "count" ? v : kind === "level" ? crore(v) : r2(v); };
      if (kind === "rate" || kind === "count") {
        // offset 0: the study's own latest year; offset 1: the year before, same study; ...
        const byOff = new Map();
        for (const r of frows) {
          const it = items.get(`${r["Item Sk"] ?? r["Item Code"] ?? r["Item Display Order"]}|${tidy(r["Item Description"])}`);
          const v = valOf(r);
          const off = +studyOf(r).slice(0, 4) - +yearOf(r).slice(0, 4);
          if (!byOff.has(off)) byOff.set(off, new Map());
          const c = cutOf(r);
          const key = c ? `${slug(c, 40)}__${it.key}` : it.key;
          const s = ser(byOff.get(off), key, { label: c ? `${c}: ${it.label}` : it.label, unit: unitOfItem(it, r), ...(c ? { group: c } : {}) });
          if (v != null || !s.values.has(fyStart(yearOf(r)))) s.values.set(fyStart(yearOf(r)), v);
        }
        // number of companies in each study (by cut where the RBI gives it), on the offset-0 bundle
        // A count table without a cut column can still hold one unlabelled row per size class (report
        // 1173: six rows a study, summing to the RBI's published 7,992 companies for 2024-25): its
        // rows are summed per study, and one table's total replaces another's, never adds to it.
        for (const c of counts) { const tally = new Map(); for (const r of c.rows) {
          const n = num(r["no of companies"] ?? r["Item Value"] ?? r["Item Value_distinct"]);
          if (n == null) continue;
          const st = r["Time Fis Year"] ?? r["Actual Year"];
          const yr = r["Year"] ?? st;
          if ((fmt === "latest") !== (+st.slice(0, 4) >= 2020) && type !== "nbfc") continue;
          if (+st.slice(0, 4) - +yr.slice(0, 4) !== 0) continue;
          const cv = cut ? tidy(CUT_COL[cut].map((col) => r[col]).find((x) => x != null && String(x).trim() !== "") ?? "") : "";
          const key = cv ? `${slug(cv, 40)}__companies` : "companies";
          if (!byOff.has(0)) byOff.set(0, new Map());
          const tk = `${key}|${st}`;
          tally.set(tk, (tally.get(tk) ?? 0) + n);
          ser(byOff.get(0), key, { label: cv ? `${cv}: number of companies in the study` : "Number of companies in the study", unit: "count", ...(cv ? { group: cv } : {}) }).values.set(fyStart(st), tally.get(tk));
        } }
        // the NBFC tables carry the count on every data row
        if (frows.length && "No Of Companies" in frows[0]) for (const r of frows) {
          if (+studyOf(r).slice(0, 4) - +yearOf(r).slice(0, 4) !== 0) continue;
          const c = cutOf(r), n = num(r["No Of Companies"]);
          if (n == null) continue;
          ser(byOff.get(0), c ? `${slug(c, 40)}__companies` : "companies", { label: c ? `${c}: number of companies in the study` : "Number of companies in the study", unit: "count", ...(c ? { group: c } : {}) }).values.set(fyStart(studyOf(r)), n);
        }
        for (const [off, map] of [...byOff].sort((a, b) => a[0] - b[0])) {
          const sfx = off === 0 ? "" : off === 1 ? "-prior" : `-prior${off}`;
          const note = off === 0
            ? `Each year's figure is from that year's own study: the companies in the study, this year against last year for growth rates. Consecutive years are different samples; read the level of a rate across years, never a rupee level.${kind === "rate" ? " Ratios in per cent except those marked times." : ""}`
            : `The figure for a year as re-measured in the study ${off} year${off > 1 ? "s" : ""} later, on that later study's sample. Kept apart from the year's own study (the bundle without -prior), never mixed.`;
          put(name + sfx, { ...common, unit: kind === "count" ? "count" : "pct", studyOffset: off, note }, assemble(map, { gapsNote: "No figure in this year's study for this item or cut (not published, or the cut had no companies); left empty." }));
        }
      } else {
        const map = new Map();
        for (const r of frows) {
          const it = items.get(`${r["Item Sk"] ?? r["Item Code"] ?? r["Item Display Order"]}|${tidy(r["Item Description"])}`);
          const st = studyOf(r), c = cutOf(r);
          const key = `${c ? slug(c, 40) + "__" : ""}${it.key}__s${st.slice(0, 4)}`;
          const s = ser(map, key, { label: `${c ? c + ": " : ""}${it.label} (${st} study)`, unit: "inr_crore", study: st, group: `${st} study` });
          const v = valOf(r);
          if (v != null || !s.values.has(fyStart(yearOf(r)))) s.values.set(fyStart(yearOf(r)), v);
        }
        put(name, { ...common, unit: "inr_crore", note: "₹ crore. One series per item per study: each covers only the years of its own study (one sample of companies). Never read a line across studies; the samples differ every year." },
          assemble(map, { gapsNote: "No figure in this study for this item in this year; left empty." }));
      }
    }
  }

  // ---------- listed private manufacturing companies, half-yearly sources and uses ----------
  {
    const map = new Map();
    const items = outline(H.rows.map((r) => ({ ...r, "Report Code": "" })));
    for (const r of H.rows) {
      const it = items.get(`${r["Item Sk"]}|${tidy(r["Item Description"])}`);
      const d = `${r["Time Date"].slice(0, 4)}-04-01`;   // H1 of the fiscal year: April to September
      const side = tidy(r["Item Hierarchy Level 2"]), via = tidy(r["Item Hierarchy Level 3"]);
      // the items are shares of the total, per cent; the "Grand Total" rows are the rupee totals
      const total = /grand total/i.test(it.desc);
      ser(map, slug(`${side} ${via} ${it.desc}`, 90), { label: total ? `${side}: total, ₹ crore` : `${side}, ${via.toLowerCase()}: ${it.desc.replace(/^-/, "")} (share of the total, per cent)`, unit: total ? "inr_crore" : "pct", group: side })
        .values.set(d, total ? crore(num(r["Item Value"])) : r2(num(r["Item Value"])));
    }
    put("markets-co-listed-halfyear", { base: "as published", frequency: "half-yearly", unit: "pct", product: "DBIE report 1075 (sources and uses of funds of listed private manufacturing companies, half-yearly, discontinued)",
      coverage: "Where listed private manufacturing companies got their money and what they spent it on, April to September 2018 and 2019",
      note: "Shares of total sources or total uses, per cent; the totals in ₹ crore. Only two half-years were published (April to September 2018, final; April to September 2019, provisional) before the RBI discontinued the table. Each half-year is dated by its first month." },
      assemble(map));
  }
  return out;
}
