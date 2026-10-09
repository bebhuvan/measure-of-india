// src/dossiers/jobs.data.js: build-time reader for the jobs guide (src/pages/guides/jobs.astro).
// The deep PLFS bundles (plfs-ay-states-*, plfs-cy25-states-*, plfs-q25-states-*, the earnings
// and conditions tables) run to megabytes; importing them into the client would blow the page
// budget (docs/CONTRACT-render.md). The page reads them here at build time and embeds only the
// series its plates draw, in bundle shape, as one inline JSON block (#jobs-data) that
// src/dossiers/jobs.client.js hydrates. No runtime fetch; every value is the bundle's own.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();   // builds run from the repository root (see periods.js)
const cache = new Map();
export function load(slug) {
  if (!cache.has(slug)) cache.set(slug, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8")));
  return cache.get(slug);
}

/** A slim copy of a bundle holding only `keys` (a missing key throws, unless optional). */
export function pick(slug, keys, { optional = false } = {}) {
  const b = load(slug);
  const series = {};
  for (const k of keys) {
    const s = b.series[k];
    if (!s) { if (optional) continue; throw new Error(`jobs.data: ${slug} has no series ${k}`); }
    series[k] = { label: s.label, group: s.group, data: s.data };
  }
  return { meta: { vintage: b.meta.vintage, base: b.meta.base, frequency: b.meta.frequency }, dates: b.dates, series };
}

/** Keys of a bundle whose key matches a regex. */
export const keysOf = (slug, re) => Object.keys(load(slug).series).filter((k) => re.test(k));

/** Every state (the `group` of a state bundle's series), sorted. */
export const statesOf = (slug) => [...new Set(Object.values(load(slug).series).map((s) => s.group))].filter((g) => g && g !== "All India").sort();

/** Last non-null { value, iso } of a series. */
export function last(slug, key) {
  const b = load(slug), d = b.series[key]?.data ?? [];
  for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { value: d[i], iso: b.dates[i] };
  return null;
}
/** Value at the bundle's last date (null if that cell is not published). */
export const atEnd = (slug, key) => load(slug).series[key]?.data.at(-1) ?? null;

/** The key slug of a state, as plfs-deep.mjs writes it ("Jammu & Kashmir" -> "jammu_and_kashmir"). */
export const stateSlug = (s) => String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Per state, the value at a bundle's last date of each named key pattern ("{st}" is the state slug).
 *  Rows with any value missing are dropped (a withheld or unpublished cell). */
// display names short enough for a strip's label column
const SHORT = { "Dadra & Nagar Haveli & Daman & Diu": "DNH & Daman & Diu", "Andaman & Nicobar Islands": "Andaman & Nicobar" };
export const shortName = (s) => SHORT[s] ?? s;
export function stateRows(slug, cols, { at = -1 } = {}) {
  const b = load(slug);
  const i = at < 0 ? b.dates.length + at : at;
  return statesOf(slug).map((name) => {
    const row = { name: shortName(name) };
    for (const [col, pat] of Object.entries(cols)) row[col] = b.series[pat.replace("{st}", stateSlug(name))]?.data[i] ?? null;
    return row;
  }).filter((r) => Object.keys(cols).every((c) => r[c] != null));
}

/** A bundle's date at an index (default the last), ISO. */
export const dateAt = (slug, at = -1) => { const d = load(slug).dates; return d[at < 0 ? d.length + at : at]; };
