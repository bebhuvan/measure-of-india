// scripts/lib/products/plfs-cube.mjs: the whole PLFS cube, as MoSPI serves it.
//
// One call set per indicator x frequency x year (x year type), every page, NO filters: the
// eSankhyiki getData endpoint answers an unfiltered query with every cell it holds for that
// indicator-year (states x gender x sector x age x weekly status x religion x social group x
// education for indicators 1-3; status, industry, NIC, NCO, enterprise and contract cuts for 4;
// contract conditions for 5; quarters x states x gender x sector for earnings 6-8). Probed
// 2026-10-09: indicator 3, 2023-24 agriculture year, 5,139 rows unfiltered against 57 for the
// headline filter (All India, person, 15+).
//
// Archive: data/raw/plfs/<freq>/<indicator>-<year>[-<year type>].json.gz, one gzipped JSON per
// call set ({ params, retrieved, totalRecords, rows }), rows exactly as served. A file is
// rewritten only when its rows change (the old one moves to data/raw/plfs/vintages/), so the
// retrieval date of an unchanged file stays the date its data was first seen (hard rule 5).
// data/raw/plfs-index.json lists every file with rows and sha256 of the rows.
//
// Resumable: every page goes through scripts/lib/mospi.mjs (one request at a time, throttle,
// backoff, an on-disk response cache). Run with MOSPI_CACHE_TTL_H=240 so a long run that dies
// picks up where it stopped. Standalone: node scripts/lib/products/plfs-cube.mjs [--only <freq>]

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { mospiAll } from "../mospi.mjs";

const EP = "plfs/getData";
export const AGRI_YEARS = ["2017-18", "2018-19", "2019-20", "2020-21", "2021-22", "2022-23", "2023-24"];
// calendar-year estimates: 2022 to 2024 from the original design, 2025 on from the revamped
// one; the current year is asked for too (an unpublished year answers with no rows)
export const CAL_YEARS = Array.from({ length: new Date().getUTCFullYear() - 2021 }, (_, i) => String(2022 + i));

// every call set, in the order fetched (small and new first)
export function cubeCalls(endYear = new Date().getUTCFullYear()) {
  const calls = [];
  for (let y = 2025; y <= endYear; y++) for (const ic of [1, 2, 3]) calls.push({ freq: "monthly", ic, year: String(y), params: { indicator_code: ic, frequency_code: 3, year: y } });
  for (let y = 2018; y <= endYear; y++) for (const ic of [1, 2, 3, 4]) calls.push({ freq: "quarterly", ic, year: String(y), params: { indicator_code: ic, frequency_code: 2, year: y } });
  for (const ic of [5, 6, 7, 8]) for (const y of AGRI_YEARS) calls.push({ freq: "annual", ic, year: y, yt: "agri", params: { indicator_code: ic, frequency_code: 1, year: y, year_type_code: 1 } });
  for (const ic of [6, 7, 8]) for (const y of CAL_YEARS) calls.push({ freq: "annual", ic, year: y, yt: "cal", params: { indicator_code: ic, frequency_code: 1, year: y, year_type_code: 2 } });
  for (const ic of [1, 2, 3]) {
    for (const y of AGRI_YEARS) calls.push({ freq: "annual", ic, year: y, yt: "agri", params: { indicator_code: ic, frequency_code: 1, year: y, year_type_code: 1 } });
    for (const y of CAL_YEARS) calls.push({ freq: "annual", ic, year: y, yt: "cal", params: { indicator_code: ic, frequency_code: 1, year: y, year_type_code: 2 } });
  }
  for (const y of CAL_YEARS) calls.push({ freq: "annual", ic: 4, year: y, yt: "cal", params: { indicator_code: 4, frequency_code: 1, year: y, year_type_code: 2 } });
  for (const y of AGRI_YEARS) calls.push({ freq: "annual", ic: 4, year: y, yt: "agri", params: { indicator_code: 4, frequency_code: 1, year: y, year_type_code: 1 } });
  return calls;
}

export const cubeFile = (c) => `data/raw/plfs/${c.freq}/${c.ic}-${c.year}${c.yt ? "-" + c.yt : ""}.json.gz`;

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const stableRows = (rows) => rows.map((r) => JSON.stringify(r, Object.keys(r).sort())).sort().join("\n");

export function readCubeFile(root, c) {
  const p = path.join(root, cubeFile(c));
  if (!fs.existsSync(p)) return null;
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(p)).toString("utf8"));
}

// all rows of one frequency (and indicator), each tagged with the call that served it
export function cubeRows(root, { freq, ic, yt } = {}) {
  const out = [];
  for (const c of cubeCalls()) {
    if (freq && c.freq !== freq) continue;
    if (ic != null && c.ic !== ic) continue;
    if (yt && c.yt !== yt) continue;
    const f = readCubeFile(root, c);
    if (!f) continue;
    for (const r of f.rows) out.push(r);
  }
  return out;
}

async function fetchCall(root, c, today) {
  let rows;
  try {
    rows = await mospiAll(EP, c.params);
  } catch (e) {
    return { ...c, error: e.message.slice(0, 200) };
  }
  // a calendar-year call answered with another year's rows would be mislabelled: keep only
  // rows whose year is the one asked for
  const asked = rows.filter((r) => String(r.year) === c.year);
  const dropped = rows.length - asked.length;
  const rel = cubeFile(c), p = path.join(root, rel);
  const body = stableRows(asked);
  const prev = readCubeFile(root, c);
  if (prev && stableRows(prev.rows) === body) return { ...c, rows: asked.length, dropped, sha256: sha(body), retrieved: prev.retrieved, unchanged: true };
  if (prev) {
    const v = path.join(root, "data/raw/plfs/vintages", path.basename(rel).replace(".json.gz", `.${prev.retrieved}.json.gz`));
    fs.mkdirSync(path.dirname(v), { recursive: true });
    fs.copyFileSync(p, v);
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const out = { params: c.params, retrieved: today, totalRecords: rows.length, rows: asked };
  fs.writeFileSync(p + ".tmp", zlib.gzipSync(JSON.stringify(out), { level: 9 }));
  fs.renameSync(p + ".tmp", p);
  return { ...c, rows: asked.length, dropped, sha256: sha(body), retrieved: today };
}

// mode "all": every call set; "missing": only call sets not archived yet; "recent" (the release-cycle default): call sets not archived
// yet, plus the ones a new release can change (bulletins of this and last year, the latest
// calendar year, the latest agriculture year). Older call sets are final on release.
export async function fetchPlfsCube(root, { only, mode = "all" } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const idxPath = path.join(root, "data/raw/plfs-index.json");
  const idx = fs.existsSync(idxPath) ? JSON.parse(fs.readFileSync(idxPath, "utf8")) : { files: {} };
  const thisYear = new Date().getUTCFullYear();
  const live = (c) => !fs.existsSync(path.join(root, cubeFile(c))) || idx.files[cubeFile(c)]?.error ||
    (c.yt === "agri" ? c.year === AGRI_YEARS.at(-1) : Number(c.year) >= thisYear - 1);
  const missing = (c) => !fs.existsSync(path.join(root, cubeFile(c))) || idx.files[cubeFile(c)]?.error;
  const calls = cubeCalls().filter((c) => (!only || c.freq === only) && (mode === "all" || (mode === "missing" ? missing(c) : live(c))));
  let n = 0;
  for (const c of calls) {
    const r = await fetchCall(root, c, today);
    n++;
    const rel = cubeFile(c);
    if (r.error) {
      // an empty or failing call set is recorded, never silently skipped
      idx.files[rel] = { params: c.params, error: r.error, checked: today };
      process.stdout.write(`plfs cube ${n}/${calls.length} ${rel}: ERROR ${r.error}\n`);
    } else {
      idx.files[rel] = { params: c.params, rows: r.rows, droppedOtherYear: r.dropped || undefined, sha256: r.sha256, retrieved: r.retrieved };
      process.stdout.write(`plfs cube ${n}/${calls.length} ${rel}: ${r.rows} rows${r.unchanged ? " (unchanged)" : ""}${r.dropped ? `, ${r.dropped} other-year rows dropped` : ""}\n`);
    }
    idx.note = "Every call set of the PLFS cube (scripts/lib/products/plfs-cube.mjs): file, request params, rows kept, sha256 of the sorted rows, date first seen.";
    idx.files = Object.fromEntries(Object.entries(idx.files).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(idxPath + ".tmp", JSON.stringify(idx, null, 1) + "\n");
    fs.renameSync(idxPath + ".tmp", idxPath);
  }
  return idx;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const i = process.argv.indexOf("--only");
  await fetchPlfsCube(root, { only: i > 0 ? process.argv[i + 1] : undefined, mode: process.argv.includes("--recent") ? "recent" : process.argv.includes("--missing") ? "missing" : "all" });
}
