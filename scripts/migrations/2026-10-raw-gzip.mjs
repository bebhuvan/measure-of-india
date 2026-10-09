#!/usr/bin/env node
// scripts/migrations/2026-10-raw-gzip.mjs: store data/raw dumps gzipped (round 4, framework).
// One-off and idempotent. Every data/raw/**/*.json (vintages included) becomes <name>.json.gz,
// the SAME bytes gzipped deterministically (scripts/lib/util.mjs gzipRaw), checked by
// decompressing before the plain file is removed. Left plain on purpose: the archive indexes
// (data/raw/<family>-index.json, read as text and compared byte for byte by their writers) and
// the git-ignored http-cache. Raw dumps over 25 MB after compression would move to the deep
// archive's staging with an index left here (docs/PLAN-launch.md §2b); on 2026-10-10 none is
// (the largest is 3.3 MB compressed), so this migration only reports them.
//   node scripts/migrations/2026-10-raw-gzip.mjs [--dry-run]
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { gzipRaw } from "../lib/util.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW = path.join(ROOT, "data/raw");
const DRY = process.argv.includes("--dry-run");
const MOVE_OVER = 25e6;
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "http-cache") walk(p); }
    else if (e.name.endsWith(".json") && !/-index\.json$/.test(e.name)) files.push(p);
  }
})(RAW);

let before = 0, after = 0, done = 0, skipped = 0;
const big = [];
for (const f of files.sort()) {
  const buf = fs.readFileSync(f);
  const gz = f + ".gz";
  const out = gzipRaw(buf);
  if (!zlib.gunzipSync(out).equals(buf)) throw new Error(`gzip round trip changed ${f}`);
  if (fs.existsSync(gz)) {
    // a re-run, or both forms present: the gzip must hold exactly these bytes
    if (!zlib.gunzipSync(fs.readFileSync(gz)).equals(buf)) throw new Error(`${path.relative(ROOT, gz)} exists and differs from ${path.relative(ROOT, f)}; resolve by hand`);
    skipped++;
  }
  before += buf.length; after += out.length;
  if (out.length > MOVE_OVER) big.push(`${path.relative(ROOT, f)} (${(out.length / 1e6).toFixed(1)} MB compressed)`);
  if (!DRY) { fs.writeFileSync(gz + ".tmp", out); fs.renameSync(gz + ".tmp", gz); fs.rmSync(f); }
  done++;
}
console.log(`raw gzip: ${done} dumps${DRY ? " (dry run)" : ""}, ${(before / 1e6).toFixed(1)} MB -> ${(after / 1e6).toFixed(1)} MB${skipped ? `; ${skipped} already had an identical .gz` : ""}`);
console.log(big.length ? `over ${MOVE_OVER / 1e6} MB compressed, to move to the archive staging: ${big.join(", ")}` : `none over ${MOVE_OVER / 1e6} MB compressed: nothing moves to the archive staging`);
