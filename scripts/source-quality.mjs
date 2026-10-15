#!/usr/bin/env node
// scripts/source-quality.mjs: writes the source-quality registers that the family validators
// compute (published discrepancies, identities, withheld cells). validate.mjs recomputes them and
// fails if the committed copy differs; it never writes. Run after rebaking a family.
//   node scripts/source-quality.mjs [households|energy|farm-households ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FAMILIES = {
  households: async () => (await import("./lib/households-validation.mjs")).validateHouseholds(ROOT),
  energy: async () => (await import("./lib/energy-validation.mjs")).validateEnergy(ROOT),
  "farm-households": async () => (await import("./lib/farm-households-validation.mjs")).validateFarmHouseholds(ROOT),
};
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(FAMILIES);
for (const family of wanted) {
  if (!FAMILIES[family]) { console.error(`source-quality: unknown family ${family}`); process.exit(2); }
  const result = await FAMILIES[family]();
  if (result.errors.length) { console.error(`source-quality: ${family} fails validation (${result.errors.length}), e.g. ${result.errors[0]}`); process.exit(1); }
  const file = path.join(ROOT, `data/coverage/${family}.source-quality.json`);
  fs.writeFileSync(file + ".tmp", JSON.stringify(result, null, 1) + "\n");
  fs.renameSync(file + ".tmp", file);
  console.log(`source-quality: ${path.relative(ROOT, file)}`);
}
