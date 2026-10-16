// State profiles: the plates of /states/<state>/, drawn at build time with the chart kit
// (src/kit/). Each export takes the profile's chart data (src/dossiers/profiles.js charts(),
// P.charts on the page) and returns a bare figure for the plate's .plotzone; the plate's title,
// source line and buttons stay in src/pages/states/[state].astro. Nothing here runs in a browser.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { FMT } from "./profiles.fmt.js";

const fy = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const inr = (v) => "₹" + K.inGroup(Math.round(v));
const plain = (t) => String(t).replace(/⁠/g, "");   // the profiles' minus carries a word joiner; SVG text measures without it
// a line's end label on a phone keeps one word of a name; give it a whole name that fits instead
const SHORTER = { "Uttar Pradesh": "UP", "Madhya Pradesh": "MP", "Himachal Pradesh": "Himachal", "Arunachal Pradesh": "Arunachal", "Andhra Pradesh": "Andhra",
  "Andaman and Nicobar": "A&N", "Andaman and Nicobar Islands": "A&N", "Jammu and Kashmir": "J&K", "Dadra and Nagar Haveli and Daman and Diu": "DNH-DD" };
const onPhone = (name, width) => (width >= 520 ? name : (K.tw(name, 12) <= 84 ? name : SHORTER[name] ?? name.split(" ")[0]).replace(/ /g, "\u00a0"));

/** § 01: where the unit stands, measure by measure, among every unit with a figure for the period. */
export function where(C, slug, N) {
  if (!C.where?.length) return "";
  return figure({
    bare: true, file: `${slug}-where`,
    label: `${N} among the states and union territories: ${C.where.map((r) => `${r.label} ${plain(FMT[r.fmt](r.me))}, ${r.period}`).join("; ")}`,
    data: { cols: ["Measure", "Period", "State or UT", "Value", "This unit"], rows: C.where.flatMap((r) => r.rows.map((x) => [r.label, r.period, x.s, x.v, x.me ? "yes" : ""])) },
    draw: (width) => K.standings({
      width, refName: "India",
      rows: C.where.map((r) => ({ name: r.label, sub: r.period, fmt: (v) => plain(FMT[r.fmt](v)), me: r.me, meName: C.where && r.rows.find((x) => x.me)?.s, ref: r.india,
        values: r.rows.map((x) => ({ name: x.s, v: x.v })) })),
    }),
  });
}

/** Income per person each year, against the middle state of the fixed panel; a former state on its own line, across a seam. */
export function income(C, slug, N) {
  if (!C.income) return "";
  const mine = C.income.mine.data, med = C.income.median.data, former = C.income.former;
  const series = [
    { name: "Middle state of the panel", short: "Middle state", data: med, role: "ctx" },
    ...former.map((f) => ({ name: f.label.replace(/^the former state of /, "Former state, "), short: "Former state", data: f.data, role: "comp" })),
    { name: C.income.mine.label, short: C.short, data: mine, role: "lead" },
  ];
  const seamAt = former.length ? mine[0][0] : null;
  return figure({
    bare: true, file: `${slug}-income-per-person`,
    label: `Income per person in ${N} each year, ₹ at current prices, against the middle state of the panel: ${inr(mine.at(-1)[1])} in ${fy(mine.at(-1)[0])}`,
    draw: (width) => K.line({
      width, freq: "fy", unit: { prefix: "₹" }, endFormat: inr, hoverDp: 0, series: series.map((x) => ({ ...x, short: onPhone(x.short, width) })),
      ...(seamAt ? { seam: { t: seamAt, before: "Former state", after: "Union territory" } } : {}),
    }),
  });
}

/** Real growth of GSDP each year, the newest an early estimate; India's GDP growth as a tick on each column. */
export function growth(C, slug, N) {
  if (!C.growth) return "";
  const mine = C.growth.mine.data, dates = new Set(mine.map(([d]) => d));
  const ind = C.growth.india.data.filter(([d]) => dates.has(d));
  return figure({
    bare: true, file: `${slug}-growth`,
    label: `Real growth of ${N}'s GSDP each year against India's GDP: ${mine.map(([d, v]) => `${fy(d)} ${plain(FMT.pct1(v))}`).join(", ")}`,
    data: { cols: ["Year", `${N}, real GSDP growth, %`, "India, real GDP growth, % (computed)"], rows: mine.map(([d, v]) => [fy(d), v, ind.find((x) => x[0] === d)?.[1] ?? null]) },
    draw: (width) => K.columns({
      width, freq: "fy", unit: { suffix: "%" }, valueDp: 1,
      data: mine, marks: ind, markLabel: "India's GDP", markName: "India's GDP",
    }),
  });
}

/** A unit's shares against India's, row by row: the filled dot is the unit, the hollow one India. */
function pairBars(rows, { slug, file, label, catOf, N }) {
  return figure({
    bare: true, file,
    label,
    data: { cols: ["Measure", "This unit, %", "All India, %"], rows: rows.map((r) => [catOf(r), r.me, r.india]) },
    draw: (width) => K.dumbbell({
      width, sortBy: "none", labelAll: true, dp: 1, unit: { suffix: "%" }, keys: { a: "All India", b: N },
      rows: rows.map((r) => ({ name: catOf(r), a: r.india, b: r.me })),
    }),
  });
}
export function structure(C, slug, N) {
  if (!C.structure) return "";
  return pairBars(C.structure.rows, { slug, N, file: `${slug}-structure`, catOf: (r) => r.label,
    label: `Shares of ${N}'s gross value added against India's, ${C.structure.period}: ${C.structure.rows.map((r) => `${r.label} ${plain(FMT.pct1(r.me))}, India ${plain(FMT.pct1(r.india))}`).join("; ")}` });
}
export function work(C, slug, N) {
  if (!C.work) return "";
  const cat = (r) => `${r.label}, ${r.who.toLowerCase()}`;
  return pairBars(C.work.rows, { slug, N, file: `${slug}-work`, catOf: cat,
    label: `Women and men at work in ${N} against India, ${C.work.period}: ${C.work.rows.map((r) => `${cat(r)} ${plain(FMT.pct1(r.me))}${r.india != null ? ", India " + plain(FMT.pct1(r.india)) : ""}`).join("; ")}` });
}

/** CPI inflation on two rulers, never joined: base 2012 to December 2025, base 2024 after; All India in grey. */
export function prices(C, slug, N) {
  if (!C.prices) return "";
  const s12 = C.prices.rulers.find((r) => /2012/.test(r.label)), s24 = C.prices.rulers.find((r) => /2024/.test(r.label));
  const [i12, i24] = C.prices.india;
  // the seam is where the 2024 ruler takes over for the unit (or for India, where the unit has only one ruler)
  const seamT = (s24 ?? i24).data[0][0];
  const series = [
    { name: i12.label, short: "All India", data: i12.data, role: "ctx", label: false },
    { name: i24.label, short: "All India", data: i24.data, role: "ctx" },
    ...(s12 ? [{ name: s12.label, short: C.short, data: s12.data, role: "lead", label: !s24 }] : []),
    ...(s24 ? [{ name: s24.label, short: C.short, data: s24.data, role: "lead" }] : []),
  ];
  const lastS = (s24 ?? s12).data.at(-1);
  return figure({
    bare: true, file: `${slug}-prices`,
    label: `Consumer price inflation in ${N} on two rulers, base 2012 then base 2024, never joined, against All India: ${lastS[1].toFixed(1)}% in ${K.tlabel(lastS[0])}`,
    draw: (width) => K.line({
      width, freq: "month", unit: { suffix: "%" }, endDp: 1, series: series.map((x) => ({ ...x, short: onPhone(x.short, width) })),
      seam: { t: seamT, before: "Base 2012", after: "Base 2024" },
    }),
  });
}

/** The year's average temperature since 1950, against the unit's own 1951-1980 average. */
export function climate(C, slug, N) {
  if (!C.climate) return "";
  const data = C.climate.data, last = data.at(-1);
  return figure({
    bare: true, file: `${slug}-temperature`,
    label: `${N}'s average air temperature each year since ${data[0][0].slice(0, 4)}: ${plain(FMT.degC(last[1]))} in ${last[0].slice(0, 4)}`,
    draw: (width) => K.line({
      width, freq: "year", unit: { suffix: "°C" }, endDp: 1, zero: false,
      // the unit's own 1951-1980 average as a flat dotted line, labelled at its end like the series
      series: [
        ...(C.climate.normal != null ? [{ name: `${C.climate.span} average`, short: "Average", data: [[data[0][0], C.climate.normal], [last[0], C.climate.normal]], role: "ctx", dash: "1 3", hover: false }] : []),
        { name: C.climate.label, short: onPhone(C.short, width), data, role: "lead" },
      ],
    }),
  });
}
