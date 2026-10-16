// Services guide: the plates, drawn at build time with the chart kit (src/kit/). Each plate
// export returns a bare figure for the plate's .plotzone; titles, source lines and buttons stay
// in src/pages/guides/services.astro, which also reads the shared data below for its numbers.
// Rates are rounded once, at the published precision (roundRates, as the old client did); the
// large survey and BoP bundles are read raw, as before.
import fs from "node:fs";
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import { roundRates } from "./precision.js";
import share22_raw from "../../data/series/services-gva-2022-share.json";
import growth22_raw from "../../data/series/services-gva-2022-growth.json";
import share11_raw from "../../data/series/services-gva-2011-share.json";
import gdpInd_raw from "../../data/series/gdp-2022-industries.json";
import ispGrowth_raw from "../../data/series/services-isp-growth.json";
import ispAnnual_raw from "../../data/series/services-isp-annual.json";
import tradeM_raw from "../../data/series/services-trade-monthly.json";
import bopA_raw from "../../data/series/services-bop-annual.json";

const load = (slug) => JSON.parse(fs.readFileSync(`data/series/${slug}.json`, "utf8"));
export const share22 = roundRates(share22_raw), growth22 = roundRates(growth22_raw), share11 = roundRates(share11_raw);
export const gdpInd = roundRates(gdpInd_raw), ispGrowth = roundRates(ispGrowth_raw), ispAnnual = roundRates(ispAnnual_raw);
export const tradeM = roundRates(tradeM_raw), bopA = roundRates(bopA_raw);
export const bopQ = load("services-bop-quarterly"), invQ = load("services-invisibles-quarterly");
export const jobsCy = load("services-jobs-cy25"), jobsAy = load("services-jobs-ay");
export const asuse = load("services-asuse"), asuseProfile = load("services-asuse-profile");

const { C } = K;
const PCT = { suffix: "%" }, USD = { prefix: "$", suffix: " bn" };
export const lastIdx = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
export const fyOf = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const f1 = (v) => K.num(v, { dp: 1 });

/* ---------- § 02 the mix: each service sub-industry's share of GVA ---------- */
const MIX_GROUPS = [
  ["Trade, hotels, transport and communication", C.ink2, ["trade_repair", "hotels_restaurants", "road_transport", "railways", "transport_services", "storage", "air_transport", "water_transport", "communication"]],
  ["Finance, real estate and professional services", C.lead, ["realty_prof", "finance"]],
  ["Public administration and other services", C.ctx, ["other_services", "public_admin"]],
];
const MIX_NAME = { trade_repair: "Trade and repair", hotels_restaurants: "Hotels and restaurants", road_transport: "Road transport", railways: "Railways", transport_services: "Transport services",
  storage: "Storage", air_transport: "Air transport", water_transport: "Water transport", communication: "Communication", realty_prof: "Real estate, professional", finance: "Financial services",
  other_services: "Education, health, personal", public_admin: "Public administration" };
export const iSub = lastIdx(share22.series.trade_repair.data);
export function mix() {
  const SH = share22.series, fy = fyOf(share22.dates[iSub]);
  const rows = MIX_GROUPS.flatMap(([g, color, ks]) => ks.map((k) => ({ group: g, name: MIX_NAME[k], value: SH[k].data[iSub], color }))).filter((r) => r.value != null);
  return figure({
    bare: true, file: "india-atlas_services-by-industry-share-of-gva",
    label: `Thirteen service sub-industries ranked by their share of India's gross value added in ${fy}; real estate and professional services are the largest`,
    data: { cols: ["Group", "Industry", "Share of GVA, %", "Year"], rows: rows.map((r) => [r.group, r.name, r.value, fy]) },
    draw: (width) => K.bars({ width, rows, unit: PCT, dp: 1 }),
  });
}

/* ---------- § 03 two rulers of services' share of GVA ---------- */
export function long() {
  const old = pairs(share11, "services"), neu = pairs(share22, "services");
  return figure({
    bare: true, file: "india-atlas_services-share-of-gva-two-bases",
    label: "Services' share of gross value added, financial years, on the 2011-12 base and, separately, the 2022-23 base; the two series are never joined",
    data: { cols: ["Year starting", "Base", "Services share of GVA, %"], rows: [...old.map(([d, v]) => [d, "2011-12", v]), ...neu.map(([d, v]) => [d, "2022-23", v])].filter((r) => r[2] != null) },
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1, zero: false,
      series: [
        { name: "2011-12 base", data: old, role: "ctx", color: C.leadTint },
        { name: "2022-23 base", data: neu, role: "lead" },
      ],
      events: [{ t: "2022-04-01", label: "2022-23 base begins", short: "New base", side: "left" }],
    }),
  });
}

/* ---------- § 03 real growth by sub-industry, the two latest years ---------- */
const GR_NAME = { trade_repair: "Trade and repair", hotels_restaurants: "Hotels and restaurants", railways: "Railways", road_transport: "Road transport", water_transport: "Water transport", air_transport: "Air transport",
  transport_services: "Services incidental to transport", storage: "Storage", communication: "Communication and broadcasting", finance: "Financial services", realty_prof: "Real estate, dwellings, professional",
  public_admin: "Public administration and defence", other_services: "Other services" };
export const gr = (() => {
  const G = growth22.series, i1 = lastIdx(G.trade_repair.data), i0 = i1 - 1;
  const rows = Object.keys(GR_NAME).map((k) => ({ k, label: GR_NAME[k], a: G[k].data[i0], b: G[k].data[i1] })).filter((r) => r.a != null && r.b != null).sort((p, q) => q.b - p.b);
  return { i0, i1, rows, tot: { a: G.services.data[i0], b: G.services.data[i1] } };
})();
export function growth() {
  const { i0, i1, rows, tot } = gr, ya = fyOf(growth22.dates[i0]), yb = fyOf(growth22.dates[i1]);
  return figure({
    bare: true, file: "india-atlas_services-real-growth-by-sub-industry",
    label: `Real growth of each service sub-industry in ${ya} and ${yb}, an arrow from the earlier year to the later, against all services at ${f1(tot.b)}%`,
    data: { cols: ["Sub-industry", `Real growth ${ya}, %`, `Real growth ${yb}, %`], rows: rows.map((r) => [r.label, r.a, r.b]) },
    draw: (width) => K.arrows({ width, rows: rows.map((r) => ({ name: r.label, from: r.a, to: r.b })), from: ya, to: yb, unit: PCT, ref: { value: tot.b, label: `All services ${f1(tot.b)}%` } }),
  });
}

/* ---------- § 03 quarterly real growth of the three service groups ---------- */
const Q_KEYS = [["finance_realty", "lead", "Finance, real estate, professional", "Finance"], ["trade_transport", "ctx", "Trade, hotels, transport", "Trade"], ["public_admin", "ctx2", "Public administration, other", "Public"]];
export function quarter() {
  const series = Q_KEYS.map(([k, role, name, short]) => ({ name, short, role, data: pairs(gdpInd, k) }));
  return figure({
    bare: true, file: "india-atlas_services-groups-quarterly-real-growth",
    label: "Quarterly real growth of the three service groups over the same quarter a year earlier, 2022-23 base",
    draw: (width) => K.line({ width, freq: "quarter", unit: PCT, endDp: 1, series }),
  });
}

/* ---------- § 04 trial ISP: the latest month, by sub-sector ---------- */
const ISP_NAME = { "Professional, scientific & technical services including R & D": "Professional, scientific, technical", "Warehousing and support activities for transportation": "Warehousing, transport support",
  "Administrative and support services": "Administrative and support", "Arts, Entertainment and Recreation": "Arts and recreation", "IT & computer related services": "IT and computer services" };
const ispName = (l) => ISP_NAME[l.trim().replace(/\s+/g, " ")] ?? l.trim().replace(/\s+/g, " ");
export const ispLatest = Object.values(ispGrowth.series).map((s) => ({ label: s.label, v: s.data.at(-1) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
export function isp() {
  const months = ispGrowth.dates, m = K.tlabel(months.at(-1), "month");
  return figure({
    bare: true, file: "india-atlas_isp-growth-by-sub-sector",
    label: `Trial Index of Services Production, growth over a year earlier by sub-sector in ${m}, ranked, with a rule at 10%`,
    data: { cols: ["Sub-sector", ...months.map((d) => `${d.slice(0, 7)} y/y, %`)], rows: Object.values(ispGrowth.series).map((s) => [s.label, ...s.data]) },
    draw: (width) => K.bars({ width, rows: ispLatest.map((d) => ({ name: ispName(d.label), value: d.v, color: d.v >= 10 ? C.lead : d.v < 0 ? C.compTint : C.leadTint })), unit: PCT, dp: 1, ref: { value: 10, label: "10%" } }),
  });
}
export function ispa() {
  const fy = fyOf(ispAnnual.dates.at(-1));
  const rows = Object.values(ispAnnual.series).map((s) => ({ name: ispName(s.label), value: s.data.at(-1) == null ? null : Math.round((s.data.at(-1) - 100) * 10) / 10 }))
    .filter((r) => r.value != null);
  return figure({
    bare: true, file: "india-atlas_isp-annual-growth",
    label: `Trial Index of Services Production, ${fy} against the base year 2024-25, as growth by sub-sector`,
    data: { cols: ["Sub-sector", `Index ${fy}, 2024-25 = 100`], rows: Object.values(ispAnnual.series).map((s) => [s.label, s.data.at(-1)]) },
    // the title's subjects: the three fastest, and any that shrank
    draw: (width) => K.bars({ width, rows: rows.sort((a, b) => b.value - a.value).map((r, i) => ({ ...r, highlight: i < 3 || r.value < 0 })), unit: PCT, dp: 1 }),
  });
}

/* ---------- § 05 seventy-five years of services trade, log scale ---------- */
const bnAuto = (v) => "$" + (Math.abs(v) >= 100 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)) + " bn";
export function tradeLong() {
  const toBn = (k) => pairs(bopA, k).map(([d, v]) => [d, v != null && v > 0 ? v / 1000 : null]);
  const sw = toBn("s1_2_1_5_1_credit"), i0 = sw.findIndex((p) => p[1] != null);
  const keys = ["s1_2_1_credit", "s1_2_1_debit", "s1_2_1_net", "s1_2_1_5_1_credit", "s1_1_credit"];
  return figure({
    bare: true, file: "india-atlas_services-trade-since-1950",
    label: "India's services exports and imports, and software exports from 1997-98, US$ billion a year since 1950-51, on a logarithmic scale",
    data: { cols: ["Year starting", ...keys.map((k) => bopA.series[k].name)], rows: bopA.dates.map((d, i) => [d, ...keys.map((k) => bopA.series[k].data[i])]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: USD, log: true, endFormat: bnAuto, hoverDp: 1,
      series: [
        { name: "of which software", short: "Software", data: sw.slice(i0), role: "ctx" },
        { name: "Services imports", short: "Imports", data: toBn("s1_2_1_debit"), role: "comp" },
        { name: "Services exports", short: "Exports", data: toBn("s1_2_1_credit"), role: "lead" },
      ],
    }),
  });
}
export function monthly() {
  const T = tradeM.series;
  return figure({
    bare: true, file: "india-atlas_services-trade-monthly",
    label: "India's services exports and imports, US$ billion a month, as first published by the RBI",
    data: { cols: ["Month", "Exports, US$ bn", "Imports, US$ bn", "Net, US$ bn"], rows: tradeM.dates.map((d, i) => [d.slice(0, 7), T.exports.data[i], T.imports.data[i], T.net.data[i]]) },
    draw: (width) => K.line({
      width, freq: "month", unit: USD, endDp: 1,
      series: [{ name: "Imports", data: pairs(tradeM, "imports"), role: "comp" }, { name: "Exports", data: pairs(tradeM, "exports"), role: "lead" }],
    }),
  });
}

/* ---------- § 05 the BPM6 categories, four latest quarters ---------- */
const CAT_NAME = { 9: "Telecom, computer and information", 10: "Other business services", 3: "Transport", 4: "Travel", 7: "Financial services", 5: "Construction", 11: "Personal, cultural, recreational", 6: "Insurance and pension",
  8: "Charges for intellectual property", 1: "Manufacturing on others' inputs", 2: "Maintenance and repair", 12: "Government, n.i.e.", 13: "Others, n.i.e." };
export const cat = (() => {
  const S = bopQ.series, n = bopQ.dates.length, from = bopQ.dates[n - 4], to = bopQ.dates.at(-1);
  const sum4 = (k) => S[k].data.slice(-4).reduce((a, v) => a + (v ?? 0), 0) / 1000;
  const rows = Object.entries(CAT_NAME).map(([c, l]) => ({ label: l, c: +c, exp: sum4(`1_a_b_${c}_credit`), imp: sum4(`1_a_b_${c}_debit`) })).sort((a, b) => b.exp - a.exp);
  return { from, to, rows, total: sum4("1_a_b_credit") };
})();
export function cats() {
  const { from, to, rows } = cat;
  return figure({
    bare: true, file: "india-atlas_services-trade-by-category",
    label: "Services exports and imports by BPM6 category over the four latest quarters, US$ billion; telecom, computer and information services and other business services lead exports",
    data: { cols: ["Category", "Exports, US$ bn, 4 quarters", "Imports, US$ bn, 4 quarters", "From quarter", "To quarter"], rows: rows.map((r) => [r.label, +r.exp.toFixed(3), +r.imp.toFixed(3), from, to]) },
    draw: (width) => K.dumbbell({ width, rows: rows.map((r) => ({ name: r.label, a: r.imp, b: r.exp, highlight: r.c === 9 || r.c === 10 })), keys: { a: "Imports", b: "Exports" }, unit: { suffix: " bn" }, dp: 1 }),
  });
}

/* ---------- § 05 business services receipts by purpose ---------- */
export function gcc() {
  const K3 = [["r68", "ctx2", "Technical and trade-related services", "Technical"], ["r57", "ctx", "Research and development", "R&D"], ["r60", "lead", "Professional and management consulting", "Consulting"]];
  const S = invQ.series, keys = ["r41", "r56", "r57", "r60", "r63", "r68"];
  return figure({
    bare: true, file: "india-atlas_business-services-receipts-by-purpose",
    label: "Quarterly receipts for professional and management consulting, technical and trade-related services, and research and development, US$ billion",
    data: { cols: ["Quarter starting", ...keys.map((k) => S[k].name)], rows: invQ.dates.map((d, i) => [d, ...keys.map((k) => S[k].data[i])]) },
    draw: (width) => K.line({
      width, freq: "quarter", unit: USD, endDp: 1,
      series: K3.map(([k, role, name, short]) => ({ name, short, role, data: pairs(invQ, k, { round: false }).map(([d, v]) => [d, v == null ? null : v / 1000]) })),
    }),
  });
}

/* ---------- § 06 who does the work ---------- */
const SECTIONS = { g: "Trade and vehicle repair", h: "Transport and storage", i: "Hotels and restaurants", j: "Information and communication", k: "Finance and insurance", l: "Real estate", m: "Professional, scientific, technical", n: "Administrative and support",
  o: "Public administration and defence", p: "Education", q: "Health and social work", r: "Arts and recreation", s: "Other personal services", t: "Households as employers (domestic work)", u: "International bodies" };
const JOBS_NAME = { t: "Domestic work", m: "Professional, technical", o: "Public administration" };
export const jb = (() => {
  const JC = jobsCy.series, y1 = jobsCy.dates.length - 1;
  const rows = Object.entries(SECTIONS).map(([c, l]) => ({ c, label: l, b: JC[`sec_${c}__person_all_ps`]?.data[y1], f: JC[`sec_${c}__female_all_ps`]?.data[y1], m: JC[`sec_${c}__male_all_ps`]?.data[y1] }))
    .filter((r) => r.b != null && r.c !== "u").sort((p, q) => q.b - p.b);
  return { rows, svc: rows.reduce((a, r) => a + r.b, 0), y: jobsCy.dates.at(-1).slice(0, 4) };
})();
export function jobs() {
  const { rows, y } = jb;
  return figure({
    bare: true, file: "india-atlas_service-workers-by-industry",
    label: `Share of women workers and of men workers in each service industry, ${y}, sorted by the share of all workers; rows where women's share is higher are marked`,
    data: { cols: ["NIC section", "Industry", `Persons ${y}, %`, `Women ${y}, %`, `Men ${y}, %`], rows: rows.map((r) => [r.c.toUpperCase(), r.label, r.b, r.f, r.m]) },
    draw: (width) => K.dumbbell({ width, rows: rows.filter((r) => r.f != null && r.m != null).map((r) => ({ name: JOBS_NAME[r.c] ?? r.label, a: r.f, b: r.m, v: r.b, highlight: r.f > r.m })), keys: { a: "Women", b: "Men" }, sortBy: "v", unit: PCT, dp: 1 }),
  });
}
export const WHO = [["male", "rural", "Men, rural"], ["female", "rural", "Women, rural"], ["male", "urban", "Men, urban"], ["female", "urban", "Women, urban"], ["person", "all", "Everyone"]];
export const who = (() => {
  const JC = jobsCy.series, i = jobsCy.dates.length - 1;
  return Object.fromEntries(WHO.map(([g, s, l]) => [l, JC[`tertiary__${g}_${s}_cws`]?.data[i] ?? null]));
})();
export function whoPlate() {
  const y = jb.y, all = who.Everyone;
  const rows = WHO.slice(0, 4).map(([, , l]) => ({ name: l, value: who[l] })).filter((r) => r.value != null);
  return figure({
    bare: true, file: "india-atlas_services-share-of-workers-by-sex-and-place",
    label: `Services' share of workers by sex and place, ${y}, current weekly status, against everyone at ${f1(all)}%`,
    data: { cols: ["Group", "Calendar year", "Services share of workers, %, CWS"], rows: WHO.map(([, , l]) => [l, y, who[l]]) },
    draw: (width) => K.bars({ width, rows, unit: PCT, dp: 1, ref: { value: all, label: `Everyone ${f1(all)}%` } }),
  });
}
const STATUS = [["own_account", "Own-account and employers", C.ctx], ["helper", "Unpaid family helpers", C.ctx2], ["regular", "Regular wage or salary", C.lead], ["casual", "Casual labour", C.comp]];
const ST_GROUPS = [["trade", "Trade"], ["transport", "Transport"], ["accommodation_food", "Hotels and food"], ["other_services", "Other services"], ["tertiary", "All services"], ["manufacturing", "Manufacturing, for comparison"]];
export const ayOf = () => { const y = jobsAy.dates.at(-1).slice(0, 4); return `${y}-${String((+y + 1) % 100).padStart(2, "0")}`; };
export function status() {
  const J = jobsAy.series, yi = jobsAy.dates.length - 1, ay = ayOf();
  const rows = ST_GROUPS.map(([g, gl]) => ({ name: gl, highlight: g === "tertiary", parts: STATUS.map(([s]) => J[`${s}__${g}__person_all_ps`]?.data[yi] ?? null) }));
  return figure({
    bare: true, file: "india-atlas_service-workers-by-status",
    label: `How the workers in each service group are employed, ${ay}: own-account, unpaid helpers, regular wage or salary, casual labour; manufacturing for comparison`,
    data: { cols: ["Group", ...STATUS.map((s) => s[1] + ", %")], rows: rows.map((r) => [r.name, ...r.parts]) },
    draw: (width) => K.stackBars({ width, rows, parts: STATUS.map(([, name, color]) => ({ name, color })), sortBy: 2 }),
  });
}

/* ---------- § 07 the informal service economy (ASUSE) ---------- */
export const ACTS = [
  ["other_retail_trade", "Shops: other retail trade"], ["other_wholesale_trade", "Other wholesale trade"], ["wholesale_and_retail_trade_of_motor_vehicles_and_motor_cycles", "Vehicle sales"],
  ["maintenance_and_repair_of_motor_vehicles_and_motor_cycles", "Vehicle repair"], ["wholesale_on_fee_or_contract", "Wholesale on commission"], ["food_and_accommodation_service_activities", "Food service: eateries, dhabas"],
  ["accommodation", "Accommodation"], ["land_transport", "Land transport"], ["water_transport", "Water transport"], ["warehousing_and_storage", "Warehousing and storage"],
  ["support_activities_for_transportation_postal_and_courier_activities", "Transport support, post, courier"], ["information_and_communication", "Information and communication"],
  ["financial_service_activities_except_insurance_and_pension_funding", "Financial services"], ["other_financial_activities", "Other financial activities"], ["real_estate_activities", "Real estate"],
  ["professional_scientific_and_technical_activities", "Professional and technical"], ["administrative_and_support_service_activities", "Administrative and support"], ["education", "Education: tutors, coaching"],
  ["human_health_and_social_work_activities", "Health: clinics, nursing"], ["other_community_social_and_personal_service_activities", "Personal services: tailors, barbers, laundry"],
];
const ACT_SHORT = { "Food service: eateries, dhabas": "Eateries, dhabas", "Transport support, post, courier": "Transport support, courier", "Information and communication": "Information, communication",
  "Personal services: tailors, barbers, laundry": "Personal: tailors, barbers", "All activities, including manufacturing": "All activities, incl. manufacturing", "Education: tutors, coaching": "Education, coaching" };
const actName = (l) => ACT_SHORT[l] ?? l;
export const AS = asuse.series, AP = asuseProfile.series, asY = asuse.dates.length - 1, asFy = fyOf(asuse.dates[asY]);
const MID = { establishments: "estimated_no_of_establishments", workers: "all__all" };
export const asKey = (ind, act, sector = "combined", et = "all") => `${ind}${MID[ind] ? "__" + MID[ind] : ""}__${act}__${sector}__${et}`;
export const asz = (() => {
  const rows = ACTS.map(([a, l]) => ({ a, label: l, est: AS[asKey("establishments", a)]?.data[asY], wk: AS[asKey("workers", a)]?.data[asY] })).filter((r) => r.est != null && r.wk != null).sort((p, q) => q.wk - p.wk);
  return { rows };
})();
export function asize() {
  const { rows } = asz;
  return figure({
    bare: true, file: "india-atlas_informal-service-enterprises-workers",
    label: `Workers in unincorporated service enterprises by activity, ${asFy}, in lakh`,
    data: { cols: ["Activity", "Establishments", "Workers", "Survey year"], rows: rows.map((r) => [r.label, r.est, r.wk, asFy]) },
    draw: (width) => K.bars({ width, rows: rows.map((r, i) => ({ name: actName(r.label), value: r.wk / 1e5, highlight: i === 0 })), unit: { suffix: " lakh" }, dp: 1 }),
  });
}
export const agvaAll = { u: AS[asKey("gva_per_worker", "all_activities", "urban")].data[asY], r: AS[asKey("gva_per_worker", "all_activities", "rural")].data[asY] };
export function agva() {
  const v = (a, s) => AS[asKey("gva_per_worker", a, s)]?.data[asY] ?? null;
  const all = ACTS.map(([a, l]) => ({ label: l, r: v(a, "rural"), u: v(a, "urban"), c: v(a, "combined") }));
  const rows = all.filter((d) => d.r != null && d.u != null && d.c != null);
  const inr = (x) => Math.round(x).toLocaleString("en-IN");
  return figure({
    bare: true, file: "india-atlas_informal-services-gva-per-worker",
    label: `Gross value added per worker in unincorporated service enterprises, rural and urban, rupees a year, ${asFy}, against all activities in urban areas`,
    data: { cols: ["Activity", "Rural, ₹ a year", "Urban, ₹ a year", "Survey year"], rows: all.map((d) => [d.label, d.r, d.u, asFy]) },
    draw: (width) => K.dumbbell({ width, rows: rows.map((d) => ({ name: actName(d.label), a: d.r / 1e5, b: d.u / 1e5, c: d.c })), sortBy: "c", keys: { a: "Rural", b: "Urban" }, unit: { suffix: " lakh" }, dp: 1,
      ref: { value: agvaAll.u / 1e5, label: `All activities, urban ₹${inr(agvaAll.u)}` } }),
  });
}
const LOC = [["within_household_premises", "At home", C.lead], ["outside_household_premises_with_fixed_premises_of_permanent_structure", "Shop or office", C.ctx2],
  ["outside_household_premises_with_fixed_premises_of_temporary_structure_kiosk_stall", "Kiosk or stall", C.muted], ["outside_household_premises_with_fixed_premises_but_without_any_structure", "Fixed spot, no structure", C.faint],
  ["no_fixed", "No fixed place: hawkers, mobile", C.comp]];
export const locVal = (loc, act) => {
  if (loc === "no_fixed") { const a = AP[`location__outside_household_premises_without_fixed_premises_like_mobile_market__${act}__combined__all`]?.data[asY], b = AP[`location__outside_household_premises_without_fixed_premises_like_street_vendors_etc__${act}__combined__all`]?.data[asY]; return a == null && b == null ? null : ((a ?? 0) + (b ?? 0)) / 10; }
  const v = AP[`location__${loc}__${act}__combined__all`]?.data[asY]; return v == null ? null : v / 10;
};
export function awhere() {
  const acts = [...ACTS, ["all_activities", "All activities, including manufacturing"]];
  const rows = acts.map(([a, l]) => ({ name: actName(l), label: l, parts: LOC.map(([k]) => locVal(k, a)) })).filter((r) => r.parts.some((v) => v != null));
  return figure({
    bare: true, file: "india-atlas_informal-services-where-they-operate",
    label: `Where unincorporated service enterprises operate, share of establishments by activity, ${asFy}, sorted by the share run from home`,
    data: { cols: ["Activity", ...LOC.map((l) => l[1] + ", %"), "Survey year"], rows: rows.map((r) => [r.label, ...r.parts, asFy]) },
    draw: (width) => K.stackBars({ width, rows: rows.map(({ name, parts }) => ({ name, parts })), parts: LOC.map(([, name, color]) => ({ name, color })), sortBy: 0 }),
  });
}

/* ---------- title block spark ---------- */
export const shareSpark = () => K.spark(pairs(share22, "services"));
