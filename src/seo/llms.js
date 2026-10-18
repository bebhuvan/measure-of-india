// src/seo/llms.js: the site described for language models (https://llmstxt.org/).
//   /llms.txt       what the site is, how it is organised, each guide with its latest figure and
//                   period, the state profiles, the notes, and where the data and feeds are
//   /llms-full.txt  the same, then every guide's latest reading in full: its headline figure, the
//                   dated prose the pipeline wrote and verified (pipeline/out, gated by verify.mjs and
//                   lint.mjs), and its data files; then every state profile's figures
// Nothing here is typed: figures come from headline.js (bundles), the verified prose files and the
// profiles' bundle cells (each carries its source cell); counts are counted. scripts/seo-check.mjs
// checks that every guide's headline figure and every prose paragraph appear exactly as published.
import fs from "node:fs";
import YAML from "yaml";
import { SITE } from "../site.js";
import { DOSSIERS } from "../dossiers/registry.js";
import { headlineOf } from "../dossiers/headline.js";
import { guideBundles } from "../dossiers/everycut.js";
import { bundleSummary, allBundleIds } from "./bundles.js";
import { STATES } from "../dossiers/states-key.js";
import { EXPLAINERS } from "../learn/registry.js";
import { bundleFacts } from "./dataset.js";
import { agencyOf } from "./agency.js";
import { longDate, flatPeriod } from "./feeds.js";

const U = (p) => SITE.url + p;
const clean = (t) => String(t ?? "").replace(/ — /g, ": ").replace(/ · /g, ", ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const n = (x) => x.toLocaleString("en-IN");
const sections = () => [...new Set(DOSSIERS.map((d) => d.section))];

function counts() {
  const files = allBundleIds();
  return { guides: DOSSIERS.length, states: STATES.length, files: files.length, series: files.reduce((a, b) => a + bundleSummary(b).n, 0), notes: EXPLAINERS.filter((e) => e.live !== false).length };
}

/** One guide's line: its latest figure, period, release and source. */
export function guideLine(d) {
  const h = headlineOf(d);
  const src = agencyOf(bundleSummary(d.currentBundle).meta?.source, SITE).creator.name;
  return `Latest: ${h.value}, ${h.what} (${flatPeriod(h.period)})${h.released ? `, released ${longDate(h.released)}` : ""}. Source: ${src}.`;
}

/** Each guide's verified dated prose, by slot, as the page prints it. */
export function guideProse(slug) {
  const slots = YAML.parse(fs.readFileSync("pipeline/slots.yml", "utf8"))[slug] ?? [];
  return slots.map((s) => {
    const file = `pipeline/out/prose-${slug}.${s.id}.md`;
    if (!fs.existsSync(file)) return null;
    const paras = fs.readFileSync(file, "utf8").trim().split(/\n\s*\n+/).map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean);
    const name = s.id.split(".").at(-1).replace(/-/g, " ");
    return { id: s.id, heading: name[0].toUpperCase() + name.slice(1), paras };
  }).filter(Boolean);
}

function header(c) {
  return `# ${SITE.name}

> ${SITE.tagline}: plain-language guides to India's official economic and social statistics, built from the figures each agency publishes, with every data file downloadable as CSV and JSON.

${SITE.name} (${SITE.url}/) has ${n(c.guides)} guides, a profile of each of the ${n(c.states)} states and union territories, ${n(c.notes)} notes on the ideas behind the numbers, and ${n(c.files)} data files holding ${n(c.series)} series. Sources are India's statistical agencies (MoSPI and the National Statistics Office, the Reserve Bank of India, ministries) and international bodies (the World Bank, the UN, the ILO, the BIS). It is a ${SITE.parent.name} project, made by ${SITE.publisher.name}.

How the figures are kept:
- Every figure is the agency's published number or is computed from published numbers, and is labelled where it is computed.
- A series measured on a different base year or method is a different series; the site never joins two into one line.
- A value the agency did not publish is left empty, never zero.
- Each guide names the period its latest figure describes and, where known, the date it was released. Each data file carries its data vintage, the date of the data, not of the download.

To cite a figure: name the publishing agency as the source and ${SITE.name} as the compiler, with the page's address and the period. Text and charts are under CC BY 4.0; each agency's data keeps its own terms.
`;
}

export function llmsTxt() {
  const c = counts();
  const guides = sections().map((sec) => `### ${sec}\n\n` + DOSSIERS.filter((d) => d.section === sec).map((d) =>
    `- [${d.title}](${U(`/guides/${d.slug}/`)}): ${guideLine(d)} ${clean(d.description)}`).join("\n")).join("\n\n");
  return `${header(c)}
## Guides

${guides}

## States and union territories

Each profile sets the state's figures (income, growth, prices, jobs, spending, health, banking, industry, farms, education, climate, state finances) against India and its neighbours.

- [All states and union territories](${U("/states/")})
${STATES.map((u) => `- [${u.name}](${U(`/states/${u.slug}/`)})`).join("\n")}

## Notes on the ideas behind the numbers

${EXPLAINERS.filter((e) => e.live !== false).map((e) => `- [${clean(e.title)}](${U(`/learn/${e.slug}/`)}): ${clean(e.blurb)}`).join("\n")}

## Data and feeds

- [Data catalogue](${U("/data/")}): every guide's files. Each file has a page at ${U("/data/<file>/")} and downloads at ${U("/data/<file>.csv")} and ${U("/data/<file>.json")}.
- [Releases feed](${U("/feeds/releases.xml")}) and [JSON Feed](${U("/feeds/releases.json")}): each new figure as it is released.
- [Sitemap](${U("/sitemap-index.xml")})

## Optional

- [Everything in one file](${U("/llms-full.txt")}): every guide's latest reading in full, its data files, and every state profile's figures.
- [How the site works](${U("/method/")})
- [About](${U("/about/")})
`;
}

export async function llmsFullTxt() {
  const c = counts();
  const { page } = await import("../dossiers/profiles.js");
  const guides = DOSSIERS.map((d) => {
    const files = guideBundles(d).map((b) => bundleFacts(b));
    const prose = guideProse(d.slug);
    return `## ${d.title} (${clean(d.kickerTitle)})

${U(`/guides/${d.slug}/`)}

${clean(d.description)}

${guideLine(d)}
${prose.map((p) => `\n### ${p.heading}\n\n${p.paras.join("\n\n")}`).join("\n")}

### Data files (${n(files.length)})

${files.map((f) => `- [${f.title}](${U(`/data/${f.id}/`)}): ${n(f.keys.length)} series, ${f.freq}, ${f.span}. ${f.source}.${f.vintage ? ` Vintage ${f.vintage}.` : ""}`).join("\n")}
`;
  }).join("\n");
  const states = STATES.map((u) => {
    const P = page(u.slug);
    const rows = P.sections.map((s) => {
      const figs = s.figures.filter((f) => f.sourceQuality?.canInterpret !== false && f.text);
      if (!figs.length) return null;
      return `${s.title}:\n` + figs.map((f) => `- ${clean(f.label)}: ${clean(f.text)} (${f.period})${f.rank ? `, rank ${f.rank.r} of ${f.rank.n}${f.rank.tied > 1 ? ", tied" : ""}` : ""}`).join("\n");
    }).filter(Boolean);
    return `## ${u.name}\n\n${U(`/states/${u.slug}/`)}\n\n${clean(P.lede)}\n\n${rows.join("\n\n")}\n`;
  }).join("\n");
  return `${header(c)}
This file holds every guide's latest reading as the site prints it, each guide's data files, and every state profile's figures. Ranks run from the highest value (rank 1) among the states and union territories with a figure for that period.

# Guides

${guides}
# States and union territories

${states}`;
}
