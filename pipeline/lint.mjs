#!/usr/bin/env node
// pipeline/lint.mjs — anti-slop lint, CI-enforced.
//  1. banned phrases (pipeline/banned.txt)
//  2. uniform sentence length (AI cadence): paragraphs of >=4 sentences with
//     low length variance are flagged
//  3. hedge stacking ("may potentially suggest")
//  4. dated words in evergreen slots (--evergreen)
//  5. house punctuation (2026-10): no spaced em dashes, no middle-dot strings
// Usage: node pipeline/lint.mjs <prose-file> [--evergreen]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = process.argv[2];
const evergreen = process.argv.includes("--evergreen");
if (!file) { console.error("usage: node pipeline/lint.mjs <prose-file> [--evergreen]"); process.exit(1); }
const prose = fs.readFileSync(file, "utf8");
let failures = 0;
const fail = (m) => { failures++; console.error("  -", m); };

// 1. banned phrases
const banned = fs.readFileSync(path.join(ROOT, "pipeline/banned.txt"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
for (const phrase of banned) {
  const rx = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\*", "\\w+"), "i");
  const m = prose.match(rx);
  if (m) fail(`banned phrase: "${m[0]}"`);
}

// 2. sentence-length variance per paragraph
const sentences = (p) => p.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
for (const para of prose.split(/\n\s*\n/)) {
  const ss = sentences(para.replace(/\n/g, " "));
  if (ss.length < 4) continue;
  const lens = ss.map((s) => s.split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  if (sd / mean < 0.22 && (mean > 8 || ss.length >= 5)) {
    fail(`uniform sentence length (mean ${mean.toFixed(1)} words, cv ${(sd / mean).toFixed(2)}): "${ss[0].slice(0, 60)}…"`);
  }
}

// 3. hedge stacking
for (const m of prose.matchAll(/\b(may|might|could|can|potentially|possibly|perhaps|likely)\s+(also\s+)?(potentially|possibly|perhaps)?\s*(suggest|indicate|signal|point)\b/gi)) {
  fail(`hedge stacking: "${m[0]}"`);
}

// 4. dated words in evergreen slots
if (evergreen) {
  for (const m of prose.matchAll(/\b(this (month|quarter|year)|the latest|currently|as of|today'?s|this print)\b/gi)) {
    fail(`dated word in evergreen slot: "${m[0]}"`);
  }
}

// 5. house punctuation: the site sets no spaced em dashes and no " · " strings (docs/DESIGN.md §2)
for (const m of prose.matchAll(/.{0,30}( — | · ).{0,30}/g)) fail(`house punctuation (use a colon or commas): "${m[0].trim()}"`);

if (failures) { console.error(`lint: ${failures} failure(s) in ${path.basename(file)}`); process.exit(1); }
console.log(`lint: clean — ${path.basename(file)}${evergreen ? " (evergreen rules)" : ""}`);
