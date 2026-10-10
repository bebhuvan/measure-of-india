// scripts/lib/products/profiles-nfhs6.mjs: the National Family Health Survey, round 6
// (2023-24), from the IIPS fact sheets, for the state profiles (docs/briefs/state-profiles.md).
//
// Source of record: IIPS and the Ministry of Health and Family Welfare, "National Family Health
// Survey (NFHS-6) 2023-2024 Fact Sheets", a 182-page PDF (sha256 59dec561e837bea0...,
// sources.yml profiles-nfhs6). MoSPI's API serves only NFHS-4 and NFHS-5, so NFHS-6 enters as a
// new source: the owner's parse of that PDF (~/Documents/Bhuvan projects/Indica doc parse,
// out/nfhs6_clean/nfhs6_indicators.csv: 101 indicators x India and 35 states and UTs; native PDF
// text for born-digital pages, a vision model for the rest, no values estimated). This adapter
// reads that CSV, archives it with the PDF's sha256 in data/raw/profiles-nfhs6.json, and bakes:
//   profiles-nfhs6         NFHS-6, every indicator x geography x urban/rural/total
//   profiles-nfhs6-nfhs5   the NFHS-5 (2019-21) totals the same fact sheets print beside them,
//                          on NFHS-6's definitions (a reference column, not MoSPI's NFHS-5)
// Each is its own ruler: NFHS-6 is never joined to NFHS-5 (sources.yml seams: profiles-nfhs6).
//
// Checks, before anything is written:
//  - every geography places through the state key; 36 geographies x 101 indicators, no repeats;
//  - every value is a percentage in 0 to 100, or a fertility rate in 0.5 to 8;
//  - THE PARSE CHECK: the fact sheets' NFHS-5 column is matched, indicator by indicator, with
//    MoSPI's NFHS-5 bundles (data/series/nfhs-5-*), by value across states. Where an indicator
//    matches, at least 98% of its state cells must agree to the fact sheet's rounding (0.06),
//    and at least 60 of the 101 indicators must match. A shifted row, a misread page or a state
//    put on another state's page fails here. Measured 2026-10-10: 69 indicators match, 2,436 of
//    2,440 cells agree; the other 32 are NFHS-6 additions or indicators the fact sheets restate
//    on new definitions (health insurance: Bihar 17.4% printed for NFHS-5, 14.55% in MoSPI).
//  - Checked by hand against the PDF (pages 43 to 45, Bihar): stunting 35.6% (NFHS-5 42.9%),
//    health insurance 21.5 / 21.1 / 21.1 (urban, rural, total), women with a bank account 90.9%,
//    men's tobacco use 45.8%: all as baked.
// Fact-sheet marks: "*" is suppressed (fewer than 25 unweighted cases): not baked, counted in
// meta.omitted; "(x)" is based on 25 to 49 cases: baked and flagged `caution` on its series.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeRaw, writeSeries } from "../util.mjs";
import { place } from "../../../src/dossiers/states-key.js";

// the fact sheet's printed section headers, which carry the population a row describes
// (read off the PDF's pages 21 to 23 for each state; the parse keeps only the row text)
const CONTEXT = [
  [20, 24, "Currently married women age 15-49 using family planning: "],
  [25, 27, "Currently married women age 15-49, "],
  [78, 80, "Women age 15 and above, "],
  [81, 83, "Men age 15 and above, "],
  [84, 86, "Women age 15 and above, "],
  [87, 89, "Men age 15 and above, "],
];
const clean = (t) => t
  .replace(/kg\/m\s?2/g, "kg/m²")
  .replace(/([a-z)*])\s?\d{1,2}(,\s?\d{1,2})*(?=\s*\(%\)\s*$)/, "$1")
  .replace(/\s*\(%\)\s*$/, "")
  .replace(/\s+/g, " ").trim();
const SECTOR = { nfhs6_total: "total", nfhs6_urban: "urban", nfhs6_rural: "rural" };
const keyPart = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").trim().split("\n");
  const split = (l) => { const o = []; let cur = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(cur); cur = ""; } else cur += ch; } o.push(cur); return o; };
  const head = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(split(l).map((v, i) => [head[i], v])));
}
// a fact-sheet cell: number, "(number)" (caution), "*" or blank (none)
function cell(v) {
  const t = String(v ?? "").trim();
  if (t === "" || t === "*" || /^na$/i.test(t)) return { v: null, omitted: true };
  const m = /^\((-?\d+(?:\.\d+)?)\)$/.exec(t);
  if (m) return { v: +m[1], caution: true };
  if (!/^-?\d+(\.\d+)?$/.test(t)) throw new Error(`profiles-nfhs6: unreadable cell "${t}"`);
  return { v: +t };
}

export async function buildProfilesNfhs6(ROOT, dcfg, VINTAGE) {
  const F = dcfg.fetch;
  const src = F.csv.replace(/^~/, os.homedir());
  if (!fs.existsSync(src)) throw new Error(`profiles-nfhs6: the parsed fact sheets are not at ${src} (sources.yml profiles-nfhs6.fetch.csv)`);
  const text = fs.readFileSync(src, "utf8");
  const rows = parseCsv(text);

  // geography and shape
  const geoOf = (g) => (g === "India" ? "india" : place(g));
  const geos = [...new Set(rows.map((r) => r.geography))];
  for (const g of geos) if (!geoOf(g)) throw new Error(`profiles-nfhs6: the state key cannot place "${g}"`);
  const inds = [...new Set(rows.map((r) => r.indicator_no))];
  if (geos.length !== 36 || inds.length !== 101 || rows.length !== 36 * 101) throw new Error(`profiles-nfhs6: expected 36 geographies x 101 indicators, got ${geos.length} x ${inds.length} (${rows.length} rows)`);
  const seen = new Set();
  for (const r of rows) { const k = r.geography + "|" + r.indicator_no; if (seen.has(k)) throw new Error(`profiles-nfhs6: ${k} twice`); seen.add(k); }
  // anchor: India's institutional births, NFHS-6, as printed (page 26)
  const anchor = rows.find((r) => r.geography === "India" && r.indicator_no === "35");
  if (!anchor || !(+anchor.nfhs6_total > 80 && +anchor.nfhs6_total <= 100)) throw new Error("profiles-nfhs6: no data returned: India, institutional births (anchor assertion)");

  // the parse check against MoSPI's NFHS-5
  const n5 = new Map(), groups = new Set();
  for (const f of fs.readdirSync(path.join(ROOT, "data/series")).filter((x) => /^nfhs-5-.*\.json$/.test(x))) {
    const b = JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", f), "utf8"));
    for (const s of Object.values(b.series)) {
      if (s.sector !== "total") continue;
      const g = s.geo === "All India" ? "india" : place(s.geo);
      groups.add(f + "|" + s.group);
      n5.set(f + "|" + s.group + "|" + g, s.data[0]);
    }
  }
  let matched = 0, agree = 0, cells = 0;
  const check = {};
  for (const no of inds) {
    const rs = rows.filter((r) => r.indicator_no === no);
    let best = null;
    for (const g of groups) {
      let a = 0, n = 0;
      for (const r of rs) { const c = cell(r.nfhs5_total), v = n5.get(g + "|" + geoOf(r.geography)); if (c.v == null || v == null) continue; n++; if (Math.abs(v - c.v) <= 0.06) a++; }
      if (n && (!best || a > best.a)) best = { g, a, n };
    }
    if (best && best.n >= 20 && best.a >= 0.8 * best.n) {
      matched++; agree += best.a; cells += best.n;
      check[no] = { mospi: best.g.replace(/\.json\|/, ": "), agree: best.a, of: best.n };
    }
  }
  if (matched < 60) throw new Error(`profiles-nfhs6: only ${matched} of 101 indicators match MoSPI's NFHS-5 (expected 60 or more): the parse may be misaligned`);
  if (agree < 0.98 * cells) throw new Error(`profiles-nfhs6: ${cells - agree} of ${cells} NFHS-5 cells disagree with MoSPI: the parse may be misaligned`);
  console.log(`profiles-nfhs6: parse check, ${matched} indicators match MoSPI's NFHS-5, ${agree} of ${cells} state cells agree`);

  // archive first
  const manifestFile = path.join(path.dirname(src), "nfhs6_factsheets.manifest.json");
  const origin = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")).origin : null;
  if (origin && origin.sha256 !== F.pdf_sha256) throw new Error(`profiles-nfhs6: the parse is of a PDF with sha256 ${origin.sha256}, not the registered ${F.pdf_sha256}`);
  writeRaw(ROOT, "data/raw/profiles-nfhs6.json", { vintage: VINTAGE, note: "IIPS NFHS-6 (2023-24) fact sheets, as parsed by the owner's Indica doc parse (out/nfhs6_clean/nfhs6_indicators.csv), with the PDF's sha256 and URL. Rows exactly as the CSV carries them.", pdf: { url: F.pdf_url, sha256: F.pdf_sha256, pages: origin?.page_count ?? null }, parseCheck: { matched, agree, cells, indicators: check }, rows });

  // bake
  const label = (r) => { const no = +r.indicator_no; const c = CONTEXT.find(([a, b]) => no >= a && no <= b); return (c ? c[2] : "") + clean(r.indicator); };
  const unitOf = (r) => (+r.indicator_no === 18 ? "births_per_woman" : "percent");
  const mk = (date, period, base, extra) => ({ dates: [date], series: {}, meta: { dossier: "profiles-nfhs6", product: "profiles-nfhs6", source: "IIPS and the Ministry of Health and Family Welfare, NFHS-6 (2023-24) fact sheets", base, frequency: "cross-sectional", unit: "percent", vintage: dcfg.vintage, geo: "IND", latestPeriod: period, releaseDate: dcfg.release_date, revisionPolicy: "Fact-sheet estimates; the national and state reports may revise a figure. Each round is a cross-section, compared with the last by design and never chained.", omitted: 0, ...extra } });
  const six = mk("2024-01-01", "NFHS-6, 2023-24", "NFHS-6 (2023-24)", { coverage: "India and every state and UT, urban, rural and total: the 101 indicators of the NFHS-6 fact sheets", note: "Values as the fact sheets print them. A figure in brackets in the fact sheet (25 to 49 unweighted cases) is flagged caution; a suppressed one (*) is not baked. Indicators 78 to 89 are printed under 'Women' and 'Men' headers; their labels say which." });
  const five = mk("2020-01-01", "NFHS-5, 2019-21", "NFHS-5 (2019-21), as printed in the NFHS-6 fact sheets", { coverage: "India and every state and UT, total: the NFHS-5 column of the NFHS-6 fact sheets", note: "The NFHS-5 figures the NFHS-6 fact sheets print beside each indicator, on NFHS-6's definitions. For 69 indicators they agree with MoSPI's NFHS-5 to rounding; for the rest the fact sheets restate them or MoSPI does not serve them. A reference column for comparison with NFHS-6, not a replacement for MoSPI's NFHS-5." });
  for (const r of rows) {
    const g = geoOf(r.geography), gname = g === "india" ? "All India" : r.geography;
    const lab = label(r), no = String(r.indicator_no).padStart(3, "0");
    const put = (B, sector, raw) => {
      const c = cell(raw);
      if (c.v == null) { B.meta.omitted++; return; }
      if (unitOf(r) === "percent" ? c.v < 0 || c.v > 100 : c.v < 0.5 || c.v > 8) throw new Error(`profiles-nfhs6: ${r.geography} indicator ${no} ${sector} = ${c.v} is out of range`);
      B.series[`${keyPart(g === "india" ? "all_india" : r.geography)}__i${no}__${sector}`] = {
        name: `nfhs6_i${no}_${keyPart(gname)}_${sector}`, label: `${lab}, ${gname}${sector === "total" ? "" : ", " + sector}`,
        unit: unitOf(r), group: lab, geo: gname, ...(g !== "india" ? { state: r.geography } : {}), sector, indicator: +r.indicator_no,
        ...(c.caution ? { flags: { caution: true } } : {}), data: [c.v],
      };
    };
    for (const [col, sector] of Object.entries(SECTOR)) put(six, sector, r[col]);
    put(five, "total", r.nfhs5_total);
  }
  writeSeries(ROOT, "data/series/profiles-nfhs6.json", six);
  writeSeries(ROOT, "data/series/profiles-nfhs6-nfhs5.json", five);
  console.log(`profiles-nfhs6: ${Object.keys(six.series).length} NFHS-6 series (${six.meta.omitted} suppressed), ${Object.keys(five.series).length} NFHS-5 reference series`);
}
