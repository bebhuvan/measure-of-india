#!/usr/bin/env node
// scripts/archive.mjs: the deep archive (docs/PLAN-launch.md §2b). Builds, checks and (only with
// --upload) publishes the finer grain the chart bundles cannot carry, to the public Hugging
// Face dataset bebhuvan1/india-atlas-archive.
//
//   npm run archive                      dry run: export, convert, check, write the manifest
//   node scripts/archive.mjs --upload    the same, then upload what changed (needs HF_TOKEN in .env)
//   --family <name>                      one family only (repeatable)
//   --staging <dir>                      staged files (default data/archive/staging)
//   --keep                               keep the built files after a dry run (default: hash, count, delete)
//
// Inputs:
//   1. every coverage ledger rule with `archive: true`, exported through the family's hook in
//      scripts/lib/archive/<family>.mjs (scripts/lib/archive/README.md);
//   2. staged tables, <staging>/<family>/files.json (each csv.gz with its row count), taken as
//      they are;
//   3. staged raw dumps, <staging>/<family>-raw/, with their committed index
//      data/raw/<family>-index.json (each file's sha256 and rows), uploaded as they are.
// Output (git-ignored): data/archive/build/tables/<family>/<table>/<vintage>/<table>.{parquet,csv.gz}.
// Raw files are uploaded from staging under raw/<family>/. The committed record is
// data/archive/manifest.json.
//
// Checks, all before anything leaves the machine (any failure stops the upload):
//   - row counts: each table against its expectation (the catalogue, the source's own count,
//     or the staging index); each raw file against its index entry (sha256 and rows);
//   - sha256 of every file, recorded in the manifest;
//   - Hugging Face limits: no file over 50 GB (warn over 5 GB), no folder over 10,000 files;
//   - no paid source: every input is scanned for India Data Hub, which must never be published.
// Idempotent: the manifest keeps each file's uploaded sha256 and commit; a re-run uploads only
// files whose sha256 changed.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const UPLOAD = args.includes("--upload");
// a dry run keeps nothing it has hashed and counted (the machine runs close to full; --upload
// rebuilds anyway): --keep retains the built files for inspection
const KEEP = UPLOAD || args.includes("--keep");
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ONLY = args.reduce((a, x, i) => (x === "--family" ? [...a, args[i + 1]] : a), []);
const STAGING = path.resolve(ROOT, opt("--staging") ?? "data/archive/staging");
const BUILD = path.join(ROOT, "data/archive/build");
const MANIFEST = path.join(ROOT, "data/archive/manifest.json");
export const REPO = "bebhuvan1/india-atlas-archive";
export const HF_BASE = `https://huggingface.co/datasets/${REPO}`;
const PAID = /india\s*data\s*hub|indiadatahub/i;
const LIMIT_FAIL = 50e9, LIMIT_WARN = 5e9, FOLDER_MAX = 10000;

const failures = [], warnings = [];
const fail = (m) => { failures.push(m); console.error("FAIL:", m); };
const log = (m) => console.log("  " + m);
const sha256File = (f) => new Promise((res, rej) => { const h = crypto.createHash("sha256"); fs.createReadStream(f).on("data", (d) => h.update(d)).on("end", () => res(h.digest("hex"))).on("error", rej); });
const toRe = (g) => new RegExp("^" + g.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
const csvCell = (v) => { const t = v == null ? "" : String(v); return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const python = () => {
  // system python3 with pyarrow when it has it; otherwise a throwaway uv environment
  try { execFileSync("python3", ["-c", "import pyarrow"], { stdio: "ignore" }); return ["python3"]; }
  catch { return ["uv", "run", "--no-project", "--with", "pyarrow", "python"]; }
};

/* ---------- inputs ---------- */
function archiveRules() {
  const out = new Map();   // family -> [{ rule, items }]
  const dir = path.join(ROOT, "data/coverage");
  for (const f of fs.readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort()) {
    const L = YAML.parse(fs.readFileSync(path.join(dir, f), "utf8")) || {};
    const rules = (L.rules ?? []).map((r) => ({ ...r, res: [].concat(r.match).map(toRe) }));
    if (!rules.some((r) => r.archive)) continue;
    const family = L.family ?? f.replace(/\.ya?ml$/, "");
    const items = JSON.parse(fs.readFileSync(path.join(ROOT, L.catalogue), "utf8")).items ?? [];
    const per = new Map(rules.filter((r) => r.archive).map((r) => [r, []]));
    for (const it of items) { const r = rules.find((x) => x.res.some((re) => re.test(it.id))); if (r?.archive) per.get(r).push(it); }
    out.set(family, [...per].map(([rule, its]) => { const { res, ...clean } = rule; return { rule: clean, items: its }; }));
  }
  return out;
}

/* ---------- writing one exported table ---------- */
async function writeTable(family, spec) {
  const rel = path.join("tables", family, spec.table, spec.vintage ?? "undated");
  const dir = path.join(BUILD, rel);
  fs.mkdirSync(dir, { recursive: true });
  const csvPath = path.join(dir, spec.table + ".csv.gz"), pqPath = path.join(dir, spec.table + ".parquet");
  const gz = zlib.createGzip({ level: 9 });
  const out = fs.createWriteStream(csvPath);
  gz.pipe(out);
  const done = new Promise((res, rej) => { out.on("finish", res); out.on("error", rej); });
  const write = (line) => (gz.write(line + "\n") ? null : new Promise((r) => gz.once("drain", r)));
  await write(spec.columns.map(csvCell).join(","));
  let rows = 0, paid = false;
  for await (const r of spec.rows) {
    if (r.length !== spec.columns.length) throw new Error(`archive ${family}/${spec.table}: a row has ${r.length} cells for ${spec.columns.length} columns`);
    const line = r.map(csvCell).join(",");
    if (!paid && PAID.test(line)) paid = true;
    const w = write(line); if (w) await w;
    rows++;
  }
  gz.end(); await done;
  if (paid) fail(`${family}/${spec.table}: the rows name India Data Hub, a paid source that must never be published`);
  if (spec.expectedRows != null && rows !== spec.expectedRows) fail(`${family}/${spec.table}: wrote ${rows} rows, expected ${spec.expectedRows} (${spec.expectedNote})`);
  const pq = JSON.parse(execFileSync(...((p) => [p[0], [...p.slice(1), path.join(ROOT, "scripts/lib/archive/parquet.py"), csvPath, pqPath]])(python()), { encoding: "utf8", maxBuffer: 1 << 26 }).trim().split("\n").at(-1));
  if (pq.rows !== rows) fail(`${family}/${spec.table}: Parquet holds ${pq.rows} rows, the csv ${rows}`);
  const files = [];
  for (const [local, fmt] of [[pqPath, "parquet"], [csvPath, "csv.gz"]]) {
    files.push({ path: path.join(rel, path.basename(local)).split(path.sep).join("/"), format: fmt, family, table: spec.table, title: spec.title,
      rule: spec.rule, source: spec.source, rolls_up_to: spec.rolls_up_to ?? [], vintage: spec.vintage ?? null, rows,
      expected_rows: spec.expectedRows ?? null, expected_note: spec.expectedNote ?? null,
      ...(spec.unserved?.length ? { unserved: spec.unserved, unserved_note: spec.unservedNote ?? null } : {}), bytes: fs.statSync(local).size, sha256: await sha256File(local), local });
  }
  log(`${family}/${spec.table}: ${rows.toLocaleString("en-IN")} rows, ${(files[0].bytes / 1e6).toFixed(1)} MB parquet`);
  if (!KEEP) for (const f of files) { fs.rmSync(f.local, { force: true }); }
  return files;
}

/* ---------- staged tables and raw dumps, taken as they are ---------- */
async function gzScan(file) {
  // stream a gzipped (or plain) file and report whether it names India Data Hub, and its lines
  let s = fs.createReadStream(file);
  if (file.endsWith(".gz")) s = s.pipe(zlib.createGunzip());
  let paid = false, lines = 0;
  for await (const line of readline.createInterface({ input: s, crlfDelay: Infinity })) { lines++; if (!paid && PAID.test(line)) paid = true; }
  return { paid, lines };
}
async function stagedTables(family, stagingDir, famRules, hook) {
  const idx = JSON.parse(fs.readFileSync(path.join(stagingDir, "files.json"), "utf8"));
  const out = [];
  for (const f of idx.files ?? []) {
    const src = path.join(stagingDir, path.basename(f.file));
    // which ledger rule the table comes from: the family hook decides (stagedRule), else the
    // only archive rule, else it is flagged
    const sr = hook?.stagedRule?.(f, famRules) ?? (famRules.length === 1 ? { rule: [].concat(famRules[0].rule.match).join(", "), rolls_up_to: [].concat(famRules[0].rule.rolls_up_to ?? []) } : null);
    if (!sr) fail(`${family}: staged ${f.file} matches no archive rule (add stagedRule to scripts/lib/archive/${family}.mjs)`);
    if (!fs.existsSync(src)) { fail(`${family}: staged ${f.file} is missing`); continue; }
    const table = path.basename(f.file).replace(/\.csv\.gz$/, "");
    const vintage = f.vintage ?? idx.vintage ?? null;
    const rel = path.join("tables", family, table, vintage ?? "staged");
    const dir = path.join(BUILD, rel); fs.mkdirSync(dir, { recursive: true });
    const csvPath = path.join(dir, table + ".csv.gz"), pqPath = path.join(dir, table + ".parquet");
    // a hard link, not a copy: the staged file is uploaded as it is, and costs no disk twice
    fs.rmSync(csvPath, { force: true });
    try { fs.linkSync(src, csvPath); } catch { fs.copyFileSync(src, csvPath); }
    const scan = await gzScan(csvPath);
    if (scan.paid) fail(`${family}/${table}: names India Data Hub`);
    const pq = JSON.parse(execFileSync(...((p) => [p[0], [...p.slice(1), path.join(ROOT, "scripts/lib/archive/parquet.py"), csvPath, pqPath]])(python()), { encoding: "utf8", maxBuffer: 1 << 26 }).trim().split("\n").at(-1));
    if (f.rows != null && pq.rows !== f.rows) fail(`${family}/${table}: ${pq.rows} rows, the staging index says ${f.rows}`);
    const vin = vintage ?? (await firstVintage(csvPath));
    for (const [local, fmt] of [[pqPath, "parquet"], [csvPath, "csv.gz"]]) {
      out.push({ path: path.join(rel, path.basename(local)).split(path.sep).join("/"), format: fmt, family, table, title: `${idx.note ?? family} (${table})`,
        rule: sr?.rule ?? null, staged_from: `${family}/files.json`, source: f.source ?? (await firstColumn(csvPath, "source")), rolls_up_to: sr?.rolls_up_to ?? [],
        vintage: vin, rows: pq.rows, expected_rows: f.rows ?? null, expected_note: "rows in the staging index (files.json)", bytes: fs.statSync(local).size, sha256: await sha256File(local), local });
    }
    if (!KEEP) for (const x of [pqPath, csvPath]) fs.rmSync(x, { force: true });
  }
  log(`${family}: ${out.length / 2} staged tables`);
  return out;
}
async function firstColumn(csvGz, col) {
  // a column of the first data row (vintage, source), when the table carries one
  const rl = readline.createInterface({ input: fs.createReadStream(csvGz).pipe(zlib.createGunzip()) });
  const { parseCsv } = await import(pathToFileURL(path.join(ROOT, "scripts/lib/tabular.mjs")).href);
  let head = null;
  for await (const line of rl) {
    if (!head) { head = parseCsv(line, ",")[0]; continue; }
    rl.close();
    const i = head.indexOf(col);
    return i >= 0 ? (parseCsv(line, ",")[0][i] ?? null) : null;
  }
  return null;
}
const firstVintage = (f) => firstColumn(f, "vintage");
async function stagedRaw(family, indexFile) {
  const idx = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  const dir = path.resolve(ROOT, idx.root ?? "");
  const rootHere = fs.existsSync(dir) ? dir : path.join(STAGING, path.basename(idx.root ?? `${family}-raw`));
  if (!fs.existsSync(rootHere)) { fail(`${family}: raw staging ${idx.root} is not on this machine (use --staging)`); return null; }
  const listed = new Map((idx.files ?? idx.calls ?? []).map((e) => [e.file, e]));
  const onDisk = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else onDisk.push(path.relative(rootHere, p).split(path.sep).join("/")); } })(rootHere);
  const files = [];
  let paid = 0, bad = 0;
  for (const rel of onDisk.sort()) {
    const local = path.join(rootHere, rel);
    const sha = await sha256File(local);
    const e = listed.get(rel);
    if (!e) { if (!/^(pickers|index)\.json(\.gz)?$/.test(rel)) { fail(`${family}: raw ${rel} is not in ${path.relative(ROOT, indexFile)}`); bad++; } }
    else if (e.sha256 && e.sha256 !== sha) { fail(`${family}: raw ${rel} sha256 differs from its index entry`); bad++; }
    if ((await gzScan(local)).paid) { paid++; fail(`${family}: raw ${rel} names India Data Hub`); }
    files.push([rel, sha, fs.statSync(local).size, e?.rows ?? null, local]);
  }
  for (const rel of listed.keys()) if (!onDisk.includes(rel)) fail(`${family}: index lists ${rel}, not in staging`);
  log(`${family}: ${files.length} raw files checked against ${path.relative(ROOT, indexFile)} (${bad} mismatches, ${paid} paid-source hits)`);
  return { family, index: path.relative(ROOT, indexFile), hf_prefix: `raw/${family}/`, files };
}

/* ---------- main ---------- */
const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { tables: [], raw: {} };
const prevByPath = new Map((prev.tables ?? []).map((f) => [f.path, f]));
const rules = archiveRules();
const families = new Set([...rules.keys()]);
if (fs.existsSync(STAGING)) for (const d of fs.readdirSync(STAGING)) if (!d.endsWith("-raw") && fs.existsSync(path.join(STAGING, d, "files.json"))) families.add(d);
const rawIndexes = fs.readdirSync(path.join(ROOT, "data/raw")).filter((f) => /-index\.json$/.test(f)).map((f) => ({ family: f.replace(/-index\.json$/, ""), file: path.join(ROOT, "data/raw", f) }))
  .filter((x) => { try { return String(JSON.parse(fs.readFileSync(x.file, "utf8")).root ?? "").startsWith("data/archive/staging"); } catch { return false; } });
for (const r of rawIndexes) families.add(r.family);

console.log(`archive: ${UPLOAD ? "BUILD AND UPLOAD" : "dry run"} -> ${path.relative(ROOT, BUILD)}; staging ${STAGING}`);
const tables = [], raw = {};
for (const family of [...families].sort()) {
  if (ONLY.length && !ONLY.includes(family)) { for (const f of prev.tables ?? []) if (f.family === family) tables.push(f); if (prev.raw?.[family]) raw[family] = prev.raw[family]; continue; }
  console.log(`\n== ${family}`);
  const famRules = rules.get(family) ?? [];
  const hookFile = path.join(ROOT, "scripts/lib/archive", family + ".mjs");
  const hook = fs.existsSync(hookFile) ? await import(pathToFileURL(hookFile).href) : null;
  const stagedDir = path.join(STAGING, family);
  if (fs.existsSync(path.join(stagedDir, "files.json"))) tables.push(...await stagedTables(family, stagedDir, famRules, hook));
  else if (famRules.length) {
    if (!hook?.tables) { fail(`${family}: ${famRules.length} archive rule(s) and no export hook (scripts/lib/archive/${family}.mjs tables) or staged files`); continue; }
    const gen = hook.tables;
    try {
      for await (const spec of gen({ rules: famRules, root: ROOT, log })) tables.push(...await writeTable(family, spec));
    } catch (e) { fail(`${family}: export failed: ${e.message}`); }
  }
  const ri = rawIndexes.find((r) => r.family === family);
  if (ri) { const r = await stagedRaw(family, ri.file); if (r) raw[family] = r; }
}

// Hugging Face limits
const hfPathOf = (f) => f.path;
const folders = new Map();
for (const f of tables) { const d = path.posix.dirname(hfPathOf(f)); folders.set(d, (folders.get(d) ?? 0) + 1); }
for (const r of Object.values(raw)) for (const [rel] of r.files) { const d = path.posix.dirname(r.hf_prefix + rel); folders.set(d, (folders.get(d) ?? 0) + 1); }
for (const [d, n] of folders) if (n > FOLDER_MAX) fail(`${d}: ${n} files in one folder (Hugging Face allows ${FOLDER_MAX})`);
for (const f of [...tables, ...Object.values(raw).flatMap((r) => r.files.map(([rel, , bytes]) => ({ path: r.hf_prefix + rel, bytes })))]) {
  if (f.bytes > LIMIT_FAIL) fail(`${f.path}: ${(f.bytes / 1e9).toFixed(1)} GB, over Hugging Face's 50 GB file limit`);
  else if (f.bytes > LIMIT_WARN) warnings.push(`${f.path}: ${(f.bytes / 1e9).toFixed(1)} GB`);
}

// the manifest: per file, its rule or index entry, source, rows, sha256, vintage, rolls_up_to,
// HF path; the uploaded sha256 and commit carry over while the file is unchanged
const keepUpload = (f) => { const p = prevByPath.get(f.path); return p && p.uploaded_sha256 === f.sha256 ? { uploaded_sha256: p.uploaded_sha256, hf_commit: p.hf_commit } : { uploaded_sha256: null, hf_commit: null }; };
const manifest = {
  note: "The India Atlas deep archive (docs/PLAN-launch.md §2b): finer grain than the chart bundles carry, published on Hugging Face. Built by scripts/archive.mjs; each file's rows were checked against its catalogue or index, and its sha256 recorded, before upload.",
  repo: REPO, url: HF_BASE, generated_at: new Date().toISOString().slice(0, 10), card_commit: prev.card_commit ?? null,
  tables: tables.map(({ local, ...f }) => ({ ...f, ...keepUpload(f) })).sort((a, b) => (a.path < b.path ? -1 : 1)),
  raw: Object.fromEntries(Object.entries(raw).map(([fam, r]) => {
    const p = prev.raw?.[fam];
    const up = new Map((p?.files ?? []).map(([rel, sha, , , upSha]) => [rel, upSha]));
    return [fam, { index: r.index, hf_prefix: r.hf_prefix, hf_commit: p?.hf_commit ?? null, columns: ["file", "sha256", "bytes", "rows", "uploaded_sha256"],
      files: r.files.map(([rel, sha, bytes, rows]) => [rel, sha, bytes, rows, up.get(rel) === sha ? sha : null]) }];
  })),
};

// summary per family
console.log("\nfamily            files      rows          size");
const fams = new Set([...tables.map((t) => t.family), ...Object.keys(raw)]);
let tot = [0, 0, 0];
for (const fam of [...fams].sort()) {
  const t = tables.filter((x) => x.family === fam), r = raw[fam]?.files ?? [];
  const nFiles = t.length + r.length, rows = t.filter((x) => x.format === "parquet").reduce((a, x) => a + x.rows, 0) + r.reduce((a, x) => a + (x[3] ?? 0), 0);
  const bytes = t.reduce((a, x) => a + x.bytes, 0) + r.reduce((a, x) => a + x[2], 0);
  tot = [tot[0] + nFiles, tot[1] + rows, tot[2] + bytes];
  console.log(`${fam.padEnd(16)} ${String(nFiles).padStart(6)} ${rows.toLocaleString("en-IN").padStart(13)} ${(bytes / 1e6).toFixed(1).padStart(10)} MB  (${t.length / 2} tables x parquet+csv.gz, ${r.length} raw)`);
}
console.log(`${"total".padEnd(16)} ${String(tot[0]).padStart(6)} ${tot[1].toLocaleString("en-IN").padStart(13)} ${(tot[2] / 1e6).toFixed(1).padStart(10)} MB`);
for (const w of warnings) console.log("warn:", w);

if (failures.length) { console.error(`\narchive: ${failures.length} check(s) failed; nothing uploaded, manifest not written`); process.exit(1); }
fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log(`\nmanifest: ${path.relative(ROOT, MANIFEST)} (${manifest.tables.length} table files, ${Object.values(manifest.raw).reduce((a, r) => a + r.files.length, 0)} raw files)`);

if (!UPLOAD) { console.log("dry run: nothing uploaded. Run with --upload to publish."); process.exit(0); }

/* ---------- upload ---------- */
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
if (!env.HF_TOKEN) { console.error("archive: HF_TOKEN is not in .env"); process.exit(1); }
const card = path.join(BUILD, "README.md");
fs.writeFileSync(card, datasetCard(manifest));
const localOf = new Map(tables.map((t) => [t.path, t.local]));
const commits = [];
for (const fam of [...fams].sort()) {
  const files = manifest.tables.filter((t) => t.family === fam && t.uploaded_sha256 !== t.sha256).map((t) => ({ local: localOf.get(t.path), path: t.path }));
  const r = raw[fam];
  if (r) for (const [rel, sha, , , upSha] of manifest.raw[fam].files) if (upSha !== sha) files.push({ local: r.files.find((x) => x[0] === rel)[4], path: r.hf_prefix + rel });
  files.push({ local: MANIFEST, path: "manifest.json" });
  if (files.length > 1) commits.push({ family: fam, message: `${fam}: ${files.length - 1} files (vintage ${[...new Set(manifest.tables.filter((t) => t.family === fam).map((t) => t.vintage))].join(", ") || "raw"})`, files });
}
const planPath = path.join(BUILD, "upload-plan.json");
fs.writeFileSync(planPath, JSON.stringify({ repo: REPO, card, commits }));
console.log(`upload: ${commits.length} commit(s), ${commits.reduce((a, c) => a + c.files.length - 1, 0)} changed files`);
const res = JSON.parse(execFileSync("uv", ["run", "--no-project", "--with", "huggingface_hub==2.2.0", "python", path.join(ROOT, "scripts/lib/archive/hf_upload.py"), planPath],
  { env: { ...process.env, HF_TOKEN: env.HF_TOKEN }, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 1 << 26 }).trim().split("\n").at(-1));
if (res._card) manifest.card_commit = res._card;
for (const t of manifest.tables) if (res[t.family] && t.uploaded_sha256 !== t.sha256) { t.uploaded_sha256 = t.sha256; t.hf_commit = res[t.family]; }
for (const [fam, r] of Object.entries(manifest.raw)) if (res[fam]) { r.hf_commit = res[fam]; for (const f of r.files) f[4] = f[1]; }
fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + "\n");
console.log("upload done; manifest updated with commit ids");

function datasetCard(m) {
  const LICENCE = {
    trade: "Ministry of Commerce and Industry, DGCI&S, via TradeStat (tradestat.commerce.gov.in): Government of India data, reused with attribution under the publisher's terms",
    credit: "Reserve Bank of India, DBIE (data.rbi.org.in): reused with attribution under the RBI's terms of use",
    ilo: "International Labour Organization, ILOSTAT (ilostat.ilo.org): CC BY 4.0",
    "climate-cckp": "World Bank Climate Change Knowledge Portal (climateknowledgeportal.worldbank.org): CC BY 4.0",
  };
  const famRows = [...new Set([...m.tables.map((t) => t.family), ...Object.keys(m.raw)])].sort().map((f) => {
    const t = m.tables.filter((x) => x.family === f && x.format === "parquet");
    return `| ${f} | ${t.length} | ${t.reduce((a, x) => a + x.rows, 0).toLocaleString("en-IN")} | ${m.raw[f]?.files.length ?? 0} | ${LICENCE[f] ?? "see the source"} |`;
  });
  return `---
license: other
pretty_name: India Atlas deep archive
language: [en]
tags: [india, economics, statistics, official-statistics, trade, credit, labour, climate]
---

# India Atlas deep archive

The finer grain behind [India Atlas](https://atlas.thisindianlife.today), a reference work on
India's official economic statistics. The site draws charts from compact "bundles"; this
dataset holds what those bundles summarise: 6- and 8-digit traded goods, district and centre
tables of bank credit, the ILO's three-way survey cubes, and state-by-month climate series,
plus the raw responses the trade guide was built from.

Every file is listed in \`manifest.json\` with the coverage-ledger rule it comes from, its
source, row count, sha256, data vintage, and the site bundle it rolls up to. Each upload is a
commit, so every data vintage stays citable.

## Layout

- \`tables/<family>/<table>/<vintage>/<table>.parquet\`, and the same as \`.csv.gz\`. Long format:
  the cut's dimensions, the date, the value, its unit and flags, the source and the vintage.
- \`raw/<family>/...\`: raw responses as fetched, verifiable against the index committed in the
  site's repository (\`data/raw/<family>-index.json\`).

## Families, sources and licences

| Family | Tables | Rows | Raw files | Source and terms |
|---|---|---|---|---|
${famRows.join("\n")}

Values are as each publisher served them; nothing is spliced across base years or
classifications. India Data Hub and other paid sources are never included.
`;
}
