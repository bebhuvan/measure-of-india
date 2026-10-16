// Deposits guide (where Indians keep their money): every plate and every number on the page,
// drawn and computed at build time with the chart kit (src/kit/). Each plate export returns a
// bare figure for its .plotzone; the plate's title, source line and buttons stay in
// src/pages/guides/deposits.astro. NUM holds the HTML each number id shows.
// Data: data/series/deposits-*.json, baked by scripts/lib/products/bsr2.mjs from the RBI's
// BSR-2 tables. Values are ₹ lakh crore (₹ crore in the deeper tables), as on 31 March.
// Two disclosed breaks: the sector classification (old to March 2018, new from March 2019) and
// the deposit-size bands (finer from March 2026). Neither is ever joined across.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";
import ownersBundle from "../../data/series/deposits-owners.json";
import owners05Bundle from "../../data/series/deposits-owners-2005.json";
import popBundle from "../../data/series/deposits-population.json";
import ratesBundle from "../../data/series/deposits-term-rates.json";
import maturityBundle from "../../data/series/deposits-term-maturity.json";
import size26Bundle from "../../data/series/deposits-term-size-2026.json";
import sectorsBundle from "../../data/series/deposits-sectors.json";
import ageBundle from "../../data/series/deposits-age.json";
import stOwnersBundle from "../../data/series/deposits-states-owners.json";
import stTypeBundle from "../../data/series/deposits-states-type.json";
import districtsBundle from "../../data/series/deposits-districts.json";
import bgSectorsBundle from "../../data/series/deposits-bankgroups-sectors.json";
import staffBundle from "../../data/series/deposits-employees-bankgroups.json";
import staffStBundle from "../../data/series/deposits-employees-states.json";
import origMatBundle from "../../data/series/deposits-maturity-owners.json";
import qSectorsBundle from "../../data/series/deposits-q-sectors.json";

const C = K.C;
const PCT = { suffix: "%" };
const LC = { prefix: "₹", suffix: " lakh cr" };
const RS = { prefix: "₹" }; // a line's axis: the subtitle names the unit, so the gutter stays narrow
const pc = (u) => `<span class="pc">${u}</span>`;
const pct = (a, b) => (100 * a) / b;
const lastV = (b, k) => { const d = b.series[k].data; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return d[i]; return null; };
const firstV = (b, k) => b.series[k].data.find((v) => v != null) ?? null;
const lastI = (b) => b.dates.length - 1;
const v = (b, k, i = lastI(b)) => b.series[k]?.data[i] ?? null;
const at = (b, k, iso) => b.series[k].data[b.dates.indexOf(iso)];
const pairsOf = (b, k, scale = 1) => b.dates.map((d, i) => [d, b.series[k].data[i] == null ? null : b.series[k].data[i] / scale]);
const yr = (iso) => iso.slice(0, 4);
const lastYear = yr(ownersBundle.dates.at(-1));

export const NUM = {};
const put = (id, html) => { NUM[id] = String(html); };

/* ---------- title block and § 01 ---------- */
const O = ownersBundle;
const hh = lastV(O, "household_total"), term = lastV(O, "household_term");
const women = pct(lastV(O, "female_total"), lastV(O, "all_total"));
put("m-latest", `March ${lastYear}`);
put("u-reading", `RBI BSR-2, as on 31 March ${lastYear}`);
put("n-hh", "₹" + hh.toFixed(1) + pc(" lakh crore"));
put("d-hh", `<b>${fmt.pct1Plus(pct(hh, O.series.household_total.data.at(-2)) - 100)}</b> on March ${+lastYear - 1}`);
put("n-term", pct(term, hh).toFixed(1) + pc("%"));
put("d-term", `<b>${fmt.lc1(term)}</b> in fixed deposits`);
{
  const R = ratesBundle, B = R.meta.bands, below6 = B.slice(0, 4).map((b) => b.key);
  const share = (iso) => pct(below6.reduce((s, k) => s + at(R, "ind_" + k, iso), 0), at(R, "ind_total", iso));
  const L = R.dates.at(-1);
  put("n-low", share(L).toFixed(1) + pc("%"));
  put("d-low", `<b>${share("2022-03-01").toFixed(1)}%</b> in March 2022`);
  put("cr-low", share(L).toFixed(1) + "%");
  put("cr-low22", share("2022-03-01").toFixed(1) + "%");
  put("cr-lastyr", `March ${yr(L)}`);
}
put("n-women", women.toFixed(1) + pc("%"));
put("d-women", `<b>${fmt.lc1(lastV(O, "female_total"))}</b> in women's names`);
put("rb-hh", "₹" + hh.toFixed(1) + pc(" lakh crore"));
put("rb-term", "₹" + term.toFixed(1) + pc(" lakh crore"));
put("cr-hh", fmt.lc1(hh));
put("cr-hh-share", pct(hh, lastV(O, "all_total")).toFixed(1) + "%");
put("cr-term", pct(term, hh).toFixed(1) + "%");
put("cr-sav", pct(lastV(O, "household_savings"), hh).toFixed(1) + "%");
put("cr-cur", pct(lastV(O, "household_current"), hh).toFixed(1) + "%");
put("prov-vintage", O.meta.vintage);
put("prov-vintage2", O.meta.vintage);

/* ---------- § 02 savings accounts and fixed deposits ---------- */
put("pv-types", fmt.lc1(term));
put("ex-ty-term", fmt.lc1(term));
put("ex-ty-sav", fmt.lc1(lastV(O, "household_savings")));
put("ex-ty-cur", fmt.lc1(lastV(O, "household_current")));
put("ex-ty-share", pct(term, hh).toFixed(1) + "%");
put("ex-ty-share19", pct(firstV(O, "household_term"), firstV(O, "household_total")).toFixed(1) + "%");
/** §02: the three account types on each side of the 2018-19 redefinition; the old household
 *  drawn lighter, the new one solid, a seam between them and never a line across it. */
export function types() {
  const TY = [["household_term", "Fixed deposits", "lead", C.leadSoft], ["household_savings", "Savings", "ctx", C.ctx2], ["household_current", "Current", "ctx2", "#E1E3E6"]];
  const series = TY.flatMap(([k, name, role, old]) => [
    { name: `${name}, old definition`, data: pairsOf(owners05Bundle, k), role, color: old, label: false },
    { name, data: pairsOf(ownersBundle, k), role },
  ]);
  const KEYS = ["household_term", "household_savings", "household_current", "household_total"];
  const rows = [...owners05Bundle.dates.map((d, i) => [d, "old", ...KEYS.map((k) => owners05Bundle.series[k].data[i] ?? null)]),
    ...ownersBundle.dates.map((d, i) => [d, "new", ...KEYS.map((k) => ownersBundle.series[k].data[i] ?? null)])];
  return figure({
    bare: true, file: "india-atlas_household-deposits-by-type",
    label: `Household bank deposits by type of account, March 2005 to March ${lastYear}: fixed deposits rose to ₹${term.toFixed(1)} lakh crore, savings accounts to ₹${lastV(O, "household_savings").toFixed(1)} lakh crore; the household was redefined in 2018-19 and the two periods are drawn apart`,
    data: { cols: ["as_on", "classification", "term_inr_lakh_crore", "savings_inr_lakh_crore", "current_inr_lakh_crore", "total_inr_lakh_crore"], rows },
    draw: (width) => K.line({
      width, freq: "month", unit: RS, endDp: 1, hoverDp: 1, series,
      endFormat: (x) => "₹" + K.num(x, { dp: 1 }),
      seam: { t: "2018-09-01", before: "Old definition", after: "New definition" },
    }),
  });
}

/* ---------- § 03 at what interest rate ---------- */
const R = ratesBundle, RB = R.meta.bands;
const RGROUPS = [
  ["Below 5%", RB.slice(0, 3).map((b) => b.key), C.seq[0], true],
  ["5 to 6%", [RB[3].key], C.seq[1], true],
  ["6 to 7%", [RB[4].key], C.seq[2], true],
  ["7 to 8%", [RB[5].key], C.seq[4], false],
  ["8% and above", RB.slice(6).map((b) => b.key), C.seq[5], false],
];
{
  const L = R.dates.length - 1, share = (keys, i) => pct(keys.reduce((s, k) => s + R.series["ind_" + k].data[i], 0), R.series.ind_total.data[i]);
  const below6 = RB.slice(0, 4).map((b) => b.key), i22 = R.dates.indexOf("2022-03-01");
  put("pv-rates", share(below6, L).toFixed(1) + "%");
  put("ex-r-low", share(below6, L).toFixed(1) + "%");
  put("ex-r-67", share([RB[4].key], L).toFixed(1) + "%");
  put("ex-r-78", share([RB[5].key], L).toFixed(1) + "%");
  put("ex-r-8", share(RB.slice(6).map((b) => b.key), L).toFixed(1) + "%");
  put("ex-r-low22", share(below6, i22).toFixed(1) + "%");
}
/** §03: one bar per year, the money split by the rate it was booked at, darker for higher. */
export function rates() {
  const rows = R.dates.map((d, i) => ({ name: `March ${yr(d)}`, parts: RGROUPS.map(([, keys]) => keys.reduce((s, k) => s + R.series["ind_" + k].data[i], 0)) }));
  return figure({
    bare: true, file: "india-atlas_fixed-deposits-by-interest-rate",
    label: "Individuals' fixed deposits by the interest rate they were booked at, share of the money each March, " + R.dates.map((d, i) => `${yr(d)}: ${K.num(pct(rows[i].parts[0] + rows[i].parts[1], R.series.ind_total.data[i]), { dp: 0 })}% below 6%`).join(", "),
    data: { cols: ["as_on", ...RB.map((b) => b.label), "total_inr_lakh_crore"], rows: R.dates.map((d, i) => [d, ...RB.map((b) => R.series["ind_" + b.key].data[i]), R.series.ind_total.data[i]]) },
    draw: (width) => K.stackBars({ width, rows, parts: RGROUPS.map(([name, , color, ink]) => ({ name, color, ink })), sort: false, labels: "all" }),
  });
}

/* ---------- § 04 maturity and size ---------- */
const M = maturityBundle, ML = M.dates.length - 1;
const MNAMES = ["Less than 3 months", "3 to 6 months", "6 months to a year", "1 to 3 years", "3 to 5 years", "5 years or more"];
const mRows = M.meta.bands.map((b, i) => ({ name: MNAMES[i], value: pct(M.series["ind_" + b.key].data[ML], M.series.ind_grand_total.data[ML]), highlight: i < 3 }));
{
  const within = mRows.slice(0, 3).reduce((s, r) => s + r.value, 0);
  put("pv-maturity", within.toFixed(1) + "%");
  put("ex-m-1y", within.toFixed(1) + "%");
  put("ex-m-3y", mRows[3].value.toFixed(1) + "%");
  put("ex-m-long", (mRows[4].value + mRows[5].value).toFixed(1) + "%");
}
/** §04: time left to maturity, in order from soonest; the three bands inside a year in the lead colour. */
export function maturity() {
  return figure({
    bare: true, file: "india-atlas_fixed-deposits-by-maturity",
    label: "Individuals' fixed deposits by time left to maturity, share of the money: " + mRows.map((r) => `${r.name} ${K.num(r.value)}%`).join(", "),
    data: { cols: ["as_on", "time_to_maturity", "individuals_inr_lakh_crore"], rows: M.dates.flatMap((d, i) => M.meta.bands.map((b, j) => [d, MNAMES[j], M.series["ind_" + b.key].data[i]])) },
    draw: (width) => K.bars({ width, rows: mRows, sort: false, unit: PCT, dp: 1 }),
  });
}
const Z = size26Bundle;
const ZNAMES = { less_than_1_lakh: "Under ₹1 lakh", "1_lakh_above_but_less_than_5_lakh": "₹1 to 5 lakh", "5_lakh_above_but_less_than_10_lakh": "₹5 to 10 lakh",
  "10_lakh_above_but_less_than_15_lakh": "₹10 to 15 lakh", "15_lakh_above_but_less_than_1_crore": "₹15 lakh to ₹1 crore", "1_crore_above_but_less_than_3_crore": "₹1 to 3 crore",
  "3_crore_above_but_less_than_5_crore": "₹3 to 5 crore", "5_crore_above": "₹5 crore or more" };
const ZMID = ["1_lakh_above_but_less_than_5_lakh", "5_lakh_above_but_less_than_10_lakh", "10_lakh_above_but_less_than_15_lakh"];
const zRows = Z.meta.bands.map((b) => ({ key: b.key, name: ZNAMES[b.key] ?? b.label, value: Z.series["ind_" + b.key].data[0], highlight: ZMID.includes(b.key) }));
{
  const tot = zRows.reduce((s, r) => s + r.value, 0);
  const mid = zRows.filter((r) => ZMID.includes(r.key)).reduce((s, r) => s + r.value, 0);
  const big = zRows.filter((r) => /crore/.test(r.key) && !/15_lakh/.test(r.key)).reduce((s, r) => s + r.value, 0);
  put("pv-size", pct(mid, tot).toFixed(1) + "%");
  put("ex-s-mid", pct(mid, tot).toFixed(1) + "%");
  put("ex-s-small", pct(zRows[0].value, tot).toFixed(1) + "%");
  put("ex-s-big", pct(big, tot).toFixed(1) + "%");
}
/** §04: deposit-size bands in order, ₹ lakh crore; the ₹1 to 15 lakh bands in the lead colour. */
export function size() {
  return figure({
    bare: true, file: "india-atlas_fixed-deposits-by-size-2026",
    label: "Individuals' fixed deposits by size of deposit, March 2026: " + zRows.map((r) => `${r.name} ₹${K.num(r.value)} lakh crore`).join(", "),
    data: { cols: ["deposit_size", "individuals_inr_lakh_crore"], rows: zRows.map((r) => [r.name, r.value]) },
    draw: (width) => K.bars({ width, rows: zRows, sort: false, unit: LC, dp: 1 }),
  });
}

/* ---------- § 05 place ---------- */
const P = popBundle, PL = P.dates.length - 1;
const PGRPS = [["rural", "Rural"], ["semi_urban", "Semi-urban"], ["urban", "Urban"], ["metro", "Metropolitan"]];
const pRows = PGRPS.map(([k, n]) => ({ name: n, a: P.series["household_" + k].data[0], b: P.series["household_" + k].data[PL], k, highlight: k === "metro" }));
{
  const all = P.series.household_all_india.data[PL];
  put("pv-place", pct(pRows[3].b, all).toFixed(1) + "%");
  put("ex-p-metro", pct(pRows[3].b, all).toFixed(1) + "%");
  put("ex-p-rural", pct(pRows[0].b, all).toFixed(1) + "%");
  put("ex-p-women", women.toFixed(1) + "%");
  put("ex-p-women19", pct(firstV(O, "female_total"), firstV(O, "all_total")).toFixed(1) + "%");
}
/** §05: household deposits by branch location, March 2019 against the latest March. */
export function place() {
  return figure({
    bare: true, file: "india-atlas_household-deposits-by-place",
    label: "Household deposits by population group of the branch: " + pRows.map((r) => `${r.name}: ₹${K.num(r.a)} lakh crore in March ${yr(P.dates[0])}, ₹${K.num(r.b)} lakh crore in March ${yr(P.dates[PL])}`).join("; "),
    data: { cols: ["as_on", ...PGRPS.map(([, n]) => n), "all_india"], rows: P.dates.map((d, i) => [d, ...PGRPS.map(([k]) => P.series["household_" + k].data[i]), P.series.household_all_india.data[i]]) },
    draw: (width) => K.dumbbell({ width, rows: pRows, keys: { a: `March ${yr(P.dates[0])}`, b: `March ${yr(P.dates[PL])}` }, unit: { suffix: " lakh cr" }, dp: 1, sortBy: "none", aColor: C.ink2, labelAll: true, fmt: (x) => "₹" + K.num(x, { dp: 1 }) }),
  });
}

/* ---------- § 06 who else keeps money in banks ---------- */
const SEC = sectorsBundle;
const SNAME = { s1: "General government", s1_1: "Central government", s1_2: "State governments", s1_3: "Local government", s2: "Non-financial companies",
  s2_1: "Government-owned companies", s2_2: "Private companies", s3: "Financial firms", s3_1: "Deposit-taking firms", s3_2: "Mutual funds", s3_3: "Insurance companies",
  s3_4: "Provident and pension funds", s3_5: "Other financial firms", s4: "Households", s4_1: "Individuals", s4_2: "Unincorporated businesses",
  s4_3: "Non-profits serving households", s5: "Rest of the world", s5_1: "Non-residents", s5_2: "All others abroad" };
const sKeys = Object.keys(SEC.series).filter((k) => k.endsWith("__total") && k !== "total__total");
{
  const sh = (k, i) => ((v(SEC, k, i) / v(SEC, "total__total", i)) * 100).toFixed(1) + "%";
  put("pv-sectors", sh("s4__total"));
  put("ex-sc-hh", sh("s4__total")); put("ex-sc-hh19", sh("s4__total", 0));
  put("ex-sc-nfc", sh("s2__total")); put("ex-sc-nfc19", sh("s2__total", 0));
  put("ex-sc-gov", sh("s1__total")); put("ex-sc-nri", sh("s5_1_1__total")); put("ex-sc-shg", sh("s4_3_1__total"));
}
/** §06: each owning sector's share, 2019 against the latest year; the five sectors in bold with
 *  their sub-groups beneath them, in the national accounts' own order. */
export function sectors() {
  const T = v(SEC, "total__total"), T0 = v(SEC, "total__total", 0);
  const rows = sKeys.map((k) => { const code = k.split("__")[0], depth = code.split("_").length;
    return { name: (depth > 1 ? "· " : "") + (SNAME[code] ?? SEC.series[k].label.split(" · ").at(-1)), depth, b: (v(SEC, k) / T) * 100, a: v(SEC, k, 0) != null ? (v(SEC, k, 0) / T0) * 100 : null, highlight: depth === 1 }; })
    .filter((r) => r.depth <= 2 && r.a != null);
  return figure({
    bare: true, file: "india-atlas_deposits-by-owner",
    label: `Deposits by owning sector, share of all deposits, March ${yr(SEC.dates[0])} and March ${yr(SEC.dates.at(-1))}: ` + rows.filter((r) => r.depth === 1).map((r) => `${r.name} ${K.num(r.a)}% to ${K.num(r.b)}%`).join("; "),
    data: { cols: ["as_on", "owner", "current_inr_crore", "savings_inr_crore", "term_inr_crore", "total_inr_crore"],
      rows: SEC.dates.flatMap((d, i) => sKeys.concat(["total__total"]).map((k) => { const p = k.slice(0, -7); return [d, SEC.series[k].label.split(" · ").at(-1), v(SEC, p + "__current", i), v(SEC, p + "__savings", i), v(SEC, p + "__term", i), v(SEC, k, i)]; })) },
    draw: (width) => K.dumbbell({ width, rows, keys: { a: `March ${yr(SEC.dates[0])}`, b: `March ${yr(SEC.dates.at(-1))}` }, unit: PCT, dp: 1, sortBy: "none", aColor: C.ink2 }),
  });
}

/* ---------- § 07 how old the savers are ---------- */
const AGE = ageBundle, AI = lastI(AGE);
const AG = Object.keys(AGE.series).filter((k) => k.startsWith("individuals__") && k.endsWith("__total")).map((k) => k.split("__")[1]);
const ageName = (g) => AGE.series[`individuals__${g}__total`].label.split(" · ").at(-1);
const ageTot = (i) => AG.reduce((a, g) => a + v(AGE, `individuals__${g}__total`, i), 0);
const SEN = ["a7_60_to_69", "a8_70_and_above"];
const ageSen = (i) => SEN.reduce((a, g) => a + v(AGE, `individuals__${g}__total`, i), 0);
{
  const sh = (x, y) => ((x / y) * 100).toFixed(1) + "%";
  put("pv-age", sh(ageSen(AI), ageTot(AI)));
  put("ex-age-60", sh(ageSen(AI), ageTot(AI)));
  put("ex-age-60-23", sh(ageSen(0), ageTot(0)));
  put("ex-age-60-term", sh(SEN.reduce((a, g) => a + v(AGE, `individuals__${g}__term`), 0), ageSen(AI)));
  put("ex-age-25", sh(v(AGE, "individuals__a5_25_to_39__total"), ageTot(AI)));
  put("ex-age-minor", sh(["a1_under_10", "a2_10_to_14", "a3_15_to_17"].reduce((a, g) => a + v(AGE, `individuals__${g}__total`), 0), ageTot(AI)));
}
/** §07: each age group's money, ₹ lakh crore, fixed deposits first; its share of the total after it. */
export function age() {
  const rows = AG.map((g) => { const tm = v(AGE, `individuals__${g}__term`) / 1e5, tot = v(AGE, `individuals__${g}__total`) / 1e5;
    return { name: ageName(g), parts: [tm, tot - tm], note: K.num((v(AGE, `individuals__${g}__total`) / ageTot(AI)) * 100, { dp: 1, suffix: "%" }), highlight: SEN.includes(g) }; });
  const W2 = ["individuals", "women"];
  return figure({
    bare: true, file: "india-atlas_deposits-by-age",
    label: `Deposits of individuals by age, March ${yr(AGE.dates[AI])}, ₹ lakh crore, fixed deposits and savings and current accounts: ` + rows.map((r) => `${r.name} ₹${K.num(r.parts[0] + r.parts[1])} lakh crore`).join(", "),
    data: { cols: ["as_on", "holder", "age", "current_inr_crore", "savings_inr_crore", "term_inr_crore", "total_inr_crore"],
      rows: AGE.dates.flatMap((d, i) => W2.flatMap((w) => AG.map((g) => [d, w, ageName(g), v(AGE, `${w}__${g}__current`, i), v(AGE, `${w}__${g}__savings`, i), v(AGE, `${w}__${g}__term`, i), v(AGE, `${w}__${g}__total`, i)]))) },
    draw: (width) => K.stackBars({ width, rows, sort: false, parts: [{ name: "Fixed deposits", color: C.lead }, { name: "Savings and current accounts", color: C.leadTint }], absolute: { unit: { prefix: "₹", suffix: " lakh cr" }, dp: 1 } }),
  });
}
const SO = stOwnersBundle;
const wsRows = Object.keys(SO.series).filter((k) => k.endsWith("__women") && SO.series[k].group === "State").map((k) => { const p = k.slice(0, -7);
  return { p, name: SO.series[k].label.split(" · ").at(-1), value: v(SO, k) == null || !v(SO, p + "__individuals") ? null : (v(SO, k) / v(SO, p + "__individuals")) * 100 }; })
  .filter((r) => r.value != null).sort((a, b) => b.value - a.value); // retired units have no figure: left out, not drawn as zero
const wsAI = (v(SO, "all_india__women") / v(SO, "all_india__individuals")) * 100, wsAI0 = (v(SO, "all_india__women", 0) / v(SO, "all_india__individuals", 0)) * 100;
put("pv-womenst", wsAI.toFixed(1) + "%");
put("ex-ws-hi", `${wsRows[0].name}, ${wsRows[0].value.toFixed(1)}%`);
put("ex-ws-lo", `${wsRows.at(-1).name}, ${wsRows.at(-1).value.toFixed(1)}%`);
put("ex-ws-ai", wsAI.toFixed(1) + "%"); put("ex-ws-ai19", wsAI0.toFixed(1) + "%");
const SHORT_ST = { "Dadra and Nagar Haveli and Daman and Diu": "Dadra & NH and Daman & Diu", "Andaman & Nicobar Islands": "Andaman & Nicobar" };
const stName = (n) => SHORT_ST[n] ?? n;
/** §07: women's share of individuals' deposits, states ranked, the All-India figure as the rule. */
export function womenst() {
  return figure({
    bare: true, file: "india-atlas_deposits-women-by-state",
    label: `Women's share of individuals' deposits by state, March ${yr(SO.dates.at(-1))}: highest ${wsRows[0].name} ${K.num(wsRows[0].value)}%, lowest ${wsRows.at(-1).name} ${K.num(wsRows.at(-1).value)}%, All India ${K.num(wsAI)}%`,
    data: { cols: ["as_on", "state", "individuals_inr_crore", "women_inr_crore", "women_share_pct"],
      rows: SO.dates.flatMap((d, i) => wsRows.map((r) => [d, r.name, v(SO, r.p + "__individuals", i), v(SO, r.p + "__women", i), v(SO, r.p + "__individuals", i) ? +((v(SO, r.p + "__women", i) / v(SO, r.p + "__individuals", i)) * 100).toFixed(2) : null])) },
    draw: (width) => K.bars({ width, rows: wsRows.map((r) => ({ name: stName(r.name), value: r.value })), unit: PCT, dp: 1, ref: { value: wsAI, label: `All India ${K.num(wsAI)}%` } }),
  });
}

/* ---------- § 08 where the money sits ---------- */
const ST = stTypeBundle, STT = v(ST, "all_india__total");
const stRows = Object.keys(ST.series).filter((k) => k.endsWith("__total") && ST.series[k].group === "State").map((k) => ({ k, name: ST.series[k].label.split(" · ").at(-1), value: v(ST, k) == null ? null : (v(ST, k) / STT) * 100 }))
  .filter((r) => r.value != null).sort((a, b) => b.value - a.value);
put("pv-states", stRows[0].value.toFixed(1) + "%");
put("ex-st-n1", stRows[0].name); put("ex-st-mh", stRows[0].value.toFixed(1) + "%");
put("ex-st-n23", stRows[1].name + " and " + stRows[2].name); put("ex-st-next", (stRows[1].value + stRows[2].value).toFixed(1) + "%");
put("ex-st-small", String(stRows.filter((r) => r.value < 1).length));
/** §08: every state's share of all deposits, ranked; the three largest in the lead colour. */
export function states() {
  return figure({
    bare: true, file: "india-atlas_deposits-by-state",
    label: `Deposits by state, share of all deposits, March ${yr(ST.dates.at(-1))}: ` + stRows.slice(0, 5).map((r) => `${r.name} ${K.num(r.value)}%`).join(", "),
    data: { cols: ["as_on", "state", "offices", "accounts", "current_inr_crore", "savings_inr_crore", "term_inr_crore", "total_inr_crore"],
      rows: ST.dates.flatMap((d, i) => stRows.map((r) => { const p = r.k.slice(0, -7); return [d, r.name, v(ST, p + "__offices", i), v(ST, p + "__total_accounts", i), v(ST, p + "__current", i), v(ST, p + "__savings", i), v(ST, p + "__term", i), v(ST, r.k, i)]; })) },
    draw: (width) => K.bars({ width, rows: stRows.map((r, i) => ({ name: stName(r.name), value: r.value, highlight: i < 3 })), unit: PCT, dp: 1 }),
  });
}
const DI = districtsBundle, DII = lastI(DI);
const dAll = (() => {
  // a district's total = the sum of its population-group rows (the table prints no district total)
  const by = new Map();
  for (const [k, s] of Object.entries(DI.series)) {
    if (!k.endsWith("__amount") || k.startsWith("all_india")) continue;
    const [st, di] = k.split("__"), key = st + "__" + di;
    const o = by.get(key) ?? { name: `${s.label.split(" · ")[2]}, ${s.label.split(" · ")[1]}`, district: s.label.split(" · ")[2], v: 0, acc: 0, off: 0 };
    o.v += s.data[DII] ?? 0; o.acc += v(DI, k.replace("__amount", "__accounts")) ?? 0; o.off += v(DI, k.replace("__amount", "__offices")) ?? 0;
    by.set(key, o);
  }
  return [...by.values()].filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
})();
const dT = dAll.reduce((a, d) => a + d.v, 0);
const dHalf = (() => { let c = 0, n = 0; for (const d of dAll) { c += d.v; n++; if (c >= dT / 2) break; } return n; })();
const dRows = dAll.slice(0, 30).map((d) => ({ ...d, share: (d.v / dT) * 100 }));
put("pv-districts", String(dHalf));
put("ex-di-1", dRows.filter((r) => /^Mumbai/.test(r.name)).reduce((a, r) => a + r.share, 0).toFixed(1) + "% (two districts)");
put("ex-di-2", (dRows.find((r) => /^Bengaluru Urban/.test(r.name))?.share ?? 0).toFixed(1) + "%");
put("ex-di-half", String(dHalf)); put("ex-di-n", String(dAll.length));
// the state as its usual short code, so "Gautam Buddha Nagar, UP" fits the name column
const ST_CODE = { "Andhra Pradesh": "AP", "Assam": "AS", "Bihar": "BR", "Chhattisgarh": "CG", "Delhi": "DL", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR",
  "Himachal Pradesh": "HP", "Jammu & Kashmir": "J&K", "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL", "Madhya Pradesh": "MP", "Maharashtra": "MH", "Odisha": "OD",
  "Punjab": "PB", "Rajasthan": "RJ", "Tamil Nadu": "TN", "Telangana": "TS", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB", "Chandigarh": "CH" };
const dName = (r) => { const [d, st] = [r.district, r.name.slice(r.district.length + 2)]; return `${d}, ${ST_CODE[st] ?? st}`; };
/** §08: the thirty districts with the most deposits, ranked; the top three in the lead colour. */
export function districts() {
  return figure({
    bare: true, file: "india-atlas_deposits-by-district",
    label: `The 30 districts with the most bank deposits, March ${yr(DI.dates[DII])}: ` + dRows.slice(0, 5).map((r) => `${r.name} ${K.num(r.share)}%`).join(", ") + `; ${dHalf} districts hold half of all deposits`,
    data: { cols: ["as_on", "district_state", "offices", "accounts", "amount_inr_crore", "share_pct"], rows: dAll.map((d) => [DI.dates[DII], d.name, d.off, d.acc, Math.round(d.v * 100) / 100, +((d.v / dT) * 100).toFixed(3)]) },
    draw: (width) => K.bars({ width, rows: dRows.map((r, i) => ({ name: dName(r), value: r.share, highlight: i < 3 })), unit: PCT, dp: 1 }),
  });
}

/* ---------- § 09 which banks, and who works in them ---------- */
const BG = bgSectorsBundle;
// short names: a phone keeps each end label's first word
const BGRP = [["private", "Private sector banks", "lead", "Private banks"], ["psb", "Public sector banks", "comp", "Public banks"], ["foreign", "Foreign banks", "ctx", "Foreign banks"], ["rrb", "Regional rural banks", "ctx", "Rural banks (RRBs)"], ["sfb", "Small finance banks", "ctx", "Small-finance banks"]];
const bgShare = (g) => BG.dates.map((d, i) => [d, BG.series["total__" + g].data[i] == null ? null : (BG.series["total__" + g].data[i] / BG.series.total__all_banks.data[i]) * 100]);
{
  const f = (g, i) => { const s = bgShare(g); return s.at(i)[1].toFixed(1) + "%"; };
  put("pv-banks", f("private", -1));
  put("ex-bk-psb", f("psb", -1)); put("ex-bk-psb19", f("psb", 0)); put("ex-bk-pvt", f("private", -1)); put("ex-bk-pvt19", f("private", 0));
  put("ex-bk-for", f("foreign", -1)); put("ex-bk-rrb", f("rrb", -1)); put("ex-bk-sfb", f("sfb", -1));
}
/** §09: each bank group's share of deposits; private banks the lead, public sector banks the comparison. */
export function banks() {
  const G = [...BGRP.map((g) => g[0]), "payments", "all_banks"];
  return figure({
    bare: true, file: "india-atlas_deposits-by-bank-group",
    label: `Share of deposits by bank group, March ${yr(BG.dates[0])} to March ${yr(BG.dates.at(-1))}: ` + BGRP.map(([g, n]) => `${n} ${K.num(bgShare(g)[0][1])}% to ${K.num(bgShare(g).at(-1)[1])}%`).join("; "),
    data: { cols: ["as_on", ...G.map((g) => g + "_inr_crore")], rows: BG.dates.map((d, i) => [d, ...G.map((g) => BG.series["total__" + g]?.data[i] ?? null)]) },
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, zero: true,
      series: BGRP.map(([g, name, role, short]) => ({ name, short, data: bgShare(g), role })),
    }),
  });
}
const SF = staffBundle, SFI = lastI(SF), S2 = staffStBundle;
const sfRows = ["psb", "private", "rrb", "foreign", "sfb", "payments"].map((g) => ({ g, name: SF.series[`all_india__${g}__total`].label.split(" · ").at(-1), n: v(SF, `all_india__${g}__total`), value: (v(SF, `all_india__${g}__women_total`) / v(SF, `all_india__${g}__total`)) * 100 })).sort((a, b) => b.value - a.value);
const sfAI = (v(S2, "all_india__women_total") / v(S2, "all_india__total")) * 100;
put("pv-staff", sfAI.toFixed(1) + "%");
put("ex-sf-n", v(S2, "all_india__total").toLocaleString("en-IN")); put("ex-sf-w", sfAI.toFixed(1) + "%");
put("ex-sf-hi", `${sfRows[0].name}, ${sfRows[0].value.toFixed(1)}%`); put("ex-sf-lo", `${sfRows.at(-1).name}, ${sfRows.at(-1).value.toFixed(1)}%`);
/** §09: women's share of staff by bank group, against the All-India share; the head count after each. */
export function staff() {
  return figure({
    bare: true, file: "india-atlas_bank-employees-by-bank-group",
    label: `Women's share of bank employees by bank group, March ${yr(SF.dates[SFI])}: ` + sfRows.map((r) => `${r.name} ${K.num(r.value)}%`).join(", "),
    data: { cols: ["as_on", "bank_group", "employees", "women", "women_share_pct"], rows: sfRows.map((r) => [SF.dates[SFI], r.name, r.n, v(SF, `all_india__${r.g}__women_total`), +r.value.toFixed(2)]) },
    draw: (width) => K.bars({ width, rows: sfRows.map((r) => ({ name: r.name, value: r.value, note: `of ${K.inGroup(r.n)}` })), unit: PCT, dp: 1, ref: { value: sfAI, label: `All India ${K.num(sfAI)}%` } }),
  });
}

/* ---------- § 10 booked for how long, and the quarterly return ---------- */
const OM = origMatBundle;
const OMB = Object.keys(OM.series).filter((k) => /^m\d/.test(k) && k.endsWith("__total")).map((k) => k.slice(0, -7));
const omAt = (m, i) => (OM.series[m + "__total"].data.at(i) / OM.series["all__total"].data.at(i)) * 100;
put("pv-origmat", omAt(OMB[3], -1).toFixed(1) + "%");
put("ex-om-13", omAt(OMB[3], -1).toFixed(1) + "%");
put("ex-om-1", (omAt(OMB[0], -1) + omAt(OMB[1], -1) + omAt(OMB[2], -1)).toFixed(1) + "%");
put("ex-om-5", omAt(OMB[5], -1).toFixed(1) + "%"); put("ex-om-519", omAt(OMB[5], 0).toFixed(1) + "%");
/** §10: one bar per year, term deposits split by the term they were booked for, shortest first. */
export function origmat() {
  const label = (m) => OM.series[m + "__total"].label.split(" · ").at(-1);
  const COL = [[C.seq[0], true], [C.seq[1], true], [C.seq[2], true], [C.lead, false], [C.seq[5], false], ["#0F1A4D", false]];
  const rows = OM.dates.map((d, i) => ({ name: `March ${yr(d)}`, parts: OMB.map((m) => OM.series[m + "__total"].data[i]) }));
  return figure({
    bare: true, file: "india-atlas_term-deposits-by-original-maturity",
    label: "Term deposits by original maturity, share of the money each March: " + OM.dates.map((d, i) => `${yr(d)} one to three years ${K.num(omAt(OMB[3], i), { dp: 0 })}%`).join(", "),
    data: { cols: ["as_on", "original_maturity", "individuals_inr_crore", "others_inr_crore", "total_inr_crore", "total_accounts"],
      rows: OM.dates.flatMap((d, i) => OMB.concat(["all"]).map((m) => [d, label(m), OM.series[m + "__individuals"]?.data[i] ?? null, OM.series[m + "__others"]?.data[i] ?? null, OM.series[m + "__total"].data[i], OM.series[m + "__total_accounts"]?.data[i] ?? null])) },
    draw: (width) => K.stackBars({ width, rows, parts: OMB.map((m, j) => ({ name: label(m), color: COL[j][0], ink: COL[j][1] })), sort: false, labels: "all" }),
  });
}
const Q = qSectorsBundle;
const qTot = pairsOf(Q, "total__total", 1e5);
const qHH = Q.dates.map((d, i) => (Q.series.s4__total.data[i] / Q.series.total__total.data[i]) * 100);
{
  const L = qTot.length - 1;
  put("pv-quarterly", "₹" + qTot[L][1].toFixed(1) + pc(" lakh crore"));
  put("ex-q-tot", "₹" + qTot[L][1].toFixed(1) + " lakh crore");
  put("ex-q-yoy", fmt.pct1Plus((qTot[L][1] / qTot[L - 4][1] - 1) * 100));
  put("ex-q-hh", qHH[L].toFixed(1) + "%");
}
/** §10: the quarterly total (a different instrument: no regional rural banks), each March and the
 *  latest quarter carrying the household share beneath its point. */
export function quarterly() {
  const marks = Q.dates.map((d, i) => ({ d, v: qTot[i][1], text: `Households ${K.num(qHH[i], { dp: 1 })}%`, i })).filter((p) => p.d.slice(5, 7) === "03" || p.i === Q.dates.length - 1);
  return figure({
    bare: true, file: "india-atlas_deposits-quarterly",
    label: `Deposits by quarter, excluding regional rural banks, March ${yr(Q.dates[0])} to June ${yr(Q.dates.at(-1))}: from ₹${K.num(qTot[0][1])} to ₹${K.num(qTot.at(-1)[1])} lakh crore; the household share is labelled each March`,
    data: { cols: ["quarter_end", "total_inr_crore", "households_inr_crore", "households_share_pct"], rows: Q.dates.map((d, i) => [d, Q.series.total__total.data[i], Q.series.s4__total.data[i], +qHH[i].toFixed(2)]) },
    draw: (width) => K.line({
      width, freq: "month", unit: RS, endDp: 1, yDomain: [Math.floor(Math.min(...qTot.map((p) => p[1])) / 10) * 10 - 10, Math.max(...qTot.map((p) => p[1]))], endFormat: (x) => "₹" + K.num(x, { dp: 1 }),
      series: [{ name: "Deposits", data: qTot, role: "lead" }],
      pointLabels: width < 1000 ? marks.filter((p) => p.d.slice(5, 7) === "03").map((p) => ({ ...p, text: K.num(qHH[p.i], { dp: 1 }) + "%" })) : marks.filter((p) => p.i !== Q.dates.length - 1),
      endSub: width < 520 ? undefined : `Households ${K.num(qHH.at(-1), { dp: 1 })}%`,
    }),
  });
}
