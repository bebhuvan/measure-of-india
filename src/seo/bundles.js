// src/seo/bundles.js: bundle reads for the search and feed code, kept off the shared parse cache.
// everycut.js's loadBundle keeps every bundle it parses for the whole build; the data-file pages,
// the sitemap and llms.txt touch all 2,600-odd bundles, and holding them all overran the build's
// heap. These read a bundle, keep only a small summary, and let the rest go.
import fs from "node:fs";
import path from "node:path";

const DIR = () => path.join(process.cwd(), "data/series");
/** The whole bundle, parsed afresh and not cached. */
export const readBundle = (id) => JSON.parse(fs.readFileSync(path.join(DIR(), id + ".json"), "utf8"));
export const allBundleIds = () => fs.readdirSync(DIR()).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();

const SUMMARY = new Map();
/** { meta, n, first, last }: the bundle's meta, its count of series and first and last dates. */
export function bundleSummary(id) {
  if (!SUMMARY.has(id)) {
    const j = readBundle(id);
    SUMMARY.set(id, { meta: j.meta ?? {}, n: Object.keys(j.series).length, first: j.dates[0], last: j.dates.at(-1) });
  }
  return SUMMARY.get(id);
}
