#!/usr/bin/env node
// scripts/lib/products/nfhs-ledger.mjs: writes data/coverage/nfhs.yml, the NFHS coverage ledger
// (docs/CONTRACT-coverage.md), from the catalogue, the baked bundles and the guide's plates.
//
// Every catalogue item (a sub-indicator in one round, for India, one state or one sector) is
// decided by looking at what was actually baked, in this order:
//   1. excluded: an NFHS-4 line the adapter withholds (nfhs.mjs QUARANTINE), with its evidence;
//   2. excluded: a sub-indicator the round did not publish at all (new in NFHS-5, or dropped);
//   3. excluded: a place that did not exist in the round (Ladakh and the merged Dadra and Nagar
//      Haveli and Daman and Diu in NFHS-4; the two separate UTs in NFHS-5);
//   4. excluded: a cell the fact sheet suppresses ("*", fewer than 25 cases) or marks NA;
//   5. shown: drawn on a plate of src/pages/guides/nfhs.astro (PLATES below mirrors the page);
//   6. baked: everything else, in its round's table bundle.
// Run it after the adapter (node scripts/lib/products/nfhs.mjs --bake) and after any change to
// the plates; node scripts/coverage.mjs then checks the result.
import { readRaw } from "../util.mjs";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ROOT, idPart } from "../catalogue.mjs";
import { QUARANTINE, TABLES, cleanLabel, geoKey } from "./nfhs.mjs";

const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data/coverage/nfhs.catalogue.json"), "utf8")).items;
const filters = readRaw(ROOT, "data/raw/nfhs-filters.json").filters;
const raw = readRaw(ROOT, "data/raw/nfhs-records.json").indicators;
const bundle = (round, t) => { const p = path.join(ROOT, "data/series", `nfhs-${round}-${TABLES[t][0]}.json`); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; };
const ROUND = { "2-nfhs-4": { n: 4, api: "nfhs-4" }, "3-nfhs-5": { n: 5, api: "nfhs-5" } };

// catalogue part -> the raw sub-indicator text, through the filter listing's codes
const subOf = {};
for (const [t, f] of Object.entries(filters)) for (const s of f.sub_indicator ?? []) subOf[`${t}:${s.id}-${idPart(String(s.label).trim()).slice(0, 40).replace(/-+$/, "")}`] = s.label;
const stateOf = {};
for (const f of Object.values(filters)) for (const s of f.state ?? []) stateOf[idPart(s.label)] = s.label;

/* ---------- the plates (mirrors src/pages/guides/nfhs.astro) ---------- */
const P = {
  direction: "§03 What changed between the rounds", anaemia: "§04 Anaemia", anaemiaStates: "§04 Child anaemia by state", nutrition: "§05 Children's nutrition",
  mortality: "§05 Infant and child deaths", vaccines: "§06 Vaccines and childhood illness", births: "§07 Births and mothers", cs: "§07 Caesareans by state",
  ncd: "§08 Blood pressure and blood sugar", ncdStates: "§08 High blood pressure by state", cancer: "§09 Cancer screening by state", women: "§10 Women's money, phones and say at home",
  womenStates: "§10 Phones and bank accounts by state", violence: "§11 Violence at home by state", tobacco: "§12 Tobacco by state", household: "§13 The household",
  tfr: "§14 Children per woman by state", fp: "§14 Family planning", gap: "§15 Village and town", table: "§16 State by state",
};
// [plate, table, sub regex, rounds, cuts]
const PLATES = [
  [P.anaemia, 14, /./, [4, 5], ["all"]], [P.anaemiaStates, 14, /^Children age 6-59/, [4, 5], ["state"]],
  [P.nutrition, 12, /stunted|are wasted|severely wasted|underweight|Children under 5 years who are overweight|within one hour|exclusively|^Total children age 6-23/, [4, 5], ["all"]],
  [P.mortality, 4, /./, [4, 5], ["all"]],
  [P.vaccines, 10, /either vaccination card|BCG|polio|penta or DPT|measles|hepatitis B|rotavirus|vitamin A/, [4, 5], ["all"]],
  [P.vaccines, 11, /oral rehydration|zinc|fever or symptoms/, [4, 5], ["all"]],
  [P.births, 8, /first trimester|at least 4 antenatal|iron folic acid for 1[08]0|^Mothers who received postnatal|^Children who received postnatal/, [4, 5], ["all"]],
  [P.births, 9, /^Institutional births|^Births attended|^Births delivered by caesarean/, [4, 5], ["all"]],
  [P.cs, 9, /private health facility that were|public health facility that were/, [5], ["state", "all"]],
  [P.ncd, 16, /Elevated blood pressure \(Systolic ≥140/, [5], ["all", "sector"]], [P.ncd, 15, /taking medicine/, [5], ["all", "sector"]],
  [P.ncd, 13, /overweight or obese|waist-to-hip/, [5], ["all", "sector"]],
  [P.ncdStates, 16, /Elevated blood pressure \(Systolic ≥140/, [5], ["state"]],
  [P.cancer, 17, /cervical|breast/, [5], ["state", "all"]],
  [P.women, 19, /./, [5], ["all", "sector"]], [P.women, 2, /^Women .*(internet|10 or more)/, [5], ["all", "sector"]],
  [P.womenStates, 19, /mobile phone|bank or savings/, [5], ["state"]],
  [P.violence, 20, /spousal violence/, [5], ["state", "all"]],
  [P.tobacco, 21, /use any kind of tobacco/, [5], ["state", "all"]],
  [P.household, 1, /electricity|drinking-water|sanitation|clean fuel|iodized|insurance|birth was registered|^Deaths in the last|pre-primary/, [4, 5], ["all"]],
  [P.tfr, 3, /Total Fertility/, [4, 5], ["state", "all"]],
  [P.fp, 5, /./, [4, 5], ["all"]], [P.fp, 6, /./, [4, 5], ["all"]],
  [P.table, 14, /^Children age 6-59/, [5], ["state"]], [P.table, 12, /are stunted/, [5], ["state"]], [P.table, 4, /^Infant/, [5], ["state"]],
  [P.table, 9, /^Institutional births \(in/, [5], ["state"]], [P.table, 10, /either vaccination card/, [5], ["state"]], [P.table, 15, /^Women .*taking medicine/, [5], ["state"]],
  [P.table, 1, /clean fuel/, [5], ["state"]],
];
// §03 draws every per-cent sub-indicator measured in both rounds (All India); §15 every
// per-cent sub-indicator of NFHS-5, rural and urban
const pct = (t, label) => {
  const b = bundle(5, t) ?? bundle(4, t);
  const s = Object.values(b.series).find((x) => x.group === label);
  return s?.unit === "percent";
};

/* ---------- decide every item ---------- */
const decided = [];   // { id, status, plate?, reason?, bundle? }
const reasonQ = { misfiled: [], frame: [] };
for (const it of cat) {
  const [, t, subPart, roundPart, ...cut] = it.id.split(":");
  const R = ROUND[roundPart];
  const rawSub = subOf[`${t}:${subPart}`];
  if (!rawSub) throw new Error(`nfhs-ledger: no sub-indicator for ${it.id}`);
  const label = cleanLabel(rawSub);
  const kind = cut[0] ?? "all";
  const q = R.n === 4 ? QUARANTINE.find((x) => x.t === Number(t) && x.re.test(rawSub)) : null;
  const rows = raw[t].filter((r) => r.sub_indicator === rawSub && r.survey === R.api);
  const numeric = (r) => /^\(?-?\d+(\.\d+)?\)?$/.test(String(r.value ?? "").trim());
  if (q && rows.some(numeric)) { decided.push({ id: it.id, status: "excluded", group: "q-" + q.kind }); continue; }
  if (!rows.some(numeric)) { decided.push({ id: it.id, status: "excluded", group: R.n === 4 ? "new-in-5" : "dropped-in-5" }); continue; }
  const b = bundle(R.n, t);
  const geo = kind === "state" ? stateOf[cut[1]] : "All India";
  const sector = kind === "sector" ? (cut[1].endsWith("rural") ? "rural" : "urban") : "total";
  const key = Object.keys(b.series).find((k) => b.series[k].group === label && b.series[k].geo === geo && b.series[k].sector === sector);
  if (!key) {
    const r = rows.find((x) => x.state === geo && x.sector === { total: "Rural + Urban (Combined)", rural: "Rural", urban: "Urban" }[sector]);
    const why = !r ? (["Ladakh", "Dadra & Nagar Haveli and Daman & Diu"].includes(geo) && R.n === 4 ? "geo-4" : ["Dadra & Nagar Haveli", "Daman & Diu"].includes(geo) && R.n === 5 ? "geo-5" : "no-row") : String(r.value).trim() === "*" ? "suppressed" : "na";
    decided.push({ id: it.id, status: "excluded", group: why });
    continue;
  }
  const bslug = `nfhs-${R.n}-${TABLES[t][0]}`;
  let plate = PLATES.find(([, pt, re, rounds, cuts]) => pt === Number(t) && re.test(label) && rounds.includes(R.n) && cuts.includes(kind))?.[0];
  if (!plate && kind === "all" && pct(t, label) && bundle(4, t) && bundle(5, t) && Object.values(bundle(4, t).series).some((s) => s.group === label) && Object.values(bundle(5, t).series).some((s) => s.group === label)) plate = P.direction;
  if (!plate && kind === "sector" && R.n === 5 && pct(t, label)) plate = P.gap;
  decided.push(plate ? { id: it.id, status: "shown", plate, bundle: bslug } : { id: it.id, status: "baked", bundle: bslug });
}

/* ---------- compress into rules ---------- */
const REASON = {
  "q-misfiled": "MoSPI's API files another indicator's NFHS-4 value under this sub-indicator (for India it gives 3.3 per cent of women with a bank account, where the NFHS-5 national report prints 53; violence during pregnancy 57.6 where the DHS Program gives 3.9), and the shift repeats in every state, so its NFHS-4 figure is withheld (scripts/lib/products/nfhs.mjs QUARANTINE has the evidence line by line).",
  "q-frame": "NFHS-4 measured a different group or asked a different question (blood pressure, blood sugar, tobacco and alcohol for ages 15-49 rather than everyone 15 and over; any examination of the cervix or breast rather than a screening test), and MoSPI's API files those figures under NFHS-5's wording, so they are not baked as if comparable.",
  "new-in-5": "Not in NFHS-4: the sub-indicator was added in NFHS-5 (the API serves no NFHS-4 figure for it).",
  "dropped-in-5": "Not in NFHS-5: the sub-indicator was dropped or redefined after NFHS-4 (the API serves no NFHS-5 figure for it).",
  "geo-4": "The place did not exist in NFHS-4: Ladakh was part of Jammu and Kashmir, and Dadra and Nagar Haveli and Daman and Diu were two separate UTs.",
  "geo-5": "The place did not exist in NFHS-5: Dadra and Nagar Haveli and Daman and Diu were merged into one UT in 2020.",
  suppressed: "The fact sheet suppresses this figure (\"*\"): it would rest on fewer than 25 unweighted cases.",
  na: "The fact sheet prints NA or leaves the cell blank: no figure was published for this place and sector.",
  "no-row": "The API serves no row for this place, sector and round.",
};
// fold ids into globs: a whole sub-indicator in one round becomes nfhs:t:sub:round:*, a whole
// cut kind (every state, both sectors) nfhs:t:sub:round:state:*; anything partial stays listed
const prefixOf = (id, n) => id.split(":").slice(0, n).join(":");
const kindOf = (id) => id.split(":")[4] ?? "all";
const universe = new Map();
for (const d of decided) (universe.get(prefixOf(d.id, 4)) ?? universe.set(prefixOf(d.id, 4), []).get(prefixOf(d.id, 4))).push(d.id);
function fold(ids) {
  const set = new Set(ids), out = [];
  for (const tsr of [...new Set(ids.map((id) => prefixOf(id, 4)))]) {
    const items = universe.get(tsr);
    if (items.every((id) => set.has(id))) { out.push(tsr + ":*"); continue; }
    for (const k of [...new Set(items.map(kindOf))]) {
      const ofKind = items.filter((id) => kindOf(id) === k), mine = ofKind.filter((id) => set.has(id));
      if (!mine.length) continue;
      if (k !== "all" && mine.length === ofKind.length) out.push(`${tsr}:${k}:*`);
      else out.push(...mine);
    }
  }
  return out.sort();
}
const rules = [];
for (const g of ["q-misfiled", "q-frame", "new-in-5", "dropped-in-5", "geo-4", "geo-5", "suppressed", "na", "no-row"]) {
  const ids = decided.filter((d) => d.group === g).map((d) => d.id);
  if (ids.length) rules.push({ match: fold(ids), status: "excluded", reason: REASON[g] });
}
for (const plate of [...new Set(decided.filter((d) => d.status === "shown").map((d) => d.plate))]) {
  const ds = decided.filter((d) => d.plate === plate);
  rules.push({ match: fold(ds.map((d) => d.id)), status: "shown", bundle: [...new Set(ds.map((d) => d.bundle))].sort(), plate });
}
for (const [r, n] of [["2-nfhs-4", 4], ["3-nfhs-5", 5]]) {
  const ds = decided.filter((d) => d.status === "baked" && d.id.split(":")[3] === r);
  if (ds.length) rules.push({ match: `nfhs:*:*:${r}:*`, status: "baked", bundle: [...new Set(ds.map((d) => d.bundle))].sort() });
}
const head = `# Coverage ledger: National Family Health Survey, NFHS-4 (2015-16) and NFHS-5 (2019-21)
# (docs/CONTRACT-coverage.md). Catalogue: node scripts/lib/products/nfhs.mjs --catalogue.
# WRITTEN BY node scripts/lib/products/nfhs-ledger.mjs from the catalogue, the baked bundles
# and the guide's plates: edit that script (its PLATES table mirrors src/pages/guides/nfhs.astro),
# not this file. Every item is one sub-indicator in one round, for India, one state or one sector.
# Every published cell is baked (one bundle per round per table); the exclusions below are the
# NFHS-4 lines MoSPI misfiles or mislabels, sub-indicators a round did not carry, places that
# did not exist in a round, and cells the fact sheets suppress.
`;
const counts = decided.reduce((a, d) => ((a[d.status] = (a[d.status] ?? 0) + 1), a), {});
const doc = { family: "nfhs", guides: ["nfhs"], catalogue: "data/coverage/nfhs.catalogue.json", rules };
fs.writeFileSync(path.join(ROOT, "data/coverage/nfhs.yml"), head + YAML.stringify(doc, { lineWidth: 0 }));
console.log("nfhs ledger:", JSON.stringify(counts), rules.length, "rules");
