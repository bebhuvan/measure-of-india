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
import { GER_CEILING, cube, printedDropout, printedRule, REPORTS } from "../scripts/lib/products/schools.mjs";
import { LABEL_CORRECTIONS, EXPECTED_MATCHED, correctFarmRow, reconcileFarmLabels } from "../scripts/lib/farm-households-corrections.mjs";
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
// 2026-10-17: the API's whole 2023-24 dropout year disagrees with the printed report (39 of 324
// cells agree). Owner's rule: where the printed report has the cell, the printed figure is published.
test("the printed report's figure is published over a disagreeing API figure; its own zeros stay", () => {
  const printed = printedDropout(".");
  assert.deepEqual(Object.keys(printed).sort(), ["2022-23", "2023-24", "2024-25"]);
  const row = (value, year = "2024-25", extra = {}) => ({ indicator: "Dropout Rate", year, state: "Bihar", gender: "Total", level_of_education: "Secondary (9-10)", value, ...extra });
  // single rows: without the reviewed whole-year counts, which only a full year can meet
  const loose = Object.fromEntries(Object.entries(printed).map(([y, t]) => [y, { ...t, reviewed: undefined }]));
  const opts = { label: "Dropout Rate", code: 41, family: "udise", vintage: null, base: "x", rawFile: "x", printed: loose };
  const one = (rows) => Object.values(cube(rows, opts).series)[0];
  // an API zero against a printed figure: the printed figure, with the API value kept
  let s = one([row("0")]);
  assert.equal(s.data[0], 6.9);
  assert.equal(s.sourceValues["2024-04-01"], "0");
  assert.match(s.note, /2024-25: API 0, printed 6\.9/);
  // a differing non-zero API figure: the printed figure (Bihar 2023-24 prints 25.6)
  s = one([row("9.9", "2023-24")]);
  assert.equal(s.data[0], 25.6);
  assert.equal(s.sourceValues["2023-04-01"], "9.9");
  // within 0.1 is the same figure rounded: the printed one is kept and the API's recorded
  s = one([row("25.5", "2023-24")]);
  assert.equal(s.data[0], 25.6);
  assert.equal(printedRule(25.5, 25.6).kind, "rounding");
  assert.equal(printedRule(6.9, 6.9).kind, "agree");
  assert.equal(printedRule(0, 0).kind, "printedZero");
  assert.equal(printedRule(0, 6.9).kind, "apiZero");
  assert.equal(printedRule(null, 6.9).value, 6.9);
  assert.equal(printedRule(3, undefined).value, 3, "a year with no report keeps the API figure");
  assert.throws(() => printedRule(3, 140), /not a rate/);
  // a zero the report also prints stays a zero, with no API value attached
  s = one([row("0", "2024-25", { state: "Delhi", level_of_education: "Primary (1-5)" })]);
  assert.equal(s.data[0], 0);
  assert.equal(s.sourceValues, undefined);
  // a row the report should print but does not stops the bake
  assert.throws(() => cube([row("5", "2024-25", { state: "Atlantis" })], opts), /no printed cell/);
  // the reviewed outcome is pinned: a different set of disagreements stops the rebake
  const year = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/raw/profiles-mospi/udise-0-41.json.gz"))).rows.filter((r) => r.year === "2024-25");
  assert.equal(Object.keys(cube(year, { ...opts, printed }).series).length, 324);
  const tampered = { ...printed, "2024-25": { ...printed["2024-25"], reviewed: { ...printed["2024-25"].reviewed, apiZero: 2 } } };
  assert.throws(() => cube(year, { ...opts, printed: tampered }), /differs from the reviewed/);
  // the baked bundle carries the per-year counts, and Bihar's secondary dropout is the printed series
  const b = JSON.parse(fs.readFileSync("data/series/schools-udise-student-41.json"));
  for (const R of REPORTS) assert.deepEqual(Object.fromEntries(Object.keys(R.reviewed).map((k) => [k, b.meta.printedCheck.years[R.year][k]])), R.reviewed);
  assert.deepEqual(b.series.total__secondary_9_10__bihar.data, [29.5, 25.6, 6.9]);
});

// 2026-10-17: NSS 77 API tables 18, 19 and 34 swap the agricultural and non-agricultural household
// labels (the guide's "0.086 ha owned per agricultural household" was the non-agricultural figure);
// 36 says leasing-out over leasing-in values; 39 drops "in milk" and the visit-1 season.
test("farm label corrections hold only if every corrected cell matches Report 587", () => {
  const report = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/raw/farm-households-report.json.gz"))).text;
  const raw = (c) => JSON.parse(zlib.gunzipSync(fs.readFileSync(`data/raw/profiles-mospi/nss77-0-${c}.json.gz`))).rows;
  const rows34 = raw(34);
  const rec = reconcileFarmLabels(report, { 34: rows34 });
  assert.equal(rec[34].matched, EXPECTED_MATCHED[34]);
  assert.equal(rec[34].agree, rec[34].matched);
  // the labels as served fail the same check, and the strict check throws on them
  assert.ok(reconcileFarmLabels(report, { 34: rows34 }, { strict: false, correct: false })[34].disagree > 30000);
  assert.throws(() => reconcileFarmLabels(report, { 34: rows34 }, { correct: false }), /matched cells agree/);
  // a value that no longer matches the print stops the bake
  const bent = rows34.map((r, i) => (i === 0 ? { ...r, value: String(Number(r.value) + 1) } : r));
  assert.throws(() => reconcileFarmLabels(report, { 34: bent }), /34: corrected labels/);
  // corrections relabel and say so; values are untouched
  const { row, changes } = correctFarmRow(39, { state: "All India", "Social Group": "All", gender: null, ownership_holding: "All Sizes", livestock_owned: "Cattle", stock: null, value: "164" });
  assert.deepEqual([row.stock, row.season, row.value], ["In milk", "July 2018-December 2018", "164"]);
  assert.equal(changes.length, 2);
  assert.equal(correctFarmRow(18, { state: "Himachal Pradesh", "Social Group": "OBC", household_classification: "All Households" }).row["Social Group"], "Others");
  assert.equal(correctFarmRow(18, { state: "Bihar", "Social Group": "OBC", household_classification: "All Households" }).changes.length, 0);
  // the baked cube: agricultural households own 0.876 ha on average, the note keeps the API label
  const owned = [];
  for (const f of fs.readdirSync("data/series").filter((f) => /^farm-households-nss77-34-\d+\.json$/.test(f))) for (const s of Object.values(JSON.parse(fs.readFileSync(`data/series/${f}`)).series)) { const d = s.dims; if (d.state === "All India" && d["Social Group"] === "All" && d.ownership_holding === "All Sizes" && d.season === "July 2018–June 2019" && d.ownership_holding_area === "Average Area Owned per hh (ha)") owned.push([d.household_classification, s.data[0], s.note ?? ""]); }
  const by = Object.fromEntries(owned.map(([c, v, n]) => [c, { v, n }]));
  assert.equal(by["Agricultural Households"].v, 0.876);
  assert.equal(by["Non-agricultural Households"].v, 0.086);
  assert.match(by["Agricultural Households"].n, /"Non-agricultural Households" in the API/);
  const manifest = JSON.parse(fs.readFileSync("data/coverage/farm-households.manifest.json"));
  for (const c of Object.keys(LABEL_CORRECTIONS)) assert.equal(manifest.labelCorrections[c].disagree, 0);
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
