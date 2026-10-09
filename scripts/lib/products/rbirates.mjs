// scripts/lib/products/rbirates.mjs: interest rates and monetary policy in India. What the RBI
// decides (policy rates since 1935, every MPC meeting and vote since October 2016), how it
// reaches borrowers and savers (WALR, WADTDR, MCLR by bank group, bank and loan type; the
// benchmarks floating-rate loans are priced on), what the money and government-bond markets
// pay (call money, T-bills, the G-sec yield curve, auctions of central and state bonds), and
// how much governments borrow. Everything is read from the owner's local Data Bank, read-only
// (scripts/lib/databank.mjs); nothing here calls the RBI.
//
// Two kinds of Data Bank input:
//   PARSED datasets (source `rbi`, built from RBI press releases, the Handbook of Statistics and
//   the MPC pages): rbi_policy_rates, rbi_mpc_meetings, rbi_mpc_votes, rbi_lending_deposit_rates,
//   rbi_gsec_auctions, rbi_tbill_auctions, rbi_sdl_auctions. The Data Bank's query view unions
//   every parse run, and each parse run rebuilds the whole dataset from every cataloged
//   document, so we read the NEWEST parse file only (read_parquet on it, through the Data
//   Bank's own CLI) and warn about any key that only older runs carry.
//   DBIE webi reports (the raw mirror, `dbieReport`): long histories the parsed datasets do not
//   reach (call money since 1990, the G-sec yield curve since 1996, T-bill auctions since 1992,
//   the structure of interest rates since 1970, market borrowing since 1951) and the
//   money-market, liquidity and weekly-supplement tables. Most webi reports repeat every value
//   once per display unit (ACTUALS, LAKHS, CRORES, ...): we keep the ACTUALS rows only, and
//   amounts are converted from rupees to ₹ crore.
//
// Seams (AGENTS.md rule 1), all kept as separate series, never joined:
//   - the corridor floor: fixed reverse repo until 7 April 2022, the standing deposit facility
//     (SDF) from 8 April 2022 (the reverse repo stays on the books at 3.35%, unused as a floor);
//   - the operating rate: the Bank Rate until the LAF (2000-01), the LAF repo rate, then the
//     policy repo rate with the weighted average call rate as the operating target (May 2011);
//   - lending benchmarks: BPLR, base rate (July 2010), MCLR (April 2016), external benchmarks
//     (October 2019). WALR averages across all of them; MCLR is its own series;
//   - real rates are computed against CPI on two bases (2012=100 to December 2025, 2024=100
//     from January 2025): two bundles, one per CPI ruler.
//
// Hand checks against the RBI's own publications are recorded beside each bundle below.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { databankRoot, dbieReport as dbieReportUncached, databankQuery } from "../databank.mjs";
import { writeSeries, writeRaw } from "../util.mjs";
import { parseCsv } from "../tabular.mjs";

const C = { accent: "#2E4BD8", gold: "#C47A16", g1: "#5F6675", g2: "#A3A9B4", g3: "#C9CED6", muted: "#878D99" };
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r4 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10000) / 10000);
const num = (s) => { const t = String(s ?? "").replace(/,/g, "").trim(); if (!t || /^(null|na|n\.a\.|-|—)$/i.test(t)) return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const ymd = (s) => String(s).slice(0, 10).replace(/\//g, "-");          // "2026/09/15 00:00:00" -> "2026-09-15"
const month1 = (iso) => iso.slice(0, 7) + "-01";
const slugify = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 48);
const CR = 1e7;                                                        // rupees per crore

function monthAxis(first, last) {
  const out = []; let [y, m] = first.split("-").map(Number); const [ly, lm] = last.split("-").map(Number);
  while (y < ly || (y === ly && m <= lm)) { out.push(`${y}-${String(m).padStart(2, "0")}-01`); m++; if (m > 12) { m = 1; y++; } }
  return out;
}
function quarterAxis(first, last) { return monthAxis(first, last).filter((d, i) => i % 3 === 0); }
const fyStart = (fy) => `${fy.slice(0, 4)}-04-01`;                     // "2024-25" -> "2024-04-01"
const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };

/* ---------------- Data Bank access ---------------- */

// newest parse file of a parsed dataset: every parse rebuilds the dataset from all cataloged
// documents, so the newest file is the complete current state
function newestParse(db, dataset) {
  const dir = path.join(db, "data/parsed", dataset);
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".parquet")).sort();
  if (!files.length) throw new Error(`rbirates: no parse files for ${dataset}`);
  return path.join(dir, files.at(-1));
}
function parsed(db, dataset, cols, order, key) {
  const file = newestParse(db, dataset);
  const src = `read_parquet('${file.replace(/'/g, "''")}')`;
  const { rows, provenance } = databankQuery(db, dataset, `SELECT ${cols} FROM ${src} ORDER BY ${order}`);
  // a key carried by an older parse run but dropped by the newest is a revision we must see
  const orphans = databankQuery(db, dataset, `SELECT DISTINCT ${key} FROM {table} EXCEPT SELECT DISTINCT ${key} FROM ${src} ORDER BY 1`).rows;
  if (orphans.length) console.warn(`rbirates: ${dataset}: ${orphans.length} key(s) only in older parse runs (newest run wins), e.g. ${JSON.stringify(orphans[0])}`);
  return { rows, provenance: { ...provenance, parse_file: path.basename(file), older_run_orphans: orphans.length } };
}

// big reports are heavy: each is read once per run
const DBIE_CACHE = new Map();
const dbieReport = (db, id) => DBIE_CACHE.get(id) ?? DBIE_CACHE.set(id, dbieReportUncached(db, id)).get(id);
const PROVIDER_CACHE = new Map();

// a webi report's named data provider (dbieReport returns the largest one; the weekly
// supplement's "Ratios and Rates" table keeps its rates in a smaller provider)
let WEBI_INDEX = null;
function webiProvider(db, reportId, providerId) {
  const ck = `${reportId}|${providerId}`;
  if (PROVIDER_CACHE.has(ck)) return PROVIDER_CACHE.get(ck);
  const out = webiProviderRead(db, reportId, providerId);
  // keep the small ones; the big ones are read once by the adapter anyway
  if (out.rows.length < 50000) PROVIDER_CACHE.set(ck, out);
  return out;
}
function webiProviderRead(db, reportId, providerId) {
  if (!WEBI_INDEX) {
    WEBI_INDEX = new Map();
    const base = path.join(db, "data/raw/metadata/rbi_dbie/rbi_dbie_webi_rows");
    for (const run of fs.readdirSync(base)) {
      const dir = path.join(base, run);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
        const m = j.metadata || {};
        if (m.webi_role !== "flow" || !m.report_id || !m.dataprovider?.id) continue;
        const k = `${m.report_id}|${m.dataprovider.id}`;
        const prev = WEBI_INDEX.get(k);
        if (!prev || j.retrieved_at > prev.retrieved) WEBI_INDEX.set(k, { content: j.content_path, meta: m, retrieved: j.retrieved_at, sha256: j.sha256 });
      }
    }
  }
  const e = WEBI_INDEX.get(`${reportId}|${providerId}`);
  if (!e) throw new Error(`rbirates: DBIE report ${reportId} provider ${providerId} not in the Data Bank mirror`);
  let buf = fs.readFileSync(e.content);
  if (e.meta.stored_encoding === "gzip") buf = zlib.gunzipSync(buf);
  // the same CSV parse as dbieReport: quoted DBIE cells can hold ";"
  const table = parseCsv(buf.toString("utf8"), ";").filter((r) => r.some((c) => String(c).trim() !== ""));
  const header = table[0].map((x) => String(x).trim());
  const rows = table.slice(1).map((c) => Object.fromEntries(header.map((h, i) => [h, String(c[i] ?? "").trim()])));
  return { header, rows, provenance: { report_id: reportId, data_provider: providerId, rows: rows.length, retrieved_at: e.retrieved, sha256: e.sha256, document_id: e.meta.document_id } };
}

// state names as the RBI prints them in its borrowing tables (110 spellings for about 31 states)
function stateNameOf(raw) {
  const t = String(raw).toUpperCase().replace(/&/g, " AND ").replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();
  const z = t.replace(/ /g, "");
  const rules = [
    [/^ANDHRA/, "Andhra Pradesh"], [/^(ARPR|ARUNACHAL)/, "Arunachal Pradesh"], [/^ASSAM/, "Assam"], [/^BIHAR/, "Bihar"], [/^CH+AT+I?S+H?GARH|^CHATTISGARH/, "Chhattisgarh"],
    [/^DELHI|^NCT/, "Delhi"], [/^GOA/, "Goa"], [/^GUJR?A?RAT|^GUJRAT/, "Gujarat"], [/^(HARYANA|HR)$/, "Haryana"], [/^HARYANA/, "Haryana"], [/^(HIMACHAL|HP$)/, "Himachal Pradesh"],
    [/^(JK|JANDK|JAMMU)/, "Jammu and Kashmir"], [/^JHAR/, "Jharkhand"], [/^KARNATAKA/, "Karnataka"], [/^KERAL/, "Kerala"], [/^(MP|MADHYA)/, "Madhya Pradesh"],
    [/^MAHA?R?A?S/, "Maharashtra"], [/^MANIPUR/, "Manipur"], [/^MEGHALAYA/, "Meghalaya"], [/^MIZORAM/, "Mizoram"], [/^NAGALAND/, "Nagaland"], [/^(ODISHA|ORISSA)/, "Odisha"],
    [/^(PUDUCHERRY|PONDICHERRY)/, "Puducherry"], [/^PUNJAB/, "Punjab"], [/^RAJAS/, "Rajasthan"], [/^SIKKIM/, "Sikkim"], [/^TAMIL/, "Tamil Nadu"], [/^TELANGANA/, "Telangana"],
    [/^TRIPURA/, "Tripura"], [/^(UTTARAKHAND|UTTARANCHAL|UTRANCHAL)/, "Uttarakhand"], [/^(UP$|UTTAR|UTTRA)/, "Uttar Pradesh"], [/^(WBENGAL|WESTBENGAL|WB$)/, "West Bengal"],
  ];
  for (const [re, name] of rules) if (re.test(z)) return name;
  return null;
}

// the unit of a series, from its name: rates are per cent a year; shares and reserve ratios per
// cent; spreads percentage points; amounts ₹ crore; counts, votes, tenors and prices as named
function unitFor(name, slug) {
  const n = String(name);
  if (/spread|minus_1y_pt$|_pt$/.test(n)) return "pct_points";
  if (/^share_|_share_|share_.*_pct$|^crr_pct$|^slr_pct$/.test(n) || /benchmarks|walr-1992/.test(slug) && /share/.test(n)) return "pct";
  if (/_pct$/.test(n)) return "pct_per_annum";
  if (/_inr_crore$/.test(n)) return "inr_crore";
  if (/_bps$/.test(n)) return "bps";
  if (/_days$|period_day$|_period_days?$/.test(n)) return "days";
  if (/_years$/.test(n)) return "years";
  if (/with_decision$/.test(n)) return "vote";
  if (/bid_cover$/.test(n)) return "times";
  if (/price$/.test(n)) return "inr_per_100";
  if (/(_n|_number|_number_new|votes_for|votes_against)$/.test(n)) return "count";
  throw new Error(`rbirates: ${slug}: no unit for series name ${n}`);
}

/* ---------------- bundle writing ---------------- */

function makeWriter(root, dcfg, vintage) {
  const written = [];
  // vintage: the date the data last changed at its source (a release or decision date where the
  // source carries one, else the day the Data Bank retrieved the newest document behind it);
  // writeSeries keeps the previous vintage when the values are unchanged
  const write = (slug, { dates, series, frequency, unit = "pct", base = dcfg.base, note, coverage, latestPeriod, vintage: v = vintage, extra = {}, _fix, zeroRatesEmpty = false }) => {
    if (_fix) _fix(series);
    // money-market tables print 0 for a rate on a day with no deal in that segment: an interest
    // rate of exactly 0 is never a quoted Indian rate, so it is left empty and the series says so
    if (zeroRatesEmpty) for (const s of Object.values(series)) if (/_pct$/.test(s.name) && s.data.some((x) => x === 0)) {
      const n = s.data.filter((x) => x === 0).length;
      s.data = s.data.map((x) => (x === 0 ? null : x));
      s.gapsNote = `${s.gapsNote ? s.gapsNote + " " : ""}${n} day(s) print a rate of 0 (no deal); left empty.`;
    }
    // the axis starts at the first date any series reports and ends at the last (no empty lead
    // or tail: CONTRACT-series rule 2); interior nulls are declared on the series that miss them
    // every series carries its unit (src/dossiers/everycut.js UNITS); inferred from the series
    // name the adapter gives it, and an unrecognised name fails the bake
    for (const s of Object.values(series)) if (!s.unit) s.unit = unitFor(s.name, slug);
    const any = (i) => Object.values(series).some((s) => s.data[i] != null);
    let a = 0, b = dates.length - 1;
    while (a <= b && !any(a)) a++;
    while (b >= a && !any(b)) b--;
    if (a > b) throw new Error(`rbirates: ${slug} is empty`);
    const D = dates.slice(a, b + 1);
    for (const [k, s] of Object.entries(series)) {
      s.data = s.data.slice(a, b + 1);
      const f = s.data.findIndex((v) => v != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      if (f === -1) { delete series[k]; console.warn(`rbirates: ${slug}.${k} empty, dropped`); continue; }
      const gaps = D.filter((d, i) => i > f && i < l && s.data[i] == null);
      if (gaps.length) s.gaps = gaps; else delete s.gaps;
      if (!gaps.length) delete s.gapsNote;
    }
    writeSeries(root, `data/series/${slug}.json`, {
      meta: { dossier: "rates", source: dcfg.source_agency, product: "rbirates", base, frequency, unit, vintage: v > vintage ? vintage : v, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: latestPeriod ?? (frequency === "monthly" ? D.at(-1).slice(0, 7) : null), releaseDate: null, revisionPolicy: dcfg.revision_policy, coverage, note, ...extra },
      dates: D, series,
    });
    written.push(slug);
  };
  return { write, written };
}

// step function: the level of each rate in force on each date (change events carry forward)
function levelsOn(events, dates) {
  // events: [{date, value}] sorted; value may be null (a printed cell that is not one rate)
  const out = []; let j = -1;
  for (const d of dates) { while (j + 1 < events.length && events[j + 1].date <= d) j++; out.push(j >= 0 ? events[j].value : null); }
  return out;
}

export async function buildRbiRates(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const { write, written } = makeWriter(root, dcfg, vintage);
  const RAW = {};
  const rawStamp = (rel, body) => { writeRaw(root, rel, { vintage, ...body }); return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8")).vintage; };

  /* =================== 1. policy rates since 1935 =================== */
  // Hand check (RBI press release "Monetary Policy Statement, 2026-27: Resolution of the Monetary
  // Policy Committee, October 5 to 7, 2026", as mirrored in the Data Bank): policy repo rate
  // raised by 25 basis points to 5.50%, SDF 5.25%, MSF and Bank Rate 5.75%. The bundle's last
  // event row reads repo 5.5, sdf 5.25, msf 5.75, bank_rate 5.75.
  const PR = parsed(db, "rbi_policy_rates",
    "effective_date, rate_code, rate_name, value_pct, value_text, source_kind, edition_year, table_no, editions_checked, editions_agreeing, source_url, source_retrieved_at",
    "effective_date, rate_code", "effective_date, rate_code");
  if (PR.rows.length < 350) throw new Error(`rbirates: rbi_policy_rates served ${PR.rows.length} rows, expected about 400 (no data returned: policy rates)`);
  const RATES = [
    ["repo", "Policy repo rate", C.accent], ["sdf", "Standing deposit facility (SDF) rate", C.g1], ["reverse_repo", "Fixed reverse repo rate", C.g2],
    ["msf", "Marginal standing facility (MSF) rate", C.g1], ["bank_rate", "Bank Rate", C.gold], ["crr", "Cash reserve ratio (CRR), % of deposits", C.g1], ["slr", "Statutory liquidity ratio (SLR), % of deposits", C.g2],
  ];
  const ev = Object.fromEntries(RATES.map(([k]) => [k, PR.rows.filter((r) => r.rate_code === k).map((r) => ({ date: r.effective_date, value: r.value_pct }))]));
  for (const [k] of RATES) if (!ev[k].length) throw new Error(`rbirates: no events for ${k}`);
  const repoNow = ev.repo.at(-1).value;
  if (!(repoNow >= 2 && repoNow <= 12)) throw new Error(`rbirates: anchor failed, latest repo ${repoNow}`);
  const evDates = [...new Set(PR.rows.map((r) => r.effective_date))].sort();
  const disagreements = PR.rows.filter((r) => r.editions_checked > 0 && r.editions_agreeing < r.editions_checked).map((r) => `${r.effective_date} ${r.rate_code} (${r.editions_agreeing} of ${r.editions_checked} other Handbook editions agree)`);
  RAW.policy = PR;
  write("rates-policy", {
    dates: evDates, frequency: "irregular", vintage: evDates.at(-1),
    series: Object.fromEntries(RATES.map(([k, label, color]) => [k, { name: `${k}_pct`, label, color, data: levelsOn(ev[k], evDates) }])),
    coverage: "Every change in the RBI's policy rates and reserve requirements since July 1935: repo, SDF, reverse repo, MSF, Bank Rate, CRR and SLR",
    latestPeriod: evDates.at(-1),
    note: "One row per date on which any of the seven rates changed; each series gives the level in force from that date (a rate that did not change carries its level). Source: RBI Handbook of Statistics, Major Monetary Policy Rates and Reserve Requirements (newest edition wins over its span), then MPC resolutions, via the Data Bank's rbi_policy_rates. CRR before 1962 was printed as two ratios ('5% of demand, 2% of time liabilities') and is left empty. The repo and reverse repo follow the post-October 2004 naming throughout (repo = the RBI lending to banks).",
    extra: { editionDisagreements: disagreements, changes: PR.rows.map((r) => ({ date: r.effective_date, rate: r.rate_code, value: r.value_pct, kind: r.source_kind })) },
  });

  // month-end levels: the guide's current ruler (prose and the headline read it)
  const lastEv = evDates.at(-1);
  const months = monthAxis(evDates[0].slice(0, 7), lastEv.slice(0, 7));
  const monthEnd = months.map((m) => { const [y, mm] = m.split("-").map(Number); const e = new Date(Date.UTC(y, mm, 0)).toISOString().slice(0, 10); return e > lastEv ? lastEv : e; });
  write("rates-monthly", {
    dates: months, frequency: "monthly", vintage: evDates.at(-1),
    series: Object.fromEntries(RATES.map(([k, label, color]) => [k, { name: `${k}_pct`, label, color, data: levelsOn(ev[k], monthEnd) }])),
    coverage: "The RBI's policy rates and reserve requirements at the end of each month, July 1935 to date",
    note: `Level in force on the last day of each month, read from the change events in rates-policy (derived, never averaged). The latest month, ${lastEv.slice(0, 7)}, is not over: its value is the level in force after the latest decision (${lastEv}).`,
  });

  /* =================== 2. the Monetary Policy Committee =================== */
  // Hand check (RBI, Minutes of the MPC meeting of August 3 to 5, 2026, released 19 August 2026):
  // all six members voted to keep the policy repo rate at 5.25%. Bundle: meeting 62, votes_for 6.
  const MM = parsed(db, "rbi_mpc_meetings", "*", "meeting_end_date", "meeting_end_date");
  const MV = parsed(db, "rbi_mpc_votes", "*", "meeting_end_date, member_name", "meeting_end_date, member_name");
  if (MM.rows.length < 60 || MV.rows.length < 350) throw new Error(`rbirates: MPC datasets served ${MM.rows.length} meetings, ${MV.rows.length} votes (no data returned: MPC)`);
  // the Data Bank's stance classifier misses some sentences ("change the stance to calibrated
  // tightening", Oct 2026): classify from stance_text only when it names one stance verbatim
  const STANCES = ["withdrawal of accommodation", "calibrated tightening", "accommodative", "neutral"];
  const stanceOf = (r) => {
    if (r.stance) return { stance: r.stance, by: "data bank" };
    const t = String(r.stance_text ?? "").toLowerCase().replace(/[‘’']/g, "");
    const m = t.match(/stance (?:to|of) (withdrawal of accommodation|calibrated tightening|accommodative|neutral)\b/);
    return m && STANCES.includes(m[1]) ? { stance: m[1].replace(/ /g, "_"), by: "atlas, from the resolution's stance sentence" } : { stance: null, by: null };
  };
  const MD = MM.rows.map((r) => r.meeting_end_date);
  write("rates-mpc", {
    dates: MD, frequency: "irregular", vintage: MD.at(-1),
    series: {
      repo: { name: "repo_pct", label: "Policy repo rate after the meeting", color: C.accent, data: MM.rows.map((r) => r.repo_rate_pct) },
      change_bps: { name: "repo_change_bps", label: "Change in the repo rate, basis points", color: C.g1, data: MM.rows.map((r) => r.repo_change_bps) },
      sdf: { name: "sdf_pct", label: "SDF rate (the floor from April 2022)", color: C.g2, data: MM.rows.map((r) => r.sdf_rate_pct) },
      reverse_repo: { name: "reverse_repo_pct", label: "Reverse repo rate (the floor until April 2022)", color: C.g2, data: MM.rows.map((r) => r.sdf_rate_pct == null ? r.reverse_repo_rate_pct : null) },
      msf: { name: "msf_pct", label: "MSF rate (the ceiling)", color: C.g1, data: MM.rows.map((r) => r.msf_rate_pct) },
    },
    coverage: "Every Monetary Policy Committee decision since the first meeting in October 2016: the repo rate, the change, the corridor",
    latestPeriod: MD.at(-1),
    note: "One row per MPC meeting, dated on its last day (the resolution is published that day, effective immediately). Meeting 39 (3 November 2022, the report to the Government on missing the inflation target) took no rate decision and has no row. The reverse repo is shown only while it was the floor (to the April 2022 meeting).",
    extra: { meetings: MM.rows.map((r) => { const s = stanceOf(r); return { n: r.meeting_number, date: r.meeting_end_date, dates: r.meeting_dates_text, decision: r.decision, stance: s.stance, stanceBy: s.by, stanceChanged: r.stance_changed, stanceText: r.stance_text, chair: r.chair, votesFor: r.votes_for, votesAgainst: r.votes_against, dissenters: r.dissenters ? r.dissenters.split(/;\s*/) : [], minutes: r.minutes_release_date, resolution: r.resolution_url }; }) },
  });

  // members' votes: 1 = voted for the decision as taken, 0 = voted against it (a "no", or a yes
  // for a different size of cut); empty when not a member. Only meetings whose minutes are out.
  const withMinutes = MM.rows.filter((r) => r.minutes_release_date && r.votes_for != null).map((r) => r.meeting_end_date);
  // roles as the RBI's own DBIE table labels them (report 1491: "(DG)", "(ED)", "(External)", past external members)
  const R1491 = dbieReport(db, "1491");
  const nameKey = (n) => { const t = n.replace(/\b[A-Z]\.\s*/g, " ").trim().split(/\s+/); return (t[0] + "|" + t.at(-1)).toLowerCase(); };
  const roleOf = new Map();
  for (const r of R1491.rows) {
    const d = r["Member Description"]; if (!d || d === "NULL") continue;
    const name = d.replace(/\s*\(.*\)\s*$/, "").replace(/^(Shri|Smt\.|Dr\.|Prof\.)\s+/, "").trim();
    const tag = (d.match(/\(([^)]+)\)/) || [])[1] || "";
    const role = /Chair|Gov/.test(tag) ? "Governor" : /DG/.test(tag) ? "Deputy Governor" : /ED/.test(tag) ? "Executive Director" : /External/.test(tag) || /External/.test(r["Item Description"]) ? "External member" : null;
    if (role) roleOf.set(nameKey(name), role);
  }
  // names differ in middle initials between the minutes and DBIE ("Mridul K. Saggar" / "Mridul
  // Saggar"): nameKey matches on first name plus surname
  const roleFor = (n, chair) => (chair ? "Governor" : roleOf.get(nameKey(n)) ?? null);
  const members = [...new Set(MV.rows.map((r) => r.member_name))];
  const firstSeen = (n) => MV.rows.find((r) => r.member_name === n).meeting_end_date;
  members.sort((a, b) => (firstSeen(a) < firstSeen(b) ? -1 : firstSeen(a) > firstSeen(b) ? 1 : a < b ? -1 : 1));
  const vmap = new Map(MV.rows.map((r) => [`${r.meeting_end_date}|${r.member_name}`, r]));
  const memberMeta = members.map((n) => {
    const rows = MV.rows.filter((r) => r.member_name === n);
    return { key: slugify(n), name: n, honorific: rows[0].member_honorific, chair: rows.some((r) => r.is_chair), role: roleFor(n, rows.some((r) => r.is_chair)), meetings: rows.length, against: rows.filter((r) => !r.voted_for_decision).length, first: rows[0].meeting_end_date, last: rows.at(-1).meeting_end_date };
  });
  const voteSeries = Object.fromEntries(members.map((n, i) => [slugify(n), {
    name: `${slugify(n)}_with_decision`, label: `${n}${memberMeta[i].role ? `, ${memberMeta[i].role.toLowerCase()}` : ""}: voted with the decision (1) or against (0)`, color: C.g2,
    data: withMinutes.map((d) => { const r = vmap.get(`${d}|${n}`); return r ? (r.voted_for_decision ? 1 : 0) : null; }),
    gapsNote: "Not a member at these meetings (members serve fixed terms; the seats were vacant or held by someone else).",
  }]));
  const mrow = new Map(MM.rows.map((r) => [r.meeting_end_date, r]));
  // identity: votes for + against = six, and match the per-member table
  for (const d of withMinutes) {
    const m = mrow.get(d), vs = MV.rows.filter((r) => r.meeting_end_date === d);
    const forN = vs.filter((r) => r.voted_for_decision).length;
    if (vs.length !== 6 || m.votes_for + m.votes_against !== 6 || forN !== m.votes_for) throw new Error(`rbirates: MPC ${d}: ${vs.length} member votes, ${m.votes_for}-${m.votes_against} split, ${forN} with the decision`);
  }
  write("rates-mpc-votes", {
    dates: withMinutes, frequency: "irregular", unit: "count", vintage: mrow.get(withMinutes.at(-1)).minutes_release_date,
    series: {
      votes_for: { name: "votes_for", label: "Members voting for the decision", color: C.accent, data: withMinutes.map((d) => mrow.get(d).votes_for) },
      votes_against: { name: "votes_against", label: "Members voting against the decision", color: C.gold, data: withMinutes.map((d) => mrow.get(d).votes_against) },
      ...voteSeries,
    },
    coverage: "How each of the MPC's members voted at every meeting since October 2016: the split and every member's vote",
    latestPeriod: withMinutes.at(-1),
    note: "From the minutes' 'Voting on the Resolution' table, published about two weeks after each meeting (a meeting without minutes yet has no row). A member is counted against the decision if they voted no, or voted for a cut of a different size where the table records sizes (August and October 2019, March and May 2020, June 2025). The minutes say what each dissenter preferred in their own statements; this table does not record it.",
    extra: { members: memberMeta, preferred: MV.rows.filter((r) => r.preferred_change_bps != null && !r.voted_for_decision).map((r) => ({ date: r.meeting_end_date, member: r.member_name, preferredBps: r.preferred_change_bps })) },
  });
  RAW.mpc = { meetings: MM, votes: MV, roles1491: { provenance: R1491.provenance, rows: R1491.rows.filter((r) => r["Member Description"] && r["Member Description"] !== "NULL").map((r) => [r["Member Code"], r["Member Description"], r["Item Description"]]).filter((x, i, a) => a.findIndex((y) => y.join() === x.join()) === i) } };

  /* =================== 3. lending and deposit rates =================== */
  // Hand check (RBI press release "Lending and Deposit Rates of Scheduled Commercial Banks -
  // September 2026", in the Data Bank's raw documents): WALR on fresh rupee loans 8.61% in
  // August 2026, on outstanding loans 8.96%; WADTDR on outstanding deposits 6.56%, on fresh
  // deposits 5.67%; median 1-year MCLR 8.61% in September 2026. The bundles read the same.
  const LR = parsed(db, "rbi_lending_deposit_rates", "table_key, bank_group, item, stat, period_month, value_pct, release_date, vintages_seen",
    "table_key, bank_group, item, stat, period_month", "table_key, bank_group, item, stat, period_month");
  if (LR.rows.length < 12000) throw new Error(`rbirates: rbi_lending_deposit_rates served ${LR.rows.length} rows (no data returned: lending rates)`);
  RAW.lending = LR;
  const lendV = LR.rows.reduce((m, r) => (r.release_date > m ? r.release_date : m), "").slice(0, 10);
  const lr = new Map(LR.rows.map((r) => [`${r.table_key}|${r.bank_group}|${r.item}|${r.stat}|${r.period_month}`, r.value_pct]));
  const span = (pred) => { const ds = LR.rows.filter(pred).map((r) => r.period_month).sort(); return [ds[0].slice(0, 7), ds.at(-1).slice(0, 7)]; };
  const GROUPS = [["scb", "all scheduled commercial banks"], ["public_sector", "public sector banks"], ["private_sector", "private banks"], ["foreign", "foreign banks"]];
  const GCOL = { scb: C.accent, public_sector: C.g1, private_sector: C.gold, foreign: C.g2 };
  {
    const [a, b] = span((r) => /^(walr|wadtdr)_(outstanding|fresh)$/.test(r.table_key));
    const D = monthAxis(a, b), S = {};
    for (const [tk, what] of [["walr_fresh", "Weighted average lending rate, fresh rupee loans"], ["walr_outstanding", "Weighted average lending rate, outstanding rupee loans"],
      ["wadtdr_fresh", "Weighted average domestic term deposit rate, fresh deposits"], ["wadtdr_outstanding", "Weighted average domestic term deposit rate, outstanding deposits"]]) {
      const item = tk.startsWith("walr") ? "walr" : "wadtdr";
      for (const [g, gl] of GROUPS) S[`${tk}_${g === "scb" ? "all" : g.replace("_sector", "")}`] = { name: `${tk}_${g}_pct`, label: `${what}, ${gl}`, color: GCOL[g], data: D.map((d) => lr.get(`${tk}|${g}|${item}|value|${d}`) ?? null),
        ...(tk === "wadtdr_fresh" ? { gapsNote: "The RBI began the fresh-deposit rate in March 2020 and published it monthly only from January 2021." } : {}) };
    }
    write("rates-lending", { dates: D, frequency: "monthly", series: S, vintage: lendV,
      coverage: "What banks charge and pay: weighted average lending rates (WALR) and term deposit rates (WADTDR), fresh and outstanding, by bank group",
      note: "RBI, Lending and Deposit Rates of Scheduled Commercial Banks (monthly release, Tables 1 to 4), via the Data Bank's rbi_lending_deposit_rates (each release repeats the full history; the newest release wins). Fresh = loans sanctioned or deposits taken during the month; outstanding = the whole book at month-end. All SCBs excludes regional rural banks and small finance banks." });
  }
  {
    const [a, b] = span((r) => r.table_key === "mclr_1y_bank_group");
    const D = monthAxis(a, b), S = {};
    for (const [g, gl] of GROUPS) for (const st of ["median", "min", "max"]) S[`${g === "scb" ? "all" : g.replace("_sector", "")}_${st}`] = { name: `mclr_1y_${g}_${st}_pct`,
      label: `1-year MCLR, ${gl}, ${st === "median" ? "median bank" : st === "min" ? "lowest bank" : "highest bank"}`, color: st === "median" ? GCOL[g] : C.g3, data: D.map((d) => lr.get(`mclr_1y_bank_group|${g}|mclr_1y|${st}|${d}`) ?? null) };
    write("rates-mclr", { dates: D, frequency: "monthly", series: S, vintage: lendV,
      coverage: "The 1-year marginal cost of funds based lending rate (MCLR): median, lowest and highest bank, by bank group",
      note: "RBI, Lending and Deposit Rates release, Table 5 (bank-group summary of the 1-year MCLR each bank publishes for the month). MCLR replaced the base rate for new loans in April 2016; it is a separate ruler from the base rate and from external benchmarks." });
  }
  {
    const banks = new Map();
    for (const r of LR.rows) if (r.table_key === "mclr_1y_bankwise") { if (!banks.has(r.item)) banks.set(r.item, r.bank_group); }
    const [a, b] = span((r) => r.table_key === "mclr_1y_bankwise");
    const D = monthAxis(a, b), S = {}, list = [];
    for (const [name, g] of [...banks].sort((x, y) => (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : x[0] < y[0] ? -1 : 1))) {
      let k = slugify(name); while (S[k]) k += "_x";
      S[k] = { name: `mclr_1y_${k}_pct`, label: `1-year MCLR, ${name.replace(/\s+/g, " ").trim()}`, color: GCOL[g] ?? C.g2, data: D.map((d) => lr.get(`mclr_1y_bankwise|${g}|${name}|value|${d}`) ?? null),
        gapsNote: "The bank did not report an MCLR for these months (the RBI's table leaves the cell empty: a merger, a new bank, or no report)." };
      list.push({ key: k, bank: name.replace(/\s+/g, " ").trim(), group: g });
    }
    write("rates-mclr-banks", { dates: D, frequency: "monthly", series: S, vintage: lendV,
      coverage: `The 1-year MCLR of every bank the RBI lists, month by month (${list.length} banks)`,
      note: "RBI, Lending and Deposit Rates release, Table 6 (bank-wise 1-year MCLR). Banks are listed as the RBI prints their names; merged banks stop at their merger.",
      extra: { banks: list } });
  }
  {
    const sectors = [...new Set(LR.rows.filter((r) => r.table_key === "walr_fresh_sector").map((r) => r.item))].sort();
    const NAMES = { agriculture: "Agriculture", education: "Education loans", housing: "Housing loans", industry_large: "Large industry", infrastructure: "Infrastructure", msmes: "Micro, small and medium enterprises", other_personal_loans: "Other personal loans", professional_services: "Professional services", rupee_export_credit: "Rupee export credit", trade: "Trade", vehicle: "Vehicle loans" };
    const [a, b] = span((r) => r.table_key === "walr_fresh_sector");
    const D = monthAxis(a, b), S = {};
    for (const tk of ["walr_fresh_sector", "walr_outstanding_sector"]) for (const s of sectors)
      S[`${tk.split("_")[1]}_${s}`] = { name: `${tk}_${s}_pct`, label: `WALR, ${tk.includes("fresh") ? "fresh" : "outstanding"} loans: ${NAMES[s] ?? s}`, color: s === "housing" ? C.accent : C.g2, data: D.map((d) => lr.get(`${tk}|scb|${s}|value|${d}`) ?? null) };
    for (const s of sectors) if (!NAMES[s]) console.warn(`rbirates: unnamed WALR sector ${s}`);
    write("rates-walr-sectors", { dates: D, frequency: "monthly", series: S, vintage: lendV,
      coverage: "What different borrowers pay: weighted average lending rates on fresh and outstanding loans for 11 kinds of loan (housing, vehicle, education, MSMEs, agriculture...)",
      note: "RBI, Lending and Deposit Rates release, Tables 8 and 9 (all scheduled commercial banks).", extra: { sectors: sectors.map((s) => ({ key: s, label: NAMES[s] ?? s })) } });
  }
  {
    const [a, b] = span((r) => r.table_key === "floating_loan_benchmark_share");
    const D = quarterAxis(a, b), S = {};
    const BN = [["eblr", "External benchmark (repo-linked and others)"], ["mclr", "MCLR"], ["base_rate", "Base rate"], ["others", "Others (BPLR and older)"]];
    for (const [g, gl] of GROUPS) for (const [it, il] of BN)
      S[`${g === "scb" ? "all" : g.replace("_sector", "")}_${it}`] = { name: `share_${g}_${it}_pct`, label: `${il}: share of floating-rate rupee loans, ${gl}`, color: it === "eblr" ? C.accent : it === "mclr" ? C.g1 : C.g3, data: D.map((d) => lr.get(`floating_loan_benchmark_share|${g}|${it}|share|${d}`) ?? null) };
    // identity: the four benchmark shares add up to 100 (the release's own 'total' row)
    for (const [g] of GROUPS) D.forEach((d) => {
      const parts = BN.map(([it]) => lr.get(`floating_loan_benchmark_share|${g}|${it}|share|${d}`));
      if (parts.some((v) => v == null)) return;
      const sum = parts.reduce((x, y) => x + y, 0);
      if (Math.abs(sum - 100) > 0.6) throw new Error(`rbirates: benchmark shares for ${g} sum to ${sum.toFixed(2)} at ${d}`);
    });
    write("rates-benchmarks", { dates: D, frequency: "quarterly", series: S, vintage: lendV,
      coverage: "What floating-rate loans are priced on: shares of the external benchmark (mostly the repo rate), MCLR, base rate and older benchmarks, by bank group",
      latestPeriod: D.at(-1).slice(0, 7),
      note: "RBI, Lending and Deposit Rates release, Table 7 (quarterly, per cent of outstanding floating-rate rupee loans at quarter-end; dated here on the first month of the quarter). External benchmark lending began in October 2019 for retail and small business loans." });
  }

  /* =================== 4. webi helpers =================== */
  const WR = {};                                                       // report id -> archived rows
  const ACT = (r) => r.rows.filter((x) => !("Unit Description" in x) || x["Unit Description"] === "ACTUALS");
  // archived rows are packed column by column, losslessly: a column with few distinct values is a
  // dictionary plus a comma-separated list of indexes into it; any other column is its cells
  // joined by a tab. Row i is { col: dict[codes[i]] } or { col: cells[i] } for each column.
  const pack = (cols, rows) => ({ rows: rows.length, packing: "per column: {dict, codes} (codes = comma-separated indexes into dict) or {cells} (cells joined by a tab)",
    columns: Object.fromEntries(cols.map((c) => {
      const vals = rows.map((x) => String(x[c] ?? ""));
      const dict = [...new Set(vals)];
      if (dict.length <= 65536 && dict.length < vals.length / 2) { const ix = new Map(dict.map((v, i) => [v, i])); return [c, { dict, codes: vals.map((v) => ix.get(v)).join(",") }]; }
      return [c, { cells: vals.join("\t") }];
    })) });
  // long tables print a row for every cell, filled or not: with dropEmpty the archive keeps the rows
  // whose value (the last column read) is filled, which is every row the adapter can use
  const keep = (id, r, rows, cols, dropEmpty = false) => { const kept = dropEmpty ? rows.filter((x) => String(x[cols.at(-1)] ?? "").trim() !== "") : rows;
    WR[id] = { provenance: r.provenance, ...(dropEmpty ? { rowsWithEmptyValueDropped: rows.length - kept.length } : {}), ...pack(cols, kept) }; return rows; };
  const isDate = (s) => /^\d{4}\/\d{2}\/\d{2}/.test(String(s ?? ""));
  const retrieved = (r) => String(r.provenance.retrieved_at ?? vintage).slice(0, 10);
  // a printed value that cannot be true (a negative interest rate or tenor) is left empty and the
  // printed figure is recorded on the series, never corrected by guess
  const impossible = (s, dates, bad, what) => {
    const hits = [];
    s.data = s.data.map((v, i) => { if (v != null && bad(v)) { hits.push(`${dates[i]}: ${v}`); return null; } return v; });
    if (hits.length) s.gapsNote = `${s.gapsNote ? s.gapsNote + " " : ""}Left empty where the RBI's table prints ${what} (${hits.join("; ")}).`;
    return s;
  };
  // long rows -> { dates, get(key, date) }
  const pivot = (rows, dateOf, keyOf, valOf, quiet = false) => {
    const m = new Map(), ds = new Set();
    for (const x of rows) {
      const d = dateOf(x), k = keyOf(x); if (!d || k == null) continue;
      const v = valOf(x); if (v == null) continue;
      const kk = `${k}|${d}`;
      if (!quiet && m.has(kk) && m.get(kk) !== v) console.warn(`rbirates: conflicting values for ${kk}: ${m.get(kk)} vs ${v} (first kept)`);
      if (!m.has(kk)) m.set(kk, v);
      ds.add(d);
    }
    return { dates: [...ds].sort(), get: (k, d) => m.get(`${k}|${d}`) ?? null, has: (k) => [...m.keys()].some((x) => x.startsWith(k + "|")) };
  };

  /* =================== 5. call money =================== */
  // Hand check (RBI press release "Money Market Operations as on September 9, 2026"): weighted
  // average call rate 4.99%. rates-call-daily reads 4.99 (4.98725) for 2026-09-09.
  {
    const R = dbieReport(db, "198");
    const rows = keep("198", R, ACT(R).filter((x) => isDate(x.Date)), ["Date", "Item Code", "Rates_Values"], true);
    const P = pivot(rows, (x) => ymd(x.Date), (x) => x["Item Code"], (x) => (/RANGE/.test(x["Item Code"]) ? (x.Rates_Values || null) : num(x.Rates_Values)));
    if (P.dates.length < 5000) throw new Error(`rbirates: report 198 has ${P.dates.length} days (no data returned: call money)`);
    const rng = (code, side) => P.dates.map((d) => { const t = P.get(code, d); const m = t && String(t).match(/^\s*([\d.]+)\s*-\s*([\d.]+)\s*$/); return m ? num(m[side === "lo" ? 1 : 2]) : null; });
    const cr = (code) => P.dates.map((d) => r2(P.get(code, d) == null ? null : P.get(code, d) / CR));
    const note = "RBI, Daily Weighted Average Call/Notice Money Rates (DBIE report 198, Handbook of Statistics), ACTUALS rows. One row per day the market traded. The weighted average call rate is the RBI's operating target since May 2011.";
    write("rates-call-daily", { dates: P.dates, frequency: "daily", vintage: retrieved(R),
      series: {
        wacr: { name: "wacr_pct", label: "Weighted average call rate", color: C.accent, data: P.dates.map((d) => r4(P.get("WAR_BORROWINGS_LENDINGS", d))), gapsNote: "No weighted average printed for the day." },
        low: { name: "call_low_pct", label: "Call rate, lowest deal of the day", color: C.g3, data: P.dates.map((d) => P.get("MIN_ROR", d)), gapsNote: "No range printed for the day." },
        high: { name: "call_high_pct", label: "Call rate, highest deal of the day", color: C.g3, data: P.dates.map((d) => P.get("MAX_ROR", d)), gapsNote: "No range printed for the day." },
        turnover: { name: "call_turnover_inr_crore", label: "Call and notice money turnover (borrowing plus lending), ₹ crore", color: C.g2, data: cr("TOTAL_TURNOVER") },
      },
      coverage: "The overnight interbank rate, every trading day since April 2005: weighted average call rate, the day's lowest and highest deal, and turnover",
      latestPeriod: P.dates.at(-1), note });
    write("rates-call-daily-detail", { dates: P.dates, frequency: "daily", vintage: retrieved(R),
      series: {
        borrow_rate: { name: "call_borrowing_wa_pct", label: "Call money, weighted average borrowing rate", color: C.g1, data: P.dates.map((d) => r4(P.get("WEIGHTED_INT_RATE_B", d))) },
        lend_rate: { name: "call_lending_wa_pct", label: "Call money, weighted average lending rate", color: C.g2, data: P.dates.map((d) => r4(P.get("WEIGHTED_INT_RATE_L", d))) },
        borrow_low: { name: "call_borrow_low_pct", label: "Call money borrowing, lowest rate", color: C.g3, data: rng("INTEREST_RANGE_BORROW", "lo") },
        borrow_high: { name: "call_borrow_high_pct", label: "Call money borrowing, highest rate", color: C.g3, data: rng("INTEREST_RANGE_BORROW", "hi") },
        lend_low: { name: "call_lend_low_pct", label: "Call money lending, lowest rate", color: C.g3, data: rng("INTEREST_RANGE_LENDER", "lo") },
        lend_high: { name: "call_lend_high_pct", label: "Call money lending, highest rate", color: C.g3, data: rng("INTEREST_RANGE_LENDER", "hi") },
        borrowing: { name: "call_borrowing_inr_crore", label: "Call money borrowed, ₹ crore", color: C.g1, data: cr("BORROWING") },
        lending: { name: "call_lending_inr_crore", label: "Call money lent, ₹ crore", color: C.g2, data: cr("LENDING") },
      },
      coverage: "Call money in detail: borrowing and lending sides, their rate ranges and amounts, every trading day since April 2005",
      latestPeriod: P.dates.at(-1), note: note + " The ranges are printed as text ('4.40-6.10') and split into their low and high ends." });
  }
  {
    // monthly averages since 1990-91 (report 1375 = Handbook report 265)
    const R = dbieReport(db, "1375");
    const MON = { "Jan.": 1, "Feb.": 2, "Mar.": 3, "Apr.": 4, May: 5, "Jun.": 6, "Jul.": 7, "Aug.": 8, "Sep.": 9, "Oct.": 10, "Nov.": 11, "Dec.": 12, "Sept.": 9, "June": 6, "July": 7 };
    const rows = keep("1375", R, R.rows, ["Fiscal Year", "Calendar Month", "Hi Lw Exchg Rate Desc", "Rate"]);
    const dOf = (x) => { const m = MON[x["Calendar Month"]]; if (!m) { console.warn(`rbirates: 1375 month ${x["Calendar Month"]}`); return null; } const y = +x["Fiscal Year"].slice(0, 4) + (m <= 3 ? 1 : 0); return `${y}-${String(m).padStart(2, "0")}-01`; };
    const P = pivot(rows, dOf, (x) => x["Hi Lw Exchg Rate Desc"], (x) => num(x.Rate));
    const D = monthAxis(P.dates[0].slice(0, 7), P.dates.at(-1).slice(0, 7));
    write("rates-call-monthly", { dates: D, frequency: "monthly", vintage: retrieved(R),
      series: {
        average: { name: "call_avg_pct", label: "Call money rate, monthly average", color: C.accent, data: D.map((d) => P.get("Average", d)) },
        high: { name: "call_high_pct", label: "Call money rate, monthly high", color: C.g3, data: D.map((d) => P.get("High", d)) },
        low: { name: "call_low_pct", label: "Call money rate, monthly low", color: C.g3, data: D.map((d) => P.get("Low", d)) },
      },
      coverage: "The call money rate month by month since April 1990: average, high and low",
      note: "RBI, Weighted Average Call/Notice Money Rates, monthly (DBIE report 1375; Handbook of Statistics report 265). The Handbook's monthly average of the daily weighted average rates." });
  }

  /* =================== 6. the money market, all overnight and term segments =================== */
  {
    const R = dbieReport(db, "611");
    // the table can print a day more than once (one row per forward-ledger date, around weekends
    // and holidays): the row whose ledger date is the report date itself is the day's own. The
    // RBI's own operations (LAF, SDF, MSF) are left to report 8, which prints one total per day.
    const own = R.rows.filter((x) => isDate(x["Time Date"]) && x["Money Mkt Hierarchy Level1"] !== "Liquidity Adjustment Facility")
      .sort((x, y) => (x["Fwd Ledger Date Sk"] === x["Report As On Date Sk"] ? 0 : 1) - (y["Fwd Ledger Date Sk"] === y["Report As On Date Sk"] ? 0 : 1));
    const rows = keep("611", R, own, ["Time Date", "Money Mkt Code", "Report As On Date Sk", "Fwd Ledger Date Sk", "Money Mkt Value"], true);
    const lab = new Map();
    for (const x of rows) lab.set(x["Money Mkt Code"], [x["Money Mkt Hierarchy Level1"], x["Money Mkt Hierarchy Level2"], x["Money Mkt Hierarchy Level3"]]);
    const P = pivot(rows, (x) => ymd(x["Time Date"]), (x) => x["Money Mkt Code"], (x) => num(x["Money Mkt Value"]), true);
    const S = {};
    for (const [code, [l1, l2, l3]] of [...lab].sort((a, b) => +a[0] - +b[0])) {
      const amount = l3 === "Amount";
      const k = slugify(`${l1 === "Overnight Segment" ? "on" : l1 === "Term Segment" ? "term" : "laf"} ${l2} ${l3}`);
      S[k] = { name: k + (amount ? "_inr_crore" : "_pct"), label: `${l1}, ${l2.replace("CBLO/Triparty Repo", "TREPS (triparty repo, formerly CBLO)")}: ${l3.toLowerCase()}${amount ? ", ₹ crore" : ""}`,
        color: /Call/.test(l2) ? C.accent : /CBLO|Triparty/.test(l2) ? C.gold : C.g2, data: P.dates.map((d) => { const v = P.get(code, d); return amount ? r2(v == null ? null : v / CR) : v == null ? null : r4(v); }),
        gapsNote: "No deal (or no operation) in this segment that day." };
    }
    write("rates-money-market", { zeroRatesEmpty: true, dates: P.dates, frequency: "daily", vintage: retrieved(R), series: S,
      coverage: "Every segment of the overnight and term money market each day since July 2020: call, notice, term, TREPS, market repo and repo in corporate bonds, with amounts and rates",
      latestPeriod: P.dates.at(-1),
      note: "RBI, Money Market (daily Money Market Operations, DBIE report 611; the same table as report 659), market segments. Where the table prints a day twice (one row per forward-ledger date) the row dated on the report day itself is kept. The RBI's own operations in the same table are in rates-liquidity (report 8). Amounts are converted from rupees to ₹ crore. TREPS (triparty repo dealing on the Clearing Corporation of India) replaced CBLO in November 2018; the RBI's table keeps the old label.",
      extra: { codes: Object.fromEntries([...lab].map(([c, l]) => [c, l.join(" > ")])) } });
  }

  /* =================== 7. MIBOR =================== */
  {
    const R = dbieReport(db, "993");
    const rows = keep("993", R, R.rows.filter((x) => isDate(x.Date) && x["Rate/Standard Deviation"] === "Rate" && x["Dim Rate Types.Rate Type Description"] === "Value"), ["Date", "Rate Description", "Tenor Description", "Rate Value"], true);
    const P = pivot(rows, (x) => ymd(x.Date), (x) => `${x["Rate Description"]}|${x["Tenor Description"]}`, (x) => num(x["Rate Value"]));
    const S = {};
    for (const rate of ["MIBOR", "MIBID"]) for (const [t, tl] of [["OVERNIGHT", "overnight"], ["14 DAYS", "14 days"], ["1 MONTHS", "1 month"], ["3 MONTHS", "3 months"]])
      S[`${rate.toLowerCase()}_${slugify(tl)}`] = { name: `${rate.toLowerCase()}_${slugify(tl)}_pct`, label: `${rate === "MIBOR" ? "MIBOR (offer)" : "MIBID (bid)"}, ${tl}`, color: rate === "MIBOR" && t === "OVERNIGHT" ? C.accent : C.g2,
        data: P.dates.map((d) => P.get(`${rate}|${t}`, d)), gapsNote: "Not published for this tenor that day." };
    write("rates-mibor", { zeroRatesEmpty: true, dates: P.dates, frequency: "daily", vintage: retrieved(R), series: S,
      coverage: "The Mumbai interbank offer and bid rates (MIBOR, MIBID) for overnight, 14-day, 1-month and 3-month money, daily since June 1998",
      latestPeriod: P.dates.at(-1),
      note: "RBI, Mumbai Inter-Bank Offer Rate (MIBOR) and Mumbai Inter-Bank Bid Rate (MIBID) (DBIE report 993). Polled by NSE until 2015 and computed by FBIL from 2015 (the overnight MIBOR from actual call trades); the RBI's table does not mark the change. MIBID was discontinued; the standard-deviation rows the table also prints are not baked." });
  }

  /* =================== 8. the RBI's liquidity operations =================== */
  {
    const R = dbieReport(db, "8");
    const rows = keep("8", R, ACT(R).filter((x) => isDate(x.Date)), ["Date", "Item Code", "Amount"], true);
    const lab = new Map(); for (const x of rows) lab.set(x["Item Code"], [x["Item Hierarchy Level1"] || "Other", x["Item Description"]]);
    const P = pivot(rows, (x) => ymd(x.Date), (x) => x["Item Code"], (x) => num(x.Amount));
    const S = {};
    for (const [code, [l1, l2]] of [...lab].sort((a, b) => +a[0] - +b[0])) S[slugify(l2)] = { name: slugify(l2) + "_inr_crore", label: `${l1}: ${l2}, ₹ crore`, color: /^Repo$|Variable Rate Repo/.test(l2) ? C.accent : /SDF|Reverse/.test(l2) ? C.gold : C.g2,
      data: P.dates.map((d) => r2(P.get(code, d) == null ? null : P.get(code, d) / CR)), gapsNote: "No operation of this kind that day (the RBI prints nothing)." };
    write("rates-liquidity", { dates: P.dates, frequency: "daily", vintage: retrieved(R), series: S,
      coverage: "Every liquidity operation of the RBI each day since November 2012: repo and reverse repo (fixed and variable rate), SDF, MSF, long-term and targeted repos, special facilities, and outright open market purchases and sales",
      latestPeriod: P.dates.at(-1),
      note: "RBI, Liquidity Operations by RBI (Weekly Statistical Supplement table, DBIE report 8; also reports 21 and 702). Amounts in ₹ crore, converted from rupees. Each operation is printed as a positive amount; the RBI's table marks injection and absorption by the kind of operation, not by sign.",
      extra: { codes: Object.fromEntries([...lab].map(([c, l]) => [c, l.join(" > ")])) } });
  }
  {
    // LAF repo and reverse repo auctions since April 2001 (report 1211 = 1217). The table prints
    // one block per auction, numbered within the day by data_period_flag (the second LAF window
    // of 2009, several term repos on one day). Day totals: amounts and counts are summed; the
    // cut-off rate and the tenor are averaged weighted by the amount accepted in each auction.
    const R = dbieReport(db, "1211");
    const rows = keep("1211", R, R.rows.filter((x) => isDate(x["Time Date"])), ["Time Date", "data_period_flag", "Item Code", "Item Value"], true);
    const lab = new Map(); for (const x of rows) lab.set(x["Item Code"], [x["Item Hierarchy Level1"], x["Item Hierarchy Level2"], x["Item Hierarchy Level3"]]);
    const auc = new Map();                                             // date -> flag -> code -> value
    for (const x of rows) { const v = num(x["Item Value"]); if (v == null) continue; const d = ymd(x["Time Date"]); const a1 = auc.get(d) ?? auc.set(d, new Map()).get(d); const a2 = a1.get(x.data_period_flag) ?? a1.set(x.data_period_flag, {}).get(x.data_period_flag); a2[x["Item Code"]] = v; }
    const D = [...auc.keys()].sort();
    // the RBI stored LAF cut-off rates multiplied by 1e7 up to August 2023 (7.00 as 70,000,000)
    let rescaled = 0;
    const rate = (v) => { if (v == null) return null; if (v > 1000) { rescaled++; return v / 1e7; } return v; };
    // which accepted-amount code weights which rate and period codes, per facility
    const FAC = [["R_", "R_B_A_AMOUNT", "R_CUT_OFF_RATE", "PERIOD_DAY"], ["RR_", "RR_B_A_AMOUNT", "RR_CUT_OFF_RATE", null], ["TR_", "TR_B_A_AMOUNT", "TR_CUT_OFF_RATE", "TERM_REPO_PERIOD_DAY"], ["TRR_", "TRR_B_A_AMOUNT", "TRR_CUT_OFF_RATE", "TRR_PERIOD_DAY"]];
    const S = {};
    let multi = 0;
    for (const [code, [l1, l2, l3]] of [...lab].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const amount = l3 === "Amount", isRate = /Cut-off/.test(l2);
      const fac = FAC.find((f) => f[2] === code || f[3] === code);
      S[slugify(code)] = { name: slugify(code) + (amount ? "_inr_crore" : isRate ? "_pct" : ""), label: `${l1}: ${l2}${l3 ? ", " + l3.toLowerCase() : ""}${amount ? ", ₹ crore" : ""}${fac ? " (amount-weighted when several auctions were held that day)" : ""}`, color: isRate ? C.accent : C.g2,
        data: D.map((d) => {
          const as = [...auc.get(d).values()].filter((a) => a[code] != null);
          if (!as.length) return null;
          if (!fac) return amount ? r2(as.reduce((t, a) => t + a[code], 0) / CR) : as.reduce((t, a) => t + a[code], 0);
          const vals = as.map((a) => ({ v: isRate ? rate(a[code]) : a[code], w: a[fac[1]] ?? 0 }));
          if (vals.length > 1) multi++;
          const W = vals.reduce((t, x) => t + x.w, 0);
          return r4(W > 0 ? vals.reduce((t, x) => t + x.v * x.w, 0) / W : vals.reduce((t, x) => t + x.v, 0) / vals.length);
        }), gapsNote: "No auction of this kind that day." };
    }
    write("rates-laf", { zeroRatesEmpty: true, dates: D, frequency: "daily", vintage: retrieved(R), series: S,
      coverage: "Every repo and reverse repo auction under the Liquidity Adjustment Facility since April 2001: bids received and accepted (number and amount), cut-off rates and tenors, fixed and variable rate",
      latestPeriod: D.at(-1),
      note: `RBI, Repo/Reverse Repo Auction under the Liquidity Adjustment Facility (DBIE report 1211, also 1217). Amounts converted from rupees to ₹ crore. The table prints each auction separately (numbered within the day); on days with several auctions of one kind (${multi} day-facility cases) amounts and counts are summed and the cut-off rate and tenor are averaged, weighted by the amount accepted. ${rescaled} cut-off rates printed on a 1e7 scale (7.00 as 70,000,000, the RBI's storage until August 2023) were divided by 1e7.`,
      extra: { codes: Object.fromEntries([...lab].map(([c, l]) => [c, l.filter(Boolean).join(" > ")])) } });
  }

  /* =================== 9. certificates of deposit and commercial paper =================== */
  for (const [id, slug, what, dateCol, codeCol, valCol, MAP] of [
    ["4", "rates-cd", "certificates of deposit (banks' short-term borrowing)", "Fortnight", "Item Code", "Item_Value", { TOT_AMT_OUT: ["outstanding", "amount outstanding, ₹ crore", true], ISSUED_DUR_FORT: ["issued", "issued during the fortnight, ₹ crore", true], MIN_ROI: ["rate_min", "lowest interest rate", false], MAX_ROI: ["rate_max", "highest interest rate", false] }],
    ["5", "rates-cp", "commercial paper (companies' short-term borrowing)", "Fortnight", "Item Code", "Items_Values", { N_AMT_OUTSTANDING: ["outstanding", "amount outstanding, ₹ crore", true], N_ISSUED: ["issued", "issued during the fortnight, ₹ crore", true], N_MIN: ["rate_min", "lowest interest rate", false], N_MAX: ["rate_max", "highest interest rate", false] }],
  ]) {
    const R = dbieReport(db, id);
    const rows = keep(id, R, ACT(R).filter((x) => isDate(x[dateCol])), [dateCol, codeCol, valCol]);
    const P = pivot(rows, (x) => ymd(x[dateCol]), (x) => x[codeCol], (x) => num(x[valCol]));
    for (const c of new Set(rows.map((x) => x[codeCol]))) if (!MAP[c]) throw new Error(`rbirates: report ${id} has an unmapped item ${c}`);
    write(slug, { dates: P.dates, frequency: "fortnightly", vintage: retrieved(R),
      series: Object.fromEntries(Object.entries(MAP).map(([code, [k, l, amt]]) => [k, { name: `${slug.slice(6)}_${k}${amt ? "_inr_crore" : "_pct"}`, label: `${what[0].toUpperCase() + what.slice(1, what.indexOf(" ("))}: ${l}`, color: amt ? C.g2 : k === "rate_max" ? C.gold : C.accent,
        data: P.dates.map((d) => { const v = P.get(code, d); return v == null ? null : amt ? r2(v / CR) : v; }), gapsNote: "Not printed for this fortnight." }])),
      coverage: `Interest rates and amounts of ${what}, fortnightly since ${P.dates[0].slice(0, 4)}`,
      _fix: (S) => { for (const k of ["rate_min", "rate_max"]) impossible(S[k], P.dates, (v) => v < 0, "a negative interest rate"); },
      latestPeriod: P.dates.at(-1), note: `RBI, Weekly Statistical Supplement (DBIE report ${id}). Rates are the lowest and highest at which paper was issued in the fortnight; amounts converted from rupees to ₹ crore.` });
  }

  /* =================== 10. Treasury bills =================== */
  // Hand check (RBI press release "Treasury Bills: Full Auction Result", 23 September 2026, as the
  // Data Bank's rbi_tbill_auctions reads it): the auction-by-auction cut-off yields of the three
  // tenors equal this bundle's within 0.01 percentage point; checked for every common date below.
  const TB = parsed(db, "rbi_tbill_auctions", "auction_date, instrument, tenor_days, cutoff_yield_pct, notified_amount_cr", "auction_date, instrument, tenor_days", "auction_date, instrument, tenor_days");
  RAW.tbill = TB;
  const tbP = new Map(TB.rows.map((r) => [`${r.instrument}|${r.tenor_days}|${r.auction_date}`, r]));
  const TBCODES = { IMP_YIELD_AT_COP: ["cutoff_yield", "cut-off yield", "pct"], WEIGHTED_AVG_YEILD: ["wavg_yield", "weighted average yield", "pct"], CUT_OFF_PRICE: ["cutoff_price", "cut-off price, ₹ per ₹100", "price"], WEIGHTED_AVG_PRICE: ["wavg_price", "weighted average price, ₹ per ₹100", "price"],
    NOTIFIED_AMOUNT: ["notified", "amount notified, ₹ crore", "cr"], BIDS_RECV_COMP_FV: ["bids_comp", "competitive bids received, ₹ crore", "cr"], BIDS_RECV_NON_COMP_FV: ["bids_noncomp", "non-competitive bids received, ₹ crore", "cr"],
    BIDS_ACCP_COMP_FV: ["accepted_comp", "competitive bids accepted, ₹ crore", "cr"], BIDS_ACCP_NON_COMP_FV: ["accepted_noncomp", "non-competitive bids accepted, ₹ crore", "cr"], DEV_PDS_SDS: ["devolvement", "devolvement on primary dealers, ₹ crore", "cr"],
    TOTAL_ISSUE: ["total_issue", "total issue, ₹ crore", "cr"], AMOUNT_OUTSTANDING: ["outstanding", "amount outstanding on the date of issue, ₹ crore", "cr"], BIDS_RECV_NUM: ["bids_n", "number of bids received", "n"], BIDS_ACCP_NUM: ["accepted_n", "number of bids accepted", "n"] };
  for (const [id, tenor, slug] of [["307", 91, "rates-tbill-91"], ["308", 182, "rates-tbill-182"], ["309", 364, "rates-tbill-364"]]) {
    const R = dbieReport(db, id);
    const codeCol = R.header.includes("Auction_Code") ? "Auction_Code" : "Auction Code";
    const rows = keep(id, R, ACT(R).filter((x) => isDate(x["Date of Auction"])), ["Date of Auction", codeCol, "Auction_Values"], true);
    const P = pivot(rows, (x) => ymd(x["Date of Auction"]), (x) => x[codeCol], (x) => num(x.Auction_Values));
    for (const c of new Set(rows.map((x) => x[codeCol]))) if (!TBCODES[c]) throw new Error(`rbirates: report ${id} has an unmapped code ${c}`);
    const S = {};
    // prices: the RBI stores some weighted average prices multiplied by 1e7 (from September 2010);
    // a price or yield printed as 0 is an auction with nothing accepted at a price
    let scaled = 0;
    for (const [code, [k, l, kind]] of Object.entries(TBCODES)) S[k] = { name: `tbill${tenor}_${k}${kind === "pct" ? "_pct" : kind === "cr" ? "_inr_crore" : ""}`, label: `${tenor}-day T-bill: ${l}`, color: k === "cutoff_yield" ? C.accent : C.g2,
      data: P.dates.map((d) => { const v = P.get(code, d); if (v == null) return null; if (kind === "cr") return r2(v / CR); if ((kind === "price" || kind === "pct") && v === 0) return null; if (kind === "price" && v > 1000) { scaled++; return r4(v / 1e7); } return v; }),
      gapsNote: "Not printed for this auction, or printed as 0 (nothing accepted at a price: the auction was cancelled or every bid rejected)." };
    // a devolvement larger than the amount notified cannot happen (June 2026 prints lakh-crore
    // figures in this cell); such a cell is left empty and recorded on the series
    { const hits = []; S.devolvement.data = S.devolvement.data.map((v, i) => { const n = S.notified.data[i]; if (v != null && n != null && v > n) { hits.push(`${P.dates[i]}: ₹${v} crore against ₹${n} crore notified`); return null; } return v; });
      if (hits.length) S.devolvement.gapsNote += ` Left empty where the table prints a devolvement larger than the amount offered, which cannot happen (${hits.join("; ")}).`; }
    S.bid_cover = { name: `tbill${tenor}_bid_cover`, label: `${tenor}-day T-bill: bids received as a multiple of the amount notified (derived)`, color: C.gold,
      data: P.dates.map((d) => { const n = P.get("NOTIFIED_AMOUNT", d), b = P.get("BIDS_RECV_COMP_FV", d), c = P.get("BIDS_RECV_NON_COMP_FV", d); return n > 0 && b != null ? r2((b + (c ?? 0)) / n) : null; }) };
    // identity: the auction-result table and the press-release parse agree on the cut-off yield
    let n = 0, worst = 0;
    for (const d of P.dates) { const p = tbP.get(`tbill|${tenor}|${d}`); const v = P.get("IMP_YIELD_AT_COP", d); if (p && p.cutoff_yield_pct != null && v != null) { n++; worst = Math.max(worst, Math.abs(p.cutoff_yield_pct - v)); } }
    if (n < 100 || worst > 0.011) throw new Error(`rbirates: ${slug}: DBIE and press-release cut-off yields disagree (n=${n}, worst ${worst.toFixed(4)})`);
    console.log(`  ${slug}: cut-off yields match the press releases on ${n} auctions (worst ${worst.toFixed(4)} pt)`);
    write(slug, { dates: P.dates, frequency: "weekly", vintage: retrieved(R), series: S,
      coverage: `Every auction of the ${tenor}-day Treasury bill since ${P.dates[0].slice(0, 4)}: cut-off yield, amounts notified, bid for, accepted and devolved`,
      latestPeriod: P.dates.at(-1),
      note: `RBI, Auctions of ${tenor}-Day Government of India Treasury Bills (DBIE report ${id}), ACTUALS rows; amounts converted from rupees to ₹ crore. The cut-off yield is the implicit yield at the cut-off price. Cross-checked against the RBI's auction press releases (Data Bank rbi_tbill_auctions) on ${n} common auctions. ${scaled} weighted average prices stored by the RBI multiplied by 1e7 (99.28 as 992,821,000, from September 2010) were divided by 1e7. Prices and yields printed as 0 are left empty. Before 2001 the total issue often exceeds the bids accepted plus the devolvement on primary dealers; the table does not print where the rest went.` });
  }
  {
    // cash management bills (from the combined table) and the discontinued 14-day bill
    const R = dbieReport(db, "311");
    const rows = keep("311", R, ACT(R).filter((x) => x.Tenure === "CMB" && isDate(x["Date of Auction"])), ["Date of Auction", "Auction_Code", "Auction_Values"], true);
    const P = pivot(rows, (x) => ymd(x["Date of Auction"]), (x) => x.Auction_Code, (x) => num(x.Auction_Values));
    const S = {};
    for (const [code, [k, l, kind]] of Object.entries(TBCODES)) if (P.has(code)) S[k] = { name: `cmb_${k}${kind === "pct" ? "_pct" : kind === "cr" ? "_inr_crore" : ""}`, label: `Cash management bill: ${l}`, color: k === "cutoff_yield" ? C.accent : C.g2, data: P.dates.map((d) => { const v = P.get(code, d); return v == null ? null : kind === "cr" ? r2(v / CR) : v; }) };
    if (P.dates.length) write("rates-tbill-cmb", { dates: P.dates, frequency: "irregular", vintage: retrieved(R), series: S,
      coverage: "Auctions of cash management bills: very short Treasury bills the government sells to cover a temporary cash gap",
      latestPeriod: P.dates.at(-1), note: "RBI, Auctions of Government of India Treasury Bills (DBIE report 311), rows with tenure 'CMB'. The table does not print each bill's tenor in days." });
  }
  {
    const R = dbieReport(db, "808");
    const rows = keep("808", R, R.rows.filter((x) => isDate(x["Dim C Time.D Time D Date"])), R.header);
    const D = [...new Set(rows.map((x) => ymd(x["Dim C Time.D Time D Date"])))].sort();
    const by = new Map(rows.map((x) => [ymd(x["Dim C Time.D Time D Date"]), x]));
    const col = (c, zeroIsNull) => D.map((d) => { const v = num(by.get(d)[c]); return zeroIsNull && v === 0 ? null : v; });
    write("rates-tbill-14", { dates: D, frequency: "weekly", vintage: retrieved(R),
      series: {
        cutoff_yield: { name: "tbill14_cutoff_yield_pct", label: "14-day T-bill: cut-off yield", color: C.accent, data: col("Imp Yield At Cop", true), gapsNote: "The table prints 0 for auctions with no cut-off (no bids accepted); left empty." },
        notified: { name: "tbill14_notified_inr_crore", label: "14-day T-bill: amount notified, ₹ crore", color: C.g2, data: col("Notified Amount") },
        bids_comp: { name: "tbill14_bids_comp_inr_crore", label: "14-day T-bill: competitive bids received, ₹ crore", color: C.g2, data: col("Bids Recv Comp Fv") },
        devolvement: { name: "tbill14_devolvement_inr_crore", label: "14-day T-bill: devolvement on primary dealers, ₹ crore", color: C.g2, data: col("Dev Pds Sds") },
      },
      coverage: "Auctions of the 14-day Treasury bill, a short bill the RBI auctioned between 1997 and 2001 (discontinued)",
      latestPeriod: D.at(-1), note: "RBI, Auctions of 14-Day Government of India Treasury Bills (Discontinued) (DBIE report 808). Amounts are printed in ₹ crore in this table." });
  }
  {
    // secondary-market T-bill yields by residual maturity, monthly (report 809 = 234)
    const R = dbieReport(db, "809");
    const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const rows = keep("809", R, R.rows, ["Year", "Month", "Term to maturity  (in days)", "Yield Rate"]);
    const dOf = (x) => { const m = MON[x.Month]; const y = +x.Year.slice(0, 4) + (m <= 3 ? 1 : 0); return `${y}-${String(m).padStart(2, "0")}-01`; };
    const P = pivot(rows, dOf, (x) => x["Term to maturity  (in days)"], (x) => num(x["Yield Rate"]));
    const D = monthAxis(P.dates[0].slice(0, 7), P.dates.at(-1).slice(0, 7));
    write("rates-tbill-sgl", { dates: D, frequency: "monthly", vintage: retrieved(R),
      series: Object.fromEntries([["Upto 14", "up_to_14", "up to 14 days"], ["15-91", "d15_91", "15 to 91 days"], ["92-182", "d92_182", "92 to 182 days"], ["183-364", "d183_364", "183 to 364 days"]].map(([src, k, l]) => [k,
        { name: `tbill_sgl_${k}_pct`, label: `Treasury bills traded in the market, ${l} left to maturity: yield`, color: k === "d15_91" ? C.accent : C.g2, data: D.map((d) => P.get(src, d)), gapsNote: "No trade in this maturity bucket that month." }])),
      coverage: "What Treasury bills yield when they change hands in the market, by time left to maturity, monthly since 1996",
      note: "RBI, Yield of SGL Transactions in Treasury Bills for Residual Maturities (DBIE report 809; Handbook report 234): weighted yields of trades settled in the RBI's Subsidiary General Ledger during the month." });
  }

  /* =================== 11. the government bond yield curve =================== */
  // Hand check (RBI Handbook of Statistics 2025-26, Table 'Month-end Yield of SGL Transactions
  // in Government Dated Securities for Various Maturities', March 2026 column, in the DBIE
  // mirror): the 10-year yield is read from the same table; checked one cell by hand in the
  // status file.
  {
    const R = dbieReport(db, "1368");
    const rows = keep("1368", R, R.rows.filter((x) => isDate(x["Time Date"])), ["Time Date", "Term to Maturity(in Years)", "Yield to Maturity(in % per annum)"]);
    const P = pivot(rows, (x) => month1(ymd(x["Time Date"])), (x) => +x["Term to Maturity(in Years)"], (x) => num(x["Yield to Maturity(in % per annum)"]));
    const D = monthAxis(P.dates[0].slice(0, 7), P.dates.at(-1).slice(0, 7));
    const S = {};
    for (let y = 1; y <= 30; y++) S[`y${y}`] = { name: `gsec_${y}y_pct`, label: `Government bond yield, ${y} year${y > 1 ? "s" : ""} to maturity`, color: y === 10 ? C.accent : y === 1 ? C.gold : C.g3,
      data: D.map((d) => r4(P.get(y, d))), gapsNote: "No traded security with this residual maturity at that month-end, so the RBI prints no yield." };
    S.spread_10_1 = { name: "gsec_10y_minus_1y_pt", label: "Term spread: 10-year minus 1-year yield, percentage points (derived)", color: C.gold,
      data: D.map((d) => { const a = P.get(10, d), b = P.get(1, d); return a != null && b != null ? r4(a - b) : null; }), gapsNote: "One of the two yields is missing that month." };
    write("rates-gsec-curve", { dates: D, frequency: "monthly", vintage: retrieved(R), series: S,
      coverage: "The government bond yield curve at every month-end since April 1996: yields for 1 to 30 years to maturity, and the 10-year minus 1-year spread",
      note: "RBI, Month-end Yield of SGL Transactions in Government Dated Securities for Various Maturities (DBIE report 1368; Handbook report 217): yields of central government securities traded in the RBI's SGL, read at whole-year residual maturities. Dated on the first of the month for the month-end it describes." });
  }
  {
    // annual weighted average and range of yields at which governments borrowed (report 105 = 312/316/1370)
    const R = dbieReport(db, "105");
    const rows = keep("105", R, R.rows, R.header);
    const D = [...new Set(rows.map((x) => fyStart(x.Year)))].sort();
    const g = (who, what, col) => D.map((d) => { const x = rows.find((r) => fyStart(r.Year) === d && r.hierarchy_level107 === who && r["hierarchy_level2 107"] === what); return x ? num(x[col]) : null; });
    write("rates-gsec-annual", { dates: D, frequency: "annual", vintage: retrieved(R),
      series: {
        centre_wavg: { name: "centre_wavg_pct", label: "Central government securities: weighted average interest rate on the year's borrowing", color: C.accent, data: g("Central Government securities", "Weighted average", "Min_Value") },
        centre_min: { name: "centre_min_pct", label: "Central government securities: lowest rate in the year", color: C.g3, data: g("Central Government securities", "Range", "Min_Value") },
        centre_max: { name: "centre_max_pct", label: "Central government securities: highest rate in the year", color: C.g3, data: g("Central Government securities", "Range", "Max_Value") },
        states_wavg: { name: "states_wavg_pct", label: "State government securities: weighted average interest rate on the year's borrowing", color: C.gold, data: g("State Government securities", "Weighted average", "Min_Value") },
        states_min: { name: "states_min_pct", label: "State government securities: lowest rate in the year", color: C.g3, data: g("State Government securities", "Range", "Min_Value") },
        states_max: { name: "states_max_pct", label: "State government securities: highest rate in the year", color: C.g3, data: g("State Government securities", "Range", "Max_Value") },
      },
      coverage: "The interest rate the central and state governments paid on new market loans each financial year since 1980-81: weighted average and range",
      latestPeriod: fyOf(D.at(-1)),
      note: "RBI, Interest Rates on Central and State Government Dated Securities (DBIE report 105, Handbook). The weighted average is printed once (in both columns of the source; the minimum column is read). Dated on 1 April of each financial year." });
  }

  /* =================== 12. how much governments borrow =================== */
  {
    const R = dbieReport(db, "104");
    const rows = keep("104", R, ACT(R), ["Year", "Description", "Amount (Rs.Crore)"]);
    const D = [...new Set(rows.map((x) => fyStart(x.Year)))].sort();
    const g = (desc) => D.map((d) => { const x = rows.find((r) => fyStart(r.Year) === d && r.Description === desc); return x ? r2(num(x["Amount (Rs.Crore)"]) / CR) : null; });
    write("rates-borrowing", { dates: D, frequency: "annual", unit: "inr_crore", vintage: retrieved(R),
      series: {
        centre_gross: { name: "centre_gross_inr_crore", label: "Central government: gross market borrowing, ₹ crore", color: C.accent, data: g("Government of India Gross Amount Raised") },
        centre_net: { name: "centre_net_inr_crore", label: "Central government: net market borrowing (after repayments), ₹ crore", color: C.g1, data: g("Government of India Net Amount Raised") },
        states_gross: { name: "states_gross_inr_crore", label: "State governments: gross market borrowing, ₹ crore", color: C.gold, data: g("State Governments Gross Amount Raised") },
        states_net: { name: "states_net_inr_crore", label: "State governments: net market borrowing (after repayments), ₹ crore", color: C.g2, data: g("State Governments Net Amount Raised") },
      },
      coverage: "How much the central and state governments borrow from the market each year since 1980-81, gross and net of repayments",
      latestPeriod: fyOf(D.at(-1)),
      note: "RBI, Market Borrowings of the Central and State Governments (DBIE report 104, Handbook; the same table as 341). Dated securities; converted from rupees to ₹ crore. Dated on 1 April of each financial year." });
  }
  {
    // weekly running totals for the current year (report 3, Weekly Statistical Supplement)
    const R = dbieReport(db, "3");
    const rows = keep("3", R, ACT(R).filter((x) => isDate(x.Date)), ["Date", "Item_Description", "Item_Value"]);
    const P = pivot(rows, (x) => ymd(x.Date), (x) => x.Item_Description, (x) => num(x.Item_Value));
    write("rates-borrowing-weekly", { dates: P.dates, frequency: "weekly", unit: "inr_crore", vintage: retrieved(R),
      series: Object.fromEntries([["Government of India Gross Amount Raised", "centre_gross", C.accent], ["Government of India Net Amount Raised", "centre_net", C.g1], ["State Governments Gross Amount Raised", "states_gross", C.gold], ["State Governments Net Amount Raised", "states_net", C.g2]]
        .map(([src, k, c]) => [k, { name: `${k}_fytd_inr_crore`, label: `${src.replace("Government of India", "Central government").replace("State Governments", "State governments").replace(" Amount Raised", "")} market borrowing so far this financial year, ₹ crore`, color: c,
          data: P.dates.map((d) => r2(P.get(src, d) == null ? null : P.get(src, d) / CR)), gapsNote: "Not printed that week." }])),
      coverage: "Government market borrowing so far in the financial year, week by week since January 2012 (centre and states, gross and net)",
      latestPeriod: P.dates.at(-1),
      note: "RBI, Weekly Statistical Supplement, Market Borrowings by the Government of India and State Governments (DBIE report 3; also 314, 317, 727). Running totals from 1 April; they reset each financial year. Converted from rupees to ₹ crore." });
  }
  // state borrowing by state, monthly (report 38) and annual (report 1737)
  const STATE_NAME = stateNameOf;
  {
    const R = dbieReport(db, "38");
    // every row of this table is a state (the State Name column); from May 2023 the RBI labels
    // them with the central government's item names, so rows are read by state and gross/net only
    const rows = keep("38", R, ACT(R).filter((x) => isDate(x["D Time D Date"]) && x["State Name"]), ["D Time D Date", "State Name", "Item Name", "Amount"]);
    const P = pivot(rows, (x) => month1(ymd(x["D Time D Date"])), (x) => `${STATE_NAME(x["State Name"]) ?? "?" + x["State Name"]}|${/Gross/.test(x["Item Name"]) ? "gross" : "net"}`, (x) => num(x.Amount));
    const states = [...new Set(rows.map((x) => STATE_NAME(x["State Name"])))];
    if (states.includes(null)) throw new Error(`rbirates: report 38 has a state the alias table does not know: ${rows.find((x) => !STATE_NAME(x["State Name"]))["State Name"]}`);
    const D = monthAxis(P.dates[0].slice(0, 7), P.dates.at(-1).slice(0, 7));
    const S = {};
    for (const st of states.sort()) for (const w of ["gross", "net"]) S[`${slugify(st)}_${w}`] = { name: `${slugify(st)}_${w}_inr_crore`, label: `${st}: ${w} market borrowing in the month, ₹ crore`, color: C.g2,
      data: D.map((d) => { const v = P.get(`${st}|${w}`, d); return v == null ? null : r2(v / CR); }), gapsNote: "The state did not borrow from the market that month (the RBI prints nothing)." };
    write("rates-state-borrowing-monthly", { dates: D, frequency: "monthly", unit: "inr_crore", vintage: retrieved(R), series: S,
      coverage: "How much each state borrows from the market each month since April 2018, gross and net of repayments",
      note: "RBI Bulletin, Market Borrowings of State Governments (DBIE report 38; also 319). Converted from rupees to ₹ crore. A month in which a state raised nothing is printed as empty. From May 2023 the RBI's table labels these state rows with the central government's item names ('Government of India Gross Amount Raised'); they are read by state and by gross or net." });
  }
  {
    const R = dbieReport(db, "1737");
    const rows = keep("1737", R, R.rows, ["Time Fis Year", "State Name", "Item Description", "Decitemvalue1"]);
    const D = [...new Set(rows.map((x) => fyStart(x["Time Fis Year"])))].sort();
    const st = [...new Set(rows.map((x) => x["State Name"]))];
    const S = {};
    for (const s of st.sort()) { const nm = s === "Total" ? "All states" : STATE_NAME(s); if (!nm) throw new Error(`rbirates: report 1737 state ${s} unknown`);
      for (const [item, k] of [["Gross Amount Raised", "gross"], ["Repayments", "repayments"]]) S[`${slugify(nm)}_${k}`] = { name: `${slugify(nm)}_${k}_inr_crore`, label: `${nm}: ${k === "gross" ? "gross market borrowing" : "repayments"} in the year, ₹ crore`, color: nm === "All states" ? C.accent : C.g2,
        data: D.map((d) => { const x = rows.find((r) => fyStart(r["Time Fis Year"]) === d && r["State Name"] === s && r["Item Description"] === item); return x ? r2(num(x.Decitemvalue1) / CR) : null; }) }; }
    write("rates-state-borrowing", { dates: D, frequency: "annual", unit: "inr_crore", vintage: retrieved(R), series: S,
      coverage: "Each state's gross market borrowing and repayments, financial year by financial year",
      latestPeriod: fyOf(D.at(-1)),
      note: "RBI, Handbook of Statistics on Indian States, Market Borrowings of State Governments (DBIE report 1737). Converted from rupees to ₹ crore; dated on 1 April of each financial year. 'Keralam' as printed is shown as Kerala." });
  }

  /* =================== 13. the weekly supplement: the rates a bank customer sees =================== */
  {
    const R = webiProvider(db, "10", "DP6");
    const rows = keep("10", R, R.rows.filter((x) => isDate(x["Time Date"])), ["Time Date", "Item Hierarchy Level1", "Item Description", "Growth Rate", "Growth Rate(Base Rate/Term Dep._ Max)"]);
    const P = pivot(rows, (x) => ymd(x["Time Date"]), (x) => x["Item Description"].trim(), (x) => ({ v: num(x["Growth Rate"]), hi: num(x["Growth Rate(Base Rate/Term Dep._ Max)"]) }));
    const one = (item) => P.dates.map((d) => P.get(item, d)?.v ?? null);
    // ranges print the low end in the value column and the high end in the 'max' column; a single
    // printed rate (no max) is both ends
    const lo = (item) => P.dates.map((d) => P.get(item, d)?.v ?? null);
    const hi = (item) => P.dates.map((d) => { const x = P.get(item, d); return x ? x.hi ?? x.v : null; });
    const SPEC = [
      ["repo", "Policy Repo Rate", "Policy repo rate", one, C.accent], ["reverse_repo", "Reverse Repo Rate", "Reverse repo rate", one, C.g2], ["sdf", "Standing Deposit Facility (SDF) Rate", "SDF rate", one, C.g2],
      ["msf", "Marginal Standing Facility (MSF) Rate", "MSF rate", one, C.g2], ["bank_rate", "Bank Rate", "Bank Rate", one, C.g2], ["crr", "Cash Reserve Ratio", "Cash reserve ratio, % of deposits", one, C.g2], ["slr", "Statutory Liquidity Ratio", "Statutory liquidity ratio, % of deposits", one, C.g2],
      ["call", "Call Money Rate (Weighted Average)", "Call money rate, weighted average for the week", one, C.g1],
      ["tbill_91", "91-Day Treasury Bill (Primary) Yield", "91-day Treasury bill, primary auction yield", one, C.g1], ["tbill_182", "182-Day Treasury Bill (Primary) Yield", "182-day Treasury bill, primary auction yield", one, C.g2], ["tbill_364", "364-Day Treasury Bill (Primary) Yield", "364-day Treasury bill, primary auction yield", one, C.g2],
      ["gsec_10y", "10-Year G-Sec Par Yield (FBIL)", "10-year government bond, par yield (FBIL)", one, C.accent],
      ["term_deposit_min", "Term Deposit Rate >1 Year", "Banks' term deposit rates for more than one year: low end of the range", lo, C.gold], ["term_deposit_max", "Term Deposit Rate >1 Year", "Banks' term deposit rates for more than one year: high end of the range", hi, C.gold],
      ["savings_min", "Savings Deposit Rate", "Savings deposit rate: low end of the range", lo, C.g1], ["savings_max", "Savings Deposit Rate", "Savings deposit rate: high end of the range", hi, C.g1],
      ["base_rate_min", "Base Rate", "Banks' base rates: low end of the range", lo, C.g2], ["base_rate_max", "Base Rate", "Banks' base rates: high end of the range", hi, C.g2],
      ["mclr_on_min", "MCLR (Overnight)", "Banks' overnight MCLR: low end of the range", lo, C.g2], ["mclr_on_max", "MCLR (Overnight)", "Banks' overnight MCLR: high end of the range", hi, C.g2],
    ];
    const items = new Set(rows.map((x) => x["Item Description"].trim()));
    const FX = ["INR-US$ Spot Rate ( Rs. Per Foreign Currency)", "INR-Euro Spot Rate ( Rs. Per Foreign Currency)", "Forward Premia of US$ 1-month", "3-month", "6-month"];
    for (const it of items) if (!SPEC.some((s) => s[1] === it) && !FX.includes(it)) throw new Error(`rbirates: WSS rates table has an item this adapter does not read: ${it}`);
    write("rates-wss", { zeroRatesEmpty: true, dates: P.dates, frequency: "weekly", vintage: retrieved(R),
      series: Object.fromEntries(SPEC.map(([k, src, l, f, c]) => [k, { name: `${k}_pct`, label: l, color: c, data: f(src), gapsNote: "Not printed that week." }])),
      coverage: "The rates of the week as the RBI's Weekly Statistical Supplement prints them since April 2011: policy rates, call money, T-bill and 10-year bond yields, and the deposit and lending rates banks advertise (term and savings deposit ranges, base rate, overnight MCLR)",
      latestPeriod: P.dates.at(-1),
      note: "RBI, Weekly Statistical Supplement, Table 4 'Ratios and Rates' (DBIE report 10, the rates block, data provider DP6). Deposit and lending rates are ranges across major banks (low and high ends); a week printing one rate gives both ends that rate. The exchange-rate and forward-premia lines of the same table belong to the external-account guide; the credit-deposit ratios to the credit guide." });
  }

  /* =================== 14. the structure of interest rates since 1970 =================== */
  {
    const R = webiProvider(db, "282", "DP1");
    const rows = keep("282", R, R.rows, ["Year", "Structure Hierarchy Level 1", "Structure Hierarchy Level 2", "Structure Hierarchy Level 3", "Structure Hierarchy Level 4", "Structure Rate", "Structure Min Rate", "Structure Max Rate"]);
    const LINES = [
      ["call", "Call/Notice Money Rates|||", "Call money rate"],
      ["cb_dep_1_3", "Commercial Bank Rates|Deposit Rates*|1 to 3 yrs.|", "Commercial banks: deposit rate, 1 to 3 years"],
      ["cb_dep_3_5", "Commercial Bank Rates|Deposit Rates*|Over 3 yrs. & upto 5 yrs.|", "Commercial banks: deposit rate, over 3 and up to 5 years"],
      ["cb_dep_5", "Commercial Bank Rates|Deposit Rates*|Above 5 yrs.|", "Commercial banks: deposit rate, above 5 years"],
      ["cb_lend_ceiling", "Commercial Bank Rates|Lending Rates*|Key Lending Rates as Prescribed by RBI  (All Commercial Banks including SBI) - Ceiling Rate General|", "Commercial banks: lending rate ceiling prescribed by the RBI"],
      ["cb_lend_min", "Commercial Bank Rates|Lending Rates*|Key Lending Rates as Prescribed by RBI  (All Commercial Banks including SBI) - Minimum Rate General|", "Commercial banks: minimum lending rate prescribed by the RBI"],
      ["cb_lend_min_scc", "Commercial Bank Rates|Lending Rates*|Key Lending Rates as Prescribed by RBI  (All Commercial Banks including SBI) - Minimum Rate Selective Credit Control|", "Commercial banks: minimum lending rate under selective credit control"],
      ["cb_sbi_advance", "Commercial Bank Rates|Lending Rates*|SBI Advance Rate|", "State Bank of India advance rate"],
      ["fmb_dep_1_3", "Five Major Banks|Deposit Rates*|Term Deposits|1-3 years", "Five major banks: term deposit rate, 1 to 3 years"],
      ["fmb_dep_3_5", "Five Major Banks|Deposit Rates*|Term Deposits|3-5 years", "Five major banks: term deposit rate, 3 to 5 years"],
      ["fmb_dep_5", "Five Major Banks|Deposit Rates*|Term Deposits|Above 5 yrs.", "Five major banks: term deposit rate, above 5 years"],
      ["fmb_savings", "Five Major Banks|Deposit Rates*|Savings#|", "Five major banks: savings deposit rate"],
      ["fmb_lending", "Five Major Banks|Lending Rates*||", "Five major banks: lending rates"],
      ["fmb_mclr", "Five Major Banks|MCLR* (1-year)||", "Five major banks: 1-year MCLR"],
      ["scb_mclr_median", "All SCBs|1-Year MCLR (Median)$||", "All scheduled commercial banks: median 1-year MCLR"],
      ["scb_walr_out", "All SCBs|WALR - Outstanding Rupee Loans$||", "All scheduled commercial banks: WALR on outstanding loans"],
      ["scb_walr_fresh", "All SCBs|WALR - Fresh Rupee Loans$||", "All scheduled commercial banks: WALR on fresh loans"],
      ["scb_wadtdr", "All SCBs|WADTDR-Outstanding Term Deposits $||", "All scheduled commercial banks: WADTDR on outstanding term deposits"],
      ["tli_idbi", "Prime Lending Rates of Term Lending Institutions|IDBI||", "Term lending institutions: IDBI prime lending rate"],
      ["tli_ifci", "Prime Lending Rates of Term Lending Institutions|IFCI||", "Term lending institutions: IFCI prime lending rate"],
      ["tli_icici", "Prime Lending Rates of Term Lending Institutions|ICICI||", "Term lending institutions: ICICI prime lending rate"],
      ["tli_iibi", "Prime Lending Rates of Term Lending Institutions|IIBI / IRBI||", "Term lending institutions: IIBI (earlier IRBI) prime lending rate"],
      ["tli_sfc", "Prime Lending Rates of Term Lending Institutions|SFCs||", "Term lending institutions: state financial corporations' prime lending rate"],
      ["uti_dividend", "Units of UTI  (July-June)|Dividend Rate||", "Unit Trust of India: dividend rate (July to June)"],
      ["uti_yield", "Units of UTI  (July-June)|Yield Rate||", "Unit Trust of India: yield rate (July to June)"],
      ["gsec_short", "Annual (Gross) Redemption Yield of Government of India Securities|Short-Term (1-5yrs.)||", "Government of India securities: redemption yield, 1 to 5 years"],
      ["gsec_medium", "Annual (Gross) Redemption Yield of Government of India Securities|Medium-Term (5-15yrs.)||", "Government of India securities: redemption yield, 5 to 15 years"],
      ["gsec_long", "Annual (Gross) Redemption Yield of Government of India Securities|Long-Term (15 yrs. & Above)||", "Government of India securities: redemption yield, 15 years and above"],
    ];
    const keyOf = (x) => [x["Structure Hierarchy Level 1"], x["Structure Hierarchy Level 2"], x["Structure Hierarchy Level 3"], x["Structure Hierarchy Level 4"]].join("|");
    for (const x of rows) if (!LINES.some((l) => l[1] === keyOf(x))) throw new Error(`rbirates: Structure of Interest Rates has a line this adapter does not read: ${keyOf(x)}`);
    const D = [...new Set(rows.map((x) => fyStart(x.Year)))].sort();
    const at = (k, d) => rows.find((x) => keyOf(x) === k && fyStart(x.Year) === d);
    const S = {};
    for (const [k, src, l] of LINES) {
      const hasRate = rows.some((x) => keyOf(x) === src && num(x["Structure Rate"]) != null);
      const hasRange = rows.some((x) => keyOf(x) === src && (num(x["Structure Min Rate"]) != null || num(x["Structure Max Rate"]) != null));
      const c = /dep/.test(k) ? C.accent : /gsec/.test(k) ? C.gold : C.g2;
      if (hasRate) S[k] = { name: `${k}_pct`, label: l, color: c, data: D.map((d) => num(at(src, d)?.["Structure Rate"])), gapsNote: "Not printed for this year." };
      if (hasRange) {
        S[`${k}_low`] = { name: `${k}_low_pct`, label: `${l}: low end of the range`, color: c, data: D.map((d) => { const x = at(src, d); return x ? num(x["Structure Min Rate"]) ?? null : null; }), gapsNote: "Not printed for this year (some years print only the high end)." };
        S[`${k}_high`] = { name: `${k}_high_pct`, label: `${l}: high end of the range`, color: c, data: D.map((d) => { const x = at(src, d); return x ? num(x["Structure Max Rate"]) ?? null : null; }), gapsNote: "Not printed for this year." };
      }
    }
    write("rates-structure", { dates: D, frequency: "annual", vintage: retrieved(R), series: S,
      coverage: "The structure of interest rates in India each financial year since 1970-71: call money, deposit and lending rates of commercial banks, term lending institutions, UTI, and government securities yields",
      latestPeriod: fyOf(D.at(-1)),
      note: "RBI, Handbook of Statistics on the Indian Economy, Structure of Interest Rates (DBIE report 282, data provider DP1; the same table as 441). Different rulers sit side by side and are never joined: deposit and lending rates of all commercial banks (prescribed by the RBI) to 1999-00, the range across five major banks from 2000-01, and the all-bank weighted averages (WALR, WADTDR, median MCLR) from 2005-06. Ranges print a low and a high end. The current financial year's column is the latest reading the Handbook prints, not a full-year figure. Dated on 1 April of each financial year." });
  }

  /* =================== 15. central government bond auctions since 1995 =================== */
  // Hand check (RBI press release 'Government Stock - Full Auction Results', 25 September 2026, as
  // the Data Bank parses it): 6.94% GS 2036, notified ₹34,000 crore, cut-off yield 7.1450%. The
  // per-auction totals below are checked against the Data Bank's rbi_gsec_auctions for every
  // auction both carry.
  {
    const R = dbieReport(db, "559");
    const rows = keep("559", R, ACT(R).filter((x) => isDate(x["Auction Date-i"])), ["Auction Date-i", "Spcl Value", "Auction Code", "Item Values"], true);
    const auc = new Map();                                           // date -> security -> code -> value
    for (const x of rows) { const v = num(x["Item Values"]); if (v == null) continue; const d = ymd(x["Auction Date-i"]); const a = auc.get(d) ?? auc.set(d, new Map()).get(d); const s2 = a.get(x["Spcl Value"]) ?? a.set(x["Spcl Value"], {}).get(x["Spcl Value"]); s2[x["Auction Code"]] = v; }
    const D = [...auc.keys()].sort();
    const sum = (d, code, scale = CR) => { let t = 0, any = false; for (const s2 of auc.get(d).values()) if (s2[code] != null) { t += s2[code]; any = true; } return any ? r2(t / scale) : null; };
    const wavg = (d, code) => { let t = 0, w = 0; for (const s2 of auc.get(d).values()) if (s2[code] != null && s2[code] > 0 && s2.NOTIFIED_AMOUNT > 0) { t += s2[code] * s2.NOTIFIED_AMOUNT; w += s2.NOTIFIED_AMOUNT; } return w ? r4(t / w) : null; };
    const S = {
      notified: { name: "gsec_notified_inr_crore", label: "Central government bonds auctioned: amount notified, ₹ crore", color: C.g1, data: D.map((d) => sum(d, "NOTIFIED_AMOUNT")) },
      bids: { name: "gsec_bids_inr_crore", label: "Bids received (competitive and non-competitive), ₹ crore", color: C.g2, data: D.map((d) => { const a = sum(d, "BIDS_RECV_COMP_FV"), b = sum(d, "BIDS_RECV_NON_COMP_FV"); return a == null && b == null ? null : r2((a ?? 0) + (b ?? 0)); }) },
      accepted: { name: "gsec_accepted_inr_crore", label: "Bids accepted (competitive and non-competitive), ₹ crore", color: C.g2, data: D.map((d) => { const a = sum(d, "BIDS_ACC_COMP_FV"), b = sum(d, "BIDS_ACC_NON_COMP_FV"); return a == null && b == null ? null : r2((a ?? 0) + (b ?? 0)); }) },
      devolved_pd: { name: "gsec_devolvement_pd_inr_crore", label: "Devolvement on primary dealers (what the market would not take), ₹ crore", color: C.gold, data: D.map((d) => sum(d, "DEV_ON_PDS")) },
      devolved_rbi: { name: "gsec_devolvement_rbi_inr_crore", label: "Devolvement or private placement on the RBI, ₹ crore", color: C.gold, data: D.map((d) => sum(d, "DEV_ON_RBI")) },
      cutoff_yield: { name: "gsec_cutoff_yield_wavg_pct", label: "Cut-off yield, weighted by the amount notified across the day's securities (derived)", color: C.accent, data: D.map((d) => wavg(d, "IMP_YIELD_AT_COP")) },
      maturity: { name: "gsec_maturity_wavg_years", label: "Years to maturity, weighted by the amount notified (derived)", color: C.g2, data: D.map((d) => wavg(d, "MATURIY_RES_PERIOD")) },
      securities: { name: "gsec_securities_n", label: "Securities auctioned that day", color: C.g3, data: D.map((d) => auc.get(d).size) },
    };
    for (const s2 of Object.values(S)) s2.gapsNote = "Not printed for this auction day.";
    // cross-check against the press-release parse (2019 on): notified totals per auction day
    const GS = parsed(db, "rbi_gsec_auctions", "auction_date, security, security_type, notified_amount_cr, cutoff_yield_pct, devolvement_cr", "auction_date, security", "auction_date, security");
    RAW.gsec = GS;
    const pn = new Map(); for (const r of GS.rows) pn.set(r.auction_date, (pn.get(r.auction_date) ?? 0) + (r.notified_amount_cr ?? 0));
    let n = 0, bad = [];
    for (const [d, v] of pn) { const i = D.indexOf(d); if (i < 0) continue; n++; if (Math.abs(S.notified.data[i] - v) > 1) bad.push(`${d}: DBIE ${S.notified.data[i]} vs press release ${v}`); }
    if (n < 200) throw new Error(`rbirates: only ${n} G-sec auction days in common with the press-release parse`);
    console.log(`  rates-gsec-auctions: notified totals match the press releases on ${n - bad.length} of ${n} common auction days${bad.length ? "; differ: " + bad.slice(0, 5).join("; ") : ""}`);
    write("rates-gsec-auctions", { dates: D, frequency: "irregular", vintage: retrieved(R), series: S,
      coverage: "Every auction of central government bonds since April 1995: how much was offered, how much was bid, what the market would not take (devolvement), and the yield the government accepted",
      latestPeriod: D.at(-1),
      note: `RBI, Details of Central Government Market Borrowings (DBIE report 559; also 576, 830, 1218), ACTUALS rows, summed over the securities auctioned each day; amounts converted from rupees to ₹ crore. Weighted averages weight each security by its notified amount. Notified totals agree with the RBI's auction press releases (Data Bank rbi_gsec_auctions) on ${n - bad.length} of ${n} common days.`,
      extra: { crosscheckDifferences: bad } });
    // financial-year totals
    const FY = [...new Set(D.map((d) => fyStart(fyOf(d))))].sort();
    const inFY = (fy) => D.map((d, i) => [d, i]).filter(([d]) => fyStart(fyOf(d)) === fy).map(([, i]) => i);
    const tot = (k, fy) => { const v = inFY(fy).map((i) => S[k].data[i]).filter((x) => x != null); return v.length ? r2(v.reduce((a, b) => a + b, 0)) : null; };
    write("rates-gsec-auctions-fy", { dates: FY, frequency: "annual", vintage: retrieved(R),
      series: {
        notified: { name: "notified_inr_crore", label: "Central government bonds auctioned in the year: notified, ₹ crore", color: C.g1, data: FY.map((f) => tot("notified", f)) },
        bids: { name: "bids_inr_crore", label: "Bids received in the year, ₹ crore", color: C.g2, data: FY.map((f) => tot("bids", f)) },
        devolved_pd: { name: "devolvement_pd_inr_crore", label: "Devolved on primary dealers in the year, ₹ crore", color: C.gold, data: FY.map((f) => tot("devolved_pd", f) ?? 0) },
        devolved_rbi: { name: "devolvement_rbi_inr_crore", label: "Devolved or privately placed on the RBI in the year, ₹ crore", color: C.gold, data: FY.map((f) => tot("devolved_rbi", f) ?? 0) },
        auctions: { name: "auction_days_n", label: "Auction days in the year", color: C.g3, data: FY.map((f) => inFY(f).length) },
        auctions_devolved: { name: "auction_days_with_devolvement_n", label: "Auction days with any devolvement on primary dealers", color: C.gold, data: FY.map((f) => inFY(f).filter((i) => S.devolved_pd.data[i] > 0).length) },
        cutoff_yield: { name: "cutoff_yield_wavg_pct", label: "Cut-off yield over the year, weighted by the amount notified (derived)", color: C.accent,
          data: FY.map((f) => { let t = 0, w = 0; for (const i of inFY(f)) { const y = S.cutoff_yield.data[i], n2 = S.notified.data[i]; if (y != null && n2 > 0) { t += y * n2; w += n2; } } return w ? r4(t / w) : null; }) },
      },
      coverage: "Central government bond auctions added up by financial year: amounts offered and bid, devolvement, and the average yield accepted",
      latestPeriod: fyOf(FY.at(-1)),
      note: "Sums over the auction days in rates-gsec-auctions, by financial year (April to March). A year with no devolvement is printed 0 (no amount devolved), not empty. The current financial year is not over. Dated on 1 April of each financial year." });
  }

  /* =================== 16. state government bond auctions =================== */
  // Hand check (RBI press release 'State Government Securities - Full Auction Result', 29 September
  // 2026, Data Bank rbi_sdl_auctions): allotments sum to ₹19,200 crore across 25 securities.
  {
    const SD = parsed(db, "rbi_sdl_auctions", "auction_date, state, security, tenor_years, notified_amount_cr, cutoff_yield_pct, total_allotted_cr", "auction_date, state, security", "auction_date, security");
    RAW.sdl = SD;
    const R = dbieReport(db, "1213");
    const rows = keep("1213", R, ACT(R).filter((x) => isDate(x["Time Date"])), ["Time Date", "Nomenclature Loan", "Auction Hierarchy Level 1", "Auction Hierarchy Level 2", "Auction Hierarchy Level 3", "Item Value"], true);
    const stateOfLoan = (nom) => STATE_NAME(String(nom).replace(/^\s*[\d.]+\s*%?\s*/, "").replace(/^NI\s+/i, "").replace(/\b(SDL|SGS|GS|STATE DEVELOPMENT LOAN|UDAY BOND)\b.*$/i, "").replace(/\s*\d{4}.*$/, ""));
    const unknown = new Set();
    const auc = new Map();                                           // date|loan -> fields
    for (const x of rows) {
      const st = stateOfLoan(x["Nomenclature Loan"]); if (!st) { unknown.add(x["Nomenclature Loan"]); continue; }
      const k = `${ymd(x["Time Date"])}|${x["Nomenclature Loan"]}`; const a = auc.get(k) ?? auc.set(k, { d: ymd(x["Time Date"]), st }).get(k);
      const l1 = x["Auction Hierarchy Level 1"], l2 = x["Auction Hierarchy Level 2"], l3 = x["Auction Hierarchy Level 3"], v = num(x["Item Value"]);
      if (v == null) continue;
      if (l1 === "Notified Amount") a.notified = v;
      else if (l1 === "Cut Off Yield") a.yield = v;
      else if (l1 === "Weighted Avg. Yield") a.wyield = v;
      else if (l1 === "Bids Received" && /Value/.test(l3)) a.bids = (a.bids ?? 0) + v;
      else if (l1 === "Bids Accepted" && /Value/.test(l3)) a.accepted = (a.accepted ?? 0) + v;
      else if (/^Devolvement/.test(l1)) a.devolved = (a.devolved ?? 0) + v;
    }
    if (unknown.size) console.warn(`rbirates: report 1213: ${unknown.size} loan names with no state, e.g. ${[...unknown].slice(0, 5).join("; ")}`);
    const A = [...auc.values()].filter((a) => a.notified != null || a.accepted != null);
    const STATES = [...new Set(A.map((a) => a.st))].sort();
    const FY = [...new Set(A.map((a) => fyStart(fyOf(a.d))))].sort();
    const raised = (a) => (a.accepted ?? 0) + (a.devolved ?? 0);
    const agg = (st, fy) => {
      const xs = A.filter((a) => a.st === st && fyStart(fyOf(a.d)) === fy); if (!xs.length) return null;
      const amt = xs.reduce((t, a) => t + raised(a), 0);
      const wavg = (f) => { const ws = xs.filter((a) => a[f] > 0 && raised(a) > 0); const w = ws.reduce((t, a) => t + raised(a), 0); return w ? r4(ws.reduce((t, a) => t + a[f] * raised(a), 0) / w) : null; };
      const bids = xs.filter((a) => a.bids != null);
      return { amt: r2(amt / CR), y: wavg("yield"), wy: wavg("wyield"), bids: bids.length ? r2(bids.reduce((t, a) => t + a.bids, 0) / CR) : null, notified: r2(xs.reduce((t, a) => t + (a.notified ?? 0), 0) / CR), n: xs.length };
    };
    const S = {};
    for (const st of STATES) {
      S[`${slugify(st)}_yield`] = { name: `${slugify(st)}_cutoff_yield_wavg_pct`, label: `${st}: cut-off yield on the year's auctioned loans, weighted by amount raised`, color: C.g2, data: FY.map((f) => agg(st, f)?.y ?? null), gapsNote: "The state raised nothing at auction that year." };
      S[`${slugify(st)}_wavg_yield`] = { name: `${slugify(st)}_wavg_yield_pct`, label: `${st}: weighted average yield of accepted bids, weighted across the year's loans by amount raised`, color: C.g3, data: FY.map((f) => agg(st, f)?.wy ?? null), gapsNote: "The state raised nothing at auction that year, or the table prints no weighted average." };
      S[`${slugify(st)}_raised`] = { name: `${slugify(st)}_raised_inr_crore`, label: `${st}: amount raised at auction in the year, ₹ crore`, color: C.g2, data: FY.map((f) => agg(st, f)?.amt ?? null), gapsNote: "The state raised nothing at auction that year." };
      S[`${slugify(st)}_notified`] = { name: `${slugify(st)}_notified_inr_crore`, label: `${st}: amount offered (notified) at auction in the year, ₹ crore`, color: C.g3, data: FY.map((f) => agg(st, f)?.notified ?? null), gapsNote: "The state held no auction that year." };
      S[`${slugify(st)}_bids`] = { name: `${slugify(st)}_bids_inr_crore`, label: `${st}: bids received at auction in the year, ₹ crore`, color: C.g3, data: FY.map((f) => agg(st, f)?.bids ?? null), gapsNote: "The state held no auction that year, or the table prints no bids." };
    }
    const allY = FY.map((f) => { const xs = A.filter((a) => fyStart(fyOf(a.d)) === f && a.yield > 0 && raised(a) > 0); const w = xs.reduce((t, a) => t + raised(a), 0); return w ? r4(xs.reduce((t, a) => t + a.yield * raised(a), 0) / w) : null; });
    S.all_yield = { name: "all_states_cutoff_yield_wavg_pct", label: "All states: cut-off yield on the year's auctioned loans, weighted by amount raised", color: C.accent, data: allY };
    S.all_raised = { name: "all_states_raised_inr_crore", label: "All states: amount raised at auction in the year, ₹ crore", color: C.accent, data: FY.map((f) => r2(A.filter((a) => fyStart(fyOf(a.d)) === f).reduce((t, a) => t + raised(a), 0) / CR)) };
    // cross-check: the press-release parse (from April 2019) gives the same yearly state totals,
    // compared only up to the last auction the DBIE table carries
    const lastDbie = A.reduce((m, a) => (a.d > m ? a.d : m), "");
    let checks = 0; const diffs = [];
    for (const f of FY) for (const st of STATES) {
      const xs = SD.rows.filter((r) => r.state === st && fyStart(fyOf(r.auction_date)) === f && r.total_allotted_cr != null && r.auction_date <= lastDbie);
      if (!xs.length || f < "2019-04-01") continue;
      const p = xs.reduce((t, r) => t + r.total_allotted_cr, 0), mine = agg(st, f)?.amt;
      if (mine == null) continue; checks++;
      if (Math.abs(p - mine) > Math.max(5, 0.01 * p)) diffs.push(`${st} ${fyOf(f)}: DBIE ${mine} vs press releases ${r2(p)}`);
    }
    console.log(`  rates-sdl-states: state-year totals checked against the press-release parse: ${checks - diffs.length} of ${checks} agree${diffs.length ? "; e.g. " + diffs.slice(0, 4).join("; ") : ""}`);
    write("rates-sdl-states", { dates: FY, frequency: "annual", vintage: retrieved(R), series: S,
      coverage: `What each state pays to borrow: the cut-off yield and the amount raised at auction, for ${STATES.length} states and union territories, each financial year since ${fyOf(FY[0])}`,
      latestPeriod: fyOf(FY.at(-1)),
      note: `RBI, Details of State Governments Market Borrowings (DBIE report 1213; also 1219), ACTUALS rows. The state is read from each loan's name ('7.44% TAMILNADU SGS 2033'); the RBI spells states many ways (110 spellings for about 31 states), normalised by a fixed alias table in the adapter${unknown.size ? `; ${unknown.size} loan names matched no state and are left out` : ""}. Amount raised = bids accepted plus any devolvement. Yields are weighted by amount raised. The current financial year is not over. From April 2019 the state-year totals are checked against the RBI's auction press releases (Data Bank rbi_sdl_auctions): ${checks - diffs.length} of ${checks} agree within 1%.`,
      extra: { crosscheckDifferences: diffs, unmatchedLoans: [...unknown] } });
  }

  /* =================== 17. older lending-rate tables and the BSR-1 lending rates by occupation =================== */
  {
    const R = dbieReport(db, "755");
    const rows = keep("755", R, R.rows.filter((x) => isDate(x["D Time D Date"])), ["D Time D Date", "Walr Type", "Walr Desc", "Walr Value", "Share Value"]);
    const D = [...new Set(rows.map((x) => month1(ymd(x["D Time D Date"]))))].sort();
    const TYPE = { 1: "by sector", 2: "by size of credit limit", 3: "by type of loan" };
    const S = {};
    for (const [t, desc] of [...new Set(rows.map((x) => `${x["Walr Type"]}|${x["Walr Desc"]}`))].map((k) => k.split("|"))) {
      const nice = desc.replace(/`/g, "₹").replace(/sec_TOTAL|cr_range_TOTAL/, "All loans").replace(/AGRCULTURE/, "Agriculture").replace(/^([A-Z ]+)$/, (m) => m[0] + m.slice(1).toLowerCase());
      const k = slugify(`${t} ${desc}`);
      S[k] = { name: `walr_${k}_pct`, label: `WALR on outstanding loans, ${TYPE[t] ?? "type " + t}: ${nice}`, color: /TOTAL|All accounts/.test(desc) ? C.accent : C.g2, data: D.map((d) => num(rows.find((x) => month1(ymd(x["D Time D Date"])) === d && x["Walr Type"] === t && x["Walr Desc"] === desc)?.["Walr Value"])), gapsNote: "Not printed for this year." };
      S[`${k}_share`] = { name: `share_${k}_pct`, label: `Share of outstanding credit, ${TYPE[t] ?? "type " + t}: ${nice}`, color: C.g3, data: D.map((d) => num(rows.find((x) => month1(ymd(x["D Time D Date"])) === d && x["Walr Type"] === t && x["Walr Desc"] === desc)?.["Share Value"])), gapsNote: "Not printed for this year." };
    }
    write("rates-walr-1992", { dates: D, frequency: "annual", vintage: retrieved(R), series: S,
      coverage: "The weighted average lending rate on banks' outstanding loans, as on 31 March each year 1992 to 2014, by sector, size of loan and type of loan (discontinued)",
      latestPeriod: D.at(-1).slice(0, 7),
      note: "RBI, Weighted Average Lending Rate (Discontinued) (DBIE report 755), from the annual BSR-1 return; as on 31 March (dated on the March). A separate ruler from the monthly WALR series that began in 2012: different coverage and method, never joined." });
  }
  {
    const R = dbieReport(db, "1205");
    const GRP = ["SBI", "Nationalised Bank", "Public Sector Bank", "New Private Bank", "Old Private Bank", "Private Sector Bank", "Foreign Bank", "Regional Rural Bank", "All Scheduled Comm. Banks", "Othr Schdld Bk"];
    const rows = keep("1205", R, R.rows, ["Year", "Category Code", "Category Desc", ...GRP]);
    const D = [...new Set(rows.map((x) => `${x.Year}-03-01`))].sort();
    const S = {};
    for (const code of [...new Set(rows.map((x) => x["Category Code"]))].sort((a, b) => +a - +b)) {
      const desc = rows.find((x) => x["Category Code"] === code)["Category Desc"].replace(/"/g, "").replace(/\s+/g, " ").trim();
      for (const g of GRP) {
        const data = D.map((d) => { const x = rows.find((r) => `${r.Year}-03-01` === d && r["Category Code"] === code); return x ? num(x[g]) : null; });
        if (!data.some((v) => v != null)) continue;
        const k = slugify(`${desc} ${g}`);
        S[k] = { name: `${k}_pct`, label: `${desc.replace(/^[IVX]+\.\s*|^\d\.\s*/, "")}, ${g.replace("All Scheduled Comm. Banks", "all scheduled commercial banks").replace("Othr Schdld Bk", "other scheduled banks").toLowerCase()}`, color: g === "All Scheduled Comm. Banks" ? C.accent : C.g2, data, gapsNote: "Not printed for this bank group that year." };
      }
    }
    write("rates-walr-groups-2005", { dates: D, frequency: "annual", vintage: retrieved(R), series: S,
      coverage: "Lending rates by occupation of the borrower and the weighted average deposit rate, for every bank group, as on 31 March 2005 to 2014 (discontinued)",
      latestPeriod: D.at(-1).slice(0, 7),
      note: "RBI, Bank Group-wise and Occupation-wise Weighted Average Lending Rate and Deposit Rate (Discontinued) (DBIE report 1205; also 735), from the BSR returns; as on 31 March. A separate ruler from the monthly WALR and WADTDR series." });
  }
  {
    const R = dbieReport(db, "949");
    const rows = keep("949", R, R.rows.filter((x) => isDate(x["Time Date"])), ["Time Date", "Key Description 1", "Credit Limit"]);
    const D = [...new Set(rows.map((x) => month1(ymd(x["Time Date"]))))].sort();
    const S = {};
    for (const desc of [...new Set(rows.map((x) => x["Key Description 1"]))]) {
      const nice = desc.replace(/^[IVX]+\.\s*|^\d\.\s*/, "").toLowerCase().replace(/^./, (c) => c.toUpperCase());
      S[slugify(desc.replace(/^[IVX]+\.\s*|^\d\.\s*/, ""))] = { name: `walr_${slugify(desc.replace(/^[IVX]+\.\s*|^\d\.\s*/, ""))}_pct`, label: `WALR on outstanding loans: ${nice}`, color: /TOTAL CREDIT$/.test(desc) ? C.accent : /Credit Cards/.test(desc) ? C.gold : C.g2,
        data: D.map((d) => num(rows.find((x) => month1(ymd(x["Time Date"])) === d && x["Key Description 1"] === desc)?.["Credit Limit"])), gapsNote: "Not printed for this quarter." };
    }
    write("rates-walr-occupation", { dates: D, frequency: "irregular", vintage: retrieved(R), series: S,
      coverage: "What banks charge on outstanding loans by the borrower's occupation, from farms and factories to home loans, vehicle loans, education loans and credit cards",
      latestPeriod: D.at(-1),
      note: "RBI, Quarterly BSR-1, Table 1.9 'Weighted average lending rate (WALR) of scheduled commercial banks according to occupation' (DBIE report 949). As at each reporting date (March, and later every quarter-end); dated on the first of that month. The BSR-1 return covers outstanding loans and is a different ruler from the monthly WALR release." });
  }

  /* =================== 18. open market operations and the market repo =================== */
  {
    const R = dbieReport(db, "1367");
    const rows = keep("1367", R, ACT(R).filter((x) => isDate(x["Time Date"])), ["Time Date", "Item Hierarchy Level1", "Item Hierarchy Level2", "Item Hierarchy Level3", "Item Value"]);
    const keyOf = (x) => slugify([x["Item Hierarchy Level1"], x["Item Hierarchy Level2"].replace(/\(.*?\)/g, "").replace(/\//g, " "), x["Item Hierarchy Level3"]].filter(Boolean).join(" "));
    const P = pivot(rows, (x) => month1(ymd(x["Time Date"])), keyOf, (x) => num(x["Item Value"]));
    const lab = new Map(rows.map((x) => [keyOf(x), `${x["Item Hierarchy Level1"]}: ${x["Item Hierarchy Level2"].toLowerCase()}${x["Item Hierarchy Level3"] ? " (" + (x["Item Hierarchy Level3"] === "SG" ? "state government securities" : x["Item Hierarchy Level3"].toLowerCase()) + ")" : ""}, ₹ crore`]));
    const D = monthAxis(P.dates[0].slice(0, 7), P.dates.at(-1).slice(0, 7));
    write("rates-omo", { dates: D, frequency: "monthly", unit: "inr_crore", vintage: retrieved(R),
      series: Object.fromEntries([...lab].map(([k, l]) => [k, { name: `omo_${k}_inr_crore`, label: `RBI open market operations, ${l}`, color: /net/.test(k) ? C.accent : C.g2, data: D.map((d) => r2(P.get(k, d) == null ? null : P.get(k, d) / CR)), gapsNote: "No operation of this kind printed that month." }])),
      coverage: "The RBI's outright purchases and sales of government securities each month since April 2016: dated bonds and Treasury bills, net",
      note: "RBI, Monthly Open Market Operations of Reserve Bank of India (DBIE report 1367; also 214). Converted from rupees to ₹ crore. Net purchase is positive (money put into the system), net sale negative." });
  }
  {
    const R = dbieReport(db, "267");
    const rows = keep("267", R, ACT(R).filter((x) => isDate(x.Date)), ["Date", "Level2 Desc", "Level3 Desc", "Level4 Desc", "N Amount"], true);
    const keyOf = (x) => slugify(`${x["Level3 Desc"]} ${x["Level4 Desc"]}`);
    const P = pivot(rows, (x) => ymd(x.Date), keyOf, (x) => num(x["N Amount"]));
    const lab = new Map(rows.map((x) => [keyOf(x), [x["Level2 Desc"], x["Level3 Desc"], x["Level4 Desc"]]]));
    write("rates-market-repo", { dates: P.dates, frequency: "weekly", vintage: retrieved(R),
      series: Object.fromEntries([...lab].sort().map(([k, [l2, l3, l4]]) => { const amt = /Amount/.test(l4); return [k, { name: `mrepo_${k}${amt ? "_inr_crore" : /Rate/.test(l4) ? "_pct" : "_days"}`, label: `Market repo in ${l2.toLowerCase()} (${l3}): ${l4.replace("Repo ", "").toLowerCase()}${amt ? ", ₹ crore" : /Period/.test(l4) ? ", days" : ""}`, color: /Rate/.test(l4) ? C.accent : C.g2,
        data: P.dates.map((d) => { const v = P.get(k, d); return v == null ? null : amt ? r2(v / CR) : v; }), gapsNote: "No repo deal in these securities that week." }]; })),
      coverage: "Repo deals between banks and other market players secured on government securities, week by week since April 1998: amounts, rate ranges and tenors, by kind of security",
      _fix: (S) => { for (const [k, s2] of Object.entries(S)) if (/period/.test(k)) impossible(s2, P.dates, (v) => v < 0, "a negative repo period in days"); else if (/rate/.test(k)) impossible(s2, P.dates, (v) => v < 0, "a negative repo rate"); },
      latestPeriod: P.dates.at(-1),
      note: "RBI, Secondary Market Repo Transactions in Government Securities (Face Value) (DBIE report 267; also 769). Amounts converted from rupees to ₹ crore. Excludes the RBI's own repo operations." });
  }

  /* =================== 19. real interest rates =================== */
  // Ex-post real rates: the nominal rate minus CPI inflation (year on year) for the same month.
  // CPI is read from the CPI guide's bundles, never refetched. Two CPI rulers, two bundles:
  //   rates-real: CPI 2024=100, the NSO's own back-cast (2014 to 2024) linked to live data from
  //     2025 (bundle cpi-2024-linked, an agency bridge registered in sources.yml seams);
  //   rates-real-cpi2012: CPI 2012=100 as published at the time (2016 to December 2025).
  {
    const L = (s) => JSON.parse(fs.readFileSync(path.join(root, "data/series", s + ".json"), "utf8"));
    const mon = L("rates-monthly"), lend = L("rates-lending"), curve = L("rates-gsec-curve"), callm = L("rates-call-monthly");
    const at = (b, k, d) => { const i = b.dates.indexOf(d); return i < 0 ? null : b.series[k].data[i]; };
    for (const [slug, cpiSlug, base, cov] of [["rates-real", "cpi-2024-linked", "CPI 2024=100", "Real interest rates (nominal rate minus CPI inflation), monthly, on the CPI 2024=100 headline (the NSO's back-cast to 2014, live from 2025)"],
      ["rates-real-cpi2012", "cpi", "CPI 2012=100", "Real interest rates (nominal rate minus CPI inflation), monthly, on the retired CPI 2012=100 headline as published, January 2016 to December 2025"]]) {
      const cpi = L(cpiSlug); const D = cpi.dates.filter((d, i) => cpi.series.headline.data[i] != null);
      const infl = (d) => at(cpi, "headline", d);
      const real = (v, d) => (v == null || infl(d) == null ? null : r2(v - infl(d)));
      const S = {
        cpi: { name: "cpi_headline_yoy_pct", label: `CPI inflation, year on year (${base}), as published in the CPI guide`, color: C.g1, data: D.map((d) => infl(d)) },
        repo: { name: "real_repo_pct", label: "Real policy repo rate: month-end repo minus CPI inflation", color: C.accent, data: D.map((d) => real(at(mon, "repo", d), d)) },
        call: { name: "real_call_pct", label: "Real call money rate: monthly average call rate minus CPI inflation", color: C.g2, data: D.map((d) => real(at(callm, "average", d), d)) },
        gsec_10y: { name: "real_gsec_10y_pct", label: "Real 10-year government bond yield: month-end yield minus CPI inflation", color: C.g1, data: D.map((d) => real(at(curve, "y10", d), d)) },
        fd_fresh: { name: "real_wadtdr_fresh_pct", label: "Real rate on new fixed deposits: WADTDR on fresh deposits minus CPI inflation", color: C.gold, data: D.map((d) => real(at(lend, "wadtdr_fresh_all", d), d)) },
        fd_outstanding: { name: "real_wadtdr_outstanding_pct", label: "Real rate on all fixed deposits: WADTDR on outstanding deposits minus CPI inflation", color: C.gold, data: D.map((d) => real(at(lend, "wadtdr_outstanding_all", d), d)) },
        loan_fresh: { name: "real_walr_fresh_pct", label: "Real rate on new loans: WALR on fresh loans minus CPI inflation", color: C.g2, data: D.map((d) => real(at(lend, "walr_fresh_all", d), d)) },
      };
      for (const s2 of Object.values(S)) s2.gapsNote = "One of the two inputs is not published for this month.";
      const backcast = cpiSlug === "cpi-2024-linked" ? D.filter((d) => d < "2025-01-01") : [];
      write(slug, { dates: D, frequency: "monthly", base, vintage: [cpi.meta.vintage, lend.meta.vintage, mon.meta.vintage].sort().at(-1), series: S, coverage: cov,
        note: `Derived: each nominal rate minus CPI headline inflation (year on year) for the same month, from the bundles ${cpiSlug}, rates-monthly, rates-call-monthly, rates-gsec-curve and rates-lending. These are ex-post real rates: they subtract the inflation that happened, not the inflation savers expected, which nobody publishes monthly. ${backcast.length ? `CPI before January 2025 is the NSO's back-cast of the 2024 index (a reconstruction published by the NSO), so the real rates for ${backcast[0].slice(0, 7)} to ${backcast.at(-1).slice(0, 7)} rest on it.` : "The 2012 base was retired after December 2025."}`,
        extra: { cpiBundle: cpiSlug, backcastTo: backcast.at(-1) ?? null } });
    }
  }

  /* =================== archive the parsed inputs =================== */
  const compact = (Q) => ({ provenance: Q.provenance, columns: Q.rows.length ? Object.keys(Q.rows[0]) : [], rows: Q.rows.map((r) => Object.values(r)) });
  rawStamp("data/raw/rates-policy-mpc.json", { note: "Data Bank parsed datasets rbi_policy_rates, rbi_mpc_meetings, rbi_mpc_votes (newest parse run), plus the member roles from DBIE report 1491.", policy: compact(RAW.policy), meetings: compact(RAW.mpc.meetings), votes: compact(RAW.mpc.votes), roles1491: RAW.mpc.roles1491 });
  for (const [id, body] of Object.entries(WR)) rawStamp(`data/raw/rates-dbie/report-${id}.json`, { note: `RBI DBIE report ${id}, read from the Data Bank's webi mirror: the rows and columns this adapter reads (ACTUALS display unit only, where the report repeats values per unit).`, ...body });
  rawStamp("data/raw/rates-auctions.json", { note: "Data Bank parsed auction datasets (newest parse run), used for the cross-checks and the state cut.", tbill: compact(RAW.tbill), ...(RAW.sdl ? { sdl: compact(RAW.sdl) } : {}), ...(RAW.gsec ? { gsec: compact(RAW.gsec) } : {}) });
  rawStamp("data/raw/rates-lending.json", { note: "Data Bank parsed dataset rbi_lending_deposit_rates (newest parse run): every table, bank group, item, statistic and month.", lending: compact(RAW.lending) });

  console.log(`rbirates: ${written.length} bundles: ${written.join(", ")}`);
}

/* =================== the coverage catalogue (docs/CONTRACT-coverage.md) ===================
 * `node scripts/lib/products/rbirates.mjs --catalogue` enumerates everything the rates family's
 * sources publish, at every granularity, into data/coverage/rates.catalogue.json:
 *   - the Data Bank's parsed `rbi` datasets: every policy rate, every MPC meeting field and
 *     member, every table x bank group x item x statistic of the lending-rate release, every
 *     auction measure by instrument, tenor, security type and state;
 *   - every DBIE report the rates family owns, chosen BY RULE from the Data Bank's webi
 *     inventory (data/derived/rbi_dbie_webi_inventory.csv), never by a typed list: reports on the
 *     Key Rates, Money Market and Daily LAF menus, and any report whose name is about interest
 *     rates, policy rates, call money, MIBOR, repo/LAF, liquidity operations, market borrowing,
 *     T-bills, dated securities' yields, CDs, CP or open market operations. Stocks and market
 *     structure (ownership, outstanding amounts, maturity patterns, turnover, secondary-market
 *     volumes), exchange rates, external debt, money aggregates and other families' growth rates
 *     are left to their own families by the same rule. For each report, every data provider with
 *     rows is read and every combination of its descriptive columns (crossed with each value
 *     column that carries data) is one item. State government loans are also cut by state, read
 *     from the loan's name with the adapter's alias table.
 */
const RATE_NAME = /(interest rates?|policy rates?|key rates|ratios and rates|lending rate|deposit rate|call\/notice|call money|mibor|libor|\brepo\b|liquidity operations|\blaf\b|market borrowings?|commercial paper|certificates? of deposit|open market operations|money market|\bmpc\b|treasury bills|dated securit|yield of sgl|government securities)/i;
const OUT_NAME = /(ownership|outstanding|exchange rate|forex|reer|neer|external debt|maturity pattern|turnover|secondary market (outright )?transactions|small savings|liquidity aggregates|growth rates|wage rates|per hectare|foodgrains|crops|investments)/i;
const RATE_MENUS = new Set(["Key Rates", "Money Market", "Daily LAF Operation"]);
const SKIP_COL = /(unit|display|order|sort|\bsk\b|_sk\b|sk$|flag|prompt|created|effective|char\b|hindi|special character|active)/i;

function parseCsvLine(line) {
  const out = []; let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur); return out;
}

export async function catalogueRbiRates(root, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const items = [], seen = new Set();
  const add = (id, label, dims) => { id = id.toLowerCase(); if (seen.has(id)) return; seen.add(id); items.push({ id, label, dims }); };
  const sl = (s) => slugify(s) || "blank";

  /* ---- A. parsed datasets ---- */
  const polRows = parsed(db, "rbi_policy_rates", "rate_code, rate_name, effective_date", "rate_code, effective_date", "rate_code").rows;
  const pol = [...new Set(polRows.map((r) => r.rate_code))].map((k) => { const xs = polRows.filter((r) => r.rate_code === k); return { rate_code: k, rate_name: xs[0].rate_name, first: xs[0].effective_date, last: xs.at(-1).effective_date }; });
  for (const r of pol) add(`parsed:policy:${r.rate_code}`, `${r.rate_name}: every change, ${r.first} to ${r.last}`, { dataset: "rbi_policy_rates", rate: r.rate_code });
  const meetCols = ["decision", "repo_rate_before_pct", "repo_rate_pct", "repo_change_bps", "sdf_rate_pct", "msf_rate_pct", "bank_rate_pct", "reverse_repo_rate_pct", "stance", "stance_changed", "stance_text", "members_voting", "votes_for", "votes_against", "unanimous", "dissenters", "vote_resolution_text", "chair", "meeting_dates_text", "minutes_release_date"];
  for (const c of meetCols) add(`parsed:mpc:meeting:${c}`, `MPC meetings: ${c.replace(/_/g, " ")}, every meeting since October 2016`, { dataset: "rbi_mpc_meetings", field: c });
  const members = parsed(db, "rbi_mpc_votes", "DISTINCT member_name", "member_name", "member_name").rows;
  for (const m of members) add(`parsed:mpc:vote:${sl(m.member_name)}`, `MPC votes: ${m.member_name}, every meeting as a member`, { dataset: "rbi_mpc_votes", member: m.member_name });
  add("parsed:mpc:vote:preferred_change_bps", "MPC votes: the size of cut a member preferred, where the minutes' table records it", { dataset: "rbi_mpc_votes", field: "preferred_change_bps" });
  const lr = parsed(db, "rbi_lending_deposit_rates", "DISTINCT table_key, bank_group, item, stat", "table_key, bank_group, item, stat", "table_key, bank_group, item, stat").rows;
  for (const r of lr) add(`parsed:lending:${r.table_key}:${r.bank_group}:${sl(r.item)}:${r.stat}`, `Lending and deposit rates release: ${r.table_key.replace(/_/g, " ")}, ${r.bank_group.replace(/_/g, " ")}, ${r.item}, ${r.stat}`, { dataset: "rbi_lending_deposit_rates", table: r.table_key, group: r.bank_group, item: r.item, stat: r.stat });
  const NUMCOLS = (ds) => {
    const f = newestParse(db, ds).replace(/'/g, "''");
    return databankQuery(db, ds, `SELECT column_name, column_type FROM (DESCRIBE SELECT * FROM read_parquet('${f}')) ORDER BY 1`).rows
      .filter((c) => /DOUBLE|BIGINT|INTEGER|BOOLEAN/.test(c.column_type) && !/^(prid|maturity_year|tenor_days|tenor_years)$/.test(c.column_name)).map((c) => c.column_name);
  };
  for (const r of parsed(db, "rbi_tbill_auctions", "DISTINCT instrument, tenor_days", "instrument, tenor_days", "instrument, tenor_days").rows)
    for (const c of NUMCOLS("rbi_tbill_auctions")) add(`parsed:tbill:${r.instrument}:${r.tenor_days}:${c}`, `${r.instrument === "cmb" ? "Cash management bill" : "Treasury bill"}, ${r.tenor_days} days: ${c.replace(/_/g, " ")}`, { dataset: "rbi_tbill_auctions", instrument: r.instrument, tenor: r.tenor_days, measure: c });
  for (const r of parsed(db, "rbi_gsec_auctions", "DISTINCT security_type", "security_type", "security_type").rows)
    for (const c of NUMCOLS("rbi_gsec_auctions")) add(`parsed:gsec:${sl(r.security_type)}:${c}`, `Central government securities (${r.security_type}): ${c.replace(/_/g, " ")}`, { dataset: "rbi_gsec_auctions", type: r.security_type, measure: c });
  for (const r of parsed(db, "rbi_sdl_auctions", "DISTINCT state", "state", "state").rows)
    for (const c of NUMCOLS("rbi_sdl_auctions")) add(`parsed:sdl:${sl(r.state)}:${c}`, `State government securities, ${r.state}: ${c.replace(/_/g, " ")}`, { dataset: "rbi_sdl_auctions", state: r.state, measure: c });

  /* ---- B. DBIE reports, chosen by rule ---- */
  const inv = fs.readFileSync(path.join(db, "data/derived/rbi_dbie_webi_inventory.csv"), "utf8").split(/\r?\n/).filter(Boolean);
  const H = parseCsvLine(inv[0]);
  const reports = inv.slice(1).map((l) => Object.fromEntries(parseCsvLine(l).map((v, i) => [H[i], v])))
    .filter((x) => !OUT_NAME.test(x.report_name) && (RATE_MENUS.has(x.menu) || RATE_NAME.test(x.report_name)));
  webiProvider(db, "1", "DP0");                                      // builds the provider index
  const STATE_OF_LOAN = (nom) => stateNameOf(String(nom).replace(/^\s*[\d.]+\s*%?\s*/, "").replace(/^NI\s+/i, "").replace(/\b(SDL|SGS|GS|STATE DEVELOPMENT LOAN|UDAY BOND)\b.*$/i, "").replace(/\s*\d{4}.*$/, ""));
  const isNum = (v) => v !== "" && Number.isFinite(Number(String(v).replace(/,/g, "")));
  const isDateLike = (v) => /^\d{4}([\/-]\d{2}([\/-]\d{2})?|:\d{2})|^\d{4}-\d{2}$|^\d{4}$/.test(v) || /^\d{4}-\d{2}(\s|$)/.test(v);
  for (const rep of reports) {
    const id = rep.report_id;
    const base = { report: id, menu: rep.menu, report_name: rep.report_name, frequency: rep.frequency };
    if (rep.last_status !== "raw_validated") { add(`dbie:${id}:report`, `${rep.report_name} (DBIE report ${id}): not mirrored (${rep.last_status}${rep.last_message ? ": " + rep.last_message : ""})`, { ...base, status: rep.last_status }); continue; }
    const provs = [...WEBI_INDEX.keys()].filter((k) => k.startsWith(id + "|")).map((k) => k.split("|")[1]).sort();
    let any = false;
    for (const dp of provs) {
      const R = webiProvider(db, id, dp);
      if (R.rows.length < 30) continue;                              // prompt and unit-picker providers
      const rows = R.rows.filter((x) => !("Unit Description" in x) || x["Unit Description"] === "ACTUALS" || !R.rows.some((y) => y["Unit Description"] === "ACTUALS"));
      const cols = R.header;
      const stats = cols.map((c) => { const vals = rows.map((x) => x[c]).filter((v) => v !== "" && v !== "NULL"); const distinct = new Set(vals);
        return { c, distinct: distinct.size, num: vals.length ? vals.filter(isNum).length / vals.length : 0, date: vals.length ? vals.filter(isDateLike).length / vals.length : 0, n: vals.length }; });
      // a value column holds the numbers; codes, keys, texts and previous-period copies are not values
      const NOT_VALUE = /code|text|_none|prev_|^prev|\bsk\b|sk$/i;
      // time is the axis, never a cut; maturity and tenor columns are cuts even when numeric
      const TIME = /(^|\s|_)(month|year|date|fortnight|week|quarter|time|fiscal|period)(\s|_|$)|date sk|calendar|prompts/i;
      const CUT_NUM = /maturity|tenor|tenure|term|days|years/i;
      const valueCols = stats.filter((s) => s.num >= 0.8 && s.distinct > 12 && !SKIP_COL.test(s.c) && !NOT_VALUE.test(s.c) && !TIME.test(s.c) && !(CUT_NUM.test(s.c) && s.distinct <= 40) && s.date < 0.5).map((s) => s.c);
      const dimCols = stats.filter((s) => s.distinct > 1 && s.distinct <= 150 && !SKIP_COL.test(s.c) && !TIME.test(s.c) && !/value/i.test(s.c) && s.date < 0.5 && !valueCols.includes(s.c)
        && (s.num < 0.8 || (CUT_NUM.test(s.c) && s.distinct <= 40)) && !/code/i.test(s.c)).map((s) => s.c);
      const stateCol = cols.find((c) => /nomenclature/i.test(c));
      const combos = new Map();
      for (const x of rows) {
        const parts = dimCols.map((c) => (x[c] || "").trim()).filter((v) => v && v !== "NULL");
        if (stateCol) { const st = STATE_OF_LOAN(x[stateCol]); parts.push(st ? `state ${st}` : "state unread"); }
        const key = parts.join(" | ") || "all";
        const e = combos.get(key) ?? combos.set(key, new Set()).get(key);
        for (const v of valueCols) if (x[v] !== "" && x[v] != null) e.add(v);
      }
      for (const [key, vcs] of combos) {
        const vlist = valueCols.length > 1 ? [...vcs] : [null];
        for (const v of vlist) {
          add(`dbie:${id}:${dp}:${sl(key)}${v ? ":" + sl(v) : ""}`, `${rep.report_name} (report ${id}): ${key}${v ? ", " + v : ""}`, { ...base, provider: dp, cut: key, ...(v ? { value: v } : {}) });
          any = true;
        }
      }
    }
    if (!any) add(`dbie:${id}:report`, `${rep.report_name} (DBIE report ${id}): mirrored but no data rows`, { ...base, status: "empty" });
  }

  const out = { family: "rates", source: "Reserve Bank of India: the Data Bank's parsed rbi datasets (policy rates, MPC, lending and deposit rates, auctions) and its DBIE webi mirror",
    generator: "scripts/lib/products/rbirates.mjs --catalogue", generated_at: new Date().toISOString().slice(0, 10),
    rule: { menus: [...RATE_MENUS], name: RATE_NAME.source, out: OUT_NAME.source }, reports: reports.map((r) => r.report_id), items };
  fs.mkdirSync(path.join(root, "data/coverage"), { recursive: true });
  fs.writeFileSync(path.join(root, "data/coverage/rates.catalogue.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(`rates catalogue: ${items.length} items from ${reports.length} DBIE reports and 7 parsed datasets`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) && process.argv.includes("--catalogue")) {
  const YAML = (await import("yaml")).default;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const cfg = YAML.parse(fs.readFileSync(path.join(root, "data/sources.yml"), "utf8"));
  await catalogueRbiRates(root, cfg);
}
