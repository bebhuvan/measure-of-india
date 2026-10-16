// WPI guide: the plates, drawn at build time with the chart kit (src/kit/), and every number the
// page shows (NUM, id -> HTML). Runs at build time only; the page ships no bundle JSON and no
// chart code beyond src/kit/enhance.js. WPI is a two-decimal guide: the bundles are baked at the
// OEA's two decimals and used as they are (pairs(..., { round: false })), exactly as the retired
// client did, so qc.mjs's fmt.pct2 checks and the prose see the same figures.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import bundle from "../../data/series/wpi.json";
import groupsBundle from "../../data/series/wpi-groups.json";
import subgroupsBundle from "../../data/series/wpi-subgroups.json";
import itemsBundle from "../../data/series/wpi-items.json";
import wpi2022Bundle from "../../data/series/wpi-2022.json";
import wpi1993Bundle from "../../data/series/wpi-1993.json";
import wpi2004Bundle from "../../data/series/wpi-2004.json";
import cpiBundle from "../../data/series/cpi.json";

const PCT = { suffix: "%" };
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MLONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmtDate = (d) => `${MN[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const longD = (d) => `${MLONG[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = (b, k) => pairs(b, k, { round: false });              // [[date, value]], nulls kept
const nn = (ps) => ps.filter((p) => p[1] != null);
const at = (ps, i) => ps.at(i)?.[1] ?? null;                     // the client read .data.at(i).value

// the retired client's renderers, kept to the character (qc.mjs checks several ids)
const pc = '<span class="pc">%</span>';
const arrow = (d) => (Math.abs(d) < 0.005 ? "unchanged" : (d > 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(2) + " pt");
const word = (d) => (d >= 0 ? "firming" : "easing");
const f1 = (v) => v.toFixed(2) + "%";
const p1 = (v) => K.num(v, { dp: 1, suffix: "%" });   // chart notes: a true minus
const f01 = (v) => (v < 0 ? "−" + Math.abs(v).toFixed(1) : v.toFixed(1)) + "%";
const peakOf = (ps) => ps.reduce((a, p) => (p[1] != null && (!a || p[1] > a[1]) ? p : a), null);
const troughOf = (ps) => ps.reduce((a, p) => (p[1] != null && (!a || p[1] < a[1]) ? p : a), null);

/** id -> HTML for every number the page shows. */
export const NUM = {};
const txt = (id, t) => { NUM[id] = esc(t); };
const html = (id, h) => { NUM[id] = h; };

const S = Object.fromEntries(Object.keys(bundle.series).map((k) => [k, P(bundle, k)]));
const N = Object.fromEntries(Object.keys(wpi2022Bundle.series).map((k) => [k, P(wpi2022Bundle, k)]));
const G = Object.fromEntries(Object.keys(groupsBundle.series).map((k) => [k, P(groupsBundle, k)]));
const L = {}, PV = {}, Y = {}; for (const k in S) { L[k] = at(S[k], -1); PV[k] = at(S[k], -2); Y[k] = at(S[k], -13); }

/* ---------- title strip and §01: the current base, 2022-23 ---------- */
const LN = {}, PN = {}; for (const k in N) { LN[k] = at(N[k], -1); PN[k] = at(N[k], -2); }
const latestN = N.headline.at(-1)[0], prevNameN = fmtDate(N.headline.at(-2)[0]);
for (const [id, k] of [["head", "headline"], ["food", "food_index"], ["fuel", "fuel"], ["mfg", "manufactured"]]) {
  html("n-" + id, LN[k].toFixed(2) + pc);
  html("d-" + id, `<b>${arrow(LN[k] - PN[k])}</b> vs ${prevNameN}, ${word(LN[k] - PN[k])}`);
}
html("rb-big", LN.headline.toFixed(2) + pc);
html("rb-prev", PN.headline.toFixed(2) + pc);
{
  const r = wpi2022Bundle.meta.releaseDate;
  const relTxt = `${+r.slice(8, 10)} ${MLONG[+r.slice(5, 7) - 1]} ${r.slice(0, 4)}, provisional`;
  txt("m-latest", longD(latestN)); txt("m-released", relTxt); txt("rd-unit", `Recorded ${relTxt}`);
  const low = nn(N.headline.slice(-13, -1)).reduce((a, b) => (b[1] < a[1] ? b : a));
  txt("rt-cap", `Headline wholesale inflation, ${longD(latestN)}, on the new 2022–23 base. In ${longD(low[0])} it was ${low[1] < 0 ? "−" + Math.abs(low[1]).toFixed(2) : low[1].toFixed(2)}%, the low point of the twelve months before.`);
}
export const spark = K.spark(N.headline, { width: 190, height: 44 });

/* ---------- §02 the new base: two rulers through the overlap ---------- */
const newS = nn(N.headline);
const oldPub = bundle.dates.map((d, i) => [d, bundle.crosscheck.published_headline[i]]).filter((p) => p[1] != null && p[0] >= newS[0][0]);
const oldEnd = oldPub.at(-1);
{
  const byT = new Map(oldPub);
  let n = 0, gap = 0, gapAt = null, both = null;
  for (const [d, v] of newS) { const o = byT.get(d); if (o == null) continue; n++; both = { d, nw: v, old: o }; if (Math.abs(v - o) > gap) { gap = Math.abs(v - o); gapAt = d; } }
  txt("nb-title", `Two rulers, ${n} shared months, never more than ${gap.toFixed(1)} points apart`);
  txt("nb-sub", `WPI headline, year-on-year, per cent, base 2022–23 (${fmtDate(newS[0][0])} to ${fmtDate(newS.at(-1)[0])}) and base 2011–12 (to ${fmtDate(oldEnd[0])}), published indices, never joined`);
  txt("pv-nb", f1(newS.at(-1)[1]));
  txt("pc-nb", `${fmtDate(newS.at(-1)[0])}, base 2022–23, y/y`);
  txt("nb-new", f1(newS.at(-1)[1])); txt("nb-new-m", fmtDate(newS.at(-1)[0]));
  if (both) { txt("nb-both-new", f1(both.nw)); txt("nb-both-old", f1(both.old)); txt("nb-both-m", fmtDate(both.d)); }
  txt("nb-n", String(n)); txt("nb-gap", gap.toFixed(1) + " pt"); txt("nb-gap-m", gapAt ? fmtDate(gapAt) : "–");
}
export function nb() {
  return figure({
    bare: true, file: `india-atlas_wpi2022_vs_wpi2011_headline_${newS[0][0].slice(0, 4)}-${newS.at(-1)[0].slice(0, 4)}`,
    label: `Headline WPI inflation on the new 2022-23 base, ${fmtDate(newS[0][0])} to ${fmtDate(newS.at(-1)[0])}, beside the old 2011-12 base through the months both describe, never joined`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: [
        { name: "Base 2011–12, published headline", short: "2011–12 base", data: oldPub, role: "ctx" },
        { name: "Base 2022–23, published headline", short: "2022–23 base", data: newS, role: "lead" },
      ],
      events: [{ t: oldEnd[0], label: `Old base ends, ${fmtDate(oldEnd[0])}`, short: "Old base ends", side: "left" }],
    }),
  });
}

/* ---------- §02 thirty years on four rulers ---------- */
const RUL = [
  { k: "b1993", name: "Base 1993–94", data: nn(P(wpi1993Bundle, "headline")), color: K.C.ctx2 },
  { k: "b2004", name: "Base 2004–05", data: nn(P(wpi2004Bundle, "headline")), color: K.C.ctx },
  { k: "b2011", name: "Base 2011–12", data: nn(S.headline), color: K.C.muted },
  { k: "b2022", name: "Base 2022–23", data: newS, color: K.C.lead },
];
{
  const all = RUL.flatMap((r) => r.data.map((p) => ({ p, r })));
  const pk = all.reduce((a, b) => (b.p[1] > a.p[1] ? b : a)), tr = all.reduce((a, b) => (b.p[1] < a.p[1] ? b : a));
  const end = RUL.at(-1).data.at(-1);
  txt("pv-long", f1(end[1]));
  txt("pc-long", fmtDate(end[0]) + ", base 2022–23");
  txt("long-peak", pk.p[1].toFixed(1) + "% in " + longD(pk.p[0]) + ", on the " + pk.r.name.toLowerCase().replace("base ", "") + " base");
  txt("long-trough", tr.p[1].toFixed(1) + "% in " + longD(tr.p[0]) + ", on the " + tr.r.name.toLowerCase().replace("base ", "") + " base");
  txt("long-now", f1(end[1]));
  RUL.peak = pk.p; RUL.trough = tr.p;
}
export function long() {
  const y0 = RUL[0].data[0][0].slice(0, 4), y1 = RUL.at(-1).data.at(-1)[0].slice(0, 4);
  return figure({
    bare: true, file: `india-atlas_wpi_four-bases_${y0}-${y1}`,
    label: `Headline WPI, year-on-year, ${y0} to ${y1}, on four bases drawn side by side and never joined: 1993-94, 2004-05, 2011-12 and 2022-23`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: RUL.map((r, i) => ({ name: r.name, short: r.name.replace("Base ", "") + " base", data: r.data, color: r.color, role: i === 3 ? "lead" : "ctx", label: i >= 2 })),
      events: RUL.slice(1).map((r) => ({ t: r.data[0][0], label: `${r.name} from ${fmtDate(r.data[0][0])}`, short: r.name.replace("Base ", "") })),
      // the record high and low are named where there is room; the prose beside quotes both
      notes: width < 1000 ? [] : [
        { d: RUL.peak[0], v: RUL.peak[1], text: `${p1(RUL.peak[1])}, ${fmtDate(RUL.peak[0])}\nthe record high` },
        { d: RUL.trough[0], v: RUL.trough[1], text: `${p1(RUL.trough[1])}, ${fmtDate(RUL.trough[0])}\nthe record low`, below: true },
      ],
    }),
  });
}

/* ---------- §03 register ---------- */
const sparkTd = (ps) => K.spark(ps, { width: 190, height: 44 });
{
  const regRows = [
    ["headline", "Headline WPI", "All commodities: computed from the three major groups", "s-acc", "100.0", "#2E4BD8"],
    ["primary", "Primary articles", "Farm, mineral: the volatile rim", "s-g1", "22.62", "#5F6675"],
    ["fuel", "Fuel & power", "Mineral oils, electricity, coal", "s-g2", "13.15", "#A3A9B4"],
    ["manufactured", "Manufactured products", "Two-thirds of the basket: the calm core", "s-g3", "64.23", "#C9CED6"],
    ["food_index", "Food index", "Primary + manufactured food: published directly", "s-g4", "—", "#878D99"],
  ];
  const groupRows = [
    ["food_articles", "Food articles", "Group, under primary: the mandi gate", "s-g1"],
    ["crude_petroleum_natural_gas", "Crude petroleum & natural gas", "Group, under primary: the wellhead", "s-g2"],
    ["mineral_oils", "Mineral oils", "Group, under fuel & power: the refinery gate", "s-g3"],
    ["manufacture_of_basic_metals", "Basic metals", "Group, under manufactured: steel, aluminium", "s-g4"],
    ["manufacture_of_chemicals_and_chemical_products", "Chemicals & chemical products", "Group, under manufactured", "s-g1"],
    ["manufacture_of_textiles", "Textiles", "Group, under manufactured: the loom", "s-g2"],
  ];
  const itemRows = [
    ["petrol", "Petrol", "Item, under mineral oils: the refinery gate, before taxes", "s-g2"],
    ["gold_gold_ornaments", "Gold & gold ornaments", "Item, under other manufacturing: the metal behind the jewellery group", "s-g4"],
    ["onion", "Onion", "Item, under food articles: the old headline-maker", "s-g1"],
  ];
  const row = (nm, sub, sw, wtCell, ps) => {
    const l = at(ps, -1), p = at(ps, -2), y = at(ps, -13);
    return `<tr><td class="name"><span class="sw ${sw}"></span>${esc(nm)}<small>${esc(sub)}</small></td><td class="wt">${wtCell}</td><td class="val">${f1(l)}</td><td class="chg">${arrow(l - p)}, ${word(l - p)}</td><td class="yr">${f1(y)}</td><td class="spark">${sparkTd(ps)}</td></tr>`;
  };
  html("ledger-body",
    regRows.map(([k, nm, sub, sw, wt, col]) => row(nm, sub, sw, wt + (wt !== "—" ? `<span class="wtrack"><i style="width:${wt}%;background:${col}"></i></span>` : ""), S[k])).join("") +
    groupRows.map(([k, nm, sub, sw]) => row(nm, sub, sw, "—", G[k])).join("") +
    itemRows.map(([k, nm, sub, sw]) => row(nm, sub, sw, "—", P(itemsBundle, k))).join(""));
}

/* ---------- §04 basket ---------- */
{
  const groups = [["Primary articles", 22.62, "#2E4BD8"], ["Fuel & power", 13.15, "#4A5160"], ["Manufactured products", 64.23, "#A3A9B4"]];
  html("basket-bar", groups.map(([n, w, c]) => `<div class="seg" style="width:${w}%;background:${c}" title="${esc(n)}: ${w}%"></div>`).join(""));
  html("basket-labels", groups.map(([n, w, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${esc(n)}</div><div class="w">${w.toFixed(2)}%</div></div>`).join(""));
}

/* ---------- §05 plate 1 and the component plates (base 2011-12) ---------- */
txt("pv-main", f1(L.headline));
txt("pv-fuel", f1(L.fuel)); txt("pv-mfg", f1(L.manufactured));
txt("ex-fuel", f1(L.fuel)); txt("ex-mfg", f1(L.manufactured));
txt("ex-hsep", f1(S.headline.find((p) => p[0].startsWith("2025-09"))[1])); txt("ex-hapr", f1(L.headline));
const pkFuel = peakOf(S.fuel), pkMfg = peakOf(S.manufactured);
txt("pf-fuel", `peak: ${pkFuel[1].toFixed(1)}%, ${fmtDate(pkFuel[0])}, latest: ${f1(L.fuel)}`);
txt("pf-mfg", `peak: ${pkMfg[1].toFixed(1)}%, ${fmtDate(pkMfg[0])}, latest: ${f1(L.manufactured)}`);

export function main() {
  const pk22 = peakOf(S.headline.filter((p) => p[0] >= "2021" && p[0] < "2023"));
  const tr23 = troughOf(S.headline.filter((p) => p[0].startsWith("2023")));
  return figure({
    bare: true, file: "india-atlas_wpi_headline-components_2016-2026",
    label: `Headline WPI and its parts, year-on-year, ${fmtDate(S.headline[0][0])} to ${fmtDate(S.headline.at(-1)[0])}: headline ${f1(L.headline)}, primary articles ${f1(L.primary)}, manufactured ${f1(L.manufactured)}, food index ${f1(L.food_index)}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: [
        { name: "Food index", short: "Food index", data: S.food_index, role: "ctx", color: K.C.ctx2 },
        { name: "Manufactured", short: "Manufactured", data: S.manufactured, role: "ctx" },
        { name: "Primary articles", short: "Primary", data: S.primary, role: "ctx", color: K.C.ink2 },
        { name: "Headline", short: "Headline", data: S.headline, role: "lead" },
      ],
      events: [{ t: "2020-04-01", label: "COVID-19" }],
      notes: width < 520 ? [] : [
        { d: pk22[0], v: pk22[1], text: `${p1(pk22[1])}, ${fmtDate(pk22[0])}\ncommodity shock` },
        { d: tr23[0], v: tr23[1], text: `${p1(tr23[1])}, ${fmtDate(tr23[0])}\nseven months below zero`, below: true },
      ],
    }),
  });
}
function component(key, name, file) {
  const s = S[key], pk = peakOf(s);
  return figure({
    bare: true, file,
    label: `${name} inflation, year-on-year, ${fmtDate(s[0][0])} to ${fmtDate(s.at(-1)[0])}, ending at ${f1(L[key])}, peaking at ${pk[1].toFixed(1)}% in ${fmtDate(pk[0])}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: [{ name, data: s, role: "lead" }],
      notes: [{ d: pk[0], v: pk[1], text: `${p1(pk[1])}, ${fmtDate(pk[0])}` }],
    }),
  });
}
export const fuel = () => component("fuel", "Fuel & power", "india-atlas_wpi_fuel_2016-2026");
export const mfg = () => component("manufactured", "Manufactured products", "india-atlas_wpi_manufactured_2016-2026");

/* ---------- §08 the 29 groups: two classes, two shared axes ---------- */
const SHORT = {
  coal: "Coal", crude_petroleum_natural_gas: "Crude petroleum & gas", electricity: "Electricity", food_articles: "Food articles",
  manufacture_of_basic_metals: "Basic metals", manufacture_of_beverages: "Beverages", manufacture_of_chemicals_and_chemical_products: "Chemicals",
  manufacture_of_computer_electronic_and_optical_products: "Computers & electronics", manufacture_of_electrical_equipment: "Electrical equipment",
  manufacture_of_fabricated_metal_products_except_machinery_and_equipment: "Fabricated metals", manufacture_of_food_products: "Food products (mfd.)",
  manufacture_of_furniture: "Furniture", manufacture_of_leather_and_related_products: "Leather", manufacture_of_machinery_and_equipment: "Machinery & equipment",
  manufacture_of_motor_vehicles_trailers_and_semi_trailers: "Motor vehicles", manufacture_of_other_non_metallic_mineral_products: "Non-metallic minerals",
  manufacture_of_other_transport_equipment: "Other transport eq.", manufacture_of_paper_and_paper_products: "Paper",
  manufacture_of_pharmaceuticals_medicinal_chemical_and_botanical_products: "Pharmaceuticals", manufacture_of_rubber_and_plastics_products: "Rubber & plastics",
  manufacture_of_textiles: "Textiles", manufacture_of_tobacco_products: "Tobacco", manufacture_of_wearing_apparel: "Wearing apparel",
  manufacture_of_wood_and_of_products_of_wood_and_cork: "Wood & cork", mineral_oils: "Mineral oils", minerals: "Minerals",
  non_food_articles: "Non-food articles", other_manufacturing: "Other manufacturing", printing_and_reproduction_of_recorded_media: "Printing & media",
};
const HOT = 6, WILD = 20, DWILD = [-50, 90], DCALM = [-12, 20];
const DOM = { [DWILD]: { lo: -50, hi: 90, ticks: [-50, 0, 50] }, [DCALM]: { lo: -12, hi: 20, ticks: [-10, 0, 10, 20] } };
const GR = Object.keys(G).map((k) => ({ k, s: G[k], latest: at(G[k], -1), wild: G[k].some((p) => Math.abs(p[1]) > WILD) }));
const gWild = GR.filter((r) => r.wild).sort((a, b) => b.latest - a.latest), gCalm = GR.filter((r) => !r.wild).sort((a, b) => b.latest - a.latest);
{
  const sg = (v) => (v < 0 ? "−" + Math.abs(v) : "+" + v);
  txt("cap-wild", `The commodity rim: ${gWild.length} groups whose y/y has left ±20%, shared axis ${sg(DWILD[0]).replace("+", "")} … ${sg(DWILD[1])}`);
  txt("cap-calm", `The manufactured mass: ${gCalm.length} groups, shared axis ${sg(DCALM[0]).replace("+", "")} … ${sg(DCALM[1])}`);
  txt("pf-nhot", String(GR.filter((r) => Math.abs(r.latest) > HOT).length));
  const name0 = SHORT[gWild[0].k] || groupsBundle.series[gWild[0].k].label;
  txt("pv-groups", f1(gWild[0].latest));
  txt("pc-groups", fmtDate(G[gWild[0].k].at(-1)[0]) + ", " + name0 + ": hottest group");
  const LG = (k) => at(G[k], -1);
  txt("ex-gcrude", f01(LG("crude_petroleum_natural_gas"))); txt("ex-goil", f01(LG("mineral_oils")));
  txt("ex-gother", f01(LG("other_manufacturing"))); txt("ex-gtext", f01(LG("manufacture_of_textiles")));
  txt("ex-gmet", f01(LG("manufacture_of_basic_metals")));
}
function groupGrid(rows, domain, label) {
  return figure({
    bare: true, file: "india-atlas_wpi_29-groups_2016-2026", label,
    draw: (width) => K.multiples({
      width, unit: PCT, domain: DOM[domain], boldHighlight: true, ph: domain === DWILD ? 96 : 70,
      panels: rows.map((r) => ({ name: SHORT[r.k] || groupsBundle.series[r.k].label, data: r.s, highlight: Math.abs(r.latest) > HOT })),
    }),
  });
}
export const groupsWild = () => groupGrid(gWild, DWILD, `Small multiples of the ${gWild.length} most volatile WPI groups, year-on-year, 2016 to 2026, on one shared axis from −50 to +90 per cent, ranked by latest value; blue where the latest reading is outside ±6 per cent. Hottest: ${SHORT[gWild[0].k]} at ${f1(gWild[0].latest)}.`);
export const groupsCalm = () => groupGrid(gCalm, DCALM, `Small multiples of the ${gCalm.length} quieter WPI groups, year-on-year, 2016 to 2026, on one shared axis from −12 to +20 per cent, ranked by latest value; blue where the latest reading is outside ±6 per cent. Hottest: ${SHORT[gCalm[0].k]} at ${f1(gCalm[0].latest)}.`);

/* ---------- §09 the 134 sub-groups: extremes ledger ---------- */
{
  const all = Object.keys(subgroupsBundle.series).map((k) => {
    const d = P(subgroupsBundle, k);
    return { k, d, label: subgroupsBundle.series[k].label, latest: at(d, -1), prevV: at(d, -2), yr: at(d, -13) };
  }).sort((a, b) => b.latest - a.latest || a.label.localeCompare(b.label));
  const top = all.slice(0, 15), bot = all.slice(-15);
  const shortLabel = (r) => r.label.replace(/^Manufacture of /, "").replace(/^./, (c) => c.toUpperCase());
  const row = (r, rank) => `<tr><td class="name">${esc(shortLabel(r))}<small>${rank} of 134, ${esc(r.label)}</small></td><td class="val">${f1(r.latest)}</td><td class="chg">${arrow(r.latest - r.prevV)}, ${word(r.latest - r.prevV)}</td><td class="yr">${f1(r.yr)}</td><td class="spark">${sparkTd(r.d)}</td></tr>`;
  html("tail-body", top.map((r, i) => row(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="5">⋯ ${all.length - 30} sub-groups between ${f1(top.at(-1).latest)} and ${f1(bot[0].latest)}: the full field ships in the CSV ⋯</td></tr>` +
    bot.map((r, i) => row(r, all.length - 14 + i)).join(""));
  const vals = all.map((r) => r.latest);
  txt("pv-tail", f1(top[0].latest));
  txt("pc-tail", fmtDate(top[0].d.at(-1)[0]) + ", " + shortLabel(top[0]).slice(0, 34) + ": hottest sub-group");
  txt("pf-tail", `cut lines: 15th hottest ${f1(top.at(-1).latest)}, 15th coldest ${f1(bot[0].latest)}`);
  txt("ex-tspan", (top[0].latest - bot.at(-1).latest).toFixed(1));
  txt("ex-ttopn", shortLabel(top[0]).toLowerCase()); txt("ex-ttop", f01(top[0].latest));
  txt("ex-tbotn", shortLabel(bot.at(-1)).toLowerCase()); txt("ex-tbot", f01(bot.at(-1).latest));
  txt("ex-tmed", f01((vals[66] + vals[67]) / 2));
  txt("ex-tneg", String(vals.filter((v) => v < 0).length));
}

/* ---------- §10 the 697 items: extremes ledger and the cross-section CSV ---------- */
{
  const IM = itemsBundle.series;
  const allI = Object.keys(IM).map((k) => {
    const d = P(itemsBundle, k);
    return { k, d, label: IM[k].label, lineage: IM[k].lineage.split(" › ").slice(1).join(" › "), latest: at(d, -1), prevV: at(d, -2), yr: at(d, -13) };
  }).filter((r) => r.latest != null).sort((a, b) => b.latest - a.latest || a.label.localeCompare(b.label));
  const nRanked = allI.length, nItems = Object.keys(IM).length;
  const topI = allI.slice(0, 15), botI = allI.slice(-15);
  const rowI = (r, rank) => `<tr><td class="name">${esc(r.label)}<small>${rank} of ${nRanked}, ${esc(r.lineage)}</small></td><td class="val">${f1(r.latest)}</td><td class="chg">${r.prevV == null ? "—" : `${arrow(r.latest - r.prevV)}, ${word(r.latest - r.prevV)}`}</td><td class="yr">${r.yr == null ? "—" : f1(r.yr)}</td><td class="spark">${sparkTd(r.d)}</td></tr>`;
  html("items-body", topI.map((r, i) => rowI(r, i + 1)).join("") +
    `<tr class="tail-mid"><td colspan="5">⋯ ${nRanked - 30} items between ${f1(topI.at(-1).latest)} and ${f1(botI[0].latest)}: the full field ships in the CSV ⋯</td></tr>` +
    botI.map((r, i) => rowI(r, nRanked - 14 + i)).join(""));
  const v = allI.map((r) => r.latest);
  const med = nRanked % 2 ? v[(nRanked - 1) / 2] : (v[nRanked / 2 - 1] + v[nRanked / 2]) / 2;
  txt("pv-items", f1(topI[0].latest));
  txt("pc-items", fmtDate(topI[0].d.at(-1)[0]) + ", " + topI[0].label.slice(0, 34) + ": hottest item");
  txt("pf-items", `${nRanked} of ${nItems} items carry an April y/y, cut lines: 15th hottest ${f1(topI.at(-1).latest)}, 15th coldest ${f1(botI[0].latest)}`);
  txt("ex-ispan", (topI[0].latest - botI.at(-1).latest).toFixed(1));
  txt("ex-itopn", topI[0].label.toLowerCase()); txt("ex-itop", f01(topI[0].latest));
  txt("ex-ibotn", botI.at(-1).label.toLowerCase()); txt("ex-ibot", f01(botI.at(-1).latest));
  txt("ex-imed", f01(med)); txt("ex-ineg", String(v.filter((x) => x < 0).length));
  const il = (k) => at(P(itemsBundle, k), -1);
  txt("ex-ipetrol", f01(il("petrol"))); txt("ex-iatf", f01(il("atf"))); txt("ex-ihsd", f01(il("hsd"))); txt("ex-ionion", f01(il("onion")));
}
/** The items plate's CSV: one row per item, its lineage, latest index level and the ledger's three
 *  y/y readings. Not a chart: a data-only kit figure, so the plate's CSV button downloads it. */
export function itemsData() {
  const IM = itemsBundle.series, ym = itemsBundle.meta.latestPeriod;
  const rows = Object.keys(IM).sort().map((k) => { const d = P(itemsBundle, k); return [IM[k].label, IM[k].lineage, IM[k].latestIndex ?? null, at(d, -1), at(d, -2), at(d, -13)]; });
  const data = { cols: ["item", "lineage", `index_${ym.replace("-", "")}`, "yoy_pct", "yoy_prev_month_pct", "yoy_year_ago_pct"], rows };
  return `<div class="akf akf-bare" data-file="india-atlas_wpi_697-items_cross-section_${ym}"><script type="application/json" class="akf-data">${JSON.stringify(data).replace(/</g, "\\u003c")}</script></div>`;
}

/* ---------- §11 wholesale food against retail food ---------- */
const cpiFood = new Map(P(cpiBundle, "food"));
const W2R = S.food_index.filter((p) => p[1] != null && cpiFood.get(p[0]) != null).map((p) => ({ d: p[0], w: p[1], c: cpiFood.get(p[0]) }));
{
  const pts = W2R;
  const corr = (a, b) => { const n = a.length, ma = a.reduce((x, y) => x + y, 0) / n, mb = b.reduce((x, y) => x + y, 0) / n;
    let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); };
  const best = [0, 1, 2, 3, 4, 5, 6].map((lag) => ({ lag, r: corr(pts.slice(0, pts.length - lag).map((p) => p.w), pts.slice(lag).map((p) => p.c)) })).reduce((a, b) => (b.r > a.r ? b : a));
  const rng = (k) => { const v = pts.map((p) => p[k]); return f1(Math.min(...v)) + " and " + f1(Math.max(...v)); };
  const mad = (k) => pts.slice(1).reduce((t, p, i) => t + Math.abs(p[k] - pts[i][k]), 0) / (pts.length - 1);
  const ratio = mad("w") / mad("c");
  const softer = ratio > 1.15 ? ", and softer" : ratio < 0.87 ? ", and louder" : "";
  txt("w2r-span", fmtDate(pts[0].d) + " to " + fmtDate(pts.at(-1).d));
  txt("w2r-title", best.lag === 0 ? `Retail food moves with wholesale food in the same month${softer}` : `Retail food follows wholesale food about ${best.lag} month${best.lag > 1 ? "s" : ""} later${softer}`);
  txt("w2r-sd", ratio.toFixed(1) + " times as much as");
  txt("pv-w2r", best.lag + (best.lag === 1 ? " month" : " months"));
  txt("pc-w2r", "best-fitting lag, correlation " + best.r.toFixed(2));
  txt("w2r-n", String(pts.length));
  txt("w2r-lag", best.lag === 0 ? "with no shift at all, in the same month" : "when shifted " + best.lag + (best.lag === 1 ? " month" : " months") + " later");
  txt("w2r-r", best.r.toFixed(2));
  txt("w2r-wrange", rng("w")); txt("w2r-crange", rng("c"));
}
export function w2r() {
  return figure({
    bare: true, file: "india-atlas_wpi-food_vs_cpi-food",
    label: `Wholesale food prices (WPI food index) against retail food prices (CPI food and beverages), year-on-year, ${fmtDate(W2R[0].d)} to ${fmtDate(W2R.at(-1).d)}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: [
        { name: "Retail food (CPI)", short: "Retail food", data: W2R.map((p) => [p.d, p.c]), role: "comp" },
        { name: "Wholesale food (WPI)", short: "Wholesale food", data: W2R.map((p) => [p.d, p.w]), role: "lead" },
      ],
    }),
  });
}

/* ---------- provenance ---------- */
txt("prov-vintage", bundle.meta.vintage);
txt("prov-vintage2", bundle.meta.vintage);
