// scripts/lib/products/markets-catalogue.mjs: the coverage catalogue of the markets family
// (docs/CONTRACT-coverage.md), generated from the sources' own listings:
//   - the Data Bank's DBIE inventory (data/derived/rbi_dbie_webi_inventory.csv): every report in
//     the menus this guide owns (equity and corporate debt market; the four company-study menus;
//     listed companies; the consumer confidence survey) and the reports named in its brief (CP and
//     CD, gold, mutual funds, capital issues, household financial saving, the expectation surveys);
//   - for every report the Data Bank holds, its items at every cut, read from the report's rows;
//   - the RBI Innovation Hub's catalogue: the SPF tables and every SDMX dataset under Corporate
//     Sector and Financial Markets > Equity and Corporate Debt Market, with their items.
//
//   node scripts/lib/products/markets-catalogue.mjs --catalogue
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { databankRoot, dbieProviders, dbieProvider } from "../databank.mjs";
import { rbihubCatalogue, rbihubCsv } from "../rbihub.mjs";
import { parseCsv } from "../tabular.mjs";
import { writeCatalogue, catalogueCli, ROOT } from "../catalogue.mjs";
import { slug, tidy } from "./markets-lib.mjs";
import { CFD } from "./markets-companies.mjs";
import { LISTED_TABLES } from "./markets-hub.mjs";

const MENUS = ["Equity and Corporate Debt Market", "Finances of FDI Companies", "Non-Government Non-Financial Private Limited Companies", "Non-Government Non-Financial Public Limited Companies",
  "Non-Government Non-Banking Financial and Investment Companies", "Listed Non-Government Non-Financial Companies", "Urban Consumer Confidence Survey (UCCS)"];
const NAMED = ["4", "5", "31", "32", "93", "94", "566", "1395", "17", "108", "197", "519", "674", "126", "382", "283", "289", "527", "52", "261", "277", "899", "246", "508", "1225", "1226",
  "271", "272", "273", "1478", "1473", "1474", "1475", "1476", "1477", "695", "696", "1354"];
const id = (...p) => p.map((x) => slug(String(x), 48).replace(/_/g, "-")).join(":");

// per report: which columns name an item (and its cut), for the reports read whole
const KEYS = {
  17: (r) => [r.Description], 108: (r) => [r["Item Description"]], 126: () => ["aum"], 197: (r) => [r.Description ?? r["Item Description"]],
  1355: (r) => [`sk${r["Item Sk"]}`, r["Hbs Hierarchy Level 1"], r["item Description"]], 277: (r) => [`sk${r["Item Sk"]}`, r["Hbs Hierarchy Level 1"], r["Hbs Hierarchy Level 2"]],
  1356: () => ["amount", "number"], 1360: (r) => [r["Item Description"]], 1359: (r) => [r.fin_system_level1, r.fin_system_level2], 1361: (r) => [r["Mutual Fund Description"]],
  1225: (r) => [r["Item Hierarchy Level 1"], r["Item Hierarchy Level 2"], r["Item Hierarchy Level 3"], r["Item Hierarchy Level 4"], r["Item Description"]],
  1226: (r) => [r["Item Hierarchy Level 1"], r["Item Hierarchy Level 2"], r["Item Hierarchy Level 3"], r["Item Hierarchy Level 4"], r["Item Description"]],
  246: (r) => [r.Item], 1350: (r) => [r["Item Description_NSE_BSE"]], 1351: (r) => [r["Item Description_NSE_BSE"]], 990: (r) => [r["Time Fis End Of Year"] === "Y" ? "fiscal-year" : "monthly"],
  1352: (r) => ["Turnover (in Rupees crore) (Monthly)" in r ? "monthly" : "fiscal-year"], 1357: (r) => [r["Stock Exchange"], r["Instrument Type"]],
  658: () => ["equity-turnover", "market-capitalisation", "traded-volume"], 680: () => ["equity-turnover", "market-capitalisation", "traded-volume"],
};
const CUTS = { sales: "Puc Description", puc: "Puc Description", industry: "Cfd Industry Name", country: "Country Name", ownership: "Cfd Industry Name", activity: "Investement Type Description" };

export async function catalogueMarkets() {
  const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
  const db = databankRoot(cfg.families.databank);
  const inv = parseCsv(fs.readFileSync(path.join(db, "data/derived/rbi_dbie_webi_inventory.csv"), "utf8"), ",");
  const head = inv[0], rows = inv.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
  const reports = rows.filter((r) => MENUS.includes(r.menu) || NAMED.includes(r.report_id));
  const cfdIds = new Map(CFD.map((c) => [c[0], c]));
  const items = [];
  for (const rep of reports) {
    const rid = rep.report_id, name = tidy(rep.report_name);
    const held = rep.last_status === "raw_validated";
    if (!held || !(KEYS[rid] || cfdIds.has(rid) || rid === "1075")) { items.push({ id: `dbie:${rid}:report`, label: `${name} (DBIE report ${rid}, ${rep.frequency || "frequency not stated"}; ${held ? "in the Data Bank" : rep.last_status})`, dims: { report: rid, status: rep.last_status, menu: rep.menu } }); continue; }
    const seen = new Set();
    for (const p of dbieProviders(db, rid)) {
      const r0 = dbieProvider(db, rid, p.id).rows;
      if (cfdIds.has(rid)) {
        const cut = cfdIds.get(rid)[4];
        for (const r of r0) {
          if (!("Item Description" in r)) continue;
          const fmt = rid >= "731" && rid <= "754" && rid.length === 3 ? "nbfc" : /^latest/i.test(r["Report Tab Format"] ?? "") ? "latest" : /^histor/i.test(r["Report Tab Format"] ?? "") ? "historical" : +String(r["Time Fis Year"] ?? "0").slice(0, 4) >= 2020 ? "latest" : "historical";
          const c = cut ? tidy(r[CUTS[cut]]) || "all" : "all";
          const code = r["Item Sk"] ?? r["Item Code"] ?? r["Item Display Order"];
          const k = `cfd:${rid}:${fmt}:${id(c)}:${id(code, tidy(r["Item Description"]))}`;
          if (!seen.has(k)) { seen.add(k); items.push({ id: k, label: `${name}: ${tidy(r["Item Description"])}${c !== "all" ? ` (${c})` : ""}, ${fmt} format`, dims: { report: rid, format: fmt, cut: c } }); }
        }
      } else if (rid === "1075") {
        for (const r of r0) { const k = `cfd:1075:${id(r["Item Hierarchy Level 2"], r["Item Hierarchy Level 3"], r["Item Sk"], r["Item Description"])}`; if (!seen.has(k)) { seen.add(k); items.push({ id: k, label: `${name}: ${tidy(r["Item Description"])}`, dims: { report: rid } }); } }
      } else {
        // the unit pickers (tiny providers with only Unit columns) are not data
        if (r0.length && Object.keys(r0[0]).every((h) => /unit/i.test(h))) continue;
        for (const r of r0) {
          const parts = KEYS[rid](r).flatMap((x) => (Array.isArray(x) ? x : [x])).filter((x) => x != null && String(x).trim() !== "");
          const list = rid === "1356" || rid === "658" || rid === "680" ? parts.map((x) => [x]) : [parts];
          for (const ps of list) {
            const k = `dbie:${rid}:${ps.map((x) => id(x)).join(":")}`;
            if (!seen.has(k)) { seen.add(k); items.push({ id: k, label: `${name}: ${ps.map(tidy).join(", ")}`, dims: { report: rid, provider: p.id } }); }
          }
        }
      }
    }
  }
  // the RBI Innovation Hub: SPF and the SDMX datasets this family covers
  const cat = await rbihubCatalogue();
  const spf = cat.find((e) => String(e.report_id) === "1475" && e.status === "loaded");
  if (spf) {
    const t = parseCsv(await rbihubCsv(spf.schema_name, spf.table_name), ",");
    const h = t[0], R = t.slice(1).map((r) => Object.fromEntries(h.map((x, i) => [x, r[i] ?? ""])));
    for (const p of [...new Set(R.map((r) => r.period))]) items.push({ id: `hub:spf:1475:round-slot:${p}`, label: `SPF round-wise tables, the slot for round ${p}`, dims: { period: p } });
    const ind = new Set();
    for (const r of R) {
      if (!["Annex I", "Annex II"].includes(r.tab)) continue;
      const c2 = tidy(String(r.c2).replace(/\s*\n\s*/g, " "));
      if (!c2 || /Key Macroeconomic|^Mean$/i.test(c2) || !/\d/.test(r.c5 + r.c7)) continue;
      const k = `hub:spf:1475:${id(r.tab)}:${id(c2)}`;
      if (!ind.has(k)) { ind.add(k); items.push({ id: k, label: `SPF ${r.tab}: ${c2}`, dims: { tab: r.tab } }); }
    }
    for (const x of ["cpi-combined-general", "cpi-combined-excluding-food", "wpi-all-commodities", "wpi-non-food-manufactured"]) items.push({ id: `hub:spf:1475:annex-iii:${x}`, label: `SPF Annex III: ${x.replace(/-/g, " ")}`, dims: { tab: "Annex III" } });
    items.push({ id: "hub:spf:1475:main-tables", label: "SPF main tables (medians summarising the annexes)", dims: { tab: "Main Tables" } });
  }
  for (const e of cat.filter((e) => String(e.report_id) === "1476" || String(e.report_id) === "1477")) items.push({ id: `hub:spf:${e.report_id}`, label: `${e.title} (${e.status})`, dims: { status: e.status } });
  const listedTables = new Set(LISTED_TABLES.map((x) => x[0]));
  for (const e of cat.filter((e) => e.source === "sdmx" && e.status === "loaded" && (/^Data Query > Corporate Sector/.test(e.menu_path) || /Equity and Corpor/.test(e.menu_path)))) {
    if (!listedTables.has(e.table_name)) { items.push({ id: `hub:sdmx:${id(e.table_name)}`, label: `${e.title} (SDMX dataset, ${e.row_count} rows)`, dims: { menu: e.menu_path } }); continue; }
    const t = parseCsv(await rbihubCsv(e.schema_name, e.table_name), ",");
    const h = t[0], R = t.slice(1).map((r) => Object.fromEntries(h.map((x, i) => [x, r[i] ?? ""])));
    const [, , cut] = LISTED_TABLES.find((x) => x[0] === e.table_name);
    const cutCol = { sector: "ind_clasf_rn", industry: "inds_grp_rn", puc: "puc_cls_rn", sales: "sale_sz_cls_rn" }[cut];
    const seen = new Set();
    for (const r of R) {
      const k = `hub:listed:${id(e.table_name)}:${cutCol ? id(r[cutCol]) : "all"}:${id(r.perf_ind_rn ?? r.typ_ratio_rn)}:${id(r.unit_measure)}`;
      if (!seen.has(k)) { seen.add(k); items.push({ id: k, label: `${e.title}: ${r.perf_ind_rn ?? r.typ_ratio_rn} (${r.unit_measure})${cutCol ? `, ${r[cutCol]}` : ""}`, dims: { table: e.table_name } }); }
    }
  }
  return writeCatalogue("markets", {
    source: "Reserve Bank of India: DBIE reports (the local Data Bank's inventory and rows) and the RBI Innovation Hub's DBIE catalogue",
    generator: "scripts/lib/products/markets-catalogue.mjs --catalogue",
    note: "Items: one per report item at each cut (company studies: per format, cut and item; listed companies: per table, cut, indicator and unit). Reports the Data Bank does not hold, or that this family does not read whole, are one item each.",
    items,
  });
}

await catalogueCli(import.meta.url, catalogueMarkets);
void os;
