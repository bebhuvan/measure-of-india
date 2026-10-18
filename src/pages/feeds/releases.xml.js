// /feeds/releases.xml: every new print of every guide's headline figure (src/seo/feeds.js).
import { SITE } from "../../site.js";
import { rssXML, releaseItems, RELEASES_ABOUT } from "../../seo/feeds.js";
export function GET() {
  return new Response(rssXML({ title: `${SITE.name}: new releases`, description: RELEASES_ABOUT, self: "/feeds/releases.xml", items: releaseItems() }),
    { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
