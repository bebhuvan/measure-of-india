// scripts/lib/products/profiles-mospi.mjs: step 5 of the state profiles (docs/briefs/state-profiles.md),
// the MoSPI products the profiles still lack: UDISE+ (schools), the Time Use Survey, EnvStats, and
// NSS rounds 75 to 80. Written while MoSPI was fenced for the audit refresh (lb/audit-refresh), so it
// can run unattended the moment the coordinator releases it.
//
//   node scripts/lib/products/profiles-mospi.mjs --plan            # no network: print the plan
//   PROFILES_MOSPI_GO=1 node ... --phase list                       # A: indicator and survey lists
//   PROFILES_MOSPI_GO=1 node ... --phase meta                       # B: filters and page 1 of each indicator
//   PROFILES_MOSPI_GO=1 node ... --phase fetch                      # C: every page of every indicator
//   node ... --status                                               # what is done, what is left
//
// Every call goes through scripts/lib/mospi.mjs (one request at a time, spaced, backoff on 429 and
// 5xx, a response cache in data/raw/http-cache), so a run killed half way resumes where it stopped.
// Progress and the expected row counts (each indicator's meta_data.totalRecords from page 1, phase B)
// are kept in data/raw/profiles-mospi-plan.json; phase C checks the rows it collects against them
// (mospiAll fails a short read). Raw dumps go to data/raw/profiles-mospi-<product>.json.gz. Bundles
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
    } catch (e) { ind.error = `${e.message.slice(0, 160)} (${new Date().toISOString().slice(0, 10)})`; }
    savePlan(plan);
  }
  for (const P of PRODUCTS) { const I = plan.products[P.id]?.indicators ?? []; console.log(`B ${P.id}: ${I.filter((x) => x.expected != null).length}/${I.length} indicators sized, ${I.reduce((a, x) => a + (x.expected ?? 0), 0)} rows expected, ${I.filter((x) => x.hasState).length} with a state dimension`); }
}
async function phaseFetch(mospiAll, plan) {
  const { writeRaw } = await import("../util.mjs");
  for (const P of PRODUCTS) {
    const st = plan.products[P.id];
    if (!st?.indicators) continue;
    const out = {};
    for (const ind of st.indicators) {
      if (ind.error || ind.expected == null) continue;
      const rows = await mospiAll(P.records, { indicator_code: ind.code, ...(ind.survey != null ? { survey_code: ind.survey } : {}) });
      if (rows.length !== ind.expected) throw new Error(`${P.id} ${ind.code}: ${rows.length} rows, page 1 reported ${ind.expected}`);
      out[`${ind.survey ?? ""}:${ind.code}`] = rows;
      ind.done = true;
      savePlan(plan);
    }
    writeRaw(ROOT, `data/raw/profiles-mospi-${P.id}.json`, { vintage: new Date().toISOString().slice(0, 10), note: `MoSPI eSankhyiki ${P.id}, every indicator, every row (profiles step 5)`, indicators: st.indicators, rows: out });
    console.log(`C ${P.id}: ${Object.keys(out).length} indicators archived`);
  }
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
  for (const P of PRODUCTS) { const I = plan.products[P.id]?.indicators; console.log(`${P.id.padEnd(11)} ${I ? `${I.length} indicators, ${I.filter((x) => x.expected != null).length} sized, ${I.filter((x) => x.done).length} fetched, ${I.filter((x) => x.error).length} failed, ${I.reduce((a, x) => a + (x.expected ?? 0), 0)} rows expected` : "not listed yet"}`); }
} else if (argv.includes("--phase")) {
  if (process.env.PROFILES_MOSPI_GO !== "1") { console.error("MoSPI is fenced for the audit refresh: set PROFILES_MOSPI_GO=1 only when the coordinator releases it."); process.exit(2); }
  const { mospi, mospiAll } = await import("../mospi.mjs");
  const plan = readPlan();
  const ph = argv[argv.indexOf("--phase") + 1];
  if (ph === "list") await phaseList(mospi, plan);
  else if (ph === "meta") await phaseMeta(mospi, plan);
  else if (ph === "fetch") await phaseFetch(mospiAll, plan);
  else { console.error(`unknown phase ${ph}`); process.exit(2); }
}
