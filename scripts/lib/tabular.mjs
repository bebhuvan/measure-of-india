// scripts/lib/tabular.mjs — the canonical kit for parsing tabular downloads
// (CSV/TSV/semicolon) and Indian-government value/date conventions.
//
// Contract (docs/RUNBOOK-sources.md §tabular):
//   - never assume row order; never assume column order — address columns by
//     header name after findHeader() locates it
//   - missing values become null, never 0, never NaN
//   - dates normalise to ISO "YYYY-MM-DD" strings (the bundle contract)
//
// Everything here is stdlib-only and synchronous. If a source needs XLSX,
// convert it to CSV upstream (e.g. `libreoffice --headless --convert-to csv`)
// rather than adding a parser dependency.

/* ---------- delimiter + CSV ---------- */

export function sniffDelimiter(text, sampleSize = 4096) {
  const sample = text.slice(0, sampleSize);
  const counts = { ",": 0, ";": 0, "\t": 0, "|": 0 };
  let inQuotes = false;
  for (const ch of sample) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0
    ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    : ",";
}

// RFC4180-ish: quotes, escaped quotes, CRLF, embedded newlines inside quotes.
export function parseCsv(text, delimiter) {
  const d = delimiter ?? sniffDelimiter(text);
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else inQuotes = false; }
      else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === d) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

// First row that looks like a header: most non-empty cells, and at least
// `minHits` cells matching header-ish patterns (word/word-with-space), and
// more text cells than numeric cells.
export function findHeader(rows, { minHits = 2 } = {}) {
  const wordy = (s) => /^[A-Za-z][A-Za-z0-9 ()./&'’%-]*$/.test(s.trim()) && s.trim().length > 0;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const cells = rows[i].map((c) => c.trim()).filter(Boolean);
    const hits = cells.filter(wordy).length;
    if (hits >= Math.max(minHits, Math.ceil(cells.length / 2)) && hits >= cells.filter((c) => !Number.isNaN(Number(c.replace(/,/g, "")))).length) return i;
  }
  return -1;
}

/* ---------- numbers ---------- */

const NA = new Set(["", "-", "--", "…", "...", "na", "n.a.", "n/a", "nil", "null", "nan", "not available", "unavailable"]);

// Handles: "1,23,456" (Indian grouping), "1,234,567" (Western), "3.4%",
// "(123)" → -123, "12345", "-12.5", "1.2 crore"/"3 lakh" (multiplier applied).
// Everything unparseable — including all NA conventions — returns null.
export function parseNumber(s) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || NA.has(t.toLowerCase())) return null;
  let str = t.replace(/%/g, "");
  let multiplier = 1;
  const unit = str.match(/(crore|lakh|lac|thousand|million|bn|billion)$/i);
  if (unit) {
    str = str.slice(0, unit.index).trim();
    multiplier = { crore: 1e7, lakh: 1e5, lac: 1e5, thousand: 1e3, million: 1e6, bn: 1e9, billion: 1e9 }[unit[1].toLowerCase()];
  }
  const negative = /^\(.*\)$/.test(str);
  str = str.replace(/[()]/g, "").replace(/,/g, "").replace(/\s+/g, "").replace(/−/g, "-");
  if (!/^-?\d*\.?\d+(e[+-]?\d+)?$/i.test(str)) return null;
  const v = Number(str) * multiplier * (negative ? -1 : 1);
  return Number.isFinite(v) ? v : null;
}

/* ---------- dates ---------- */

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");

// Normalises to ISO "YYYY-MM-DD". Understands:
//   ISO (2026-04-01), "Apr-2026"/"April 2026"/"2026-04", "01-04-2026" and
//   "01/04/2026" (DD-MM-YYYY — the Indian convention; use dayFirst:false to
//   override), "Q1 FY26"/"Q1FY2627" is NOT handled here (fiscal quarters are
//   product-specific; map them in the adapter).
export function parseDate(s, { dayFirst = true } = {}) {
  if (s == null) return null;
  const t = String(s).trim();
  if (!t || NA.has(t.toLowerCase())) return null;

  let m = t.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/); // ISO
  if (m) return `${m[1]}-${m[2]}-${m[3] ?? "01"}`;

  m = t.match(/^(\d{2})-(\d{4})$/); // Apr-2026
  if (m && MON[m[1].toLowerCase()]) return `${m[2]}-${pad(MON[m[1].toLowerCase()])}-01`;

  m = t.match(/^([A-Za-z]{3,9})[ .-]*(\d{4})$/); // April 2026 / Apr 2026
  if (m && MON[m[1].slice(0, 3).toLowerCase()]) return `${m[2]}-${pad(MON[m[1].slice(0, 3).toLowerCase()])}-01`;

  m = t.match(/^(\d{4})[/-](\d{1,2})$/); // 2026-04 or 2026/4
  if (m) return `${m[1]}-${pad(+m[2])}-01`;

  m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/); // 01-04-2026 / 4/1/2026
  if (m) {
    let [, a, b, y] = m;
    if (y.length === 2) y = Number(y) > 70 ? "19" + y : "20" + y;
    let day = +a, mon = +b;
    if ((!dayFirst && mon <= 12 && day > 12) || (day > 12 && mon <= 12)) { day = +b; mon = +a; } // unambiguous swap
    if (mon > 12 && day <= 12) { [day, mon] = [mon, day]; }
    if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    return `${y}-${pad(mon)}-${pad(day)}`;
  }

  m = t.match(/^(\d{4})(\d{2})(\d{2})$/); // 20260401 (API keys)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  return null;
}

/* ---------- bundle assembly ---------- */

// Builds a canonical series object from rows of {date, value} pairs:
//   - dates are the union, sorted ascending, ISO strings
//   - every series is a parallel array over the full date axis (null where
//     absent) — exactly the shape data/series/*.json expects
export function toBundle(pairs) {
  // pairs: [{ date: "YYYY-MM-DD", values: { key: number|null } }]
  const clean = pairs.filter((p) => p.date && p.values);
  clean.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const dates = [...new Set(clean.map((p) => p.date))];
  const keys = [...new Set(clean.flatMap((p) => Object.keys(p.values)))];
  const series = {};
  for (const k of keys) {
    const byDate = new Map(clean.map((p) => [p.date, p.values[k] ?? null]));
    series[k] = { data: dates.map((d) => (byDate.has(d) ? byDate.get(d) : null)) };
  }
  return { dates, series };
}
