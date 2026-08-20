// test/periods.test.mjs — the calendar semantics every dossier family relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makePeriodLabel, makePeriodIndex, yearLag } from "../pipeline/lib/periods.mjs";

test("fiscal-apr annual labels are FY-ending years", () => {
  const label = makePeriodLabel("annual", "fiscal-apr");
  assert.equal(label("2023-01-01"), "FY24");   // ASI/HCES round dated 2023 is FY 2023-24
});

test("calendar annual labels are bare years (World Bank/OWID)", () => {
  const label = makePeriodLabel("annual", "calendar");
  assert.equal(label("2023-01-01"), "2023");   // never "FY24" for a WDI series
});

test("fiscal-apr quarterly labels map Apr–Jun to Q1", () => {
  const label = makePeriodLabel("quarterly", "fiscal-apr");
  assert.equal(label("2026-04-01"), "Q1 FY27");
  assert.equal(label("2026-01-01"), "Q4 FY26");
});

test("calendar quarterly labels map Jan–Mar to Q1", () => {
  const label = makePeriodLabel("quarterly", "calendar");
  assert.equal(label("2026-01-01"), "Q1 2026");
  assert.equal(label("2026-10-01"), "Q4 2026");
});

test("monthly labels are calendar months in both calendars", () => {
  assert.equal(makePeriodLabel("monthly", "fiscal-apr")("2026-07-01"), "Jul 2026");
  assert.equal(makePeriodLabel("monthly", "calendar")("2026-07-01"), "Jul 2026");
});

test("periodIndex resolves fiscal and calendar quarter references", () => {
  const dates = ["2025-04-01", "2025-07-01", "2025-10-01", "2026-01-01"];
  const fiscalIdx = makePeriodIndex(dates, "quarterly", "fiscal-apr");
  assert.equal(fiscalIdx("Q1 FY26"), 0);
  assert.equal(fiscalIdx("Q4 FY26"), 3);
  const calIdx = makePeriodIndex(dates, "quarterly", "calendar");
  assert.equal(calIdx("Q2 2025"), 0);
  assert.equal(calIdx("Q1 2026"), 3);
});

test("periodIndex resolves bare years on a calendar annual axis", () => {
  const dates = ["2022-01-01", "2023-01-01", "2024-01-01"];
  assert.equal(makePeriodIndex(dates, "annual", "calendar")("2024"), 2);
  // a fiscal annual axis is never addressed by bare calendar years
  assert.equal(makePeriodIndex(dates, "annual", "fiscal-apr")("2024"), -1);
});

test("periodIndex resolves month names case-insensitively-ish (prefix match)", () => {
  const dates = ["2026-05-01", "2026-06-01", "2026-07-01"];
  const idx = makePeriodIndex(dates, "monthly", "fiscal-apr");
  assert.equal(idx("June 2026"), 1);
  assert.equal(idx("Jul. 2026"), 2);
  assert.equal(idx("June 2027"), -1);   // off-axis is a miss, not a guess
});

test("yearLag matches the facts/verify year-ago rule", () => {
  assert.equal(yearLag("monthly"), 12);
  assert.equal(yearLag("quarterly"), 4);
  assert.equal(yearLag("annual"), 1);
});
