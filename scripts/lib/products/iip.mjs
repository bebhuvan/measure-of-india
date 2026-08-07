// scripts/lib/products/iip.mjs — Index of Industrial Production, MoSPI NSO.
// Two bases are live in the API: 2022-23 (current, from Apr 2023) and
// 2011-12 (discontinued, long history). Per the base-year rule each base is
// ingested and emitted separately, never joined:
//   iip-2022.json / iip-2011.json — headline (General) + sectoral + use-based
//     categories, y/y computed from levels; the API's growth_rate is kept as
//     a cross-check on the headline only.
//   iip-industries-2022.json / iip-industries-2011.json — the NIC 2-digit
//     industries and mineral/electricity sub-indices, y/y.
// The headline is the published General index LEVEL (the primary data); only
// growth is derived. Rows are calendar-labelled (year integer + month name).

import { mospi } from "../mospi.mjs";
import { MONTHS, writeJson, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// row -> series key and label, by level of aggregation
function rowKey(r) {
  const cat = String(r.category ?? "").trim();
  const sub = String(r.sub_category ?? "").trim();
  if (r.type === "General") return { key: "general", label: "General" };
  if (!sub) return { key: `${r.type === "Sectoral" ? "sector" : "use"}:${slugify(cat)}`, label: cat };
  return { key: `sub:${slugify(cat)}:${slugify(sub)}`, label: sub };
}

export async function buildIip(root, dcfg, vintage) {
  const bases = dcfg.fetch.bases;
  const raw = { vintage, unit: "index; levels and published growth keyed by base year", levels: {}, growth: {} };
  const perBase = {}; // base -> { levels: key->Map, growth: key->Map, labels: key->label }

  for (const base of bases) {
    const filter = await mospi("iip/getIipFilter", { base_year: base, frequency: dcfg.fetch.params.frequency });
    const years = ((filter.data ?? filter).year ?? []).map((y) => Number(y.year)).sort((a, b) => a - b);
    const levels = {}; const growth = {}; const labels = {};
    for (const year of years) {
      let page = 1;
      let n = 0;
      for (;;) {
        const res = await mospi(dcfg.fetch.endpoint, {
          base_year: base, ...dcfg.fetch.params, year, page, limit: 500,
        });
        const rows = res.data ?? [];
        n += rows.length;
        for (const r of rows) {
          const { key, label } = rowKey(r);
          const m = String(MONTHS.indexOf(r.month) + 1).padStart(2, "0");
          if (m === "00") continue;
          const v = parseFloat(r.index);
          if (Number.isFinite(v) && v !== 0) {
            labels[key] = label;
            (levels[key] ??= new Map()).set(`${r.year}-${m}`, v);
          }
          const g = parseFloat(r.growth_rate);
          if (Number.isFinite(g)) (growth[key] ??= new Map()).set(`${r.year}-${m}`, g);
        }
        if (page >= (res.meta_data?.totalPages ?? 1)) break;
        page++;
      }
      process.stdout.write(`iip ${base} ${year}: ${n} rows\n`);
      await new Promise((r) => setTimeout(r, 200));
    }
    perBase[base] = { levels, growth, labels };
    for (const [k, map] of Object.entries(levels)) raw.levels[`${base}:${k}`] = Object.fromEntries([...map.entries()].sort());
    for (const [k, map] of Object.entries(growth)) raw.growth[`${base}:${k}`] = Object.fromEntries([...map.entries()].sort());
  }
  writeRaw(root, "data/raw/iip-indices.json", raw);

  const baseTag = (base) => base.slice(0, 4); // "2022-23" -> "2022"
  const emit = (base) => {
    const { levels, growth, labels } = perBase[base];
    const tag = baseTag(base);
    const metaBase = {
      dossier: "iip", frequency: "monthly", base: `${base}=100`,
      source: dcfg.source_agency, vintage, mock: false,
      releaseDate: null,
      revisionPolicy: dcfg.revision_policy,
    };
    const g = levels.general;
    if (!g?.size) { process.stdout.write(`iip ${base}: no General index rows, skipped\n`); return; }
    const months = [...g.keys()].sort();
    const axis = monthAxis(months[0], months.at(-1));
    const dates = axis.map((ym) => `${ym}-01`);
    const yoy = (k) => yoyFromLevels(levels[k] ?? new Map());
    // interior nulls on the emitted y/y series — real source gaps (e.g. the
    // old base was never loaded for March 2025) plus their y/y knock-on
    const seriesGaps = (maps) => {
      const set = new Set();
      for (const m of maps) {
        const ks = [...m.keys()].sort();
        for (const ym of axis) {
          if (ym > ks[0] && ym < ks.at(-1) && !m.has(ym)) set.add(ym);
        }
      }
      return [...set].sort().map((ym) => `${ym}-01`);
    };

    // headline bundle: General + sectoral + use-based
    const series = {};
    const TOP = Object.keys(levels).filter((k) => k === "general" || k.startsWith("sector:") || k.startsWith("use:")).sort();
    const topYoys = [];
    TOP.forEach((k, i) => {
      const y = yoy(k);
      if (!y.size) return;
      topYoys.push(y);
      series[slugify(k)] = {
        name: `iip_${slugify(k)}_yoy_pct_base${tag}`,
        label: labels[k], color: k === "general" ? "#BE3E26" : GREYS[i % GREYS.length],
        data: axis.map((ym) => y.get(ym) ?? null),
      };
    });
    const bundle = {
      meta: {
        ...metaBase, latestPeriod: months.at(-1),
        coverage: "Headline (General), sectoral and use-based categories; y/y computed from published index levels",
        note: base.startsWith("2022")
          ? "Current base, from April 2023; the first computable y/y is April 2024."
          : "Discontinued base — superseded by 2022-23=100; plotted separately, never spliced (base-year rule).",
        gaps: seriesGaps(topYoys).length ? seriesGaps(topYoys) : undefined,
        gapsNote: "Months absent from the source (the old base was never loaded for March 2025), plus the y/y knock-on a year later.",
      },
      dates, series,
      crosscheck: { headline_growth_published: axis.map((ym) => growth.general?.get(ym) ?? null) },
    };
    writeJson(root, `data/series/iip-${tag}.json`, bundle);

    // industries bundle: every sub-index (NIC 2-digit + mineral/electricity detail)
    const subSeries = {};
    const subYoys = [];
    Object.keys(levels).filter((k) => k.startsWith("sub:")).sort().forEach((k, i) => {
      const y = yoy(k);
      if (!y.size) return;
      subYoys.push(y);
      subSeries[slugify(k)] = {
        name: `iip_${slugify(k)}_yoy_pct_base${tag}`,
        label: labels[k], color: GREYS[i % GREYS.length],
        data: axis.map((ym) => y.get(ym) ?? null),
      };
    });
    if (Object.keys(subSeries).length) {
      writeJson(root, `data/series/iip-industries-${tag}.json`, {
        meta: { ...metaBase, latestPeriod: months.at(-1), coverage: "2-digit industries and sub-indices beneath the sectoral aggregates",
          gaps: seriesGaps(subYoys).length ? seriesGaps(subYoys) : undefined,
          gapsNote: "Months absent from the source (the old base was never loaded for March 2025), plus the y/y knock-on a year later." },
        dates, series: subSeries,
      });
    }
  };
  for (const base of bases) emit(base);
}
