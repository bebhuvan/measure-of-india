// src/dossiers/archive.js: what the deep archive holds for a bundle (docs/PLAN-launch.md §2b),
// read at build time from the committed data/archive/manifest.json (scripts/archive.mjs).
// Pages link a bundle to the archive tables that roll up to it ("Finer detail: N tables in the
// archive"); scripts/qc.mjs checks every such link points at a path the manifest lists. Before
// the first upload the links point at the planned paths on the dataset.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();   // builds run from the repository root (see periods.js)
export const ARCHIVE_URL = "https://huggingface.co/datasets/bebhuvan1/india-atlas-archive";
export const archiveHref = (p) => `${ARCHIVE_URL}/tree/main/${p}`;

let M = null;
export function archiveManifest() {
  if (!M) {
    const f = path.join(ROOT, "data/archive/manifest.json");
    M = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : { tables: [], raw: {} };
  }
  return M;
}

// the folder that holds a set of tables: their common directory in the archive
function commonDir(paths) {
  const parts = paths.map((p) => p.split("/").slice(0, -1));
  const out = [];
  for (let i = 0; parts.every((p) => i < p.length && p[i] === parts[0][i]); i++) out.push(parts[0][i]);
  return out.join("/");
}
function summary(tables) {
  const pq = tables.filter((t) => t.format === "parquet");
  if (!pq.length) return null;
  // a single table links to its own folder; several, to the folder that holds them all
  return { tables: pq.length, rows: pq.reduce((a, t) => a + (t.rows ?? 0), 0), dir: commonDir(pq.map((t) => t.path)), href: archiveHref(commonDir(pq.map((t) => t.path))) };
}

/** Archive tables that roll up to this bundle: { tables, rows, dir, href } or null. */
export function archiveFor(bundle) {
  return summary(archiveManifest().tables.filter((t) => (t.rolls_up_to ?? []).includes(bundle)));
}
/** Archive tables of one family, optionally narrowed (e.g. by rule): { tables, rows, dir, href } or null. */
export function archiveForFamily(family, pick = () => true) {
  return summary(archiveManifest().tables.filter((t) => t.family === family && pick(t)));
}
