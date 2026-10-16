// State economies guide: the plates and every number on the page, computed at build time.
// Data: data/series/states-*.json, baked by scripts/lib/products/states.mjs from MoSPI's
// regional accounts (base 2011-12) and the RBI Handbook of Statistics on Indian States.
// Cross-state plates compare one fiscal year, the latest the fixed panel covers
// (states-spread's last date), so no ranking mixes years; 2025-26, where a state has
// published it, is in the every-state table. src/pages/guides/states.astro writes V[id] into
// each number id and sets each chart into its plate's .plotzone; nothing here runs in a browser.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";
import { numWord } from "./precision.js";
import spreadB from "../../data/series/states-spread.json";
import pcB from "../../data/series/states-pcnsdp-current.json";
import pcRealB from "../../data/series/states-pcnsdp-constant.json";
import gsdpB from "../../data/series/states-gsdp-current.json";
import gsdpRealB from "../../data/series/states-gsdp-constant.json";
import growthB from "../../data/series/states-growth-real.json";
import structB from "../../data/series/states-structure.json";
import sharesB from "../../data/series/states-industry-shares.json";
import finB from "../../data/series/states-finances.json";

const pc = (u) => `<span class="pc">${u}</span>`;
const fy = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const inrR = fmt.inrR;
const lakhCr = (crore) => "₹" + (crore / 1e5).toFixed(1) + " lakh crore";   // review-a: one decimal on a lakh crore figure
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
// a state's display name: the label as served, less our own annotations
const nameOf = (s) => s.label.replace(/ \(derived.*\)$/, "").replace(/:.*$/, "");
const SHORT = { "Andaman & Nicobar Islands": "Andaman & Nicobar", "Jammu & Kashmir (UT, from 2019-20)": "J&K (UT)", "Jammu & Kashmir (state, with Ladakh, to 2018-19)": "J&K (state, to 2018-19)" };
const short = (n) => SHORT[n] ?? n;
const noDag = (n) => n.replace(" †", "");

// the comparison year: the panel's latest (every cross-state plate uses it)
const Y = spreadB.dates.at(-1), YL = fy(Y), Y0 = spreadB.dates[0];
const NEXT = `${+Y.slice(0, 4) + 1}-04-01`;
const at = (b, key, iso) => { const s = b.series[key]; const i = b.dates.indexOf(iso); return s && i >= 0 ? s.data[i] : null; };
const lastOf = (s, dates) => { for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] != null) return { i, date: dates[i], value: s.data[i] }; return null; };
// states for cross-state plates: everything but the pre-2019 J&K state series
const STATE_KEYS = Object.keys(pcB.series).filter((k) => k !== "jammu_and_kashmir_state");

/** Every number id on the page: id -> HTML. */
export const V = {};

/* ---------- title block and § 01 ---------- */
const SP = spreadB.series, n = spreadB.dates.length - 1;
const richest = spreadB.meta.richest.at(-1), poorest = spreadB.meta.poorest.at(-1);
V["m-count"] = String(STATE_KEYS.length);
V["m-latest"] = `${YL} for ${STATE_KEYS.filter((k) => at(pcB, k, Y) != null).length} of ${STATE_KEYS.length}; 2025-26 for ${STATE_KEYS.filter((k) => at(pcB, k, NEXT) != null).length}`;
V["u-reading"] = `MoSPI, fixed panel, ${YL}`;
V["n-gap"] = fmt.x1(SP.gap_current.data[n]);
V["d-gap"] = `<b>${fmt.x1(SP.gap_current.data[0])}</b> in ${fy(Y0)}`;
V["nspark-gap"] = K.spark(spreadB.dates.map((d, i) => [d, SP.gap_current.data[i]]));
V["n-rich"] = inrR(SP.richest_current.data[n]);
V["d-rich"] = `<b>${short(richest.label)}</b>, ${YL}`;
V["n-poor"] = inrR(SP.poorest_current.data[n]);
V["d-poor"] = `<b>${poorest.label}</b>, about ${inrR(SP.poorest_current.data[n] / 365)} a day`;
V["n-grow"] = fmt.pct1(SP.median_real_growth.data[n]);
V["d-grow"] = `<b>${YL}</b>, at constant prices`;
V["rb-gap"] = SP.gap_current.data[n].toFixed(1) + pc("×");
V["rt-panel"] = String(spreadB.meta.panel.length);
V["rt-first"] = fy(Y0);
V["rt-gap0"] = fmt.x1(SP.gap_current.data[0]);
V["rb-cv"] = SP.cv_constant.data[n].toFixed(1) + pc("%");

const inrTick = (v) => (v === 0 ? "0" : "₹" + K.inGroup(v));

/* ---------- § 02 income per person ---------- */
const PC = (() => {
  const rows = STATE_KEYS.map((k) => {
    const s = pcB.series[k], v = at(pcB, k, Y), l = lastOf(s, pcB.dates);
    const useLast = v == null;
    return { key: k, name: short(nameOf(s)), v: useLast ? l.value : v, year: useLast ? fy(l.date) : YL, faint: useLast,
      dot: at(pcB, k, Y0), tick: at(pcB, k, NEXT) };
  }).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const top = rows[0], low = rows.at(-1), med = SP.median_current.data[n];
  const ratio = top.v / low.v;
  V["h-pc"] = `${top.name} produces ${Math.round(ratio)} times as much per person as ${low.name}`;
  V["s-pc-year"] = YL;
  V["pv-pc"] = inrR(top.v);
  V["pc-pc"] = `${top.name}, per person`;
  V["ex-pc-top"] = `${top.name}, ${inrR(top.v)}`;
  V["ex-pc-low"] = `${low.name}, ${inrR(low.v)}`;
  V["ex-pc-lowday"] = inrR(low.v / 365);
  V["ex-pc-med"] = inrR(med);
  V["ex-pc-n25"] = numWord(rows.filter((r) => r.tick != null).length, true);
  return { rows, top, low };
})();
export function pcChart() {
  const { rows, top, low } = PC;
  return figure({
    bare: true, file: "india-atlas_states-income-per-person",
    label: `Income per person by state, ${YL}, ranked: ${rows.map((r) => `${r.name} ${inrR(r.v)}`).join(", ")}`,
    data: { cols: ["State", "Year", "Per-capita NSDP, ₹, current prices", `Per-capita NSDP ${fy(Y0)}`, "Per-capita NSDP 2025-26"], rows: rows.map((r) => [r.name, r.year, r.v, r.dot, r.tick]) },
    draw: (width) => K.bars({
      width, dp: 0, unit: { prefix: "₹" }, tickFmt: inrTick, markName: fy(Y0),
      rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.dot, highlight: r === top || r === low,
        color: r.faint ? K.C.ctx2 : undefined, note: r.faint ? r.year : undefined })),
    }),
  });
}

/* ---------- § 03 the gap over time ---------- */
{
  const g0 = SP.gap_current.data[0], gl = SP.gap_current.data[n];
  V["h-gap"] = gl < g0 ? "The multiple between the richest and poorest state has narrowed" : "The multiple between the richest and poorest state has widened";
  V["s-gap-n"] = String(spreadB.meta.panel.length);
  V["pv-gap"] = fmt.x1(gl);
  V["pc-gap"] = `${YL}, current prices`;
  V["ex-gap-0"] = fmt.x1(g0);
  V["ex-gap-l"] = fmt.x1(gl) + ` in ${YL}`;
  V["ex-cv-0"] = fmt.pct1(SP.cv_constant.data[0]);
  V["ex-cv-l"] = fmt.pct1(SP.cv_constant.data[n]);
  V["ex-gap-r0"] = inrR(SP.richest_current.data[0] - SP.poorest_current.data[0]);
  V["ex-gap-rl"] = inrR(SP.richest_current.data[n] - SP.poorest_current.data[n]);
}
export function gapChart() {
  const P = (k) => spreadB.dates.map((d, i) => [d, SP[k].data[i]]);
  return figure({
    bare: true, file: "india-atlas_states-gap",
    label: `Richest state's income per person as a multiple of the poorest's, a fixed panel of states: from ${fmt.x1(SP.gap_current.data[0])} in ${fy(Y0)} to ${fmt.x1(SP.gap_current.data[n])} in ${YL} at current prices`,
    data: { cols: ["Year", "Richest ÷ poorest, current prices", "Richest ÷ poorest, constant 2011-12 prices", "Spread (CV, %), constant prices", "Richest, ₹", "Poorest, ₹", "Median, ₹", "Richest state", "Poorest state"],
      rows: spreadB.dates.map((d, i) => [fy(d), SP.gap_current.data[i], SP.gap_constant.data[i], SP.cv_constant.data[i], SP.richest_current.data[i], SP.poorest_current.data[i], SP.median_current.data[i], spreadB.meta.richest[i].label, spreadB.meta.poorest[i].label]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: { suffix: "×" }, endDp: 1, hoverDp: 2, zero: true,
      series: [
        { name: "At constant 2011-12 prices", short: "Constant prices", data: P("gap_constant"), role: "ctx" },
        { name: "At current prices", short: "Current prices", data: P("gap_current"), role: "lead" },
      ],
    }),
  });
}

/* ---------- § 04 size ---------- */
const SIZE = (() => {
  const rows = STATE_KEYS.filter((k) => gsdpB.series[k]).map((k) => {
    const s = gsdpB.series[k], v = at(gsdpB, k, Y), l = lastOf(s, gsdpB.dates);
    const useLast = v == null;
    return { key: k, name: short(nameOf(s)) + (s.derived ? " †" : ""), v: (useLast ? l.value : v) / 1e5, year: useLast ? fy(l.date) : YL, faint: useLast,
      tick: at(gsdpB, k, NEXT) == null ? null : at(gsdpB, k, NEXT) / 1e5 };
  }).sort((a, b) => b.v - a.v);
  const top = rows[0];
  const same = rows.filter((r) => !r.faint), total = same.reduce((a, r) => a + r.v, 0);
  V["h-size"] = `${top.name} is the largest economy among the states; the five largest make about ${Math.round((100 * same.slice(0, 5).reduce((a, r) => a + r.v, 0)) / total)}% of the total`;
  V["s-size-year"] = YL;
  V["pv-size"] = "₹" + top.v.toFixed(1) + pc(" lakh cr");
  V["pc-size"] = `${top.name}, ${YL}`;
  V["ex-size-1"] = `${rows[0].name}, ${lakhCr(rows[0].v * 1e5)}`;
  V["ex-size-2"] = `${rows[1].name}, ${lakhCr(rows[1].v * 1e5)}`;
  V["ex-size-3"] = `${rows[2].name}, ${lakhCr(rows[2].v * 1e5)}`;
  V["ex-size-top5"] = fmt.pct1((100 * same.slice(0, 5).reduce((a, r) => a + r.v, 0)) / total);
  // the largest economy against the poorest state's (same year, from the panel)
  const poor = rows.find((r) => r.key === spreadB.meta.poorest.at(-1).key);
  V["ex-size-big"] = top.name;
  V["ex-size-x"] = fmt.x1(top.v / poor.v);
  V["ex-size-small"] = noDag(poor.name);
  return { rows, top };
})();
export function sizeChart() {
  const { rows, top } = SIZE;
  return figure({
    bare: true, file: "india-atlas_states-gsdp",
    label: `Gross state domestic product, ₹ lakh crore at current prices, ${YL}, ranked: ${rows.map((r) => `${noDag(r.name)} ₹${r.v.toFixed(1)} lakh crore`).join(", ")}`,
    data: { cols: ["State", "Year", "GSDP, ₹ lakh crore, current prices", "GSDP 2025-26", "Built from parts"], rows: rows.map((r) => [noDag(r.name), r.year, +r.v.toFixed(4), r.tick == null ? null : +r.tick.toFixed(4), r.name.endsWith("†") ? "yes" : "no"]) },
    draw: (width) => K.bars({
      width, dp: 1, unit: { prefix: "₹" }, fmt: (v) => "₹" + v.toFixed(v < 1 ? 2 : 1), tickFmt: (v) => (v === 0 ? "0" : "₹" + v + (v === K.nice(0, top.v, width < 560 ? 3 : 4).ticks.filter((t) => t <= top.v).at(-1) ? " lakh cr" : "")),
      rows: rows.map((r) => ({ name: r.name, value: r.v, highlight: r === top, color: r.faint ? K.C.ctx2 : undefined, note: r.faint ? r.year : undefined })),
    }),
  });
}

/* ---------- § 05 growth ---------- */
// average real growth a year between 2011-12 and Y: the compound rate of the constant-price level
const span = +Y.slice(0, 4) - +Y0.slice(0, 4);
const cagr = (b, k) => { const a = at(b, k, Y0), z = at(b, k, Y); return a != null && z != null && a > 0 ? (Math.pow(z / a, 1 / span) - 1) * 100 : null; };
const GROW = (() => {
  const rows = STATE_KEYS.filter((k) => !/^jammu_and_kashmir/.test(k) && gsdpRealB.series[k]).map((k) => ({ key: k, name: short(nameOf(gsdpRealB.series[k])) + (gsdpRealB.series[k].derived ? " †" : ""), g: cagr(gsdpRealB, k) }))
    .filter((r) => r.g != null).sort((a, b) => b.g - a.g);
  const med = median(rows.map((r) => r.g));
  const top = rows[0], low = rows.at(-1);
  V["h-growth"] = `${noDag(top.name)} grew fastest after inflation; ${noDag(low.name)} slowest`;
  V["s-growth-year"] = YL;
  V["pv-growth"] = fmt.pct1(top.g);
  V["pc-growth"] = `${noDag(top.name)}, a year`;
  V["ex-gr-top"] = `${noDag(top.name)}, ${fmt.pct1(top.g)} a year`;
  V["ex-gr-low"] = `${noDag(low.name)}, ${fmt.pct1(low.g)}`;
  V["ex-gr-med"] = fmt.pct1(med);
  const covid = STATE_KEYS.map((k) => at(growthB, `${k}__gsdp`, "2020-04-01")).filter((v) => v != null);
  V["ex-gr-neg"] = String(covid.filter((v) => v < 0).length);
  V["ex-gr-negn"] = String(covid.length);
  return { rows, med, top };
})();
export function growthChart() {
  const { rows, med, top } = GROW;
  // rounded once, so the bar labels and the median rule read as the prose does
  const r1 = (v) => Math.round(v * 10) / 10;
  return figure({
    bare: true, file: "india-atlas_states-real-growth",
    label: `Average real growth of GSDP a year by state, ${fy(Y0)} to ${YL}: ${rows.map((r) => `${noDag(r.name)} ${r.g.toFixed(1)}%`).join(", ")}`,
    data: { cols: ["State", `Average real GSDP growth, % a year, ${fy(Y0)} to ${YL}`], rows: rows.map((r) => [noDag(r.name), +r.g.toFixed(2)]) },
    draw: (width) => K.bars({
      width, dp: 1, unit: { suffix: "%" }, refFill: false,
      ref: { value: r1(med), label: `Median ${fmt.pct1(med)}`, dash: "1 3" },
      rows: rows.map((r) => ({ name: r.name, value: r1(r.g), highlight: r === top })),
    }),
  });
}

/* ---------- § 05 convergence ---------- */
const CONV = (() => {
  const pts = spreadB.meta.panel.map(({ key }) => ({ key, name: short(nameOf(pcRealB.series[key])), x: at(pcRealB, key, Y0), g: cagr(pcRealB, key) })).filter((p) => p.x != null && p.g != null);
  const mx = pts.reduce((a, p) => a + p.x, 0) / pts.length, my = pts.reduce((a, p) => a + p.g, 0) / pts.length;
  const r = pts.reduce((a, p) => a + (p.x - mx) * (p.g - my), 0) / Math.sqrt(pts.reduce((a, p) => a + (p.x - mx) ** 2, 0) * pts.reduce((a, p) => a + (p.g - my) ** 2, 0));
  const byX = [...pts].sort((a, b) => a.x - b.x), byG = [...pts].sort((a, b) => a.g - b.g);
  const poorestP = byX[0], richestP = byX.at(-1);
  // name the two ends of each axis and the four largest economies
  const big = ["uttar_pradesh", "maharashtra", "tamil_nadu", "west_bengal"];
  const labelled = [...new Set([poorestP, richestP, byG[0], byG.at(-1), ...pts.filter((p) => big.includes(p.key))])];
  V["h-converge"] = Math.abs(r) < 0.3 ? "Poorer states have not grown clearly faster than richer ones" : r < 0 ? "Poorer states have grown faster per person, but not by much" : "Richer states have grown faster per person";
  V["s-conv-year"] = YL;
  V["pv-converge"] = fmt.num2(r).replace("-", "−");
  V["ex-cv-r"] = fmt.num2(r).replace("-", "−");
  V["ex-cv-poor"] = poorestP.name;
  V["ex-cv-poorg"] = fmt.pct1(poorestP.g);
  V["ex-cv-rich"] = richestP.name;
  V["ex-cv-richg"] = fmt.pct1(richestP.g);
  return { pts, labelled, r };
})();
export function convergeChart() {
  const { pts, labelled, r } = CONV;
  return figure({
    bare: true, file: "india-atlas_states-convergence",
    label: `Income per person in ${fy(Y0)} against its real growth per person since, ${pts.length} states: correlation ${r.toFixed(2)}`,
    data: { cols: ["State", `Income per person ${fy(Y0)}, ₹`, `Real growth per person, % a year, to ${YL}`], rows: pts.map((p) => [p.name, p.x, +p.g.toFixed(2)]) },
    draw: (width) => K.scatter({
      width, xZero: true, yUnit: { suffix: "%" },
      xFmt: (v) => (v === 0 ? "0" : "₹" + K.inGroup(Math.round(v))),
      xLabel: `Income per person, ${fy(Y0)}`, yLabel: "Real growth per person, a year",
      label: labelled.map((p) => p.name),
      points: pts.map((p) => ({ name: p.name, x: p.x, y: Math.round(p.g * 10) / 10 })),
    }),
  });
}

/* ---------- § 06 structure ---------- */
const STRUCT = (() => {
  const G = ["agriculture", "industry", "services"];
  const states = STATE_KEYS.filter((k) => at(structB, `${k}__agriculture`, Y) != null);
  const rows = states.map((k) => ({ key: k, name: short(nameOf(structB.series[`${k}__agriculture`])), ...Object.fromEntries(G.map((g) => [g, at(structB, `${k}__${g}`, Y)])) }))
    .sort((a, b) => b.agriculture - a.agriculture);
  const by = (g) => [...rows].sort((a, b) => b[g] - a[g]);
  V["h-structure"] = `Farming is ${fmt.pct0(by("agriculture")[0].agriculture)} of ${by("agriculture")[0].name}'s value added and ${fmt.pct1(by("agriculture").at(-1).agriculture)} of ${by("agriculture").at(-1).name}'s`;
  V["s-str-year"] = YL;
  V["pv-structure"] = fmt.pct1(by("agriculture")[0].agriculture);
  V["pc-structure"] = `farm share, ${by("agriculture")[0].name}`;
  V["ex-st-agtop"] = `${by("agriculture")[0].name}, ${fmt.pct1(by("agriculture")[0].agriculture)}`;
  V["ex-st-aglow"] = `${by("agriculture").at(-1).name}, ${fmt.pct1(by("agriculture").at(-1).agriculture)}`;
  V["ex-st-intop"] = `${by("industry")[0].name}, ${fmt.pct1(by("industry")[0].industry)}`;
  V["ex-st-svtop"] = `${by("services")[0].name}, ${fmt.pct1(by("services")[0].services)}`;
  return { rows };
})();
export function structureChart() {
  const { rows } = STRUCT;
  return figure({
    bare: true, file: "india-atlas_states-structure",
    label: `Agriculture, industry and services as shares of each state's gross value added, ${YL}, sorted by the farm share`,
    data: { cols: ["State", "Agriculture, %", "Industry, %", "Services, %"], rows: rows.map((r) => [r.name, r.agriculture, r.industry, r.services]) },
    draw: (width) => K.stackBars({
      width, sortBy: 0,
      parts: [{ name: "Agriculture, forestry, fishing", color: K.C.lead }, { name: "Industry: mining, manufacturing, utilities, construction", color: K.C.ctx }, { name: "Services", color: K.C.ctx2 }],
      rows: rows.map((r) => ({ name: r.name, parts: [r.agriculture, r.industry, r.services] })),
    }),
  });
}

/* ---------- § 06 industries heat table ---------- */
const IND = sharesB.meta.industries;
const SHORTI = { agriculture: "Farming", mining: "Mining", manufacturing: "Manufact.", utilities: "Utilities", construction: "Construct.", trade_hotels: "Trade, hotels", transport_comm: "Transport", financial: "Finance", real_estate: "Real estate", public_admin: "Public admin", other_services: "Other serv." };
const TINYI = { agriculture: "Farm", mining: "Mine", manufacturing: "Mfg", utilities: "Util", construction: "Bld", trade_hotels: "Trade", transport_comm: "Trans", financial: "Fin", real_estate: "Real", public_admin: "Admin", other_services: "Other" };
const INDS = (() => {
  const states = STATE_KEYS.filter((k) => at(sharesB, `${k}__agriculture`, Y) != null);
  const rows = states.map((k) => ({ key: k, name: short(nameOf(sharesB.series[`${k}__agriculture`])) })).sort((a, b) => a.name.localeCompare(b.name));
  const cells = rows.flatMap((r) => IND.map((ind) => ({ name: r.name, key: ind.key, v: at(sharesB, `${r.key}__${ind.key}`, Y) }))).filter((c) => c.v != null);
  const top = (key) => cells.filter((c) => c.key === key).sort((a, b) => b.v - a.v)[0];
  const mfg = top("manufacturing");
  V["h-industries"] = `Manufacturing ranges from a sliver to ${fmt.pct0(mfg.v)} of a state's value added, in ${mfg.name}`;
  V["s-ind-year"] = YL;
  V["pv-industries"] = fmt.pct1(mfg.v);
  V["pc-industries"] = `manufacturing, ${mfg.name}`;
  for (const [id, key] of [["ex-in-mfg", "manufacturing"], ["ex-in-min", "mining"], ["ex-in-pub", "public_admin"], ["ex-in-fin", "financial"]]) { const t = top(key); V[id] = `${t.name}, ${fmt.pct1(t.v)}`; }
  return { rows };
})();
export function industriesChart() {
  const { rows } = INDS;
  const cellsOf = (r) => IND.map((i) => at(sharesB, `${r.key}__${i.key}`, Y));
  return figure({
    bare: true, file: "india-atlas_states-industry-shares",
    label: `Each industry's share of each state's gross value added, ${YL}: ${rows.length} states by ${IND.length} industries`,
    data: { cols: ["State", ...IND.map((i) => i.label)], rows: rows.map((r) => [r.name, ...cellsOf(r)]) },
    draw: (width) => K.heatmap({
      width, dp: 1, unit: { suffix: "%" }, legend: ["Smaller share", "larger"],
      cols: IND.map((i) => (width < 900 ? TINYI : SHORTI)[i.key] ?? i.label),
      rows: rows.map((r) => ({ name: width < 560 ? r.name.replace("Andaman & Nicobar", "Andaman & N.") : r.name, cells: cellsOf(r) })),
    }),
  });
}

/* ---------- § 07 finances ---------- */
// the latest year with an actual deficit for most states
const finY = [...finB.dates].reverse().find((d) => Object.keys(finB.series).filter((k) => k.endsWith("__debt")).filter((k) => at(finB, k, d) != null).length >= 20);
const FIN = (() => {
  const rows = Object.keys(finB.series).filter((k) => k.endsWith("__debt") && at(finB, k, finY) != null).map((k) => {
    const st = k.replace(/__debt$/, "");
    return { key: st, name: short(nameOf(finB.series[k])), v: at(finB, k, finY), gfd: at(finB, `${st}__gfd`, finY) };
  }).sort((a, b) => b.v - a.v);
  const top = rows[0], low = rows.at(-1), med = median(rows.map((r) => r.v));
  const end = +finY.slice(0, 4) + 1;
  const gfdTop = [...rows].filter((r) => r.gfd != null).sort((a, b) => b.gfd - a.gfd)[0];
  V["h-finance"] = `${top.name}'s government owes ${fmt.pct0(top.v)} of its GSDP, ${low.name}'s ${fmt.pct0(low.v)}`;
  V["s-fin-end"] = String(end);
  V["s-fin-year"] = fy(finY);
  V["pv-finance"] = fmt.pct1(top.v);
  V["pc-finance"] = `${top.name}, debt to GSDP`;
  V["ex-fn-top"] = `${top.name}, ${fmt.pct1(top.v)}`;
  V["ex-fn-low"] = `${low.name}, ${fmt.pct1(low.v)}`;
  V["ex-fn-med"] = fmt.pct1(med);
  V["ex-fn-gfd"] = `${gfdTop.name}, ${fmt.pct1(gfdTop.gfd)} of GSDP`;
  return { rows, top, end };
})();
export function financeChart() {
  const { rows, top, end } = FIN;
  return figure({
    bare: true, file: "india-atlas_states-debt-deficit",
    label: `State government debt at the end of March ${end} as a share of GSDP, with that year's gross fiscal deficit: ${rows.map((r) => `${r.name} ${r.v.toFixed(1)}%`).join(", ")}`,
    data: { cols: ["State", `Outstanding liabilities, % of GSDP, end-March ${end}`, `Gross fiscal deficit, % of GSDP, ${fy(finY)}`], rows: rows.map((r) => [r.name, r.v, r.gfd]) },
    draw: (width) => K.bars({
      width, dp: 1, unit: { suffix: "%" },
      rows: rows.map((r) => ({ name: r.name, value: r.v, highlight: r === top, note: r.gfd != null ? `deficit ${fmt.pct1Minus(r.gfd).replace("⁠", "")}` : undefined })),
    }),
  });
}

/* ---------- § 08 every state, every measure: rows written at build time ---------- */
export const TABLE = (() => {
  const keys = Object.keys(pcB.series);
  const data = keys.map((k) => {
    const s = pcB.series[k], l = lastOf(s, pcB.dates);
    const g = gsdpB.series[k], gl = g ? lastOf(g, gsdpB.dates) : null;
    const gr = growthB.series[`${k}__gsdp`], grl = gr ? lastOf(gr, growthB.dates) : null;
    const sl = structB.series[`${k}__agriculture`] ? lastOf(structB.series[`${k}__agriculture`], structB.dates) : null;
    return {
      key: k, name: nameOf(s) + (g?.derived ? " †" : ""), year: l ? fy(l.date) : null, yearSort: l ? +l.date.slice(0, 4) : null,
      gsdp: gl ? gl.value / 1e5 : null, pc: l?.value ?? null, g: grl?.value ?? null, gYear: grl ? fy(grl.date) : null,
      cagr: k.startsWith("jammu_and_kashmir") ? null : cagr(gsdpRealB, k),
      ag: sl ? at(structB, `${k}__agriculture`, sl.date) : null, ind: sl ? at(structB, `${k}__industry`, sl.date) : null, sv: sl ? at(structB, `${k}__services`, sl.date) : null,
      debt: at(finB, `${k}__debt`, finY), gfd: at(finB, `${k}__gfd`, finY),
    };
  });
  const f = { name: (r) => r.name, year: (r) => r.year ?? "", gsdp: (r) => (r.gsdp == null ? "—" : "₹" + r.gsdp.toFixed(2)), pc: (r) => (r.pc == null ? "—" : inrR(r.pc)),
    g: (r) => (r.g == null ? "—" : fmt.pct1Minus(r.g) + `<small>${r.gYear}</small>`), cagr: (r) => (r.cagr == null ? "—" : fmt.pct1(r.cagr)),
    ag: (r) => (r.ag == null ? "—" : fmt.pct1(r.ag)), ind: (r) => (r.ind == null ? "—" : fmt.pct1(r.ind)), sv: (r) => (r.sv == null ? "—" : fmt.pct1(r.sv)),
    debt: (r) => (r.debt == null ? "—" : fmt.pct1(r.debt)), gfd: (r) => (r.gfd == null ? "—" : fmt.pct1Minus(r.gfd)) };
  const cols = ["name", "year", "gsdp", "pc", "g", "cagr", "ag", "ind", "sv", "debt", "gfd"];
  const sortVal = (r, c) => (c === "name" ? r.name : c === "year" ? r.yearSort : r[c]);
  const attr = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  // each row carries its sort keys; the sort itself is a few lines in states.client.js
  return [...data].sort((a, b) => (b.pc ?? -1) - (a.pc ?? -1)).map((r) =>
    `<tr${cols.map((c) => { const v = sortVal(r, c); return v == null ? "" : ` data-${c}="${attr(typeof v === "number" ? +v.toFixed(6) : v)}"`; }).join("")}>${cols.map((c) => `<td>${f[c](r)}</td>`).join("")}</tr>`).join("");
})();

/* ---------- provenance ---------- */
V["prov-vintage"] = pcB.meta.vintage;
V["prov-vintage2"] = pcB.meta.vintage;
