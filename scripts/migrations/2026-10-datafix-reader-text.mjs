// One-off migration (datafix, 2026-10-10): reader text in bundles whose adapters only bake from
// the network. The adapters now write titles and labels in words (owid-climate.mjs datasetWords
// and labelWords; nas.mjs the accounts coverage); this applies the same functions to the bundles
// already baked, so the fix shows without a refetch. It touches meta.coverage and series labels
// only, never a value. Idempotent. Run: node scripts/migrations/2026-10-datafix-reader-text.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeSeries } from "../lib/util.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
process.argv[1] = "";   // owid-climate.mjs runs a CLI when it is the script
const { datasetWords, labelWords } = await import("../lib/products/owid-climate.mjs");
let n = 0;
for (const f of fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json")).sort()) {
  const rel = `data/series/${f}`;
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  const before = JSON.stringify(b);
  const m = b.meta ?? {};
  // OWID climate indicators: "India: OWID dataset <id> (n series), ..." -> the dataset in words
  if (/^owid:/.test(m.product ?? "")) {
    m.coverage = m.coverage.replace(/^India: OWID dataset ([a-z0-9_]+) \(/, (all, ds) => `India: ${datasetWords(ds)}, Our World in Data (`);
    for (const s of Object.values(b.series)) s.label = labelWords(s.label);
  }
  // the national accounts: a series key in the title
  if (m.dossier === "gdp" && /saving_rate is/.test(m.coverage ?? ""))
    m.coverage = m.coverage.replace("saving_rate is gross saving over nominal GDP — saving", "The gross saving rate is gross saving over nominal GDP: saving");
  if (JSON.stringify(b) !== before) { writeSeries(ROOT, rel, b); n++; }
}
console.log(`reader text: ${n} bundle(s) rewritten`);
