// scripts/lib/products/ilostat.mjs: work in India as the ILO counts it. ILOSTAT, the ILO's
// statistical database, through its SDMX API (scripts/lib/ilostat.mjs; notes in
// docs/reference/ilostat.md).
//
// Two kinds of data, never mixed (AGENTS.md rule 1):
//   - ILO modelled estimates (ILOEST): the ILO's own model of every country's labour market,
//     1990/91 to the edition year, plus projections. One edition a year (this one is
//     November 2025) re-estimates the whole history. Most Indian years are IMPUTED by the model,
//     not measured: the ILO flags each observation (OBS_STATUS "R" = real, from national data;
//     blank = imputed; bounds where it publishes them). Those flags travel with every series.
//   - Survey series the ILO computed itself from India's unit-level survey data: PLFS (calendar
//     years 2018 on, and quarters from 2017 Q3), NSS employment-unemployment rounds (1994 to
//     2012, labelled by the year each round ends), the Population Census (1961 to 2001), and a
//     few administrative sources (strikes, labour inspection, minimum wage). Each instrument is
//     its own bundle set: a PLFS figure and an NSS figure are different rulers.
//
// What is baked (data/sources.yml `ilo.bake`): every modelled series; every survey table cut
// by at most `annualMaxCuts` classifications for annual data and `quarterlyMaxCuts` for
// quarters (sex counts as a cut); every Census and administrative series. Everything else the
// ILO publishes for India is enumerated in the catalogue (--catalogue) and takes a status in
// data/coverage/ilo.yml. ILOSTAT's copies of other agencies' numbers (CPI, exchange rates,
// currency conversions of rupee earnings) are listed and set aside, never baked.
//
// Bundles: one per (instrument, frequency, indicator family), e.g. ilo-plfs-eap-dwap = labour
// force participation rates from PLFS, every published cut. Modelled years at or after the
// edition year are projections and live in their own bundle, ilo-est-projections. Peer
// countries (one bundle per country, CONTRACT-series rule 8) carry the modelled series named
// in `ilo.peerFlows`.
//
// Per series, beyond the contract fields: `unit`; `flags` = { <ILO OBS_STATUS>: [dates] }
// (R real value, U unreliable, B break in series, A adjusted, M model-based extrapolation);
// `lower`/`upper` = the ILO's uncertainty bounds, where it publishes bounds that differ from
// the value. Nothing is computed here: every value is as the ILO serves it.
//
// Hand check (2026-10-09), against the ILO's own labelled CSV (format=csvfilewithlabels, read by
// eye, not by this code): ILOEST unemployment rate, India, Total, 15+, 2024 = 4.173, status R
// (DF_UNE_2EAP_SEX_AGE_RT); PLFS women's LFPR, 15+, 2024 = 34.389 (DF_EAP_DWAP_SEX_AGE_RT).
// Both are asserted in scripts/validate.mjs so a new edition forces a fresh check.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ilo from "../ilostat.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

// ---------------------------------------------------------------------------
// instruments: the SOURCE attribute decides which ruler an observation belongs to
// ---------------------------------------------------------------------------
const KNOWN = {
  "ILO - Modelled Estimates": { slug: "est", base: "ILO modelled estimates (ILOEST)" },
  "LFS - Periodic Labour Force Survey": { slug: "plfs", base: "PLFS unit data, ILO processing" },
  "HS - National Sample Survey": { slug: "nss", base: "NSS employment-unemployment rounds, ILO processing" },
  "PC - Population Census": { slug: "census", base: "Population Census, ILO processing" },
  // administrative and other sources, as ILOSTAT names them (SOURCE attribute)
  "Other - Special data collection": { slug: "special", base: "Special data collection (ILO questionnaire)" },
  "ADM-LIR - Labour Inspectorate Records": { slug: "adm-lir", base: "Labour inspectorate records (ADM-LIR)" },
  "ADM-IR - Labour Inspectorate Records": { slug: "adm-ir", base: "Labour inspectorate records (ADM-IR)" },
  "ES - Employment market information Survey": { slug: "emi", base: "Employment Market Information survey" },
  "ILO - Estimates": { slug: "ilo-estimates", base: "ILO estimates" },
  "OE - Official Estimates": { slug: "official", base: "Official estimates" },
  "ADM - Labour legislation": { slug: "legislation", base: "Labour legislation" },
  "ILO - Social Security Inquiry Database": { slug: "ssi", base: "ILO Social Security Inquiry" },
  "OS - Estimations based on the Employment-Unemployment Surveys": { slug: "eus-estimates", base: "Estimates based on the NSS employment-unemployment surveys" },
  "Other - Annual Report of Non-Resident Indian, Ministry of Overseas Indian Affairs": { slug: "moia", base: "Ministry of Overseas Indian Affairs, annual report" },
  "ILO - Calculations based on information from ILO textual sources": { slug: "ilo-textual", base: "ILO calculations from ILO textual sources" },
  "Other - Estimates from the Institute for Human Development": { slug: "ihd", base: "Institute for Human Development estimates" },
  "ADM - Administrative Record of Ministry of External Affair": { slug: "mea", base: "Ministry of External Affairs records" },
  "ILO - ILO Employment Policy Gateway": { slug: "ilo-policy", base: "ILO Employment Policy Gateway" },
};
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function instrument(source) {
  const s = source.replace(/ /g, " ").trim();
  if (KNOWN[s]) return { ...KNOWN[s], source: s };
  // "ADM-LIR - Labour Inspectorate Records" -> "adm-lir-labour-inspectorate-records" (shortened)
  return { slug: slugify(s).split("-").slice(0, 4).join("-"), base: s, source: s };
}

const toIso = (t) => {
  if (/^\d{4}$/.test(t)) return `${t}-01-01`;
  const q = t.match(/^(\d{4})-Q([1-4])$/); if (q) return `${q[1]}-${String(3 * q[2] - 2).padStart(2, "0")}-01`;
  const m = t.match(/^(\d{4})-M(\d{2})$/); if (m) return `${m[1]}-${m[2]}-01`;
  throw new Error(`ilostat: unrecognised TIME_PERIOD "${t}"`);
};
const ddmmyyyy = (s) => { const m = String(s ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
// "... -- ILO modelled estimates, Nov. 2025" -> 2025: years from the edition year on are projections
const editionYear = (name) => { const m = String(name).match(/(?:Nov|Sept|July|Jan|Oct|Dec|May)\.?\s+(\d{4})\s*$/); return m ? +m[1] : null; };
const editionLabel = (name) => (String(name).match(/--\s*(.*)$/) || [])[1] ?? null;

// flow id -> indicator family: DF_EAP_DWAP_SEX_AGE_RT -> eap_dwap
const family = (id) => id.replace(/^DF_/, "").split("_").slice(0, 2).join("_").toLowerCase();
const short = (code) => code.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const verOf = (code) => code.replace(/_[^_]*$/, "");          // AGE_5YRBANDS_Y15-19 -> AGE_5YRBANDS

// readable names for classification versions, used where a flow carries more than one
const VERSION = {
  AGE_YTHADULT: "youth and adults", AGE_AGGREGATE: "broad age bands", AGE_5YRBANDS: "5-year bands", AGE_10YRBANDS: "10-year bands",
  AGE_YTHBANDS: "youth bands", AGE_CLDVERSION: "child-labour bands",
  ECO_SECTOR: "broad sectors", ECO_AGGREGATE: "aggregate sectors", ECO_ISIC4: "ISIC Rev.4", ECO_ISIC3: "ISIC Rev.3",
  EC2_ISIC4: "ISIC Rev.4, 2-digit", EC2_ISIC3: "ISIC Rev.3, 2-digit",
  OCU_SKILL: "skill level", OCU_ISCO08: "ISCO-08", OCU_ISCO88: "ISCO-88", OC2_ISCO08: "ISCO-08, 2-digit", OC2_ISCO88: "ISCO-88, 2-digit",
  EDU_AGGREGATE: "aggregate levels", EDU_ISCED97: "ISCED-97", EDU_ISCED11: "ISCED-2011",
  MTS_AGGREGATE: "aggregate", MTS_DETAILS: "detailed", STE_ICSE93: "ICSE-93", STE_AGGREGATE: "aggregate", STE_ICSE18: "ICSE-18",
};

// classification dimensions of a row (everything between MEASURE and TIME_PERIOD)
const cutsOf = (dims) => dims.filter((d) => !["REF_AREA", "FREQ", "MEASURE"].includes(d));

// ---------------------------------------------------------------------------
// shared reading: flows -> India rows, with the dims the server really keys on
// ---------------------------------------------------------------------------
// `keep(f, rows)` returns the rows worth holding: 2.5 million India rows do not fit in memory
// as objects, so each flow is filtered as it arrives (the catalogue keeps a summary only).
async function readFlows(dcfg, { area = "IND", only = null, keep = (f, rows) => rows } = {}) {
  const flows = await ilo.dataflows();
  const out = [];
  out.listed = flows.length;
  for (const f of flows) {
    if (only && !only.includes(f.id)) continue;
    let c;
    try { c = await ilo.constraint(f.id); } catch (e) {
      // DF_IMF_ILOSTAT is keyed by MEASURE alone (no country): not a country series
      out.push({ ...f, skipped: e.message });
      continue;
    }
    if (!c.values.REF_AREA.has(area)) continue;
    const { dims, rows } = await ilo.data(f.id, c.dims.length, area);
    const g = { ...f, dims, nRows: rows.length, edition: editionYear(f.name), editionLabel: editionLabel(f.name) };
    g.rows = keep(g, rows);
    out.push(g);
  }
  return out;
}

async function codelists(flows) {
  const dims = new Set(["MEASURE", "UNIT_MEASURE", "UNIT_MULT"]);
  for (const f of flows) for (const d of cutsOf(f.dims ?? [])) dims.add(d);
  const out = {};
  for (const d of dims) {
    try { out[d] = await ilo.codelist(`CL_${d}`); } catch (e) { console.warn(`ilostat: no codelist CL_${d} (${e.message}); codes used as labels`); out[d] = new Map(); }
  }
  return out;
}

// bake scope: does this (flow, instrument, frequency, number of cuts) get a bundle?
function excludedFlow(dcfg, id) {
  return (dcfg.bake.excludeFlows ?? []).some((re) => new RegExp(re).test(id));
}
function inScope(dcfg, f, inst, freq) {
  if (excludedFlow(dcfg, f.id)) return false;
  const n = cutsOf(f.dims).length;
  if ((dcfg.bake.allCuts ?? []).includes(inst.slug) || !["plfs", "nss"].includes(inst.slug)) return true;
  if (freq === "Q" && (dcfg.bake.quarterlyFlows ?? []).includes(f.id)) return true;
  return freq === "Q" ? n <= dcfg.bake.quarterlyMaxCuts : n <= dcfg.bake.annualMaxCuts;
}

// ---------------------------------------------------------------------------
// catalogue: one item per (instrument, frequency, flow, classification versions)
// ---------------------------------------------------------------------------
export function catalogueItems(flows) {
  const items = new Map();
  for (const f of flows) {
    if (!f.rows) continue;
    const cuts = cutsOf(f.dims);
    for (const r of f.rows) {
      const inst = instrument(r.SOURCE);
      const vers = cuts.map((d) => verOf(r[d]));
      const id = ["ilo", inst.slug, r.FREQ.toLowerCase(), `d${cuts.length}`, f.id.replace(/^DF_/, "").toLowerCase(), ...vers.map((v) => v.toLowerCase())].join(":");
      let it = items.get(id);
      if (!it) {
        const freqName = { A: "annual", Q: "quarterly", M: "monthly" }[r.FREQ] ?? r.FREQ;
        const verText = vers.filter((v) => VERSION[v]).map((v) => VERSION[v]);
        it = { id, label: `${f.name} (${inst.source}, ${freqName}${verText.length ? "; " + verText.join(", ") : ""})`,
          dims: { instrument: inst.slug, source: inst.source, freq: freqName, flow: f.id, cuts: cuts.length, versions: vers }, observations: 0, series: new Set(), from: null, to: null };
        items.set(id, it);
      }
      it.observations++;
      it.series.add(cuts.map((d) => r[d]).join("."));
      const t = r.TIME_PERIOD;
      if (!it.from || t < it.from) it.from = t;
      if (!it.to || t > it.to) it.to = t;
    }
  }
  return [...items.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).map((it) => ({ ...it, series: it.series.size }));
}

// ---------------------------------------------------------------------------
// bundles
// ---------------------------------------------------------------------------
const PALETTE = ["#2E4BD8", "#C47A16", "#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];

function unitOf(r, CL) {
  const u = r.UNIT_MEASURE, m = r.UNIT_MULT;
  const base = { PT: "pct", RT: "rate", PS: "persons", LC: "inr", HR: "hours", DS: "days", CS: "cases", JS: "jobs", XT: "per_1000_workers", IN: "index", US: "usd", PP: "usd_ppp", WP: "workplaces", HH: "households" }[u] ?? (u ? u.toLowerCase() : "number");
  const mult = { "0": "", "3": "_thousand", "6": "_million" }[m] ?? (m ? `_e${m}` : "");
  return base + mult;
}

function seriesFrom(rows, f, CL, dates, { keyPrefix = "" } = {}) {
  const cuts = cutsOf(f.dims);
  const measures = new Set(rows.map((r) => r.MEASURE));
  const versionsPerDim = Object.fromEntries(cuts.map((d) => [d, new Set(rows.map((r) => verOf(r[d])))]));
  const groups = new Map();
  for (const r of rows) {
    const codes = cuts.map((d) => r[d]);
    const k = keyPrefix + [f.id.replace(/^DF_/, "").toLowerCase(), ...(measures.size > 1 ? [short(r.MEASURE)] : []), ...codes.map(short)].join("__");
    let g = groups.get(k);
    if (!g) { g = { r0: r, codes, obs: new Map() }; groups.set(k, g); }
    const iso = toIso(r.TIME_PERIOD);
    if (g.obs.has(iso)) throw new Error(`ilostat: ${f.id} ${k} has two values for ${iso} (${g.obs.get(iso).OBS_VALUE}, ${r.OBS_VALUE}): an instrument mixed inside one series`);
    g.obs.set(iso, r);
  }
  const series = {};
  const ordered = [...groups.entries()].sort(([, a], [, b]) => {
    for (let i = 0; i < cuts.length; i++) {
      const oa = CL[cuts[i]]?.get(a.codes[i])?.order ?? 1e9, ob = CL[cuts[i]]?.get(b.codes[i])?.order ?? 1e9;
      if (oa !== ob) return oa - ob;
    }
    return 0;
  });
  ordered.forEach(([k, g], idx) => {
    const name = (code, d) => {
      const n = CL[d]?.get(code)?.name ?? code;
      const v = verOf(code);
      return versionsPerDim[d].size > 1 && VERSION[v] ? `${n} (${VERSION[v]})` : n;
    };
    const measureName = (CL.MEASURE.get(g.r0.MEASURE)?.name ?? f.name).replace(/\s*\(ILO modelled estimates\)\s*/i, "");
    const label = [measureName, g.codes.map((c, i) => name(c, cuts[i])).join(", ")].filter(Boolean).join(": ");
    const data = [], lower = [], upper = [], flags = {}, withheld = [];
    let hasBounds = false;
    for (const d of dates) {
      const r = g.obs.get(d);
      const v = r && r.OBS_VALUE !== "" ? Number(r.OBS_VALUE) : null;
      if (v != null && !Number.isFinite(v)) throw new Error(`ilostat: ${k} non-numeric value "${r.OBS_VALUE}" at ${d}`);
      data.push(v);
      const lo = r?.LOWER_BOUND !== "" && r?.LOWER_BOUND != null ? Number(r.LOWER_BOUND) : null;
      const hi = r?.UPPER_BOUND !== "" && r?.UPPER_BOUND != null ? Number(r.UPPER_BOUND) : null;
      lower.push(lo); upper.push(hi);
      if ((lo != null && lo !== v) || (hi != null && hi !== v)) hasBounds = true;
      // a row with a status but no value is the ILO withholding the cell (served blank, flagged)
      if (r?.OBS_STATUS && v != null) (flags[r.OBS_STATUS] ??= []).push(d);
      else if (r && v == null) withheld.push(d);
    }
    if (data.every((v) => v == null)) return;
    const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
    series[k] = {
      name: k,
      label,
      unit: unitOf(g.r0, CL),
      color: PALETTE[Math.min(idx, PALETTE.length - 1)],
      data,
      ...(gaps.length ? { gaps, gapsNote: withheld.some((d) => gaps.includes(d)) ? "The ILO serves these cells blank (flagged, value withheld) or not at all." : "The ILO publishes no value for this cut in these periods." } : {}),
      ...(withheld.length ? { withheld } : {}),
      ...(Object.keys(flags).length ? { flags } : {}),
      ...(hasBounds ? { lower, upper } : {}),
    };
  });
  return series;
}

function axis(rows) {
  return [...new Set(rows.map((r) => toIso(r.TIME_PERIOD)))].sort();
}

function bundleOf({ dcfg, geo, inst, freq, fam, flows, CL, rows, extraMeta = {} }) {
  const dates = axis(rows);
  const series = {};
  for (const f of flows) {
    const fr = rows.filter((r) => r.__flow === f.id);
    if (!fr.length) continue;
    Object.assign(series, seriesFrom(fr, f, CL, dates));
  }
  // the axis is the union of the series' own dates; trim any edge no series reaches
  let a = 0, b = dates.length - 1;
  const has = (i) => Object.values(series).some((s) => s.data[i] != null);
  while (a < b && !has(a)) a++;
  while (b > a && !has(b)) b--;
  const D = dates.slice(a, b + 1);
  for (const s of Object.values(series)) {
    s.data = s.data.slice(a, b + 1);
    if (s.lower) { s.lower = s.lower.slice(a, b + 1); s.upper = s.upper.slice(a, b + 1); }
  }
  const vintages = flows.map((f) => ddmmyyyy(f.lastUpdate)).filter(Boolean).sort();
  const notes = new Map();
  for (const r of rows) for (const n of [r.NOTE_SOURCE, r.NOTE_INDICATOR, r.NOTE_CLASSIF]) {
    for (const part of String(n || "").split(" | ")) if (part && !/^Repository: /.test(part) && part !== "Frequency: Quarterly") notes.set(part, (notes.get(part) ?? 0) + 1);
  }
  const freqName = { A: "annual", Q: "quarterly", M: "monthly" }[freq];
  const lastIso = D.at(-1);
  return {
    meta: {
      dossier: "ilo",
      source: `ILO, ILOSTAT (${inst.source})`,
      product: `ILOSTAT ${fam.toUpperCase().replace("_", " ")}: ${flows.map((f) => f.name.replace(/\s*--.*$/, "")).filter((v, i, x) => x.indexOf(v) === i).join("; ")}`,
      base: inst.base,
      frequency: freqName,
      unit: [...new Set(Object.values(series).map((s) => s.unit))].join(", "),
      vintage: vintages.at(-1) ?? null,
      geo,
      latestPeriod: freq === "A" ? lastIso.slice(0, 4) : lastIso.slice(0, 7),
      releaseDate: null,
      flows: flows.map((f) => f.id),
      coverage: `${flows.map((f) => f.name.replace(/\s*--.*$/, "")).filter((v, i, x) => x.indexOf(v) === i).join("; ")}. ${inst.source}, ${freqName}`,
      revisionPolicy: dcfg.revision_policy,
      note: inst.slug === "est"
        ? "ILO modelled estimates. Each observation is imputed by the ILO's model unless flagged R (a real value from national data); the ILO says imputed observations are subject to high uncertainty. Each yearly edition re-estimates the whole history."
        : inst.slug === "nss"
          ? "Computed by the ILO from NSS unit-level data. Each round runs July to June and is labelled by the year it ends (2012 = July 2011 to June 2012). Observations flagged U are ones the ILO itself marks unreliable."
          : inst.slug === "plfs"
            ? "Computed by the ILO from PLFS unit-level data on calendar years (quarters from July 2017), current weekly status. Not MoSPI's published PLFS figures, which use July-June years and the usual status. Observations flagged U are ones the ILO itself marks unreliable."
            : `As published in ILOSTAT from: ${inst.source}.`,
      ...(notes.size ? { sourceNotes: [...notes.entries()].sort((x, y) => y[1] - x[1]).map(([n, c]) => `${n} (${c} obs.)`) } : {}),
      ...extraMeta,
    },
    dates: D,
    series,
  };
}

// dictionary-encoded raw dump: lossless, every column the API served
function encodeRows(rows) {
  if (!rows.length) return { columns: [], dict: {}, rows: [] };
  const columns = Object.keys(rows[0]).filter((c) => !c.startsWith("__"));
  const raw = new Set(["OBS_VALUE", "TIME_PERIOD", "LOWER_BOUND", "UPPER_BOUND"]);
  const dict = Object.fromEntries(columns.filter((c) => !raw.has(c)).map((c) => [c, []]));
  const idx = Object.fromEntries(columns.map((c) => [c, new Map()]));
  const enc = rows.map((r) => columns.map((c) => {
    if (raw.has(c)) return r[c];
    let i = idx[c].get(r[c]); if (i == null) { i = dict[c].length; dict[c].push(r[c]); idx[c].set(r[c], i); }
    return i;
  }));
  return { columns, dict, rows: enc };
}

export async function buildIlostat(root, dcfg, vintage) {
  const flows = await readFlows(dcfg, { keep: (f, rows) => rows.filter((r) => inScope(dcfg, f, instrument(r.SOURCE), r.FREQ) || (f.id === "DF_UNE_2EAP_SEX_AGE_RT")) });
  const withData = flows.filter((f) => f.nRows);
  // anchor assertion: the headline series must be there, with a plausible value
  const une = withData.find((f) => f.id === "DF_UNE_2EAP_SEX_AGE_RT");
  const anchor = une?.rows.find((r) => r.SEX === "SEX_T" && r.AGE === "AGE_YTHADULT_YGE15" && r.TIME_PERIOD === "2024");
  if (!anchor || !(+anchor.OBS_VALUE > 0 && +anchor.OBS_VALUE < 30)) throw new Error("ilostat: no data returned: ILOEST unemployment rate, India, 15+, 2024 (anchor assertion failed)");
  if (withData.length < 500) throw new Error(`ilostat: only ${withData.length} flows hold India (expected ~690): partial read, not baking`);
  const CL = await codelists(withData);

  // modelled flows whose name carries no edition (the SDG flows) follow the latest ILOEST edition
  const estEdition = Math.max(...withData.filter((f) => /ILO modelled estimates/.test(f.name)).map((f) => f.edition ?? 0));
  if (!(estEdition > 2020)) throw new Error("ilostat: no ILOEST edition year found in the flow names");
  // which rows are baked, grouped by bundle
  const groups = new Map();   // bundle slug -> { inst, freq, fam, flows:Set, rows:[] }
  const projected = [];       // ILOEST rows at or after the edition year
  const rawBy = new Map();    // raw file -> rows
  for (const f of withData) {
    for (const r of f.rows) {
      const inst = instrument(r.SOURCE);
      if (!inScope(dcfg, f, inst, r.FREQ)) continue;
      r.__flow = f.id;
      const rawFile = ["est", "plfs", "nss"].includes(inst.slug) ? inst.slug : "other";
      (rawBy.get(rawFile) ?? rawBy.set(rawFile, []).get(rawFile)).push(r);
      if (inst.slug === "est" && +r.TIME_PERIOD.slice(0, 4) >= (f.edition ?? estEdition)) { projected.push({ r, f }); continue; }
      const fam = family(f.id);
      const slug = `ilo-${inst.slug}${r.FREQ === "A" ? "" : "-" + r.FREQ.toLowerCase()}-${fam.replace(/_/g, "-")}`;
      let g = groups.get(slug);
      if (!g) { g = { inst, freq: r.FREQ, fam, flows: new Map(), rows: [] }; groups.set(slug, g); }
      g.flows.set(f.id, f);
      g.rows.push(r);
    }
  }

  // ---------- the audit trail first ----------
  const flowMeta = Object.fromEntries(withData.map((f) => [f.id, { name: f.name, lastUpdate: f.lastUpdate, dims: f.dims }]));
  for (const [file, rows] of rawBy) {
    const flowsHere = [...new Set(rows.map((r) => r.__flow))].sort();
    writeRaw(root, `data/raw/ilo-${file}.json`, {
      vintage,
      note: `ILOSTAT SDMX data for India (REF_AREA=IND), ${file === "other" ? "Population Census and administrative sources" : file}, as served by sdmx.ilo.org (format=csvfile). Dictionary-encoded: each row is one observation; non-numeric columns index into dict.`,
      flows: Object.fromEntries(flowsHere.map((id) => [id, flowMeta[id]])),
      ...encodeRows(rows),
    });
  }

  // ---------- India bundles ----------
  const written = [];
  for (const [slug, g] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const flowsHere = [...g.flows.values()];
    const extra = g.inst.slug === "est" ? { edition: flowsHere.map((f) => f.editionLabel).filter((v, i, x) => v && x.indexOf(v) === i).join("; ") } : {};
    const b = bundleOf({ dcfg, geo: "IND", inst: g.inst, freq: g.freq, fam: g.fam, flows: flowsHere, CL, rows: g.rows, extraMeta: extra });
    writeSeries(root, `data/series/${slug}.json`, b);
    written.push(slug);
  }
  // projections: one bundle, every modelled series past its edition year
  {
    const rows = projected.map(({ r }) => r);
    const flowsHere = [...new Map(projected.map(({ f }) => [f.id, f])).values()];
    const b = bundleOf({ dcfg, geo: "IND", inst: { ...KNOWN["ILO - Modelled Estimates"], slug: "est", source: "ILO - Modelled Estimates" }, freq: "A", fam: "projections", flows: flowsHere, CL, rows,
      extraMeta: { base: "ILO modelled estimates (ILOEST), projections", note: "Projections: for each modelled series, the years from its edition's own year onward (2025 on for the November 2025 ILO edition; 2024 on for the UN population estimates of July 2024). No survey stands behind them; they are forecasts.", coverage: "ILO projections for every modelled series, from the edition year onward" } });
    b.meta.product = "ILOSTAT modelled estimates: projection years";
    writeSeries(root, "data/series/ilo-est-projections.json", b);
    written.push("ilo-est-projections");
  }

  // ---------- peers: modelled estimates, one bundle per country ----------
  for (const geo of dcfg.peers) {
    const pf = await readFlows(dcfg, { area: geo, only: dcfg.peerFlows });
    const rows = [], fl = [];
    for (const f of pf.filter((x) => x.rows?.length)) {
      fl.push(f);
      for (const r of f.rows) {
        if (instrument(r.SOURCE).slug !== "est") continue;
        if (+r.TIME_PERIOD.slice(0, 4) >= (f.edition ?? estEdition)) continue;   // projections are not drawn for peers
        r.__flow = f.id; rows.push(r);
      }
    }
    if (!rows.length) throw new Error(`ilostat: no modelled data for peer ${geo} (anchor assertion failed)`);
    const b = bundleOf({ dcfg, geo, inst: KNOWN["ILO - Modelled Estimates"] && { ...KNOWN["ILO - Modelled Estimates"], slug: "est", source: "ILO - Modelled Estimates" }, freq: "A", fam: `peer_${geo.toLowerCase()}`, flows: fl, CL, rows,
      extraMeta: { coverage: `${geo}: the ILO's modelled headline labour series, for comparison with India on the same definitions`, peer: true } });
    b.meta.product = `ILOSTAT modelled estimates, ${geo}`;
    writeSeries(root, `data/series/ilo-peer-${geo.toLowerCase()}.json`, b);
    written.push(`ilo-peer-${geo.toLowerCase()}`);
  }
  console.log(`ilostat: ${written.length} bundles: ${written.join(" ")}`);
  return written;
}

// ---------------------------------------------------------------------------
// CLI: node scripts/lib/products/ilostat.mjs --catalogue
// ---------------------------------------------------------------------------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes("--catalogue")) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const YAML = (await import("yaml")).default;
  const dcfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8")).dossiers.ilo;
  const all = [];
  const flows = await readFlows(dcfg, { keep: (f, rows) => { all.push(...catalogueItems([{ ...f, rows }])); return null; } });
  const items = all.sort((a, b) => (a.id < b.id ? -1 : 1));
  const skipped = flows.filter((f) => f.skipped).map((f) => `${f.id}: ${f.skipped}`);
  fs.mkdirSync(path.join(ROOT, "data/coverage"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "data/coverage/ilo.catalogue.json"), JSON.stringify({
    family: "ilo",
    source: "ILO, ILOSTAT (SDMX API at sdmx.ilo.org), every dataflow holding India",
    generator: "scripts/lib/products/ilostat.mjs --catalogue",
    generated_at: new Date().toISOString().slice(0, 10),
    note: "One item per (instrument, frequency, dataflow, classification versions). Id: ilo:<instrument>:<freq>:d<number of cuts>:<dataflow>:<version per cut>. Instruments: est = ILO modelled estimates; plfs, nss, census = the ILO's processing of Indian unit-level data; others = the SOURCE the ILO names.",
    flowsListed: flows.listed,
    flowsWithIndia: flows.filter((f) => f.nRows).length,
    notCountryKeyed: skipped,
    items,
  }, null, 1) + "\n");
  console.log(`catalogue: ${items.length} items from ${flows.filter((f) => f.nRows).length} flows (requests ${ilo.requests})`);
}
