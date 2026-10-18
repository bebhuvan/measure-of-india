// The site's name and address, in one place. Pages, the masthead, feeds, social cards and chart
// exports read from here; qc fails a build that still prints a retired name (RETIRED_NAMES).
export const SITE = {
  name: "Measure of India",
  short: "Measure of India",
  tagline: "India's economy, in numbers",
  host: "measure.thisindianlife.today",
  url: "https://measure.thisindianlife.today",
  parent: { name: "This Indian Life", url: "https://thisindianlife.today/" },
  locale: "en-IN",
  // the person behind the site, as structured data and social cards name him (owner's choice,
  // 2026-10-17); the same contacts as /about/
  publisher: {
    name: "Bhuvan",
    url: "/about/",
    email: "bhuvan@bebhuvan.com",
    sameAs: ["https://twitter.com/bebhuvan", "https://www.linkedin.com/in/bebhuvan/"],
    twitter: "@bebhuvan",
  },
  // our text and charts; each source's data keeps its own terms (footer, /method/)
  license: "https://creativecommons.org/licenses/by/4.0/",
  // Cloudflare Web Analytics for this host alone (a site of its own, created 2026-10-18): cookieless,
  // no cross-site tracking. The token is public; it ships in every page. Empty turns the beacon off.
  beacon: "bb6ff569bd6947aba88bb23f535fad57",
};
// names the site has carried; none may reach a reader again
export const RETIRED_NAMES = ["India Atlas", "Economic Atlas of India", "the Atlas", "The Atlas"];
