// src/seo/releases.js: the release log, one entry per print of each guide's headline figure.
// A print is a guide and the period its headline figure describes (headline.js): August 2026's CPI
// is one print, September 2026's the next. The site is rebuilt from files, so an old print's figure
// as first published cannot be read back from today's bundles (revisions overwrite it). The log
// keeps it: data/releases.json, appended by scripts/releases.mjs in the update workflow when a new
// print reaches the bundles, and committed with the release PR.
//
// Entry: { guide, period, asOf, value, what, released, vintage, recorded }
//   released  the agency's release date (bundle meta.releaseDate), null when not recorded
//   vintage   the data vintage of the bundle the figure was read from
//   recorded  the day the log first held this print (for the seed, released or vintage)
// Feeds date an item by `released`, else `recorded`; never a build date.
import fs from "node:fs";
import path from "node:path";
import { DOSSIERS, bySlug } from "../dossiers/registry.js";
import { headlineOf } from "../dossiers/headline.js";

export const LOG = path.join(process.cwd(), "data/releases.json");
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const key = (e) => `${e.guide}\u0000${e.period}`;

/** Each guide's current print, read from its bundles now. */
export function currentPrints() {
  return DOSSIERS.map((d) => {
    const h = headlineOf(d);
    const released = ISO.test(h.released ?? "") ? h.released : null, vintage = ISO.test(h.vintage ?? "") ? h.vintage : null;
    return { guide: d.slug, period: String(h.period), asOf: h.asOf, value: String(h.value), what: h.what, released, vintage, recorded: released ?? vintage };
  });
}

export function readLog() {
  return fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG, "utf8")).prints : [];
}

/** The log with today's prints merged in (a print the log has not recorded yet is dated by its
 *  release or vintage), newest first. Guides no longer in the registry drop out. */
export function releaseLog() {
  const seen = new Map(readLog().map((e) => [key(e), e]));
  for (const c of currentPrints()) if (!seen.has(key(c))) seen.set(key(c), c);
  return [...seen.values()].filter((e) => bySlug[e.guide]).sort((a, b) => (dateOf(b) ?? "").localeCompare(dateOf(a) ?? "") || a.guide.localeCompare(b.guide));
}

/** The date an entry is filed under: the release date, else the day the log recorded it; null for a
 *  print with neither (a snapshot whose source publishes no date), which feeds leave undated. */
export const dateOf = (e) => e.released ?? e.recorded ?? null;
