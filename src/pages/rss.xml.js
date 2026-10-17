// Site RSS feed — one item per dossier, stamped with the data vintage of the
// bundle each dossier's title block actually leads with (the CURRENT ruler —
// see docs/CONTRACT-series.md; never a retired base). pubDate prefers the
// source's releaseDate, then a documented report edition or dated vintage.
// Sources with no known publication date omit pubDate; capture dates never substitute.
// Dossier metadata comes from src/dossiers/registry.js; only the headline
// stat renderers live here (they are functions, the registry is pure data).
import rss from "@astrojs/rss";
import fs from "node:fs";
import path from "node:path";
import { DOSSIERS } from "../dossiers/registry.js";
import { SITE } from "../site.js";

const read = (slug) =>
  JSON.parse(fs.readFileSync(path.resolve("data/series", slug + ".json"), "utf8"));

// Headline figures come from src/dossiers/headline.js, the same module the home page and the
// guides index quote from, so the feed can never print a figure the site does not.
import { headlineOf } from "../dossiers/headline.js";

export function GET(context) {
  const items = DOSSIERS.map((d) => {
    const h = headlineOf(d);
    const b = read(d.currentBundle);
    const stamp = b.meta.releaseDate ?? b.meta.reportEditionDate ?? b.meta.vintage;
    return {
      title: `${d.kickerTitle}: ${h.value}, ${h.what} (${h.period})`,
      link: `/guides/${d.slug}/`,
      description: d.rssDescription,
      ...(stamp ? {pubDate: new Date(stamp + "T00:00:00Z")} : {}),
    };
  });
  return rss({
    title: SITE.name,
    description: "Guides to India's official economic statistics, revised with each release.",
    site: context.site,
    items,
  });
}
