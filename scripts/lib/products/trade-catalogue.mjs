// scripts/lib/products/trade-catalogue.mjs: the coverage catalogue for TradeStat
// (docs/CONTRACT-coverage.md), generated from the source's own pickers and tables:
//   - the view list is the site's navigation (every MEIDB, EIDB, FTPA and FTSPCC form, both
//     flows), mapped live on 2026-10-09 (docs/reference/tradestat.md);
//   - the code lists are the HS codes the archived tables print, per level and HS edition;
//   - the partner list is the form's country picker; regions are the region table's rows;
//   - principal commodities are the FTPA table's rows.
// Ids run coarse to fine: <bank>:<flow>:<unit>:<frequency>:<cut>[:<edition>]:<code>.
// Written to data/coverage/trade.catalogue.json; never typed by hand.

import fs from "node:fs";
import path from "node:path";
import { readRaw, rel, RAW, months, FIRST_MONTH, FIRST_FTPA, addMonths } from "./tradestat.mjs";
import { editionOf, countryName, ckey } from "./tradestat-bake.mjs";
import { decode } from "../tradestat.mjs";

const FLOWS = ["export", "import"];
const ed = (mo) => editionOf(mo).replace(/\s+/g, "").toLowerCase();   // "hs2017" | "hs2022"

function codesIn(root, flow, lvl, unit, mos) {
  const out = new Map();    // code -> { desc, editions:Set }
  for (const mo of mos) {
    const r = readRaw(root, rel.cw(flow, lvl, unit, mo));
    if (!r) continue;
    const h = r.header.at(-1), iC = h.findIndex((c) => /HS\s*Code/i.test(c)), iD = h.findIndex((c) => /Commodity/i.test(c));
    for (const row of r.rows) {
      const c = (row[iC] ?? "").trim(); if (!/^\d{2,8}$/.test(c)) continue;
      const x = out.get(c) ?? { desc: row[iD], editions: new Set() }; x.editions.add(ed(mo)); out.set(c, x);
    }
  }
  return out;
}

export function writeTradeCatalogue(root, { latest, latestFtpa }) {
  const items = [];
  const add = (id, label, dims) => items.push({ id, label, dims });
  const mos = months(FIRST_MONTH, latest);
  const marches = mos.filter((m) => m.endsWith("-03"));

  // partners TradeStat has printed with trade in at least one region table since 2017; the
  // rest of its picker (territories with no recorded trade) is catalogued as "silent"
  const traded = new Set();
  for (const f of fs.readdirSync(path.join(root, RAW, "meidb-region"))) {
    const r = readRaw(root, `${RAW}/meidb-region/${f}`);
    for (const row of r.rows) { const m = row[0].match(/^\d+\)\s*(.+)$/); if (m) traded.add(ckey(countryName(m[1]))); }
  }
  const silent = (name) => !traded.has(ckey(countryName(name)));
  for (const flow of FLOWS) {
    const F = flow + "s";
    // totals
    for (const unit of ["usd", "inr"]) for (const freq of ["monthly", "fy", "ytd"]) add(`meidb:${flow}:${unit}:${freq}:total`, `India's total ${F}, ${unit}, ${freq}`, { flow, unit, freq, level: "total" });
    // HS 2 and 4 digits, US$ and ₹, monthly / financial year / year to date
    for (const lvl of [2, 4]) {
      const codes = codesIn(root, flow, lvl, "usd", mos);
      for (const unit of ["usd", "inr"]) for (const freq of ["monthly", "fy", "ytd"]) for (const [c, x] of codes)
        add(`meidb:${flow}:${unit}:${freq}:hs${lvl}:${c}`, `${x.desc} (HS ${c}), ${F}, ${unit}, ${freq}`, { flow, unit, freq, level: `hs${lvl}` });
      add(`meidb:${flow}:qty:monthly:hs${lvl}`, `HS ${lvl}-digit ${F}, quantity (the whole table)`, { flow, unit: "qty", level: `hs${lvl}` });
      for (const unit of ["usd", "inr"]) add(`meidb:${flow}:${unit}:calendar-ytd:hs${lvl}`, `HS ${lvl}-digit ${F}, calendar-year running totals, ${unit}`, { flow, unit, freq: "calendar-ytd" });
    }
    // HS 6 and 8 digits, by edition
    for (const lvl of [6, 8]) {
      const codes = codesIn(root, flow, lvl, "usd", mos);
      // the tail: one item per code and edition where the table is baked (US$ at 6 and 8
      // digits, quantity at 8); labels are the code only (descriptions live in the bundles)
      for (const [c, x] of codes) for (const e of x.editions) {
        add(`meidb:${flow}:usd:monthly:hs${lvl}:${e}:${c}`, `HS ${c}`);
        if (lvl === 8) add(`meidb:${flow}:qty:monthly:hs${lvl}:${e}:${c}`, `HS ${c}`);
      }
      add(`meidb:${flow}:inr:monthly:hs${lvl}`, `HS ${lvl}-digit ${F}, ₹ (the whole table)`, { flow, unit: "inr", level: `hs${lvl}` });
      if (lvl === 6) add(`meidb:${flow}:qty:monthly:hs${lvl}`, `HS 6-digit ${F}, quantity (the whole table)`, { flow, unit: "qty", level: "hs6" });
      for (const unit of ["usd", "inr", "qty"]) add(`meidb:${flow}:${unit}:fy:hs${lvl}`, `HS ${lvl}-digit ${F}, financial-year running totals, ${unit}`, { flow, unit, freq: "fy", level: `hs${lvl}` });
      for (const unit of ["usd", "inr", "qty"]) add(`meidb:${flow}:${unit}:calendar-ytd:hs${lvl}`, `HS ${lvl}-digit ${F}, calendar-year running totals, ${unit}`, { flow, unit, freq: "calendar-ytd" });
    }
    // partners and regions (the region table carries every country under its region)
    const reg = readRaw(root, rel.region(flow, "usd", latest));
    const pickers = (readRaw(root, rel.pickers())?.rows ?? []).map(([c, n]) => [c, decode(n)]);
    for (const unit of ["usd", "inr"]) for (const freq of ["monthly", "fy", "ytd"]) {
      for (const [code, name] of pickers) add(`meidb:${flow}:${unit}:${freq}:${silent(name) ? "country-silent" : "country"}:${code}`, `${name}, ${F}, ${unit}, ${freq}`);
      for (const row of reg?.rows ?? []) {
        const m = row[0].match(/^(\d+(?:\.\d+)?)\s+(.+)$/); if (!m) continue;
        add(`meidb:${flow}:${unit}:${freq}:region:${m[1]}`, `${m[2]}, ${F}, ${unit}, ${freq}`, { flow, unit, freq, cut: "region" });
      }
      add(`meidb:${flow}:${unit}:${freq}:country-table`, `The partner table (country_wise_${flow}), ${unit}, ${freq}`, { flow, unit, freq });
      add(`meidb:${flow}:${unit}:${freq}:region-table`, `The region table (region_wise_${flow}), ${unit}, ${freq}`, { flow, unit, freq });
      add(`meidb:${flow}:${unit}:${freq}:predefined-groups`, `BIMSTEC, CAR and CIS, EAEU (predefined_group_of_countries_${flow}), ${unit}, ${freq}`, { flow, unit, freq });
    }
    add(`meidb:${flow}:any:any:customised-groups`, `Groups of countries the reader chooses (customised_group_of_countries_${flow})`, { flow });
    // commodity x partner
    for (const [code, name] of pickers) {
      for (const lvl of [2, 4]) {
        const c = silent(name) ? "country-silent" : "country";
        add(`meidb:${flow}:usd:fy:${c}-hs${lvl}:${code}`, `${name} x HS ${lvl}-digit, ${F}, US$, financial year`);
        add(`meidb:${flow}:usd:ytd:${c}-hs${lvl}:${code}`, `${name} x HS ${lvl}-digit, ${F}, US$, year to date`);
      }
    }
    for (const lvl of [2, 4, 6, 8]) {
      add(`meidb:${flow}:usd:monthly:country-hs${lvl}`, `Every partner x HS ${lvl}-digit, ${F}, US$, each month (the whole table)`, { flow, cut: `country-hs${lvl}` });
      for (const unit of ["inr", "qty"]) add(`meidb:${flow}:${unit}:any:country-hs${lvl}`, `Every partner x HS ${lvl}-digit, ${F}, ${unit} (the whole table)`, { flow, unit, cut: `country-hs${lvl}` });
    }
    for (const lvl of [6, 8]) for (const freq of ["fy", "ytd"]) add(`meidb:${flow}:usd:${freq}:country-hs${lvl}`, `Every partner x HS ${lvl}-digit, ${F}, US$, ${freq} (the whole table)`, { flow, cut: `country-hs${lvl}` });
    add(`meidb:${flow}:any:any:commodity-all-countries`, `One HS code across every partner (commodity_wise_all_countries_${flow})`, { flow });
    add(`meidb:${flow}:any:any:region-all-commodities`, `One region across every HS code (region_wise_all_commodities_${flow})`, { flow });
    add(`meidb:${flow}:any:any:principal-commodity-hs`, `The HS lines behind each principal commodity (principal_commodity_wise_all_HSCode_${flow})`, { flow });
    add(`meidb:${flow}:any:any:country-principal-commodity-hs`, `One partner x the HS lines of one principal commodity (country_wise_principal_commoditywiseall_hscode_${flow})`, { flow });

    // FTPA principal commodities (groups and items), US$ and ₹, monthly (derived) and financial year
    const ft = readRaw(root, rel.ftpa(flow, "usd", latestFtpa));
    const fcodes = (ft?.rows ?? []).map((r) => r[0].match(/^([A-Z]\d|ZZ|\d{1,2})\s+(.+)$/)).filter(Boolean);
    for (const unit of ["usd", "inr"]) for (const freq of ["monthly", "fy"]) {
      for (const m of fcodes) add(`ftpa:${flow}:${unit}:${freq}:${/^\d/.test(m[1]) ? "group" : "item"}:${m[1].toLowerCase()}`, `${m[2]}, principal commodity, ${F}, ${unit}, ${freq}`, { flow, unit, freq, cut: "principal-commodity" });
      add(`ftpa:${flow}:${unit}:${freq}:total`, `Total ${F} (FTPA), ${unit}, ${freq}`, { flow, unit, freq });
    }
    add(`ftpa:${flow}:any:any:summary-report`, `Principal commodity groups only (the summary form of the same table)`, { flow });
    // FTSPCC principal commodities: quantity (baked), values and unit values (re-cuts)
    const fq = readRaw(root, rel.ftspccQty(flow, latest));
    for (const r of fq?.rows ?? []) {
      const m = (r[1] ?? "").match(/^([A-Z]\d|ZZ),\s*(.+)$/); if (!m) continue;
      add(`ftspcc:${flow}:qty:monthly:item:${m[1].toLowerCase()}`, `${m[2]}, principal commodity, ${F}, quantity (${r[2] || "no unit"})`, { flow, unit: "qty", cut: "principal-commodity" });
    }
    for (const unit of ["usd", "inr", "inr-per-unit", "usd-per-unit"]) add(`ftspcc:${flow}:${unit}:monthly:items`, `Principal commodities, ${F}, ${unit} (FTSPCC)`, { flow, unit });
  }
  // FTPA and FTSPCC export-only views
  for (const v of ["export_matrix_new", "import_matrix_new", "export_region_wise", "export_region_xcountry_wise", "export_top_n_commodities_new", "export_top_n_countries"])
    add(`ftpa:view:${v.replace(/_/g, "-")}`, `FTPA view ${v}`, { view: v });
  for (const v of ["export_commodity_wise_all_countries", "export_commodity_wise_fiveyears", "export_commodity_xCountry_nxn_matrices", "export_commodity_xcountry_wise_annual",
    "export_commodity_xcountry_wise_monthly", "export_country_wise_all_commodities", "export_region_wise", "export_region_wise_all_commodities", "export_region_wise_all_countries",
    "export_customised_group_of_countries", "export_predefined_group_of_countries"])
    add(`ftspcc:view:${v.toLowerCase().replace(/_/g, "-")}`, `FTSPCC view ${v}`, { view: v });
  add(`ftspcc:export:any:monthly:country-wise`, `Exports by partner each month since April 2010 (FTSPCC export_country_wise)`, { flow: "export" });
  // FTSPCC total trade by partner, financial years since 2009-10
  const tt = readRaw(root, rel.ttrade("usd", months(FIRST_FTPA, latestFtpa).filter((x) => x.endsWith("-03")).at(-1)));
  for (const r of tt?.rows ?? []) if (/^\d+$/.test(r[0])) for (const unit of ["usd", "inr"]) add(`ftspcc:ttrade:${unit}:fy:country:${r[1].toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, `${r[1]}: exports, imports, total trade and balance, ${unit}, financial year`, { unit, cut: "country" });
  add(`ftspcc:ttrade:any:monthly:partial-year`, `Total trade by partner for a part of the year (the non-March tables)`, {});
  // EIDB: the annual bank, every view, both flows
  for (const v of ["commodity_wise", "chapter_wise_all_commodities", "commodity_wise_all_countries", "commodityx_countries_wise", "country_wise", "country_wise_all_commodities",
    "region_wise", "region_wise_all_countries", "region_wise_all_commodities", "predefined_group_of_countries", "customised_group_of_countries"])
    for (const flow of FLOWS) add(`eidb:${flow}:${v.replace(/_/g, "-")}`, `EIDB (annual bank) ${v}_${flow}`, { flow, view: v });
  add(`eidb:total-trade:country-wise-ttrade`, `EIDB country_wise_ttrade`, {});

  const out = { family: "trade", source: "Ministry of Commerce and Industry, TradeStat (MEIDB, EIDB, FTPA, FTSPCC)", generator: "scripts/lib/products/trade-catalogue.mjs (run by scripts/fetch.mjs only trade)",
    generated_at: new Date().toISOString().slice(0, 10), latest: { meidb: latest, ftpa: latestFtpa }, items };
  const p = path.join(root, "data/coverage/trade.catalogue.json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  // generated_at moves only when the item list changes, so a re-run does not dirty git
  if (fs.existsSync(p)) {
    const prev = JSON.parse(fs.readFileSync(p, "utf8"));
    if (JSON.stringify(prev.items) === JSON.stringify(items)) out.generated_at = prev.generated_at;
  }
  fs.writeFileSync(p, JSON.stringify(out, null, 0).replace(/},\{"id"/g, '},\n{"id"') + "\n");
  console.log(`wrote data/coverage/trade.catalogue.json (${items.length} items)`);
}
