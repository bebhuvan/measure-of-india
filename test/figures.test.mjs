// test/figures.test.mjs: every figure in prose is traced (AGENTS.md hard rule 3), at the scale
// the prose writes it, and only through the unit of the series it came from.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { makeAllowed, extractFigures, traces } from "../pipeline/lib/figures.mjs";

const figs = (t) => extractFigures(t).map((f) => `${f.str}${f.scale ? " " + f.scale : ""}`);

test("extraction: Indian and Western grouping, scale words, units", () => {
  assert.deepEqual(figs("₹1,00,000 and 100,000 people"), ["100000", "100000"]);
  assert.deepEqual(figs("US$81.8 billion, ₹5.2 lakh crore and ₹4,122"), ["81.8 billion", "5.2 lakh crore", "4122"]);
  assert.deepEqual(extractFigures("27.0°C and 1,200 mm, 9.3 times").map((f) => f.unit), ["°C", "mm", "times"]);
});

test("extraction: periods, base strings, codes, ordinals and rate denominators are not figures", () => {
  assert.deepEqual(figs("In 2025-26 and Q1 FY27, on 7 October 2026, base 2024=100, HS 03 and NIC 01-03, the 18th Lok Sabha"), []);
  assert.deepEqual(figs("88 per 1,00,000 live births, 35 per 1,000"), ["88", "35"]);
});

test("a real amount traces at its own scale; a wrong scale or an invented amount fails", () => {
  const A = makeAllowed();
  A.add(437000, "usd_million");                       // US$437,000 million
  const t = (s) => traces(extractFigures(s)[0], A);
  assert.ok(t("US$437 billion"));
  assert.ok(t("US$4,37,000 million"));
  assert.ok(t("US$437,000 million"));
  assert.ok(!t("US$437 million"), "wrong scale must fail");
  assert.ok(!t("US$438 billion"), "invented amount must fail");
  assert.ok(!t("₹437 crore"), "a dollar figure cannot become a rupee crore by rescaling an unrelated unit");
  const R = makeAllowed();
  R.add(5000, "inr_crore");                            // ₹5,000 crore
  assert.ok(traces(extractFigures("₹50,000 million")[0], R));
  assert.ok(traces(extractFigures("₹0.05 lakh crore")[0], R));
  assert.ok(!traces(extractFigures("₹5,000 lakh")[0], R));
});

test("unknown units trace only as written; counts trace only as counts", () => {
  const A = makeAllowed();
  A.add(13.85, null);
  assert.ok(traces(extractFigures("a 13.9-point spread")[0], A), "half-up rounding");
  assert.ok(!traces(extractFigures("13.85 billion")[0], A), "no scaling without a unit");
  A.addCount(358);
  assert.ok(traces(extractFigures("358 items")[0], A));
  assert.ok(!traces(extractFigures("358%")[0], A));
});

test("the verifier passes honest prose and rejects a wrong scale in it", () => {
  const f = "pipeline/out/prose-external.current-reading.what-the-print-says.md";
  if (!fs.existsSync(f) || !fs.existsSync("pipeline/out/facts-external.json")) return;
  execFileSync(process.execPath, ["pipeline/verify.mjs", f, "external"], { stdio: "pipe" });
  const prose = fs.readFileSync(f, "utf8");
  const m = prose.match(/US\$(\d+(?:\.\d+)?) billion/);
  assert.ok(m, "the external prose quotes a US$ billion figure");
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "verify-")), "p.md");
  fs.writeFileSync(tmp, prose.replace(m[0], `US$${m[1]} million`));
  assert.throws(() => execFileSync(process.execPath, ["pipeline/verify.mjs", tmp, "external"], { stdio: "pipe" }));
});
