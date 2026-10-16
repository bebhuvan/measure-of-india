// CPI guide: the plates, drawn at build time with the chart kit (src/kit/), and every number,
// table and ledger the page shows. Each chart export returns a bare figure for a plate's
// .plotzone; the plate's title, source line and buttons stay in src/pages/guides/cpi.astro.
// NUM holds the text of every number id on the page (HTML, already escaped), computed with the
// arithmetic the old client used, on bundles rounded once to the published precision.
// Runs at build time only: the page ships no bundle JSON and no chart code.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import { roundRates, numWord } from "./precision.js";
import * as fmt from "../charts/format.js";
import linked24 from "../../data/series/cpi-2024-linked.json";
import base12 from "../../data/series/cpi.json";
import bundle_raw from "../../data/series/cpi.json";
import ruralBundle_raw from "../../data/series/cpi-rural.json";
import urbanBundle_raw from "../../data/series/cpi-urban.json";
import subBundle_raw from "../../data/series/cpi-subgroups.json";
import statesBundle_raw from "../../data/series/cpi-states.json";
import statesSectorsBundle_raw from "../../data/series/cpi-states-sectors.json";
import alrl2019Bundle_raw from "../../data/series/cpialrl-2019.json";
import alrl1986Bundle_raw from "../../data/series/cpialrl-1986.json";
import alrlGroupsBundle_raw from "../../data/series/cpialrl-groups-2019.json";
import bundle2024_raw from "../../data/series/cpi-2024.json";
import linked2024Bundle_raw from "../../data/series/cpi-2024-linked.json";
import sectors2024Bundle_raw from "../../data/series/cpi-2024-sectors.json";
import groups2024Bundle_raw from "../../data/series/cpi-2024-groups.json";
import items2024Bundle_raw from "../../data/series/cpi-2024-items.json";
import states2024Bundle_raw from "../../data/series/cpi-2024-states.json";
import alStates86Bundle_raw from "../../data/series/cpialrl-states-1986.json";
import iw60Bundle_raw from "../../data/series/cpiiw-1960.json";
import iw82Bundle_raw from "../../data/series/cpiiw-1982.json";
import iw01Bundle_raw from "../../data/series/cpiiw-2001.json";
import iw16Bundle_raw from "../../data/series/cpiiw-2016.json";
import iwCenBundle_raw from "../../data/series/cpiiw-centres-2016.json";
import wageBundle_raw from "../../data/series/wages-rural-2013.json";
import wageStBundle_raw from "../../data/series/wages-rural-states-2013.json";
import alSt19Bundle from "../../data/series/cpialrl-states-2019.json";
import rlSt19Bundle from "../../data/series/cpialrl-states-rl-2019.json";
import ruDivBundle_raw from "../../data/series/cpi-2024-rural-divisions.json";
import urDivBundle_raw from "../../data/series/cpi-2024-urban-divisions.json";
import stDivBundle_raw from "../../data/series/cpi-2024-states-divisions.json";
import groups12Bundle_raw from "../../data/series/cpi-groups.json";
import items12Bundle_raw from "../../data/series/cpi-items-2012.json";

const PCT = { suffix: "%" };

// ---------------------------------------------------------------- the data, rounded once
const bundle = roundRates(bundle_raw), ruralBundle = roundRates(ruralBundle_raw), urbanBundle = roundRates(urbanBundle_raw);
const subBundle = roundRates(subBundle_raw), statesBundle = roundRates(statesBundle_raw), statesSectorsBundle = roundRates(statesSectorsBundle_raw);
const alrl2019Bundle = roundRates(alrl2019Bundle_raw), alrl1986Bundle = roundRates(alrl1986Bundle_raw), alrlGroupsBundle = roundRates(alrlGroupsBundle_raw);
const bundle2024 = roundRates(bundle2024_raw), linked2024Bundle = roundRates(linked2024Bundle_raw), sectors2024Bundle = roundRates(sectors2024Bundle_raw);
const groups2024Bundle = roundRates(groups2024Bundle_raw), items2024Bundle = roundRates(items2024Bundle_raw), states2024Bundle = roundRates(states2024Bundle_raw);
const alStates86Bundle = roundRates(alStates86Bundle_raw);
const iw60Bundle = roundRates(iw60Bundle_raw), iw82Bundle = roundRates(iw82Bundle_raw), iw01Bundle = roundRates(iw01Bundle_raw), iw16Bundle = roundRates(iw16Bundle_raw);
const iwCenBundle = roundRates(iwCenBundle_raw), wageBundle = roundRates(wageBundle_raw), wageStBundle = roundRates(wageStBundle_raw);
const ruDivBundle = roundRates(ruDivBundle_raw), urDivBundle = roundRates(urDivBundle_raw), stDivBundle = roundRates(stDivBundle_raw);
const groups12Bundle = roundRates(groups12Bundle_raw), items12Bundle = roundRates(items12Bundle_raw);

// a bundle's series as {key: {name, label, data:[{date:'YYYY-MM-DD', value}]}}
function hydrate(b) {
  const S = {};
  for (const [k, s] of Object.entries(b.series)) S[k] = { name: s.name, label: s.label, data: s.data.map((v, i) => ({ date: b.dates[i], value: v ?? null })) };
  return S;
}
const S = hydrate(bundle), R = hydrate(ruralBundle), U = hydrate(urbanBundle), SUB = hydrate(subBundle), ST = hydrate(statesBundle), SS = hydrate(statesSectorsBundle);
const AL19 = hydrate(alrl2019Bundle), AL86 = hydrate(alrl1986Bundle), ALG = hydrate(alrlGroupsBundle);
const S24 = hydrate(bundle2024), LN24 = hydrate(linked2024Bundle), S24S = hydrate(sectors2024Bundle), G24 = hydrate(groups2024Bundle);
const IT24 = hydrate(items2024Bundle), ST24 = hydrate(states2024Bundle), ALS86 = hydrate(alStates86Bundle);
const IW = { b1960: hydrate(iw60Bundle), b1982: hydrate(iw82Bundle), b2001: hydrate(iw01Bundle), b2016: hydrate(iw16Bundle) };
const WG = hydrate(wageBundle);

// [[date, value]] for the kit, from a hydrated series
const kp = (s) => s.data.map((d) => [d.date, d.value]);
const csvOf = (series) => { // a row per date, a column per series (date-keyed, never index-joined)
  const dates = [...new Set(series.flatMap((s) => s.data.map((d) => d.date)))].sort();
  const at = series.map((s) => new Map(s.data.map((d) => [d.date, d.value])));
  return { cols: ["date", ...series.map((s) => s.name ?? s.label)], rows: dates.map((d) => [d, ...at.map((m) => m.get(d) ?? null)]) };
};

// ---------------------------------------------------------------- formats
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MLONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtDate = (d) => MN[+d.slice(5, 7) - 1] + " " + d.slice(0, 4);
const longDate = (d) => MLONG[+d.slice(5, 7) - 1] + " " + d.slice(0, 4);
const spanLong = (data) => longDate(data[0].date) + " to " + longDate(data.at(-1).date);
const firstOf = (s) => s.data.find((d) => d.value != null);
const lastOf = (s) => [...s.data].reverse().find((d) => d.value != null);
const peakOf = (s) => { let p = null; for (const d of s.data) if (d.value != null && (!p || d.value > p.value)) p = d; return p ?? s.data[0]; };
const peakBetween = (s, a, b) => { let p = null; for (const d of s.data) { const y = +d.date.slice(0, 4); if (d.value != null && y >= a && y <= b && (!p || d.value > p.value)) p = d; } return p; };
const f1 = (v) => v.toFixed(1) + "%";
const pc = '<span class="pc">%</span>';
const arrow = (d) => (Math.abs(d) < 0.05 ? "unchanged" : (d > 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt");
const word = (d) => (Math.abs(d) < 0.05 ? "steady" : d > 0 ? "firming" : "easing");
const moveWord = (d, sep = ", ") => (Math.abs(d) < 0.05 ? "unchanged" : arrow(d) + sep + word(d));
const bandNote = (v) => (v < 2 ? "below the RBI band" : v > 6 ? "above the RBI band" : "within RBI band");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Every number id on the page: id -> HTML. */
export const NUM = {};
const setTxt = (id, t) => { NUM[id] = esc(t); };
const setHTML = (id, h) => { NUM[id] = h; };

// ---------------------------------------------------------------- latest readings
const L = {}, P = {}, Y = {};
for (const k in S) { L[k] = S[k].data.at(-1).value; P[k] = S[k].data.at(-2).value; Y[k] = S[k].data.at(-13).value; }
const L24 = {}, P24 = {};
for (const k in S24) { L24[k] = S24[k].data.at(-1).value; P24[k] = S24[k].data.at(-2).value; }
const FIRST24 = S24.headline.data[0].value;
const RU = { combined: S.headline, rural: R.headline, urban: U.headline };
const ALP = { ...AL19.al_published_yoy, label: "AL" }, RLP = { ...AL19.rl_published_yoy, label: "RL" };

setHTML("n-head", L24.headline.toFixed(1) + pc);
setHTML("n-food", L24.food_and_beverages.toFixed(1) + pc);
setHTML("n-old", L.headline.toFixed(1) + pc);
setHTML("n-core", L.core.toFixed(1) + pc);
const prevM24 = MN[+S24.headline.data.at(-2).date.slice(5, 7) - 1];
setHTML("d-head", `<b>${arrow(L24.headline - P24.headline)}</b> vs ${prevM24}, ${bandNote(L24.headline)}`);
setHTML("d-food", `<b>${arrow(L24.food_and_beverages - P24.food_and_beverages)}</b> vs ${prevM24}, ${word(L24.food_and_beverages - P24.food_and_beverages)}`);
setHTML("d-old", `base retired, series ends Dec 2025`);
setHTML("d-core", `<b>${arrow(L.core - P.core)}</b> vs Nov, to Dec 2025`);
setHTML("rb-big", L24.headline.toFixed(1) + pc);
setHTML("rb-band", `Position in RBI band: <b>${
  L24.headline < 2 ? (2 - L24.headline).toFixed(1) + " pt below the floor"
  : L24.headline < 4 ? (4 - L24.headline).toFixed(1) + " pt below target"
  : L24.headline <= 6 ? (L24.headline - 4).toFixed(1) + " pt above target"
  : (L24.headline - 6).toFixed(1) + " pt above the ceiling"
}</b>`);
/** §01: where the latest print sits on a 0–8% scale, the band shaded and the target marked. */
export const rbScale = (() => {
  const W = 236, H = 46, min = 0, max = 8, val = L24.headline;
  const X = (v) => ((v - min) / (max - min)) * W, y = 18;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scale from 0 to 8 per cent. The RBI tolerance band from 2 to 6 per cent is shaded; the 4 per cent target is dashed; the current reading, ${val.toFixed(1)} per cent, is marked.">` +
    `<rect x="${X(2)}" y="${y - 7}" width="${X(6) - X(2)}" height="14" fill="#F6F7F9" stroke="#EEF0F3" stroke-width="1"/>` +
    `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#DADDE3" stroke-width="1"/>` +
    `<line x1="${X(4)}" y1="${y - 10}" x2="${X(4)}" y2="${y + 10}" stroke="#878D99" stroke-width="1" stroke-dasharray="2,3"/>` +
    [0, 2, 4, 6, 8].map((t, i, a) => `<text x="${X(t)}" y="${H - 6}" font-family="'Libre Franklin',sans-serif" font-size="11" fill="#878D99" text-anchor="${i === 0 ? "start" : i === a.length - 1 ? "end" : "middle"}">${t}%</text>`).join("") +
    `<circle cx="${X(val)}" cy="${y}" r="4.5" fill="#2E4BD8" stroke="#FFFFFF" stroke-width="1.5"/></svg>`;
})();

setTxt("pv-main", f1(L.headline));
setTxt("pv-food", f1(L.food)); setTxt("pv-fuel", f1(L.fuel)); setTxt("pv-core", f1(L.core));
setTxt("ex-food", f1(L.food)); setTxt("ex-food-y", f1(Y.food));
setTxt("ex-fuel", f1(L.fuel)); setTxt("ex-core", f1(L.core));
setTxt("ex-hjan", f1(S.headline.data.at(-12).value)); setTxt("ex-hdec", f1(L.headline));
for (const k of ["food", "fuel", "core"]) { const pk = peakOf(S[k]); setTxt("pf-" + k, `peak: ${pk.value.toFixed(1)}%, ${fmtDate(pk.date)}, latest: ${f1(L[k])}`); }

// ---------------------------------------------------------------- §02 the continuous headline
{
  const byT = new Map(S.headline.data.filter((d) => d.value != null).map((d) => [d.date, d.value]));
  let gap = 0; for (const d of LN24.headline.data) { const o = byT.get(d.date); if (o != null && d.value != null) gap = Math.max(gap, Math.abs(d.value - o)); }
  setTxt("pv-nb", f1(L24.headline));
  setTxt("nb-jan", f1(FIRST24)); setTxt("nb-new", f1(L24.headline));
  setTxt("nb-old-final", f1(L.headline));
  setTxt("nb-shadow", gap.toFixed(1) + " pt");
}

/** §02: the continuous 2024-base headline (NSO back-cast, then live), the retired 2012 ruler faint. */
export function nb() {
  const linked = pairs(linked24, "headline", { from: "2014-01-01" });
  const old = pairs(base12, "headline", { from: "2014-01-01" });
  return figure({
    bare: true, file: "india-atlas_cpi2024_linked-headline_2014-2026",
    label: "Headline CPI as one continuous series on the 2024 base, the NSO's back-cast drawn lighter before January 2025, beside the retired 2012 base",
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Base 2012, retired", short: "2012 base", data: old, role: "ctx2", label: false },
        { name: "Base 2024", short: "2024 base", data: linked, role: "lead", recon: "2024-12-01" },
      ],
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
      refs: [{ y: 4, label: "Target 4%" }],
      seam: { t: "2025-01-01", before: "NSO back-cast", after: "Live prices" },
    }),
  });
}

// ---------------------------------------------------------------- §03 twelve divisions
const DIV = {
  food_and_beverages: "Food & beverages",
  paan_tobacco_and_intoxicants: "Paan, tobacco & intoxicants",
  clothing_and_footwear: "Clothing & footwear",
  housing_water_electricity_gas_and_other_fuels: "Housing, water, electricity, gas & fuels",
  furnishings_household_equipment_and_routine_household_maintenance: "Furnishings & household equipment",
  health: "Health",
  transport: "Transport",
  information_and_communication: "Information & communication",
  recreation_sport_and_culture: "Recreation, sport & culture",
  education_services: "Education",
  restaurants_and_accommodation_services: "Restaurants & hotels",
  personal_care_social_protection_and_miscellaneous_goods_and_services: "Personal care, incl. gold",
};
// the chart's row names, short enough to sit whole in the name column
const DIVSHORT = { housing_water_electricity_gas_and_other_fuels: "Housing, utilities & fuels", furnishings_household_equipment_and_routine_household_maintenance: "Furnishings & household", paan_tobacco_and_intoxicants: "Paan & tobacco", information_and_communication: "Information & comms" };
const divRows = Object.keys(DIV).map((k) => ({ k, name: DIV[k], s: S24[k], v: S24[k].data.at(-1).value })).sort((a, b) => b.v - a.v);
{
  const head = L24.headline, top = divRows[0], bot = divRows.at(-1);
  setTxt("pv-div", top.name);
  setTxt("div-top", top.name + ", " + f1(top.v));
  setTxt("div-bot", bot.name + ", " + bot.v.toFixed(1) + "%");
  setTxt("div-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("div-above", numWord(divRows.filter((r) => r.v > head).length, true));
  setTxt("div-gold", f1(S24.personal_care_social_protection_and_miscellaneous_goods_and_services.data.at(-1).value));
  setTxt("div-rest", f1(S24.restaurants_and_accommodation_services.data.at(-1).value));
  setTxt("div-info", f1(S24.information_and_communication.data.at(-1).value));
}
/** §03: the twelve divisions ranked, the published headline as the reference. */
export function div() {
  const head = L24.headline, when = longDate(S24.headline.data.at(-1).date);
  return figure({
    bare: true, file: "india-atlas_cpi_13-divisions_2026",
    label: `The twelve CPI divisions of the 2024 base ranked by year-on-year inflation in ${when}; ${divRows[0].name} highest at ${f1(divRows[0].v)}, ${divRows.at(-1).name} lowest at ${f1(divRows.at(-1).v)}, against a headline of ${f1(head)}`,
    data: { cols: ["Division", `y/y % ${S24.headline.data.at(-1).date.slice(0, 7)}`], rows: divRows.map((r) => [r.name, r.v]) },
    draw: (width) => K.bars({ width, unit: PCT, rows: divRows.map((r) => ({ name: DIVSHORT[r.k] ?? r.name, value: r.v })), ref: { value: head, label: "Headline " + f1(head) } }),
  });
}

// ---------------------------------------------------------------- §03 rural and urban, 2024 base
{
  const rl = S24S.rural.data.at(-1).value, ul = S24S.urban.data.at(-1).value;
  setTxt("pv-ru24", f1(rl)); setTxt("ru24-r", f1(rl)); setTxt("ru24-u", f1(ul)); setTxt("ru24-gap", (rl - ul).toFixed(1) + " pt");
}
export function ru24() {
  const above = S24S.rural.data.filter((d, i) => d.value > S24S.urban.data[i].value).length;
  return figure({
    bare: true, file: "india-atlas_cpi_rural-urban_base2024",
    label: `Headline CPI, rural and urban, on the 2024 base, ${spanLong(S24S.rural.data)}: rural ends at ${f1(S24S.rural.data.at(-1).value)}, urban at ${f1(S24S.urban.data.at(-1).value)}; rural runs above urban in ${above} of ${S24S.rural.data.length} months`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, zero: false,
      series: [
        { name: "Urban", data: kp(S24S.urban), role: "ctx" },
        { name: "Rural", data: kp(S24S.rural), role: "lead" },
      ],
    }),
  });
}

// ---------------------------------------------------------------- §03 rural against urban, division by division
const SHORTN = { "Food and beverages": "Food", "Paan, tobacco and intoxicants": "Paan, tobacco", "Clothing and footwear": "Clothing", "Housing, water, electricity, gas and other fuels": "Housing, fuel",
  "Furnishings, household equipment and routine household maintenance": "Furnishing", "Health": "Health", "Transport": "Transport", "Information and communication": "Info, comms",
  "Recreation, sport and culture": "Recreation", "Education services": "Education", "Restaurants and accommodation services": "Restaurants", "Personal care, social protection and miscellaneous goods and services": "Personal care" };
const divru = (() => {
  const RD = hydrate(ruDivBundle), UD = hydrate(urDivBundle);
  const byCode = (B, raw) => Object.fromEntries(Object.entries(raw.series).map(([k, s]) => [s.code, B[k]]));
  const r = byCode(RD, ruDivBundle), u = byCode(UD, urDivBundle);
  const nameOf = (c) => { const full = ruDivBundle.series[Object.keys(ruDivBundle.series).find((k) => ruDivBundle.series[k].code === c)].label.replace(/, rural$/, ""); return SHORTN[full] ?? full; };
  const rows = Object.keys(r).filter((c) => u[c]).map((c) => {
    const rv = lastOf(r[c])?.value, uv = lastOf(u[c])?.value;
    return rv == null || uv == null ? null : { c, name: nameOf(c), r: rv, u: uv, gap: rv - uv };
  }).filter(Boolean).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  return { rows, when: longDate(lastOf(Object.values(RD)[0]).date), series: Object.keys(r).flatMap((c) => [r[c], u[c]]).filter(Boolean) };
})();
{
  const { rows } = divru, rhi = rows.filter((d) => d.r > d.u).length, top = rows[0], bot = rows.at(-1);
  setTxt("divru-title", rhi >= rows.length / 2 ? `The village pays more in ${numWord(rhi)} of twelve divisions` : `The town pays more in ${numWord(rows.length - rhi)} of twelve divisions`);
  setTxt("pv-divru", (top.gap > 0 ? "+" : "") + top.gap.toFixed(1) + " pt");
  setTxt("pc-divru", "widest gap: " + top.name.toLowerCase());
  setTxt("divru-rhi", numWord(rhi));
  setTxt("divru-top", top.name.toLowerCase() + ", rural " + f1(top.r) + " against urban " + f1(top.u));
  setTxt("divru-bot", bot.name.toLowerCase() + (Math.abs(bot.gap) < 0.05 ? " (the same rate in both)" : " (" + Math.abs(bot.gap).toFixed(1) + " points apart)"));
}
export function divruChart() {
  const { rows, when } = divru;
  return figure({
    bare: true, file: "india-atlas_cpi2024_rural-urban_divisions",
    label: `Rural against urban inflation for each of the twelve divisions of the 2024 base, ${when}, sorted by the gap: ` + rows.map((d) => `${d.name}, rural ${f1(d.r)}, urban ${f1(d.u)}`).join("; "),
    data: { cols: ["Division", "Rural y/y %", "Urban y/y %", "Gap, pt"], rows: rows.map((d) => [d.name, d.r, d.u, +(d.r - d.u).toFixed(1)]) },
    draw: (width) => K.dumbbell({ width, unit: PCT, sortBy: "gap", keys: { a: "Urban", b: "Rural" }, rows: rows.map((d) => ({ name: d.name, a: d.u, b: d.r })) }),
  });
}

// ---------------------------------------------------------------- §03 the 43 groups
const g24 = Object.values(G24).map((s) => ({ s, label: s.label, v: s.data.at(-1).value })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
{
  const head = L24.headline;
  setTxt("pv-grid24", g24[0].v.toFixed(1) + "%");
  setTxt("pc-grid24", fmtDate(S24.headline.data.at(-1).date) + ", " + g24[0].label);
  setTxt("ex-g24-n", String(g24.filter((r) => r.v > head).length));
  setTxt("ex-g24-hi", g24[0].label + ", " + g24[0].v.toFixed(1) + "%");
  setTxt("ex-g24-lo", g24.at(-1).label + ", " + g24.at(-1).v.toFixed(1) + "%");
}
export function grid24() {
  const head = L24.headline;
  return figure({
    bare: true, file: "india-atlas_cpi2024_43-groups_2026",
    label: `All 43 CPI groups of the 2024 base, ${spanLong(S24.headline.data)}, ranked by the latest year-on-year rate on one shared scale, the headline dotted in every panel: ${g24[0].label} hottest at ${f1(g24[0].v)}; ${g24.filter((r) => r.v > head).length} of 43 above the headline`,
    data: csvOf(g24.map((r) => r.s)),
    draw: (width) => K.multiples({ width, unit: PCT, ref: { data: kp(S24.headline) }, boldHighlight: true,
      panels: g24.map((r) => ({ name: r.label, data: kp(r.s), highlight: r.v > head })) }),
  });
}

// ---------------------------------------------------------------- tables: shared bits
const spk = (s) => { const d = kp(s); return d.some((p) => p[1] != null) ? K.spark(d, { width: 150, height: 36 }) : ""; };

// §03 the item ledger: all 358 items, extremes shown
export const tail24Rows = (() => {
  const all = Object.keys(IT24).map((k) => {
    const d = IT24[k].data.filter((x) => x.value != null);
    if (!d.length) return null;
    const ext = items2024Bundle.series[k];
    return { k, s: IT24[k], latest: d.at(-1).value, prevV: d.length > 1 ? d.at(-2).value : null, level: ext.latest_level, code: ext.code, division: ext.division };
  }).filter(Boolean).sort((a, b) => b.latest - a.latest || a.s.label.localeCompare(b.s.label));
  const top = all.slice(0, 15), bot = all.slice(-15);
  const row = (r, rank) => `<tr><td class="name">${esc(r.s.label)}<small>${rank} of ${all.length}, ${esc(r.division)}, ${esc(r.code)}</small></td>` +
    `<td class="val">${f1(r.latest)}</td><td class="chg">${r.prevV == null ? "—" : moveWord(r.latest - r.prevV)}</td>` +
    `<td class="yr">${r.level == null ? "—" : r.level.toFixed(1)}</td><td class="spark">${spk(r.s)}</td></tr>`;
  const vals = all.map((r) => r.latest);
  const median = (vals[Math.floor((vals.length - 1) / 2)] + vals[Math.ceil((vals.length - 1) / 2)]) / 2;
  setTxt("pv-tail24", f1(top[0].latest));
  setTxt("pc-tail24", fmtDate(S24.headline.data.at(-1).date) + ", " + top[0].s.label.slice(0, 34) + ": hottest item");
  setTxt("pf-tail24", `cut lines: 15th hottest ${f1(top.at(-1).latest)}, 15th coldest ${f1(bot[0].latest)}`);
  setTxt("ex-t24span", (top[0].latest - bot.at(-1).latest).toFixed(1));
  setTxt("ex-t24topn", top[0].s.label.toLowerCase());
  setTxt("ex-t24top", f1(top[0].latest));
  setTxt("ex-t24botn", bot.at(-1).s.label.toLowerCase());
  setTxt("ex-t24bot", f1(bot.at(-1).latest));
  setTxt("ex-t24med", f1(median));
  setTxt("ex-t24neg", String(vals.filter((v) => v < 0).length));
  const lvlHi = [...all].sort((a, b) => (b.level ?? -1) - (a.level ?? -1))[0];
  setTxt("ex-t24lvln", lvlHi.s.label.toLowerCase());
  setTxt("ex-t24lvl", lvlHi.level.toFixed(1));
  return top.map((r, i) => row(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="5">⋯ ${all.length - 30} items between ${f1(top.at(-1).latest)} and ${f1(bot[0].latest)}: the full basket ships in the CSV ⋯</td></tr>` +
    bot.map((r, i) => row(r, all.length - 14 + i)).join("");
})();

// §04 the register of series
export const ledgerRows = (() => {
  const regRows = [
    [S24.headline, "Headline CPI, base 2024", "All items: published all-groups index; the API serves no weights for this base yet", "s-acc", null, null, false],
    [S24.food_and_beverages, "Food & beverages, base 2024", "Division 01 of the redrawn COICOP-2018-style basket", "s-g1", null, null, false],
    [G24.other_personal_effects, "Other personal effects, base 2024", "Group, division 12: jewellery lives here; gold is priced in world markets", "s-g3", null, null, false],
    [G24.electricity_gas_and_other_fuels, "Electricity, gas & other fuels, base 2024", "Group, division 04: the household energy bill on the new basket", "s-g2", null, null, false],
    [G24.passenger_transport_services, "Passenger transport services, base 2024", "Group, division 07: fares, from bus to airline", "s-g4", null, null, false],
    [S.headline, "Headline CPI (combined), base 2012", "Base retired, to Dec 2025: computed from group indices", "s-acc", 100.0, "#2E4BD8", true],
    [S.food, "Food & beverages, base 2012", "Base retired, to Dec 2025, nearly half the basket", "s-g1", 45.86, "#5F6675", true],
    [S.fuel, "Fuel & light, base 2012", "Base retired, to Dec 2025, LPG, kerosene, electricity", "s-g2", 6.84, "#A3A9B4", true],
    [S.core, "Core, base 2012", "Base retired, to Dec 2025, ex food, ex fuel: derived", "s-g3", 47.30, "#C9CED6", true],
    [RU.rural, "Headline, rural, base 2012", "Sector index: food weighs 54.18 here; no housing group", "s-g1", null, null, true],
    [RU.urban, "Headline, urban, base 2012", "Sector index: housing weighs 21.67; food only 36.29", "s-g2", null, null, true],
    [SUB.vegetables, "Vegetables, base 2012", "Sub-group, the headline's wild card", "s-g1", 6.04, "#5F6675", true],
    [SUB.cereals_and_products, "Cereals & products, base 2012", "Sub-group, the staple floor", "s-g1", 9.67, "#5F6675", true],
    [SUB.transport_and_communication, "Transport & communication, base 2012", "Sub-group, fares, fuel at the pump, phone bills", "s-g2", 8.59, "#A3A9B4", true],
    [ALP, "CPI-AL", "Agricultural labourers, Labour Bureau, base 2019, to " + fmtDate(ALP.data.at(-1).date), "s-acc", null, null, false],
    [RLP, "CPI-RL", "Rural labourers, Labour Bureau, base 2019, to " + fmtDate(RLP.data.at(-1).date), "s-g4", null, null, false],
  ];
  return regRows.map(([s, nm, sub, sw, wt, col, retired]) => {
    const data = s.data.filter((d) => d.value != null);
    const l = data.at(-1).value, p = data.at(-2).value;
    const yv = s.data.length >= 13 ? s.data.at(-13).value : null;
    const wtCell = wt == null ? "—" : wt.toFixed(1) + `<span class="wtrack"><i style="width:${wt}%;background:${col}"></i></span>`;
    const chgCell = retired ? `<td class="chg" style="color:var(--faint)" title="series ended: no live m/m">—</td>` : `<td class="chg">${moveWord(l - p)}</td>`;
    return `<tr><td class="name"><span class="sw ${sw}"></span>${esc(nm)}<small>${esc(sub)}</small></td><td class="wt">${wtCell}</td>` +
      `<td class="val">${f1(l)}</td>${chgCell}<td class="yr">${yv == null ? "—" : f1(yv)}</td><td class="spark">${spk(s)}</td></tr>`;
  }).join("");
})();

// §05 the basket: combined, rural, urban on the CES 2011–12 weights
const GROUP_DEFS = [
  ["food", "Food & beverages", "#2E4BD8"], ["pan", "Pan, tobacco & intoxicants", "#4A5160"], ["clothing", "Clothing & footwear", "#878D99"],
  ["housing", "Housing", "#A3A9B4"], ["fuel", "Fuel & light", "#C9CED6"], ["misc", "Miscellaneous, services", "#DADDE3"],
];
const SECTOR_W = {
  combined: { food: 45.86, pan: 2.38, clothing: 6.53, housing: 10.07, fuel: 6.84, misc: 28.32 },
  rural: { food: 54.18, pan: 3.26, clothing: 7.36, fuel: 7.94, misc: 27.26 },
  urban: { food: 36.29, pan: 1.36, clothing: 5.57, housing: 21.67, fuel: 5.58, misc: 29.53 },
};
const LAB_W = 172;
export const basketBar = [["combined", "Combined"], ["rural", "Rural, no housing"], ["urban", "Urban, housing 21.7%"]].map(([key, nm]) => {
  const w = SECTOR_W[key];
  const segs = GROUP_DEFS.filter(([g]) => w[g] != null).map(([g, label, c]) => `<div class="seg" style="width:${w[g]}%;background:${c}" title="${esc(label)}: ${w[g]}%"></div>`).join("");
  return `<div style="display:flex;align-items:center;gap:16px;margin-top:12px"><div style="width:${LAB_W}px;flex-shrink:0;text-align:right;font-family:var(--sans);font-size:.72rem;color:var(--ink-soft);line-height:1.5">${esc(nm)}</div><div style="flex:1;display:flex;height:34px;border:1px solid var(--ink)">${segs}</div></div>`;
}).join("");
export const basketLabels = `<div class="basket-key" style="--basket-indent:${LAB_W + 16}px">` +
  GROUP_DEFS.map(([, label, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${esc(label)}</div></div>`).join("") + "</div>";

// ---------------------------------------------------------------- §06 plate 1: headline and components
/** §06: the headline in the lead, its parts as context, core dashed; three peaks named. */
export function main() {
  const pk19 = peakBetween(S.headline, 2019, 2019), pk22 = peakBetween(S.headline, 2021, 2022), pk23 = peakBetween(S.headline, 2023, 2023);
  return figure({
    bare: true, file: "india-atlas_cpi_headline-components_2016-2025",
    label: `Headline CPI and its components, year-on-year, January 2016 to December 2025, base 2012: headline ends at ${f1(L.headline)}, food at ${f1(L.food)}, fuel at ${f1(L.fuel)}, core at ${f1(L.core)}; the RBI band of 2 to 6 per cent shaded, the 4 per cent target dotted, the peaks of ${fmtDate(pk19.date)}, ${fmtDate(pk22.date)} and ${fmtDate(pk23.date)} named`,
    data: csvOf([S.headline, S.food, S.fuel, S.core]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, height: width < 520 ? 300 : Math.round(Math.min(460, Math.max(320, width * 0.42))),
      series: [
        { name: "Fuel & light", short: "Fuel", data: kp(S.fuel), role: "ctx2" },
        { name: "Food & beverages", short: "Food", data: kp(S.food), role: "ctx" },
        { name: "Core, derived", short: "Core", data: kp(S.core), role: "ctx", color: K.C.ink2, dash: "4 3" },
        { name: "Headline", data: kp(S.headline), role: "lead" },
      ],
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
      refs: [{ y: 4, label: "Target 4%" }],
      // the episodes the explain names, as dated rules above the plot (notes would sit on four lines)
      events: width < 520 ? [{ t: "2020-04-01", label: "COVID-19" }] : [
        { t: pk19.date, label: `Onion shock, ${f1(pk19.value)}`, side: "left" },
        { t: "2020-04-01", label: "COVID-19" },
        { t: pk22.date, label: `${fmtDate(pk22.date)}, ${f1(pk22.value)}` },
        { t: pk23.date, label: `Vegetables, ${f1(pk23.value)}` },
      ],
    }),
  });
}

/** §08: one component of the 2012 basket, its peak named. */
function component(key, file, label) {
  const s = S[key], pk = peakOf(s);
  return figure({
    bare: true, file,
    label: `${label} inflation, year-on-year, 2016 to 2025, base 2012: it ends at ${f1(s.data.at(-1).value)}, after peaking at ${f1(pk.value)} in ${fmtDate(pk.date)}; the RBI band of 2 to 6 per cent shaded`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [{ name: label, data: kp(s), role: "lead" }], inside: false, nameOnEnd: false,
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
      // the peak named on the wider drawings; on a phone the source line below carries it
      notes: width < 520 ? [] : [{ d: pk.date, v: pk.value, text: width < 1000 ? `Peak ${f1(pk.value)}, ${fmtDate(pk.date)}` : `Peak ${f1(pk.value)}\n${fmtDate(pk.date)}` }],
    }),
  });
}
export const food = () => component("food", "india-atlas_cpi_food_2016-2025", "Food & beverages");
export const fuel = () => component("fuel", "india-atlas_cpi_fuel_2016-2025", "Fuel & light");
export const core = () => component("core", "india-atlas_cpi_core_2016-2025", "Core");

// ---------------------------------------------------------------- §08 the other four groups of the 2012 base
const OTH = (() => {
  const G = hydrate(groups12Bundle);
  const keys = ["miscellaneous", "housing", "clothing_and_footwear", "pan_tobacco_and_intoxicants"].filter((k) => G[k]);
  const LAB = { miscellaneous: "Miscellaneous", housing: "Housing", clothing_and_footwear: "Clothing", pan_tobacco_and_intoxicants: "Pan, tobacco" };
  return { G, keys, LAB };
})();
{
  const { G, keys, LAB } = OTH;
  const sd = (k) => { const v = G[k].data.map((d) => d.value).filter((x) => x != null); const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  const bySd = [...keys].sort((a, b) => sd(a) - sd(b));
  setTxt("pv-other", f1(G.miscellaneous.data.at(-1).value));
  setTxt("pc-other", "miscellaneous, " + fmtDate(G[keys[0]].data.at(-1).date));
  setTxt("oth-misc", f1(G.miscellaneous.data.at(-1).value));
  setTxt("oth-housing", f1(G.housing.data.at(-1).value));
  setTxt("oth-cloth", f1(G.clothing_and_footwear.data.at(-1).value));
  setTxt("oth-pan", f1(G.pan_tobacco_and_intoxicants.data.at(-1).value));
  setTxt("oth-steady", LAB[bySd[0]].toLowerCase());
  setTxt("oth-wild", LAB[bySd.at(-1)].toLowerCase());
}
export function other() {
  const { G, keys, LAB } = OTH;
  return figure({
    bare: true, file: "india-atlas_cpi2012_other-four-groups",
    label: `The four groups of the 2012 base beyond food and fuel, year-on-year, ${spanLong(G[keys[0]].data)}, one panel each on a shared scale: ` + keys.map((k) => `${LAB[k]} ends at ${f1(G[k].data.at(-1).value)}`).join("; "),
    data: csvOf(keys.map((k) => G[k])),
    draw: (width) => K.multiples({ width, unit: PCT, cols: width < 520 ? 2 : 4, band: { from: 2, to: 6 },
      panels: keys.map((k) => ({ name: LAB[k], data: kp(G[k]), highlight: k === "miscellaneous" })) }),
  });
}

// ---------------------------------------------------------------- §09 the 21 sub-indices
const SM_WILD = { d: [-30, 62], ticks: [-20, 0, 20, 40, 60], keys: ["cereals_and_products", "meat_and_fish", "egg", "oils_and_fats", "fruits", "vegetables", "pulses_and_products", "sugar_and_confectionery", "spices", "consumer_food_price", "personal_care_and_effects"] };
const SM_QUIET = { d: [-4, 16], ticks: [0, 5, 10, 15], keys: ["milk_and_products", "prepared_meals_snacks_sweets_etc", "non_alcoholic_beverages", "clothing", "footwear", "household_goods_and_services", "health", "transport_and_communication", "recreation_and_amusement", "education"] };
const SUBT = {
  cereals_and_products: "Cereals & products", meat_and_fish: "Meat & fish", egg: "Egg", milk_and_products: "Milk & products", oils_and_fats: "Oils & fats", fruits: "Fruits",
  vegetables: "Vegetables", pulses_and_products: "Pulses & products", sugar_and_confectionery: "Sugar & confectionery", spices: "Spices", prepared_meals_snacks_sweets_etc: "Prepared meals & snacks",
  non_alcoholic_beverages: "Non-alcoholic beverages", clothing: "Clothing", footwear: "Footwear", household_goods_and_services: "Household goods & services", health: "Health",
  transport_and_communication: "Transport & communication", recreation_and_amusement: "Recreation & amusement", education: "Education", personal_care_and_effects: "Personal care & effects",
  consumer_food_price: "Consumer food price, aggregate",
};
const outOfBand = (v) => v < 2 || v > 6;
{
  const latest = [...SM_WILD.keys, ...SM_QUIET.keys].map((k) => SUB[k].data.at(-1).value);
  const lo = latest.filter((v) => v < 2).length, hi = latest.filter((v) => v > 6).length;
  setTxt("pv-sub", String(lo + hi));
  setTxt("sub-n", numWord(lo + hi, true)); setTxt("sub-lo", String(lo)); setTxt("sub-hi", String(hi));
  setTxt("sub-veg", f1(SUB.vegetables.data.at(-1).value));
  setTxt("sub-pulses", f1(SUB.pulses_and_products.data.at(-1).value));
  setTxt("sub-gold", f1(SUB.personal_care_and_effects.data.at(-1).value));
  setTxt("sub-oils", f1(SUB.oils_and_fats.data.at(-1).value));
}
function subGrid(G, name) {
  return figure({
    bare: true, file: "india-atlas_cpi_subgroups_2016-2025",
    label: `${name}: ${G.keys.length} CPI sub-indices, year-on-year, 2016 to 2025, on one shared scale from ${G.d[0]} to ${G.d[1]} per cent, the 2 to 6 per cent band shaded in each panel; ` + G.keys.map((k) => `${SUBT[k]} ${f1(SUB[k].data.at(-1).value)}`).join(", "),
    data: csvOf(G.keys.map((k) => SUB[k])),
    draw: (width) => K.multiples({ width, unit: PCT, domain: { lo: G.d[0], hi: G.d[1], ticks: G.ticks }, band: { from: 2, to: 6 }, boldHighlight: true,
      // every panel a grey line, as the explain reads; a reading outside the band is set in bold
      panels: G.keys.map((k) => ({ name: SUBT[k], data: kp(SUB[k]), bold: outOfBand(SUB[k].data.at(-1).value) })) }),
  });
}
export const subWild = () => subGrid(SM_WILD, "The wild eleven");
export const subQuiet = () => subGrid(SM_QUIET, "The quiet ten");

// §09 the 2012 basket, item by item: levels against 2012=100
export const items12Rows = (() => {
  const IT = hydrate(items12Bundle);
  const all = Object.entries(items12Bundle.series).map(([k, s]) => ({ k, s: IT[k], label: s.label, level: s.latest_level, y: lastOf(IT[k])?.value ?? null }))
    .filter((r) => r.level != null).sort((a, b) => b.level - a.level);
  const top = all.slice(0, 15), bot = all.slice(-15);
  const row = (r, rank) => `<tr><td class="name">${esc(r.label)}<small>${rank} of ${all.length}</small></td><td class="val">${r.level.toFixed(1)}</td>` +
    `<td class="chg">${r.y == null ? "—" : f1(r.y)}</td><td class="spark">${spk(r.s)}</td></tr>`;
  const lv = all.map((r) => r.level);
  const med = (lv[Math.floor((lv.length - 1) / 2)] + lv[Math.ceil((lv.length - 1) / 2)]) / 2;
  setTxt("items12-title", `${top[0].label} grew dearest of the old basket: ${(top[0].level / 100).toFixed(1)} times its 2012 price`);
  setTxt("pv-items12", top[0].level.toFixed(1));
  setTxt("pc-items12", top[0].label.slice(0, 34) + ", index, 2012=100");
  setTxt("it12-topn", top[0].label.toLowerCase());
  setTxt("it12-top", top[0].level.toFixed(1));
  setTxt("it12-botn", bot.at(-1).label.toLowerCase());
  setTxt("it12-bot", bot.at(-1).level.toFixed(1));
  setTxt("it12-med", med.toFixed(1));
  { const nb = lv.filter((v) => v < 100).length; setTxt("it12-below", nb === 1 ? "only one item was" : nb + " items were"); }
  return top.map((r, i) => row(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="4">⋯ ${all.length - 30} items between ${top.at(-1).level.toFixed(1)} and ${bot[0].level.toFixed(1)}: the full basket ships in the CSV ⋯</td></tr>` +
    bot.map((r, i) => row(r, all.length - 14 + i)).join("");
})();

// ---------------------------------------------------------------- §10 rural against urban, 2012 base
{
  const rl = RU.rural.data.at(-1).value, ul = RU.urban.data.at(-1).value;
  setTxt("pv-ru", f1(rl));
  setTxt("ex-ru-r", f1(rl)); setTxt("ex-ru-u", f1(ul));
  setTxt("ex-ru-gap", Math.abs(ul - rl).toFixed(1) + " points");
  setTxt("ex-ru-ry", f1(RU.rural.data.at(-13).value)); setTxt("ex-ru-uy", f1(RU.urban.data.at(-13).value));
  setTxt("ex-ru-rf", f1(R.food.data.at(-1).value)); setTxt("ex-ru-uf", f1(U.food.data.at(-1).value));
  setTxt("ex-ru-rc", f1(R.core.data.at(-1).value)); setTxt("ex-ru-uc", f1(U.core.data.at(-1).value));
}
export function ru() {
  return figure({
    bare: true, file: "india-atlas_cpi_rural-urban_2016-2025",
    label: `Headline CPI inflation, rural and urban against combined, 2016 to 2025, base 2012: combined ends at ${f1(L.headline)}, rural at ${f1(RU.rural.data.at(-1).value)}, urban at ${f1(RU.urban.data.at(-1).value)}; the RBI band of 2 to 6 per cent shaded`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Combined", data: kp(RU.combined), role: "ctx" },
        { name: "Urban", data: kp(RU.urban), role: "comp" },
        { name: "Rural", data: kp(RU.rural), role: "lead" },
      ],
      band: { from: 2, to: 6, label: "RBI tolerance band, 2–6%" },
    }),
  });
}

// ---------------------------------------------------------------- §11 states
const stateName = (k) => ({ jammu_kashmir: "Jammu & Kashmir", dadra_nagar_haveli: "Dadra & Nagar Haveli", daman_diu: "Daman & Diu", andaman_nicobar_islands: "Andaman & Nicobar Is." }[k]
  || k.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" "));
const SHORT24 = { the_dadra_and_nagar_haveli_and_daman_and_diu: "DNH & Daman & Diu", andaman_and_nicobar_islands: "Andaman & Nicobar Is.", jammu_and_kashmir: "Jammu & Kashmir" };
const st24 = Object.entries(ST24).map(([k, s]) => ({ k, name: SHORT24[k] ?? s.label, v: s.data.at(-1).value })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
const st12 = Object.entries(ST).map(([k, s]) => ({ k, name: stateName(k), v: s.data.at(-1).value })).sort((a, b) => b.v - a.v);
{
  const ai = L24.headline, top = st24[0], bot = st24.at(-1);
  setTxt("pv-st24", (top.v - bot.v).toFixed(1) + " pt");
  setTxt("st24-top", top.name + ", " + f1(top.v)); setTxt("st24-bot", bot.name + ", " + f1(bot.v));
  setTxt("st24-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("st24-ai", f1(ai)); setTxt("pf-st24-ai", f1(ai));
  setTxt("st24-above", numWord(st24.filter((r) => r.v > 6).length, true));
  setTxt("st24-below", numWord(st24.filter((r) => r.v < 2).length));
  setTxt("st24-neg", numWord(st24.filter((r) => r.v < 0).length));
}
{
  const ai = L.headline, top = st12[0], bot = st12.at(-1);
  setTxt("pv-states", (top.v - bot.v).toFixed(1) + " pt");
  setTxt("st-top", top.name + ", " + f1(top.v)); setTxt("st-bot", bot.name + ", " + f1(bot.v));
  setTxt("st-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("st-ai", f1(ai)); setTxt("pf-st-ai", f1(ai));
  setTxt("st-neg", String(st12.filter((r) => r.v < 0).length));
  setTxt("st-below", numWord(st12.filter((r) => r.v < 2).length, true));
  setTxt("st-above", String(st12.filter((r) => r.v > 6).length));
}
// ranked states: outside the 2–6% band in the lead colour, inside it pale; the band shaded
function stateBars(rows, ai, file, label, csvHead) {
  return figure({
    bare: true, file, label,
    data: { cols: ["State or UT", csvHead], rows: rows.map((r) => [r.name, r.v]) },
    draw: (width) => K.bars({ width, unit: PCT, band: { from: 2, to: 6 }, ref: { value: ai, label: "All-India " + f1(ai) },
      rows: rows.map((r) => ({ name: r.name, value: r.v, color: outOfBand(r.v) ? K.C.lead : K.C.leadTint })) }),
  });
}
export const st24Chart = () => stateBars(st24, L24.headline, "india-atlas_cpi2024_states_2026",
  `State and UT inflation on the 2024 base, ${longDate(S24.headline.data.at(-1).date)}, all ${st24.length} published General indices ranked: ${st24[0].name} highest at ${f1(st24[0].v)}, ${st24.at(-1).name} lowest at ${f1(st24.at(-1).v)}; All-India ${f1(L24.headline)}; bars outside the 2 to 6 per cent band in blue`,
  `y/y % ${S24.headline.data.at(-1).date.slice(0, 7)}, base 2024`);
export const statesChart = () => stateBars(st12, L.headline, "india-atlas_cpi_states_2025-12",
  `State and UT inflation, December 2025, base 2012, all ${st12.length} published General indices ranked: ${st12[0].name} highest at ${f1(st12[0].v)}, ${st12.at(-1).name} lowest at ${f1(st12.at(-1).v)}; All-India ${f1(L.headline)}; bars outside the 2 to 6 per cent band in blue`,
  "y/y % 2025-12, base 2012");

// §11 state x division table
export const stdivTable = (() => {
  const SD = stDivBundle.series, DIVN = {};
  for (const s of Object.values(SD)) DIVN[s.code] = s.node;
  const SHORT = (c) => SHORTN[DIVN[c]];
  const codes = Object.keys(DIVN).sort();
  const li = stDivBundle.dates.length - 1, states = {};
  const tidyState = (n) => n.replace(/ And /g, " and ").replace(/^The Dadra and Nagar Haveli and Daman and Diu$/, "Dadra, Nagar Haveli, Daman and Diu");
  for (const [k, s] of Object.entries(SD)) (states[s.state] ??= { name: tidyState(s.state), key: k.split("__")[0], cells: {} }).cells[s.code] = s.data[li];
  const gen = (key) => states2024Bundle.series[key]?.data.at(-1) ?? null;
  const rows = Object.values(states).map((r) => ({ ...r, g: gen(r.key) })).sort((a, b) => (b.g ?? -99) - (a.g ?? -99));
  const all = rows.flatMap((r) => codes.map((c) => r.cells[c])).filter((v) => v != null);
  const hiV = Math.max(...all);
  const tintOf = (v) => (v == null ? "transparent" : v < 0 ? "#ECEEF2" : `rgba(46,75,216,${(0.06 + 0.34 * Math.min(1, v / hiV)).toFixed(3)})`);
  const cell = (v) => `<td style="background:${tintOf(v)}">${v == null ? "—" : v.toFixed(1)}</td>`;
  const spread = codes.map((c) => {
    const col = rows.map((r) => ({ n: r.name, v: r.cells[c] })).filter((x) => x.v != null).sort((a, b) => b.v - a.v);
    const q = (p) => col[Math.round((col.length - 1) * p)].v;
    return { c, hi: col[0], lo: col.at(-1), w: q(0.25) - q(0.75), q1: q(0.75), q3: q(0.25) };
  }).sort((a, b) => b.w - a.w);
  const wide = spread[0], narrow = spread.at(-1);
  setTxt("stdiv-title", `${DIVN[wide.c]}: where states differ most`);
  setTxt("pv-stdiv", wide.w.toFixed(1) + " pt");
  setTxt("pc-stdiv", "middle half of states, " + (SHORT(wide.c) ?? DIVN[wide.c]).toLowerCase());
  setTxt("stdiv-wide", DIVN[wide.c].toLowerCase());
  setTxt("stdiv-wide-iqr", f1(wide.q1) + " to " + f1(wide.q3));
  setTxt("stdiv-wide-hi", wide.hi.n + ", " + f1(wide.hi.v));
  setTxt("stdiv-wide-lo", wide.lo.n + ", " + f1(wide.lo.v));
  setTxt("stdiv-narrow", DIVN[narrow.c].toLowerCase() + ", its middle half within " + narrow.w.toFixed(1) + " points");
  setTxt("stdiv-negcells", numWord(all.filter((v) => v < 0).length, true));
  setTxt("stdiv-cells", String(all.length));
  return {
    label: "Table of year-on-year inflation for " + rows.length + " states and union territories by twelve divisions, " + longDate(stDivBundle.dates[li]),
    html: `<thead><tr><th>State</th><th>General</th>${codes.map((c) => `<th title="${esc(DIVN[c])}">${esc(SHORT(c) ?? DIVN[c])}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr><td class="name">${esc(r.name)}</td>${cell(r.g)}${codes.map((c) => cell(r.cells[c])).join("")}</tr>`).join("") + "</tbody>",
  };
})();

// §11 the widest rural–urban gaps
const stgap = (() => {
  const stems = [...new Set(Object.keys(SS).map((k) => k.replace(/_(rural|urban)$/, "")))];
  const rows = stems.map((st) => {
    const r = SS[st + "_rural"], u = SS[st + "_urban"];
    if (!r || !u) return null;
    const rv = r.data.at(-1).value, uv = u.data.at(-1).value;
    return rv == null || uv == null ? null : { k: st, name: stateName(st), r: rv, u: uv, gap: Math.abs(rv - uv) };
  }).filter(Boolean).sort((a, b) => b.gap - a.gap).slice(0, 5);
  setTxt("pv-stgap", rows[0].gap.toFixed(1) + " pt");
  const townDear = rows.find((d) => d.u > d.r), villageDear = rows.find((d) => d.r > d.u);
  setTxt("pf-stgap", (townDear ? "in " + townDear.name + " the town is dearer by " + (townDear.u - townDear.r).toFixed(1) + " pt" : "") +
    (townDear && villageDear ? "; " : "") + (villageDear ? "in " + villageDear.name + " the village by " + (villageDear.r - villageDear.u).toFixed(1) + " pt" : ""));
  return rows;
})();
export function stgapChart() {
  return figure({
    bare: true, file: "india-atlas_cpi_state-sector-gaps_2025-12",
    label: "Rural against urban inflation, December 2025, in the five states where they differ most: " + stgap.map((d) => `${d.name}, rural ${f1(d.r)}, urban ${f1(d.u)}`).join("; "),
    data: { cols: ["State", "Rural y/y %", "Urban y/y %"], rows: stgap.map((d) => [d.name, d.r, d.u]) },
    draw: (width) => K.dumbbell({ width, unit: PCT, band: { from: 2, to: 6 }, sortBy: "gap", keys: { a: "Urban", b: "Rural" }, rows: stgap.map((d) => ({ name: d.name, a: d.u, b: d.r })) }),
  });
}

// ---------------------------------------------------------------- §12 CPI-AL against CPI-rural
const alcpi = (() => {
  const end = AL86.al.data.at(-1).date;
  const rural = { ...R.headline, name: "cpi_rural_base2012_yoy_pct", data: R.headline.data.filter((d) => d.date <= end) };
  const al = { ...AL86.al, name: "cpi_al_base1986_yoy_pct", data: AL86.al.data.filter((d) => d.date >= rural.data[0].date) };
  const av = al.data.at(-1).value, rv = rural.data.at(-1).value;
  const ruralByT = new Map(rural.data.map((d) => [d.date, d.value]));
  let gapSum = 0, gapN = 0, gapMax = 0, gapMaxDate = null;
  for (const d of al.data) { const r = ruralByT.get(d.date); if (d.value != null && r != null) { const g = Math.abs(d.value - r); gapSum += g; gapN++; if (g > gapMax) { gapMax = g; gapMaxDate = d.date; } } }
  setTxt("pv-alcpi", f1(av)); setTxt("alcpi-al", f1(av)); setTxt("alcpi-rural", f1(rv));
  setTxt("alcpi-avgap", (gapSum / gapN).toFixed(1) + " pt");
  setTxt("alcpi-maxgap", gapMax.toFixed(1) + " pt, " + fmtDate(gapMaxDate));
  return { rural, al };
})();
export function alcpiChart() {
  const { rural, al } = alcpi;
  return figure({
    bare: true, file: "india-atlas_cpi-al_vs_cpi-rural_2016-2025",
    label: `CPI-AL against CPI-rural, year-on-year, January 2016 to May 2025: CPI-AL, the farm-labour households, ends at ${f1(al.data.at(-1).value)}, CPI-rural at ${f1(rural.data.at(-1).value)}; CPI-AL swings wider`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "CPI rural, all households", short: "CPI rural", data: kp(rural), role: "ctx" },
        { name: "CPI-AL, farm-labour households", short: "CPI-AL", data: kp(al), role: "lead" },
      ],
    }),
  });
}

// §12 CPI-AL on two bases, never spliced
const alTwo = (() => {
  const oldS = AL86.al, newS = AL19.al_published_yoy, pk = peakOf(oldS);
  setTxt("pv-al", f1(newS.data.at(-1).value));
  setTxt("al-old-final", f1(oldS.data.at(-1).value));
  setTxt("al-new", f1(newS.data.at(-1).value));
  setTxt("al-peak", pk.value.toFixed(1) + "%");
  return { oldS, newS, pk };
})();
export function alChart() {
  const { oldS, newS, pk } = alTwo;
  return figure({
    bare: true, file: "india-atlas_cpial_two-bases_2000-2026",
    label: `CPI for agricultural labourers, year-on-year, on the retired 1986-87 base (July 2000 to May 2025, peaking at ${f1(pk.value)} in ${longDate(pk.date)}, retiring at ${f1(oldS.data.at(-1).value)}) and the new 2019 base (from ${longDate(newS.data[0].date)}, now ${f1(newS.data.at(-1).value)}), drawn side by side, never spliced`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Base 1986-87", short: "1986-87 base", data: kp(oldS), role: "ctx" },
        { name: "Base 2019", short: "2019 base", data: kp(newS), role: "lead" },
      ],
      seam: { t: newS.data[0].date, before: "Base 1986-87", after: "Base 2019" },
      notes: width < 520 ? [] : [{ d: pk.date, v: pk.value, text: `${f1(pk.value)}, ${fmtDate(pk.date)}\nafter the failed monsoon` }],
    }),
  });
}

// §12 AL against RL on the new base
{
  const av = ALP.data.at(-1).value, rv = RLP.data.at(-1).value;
  setTxt("pv-alrl", f1(rv)); setTxt("alrl-al", f1(av)); setTxt("alrl-rl", f1(rv));
  setTxt("alrl-gap", Math.abs(av - rv).toFixed(1) + " points");
  setTxt("alrl-cpirural", f1(RU.rural.data.at(-1).value));
}
export function alrlChart() {
  return figure({
    bare: true, file: "india-atlas_cpialrl_al-vs-rl_base2019",
    label: `CPI-AL against CPI-RL, year-on-year, ${spanLong(ALP.data)}, base 2019: AL ends at ${f1(ALP.data.at(-1).value)}, RL at ${f1(RLP.data.at(-1).value)}; they part by fractions of a point`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Rural labourers", short: "RL", data: kp(RLP), role: "ctx" },
        { name: "Agricultural labourers", short: "AL", data: kp(ALP), role: "lead" },
      ],
    }),
  });
}

// §12 the labourer's groups
const ALGV = {
  food: { s: ALG.food_published_yoy, label: "Food" },
  pan: { s: ALG.pan_tobacco_and_intoxicants_published_yoy, label: "Pan & tobacco" },
  fuel: { s: ALG.fuel_and_light_published_yoy, label: "Fuel & light" },
  clothing: { s: ALG.clothing_and_footwear_published_yoy, label: "Clothing & footwear" },
  misc: { s: ALG.miscellaneous_published_yoy, label: "Miscellaneous" },
};
setTxt("pv-algrp", f1(ALGV.food.s.data.at(-1).value));
setTxt("alg-food", f1(ALGV.food.s.data.at(-1).value));
setTxt("alg-fuel", f1(ALGV.fuel.s.data.at(-1).value));
setTxt("alg-cloth", f1(ALGV.clothing.s.data.at(-1).value));
setTxt("alg-misc", f1(ALGV.misc.s.data.at(-1).value));
setTxt("alg-cpifood", f1(L.food));
export function algrpChart() {
  const role = { food: "lead", fuel: "comp", pan: "ctx2", clothing: "ctx", misc: "ctx" };
  return figure({
    bare: true, file: "india-atlas_cpial_groups_base2019",
    label: `CPI-AL group indices, year-on-year, ${spanLong(ALP.data)}, base 2019: ` + Object.values(ALGV).map((g) => `${g.label} ends at ${f1(g.s.data.at(-1).value)}`).join("; "),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: ["pan", "clothing", "misc", "fuel", "food"].map((k) => ({ name: ALGV[k].label, data: kp(ALGV[k].s), role: role[k] })),
    }),
  });
}

// §12 CPI-AL by state, old base, final reading
const alst = (() => {
  const rows = Object.entries(ALS86).map(([k, s]) => ({ k, name: stateName(k), s, v: s.data.at(-1).value })).sort((a, b) => b.v - a.v);
  const ai = AL86.al.data.at(-1).value, top = rows[0], bot = rows.at(-1);
  setTxt("pv-alst", top.name);
  setTxt("alst-top", top.name + ", " + f1(top.v));
  setTxt("alst-bot", bot.name + ", " + bot.v.toFixed(1) + "%");
  setTxt("alst-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("alst-above", numWord(rows.filter((r) => r.v > ai).length, true));
  return { rows, ai };
})();
export function alstChart() {
  const { rows, ai } = alst;
  return figure({
    bare: true, file: "india-atlas_cpial_states_base1986-final",
    label: `CPI-AL by state, May 2025, base 1986-87, twenty states ranked: ${rows[0].name} highest at ${f1(rows[0].v)}, ${rows.at(-1).name} lowest at ${f1(rows.at(-1).v)}; All-India CPI-AL ${f1(ai)}`,
    data: { cols: ["State", "CPI-AL y/y % 2025-05"], rows: rows.map((r) => [r.name, r.v]) },
    draw: (width) => K.bars({ width, unit: PCT, ref: { value: ai, label: "All-India CPI-AL " + f1(ai) }, rows: rows.map((r) => ({ name: r.name, value: r.v })) }),
  });
}

// §12 CPI-AL and CPI-RL by state, base 2019
const alst19 = (() => {
  const yoyAt = (b, k) => { const d = b.series[k].data, i = d.length - 1; return d[i] != null && d[i - 12] != null ? Math.round((d[i] / d[i - 12] - 1) * 10000) / 100 : null; };
  if (alSt19Bundle.dates.length < 13) throw new Error("cpialrl-states-2019: fewer than 13 months, no y/y");
  const shortSt = (k) => (/daman/.test(k) ? "Dadra, Nagar Haveli, Daman and Diu" : stateName(k).replace(/ And /g, " and "));
  const rows = Object.keys(alSt19Bundle.series).map((k) => ({ k, name: shortSt(k), al: yoyAt(alSt19Bundle, k), rl: rlSt19Bundle.series[k] ? yoyAt(rlSt19Bundle, k) : null }))
    .filter((r) => r.al != null && r.rl != null).sort((a, b) => b.al - a.al);
  const when = alSt19Bundle.dates.at(-1);
  const alhi = rows.filter((r) => r.al > r.rl).length;
  setTxt("pv-alst19", f1(rows[0].al));
  setTxt("pc-alst19", rows[0].name + ", CPI-AL, " + fmtDate(when));
  setTxt("alst19-top", rows[0].name + ", " + f1(rows[0].al));
  setTxt("alst19-bot", rows.at(-1).name + ", " + f1(rows.at(-1).al));
  setTxt("alst19-alhi", String(alhi));
  setTxt("alst19-n", String(rows.length));
  return { rows, when, alhi };
})();
export function alst19Chart() {
  const { rows, when, alhi } = alst19;
  return figure({
    bare: true, file: "india-atlas_cpi-al-rl_states_base2019",
    label: `CPI-AL and CPI-RL by state, year-on-year, ${longDate(when)}, base 2019, ${rows.length} states sorted by CPI-AL: highest ${rows[0].name} at ${f1(rows[0].al)}, lowest ${rows.at(-1).name} at ${f1(rows.at(-1).al)}; the agricultural labourer's inflation is above the rural labourer's in ${alhi} states`,
    data: { cols: ["State", "CPI-AL y/y %", "CPI-RL y/y %"], rows: rows.map((r) => [r.name, r.al, r.rl]) },
    draw: (width) => K.dumbbell({ width, unit: PCT, sortBy: "b", keys: { a: "Rural labourers", b: "Agricultural labourers" }, rows: rows.map((r) => ({ name: r.name, a: r.rl, b: r.al })) }),
  });
}

// ---------------------------------------------------------------- §13 CPI-IW on four bases
const iw = (() => {
  const rulers = Object.entries(IW).map(([k, B]) => ({ ...B.general, key: k, label: "Base " + k.slice(1), data: B.general.data.filter((d) => d.value != null) }));
  const peak = rulers.map((r) => ({ r, p: peakOf(r) })).reduce((a, b) => (b.p.value > a.p.value ? b : a));
  const cur = rulers.at(-1), curEnd = lastOf(cur), p16 = peakOf(IW.b2016.general);
  setTxt("pv-iw", f1(curEnd.value));
  setTxt("iw-now", f1(curEnd.value));
  setTxt("iw-yago", f1(IW.b2016.general.data.at(-13).value));
  setTxt("iw-peak16", f1(p16.value) + " in " + longDate(p16.date));
  setTxt("iw-peak", peak.p.value.toFixed(1) + "% in " + longDate(peak.p.date) + ", on the " + peak.r.label.replace("Base ", "") + " basket");
  return { rulers, peak, curEnd };
})();
export function iwChart() {
  const { rulers, peak, curEnd } = iw;
  const y0 = rulers[0].data[0].date.slice(0, 4), y1 = curEnd.date.slice(0, 4);
  return figure({
    bare: true, file: `india-atlas_cpi-iw_four-bases_${y0}-${y1}`,
    label: `CPI for industrial workers, year-on-year, on four bases from ${y0} to ${y1}, drawn side by side and never joined: base 1960, 1982, 2001 and 2016; the highest reading is ${f1(peak.p.value)} in ${longDate(peak.p.date)}; the current base ends at ${f1(curEnd.value)} in ${longDate(curEnd.date)}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, endSub: "Base 2016",
      series: rulers.map((r, i) => ({ name: r.label, data: kp(IW[r.key].general), role: i === rulers.length - 1 ? "lead" : i % 2 ? "ctx" : "ctx2", label: i === rulers.length - 1 })),
      events: rulers.slice(1).map((r) => ({ t: r.data[0].date, label: r.label, short: r.label.slice(5) })),
      notes: width < 520 ? [] : [{ d: peak.p.date, v: peak.p.value, text: `${f1(peak.p.value)}, ${fmtDate(peak.p.date)}\n${peak.r.label.replace("Base", "base")}` }],
    }),
  });
}

// §13 CPI-IW groups, base 2016
const IWLAB = { food: "Food", housing: "Housing", fuel: "Fuel and light", clothing: "Clothing", pan: "Pan, tobacco", misc: "Miscellaneous" };
{
  const G = IW.b2016, keys = Object.keys(IWLAB);
  const rows = keys.map((k) => ({ k, v: G[k].data.at(-1).value })).sort((a, b) => b.v - a.v);
  const fNow = G.food.data.at(-1).value, fY = G.food.data.at(-13).value;
  setTxt("pv-iwgrp", f1(rows[0].v));
  setTxt("pc-iwgrp", IWLAB[rows[0].k] + ", " + fmtDate(G.food.data.at(-1).date));
  setTxt("iwg-top", IWLAB[rows[0].k] + ", " + f1(rows[0].v));
  setTxt("iwg-bot", IWLAB[rows.at(-1).k] + ", " + f1(rows.at(-1).v));
  setTxt("iwg-food", f1(fNow)); setTxt("iwg-food-y", f1(fY));
  setTxt("iwg-food-dir", fNow > fY ? "food has gathered pace over the year" : "food has slowed over the year");
}
export function iwgrpChart() {
  const G = IW.b2016, role = { food: "lead", housing: "comp", fuel: "ctx", clothing: "ctx2", pan: "ctx2", misc: "ctx" };
  return figure({
    bare: true, file: "india-atlas_cpi-iw_groups_base2016",
    label: `CPI for industrial workers, six groups, year-on-year, base 2016, ${spanLong(G.food.data)}: ` + Object.keys(IWLAB).map((k) => `${IWLAB[k]} ends at ${f1(G[k].data.at(-1).value)}`).join("; "),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: ["pan", "clothing", "misc", "fuel", "housing", "food"].map((k) => ({ name: IWLAB[k], data: kp(G[k]), role: role[k] })),
    }),
  });
}

// §13 CPI-IW by centre
const iwcen = (() => {
  const Cn = hydrate(iwCenBundle), ai = lastOf(IW.b2016.general).value;
  const all = Object.values(Cn).map((s) => ({ s, name: s.label.replace(/ \(.*\)$/, ""), state: (s.label.match(/\((.*)\)$/) || [])[1], v: s.data.at(-1).value }))
    .filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const top = all[0], bot = all.at(-1);
  setTxt("pv-iwcen", (top.v - bot.v).toFixed(1) + " pt");
  setTxt("iwc-top", top.name + " (" + top.state + "), " + f1(top.v));
  setTxt("iwc-bot", bot.name + " (" + bot.state + "), " + f1(bot.v));
  setTxt("iwc-spread", (top.v - bot.v).toFixed(1) + " points");
  setTxt("iwc-above", numWord(all.filter((r) => r.v > ai).length, true));
  setTxt("iwc-n", String(all.length));
  setTxt("iwc-ai", f1(ai));
  setTxt("iwc-neg", String(all.filter((r) => r.v < 0).length));
  return { all, ai, when: Cn[Object.keys(Cn)[0]].data.at(-1).date };
})();
export function iwcenChart() {
  const { all, ai, when } = iwcen;
  const named = [...all.slice(0, 3), ...all.slice(-3)].map((r) => r.name);
  return figure({
    bare: true, file: "india-atlas_cpi-iw_centres_base2016",
    label: `CPI for industrial workers in each of ${all.length} centres, ${longDate(when)}, every centre a dot on one scale: ${all[0].name} highest at ${f1(all[0].v)}, ${all.at(-1).name} lowest at ${f1(all.at(-1).v)}; All India ${f1(ai)}`,
    data: { cols: ["Centre", "State", `y/y % ${when.slice(0, 7)}`], rows: all.map((r) => [r.name, r.state, r.v]) },
    draw: (width) => K.strip({ width, unit: PCT, ref: { value: ai, label: "All India" }, label: width < 520 ? [] : width < 1000 ? [all[0].name, all.at(-1).name] : named,
      values: all.map((r) => ({ name: r.name, v: r.v })) }),
  });
}

// §13 rural wages against CPI-AL
const wage = (() => {
  const w = WG.o1210, al = AL86.al;
  const byT = new Map(w.data.map((d) => [d.date, d.value])), alT = new Map(al.data.map((d) => [d.date, d.value]));
  const pts = w.data.map((d) => {
    const prev = byT.get(String(+d.date.slice(0, 4) - 1) + d.date.slice(4));
    return { date: d.date, w: d.value != null && prev != null ? Math.round((d.value / prev - 1) * 10000) / 100 : null, a: alT.get(d.date) ?? null };
  }).filter((p) => p.w != null && p.a != null);
  const lastW = lastOf(w), firstW = firstOf(w);
  setTxt("wage-span", fmtDate(pts[0].date) + " to " + fmtDate(pts.at(-1).date));
  setTxt("pv-wage", fmt.inrR(lastW.value)); setTxt("wg-now", fmt.inrR(lastW.value)); setTxt("wg-first", fmt.inrR(firstW.value));
  setTxt("wg-n", String(pts.length));
  setTxt("wg-above", String(pts.filter((p) => p.w > p.a).length));
  setTxt("wg-gap", (pts.reduce((t, p) => t + (p.w - p.a), 0) / pts.length).toFixed(1) + " points");
  return pts;
})();
export function wageChart() {
  const pts = wage;
  // a row per month from the first to the last joint reading; a month either series lacks is a gap
  const at = new Map(pts.map((p) => [p.date, p])), months = WG.o1210.data.map((d) => d.date).filter((d) => d >= pts[0].date && d <= pts.at(-1).date);
  const W = { name: "wage_growth_general_agri_labourer_yoy_pct", data: months.map((d) => ({ date: d, value: at.get(d)?.w ?? null })) };
  const A = { name: "cpi_al_yoy_pct_base1986", data: months.map((d) => ({ date: d, value: at.get(d)?.a ?? null })) };
  return figure({
    bare: true, file: "india-atlas_rural-wage_vs_cpi-al",
    label: `Growth of the daily wage of a general agricultural labourer against CPI-AL inflation, ${spanLong(pts)}: wage growth ends at ${f1(pts.at(-1).w)}, CPI-AL at ${f1(pts.at(-1).a)}; the wage grew faster than prices in ${pts.filter((p) => p.w > p.a).length} of ${pts.length} months`,
    data: csvOf([W, A]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "CPI-AL inflation", short: "CPI-AL", data: kp(A), role: "comp", color: K.C.turmeric },
        { name: "Wage growth", short: "Wage", data: kp(W), role: "lead" },
      ],
    }),
  });
}

// §13 the farm wage by state
const wagest = (() => {
  const STW = hydrate(wageStBundle), aiP = lastOf(WG.o1210), ai = aiP.value;
  const rows = Object.entries(wageStBundle.series).filter(([k]) => k.endsWith("_1210"))
    .map(([k, raw]) => ({ s: STW[k], name: raw.state, last: lastOf(STW[k]) })).filter((r) => r.last)
    .map((r) => ({ ...r, v: r.last.value, stale: r.last.date < aiP.date })).sort((a, b) => b.v - a.v);
  const top = rows[0], bot = rows.at(-1);
  setTxt("pv-wagest", fmt.inrR(top.v) + " to " + fmt.inrR(bot.v));
  setTxt("wgs-top", top.name + ", " + fmt.inrR(top.v));
  setTxt("wgs-bot", bot.name + ", " + fmt.inrR(bot.v));
  setTxt("wgs-ratio", (top.v / bot.v).toFixed(1));
  setTxt("wgs-ai", fmt.inrR(ai));
  return { rows, ai };
})();
export function wagestChart() {
  const { rows, ai } = wagest;
  return figure({
    bare: true, file: "india-atlas_rural-wage_states",
    label: `Daily wage of a general agricultural labourer by state, rupees, latest month each state reports: ${rows[0].name} pays most at ${fmt.inrR(rows[0].v)}, ${rows.at(-1).name} least at ${fmt.inrR(rows.at(-1).v)}; All India ${fmt.inrR(ai)}`,
    data: { cols: ["State", "Month", "Rupees a day"], rows: rows.map((r) => [r.name, r.last.date.slice(0, 7), r.v]) },
    draw: (width) => K.bars({ width, unit: { prefix: "₹" }, dp: 0, ref: { value: ai, label: "All India " + fmt.inrR(ai) },
      rows: rows.map((r) => ({ name: r.name, value: r.v, note: r.stale ? fmtDate(r.last.date) : undefined })) }),
  });
}

// ---------------------------------------------------------------- provenance
setTxt("prov-vintage", bundle_raw.meta.vintage);
setTxt("prov-vintage2", bundle2024_raw.meta.vintage);
setTxt("prov-vintage24", bundle2024_raw.meta.vintage);
setTxt("prov-vintage3", alrl2019Bundle_raw.meta.vintage);
