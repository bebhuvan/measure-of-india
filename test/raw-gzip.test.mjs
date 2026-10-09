// test/raw-gzip.test.mjs: raw dumps are stored gzipped, byte-stable, and still vintage-safe
// (scripts/lib/util.mjs writeRaw / readRaw).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { writeRaw, readRaw, rawExists, gzipRaw } from "../scripts/lib/util.mjs";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "raw-"));

test("writeRaw stores .json.gz, deterministically, and readRaw reads it back", () => {
  const root = tmp();
  const v = writeRaw(root, "data/raw/x.json", { vintage: "2026-10-01", rows: [1, 2] });
  assert.equal(v, "2026-10-01");
  assert.ok(fs.existsSync(path.join(root, "data/raw/x.json.gz")) && !fs.existsSync(path.join(root, "data/raw/x.json")));
  assert.deepEqual(readRaw(root, "data/raw/x.json"), { vintage: "2026-10-01", rows: [1, 2] });
  assert.ok(gzipRaw("abc").equals(gzipRaw("abc")), "same text, same bytes");
});

test("an unchanged body keeps its vintage; a revision archives the old one gzipped", () => {
  const root = tmp();
  writeRaw(root, "data/raw/x.json", { vintage: "2026-10-01", rows: [1] });
  assert.equal(writeRaw(root, "data/raw/x.json", { vintage: "2026-10-09", rows: [1] }), "2026-10-01");
  assert.equal(writeRaw(root, "data/raw/x.json", { vintage: "2026-10-09", rows: [2] }), "2026-10-09");
  const arch = path.join(root, "data/raw/vintages/x.2026-10-01.json.gz");
  assert.ok(fs.existsSync(arch));
  assert.deepEqual(JSON.parse(zlib.gunzipSync(fs.readFileSync(arch))), { vintage: "2026-10-01", rows: [1] });
});

test("a legacy plain .json still reads, and is converted on the next unchanged write", () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, "data/raw"), { recursive: true });
  fs.writeFileSync(path.join(root, "data/raw/y.json"), JSON.stringify({ vintage: "2026-01-01", a: 1 }, null, 1) + "\n");
  assert.ok(rawExists(root, "data/raw/y.json"));
  assert.equal(readRaw(root, "data/raw/y.json").a, 1);
  assert.equal(writeRaw(root, "data/raw/y.json", { vintage: "2026-10-10", a: 1 }), "2026-01-01");
  assert.ok(fs.existsSync(path.join(root, "data/raw/y.json.gz")) && !fs.existsSync(path.join(root, "data/raw/y.json")));
});

test("the repository's raw dumps are all gzipped", () => {
  const plain = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== "http-cache") walk(p); } else if (e.name.endsWith(".json") && !/-index\.json$/.test(e.name)) plain.push(p); } })("data/raw");
  assert.deepEqual(plain, []);
});
