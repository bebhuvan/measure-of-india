// scripts/lib/products/iip.mjs — Index of Industrial Production, MoSPI NSO.
// FOUR bases are live in the API (getIipBaseYear): 2022-23 (current, from
// Apr 2023), 2011-12 (discontinued, Apr 2012 – Mar 2026), 2004-05
// (2005–2017) and 1993-94 (1994–2011). Per the base-year rule each base is
// ingested and emitted separately, never joined:
//   iip-<tag>.json — headline (General) + sectoral + use-based categories,
//     y/y computed from levels; the API's growth_rate is kept as a
//     cross-check on the headline only.
//   iip-industries-<tag>.json — the 2-digit industries and the
//     mineral/electricity sub-indices, y/y.
// The headline is the published General index LEVEL (the primary data); only
// growth is derived. Rows are calendar-labelled (year integer + month name).
// The API also serves frequency=Annually for every base: FY-labelled rows
// with the same series sets as monthly (financial-year average index and the
// published growth). Baked since wave 2 (2026-10-10) as iip-annual-<tag>.json:
// every published level and growth as served, one bundle per base.
//   Hand check (2026-10-10): base 2022-23, General 2025-26 growth 4.3%, as
//   reported from MoSPI's first release of the new series (1 June 2026). Each
//   annual index equals the mean of its twelve monthly levels in iip-indices
//   (2023-24 106.79, 2024-25 112.90, 2025-26 117.68 vs 106.8, 112.9, 117.7).
//   Press summaries quote 6.7% and 6.4% for 2023-24 and 2024-25 where the API
//   gives 6.8% and 5.7%; the release PDF refused us (HTTP 403), so this is
//   unresolved and recorded in docs/status/industry.md.

import { mospi, mospiAll } from "../mospi.mjs";
import { MONTHS, writeSeries, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";

const BASE_NOTE = {
  "2022-23": "Current base, from April 2023; the first computable y/y is April 2024.",
  "2011-12": "Discontinued base — superseded by 2022-23=100; plotted separately, never spliced (base-year rule).",
  "2004-05": "Discontinued base (2005–2017) — superseded by 2011-12=100; plotted separately, never spliced (base-year rule). Uses the older 5-way use-based scheme (Basic Goods, no Infrastructure/Construction).",
  "1993-94": "Discontinued base (1994–2011) — superseded by 2004-05=100; plotted separately, never spliced (base-year rule). Uses the older 5-way use-based scheme (Basic Goods, no Infrastructure/Construction).",
};

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
// the 1993-94 base's names carry XML-escape debris ("Related_x0002_products");
// strip it from labels (and therefore keys) — a transcription fix, not editing
const clean = (s) => s.replace(/_x[0-9a-fA-F]{4}_/g, " ").replace(/\s+/g, " ").trim();

// row -> series key and label, by level of aggregation
function rowKey(r) {
  const cat = clean(String(r.category ?? ""));
  const sub = clean(String(r.sub_category ?? ""));
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
      // mospiAll pages through mospi.mjs and checks the page set for slips (repeated rows)
      const rows = await mospiAll(dcfg.fetch.endpoint, { base_year: base, ...dcfg.fetch.params, year });
      const n = rows.length;
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
      process.stdout.write(`iip ${base} ${year}: ${n} rows\n`);
      await new Promise((r) => setTimeout(r, 200));
    }
    perBase[base] = { levels, growth, labels };
    for (const [k, map] of Object.entries(levels)) raw.levels[`${base}:${k}`] = Object.fromEntries([...map.entries()].sort());
    for (const [k, map] of Object.entries(growth)) raw.growth[`${base}:${k}`] = Object.fromEntries([...map.entries()].sort());
  }
  writeRaw(root, "data/raw/iip-indices.json", raw);

  const baseTag = (base) => base.slice(0, 4); // "2022-23" -> "2022"
  const GAPS_NOTE = "Months absent from the source (e.g. the 2011-12 base was never loaded for March 2025), plus the y/y knock-on a year later.";
  const emit = (base) => {
    const { levels, growth, labels } = perBase[base];
    const tag = baseTag(base);
    const metaBase = {
      dossier: "iip", frequency: "monthly", base: `${base}=100`,
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
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
        label: labels[k], color: k === "general" ? "#2E4BD8" : GREYS[i % GREYS.length],
        data: axis.map((ym) => y.get(ym) ?? null),
      };
    });
    const bundle = {
      meta: {
        ...metaBase, latestPeriod: months.at(-1),
        coverage: "Headline (General), sectoral and use-based categories; y/y computed from published index levels",
        note: BASE_NOTE[base],
        gaps: seriesGaps(topYoys).length ? seriesGaps(topYoys) : undefined,
        gapsNote: seriesGaps(topYoys).length ? GAPS_NOTE : undefined,
      },
      dates, series,
      crosscheck: { headline_growth_published: axis.map((ym) => growth.general?.get(ym) ?? null) },
    };
    writeSeries(root, `data/series/iip-${tag}.json`, bundle);

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
      writeSeries(root, `data/series/iip-industries-${tag}.json`, {
        meta: { ...metaBase, latestPeriod: months.at(-1), coverage: "2-digit industries and sub-indices beneath the sectoral aggregates",
          gaps: seriesGaps(subYoys).length ? seriesGaps(subYoys) : undefined,
          gapsNote: seriesGaps(subYoys).length ? GAPS_NOTE : undefined },
        dates, series: subSeries,
      });
    }
  };
  for (const base of bases) emit(base);

  await buildIipAnnual(root, dcfg, vintage);
}

// The financial-year twin (frequency=Annually), one bundle per base.
export async function buildIipAnnual(root, dcfg, vintage) {
  const bases = dcfg.fetch.bases;
  const baseTag = (base) => base.slice(0, 4);
  const rawA = { vintage, unit: "index (financial-year average) and published growth, keyed by base year", rows: {} };
  for (const base of bases) {
    const rows = await mospiAll(dcfg.fetch.endpoint, { base_year: base, frequency: "Annually" });
    rawA.rows[base] = rows;
    const tag = baseTag(base);
    const lev = {}, gro = {}, lab = {};
    for (const r of rows) {
      const { key, label } = rowKey(r);
      const fy = String(r.year);
      if (!/^\d{4}-\d{2}$/.test(fy)) { console.warn(`iip annual ${base}: unexpected year "${fy}"`); continue; }
      lab[key] = label;
      const v = parseFloat(r.index), g = parseFloat(r.growth_rate);
      if (Number.isFinite(v) && v !== 0) (lev[key] ??= new Map()).set(fy, v);
      if (Number.isFinite(g)) (gro[key] ??= new Map()).set(fy, g);
    }
    const fys = [...new Set(Object.values(lev).flatMap((m) => [...m.keys()]))].sort();
    if (!lev.general?.size) throw new Error(`iip annual ${base}: no General index rows`);
    const fax = [];
    for (let y = +fys[0].slice(0, 4); y <= +fys.at(-1).slice(0, 4); y++) fax.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`);
    const order = Object.keys(lab).sort((a, b) => (a === "general" ? -1 : b === "general" ? 1 : a < b ? -1 : 1));
    const series = {};
    let i = 0;
    for (const k of order) {
      const kind = k === "general" ? "General index" : k.startsWith("sector:") ? "Sector" : k.startsWith("use:") ? "Use-based" : "Industry";
      const grp = k === "general" ? "General" : kind === "Industry" ? `Industry: ${clean(k.split(":")[1].replace(/_/g, " "))}` : kind;
      if (lev[k]?.size) series[`${slugify(k)}_index`] = { name: `iip_${slugify(k)}_index_fy_base${tag}`, label: `${lab[k]}, index`, unit: "index", group: grp,
        color: k === "general" ? "#2E4BD8" : GREYS[i++ % 4], data: fax.map((fy) => lev[k].get(fy) ?? null) };
      if (gro[k]?.size) series[`${slugify(k)}_growth`] = { name: `iip_${slugify(k)}_growth_fy_pct_base${tag}`, label: `${lab[k]}, growth on a year earlier`, unit: "pct_yoy", group: grp,
        color: k === "general" ? "#2E4BD8" : GREYS[i++ % 4], data: fax.map((fy) => gro[k].get(fy) ?? null) };
    }
    for (const s of Object.values(series)) {
      const f = s.data.findIndex((v) => v != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      const g = fax.filter((_, j) => j > f && j < l && s.data[j] == null).map((fy) => `${fy.slice(0, 4)}-04-01`);
      if (g.length) { s.gaps = g; s.gapsNote = "Not published for this financial year by MoSPI."; }
    }
    writeSeries(root, `data/series/iip-annual-${tag}.json`, {
      meta: {
        dossier: "iip", frequency: "annual", base: `${base}=100`, source: dcfg.source_agency, vintage, mock: false, geo: dcfg.geo ?? "IND",
        latestPeriod: `${fax.at(-1).slice(0, 4)}-04`, releaseDate: null, revisionPolicy: dcfg.revision_policy,
        coverage: "Financial-year average index and growth on a year earlier, as published: General, sectoral, use-based and 2-digit industries",
        note: `${BASE_NOTE[base]} Financial years (April to March), dated at April of the first year. Levels and growth are MoSPI's own annual rows (frequency=Annually), not recomputed; the first year of a base has no growth.`,
      },
      dates: fax.map((fy) => `${fy.slice(0, 4)}-04-01`), series,
    });
  }
  writeRaw(root, "data/raw/iip-annual.json", rawA);
}

/* Catalogue (docs/CONTRACT-coverage.md): what MoSPI publishes for the IIP, from
 * iip/getIipBaseYear and iip/getIipFilter for every base x frequency:
 *   iip:<base>:<monthly|annual>:general
 *   iip:<base>:<monthly|annual>:<sectoral|use-based>:<code>-<name>
 *   iip:<base>:<monthly|annual>:industry:<code>-<name>   (NIC 2-digit) */
import { writeCatalogue, idPart, catalogueCli } from "../catalogue.mjs";
export async function catalogueIip() {
  const items = [];
  const meta = (await mospi("iip/getIipBaseYear", {})).data ?? {};
  for (const { base_year: base } of meta.base_year ?? []) for (const { frequency } of meta.frequency ?? []) {
    const f = (await mospi("iip/getIipFilter", { base_year: base, frequency })).data ?? {};
    const fr = frequency === "Monthly" ? "monthly" : "annual";
    for (const c of f.category ?? []) {
      const t = idPart(String(c.type).replace(/ category$/i, ""));
      items.push(t === "general" ? { id: `iip:${base}:${fr}:general`, label: "General index" }
        : { id: `iip:${base}:${fr}:${t}:${c.category_code}-${idPart(c.category_name)}`, label: c.category_name });
    }
    for (const s of f.subcategory ?? []) items.push({ id: `iip:${base}:${fr}:industry:${idPart(s.subcategory_code)}-${idPart(s.subcategory_name)}`, label: s.subcategory_name });
  }
  writeCatalogue("iip", {
    source: "MoSPI, NSO: Index of Industrial Production (eSankhyiki API)",
    generator: "scripts/lib/products/iip.mjs --catalogue",
    note: "From getIipBaseYear and getIipFilter per base and frequency. Ids: iip:<base>:<frequency>:<type>:<code>-<name>.",
    items,
  });
}
await catalogueCli(import.meta.url, catalogueIip);
