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

export async function GET(context) {
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
  const res = await rss({
    title: SITE.name,
    description: "Guides to India's official economic statistics, revised with each release.",
    site: context.site,
    stylesheet: "/feeds/feed.css",   // readable when opened in a browser (src/seo/feeds.js)
    items,
  });
  // @astrojs/rss writes the stylesheet instruction without a type, which browsers need for CSS
  const xml = (await res.text()).replace('<?xml-stylesheet href="/feeds/feed.css"?>', '<?xml-stylesheet type="text/css" href="/feeds/feed.css"?>');
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
