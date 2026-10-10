#!/usr/bin/env node
// pipeline/contract.mjs — mechanical slot-contract enforcement. The prompt
// asks; this script decides. Checks, for the slot named:
//  1. sentence count <= maxSentences
//  2. every requiredFigure (a path into the facts sheet, e.g. "headline.latest")
//     appears in the prose in a voice-legal rendering (1dp, 2dp, |abs|, integer)
//  3. dateStamp slots name the latest period (month name or quarter label)
//  4. coverage floors (slots.yml): minSeriesMentioned, mustName extremes,
//     mustAcknowledge contradictions — a print that stays silent about most
//     of the sheet, or about the series that contradict its story, fails here
// Usage: node pipeline/contract.mjs <prose-file> <slug> <slot-id>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { SERIES_KWS } from "./lib/series-kws.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [file, slug, slotId] = process.argv.slice(2);
if (!file || !slug || !slotId) {
  console.error("usage: node pipeline/contract.mjs <prose-file> <slug> <slot-id>");
  process.exit(1);
}

const facts = JSON.parse(fs.readFileSync(path.join(ROOT, "pipeline/out", `facts-${slug}.json`), "utf8"));
const slots = YAML.parse(fs.readFileSync(path.join(ROOT, "pipeline/slots.yml"), "utf8"))[slug];
const slot = slots.find((s) => s.id === slotId);
if (!slot) { console.error(`contract: no slot "${slotId}" in slots.yml for ${slug}`); process.exit(1); }
const prose = fs.readFileSync(file, "utf8");

const failures = [];
const fail = (m) => failures.push(m);

// 1. sentence count
const sentences = prose.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
if (sentences.length > slot.maxSentences) {
  fail(`sentence count ${sentences.length} exceeds maxSentences ${slot.maxSentences}`);
}

// 2. required figures
function resolvePath(p) {
  const parts = p.split(".");
  let node = facts.series[parts[0]] ?? facts;
  for (const part of node === facts ? parts : parts.slice(1)) {
    if (node == null) return undefined;
    node = node[part];
  }
  return node;
}
const numRendered = (v) => {
  const r = [v.toFixed(2), v.toFixed(1), Math.abs(v).toFixed(2), Math.abs(v).toFixed(1)];
  if (Number.isInteger(v)) r.push(String(v));
  // the precision rule (pipeline/lib/precision.mjs) writes a figure of a hundred or more
  // whole when it carries a scale word ("about 2,366 crore", never "2,365.84 crore")
  if (Math.abs(v) >= 100) { const w = Math.round(Math.abs(v)); r.push(String(w), w.toLocaleString("en-IN"), w.toLocaleString("en-US")); }
  // the dossiers render rupee/large figures Indian thousand-grouped (₹4,122;
  // 2,60,061) via toLocaleString("en-IN"), so accept those forms too
  r.push(v.toLocaleString("en-IN"), Math.abs(v).toLocaleString("en-IN"));
  return r;
};
const present = (v) => numRendered(v).some((r) => new RegExp(`(?<![\\d.])${r.replace(".", "\\.")}(?![\\d])`).test(prose));
for (const fig of slot.requiredFigures ?? []) {
  const v = resolvePath(fig);
  if (v == null) { fail(`requiredFigure "${fig}" not found in facts sheet`); continue; }
  if (typeof v === "number") {
    if (!present(v)) fail(`required figure "${fig}" (${v}) missing from prose`);
  } else if (Array.isArray(v)) {
    // a sequence figure (e.g. gdp.last4): the latest element must appear, plus
    // at least one more — a "sequence" of one number is not a sequence
    const hits = v.filter((x) => typeof x === "number" && present(x)).length;
    if (!present(v.at(-1))) fail(`required figure "${fig}": latest element (${v.at(-1)}) missing from prose`);
    else if (hits < 2) fail(`required figure "${fig}": only ${hits} of ${v.length} sequence values appear`);
  } else if (typeof v === "object" && typeof v.value === "number") {
    if (!present(v.value)) fail(`required figure "${fig}" (${v.value}) missing from prose`);
  }
}

// 3. date stamp: the period must be named
if (slot.dateStamp) {
  const lp = facts.latestPeriod; // "Dec 2025" or "Q2 FY26"
  const MNF = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
  const m = lp.match(/^([A-Z][a-z]{2}) (\d{4})$/);
  let ok;
  if (m) {
    ok = new RegExp(`\\b(${m[1]}|${MNF[m[1]]})\\b`).test(prose);
  } else {
    const qm = lp.match(/^Q([1-4])\s*FY\s?(\d{2})$/);
    if (qm) {
      // a dated quarterly slot may anchor on the label, the FY, the year, or the
      // ordinal — the as-of corpus style names quarters as a sequence, not a tag
      const ord = ["", "first", "second", "third", "fourth"][+qm[1]];
      const year = "20" + qm[2];
      ok = new RegExp(`\\bQ${qm[1]}\\b`).test(prose)
        || new RegExp(`\\bFY\\s*${qm[2]}\\b`, "i").test(prose)
        || new RegExp(`\\b${year}\\b`).test(prose)
        || new RegExp(`\\b${ord}\\s+quarter\\b`, "i").test(prose);
    } else if (/^FY(\d{2})$/.test(lp)) {
      // an annual fiscal label: "FY24" or the same year written out, "2023-24" (survey
      // rounds and annual returns are named that way; households wave 2, 2026-10-10)
      const yy = +lp.slice(2), y0 = 2000 + yy - 1;
      ok = new RegExp(`\\b${lp}\\b`).test(prose) || new RegExp(`\\b${y0}[-–]${String(yy).padStart(2, "0")}\\b`).test(prose);
    } else {
      ok = new RegExp(`\\b${lp.replace(/\s+/g, "\\s+")}\\b`).test(prose)
        || (new RegExp(`\\b${lp.split(" ")[0]}\\b`).test(prose) && prose.includes(lp.split(" ")[1]));
    }
  }
  if (!ok) fail(`dateStamp slot does not name its period (${lp})`);
}

// 4. coverage floors: omission is a defect, not a style choice
const kws = SERIES_KWS[slug];
const keyNamed = (key) => {
  if (!kws) return false;
  // named by any of the key's words, or by its extreme/latest value rendered
  // the way the voice renders numbers (citing the number IS naming it)
  const words = kws.filter(([, k]) => k === key).some(([kw]) => new RegExp("\\b" + kw.replace(/ /g, "\\s+") + "\\b", "i").test(prose));
  if (words) return true;
  const s = facts.series[key];
  if (!s) return false;
  return (s.latest?.value != null && present(s.latest.value)) || (typeof s.latest === "number" && present(s.latest));
};
if (slot.minSeriesMentioned != null || slot.mustName || slot.mustAcknowledge) {
  if (!kws) fail("coverage floor declared but pipeline/lib/series-kws.mjs has no keyword map for this dossier");
  else {
    if (slot.minSeriesMentioned != null) {
      const keys = [...new Set(kws.map(([, k]) => k))];
      const mentioned = keys.filter(keyNamed);
      if (mentioned.length < slot.minSeriesMentioned) {
        const silent = keys.filter((k) => !mentioned.includes(k));
        fail(`coverage floor: ${mentioned.length} sheet series named, floor is ${slot.minSeriesMentioned} — silent on: ${silent.join(", ")}`);
      }
    }
    if (slot.mustName?.includes("extremes")) {
      for (const ext of ["topMover", "bottomMover"]) {
        const m = facts.cross?.[ext];
        if (m?.key && !keyNamed(m.key)) fail(`mustName extremes: the ${ext === "topMover" ? "hottest" : "weakest"} mover (${m.label}) is not named`);
      }
    }
    if (slot.mustAcknowledge?.includes("contradictions")) {
      const cons = facts.cross?.contradictions ?? [];
      if (cons.length) {
        const said = cons.some((c) => keyNamed(c.key))
          || /\b(contradict\w*|moving? against|moves? against|against the (headline|print|trend)|pulling (the other way|down|in the opposite direction))\b/i.test(prose);
        if (!said) fail(`mustAcknowledge contradictions: ${cons.length} sheet series move against the headline (${cons.map((c) => c.label).join("; ")}) and none is acknowledged`);
      }
    }
  }
}

if (failures.length) {
  console.error(`REJECT — contract failures in ${path.basename(file)} [${slotId}]:`);
  failures.forEach((f) => console.error("  -", f));
  process.exit(1);
}
console.log(`contract: ${slotId} ok (${sentences.length}/${slot.maxSentences} sentences)`);
