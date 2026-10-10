// scripts/lib/products/markets-hub.mjs: two RBI products the local Data Bank cannot hold (DBIE
// gates them behind an input prompt), read from the Reserve Bank Innovation Hub's DBIE data
// service (scripts/lib/rbihub.mjs, docs/reference/rbihub.md):
//
// 1. The Survey of Professional Forecasters (report 1475, "Round-wise Aggregate Tables"): for
//    each survey round, Annex I (annual forecasts: mean, median, max, min, quartiles), Annex II
//    (quarterly forecasts), Annex III (quarterly CPI and WPI inflation forecasts) and the Main
//    Tables (medians, a summary of the annexes: excluded as a duplicate, checked against Annex I).
//    The service's export repeats round 101's tables in the slots of rounds 64, 71, 75, 78, 84,
//    86, 94 and 100 (each slot's own "Round Number" says 101): those rounds are missing, not
//    filled, and the ledger marks them blocked. Report 1476 (the time-series view) is exported
//    with headers only and no rows.
//    Round dates: the tables carry the round number, not a date. Rounds are two months apart
//    (RBI runs the survey before each bimonthly policy meeting); round 61 is November 2019, so
//    round r is dated November 2019 + 2(r - 61) months (round 101 = July 2026, the service's last
//    period). Each round's date is checked against its first quarterly forecast: that quarter must
//    begin 0 to 5 months before the round, or the build fails.
//    SEAM: from round 99 the GDP and CPI forecasts are on the new bases (GDP 2022-23, CPI
//    2024), as the RBI's own disclaimer on report 1476 says. Rounds 61 to 98 and 99 on are
//    separate bundles (sources.yml seams: markets-spf).
// 2. Listed non-government non-financial companies (SDMX datasets PRF_LNGNFC_* and
//    RATIO_LNGNFC_*, quarterly from April-June 2014, annual from 2015-16): growth on a year
//    earlier for the same companies, rupee levels for the quarter's companies, ratios, by
//    sector, industry, size of paid-up capital and size of sales. Labels come from the
//    service's code lists, fetched by DSD code (/api/codelists/<DSD>). Each quarter's figures
//    come from the companies that reported that quarter (a count is published with each): the
//    growth rates compare the same companies a year apart and form a series; the rupee levels
//    are kept in their own bundles and never read as a series across quarters.
//    Checked identities (2026-10-10, October-December 2025): operating profit = value of
//    production less expenditure; EBITDA = operating profit + other income; EBIT = EBITDA less
//    depreciation; EBT before non-operating items = EBIT less interest; interest coverage = EBIT /
//    interest; all to the rupee as printed (validate.mjs repeats them on the bundles).
//
// Hand checks (2026-10-10): SPF round 101 (July 2026) median real GDP growth for 2026-27 6.6 and
// 2027-28 7.0 = the RBI's published results of the 101st round (PublicationsView id=24072), which also
// dates round 101 to July 2026 and round 100 to May 2026, as the bimonthly rule gives. Listed
// companies October-December 2025: sales growth 10.1 on 3,188 companies; manufacturing 11.4, IT 8.8,
// non-IT services 10.6 = RBI press release of 25 February 2026 (prid 62284). Annual 2024-25: sales
// 7.2 on 3,902 companies = the RBI's release on the private corporate business sector in 2024-25.
//
// Print the source as "Reserve Bank of India, DBIE, via the Reserve Bank Innovation Hub's data
// service". Requests: one at a time, CSV for whole tables (net.mjs throttles).
import { parseCsv } from "../tabular.mjs";
import { writeRaw, readRaw } from "../util.mjs";
import { rbihubCatalogue, rbihubCsv, rbihubTable, rbihubCodelist } from "../rbihub.mjs";
import { num, r2, r4, fyStart, quarterStartOfEnd, slug, tidy, assemble, emit, ser } from "./markets-lib.mjs";

const SRC = "Reserve Bank of India, DBIE, via the Reserve Bank Innovation Hub's data service";
const csvRows = (text) => {
  const t = parseCsv(text, ",");
  const head = t[0].map((h) => String(h).trim());
  return t.slice(1).filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
};
export const LISTED_TABLES = [
  // [table, kind (perf | ratio), cut (null | sector | industry | puc | sales), frequency]
  ["prf_lngnfc_qtr_rn", "perf", null, "q"], ["ratio_lngnfc_qtr_rn", "ratio", null, "q"],
  ["prf_lngnfc_qtr_ind_rn", "perf", "sector", "q"], ["ratio_lngnfc_qtr_ind_rn", "ratio", "sector", "q"],
  ["prf_lngnfc_ind_qtr_rn", "perf", "industry", "q"], ["ratio_lngnfc_ind_qtr_rn", "ratio", "industry", "q"],
  ["prf_lngnfc_puc_qtr_rn", "perf", "puc", "q"], ["ratio_lngnfc_puc_qtr_rn", "ratio", "puc", "q"],
  ["prf_lngnfc_sal_qtr_rn", "perf", "sales", "q"], ["ratio_lngnfc_sal_qtr_rn", "ratio", "sales", "q"],
  ["prf_lngnfc_ann_rn", "perf", null, "a"], ["ratio_lngnfc_ann_rn", "ratio", null, "a"],
  ["prf_lngnfc_ind_ann_rn", "perf", "sector", "a"], ["ratio_lngnfc_ind_ann_rn", "ratio", "sector", "a"],
  ["prf_lngnfc_indus_ann_rn", "perf", "industry", "a"], ["ratio_lngnfc_indus_ann_rn", "ratio", "industry", "a"],
  ["prf_lngnfc_puc_ann_rn", "perf", "puc", "a"], ["ratio_lngnfc_puc_ann_rn", "ratio", "puc", "a"],
  ["prf_lngnfc_sal_ann_rn", "perf", "sales", "a"], ["ratio_lngnfc_sal_ann_rn", "ratio", "sales", "a"],
];
const CUT_DIM = { sector: "ind_clasf_rn", industry: "inds_grp_rn", puc: "puc_cls_rn", sales: "sale_sz_cls_rn" };
export const LISTED_CUT_LABEL = { sector: "Sector", industry: "Industry", puc: "Size of paid-up capital", sales: "Size of sales" };
const TIMES = new Set(["INT_CVG", "CSH_CVG_RATIO"]);

// ---------------------------------------------------------------- SPF
export const SPF_ROUND0 = { round: 61, month: "2019-11" };
export const spfRoundDate = (n) => { const d = new Date(Date.UTC(2019, 10 + 2 * (n - 61), 1)); return d.toISOString().slice(0, 10); };
const qStart = (q) => { const m = /^Q([1-4]):(\d{4})-\d{2}$/.exec(q.trim()); if (!m) return null; const y = +m[2], k = +m[1]; const mo = [4, 7, 10, 1][k - 1]; return `${k === 4 ? y + 1 : y}-${String(mo).padStart(2, "0")}-01`; };
const STATS6 = ["mean", "median", "max", "min", "q1", "q3"];
const STAT_LABEL = { mean: "mean", median: "median", max: "highest", min: "lowest", q1: "first quartile", q3: "third quartile" };
const indName = (s) => tidy(String(s).replace(/\s*\n\s*/g, " "));

function parseSpf(rows) {
  const byPeriod = new Map();
  for (const r of rows) {
    const k = `${r.period}|${r.tab}`;
    if (!byPeriod.has(k)) byPeriod.set(k, []);
    byPeriod.get(k).push(r);
  }
  const cells = (r) => Array.from({ length: 11 }, (_, i) => String(r[`c${i + 1}`] ?? "").trim());
  const roundOf = (rs) => { for (const r of rs) { const c = cells(r); const i = c.findIndex((x) => /^Round Number/i.test(x)); if (i >= 0) { const v = c.slice(i + 1).find((x) => /^\d+$/.test(x)); if (v) return +v; } } return null; };
  const periods = [...new Set(rows.map((r) => r.period))].sort((a, b) => +a - +b);
  const rounds = new Map();   // round number -> { annual: [...], quarterly: [...], inflation: [...], main: [...] }
  const misfiled = [];
  for (const p of periods) {
    const tabs = Object.fromEntries(["Annex I", "Annex II", "Annex III", "Main Tables"].map((t) => [t, (byPeriod.get(`${p}|${t}`) ?? []).sort((a, b) => +a.row_no - +b.row_no)]));
    const rn = roundOf(tabs["Annex I"]) ?? roundOf(tabs["Main Tables"]);
    if (rn == null) throw new Error(`markets-hub SPF: period ${p} has no round number`);
    if (String(rn) !== String(p)) { misfiled.push({ period: +p, holds: rn }); continue; }
    const R = { annual: [], quarterly: [], inflation: [], main: [] };
    // Annex I: blocks "2026-27" then header rows then indicator rows with Mean,,Median,Max,Min,Q1,Q3
    let fy = null;
    for (const r of tabs["Annex I"]) {
      const c = cells(r);
      if (/^\d{4}-\d{2}$/.test(c[0]) && c.slice(1).every((x) => !x)) { fy = c[0]; continue; }
      if (!fy || !c[1] || /Key Macroeconomic/i.test(c[1])) continue;
      const vals = [c[4], c[6], c[7], c[8], c[9], c[10]].map(num);
      if (vals.every((v) => v == null)) continue;
      R.annual.push({ fy, ind: indName(c[1]), vals });
    }
    let q = null;
    for (const r of tabs["Annex II"]) {
      const c = cells(r);
      if (/^Q[1-4]:\d{4}-\d{2}$/.test(c[0]) && c.slice(1).every((x) => !x)) { q = c[0]; continue; }
      if (!q || !c[1] || /Key Macroeconomic/i.test(c[1])) continue;
      const vals = [c[4], c[6], c[7], c[8]].map(num);
      if (vals.every((v) => v == null)) continue;
      R.quarterly.push({ q, ind: indName(c[1]), vals });
    }
    let heads = null;
    for (const r of tabs["Annex III"]) {
      const c = cells(r);
      if (/^Quarter$/i.test(c[0])) { heads = [indName(c[1]), indName(c[5])]; continue; }
      if (heads && /^Q[1-4]:\d{4}-\d{2}$/.test(c[0])) {
        R.inflation.push({ q: c[0], ind: heads[0], vals: [c[1], c[2], c[3], c[4]].map(num) });
        R.inflation.push({ q: c[0], ind: heads[1], vals: [c[5], c[6], c[7], c[8]].map(num) });
      }
    }
    // Main Table 1, Real GDP median: kept only to check against Annex I
    let inT1 = false, t1Years = null;
    for (const r of tabs["Main Tables"]) {
      const c = cells(r);
      if (/^Table 1/i.test(c[0])) { inT1 = true; continue; }
      if (/^Table 2/i.test(c[0])) inT1 = false;
      if (inT1 && !c[0] && /^\d{4}-\d{2}$/.test(c[3])) t1Years = [c[3], c[4]];
      if (inT1 && /^Real GDP$/i.test(c[0]) && t1Years) R.main.push(...t1Years.map((y, i) => ({ fy: y, median: num(c[3 + i]) })));
    }
    rounds.set(rn, R);
  }
  return { rounds, misfiled };
}

export async function buildMarketsHub(root, dcfg, VINTAGE, cfg, { only } = {}) {
  const cat = await rbihubCatalogue();
  const entry = (pred) => cat.find(pred);
  // ---------------- fetch, archive ----------------
  const spfEntry = entry((e) => String(e.report_id) === "1475" && e.status === "loaded");
  const spf1476 = entry((e) => String(e.report_id) === "1476" && e.status === "loaded");
  if (!spfEntry) throw new Error("markets-hub: SPF report 1475 is not loaded on the service");
  const spfCsv = await rbihubCsv(spfEntry.schema_name, spfEntry.table_name);
  const spfMeta = await rbihubTable(spfEntry.schema_name, spfEntry.table_name);
  const csv1476 = spf1476 ? await rbihubCsv(spf1476.schema_name, spf1476.table_name) : null;
  const listed = [];
  for (const [table, kind, cut, f] of LISTED_TABLES) {
    const e = entry((x) => x.table_name === table && x.status === "loaded");
    if (!e) throw new Error(`markets-hub: listed-company table ${table} is not loaded on the service`);
    const meta = await rbihubTable(e.schema_name, table);
    const text = await rbihubCsv(e.schema_name, table);
    const cl = await rbihubCodelist(meta.data.dsd_code);
    listed.push({ table, kind, cut, f, meta: meta.data, provenance: meta.provenance, csv: text, codelist: cl });
  }
  const rawRel = "data/raw/markets-hub.json";
  writeRaw(root, rawRel, {
    vintage: VINTAGE,
    note: "Read from the Reserve Bank Innovation Hub's DBIE data service (data-api.dbie.rbihub.in): the SPF round-wise tables (report 1475) and the time-series view (1476) as CSV, and the listed-company SDMX datasets as CSV with their code lists. Each table's own metadata (loaded_at, DBIE provenance, source sha256) is kept beside it.",
    spf: { entry: spfEntry, meta: spfMeta, csv: spfCsv, report1476: spf1476 ? { entry: spf1476, csv: csv1476 } : null },
    listed: listed.map(({ table, meta, provenance, csv, codelist }) => ({ table, meta, provenance, csv, codelist })),
  });
  const V = readRaw(root, rawRel).vintage;
  const out = [];

  // ---------------- SPF ----------------
  {
    const META = { dossier: "markets-spf", source: SRC, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: cfg.dossiers["markets-spf"].revision_policy, frequency: "bimonthly" };
    const { rounds, misfiled } = parseSpf(csvRows(spfCsv));
    if (rounds.size < 25) throw new Error(`markets-hub SPF: only ${rounds.size} rounds parsed`);
    // round dates: check the bimonthly schedule against each round's first quarterly forecast
    for (const [n, R] of rounds) {
      const d = spfRoundDate(n), firstQ = R.quarterly.map((x) => qStart(x.q)).filter(Boolean).sort()[0];
      if (!firstQ) throw new Error(`markets-hub SPF round ${n}: no quarterly forecasts`);
      const gap = (+d.slice(0, 4) - +firstQ.slice(0, 4)) * 12 + (+d.slice(5, 7) - +firstQ.slice(5, 7));
      if (gap < 0 || gap > 5) throw new Error(`markets-hub SPF round ${n}: dated ${d} but its first forecast quarter starts ${firstQ} (${gap} months): the bimonthly schedule does not hold`);
      // Main Table 1 medians must equal Annex I medians (the main tables are a summary)
      for (const m of R.main) {
        const a = R.annual.find((x) => x.fy === m.fy && /^GDP at constant prices/i.test(x.ind));
        if (a && m.median != null && a.vals[1] != null && Math.abs(a.vals[1] - m.median) > 0.051) throw new Error(`markets-hub SPF round ${n}: Main Table 1 real GDP median ${m.median} for ${m.fy} differs from Annex I ${a.vals[1]}`);
      }
    }
    const missing = misfiled.map((m) => m.period).sort((a, b) => a - b);
    const note0 = `Survey rounds dated by month: the RBI's tables give round numbers only; rounds are two months apart, round 61 = November 2019 (each round's date is checked against its first forecast quarter). Rounds ${missing.join(", ")} are missing: the service's export repeats round ${[...new Set(misfiled.map((m) => m.holds))].join(", ")}'s tables in their place; they are left empty, never filled.`;
    const groups = { new: (n) => n >= 99, old: (n) => n < 99 };
    for (const [era, inEra] of Object.entries(groups)) {
      const sfx = era === "old" ? "-2019" : "";
      const base = era === "old" ? "GDP 2011-12, CPI 2012 (rounds 61 to 98)" : "GDP 2022-23, CPI 2024 (round 99 on)";
      const A = new Map(), Q = new Map(), I = new Map();
      const roundsIn = [...rounds.keys()].filter(inEra).sort((a, b) => a - b);
      for (const n of roundsIn) {
        const R = rounds.get(n), d = spfRoundDate(n);
        for (const x of R.annual) STATS6.forEach((st, i) => {
          const key = `${slug(x.ind, 50)}__fy${x.fy.slice(0, 4)}__${st}`;
          ser(A, key, { label: `${x.ind}, forecast for ${x.fy}: ${STAT_LABEL[st]}`, unit: /US\$ bn/i.test(x.ind) ? "usd_bn" : "pct", group: x.ind, target: x.fy, stat: st }).values.set(d, x.vals[i]);
        });
        for (const x of R.quarterly) ["mean", "median", "max", "min"].forEach((st, i) => {
          const key = `${slug(x.ind, 50)}__${x.q.replace(/[^0-9Q]/g, "").toLowerCase()}__${st}`;
          const unit = /US\$ bn/i.test(x.ind) ? "usd_bn" : /Rupee per US/i.test(x.ind) ? "inr_per_usd" : /US \$ per barrel/i.test(x.ind) ? "usd_per_barrel" : "pct";
          ser(Q, key, { label: `${x.ind}, forecast for ${x.q.replace(":", " ")}: ${STAT_LABEL[st]}`, unit, group: x.ind, target: x.q, stat: st }).values.set(d, x.vals[i]);
        });
        for (const x of R.inflation) ["mean", "median", "max", "min"].forEach((st, i) => {
          const key = `${slug(x.ind, 50)}__${x.q.replace(/[^0-9Q]/g, "").toLowerCase()}__${st}`;
          ser(I, key, { label: `${x.ind} inflation, forecast for ${x.q.replace(":", " ")}: ${STAT_LABEL[st]}`, unit: "pct", group: x.ind, target: x.q, stat: st }).values.set(d, x.vals[i]);
        });
      }
      const gn = "This target period was not forecast in these rounds, or the round is missing from the service's export; left empty.";
      const common = { base, rounds: roundsIn, product: "SPF report 1475 (round-wise aggregate tables)", periodGapsNote: `Round missing from the service's export (its slot repeats round 101); left empty, never filled.` };
      out.push(emit(root, `markets-spf${sfx}`, META, { ...common, unit: "pct", coverage: "What professional forecasters expect for India's growth, inflation, interest rates and the external account, for the current and next fiscal year, round by round", note: `${note0} Each series follows one target year through the rounds that forecast it: how the expectation moved. Mean, median, highest, lowest and quartiles of the panel's answers.` }, assemble(A, { gapsNote: gn })));
      out.push(emit(root, `markets-spf-quarterly${sfx}`, META, { ...common, unit: "pct", coverage: "Professional forecasters' quarter-by-quarter forecasts: GDP and its parts, industry, exports and imports, the rupee, oil, the repo rate", note: `${note0} Each series follows one target quarter through the rounds that forecast it.` }, assemble(Q, { gapsNote: gn })));
      out.push(emit(root, `markets-spf-inflation${sfx}`, META, { ...common, unit: "pct", coverage: "Professional forecasters' quarterly forecasts of CPI and WPI inflation, headline and core", note: `${note0} Inflation on a year earlier, per cent. Each series follows one target quarter through the rounds that forecast it.` }, assemble(I, { gapsNote: gn })));
    }
  }

  // ---------------- listed companies ----------------
  {
    const META = { dossier: "markets-listed", source: SRC, vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: cfg.dossiers["markets-listed"].revision_policy, base: "as published" };
    for (const t of listed) {
      const labels = {};
      for (const dim of t.codelist.dimensions ?? []) for (const v of dim.values ?? []) labels[`${dim.dim_code.toLowerCase()}|${v.code}`] = { label: tidy(v.label), parent: v.parent_value_id, id: v.value_id, level: v.level };
      const byId = Object.fromEntries(Object.values(labels).map((x) => [x.id, x]));
      const lab = (dim, code) => {
        const x = labels[`${dim}|${code}`];
        if (!x) throw new Error(`markets-hub ${t.table}: no code-list label for ${dim}=${code}`);
        const p = x.parent && x.parent !== "NULL" ? byId[x.parent] : null;
        return p && /^(Others?|Total)$/i.test(x.label) ? `${p.label}: ${x.label}` : x.label;
      };
      const indDim = t.kind === "perf" ? "perf_ind_rn" : "typ_ratio_rn";
      const rows = csvRows(t.csv);
      if (!rows.length) throw new Error(`markets-hub ${t.table}: no rows`);
      const dateOf = (r) => (t.f === "q" ? quarterStartOfEnd(`${r.time_period.slice(0, 7)}-01`) : fyStart(`${+r.time_period.slice(0, 4) - 1}-${r.time_period.slice(2, 4)}`));
      const G = new Map(), L = new Map();
      for (const r of rows) {
        const code = r[indDim], v = num(r.obs_value);
        const c = t.cut ? r[CUT_DIM[t.cut]] : null;
        const cl = c ? lab(CUT_DIM[t.cut], c) : null;
        const il = lab(indDim, code);
        const d = dateOf(r);
        const pre = c ? `${slug(c, 30)}__` : "";
        // the quarterly sector table tags the services' "other expenditure" rupee levels as per cent
        // (94 rows, values in the hundreds of billions): a "per cent" of a million or more is a rupee
        // figure; it goes to the levels, noted on the series. Anything else of that size fails.
        const misUnit = r.unit_measure === "PT" && v != null && Math.abs(v) >= 1e6;
        if (misUnit && code !== "EXPD_OTH") throw new Error(`markets-hub ${t.table}: ${code} ${r.time_period} is ${v} "per cent"`);
        if (r.unit_measure === "INR" || misUnit) {
          if (v === 0 && t.cut) continue;   // the size and industry tables print 0 for levels they do not publish
          const ls = ser(L, `${pre}${slug(code)}`, { label: `${cl ? cl + ": " : ""}${il}, ₹ crore (this period's companies)`, unit: "inr_crore", ...(cl ? { group: cl } : {}) });
          if (misUnit) ls.note = "The service's export tags these rupee figures as per cent; they are rupees (hundreds of billions) and are read as such.";
          ls.values.set(d, v == null ? null : Math.round(v / 1e5) / 100);
        } else {
          const share = /SHARE/.test(code);
          const unit = TIMES.has(code) ? "times" : "pct";
          const what = t.kind === "ratio" ? il : share ? `${il} (share, per cent)` : `${il}: growth on a year earlier, same companies`;
          ser(G, `${pre}${slug(code)}`, { label: `${cl ? cl + ": " : ""}${what}`, unit, ...(cl ? { group: cl } : {}) }).values.set(d, r4(v));
        }
        // companies in each period, from the sales row (or the first ratio), by cut
        if ((code === "SALES" && r.unit_measure === "PT") || (t.kind === "ratio" && code === (t.cut ? "EBITDA_TO_SAL" : "EBITDA_TO_SAL"))) {
          const n = num(r.comp_count);
          if (n != null) ser(G, `${pre}companies`, { label: `${cl ? cl + ": " : ""}number of companies in the period`, unit: "count", ...(cl ? { group: cl } : {}) }).values.set(d, Math.round(n));
        }
      }
      const fq = t.f === "q" ? "q" : "a";
      const name = `markets-listed-${fq}${t.cut ? "-" + t.cut : ""}${t.kind === "ratio" ? "-ratios" : ""}`;
      const freq = t.f === "q" ? "quarterly" : "annual";
      const extra = { frequency: freq, product: `SDMX dataset ${t.meta.dsd_code} (${t.meta.title})`, dsd: t.meta.dsd_code, loadedAt: t.meta.loaded_at, cut: t.cut ? LISTED_CUT_LABEL[t.cut] : null };
      const gn = "No figure for this period (the cut had too few companies, or the item was not published); left empty.";
      out.push(emit(root, name, META, { ...extra, unit: "pct", coverage: `Listed private non-financial companies, ${t.kind === "ratio" ? "ratios" : "growth on a year earlier"}${t.cut ? " by " + LISTED_CUT_LABEL[t.cut].toLowerCase() : ""}, ${freq}`,
        note: t.kind === "ratio" ? "Per cent, except interest coverage and cash coverage, which are times. Each period's ratios are for the companies that reported that period." : "Growth on the same period a year earlier, per cent, for the same companies in both periods. Shares (where given) are the cut's share of all companies' sales or paid-up capital." }, assemble(G, { gapsNote: gn })));
      if (L.size) out.push(emit(root, `${name}-levels`, META, { ...extra, unit: "inr_crore", coverage: `Listed private non-financial companies, rupee levels${t.cut ? " by " + LISTED_CUT_LABEL[t.cut].toLowerCase() : ""}, ${freq}`,
        note: "₹ crore. Each period is a different set of companies (those that reported in time): levels are not comparable across periods and are never read as a series. Use the growth rates for change." }, assemble(L, { gapsNote: gn })));
    }
  }
  return out;
}

// separate entry points so each sources.yml entry runs once (fetch.mjs runs a product per entry)
let memo = null;
export async function buildMarketsHubOnce(root, dcfg, VINTAGE, cfg) { memo ??= buildMarketsHub(root, dcfg, VINTAGE, cfg); return memo; }
