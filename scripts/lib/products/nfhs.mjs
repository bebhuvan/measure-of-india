// scripts/lib/products/nfhs.mjs: the National Family Health Survey, NFHS-4 (2015-16) and
// NFHS-5 (2019-21), as MoSPI's eSankhyiki API serves the IIPS fact-sheet indicators.
//
// What the source publishes: 21 tables (the fact sheet's sections), 136 sub-indicators, for
// All India and every state and union territory, for rural, urban and total, in two rounds.
// About 29,000 cells. Every cell is baked: one bundle per round per table
// (nfhs-4-<table>, nfhs-5-<table>), each series one sub-indicator in one place and sector,
// on a single date (the round). The two rounds are two rulers (sources.yml seams: nfhs):
// they are never joined into one series, and a page compares them side by side.
//
// Source quirks, all measured on the raw dump (data/raw/nfhs-records.json):
//  - A value in brackets, "(94.8)", is the fact sheet's mark for an estimate based on 25 to 49
//    unweighted cases. It is a published figure: baked, and flagged `caution` on its series.
//    (The adapter before 2026-10-10 parsed it as NaN and dropped 1,000-odd such cells.)
//  - "*" is a figure suppressed for fewer than 25 cases; "NA" not available; "" blank. None is
//    baked; each bundle counts them in meta.omitted.
//  - THE API MISFILES SOME NFHS-4 VALUES. In tables 6, 14, 16, 19 and 20 the NFHS-4 column
//    is shifted against the sub-indicator labels: the value under "women with a bank account
//    they use" is 3.3 (the NFHS-5 national report, ch. 14.6, prints 53 per cent for NFHS-4);
//    under "violence during pregnancy" it is 57.6 (DHS: 3.9). The shift is the same in every
//    state. Table 8 (maternity care) was shifted the same way in the 2026-08-10 dump (children's
//    postnatal care held rupee amounts) and is correct in the 2026-10-10 fetch: MoSPI fixes
//    lines without notice, so every quarantine names the value it was withheld for (`served`). Those NFHS-4 sub-indicators are QUARANTINED below:
//    not baked, listed in the nfhs-4 bundle's meta.quarantined, `excluded` in the ledger.
//    The NFHS-5 column checks clean against the DHS Program's tabulation of the same survey.
//  - In tables 15, 16, 17 and 21 the API files NFHS-4 figures under NFHS-5's wording, but the
//    rounds measured different people or asked a different question: NFHS-5 took blood
//    pressure and blood sugar, and asked about tobacco and alcohol, for everyone 15 and over;
//    NFHS-4 for ages 15-49 (the NFHS-5 report: 45 and 7 per cent of men and women used
//    tobacco in 2015-16, at 15-49, beside the API's 15-and-over NFHS-5 figures of 38 and 9).
//    NFHS-4's cancer questions asked women 15-49 about any examination; NFHS-5 asked women
//    30-49 about a screening test (22.3 per cent against 1.9). These NFHS-4 figures are not
//    baked either: printed beside NFHS-5 they read as changes that never happened.
//  - Geography moved between rounds: Ladakh is inside Jammu & Kashmir in NFHS-4 and its own
//    UT in NFHS-5; Dadra & Nagar Haveli and Daman & Diu are two UTs in NFHS-4 and one in
//    NFHS-5. Each round keeps its own geography; nothing is re-aggregated.
//
// Hand-check (docs/RUNBOOK-sources.md): one value per bundle is confirmed mechanically against
// the DHS Program's tabulation of NFHS-4 (IA2015DHS) and NFHS-5 (IA2020DHS), archived in
// data/raw/nfhs-dhs-crosscheck.json, by DHS_CHECKS below; the bake fails if a confirmed pair
// drifts or a quarantined pair stops disagreeing. By hand, 2026-10-10: All India children
// 6-59 months anaemic, NFHS-5 67.12 and NFHS-4 58.4 (API) against 67.1 and 58.4 in the NFHS-5
// national report (FR375, Table 10.14; DHS's own tabulation gives 68.1, so it is not used for
// this line); women with a bank account NFHS-5 78.56 against 79 per cent (FR375 ch. 14.6) and
// DHS CO_MOBB_W_BNK 78.6.
//
//   node scripts/lib/products/nfhs.mjs --bake        rebuild bundles from the raw dumps (no network)
//   node scripts/lib/products/nfhs.mjs --catalogue   the coverage catalogue from the API listing

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { mospi, mospiAll } from "../mospi.mjs";
import { getJson } from "../net.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

/* ---------- the 21 tables ---------- */
export const TABLES = {
  1: ["household", "Population and household profile"],
  2: ["adults", "Characteristics of adults (age 15-49)"],
  3: ["marriage-fertility", "Marriage and fertility"],
  4: ["mortality", "Infant and child mortality"],
  5: ["family-planning", "Current use of family planning methods"],
  6: ["unmet-need", "Unmet need for family planning"],
  7: ["fp-quality", "Quality of family planning services"],
  8: ["maternity", "Maternity care"],
  9: ["delivery", "Delivery care"],
  10: ["vaccination", "Child vaccinations and vitamin A"],
  11: ["childhood-disease", "Treatment of childhood diseases"],
  12: ["child-nutrition", "Child feeding and nutritional status"],
  13: ["adult-nutrition", "Nutritional status of adults"],
  14: ["anaemia", "Anaemia among children and adults"],
  15: ["blood-sugar", "Blood sugar among adults"],
  16: ["blood-pressure", "Hypertension among adults"],
  17: ["cancer-screening", "Screening for cancer"],
  18: ["hiv-knowledge", "Knowledge of HIV/AIDS"],
  19: ["empowerment", "Women's empowerment"],
  20: ["violence", "Gender-based violence"],
  21: ["tobacco-alcohol", "Tobacco and alcohol use"],
};
export const ROUNDS = {
  "nfhs-4": { n: 4, date: "2016-01-01", period: "2015-16", base: "NFHS-4 (2015-16)", label: "NFHS-4, 2015-16", fieldwork: "January 2015 to December 2016" },
  "nfhs-5": { n: 5, date: "2020-01-01", period: "2019-21", base: "NFHS-5 (2019-21)", label: "NFHS-5, 2019-21", fieldwork: "June 2019 to April 2021, in two phases; the second, begun in January 2020, was interrupted by the pandemic" },
};
export const bundleSlug = (round, table) => `nfhs-${ROUNDS[round].n}-${TABLES[table][0]}`;
const SECTORS = { "Rural + Urban (Combined)": "total", Rural: "rural", Urban: "urban" };

/* ---------- NFHS-4 sub-indicators the API misfiles or mislabels (see the header) ----------
 * A misfiled entry names the All India value MoSPI serves while the line is wrong (`served`).
 * MoSPI corrects lines without notice: table 8 was misfiled in the 2026-08-10 dump and right in
 * the 2026-10-10 fetch. If the served value changes, the bake stops so the entry is re-checked
 * against the report and DHS, rather than withholding a figure that may now be right.
 * `re` matches the API's sub_indicator text in table `t`. kind "misfiled": the value belongs to
 * another indicator; kind "frame": a different population or question under NFHS-5's wording. */
export const QUARANTINE = [
  { t: 6, re: /^Total Unmet need/i, kind: "misfiled", served: 5.7, evidence: "API 5.7 is the NFHS-4 unmet need for spacing; total unmet need was 12.9 (DHS FP_NADM_W_UNT; the Women and Men in India compendium, table 2.13, also prints 12.9)" },
  { t: 14, re: /^All women age 15-19/i, kind: "misfiled", served: 22.7, evidence: "API 22.7 is NFHS-4's anaemia among men 15-49 (the NFHS-5 report, ch. 10: 23 per cent of men in 2015-16); women 15-19 were 54 per cent" },
  { t: 16, re: /^Women .*Elevated blood pressure \(Systolic ≥140/, kind: "misfiled", served: 0.7, evidence: "API 0.7 is NFHS-4's 'very high' band (systolic 180 and above), not elevated-or-on-medicine" },
  { t: 16, re: /^Men .*Elevated blood pressure \(Systolic ≥140/, kind: "misfiled", served: 0.9, evidence: "API 0.9 is NFHS-4's 'very high' band, not elevated-or-on-medicine" },
  { t: 19, re: /owning a house and\/or land/i, kind: "misfiled", served: 28.9, evidence: "API 28.9; the column is shifted from this row down" },
  { t: 19, re: /bank or savings account/i, kind: "misfiled", served: 3.3, evidence: "API 3.3; the NFHS-5 national report (FR375, ch. 14.6) prints 53 per cent for NFHS-4" },
  { t: 19, re: /mobile phone/i, kind: "misfiled", served: 38.4, evidence: "API 38.4 belongs to the row above" },
  { t: 19, re: /hygienic methods/i, kind: "misfiled", served: 53.0, evidence: "API 53.0 is NFHS-4's bank-account figure" },
  { t: 20, re: /spousal violence/i, kind: "misfiled", served: 45.9, evidence: "API 45.9 for India, 81.2 for Kerala; urban (61.8) far above rural (36.9). The compendium (table 6.4) prints 30.9 for physical or sexual spousal violence in NFHS-4" },
  { t: 20, re: /violence during any pregnancy/i, kind: "misfiled", served: 57.6, evidence: "API 57.6; DHS DV_VPRG_W_VPG gives 3.9 for NFHS-4" },
  { t: 15, re: /./, kind: "frame", evidence: "NFHS-4 tested blood sugar at ages 15-49 only; NFHS-5 tested everyone 15 and over" },
  { t: 16, re: /./, kind: "frame", evidence: "NFHS-4 measured blood pressure at ages 15-49 only, in different bands; NFHS-5 measured everyone 15 and over" },
  { t: 17, re: /./, kind: "frame", evidence: "NFHS-4 asked women 15-49 about any examination of the cervix, breast or mouth; NFHS-5 asked women and men 30-49 about a screening test" },
  { t: 21, re: /(use any kind of tobacco|consume alcohol)/i, kind: "frame", evidence: "NFHS-4 asked ages 15-49 (45 and 7 per cent of men and women used tobacco, NFHS-5 report ch. 11); NFHS-5's figures here are for everyone 15 and over" },
];
// Cells where the source's own total does not lie between its rural and urban figures: one of
// the three is wrong at source and we cannot say which. Baked as published, flagged on the
// series (flags.inconsistent), and named in validate.mjs's exception list.
export const INCONSISTENT = [
  { round: "nfhs-4", t: 8, re: /iron folic acid for 100 days/i, geo: "Punjab", note: "NFHS-4 Punjab: total 42.6 against rural 40.0 and urban 40.8 as served; the total cannot exceed both" },
];
const quarantineOf = (t, sub, round) => round === "nfhs-4" ? QUARANTINE.find((q) => q.t === Number(t) && q.re.test(sub)) ?? null : null;

/* ---------- labels ---------- */
// The API carries the fact sheet's footnote numbers glued to words ("source1", "anaemic
// (<11.0 g/dl)22") and a few typos ("wih", "swith"). Presentation only: values never change.
export function cleanLabel(s) {
  let t = String(s).replace(/\s+/g, " ").trim();
  t = t.replace(/\bswith\b/g, "with").replace(/\bwih\b/g, "with").replace(/^Men \(age 15 years and above/, "Men age 15 years and above")
    .replace(/^Children Prevalence of/, "Prevalence of").replace(/\)\s*Ever undergone/, ") ever undergone").replace(/\}\s*(\(%\))?$/, ")$1")
    .replace(/^Current Use of Family Planning Methods \(Currently Married Women Age 15-49 years\) - /, "Currently married women age 15-49 using family planning: ");
  t = t.replace(/\s*\(%\)\s*$/, "");
  // footnote digits: glued to a word or a closing bracket, then end, a comma list, or a space
  t = t.replace(/([a-z)\]])(\d{1,2}(?:\s*,\s*\d{1,2})*)(?=$|\s|\()/g, (m, a, d, off, str) => (a === "m" && /kg\/$/.test(str.slice(Math.max(0, off - 3), off)) ? m : a));
  t = t.replace(/\s+/g, " ").trim();
  return t;
}
const slug = (s, n = 48) => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n).replace(/_$/, "");
export const geoKey = (state) => slug(state, 40);
export function unitOfSub(t, label) {
  if (/^Sex ratio/i.test(label)) return "ratio";
  if (/Total Fertility Rate/i.test(label)) return "births_per_woman";
  if (/Adolescent fertility rate/i.test(label)) return "per_1000_women";
  if (Number(t) === 4) return "per_1000";
  if (/out-of-pocket expenditure/i.test(label)) return "inr";
  return "percent";
}
// "(94.8)" is a published estimate on 25-49 unweighted cases; "*", "NA" and "" are not values
export function parseCell(v) {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\()?(-?\d+(?:\.\d+)?)(\))?$/);
  if (m) return { value: Number(m[2]), caution: !!(m[1] && m[3]) };
  return { value: null, omitted: s === "" ? "blank" : s };
}

/* ---------- fetch ---------- */
export async function fetchNfhsFilters(root, dcfg, vintage) {
  // the filter listing names every sub-indicator with its code: the catalogue's ids carry the
  // code, the records only the text, so the ledger maps one to the other through this file
  const filters = {};
  for (const code of Object.keys(dcfg.fetch.indicators)) filters[code] = (await mospi("nfhs/getnfhsFilterByIndicatorId", { indicator_code: code })).data ?? null;
  writeRaw(root, "data/raw/nfhs-filters.json", { vintage, note: "nfhs/getnfhsFilterByIndicatorId for each of the 21 tables: sub-indicators (with codes), sectors, states, surveys.", filters });
}
export async function fetchNfhsRaw(root, dcfg, vintage) {
  await fetchNfhsFilters(root, dcfg, vintage);
  const byInd = {};
  for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await mospiAll("nfhs/getNfhsRecords", { indicator_code: code });
  writeRaw(root, "data/raw/nfhs-records.json", {
    vintage,
    note: "Complete row-sets of all 21 NFHS indicators from nfhs/getNfhsRecords, both survey rounds (NFHS-4 & NFHS-5). Each row keys on (state, sub_indicator, sector, survey, value).",
    indicators: byInd,
  });
}

// The DHS Program API tabulates the same two surveys (IA2015DHS, IA2020DHS) from the unit
// data; its national figures are the independent check on the API's columns.
const DHS_URL = (sv) => `https://api.dhsprogram.com/rest/dhs/data?countryIds=IA&surveyIds=${sv}&breakdown=national&perpage=5000&f=json`;
export async function fetchDhsCrosscheck(root, vintage) {
  const rows = [];
  for (const sv of ["IA2015DHS", "IA2020DHS"]) {
    const res = await getJson(DHS_URL(sv), { gapMs: 1000, retries: 4, headers: { "User-Agent": "india-atlas (atlas.thisindianlife.today)" } });
    if ((res.TotalPages ?? 1) > 1) throw new Error(`DHS ${sv}: more than one page; raise perpage`);
    for (const x of res.Data ?? []) if (x.IsTotal) rows.push({ survey: x.SurveyId, id: x.IndicatorId, indicator: x.Indicator, value: x.Value, precision: x.Precision, preferred: x.IsPreferred });
  }
  if (rows.length < 2000) throw new Error(`DHS cross-check: only ${rows.length} national rows`);
  writeRaw(root, "data/raw/nfhs-dhs-crosscheck.json", {
    vintage,
    note: "DHS Program API (api.dhsprogram.com), India NFHS-4 (IA2015DHS) and NFHS-5 (IA2020DHS), national totals: the DHS Program's own tabulation of the same surveys, kept as an independent check on the columns MoSPI's API serves. Not baked.",
    rows,
  });
}

/* ---------- the DHS cross-check ----------
 * [table, sub-indicator regex, DHS indicator id, which rounds must agree]. A "misfiled" entry
 * asserts the API's NFHS-4 value DISAGREES with DHS by more than 2 points: the evidence for a
 * quarantine, re-proved on every bake. */
export const DHS_CHECKS = [
  [1, /birth was registered/, "CP_BREG_C_REG", ["nfhs-4", "nfhs-5"]],
  [1, /clean fuel/, "HC_CKFL_H_CLN", ["nfhs-4", "nfhs-5"]],
  [1, /iodized salt/, "CN_IODZ_H_IOD", ["nfhs-4", "nfhs-5"]],
  [2, /^Women \(age 15-49\) who are literate/, "ED_LITR_W_LIT", ["nfhs-4", "nfhs-5"]],
  [3, /Total Fertility Rate/, "FE_FRTR_W_TFR", ["nfhs-4", "nfhs-5"]],
  [3, /already mothers or pregnant/, "FE_TNPG_W_CBR", ["nfhs-4", "nfhs-5"]],
  [4, /^Infant mortality/, "CM_ECMT_C_IMR", ["nfhs-4", "nfhs-5"]],
  [4, /^Under-five mortality/, "CM_ECMT_C_U5M", ["nfhs-4", "nfhs-5"]],
  [5, /: Any method/, "FP_CUSM_W_ANY", ["nfhs-4", "nfhs-5"]],
  [5, /: Any modern method/, "FP_CUSM_W_MOD", ["nfhs-4", "nfhs-5"]],
  [5, /Female sterilization/, "FP_CUSM_W_FST", ["nfhs-4", "nfhs-5"]],
  [5, /: Condom/, "FP_CUSM_W_MCN", ["nfhs-4", "nfhs-5"]],
  [6, /^Total Unmet need/, "FP_NADM_W_UNT", ["nfhs-5"], "misfiled"],
  [6, /spacing/, "FP_NADM_W_UNS", ["nfhs-5"]],
  [7, /side effects/, null, []],
  [9, /^Institutional births \(in the 5/, null, []],
  [10, /received BCG/, "CH_VACC_C_BCG", ["nfhs-4", "nfhs-5"]],
  [10, /3 doses of polio/, "CH_VACC_C_OP3", ["nfhs-4", "nfhs-5"]],
  [10, /first dose of measles/, "CH_VACC_C_MSL", ["nfhs-4", "nfhs-5"]],
  [11, /^Prevalence of diarrhoea/, "CH_DIAR_C_DIA", ["nfhs-4", "nfhs-5"]],
  [11, /oral rehydration salts/, "CH_DIAT_C_ORS", ["nfhs-4", "nfhs-5"]],
  [11, /received zinc/, "CH_DIAT_C_ZNC", ["nfhs-4", "nfhs-5"]],
  [12, /exclusively breastfed/, "CN_IYCB_C_EXB", ["nfhs-4", "nfhs-5"]],
  [12, /are stunted/, "CN_NUTS_C_HA2", ["nfhs-4", "nfhs-5"]],
  [12, /are wasted/, "CN_NUTS_C_WH2", ["nfhs-4", "nfhs-5"]],
  [12, /are underweight/, "CN_NUTS_C_WA2", ["nfhs-4", "nfhs-5"]],
  [13, /^Women .*below normal/, "AN_NUTS_W_THN", ["nfhs-4", "nfhs-5"]],
  [13, /^Women .*overweight or obese/, "AN_NUTS_W_OWT", ["nfhs-4", "nfhs-5"]],
  // children's anaemia: DHS tabulates 68.1 for NFHS-5 where the IIPS report (Table 10.14) and
  // the API both print 67.1; the report is the check for this one (see the header)
  [14, /^All women age 15-49/, "AN_ANEM_W_ANY", ["nfhs-4", "nfhs-5"]],
  [18, /^Women .*comprehensive knowledge/, "HA_CKNA_W_CKA", ["nfhs-4", "nfhs-5"]],
  [18, /^Women .*consistent condom/, "HA_KHVP_W_CND", ["nfhs-4", "nfhs-5"]],
  [19, /bank or savings account/, "CO_MOBB_W_BNK", ["nfhs-5"]],
  [20, /violence during any pregnancy/, "DV_VPRG_W_VPG", ["nfhs-5"], "misfiled"],
].filter((c) => c[2]);
const DHS_SURVEY = { "nfhs-4": "IA2015DHS", "nfhs-5": "IA2020DHS" };
export function dhsCrosscheck(raw, dhs) {
  const by = new Map(dhs.rows.filter((r) => r.preferred !== 0).map((r) => [`${r.survey}|${r.id}`, r]));
  for (const r of dhs.rows) if (!by.has(`${r.survey}|${r.id}`)) by.set(`${r.survey}|${r.id}`, r);
  const allIndia = (t, re, round) => {
    const row = raw.indicators[t].find((x) => re.test(cleanLabel(x.sub_indicator)) && x.state === "All India" && SECTORS[x.sector] === "total" && x.survey === round);
    return row ? parseCell(row.value).value : null;
  };
  const out = [], problems = [];
  for (const [t, re, id, rounds, misfiled] of DHS_CHECKS) {
    for (const round of rounds) {
      const api = allIndia(t, re, round), d = by.get(`${DHS_SURVEY[round]}|${id}`);
      if (api == null || !d) { problems.push(`T${t} ${re} ${round}: ${api == null ? "no API value" : "no DHS row " + id}`); continue; }
      const tol = d.precision === 0 ? 0.6 : 0.16;
      const diff = Math.abs(api - d.value);
      out.push({ table: t, sub: String(re), round, dhs: id, api, dhsValue: d.value, agrees: diff <= tol });
      if (diff > tol) problems.push(`T${t} ${re} ${round}: API ${api} vs DHS ${id} ${d.value}`);
    }
    if (misfiled) {
      const api = allIndia(t, re, "nfhs-4"), d = by.get(`IA2015DHS|${id}`);
      if (api == null || !d) problems.push(`T${t} ${re}: quarantine evidence missing`);
      else {
        out.push({ table: t, sub: String(re), round: "nfhs-4", dhs: id, api, dhsValue: d.value, agrees: false, quarantined: true });
        if (Math.abs(api - d.value) <= 2) problems.push(`T${t} ${re}: API NFHS-4 ${api} now agrees with DHS ${d.value}; the quarantine may be stale`);
      }
    }
  }
  return { out, problems };
}

/* ---------- bake ---------- */
const GREY = "#5F6675";
const geoOrder = (a, b) => (a === "All India" ? -1 : b === "All India" ? 1 : a.localeCompare(b));
export function bakeNfhs(root, dcfg, raw, dhs) {
  if (Object.keys(raw.indicators).length !== 21) throw new Error(`NFHS: raw holds ${Object.keys(raw.indicators).length} tables, expected 21`);
  const vintage = raw.vintage;
  // anchor: the headline the guide is built on must be there, in range
  const anchor = raw.indicators["14"].find((x) => /^Children age 6-59/.test(x.sub_indicator) && x.state === "All India" && SECTORS[x.sector] === "total" && x.survey === "nfhs-5");
  const av = anchor && parseCell(anchor.value).value;
  if (!(av > 40 && av < 90)) throw new Error(`NFHS: no data returned: child anaemia, All India, NFHS-5 (got ${anchor?.value})`);

  const { out: checks, problems } = dhs ? dhsCrosscheck(raw, dhs) : { out: [], problems: ["no DHS dump"] };
  for (const q of QUARANTINE.filter((x) => x.served != null)) {
    const r = raw.indicators[q.t].find((x) => q.re.test(x.sub_indicator) && x.state === "All India" && SECTORS[x.sector] === "total" && x.survey === "nfhs-4");
    const v = r ? parseCell(r.value).value : null;
    if (v !== q.served) problems.push(`QUARANTINE T${q.t} ${q.re}: MoSPI now serves ${v} for NFHS-4 (was ${q.served} when withheld); re-check the line against the NFHS-5 report and DHS, then update or drop the entry`);
  }
  if (problems.length) throw new Error("NFHS DHS cross-check failed:\n  " + problems.join("\n  "));
  console.log(`  nfhs: DHS cross-check, ${checks.filter((c) => c.agrees).length} pairs agree, ${checks.filter((c) => c.quarantined).length} quarantines re-proved`);

  const ledgerFacts = { quarantined: [], subs: {} };
  const written = [];
  for (const [round, R] of Object.entries(ROUNDS)) {
    for (const [t, [tslug, tname]] of Object.entries(TABLES)) {
      const rows = raw.indicators[t].filter((x) => x.survey === round);
      const subs = [...new Set(raw.indicators[t].map((x) => x.sub_indicator))];   // the table's order, both rounds
      // a key is the label's first 44 characters; labels that share them take a short hash of the
      // full label, so a key never depends on the order the API returns rows in
      const keyOf = new Map(), stem = (sub) => slug(cleanLabel(sub), 44);
      for (const sub of subs) {
        const clash = subs.some((o) => o !== sub && stem(o) === stem(sub));
        keyOf.set(sub, clash ? `${stem(sub)}_${crypto.createHash("sha1").update(cleanLabel(sub)).digest("hex").slice(0, 6)}` : stem(sub));
      }
      const series = {}, omitted = {}, quarantined = [];
      let caution = 0;
      const geos = [...new Set(rows.map((x) => x.state))].sort(geoOrder);
      for (const sub of subs) {
        const label = cleanLabel(sub), unit = unitOfSub(t, label);
        const q = quarantineOf(t, sub, round);
        const subRows = rows.filter((x) => x.sub_indicator === sub);
        if (q) {
          if (subRows.some((x) => parseCell(x.value).value != null)) quarantined.push({ sub: label, kind: q.kind, evidence: q.evidence, cells: subRows.filter((x) => parseCell(x.value).value != null).length });
          continue;
        }
        for (const geo of geos) for (const [sector, sk] of Object.entries(SECTORS)) {
          const x = subRows.find((r) => r.state === geo && r.sector === sector);
          if (!x) continue;
          const c = parseCell(x.value);
          if (c.value == null) { omitted[c.omitted] = (omitted[c.omitted] ?? 0) + 1; continue; }
          const key = `${keyOf.get(sub)}__${geoKey(geo)}__${sk}`;
          const s = {
            name: `nfhs${R.n}_t${t}_${key}`,
            label: `${label}, ${geo}${sk === "total" ? "" : ", " + sk}`,
            color: GREY, unit, data: [c.value],
            group: label, sub: keyOf.get(sub), geo, sector: sk,
          };
          if (c.caution) { s.flags = { caution: [R.date] }; caution++; }
          const inc = INCONSISTENT.find((x) => x.round === round && x.t === Number(t) && x.re.test(sub) && x.geo === geo);
          if (inc) { s.flags = { ...(s.flags ?? {}), inconsistent: [R.date] }; s.flagNote = inc.note; }
          series[key] = s;
        }
      }
      const nSeries = Object.keys(series).length;
      const slugB = bundleSlug(round, t);
      ledgerFacts.subs[slugB] = Object.fromEntries(subs.map((s) => [cleanLabel(s), keyOf.get(s)]));
      ledgerFacts.quarantined.push(...quarantined.map((q) => ({ bundle: slugB, ...q })));
      if (!nSeries) { console.log(`  ${slugB}: nothing to bake (every NFHS-4 value quarantined)`); continue; }
      const bundle = {
        meta: {
          dossier: "nfhs", product: "nfhs", source: dcfg.source_agency, base: R.base, frequency: "cross-sectional",
          unit: "percent", vintage, geo: dcfg.geo ?? "IND", latestPeriod: R.period, releaseDate: null,
          revisionPolicy: dcfg.revision_policy,
          coverage: `NFHS table ${t}, ${tname.toLowerCase()}: All India and ${geos.length - 1} states and union territories, total, rural and urban, ${R.label}`,
          table: Number(t), tableName: tname, round: R.label, fieldwork: R.fieldwork,
          cut: "Indicator, state, rural or urban",
          note: `One round of the National Family Health Survey, a cross-section: compare it with the other round side by side, never as a series. Every series is one sub-indicator in one place and sector. Values the fact sheet prints in brackets (an estimate on 25 to 49 unweighted cases) carry flags.caution${caution ? ` (${caution} here)` : ""}. Cells suppressed at source ("*", fewer than 25 cases), marked NA or left blank are not baked; meta.omitted counts them.${quarantined.length ? " Some NFHS-4 sub-indicators of this table are withheld: MoSPI's API files them against the wrong label or under NFHS-5's wording (meta.quarantined)." : ""}`,
          flagsNote: "caution: the fact sheet prints this estimate in brackets, based on 25 to 49 unweighted cases. inconsistent: the source's total for this place does not lie between its rural and urban figures (flagNote says which).",
          omitted,
          ...(quarantined.length ? { quarantined } : {}),
          // on the NFHS-5 bundle: which of its sub-indicators have no usable NFHS-4 figure, and why
          ...(round === "nfhs-5" ? { nfhs4Withheld: subs.map((sub) => ({ sub: cleanLabel(sub), q: quarantineOf(t, sub, "nfhs-4") })).filter((x) => x.q && raw.indicators[t].some((r) => r.sub_indicator !== undefined && cleanLabel(r.sub_indicator) === x.sub && r.survey === "nfhs-4" && parseCell(r.value).value != null)).map((x) => ({ sub: x.sub, kind: x.q.kind, evidence: x.q.evidence })) } : {}),
          crosscheck_dhs: checks.filter((c) => c.table === Number(t) && c.round === round),
        },
        dates: [R.date],
        series,
      };
      // vintage is data vintage (AGENTS.md rule 5): a bundle whose every label and value is
      // unchanged keeps its vintage even if its keys were renamed
      const prevPath = path.join(root, `data/series/${slugB}.json`);
      if (fs.existsSync(prevPath)) {
        const prev = JSON.parse(fs.readFileSync(prevPath, "utf8"));
        const sig = (b) => Object.values(b.series).map((x) => `${x.label}=${x.data[0]}`).sort().join("|");
        if (prev.meta?.vintage && sig(prev) === sig(bundle)) bundle.meta.vintage = prev.meta.vintage;
      }
      writeSeries(root, `data/series/${slugB}.json`, bundle);
      written.push(slugB);
    }
  }
  // retire the pre-2026-10-10 thematic bundles (they joined the two rounds on one axis)
  for (const old of ["child", "maternal", "anaemia", "adult", "fertility", "household", "states"]) {
    const p = path.join(root, `data/series/nfhs-${old}.json`);
    if (fs.existsSync(p)) { fs.unlinkSync(p); console.log(`retired data/series/nfhs-${old}.json`); }
  }
  return { written, ledgerFacts };
}

export async function buildNfhs(root, dcfg, vintage) {
  await fetchNfhsRaw(root, dcfg, vintage);
  await fetchDhsCrosscheck(root, vintage);
  const raw = JSON.parse(fs.readFileSync(path.join(root, "data/raw/nfhs-records.json"), "utf8"));
  const dhs = JSON.parse(fs.readFileSync(path.join(root, "data/raw/nfhs-dhs-crosscheck.json"), "utf8"));
  return bakeNfhs(root, dcfg, raw, dhs);
}

/* Catalogue (docs/CONTRACT-coverage.md): nfhs/getNfhsIndicatorList (21 tables) and
 * nfhs/getnfhsFilterByIndicatorId. Each table's sub-indicators are separate measures, and so
 * are the two rounds: both are crossed with every cut.
 *   nfhs:<table>:<sub-indicator>:<round>:all | :state:<state> | :sector:<sector> */
import { writeCatalogue, indicatorCatalogue, catalogueCli, sourceCfg, ROOT } from "../catalogue.mjs";
export async function catalogueNfhs() {
  const inds = (await mospi("nfhs/getNfhsIndicatorList", {})).data ?? [];
  const items = await indicatorCatalogue({ mospi, prefix: "nfhs", indicators: Array.isArray(inds) ? inds : inds.indicator ?? [],
    cross: ["sub_indicator", "survey"],
    filter: (ind) => ["nfhs/getnfhsFilterByIndicatorId", { indicator_code: ind.indicator_code }] });
  writeCatalogue("nfhs", { source: "MoSPI / IIPS: National Family Health Survey, NFHS-4 and NFHS-5 (eSankhyiki API)",
    generator: "scripts/lib/products/nfhs.mjs --catalogue",
    note: "From getNfhsIndicatorList and getnfhsFilterByIndicatorId: every sub-indicator and round, one cut at a time (state, or rural/urban).", items });
}
await catalogueCli(import.meta.url, catalogueNfhs);
if (process.argv[1] && path.resolve(process.argv[1]).endsWith("products/nfhs.mjs") && process.argv.includes("--bake")) {
  const { dcfg } = sourceCfg("nfhs");
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/nfhs-records.json"), "utf8"));
  const dp = path.join(ROOT, "data/raw/nfhs-dhs-crosscheck.json");
  if (!fs.existsSync(dp)) await fetchDhsCrosscheck(ROOT, new Date().toISOString().slice(0, 10));
  if (!fs.existsSync(path.join(ROOT, "data/raw/nfhs-filters.json"))) await fetchNfhsFilters(ROOT, dcfg, raw.vintage);
  const dhs = JSON.parse(fs.readFileSync(dp, "utf8"));
  const { written, ledgerFacts } = bakeNfhs(ROOT, dcfg, raw, dhs);
  console.log(`nfhs: ${written.length} bundles; ${ledgerFacts.quarantined.length} NFHS-4 sub-indicators withheld`);
}
