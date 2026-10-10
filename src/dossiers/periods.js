// src/dossiers/periods.js: the periods a page names, read from the bundles at build time.
// Hand-written copy that says "June 2026", "six prints" or "release of 12 Jul 2026" goes
// stale with every release. Pages take those words from here instead, so a refresh moves
// them with the data; only the claims around them need re-reading (pipeline/asof.mjs).
//
// period(slug) -> {
//   long: "August 2026", short: "Aug 2026", month: "August", year: "2026",
//   firstLong / firstShort: the bundle's first period, n: number of periods,
//   nWord: "eight" (spelled out to twenty, digits after), span: "Jan to Aug 2026"
//   or "Jan 2025 to Aug 2026", release: "12 September 2026" (meta.releaseDate),
//   releaseShort: "12 Sep 2026", stamp: "September 2026" (the release month: what an
//   "As of" note is dated; "the August 2026 print" when no release date is recorded), since(dateIso): whole periods from dateIso to the latest
// }
import fs from "node:fs";
import path from "node:path";

// Resolved from the working directory, not import.meta.url: Astro bundles this module
// into dist/, where a module-relative path would point inside the build output.
// Builds (npx astro build) always run from the repository root.
const ROOT = process.cwd();
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export const word = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));

const cache = new Map();
export function period(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));
  const d0 = b.dates[0], d1 = b.dates.at(-1);
  const y = (d) => d.slice(0, 4), mi = (d) => +d.slice(5, 7) - 1;
  const rel = b.meta?.releaseDate ?? null;
  const step = b.meta?.frequency === "quarterly" ? 3 : 1;
  const out = {
    long: `${MONTHS[mi(d1)]} ${y(d1)}`,
    short: `${M3[mi(d1)]} ${y(d1)}`,
    month: MONTHS[mi(d1)],
    year: y(d1),
    firstLong: `${MONTHS[mi(d0)]} ${y(d0)}`,
    firstShort: `${M3[mi(d0)]} ${y(d0)}`,
    n: b.dates.length,
    nWord: word(b.dates.length),
    span: y(d0) === y(d1) ? `${M3[mi(d0)]} to ${M3[mi(d1)]} ${y(d1)}` : `${M3[mi(d0)]} ${y(d0)} to ${M3[mi(d1)]} ${y(d1)}`,
    release: rel ? `${+rel.slice(8, 10)} ${MONTHS[mi(rel)]} ${y(rel)}` : null,
    releaseShort: rel ? `${+rel.slice(8, 10)} ${M3[mi(rel)]} ${y(rel)}` : null,
    // dated by the release month where the bundle records one; otherwise by the print
    // itself, never a guessed publication date
    stamp: rel ? `${MONTHS[mi(rel)]} ${y(rel)}` : `the ${MONTHS[mi(d1)]} ${y(d1)} print`,
    since: (iso) => Math.round(((+y(d1) - +y(iso)) * 12 + (mi(d1) - mi(iso))) / step),
  };
  cache.set(slug, out);
  return out;
}

// ---- datafix (2026-10-10): registry text that names a period ----
// A registry line such as register.unit ("Monthly, MNRE, Jan 2020 to Jun 2026") went stale the
// month after it was typed. Registry text writes tokens instead, filled here from the bundle:
// {span} "Jan 2020 to Jul 2026", {first} "Jan 2020", {latest} "Jul 2026", {n} 79, {nWord}.
export function fillPeriods(text, slug) {
  if (text == null || !/\{(span|first|latest|n|nWord)\}/.test(text)) return text;
  const p = period(slug);
  return text.replace(/\{span\}/g, p.span).replace(/\{first\}/g, p.firstShort).replace(/\{latest\}/g, p.short).replace(/\{nWord\}/g, p.nWord).replace(/\{n\}/g, String(p.n));
}
