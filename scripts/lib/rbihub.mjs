// scripts/lib/rbihub.mjs: the client for the Reserve Bank Innovation Hub's DBIE data service
// (data-api.dbie.rbihub.in, behind the dbie.rbihub.in site). Probed 2026-10-10; notes in
// docs/reference/rbihub.md.
//
// What it is: a database mirror of RBI DBIE's report exports (1,430 catalogue entries keyed
// by DBIE report id, 797 tables loaded, 252 SDMX datasets). Rows are the report grids as
// exported (untyped columns c1..cN, with title and footnote rows), the same exports the local
// Data Bank holds. Use it ONLY where the Data Bank has no validated copy of a report (the
// reports DBIE gates behind an input prompt: urban co-operative banks, bank-wise variables,
// the Survey of Professional Forecasters, district credit, crop area, BSR table 1.2...) and
// for the SDMX datasets. For every report the Data Bank holds, the Data Bank is the record.
//
// Provenance to print: "Reserve Bank of India, DBIE, via the Reserve Bank Innovation Hub's
// data service". Where a report exists in both, cross-check before trusting either.
// Be polite: one request at a time (net.mjs throttles), CSV for whole tables, never loops
// over rows pages when /csv serves the table.
import { getJson, getText } from "./net.mjs";

export const RBIHUB_API = (process.env.INDIA_ATLAS_RBIHUB_API || "https://data-api.dbie.rbihub.in").replace(/\/+$/, "");

/** The whole catalogue: [{ entry_id, report_id, title, menu_path, frequency, kind, source,
 *  schema_name, table_name, status, row_count, period_from, period_to, notes, dsd_code }]. */
export async function rbihubCatalogue() {
  const out = [];
  for (let offset = 0; ; offset += 2000) {
    const res = await getJson(`${RBIHUB_API}/api/catalogue?limit=2000&offset=${offset}`);
    out.push(...(res.data ?? []));
    if (out.length >= (res.total ?? 0) || !(res.data ?? []).length) break;
  }
  return out;
}

/** One table's metadata and provenance (columns, layout, loaded_at, source files). */
export async function rbihubTable(schema, table) {
  return (await getJson(`${RBIHUB_API}/api/tables/${schema}/${table}`));
}

/** One table, whole, as CSV text (header row first). */
export async function rbihubCsv(schema, table) {
  return getText(`${RBIHUB_API}/api/tables/${schema}/${table}/csv`);
}

/** An SDMX code list. */
export async function rbihubCodelist(code) {
  return getJson(`${RBIHUB_API}/api/codelists/${code}`);
}

/** The catalogue entry for a DBIE report id that is actually loaded, or null. */
export function rbihubEntry(catalogue, reportId) {
  return catalogue.find((e) => e.report_id === reportId && e.status === "loaded") ?? null;
}
