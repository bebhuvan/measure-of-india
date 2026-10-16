// Higher education guide (AISHE): the plates, drawn at build time with the chart kit (src/kit/),
// and the page's numbers, computed from the same bundles. Each plate export returns a bare figure
// for its .plotzone; titles, source lines and buttons stay in src/pages/guides/aishe.astro.
// Five survey rounds, 2017-18 to 2021-22, dated 1 April (freq 'fy'). Enrolment counts enrolments,
// not distinct students; GER divides by a population projection. Counts are shown in lakh or
// crore for reading only; nothing is written back to the data.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import headline from "../../data/series/aishe-headline.json";
import access from "../../data/series/aishe-access.json";
import composition from "../../data/series/aishe-composition.json";
import states from "../../data/series/aishe-states.json";
import teachers from "../../data/series/aishe-teachers.json";
import minority from "../../data/series/aishe-minority.json";
import ptrB from "../../data/series/aishe-ptr.json";
import stTeachers from "../../data/series/aishe-states-teachers.json";
import stEnrol from "../../data/series/aishe-states-enrolment.json";
import stInst from "../../data/series/aishe-states-institutions.json";

/* ---------- formatters (the text the client used to print, unchanged) ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtIN = (n) => Math.round(n).toLocaleString("en-IN");
const fy = (d) => `${d.slice(0, 4)}-${String((+d.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
const croreN = (n, dp = 2) => (n / 1e7).toFixed(dp);
const lakhOf = (n, dp = 1) => (n / 1e5).toFixed(dp);
const countShort = (n) => (n >= 1e5 ? lakhOf(n) + " lakh" : (Math.round(n / 1000) * 1000).toLocaleString("en-IN"));
const countWords = (n) => (n >= 1e7 ? croreN(n) + " crore" : n >= 1e5 ? lakhOf(n) + " lakh" : fmtIN(n));
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));
const arrowPt = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt";

// a series as the client saw it: [{date, value}], raw (unrounded) values
const ser = (b, k) => ({ data: b.dates.map((date, i) => ({ date, value: b.series[k].data[i] ?? null })) });
const nn = (s) => s.data.filter((d) => d.value != null);
const last = (s) => nn(s).at(-1).value;
const prevV = (s) => nn(s).at(-2).value;
const firstV = (s) => nn(s)[0].value;
const H = Object.fromEntries(Object.keys(headline.series).map((k) => [k, ser(headline, k)]));
const A = Object.fromEntries(Object.keys(access.series).map((k) => [k, ser(access, k)]));
const C = Object.fromEntries(Object.keys(composition.series).map((k) => [k, ser(composition, k)]));
const MN = Object.fromEntries(Object.keys(minority.series).map((k) => [k, ser(minority, k)]));

const PCT = { suffix: "%" };
const FY = (d) => fy(d);
const csv = (cols, rows) => ({ cols, rows });

/* ---------- the cuts several plates and the numbers share ---------- */
const EDU = [["under_graduate", "Under Graduate"], ["post_graduate", "Post Graduate"], ["diploma", "Diploma"], ["integrated", "Integrated"], ["pg_diploma", "PG Diploma"], ["phd", "Ph.D."], ["certificate", "Certificate"], ["mphil", "M.Phil."]];
const SOC = [["social_others", "Others (residual)"], ["social_obc", "OBC"], ["social_sc", "Scheduled Caste"], ["social_st", "Scheduled Tribe"]];
const TOTAL = last(H.enrolment);
const eduSegs = EDU.map(([k, n]) => ({ k, n, v: last(C[k]) })).filter((d) => d.v != null && d.v > 0);
const socSegs = SOC.map(([k, n]) => ({ k, n, v: last(C[k]) })).filter((d) => d.v != null && d.v > 0);

const titled = (slug) => slug.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const stateName = (slug) => (slug === "dadra_nagar_haveli_and_daman_diu" ? "DNH & Daman & Diu" : titled(slug)).replace("Dnh", "DNH");
const aiGer = last(H.ger);
const gerRows = Object.entries(states.series).filter(([k]) => k.startsWith("ger_"))
  .map(([k, s]) => (s.data.at(-1) == null ? null : { state: stateName(k.slice(4)), ger: s.data.at(-1) })).filter(Boolean).sort((a, b) => b.ger - a.ger);
const enrRows = Object.entries(states.series).filter(([k]) => k.startsWith("enrolment_"))
  .map(([k, s]) => (s.data.at(-1) == null ? null : { state: stateName(k.slice(10)), enr: s.data.at(-1) })).filter(Boolean).sort((a, b) => b.enr - a.enr);

const FAC = [["professor", "Professor & Eq."], ["reader_associate", "Reader / Assoc."], ["lecturer_assistant", "Lecturer / Asst."], ["temporary", "Temporary"], ["demonstrator", "Demonstrator / Tutor"]];
const TL = teachers.dates.length - 1;
const facRows = FAC.map(([k, rank]) => {
  const male = teachers.series[k + "_male"].data[TL], female = teachers.series[k + "_female"].data[TL], both = teachers.series[k + "_both"].data[TL];
  return { rank, male, female, both, fshare: female / both };
});
const lecShare = teachers.series.lecturer_assistant_both.data[TL] / teachers.series.all_both.data[TL];

const GRP = [["muslims", "Muslims"], ["other_minority", "Other Minority"], ["ews", "EWS"], ["pwd", "Persons With Disability"]];
const ML = minority.dates.length - 1;
const minRows = GRP.map(([k, group]) => ({
  group, male: minority.series[k + "_male"]?.data[ML] ?? null, female: minority.series[k + "_female"]?.data[ML] ?? null, both: minority.series[k + "_both"]?.data[ML] ?? null,
})).filter((r) => r.both != null).map((r) => ({ ...r, fshare: r.female != null && r.both ? r.female / r.both : null }));

const LI = headline.dates.length - 1;
const stShort = (s) => ({ "Andaman & Nicobar Islands": "Andaman & Nicobar", "Dadra & Nagar Haveli and Daman & Diu": "DNH and Daman & Diu" })[s] || s;
const ptrRows = Object.entries(ptrB.series).filter(([k]) => k.endsWith("__ptr_regular_all") && !k.startsWith("all_india"))
  .map(([, s]) => ({ name: stShort(s.group), v: s.data[LI] })).filter((d) => d.v != null && d.v > 0).sort((a, c) => c.v - a.v);
const ptrAI = ptrB.series.all_india__ptr_regular_all.data[LI];

const share = (b, k, f, t) => { const a = b.series[k.replace(t, f)]?.data[LI], z = b.series[k]?.data[LI]; return a != null && z ? (a / z) * 100 : null; };
const womenRows = Object.entries(stTeachers.series).filter(([k]) => k.endsWith("__all_both") && !k.startsWith("all_india")).map(([k, s]) => {
  const st = k.slice(0, -"__all_both".length);
  return { name: stShort(s.group), v: share(stTeachers, k, "__all_female", "__all_both"), d: share(stEnrol, `${st}__grand_total_both`, "__grand_total_female", "__grand_total_both") };
}).filter((d) => d.v != null && d.d != null).sort((a, c) => a.v - c.v);
const aiT = share(stTeachers, "all_india__all_both", "__all_female", "__all_both"), aiS = share(stEnrol, "all_india__grand_total_both", "__grand_total_female", "__grand_total_both");

const colAll = Object.entries(stInst.series).filter(([k]) => k.endsWith("__colleges") && !k.startsWith("all_india"))
  .map(([k, s]) => ({ name: stShort(s.group), v: s.data[LI], u: stInst.series[k.replace("__colleges", "__universities")]?.data[LI] ?? null })).filter((d) => d.v != null).sort((a, c) => c.v - a.v);
const colTot = stInst.series.all_india__colleges.data[LI];
const colRows = colAll.slice(0, 20);

/* ---------- the page's numbers: id -> inner HTML, exactly as the client printed them ---------- */
export function numbers() {
  const N = {};
  const html = (id, h) => { N[id] = String(h); };
  const txt = (id, t) => { N[id] = esc(t); };
  html("n-enrol", croreN(last(H.enrolment)) + pc("crore"));
  html("d-enrol", `<b>${arrow(last(H.enrolment) - prevV(H.enrolment), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(H.enrolment.data.at(-2).date)}`);
  html("n-ger", last(H.ger).toFixed(1) + pc("%"));
  html("d-ger", `<b>${arrowPt(last(H.ger) - prevV(H.ger))}</b>`);
  html("n-gpi", last(H.gpi).toFixed(2));
  html("d-gpi", `<b>${arrow(last(H.gpi) - prevV(H.gpi), (v) => v.toFixed(2))}</b>, 1.0 is parity`);
  html("n-ptr", Math.round(last(H.ptr)));
  html("d-ptr", `<b>${arrow(last(H.ptr) - prevV(H.ptr), (v) => v.toFixed(1))}</b> students/teacher`);

  html("rb-enrol", croreN(last(H.enrolment)) + pc("crore"));
  html("rb-ger", last(H.ger).toFixed(1) + pc("%"));
  txt("rt-ratio", last(H.ger).toFixed(0));
  txt("cr-enrol", countWords(last(H.enrolment)));
  txt("cr-univ", fmtIN(last(H.universities)));
  txt("cr-coll", fmtIN(last(H.colleges)));
  txt("cr-teach", countWords(last(H.teachers)));
  html("cr-growth", ((last(H.enrolment) / firstV(H.enrolment) - 1) * 100).toFixed(0) + pc("%"));
  html("cr-enrol-first", countWords(firstV(H.enrolment)));
  html("cr-ger", last(H.ger).toFixed(1) + pc("%"));
  html("cr-ger-first", firstV(H.ger).toFixed(1) + pc("%"));
  txt("cr-gpi", last(H.gpi).toFixed(2));
  html("cr-fem-share", (last(A.enrolment_female) / last(H.enrolment) * 100).toFixed(0) + pc("%"));
  html("cr-sc-share", (last(C.social_sc) / last(H.enrolment) * 100).toFixed(0) + pc("%"));
  html("cr-st-share", (last(C.social_st) / last(H.enrolment) * 100).toFixed(0) + pc("%"));

  // § 03 composition
  const p = (k) => (last(C[k]) / TOTAL * 100).toFixed(1) + pc("%");
  html("pv-comp", (last(C.under_graduate) / TOTAL * 100).toFixed(0) + pc("%"));
  html("ex-c-ug", p("under_graduate")); html("ex-c-pg", p("post_graduate")); html("ex-c-dip", p("diploma")); html("ex-c-phd", p("phd"));
  html("ex-c-obc", p("social_obc")); html("ex-c-oth", p("social_others")); html("ex-c-sc", p("social_sc")); html("ex-c-st", p("social_st"));
  html("ex-c-scst", ((last(C.social_sc) + last(C.social_st)) / TOTAL * 100).toFixed(1) + pc("%"));

  // § 04 enrolment by gender
  html("pv-enrol", ((last(H.enrolment) / firstV(H.enrolment) - 1) * 100).toFixed(0) + pc("%"));
  html("ex-e-fem", countWords(last(A.enrolment_female)));
  html("ex-e-male", countWords(last(A.enrolment_male)));
  html("ex-e-femshare", (last(A.enrolment_female) / last(H.enrolment) * 100).toFixed(0) + pc("%"));
  html("ex-e-gap1", countWords(last(A.enrolment_male) - last(A.enrolment_female)));
  html("ex-e-gap0", countWords(firstV(A.enrolment_male) - firstV(A.enrolment_female)));
  txt("ex-e-gpi0", firstV(H.gpi).toFixed(2));
  txt("ex-e-gpi1", last(H.gpi).toFixed(2));

  // § 06 GER by social group
  const stGap = last(A.ger_all_both) - last(A.ger_st_both), scGap = last(A.ger_all_both) - last(A.ger_sc_both);
  html("pv-ger", stGap.toFixed(1) + pc(" pt"));
  txt("ex-g-all", last(A.ger_all_both).toFixed(1) + "%");
  txt("ex-g-sc", last(A.ger_sc_both).toFixed(1) + "%");
  txt("ex-g-st", last(A.ger_st_both).toFixed(1) + "%");
  txt("ex-g-stgap", stGap.toFixed(1));
  txt("ex-g-scgap", scGap.toFixed(1));

  // § 08 states
  const above = gerRows.filter((r) => r.ger >= aiGer).length, spread = gerRows[0].ger - gerRows.at(-1).ger;
  const enrTotal = enrRows.reduce((a, r) => a + r.enr, 0), enrTop3 = enrRows.slice(0, 3).reduce((a, r) => a + r.enr, 0) / enrTotal * 100;
  html("pv-states", spread.toFixed(0) + pc(" pt"));
  txt("ex-s-top", gerRows[0].state + ", " + gerRows[0].ger.toFixed(1) + "%");
  txt("ex-s-bot", gerRows.at(-1).state + ", " + gerRows.at(-1).ger.toFixed(1) + "%");
  txt("ex-s-above", String(above));
  txt("ex-s-n", String(gerRows.length));
  txt("ex-s-spread", spread.toFixed(0));
  txt("ex-se-top", enrRows[0].state);
  html("ex-se-topn", croreN(enrRows[0].enr) + pc(" cr"));
  html("ex-se-top3", enrTop3.toFixed(0) + pc("%"));

  // § 07 GER by gender
  const diff = last(A.ger_all_female) - last(A.ger_all_male), peakGpi = Math.max(...H.gpi.data.map((d) => d.value));
  html("pv-gergen", last(H.gpi).toFixed(2));
  txt("ex-gg-fem", last(A.ger_all_female).toFixed(1) + "%");
  txt("ex-gg-male", last(A.ger_all_male).toFixed(1) + "%");
  txt("ex-gg-diff", Math.abs(diff).toFixed(1));
  txt("ex-gg-gpi", last(H.gpi).toFixed(2));
  txt("ex-gg-peak", peakGpi.toFixed(2));

  // § 09 levels
  const g = Object.fromEntries(EDU.map(([k]) => [k, (last(C[k]) / firstV(C[k]) - 1) * 100]));
  html("pv-edu", (g.integrated >= 0 ? "+" : "") + g.integrated.toFixed(0) + pc("%"));
  html("ex-edu-ug", croreN(last(C.under_graduate)) + pc(" cr"));
  html("ex-edu-int-gain", Math.abs(g.integrated).toFixed(0) + pc("%"));
  html("ex-edu-mphil", Math.abs(g.mphil).toFixed(0) + pc("%"));
  html("ex-edu-phd", Math.abs(g.phd).toFixed(0) + pc("%"));

  // § 10 faculty
  const fs = (i) => (facRows[i].fshare * 100).toFixed(0) + pc("%");
  html("pv-fac", fs(0)); html("ex-fac-prof", fs(0)); html("ex-fac-read", fs(1)); html("ex-fac-lec", fs(2)); html("ex-fac-temp", fs(3)); html("ex-fac-dem", fs(4));
  html("ex-fac-lecn", (lecShare * 100).toFixed(0) + pc("%"));

  // § 11 minority
  const pwd = minRows.find((r) => r.group.startsWith("Persons"));
  html("pv-min", countWords(last(MN.muslims_both)));
  html("ex-min-mus", countWords(minRows[0].both));
  html("ex-min-musf", (minRows[0].fshare * 100).toFixed(0) + pc("%"));
  html("ex-min-om", countWords(minRows[1].both));
  html("ex-min-ews", countWords(minRows[2].both));
  html("ex-min-pwd", fmtIN(pwd.both));
  html("ex-min-pwdf", (pwd.fshare * 100).toFixed(0) + pc("%"));

  // § 12 PTR
  html("pv-ptr", String(Math.round(last(H.ptr))));
  txt("ex-ptr-now", String(Math.round(last(H.ptr))));
  txt("ex-ptr-first", String(Math.round(firstV(H.ptr))));
  html("ex-ptr-teach", countWords(last(H.teachers)));

  // § 13 states, closer
  html("pv-stptr", String(Math.round(ptrRows[0].v)));
  html("ex-stptr-hi", esc(`${ptrRows[0].name}, ${Math.round(ptrRows[0].v)}`));
  html("ex-stptr-lo", esc(`${ptrRows.at(-1).name}, ${Math.round(ptrRows.at(-1).v)}`));
  html("ex-stptr-ai", String(Math.round(ptrAI)));
  html("pv-stwomen", aiT.toFixed(0) + pc("%"));
  html("ex-stw-hi", esc(`${womenRows.at(-1).name}, ${womenRows.at(-1).v.toFixed(0)}%`));
  html("ex-stw-lo", esc(`${womenRows[0].name}, ${womenRows[0].v.toFixed(0)}%`));
  html("ex-stw-ai", aiT.toFixed(0) + "%");
  html("ex-stw-ais", aiS.toFixed(0) + "%");
  html("pv-stcol", colTot.toLocaleString("en-IN"));
  txt("ex-stc-n1", colRows[0].name);
  html("ex-stc-v1", colRows[0].v.toLocaleString("en-IN"));
  html("ex-stc-s1", ((colRows[0].v / colTot) * 100).toFixed(0) + "%");
  html("ex-stc-univ", fmtIN(last(H.universities)));
  html("ex-stc-univ0", fmtIN(firstV(H.universities)));

  txt("prov-vintage", headline.meta.vintage);
  txt("prov-vintage2", headline.meta.vintage);
  return N;
}

/* ---------- § 02 the register of series: rows with a build-time sparkline ---------- */
export function ledger() {
  const rows = [
    ["enrolment", "Estimated student enrolment", "AISHE, count, Both, Grand Total", "s-acc", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
    ["universities", "Universities", "AISHE, count", "s-g1", fmtIN, fmtIN],
    ["colleges", "Colleges", "AISHE, count", "s-g2", fmtIN, fmtIN],
    ["teachers", "Teachers", "AISHE, count, all posts", "s-g3", countWords, countWords],
    ["ger", "Gross Enrolment Ratio", "AISHE, %, All Categories, Both", "s-acc", (v) => v.toFixed(1) + "%", (v) => v.toFixed(1) + " pt"],
    ["gpi", "Gender Parity Index", "AISHE, index, All Categories, 1.0 = parity", "s-g1", (v) => v.toFixed(2), (v) => v.toFixed(2)],
    ["ptr", "Pupil-Teacher Ratio", "AISHE, ratio, all institutions", "s-g4", (v) => String(Math.round(v)), (v) => v.toFixed(1)],
  ];
  return rows.map(([k, nm, sub, sw, fV, fD]) => {
    const data = nn(H[k]);
    return `
  <tr>
    <td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td>
    <td class="val">${fV(data.at(-1).value)}</td>
    <td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)}, vs ${fy(data.at(-2).date)}</td>
    <td class="yr">${fV(data[0].value)}, ${fy(data[0].date)}</td>
    <td class="spark">${K.spark(pairs(headline, k), { width: 190, height: 44 })}</td>
  </tr>`;
  }).join("");
}

/* ---------- plates ---------- */
const part = (t) => `<p style="margin:0 0 6px;font:600 .875rem/1.3 var(--ak-sans);color:var(--ak-ink)">${esc(t)}</p>`;
// two charts in one plate: the first figure answers the plate's buttons (its CSV carries both);
// the second sits in its own <figure>, so the plate's buttons do not reach it
const pair = (la, a, lb, b) => `${part(la)}${a}<figure style="margin:30px 0 0">${part(lb)}${b}</figure>`;

/** §03: what they study and who they are, as shares of the 2021-22 enrolment. */
export function comp() {
  const sh = (v) => Math.round(v / TOTAL * 1000) / 10;
  const edu = eduSegs.map((d) => ({ name: d.n, value: sh(d.v), note: countWords(d.v), highlight: d.k === "under_graduate" }));
  const soc = socSegs.map((d) => ({ name: d.n, value: sh(d.v), note: countWords(d.v), highlight: d.k === "social_sc" || d.k === "social_st" }));
  const one = (rows, file, label, data) => figure({ bare: true, file, label, data, draw: (width) => K.bars({ width, rows, unit: PCT, dp: 1 }) });
  return pair("By level of study", one(edu, "india-atlas_aishe_composition_2021-22",
    `Enrolment by level of study, shares of the 2021-22 total: under-graduate ${sh(last(C.under_graduate))} per cent, post-graduate ${sh(last(C.post_graduate))}, Ph.D. ${sh(last(C.phd))}`,
    csv(["Cut", "Group", "Enrolment 2021-22", "Share, %"], [
      ...eduSegs.map((d) => ["Level of study", d.n, Math.round(d.v), +(d.v / TOTAL * 100).toFixed(2)]),
      ...socSegs.map((d) => ["Social group", d.n, Math.round(d.v), +(d.v / TOTAL * 100).toFixed(2)]),
    ])),
  "By social group", one(soc, "india-atlas_aishe_social-group_2021-22",
    `Enrolment by social group, shares of the 2021-22 total: OBC ${sh(last(C.social_obc))} per cent, Others (residual) ${sh(last(C.social_others))}, Scheduled Caste ${sh(last(C.social_sc))}, Scheduled Tribe ${sh(last(C.social_st))}`, null));
}

const crore = (b, k) => pairs(b, k, { round: false }).map(([d, v]) => [d, v == null ? null : Math.round(v / 1e5) / 100]);

/** §04: enrolment by gender, crore. */
export function enrol() {
  const f = crore(access, "enrolment_female"), m = crore(access, "enrolment_male");
  return figure({
    bare: true, file: "india-atlas_aishe_enrolment-by-gender_2017-2021",
    label: `Estimated student enrolment by gender, 2017-18 to 2021-22: women rose from ${f[0][1]} to ${f.at(-1)[1]} crore, men from ${m[0][1]} to ${m.at(-1)[1]} crore; men outnumber women in every round`,
    data: csv(["Year", "Female enrolment", "Male enrolment"], headline.dates.map((d, i) => [fy(d), Math.round(access.series.enrolment_female.data[i]), Math.round(access.series.enrolment_male.data[i])])),
    draw: (width) => K.line({
      width, freq: "fy", unit: { suffix: " crore" }, hoverDp: 2, endFormat: (v) => v.toFixed(2) + " crore", zero: false,
      series: [{ name: "Men", data: m, role: "ctx" }, { name: "Women", data: f, role: "lead" }],
    }),
  });
}

/** §06: GER by social group; the ST gap is the story. */
export function ger() {
  const all = pairs(access, "ger_all_both"), sc = pairs(access, "ger_sc_both"), st = pairs(access, "ger_st_both");
  return figure({
    bare: true, file: "india-atlas_aishe_ger-by-social-group_2017-2021",
    label: `Gross Enrolment Ratio by social group, 2017-18 to 2021-22: all categories end at ${all.at(-1)[1]} per cent, Scheduled Caste at ${sc.at(-1)[1]}, Scheduled Tribe at ${st.at(-1)[1]}; the ordering held in every round`,
    data: csv(["Year", "GER, all categories", "GER, Scheduled Caste", "GER, Scheduled Tribe"], all.map(([d, v], i) => [fy(d), v, sc[i][1], st[i][1]])),
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1, hoverDp: 1, zero: false,
      series: [
        { name: "Scheduled Caste", short: "SC", data: sc, role: "ctx" },
        { name: "Scheduled Tribe", short: "ST", data: st, role: "comp" },
        { name: "All categories", short: "All", data: all, role: "lead" },
      ],
    }),
  });
}

/** §07: GER by gender; the GPI is their ratio. */
export function gergen() {
  const f = pairs(access, "ger_all_female"), m = pairs(access, "ger_all_male");
  return figure({
    bare: true, file: "india-atlas_aishe_ger-by-gender_2017-2021",
    label: `Gross Enrolment Ratio by gender, 2017-18 to 2021-22: women's GER at or above men's throughout, ending at ${f.at(-1)[1]} per cent against ${m.at(-1)[1]}`,
    data: csv(["Year", "Female GER", "Male GER", "Gender Parity Index"], f.map(([d, v], i) => [fy(d), v, m[i][1], headline.series.gpi.data[i]])),
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1, hoverDp: 1, zero: false,
      series: [{ name: "Men", data: m, role: "ctx" }, { name: "Women", data: f, role: "lead" }],
    }),
  });
}

/** §08: GER by state against the All-India ratio, then enrolment by state. */
export function states_() {
  const enr = enrRows.map((r, i) => ({ name: r.state, value: r.enr / 1e5, highlight: i < 3 }));
  const g = figure({
    bare: true, file: "india-atlas_aishe_state-ger-enrolment_2021-22",
    label: `Gross Enrolment Ratio by state and union territory, 2021-22, against the All-India ${aiGer.toFixed(1)} per cent: ${gerRows[0].state} highest at ${gerRows[0].ger.toFixed(1)}, ${gerRows.at(-1).state} lowest at ${gerRows.at(-1).ger.toFixed(1)}`,
    data: csv(["State", "GER 2021-22, %", "Enrolment 2021-22"], gerRows.map((r) => { const e = enrRows.find((x) => x.state === r.state); return [r.state, +r.ger.toFixed(2), e ? Math.round(e.enr) : null]; })),
    draw: (width) => K.bars({ width, rows: gerRows.map((r) => ({ name: r.state, value: Math.round(r.ger * 10) / 10 })), unit: PCT, dp: 1, ref: { value: Math.round(aiGer * 10) / 10, label: `All India ${aiGer.toFixed(1)}%` } }),
  });
  const e = figure({
    bare: true, file: "india-atlas_aishe_state-enrolment_2021-22",
    label: `Estimated enrolment by state and union territory, 2021-22: ${enrRows[0].state} the largest at ${croreN(enrRows[0].enr)} crore, then ${enrRows[1].state} and ${enrRows[2].state}`,
    draw: (width) => K.bars({ width, rows: enr, unit: { suffix: " lakh" }, fmt: (v) => countWords(Math.round(v * 1e5)) }),
  });
  return pair("Gross Enrolment Ratio, per cent", g, "Estimated enrolment, lakh", e);
}

/** §09: enrolment by level of study, each panel on its own scale, in lakh. */
export function edu() {
  const cells = EDU.map(([k, name]) => ({ k, name, latest: last(C[k]), growth: (last(C[k]) / firstV(C[k]) - 1) * 100 })).sort((a, b) => b.latest - a.latest);
  const lk = (k) => pairs(composition, k, { round: false }).map(([d, v]) => [d, v == null ? null : Math.round(v) / 1e5]);
  const gw = (g) => { const r = Math.round(g); return r === 0 ? "no change" : (r > 0 ? "+" : "−") + Math.abs(r) + "% since 2017-18"; };
  return figure({
    bare: true, file: "india-atlas_aishe_enrolment-by-level_2017-2021",
    label: `Enrolment by level of study, 2017-18 to 2021-22, eight panels each on its own scale: under-graduate ${countWords(last(C.under_graduate))}; integrated programmes ${gw(cells.find((c) => c.k === "integrated").growth)}; M.Phil. ${gw(cells.find((c) => c.k === "mphil").growth)}`,
    data: csv(["Year", ...cells.map((c) => c.name)], composition.dates.map((d, i) => [fy(d), ...cells.map((c) => composition.series[c.k].data[i] ?? null)])),
    draw: (width) => K.multiples({
      width, shared: false, tFmt: FY, unit: { suffix: " lakh" }, vFmt: (v) => countWords(v * 1e5),
      panels: cells.map((c) => ({ name: c.name, sub: gw(c.growth), data: lk(c.k), highlight: c.k === "under_graduate" })),
    }),
  });
}


/** §10: women's share of each rank, senior to junior; the counts ride beside each bar. */
export function fac() {
  return figure({
    bare: true, file: "india-atlas_aishe_teachers-by-rank-gender_2021-22",
    label: `Women's share of teachers by faculty rank, 2021-22, senior to junior: professors ${(facRows[0].fshare * 100).toFixed(0)} per cent, readers and associate professors ${(facRows[1].fshare * 100).toFixed(0)}, lecturers and assistant professors ${(facRows[2].fshare * 100).toFixed(0)}, temporary ${(facRows[3].fshare * 100).toFixed(0)}, demonstrators and tutors ${(facRows[4].fshare * 100).toFixed(0)}`,
    data: csv(["Faculty rank", "Male", "Female", "Both", "Female share, %"], facRows.map((r) => [r.rank, Math.round(r.male), Math.round(r.female), Math.round(r.both), +(r.fshare * 100).toFixed(1)])),
    draw: (width) => K.bars({
      width, sort: false, unit: PCT, dp: 0, refFill: false, ref: { value: 50, label: "Parity, 50%" },
      rows: facRows.map((r, i) => ({ name: r.rank, value: Math.round(r.fshare * 1000) / 10, highlight: i === 0, note: `${countShort(r.female)} of ${countShort(r.both)}` })),
    }),
  });
}

/** §11: PWD and minority enrolment, with the women's share of each. */
export function min() {
  const rows = minRows.map((r) => ({ name: r.group, value: r.both / 1e5, note: r.fshare != null ? `${(r.fshare * 100).toFixed(0)}% women` : undefined }));
  return figure({
    bare: true, file: "india-atlas_aishe_minority-enrolment_2021-22",
    label: `Enrolment of Muslims, other minorities, EWS and persons with disability, 2021-22: Muslims ${countWords(minRows[0].both)}, ${(minRows[0].fshare * 100).toFixed(0)} per cent women; persons with disability ${fmtIN(minRows[3].both)}, ${(minRows[3].fshare * 100).toFixed(0)} per cent women`,
    data: csv(["Group", "Male", "Female", "Both", "Female share, %"], minRows.map((r) => [r.group, r.male, r.female, r.both, r.fshare != null ? +(r.fshare * 100).toFixed(1) : null])),
    draw: (width) => K.bars({ width, sort: false, rows, unit: { suffix: " lakh" }, fmt: (v) => countWords(Math.round(v * 1e5)) }),
  });
}

/** §12: the pupil-teacher ratio, five rounds. */
export function ptr() {
  const P = pairs(headline, "ptr");
  return figure({
    bare: true, file: "india-atlas_aishe_ptr_2017-2021",
    label: `Pupil-teacher ratio, all institutions, 2017-18 to 2021-22, from ${Math.round(P[0][1])} to ${Math.round(P.at(-1)[1])} students per teacher`,
    data: csv(["Year", "Pupil-teacher ratio"], P.map(([d, v]) => [fy(d), v])),
    draw: (width) => K.line({
      width, freq: "fy", hoverDp: 1, endFormat: (v) => String(Math.round(v)), zero: false,
      series: [{ name: "Students per teacher", data: P, role: "lead" }],
    }),
  });
}

/** §13: pupil-teacher ratio by state against All India. */
export function stptr() {
  return figure({
    bare: true, file: "india-atlas_aishe_ptr-by-state_2021-22",
    label: `Pupil-teacher ratio by state, regular students, 2021-22: ${ptrRows.slice(0, 3).map((d) => `${d.name} ${Math.round(d.v)}`).join(", ")}; lowest ${ptrRows.at(-1).name} ${Math.round(ptrRows.at(-1).v)}; All India ${Math.round(ptrAI)}`,
    data: csv(["State", "PTR, regular, all institutions", "PTR, regular and distance, all institutions"], ptrRows.map((d) => {
      const k = Object.keys(ptrB.series).find((k) => stShort(ptrB.series[k].group) === d.name && k.endsWith("__ptr_reg_dist_all"));
      return [d.name, d.v, k ? ptrB.series[k].data[LI] ?? null : null];
    })),
    draw: (width) => K.bars({ width, rows: ptrRows.map((d) => ({ name: d.name, value: d.v })), dp: 0, ref: { value: ptrAI, label: `All India ${Math.round(ptrAI)}` } }),
  });
}

/** §13: women's share of teachers and of students, by state. */
export function stwomen() {
  return figure({
    bare: true, file: "india-atlas_aishe_women-teachers-students-by-state_2021-22",
    label: `Women's share of college teachers and of students by state, 2021-22: lowest share of teachers ${womenRows[0].name} ${womenRows[0].v.toFixed(0)} per cent, highest ${womenRows.at(-1).name} ${womenRows.at(-1).v.toFixed(0)}; All India ${aiT.toFixed(0)} per cent of teachers and ${aiS.toFixed(0)} per cent of students`,
    data: csv(["State", "Women, share of teachers, %", "Women, share of students, %"], womenRows.map((d) => [d.name, +d.v.toFixed(2), +d.d.toFixed(2)])),
    draw: (width) => K.dumbbell({
      width, sortBy: "none", labelAll: true, aColor: K.C.ink2, keys: { a: "Share of students", b: "Share of teachers" }, unit: PCT, dp: 0,
      rows: womenRows.map((d) => ({ name: d.name, a: Math.round(d.d * 10) / 10, b: Math.round(d.v * 10) / 10 })),
    }),
  });
}

/** §13: colleges by state, the twenty with the most. */
export function stcol() {
  return figure({
    bare: true, file: "india-atlas_aishe_colleges-by-state_2021-22",
    label: `Colleges by state, 2021-22, the twenty with the most: ${colRows.slice(0, 3).map((d) => `${d.name} ${d.v.toLocaleString("en-IN")}`).join(", ")}; ${colTot.toLocaleString("en-IN")} in all India`,
    data: csv(["State", "Colleges", "Universities"], colAll.map((d) => [d.name, d.v, d.u])),
    draw: (width) => K.bars({ width, rows: colRows.map((d, i) => ({ name: d.name, value: d.v, highlight: i === 0 })), dp: 0 }),
  });
}
