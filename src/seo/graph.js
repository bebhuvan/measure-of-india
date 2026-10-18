// src/seo/graph.js: the structured data (JSON-LD) a page carries, decided from its path, so the
// pages pass facts they already have (title, description, crumb) and the layout writes the tags.
//   front page        WebSite with a SearchAction (the front page's search reads ?q=), the publisher
//   a guide           its Dataset (src/seo/dataset.js), breadcrumbs
//   a bundle's page   its Dataset (the page passes it), breadcrumbs
//   a state profile   a WebPage about the state as a Place in India, breadcrumbs
//   a learn note      an Article by the publisher, breadcrumbs
//   /about/           an AboutPage whose subject is the publisher
// Every other page gets breadcrumbs only. scripts/seo-check.mjs parses every block on every page.
import { SITE } from "../site.js";
import { bySlug } from "../dossiers/registry.js";
import { headlineOf } from "../dossiers/headline.js";
import { guideDataset } from "./dataset.js";

const abs = (p) => (p.startsWith("http") ? p : SITE.url + p);
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };
export const plain = (html) => String(html ?? "").replace(/<[^>]+>/g, "").replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? m).replace(/\s+/g, " ").trim();

export const publisherRef = { "@id": SITE.url + "/#publisher" };
export function publisher() {
  const P = SITE.publisher;
  return { "@type": "Person", "@id": publisherRef["@id"], name: P.name, url: abs(P.url), email: `mailto:${P.email}`, sameAs: P.sameAs };
}

export function website() {
  return {
    "@type": "WebSite", "@id": SITE.url + "/#website", name: SITE.name, alternateName: SITE.tagline, url: SITE.url + "/",
    inLanguage: SITE.locale, publisher: publisherRef, license: SITE.license,
    isPartOf: { "@type": "WebSite", name: SITE.parent.name, url: SITE.parent.url },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}

/** BreadcrumbList from a page's crumb ("<a href=/guides/>Guides</a> / Prices / <b>CPI</b>"). Steps
 *  without a link of their own (a section name) are left out; the last step is the page. */
export function breadcrumbs(crumbHTML, url) {
  const steps = String(crumbHTML ?? "").split(/\s+\/\s+/).map((s) => {
    const a = s.match(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (a) return { name: plain(a[2]), item: abs(a[1]) };
    if (/<b>/.test(s)) return { name: plain(s), item: url };
    return null;
  }).filter((x) => x && x.name);
  if (!steps.length || steps.at(-1).item !== url) return null;
  const list = [{ name: SITE.name, item: SITE.url + "/" }, ...steps];
  return { "@type": "BreadcrumbList", itemListElement: list.map((s, i) => ({ "@type": "ListItem", position: i + 1, name: s.name, item: s.item })) };
}

/** The @graph for a page. `extra` is whatever the page adds itself (a bundle's Dataset). */
export function pageGraph({ path, url, title, description, crumbLeft, image, extra = [] }) {
  const out = [];
  if (path === "/") out.push(website(), publisher());
  const g = path.match(/^\/guides\/([^/]+)\/$/);
  if (g && bySlug[g[1]]) out.push(guideDataset(bySlug[g[1]], headlineOf(bySlug[g[1]])));
  const st = path.match(/^\/states\/([^/]+)\/$/);
  if (st) out.push({ "@type": "WebPage", "@id": url + "#page", url, name: plain(title), description, inLanguage: SITE.locale,
    about: { "@type": "Place", name: plain(crumbLeft).split(/\s+\/\s+/).at(-1), containedInPlace: { "@type": "Country", name: "India" } }, publisher: publisherRef });
  if (/^\/learn\/[^/]+\/$/.test(path)) out.push({ "@type": "Article", "@id": url + "#article", mainEntityOfPage: url, headline: plain(title).replace(/ · .*$/, ""),
    description, inLanguage: SITE.locale, image: abs(image), author: { "@type": "Person", name: SITE.publisher.name, url: abs(SITE.publisher.url) },
    publisher: { "@type": "Person", name: SITE.publisher.name, url: abs(SITE.publisher.url) }, license: SITE.license, isAccessibleForFree: true });
  if (path === "/about/") out.push({ "@type": "AboutPage", "@id": url + "#page", url, name: plain(title), description, mainEntity: publisherRef, inLanguage: SITE.locale }, publisher());
  out.push(...extra);
  const bc = path === "/" ? null : breadcrumbs(crumbLeft, url);
  if (bc) out.push(bc);
  return out.length ? { "@context": "https://schema.org", "@graph": out } : null;
}

/** JSON for a <script type="application/ld+json">: "<" escaped so no string can close the tag. */
export const ldJSON = (graph) => JSON.stringify(graph).replace(/</g, "\\u003c");
