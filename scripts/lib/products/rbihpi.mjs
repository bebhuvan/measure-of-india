// scripts/lib/products/rbihpi.mjs: the Reserve Bank of India's house price index, by city.
// DBIE report 688 ("House Price Index", Prices & Wages), quarterly, read from the owner's Data
// Bank mirror (scripts/lib/databank.mjs dbieReport). The index is built from registration
// (transaction) data that state registration authorities send the RBI.
//
// THREE BASES, never joined (AGENTS.md rule 1). Report 688 labels each row's series:
//   "HPI-Q4:2008-09"  base Q4 2008-09 = 100, 9 cities, Q4 2008-09 to Q4 2012-13
//   "HPI-Q1:2010-11"  base 2010-11 = 100, 10 cities, Q1 2010-11 to Q4 2024-25
//   "HPI-Q1:2022-23"  base 2022-23 = 100, 18 cities, Q1 2022-23 onward
// The report carries city indices only; the all-India composites (10 cities, 18 cities) come
// through BIS (bis-property-10cities, bis-property-cities in scripts/lib/products/bis.mjs).
//
// Versions: rows are "Final" or "Provisional". Where both exist they are usually equal, but RBI
// does revise, sometimes sharply (Chandigarh Jul-Sep 2025: 109.0 provisional, 128.3 final). We keep
// Final where it exists and Provisional otherwise, and list provisional quarters on each series.
// Dates: the quarter-end date in the report (2026/03/31) is baked as the quarter's first month
// (2026-01-01), the convention of every quarterly bundle here.
//
// Year-on-year change is computed here from the index levels, within each base only, and
// labelled as derived (housing-rbi-2010-yoy, housing-rbi-2022-yoy).
//
// Hand check: the 18-city all-India index for Q4 2025-26 (115.85, via BIS) against 115.9 in the RBI
// press release of 29 May 2026; city values as in DBIE. See docs/reference/rbi-hpi.md.
import fs from "node:fs";
import path from "node:path";
import { databankRoot, dbieReport } from "../databank.mjs";
import { writeSeries, writeRaw, writeJson } from "../util.mjs";

const BASES = [
  { tag: "HPI-Q4:2008-09", slug: "housing-rbi-2009", base: "2008-09=100", label: "base Q4 2008-09 = 100" },
  { tag: "HPI-Q1:2010-11", slug: "housing-rbi-2010", base: "2010-11=100", label: "base 2010-11 = 100", yoy: true },
  { tag: "HPI-Q1:2022-23", slug: "housing-rbi-2022", base: "2022-23=100", label: "base 2022-23 = 100", yoy: true },
];
export const citySlug = (c) => c.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const qStart = (s) => { const [y, m] = s.slice(0, 7).split("/").map(Number); return `${y}-${String(m - 2).padStart(2, "0")}-01`; };
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

export async function buildRbihpi(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const rep = dbieReport(db, "688");
  if (rep.rows.length < 1000) throw new Error(`rbihpi: no data returned: DBIE report 688 has ${rep.rows.length} rows (expected ~1,200)`);

  const rawRel = "data/raw/housing-rbi-hpi.json";
  writeRaw(root, rawRel, { vintage, note: "RBI DBIE report 688, House Price Index, read from the Data Bank's DBIE mirror. Every row as read.",
    provenance: rep.provenance, header: rep.header, rows: rep.rows });
  const V = JSON.parse(fs.readFileSync(path.join(root, rawRel), "utf8")).vintage;

  // (tag, city, date) -> { Final, Provisional }
  const cell = new Map();
  for (const x of rep.rows) {
    const v = parseFloat(x["Index Value"]);
    if (!Number.isFinite(v)) continue;
    const k = `${x["Dseries Description"]}|${x["City Name"]}|${qStart(x["Time Date"])}`;
    const o = cell.get(k) ?? {}; o[x["Version Desc"]] = v; cell.set(k, o);
  }
  const tags = new Set([...cell.keys()].map((k) => k.split("|")[0]));
  for (const t of tags) if (!BASES.some((b) => b.tag === t)) throw new Error(`rbihpi: unrecognised series "${t}" in report 688 (a new base?)`);

  // coverage catalogue (docs/CONTRACT-coverage.md): every (base, city) series report 688 serves
  writeJson(root, "data/coverage/bis-rbihpi.catalogue.json", {
    family: "bis-rbihpi", source: "Reserve Bank of India, House Price Index (DBIE report 688)",
    generator: "scripts/lib/products/rbihpi.mjs (runs with node scripts/fetch.mjs only rbihpi)",
    generated_at: rep.provenance.retrieved_at.slice(0, 10),
    items: [...new Set([...cell.keys()].map((k) => k.split("|").slice(0, 2).join("|")))].sort().map((k) => {
      const [tag, city] = k.split("|"); const B = BASES.find((b) => b.tag === tag);
      return { id: `rbihpi:${B.base.slice(0, 7)}:${citySlug(city)}`, label: `${city}, house price index, ${B.label}`, dims: { base: B.base, city } };
    }),
  });

  for (const B of BASES) {
    const keys = [...cell.keys()].filter((k) => k.startsWith(B.tag + "|"));
    if (!keys.length) throw new Error(`rbihpi: no data returned for ${B.tag}`);
    const cities = [...new Set(keys.map((k) => k.split("|")[1]))].sort();
    const ds = [...new Set(keys.map((k) => k.split("|")[2]))].sort();
    const dates = [];
    for (let [y, m] = ds[0].split("-").map(Number); ; ) {
      const iso = `${y}-${String(m).padStart(2, "0")}-01`; dates.push(iso); if (iso >= ds.at(-1)) break;
      m += 3; if (m > 12) { m -= 12; y++; }
    }
    const series = {}, yoy = {};
    for (const c of cities) {
      const prov = [];
      const data = dates.map((d) => {
        const o = cell.get(`${B.tag}|${c}|${d}`);
        if (!o) return null;
        if (o.Final != null && o.Provisional != null && Math.abs(o.Final - o.Provisional) > 1e-6)
          console.warn(`rbihpi: ${c} ${d} Final ${o.Final} != Provisional ${o.Provisional} (Final kept)`);
        if (o.Final == null) prov.push(d);
        return r2(o.Final ?? o.Provisional);
      });
      const k = citySlug(c);
      const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
      const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
      series[k] = { name: k, label: `${c}, house price index (${B.label})`, data, ...(gaps.length ? { gaps } : {}), ...(prov.length ? { provisional: prov } : {}) };
      if (B.yoy) {
        const yd = data.map((v, i) => (i >= 4 && v != null && data[i - 4] != null ? Math.round((v / data[i - 4] - 1) * 10000) / 100 : null));
        const f = yd.findIndex((v) => v != null), l = yd.length - 1 - [...yd].reverse().findIndex((v) => v != null);
        const g = dates.filter((d, i) => i > f && i < l && yd[i] == null);
        yoy[k] = { name: k, label: `${c}, house prices, % change on a year ago (derived from the index)`, data: yd, ...(g.length ? { gaps: g } : {}), ...(prov.length ? { provisional: prov } : {}) };
      }
    }
    const meta = (extra) => ({ dossier: "rbihpi", source: dcfg.source_agency, vintage: V, mock: false, geo: "IND", frequency: "quarterly",
      base: B.base, releaseDate: null, revisionPolicy: dcfg.revision_policy, latestPeriod: dates.at(-1).slice(0, 7), ...extra });
    const provAll = [...new Set(Object.values(series).flatMap((s) => s.provisional ?? []))].sort();
    writeSeries(root, `data/series/${B.slug}.json`, {
      meta: meta({ unit: "index", coverage: `RBI house price index for ${cities.length} cities, ${B.label}`,
        note: `RBI DBIE report 688, series ${B.tag}. Final values where published, provisional otherwise${provAll.length ? ` (provisional: ${provAll.join(", ")})` : ""}. City indices only; the all-India composite is in the BIS bundles.`, cities }),
      dates, series,
    });
    if (B.yoy) {
      // the y/y axis starts with the first computable quarter (a year after the base series starts)
      const f = Math.min(...Object.values(yoy).map((s) => s.data.findIndex((v) => v != null)).filter((i) => i >= 0));
      for (const s of Object.values(yoy)) s.data = s.data.slice(f);
      writeSeries(root, `data/series/${B.slug}-yoy.json`, {
        meta: meta({ unit: "pct_yoy", coverage: `House prices in ${cities.length} cities, % change on a year ago, ${B.label}`,
          note: `Derived: (index / index four quarters earlier - 1) x 100, computed from RBI DBIE report 688 (${B.tag}) within this base only.`, cities }),
        dates: dates.slice(f), series: yoy,
      });
    }
  }
}
