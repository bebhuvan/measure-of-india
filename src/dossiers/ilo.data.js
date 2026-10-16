// src/dossiers/ilo.data.js: build-time reader for the ILO guide (src/pages/guides/ilo.astro).
// The guide draws on 30-odd of the 177 ilo-* bundles, several of them hundreds of kilobytes
// (the peers carry every modelled breakdown). The page and src/dossiers/ilo.charts.js read them
// here at build time; the reader's browser gets finished charts and numbers, never a bundle.
// Every value is the bundle's own.
import fs from "node:fs";
import path from "node:path";

// Resolved from the working directory, like periods.js: Astro bundles this module into dist/.
const ROOT = process.cwd();
const cache = new Map();
export function load(slug) {
  if (!cache.has(slug)) cache.set(slug, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8")));
  return cache.get(slug);
}

// The ILO serves the same modelled series under two age classifications (youth/adult bands
// and aggregate bands) and sets its observation flags on the aggregate one only. A drawn
// series takes its twin's flags when it has none of its own and the values are identical
// (review-a, 2026-10: the women's participation plate said "the ILO flags none" while 2010
// is flagged real).
const flagsOf = (b, k) => {
  const s = b.series[k];
  if (s.flags && Object.keys(s.flags).length) return s.flags;
  const twin = b.series[k.replace("_age_ythadult_", "_age_aggregate_")];
  return twin && twin !== s && twin.flags && twin.data.every((v, i) => v === s.data[i]) ? twin.flags : null;
};

/** A slim copy of a bundle holding only `keys` (all keys must exist: a missing one throws). */
export function pick(slug, keys) {
  const b = load(slug);
  const series = {};
  for (const k of keys) {
    const s = b.series[k];
    if (!s) throw new Error(`ilo.data: ${slug} has no series ${k}`);
    const flags = flagsOf(b, k);
    series[k] = { label: s.label, unit: s.unit, data: s.data, ...(flags ? { flags } : {}), ...(s.lower ? { lower: s.lower, upper: s.upper } : {}) };
  }
  return { meta: { vintage: b.meta.vintage, base: b.meta.base, source: b.meta.source, geo: b.meta.geo, frequency: b.meta.frequency }, dates: b.dates, series };
}

export const year = (iso) => iso.slice(0, 4);
/** value of a series at a calendar year (annual bundles), or null */
export function at(slug, key, y) {
  const b = load(slug), i = b.dates.indexOf(`${y}-01-01`);
  return i < 0 ? null : b.series[key]?.data[i] ?? null;
}
/** last non-null { value, year } of a series */
export function last(slug, key) {
  const b = load(slug), d = b.series[key].data;
  for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { value: d[i], year: year(b.dates[i]), iso: b.dates[i] };
  return null;
}
export function first(slug, key) {
  const b = load(slug), d = b.series[key].data;
  for (let i = 0; i < d.length; i++) if (d[i] != null) return { value: d[i], year: year(b.dates[i]), iso: b.dates[i] };
  return null;
}
/** years carrying an ILO observation flag (R real, U unreliable, ...) */
export const flagged = (slug, key, flag) => (flagsOf(load(slug), key)?.[flag] ?? []).map(year);

// ---- the keys the guide draws, in one place ----
const age = (sex, a) => `${sex}__age_ythadult_${a}`;
export const K = {
  lfpr: (sex, a = "yge15") => `eap_2wap_sex_age_rt__sex_${age(sex, a)}`,
  epr: (sex, a = "yge15") => `emp_2wap_sex_age_rt__sex_${age(sex, a)}`,
  ur: (sex, a = "yge15") => `une_2eap_sex_age_rt__sex_${age(sex, a)}`,
  neet: (sex) => `eip_2eet_sex_rt__sex_${sex}`,
  emp: (sex = "t", a = "yge15") => `emp_2emp_sex_age_nb__sex_${age(sex, a)}`,
  ste: (c) => `emp_2emp_sex_ste_nb__sex_t__ste_icse93_${c}`,
  eco: (c) => `emp_2emp_sex_eco_nb__sex_t__eco_sector_${c}`,
  cla: (c) => `emp_2emp_sex_age_cla_nb__sex_t__age_ythadult_yge15__cla_ecocla_${c}`,
  hours: (sex) => `how_2emp_sex_nb__sex_${sex}`,
  lshare: "lap_2gdp_noc_rt",
  decile: (n) => `lap_2lid_qtl_rt__dcl_decile_${String(n).padStart(2, "0")}`,
  opw: "gdp_211p_noc_nb",
  // survey series, as processed by the ILO
  sLfpr: (sex, a = "ythadult_yge15") => `eap_dwap_sex_age_rt__sex_${sex}__age_${a}`,
  sLfprGeo: (sex, g) => `eap_dwap_sex_geo_rt__sex_${sex}__geo_cov_${g}`,
  sLfprEdu: (sex, e) => `eap_dwap_sex_edu_rt__sex_${sex}__edu_aggregate_${e}`,
  sUr: (sex, a = "ythadult_yge15") => `une_deap_sex_age_rt__sex_${sex}__age_${a}`,
  sNeet: (sex) => `sdg_0861_sex_rt__sex_${sex}`,
  sInf: (c) => `sdg_0831_sex_eco_rt__sex_t__eco_sector_${c}`,
  sEarn: (sex) => `ear_emta_sex_age_nb__sex_${sex}__age_ythadult_yge15`,
};
export const PEERS = [["chn", "China"], ["bgd", "Bangladesh"], ["idn", "Indonesia"], ["vnm", "Vietnam"]];
