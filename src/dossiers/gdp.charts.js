// National Accounts guide: the plates, drawn at build time with the chart kit (src/kit/). Each
// export returns a bare figure for a plate's .plotzone; the plate's title, source line and
// buttons stay in src/pages/guides/gdp.astro. Quarterly and annual growth rates come rounded to
// the published precision (src/kit/data.js); the deep accounts (shares, sectors, revisions) are
// read as published, so a chart's figure and the page's figure are the same arithmetic.
// Rulers (the NSO back series, base 2011-12, base 2022-23) are separate series, never joined.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import gdpB from "../../data/series/gdp.json";
import expB from "../../data/series/gdp-expenditure.json";
import accB from "../../data/series/gdp-accounts.json";
import indB from "../../data/series/gdp-industries.json";
import nomB from "../../data/series/gdp-nominal.json";
import nbB from "../../data/series/gdp-2022.json";
import nbIndB from "../../data/series/gdp-2022-industries.json";
import backB from "../../data/series/gdp-back.json";
import nbAccB from "../../data/series/gdp-2022-accounts.json";
import sh11 from "../../data/series/gdp-annual-shares.json";
import sh22 from "../../data/series/gdp-2022-annual-shares.json";
import shBack from "../../data/series/gdp-back-shares.json";
import qs11 from "../../data/series/gdp-quarterly-shares.json";
import qs22 from "../../data/series/gdp-2022-quarterly-shares.json";
import sec11 from "../../data/series/gdp-sectors.json";
import sec22 from "../../data/series/gdp-2022-sectors.json";
import sub11 from "../../data/series/gdp-annual-subindustries.json";
import sub22 from "../../data/series/gdp-2022-annual-subindustries.json";
import rev11 from "../../data/series/gdp-revisions.json";
import rev22 from "../../data/series/gdp-2022-revisions.json";
import ind11 from "../../data/series/gdp-annual-industries.json";
import ind22 from "../../data/series/gdp-2022-annual-industries.json";
import indBack from "../../data/series/gdp-back-industries.json";

const PCT = { suffix: "%" };
const MINUS = "−";
export const pct1 = (v) => (v < 0 ? MINUS : "") + Math.abs(v).toFixed(1) + "%";
/** fiscal quarter of a quarter-start date: 2016-04-01 -> "Q1 FY17", 2017-01-01 -> "Q4 FY17" */
export const fq = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); const q = m === 4 ? 1 : m === 7 ? 2 : m === 10 ? 3 : 4; return `Q${q} FY${String(q === 4 ? y : y + 1).slice(2)}`; };
/** fiscal year of a 1 April date: 2012-04-01 -> "2012-13" */
export const fyL = (iso) => `${iso.slice(0, 4)}-${String((+iso.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
const nn = (P) => P.filter((p) => p[1] != null);
const maxOf = (P) => nn(P).reduce((a, p) => (!a || p[1] > a[1] ? p : a), null); // the first of equal highs
const minOf = (P) => nn(P).reduce((a, p) => (!a || p[1] < a[1] ? p : a), null);
const COVID = { t: "2020-04-01", label: "COVID-19" };

/* ---- the deep accounts: the slices of the annual, sector, revision and back bundles the
 * plates draw, read as published (also the page's numbers: src/pages/guides/gdp.astro) ---- */
const pick = (b, keys) => ({ dates: b.dates, s: Object.fromEntries(keys.filter((k) => b.series[k]).map((k) => [k, b.series[k].data])) });
const SPEND = ["pfce", "gfcf", "gfce", "stocks", "valuables", "net_exports", "discrepancy"];
const INDS = ["agriculture", "mining", "manufacturing", "utilities", "construction", "trade_hotels", "transport", "finance", "realty", "public_admin", "other_services"];
const SECTS = ["households", "private_nfc", "private_fc", "public_nfc", "public_fc", "government"];
const secKeys = SECTS.flatMap((k) => [`saving_${k}_pct_gdp`, `gfcf_${k}_pct_gdp`]).concat(["saving_total_pct_gdp", "gfcf_total_pct_gdp"]);
// sub-industries: compound real growth over the whole 2011-12-base span, and shares at both ends
const subRows = Object.keys(sub11.series).filter((k) => k.endsWith("_constant")).map((k) => {
  const key = k.replace(/_constant$/, ""), c = sub11.series[k].data, n = c.length - 1;
  return { key, label: sub11.series[k].label.replace(/, GVA at constant prices$/, ""), group: sub11.series[k].group,
    cagr: Math.round((Math.pow(c[n] / c[0], 1 / n) - 1) * 1000) / 10, share0: sub11.series[`${key}_share`].data[0], share1: sub11.series[`${key}_share`].data[n] };
});
export const GD = {
  // the back series' investment share lives in gdp-back (gfcf_rate, from 1951-52): placed on the shares axis
  spend: { back: (() => { const b = pick(shBack, SPEND); b.s.gfcf = shBack.dates.map((d) => { const i = backB.dates.indexOf(d); return i < 0 ? null : backB.series.gfcf_rate.data[i]; }); return b; })(), b11: pick(sh11, SPEND), b22: pick(sh22, SPEND) },
  abroad: { back: pick(shBack, ["transfers_row", "primary_income_row"]), b11: pick(sh11, ["transfers_row", "primary_income_row"]), b22: pick(sh22, ["transfers_row", "primary_income_row"]) },
  disc: { q11: pick(qs11, ["discrepancy"]), q22: pick(qs22, ["discrepancy"]) },
  sect: { b11: pick(sec11, secKeys), b22: pick(sec22, secKeys) },
  sub: { rows: subRows, from: sub11.dates[0], to: sub11.dates.at(-1), newTo: sub22.dates.at(-1) },
  rev: { b11: pick(rev11, ["fae", "sae", "pe", "fre", "sre", "tre", "final"].map((st) => `gdp_growth_${st}_real`)), b22: pick(rev22, ["pe", "fre", "final"].map((st) => `gdp_growth_${st}_real`)) },
  make: { back: pick(indBack, INDS.map((k) => `${k}_share`)), b11: pick(ind11, INDS.map((k) => `${k}_share`)), b22: pick(ind22, INDS.map((k) => `${k}_share`)) },
};
/** [[date, value]] of one key in a GD block, nulls kept (a gap is drawn as a gap) */
export const gp = (blk, k) => (blk?.s?.[k] ?? []).map((v, i) => [blk.dates[i], v ?? null]);

/* ---------------------------------------------------------------- quarterly lines */

/** §02: the 2022-23 base, where the quarterly series now continues. */
export function nb() {
  return figure({
    bare: true, file: "india-atlas_national-accounts_base2022-four-engines_fy24-fy26",
    label: "Real GDP growth on the 2022-23 base, quarter by quarter, with GVA, consumption and investment growth drawn in grey",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "GVA", data: pairs(nbB, "gva"), role: "ctx2" },
        { name: "Consumption, PFCE", short: "Consumption", data: pairs(nbB, "pfce"), role: "ctx" },
        { name: "Investment, GFCF", short: "Investment", data: pairs(nbB, "gfcf"), role: "ctx" },
        { name: "GDP", data: pairs(nbB, "gdp"), role: "lead" },
      ],
    }),
  });
}

/** §05: a decade on the 2011-12 base: the lockdown crash and the base-effect rebound. */
export function main() {
  const g = pairs(gdpB, "gdp"), crash = minOf(g);
  const reb = nn(g).filter(([d]) => d >= "2021-01-01" && d <= "2021-12-31").reduce((a, p) => (!a || p[1] > a[1] ? p : a), null);
  return figure({
    bare: true, file: "india-atlas_national-accounts_gdp-gva-pfce_fy17-fy26",
    label: "Real GDP, GVA and consumption growth, year-on-year, Q1 FY17 to Q2 FY26, the 2020 lockdown crash and the 2021 base-effect rebound marked, a dotted rule at a rough 6 per cent trend",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "GVA", data: pairs(gdpB, "gva"), role: "ctx2" },
        { name: "Consumption, PFCE", short: "Consumption", data: pairs(gdpB, "pfce"), role: "ctx" },
        { name: "GDP", data: g, role: "lead" },
      ],
      refs: [{ y: 6, label: "Rough pre-pandemic trend, 6%" }],
      events: [COVID],
      notes: [
        { d: crash[0], v: crash[1], text: `${pct1(crash[1])}\n${fq(crash[0])}, lockdown`, side: "right", below: true },
        { d: reb[0], v: reb[1], text: `${pct1(reb[1])}\n${fq(reb[0])}, base effect`, side: "right" },
      ],
    }),
  });
}

/** §07: one component a plate, its low and its high marked. */
function component(key, file, label) {
  const P = pairs(gdpB, key), pk = maxOf(P), tr = minOf(P);
  return figure({
    bare: true, file, label,
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [{ name: gdpB.series[key].label, data: P, role: "lead" }],
      notes: [
        { d: tr[0], v: tr[1], text: `${pct1(tr[1])}\n${fq(tr[0])}`, side: "left", below: true },
        { d: pk[0], v: pk[1], text: `${pct1(pk[1])}\n${fq(pk[0])}`, side: "right" },
      ],
    }),
  });
}
export const pfce = () => component("pfce", "india-atlas_national-accounts_pfce_fy17-fy26", "Private consumption growth, year-on-year, Q1 FY17 to Q2 FY26: the 2020 lockdown crash and the base-effect rebound marked");
export const gfcf = () => component("gfcf", "india-atlas_national-accounts_gfcf_fy17-fy26", "Investment growth, year-on-year, Q1 FY17 to Q2 FY26: a collapse of more than 40 per cent in Q1 FY21 and a rebound of more than 60 per cent, the widest swing in the accounts");
export const gva = () => component("gva", "india-atlas_national-accounts_gva_fy17-fy26", "GVA growth, year-on-year, Q1 FY17 to Q2 FY26, low and high marked");

/** §07: government consumption, exports and imports; imports lead (they subtract from GDP). */
export function exp() {
  return figure({
    bare: true, file: "india-atlas_national-accounts_gfce-exports-imports_fy17-fy26",
    label: "Government consumption, exports and imports growth, year-on-year, Q1 FY17 to Q2 FY26, imports drawn in blue",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "Government, GFCE", short: "Government", data: pairs(expB, "gfce"), role: "ctx2" },
        { name: "Exports", data: pairs(expB, "exports"), role: "ctx" },
        { name: "Imports", data: pairs(expB, "imports"), role: "lead" },
      ],
      events: [COVID],
    }),
  });
}

/** §09: nominal growth, real growth, and the deflator that is the gap between them. */
export function defl() {
  const d = pairs(nomB, "deflator"), pk = maxOf(d);
  return figure({
    bare: true, file: "india-atlas_national-accounts_nominal-real-deflator_fy17-fy26",
    label: "Nominal GDP, real GDP and the implied deflator, year-on-year, Q1 FY17 to Q2 FY26, the deflator's peak marked",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "Real GDP", short: "Real", data: pairs(nomB, "gdp_real"), role: "ctx" },
        { name: "Implied deflator", short: "Deflator", data: d, role: "comp" },
        { name: "Nominal GDP", short: "Nominal", data: pairs(nomB, "gdp_nominal"), role: "lead" },
      ],
      events: [COVID],
      notes: [{ d: pk[0], v: pk[1], text: `${pct1(pk[1])}\n${fq(pk[0])}, deflator peak`, side: "right", below: true, dy: 56 }],
    }),
  });
}

/* ---------------------------------------------------------------- engines and accounts */

/** §02 and §08: eight industry engines, each panel on its own scale; the fastest and the
 * slowest of the latest quarter in blue. */
function engines(B, file, baseLabel) {
  const keys = Object.keys(B.series), latest = Object.fromEntries(keys.map((k) => [k, pairs(B, k).at(-1)[1]]));
  const fastest = keys.reduce((a, k) => (latest[k] > latest[a] ? k : a)), slowest = keys.reduce((a, k) => (latest[k] < latest[a] ? k : a));
  const panels = keys.map((k) => ({ name: B.series[k].label, sub: `${B.shares[k].toFixed(1)}% of GVA`, data: pairs(B, k), highlight: k === fastest || k === slowest }));
  const P0 = pairs(B, keys[0]);
  return figure({
    bare: true, file,
    label: `Eight small line charts of quarterly real GVA growth by industry, ${baseLabel}, ${fq(P0[0][0])} to ${fq(P0.at(-1)[0])}, each on its own scale; the fastest, ${B.series[fastest].label}, and the slowest, ${B.series[slowest].label}, in blue`,
    data: { cols: ["Quarter", ...keys.map((k) => B.series[k].label)], rows: P0.map(([d], i) => [d, ...keys.map((k) => pairs(B, k)[i][1])]) },
    draw: (width) => K.multiples({ width, panels, unit: PCT, shared: false, tFmt: fq }),
  });
}
export const nbind = () => engines(nbIndB, "india-atlas_national-accounts_gva-by-industry_base2022", "base 2022-23");
export const ind = () => engines(indB, "india-atlas_national-accounts_gva-by-industry_fy17-fy26", "base 2011-12");

/** §10: six annual accounts, each panel on its own scale; subsidies, the wedge's other side, in blue. */
export function acc() {
  const P = [
    ["ndp", "Net domestic product", "GDP minus depreciation"],
    ["gni", "Gross national income", "GDP plus net income from abroad"],
    ["taxes", "Taxes on products", "One side of the GDP–GVA wedge"],
    ["subsidies", "Subsidies", "The other side of the wedge"],
    ["cfc", "Capital consumption", "Depreciation of the stock"],
    ["gcf_industry", "Capital formation", "Gross, all assets"],
  ];
  const D = accB.dates;
  return figure({
    bare: true, file: "india-atlas_national-accounts_annual-six-accounts",
    label: "Six small line charts of annual real growth: NDP, GNI, taxes on products, subsidies, capital consumption and capital formation, fiscal years, each on its own scale",
    data: { cols: ["Fiscal year", ...P.map((p) => p[1])], rows: D.map((d, i) => [fyL(d), ...P.map(([k]) => pairs(accB, k)[i][1])]) },
    draw: (width) => K.multiples({ width, unit: PCT, shared: false, tFmt: fyL,
      panels: P.map(([k, name, sub]) => ({ name, sub, data: pairs(accB, k), highlight: k === "subsidies" })) }),
  });
}

/** §10: the saving rate, a share of nominal GDP (saving exists at current prices only). */
export function sav() {
  const P = nn(pairs(accB, "saving_rate"));
  return figure({
    bare: true, file: "india-atlas_national-accounts_saving-rate",
    label: `Gross saving as a share of nominal GDP, ${fyL(P[0][0])} to ${fyL(P.at(-1)[0])}`,
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 1, zero: false,
      series: [{ name: "Gross saving, % of GDP", short: "Saving", data: P, role: "lead" }] }),
  });
}

/* ---------------------------------------------------------------- three rulers, side by side */

const RULERS = [["back", "NSO back series", "lead"], ["b11", "Base 2011–12", "ctx"], ["b22", "Base 2022–23", "ink"]];
function rulerGrid(src, panels, file, label, colsAt = null) {
  const P = panels.map(([k, name, sub]) => ({ name, sub,
    lines: RULERS.map(([r, , role]) => ({ role, data: gp(src[r], k) })).filter((l) => l.data.some((p) => p[1] != null)) })).filter((p) => p.lines.length);
  // the CSV: a row per fiscal year, a column per series and ruler, blanks where a ruler is silent
  const cols = panels.flatMap(([k, name]) => RULERS.filter(([r]) => gp(src[r], k).some((p) => p[1] != null)).map(([r, rl]) => ({ k, r, head: `${name}, ${rl}`, at: new Map(gp(src[r], k)) })));
  const dates = [...new Set(cols.flatMap((c) => [...c.at.keys()]))].sort();
  return figure({
    bare: true, file, label,
    data: { cols: ["Fiscal year", ...cols.map((c) => c.head)], rows: dates.map((d) => [fyL(d), ...cols.map((c) => c.at.get(d) ?? null)]) },
    draw: (width) => K.multiples({ width, panels: P, unit: PCT, shared: false, tFmt: fyL, ...(colsAt ? { cols: colsAt(width) } : {}), key: RULERS.map(([, name, role]) => ({ name, role })) }),
  });
}
export const spend = () => rulerGrid(GD.spend, [
  ["pfce", "Consumption", "Households' spending, PFCE"],
  ["gfcf", "Fixed investment", "Buildings, machines, roads, GFCF"],
  ["gfce", "Government consumption", "The state's own services, GFCE"],
  ["stocks", "Change in stocks", "Goods added to inventories"],
  ["valuables", "Valuables", "Gold, silver, jewellery"],
  ["net_exports", "Net exports", "Exports less imports"],
], "india-atlas_national-accounts_spending-shares_1950-2026",
"Six small line charts of spending as a share of GDP: consumption, fixed investment, government consumption, change in stocks, valuables and net exports, on the NSO back series and the two current bases, never joined");

export const abroad = () => rulerGrid(GD.abroad, [
  ["transfers_row", "Net current transfers from abroad", "Mostly remittances from Indians working abroad"],
  ["primary_income_row", "Net primary income from abroad", "Interest, profits and wages crossing the border"],
], "india-atlas_national-accounts_income-from-abroad_1950-2026",
"Two small line charts, shares of GDP since 1950-51: net current transfers from abroad, rising from near zero to about 3 per cent, and net primary income, below zero, on three rulers never joined",
(width) => (width < 520 ? 1 : 2)); // two long names: side by side on a desktop, stacked on a phone

export const make = () => rulerGrid(GD.make, [
  ["agriculture_share", "Agriculture", "Crops, livestock, forestry, fishing"],
  ["manufacturing_share", "Manufacturing", "Factories and workshops"],
  ["construction_share", "Construction", "Buildings, roads, works"],
  ["trade_hotels_share", "Trade, hotels, restaurants", "Shops, repair, eating out"],
  ["transport_share", "Transport and communication", "Rail, road, air, phones"],
  ["finance_share", "Financial services", "Banks, insurance"],
  ["realty_share", "Real estate and professional", "Dwellings, IT, consulting"],
  ["public_admin_share", "Public administration", "Government and defence"],
  ["other_services_share", "Other services", "Schools, hospitals, personal"],
  ["mining_share", "Mining", "Coal, oil, ores"],
  ["utilities_share", "Electricity, gas, water", "The utilities"],
], "india-atlas_national-accounts_industry-shares_1950-2026",
"Eleven small line charts of each industry's share of GVA since 1950-51, on the NSO back series and the two current bases, never joined. Agriculture falls from about half to under a fifth; services rise");

/** §11: the discrepancy, both bases, quarterly; the new base leads. */
export function disc() {
  return figure({
    bare: true, file: "india-atlas_national-accounts_discrepancy_quarterly",
    label: "The discrepancy between GDP and its spending components, share of GDP, quarterly, base 2011-12 in grey and base 2022-23 in blue, two separate series",
    draw: (width) => K.line({
      width, freq: "quarter", unit: PCT, endDp: 1,
      series: [
        { name: "Base 2011–12", short: "2011–12 base", data: gp(GD.disc.q11, "discrepancy"), role: "ctx" },
        { name: "Base 2022–23", short: "2022–23 base", data: gp(GD.disc.q22, "discrepancy"), role: "lead" },
      ],
    }),
  });
}

/** §12: who saves, who invests: one dumbbell per institutional sector. */
export function sect() {
  const src = GD.sect.b22, S = [["households", "Households"], ["private_nfc", "Private companies"], ["private_fc", "Private financial firms"], ["public_nfc", "Public-sector companies"], ["public_fc", "Public financial firms"], ["government", "General government"]];
  const hs = src.s.saving_households_pct_gdp; let li = hs.length - 1; while (li > 0 && hs[li] == null) li--;
  const year = fyL(src.dates[li]);
  const rows = S.map(([k, name]) => ({ name, b: src.s[`saving_${k}_pct_gdp`][li], a: src.s[`gfcf_${k}_pct_gdp`][li] }));
  return figure({
    bare: true, file: "india-atlas_national-accounts_saving-investment-by-sector_" + year,
    label: `Gross saving and fixed investment by institutional sector, share of GDP, ${year}: one row per sector, saving as a filled dot, investment as a ring`,
    data: { cols: ["Sector", `Gross saving, % of GDP, ${year}`, `Fixed investment, % of GDP, ${year}`], rows: rows.map((r) => [r.name, r.b, r.a]) },
    draw: (width) => K.dumbbell({ width, rows, keys: { a: "Fixed investment", b: "Gross saving" }, unit: PCT, labelAll: true, sortBy: "none",
      fmt: (v) => K.num(v, { dp: 1 }) }),
  });
}

/** §12: household and government saving, both bases; the old base faint. */
export function hh() {
  const s = (blk, k) => gp(blk, k);
  return figure({
    bare: true, file: "india-atlas_national-accounts_household-government-saving",
    label: "Household and government gross saving, share of GDP, base 2011-12 drawn faint and base 2022-23 strong, households in blue and government in red, never joined",
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1,
      series: [
        { name: "Households, base 2011–12", data: s(GD.sect.b11, "saving_households_pct_gdp"), role: "ctx", color: K.C.leadTint, label: false },
        { name: "Government, base 2011–12", data: s(GD.sect.b11, "saving_government_pct_gdp"), role: "ctx", color: K.C.compTint, label: false },
        { name: "Government, base 2022–23", short: "Government", data: s(GD.sect.b22, "saving_government_pct_gdp"), role: "comp" },
        { name: "Households, base 2022–23", short: "Households", data: s(GD.sect.b22, "saving_households_pct_gdp"), role: "lead" },
      ],
    }),
  });
}

/** §13: eighteen sub-industries ranked by compound real growth; the farm three in blue. */
export function sub() {
  const FARM = new Set(["crops", "livestock", "fishing"]);
  // the two names too long for the label column (the CSV keeps them whole)
  const SHORTN = { "Communication and broadcasting": "Communication, broadcasting", "Services incidental to transport": "Services to transport" };
  const rows = [...GD.sub.rows].sort((a, b) => b.cagr - a.cagr);
  const from = fyL(GD.sub.from), to = fyL(GD.sub.to);
  return figure({
    bare: true, file: "india-atlas_national-accounts_sub-industries_" + from + "_" + to,
    label: `Average annual real growth of GVA by sub-industry, ${from} to ${to}, ranked, each with its share of GVA in ${to}; crops, livestock and fishing in blue`,
    data: { cols: ["Sub-industry", `Average real growth a year, % (${from} to ${to})`, `Share of nominal GVA, % (${from})`, `Share of nominal GVA, % (${to})`], rows: rows.map((r) => [r.label, r.cagr, r.share0, r.share1]) },
    draw: (width) => K.bars({ width, unit: PCT, dp: 1,
      rows: rows.map((r) => ({ name: SHORTN[r.label] ?? r.label, value: r.cagr, highlight: FARM.has(r.key), note: `${r.share1.toFixed(1)}% of GVA` })) }),
  });
}

/** §14: each year's path from its first advance estimate; the largest moves up and down in blue. */
export const STAGES = [["fae", "First advance", "Adv 1"], ["sae", "Second advance", "Adv 2"], ["pe", "Provisional", "Prov"], ["fre", "First revised", "Rev 1"], ["sre", "Second revised", "Rev 2"], ["tre", "Third revised or final", "Rev 3"]];
export function revPaths() {
  const src = GD.rev.b11;
  const years = src.dates.map((d, i) => ({ d, i })).filter(({ i }) => src.s.gdp_growth_fae_real?.[i] != null);
  const paths = years.map(({ d, i }) => {
    const first = src.s.gdp_growth_fae_real[i];
    const steps = STAGES.map(([k, nm], j) => {
      const v = k === "tre" ? (src.s.gdp_growth_tre_real?.[i] ?? src.s.gdp_growth_final_real?.[i]) : src.s[`gdp_growth_${k}_real`]?.[i];
      return v == null ? null : { x: j, v, rev: v - first, stage: nm };
    }).filter(Boolean);
    return { fy: fyL(d), first, steps, last: steps.at(-1) };
  }).filter((p) => p.steps.length > 1);
  const up = paths.reduce((m, p) => (p.last.rev > m.last.rev ? p : m)), down = paths.reduce((m, p) => (p.last.rev < m.last.rev ? p : m));
  return { paths, up, down };
}
export function rev() {
  const { paths, up, down } = revPaths();
  const sgnPt = (v) => (v > 0 ? "+" : v < 0 ? MINUS : "") + Math.abs(v).toFixed(1) + " pt";
  const series = paths.map((p) => {
    const hl = p === up || p === down;
    return { name: p.fy, data: p.steps.map((s) => [s.x, Math.round(s.rev * 10) / 10]), role: hl ? "lead" : "ctx2", label: hl, hover: false };
  }).sort((a, b) => (a.role === "lead") - (b.role === "lead"));
  return figure({
    bare: true, file: "india-atlas_national-accounts_gdp-revisions_base2011",
    label: `How each year's real GDP growth moved from its first advance estimate, base 2011-12: ${paths.length} lines starting at zero; ${up.fy} (first ${up.first.toFixed(1)} per cent, now ${up.last.v.toFixed(1)}) and ${down.fy} (first ${down.first.toFixed(1)}, now ${down.last.v.toFixed(1)}) in blue`,
    data: { cols: ["Fiscal year", ...STAGES.map((s) => `Real GDP growth, %, ${s[1]}`)], rows: paths.map((p) => [p.fy, ...STAGES.map(([, nm]) => p.steps.find((s) => s.stage === nm)?.v ?? null)]) },
    draw: (width) => K.line({
      width, unit: { suffix: " pt" }, endFormat: sgnPt, hoverDp: 1,
      xTicks: STAGES.map(([, label, short], j) => ({ t: j, label, short })),
      series,
    }),
  });
}

/** §15: seventy-five years of growth, three rulers side by side, the back series leading. */
export function lh() {
  const back = pairs(backB, "gdp"), low = minOf(back);
  return figure({
    bare: true, file: "india-atlas_national-accounts_gdp-growth_back-series_1951-2026",
    label: `Real GDP growth by fiscal year, ${fyL(back[0][0])} on, on three separate rulers: the NSO back series in blue to ${fyL(back.at(-1)[0])}, then the 2011-12 and 2022-23 bases in grey, never joined; the deepest fall, ${pct1(low[1])} in ${fyL(low[0])}, marked`,
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1,
      series: [
        { name: "NSO back series, 2011–12 prices", data: back, role: "lead", label: false },
        { name: "Base 2011–12", short: "2011–12 base", data: nn(pairs(accB, "gdp")), role: "ctx" },
        { name: "Base 2022–23", short: "2022–23 base", data: nn(pairs(nbAccB, "gdp")), role: "ctx", color: K.C.ink2 },
      ],
      seam: { t: "2011-10-01", before: "NSO back series", after: "Today's bases" },
      notes: [{ d: low[0], v: low[1], text: `${pct1(low[1])}\n${fyL(low[0])}`, side: "right", below: true }],
    }),
  });
}

/** §15: saving and fixed investment on the back series. */
export function si() {
  return figure({
    bare: true, file: "india-atlas_national-accounts_saving-investment_back-series_1951-2012",
    label: "Gross saving in blue and fixed investment in red as shares of nominal GDP, NSO back series",
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 1,
      series: [
        { name: "Fixed investment", short: "Investment", data: nn(pairs(backB, "gfcf_rate")), role: "comp" },
        { name: "Gross saving", short: "Saving", data: nn(pairs(backB, "saving_rate")), role: "lead" },
      ],
    }),
  });
}

/** sparklines: the title block and the register (K.spark), from rounded series */
export const sparkOf = (bundle, key) => K.spark(nn(pairs(bundle, key)), { width: 150, height: 36 });
