#!/usr/bin/env node
// pipeline/verify.mjs — numeric verification, the hard guardrail.
// Every number in a generated prose file must be traceable to the facts
// sheet (in either its 1-decimal or 2-decimal rendering, or as an exact
// integer count present in the sheet). Any other figure = reject.
// Usage: node pipeline/verify.mjs <prose-file> <slug>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bySlug } from "../src/dossiers/registry.js";
import { makePeriodIndex, yearLag, MONTHS_FULL } from "./lib/periods.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [file, slug] = process.argv.slice(2);
if (!file || !slug) { console.error("usage: node pipeline/verify.mjs <prose-file> <slug>"); process.exit(1); }

const facts = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/out", `facts-${slug}.json`), "utf8"));
const prose = fs.readFileSync(file, "utf8");

// the allowed numeric vocabulary: every number in the facts sheet, rendered
// every way the voice allows (1dp, 2dp, integer), plus absolute values
// (prose says "fell 1.85%" for a -1.85 print) and pt deltas.
const allowed = new Set();
function addNum(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return;
  allowed.add(v.toFixed(2));
  allowed.add(v.toFixed(1));
  allowed.add(Math.abs(v).toFixed(2));
  allowed.add(Math.abs(v).toFixed(1));
  if (Number.isInteger(v)) allowed.add(String(v));
}
function walk(o) {
  if (o == null) return;
  if (typeof o === "number") return addNum(o);
  if (Array.isArray(o)) return o.forEach(walk);
  if (typeof o === "object") return Object.values(o).forEach(walk);
  if (typeof o === "string") {
    // pull numbers out of strings like "0.66 pt below the 2% floor"
    for (const m of o.matchAll(/-?\d+\.\d+|-?\d+/g)) addNum(parseFloat(m[0]));
  }
}
walk(facts.series);
walk(facts.cross);
if (facts.legacy) walk(facts.legacy);
// structural constants the dossier may cite (weights, shares, base years) —
// declared per dossier in the registry, never assumed globally
const DOSSIER = bySlug[slug];
if (!DOSSIER) { console.error(`verify: dossier "${slug}" is not in src/dossiers/registry.js`); process.exit(1); }
for (const v of DOSSIER.proseConstants ?? []) addNum(v);

// extract candidate figures from prose: decimals, percents, pt deltas
const failures = [];
const seen = new Set();
for (const m of prose.matchAll(/-?\d+(?:\.\d+)?\s*(?:%|per cent|pt|points?)/g)) {
  const num = m[0].match(/-?\d+(?:\.\d+)?/)[0];
  if (seen.has(num)) continue;
  seen.add(num);
  if (!allowed.has(num)) failures.push(`untraceable figure: "${m[0]}"`);
}
// bare years and ordinals ("six of the last seven months") — years checked loosely
for (const m of prose.matchAll(/\b(19|20)\d{2}\b/g)) {
  if (!allowed.has(m[0])) failures.push(`untraceable year: ${m[0]}`);
}

// ---------- claim verification ----------
// Zero-number comparison claims ("climbed every month since September",
// "halved in a year", "six of the last seven months in deflation") carry no
// figure for the numeric pass to catch, so they are checked arithmetically
// against the baked series here. Conservative: only reject when a claim is
// resolvable AND clearly false; anything ambiguous is left to the critic.

const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", DOSSIER.currentBundle + ".json"), "utf8"));
const monthly = bundle.meta.frequency === "monthly";
const lagN = yearLag(bundle.meta.frequency);   // same year-ago rule as facts.mjs
const bands = DOSSIER.bands ?? null;
const MNF = MONTHS_FULL;
const dates = bundle.dates;
const periodIndex = makePeriodIndex(dates, bundle.meta.frequency, DOSSIER.calendar ?? "fiscal-apr");

const SERIES_KWS = {
  cpi: [["headline", "headline"], ["inflation", "headline"], ["food", "food_and_beverages"], ["beverages", "food_and_beverages"], ["transport", "transport"], ["restaurants", "restaurants_and_accommodation_services"], ["hotels", "restaurants_and_accommodation_services"], ["personal care", "personal_care_social_protection_and_miscellaneous_goods_and_services"], ["gold", "personal_care_social_protection_and_miscellaneous_goods_and_services"], ["education", "education_services"], ["health", "health"], ["housing", "housing_water_electricity_gas_and_other_fuels"]],
  gdp: [["gva", "gva"], ["consumption", "pfce"], ["pfce", "pfce"], ["investment", "gfcf"], ["gfcf", "gfcf"], ["capex", "gfcf"], ["gdp", "gdp"], ["growth", "gdp"]],
  wpi: [["headline", "headline"], ["wholesale", "headline"], ["inflation", "headline"], ["primary", "primary"], ["fuel", "fuel"], ["manufactured", "manufactured"], ["food", "food_index"]],
  iip: [["general", "general"], ["headline", "general"], ["industrial", "general"], ["manufacturing", "sector_manufacturing"], ["capital", "use_capital_goods"], ["mining", "sector_mining_quarrying"], ["electricity", "sector_electricity_gas_supply"]],
  jobs: [["unemployment", "ur"], ["headline", "ur"], ["participation", "lfpr"], ["worker", "wpr"]],
  consumption: [["mpce", "rural"], ["spending", "rural"], ["consumption", "rural"], ["gini", "rural"]],
  factories: [["factories", "factories_in_operation"], ["gva", "gva"], ["output", "total_output"], ["emoluments", "emoluments"]],
}[slug];
// A dossier with no keyword map gets claim-checking SKIPPED (warned), never
// silently verified against an arbitrary series — the old fallback to
// bundle.series[0] produced false passes for any new dossier.
const claimCheck = Boolean(SERIES_KWS);
if (!claimCheck) console.warn(`verify: no series-keyword map for "${slug}" — arithmetic claim-checking skipped (numeric pass above still ran)`);
function resolveSeries(sentence) {
  const s = sentence.toLowerCase();
  for (const [kw, key] of SERIES_KWS) if (new RegExp("\\b" + kw + "\\b").test(s)) return key;
  return null;
}

const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
const numWord = (w) => NUMW[String(w).toLowerCase()] ?? (Number.isFinite(+w) ? +w : null);
const NW = String.raw`(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)`;
const UPV = String.raw`(?:rose|climbed|gained|increased|risen)`;
const DNV = String.raw`(?:fell|eased|declined|dropped|slipped|decreased|fallen|cooled)`;
const PER = String.raw`([A-Z][A-Za-z]+\.?\s+\d{4}|Q[1-4]\s*FY\s?\d{2})`;
const dirOf = (v) => (new RegExp("^" + UPV + "$", "i").test(v) ? 1 : -1);

function resolvePeriod(str) {
  let i = periodIndex(str);
  if (i >= 0) return i;
  if (!monthly) return -1;
  const mi = MNF.findIndex((f) => f.startsWith(str.trim().replace(/\./g, "").toLowerCase().slice(0, 3)));
  if (mi < 0) return -1;
  return dates.indexOf(`${dates.at(-1).slice(0, 4)}-${String(mi + 1).padStart(2, "0")}-01`);
}

// resolve an anchored period ("in March 2025", "ending March", "since Q2 FY26").
// returns index, or null (no anchor present), or -1 (anchor present, unresolvable)
function findAnchor(text, preps) {
  let a = text.match(new RegExp(`\\b(?:${preps})\\s+${PER}`));
  if (a) { const i = periodIndex(a[1]); return i < 0 ? -1 : i; }
  if (!monthly) return null;
  a = text.match(new RegExp(`\\b(?:${preps})\\s+([A-Z][A-Za-z]{2,})\\b`));
  if (!a) return null;
  const i = resolvePeriod(a[1]);
  return i < 0 ? -1 : i;
}

function predicate(text) {
  const t = text.toLowerCase();
  let m;
  if (/deflation|negative|below zero/.test(t)) return { fn: (v) => v < 0, desc: "deflation/negative" };
  // "the floor"/"the ceiling" mean the dossier's policy band — where one
  // exists. Without a declared band the words resolve to nothing and the
  // claim is left to the critic, never checked against a foreign band.
  if (bands && /below\s+(?:the\s+)?floor/.test(t)) return { fn: (v) => v < bands.floor, desc: "below the floor" };
  if (bands && /above\s+(?:the\s+)?ceiling/.test(t)) return { fn: (v) => v > bands.ceiling, desc: "above the ceiling" };
  if ((m = t.match(/below\s+(?:the\s+)?(\d+(?:\.\d+)?)/))) return { fn: (v) => v < +m[1], desc: "below " + m[1] };
  if ((m = t.match(/above\s+(?:the\s+)?(\d+(?:\.\d+)?)/))) return { fn: (v) => v > +m[1], desc: "above " + m[1] };
  if (/rise|increase|gain|growth/.test(t)) return { fn: (v, i, arr) => i > 0 && v > arr[i - 1], desc: "rising" };
  if (/fall|decline|drop|easing|cooling/.test(t)) return { fn: (v, i, arr) => i > 0 && v < arr[i - 1], desc: "falling" };
  return null;
}
// A conservative predicate for streak counts that have no explicit "of <predicate>"
// clause. It reads only a direction VERB next to the count (firmed, eased) — never a
// level threshold ("above 4%") lifted from a different clause of the same sentence,
// which would conflate "firmed for five months, now above 4%" into a false claim.
function clausePredicate(text) {
  const t = text.toLowerCase();
  if (/deflation|negative|below zero/.test(t)) return { fn: (v) => v < 0, desc: "deflation/negative" };
  if (/\b(rose|climbed|climbs|climbing|gained|increased|risen|firm|firmed|firms|firming|accelerat)/.test(t)) return { fn: (v, i, arr) => i > 0 && v > arr[i - 1], desc: "rising" };
  if (/\b(fell|eased|declined|dropped|slipped|decreased|fallen|cooled|slowed|decelerat)/.test(t)) return { fn: (v, i, arr) => i > 0 && v < arr[i - 1], desc: "falling" };
  return null;
}

const sentences = prose.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const claimFail = (msg, s) => failures.push(`${msg} — in: "${s.slice(0, 90)}…"`);

for (const s of sentences) {
  if (!claimCheck) break;
  const key = resolveSeries(s);
  if (!key) continue;   // no keyword matched — the claim is left to the critic
  const arr = bundle.series[key].data;

  // 1. strict monotonic: "<verb> every/each <unit> (since <period>)"
  for (const m of s.matchAll(new RegExp(`\\b(${UPV}|${DNV})\\b[^.;]*?\\b(?:every|each)\\s+(?:month|quarter|print)\\b(?:\\s+since\\s+([A-Z][A-Za-z]+\\.?(?:\\s+\\d{4})?|Q[1-4]\\s*FY\\s?\\d{2}))?`, "gi"))) {
    const dir = dirOf(m[1]);
    if (m[2]) {
      const idx = resolvePeriod(m[2]);
      if (idx < 0) continue;
      for (let i = idx + 1; i < arr.length; i++) {
        if ((arr[i] - arr[i - 1]) * dir <= 0) {
          claimFail(`false streak claim: ${key} did not move ${dir > 0 ? "up" : "down"} every step since ${m[2]} (${arr[i - 1]} → ${arr[i]})`, s);
          break;
        }
      }
    } else {
      let run = 0, rdir = 0;
      for (let i = arr.length - 1; i > 0; i--) {
        const d = arr[i] - arr[i - 1];
        if (d === 0) break;
        const sd = d > 0 ? 1 : -1;
        if (!rdir) { rdir = sd; run = 1; } else if (sd === rdir) run++; else break;
      }
      if (rdir !== dir || run < 3) claimFail(`false streak claim: ${key} has no ${dir > 0 ? "up" : "down"} run of 3+ trailing prints (run: ${run} ${rdir > 0 ? "up" : rdir < 0 ? "down" : "flat"})`, s);
    }
  }

  // 2. net move: "<verb> through the year / through <year>" (monthly only)
  for (const m of s.matchAll(new RegExp(`\\b(${UPV}|${DNV})\\b[^.;]*?\\bthrough\\s+(?:the\\s+year|(20\\d{2}))\\b`, "gi"))) {
    if (!monthly) continue;
    const year = m[2] ?? dates.at(-1).slice(0, 4);
    const i0 = dates.findIndex((d) => d.startsWith(year));
    if (i0 < 0) continue;
    const net = arr.at(-1) - arr[i0];
    if (net * dirOf(m[1]) <= 0) claimFail(`false net-move claim: ${key} moved ${arr[i0]} → ${arr.at(-1)} over ${year}, not ${dirOf(m[1]) > 0 ? "up" : "down"}`, s);
  }

  // 3. "<n> straight/consecutive <units> of <predicate>", optional anchor period;
  //    predicate may also precede ("in deflation for nine straight months")
  for (const m of s.matchAll(new RegExp(`\\b(${NW})\\s+(?:straight|consecutive)\\s+(?:months|quarters|prints)(?:\\s+of\\s+([a-z][a-z\\s-]{2,40}))?`, "gi"))) {
    const n = numWord(m[1]);
    // explicit "of <predicate>" clause → full predicate; else only a direction
    // verb co-occurring with the count, never a level threshold from another clause
    const pred = m[2] ? predicate(m[2]) : clausePredicate(s);
    if (n == null || !pred) continue;
    const ai = findAnchor(s.slice(m.index), "in|until|through|by|ending(?:\\s+in)?");
    if (ai === -1) continue;
    // an anchored claim can mean "the run ended at the anchor" or, with verbs
    // like "emerged from", "the anchor was the first print after the run"
    const ends = ai == null ? [arr.length - 1] : [ai, ai - 1];
    let ok = false;
    for (const end of ends) {
      let actual = 0;
      for (let i = end; i >= 0 && pred.fn(arr[i], i, arr); i--) actual++;
      if (actual === n) { ok = true; break; }
    }
    if (!ok) {
      let actual = 0;
      for (let i = ends[0]; i >= 0 && pred.fn(arr[i], i, arr); i--) actual++;
      claimFail(`false streak count: "${n} straight … of ${pred.desc}" for ${key} — actual run is ${actual}`, s);
    }
  }

  // 4. "<k> of the last <n> <units>" + predicate somewhere in the sentence
  for (const m of s.matchAll(new RegExp(`\\b(${NW})\\s+of\\s+the\\s+last\\s+(${NW})\\s+(?:months|quarters|prints)\\b`, "gi"))) {
    const k = numWord(m[1]), n = numWord(m[2]);
    const pred = predicate(s);
    if (k == null || n == null || !pred || n > arr.length) continue;
    const actual = arr.slice(-n).filter((v, j) => pred.fn(v, arr.length - n + j, arr)).length;
    if (actual !== k) claimFail(`false count claim: "${k} of the last ${n}" for ${key} (${pred.desc}) — actual is ${actual}`, s);
  }

  // 5. ratio words: halved / doubled / tripled / quadrupled
  for (const m of s.matchAll(/\b(more than |nearly |almost )?(halved|doubled|tripled|quadrupled)\b/gi)) {
    const ai = findAnchor(s, "since|from");
    if (ai === -1) continue;
    const baseIdx = ai ?? arr.length - 1 - lagN;
    if (baseIdx < 0 || baseIdx >= arr.length - 1) continue;
    const base = arr[baseIdx], latest = arr.at(-1);
    if (base === 0) continue;
    let r = latest / base;
    if (base < 0 && latest < 0) r = Math.abs(r);
    const want = { halved: 0.5, doubled: 2, tripled: 3, quadrupled: 4 }[m[2].toLowerCase()];
    const mod = (m[1] ?? "").toLowerCase().trim();
    const tol = want * 0.2;
    let ok = Math.abs(r - want) <= tol;
    if (mod === "more than") ok = want < 1 ? r <= want + tol : r >= want - tol;
    if (mod === "nearly" || mod === "almost") ok = want < 1 ? r >= want - tol * 2 && r <= want + tol * 0.5 : r >= want - tol * 2;
    if (!ok) claimFail(`false ratio claim: "${m[0]}" for ${key} — ${base} → ${latest} is a ratio of ${r.toFixed(2)}`, s);
  }
}


if (failures.length) {
  console.error("REJECT — numeric verification failed:");
  failures.forEach((f) => console.error("  -", f));
  process.exit(1);
}
console.log(`verify: all ${seen.size} figures in ${path.basename(file)} trace to the facts sheet`);
