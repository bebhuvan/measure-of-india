#!/usr/bin/env node
// scripts/kit-specimen-lint.mjs: every form in the chart-kit specimen (design-mocks/chartkit),
// drawn from its real-data fixtures at the three figure widths and run through lint-kit.
// The kit's own regression test: node scripts/kit-specimen-lint.mjs   (exit 1 on finds)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { lintSVG } from "./lint-kit.mjs";
import { WIDTHS } from "../src/kit/figure.js";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "design-mocks/chartkit");
let src = fs.readFileSync(path.join(dir, "specimen.js"), "utf8");
src = src.replace(/import \* as K from '\.\/kit\.js';/, `import * as K from ${JSON.stringify(pathToFileURL(path.join(ROOT, "src/kit/kit.js")).href)};`)
  .replace(/const F = await \(await fetch\('fixtures\.json'\)\)\.json\(\);/, `const F = ${fs.readFileSync(path.join(dir, "fixtures.json"), "utf8")};`);
src = src.slice(0, src.indexOf("// ---- figures row")) + "\nexport { CARDS };\n";
const tmp = path.join(ROOT, "node_modules/.cache/kit-specimen.mjs");
fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, src);
const { CARDS } = await import(pathToFileURL(tmp).href);
let bad = 0;
for (const c of CARDS) for (const [k, w] of Object.entries(WIDTHS)) {
  for (const f of lintSVG(c.draw(w))) { bad++; console.log(`${c.form} (${k} ${w}): ${f}`); }
}
console.log(`kit-specimen-lint: ${CARDS.length} forms x 3 widths, ${bad} finds`);
process.exit(bad ? 1 : 0);
