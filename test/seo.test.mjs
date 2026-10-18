// test/seo.test.mjs: the pure parts of the search, feed and app code (src/seo/, src/pwa/,
// scripts/lib/postcss-hover-only.mjs). The built output is checked by scripts/seo-check.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import postcss from "postcss";
import hoverOnly from "../scripts/lib/postcss-hover-only.mjs";
import { SITE } from "../src/site.js";
import { agencyOf } from "../src/seo/agency.js";
import { breadcrumbs, ldJSON, plain } from "../src/seo/graph.js";
import { flatPeriod, rssXML } from "../src/seo/feeds.js";
import { bundleDataset, periodName } from "../src/seo/dataset.js";
import { currentPrints, readLog } from "../src/seo/releases.js";

test("an agency is named from the part of the source before a reprint", () => {
  assert.equal(agencyOf("Reserve Bank of India, Handbook of Statistics on Indian States (via DBIE)", SITE).creator.name, "Reserve Bank of India");
  const r = agencyOf("Crime in India, National Crime Records Bureau, as reprinted in MoSPI's Women and Men in India 2025 (table 6.1)", SITE);
  assert.equal(r.creator.name, "National Crime Records Bureau");
  assert.match(r.publisher.name, /Ministry of Statistics/);
  assert.equal(agencyOf("Ministry of Education, UDISE+, via MoSPI eSankhyiki", SITE).creator.name, "Ministry of Education, Government of India");
  // a source no rule knows keeps its own first clause, never a guess
  assert.equal(agencyOf("Department of Financial Services, Ministry of Finance, as reprinted in MoSPI's Women and Men in India 2025 (table 4.26)", SITE).creator.name, "Department of Financial Services");
  assert.equal(agencyOf("Computed by Measure of India from RBI DBIE (amounts) and MoSPI NAS (GDP)", SITE).creator.name, "Reserve Bank of India");
});

test("breadcrumbs skip unlinked sections and end at the page", () => {
  const url = SITE.url + "/guides/cpi/";
  const bc = breadcrumbs('<a href="/guides/">Guides</a> / Prices / <b>Consumer Price Index</b>', url);
  assert.deepEqual(bc.itemListElement.map((x) => x.name), [SITE.name, "Guides", "Consumer Price Index"]);
  assert.deepEqual(bc.itemListElement.map((x) => x.position), [1, 2, 3]);
  assert.equal(bc.itemListElement.at(-1).item, url);
  assert.equal(breadcrumbs("Latest release: <b>consumer prices</b>", SITE.url + "/x/").itemListElement.at(-1).item, SITE.url + "/x/");
  assert.equal(breadcrumbs("", url), null);
});

test("structured data cannot close its script tag", () => {
  assert.ok(!ldJSON({ name: "</script><script>alert(1)</script>" }).includes("</script>"));
  assert.equal(plain("India&#39;s <b>banks</b> &amp; more"), "India's banks & more");
});

test("periods and dates read as a reader says them", () => {
  assert.equal(flatPeriod("2021-23 (the years averaged)"), "2021-23, the years averaged");
  assert.equal(flatPeriod("August 2026"), "August 2026");
  assert.equal(periodName("2026-08-01", "monthly"), "August 2026");
  assert.equal(periodName("2024-04-01", "annual"), "2024");
});

test("a feed escapes its text and dates only what has a date", () => {
  const xml = rssXML({ title: "A & B", description: "<x>", self: "/f.xml", items: [
    { id: "i1", url: SITE.url + "/", title: "T < 1", summary: "S", date: "2026-09-12", guide: { section: "Prices" } },
    { id: "i2", url: SITE.url + "/", title: "U", summary: "S", date: null, guide: { section: "Prices" } },
  ] });
  assert.match(xml, /<title>A &amp; B<\/title>/);
  assert.match(xml, /<title>T &lt; 1<\/title>/);
  assert.equal((xml.match(/<pubDate>/g) ?? []).length, 1);
  assert.match(xml, /<\?xml-stylesheet type="text\/css" href="\/feeds\/feed.css"\?>/);
});

test("a bundle's Dataset meets Google's required fields", () => {
  const d = bundleDataset("cpi-2024");
  assert.equal(d["@type"], "Dataset");
  assert.ok(d.name && d.description.length >= 50 && d.description.length <= 5000);
  assert.equal(d.license, SITE.license);
  assert.ok(d.creator.name);
  assert.match(d.temporalCoverage, /^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(d.distribution.map((x) => x.encodingFormat), ["text/csv", "application/json"]);
});

test("the release log holds every current print, unchanged once recorded", () => {
  const log = readLog(), key = (e) => `${e.guide}|${e.period}`;
  const have = new Set(log.map(key));
  for (const c of currentPrints()) assert.ok(have.has(key(c)), `data/releases.json lacks ${key(c)}: run node scripts/releases.mjs`);
  assert.equal(new Set(log.map(key)).size, log.length, "a print is logged twice");
});

test("hover rules apply only where a pointer hovers", async () => {
  const { css } = await postcss([hoverOnly()]).process(".a:hover,.a:focus-visible{color:red}@media (max-width:600px){.b tr:hover td{x:1}}@media (hover:hover){.c:hover{y:2}}", { from: undefined });
  assert.equal(css, ".a:focus-visible{color:red}@media (hover:hover){.a:hover{color:red}}@media (max-width:600px){@media (hover:hover){.b tr:hover td{x:1}}}@media (hover:hover){.c:hover{y:2}}");
});

test("the service worker template keeps its placeholders and never caches downloads", () => {
  const sw = fs.readFileSync("src/pwa/sw.js", "utf8");
  assert.match(sw, /"__BUILD__"/);
  assert.match(sw, /const SHELL = __SHELL__;/);
  const NETWORK_ONLY = new RegExp(sw.match(/const NETWORK_ONLY = \/(.+)\/;/)[1]);
  for (const p of ["/data/cpi-2024.csv", "/data/cpi-2024.json", "/feeds/releases.xml", "/rss.xml", "/sw.js", "/llms.txt"]) assert.ok(NETWORK_ONLY.test(p), p);
  for (const p of ["/data/cpi-2024/", "/guides/cpi/"]) assert.ok(!NETWORK_ONLY.test(p), p);
});
