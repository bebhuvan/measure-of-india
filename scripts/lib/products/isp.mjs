// scripts/lib/products/isp.mjs — Index of Services Production (trial series).
// Rows carry no month field: fetch per month_code (1=April..12=March, fiscal
// order) and read each row's own fiscal-year label. Levels are the published
// index (base 2024-25=100); the API's growth_rate is null until a year-ago
// month exists, so y/y becomes computable from April 2026 — published growth
// is kept as a cross-check.

import { mospi, mospiAll } from "../mospi.mjs";
import { writeSeries, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";

// month_code (fiscal order) + FY label ("2026-27") -> "YYYY-MM"
function ispMonth(fy, monthCode) {
  const y1 = Number(String(fy).slice(0, 4));
  const mc = Number(monthCode);
  if (mc >= 1 && mc <= 9) return `${y1}-${String(mc + 3).padStart(2, "0")}`;      // Apr–Dec
  if (mc >= 10 && mc <= 12) return `${y1 + 1}-${String(mc - 9).padStart(2, "0")}`; // Jan–Mar
  return null;
}

export async function buildIsp(root, dcfg, vintage) {
  const levels = {}; // sector -> Map("YYYY-MM" -> index)
  const publishedGrowth = {}; // sector -> Map("YYYY-MM" -> published y/y)
  const rawRows = [];
  for (let mc = 1; mc <= 12; mc++) {
    const rows = (await mospiAll(dcfg.fetch.endpoint, { month_code: mc })).filter((r) => r.frequency === "Monthly");
    rawRows.push(...rows);
    for (const r of rows) {
      const ym = ispMonth(r.year, mc);
      if (!ym) continue;
      const v = parseFloat(r.index);
      if (!Number.isFinite(v)) continue;
      (levels[r.broad_sub_sector] ??= new Map()).set(ym, v);
      const g = parseFloat(r.growth_rate);
      if (Number.isFinite(g)) (publishedGrowth[r.broad_sub_sector] ??= new Map()).set(ym, g);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  const sectors = Object.keys(levels).sort();
  if (!sectors.length) throw new Error("ISP: no data returned");
  const allMonths = [...new Set(sectors.flatMap((s) => [...levels[s].keys()]))].sort();
  process.stdout.write(`isp: ${sectors.length} sectors, ${allMonths[0]} .. ${allMonths.at(-1)}\n`);

  const axis = monthAxis(allMonths[0], allMonths.at(-1));
  const greys = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
  const series = {};
  sectors.forEach((s, i) => {
    const key = s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    series[key] = {
      name: `isp_${key}_index`, label: s, color: i === 0 ? "#2E4BD8" : greys[(i - 1) % greys.length],
      data: axis.map((ym) => levels[s].get(ym) ?? null), unit: "index",
    };
  });
  const bundle = {
    meta: {
      dossier: "isp", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: allMonths.at(-1),
      releaseDate: null,
      note: "Trial series, from April 2025. Levels only until 13 months exist; the first computable y/y is April 2026.",
      revisionPolicy: dcfg.revision_policy,
    },
    dates: axis.map((ym) => `${ym}-01`),
    series,
  };
  const raw = { vintage, unit: "index, base 2024-25=100", rows: rawRows };
  writeRaw(root, "data/raw/isp-levels.json", raw);
  writeSeries(root, "data/series/isp.json", bundle);
  return bundle;
}

/* Catalogue (docs/CONTRACT-coverage.md): what MoSPI publishes for the ISP, from
 * isp/getISPFilter: isp:<monthly|annual>:<code>-<sub-sector> (base 2024-25, trial series). */
import { writeCatalogue, idPart, catalogueCli } from "../catalogue.mjs";
export async function catalogueIsp() {
  const f = ((await mospi("isp/getISPFilter", {})).data ?? [])[0] ?? {};
  const items = [];
  for (const fr of f.frequency ?? []) for (const s of f.broad_sub_sector ?? [])
    items.push({ id: `isp:${fr.description === "Monthly" ? "monthly" : "annual"}:${s.broad_sub_sector_code}-${idPart(s.description)}`, label: s.description.trim() });
  writeCatalogue("isp", {
    source: "MoSPI, NSO: Index of Services Production, trial series (eSankhyiki API)",
    generator: "scripts/lib/products/isp.mjs --catalogue",
    note: "From getISPFilter. Ids: isp:<frequency>:<code>-<sub-sector>.",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueIsp);
