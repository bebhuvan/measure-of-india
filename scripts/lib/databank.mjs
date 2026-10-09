// scripts/lib/databank.mjs: the family client for the local Data Bank
// (~/Documents/Data/Data bank, a validation-first data lake; see its AGENTS.md).
//
// The Data Bank mirrors RBI DBIE's statistical reports through SAP Web Intelligence
// (dataset `rbi_dbie_webi_rows`). Each fetch stores, per report, a manifest and one gzip CSV
// per data provider, with a metadata JSON that names the report and provider. We read those
// files directly, read-only: no database driver, no network. The latest validated fetch of
// each (report, data provider) wins, which is how the Data Bank's own parser chooses too.
//
// The Data Bank root comes from INDIA_ATLAS_DATABANK (or the families.databank.root in
// data/sources.yml). If it is missing, the adapter fails loudly rather than baking nothing.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

export function databankRoot(familyCfg) {
  const p = process.env.INDIA_ATLAS_DATABANK || (familyCfg?.root ?? "").replace(/^~(?=\/)/, os.homedir());
  if (!p || !fs.existsSync(path.join(p, "data/raw/metadata"))) {
    throw new Error(`databank: Data Bank not found at "${p}". Set INDIA_ATLAS_DATABANK or families.databank.root in data/sources.yml.`);
  }
  return p;
}

let INDEX = null;
/** Map "reportId|providerId" -> { content, meta, retrieved } for the latest webi flow fetches. */
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

/** The largest data provider of a DBIE report, parsed: { header, rows, provenance }.
 *  Small providers are SAP unit pickers ("Unit;Unit Description"), never the data. */
export function dbieReport(root, reportId) {
  const cands = [...index(root).entries()].filter(([k]) => k.startsWith(reportId + "|")).map(([, v]) => v);
  if (!cands.length) throw new Error(`databank: DBIE report ${reportId} is not in the Data Bank mirror`);
  const best = cands.sort((a, b) => (b.meta.dataprovider.rowCount ?? 0) - (a.meta.dataprovider.rowCount ?? 0))[0];
  let buf = fs.readFileSync(best.content);
  if (best.meta.stored_encoding === "gzip") buf = zlib.gunzipSync(buf);
  const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
  const split = (l) => l.split(";").map((x) => x.replace(/^"|"$/g, "").trim());
  const header = split(lines[0]);
  const rows = lines.slice(1).map(split).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  return {
    header, rows,
    provenance: { report_id: reportId, data_provider: best.meta.dataprovider.id, rows: rows.length,
      retrieved_at: best.retrieved, sha256: best.sha256, document_id: best.meta.document_id },
  };
}
