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
    assert.ok(has(`src/pages/guides/${d.slug}.astro`), `missing page: ${d.slug}`);
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

// The rot class P2.6 removed: a hand-typed full date ("Vintage 28 Nov 2025")
// in the registry or a register table where the current bundle's own meta
// disagrees. Full dates in hand-typed strings are allowed only for FROZEN
// retired rulers (whose bundles carry no contradicting fact) — live rulers
// must derive (display.js "release"/"vintage" styles, register.client vintOf).
test("hand-typed display dates never contradict the current bundle", () => {
  const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dateShort = (iso) => `${Number(iso.slice(8, 10))} ${MS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  for (const d of DOSSIERS) {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", d.currentBundle + ".json"), "utf8"));
    const fact = dateShort(b.meta.releaseDate ?? b.meta.vintage);
    for (const [field, text] of [["stamp.vintageText", d.stamp?.vintageText], ["register.unit", d.register?.unit]]) {
      if (!text) continue;
      const m = text.match(/(\d{1,2} [A-Z][a-z]{2} \d{4})/);
      if (m) assert.equal(m[1], fact, `${d.slug}: ${field} hand-types "${m[1]}" but the current bundle serves ${fact} — derive it`);
    }
  }
});
