// Population guide: the plates, drawn at build time with the chart kit (src/kit/), and the
// figures the page quotes beside them. Data: UN World Population Prospects 2024 (population-wpp*)
// and World Bank WDI (population-wdi*). Two instruments are never joined: the UN's estimates
// (1950-2023) are one series, solid; its projections (2024-2100) another, dashed, with a seam
// between them. Populations arrive in thousands; the page shows crore, million or billion.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import estB from "../../data/series/population-wpp.json";
import projB from "../../data/series/population-wpp-projection.json";
import varB from "../../data/series/population-wpp-variants.json";
import ageB from "../../data/series/population-wpp-age.json";
import ageProjB from "../../data/series/population-wpp-age-projection.json";
import urbB from "../../data/series/population-wdi-urban.json";
import migB from "../../data/series/population-wdi-migration.json";

const pc = (u) => `<span class="pc">${u}</span>`;
const yearOf = (iso) => Number(iso.slice(0, 4));
/** [{d, year, value}] of one series, nulls dropped; `scale` converts units for display */
const pts = (b, k, scale = 1) => b.dates.map((d, i) => ({ d, year: yearOf(d), value: b.series[k].data[i] == null ? null : b.series[k].data[i] * scale })).filter((p) => p.value != null);
const at = (b, k, y) => { const i = b.dates.indexOf(`${y}-01-01`); return i < 0 ? null : b.series[k].data[i]; };
const lastOf = (b, k) => pts(b, k).at(-1);
const both = (k, scale = 1) => [...pts(estB, k, scale), ...pts(projB, k, scale)];
const est0 = yearOf(estB.dates[0]), estN = yearOf(estB.dates.at(-1)), projN = yearOf(projB.dates.at(-1));
const bn2 = (thousands) => (thousands / 1e6).toFixed(2) + " billion";
const crore = (thousands) => (thousands / 1e4).toFixed(1) + " crore";
const mn = (thousands) => (thousands / 1e3).toFixed(1) + " million";
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const peak = (arr) => arr.reduce((a, p) => (p.value > a.value ? p : a));
const low = (arr) => arr.reduce((a, p) => (p.value < a.value ? p : a));
const P2 = (arr) => arr.map((p) => [p.d, p.value]);
const SEAM = { t: `${estN}-07-01`, before: "UN estimates", after: "UN projection (medium)" };
const tbl = (cols, rows) => ({ cols, rows });

/* ---------- headline figures ---------- */
const popE = pts(estB, "tpopulation1july"), popP = pts(projB, "tpopulation1july");
const popL = popE.at(-1), popPrev = popE.at(-2), popPeak = peak(popP);
const age = (k) => [...pts(ageB, k), ...pts(ageProjB, k)];
const waShare = age("share_15_64"), waPeak = peak(waShare), waL = pts(ageB, "share_15_64").at(-1);
const tfrBelow = both("tfr").find((p) => p.value < 2.1), tfrL = lastOf(estB, "tfr");
const medL = lastOf(estB, "medianagepop"), med0 = pts(estB, "medianagepop")[0];

/**
 * One measure over estimates and projections: each a series of its own (never joined), the
 * projection dashed; extra series and notes as the plate needs. `pairs` [{name, E, P, role, short}]
 */
function estProj({ pairs, endFormat, unit = {}, notes = [], refs = [], seam = SEAM, height, tDomain, hoverDp = 1, ranges = [], yDomain }) {
  return (width) => K.line({
    width, freq: "year", unit, endFormat, hoverDp, notes: typeof notes === "function" ? notes(width) : notes, refs, seam, tDomain, ranges, yDomain, ...(height ? { height: width < 520 ? Math.round(height * 0.75) : height } : {}),
    series: pairs.flatMap((p) => [
      { name: `${p.name}, UN estimate`, data: P2(p.E), role: p.role ?? "lead", label: false },
      { name: `${p.name}, projection`, short: p.short ?? p.name, data: P2(p.P), role: p.role ?? "lead", dash: "5 4" },
    ]),
  });
}

export const sparkPop = () => K.spark(P2(popE), { width: 190, height: 44 });

/* ---------- § 02 the long curve ---------- */
const vv = (k) => pts(varB, k);
const LO95 = vv("tpopulation1july__lower_95_pi"), HI95 = vv("tpopulation1july__upper_95_pi");
const LO80 = vv("tpopulation1july__lower_80_pi"), HI80 = vv("tpopulation1july__upper_80_pi");
export function curve() {
  const B = (arr) => arr.map((p) => ({ ...p, value: p.value / 1e6 }));
  const E = B(popE), P = B(popP), pk = { d: popPeak.d, value: popPeak.value / 1e6 };
  const band = (lo, hi) => lo.map((p, i) => [p.d, p.value / 1e6, hi[i].value / 1e6]);
  return figure({
    bare: true, file: "india-atlas_population-1950-2100",
    label: `India's population, ${est0} to ${projN}: UN estimates rise from ${bn2(popE[0].value)} in ${est0} to ${bn2(popL.value)} in ${estN}; the medium projection peaks at ${bn2(popPeak.value)} in ${popPeak.year} and falls to ${bn2(popP.at(-1).value)} by ${projN}, with its 80% and 95% ranges shaded`,
    data: tbl(["year", "kind", "population_thousands", "lower_95", "lower_80", "upper_80", "upper_95"],
      [...popE.map((p) => [p.year, "estimate", p.value, null, null, null, null]), ...popP.map((p, i) => [p.year, "projection (medium)", p.value, LO95[i]?.value ?? null, LO80[i]?.value ?? null, HI80[i]?.value ?? null, HI95[i]?.value ?? null])]),
    draw: estProj({
      pairs: [{ name: "Population", short: `${projN}, projected`, E: E, P: P }], unit: { suffix: " bn" }, hoverDp: 3, height: 460, yDomain: [0, Math.ceil(Math.max(...HI95.map((p) => p.value)) / 1e6 / 0.4) * 0.4],
      endFormat: (v) => f2(v) + " bn",
      // the UN's 95% range, and its 80% range inside it, under the projection
      ranges: [{ data: band(LO95, HI95), color: K.C.leadWash }, { data: band(LO80, HI80), color: "#E1E6F6" }],
      notes: [
        { d: popL.d, v: popL.value / 1e6, text: `${estN}\n${bn2(popL.value)}`, side: "left" },
        { d: pk.d, v: pk.value, text: `Peak, ${popPeak.year}\n${bn2(popPeak.value)}` },
      ],
    }),
  });
}

/* ---------- § 03 the pyramid ---------- */
export function pyramid() {
  const groups = ageB.meta.ageGroups, yB = 2050;
  const k = (g) => g.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const val = (b, g, sex, y) => at(b, `age_${k(g)}_${sex}`, y);
  const M = (b, sex, y) => groups.map((g) => { const v = val(b, g, sex, y); return v == null ? null : v / 1e3; });
  return figure({
    bare: true, file: "india-atlas_population-pyramid",
    label: `India's population by five-year age group and sex, million: ${estN} estimates as bars, the UN's ${yB} projection as an outline. Median age ${f1(medL.value)} years in ${estN}`,
    data: tbl(["age_group", `men_${estN}_thousands`, `women_${estN}_thousands`, `men_${yB}_projected`, `women_${yB}_projected`, `men_${est0}`, `women_${est0}`],
      groups.map((g) => [g, val(ageB, g, "male", estN), val(ageB, g, "female", estN), val(ageProjB, g, "male", yB), val(ageProjB, g, "female", yB), val(ageB, g, "male", est0), val(ageB, g, "female", est0)])),
    draw: (width) => K.pyramid({ width, groups, counts: true, unit: { suffix: " mn" }, tipUnit: " million",
      male: M(ageB, "male", estN), female: M(ageB, "female", estN), year: String(estN),
      ghost: { male: M(ageProjB, "male", yB), female: M(ageProjB, "female", yB), year: `${yB}, projected` } }),
  });
}

/* ---------- § 03 median age ---------- */
export function median() {
  const E = pts(estB, "medianagepop"), P = pts(projB, "medianagepop"), lowE = low(E);
  return figure({
    bare: true, file: "india-atlas_median-age",
    label: `Median age of India's population: ${f1(lowE.value)} years at its youngest in ${lowE.year}, ${f1(E.at(-1).value)} in ${estN}; the UN projects ${f1(P.at(-1).value)} by ${projN}`,
    data: tbl(["year", "kind", "median_age_years"], [...E.map((p) => [p.year, "estimate", p.value]), ...P.map((p) => [p.year, "projection (medium)", p.value])]),
    draw: estProj({ pairs: [{ name: "Median age", short: `${projN}, projected`, E, P }], unit: { suffix: " years" }, endFormat: (v) => f1(v) + " years",
      notes: [{ d: E.at(-1).d, v: E.at(-1).value, text: `${estN}\n${f1(E.at(-1).value)} years`, side: "left" }, { d: lowE.d, v: lowE.value, text: `Youngest, ${lowE.year}\n${f1(lowE.value)} years`, below: true }] }),
  });
}

/* ---------- § 04 the working-age window ---------- */
export function windowPlate() {
  const E = pts(ageB, "share_15_64"), P = pts(ageProjB, "share_15_64"), lo = low(E);
  return figure({
    bare: true, file: "india-atlas_working-age-share",
    label: `People aged 15 to 64 as a share of India's population: ${f1(E.at(-1).value)}% in ${estN}; the UN projects a peak of ${f1(waPeak.value)}% in ${waPeak.year}`,
    data: tbl(["year", "kind", "share_15_64_pct", "aged_15_64_thousands"], [...E.map((p) => [p.year, "estimate", p.value, at(ageB, "working_age", p.year)]), ...P.map((p) => [p.year, "projection (medium)", p.value, at(ageProjB, "working_age", p.year)])]),
    draw: estProj({ pairs: [{ name: "Aged 15 to 64", short: `${projN}, projected`, E, P }], unit: { suffix: "%" }, endFormat: (v) => f1(v) + "%", yDomain: [50, 75],
      notes: (w) => [{ d: waPeak.d, v: waPeak.value, text: `Peak, ${waPeak.year}\n${f1(waPeak.value)}%` }, { d: E.at(-1).d, v: E.at(-1).value, text: `${estN}\n${f1(E.at(-1).value)}%`, side: "left", below: true }, ...(w >= 520 ? [{ d: lo.d, v: lo.value, text: `${lo.year}\n${f1(lo.value)}%`, below: true }] : [])] }),
  });
}

/* ---------- § 04 dependency ratios ---------- */
export function dependency() {
  const s = (k) => ({ E: pts(ageB, k), P: pts(ageProjB, k) });
  const yg = s("dependency_young"), od = s("dependency_old");
  const cross = od.P.find((p) => p.value > yg.P.find((q) => q.year === p.year).value);
  return figure({
    bare: true, file: "india-atlas_dependency-ratios",
    label: `Children (0 to 14) and people aged 65 and over for every 100 of working age: ${f1(yg.E.at(-1).value)} and ${f1(od.E.at(-1).value)} in ${estN}` + (cross ? `; more old than young from ${cross.year} on the UN's projection` : ""),
    data: tbl(["year", "kind", "young_per_100", "old_per_100", "total_per_100"],
      [...ageB.dates.map((d) => [yearOf(d), "estimate", at(ageB, "dependency_young", yearOf(d)), at(ageB, "dependency_old", yearOf(d)), at(ageB, "dependency_total", yearOf(d))]),
       ...ageProjB.dates.map((d) => [yearOf(d), "projection (medium)", at(ageProjB, "dependency_young", yearOf(d)), at(ageProjB, "dependency_old", yearOf(d)), at(ageProjB, "dependency_total", yearOf(d))])]),
    draw: estProj({ pairs: [{ name: "Children, 0 to 14", short: "Children", ...yg, role: "lead" }, { name: "Aged 65 and over", short: "Aged 65+", ...od, role: "comp" }], endFormat: f1,
      // a phone has no room beside the crossing for a note; the prose names the year
      notes: (w) => (cross && w >= 520 ? [{ d: cross.d, v: cross.value, text: `More old than young\nfrom ${cross.year}`, below: true }] : []) }),
  });
}

/* ---------- § 05 fertility ---------- */
export function tfr() {
  const E = pts(estB, "tfr"), P = pts(projB, "tfr");
  return figure({
    bare: true, file: "india-atlas_fertility-rate",
    label: `Total fertility rate: ${f2(E[0].value)} children per woman at ${E[0].year} rates and ${f2(E.at(-1).value)} at ${estN} rates; below the replacement rate of 2.1 since ${tfrBelow.year}`,
    data: tbl(["year", "kind", "tfr"], [...E.map((p) => [p.year, "estimate", p.value]), ...P.map((p) => [p.year, "projection (medium)", p.value])]),
    draw: estProj({ pairs: [{ name: "Fertility rate", short: `${projN}, projected`, E, P }], endFormat: f2, hoverDp: 2, refs: [{ y: 2.1, label: "Replacement, 2.1" }],
      notes: [{ d: E[0].d, v: E[0].value, text: `${E[0].year}\n${f2(E[0].value)}`, below: true }, { d: tfrBelow.d, v: tfrBelow.value, text: `Below 2.1\nfrom ${tfrBelow.year}`, side: "left", below: true }] }),
  });
}
export function births() {
  const bE = pts(estB, "births", 1e-3), dE = pts(estB, "deaths", 1e-3), bP = pts(projB, "births", 1e-3), dP = pts(projB, "deaths", 1e-3);
  const bPk = peak(bE), cross = bP.find((p, i) => dP[i] && dP[i].value > p.value);
  return figure({
    bare: true, file: "india-atlas_births-and-deaths",
    label: `Births and deaths a year in India, million: births peaked at ${f1(bPk.value)} million in ${bPk.year}; ${f1(bE.at(-1).value)} million births against ${f1(dE.at(-1).value)} million deaths in ${estN}` + (cross ? `; deaths overtake births in ${cross.year} on the UN's projection` : ""),
    data: tbl(["year", "kind", "births_thousands", "deaths_thousands"],
      [...estB.dates.map((d) => [yearOf(d), "estimate", at(estB, "births", yearOf(d)), at(estB, "deaths", yearOf(d))]), ...projB.dates.map((d) => [yearOf(d), "projection (medium)", at(projB, "births", yearOf(d)), at(projB, "deaths", yearOf(d))])]),
    draw: estProj({ pairs: [{ name: "Births", E: bE, P: bP, role: "lead" }, { name: "Deaths", E: dE, P: dP, role: "comp" }], unit: { suffix: " mn" }, endFormat: (v) => f1(v) + " mn",
      yDomain: [0, Math.ceil(bPk.value * 1.25 / 5) * 5], // headroom above the peak for its note, under the seam labels
      notes: (w) => [{ d: bPk.d, v: bPk.value, text: `Most births, ${bPk.year}\n${f1(bPk.value)} million` }, ...(cross && w >= 520 ? [{ d: cross.d, v: cross.value, text: `Deaths overtake\nbirths, ${cross.year}`, below: true, dy: 26 }] : [])] }),
  });
}

/* ---------- § 06 longer lives ---------- */
const LX = pts(estB, "lex");
let DIP = null; for (let i = 1; i < LX.length; i++) { const d = LX[i].value - LX[i - 1].value; if (!DIP || d < DIP.d) DIP = { d, at: LX[i], from: LX[i - 1] }; }
export function life() {
  const m = pts(estB, "lexmale"), f = pts(estB, "lexfemale"), mP = pts(projB, "lexmale"), fP = pts(projB, "lexfemale");
  const mDip = m.find((p) => p.year === DIP.at.year);
  return figure({
    bare: true, file: "india-atlas_life-expectancy",
    label: `Life expectancy at birth in India by sex: women ${f1(f.at(-1).value)} years and men ${f1(m.at(-1).value)} years at ${estN} death rates, with the pandemic's fall in ${DIP.at.year}`,
    data: tbl(["year", "kind", "women_years", "men_years", "both_years", "infant_mortality_per_1000", "under5_mortality_per_1000"],
      [...estB.dates.map((d) => [yearOf(d), "estimate", at(estB, "lexfemale", yearOf(d)), at(estB, "lexmale", yearOf(d)), at(estB, "lex", yearOf(d)), at(estB, "imr", yearOf(d)), at(estB, "q5", yearOf(d))]),
       ...projB.dates.map((d) => [yearOf(d), "projection (medium)", at(projB, "lexfemale", yearOf(d)), at(projB, "lexmale", yearOf(d)), at(projB, "lex", yearOf(d)), at(projB, "imr", yearOf(d)), at(projB, "q5", yearOf(d))])]),
    draw: estProj({ pairs: [{ name: "Women", E: f, P: fP, role: "lead" }, { name: "Men", E: m, P: mP, role: "comp" }], unit: { suffix: " years" }, endFormat: f1,
      notes: [{ d: mDip.d, v: mDip.value, text: `${DIP.at.year}\nthe pandemic`, below: true }] }),
  });
}

/* ---------- § 07 cities ---------- */
const WUP_LAST = 2018;   // World Urbanization Prospects 2018: later years are its projections
export function urban() {
  const u = pts(urbB, "sp_urb_totl_in_zs"), uE = u.filter((p) => p.year <= WUP_LAST), uP = u.filter((p) => p.year > WUP_LAST);
  return figure({
    bare: true, file: "india-atlas_urban-share",
    label: `Urban share of India's population: ${f1(uE[0].value)}% in ${uE[0].year}, ${f1(uE.at(-1).value)}% in ${WUP_LAST} (the last UN estimate); the UN projects ${f1(uP.at(-1).value)}% for ${uP.at(-1).year}`,
    data: tbl(["year", "kind", "urban_share_pct", "urban_population", "rural_population", "urban_growth_pct", "rural_growth_pct", "largest_city_population", "million_plus_cities_share_pct"],
      urbB.dates.map((d) => { const y = yearOf(d); return [y, y <= WUP_LAST ? "UN WUP 2018 estimate" : "UN WUP 2018 projection", at(urbB, "sp_urb_totl_in_zs", y), at(urbB, "sp_urb_totl", y), at(urbB, "sp_rur_totl", y), at(urbB, "sp_urb_grow", y), at(urbB, "sp_rur_totl_zg", y), at(urbB, "en_urb_lcty", y), at(urbB, "en_urb_mcty_tl_zs", y)]; })),
    draw: estProj({ pairs: [{ name: "Urban share", short: `${uP.at(-1).year}, projected`, E: uE, P: uP }], unit: { suffix: "%" }, endFormat: (v) => f1(v) + "%",
      seam: { t: `${WUP_LAST}-07-01`, before: "UN estimates", after: "UN projection" },
      notes: [{ d: uE[0].d, v: uE[0].value, text: `${uE[0].year}\n${f1(uE[0].value)}%`, below: false }, { d: uE.at(-1).d, v: uE.at(-1).value, text: `${WUP_LAST}, last UN estimate\n${f1(uE.at(-1).value)}%`, side: "left" }] }),
  });
}
export function growth() {
  const ug = pts(urbB, "sp_urb_grow"), rg = pts(urbB, "sp_rur_totl_zg");
  return figure({
    bare: true, file: "india-atlas_urban-rural-growth",
    label: `Growth of India's urban and rural population, per cent a year: urban ${f1(ug.at(-1).value)}% and rural ${f1(rg.at(-1).value)}% in ${ug.at(-1).year}`,
    data: tbl(["year", "urban_growth_pct", "rural_growth_pct"], urbB.dates.map((d) => [yearOf(d), at(urbB, "sp_urb_grow", yearOf(d)), at(urbB, "sp_rur_totl_zg", yearOf(d))])),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: "%" }, endDp: 1, hoverDp: 2,
      series: [{ name: "Rural", data: P2(rg), role: "comp" }, { name: "Urban", data: P2(ug), role: "lead" }] }),
  });
}

/* ---------- § 08 migration ---------- */
export function migration() {
  const nm = pts(estB, "netmigrations", 1e-3), nmP = pts(projB, "netmigrations", 1e-3).filter((p) => p.year <= 2050), worst = low(nm);
  return figure({
    bare: true, file: "india-atlas_net-migration",
    label: `India's net international migration a year, million: more people leave than arrive in most years; ${f2(nm.at(-1).value)} million in ${estN}, the largest net outflow ${f2(worst.value)} million in ${worst.year}; the UN's projection to 2050 dashed`,
    data: tbl(["year", "kind", "net_migration_thousands"], [...nm.map((p) => [p.year, "estimate", p.value * 1e3]), ...nmP.map((p) => [p.year, "projection (medium)", p.value * 1e3])]),
    draw: estProj({ pairs: [{ name: "Net migration", short: "2050, projected", E: nm, P: nmP }], unit: { suffix: " mn" }, endFormat: (v) => K.num(v, { dp: 2, suffix: " mn" }), hoverDp: 2,
      notes: [{ d: worst.d, v: worst.value, text: `${worst.year}\n−${f2(Math.abs(worst.value))} million`, below: true }] }),
  });
}

/* ---------- § 09 the variants ---------- */
const NAMES = { "": "Medium (the UN's central projection)", low: "Low fertility (half a child fewer)", high: "High fertility (half a child more)", constant_fertility: "Fertility stays at today's level", instant_replacement: "Fertility jumps to replacement", zero_migration: "No migration", constant_mortality: "Death rates stay at today's level", no_change: "Fertility and death rates frozen", momentum: "Replacement fertility, frozen death rates, no migration", lower_95_pi: "Lower end of the 95% range", upper_95_pi: "Upper end of the 95% range", lower_80_pi: "Lower end of the 80% range", upper_80_pi: "Upper end of the 80% range", median_pi: "Median of the probabilistic projection", instant_replacement_zero_migration: "Replacement fertility and no migration", no_fertility_below_age_18: "No births to mothers under 18", accelerated_abr_decline: "Faster fall in teenage births", accelerated_abr_decline_with_rec: "Faster fall in teenage births, later catch-up" };
for (const k of Object.keys(varB.series).filter((x) => x.startsWith("tpopulation1july__")).map((x) => x.slice(18))) if (!(k in NAMES)) throw new Error(`population: variant ${k} has no name on the What if plate`);
const v2100 = (k) => (k === "" ? popP.at(-1).value : at(varB, `tpopulation1july__${k}`, projN));
const v2050 = (k) => (k === "" ? at(projB, "tpopulation1july", 2050) : at(varB, `tpopulation1july__${k}`, 2050));
const VROWS = Object.keys(NAMES).filter((k) => v2100(k) != null).map((k) => ({ k, name: NAMES[k], a: v2050(k) / 1e6, b: v2100(k) / 1e6 })).sort((x, y) => y.b - x.b);
export function variants() {
  return figure({
    bare: true, file: "india-atlas_population-projection-variants",
    label: `India's population in ${projN} under each UN projection variant, billion, with 2050 as rings and today's population as a reference: ` + VROWS.map((r) => `${r.name}: ${r.b.toFixed(2)} billion`).join("; "),
    data: tbl(["variant", "population_2050_thousands", `population_${projN}_thousands`], VROWS.map((r) => [r.name, r.a * 1e6, r.b * 1e6])),
    draw: (width) => K.bars({ width, dp: 2, sort: false, nameMax: 380, markName: "2050:", refFill: false,
      ref: { value: +(popL.value / 1e6).toFixed(2), label: `${estN}, ${(popL.value / 1e6).toFixed(2)} bn` },
      rows: VROWS.map((r) => ({ name: r.name, value: r.b, mark: r.a, highlight: r.k === "" })) }),
  });
}

/* ---------- the figures the page quotes (ids kept from the retired client) ---------- */
export function numbers() {
  const T = {};
  const thisYear = new Date().getUTCFullYear();
  const popNowProj = popP.find((p) => p.year === Math.min(Math.max(thisYear, popP[0].year), projN));
  T["m-latest"] = String(estN);
  T["u-reading"] = `UN WPP 2024 estimate for ${estN}, mid-year`;
  T["n-pop"] = (popL.value / 1e6).toFixed(3) + pc(" billion");
  T["d-pop"] = `<b>+${mn(popL.value - popPrev.value)}</b> on ${popPrev.year}`;
  T["n-age"] = f1(medL.value) + pc(" years");
  T["d-age"] = `<b>${f1(med0.value)}</b> in ${med0.year}`;
  T["n-tfr"] = f2(tfrL.value);
  T["d-tfr"] = `below 2.1 since <b>${tfrBelow.year}</b>`;
  T["n-wa"] = f1(waL.value) + pc("%");
  T["d-wa"] = `peaks at <b>${f1(waPeak.value)}%</b> in ${waPeak.year} (projection)`;
  T["rb-pop"] = (popL.value / 1e6).toFixed(3) + pc(" billion");
  T["rb-proj"] = (popNowProj.value / 1e6).toFixed(3) + pc(" billion");
  T["rb-proj-year"] = `Projected for ${popNowProj.year}`;
  T["cr-crore"] = crore(popL.value);
  // § 02
  T["pv-curve"] = `${popPeak.year}`;
  T["ex-cu-peak"] = bn2(popPeak.value);
  T["ex-cu-peakyr"] = String(popPeak.year);
  T["ex-cu-2100"] = bn2(popP.at(-1).value);
  T["ex-cu-lo"] = bn2(LO95.at(-1).value);
  T["ex-cu-hi"] = bn2(HI95.at(-1).value);
  T["ex-cu-2050"] = bn2(popP.find((p) => p.year === 2050).value);
  T["ex-cu-1950"] = bn2(popE[0].value);
  T["ex-cu-x"] = (popL.value / popE[0].value).toFixed(1) + " times";
  // § 03
  const groups = ageB.meta.ageGroups, k = (g) => g.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const tot = groups.map((g) => ({ g, v: at(ageB, `age_${k(g)}_total`, estN), v50: at(ageProjB, `age_${k(g)}_total`, 2050) }));
  const big = peak(tot.map((t) => ({ ...t, value: t.v }))), big50 = peak(tot.map((t) => ({ ...t, value: t.v50 })));
  T["pv-pyramid"] = f1(medL.value) + " years";
  T["ex-py-med"] = f1(medL.value);
  T["ex-py-med50"] = f1(projB.series.medianagepop.data[projB.dates.indexOf("2050-01-01")]);
  T["ex-py-big"] = big.g;
  T["ex-py-big50"] = big50.g;
  T["ex-py-young"] = f1(at(ageB, "share_0_14", estN)) + "%";
  T["ex-py-young0"] = f1(at(ageB, "share_0_14", est0)) + "%";
  const mE = pts(estB, "medianagepop"), mP = pts(projB, "medianagepop"), lowE = low(mE);
  T["pv-median"] = f1(mE.at(-1).value) + " years";
  T["ex-md-low"] = f1(lowE.value);
  T["ex-md-lowyr"] = String(lowE.year);
  T["ex-md-2100"] = f1(mP.at(-1).value);
  // § 04
  const n = age("working_age"), nPk = peak(n);
  T["pv-window"] = String(waPeak.year);
  T["ex-wi-now"] = f1(waL.value) + "%";
  T["ex-wi-peak"] = f1(waPeak.value) + "%";
  T["ex-wi-peakyr"] = String(waPeak.year);
  T["ex-wi-npk"] = crore(nPk.value);
  T["ex-wi-npkyr"] = String(nPk.year);
  T["ex-wi-nnow"] = crore(n.find((p) => p.year === estN).value);
  const ygE = pts(ageB, "dependency_young"), odE = pts(ageB, "dependency_old"), ygP = pts(ageProjB, "dependency_young"), odP = pts(ageProjB, "dependency_old");
  const cross = odP.find((p) => p.value > ygP.find((q) => q.year === p.year).value);
  T["pv-dependency"] = f1(at(ageB, "dependency_total", estN));
  T["ex-de-young"] = f1(ygE.at(-1).value);
  T["ex-de-old"] = f1(odE.at(-1).value);
  T["ex-de-cross"] = cross ? String(cross.year) : "not before " + projN;
  T["ex-de-old50"] = f1(at(ageProjB, "dependency_old", 2050));
  T["ex-de-65"] = f1(at(ageB, "share_65_plus", estN)) + "%";
  T["ex-de-6550"] = f1(at(ageProjB, "share_65_plus", 2050)) + "%";
  // § 05
  const tE = pts(estB, "tfr"), tP = pts(projB, "tfr");
  T["pv-tfr"] = f2(tE.at(-1).value);
  T["ex-tf-1950"] = f2(tE[0].value);
  T["ex-tf-now"] = f2(tE.at(-1).value);
  T["ex-tf-yr"] = String(tfrBelow.year);
  T["ex-tf-2100"] = f2(tP.at(-1).value);
  const bE = pts(estB, "births", 1e-3), dE = pts(estB, "deaths", 1e-3), bP = pts(projB, "births", 1e-3), dP = pts(projB, "deaths", 1e-3);
  const bPk = peak(bE), bx = bP.find((p, i) => dP[i] && dP[i].value > p.value);
  T["pv-births"] = f1(bE.at(-1).value) + " mn";
  T["ex-bi-pk"] = f1(bPk.value) + " million";
  T["ex-bi-pkyr"] = String(bPk.year);
  T["ex-bi-now"] = f1(bE.at(-1).value) + " million";
  T["ex-bi-deaths"] = f1(dE.at(-1).value) + " million";
  T["ex-bi-cross"] = bx ? String(bx.year) : "not before " + projN;
  // § 06
  const lm = pts(estB, "lexmale"), lf = pts(estB, "lexfemale");
  T["pv-life"] = f1(LX.at(-1).value) + " years";
  T["ex-li-1950"] = f1(LX[0].value);
  T["ex-li-now"] = f1(LX.at(-1).value);
  T["ex-li-f"] = f1(lf.at(-1).value);
  T["ex-li-m"] = f1(lm.at(-1).value);
  T["ex-li-dipyr"] = String(DIP.at.year);
  T["ex-li-dip"] = f1(-DIP.d * 1) + " years";
  T["ex-li-dipfrom"] = String(DIP.from.year);
  const imr = pts(estB, "imr"), u5 = pts(estB, "q5");
  T["ex-li-imr0"] = Math.round(imr[0].value).toString();
  T["ex-li-imr"] = f1(imr.at(-1).value);
  T["ex-li-u50"] = Math.round(u5[0].value).toString();
  T["ex-li-u5"] = f1(u5.at(-1).value);
  // § 07
  const u = pts(urbB, "sp_urb_totl_in_zs"), uE = u.filter((p) => p.year <= WUP_LAST), uP = u.filter((p) => p.year > WUP_LAST);
  const up = pts(urbB, "sp_urb_totl"), rp = pts(urbB, "sp_rur_totl"), ug = pts(urbB, "sp_urb_grow"), rg = pts(urbB, "sp_rur_totl_zg");
  const city = pts(urbB, "en_urb_lcty"), mcty = pts(urbB, "en_urb_mcty_tl_zs");
  T["pv-urban"] = f1(uP.at(-1).value) + "%";
  T["ex-ur-1960"] = f1(uE[0].value) + "%";
  T["ex-ur-2018"] = f1(uE.at(-1).value) + "%";
  T["ex-ur-last"] = f1(uP.at(-1).value) + "%";
  T["ex-ur-lastyr"] = String(uP.at(-1).year);
  T["ex-ur-n"] = crore(up.at(-1).value / 1e3);
  T["ex-ur-rn"] = crore(rp.at(-1).value / 1e3);
  T["ex-ur-g"] = f1(ug.at(-1).value) + "%";
  T["ex-ur-rg"] = f1(rg.at(-1).value) + "%";
  T["ex-ur-city"] = mn(city.at(-1).value / 1e3);
  T["ex-ur-mcty"] = f1(mcty.at(-1).value) + "%";
  T["ex-ur-mcty0"] = f1(mcty[0].value) + "%";
  T["pv-growth"] = f1(ug.at(-1).value) + "%";
  // § 08
  const nm = pts(estB, "netmigrations"), worst = low(nm);
  const stock = pts(migB, "sm_pop_totl"), stockPct = pts(migB, "sm_pop_totl_zs"), refg = pts(migB, "sm_pop_rhcr_ea");
  T["pv-migration"] = (nm.at(-1).value < 0 ? "−" : "+") + f2(Math.abs(nm.at(-1).value) / 1e3) + " mn";
  T["ex-mi-now"] = f2(Math.abs(nm.at(-1).value) / 1e3) + " million";
  T["ex-mi-worst"] = f2(Math.abs(worst.value) / 1e3) + " million";
  T["ex-mi-worstyr"] = String(worst.year);
  T["ex-mi-stock"] = mn(stock.at(-1).value / 1e3);
  T["ex-mi-stockyr"] = String(stock.at(-1).year);
  T["ex-mi-stockpct"] = f1(stockPct.at(-1).value) + "%";
  T["ex-mi-stock0"] = mn(stock[0].value / 1e3);
  T["ex-mi-stock0yr"] = String(stock[0].year);
  T["ex-mi-refg"] = Math.round(refg.at(-1).value).toLocaleString("en-IN");
  T["ex-mi-refgyr"] = String(refg.at(-1).year);
  // § 09
  T["lg-var-b"] = String(projN);
  T["pv-variants"] = `${VROWS.at(-1).b.toFixed(2)} to ${VROWS[0].b.toFixed(2)} bn`;
  T["ex-va-lo"] = VROWS.at(-1).b.toFixed(2) + " billion";
  T["ex-va-lon"] = VROWS.at(-1).name.toLowerCase();
  T["ex-va-hi"] = VROWS[0].b.toFixed(2) + " billion";
  T["ex-va-hin"] = VROWS[0].name.toLowerCase();
  T["ex-va-zm"] = (v2100("zero_migration") / 1e6).toFixed(2) + " billion";
  T["prov-vintage"] = estB.meta.vintage;
  T["prov-vintage2"] = estB.meta.vintage;
  T["prov-wdi"] = urbB.meta.vintage;
  return T;
}
