// test/units.test.mjs: a ratio never carries a money unit (datafix, launch read-through 2026-10-10).
// external-debt-annual's "E.9 Forex Reserves - Total Debt Ratio" (101 per cent at its peak)
// carried the bundle's US$ million, so the every-cut table and search showed it as "$0.10 bn";
// DBIE ratio rows in credit-deep tables were stored as ₹ crore and divided by a crore. Each fix is
// in the adapter that sets units (external-dbie unitFor, credit-deep RATIO_ROW, states hbsUnit);
// this test sweeps every bundle so a new ratio row in a money table fails here first.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MONEY = /^(inr|usd|sdr|eur)|crore|lakh|million|billion|_bn$|_mn$/;
// what a label says when the row is a ratio, a per cent or a share of something
export const RATIO_LABEL = /\bratios?\b|as per ?cent|percentage (of|to)|as percentage|per ?cent (of|to)\b|% of\b|\(%\)|\bin per ?cent\b/i;
// money rows whose names only mention a rate: derivatives on interest rates, interest-rate slabs
// ("5% to 6%, credit outstanding"), and trade commodity names ("not more than 85 percent of H3BO3")
const NOT_A_RATIO = /interest rate (swaps?|futures?|options?)|forward rate agreements?|percent of h3bo3/i;

test("no series labelled as a ratio or per cent carries a money unit", () => {
  const bad = [];
  for (const f of fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => f.endsWith(".json"))) {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", f), "utf8"));
    for (const [k, s] of Object.entries(b.series ?? {})) {
      const u = String(s.unit ?? b.meta?.unit ?? "");
      const label = s.label ?? "";
      if (MONEY.test(u) && RATIO_LABEL.test(label) && !NOT_A_RATIO.test(label)) bad.push(`${f.replace(".json", "")} ${k} (${u}): ${label.slice(0, 80)}`);
    }
  }
  assert.deepEqual(bad, [], `ratio rows with a money unit; set the unit per series in the adapter:\n${bad.slice(0, 20).join("\n")}`);
});

test("the external-debt reserves-to-debt ratio is a per cent", () => {
  for (const slug of ["external-debt-annual", "external-debt-annual-inr"]) {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));
    const s = Object.entries(b.series).find(([k]) => /^e_9_/.test(k))?.[1];
    assert.ok(s, `${slug}: no E.9 line`);
    assert.equal(s.unit, "percent", `${slug}: E.9 reserves to total debt is a ratio`);
  }
});
