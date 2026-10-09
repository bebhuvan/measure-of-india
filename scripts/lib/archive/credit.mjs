// scripts/lib/archive/credit.mjs: deep-archive export for the credit family. Each archive rule
// is one whole DBIE report (`match: dbie:<report id>`), read from the Data Bank's webi mirror
// (read-only) and streamed, never held in memory (the largest run past 500 MB unpacked).
//
// Shape. RBI reports come in two layouts:
//   - the "Dimension 1..4 / Measure 1..15" grid (BSR tables): unpivoted to one value per row,
//     with the measure named by its column ("Measure 3"), since DBIE serves no measure labels;
//   - named columns (bank, state, time, item, amount...): already one observation per row,
//     kept with the columns RBI published.
// Both gain report_id, provider, source and vintage. Where a report repeats every value once per
// display unit ("Unit Description": ACTUALS, THOUSANDS, LAKHS, CRORES...), only the ACTUALS rows
// are kept: the other units are the same figure rescaled (docs/briefs/README.md).
//
// Check: a pre-scan counts the rows per display unit; their total must equal the Data Bank's
// own row count for the provider, and the export must write exactly the ACTUALS rows (or all
// rows, where the report has no unit column).
import { databankRoot, dbieLocate, dbieRows } from "../databank.mjs";
import { sourceCfg } from "../catalogue.mjs";

const SOURCE = "Reserve Bank of India, Database on Indian Economy (DBIE), via the Data Bank mirror";
const MEASURE = /^Measure (\d+)$/, DIMENSION = /^Dimension (\d+)$/;

export async function* tables({ rules, log }) {
  const { cfg } = sourceCfg("credit");
  const root = databankRoot(cfg?.families?.databank);
  for (const { rule } of rules) {
    for (const m of [].concat(rule.match)) {
      const id = String(m).match(/^dbie:(\d+)$/)?.[1];
      if (!id) throw new Error(`archive credit: rule ${m} is not a dbie:<report> rule; give it an export here`);
      const loc = dbieLocate(root, id);
      // pre-scan: header and rows per display unit
      let header = null;
      const units = new Map();
      let total = 0;
      for await (const r of dbieRows(root, id)) {
        header ??= Object.keys(r);
        total++;
        const u = r["Unit Description"];
        if (u != null) units.set(u, (units.get(u) ?? 0) + 1);
      }
      if (loc.rowCount != null && total !== loc.rowCount) throw new Error(`archive credit: report ${id} streams ${total} rows, the Data Bank records ${loc.rowCount}`);
      const unitFilter = header.includes("Unit Description") && units.has("ACTUALS") ? "ACTUALS" : null;
      const grid = header.some((h) => MEASURE.test(h));
      const vintage = String(loc.retrieved_at).slice(0, 10);
      const base = { source: SOURCE, report_id: id, provider: loc.provider, vintage };
      let columns, expectedRows;
      const keep = (r) => !unitFilter || r["Unit Description"] === unitFilter;
      if (grid) {
        const dims = header.filter((h) => !MEASURE.test(h));
        const measures = header.filter((h) => MEASURE.test(h));
        columns = [...dims.map(colName), "measure", "value", "report_id", "provider", "source", "vintage"];
        expectedRows = null;   // the unpivot drops empty measure cells; counted against the scan below
        const rows = async function* () {
          for await (const r of dbieRows(root, id)) {
            if (!keep(r)) continue;
            for (const mm of measures) {
              const v = r[mm];
              if (v === "" || v == null) continue;
              yield [...dims.map((d) => r[d]), mm, v, id, loc.provider, SOURCE, vintage];
            }
          }
        };
        // the cells the unpivot must write: non-empty measure cells in kept rows
        let cells = 0;
        for await (const r of dbieRows(root, id)) if (keep(r)) for (const mm of measures) if (r[mm] !== "" && r[mm] != null) cells++;
        expectedRows = cells;
        log(`credit dbie:${id}: ${total} rows, grid of ${measures.length} measures, ${cells} non-empty cells`);
        yield { table: `dbie-${id}`, title: `DBIE report ${id}, unpivoted (one measure value per row)`, source: SOURCE, rule: m, rolls_up_to: [].concat(rule.rolls_up_to ?? []),
          vintage, columns, rows: rows(), expectedRows, expectedNote: `non-empty measure cells of the ${unitFilter ?? "all"} rows; the report's ${total} rows match the Data Bank's count` };
      } else {
        columns = [...header.map(colName), "report_id", "provider", "source", "vintage"];
        expectedRows = unitFilter ? units.get(unitFilter) : total;
        log(`credit dbie:${id}: ${total} rows${unitFilter ? `, ${expectedRows} in ACTUALS (of ${units.size} display units)` : ""}`);
        const rows = async function* () {
          for await (const r of dbieRows(root, id)) if (keep(r)) yield [...header.map((h) => r[h]), id, loc.provider, SOURCE, vintage];
        };
        yield { table: `dbie-${id}`, title: `DBIE report ${id}, as published${unitFilter ? " (ACTUALS rows)" : ""}`, source: SOURCE, rule: m, rolls_up_to: [].concat(rule.rolls_up_to ?? []),
          vintage, columns, rows: rows(), expectedRows, expectedNote: `${unitFilter ? "ACTUALS rows of the" : "all"} ${total} rows the Data Bank records for provider ${loc.provider}` };
      }
      void base;
    }
  }
}

// DBIE column names ("Time Date", "Key2 Description 1") as snake_case column names
const colName = (h) => String(h).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "column";
