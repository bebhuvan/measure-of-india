// A gate only reads (AGENTS.md "Every file has a gate"): `npm run gates` must leave the tree as it
// found it. On 2026-10-15 validate.mjs rewrote three data/coverage registers, explore-verify.mjs
// wrote into docs/status and a test rewrote pipeline/out. This walks every gate and every local
// module it imports and fails on a filesystem write call. asof.mjs writes only under --refresh,
// the human attestation step, and that branch is the one allowed exception.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const GATES = ["scripts/validate.mjs", "scripts/coverage.mjs", "pipeline/asof.mjs", "scripts/qc.mjs", "scripts/lint-charts.mjs", "scripts/explore-verify.mjs"];
const WRITE = /\b(?:fs\.)?(writeFileSync|appendFileSync|renameSync|rmSync|unlinkSync|mkdirSync|copyFileSync|writeFile|rename)\s*\(/g;
const ALLOWED = { "pipeline/asof.mjs": (src, i) => src.lastIndexOf("--refresh", i) > src.lastIndexOf("\nlet failures", i) };

function localImports(file) {
  const src = fs.readFileSync(file, "utf8"), out = [];
  for (const m of src.matchAll(/(?:import\s[^'"]*?from\s*|import\s*\(\s*|^import\s*)["'](\.{1,2}\/[^"']+)["']/gm)) {
    const target = path.normalize(path.join(path.dirname(file), m[1]));
    if (/\.(m?js)$/.test(target) && fs.existsSync(target)) out.push(target);
  }
  return out;
}

test("gates and the modules they import never write to the tree", () => {
  const seen = new Set(), queue = [...GATES], writes = [];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    const src = fs.readFileSync(f, "utf8");
    // shared libraries (util, catalogue, the MoSPI client) define writers for adapters; what a gate
    // must not do is call one, and the calls live in the gates and their family validators
    if (!GATES.includes(f) && !/validation|verify|evidence|source-quality/.test(f)) { queue.push(...localImports(f)); continue; }
    for (const m of src.matchAll(WRITE)) {
      const line = src.slice(src.lastIndexOf("\n", m.index) + 1, src.indexOf("\n", m.index));
      if (/^\s*(\/\/|\*)/.test(line)) continue;
      if (ALLOWED[f]?.(src, m.index)) continue;
      writes.push(`${f}: ${line.trim().slice(0, 120)}`);
    }
    queue.push(...localImports(f));
  }
  assert.ok(seen.size > GATES.length, "the import walk found the gates' modules");
  assert.deepEqual(writes, []);
});
