// test/everycut.test.mjs: the every-cut rows (src/dossiers/everycut.js) show every series
// with a known unit, never a 0 for a missing value, and split long tails without losing rows.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rowsOf, unitOf, UNITS, sparkPath, paginate, periodLabel } from "../src/dossiers/everycut.js";

const slugs = fs.readdirSync("data/series").filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));

test("every series of every bundle resolves to a unit the table can show", () => {
  for (const b of slugs) {
    const j = JSON.parse(fs.readFileSync(`data/series/${b}.json`, "utf8"));
    for (const [k, s] of Object.entries(j.series)) assert.ok(UNITS[unitOf(j, s)], `${b}.${k}: unit ${unitOf(j, s)}`);
    assert.equal(rowsOf(b).length, Object.keys(j.series).length);
  }
});

test("rows never render NaN, undefined or a hyphen-minus", () => {
  for (const b of slugs) for (const r of rowsOf(b)) {
    for (const t of [r.latestText, r.changeText, r.period, r.label]) assert.doesNotMatch(String(t), /NaN|undefined|Infinity/, `${b}.${r.key}`);
    assert.doesNotMatch(r.latestText, /^-|[₹$]-/, `${b}.${r.key}: ${r.latestText}`);
  }
});

test("sparklines break at gaps and never draw a missing value", () => {
  const p = sparkPath([1, 2, null, 4, 5]);
  assert.equal((p.d.match(/M/g) || []).length, 2);
  assert.equal(sparkPath([null, null]), null);
});

test("long tails paginate without losing or repeating rows, groups kept whole", () => {
  const rows = Array.from({ length: 2500 }, (_, i) => ({ key: "k" + i, group: "g" + Math.floor(i / 300) }));
  const pages = paginate(rows, 1000);
  assert.equal(pages.flat().length, 2500);
  assert.equal(new Set(pages.flat().map((r) => r.key)).size, 2500);
  for (const p of pages) assert.ok(p.length <= 1000);
  const where = new Map();
  pages.forEach((p, i) => p.forEach((r) => where.set(r.group, (where.get(r.group) ?? new Set()).add(i))));
  for (const [, s] of where) assert.equal(s.size, 1);
});

test("periods: quarters dated by first or last month, fiscal years, stocks at March", () => {
  const q = { meta: { frequency: "quarterly" }, dates: [] }, a = { meta: { frequency: "annual" }, dates: ["x", "y"] };
  assert.equal(periodLabel("x", q, "2026-04-01"), "Apr to Jun 2026");
  assert.equal(periodLabel("x", q, "2025-03-01"), "Jan to Mar 2025");
  assert.equal(periodLabel("x", a, "2023-04-01"), "2023-24");
  assert.equal(periodLabel("x", a, "2026-03-01"), "Mar 2026");
});

test("an estimated latest value is marked, never shown as measured (CONTRACT-series 2b)", () => {
  let checked = 0;
  for (const b of slugs) {
    const j = JSON.parse(fs.readFileSync(`data/series/${b}.json`, "utf8"));
    const rows = rowsOf(b);
    for (const [k, s] of Object.entries(j.series)) {
      if (!s.estimated?.length) continue;
      let li = -1;
      for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) { li = i; break; }
      const r = rows.find((x) => x.key === k);
      assert.equal(r.estimated, li >= 0 && s.estimated.includes(j.dates[li]), `${b}.${k}`);
      if (r.estimated) { assert.ok(r.changeEstimated, `${b}.${k}: change uses an estimate`); checked++; }
    }
  }
  assert.ok(checked > 0, "no estimated latest values found: the BIS India credit series should have some");
});

test("every guide's every-cut plan places each bundle exactly once, inline within the cap", async () => {
  const { DOSSIERS } = await import("../src/dossiers/registry.js");
  const { everyCutPlan, guideBundles, INLINE_CAP } = await import("../src/dossiers/everycut.js");
  for (const d of DOSSIERS) {
    const p = everyCutPlan(d);
    const placed = [...p.inline, ...p.tails.flatMap((t) => t.bundles)];
    assert.deepEqual([...placed].sort(), [...guideBundles(d)].sort(), d.slug);
    assert.equal(new Set(placed).size, placed.length, `${d.slug}: a bundle placed twice`);
    assert.ok(p.inlineRows.length <= (d.everyCutInline ?? INLINE_CAP), `${d.slug}: inline over the cap`);
    for (const t of p.tails) assert.equal(t.pages.flat().length, t.rows.length, `${d.slug}/${t.id}: pages lose rows`);
  }
});
