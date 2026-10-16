// Hard rules 2 and 5 (AGENTS.md), each as the test that would have caught the 2026-10-15 breaks:
// 111 schools bundles with the fetch date as vintage; 13,550 all-null series in schools and farm
// households that no check saw; range checks of +-1e8 and +-1e15 that checked nothing; a 3,955%
// GER; Ember emissions printed a second time as "%"; state-profile counts and rupee amounts under
// a percent or per-1,000 unit. The data scans read only the families that broke.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeSeries, splitEmptySeries } from "../scripts/lib/util.mjs";
import { vintageError } from "../scripts/lib/vintage.mjs";
import { ENVELOPE, envelopeOf } from "../scripts/lib/unit-envelope.mjs";
import { unitOf as profileUnit } from "../scripts/lib/products/profiles-mospi.mjs";
import { duplicateUnitBlock } from "../scripts/lib/products/energy.mjs";
import { GER_CEILING, cube, reportDropout } from "../scripts/lib/products/schools.mjs";
import { noEstimateRows } from "../scripts/lib/products/households.mjs";
import zlib from "node:zlib";

const bundle = (series) => ({ meta: { vintage: null }, dates: ["2024-04-01"], series });

test("writeSeries refuses a series with no value unless the source declared it unpublished", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "atlas-hard-rules-"));
  try {
    assert.throws(() => writeSeries(root, "data/series/x.json", bundle({ a: { data: [1] }, b: { data: [null] } })), /no value at all/);
    assert.throws(() => writeSeries(root, "data/series/x.json", bundle({})), /no series left/);
    writeSeries(root, "data/series/x.json", bundle({ a: { data: [1] }, b: { data: [null], unavailable: { kind: "source-unpublished" } } }));
    assert.ok(fs.existsSync(path.join(root, "data/series/x.json")));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("splitEmptySeries keeps every series with a figure and nothing else", () => {
  const { kept, empty } = splitEmptySeries({ a: { data: [null, 2] }, b: { data: [null, null] }, c: { data: [null], unavailable: {} } });
  assert.deepEqual(Object.keys(kept), ["a", "c"]);
  assert.deepEqual(Object.keys(empty), ["b"]);
});

test("a capture date is never a data vintage", () => {
  assert.match(vintageError({ vintage: "2026-10-10", archiveCapturedDate: "2026-10-10" }, "2026-10-15"), /archive capture date/);
  assert.equal(vintageError({ vintage: "2026-09-12", archiveCapturedDate: "2026-10-10" }, "2026-10-15"), null);
});

test("unit envelopes reject the mislabels the Codex wave shipped", () => {
  const out = (unit, v) => { const r = ENVELOPE[unit]; return v < r[0] || v > r[1]; };
  assert.ok(out("percent", 62037), "a household count under percent");
  assert.ok(out("per_1000", 10681), "a rupee amount under per 1,000");
  assert.ok(out("pct", 1105802.88), "Ember ktCO2 printed as %");
  assert.ok(out("pct_of_workers", 100.6));
  assert.ok(!out("percent", 115.6) && !out("per_1000", -0.4) && !out("pct", -298.2), "legitimate GERs, migration rates and profit swings pass");
  // the renderer and the gate resolve the same unit; a rupee column under a "(per 1,000)" title is rupees
  assert.equal(envelopeOf({ meta: {} }, { unit: "inr", label: "Persons (per 1,000) availing Ayush treatment and average expenditure (Rs.)" }).unit, "inr");
  assert.equal(envelopeOf({ meta: {} }, { unit: "rate", label: "Death rate, crude (per 1,000 people)" }).unit, "per_1000");
});

test("profile units come from the series' own measure before the table title", () => {
  const t = "Proportion per 1000 of household reporting borrowing and average amount of borrowing per household";
  assert.equal(profileUnit(`${t}, x`, "-", "Borrowing - average amount per household (Rs.) - all, Rural"), "inr");
  assert.equal(profileUnit(`${t}, x`, "-", "Borrowing - per 1000 no. of households reporting - all, Rural"), "per_1000");
  const w = "Percentage of households getting safe and adequate drinking water within premises through pipe water supply (Urban)";
  assert.equal(profileUnit(w, "-", "Total No. of urban Households, Urban"), "count");
  assert.equal(profileUnit(w, "-", "Urban Households Coverage (in %), Urban"), "percent");
  assert.equal(profileUnit("Number of persons per 1,00,000 reporting onset of ailments", "-", "Incidence Rate of Ailment During Last 15 Days"), "per_100k");
  assert.equal(profileUnit("Percentage distribution of households not getting sufficient drinking water", "-", "Number of months of the year during which availability of drinking water was not sufficient"), "percent");
});

test("a unit block that only repeats another unit's values is a source duplicate", () => {
  const r = (unit, value, variable = "Coal") => ({ date: "2024-01-01", unit, value, dims: { state: "Goa", category: "Power sector emissions", variable } });
  assert.ok(duplicateUnitBlock([r("kt_co2e", 10), r("kt_co2e", 4, "Gas"), r("pct", 10), r("pct", 4, "Gas")], "Power sector emissions", "pct"));
  assert.ok(!duplicateUnitBlock([r("kt_co2e", 10), r("pct", 71.4)], "Power sector emissions", "pct"));
});

// 2026-10-16: the UDISE API served Bihar's 2024-25 secondary dropout as 0, 0, 0 where the printed
// report has 7.0, 6.8, 6.9; AIDIS printed every share of a nil loan amount as 0.
test("an API zero against a printed figure is withheld, and a disagreeing figure fails", () => {
  const text = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/raw/schools-udise-report-2024.json.gz"))).text;
  const printed = reportDropout(text);
  const row = (value, gender = "Total") => ({ indicator: "Dropout Rate", year: "2024-25", state: "Bihar", gender, level_of_education: "Secondary (9-10)", value });
  const opts = { label: "Dropout Rate", code: 41, family: "udise", vintage: null, base: "x", rawFile: "x", printed };
  const s = Object.values(cube([row("0")], opts).series)[0];
  assert.equal(s.data[0], null);
  assert.match(s.note, /prints 6\.9/);
  assert.equal(Object.values(cube([row("6.9")], opts).series)[0].data[0], 6.9);
  assert.throws(() => cube([row("9.9")], opts), /API 9\.9 != report 6\.9/);
  // a zero the report also prints stays a zero
  assert.equal(Object.values(cube([{ ...row("0"), state: "Delhi", level_of_education: "Primary (1-5)" }], opts).series)[0].data[0], 0);
});

test("shares of a nil amount are no estimate; a rounded zero inside a breakdown stays", () => {
  const sub = "All households - cash loan (Rs.) per Rs. 1000 of total cash loan outstanding (by credit agency)";
  const r = (state, value, agency) => ({ state, sector: "Rural", sub_indicator: sub, credit_agency: agency, value });
  const rows = [r("Chandigarh", "0", "Bank"), r("Chandigarh", "0", "All"), r("Bihar", "0", "Bank"), r("Bihar", "1000", "All")];
  assert.deepEqual([...noEstimateRows(rows)].map((x) => x.state), ["Chandigarh", "Chandigarh"]);
  assert.equal(noEstimateRows([{ ...rows[0], sub_indicator: "per 1000 no. of households reporting" }, { ...rows[1], sub_indicator: "per 1000 no. of households reporting" }]).size, 0, "a zero incidence is an estimate");
});

// Data: the families that broke. Every series has a figure (or a declared unpublished cell), sits
// inside its unit envelope, and carries a real data vintage or the declared-unknown contract.
const FAMILIES = /^(schools|farm-households|households|energy|digital-access|pensions|profiles-mospi)-/;
test("the wave-2 families keep no empty series, no out-of-envelope value and no fetch-date vintage", () => {
  const problems = [];
  for (const f of fs.readdirSync("data/series").filter((f) => FAMILIES.test(f) && f.endsWith(".json"))) {
    const b = JSON.parse(fs.readFileSync(path.join("data/series", f), "utf8"));
    const v = vintageError(b.meta);
    if (v) problems.push(`${f}: ${v}`);
    // MoSPI eSankhyiki serves no revision timestamp: these carry the declared-unknown vintage
    if (/^(schools-(udise|cmse)|profiles-mospi)-/.test(f) && b.meta.vintage !== null) problems.push(`${f}: eSankhyiki bundle dated ${b.meta.vintage}`);
    if (!Object.keys(b.series).length) problems.push(`${f}: no series`);
    for (const [k, s] of Object.entries(b.series)) {
      if (!s.data.some((x) => x != null) && !s.unavailable) problems.push(`${f}.${k}: no value`);
      const { unit, range } = envelopeOf(b, s);
      if (!range) { problems.push(`${f}.${k}: no envelope for ${unit}`); continue; }
      const bad = s.data.find((x) => x != null && (x < range[0] || x > range[1]));
      if (bad !== undefined) problems.push(`${f}.${k}: ${bad} outside ${unit}`);
      if (/^schools-udise-.*-31\.json$/.test(f) && s.data.some((x) => x > GER_CEILING)) problems.push(`${f}.${k}: GER above ${GER_CEILING}`);
    }
    if (problems.length > 20) break;
  }
  assert.deepEqual(problems, []);
});
