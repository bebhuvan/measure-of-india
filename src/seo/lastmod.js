// src/seo/lastmod.js: the sitemap's <lastmod> for a page (Base.astro records it as the page renders), from the data vintage of what the page
// shows (AGENTS rule 5: vintage is the data's date, never the build's). A page with no data vintage
// (an evergreen note, the method) gets none: an honest absence beats a build date that changes
// every deploy and teaches crawlers to ignore the field.
import { DOSSIERS, bySlug } from "../dossiers/registry.js";
import { everyCutPlan } from "../dossiers/everycut.js";
import { bundleSummary } from "./bundles.js";
import { guideVintage } from "./dataset.js";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const latest = (xs) => xs.filter((v) => ISO.test(v ?? "")).sort().at(-1) ?? null;
let SITE_VINTAGE;
const siteVintage = () => (SITE_VINTAGE ??= latest(DOSSIERS.map(guideVintage)));
const INDEXES = new Set(["/", "/guides/", "/states/", "/register/", "/data/", "/feeds/"]);

/** ISO date or null, for a path such as "/guides/cpi/". */
export async function lastmodFor(path) {
  if (INDEXES.has(path)) return siteVintage();
  let m;
  if ((m = path.match(/^\/guides\/([^/]+)\/$/)) && bySlug[m[1]]) return guideVintage(bySlug[m[1]]);
  if ((m = path.match(/^\/guides\/([^/]+)\/every-cut\/([^/]+)\//)) && bySlug[m[1]]) {
    const t = everyCutPlan(bySlug[m[1]]).tails.find((x) => x.id === m[2]);
    return t ? latest(t.bundles.map((b) => bundleSummary(b).meta?.vintage)) : null;
  }
  if ((m = path.match(/^\/data\/([^/]+)\/$/))) {
    try { return latest([bundleSummary(m[1]).meta?.vintage]); } catch { return null; }
  }
  if ((m = path.match(/^\/states\/([^/]+)\/$/))) {
    const { page } = await import("../dossiers/profiles.js");
    return latest(page(m[1]).sources.map((s) => s.vintage));
  }
  return null;
}
