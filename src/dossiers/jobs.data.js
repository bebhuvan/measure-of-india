// src/dossiers/jobs.data.js: build-time reader for the jobs guide (src/pages/guides/jobs.astro).
// The deep PLFS bundles (plfs-ay-states-*, plfs-cy25-states-*, plfs-q25-states-*, the earnings
// and conditions tables) run to megabytes. The page and src/dossiers/jobs.charts.js read the slices
// they draw here at build time (jobsData()); the reader's browser gets finished charts and numbers,
// never a bundle. Every value is the bundle's own.
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

/** The slices of the deep bundles the jobs plates draw (moved from the page so src/dossiers/jobs.charts.js
 *  and src/pages/guides/jobs.astro read one object). */
let memo = null;
export function jobsData() {
  const J = load, H = "__person_all__a15plus";
  return (memo ??= {
  seam: {
    ay: pick("plfs-annual", ["lfpr_psss", "ur_psss"]),
    cy: pick("plfs-cy-india", ["lfpr_psss" + H, "ur_psss" + H]),
    cy25: pick("plfs-cy25-india", ["lfpr_psss" + H, "ur_psss" + H]),
  },
  q25: pick("plfs-q25", ["lfpr", "wpr", "ur"].flatMap((i) => ["all", "rural", "urban"].map((s) => `${i}_cws__person_${s}__a15plus`))),
  youth: pick("plfs-monthly-age", ["ur_cws__person_all__a15_29", ...["male", "female"].flatMap((g) => ["rural", "urban"].map((s) => `ur_cws__${g}_${s}__a15_29`))]),
  youthStates: stateRows("plfs-q25-states-ur", { y: "{st}__ur_cws__person_all__a15_29", all: "{st}__ur_cws__person_all__a15plus" }),
  youthAi: { y: J("plfs-q25").series.ur_cws__person_all__a15_29.data.at(-1), all: J("plfs-q25").series["ur_cws" + H].data.at(-1) },
  work: stateRows("plfs-cy25-states-wpr", { p: "{st}__wpr_psss__person_all__a15plus", m: "{st}__wpr_psss__male_all__a15plus", f: "{st}__wpr_psss__female_all__a15plus" }),
  workAi: { p: J("plfs-cy25-india").series["wpr_psss" + H].data.at(-1), m: J("plfs-cy25-india").series.wpr_psss__male_all__a15plus.data.at(-1), f: J("plfs-cy25-india").series.wpr_psss__female_all__a15plus.data.at(-1) },
  social: pick("plfs-cy25-india", keysOf("plfs-cy25-india", /^lfpr_psss__(male|female)_all__a15plus__(soc|rel)_/)),
  socialAi: { m: J("plfs-cy25-india").series.lfpr_psss__male_all__a15plus.data.at(-1), f: J("plfs-cy25-india").series.lfpr_psss__female_all__a15plus.data.at(-1) },
  kinds: stateRows("plfs-cy25-workers-states", { rg: "{st}__regular__person_all__psss", cs: "{st}__casual__person_all__psss", se: "{st}__self_employed__person_all__psss" }),
  pay: stateRows("plfs-cy25-earnings", { p: "{st}__regular__person_all", f: "{st}__regular__female_all", m: "{st}__regular__male_all", cas: "{st}__casual__person_all" }),
  payAi: Object.fromEntries(["regular__person_all", "regular__female_all", "regular__male_all", "casual__person_all", "self_employed__person_all"].map((k) => [k, J("plfs-cy25-earnings").series[k].data.at(-1)])),
  cond: pick("plfs-conditions", ["no_contract", "no_paid_leave", "no_social_security", "none_of_three"].flatMap((c) => [`${c}__person_all`, `${c}__female_all`, `${c}__male_all`])),
});
}
