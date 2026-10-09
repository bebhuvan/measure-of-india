// scripts/lib/products/external-reer.mjs: the rupee against baskets of currencies. RBI's nominal and
// real effective exchange rate indices (NEER, REER), monthly, from DBIE report 584 through the
// owner's Data Bank mirror (read-only; see external-dbie.mjs).
//
// One bundle per base year and basket (AGENTS.md rule 1, sources.yml seams): an index on a 2015-16
// base and one on a 2004-05 base are different rulers, never joined. Two baskets:
//  - the broad basket, coded "36_" in DBIE: 36 currencies to the 2004-05 base; RBI's 2015-16
//    revision widened it to 40 currencies, and DBIE kept the code;
//  - the 6-currency basket (US dollar, euro, pound, yen, renminbi, Hong Kong dollar).
// Each comes trade-weighted and (broad basket only) export-weighted, nominal and real.
//
// Baked: every base RBI kept for ten years or more (1985 for the broad basket from 1975; 1993-94;
// 2003-04 and 2004-05; 2015-16; the 6-currency 2018-19 and 2022-23 bases). Not baked: the
// short-lived 6-currency bases RBI ran in rolling fashion between 2004 and 2024 (2005-06 to
// 2021-22, two to six years each); every month they cover is on a longer base that is baked.
// The coverage ledger names each.
//
// A REER above 100 means the rupee is stronger in real terms than in the base year: Indian prices
// have risen faster than the basket's, more than the nominal rate has fallen.
//
// Hand check (2026-10-09): broad-basket trade-weighted REER, 2015-16 base, May 2026 = 89.21
// (provisional) in DBIE; the RBI Bulletin's table 41 for the same month should read the same.
import { writeSeries } from "../util.mjs";
import { databankRoot, dbieProviders, num, monthOf, fyStart, vrank, slug, bakeLong, finish, archive, onAxis, monthAxis, dupHandle } from "./external-dbie.mjs";

const RAW = "data/raw/external-dbie";
const baseOf = (s) => {
  const m = String(s).match(/Base\s*:\s*(\d{4}(?:-\d{2,4})?)/);
  if (!m) return null;
  let b = m[1];
  if (/^\d{4}-\d{4}$/.test(b)) b = `${b.slice(0, 4)}-${b.slice(7, 9)}`;   // "2003-2004" -> "2003-04"
  return b;
};
const basketOf = (code) => (code.startsWith("36_") ? "broad" : "six");
const MIN_MONTHS = 120;

export function reerGroups(rows, col) {
  const g = new Map();
  for (const r of rows) {
    const b = baseOf(r[col]); const code = r["Reer Neer Description"];
    if (!b || !/^(36|6)_(N|R)EER_(TRADE|EXPORT)_BASED_WTS$/.test(code)) continue;
    // keyed by the exact DBIE series label too: two stray February 2026 rows carry 6-currency codes
    // under the broad basket's 2015-16 label and disagree with the 6-currency series; they stay
    // their own (two-month) group rather than colliding with it
    const k = `${basketOf(code)}|${b}|${String(r[col]).replace(/\s+/g, " ").trim()}`;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(r);
  }
  return g;
}

export async function buildExternalReer(root, dcfg, vintage, cfg) {
  const db = databankRoot(cfg?.families?.databank);
  const prov = dbieProviders(db, "584");
  const V = archive(root, `${RAW}/reer.json`, vintage, "RBI DBIE report 584: indices of REER and NEER, monthly, every base and basket (the 6- and 36-currency providers carry the same rows; both archived).", prov);
  const p = prov.find((x) => x.name === "Monthly (36-Curr)");
  const col = p.header.find((h) => /^Data Series/.test(h));
  const vcol = p.header.find((h) => /Value/.test(h));
  const groups = reerGroups(p.rows, col);
  let baked = 0;
  for (const [k, rows] of [...groups.entries()].sort()) {
    const [basket, base] = k.split("|");
    const months = new Set(rows.map((r) => r.Date.slice(0, 7))).size;
    if (months < MIN_MONTHS) continue;
    const b = bakeLong(rows, { date: (r) => monthOf(r.Date), round: 4,
      key: (r) => { const m = r["Reer Neer Description"].match(/^(?:36|6)_(NEER|REER)_(TRADE|EXPORT)/); return `${m[1].toLowerCase()}_${m[2].toLowerCase()}`; },
      value: (r) => num(r[vcol]), rank: (r) => vrank(r.Version), version: (r) => r.Version, tol: 0.0005,
      label: (key) => `${key.startsWith("reer") ? "Real" : "Nominal"} effective exchange rate, ${basket === "broad" ? "broad basket" : "6-currency basket"}, ${key.endsWith("trade") ? "trade" : "export"}-weighted (${base} = 100)`,
      order: (r) => r["Reer Neer Description"] });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1)));
    const fin = finish(b, "Not published for these months.", "index");
    const rel = `external-${basket === "broad" ? "reer" : "reer6"}-${base.slice(0, 4)}`;
    const m = { dossier: "external-reer", source: dcfg.source_agency, product: "Indices of REER and NEER of the Indian rupee (DBIE report 584)", base: `${base}=100`, frequency: "monthly", unit: "index",
      geo: "IND", releaseDate: null, mock: false, revisionPolicy: dcfg.revision_policy, vintage: V, latestPeriod: fin.dates.at(-1).slice(0, 7),
      coverage: `The rupee against a ${basket === "broad" ? "broad basket of trading partners' currencies" : "basket of six major currencies"}, nominal and real, ${base} = 100`,
      note: `RBI DBIE report 584, monthly averages, base ${base} = 100${basket === "broad" ? "; DBIE codes the broad basket '36' (36 currencies to the 2004-05 base, 40 from the 2015-16 revision)" : "; six currencies: US dollar, euro, pound sterling, yen, renminbi, Hong Kong dollar"}. A rise is a stronger rupee. Real = nominal adjusted for the gap between Indian and partner prices. A separate ruler from every other base: never joined.` };
    if (fin.empty.length) m.emptyLines = fin.empty;
    writeSeries(root, `data/series/${rel}.json`, { meta: m, dates: fin.dates, series: fin.series });
    baked++;
  }
  if (!baked) throw new Error("external-reer: report 584 served no index long enough to bake");

  // annual averages as RBI publishes them: calendar years (380; 1402 for the 6-currency index)
  // and fiscal years (381; 1403). They are RBI's own annual figures, not our averages of the
  // monthly table (they differ from a plain mean of the months RBI now shows by up to a few
  // tenths, as RBI averages the figures it had at the time): baked as published.
  const annP = ["380", "381", "1402", "1403"].flatMap((id) => dbieProviders(db, id).filter((x) => x.header.some((h) => /Value/.test(h))).map((x) => ({ ...x, rid: id })));
  const VA = archive(root, `${RAW}/reer-annual.json`, vintage, "RBI DBIE: indices of REER and NEER, annual averages, calendar (380, 1402) and fiscal (381, 1403) years.", annP);
  const groups2 = new Map();
  for (const x of annP) for (const r of x.rows) {
    const fiscal = x.rid === "381" || x.rid === "1403";
    // in 380 and 381 the rows with display order 5 and 6 carry 6-currency codes under the broad
    // basket's label, and their values are not the 6-currency annual averages (FY 2025-26 NEER
    // reads 73.76 there, the stray February 2026 monthly value; 1403 and the mean of the months
    // give 76.73): they are not read. The 6-currency annual index comes from 1402 and 1403.
    if ((x.rid === "380" || x.rid === "381") && +r["Reer Neer Display Order"] >= 5) continue;
    const six = x.rid === "1402" || x.rid === "1403";
    const base = six ? "2015-16" : baseOf(r["Data Series"]);
    if (!base) continue;
    const k = `${six ? "six" : "broad"}|${base}|${fiscal ? "fy" : "cal"}`;
    if (!groups2.has(k)) groups2.set(k, []);
    groups2.get(k).push(r);
  }
  for (const [k, rows] of [...groups2.entries()].sort()) {
    const [basket, base, kind] = k.split("|");
    const b = bakeLong(rows, { round: 4, tol: 0.0005,
      date: (r) => (kind === "fy" ? fyStart(r["Fiscal Year"] ?? r["Time Fis Year"]) : /^\d{4}$/.test(r["Time Cal Year"]) ? `${r["Time Cal Year"]}-01-01` : null),
      key: (r) => `${/REER/.test(r["Reer Neer Hierarchy Level3"]) ? "reer" : "neer"}_${/Export/.test(r["Reer Neer HBs Hierarchy Level2"] ?? "") ? "export" : "trade"}`,
      value: (r) => num(r["Reer Neer Value"]), rank: (r) => vrank(r["Version Desc"]), version: (r) => r["Version Desc"],
      label: (key) => `${key.startsWith("reer") ? "Real" : "Nominal"} effective exchange rate, ${basket === "broad" ? "broad basket" : "6-currency basket"}, ${key.endsWith("trade") ? "trade" : "export"}-weighted, ${kind === "fy" ? "fiscal" : "calendar"}-year average (${base} = 100)`,
      order: (r) => `${r["Reer Neer Hierarchy Level3"]}|${r["Reer Neer HBs Hierarchy Level2"]}` });
    onAxis(b, monthAxis(b.dates[0], b.dates.at(-1), 12));
    const fin = finish(b, "Not published for these years.", "index");
    const rel = `external-${basket === "broad" ? "reer" : "reer6"}-${base.slice(0, 4)}-${kind === "fy" ? "fiscal" : "calendar"}`;
    const m = { dossier: "external-reer", source: dcfg.source_agency, product: `Indices of REER and NEER, annual (DBIE report ${basket === "six" ? (kind === "fy" ? "1403" : "1402") : (kind === "fy" ? "381" : "380")})`, base: `${base}=100`,
      frequency: "annual", unit: "index", geo: "IND", releaseDate: null, mock: false, revisionPolicy: dcfg.revision_policy, vintage: VA, latestPeriod: kind === "fy" ? fin.dates.at(-1).slice(0, 7) : fin.dates.at(-1).slice(0, 4),
      coverage: `The rupee against a ${basket === "broad" ? "broad basket of currencies" : "basket of six currencies"}, ${kind === "fy" ? "fiscal" : "calendar"}-year averages, ${base} = 100`,
      note: `RBI DBIE, annual averages as RBI publishes them, base ${base} = 100${kind === "fy" ? "; fiscal years plotted at April of the first year" : ""}. RBI's own annual figures, kept as published; a separate ruler from every other base.` };
    if (fin.empty.length) m.emptyLines = fin.empty;
    writeSeries(root, `data/series/${rel}.json`, { meta: m, dates: fin.dates, series: fin.series });
  }
}

/* ---------------- catalogue ---------------- */

export function catalogue(db) {
  const items = [], handles = {};
  const prov = dbieProviders(db, "584");
  const p = prov.find((x) => x.name === "Monthly (36-Curr)");
  const col = p.header.find((h) => /^Data Series/.test(h));
  for (const [k, rows] of reerGroups(p.rows, col)) {
    const [basket, base, lab] = k.split("|");
    const months = new Set(rows.map((r) => r.Date.slice(0, 7))).size;
    const variant = basket === "six" && !/6 Currency/.test(lab) && reerGroups(p.rows, col).has(`six|${base}|${lab} - 6 Currency`) ? "stray" : "series";
    for (const code of [...new Set(rows.map((r) => r["Reer Neer Description"]))].sort())
      items.push({ id: `dbie:584:${basket}:${base}:${variant}:${code.toLowerCase().replace(/^(36|6)_/, "").replace(/_based_wts$/, "")}`, label: `${code} on base ${base} (${months} months; DBIE series "${lab}")`, dims: { report: "584", basket, base, months, freq: "monthly", variant } });
  }
  handles["584"] = "primary";
  // copies of the monthly table: Bulletin (54), Handbook (306, broad basket only)
  const cell = (r) => { const v = r["Reer Neer Values"] ?? r["Reer Neer Value annual"] ?? r["Reer Neer Value"]; const d = r.Date ?? r["Time Date"];
    const s = r["Data Series_6"] ?? r["Data Series_36"] ?? r["Data Series"]; const code = r["Reer Neer Description"] ?? `${/REER/.test(r["Reer Neer Hierarchy Level3"]) ? "REER" : "NEER"}|${r["Reer Neer HBs Hierarchy Level2"]}`;
    return d && v ? [`${r._p}|${r.Version ?? ""}|${String(s).replace(/\s+/g, " ")}|${d.slice(0, 10).replace(/-/g, "/")}|${baseOf(s)}|${code.replace(/^(36|6)_|_BASED_WTS$/g, "").replace(/_/g, "|").replace(/TRADE/, "Trade-weighted").replace(/EXPORT/, "Export-weighted")}`, num(v)] : null; };
  handles["54"] = dupHandle(db, "584", "54", cell);
  items.push({ id: "dbie:54:copy", label: "Indices of REER and NEER, monthly (Bulletin, DBIE report 54): the same table as report 584", dims: { report: "54", copyOf: "584", match: handles["54"].match } });
  // 306: the Handbook's broad-basket monthly table. Its keys differ from 584's, so it is checked
  // against 584's broad-basket rows directly.
  {
    const P = new Map();
    for (const r of p.rows) { const b = baseOf(r[col]); if (!b || !r["Reer Neer Description"].startsWith("36_")) continue;
      const m = r["Reer Neer Description"].match(/^36_(NEER|REER)_(TRADE|EXPORT)/); const k = `${r.Date.slice(0, 7)}|${b}|${m[1]}|${m[2]}`;
      P.set(k, [...(P.get(k) ?? []), num(r[p.header.find((h) => /Value/.test(h))])]); }   // every version DBIE carries for the month
    let n = 0, hit = 0;
    for (const r of dbieProviders(db, "306").find((x) => x.name === "Query 2").rows) {
      const b = baseOf(r["Data Series"]); const what = r["Reer Neer Hierarchy Level3"].includes("REER") ? "REER" : "NEER"; const w = /Export/.test(r["Reer Neer HBs Hierarchy Level2"]) ? "EXPORT" : "TRADE";
      const v = P.get(`${r["Time Date"].slice(0, 7)}|${b}|${what}|${w}`); if (v == null) continue; n++; if (v.some((x) => Math.abs(x - num(r["Reer Neer Value"])) < 1e-3)) hit++;
    }
    const match = n ? Math.round((hit / n) * 10000) / 10000 : 0;
    if (match < 0.995) throw new Error(`catalogue: report 306 matches report 584 on only ${(match * 100).toFixed(2)}% of ${n} cells`);
    handles["306"] = { dupOf: "584", cells: n, match };
    items.push({ id: "dbie:306:copy", label: "Indices of NEER and REER, broad basket, monthly (Handbook, DBIE report 306): the same values as report 584", dims: { report: "306", copyOf: "584", match, cells: n } });
  }
  // annual tables: RBI's calendar-year (380, 1402) and fiscal-year (381, 1403) averages, baked as
  // published; the Handbook's 275 and 286 are copies of 380 and 381
  for (const id of ["380", "381", "1402", "1403"]) {
    for (const pp of dbieProviders(db, id)) {
      if (!pp.header.some((h) => /Value/.test(h))) continue;
      for (const lab of [...new Set(pp.rows.map((r) => `${baseOf(r["Data Series"] ?? "") ?? "2015-16"}:${String(r["Reer Neer Hierarchy Level3"]).replace(/^[\d.]+\s*/, "")}:${r["Reer Neer HBs Hierarchy Level2"] ?? "Trade-weighted"}${(id === "380" || id === "381") && +r["Reer Neer Display Order"] >= 5 ? ":stray-6-currency-rows" : ""}`))])
        items.push({ id: `dbie:${id}:${slug(lab, 60)}`, label: `Effective exchange rate, annual (DBIE report ${id}): ${lab}`, dims: { report: id, freq: "annual" } });
    }
    handles[id] = "primary";
  }
  const cellA = (r) => { const y = r["Fiscal Year"] ?? r["Time Cal Year"]; return y && r["Reer Neer Value"] ? [`${y}|${r["Data Series"]}|${r["Reer Neer Hierarchy Level3"]}|${r["Reer Neer HBs Hierarchy Level2"]}|${r["Version Desc"]}`, num(r["Reer Neer Value"])] : null; };
  for (const [dup, prim] of [["275", "380"], ["286", "381"]]) {
    handles[dup] = dupHandle(db, prim, dup, cellA);
    items.push({ id: `dbie:${dup}:${handles[dup].unverified ? "copy-unverified" : "copy"}`, label: `Indices of NEER and REER, annual (Handbook, DBIE report ${dup}): the same table as report ${prim}`, dims: { report: dup, copyOf: prim, match: handles[dup].match } });
  }
  return { items, handles };
}
