#!/usr/bin/env node
// scripts/lib/products/gender-ledger.mjs: writes data/coverage/gender.yml, the coverage ledger
// for MoSPI's Women and Men in India (docs/CONTRACT-coverage.md), from the catalogue, the raw
// dump, the baked bundles and the guide's plates.
//
// Every catalogue item (an indicator, or one cut of it: a state, a sex, a sector, a crime
// head...) is decided in this order:
//   1. blocked: listed in MoSPI's own MCP definitions but not served by the API;
//   2. excluded: a cut the compendium prints only as "-" or "NR" in every period;
//   3. shown: drawn on a plate of src/pages/guides/gender.astro (PLATES mirrors the page);
//   4. baked: everything else, in the indicator's bundle(s).
// Run after node scripts/lib/products/gender.mjs --bake; node scripts/coverage.mjs checks it.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ROOT, idPart, valuePart } from "../catalogue.mjs";
import { parseNumber } from "../tabular.mjs";

const cat = JSON.parse(fs.readFileSync(path.join(ROOT, "data/coverage/gender.catalogue.json"), "utf8")).items;
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/gender-records.json"), "utf8"));
const bundlesOf = (code) => fs.readdirSync(path.join(ROOT, "data/series")).filter((f) => new RegExp(`^gender-t${String(code).padStart(3, "0")}(-[a-z0-9]+)?\\.json$`).test(f)).map((f) => f.slice(0, -5)).sort();
const nameOf = (v) => v.label ?? v.description ?? v[Object.keys(v).find((k) => /(_name|_label|description)$/.test(k))] ?? Object.values(v).find((x) => typeof x === "string") ?? "";

// catalogue cut id -> [code, filter dimension, value name]
const cutOf = new Map();
for (const [code, f0] of Object.entries(raw.filters)) {
  const f = Array.isArray(f0) ? f0[0] ?? {} : f0 ?? {};
  for (const [dim, vals] of Object.entries(f)) {
    if (!Array.isArray(vals) || !vals.length || typeof vals[0] !== "object" || ["year", "quarter", "month"].includes(dim)) continue;
    for (const v of vals) cutOf.set(`gender:${code}:${idPart(dim)}:${valuePart(v, { codes: dim !== "state" })}`, [code, dim, String(nameOf(v)).trim()]);
  }
}
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();
const rowKey = (rows, dim) => Object.keys(rows[0] ?? {}).find((k) => idPart(k) === idPart(dim)) ?? Object.keys(rows[0] ?? {}).find((k) => k.startsWith(dim.split("_")[0]));

/* ---------- the plates (mirrors src/pages/guides/gender.astro) ----------
 * [plate, code, cut dims drawn ("all" = the indicator's headline item), value filter] */
const PLATES = [
  ["§03 The count: sex ratio at birth", 7, ["all", "sector"]], ["§03 Sex ratio at birth by state", 7, ["state-ut"]],
  ["§03 Seven censuses", 2, ["all"]],
  ["§04 Infant deaths, girls and boys", 15, ["all", "gender"]], ["§04 Maternal deaths", 21, ["all"]], ["§04 Maternal deaths by state", 21, ["state-ut"]],
  ["§04 Life expectancy, women and men", 18, ["all", "gender"]],
  ["§05 Children per woman by schooling", 10, ["all", "education-level"]], ["§05 Age at marriage by state", 14, ["all", "state-ut"]],
  ["§06 Enrolment and dropout", 60, ["all", "gender", "education-level"]], ["§06 Enrolment and dropout", 74, ["all", "gender", "education-level"]],
  ["§06 Literacy, census and NSS", 55, ["all", "gender"]], ["§06 Years of schooling by state", 70, ["all", "gender", "state-ut"]],
  ["§07 Women and men at work, three PLFS rulers", 85, ["all", "gender"]], ["§07 Labour force participation by state", 82, ["all", "gender", "state-ut"]],
  ["§07 Rural casual wages by state", 87, ["all", "gender", "state-ut"], (dim, name) => dim !== "sector" || /rural/i.test(name)],
  ["§08 Unpaid and paid work, Time Use Survey", 103, ["all", "gender", "activity"], (dim, name) => dim !== "activity" || /paid/i.test(name)],
  ["§08 Unpaid and paid work, Time Use Survey", 104, ["all", "gender", "activity"], (dim, name) => dim !== "activity" || /^(unpaid|paid) activity$/i.test(name)],
  ["§09 Money in women's names", 111, ["all", "gender"]], ["§09 Money in women's names", 114, ["all", "gender"]], ["§09 Money in women's names", 109, ["all", "gender", "scheme"]],
  ["§09 Money in women's names", 113, ["all", "gender"]], ["§09 Money in women's names", 108, ["all"]], ["§09 Money in women's names", 115, ["all", "gender"]],
  ["§09 Money in women's names", 118, ["all", "gender"]],
  ["§10 Women's share of Lok Sabha seats", 124, ["all"]],
  ["§10 Voice and office", 125, ["all"]], ["§10 Voice and office", 126, ["all", "gender"]], ["§10 Voice and office", 127, ["all"]], ["§10 Voice and office", 130, ["all"]],
  ["§10 Voice and office", 123, ["all"]], ["§10 Voice and office", 131, ["all", "gender"]], ["§10 Voice and office", 172, ["all"]],
  ["§11 Crimes against women by state", 141, ["all", "state-ut"]], ["§11 Crimes by head", 140, ["all", "crime-head"]], ["§11 Convictions", 145, ["all", "crime-head"]],
  ["§12 What women and men die of", 160, ["all", "gender", "sub-indicator"]],
];

const blockedDate = "2026-10-10";
const decided = [];
for (const it of cat) {
  const p = it.id.split(":"), code = p[1];
  const rows = raw.indicators[code];
  if (!rows) { decided.push({ id: it.id, status: "blocked", code }); continue; }
  const bs = bundlesOf(code);
  if (!bs.length) throw new Error(`gender-ledger: no bundle for indicator ${code}`);
  let dim = "all", name = null;
  if (p[2] !== "all") {
    const c = cutOf.get(it.id);
    if (!c) throw new Error(`gender-ledger: catalogue cut ${it.id} not in the filter listing`);
    [, dim, name] = c;
    // a cut with no figure in any period is not baked
    const rk = rowKey(rows, dim);
    const hits = rk ? rows.filter((r) => norm(r[rk]) === norm(name) || (norm(name) === "india" && norm(r[rk]) === "all india")) : [];
    if (rk && hits.length && !hits.some((r) => parseNumber(r.value) != null)) { decided.push({ id: it.id, status: "excluded", code }); continue; }
    if (!rk && !/lok_sabha_election/.test(dim)) throw new Error(`gender-ledger: ${it.id}: no row column for ${dim}`);
  }
  const dimId = dim === "all" ? "all" : idPart(dim);
  const plate = PLATES.find(([, pc, dims, ok]) => String(pc) === code && dims.includes(dimId) && (!ok || ok(dim, name ?? "")))?.[0];
  decided.push(plate ? { id: it.id, status: "shown", plate, bundle: bs, code } : { id: it.id, status: "baked", bundle: bs, code });
}

const rules = [];
const blocked = decided.filter((d) => d.status === "blocked");
if (blocked.length) rules.push({ match: blocked.map((d) => d.id).sort(), status: "blocked",
  reason: `Listed in MoSPI's own definitions for its eSankhyiki MCP server (github.com/nso-india/esankhyiki-mcp, definitions/gender_definitions.json) but absent from the live indicator list; gender/getGenderRecords answers "No Data Found" for each (checked ${blockedDate}).` });
const excluded = decided.filter((d) => d.status === "excluded");
if (excluded.length) rules.push({ match: excluded.map((d) => d.id).sort(), status: "excluded",
  reason: "The compendium prints this cut only as \"-\" (no observation) or \"NR\" (not reported) in every period it covers, so there is no figure to bake." });
// shown: one rule per plate; a whole cut dimension of an indicator folds to a glob
const universe = new Map();
for (const d of decided) { const k = d.id.split(":").slice(0, 3).join(":"); (universe.get(k) ?? universe.set(k, []).get(k)).push(d.id); }
const fold = (ids) => {
  const set = new Set(ids), out = [];
  for (const k of [...new Set(ids.map((id) => id.split(":").slice(0, 3).join(":")))]) {
    const all = universe.get(k);
    if (!k.endsWith(":all") && all.every((id) => set.has(id))) out.push(k + ":*");
    else out.push(...all.filter((id) => set.has(id)));
  }
  return out.sort();
};
for (const plate of [...new Set(decided.filter((d) => d.status === "shown").map((d) => d.plate))]) {
  const ds = decided.filter((d) => d.plate === plate);
  rules.push({ match: fold(ds.map((d) => d.id)), status: "shown", bundle: [...new Set(ds.flatMap((d) => d.bundle))].sort(), plate });
}
// baked: one rule per indicator
for (const code of [...new Set(decided.filter((d) => d.status === "baked").map((d) => d.code))].sort((a, b) => a - b)) {
  rules.push({ match: `gender:${code}:*`, status: "baked", bundle: bundlesOf(code) });
}
const head = `# Coverage ledger: Women and Men in India 2025, MoSPI's gender compendium (docs/CONTRACT-coverage.md).
# Catalogue: node scripts/lib/products/gender.mjs --catalogue (the live indicator list, each
# indicator's filter listing, and the codes MoSPI's MCP definitions list that the API no longer serves).
# WRITTEN BY node scripts/lib/products/gender-ledger.mjs from the catalogue, the raw dump, the
# baked bundles and the guide's plates: edit that script (its PLATES table mirrors
# src/pages/guides/gender.astro), not this file. Every served indicator is baked in full (one
# bundle per indicator, split by instrument where the compendium joins two); the plates draw
# the cuts named below.
`;
const counts = decided.reduce((a, d) => ((a[d.status] = (a[d.status] ?? 0) + 1), a), {});
fs.writeFileSync(path.join(ROOT, "data/coverage/gender.yml"), head + YAML.stringify({ family: "gender", guides: ["gender"], catalogue: "data/coverage/gender.catalogue.json", rules }, { lineWidth: 0 }));
console.log("gender ledger:", JSON.stringify(counts), rules.length, "rules");
