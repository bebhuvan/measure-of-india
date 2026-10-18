// src/seo/feeds.js: the site's feeds, one place for their addresses, titles and XML.
//   /rss.xml                     guide revisions (the original feed; kept for its subscribers)
//   /feeds/releases.xml          every new print of every guide's headline figure (RSS 2.0)
//   /feeds/releases.json         the same as a JSON Feed 1.1
//   /guides/<slug>/feed.xml      one guide's prints
//   /feeds/                      a page listing them, for people
// Prints come from the release log (src/seo/releases.js). A feed opened in a browser is styled by
// /feeds/feed.css, an XML stylesheet in CSS: browsers are removing XSLT (Chrome on 17 November
// 2026), CSS on XML stays. Item text is plain, so the styled page and every reader show the same.
import { SITE } from "../site.js";
import { bySlug, DOSSIERS } from "../dossiers/registry.js";
import { agencyOf } from "./agency.js";
import { bundleSummary } from "./bundles.js";
import { releaseLog, dateOf } from "./releases.js";

export const FEEDS = [
  { href: "/feeds/releases.xml", type: "application/rss+xml", title: `${SITE.short}: new releases` },
  { href: "/feeds/releases.json", type: "application/feed+json", title: `${SITE.short}: new releases (JSON Feed)` },
  { href: "/rss.xml", type: "application/rss+xml", title: `${SITE.short}: guide revisions` },
];
export const guideFeed = (d) => ({ href: `/guides/${d.slug}/feed.xml`, title: `${SITE.short}: ${d.title}, new releases` });

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const longDate = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
// "2021-23 (the years averaged)" read inside brackets of its own: "2021-23, the years averaged"
export const flatPeriod = (p) => String(p).replace(/\s*\(([^()]+)\)/g, ", $1");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rfc822 = (iso) => new Date(iso + "T00:00:00Z").toUTCString();

/** One print as a feed item: the guide, the figure, the period, who released it and when. */
export function printItem(e) {
  const d = bySlug[e.guide];
  const agency = agencyOf(bundleSummary(d.currentBundle).meta?.source, SITE).creator.name;
  const date = dateOf(e);
  const said = `Source: ${agency}.` + (e.released ? ` Released ${longDate(e.released)}.` : "");
  return {
    id: `${SITE.url}/guides/${e.guide}/#print-${e.asOf ?? e.period}`,
    url: `${SITE.url}/guides/${e.guide}/`,
    title: `${d.title}: ${e.value}, ${flatPeriod(e.period)}`,
    summary: `${e.value}, ${e.what}, for ${flatPeriod(e.period)}. ${said}`,
    date,
    guide: d,
  };
}

export const releaseItems = (slug) => releaseLog().filter((e) => !slug || e.guide === slug).map(printItem);

/** RSS 2.0, with an atom:link to itself and the CSS stylesheet for browsers. */
export function rssXML({ title, description, self, link = SITE.url + "/", items }) {
  const latest = items.map((i) => i.date).filter(Boolean).sort().at(-1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/css" href="/feeds/feed.css"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(title)}</title>
<link>${esc(link)}</link>
<description>${esc(description)}</description>
<language>en-IN</language>
<atom:link href="${esc(SITE.url + self)}" rel="self" type="application/rss+xml"/>
${latest ? `<lastBuildDate>${rfc822(latest)}</lastBuildDate>\n` : ""}<copyright>Text: CC BY 4.0. Figures: each publishing agency's terms.</copyright>
${items.map((i) => `<item>
<title>${esc(i.title)}</title>
<link>${esc(i.url)}</link>
<guid isPermaLink="false">${esc(i.id)}</guid>
<description>${esc(i.summary)}</description>
<category>${esc(i.guide.section)}</category>
${i.date ? `<pubDate>${rfc822(i.date)}</pubDate>\n` : ""}</item>`).join("\n")}
</channel>
</rss>
`;
}

/** JSON Feed 1.1 (https://jsonfeed.org/version/1.1). */
export function jsonFeed({ title, description, self, items }) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1", title, description,
    home_page_url: SITE.url + "/", feed_url: SITE.url + self, language: "en-IN",
    icon: SITE.url + "/icons/icon-512.png", favicon: SITE.url + "/favicon-32.png",
    authors: [{ name: SITE.publisher.name, url: SITE.url + SITE.publisher.url }],
    items: items.map((i) => ({ id: i.id, url: i.url, title: i.title, content_text: i.summary, ...(i.date ? { date_published: i.date + "T00:00:00Z" } : {}), tags: [i.guide.section, i.guide.title] })),
  }, null, 1) + "\n";
}

export const RELEASES_ABOUT = "Each new figure as it is released: the measure, the figure, the period it describes, and who released it when. One item per print of each guide's headline figure.";
export { DOSSIERS };
