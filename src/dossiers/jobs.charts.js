// Jobs guide (PLFS): the plates, drawn at build time with the chart kit (src/kit/), and the figures,
// register and baskets the page quotes beside them. The instruments (monthly, quarterly, annual; the
// original and the revamped survey design) are shown side by side and never spliced: each is a series
// of its own, and a gap in a series is a null, never a joined line. Rates are rounded once, at the
// published precision (src/dossiers/precision.js), as the retired client did. Build time only.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { roundRates, numWord } from "./precision.js";
import { jobsData } from "./jobs.data.js";
import monthlyRaw from "../../data/series/plfs-monthly.json";
import quarterlyRaw from "../../data/series/plfs-quarterly.json";
import annualRaw from "../../data/series/plfs-annual.json";
import cutsRaw from "../../data/series/plfs-cuts.json";
import statesRaw from "../../data/series/plfs-states.json";
import statusRaw from "../../data/series/plfs-status.json";
import earningsRaw from "../../data/series/plfs-earnings.json";
import educationRaw from "../../data/series/plfs-education.json";

const MB = roundRates(monthlyRaw), QB = roundRates(quarterlyRaw), AB = roundRates(annualRaw), CB = roundRates(cutsRaw), STB = roundRates(statesRaw);
const SB = roundRates(statusRaw), EB = roundRates(earningsRaw), DB = roundRates(educationRaw);
const JD = jobsData();
const H = "__person_all__a15plus";

/** A series as {iso, value} points (nulls kept); `.nn` the non-null ones. */
const ser = (b, k) => { const data = b.dates.map((d, i) => ({ iso: d, value: b.series[k].data[i] ?? null })); return { data, nn: data.filter((p) => p.value != null) }; };
const S = (b) => new Proxy({}, { get: (_, k) => ser(b, k) });
const M = S(MB), Q = S(QB), A = S(AB), CUTS = S(CB), STA = S(SB), EARN = S(EB), EDU = S(DB), ST = S(STB);
const last = (s) => s.nn.at(-1).value, prev = (s) => s.nn.at(-2).value, first = (s) => s.nn[0].value;
const P2 = (s) => s.data.map((p) => [p.iso, p.value]);

const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDate = (iso) => MN[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const QN = { 0: "Jan–Mar", 3: "Apr–Jun", 6: "Jul–Sep", 9: "Oct–Dec" };
const fmtQ = (iso) => QN[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const fmtAgri = (iso) => { const y = +iso.slice(0, 4); return y + "–" + String((y + 1) % 100).padStart(2, "0"); };
const pc = '<span class="pc">%</span>';
const arrow = (d) => (Math.abs(d) < 0.05 ? "unchanged" : (d > 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt");
const arrowInr = (d) => (d >= 0 ? "▲ +₹" : "▼ −₹") + Math.abs(Math.round(d)).toLocaleString("en-IN");
const f1 = (v) => v.toFixed(1) + "%";
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
const pct = (v) => v.toFixed(1);
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PCT = { suffix: "%" };
const tbl = (cols, rows) => ({ cols, rows });
// context greys for the series beside the lead, darkest first
const GREYS = [K.C.muted, K.C.ctx, K.C.ctx2];
/** agriculture years (July to June) as x ticks, every other one on a phone */
const agriTicks = (dates, width) => dates.map((d, i) => ({ t: d, label: fmtAgri(d), keep: width >= 720 || i % 2 === 0 })).filter((k) => k.keep);
const monthTicks = (width) => (width < 520 ? ["2025-04-01", "2026-01-01"] : ["2025-04-01", "2025-10-01", "2026-01-01", "2026-04-01"]).map((t) => ({ t, label: fmtDate(t).replace(" 20", " ’") }));

/** One measure for several groups over time: the first series the lead, the rest context greys. */
function lines({ file, label, series, unit = PCT, freq = "month", endFormat, xTicks, height, hoverDp = 1, data, notes, seam, events }) {
  return figure({
    bare: true, file, label, data,
    draw: (width) => K.line({
      width, freq, unit, hoverDp, endFormat: endFormat ?? ((v) => K.num(v, { dp: 1, prefix: unit.prefix ?? "", suffix: unit.suffix ?? "" })),
      ...(xTicks ? { xTicks: xTicks(width) } : {}), ...(height ? { height: width < 520 ? 300 : height } : {}), notes, seam, events,
      // a phone keeps an end label's first word only; a short name that fits is bound with no-break spaces so "Urban women" stays whole
      series: series.map((s, i) => ({ name: s.name, short: (() => { const t = s.short ?? s.name; return K.tw(t, 12) <= 80 ? t.replace(/ /g, "\u00a0") : t; })(), data: s.data, ...(i === 0 ? { role: "lead" } : { role: "ctx", color: GREYS[Math.min(i - 1, 2)] }) })).reverse(),
    }),
  });
}

export const sparkUr = () => K.spark(P2(M.ur).filter((p) => p[1] != null), { width: 190, height: 44 });

/* ---------- §03 three stopwatches ---------- */
export function annual() {
  return lines({ file: "india-atlas_plfs_annual-stopwatches", freq: "year",
    label: `All-India unemployment rate on the usual status (PS+SS) and the weekly status (CWS), agriculture years ${fmtAgri(AB.dates[0])} to ${fmtAgri(AB.dates.at(-1))}: usual status ${f1(first(A.ur_psss))} to ${f1(last(A.ur_psss))}, weekly status ${f1(first(A.ur_cws))} to ${f1(last(A.ur_cws))}; the gap between them is underemployment, and the two are never spliced`,
    xTicks: (w) => agriTicks(AB.dates, w),
    series: [{ name: "Usual status, PS+SS", short: "PS+SS", data: P2(A.ur_psss) }, { name: "Weekly status, CWS", short: "CWS", data: P2(A.ur_cws) }] });
}
export function lfprAnn() {
  return lines({ file: "india-atlas_plfs_annual-lfpr", freq: "year",
    label: `Labour force participation rate, usual status beside weekly status, agriculture years: usual status from ${f1(first(A.lfpr_psss))} to ${f1(last(A.lfpr_psss))}, weekly status from ${f1(first(A.lfpr_cws))} to ${f1(last(A.lfpr_cws))}`,
    xTicks: (w) => agriTicks(AB.dates, w),
    series: [{ name: "LFPR, usual status", short: "Usual", data: P2(A.lfpr_psss) }, { name: "LFPR, weekly status", short: "Weekly", data: P2(A.lfpr_cws) }] });
}

/* ---------- §03 the seam: two survey designs, side by side ---------- */
export function seam() {
  const ay = JD.seam.ay, cy = JD.seam.cy, c5 = JD.seam.cy25;
  // each year is drawn at its middle: an agriculture year (July to June) at January, a calendar year at July
  const mid = (b, k, months) => b.dates.map((d, i) => { const y = +d.slice(0, 4), m = +d.slice(5, 7) - 1 + months; return [`${y + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`, b.series[k].data[i] ?? null]; });
  const panel = (ind, name, domain) => ({ name, unit: PCT, domain, lines: [{ data: mid(ay, ind + "_psss", 6), role: "ctx" }, { data: mid(cy, ind + "_psss" + H, 6), role: "ink" }, { data: mid(c5, ind + "_psss" + H, 6), role: "lead" }],
    vText: `${c5.dates.at(-1).slice(0, 4)}: ${f1(c5.series[ind + "_psss" + H].data.at(-1))}` });
  const csv = [];
  for (const [ind, k] of [["lfpr_psss", "lfpr"], ["ur_psss", "ur"]]) for (const [b, key, nm, f] of [[ay, k + "_psss", "Agriculture years, original design", fmtAgri], [cy, k + "_psss" + H, "Calendar years, original design", (d) => d.slice(0, 4)], [c5, k + "_psss" + H, "Calendar year, revamped design", (d) => d.slice(0, 4)]])
    b.dates.forEach((d, i) => { const v = b.series[key].data[i]; if (v != null) csv.push([ind, nm, f(d), v]); });
  return figure({
    bare: true, file: "india-atlas_plfs_two-designs",
    label: `Participation and unemployment, usual status, on three rulers drawn side by side and never joined: agriculture years and calendar years of the original design, and the revamped design's first calendar year, ${f1(c5.series["lfpr_psss" + H].data.at(-1))} participation and ${f1(c5.series["ur_psss" + H].data.at(-1))} unemployment`,
    data: tbl(["indicator", "ruler", "period", "value"], csv),
    draw: (width) => K.multiples({ width, cols: width < 520 ? 1 : 2, shared: false, ph: width < 520 ? 150 : 220, seamAt: "2025-01-01", tFmt: (d) => d.slice(0, 4),
      key: [{ name: "Agriculture years, original", role: "ctx" }, { name: "Calendar years, original", role: "ink" }, { name: "Calendar year, revamped", role: "lead" }],
      panels: [panel("lfpr", "Participation, usual status", { lo: 45, hi: 65, ticks: [45, 50, 55, 60, 65] }), panel("ur", "Unemployment, usual status", { lo: 0, hi: 8, ticks: [0, 2, 4, 6, 8] })] }),
  });
}

/* ---------- §04 the long arc: urban quarterly, two designs ---------- */
export function main() {
  const old = Q.ur, neu = ser({ dates: JD.q25.dates, series: JD.q25.series }, "ur_cws__person_urban__a15plus");
  const pk = old.nn.reduce((a, p) => (p.value > a.value ? p : a));
  const lo = old.nn.at(-1), ln = neu.nn.at(-1);
  return figure({
    bare: true, file: "india-atlas_plfs_urban-quarterly",
    label: `Urban unemployment rate, quarterly, current weekly status, two survey designs drawn side by side: the original design from ${f1(first(old))} in Apr–Jun 2018, up to ${f1(pk.value)} in the ${fmtQ(pk.iso)} lockdown quarter, ending at ${f1(lo.value)} in ${fmtQ(lo.iso)}; after the redesign the revamped figure reads ${f1(ln.value)} in ${fmtQ(ln.iso)}. Apr–Jun 2019 is quarantined`,
    data: tbl(["quarter", "urban_ur_original_design", "urban_ur_revamped_design"], [...old.data.map((p) => [fmtQ(p.iso), p.value, null]), ...neu.data.map((p) => [fmtQ(p.iso), null, p.value])]),
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1, height: width < 520 ? 300 : 460,
      series: [{ name: "Urban UR, original design", short: "Original", data: P2(old), role: "ctx", color: K.C.muted }, { name: "Urban UR, revamped design", short: "Revamped", data: P2(neu), role: "lead", dots: true }],
      seam: { t: "2025-01-01", before: "Original design", after: "Revamped" },
      notes: [{ d: pk.iso, v: pk.value, text: `Lockdown, ${f1(pk.value)}\none urban worker in five` }],
    }),
  });
}

/* ---------- §04 the whole country, quarter by quarter ---------- */
const Q25 = S({ dates: JD.q25.dates, series: JD.q25.series });
export function q25() {
  const k = (s) => `ur_cws__person_${s}__a15plus`;
  return lines({ file: "india-atlas_plfs_quarterly-rural-urban", freq: "quarter",
    label: `Unemployment rate, quarterly, revamped design: urban ${f1(last(Q25[k("urban")]))}, all India ${f1(last(Q25[k("all")]))}, rural ${f1(last(Q25[k("rural")]))} in the latest quarter`,
    xTicks: (w) => JD.q25.dates.filter((_, i) => w >= 520 || i % 2 === 0).map((t) => ({ t, label: fmtQ(t) })),
    series: [{ name: "All India", data: P2(Q25[k("all")]) }, { name: "Urban", data: P2(Q25[k("urban")]) }, { name: "Rural", data: P2(Q25[k("rural")]) }] });
}

/* ---------- strips: one row per state or group, a dark dot beside a pale one ---------- */
const desc = (rows, k) => [...rows].sort((x, y) => y[k] - x[k] || x.name.localeCompare(y.name));
function strip({ file, label, rows, ref, hi = () => true, fmtV, keys, csvCols, from }) {
  return figure({
    bare: true, file, label, data: tbl(csvCols, rows.map((r) => [r.name, r.a ?? null, r.b ?? null])),
    draw: (width) => K.dumbbell({ width, sortBy: "none", fmt: fmtV, endText: (r) => fmtV(r.b), endCol: true, keys, aColor: K.C.ctx, ...(from != null ? { from } : {}), ...(ref ? { ref } : {}),
      rows: rows.map((r) => ({ name: r.name, b: r.a, a: r.b, bColor: hi(r) ? K.C.lead : K.C.ink2 })) }),
  });
}
export function ystates() {
  const rows = desc(JD.youthStates.map((r) => ({ name: r.name, a: r.y, b: r.all })), "a");
  return strip({ file: "india-atlas_plfs_youth-ur-states", fmtV: (v) => pct(v) + "%", keys: { a: "Ages 15+", b: "Ages 15 to 29" }, csvCols: ["state", "ur_cws_15_29", "ur_cws_15_plus"], rows,
    ref: { value: JD.youthAi.y, label: `All India, ages 15 to 29, ${pct(JD.youthAi.y)}%` },
    label: `Unemployment rate of 15-to-29-year-olds by state, latest quarter, beside the rate for everyone 15 and above: ${rows[0].name} highest at ${pct(rows[0].a)}%, ${rows.at(-1).name} lowest at ${pct(rows.at(-1).a)}%, around an all-India youth rate of ${pct(JD.youthAi.y)}%` });
}
export function kinds() {
  const rows = desc(JD.kinds.map((r) => ({ name: r.name, a: r.rg, b: r.cs })), "a");
  return strip({ file: "india-atlas_plfs_salaried-share-states", fmtV: (v) => pct(v) + "%", keys: { a: "Casual labour", b: "Regular wage or salary" }, csvCols: ["state", "regular_wage_share_pct", "casual_share_pct"], rows,
    label: `Share of workers in regular wage or salaried jobs, and in casual labour, by state: ${rows[0].name} has the largest salaried share, ${pct(rows[0].a)}%; ${rows.at(-1).name} the smallest, ${pct(rows.at(-1).a)}%` });
}
export function paystates() {
  const ai = JD.payAi, rows = desc(JD.pay.map((r) => ({ name: r.name, a: r.p, b: r.f })), "a");
  return strip({ file: "india-atlas_plfs_regular-wage-states", fmtV: inr, keys: { a: "Women", b: "All workers" }, csvCols: ["state", "regular_wage_inr_month_all", "regular_wage_inr_month_women"], rows,
    ref: { value: ai.regular__person_all, label: `All India ${inr(ai.regular__person_all)}` }, hi: (r) => r.a > ai.regular__person_all,
    label: `Average monthly earnings from regular wage or salaried work by state, all workers beside women, nominal rupees: ${rows[0].name} pays most, ${inr(rows[0].a)}; ${rows.at(-1).name} least, ${inr(rows.at(-1).a)}; all India ${inr(ai.regular__person_all)}` });
}
export function social() {
  const v = (g, k) => JD.social.series[`lfpr_psss__${g}_all__a15plus__${k}`]?.data.at(-1);
  const G = [["soc_scheduled_tribe", "Scheduled Tribe"], ["soc_scheduled_caste", "Scheduled Caste"], ["soc_other_backward_class", "Other Backward Class"], ["soc_others", "Others (outside the three)"],
    ["rel_christianity", "Christian"], ["rel_hinduism", "Hindu"], ["rel_sikhism", "Sikh"], ["rel_islam", "Muslim"]];
  const rows = G.map(([k, name]) => ({ name, a: v("female", k), b: v("male", k) })).filter((r) => r.a != null);
  return strip({ file: "india-atlas_plfs_lfpr-social-religion", fmtV: (x) => pct(x) + "%", keys: { a: "Men", b: "Women" }, csvCols: ["group", "lfpr_women_pct", "lfpr_men_pct"], rows,
    ref: { value: JD.socialAi.f, label: `All women ${pct(JD.socialAi.f)}%` },
    label: "Labour force participation by social group and religion, women beside men: " + rows.map((r) => `${r.name}: women ${pct(r.a)}, men ${pct(r.b)}`).join("; ") });
}
export function work() {
  const rows = desc(JD.work.map((r) => ({ name: r.name, a: r.f, b: r.m })), "a");
  return strip({ file: "india-atlas_plfs_wpr-states-gender", fmtV: (x) => pct(x) + "%", keys: { a: "Men", b: "Women" }, csvCols: ["state", "wpr_women_pct", "wpr_men_pct"], rows,
    ref: { value: JD.workAi.f, label: `All-India women ${pct(JD.workAi.f)}%` },
    label: `Share of people aged 15 and above who are working, women beside men, by state: women's worker ratio from ${pct(rows[0].a)}% in ${rows[0].name} to ${pct(rows.at(-1).a)}% in ${rows.at(-1).name}; men's between ${pct(Math.min(...rows.map((r) => r.b)))}% and ${pct(Math.max(...rows.map((r) => r.b)))}%` });
}

/* ---------- §06 cuts: four labour markets (monthly) ---------- */
const FOUR = [["female_urban", "Urban women"], ["male_urban", "Urban men"], ["female_rural", "Rural women"], ["male_rural", "Rural men"]];
const cutPlate = (ind, file, what, order = FOUR) => lines({ file, xTicks: monthTicks,
  label: `${what} by gender and sector, monthly, current weekly status: ` + order.map(([k, n]) => `${n.toLowerCase()} ${f1(last(CUTS[`${ind}_${k}`]))}`).join(", ") + " in the latest month",
  series: order.map(([k, n]) => ({ name: n, data: P2(CUTS[`${ind}_${k}`]) })) });
export const cuts = () => cutPlate("ur", "india-atlas_plfs_ur-by-gender-sector", "Unemployment rate");
export const lfpr = () => cutPlate("lfpr", "india-atlas_plfs_lfpr-by-gender-sector", "Labour force participation rate");
export const wpr = () => cutPlate("wpr", "india-atlas_plfs_wpr-by-gender-sector", "Worker population ratio, the share actually working,", [FOUR[0], FOUR[1], FOUR[2], FOUR[3]]);
export function youth() {
  const Y = S(JD.youth), k = (g) => `ur_cws__${g}__a15_29`;
  return lines({ file: "india-atlas_plfs_youth-ur-gender-sector", xTicks: monthTicks,
    label: "Unemployment rate of 15-to-29-year-olds by gender and sector, monthly: " + FOUR.map(([g, n]) => `young ${n.toLowerCase()} ${f1(last(Y[k(g)]))}`).join(", "),
    series: FOUR.map(([g, n]) => ({ name: n, data: P2(Y[k(g)]) })) });
}

/* ---------- §07 what work is ---------- */
export function status() {
  return lines({ file: "india-atlas_plfs_worker-status-shares", freq: "year", xTicks: (w) => agriTicks(SB.dates, w),
    label: `Share of workers by broad status in employment, usual status: self-employment from ${f1(first(STA.self_employed_person))} to ${f1(last(STA.self_employed_person))}, regular wage work from ${f1(first(STA.regular_person))} to ${f1(last(STA.regular_person))}, casual labour from ${f1(first(STA.casual_person))} to ${f1(last(STA.casual_person))}`,
    series: [{ name: "Self-employed", data: P2(STA.self_employed_person) }, { name: "Regular wage/salary", short: "Regular wage", data: P2(STA.regular_person) }, { name: "Casual labour", data: P2(STA.casual_person) }] });
}
export function gender() {
  const L = [["self_employed", "Self-employed", "lead"], ["regular", "Regular wage", "ink"], ["casual", "Casual labour", "ctx"]];
  const panel = (g, name) => ({ name, lines: L.map(([k, , role]) => ({ data: P2(STA[`${k}_${g}`]), role })).reverse(), vText: `self-employed ${f1(last(STA[`self_employed_${g}`]))}` });
  return figure({
    bare: true, file: "india-atlas_plfs_status-by-gender",
    label: `Share of male and female workers by status in employment, usual status, on one scale: female self-employment from ${f1(first(STA.self_employed_female))} to ${f1(last(STA.self_employed_female))}, male near ${f1(last(STA.self_employed_male))}; regular wage women ${f1(last(STA.regular_female))}, men ${f1(last(STA.regular_male))}; casual women ${f1(last(STA.casual_female))}, men ${f1(last(STA.casual_male))}`,
    data: tbl(["gender", "status", "year", "share_pct"], ["male", "female"].flatMap((g) => L.flatMap(([k, n]) => SB.dates.map((d, i) => [g, n, fmtAgri(d), SB.series[`${k}_${g}`].data[i]])))),
    draw: (width) => K.multiples({ width, cols: width < 520 ? 1 : 2, ph: width < 520 ? 150 : 220, unit: PCT, tFmt: fmtAgri,
      key: L.map(([, n, role]) => ({ name: n, role })), panels: [panel("male", "Men"), panel("female", "Women")] }),
  });
}

/* ---------- §08 what work pays ---------- */
export function pay() {
  return lines({ file: "india-atlas_plfs_earnings-by-status", freq: "quarter", unit: { prefix: "₹" }, endFormat: inr, hoverDp: 0,
    label: `Average monthly earnings by worker status and gender, nominal rupees: regular-wage men ${inr(last(EARN.regular_male))} a month, regular-wage women ${inr(last(EARN.regular_female))}, self-employed men ${inr(last(EARN.self_employed_male))} per 30 days, self-employed women ${inr(last(EARN.self_employed_female))}`,
    series: [{ name: "Self-employed women", short: "Self-emp · women", data: P2(EARN.self_employed_female) }, { name: "Regular wage men", short: "Regular · men", data: P2(EARN.regular_male) },
      { name: "Regular wage women", short: "Regular · women", data: P2(EARN.regular_female) }, { name: "Self-employed men", short: "Self-emp · men", data: P2(EARN.self_employed_male) }] });
}
export function casual() {
  return lines({ file: "india-atlas_plfs_casual-daily-wage", freq: "quarter", unit: { prefix: "₹" }, endFormat: inr, hoverDp: 0,
    label: `Average daily wage from casual labour other than public works, nominal rupees: all workers from ${inr(first(EARN.casual_person))} to ${inr(last(EARN.casual_person))}; men ${inr(last(EARN.casual_male))}, women ${inr(last(EARN.casual_female))}`,
    series: [{ name: "Person", data: P2(EARN.casual_person) }, { name: "Men", data: P2(EARN.casual_male) }, { name: "Women", data: P2(EARN.casual_female) }] });
}
export function cond() {
  const C = S(JD.cond), ks = [["none_of_three", "None of the three"], ["no_contract", "No written contract"], ["no_social_security", "No social security"], ["no_paid_leave", "No paid leave"]];
  return lines({ file: "india-atlas_plfs_job-conditions", freq: "year", xTicks: (w) => agriTicks(JD.cond.dates, w),
    label: "Regular wage or salaried employees without a written contract, paid leave or social security, agriculture years: " + ks.map(([k, n]) => `${n.toLowerCase()} from ${f1(first(C[k + "__person_all"]))} to ${f1(last(C[k + "__person_all"]))}`).join("; "),
    series: ks.map(([k, n]) => ({ name: n, data: P2(C[k + "__person_all"]) })) });
}

/* ---------- §09 the educated queue ---------- */
const LEVELS = [["not_literate", "Not literate"], ["up_to_primary", "Up to primary"], ["middle", "Middle"], ["secondary", "Secondary"], ["higher_secondary", "Higher secondary"], ["diploma", "Diploma/certificate"], ["graduate", "Graduate"], ["postgraduate", "Postgraduate & above"]];
export function edu() {
  const ai = last(A.ur_psss), thr = ai * 2;
  const rows = LEVELS.map(([k, name]) => ({ name, cur: last(EDU[k]), start: first(EDU[k]) }));
  return figure({
    bare: true, file: "india-atlas_plfs_ur-by-education",
    label: `Unemployment rate by general education level, usual status, ${fmtAgri(DB.dates.at(-1))} with ${fmtAgri(DB.dates[0])} as pale dots, around the all-India rate of ${f1(ai)}: not literate ${f1(rows[0].cur)}, secondary ${f1(rows[3].cur)}, graduate ${f1(rows[6].cur)}, postgraduate ${f1(rows[7].cur)}; every level fell`,
    data: tbl(["education_level", ...DB.dates.map((d) => "ur_psss_" + fmtAgri(d))], LEVELS.map(([k, n]) => [n, ...DB.series[k].data])),
    draw: (width) => K.dumbbell({ width, sortBy: "none", fmt: (v) => pct(v), endText: (r) => pct(r.b) + "%", endCol: true, keys: { a: fmtAgri(DB.dates[0]), b: fmtAgri(DB.dates.at(-1)) }, aColor: K.C.ctx,
      ref: { value: ai, label: `All-India, PS+SS ${ai.toFixed(1)}%` }, rows: rows.map((r) => ({ name: r.name, a: r.start, b: r.cur, bColor: r.cur >= thr ? K.C.lead : K.C.ink2 })) }),
  });
}

/* ---------- §10 states ---------- */
const STATE_NAMES = { andaman_nicobar_islands: "Andaman & Nicobar", andhra_pradesh: "Andhra Pradesh", arunachal_pradesh: "Arunachal Pradesh", assam: "Assam", bihar: "Bihar",
  chandigarh: "Chandigarh", chhattisgarh: "Chhattisgarh", dadra_nagar_haveli_daman_diu: "DNH & Daman & Diu", delhi: "Delhi", goa: "Goa", gujarat: "Gujarat", haryana: "Haryana",
  himachal_pradesh: "Himachal Pradesh", jammu_kashmir: "Jammu & Kashmir", jharkhand: "Jharkhand", karnataka: "Karnataka", kerala: "Kerala", ladakh: "Ladakh", lakshadweep: "Lakshadweep",
  madhya_pradesh: "Madhya Pradesh", maharashtra: "Maharashtra", manipur: "Manipur", meghalaya: "Meghalaya", mizoram: "Mizoram", nagaland: "Nagaland", odisha: "Odisha",
  puducherry: "Puducherry", punjab: "Punjab", rajasthan: "Rajasthan", sikkim: "Sikkim", tamil_nadu: "Tamil Nadu", telangana: "Telangana", tripura: "Tripura",
  uttar_pradesh: "Uttar Pradesh", uttarakhand: "Uttarakhand", west_bengal: "West Bengal" };
// value AT the latest year (not last non-null): the defunct UTs drop out
const SROWS = Object.keys(statesRaw.series).filter((k) => k.endsWith("_psss")).map((k) => k.slice(0, -5)).map((b) => ({
  key: b, name: STATE_NAMES[b] || b, psss: STB.series[b + "_psss"].data.at(-1), cws: STB.series[b + "_cws"].data.at(-1), psssPrev: STB.series[b + "_psss"].data.at(-2),
})).filter((r) => r.psss != null && r.cws != null).sort((a, b) => b.psss - a.psss || b.cws - a.cws || a.name.localeCompare(b.name));
export function states() {
  const aiP = last(A.ur_psss), aiC = last(A.ur_cws), thr = aiP * 2, top = SROWS[0], bot = SROWS.at(-1);
  return figure({
    bare: true, file: "india-atlas_plfs_states-ur",
    label: `Unemployment rate by State and Union Territory, ${fmtAgri(STB.dates.at(-1))}, usual status beside weekly status: ${top.name} highest at ${f1(top.psss)} on the usual status, ${bot.name} lowest at ${f1(bot.psss)}, around the all-India rate of ${f1(aiP)}; states at twice that rate or more in blue`,
    data: tbl(["state", ...STB.dates.map((d) => "ur_psss_" + fmtAgri(d)), ...STB.dates.map((d) => "ur_cws_" + fmtAgri(d))], SROWS.map((r) => [r.name, ...STB.series[r.key + "_psss"].data, ...STB.series[r.key + "_cws"].data])),
    draw: (width) => K.dumbbell({ width, sortBy: "none", fmt: pct, endText: (r) => pct(r.b), endCol: true, keys: { a: "Weekly status, CWS", b: "Usual status, PS+SS" }, aColor: K.C.ctx,
      refs: [{ value: aiP, label: `${width < 560 ? "" : "All-India, "}PS+SS ${aiP.toFixed(1)}%`, side: "left" }, { value: aiC, label: `CWS ${aiC.toFixed(1)}%`, side: "right" }],
      rows: SROWS.map((r) => ({ name: r.name, a: r.cws, b: r.psss, bColor: r.psss >= thr ? K.C.lead : K.C.ink2 })) }),
  });
}

/* ---------- the figures, register and baskets the page quotes (ids kept from the retired client) ---------- */
export function numbers() {
  const T = {};
  T["n-ur"] = last(M.ur).toFixed(1) + pc;
  T["n-lfpr"] = last(M.lfpr).toFixed(1) + pc;
  T["n-fur"] = last(CUTS.ur_female_urban).toFixed(1) + pc;
  T["n-psss"] = last(A.ur_psss).toFixed(1) + pc;
  T["d-ur"] = `<b>${arrow(last(M.ur) - prev(M.ur))}</b> vs ${fmtDate(M.ur.data.at(-2).iso)}`;
  T["d-lfpr"] = `<b>${arrow(last(M.lfpr) - prev(M.lfpr))}</b> vs ${fmtDate(M.lfpr.data.at(-2).iso)}`;
  T["d-fur"] = `<b>${arrow(last(CUTS.ur_female_urban) - prev(CUTS.ur_female_urban))}</b> vs ${fmtDate(CUTS.ur_female_urban.data.at(-2).iso)}`;
  T["d-psss"] = `<b>${arrow(last(A.ur_psss) - prev(A.ur_psss))}</b> vs ${fmtAgri(A.ur_psss.data.at(-2).iso)}`;
  T["rb-big"] = last(M.ur).toFixed(1) + pc;
  T["rb-first"] = first(M.ur).toFixed(1) + pc;
  T["pv-annual"] = f1(last(A.ur_psss));
  T["ex-p0"] = f1(first(A.ur_psss)); T["ex-p1"] = f1(last(A.ur_psss));
  T["ex-q0"] = f1(first(Q.ur)); T["ex-q1"] = f1(last(Q.ur));
  T["pv-cuts"] = f1(last(CUTS.ur_female_urban));
  T["ex-fu"] = f1(last(CUTS.ur_female_urban)); T["ex-mu"] = f1(last(CUTS.ur_male_urban));
  T["pv-lfpr"] = f1(last(CUTS.lfpr_female_urban));
  T["ex-fl"] = f1(last(CUTS.lfpr_female_urban));
  T["pv-status"] = f1(last(STA.self_employed_person));
  T["ex-st-se"] = f1(last(STA.self_employed_person));
  T["ex-st-oa"] = f1(last(STA.se_own_account_person));
  T["ex-st-hp"] = f1(last(STA.se_helper_person));
  T["ex-st-rg"] = f1(last(STA.regular_person));
  T["ex-st-cs"] = f1(last(STA.casual_person));
  T["ex-st-dse"] = (last(STA.self_employed_person) - first(STA.self_employed_person)).toFixed(1) + " points";
  T["ex-st-dcs"] = Math.abs(last(STA.casual_person) - first(STA.casual_person)).toFixed(1) + " points";
  T["pv-pay"] = inr(last(EARN.regular_person));
  T["ex-pay-rg"] = inr(last(EARN.regular_male));
  T["ex-pay-rgf"] = inr(last(EARN.regular_female));
  T["ex-pay-se"] = inr(last(EARN.self_employed_male));
  T["ex-pay-sef"] = inr(last(EARN.self_employed_female));
  T["ex-pay-ratio"] = (last(EARN.regular_male) / last(EARN.self_employed_female)).toFixed(1) + "×";
  T["pv-casual"] = inr(last(EARN.casual_person));
  T["ex-cas-p"] = inr(last(EARN.casual_person));
  T["ex-cas-m"] = inr(last(EARN.casual_male));
  T["ex-cas-f"] = inr(last(EARN.casual_female));
  T["ex-cas-0"] = inr(first(EARN.casual_person));
  T["ex-cas-r"] = Math.round((last(EARN.casual_person) / first(EARN.casual_person) - 1) * 100) + "%";
  T["ex-cas-mo"] = inr(26 * last(EARN.casual_person));
  T["pv-edu"] = f1(last(EDU.graduate));
  T["ex-edu-g"] = f1(last(EDU.graduate));
  T["ex-edu-nl"] = f1(last(EDU.not_literate));
  T["ex-edu-x"] = Math.round(last(EDU.graduate) / last(EDU.not_literate)) + "×";
  T["ex-edu-y"] = f1(last(EDU.youth_15_29));
  T["ex-edu-all"] = f1(last(A.ur_psss));
  T["ex-edu-g0"] = f1(first(EDU.graduate));
  T["ex-edu-y0"] = f1(first(EDU.youth_15_29));
  // § 02 the register, each row with its sparkline
  const regRows = [
    [M.ur, "UR, all-India, monthly", "Current weekly status, 15+", "s-acc", fmtDate], [M.lfpr, "LFPR, all-India, monthly", "Labour force participation, 15+", "s-g1", fmtDate],
    [M.wpr, "WPR, all-India, monthly", "Worker population ratio, 15+", "s-g2", fmtDate], [Q.ur, "UR, urban, quarterly", "CWS, urban, 15+, two disclosed gaps", "s-g3", fmtQ],
    [Q.lfpr, "LFPR, urban, quarterly", "CWS, urban, 15+", "s-g4", fmtQ], [A.ur_psss, "UR, annual, usual status", "PS+SS, agriculture years", "s-acc", fmtAgri],
    [A.ur_cws, "UR, annual, weekly status", "CWS, agriculture years", "s-g1", fmtAgri],
    [STA.self_employed_person, "Self-employed share, annual", "PS+SS, share of all workers", "s-g2", fmtAgri],
    [EARN.regular_person, "Regular wage, ₹ per month", "Nominal, annual reports, quarterly grain", "s-acc", fmtQ, inr, arrowInr],
    [EARN.casual_person, "Casual wage, ₹ per day", "Non-public works, annual reports", "s-g3", fmtQ, inr, arrowInr],
    [EDU.graduate, "UR, graduates, annual", "PS+SS, 15+, the educated queue", "s-g4", fmtAgri],
  ];
  const t = (iso) => Date.parse(iso + "T00:00:00Z");
  T["ledger-body"] = regRows.map(([s, nm, sub, sw, fmt, fv = f1, fd = arrow], i) => {
    const data = s.nn, target = t(data.at(-1).iso) - 365.25 * 86400000;
    let yi = 0, best = Infinity;
    data.forEach((d, j) => { const diff = Math.abs(t(d.iso) - target); if (diff < best) { best = diff; yi = j; } });
    return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${fv(data.at(-1).value)}</td>
    <td class="chg">${fd(data.at(-1).value - data.at(-2).value)}, vs ${fmt(data.at(-2).iso)}</td>
    <td class="yr">${fv(data[yi].value)}</td>
    <td class="spark" id="sp-j${i}">${K.spark(data.map((p) => [p.iso, p.value]), { width: 190, height: 44 })}</td>
  </tr>`;
  }).join("");
  // § 03
  T["pv-lfpr-ann"] = f1(last(A.lfpr_psss));
  T["ex-lf0"] = f1(first(A.lfpr_psss)); T["ex-lf1"] = f1(last(A.lfpr_psss));
  T["ex-lfc0"] = f1(first(A.lfpr_cws)); T["ex-lfc1"] = f1(last(A.lfpr_cws));
  T["ex-lf-d"] = "+" + (last(A.lfpr_psss) - first(A.lfpr_psss)).toFixed(1) + " points";
  T["pv-seam"] = f1(JD.seam.cy25.series["lfpr_psss" + H].data.filter((v) => v != null).at(-1));
  // § 04
  const neuU = Q25.ur_cws__person_urban__a15plus;
  T["pv-main"] = f1(last(neuU)); T["ex-q25u"] = f1(last(neuU));
  T["pv-q25"] = f1(last(Q25.ur_cws__person_all__a15plus));
  T["ex-q25a"] = f1(last(Q25.ur_cws__person_all__a15plus));
  T["ex-q25r"] = f1(last(Q25.ur_cws__person_rural__a15plus));
  T["ex-q25ub"] = f1(last(neuU));
  T["ex-q25l"] = f1(last(Q25.lfpr_cws__person_all__a15plus));
  T["pv-ystates"] = f1(JD.youthAi.y);
  // § 06
  T["pv-wpr"] = last(CUTS.wpr_male_urban).toFixed(1) + "%";
  const Y = S(JD.youth), yk = (g) => Y[`ur_cws__${g}__a15_29`];
  T["pv-youth"] = f1(last(yk("female_urban")));
  T["ex-y-fu"] = f1(last(yk("female_urban"))); T["ex-y-mu"] = f1(last(yk("male_urban")));
  T["ex-y-fr"] = f1(last(yk("female_rural"))); T["ex-y-mr"] = f1(last(yk("male_rural")));
  T["ex-y-all"] = f1(last(Y.ur_cws__person_all__a15_29));
  T["ex-y-one"] = numWord(Math.round(100 / last(yk("female_urban"))));
  // § 07 baskets
  const basket = (segs) => [segs.map(([n, w, c]) => `<div class="seg" style="width:${w}%;background:${c}" title="${esc(n)}: ${w.toFixed(1)}%"></div>`).join(""),
    segs.map(([n, w, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${esc(n)}</div><div class="w">${w.toFixed(1)}%</div></div>`).join("")];
  [T["bk-st-bar"], T["bk-st-labels"]] = basket([["Status, Self-employed", last(STA.self_employed_person), "#2E4BD8"], ["Regular wage/salary", last(STA.regular_person), "#5F6675"], ["Casual labour", last(STA.casual_person), "#A3A9B4"]]);
  [T["bk-in-bar"], T["bk-in-labels"]] = basket([["Industry, Agriculture & allied", last(STA.industry_primary_person), "#2E4BD8"], ["Industry & construction", last(STA.industry_secondary_person), "#5F6675"], ["Services", last(STA.industry_tertiary_person), "#A3A9B4"]]);
  T["pv-gender"] = last(STA.self_employed_female).toFixed(1) + "%";
  T["ex-g-se-f"] = last(STA.self_employed_female).toFixed(1) + "%";
  T["ex-g-se-f0"] = first(STA.self_employed_female).toFixed(1) + "%";
  T["ex-g-se-m"] = last(STA.self_employed_male).toFixed(1) + "%";
  T["ex-g-rg-f"] = last(STA.regular_female).toFixed(1) + "%";
  T["ex-g-rg-m"] = last(STA.regular_male).toFixed(1) + "%";
  T["ex-g-cs-f"] = last(STA.casual_female).toFixed(1) + "%";
  T["ex-g-cs-m"] = last(STA.casual_male).toFixed(1) + "%";
  const kr = desc(JD.kinds.map((r) => ({ name: r.name, a: r.rg })), "a");
  T["pv-kinds"] = (kr[0].a - kr.at(-1).a).toFixed(1) + " pt";
  // § 08
  const ai = JD.payAi;
  T["pv-paystates"] = inr(ai.regular__person_all);
  T["ex-ps-ai"] = inr(ai.regular__person_all); T["ex-ps-m"] = inr(ai.regular__male_all); T["ex-ps-f"] = inr(ai.regular__female_all);
  const C = S(JD.cond);
  T["pv-cond"] = f1(last(C.none_of_three__person_all));
  T["ex-c-nc0"] = f1(first(C.no_contract__person_all)); T["ex-c-nc1"] = f1(last(C.no_contract__person_all));
  T["ex-c-n0"] = f1(first(C.none_of_three__person_all)); T["ex-c-n1"] = f1(last(C.none_of_three__person_all));
  T["ex-c-ten"] = numWord(Math.round(last(C.none_of_three__person_all) / 10));
  // § 09
  T["pv-social"] = f1(JD.socialAi.f);
  // § 10
  const aiP = last(A.ur_psss), thr = aiP * 2, top = SROWS[0], bot = SROWS.at(-1), spread = top.psss - bot.psss;
  const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const nout = SROWS.filter((r) => r.psss >= thr).length;
  T["pv-states"] = spread.toFixed(1) + " pt";
  T["st-max"] = esc(`${top.name}, ${f1(top.psss)}`);
  T["st-min"] = esc(`${bot.name}, ${f1(bot.psss)}`);
  T["st-spread"] = spread.toFixed(1) + " points";
  T["st-ai"] = f1(aiP);
  T["st-kerala"] = f1(SROWS.find((r) => r.key === "kerala").psss);
  T["st-gujarat"] = f1(SROWS.find((r) => r.key === "gujarat").psss);
  T["st-nout"] = WORDS[nout] || String(nout);
  const movers = SROWS.filter((r) => r.psssPrev != null).map((r) => ({ ...r, d: r.psss - r.psssPrev })).sort((a, b) => a.d - b.d);
  const fall = movers[0], rise = movers.at(-1);
  T["st-fall"] = esc(`${fall.name}, down ${Math.abs(fall.d).toFixed(1)} points to ${f1(fall.psss)}`);
  T["st-rise"] = esc(`${rise.name}, up ${rise.d.toFixed(1)} points to ${f1(rise.psss)}`);
  const wr = desc(JD.work.map((r) => ({ name: r.name, a: r.f })), "a");
  T["pv-work"] = (wr[0].a - wr.at(-1).a).toFixed(1) + " pt";
  T["prov-vintage"] = MB.meta.vintage;
  T["prov-vintage2"] = MB.meta.vintage;
  return T;
}
