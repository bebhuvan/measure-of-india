// Consumption guide (HCES): the plates, drawn at build time with the chart kit (src/kit/), and the
// figures, register and baskets the page quotes beside them. The HCES is cross-sectional: two
// survey rounds (2022-23, 2023-24), almost no time axis, so the plates are dumbbells, dot rows
// and a heat table; a line is drawn only where a real ordering exists (the fractile ladder). The
// headline convention is "without imputation"; the with-imputation variants are named where used.
// The 2011-12 and earlier NSS rounds use a different method, are not served, and are never
// spliced or compared here. Runs at build time only.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import mpceB from "../../data/series/hces-mpce.json";
import statesB from "../../data/series/hces-states.json";
import fracB from "../../data/series/hces-fractiles.json";
import catB from "../../data/series/hces-categories.json";
import giniB from "../../data/series/hces-gini.json";
import socialB from "../../data/series/hces-social.json";
import hhB from "../../data/series/hces-household-type.json";
import qtyB from "../../data/series/hces-quantities.json";
import ivB from "../../data/series/hces-item-values.json";
import foodStB from "../../data/series/hces-categories-states.json";
import inrStB from "../../data/series/hces-categories-inr-states.json";
import inrAllB from "../../data/series/hces-categories-inr.json";
import impStB from "../../data/series/hces-states-imputed.json";
import giniStB from "../../data/series/hces-gini-states.json";

/* ---------- helpers ---------- */
// two rounds only: index 0 = 2022-23, index 1 = 2023-24
const cur = (b, k) => b.series[k].data[1];
const prv = (b, k) => b.series[k].data[0];
const M = (k) => cur(mpceB, k);
const grp = (v) => { const s = String(Math.round(Math.abs(v))); return s.length <= 3 ? s : s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + s.slice(-3); };
const inr = (v) => (v < 0 ? "−₹" : "₹") + grp(v);
const inrBig = (v) => '<span class="pc">₹</span>' + grp(v);
const p1 = (v) => v.toFixed(1) + "%", p2 = (v) => v.toFixed(2) + "%";
const kg1 = (v) => v.toFixed(1) + " kg", kg2 = (v) => v.toFixed(2) + " kg";
const kgd = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2) + " kg";
const g3 = (v) => v.toFixed(3);
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const arrowPct = (c, p) => { const d = ((c - p) / p) * 100; return (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + "%"; };
const arrowAbs = (c, p, dp) => { const d = c - p; return (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(dp); };
const arrowPt = (c, p) => { const d = c - p; return (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt"; };
const URB = K.C.ink2; // urban: the dark dot beside the blue rural one
const RUPEE = { prefix: "₹" };
const fmtInr = (v) => inr(v);
const R0 = "2022-23", R1 = "2023-24";
// the all-India rural and urban means as reference rules, labelled away from each other
const meanRefs = (r, u, f) => [{ value: r, label: `all-India rural ${f(r)}`, side: "left" }, { value: u, label: `all-India urban ${f(u)}`, side: "right" }];
const both = (b, k) => [prv(b, k), cur(b, k)];
const tbl = (cols, rows) => ({ cols, rows });

/* ---------- § 03 the ladder ---------- */
const FRACS = ["f0_5", "f5_10", "f10_20", "f20_30", "f30_40", "f40_50", "f50_60", "f60_70", "f70_80", "f80_90", "f90_95", "f95_100"];
const FRACLAB = ["0–5", "5–10", "10–20", "20–30", "30–40", "40–50", "50–60", "60–70", "70–80", "80–90", "90–95", "95–100"];
export function ladder() {
  const S = (sec, round) => FRACS.map((k, i) => [String(i), (round ? cur : prv)(fracB, `${k}_${sec}`)]);
  const topDrop = prv(fracB, "f95_100_urban") - cur(fracB, "f95_100_urban");
  return figure({
    bare: true, file: "india-atlas_hces_fractile-ladder",
    label: `Average spending per person a month by fractile class, rural and urban, ${R1}, with ${R0} as pale dots: rural from ${inr(cur(fracB, "f0_5_rural"))} in the bottom five per cent to ${inr(cur(fracB, "f95_100_rural"))} in the top; urban from ${inr(cur(fracB, "f0_5_urban"))} to ${inr(cur(fracB, "f95_100_urban"))}. The top urban class fell ${inr(topDrop)} against the previous round`,
    data: tbl(["fractile_class", `rural_${R0}`, `rural_${R1}`, `urban_${R0}`, `urban_${R1}`], FRACS.map((k, i) => [FRACLAB[i], prv(fracB, k + "_rural"), cur(fracB, k + "_rural"), prv(fracB, k + "_urban"), cur(fracB, k + "_urban")])),
    draw: (width) => K.line({
      width, freq: "year", unit: RUPEE, endFormat: fmtInr, height: width < 520 ? 320 : 460,
      xTicks: FRACLAB.map((l, i) => ({ t: String(i), label: l })).filter((_, i) => width >= 900 || (i % 2 === 0 && i !== 10) || i === 11),
      series: [
        { name: `Urban, ${R0}`, data: S("urban", 0), role: "ctx2", line: false, dots: true, label: false, hover: false },
        { name: `Rural, ${R0}`, data: S("rural", 0), role: "ctx2", line: false, dots: true, label: false, hover: false },
        { name: `Urban, ${R1}`, short: "Urban", data: S("urban", 1), role: "comp", color: URB, dots: true, hover: false },
        { name: `Rural, ${R1}`, short: "Rural", data: S("rural", 1), role: "lead", dots: true, hover: false },
      ],
      notes: [{ d: "11", v: cur(fracB, "f95_100_urban"), text: `Top 5% urban fell ${inr(topDrop)}\nbetween rounds`, side: "left" }],
    }),
  });
}

/* ---------- § 04a social groups ---------- */
const GROUPS = [["others", "Others"], ["obc", "Other Backward Class"], ["sc", "Scheduled Caste"], ["st", "Scheduled Tribe"]];
export function social() {
  const rows = GROUPS.map(([k, name]) => ({ name, b: cur(socialB, k + "_rural"), b0: prv(socialB, k + "_rural"), a: cur(socialB, k + "_urban"), a0: prv(socialB, k + "_urban") }));
  return figure({
    bare: true, file: "india-atlas_hces_social-group-mpce",
    label: `Average spending per person a month by social group, rural and urban, ${R1}, with ${R0} as pale dots and the all-India means as dotted rules: rural from ${inr(cur(socialB, "st_rural"))} for Scheduled Tribe households to ${inr(cur(socialB, "others_rural"))} for Others; urban from ${inr(cur(socialB, "sc_urban"))} for Scheduled Caste households to ${inr(cur(socialB, "others_urban"))}`,
    data: tbl(["group", `rural_${R0}`, `rural_${R1}`, `urban_${R0}`, `urban_${R1}`], GROUPS.map(([k, n]) => [n, ...both(socialB, k + "_rural"), ...both(socialB, k + "_urban")])),
    draw: (width) => K.dumbbell({ width, rows, sortBy: "none", labelAll: true, fmt: fmtInr, keys: { a: `Urban, ${R1}`, b: `Rural, ${R1}` }, aColor: URB, refs: meanRefs(M("rural"), M("urban"), inr) }),
  });
}

/* ---------- § 04b household types ---------- */
const TYPES = [
  ["regular_wage_salaried_in_non_agriculture_rural", "Rural, regular wage, non-farm"], ["others_rural", "Rural, others"],
  ["self_employed_in_non_agriculture_rural", "Rural, self-employed, non-farm"], ["self_employed_in_agriculture_rural", "Rural, self-employed, farm"],
  ["regular_wage_salaried_in_agriculture_rural", "Rural, regular wage, farm"], ["casual_labour_in_non_agriculture_rural", "Rural, casual labour, non-farm"],
  ["casual_labour_in_agriculture_rural", "Rural, casual labour, farm"], ["others_urban", "Urban, others"],
  ["regular_wage_salaried_urban", "Urban, regular wage/salaried"], ["self_employed_urban", "Urban, self-employed"], ["casual_labour_urban", "Urban, casual labour"],
];
/** one value per row across two rounds: the earlier round a pale ring, this round filled in its sector's colour */
const rounds = (b, list, rural) => list.map(([k, name]) => ({ name, a: prv(b, k), b: cur(b, k), bColor: rural(k) ? K.C.lead : URB }));
export function hhtype() {
  return figure({
    bare: true, file: "india-atlas_hces_household-type-mpce",
    label: `Average spending per person a month by household employment type, rural types then urban, ${R0} as pale rings and ${R1} filled: casual labour is the floor of both sectors, ${inr(cur(hhB, "casual_labour_in_agriculture_rural"))} for rural farm work and ${inr(cur(hhB, "casual_labour_urban"))} in towns; the top urban row is others (pension, rent or remittance households) at ${inr(cur(hhB, "others_urban"))}`,
    data: tbl(["household_type", R0, R1], TYPES.map(([k, n]) => [n, ...both(hhB, k)])),
    draw: (width) => K.dumbbell({ width, rows: rounds(hhB, TYPES, (k) => k.endsWith("_rural")), sortBy: "none", fmt: fmtInr, endText: (r) => inr(r.b),
      keys: { a: R0, b: R1 }, aColor: K.C.ctx, refs: meanRefs(M("rural"), M("urban"), inr) }),
  });
}

/* ---------- § 05 Engel's law ---------- */
const CATS13 = [["beverages_processed_food_etc", "Beverages & processed food"], ["milk_and_milk_products", "Milk & milk products"], ["conveyance", "Conveyance"],
  ["durable_goods", "Durable goods"], ["fuel_and_light", "Fuel & light"], ["vegetables", "Vegetables"], ["clothing_bedding", "Clothing & bedding"],
  ["consumer_services_excluding_conveyance", "Consumer services"], ["cereal", "Cereals"], ["egg_fish_meat", "Egg, fish & meat"],
  ["medical_non_hospitalization", "Medicine (non-hospital)"], ["education", "Education"], ["rent", "Rent"]];
export function engel() {
  const rows = CATS13.map(([k, name]) => ({ name, b: cur(catB, k + "_rural"), a: cur(catB, k + "_urban") }));
  return figure({
    bare: true, file: "india-atlas_hces_category-shares",
    label: `Share of spending by item category, rural against urban, ${R1}: beverages and processed food lead the rural rupee at ${p1(cur(catB, "beverages_processed_food_etc_rural"))}; the widest urban-rural splits are rent, ${p1(cur(catB, "rent_urban"))} urban against ${p1(cur(catB, "rent_rural"))} rural, and education, ${p1(cur(catB, "education_urban"))} against ${p1(cur(catB, "education_rural"))}`,
    data: tbl(["category", `rural_${R1}_pct`, `urban_${R1}_pct`], CATS13.map(([k, n]) => [n, cur(catB, k + "_rural"), cur(catB, k + "_urban")])),
    draw: (width) => K.dumbbell({ width, rows, sortBy: "none", labelAll: true, dp: 2, unit: { suffix: "%" }, keys: { a: "Urban", b: "Rural" }, aColor: URB }),
  });
}

/* ---------- § 05 companion: the composition shift ---------- */
const CATS29 = [["beverages_processed_food_etc", "Beverages & proc. food"], ["cereal", "Cereals"], ["cereal_substitutes", "Cereal substitutes"], ["clothing_bedding", "Clothing & bedding"],
  ["consumer_services_excluding_conveyance", "Consumer services"], ["conveyance", "Conveyance"], ["durable_goods", "Durable goods"], ["edible_oil", "Edible oil"], ["education", "Education"],
  ["egg_fish_meat", "Egg, fish & meat"], ["entertainment", "Entertainment"], ["footwear", "Footwear"], ["fruits_dry", "Fruits (dry)"], ["fruits_fresh", "Fruits (fresh)"],
  ["fuel_and_light", "Fuel & light"], ["gram", "Gram"], ["medical_hospitalization", "Medical (hospital)"], ["medical_non_hospitalization", "Medical (non-hospital)"],
  ["milk_and_milk_products", "Milk & milk products"], ["other_household_consumables", "Other consumables"], ["other_taxes_cesses", "Other taxes & cesses"],
  ["pan_tobacco_intoxicants", "Pan, tobacco & intoxicants"], ["pulses_and_pulse_products", "Pulses & pulse products"], ["rent", "Rent"], ["salt", "Salt"], ["spices", "Spices"],
  ["sugar", "Sugar"], ["toilet_articles", "Toilet articles"], ["vegetables", "Vegetables"]];
export function shift() {
  const rows = CATS29.map(([k, name]) => ({ name, b: cur(catB, k + "_rural") - prv(catB, k + "_rural"), a: cur(catB, k + "_urban") - prv(catB, k + "_urban") })).sort((p, q) => q.b - p.b)
    .map((r) => ({ ...r, bColor: Math.abs(r.b) >= 0.5 ? K.C.lead : URB }));
  const sg = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(2);
  return figure({
    bare: true, file: "india-atlas_hces_composition-shift",
    label: `Change in each category's share of spending between ${R0} and ${R1}, percentage points, rural beside urban, sorted by the rural change: from ${rows.at(-1).name} at ${sg(rows.at(-1).b)} to ${rows[0].name} at ${sg(rows[0].b)}. The food share rose, against Engel's prediction`,
    data: tbl(["category", `rural_${R0}_pct`, `rural_${R1}_pct`, "rural_change_pt", `urban_${R0}_pct`, `urban_${R1}_pct`, "urban_change_pt"],
      CATS29.map(([k, n]) => [n, prv(catB, k + "_rural"), cur(catB, k + "_rural"), +(cur(catB, k + "_rural") - prv(catB, k + "_rural")).toFixed(3), prv(catB, k + "_urban"), cur(catB, k + "_urban"), +(cur(catB, k + "_urban") - prv(catB, k + "_urban")).toFixed(3)])),
    draw: (width) => K.dumbbell({ width, rows, sortBy: "none", fmt: sg, labelAll: true, keys: { a: "Urban change", b: "Rural change" }, aColor: K.C.ctx }),
  });
}

/* ---------- § 06 cereals: kilograms and rupees ---------- */
const CROPS = [["rice", "Rice"], ["wheat", "Wheat"], ["coarse_grains", "Coarse grains"], ["total_cereals", "All cereals"]];
const cropRows = (b) => CROPS.flatMap(([k, n]) => [[`${k}_rural`, `${n}, Rural`], [`${k}_urban`, `${n}, Urban`]]);
export function plate() {
  return figure({
    bare: true, file: "india-atlas_hces_cereal-quantities",
    label: `Average monthly quantity of cereals per person by type, rural and urban, ${R0} as pale rings and ${R1} filled: rural cereals fell from ${kg2(prv(qtyB, "total_cereals_rural"))} to ${kg2(cur(qtyB, "total_cereals_rural"))} a head a month; urban held near ${kg2(cur(qtyB, "total_cereals_urban"))}`,
    data: tbl(["item", `${R0}_kg`, `${R1}_kg`, `${R0}_inr`, `${R1}_inr`], ["rice", "wheat", "coarse_grains", "other_cereals", "total_cereals"].flatMap((k) => ["rural", "urban"].map((sec) => [`${k}_${sec}`, ...both(qtyB, `${k}_${sec}`), ...both(ivB, `${k}_${sec}`)]))),
    draw: (width) => K.dumbbell({ width, rows: rounds(qtyB, cropRows(), (k) => k.endsWith("_rural")), sortBy: "none", labelAll: true, fmt: kg2, keys: { a: R0, b: R1 }, aColor: K.C.ctx }),
  });
}
export function val() {
  return figure({
    bare: true, file: "india-atlas_hces_cereal-values",
    label: `Average monthly value of cereals per person by type, rural and urban, in rupees, ${R0} as pale rings and ${R1} filled: rural cereal value rose from ${inr(prv(ivB, "total_cereals_rural"))} to ${inr(cur(ivB, "total_cereals_rural"))} even as the quantity fell`,
    data: tbl(["item", `${R0}_inr`, `${R1}_inr`], ["rice", "wheat", "coarse_grains", "other_cereals", "total_cereals"].flatMap((k) => ["rural", "urban"].map((sec) => [`${k}_${sec}`, ...both(ivB, `${k}_${sec}`)]))),
    draw: (width) => K.dumbbell({ width, rows: rounds(ivB, cropRows(), (k) => k.endsWith("_rural")), sortBy: "none", labelAll: true, fmt: fmtInr, keys: { a: R0, b: R1 }, aColor: K.C.ctx }),
  });
}

/* ---------- § 08 states ---------- */
const SHORT = { "Dadra & Nagar Haveli and Daman & Diu": "D&N Haveli, Daman & Diu" };
const pairRows = (b) => Object.keys(b.series).filter((k) => k.endsWith("_rural") && !k.includes("__")).map((k) => {
  const full = b.series[k].label.split(" · ")[0];
  return { name: SHORT[full] || full, rural: cur(b, k), urban: cur(b, k.slice(0, -6) + "_urban") };
}).sort((p, q) => q.rural - p.rural);
const ST = pairRows(statesB), FS = pairRows(foodStB);
export function states() {
  const rows = ST.map((r, i) => ({ name: r.name, b: r.rural, a: r.urban, label: i === ST.length - 1 }));
  return figure({
    bare: true, file: "india-atlas_hces_state-mpce",
    label: `Average spending per person a month by state and union territory, rural and urban, ${R1}, sorted by rural, with the all-India means as dotted rules: rural from ${inr(ST[0].rural)} in ${ST[0].name} down to ${inr(ST.at(-1).rural)} in ${ST.at(-1).name}`,
    data: tbl(["state", `rural_${R1}`, `urban_${R1}`], ST.map((r) => [r.name, r.rural, r.urban])),
    draw: (width) => K.dumbbell({ width, rows, sortBy: "none", fmt: fmtInr, keys: { a: "Urban", b: "Rural" }, aColor: URB, refs: meanRefs(M("rural"), M("urban"), inr) }),
  });
}
export function food() {
  const rows = FS.map((r, i) => ({ name: r.name, b: r.rural, a: r.urban, label: i === FS.length - 1 }));
  return figure({
    bare: true, file: "india-atlas_hces_state-food-share",
    label: `Share of spending going to food by state and union territory, rural and urban, ${R1}, sorted by the rural share, from ${p2(FS[0].rural)} in rural ${FS[0].name} down to ${p2(FS.at(-1).rural)}; the urban dot sits left of the rural in every state but Lakshadweep`,
    data: tbl(["state", `rural_food_share_${R1}_pct`, `urban_food_share_${R1}_pct`], FS.map((r) => [r.name, r.rural, r.urban])),
    draw: (width) => K.dumbbell({ width, rows, sortBy: "none", dp: 2, unit: { suffix: "%" }, from: 20, keys: { a: "Urban", b: "Rural" }, aColor: URB,
      refs: [{ value: cur(catB, "food_total_urban"), label: `all-India urban ${p2(cur(catB, "food_total_urban"))}`, side: "left" }, { value: cur(catB, "food_total_rural"), label: `all-India rural ${p2(cur(catB, "food_total_rural"))}`, side: "right" }] }),
  });
}

/* ---------- § 08c the Gini ---------- */
export function gini() {
  const G = [["rural", "Rural · headline", K.C.lead], ["rural_imputed", "Rural · with imputation", K.C.ctx], ["urban", "Urban · headline", K.C.lead], ["urban_imputed", "Urban · with imputation", K.C.ctx]];
  return figure({
    bare: true, file: "india-atlas_hces_gini",
    label: `Gini coefficient of spending per person by sector and imputation convention, ${R0} pale and ${R1} filled: rural fell from ${g3(prv(giniB, "rural"))} to ${g3(cur(giniB, "rural"))}, urban from ${g3(prv(giniB, "urban"))} to ${g3(cur(giniB, "urban"))}; the with-imputation variants sit slightly lower`,
    data: tbl(["series", R0, R1], G.map(([k, n]) => [n, ...both(giniB, k)])),
    draw: (width) => K.dumbbell({ width, rows: G.map(([k, name, c]) => ({ name, a: prv(giniB, k), b: cur(giniB, k), bColor: c })), sortBy: "none", labelAll: true, fmt: g3, from: 0.2, keys: { a: R0, b: R1 }, aColor: K.C.ctx }),
  });
}

/* ---------- § 09 spending by state, a heat table per sector ---------- */
const SHORT9 = { "Dadra & Nagar Haveli and Daman & Diu": "D&N Haveli, Daman & Diu", "Andaman & Nicobar Islands": "Andaman & Nicobar" };
const stateName = (s) => SHORT9[s] || s;
// short heads so nine columns fit a tablet; the sub and the tips say what each holds
const COLS = [["MPCE", null], ["Food", "food_total"], ["Fuel", "fuel_and_light"], ["School", "education"], ["Medicine", "medical_non_hospitalization"],
  ["Hospital", "medical_hospitalization"], ["Travel", "conveyance"], ["Durables", "durable_goods"], ["Rent", "rent"]];
const IL = inrStB.dates.length - 1;
const spendStates = (sec) => Object.keys(statesB.series).filter((k) => k.endsWith("_" + sec)).map((k) => ({ k, name: stateName(statesB.series[k].label.split(" · ")[0]), mpce: statesB.series[k].data[IL] })).filter((d) => d.mpce != null).sort((a, b) => b.mpce - a.mpce);
const spendTop = (states, cat) => states.map((st) => ({ n: st.name, v: inrStB.series[`${st.k}__${cat}`]?.data[IL] })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
function spend(sec) {
  const states = spendStates(sec);
  const rows = states.map((st) => ({ name: st.name, cells: COLS.map(([, cat]) => (cat ? inrStB.series[`${st.k}__${cat}`]?.data[IL] ?? null : st.mpce)) }));
  const span = COLS.map((_, j) => { const vs = rows.map((r) => r.cells[j]).filter((v) => v != null); return [Math.min(...vs), Math.max(...vs)]; });
  const food = spendTop(states, "food_total");
  return figure({
    bare: true, file: `india-atlas_hces_spending-by-state-${sec}`,
    label: `What a ${sec} person spends a month, by state and category, ${R1}, rupees; each column shaded on its own scale, darker for a higher figure. Highest food bill ${food[0].n}, ${inr(Math.round(food[0].v))}`,
    data: tbl(["state", ...COLS.map(([c]) => c)], rows.map((r) => [r.name, ...r.cells])),
    draw: (width) => K.heatmap({ width, rows, cols: COLS.map(([c]) => c), dp: 0, stagger: true,
      tip: (r, j, v) => `${r.name}, ${COLS[j][0]}: ${inr(v)}`,
      // within each column: its lowest state palest, its highest darkest (four steps, text stays dark)
      fillAt: (v, j) => { const [lo, hi] = span[j]; return K.C.seq[Math.round((hi > lo ? (v - lo) / (hi - lo) : 0) * 3)]; } }),
  });
}
export const spendRural = () => spend("rural");
export const spendUrban = () => spend("urban");

/* ---------- § 09 with imputation, by state ---------- */
const IMP = Object.keys(statesB.series).filter((k) => k.endsWith("_rural")).map((k) => {
  const a = statesB.series[k].data[1], b = impStB.series[k]?.data[1];
  return { name: stateName(statesB.series[k].label.split(" · ")[0]), a, b, add: b - a, pct: ((b - a) / a) * 100 };
}).filter((d) => d.a != null && d.b != null).sort((x, y) => y.pct - x.pct);
const AIPCT = ((M("rural_imputed") - M("rural")) / M("rural")) * 100;
export function impute() {
  return figure({
    bare: true, file: "india-atlas_hces_mpce-with-imputation-by-state",
    label: `Rural spending per person with free items counted, against without, by state, ${R1}: how much higher, per cent and rupees; states above the all-India figure of ${AIPCT.toFixed(1)}% in blue. ` + IMP.slice(0, 4).map((d) => `${d.name} +${d.pct.toFixed(1)}%`).join(", "),
    data: tbl(["state", "mpce_rural_without_imputation", "mpce_rural_with_imputation", "added_inr", "added_pct"], IMP.map((d) => [d.name, d.a, d.b, d.add, +d.pct.toFixed(2)])),
    draw: (width) => K.bars({ width, sort: false, dp: 1, unit: { suffix: "%" }, rows: IMP.map((d) => ({ name: d.name, value: d.pct, note: inr(d.add) })),
      ref: { value: +AIPCT.toFixed(1), label: `All-India rural ${AIPCT.toFixed(1)}%` } }),
  });
}

/* ---------- § 09 Gini by state ---------- */
const GST = Object.keys(giniStB.series).filter((k) => k.endsWith("_rural")).map((k) => ({
  name: stateName(giniStB.series[k].label.split(" · ")[0]), r: giniStB.series[k].data[1], u: giniStB.series[k.replace(/_rural$/, "_urban")]?.data[1],
})).filter((d) => d.r != null && d.u != null).sort((a, b) => b.u - a.u);
export function ginist() {
  const more = GST.filter((d) => d.u > d.r).length;
  return figure({
    bare: true, file: "india-atlas_hces_gini-by-state",
    label: `Gini of spending per person by state, rural and urban, ${R1}: urban more unequal than rural in ${more} of ${GST.length} states; highest urban ${GST[0].name}, ${g3(GST[0].u)}`,
    data: tbl(["state", "gini_urban", "gini_rural"], GST.map((d) => [d.name, d.u, d.r])),
    draw: (width) => K.dumbbell({ width, rows: GST.map((d) => ({ name: d.name, a: d.u, b: d.r })), sortBy: "none", fmt: g3, from: 0.1, endText: (r) => `${g3(r.a)} / ${g3(r.b)}`,
      keys: { a: "Urban", b: "Rural" }, aColor: URB }),
  });
}

/* ---------- the figures, register and baskets the page quotes (ids kept from the retired client) ---------- */
export function numbers() {
  const T = {};
  const ratio1 = M("urban") / M("rural"), ratio0 = prv(mpceB, "urban") / prv(mpceB, "rural");
  const c = (b, k) => cur(b, k), p = (b, k) => prv(b, k);
  T["n-rural"] = inrBig(M("rural"));
  T["n-urban"] = inrBig(M("urban"));
  T["n-ratio"] = ratio1.toFixed(2) + '<span class="pc">×</span>';
  T["n-gini"] = g3(c(giniB, "rural"));
  T["d-rural"] = `<b>${arrowPct(M("rural"), p(mpceB, "rural"))}</b> vs 2022-23`;
  T["d-urban"] = `<b>${arrowPct(M("urban"), p(mpceB, "urban"))}</b> vs 2022-23`;
  T["d-ratio"] = `<b>${arrowAbs(ratio1, ratio0, 2)}</b> vs 2022-23`;
  T["d-gini"] = `<b>${arrowAbs(c(giniB, "rural"), p(giniB, "rural"), 3)}</b> vs 2022-23`;
  T["rb-big"] = inrBig(M("rural"));
  T["rb-first"] = inrBig(M("urban"));
  // § 02 the register: two data points per series, so the history cell is the previous round's value
  const reg = (nm, sub, sw, v, d, pv) => ({ nm, sub, sw, v, d, p: pv });
  const so = (k) => [c(socialB, k), p(socialB, k)];
  const regRows = [
    reg("MPCE, rural", "₹ per person per month, without imputation", "s-acc", inr(M("rural")), arrowPct(M("rural"), p(mpceB, "rural")), inr(p(mpceB, "rural"))),
    reg("MPCE, urban", "₹ per person per month, without imputation", "s-g1", inr(M("urban")), arrowPct(M("urban"), p(mpceB, "urban")), inr(p(mpceB, "urban"))),
    reg("Urban ÷ rural", "computed from the two means", "s-g2", ratio1.toFixed(2) + "×", arrowAbs(ratio1, ratio0, 2), ratio0.toFixed(2) + "×"),
    reg("Gini, rural", "consumption, without imputation", "s-g4", g3(c(giniB, "rural")), arrowAbs(c(giniB, "rural"), p(giniB, "rural"), 3), g3(p(giniB, "rural"))),
    reg("Gini, urban", "consumption, without imputation", "s-g3", g3(c(giniB, "urban")), arrowAbs(c(giniB, "urban"), p(giniB, "urban"), 3), g3(p(giniB, "urban"))),
    reg("Bottom 5%, rural", "average MPCE of the lowest fractile class", "s-g1", inr(c(fracB, "f0_5_rural")), arrowPct(c(fracB, "f0_5_rural"), p(fracB, "f0_5_rural")), inr(p(fracB, "f0_5_rural"))),
    reg("Top 5%, urban", "average MPCE of the highest fractile: fell between rounds", "s-acc", inr(c(fracB, "f95_100_urban")), arrowPct(c(fracB, "f95_100_urban"), p(fracB, "f95_100_urban")), inr(p(fracB, "f95_100_urban"))),
    reg("MPCE, Scheduled Tribe, rural", "lowest social-group average in villages", "s-g3", inr(so("st_rural")[0]), arrowPct(...so("st_rural")), inr(so("st_rural")[1])),
    reg("Others ÷ ST, rural", "social-group gap, computed from the two means", "s-g1", (so("others_rural")[0] / so("st_rural")[0]).toFixed(2) + "×",
      arrowAbs(so("others_rural")[0] / so("st_rural")[0], so("others_rural")[1] / so("st_rural")[1], 2), (so("others_rural")[1] / so("st_rural")[1]).toFixed(2) + "×"),
    reg("MPCE, casual labour, urban", "lowest household-type average in towns", "s-g2", inr(c(hhB, "casual_labour_urban")), arrowPct(c(hhB, "casual_labour_urban"), p(hhB, "casual_labour_urban")), inr(p(hhB, "casual_labour_urban"))),
    reg("Cereals, rural quantity", "kg per person per month, all cereals", "s-g4", kg2(c(qtyB, "total_cereals_rural")), arrowPct(c(qtyB, "total_cereals_rural"), p(qtyB, "total_cereals_rural")), kg2(p(qtyB, "total_cereals_rural"))),
    reg("Food share, rural", "% of MPCE, all food categories", "s-g2", p2(c(catB, "food_total_rural")), arrowPt(c(catB, "food_total_rural"), p(catB, "food_total_rural")), p2(p(catB, "food_total_rural"))),
    reg("Food share, urban", "% of MPCE, all food categories", "s-g4", p2(c(catB, "food_total_urban")), arrowPt(c(catB, "food_total_urban"), p(catB, "food_total_urban")), p2(p(catB, "food_total_urban"))),
  ];
  T["ledger-body"] = regRows.map((r) => `
  <tr>
    <td class="name"><span class="sw ${r.sw}"></span>${r.nm}<small>${r.sub}</small></td>
    <td class="val">${r.v}</td>
    <td class="chg">${r.d}, vs 2022-23</td>
    <td class="yr">${r.p}</td>
  </tr>`).join("");
  // § 03
  const topDrop = p(fracB, "f95_100_urban") - c(fracB, "f95_100_urban"), topDropR = p(fracB, "f95_100_rural") - c(fracB, "f95_100_rural");
  T["pv-lad"] = inr(c(fracB, "f95_100_urban"));
  T["ex-lad-bot"] = inr(c(fracB, "f0_5_rural"));
  T["ex-lad-top"] = inr(c(fracB, "f95_100_urban"));
  T["ex-lad-mult"] = (c(fracB, "f95_100_urban") / c(fracB, "f0_5_rural")).toFixed(1) + "×";
  T["ex-lad-drop"] = inr(topDrop);
  T["ex-lad-rdrop"] = inr(topDropR);
  // § 04
  const mult = so("others_rural")[0] / so("st_rural")[0];
  T["pv-social"] = mult.toFixed(2) + "×";
  T["ex-so-st"] = inr(so("st_rural")[0]);
  T["ex-so-oth"] = inr(so("others_rural")[0]);
  T["ex-so-mult"] = mult.toFixed(2) + "×";
  T["ex-so-stg"] = p1(((so("st_rural")[0] - so("st_rural")[1]) / so("st_rural")[1]) * 100);
  T["ex-so-othg"] = p1(((so("others_rural")[0] - so("others_rural")[1]) / so("others_rural")[1]) * 100);
  T["ex-so-scu"] = inr(c(socialB, "sc_urban"));
  T["pv-hht"] = inr(c(hhB, "casual_labour_urban"));
  T["ex-ht-casu"] = inr(c(hhB, "casual_labour_urban"));
  T["ex-ht-um"] = inr(M("urban"));
  T["ex-ht-regnf"] = inr(c(hhB, "regular_wage_salaried_in_non_agriculture_rural"));
  T["ex-ht-ratio"] = (c(hhB, "regular_wage_salaried_urban") / c(hhB, "casual_labour_urban")).toFixed(2) + "×";
  T["ex-ht-oth"] = inr(c(hhB, "others_urban"));
  // § 05 baskets: food against non-food, one bar per sector
  const basket = (sector, segs) => [segs.map(([n, w, col]) => `<div class="seg" style="width:${w}%;background:${col}" title="${sector}, ${n}: ${w.toFixed(2)}%"></div>`).join(""),
    segs.map(([n, w, col]) => `<div class="blab"><div class="n"><span class="sw" style="background:${col}"></span>${sector}, ${n}</div><div class="w">${w.toFixed(2)}%</div></div>`).join("")];
  [T["bk-r-bar"], T["bk-r-labels"]] = basket("Rural", [["Food", c(catB, "food_total_rural"), "#2E4BD8"], ["Non-food", c(catB, "non_food_total_rural"), "#C9CED6"]]);
  [T["bk-u-bar"], T["bk-u-labels"]] = basket("Urban", [["Food", c(catB, "food_total_urban"), "#2E4BD8"], ["Non-food", c(catB, "non_food_total_urban"), "#C9CED6"]]);
  T["pv-engel"] = p2(c(catB, "food_total_rural"));
  T["ex-en-fr"] = p1(c(catB, "food_total_rural"));
  T["ex-en-fu"] = p1(c(catB, "food_total_urban"));
  T["ex-en-rent-u"] = p1(c(catB, "rent_urban"));
  T["ex-en-rent-r"] = p1(c(catB, "rent_rural"));
  T["ex-en-edu-u"] = p1(c(catB, "education_urban"));
  T["ex-en-edu-r"] = p1(c(catB, "education_rural"));
  const ap = (k) => arrowPt(c(catB, k), p(catB, k));
  T["pv-shift"] = ap("food_total_rural");
  T["ex-sh-food-r"] = ap("food_total_rural");
  T["ex-sh-food-u"] = ap("food_total_urban");
  T["ex-sh-oil"] = ap("edible_oil_rural");
  T["ex-sh-veg"] = ap("vegetables_rural");
  T["ex-sh-fuel-r"] = ap("fuel_and_light_rural");
  T["ex-sh-fuel-u"] = ap("fuel_and_light_urban");
  // § 06
  T["pv-plate"] = kg2(c(qtyB, "total_cereals_rural"));
  T["ex-q-rt1"] = kg1(c(qtyB, "total_cereals_rural"));
  T["ex-q-rt0"] = kg1(p(qtyB, "total_cereals_rural"));
  T["ex-q-ut1"] = kg1(c(qtyB, "total_cereals_urban"));
  const ivPct = p1(((c(ivB, "total_cereals_rural") - p(ivB, "total_cereals_rural")) / p(ivB, "total_cereals_rural")) * 100);
  T["ex-q-vg"] = ivPct;
  T["ex-q-vr1"] = inr(c(ivB, "total_cereals_rural"));
  T["ex-q-rice"] = kg1(c(qtyB, "rice_rural"));
  T["ex-q-wheat"] = kg1(c(qtyB, "wheat_rural"));
  T["ex-q-riced"] = kgd(c(qtyB, "rice_rural") - p(qtyB, "rice_rural"));
  T["ex-q-wheatd"] = kgd(c(qtyB, "wheat_rural") - p(qtyB, "wheat_rural"));
  T["pv-val"] = inr(c(ivB, "total_cereals_rural"));
  T["ex-v-rt1"] = inr(c(ivB, "total_cereals_rural"));
  T["ex-v-rt0"] = inr(p(ivB, "total_cereals_rural"));
  T["ex-v-pct"] = ivPct;
  // § 08
  const hi = ST[0], lo = ST.at(-1), uHi = ST.reduce((a, b) => (b.urban > a.urban ? b : a)), uLo = ST.reduce((a, b) => (b.urban < a.urban ? b : a));
  T["pv-states"] = (hi.rural / lo.rural).toFixed(2) + "×";
  T["ex-st-hi"] = inr(hi.rural);
  T["ex-st-lo"] = inr(lo.rural);
  T["ex-st-mult"] = (hi.rural / lo.rural).toFixed(1) + "×";
  T["ex-st-del"] = inr(ST.find((r) => r.name === "Delhi").rural);
  T["ex-st-urb"] = inr(M("urban"));
  T["ex-st-uhi"] = inr(uHi.urban);
  T["ex-st-ulo"] = inr(uLo.urban);
  const lk = FS.find((r) => r.name === "Lakshadweep"), bihar = FS.find((r) => r.name === "Bihar");
  T["pv-food"] = p2(FS[0].rural);
  T["ex-fs-hi"] = p1(FS[0].rural);
  T["ex-fs-lo"] = p1(FS.at(-1).rural);
  T["ex-fs-bu"] = p1(bihar.urban);
  T["ex-fs-lk"] = p1(lk.urban);
  T["ex-fs-lkr"] = p1(lk.rural);
  T["pv-gini"] = g3(c(giniB, "rural"));
  T["ex-gi-r0"] = g3(p(giniB, "rural"));
  T["ex-gi-r1"] = g3(c(giniB, "rural"));
  T["ex-gi-u0"] = g3(p(giniB, "urban"));
  T["ex-gi-u1"] = g3(c(giniB, "urban"));
  T["ex-gi-impr"] = inr(M("rural_imputed") - M("rural"));
  T["ex-gi-impu"] = inr(M("urban_imputed") - M("urban"));
  // § 09
  for (const sec of ["rural", "urban"]) {
    const states = spendStates(sec), food = spendTop(states, "food_total"), edu = spendTop(states, "education"), med = spendTop(states, "medical_non_hospitalization");
    const span2 = (r) => `highest ${r[0].n} ${inr(Math.round(r[0].v))}, lowest ${r.at(-1).n} ${inr(Math.round(r.at(-1).v))}`;
    const ai = (cat) => inr(Math.round(inrAllB.series[`all_india_${sec}__${cat}`].data[IL]));
    T[`pv-spend-${sec}`] = inr(Math.round(food[0].v));
    T[`ex-sp-${sec}-food`] = esc(span2(food));
    T[`ex-sp-${sec}-edu`] = esc(span2(edu));
    T[`ex-sp-${sec}-med`] = esc(span2(med));
    T[`ex-sp-${sec}-ai`] = ai("food_total");
    T[`ex-sp-${sec}-aiedu`] = ai("education");
    T[`ex-sp-${sec}-aimed`] = ai("medical_non_hospitalization");
  }
  T["pv-impute"] = inr(M("rural_imputed") - M("rural"));
  T["ex-imp-hi"] = esc(`${IMP[0].name}, ${inr(IMP[0].add)} (${IMP[0].pct.toFixed(1)}%)`);
  T["ex-imp-ai"] = `${inr(M("rural_imputed") - M("rural"))} (${AIPCT.toFixed(1)}%)`;
  T["ex-imp-aiu"] = inr(M("urban_imputed") - M("urban"));
  const zero = Object.keys(statesB.series).filter((k) => impStB.series[k]?.data[1] === statesB.series[k].data[1]).map((k) => k.replace(/_(rural|urban)$/, ""));
  T["ex-imp-zero"] = String(new Set(zero.filter((z) => zero.filter((x) => x === z).length === 2)).size);
  const more = GST.filter((d) => d.u > d.r).length;
  const all = GST.flatMap((d) => [{ n: `${d.name}, urban`, v: d.u }, { n: `${d.name}, rural`, v: d.r }]).sort((a, b) => b.v - a.v);
  T["pv-ginist"] = `${more} of ${GST.length}`;
  T["ex-gs-hi"] = esc(`${all[0].n}, ${g3(all[0].v)}`);
  T["ex-gs-lo"] = esc(`${all.at(-1).n}, ${g3(all.at(-1).v)}`);
  T["ex-gs-air"] = g3(c(giniB, "rural"));
  T["ex-gs-aiu"] = g3(c(giniB, "urban"));
  T["mr-rural"] = inr(M("rural"));
  T["mr-fam"] = inr(M("rural") * 5);
  T["mr-ratio"] = p1((ratio1 - 1) * 100);
  T["prov-vintage"] = mpceB.meta.vintage;
  T["prov-vintage2"] = mpceB.meta.vintage;
  return T;
}
