// scripts/lib/products/asi-raw.mjs: the complete ASI table, every block, every indicator.
//
// asi/getASIData filtered by classification_year and indicator_code only returns the whole
// published table of that indicator: All India and every state, all industries and every
// NIC code at 2, 3 and 4 digits, every survey year (2008 block, indicator 19: 40,471 rows).
// The four blocks together are about 3.4 million rows (2008: 2,266,348), paged at the
// eSankhyiki cap of 100 rows: about 34,000 calls, one at a time through scripts/lib/mospi.mjs.
//
// Too large for git (PLAN-launch §2b): each (block, indicator) table is stored as served,
// gzipped JSON, in the git-ignored deep-archive staging folder
//   data/archive/staging/asi-raw/<block>-<indicator>.json.gz
// and data/raw/asi-index.json (committed) lists every file with its row count, the row
// count the endpoint reported, retrieval time and sha256, so the audit trail stays
// verifiable from git. A file that already exists is not fetched again: a run that dies
// resumes at the next missing table (and mospi.mjs's page cache resumes inside a table).
//
//   node scripts/lib/products/asi-raw.mjs            fetch every missing table
//   node scripts/lib/products/asi-raw.mjs 2008 19    one table
//
// Checks on every table: rows collected equal the endpoint's totalRecords (mospiAll), and no
// (year, state, sector, nic_type, nic_code) key repeats with a different value except the
// documented NIC 99999 copies (one per nic_type), so unstable paging cannot pass unnoticed.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { mospi, mospiAll } from "../mospi.mjs";

export const ASI_RAW_DIR = "data/archive/staging/asi-raw";
export const ASI_INDEX = "data/raw/asi-index.json";
export const ASI_BLOCKS = [2008, 2004, 1998, 1987];

const file = (root, cy, code) => path.join(root, ASI_RAW_DIR, `${cy}-${code}.json.gz`);

export async function asiFilter(cy) {
  return (await mospi("asi/getAsiFilter", { classification_year: cy })).data ?? {};
}

/** Rows of one (block, indicator) table from staging, or null when not fetched yet. */
export function readAsiRaw(root, cy, code) {
  const p = file(root, cy, code);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString("utf8"));
}

function readIndex(root) {
  const p = path.join(root, ASI_INDEX);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
}

function writeIndex(root, entries) {
  const files = Object.values(entries).sort((a, b) => b.block - a.block || a.indicator - b.indicator);
  const body = {
    note: "Index of the ASI raw archive: every indicator table of every NIC block as served by asi/getASIData (classification_year + indicator_code, all pages), gzipped JSON in the deep-archive staging folder (PLAN-launch §2b). sha256 is of the stored .json.gz file; rows are as served (NIC 99999 rows once per nic_type).",
    root: ASI_RAW_DIR, tables: files.length, rows: files.reduce((a, f) => a + f.rows, 0), files,
  };
  fs.writeFileSync(path.join(root, ASI_INDEX), JSON.stringify(body, null, 1) + "\n");
}

const keyOf = (r) => [r.year, r.state, r.sector, r.nic_type, r.nic_code].join("|");

// mospi.mjs caches every page it fetches (data/raw/http-cache), which is what lets a table
// resume mid-way. Once a table is safely staged its ~400 cached pages are dead weight (about
// 35 KB each, 1.2 GB for every table), so they are removed. The URL is rebuilt exactly as
// mospi()/mospiAll() build it.
function purgePageCache(root, cy, code, pages) {
  for (let page = 1; page <= pages; page++) {
    const qs = new URLSearchParams({ classification_year: String(cy), indicator_code: String(code), page: String(page), limit: "100" });
    const url = "https://api.mospi.gov.in/api/asi/getASIData?" + qs.toString();
    const f = path.join(root, "data/raw/http-cache", crypto.createHash("sha1").update(url).digest("hex") + ".json");
    try { fs.unlinkSync(f); } catch { /* not cached */ }
  }
}

async function fetchTable(root, cy, ind) {
  const t0 = Date.now();
  const rows = await mospiAll("asi/getASIData", { classification_year: cy, indicator_code: ind.indicator_code });
  // paging stability: a repeated key with a different value means pages overlapped
  const seen = new Map();
  let clash = 0;
  for (const r of rows) {
    const k = keyOf(r);
    if (seen.has(k) && seen.get(k) !== r.value && r.nic_code !== "99999") clash++;
    seen.set(k, r.value);
  }
  if (clash) throw new Error(`asi raw ${cy}-${ind.indicator_code}: ${clash} repeated keys with different values (unstable paging?)`);
  const gz = zlib.gzipSync(JSON.stringify(rows), { level: 9 });
  const p = file(root, cy, ind.indicator_code);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p + ".tmp", gz);
  fs.renameSync(p + ".tmp", p);
  purgePageCache(root, cy, ind.indicator_code, Math.ceil(rows.length / 100));
  process.stdout.write(`asi raw ${cy}-${ind.indicator_code} (${ind.indicator_name}): ${rows.length} rows, ${Math.round((Date.now() - t0) / 1000)}s\n`);
  return {
    file: path.relative(path.join(root, ASI_RAW_DIR), p), block: cy, indicator: Number(ind.indicator_code), name: ind.indicator_name,
    rows: rows.length, retrieved_at: new Date().toISOString(), sha256: crypto.createHash("sha256").update(gz).digest("hex"),
  };
}

/** Make sure every (block, indicator) table is staged; returns the index entries. */
export async function ensureAsiRaw(root, { blocks = ASI_BLOCKS, only = null } = {}) {
  const prev = readIndex(root);
  const entries = Object.fromEntries((prev?.files ?? []).map((f) => [`${f.block}-${f.indicator}`, f]));
  for (const cy of blocks) {
    const f = await asiFilter(cy);
    for (const ind of f.indicator ?? []) {
      if (only && String(ind.indicator_code) !== String(only)) continue;
      const k = `${cy}-${ind.indicator_code}`;
      if (fs.existsSync(file(root, cy, ind.indicator_code)) && entries[k]) continue;
      entries[k] = await fetchTable(root, cy, ind);
      writeIndex(root, entries);
    }
  }
  writeIndex(root, entries);
  return entries;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const [cy, only] = process.argv.slice(2);
  await ensureAsiRaw(ROOT, { blocks: cy ? [Number(cy)] : ASI_BLOCKS, only });
}
