// src/seo/dataset.js: schema.org Dataset descriptions of the site's data, for search engines and
// dataset search (Google's Dataset rules: name, a description of 50 to 5,000 characters, creator,
// licence, temporal and spatial coverage, distribution). Two levels:
//   bundleDataset(id)  one canonical bundle; it lives on the bundle's own page, /data/<id>/
//   guideDataset(d)    a guide: its agencies, its whole span and the current bundle's downloads;
//                      each bundle's Dataset names the guide's as the one it is part of
// Everything is read from the bundles and the registry at build time; nothing here is typed.
import { SITE } from "../site.js";
import { DOSSIERS } from "../dossiers/registry.js";
import { bundleTitle, guideBundles, everyCutPlan, requiredByOwner } from "../dossiers/everycut.js";
import { readBundle, bundleSummary, allBundleIds } from "./bundles.js";
import { governedDownloadPlan } from "../dossiers/governed-downloads.js";
import { agencyOf } from "./agency.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SUB_ANNUAL = new Set(["monthly", "quarterly", "weekly", "fortnightly", "daily", "bimonthly", "half-yearly"]);
const COUNTRIES = { IND: "India", WLD: "World", AUS: "Australia", BRA: "Brazil", CAN: "Canada", CHN: "China", EMU: "Euro area", GBR: "United Kingdom", IDN: "Indonesia", JPN: "Japan", KOR: "South Korea", MEX: "Mexico", TUR: "Türkiye", USA: "United States", ZAF: "South Africa", BGD: "Bangladesh", VNM: "Viet Nam" };
const clean = (t) => String(t ?? "").replace(/ — /g, ": ").replace(/ · /g, ", ").replace(/\s+/g, " ").trim();
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** "August 2026" for sub-annual data, "2026" otherwise. */
export function periodName(iso, freq) {
  return SUB_ANNUAL.has(freq) ? `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : iso.slice(0, 4);
}

let OWNERS;
/** The guides that use a bundle, in registry order. */
export function ownersOf(id) {
  if (!OWNERS) {
    OWNERS = new Map();
    for (const d of DOSSIERS) for (const b of guideBundles(d)) OWNERS.set(b, [...(OWNERS.get(b) ?? []), d]);
  }
  return OWNERS.get(id) ?? [];
}

/** Where a bundle's rows are shown: its own every-cut page, or the guide's every-cut table. */
export function rowsHref(id) {
  for (const d of ownersOf(id)) {
    const t = everyCutPlan(d).tails.find((x) => x.bundles.includes(id));
    if (t) return t.kind === "bundle" ? `/guides/${d.slug}/every-cut/${t.id}/` : `/guides/${d.slug}/every-cut/${t.id}/#files`;
  }
  const d = ownersOf(id)[0];
  return d ? `/guides/${d.slug}/#every-cut` : null;
}

export const bundlePath = (id) => `/data/${id}/`;
const abs = (p) => SITE.url + p;

// A few bundles share a plain name (the same table in rupees and in dollars, two rulers with one
// coverage note); their file name tells them apart, so titles stay unique across the site.
let TITLE_COUNT;
function uniqueTitle(id, title) {
  if (!TITLE_COUNT) {
    TITLE_COUNT = new Map();
    for (const id of allBundleIds()) {
      const t = clean(bundleTitle(id, { meta: bundleSummary(id).meta }));
      TITLE_COUNT.set(t, (TITLE_COUNT.get(t) ?? 0) + 1);
    }
  }
  return TITLE_COUNT.get(title) > 1 ? `${title} (${id})` : title;
}

/** Everything a bundle's page and its Dataset need. With { full: true } the parsed bundle comes
 *  along (as j) for a page that lists the series; otherwise only the summary is read, and the
 *  series' labels only when asked for. Nothing is cached but the summary. */
export function bundleFacts(id, { full = false, labels = false } = {}) {
  const S = bundleSummary(id), m = S.meta;
  const j = full || labels || requiredByOwner(id) || m.dossier === "pensions" || m.dossier === "investor-participation" ? readBundle(id) : null;
  const keys = j ? Object.keys(j.series) : Array.from({ length: S.n });
  const first = S.first, last = S.last;
  const governed = j ? governedDownloadPlan(id, j, { required: requiredByOwner(id) }) : null;
  return {
    id, j: full ? j : null, meta: m, keys,
    labels: j ? keys.map((k) => clean(j.series[k].label || j.series[k].name || k)) : null,
    title: uniqueTitle(id, clean(bundleTitle(id, { meta: m }))),
    source: clean(m.source),
    freq: m.frequency,
    first, last,
    span: first === last ? periodName(first, m.frequency) : `${periodName(first, m.frequency)} to ${periodName(last, m.frequency)}`,
    vintage: ISO.test(m.vintage ?? "") ? m.vintage : null,
    released: ISO.test(m.releaseDate ?? "") ? m.releaseDate : null,
    geo: COUNTRIES[m.geo] ?? m.geo ?? "India",
    owners: ownersOf(id),
    governed,
  };
}

function distributions(f) {
  const out = [
    { "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: abs(`/data/${f.id}.csv`),
      ...(f.governed && !f.governed.eligible.length ? { description: "The list of series; their figures are in the JSON and the publisher's original file until each definition is checked." } : {}) },
    { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: abs(`/data/${f.id}.json`) },
  ];
  if (f.governed?.source?.href) out.push({ "@type": "DataDownload", name: "The publisher's original file", contentUrl: abs(f.governed.source.href),
    encodingFormat: /\.xlsx$/i.test(f.governed.source.href) ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/octet-stream" });
  return out;
}

const place = (name) => ({ "@type": "Place", name });
const temporal = (f) => (f.first === f.last ? f.first : `${f.first}/${f.last}`);
const TERMS = "Our compilation, CSV layout and derived series are under CC BY 4.0. The figures themselves keep the terms of the agency that publishes them; cite the agency as the source.";
const MAX_VARIABLES = 60;

/** The Dataset for one bundle, as its /data/<id>/ page carries it. */
export function bundleDataset(id, f = bundleFacts(id, { labels: true })) {
  const { creator, publisher } = agencyOf(f.meta.source, SITE);
  const guide = f.owners[0];
  const labels = f.labels ?? [];
  const lead = `${f.title}. ${f.keys.length.toLocaleString("en-IN")} series, ${f.freq}, ${f.span}, from ${f.source}.`;
  const desc = [lead, f.meta.note && clean(f.meta.note), f.meta.revisionPolicy && `Revisions: ${clean(f.meta.revisionPolicy)}`,
    guide && `Part of the ${SITE.name} guide to ${guide.title.toLowerCase()}.`].filter(Boolean).join(" ");
  return {
    "@type": "Dataset",
    "@id": abs(bundlePath(f.id)) + "#dataset",
    name: f.title.length > 3 ? f.title : `${f.id} (${f.source})`,
    description: desc.length > 5000 ? desc.slice(0, 4990).replace(/\s\S*$/, "") + "." : desc,
    url: abs(bundlePath(f.id)),
    identifier: f.id,
    creator,
    ...(publisher ? { publisher } : {}),
    ...(f.meta.sourceUrl ? { isBasedOn: f.meta.sourceUrl } : {}),
    license: SITE.license,
    conditionsOfAccess: TERMS,
    isAccessibleForFree: true,
    inLanguage: "en",
    temporalCoverage: temporal(f),
    spatialCoverage: place(f.geo),
    ...(f.vintage ? { dateModified: f.vintage } : {}),
    ...(f.released ? { datePublished: f.released } : {}),
    ...(f.meta.base && /\d/.test(f.meta.base) ? { version: `base ${clean(f.meta.base)}` } : {}),
    keywords: [...new Set([f.owners.map((d) => d.title), f.owners.map((d) => d.section), f.geo, f.freq].flat().filter(Boolean))],
    variableMeasured: labels.slice(0, MAX_VARIABLES),
    distribution: distributions(f),
    includedInDataCatalog: { "@type": "DataCatalog", name: `${SITE.name}: data`, url: abs("/data/") },
    ...(guide ? { isPartOf: { "@id": abs(`/guides/${guide.slug}/`) + "#dataset" } } : {}),
  };
}

/** The Dataset for a guide: what it covers, from whom, and its bundles as parts. */
export function guideDataset(d, headline) {
  const ids = guideBundles(d);
  const facts = ids.map((b) => bundleFacts(b));
  const cur = facts.find((f) => f.id === d.currentBundle) ?? facts[0];
  const orgs = [...new Map(facts.map((f) => agencyOf(f.meta.source, SITE).creator).map((o) => [o.name, o])).values()];
  const first = facts.map((f) => f.first).sort()[0], last = facts.map((f) => f.last).sort().at(-1);
  const vintages = facts.map((f) => f.vintage).filter(Boolean).sort();
  const lead = headline ? `Latest: ${headline.value}, ${headline.what}, ${headline.period}. ` : "";
  return {
    "@type": "Dataset",
    "@id": abs(`/guides/${d.slug}/`) + "#dataset",
    name: `${d.title} in India: ${clean(d.kickerTitle)}`,
    description: `${clean(d.description)} ${lead}${ids.length.toLocaleString("en-IN")} data files, each downloadable as CSV and JSON, with source, coverage and vintage.`,
    url: abs(`/guides/${d.slug}/`),
    creator: orgs.length === 1 ? orgs[0] : orgs,
    license: SITE.license,
    conditionsOfAccess: TERMS,
    isAccessibleForFree: true,
    inLanguage: "en",
    temporalCoverage: first === last ? first : `${first}/${last}`,
    spatialCoverage: place(cur?.geo ?? "India"),
    ...(vintages.length ? { dateModified: vintages.at(-1) } : {}),
    keywords: [d.title, d.section, clean(d.kickerTitle), "India"],
    distribution: cur ? distributions(cur) : [],
    includedInDataCatalog: { "@type": "DataCatalog", name: `${SITE.name}: data`, url: abs("/data/") },
  };
}

/** The latest data vintage among a guide's bundles (sitemap lastmod), or null. */
export function guideVintage(d) {
  return guideBundles(d).map((b) => bundleSummary(b).meta?.vintage).filter((v) => ISO.test(v ?? "")).sort().at(-1) ?? null;
}
