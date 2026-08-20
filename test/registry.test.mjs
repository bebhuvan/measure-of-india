// test/registry.test.mjs — the dossier registry is the site's spine; these
// checks fail loudly the moment it disagrees with the filesystem or the
// prose pipeline.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { DOSSIERS, bySlug } from "../src/dossiers/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const has = (rel) => fs.existsSync(path.join(ROOT, rel));

test("slugs, numbers and register ids are unique", () => {
  assert.equal(new Set(DOSSIERS.map((d) => d.slug)).size, DOSSIERS.length);
  assert.equal(new Set(DOSSIERS.map((d) => d.no)).size, DOSSIERS.length);
  assert.equal(new Set(DOSSIERS.map((d) => d.register.id)).size, DOSSIERS.length);
});

test("numbers are zero-padded and sequential", () => {
  DOSSIERS.forEach((d, i) => assert.equal(d.no, String(i + 1).padStart(2, "0")));
});

test("every dossier has a page, a client module and an OG card target", () => {
  for (const d of DOSSIERS) {
    assert.ok(has(`src/pages/dossiers/${d.slug}.astro`), `missing page: ${d.slug}`);
    assert.ok(has(`src/dossiers/${d.slug}.client.js`), `missing client module: ${d.slug}`);
  }
});

test("every bundle the registry names exists on disk, including currentBundle and spark bundle", () => {
  for (const d of DOSSIERS) {
    for (const b of d.bundles) assert.ok(has(`data/series/${b}.json`), `${d.slug}: missing bundle ${b}`);
    assert.ok(d.bundles.includes(d.currentBundle), `${d.slug}: currentBundle not in bundles`);
    assert.ok(d.bundles.includes(d.spark.bundle), `${d.slug}: spark bundle not in bundles`);
  }
});

test("calendar and bands are well-formed", () => {
  for (const d of DOSSIERS) {
    assert.ok(["fiscal-apr", "calendar"].includes(d.calendar), `${d.slug}: bad calendar`);
    if (d.bands) {
      assert.ok(d.bands.floor < d.bands.target && d.bands.target < d.bands.ceiling, `${d.slug}: band ordering`);
    }
  }
});

test("prose flags agree with pipeline/slots.yml", () => {
  const slots = YAML.parse(fs.readFileSync(path.join(ROOT, "pipeline/slots.yml"), "utf8"));
  for (const slug of Object.keys(slots)) {
    assert.ok(bySlug[slug], `slots.yml dossier "${slug}" missing from registry`);
    assert.equal(bySlug[slug].prose, true, `${slug}: has slots but prose:false`);
  }
  for (const d of DOSSIERS) {
    if (d.prose) assert.ok(slots[d.slug], `${d.slug}: prose:true but no slots.yml entry`);
  }
});
