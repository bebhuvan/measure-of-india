// Site RSS feed — one item per dossier revision.
import rss from "@astrojs/rss";
import fs from "node:fs";
import path from "node:path";

const read = (slug) =>
  JSON.parse(fs.readFileSync(path.resolve("data/series", slug + ".json"), "utf8"));

export function GET(context) {
  const cpi = read("cpi");
  const gdp = read("gdp");
  const wpi = read("wpi");
  const iip = read("iip-2022");
  const forex = read("rbi-forex");
  const plfs = read("plfs-monthly");
  const hces = read("hces-mpce");
  const asi = read("asi-headline");
  const items = [
    {
      title: `Dossier 01 · Consumer Price Index — ${cpi.series.headline.data.at(-1).toFixed(2)}% (${cpi.meta.latestPeriod})`,
      link: "/dossiers/cpi/",
      description: "The cost of an ordinary shopping basket, measured monthly. Revised with the latest print.",
      pubDate: new Date(cpi.meta.releaseDate + "T00:00:00Z"),
    },
    {
      title: `Dossier 02 · National Accounts — ${gdp.series.gdp.data.at(-1).toFixed(2)}% (latest quarter)`,
      link: "/dossiers/gdp/",
      description: "The size and speed of the whole economy, estimated quarterly. Revised with the latest print.",
      pubDate: new Date("2025-11-28T00:00:00Z"),
    },
    {
      title: `Dossier 03 · Wholesale Prices — ${wpi.series.headline.data.at(-1).toFixed(2)}% (${wpi.meta.latestPeriod})`,
      link: "/dossiers/wpi/",
      description: "Factory-gate prices — a different basket from the CPI, measuring a different thing. Revised with the latest print.",
      pubDate: new Date(wpi.meta.vintage + "T00:00:00Z"),
    },
    {
      title: `Dossier 04 · Industrial Production — ${iip.series.general.data.at(-1).toFixed(2)}% (${iip.meta.latestPeriod})`,
      link: "/dossiers/iip/",
      description: "The monthly pulse of mining, manufacturing and electricity. Revised with the latest print.",
      pubDate: new Date(iip.meta.vintage + "T00:00:00Z"),
    },
    {
      title: `Dossier 05 · The External Account — reserves $${Math.round(forex.series.reserves.data.at(-1) / 1000)} bn`,
      link: "/dossiers/external/",
      description: "Exports, imports, reserves and the rupee — the country's ledger with the rest of the world. Revised with each release.",
      pubDate: new Date(forex.meta.vintage + "T00:00:00Z"),
    },
    {
      title: `Dossier 06 · Employment & Unemployment — ${plfs.series.ur.data.at(-1).toFixed(2)}% (${plfs.meta.latestPeriod})`,
      link: "/dossiers/jobs/",
      description: "The Periodic Labour Force Survey: unemployment, participation, and the three stopwatches India times its workers with. Revised with each bulletin.",
      pubDate: new Date(plfs.meta.vintage + "T00:00:00Z"),
    },
    {
      title: `Dossier 07 · Household Consumption — rural MPCE ₹${hces.series.rural.data.at(-1).toLocaleString("en-IN")} (2023-24 round)`,
      link: "/dossiers/consumption/",
      description: "The Household Consumption Expenditure Survey: what a person spends in a month, rung by rung of the ladder. Revised with each survey round.",
      pubDate: new Date(hces.meta.vintage + "T00:00:00Z"),
    },
    {
      title: `Dossier 08 · Enterprises — ${(asi.series.factories_in_operation.data.at(-1) / 1e5).toFixed(2)} lakh factories in operation (ASI 2023-24)`,
      link: "/dossiers/factories/",
      description: "The Annual Survey of Industries and ASUSE: registered factories and unincorporated enterprises, side by side and never conflated. Revised with each survey round.",
      pubDate: new Date(asi.meta.vintage + "T00:00:00Z"),
    },
  ];
  return rss({
    title: "India Atlas",
    description: "India's economic data, one dossier at a time.",
    site: context.site,
    items,
  });
}
