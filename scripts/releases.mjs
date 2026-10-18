// scripts/releases.mjs: append each guide's new print to the release log (data/releases.json),
// which the releases feeds read (src/seo/releases.js). Run after fetch and validate, before the
// build; the update workflow commits the log with the release PR. Idempotent: a print already
// logged is left as it was first recorded, so a revision never rewrites history.
//   node scripts/releases.mjs            append new prints (recorded = today, UTC)
//   node scripts/releases.mjs --check    exit 1 if a current print is missing from the log
import fs from "node:fs";
import { LOG, readLog, currentPrints } from "../src/seo/releases.js";

const today = new Date().toISOString().slice(0, 10);
const log = readLog();
const have = new Set(log.map((e) => `${e.guide}\u0000${e.period}`));
const fresh = currentPrints().filter((c) => !have.has(`${c.guide}\u0000${c.period}`));
if (process.argv.includes("--check")) {
  if (fresh.length) { console.error(`releases: ${fresh.length} current prints are not in data/releases.json (run node scripts/releases.mjs): ${fresh.map((c) => `${c.guide} ${c.period}`).join(", ")}`); process.exit(1); }
  console.log(`releases: all ${currentPrints().length} current prints logged`);
  process.exit(0);
}
// the first run seeds the log, dating each print by its release or vintage; later runs date a new
// print by the day it was first seen
const seed = !fs.existsSync(LOG);
const add = fresh.map((c) => ({ ...c, recorded: seed ? c.recorded : today }));
const prints = [...log, ...add].sort((a, b) => a.guide.localeCompare(b.guide) || String(a.asOf).localeCompare(String(b.asOf)));
const tmp = LOG + ".tmp";
fs.writeFileSync(tmp, JSON.stringify({ about: "One entry per print of each guide's headline figure, as first published on the site. Appended by scripts/releases.mjs; never edit by hand.", prints }, null, 1) + "\n");
fs.renameSync(tmp, LOG);
console.log(`releases: ${add.length} new ${add.length === 1 ? "print" : "prints"} logged${add.length ? ": " + add.map((c) => `${c.guide} ${c.period}`).join(", ") : ""}`);
