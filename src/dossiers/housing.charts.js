// House prices guide: the plates, drawn at build time with the chart kit (src/kit/), and the
// figures the page quotes beside them. Three rulers, never joined: BIS residential property
// prices, the RBI house price index by city and NHB RESIDEX. Quarters are dated at their first
// month. Year-on-year changes for the RBI all-India and RESIDEX series are computed here within
// each base (index / index four quarters earlier). Runs at build time only.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import * as fmt from "../charts/format.js";
import propB from "../../data/series/bis-property.json";
import citiesB from "../../data/series/bis-property-cities.json";
import cities10B from "../../data/series/bis-property-10cities.json";
import rbi22 from "../../data/series/housing-rbi-2022.json";
import rbi22y from "../../data/series/housing-rbi-2022-yoy.json";
import rbi10 from "../../data/series/housing-rbi-2010.json";
import rx18 from "../../data/series/housing-residex-2018.json";
import rx25 from "../../data/series/housing-residex-2025.json";
import rxp25 from "../../data/series/housing-residex-prices-2025.json";
import usa from "../../data/series/bis-peer-usa.json";
import chn from "../../data/series/bis-peer-chn.json";
import emu from "../../data/series/bis-peer-emu.json";
import gbr from "../../data/series/bis-peer-gbr.json";
import jpn from "../../data/series/bis-peer-jpn.json";
import kor from "../../data/series/bis-peer-kor.json";
import idn from "../../data/series/bis-peer-idn.json";
import bra from "../../data/series/bis-peer-bra.json";
import zaf from "../../data/series/bis-peer-zaf.json";
import mex from "../../data/series/bis-peer-mex.json";
import tur from "../../data/series/bis-peer-tur.json";
import aus from "../../data/series/bis-peer-aus.json";
import can from "../../data/series/bis-peer-can.json";

const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const qlab = (iso) => { const m = +iso.slice(5, 7) - 1; return `${M3[m]} to ${M3[m + 2]} ${iso.slice(0, 4)}`; };
const sgn = (v, dp = 1) => (+Math.abs(v).toFixed(dp) === 0 ? "" : v < 0 ? "−" : "+") + Math.abs(v).toFixed(dp) + "%";
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cityName = (label) => label.split(",")[0].replace(/ \(.*\)$/, "");
const PCT = { suffix: "%" };

// [[iso, v]] for a bundle series, unrounded (index levels; the figures qc checks are unrounded)
const raw = (b, k) => b.dates.map((d, i) => [d, b.series[k].data[i] ?? null]);
const lastP = (P) => { for (let i = P.length - 1; i >= 0; i--) if (P[i][1] != null) return P[i]; return null; };
/** y/y within one series: index against the index four quarters back */
const yoyOf = (P) => P.map(([d, v], i) => [d, i >= 4 && v != null && P[i - 4][1] != null ? (v / P[i - 4][1] - 1) * 100 : null]);
const r1 = (P) => P.map(([d, v]) => [d, v == null ? null : Math.round(v * 10) / 10]);

/* ---------- shared derived figures ---------- */
const LQ = propB.dates.at(-1);
const NOM = raw(propB, "nominal"), REAL = raw(propB, "real"), NOMY = raw(propB, "nominal_yoy"), REALY = raw(propB, "real_yoy");
const rbiYoy = yoyOf(raw(citiesB, "cities_18")), rbi10Yoy = yoyOf(raw(cities10B, "cities_10"));
const rx18Yoy = yoyOf(raw(rx18, "india_hfc")), rx25Yoy = yoyOf(raw(rx25, "india_hfc"));
const rxLast = lastP(rx25Yoy) ?? lastP(rx18Yoy);
const realPk = REAL.reduce((a, p) => (p[1] != null && p[1] > a[1] ? p : a), [null, -1]);

const C10 = Object.values(rbi10.series).map((s) => ({ name: cityName(s.label), v: s.data.at(-1) })).sort((a, b) => b.v - a.v);
const C22 = Object.entries(rbi22.series).map(([k, s]) => ({ k, name: cityName(s.label), v: s.data.at(-1), y: rbi22y.series[k].data.at(-1) })).sort((a, b) => b.v - a.v);
const RXC = Object.keys(rx25.series).filter((k) => /_hfc$/.test(k) && k !== "india_hfc")
  .map((k) => { const y = lastP(yoyOf(raw(rx25, k))); return y && { name: cityName(rx25.series[k].label), v: y[1] }; }).filter(Boolean).sort((a, b) => b.v - a.v);
const PRICE = Object.keys(rxp25.series).filter((k) => /_hfc_price$/.test(k)).map((k) => ({ name: cityName(rxp25.series[k].label), v: rxp25.series[k].data.at(-1) })).sort((a, b) => b.v - a.v);
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
const flat = (v) => (v * 646 >= 1e7 ? "₹" + ((v * 646) / 1e7).toFixed(2) + " crore" : "₹" + ((v * 646) / 1e5).toFixed(0) + " lakh");
const PEERS = [["United States", usa], ["China", chn], ["Euro area", emu], ["United Kingdom", gbr], ["Japan", jpn], ["Korea", kor], ["Indonesia", idn],
  ["Brazil", bra], ["South Africa", zaf], ["Mexico", mex], ["Türkiye", tur], ["Australia", aus], ["Canada", can]];
const peerLast = (b) => { const s = b.series.real_house_prices_yoy; for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return { v: s.data[i], d: b.dates[i] }; return null; };
const PR = [{ name: "India", v: lastP(REALY)[1], d: LQ }, ...PEERS.map(([name, b]) => ({ name, ...peerLast(b) }))].filter((r) => r.v != null).sort((a, b) => b.v - a.v);

/** The title-block sparkline: the real index. */
export const sparkReal = () => K.spark(REAL.filter((p) => p[1] != null), { width: 190, height: 44 });

/* ---------- § 02 nominal and real ---------- */
export function nr() {
  return figure({
    bare: true, file: "india-atlas_house-prices-nominal-real",
    label: `India's house prices as an index, 2010 = 100: in rupees ${lastP(NOM)[1].toFixed(1)} and after inflation ${lastP(REAL)[1].toFixed(1)} in ${qlab(LQ)}, the real index below its peak of ${realPk[1].toFixed(1)} in ${qlab(realPk[0])}`,
    draw: (width) => K.line({
      width, freq: "quarter", endDp: 1,
      series: [
        { name: "Nominal, in rupees", short: "Nominal", data: NOM, role: "ctx" },
        { name: "Real, after inflation", short: "Real", data: REAL, role: "lead" },
      ],
      refs: [{ y: 100, label: "2010 = 100" }],
      notes: [{ d: realPk[0], v: realPk[1], text: `Real peak ${realPk[1].toFixed(1)}\n${qlab(realPk[0])}`, side: "left" }],
    }),
  });
}

/* ---------- § 02 change on a year ago ---------- */
export function yoy() {
  return figure({
    bare: true, file: "india-atlas_house-prices-change",
    label: `India's house prices, change on a year ago: nominal ${sgn(lastP(NOMY)[1])} and real ${sgn(lastP(REALY)[1])} in ${qlab(LQ)}`,
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1, endFormat: (v) => sgn(v),
      series: [
        { name: "Nominal", data: pairs(propB, "nominal_yoy"), role: "ctx" },
        { name: "Real", data: pairs(propB, "real_yoy"), role: "lead" },
      ],
    }),
  });
}

/* ---------- § 03 cities, 2010-11 base ---------- */
export function cities10() {
  const rows = C10.map((r, i) => ({ name: r.name, value: r.v, highlight: i === 0 || i === C10.length - 1 }));
  return figure({
    bare: true, file: "india-atlas_house-prices-10-cities-2010-base",
    label: "RBI house price index by city, base 2010-11 = 100: " + C10.map((r) => `${r.name} ${r.v.toFixed(0)}`).join(", "),
    data: { cols: ["city", "index_2010_11_eq_100", "quarter"], rows: C10.map((r) => [r.name, r.v, rbi10.dates.at(-1)]) },
    draw: (width) => K.bars({ width, rows, dp: 0 }),
  });
}

/* ---------- § 03 cities, 2022-23 base ---------- */
export function cities() {
  const rows = C22.map((r, i) => ({ name: r.name, value: r.v, note: `${sgn(r.y)} on a year`, highlight: i === 0 || r.v < 100 }));
  return figure({
    bare: true, file: "india-atlas_house-prices-18-cities",
    label: "RBI house price index by city, base 2022-23 = 100, with the change on a year ago: " + C22.map((r) => `${r.name} ${r.v.toFixed(0)}, ${sgn(r.y)}`).join("; "),
    data: { cols: ["city", "index_2022_23_eq_100", "pct_change_on_year", "quarter", "provisional"], rows: C22.map((r) => [r.name, r.v, +r.y.toFixed(2), rbi22.dates.at(-1), "yes"]) },
    draw: (width) => K.bars({ width, rows, dp: 0, refFill: false, ref: { value: 100, label: "Base, 2022-23 = 100" } }),
  });
}

/* ---------- § 04 three rulers ---------- */
export function rulers() {
  const TEAL_TINT = "#8CCBC3";
  const end10 = lastP(rbi10Yoy)[0], end18 = lastP(rx18Yoy)[0];
  return figure({
    bare: true, file: "india-atlas_house-prices-three-rulers",
    label: `Three measures of India's house prices, change on a year ago, each on its own base: BIS ${sgn(lastP(NOMY)[1])}, RBI 18 cities ${sgn(lastP(rbiYoy)[1])}, NHB RESIDEX ${sgn(rxLast[1])}`,
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endFormat: (v) => sgn(v), height: width < 520 ? 300 : 420,
      series: [
        { name: "RBI, 10 cities, 2010-11 base", data: r1(rbi10Yoy), role: "ctx", color: K.C.compTint, label: false },
        { name: "RESIDEX, 2017-18 base", data: r1(rx18Yoy), role: "ctx", color: TEAL_TINT, label: false },
        { name: "RBI, 18 cities, 2022-23 base", short: "RBI 18 cities", data: r1(rbiYoy), role: "comp" },
        { name: "RESIDEX, 2024-25 base", short: "RESIDEX", data: r1(rx25Yoy), role: "cat", color: K.C.teal },
        { name: "BIS, nominal", short: "BIS", data: pairs(propB, "nominal_yoy"), role: "lead" },
      ],
      events: [
        { t: end10, label: "RBI 10-city base ends", short: "RBI 10 cities end", side: "left" },
        { t: end18, label: "RESIDEX 2017-18 base ends", short: "RESIDEX rebased" },
      ],
    }),
  });
}

/* ---------- § 05 RESIDEX cities ---------- */
export function rxcities() {
  const india = lastP(rx25Yoy)[1];
  const rows = RXC.map((r, i) => ({ name: r.name, value: r.v, highlight: i === 0 || i === RXC.length - 1 }));
  return figure({
    bare: true, file: "india-atlas_residex-cities-change",
    label: `NHB RESIDEX, change on a year ago by city, against India's ${sgn(india)}: ` + RXC.map((r) => `${r.name} ${sgn(r.v)}`).join(", "),
    data: { cols: ["city", "pct_change_on_year", "quarter"], rows: RXC.map((r) => [r.name, +r.v.toFixed(2), rx25.dates.at(-1)]) },
    draw: (width) => K.bars({ width, rows, dp: 1, sign: true, unit: PCT, ref: { value: +india.toFixed(1), label: `India ${sgn(india)}` } }),
  });
}

/* ---------- § 05 price per square foot ---------- */
export function price() {
  const shown = [...PRICE.slice(0, 20), PRICE.at(-1)];
  const med = [...PRICE].sort((a, b) => a.v - b.v)[Math.floor(PRICE.length / 2)];
  const rows = shown.map((r, i) => ({ name: r.name, value: Math.round(r.v), note: `flat ${flat(r.v)}`, highlight: i === 0 }));
  return figure({
    bare: true, file: "india-atlas_price-per-sq-ft",
    label: `Average price per square foot by city, NHB RESIDEX, against the median city (${med.name}, ${inr(med.v)}): ` + shown.map((r) => `${r.name} ${inr(r.v)}`).join(", "),
    data: { cols: ["city", "inr_per_sq_ft", "implied_646_sq_ft_flat_inr", "quarter"], rows: PRICE.map((r) => [r.name, r.v, Math.round(r.v * 646), rxp25.dates.at(-1)]) },
    draw: (width) => K.bars({ width, rows, dp: 0, unit: { prefix: "₹" }, sort: false, refFill: false, ref: { value: Math.round(med.v), label: `Median city, ${med.name}, ${inr(med.v)}` } }),
  });
}

/* ---------- § 06 compared ---------- */
export function peers() {
  const rows = PR.map((r) => ({ name: r.name, value: r.v, highlight: r.name === "India" }));
  return figure({
    bare: true, file: "india-atlas_real-house-prices-compared",
    label: `Real house prices, change on a year ago, India and ${PR.length - 1} economies: ` + PR.map((r) => `${r.name} ${sgn(r.v)}`).join(", "),
    data: { cols: ["economy", "real_pct_change_on_year", "quarter"], rows: PR.map((r) => [r.name, r.v, r.d]) },
    draw: (width) => K.bars({ width, rows, dp: 1, sign: true, unit: PCT }),
  });
}

/* ---------- the figures the page quotes (ids kept from the retired client) ---------- */
export function numbers() {
  const T = {};
  const nomL = lastP(NOMY)[1], realL = lastP(REALY)[1], rbiL = lastP(rbiYoy);
  T["m-latest"] = qlab(LQ);
  T["u-reading"] = `BIS, ${qlab(LQ)}`;
  T["n-nom"] = fmt.pct1(nomL);
  T["d-nom"] = `<b>${fmt.pct1(propB.series.nominal_yoy.data.at(-5))}</b> a year earlier`;
  T["n-real"] = fmt.pct1(realL);
  T["d-real"] = `<b>${fmt.pct1(propB.series.real_yoy.data.at(-5))}</b> a year earlier`;
  T["n-rbi"] = sgn(rbiL[1]);
  T["d-rbi"] = `${qlab(rbiL[0])}, base 2022-23`;
  T["n-rx"] = sgn(rxLast[1]);
  T["d-rx"] = `${qlab(rxLast[0])}, base 2024-25`;
  T["rb-real"] = fmt.pct1(realL);
  T["rb-nom"] = fmt.pct1(nomL);
  // § 02
  const nomI = lastP(NOM)[1], realI = lastP(REAL)[1];
  T["pv-nr"] = realI.toFixed(1);
  T["ex-nr-nom"] = nomI.toFixed(1);
  T["ex-nr-x"] = fmt.x1(nomI / 100);
  T["ex-nr-real"] = realI.toFixed(1);
  T["ex-nr-below"] = fmt.pct1((1 - realI / realPk[1]) * 100);
  T["ex-nr-pk"] = realPk[1].toFixed(1);
  T["ex-nr-pkq"] = qlab(realPk[0]);
  const since = REALY.filter(([d, v]) => v != null && d >= "2019-04-01");
  const ry = REALY.filter(([, v]) => v != null);
  let k = ry.length - 1; const up = ry[k][1] >= 0;
  while (k > 0 && (ry[k - 1][1] >= 0) === up) k--;
  const run = ry.length - k, runFrom = qlab(ry[k][0]);
  T["h-yoy"] = run >= 4
    ? `Since ${runFrom}, house prices have risen ${up ? "faster" : "more slowly"} than inflation every quarter${ry.slice(k).every(([, v]) => Math.abs(v) < 4) ? ", but only just" : ""}`
    : `House prices ${up ? "have edged ahead of" : "have fallen behind"} inflation again in the last ${run === 1 ? "quarter" : run + " quarters"}`;
  T["pv-yoy"] = fmt.pct1(realL);
  T["ex-y-nom"] = fmt.pct1(nomL);
  T["ex-y-real"] = fmt.pct1(realL);
  T["ex-y-n"] = String(since.length);
  T["ex-y-avg"] = sgn(since.reduce((a, [, v]) => a + v, 0) / since.length);
  // § 03
  const m10 = [...C10].sort((a, b) => a.v - b.v);
  T["pv-cities10"] = C10[0].v.toFixed(0);
  T["ex-c10-top"] = `${esc(C10[0].name)} ${C10[0].v.toFixed(0)}`;
  T["ex-c10-bot"] = `${esc(C10.at(-1).name)} ${C10.at(-1).v.toFixed(0)}`;
  T["ex-c10-med"] = ((m10[4].v + m10[5].v) / 2).toFixed(0);
  const ys = [...C22].sort((a, b) => b.y - a.y), below = C22.filter((r) => r.v < 100);
  T["pv-cities"] = C22[0].v.toFixed(0);
  T["h-cities"] = `On the new 2022-23 base, ${esc(C22[0].name)} has risen most${below.length === 0 ? " and every city is above its base" : below.length === 1 ? ` and ${esc(below[0].name)} has fallen` : `; ${below.length} cities are below their base`}`;
  T["ex-c-topn"] = esc(C22[0].name);
  T["ex-c-top"] = C22[0].v.toFixed(1);
  T["ex-c-botn"] = esc(C22.at(-1).name);
  T["ex-c-bot"] = C22.at(-1).v.toFixed(1);
  T["ex-c-up"] = String(C22.filter((r) => r.y > 0).length);
  T["ex-c-yhi"] = `${esc(ys[0].name)}, ${sgn(ys[0].y)}`;
  T["ex-c-ylo"] = `${esc(ys.at(-1).name)}, ${sgn(ys.at(-1).y)}`;
  // § 04
  const latest = [lastP(NOMY)[1], rbiL[1], rxLast[1]];
  T["pv-rulers"] = (Math.max(...latest) - Math.min(...latest)).toFixed(1) + " pt";
  T["ex-r-bis"] = `${sgn(latest[0])} (${qlab(lastP(NOMY)[0])})`;
  T["ex-r-rbi"] = `${sgn(latest[1])} (${qlab(rbiL[0])})`;
  T["ex-r-rx"] = `${sgn(latest[2])} (${qlab(rxLast[0])})`;
  const by10 = new Map(rbi10Yoy.filter(([, v]) => v != null));
  let ovn = 0, ovgap = 0;
  for (const [d, v] of rbiYoy) { const o = by10.get(d); if (o == null || v == null) continue; ovn++; ovgap = Math.max(ovgap, Math.abs(v - o)); }
  T["ex-r-ovn"] = String(ovn);
  T["ex-r-ovgap"] = ovgap.toFixed(1) + " points";
  // § 05
  const upN = RXC.filter((r) => r.v > 0).length;
  T["pv-rxcities"] = `${upN} of ${RXC.length}`;
  T["ex-x-up"] = String(upN);
  T["ex-x-n"] = String(RXC.length);
  T["ex-x-top"] = `${esc(RXC[0].name)}, ${sgn(RXC[0].v)}`;
  T["ex-x-bot"] = `${esc(RXC.at(-1).name)}, ${sgn(RXC.at(-1).v)}`;
  T["ex-x-india"] = sgn(lastP(rx25Yoy)[1]);
  const med = [...PRICE].sort((a, b) => a.v - b.v)[Math.floor(PRICE.length / 2)];
  T["pv-price"] = inr(PRICE[0].v);
  T["ex-p-top"] = `${esc(PRICE[0].name)}, ${inr(PRICE[0].v)}`;
  T["ex-p-flat"] = flat(PRICE[0].v);
  T["ex-p-bot"] = `${esc(PRICE.at(-1).name)}, ${inr(PRICE.at(-1).v)}`;
  T["ex-p-med"] = `${inr(med.v)} (${esc(med.name)})`;
  T["ex-p-x"] = fmt.x1(PRICE[0].v / med.v);
  // § 06
  const rank = PR.findIndex((r) => r.name === "India") + 1;
  T["pv-peers"] = `${rank} of ${PR.length}`;
  T["ex-pp-in"] = sgn(realL);
  T["ex-pp-rank"] = `${rank} of ${PR.length}`;
  T["ex-pp-top"] = `${esc(PR[0].name)}, ${sgn(PR[0].v)}`;
  T["ex-pp-bot"] = `${esc(PR.at(-1).name)}, ${sgn(PR.at(-1).v)}`;
  T["prov-vintage"] = propB.meta.vintage;
  T["prov-vintage2"] = propB.meta.vintage;
  return T;
}
