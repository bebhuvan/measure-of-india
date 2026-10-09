// scripts/lib/archive/ilo.mjs: deep-archive export for the ILO family. The archive rules hold
// the survey cubes the bake leaves out (three-way annual tables, quarterly tables beyond the
// baked cuts). They are re-read from ILOSTAT's SDMX API (scripts/lib/ilostat.mjs, cached and
// polite) flow by flow, and every India observation whose catalogue item (the adapter's own
// itemIdOf) falls under an archive rule is written, one row per observation.
//
// Check: the rows written per rule equal the sum of `observations` over the rule's catalogue
// items, the catalogue's own count.
import * as ilo from "../ilostat.mjs";
import { itemIdOf, iloCutsOf } from "../products/ilostat.mjs";
import fs from "node:fs";
import { readRaw } from "../util.mjs";
import path from "node:path";

const SOURCE = "International Labour Organization, ILOSTAT (SDMX API)";

export async function* tables({ rules, root, log }) {
  const vintage = readRaw(root, "data/raw/ilo-plfs.json").vintage ?? null;
  // flow -> the rules that claim some of its items
  const byFlow = new Map();
  for (const r of rules) for (const it of r.items) {
    const f = it.dims?.flow;
    if (!f) throw new Error(`archive ilo: item ${it.id} names no flow`);
    if (!byFlow.has(f)) byFlow.set(f, new Map());
    const m = byFlow.get(f);
    if (!m.has(r)) m.set(r, new Set());
    m.get(r).add(it.id);
  }
  const listed = new Map((await ilo.dataflows()).map((f) => [f.id, f]));
  for (const [flowId, ruleItems] of [...byFlow].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const meta = listed.get(flowId);
    if (!meta) throw new Error(`archive ilo: flow ${flowId} is no longer listed by ILOSTAT`);
    const c = await ilo.constraint(flowId);
    const { dims, rows } = await ilo.data(flowId, c.dims.length, "IND");
    const f = { ...meta, dims };
    const cuts = iloCutsOf(dims);
    const labels = {};
    for (const d of cuts) {
      try { labels[d] = await ilo.codelist(`CL_${d}`); } catch { labels[d] = new Map(); }
    }
    for (const [rule, ids] of ruleItems) {
      const keep = rows.filter((r) => ids.has(itemIdOf(f, r)));
      const expected = rule.items.filter((it) => it.dims.flow === flowId).reduce((a, it) => a + (it.observations ?? 0), 0);
      const extra = Object.keys(keep[0] ?? {}).filter((k) => !["REF_AREA", "FREQ", "MEASURE", ...cuts, "TIME_PERIOD", "OBS_VALUE", "OBS_STATUS", "UNIT_MEASURE", "UNIT_MULT", "SOURCE"].includes(k));
      const columns = ["flow", "indicator", "ref_area", "freq", "measure", ...cuts.flatMap((d) => [d.toLowerCase(), `${d.toLowerCase()}_label`]),
        "time_period", "value", "obs_status", "unit_measure", "unit_mult", "survey", ...extra.map((k) => k.toLowerCase()), "source", "vintage"];
      log(`ilo ${flowId}: ${rows.length} India rows, ${keep.length} under ${[].concat(rule.rule.match).join(",")} (catalogue: ${expected})`);
      const out = async function* () {
        for (const r of keep) yield [flowId, meta.name, r.REF_AREA, r.FREQ, r.MEASURE, ...cuts.flatMap((d) => [r[d], labels[d].get(r[d])?.name ?? ""]),
          r.TIME_PERIOD, r.OBS_VALUE, r.OBS_STATUS ?? "", r.UNIT_MEASURE ?? "", r.UNIT_MULT ?? "", r.SOURCE ?? "", ...extra.map((k) => r[k] ?? ""), SOURCE, vintage];
      };
      const [, inst, freq] = [...ids][0].split(":");
      yield { table: `${inst}-${freq}-${flowId.replace(/^DF_/, "").toLowerCase()}`, title: `${meta.name} (${inst.toUpperCase()}, ILO processing), every cut not baked`,
        source: SOURCE, rule: [].concat(rule.rule.match).join(", "), rolls_up_to: [].concat(rule.rule.rolls_up_to ?? []), vintage,
        columns, rows: out(), expectedRows: expected, expectedNote: "sum of `observations` over the rule's catalogue items for this flow" };
    }
  }
}
