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
import zlib from "node:zlib";
import { writeSeries } from "../util.mjs";
import { parseNumber } from "../tabular.mjs";
import { decode } from "../tradestat.mjs";
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
export const ckey = (s) => s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

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

/** MEIDB region table (every region, sub-region and country) -> same shape as parseCommodity.
 *  Keys: "r:<n>" region, "s:<n.n>" sub-region, "c:<country key>" country (under its region). */
function parseRegion(raw, expectMonth) {
  if (!raw) return null;
  const vc = valueColumns(raw.header);
  if (vc.length !== 4) throw new Error(`tradestat bake: ${raw.view}: expected 4 value columns, saw ${vc.length}`);
  const [mPrev, mCur, cPrev, cCur] = vc;
  const lab = `${M3[+expectMonth.slice(5, 7) - 1]}-${expectMonth.slice(0, 4)}`;
  if (mCur.label !== lab) throw new Error(`tradestat bake: ${raw.view} asked for ${lab}, the table is for ${mCur.label}`);
  const items = new Map(); let region = null, sub = null;
  for (const r of raw.rows) {
    const v = [mPrev, mCur, cPrev, cCur].map((c) => parseNumber(r[c.i]));
    const name = (r[0] ?? "").trim();
    let m;
    if ((m = name.match(/^(\d+)\s+(.+)$/))) { region = m[2]; sub = null; items.set(`r:${m[1]}`, { desc: m[2], kind: "region", v }); }
    else if ((m = name.match(/^(\d+\.\d+)\s+(.+)$/))) { sub = m[2]; items.set(`s:${m[1]}`, { desc: m[2], kind: "subregion", region, v }); }
    else if ((m = name.match(/^\d+\)\s*(.+)$/))) {
      const key = `c:${ckey(countryName(m[1]))}`;
      if (items.has(key)) throw new Error(`tradestat bake: ${raw.view} ${expectMonth}: country ${m[1]} listed twice`);
      items.set(key, { desc: m[1], kind: "country", region, sub, v });
    }
  }
  return { cols: { mPrev, mCur, cPrev, cCur }, items, total: null };
}

/* ---------------- monthly assembly ---------------- */
/** For one (flow, level, unit): Map(month -> { flag, items: Map(code -> {value, desc, unit, star}), total }) */
function monthlyPanel(root, flow, lvl, unit, latest, opts = {}) {
  return panelOf(root, (mo) => rel.cw(flow, lvl, unit, mo), parseCommodity, latest, opts);
}
function panelOf(root, fileOf, parse, latest, { sameEdition = false } = {}) {
  const out = new Map();
  const first = addMonths(FIRST_MONTH, -12);
  for (const mo of months(first, latest)) {
    const own = mo >= FIRST_MONTH ? parse(call(root, fileOf(mo)), mo) : null;
    const nextMo = addMonths(mo, 12);
    let next = nextMo <= latest ? parse(call(root, fileOf(nextMo)), nextMo) : null;
    if (next && sameEdition && editionOf(nextMo) !== editionOf(mo)) next = null;
    if (next && mo < FIRST_MONTH && sameEdition && editionOf(nextMo) !== editionOf(FIRST_MONTH)) next = null;
    const src = next ? { p: next, col: 0, flag: next.cols.mPrev.flag ?? "R" } : own ? { p: own, col: 1, flag: own.cols.mCur.flag ?? "F" } : null;
    if (!src) continue;
    const items = new Map();
    for (const [code, it] of src.p.items) items.set(code, { value: it.v[src.col], desc: it.desc, unit: it.unit, star: it.star, kind: it.kind, region: it.region, sub: it.sub });
    // descriptions and units: the month's own call speaks for its own code list when it exists
    if (own && next) for (const [code, it] of own.items) if (items.has(code)) Object.assign(items.get(code), { desc: it.desc, unit: it.unit ?? items.get(code).unit });
    out.set(mo, { flag: src.flag, items, total: src.p.total?.[src.col] ?? null, edition: editionOf(src === null ? mo : (next ? nextMo : mo)) });
  }
  return out;
}

/** FY panel from March cumulatives: Map(fy -> { flag, items: Map(code -> value), total }) plus the year to date. */
function fyPanel(root, flow, lvl, unit, latest) {
  return fyPanelOf(root, (mo) => rel.cw(flow, lvl, unit, mo), parseCommodity, latest);
}
function fyPanelOf(root, fileOf, parse, latest) {
  const out = new Map();
  const marches = months(FIRST_MONTH, latest).filter((m) => m.endsWith("-03"));
  for (const mar of marches) {
    const p = parse(call(root, fileOf(mar)), mar);
    if (!p) continue;
    const fy = fyOf(mar), prevFy = fyOf(addMonths(mar, -12));
    // this call: the year just ended (F) and, revised, the year before (R)
    out.set(prevFy, { flag: p.cols.cPrev.flag ?? "R", total: p.total?.[2], items: new Map([...p.items].map(([c, it]) => [c, { value: it.v[2], desc: it.desc, kind: it.kind, region: it.region, sub: it.sub }])) });
    if (!out.has(fy) || out.get(fy).flag !== "R") out.set(fy, { flag: p.cols.cCur.flag ?? "F", total: p.total?.[3], items: new Map([...p.items].map(([c, it]) => [c, { value: it.v[3], desc: it.desc, kind: it.kind, region: it.region, sub: it.sub }])) });
  }
  // re-apply: a later March call's R print outranks an earlier call's F print for the same year
  for (const mar of marches) {
    const p = parse(call(root, fileOf(mar)), mar);
    if (!p) continue;
    const prevFy = fyOf(addMonths(mar, -12));
    out.set(prevFy, { flag: p.cols.cPrev.flag ?? "R", total: p.total?.[2], items: new Map([...p.items].map(([c, it]) => [c, { value: it.v[2], desc: it.desc }])) });
  }
  let ytd = null;
  if (!latest.endsWith("-03")) {
    const p = parse(call(root, fileOf(latest)), latest);
    if (p) ytd = { label: `${p.cols.cCur.label}`, prevLabel: p.cols.cPrev.label, flags: [p.cols.cPrev.flag, p.cols.cCur.flag], total: [p.total?.[2], p.total?.[3]],
      items: new Map([...p.items].map(([c, it]) => [c, { prev: it.v[2], cur: it.v[3], desc: it.desc, kind: it.kind, region: it.region, sub: it.sub }])) };
  }
  return { years: out, ytd };
}

/* ---------------- writing ---------------- */
function bundleWriter(root, V, dcfg) {
  return (relName, dates, series, extra) => {
    // a code with no value in any period of this bundle (listed in other months only) is not baked here
    for (const k of Object.keys(series)) if (series[k].data.every((v) => v == null)) delete series[k];
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

  /* ---- chapter names (from the HS 2 tables), the group of every finer HS line ---- */
  const CHAP = new Map();
  for (const flow of ["export", "import"]) { const p = parseCommodity(call(root, rel.cw(flow, 2, "usd", latest)), latest); for (const [c, it] of p?.items ?? []) CHAP.set(c, `${c} ${tidyDesc(it.desc).replace(/;.*$/, "")}`); }
  const chapterOf = (code) => CHAP.get(code.slice(0, 2)) ?? `Chapter ${code.slice(0, 2)}`;
  const qtyUnit = (u) => `qty_${String(u || "none").toLowerCase().replace(/[^a-z]+/g, "_")}`;

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
      series["c" + c] = { name: `hs${c}`, label, color: "#A3A9B4", ...(lvl === 4 ? { group: chapterOf(c) } : {}), data: mos.map((m) => r2(P.get(m).items.get(c)?.value ?? null)) };
    }
    series.total = { name: "total", label: `India's total ${FLOW[flow]}, ${UNIT[unit][0]}`, color: "#2E4BD8", data: mos.map((m) => r2(P.get(m).total)) };
    const suffix = unit === "inr" ? "-inr" : "";
    W(`trade-hs${lvl}-${FLOW[flow]}${suffix}`, dates, series, { frequency: "monthly", base: "TradeStat, as published", unit: UNIT[unit][1],
      revision: Object.fromEntries(mos.map((m) => [iso(m), P.get(m).flag])),
      coverage: `India's merchandise ${FLOW[flow]} by HS ${lvl === 2 ? "chapter (2 digits)" : "heading (4 digits)"}, every month since January 2017, ${UNIT[unit][0]}`,
      note: `Ministry of Commerce TradeStat, monthly export-import data bank (MEIDB), DGCI&S customs data. Each month is the revised print (R) from the table a year later where one exists, else the month's own final print (F); meta.revision names it. January to December 2017 comes only from the 2018 tables' revised column. HS ${lvl}-digit codes are stable across the HS 2017 and HS 2022 editions. 'total' is the printed India total, not a sum.` });
    if (lvl === 2) headline[`${flow}_${unit}`] = { mos, P };

    const F = fyPanel(root, flow, lvl, unit, latest);
    const fys = [...F.years.keys()].sort();
    const fseries = {};
    for (const c of codes) fseries["c" + c] = { name: `hs${c}`, label: `${tidyDesc(descOf(c))} (HS ${c})`, color: "#A3A9B4", ...(lvl === 4 ? { group: chapterOf(c) } : {}), data: fys.map((fy) => r2(F.years.get(fy).items.get(c)?.value ?? null)) };
    fseries.total = { name: "total", label: `India's total ${FLOW[flow]}, ${UNIT[unit][0]}`, color: "#2E4BD8", data: fys.map((fy) => r2(F.years.get(fy).total)) };
    W(`trade-hs${lvl}-${FLOW[flow]}-fy${suffix}`, fys.map(fyStartIso), fseries, { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
      revision: Object.fromEntries(fys.map((fy) => [fyStartIso(fy), F.years.get(fy).flag])),
      coverage: `India's merchandise ${FLOW[flow]} by HS ${lvl === 2 ? "chapter" : "heading"}, every financial year (April to March) since 2016-17, ${UNIT[unit][0]}`,
      note: "TradeStat MEIDB: the March table's April-to-March cumulative, revised (R) from the following March where available. Financial years dated at April. Never from the annual bank (EIDB), whose 2023-24 commodity tables count every record twice." });
    if (F.ytd) {
      const y = F.ytd;
      const ys = {};
      for (const c of codes) ys["c" + c] = { name: `hs${c}`, label: `${tidyDesc(descOf(c))} (HS ${c})`, color: "#A3A9B4", ...(lvl === 4 ? { group: chapterOf(c) } : {}), data: [r2(y.items.get(c)?.prev ?? null), r2(y.items.get(c)?.cur ?? null)] };
      ys.total = { name: "total", label: `India's total ${FLOW[flow]}, ${UNIT[unit][0]}`, color: "#2E4BD8", data: [r2(y.total[0]), r2(y.total[1])] };
      const curFy = fyOf(latest), prevFy = fyOf(addMonths(latest, -12));
      W(`trade-hs${lvl}-${FLOW[flow]}-ytd${suffix}`, [fyStartIso(prevFy), fyStartIso(curFy)], ys, { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
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
    }, { frequency: "monthly", base: "TradeStat, as published", unit: UNIT[unit][1], revision: Object.fromEntries(mos.map((m) => [iso(m), E.P.get(m)?.flag ?? null])),
      coverage: `India's merchandise exports, imports and trade balance every month since January 2017, ${UNIT[unit][0]} (TradeStat)`,
      note: "The printed India totals of TradeStat's MEIDB chapter tables (R print where a year-later table exists, else F). The balance is exports minus imports, computed here." });
  }
  /* ---- partners and regions, monthly, financial year and year to date, US$ and ₹ ---- */
  const partnerPanels = {};
  for (const unit of ["usd", "inr"]) for (const flow of ["export", "import"]) {
    const P = panelOf(root, (mo) => rel.region(flow, unit, mo), parseRegion, latest);
    const F = fyPanelOf(root, (mo) => rel.region(flow, unit, mo), parseRegion, latest);
    partnerPanels[`${flow}_${unit}`] = { P, F };
    const mos = [...P.keys()].sort();
    const fys = [...F.years.keys()].sort();
    const keys = new Map();
    for (const m of mos) for (const [k, it] of P.get(m).items) keys.set(k, it);
    const label = (k, it) => it.kind === "country" ? `${countryName(it.desc)} (${/Unspecified/i.test(it.region) ? "no region assigned" : it.region})` : it.kind === "region" ? `${it.desc}, all countries` : `${it.desc} (${it.region})`;
    const suffix = unit === "inr" ? "-inr" : "";
    for (const [kind, name] of [["country", "partners"], ["region", "regions"]]) {
      const ks = [...keys].filter(([, it]) => (kind === "country" ? it.kind === "country" : it.kind !== "country")).map(([k]) => k).sort();
      const sk = (k) => k.replace(/^[a-z]:/, (m) => ({ "c:": "", "r:": "region_", "s:": "sub_" })[m]).replace(/\./g, "_");
      const mk = (getter, n) => Object.fromEntries(ks.map((k) => [sk(k), { name: sk(k), label: label(k, keys.get(k)), color: "#A3A9B4", region: keys.get(k).region ?? null, group: keys.get(k).region ?? undefined, data: Array.from({ length: n }, (_, i) => r2(getter(i, k))) }]));
      const what = kind === "country" ? "partner country" : "region and sub-region";
      W(`trade-${name}-${FLOW[flow]}${suffix}`, mos.map(iso), mk((i, k) => P.get(mos[i]).items.get(k)?.value ?? null, mos.length), { frequency: "monthly", base: "TradeStat, as published", unit: UNIT[unit][1],
        revision: Object.fromEntries(mos.map((m) => [iso(m), P.get(m).flag])),
        coverage: `India's merchandise ${FLOW[flow]} by ${what}, every month since January 2017, ${UNIT[unit][0]}`,
        note: "TradeStat MEIDB region-wise table (every country under its region and sub-region). R print from the table a year later where one exists, else F. Country names are tidied from TradeStat's (CHINA P RP to China); the label carries the region." });
      W(`trade-${name}-${FLOW[flow]}-fy${suffix}`, fys.map(fyStartIso), mk((i, k) => F.years.get(fys[i]).items.get(k)?.value ?? null, fys.length), { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
        revision: Object.fromEntries(fys.map((fy) => [fyStartIso(fy), F.years.get(fy).flag])),
        coverage: `India's merchandise ${FLOW[flow]} by ${what}, every financial year since 2016-17, ${UNIT[unit][0]}`,
        note: "TradeStat MEIDB: the March region table's April-to-March cumulative (R from the following March where available)." });
      if (F.ytd) {
        const curFy = fyOf(latest), prevFy = fyOf(addMonths(latest, -12));
        W(`trade-${name}-${FLOW[flow]}-ytd${suffix}`, [fyStartIso(prevFy), fyStartIso(curFy)], mk((i, k) => (i ? F.ytd.items.get(k)?.cur : F.ytd.items.get(k)?.prev) ?? null, 2), { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
          period: { from: "04", to: latest.slice(5, 7), label: `April to ${MONTHS[+latest.slice(5, 7) - 1]}` }, revision: { [fyStartIso(prevFy)]: F.ytd.flags[0], [fyStartIso(curFy)]: F.ytd.flags[1] },
          coverage: `India's merchandise ${FLOW[flow]} by ${what}, April to ${MONTHS[+latest.slice(5, 7) - 1]} this year and a year earlier, ${UNIT[unit][0]}`,
          note: "TradeStat MEIDB region table, cumulative columns of the latest month. A part of a year: never compare with full years." });
      }
    }
  }
  // balance by partner: exports minus imports (derived), monthly and financial year, US$
  for (const [suffix, which] of [["", "P"], ["-fy", "F"]]) {
    const E = partnerPanels.export_usd[which], I = partnerPanels.import_usd[which];
    const periods = which === "P" ? [...E.keys()].sort() : [...E.years.keys()].sort();
    const get = (X, p) => (which === "P" ? X.get(p) : X.years.get(p));
    const ks = new Set();
    for (const p of periods) for (const [k, it] of get(E, p).items) if (it.kind === "country") ks.add(k);
    const series = {};
    for (const k of [...ks].sort()) {
      const it = [...periods].reverse().map((p) => get(E, p).items.get(k)).find(Boolean);
      series[k.slice(2)] = { name: k.slice(2), label: `${countryName(it.desc)}: exports minus imports (derived)`, color: "#5F6675", region: it.region, group: it.region,
        data: periods.map((p) => { const e = get(E, p).items.get(k)?.value, m = get(I, p)?.items.get(k)?.value; return e == null || m == null ? null : r2(e - m); }) };
    }
    W(`trade-partners-balance${suffix}`, periods.map((p) => (which === "P" ? iso(p) : fyStartIso(p))), series, { frequency: which === "P" ? "monthly" : "annual", base: "TradeStat, as published", unit: "usd_million",
      coverage: `India's trade balance with each partner (exports minus imports), ${which === "P" ? "every month since January 2017" : "every financial year since 2016-17"}, US$ million`,
      note: "Derived here: TradeStat's exports to a country minus its imports from that country, both from the MEIDB region tables. A deficit is negative." });
  }

  /* ---- principal commodities (FTPA): monthly (derived from cumulatives) and financial year ---- */
  for (const unit of ["usd", "inr"]) for (const flow of ["export", "import"]) {
    const parse = (mo) => {
      const raw = call(root, rel.ftpa(flow, unit, mo));
      if (!raw) return null;
      const vc = valueColumns(raw.header);
      if (vc.length !== 2) throw new Error(`tradestat bake: FTPA ${flow} ${mo}: expected 2 value columns, saw ${vc.length}`);
      const items = new Map(); let total = null, group = null;
      for (const r of raw.rows) {
        const name = (r[0] ?? "").trim(); const v = vc.map((c) => parseNumber(r[c.i]));
        if (/^Total$/i.test(name)) { total = v; continue; }
        let m;
        if ((m = name.match(/^(\d{1,2})\s+(.+)$/))) { group = m[2]; items.set(`g${m[1].padStart(2, "0")}`, { desc: m[2], kind: "group", v }); }
        else if ((m = name.match(/^([A-Z]\d|ZZ)\s+(.+)$/))) { const k = `i${m[1].toLowerCase()}`; if (!items.has(k)) items.set(k, { desc: m[2], kind: "item", group, v }); }
      }
      return { prevFlag: vc[0].flag, curFlag: vc[1].flag ?? "P", items, total };
    };
    const firstCall = FIRST_FTPA, ftMonths = months(addMonths(firstCall, -12), latestFtpa);
    const C = new Map(); for (const mo of months(firstCall, latestFtpa)) C.set(mo, parse(mo));
    // cumulative to month m: revised (from the call a year later) or provisional (own call)
    const cumR = (mo, k) => { const c = C.get(addMonths(mo, 12)); if (!c) return undefined; return k === "total" ? c.total?.[0] : c.items.get(k)?.v[0]; };
    const cumP = (mo, k) => { const c = C.get(mo); if (!c) return undefined; return k === "total" ? c.total?.[1] : c.items.get(k)?.v[1]; };
    const keys = new Map(); for (const c of C.values()) if (c) for (const [k, it] of c.items) keys.set(k, it);
    const monthly = new Map(), flags = new Map();
    for (const mo of ftMonths) {
      const april = mo.endsWith("-04"), prev = addMonths(mo, -1);
      const haveR = C.has(addMonths(mo, 12)) && (april || C.has(addMonths(prev, 12)));
      const haveP = C.has(mo) && (april || C.has(prev));
      if (!haveR && !haveP) continue;
      const f = haveR ? cumR : cumP;
      flags.set(mo, haveR ? "R" : (C.get(mo)?.curFlag ?? "P"));
      const val = (k) => { const a = f(mo, k), b = april ? 0 : f(prev, k); return a == null || b == null ? null : r2(a - b); };
      monthly.set(mo, { val });
    }
    const mos = [...monthly.keys()].sort();
    const lab = (k, it) => it.kind === "group" ? `${tidyDesc(it.desc)} (group ${+k.slice(1)})` : `${tidyDesc(it.desc)} (${k.slice(1).toUpperCase()})`;
    const series = {};
    for (const [k, it] of [...keys].sort()) series[k] = { name: k, label: lab(k, it), color: "#A3A9B4", group: it.group ? tidyDesc(it.group) : null, data: mos.map((m) => monthly.get(m).val(k)) };
    series.total = { name: "total", label: `Total ${FLOW[flow]}`, color: "#2E4BD8", data: mos.map((m) => monthly.get(m).val("total")) };
    const suffix = unit === "inr" ? "-inr" : "";
    W(`trade-principal-${FLOW[flow]}${suffix}`, mos.map(iso), series, { frequency: "monthly", base: "TradeStat, as published", unit: UNIT[unit][1],
      revision: Object.fromEntries(mos.map((m) => [iso(m), flags.get(m)])),
      coverage: `India's merchandise ${FLOW[flow]} by principal commodity (the groups the monthly press release uses: petroleum, gold, electronics, pulses, rice and about 165 more), every month since April 2009, ${UNIT[unit][0]}`,
      note: "TradeStat FTPA principal-commodity tables, which print only April-to-month running totals. Each month here is derived: this month's running total minus last month's, both from the same print (R from the tables a year later where they exist, else the provisional P tables). 'total' is derived the same way from the printed total." });
    // financial years: the March running total; the current year to date from the latest table
    const fys = [], fyv = new Map(), fyf = new Map();
    for (const mo of ftMonths.filter((m) => m.endsWith("-03"))) {
      const r = C.has(addMonths(mo, 12)), p = C.has(mo);
      if (!r && !p) continue;
      const fy = fyOf(mo); fys.push(fy); fyf.set(fy, r ? "R" : (C.get(mo)?.curFlag ?? "P"));
      fyv.set(fy, (k) => (r ? cumR(mo, k) : cumP(mo, k)) ?? null);
    }
    const fseries = {};
    for (const [k, it] of [...keys].sort()) fseries[k] = { name: k, label: lab(k, it), color: "#A3A9B4", group: it.group ? tidyDesc(it.group) : null, data: fys.map((fy) => r2(fyv.get(fy)(k))) };
    fseries.total = { name: "total", label: `Total ${FLOW[flow]}`, color: "#2E4BD8", data: fys.map((fy) => r2(fyv.get(fy)("total"))) };
    W(`trade-principal-${FLOW[flow]}-fy${suffix}`, fys.map(fyStartIso), fseries, { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
      revision: Object.fromEntries(fys.map((fy) => [fyStartIso(fy), fyf.get(fy)])),
      coverage: `India's merchandise ${FLOW[flow]} by principal commodity, every financial year since 2009-10, ${UNIT[unit][0]}`,
      note: "TradeStat FTPA: the March running total (April to March), revised (R) from the following year's table where it exists, else provisional (P)." });
    if (!latestFtpa.endsWith("-03")) {
      const c = C.get(latestFtpa), curFy = fyOf(latestFtpa), prevFy = fyOf(addMonths(latestFtpa, -12));
      const ys = {};
      for (const [k, it] of [...keys].sort()) ys[k] = { name: k, label: lab(k, it), color: "#A3A9B4", group: it.group ? tidyDesc(it.group) : null, data: [r2(c.items.get(k)?.v[0] ?? null), r2(c.items.get(k)?.v[1] ?? null)] };
      ys.total = { name: "total", label: `Total ${FLOW[flow]}`, color: "#2E4BD8", data: [r2(c.total?.[0]), r2(c.total?.[1])] };
      W(`trade-principal-${FLOW[flow]}-ytd${suffix}`, [fyStartIso(prevFy), fyStartIso(curFy)], ys, { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
        period: { from: "04", to: latestFtpa.slice(5, 7), label: `April to ${MONTHS[+latestFtpa.slice(5, 7) - 1]}` }, revision: { [fyStartIso(prevFy)]: c.prevFlag ?? "R", [fyStartIso(curFy)]: c.curFlag },
        coverage: `India's merchandise ${FLOW[flow]} by principal commodity, April to ${MONTHS[+latestFtpa.slice(5, 7) - 1]} this year (the quick estimates) and a year earlier, ${UNIT[unit][0]}`,
        note: "TradeStat FTPA, the latest table's two running totals. This year's column is provisional (P), the quick estimates of the monthly press release. A part of a year." });
    }
  }

  /* ---- partners since 2009-10 (FTSPCC total trade, March tables = whole financial years) ---- */
  for (const unit of ["usd", "inr"]) {
    const marches = months(FIRST_FTPA, latestFtpa).filter((m) => m.endsWith("-03"));
    const T = new Map();
    for (const mar of marches) {
      const raw = call(root, rel.ttrade(unit, mar)); if (!raw) continue;
      const h0 = raw.header[0] ?? [];
      const flagCur = /\(P\)/.test(h0.find((c) => c.startsWith(`${+mar.slice(0, 4) - 1}-`)) ?? "") ? "P" : null;
      const rows = new Map();
      for (const r of raw.rows) { if (!/^\d+$/.test(r[0] ?? "")) continue; rows.set(ckey(countryName(r[1])), { desc: r[1], prev: r.slice(2, 6).map(parseNumber), cur: r.slice(6, 10).map(parseNumber) }); }
      T.set(mar, { rows, flagCur });
    }
    const fyList = [];
    const valueOf = new Map();
    for (const mar of [...T.keys()].sort()) {
      const fy = fyOf(mar), prevFy = fyOf(addMonths(mar, -12));
      // the year just ended (this table) unless a later table revises it; the year before, revised
      for (const [k, x] of T.get(mar).rows) {
        valueOf.set(`${prevFy}|${k}`, { v: x.prev, flag: "R", desc: x.desc });
        if (!valueOf.has(`${fy}|${k}`) || valueOf.get(`${fy}|${k}`).flag !== "R") valueOf.set(`${fy}|${k}`, { v: x.cur, flag: T.get(mar).flagCur ?? "F", desc: x.desc });
      }
      if (!fyList.includes(prevFy)) fyList.push(prevFy);
      if (!fyList.includes(fy)) fyList.push(fy);
    }
    // the later table's revised column wins over the earlier table's own column
    for (const mar of [...T.keys()].sort()) { const prevFy = fyOf(addMonths(mar, -12)); for (const [k, x] of T.get(mar).rows) valueOf.set(`${prevFy}|${k}`, { v: x.prev, flag: "R", desc: x.desc }); }
    const fys = fyList.sort();
    const ks = [...new Set([...valueOf.keys()].map((k) => k.split("|")[1]))].sort();
    const series = {};
    for (const k of ks) {
      const desc = [...fys].reverse().map((fy) => valueOf.get(`${fy}|${k}`)?.desc).find(Boolean);
      for (const [j, what] of [[0, "exports"], [1, "imports"], [3, "balance"]])
        series[`${k}__${what}`] = { name: `${k}__${what}`, label: `${countryName(desc)}: ${what === "balance" ? "trade balance (as printed)" : what}`, color: "#A3A9B4", group: countryName(desc),
          data: fys.map((fy) => r2(valueOf.get(`${fy}|${k}`)?.v[j] ?? null)) };
    }
    W(`trade-partners-long${unit === "inr" ? "-inr" : ""}`, fys.map(fyStartIso), series, { frequency: "annual", base: "TradeStat, as published", unit: UNIT[unit][1],
      revision: Object.fromEntries(fys.map((fy) => [fyStartIso(fy), [...valueOf.entries()].find(([kk]) => kk.startsWith(fy + "|"))?.[1].flag ?? null])),
      coverage: `India's exports to, imports from and trade balance with every partner, every financial year since 2009-10, ${UNIT[unit][0]} (the long partner history)`,
      note: "TradeStat FTSPCC total-trade table, read only from its March tables (whole financial years); each year is the revised column of the following March's table where it exists. A different publication from the monthly partner tables (2017 on): shown beside them, never joined. Balance as printed." });
  }

  /* ---- principal-commodity quantities (FTSPCC), monthly since January 2017 ---- */
  for (const flow of ["export", "import"]) {
    const parse = (raw, mo) => {
      if (!raw) return null;
      const vc = valueColumns(raw.header);
      if (vc.length !== 4) throw new Error(`tradestat bake: FTSPCC ${flow} ${mo}: expected 4 value columns, saw ${vc.length}`);
      const items = new Map();
      for (const r of raw.rows) {
        const m = (r[1] ?? "").match(/^([A-Z]\d|ZZ),\s*(.+)$/); if (!m || !r[2]) continue;
        items.set(`i${m[1].toLowerCase()}_${r[2].toLowerCase()}`, { desc: `${m[2]}`, unit: r[2], v: vc.map((c) => parseNumber(r[c.i])) });
      }
      return { cols: { mPrev: { flag: "R" }, mCur: { flag: vc[1].flag ?? "P" } }, items, total: null };
    };
    const P = panelOf(root, (mo) => rel.ftspccQty(flow, mo), parse, latest);
    const mos = [...P.keys()].sort();
    const keys = new Map(); for (const m of mos) for (const [k, it] of P.get(m).items) keys.set(k, it);
    const series = {};
    for (const [k, it] of [...keys].sort()) series[k] = { name: k, label: `${tidyDesc(it.desc)} (${k.slice(1, 3).toUpperCase()}), ${it.unit.toLowerCase() === "ton" ? "tonnes" : it.unit.toLowerCase() === "kgs" ? "kilograms" : it.unit}`, unit: qtyUnit(it.unit), color: "#A3A9B4",
      data: mos.map((m) => P.get(m).items.get(k)?.value ?? null) };
    W(`trade-principal-quantity-${FLOW[flow]}`, mos.map(iso), series, { frequency: "monthly", base: "TradeStat, as published", unit: "quantity",
      revision: Object.fromEntries(mos.map((m) => [iso(m), P.get(m).flag])),
      coverage: `How much India ${flow === "export" ? "sells" : "buys"}, by weight or count: ${FLOW[flow]} of each principal commodity in its own unit (tonnes, kilograms, numbers), every month since January 2017`,
      note: "TradeStat FTSPCC principal-commodity tables, quantity view. Each line is in the unit printed beside it; lines in different units are never added. The year-earlier column of a table a year later (unflagged) replaces the provisional (P) print where it exists." });
  }

  /* ---- HS 6 and 8 digits: the deep-archive tier (PLAN-launch §2b), not bundles ----
   * One long-format file per flow, level, unit and financial year, each on one HS edition:
   * data/archive/staging/trade/meidb-<flow>-hs<6|8>-<usd|inr|qty>-<fy>.csv.gz (git-ignored;
   * the archive builder converts to Parquet and uploads). Columns: flow, hs_level, hs_code,
   * description, quantity_unit, date, value, value_unit, revision_flag, hs_edition,
   * financial_year, code_note, source, vintage. The 4-digit bundles are what they roll up to. */
  const STAGE = "data/archive/staging/trade";
  const csvCell = (v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const archived = [];
  for (const [lvl, unit] of [[6, "usd"], [8, "usd"], [6, "inr"], [8, "inr"], [8, "qty"]]) for (const flow of ["export", "import"]) {
    if (!fs.existsSync(path.join(root, rel.cw(flow, lvl, unit, latest)))) { console.warn(`  tradestat bake: HS ${lvl} ${unit} ${flow} not archived yet, skipped`); continue; }
    const P = monthlyPanel(root, flow, lvl, unit, latest, { sameEdition: true });
    const mos = [...P.keys()].sort();
    const byFy = new Map(); for (const m of mos) (byFy.get(fyOf(m)) ?? byFy.set(fyOf(m), []).get(fyOf(m))).push(m);
    for (const [fy, fm] of byFy) {
      const editions = new Set(fm.map(editionOf));
      if (editions.size !== 1) throw new Error(`tradestat bake: HS ${lvl} ${fy} spans two HS editions`);
      const edition = [...editions][0];
      const lines = [["flow", "hs_level", "hs_code", "description", "quantity_unit", "date", "value", "value_unit", "revision_flag", "hs_edition", "financial_year", "code_note", "source", "vintage"].join(",")];
      const rows = [];
      for (const m of fm) for (const [c, it] of P.get(m).items) if (it.value != null)
        rows.push([FLOW[flow], lvl, c, tidyDesc(it.desc), unit === "qty" ? (it.unit || "") : "", iso(m), unit === "qty" ? it.value : r2(it.value), UNIT[unit][1], P.get(m).flag, edition, fy,
          it.star ? "marked * by TradeStat: code dropped or re-allocated, unit possibly changed, at an annual ITC-HS revision" : "", "Ministry of Commerce, TradeStat MEIDB (DGCI&S)", V]);
      rows.sort((x, y) => (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : x[5] < y[5] ? -1 : 1));
      for (const r of rows) lines.push(r.map(csvCell).join(","));
      const file = `${STAGE}/meidb-${FLOW[flow]}-hs${lvl}-${unit}-${fy}.csv.gz`;
      fs.mkdirSync(path.join(root, STAGE), { recursive: true });
      fs.writeFileSync(path.join(root, file), zlib.gzipSync(lines.join("\n") + "\n", { level: 9 }));
      archived.push({ file, rows: rows.length, flow: FLOW[flow], level: lvl, unit, fy, edition, months: fm.length });
    }
  }
  if (archived.length) {
    fs.writeFileSync(path.join(root, STAGE, "files.json"), JSON.stringify({ note: "Staged 6- and 8-digit TradeStat tables for the deep archive; they roll up to trade-hs4-exports and trade-hs4-imports.", files: archived }, null, 1) + "\n");
    console.log(`tradestat bake: ${archived.length} archive files, ${archived.reduce((a, f) => a + f.rows, 0).toLocaleString("en-IN")} rows, in ${STAGE}`);
  }

  /* ---- commodity x partner, financial years and year to date, US$ (HS 2 and 4 digits) ---- */
  const pickers = (readRaw(root, rel.pickers())?.rows ?? []).map(([c, n]) => [c, decode(n)]);
  for (const lvl of [2, 4]) for (const flow of ["export", "import"]) {
    if (!pickers.length || !fs.existsSync(path.join(root, rel.cxc(flow, lvl, pickers[0][0], latest)))) { console.warn(`  tradestat bake: commodity x partner HS ${lvl} ${flow} not archived yet, skipped`); continue; }
    const fysAll = new Set(), cells = new Map(), flags = new Map(), ytdCells = new Map(); let ytdFlags = null;
    const descs = new Map();
    let missing = 0;
    for (const [code, name] of pickers) {
      const ck = ckey(countryName(name));
      const F = fyPanelOf(root, (mo) => rel.cxc(flow, lvl, code, mo), (raw, mo) => (raw ? parseCommodity(raw, mo) : null), latest);
      if (!F.years.size) { missing++; continue; }
      for (const [fy, x] of F.years) {
        fysAll.add(fy); flags.set(fy, x.flag);
        for (const [c, it] of x.items) { if (it.value == null || it.value === 0) continue; descs.set(c, it.desc); cells.set(`${fy}|${ck}|${c}`, it.value); cells.set(`name|${ck}`, name); }
      }
      if (F.ytd) { ytdFlags = F.ytd.flags; for (const [c, it] of F.ytd.items) { if (!it.prev && !it.cur) continue; descs.set(c, it.desc); ytdCells.set(`${ck}|${c}`, [it.prev, it.cur]); cells.set(`name|${ck}`, name); } }
    }
    if (missing) console.warn(`  tradestat bake: commodity x partner HS ${lvl} ${flow}: ${missing} partners have no archived tables yet`);
    const fys = [...fysAll].sort();
    const pairs = [...new Set([...cells.keys()].filter((k) => !k.startsWith("name|")).map((k) => k.split("|").slice(1).join("|")))].sort();
    const series = {};
    for (const p of pairs) {
      const [ck, c] = p.split("|");
      series[`${ck}__c${c}`] = { name: `${ck}__c${c}`, label: `${countryName(cells.get(`name|${ck}`))}: ${tidyDesc(descs.get(c))} (HS ${c})`, color: "#A3A9B4", group: countryName(cells.get(`name|${ck}`)), data: fys.map((fy) => r2(cells.get(`${fy}|${p}`) ?? null)) };
    }
    W(`trade-partner-hs${lvl}-${FLOW[flow]}`, fys.map(fyStartIso), series, { frequency: "annual", base: "TradeStat, as published", unit: "usd_million",
      revision: Object.fromEntries(fys.map((fy) => [fyStartIso(fy), flags.get(fy)])),
      coverage: `What India ${flow === "export" ? "sells to" : "buys from"} each partner, by HS ${lvl === 2 ? "chapter" : "heading"}: every partner x every ${lvl === 2 ? "chapter" : "heading"} traded, each financial year since 2016-17, US$ million`,
      note: "TradeStat MEIDB country-wise all-commodities tables, March calls (April-to-March cumulatives; R from the following March where it exists). Only pairs with trade are listed: a missing pair traded nothing that year (TradeStat prints no line for it)." });
    if (ytdCells.size) {
      const curFy = fyOf(latest), prevFy = fyOf(addMonths(latest, -12));
      const ys = {};
      for (const [p, v] of [...ytdCells].sort()) { const [ck, c] = p.split("|"); ys[`${ck}__c${c}`] = { name: `${ck}__c${c}`, label: `${countryName(cells.get(`name|${ck}`))}: ${tidyDesc(descs.get(c))} (HS ${c})`, color: "#A3A9B4", group: countryName(cells.get(`name|${ck}`)), data: [r2(v[0]), r2(v[1])] }; }
      W(`trade-partner-hs${lvl}-${FLOW[flow]}-ytd`, [fyStartIso(prevFy), fyStartIso(curFy)], ys, { frequency: "annual", base: "TradeStat, as published", unit: "usd_million",
        period: { from: "04", to: latest.slice(5, 7), label: `April to ${MONTHS[+latest.slice(5, 7) - 1]}` }, revision: { [fyStartIso(prevFy)]: ytdFlags?.[0] ?? null, [fyStartIso(curFy)]: ytdFlags?.[1] ?? null },
        coverage: `What India ${flow === "export" ? "sells to" : "buys from"} each partner by HS ${lvl === 2 ? "chapter" : "heading"}, April to ${MONTHS[+latest.slice(5, 7) - 1]} this year and a year earlier, US$ million`,
        note: "TradeStat MEIDB country-wise all-commodities tables, the latest month's cumulative columns. A part of a year." });
    }
  }

  return { written, V };
}
