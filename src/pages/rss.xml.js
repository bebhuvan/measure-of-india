// Site RSS feed — one item per dossier, stamped with the data vintage of the
// bundle each dossier's title block actually leads with (the CURRENT ruler —
// see docs/CONTRACT-series.md; never a retired base). pubDate prefers the
// source's releaseDate and falls back to the bundle vintage.
// Dossier metadata comes from src/dossiers/registry.js; only the headline
// stat renderers live here (they are functions, the registry is pure data).
import rss from "@astrojs/rss";
import fs from "node:fs";
import path from "node:path";
import { DOSSIERS } from "../dossiers/registry.js";

const read = (slug) =>
  JSON.parse(fs.readFileSync(path.resolve("data/series", slug + ".json"), "utf8"));

// slug → headline stat renderer. The renderer must mirror the dossier page's
// title-block formatter exactly — the feed may never quote a figure the page
// does not. A dossier without a renderer fails the build, loudly.
const STAT = {
  cpi: (b) => `Consumer Price Index — ${b.series.headline.data.at(-1).toFixed(2)}% (${b.meta.latestPeriod})`,
  gdp: (b) => `National Accounts — ${b.series.gdp.data.at(-1).toFixed(2)}% (${b.meta.latestPeriod})`,
  wpi: (b) => `Wholesale Prices — ${b.series.headline.data.at(-1).toFixed(2)}% (${b.meta.latestPeriod})`,
  iip: (b) => `Industrial Production — ${b.series.general.data.at(-1).toFixed(2)}% (${b.meta.latestPeriod})`,
  external: (b) => `The External Account — reserves $${Math.round(b.series.reserves.data.at(-1) / 1000)} bn`,
  jobs: (b) => `Employment & Unemployment — ${b.series.ur.data.at(-1).toFixed(2)}% (${b.meta.latestPeriod})`,
  consumption: (b) => `Household Consumption — rural MPCE ₹${b.series.rural.data.at(-1).toLocaleString("en-IN")} (${b.meta.latestPeriod} round)`,
  factories: (b) => `Enterprises — ${(b.series.factories_in_operation.data.at(-1) / 1e5).toFixed(2)} lakh factories in operation (${b.meta.latestPeriod} round)`,
  aishe: (b) => `Higher Education — ${(b.series.enrolment.data.at(-1) / 1e7).toFixed(2)} crore enrolled (${b.meta.latestPeriod})`,
  gender: (b) => `Gender — sex ratio ${b.series.sex_ratio.data.at(-1)} ♀ per 1,000 ♂ (${b.meta.latestPeriod})`,
  mnre: (b) => `Renewable Energy — ${(b.series.grand_total.data.at(-1) / 1000).toFixed(1)} GW installed (${b.meta.latestPeriod})`,
  nfhs: (b) => { const s = Object.values(b.series).find((x) => x.label.includes("Children age 6-59")); return `Health — child anaemia ${s.data.at(-1).toFixed(1)}% (NFHS-5)`; },
};

export function GET(context) {
  const items = DOSSIERS.map((d) => {
    const stat = STAT[d.slug];
    if (!stat) throw new Error(`rss: no stat renderer for dossier "${d.slug}" (src/pages/rss.xml.js STAT)`);
    const b = read(d.currentBundle);
    const stamp = b.meta.releaseDate ?? b.meta.vintage;
    return {
      title: `Dossier ${d.no} · ${stat(b)}`,
      link: `/dossiers/${d.slug}/`,
      description: d.rssDescription,
      pubDate: new Date(stamp + "T00:00:00Z"),
    };
  });
  return rss({
    title: "India Atlas",
    description: "India's economic data, one dossier at a time.",
    site: context.site,
    items,
  });
}
