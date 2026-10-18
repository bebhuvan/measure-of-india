// /guides/<slug>/feed.xml: one guide's prints, newest first (src/seo/feeds.js).
import { SITE } from "../../../site.js";
import { DOSSIERS, bySlug } from "../../../dossiers/registry.js";
import { rssXML, releaseItems } from "../../../seo/feeds.js";
export function getStaticPaths() {
  return DOSSIERS.map((d) => ({ params: { slug: d.slug } }));
}
export function GET({ params }) {
  const d = bySlug[params.slug];
  return new Response(rssXML({ title: `${SITE.name}: ${d.title}`, description: `New releases of ${d.kickerTitle}, as they reach the guide: the figure, the period and the release date. ${d.rssDescription ?? ""}`.trim(),
    self: `/guides/${d.slug}/feed.xml`, link: `${SITE.url}/guides/${d.slug}/`, items: releaseItems(d.slug) }),
    { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
