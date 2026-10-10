// scripts/lib/products/profiles-mospi.mjs: step 5 of the state profiles (docs/briefs/state-profiles.md),
// the MoSPI products the profiles still lack: UDISE+ (schools), the Time Use Survey, EnvStats, and
// NSS rounds 75 to 80. Written while MoSPI was fenced for the audit refresh (lb/audit-refresh), so it
// can run unattended the moment the coordinator releases it.
//
//   node scripts/lib/products/profiles-mospi.mjs --plan            # no network: print the plan
//   PROFILES_MOSPI_GO=1 node ... --phase list                       # A: indicator and survey lists
//   PROFILES_MOSPI_GO=1 node ... --phase meta                       # B: filters and page 1 of each indicator
//   PROFILES_MOSPI_GO=1 node ... --phase fetch [--skip tus]         # C: every page of every indicator
//   node ... --status                                               # what is done, what is left
//
// Every call goes through scripts/lib/mospi.mjs (one request at a time, spaced, backoff on 429 and
// 5xx, a response cache in data/raw/http-cache), so a run killed half way resumes where it stopped.
// Progress and the expected row counts (each indicator's meta_data.totalRecords from page 1, phase B)
// are kept in data/raw/profiles-mospi-plan.json; phase C checks the rows it collects against them
// (mospiAll fails a short read). Raw dumps, one per indicator, go to data/raw/profiles-mospi/. Bundles
// are baked afterwards, product by product, once the shapes are seen.
//
// The Economic Census is not here: the eSankhyiki SPA serves it at macroindicators?product=ec4|5|6,
// a page route, and no record endpoint is known (docs/reference/esankhyiki-api.md). It needs one
// discovery step by hand once MoSPI is released; it stays `blocked` in the ledger until then.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const PLAN_FILE = path.join(ROOT, "data/raw/profiles-mospi-plan.json");

// The endpoints, as the eSankhyiki SPA calls them (docs/reference/esankhyiki-api.md). Where a
// product's parameter names are not recorded there, phase A's listing response names them; the
// `param` below is the documented one, and phase B stops on an HTTP 4xx instead of guessing.
export const PRODUCTS = [
  { id: "udise", list: ["udise/getIndicatorList", {}], filter: ["udise/getUdiseFilterByIndicatorId", "indicator_code"], records: "udise/getUdiseRecords", why: "schools: enrolment, teachers, pupils per teacher, GER and NER, infrastructure, by state, 2018-19 to 2024-25" },
  { id: "tus", list: ["tus/getTusIndicatorList", { viz_status: 1 }], filter: ["tus/getTusFilterByIndicatorId", "indicator_code"], records: "tus/getTusRecords", why: "time use 2019 and 2024: unpaid care and paid work by gender, by state" },
  { id: "env", list: ["env/getEnvStatsIndicatorList", { viz_status: 1 }], filter: ["env/getEnvStatsFilterByIndicatorId", "indicator_code"], records: "env/getEnvStatsRecords", why: "forests, land use, water, air quality, minerals; most indicators state-wise" },
  { id: "nss75", surveys: ["nss-75/getSurveyList", {}], list: ["nss-75/getIndicatorList", { survey_code: "{survey}" }], filter: ["nss-75/getNss75FilterByIndicatorId", "indicator_code"], records: "nss-75/getNss75Records", why: "social consumption, round 75 (2017-18): two surveys, health (1) and education (2)" },
  // NSS 76 has no survey list endpoint on record; its two surveys answer to codes 1 (disability)
  // and 2 (drinking water, sanitation, hygiene and housing), as its own listings label them (2026-10-10)
  { id: "nss76", surveys: [null, [1, 2]], list: ["nss-76/getIndicatorList", { survey_code: "{survey}" }], filter: ["nss-76/getNss76FilterByIndicatorId", "indicator_code"], records: "nss-76/getNss76Records", why: "drinking water, sanitation, hygiene and housing; persons with disabilities (2018)" },
  { id: "nss77", list: ["nss-77/getIndicatorList", { viz_status: 1 }], filter: ["nss-77/getFilterByIndicatorId", "indicator_code"], records: "nss-77/getNss77Records", why: "agricultural households: income, debt, land (2019)" },
  { id: "nss77aidis", surveys: ["nss-77/getNss77AidisSurveyList", {}], list: ["nss-77/getNss77AidisIndicatorList", { survey_code: "{survey}" }], filter: ["nss-77/getNss77AidisFiltersByIndicatorCode", "indicator_code"], records: "nss-77/getNss77AidisRecords", why: "household debt and assets (AIDIS 2019)" },
  { id: "nss78", list: ["nss-78/getIndicatorList", { viz_status: 1 }], filter: ["nss-78/getFilterByIndicatorId", "indicator_code"], records: "nss-78/getNss78Records", why: "living conditions, digital skills, migration (2020-21)" },
  { id: "nss79", surveys: ["nss-79/getNSS79SurveyList", {}], list: ["nss-79/getnss79IndicatorList", { survey_code: "{survey}" }], filter: ["nss-79/getNSS79FilterByIndicatorId", "indicator_code"], records: "nss-79/getNSS79Records", why: "AYUSH and the comprehensive annual modular survey: health spending, finance, digital (2022-23)" },
  { id: "nss80", surveys: ["nss-80/getSurvey", {}], list: ["nss-80/getIndicatorList", { survey: "{survey}" }], filter: ["nss-80/getFilterBySurveryAndIndicator", "indicator_id"], records: "nss-80/getNss80Records", why: "telecom use and education spending (2025)" },
];

const readPlan = () => (fs.existsSync(PLAN_FILE) ? JSON.parse(fs.readFileSync(PLAN_FILE, "utf8")) : { written: null, products: {} });
const savePlan = (p) => { p.written = new Date().toISOString(); fs.writeFileSync(PLAN_FILE + ".tmp", JSON.stringify(p, null, 1)); fs.renameSync(PLAN_FILE + ".tmp", PLAN_FILE); };
// listings come in several shapes: { data: [...] }, { data: { indicator: [...] } }, { indicator: [...] } (NSS 78)
const rowsOf = (res) => { const d = res?.data; return Array.isArray(d) ? d : d?.indicator ?? d?.indicators ?? d?.surveys ?? res?.indicator ?? res?.indicators ?? []; };
const codeOf = (x) => x.indicator_code ?? x.indicator_id ?? x.id ?? x.code;
const surveyOf = (x) => x.survey_code ?? x.survey_id ?? x.code ?? x.id;

async function phaseList(mospi, plan) {
  for (const P of PRODUCTS) {
    const st = (plan.products[P.id] ??= { why: P.why });
    if (st.indicators?.length) continue;
    try { await listOne(mospi, P, st); } catch (e) { st.error = `${e.message.slice(0, 160)} (${new Date().toISOString().slice(0, 10)})`; console.log(`A ${P.id}: failed, ${st.error}`); }
    savePlan(plan);
  }
}
async function listOne(mospi, P, st) {
  {
    delete st.error;
    const surveys = !P.surveys ? [null] : P.surveys[0] === null ? P.surveys[1] : rowsOf(await mospi(...P.surveys)).map(surveyOf).filter((x) => x != null);
    st.surveys = P.surveys ? surveys : undefined;
    const inds = [];
    for (const s of surveys) {
      const params = Object.fromEntries(Object.entries(P.list[1]).map(([k, v]) => [k, v === "{survey}" ? s : v]));
      for (const x of rowsOf(await mospi(P.list[0], params))) inds.push({ code: codeOf(x), survey: s, label: x.description ?? x.indicator_name ?? x.label ?? x.name ?? null });
    }
    st.indicators = inds.map((x) => ({ ...x, filters: null, expected: null, done: false }));
    console.log(`A ${P.id}: ${inds.length} indicators`);
  }
}
async function phaseMeta(mospi, plan) {
  for (const P of PRODUCTS) for (const ind of plan.products[P.id]?.indicators ?? []) {
    if (ind.expected != null || ind.error) continue;
    const base = { [P.filter[1]]: ind.code, ...(ind.survey != null ? { survey_code: ind.survey } : {}) };
    try {
      const f = (await mospi(P.filter[0], base)).data ?? {};
      ind.filters = Object.fromEntries(Object.entries(Array.isArray(f) ? f[0] ?? {} : f).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
      ind.hasState = Object.keys(ind.filters).some((k) => /state/i.test(k));
      const p1 = await mospi(P.records, { indicator_code: ind.code, ...(ind.survey != null ? { survey_code: ind.survey } : {}), page: 1, limit: 100 });
      ind.expected = Number(p1.meta_data?.totalRecords ?? rowsOf(p1).length);
      const r1 = rowsOf(p1);
      ind.bytesPerRow = r1.length ? Math.round(JSON.stringify(r1).length / r1.length) : null;
    } catch (e) { ind.error = `${e.message.slice(0, 160)} (${new Date().toISOString().slice(0, 10)})`; }
    savePlan(plan);
  }
  for (const P of PRODUCTS) { const I = plan.products[P.id]?.indicators ?? []; const mb = I.reduce((a, x) => a + (x.expected ?? 0) * (x.bytesPerRow ?? 0), 0) / 1e6; console.log(`B ${P.id}: about ${mb.toFixed(1)} MB of rows, ${I.filter((x) => x.expected != null).length}/${I.length} indicators sized, ${I.reduce((a, x) => a + (x.expected ?? 0), 0)} rows expected, ${I.filter((x) => x.hasState).length} with a state dimension`); }
}
async function phaseFetch(mospiAll, plan) {
  const { writeRaw, rawExists } = await import("../util.mjs");
  // --skip a,b leaves products out of this run (Time Use is national only on this API)
  const skip = new Set(argv.includes("--skip") ? argv[argv.indexOf("--skip") + 1].split(",") : []);
  for (const P of PRODUCTS) {
    if (skip.has(P.id)) { console.log(`C ${P.id}: skipped`); continue; }
    const st = plan.products[P.id];
    if (!st?.indicators) continue;
    // one dump per indicator, written as soon as it is read: memory stays at one indicator, a run
    // stopped part way keeps everything it finished, and no file nears the 25 MB git line
    let wrote = 0;
    for (const ind of st.indicators) {
      if (ind.error || ind.expected == null) continue;
      const rel = `data/raw/profiles-mospi/${P.id}-${ind.survey ?? 0}-${ind.code}.json`;
      if (ind.archived && rawExists(ROOT, rel)) continue;
      // the disk is shared by several sessions: under 2 GB free, wait for space to come back
      for (let waited = 0; (freeBytes() ?? Infinity) < 2e9; waited++) {
        if (waited % 10 === 0) console.log(`C: paused at ${P.id} ${ind.code}, ${(freeBytes() / 1e9).toFixed(2)} GB free (under 2 GB); waiting for space`);
        await new Promise((r) => setTimeout(r, 60_000));
      }
      let rows;
      try {
        rows = await mospiAll(P.records, { indicator_code: ind.code, ...(ind.survey != null ? { survey_code: ind.survey } : {}) });
        if (rows.length !== ind.expected) throw new Error(`${rows.length} rows, page 1 reported ${ind.expected}`);
      } catch (e) {
        // one indicator the server cannot page stably must not stop the others: record it and go on
        if (/HTTP 429/.test(e.message)) throw e;
        ind.fetchError = `${e.message.replace(/https?:\S+/, "").slice(0, 200)} (${new Date().toISOString().slice(0, 10)})`;
        console.log(`C ${P.id} ${ind.code}: not archived, ${ind.fetchError}`);
        savePlan(plan);
        continue;
      }
      delete ind.fetchError;
      fs.mkdirSync(path.join(ROOT, "data/raw/profiles-mospi"), { recursive: true });
      writeRaw(ROOT, rel, { vintage: new Date().toISOString().slice(0, 10), note: `MoSPI eSankhyiki ${P.records}, indicator ${ind.code}${ind.survey != null ? `, survey ${ind.survey}` : ""}: every row (profiles step 5)`, product: P.id, indicator: ind, rows });
      ind.done = true; ind.archived = true; wrote++;
      savePlan(plan);
    }
    console.log(`C ${P.id}: ${wrote} indicators archived this run, ${st.indicators.filter((x) => x.archived).length} of ${st.indicators.length} in all`);
    // disk is shared and short: once every indicator is written, drop this product's cached pages
    if (st.indicators.every((x) => x.archived || x.error || x.fetchError || x.expected == null)) console.log(`C ${P.id}: ${trimCache(P.records)} cached pages removed`);
  }
}

/* ---------- phase C2: retry, split by state ----------
 * An indicator the server cannot page stably in one query (rows differ between two full reads)
 * is read again one state at a time: each state's query is small, and each must return only that
 * state's rows (else the parameter is ignored and the split is abandoned). The pieces must add up
 * to the total page 1 reported. */
async function phaseRetry(mospi, mospiAll, plan) {
  const { writeRaw } = await import("../util.mjs");
  for (const P of PRODUCTS) for (const ind of plan.products[P.id]?.indicators ?? []) {
    if (!ind.fetchError || ind.archived) continue;
    const base = { [P.filter[1]]: ind.code, ...(ind.survey != null ? { survey_code: ind.survey } : {}) };
    const f = (await mospi(P.filter[0], base)).data ?? {};
    const states = (Array.isArray(f) ? f[0] ?? {} : f).state ?? [];
    if (!states.length) { console.log(`C2 ${P.id} ${ind.code}: no state list to split by`); continue; }
    const rows = [];
    let ok = true;
    for (const st of states) {
      const code = st.id ?? st.state_code ?? st.code;
      let part;
      try { part = await mospiAll(P.records, { indicator_code: ind.code, ...(ind.survey != null ? { survey_code: ind.survey } : {}), state_code: code }); }
      catch (e) { console.log(`C2 ${P.id} ${ind.code} state ${code}: ${e.message.slice(0, 120)}`); ok = false; break; }
      const label = String(st.label ?? st.state_name ?? st.description ?? "").trim();
      if (part.some((r) => String(r.state ?? "").trim() !== label)) { console.log(`C2 ${P.id} ${ind.code}: state_code ${code} returned other states' rows; the split does not work here`); ok = false; break; }
      rows.push(...part);
    }
    if (ok && rows.length !== ind.expected) { console.log(`C2 ${P.id} ${ind.code}: ${rows.length} rows by state, page 1 reported ${ind.expected}`); ok = false; }
    if (!ok) { ind.fetchError += "; the split by state did not recover it"; savePlan(plan); continue; }
    writeRaw(ROOT, `data/raw/profiles-mospi/${P.id}-${ind.survey ?? 0}-${ind.code}.json`, { vintage: new Date().toISOString().slice(0, 10), note: `MoSPI eSankhyiki ${P.records}, indicator ${ind.code}${ind.survey != null ? `, survey ${ind.survey}` : ""}: every row, read one state at a time because one query paged unstably (profiles step 5)`, product: P.id, indicator: ind, rows });
    ind.archived = true; ind.done = true; ind.recovered = "by state"; delete ind.fetchError;
    console.log(`C2 ${P.id} ${ind.code}: recovered by state, ${rows.length} rows`);
    savePlan(plan);
  }
}

/* ---------- phase D: bake (offline, from the archived dumps) ----------
 * One bundle per indicator: data/series/profiles-mospi-<product>-<survey>-<code>.json. Rows are
 * placed through the state key (a label it cannot place fails the bake). The standard cuts (sector,
 * gender, management, social group, age, class, month, season) are kept at their headline value
 * ("Total", "All", "Rural + Urban", "All Management", "Annual") where the source publishes one;
 * a cut with no headline value, and every category dimension (a level of education, a facility,
 * an activity), stays in the series key. The full grain stays in the raw dumps. Dates: the row's
 * own year (a financial year "2022-23" at April, a calendar year at January), else the round. */
const STD = ["sector", "gender", "type_of_management", "management", "social_group", "age_group", "class_taught", "month", "period", "religion", "household_type", "sex"];
const HEAD = /^(total|all|all india|rural \+ urban|rural\+urban|combined|person|persons|all management|all persons|both|annual|all ages|all social groups|all categories|all religions)$/i;
const ROUND = { nss75: ["2017-07-01", "NSS 75, 2017-18"], nss76: ["2018-07-01", "NSS 76, July to December 2018"], nss77: ["2019-01-01", "NSS 77, 2019"], nss77aidis: ["2019-01-01", "NSS 77 (AIDIS), 2019"], nss78: ["2020-01-01", "NSS 78, 2020-21"], nss79: ["2022-07-01", "NSS 79, 2022-23"] };
const SKIPKEYS = new Set(["value", "indicator", "state", "unit", "year", "zone", "survey", "survey_code", "indicator_code"]);
const dateOf = (P, row) => {
  const y = String(row.year ?? "").trim();
  if (/^\d{4}-\d{2,4}$/.test(y)) return `${y.slice(0, 4)}-04-01`;
  if (/^\d{4}$/.test(y)) return `${y}-01-01`;
  return ROUND[P.id]?.[0] ?? null;
};
const num = (v) => { if (v == null) return null; const t = String(v).replace(/,/g, "").trim(); if (t === "" || t === "-" || /^n\.?a\.?$/i.test(t) || t === "*") return null; const n = Number(t); return Number.isFinite(n) ? n : null; };
import crypto from "node:crypto";
// a key part from a label: long labels keep 40 characters and a hash of the whole, so two labels
// that share their first words never collide
const keyPart = (t) => {
  const k = String(t).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x";
  return k.length <= 48 ? k : `${k.slice(0, 40)}_${crypto.createHash("sha1").update(k).digest("hex").slice(0, 6)}`;
};
function unitOf(label, rowUnit) {
  const u = String(rowUnit ?? "").trim();
  if (/^%$/.test(u)) return "percent";
  if (/^(no\.?|number)$/i.test(u)) return "count";
  if (/rs\.? ?crore/i.test(u)) return "inr_crore";
  if (/°c/i.test(u)) return "degc";
  if (/^mm$/i.test(u)) return "mm";
  if (/sq\.? ?km/i.test(u)) return "sq_km";
  if (/hectare/i.test(u)) return "hectares";
  const t = String(label);
  // units named inside the label or sub-indicator ("(in metric tonnes)", "Area (Sq. Km)", "(MU)")
  if (/\(\s*(in )?%\s*\)|in percent|\(percent\)|% of /i.test(t)) return "percent";
  if (/sq\.? ?km|km²|km2\b/i.test(t)) return "sq_km";
  if (/\(\s*(in )?(metric )?tonnes?\s*\)/i.test(t)) return "tonnes";
  if (/\(\s*(in )?hectares?\s*\)/i.test(t)) return "hectares";
  if (/\(\s*(in )?mm\s*\)/i.test(t)) return "mm";
  if (/\(\s*°c\s*\)|degree celsius/i.test(t)) return "degc";
  if (/\(\s*(in )?(rs\.?|₹) ?crore\s*\)/i.test(t)) return "inr_crore";
  if (/\(\s*(in )?km\s*\)/i.test(t)) return "km";
  if (/\bpercentage\b|\bper cent\b/i.test(t) && !/per 1,?000/i.test(t)) return "percent";
  if (/^enrolment of|^enrolments? in|\benrolment\b.*\b(total|primary|secondary)\b/i.test(t) && !/ratio|rate|share|proportion/i.test(t)) return "count";
  if (/\(\s*thousand\b/i.test(t)) return "thousand";
  if (/\(\s*lakh\b/i.test(t)) return "lakh_count";
  if (/\b(number of|no\. of|total number)\b|\bin number\b|\(\s*(in )?(number|nos?\.?)\s*\)/i.test(t)) return "count";
  if (/pupil teacher ratio/i.test(t)) return "pupils_per_teacher";
  if (/gender parity index/i.test(t)) return "gpi";
  if (/per 1,?000\b/i.test(t)) return "per_1000";
  if (/^(percentage|percent|proportion|share)|\b(rate|ratio)\b.*\(%\)|enrolment ratio|enrolment rate|\brate\b/i.test(t) && !/per 1/i.test(t)) return "percent";
  if (/\b(rs\.?|rupees|expenditure|₹)/i.test(t)) return "inr";
  if (/^(total )?number|^average (teachers|enrolments)|^schools|^teachers|^enrolments|^new admission|^children with special/i.test(t)) return "count";
  return "unstated";
}
async function phaseBake(plan) {
  const { readRaw, writeSeries } = await import("../util.mjs");
  const { placeAll } = await import("../../../src/dossiers/states-key.js");
  const dir = path.join(ROOT, "data/raw/profiles-mospi");
  let nB = 0, nS = 0, unplaced = new Map();
  for (const P of PRODUCTS) {
    for (const ind of plan.products[P.id]?.indicators ?? []) {
      const rel = `data/raw/profiles-mospi/${P.id}-${ind.survey ?? 0}-${ind.code}.json`;
      if (!fs.existsSync(path.join(ROOT, rel + ".gz")) && !fs.existsSync(path.join(ROOT, rel))) continue;
      const raw = readRaw(ROOT, rel), rows = raw.rows;
      if (!rows.length) continue;
      // which standard cuts publish a headline value for this indicator
      const dims = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !SKIPKEYS.has(k));
      const headOf = new Map();
      for (const d of dims) if (STD.includes(d)) { const h = [...new Set(rows.map((r) => r[d]))].find((v) => v != null && HEAD.test(String(v).trim())); if (h != null) headOf.set(d, h); }
      const keep = dims.filter((d) => !headOf.has(d) && rows.some((r) => r[d] != null && r[d] !== ""));
      const dates = [...new Set(rows.map((r) => dateOf(P, r)).filter(Boolean))].sort();
      const series = {};
      for (const r of rows) {
        if ([...headOf].some(([d, h]) => r[d] != null && r[d] !== h)) continue;
        const sl = String(r.state ?? "").trim();
        let geo, gname;
        // a row with no state but a zone is the zone's total (EnvStats power supply); else All India
        // geographies that are not one state, kept under their own name (never ranked as a state)
        if (/^(damodar valley corporation|others?|central|central sector|nhb\/states|jammu|kashmir|jammu division|kashmir division)$/i.test(sl)) { geo = `other_${keyPart(sl)}`; gname = sl; }
        else if (!sl && r.zone) { geo = `zone_${keyPart(r.zone)}`; gname = String(r.zone).trim(); }
        else if (!sl || /^all[- ]?india$/i.test(sl) || /^india$/i.test(sl)) { geo = "all_india"; gname = "All India"; }
        else {
          const hits = [...new Set(placeAll(sl).map((h) => h.slug))];
          if (hits.length !== 1) { unplaced.set(sl, (unplaced.get(sl) ?? 0) + 1); continue; }
          geo = hits[0].replace(/-/g, "_"); gname = sl;
        }
        const parts = keep.map((d) => r[d] ?? "");
        const key = [geo, ...parts.map(keyPart)].join("__");
        const d = dateOf(P, r);
        if (!d) continue;
        const label = [String(ind.label ?? r.indicator ?? "").trim().replace(/\s+/g, " "), ...parts.filter((x) => x !== "")].join(", ") + `, ${gname}`;
        const s = (series[key] ??= { name: `${P.id}_${ind.code}_${key}`.slice(0, 120), label, unit: unitOf(label, r.unit), state: geo === "all_india" || geo.startsWith("zone_") || geo.startsWith("other_") ? undefined : gname, geo: gname, group: parts.filter((x) => x !== "").join(", ") || undefined, data: new Array(dates.length).fill(null) });
        const v = num(r.value), i = dates.indexOf(d);
        if (s.data[i] != null && v != null && s.data[i] !== v) throw new Error(`${P.id} ${ind.code}: two values for ${key} at ${d} (${s.data[i]}, ${v}); a dimension is missing from the key`);
        if (v != null) s.data[i] = v;
      }
      // disclose interior nulls on the series that miss them
      for (const s of Object.values(series)) {
        const f = s.data.findIndex((v) => v != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
        const gaps = dates.filter((_, i) => i > f && i < l && s.data[i] == null);
        if (gaps.length) s.gaps = gaps;
      }
      // trailing dates no series reaches are dropped (CONTRACT-series: the axis ends at the last published period)
      while (dates.length && Object.values(series).every((s) => s.data.at(-1) == null)) { dates.pop(); for (const s of Object.values(series)) s.data.pop(); }
      for (const [k, s] of Object.entries(series)) if (s.data.every((v) => v == null)) delete series[k];
      if (!Object.keys(series).length) continue;
      const slug = `profiles-mospi-${P.id}-${ind.survey ?? 0}-${ind.code}`;
      const round = ROUND[P.id];
      writeSeries(ROOT, `data/series/${slug}.json`, { dates, series, meta: {
        dossier: "profiles-mospi", product: `mospi-${P.id}`, source: "MoSPI, eSankhyiki (" + P.records.split("/")[0] + ")", base: round ? round[1] : `${P.id} survey years`,
        frequency: dates.length > 1 ? "annual" : "cross-sectional", unit: "see each series", vintage: raw.vintage, geo: "IND", latestPeriod: round?.[1] ?? null, releaseDate: null,
        revisionPolicy: "Survey estimates are final on release; MoSPI may revise a table without notice, and each fetch is checked against the archived rows.",
        coverage: `${String(ind.label ?? "").trim().slice(0, 200)}: every state and UT, at the headline of ${[...headOf.keys()].join(", ") || "no standard cut"}${keep.length ? `, by ${keep.join(", ")}` : ""}`,
        note: `Baked from data/raw/profiles-mospi/${P.id}-${ind.survey ?? 0}-${ind.code}.json (${rows.length} rows as MoSPI serves them). Standard cuts kept at their headline value: ${[...headOf].map(([d, h]) => `${d} = ${h}`).join("; ") || "none"}. The finer grain is in the raw dump.`,
        indicator: { product: P.id, survey: ind.survey ?? null, code: ind.code, rows: rows.length } } });
      nB++; nS += Object.keys(series).length;
    }
  }
  if (unplaced.size) throw new Error(`bake: the state key cannot place ${[...unplaced].map(([k, n]) => `"${k}" (${n})`).join(", ")}`);
  console.log(`D: ${nB} bundles, ${nS} series`);
}

function freeBytes() { try { const st = fs.statfsSync(ROOT); return st.bavail * st.bsize; } catch { return null; } }
// remove http-cache entries for one records endpoint (the cache stores each response's url)
function trimCache(endpoint) {
  const dir = path.join(ROOT, "data/raw/http-cache");
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    try { const head = fs.readFileSync(p, "utf8").slice(0, 400); if (head.includes(`/api/${endpoint}?`)) { fs.rmSync(p); n++; } } catch {}
  }
  return n;
}

const argv = process.argv;
if (argv.includes("--plan")) {
  console.log("Step 5 plan (state profiles). Phases run in order; each is resumable.\n");
  console.log("A  list:   one call per product (two where a survey list comes first): " + PRODUCTS.length + " products");
  for (const P of PRODUCTS) console.log(`   ${P.id.padEnd(11)} ${P.surveys ? (P.surveys[0] ?? `surveys ${P.surveys[1].join(", ")}`) + " -> " : ""}${P.list[0]}   (${P.why})`);
  console.log("B  meta:   per indicator, the filter listing and page 1 of the records (totalRecords = the expected rows)");
  console.log("C  fetch:  per indicator, every page (100 rows a page, MoSPI's cap), checked against B's count; raw dump per product");
  console.log("   Economic Census: no record endpoint known; one discovery step by hand once MoSPI is released");
  console.log(`\nPlan file: ${path.relative(ROOT, PLAN_FILE)} ${fs.existsSync(PLAN_FILE) ? "(exists)" : "(not yet written: phase A writes it)"}`);
} else if (argv.includes("--status")) {
  const plan = readPlan();
  for (const P of PRODUCTS) { const I = plan.products[P.id]?.indicators; console.log(`${P.id.padEnd(11)} ${I ? `${I.length} indicators, ${I.filter((x) => x.expected != null).length} sized, ${I.filter((x) => x.archived).length} archived, ${I.filter((x) => x.error || x.fetchError).length} failed, ${I.reduce((a, x) => a + (x.expected ?? 0), 0)} rows expected` : "not listed yet"}`); }
} else if (argv.includes("--phase") && argv[argv.indexOf("--phase") + 1] === "bake") {
  await phaseBake(readPlan());
} else if (argv.includes("--phase")) {
  if (process.env.PROFILES_MOSPI_GO !== "1") { console.error("MoSPI is fenced for the audit refresh: set PROFILES_MOSPI_GO=1 only when the coordinator releases it."); process.exit(2); }
  const { mospi, mospiAll } = await import("../mospi.mjs");
  const plan = readPlan();
  const ph = argv[argv.indexOf("--phase") + 1];
  if (ph === "list") await phaseList(mospi, plan);
  else if (ph === "meta") await phaseMeta(mospi, plan);
  else if (ph === "fetch") await phaseFetch(mospiAll, plan);
  else if (ph === "bake") await phaseBake(plan);
  else if (ph === "retry") await phaseRetry(mospi, mospiAll, plan);
  else { console.error(`unknown phase ${ph}`); process.exit(2); }
}
