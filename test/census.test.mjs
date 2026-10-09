// test/census.test.mjs: census files stay small enough to commit, and a long tail is summarised
// without losing its counts (scripts/census.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

test("committed census files are under 10 MB", () => {
  const tracked = execFileSync("git", ["ls-files", "pipeline/out"], { encoding: "utf8" }).split("\n").filter((f) => /census-.*\.json$/.test(f));
  for (const f of tracked) if (fs.existsSync(f)) assert.ok(fs.statSync(f).size < 10e6, `${f} is ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
});

test("a long-tail bundle is summarised with its tail counts and extremes", () => {
  const f = "pipeline/out/census-wpi.json";
  if (!fs.existsSync(f)) return;
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  const long = c.bundles.filter((b) => b.seriesCount > 150);
  assert.ok(long.length, "wpi has item bundles over 150 series");
  for (const b of long) {
    assert.ok(b.summarised && b.tail, `${b.slug} summarised`);
    assert.ok(b.series.length < b.seriesCount && b.series.length >= 30, `${b.slug} keeps its extremes`);
    assert.equal(b.tail.risingVsYearAgo + b.tail.fallingVsYearAgo <= b.seriesCount, true);
  }
});
