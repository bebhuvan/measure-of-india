// scripts/lib/util.mjs — shared helpers for the product fetchers.

import fs from "node:fs";
import path from "node:path";

export const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const round2 = (v) => Math.round(v * 100) / 100;

export function writeJson(root, rel, obj) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 1) + "\n");
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

// Vintage-safe raw writer. Raw dumps are the audit trail: if the source body
// changes between runs (a revision), the previous file is archived to
// data/raw/vintages/<name>.<old-vintage>.json before the new one lands, so no
// vintage is ever overwritten silently. If the body is unchanged, the file —
// and its original vintage stamp — is left untouched. Comparison is
// order-insensitive (see canon above).
export function writeRaw(root, rel, obj) {
  const p = path.join(root, rel);
  if (fs.existsSync(p)) {
    const prev = JSON.parse(fs.readFileSync(p, "utf8"));
    const { vintage: pv, ...prevBody } = prev;
    const { vintage: nv, ...nextBody } = obj;
    if (stable(prevBody) === stable(nextBody)) {
      console.log(`unchanged ${rel} (vintage ${pv} kept)`);
      return;
    }
    const archive = path.join(root, path.dirname(rel), "vintages", `${path.basename(rel, ".json")}.${pv}.json`);
    if (!fs.existsSync(archive)) {
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      fs.writeFileSync(archive, JSON.stringify(prev, null, 1) + "\n");
      console.log(`revision detected in ${rel}: archived vintage ${pv} -> ${path.relative(root, archive)}`);
    } else {
      console.log(`revision detected in ${rel}: vintage ${pv} already archived`);
    }
  }
  writeJson(root, rel, obj);
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
