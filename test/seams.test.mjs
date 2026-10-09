// test/seams.test.mjs: the shared seam treatment (src/charts/plumbing.js seamMarks) refuses
// anything that would read as a splice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { seamMarks, seamOverlap, tint } from "../src/charts/plumbing.js";

const d = (y, m, v) => ({ date: new Date(Date.UTC(y, m, 1)), value: v });
const old = { color: "#878D99", data: [d(2024, 0, 1), d(2024, 1, 2), d(2024, 2, 3)] };
const nw = { color: "#2E4BD8", data: [d(2024, 1, 2.5), d(2024, 2, 3.5), d(2024, 3, 4)] };

test("three treatments only, two rulers at least", () => {
  assert.throws(() => seamMarks("splice", [old, nw]), /unknown treatment/);
  assert.throws(() => seamMarks("side", [old]), /two rulers/);
  assert.equal(seamMarks("side", [old, nw], { text: "base revised", y: 4 }).length, 4);   // two lines, rule, label
  assert.equal(seamMarks("side", [old, nw], false).length, 2);
});

test("an agency link must name the agency and mark its reconstructed stretch", () => {
  const linked = { ...nw, reconstructedUntil: new Date(Date.UTC(2024, 2, 1)) };
  assert.throws(() => seamMarks("agency", [old, linked], { text: "live from Mar 2024", y: 4 }), /agency's/);
  assert.throws(() => seamMarks("agency", [old, nw], { text: "NSO back-cast", y: 4 }), /reconstructedUntil/);
  assert.throws(() => seamMarks("overlap", [old, linked], { text: "x", y: 4 }), /only an agency seam/);
  assert.equal(seamMarks("agency", [old, linked], { text: "NSO back-cast to Feb 2024", y: 4 }).length, 5);
});

test("overlap statistics read only the dates both rulers publish", () => {
  const o = seamOverlap(old, nw);
  assert.equal(o.n, 2);
  assert.equal(o.gap, 0.5);
  assert.equal(o.last.b, 3.5);
});

test("reconstructed history is a solid pale tint, not transparency", () => {
  assert.equal(tint("#000000", 0.5), "#808080");
  assert.match(tint("#2E4BD8"), /^#[0-9A-F]{6}$/);
});
