// Farms guide: the plates, drawn at build time with the chart kit (src/kit/), and the figures the
// page sets in its number ids (numbers()). Runs at build time only; the page ships no bundle JSON.
//
// Data (all read from data/series at build):
//   farms-production, -area, -yield   crop output, area and yield, final estimates, 1950-51 on
//   farms-advance                     the latest year, the ministry's advance estimate (a separate ruler)
//   farms-index-1982, -1994, -2008    index numbers of agricultural production, three bases, never linked
//   farms-msp                         minimum support prices, rupees a quintal, 1975-76 on
//   farms-landuse                     land use, irrigation, fertiliser and pesticides
//   farms-pds, farms-pds-latest       procurement, off-take and central-pool stocks; the part year apart
//   read only, from other guides: the states guide's Handbook tables (state output and yield),
//   farms-states-production (long state shares), farms-states-fertiliser, the climate guide's
//   monthly CRU rainfall (June to September totals), the prices guide's CPI for agricultural labourers.
import fs from "node:fs";
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";

const load = (slug) => JSON.parse(fs.readFileSync(`data/series/${slug}.json`, "utf8"));
const prodB = load("farms-production"), areaB = load("farms-area"), yieldB = load("farms-yield"), aeB = load("farms-advance");
const idx82 = load("farms-index-1982"), idx94 = load("farms-index-1994"), idx08 = load("farms-index-2008");
const mspB = load("farms-msp"), landB = load("farms-landuse"), pdsB = load("farms-pds"), pdsL = load("farms-pds-latest");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const pc = (u) => `<span class="pc">${u}</span>`;
const lastIdx = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
const fyOf = (iso) => { const y = +String(iso).slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const dayOf = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const mt = (v) => v / 1000;                       // thousand tonnes -> million tonnes
const g1 = (v) => v.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const mtS = (v) => fmt.num1(mt(v)) + " million tonnes";
const kg = (v) => fmt.inr(v) + " kg";
const pct = (a, b) => (a / b - 1) * 100;
const signPct = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1) + "%";
const n1 = (v) => K.num(v, { dp: 1 });
/** [[date, f(v)]] for one series, nulls kept (a missing year is a gap, never a zero). */
const ser = (b, k, f = (v) => v) => b.dates.map((d, i) => [d, b.series[k].data[i] == null ? null : f(b.series[k].data[i])]);
const trim = (P) => { const a = P.findIndex((p) => p[1] != null); let z = P.length - 1; while (z >= 0 && P[z][1] == null) z--; return a < 0 ? [] : P.slice(a, z + 1); };
const shiftYear = (d) => `${+d.slice(0, 4) + 1}${d.slice(4)}`;

/* ------------------------------------------------------------------ shared figures */
const P = prodB.series, iP = prodB.dates.length - 1, FY = fyOf(prodB.dates[iP]);
const AE = aeB.series, AEY = fyOf(aeB.dates[0]), AED = aeB.dates[0], aeStage = aeB.meta.stage.toLowerCase();
const Y = yieldB.series, iY = yieldB.dates.length - 1;
const A = areaB.series, iA = areaB.dates.length - 1;
const M = mspB.series, iPad = lastIdx(M.paddy_common.data), iWht = lastIdx(M.wheat.data);
const S = pdsB.series, iS = pdsB.dates.length - 1, stockAsOn = `1 April ${+pdsB.dates[iS].slice(0, 4) + 1}`;
const L = landB.series, iL = landB.dates.length - 1;
const NORM = 210.4;   // lakh tonnes: the 1 April operational buffer and strategic reserve (Department of Food and Public Distribution, January 2015)

// § 02: a hectare of wheat at the support price
const HA = yieldB.dates.map((d, i) => {
  const j = mspB.dates.indexOf(d), y = Y.wheat.data[i], p = j >= 0 ? M.wheat.data[j] : null;
  return y != null && p != null ? { iso: d, yield: y, msp: p, value: Math.round((y * p) / 100) } : null;
}).filter(Boolean);

// § 07: MSP rises against the crop-year (July to June) average of the twelve monthly year-on-year
// rates of the CPI for agricultural labourers (1986-87 = 100), where all twelve exist
const MI = (() => {
  const C = load("cpialrl-1986"), al = C.series.al.data, byFy = new Map();
  C.dates.forEach((d, i) => { const y = +d.slice(0, 4), m = +d.slice(5, 7), fy = m >= 7 ? y : y - 1; if (al[i] == null) return; const e = byFy.get(fy) ?? []; e.push(al[i]); byFy.set(fy, e); });
  const rows = [];
  mspB.dates.forEach((d, i) => {
    const y = +d.slice(0, 4), c = byFy.get(y);
    if (!c || c.length !== 12 || i === 0) return;
    const p = M.paddy_common.data[i] != null && M.paddy_common.data[i - 1] != null ? pct(M.paddy_common.data[i], M.paddy_common.data[i - 1]) : null;
    const w = M.wheat.data[i] != null && M.wheat.data[i - 1] != null ? pct(M.wheat.data[i], M.wheat.data[i - 1]) : null;
    rows.push({ d, y, fy: fyOf(d), paddy: p, wheat: w, cpi: c.reduce((a, b) => a + b, 0) / 12 });
  });
  return rows;
})();

// § 07: ten-year rise in every crop's MSP
const MA = (() => {
  const lastYear = Math.max(...Object.values(M).map((s) => lastIdx(s.data)));
  return Object.entries(M).map(([k, s]) => {
    const i = lastIdx(s.data);
    if (i < lastYear - 1) return null;   // a variety no longer priced (soyabean black, to 2016-17)
    const j = i - 10;
    if (i < 0 || j < 0 || s.data[j] == null) return null;
    return { k, label: s.label, latest: s.data[i], fy: fyOf(mspB.dates[i]), fy0: fyOf(mspB.dates[j]), rise: pct(s.data[i], s.data[j]) };
  }).filter(Boolean).sort((a, b) => b.rise - a.rise);
})();

// § 09: the states guide's Handbook tables (read only), the latest year each prints
const stateName = (label) => label.split(":")[0].trim();
const hbsLatest = (t) => {
  const b = load(`states-hbs-${t}`), i = b.dates.length - 1;
  return { year: b.dates[i], ai: b.series.all_india?.data[i] ?? null,
    rows: Object.entries(b.series).filter(([k, s]) => k !== "all_india" && s.data[i] != null).map(([k, s]) => ({ k, name: stateName(s.label), v: s.data[i] })) };
};
const HBS = { rice: "t058", wheat: "t059", coarse_cereals: "t060", pulses: "t061", foodgrains: "t062", oilseeds: "t063", cotton: "t064", sugarcane: "t065", jute_mesta: "t066" };
const ST = Object.fromEntries(Object.entries(HBS).map(([k, t]) => [k, hbsLatest(t)]));
const YP = { rice: hbsLatest("t080"), wheat: hbsLatest("t081") };
const SCROPS = [["foodgrains", "Foodgrains"], ["rice", "Rice"], ["wheat", "Wheat"], ["coarse_cereals", "Coarse cereals"], ["pulses", "Pulses"], ["oilseeds", "Oilseeds"], ["sugarcane", "Sugarcane"], ["cotton", "Cotton"], ["jute_mesta", "Jute"]];
const stShare = (c, name) => { const r = ST[c].rows.find((x) => x.name === name); return r && ST[c].ai ? (100 * r.v) / ST[c].ai : null; };
const top3 = (c) => ST[c].rows.map((r) => (100 * r.v) / ST[c].ai).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
// states with at least 1% of any crop, ordered by foodgrain share
const SNAMES = [...new Set(SCROPS.flatMap(([c]) => ST[c].rows.filter((r) => ST[c].ai && (100 * r.v) / ST[c].ai >= 1).map((r) => r.name)))]
  .sort((a, b) => (stShare("foodgrains", b) ?? 0) - (stShare("foodgrains", a) ?? 0));

// § 09: long state shares of wheat and rice (farms-states-production), from 1980-81
const SP = load("farms-states-production");
const longShare = (k, crop) => {
  const s = SP.series[k], ai = SP.series[`all_india__${crop}`];
  if (!s || !ai) return [];
  return trim(SP.dates.map((d, i) => [d, s.data[i] != null && ai.data[i] ? (100 * s.data[i]) / ai.data[i] : null]).filter(([d]) => d >= "1980-04-01"));
};
const lastOf = (P) => P.filter((p) => p[1] != null).at(-1);

// § 09: state yields, states growing at least 0.1% of the crop
const SY = (() => {
  const keep = (crop) => { const out = ST[crop]; return new Set(out.rows.filter((r) => out.ai && (100 * r.v) / out.ai >= 0.1).map((r) => r.name)); };
  const short = (n) => n.replace(/\s*\(.*\)$/, "").replace(/ & /g, " and ");
  const rows = ["wheat", "rice"].flatMap((c) => { const k = keep(c); return YP[c].rows.filter((r) => k.has(r.name)).map((r) => ({ crop: c === "wheat" ? "Wheat" : "Rice", name: short(r.name), v: r.v })); });
  const top = (c) => rows.filter((r) => r.crop === c).sort((a, b) => b.v - a.v)[0];
  return { rows, fy: fyOf(YP.wheat.year), ai: { Wheat: YP.wheat.ai, Rice: YP.rice.ai }, top };
})();

// § 09: fertiliser per hectare by state
const SF = (() => {
  const F = load("farms-states-fertiliser"), fi = F.dates.length - 1;
  const all = Object.entries(F.series).map(([k, s]) => ({ k, name: (s.state ?? stateName(s.label)).replace(/ \(average\)$/, ""), v: s.data[fi] }));
  return { fy: fyOf(F.dates[fi]), ai: all.find((r) => /all_india/.test(r.k)), rows: all.filter((r) => !/all_india|former_/.test(r.k) && r.v != null).sort((a, b) => b.v - a.v) };
})();

// § 10: June to September rainfall (CRU, the climate guide's bundle) against the change in the harvest
const MN = (() => {
  const CRU = load("climate-cru-monthly"), jjas = {};
  CRU.dates.forEach((d, i) => { const m = +d.slice(5, 7), y = d.slice(0, 4); if (m >= 6 && m <= 9) (jjas[y] ??= []).push(CRU.series.pr.data[i]); });
  const mons = Object.entries(jjas).filter(([, v]) => v.length === 4 && v.every((x) => x != null)).map(([y, v]) => ({ y: +y, mm: Math.round(v.reduce((a, b) => a + b, 0) * 10) / 10 }));
  const base = mons.filter((r) => r.y >= 1951 && r.y <= 2000);
  const mean = base.reduce((a, r) => a + r.mm, 0) / base.length;
  const byY = new Map(mons.map((r) => [r.y, (100 * r.mm) / mean - 100]));
  const fg = P.foodgrains.data;
  const rows = prodB.dates.map((d, i) => {
    const y = +d.slice(0, 4);
    if (i === 0 || fg[i] == null || fg[i - 1] == null || !byY.has(y)) return null;
    return { y, fy: fyOf(d), rain: byY.get(y), chg: pct(fg[i], fg[i - 1]) };
  }).filter(Boolean);
  const driest = [...rows].sort((a, b) => a.rain - b.rain).slice(0, 10);
  return { rows, driest, fell: driest.filter((r) => r.chg < 0).length, worst: driest[0], last: rows.at(-1) };
})();

/* ------------------------------------------------------------------ the page's figures */
/** Every number id the page sets, with the exact text (and markup) it shows. */
export function numbers() {
  const N = {};
  N["m-latest"] = `${FY} final; ${AEY} advance estimate; stocks to ${dayOf(pdsL.dates[0])}`;
  N["n-fg"] = fmt.num1(mt(P.foodgrains.data[iP])) + pc(" mt");
  N["d-fg"] = `${FY}; <b>${fmt.num1(mt(AE.production_foodgrains.data[0]))} mt</b> in ${AEY} (${aeStage})`;
  N["n-yield"] = fmt.inr(Y.wheat.data[iY]) + pc(" kg");
  N["d-yield"] = `<b>${fmt.x1(Y.wheat.data[iY] / Y.wheat.data[0])}</b> the 1950-51 yield, ${fyOf(yieldB.dates[iY])}`;
  N["n-msp"] = fmt.inrR(M.paddy_common.data[iPad]);
  N["d-msp"] = `${fyOf(mspB.dates[iPad])}, up <b>${fmt.pct1(pct(M.paddy_common.data[iPad], M.paddy_common.data[iPad - 1]))}</b>`;
  N["n-stock"] = fmt.num1(S.stocks_total.data[iS] / 10) + pc(" mt");
  N["d-stock"] = `<b>${fmt.x1(S.stocks_total.data[iS] / NORM)}</b> the buffer norm, ${stockAsOn}`;
  N["nspark-fg"] = K.spark(ser(prodB, "foodgrains", mt).filter((p) => p[1] != null), { width: 190, height: 44 });
  // § 01
  N["u-reading"] = `Crop year ${FY}, final estimates; ${AEY}, ${aeStage}`;
  N["rb-fg"] = fmt.num1(mt(P.foodgrains.data[iP])) + pc(" mt");
  N["rt-fy"] = FY;
  N["rb-side-l"] = `${AEY}, ${aeStage}`;
  N["rb-side"] = fmt.num1(mt(AE.production_foodgrains.data[0])) + " mt";
  // § 02
  { const last = HA.at(-1), first = HA[0];
    Object.assign(N, { "pv-hectare": fmt.inrR(last.value), "pc-hectare": `a hectare of wheat, ${fyOf(last.iso)}`, "lr-yield": kg(last.yield), "lr-gross": fmt.inrR(last.value),
      "ex-ha-fy": fyOf(last.iso), "ex-ha-yield": kg(last.yield), "ex-ha-msp": fmt.inrR(last.msp), "ex-ha-gross": fmt.inrR(last.value), "ex-ha-fy0": fyOf(first.iso), "ex-ha-gross0": fmt.inrR(first.value) }); }
  // § 04
  { const fg = trim(ser(prodB, "foodgrains", mt)), first = fg[0], last = fg.at(-1);
    N["tt-harvest"] = WORDS[Math.round(last[1] / first[1])] ?? fmt.x1(last[1] / first[1]);
    Object.assign(N, { "pv-harvest": fmt.num1(last[1]) + " mt", "pc-harvest": `foodgrains, ${FY}, final estimate`, "ex-hv-fy": FY, "ex-hv-fg": mtS(P.foodgrains.data[iP]), "ex-hv-fg0": mtS(P.foodgrains.data[0]),
      "ex-hv-fy0": fyOf(prodB.dates[0]), "ex-hv-stage": aeStage, "ex-hv-aey": AEY, "ex-hv-ae": mtS(AE.production_foodgrains.data[0]) }); }
  Object.assign(N, { "pv-grains": fmt.num1(mt(P.rice.data[iP])) + " mt", "ex-gr-fy": FY, "ex-gr-rice": mtS(P.rice.data[iP]), "ex-gr-wheat": mtS(P.wheat.data[iP]), "ex-gr-coarse": mtS(P.coarse_cereals.data[iP]), "ex-gr-pulses": mtS(P.pulses.data[iP]) });
  N["pv-yield"] = fmt.x1(Y.wheat.data[iY] / Y.wheat.data[0]);
  N["ex-yl-fy"] = fyOf(yieldB.dates[iY]);
  for (const k of ["wheat", "rice", "pulses"]) { N[`ex-yl-${k}`] = kg(Y[k].data[iY]); N[`ex-yl-${k}0`] = kg(Y[k].data[0]); }
  { const mha = (v) => fmt.num1(v / 1000), fall = -pct(A.coarse_cereals.data[iA], A.coarse_cereals.data[0]);
    Object.assign(N, { "tt-area": Math.abs(fall - 100 / 3) < 3 ? "a third" : fmt.pct0(fall), "pv-area": mha(A.foodgrains.data[iA]), "ex-ar-fy": fyOf(areaB.dates[iA]), "ex-ar-rice": mha(A.rice.data[iA]),
      "ex-ar-wheat": mha(A.wheat.data[iA]), "ex-ar-coarse": mha(A.coarse_cereals.data[iA]), "ex-ar-pulses": mha(A.pulses.data[iA]), "ex-ar-coarse0": mha(A.coarse_cereals.data[0]) }); }
  // § 05
  Object.assign(N, { "pv-crops": fmt.num1(mt(P.sugarcane.data[iP])), "ex-cr-fy": FY, "ex-cr-sugar": mtS(P.sugarcane.data[iP]), "ex-cr-oil": mtS(P.oilseeds.data[iP]),
    "ex-cr-cotton": fmt.num1(P.cotton.data[iP] / 100) + " lakh bales", "ex-cr-tea": g1(P.tea.data[iP]) + " thousand tonnes" });
  { const I = idx08.series, i8 = idx08.dates.length - 1;
    Object.assign(N, { "pv-index": fmt.num1(I.production_all_crops.data[i8]), "pc-index": `all crops, ${fyOf(idx08.dates[i8])}, TE 2007-08 = 100`, "ex-ix-fy": fyOf(idx08.dates[i8]),
      "ex-ix-all": fmt.num1(I.production_all_crops.data[i8]), "ex-ix-fg": fmt.num1(I.production_foodgrains.data[i8]), "ex-ix-nfg": fmt.num1(I.production_non_foodgrains.data[i8]) }); }
  // § 06
  { const mha = (v) => fmt.num1(v / 1000);
    Object.assign(N, { "pv-land": fmt.pct1(L.irrigated_share.data[iL]), "ex-ld-net": mha(L.net_sown_area.data[iL]), "ex-ld-gross": mha(L.gross_sown_area.data[iL]), "ex-ld-ci": fmt.pct1(L.cropping_intensity.data[iL]),
      "ex-ld-irr": fmt.pct1(L.irrigated_share.data[iL]), "ex-ld-irr0": fmt.pct1(L.irrigated_share.data[0]), "mn-unirr": fmt.pct0(100 - L.irrigated_share.data[iL]) }); }
  { const f = trim(ser(landB, "fertiliser_per_ha")), last = f.at(-1), iPe = lastIdx(L.pesticides.data);
    Object.assign(N, { "pv-fert": fmt.num1(last[1]), "ex-ft-tot": fmt.num1(L.fertiliser_npk.data[iL]), "ex-ft-fy": fyOf(landB.dates[iL]), "ex-ft-ha": fmt.num1(last[1]) + " kg",
      "ex-ft-pest": fmt.num1(L.pesticides.data[iPe]), "ex-ft-pfy": fyOf(landB.dates[iPe]) }); }
  // § 07
  Object.assign(N, { "tt-msp": fmt.count(M.paddy_common.data[iPad] / M.paddy_common.data[0]), "pv-msp": fmt.inrR(M.paddy_common.data[iPad]), "pc-msp": `paddy, a quintal, ${fyOf(mspB.dates[iPad])}`,
    "ex-ms-py": fyOf(mspB.dates[iPad]), "ex-ms-p": fmt.inrR(M.paddy_common.data[iPad]), "ex-ms-pr": fmt.pct1(pct(M.paddy_common.data[iPad], M.paddy_common.data[iPad - 1])),
    "ex-ms-wy": fyOf(mspB.dates[iWht]), "ex-ms-w": fmt.inrR(M.wheat.data[iWht]), "ex-ms-wr": fmt.pct1(pct(M.wheat.data[iWht], M.wheat.data[iWht - 1])) });
  { const nP = MI.filter((r) => r.paddy != null && r.paddy > r.cpi).length, nW = MI.filter((r) => r.wheat != null && r.wheat > r.cpi).length, lastR = MI.at(-1);
    Object.assign(N, { "pv-mspinfl": `${nP} of ${MI.filter((r) => r.paddy != null).length}`, "sb-mi-span": `${MI[0].fy} to ${lastR.fy}`, "ex-mi-n": String(MI.length), "ex-mi-p": String(nP), "ex-mi-w": String(nW),
      "ex-mi-fy": lastR.fy, "ex-mi-pl": fmt.pct1(lastR.paddy), "ex-mi-wl": fmt.pct1(lastR.wheat), "ex-mi-cl": fmt.pct1(lastR.cpi) }); }
  { const p = MA.find((r) => r.k === "paddy_common"), w = MA.find((r) => r.k === "wheat");
    Object.assign(N, { "pv-mspall": fmt.pct0(MA[0].rise), "pc-mspall": `${MA[0].label.toLowerCase()}, ${MA[0].fy0} to ${MA[0].fy}`, "ex-ma-top": `${MA[0].label.toLowerCase()} (${fmt.pct0(MA[0].rise)})`,
      "ex-ma-bot": `${MA.at(-1).label.toLowerCase()} (${fmt.pct0(MA.at(-1).rise)})`, "ex-ma-p": fmt.pct0(p.rise), "ex-ma-w": fmt.pct0(w.rise) }); }
  // § 08: procurement in the latest year over the previous crop year's rice and wheat harvest
  // (wheat bought in April 2025 is the 2024-25 crop); lakh tonnes over (thousand tonnes / 100), a per cent
  { const lt = (v) => fmt.num1(v / 10) + " million tonnes", share = (S.procurement_rice.data[iS] + S.procurement_wheat.data[iS]) / ((P.rice.data[iP] + P.wheat.data[iP]) / 100) * 100;
    Object.assign(N, { "tt-proc": share > 30 && share < 36 ? "a third" : share > 22 && share <= 30 ? "a quarter" : fmt.pct0(share), "pv-proc": fmt.pct0(share), "pc-proc": `rice and wheat bought in ${fyOf(pdsB.dates[iS])}, of the ${FY} harvest`,
      "ex-pr-fy": fyOf(pdsB.dates[iS]), "ex-pr-rice": lt(S.procurement_rice.data[iS]), "ex-pr-wheat": lt(S.procurement_wheat.data[iS]), "ex-pr-off": lt(S.offtake_total.data[iS]) }); }
  Object.assign(N, { "pv-stocks": fmt.num1(S.stocks_total.data[iS] / 10) + " mt", "pc-stocks": `on ${stockAsOn}, ${fmt.x1(S.stocks_total.data[iS] / NORM)} the norm`, "ex-st-date": stockAsOn,
    "ex-st-tot": mtS(S.stocks_total.data[iS] * 100), "ex-st-rice": mtS(S.stocks_rice.data[iS] * 100), "ex-st-wheat": mtS(S.stocks_wheat.data[iS] * 100), "ex-st-x": fmt.x1(S.stocks_total.data[iS] / NORM),
    "ex-st-ld": dayOf(pdsL.dates[0]), "ex-st-lv": mtS(pdsL.series.stocks_total.data[0] * 100) });
  // § 09
  { const fy = fyOf(ST.foodgrains.year), up = stShare("foodgrains", "Uttar Pradesh");
    Object.assign(N, { "sb-states-fy": fy, "pv-states": fmt.pct1(up), "pc-states": `Uttar Pradesh's share of foodgrains, ${fy}`, "ex-sg-up": fmt.pct1(up),
      "ex-sg-wheat3": fmt.pct0(top3("wheat")), "ex-sg-cotton3": fmt.pct0(top3("cotton")), "ex-sg-sugar3": fmt.pct0(top3("sugarcane")) }); }
  { const lastFy = fyOf(SP.dates.at(-1)), mpw = longShare("madhya_pradesh__wheat", "wheat"), upw = longShare("uttar_pradesh__wheat", "wheat"), pbw = longShare("punjab__wheat", "wheat");
    Object.assign(N, { "sb-long-fy": lastFy, "pv-statelong": fmt.pct1(lastOf(mpw)[1]), "ex-sl-fy": lastFy, "ex-sl-upw": fmt.pct1(lastOf(upw)[1]), "ex-sl-mpw": fmt.pct1(lastOf(mpw)[1]),
      "ex-sl-pbw": fmt.pct1(lastOf(pbw)[1]), "ex-sl-pbw0": fmt.pct1(pbw[0][1]) }); }
  { const tw = SY.top("Wheat"), tr = SY.top("Rice");
    Object.assign(N, { "sb-sy-fy": SY.fy, "pv-stateyield": kg(tw.v), "pc-stateyield": `${tw.name}, wheat per hectare, ${SY.fy}`, "ex-sy-wt": tw.name, "ex-sy-wv": kg(tw.v),
      "ex-sy-rt": tr.name, "ex-sy-rv": kg(tr.v), "ex-sy-wai": kg(SY.ai.Wheat), "ex-sy-rai": kg(SY.ai.Rice) }); }
  Object.assign(N, { "sb-sf-fy": SF.fy, "pv-statefert": fmt.num1(SF.rows[0].v) + " kg", "pc-statefert": `${SF.rows[0].name}, per hectare, ${SF.fy}`, "ex-sf-fy": SF.fy,
    "ex-sf-top": SF.rows[0].name, "ex-sf-topv": fmt.num1(SF.rows[0].v) + " kg", "ex-sf-ai": fmt.num1(SF.ai.v) + " kg" });
  // § 10
  Object.assign(N, { "pv-monsoon": `${WORDS[MN.fell] ?? MN.fell} of ten`.replace(/^\w/, (c) => c.toUpperCase()), "ex-mn-dy": `the monsoon of ${MN.worst.y}`, "ex-mn-dv": fmt.pct1(-MN.worst.rain),
    "ex-mn-dc": signPct(MN.worst.chg), "ex-mn-ly": `${MN.last.y} (crop year ${MN.last.fy})`, "ex-mn-lv": MN.last.rain >= 0 ? fmt.pct1(MN.last.rain) + " above" : fmt.pct1(-MN.last.rain) + " below", "ex-mn-lc": signPct(MN.last.chg) });
  N["prov-vintage"] = N["prov-vintage2"] = prodB.meta.vintage;
  return N;
}

/* ------------------------------------------------------------------ the plates */
const RS = { prefix: "₹" }, PCT = { suffix: "%" };
const csvRows = (cols, rows) => ({ cols, rows });

/** § 02: one hectare of wheat at the support price, rupees of each year. */
export function hectare() {
  const data = HA.map((r) => [r.iso, r.value]);
  return figure({
    bare: true, file: "india-atlas_wheat-hectare-at-msp",
    label: `What an average hectare of wheat would fetch at the support price, before costs, from ${fyOf(HA[0].iso)} to ${fyOf(HA.at(-1).iso)}: ${fmt.inrR(HA[0].value)} rising to ${fmt.inrR(HA.at(-1).value)}`,
    data: csvRows(["crop_year", "wheat_yield_kg_per_ha", "wheat_msp_rs_per_quintal", "rs_per_ha_at_msp"], HA.map((r) => [fyOf(r.iso), r.yield, r.msp, r.value])),
    draw: (width) => K.line({ width, freq: "year", unit: RS, endDp: 0, hoverDp: 0,
      series: [{ name: "Wheat, a hectare at the support price", data, role: "lead" }] }),
  });
}

/** § 04: foodgrains since 1950-51, final estimates; the advance estimate a ringed point apart. */
export function harvest() {
  const fin = trim(ser(prodB, "foodgrains", mt)), aeV = mt(AE.production_foodgrains.data[0]);
  return figure({
    bare: true, file: "india-atlas_foodgrain-production",
    label: `Foodgrain production since 1950-51 on final estimates, from ${n1(fin[0][1])} to ${n1(fin.at(-1)[1])} million tonnes in ${FY}, with the ${aeStage} for ${AEY}, ${n1(aeV)}, as a separate point`,
    data: csvRows(["crop_year", "estimate", "foodgrains_million_tonnes"], [...fin.map(([d, v]) => [fyOf(d), "final", v]), [AEY, aeStage, aeV]]),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " mt" }, endDp: 1, tDomain: [K.tnum(fin[0][0]), K.tnum(AED)],
      endSub: `${FY}, final`,
      series: [{ name: "Foodgrains, final", data: fin, role: "lead" }, { name: `${AEY}, advance`, data: [[AED, aeV]], role: "lead", label: false }],
      // on a phone the line climbs too steeply at its end for a note beside the ring: a rule and a label above
      ...(width < 520 ? { events: [{ t: AED, side: "left", label: `${AEY} advance: ${n1(aeV)} mt` }] } : { notes: [{ d: AED, v: aeV, side: "left", text: `${AEY}, ${aeStage}\n${n1(aeV)} mt` }] }) }),
  });
}

/** § 04: area under each foodgrain; coarse cereals the story. */
export function area() {
  const KEYS = [["coarse_cereals", "Coarse cereals", "lead"], ["rice", "Rice", "ctx"], ["wheat", "Wheat", "ctx"], ["pulses", "Pulses", "ctx"]];
  const S2 = KEYS.map(([k, l, role]) => ({ name: l, data: ser(areaB, k, (v) => v / 1000), role }));
  return figure({
    bare: true, file: "india-atlas_foodgrain-area",
    label: `Area under rice, wheat, coarse cereals and pulses since 1950-51, million hectares; coarse cereals fell from ${n1(A.coarse_cereals.data[0] / 1000)} to ${n1(A.coarse_cereals.data[iA] / 1000)}`,
    data: csvRows(["crop_year", ...KEYS.map((c) => c[0] + "_thousand_ha")], areaB.dates.map((d, i) => [fyOf(d), ...KEYS.map(([k]) => A[k].data[i])])),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " m ha" }, endFormat: n1, series: S2 }),
  });
}

/** § 04: yield per hectare; wheat leads, rice the comparison. */
export function yields() {
  const KEYS = [["wheat", "Wheat", "lead"], ["rice", "Rice", "comp"], ["coarse_cereals", "Coarse cereals", "ctx"], ["pulses", "Pulses", "ctx"]];
  return figure({
    bare: true, file: "india-atlas_foodgrain-yield",
    label: `Yield per hectare of wheat, rice, coarse cereals and pulses since 1950-51; in ${fyOf(yieldB.dates[iY])} wheat ${kg(Y.wheat.data[iY])}, rice ${kg(Y.rice.data[iY])}, coarse cereals ${kg(Y.coarse_cereals.data[iY])}, pulses ${kg(Y.pulses.data[iY])}`,
    data: csvRows(["crop_year", ...KEYS.map((c) => c[0] + "_kg_per_ha")], yieldB.dates.map((d, i) => [fyOf(d), ...KEYS.map(([k]) => Y[k].data[i])])),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " kg" }, endFormat: (v) => K.num(v, { dp: 0 }), hoverDp: 0,
      series: KEYS.map(([k, l, role]) => ({ name: l, data: ser(yieldB, k), role })) }),
  });
}

/** § 05: the index of all crops on three bases, each a ruler of its own, never joined. */
export function index() {
  const r82 = trim(ser(idx82, "production_all_crops")), r94 = trim(ser(idx94, "production_all_crops")), r08 = trim(ser(idx08, "production_all_crops"));
  const aeIdx = AE.index_production_all_crops?.data[0];
  return figure({
    bare: true, file: "india-atlas_agricultural-production-index-three-bases",
    label: `Index of agricultural production, all crops, on three bases drawn apart: TE 1981-82 = 100 from ${fyOf(r82[0][0])} to ${fyOf(r82.at(-1)[0])}, TE 1993-94 = 100 to ${fyOf(r94.at(-1)[0])}, and TE 2007-08 = 100 at ${n1(r08.at(-1)[1])} in ${fyOf(r08.at(-1)[0])}`,
    data: csvRows(["crop_year", "base", "all_crops_production_index"], [...r82.map(([d, v]) => [fyOf(d), "TE 1981-82=100", v]), ...r94.map(([d, v]) => [fyOf(d), "TE 1993-94=100", v]), ...r08.map(([d, v]) => [fyOf(d), "TE 2007-08=100", v])]),
    draw: (width) => {
      const phone = width < 520;
      return K.line({ width, freq: "year", endDp: 1, endSub: phone ? "2007-08 base" : "TE 2007-08 = 100", tDomain: [K.tnum(r82[0][0]), K.tnum(aeIdx != null ? AED : r08.at(-1)[0])],
        series: [
          { name: "TE 1981-82 = 100", data: r82, role: "ctx", label: false },
          { name: "TE 1993-94 = 100", data: r94, role: "ctx", label: false, color: K.C.leadSoft },
          { name: "TE 2007-08 = 100", data: r08, role: "lead" },
          ...(aeIdx != null ? [{ name: `${AEY}, advance`, data: [[AED, aeIdx]], role: "lead", label: false }] : []),
        ],
        refs: [{ y: 100, label: "Base years = 100" }],
        events: [{ t: r94[0][0], side: "left", label: phone ? "1981-82 base" : "TE 1981-82 = 100" }, { t: r08[0][0], side: "left", label: phone ? "1993-94 base" : "TE 1993-94 = 100" }],
        notes: aeIdx != null && !phone ? [{ d: AED, v: aeIdx, side: "left", text: `${AEY}, advance\n${n1(aeIdx)}` }] : [] });
    },
  });
}

/** § 06: net sown, gross sown and gross irrigated area. */
export function land() {
  const KEYS = [["gross_irrigated_area", "Irrigated (gross)", "lead"], ["gross_sown_area", "Sown (gross)", "ctx"], ["net_sown_area", "Net sown", "ctx"]];
  return figure({
    bare: true, file: "india-atlas_land-use-and-irrigation",
    label: `Net sown, gross sown and gross irrigated area since 1950-51, million hectares; in ${fyOf(landB.dates[iL])} net sown ${n1(L.net_sown_area.data[iL] / 1000)}, gross sown ${n1(L.gross_sown_area.data[iL] / 1000)}, gross irrigated ${n1(L.gross_irrigated_area.data[iL] / 1000)}`,
    data: csvRows(["year", "net_sown_thousand_ha", "gross_sown_thousand_ha", "gross_irrigated_thousand_ha", "cropping_intensity_pct", "irrigated_share_pct"], landB.dates.map((d, i) => [fyOf(d), L.net_sown_area.data[i], L.gross_sown_area.data[i], L.gross_irrigated_area.data[i], L.cropping_intensity.data[i], L.irrigated_share.data[i]])),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " m ha" }, endFormat: n1, series: KEYS.map(([k, l, role]) => ({ name: l, data: ser(landB, k, (v) => v / 1000), role })) }),
  });
}

/** § 06: fertiliser per hectare of gross sown area. */
export function fert() {
  const data = trim(ser(landB, "fertiliser_per_ha"));
  return figure({
    bare: true, file: "india-atlas_fertiliser-per-hectare",
    label: `Fertiliser nutrients per hectare of gross sown area: ${n1(data[0][1])} kg in ${fyOf(data[0][0])}, ${n1(data.at(-1)[1])} kg in ${fyOf(data.at(-1)[0])}`,
    data: csvRows(["year", "fertiliser_npk_lakh_tonnes", "gross_sown_thousand_ha", "kg_per_ha"], landB.dates.map((d, i) => [fyOf(d), L.fertiliser_npk.data[i], L.gross_sown_area.data[i], L.fertiliser_per_ha.data[i]])),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " kg" }, endDp: 1, series: [{ name: "Fertiliser per hectare", data, role: "lead" }] }),
  });
}

/** § 07: support prices for paddy and wheat. */
export function msp() {
  const yrs = (i) => fyOf(mspB.dates[i]);
  return figure({
    bare: true, file: "india-atlas_msp-paddy-wheat",
    label: `Minimum support prices since 1975-76, rupees a quintal: paddy ${fmt.inrR(M.paddy_common.data[iPad])} in ${yrs(iPad)}, wheat ${fmt.inrR(M.wheat.data[iWht])} in ${yrs(iWht)}`,
    data: csvRows(["crop_year", "paddy_common_rs_per_quintal", "wheat_rs_per_quintal"], mspB.dates.map((d, i) => [fyOf(d), M.paddy_common.data[i], M.wheat.data[i]])),
    draw: (width) => K.line({ width, freq: "year", unit: RS, endDp: 0, hoverDp: 0,
      series: [{ name: "Paddy (common)", short: `Paddy ${yrs(iPad)}`, data: trim(ser(mspB, "paddy_common")), role: "lead" }, { name: "Wheat", short: `Wheat ${yrs(iWht)}`, data: trim(ser(mspB, "wheat")), role: "comp" }] }),
  });
}

/** § 07: ten-year rise in each crop's support price, ranked; paddy and wheat picked out. */
export function mspall() {
  return figure({
    bare: true, file: "india-atlas_msp-ten-year-rise",
    label: `Rise in each crop's minimum support price over its latest ten crop years: ${MA[0].label} most, ${fmt.pct0(MA[0].rise)}; ${MA.at(-1).label} least, ${fmt.pct0(MA.at(-1).rise)}`,
    data: csvRows(["crop", "from_crop_year", "to_crop_year", "latest_rs_per_quintal", "rise_pct"], MA.map((r) => [r.label, r.fy0, r.fy, r.latest, +r.rise.toFixed(2)])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 0,
      rows: MA.map((r) => ({ name: r.label, value: r.rise, highlight: r.k === "paddy_common" || r.k === "wheat", note: width < 560 ? undefined : `now ${fmt.inrR(r.latest)}, ${r.fy}` })) }),
  });
}

/** § 08: procurement of rice and wheat, and grain issued. */
export function proc() {
  const lt = (v) => v / 10;
  const KEYS = [["procurement_rice", "Rice procured", "lead"], ["procurement_wheat", "Wheat procured", "comp"], ["offtake_total", "Issued", "ctx"]];
  return figure({
    bare: true, file: "india-atlas_procurement-offtake",
    label: `Rice and wheat procured and grain issued from the central pool since 1972-73, million tonnes; in ${fyOf(pdsB.dates[iS])} rice ${n1(lt(S.procurement_rice.data[iS]))}, wheat ${n1(lt(S.procurement_wheat.data[iS]))}, issued ${n1(lt(S.offtake_total.data[iS]))}`,
    data: csvRows(["year", "rice_procured_lakh_t", "wheat_procured_lakh_t", "offtake_total_lakh_t"], pdsB.dates.map((d, i) => [fyOf(d), S.procurement_rice.data[i], S.procurement_wheat.data[i], S.offtake_total.data[i]])),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " mt" }, endFormat: n1, series: KEYS.map(([k, l, role]) => ({ name: l, data: ser(pdsB, k, lt), role })) }),
  });
}

/** § 08: central-pool stocks on 1 April against the buffer norm; the latest position apart. */
export function stocks() {
  const lt = (v) => v / 10;
  // a year-end stock is the position on 1 April of the next year: dated there
  const sh = (k) => ser(pdsB, k, lt).map(([d, v]) => [shiftYear(d), v]);
  const latest = lt(pdsL.series.stocks_total.data[0]), LD = pdsL.dates[0];
  return figure({
    bare: true, file: "india-atlas_central-pool-stocks",
    label: `Rice and wheat in the central pool on 1 April each year since 1973, million tonnes, against the 1 April buffer norm of ${n1(NORM / 10)} set in 2015; ${n1(lt(S.stocks_total.data[iS]))} on ${stockAsOn} and ${n1(latest)} on ${dayOf(LD)}`,
    data: csvRows(["as_on", "total_lakh_t", "rice_lakh_t", "wheat_lakh_t"], [...pdsB.dates.map((d, i) => [`1 April ${+d.slice(0, 4) + 1}`, S.stocks_total.data[i], S.stocks_rice.data[i], S.stocks_wheat.data[i]]), [dayOf(LD), pdsL.series.stocks_total.data[0], pdsL.series.stocks_rice?.data[0], pdsL.series.stocks_wheat?.data[0]]]),
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " mt" }, endFormat: n1, tDomain: [K.tnum(shiftYear(pdsB.dates[0])), K.tnum(LD)],
      series: [{ name: "Total, 1 April", short: "Total", data: sh("stocks_total"), role: "lead" }, { name: "Rice", data: sh("stocks_rice"), role: "ctx" }, { name: "Wheat", data: sh("stocks_wheat"), role: "ctx" },
        { name: dayOf(LD), data: [[LD, latest]], role: "lead", label: false }],
      refs: [{ y: NORM / 10, from: "2015-04-01", label: width < 520 ? `Norm, ${K.num(NORM / 10, { dp: 2 })}` : `1 April buffer norm, ${K.num(NORM / 10, { dp: 2 })} mt` }],
      notes: [{ d: LD, v: latest, side: "left", text: `${dayOf(LD)}\n${n1(latest)} mt` }] }),
  });
}

/** § 09: fertiliser per hectare by state, ranked against All India. */
export function statefert() {
  return figure({
    bare: true, file: "india-atlas_fertiliser-per-hectare-by-state",
    label: `Fertiliser per hectare by state, ${SF.fy}: ${SF.rows[0].name} ${n1(SF.rows[0].v)} kg, ${SF.rows.at(-1).name} ${n1(SF.rows.at(-1).v)}; All India ${n1(SF.ai.v)}`,
    data: csvRows(["state", "year", "kg_per_ha"], [[SF.ai.name, SF.fy, SF.ai.v], ...SF.rows.map((r) => [r.name, SF.fy, r.v])]),
    draw: (width) => K.bars({ width, dp: 1, unit: { suffix: " kg" }, rows: SF.rows.map((r) => ({ name: r.name, value: r.v })), ref: { value: SF.ai.v, label: `All India ${n1(SF.ai.v)} kg` } }),
  });
}

/** § 10: monsoon rainfall against the change in the harvest, one dot a crop year. */
export function monsoon() {
  const sgn = (v) => (v > 0 ? "+" : "") + K.num(v, { dp: 0 }) + "%";
  const worstFalls = [...MN.rows].sort((a, b) => a.chg - b.chg).slice(0, 4).map((r) => r.fy);
  return figure({
    bare: true, file: "india-atlas_monsoon-and-harvest",
    label: `June to September rainfall against the change in foodgrain output, one dot per crop year since 1951-52; of the ten driest monsoons, ${MN.fell} were followed by a smaller harvest`,
    data: csvRows(["monsoon_year", "crop_year", "jjas_rain_departure_pct_vs_1951_2000", "foodgrain_change_pct"], MN.rows.map((r) => [r.y, r.fy, +r.rain.toFixed(2), +r.chg.toFixed(2)])),
    draw: (width) => K.scatter({ width, xFmt: sgn, yUnit: PCT,
      xLabel: width < 560 ? "Monsoon rain vs average" : "June to September rainfall, above or below the 1951-2000 average",
      yLabel: width < 560 ? "Change in foodgrain output" : "Change in foodgrain output on the year before",
      points: MN.rows.map((r) => ({ name: r.fy, x: r.rain, y: r.chg })), label: [...worstFalls, MN.last.fy] }),
  });
}

// Two crops, one plate: each crop is its own chart (its own scale, redrawn for a phone), set one
// above the other under a small crop heading. The first figure answers the plate's download
// buttons (its CSV carries both crops); the second sits in its own <figure> so it does not.
const subhead = (t) => `<p style="margin:0 0 6px;font:600 14px/1.3 var(--ak-sans);color:var(--ak-ink)">${t}</p>`;
const pairOf = (a, b, la, lb) => `${subhead(la)}${a}<figure style="margin:28px 0 0">${subhead(lb)}${b}</figure>`;

/** § 09: state shares of wheat and rice since 1980-81; split states as two rulers, never joined. */
export function statelong() {
  const panels = [
    { crop: "wheat", title: "Wheat", seam: "2000-04-01", before: "Undivided MP and UP", after: "After the 2000 split",
      lines: [["madhya_pradesh", "Madhya Pradesh", "lead", true], ["punjab", "Punjab", "comp"], ["uttar_pradesh", "Uttar Pradesh", "ctx", true], ["haryana", "Haryana", "ctx"]] },
    { crop: "rice", title: "Rice", seam: "2014-04-01", before: "Undivided Andhra Pradesh", after: "After the split",
      lines: [["andhra_pradesh", "Andhra Pradesh", "lead", true], ["punjab", "Punjab", "comp"], ["west_bengal", "West Bengal", "ctx"], ["odisha", "Odisha", "ctx"]] },
  ];
  const rows = [];
  const draw = (pn) => (width) => {
    const series = [];
    for (const [k, l, role, split] of pn.lines) {
      if (split) { const old = longShare(`${k}_undivided__${pn.crop}`, pn.crop);
        if (old.length) series.push({ name: `${l} (undivided)`, data: old, role: "ctx2", label: false, color: role === "lead" ? K.C.leadTint : K.C.ctx2 }); }
      const nw = longShare(`${k}__${pn.crop}`, pn.crop);
      if (nw.length) series.push({ name: l, data: nw, role });
    }
    const phone = width < 520;
    return K.line({ width, freq: "year", unit: PCT, endDp: 1, series, tDomain: [K.tnum("1980-04-01"), K.tnum(SP.dates.at(-1))],
      seam: { t: pn.seam, before: phone ? "Undivided" : pn.before, after: phone ? "Split" : pn.after } });
  };
  for (const pn of panels) for (const [k, l, , split] of pn.lines) {
    if (split) longShare(`${k}_undivided__${pn.crop}`, pn.crop).forEach(([d, v]) => v != null && rows.push([pn.title, `${l} (undivided)`, fyOf(d), +v.toFixed(2)]));
    longShare(`${k}__${pn.crop}`, pn.crop).forEach(([d, v]) => v != null && rows.push([pn.title, l, fyOf(d), +v.toFixed(2)]));
  }
  const lastFy = fyOf(SP.dates.at(-1)), mpw = longShare("madhya_pradesh__wheat", "wheat"), pbw = longShare("punjab__wheat", "wheat");
  const a = figure({ bare: true, file: "india-atlas_state-shares-wheat-rice", data: csvRows(["crop", "state", "crop_year", "share_of_india_pct"], rows),
    label: `Each state's share of India's wheat since 1980-81, per cent: Madhya Pradesh ${fmt.pct1(lastOf(mpw)[1])} in ${lastFy}, Punjab ${fmt.pct1(lastOf(pbw)[1])} against ${fmt.pct1(pbw[0][1])} in 1980-81; undivided states drawn pale, apart from the states after the split`,
    draw: draw(panels[0]) });
  const b = figure({ bare: true, file: "india-atlas_state-shares-rice", data: csvRows(["crop", "state", "crop_year", "share_of_india_pct"], rows.filter((r) => r[0] === "Rice")),
    label: `Each state's share of India's rice since 1980-81, per cent; undivided Andhra Pradesh drawn pale, apart from Andhra Pradesh after the 2014 split`,
    draw: draw(panels[1]) });
  return pairOf(a, b, "Wheat, share of India's output", "Rice, share of India's output");
}

/** § 09: rice and wheat yield by state, ranked, against All India; Punjab picked out. */
export function stateyield() {
  const fig = (crop, file, extra = {}) => figure({ bare: true, file, ...extra,
    label: `${crop} yield by state, kg per hectare, ${SY.fy}: highest ${SY.top(crop).name} ${kg(SY.top(crop).v)}, All India ${kg(SY.ai[crop])}`,
    draw: (width) => K.bars({ width, dp: 0, unit: { suffix: " kg" }, fmt: (v) => fmt.inr(v),
      rows: SY.rows.filter((r) => r.crop === crop).map((r) => ({ name: r.name, value: r.v, highlight: r.name === "Punjab" })),
      ref: { value: SY.ai[crop], label: `All India ${fmt.inr(SY.ai[crop])}` } }) });
  const a = fig("Rice", "india-atlas_rice-wheat-yield-by-state", { data: csvRows(["crop", "state", "crop_year", "kg_per_ha"], SY.rows.map((r) => [r.crop, r.name, SY.fy, r.v])) });
  const b = fig("Wheat", "india-atlas_wheat-yield-by-state");
  return pairOf(a, b, "Rice, kg per hectare", "Wheat, kg per hectare");
}

/** § 09: each state's share of each crop, states by foodgrain share. */
export function states() {
  const fy = fyOf(ST.foodgrains.year);
  return figure({
    bare: true, file: "india-atlas_state-shares-of-crops",
    label: `Each state's share of India's production of nine crops, per cent, ${fy}: Uttar Pradesh grew ${fmt.pct1(stShare("foodgrains", "Uttar Pradesh"))} of foodgrains; the top three states grew ${fmt.pct0(top3("wheat"))} of wheat and ${fmt.pct0(top3("cotton"))} of cotton`,
    data: csvRows(["state", ...SCROPS.map((c) => c[0] + "_share_pct")], SNAMES.map((n) => [n, ...SCROPS.map(([c]) => { const v = stShare(c, n); return v == null ? null : +v.toFixed(2); })])),
    draw: (width) => K.heatmap({ width, dp: 1, unit: PCT, minLabel: 0.5, legend: ["Under 2%", "30% or more"], stagger: true,
      fill: (v) => K.C.seq[[2, 5, 10, 20, 30].filter((b) => v >= b).length],
      cols: SCROPS.map(([, l]) => (width < 1000 ? l.replace("Coarse cereals", "Coarse").replace("Sugarcane", "Sugar").replace(width < 520 ? "Foodgrains" : "~", "Grains") : l)),
      rows: SNAMES.map((n) => ({ name: n, cells: SCROPS.map(([c]) => stShare(c, n)) })) }),
  });
}

/** § 04: each foodgrain on one shared scale; the advance estimate a hollow ring apart. */
export function grains() {
  const CROPS = [["rice", "Rice", true], ["wheat", "Wheat", true], ["coarse_cereals", "Coarse cereals", false], ["pulses", "Pulses", false]];
  const rows = CROPS.flatMap(([k, l]) => trim(ser(prodB, k, mt)).map(([d, v]) => [l, fyOf(d), "final", v])).concat(CROPS.map(([k, l]) => [l, AEY, aeStage, mt(AE[`production_${k}`].data[0])]));
  return figure({
    bare: true, file: "india-atlas_foodgrains-by-crop",
    label: `Production of rice, wheat, coarse cereals and pulses since 1950-51 on one scale, million tonnes; in ${FY} rice ${n1(mt(P.rice.data[iP]))}, wheat ${n1(mt(P.wheat.data[iP]))}, coarse cereals ${n1(mt(P.coarse_cereals.data[iP]))}, pulses ${n1(mt(P.pulses.data[iP]))}; the ${aeStage} for ${AEY} as hollow rings`,
    data: csvRows(["crop", "crop_year", "estimate", "million_tonnes"], rows),
    draw: (width) => K.multiples({ width, fy: true, unit: { suffix: " mt" }, ph: width < 520 ? 70 : 110, cols: width >= 700 ? 4 : 2,
      panels: CROPS.map(([k, l, hi]) => ({ name: l, highlight: hi, data: [...ser(prodB, k, mt), [AED, null]], open: [[AED, mt(AE[`production_${k}`].data[0])]], openName: `${AEY}, advance` })) }),
  });
}

/** § 05: every commercial crop, each panel on its own scale and in its own unit. */
export function crops() {
  const CROPS = [["sugarcane", "Sugarcane", "million tonnes", (v) => v / 1000], ["oilseeds", "Oilseeds (nine)", "million tonnes", (v) => v / 1000], ["soyabean", "Soyabean", "million tonnes", (v) => v / 1000],
    ["groundnut", "Groundnut", "million tonnes", (v) => v / 1000], ["rapeseed_mustard", "Rapeseed and mustard", "million tonnes", (v) => v / 1000], ["cotton", "Cotton", "lakh bales of 170 kg", (v) => v / 100],
    ["jute_mesta", "Jute and mesta", "lakh bales of 180 kg", (v) => v / 100], ["tea", "Tea", "thousand tonnes", (v) => v], ["coffee", "Coffee", "thousand tonnes", (v) => v], ["tobacco", "Tobacco", "thousand tonnes", (v) => v]];
  const STORY = new Set(["soyabean", "cotton", "jute_mesta"]);
  const rows = [];
  for (const [k, l, u, f] of CROPS) {
    trim(ser(prodB, k, f)).forEach(([d, v]) => v != null && rows.push([l, u, fyOf(d), "final", v]));
    const a = AE[`production_${k}`]?.data[0]; if (a != null) rows.push([l, u, AEY, aeStage, f(a)]);
  }
  return figure({
    bare: true, file: "india-atlas_commercial-crops",
    label: `Production of ten commercial crops since 1950-51, each on its own scale and unit; in ${FY} sugarcane ${mtS(P.sugarcane.data[iP])}, oilseeds ${mtS(P.oilseeds.data[iP])}, cotton ${n1(P.cotton.data[iP] / 100)} lakh bales, tea ${g1(P.tea.data[iP])} thousand tonnes`,
    data: csvRows(["crop", "unit", "crop_year", "estimate", "value"], rows),
    draw: (width) => K.multiples({ width, fy: true, shared: false, ph: width < 520 ? 70 : 90, cols: width >= 1000 ? 5 : width >= 700 ? 3 : 2,
      panels: CROPS.map(([k, l, u, f]) => { const a = AE[`production_${k}`]?.data[0];
        return { name: l, sub: u, highlight: STORY.has(k), data: [...ser(prodB, k, f), [AED, null]], open: a != null ? [[AED, f(a)]] : [], openName: `${AEY}, advance` }; }) }),
  });
}

const MIDOM = (() => { const v = MI.flatMap((r) => [r.paddy, r.wheat, r.cpi]).filter((x) => x != null), lo = Math.floor(Math.min(0, ...v) / 10) * 10, hi = Math.ceil(Math.max(...v) / 10) * 10;
  const ticks = []; for (let t = lo; t <= hi; t += 10) ticks.push(t); return { lo, hi, ticks }; })();
/** § 07: each year's rise in the paddy and wheat support price against farm labourers' inflation. */
export function mspinfl() {
  const ref = MI.map((r) => [r.d, +r.cpi.toFixed(1)]);
  return figure({
    bare: true, file: "india-atlas_msp-rise-vs-cpi-al",
    label: `Rise in the paddy and wheat support price on the year before against farm labourers' inflation, crop years ${MI[0].fy} to ${MI.at(-1).fy}: paddy's rise beat inflation in ${MI.filter((r) => r.paddy != null && r.paddy > r.cpi).length} years, wheat's in ${MI.filter((r) => r.wheat != null && r.wheat > r.cpi).length}`,
    data: csvRows(["crop_year", "paddy_msp_rise_pct", "wheat_msp_rise_pct", "cpi_al_crop_year_average_yoy_pct"], MI.map((r) => [r.fy, r.paddy == null ? null : +r.paddy.toFixed(2), r.wheat == null ? null : +r.wheat.toFixed(2), +r.cpi.toFixed(2)])),
    draw: (width) => K.multiples({ width, tFmt: fyOf, unit: PCT, domain: MIDOM, ref: { data: ref, label: "Farm labourers' inflation" }, ph: width < 520 ? 120 : 170, cols: width < 520 ? 1 : 2,
      panels: [["paddy", "Paddy (common)"], ["wheat", "Wheat"]].map(([k, l]) => ({ name: l, highlight: true,
        sub: width < 520 ? "Support price rise; dashed: labourers' inflation" : "Rise in the support price (blue); farm labourers' inflation (dashed)",
        data: MI.map((r) => [r.d, r[k] == null ? null : +r[k].toFixed(1)]) })) }),
  });
}
