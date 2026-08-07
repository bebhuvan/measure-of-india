// scripts/lib/products/wpi.mjs — Wholesale Price Index, OEA/DPIIT via eSankhyiki.
// Headline is computed from the three major groups via real weights (base
// 2011-12: Primary 22.62, Fuel & power 13.15, Manufactured 64.23); the
// published headline and the published Food index are fetched for
// cross-check and display, never substituted for the computed headline.

import { mospi } from "../mospi.mjs";
import { MONTHS, writeJson, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];

export async function buildWpi(root, dcfg, vintage) {
  const { params, major_groups } = dcfg.fetch;
  const endYear = new Date().getUTCFullYear();
  const levels = {}; // major-group key -> Map("YYYY-MM" -> index)
  for (const key of Object.values(major_groups)) levels[key] = new Map();
  const groupLevels = {}; // 2-digit group slug -> { label, map }
  const subgroupLevels = {}; // subgroup slug -> { label, map }

  for (const [mgCode, key] of Object.entries(major_groups)) {
    for (let year = 2012; year <= endYear; year++) {
      let page = 1;
      for (;;) {
        const res = await mospi(dcfg.fetch.endpoint, {
          ...params, major_group_code: mgCode, year, page,
        });
        const rows = res.data ?? [];
        for (const r of rows) {
          if (r.item != null) continue; // aggregates only — item level stays at the source
          const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
          if (m === "00") continue;
          const v = parseFloat(r.index_value);
          if (!Number.isFinite(v)) continue;
          const ym = `${r.year}-${m}`;
          if (r.group == null) {
            levels[key].set(ym, v);
          } else if (r.subgroup == null) {
            const k = slugify(r.group);
            (groupLevels[k] ??= { label: r.group, map: new Map() }).map.set(ym, v);
          } else if (r.sub_subgroup == null) {
            const k = slugify(r.subgroup);
            (subgroupLevels[k] ??= { label: r.subgroup, map: new Map() }).map.set(ym, v);
          }
        }
        const total = res.meta_data?.totalPages ?? 1;
        if (page >= total) break;
        page++;
      }
      process.stdout.write(`wpi ${key} ${year}: done\n`);
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const months = [...levels.published_headline.keys()].sort();
  if (!months.length) throw new Error("WPI: no data returned");
  const lastMonth = months[months.length - 1];

  // derived headline index from the three major groups
  const W = dcfg.weights;
  const headlineIdx = new Map();
  for (const ym of months) {
    let h = 0, ok = true;
    for (const k of ["primary", "fuel", "manufactured"]) {
      const v = levels[k].get(ym);
      if (v == null) { ok = false; break; }
      h += W[k] * v;
    }
    if (ok) headlineIdx.set(ym, h / 100);
  }

  const yoy = {
    headline: yoyFromLevels(headlineIdx),
    primary: yoyFromLevels(levels.primary),
    fuel: yoyFromLevels(levels.fuel),
    manufactured: yoyFromLevels(levels.manufactured),
    food_index: yoyFromLevels(levels.food_index),
    published_headline: yoyFromLevels(levels.published_headline),
  };

  const axis = monthAxis(dcfg.window.start, lastMonth);
  const dates = axis.map((ym) => `${ym}-01`);
  // WPI is released on ~the 14th of the following month (provisional)
  const [ly, lm] = lastMonth.split("-").map(Number);
  const relY = lm === 12 ? ly + 1 : ly;
  const relM = lm === 12 ? 1 : lm + 1;
  const bundle = {
    meta: {
      dossier: "wpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      latestPeriod: lastMonth,
      releaseDate: `${relY}-${String(relM).padStart(2, "0")}-14`,
      revisionPolicy: dcfg.revision_policy,
    },
    dates,
    series: {
      headline: { name: "headline_wpi_yoy_pct", label: "Headline", color: "#BE3E26", data: axis.map((ym) => yoy.headline.get(ym) ?? null) },
      primary: { name: "primary_articles_yoy_pct", label: "Primary", color: "#5B564B", data: axis.map((ym) => yoy.primary.get(ym) ?? null) },
      fuel: { name: "fuel_power_yoy_pct", label: "Fuel", color: "#A8A293", data: axis.map((ym) => yoy.fuel.get(ym) ?? null) },
      manufactured: { name: "manufactured_products_yoy_pct", label: "Manufactured", color: "#C6C0B0", data: axis.map((ym) => yoy.manufactured.get(ym) ?? null) },
      food_index: { name: "wpi_food_index_yoy_pct", label: "Food index", color: "#8A857A", data: axis.map((ym) => yoy.food_index.get(ym) ?? null) },
    },
    crosscheck: { published_headline: axis.map((ym) => yoy.published_headline.get(ym) ?? null) },
  };
  const raw = { vintage, unit: "index, base 2011-12=100", levels: {} };
  for (const [k, map] of Object.entries(levels)) raw.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, g] of Object.entries(groupLevels)) raw.levels[`group:${k}`] = Object.fromEntries([...g.map.entries()].sort());
  for (const [k, s] of Object.entries(subgroupLevels)) raw.levels[`subgroup:${k}`] = Object.fromEntries([...s.map.entries()].sort());
  writeRaw(root, "data/raw/wpi-indices.json", raw);

  // 2-digit groups bundle (Food articles, Mineral oils, Basic metals, …)
  const groupSeries = {};
  Object.keys(groupLevels).sort().forEach((k, i) => {
    const yoy = yoyFromLevels(groupLevels[k].map);
    groupSeries[k] = {
      name: `wpi_${k}_yoy_pct`, label: groupLevels[k].label, color: GREYS[i % GREYS.length],
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
  });
  const groupsBundle = {
    meta: {
      dossier: "wpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      latestPeriod: lastMonth, releaseDate: bundle.meta.releaseDate,
      coverage: "2-digit groups beneath the major groups",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: groupSeries,
  };
  // subgroups bundle — the full detailed level below the 2-digit groups
  // (134 series; item level stays at the source)
  const subgroupSeries = {};
  Object.keys(subgroupLevels).sort().forEach((k, i) => {
    const yoy = yoyFromLevels(subgroupLevels[k].map);
    subgroupSeries[k] = {
      name: `wpi_${k}_yoy_pct`, label: subgroupLevels[k].label, color: GREYS[i % GREYS.length],
      data: axis.map((ym) => yoy.get(ym) ?? null),
    };
  });
  const subgroupsBundle = {
    meta: {
      dossier: "wpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      latestPeriod: lastMonth, releaseDate: bundle.meta.releaseDate,
      coverage: "Sub-groups beneath the 2-digit groups — the most detailed aggregate level published",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: subgroupSeries,
  };
  writeJson(root, "data/series/wpi.json", bundle);
  writeJson(root, "data/series/wpi-groups.json", groupsBundle);
  writeJson(root, "data/series/wpi-subgroups.json", subgroupsBundle);
  return bundle;
}
