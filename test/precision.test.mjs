// the precision rule (pipeline/lib/precision.mjs, src/dossiers/precision.js): one rule for
// the prose gate and the pages
import test from "node:test";
import assert from "node:assert/strict";
import { overPrecise, ratePrecision } from "../pipeline/lib/precision.mjs";
import { roundRates, round, numWord } from "../src/dossiers/precision.js";

test("rates are written at the agency's precision", () => {
  assert.equal(ratePrecision("gdp"), 1);
  assert.equal(ratePrecision("wpi"), 2);
  assert.equal(overPrecise("GDP grew 7.8%, up 0.8 points.", "gdp").length, 0);
  assert.equal(overPrecise("GDP grew 7.82%.", "gdp").length, 1);
  assert.equal(overPrecise("Wholesale inflation was 9.92%.", "wpi").length, 0);
  // a move that would round to zero keeps its extra decimal
  assert.equal(overPrecise("The ratio narrowed 0.04 points.", "states").length, 0);
});

test("counts and money in readable units", () => {
  assert.equal(overPrecise("UPI carried about 2,366 crore payments.", "payments").length, 0);
  assert.equal(overPrecise("UPI carried 2,365.84 crore payments.", "payments").length, 1);
  assert.equal(overPrecise("Output was ₹153.3 lakh crore.", "factories").length, 0);
  assert.equal(overPrecise("Assets were ₹29.88 lakh crore.", "markets").length, 1);
});

test("pages round rate series once, and leave levels alone", () => {
  const b = { meta: {}, dates: ["2026-01-01", "2026-02-01"], series: {
    yoy: { label: "Headline", unit: "pct_yoy", data: [4.45, 4.82] },
    idx: { label: "Index", unit: "index", data: [102.345, 103.456] },
  } };
  const r = roundRates(b);
  assert.deepEqual(r.series.yoy.data, [4.5, 4.8]);
  assert.deepEqual(r.series.idx.data, [102.345, 103.456]);
  assert.equal(round(-8.45, 1), -8.5);
  assert.equal(b.series.yoy.data[0], 4.45, "the bundle itself is not mutated");
});

test("counts in running prose read as words", () => {
  assert.equal(numWord(0), "none");
  assert.equal(numWord(24, true), "Twenty-four");
  assert.equal(numWord(13, true), "Thirteen");
});
