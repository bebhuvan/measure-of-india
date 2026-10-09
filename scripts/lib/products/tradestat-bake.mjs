// scripts/lib/products/tradestat-bake.mjs: TradeStat's archived calls (data/raw/trade/) ->
// canonical bundles (data/series/trade-*.json). No network: everything here reads the archive
// written by tradestat.mjs's fetch phase, so a bake can be re-run and diffed freely.
//
// Which print a month takes. Every MEIDB call prints its own month (F, "Final") and the same
// month a year earlier (R, "Revised Final"). A month's value is the R print from the call a
// year later when that call exists, else the month's own F print; meta.revision records which.
// At HS 6 and 8 digits the R print is used only when both calls use the same HS edition
// (the April 2023 call lists HS 2022 codes, and its 2022 column is re-expressed in them):
// otherwise the F print stands, so no 6- or 8-digit series mixes two code lists.
// FTPA (principal commodities) prints only April-to-month cumulatives, flagged P
// ("Provisional") for the current year; monthly values are differences of consecutive
// cumulatives of the same year and print family (derived, labelled as such).

import fs from "node:fs";
import path from "node:path";
import { writeSeries } from "../util.mjs";
import { parseNumber } from "../tabular.mjs";
import { readRaw, rel, valueColumns, months, addMonths, FIRST_MONTH, FIRST_FTPA, RAW } from "./tradestat.mjs";

const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const iso = (mo) => `${mo}-01`;
const fyOf = (mo) => { const [y, m] = mo.split("-").map(Number); const s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };
const fyStartIso = (fy) => `${fy.slice(0, 4)}-04-01`;
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const HS_EDITIONS = [["2017-01", "HS 2017"], ["2023-04", "HS 2022"]];   // ITC-HS editions by the month their calls start using them
export const editionOf = (mo) => HS_EDITIONS.filter(([from]) => mo >= from).at(-1)[1];
const FLOW = { export: "exports", import: "imports" };
const UNIT = { usd: ["US$ million", "usd_million"], inr: ["₹ crore", "inr_crore"], qty: ["quantity", "quantity"] };

/* ---------------- labels ---------------- */
const SMALL = new Set(["and", "or", "of", "the", "for", "in", "on", "with", "by", "to", "a", "an", "not", "nes", "etc"]);
export function tidyDesc(s) {
  // TradeStat prints descriptions in capitals with customs abbreviations; we keep the words,
  // fix the case, and never paraphrase
  const t = String(s).replace(/^\*\s*/, "").replace(/\s+/g, " ").replace(/\s*\.\s*$/, "").trim().toLowerCase();
  return t.replace(/(^|[\s(/-])([a-z])/g, (m, p, c, i) => p + (i === 0 ? c.toUpperCase() : c))
    .replace(/\b(nes|n\.e\.s)\b/g, "n.e.s.").replace(/^./, (c) => c.toUpperCase());
}
const COUNTRY = {
  "U S A": "United States", "CHINA P RP": "China", "U ARAB EMTS": "United Arab Emirates", "U K": "United Kingdom", "SAUDI ARAB": "Saudi Arabia",
  "KOREA RP": "South Korea", "KOREA DP RP": "North Korea", "RUSSIA": "Russia", "HONG KONG": "Hong Kong", "NETHERLAND": "Netherlands",
  "BANGLADESH PR": "Bangladesh", "IRAN": "Iran", "IRAQ": "Iraq", "VIETNAM SOC REP": "Vietnam", "TAIWAN": "Taiwan", "SWITZERLAND": "Switzerland",
  "SOUTH AFRICA": "South Africa", "PHILIPPINES": "Philippines", "DOMINIC REP": "Dominican Republic", "CZECH REPUBLIC": "Czech Republic",
  "BOSNIA-HRZGOVIN": "Bosnia and Herzegovina", "PAPUA N GNA": "Papua New Guinea", "TRINIDAD": "Trinidad and Tobago", "UNSPECIFIED": "Unspecified",
  "YEMEN REPUBLC": "Yemen", "SRI LANKA DSR": "Sri Lanka", "EGYPT A RP": "Egypt", "LIBYA": "Libya", "SYRIA": "Syria", "MYANMAR": "Myanmar",
  "NEW ZEALAND": "New Zealand", "TANZANIA REP": "Tanzania", "CONGO D. REP.": "DR Congo", "CONGO P REP": "Republic of the Congo", "COTE D' IVOIRE": "Côte d'Ivoire",
  "EQUTL GUINEA": "Equatorial Guinea", "GUINEA BISSAU": "Guinea-Bissau", "CENTRAL AFRICAN REPUBLIC": "Central African Republic",
  "AMERI SAMOA": "American Samoa", "ANTARTICA": "Antarctica", "ANTIGUA": "Antigua and Barbuda", "BR VIRGN IS": "British Virgin Islands", "US VIRGIN IS": "US Virgin Islands",
  "TURKS C IS": "Turks and Caicos Islands", "CAYMAN IS": "Cayman Islands", "FALKLAND IS": "Falkland Islands", "FAROE IS.": "Faroe Islands", "WALLIS F IS": "Wallis and Futuna",
  "ST KITT N A": "Saint Kitts and Nevis", "ST LUCIA": "Saint Lucia", "ST VINCENT": "Saint Vincent and the Grenadines", "ST HELENA": "Saint Helena", "ST PIERRE": "Saint Pierre and Miquelon",
  "SAO TOME": "São Tomé and Príncipe", "SOLOMON IS": "Solomon Islands", "MARSHALL ISLAND": "Marshall Islands", "NORFOLK IS": "Norfolk Island", "COCOS IS": "Cocos Islands",
  "CHRISTMAS IS.": "Christmas Island", "COOK IS": "Cook Islands", "PITCAIRN IS.": "Pitcairn Islands", "HEARD MACDONALD": "Heard and McDonald Islands",
  "FR POLYNESIA": "French Polynesia", "FR GUIANA": "French Guiana", "FR S ANT TR": "French Southern Territories", "NETHERLANDANTIL": "Netherlands Antilles",
  "NEW CALEDONIA": "New Caledonia", "N. MARIANA IS.": "Northern Mariana Islands", "MACEDONIA": "North Macedonia", "KYRGHYZSTAN": "Kyrgyzstan",
  "TURKMENISTAN": "Turkmenistan", "UZBEKISTAN": "Uzbekistan", "TAJIKISTAN": "Tajikistan", "KAZAKHSTAN": "Kazakhstan", "TIMOR LESTE": "Timor-Leste",
  "MACAO": "Macao", "LAO PD RP": "Laos", "BRUNEI": "Brunei", "VANUATU REP": "Vanuatu", "VATICAN CITY": "Vatican City", "SERBIA": "Serbia",
  "GUADELOUPE": "Guadeloupe", "BAHARAIN IS": "Bahrain", "UNION OF SERBIA & MONTENEGRO": "Serbia and Montenegro", "SOUTH SUDAN": "South Sudan",
  "CANARY IS": "Canary Islands", "CHANNEL IS": "Channel Islands", "PUERTO RICO": "Puerto Rico", "GUINEA": "Guinea", "C AFRI REP": "Central African Republic",
  "BELARUS": "Belarus", "SEYCHELLES": "Seychelles", "MALDIVES": "Maldives", "NEPAL": "Nepal", "BHUTAN": "Bhutan", "PAKISTAN IR": "Pakistan", "AFGHANISTAN": "Afghanistan",
  "US MINOR OUTLYING ISLANDS": "US Minor Outlying Islands", "SINT MAARTEN (DUTCH PART)": "Sint Maarten", "CURACAO": "Curaçao", "MONTENEGRO": "Montenegro",
};
export const countryName = (s) => COUNTRY[s] ?? s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (m, p, c) => p + c.toUpperCase()).replace(/\bIs\b\.?/g, "Islands");
const ckey = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/* ---------------- parsing one call ---------------- */
const cache = new Map();
function call(root, file) {
  if (!cache.has(file)) cache.set(file, readRaw(root, file));
  return cache.get(file);
}
/** MEIDB commodity table -> { cols: {mPrev, mCur, cPrev, cCur}, items: Map(code -> {desc, unit, star, v:[mPrev, mCur, cPrev, cCur]}), total } */
function parseCommodity(raw, expectMonth) {
  if (!raw) return null;
  const vc = valueColumns(raw.header);
  if (vc.length !== 4) throw new Error(`tradestat bake: ${raw.view} ${JSON.stringify(raw.fields)}: expected 4 value columns, saw ${vc.length}`);
  const [mPrev, mCur, cPrev, cCur] = vc;
  const lab = `${M3[+expectMonth.slice(5, 7) - 1]}-${expectMonth.slice(0, 4)}`;
  if (mCur.label !== lab) throw new Error(`tradestat bake: ${raw.view} asked for ${lab}, the table is for ${mCur.label} (a call answered with the wrong month)`);
  const h = raw.header.at(-1);
  const iCode = h.findIndex((c) => /HS\s*Code/i.test(c)), iDesc = h.findIndex((c) => /Commodity/i.test(c)), iUnit = h.findIndex((c) => /^Unit$/i.test(c));
  const items = new Map(); let total = null;
  for (const r of raw.rows) {
    const v = [mPrev, mCur, cPrev, cCur].map((c) => parseNumber(r[c.i]));
    const code = (r[iCode] ?? "").trim();
    if (!code && /Total/i.test(r.join(" "))) { total = v; continue; }
    if (!/^\d{2,8}$/.test(code)) continue;
    const desc = r[iDesc] ?? "";
    items.set(code, { desc, star: /^\s*\*/.test(desc), unit: iUnit >= 0 ? (r[iUnit] || null) : null, v });
  }
  return { cols: { mPrev, mCur, cPrev, cCur }, items, total };
}

/* ---------------- monthly assembly ---------------- */
/** For one (flow, level, unit): Map(month -> { flag, items: Map(code -> {value, desc, unit, star}), total }) */
function monthlyPanel(root, flow, lvl, unit, latest, { sameEdition = false } = {}) {
  const out = new Map();
  const first = addMonths(FIRST_MONTH, -12);
  for (const mo of months(first, latest)) {
    const own = mo >= FIRST_MONTH ? parseCommodity(call(root, rel.cw(flow, lvl, unit, mo)), mo) : null;
    const nextMo = addMonths(mo, 12);
    let next = nextMo <= latest ? parseCommodity(call(root, rel.cw(flow, lvl, unit, nextMo)), nextMo) : null;
    if (next && sameEdition && editionOf(nextMo) !== editionOf(mo)) next = null;
    if (next && mo < FIRST_MONTH && sameEdition && editionOf(nextMo) !== editionOf(FIRST_MONTH)) next = null;
    const src = next ? { p: next, col: 0, flag: next.cols.mPrev.flag ?? "R" } : own ? { p: own, col: 1, flag: own.cols.mCur.flag ?? "F" } : null;
    if (!src) continue;
    const items = new Map();
    for (const [code, it] of src.p.items) items.set(code, { value: it.v[src.col], desc: it.desc, unit: it.unit, star: it.star });
    // descriptions and units: the month's own call speaks for its own code list when it exists
    if (own && next) for (const [code, it] of own.items) if (items.has(code)) Object.assign(items.get(code), { desc: it.desc, unit: it.unit ?? items.get(code).unit });
    out.set(mo, { flag: src.flag, items, total: src.p.total?.[src.col] ?? null, edition: editionOf(src === null ? mo : (next ? nextMo : mo)) });
  }
  return out;
}

/** FY panel from March cumulatives: Map(fy -> { flag, items: Map(code -> value), total }) plus the year to date. */
function fyPanel(root, flow, lvl, unit, latest) {
  const out = new Map();
  const marches = months(FIRST_MONTH, latest).filter((m) => m.endsWith("-03"));
  for (const mar of marches) {
    const p = parseCommodity(call(root, rel.cw(flow, lvl, unit, mar)), mar);
    if (!p) continue;
    const fy = fyOf(mar), prevFy = fyOf(addMonths(mar, -12));
    // this call: the year just ended (F) and, revised, the year before (R)
    out.set(prevFy, { flag: p.cols.cPrev.flag ?? "R", total: p.total?.[2], items: new Map([...p.items].map(([c, it]) => [c, { value: it.v[2], desc: it.desc }])) });
    if (!out.has(fy) || out.get(fy).flag !== "R") out.set(fy, { flag: p.cols.cCur.flag ?? "F", total: p.total?.[3], items: new Map([...p.items].map(([c, it]) => [c, { value: it.v[3], desc: it.desc }])) });
  }
  // re-apply: a later March call's R print outranks an earlier call's F print for the same year
  for (const mar of marches) {
    const p = parseCommodity(call(root, rel.cw(flow, lvl, unit, mar)), mar);
    if (!p) continue;
    const prevFy = fyOf(addMonths(mar, -12));
    out.set(prevFy, { flag: p.cols.cPrev.flag ?? "R", total: p.total?.[2], items: new Map([...p.items].map(([c, it]) => [c, { value: it.v[2], desc: it.desc }])) });
  }
  let ytd = null;
  if (!latest.endsWith("-03")) {
    const p = parseCommodity(call(root, rel.cw(flow, lvl, unit, latest)), latest);
    if (p) ytd = { label: `${p.cols.cCur.label}`, prevLabel: p.cols.cPrev.label, flags: [p.cols.cPrev.flag, p.cols.cCur.flag], total: [p.total?.[2], p.total?.[3]],
      items: new Map([...p.items].map(([c, it]) => [c, { prev: it.v[2], cur: it.v[3], desc: it.desc }])) };
  }
  return { years: out, ytd };
}

/* ---------------- writing ---------------- */
function bundleWriter(root, V, dcfg) {
  return (relName, dates, series, extra) => {
    const has = (i) => Object.values(series).some((s) => s.data[i] != null);
    let a = 0, b = dates.length - 1;
    while (a < b && !has(a)) a++;
    while (b > a && !has(b)) b--;
    const D = dates.slice(a, b + 1);
    for (const s of Object.values(series)) {
      s.data = s.data.slice(a, b + 1);
      const first = s.data.findIndex((v) => v != null), last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
      const gaps = D.filter((d, i) => i > first && i < last && s.data[i] == null);
      if (gaps.length) { s.gaps = gaps; s.gapsNote ??= "The code is not listed in TradeStat's table for these months (a code that lapsed and returned, or a line with no trade printed as blank)."; }
    }
    if (extra.revision) extra.revision = Object.fromEntries(Object.entries(extra.revision).filter(([d]) => D.includes(d)));
    writeSeries(root, `data/series/${relName}.json`, { meta: { dossier: "trade", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", releaseDate: null,
      revisionPolicy: dcfg.revision_policy, latestPeriod: D.at(-1).slice(0, 7), ...extra }, dates: D, series });
  };
}

/** Data vintage: the newest archive vintage among the calls a bundle reads (never the run date). */
function vintageOf(root, files) {
  let v = null;
  for (const f of files) { const r = call(root, f); if (r?.vintage && (!v || r.vintage > v)) v = r.vintage; }
  return v;
}

export function bakeTradestat(root, dcfg, { latest, latestFtpa }) {
  const written = [];
  const W0 = (V) => bundleWriter(root, V, dcfg);
  const allFiles = (dir) => fs.existsSync(path.join(root, RAW, dir)) ? fs.readdirSync(path.join(root, RAW, dir)).map((f) => `${RAW}/${dir}/${f}`) : [];
  const V = vintageOf(root, [...allFiles("meidb-commodity"), ...allFiles("meidb-region"), ...allFiles("ftpa")]);
  const W = (name, ...a) => { W0(V)(name, ...a); written.push(name); };

  /* ---- HS 2 and 4, monthly and annual, US$ and ₹ ---- */
  const headline = {};
  for (const unit of ["usd", "inr"]) for (const lvl of [2, 4]) for (const flow of ["export", "import"]) {
    const P = monthlyPanel(root, flow, lvl, unit, latest);
    const mos = [...P.keys()].sort();
    const dates = mos.map(iso);
    const codes = [...new Set(mos.flatMap((m) => [...P.get(m).items.keys()]))].sort();
    const descOf = (c) => { for (const m of [...mos].reverse()) { const it = P.get(m).items.get(c); if (it) return it.desc; } return c; };
    const series = {};
    for (const c of codes) {
      const label = `${tidyDesc(descOf(c))} (HS ${c})`;
      series["c" + c] = { name: `hs${c}`, label, color: "#A3A9B4", data: mos.map((m) => r2(P.get(m).items.get(c)?.value ?? null)) };
    }
    series.total = { name: "total", label: `India's total ${FLOW[flow]}, ${UNIT[unit][0]}`, color: "#2E4BD8", data: mos.map((m) => r2(P.get(m).total)) };
    const suffix = unit === "inr" ? "-inr" : "";
    W(`trade-hs${lvl}-${FLOW[flow]}${suffix}`, dates, series, { frequency: "monthly", base: "HS 2 and 4 digits", unit: UNIT[unit][1],
      revision: Object.fromEntries(mos.map((m) => [iso(m), P.get(m).flag])),
      coverage: `India's merchandise ${FLOW[flow]} by HS ${lvl === 2 ? "chapter (2 digits)" : "heading (4 digits)"}, every month since January 2017, ${UNIT[unit][0]}`,
      note: `Ministry of Commerce TradeStat, monthly export-import data bank (MEIDB), DGCI&S customs data. Each month is the revised print (R) from the table a year later where one exists, else the month's own final print (F); meta.revision names it. January to December 2017 comes only from the 2018 tables' revised column. HS ${lvl}-digit codes are stable across the HS 2017 and HS 2022 editions. 'total' is the printed India total, not a sum.` });
    if (lvl === 2) headline[`${flow}_${unit}`] = { mos, P };

    const F = fyPanel(root, flow, lvl, unit, latest);
    const fys = [...F.years.keys()].sort();
    const fseries = {};
    for (const c of codes) fseries["c" + c] = { name: `hs${c}`, label: `${tidyDesc(descOf(c))} (HS ${c})`, color: "#A3A9B4", data: fys.map((fy) => r2(F.years.get(fy).items.get(c)?.value ?? null)) };
    fseries.total = { name: "total", label: `India's total ${FLOW[flow]}, ${UNIT[unit][0]}`, color: "#2E4BD8", data: fys.map((fy) => r2(F.years.get(fy).total)) };
    W(`trade-hs${lvl}-${FLOW[flow]}-fy${suffix}`, fys.map(fyStartIso), fseries, { frequency: "annual", base: "HS 2 and 4 digits", unit: UNIT[unit][1],
      revision: Object.fromEntries(fys.map((fy) => [fyStartIso(fy), F.years.get(fy).flag])),
      coverage: `India's merchandise ${FLOW[flow]} by HS ${lvl === 2 ? "chapter" : "heading"}, every financial year (April to March) since 2016-17, ${UNIT[unit][0]}`,
      note: "TradeStat MEIDB: the March table's April-to-March cumulative, revised (R) from the following March where available. Financial years dated at April. Never from the annual bank (EIDB), whose 2023-24 commodity tables count every record twice." });
    if (F.ytd) {
      const y = F.ytd;
      const ys = {};
      for (const c of codes) ys["c" + c] = { name: `hs${c}`, label: `${tidyDesc(descOf(c))} (HS ${c})`, color: "#A3A9B4", data: [r2(y.items.get(c)?.prev ?? null), r2(y.items.get(c)?.cur ?? null)] };
      ys.total = { name: "total", label: `India's total ${FLOW[flow]}, ${UNIT[unit][0]}`, color: "#2E4BD8", data: [r2(y.total[0]), r2(y.total[1])] };
      const curFy = fyOf(latest), prevFy = fyOf(addMonths(latest, -12));
      W(`trade-hs${lvl}-${FLOW[flow]}-ytd${suffix}`, [fyStartIso(prevFy), fyStartIso(curFy)], ys, { frequency: "annual", base: "HS 2 and 4 digits", unit: UNIT[unit][1],
        period: { from: "04", to: latest.slice(5, 7), label: `April to ${MONTHS[+latest.slice(5, 7) - 1]}` },
        revision: { [fyStartIso(prevFy)]: y.flags[0], [fyStartIso(curFy)]: y.flags[1] },
        coverage: `India's merchandise ${FLOW[flow]} by HS ${lvl === 2 ? "chapter" : "heading"}, April to ${MONTHS[+latest.slice(5, 7) - 1]} of this financial year and the same months a year earlier, ${UNIT[unit][0]}`,
        note: `TradeStat MEIDB: the cumulative columns of the ${MONTHS[+latest.slice(5, 7) - 1]} ${latest.slice(0, 4)} table (${y.prevLabel} and ${y.label}). A part of a year: never compare with full years.` });
    }
  }

  /* ---- the headline: totals and balance, monthly, from the HS 2 tables ---- */
  for (const unit of ["usd", "inr"]) {
    const E = headline[`export_${unit}`], I = headline[`import_${unit}`];
    const mos = [...new Set([...E.mos, ...I.mos])].sort();
    const ex = mos.map((m) => r2(E.P.get(m)?.total ?? null)), im = mos.map((m) => r2(I.P.get(m)?.total ?? null));
    W(`trade-total${unit === "inr" ? "-inr" : ""}`, mos.map(iso), {
      exports: { name: "exports", label: `Exports, ${UNIT[unit][0]}`, color: "#2E4BD8", data: ex },
      imports: { name: "imports", label: `Imports, ${UNIT[unit][0]}`, color: "#C47A16", data: im },
      balance: { name: "balance", label: `Trade balance (exports minus imports, derived), ${UNIT[unit][0]}`, color: "#5F6675", data: ex.map((e, i) => (e == null || im[i] == null ? null : r2(e - im[i]))) },
    }, { frequency: "monthly", base: "HS 2 and 4 digits", unit: UNIT[unit][1], revision: Object.fromEntries(mos.map((m) => [iso(m), E.P.get(m)?.flag ?? null])),
      coverage: `India's merchandise exports, imports and trade balance every month since January 2017, ${UNIT[unit][0]} (TradeStat)`,
      note: "The printed India totals of TradeStat's MEIDB chapter tables (R print where a year-later table exists, else F). The balance is exports minus imports, computed here." });
  }
  return { written, V };
}
