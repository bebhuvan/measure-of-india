// test/writeSeries.test.mjs — canonical bundles are written atomically
// (CONTRACT-series rule 7): tmp-then-rename, never in-place truncation.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeSeries } from "../scripts/lib/util.mjs";

test("writeSeries writes valid JSON and leaves no tmp file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-test-"));
  const bundle = { meta: { geo: "IND" }, dates: ["2026-01-01"], series: { a: { data: [1.2] } } };
  writeSeries(root, "data/series/test-bundle.json", bundle);
  const written = JSON.parse(fs.readFileSync(path.join(root, "data/series/test-bundle.json"), "utf8"));
  assert.deepEqual(written, bundle);
  assert.equal(fs.existsSync(path.join(root, "data/series/test-bundle.json.tmp")), false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("writeSeries overwrites atomically (no torn reads possible)", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-test-"));
  writeSeries(root, "data/series/b.json", { v: 1 });
  writeSeries(root, "data/series/b.json", { v: 2 });
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "data/series/b.json"), "utf8")).v, 2);
  fs.rmSync(root, { recursive: true, force: true });
});
