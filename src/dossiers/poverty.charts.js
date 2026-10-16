// Poverty and inequality guide: the plates, drawn at build time with the chart kit (src/kit/),
// and the figures the page quotes beside them. Data: World Bank PIP (2021 PPP), one bundle per
// comparable spell of surveys, and WDI's copies plus the national-line and multidimensional
// measures. Rounds from different spells are separate series, never joined by a line (each spell
// is its own ruler); the lineup (model estimates for every year) is pale, its nowcasts dashed.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import p2022 from "../../data/series/poverty-pip-2022.json";
import p2011 from "../../data/series/poverty-pip-2011.json";
import p1993 from "../../data/series/poverty-pip-1993.json";
import p1987 from "../../data/series/poverty-pip-1987.json";
import p1983 from "../../data/series/poverty-pip-1983.json";
import p1977 from "../../data/series/poverty-pip-1977.json";
import lineupB from "../../data/series/poverty-pip-lineup.json";
import wdiB from "../../data/series/poverty-wdi.json";

const pc = (u) => `<span class="pc">${u}</span>`;
const yearOf = (iso) => Number(iso.slice(0, 4));
const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
const pct1 = (v) => v.toFixed(1) + "%";
const inr = (v) => "₹" + Math.round(v).toLocaleString("en-IN");
const PCT = { suffix: "%" };
const Yd = (y) => `${y}-01-01`;

const SPELLS = [p1977, p1983, p1987, p1993, p2011, p2022];
const SURVEYS = SPELLS.flatMap((b) => b.dates.map((d, i) => ({ b, i, year: yearOf(d), spell: b.meta.spell, survey: b.meta.surveys[i], round: b.meta.surveys[i].period?.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1-$2") ?? String(yearOf(d)) })));
const v = (s, k) => s.b.series[k].data[s.i];
const CUR = p2022, L = CUR.dates.length - 1;
const cur = (k, i = L) => CUR.series[k].data[i];
const roundOf = (b, i) => b.meta.surveys[i].period.replace(/^(\d{4})-\d{2}(\d{2})$/, "$1-$2");
const LINES = [["3_00", "$3.00", "lead"], ["4_20", "$4.20", "comp"], ["8_30", "$8.30", "ctx"]];
// a 2021-PPP dollar a day in rupees at the survey's own prices: line x PPP factor x CPI (PIP's own factors)
const rupeesPerDay = (line, b, i) => line * b.series.ppp.data[i] * b.series.cpi.data[i];
const h3 = cur("headcount_3_00"), h42 = cur("headcount_4_20"), h83 = cur("headcount_8_30");
const S11 = SURVEYS.find((s) => s.year === 2011), SNEXT = SURVEYS.find((s) => s.year > 2011);
// the lineup: estimates to the last survey, nowcasts after it (one value per year, never both)
const LU = lineupB.dates.map((d, i) => ({ d, year: yearOf(d), v: lineupB.series.headcount_3_00.data[i] ?? lineupB.series.headcount_3_00_nowcast?.data[i] ?? null, est: lineupB.series.headcount_3_00.data[i] == null,
  poor: lineupB.series.poor_3_00.data[i], kind: lineupB.meta.estimationType[yearOf(d)] }));
const firstNowcast = LU.find((p) => p.est && p.v != null)?.d;
/** one series per comparable spell: dots for every survey, a line only inside a spell */
const spellSeries = (field, o) => SPELLS.map((b, j) => ({ ...o, data: b.dates.map((d, i) => [Yd(yearOf(d)), b.series[field].data[i]]), dots: true, label: j === SPELLS.length - 1 ? o.label : false }));
const csvRow = (head, rows) => ({ cols: head, rows });

export const sparkH3 = () => K.spark(lineupB.dates.map((d, i) => [d, lineupB.series.headcount_3_00.data[i]]).filter((p) => p[1] != null), { width: 190, height: 44 });

/* ---------- § 02 the line decides ---------- */
export function ladder() {
  const lad = (b, i) => Object.keys(b.series).filter((k) => /^headcount_\d+_\d\d$/.test(k)).map((k) => ({ line: Number(k.slice(10).replace("_", ".")), share: b.series[k].data[i] })).sort((a, c) => a.line - c.line);
  const now = lad(CUR, L), prev = lad(CUR, L - 1), old = lad(p2011, 0);
  const lastLine = now.at(-1).line, lg = (l) => String(Math.log10(l));
  const pts = (P) => P.map((p) => [lg(p.line), p.share]);
  const r = (line) => rupeesPerDay(line, CUR, L);
  const tick = (t) => ({ t: lg(t), label: "$" + (Number.isInteger(t) ? t : t.toFixed(2)) });
  return figure({
    bare: true, file: "india-atlas_share-below-each-poverty-line",
    label: `Share of Indians below each poverty line, 2021 PPP dollars a day, logarithmic scale: in ${roundOf(CUR, L)}, ${pct1(h3)} below $3.00, ${pct1(h42)} below $4.20 and ${pct1(h83)} below $8.30; the curves for ${roundOf(CUR, L - 1)} and ${roundOf(p2011, 0)} (a different survey design) beside it`,
    data: csvRow(["line_2021ppp_usd_day", `share_below_${roundOf(CUR, L)}`, `share_below_${roundOf(CUR, L - 1)}`, `share_below_${roundOf(p2011, 0)}_different_design`, `line_in_rupees_a_day_${roundOf(CUR, L)}_prices`],
      now.map((p, i) => [p.line, p.share, prev[i]?.share ?? null, old.find((o) => o.line === p.line)?.share ?? null, Math.round(r(p.line) * 100) / 100])),
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, height: width < 520 ? 300 : 440, zero: true, nameOnEnd: false, // every curve ends near 100% at $40: the end label names the round
      xTicks: (width < 520 ? [1, 3, 8.3, 40] : width < 900 ? [1, 2, 3, 4.2, 8.3, 20, 40] : [1, 2, 3, 4.2, 6, 8.3, 12, 20, 30, 40]).filter((t) => t <= lastLine).map(tick),
      series: [
        { name: `${roundOf(p2011, 0)}, a different survey design`, endLabel: width < 520 ? roundOf(p2011, 0) : `${roundOf(p2011, 0)}, old design`, data: pts(old), role: "ctx2", dash: "2 3", hover: false },
        { name: roundOf(CUR, L - 1), endLabel: roundOf(CUR, L - 1), data: pts(prev), role: "ctx", color: K.C.leadSoft, hover: false },
        { name: roundOf(CUR, L), endLabel: roundOf(CUR, L), data: pts(now), role: "lead", hover: false },
      ],
      events: [
        // the long form on a desktop; "$4.20: 16.1%" where the rules sit closer together
        ...[[3, h3, "left"], [4.2, h42], [8.3, h83, width < 520 ? "left" : null]].map(([l, h, side]) => ({ t: lg(l), label: width < 900 ? `$${l.toFixed(2)}: ${pct1(h)}` : `${pct1(h)} below $${l.toFixed(2)}`, ...(side ? { side } : {}) })),
      ],
    }),
  });
}

/* ---------- § 03 the survey record ---------- */
export function record() {
  const last = SURVEYS.at(-1);
  const lu = LU.filter((p) => p.v != null);
  return figure({
    bare: true, file: "india-atlas_poverty-every-survey",
    label: `Share of Indians below the three international lines at every survey since ${SURVEYS[0].round}: below $3.00 a day, ${pct1(v(SURVEYS[0], "headcount_3_00"))} in ${SURVEYS[0].round}, ${pct1(v(S11, "headcount_3_00"))} in ${S11.round}, ${pct1(v(last, "headcount_3_00"))} in ${last.round}. Dots are surveys; lines join only surveys the World Bank treats as comparable; a pale line is its estimate for the years between`,
    data: csvRow(["reporting_year", "survey_round", "survey", "comparable_spell", "below_3_00_pct", "below_4_20_pct", "below_8_30_pct", "lineup_estimate_below_3_00_pct"],
      LU.map((p) => { const s = SURVEYS.find((x) => x.year === p.year); return [p.year, s?.round ?? "", s?.survey.survey ?? "", s?.spell ?? "", s ? v(s, "headcount_3_00") : null, s ? v(s, "headcount_4_20") : null, s ? v(s, "headcount_8_30") : null, p.v]; })),
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, height: width < 520 ? 400 : 460, tDomain: [1975, yearOf(lineupB.dates.at(-1))],
      series: [
        { name: "World Bank estimate, $3.00", data: lu.map((p) => [p.d, p.v]), role: "ctx", color: K.C.leadSoft, est: firstNowcast, label: false },
        ...LINES.flatMap(([k, lab, role]) => spellSeries("headcount_" + k, { name: `Below ${lab} a day`, short: `${lab} a day`, role })),
      ],
      shade: [{ from: Yd(S11.year + 1), to: Yd(SNEXT.year), label: "No survey" }],
      events: [{ t: Yd(SNEXT.year), label: "HCES redesigned", side: "left" }],
    }),
  });
}

/* ---------- § 04 the gap years ---------- */
export function gap() {
  const rows = LU.filter((p) => p.year >= 2005 && p.v != null);
  const nGap = SNEXT.year - S11.year - 1;
  const surveys = SURVEYS.filter((s) => s.year >= 2004);
  const g = rows.filter((p) => p.year > S11.year && p.year < SNEXT.year);
  return figure({
    bare: true, file: "india-atlas_poverty-lineup-2005-onwards",
    label: `The World Bank's estimates of the share below $3.00 a day for the years without a survey: between the ${S11.round} and ${SNEXT.round} surveys it falls from ${pct1(g[0].v)} in ${g[0].year} to ${pct1(g.at(-1).v)} in ${g.at(-1).year}. These are model estimates, not survey readings`,
    data: csvRow(["year", "world_bank_estimate_below_3_00_pct", "people_below_3_00_millions", "estimation_type", "survey_reading_below_3_00_pct"],
      rows.map((p) => { const s = SURVEYS.find((x) => x.year === p.year); return [p.year, p.v, p.poor, p.kind, s ? v(s, "headcount_3_00") : null]; })),
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, hoverDp: 2, tDomain: [2003, rows.at(-1).year], height: width < 520 ? 300 : 420,
      series: [
        { name: "World Bank estimate", short: "Nowcast", data: rows.map((p) => [p.d, p.v]), role: "ctx", color: K.C.leadSoft, est: firstNowcast, dots: "open" },
        ...[p1993, p2011, p2022].map((b) => ({ name: "Survey reading", data: b.dates.map((d, i) => [Yd(yearOf(d)), b.series.headcount_3_00.data[i]]).filter(([d]) => yearOf(d) >= 2004), role: "lead", dots: true, label: false })),
      ],
      shade: [{ from: Yd(S11.year + 1), to: Yd(SNEXT.year), label: `${nGap} calendar years with no survey` }],
      // a phone has no room for the two adjacent HCES rounds: the latest keeps its note, set high
      notes: surveys.filter((s) => width >= 520 || s.year !== SNEXT.year).map((s, i, A) => { const lastOne = s === surveys.at(-1);
        return { d: Yd(s.year), v: v(s, "headcount_3_00"), text: `Survey ${s.round}\n${pct1(v(s, "headcount_3_00"))}`, side: i === 0 ? "right" : "left", below: width >= 520 && lastOne, ...(width < 520 && lastOne ? { dy: 50 } : {}) }; }),
    }),
  });
}

/* ---------- § 05 how many ---------- */
export function poor() {
  const rows = SURVEYS.map((s, i) => ({ name: s.round, value: v(s, "poor_3_00"), mark: v(s, "poor_4_20"), highlight: i === SURVEYS.length - 1 }));
  return figure({
    bare: true, file: "india-atlas_number-of-poor",
    label: "Number of Indians below $3.00 a day (bars) and below $4.20 a day (rings), million, every survey: " + SURVEYS.map((s) => `${s.round}: ${Math.round(v(s, "poor_3_00"))} million below $3.00, ${Math.round(v(s, "poor_4_20"))} million below $4.20`).join("; "),
    data: csvRow(["reporting_year", "survey_round", "comparable_spell", "below_3_00_millions", "below_4_20_millions", "below_8_30_millions", "poverty_gap_3_00_pct", "poverty_gap_4_20_pct", "population"],
      SURVEYS.map((r) => [r.year, r.round, r.spell, v(r, "poor_3_00"), v(r, "poor_4_20"), v(r, "poor_8_30"), v(r, "poverty_gap_3_00"), v(r, "poverty_gap_4_20"), v(r, "reporting_pop")])),
    draw: (width) => K.bars({ width, rows, dp: 0, sort: false, markName: "Below $4.20:", markFmt: (m) => `${Math.round(m)} below $4.20` }),
  });
}

/* ---------- § 06 the Gini by survey ---------- */
export function gini() {
  const rows = SURVEYS.map((s) => ({ ...s, g: v(s, "gini") }));
  const pick = [rows[0], rows.find((r) => r.year === 2011), rows.at(-2)];
  return figure({
    bare: true, file: "india-atlas_consumption-gini",
    label: "Gini index of consumption, every survey; lines join only comparable surveys: " + rows.map((r) => `${r.round}: ${f1(r.g)}`).join(", "),
    data: csvRow(["reporting_year", "survey_round", "comparable_spell", "gini", "mean_2021ppp_usd_day", "median_2021ppp_usd_day", "mld", "polarisation"], rows.map((r) => [r.year, r.round, r.spell, r.g, v(r, "mean"), v(r, "median"), v(r, "mld"), v(r, "polarization")])),
    draw: (width) => K.line({
      width, freq: "year", endDp: 1, height: width < 520 ? 260 : 340, tDomain: [1975, 2025], zero: false,
      series: spellSeries("gini", { name: "Gini index", short: rows.at(-1).round, role: "lead" }),
      notes: pick.map((r) => ({ d: Yd(r.year), v: r.g, text: `${r.round}\n${f1(r.g)}`, below: r.year === 2011, side: r === rows.at(-2) ? "left" : "right" })),
    }),
  });
}

/* ---------- § 06 deciles ---------- */
export function deciles() {
  const rows = Array.from({ length: 10 }, (_, k) => ({ name: k === 0 ? "Poorest tenth" : k === 9 ? "Richest tenth" : `Tenth ${k + 1}`, value: cur("decile" + (k + 1)), mark: cur("decile" + (k + 1), L - 1), highlight: k === 0 || k === 9 }));
  return figure({
    bare: true, file: "india-atlas_consumption-by-decile",
    label: `Share of consumption by tenth of the population, ${roundOf(CUR, L)} as bars and ${roundOf(CUR, L - 1)} as rings, against an equal share of 10%: ` + rows.map((r) => `${r.name} ${pct1(r.value)}`).join(", "),
    data: csvRow(["decile", `share_${roundOf(CUR, L)}_pct`, `share_${roundOf(CUR, L - 1)}_pct`], rows.map((r) => [r.name, r.value, r.mark])),
    draw: (width) => K.bars({ width, rows, dp: 1, unit: PCT, sort: false, refFill: false, markName: `${roundOf(CUR, L - 1)}:`, ref: { value: 10, label: "Equal share, 10%" } }),
  });
}

/* ---------- § 07 the numbers people quote ---------- */
const wv = (code) => { const s = Object.values(wdiB.series).find((x) => x.name === code); const i = s.data.findLastIndex((x) => x != null); return { v: s.data[i], year: yearOf(wdiB.dates[i]) }; };
const roundY = (y) => { const s = SURVEYS.find((x) => x.year === y); return s ? s.round : String(y); };
const NAT = wv("SI.POV.NAHC"), MPWB = wv("SI.POV.MPWB"), MPUN = wv("SI.POV.MPUN");
const QUOTES = [
  { name: `$3.00 a day, World Bank, ${roundY(SURVEYS.at(-1).year)}`, v: h3, acc: true },
  { name: `$4.20 a day, World Bank, ${roundY(SURVEYS.at(-1).year)}`, v: h42 },
  { name: `$8.30 a day, World Bank, ${roundY(SURVEYS.at(-1).year)}`, v: h83 },
  { name: `Societal poverty line, World Bank, ${roundY(SURVEYS.at(-1).year)}`, v: cur("spr") },
  { name: `$3.00 a day, World Bank, ${roundY(2011)}`, v: v(S11, "headcount_3_00"), old: true },
  { name: `National line (Tendulkar), ${roundY(NAT.year)}`, v: NAT.v, old: true },
  { name: `Multidimensional, World Bank, ${MPWB.year}`, v: MPWB.v },
  { name: `Multidimensional, UNDP and OPHI, ${MPUN.year}`, v: MPUN.v },
];
export function quotes() {
  const rows = QUOTES.map((q) => ({ name: q.name, value: q.v, highlight: !!q.acc, ...(q.old ? { color: K.C.ctx2 } : {}) }));
  return figure({
    bare: true, file: "india-atlas_poverty-figures-compared",
    label: "The poverty figures people quote for India, share counted as poor; older figures from surveys of a different design in grey: " + QUOTES.map((r) => `${r.name}: ${pct1(r.v)}`).join("; "),
    data: csvRow(["measure", "share_poor_pct"], QUOTES.map((r) => [r.name, r.v])),
    draw: (width) => K.bars({ width, rows, dp: 1, unit: PCT, sort: false, nameMax: 340 }),
  });
}

/* ---------- the figures the page quotes (ids kept from the retired client) ---------- */
export function numbers() {
  const T = {};
  const h3p = cur("headcount_3_00", L - 1);
  T["m-latest"] = `HCES ${roundOf(CUR, L)}`;
  T["u-reading"] = `World Bank PIP, HCES ${roundOf(CUR, L)}, 2021 PPP`;
  T["n-h3"] = f1(h3) + pc("%");
  T["d-h3"] = `<b>${pct1(h3p)}</b> in ${roundOf(CUR, L - 1)}`;
  T["n-h42"] = f1(h42) + pc("%");
  T["d-h42"] = `<b>${pct1(cur("headcount_4_20", L - 1))}</b> in ${roundOf(CUR, L - 1)}`;
  T["n-poor"] = f1(cur("poor_3_00")) + pc(" million");
  T["d-poor"] = `below $3.00 a day, <b>${f1(cur("poor_4_20"))} million</b> below $4.20`;
  T["n-gini"] = f1(cur("gini"));
  T["d-gini"] = `<b>${f1(cur("gini", L - 1))}</b> in ${roundOf(CUR, L - 1)}`;
  T["rb-h3"] = f2(h3) + pc("%");
  T["rb-h42"] = f2(h42) + pc("%");
  T["cr-line3"] = inr(rupeesPerDay(3, CUR, L));
  T["cr-round"] = roundOf(CUR, L);
  // § 02
  const r = (line) => rupeesPerDay(line, CUR, L);
  T["pv-ladder"] = `${f1(h3)} to ${f1(h83)}%`;
  T["ex-la-3"] = pct1(h3); T["ex-la-42"] = pct1(h42); T["ex-la-83"] = pct1(h83);
  T["ex-la-r3"] = inr(r(3)); T["ex-la-r3m"] = inr(r(3) * 30); T["ex-la-r3f"] = inr(r(3) * 30 * 5);
  T["ex-la-r42"] = inr(r(4.2)); T["ex-la-r42m"] = inr(r(4.2) * 30);
  T["ex-la-r83"] = inr(r(8.3)); T["ex-la-r83m"] = inr(r(8.3) * 30);
  T["ex-la-ppp"] = f2(cur("ppp"));
  T["ex-la-round"] = roundOf(CUR, L);
  T["ex-la-med"] = "$" + f2(cur("median"));
  T["ex-la-medr"] = inr(cur("median") * cur("ppp") * cur("cpi"));
  // § 03
  const last = SURVEYS.at(-1);
  T["pv-record"] = String(SURVEYS.length);
  T["ex-re-77"] = pct1(v(SURVEYS[0], "headcount_3_00")); T["ex-re-77r"] = SURVEYS[0].round;
  T["ex-re-11"] = pct1(v(S11, "headcount_3_00")); T["ex-re-11r"] = S11.round;
  T["ex-re-22"] = pct1(v(SURVEYS.at(-2), "headcount_3_00")); T["ex-re-22r"] = SURVEYS.at(-2).round;
  T["ex-re-23"] = pct1(v(last, "headcount_3_00")); T["ex-re-23r"] = last.round;
  T["ex-re-n"] = String(SURVEYS.length);
  T["ex-re-spells"] = String(SPELLS.length);
  // § 04
  const rows = LU.filter((p) => p.year >= 2005), g = rows.filter((p) => p.year > S11.year && p.year < SNEXT.year);
  const covid = rows.find((p) => p.year === 2020), pre = rows.find((p) => p.year === 2019), nGap = SNEXT.year - S11.year - 1;
  T["pv-gap"] = String(nGap) + " years";
  T["ex-ga-n"] = String(nGap);
  T["ex-ga-a"] = pct1(g[0].v); T["ex-ga-ay"] = String(g[0].year);
  T["ex-ga-b"] = pct1(g.at(-1).v); T["ex-ga-by"] = String(g.at(-1).year);
  T["ex-ga-19"] = pct1(pre.v); T["ex-ga-20"] = pct1(covid.v);
  T["ex-ga-now"] = pct1(rows.at(-1).v); T["ex-ga-nowy"] = String(rows.at(-1).year);
  T["ex-ga-poor"] = f1(rows.at(-1).poor) + " million";
  // § 05
  const pr = SURVEYS.map((s) => ({ ...s, n3: v(s, "poor_3_00"), n42: v(s, "poor_4_20") }));
  const pl = pr.at(-1), pk = pr.reduce((a, x) => (x.n3 > a.n3 ? x : a));
  T["pv-poor"] = f1(pl.n3) + " mn";
  T["ex-po-n"] = f1(pl.n3) + " million";
  T["ex-po-n42"] = f1(pl.n42) + " million";
  T["ex-po-pk"] = Math.round(pk.n3) + " million";
  T["ex-po-pkr"] = pk.round;
  T["ex-po-r"] = pl.round;
  const gap3 = cur("poverty_gap_3_00"), r3 = rupeesPerDay(3, CUR, L);
  T["ex-po-gap"] = pct1(gap3);
  T["ex-po-short"] = pct1((100 * gap3) / h3);
  T["ex-po-shortr"] = inr((gap3 / h3) * r3) + " a day";
  T["ex-po-sev"] = f2(cur("poverty_severity_3_00"));
  T["ex-po-gap42"] = pct1(cur("poverty_gap_4_20"));
  // § 06
  const gr = SURVEYS.map((s) => ({ ...s, g: v(s, "gini") }));
  T["pv-gini"] = f1(gr.at(-1).g);
  T["ex-gi-now"] = f1(gr.at(-1).g);
  T["ex-gi-prev"] = f1(gr.at(-2).g);
  T["ex-gi-11"] = f1(gr.find((x) => x.year === 2011).g);
  T["ex-gi-mean"] = "$" + f2(cur("mean"));
  T["ex-gi-med"] = "$" + f2(cur("median"));
  T["ex-gi-meanr"] = inr(cur("survey_mean_lcu") * 30);
  T["ex-gi-spl"] = "$" + f2(cur("spl"));
  T["ex-gi-spr"] = pct1(cur("spr"));
  const dn = Array.from({ length: 10 }, (_, k) => ({ now: cur("decile" + (k + 1)), prev: cur("decile" + (k + 1), L - 1) }));
  T["pv-deciles"] = (dn[9].now / dn[0].now).toFixed(1) + "×";
  T["ex-dc-top"] = pct1(dn[9].now);
  T["ex-dc-bot"] = pct1(dn[0].now);
  T["ex-dc-x"] = (dn[9].now / dn[0].now).toFixed(1) + " times";
  T["ex-dc-b40"] = pct1(dn.slice(0, 4).reduce((s, x) => s + x.now, 0));
  T["ex-dc-top0"] = pct1(dn[9].prev);
  // § 07
  T["pv-quotes"] = `${f1(Math.min(...QUOTES.map((q) => q.v)))} to ${f1(Math.max(...QUOTES.map((q) => q.v)))}%`;
  T["ex-qu-nat"] = pct1(NAT.v); T["ex-qu-naty"] = roundY(NAT.year);
  T["ex-qu-wb11"] = pct1(v(S11, "headcount_3_00"));
  T["ex-qu-mpwb"] = pct1(MPWB.v); T["ex-qu-mpwby"] = String(MPWB.year);
  T["ex-qu-mpun"] = pct1(MPUN.v); T["ex-qu-mpuny"] = String(MPUN.year);
  T["prov-vintage"] = CUR.meta.vintage;
  T["prov-vintage2"] = CUR.meta.vintage;
  T["prov-wdi"] = wdiB.meta.vintage;
  return T;
}
