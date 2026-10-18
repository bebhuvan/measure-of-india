// /feeds/releases.json: the releases feed as a JSON Feed 1.1 (src/seo/feeds.js).
import { SITE } from "../../site.js";
import { jsonFeed, releaseItems, RELEASES_ABOUT } from "../../seo/feeds.js";
export function GET() {
  return new Response(jsonFeed({ title: `${SITE.name}: new releases`, description: RELEASES_ABOUT, self: "/feeds/releases.json", items: releaseItems() }),
    { headers: { "Content-Type": "application/feed+json; charset=utf-8" } });
}
