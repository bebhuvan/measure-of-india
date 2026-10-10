// test/states-key.test.mjs: the state key (src/dossiers/states-key.js) must place every state
// label in every baked bundle, or the bundle must be declared as some other geography here,
// with the reason. A new spelling from any source fails this test until the key learns it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATES, FORMER, SEAMS, placeAll, place, placeAggregate, placeStrict, placeFirst, sameTerritory, successorOf, normalise } from "../src/dossiers/states-key.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "data/series");

// Bundles whose labels name a state only in passing: the geography is something else.
const OTHER_GEOGRAPHY = [
  [/^credit-deep-(bank-|crar-banks|contingent|employees-banks|offices-abroad-banks|offices-banks|priority-sector-banks|restructured|sensitive-sectors-banks|unclaimed|tp-branches-atms|tp-overseas|tp-shareholding|tp-ucb-)/, "one row per bank; some banks carry a state's name (Punjab National Bank, Karnataka Bank)"],
  [/^credit-(loan-quality|npa|npa-movement)-banks$|^rates-mclr-banks$/, "one row per bank"],
  [/^housing-|^bis-property-cities$|^deposits-(q-)?metros-sectors$|^credit-deep-cheque-clearances$/, "cities and clearing houses, not states"],
  [/^gender-t130$/, "high courts, several of which serve more than one state"],
  [/^states-hbs-t102$/, "IMD meteorological sub-divisions (East Uttar Pradesh, Konkan and Goa), not states"],
];
const otherGeo = (slug) => OTHER_GEOGRAPHY.find(([re]) => re.test(slug))?.[1] ?? null;

// Inside a state cut, rows that are not one state, declared with the reason.
const NON_STATE_ROWS = [
  [/^asuse-/, (s) => /^(All|HWE|OAE|Manufacturing|Trade|Other Services)$/.test(s.group ?? "") && !place(s.label), "all-India rows by enterprise type"],
  [/./, (s) => /^(others|nhb\/states|others \(nri\/defense\))\b/i.test(s.label.split(/ · |: /).at(s.label.includes(" · ") ? -1 : 0)), "the source's own 'Others' row"],
  [/^states-hbs-t142$/, (s) => /^Damodar Valley Corporation/.test(s.label), "a power utility serving two states"],
  [/^states-hbs-t149$/, (s) => /^(Mumbai|Kolkata|Chennai|Delhi):/.test(s.label), "metro telephone circles"],
  [/^states-hbs-t177$/, (s) => /^Per Cent Of Gdp/.test(s.label), "the all-states total as a share of GDP"],
  [/^gender-t16[4-7]$/, (s) => /, Central$/.test(s.label), "central school boards (CBSE, NIOS), not a state"],
  [/^gender-t031$/, (s) => /, (Jammu|Kashmir)$/.test(s.label), "the Jammu and Kashmir divisions, below the state"],
];
// Labels that name a state and then a finer place inside it (districts, boards, banks in a state).
const HIERARCHICAL = [/-districts?(-|$)/, /^gender-t16[46]$/, /^credit-deep-tp-ucb-/];

const bundles = fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
const load = (slug) => JSON.parse(fs.readFileSync(path.join(DIR, slug + ".json"), "utf8"));
const text = (k, s) => s.state ?? s.label ?? k;

test("the key: 36 units, unique slugs, codes and aliases", () => {
  assert.equal(STATES.length, 36);
  assert.equal(STATES.filter((u) => u.kind === "state").length, 28);
  for (const f of ["slug", "iso", "lgd"]) assert.equal(new Set(STATES.map((u) => u[f])).size, 36, `duplicate ${f}`);
  for (const u of STATES) {
    assert.match(u.iso, /^IN-[A-Z]{2}$/);
    for (const n of u.neighbours) assert.ok(STATES.some((v) => v.slug === n), `${u.slug}: unknown neighbour ${n}`);
    for (const n of u.neighbours) assert.ok(STATES.find((v) => v.slug === n).neighbours.includes(u.slug), `${u.slug} and ${n}: neighbours must be mutual`);
    assert.equal(place(u.name), u.slug);
  }
  for (const u of FORMER) assert.equal(place(u.name), u.slug);
  for (const s of SEAMS) for (const n of s.next) assert.ok(STATES.some((u) => u.slug === n));
});

test("the spellings the brief names place correctly", () => {
  const cases = { "Orissa": "odisha", "Odisha": "odisha", "Pondicherry": "puducherry", "Puduchery": "puducherry", "NCT of Delhi": "delhi",
    "Jammu & Kashmir": "jammu-kashmir", "Andaman & N. Islands": "andaman-nicobar", "Dadra & Nagar Haveli and Daman & Diu": "dnh-dd",
    "Dadra & Nagar Haveli": "dadra-nagar-haveli", "Daman & Diu": "daman-diu", "Chattisgarh": "chhattisgarh", "Uttaranchal": "uttarakhand",
    "Keralam": "kerala", "Jammu & Kashmir (state, with Ladakh, to 2018-19): GSDP": "jammu-kashmir-state",
    "Andhra Pradesh (before Telangana was separated), deposits": "andhra-pradesh-undivided" };
  for (const [t, want] of Object.entries(cases)) assert.equal(place(t), want, t);
  assert.equal(place("Goat meat"), null);
  assert.equal(placeAggregate("All India"), "india");
  assert.throws(() => placeStrict("Atlantis"), /cannot place/);
  assert.throws(() => place("Assam & Meghalaya"), /more than one/);
  assert.equal(placeFirst("Eastern region, West Bengal, Koch Bihar"), "west-bengal");
  assert.equal(normalise("Andaman & N. Islands"), "andaman and n islands");
});

test("boundary seams: a figure for the undivided unit is never the present unit's", () => {
  assert.equal(sameTerritory("andhra-pradesh", "2014-03-31"), false);
  assert.equal(sameTerritory("andhra-pradesh", "2014-03-31", { successorHasValue: true }), true);
  assert.equal(sameTerritory("andhra-pradesh", "2015-03-31"), true);
  assert.equal(sameTerritory("jammu-kashmir", "2019-03-31"), false);
  assert.equal(sameTerritory("jammu-kashmir", "2020-03-31"), true);
  assert.equal(sameTerritory("telangana", "2012-03-31"), true);
  assert.equal(sameTerritory("bihar", "1990-01-01"), true);
  assert.equal(successorOf("andhra-pradesh"), "telangana");
  assert.equal(successorOf("jammu-kashmir"), "ladakh");
  assert.equal(successorOf("bihar"), null);
});

test("every state label in every baked bundle is placed, or the bundle is national or another geography", () => {
  const problems = [];
  let stateCuts = 0;
  for (const slug of bundles) {
    const b = load(slug);
    const entries = Object.entries(b.series);
    const hits = entries.filter(([k, s]) => placeAll(text(k, s)).length || placeAll(k).length);
    if (!hits.length) {
      if (/(^|-)states(-|$)/.test(slug) && slug !== "states-spread") problems.push(`${slug}: a states bundle with no state label the key can place`);
      continue;   // national (or foreign) bundle
    }
    if (otherGeo(slug)) continue;
    stateCuts++;
    const hier = HIERARCHICAL.some((re) => re.test(slug));
    for (const [k, s] of entries) {
      const t = text(k, s);
      const units = [...new Set(placeAll(t).map((h) => h.slug))];
      if (units.length === 1) continue;
      if (units.length > 1) { if (hier) continue; problems.push(`${slug}/${k}: "${t}" names ${units.join(" and ")}`); continue; }
      if ([...new Set(placeAll(k).map((h) => h.slug))].length === 1) continue;
      if (placeAggregate(t) || placeAggregate(k)) continue;
      if (t.split(/ · |, |: /).some((seg) => /^(grand )?total$/i.test(seg.trim()))) continue;   // the source's national total row
      if (NON_STATE_ROWS.some(([re, ok]) => re.test(slug) && ok(s))) continue;
      problems.push(`${slug}/${k}: cannot place "${t}"`);
    }
  }
  assert.ok(stateCuts > 500, `only ${stateCuts} state-cut bundles found`);
  assert.deepEqual(problems.slice(0, 200), [], `${problems.length} labels the state key cannot place`);
});
