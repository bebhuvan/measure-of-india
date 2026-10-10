// test/facts-committed.test.mjs: every guide with dated prose has its facts sheet committed.
// qc's coverage contract reads pipeline/out/facts-<slug>.json; a branch that generated it but
// never committed it passes locally and fails on a clean checkout (found merging banks,
// 2026-10-10).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { DOSSIERS } from "../src/dossiers/registry.js";

test("every prose guide's facts sheet is tracked by git", () => {
  const tracked = new Set(execFileSync("git", ["ls-files", "pipeline/out"], { encoding: "utf8" }).split("\n"));
  for (const d of DOSSIERS.filter((d) => d.prose)) assert.ok(tracked.has(`pipeline/out/facts-${d.slug}.json`), `${d.slug}: pipeline/out/facts-${d.slug}.json is not committed (run npm run facts and commit it)`);
});
