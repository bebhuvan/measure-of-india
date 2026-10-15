// scripts/lib/unit-envelope.mjs: the plausible range of every unit the Atlas stores.
//
// validate.mjs applies these to every series of every bundle, whatever family wrote it
// (CONTRACT-series rule 2d). A family check may hold a series to a tighter range; nothing may
// hold it to a looser one. An envelope is set by what the unit means, not by the data on disk:
// a share cannot pass 100, a rate per 1,000 cannot pass 1,000, an index of temperature cannot
// pass 60 degrees. Levels (rupees, counts, tonnes) only get a magnitude ceiling sized to the
// unit, which still catches a value stored in the wrong scale by orders of magnitude.
//
// A unit missing here fails validation: add it with its meaning, never a borrowed range.

import { unitOf } from "../../src/dossiers/units.js";

const SHARE = [0, 100.5];   // half a point of rounding over 100
const LEVEL = (cap) => [-cap, cap];

export const ENVELOPE = {
  // shares of a whole
  pct_of_workers: SHARE, pct_of_employees: SHARE, pct_of_mpce: SHARE, pct_share: SHARE,
  pct_of_gva: SHARE, pct_of_mva: SHARE, pct_of_exports: SHARE,
  // "%" as published: shares, rates and ratios a source prints in per cent. Never more than ten
  // times the whole (a GER, an RSE); a count or rupee figure under this unit is a mislabel.
  percent: [-100, 1000], pct_rse: [0, 1000],
  // per cent that can be a growth rate or a ratio of two signed flows: wide, but bounded
  pct: [-1e5, 1e6], pct_yoy: [-1e5, 1e6], pct_change: [-1e5, 1e6],
  pct_per_annum: [-100, 1000], pct_gdp: [-1000, 1000], pct_of_gdp: [-1000, 1000], pct_of_gsdp: [-1000, 1000],
  pct_points: [-1000, 1000], pp: [-1000, 1000], bps: [-10000, 10000],
  // rates per population
  per_1000: [-1000, 1000], per_1000_women: [0, 1000], per_100: [0, 10000], per_100_people: [0, 10000],
  per_100_males: [0, 100000], per_100k: [0, 100000], per_100k_live_births: [0, 100000],
  per_100k_workers: [0, 100000], per_lakh_women: [0, 100000], per_sq_km: [0, 100000], rate: [0, 10000],
  males_per_100_females: [50, 200], births_per_woman: [0, 15], per_woman: [0, 15],
  // ratios and indices with a fixed meaning
  ratio: [0, 10000], gpi: [0, 10], pupils_per_teacher: [0, 1000], gini: [0, 1], gini_index: [0, 100],
  mpi_index: [0, 1], risk_ratio: [-1, 1], coefficient: [-100, 100], vote: [0, 1], score: [0, 1000],
  multiple: [0, 1000], times: [-10000, 10000], dependency_ratio: [0, 10], index: LEVEL(1e8),
  source_sale_rate: [0, 1e7],
  // time
  years: [0, 200], doubling_years: [0, 10000], months: [0, 1200], hours: [0, 168], minutes: [0, 1440],
  days: LEVEL(1e10), doy: [-366, 366], hours_thousand: [0, 1e12],
  // climate
  degC: [-90, 60], degc: [-90, 60], degday_f: LEVEL(1e5), degday_c: [0, 1e5], mm: [-1e4, 3e4],
  mm_day: [-100, 500], ms: [0, 200], wm2: [0, 1500],
  // per-person and per-unit money
  inr_per_day: [0, 1e6], inr_per_month: [0, 1e7], inr_per_30_days: [0, 1e7], inr_per_year: [0, 1e9],
  inr_per_sqft: [0, 1e6], inr_per_quintal: [0, 1e6], inr_per_unit: [0, 1e6], inr_per_usd: [0, 1000],
  inr_per_100: [0, 100], inr_per_10g: LEVEL(1e7), inr_per_kg: LEVEL(1e7), inr_per_ppp_usd: [0, 1000],
  inr_day: [0, 1e6], paise: LEVEL(1e5), usd_per_barrel: [0, 1000], usd_per_troy_oz: [0, 1e5],
  usc_per_troy_oz: [0, 1e6], ppp_usd_day: [0, 1e4], kg_per_month: [0, 1e4],
  // money levels, sized to the unit
  inr: LEVEL(1e16), inr_amount: LEVEL(1e16), inr_thousand: LEVEL(1e13), inr_lakh: LEVEL(1e12),
  inr_crore: LEVEL(1e11), inr_lakh_crore: LEVEL(1e5), inr_bn: LEVEL(1e8),
  usd: LEVEL(1e15), usd_mn: LEVEL(1e9), usd_million: LEVEL(1e9), usd_millions: LEVEL(1e9),
  USD_millions: LEVEL(1e9), usd_bn: LEVEL(1e6), eur_bn: LEVEL(1e6), jpy_bn: LEVEL(1e8),
  sdr_million: LEVEL(1e8), lcu: LEVEL(1e16), ppp_usd: LEVEL(1e15), usd_ppp_2021: LEVEL(1e15),
  usd_ppp_2021_million: LEVEL(1e10), usd_2015: LEVEL(1e15), usd_constant_2015: LEVEL(1e15),
  intl_usd_2011: LEVEL(1e16), level: LEVEL(1e16),
  // counts
  count: LEVEL(1e13), hundreds: [0, 1e11], thousand: LEVEL(1e11), lakh_count: [0, 1e8],
  million_persons: [0, 1e5], billion: [0, 100], crore: [0, 1e5], cases: [0, 1e9],
  count_per_holding: [0, 1e4], count_per_household: [0, 1000], count_per_school: [0, 1e6],
  count_per_ha: [0, 1e6], count_x1e7: [0, 1e14],
  // land, output, energy, emissions
  ha: [0, 1e9], hectares: [0, 1e9], thousand_ha: [0, 1e6], thousand_hectares: [0, 1e6], sq_km: [-1e3, 1e8],
  km: [0, 1e8], kg: [0, 1e9], kg_per_ha: [0, 1e6], kg_per_hectare: [0, 1e6], tonnes: [0, 1e11],
  thousand_tonne: [0, 1e9], thousand_tonnes: LEVEL(1e9), lakh_tonnes: [0, 1e7], million_tonnes: [0, 1e6],
  thousand_kg: [0, 1e9], thousand_bales: [0, 1e7], qty_ton: [0, 1e12], qty_kgs: [0, 1e14], bcm: [0, 1e5],
  mw: LEVEL(1e7), gwh: LEVEL(1e8), twh: LEVEL(1e7), kwh: [0, 1e9], thousand_kwh: [0, 1e12],
  crore_kwh: [0, 1e8], source_scaled_gwh: [0, 1e8], ktoe: LEVEL(1e8), pj: LEVEL(1e7), mmscm: LEVEL(1e7),
  kt_co2e: [0, 1e8], mt_co2e: [0, 1e6], mt: LEVEL(1e8), g_co2e_per_kwh: [0, 3000], g_per_kwh: [0, 3000],
  t_per_person: [-100, 1000], t_co2e_per_person: [0, 1000], kwh_per_person: [0, 1e6],
  mwh_per_person: [0, 1000], kg_per_intl_usd: [0, 100], kwh_per_intl_usd: [0, 100],
  // a unit the source does not state: magnitude only, and the page says the unit is unstated
  unstated: LEVEL(1e16),
};

/** The resolved unit of a series (src/dossiers/units.js) and its envelope, or null if none. */
export function envelopeOf(bundle, series) {
  const unit = unitOf(bundle, series) ?? "unstated";
  return { unit, range: ENVELOPE[unit] ?? null };
}

/** { key: [lo, hi] } for every series of a bundle; throws on a unit without an envelope. */
export function envelopeRanges(bundle, slug) {
  return Object.fromEntries(Object.entries(bundle.series ?? {}).map(([k, s]) => {
    const { unit, range } = envelopeOf(bundle, s);
    if (!range) throw new Error(`${slug}.${k}: unit "${unit}" has no envelope in scripts/lib/unit-envelope.mjs`);
    return [k, range];
  }));
}
