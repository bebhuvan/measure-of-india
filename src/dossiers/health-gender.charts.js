// src/dossiers/health-gender.charts.js: the plates of the Women and men (gender) and Family health
// (NFHS) guides, drawn at build time with the chart kit (src/kit/). Each function returns a bare
// figure for a plate's .plotzone; the plate's title, source line and buttons stay in the page.
// The pages compute every figure in their frontmatter (gender.data.js, nfhs.data.js) and pass
// it here; nothing reaches the reader's browser but finished SVG and the CSV rows.
//
// Two rules these plates keep: separate instruments are separate series (the PLFS designs,
// census and NSS literacy, two NFHS rounds), never one line; and a missing figure is a gap (a
// row with no earlier round shows its later dot alone), never a zero.
import * as K from "../kit/kit.js";
import { figure, dataFigure } from "../kit/figure.js";

const PCT = { suffix: "%" };
const f0 = (v) => (v == null ? "–" : Math.round(v).toLocaleString("en-IN"));
const f1 = (v) => (v == null ? "–" : v.toFixed(1));
// the state names too long for a chart's label column
const SHORT_GEO = { "Dadra & Nagar Haveli and Daman & Diu": "DNH and Daman & Diu", "Andaman & Nicobar  Islands": "Andaman & Nicobar Islands" };
const geo = (g) => SHORT_GEO[g] ?? g;
const P = (points) => points.map((p) => [p.iso, p.value]);
const role = (s, i) => (i === 0 ? "lead" : i === 1 ? "ctx" : "ctx2");

/* ---------- shared shapes ---------- */

/** a ranked bar per state, India as the reference rule */
function stateBars(S, { file, label, dp = 1, unit = {}, refName = "India", from = null }) {
  const rows = S.rows.map((r) => ({ name: geo(r.geo) + (r.caution ? "*" : ""), value: r.v }));
  return figure({
    bare: true, file, label,
    data: { cols: ["State", "Value"], rows: S.rows.map((r) => [r.geo, r.v]) },
    draw: (width) => K.bars({ width, rows, dp, unit, ...(from != null ? { dots: true, from } : {}), ref: { value: S.ref, label: `${refName} ${K.num(S.ref, { dp, suffix: unit.suffix ?? "" })}` } }),
  });
}

/** two values per state (b the one ranked, in the lead colour), India as a shaded row on top */
function stateDumbbell(S, { file, label, a, b, keys, india, dp = 1, unit = {}, fmt = null, sortBy = "b" }) {
  const rows = S.rows.filter((r) => r[b] != null).map((r) => ({ name: geo(r.geo) + (r.caution ? "*" : ""), a: r[a] ?? null, b: r[b] }));
  const ranked = rows.slice().sort((p, q) => (sortBy === "a" ? q.a - p.a : q.b - p.b));
  ranked[0].label = true; ranked.at(-1).label = true;
  const all = [{ name: "India", a: india.a, b: india.b, highlight: true }, ...ranked];
  return figure({
    bare: true, file, label,
    data: { cols: ["State", keys.b, keys.a], rows: [["India", india.b, india.a], ...S.rows.map((r) => [r.geo, r[b], r[a] ?? null])] },
    draw: (width) => K.dumbbell({ width, rows: all, keys, dp, unit, sortBy: "none", ...(fmt ? { fmt } : {}) }),
  });
}

/** a short list of measures, two values each, in the page's own order, every value labelled */
function pairPlate(rows, { file, label, keys, dp = 1, unit = PCT, fmt = null, cols }) {
  const R = rows.filter((r) => r.b != null).map((r) => ({ name: r.label, a: r.a ?? null, b: r.b }));
  return figure({
    bare: true, file, label,
    data: { cols: cols ?? ["Measure", keys.a, keys.b], rows: rows.map((r) => [r.label, r.a ?? null, r.b ?? null]) },
    draw: (width) => K.dumbbell({ width, rows: R, keys, dp, unit, sortBy: "none", labelAll: true, ...(fmt ? { fmt } : {}) }),
  });
}

/** one value per measure, ranked or in the given order */
function measureBars(rows, { file, label, dp = 1, unit = PCT, sort = true, ref = null, highlight = null }) {
  const R = rows.map((r) => ({ name: r.label, value: r.v, highlight: r.label === highlight }));
  return figure({
    bare: true, file, label,
    data: { cols: ["Measure", "Value"], rows: rows.map((r) => [r.label, r.v]) },
    draw: (width) => K.bars({ width, rows: R, dp, unit, sort, ...(ref ? { ref } : {}) }),
  });
}

/** change or gap in points, one bar per measure, coloured by what the plate asks */
function divergingBars(rows, { file, label, cols, csv }) {
  return figure({
    bare: true, file, label, data: { cols, rows: csv },
    draw: (width) => K.bars({ width, rows, dp: 1, sign: true, sort: false, unit: { suffix: "" }, nameMax: 320 }),
  });
}

/** series over time: the first the lead, the rest context; estimated stretches split off pale */
function linePlate(D, { file, label, dp = 0, unit = {}, names = null, notes = [], endNotes = false }) {
  const series = [], shade = [];
  D.series.forEach((s, i) => {
    const est = new Set(s.est ?? []), pts = P(s.points), r = role(s, i);
    const measured = pts.filter(([d]) => !est.has(d));
    series.push({ name: names?.[i] ?? s.label, short: s.label, data: measured, role: r, ...(endNotes ? { label: false } : {}) });
    // with a projection beyond, the last measured point is named where it is, not at the far edge
    if (endNotes) { const [d, v] = measured.at(-1); notes.push({ d, v, text: `${s.label}, ${D.periods?.[d] ?? d.slice(0, 4)}\n${K.num(v, { dp, suffix: unit.suffix ?? "" })}`, side: "left", below: i > 0 }); }
    if (est.size) { // the projection: its own series, drawn pale from the last measured point, unlabelled
      const k = pts.findIndex(([d]) => est.has(d));
      series.push({ name: (names?.[i] ?? s.label) + ", projected", data: pts.slice(Math.max(0, k - 1)), color: i === 0 ? K.C.leadSoft : K.C.ctx2, label: false });
      if (i === 0) shade.push({ from: pts[k - 1][0], to: pts.at(-1)[0], label: "Projected" });
    }
  });
  return figure({
    bare: true, file, label,
    // on a phone the shaded stretch keeps its meaning from the subtitle; its word would sit on the line
    draw: (width) => K.line({ width, freq: "year", unit, endDp: dp, hoverDp: dp, series, notes, shade: width < 520 ? shade.map((sh) => ({ ...sh, label: "" })) : shade }),
  });
}

/* ================================================================ Women and men */
export const GENDER = {
  srb: (D) => linePlate(D.srb, { file: "india-atlas_gender-srb", label: "Sex ratio at birth, girls born per 1,000 boys, India, towns and villages, three-year SRS windows" }),
  census: (D) => linePlate(D.census, { file: "india-atlas_gender-census", label: "Women per 1,000 men in each census, 1951 to 2011" }),
  imr: (D) => linePlate(D.imr, { file: "india-atlas_gender-imr", label: "Infant deaths per 1,000 live births, girls and boys, India" }),
  mmr: (D) => linePlate(D.mmr, { file: "india-atlas_gender-mmr", label: "Maternal deaths per 1,00,000 live births, India, three-year SRS windows" }),
  life: (D) => linePlate(D.life, { file: "india-atlas_gender-life", dp: 1, endNotes: true, label: "Life expectancy at birth, women and men, India, with the official projection drawn pale" }),
  "lok-sabha": (D) => linePlate(D["lok-sabha"], { file: "india-atlas_gender-lok-sabha", dp: 1, unit: PCT, label: "Women's share of Lok Sabha seats at each general election since 1957" }),

  // census literacy and the NSS survey are two instruments: the census lines end in 2011, the
  // NSS figures stand alone beyond a seam
  literacy: (D) => {
    const [cw, cm] = D.literacy.census, [nw, nm] = D.literacy.nss;
    const lastW = cw.points.at(-1), lastM = cm.points.at(-1);
    return figure({
      bare: true, file: "india-atlas_gender-literacy",
      label: "Literacy of women and men in the censuses of 1981 to 2011, and the separate NSS survey of 2017-18",
      data: { cols: ["Period", "Women, census", "Men, census", "Women, NSS", "Men, NSS"],
        rows: [...cw.points.map((p, i) => [p.iso.slice(0, 4), p.value, cm.points[i]?.value ?? null, null, null]), ["2017-18", null, null, nw.points[0].value, nm.points[0].value]] },
      draw: (width) => K.line({
        width, freq: "year", unit: PCT, endDp: 1, hoverDp: 1, yDomain: [0, 100],
        series: [
          { name: "Women, census", data: P(cw.points), role: "lead", label: false },
          { name: "Men, census", data: P(cm.points), role: "ctx", label: false },
          { name: "Women, NSS 2017-18", short: "Women", data: P(nw.points), role: "lead" },
          { name: "Men, NSS 2017-18", short: "Men", data: P(nm.points), role: "ctx" },
        ],
        seam: { t: "2014-01-01", before: "Census", after: "NSS survey" },
        notes: width < 520
          ? [{ d: lastW.iso, v: lastW.value, text: `${f1(lastW.value)}%`, side: "left", below: true }, { d: lastM.iso, v: lastM.value, text: `${f1(lastM.value)}%`, side: "left" }]
          : [{ d: lastW.iso, v: lastW.value, text: `Women, 2011\n${f1(lastW.value)}%`, side: "left", below: true }, { d: lastM.iso, v: lastM.value, text: `Men, 2011\n${f1(lastM.value)}%`, side: "left" }],
      }),
    });
  },

  // three PLFS rulers for each sex, each its own series; the changeovers marked
  work: (D) => {
    const [W3, M3] = D.work.rulers, names = ["agricultural years", "calendar years", "revamped 2025"];
    const series = [
      ...M3.map((s, i) => ({ name: `Men, ${names[i]}`, short: "Men", data: P(s.points), role: "ctx", label: i === 2 })),
      ...W3.map((s, i) => ({ name: `Women, ${names[i]}`, short: "Women", data: P(s.points), role: "lead", label: i === 2 })),
    ];
    return figure({
      bare: true, file: "india-atlas_gender-wpr",
      label: "Worker population ratio of women and men, 15 and over, on three PLFS rulers: agricultural years, calendar years and the revamped 2025 design",
      data: { cols: ["Ruler", "Period", "Women", "Men"], rows: W3.flatMap((s, g) => s.points.map((p, i) => [names[g], p.iso, p.value, M3[g].points[i]?.value ?? null])) },
      draw: (width) => K.line({
        width, freq: "year", unit: PCT, endDp: 1, hoverDp: 1, yDomain: [0, 90], series,
        events: [{ t: W3[1].points[0].iso, label: "Calendar years", short: "Calendar yrs" }, { t: W3[2].points[0].iso, label: "Revamped survey", short: "Revamped", side: "left" }],
      }),
    });
  },

  "srb-states": (D) => stateBars(D["srb-states"], { file: "india-atlas_gender-srb-states", dp: 0, from: 850, label: "Sex ratio at birth by state, girls per 1,000 boys, ranked, India marked" }),
  "mmr-states": (D) => stateBars(D["mmr-states"], { file: "india-atlas_gender-mmr-states", dp: 0, label: "Maternal mortality ratio by state, ranked, India marked" }),
  "marriage-states": (D) => stateBars(D["marriage-states"], { file: "india-atlas_gender-marriage-states", from: 18, label: "Women's mean age at marriage by state, ranked, India marked" }),
  "crime-states": (D) => stateBars(D["crime-states"], { file: "india-atlas_gender-crime-states", label: "Crimes against women per 1,00,000 women by state, ranked, India marked" }),

  "schooling-states": (D, india) => stateDumbbell(D["schooling-states"], { file: "india-atlas_gender-schooling-states", a: "men", b: "women", keys: { a: "Men", b: "Women" }, india,
    label: "Mean years of schooling, people 15 and over, women and men, by state, ranked by women" }),
  "lfpr-states": (D, india) => stateDumbbell(D["lfpr-states"], { file: "india-atlas_gender-lfpr-states", a: "men", b: "women", keys: { a: "Men", b: "Women" }, india, unit: PCT,
    label: "Labour force participation, 15 and over, women and men, by state, 2025, ranked by women" }),
  "wage-states": (D, india) => stateDumbbell(D["wage-states"], { file: "india-atlas_gender-wage-states", a: "men", b: "women", keys: { a: "Men", b: "Women" }, india, dp: 0,
    fmt: (v) => "₹" + f0(v), label: "Rural casual daily wage, women and men, by state, 2025, rupees, ranked by women" }),

  "tfr-edu": (D) => measureBars(D["tfr-edu"].rows, { file: "india-atlas_gender-tfr-edu", unit: {}, sort: false, ref: { value: D["tfr-edu"].ref, label: `All literate women ${f1(D["tfr-edu"].ref)}` },
    label: "Children per woman by the mother's schooling, from never at school to graduate" }),
  money: (D) => measureBars(D.money, { file: "india-atlas_gender-money", label: "Women's share of accounts and holders in each scheme or market, per cent" }),
  voice: (D) => measureBars(D.voice, { file: "india-atlas_gender-voice", label: "Women's share of each office, per cent" }),
  conviction: (D) => measureBars(D.conviction, { file: "india-atlas_gender-conviction", highlight: "All crimes against women", label: "Convictions as a share of cases due for trial, by crime head, per cent" }),

  school: (D) => pairPlate(D.school, { file: "india-atlas_gender-school", keys: { a: "Boys", b: "Girls" }, label: "Gross enrolment by level and dropout by stage, boys and girls, per cent" }),
  time: (D) => pairPlate(D.time, { file: "india-atlas_gender-time", keys: { a: "2019", b: "2024" }, dp: 0, unit: { suffix: " min" }, label: "Minutes a day per person on unpaid work at home and paid work, women and men, 2019 and 2024" }),
  "crime-heads": (D, years) => pairPlate(D["crime-heads"], { file: "india-atlas_gender-crime-heads", keys: { a: years.from, b: years.to }, dp: 0, unit: {}, fmt: f0, label: "Crimes against women registered under each head, two years compared" }),
  causes: (D) => pairPlate(D.causes, { file: "india-atlas_gender-causes", keys: { a: "Men", b: "Women" }, label: "Share of deaths by broad cause, men and women, per cent" }),
};

/* ================================================================ Family health (NFHS) */
const R45 = { a: "NFHS-4, 2015-16", b: "NFHS-5, 2019-21" };
const RU = { a: "Villages", b: "Towns" };
const pair45 = (k, label, o = {}) => (D) => pairPlate(D[k], { file: "india-atlas_nfhs-" + k, keys: R45, label, cols: ["Measure", "NFHS-4", "NFHS-5"], ...o });
const pairRU = (k, label) => (D) => pairPlate(D[k].map((r) => ({ label: r.label, a: r.rural, b: r.urban })), { file: "india-atlas_nfhs-" + k, keys: RU, label, cols: ["Measure", "Rural", "Urban"] });

export const NFHS = {
  nfhs6: (D) => pairPlate(D.nfhs6, { file: "india-atlas_nfhs-6", keys: { a: "NFHS-5", b: "NFHS-6, 2023-24" }, cols: ["Measure", "NFHS-5", "NFHS-6"], label: "Selected measures, India, NFHS-5 and NFHS-6, as printed in the NFHS-6 fact sheets" }),
  anaemia: pair45("anaemia", "Share anaemic by group, India, NFHS-4 and NFHS-5"),
  nutrition: pair45("nutrition", "Children's nutrition and feeding, India, NFHS-4 and NFHS-5"),
  mortality: pair45("mortality", "Deaths per 1,000 live births, India, NFHS-4 and NFHS-5", { dp: 0, unit: {} }),
  vaccines: pair45("vaccines", "Vaccination and treatment of childhood illness, India, NFHS-4 and NFHS-5"),
  births: pair45("births", "Care before, during and after birth, India, NFHS-4 and NFHS-5"),
  household: pair45("household", "Household conditions, India, NFHS-4 and NFHS-5"),
  fp: pair45("fp", "Family planning methods and unmet need, married women 15-49, NFHS-4 and NFHS-5"),
  ncd: pairRU("ncd", "Blood pressure, blood sugar and weight, villages and towns, NFHS-5"),
  women: pairRU("women", "Women's lives, villages and towns, NFHS-5"),

  // every per-cent measure taken twice: the wrong way in sindoor, no right direction in grey
  direction: (D) => divergingBars(D.direction.map((r) => ({ name: r.short, value: r.change, color: r.dir === 0 ? K.C.ctx2 : r.dir * r.change < 0 ? K.C.comp : K.C.leadTint })), {
    file: "india-atlas_nfhs-change", label: "Change between NFHS-4 and NFHS-5 in percentage points for every per-cent measure taken both times, the ones that moved the wrong way picked out",
    cols: ["Measure", "NFHS-4", "NFHS-5", "Change, points", "Direction"],
    csv: D.direction.map((r) => [r.label, r.a, r.b, r.change, r.dir === 0 ? "no direction" : r.dir * r.change < 0 ? "worse" : "better"]),
  }),
  // town minus village: the measures higher in villages picked out
  gap: (D) => divergingBars(D.gap.map((r) => ({ name: r.short, value: r.gap, color: r.gap < 0 ? K.C.comp : K.C.leadTint })), {
    file: "india-atlas_nfhs-rural-urban", label: "Town figure minus village figure for every per-cent measure in NFHS-5, the ones higher in villages picked out",
    cols: ["Measure", "Rural", "Urban", "Urban minus rural"], csv: D.gap.map((r) => [r.label, r.rural, r.urban, r.gap]),
  }),

  "anaemia-states": (D, india) => stateDumbbell(D["anaemia-states"], { file: "india-atlas_nfhs-anaemia-states", a: "v4", b: "v", keys: { a: "NFHS-4", b: "NFHS-5" }, india, unit: PCT,
    label: "Children 6-59 months anaemic by state, NFHS-5 with NFHS-4, ranked by NFHS-5" }),
  "ncd-states": (D, india) => stateDumbbell(D["ncd-states"], { file: "india-atlas_nfhs-ncd-states", a: "men", b: "women", keys: { a: "Men", b: "Women" }, india, unit: PCT,
    label: "High blood pressure or on medicine, women and men, by state, NFHS-5, ranked by women" }),
  "cancer-states": (D, india) => stateDumbbell(D["cancer-states"], { file: "india-atlas_nfhs-cancer-states", a: "breast", b: "cervical", keys: { a: "Breast", b: "Cervical" }, india, unit: PCT,
    label: "Women 30-49 ever screened for cervical cancer and given a breast examination, by state, NFHS-5" }),
  "women-states": (D, india) => stateDumbbell(D["women-states"], { file: "india-atlas_nfhs-women-states", a: "bank", b: "phone", keys: { a: "Bank account", b: "Phone" }, india, unit: PCT,
    label: "Women with a phone and a bank account they use, by state, NFHS-5, ranked by phone" }),
  "tobacco-states": (D, india) => stateDumbbell(D["tobacco-states"], { file: "india-atlas_nfhs-tobacco-states", a: "women", b: "men", keys: { a: "Women", b: "Men" }, india, unit: PCT,
    label: "Tobacco use, men and women, by state, NFHS-5, ranked by men" }),
  "tfr-states": (D, india) => stateDumbbell(D["tfr-states"], { file: "india-atlas_nfhs-tfr-states", a: "v4", b: "v", keys: { a: "NFHS-4", b: "NFHS-5" }, india, dp: 2,
    label: "Children per woman by state, NFHS-5 with NFHS-4, ranked by NFHS-5" }),
  "cs-states": (D, india) => stateDumbbell(D["cs-states"], { file: "india-atlas_nfhs-cs-states", a: "public", b: "private", keys: { a: "Public facilities", b: "Private facilities" }, india, unit: PCT,
    label: "Share of births by caesarean in private and public facilities, by state, NFHS-5, ranked by private" }),
  "violence-states": (D) => stateBars(D["violence-states"], { file: "india-atlas_nfhs-violence-states", unit: PCT, label: "Married women ever hurt by a husband, by state, NFHS-5, ranked, India marked" }),

  /** the state table: an HTML grid, each column shaded on its own range, darker at the worse end */
  table: (T) => {
    const ranges = T.cols.map((c, j) => { const vs = T.rows.map((r) => r.v[j]).filter((v) => v != null); return [Math.min(...vs), Math.max(...vs)]; });
    const tint = (v, [lo, hi], bad) => {
      if (v == null || bad == null) return "transparent";
      const t = (v - lo) / (hi - lo || 1), w = bad ? t : 1 - t;
      return `rgba(46,75,216,${(0.03 + 0.27 * w).toFixed(3)})`;
    };
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const csv = { cols: ["State", ...T.cols.map((c) => c.label)], rows: [T.india, ...T.rows].map((r) => [r.geo, ...r.v]) };
    return dataFigure({ file: "india-atlas_nfhs-states-table", data: csv, html: `<div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>State or UT</th>${T.cols.map((c) => `<th>${esc(c.short)}</th>`).join("")}</tr></thead><tbody>` +
      [T.india, ...T.rows].map((r, i) => `<tr${i === 0 ? ' class="ai"' : ""}><td>${esc(r.geo)}</td>${r.v.map((v, j) => `<td style="background:${i === 0 ? "transparent" : tint(v, ranges[j], T.cols[j].bad)}">${v == null ? "—" : f1(v)}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div>` });
  },
};
