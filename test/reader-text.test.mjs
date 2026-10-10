// test/reader-text.test.mjs: internal names never reach reader text (scripts/lib/reader-text.mjs;
// the same check runs in scripts/qc.mjs). Datafix, 2026-10-10.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readerTextProblems, allReaderTextProblems } from "../scripts/lib/reader-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("the rules catch the leaks the read-through found, and pass plain titles", () => {
  const b = (coverage, label = "Rural, women") => ({ meta: { coverage }, series: { k: { label } } });
  assert.equal(readerTextProblems("x", b("States; Food share. Keys <state>_<sector> are the Food Total share")).length > 0, true);
  assert.equal(readerTextProblems("x", b("Ailments: every state and UT, at the headline of sector, gender, age_group")).length, 1);
  assert.equal(readerTextProblems("x", b("India: OWID dataset surface_temperature_annual_average (2 series)")).length, 1);
  assert.equal(readerTextProblems("x", b("Opinions", "failed_care_planet")).length, 1);
  assert.equal(readerTextProblems("x", b("Opinions", "`Other' deposits with RBI")).length, 1);
  assert.deepEqual(readerTextProblems("x", b("Estimated Value of Key Characteristics by Number of Workers: every published row")), []);
  assert.deepEqual(readerTextProblems("x", b("States/UTs × rural/urban; percentage share of MPCE, without imputation.")), []);
});

test("no bundle carries internal names in its title or labels", () => {
  const probs = allReaderTextProblems(ROOT);
  assert.deepEqual(probs.slice(0, 10), [], `${probs.length} problem(s)`);
});
