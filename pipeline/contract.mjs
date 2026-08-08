#!/usr/bin/env node
// pipeline/contract.mjs — mechanical slot-contract enforcement. The prompt
// asks; this script decides. Checks, for the slot named:
//  1. sentence count <= maxSentences
//  2. every requiredFigure (a path into the facts sheet, e.g. "headline.latest")
//     appears in the prose in a voice-legal rendering (1dp, 2dp, |abs|, integer)
//  3. dateStamp slots name the latest period (month name or quarter label)
// Usage: node pipeline/contract.mjs <prose-file> <slug> <slot-id>

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

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
    } else {
      ok = new RegExp(`\\b${lp.replace(/\s+/g, "\\s+")}\\b`).test(prose)
        || (new RegExp(`\\b${lp.split(" ")[0]}\\b`).test(prose) && prose.includes(lp.split(" ")[1]));
    }
  }
  if (!ok) fail(`dateStamp slot does not name its period (${lp})`);
}

if (failures.length) {
  console.error(`REJECT — contract failures in ${path.basename(file)} [${slotId}]:`);
  failures.forEach((f) => console.error("  -", f));
  process.exit(1);
}
console.log(`contract: ${slotId} ok (${sentences.length}/${slot.maxSentences} sentences)`);
