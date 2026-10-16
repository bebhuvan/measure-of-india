// ILO guide: the plates, drawn at build time with the chart kit (src/kit/), and the figures the
// page quotes beside them. Data: the ilo-* bundles (read through src/dossiers/ilo.data.js) and
// MoSPI's PLFS annual figures (plfs-annual, the jobs guide's bundle) as a fifth ruler.
// Instruments are never joined: the ILO's modelled estimates, its processing of PLFS, NSS rounds
// and the Census, and MoSPI's own figures are separate series. Modelled years the ILO flags R
// (real, from a survey) carry a dot; projection years are dashed and never labelled as data.
// Runs at build time only.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";
import { load, flagged, K as KEY, PEERS } from "./ilo.data.js";

const pc = (u) => `<span class="pc">${u}</span>`;
const p1 = (v) => fmt.pct1(v);
const mn = (v) => (v / 1000).toFixed(1);           // thousands -> millions, display only
const yearOf = (iso) => +iso.slice(0, 4);
const PCT = { suffix: "%" };
const INK2 = K.C.ink2;
const tbl = (cols, rows) => ({ cols, rows });

/** [[iso, v]] of a bundle series, optionally within years and scaled; nulls kept as gaps */
const ser = (slug, key, { from = -Infinity, to = Infinity, scale = 1 } = {}) => {
  const b = load(slug), s = b.series[key];
  if (!s) throw new Error(`ilo.charts: ${slug} has no series ${key}`);
  return b.dates.map((d, i) => [d, s.data[i] == null ? null : s.data[i] * scale]).filter(([d]) => yearOf(d) >= from && yearOf(d) <= to);
};
const nn = (P) => P.filter((p) => p[1] != null);
const lastP = (P) => nn(P).at(-1), firstP = (P) => nn(P)[0];
const atY = (P, y) => P.find(([d]) => yearOf(d) === y)?.[1] ?? null;
/** the years of a modelled series the ILO flags R (taken from a survey), as a dots-only series */
const realDots = (slug, key, P, o) => { const R = new Set(flagged(slug, key, "R").map(Number)); return { ...o, data: P.map(([d, v]) => [d, R.has(yearOf(d)) ? v : null]), line: false, dots: true, label: false, hover: false }; };

const EAP = "ilo-est-eap-2wap", UNE = "ilo-est-une-2eap", EET = "ilo-est-eip-2eet", EMP = "ilo-est-emp-2emp";
const LF = (sex) => ser(EAP, KEY.lfpr(sex));

/** the plates' line charts share one setting: years, end labels with the value */
const yrLine = (spec) => (width) => K.line({ width, freq: "year", endDp: 1, ...spec, ...(spec.height ? { height: width < 520 ? Math.round(spec.height * 0.72) : spec.height } : {}) });

export const sparkEmp = () => K.spark(nn(ser(EMP, KEY.emp())), { width: 190, height: 44 });

/* ---------- § 02 participation since 1990 ---------- */
export function lfpr() {
  const lastYr = yearOf(lastP(LF("t"))[0]);
  const proj = (sex) => ser("ilo-est-projections", KEY.lfpr(sex), { to: 2027 });
  const S = [["m", "Men", "ctx", INK2], ["t", "Everyone 15+", "ctx2", null], ["f", "Women", "lead", null]];
  return figure({
    bare: true, file: "india-atlas_ilo-participation",
    label: `Labour force participation by sex, ILO modelled estimates, 1990 to ${lastYr} with projections dashed: women ${p1(firstP(LF("f"))[1])} in 1990 and ${p1(lastP(LF("f"))[1])} in ${lastYr}; men ${p1(lastP(LF("m"))[1])}`,
    data: tbl(["year", "women", "men", "everyone_15plus", "kind"], LF("t").map(([d], i) => [yearOf(d), LF("f")[i][1], LF("m")[i][1], LF("t")[i][1], "estimate"]).concat(proj("t").filter(([d]) => yearOf(d) > lastYr).map(([d, v], i, A) => [yearOf(d), atY(proj("f"), yearOf(d)), atY(proj("m"), yearOf(d)), v, "projection"]))),
    draw: yrLine({
      unit: PCT, endFormat: p1, tDomain: [1990, 2027], height: 420, zero: true,
      series: [
        ...S.map(([sx, name, role, color]) => ({ name: `${name}, projection`, data: proj(sx).filter(([d]) => yearOf(d) > lastYr), role, ...(color ? { color } : {}), dash: "3 4", label: false, hover: false })),
        ...S.map(([sx, name, role, color]) => ({ name, data: LF(sx), role, ...(color ? { color } : {}) })),
        ...S.map(([sx, name, role, color]) => realDots(EAP, KEY.lfpr(sx), LF(sx), { name: `${name}, survey year`, role, ...(color ? { color } : {}) })),
      ],
      events: [{ t: `${lastYr}-07-01`, label: "Projections →", short: "Projections" }],
    }),
  });
}

/* ---------- § 03 five rulers ---------- */
const sk = (sex) => `eap_dwap_sex_age_rt__sex_${sex}__age_ythadult_yge15`;
// MoSPI's July-June survey years are plotted at their middle (1 January of the second year)
const mospi = (k) => ser("plfs-annual", k).map(([d, v]) => [`${yearOf(d) + 1}-01-01`, v]);
export function rulers() {
  const ilo = ser("ilo-plfs-eap", sk("t"), { to: 2025 }), model = ser(EAP, KEY.lfpr("t"), { from: 1961, to: 2025 });
  return figure({
    bare: true, file: "india-atlas_ilo-five-rulers",
    label: `Labour force participation, everyone 15 and over, on five instruments drawn separately: the ILO's processing of PLFS ${p1(lastP(ilo)[1])} in ${yearOf(lastP(ilo)[0])}; MoSPI usual status ${p1(lastP(mospi("lfpr_psss"))[1])} and weekly status ${p1(lastP(mospi("lfpr_cws"))[1])}; the ILO model; NSS rounds and the Census as dots`,
    // a phone keeps one word of an end label's name: each ruler gets a one-word name there
    draw: (width) => yrLine({
      unit: PCT, endFormat: p1, tDomain: [1961, 2025], height: 440, zero: false,
      series: [
        { name: "ILO model", short: width < 520 ? "Model" : "ILO model", data: model, role: "ctx" },
        { name: "Census (ILO processing)", data: ser("ilo-census", sk("t"), { from: 1961, to: 2025 }), role: "ctx", color: INK2, line: false, dots: "open", label: false },
        { name: "NSS rounds (ILO processing)", data: ser("ilo-nss-eap", sk("t"), { from: 1961, to: 2025 }), role: "ctx", color: INK2, line: false, dots: true, label: false },
        { name: "MoSPI, weekly status", short: width < 520 ? "Weekly" : "MoSPI, weekly", data: mospi("lfpr_cws"), role: "comp", color: K.C.compTint },
        { name: "MoSPI, usual status", short: width < 520 ? "Usual" : "MoSPI, usual", data: mospi("lfpr_psss"), role: "comp" },
        { name: "PLFS, ILO processing", short: width < 520 ? "ILO-PLFS" : "ILO, from PLFS", data: ilo, role: "lead" },
      ],
    })(width),
  });
}

/* ---------- § 04 the unemployment rate the model made up ---------- */
const UK = KEY.ur("t"), UY = KEY.ur("t", "y15_24");
const UB = load(UNE);
const BAND = UB.dates.map((d, i) => [d, UB.series[UK].lower?.[i], UB.series[UK].upper?.[i]]).filter(([, lo, hi]) => lo != null && hi != null && hi > lo);
const REAL_U = flagged(UNE, UK, "R").map(Number), FIRST_REAL = Math.min(...REAL_U);
export function unemp() {
  const all = ser(UNE, UK, { from: 1991, to: 2024 }), young = ser(UNE, UY, { from: 1991, to: 2024 });
  return figure({
    bare: true, file: "india-atlas_ilo-unemployment",
    label: `India's unemployment rate in the ILO's model with its uncertainty band: imputed at about ${p1(atY(all, 2000))} through ${FIRST_REAL - 1}, the band from ${p1(BAND[0][1])} to ${p1(BAND[0][2])} in ${yearOf(BAND[0][0])}; ${p1(lastP(all)[1])} in ${yearOf(lastP(all)[0])}, and ${p1(lastP(young)[1])} for those aged 15 to 24`,
    data: tbl(["year", "everyone_15plus_model", "band_lower", "band_upper", "aged_15_24_model"], all.map(([d, v], i) => [yearOf(d), v, BAND.find((b) => b[0] === d)?.[1] ?? null, BAND.find((b) => b[0] === d)?.[2] ?? null, young[i][1]])),
    draw: yrLine({
      unit: PCT, endFormat: p1, tDomain: [1991, 2024], height: 440,
      ranges: [{ data: BAND, color: K.C.leadWash }],
      series: [
        { name: "Aged 15-24, model", short: "15-24 year olds", data: young, role: "ctx" },
        { name: "Everyone 15+, model", short: "Everyone 15+", data: all, role: "lead" },
        realDots(UNE, UY, young, { name: "Aged 15-24, survey year", role: "ctx" }),
        realDots(UNE, UK, all, { name: "Everyone 15+, survey year", role: "lead" }),
        { name: "PLFS, ILO processing", data: ser("ilo-plfs-une", KEY.sUr("t"), { from: 1991, to: 2024 }), role: "ctx", color: INK2, line: false, dots: true, label: false },
        { name: "NSS rounds, ILO processing", data: ser("ilo-nss-une", KEY.sUr("t"), { from: 1991, to: 2024 }), role: "ctx", color: INK2, line: false, dots: "open", label: false },
      ],
      events: [{ t: `${FIRST_REAL}-01-01`, label: "Survey data from here", short: "Survey data →" }],
    }),
  });
}

/* ---------- § 05 women: by age, by schooling, by place ---------- */
const SP = load("ilo-plfs-eap"), SPL = yearOf(SP.dates.at(-1)), SPF = yearOf(SP.dates[0]);
const spAt = (k, y) => atY(ser("ilo-plfs-eap", k), y);
const BANDS5 = ["y15_19", "y20_24", "y25_29", "y30_34", "y35_39", "y40_44", "y45_49", "y50_54", "y55_59", "y60_64", "yge65"];
const AGE = BANDS5.map((b) => { const k = `eap_dwap_sex_age_rt__sex_f__age_5yrbands_${b}`; return { name: b === "yge65" ? "65 and over" : b.slice(1).replace("_", " to "), v: spAt(k, SPL), was: spAt(k, SPF) }; });
const AGE_PK = AGE.reduce((a, r) => (r.v > a.v ? r : a));
const EDU = [["ltb", "Less than basic"], ["bas", "Basic (primary, lower secondary)"], ["int", "Intermediate (upper secondary)"], ["adv", "Advanced (graduate and above)"]]
  .map(([c, name]) => ({ c, name, v: spAt(`eap_dwap_sex_edu_rt__sex_f__edu_aggregate_${c}`, SPL), was: spAt(`eap_dwap_sex_edu_rt__sex_f__edu_aggregate_${c}`, SPF) }));
const ringBars = (rows, hl, o = {}) => (width) => K.bars({ width, sort: false, dp: 1, unit: PCT, markName: `${SPF}:`, rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.was, highlight: hl(r) })), ...o });
export function womenAge() {
  return figure({
    bare: true, file: "india-atlas_ilo-women-age",
    label: `Women's labour force participation by five-year age band, ${SPL} as bars and ${SPF} as rings: ` + AGE.map((r) => `${r.name}: ${p1(r.v)} in ${SPL}, ${p1(r.was)} in ${SPF}`).join("; "),
    data: tbl(["age_band", `lfpr_${SPF}`, `lfpr_${SPL}`], AGE.map((r) => [r.name, r.was, r.v])),
    draw: ringBars(AGE, (r) => r === AGE_PK),
  });
}
export function womenEdu() {
  return figure({
    bare: true, file: "india-atlas_ilo-women-edu",
    label: `Women's labour force participation by schooling, ${SPL} as bars and ${SPF} as rings: ` + EDU.map((r) => `${r.name}: ${p1(r.v)}`).join("; "),
    data: tbl(["education", `lfpr_${SPF}`, `lfpr_${SPL}`], EDU.map((r) => [r.name, r.was, r.v])),
    draw: ringBars(EDU, (r) => r.c === "int", { nameMax: 280 }),
  });
}
const GEO = (sex, g) => ser("ilo-plfs-eap", `eap_dwap_sex_geo_rt__sex_${sex}__geo_cov_${g}`);
export function womenArea() {
  const rur = GEO("f", "rur"), urb = GEO("f", "urb");
  return figure({
    bare: true, file: "india-atlas_ilo-women-rural-urban",
    label: `Labour force participation, rural and urban, women and men, ${SPF} to ${SPL}: rural women ${p1(firstP(rur)[1])} in ${SPF} and ${p1(lastP(rur)[1])} in ${SPL}; urban women ${p1(lastP(urb)[1])}`,
    draw: yrLine({
      unit: PCT, endFormat: p1, height: 400, zero: true,
      series: [
        { name: "Urban men", data: GEO("m", "urb"), role: "ctx2" },
        { name: "Rural men", data: GEO("m", "rur"), role: "ctx" },
        { name: "Urban women", data: urb, role: "ctx", color: INK2 },
        { name: "Rural women", data: rur, role: "lead" },
      ],
    }),
  });
}

/* ---------- § 06 NEET ---------- */
const NE = (sex) => ser(EET, KEY.neet(sex));
export function neet() {
  return figure({
    bare: true, file: "india-atlas_ilo-neet",
    label: `Young people not in employment, education or training, ILO modelled estimates: young women ${p1(firstP(NE("f"))[1])} in ${yearOf(firstP(NE("f"))[0])} and ${p1(lastP(NE("f"))[1])} in ${yearOf(lastP(NE("f"))[0])}; young men ${p1(lastP(NE("m"))[1])}. The ILO's processing of PLFS and NSS for young women as rings`,
    draw: yrLine({
      unit: PCT, endFormat: p1, tDomain: [2005, 2025], height: 420, zero: true,
      series: [
        { name: "All youth, model", short: "All youth", data: NE("t"), role: "ctx" },
        { name: "Young men, model", short: "Young men", data: NE("m"), role: "ctx", color: INK2 },
        { name: "Young women, model", short: "Young women", data: NE("f"), role: "lead" },
        { name: "Young women, PLFS (ILO processing)", data: ser("ilo-plfs-sdg", KEY.sNeet("f"), { from: 2005, to: 2025 }), role: "lead", line: false, dots: "open", label: false },
        { name: "Young women, NSS (ILO processing)", data: ser("ilo-nss-more", KEY.sNeet("f"), { from: 2005, to: 2025 }), role: "ctx", color: INK2, line: false, dots: "open", label: false },
      ],
    }),
  });
}

/* ---------- § 07-08 status in employment, sector: shares of everyone employed ---------- */
const share = (k, tot) => { const a = ser(EMP, k), t = ser(EMP, tot); return a.map(([d, v], i) => [d, v != null && t[i][1] ? (100 * v) / t[i][1] : null]); };
const STATUS = [["3", "Own-account", "ctx", INK2], ["1", "Employees", "lead", null], ["5", "Family workers", "ctx", null], ["2", "Employers", "ctx2", null]].map(([c, name, role, color]) => ({ name, role, color, data: share(KEY.ste(c), KEY.ste("total")) }));
const SECTOR = [["agr", "Agriculture", "lead", null], ["ser", "Services", "ctx", INK2], ["ind", "Industry", "ctx", null]].map(([c, name, role, color]) => ({ name, role, color, data: share(KEY.eco(c), KEY.eco("total")) }));
const shares = (rows, file, title) => {
  const ly = yearOf(lastP(rows[0].data)[0]);
  return figure({
    bare: true, file,
    label: `${title}: ` + rows.map((x) => `${x.name} ${p1(firstP(x.data)[1])} in 1991, ${p1(lastP(x.data)[1])} in ${ly}`).join("; "),
    data: tbl(["year", ...rows.map((x) => x.name)], rows[0].data.map(([d], i) => [yearOf(d), ...rows.map((x) => x.data[i][1])])),
    draw: yrLine({ unit: PCT, endFormat: p1, height: 420, zero: true, tDomain: [1991, ly],
      series: rows.slice().reverse().map((x) => ({ name: x.name, data: x.data.filter(([d]) => yearOf(d) >= 1991), role: x.role, ...(x.color ? { color: x.color } : {}) })) }),
  });
};
export const status = () => shares(STATUS, "india-atlas_ilo-status", "Share of everyone employed by status in employment, ILO modelled estimates");
export const sector = () => shares(SECTOR, "india-atlas_ilo-sector", "Share of everyone employed by broad sector, ILO modelled estimates");

/* ---------- § 09 informality ---------- */
const INF = load("ilo-plfs-sdg"), IL = yearOf(INF.dates.at(-1)), IF0 = yearOf(INF.dates[0]);
const INFR = [["total", "All work"], ["agr", "Agriculture"], ["ind", "Industry"], ["ser", "Services"]].map(([c, name]) => ({ c, name, v: atY(ser("ilo-plfs-sdg", KEY.sInf(c)), IL), was: atY(ser("ilo-plfs-sdg", KEY.sInf(c)), IF0) }));
export function informal() {
  return figure({
    bare: true, file: "india-atlas_ilo-informal",
    label: `Share of employment that is informal, by sector, ${IL} as bars and ${IF0} as rings: ` + INFR.map((r) => `${r.name}: ${p1(r.v)} in ${IL}, ${p1(r.was)} in ${IF0}`).join("; "),
    data: tbl(["sector", `informal_share_${IF0}`, `informal_share_${IL}`], INFR.map((r) => [r.name, r.was, r.v])),
    draw: (width) => K.bars({ width, sort: false, dp: 1, unit: PCT, markName: `${IF0}:`, rows: INFR.map((r) => ({ name: r.name, value: r.v, mark: r.was, highlight: r.c === "total" })) }),
  });
}

/* ---------- § 10 working poverty ---------- */
const CLA = (c) => ser(EMP, KEY.cla(c), { scale: 1e-3 });
export function poverty() {
  const ex = CLA("cat1"), mod = CLA("cat2"), up = CLA("cat34"), ly = yearOf(lastP(ex)[0]);
  return figure({
    bare: true, file: "india-atlas_ilo-working-poverty",
    label: `Employed people by their household's daily income per person, 2021 PPP dollars, millions: under $3 a day ${firstP(ex)[1].toFixed(0)} million in 1991 and ${lastP(ex)[1].toFixed(0)} million in ${ly}; $3 to $4.20 ${lastP(mod)[1].toFixed(0)} million; $4.20 or more ${lastP(up)[1].toFixed(0)} million`,
    data: tbl(["year", "under_3_millions", "3_to_4_20_millions", "4_20_or_more_millions"], ex.map(([d, v], i) => [yearOf(d), v, mod[i][1], up[i][1]])),
    draw: yrLine({ unit: { suffix: " mn" }, endFormat: (v) => v.toFixed(0) + " mn", height: 420, tDomain: [1991, ly],
      series: [
        { name: "$4.20 a day or more", short: "$4.20 or more", data: up, role: "ctx", color: INK2 },
        { name: "$3 to $4.20 a day", short: "$3 to $4.20", data: mod, role: "ctx" },
        { name: "Under $3 a day", short: "Under $3", data: ex, role: "lead" },
      ] }),
  });
}

/* ---------- § 11 labour's share; how it is split ---------- */
export function lshare() {
  const s = ser("ilo-est-lap-2gdp", KEY.lshare);
  return figure({
    bare: true, file: "india-atlas_ilo-labour-share",
    label: `Labour income share of GDP, ILO modelled estimates: ${p1(firstP(s)[1])} in ${yearOf(firstP(s)[0])}, ${p1(lastP(s)[1])} in ${yearOf(lastP(s)[0])}`,
    draw: yrLine({ unit: PCT, endFormat: p1, height: 360, zero: false, series: [{ name: "Labour income share of GDP", data: s, role: "lead" }] }),
  });
}
const LD = load("ilo-est-lap-2lid"), LDL = yearOf(LD.dates.at(-1)), LDF = yearOf(LD.dates[0]);
const DEC = Array.from({ length: 10 }, (_, i) => { const P = ser("ilo-est-lap-2lid", KEY.decile(i + 1)); return { i, name: i === 0 ? "Poorest tenth of workers" : i === 9 ? "Richest tenth of workers" : `Tenth ${i + 1}`, v: atY(P, LDL), was: atY(P, LDF) }; });
export function deciles() {
  return figure({
    bare: true, file: "india-atlas_ilo-deciles",
    label: `Share of all labour income by tenth of workers, ${LDL} as bars and ${LDF} as rings: ` + DEC.map((r) => `${r.name}: ${p1(r.v)}`).join("; "),
    data: tbl(["tenth_of_workers", `share_${LDF}`, `share_${LDL}`], DEC.map((r) => [r.i + 1, r.was, r.v])),
    draw: (width) => K.bars({ width, sort: false, dp: 1, unit: PCT, markName: `${LDF}:`, rows: DEC.map((r) => ({ name: r.name, value: r.v, mark: r.was, highlight: r.i === 9 })) }),
  });
}

/* ---------- § 12 hours, § 13 earnings ---------- */
const HR = (sex) => ser("ilo-est-how-2emp", KEY.hours(sex));
export function hours() {
  const ly = yearOf(lastP(HR("t"))[0]);
  return figure({
    bare: true, file: "india-atlas_ilo-hours",
    label: `Average weekly hours actually worked per employed person, ILO modelled estimates: women ${lastP(HR("f"))[1].toFixed(1)} hours and men ${lastP(HR("m"))[1].toFixed(1)} hours a week in ${ly}`,
    draw: yrLine({ unit: { suffix: " h" }, endFormat: (v) => v.toFixed(1) + " h", height: 380, zero: false,
      series: [{ name: "Everyone", data: HR("t"), role: "ctx" }, { name: "Men", data: HR("m"), role: "ctx", color: INK2 }, { name: "Women", data: HR("f"), role: "lead" }] }),
  });
}
const ER = (sex) => ser("ilo-plfs-ear", KEY.sEarn(sex));
const rs = (v) => "₹" + fmt.inr(v);
export function earn() {
  const ly = yearOf(lastP(ER("t"))[0]), fy = yearOf(firstP(ER("t"))[0]);
  return figure({
    bare: true, file: "india-atlas_ilo-earnings",
    label: `Average monthly earnings of employees, rupees at current prices, PLFS as processed by the ILO: all employees ${rs(firstP(ER("t"))[1])} in ${fy} and ${rs(lastP(ER("t"))[1])} in ${ly}; women ${rs(lastP(ER("f"))[1])}, men ${rs(lastP(ER("m"))[1])}`,
    draw: yrLine({ unit: { prefix: "₹" }, endFormat: rs, hoverDp: 0, height: 400, yDomain: [0, Math.max(...nn(ER("m")).map((p) => p[1]))],
      series: [{ name: "All employees", short: "All", data: ER("t"), role: "ctx" }, { name: "Men", data: ER("m"), role: "ctx", color: INK2 }, { name: "Women", data: ER("f"), role: "lead" }] }),
  });
}

/* ---------- § 14 peers ---------- */
const peerB = (g) => "ilo-peer-" + g;
const ownFam = (slug) => { const t = ser(slug, KEY.ste("total")), a = ser(slug, KEY.ste("3")), c = ser(slug, KEY.ste("5")); return t.map(([d, v], i) => [d, v && a[i][1] != null && c[i][1] != null ? (100 * (a[i][1] + c[i][1])) / v : null]); };
const PANELS = [
  ["Women's participation", (slug) => ser(slug, KEY.lfpr("f"))],
  ["Youth unemployment", (slug) => ser(slug, KEY.ur("t", "y15_24"))],
  ["Youth not in work or study", (slug) => ser(slug, KEY.neet("t"))],
  ["Own-account and family workers", (slug) => ownFam(slug)],
];
// India's four measures live in different bundles; the peers' in one each
const INDIA = [ser(EAP, KEY.lfpr("f")), ser(UNE, KEY.ur("t", "y15_24")), ser(EET, KEY.neet("t")), ownFam(EMP)];
const from91 = (P) => P.filter(([d, v]) => v != null && yearOf(d) >= 1991);
const PEERLAST = (j, g) => lastP(from91(g === "ind" ? INDIA[j] : PANELS[j][1](peerB(g))));
export function peers() {
  return figure({
    bare: true, file: "india-atlas_ilo-peers",
    label: "India (blue) and China, Bangladesh, Indonesia and Vietnam (grey) on four ILO measures, 1991 onwards, per cent; India's latest: " + PANELS.map(([n], j) => `${n} ${p1(PEERLAST(j, "ind")[1])}`).join("; "),
    data: tbl(["measure", "country", "year", "value"], PANELS.flatMap(([n, get], j) => [...PEERS, ["ind", "India"]].flatMap(([g, name]) => from91(g === "ind" ? INDIA[j] : get(peerB(g))).map(([d, v]) => [n, name, yearOf(d), v])))),
    draw: (width) => K.multiples({ width, cols: width < 520 ? 2 : 4, unit: PCT, tFmt: (d) => d.slice(0, 4), domain: { lo: 0, hi: 100, ticks: [0, 25, 50, 75, 100] },
      key: [{ name: "India", role: "lead" }, { name: "China, Bangladesh, Indonesia, Vietnam", role: "ctx2" }],
      panels: PANELS.map(([name, get], j) => ({ name, highlight: true, lines: [...PEERS.map(([g]) => ({ data: from91(get(peerB(g))), role: "ctx2" })), { data: from91(INDIA[j]), role: "lead" }] })) }),
  });
}
const OPW = (slug) => ser(slug, KEY.opw);
const usd = (v) => "$" + fmt.inr(v);
export function output() {
  const ind = OPW("ilo-est-gdp-211p"), ly = yearOf(lastP(ind)[0]);
  return figure({
    bare: true, file: "india-atlas_ilo-output-per-worker",
    label: `GDP per employed person, constant 2021 international dollars (PPP), ILO modelled estimates: India ${usd(lastP(ind)[1])} in ${ly}; ` + PEERS.map(([g, n]) => `${n} ${usd(lastP(OPW(peerB(g)))[1])}`).join(", "),
    draw: yrLine({ unit: { prefix: "$" }, endFormat: usd, hoverDp: 0, height: 400, zero: true, tDomain: [yearOf(firstP(ind)[0]), ly],
      series: [...PEERS.map(([g, n]) => ({ name: n, data: OPW(peerB(g)).filter(([d]) => yearOf(d) >= yearOf(firstP(ind)[0])), role: "ctx2" })), { name: "India", data: ind, role: "lead" }] }),
  });
}

/* ---------- the figures the page quotes (ids kept from the retired client) ---------- */
export function numbers() {
  const T = {};
  const empS = ser(EMP, KEY.emp()), empL = lastP(empS), lf = lastP(LF("t")), lfw = lastP(LF("f")), lfw91 = firstP(LF("f"));
  const nt = lastP(NE("f")), ntT = lastP(NE("t"));
  T["m-latest"] = String(yearOf(lf[0]));
  T["n-emp"] = mn(empL[1]) + pc(" million");
  T["d-emp"] = `<b>${mn(firstP(empS)[1])} million</b> in ${yearOf(firstP(empS)[0])}`;
  T["n-lfpr"] = lf[1].toFixed(1) + pc("%");
  T["d-lfpr"] = `<b>${fmt.pct1(atY(LF("t"), 2000))}</b> in 2000`;
  T["n-women"] = lfw[1].toFixed(1) + pc("%");
  T["d-women"] = `<b>${fmt.pct1(lfw91[1])}</b> in ${yearOf(lfw91[0])}; men ${fmt.pct1(lastP(LF("m"))[1])}`;
  T["n-neet"] = nt[1].toFixed(1) + pc("%");
  T["d-neet"] = `young women aged 15 to 24; <b>${fmt.pct1(ntT[1])}</b> of all youth`;
  T["rb-emp"] = mn(empL[1]) + pc(" million");
  T["rb-lfpr"] = lf[1].toFixed(1) + pc("%");
  T["cr-emp"] = mn(empL[1]) + " million";
  T["cr-lfpr"] = fmt.pct1(lf[1]);
  // § 02
  const lw = LF("f"), low = nn(lw).filter(([d]) => yearOf(d) >= 2005).reduce((a, p) => (p[1] < a[1] ? p : a));
  T["pv-lfpr"] = p1(lastP(lw)[1]);
  T["ex-lfpr-low"] = `${p1(low[1])} in ${yearOf(low[0])}`;
  T["ex-lfpr-peak"] = `${p1(atY(lw, 2005))}`;
  T["ex-lfpr-now"] = p1(lastP(lw)[1]);
  // § 03
  const psss = mospi("lfpr_psss"), cws = mospi("lfpr_cws");
  T["pv-rulers"] = fmt.pt1(lastP(psss)[1] - lastP(cws)[1]);
  T["ex-r-psss"] = p1(lastP(psss)[1]);
  T["ex-r-cws"] = p1(lastP(cws)[1]);
  T["ex-r-ilo"] = p1(atY(ser("ilo-plfs-eap", sk("t")), 2024));
  T["ex-r-est"] = p1(atY(LF("t"), 2024));
  // § 04
  const all = ser(UNE, UK), b0 = BAND.find(([d]) => yearOf(d) === 2000) ?? BAND[0];
  T["pv-unemp"] = p1(lastP(all)[1]);
  T["ex-u-flat"] = p1(atY(all, 2000));
  T["ex-u-band"] = `${p1(b0[1])} to ${p1(b0[2])}`;
  T["ex-u-first"] = String(FIRST_REAL);
  T["ex-u-now"] = p1(lastP(all)[1]);
  T["ex-u-youth"] = p1(lastP(ser(UNE, UY))[1]);
  const nv = nn(ser("ilo-nss-une", KEY.sUr("t"))).map((p) => p[1]);
  T["ex-u-nss"] = `between ${p1(Math.min(...nv))} and ${p1(Math.max(...nv))}`;
  // § 05
  T["pv-women-age"] = `${p1(AGE_PK.v)}`;
  T["ex-wa-peak"] = `${AGE_PK.name}, ${p1(AGE_PK.v)}`;
  T["ex-wa-young"] = p1(AGE[1].v);
  T["ex-wa-young0"] = p1(AGE[1].was);
  T["pv-women-edu"] = p1(EDU[2].v);
  T["ex-we-low"] = p1(EDU[0].v);
  T["ex-we-mid"] = p1(EDU[2].v);
  T["ex-we-high"] = p1(EDU[3].v);
  const rur = GEO("f", "rur"), urb = GEO("f", "urb");
  T["pv-women-area"] = p1(lastP(rur)[1]);
  T["ex-wr-rur0"] = p1(firstP(rur)[1]);
  T["ex-wr-rur"] = p1(lastP(rur)[1]);
  T["ex-wr-urb0"] = p1(firstP(urb)[1]);
  T["ex-wr-urb"] = p1(lastP(urb)[1]);
  // § 06
  T["pv-neet"] = p1(lastP(NE("f"))[1]);
  T["ex-n-f0"] = p1(firstP(NE("f"))[1]);
  T["ex-n-f"] = p1(lastP(NE("f"))[1]);
  T["ex-n-m"] = p1(lastP(NE("m"))[1]);
  T["ex-n-num"] = mn(lastP(ser(EET, "eip_2eet_sex_nb__sex_t"))[1]) + " million";
  T["ex-n-plfs"] = p1(lastP(ser("ilo-plfs-sdg", KEY.sNeet("f")))[1]);
  // § 07-08
  T["pv-status"] = p1(lastP(STATUS[1].data)[1]);
  T["ex-s-emp0"] = p1(firstP(STATUS[1].data)[1]);
  T["ex-s-emp"] = p1(lastP(STATUS[1].data)[1]);
  T["ex-s-own"] = p1(lastP(STATUS[0].data)[1]);
  T["ex-s-fam"] = p1(lastP(STATUS[2].data)[1]);
  const agr = SECTOR[0].data, alow = nn(agr).reduce((a, p) => (p[1] < a[1] ? p : a));
  T["pv-sector"] = p1(lastP(agr)[1]);
  T["ex-e-agr0"] = p1(firstP(agr)[1]);
  T["ex-e-low"] = `${p1(alow[1])} in ${yearOf(alow[0])}`;
  T["ex-e-agr"] = p1(lastP(agr)[1]);
  // § 09
  T["pv-informal"] = p1(INFR[0].v);
  T["ex-i-tot"] = p1(INFR[0].v);
  T["ex-i-tot0"] = p1(INFR[0].was);
  T["ex-i-ser"] = p1(INFR[3].v);
  T["ex-i-agr"] = p1(INFR[1].v);
  // § 10
  const ex = CLA("cat1"), mod = CLA("cat2"), c1 = ser(EMP, KEY.cla("cat1")), tot = ser(EMP, KEY.cla("total"));
  T["pv-poverty"] = lastP(ex)[1].toFixed(1) + " mn";
  T["ex-p-ex0"] = `${firstP(ex)[1].toFixed(0)} million`;
  T["ex-p-ex0s"] = p1((100 * firstP(c1)[1]) / firstP(tot)[1]);
  T["ex-p-ex"] = `${lastP(ex)[1].toFixed(0)} million`;
  T["ex-p-exs"] = p1((100 * lastP(c1)[1]) / lastP(tot)[1]);
  T["ex-p-mod"] = `${lastP(mod)[1].toFixed(0)} million`;
  // § 11
  const ls = ser("ilo-est-lap-2gdp", KEY.lshare);
  T["pv-lshare"] = p1(lastP(ls)[1]);
  T["ex-ls-0"] = p1(firstP(ls)[1]);
  T["ex-ls"] = p1(lastP(ls)[1]);
  T["pv-deciles"] = p1(DEC[9].v);
  T["ex-d-top"] = p1(DEC[9].v);
  T["ex-d-top0"] = p1(DEC[9].was);
  T["ex-d-bottom"] = p1(DEC.slice(0, 5).reduce((a, r) => a + r.v, 0));
  // § 12-13
  T["pv-hours"] = lastP(HR("t"))[1].toFixed(1) + " h";
  T["ex-h-f"] = lastP(HR("f"))[1].toFixed(1);
  T["ex-h-m"] = lastP(HR("m"))[1].toFixed(1);
  T["ex-h-f0"] = atY(HR("f"), 2019).toFixed(1);
  T["pv-earn"] = rs(lastP(ER("t"))[1]);
  T["ex-er-t"] = rs(lastP(ER("t"))[1]);
  T["ex-er-t0"] = rs(firstP(ER("t"))[1]);
  T["ex-er-ratio"] = p1((100 * lastP(ER("f"))[1]) / lastP(ER("m"))[1]);
  T["ex-er-gap"] = p1(lastP(ser("ilo-plfs-ear", "ear_ggap_ocu_rt__ocu_skill_total"))[1]);
  // § 14
  const iw = PEERLAST(0, "ind");
  T["pv-peers"] = p1(iw[1]);
  for (const [g] of PEERS) T["ex-pw-" + g] = p1(PEERLAST(0, g)[1]);
  T["ex-pw-ind"] = p1(iw[1]);
  const opI = OPW("ilo-est-gdp-211p"), opC = OPW(peerB("chn"));
  T["pv-output"] = usd(lastP(opI)[1]);
  T["ex-o-ind0"] = usd(firstP(opI)[1]);
  T["ex-o-ind"] = usd(lastP(opI)[1]);
  T["ex-o-chn"] = usd(lastP(opC)[1]);
  T["ex-o-chn0"] = usd(firstP(opC)[1]);
  T["prov-vintage"] = load(EAP).meta.vintage;
  T["prov-vintage2"] = load(EAP).meta.vintage;
  return T;
}
