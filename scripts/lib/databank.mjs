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
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
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

/** Rows from one of the Data Bank's parsed datasets (policy rates, MPC votes, sectoral
 *  credit, BIS, IMF, World Bank, India Data Hub...), through the Data Bank's own CLI:
 *  `uv run databank query sql <dataset> "<sql>" --json`, so its publication rules choose
 *  which parse runs count, not us. `{table}` in the SQL is the dataset view. The SQL must
 *  carry an ORDER BY: raw archives are diffed, so row order has to be deterministic.
 *  The view can hold the same observation once per parse run: SELECT DISTINCT (or group by
 *  the key and keep the latest source_retrieved_at) before baking.
 *  Returns { rows, provenance } and throws loudly on any CLI failure. */
export function databankQuery(root, dataset, sql) {
  if (!/\border\s+by\b/i.test(sql)) throw new Error(`databankQuery(${dataset}): SQL needs an ORDER BY so the archive is deterministic`);
  let out;
  try {
    out = execFileSync("uv", ["run", "--quiet", "databank", "query", "sql", dataset, sql, "--json"], {
      cwd: root, encoding: "utf8", maxBuffer: 1 << 30, stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    throw new Error(`databankQuery(${dataset}) failed: ${(e.stderr || e.message || "").toString().slice(0, 800)}`);
  }
  const start = out.indexOf("[");
  if (start < 0) throw new Error(`databankQuery(${dataset}): no JSON array in CLI output: ${out.slice(0, 300)}`);
  const rows = JSON.parse(out.slice(start));
  return {
    rows,
    provenance: { dataset, sql, rows: rows.length,
      sha256: crypto.createHash("sha256").update(out.slice(start)).digest("hex") },
  };
}

// credit (lb/credit): many DBIE reports carry several data providers (a "Final" and an "Old"
// table, a food-credit table beside the business table); dbieReport() keeps only the largest.
/** One named data provider of a DBIE report, parsed like dbieReport(). */
export function dbieProvider(root, reportId, providerId) {
  const hit = index(root).get(`${reportId}|${providerId}`);
  if (!hit) throw new Error(`databank: DBIE report ${reportId} has no data provider ${providerId} in the Data Bank mirror`);
  let buf = fs.readFileSync(hit.content);
  if (hit.meta.stored_encoding === "gzip") buf = zlib.gunzipSync(buf);
  const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
  const split = (l) => l.split(";").map((x) => x.replace(/^"|"$/g, "").trim());
  const header = split(lines[0]);
  const rows = lines.slice(1).map(split).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])));
  return {
    header, rows,
    provenance: { report_id: reportId, data_provider: providerId, rows: rows.length,
      retrieved_at: hit.retrieved, sha256: hit.sha256, document_id: hit.meta.document_id },
  };
}
