// scripts/lib/products/dbie-providers.mjs: read ONE named data provider of a DBIE report from
// the Data Bank's webi mirror. databank.mjs's dbieReport() returns the largest provider only;
// several trade reports carry two classifications in two providers ("Old" 1987-88 to 2013-14
// and "New" 2009-10 onward), which are different rulers and must be read apart.
// Same index rule as databank.mjs: the latest validated fetch of each (report, provider) wins.
// Read-only. (Candidate to fold into scripts/lib/databank.mjs; kept here to avoid editing a
// shared framework file during the parallel build.)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { parseCsv } from "../tabular.mjs";

let INDEX = null;
function index(root) {
  if (INDEX) return INDEX;
  INDEX = new Map();
  const base = path.join(root, "data/raw/metadata/rbi_dbie/rbi_dbie_webi_rows");
  for (const run of fs.readdirSync(base)) {
    const dir = path.join(base, run);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const m = j.metadata || {};
      if (m.webi_role !== "flow" || !m.report_id || !m.dataprovider?.id) continue;
      const key = `${m.report_id}|${m.dataprovider.id}`;
      const prev = INDEX.get(key);
      if (!prev || j.retrieved_at > prev.retrieved) INDEX.set(key, { content: j.content_path, meta: m, retrieved: j.retrieved_at, sha256: j.sha256 });
    }
  }
  return INDEX;
}

/** Providers of a report: [{ id, name, rows }]. */
export function dbieProviders(root, reportId) {
  return [...index(root).entries()].filter(([k]) => k.startsWith(reportId + "|"))
    .map(([, v]) => ({ id: v.meta.dataprovider.id, name: v.meta.dataprovider.name, rows: v.meta.dataprovider.rowCount ?? null }));
}

/** One provider, parsed: { header, rows, provenance }. Throws if the provider is absent. */
export function dbieProvider(root, reportId, providerId) {
  const hit = index(root).get(`${reportId}|${providerId}`);
  if (!hit) throw new Error(`databank: DBIE report ${reportId} provider ${providerId} is not in the Data Bank mirror`);
  let buf = fs.readFileSync(hit.content);
  if (hit.meta.stored_encoding === "gzip") buf = zlib.gunzipSync(buf);
  // a real CSV parse, as databank.mjs does: quoted DBIE text can hold ";"
  const table = parseCsv(buf.toString("utf8"), ";").filter((r) => r.some((c) => String(c).trim() !== ""));
  const header = table[0].map((x) => String(x).trim());
  const rows = table.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, String(cells[i] ?? "").trim()])));
  return { header, rows, provenance: { report_id: reportId, data_provider: providerId, provider_name: hit.meta.dataprovider.name,
    rows: rows.length, retrieved_at: hit.retrieved, sha256: hit.sha256, document_id: hit.meta.document_id } };
}
