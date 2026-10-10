// scripts/lib/products/banks.mjs: India's banks one by one, and the co-operative banks and
// financial institutions beside them (the `banks` guide).
//
// Sources, in the DBIE wave's order of precedence (docs/briefs/dbie-wave.md):
//
//  A. The Reserve Bank Innovation Hub's DBIE service (scripts/lib/rbihub.mjs), for the reports
//     DBIE gates behind an input prompt, which the local Data Bank could not fetch:
//       1221  Variables to be published bank and bank group wise (for public access): eight
//             tables of the RBI's off-site returns, every scheduled commercial bank and every
//             bank group, every quarter from December 2013 to March 2026 (balance sheet, asset
//             quality, capital adequacy, profitability, performance ratios, sectoral credit and
//             its bad loans, priority-sector credit, infrastructure lending).
//       772, 784-789, 795-800  the data tables of the RBI's "Primary (Urban) Co-operative
//             Banks' Outlook", as on 31 March, 2014 to 2024 (profit and loss to 2025), including
//             three bank-by-bank tables of the scheduled UCBs (banks-ucb.mjs).
//       617   offices opened by bank group and population group: the service holds only the
//             report's prompt page (no rows); recorded as blocked.
//  B. The local Data Bank (read-only, scripts/lib/databank.mjs):
//       771, 773-777, 810-812  the same Outlook's statistical tables, typed, to March 2026
//             (banks-ucb.mjs; each edition prints the previous March as "Final" and its own
//             March as "Provisional", both stamped with the edition's date: read accordingly);
//       382-398, 801, 873, 1372  the RBI's financial-institutions tables (NABARD, SIDBI, NHB,
//             EXIM Bank, IFCI, SFCs, DICGC, LIC, mutual funds, PSU bonds, private placements,
//             HDFC), baked as published by banks-fi.mjs.
//
// Report 1221, as the service gives it: one CSV of report grids, one block per (table, quarter),
// title and header rows among the data rows. Each block has a "Period | Banks | ..." row; where
// a table splits operations, that row names the operation of each column (Domestic, Overseas,
// Global) and the row above it names the variable, once per run of columns. Banks are listed
// group by group, each group closed by its total row ("Public Sector Banks", "Private Sector
// Banks", "Foreign Bank Group", "Small Finance Bank Group-scheduled", "Local Area Bank Group"),
// then "All Scheduled Commercial Banks". UNITS: the header says "Amount in Rs. Crores", but the
// amounts are in thousands of rupees (State Bank of India's gross advances, March 2026, print
// as 41,89,68,61,219, which is ₹41.9 lakh crore in thousands; the all-bank gross NPA ratio
// computed from the printed amounts equals the printed ratio, and the March figures equal the
// RBI's annual bank-wise tables to the crore: see the hand checks below). Baked in ₹ crore.
//
// Names: banks are named as the RBI names them. The export switched from capitals to title
// case in mid-2022; banks are keyed case-blind. Four rows are the same bank under a new name
// and are joined (RENAMED); a merger is never joined: the merged bank's series ends and the
// acquirer's carries on as reported, with the jump disclosed on the acquirer (MERGERS).
//
// Hand checks (2026-10-10):
//   - State Bank of India, March 2025, global operations: 1221 gives gross NPAs ₹76,880.20 crore
//     and a gross NPA ratio of 1.82 per cent; SBI's audited results for 2024-25 (press release,
//     3 May 2025) report ₹76,880 crore and 1.82 per cent, and the RBI's Statistical Tables
//     Relating to Banks, table 20 (DBIE report 336, credit-loan-quality-banks), ₹76,880.198 crore
//     on gross advances of ₹42,20,702.736 crore, which 1221 prints as ₹42,20,702.74 crore.
//   - All scheduled commercial banks, gross NPA ratio, March 2025, global: 1221 prints 2.22 per
//     cent; the RBI's bank-group table (DBIE report 330, credit-npa) prints 2.22.
// Further cross-checks against the RBI's annual bank-wise tables run in scripts/validate.mjs.
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "../tabular.mjs";
import { writeSeries, writeRaw, readRaw } from "../util.mjs";
import { rbihubCatalogue, rbihubTable, rbihubCsv, rbihubEntry } from "../rbihub.mjs";
import { databankRoot } from "../databank.mjs";
import { buildBanksUcb } from "./banks-ucb.mjs";
import { buildBanksFi } from "./banks-fi.mjs";

export const RBIH_REPORTS = [1221, 617, 772, 784, 785, 786, 787, 788, 789, 795, 796, 797, 798, 799, 800];
export const RAW_RBIH = "data/raw/banks-rbihub.json";

// the same bank under a new name (no merger): joined, and the series label says so
export const RENAMED = {
  "AB BANK LIMITED": "AB BANK PLC",
  "SONALI BANK": "SONALI BANK PLC",
  "HONGKONG AND SHANGHAI BANKING CORPN.LTD.": "THE HONGKONG AND SHANGHAI BANKING CORPORATION LIMITED",
  "SCHEDULED COMMERCIAL BANKS": "ALL SCHEDULED COMMERCIAL BANKS",   // the infrastructure table's name for the all-bank row
};
// mergers inside the span, on the acquirer: a jump in its level series is the merger, not growth
export const MERGERS = {
  "STATE BANK OF INDIA": "From June 2017 includes its five associate banks and Bharatiya Mahila Bank, merged on 1 April 2017.",
  "BANK OF BARODA": "From June 2019 includes Vijaya Bank and Dena Bank, merged on 1 April 2019.",
  "PUNJAB NATIONAL BANK": "From June 2020 includes Oriental Bank of Commerce and United Bank of India, merged on 1 April 2020.",
  "CANARA BANK": "From June 2020 includes Syndicate Bank, merged on 1 April 2020.",
  "UNION BANK OF INDIA": "From June 2020 includes Andhra Bank and Corporation Bank, merged on 1 April 2020.",
  "INDIAN BANK": "From June 2020 includes Allahabad Bank, merged on 1 April 2020.",
  "IDFC FIRST BANK LIMITED": "IDFC Bank became IDFC First Bank on merging with Capital First (December 2018); IDFC Bank's own series ends in December 2018.",
  "DBS BANK INDIA LIMITED": "From March 2021 includes Lakshmi Vilas Bank, amalgamated on 27 November 2020.",
  "HDFC BANK LTD.": "From September 2023 includes HDFC Limited, the housing finance company, merged on 1 July 2023: the largest merger in Indian banking, so HDFC Bank's levels jump that quarter.",
  "AU SMALL FINANCE BANK LIMITED": "From June 2024 includes Fincare Small Finance Bank, merged on 1 April 2024.",
  "SLICE SMALL FINANCE BANK LIMITED": "North East Small Finance Bank became Slice Small Finance Bank on its merger with slice (2025); the North East series ends in March 2025.",
  "UBS AG": "UBS returns to the table in June 2024, after taking over Credit Suisse.",
};
export const GROUPS = {
  "PUBLIC SECTOR BANKS": "psb", "PRIVATE SECTOR BANKS": "private", "FOREIGN BANK GROUP": "foreign",
  "SMALL FINANCE BANK GROUP-SCHEDULED": "sfb", "SMALL FINANCE BANK GROUP-NON-SCHEDULED": "sfb_non_scheduled",
  "LOCAL AREA BANK GROUP": "lab", "ALL SCHEDULED COMMERCIAL BANKS": "all",
};
export const GROUP_LABEL = { psb: "Public sector banks", private: "Private sector banks", foreign: "Foreign banks", sfb: "Small finance banks", sfb_non_scheduled: "Small finance banks, not scheduled", lab: "Local area banks", all: "All scheduled commercial banks" };

// the eight tables of 1221, in the RBI's own numbering
export const TABS = [
  { tab: "Major Balance Sheet Items", slug: "balance-sheet", label: "Balance sheet", no: 1 },
  { tab: "Asset Quality", slug: "asset-quality", label: "Asset quality", no: 2 },
  { tab: "Capital Adequacy", slug: "capital", label: "Capital adequacy", no: 3 },
  { tab: "Profitability", slug: "profitability", label: "Profitability (April to date)", no: 4 },
  { tab: "Performance Indicators", slug: "performance", label: "Performance ratios", no: 5 },
  { tab: "Major Sectoral", slug: "sectoral", label: "Credit and bad loans by sector", no: 8 },
  { tab: "Priority-Non_Priority Break-up", slug: "priority", label: "Priority and non-priority credit", no: 9 },
  { tab: "Infrastructure Financing Items", slug: "infra", label: "Infrastructure lending", no: 10 },
];

const clean = (s) => String(s ?? "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
export const keyOf = (s, n = 48) => clean(s).toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, n).replace(/_$/, "");
export const canonName = (s) => { const u = clean(s).toUpperCase(); return RENAMED[u] ?? u; };
// a variable's label without the table's numbering and arithmetic notes ("8. Gross NPAs ... (a+b+c)")
export const varLabel = (s) => clean(s).replace(/\s*\(April to Date\)/gi, "").replace(/\s*-\s*Standalone$|-Standalone$/i, "").replace(/^(\d+\.|[a-z]\.|[ivx]+\.|[A-Z]\.(?:[a-z]\.)?(?:\d+\.?)*(?:\d+)?|\d+(?:\.\d+)*)\s+/i, "")
  .replace(/\s*\((?:[a-z0-9.]+\s*[+-]\s*)+[a-z0-9.]+\)/gi, "").replace(/\s*\[\s*\d+\s*[+-][^\]]*\]/g, "").replace(/NPAs NPAs/, "NPAs").replace(/\s*-\s*Standalone\b/i, "").replace(/\s*[\[(][\d\s+\-,]+[\])]/g, "").replace(/^Banks in India$/i, "Deposits of banks in India").replace(/^Overseas Banks$/i, "Deposits of overseas banks").replace(/\s+/g, " ").trim();
// "R.b.1.1 Central Govt PSUs" -> "Energy, electricity generation, central govt PSUs": each node of
// the infrastructure list named with its parents (both the R.a-R.f list and the renumbered one)
export function infraLabels(hdr) {
  const codeOf = (h) => { const m = /^(R\.(?:[a-z](?:\.\d+)*)?\.?|\d+(?:\.\d+)*\.?)\s+(.*)$/.exec(h); return m ? [m[1].replace(/\.$/, ""), m[2]] : [null, h]; };
  const name = (t) => t.replace(/\s*\([a-z]\.\d+ to [a-z]\.\d+\)/i, "").replace(/, if any, please specify/i, "").trim();
  const lower = (t) => t.split(" ").map((w) => (/[A-Z].*[A-Z]/.test(w) ? w : w.toLowerCase())).join(" ");
  const byCode = new Map(hdr.map((h) => codeOf(h)).filter(([c]) => c).map(([c, t]) => [c, name(t)]));
  return hdr.map((h) => {
    if (!h) return null;
    const [c, t] = codeOf(h);
    if (!c) return /^total$/i.test(t) ? "All infrastructure" : name(t);
    const parts = c.split("."); const chain = [];
    for (let n = c.startsWith("R") ? 2 : 1; n < parts.length; n++) { const pc = parts.slice(0, n).join("."); if (byCode.has(pc)) chain.push(byCode.get(pc)); }
    chain.push(name(t));
    const L = chain.map((x, j) => (j ? lower(x) : x[0] + lower(x).slice(1))).join(", ");
    return c === "R" ? "All infrastructure" : L;
  });
}
// "Gross NPAs to Gross Advances (%)" -> "Gross NPAs to gross advances (%)": acronyms and India kept
const KEEP = /^(NPAs?|GNPAs?|RWAs?|CET|SLR|ARCs?|NII|EBPT|PAT|NIM|MSE|CRAR|FIs|CCPs|NRI|PSUs?|SEBs|LNG|SEZ|OOI|OE|I|II|III|RBI|India|KVI|HUF|\(%\)|\([A-Z]+\))$/;
const lowerFirst = (t) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
const lowWord = (w) => w.split(/([/-])/).map((p) => (KEEP.test(p.replace(/[,:;()]/g, "")) || /[A-Z].*[A-Z]/.test(p) ? p : p.toLowerCase())).join("");
export const sentenceVar = (l) => l.replace(/ & /g, " and ").split(" ").map((w, i) => { const x = lowWord(w); return i === 0 ? x.replace(/^[a-z]/, (c) => c.toUpperCase()) : x; }).join(" ").replace(/\bindia\b/g, "India").replace(/ - /g, ", ").replace(/\(annualized\)/, "(annualised)");
const PCT = /\(%\)|\bratio\b|\bmargin\b|return on|cost of funds|yield on|to total income|to gross advances|to net advances|annualized/i;
export const unitOfVar = (label) => (PCT.test(label) && !/^(total )?rwas?\b/i.test(label) ? "pct" : "inr_crore");
const num = (s) => { const t = String(s ?? "").replace(/,/g, "").trim(); if (t === "" || t === "-" || /^n\.?a\.?$/i.test(t)) return null; const v = Number(t); return Number.isFinite(v) ? v : null; };
const OPS = { "domestic operation": "domestic", "overseas operation": "overseas", "global operation": "global" };
export const OP_LABEL = { domestic: "domestic operations", overseas: "overseas operations", global: "global operations", all: null };

export const UNNAMED = new Set();   // "tab period" blocks with a column the header does not name
/** Parse report 1221's grid into { periods, tabs: Map(tab -> { vars, cells: Map, entities, scheme }) }. */
export function parse1221(csv) {
  const rows = parseCsv(csv, ",");
  const head = rows[0];
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const blocks = new Map();
  for (const r of rows.slice(1)) {
    if (r.length < 4) continue;
    const k = `${r[ix.tab]}|${r[ix.period]}`;
    if (!blocks.has(k)) blocks.set(k, []);
    blocks.get(k).push(r);
  }
  const out = new Map();
  const periods = new Set();
  for (const [k, block] of blocks) {
    const [tab, period] = k.split("|");
    block.sort((a, b) => +a[ix.row_no] - +b[ix.row_no]);
    const C = (r) => r.slice(ix.c1);   // c1..cN
    const h = block.findIndex((r) => /^period$/i.test(clean(C(r)[0])) && /^banks$/i.test(clean(C(r)[1])));
    if (h < 0) throw new Error(`banks 1221: no "Period | Banks" header row in ${tab} ${period}`);
    const hdr = C(block[h]).map(clean);
    const hasOps = hdr.slice(2).some((c) => OPS[c.toLowerCase()]);
    const cols = [];   // { i, var, op }
    if (hasOps) {
      const above = C(block[h - 1]).map(clean);
      // a variable's label sits over the first of its operation columns; a column whose operation
      // repeats under the same label belongs to a variable the header failed to name (asset
      // quality, item 22, in some quarters): left out and counted, never guessed
      let cur = null, seen = new Set();
      for (let i = 2; i < hdr.length; i++) {
        if (above[i]) { cur = varLabel(above[i]); seen = new Set(); }
        const op = OPS[hdr[i].toLowerCase()];
        if (!op) continue;
        if (seen.has(op)) { cur = null; seen = new Set([op]); UNNAMED.add(`${tab} ${period}`); continue; }
        seen.add(op);
        if (cur) cols.push({ i, var: cur, op });
      }
    } else {
      // infrastructure lending: one column per node of the RBI's list, named by its whole path
      const labs = infraLabels(hdr.slice(2));
      for (let i = 2; i < hdr.length; i++) if (hdr[i]) cols.push({ i, var: labs[i - 2], op: "all", raw: hdr[i] });
      const dup = labs.filter(Boolean).find((l, j, a) => a.indexOf(l) !== j);
      if (dup) throw new Error(`banks 1221: ${tab} ${period}: two columns read "${dup}"`);
    }
    if (!cols.length) throw new Error(`banks 1221: no variable columns in ${tab} ${period}`);
    const date = `${period.slice(0, 7)}-01`;
    periods.add(date);
    const T = out.get(tab) ?? { cells: new Map(), entities: new Map(), varOrder: new Map(), schemes: new Map() };
    out.set(tab, T);
    // the variable scheme of this block (infrastructure lending changed classification)
    T.schemes.set(date, cols.map((c) => c.var));
    T.rawSchemes ??= new Map(); T.rawSchemes.set(date, cols.map((c) => c.raw ?? c.var));
    cols.forEach((c, n) => { if (!T.varOrder.has(c.var)) T.varOrder.set(c.var, T.varOrder.size + n / 1000); });
    let members = [];
    for (const r of block.slice(h + 1)) {
      const c = C(r);
      const name = clean(c[1]);
      if (!name) { if (/^source/i.test(clean(c[0]))) break; continue; }
      const canon = canonName(name);
      const g = GROUPS[canon];
      const ent = g ? `group:${g}` : `bank:${keyOf(canon)}`;
      const e = T.entities.get(ent) ?? { canon, names: new Map(), groups: new Map(), kind: g ? "group" : "bank", group: g ?? null };
      e.names.set(date, name);
      T.entities.set(ent, e);
      if (g) { for (const m of members) T.entities.get(m).groups.set(date, g); members = []; }
      else members.push(ent);
      for (const col of cols) {
        const v = num(c[col.i]);
        if (v == null) continue;
        const ck = `${ent}|${col.var}|${col.op}|${date}`;
        if (T.cells.has(ck) && T.cells.get(ck) !== v) throw new Error(`banks 1221: ${tab} ${name} ${col.var} ${col.op} ${date} printed twice with different values`);
        T.cells.set(ck, v);
      }
    }
  }
  return { periods: [...periods].sort(), tabs: out };
}

// display name: the RBI's name, in sentence-like title case with the acronyms kept
const ACR = new Set(["AB", "AU", "AG", "BNP", "CSB", "CTBC", "DBS", "DCB", "ESAF", "HDFC", "ICICI", "IDBI", "IDFC", "IDFC", "JSC", "VTB", "KEB", "MUFG", "NBD", "PJSC", "PSC", "PLC", "PT", "TBK", "RBL", "SBM", "UBS", "UCO", "J&K", "N.A", "N.V.", "NV", "U.A.", "B.S.C.", "Q.P.S.C.", "Q.P.S.C", "P.J.S.C.", "S.A.O.G.", "LAB", "HSBC", "ING", "KBC", "ANZ"]);
const SMALL = new Set(["of", "and", "the", "for"]);
export function displayName(canon) {
  return canon.replace(/\s+/g, " ").split(" ").map((w, i) => {
    const bare = w.replace(/[(),]/g, "");
    if (ACR.has(bare)) return w;
    const lw = w.toLowerCase();
    if (i && SMALL.has(lw)) return lw;
    return lw.replace(/(^|[(&.-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
  }).join(" ").replace(/\bLtd\b/g, "Ltd").replace(/ ,/g, ",");
}

/** Bake report 1221: per table, a bank-by-bank bundle and a bank-group bundle (infrastructure
 *  lending split at its classification change). Returns a summary for the raw note. */
export function bake1221(root, csv, metaBase) {
  const P = parse1221(csv);
  const dates = P.periods;
  // anchor: the all-bank row must be there, in rupees thousands that make a plausible ₹ lakh crore
  const aq = P.tabs.get("Asset Quality");
  const anchor = aq?.cells.get(`group:all|Gross Advances|domestic|${dates.at(-1)}`);
  if (!(anchor / 1e4 / 1e5 > 100 && anchor / 1e4 / 1e5 < 1000)) throw new Error(`banks 1221: all-bank gross advances at ${dates.at(-1)} = ${anchor} (thousand rupees), expected ₹100 to ₹1,000 lakh crore`);
  const summary = [];
  for (const T0 of TABS) {
    const T = P.tabs.get(T0.tab);
    if (!T) throw new Error(`banks 1221: table "${T0.tab}" missing from the export`);
    // infrastructure lending: the RBI's "R." list (2013 to 2022) and the renumbered list after it
    const parts = T0.slug === "infra"
      ? (() => {
          const newScheme = [...T.rawSchemes.entries()].filter(([, vs]) => vs.some((v) => /^1\. Transport/i.test(v))).map(([d]) => d).sort();
          const cut = newScheme[0];
          if (!cut || newScheme.length !== [...T.schemes.keys()].filter((d) => d >= cut).length) throw new Error("banks 1221: the infrastructure classification change is not a clean cut");
          return [{ rel: "infra-2014", from: null, to: dates[dates.indexOf(cut) - 1], scheme: "the RBI's earlier list of infrastructure sub-sectors (R.a transport to R.f others), December 2013 to " + cut.slice(0, 7) },
                  { rel: "infra", from: cut, to: null, scheme: "the renumbered list of infrastructure sub-sectors (1 transport to 5 social and commercial), from " + cut.slice(0, 7) }];
        })()
      : [{ rel: T0.slug, from: null, to: null }];
    for (const part of parts) {
      const D = dates.filter((d) => (!part.from || d >= part.from) && (!part.to || d <= part.to) && T.schemes.has(d));
      const vars = [...T.varOrder.entries()].sort((a, b) => a[1] - b[1]).map(([v]) => v).filter((v) => D.some((d) => T.schemes.get(d).includes(v)));
      for (const kind of ["bank", "group"]) {
        const series = {};
        for (const [ent, e] of T.entities) {
          if (e.kind !== kind) continue;
          const latestName = [...e.names.entries()].sort().at(-1)[1];
          const name = kind === "group" ? GROUP_LABEL[e.group] : displayName(canonName(latestName));
          const grp = kind === "bank" ? [...e.groups.entries()].sort().at(-1)?.[1] : e.group;
          for (const v of vars) for (const op of ["global", "domestic", "overseas", "all"]) {
            const data = D.map((d) => { const x = T.cells.get(`${ent}|${v}|${op}|${d}`); return x == null ? null : x; });
            if (data.every((x) => x == null || x === 0)) continue;
            const unit = unitOfVar(v);
            const vl = v;
            const k = `${ent.split(":")[1]}__${keyOf(vl, 90)}${op === "all" ? "" : "__" + op}`;
            if (series[k]) throw new Error(`banks 1221: two variables of ${T0.tab} share the key ${k}`);
            series[k] = {
              name: `${k}_${unit}`, unit,
              label: `${name}, ${lowerFirst(sentenceVar(vl))}${OP_LABEL[op] ? `, ${OP_LABEL[op]}` : ""}${T0.slug === "profitability" ? " (April to date)" : ""}`,
              group: kind === "bank" ? GROUP_LABEL[grp] ?? "Bank group not printed" : name,
              data: data.map((x) => (x == null ? null : unit === "pct" ? Math.round(x * 100) / 100 : Math.round(x / 1e4 * 100) / 100)),
            };
            const mg = MERGERS[canonName(latestName)];
            if (kind === "bank" && mg && unit !== "pct") series[k].mergerNote = mg;
          }
        }
        // axis: dates some series has; interior nulls disclosed on each series
        const any = (i) => Object.values(series).some((s) => s.data[i] != null);
        let a = 0, b = D.length - 1; while (a <= b && !any(a)) a++; while (b >= a && !any(b)) b--;
        const DD = D.slice(a, b + 1);
        for (const s of Object.values(series)) {
          s.data = s.data.slice(a, b + 1);
          const f = s.data.findIndex((x) => x != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((x) => x != null);
          const g = DD.filter((d, i) => i > f && i < l && s.data[i] == null);
          if (g.length) { s.gaps = g; s.gapsNote = "The RBI's table prints no figure for this bank and item in these quarters."; }
        }
        const rel = `banks-${kind === "group" ? "groups-" : ""}${part.rel}`;
        // infrastructure lending changed classification: its four bundles are one seam (sources.yml seams: banks-infra)
        writeSeries(root, `data/series/${rel}.json`, { meta: { ...metaBase, ...(T0.slug === "infra" ? { dossier: "banks-infra" } : {}), frequency: "quarterly", unit: "mixed", base: part.rel === "infra-2014" ? "Infrastructure list, R.a to R.f" : part.rel === "infra" ? "Infrastructure list, renumbered" : "Off-site returns, as published",
          latestPeriod: DD.at(-1).slice(0, 7),
          coverage: `${T0.label} of ${kind === "group" ? "every bank group (public sector, private sector, foreign, small finance, local area) and all scheduled commercial banks" : "every scheduled commercial bank, bank by bank"}, every quarter${part.scheme ? `, on ${part.scheme}` : ""}`,
          note: `RBI DBIE report 1221 (table ${T0.no}, "${T0.tab}"), via the Reserve Bank Innovation Hub's data service, as published from the RBI's off-site returns. Amounts are printed in thousands of rupees (the header says crore; see the adapter) and baked in ₹ crore; ratios in per cent. ${T0.slug === "profitability" ? "Income and profit are cumulative from April to the quarter's end, so only the March figure covers a whole financial year. " : ""}Operations: domestic (offices in India), overseas (offices abroad), global (both). A series the RBI prints as zero throughout (overseas operations of a bank with none) is left out. Banks are named as the RBI names them; a renamed bank is one series, a merged bank's series ends and the acquirer's carries on, with the merger in its mergerNote. ${kind === "bank" ? "Each bank's group is the group it was last listed in (IDBI Bank moved from the public to the private sector group in 2019)." : ""}` },
          dates: DD, series });
        summary.push({ bundle: rel, series: Object.keys(series).length, from: DD[0], to: DD.at(-1) });
      }
    }
  }
  return { summary, dates };
}

/** Fetch the Innovation Hub's copies of the prompt-gated reports. Returns { [id]: { entry, table, csv } }. */
async function fetchRbihub() {
  const cat = await rbihubCatalogue();
  if (cat.length < 1000) throw new Error(`banks: the Innovation Hub catalogue listed ${cat.length} entries (expected about 1,430)`);
  const out = {};
  for (const id of RBIH_REPORTS) {
    const e = rbihubEntry(cat, id);
    if (!e) throw new Error(`banks: report ${id} is not loaded on the Innovation Hub service`);
    const t = (await rbihubTable(e.schema_name, e.table_name)).data ?? {};
    const csv = await rbihubCsv(e.schema_name, e.table_name);
    out[id] = { entry: { report_id: e.report_id, title: e.title, menu_path: e.menu_path, frequency: e.frequency, row_count: e.row_count, period_from: e.period_from, period_to: e.period_to, schema: e.schema_name, table: e.table_name },
      loaded_at: t.loaded_at ?? null, rows: csv.split("\n").length - 2, csv };
  }
  return out;
}

export async function buildBanks(root, dcfg, vintage, cfg) {
  // BANKS_FROM_RAW=1 re-bakes from the archived dump without calling the service (development)
  const R = process.env.BANKS_FROM_RAW ? readRaw(root, RAW_RBIH).tables : await fetchRbihub();
  if (R[1221].rows < 40000) throw new Error(`banks: report 1221 served ${R[1221].rows} rows; expected about 42,000`);
  // the audit trail: every table exactly as the service served it
  writeRaw(root, RAW_RBIH, { vintage,
    note: "RBI DBIE reports gated behind an input prompt on DBIE, as served by the Reserve Bank Innovation Hub's data service (data-api.dbie.rbihub.in, /api/tables/{schema}/{table}/csv). Each table's CSV is stored verbatim, with its catalogue entry and the service's loaded_at.",
    tables: R });
  const V = readRaw(root, RAW_RBIH).vintage;
  const metaBase = { dossier: "banks", source: "Reserve Bank of India, DBIE, via the Reserve Bank Innovation Hub's data service", vintage: V, mock: false, geo: "IND", releaseDate: null, revisionPolicy: dcfg.revision_policy };
  const { summary } = bake1221(root, R[1221].csv, metaBase);
  for (const s of summary) console.log(`banks: ${s.bundle}: ${s.series} series, ${s.from} to ${s.to}`);
  bakeShares(root, metaBase);
  bakeHealth(root, metaBase);

  const db = databankRoot(cfg?.families?.databank);
  await buildBanksUcb(root, db, R, metaBase, dcfg, vintage);
  await buildBanksFi(root, db, dcfg, vintage);
}

/** Derived: each bank group's and each bank's share of all scheduled commercial banks' deposits,
 *  advances and assets in India (domestic operations: the only split printed in every quarter),
 *  quarter by quarter. */
export function bakeShares(root, metaBase) {
  const g = JSON.parse(fs.readFileSync(path.join(root, "data/series/banks-groups-balance-sheet.json"), "utf8"));
  const b = JSON.parse(fs.readFileSync(path.join(root, "data/series/banks-balance-sheet.json"), "utf8"));
  const ITEMS = [["total_deposits", "deposits"], ["net_loans_and_advances", "advances"], ["total_assets", "assets"]];
  const series = {};
  for (const [item, word] of ITEMS) {
    const all = g.series[`all__${item}__domestic`];
    if (!all) throw new Error(`banks shares: all-bank ${item} missing`);
    // the all-bank row is the sum of these four groups (local area banks and the non-scheduled
    // small finance banks sit outside it; validate.mjs checks the sum)
    for (const grp of ["psb", "private", "foreign", "sfb"]) {
      const s = g.series[`${grp}__${item}__domestic`]; if (!s) continue;
      series[`${grp}__${word}`] = { name: `${grp}__${word}_share_pct`, unit: "pct", group: GROUP_LABEL[grp],
        label: `${GROUP_LABEL[grp]}, share of all banks' ${word} (derived: group / all scheduled commercial banks, domestic operations (offices in India))`,
        data: g.dates.map((d, i) => (s.data[i] != null && all.data[i] ? Math.round((s.data[i] / all.data[i]) * 10000) / 100 : null)) };
    }
    for (const [k, s] of Object.entries(b.series)) {
      if (!k.endsWith(`__${item}__domestic`)) continue;
      const ai = b.dates.map((d) => g.dates.indexOf(d));
      series[`${k.replace(`__${item}__domestic`, "")}__${word}`] = { name: `${k.replace(`__${item}__domestic`, "")}__${word}_share_pct`, unit: "pct", group: s.group, bank: s.bank,
        label: `${s.bank}, share of all banks' ${word} (derived: bank / all scheduled commercial banks, domestic operations (offices in India))`,
        data: b.dates.map((d, i) => (s.data[i] != null && all.data[ai[i]] ? Math.round((s.data[i] / all.data[ai[i]]) * 10000) / 100 : null)),
        ...(s.mergerNote ? { mergerNote: s.mergerNote } : {}) };
    }
  }
  // align the bank series to the group axis (the bank bundle's axis is the same quarters)
  if (b.dates.join() !== g.dates.join()) throw new Error("banks shares: bank and group balance-sheet axes differ");
  for (const s of Object.values(series)) {
    const f = s.data.findIndex((x) => x != null), l = s.data.length - 1 - [...s.data].reverse().findIndex((x) => x != null);
    const gaps = g.dates.filter((d, i) => i > f && i < l && s.data[i] == null);
    if (gaps.length) { s.gaps = gaps; s.gapsNote = "The RBI's table prints no figure for this bank in these quarters."; }
  }
  for (const k of Object.keys(series)) if (series[k].data.every((x) => x == null)) delete series[k];
  writeSeries(root, "data/series/banks-shares.json", { meta: { ...metaBase, frequency: "quarterly", unit: "pct", base: "Off-site returns, as published", latestPeriod: g.dates.at(-1).slice(0, 7),
    coverage: "Each bank group's and each bank's share of all scheduled commercial banks' deposits, advances and assets, every quarter",
    note: "Derived from RBI DBIE report 1221, table 1 (banks-balance-sheet and banks-groups-balance-sheet): the bank's or group's figure divided by all scheduled commercial banks', domestic operations (offices in India), in per cent. A bank's share jumps when it absorbs another (see each series' mergerNote)." },
    dates: g.dates, series });
}

/** The guide's headline bundle: a selection, not a computation. Report 1221's own group ratios
 *  (domestic operations, the only split printed every quarter) for bad loans, capital, returns
 *  and margins, by bank group, with the public and private sector banks' share of deposits
 *  (banks-shares). Every value is copied from banks-groups-* or banks-shares. */
export function bakeHealth(root, metaBase) {
  const L = (b) => JSON.parse(fs.readFileSync(path.join(root, "data/series", b + ".json"), "utf8"));
  const aq = L("banks-groups-asset-quality"), cap = L("banks-groups-capital"), perf = L("banks-groups-performance"), sh = L("banks-shares");
  const dates = aq.dates;
  for (const b of [cap, perf, sh]) if (b.dates.join() !== dates.join()) throw new Error("banks health: group bundles are on different axes");
  const PICK = [
    ["gnpa", aq, "gross_npas_to_gross_advances", "gross NPA ratio (bad loans, per cent of gross advances)"],
    ["nnpa", aq, "net_npas_to_net_advances", "net NPA ratio (bad loans left after provisions, per cent of net advances)"],
    ["crar", cap, "capital_ratio_crar", "capital adequacy ratio (CRAR, per cent of risk-weighted assets)"],
    ["roa", perf, "return_on_total_assets_annualized", "return on assets (annualised, per cent)"],
    ["roe", perf, "return_on_equity_annualized", "return on equity (annualised, per cent)"],
    ["nim", perf, "net_interest_margin_nim_annualized", "net interest margin (annualised, per cent)"],
  ];
  const series = {};
  for (const g of ["all", "psb", "private", "foreign", "sfb"]) for (const [k, b, v, what] of PICK) {
    const src = b.series[`${g}__${v}__domestic`];
    if (!src) throw new Error(`banks health: ${g}__${v}__domestic missing`);
    series[`${g}_${k}`] = { name: `${g}_${k}_pct`, unit: "pct", group: GROUP_LABEL[g], label: `${GROUP_LABEL[g]}, ${what}, domestic operations`, data: src.data.slice(), ...(src.gaps ? { gaps: src.gaps, gapsNote: src.gapsNote } : {}) };
  }
  for (const g of ["psb", "private"]) { const src = sh.series[`${g}__deposits`]; series[`${g}_deposit_share`] = { name: `${g}_deposit_share_pct`, unit: "pct", group: GROUP_LABEL[g], label: `${GROUP_LABEL[g]}, share of all banks' deposits in India (derived)`, data: src.data.slice() }; }
  writeSeries(root, "data/series/banks-health.json", { meta: { ...metaBase, frequency: "quarterly", unit: "pct", base: "Off-site returns, as published", latestPeriod: dates.at(-1).slice(0, 7),
    coverage: "How healthy India's banks are, quarter by quarter: bad loans, capital, returns and margins for all scheduled commercial banks and each bank group, and the public and private banks' share of deposits",
    note: "A selection from RBI DBIE report 1221 (tables 2, 3 and 5; domestic operations), copied as published from banks-groups-asset-quality, banks-groups-capital and banks-groups-performance; the deposit shares are derived (banks-shares). Small finance banks are reported from December 2016." },
    dates, series });
}

/* ---------- the coverage catalogue (docs/CONTRACT-coverage.md) ----------
 * node scripts/lib/products/banks.mjs --catalogue
 * The listing: the DBIE report catalogue's "Banking - Performance Indicators", "Primary (Urban)
 * Co-operative Banks' Outlook" and "Financial Institutions" menus (the Data Bank's
 * rbi_dbie_report_catalog, read-only), the Innovation Hub's catalogue entries for the
 * prompt-gated reports, and the bank-wise, branch, Trend and Progress and NBFC reports the brief
 * names, which the credit guide bakes. Each report this adapter reads is itemised from its own
 * content (the archived Hub dump, the Data Bank's rows) through the same readers as the bake:
 *   rbih:1221:<table>:<variable>:<operation>:bank|group   report 1221, by bank or by bank group
 *   rbih:<report>:<item>                                   an Outlook grid's item (bank-wise and
 *                                                          state tables: <measure>:bank|state)
 *   dbie:<report>:<item>                                   a Data Bank table's item
 *   dbie:<report>                                          a report read at report level
 * Columns the bake leaves out on purpose are items too, so the ledger has to say why. */
import { SINK } from "./banks-ucb.mjs";
import { FI, FI_SINK, bakeTable } from "./banks-fi.mjs";
import { writeCatalogue, catalogueCli, sourceCfg, idPart } from "../catalogue.mjs";
import { databankQuery } from "../databank.mjs";
import { fileURLToPath } from "node:url";
const GENERAL = (rel, k) => {
  // the entity part of a bank-wise or state key becomes the cut
  if (/^banks-ucb-banks-/.test(rel)) return `${k.split("__").slice(1).join("__")}:bank`;
  if (/^banks-ucb-states/.test(rel)) return `${k.split("__").slice(1).join("__")}:${/^(northern|north_eastern|eastern|central|western|southern|all_india)/.test(k) ? "region" : "state"}`;
  return k;
};
export async function catalogueBanks() {
  const { cfg } = sourceCfg("banks");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const db = databankRoot(cfg?.families?.databank);
  const items = [];
  // the report listing
  const rep = databankQuery(db, "rbi_dbie_report_catalog", "SELECT DISTINCT report_id, report_name, menu FROM {table} WHERE menu IN ('Banking - Performance Indicators', 'Primary (Urban) Co-operative Banks'' Outlook', 'Financial Institutions') OR menu LIKE '%Trend and Progress%' ORDER BY report_id").rows;
  const names = new Map(); for (const r of rep) if (!names.has(r.report_id)) names.set(r.report_id, `${r.report_name.trim()} (${r.menu.trim()})`);
  // reports named by the brief outside those menus (the credit guide bakes them)
  const BRIEF = { 986: "Bank-wise gross NPAs (Statistical Tables)", 1077: "Bank-wise capital adequacy ratios (Statistical Tables)", 1078: "Select ratios of scheduled commercial banks, bank by bank (Statistical Tables)",
    1056: "Bank group-wise select ratios (Statistical Tables)", 1057: "Bank-wise employees (Statistical Tables)", 1112: "Bank-wise earnings and expenses (Statistical Tables)", 1113: "Bank-wise provisions (Statistical Tables)", 1114: "Movement of NPAs, bank by bank (Statistical Tables)",
    1115: "Bank-wise appropriation of profit (Statistical Tables)", 983: "Bank-wise priority sector advances (Statistical Tables)", 1088: "Bank-wise exposure to sensitive sectors (Statistical Tables)",
    115: "Branches by population group (Handbook)", 615: "Bank-wise functioning offices by population group (Statistical Tables)", 618: "State-wise functioning offices (Statistical Tables)", 619: "Bank group-wise functioning offices (Statistical Tables)",
    617: "Offices opened by bank group and population group (Statistical Tables)", 642: "Offices of Indian banks outside India", 745: "Bank-wise and country-wise offices outside India" };
  for (const [id, n] of Object.entries(BRIEF)) if (!names.has(id)) names.set(id, n);
  const READ_RBIH = new Set(RBIH_REPORTS.map(String)), READ_DB = new Set([...FI.map((f) => f.id), "771", "773", "774", "775", "776", "777", "810", "811", "812"]);
  for (const [id, n] of names) if (!READ_RBIH.has(id) && !READ_DB.has(id) && id !== "1221") items.push({ id: `dbie:${id}`, label: n });
  items.push({ id: "databank:rbi_nbfc_credit", label: "Credit by NBFCs and housing finance companies by sector (the Data Bank's parsed dataset; baked by the credit guide)" });
  // 1221, from the archived Hub dump
  const R = readRaw(root, RAW_RBIH).tables;
  const P = parse1221(R[1221].csv);
  for (const T0 of TABS) {
    const T = P.tabs.get(T0.tab);
    const seen = new Map();
    for (const [ck, v] of T.cells) { const [ent, vr, op] = ck.split("|"); const cut = ent.startsWith("group:") ? "group" : "bank"; const id = `rbih:1221:${T0.slug}:${keyOf(vr, 90)}:${op}:${cut}`; seen.set(id, (seen.get(id) ?? false) || v !== 0); if (!seen.has(id + "#l")) seen.set(id + "#l", `${T0.label}: ${vr}, ${OP_LABEL[op] ?? "as printed"}, ${cut === "bank" ? "bank by bank" : "by bank group"}`); }
    for (const [id, nz] of seen) if (!id.endsWith("#l")) items.push({ id: nz ? id : id.replace("rbih:1221:", "rbih:1221:zero:"), label: seen.get(id + "#l") });
  }
  items.push({ id: "rbih:617", label: "Bank group-wise and population group-wise number of offices opened (the Innovation Hub's copy)" });
  // the Outlook: grids and typed tables, through the bake's own readers
  SINK.on = true; SINK.out = [];
  await buildBanksUcb(root, db, R, { vintage: null }, {}, null);
  SINK.on = false;
  const REL2REP = { "banks-ucb-balance-sheet": "795", "banks-ucb-income": "784", "banks-ucb-npa": "785", "banks-ucb-indicators": "788", "banks-ucb-tiers": "786", "banks-ucb-crar": "789", "banks-ucb-ratings": "796", "banks-ucb-size": "772", "banks-ucb-priority": "787", "banks-ucb-states": "800",
    "banks-ucb-banks-ratios": "799", "banks-ucb-banks-balance-sheet": "798", "banks-ucb-banks-income": "797", "banks-ucb-npa-dbie": "774", "banks-ucb-indicators-dbie": "773", "banks-ucb-balance-sheet-shares": "771", "banks-ucb-crar-dbie": "775",
    "banks-ucb-ratings-dbie": "776", "banks-ucb-states-dbie": "777", "banks-ucb-priority-dbie": "810", "banks-ucb-size-dbie": "811", "banks-ucb-structure": "812" };
  for (const o of SINK.out) {
    const r = REL2REP[o.rel]; if (!r) throw new Error(`banks catalogue: no report for ${o.rel}`);
    const pre = READ_RBIH.has(r) ? `rbih:${r}` : `dbie:${r}`;
    const done = new Set();
    for (const k of o.keys) { const g = GENERAL(o.rel, k).replace(/__/g, ":").replace(/_/g, "-"); if (done.has(g)) continue; done.add(g);
      items.push({ id: `${pre}:${g}`, label: /:bank$|:state$|:region$/.test(g) ? `${names.get(r) ?? o.rel}: ${o.labels[k].replace(/^[^,]+, /, "")}, ${g.split(":").at(-1) === "bank" ? "bank by bank" : g.split(":").at(-1) === "state" ? "state by state" : "region by region"}` : o.labels[k] }); }
  }
  for (const m of ["business-per-employee", "profit-per-employee"]) items.push({ id: `rbih:799:${m}:bank`, label: `Scheduled UCBs, bank by bank: ${m.replace(/-/g, " ")}` });
  for (const o of [4, 5, 6, 7]) items.push({ id: `dbie:812:subgroup-${o}`, label: `Structure of UCBs: unlabelled sub-group (display order ${o})` });
  // the financial institutions
  FI_SINK.on = true; FI_SINK.out = [];
  for (const f of FI) bakeTable(root, db, f, {});
  FI_SINK.on = false;
  for (const o of FI_SINK.out) for (const [k, l] of Object.entries(o.labels)) items.push({ id: `dbie:${o.report}:${o.kept.includes(k) ? "" : "zero:"}${k.replace(/_/g, "-")}`, label: `${names.get(o.report) ?? o.rel}: ${l}` });
  writeCatalogue("banks", { source: "Reserve Bank of India: DBIE bank-wise, urban co-operative bank and financial-institution reports (the local Data Bank and the Reserve Bank Innovation Hub's data service)",
    generator: "scripts/lib/products/banks.mjs --catalogue",
    note: "Reports from the Data Bank's rbi_dbie_report_catalog (Banking - Performance Indicators, Primary (Urban) Co-operative Banks' Outlook, Financial Institutions, Trend and Progress) and the reports the brief names; reports this adapter reads are itemised from their own content. ':zero:' marks an item the source prints as zero (or nothing) throughout.",
    items });
}
await catalogueCli(import.meta.url, catalogueBanks);
