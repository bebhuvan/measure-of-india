// test/copied-runs.test.mjs: util.findCopiedRuns finds a pasted block and only that.
import { test } from "node:test";
import assert from "node:assert/strict";
import { findCopiedRuns, nullCopiedRuns } from "../scripts/lib/util.mjs";

const ramp = (k) => Array.from({ length: 24 }, (_, i) => (i + 1) * k);
const paste = (s, from, to, len) => { const t = [...s]; for (let q = 0; q < len; q++) t[to + q] = s[from + q]; return t; };

test("a block pasted under earlier dates is found, and the pasted block is the copy", () => {
  const S = [1, 3, 7].map(ramp).map((s) => paste(s, 14, 2, 8));
  assert.deepEqual(findCopiedRuns(S), [{ copy: [2, 9], original: [14, 21] }]);
});
test("clean, flat and smooth-high-level series raise nothing", () => {
  assert.deepEqual(findCopiedRuns([1, 3, 7].map(ramp)), []);
  const flat = Array(24).fill(5);
  assert.deepEqual(findCopiedRuns([flat, flat, flat]), []);
  const gsl = Array.from({ length: 40 }, (_, i) => 353 + Math.round(Math.sin(i) * 30) / 100);
  assert.deepEqual(findCopiedRuns([gsl, gsl.map((v) => v + 1), gsl.map((v) => v + 2)]), []);
});
test("nullCopiedRuns blanks the copy and declares the gap", () => {
  const dates = Array.from({ length: 24 }, (_, i) => `${2000 + i}-04-01`);
  const series = Object.fromEntries([1, 3, 7].map((k, j) => [`s${j}`, { data: paste(ramp(k), 14, 2, 8) }]));
  nullCopiedRuns(dates, series, "TEST");
  for (const s of Object.values(series)) {
    assert.ok(s.data.slice(2, 10).every((v) => v === null));
    assert.equal(s.gaps.length, 8);
    assert.match(s.gapsNote, /second time/);
  }
});
