// IIP guide: the plates, drawn at build time with the chart kit (src/kit/), and the page's numbers,
// computed from the same bundles. Each plate export returns a bare figure for its .plotzone; titles,
// source lines and buttons stay in src/pages/guides/iip.astro. Rates are rounded once, at the
// precision MoSPI publishes (src/dossiers/precision.js), so every figure and every delta on the page
// is the arithmetic a reader can redo from what is shown. Bases are never spliced: each ruler is
// its own series.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { roundRates } from "./precision.js";
import * as fmt from "../charts/format.js";
import b22raw from "../../data/series/iip-2022.json";
import b11raw from "../../data/series/iip-2011.json";
import ind22raw from "../../data/series/iip-industries-2022.json";
import ind11raw from "../../data/series/iip-industries-2011.json";
import h04raw from "../../data/series/iip-2004.json";
import h93raw from "../../data/series/iip-1993.json";
import h80raw from "../../data/series/iip-1980.json";
import ispRaw from "../../data/series/isp.json";
import fy80raw from "../../data/series/iip-annual-1980.json";
import fy93raw from "../../data/series/iip-annual-1993.json";
import fy04raw from "../../data/series/iip-annual-2004.json";
import fy11raw from "../../data/series/iip-annual-2011.json";
import fy22raw from "../../data/series/iip-annual-2022.json";
import c93raw from "../../data/series/core-1993.json";
import c04raw from "../../data/series/core-2004.json";
import c11raw from "../../data/series/core-2011.json";

const [B, OLD, IND, OIND, H04, H93, H80, ISP, FY80, FY93, FY04, FY11, FY22, C93, C04, C11] =
  [b22raw, b11raw, ind22raw, ind11raw, h04raw, h93raw, h80raw, ispRaw, fy80raw, fy93raw, fy04raw, fy11raw, fy22raw, c93raw, c04raw, c11raw].map((b) => roundRates(b));

const PCT = { suffix: "%" };
const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MLONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const mShort = (d) => `${MN[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const mLong = (d) => `${MLONG[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const fyL = (d) => `${d.slice(0, 4)}-${String((+d.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
const f1 = (v) => v.toFixed(1) + "%";
const fS = fmt.pct1Minus; // a true minus; one decimal, as MoSPI prints IIP growth
const f1s = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; // a minus, no plus
const fSigned = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** [[date, value]] for one series, nulls kept; leading and trailing nulls trimmed (a base's first
 * year has no same-base year-ago level). Interior nulls stay: a gap, never joined. */
function ser(b, k) {
  const P = b.dates.map((d, i) => [d, b.series[k].data[i] ?? null]);
  let i = 0, j = P.length - 1;
  while (i < P.length && P[i][1] == null) i++;
  while (j > i && P[j][1] == null) j--;
  return P.slice(i, j + 1);
}
const lastP = (P) => { for (let i = P.length - 1; i >= 0; i--) if (P[i][1] != null) return P[i]; return null; };
const minP = (P) => P.reduce((a, p) => (p[1] != null && (!a || p[1] < a[1]) ? p : a), null);
const maxP = (P) => P.reduce((a, p) => (p[1] != null && (!a || p[1] > a[1]) ? p : a), null);

// whole per cent, as the prose quotes the lockdown prints (−57%, +134%)
const pct0 = (v, plus = false) => (v < 0 ? "−" : plus ? "+" : "") + Math.abs(Math.round(v)) + "%";

/* ---------- §03: the two modern bases, side by side ---------- */
export function bases() {
  const old = ser(OLD, "general"), cur = ser(B, "general");
  const lo = minP(old), hi = maxP(old);
  return figure({
    bare: true, file: "india-atlas_iip_two-bases",
    label: `IIP general index, year-on-year, on the retired 2011-12 base (${mShort(old[0][0])} to ${mShort(lastP(old)[0])}) and the current 2022-23 base (${mShort(cur[0][0])} to ${mShort(lastP(cur)[0])}), drawn side by side and never spliced; the current base ends at ${f1(lastP(cur)[1])}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Base 2011-12", short: "2011-12 base", data: old, role: "ctx" },
        { name: "Base 2022-23", short: "2022-23 base", data: cur, role: "lead" },
      ],
      events: [
        { t: "2020-04-01", label: `COVID-19, ${pct0(lo[1])} then ${pct0(hi[1], true)}`, short: "COVID-19", side: "left" },
        { t: "2023-04-01", label: "Base revised, 2011-12 → 2022-23", short: "New base" },
      ],
    }),
  });
}

/* ---------- §03: the deep ledger, three retired rulers ---------- */
export function herit() {
  const h80 = ser(H80, "general"), h93 = ser(H93, "general"), h04 = ser(H04, "general");
  const tr = minP(h04), g93 = h93.find(([d]) => d === tr[0]);
  return figure({
    bare: true, file: "india-atlas_iip_heritage-bases",
    label: `IIP general index, year-on-year, on the retired 1980-81, 1993-94 and 2004-05 bases, 1982 to 2017, side by side and never spliced: in ${mLong(tr[0])} the 2004-05 base printed ${fS(tr[1])} while the 1993-94 base read ${fSigned(g93[1])}`,
    // the rulers end mid-chart, so they are named where each begins (the seam and the event),
    // not at the right edge on long leaders; their final prints are in the prose and the CSV
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, yDomain: [-20, 30],
      series: [
        { name: "Base 1980-81 (RBI's copy)", data: h80, role: "ctx2", label: false },
        { name: "Base 1993-94", data: h93, role: "comp", label: false },
        { name: "Base 2004-05", data: h04, role: "lead", label: false },
      ],
      seam: { t: "1995-04-01", before: width < 520 ? "1980-81" : "Base 1980-81", after: width < 520 ? "1993-94" : "Base 1993-94" },
      events: [{ t: "2006-04-01", label: "Base 2004-05 begins", short: "2004-05" }],
      // one note at the winter: the two rulers' verdicts on the same month
      notes: [{ d: tr[0], v: tr[1], text: width < 520 ? `${mShort(tr[0])}: ${fS(tr[1])}\n${fSigned(g93[1])} on 1993-94` : `${mShort(tr[0])}: ${fS(tr[1])} on base 2004-05\n${fSigned(g93[1])} on base 1993-94, same month`, below: true }],
    }),
  });
}

/* ---------- §04: financial years, five rulers ---------- */
const FYR = [["1980-81", FY80, "ctx2"], ["1993-94", FY93, "ctx"], ["2004-05", FY04, "ctx2"], ["2011-12", FY11, "ctx"], ["2022-23", FY22, "lead"]];
export function fy() {
  const R = FYR.map(([base, b, role]) => ({ base, role, P: ser(b, "general_growth") }));
  const falls = R.flatMap((r) => r.P.filter(([, v]) => v != null && v < 0).map(([d, v]) => ({ d, v, base: r.base })));
  const cur = R.at(-1), L = lastP(cur.P), minFall = falls.reduce((a, f) => (!a || f.v < a.v ? f : a), null);
  return figure({
    bare: true, file: "india-atlas_iip_financial-years_five-bases",
    label: `IIP growth by financial year on five bases drawn side by side, ${fyL(R[0].P[0][0])} to ${fyL(L[0])}: output fell in ${falls.map((f) => `${fyL(f.d)} (${fS(f.v)}, base ${f.base})`).join(", ")}; ${fyL(L[0])} grew ${f1(L[1])} on base 2022-23`,
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1,
      series: R.map((r) => ({ name: `Base ${r.base}`, short: `${r.base} base`, data: r.P, role: r.role, label: r.base === "2022-23" || r.base === "2011-12" })),
      events: R.slice(1).map((r) => ({ t: r.P[0][0], label: `${r.base} base`, short: r.base })),
      // the deepest fall, and the one fall a single ruler saw (2013-14, base 2004-05, which the
      // 2011-12 base reads as growth); every fall is in the label, the CSV and the prose
      notes: falls.filter((f) => f === minFall || (f.base === "2004-05" && width >= 1000)).map((f) => ({ d: f.d, v: f.v, text: `${fS(f.v)}, ${fyL(f.d)}\nbase ${f.base}`, below: true })),
    }),
  });
}

/* ---------- §05 and §09: the industry grids (small multiples on one clipped scale) ---------- */
const IND_P = "sub_manufacturing_";
const IND_SHORT = {
  manufacture_of_basic_metals: "Basic metals",
  manufacture_of_basic_pharmaceutical_products_and_pharmaceutical_preparations: "Pharmaceuticals",
  manufacture_of_beverages: "Beverages",
  manufacture_of_chemicals_and_chemical_products: "Chemicals",
  manufacture_of_coke_and_refined_petroleum_products: "Coke & refined petroleum",
  manufacture_of_computer_electronic_and_optical_products: "Electronics & optical",
  manufacture_of_electrical_equipment: "Electrical equipment",
  manufacture_of_fabricated_metal_products_except_machinery_and_equipment: "Fabricated metals",
  manufacture_of_food_products: "Food products",
  manufacture_of_furniture: "Furniture",
  manufacture_of_leather_and_related_products: "Leather",
  manufacture_of_machinery_and_equipment_n_e_c: "Machinery n.e.c.",
  manufacture_of_motor_vehicles_trailers_and_semi_trailers: "Motor vehicles",
  manufacture_of_other_non_metallic_mineral_products: "Non-metallic minerals",
  manufacture_of_other_transport_equipment: "Other transport equipment",
  manufacture_of_paper_and_paper_products: "Paper",
  manufacture_of_rubber_and_plastics_products: "Rubber & plastics",
  manufacture_of_textiles: "Textiles",
  manufacture_of_tobacco_products: "Tobacco",
  manufacture_of_wearing_apparel: "Wearing apparel",
  manufacture_of_wood_and_products_of_wood_and_cork_except_furniture_manufacture_of_articles_of_straw_and_plaiting_materials: "Wood & cork",
  other_manufacturing: "Other manufacturing",
  printing_and_reproduction_of_recorded_media: "Printing & media",
};
const SHORT22 = { sub_mining_quarrying_metallic_minerals_incl_rare_earth_minerals: "Metallic minerals", sub_mining_quarrying_non_metallic_minerals_incl_minor_minerals: "Non-metallic mining",
  sub_water_supply_sewerage_waste_management_sewerage_waste_management: "Sewerage & waste" };
const shortOf = (k) => IND_SHORT[k.replace(IND_P, "")];
const TH = 10; // the disclosed threshold: a latest print beyond ±10% is picked out
const rowsOf = (b) => Object.keys(b.series).map((k) => ({ k, P: ser(b, k) })).map((r) => ({ ...r, last: lastP(r.P) }))
  .filter((r) => r.last).sort((a, b) => b.last[1] - a.last[1]);
const labelOf22 = (k) => k.replace(/^sub_manufacturing_manufacture_of_/, "").replace(/^sub_manufacturing_/, "")
  .replace(/^sub_(mining_quarrying|electricity_gas_supply|water_supply_sewerage_waste_management)_/, "")
  .split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const gridCsv = (rows, name) => {
  const dates = [...new Set(rows.flatMap((r) => r.P.map((p) => p[0])))].sort();
  const at = rows.map((r) => new Map(r.P));
  return { cols: ["Month", ...rows.map(name)], rows: dates.map((d) => [d.slice(0, 7), ...at.map((m) => m.get(d) ?? null)]) };
};
export function oldGrid() {
  const rows = rowsOf(OIND), hot = rows.filter((r) => Math.abs(r.last[1]) >= TH).length;
  return figure({
    bare: true, file: "india-atlas_iip_industries_base2011",
    label: `Twenty-three small line charts, one per manufacturing industry on the retired 2011-12 base, ${mShort(rows[0].P[0][0])} to ${mShort(rows[0].last[0])}, on one scale clipped at −40 and +45 per cent, ordered by the final print; ${hot} industries ended beyond plus or minus 10 per cent`,
    data: gridCsv(rows, (r) => shortOf(r.k)),
    draw: (width) => K.multiples({
      width, unit: PCT, vFmt: fSigned, domain: { lo: -40, hi: 45, ticks: [-40, 0, 40] },
      panels: rows.map((r) => ({ name: shortOf(r.k), data: r.P, highlight: Math.abs(r.last[1]) >= TH })),
    }),
  });
}
export function ind22Grid() {
  const rows = rowsOf(IND), hot = rows.filter((r) => Math.abs(r.last[1]) >= TH).length;
  return figure({
    bare: true, file: "india-atlas_iip_industries_base2022-all",
    label: `${rows.length} small line charts, one per industry on the current 2022-23 base, ${mShort(rows[0].P[0][0])} to ${mShort(rows[0].last[0])}, on one scale clipped at −20 and +45 per cent, ordered by the latest print; ${hot} industries ended beyond plus or minus 10 per cent`,
    data: gridCsv(rows, (r) => shortOf(r.k) ?? SHORT22[r.k] ?? labelOf22(r.k)),
    draw: (width) => K.multiples({
      width, unit: PCT, vFmt: fSigned, domain: { lo: -20, hi: 45, ticks: [-20, 0, 20, 40] },
      panels: rows.map((r) => ({ name: shortOf(r.k) ?? SHORT22[r.k] ?? labelOf22(r.k), data: r.P, highlight: Math.abs(r.last[1]) >= TH })),
    }),
  });
}

/* ---------- §06: the sectors ---------- */
export function sectors() {
  const s = (k) => ser(B, k), L = lastP(s("general"));
  return figure({
    bare: true, file: "india-atlas_iip_sectors_base2022",
    label: `IIP by sector, year-on-year, ${mShort(s("general")[0][0])} to ${mLong(L[0])}: general ends at ${f1(L[1])}, manufacturing ${f1(lastP(s("sector_manufacturing"))[1])}, mining ${f1(lastP(s("sector_mining_quarrying"))[1])}, electricity and gas ${f1(lastP(s("sector_electricity_gas_supply"))[1])}, water supply and waste ${f1(lastP(s("sector_water_supply_sewerage_waste_management"))[1])}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Water supply & waste", short: "Water & waste", data: s("sector_water_supply_sewerage_waste_management"), role: "ctx2" },
        { name: "Mining & quarrying", short: "Mining", data: s("sector_mining_quarrying"), role: "ctx" },
        { name: "Electricity & gas", short: "Electricity", data: s("sector_electricity_gas_supply"), role: "ctx" },
        { name: "Manufacturing", short: "Manufacturing", data: s("sector_manufacturing"), role: "ctx", color: K.C.ink2 },
        { name: "General", short: "General", data: s("general"), role: "lead" },
      ],
    }),
  });
}

/* ---------- §07: the core eight, latest year ---------- */
const coreRows = () => {
  const P = ser(C11, "composite_growth"), d = lastP(P)[0], i = C11.dates.indexOf(d);
  const rows = Object.entries(C11.series).filter(([k]) => k.endsWith("_growth") && k !== "composite_growth")
    .map(([k, s]) => ({ k, name: s.label.split(",")[0], v: s.data[i], w: c11raw.series[k].weight })).sort((a, b) => b.v - a.v);
  return { d, rows, comp: C11.series.composite_growth.data[i] };
};
export function core() {
  const { d, rows, comp } = coreRows();
  return figure({
    bare: true, file: `india-atlas_iip_core-eight_${fyL(d)}`,
    label: `The eight core industries, growth in ${fyL(d)} on the year before, base 2011-12: ${rows.map((r) => `${r.name} ${fS(r.v)}`).join(", ")}; the composite grew ${fS(comp)}`,
    data: { cols: ["Industry", "Weight in the IIP", `Growth ${fyL(d)}, per cent`], rows: [["Composite", 40.27, comp], ...rows.map((r) => [r.name, r.w, r.v])] },
    draw: (width) => K.bars({
      width, unit: PCT, dp: 1,
      rows: rows.map((r) => ({ name: `${r.name} (weight ${r.w})`, value: r.v })),
      ref: { value: comp, label: `Composite ${fS(comp)}` },
    }),
  });
}

/* ---------- §07: the core on three rulers, against the IIP ---------- */
export function coreLong() {
  const c93 = ser(C93, "composite_growth"), c04 = ser(C04, "composite_growth"), c11 = ser(C11, "composite_growth");
  const iip = ser(FY11, "general_growth");
  const at = (P, y) => P.find(([d]) => d.startsWith(y));
  const k20 = at(c11, "2020"), i20 = at(iip, "2020");
  return figure({
    bare: true, file: "india-atlas_iip_core-three-bases",
    label: `Growth of the eight-core composite index by financial year on the 1993-94, 2004-05 and 2011-12 bases, never spliced, with the IIP general index (base 2011-12): the core fell only in 2020-21, by ${Math.abs(k20[1]).toFixed(1)} per cent, when the IIP fell ${Math.abs(i20[1]).toFixed(1)} per cent`,
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1,
      series: [
        { name: "Core, base 1993-94", short: "Core, 1993-94", data: c93, role: "ctx2", label: false },
        { name: "Core, base 2004-05", short: "Core, 2004-05", data: c04, role: "ctx", label: false },
        { name: "IIP general, base 2011-12", short: "IIP", data: iip, role: "comp", dash: "4 3" },
        { name: "Core, base 2011-12", short: "Core", data: c11, role: "lead" },
      ],
      events: [
        { t: c04[0][0], label: "Core base 2004-05 begins", short: "2004-05" },
        { t: c11[0][0], label: "Core base 2011-12 begins", short: "2011-12" },
      ],
      notes: [{ d: k20[0], v: k20[1], text: `${fS(k20[1])}, 2020-21\nthe core's one fall`, below: true }],
    }),
  });
}

/* ---------- §09: use-based ---------- */
export function useBased() {
  const s = (k) => ser(B, k), L = lastP(s("use_capital_goods"));
  return figure({
    bare: true, file: "india-atlas_iip_use-based_base2022",
    label: `IIP use-based categories, year-on-year, ${mShort(s("general")[0][0])} to ${mLong(L[0])}: capital goods end at ${f1(L[1])} against consumer non-durables at ${f1(lastP(s("use_consumer_non_durables"))[1])}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      series: [
        { name: "Infrastructure / construction goods", short: "Infrastructure", data: s("use_infrastructure_construction_goods"), role: "ctx" },
        { name: "Consumer durables", short: "Durables", data: s("use_consumer_durables"), role: "ctx" },
        { name: "Consumer non-durables", short: "Non-durables", data: s("use_consumer_non_durables"), role: "comp" },
        { name: "Capital goods", short: "Capital goods", data: s("use_capital_goods"), role: "lead" },
      ],
    }),
  });
}

/* ---------- §09: inside manufacturing, the two fastest and two slowest ----------
 * chosen from the data each print: the average growth over the last twelve months */
function indPick() {
  const avg = (k) => { const d = IND.series[k].data.slice(-12).filter((v) => v != null); return d.reduce((a, c) => a + c, 0) / d.length; };
  const r = Object.keys(IND.series).filter((k) => k.startsWith(IND_P) && shortOf(k) && IND.series[k].data.at(-1) != null)
    .map((k) => ({ k, a: avg(k) })).sort((a, b) => b.a - a.a);
  return [r[0], r[1], r.at(-2), r.at(-1)];
}
// a phone's end label keeps only the first word of a name; where that word says nothing on its
// own ("Other", "Wearing") the second rides with it on a no-break space
const phoneName = (n, width) => (width < 520 && /^(Other|Wearing|Basic|Motor) /.test(n) ? n.split(" ").slice(0, 2).join("\u00a0") : n);
export function industries() {
  const pick = indPick();
  const style = [{ role: "lead" }, { role: "cat", color: K.C.leadSoft }, { role: "cat", color: K.C.compTint }, { role: "comp" }];
  return figure({
    bare: true, file: "india-atlas_iip_industries_base2022",
    label: `The two fastest and two slowest manufacturing industries over the last twelve months, year-on-year, to ${mLong(lastP(ser(IND, pick[0].k))[0])}: ${pick.map((p) => `${shortOf(p.k)} ends at ${f1(lastP(ser(IND, p.k))[1])}`).join("; ")}`,
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1,
      // drawn slowest first, so the fastest sits on top
      series: pick.map((p, i) => ({ name: shortOf(p.k), short: phoneName(shortOf(p.k), width), data: ser(IND, p.k), ...style[i] })).reverse(),
    }),
  });
}

/* ---------- §10: the services index ---------- */
const ISP_NAME = { retail_trade: "Retail trade", road_transport: "Road transport", banking: "Banking", telecommunication: "Telecommunication", it_computer_related_services: "IT services" };
const ispName = (k) => ISP_NAME[k] ?? ISP.series[k].label;
const ISP_PICK = [["road_transport", "Road transport"], ["banking", "Banking"], ["telecommunication", "Telecom"], ["it_computer_related_services", "IT services"], ["retail_trade", "Retail trade"]];
export function isp() {
  const S = ISP_PICK.map(([k, n]) => ({ k, n, P: ser(ISP, k) })), L = lastP(S.at(-1).P);
  return figure({
    bare: true, file: "india-atlas_isp_selected-services_base2024",
    label: `Index of Services Production, five of nineteen series, index levels against a base-year average of 100, ${mShort(S[0].P[0][0])} to ${mLong(L[0])}: ${S.map((s) => `${s.n} ${lastP(s.P)[1].toFixed(1)}`).join(", ")}; the series is too young to have a seasonal history`,
    draw: (width) => K.line({
      width, freq: "month", endDp: 1, hoverDp: 1, zero: false,
      endFormat: (v) => v.toFixed(1),
      series: S.map((s) => ({ name: s.n, short: s.n, data: s.P, role: s.k === "retail_trade" ? "lead" : "ctx" })),
      refs: [{ y: 100, label: "Base-year average, 100" }],
    }),
  });
}
const CLUSTERS = [
  ["Trade", ["wholesale_trade", "retail_trade"]],
  ["Logistics", ["air_transport", "railway_transport", "road_transport", "water_transport", "warehousing_and_support_activities_for_transportation", "postal_and_courier"]],
  ["Finance", ["banking", "insurance"]],
  ["ICT", ["it_computer_related_services", "telecommunication", "information_and_broadcasting"]],
  ["Contact-intensive", ["accommodation_and_food", "arts_entertainment_and_recreation", "repair_services"]],
  ["Professional & property", ["professional_scientific_technical_services_including_r_d", "administrative_and_support_services", "real_estate"]],
];
export function ispGrid() {
  const dates = ISP.dates, li = dates.length - 1, yi = li - 12;
  const panels = CLUSTERS.flatMap(([cl, ks]) => ks.map((k) => {
    const s = ISP.series[k], yoy = (s.data[li] / s.data[yi] - 1) * 100;
    return { name: ispName(k).trim().replace(/\s+/g, " "), sub: `${cl}, ${(yoy >= 0 ? "+" : "−") + Math.abs(yoy).toFixed(1)}% on ${mShort(dates[yi])}`, data: ser(ISP, k), vText: s.data[li].toFixed(1) };
  }));
  return figure({
    bare: true, file: "india-atlas_isp_all-services_base2024",
    label: `Nineteen small line charts, one per ISP service, grouped into six clusters (trade, logistics, finance, ICT, contact-intensive, professional), each the index level over ${dates.length} months against a base-year average of 100; retail trade ends at ${ISP.series.retail_trade.data[li].toFixed(1)}`,
    data: { cols: ["Month", ...panels.map((p) => p.name)], rows: dates.map((d, i) => [d.slice(0, 7), ...CLUSTERS.flatMap(([, ks]) => ks.map((k) => ISP.series[k].data[i]))]) },
    draw: (width) => K.multiples({
      width, panels,
      ref: { data: dates.map((d) => [d, 100]) },
    }),
  });
}

/* ---------- the page's numbers, by element id (the text the client used to set) ---------- */
export function numbers() {
  const S = B.series, L = {}, P = {}, Y = {};
  for (const k in S) { L[k] = S[k].data.at(-1); P[k] = S[k].data.at(-2); Y[k] = S[k].data.at(-13); }
  const prevName = mShort(B.dates.at(-2));
  const pc = '<span class="pc">%</span>';
  const arrow = (d) => (Math.abs(d) < 0.05 ? "unchanged" : (d > 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt");
  const wd = (d) => (d >= 0 ? "accelerating" : "cooling");
  const N = {
    "n-head": L.general.toFixed(1) + pc,
    "n-mfg": L.sector_manufacturing.toFixed(1) + pc,
    "n-cap": L.use_capital_goods.toFixed(1) + pc,
    "n-elec": L.sector_electricity_gas_supply.toFixed(1) + pc,
    "d-head": `<b>${arrow(L.general - P.general)}</b> vs ${prevName}, ${wd(L.general - P.general)}`,
    "d-mfg": `<b>${arrow(L.sector_manufacturing - P.sector_manufacturing)}</b> vs ${prevName}`,
    "d-cap": `<b>${arrow(L.use_capital_goods - P.use_capital_goods)}</b> vs ${prevName}`,
    "d-elec": `<b>${arrow(L.sector_electricity_gas_supply - P.sector_electricity_gas_supply)}</b> vs ${prevName}`,
    "nspark-head": K.spark(ser(B, "general"), { width: 190, height: 44 }),
    "rb-big": L.general.toFixed(1) + pc,
    "rb-prev": P.general.toFixed(1) + pc,
    "pv-bases": f1(L.general),
    "pv-main": f1(L.general),
    "pv-use": f1(L.use_capital_goods),
    "ex-cap": f1(L.use_capital_goods),
    "ex-cnd": f1(L.use_consumer_non_durables),
    "prov-vintage": esc(B.meta.vintage),
    "prov-vintage2": esc(B.meta.vintage),
  };
  const reg = [
    ["general", "General (headline)", "The whole index", "s-acc"],
    ["sector_manufacturing", "Manufacturing", "The heavyweight sector", "s-g1"],
    ["sector_mining_quarrying", "Mining & quarrying", "Answers to the monsoon", "s-g2"],
    ["sector_electricity_gas_supply", "Electricity & gas supply", "Generation, not consumption", "s-g3"],
    ["sector_water_supply_sewerage_waste_management", "Water supply & waste", "Fourth sector, new on this base", "s-g4"],
    ["use_primary_goods", "Primary goods", "Use-based", "s-g1"],
    ["use_capital_goods", "Capital goods", "The investment cycle", "s-acc"],
    ["use_intermediate_goods", "Intermediate goods", "Use-based", "s-g2"],
    ["use_infrastructure_construction_goods", "Infrastructure / construction", "Use-based", "s-g3"],
    ["use_consumer_durables", "Consumer durables", "The confident household", "s-g4"],
    ["use_consumer_non_durables", "Consumer non-durables", "The everyday household", "s-g1"],
  ];
  N["ledger-body"] = reg.map(([k, nm, sub, sw]) => `<tr><td class="name"><span class="sw ${sw}"></span>${esc(nm)}<small>${esc(sub)}</small></td>` +
    `<td class="val">${f1(L[k])}</td><td class="chg">${arrow(L[k] - P[k])}, ${wd(L[k] - P[k])}</td><td class="yr">${f1(Y[k])}</td>` +
    `<td class="spark">${K.spark(ser(B, k), { width: 190, height: 44 })}</td></tr>`).join("");

  // §03 deep ledger
  const h80 = ser(H80, "general"), h93 = ser(H93, "general"), h04 = ser(H04, "general");
  const tr = minP(h04), g93 = h93.find(([d]) => d === tr[0]), low80 = minP(h80);
  Object.assign(N, {
    "pv-herit": fS(tr[1]), "her-gfc04": fS(tr[1]), "her-gfc93": "+" + g93[1].toFixed(1) + "%",
    "her-end93": fS(lastP(h93)[1]), "her-low80": fS(low80[1]), "her-low80-at": mShort(low80[0]),
    "her-end80": fS(lastP(h80)[1]), "her-end04": fS(lastP(h04)[1]),
  });
  // §04 financial years
  N["pv-fy"] = fS(lastP(ser(FY22, "general_growth"))[1]);
  // §05 the retired industry ledger
  { const rows = rowsOf(OIND), hot = rows.filter((r) => Math.abs(r.last[1]) >= TH);
    Object.assign(N, { "pv-old": hot.length + " / " + rows.length, "old-n": String(hot.length),
      "old-hi-name": esc(shortOf(rows[0].k).toLowerCase()), "old-hi": fSigned(rows[0].last[1]),
      "old-lo-name": esc(shortOf(rows.at(-1).k).toLowerCase()), "old-lo": fSigned(rows.at(-1).last[1]) }); }
  // §07 the core
  { const { comp } = coreRows(); N["pv-core"] = fS(comp);
    const c11 = ser(C11, "composite_growth"), iip = ser(FY11, "general_growth"), at = (P, y) => P.find(([d]) => d.startsWith(y))?.[1];
    N["pv-corelong"] = fS(at(c11, "2020")); N["core-2020"] = fS(at(c11, "2020")); N["iip-2020"] = fS(at(iip, "2020"));
    const c93 = new Map(ser(C93, "composite_growth")); let gap = 0, gapAt = null;
    for (const [d, v] of ser(C04, "composite_growth")) { const o = c93.get(d); if (o == null || v == null) continue; if (Math.abs(v - o) > gap) { gap = Math.abs(v - o); gapAt = d; } }
    N["core-gap"] = gap.toFixed(1) + " points (" + fyL(gapAt) + ")"; }
  // §09 inside manufacturing
  { const pick = indPick(), lv = (i) => IND.series[pick[i].k].data.at(-1), nm = (i) => esc(shortOf(pick[i].k));
    Object.assign(N, { "pv-ind": f1(lv(0)), "pc-ind": nm(0).toLowerCase() + ", y/y",
      "ind-f1": nm(0).toLowerCase(), "ind-f2": nm(1).toLowerCase(), "ind-s1": nm(2).toLowerCase(), "ind-s2": nm(3).toLowerCase(),
      "ind-f1a": f1s(pick[0].a), "ind-s2a": f1s(pick[3].a),
      "ex-elec": f1s(lv(0)), "ex-mv": f1s(lv(1)), "ex-app": f1s(lv(3)), "ex-s1": f1s(lv(2)) }); }
  { const rows = rowsOf(IND);
    Object.assign(N, { "ind-n": String(rows.length), "ind-hot": String(rows.filter((r) => Math.abs(r.last[1]) >= TH).length),
      "ind-hi": esc(labelOf22(rows[0].k)) + ", " + fSigned(rows[0].last[1]), "ind-lo": esc(labelOf22(rows.at(-1).k)) + ", " + fSigned(rows.at(-1).last[1]) }); }
  // §10 the services index
  { const I = ISP.series, li = ISP.dates.length - 1, yi = li - 12, lvl = (k, i) => I[k].data[i];
    let mar = null; for (let i = li; i >= 0; i--) if (ISP.dates[i].slice(5, 7) === "03") { mar = I.insurance.data[i]; break; }
    Object.assign(N, {
      "pv-isp": lvl("retail_trade", li).toFixed(1), "isp-rt": lvl("retail_trade", li).toFixed(1),
      "isp-rt-yy": ((lvl("retail_trade", li) / lvl("retail_trade", yi) - 1) * 100).toFixed(1) + "%",
      "isp-bk": lvl("banking", li).toFixed(1), "isp-ins-mar": mar.toFixed(1), "isp-ins-may": lvl("insurance", li).toFixed(1),
      "isp-th-latest": "Level, " + mShort(ISP.dates[li]), "isp-th-yoy": "vs " + mShort(ISP.dates[yi]) + ", from levels", "isp-th-year": mShort(ISP.dates[yi]),
    });
    const sw = { retail_trade: K.C.lead };
    N["isp-ledger-body"] = Object.entries(I).map(([k, s]) => {
      const l = s.data[li], y = s.data[yi], g = (l / y - 1) * 100, vs = s.data;
      return `<tr><td class="name"><span class="sw" style="background:${sw[k] ?? K.C.ctx}"></span>${esc(ispName(k).trim())}<small>${vs.length} months, range ${Math.min(...vs).toFixed(1)} – ${Math.max(...vs).toFixed(1)}</small></td>` +
        `<td class="val">${l.toFixed(1)}</td><td class="chg">${(g >= 0 ? "▲ +" : "▼ −") + Math.abs(g).toFixed(1)}%</td><td class="yr">${y.toFixed(1)}</td>` +
        `<td class="spark">${K.spark(ser(ISP, k), { width: 190, height: 44, ref: 100 })}</td></tr>`;
    }).join(""); }
  return N;
}
