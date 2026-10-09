// scripts/lib/products/wpi.mjs — Wholesale Price Index, OEA/DPIIT via eSankhyiki.
// Headline is computed from the three major groups via real weights (base
// 2011-12: Primary 22.62, Fuel & power 13.15, Manufactured 64.23); the
// published headline and the published Food index are fetched for
// cross-check and display, never substituted for the computed headline.

import { mospi, mospiAll } from "../mospi.mjs";
import fs from "node:fs";
import { quarantine } from "./cpiiw.mjs";
import path from "node:path";
import { MONTHS, writeSeries, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];

export async function buildWpi(root, dcfg, vintage) {
  // The 2011-12 base ended in April 2026 and its last months are final; its bundles are
  // baked and its raw dumps are the audit trail. With `retired: true` the base is not
  // fetched again (about 7,800 calls at the API's 100-row cap): the sub-sub-group bundle
  // (wave 2) is baked from data/raw/wpi-items.json, and the live bases run as usual.
  if (dcfg.fetch.retired) {
    const raw = JSON.parse(fs.readFileSync(path.join(root, "data/raw/wpi-items.json"), "utf8"));
    const groups = JSON.parse(fs.readFileSync(path.join(root, "data/series/wpi-groups.json"), "utf8"));
    const subsub = Object.fromEntries(Object.entries(raw.sub_subgroups).map(([k, o]) => [k, { label: o.label, group: o.group, subgroup: o.subgroup, map: new Map(Object.entries(o.levels)) }]));
    const axis = groups.dates.map((d) => d.slice(0, 7));
    writeSeries(root, "data/series/wpi-subsubgroups.json", subsubBundle(subsub, axis, groups.dates, groups.meta, "wpi_ssg_", "Sub-sub-groups between the sub-groups and the items, base 2011-12"));
    if (dcfg.fetch2022) await buildWpi2022(root, dcfg, vintage);
    for (const old of dcfg.fetchOld ?? []) await buildWpiOld(root, dcfg, vintage, old);
    return JSON.parse(fs.readFileSync(path.join(root, "data/series/wpi.json"), "utf8"));
  }
  const { params, major_groups } = dcfg.fetch;
  const endYear = new Date().getUTCFullYear();
  const levels = {}; // major-group key -> Map("YYYY-MM" -> index)
  for (const key of Object.values(major_groups)) levels[key] = new Map();
  const groupLevels = {}; // 2-digit group slug -> { label, map }
  const subgroupLevels = {}; // subgroup slug -> { label, map }
  // ITEM LEVEL (v1.2). The same paged stream carries the item rows — no extra
  // requests. 697 items in the 2011-12 basket (117 primary / 16 fuel / 564
  // manufactured); labels are unique across the basket (verified against
  // wpi/getWpiData filter metadata), so the item slug alone is a safe key.
  const itemLevels = {}; // item slug -> { label, lineage fields, map }
  // Between sub-group and item sit four sub-sub-group aggregates (Cereals,
  // Pulses, Vegetables, Fruits) — archived to raw for a complete tree.
  const subsubLevels = {}; // sub-sub-group slug -> { label, lineage, map }

  for (const [mgCode, key] of Object.entries(major_groups)) {
    for (let year = 2012; year <= endYear; year++) {
      let page = 1;
      for (;;) {
        const res = await mospi(dcfg.fetch.endpoint, {
          ...params, major_group_code: mgCode, year, page,
        });
        const rows = res.data ?? [];
        for (const r of rows) {
          const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
          if (m === "00") continue;
          const v = parseFloat(r.index_value);
          if (!Number.isFinite(v)) continue;
          const ym = `${r.year}-${m}`;
          if (r.item != null) {
            const k = slugify(r.item);
            (itemLevels[k] ??= {
              label: r.item, majorgroup: r.majorgroup, group: r.group,
              subgroup: r.subgroup, sub_subgroup: r.sub_subgroup ?? null, map: new Map(),
            }).map.set(ym, v);
          } else if (r.group == null) {
            levels[key].set(ym, v);
          } else if (r.subgroup == null) {
            const k = slugify(r.group);
            (groupLevels[k] ??= { label: r.group, map: new Map() }).map.set(ym, v);
          } else if (r.sub_subgroup == null) {
            const k = slugify(r.subgroup);
            (subgroupLevels[k] ??= { label: r.subgroup, map: new Map() }).map.set(ym, v);
          } else {
            const k = slugify(r.sub_subgroup);
            (subsubLevels[k] ??= {
              label: r.sub_subgroup, group: r.group, subgroup: r.subgroup, map: new Map(),
            }).map.set(ym, v);
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
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth,
      releaseDate: `${relY}-${String(relM).padStart(2, "0")}-14`,
      revisionPolicy: dcfg.revision_policy,
    },
    dates,
    series: {
      headline: { name: "headline_wpi_yoy_pct", label: "Headline", color: "#2E4BD8", data: axis.map((ym) => yoy.headline.get(ym) ?? null) },
      primary: { name: "primary_articles_yoy_pct", label: "Primary", color: "#5F6675", data: axis.map((ym) => yoy.primary.get(ym) ?? null) },
      fuel: { name: "fuel_power_yoy_pct", label: "Fuel", color: "#A3A9B4", data: axis.map((ym) => yoy.fuel.get(ym) ?? null) },
      manufactured: { name: "manufactured_products_yoy_pct", label: "Manufactured", color: "#C9CED6", data: axis.map((ym) => yoy.manufactured.get(ym) ?? null) },
      food_index: { name: "wpi_food_index_yoy_pct", label: "Food index", color: "#878D99", data: axis.map((ym) => yoy.food_index.get(ym) ?? null) },
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
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth, releaseDate: bundle.meta.releaseDate,
      coverage: "2-digit groups beneath the major groups",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: groupSeries,
  };
  // subgroups bundle — the full detailed level below the 2-digit groups
  // (134 series; the 697 items are baked separately in wpi-items.json)
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
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth, releaseDate: bundle.meta.releaseDate,
      coverage: "Sub-groups beneath the 2-digit groups — the most detailed aggregate level published",
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: subgroupSeries,
  };
  // ---- item level: raw dump + full-history y/y bundle ----
  // Raw is the audit trail: every item's complete level history with its
  // lineage, plus the four sub-sub-group aggregates.
  const itemsRaw = {
    vintage, unit: "index, base 2011-12=100",
    coverage: "all items of the 2011-12 basket, with lineage; plus the four sub-sub-group aggregates",
    items: {}, sub_subgroups: {},
  };
  for (const k of Object.keys(itemLevels).sort()) {
    const it = itemLevels[k];
    itemsRaw.items[k] = {
      label: it.label, majorgroup: it.majorgroup, group: it.group,
      subgroup: it.subgroup, sub_subgroup: it.sub_subgroup,
      levels: Object.fromEntries([...it.map.entries()].sort()),
    };
  }
  for (const k of Object.keys(subsubLevels).sort()) {
    const s = subsubLevels[k];
    itemsRaw.sub_subgroups[k] = {
      label: s.label, group: s.group, subgroup: s.subgroup,
      levels: Object.fromEntries([...s.map.entries()].sort()),
    };
  }
  writeRaw(root, "data/raw/wpi-items.json", itemsRaw);

  // SIZE DECISION (measured): full y/y history for all 697 items on the
  // 2016-01.. axis bakes to ~1.1 MB pretty-printed — well under the 8-10 MB
  // budget at which a cross-section-only bundle would be baked instead. So
  // the bundle carries the complete y/y history for every item; the full
  // level history lives in raw.
  const itemSeries = {};
  const gapDates = new Set();
  Object.keys(itemLevels).sort().forEach((k, i) => {
    const it = itemLevels[k];
    const yy = yoyFromLevels(it.map);
    const data = axis.map((ym) => yy.get(ym) ?? null);
    const first = data.findIndex((v) => v != null);
    if (first !== -1) {
      const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
      data.forEach((v, j) => { if (v == null && j > first && j < last) gapDates.add(dates[j]); });
    }
    const lineage = [it.majorgroup, it.group, it.subgroup, it.sub_subgroup].filter(Boolean).join(" › ");
    itemSeries[k] = {
      name: `wpi_item_${k}_yoy_pct`, label: it.label, lineage,
      color: GREYS[i % GREYS.length],
      latestIndex: it.map.get(lastMonth) ?? null,
      data,
    };
  });
  const itemsBundle = {
    meta: {
      dossier: "wpi", frequency: "monthly", base: dcfg.base,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: lastMonth, releaseDate: bundle.meta.releaseDate,
      coverage: `The ${Object.keys(itemSeries).length} items beneath the sub-groups — the finest grain the OEA publishes`,
      note: "full y/y history for every item, computed from index levels; latestIndex is the level at latestPeriod; item weights are not served by the API, so no weighted recomposition is asserted",
      gaps: [...gapDates].sort(),
      revisionPolicy: dcfg.revision_policy,
    },
    dates, series: itemSeries,
  };
  writeSeries(root, "data/series/wpi.json", bundle);
  writeSeries(root, "data/series/wpi-groups.json", groupsBundle);
  writeSeries(root, "data/series/wpi-subgroups.json", subgroupsBundle);
  writeSeries(root, "data/series/wpi-items.json", itemsBundle);
  // wave 2 (lb/prices): the sub-sub-group aggregates between sub-group and item, baked
  writeSeries(root, "data/series/wpi-subsubgroups.json", subsubBundle(subsubLevels, axis, dates, groupsBundle.meta, "wpi_ssg_", "Sub-sub-groups between the sub-groups and the items, base 2011-12"));
  if (dcfg.fetch2022) await buildWpi2022(root, dcfg, vintage);
  for (const old of dcfg.fetchOld ?? []) await buildWpiOld(root, dcfg, vintage, old);
  return bundle;
}

// ---- base 2022-23 (current OEA series, Apr 2023 on) ----
// A different ruler from 2011-12: 953 items, crude petroleum moved from
// Primary to Fuel & power, Food index recoded 1400000000. Baked as its own
// bundles (wpi-2022*.json), never joined to the 2011-12 base.
// Differences from the 2011-12 fetch, checked live 2026-10-09:
// - limit above 100 returns HTTP 400 on this base; pages are 100 rows;
// - field names are major_group / sub_group / sub_sub_group (2011-12 uses
//   majorgroup / subgroup / sub_subgroup); the raw dump below is written in
//   the 2011-12 schema so validate.mjs runs one item check for both bases;
// - the API serves no weights for this base, so the headline is the
//   PUBLISHED index (no computed recomposition is asserted; meta.note says so).
// One unfiltered stream per year carries the whole tree (~9.1k rows/year).
async function buildWpi2022(root, dcfg, vintage) {
  const f = dcfg.fetch2022;
  const MAJOR = Object.fromEntries(Object.entries(f.major_groups).map(([label, key]) => [label.toLowerCase(), key]));
  const TREE = new Set(["primary", "fuel", "manufactured"]); // the food index re-lists items; its tree is not baked
  const levels = {};
  for (const key of Object.values(MAJOR)) levels[key] = new Map();
  const groupLevels = {}, subgroupLevels = {}, subsubLevels = {}, itemLevels = {};
  const collisions = [];
  const endYear = new Date().getUTCFullYear();

  for (let year = f.first_year; year <= endYear; year++) {
    let page = 1;
    for (;;) {
      const res = await mospi(dcfg.fetch.endpoint, { base_year: f.base_year, year, page, limit: f.limit });
      for (const r of res.data ?? []) {
        const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
        if (m === "00") continue;
        const v = parseFloat(r.index_value);
        if (!Number.isFinite(v)) continue;
        const key = MAJOR[String(r.major_group ?? "").toLowerCase()];
        if (!key) throw new Error(`WPI 2022-23: unknown major group "${r.major_group}"`);
        const ym = `${r.year}-${m}`;
        if (r.group == null) { levels[key].set(ym, v); continue; }
        if (!TREE.has(key)) continue;
        if (r.item != null) {
          const lineage = { majorgroup: r.major_group, group: r.group, subgroup: r.sub_group ?? null, sub_subgroup: r.sub_sub_group ?? null };
          let k = slugify(r.item);
          const prior = itemLevels[k];
          if (prior && (prior.group !== lineage.group || prior.subgroup !== lineage.subgroup)) {
            // same label in two places in the basket: key by sub-group too
            k = `${k}__${slugify(lineage.subgroup ?? lineage.group)}`;
            if (!itemLevels[k]) collisions.push(k);
          }
          (itemLevels[k] ??= { label: r.item, ...lineage, map: new Map() }).map.set(ym, v);
        } else if (r.sub_group == null) {
          (groupLevels[slugify(r.group)] ??= { label: r.group, map: new Map() }).map.set(ym, v);
        } else if (r.sub_sub_group == null) {
          (subgroupLevels[slugify(r.sub_group)] ??= { label: r.sub_group, map: new Map() }).map.set(ym, v);
        } else {
          (subsubLevels[slugify(r.sub_sub_group)] ??= { label: r.sub_sub_group, group: r.group, subgroup: r.sub_group, map: new Map() }).map.set(ym, v);
        }
      }
      const total = res.meta_data?.totalPages ?? 1;
      if (page >= total) break;
      page++;
    }
    process.stdout.write(`wpi 2022-23 ${year}: done\n`);
  }
  if (collisions.length) console.log(`wpi 2022-23: ${collisions.length} item labels repeat in the basket, keyed by sub-group: ${collisions.join(", ")}`);

  const months = [...levels.published_headline.keys()].sort();
  if (!months.length) throw new Error("WPI 2022-23: no data returned");
  const lastMonth = months[months.length - 1];
  // y/y needs a same-base year-ago level, so the axis starts 12 months in
  const axis = monthAxis(f.window.start, lastMonth);
  const dates = axis.map((ym) => `${ym}-01`);
  const [ly, lm] = lastMonth.split("-").map(Number);
  const releaseDate = `${lm === 12 ? ly + 1 : ly}-${String(lm === 12 ? 1 : lm + 1).padStart(2, "0")}-14`;
  const unit = `index, base ${f.base}`;

  // y/y series with its own interior gaps declared (CONTRACT-series rule 2)
  const yoySeries = (map, extra) => {
    const yy = yoyFromLevels(map);
    const data = axis.map((ym) => yy.get(ym) ?? null);
    const first = data.findIndex((v) => v != null);
    const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = first === -1 ? [] : dates.filter((d, j) => j > first && j < last && data[j] == null);
    return { ...extra, data, ...(gaps.length ? { gaps } : {}) };
  };
  const meta = (coverage, note) => ({
    dossier: "wpi", frequency: "monthly", base: f.base,
    source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
    latestPeriod: lastMonth, releaseDate, coverage,
    ...(note ? { note } : {}),
    revisionPolicy: dcfg.revision_policy,
  });

  const headline = {
    meta: meta(
      "All India; published headline, the three major groups and the Food index, base 2022-23",
      "y/y computed from published index levels. The headline is the published WPI: the API serves no weights for this base, so no recomposition from the major groups is asserted. Crude petroleum & natural gas sits in Fuel & power on this base (Primary articles on 2011-12), so major groups are not comparable across the two bases.",
    ),
    dates,
    series: {
      headline: yoySeries(levels.published_headline, { name: "headline_wpi_yoy_pct", label: "Headline", color: "#2E4BD8" }),
      primary: yoySeries(levels.primary, { name: "primary_articles_yoy_pct", label: "Primary", color: "#5F6675" }),
      fuel: yoySeries(levels.fuel, { name: "fuel_power_yoy_pct", label: "Fuel", color: "#A3A9B4" }),
      manufactured: yoySeries(levels.manufactured, { name: "manufactured_products_yoy_pct", label: "Manufactured", color: "#C9CED6" }),
      food_index: yoySeries(levels.food_index, { name: "wpi_food_index_yoy_pct", label: "Food index", color: "#878D99" }),
    },
  };
  const tree = (obj, prefix) => {
    const out = {};
    Object.keys(obj).sort().forEach((k, i) => {
      out[k] = yoySeries(obj[k].map, { name: `wpi_${prefix}${k}_yoy_pct`, label: obj[k].label, color: GREYS[i % GREYS.length] });
    });
    return out;
  };
  const groups = { meta: meta("2-digit groups beneath the major groups, base 2022-23"), dates, series: tree(groupLevels, "") };
  const subgroups = { meta: meta("Sub-groups beneath the 2-digit groups, base 2022-23"), dates, series: tree(subgroupLevels, "") };
  const itemSeries = {};
  Object.keys(itemLevels).sort().forEach((k, i) => {
    const it = itemLevels[k];
    itemSeries[k] = yoySeries(it.map, {
      name: `wpi_item_${k}_yoy_pct`, label: it.label,
      lineage: [it.majorgroup, it.group, it.subgroup, it.sub_subgroup].filter(Boolean).join(" › "),
      color: GREYS[i % GREYS.length],
      latestIndex: it.map.get(lastMonth) ?? null,
    });
  });
  const items = {
    meta: meta(
      `The ${Object.keys(itemSeries).length} items of the 2022-23 basket`,
      "full y/y history for every item, computed from index levels; latestIndex is the level at latestPeriod; item weights are not served by the API, so no weighted recomposition is asserted",
    ),
    dates, series: itemSeries,
  };

  const raw = { vintage, unit, levels: {} };
  for (const [k, map] of Object.entries(levels)) raw.levels[k] = Object.fromEntries([...map.entries()].sort());
  for (const [k, g] of Object.entries(groupLevels)) raw.levels[`group:${k}`] = Object.fromEntries([...g.map.entries()].sort());
  for (const [k, s] of Object.entries(subgroupLevels)) raw.levels[`subgroup:${k}`] = Object.fromEntries([...s.map.entries()].sort());
  writeRaw(root, "data/raw/wpi-2022-indices.json", raw);
  const itemsRaw = {
    vintage, unit,
    coverage: "all items of the 2022-23 basket with lineage (2011-12 field names), plus the sub-sub-group aggregates",
    items: {}, sub_subgroups: {},
  };
  for (const k of Object.keys(itemLevels).sort()) {
    const { map, ...rest } = itemLevels[k];
    itemsRaw.items[k] = { ...rest, levels: Object.fromEntries([...map.entries()].sort()) };
  }
  for (const k of Object.keys(subsubLevels).sort()) {
    const { map, ...rest } = subsubLevels[k];
    itemsRaw.sub_subgroups[k] = { ...rest, levels: Object.fromEntries([...map.entries()].sort()) };
  }
  writeRaw(root, "data/raw/wpi-2022-items.json", itemsRaw);

  writeSeries(root, "data/series/wpi-2022.json", headline);
  writeSeries(root, "data/series/wpi-2022-groups.json", groups);
  writeSeries(root, "data/series/wpi-2022-subgroups.json", subgroups);
  writeSeries(root, "data/series/wpi-2022-items.json", items);
  writeSeries(root, "data/series/wpi-2022-subsubgroups.json", subsubBundle(subsubLevels, axis, dates, groups.meta, "wpi_ssg_", "Sub-sub-groups between the sub-groups and the items, base 2022-23"));
}

// y/y bundle of the sub-sub-group aggregates (wave 2, lb/prices), each series carrying its
// group and sub-group so the every-cut table can filter by them
function subsubBundle(levels, axis, dates, baseMeta, prefix, coverage) {
  const series = {};
  Object.keys(levels).sort().forEach((k, i) => {
    const yy = yoyFromLevels(levels[k].map);
    const data = axis.map((ym) => yy.get(ym) ?? null);
    const first = data.findIndex((v) => v != null);
    const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = first < 0 ? [] : dates.filter((d, j) => j > first && j < last && data[j] == null);
    series[k] = { name: `${prefix}${k}_yoy_pct`, label: levels[k].label, lineage: [levels[k].group, levels[k].subgroup].filter(Boolean).join(" › "), group: levels[k].group ?? undefined,
      color: GREYS[i % GREYS.length], unit: "pct_yoy", data, ...(gaps.length ? { gaps } : {}) };
  });
  for (const [k, s] of Object.entries(series)) if (s.data.every((v) => v == null)) delete series[k];
  return { meta: { ...baseMeta, coverage }, dates, series };
}

/* =========================================================================
 * The retired bases, 2004-05 and 1993-94 (wave 2, lb/prices). The API still serves both
 * through getWpiRecords (base_year param; same field names as 2022-23). Each base is its own
 * set of bundles (wpi-2004*, wpi-1993*), never joined to another (AGENTS.md rule 1):
 *   wpi-<tag>              published headline and the three major groups, y/y
 *   wpi-<tag>-groups, -subgroups, -subsubgroups, -items   the whole tree, y/y
 * The headline is the published index (no recomposition from weights is asserted). y/y is
 * computed from published levels inside the base, so each base's first year has none.
 * Pagination is checked: every (node, month) must appear once per year's stream.
 * ========================================================================= */
async function buildWpiOld(root, dcfg, vintage, f) {
  const MAJOR = Object.fromEntries(Object.entries(f.major_groups).map(([label, key]) => [label.trim().toLowerCase(), key]));
  const levels = Object.fromEntries(Object.values(MAJOR).map((k) => [k, new Map()]));
  const groupLevels = {}, subgroupLevels = {}, subsubLevels = {}, itemLevels = {};
  const filt = (await mospi("wpi/getWpiData", { base_year: f.base_year })).data ?? {};
  const years = (filt.year ?? []).map((y) => Number(y.year)).sort();
  if (!years.length) throw new Error(`WPI ${f.base_year}: the filter lists no years`);
  // The old bases serve some nodes without their labels (1993-94: the Fuel major group and
  // its three groups arrive as four rows with every label blank) and a few labelled nodes
  // twice with different values (1993-94 pesticides; 2004-05 wood products, drugs,
  // petrochemical intermediates). Such a (node, month) cannot be attributed: every value
  // for it is set aside, and the node is named in meta.note. A node repeated with the SAME
  // value is one row served twice and is kept.
  let repeats = 0, sentinels = 0;
  const ambiguous = new Set();
  const allRows = [];
  for (const year of years) allRows.push(...await mospiAll(dcfg.fetch.endpoint, { base_year: f.base_year, year }));
  {
    const vals = new Map();
    for (const r of allRows) { const id = [r.major_group, r.group, r.sub_group, r.sub_sub_group, r.item, r.year, r.month].join("|"); (vals.get(id) ?? vals.set(id, new Set()).get(id)).add(r.index_value); }
    for (const [id, v] of vals) if (v.size > 1) ambiguous.add(id.split("|").slice(0, 5).join("|"));
  }
  for (const year of [0]) {
    const rows = allRows;
    const seen = new Set();
    for (let r of rows) {
      const node = [r.major_group, r.group, r.sub_group, r.sub_sub_group, r.item].join("|");
      if (ambiguous.has(node)) continue;
      const id = node + "|" + r.year + "|" + r.month;
      if (seen.has(id)) { repeats++; continue; }
      seen.add(id);
      const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
      if (m === "00") continue;
      const v = parseFloat(r.index_value);
      if (!Number.isFinite(v) || v === 0) continue;
      // 9999.9 is the old bases' code for "not available" (939 cells on 1993-94, 1,475 on
      // 2004-05): a missing value, never a price
      if (v >= 9999) { sentinels++; continue; }
      const key = MAJOR[String(r.major_group ?? "").trim().toLowerCase()];
      if (!key) throw new Error(`WPI ${f.base_year}: unknown major group "${r.major_group}"`);
      const ym = `${r.year}-${m}`;
      // 2004-05 serves the fuel tree one level up: the group (COAL, MINERAL OILS, ELECTRICITY)
      // in the sub-group field with the group field blank. Shift it back down.
      if (r.group == null && r.sub_group != null) r = { ...r, group: r.sub_group, sub_group: r.sub_sub_group ?? null, sub_sub_group: null };
      // an item row first: on 1993-94 the fuel items arrive with blank group labels, and must
      // not be read as the major group's aggregate
      if (r.group == null && r.item == null && r.sub_group == null) { levels[key].set(ym, v); continue; }
      const lineage = { majorgroup: r.major_group.trim(), group: r.group ?? null, subgroup: r.sub_group ?? null, sub_subgroup: r.sub_sub_group ?? null };
      if (r.item != null) {
        let k = slugify(r.item);
        const prior = itemLevels[k];
        if (prior && (prior.group !== lineage.group || prior.subgroup !== lineage.subgroup || prior.sub_subgroup !== lineage.sub_subgroup)) k = `${k}__${slugify(lineage.sub_subgroup ?? lineage.subgroup ?? lineage.group ?? "fuel")}`;
        (itemLevels[k] ??= { label: r.item.trim(), ...lineage, map: new Map() }).map.set(ym, v);
      } else if (r.group == null) {
        throw new Error(`WPI ${f.base_year}: a row with a sub-group but no group: ${JSON.stringify(r)}`);
      } else if (r.sub_group == null) {
        (groupLevels[slugify(r.group)] ??= { label: r.group.trim(), map: new Map() }).map.set(ym, v);
      } else if (r.sub_sub_group == null) {
        (subgroupLevels[slugify(r.sub_group)] ??= { label: r.sub_group.trim(), group: r.group, map: new Map() }).map.set(ym, v);
      } else {
        (subsubLevels[slugify(r.sub_sub_group)] ??= { label: r.sub_sub_group.trim(), group: r.group, subgroup: r.sub_group, map: new Map() }).map.set(ym, v);
      }
    }
  }
  const unit = `index, base ${f.base}`;
  // the audit trail: every value as served (after the not-available code and the
  // unattributable nodes), before any keying slip is set aside
  writeRaw(root, `data/raw/wpi-${f.tag}-items.json`, {
    vintage, unit, coverage: `the whole tree of base ${f.base_year}: major groups, groups, sub-groups, sub-sub-groups and items, with lineage, index levels`,
    majors: Object.fromEntries(Object.entries(levels).map(([k, m]) => [k, Object.fromEntries([...m.entries()].sort())])),
    groups: Object.fromEntries(Object.entries(groupLevels).map(([k, o]) => [k, { label: o.label, levels: Object.fromEntries([...o.map.entries()].sort()) }])),
    subgroups: Object.fromEntries(Object.entries(subgroupLevels).map(([k, o]) => [k, { label: o.label, group: o.group, levels: Object.fromEntries([...o.map.entries()].sort()) }])),
    sub_subgroups: Object.fromEntries(Object.entries(subsubLevels).map(([k, o]) => [k, { label: o.label, group: o.group, subgroup: o.subgroup, levels: Object.fromEntries([...o.map.entries()].sort()) }])),
    items: Object.fromEntries(Object.entries(itemLevels).sort().map(([k, { map, ...rest }]) => [k, { ...rest, levels: Object.fromEntries([...map.entries()].sort()) }])),
  });
  // keying slips (1993-94 high-speed diesel, November 1994: 5108.8 among months of 108.8):
  // set aside against the median of the six months either side, never corrected
  const slips = [];
  for (const [label, map] of [...Object.entries(levels).map(([k, m]) => [k, m]), ...[groupLevels, subgroupLevels, subsubLevels, itemLevels].flatMap((o) => Object.values(o).map((x) => [x.label, x.map]))]) {
    const sl = quarantine(map, 0.2, 5);
    if (sl.length) slips.push(`${String(label).trim()} (${sl.join(", ")})`);
  }
  const ambNames = [...ambiguous].map((n) => n.split("|").map((x) => (x === "null" ? "" : x.trim())).filter(Boolean).join(" › ") + (n.endsWith("||||") ? " (the major group and its groups, served with blank labels)" : ""));
  process.stdout.write(`wpi ${f.base_year}: ${allRows.length} rows; ${repeats} served twice with the same value; ${sentinels} not-available cells; keying slips: ${slips.join("; ") || "none"}; set aside as unattributable: ${ambNames.join("; ") || "none"}\n`);
  const months = [...levels.published_headline.keys()].sort();
  if (!months.length) throw new Error(`WPI ${f.base_year}: no data returned`);
  const yy0 = [...yoyFromLevels(levels.published_headline).keys()].sort();
  const axis = monthAxis(yy0[0], months.at(-1));
  const dates = axis.map((ym) => `${ym}-01`);
  const meta = (coverage, note) => ({
    dossier: "wpi", frequency: "monthly", base: f.base, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
    latestPeriod: axis.at(-1), releaseDate: null, coverage, revisionPolicy: dcfg.revision_policy,
    note: `Retired base ${f.base}, ${months[0]} to ${months.at(-1)} as served by the API. y/y computed from published index levels inside this base; never joined to another base. 9999.9 in the source means not available and is null here (${sentinels} cells).` +
      (slips.length ? ` Single months set aside as keying slips (more than five times, or under a fifth of, the two months around them, which agree with each other): ${slips.join("; ")}.` : "") +
      (ambNames.length ? ` Set aside because the API serves them without labels or twice with different values, so they cannot be attributed: ${ambNames.join("; ")}.` : "") + (note ? " " + note : ""),
  });
  const yoySeries = (map, extra) => {
    const yy = yoyFromLevels(map);
    const data = axis.map((ym) => yy.get(ym) ?? null);
    const first = data.findIndex((v) => v != null);
    const last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = first === -1 ? [] : dates.filter((d, j) => j > first && j < last && data[j] == null);
    return { unit: "pct_yoy", ...extra, data, ...(gaps.length ? { gaps } : {}) };
  };
  const tree = (obj, prefix, withLineage) => {
    const out = {};
    Object.keys(obj).sort().forEach((k, i) => {
      const o = obj[k];
      out[k] = yoySeries(o.map, { name: `wpi${f.tag}_${prefix}${k}_yoy_pct`, label: o.label, color: GREYS[i % GREYS.length],
        ...(withLineage ? { lineage: [o.majorgroup, o.group, o.subgroup, o.sub_subgroup].filter(Boolean).join(" › "), group: o.group, latestIndex: o.map.get(months.at(-1)) ?? null } : o.group ? { group: o.group } : {}) });
    });
    for (const [k, s] of Object.entries(out)) if (s.data.every((v) => v == null)) delete out[k];
    return out;
  };
  const headline = {
    meta: meta(`All India; published headline and the three major groups, base ${f.base}`, "The headline is the published WPI; no recomposition from weights is asserted."),
    dates,
    series: {
      headline: yoySeries(levels.published_headline, { name: `wpi${f.tag}_headline_yoy_pct`, label: `Headline, base ${f.base_year}`, color: "#2E4BD8" }),
      primary: yoySeries(levels.primary, { name: `wpi${f.tag}_primary_yoy_pct`, label: "Primary articles", color: "#5F6675" }),
      fuel: yoySeries(levels.fuel, { name: `wpi${f.tag}_fuel_yoy_pct`, label: "Fuel and power", color: "#A3A9B4" }),
      manufactured: yoySeries(levels.manufactured, { name: `wpi${f.tag}_manufactured_yoy_pct`, label: "Manufactured products", color: "#C9CED6" }),
    },
  };
  for (const [k, s] of Object.entries(headline.series)) if (s.data.every((v) => v == null)) delete headline.series[k];
  writeSeries(root, `data/series/wpi-${f.tag}.json`, headline);
  writeSeries(root, `data/series/wpi-${f.tag}-groups.json`, { meta: meta(`Groups beneath the major groups, base ${f.base_year}`), dates, series: tree(groupLevels, "") });
  writeSeries(root, `data/series/wpi-${f.tag}-subgroups.json`, { meta: meta(`Sub-groups, base ${f.base_year}`), dates, series: tree(subgroupLevels, "") });
  writeSeries(root, `data/series/wpi-${f.tag}-subsubgroups.json`, { meta: meta(`Sub-sub-groups, base ${f.base_year}`), dates, series: tree(subsubLevels, "ssg_") });
  writeSeries(root, `data/series/wpi-${f.tag}-items.json`, { meta: meta(`The ${Object.keys(itemLevels).length} items of the ${f.base_year} basket`, "Item weights are not served by the API, so no recomposition is asserted; latestIndex is each item's level in the base's last month."), dates, series: tree(itemLevels, "item_", true) });
}

/* Catalogue (docs/CONTRACT-coverage.md): what the OEA publishes through eSankhyiki, from
 * wpi/getWpiBaseYear and each base's wpi/getWpiData filter listing:
 *   wpi:<base>:<major|group|subgroup|subsubgroup|item>:<code>  (All India; the WPI has no states) */
import { writeCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueWpi() {
  const items = [];
  const bases = ((await mospi("wpi/getWpiBaseYear", {})).data ?? []).map((b) => b.label);
  const LEVELS = [["major_group", "major"], ["group", "group"], ["sub_group", "subgroup"], ["sub_sub_group", "subsubgroup"], ["item", "item"]];
  for (const base of bases) {
    const f = (await mospi("wpi/getWpiData", { base_year: base })).data ?? {};
    for (const [field, level] of LEVELS) for (const n of f[field] ?? []) {
      const code = n[`${field}_code`];
      items.push({ id: `wpi:${base}:${level}:${code}`, label: n.label });
    }
  }
  writeCatalogue("wpi", {
    source: "Office of the Economic Adviser, DPIIT: Wholesale Price Index (via MoSPI eSankhyiki)",
    generator: "scripts/lib/products/wpi.mjs --catalogue",
    note: "From getWpiBaseYear and getWpiData per base. Ids: wpi:<base>:<level>:<code>. Major groups include the headline (1000000000) and the Food index.",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueWpi);
