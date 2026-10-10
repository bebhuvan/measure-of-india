// scripts/lib/reader-text.mjs: internal names leaking into reader text (datafix, 2026-10-10).
// A bundle's meta.coverage is the title its every-cut table, links and search print; a series
// label is the row a reader sees. The launch read-through found key formats in titles ("Keys
// <state>_<sector> are the Food Total share"), API field names ("at the headline of age_group"),
// dataset ids ("OWID dataset surface_temperature_annual_average") and labels that were only a
// key ("failed_care_planet"). Notes for whoever reads the JSON belong in meta.note.
// Used by scripts/qc.mjs (the gate) and test/reader-text.test.mjs.
import fs from "node:fs";
import path from "node:path";

const TITLE_RULES = [
  [/<[a-z_]+>/i, "a key template (<state>)"],
  [/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/, "an internal name with underscores (age_group)"],
  [/__/, "a key separator (__)"],
  [/\bkeys? (are|is|read|for)\b|\(keys?\b|\bseries keys?\b/i, "a note about series keys"],
  [/`/, "a backtick"],
  [/\bmeta\.|\.json\b|data\/series/, "a file or field path"],
];
const LABEL_RULES = [
  [/^[a-z0-9]+(?:_[a-z0-9]+)+$/, "a key in place of a label (failed_care_planet)"],
  [/<[a-z_]+>/i, "a key template (<state>)"],
  [/`/, "a backtick"],
];
/** Problems in one bundle's reader text: [{ where, text, why }]. */
export function readerTextProblems(slug, b) {
  const out = [];
  const cov = b.meta?.coverage;
  if (typeof cov === "string") for (const [re, why] of TITLE_RULES) { const m = cov.match(re); if (m) out.push({ where: `${slug} meta.coverage`, text: m[0], why }); }
  for (const [k, s] of Object.entries(b.series ?? {})) {
    for (const [re, why] of LABEL_RULES) { const m = String(s.label ?? "").match(re); if (m) out.push({ where: `${slug} ${k} label`, text: m[0], why }); }
  }
  return out;
}
/** Every bundle under root/data/series. */
export function allReaderTextProblems(root) {
  const out = [];
  for (const f of fs.readdirSync(path.join(root, "data/series")).filter((f) => f.endsWith(".json")).sort())
    out.push(...readerTextProblems(f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(root, "data/series", f), "utf8"))));
  return out;
}
