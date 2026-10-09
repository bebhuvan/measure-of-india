// scripts/lib/util.mjs — shared helpers for the product fetchers.

import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const round2 = (v) => Math.round(v * 100) / 100;

export function writeJson(root, rel, obj) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 1) + "\n");
  console.log(`wrote ${rel} (${obj.points?.length ?? obj.dates?.length ?? "?"} pts)`);
}

// Canonical-bundle writer (CONTRACT-series.md rule 7): same formatting as
// writeJson, but the body lands at rel + ".tmp" first and is then renamed
// into place — rename is atomic on POSIX, so a crash mid-write can never
// leave a truncated bundle in data/series/. Use this for every
// data/series/*.json write; raw dumps keep writeRaw, everything else
// writeJson.
//
// Also migrates the legacy bundle-level disclosure shape at the write
// boundary (CONTRACT-series.md rule 2): gaps live ON the series they
// explain — a meta.gaps union says nothing about which series actually
// misses which date. Any adapter still assembling meta.gaps/meta.gapsNote
// gets per-series gaps, mechanically derived from the data.
export function writeSeries(root, rel, obj) {
  if (obj.meta?.gaps?.length) {
    const declared = new Set(obj.meta.gaps);
    for (const s of Object.values(obj.series ?? {})) {
      if (!s.data) continue;
      const first = s.data.findIndex((v) => v != null);
      const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      const own = [...declared].filter((d) => {
        const i = obj.dates.indexOf(d);
        return i > first && i < last && s.data[i] == null;
      }).sort();
      if (own.length) s.gaps = own;
    }
    if (obj.meta.gapsNote) for (const s of Object.values(obj.series ?? {})) if (s.gaps) s.gapsNote ??= obj.meta.gapsNote;
    delete obj.meta.gaps;
    delete obj.meta.gapsNote;
    console.log(`disclosure: ${rel} bundle-level gaps moved onto series`);
  }
  const p = path.join(root, rel);
  // Vintage is DATA vintage (AGENTS.md hard rule 5, CONTRACT-series rule 4).
  // Adapters stamp the run date; if the axis and every series' values are
  // identical to the bundle already on disk, the data did not change, so the
  // previous vintage is kept. Presentation-only edits (labels, colours, notes)
  // never move it. This is what keeps a retired base's vintage frozen when it
  // is re-fetched.
  if (fs.existsSync(p) && obj.meta?.vintage) {
    try {
      const prev = JSON.parse(fs.readFileSync(p, "utf8"));
      const values = (b) => JSON.stringify({
        dates: b.dates ?? null, points: b.points ?? null,
        series: Object.fromEntries(Object.entries(b.series ?? {}).sort(([a], [c]) => (a < c ? -1 : 1)).map(([k, s]) => [k, s.data ?? null])),
        // published cross-check figures are data too: a change there is a revision
        crosscheck: b.crosscheck ?? null,
      });
      if (prev.meta?.vintage && prev.meta.vintage !== obj.meta.vintage && values(prev) === values(obj)) {
        obj.meta.vintage = prev.meta.vintage;
      }
    } catch { /* unreadable previous file: write fresh */ }
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p + ".tmp", JSON.stringify(obj, null, 1) + "\n");
  fs.renameSync(p + ".tmp", p);
  console.log(`wrote ${rel} (${obj.points?.length ?? obj.dates?.length ?? "?"} pts)`);
}

// Deterministic serialisation: object keys sorted, arrays sorted by their
// canonical form. Source APIs do not guarantee row order; without this, a
// reordering would read as a "revision" and pollute git diffs.
function canon(v) {
  if (Array.isArray(v)) {
    return v.map(canon).sort((a, b) => {
      const x = JSON.stringify(a), y = JSON.stringify(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
  }
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]));
  }
  return v;
}
const stable = (obj) => JSON.stringify(canon(obj));

// Raw dumps are stored gzipped (round 4, framework): data/raw/<name>.json.gz. Callers keep naming
// them by their JSON path ("data/raw/cpi-indices.json"); these helpers resolve the stored file,
// so an adapter never needs to know which form is on disk, and a not-yet-migrated .json still
// reads. Every adapter reads raw through readRaw / readRawFile; the one-off migration is
// scripts/migrations/2026-10-raw-gzip.mjs.
const gzName = (rel) => (rel.endsWith(".gz") ? rel : rel + ".gz");
/** The stored file of a raw dump named by its .json path: the .json.gz if present, else the .json. */
export function rawPath(root, rel) {
  const gz = path.join(root, gzName(rel));
  if (fs.existsSync(gz)) return gz;
  return path.join(root, rel.replace(/\.gz$/, ""));
}
export const rawExists = (root, rel) => fs.existsSync(rawPath(root, rel));
/** A raw dump, parsed: from .json.gz or .json, whichever is stored. */
export function readRawFile(file) {
  const buf = fs.readFileSync(fs.existsSync(gzName(file)) ? gzName(file) : file);
  return JSON.parse((buf[0] === 0x1f && buf[1] === 0x8b ? zlib.gunzipSync(buf) : buf).toString("utf8"));
}
export const readRaw = (root, rel) => readRawFile(path.join(root, rel.replace(/\.gz$/, "")));
/** The bytes a raw dump is stored as: the same JSON text as before, gzipped deterministically
 *  (no file name or time in the header), so an unchanged dump is byte-identical run to run. */
export const gzipRaw = (text) => zlib.gzipSync(text, { level: 9 });

// Vintage-safe raw writer. Raw dumps are the audit trail: if the source body
// changes between runs (a revision), the previous file is archived to
// data/raw/vintages/<name>.<old-vintage>.json.gz before the new one lands, so no
// vintage is ever overwritten silently. If the body is unchanged, the file —
// and its original vintage stamp — is left untouched. Comparison is
// order-insensitive (see canon above). Returns the vintage now stored.
export function writeRaw(root, rel, obj) {
  rel = rel.replace(/\.gz$/, "");
  const plain = path.join(root, rel), gz = path.join(root, gzName(rel));
  const stored = fs.existsSync(gz) ? gz : fs.existsSync(plain) ? plain : null;
  if (stored) {
    const prev = readRawFile(stored);
    const { vintage: pv, ...prevBody } = prev;
    const { vintage: nv, ...nextBody } = obj;
    if (stable(prevBody) === stable(nextBody)) {
      console.log(`unchanged ${rel} (vintage ${pv} kept)`);
      if (stored === plain) { fs.writeFileSync(gz, gzipRaw(fs.readFileSync(plain))); fs.rmSync(plain); }
      return pv;
    }
    const archive = path.join(root, path.dirname(rel), "vintages", `${path.basename(rel, ".json")}.${pv}.json.gz`);
    if (!fs.existsSync(archive) && !fs.existsSync(archive.replace(/\.gz$/, ""))) {
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      fs.writeFileSync(archive, gzipRaw(JSON.stringify(prev, null, 1) + "\n"));
      console.log(`revision detected in ${rel}: archived vintage ${pv} -> ${path.relative(root, archive)}`);
    } else {
      console.log(`revision detected in ${rel}: vintage ${pv} already archived`);
    }
  }
  fs.mkdirSync(path.dirname(gz), { recursive: true });
  fs.writeFileSync(gz + ".tmp", gzipRaw(JSON.stringify(obj, null, 1) + "\n"));
  fs.renameSync(gz + ".tmp", gz);
  if (fs.existsSync(plain)) fs.rmSync(plain);
  console.log(`wrote ${gzName(rel)}`);
  return obj.vintage ?? null;
}

// y/y growth from a Map("YYYY-MM" -> level). Lag is implicit: the same month
// one calendar year earlier.
export function yoyFromLevels(map) {
  const out = new Map();
  for (const [ym, v] of map) {
    const [y, m] = ym.split("-").map(Number);
    const prev = map.get(`${y - 1}-${String(m).padStart(2, "0")}`);
    if (prev != null && prev !== 0) out.set(ym, round2((v / prev - 1) * 100));
  }
  return out;
}

// Continuous month axis "YYYY-MM" from start (inclusive) to last (inclusive).
export function monthAxis(start, last) {
  const axis = [];
  let [y, m] = start.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= last) {
    axis.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return axis;
}

// Continuous fiscal-quarter axis of quarter-start months ("YYYY-04" = Q1).
export function quarterAxis(start, last) {
  const axis = [];
  let [y, m] = start.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= last) {
    axis.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 3; if (m > 12) { m = 1; y++; }
  }
  return axis;
}

// PLFS quarter_code -> quarter-start month. Codes: 2=Jul-Sep, 3=Oct-Dec,
// 4=Jan-Mar (of the next calendar year), 5=Apr-Jun.
export function plfsQuarterStart(year, quarterCode) {
  const q = Number(quarterCode);
  if (q === 5) return `${year}-04`;
  if (q === 2) return `${year}-07`;
  if (q === 3) return `${year}-10`;
  if (q === 4) return `${year + 1}-01`;
  return null;
}
