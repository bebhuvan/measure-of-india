// Credit guide (money, credit and banks): the plates, drawn at build time with the chart kit
// (src/kit/), and every figure the page quotes (texts()), so the page ships no bundle JSON.
// Each plate export returns a bare figure for the plate's .plotzone; the plate's title, source
// line and buttons stay in src/pages/guides/credit.astro.
// Rulers never joined across: the 2007 and 2019 sectoral classifications; series including and
// excluding the HDFC merger (July 2023); spatial statements with and without RRBs.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs as pairsR } from "../kit/data.js";
// the page quotes raw values through toFixed (the old client did), so the charts read them raw too:
// a label and the sentence beside it can never differ by a rounding step
const pairs = (b, k, o = {}) => pairsR(b, k, { ...o, round: false });
import * as fmt from "../charts/format.js";
import growthB from "../../data/series/credit-growth.json";
import sectorsB from "../../data/series/credit-sectors.json";
import sectors07B from "../../data/series/credit-sectors-2007.json";
import industryB from "../../data/series/credit-industry.json";
import ratiosB from "../../data/series/credit-scb-ratios.json";
import foodB from "../../data/series/credit-food.json";
import moneyB from "../../data/series/credit-money.json";
import moneyGB from "../../data/series/credit-money-growth.json";
import mratiosB from "../../data/series/credit-money-ratios.json";
import depthB from "../../data/series/credit-depth.json";
import npaB from "../../data/series/credit-npa.json";
import npaMoveB from "../../data/series/credit-npa-movement.json";
import crarB from "../../data/series/credit-crar.json";
import fraudB from "../../data/series/credit-frauds.json";
import stCdB from "../../data/series/credit-states-cd-annual.json";
import utilB from "../../data/series/credit-utilisation.json";
import stAnnB from "../../data/series/credit-states-annual.json";
import placesB from "../../data/series/credit-places.json";
import womenB from "../../data/series/credit-women.json";
import ratesB from "../../data/series/credit-lending-rates.json";
import sizeB from "../../data/series/credit-size.json";
import nbfcB from "../../data/series/credit-nbfc.json";
import cpiB from "../../data/series/cpi-2024-linked.json";

const PCT = { suffix: "%" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const dayOf = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fyOf = (iso) => `${+iso.slice(0, 4) - 1}-${iso.slice(2, 4)}`;
const pc = (u) => `<span class="pc">${u}</span>`;
const lastOf = (b, k) => { const d = b.series[k].data; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, d: b.dates[i] }; return null; };
const at = (b, k, iso) => b.series[k]?.data[b.dates.indexOf(iso)] ?? null;
const yearsAgo = (iso, n) => `${+iso.slice(0, 4) - n}${iso.slice(4)}`;
const G = growthB, S = sectorsB;

/* ------------------------------------------------------------------ the rows the plates share */
const ROWS_WHO = [
  ["agriculture", "Agriculture"], ["industry_micro_small", "Industry: micro and small"], ["industry_medium", "Industry: medium"], ["industry_large", "Industry: large"],
  ["nbfcs", "Services: NBFCs"], ["trade", "Services: trade"], ["commercial_real_estate", "Services: commercial real estate"], ["other_services_all", "Services: everything else"],
  ["housing", "Personal: housing"], ["vehicle_loans", "Personal: vehicles"], ["gold_loans", "Personal: gold loans"], ["credit_cards", "Personal: credit cards"], ["other_personal_all", "Personal: everything else"],
];
function whoRows() {
  const iL = S.dates.length - 1, iY = S.dates.indexOf(yearsAgo(S.dates[iL], 1));
  const v = (k, i) => {
    if (k === "other_services_all") return S.series.services.data[i] - S.series.nbfcs.data[i] - S.series.trade.data[i] - S.series.commercial_real_estate.data[i];
    if (k === "other_personal_all") return S.series.personal_loans.data[i] - ["housing", "vehicle_loans", "gold_loans", "credit_cards"].reduce((a, c) => a + S.series[c].data[i], 0);
    return S.series[k].data[i];
  };
  const tot = (i) => ["agriculture", "industry", "services", "personal_loans"].reduce((a, k) => a + S.series[k].data[i], 0);
  return { iL, iY, rows: ROWS_WHO.map(([k, name]) => ({ k, name, v: (100 * v(k, iL)) / tot(iL), y: iY >= 0 ? (100 * v(k, iY)) / tot(iY) : null, amt: v(k, iL) })) };
}
const shareOf = (B, k) => B.dates.map((d, i) => { const t = ["agriculture", "industry", "services", "personal_loans"].reduce((a, c) => a + (B.series[c].data[i] ?? NaN), 0); const v = B.series[k].data[i]; return [d, v == null || !Number.isFinite(t) ? null : (100 * v) / t]; });

const FAST = [["agriculture", "Agriculture"], ["industry_micro_small", "Industry: micro and small"], ["industry_medium", "Industry: medium"], ["industry_large", "Industry: large"], ["nbfcs", "Services: NBFCs"], ["trade", "Services: trade"],
  ["commercial_real_estate", "Services: commercial real estate"], ["housing", "Personal: housing"], ["vehicle_loans", "Personal: vehicles"], ["gold_loans", "Personal: gold loans"], ["credit_cards", "Personal: credit cards"],
  ["education", "Personal: education"], ["consumer_durables", "Personal: consumer durables"], ["other_personal_loans", "Personal: other personal loans"]];
function fastRows() {
  const iL = G.dates.length - 1;
  return { iL, head: G.series.headline.data[iL], rows: FAST.map(([k, name]) => ({ k, name, v: G.series[k].data[iL], y: at(G, k, yearsAgo(G.dates[iL], 1)) })).sort((a, b) => b.v - a.v) };
}
const COST = [["personal_credit_cards_rate", "Credit cards"], ["consumer_durables_rate", "Consumer durables"], ["other_personal_loans_rate", "Other personal loans"], ["agriculture_rate", "Agriculture"], ["transport_operators_rate", "Transport operators"],
  ["vehicles_rate", "Vehicles"], ["trade_rate", "Trade"], ["education_rate", "Education"], ["professional_and_other_services_rate", "Professional services"], ["industry_rate", "Industry"], ["housing_rate", "Housing"], ["finance_rate", "Finance"]];
function costRows() {
  const R = ratesB, L = R.dates.length - 1;
  return { L, all: R.series.total_credit_rate.data[L], rows: COST.map(([k, name]) => ({ k, name, v: R.series[k].data[L], y: at(R, k, yearsAgo(R.dates[L], 1)) })) };
}
const BANDS = [["25_000_and_less", "₹25,000 or less"], ["above_rs_25_000_and_up_to_rs_2_lakh", "₹25,000 to ₹2 lakh"], ["above_rs_2_lakh_and_up_to_rs_5_lakh", "₹2 to 5 lakh"], ["above_rs_5_lakh_and_up_to_rs_10_lakh", "₹5 to 10 lakh"],
  ["above_rs_10_lakh_and_up_to_rs_25_lakh", "₹10 to 25 lakh"], ["above_rs_25_lakh_and_up_to_rs_50_lakh", "₹25 to 50 lakh"], ["above_rs_50_lakh_and_up_to_rs_1_crore", "₹50 lakh to ₹1 crore"], ["above_rs_1_crore_and_up_to_rs_4_crore", "₹1 to 4 crore"],
  ["above_rs_4_crore_and_up_to_rs_6_crore", "₹4 to 6 crore"], ["above_rs_6_crore_and_up_to_rs_10_crore", "₹6 to 10 crore"], ["above_rs_10_crore_and_up_to_rs_25_crore", "₹10 to 25 crore"], ["above_rs_25_crore_and_up_to_rs_100_crore", "₹25 to 100 crore"], ["above_rs_100_crore", "Above ₹100 crore"]];
function sizeRows() {
  const Z = sizeB, L = Z.dates.length - 1;
  const tA = Z.series.total_credit_amount.data[L], tN = Z.series.total_credit_accounts.data[L];
  return { L, tN, rows: BANDS.map(([k, name]) => ({ name, v: (100 * Z.series[k + "_amount"].data[L]) / tA, n: (100 * Z.series[k + "_accounts"].data[L]) / tN, k })) };
}
const IND_TOP = ["infrastructure", "basic_metal_and_metal_product", "chemicals_and_chemical_products", "all_engineering", "food_processing", "textiles", "construction", "vehicles_vehicle_parts_and_transport_equipment", "petroleum_coal_products_and_nuclear_fuels",
  "rubber_plastic_and_their_products", "gems_and_jewellery", "cement_and_cement_products", "mining_and_quarrying", "paper_and_paper_products", "beverage_and_tobacco", "leather_and_leather_products", "wood_and_wood_products", "glass_and_glassware", "other_industries"];
const IND_NAME = { basic_metal_and_metal_product: "Basic metals and metal products", chemicals_and_chemical_products: "Chemicals", all_engineering: "Engineering", vehicles_vehicle_parts_and_transport_equipment: "Vehicles and parts", petroleum_coal_products_and_nuclear_fuels: "Petroleum and coal products",
  rubber_plastic_and_their_products: "Rubber and plastics", gems_and_jewellery: "Gems and jewellery", cement_and_cement_products: "Cement", mining_and_quarrying: "Mining", paper_and_paper_products: "Paper", beverage_and_tobacco: "Beverages and tobacco", leather_and_leather_products: "Leather", wood_and_wood_products: "Wood", glass_and_glassware: "Glass", other_industries: "Other industries", food_processing: "Food processing" };
function industryRows() {
  const B = industryB, L = B.dates.length - 1, Y = B.dates.indexOf(yearsAgo(B.dates[L], 1));
  const tot = B.series.industry_total.data[L];
  return { L, tot, rows: IND_TOP.filter((k) => B.series[k]).map((k) => ({ k, name: IND_NAME[k] ?? B.series[k].label, v: (100 * B.series[k].data[L]) / tot, g: Y >= 0 && B.series[k].data[Y] ? 100 * (B.series[k].data[L] / B.series[k].data[Y] - 1) : null, amt: B.series[k].data[L] })).sort((a, b) => b.v - a.v) };
}
const NBFC = [["retail_loans", "Retail loans, all"], ["housing_loans", "Retail: housing"], ["vehicle_loans", "Retail: vehicles"], ["loans_against_gold_jewellery", "Retail: gold loans"], ["industry", "Industry, all"], ["infrastructure", "Industry: infrastructure"], ["services", "Services"], ["other_loans", "Other loans"], ["agriculture_and_allied_activities", "Agriculture"]];
function nbfcRows() {
  const N = nbfcB, L = N.dates.length - 1, tot = N.series.nbfc_credit.data[L];
  return { L, tot, rows: NBFC.filter(([k]) => N.series[k]).map(([k, name]) => ({ k, name, v: N.series[k].data[L], s: (100 * N.series[k].data[L]) / tot })) };
}
function stateRows() {
  const C = stCdB, L = C.dates.length - 1, U = utilB, A = stAnnB;
  const rows = Object.keys(C.series).filter((k) => k !== "all_india").map((k) => {
    const dep = A.series[`${k}_deposits`]?.data[L], used = U.series[`${k}_utilised`]?.data[0];
    return { k, name: C.series[k].label.replace(/, credit-deposit ratio$/, ""), v: C.series[k].data[L], u: dep && used != null && U.dates[0] === C.dates[L] ? (100 * used) / dep : null, dep };
  }).filter((r) => r.v != null && r.dep >= 1).sort((a, b) => b.v - a.v);
  return { L, all: C.series.all_india.data[L], rows };
}
const POP = [["rural", "Rural"], ["semi_urban", "Semi-urban"], ["urban", "Urban"], ["metro", "Metropolitan"]];
function popRows() {
  const P = placesB, L = P.dates.length - 1;
  const tD = POP.reduce((a, [k]) => a + P.series[k + "_deposits"].data[L], 0), tC = POP.reduce((a, [k]) => a + P.series[k + "_credit"].data[L], 0);
  return { L, rows: POP.map(([k, name]) => ({ k, name, v: (100 * P.series[k + "_credit"].data[L]) / tC, d: (100 * P.series[k + "_deposits"].data[L]) / tD, cd: (100 * P.series[k + "_credit"].data[L]) / P.series[k + "_deposits"].data[L] })) };
}
function womenRows() {
  const B = womenB, L = B.dates.length - 1;
  const rows = Object.keys(B.series).filter((k) => k.endsWith("_women_share") && k !== "all_india_women_share")
    .map((k) => ({ k, name: B.series[k].label.replace(/, women's share of bank credit to individuals$/, ""), v: B.series[k].data[L], amt: B.series[k.replace("_women_share", "_individuals_amount")].data[L] }))
    .filter((r) => r.v != null && r.amt >= 0.2).sort((a, b) => b.v - a.v);
  return { L, rows, all: B.series.all_india_women_share.data[L], all0: B.series.all_india_women_share.data[0] };
}
const peak = (b, k, from = "") => b.series[k].data.reduce((p, v, i) => (v != null && b.dates[i] >= from && v > p.v ? { v, d: b.dates[i] } : p), { v: -1e9 });

/* ------------------------------------------------------------------ every figure the page quotes */
/** id -> HTML, exactly what the old client set into each element. */
export function texts() {
  const T = {};
  const gL = lastOf(G, "headline"), gDate = G.dates.at(-1), gPrevYear = at(G, "headline", yearsAgo(gDate, 1));
  const nf = lastOf(S, "non_food_credit").v, pers = lastOf(S, "personal_loans").v;
  const m3 = lastOf(moneyGB, "m3_incl_merger"), npaL = lastOf(npaB, "all_gnpa_ratio");
  const npaPeak = npaB.series.all_gnpa_ratio.data.reduce((p, v, i) => (npaB.dates[i] >= "2010-01-01" && v > p.v ? { v, d: npaB.dates[i] } : p), { v: -1 });
  Object.assign(T, {
    "m-latest": monthOf(gDate), "u-reading": `RBI, sectoral deployment of bank credit, ${monthOf(gDate)}`,
    "n-growth": gL.v.toFixed(1) + pc("%"), "d-growth": `<b>${fmt.pct1(gPrevYear)}</b> a year earlier`,
    "n-pers": ((100 * pers) / nf).toFixed(1) + pc("%"), "d-pers": `<b>${fmt.lc1(pers)}</b> in personal loans`,
    "n-m3": m3.v.toFixed(1) + pc("%"), "d-m3": `broad money, ${dayOf(m3.d)}`,
    "n-npa": npaL.v.toFixed(1) + pc("%"), "d-npa": `<b>${npaPeak.v.toFixed(1)}%</b> at the peak, March ${npaPeak.d.slice(0, 4)}`,
    "rb-growth": gL.v.toFixed(1) + pc("%"), "rb-stock": "₹" + lastOf(S, "bank_credit").v.toFixed(1) + pc(" lakh crore"),
  });
  { // growth
    const R = ratiosB, cg = lastOf(R, "credit_growth"), dg = lastOf(R, "deposits_growth");
    let lo = null;
    R.dates.forEach((d, i) => { const v = R.series.credit_growth.data[i]; if (v == null || d < "2011-01-01") return; if (!lo || v < lo.v) lo = { v, d }; });
    const exMax = R.series.credit_growth_ex_merger.data.reduce((p, v, i) => (v != null && v > p.v ? { v, d: R.dates[i] } : p), { v: -1 });
    Object.assign(T, { "pv-growth": fmt.pct1(cg.v), "ex-g-credit": fmt.pct1(cg.v), "ex-g-dep": fmt.pct1(dg.v), "ex-g-date": dayOf(cg.d), "ex-g-lo": fmt.pct1(lo.v), "ex-g-lo-d": monthOf(lo.d), "ex-g-exmax": fmt.pct1(exMax.v), "ex-g-exmax-d": monthOf(exMax.d) });
    const c = lastOf(R, "credit_deposit_ratio"), c0 = R.series.credit_deposit_ratio.data[0];
    Object.assign(T, { "pv-cd": fmt.pct1(c.v), "ex-cd-now": fmt.pct1(c.v), "ex-cd-0": fmt.pct1(c0), "ex-cd-0d": monthOf(R.dates[0]), "ex-cd-inv": fmt.pct1(lastOf(R, "investment_deposit_ratio").v) });
  }
  { const B = depthB, c = lastOf(B, "credit_to_gdp"), dep = lastOf(B, "aggregate_deposits_to_gdp");
    Object.assign(T, { "pv-depth": fmt.pct1(c.v), "ex-dp-c": fmt.pct1(c.v), "ex-dp-d": fmt.pct1(dep.v), "ex-dp-c0": fmt.pct1(B.series.credit_to_gdp.data[0]), "ex-dp-c91": fmt.pct1(at(B, "credit_to_gdp", "1991-03-01")) }); }
  { const { iL, iY, rows } = whoRows(), top = rows.reduce((p, r) => (r.v > p.v ? r : p));
    const share = (k) => rows.find((r) => r.k === k).v.toFixed(1) + "%";
    const grp = (ks) => rows.filter((r) => ks.includes(r.k)).reduce((a, r) => a + r.v, 0).toFixed(1) + "%";
    Object.assign(T, { "pv-who": top.v.toFixed(1) + "%", "lg-who": monthOf(S.dates[iL]), "lg-who-y": monthOf(S.dates[iY]),
      "ex-w-pers": grp(["housing", "vehicle_loans", "gold_loans", "credit_cards", "other_personal_all"]), "ex-w-ind": grp(["industry_micro_small", "industry_medium", "industry_large"]),
      "ex-w-serv": grp(["nbfcs", "trade", "commercial_real_estate", "other_services_all"]), "ex-w-agri": share("agriculture"), "ex-w-house": share("housing"), "ex-w-nbfc": share("nbfcs"), "ex-w-large": share("industry_large") }); }
  { const v = (B, k) => shareOf(B, k).filter((p) => p[1] != null);
    const p07 = v(sectors07B, "personal_loans")[0][1], i07 = v(sectors07B, "industry")[0][1], ps = v(S, "personal_loans"), is = v(S, "industry");
    const cross = ps.find((p, i) => p[1] > is[i][1]);
    Object.assign(T, { "pv-mix": fmt.pct1(ps.at(-1)[1]), "ex-mx-p07": fmt.pct1(p07), "ex-mx-i07": fmt.pct1(i07), "ex-mx-p": fmt.pct1(ps.at(-1)[1]), "ex-mx-i": fmt.pct1(is.at(-1)[1]), "ex-mx-s": fmt.pct1(v(S, "services").at(-1)[1]), "ex-mx-cross": cross ? monthOf(cross[0]) : "not yet" }); }
  { const { iL, head, rows } = fastRows(), strip = (n) => n.replace(/^Personal: |^Services: |^Industry: /, "");
    Object.assign(T, { "pv-fast": fmt.pct1(rows[0].v), "lg-fast": monthOf(G.dates[iL]), "lg-fast-y": monthOf(yearsAgo(G.dates[iL], 1)),
      "ex-f-top": strip(rows[0].name).replace(/^\w/, (c) => c.toUpperCase()), "ex-f-topv": fmt.pct1(rows[0].v), "ex-f-low": strip(rows.at(-1).name), "ex-f-lowv": fmt.pct1(rows.at(-1).v),
      "ex-f-head": fmt.pct1(head), "ex-f-n": String(rows.filter((r) => r.v > head).length), "ex-f-of": String(rows.length) }); }
  { const gold = lastOf(G, "gold_loans"), cards = lastOf(G, "credit_cards"), house = lastOf(G, "housing"), cardsPeak = peak(G, "credit_cards", "2021-01-01");
    Object.assign(T, { "pv-personal": fmt.pct1(lastOf(G, "personal_loans").v), "ex-p-gold": fmt.pct1(gold.v), "ex-p-cards": fmt.pct1(cards.v), "ex-p-house": fmt.pct1(house.v), "ex-p-date": monthOf(gold.d),
      "ex-p-cardspk": fmt.pct1(cardsPeak.v), "ex-p-cardspkd": monthOf(cardsPeak.d), "ex-p-goldamt": fmt.lc1(lastOf(S, "gold_loans").v) }); }
  { const { L, all, rows } = costRows(), R = ratesB, f = (k) => fmt.pct1(rows.find((r) => r.k === k).v);
    Object.assign(T, { "pv-cost": fmt.pct1(all), "lg-cost": monthOf(R.dates[L]), "lg-cost-y": monthOf(yearsAgo(R.dates[L], 1)), "ex-c-card": fmt.pct1(rows[0].v), "ex-c-house": f("housing_rate"), "ex-c-all": fmt.pct1(all), "ex-c-date": monthOf(R.dates[L]), "ex-c-agri": f("agriculture_rate"), "ex-c-ind": f("industry_rate") }); }
  { const { L, tN, rows } = sizeRows(), small = rows.slice(0, 2), big = rows.at(-1);
    Object.assign(T, { "pv-size": fmt.pct1(big.v), "ex-z-smalln": fmt.pct1(small.reduce((a, r) => a + r.n, 0)), "ex-z-smallv": fmt.pct1(small.reduce((a, r) => a + r.v, 0)),
      "ex-z-bigv": fmt.pct1(big.v), "ex-z-bign": big.n < 0.01 ? "less than 0.01%" : fmt.pct2(big.n), "ex-z-date": monthOf(sizeB.dates[L]), "ex-z-accts": (tN / 100).toFixed(1) }); }
  { const mse = lastOf(G, "industry_micro_small"), med = lastOf(G, "industry_medium"), lg = lastOf(G, "industry_large"), medPeak = peak(G, "industry_medium");
    Object.assign(T, { "pv-ind": fmt.pct1(lastOf(G, "industry").v), "ex-i-mse": fmt.pct1(mse.v), "ex-i-med": fmt.pct1(med.v), "ex-i-lg": fmt.pct1(lg.v), "ex-i-date": monthOf(mse.d), "ex-i-medpk": fmt.pct1(medPeak.v), "ex-i-medpkd": monthOf(medPeak.d) }); }
  { const B = industryB, { L, tot, rows } = industryRows(), infra = rows.find((r) => r.k === "infrastructure");
    const fastest = rows.filter((r) => r.g != null && r.amt >= 0.5).sort((a, b) => b.g - a.g)[0];
    Object.assign(T, { "pv-industries": fmt.pct1(infra.v), "ex-in-infra": fmt.pct1(infra.v), "ex-in-power": fmt.pct1((100 * B.series.power.data[L]) / tot), "ex-in-roads": fmt.pct1((100 * B.series.roads.data[L]) / tot),
      "ex-in-fast": fastest.name.toLowerCase(), "ex-in-fastg": fmt.pct1(fastest.g), "ex-in-date": monthOf(B.dates[L]) }); }
  { const { L, tot, rows } = nbfcRows();
    Object.assign(T, { "pv-nbfc": fmt.lc1(tot), "ex-n-tot": fmt.lc1(tot), "ex-n-date": monthOf(nbfcB.dates[L]), "ex-n-retail": fmt.pct1(rows.find((r) => r.k === "retail_loans").s), "ex-n-bank": fmt.lc1(lastOf(S, "nbfcs").v), "ex-n-bankg": fmt.pct1(lastOf(G, "nbfcs").v) }); }
  { const F = foodB, L = lastOf(F, "food_credit"), share = lastOf(F, "food_share"), pk = peak(F, "food_credit");
    const y = L.d.slice(0, 4), yr0 = F.dates.map((d, i) => [d, F.series.food_credit.data[i]]).filter(([d, v]) => d.startsWith(y) && v != null);
    const lo = yr0.reduce((p, c) => (c[1] < p[1] ? c : p)), hi = yr0.reduce((p, c) => (c[1] > p[1] ? c : p));
    const lc2 = (v) => "₹" + v.toFixed(2) + " lakh crore";
    Object.assign(T, { "pv-food": "₹" + L.v.toFixed(2) + " lakh cr", "ex-fd-now": lc2(L.v), "ex-fd-date": dayOf(L.d), "ex-fd-share": fmt.pct1(share.v), "ex-fd-pk": lc2(pk.v), "ex-fd-pkd": dayOf(pk.d),
      "ex-fd-lo": lc2(lo[1]), "ex-fd-lod": dayOf(lo[0]), "ex-fd-hi": lc2(hi[1]), "ex-fd-hid": dayOf(hi[0]) }); }
  { const M = moneyGB, m = lastOf(M, "m3_incl_merger"), c = lastOf(cpiB, "headline");
    Object.assign(T, { "pv-m3": fmt.pct1(m.v), "ex-m-m3": fmt.pct1(m.v), "ex-m-m3d": dayOf(m.d), "ex-m-cpi": fmt.pct1(c.v), "ex-m-cpid": monthOf(c.d), "ex-m-m1": fmt.pct1(lastOf(M, "m1").v), "ex-m-cur": fmt.pct1(lastOf(M, "currency_with_public").v) }); }
  { const R = mratiosB, v = lastOf(R, "velocity_m3"), v0 = R.series.velocity_m3.data[0], mm = lastOf(R, "m3_multiplier");
    Object.assign(T, { "pv-velocity": fmt.x2(v.v), "ex-v-now": fmt.x2(v.v), "ex-v-0": fmt.x2(v0), "ex-v-mm": fmt.x2(mm.v), "ex-v-yr": `${+v.d.slice(0, 4) - 1}-${v.d.slice(2, 4)}` }); }
  { const M = moneyGB, c = lastOf(M, "currency_share_m3"), { pre, low } = cashPoints();
    Object.assign(T, { "pv-currency": fmt.pct1(c.v), "ex-cu-now": fmt.pct1(c.v), "ex-cu-pre": fmt.pct1(pre.v), "ex-cu-low": fmt.pct1(low.v), "ex-cu-lowd": dayOf(low.d), "ex-cu-amt": fmt.lc1(lastOf(moneyB, "currency_with_public").v) }); }
  { const { L, all, rows } = stateRows(), hi = rows[0], lo = rows.at(-1), C = stCdB, f = (k) => rows.find((r) => r.k === k);
    const mh = f("maharashtra"), bh = f("bihar"), up = f("uttar_pradesh");
    Object.assign(T, { "pv-states": fmt.pct1(all), "ex-s-all": fmt.pct1(all), "ex-s-hi": hi.name, "ex-s-hiv": hi.v.toFixed(0) + "%", "ex-s-lo": lo.name, "ex-s-lov": lo.v.toFixed(0) + "%",
      "ex-s-n": String(rows.filter((r) => r.v < all).length), "ex-s-of": String(rows.length), "ex-s-date": `March ${C.dates[L].slice(0, 4)}`,
      "ex-s-mh": mh.v.toFixed(0) + "%", "ex-s-mhu": mh.u.toFixed(0) + "%", "ex-s-bh": bh.v.toFixed(0) + "%", "ex-s-bhu": bh.u.toFixed(0) + "%", "ex-s-up": up.v.toFixed(0) + "%", "ex-s-n100": String(rows.filter((r) => r.v > 100).length) }); }
  { const { L, rows } = popRows(), metro = rows.find((r) => r.k === "metro"), rural = rows.find((r) => r.k === "rural");
    Object.assign(T, { "pv-pop": fmt.pct1(metro.v), "ex-pp-mc": fmt.pct1(metro.v), "ex-pp-md": fmt.pct1(metro.d), "ex-pp-rc": fmt.pct1(rural.v), "ex-pp-rd": fmt.pct1(rural.d), "ex-pp-rcd": rural.cd.toFixed(0) + "%", "ex-pp-mcd": metro.cd.toFixed(0) + "%", "ex-pp-date": monthOf(placesB.dates[L]) }); }
  { const B = womenB, { L, rows, all, all0 } = womenRows();
    Object.assign(T, { "pv-women": fmt.pct1(all), "ex-wo-all": fmt.pct1(all), "ex-wo-0": fmt.pct1(all0), "ex-wo-0d": monthOf(B.dates[0]), "ex-wo-date": monthOf(B.dates[L]),
      "ex-wo-hi": rows[0].name, "ex-wo-hiv": fmt.pct1(rows[0].v), "ex-wo-lo": rows.at(-1).name, "ex-wo-lov": fmt.pct1(rows.at(-1).v), "ex-wo-acc": fmt.pct1(B.series.all_india_women_accounts_share.data[L]) }); }
  { const N = npaB, a = lastOf(N, "all_gnpa_ratio"), p = lastOf(N, "public_gnpa_ratio"), pkA = peak(N, "all_gnpa_ratio", "2010-01-01"), pkP = peak(N, "public_gnpa_ratio", "2010-01-01");
    Object.assign(T, { "pv-npa": fmt.pct1(a.v), "ex-np-all": fmt.pct1(a.v), "ex-np-pub": fmt.pct1(p.v), "ex-np-pk": fmt.pct1(pkA.v), "ex-np-pkd": `March ${pkA.d.slice(0, 4)}`, "ex-np-pkp": fmt.pct1(pkP.v),
      "ex-np-net": fmt.pct1(lastOf(N, "all_nnpa_ratio").v), "ex-np-yr": `March ${a.d.slice(0, 4)}`, "ex-np-97": fmt.pct1(N.series.all_gnpa_ratio.data[0]) }); }
  { const M = npaMoveB, L = M.dates.length - 1, pkAdd = M.series.all_gross_additions.data.reduce((b, v, i) => (v > b.v ? { v, d: M.dates[i] } : b), { v: -1 });
    const wo = M.series.all_gross_write_offs.data.reduce((a, v, i) => (M.dates[i] >= "2016-03-01" ? a + v : a), 0);
    Object.assign(T, { "pv-npaflow": fmt.lc1(wo), "ex-nf-pk": fmt.lc1(pkAdd.v), "ex-nf-pkd": fyOf(pkAdd.d), "ex-nf-wo": fmt.lc1(wo), "ex-nf-yr": fyOf(M.dates[L]),
      "ex-nf-add": fmt.lc1(M.series.all_gross_additions.data[L]), "ex-nf-red": fmt.lc1(M.series.all_gross_reductions.data[L]), "ex-nf-wol": fmt.lc1(M.series.all_gross_write_offs.data[L]), "ex-nf-close": fmt.lc1(M.series.all_gross_closing.data[L]) }); }
  { const C = crarB, L = C.dates.length - 1, n10 = C.series.all_above_10.data[L], b910 = C.series.all_between_9_10.data[L], b9 = C.series.all_below_9.data[L];
    const pk = C.series.all_below_minimum.data.reduce((b, v, i) => (v != null && C.dates[i] >= "2010-01-01" && v > b.v ? { v, d: C.dates[i] } : b), { v: -1 });
    Object.assign(T, { "ex-cr-n": String(n10 + b910 + b9), "ex-cr-b9": b9 === 0 ? "None" : String(b9), "ex-cr-yr": `March ${C.dates[L].slice(0, 4)}`, "ex-cr-pk": String(pk.v), "ex-cr-pkd": `March ${pk.d.slice(0, 4)}` }); }
  { const F = fraudB, L = F.dates.length - 1, pk = F.series.total_amount.data.reduce((b, v, i) => (v > b.v ? { v, d: F.dates[i] } : b), { v: -1 });
    const tot = F.series.total_amount.data[L];
    Object.assign(T, { "pv-frauds": "₹" + fmt.inr(tot) + " crore", "ex-fr-amt": "₹" + fmt.inr(tot) + " crore", "ex-fr-yr": fyOf(F.dates[L]),
      "ex-fr-adv": fmt.pct1((100 * F.series.advances_amount.data[L]) / tot), "ex-fr-cards": fmt.pct1((100 * F.series.card_internet_cases.data[L]) / F.series.total_cases.data[L]),
      "ex-fr-n": fmt.inr(F.series.total_cases.data[L]), "ex-fr-pk": "₹" + fmt.inr(pk.v) + " crore", "ex-fr-pkd": fyOf(pk.d), "ex-fr-cardamt": fmt.pct1((100 * F.series.card_internet_amount.data[L]) / tot) }); }
  T["prov-vintage"] = T["prov-vintage2"] = growthB.meta.vintage;
  return T;
}
function cashPoints() {
  const M = moneyGB; let pre = null, low = null;
  M.dates.forEach((d, i) => { const v = M.series.currency_share_m3.data[i]; if (v == null) return; if (d < "2016-11-08") pre = { v, d }; if (d >= "2016-11-08" && d < "2017-12-31" && (!low || v < low.v)) low = { v, d }; });
  return { pre, low };
}

/* ------------------------------------------------------------------ plates */
const csv = (cols, rows) => ({ cols, rows });
const seriesData = (list) => {
  const keys = [...new Set(list.flatMap(([b]) => b.dates))].sort();
  return csv(["Date", ...list.map(([, k, name]) => name ?? k)], keys.map((d) => [d, ...list.map(([b, k]) => at(b, k, d))]));
};
const fy = (d) => fyOf(d);

/** §04 credit and deposit growth, fortnightly since 1998; the merger-adjusted credit drawn pale beside the published one. */
export function growth() {
  const R = ratiosB;
  const credit = pairs(R, "credit_growth"), exM = pairs(R, "credit_growth_ex_merger").filter((p) => p[1] != null), dep = pairs(R, "deposits_growth");
  const exMax = exM.reduce((p, c) => (c[1] > p[1] ? c : p));
  return figure({
    bare: true, file: "india-atlas_bank-credit-growth",
    label: "Growth of bank credit and deposits on a year earlier, every fortnight since 1998, with credit excluding the HDFC merger drawn pale from 2021 to 2025",
    data: seriesData([[R, "credit_growth"], [R, "credit_growth_ex_merger"], [R, "deposits_growth"], [R, "deposits_growth_ex_merger"]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Deposits", data: dep, role: "comp", color: K.C.turmeric },
        { name: "Bank credit, excluding the merger", data: exM, role: "lead", color: K.C.leadSoft, label: false },
        { name: "Bank credit", data: credit, role: "lead" },
      ],
      events: [{ t: "2023-07-01", label: "HDFC merger, July 2023", short: "HDFC merger", side: "left" }],
      notes: width < 520 ? [] : [{ d: exMax[0], v: exMax[1], text: `Excluding the merger\npeak ${K.num(exMax[1], { dp: 1, suffix: "%" })}`, side: "left" }],
    }),
  });
}

/** §04 credit-deposit and investment-deposit ratios, fortnightly since 1997. */
export function cd() {
  const R = ratiosB;
  return figure({
    bare: true, file: "india-atlas_credit-deposit-ratio",
    label: "Credit and SLR investments as a share of deposits, all scheduled commercial banks, every fortnight since June 1997",
    data: seriesData([[R, "credit_deposit_ratio"], [R, "investment_deposit_ratio"], [R, "cash_deposit_ratio"]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Investment-deposit ratio", short: "Investments", data: pairs(R, "investment_deposit_ratio"), role: "ctx" },
        { name: "Credit-deposit ratio", short: "Credit", data: pairs(R, "credit_deposit_ratio"), role: "lead" },
      ],
    }),
  });
}

/** §04 credit and deposits as a share of GDP since 1950-51. */
export function depth() {
  const B = depthB;
  return figure({
    bare: true, file: "india-atlas_bank-credit-share-of-gdp",
    label: "Bank credit and deposits as a share of GDP, every financial year since 1950-51",
    data: seriesData([[B, "credit_to_gdp"], [B, "aggregate_deposits_to_gdp"], [B, "investments_in_government_securities_to_gdp"]]),
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1,
      series: [
        { name: "Deposits", data: pairs(B, "aggregate_deposits_to_gdp"), role: "ctx" },
        { name: "Bank credit", data: pairs(B, "credit_to_gdp"), role: "lead" },
      ],
      events: [{ t: "1969-07-01", label: "Banks nationalised, 1969", short: "Nationalisation" }, { t: "1991-07-01", label: "Reforms, 1991", short: "1991" }],
    }),
  });
}

/** §05 who borrows: each borrower's share now (bars) and a year earlier (circles). */
export function who() {
  const { iL, iY, rows } = whoRows();
  return figure({
    bare: true, file: "india-atlas_who-borrows",
    label: "Share of bank credit by borrower, latest month as bars and a year earlier as circles: " + rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "),
    data: csv(["Borrower", `Share ${S.dates[iL]} (%)`, `Share ${S.dates[iY]} (%)`, `Amount ${S.dates[iL]} (₹ lakh crore)`], rows.map((r) => [r.name, +r.v.toFixed(2), r.y == null ? null : +r.y.toFixed(2), +r.amt.toFixed(3)])),
    draw: (width) => K.bars({ width, unit: PCT, sort: false, markName: "a year earlier", rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.y, highlight: r.k === "housing" })) }),
  });
}

/** §05 the four sectors' shares since 2007, the 2007 and 2019 classifications drawn apart. */
export function mix() {
  const KEYS = [["agriculture", "Agriculture", "ctx", K.C.ctx2], ["services", "Services", "ctx", K.C.ctx2], ["industry", "Industry", "comp", K.C.compTint], ["personal_loans", "Personal loans", "lead", K.C.leadTint]];
  const rows = [...sectors07B.dates.map((d) => ["2007 format", d, ...["agriculture", "industry", "services", "personal_loans", "non_food_credit"].map((k) => at(sectors07B, k, d))]), ...S.dates.map((d) => ["2019 format", d, ...["agriculture", "industry", "services", "personal_loans", "non_food_credit"].map((k) => at(S, k, d))])];
  return figure({
    bare: true, file: "india-atlas_bank-credit-by-sector",
    label: "Shares of bank credit to agriculture, industry, services and personal loans, monthly since April 2007; the old classification drawn pale to " + sectors07B.dates.at(-1).slice(0, 4) + ", the current one solid from " + S.dates[0].slice(0, 4) + ", never joined",
    data: csv(["Classification", "Month", "Agriculture", "Industry", "Services", "Personal loans", "Non-food credit (₹ lakh crore)"], rows),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, zero: true,
      series: [
        ...KEYS.map(([k, n, , tint]) => ({ name: n + ", 2007 classification", data: shareOf(sectors07B, k), role: "ctx", color: tint, label: false })),
        ...KEYS.map(([k, n, role]) => ({ name: n, data: shareOf(S, k), role })),
      ],
      seam: { t: "2019-01-01", before: "2007 classification", after: "2019 classification" },
    }),
  });
}

/** §05 growth by kind of borrower now (bars) and a year before (circles), against bank credit as a whole. */
export function fast() {
  const { iL, head, rows } = fastRows();
  return figure({
    bare: true, file: "india-atlas_bank-credit-growth-by-sector",
    label: "Growth of bank credit on a year earlier by kind of borrower, latest month as bars and a year before as circles, against all bank credit: " + rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "),
    data: csv(["Sector", `Growth ${G.dates[iL]} (%)`, `Growth ${yearsAgo(G.dates[iL], 1)} (%)`], rows.map((r) => [r.name, r.v, r.y])),
    draw: (width) => K.bars({ width, unit: PCT, markName: "a year before", markFmt: (v) => K.num(v, { dp: 1, suffix: "% a year before" }), ref: { value: head, label: `All bank credit ${K.num(head, { dp: 1, suffix: "%" })}` }, rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.y })) }),
  });
}

/** §06 five kinds of personal loan, growth since 2020, a panel each on its own scale. */
export function personal() {
  const KEYS = [["gold_loans", "Gold loans"], ["housing", "Housing"], ["vehicle_loans", "Vehicles"], ["credit_cards", "Credit cards"], ["other_personal_loans", "Other personal loans"]];
  return figure({
    bare: true, file: "india-atlas_personal-loan-growth",
    label: "Growth of five kinds of personal loan on a year earlier, monthly since January 2020, each panel on its own scale: " + KEYS.map(([k, n]) => `${n} ${fmt.pct1(lastOf(G, k).v)}`).join(", "),
    data: seriesData(KEYS.map(([k, n]) => [G, k, n])),
    draw: (width) => K.multiples({ width, unit: PCT, shared: false, cols: width < 520 ? 2 : width < 1000 ? 3 : 5,
      panels: KEYS.map(([k, n]) => ({ name: n, data: pairs(G, k), highlight: k === "gold_loans" || k === "credit_cards" })) }),
  });
}

/** §06 what loans cost, by purpose: the rate now (bars) and a year earlier (circles). */
export function cost() {
  const { L, all, rows } = costRows(), R = ratesB;
  return figure({
    bare: true, file: "india-atlas_lending-rates-by-purpose",
    label: "Weighted average interest rate on outstanding bank loans by purpose, latest quarter as bars and a year earlier as circles: " + rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "),
    data: seriesData(COST.map(([k, n]) => [R, k, n]).concat([[R, "total_credit_rate", "All loans"]])),
    draw: (width) => K.bars({ width, unit: PCT, markName: "a year earlier", ref: { value: all, label: `All loans ${K.num(all, { dp: 1, suffix: "%" })}` }, refFill: false,
      rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.y, highlight: r.k === "personal_credit_cards_rate" })) }),
  });
}

/** §06 loans by size of limit: share of the money (bars) and of accounts (circles). */
export function size() {
  const { L, rows } = sizeRows(), Z = sizeB;
  return figure({
    bare: true, file: "india-atlas_bank-loans-by-size",
    label: "Bank loans by size of credit limit, share of all the money lent as bars and of all loan accounts as circles: " + rows.map((r) => `${r.name}: ${r.v.toFixed(1)}% of the money, ${r.n.toFixed(1)}% of accounts`).join("; "),
    data: csv(["Credit limit", "Share of amount (%)", "Share of accounts (%)", "Amount (₹ lakh crore)", "Accounts (lakh)"], rows.map((r) => [r.name, +r.v.toFixed(3), +r.n.toFixed(3), Z.series[r.k + "_amount"].data[L], Z.series[r.k + "_accounts"].data[L]])),
    draw: (width) => K.bars({ width, unit: PCT, sort: false, markName: "share of accounts", markFmt: (v) => K.num(v, { dp: 1, suffix: "% of accounts" }),
      rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.n, highlight: r.k === "above_rs_100_crore" })) }),
  });
}

/** §07 industry credit growth by size of firm since 2020. */
export function ind() {
  return figure({
    bare: true, file: "india-atlas_industry-credit-growth-by-size",
    label: "Growth of bank credit to industry on a year earlier by size of firm, micro and small, medium and large, monthly since January 2020",
    data: seriesData([[G, "industry_micro_small"], [G, "industry_medium"], [G, "industry_large"], [G, "industry"]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Large", data: pairs(G, "industry_large"), role: "ctx" },
        { name: "Medium", data: pairs(G, "industry_medium"), role: "comp" },
        { name: "Micro and small", data: pairs(G, "industry_micro_small"), role: "lead" },
      ],
      events: [{ t: "2020-07-01", label: "MSME limits widened, July 2020", short: "MSME limits widened" }],
    }),
  });
}

/** §07 bank credit to industry, by industry. */
export function industries() {
  const { rows } = industryRows();
  return figure({
    bare: true, file: "india-atlas_bank-credit-by-industry",
    label: "Share of bank credit to industry by industry: " + rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "),
    data: csv(["Industry", "Share of industry credit (%)", "Growth on a year earlier (%)", "Amount (₹ lakh crore)"], rows.map((r) => [r.name, +r.v.toFixed(2), r.g == null ? null : +r.g.toFixed(2), r.amt])),
    draw: (width) => K.bars({ width, unit: PCT, rows: rows.map((r) => ({ name: r.name, value: r.v, highlight: r.k === "infrastructure" })) }),
  });
}

/** §07 what NBFCs lend for, ₹ lakh crore. */
export function nbfc() {
  const { rows } = nbfcRows();
  return figure({
    bare: true, file: "india-atlas_nbfc-credit-by-sector",
    label: "Credit given by selected NBFCs and housing finance companies by sector, ₹ lakh crore: " + rows.map((r) => `${r.name} ₹${r.v.toFixed(1)} lakh crore`).join(", "),
    data: csv(["Sector", "Amount (₹ lakh crore)", "Share (%)"], rows.map((r) => [r.name, r.v, +r.s.toFixed(2)])),
    draw: (width) => K.bars({ width, unit: { prefix: "₹", suffix: " lakh cr" }, sort: false, rows: rows.map((r) => ({ name: r.name, value: r.v, highlight: r.k === "retail_loans" })) }),
  });
}

/** §08 food credit, fortnightly since 1993. */
export function food() {
  const F = foodB, P = pairs(F, "food_credit"), pk = P.filter((p) => p[1] != null).reduce((a, b) => (b[1] > a[1] ? b : a));
  return figure({
    bare: true, file: "india-atlas_food-credit",
    label: "Bank loans to the Food Corporation of India and state agencies, ₹ lakh crore, every reporting fortnight since January 1993",
    data: seriesData([[F, "food_credit", "Food credit (₹ lakh crore)"], [F, "food_share", "Share of bank credit (%)"]]),
    draw: (width) => K.line({
      width, freq: "month", unit: { prefix: "₹", suffix: " lakh cr" }, hoverDp: 2,
      endFormat: (v) => "₹" + v.toFixed(2) + (width < 520 ? "" : " lakh cr"),
      series: [{ name: "Food credit", data: P, role: "lead" }],
      notes: width < 520 ? [] : [{ d: pk[0], v: pk[1], text: `Highest, ${monthOf(pk[0])}\n₹${pk[1].toFixed(2)} lakh crore`, side: "left" }],
    }),
  });
}

/** §09 M3 growth (two rulers, never joined) against CPI inflation, since 2013. */
export function m3() {
  const M = moneyGB;
  const cpi = pairs(cpiB, "headline", { from: "2013-01-01" }), old = pairs(M, "m3", { from: "2013-01-01" }).filter((p) => p[1] != null), now = pairs(M, "m3_incl_merger").filter((p) => p[1] != null);
  return figure({
    bare: true, file: "india-atlas_money-growth-and-inflation",
    label: "Growth of broad money (M3) on a year earlier, every fortnight, excluding the HDFC merger to June 2025 and including it from July 2024, against consumer price inflation, since 2013",
    data: seriesData([[M, "m3"], [M, "m3_incl_merger"], [M, "m1"], [cpiB, "headline", "cpi_inflation_2024_base_linked"]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Consumer prices", data: cpi, role: "comp", color: K.C.turmeric },
        { name: "M3, excluding the merger", data: old, role: "lead", color: K.C.leadSoft, label: false },
        { name: "M3, with merger", short: "M3", data: now, role: "lead" },
      ],
      notes: width < 520 ? [] : [{ d: old.at(-1)[0], v: old.at(-1)[1], text: "M3 excluding the merger\nends June 2025", side: "left", below: true }],
    }),
  });
}

/** §09 cash with the public as a share of M3, with demonetisation marked. */
export function currency() {
  const M = moneyGB, { low } = cashPoints();
  return figure({
    bare: true, file: "india-atlas_cash-share-of-money",
    label: "Currency with the public as a share of broad money, every reporting fortnight since 2001, with demonetisation in November 2016 marked",
    data: seriesData([[M, "currency_share_m3"], [moneyB, "currency_with_public", "currency_with_public_inr_lakh_crore"]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, zero: true,
      series: [{ name: "Cash with the public", data: pairs(M, "currency_share_m3"), role: "lead" }],
      events: [{ t: "2016-11-08", label: "Demonetisation, Nov 2016", short: "Demonetisation" }],
      notes: [{ d: low.d, v: low.v, text: `Lowest after it\n${K.num(low.v, { dp: 1, suffix: "%" })}, ${monthOf(low.d)}`, below: true }],
    }),
  });
}

/** §09 velocity of money and the money multiplier since 1951-52. */
export function velocity() {
  const R = mratiosB;
  return figure({
    bare: true, file: "india-atlas_velocity-of-money",
    label: "GDP over broad money (velocity) and broad money over reserve money (the money multiplier), every financial year since 1951-52",
    data: seriesData([[R, "velocity_m3"], [R, "m3_multiplier"], [R, "currency_to_deposits"]]),
    draw: (width) => K.line({
      width, freq: "year", unit: { suffix: "×" }, endDp: 2, hoverDp: 2, zero: true,
      series: [
        { name: "M3 over reserve money", short: "Multiplier", data: pairs(R, "m3_multiplier"), role: "ctx" },
        { name: "GDP over M3", short: "Velocity", data: pairs(R, "velocity_m3"), role: "lead" },
      ],
    }),
  });
}

/** §10 credit-deposit ratio by state: by place of sanction (bars) and of use (circles). */
export function states() {
  const { all, rows } = stateRows();
  return figure({
    bare: true, file: "india-atlas_credit-deposit-ratio-by-state",
    label: "Credit-deposit ratio by state, credit by place of sanction as bars and by place of use as circles: " + rows.map((r) => `${r.name} ${r.v.toFixed(0)}%`).join(", "),
    data: csv(["State", "Credit-deposit ratio by sanction (%)", "Credit-deposit ratio by utilisation (%)", "Deposits (₹ lakh crore)"], rows.map((r) => [r.name, r.v, r.u == null ? null : +r.u.toFixed(2), r.dep])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 0, markName: "by place of use", ref: { value: all, label: `All India ${K.num(all, { dp: 1, suffix: "%" })}` },
      rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.u })) }),
  });
}

/** §10 credit and deposits by population group of the branch. */
export function pop() {
  const { rows } = popRows();
  return figure({
    bare: true, file: "india-atlas_credit-by-population-group",
    label: "Share of all bank credit as bars and of all deposits as circles, by population group of the branch: " + rows.map((r) => `${r.name}: ${r.v.toFixed(1)}% of credit, ${r.d.toFixed(1)}% of deposits`).join("; "),
    data: csv(["Population group", "Share of credit (%)", "Share of deposits (%)", "Credit-deposit ratio (%)"], rows.map((r) => [r.name, +r.v.toFixed(2), +r.d.toFixed(2), +r.cd.toFixed(2)])),
    draw: (width) => K.bars({ width, unit: PCT, sort: false, markName: "share of deposits", markFmt: (v) => K.num(v, { dp: 1, suffix: "% of deposits" }),
      rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.d, highlight: r.k === "metro" })) }),
  });
}

/** §10 women's share of bank credit to individuals, by state. */
export function women() {
  const { all, rows } = womenRows();
  return figure({
    bare: true, file: "india-atlas_womens-share-of-credit-by-state",
    label: "Women's share of bank loans to individuals by state, against the all-India share: " + rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", "),
    data: csv(["State", "Women's share of credit to individuals (%)", "Credit to individuals (₹ lakh crore)"], rows.map((r) => [r.name, r.v, r.amt])),
    draw: (width) => K.bars({ width, unit: PCT, ref: { value: all, label: `All India ${K.num(all, { dp: 1, suffix: "%" })}` },
      rows: rows.map((r) => ({ name: r.name, value: r.v })) }),
  });
}

/** §11 gross NPA ratio by bank group since 1997. */
export function npa() {
  const N = npaB;
  return figure({
    bare: true, file: "india-atlas_gross-npa-ratio-by-bank-group",
    label: "Gross NPAs as a share of gross advances by bank group, as on 31 March each year since 1997: all banks, public sector, private (from 2014) and foreign banks",
    data: seriesData([[N, "all_gnpa_ratio"], [N, "public_gnpa_ratio"], [N, "private_old_gnpa_ratio"], [N, "private_new_gnpa_ratio", "private_new_to_2013_all_private_from_2014_gnpa_ratio"], [N, "foreign_gnpa_ratio"], [N, "small_finance_gnpa_ratio"], [N, "all_nnpa_ratio"]]),
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1,
      series: [
        { name: "Foreign banks", short: "Foreign", data: pairs(N, "foreign_gnpa_ratio"), role: "ctx2" },
        { name: "Private banks", short: "Private", data: pairs(N, "private_new_gnpa_ratio", { from: "2014-03-01" }), role: "ctx" },
        { name: "Public sector banks", short: "Public", data: pairs(N, "public_gnpa_ratio"), role: "comp" },
        { name: "All banks", short: "All", data: pairs(N, "all_gnpa_ratio"), role: "lead" },
      ],
    }),
  });
}

/** §11 bad loans added, recovered and written off each year since 2004-05. */
export function npaflow() {
  const M = npaMoveB, P = (k) => pairs(M, k).map(([d, v]) => [d.slice(0, 4), v]);
  return figure({
    bare: true, file: "india-atlas_npa-movement",
    label: "Gross NPAs of all scheduled commercial banks added, recovered or upgraded, and written off, ₹ lakh crore, every financial year since 2004-05",
    data: seriesData([[M, "all_gross_opening"], [M, "all_gross_additions"], [M, "all_gross_reductions"], [M, "all_gross_write_offs"], [M, "all_gross_closing"]]),
    draw: (width) => K.line({
      width, freq: "year", unit: { prefix: "₹", suffix: " lakh cr" }, endDp: 1,
      series: [
        { name: "Recovered or upgraded", short: "Recovered", data: P("all_gross_reductions"), role: "ctx" },
        { name: "Written off", data: P("all_gross_write_offs"), role: "comp" },
        { name: "Added (new bad loans)", short: "Added", data: P("all_gross_additions"), role: "lead" },
      ],
    }),
  });
}

/** §11 frauds by amount, loans and everything else, each financial year since 2004-05. */
export function frauds() {
  const F = fraudB, k1 = (v) => (v == null ? null : Math.round(v / 100) / 10);
  const loans = F.dates.map((d, i) => [d.slice(0, 4), k1(F.series.advances_amount.data[i])]);
  const rest = F.dates.map((d, i) => [d.slice(0, 4), k1(F.series.total_amount.data[i] - F.series.advances_amount.data[i])]);
  return figure({
    bare: true, file: "india-atlas_bank-frauds",
    label: "Amount involved in frauds reported by banks, ₹ thousand crore, loan frauds and everything else, by year of reporting since 2004-05",
    data: seriesData(Object.keys(F.series).map((k) => [F, k])),
    draw: (width) => K.line({
      width, freq: "year", unit: { prefix: "₹", suffix: " thousand cr" }, endDp: 1, height: width < 520 ? 360 : width < 1000 ? 380 : undefined,
      endFormat: (v) => "₹" + K.num(v, { dp: 1 }) + (width < 520 ? "" : " thousand cr"),
      series: [
        { name: "Everything else", short: "Everything else", data: rest, role: "ctx" },
        { name: "Loan frauds", short: "Loans", data: loans, role: "lead" },
      ],
    }),
  });
}
